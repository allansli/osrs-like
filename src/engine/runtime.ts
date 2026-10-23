// @ts-nocheck
import * as THREE from 'three';
import { ITEMS, TIER_COLORS, isStackableInBackpack, unitSellPrice } from '../data/items';
import { SKILLS_META, OSRS_XP_TABLE, getLevelForXp } from '../data/skills';
import { PRAYERS, SPELLS } from '../data/magic';
import { tryCraft, isLogId } from '../data/recipes';
import { WORLD_REGIONS, MONSTER_TYPES, RESOURCE_NODES_DEF } from '../data/world';
import { STATE, applyState } from '../state/gameState';
import { addItem, removeItem, countItem, canAddItem, sellItem, buyItem } from '../state/inventory';
import { readSave, writeSave, SAVE_KEY, LEGACY_SAVE_KEYS } from '../state/save';
import { prepareAttack, allowedStyles, mitigateDamage, canCastTeleport, equippedWeapon } from '../state/combat';
import { moveWithCollision, isWalkable, isDeepWater } from '../state/collision';
import { discoverShrines } from '../state/shrines';
import { facetMaterial, grassMaterial, PALETTE } from './materials';
import { hexToCss, getUiSvg, getSkillSvg, getItemSvg, getPrayerSvg, getSpellSvg } from '../ui/icons';
import { bridge } from '../ui/bridge';
import {
  renderBankModal,
  renderShopModal as renderShopModalUi,
  renderWorldMap,
  renderQuests,
  renderForge,
  syncSettingsButtons,
  itemCompareHtml
} from '../ui/stations';

const TICK_SEC = 0.6;


// ============================================================================
// 1. PROCEDURAL WEB AUDIO SYNTHESIZER
// ============================================================================
const SFX = (() => {
  let ctx = null;
  function init() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  function tone(freq, type, duration, vol = 0.12, slideTo = null) {
    try {
      if (!STATE.audioEnabled) return;
      init();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }
  return {
    hit: () => { tone(165, 'sawtooth', 0.12, 0.15, 55); tone(95, 'square', 0.09, 0.11, 42); },
    miss: () => { tone(310, 'sine', 0.11, 0.07, 175); },
    bow: () => { tone(540, 'triangle', 0.14, 0.10, 185); },
    magic: () => { tone(440, 'sine', 0.28, 0.13, 880); setTimeout(() => tone(660, 'triangle', 0.22, 0.09, 1120), 60); },
    chop: () => { tone(135, 'triangle', 0.09, 0.14, 70); },
    mine: () => { tone(980, 'square', 0.07, 0.09, 1420); setTimeout(() => tone(1320, 'sine', 0.08, 0.08), 30); },
    fish: () => { tone(360, 'sine', 0.15, 0.09, 540); },
    eat: () => { tone(240, 'sine', 0.09, 0.12, 330); setTimeout(() => tone(310, 'sine', 0.1, 0.12, 410), 80); },
    coin: () => { tone(1200, 'sine', 0.09, 0.11, 1600); setTimeout(() => tone(1650, 'sine', 0.14, 0.11), 65); },
    prayer: () => { tone(528, 'sine', 0.25, 0.12, 792); },
    jump: () => { tone(210, 'sine', 0.18, 0.1, 460); },
    levelUp: () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => setTimeout(() => tone(n, 'triangle', 0.26, 0.15), i * 110));
    }
  };
})();

// ============================================================================
// 2. CUSTOM VECTOR SVG ICON ENGINE (100% Emoji-Free Bespoke Artwork)
// ============================================================================
function initStaticSvgIcons() {
  document.getElementById('hero-crest-icon').innerHTML = getUiSvg('crest');
  document.getElementById('hud-icon-hp').innerHTML = getUiSvg('hp');
  document.getElementById('hud-icon-prayer').innerHTML = getUiSvg('prayer');
  document.getElementById('hud-icon-spec').innerHTML = getUiSvg('spec');
  document.getElementById('gp-coin-svg').innerHTML = getUiSvg('coins');

  document.getElementById('tab-btn-combat').innerHTML = getUiSvg('tab_combat');
  document.getElementById('tab-btn-skills').innerHTML = getUiSvg('tab_skills');
  document.getElementById('tab-btn-inventory').innerHTML = getUiSvg('tab_inv');
  document.getElementById('tab-btn-equipment').innerHTML = getUiSvg('tab_equip');
  document.getElementById('tab-btn-prayer').innerHTML = getUiSvg('prayer');
  document.getElementById('tab-btn-magic').innerHTML = getUiSvg('tab_magic');
}

function addChatMessage(text, type = '') {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'chat-line ' + type;
  div.innerHTML = text;
  box.appendChild(div);
  while (box.children.length > 60) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

function getCombatLevel() {
  const s = STATE.skills;
  const base = 0.25 * (s.defence.lvl + s.hitpoints.lvl + Math.floor(s.prayer.lvl / 2));
  const melee = 0.325 * (s.attack.lvl + s.strength.lvl);
  const range = 0.325 * Math.floor(s.ranged.lvl * 1.5);
  const mage  = 0.325 * Math.floor(s.magic.lvl * 1.5);
  return Math.max(3, Math.floor(base + Math.max(melee, range, mage)));
}

function getItemReqInfo(it) {
  if (!it || !it.req || Object.keys(it.req).length === 0) {
    return {
      canEquip: true,
      plain: 'No Level Requirement',
      badgeHtml: `<div style="font-size:10px; color:#86efac; font-weight:700; margin-top:2px;">Req: None (Ready to Use)</div>`
    };
  }
  const parts = [];
  let allMet = true;
  for (const [skKey, reqLvl] of Object.entries(it.req)) {
    const meta = SKILLS_META[skKey] || { name: skKey };
    const curLvl = STATE.skills[skKey] ? STATE.skills[skKey].lvl : 1;
    const met = curLvl >= reqLvl;
    if (!met) allMet = false;
    parts.push({ skillName: meta.name, reqLvl, curLvl, met });
  }
  const plain = 'Requires: ' + parts.map(p => `Lv ${p.reqLvl} ${p.skillName} (You: ${p.curLvl})`).join(', ');
  const badgeHtml = parts.map(p => {
    const col = p.met ? '#4ade80' : '#f87171';
    const status = p.met ? 'Can Equip' : `Your Lv: ${p.curLvl}`;
    return `<div style="font-size:10px; color:${col}; font-weight:800; margin-top:2px; background:rgba(0,0,0,0.35); padding:2px 5px; border-radius:4px; border-left:2px solid ${col};">Req: Lv ${p.reqLvl} ${p.skillName} (${status})</div>`;
  }).join('');
  return { canEquip: allMet, plain, badgeHtml };
}

function getEquipmentBonuses() {
  let atk = 0, str = 0, def = 0, rng = 0, mag = 0;
  for (const slot of Object.keys(STATE.equipment)) {
    const itemId = STATE.equipment[slot];
    if (itemId && ITEMS[itemId]) {
      const it = ITEMS[itemId];
      atk += (it.atk || 0);
      str += (it.str || 0);
      def += (it.def || 0);
      rng += (it.rng || 0);
      mag += (it.mag || 0);
    }
  }
  const bodyIt = STATE.equipment.body ? ITEMS[STATE.equipment.body] : null;
  const legsIt = STATE.equipment.legs ? ITEMS[STATE.equipment.legs] : null;
  let matchedSet = null;
  if (bodyIt && legsIt && bodyIt.pairId === legsIt.id) {
    matchedSet = bodyIt.setName || `${bodyIt.name} & ${legsIt.name}`;
    atk = Math.ceil(atk * 1.10);
    str = Math.ceil(str * 1.10);
    def = Math.ceil(def * 1.10);
    rng = Math.ceil(rng * 1.10);
    mag = Math.ceil(mag * 1.10);
  }
  return { atk, str, def, rng, mag, matchedSet };
}

function grantXp(skillKey, baseAmount) {
  const s = STATE.skills[skillKey];
  if (!s) return;
  const gained = Math.max(1, Math.round(baseAmount * STATE.xpMultiplier));
  const oldLvl = s.lvl;
  s.xp += gained;
  s.lvl = getLevelForXp(s.xp);

  spawnXpDrop(skillKey, gained);

  if (s.lvl > oldLvl) {
    SFX.levelUp();
    if (skillKey === 'hitpoints') {
      STATE.maxHp = s.lvl;
      STATE.hp = Math.min(STATE.maxHp, STATE.hp + (s.lvl - oldLvl));
    }
    if (skillKey === 'prayer') {
      STATE.maxPrayerPts = s.lvl;
      STATE.prayerPts = STATE.maxPrayerPts;
    }
    const meta = SKILLS_META[skillKey];
    addChatMessage(`Level Up! Your <b>${meta.name}</b> level is now <b>${s.lvl}</b>!`, 'lvlup');
    showLevelUpBanner(meta.name, s.lvl);
    if (typeof spawnLevelUpFireworks === 'function') spawnLevelUpFireworks();
  }
  updateAllUI();
}

function spawnXpDrop(skillKey, amount) {
  const container = document.getElementById('xp-drops-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'xp-drop';
  el.innerHTML = `${getSkillSvg(skillKey)}<span>+${amount.toLocaleString()} XP</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 1850);
}

let lvlBannerTimeout = null;
function showLevelUpBanner(skillName, newLvl) {
  const banner = document.getElementById('levelup-banner');
  const text = document.getElementById('levelup-text');
  if (!banner || !text) return;
  text.textContent = `Congratulations, your ${skillName} level is now ${newLvl}!`;
  banner.classList.add('show');
  if (lvlBannerTimeout) clearTimeout(lvlBannerTimeout);
  lvlBannerTimeout = setTimeout(() => banner.classList.remove('show'), 3500);
}

function addItemToInventory(itemId, count = 1) {
  const result = addItem(STATE, itemId, count);
  if (!result.ok) addChatMessage('Your backpack is full.', 'combat');
  updateAllUI();
  return result.added > 0;
}

function countItemInInventory(itemId) {
  return countItem(STATE, itemId);
}

function removeItemsFromInventory(itemId, count = 1) {
  const removed = removeItem(STATE, itemId, count);
  updateAllUI();
  return removed;
}

function sellInventoryItem(index) {
  const slot = STATE.inventory[index];
  if (!slot) return;
  const item = ITEMS[slot.id];
  const result = sellItem(STATE, slot.id, 1);
  if (!result.ok) {
    addChatMessage(result.reason || 'Cannot sell that.', 'combat');
    return;
  }
  SFX.coin();
  addChatMessage('Sold <b>' + (item ? item.name : slot.id) + '</b> for <b style="color:#ffe642">' + result.gp.toLocaleString() + ' GP</b> (65%).', 'loot');
  updateAllUI();
}

function handleInventoryClick(index) {
  const slot = STATE.inventory[index];
  if (!slot) return;
  const item = ITEMS[slot.id];
  if (!item) return;
  const shopOpen = document.getElementById('shop-modal') && document.getElementById('shop-modal').classList.contains('open');
  if (shopOpen) {
    sellInventoryItem(index);
    return;
  }
  if (isLogId(item.id)) {
    const burned = tryCraft(STATE, 'burn_' + item.id);
    if (!burned.ok) {
      addChatMessage(burned.reason || 'The log will not catch.', 'combat');
      return;
    }
    SFX.chop();
    addChatMessage('You burn the <b>' + item.name + '</b> into ashes.', 'skill');
    grantXp('cooking', burned.xp || 0);
    return;
  }
  if (item.type === 'food') {
    removeItem(STATE, item.id, 1);
    const oldHp = STATE.hp;
    STATE.hp = Math.min(STATE.maxHp, STATE.hp + (item.heal || 1));
    const healed = Math.max(1, Math.round(STATE.hp - oldHp));
    SFX.eat();
    addChatMessage('You eat the <b>' + item.name + '</b> and restore ' + healed + ' Hitpoints.', 'skill');
    if (typeof spawnHitSplatOnPlayer === 'function') spawnHitSplatOnPlayer(healed, 'heal');
    updateAllUI();
    return;
  }
  if (item.type === 'potion') {
    removeItem(STATE, item.id, 1);
    STATE.prayerPts = Math.min(STATE.maxPrayerPts, STATE.prayerPts + (item.restorePrayer || 15));
    SFX.prayer();
    addChatMessage('You drink the <b>' + item.name + '</b> and restore your Prayer energy.', 'skill');
    updateAllUI();
    return;
  }
  if (item.type === 'bones') {
    removeItem(STATE, item.id, 1);
    SFX.prayer();
    addChatMessage('You bury the <b>' + item.name + '</b> beneath the soil.', 'skill');
    grantXp('prayer', item.xp || 0);
    return;
  }
  if (item.type === 'equip') {
    if (item.req) {
      for (const [reqSkill, reqLvl] of Object.entries(item.req)) {
        if (STATE.skills[reqSkill].lvl < reqLvl) {
          addChatMessage('You need <b>Level ' + reqLvl + ' ' + SKILLS_META[reqSkill].name + '</b> to equip ' + item.name + '.', 'combat');
          return;
        }
      }
    }
    const prevEquipped = STATE.equipment[item.slot];
    removeItem(STATE, item.id, 1);
    if (prevEquipped && ITEMS[prevEquipped]) addItem(STATE, prevEquipped, 1);
    STATE.equipment[item.slot] = item.id;
    SFX.coin();
    addChatMessage('Equipped <b>' + item.name + '</b> (' + item.slot + ').', 'skill');
    if (item.slot === 'weapon') {
      const styles = allowedStyles(ITEMS[item.id]);
      if (!styles.includes(STATE.combatStyle)) STATE.combatStyle = styles[0];
    }
    if (typeof rebuildPlayerEquipmentMeshes === 'function') rebuildPlayerEquipmentMeshes();
    updateAllUI();
    return;
  }
  addChatMessage('<b>' + item.name + '</b> — Value: ' + item.price + ' GP. Use it at the Bank, Anvil, or General Store.');
}

function unequipSlot(slotName) {
  const itemId = STATE.equipment[slotName];
  if (!itemId) return;
  if (!canAddItem(STATE, itemId, 1)) {
    addChatMessage('Your backpack is full. The item stays equipped.', 'combat');
    return;
  }
  STATE.equipment[slotName] = null;
  addItem(STATE, itemId, 1);
  if (slotName === 'weapon') STATE.combatStyle = 'accurate';
  if (typeof rebuildPlayerEquipmentMeshes === 'function') rebuildPlayerEquipmentMeshes();
  updateAllUI();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const btn = document.getElementById('tab-btn-' + tabName);
  const content = document.getElementById('tab-' + tabName);
  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

function setCombatStyle(style) {
  const weapon = equippedWeapon(STATE);
  const normalized = style === 'ranged' ? 'rapid' : style;
  const allowed = allowedStyles(weapon);
  if (!allowed.includes(normalized)) {
    const reason = normalized === 'rapid'
      ? 'Rapid ranged attacks need a bow or crossbow equipped.'
      : normalized === 'magic'
        ? 'Autocast magic needs a staff or wand. A sword cannot sling spells.'
        : 'Melee styles need a melee weapon, or empty hands.';
    addChatMessage(reason, 'combat');
    refreshCombatStyleLocks();
    return;
  }
  STATE.combatStyle = normalized;
  refreshCombatStyleLocks();
  updateAllUI();
}

function toggleSpecialAttack() {
  if (STATE.specEnergy < 25 && !STATE.specArmed) {
    addChatMessage('You need at least 25% Special Attack energy!', 'combat');
    return;
  }
  STATE.specArmed = !STATE.specArmed;
  updateAllUI();
}

function togglePrayer(prayerId) {
  const p = PRAYERS.find(x => x.id === prayerId);
  if (!p) return;
  if (STATE.activePrayers.has(prayerId)) {
    STATE.activePrayers.delete(prayerId);
  } else {
    if (STATE.skills.prayer.lvl < p.req) {
      addChatMessage(`You need <b>Prayer Level ${p.req}</b> to activate ${p.name}.`, 'combat');
      return;
    }
    if (STATE.prayerPts <= 0) {
      addChatMessage('You have no Prayer points left! Recharge at any Sacred Altar.', 'combat');
      return;
    }
    if (p.overhead) {
      PRAYERS.filter(o => o.overhead && o.id !== prayerId).forEach(o => STATE.activePrayers.delete(o.id));
    }
    STATE.activePrayers.add(prayerId);
    SFX.prayer();
  }
  updateAllUI();
}

function handleSpellClick(spellId) {
  const sp = SPELLS.find(x => x.id === spellId);
  if (!sp) return;
  if (STATE.skills.magic.lvl < sp.req) {
    addChatMessage('You need <b>Magic Level ' + sp.req + '</b> to cast ' + sp.name + '.', 'combat');
    return;
  }
  if (sp.type === 'combat') {
    const prev = STATE.activeSpell;
    STATE.activeSpell = sp.id;
    const weapon = equippedWeapon(STATE);
    if (allowedStyles(weapon)[0] !== 'magic') {
      STATE.activeSpell = prev;
      addChatMessage('Autocast magic needs a staff or wand. A sword cannot sling spells.', 'combat');
      return;
    }
    STATE.combatStyle = 'magic';
    addChatMessage('Autocast spell set to <b>' + sp.name + '</b>.', 'skill');
  } else if (sp.type === 'teleport') {
    const gate = canCastTeleport(STATE, sp.id);
    if (!gate.ok) {
      addChatMessage(gate.reason, 'combat');
      return;
    }
    Object.entries(gate.runes || {}).forEach(([id, qty]) => removeItem(STATE, id, qty));
    teleportToRegion(gate.regionId || sp.regionId);
    grantXp('magic', sp.xp);
    return;
  }
  updateAllUI();
}

function toggleXpMultiplier() {
  STATE.xpMultiplier = STATE.xpMultiplier === 10 ? 1 : 10;
  const btn = document.getElementById('xp-rate-btn');
  if (btn) {
    btn.textContent = STATE.xpMultiplier === 10 ? '10x League XP' : '1x Classic XP';
    btn.classList.toggle('active', STATE.xpMultiplier === 10);
  }
  addChatMessage(`XP Multiplier set to <b>${STATE.xpMultiplier}x</b>.`, 'skill');
  updateAllUI();
}

function updateAllUI() {
  STATE.maxHp = STATE.skills.hitpoints.lvl;
  STATE.maxPrayerPts = STATE.skills.prayer.lvl;
  const hpPct = Math.max(0, Math.min(100, (STATE.hp / STATE.maxHp) * 100));
  const prayPct = Math.max(0, Math.min(100, (STATE.prayerPts / STATE.maxPrayerPts) * 100));
  document.getElementById('hp-fill').style.width = hpPct + '%';
  document.getElementById('hp-text').textContent = `${Math.ceil(STATE.hp)} / ${STATE.maxHp}`;
  document.getElementById('prayer-fill').style.width = prayPct + '%';
  document.getElementById('prayer-text').textContent = `${Math.ceil(STATE.prayerPts)} / ${STATE.maxPrayerPts}`;
  document.getElementById('spec-fill').style.width = STATE.specEnergy + '%';
  document.getElementById('spec-text').textContent = `Special ${Math.floor(STATE.specEnergy)}%`;

  document.getElementById('combat-lvl-badge').textContent = `Combat Lv. ${getCombatLevel()}`;
  document.getElementById('gp-amount').textContent = `${STATE.gp.toLocaleString()} GP`;

  const specBtn = document.getElementById('spec-btn');
  if (specBtn) {
    specBtn.classList.toggle('armed', STATE.specArmed);
    specBtn.textContent = STATE.specArmed
      ? `SPECIAL ARMED (${Math.floor(STATE.specEnergy)}%) — Next Hit Spin-Slash!`
      : `SPECIAL ATTACK: ${Math.floor(STATE.specEnergy)}% (Cost 25%)`;
  }

  const wepId = STATE.equipment.weapon;
  const wepName = wepId && ITEMS[wepId] ? ITEMS[wepId].name : 'Unarmed Fists';
  document.getElementById('equipped-weapon-title').textContent = wepName;
  const spObj = SPELLS.find(x => x.id === STATE.activeSpell);
  if (spObj) document.getElementById('active-spell-badge').textContent = spObj.name;

  // 28-Slot Inventory with Custom SVG Artwork
  const invGrid = document.getElementById('inventory-grid');
  document.getElementById('inv-count').textContent = STATE.inventory.length;
  invGrid.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'inv-slot';
    const entry = STATE.inventory[i];
    if (entry && ITEMS[entry.id]) {
      const it = ITEMS[entry.id];
      slotDiv.innerHTML = `<div class="item-svg-wrap">${getItemSvg(it)}</div>`;
      if (isStackableInBackpack(it) || entry.qty > 1) {
        slotDiv.innerHTML += `<span class="qty-badge">${entry.qty}</span>`;
      }
      if (it.tier && TIER_COLORS[it.tier]) {
        slotDiv.innerHTML += `<span class="item-tier-dot" style="background:${TIER_COLORS[it.tier]}"></span>`;
      }
      let statsInfo = '';
      if (it.type === 'equip') {
        const st = [];
        if (it.atk) st.push(`+${it.atk} Atk`);
        if (it.str) st.push(`+${it.str} Str`);
        if (it.def) st.push(`+${it.def} Def`);
        if (it.rng) st.push(`+${it.rng} Rng`);
        if (it.mag) st.push(`+${it.mag} Mag`);
        statsInfo = ` [${st.join(', ')}]`;
      } else if (it.heal) {
        statsInfo = ` (Heals +${it.heal} HP)`;
      }
      const sellVal = Math.max(1, Math.floor((it.price || 10) * 0.65));
      const reqInfo = getItemReqInfo(it);
      slotDiv.title = `${it.name}${statsInfo}\n${reqInfo.plain}\nLeft-Click: Use/Equip | Right-Click: Sell (+${sellVal} GP)`;
      slotDiv.onclick = () => handleInventoryClick(i);
      slotDiv.onmouseenter = (ev) => showItemTooltip(ev, it);
      slotDiv.onmousemove = (ev) => moveItemTooltip(ev);
      slotDiv.onmouseleave = () => hideItemTooltip();
      slotDiv.oncontextmenu = (e) => { e.preventDefault(); sellInventoryItem(i); };
    }
    invGrid.appendChild(slotDiv);
  }

  // Skills Grid
  const skillsGrid = document.getElementById('skills-grid');
  skillsGrid.innerHTML = '';
  let totalLvl = 0;
  let totalXp = 0;
  for (const [key, meta] of Object.entries(SKILLS_META)) {
    const sk = STATE.skills[key];
    totalLvl += sk.lvl;
    totalXp += sk.xp;
    const nextLvlXp = OSRS_XP_TABLE[Math.min(99, sk.lvl + 1)];
    const box = document.createElement('div');
    box.className = 'skill-box';
    box.title = `${meta.name}: ${sk.xp.toLocaleString()} XP (Next level at ${nextLvlXp.toLocaleString()} XP)\n${meta.desc}`;
    box.onclick = () => openXpTableModal(key);
    box.innerHTML = `
      <div class="skill-left">
        <span class="skill-icon-wrap">${getSkillSvg(key)}</span>
        <span class="skill-name">${meta.name}</span>
      </div>
      <span class="skill-lvl">${sk.lvl}</span>
    `;
    skillsGrid.appendChild(box);
  }
  document.getElementById('total-lvl-val').textContent = totalLvl;
  document.getElementById('total-xp-val').textContent = `${totalXp.toLocaleString()} XP`;

  // Full 10-Slot Equipment Paperdoll (3x4 layout)
  const doll = document.getElementById('equip-doll');
  const paperdollLayout = [
    null,                          { key: 'head',   label: 'Head' },   null,
    { key: 'cape',   label: 'Cape' },  { key: 'neck',   label: 'Neck' },   { key: 'ring',   label: 'Ring' },
    { key: 'weapon', label: 'Wep' },   { key: 'body',   label: 'Body' },   { key: 'shield', label: 'Shield' },
    { key: 'hands',  label: 'Hands' }, { key: 'legs',   label: 'Legs' },   { key: 'feet',   label: 'Feet' }
  ];
  doll.innerHTML = '';
  paperdollLayout.forEach(s => {
    const div = document.createElement('div');
    if (!s) {
      div.className = 'equip-slot empty-spacer';
      doll.appendChild(div);
      return;
    }
    div.className = 'equip-slot';
    const eqId = STATE.equipment[s.key];
    if (eqId && ITEMS[eqId]) {
      const it = ITEMS[eqId];
      div.innerHTML = `${getItemSvg(it)}`;
      div.title = `${it.name} (${s.label}) — Click to unequip`;
      div.onclick = () => unequipSlot(s.key);
    } else {
      div.innerHTML = `<span class="slot-placeholder">${s.label}</span>`;
    }
    doll.appendChild(div);
  });

  const bon = getEquipmentBonuses();
  let pairStatusHtml = '';
  if (bon.matchedSet) {
    pairStatusHtml = `<div style="margin-top:3px; color:#4ade80; font-weight:800;">Matched Pair: ${bon.matchedSet} (+10% Set Bonus)</div>`;
  } else {
    const bIt = STATE.equipment.body ? ITEMS[STATE.equipment.body] : null;
    const lIt = STATE.equipment.legs ? ITEMS[STATE.equipment.legs] : null;
    if (bIt && bIt.pairId && ITEMS[bIt.pairId]) {
      pairStatusHtml = `<div style="margin-top:3px; color:#facc15;">Pair with <b>${ITEMS[bIt.pairId].name}</b> for +10% Set Bonus</div>`;
    } else if (lIt && lIt.pairId && ITEMS[lIt.pairId]) {
      pairStatusHtml = `<div style="margin-top:3px; color:#facc15;">Pair with <b>${ITEMS[lIt.pairId].name}</b> for +10% Set Bonus</div>`;
    }
  }
  document.getElementById('equip-stats-box').innerHTML = `
    <div><b>Melee Accuracy:</b> +${bon.atk} &nbsp;|&nbsp; <b>Melee Strength:</b> +${bon.str}</div>
    <div><b>Armor Defence:</b> +${bon.def}</div>
    <div><b>Ranged Bonus:</b> +${bon.rng} &nbsp;|&nbsp; <b>Magic Bonus:</b> +${bon.mag}</div>
    ${pairStatusHtml}
  `;

  // Prayers Grid
  const pGrid = document.getElementById('prayer-grid');
  pGrid.innerHTML = '';
  PRAYERS.forEach(p => {
    const active = STATE.activePrayers.has(p.id);
    const card = document.createElement('div');
    card.className = 'action-card' + (active ? ' active' : '');
    card.title = p.desc;
    card.onclick = () => togglePrayer(p.id);
    card.innerHTML = `
      <span class="ac-icon">${getPrayerSvg(p.id)}</span>
      <span class="ac-title">${p.name}</span>
      <span class="ac-req">Lv ${p.req} Prayer</span>
    `;
    pGrid.appendChild(card);
  });

  // Magic Spells Grid
  const mGrid = document.getElementById('magic-grid');
  mGrid.innerHTML = '';
  SPELLS.forEach(sp => {
    const active = STATE.combatStyle === 'magic' && STATE.activeSpell === sp.id;
    const card = document.createElement('div');
    card.className = 'action-card' + (active ? ' active' : '');
    card.title = sp.desc;
    card.onclick = () => handleSpellClick(sp.id);
    card.innerHTML = `
      <span class="ac-icon">${getSpellSvg(sp)}</span>
      <span class="ac-title">${sp.name}</span>
      <span class="ac-req">Lv ${sp.req} Magic</span>
    `;
    mGrid.appendChild(card);
  });

  saveGameState();
  refreshCombatStyleLocks();
  syncSettingsButtons();
  const shopOpen = document.getElementById('shop-modal');
  const bankOpen = document.getElementById('bank-modal');
  const forgeOpen = document.getElementById('smithing-modal');
  const mapOpen = document.getElementById('worldmap-modal');
  const questOpen = document.getElementById('quest-modal');
  if (shopOpen && shopOpen.classList.contains('open')) renderShopModal();
  if (bankOpen && bankOpen.classList.contains('open')) renderBankModal();
  if (forgeOpen && forgeOpen.classList.contains('open')) renderSmithingModal();
  if (mapOpen && mapOpen.classList.contains('open')) renderWorldMap();
  if (questOpen && questOpen.classList.contains('open')) renderQuests();
}

// ============================================================================
// 6. MODALS: GRAND SHOP (WITH CATEGORY FILTERS), FORGE, XP TABLE, WORLD MAP
// ============================================================================
function closeModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

function openShopModal(filter = 'all') {
  closeModals();
  STATE.shopFilter = filter;
  document.getElementById('shop-modal').classList.add('open');
  renderShopModal();
}

function renderShopModal() {
  renderShopModalUi();
}

function buyShopItem(itemId) {
  const result = buyItem(STATE, itemId, STATE.transferQty || 1);
  if (!result.ok) addChatMessage(result.reason || 'Cannot buy that.', 'combat');
  else {
    SFX.coin();
    addChatMessage('Purchased <b>' + result.moved + ' × ' + ITEMS[itemId].name + '</b> for ' + (result.gp || 0).toLocaleString() + ' GP.', 'loot');
  }
  updateAllUI();
}

function buyShopPair(topId, bottomId) {
  const first = buyItem(STATE, topId, 1);
  if (!first.ok) {
    addChatMessage(first.reason || 'Cannot buy that pair.', 'combat');
    return;
  }
  const second = buyItem(STATE, bottomId, 1);
  if (!second.ok) {
    removeItem(STATE, topId, 1);
    STATE.gp += first.gp || 0;
    addChatMessage(second.reason || 'You need room for both pieces.', 'combat');
    updateAllUI();
    return;
  }
  SFX.coin();
  addChatMessage('Purchased matched pair <b>' + ITEMS[topId].name + '</b> + <b>' + ITEMS[bottomId].name + '</b>.', 'loot');
  updateAllUI();
}

function sellAllLoot() {
  let soldCount = 0;
  let earnedGp = 0;
  const ids = Array.from(new Set(STATE.inventory.map(slot => slot.id)));
  ids.forEach(id => {
    const it = ITEMS[id];
    if (!it || (it.type !== 'resource' && it.type !== 'bones' && it.type !== 'bar')) return;
    const qty = countItem(STATE, id);
    const result = sellItem(STATE, id, 'all');
    if (result.ok) {
      soldCount += qty;
      earnedGp += result.gp || 0;
    }
  });
  if (soldCount > 0) {
    SFX.coin();
    addChatMessage('Sold ' + soldCount + ' gathered goods for <b style="color:#ffe642">' + earnedGp.toLocaleString() + ' GP</b> (65%).', 'loot');
    updateAllUI();
  } else {
    addChatMessage('No raw resources in your backpack to bulk-sell.');
  }
}

function openSmithingModal() {
  closeModals();
  document.getElementById('smithing-modal').classList.add('open');
  renderSmithingModal();
}

function renderSmithingModal() {
  renderForge();
}

function craftRecipe(recipeId) {
  const result = tryCraft(STATE, recipeId);
  if (!result.ok) {
    addChatMessage(result.reason || 'You cannot craft that yet.', 'combat');
    if (document.getElementById('smithing-modal').classList.contains('open')) renderSmithingModal();
    return;
  }
  SFX.mine();
  const made = result.output && ITEMS[result.output] ? ITEMS[result.output].name : 'the item';
  addChatMessage('Crafted <b>' + made + '</b>.', 'skill');
  if (result.skill) grantXp(result.skill, result.xp || 0);
}

function openXpTableModal(skillKey = 'attack') {
  closeModals();
  document.getElementById('xptable-modal').classList.add('open');
  const sk = STATE.skills[skillKey] || STATE.skills.attack;
  const meta = SKILLS_META[skillKey] || SKILLS_META.attack;
  const nextLvl = Math.min(99, sk.lvl + 1);
  const nextXp = OSRS_XP_TABLE[nextLvl];
  const remXp = Math.max(0, nextXp - sk.xp);

  document.getElementById('xptable-skill-summary').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="display:flex; align-items:center; gap:8px;">
        <span style="width:20px;height:20px;display:inline-flex;">${getSkillSvg(skillKey)}</span>
        <b>${meta.name}</b> — Current Level: <b style="color:#ffe642">${sk.lvl} / 99</b>
      </span>
      <span>Current XP: <b>${sk.xp.toLocaleString()}</b> &nbsp;|&nbsp; Next Level (${nextLvl}): <b style="color:#38bdf8">${remXp.toLocaleString()} XP needed</b></span>
    </div>
    <div style="margin-top:4px; color:#b8aa91;">${meta.desc}</div>
  `;

  const grid = document.getElementById('xptable-grid');
  grid.innerHTML = '';
  for (let lvl = 1; lvl <= 99; lvl++) {
    const cell = document.createElement('div');
    cell.className = 'xp-cell' + (sk.lvl >= lvl ? ' reached' : '');
    cell.innerHTML = `<span class="lvl-num">Lv ${lvl}</span><span class="xp-num">${OSRS_XP_TABLE[lvl].toLocaleString()}</span>`;
    grid.appendChild(cell);
  }
}

function openWorldMapModal() {
  closeModals();
  const modal = document.getElementById('worldmap-modal');
  if (modal) modal.classList.add('open');
  renderWorldMap();
}

function saveGameState() {
  try {
    const pose = (player && player.pos) ? {
      x: Number(player.pos.x.toFixed(2)),
      y: Number(player.pos.y.toFixed(2)),
      z: Number(player.pos.z.toFixed(2)),
      yaw: Number((player.yaw || 0).toFixed(3))
    } : null;
    const cam = camState ? {
      yaw: Number((camState.yaw || 0).toFixed(3)),
      manualOffset: Number((camState.manualOffset || 0).toFixed(3)),
      pitch: Number((camState.pitch || 0.24).toFixed(3)),
      distance: Number((camState.distance || 11).toFixed(2))
    } : null;
    writeSave(localStorage, STATE, pose, cam);
    const saveBtn = document.getElementById('save-status-btn');
    if (saveBtn) {
      const t = new Date();
      const hh = String(t.getHours()).padStart(2, '0');
      const mm = String(t.getMinutes()).padStart(2, '0');
      const ss = String(t.getSeconds()).padStart(2, '0');
      saveBtn.textContent = 'Saved (' + hh + ':' + mm + ':' + ss + ')';
    }
  } catch (e) {}
}

function loadGameState() {
  try {
    const migrated = readSave(localStorage);
    if (!migrated) return false;
    applyState(STATE, migrated.state);
    if (migrated.pose && player && player.pos) {
      player.pos.x = migrated.pose.x;
      player.pos.z = migrated.pose.z;
      if (typeof migrated.pose.yaw === 'number') player.yaw = migrated.pose.yaw;
    }
    if (migrated.cam && camState) {
      camState.yaw = migrated.cam.yaw;
      camState.manualOffset = migrated.cam.manualOffset;
      camState.pitch = migrated.cam.pitch;
      camState.distance = migrated.cam.distance;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function manualSaveToast() {
  saveGameState();
  SFX.coin();
  addChatMessage('Progress & state saved to <b>localStorage</b> (Skills, XP, GP, Inventory, 10-Slot Equipment, Vitals, Prayers & World Coordinates).', 'lvlup');
}

function resetGameSave() {
  if (!confirm('Reset your saved character progress in localStorage and start fresh?')) return;
  try {
    localStorage.removeItem(SAVE_KEY);
    LEGACY_SAVE_KEYS.forEach(key => localStorage.removeItem(key));
  } catch (e) {}
  window.location.reload();
}


// ============================================================================
// 7. 2026 SMOOTH 3D ENGINE, GLSL SKY & WATER SHADERS, PROCEDURAL TEXTURES
// ============================================================================
let scene, camera, renderer, sunLight, ambientLight, hemiLight;
let terrainMesh, waterMesh, skyDomeMesh, grassInstanced;
let waterUniforms, skyUniforms;
const worldInteractiveObjects = [];
const monstersList = [];
const resourceNodesList = [];
const npcList = [];
const projectilesList = [];
const particlesList = [];
const swayingFoliage = [];

const player = {
  pos: new THREE.Vector3(-4, 0, -3),
  vel: new THREE.Vector3(0, 0, 0),
  yaw: 0.48,
  targetPos: null,
  targetEntity: null,
  isMoving: false,
  isGrounded: true,
  jumpVel: 0,
  animTime: 0,
  attackAnim: 0,
  spinAnim: 0,
  actionCooldown: 0,
  meshGroup: null,
  parts: {}
};

const camState = {
  yaw: 0.48,
  manualOffset: 0,
  pitch: 0.24,
  distance: 11.0,
  currentLookAt: new THREE.Vector3(-4, 2, -3),
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0
};

// Procedural Texture Generators for Rich Surface Detail
function createProceduralGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 225 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgb(${v},${v + 3},${v - 4})`;
    ctx.fillRect(x, y, 2, 6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 36);
  return tex;
}

function createStoneMasonryTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    const offset = (row % 2) * 32;
    for (let col = 0; col < 5; col++) {
      const x = (col * 64 + offset) % 256;
      ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.08).toFixed(2)})`;
      ctx.fillRect(x + 2, y + 2, 60, 28);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 32); ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

let STONE_TEX = null;
let GROUND_TEX = null;

function getTerrainHeight(x, z) {
  for (const reg of WORLD_REGIONS) {
    const dx = x - reg.x;
    const dz = z - reg.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 16) return 0;
    if (d < 28) {
      const t = (d - 16) / 12;
      const smoothT = t * t * (3 - 2 * t);
      return rawHills(x, z) * smoothT;
    }
  }
  const riverCenter = 28 + Math.sin(z * 0.05) * 8;
  const riverDist = Math.abs(x - riverCenter);
  if (riverDist < 6.8) {
    return -1.45 * Math.cos((riverDist / 6.8) * (Math.PI / 2));
  }
  return rawHills(x, z);
}

function rawHills(x, z) {
  const h1 = Math.sin(x * 0.032) * Math.cos(z * 0.032) * 1.85;
  const h2 = Math.sin(x * 0.085 + z * 0.065) * 0.55;
  let crag = 0;
  if (x < -35 && z > 30) {
    crag = Math.min(6.4, ((-35 - x) + (z - 30)) * 0.06) * (0.6 + 0.4 * Math.sin(x * 0.13) * Math.cos(z * 0.13));
  }
  return Math.max(0.08, (h1 + h2) * 0.55 + 0.85 + crag);
}

function getBiomeColor(x, z, h) {
  const sage = new THREE.Color(PALETTE.sage);
  const lit = new THREE.Color(PALETTE.sageLit);
  const dirt = new THREE.Color(PALETTE.dirt);
  if (h < -0.05) return dirt.clone();
  if (z > -22 && z < 8 && x > -8 && x < 82 && Math.abs(z - (-x * 0.22)) < 2.6) return dirt.clone();
  if (x > 28 && z > 25) {
    const blend = Math.min(1, ((x - 28) + (z - 25)) / 38);
    return sage.clone().lerp(new THREE.Color(0xd9b36c), blend);
  }
  if (x < -28 && z > 25) {
    const blend = Math.min(1, ((-28 - x) + (z - 25)) / 36);
    const lavaTint = h > 3.1 ? new THREE.Color(0x882915) : new THREE.Color(0x3b3634);
    return sage.clone().lerp(lavaTint, blend);
  }
  if (x < -28 && z < 10) {
    const blend = Math.min(1, (-28 - x) / 28);
    return sage.clone().lerp(new THREE.Color(0x4d6b45), blend);
  }
  if (Math.hypot(x - 78, z + 20) < 18) return dirt.clone().multiplyScalar(0.92);
  const n = 0.5 + 0.5 * Math.sin(x * 0.11) * Math.cos(z * 0.11);
  return sage.clone().lerp(lit, 0.35 + n * 0.55);
}

function init3DEngine() {
  const container = document.getElementById('game-canvas-container');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xc5d0bc, 0.0034);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 360);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  container.appendChild(renderer.domElement);

  STONE_TEX = createStoneMasonryTexture();
  GROUND_TEX = createProceduralGroundTexture();

  hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x4a5c3a, 0.56);
  scene.add(hemiLight);

  ambientLight = new THREE.AmbientLight(0xffedd5, 0.22);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xfff4d2, 1.05);
  sunLight.position.set(45, 68, 35);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 170;
  const d = 54;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(sunLight.target);

  buildSkyDomeShader();
  buildTerrainAndWater();
  buildAllCitiesAndLandmarks();
  buildPlayerCharacter();
  spawnAllResourcesAndMonsters();
  buildAtmosphericParticles();

  window.addEventListener('resize', onWindowResize);
  setupInputHandlers();
}

// Custom GLSL Atmospheric Sky Dome with Volumetric Clouds & Sun Disc
function buildSkyDomeShader() {
  skyUniforms = {
    uTime: { value: 0 },
    uTopColor: { value: new THREE.Color(0x2563eb) },
    uHorizonColor: { value: new THREE.Color(0xfde68a) },
    uSunDir: { value: new THREE.Vector3(0.45, 0.55, -0.65).normalize() }
  };

  const skyGeo = new THREE.SphereGeometry(290, 48, 32);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      varying vec3 vWorldPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          v += amp * noise(p);
          p *= 2.02;
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.55));

        // Glowing Sun Disc & Corona
        float sunAmt = max(dot(dir, uSunDir), 0.0);
        col += vec3(1.0, 0.85, 0.55) * pow(sunAmt, 18.0) * 0.45;
        col += vec3(1.0, 0.98, 0.9) * smoothstep(0.996, 0.999, sunAmt);

        // Soft Drifting BotW Clouds
        if (dir.y > 0.04) {
          vec2 uv = dir.xz / (dir.y + 0.18) * 1.6 + vec2(uTime * 0.015, uTime * 0.008);
          float cl = fbm(uv);
          float cloudMask = smoothstep(0.48, 0.76, cl) * smoothstep(0.04, 0.22, dir.y);
          vec3 cloudCol = mix(uHorizonColor, vec3(1.0, 0.99, 0.96), 0.75);
          col = mix(col, cloudCol, cloudMask * 0.65);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDomeMesh);
}

function cycleTimeOfDay() {
  STATE.timeOfDay = (STATE.timeOfDay + 1) % 3;
  const btn = document.getElementById('time-of-day-btn');
  if (STATE.timeOfDay === 0) {
    skyUniforms.uTopColor.value.setHex(0x2563eb);
    skyUniforms.uHorizonColor.value.setHex(0xfde68a);
    scene.fog.color.setHex(0xc5d0bc);
    sunLight.color.setHex(0xffe082);
    sunLight.intensity = 1.25;
    hemiLight.intensity = 0.72;
    if (btn) btn.textContent = 'Golden Hour';
  } else if (STATE.timeOfDay === 1) {
    skyUniforms.uTopColor.value.setHex(0x1d4ed8);
    skyUniforms.uHorizonColor.value.setHex(0xbae6fd);
    scene.fog.color.setHex(0xc9d4c2);
    sunLight.color.setHex(0xffffff);
    sunLight.intensity = 1.32;
    hemiLight.intensity = 0.8;
    if (btn) btn.textContent = 'High Noon';
  } else {
    skyUniforms.uTopColor.value.setHex(0x090d16);
    skyUniforms.uHorizonColor.value.setHex(0x1e293b);
    scene.fog.color.setHex(0x0f172a);
    sunLight.color.setHex(0x93c5fd);
    sunLight.intensity = 0.58;
    hemiLight.intensity = 0.38;
    if (btn) btn.textContent = 'Starry Night';
  }
}

function buildTerrainAndWater() {
  const size = 260;
  const segs = 190;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getTerrainHeight(vx, vz);
    posAttr.setY(i, vy);
    const col = getBiomeColor(vx, vz, vy);
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = facetMaterial({
    vertexColors: true,
    map: GROUND_TEX,
    roughness: 0.85,
    metalness: 0.03
  });
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  terrainMesh.userData = { type: 'ground' };
  scene.add(terrainMesh);
  worldInteractiveObjects.push(terrainMesh);

  // Custom GLSL Animated Water Shader with Specular Sun Glint & Ripples
  waterUniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(0x0284c7) },
    uShallowColor: { value: new THREE.Color(0x38bdf8) }
  };

  const waterGeo = new THREE.PlaneGeometry(size, size, 96, 96);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.45 + uTime * 2.2) * cos(p.z * 0.35 + uTime * 1.8) * 0.06;
        p.y += w;
        vWave = w;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        float shimmer = sin(vWorldPos.x * 1.4 + uTime * 3.0) * cos(vWorldPos.z * 1.4 - uTime * 2.5);
        vec3 col = mix(uDeepColor, uShallowColor, 0.5 + vWave * 4.5);
        if (shimmer > 0.72) {
          col = mix(col, vec3(0.92, 0.98, 1.0), (shimmer - 0.72) * 2.5);
        }
        gl_FragColor = vec4(col, 0.82);
      }
    `
  });
  waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = -0.34;
  scene.add(waterMesh);

  // Arched Wooden & Stone Footbridge over the River at (28, 0)
  buildRiverBridge(28, 0);

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.045, 0);
  bladeShape.lineTo(0, 0.92);
  bladeShape.lineTo(0.045, 0);
  bladeShape.closePath();
  const bladeGeo = new THREE.ShapeGeometry(bladeShape, 1);
  const bladeMat = grassMaterial();
  const grassCount = 1600;
  grassInstanced = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let i = 0; i < grassCount * 3 && idx < grassCount; i++) {
    const gx = (Math.random() - 0.5) * 215;
    const gz = (Math.random() - 0.5) * 215;
    const gy = getTerrainHeight(gx, gz);
    if (gy < 0.08 || isDeepWater(gx, gz) || (gx < -30 && gz > 25) || (gx > 32 && gz > 28)) continue;
    dummy.position.set(gx, gy, gz);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    const s = 0.7 + Math.random() * 0.85;
    dummy.scale.set(s, s * (0.85 + Math.random() * 0.4), s);
    dummy.updateMatrix();
    grassInstanced.setMatrixAt(idx++, dummy.matrix);
  }
  grassInstanced.instanceMatrix.needsUpdate = true;
  scene.add(grassInstanced);
}

function buildRiverBridge(bx, bz) {
  const grp = new THREE.Group();
  grp.position.set(bx, 0, bz);
  const woodMat = facetMaterial({ color: 0x78350f, roughness: 0.75 });
  const stoneMat = facetMaterial({ map: STONE_TEX, color: 0xcbd5e1, roughness: 0.8 });

  for (let i = -7; i <= 7; i++) {
    const t = i / 7;
    const archY = Math.cos(t * Math.PI * 0.5) * 1.15 - 0.1;
    const plank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.8, 6), woodMat);
    plank.rotation.x = Math.PI / 2;
    plank.position.set(i * 1.0, archY, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    grp.add(plank);
  }
  [-1.8, 1.8].forEach(oz => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.2, 0.8, oz),
      new THREE.Vector3(0, 2.05, oz),
      new THREE.Vector3(7.2, 0.8, oz)
    ]);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.1, 5, false), stoneMat);
    rail.castShadow = true;
    grp.add(rail);
  });
  scene.add(grp);
}

// Smooth Sculpted Landmarks: Shrines, Castles, Altars, Forges & NPCs
function buildAllCitiesAndLandmarks() {
  // 1. Sculpted Sheikah-Rune Teleport Shrines
  WORLD_REGIONS.forEach(reg => {
    const sx = reg.x;
    const sz = reg.z - 6;
    const sy = getTerrainHeight(sx, sz);
    const shrineGroup = new THREE.Group();
    shrineGroup.position.set(sx, sy, sz);

    // Smooth Terraced Lathe Pedestal Base (floating orb sits visibly above)
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(2.4, 0),
      new THREE.Vector2(2.15, 0.35),
      new THREE.Vector2(1.55, 0.55),
      new THREE.Vector2(1.25, 0.95),
      new THREE.Vector2(0.85, 1.15),
      new THREE.Vector2(0, 1.15)
    ];
    const pedGeo = new THREE.LatheGeometry(pts, 7);
    const pedMat = facetMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.35
    });
    const ped = new THREE.Mesh(pedGeo, pedMat);
    ped.castShadow = true;
    ped.receiveShadow = true;
    shrineGroup.add(ped);

    // Glowing Inner Energy Core Sphere (floating above pedestal)
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 7, 6),
      facetMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.95,
        roughness: 0.12
      })
    );
    core.position.y = 2.45;
    shrineGroup.add(core);

    // Two Interlocking Smooth Gyroscopic Rings
    const rMat = facetMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2
    });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.06, 5, 8), rMat);
    ring1.position.y = 2.45;
    ring1.rotation.x = Math.PI / 2.3;
    shrineGroup.add(ring1);
    swayingFoliage.push({ mesh: ring1, speed: 1.4, rotY: true });

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.045, 5, 8), rMat);
    ring2.position.y = 2.45;
    ring2.rotation.x = -Math.PI / 3;
    shrineGroup.add(ring2);
    swayingFoliage.push({ mesh: ring2, speed: -1.1, rotY: true });

    const uData = {
      type: 'interactive',
      action: 'worldmap',
      name: `${reg.name} Shrine (Teleport)`,
      interactRadius: 4.2
    };
    shrineGroup.userData = uData;
    ped.userData = uData;
    core.userData = uData;
    worldInteractiveObjects.push(ped, core);
    scene.add(shrineGroup);
  });

  // 2. Sculpted Lumbridge Castle Keep & Cylindrical Battlement Towers
  createCastleStructure(0, -25);

  // 3. Sculpted Marble Altars
  createPrayerAltar(-10, -4, 'Sacred Altar of Lumbridge');
  createPrayerAltar(72, -26, 'Varrock Cathedral Altar');

  // 4. Sculpted Blacksmith Anvil, Domed Furnace & Cooking Range
  createForgeStation(10, -4, 'Lumbridge Forge & Range');
  createForgeStation(86, -16, 'Varrock Royal Blacksmith');

  // 5. Grand Emporium Merchants
  createMerchantNPC(-7, 5, 'Shopkeeper Bob (Grand Emporium)', 0x1d4ed8);
  createMerchantNPC(78, -12, 'Varrock Trade Master', 0xd97706);
  createMerchantNPC(64, 62, 'Al-Kharid Bazaar Merchant', 0xb91c1c);
  createBankBooth(2.2, 4.2);
}

function createCastleStructure(cx, cz) {
  const grp = new THREE.Group();
  const y = getTerrainHeight(cx, cz);
  grp.position.set(cx, y, cz);
  const stoneMat = facetMaterial({ map: STONE_TEX, color: 0xe2e8f0 });
  const roofMat = facetMaterial({ color: 0x1e3a8a });
  const goldMat = facetMaterial({ color: 0xfacc15 });
  const timberMat = facetMaterial({ color: 0xc8b48a });
  function box(w, h, d, mat, x, yy, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, yy, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);
    return mesh;
  }
  function crenelate(x0, z0, x1, z1, yTop) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.floor(len / 1.15));
    for (let i = 0; i < n; i++) {
      if (i % 2 === 1) continue;
      const t = n === 1 ? 0.5 : i / (n - 1);
      box(0.7, 0.55, 0.7, stoneMat, x0 + (x1 - x0) * t, yTop, z0 + (z1 - z0) * t);
    }
  }
  box(7.6, 8.2, 6.2, stoneMat, 0, 4.1, -3.5);
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 3.2, 4), roofMat);
  keepRoof.position.set(0, 9.6, -3.5);
  keepRoof.rotation.y = Math.PI / 4;
  keepRoof.castShadow = true;
  grp.add(keepRoof);
  box(19.2, 5.2, 1.4, stoneMat, 0, 2.6, -9);
  crenelate(-9, -9, 9, -9, 5.4);
  box(7.4, 5.2, 1.4, stoneMat, -5.4, 2.6, 8);
  box(7.4, 5.2, 1.4, stoneMat, 5.4, 2.6, 8);
  crenelate(-9.1, 8, -1.7, 8, 5.4);
  crenelate(1.7, 8, 9.1, 8, 5.4);
  box(1.4, 5.2, 17, stoneMat, -9, 2.6, -0.5);
  box(1.4, 5.2, 17, stoneMat, 9, 2.6, -0.5);
  crenelate(-9, -9, -9, 8, 5.4);
  crenelate(9, -9, 9, 8, 5.4);
  [[-9, -9], [9, -9], [-9, 8], [9, 8]].forEach(([tx, tz]) => {
    box(3.2, 8.4, 3.2, stoneMat, tx, 4.2, tz);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.4, 4), roofMat);
    spire.position.set(tx, 10.0, tz);
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    grp.add(spire);
    const finial = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.35), goldMat);
    finial.position.set(tx, 12.0, tz);
    grp.add(finial);
  });
  box(3.2, 0.45, 1.5, timberMat, 0, 4.6, 8);
  scene.add(grp);
}

function createPrayerAltar(x, z, name) {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);

  // Sculpted Marble Chalice Altar (LatheGeometry)
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(1.9, 0),
    new THREE.Vector2(1.6, 0.35),
    new THREE.Vector2(0.85, 0.9),
    new THREE.Vector2(1.75, 1.45),
    new THREE.Vector2(1.85, 1.75),
    new THREE.Vector2(0, 1.75)
  ];
  const marbleMat = facetMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.1 });
  const base = new THREE.Mesh(new THREE.LatheGeometry(pts, 7), marbleMat);
  base.castShadow = true;
  base.receiveShadow = true;
  grp.add(base);

  const goldRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.78, 0.08, 5, 8),
    facetMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
  );
  goldRing.rotation.x = Math.PI / 2;
  goldRing.position.y = 1.65;
  grp.add(goldRing);

  // Smooth Floating Sacred Crystal
  const crystal = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.58, 0),
    facetMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.1,
      metalness: 0.4
    })
  );
  crystal.scale.set(0.85, 1.45, 0.85);
  crystal.position.y = 2.65;
  grp.add(crystal);
  swayingFoliage.push({ mesh: crystal, speed: 2.0, rotY: true });

  const uData = { type: 'interactive', action: 'altar', name, interactRadius: 4.0 };
  grp.userData = uData;
  base.userData = uData;
  crystal.userData = uData;
  worldInteractiveObjects.push(base, crystal);
  scene.add(grp);
  npcList.push({ pos: grp.position, name, color: '#38bdf8', yOffset: 3.4 });
}

function createForgeStation(x, z, name) {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);

  // Sculpted Blacksmith Horn Anvil (Lathe + Extruded Bevel Top)
  const ironMat = facetMaterial({ color: 0x334155, metalness: 0.78, roughness: 0.28 });
  const anvilBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.82, 0.75, 6), ironMat);
  anvilBase.position.set(-1.2, 0.38, 0);
  anvilBase.castShadow = true;
  grp.add(anvilBase);

  const anvilTop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.5, 6), ironMat);
  anvilTop.rotation.z = Math.PI / 2;
  anvilTop.position.set(-1.2, 0.88, 0);
  anvilTop.castShadow = true;
  grp.add(anvilTop);

  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 5), ironMat);
  horn.rotation.z = Math.PI / 2;
  horn.position.set(-2.25, 0.88, 0);
  horn.castShadow = true;
  grp.add(horn);

  // Domed Stone Smelting Furnace with Glowing Crucible
  const furnacePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(1.65, 0),
    new THREE.Vector2(1.55, 1.5),
    new THREE.Vector2(1.05, 2.7),
    new THREE.Vector2(0.55, 3.3),
    new THREE.Vector2(0, 3.3)
  ];
  const furnace = new THREE.Mesh(
    new THREE.LatheGeometry(furnacePts, 7),
    facetMaterial({ map: STONE_TEX, color: 0x78350f, roughness: 0.82 })
  );
  furnace.position.set(1.3, 0, 0);
  furnace.castShadow = true;
  grp.add(furnace);

  const fireCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 7, 6),
    facetMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.95 })
  );
  fireCore.position.set(1.3, 0.85, 1.0);
  grp.add(fireCore);

  const uData = { type: 'interactive', action: 'forge', name, interactRadius: 4.2 };
  grp.userData = uData;
  anvilTop.userData = uData;
  furnace.userData = uData;
  worldInteractiveObjects.push(anvilTop, furnace);
  scene.add(grp);
  npcList.push({ pos: grp.position, name, color: '#ff981f', yOffset: 3.5 });
}

function createBankBooth(x, z) {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const wood = facetMaterial({ color: 0x6b4423 });
  const gold = facetMaterial({ color: 0xfacc15 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.05, 0.7), wood);
  counter.position.set(0, 0.55, 0.4);
  counter.castShadow = true;
  grp.add(counter);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.16, 1.05), gold);
  lintel.position.set(0, 1.95, 0.35);
  grp.add(lintel);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx2d = canvas.getContext('2d');
  ctx2d.fillStyle = '#1d1812';
  ctx2d.fillRect(0, 0, 256, 64);
  ctx2d.fillStyle = '#fde047';
  ctx2d.font = '700 36px sans-serif';
  ctx2d.textAlign = 'center';
  ctx2d.fillText('BANK', 128, 44);
  const tex = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, 1.55, 0.82);
  grp.add(sign);
  const rig = buildHumanoidRig(0x1e3a8a, 0xfacc15, 0x334155, 1);
  rig.group.position.set(0, 0, -0.2);
  grp.add(rig.group);
  const uData = { type: 'interactive', action: 'bank', name: 'Lumbridge Bank', interactRadius: 4.2 };
  grp.userData = uData;
  rig.hitbox.userData = uData;
  counter.userData = uData;
  worldInteractiveObjects.push(rig.hitbox, counter);
  scene.add(grp);
  npcList.push({ pos: grp.position, name: 'Lumbridge Bank', color: '#fde047', yOffset: 2.6 });
}

function createMerchantNPC(x, z, name, tunicColor) {
  const y = getTerrainHeight(x, z);
  const rig = buildHumanoidRig(tunicColor, 0xfacc15, 0x334155, 1.02);
  rig.group.position.set(x, y, z);
  const uData = { type: 'interactive', action: 'shop', name, interactRadius: 4.0 };
  rig.group.userData = uData;
  rig.hitbox.userData = uData;
  worldInteractiveObjects.push(rig.hitbox);
  scene.add(rig.group);
  npcList.push({ pos: rig.group.position, name, color: '#ffe642', yOffset: 2.85 });
}


// ============================================================================
// 8. SMOOTH SCULPTED 3D CHARACTER, 10-SLOT GEAR, MONSTERS & ORGANIC TREES
// ============================================================================
function buildHumanoidRig(tunicHex = 0x0284c7, hairHex = 0xfacc15, legsHex = 0xa1887f, scale = 1.0) {
  const group = new THREE.Group();
  group.scale.set(scale, scale, scale);

  const skinMat   = facetMaterial({ color: 0xf6cbb0, roughness: 0.58 });
  const tunicMat  = facetMaterial({ color: tunicHex, roughness: 0.52, metalness: 0.08 });
  const legsMat   = facetMaterial({ color: legsHex, roughness: 0.55, metalness: 0.12 });
  const hairMat   = facetMaterial({ color: hairHex, roughness: 0.45, metalness: 0.05 });
  const bootMat   = facetMaterial({ color: 0x5c3a21, roughness: 0.65, metalness: 0.1 });
  const gloveMat  = facetMaterial({ color: 0x78350f, roughness: 0.6, metalness: 0.1 });
  const leatherMat= facetMaterial({ color: 0x451a03, roughness: 0.7 });
  const goldMat   = facetMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.25 });

  // 1. Smooth Anatomical Torso & Flared Tunic Skirt (LatheGeometry, 32 segments)
  const torsoPts = [
    new THREE.Vector2(0.0, 0.72),
    new THREE.Vector2(0.48, 0.72), // Flared tunic hem
    new THREE.Vector2(0.36, 0.92),
    new THREE.Vector2(0.22, 1.08), // Contoured waist
    new THREE.Vector2(0.38, 1.38), // Chest
    new THREE.Vector2(0.56, 1.62), // Broad shoulders
    new THREE.Vector2(0.22, 1.72), // Collar base
    new THREE.Vector2(0.0, 1.72)
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 7);
  torsoGeo.scale(1.05, 1.0, 0.72);
  const torso = new THREE.Mesh(torsoGeo, tunicMat);
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // Smooth Rounded Waist Belt & Golden Buckle + Cross-body Baldric
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.055, 5, 8), leatherMat);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.06, 0.73, 1.0);
  belt.position.y = 1.08;
  group.add(belt);

  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.038, 5, 8), leatherMat);
  strap.scale.set(0.92, 1.18, 0.68);
  strap.rotation.z = 0.62;
  strap.position.y = 1.36;
  group.add(strap);

  // Neck Cylinder
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.22, 6), skinMat);
  neck.position.y = 1.76;
  group.add(neck);

  // 2. Smooth Sculpted Head & Flowing Layered Hair Locks
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.02, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 7, 6), skinMat);
  head.scale.set(0.96, 1.08, 0.98);
  head.castShadow = true;
  headGroup.add(head);

  // Expressive Eyes (for front/orbit view)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e3a8a });
  [-0.09, 0.09].forEach(ox => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 7, 6), eyeMat);
    eye.position.set(ox, 0.03, -0.245);
    headGroup.add(eye);
  });

  // Sculpted Hylian Ears (smooth tapered ellipsoids)
  [-0.26, 0.26].forEach((ox, idx) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), skinMat);
    ear.scale.set(0.65, 2.2, 0.75);
    ear.position.set(ox, 0.02, 0.02);
    ear.rotation.z = idx === 0 ? 1.05 : -1.05;
    ear.rotation.x = -0.22;
    headGroup.add(ear);
  });

  // Smooth Hair Crown Dome + 11 Sculpted Curved Hair Locks (Back, Sides & Bangs)
  const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.288, 7, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), hairMat);
  hairCrown.position.set(0, 0.04, 0.01);
  hairCrown.castShadow = true;
  headGroup.add(hairCrown);

  // Back & Side Sculpted Hair Locks (Smooth Ellipsoids with zero flat edges)
  for (let i = -4; i <= 4; i++) {
    const ang = (i / 4) * 1.15; // Spread across back and sides
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.082, 7, 6), hairMat);
    lock.scale.set(0.92, 2.25, 0.68);
    lock.position.set(Math.sin(ang) * 0.22, -0.05, Math.cos(ang) * 0.22);
    lock.rotation.x = 0.28;
    lock.rotation.z = -ang * 0.35;
    lock.castShadow = true;
    headGroup.add(lock);
  }
  // Front Side-Swept Bangs
  [-0.14, 0.14].forEach((ox, idx) => {
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.072, 7, 6), hairMat);
    bang.scale.set(0.88, 1.95, 0.65);
    bang.position.set(ox, 0.05, -0.21);
    bang.rotation.x = -0.25;
    bang.rotation.z = idx === 0 ? -0.35 : 0.35;
    headGroup.add(bang);
  });

  group.add(headGroup);

  // 3. Smooth Tapered Arms, Shoulder Deltoids & Gauntlet Hands
  function createSmoothArm(isLeft) {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -0.44 : 0.44, 1.58, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.145, 7, 6), tunicMat);
    shoulder.castShadow = true;
    pivot.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.095, 0.42, 6), tunicMat);
    upperArm.position.y = -0.21;
    upperArm.castShadow = true;
    pivot.add(upperArm);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.082, 0.34, 6), gloveMat);
    forearm.position.y = -0.52;
    forearm.castShadow = true;
    pivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 7, 6), gloveMat);
    hand.position.y = -0.71;
    hand.castShadow = true;
    pivot.add(hand);

    return pivot;
  }

  const leftArmPivot = createSmoothArm(true);
  const rightArmPivot = createSmoothArm(false);
  group.add(leftArmPivot, rightArmPivot);

  // 4. Smooth Tapered Legs (Trousers / Platelegs) & Sculpted Rounded Boots
  function createSmoothLeg(isLeft) {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -0.19 : 0.19, 0.78, 0);

    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.145, 7, 6), legsMat);
    pivot.add(hip);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.115, 0.40, 6), legsMat);
    thigh.position.y = -0.20;
    thigh.castShadow = true;
    pivot.add(thigh);

    // Sculpted Knee Guard
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 6), legsMat);
    knee.position.set(0, -0.40, -0.02);
    pivot.add(knee);

    // Boot / Greave Calf & Rounded Foot
    const calfBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.105, 0.34, 6), bootMat);
    calfBoot.position.y = -0.57;
    calfBoot.castShadow = true;
    pivot.add(calfBoot);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.125, 7, 6), bootMat);
    foot.scale.set(0.95, 0.65, 1.45);
    foot.position.set(0, -0.73, -0.05);
    foot.castShadow = true;
    pivot.add(foot);

    return pivot;
  }

  const leftLegPivot = createSmoothLeg(true);
  const rightLegPivot = createSmoothLeg(false);
  group.add(leftLegPivot, rightLegPivot);

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.88, 2.5, 6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 1.25;
  group.add(hitbox);

  return {
    group,
    torso,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    tunicMat,
    legsMat,
    bootMat,
    gloveMat,
    hitbox
  };
}

function buildPlayerCharacter() {
  const rig = buildHumanoidRig(0x0284c7, 0xfacc15, 0xa1887f, 1.06);
  player.meshGroup = rig.group;
  player.parts = rig;

  const ringGeo = new THREE.RingGeometry(1.15, 2.45, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38e8ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0
  });
  const spinRing = new THREE.Mesh(ringGeo, ringMat);
  spinRing.position.y = 1.1;
  player.meshGroup.add(spinRing);
  player.parts.spinRing = spinRing;

  player.pos.y = getTerrainHeight(player.pos.x, player.pos.z);
  player.meshGroup.position.copy(player.pos);
  player.meshGroup.rotation.y = player.yaw + Math.PI;
  scene.add(player.meshGroup);

  rebuildPlayerEquipmentMeshes();
}

function rebuildPlayerEquipmentMeshes() {
  if (!player.parts || !player.parts.rightArmPivot) return;
  const rArm = player.parts.rightArmPivot;
  const lArm = player.parts.leftArmPivot;
  const headG = player.parts.headGroup;
  const torso = player.parts.torso;

  ['wepMesh', 'shieldMesh', 'helmMesh', 'capeMesh', 'amuletMesh'].forEach(k => {
    if (player.parts[k] && player.parts[k].parent) {
      player.parts[k].parent.remove(player.parts[k]);
      player.parts[k] = null;
    }
  });

  // 1. Body Armor Material
  const bodyId = STATE.equipment.body;
  if (bodyId && ITEMS[bodyId]) {
    player.parts.tunicMat.color.setHex(ITEMS[bodyId].color || 0x0284c7);
    player.parts.tunicMat.metalness = bodyId === 'champion_tunic' ? 0.1 : 0.65;
    player.parts.tunicMat.roughness = bodyId === 'champion_tunic' ? 0.5 : 0.28;
  } else {
    player.parts.tunicMat.color.setHex(0x0284c7);
    player.parts.tunicMat.metalness = 0.08;
    player.parts.tunicMat.roughness = 0.52;
  }

  // 2. Leg Armor Material (Platelegs / Tassets / Trousers)
  const legsId = STATE.equipment.legs;
  if (legsId && ITEMS[legsId]) {
    player.parts.legsMat.color.setHex(ITEMS[legsId].color || 0xa1887f);
    player.parts.legsMat.metalness = legsId === 'hylian_trousers' ? 0.05 : 0.65;
    player.parts.legsMat.roughness = legsId === 'hylian_trousers' ? 0.65 : 0.28;
  } else {
    player.parts.legsMat.color.setHex(0xa1887f);
    player.parts.legsMat.metalness = 0.05;
  }

  // 3. Boots Material (Feet)
  const feetId = STATE.equipment.feet;
  if (feetId && ITEMS[feetId]) {
    player.parts.bootMat.color.setHex(ITEMS[feetId].color || 0x5c3a21);
    player.parts.bootMat.metalness = feetId === 'leather_boots' ? 0.1 : 0.65;
  } else {
    player.parts.bootMat.color.setHex(0x5c3a21);
    player.parts.bootMat.metalness = 0.1;
  }

  // 4. Gauntlets Material (Hands)
  const handsId = STATE.equipment.hands;
  if (handsId && ITEMS[handsId]) {
    player.parts.gloveMat.color.setHex(ITEMS[handsId].color || 0x78350f);
    player.parts.gloveMat.metalness = handsId === 'leather_gloves' ? 0.1 : 0.6;
  } else {
    player.parts.gloveMat.color.setHex(0x78350f);
    player.parts.gloveMat.metalness = 0.1;
  }

  // 5. Sculpted 3D Weapon in Right Hand
  const wepId = STATE.equipment.weapon;
  if (wepId && ITEMS[wepId]) {
    const it = ITEMS[wepId];
    const wepGrp = new THREE.Group();
    wepGrp.position.set(0, -0.70, -0.12);

    if (it.style === 'ranged') {
      // Smooth Recurve Bow with String & Arrow
      const bowCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.62, 0.18),
        new THREE.Vector3(0, -0.32, -0.18),
        new THREE.Vector3(0, 0, -0.26),
        new THREE.Vector3(0, 0.32, -0.18),
        new THREE.Vector3(0, 0.62, 0.18)
      ]);
      const bowGeo = new THREE.TubeGeometry(bowCurve, 6, 0.042, 5, false);
      const bowMat = facetMaterial({
        color: it.color || 0x92400e,
        metalness: it.id === 'ancient_bow' ? 0.7 : 0.2,
        roughness: 0.35,
        emissive: it.id === 'ancient_bow' ? 0x0284c7 : 0x000000,
        emissiveIntensity: it.id === 'ancient_bow' ? 0.5 : 0
      });
      const bowMesh = new THREE.Mesh(bowGeo, bowMat);
      bowMesh.castShadow = true;
      wepGrp.add(bowMesh);

      const strGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.22, 8);
      const strMesh = new THREE.Mesh(strGeo, new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }));
      strMesh.position.set(0, 0, 0.16);
      wepGrp.add(strMesh);
    } else if (it.style === 'magic') {
      // Sculpted Staff with Orbiting Ring & Glowing Orb
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.035, 1.75, 6),
        facetMaterial({ color: 0x5c3a21, roughness: 0.6 })
      );
      shaft.rotation.x = Math.PI / 2.8;
      shaft.castShadow = true;
      wepGrp.add(shaft);

      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 7, 6),
        facetMaterial({
          color: it.color || 0xef4444,
          emissive: it.color || 0xef4444,
          emissiveIntensity: 0.85,
          roughness: 0.1
        })
      );
      orb.position.set(0, 0.42, -0.78);
      wepGrp.add(orb);

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.022, 5, 8),
        facetMaterial({ color: it.trim || 0xfde047, metalness: 0.85, roughness: 0.2 })
      );
      halo.position.copy(orb.position);
      wepGrp.add(halo);
    } else if (it.iconKind === 'whip') {
      // Coiled Abyssal Whip Spline
      const whipCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.05, 0.35, -0.25),
        new THREE.Vector3(-0.08, 0.65, -0.55),
        new THREE.Vector3(0.1, 0.45, -0.95),
        new THREE.Vector3(0, 0.15, -1.25)
      ]);
      const whipMesh = new THREE.Mesh(
        new THREE.TubeGeometry(whipCurve, 6, 0.042, 5, false),
        facetMaterial({ color: it.color, roughness: 0.35, metalness: 0.4 })
      );
      whipMesh.castShadow = true;
      wepGrp.add(whipMesh);
    } else {
      // Beveled Extruded Scimitar / Longsword / Master Sword
      const bladeShape = new THREE.Shape();
      const isScim = it.iconKind === 'scimitar';
      const len = it.iconKind === 'greatsword' ? 1.42 : 1.15;
      bladeShape.moveTo(-0.045, 0);
      if (isScim) {
        bladeShape.quadraticCurveTo(-0.08, len * 0.55, 0.04, len);
        bladeShape.quadraticCurveTo(0.13, len * 0.6, 0.05, 0);
      } else {
        bladeShape.lineTo(-0.055, len * 0.82);
        bladeShape.lineTo(0, len);
        bladeShape.lineTo(0.055, len * 0.82);
        bladeShape.lineTo(0.045, 0);
      }
      bladeShape.closePath();

      const extrudeSettings = {
        depth: 0.025,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.018,
        bevelThickness: 0.018
      };
      const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
      bladeGeo.center();
      const bladeMat = facetMaterial({
        color: it.color || 0xd1d5db,
        metalness: 0.82,
        roughness: 0.18,
        emissive: it.id === 'master_sword' ? 0x38bdf8 : 0x000000,
        emissiveIntensity: it.id === 'master_sword' ? 0.45 : 0
      });
      const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
      bladeMesh.rotation.y = Math.PI / 2;
      bladeMesh.position.y = len * 0.5 + 0.08;
      bladeMesh.castShadow = true;
      wepGrp.add(bladeMesh);

      // Sculpted Crossguard & Pommel
      const guardMat = facetMaterial({ color: it.trim || 0xfacc15, metalness: 0.8, roughness: 0.25 });
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.38, 6), guardMat);
      guard.rotation.x = Math.PI / 2;
      guard.position.y = 0.06;
      wepGrp.add(guard);

      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), guardMat);
      pommel.position.y = -0.16;
      wepGrp.add(pommel);

      wepGrp.rotation.x = -Math.PI / 2.35;
    }
    rArm.add(wepGrp);
    player.parts.wepMesh = wepGrp;
  }

  // 6. Sculpted Beveled Kite Shield / Defender in Left Hand
  const shId = STATE.equipment.shield;
  if (shId && ITEMS[shId]) {
    const it = ITEMS[shId];
    const shShape = new THREE.Shape();
    shShape.moveTo(0, -0.45);
    shShape.quadraticCurveTo(0.32, -0.22, 0.34, 0.28);
    shShape.quadraticCurveTo(0, 0.40, -0.34, 0.28);
    shShape.quadraticCurveTo(-0.32, -0.22, 0, -0.45);

    const shGeo = new THREE.ExtrudeGeometry(shShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025
    });
    const shMat = facetMaterial({
      color: it.color || 0x854d0e,
      metalness: it.id === 'wooden_shield' ? 0.15 : 0.72,
      roughness: it.id === 'wooden_shield' ? 0.7 : 0.25
    });
    const shield = new THREE.Mesh(shGeo, shMat);
    shield.rotation.y = Math.PI / 2;
    shield.position.set(-0.18, -0.45, -0.06);
    shield.castShadow = true;

    // Gold Shield Boss Crest
    const boss = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 7, 6),
      facetMaterial({ color: it.trim || 0xfacc15, metalness: 0.85, roughness: 0.2 })
    );
    boss.scale.set(1, 1, 0.45);
    boss.position.set(0, 0.02, 0.05);
    shield.add(boss);

    lArm.add(shield);
    player.parts.shieldMesh = shield;
  }

  // 7. Smooth Domed Full Helm with Plume on Head
  const helmId = STATE.equipment.head;
  if (helmId && ITEMS[helmId]) {
    const it = ITEMS[helmId];
    const helmGrp = new THREE.Group();
    const helmDome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.33, 0.40, 6),
      facetMaterial({ color: it.color })
    );
    helmDome.position.y = 0.05;
    helmDome.castShadow = true;
    helmGrp.add(helmDome);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.08, 0.08),
      facetMaterial({ color: 0x111827 })
    );
    visor.position.set(0, 0.02, -0.24);
    helmGrp.add(visor);

    // Flowing Plume Crest on Top of Helm
    const plumeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.34, -0.05),
      new THREE.Vector3(0, 0.46, 0.12),
      new THREE.Vector3(0, 0.32, 0.32)
    ]);
    const plume = new THREE.Mesh(
      new THREE.TubeGeometry(plumeCurve, 6, 0.055, 5, false),
      facetMaterial({ color: it.trim || 0xef4444, roughness: 0.5 })
    );
    helmGrp.add(plume);

    headG.add(helmGrp);
    player.parts.helmMesh = helmGrp;
  }

  // 8. Flowing Curved Cloth Cape on Back
  const capeId = STATE.equipment.cape;
  if (capeId && ITEMS[capeId]) {
    const it = ITEMS[capeId];
    const capeGeo = new THREE.PlaneGeometry(0.68, 1.18, 12, 16);
    const pos = capeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i);
      // Taper narrower at shoulders, wider at bottom, with gentle cylindrical drape
      const t = (0.59 - v) / 1.18;
      pos.setX(i, u * (0.72 + t * 0.42));
      pos.setZ(i, Math.cos(u * 3.0) * 0.06 + t * 0.12);
    }
    capeGeo.computeVertexNormals();
    const capeMat = facetMaterial({
      color: it.color,
      emissive: it.id === 'fire_cape' ? 0x9a3412 : 0x000000,
      emissiveIntensity: it.id === 'fire_cape' ? 0.45 : 0,
      roughness: 0.55,
      side: THREE.DoubleSide
    });
    const cape = new THREE.Mesh(capeGeo, capeMat);
    cape.position.set(0, 1.12, 0.25);
    cape.castShadow = true;
    torso.add(cape);
    player.parts.capeMesh = cape;
  }
}

// Smooth Sculpted Monster Rigs
function createMonsterMesh(def) {
  if (def.kind === 'bird') {
    // Smooth Plump Chicken (LatheGeometry + Curved Neck + Tail Plume)
    const grp = new THREE.Group();
    const bodyMat = facetMaterial({ color: def.bodyColor, roughness: 0.6 });
    const redMat  = facetMaterial({ color: def.accentColor, roughness: 0.5 });
    const beakMat = facetMaterial({ color: 0xf59e0b, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 7, 6), bodyMat);
    body.scale.set(0.88, 0.82, 1.22);
    body.position.y = 0.44;
    body.castShadow = true;
    grp.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 7, 6), bodyMat);
    head.position.set(0, 0.76, -0.32);
    head.castShadow = true;
    grp.add(head);

    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 6), redMat);
    comb.scale.set(0.45, 1.2, 1.5);
    comb.position.set(0, 0.95, -0.32);
    grp.add(comb);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), beakMat);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.75, -0.52);
    grp.add(beak);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 5), bodyMat);
    tail.rotation.x = 0.65;
    tail.position.set(0, 0.62, 0.38);
    grp.add(tail);

    const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.y = 0.75;
    grp.add(hitbox);
    return { group: grp, hitbox };
  }

  if (def.kind === 'scorpion') {
    // Smooth Segmented King Scorpion with Curved Tube Stinger & Pincers
    const grp = new THREE.Group();
    const shellMat = facetMaterial({ color: def.bodyColor, roughness: 0.35, metalness: 0.25 });
    const darkMat  = facetMaterial({ color: def.accentColor, roughness: 0.45 });

    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.38 - i * 0.05, 7, 6), shellMat);
      seg.scale.set(1.2, 0.62, 1.0);
      seg.position.set(0, 0.42, -0.3 + i * 0.38);
      seg.castShadow = true;
      grp.add(seg);
    }

    // S-Curved Segmented Stinger Tail
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.42, 0.55),
      new THREE.Vector3(0, 0.95, 0.95),
      new THREE.Vector3(0, 1.55, 0.65),
      new THREE.Vector3(0, 1.75, 0.15)
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 6, 0.12, 5, false), darkMat);
    tail.castShadow = true;
    grp.add(tail);

    const barb = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.35, 5), facetMaterial({ color: 0xef4444 }));
    barb.rotation.x = -Math.PI * 0.65;
    barb.position.set(0, 1.72, 0.02);
    grp.add(barb);

    // Pincer Claws
    [-0.45, 0.45].forEach(ox => {
      const claw = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 5, 8, Math.PI * 1.3), shellMat);
      claw.rotation.x = Math.PI / 2;
      claw.position.set(ox, 0.42, -0.72);
      claw.castShadow = true;
      grp.add(claw);
    });

    const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.9, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.y = 0.95;
    grp.add(hitbox);
    return { group: grp, hitbox };
  }

  if (def.kind === 'dragon') {
    // Smooth Sculpted Serpentine Elvarg the Crag Dragon
    const grp = new THREE.Group();
    const scaleMat = facetMaterial({ color: def.bodyColor, roughness: 0.38, metalness: 0.2 });
    const goldMat  = facetMaterial({ color: def.accentColor, roughness: 0.45, metalness: 0.3 });

    // Sculpted Dragon Chest & Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.35, 7, 6), scaleMat);
    body.scale.set(1.0, 0.85, 1.65);
    body.position.y = 1.65;
    body.castShadow = true;
    grp.add(body);

    // S-Curved Dragon Neck & Tail via TubeGeometry
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.8, -1.6),
      new THREE.Vector3(0, 2.7, -2.3),
      new THREE.Vector3(0, 3.65, -2.7)
    ]);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 6, 0.48, 5, false), scaleMat);
    neck.castShadow = true;
    grp.add(neck);

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.5, 1.6),
      new THREE.Vector3(0.4, 0.9, 3.2),
      new THREE.Vector3(-0.3, 0.5, 4.8)
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 6, 0.32, 5, false), scaleMat);
    tail.castShadow = true;
    grp.add(tail);

    // Sculpted Horned Dragon Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 7, 6), scaleMat);
    head.scale.set(0.88, 0.78, 1.45);
    head.position.set(0, 3.75, -3.15);
    head.castShadow = true;
    grp.add(head);

    [-0.32, 0.32].forEach(ox => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.95, 5), goldMat);
      horn.rotation.x = -0.85;
      horn.position.set(ox, 4.2, -2.8);
      grp.add(horn);
    });

    // Sculpted Bat-Like Dragon Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.quadraticCurveTo(2.2, 0.9, 4.2, 0.4);
    wingShape.quadraticCurveTo(3.1, -0.6, 1.8, -0.9);
    wingShape.quadraticCurveTo(0.8, -0.5, 0, -0.8);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 });
    wingGeo.rotateX(Math.PI / 2);

    const lWing = new THREE.Mesh(wingGeo, goldMat);
    lWing.scale.x = -1;
    lWing.position.set(-0.9, 2.35, -0.4);
    lWing.castShadow = true;
    grp.add(lWing);

    const rWing = new THREE.Mesh(wingGeo, goldMat);
    rWing.position.set(0.9, 2.35, -0.4);
    rWing.castShadow = true;
    grp.add(rWing);

    const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 4.4, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.y = 2.2;
    grp.add(hitbox);
    return { group: grp, hitbox, lWing, rWing };
  }

  // Smooth Humanoids: Goblin, Dark Wizard, Hill Giant, Moss Guardian, Lesser Demon
  const rig = buildHumanoidRig(def.bodyColor, def.accentColor, def.accentColor, def.scale || 1.0);
  if (def.kind === 'archer') {
    const bow = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.045, 5, 8, Math.PI),
      facetMaterial({ color: def.weaponColor || 0x92400e })
    );
    bow.rotation.y = Math.PI / 2;
    bow.position.set(0.05, -0.35, -0.2);
    bow.castShadow = true;
    rig.rightArmPivot.add(bow);
  } else if (def.weaponColor) {
    const clubCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.55, -0.05),
      new THREE.Vector3(0, 1.15, 0.04)
    ]);
    const club = new THREE.Mesh(
      new THREE.TubeGeometry(clubCurve, 6, 0.11, 5, false),
      facetMaterial({ color: def.weaponColor, roughness: 0.6 })
    );
    club.position.set(0, -0.68, -0.15);
    club.rotation.x = -Math.PI / 2.2;
    club.castShadow = true;
    rig.rightArmPivot.add(club);
  }
  if (def.kind === 'demon' || def.kind === 'guardian') {
    [-0.2, 0.2].forEach((ox, idx) => {
      const hCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ox, 0.22, 0),
        new THREE.Vector3(ox * 1.8, 0.48, 0.08),
        new THREE.Vector3(ox * 1.4, 0.68, -0.12)
      ]);
      const horn = new THREE.Mesh(
        new THREE.TubeGeometry(hCurve, 6, 0.055, 5, false),
        facetMaterial({ color: def.kind === 'demon' ? 0x111827 : 0x4ade80 })
      );
      rig.headGroup.add(horn);
    });
  }
  return rig;
}

function spawnMonster(typeKey, x, z) {
  const def = MONSTER_TYPES[typeKey];
  if (!def) return;
  const rig = createMonsterMesh(def);
  const y = getTerrainHeight(x, z);
  rig.group.position.set(x, y, z);

  const labelEl = document.createElement('div');
  labelEl.className = 'entity-label';
  labelEl.innerHTML = `
    <div class="label-text">${def.name} (Lv-${def.level})</div>
    <div class="entity-hp-bar" style="display:none;"><div class="entity-hp-fill" style="width:100%"></div></div>
  `;
  document.getElementById('world-labels').appendChild(labelEl);

  const mObj = {
    typeKey,
    def,
    rig,
    pos: rig.group.position,
    spawnPos: new THREE.Vector3(x, y, z),
    hp: def.hp,
    maxHp: def.hp,
    dead: false,
    respawnTimer: 0,
    wanderTimer: Math.random() * 3,
    attackCooldown: 0,
    inCombatWithPlayer: false,
    labelEl
  };

  const uData = { type: 'monster', entity: mObj, interactRadius: def.style === 'melee' ? 2.8 : 3.4 };
  rig.group.userData = uData;
  rig.hitbox.userData = uData;
  worldInteractiveObjects.push(rig.hitbox);
  scene.add(rig.group);
  monstersList.push(mObj);
}

// Smooth Organic Branching Trees & Sculpted Weathered Ore Boulders
function spawnResourceNode(nodeKey, x, z) {
  const def = RESOURCE_NODES_DEF[nodeKey];
  if (!def) return;
  const grp = new THREE.Group();
  const y = def.kind === 'fish' ? -0.30 : getTerrainHeight(x, z);
  grp.position.set(x, y, z);

  let visualMesh, depletedMesh;

  if (def.kind === 'tree') {
    const s = def.scale || 1.0;
    grp.scale.set(s, s, s);
    visualMesh = new THREE.Group();

    const barkMat = facetMaterial({ color: def.trunkColor, roughness: 0.88 });
    // Smooth Curved Main Trunk Spline + 3 Diverging Branches
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.12, 1.1, -0.08),
      new THREE.Vector3(-0.08, 2.2, 0.06),
      new THREE.Vector3(0, 3.1, 0)
    ]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 6, 0.34, 5, false), barkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    visualMesh.add(trunk);

    // Flared Root Base
    const rootBase = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.8, 5), barkMat);
    rootBase.position.y = 0.4;
    visualMesh.add(rootBase);

    // Smooth Billowing Cloud Canopy Clusters (High-subdivision Spheres)
    const fMat = facetMaterial({
      color: def.foliageColor,
      roughness: 0.58,
      emissive: nodeKey === 'magic_tree' ? 0x0284c7 : (nodeKey === 'yew_tree' ? 0x9d174d : 0x000000),
      emissiveIntensity: (nodeKey === 'magic_tree' || nodeKey === 'yew_tree') ? 0.28 : 0
    });

    const puffs = [
      [0, 3.5, 0, 1.55],
      [0.95, 2.95, 0.55, 1.18],
      [-0.95, 3.05, -0.45, 1.22],
      [0.45, 3.15, -0.85, 1.12],
      [-0.55, 2.85, 0.85, 1.10]
    ];
    puffs.forEach(([px, py, pz, rad]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rad, 7, 6), fMat);
      puff.scale.set(1.08, 0.82, 1.05);
      puff.position.set(px, py, pz);
      puff.castShadow = true;
      puff.receiveShadow = true;
      visualMesh.add(puff);
    });

    grp.add(visualMesh);

    depletedMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.52, 0.68, 6), barkMat);
    depletedMesh.position.y = 0.34;
    depletedMesh.visible = false;
    grp.add(depletedMesh);
  } else if (def.kind === 'rock') {
    visualMesh = new THREE.Group();
    // Smoothly Sculpted Organic Boulder (Subdivided Icosahedron with Vertex Sculpting)
    const boulderGeo = new THREE.IcosahedronGeometry(1.15, 0);
    const pos = boulderGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const n = 1.0 + 0.14 * Math.sin(vx * 3.2) * Math.cos(vy * 2.8) * Math.sin(vz * 3.0);
      pos.setXYZ(i, vx * n * 1.15, Math.max(0, (vy + 0.65) * 0.72 * n), vz * n * 1.1);
    }
    boulderGeo.computeVertexNormals();

    const baseRock = new THREE.Mesh(
      boulderGeo,
      facetMaterial({ color: 0x64748b, roughness: 0.78, metalness: 0.12 })
    );
    baseRock.castShadow = true;
    baseRock.receiveShadow = true;
    visualMesh.add(baseRock);

    // Gleaming Embedded Ore Vein Seams
    const oreMat = facetMaterial({
      color: def.oreColor,
      metalness: 0.78,
      roughness: 0.2,
      emissive: def.oreColor,
      emissiveIntensity: 0.18
    });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const seam = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), oreMat);
      seam.scale.set(1.2, 0.7, 0.9);
      seam.position.set(Math.cos(ang) * 0.74, 0.55 + (i % 2) * 0.25, Math.sin(ang) * 0.72);
      seam.rotation.set(ang, ang * 0.5, 0);
      visualMesh.add(seam);
    }
    grp.add(visualMesh);

    depletedMesh = new THREE.Mesh(
      boulderGeo,
      facetMaterial({ color: 0x334155, roughness: 0.92 })
    );
    depletedMesh.scale.set(0.95, 0.75, 0.95);
    depletedMesh.visible = false;
    grp.add(depletedMesh);
  } else {
    visualMesh = new THREE.Group();
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.05, 5, 8),
      new THREE.MeshBasicMaterial({ color: 0xbae6fd })
    );
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.06;
    visualMesh.add(ring1);
    swayingFoliage.push({ mesh: ring1, speed: 1.8, rotY: true });
    grp.add(visualMesh);

    depletedMesh = new THREE.Group();
    depletedMesh.visible = false;
    grp.add(depletedMesh);
  }

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.45, 3.2, 6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 1.5;
  grp.add(hitbox);

  const rObj = {
    nodeKey,
    def,
    group: grp,
    pos: grp.position,
    visualMesh,
    depletedMesh,
    depleted: false,
    respawnTimer: 0
  };

  const uData = { type: 'resource', entity: rObj, interactRadius: 3.4 };
  grp.userData = uData;
  hitbox.userData = uData;
  worldInteractiveObjects.push(hitbox);
  scene.add(grp);
  resourceNodesList.push(rObj);
}

function spawnAllResourcesAndMonsters() {
  // 1. LUMBRIDGE HAVEN (Starter monsters & trees visible right in town & surrounding meadows)
  [[-13, 4], [-16, 10], [-11, 14], [-17, 17]].forEach(([x, z]) => spawnMonster('chicken', x, z));
  [[12, 4], [15, 11], [18, 17], [10, 19], [20, 8]].forEach(([x, z]) => spawnMonster('goblin', x, z));
  [[24, 13], [27, 19]].forEach(([x, z]) => spawnMonster('goblin_archer', x, z));

  [[-19, -2], [-24, 8], [-20, -11], [17, -11], [22, -4]].forEach(([x, z]) => spawnResourceNode('normal_tree', x, z));
  [[-14, 24], [8, 26], [-25, 20]].forEach(([x, z]) => spawnResourceNode('oak_tree', x, z));
  [[-6, 22], [16, 24], [4, 30]].forEach(([x, z]) => spawnResourceNode('maple_tree', x, z));
  [[27, 5], [28, 14], [26, -8]].forEach(([x, z]) => spawnResourceNode('fish_shrimp', x, z));
  [[29, 22], [27, -18]].forEach(([x, z]) => spawnResourceNode('fish_trout', x, z));
  [[-18, -22], [-12, -25]].forEach(([x, z]) => spawnResourceNode('copper_rock', x, z));

  // 2. VARROCK GRAND PLAZA
  [[62, -6], [68, -2], [58, -14]].forEach(([x, z]) => spawnMonster('dark_wizard', x, z));
  [[74, -10], [80, -4]].forEach(([x, z]) => spawnMonster('dark_ranger', x, z));
  [[88, -36], [96, -28], [82, -42], [95, -40]].forEach(([x, z]) => spawnMonster('hill_giant', x, z));
  [[94, -8], [98, -14], [92, -2]].forEach(([x, z]) => spawnResourceNode('iron_rock', x, z));
  [[102, -18], [100, -24]].forEach(([x, z]) => spawnResourceNode('mith_rock', x, z));
  [[64, -32], [70, -38]].forEach(([x, z]) => spawnResourceNode('willow_tree', x, z));

  // 3. AL-KHARID GOLDEN DUNES
  [[52, 54], [60, 76], [76, 58], [82, 72], [68, 84]].forEach(([x, z]) => spawnMonster('scorpion', x, z));
  [[85, 55], [88, 62], [82, 48]].forEach(([x, z]) => spawnResourceNode('gold_rock', x, z));
  [[54, 78], [58, 84]].forEach(([x, z]) => spawnResourceNode('mith_rock', x, z));

  // 4. WHISPERING KOROK WOODS
  [[-64, -18], [-82, -22], [-70, -44], [-86, -38]].forEach(([x, z]) => spawnMonster('moss_guardian', x, z));
  [[-60, -32], [-66, -48], [-88, -18], [-92, -30]].forEach(([x, z]) => spawnResourceNode('yew_tree', x, z));
  [[-75, -14], [-84, -48], [-95, -40]].forEach(([x, z]) => spawnResourceNode('magic_tree', x, z));
  [[25, -36], [27, -44]].forEach(([x, z]) => spawnResourceNode('fish_lobster', x, z));
  [[26, -54], [28, -62]].forEach(([x, z]) => spawnResourceNode('fish_shark', x, z));

  // 5. DRAGON'S PEAK WILDERNESS
  [[-56, 56], [-64, 78], [-82, 58], [-58, 84]].forEach(([x, z]) => spawnMonster('lesser_demon', x, z));
  spawnMonster('elvarg_dragon', -82, 82);
  [[-92, 68], [-88, 76], [-74, 92]].forEach(([x, z]) => spawnResourceNode('runite_rock', x, z));
}

function buildAtmosphericParticles() {
  const count = 200;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 190;
    pos[i * 3 + 1] = 1.5 + Math.random() * 14;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 190;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfef08a,
    size: 0.34,
    transparent: true,
    opacity: 0.72
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  particlesList.push(pts);
}


// ============================================================================
// 9. INPUT, CAMERA BEHIND CHARACTER, COMBAT, SKILLING, MINIMAP & MAIN LOOP
// ============================================================================
const keysPressed = {};
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();
let clickMarkerMesh = null;
let hoverTile = null;

function setupInputHandlers() {
  clickMarkerMesh = new THREE.Group();
  clickMarkerMesh.userData.life = 0;
  const crossMat = () => new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0, depthWrite: false });
  const armA = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.07), crossMat());
  armA.rotation.y = Math.PI / 4;
  const armB = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.07), crossMat());
  armB.rotation.y = -Math.PI / 4;
  clickMarkerMesh.add(armA, armB);
  scene.add(clickMarkerMesh);
  hoverTile = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
  );
  hoverTile.rotation.x = -Math.PI / 2;
  hoverTile.visible = false;
  scene.add(hoverTile);

  window.addEventListener('keydown', e => {
    keysPressed[e.code] = true;
    if (e.code === 'Space' && player.isGrounded) {
      player.jumpVel = 7.8;
      player.isGrounded = false;
      SFX.jump();
    }
    if (e.code === 'KeyF') {
      toggleSpecialAttack();
    }
    if (e.code === 'Escape') {
      closeModals();
    }
    const tabByKey = { F1: 'combat', F2: 'skills', F3: 'inventory', F4: 'equipment', F5: 'prayer', F6: 'magic' };
    if (tabByKey[e.code]) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        switchTab(tabByKey[e.code]);
      }
    }
  });

  window.addEventListener('keyup', e => {
    keysPressed[e.code] = false;
  });

  const canvas = renderer.domElement;
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', e => {
    if (e.button === 2 || e.button === 1) {
      camState.isDragging = true;
      camState.lastMouseX = e.clientX;
      camState.lastMouseY = e.clientY;
      return;
    }
    if (e.button === 0) {
      handleWorldClick(e);
    }
  });

  window.addEventListener('mousemove', e => {
    if (camState.isDragging) {
      const dx = e.clientX - camState.lastMouseX;
      const dy = e.clientY - camState.lastMouseY;
      camState.lastMouseX = e.clientX;
      camState.lastMouseY = e.clientY;
      camState.manualOffset -= dx * 0.007;
      camState.pitch = Math.max(0.12, Math.min(1.15, camState.pitch + dy * 0.005));
    } else {
      handleWorldHover(e);
    }
  });

  window.addEventListener('mouseup', () => {
    camState.isDragging = false;
  });

  canvas.addEventListener('wheel', e => {
    camState.distance = Math.max(6.5, Math.min(26, camState.distance + e.deltaY * 0.01));
  }, { passive: true });

  const mmCanvas = document.getElementById('minimap-canvas');
  mmCanvas.addEventListener('click', e => {
    const rect = mmCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const scale = 0.55;
    const sin = Math.sin(camState.yaw);
    const cos = Math.cos(camState.yaw);
    const wx = player.pos.x - (cx * cos - cy * sin) * scale;
    const wz = player.pos.z - (cx * sin + cy * cos) * scale;
    if (!isWalkable(wx, wz)) {
      addChatMessage('You cannot walk there.', 'combat');
      return;
    }
    player.targetEntity = null;
    player.targetPos = new THREE.Vector3(wx, getTerrainHeight(wx, wz), wz);
    showClickMarker(player.targetPos.x, player.targetPos.z, 0xfde047);
  });
}

function resetCameraBehindPlayer() {
  camState.manualOffset = 0;
  camState.pitch = 0.34;
}

function showClickMarker(x, z, hexColor) {
  if (!clickMarkerMesh) return;
  clickMarkerMesh.position.set(x, getTerrainHeight(x, z) + 0.16, z);
  clickMarkerMesh.userData.life = 1;
  clickMarkerMesh.scale.set(1, 1, 1);
  clickMarkerMesh.traverse(obj => {
    if (obj.material && obj.material.color) {
      obj.material.color.setHex(hexColor);
      obj.material.opacity = 1;
    }
  });
}

function handleWorldHover(e) {
  updateHoverTile(e);
  const tooltip = document.getElementById('hover-tooltip');
  mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const hits = raycaster.intersectObjects(worldInteractiveObjects, false);
  if (hits.length > 0) {
    const ud = hits[0].object.userData;
    if (ud && ud.type !== 'ground') {
      let label = '';
      if (ud.type === 'monster' && !ud.entity.dead) {
        const m = ud.entity;
        label = `Attack <b style="color:#ff981f">${m.def.name}</b> (Lv-${m.def.level}) [${m.hp}/${m.maxHp} HP]`;
      } else if (ud.type === 'resource' && !ud.entity.depleted) {
        const r = ud.entity;
        label = `Gather <b style="color:#38bdf8">${r.def.name}</b> (Req Lv ${r.def.req} ${SKILLS_META[r.def.skill].name})`;
      } else if (ud.type === 'interactive') {
        label = `Interact with <b style="color:#fde047">${ud.name}</b>`;
      }
      if (label) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY + 14) + 'px';
        tooltip.innerHTML = label;
        document.body.style.cursor = 'pointer';
        return;
      }
    }
  }
  tooltip.style.display = 'none';
  document.body.style.cursor = 'default';
}

function handleWorldClick(e) {
  mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);

  const hits = raycaster.intersectObjects(worldInteractiveObjects, false);
  if (hits.length === 0) return;

  let chosen = hits.find(h => h.object.userData && h.object.userData.type !== 'ground') || hits[0];
  const ud = chosen.object.userData;

  if (!ud || ud.type === 'ground') {
    const pt = chosen.point;
    if (!isWalkable(pt.x, pt.z)) {
      addChatMessage('You cannot walk there.', 'combat');
      return;
    }
    player.targetEntity = null;
    player.targetPos = new THREE.Vector3(pt.x, getTerrainHeight(pt.x, pt.z), pt.z);
    showClickMarker(pt.x, pt.z, 0xfde047);
    updateTargetHud();
    return;
  }

  if (ud.type === 'monster') {
    if (ud.entity.dead) return;
    player.targetEntity = { type: 'monster', ref: ud.entity };
    player.targetPos = null;
    showClickMarker(ud.entity.pos.x, ud.entity.pos.z, 0xef4444);
    updateTargetHud();
  } else if (ud.type === 'resource') {
    if (ud.entity.depleted) {
      addChatMessage(`This ${ud.entity.def.name} is depleted. Wait a moment for it to replenish.`);
      return;
    }
    player.targetEntity = { type: 'resource', ref: ud.entity };
    player.targetPos = null;
    showClickMarker(ud.entity.pos.x, ud.entity.pos.z, 0xef4444);
    updateTargetHud();
  } else if (ud.type === 'interactive') {
    player.targetEntity = { type: 'interactive', ref: ud, pos: chosen.object.getWorldPosition(new THREE.Vector3()) };
    player.targetPos = null;
    showClickMarker(player.targetEntity.pos.x, player.targetEntity.pos.z, 0xef4444);
  }
}

function updateTargetHud() {
  const hud = document.getElementById('target-hud');
  if (player.targetEntity && player.targetEntity.type === 'monster' && !player.targetEntity.ref.dead) {
    const m = player.targetEntity.ref;
    hud.classList.add('visible');
    document.getElementById('target-name').textContent = m.def.name;
    document.getElementById('target-lvl-tag').textContent = `Lv ${m.def.level}`;
    const pct = Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100));
    document.getElementById('target-hp-fill').style.width = pct + '%';
    document.getElementById('target-hp-text').textContent = `${Math.ceil(m.hp)} / ${m.maxHp}`;
  } else if (player.targetEntity && player.targetEntity.type === 'resource' && !player.targetEntity.ref.depleted) {
    const r = player.targetEntity.ref;
    hud.classList.add('visible');
    document.getElementById('target-name').textContent = r.def.name;
    document.getElementById('target-lvl-tag').textContent = `Req Lv ${r.def.req}`;
    document.getElementById('target-hp-fill').style.width = '100%';
    document.getElementById('target-hp-text').textContent = SKILLS_META[r.def.skill].name;
  } else {
    hud.classList.remove('visible');
  }
}

function teleportToRegion(regionId) {
  const reg = WORLD_REGIONS.find(r => r.id === regionId);
  if (!reg) return;
  player.targetEntity = null;
  player.targetPos = null;
  player.pos.set(reg.x, getTerrainHeight(reg.x, reg.z + 4), reg.z + 4);
  player.yaw = Math.PI;
  camState.yaw = Math.PI;
  camState.manualOffset = 0;
  SFX.magic();
  spawnLevelUpFireworks(0x38e8ff);
  addChatMessage(`Teleported to <b>${reg.name}</b>.`, 'region');
  triggerRegionBanner(reg);
}

let lastBannerRegion = '';
function checkRegionChange() {
  for (const reg of WORLD_REGIONS) {
    const d = Math.hypot(player.pos.x - reg.x, player.pos.z - reg.z);
    if (d < reg.radius) {
      if (STATE.currentRegion !== reg.id) {
        STATE.currentRegion = reg.id;
        document.getElementById('current-zone-footer').textContent = reg.name;
        triggerRegionBanner(reg);
      }
      return;
    }
  }
}

let bannerTimer = null;
function triggerRegionBanner(reg) {
  if (lastBannerRegion === reg.id) return;
  lastBannerRegion = reg.id;
  const b = document.getElementById('region-banner');
  document.getElementById('region-sub-text').textContent = reg.sub;
  document.getElementById('region-title-text').textContent = reg.name;
  b.classList.add('visible');
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('visible'), 3600);
}

// ============================================================================
// 10. COMBAT HIT SPLATS, PROJECTILES & SKILLING EXECUTION
// ============================================================================
function spawnHitSplatWorld(worldPos, dmg, splatType = 'hit') {
  const screenPos = worldToScreen(worldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.8, 0)));
  if (!screenPos.visible) return;
  const el = document.createElement('div');
  el.className = `hitsplat ${splatType}`;
  el.style.left = screenPos.x + 'px';
  el.style.top = screenPos.y + 'px';
  el.textContent = splatType === 'heal' ? `+${dmg}` : dmg;
  document.getElementById('world-labels').appendChild(el);
  setTimeout(() => el.remove(), 1050);
}

function spawnHitSplatOnPlayer(dmg, splatType = 'hit') {
  spawnHitSplatWorld(player.pos, dmg, splatType);
}

function spawnProjectile(fromPos, toPos, colorHex, onImpact) {
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 7, 6),
    new THREE.MeshBasicMaterial({ color: colorHex })
  );
  const start = fromPos.clone().add(new THREE.Vector3(0, 1.4, 0));
  const end = toPos.clone().add(new THREE.Vector3(0, 1.2, 0));
  orb.position.copy(start);
  scene.add(orb);
  projectilesList.push({
    mesh: orb,
    start,
    end,
    progress: 0,
    speed: 3.5,
    onImpact
  });
}

function spawnLevelUpFireworks(colorHex = 0xfde047) {
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 7, 6),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    const ang = (i / 16) * Math.PI * 2;
    p.position.copy(player.pos).add(new THREE.Vector3(Math.cos(ang) * 0.8, 1.0, Math.sin(ang) * 0.8));
    scene.add(p);
    const vel = new THREE.Vector3(Math.cos(ang) * 2.5, 3.5 + Math.random() * 2, Math.sin(ang) * 2.5);
    const startT = performance.now();
    const tick = () => {
      const dt = (performance.now() - startT) / 1000;
      if (dt > 0.9) {
        scene.remove(p);
        return;
      }
      p.position.addScaledVector(vel, 0.016);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function performPlayerAttack(monster) {
  if (monster.dead) return;
  const prep = prepareAttack(STATE);
  if (!prep.ok) {
    addChatMessage(prep.reason, 'combat');
    player.targetEntity = null;
    return;
  }
  prep.consume.forEach(cost => removeItem(STATE, cost.id, cost.qty));
  const bon = getEquipmentBonuses();
  const s = STATE.skills;
  const style = STATE.combatStyle;
  let maxHit = 2;
  let accuracyScore = 10;

  const prayStrMult = STATE.activePrayers.has('piety') ? 1.25 : (STATE.activePrayers.has('burst_str') ? 1.15 : 1.0);
  const prayRngMult = STATE.activePrayers.has('sharp_eye') ? 1.20 : 1.0;
  const prayMagMult = STATE.activePrayers.has('mystic_might') ? 1.20 : 1.0;

  if ((style === 'rapid' || style === 'ranged')) {
    maxHit = Math.max(2, Math.floor((2 + s.ranged.lvl * 0.35 + bon.rng * 0.22) * prayRngMult));
    accuracyScore = s.ranged.lvl * 1.4 + bon.rng + 12;
  } else if (style === 'magic') {
    const sp = SPELLS.find(x => x.id === STATE.activeSpell) || SPELLS[0];
    maxHit = Math.max(3, Math.floor((sp.maxHit + s.magic.lvl * 0.22 + bon.mag * 0.18) * prayMagMult));
    accuracyScore = s.magic.lvl * 1.5 + bon.mag + 16;
  } else {
    const styleStrBonus = style === 'aggressive' ? 2 : (style === 'controlled' ? 1 : 0);
    const styleAtkBonus = style === 'accurate' ? 4 : (style === 'controlled' ? 2 : 0);
    maxHit = Math.max(2, Math.floor((1.5 + (s.strength.lvl + styleStrBonus) * 0.32 + bon.str * 0.22) * prayStrMult));
    accuracyScore = (s.attack.lvl + styleAtkBonus) * 1.35 + bon.atk + 12;
  }

  let isSpec = false;
  if (STATE.specArmed && STATE.specEnergy >= 25) {
    isSpec = true;
    STATE.specArmed = false;
    STATE.specEnergy = Math.max(0, STATE.specEnergy - 25);
    maxHit = Math.floor(maxHit * 1.55);
    accuracyScore *= 1.5;
    player.spinAnim = 1.0;
    addChatMessage('You unleash a <b>Hylian Spin-Slash Special Attack</b>!', 'lvlup');
  } else {
    player.attackAnim = 1.0;
  }

  const monsterDefRoll = monster.def.def * 1.1 + 4;
  const hitChance = Math.min(0.94, Math.max(0.22, accuracyScore / (accuracyScore + monsterDefRoll * 0.75)));
  const didHit = Math.random() < hitChance;
  const dmg = didHit ? Math.max(1, Math.floor(Math.random() * (maxHit + 1))) : 0;

  const applyDamage = () => {
    if (monster.dead) return;
    monster.inCombatWithPlayer = true;
    if (dmg > 0) {
      SFX.hit();
      monster.hp = Math.max(0, monster.hp - dmg);
      spawnHitSplatWorld(monster.pos, dmg, (dmg >= maxHit || isSpec) ? 'maxhit' : 'hit');

      if (style === 'magic' && STATE.activeSpell === 'blood_barrage') {
        const healAmt = Math.max(1, Math.floor(dmg * 0.25));
        STATE.hp = Math.min(STATE.maxHp, STATE.hp + healAmt);
        spawnHitSplatOnPlayer(healAmt, 'heal');
      }

      grantXp('hitpoints', dmg * 1.5);
      if (style === 'accurate') grantXp('attack', dmg * 4);
      else if (style === 'aggressive') grantXp('strength', dmg * 4);
      else if (style === 'defensive') grantXp('defence', dmg * 4);
      else if (style === 'controlled') {
        grantXp('attack', dmg * 1.4);
        grantXp('strength', dmg * 1.3);
        grantXp('defence', dmg * 1.3);
      }
      else if (style === 'rapid' || style === 'ranged') grantXp('ranged', dmg * 4);
      else if (style === 'magic') {
        const sp = SPELLS.find(x => x.id === STATE.activeSpell) || SPELLS[0];
        grantXp('magic', dmg * 3 + sp.xp * 0.4);
      }

      if (monster.hp <= 0) {
        handleMonsterDeath(monster);
      }
    } else {
      SFX.miss();
      spawnHitSplatWorld(monster.pos, 0, 'miss');
    }
    updateTargetHud();
    updateAllUI();
  };

  if ((style === 'rapid' || style === 'ranged')) {
    SFX.bow();
    spawnProjectile(player.pos, monster.pos, 0xfacc15, applyDamage);
  } else if (style === 'magic') {
    SFX.magic();
    const sp = SPELLS.find(x => x.id === STATE.activeSpell) || SPELLS[0];
    spawnProjectile(player.pos, monster.pos, sp.color, applyDamage);
  } else {
    applyDamage();
  }
}

function handleMonsterDeath(monster) {
  monster.dead = true;
  monster.inCombatWithPlayer = false;
  monster.respawnTimer = 6.5;
  monster.rig.group.visible = false;
  if (player.targetEntity && player.targetEntity.ref === monster) {
    player.targetEntity = null;
  }

  addChatMessage(`Defeated <b>${monster.def.name}</b> (Lv-${monster.def.level}).`, 'combat');
  if (monster.typeKey === 'goblin' || monster.typeKey === 'goblin_archer') STATE.quests.killedGoblin = true;

  if (monster.def.drops) {
    monster.def.drops.forEach(d => {
      if (Math.random() <= d.chance) {
        if (d.gp) {
          const coins = d.gp[0] + Math.floor(Math.random() * (d.gp[1] - d.gp[0] + 1));
          STATE.gp += coins;
          SFX.coin();
          addChatMessage(`Looted <b style="color:#ffe642">${coins} GP</b> from ${monster.def.name}.`, 'loot');
        } else if (d.id && ITEMS[d.id]) {
          const qty = d.qty || 1;
          const gained = addItem(STATE, d.id, qty);
          if (gained.added > 0) addChatMessage('Looted <b>' + ITEMS[d.id].name + '</b>' + (gained.added > 1 ? ' x' + gained.added : '') + '.', 'loot');
          if (!gained.ok) addChatMessage('Your backpack is full. The <b>' + ITEMS[d.id].name + '</b> is left behind.', 'combat');
        }
      }
    });
  }
  updateAllUI();
}

function performMonsterRetaliation(monster) {
  if (monster.dead || STATE.hp <= 0) return;
  const bon = getEquipmentBonuses();
  const defLvl = STATE.skills.defence.lvl + (STATE.combatStyle === 'defensive' ? 3 : 0);
  const prayDefMult = STATE.activePrayers.has('piety') ? 1.25 : (STATE.activePrayers.has('thick_skin') ? 1.15 : 1.0);
  const playerDefScore = (defLvl * 1.2 + bon.def) * prayDefMult + 10;
  const monAtkScore = monster.def.atk * 1.25 + 8;

  const hitChance = Math.min(0.82, Math.max(0.12, monAtkScore / (monAtkScore + playerDefScore)));
  let dmg = 0;
  if (Math.random() < hitChance) {
    dmg = Math.max(1, Math.floor(Math.random() * (monster.def.maxHit + 1)));
    dmg = mitigateDamage(dmg, monster.def.style, STATE.activePrayers);
  }

  const applyHit = () => {
    if (dmg > 0) {
      STATE.hp = Math.max(0, STATE.hp - dmg);
      spawnHitSplatOnPlayer(dmg, 'hit');
      if (STATE.hp <= 0) {
        handlePlayerDeath();
      }
    } else {
      spawnHitSplatOnPlayer(0, 'miss');
    }
    updateAllUI();
  };

  if (monster.def.style === 'magic') {
    spawnProjectile(monster.pos, player.pos, 0xa855f7, applyHit);
  } else if (monster.def.style === 'ranged') {
    spawnProjectile(monster.pos, player.pos, 0xfde047, applyHit);
  } else {
    applyHit();
  }
}

function handlePlayerDeath() {
  addChatMessage('<b>Oh dear, you have fallen in battle!</b> You awaken in Lumbridge Haven with all your gear and GP intact.', 'combat');
  STATE.hp = STATE.maxHp;
  STATE.prayerPts = STATE.maxPrayerPts;
  STATE.activePrayers.clear();
  monstersList.forEach(m => m.inCombatWithPlayer = false);
  teleportToRegion('lumbridge');
  updateAllUI();
}

function performResourceGather(node) {
  if (node.depleted) return;
  const def = node.def;
  const skillLvl = STATE.skills[def.skill].lvl;
  if (skillLvl < def.req) {
    addChatMessage(`You need <b>Level ${def.req} ${SKILLS_META[def.skill].name}</b> to gather from ${def.name}.`, 'combat');
    player.targetEntity = null;
    updateTargetHud();
    return;
  }
  if (!canAddItem(STATE, def.item, 1)) {
    addChatMessage('Your backpack is full. The resource stays where it is.', 'combat');
    player.targetEntity = null;
    updateTargetHud();
    return;
  }

  player.attackAnim = 1.0;
  if (def.skill === 'woodcutting') SFX.chop();
  else if (def.skill === 'mining') SFX.mine();
  else SFX.fish();

  const successChance = Math.min(0.92, 0.50 + (skillLvl - def.req) * 0.02);
  if (Math.random() <= successChance) {
    addItemToInventory(def.item, 1);
    grantXp(def.skill, def.xp);
    addChatMessage(`Gathered <b>${ITEMS[def.item].name}</b>.`, 'skill');

    if (def.kind !== 'fish' || Math.random() < 0.35) {
      node.depleted = true;
      node.respawnTimer = def.respawn / 1000;
      node.visualMesh.visible = false;
      node.depletedMesh.visible = true;
      player.targetEntity = null;
      updateTargetHud();
    }
  }
}

// ============================================================================
// 11. ROTATING MINIMAP & FLOATING LABELS
// ============================================================================
function renderMinimap() {
  const canvas = document.getElementById('minimap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const scale = 1.75;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(camState.yaw - Math.PI);

  const compass = document.getElementById('compass-badge');
  if (compass) compass.style.transform = `rotate(${(camState.yaw - Math.PI)}rad)`;

  WORLD_REGIONS.forEach(reg => {
    const rx = (reg.x - player.pos.x) * scale;
    const rz = (reg.z - player.pos.z) * scale;
    ctx.beginPath();
    ctx.arc(rx, rz, reg.radius * scale * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = reg.color + '28';
    ctx.fill();
    ctx.strokeStyle = reg.color + '88';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // River Strip
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 14;
  ctx.beginPath();
  for (let z = -110; z <= 110; z += 10) {
    const wx = 28 + Math.sin(z * 0.05) * 8;
    const px = (wx - player.pos.x) * scale;
    const pz = (z - player.pos.z) * scale;
    if (z === -110) ctx.moveTo(px, pz);
    else ctx.lineTo(px, pz);
  }
  ctx.stroke();

  // Resource Nodes (Cyan)
  resourceNodesList.forEach(r => {
    if (r.depleted) return;
    const px = (r.pos.x - player.pos.x) * scale;
    const pz = (r.pos.z - player.pos.z) * scale;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(px - 2, pz - 2, 4, 4);
  });

  // NPCs, Altars & Forges (Gold)
  npcList.forEach(n => {
    const px = (n.pos.x - player.pos.x) * scale;
    const pz = (n.pos.z - player.pos.z) * scale;
    ctx.beginPath();
    ctx.arc(px, pz, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();
  });

  // Live Monsters (Red / Boss Orange)
  monstersList.forEach(m => {
    if (m.dead) return;
    const px = (m.pos.x - player.pos.x) * scale;
    const pz = (m.pos.z - player.pos.z) * scale;
    ctx.beginPath();
    ctx.arc(px, pz, m.typeKey === 'elvarg_dragon' ? 5.5 : 3.2, 0, Math.PI * 2);
    ctx.fillStyle = m.typeKey === 'elvarg_dragon' ? '#f97316' : '#ef4444';
    ctx.fill();
  });

  ctx.restore();

  // Player Center Dot
  ctx.beginPath();
  ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function worldToScreen(vec3) {
  const v = vec3.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-(v.y * 0.5) + 0.5) * window.innerHeight,
    visible: v.z < 1.0
  };
}

let playerOverheadEl = null;
function updateFloatingWorldLabels() {
  const playerCombatLvl = getCombatLevel();

  // Player Overhead Prayer SVG Badge
  if (!playerOverheadEl) {
    playerOverheadEl = document.createElement('div');
    playerOverheadEl.className = 'entity-label';
    document.getElementById('world-labels').appendChild(playerOverheadEl);
  }
  let overheadPrayerId = null;
  PRAYERS.forEach(p => {
    if (p.overhead && STATE.activePrayers.has(p.id)) overheadPrayerId = p.id;
  });
  if (overheadPrayerId) {
    const sp = worldToScreen(player.pos.clone().add(new THREE.Vector3(0, 2.8, 0)));
    if (sp.visible) {
      playerOverheadEl.style.display = 'flex';
      playerOverheadEl.style.left = sp.x + 'px';
      playerOverheadEl.style.top = sp.y + 'px';
      if (playerOverheadEl.dataset.prayer !== overheadPrayerId) {
        playerOverheadEl.dataset.prayer = overheadPrayerId;
        playerOverheadEl.innerHTML = `<div class="overhead-prayer-badge">${getPrayerSvg(overheadPrayerId)}</div>`;
      }
    } else {
      playerOverheadEl.style.display = 'none';
    }
  } else {
    playerOverheadEl.style.display = 'none';
  }

  // Monster Floating Labels
  monstersList.forEach(m => {
    if (m.dead) {
      m.labelEl.style.display = 'none';
      return;
    }
    const dist = player.pos.distanceTo(m.pos);
    if (dist > 34) {
      m.labelEl.style.display = 'none';
      return;
    }
    const topY = m.typeKey === 'elvarg_dragon' ? 4.6 : (2.4 * (m.def.scale || 1));
    const sp = worldToScreen(m.pos.clone().add(new THREE.Vector3(0, topY, 0)));
    if (!sp.visible) {
      m.labelEl.style.display = 'none';
      return;
    }
    m.labelEl.style.display = 'flex';
    m.labelEl.style.left = sp.x + 'px';
    m.labelEl.style.top = sp.y + 'px';

    const diff = m.def.level - playerCombatLvl;
    let col = '#ffe642';
    if (diff < -2) col = '#4ade80';
    else if (diff > 3) col = '#f87171';
    else if (diff > 0) col = '#fb923c';

    const txtDiv = m.labelEl.querySelector('.label-text');
    if (txtDiv) txtDiv.style.color = col;

    const hpBar = m.labelEl.querySelector('.entity-hp-bar');
    const hpFill = m.labelEl.querySelector('.entity-hp-fill');
    if (m.hp < m.maxHp || m.inCombatWithPlayer) {
      hpBar.style.display = 'block';
      hpFill.style.width = Math.max(0, (m.hp / m.maxHp) * 100) + '%';
    } else {
      hpBar.style.display = 'none';
    }
  });

  // NPCs, Altars & Forges Floating Labels
  npcList.forEach(n => {
    if (!n.el) {
      n.el = document.createElement('div');
      n.el.className = 'entity-label';
      n.el.style.color = n.color || '#fde047';
      n.el.innerHTML = `<div class="label-text">${n.name}</div>`;
      document.getElementById('world-labels').appendChild(n.el);
    }
    const dist = player.pos.distanceTo(n.pos);
    if (dist > 32) {
      n.el.style.display = 'none';
      return;
    }
    const sp = worldToScreen(n.pos.clone().add(new THREE.Vector3(0, n.yOffset || 2.8, 0)));
    if (!sp.visible) {
      n.el.style.display = 'none';
      return;
    }
    n.el.style.display = 'flex';
    n.el.style.left = sp.x + 'px';
    n.el.style.top = sp.y + 'px';
  });
}

// ============================================================================
// 12. MAIN ANIMATION, SHADERS & PHYSICS LOOP
// ============================================================================
let lastFrameTime = performance.now();

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.08, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  const elapsedSec = now * 0.001;

  if (waterUniforms) waterUniforms.uTime.value = elapsedSec;
  if (skyUniforms) skyUniforms.uTime.value = elapsedSec;
  if (skyDomeMesh) skyDomeMesh.position.copy(player.pos);

  if (STATE.specEnergy < 100) {
    STATE.specEnergy = Math.min(100, STATE.specEnergy + dt * 2.5);
  }
  if (STATE.hp < STATE.maxHp && STATE.hp > 0) {
    STATE.hp = Math.min(STATE.maxHp, STATE.hp + dt * 0.25);
  }
  if (STATE.activePrayers.size > 0) {
    let drainRate = 0;
    PRAYERS.forEach(p => { if (STATE.activePrayers.has(p.id)) drainRate += p.drain; });
    STATE.prayerPts = Math.max(0, STATE.prayerPts - drainRate * dt);
    if (STATE.prayerPts <= 0) {
      STATE.activePrayers.clear();
      addChatMessage('You have run out of Prayer points! Your prayers have deactivated.', 'combat');
      updateAllUI();
    }
  }

  const moveSpeed = 11.5;
  const turnSpeed = 2.6;
  let manualMoving = false;

  if (keysPressed['KeyQ']) camState.manualOffset += turnSpeed * dt;
  if (keysPressed['KeyE']) camState.manualOffset -= turnSpeed * dt;

  if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) {
    player.yaw += turnSpeed * dt;
  }
  if (keysPressed['KeyD'] || keysPressed['ArrowRight']) {
    player.yaw -= turnSpeed * dt;
  }

  let forwardInput = 0;
  if (keysPressed['KeyW'] || keysPressed['ArrowUp']) forwardInput += 1;
  if (keysPressed['KeyS'] || keysPressed['ArrowDown']) forwardInput -= 0.75;

  if (forwardInput !== 0) {
    manualMoving = true;
    player.targetPos = null;
    player.targetEntity = null;
    const vx = Math.sin(player.yaw) * forwardInput * moveSpeed;
    const vz = Math.cos(player.yaw) * forwardInput * moveSpeed;
    const stepped = moveWithCollision(player.pos.x, player.pos.z, vx * dt, vz * dt);
    player.pos.x = stepped.x;
    player.pos.z = stepped.z;
    if (!camState.isDragging) {
      camState.manualOffset *= Math.pow(0.15, dt);
    }
  } else if (player.targetEntity) {
    const tType = player.targetEntity.type;
    let targetVec = null;
    let stopDist = 2.8;

    if (tType === 'monster') {
      const m = player.targetEntity.ref;
      if (m.dead) {
        player.targetEntity = null;
      } else {
        targetVec = m.pos;
        stopDist = (STATE.combatStyle === 'rapid' || STATE.combatStyle === 'ranged' || STATE.combatStyle === 'magic') ? 13.5 : 2.9;
      }
    } else if (tType === 'resource') {
      const r = player.targetEntity.ref;
      if (r.depleted) {
        player.targetEntity = null;
      } else {
        targetVec = r.pos;
        stopDist = 3.1;
      }
    } else if (tType === 'interactive') {
      targetVec = player.targetEntity.pos;
      stopDist = 3.5;
    }

    if (targetVec) {
      const dx = targetVec.x - player.pos.x;
      const dz = targetVec.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      const desiredYaw = Math.atan2(dx, dz);
      player.yaw = lerpAngle(player.yaw, desiredYaw, Math.min(1, dt * 10));

      if (dist > stopDist) {
        manualMoving = true;
        const stepped = moveWithCollision(player.pos.x, player.pos.z, (dx / dist) * moveSpeed * dt, (dz / dist) * moveSpeed * dt);
        player.pos.x = stepped.x;
        player.pos.z = stepped.z;
        if (!camState.isDragging) camState.manualOffset *= Math.pow(0.25, dt);
      } else {
        if (tType === 'interactive') {
          const act = player.targetEntity.ref.action;
          player.targetEntity = null;
          if (act === 'shop') openShopModal('all');
          else if (act === 'bank') openBankModal();
          else if (act === 'forge') openSmithingModal();
          else if (act === 'worldmap') openWorldMapModal();
          else if (act === 'altar') {
            STATE.prayerPts = STATE.maxPrayerPts;
            STATE.hp = STATE.maxHp;
            SFX.prayer();
            spawnLevelUpFireworks(0x38bdf8);
            addChatMessage('You pray at the sacred Altar. Your Prayer points and Hitpoints are fully restored!', 'skill');
            updateAllUI();
          }
        } else if (player.actionCooldown <= 0) {
          if (tType === 'monster') {
            performPlayerAttack(player.targetEntity.ref);
            player.actionCooldown = TICK_SEC;
          } else if (tType === 'resource') {
            performResourceGather(player.targetEntity.ref);
            player.actionCooldown = TICK_SEC;
          }
        }
      }
    }
  } else if (player.targetPos) {
    const dx = player.targetPos.x - player.pos.x;
    const dz = player.targetPos.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.45) {
      manualMoving = true;
      const desiredYaw = Math.atan2(dx, dz);
      player.yaw = lerpAngle(player.yaw, desiredYaw, Math.min(1, dt * 10));
      const stepped = moveWithCollision(player.pos.x, player.pos.z, (dx / dist) * moveSpeed * dt, (dz / dist) * moveSpeed * dt);
      player.pos.x = stepped.x;
      player.pos.z = stepped.z;
      if (!camState.isDragging) camState.manualOffset *= Math.pow(0.25, dt);
    } else {
      player.targetPos = null;
    }
  }

  if (player.actionCooldown > 0) player.actionCooldown -= dt;

  const groundY = Math.max(-0.25, getTerrainHeight(player.pos.x, player.pos.z));
  if (!player.isGrounded) {
    player.pos.y += player.jumpVel * dt;
    player.jumpVel -= 20.0 * dt;
    if (player.pos.y <= groundY) {
      player.pos.y = groundY;
      player.isGrounded = true;
      player.jumpVel = 0;
    }
  } else {
    player.pos.y = groundY;
  }

  player.isMoving = manualMoving;
  player.meshGroup.position.copy(player.pos);
  player.meshGroup.rotation.y = player.yaw + Math.PI;

  if (player.isMoving) {
    player.animTime += dt * 11;
    const swing = Math.sin(player.animTime) * 0.65;
    player.parts.leftLegPivot.rotation.x = swing;
    player.parts.rightLegPivot.rotation.x = -swing;
    player.parts.leftArmPivot.rotation.x = -swing * 0.6;
    if (player.attackAnim <= 0) {
      player.parts.rightArmPivot.rotation.x = swing * 0.6;
    }
    if (player.parts.capeMesh) {
      player.parts.capeMesh.rotation.x = 0.28 + Math.sin(player.animTime * 2) * 0.12;
    }
  } else {
    player.animTime += dt * 2.2;
    const breath = Math.sin(player.animTime) * 0.04;
    player.parts.leftLegPivot.rotation.x *= 0.85;
    player.parts.rightLegPivot.rotation.x *= 0.85;
    player.parts.leftArmPivot.rotation.x = breath;
    if (player.attackAnim <= 0) {
      player.parts.rightArmPivot.rotation.x = -breath;
    }
    if (player.parts.capeMesh) {
      player.parts.capeMesh.rotation.x = 0.08 + breath * 0.5;
    }
  }

  if (player.attackAnim > 0) {
    player.attackAnim = Math.max(0, player.attackAnim - dt * 3.6);
    const slashAngle = Math.sin(player.attackAnim * Math.PI) * 1.65;
    player.parts.rightArmPivot.rotation.x = -slashAngle;
  }

  if (player.spinAnim > 0) {
    player.spinAnim = Math.max(0, player.spinAnim - dt * 2.4);
    player.meshGroup.rotation.y += (1 - player.spinAnim) * Math.PI * 4;
    player.parts.spinRing.material.opacity = player.spinAnim * 0.85;
    player.parts.spinRing.scale.setScalar(0.8 + (1 - player.spinAnim) * 0.9);
  } else if (player.parts.spinRing) {
    player.parts.spinRing.material.opacity = 0;
  }

  if (clickMarkerMesh && clickMarkerMesh.userData.life > 0) {
    clickMarkerMesh.userData.life = Math.max(0, clickMarkerMesh.userData.life - dt * 1.4);
    const life = clickMarkerMesh.userData.life;
    clickMarkerMesh.scale.setScalar(1 + (1 - life) * 0.35);
    clickMarkerMesh.traverse(obj => {
      if (obj.material && obj.material.transparent) obj.material.opacity = life;
    });
  }

  // Smooth Behind-Character Chase Camera
  const desiredCamYaw = player.yaw + camState.manualOffset;
  camState.yaw = lerpAngle(camState.yaw, desiredCamYaw, Math.min(1, dt * 8.5));

  const horizDist = Math.cos(camState.pitch) * camState.distance;
  const vertDist  = Math.sin(camState.pitch) * camState.distance;
  const camTargetX = player.pos.x - Math.sin(camState.yaw) * horizDist;
  const camTargetZ = player.pos.z - Math.cos(camState.yaw) * horizDist;
  const terrainUnderCam = getTerrainHeight(camTargetX, camTargetZ);
  const camTargetY = Math.max(terrainUnderCam + 1.2, player.pos.y + 1.85 + vertDist);

  camera.position.lerp(new THREE.Vector3(camTargetX, camTargetY, camTargetZ), Math.min(1, dt * 12));
  const lookTarget = new THREE.Vector3(player.pos.x, player.pos.y + 1.85, player.pos.z);
  camState.currentLookAt.lerp(lookTarget, Math.min(1, dt * 14));
  camera.lookAt(camState.currentLookAt);

  sunLight.position.set(player.pos.x + 38, player.pos.y + 58, player.pos.z + 28);
  sunLight.target.position.copy(player.pos);
  sunLight.target.updateMatrixWorld();

  // Monsters Update
  monstersList.forEach(m => {
    if (m.dead) {
      m.respawnTimer -= dt;
      if (m.respawnTimer <= 0) {
        m.dead = false;
        m.hp = m.maxHp;
        m.inCombatWithPlayer = false;
        m.pos.copy(m.spawnPos);
        m.rig.group.visible = true;
      }
      return;
    }

    if (m.rig.lWing && m.rig.rWing) {
      const flap = Math.sin(now * 0.006) * 0.35;
      m.rig.lWing.rotation.z = 0.22 + flap;
      m.rig.rWing.rotation.z = -0.22 - flap;
    }

    if (m.inCombatWithPlayer) {
      const dx = player.pos.x - m.pos.x;
      const dz = player.pos.z - m.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 26) {
        m.inCombatWithPlayer = false;
      } else {
        m.rig.group.rotation.y = Math.atan2(dx, dz) + Math.PI;
        const atkRange = (m.def.style === 'magic' || m.def.style === 'ranged') ? 11.0 : 2.9;
        if (dist > atkRange) {
          const stepped = moveWithCollision(m.pos.x, m.pos.z, (dx / dist) * 5.2 * dt, (dz / dist) * 5.2 * dt);
          m.pos.x = stepped.x;
          m.pos.z = stepped.z;
          m.pos.y = getTerrainHeight(m.pos.x, m.pos.z);
          if (m.rig.leftLegPivot) {
            const s = Math.sin(now * 0.01) * 0.5;
            m.rig.leftLegPivot.rotation.x = s;
            m.rig.rightLegPivot.rotation.x = -s;
          }
        } else {
          m.attackCooldown -= dt;
          if (m.attackCooldown <= 0) {
            performMonsterRetaliation(m);
            m.attackCooldown = 1.65;
          }
        }
      }
    } else {
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0) {
        m.wanderTimer = 2.5 + Math.random() * 4;
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 4.5;
        m.wanderTarget = new THREE.Vector3(m.spawnPos.x + Math.cos(ang) * rad, 0, m.spawnPos.z + Math.sin(ang) * rad);
      }
      if (m.wanderTarget) {
        const dx = m.wanderTarget.x - m.pos.x;
        const dz = m.wanderTarget.z - m.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.3) {
          m.rig.group.rotation.y = Math.atan2(dx, dz) + Math.PI;
          const stepped = moveWithCollision(m.pos.x, m.pos.z, (dx / dist) * 1.8 * dt, (dz / dist) * 1.8 * dt);
          m.pos.x = stepped.x;
          m.pos.z = stepped.z;
          m.pos.y = getTerrainHeight(m.pos.x, m.pos.z);
          if (m.rig.leftLegPivot) {
            const s = Math.sin(now * 0.007) * 0.35;
            m.rig.leftLegPivot.rotation.x = s;
            m.rig.rightLegPivot.rotation.x = -s;
          }
        }
      }
    }
  });

  resourceNodesList.forEach(r => {
    if (r.depleted) {
      r.respawnTimer -= dt;
      if (r.respawnTimer <= 0) {
        r.depleted = false;
        r.visualMesh.visible = true;
        r.depletedMesh.visible = false;
      }
    }
  });

  for (let i = projectilesList.length - 1; i >= 0; i--) {
    const p = projectilesList[i];
    p.progress += p.speed * dt;
    if (p.progress >= 1.0) {
      scene.remove(p.mesh);
      if (p.onImpact) p.onImpact();
      projectilesList.splice(i, 1);
    } else {
      p.mesh.position.lerpVectors(p.start, p.end, p.progress);
      p.mesh.position.y += Math.sin(p.progress * Math.PI) * 1.4;
    }
  }

  swayingFoliage.forEach(item => {
    if (item.rotY) item.mesh.rotation.z += dt * item.speed;
  });

  if (now - lastAutoSaveTime > 2000) {
    lastAutoSaveTime = now;
    saveGameState();
  }

  checkRegionChange();
  labelTick += dt;
  miniTick += dt;
  if (labelTick >= 0.1 || Math.hypot(player.pos.x - lastLabelX, player.pos.z - lastLabelZ) > 0.4) {
    labelTick = 0;
    lastLabelX = player.pos.x;
    lastLabelZ = player.pos.z;
    updateFloatingWorldLabels();
    const found = discoverShrines(player.pos.x, player.pos.z, STATE.shrines);
    if (found.unlocked.length) {
      STATE.shrines = found.shrines;
      found.unlocked.forEach(id => {
        const reg = WORLD_REGIONS.find(r => r.id === id);
        addChatMessage('You discover the <b>' + (reg ? reg.name : id) + '</b> shrine.', 'region');
      });
    }
  }
  if (miniTick >= 0.12 || Math.abs(camState.yaw - lastMiniYaw) > 0.03) {
    miniTick = 0;
    lastMiniYaw = camState.yaw;
    renderMinimap();
  }
  const tickArc = document.getElementById('tick-arc');
  if (tickArc) tickArc.style.strokeDashoffset = String(88 * Math.max(0, Math.min(1, player.actionCooldown / TICK_SEC)));
  if (grassInstanced && grassInstanced.material && grassInstanced.material.uniforms) {
    grassInstanced.material.uniforms.uTime.value = elapsedSec;
    if (camera) grassInstanced.material.uniforms.uCam.value.copy(camera.position);
  }
  renderer.render(scene, camera);
}

let lastAutoSaveTime = 0;
let labelTick = 0;
let miniTick = 1;
let lastLabelX = 999;
let lastLabelZ = 999;
let lastMiniYaw = 999;
window.addEventListener('beforeunload', saveGameState);

function applyLoadedStateToHud() {
  ['accurate', 'aggressive', 'defensive', 'controlled', 'rapid', 'ranged', 'magic'].forEach(s => {
    const el = document.getElementById('style-' + s);
    if (el) el.classList.toggle('active', s === STATE.combatStyle);
  });
  const xpBtn = document.getElementById('xp-rate-btn');
  if (xpBtn) {
    xpBtn.textContent = STATE.xpMultiplier === 10 ? '10x League XP' : '1x Classic OSRS';
    xpBtn.classList.toggle('active', STATE.xpMultiplier === 10);
  }
  const savedTod = STATE.timeOfDay;
  STATE.timeOfDay = (savedTod + 2) % 3;
  cycleTimeOfDay();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}


function refreshCombatStyleLocks() {
  const weapon = equippedWeapon(STATE);
  const allowed = allowedStyles(weapon);
  ['accurate', 'aggressive', 'defensive', 'controlled', 'rapid', 'magic'].forEach(id => {
    const el = document.getElementById('style-' + id);
    if (!el) return;
    const on = STATE.combatStyle === id;
    el.classList.toggle('active', on);
    el.classList.toggle('style-locked', allowed.indexOf(id) === -1);
  });
}

function openBankModal() {
  closeModals();
  STATE.quests.openedBank = true;
  const modal = document.getElementById('bank-modal');
  if (modal) modal.classList.add('open');
  renderBankModal();
}

function openQuestsModal() {
  closeModals();
  const modal = document.getElementById('quest-modal');
  if (modal) modal.classList.add('open');
  renderQuests();
}

function openSettingsModal() {
  closeModals();
  syncSettingsButtons();
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('open');
}

function toggleAudio() {
  STATE.audioEnabled = !STATE.audioEnabled;
  syncSettingsButtons();
  addChatMessage(STATE.audioEnabled ? 'Audio on.' : 'Audio muted.', 'skill');
  saveGameState();
}

function showItemTooltip(ev, it) {
  const tip = document.getElementById('item-tooltip');
  if (!tip || !it) return;
  tip.innerHTML = itemCompareHtml(it);
  tip.style.display = 'block';
  moveItemTooltip(ev);
}

function moveItemTooltip(ev) {
  const tip = document.getElementById('item-tooltip');
  if (!tip) return;
  tip.style.left = Math.min(window.innerWidth - 260, ev.clientX + 14) + 'px';
  tip.style.top = Math.min(window.innerHeight - 120, ev.clientY + 14) + 'px';
}

function hideItemTooltip() {
  const tip = document.getElementById('item-tooltip');
  if (tip) tip.style.display = 'none';
}

function updateHoverTile(e) {
  if (!hoverTile || !terrainMesh || !camera) return;
  mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const hits = raycaster.intersectObject(terrainMesh, false);
  if (!hits.length) {
    hoverTile.visible = false;
    return;
  }
  const p = hits[0].point;
  const gx = Math.floor(p.x) + 0.5;
  const gz = Math.floor(p.z) + 0.5;
  hoverTile.visible = true;
  hoverTile.position.set(gx, getTerrainHeight(gx, gz) + 0.08, gz);
}

function wireBridge() {
  bridge.chat = (text, type) => addChatMessage(text, type || '');
  bridge.refresh = () => updateAllUI();
  bridge.close = () => closeModals();
  bridge.coin = () => SFX.coin();
  bridge.saveToast = () => manualSaveToast();
  bridge.reset = () => resetGameSave();
  bridge.cycleTime = () => cycleTimeOfDay();
  bridge.toggleXp = () => toggleXpMultiplier();
  bridge.toggleAudio = () => toggleAudio();
  bridge.teleportSpell = (regionId) => teleportToRegion(regionId);
  bridge.noteBank = () => { STATE.quests.openedBank = true; };
  bridge.noteQuest = () => {};
  window.setCombatStyle = setCombatStyle;
  window.closeModals = closeModals;
  window.switchTab = switchTab;
  window.craftRecipe = craftRecipe;
  window.openWorldMapModal = openWorldMapModal;
  window.openShopModal = openShopModal;
  window.openSmithingModal = openSmithingModal;
  window.openXpTableModal = openXpTableModal;
  window.openBankModal = openBankModal;
  window.openQuestsModal = openQuestsModal;
  window.openSettingsModal = openSettingsModal;
  window.toggleXpMultiplier = toggleXpMultiplier;
  window.cycleTimeOfDay = cycleTimeOfDay;
  window.toggleAudio = toggleAudio;
  window.resetGameSave = resetGameSave;
  window.manualSaveToast = manualSaveToast;
  window.sellInventoryItem = sellInventoryItem;
  window.buyShopItem = buyShopItem;
  window.buyShopPair = buyShopPair;
  window.sellAllLoot = sellAllLoot;
  window.unequipSlot = unequipSlot;
  window.toggleSpecialAttack = toggleSpecialAttack;
  window.togglePrayer = togglePrayer;
  window.handleSpellClick = handleSpellClick;
  window.teleportToRegion = teleportToRegion;
  window.resetCameraBehindPlayer = resetCameraBehindPlayer;
}

// ============================================================================
// 13. BOOTSTRAP GAME ON LOAD
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  wireBridge();
  initStaticSvgIcons();
  const hadSave = loadGameState();
  init3DEngine();
  applyLoadedStateToHud();
  updateAllUI();
  addChatMessage('Welcome to <b>Gielinor Hero</b>.', 'lvlup');
  if (hadSave) {
    addChatMessage('Restored your saved progress & world state from <b>localStorage</b>.', 'skill');
  } else {
    addChatMessage('Use <b>WASD / Arrows</b> or <b>Click</b> anywhere to move, fight monsters, chop trees, mine ores, or fish.', 'skill');
  }
  addChatMessage('The courtyard holds the <b>Bank booth</b>, the <b>General Store</b>, and the <b>Anvil</b>. Walk up to use them. Press <b>F1–F6</b> to switch panels and <b>Esc</b> to close a window.', 'loot');
  const startReg = WORLD_REGIONS.find(r => r.id === STATE.currentRegion) || WORLD_REGIONS[0];
  triggerRegionBanner(startReg);
  requestAnimationFrame(gameLoop);
});
