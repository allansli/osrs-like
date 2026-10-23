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
import {
  assignSlayerTask,
  attackOptionLabel,
  claimQuest,
  combatLevel,
  dharokMultiplier,
  gatherVerb,
  isBossLoot,
  isRareLoot,
  monsterThreatColor,
  noteGather,
  registerKill,
  resolveDragonfire,
  weaponSpecial
} from '../state/adventure';
import { moveWithCollision, isWalkable, isDeepWater } from '../state/collision';
import { discoverShrines } from '../state/shrines';
import { addCartoonOutline, facetMaterial, grassMaterial, PALETTE } from './materials';
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
  return combatLevel(STATE);
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
  showBanner('Skill Level Up', `Congratulations, your ${skillName} level is now ${newLvl}!`);
}

function showBanner(kicker, message) {
  const banner = document.getElementById('levelup-banner');
  const text = document.getElementById('levelup-text');
  const head = document.getElementById('levelup-kicker');
  if (!banner || !text) return;
  if (head) head.textContent = kicker;
  text.textContent = message;
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
  const spec = weaponSpecial(STATE.equipment.weapon);
  if (STATE.specEnergy < spec.cost && !STATE.specArmed) {
    addChatMessage(`You need at least ${spec.cost}% Special Attack energy for <b>${spec.name}</b>!`, 'combat');
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
  const spec = weaponSpecial(STATE.equipment.weapon);
  if (specBtn) {
    specBtn.classList.toggle('armed', STATE.specArmed);
    specBtn.textContent = STATE.specArmed
      ? `SPECIAL ARMED — ${spec.name} (${Math.floor(STATE.specEnergy)}%)`
      : `SPECIAL: ${spec.name} (${Math.floor(STATE.specEnergy)}% · Cost ${spec.cost}%)`;
  }
  const slayerPill = document.getElementById('slayer-pill');
  const slayerTask = STATE.quests.slayer;
  if (slayerPill) {
    if (slayerTask && slayerTask.remaining > 0) {
      slayerPill.hidden = false;
      slayerPill.textContent = `Slayer: ${slayerTask.name} ${slayerTask.remaining}/${slayerTask.total}`;
    } else {
      slayerPill.hidden = true;
    }
  }
  const titleEl = document.getElementById('hero-title');
  if (titleEl) {
    if (STATE.quests.title) {
      titleEl.hidden = false;
      titleEl.textContent = STATE.quests.title;
    } else {
      titleEl.hidden = true;
    }
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
  hideHoverTooltip();
  hideItemTooltip();
  hideContextMenu();
}

function hideHoverTooltip() {
  const tooltip = document.getElementById('hover-tooltip');
  if (tooltip) tooltip.style.display = 'none';
  document.body.style.cursor = 'default';
}

function openModal(id) {
  closeModals();
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
  hideHoverTooltip();
  return modal;
}

function openShopModal(filter = 'all') {
  STATE.shopFilter = filter;
  openModal('shop-modal');
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
  openModal('smithing-modal');
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
  openModal('xptable-modal');
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
  openModal('worldmap-modal');
  renderWorldMap(null);
}

function locateQuestRegion(regionId) {
  openModal('worldmap-modal');
  renderWorldMap(regionId);
}

function claimQuestReward(questId) {
  const result = claimQuest(STATE, questId);
  if (!result.ok) {
    addChatMessage(result.reason || 'You cannot claim that yet.', 'combat');
    return;
  }
  SFX.coin();
  SFX.levelUp();
  addChatMessage(result.chat || 'Quest complete.', 'lvlup');
  showBanner('Quest Reward', result.banner || 'Reward claimed');
  spawnLevelUpFireworks(0xfde047);
  updateAllUI();
}

function requestSlayerTask() {
  const current = STATE.quests.slayer;
  if (current && current.remaining > 0) {
    addChatMessage(`Your Slayer task is <b>${current.remaining} ${current.name}</b>.`, 'skill');
    updateAllUI();
    return;
  }
  const result = assignSlayerTask(STATE, getCombatLevel());
  if (!result.ok) addChatMessage(result.reason || 'Vannaka has nothing new for you.', 'combat');
  else if (result.task) {
    addChatMessage(`Vannaka assigns you to defeat <b>${result.task.total} ${result.task.name}</b>.`, 'lvlup');
    SFX.prayer();
  }
  updateAllUI();
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
const vfxList = [];
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
  const dirt = new THREE.Color(PALETTE.dirt);
  const grass = [PALETTE.sageShade, PALETTE.sage, PALETTE.sageLit].map((hex) => new THREE.Color(hex));
  if (h < -0.05) return dirt;
  if (z > -22 && z < 8 && x > -8 && x < 82 && Math.abs(z - (-x * 0.22)) < 2.6) return dirt;
  if (Math.hypot(x - 78, z + 20) < 18) return dirt;
  if (x > 40 && z > 36) return new THREE.Color('#e7c27a');
  if (x < -40 && z > 36) return new THREE.Color(h > 3.1 ? '#f97316' : '#78716c');
  if (x < -40 && z < 0) return new THREE.Color('#16a34a');
  const band = Math.abs(Math.floor(x / 7) + Math.floor(z / 7) * 2) % 3;
  return grass[band];
}

function init3DEngine() {
  const container = document.getElementById('game-canvas-container');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xbae6fd, 0.00145);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 360);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.id = 'game-canvas';
  container.appendChild(renderer.domElement);

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
    uTopColor: { value: new THREE.Color(PALETTE.skyZenith) },
    uMidColor: { value: new THREE.Color(PALETTE.skyMid) },
    uHorizonColor: { value: new THREE.Color(PALETTE.skyHorizon) }
  };

  const skyGeo = new THREE.SphereGeometry(290, 24, 16);
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
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.22, h));
        col = mix(col, uTopColor, smoothstep(0.22, 0.72, h));
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
    skyUniforms.uTopColor.value.setHex(0x3b82f6);
    skyUniforms.uMidColor.value.setHex(0xbae6fd);
    skyUniforms.uHorizonColor.value.setHex(0xfef3c7);
    scene.fog.color.setHex(0xbae6fd);
    scene.fog.density = 0.00145;
    if (btn) btn.textContent = 'Golden Hour';
  } else if (STATE.timeOfDay === 1) {
    skyUniforms.uTopColor.value.setHex(0x2563eb);
    skyUniforms.uMidColor.value.setHex(0x7dd3fc);
    skyUniforms.uHorizonColor.value.setHex(0xe0f2fe);
    scene.fog.color.setHex(0xbae6fd);
    scene.fog.density = 0.0012;
    if (btn) btn.textContent = 'High Noon';
  } else {
    skyUniforms.uTopColor.value.setHex(0x1e1b4b);
    skyUniforms.uMidColor.value.setHex(0x312e81);
    skyUniforms.uHorizonColor.value.setHex(0x1e293b);
    scene.fog.color.setHex(0x1e293b);
    scene.fog.density = 0.0022;
    if (btn) btn.textContent = 'Starry Night';
  }
}

function buildTerrainAndWater() {
  const size = 260;
  const segs = 80;
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

  const mat = facetMaterial({ vertexColors: true });
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  terrainMesh.userData = { type: 'ground' };
  scene.add(terrainMesh);
  worldInteractiveObjects.push(terrainMesh);

  // Custom GLSL Animated Water Shader with Specular Sun Glint & Ripples
  waterUniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(PALETTE.water) },
    uShallowColor: { value: new THREE.Color(PALETTE.foam) }
  };

  const waterGeo = new THREE.PlaneGeometry(size, size, 24, 24);
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
        float w = sin(p.x * 0.22 + uTime * 1.2) * 0.02;
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
        float rip = sin(vWorldPos.x * 0.45 + uTime * 0.7) * cos(vWorldPos.z * 0.32);
        float foam = step(0.62, rip);
        vec3 col = mix(uDeepColor, uShallowColor, foam);
        gl_FragColor = vec4(col, 0.92);
      }
    `
  });
  waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = -0.34;
  scene.add(waterMesh);

  // Arched Wooden & Stone Footbridge over the River at (28, 0)
  buildRiverBridge(28, 0);

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.09, 0);
  bladeShape.lineTo(0, 0.85);
  bladeShape.lineTo(0.09, 0);
  bladeShape.closePath();
  const bladeGeo = new THREE.ShapeGeometry(bladeShape, 1);
  const bladeMat = grassMaterial();
  const grassCount = 900;
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
  const woodMat = facetMaterial({ color: 0x92400e });
  const stoneMat = facetMaterial({ color: 0xe5e7eb });

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
  addCartoonOutline(grp, 0.038);
}

function buildBiomeLandmarks() {
  const sand = facetMaterial({ color: 0xe7c07a });
  const palm = facetMaterial({ color: 0x4ade80 });
  const bark = facetMaterial({ color: 0x92400e });
  const stone = facetMaterial({ color: 0xe5e7eb });
  const gold = facetMaterial({ color: 0xfacc15 });
  const obsidian = facetMaterial({ color: 0x1c1917 });
  const lava = facetMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.85 });

  function place(builder, x, z) {
    const grp = builder();
    grp.position.set(x, getTerrainHeight(x, z), z);
    addCartoonOutline(grp, 0.038);
    scene.add(grp);
  }

  function sandstoneArch() {
    const grp = new THREE.Group();
    const left = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 4.2, 12), sand);
    left.position.set(-1.6, 2.1, 0);
    const right = left.clone();
    right.position.x = 1.6;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1.1), sand);
    lintel.position.y = 4.3;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), gold);
    cap.position.y = 4.9;
    [left, right, lintel, cap].forEach((mesh) => { mesh.castShadow = true; grp.add(mesh); });
    return grp;
  }

  function palmTree() {
    const grp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 3.4, 10), bark);
    trunk.position.y = 1.7;
    trunk.rotation.z = 0.18;
    grp.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), palm);
      frond.scale.set(1.8, 0.28, 0.7);
      const ang = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(ang) * 0.85, 3.35, Math.sin(ang) * 0.85);
      frond.lookAt(0, 2.4, 0);
      grp.add(frond);
    }
    const dates = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), gold);
    dates.position.y = 2.7;
    grp.add(dates);
    return grp;
  }

  function plazaPillar() {
    const grp = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 5.2, 14), stone);
    shaft.position.y = 2.6;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.86, 0.4, 14), stone);
    foot.position.y = 0.2;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.35, 1.15), gold);
    crown.position.y = 5.35;
    [shaft, foot, crown].forEach((mesh) => { mesh.castShadow = true; grp.add(mesh); });
    return grp;
  }

  function mysticMushroom(color) {
    const grp = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.3, 12), facetMaterial({ color: 0xf8fafc }));
    stem.position.y = 0.65;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      facetMaterial({ color, emissive: color, emissiveIntensity: 0.45 })
    );
    cap.position.y = 1.35;
    grp.add(stem, cap);
    return grp;
  }

  function woodsLantern() {
    const grp = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), bark);
    post.position.y = 1.1;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      facetMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 0.8 })
    );
    lamp.position.y = 2.3;
    grp.add(post, lamp);
    return grp;
  }

  function obsidianSpire() {
    const grp = new THREE.Group();
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.85, 6.4, 7), obsidian);
    spire.position.y = 3.2;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lava);
    glow.position.y = 5.6;
    grp.add(spire, glow);
    return grp;
  }

  function lavaFissure() {
    const grp = new THREE.Group();
    const crack = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.35), lava);
    crack.position.y = 0.08;
    crack.rotation.y = 0.4;
    const crackB = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.22), lava);
    crackB.position.set(0.4, 0.09, 0.45);
    crackB.rotation.y = -0.8;
    grp.add(crack, crackB);
    return grp;
  }

  place(sandstoneArch, 80, 82);
  place(palmTree, 58, 58);
  place(palmTree, 74, 52);
  place(plazaPillar, 70, -16);
  place(plazaPillar, 86, -24);
  place(plazaPillar, 78, -30);
  place(() => mysticMushroom(0xa855f7), -66, -22);
  place(() => mysticMushroom(0x22d3ee), -84, -26);
  place(woodsLantern, -72, -38);
  place(woodsLantern, -90, -34);
  place(obsidianSpire, -58, 62);
  place(obsidianSpire, -66, 90);
  place(lavaFissure, -74, 70);
}

function buildAllCitiesAndLandmarks() {
  WORLD_REGIONS.forEach(reg => {
    const sx = reg.x;
    const sz = reg.z - 6;
    const sy = getTerrainHeight(sx, sz);
    const shrineGroup = new THREE.Group();
    shrineGroup.position.set(sx, sy, sz);
    const stone = facetMaterial({ color: 0xe5e7eb });
    const slate = facetMaterial({ color: 0x475569 });
    const stepA = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 2.6), slate);
    stepA.position.y = 0.14;
    const stepB = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.26, 1.85), stone);
    stepB.position.y = 0.4;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.58, 2.15, 14), stone);
    pillar.position.y = 1.58;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.78), slate);
    cap.position.y = 2.72;
    const rune = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      facetMaterial({ color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 0.55, flatShading: true })
    );
    rune.position.y = 3.15;
    [stepA, stepB, pillar, cap, rune].forEach((mesh) => {
      mesh.castShadow = true;
      shrineGroup.add(mesh);
    });

    const uData = {
      type: 'interactive',
      action: 'worldmap',
      name: `${reg.name} Shrine (Teleport)`,
      interactRadius: 4.2
    };
    shrineGroup.userData = uData;
    pillar.userData = uData;
    rune.userData = uData;
    worldInteractiveObjects.push(pillar, rune);
    addCartoonOutline(shrineGroup, 0.038);
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
  createSlayerMaster(5.5, 8.5);
  buildBiomeLandmarks();
}

function createCastleStructure(cx, cz) {
  const grp = new THREE.Group();
  const y = getTerrainHeight(cx, cz);
  grp.position.set(cx, y, cz);
  const stoneMat = facetMaterial({ color: 0xe5e7eb });
  const roofMat = facetMaterial({ color: 0x475569 });
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
  addCartoonOutline(grp, 0.03);
  scene.add(grp);
}

function createPrayerAltar(x, z, name) {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);

  const marbleMat = facetMaterial({ color: 0xf8fafc });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 1.15), marbleMat);
  base.position.y = 0.42;
  base.castShadow = true;
  grp.add(base);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 1.4), facetMaterial({ color: 0xe5e7eb }));
  slab.position.y = 0.92;
  grp.add(slab);
  const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.08, 0.12), facetMaterial({ color: 0xfacc15 }));
  goldTrim.position.set(0, 0.7, 0.58);
  grp.add(goldTrim);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    facetMaterial({ color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 0.45, flatShading: true })
  );
  crystal.position.y = 1.45;
  grp.add(crystal);

  const uData = { type: 'interactive', action: 'altar', name, interactRadius: 4.0 };
  grp.userData = uData;
  base.userData = uData;
  crystal.userData = uData;
  worldInteractiveObjects.push(base, crystal);
  addCartoonOutline(grp, 0.038);
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

  const furnace = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 2.4, 1.5),
    facetMaterial({ color: 0x92400e })
  );
  furnace.position.set(1.3, 1.2, 0);
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
  addCartoonOutline(grp, 0.038);
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
  sign.userData.noOutline = true;
  grp.add(sign);
  const rig = buildHumanoidRig(0x1e3a8a, 0xfacc15, 0x334155, 1);
  rig.group.position.set(0, 0, -0.2);
  grp.add(rig.group);
  const uData = { type: 'interactive', action: 'bank', name: 'Lumbridge Bank', interactRadius: 4.2 };
  grp.userData = uData;
  rig.hitbox.userData = uData;
  counter.userData = uData;
  worldInteractiveObjects.push(rig.hitbox, counter);
  addCartoonOutline(counter, 0.038);
  addCartoonOutline(lintel, 0.038);
  scene.add(grp);
  npcList.push({ pos: grp.position, name: 'Lumbridge Bank', color: '#fde047', yOffset: 2.6 });
}

function createSlayerMaster(x, z) {
  const y = getTerrainHeight(x, z);
  const rig = buildHumanoidRig(0x4c1d95, 0x1c1917, 0x111827, 1.05);
  rig.group.position.set(x, y, z);
  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 1.05),
    facetMaterial({ color: 0x4c1d95, side: THREE.DoubleSide })
  );
  cape.position.set(0, 1.2, 0.24);
  rig.group.add(cape);
  addCartoonOutline(cape, 0.022);
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), facetMaterial({ color: 0xfacc15 }));
  sword.position.set(0, -0.72, 0.02);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.1), facetMaterial({ color: 0xfde047 }));
  guard.position.set(0, -0.28, 0.02);
  rig.rightArmPivot.add(sword, guard);
  addCartoonOutline(sword, 0.022);
  const uData = { type: 'interactive', action: 'slayer', name: 'Slayer Master Vannaka', interactRadius: 4.0 };
  rig.group.userData = uData;
  rig.hitbox.userData = uData;
  worldInteractiveObjects.push(rig.hitbox);
  scene.add(rig.group);
  npcList.push({ pos: rig.group.position, name: 'Slayer Master Vannaka', color: '#c084fc', yOffset: 2.9 });
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

  const skinMat = facetMaterial({ color: 0xffd7b5 });
  const tunicMat = facetMaterial({ color: tunicHex });
  const legsMat = facetMaterial({ color: legsHex });
  const hairMat = facetMaterial({ color: hairHex });
  const bootMat = facetMaterial({ color: 0x78350f });
  const gloveMat = facetMaterial({ color: 0xf6c7a1 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.88, 16), tunicMat);
  torso.position.y = 1.2;
  torso.castShadow = true;
  group.add(torso);

  const collar = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), tunicMat);
  collar.position.y = 0.36;
  collar.castShadow = true;
  torso.add(collar);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.92, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 16), skinMat);
  head.scale.set(1.0, 1.06, 0.96);
  head.castShadow = true;
  headGroup.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.268, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  hairCap.position.y = 0.02;
  hairCap.rotation.x = 0.42;
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1917 });
  [-0.09, 0.09].forEach((ox) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), eyeMat);
    eye.scale.set(1.15, 0.78, 0.42);
    eye.position.set(ox, 0.02, -0.232);
    eye.userData.noOutline = true;
    headGroup.add(eye);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), skinMat);
  nose.scale.set(0.85, 0.7, 0.9);
  nose.position.set(0, -0.045, -0.248);
  nose.userData.noOutline = true;
  headGroup.add(nose);
  group.add(headGroup);

  function createSmoothArm(isLeft) {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -0.42 : 0.42, 1.56, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.125, 0.58, 14), tunicMat);
    arm.position.y = -0.3;
    arm.castShadow = true;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), gloveMat);
    hand.position.y = -0.66;
    hand.castShadow = true;
    pivot.add(hand);
    return pivot;
  }

  const leftArmPivot = createSmoothArm(true);
  const rightArmPivot = createSmoothArm(false);
  group.add(leftArmPivot, rightArmPivot);

  function createSmoothLeg(isLeft) {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -0.16 : 0.16, 0.74, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.52, 14), legsMat);
    leg.position.y = -0.26;
    leg.castShadow = true;
    pivot.add(leg);
    const boot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), bootMat);
    boot.scale.set(0.95, 0.72, 1.45);
    boot.position.set(0, -0.56, 0.02);
    boot.castShadow = true;
    pivot.add(boot);
    return pivot;
  }

  const leftLegPivot = createSmoothLeg(true);
  const rightLegPivot = createSmoothLeg(false);
  group.add(leftLegPivot, rightLegPivot);

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.88, 2.5, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 1.25;
  hitbox.userData.isCollider = true;
  group.add(hitbox);
  addCartoonOutline(group, 0.022);

  return {
    group,
    torso,
    headGroup,
    hairCap,
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

function syncWhipGeometry(rig, stretch) {
  if (!rig) return;
  const pts = rig.rest.map((p, i) => {
    const reach = i / Math.max(1, rig.rest.length - 1);
    const wave = Math.sin(stretch * Math.PI + i * 0.85) * 0.18 * reach * stretch;
    return new THREE.Vector3(
      p.x + wave,
      p.y + stretch * reach * 0.12,
      p.z - stretch * reach * 1.2
    );
  });
  const curve = new THREE.CatmullRomCurve3(pts);
  if (rig.tube) {
    rig.tube.geometry.dispose();
    rig.tube.geometry = new THREE.TubeGeometry(curve, 22, 0.036, 8, false);
  }
  rig.nodes.forEach((node, i) => {
    node.position.copy(curve.getPoint(i / Math.max(1, rig.nodes.length - 1)));
  });
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
  player.parts.whipRig = null;

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
      const bowGeo = new THREE.TubeGeometry(bowCurve, 18, 0.04, 8, false);
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
      strMesh.userData.noOutline = true;
      strMesh.position.set(0, 0, 0.16);
      wepGrp.add(strMesh);
    } else if (it.style === 'magic') {
      // Sculpted Staff with Orbiting Ring & Glowing Orb
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.035, 1.75, 14),
        facetMaterial({ color: 0x5c3a21, roughness: 0.6 })
      );
      shaft.rotation.x = Math.PI / 2.8;
      shaft.castShadow = true;
      wepGrp.add(shaft);

      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 16, 12),
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
      const rest = [
        new THREE.Vector3(0, 0.02, 0.02),
        new THREE.Vector3(0.07, 0.26, -0.2),
        new THREE.Vector3(-0.09, 0.46, -0.46),
        new THREE.Vector3(0.1, 0.34, -0.76),
        new THREE.Vector3(-0.02, 0.14, -1.05)
      ];
      const tubeMat = facetMaterial({ color: 0x1c1917, emissive: 0x7f1d1d, emissiveIntensity: 0.25 });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rest), 22, 0.036, 8, false), tubeMat);
      tube.castShadow = true;
      wepGrp.add(tube);
      const nodes = rest.map((pt, i) => {
        const hot = i % 2 === 1;
        const node = new THREE.Mesh(
          new THREE.SphereGeometry(hot ? 0.055 : 0.042, 10, 8),
          facetMaterial({
            color: hot ? 0xef4444 : 0x292524,
            emissive: hot ? 0xdc2626 : 0x000000,
            emissiveIntensity: hot ? 0.85 : 0
          })
        );
        node.position.copy(pt);
        node.castShadow = true;
        wepGrp.add(node);
        return node;
      });
      player.parts.whipRig = { tube, nodes, rest: rest.map(p => p.clone()), wasLashing: false };
      syncWhipGeometry(player.parts.whipRig, 0);
    } else {
      const bladeShape = new THREE.Shape();
      const isScim = it.iconKind === 'scimitar';
      const isGreat = it.iconKind === 'greatsword';
      const len = isGreat ? 1.48 : isScim ? 1.12 : 1.2;
      const sacred = it.id === 'master_sword' || it.id === 'deity_sword';
      const dragon = it.id === 'dragon_scimitar';
      if (isScim) {
        bladeShape.moveTo(-0.02, 0);
        bladeShape.quadraticCurveTo(-0.18, len * 0.42, -0.04, len);
        bladeShape.lineTo(0.015, len - 0.04);
        bladeShape.quadraticCurveTo(0.05, len * 0.48, 0.055, 0);
      } else if (isGreat) {
        bladeShape.moveTo(-0.07, 0);
        bladeShape.lineTo(-0.085, len * 0.78);
        bladeShape.lineTo(0, len);
        bladeShape.lineTo(0.085, len * 0.78);
        bladeShape.lineTo(0.07, 0);
      } else {
        bladeShape.moveTo(-0.045, 0);
        bladeShape.lineTo(-0.05, len * 0.84);
        bladeShape.lineTo(0, len);
        bladeShape.lineTo(0.05, len * 0.84);
        bladeShape.lineTo(0.045, 0);
      }
      bladeShape.closePath();

      const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
        depth: isGreat ? 0.08 : 0.055,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.01,
        bevelSegments: 2,
        curveSegments: isScim ? 12 : 4
      });
      bladeGeo.center();
      const bladeMat = facetMaterial({
        color: dragon ? 0xdc2626 : (it.color || 0xd1d5db),
        emissive: dragon ? 0x7f1d1d : (sacred ? 0x38bdf8 : 0x000000),
        emissiveIntensity: dragon ? 0.4 : (sacred ? 0.5 : 0)
      });
      const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
      bladeMesh.rotation.y = Math.PI / 2;
      bladeMesh.position.y = len * 0.46 + 0.1;
      bladeMesh.castShadow = true;
      wepGrp.add(bladeMesh);

      const guardMat = facetMaterial({
        color: dragon || isGreat ? (it.trim || 0xfde047) : (it.trim || 0xfacc15),
        emissive: sacred ? 0x1d4ed8 : 0x000000,
        emissiveIntensity: sacred ? 0.35 : 0
      });
      if (dragon || isGreat) {
        [-1, 1].forEach((side) => {
          const wing = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), guardMat);
          wing.scale.set(0.45, 1.15, 0.28);
          wing.position.set(0, 0.1, side * 0.16);
          wing.rotation.z = side * -0.7;
          wing.castShadow = true;
          wepGrp.add(wing);
        });
      } else {
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, isScim ? 0.34 : 0.4, 12), guardMat);
        guard.rotation.x = Math.PI / 2;
        guard.position.y = 0.08;
        guard.castShadow = true;
        wepGrp.add(guard);
      }

      const pommel = new THREE.Mesh(new THREE.SphereGeometry(isGreat ? 0.07 : 0.055, 12, 10), guardMat);
      pommel.position.y = -0.14;
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

    const shGeo = new THREE.ExtrudeGeometry(shShape, { depth: 0.06, bevelEnabled: false });
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
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.08, 0.04),
      facetMaterial({ color: it.trim || 0xfacc15 })
    );
    trim.position.set(0, 0.08, 0.05);
    shield.add(trim);

    lArm.add(shield);
    player.parts.shieldMesh = shield;
  }

  // 7. Smooth form-fitting helm. Hair stays tucked so it never clips the dome.
  const helmId = STATE.equipment.head;
  if (player.parts.hairCap) player.parts.hairCap.visible = !helmId;
  if (helmId && ITEMS[helmId]) {
    const it = ITEMS[helmId];
    const helmGrp = new THREE.Group();
    const helmMat = facetMaterial({ color: it.color || 0xb87333 });
    const helmDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.285, 18, 16, 0, Math.PI * 2, 0, Math.PI * 0.78),
      helmMat
    );
    helmDome.position.y = 0.02;
    helmDome.castShadow = true;
    helmGrp.add(helmDome);

    const brow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.288, 0.275, 0.18, 16, 1, true),
      facetMaterial({ color: it.trim || 0xfacc15 })
    );
    brow.position.y = -0.02;
    helmGrp.add(brow);

    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.29, 0.29, 0.06, 16, 1, true, Math.PI * 0.72, Math.PI * 0.56),
      new THREE.MeshBasicMaterial({ color: 0x111827, side: THREE.DoubleSide })
    );
    visor.position.y = 0.0;
    visor.userData.noOutline = true;
    helmGrp.add(visor);

    const plume = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      facetMaterial({ color: it.trim || 0xef4444 })
    );
    plume.scale.set(0.45, 1.35, 1.65);
    plume.position.set(0, 0.3, 0.04);
    plume.castShadow = true;
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
    cape.position.set(0, 0.02, 0.34);
    cape.castShadow = true;
    torso.add(cape);
    player.parts.capeMesh = cape;
  }
  if (player.meshGroup) addCartoonOutline(player.meshGroup, 0.022);
}

// Bespoke OSRS × Zelda monster silhouettes. Each species owns its anatomy.
// Walk / idle / attack still drive leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot.
// Winged rigs also expose lWing / rWing for the flap in the monster update.

function monsterPart(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function monsterPivot(x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  return pivot;
}

function monsterHitbox(radius, height, y) {
  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = y;
  hitbox.userData.isCollider = true;
  return hitbox;
}

function finishMonster(group, hitbox, parts) {
  group.add(hitbox);
  addCartoonOutline(group, 0.022);
  return { group, hitbox, ...parts };
}

function glowEye(parent, x, y, z, color, radius = 0.045) {
  const eye = monsterPart(
    parent,
    new THREE.SphereGeometry(radius, 10, 8),
    new THREE.MeshBasicMaterial({ color }),
    x, y, z
  );
  eye.userData.noOutline = true;
  return eye;
}

function paint(color, extra = {}) {
  return facetMaterial({ color, ...extra });
}

function addQuiver(parent, x, y, z, leatherHex, fletchHex) {
  const quiver = new THREE.Group();
  quiver.position.set(x, y, z);
  quiver.rotation.x = -0.55;
  monsterPart(quiver, new THREE.CylinderGeometry(0.09, 0.12, 0.46, 10), paint(leatherHex));
  for (let i = 0; i < 4; i++) {
    const shaft = monsterPart(
      quiver,
      new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6),
      paint(0xd6d3d1),
      (i - 1.5) * 0.04,
      0.28,
      0
    );
    monsterPart(shaft, new THREE.ConeGeometry(0.035, 0.09, 5), paint(fletchHex), 0, 0.22, 0);
  }
  parent.add(quiver);
  return quiver;
}

function addStrungBow(pivot, length, color, bend) {
  const bow = new THREE.Group();
  bow.position.set(0.04, -0.42, -0.18);
  const half = length * 0.5;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -half, 0.1),
    new THREE.Vector3(0, -half * 0.45, -bend),
    new THREE.Vector3(0, 0, -bend * 1.2),
    new THREE.Vector3(0, half * 0.45, -bend),
    new THREE.Vector3(0, half, 0.1)
  ]);
  monsterPart(bow, new THREE.TubeGeometry(curve, 16, 0.03, 8, false), paint(color));
  const string = monsterPart(
    bow,
    new THREE.CylinderGeometry(0.006, 0.006, length * 0.96, 6),
    new THREE.MeshBasicMaterial({ color: 0xe7e5e4 }),
    0, 0, 0.1
  );
  string.userData.noOutline = true;
  pivot.add(bow);
  return bow;
}

function buildChickenMesh(def) {
  const grp = new THREE.Group();
  const bodyMat = paint(def.bodyColor);
  const redMat = paint(def.accentColor);
  const beakMat = paint(0xf59e0b);

  const body = monsterPart(grp, new THREE.SphereGeometry(0.32, 16, 14), bodyMat, 0, 0.42, 0);
  body.scale.set(1.15, 0.9, 1.4);
  const head = monsterPart(grp, new THREE.SphereGeometry(0.16, 14, 12), bodyMat, 0, 0.74, -0.32);
  const comb = monsterPart(grp, new THREE.SphereGeometry(0.055, 8, 6), redMat, 0, 0.92, -0.3);
  comb.scale.set(0.45, 1.35, 0.7);
  const beak = monsterPart(grp, new THREE.ConeGeometry(0.05, 0.16, 8), beakMat, 0, 0.72, -0.48);
  beak.rotation.x = -Math.PI / 2;
  const wattle = monsterPart(grp, new THREE.SphereGeometry(0.045, 8, 6), redMat, 0, 0.64, -0.4);
  wattle.scale.set(0.65, 1.35, 0.55);
  const tail = monsterPart(grp, new THREE.SphereGeometry(0.12, 12, 8), bodyMat, 0, 0.5, 0.4);
  tail.scale.set(1.05, 0.5, 1.35);
  [-1, 1].forEach((side) => {
    const wing = monsterPart(grp, new THREE.SphereGeometry(0.15, 12, 10), bodyMat, side * 0.3, 0.46, 0.02);
    wing.scale.set(0.42, 0.85, 1.15);
    wing.rotation.z = side * -0.45;
  });

  function chickenLeg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.1 : 0.1, 0.24, 0.04);
    monsterPart(pivot, new THREE.CylinderGeometry(0.025, 0.03, 0.22, 8), beakMat, 0, -0.1, 0);
    const foot = monsterPart(pivot, new THREE.BoxGeometry(0.04, 0.02, 0.1), beakMat, 0, -0.21, -0.03);
    foot.userData.noOutline = true;
    return pivot;
  }
  const leftLegPivot = chickenLeg(true);
  const rightLegPivot = chickenLeg(false);
  grp.add(leftLegPivot, rightLegPivot);

  return finishMonster(grp, monsterHitbox(0.8, 1.5, 0.75), { leftLegPivot, rightLegPivot });
}

function buildGoblinMesh(def, role) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 0.9);
  const skin = paint(0x65a30d);
  const leather = paint(0x78350f);
  const rag = paint(0x92400e);
  const dark = paint(0x451a03);
  const iron = paint(0x9ca3af);
  const bronze = paint(0xb87333);
  const wood = paint(0x92400e);

  const torso = new THREE.Group();
  torso.position.set(0, 1.02, 0);
  torso.rotation.x = 0.32;
  group.add(torso);
  const chest = monsterPart(torso, new THREE.SphereGeometry(0.32, 16, 12), skin, 0, 0.12, 0);
  chest.scale.set(1.2, 0.82, 0.92);
  const belly = monsterPart(torso, new THREE.SphereGeometry(0.2, 14, 10), skin, 0, -0.02, -0.12);
  const vest = monsterPart(
    torso,
    new THREE.CylinderGeometry(0.28, 0.34, 0.4, 14, 1, true),
    leather,
    0, 0.1, 0.06
  );
  vest.material.side = THREE.DoubleSide;

  const cloth = monsterPart(group, new THREE.ConeGeometry(0.26, 0.38, 8, 1, true), rag, 0, 0.7, 0.04);
  cloth.material.side = THREE.DoubleSide;
  cloth.scale.set(1.15, 1, 0.62);
  const flap = monsterPart(group, new THREE.ConeGeometry(0.12, 0.32, 6, 1, true), leather, 0.1, 0.64, -0.08);
  flap.material.side = THREE.DoubleSide;
  flap.rotation.z = -0.25;

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.46, -0.08);
  torso.add(headGroup);
  const skull = monsterPart(headGroup, new THREE.SphereGeometry(0.26, 16, 14), skin, 0, 0, 0);
  skull.scale.set(1.18, 0.9, 1.02);
  [-1, 1].forEach((side) => {
    const ear = monsterPart(headGroup, new THREE.ConeGeometry(0.1, 0.5, 8), skin, side * 0.22, 0.02, 0);
    ear.rotation.z = side * -Math.PI / 2;
    ear.rotation.y = side * 0.15;
  });
  const nose = monsterPart(headGroup, new THREE.ConeGeometry(0.055, 0.24, 8), skin, 0, -0.02, -0.2);
  nose.rotation.x = Math.PI / 2.15;
  const brow = monsterPart(headGroup, new THREE.BoxGeometry(0.34, 0.06, 0.08), skin, 0, 0.1, -0.2);
  brow.rotation.x = -0.55;
  glowEye(headGroup, -0.09, 0.02, -0.24, 0xfacc15, 0.048);
  glowEye(headGroup, 0.09, 0.02, -0.24, 0xfacc15, 0.048);

  function goblinArm(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.46 : 0.46, 1.28, -0.08);
    const upper = monsterPart(pivot, new THREE.CylinderGeometry(0.075, 0.065, 0.34, 12), skin, 0, -0.18, 0);
    upper.rotation.x = 0.25;
    const fore = monsterPart(pivot, new THREE.CylinderGeometry(0.06, 0.05, 0.3, 12), skin, 0, -0.42, -0.06);
    fore.rotation.x = 0.45;
    monsterPart(pivot, new THREE.SphereGeometry(0.08, 10, 8), skin, 0, -0.58, -0.14);
    return pivot;
  }
  const leftArmPivot = goblinArm(true);
  const rightArmPivot = goblinArm(false);
  group.add(leftArmPivot, rightArmPivot);

  function goblinLeg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.16 : 0.16, 0.7, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.09, 0.07, 0.32, 12), skin, 0, -0.16, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.065, 0.05, 0.28, 12), skin, 0, -0.4, 0.02);
    const foot = monsterPart(pivot, new THREE.SphereGeometry(0.08, 10, 8), skin, 0, -0.56, -0.06);
    foot.scale.set(0.75, 0.5, 1.45);
    return pivot;
  }
  const leftLegPivot = goblinLeg(true);
  const rightLegPivot = goblinLeg(false);
  group.add(leftLegPivot, rightLegPivot);

  if (role === 'archer') {
    const hood = monsterPart(headGroup, new THREE.SphereGeometry(0.3, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), dark, 0, 0.06, 0.02);
    hood.scale.set(1.05, 0.85, 1.05);
    addQuiver(group, 0.16, 1.12, 0.22, 0x451a03, 0xfef3c7);
    addStrungBow(rightArmPivot, 0.95, 0x92400e, 0.2);
  } else {
    const pauldron = monsterPart(group, new THREE.SphereGeometry(0.16, 12, 10), iron, -0.48, 1.38, -0.06);
    pauldron.scale.set(1.25, 0.62, 1);
    [-0.4, 0, 0.4].forEach((tilt) => {
      const spike = monsterPart(pauldron, new THREE.ConeGeometry(0.035, 0.16, 6), iron, 0, 0.12, 0);
      spike.rotation.z = tilt;
    });
    const spear = new THREE.Group();
    spear.position.set(0.02, -0.5, -0.12);
    spear.rotation.x = -1.05;
    monsterPart(spear, new THREE.CylinderGeometry(0.028, 0.034, 1.05, 8), wood, 0, 0.28, 0);
    const head = monsterPart(spear, new THREE.ConeGeometry(0.09, 0.32, 4), bronze, 0, 0.88, 0);
    head.rotation.y = Math.PI / 5;
    monsterPart(spear, new THREE.ConeGeometry(0.05, 0.18, 4), bronze, 0.07, 0.78, 0).rotation.z = -0.6;
    rightArmPivot.add(spear);
    const buckler = monsterPart(leftArmPivot, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), wood, -0.06, -0.5, -0.16);
    buckler.rotation.x = Math.PI / 2.2;
    monsterPart(buckler, new THREE.SphereGeometry(0.06, 10, 8), bronze, 0, 0.05, 0);
  }

  return finishMonster(group, monsterHitbox(0.85, 2.15, 1.05), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

function buildScorpionMesh() {
  const grp = new THREE.Group();
  grp.scale.setScalar(1.28);
  const shell = paint(0xb45309);
  const dark = paint(0x451a03);
  const venom = paint(0xef4444, { emissive: 0xb91c1c, emissiveIntensity: 0.85 });

  for (let i = 0; i < 3; i++) {
    const seg = monsterPart(grp, new THREE.SphereGeometry(0.4 - i * 0.05, 16, 12), i === 0 ? dark : shell, 0, 0.52, -0.42 + i * 0.4);
    seg.scale.set(1.28, 0.55, 0.95);
  }
  const head = monsterPart(grp, new THREE.SphereGeometry(0.26, 16, 12), dark, 0, 0.5, -0.78);
  head.scale.set(1.15, 0.62, 0.9);
  glowEye(head, -0.1, 0.08, -0.18, 0xfacc15, 0.035);
  glowEye(head, 0.1, 0.08, -0.18, 0xfacc15, 0.035);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.55, 0.55),
    new THREE.Vector3(0, 1.15, 1.15),
    new THREE.Vector3(0, 1.9, 0.55),
    new THREE.Vector3(0, 2.05, -0.15)
  ]);
  monsterPart(grp, new THREE.TubeGeometry(tailCurve, 16, 0.09, 10, false), dark);
  const barb = monsterPart(grp, new THREE.ConeGeometry(0.08, 0.34, 10), venom, 0, 1.92, -0.28);
  barb.rotation.x = -2.35;

  const stations = [-0.5, -0.16, 0.18, 0.5];
  function sideLegs(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.22 : 0.22, 0.5, 0);
    const s = isLeft ? -1 : 1;
    stations.forEach((z) => {
      const hip = new THREE.Group();
      hip.position.set(0, 0.02, z);
      const upper = monsterPart(hip, new THREE.CylinderGeometry(0.055, 0.04, 0.5, 8), dark, s * 0.18, -0.05, 0);
      upper.rotation.z = s * -1.15;
      const lower = monsterPart(hip, new THREE.CylinderGeometry(0.038, 0.024, 0.44, 8), shell, s * 0.42, -0.32, 0.02);
      lower.rotation.z = s * -0.2;
      monsterPart(hip, new THREE.SphereGeometry(0.035, 8, 6), dark, s * 0.48, -0.52, 0.04);
      pivot.add(hip);
    });
    return pivot;
  }
  const leftLegPivot = sideLegs(true);
  const rightLegPivot = sideLegs(false);
  grp.add(leftLegPivot, rightLegPivot);

  function pincer(isLeft) {
    const s = isLeft ? -1 : 1;
    const pivot = monsterPivot(s * 0.28, 0.52, -0.82);
    const arm = monsterPart(pivot, new THREE.CylinderGeometry(0.055, 0.04, 0.42, 10), shell, s * 0.06, 0, -0.16);
    arm.rotation.x = Math.PI / 2;
    [-1, 1].forEach((spread) => {
      const prong = monsterPart(pivot, new THREE.ConeGeometry(0.045, 0.3, 8), dark, s * 0.08, spread * 0.07, -0.46);
      prong.rotation.x = Math.PI / 2;
      prong.rotation.z = spread * 0.55;
    });
    return pivot;
  }
  const leftArmPivot = pincer(true);
  const rightArmPivot = pincer(false);
  grp.add(leftArmPivot, rightArmPivot);

  return finishMonster(grp, monsterHitbox(1.25, 2.2, 1.05), {
    leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot
  });
}

function buildDarkWizard(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1);
  const robe = paint(0x1e1b4b);
  const trim = paint(0x9333ea, { emissive: 0x6d28d9, emissiveIntensity: 0.35 });
  const charcoal = paint(0x111827);
  const wood = paint(0x44403c);

  const skirt = monsterPart(group, new THREE.CylinderGeometry(0.2, 0.68, 1.48, 18), robe, 0, 0.76, 0);
  const hem = monsterPart(group, new THREE.TorusGeometry(0.66, 0.035, 8, 18), trim, 0, 0.06, 0);
  hem.rotation.x = Math.PI / 2;
  const chest = monsterPart(group, new THREE.SphereGeometry(0.28, 14, 12), robe, 0, 1.48, 0);
  chest.scale.set(1.05, 0.8, 0.85);
  monsterPart(group, new THREE.TorusGeometry(0.22, 0.03, 6, 14), trim, 0, 1.62, -0.02).rotation.x = Math.PI / 2.4;

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.92, 0);
  group.add(headGroup);
  monsterPart(headGroup, new THREE.SphereGeometry(0.22, 16, 14), charcoal);
  glowEye(headGroup, -0.08, 0.02, -0.2, 0xc084fc, 0.04);
  glowEye(headGroup, 0.08, 0.02, -0.2, 0xc084fc, 0.04);
  const hat = new THREE.Group();
  headGroup.add(hat);
  const brim = monsterPart(hat, new THREE.CylinderGeometry(0.4, 0.4, 0.045, 16), robe, 0, 0.16, 0);
  const cone = monsterPart(hat, new THREE.ConeGeometry(0.18, 0.78, 12), robe, 0.04, 0.52, 0);
  cone.rotation.z = 0.22;
  monsterPart(cone, new THREE.TorusGeometry(0.12, 0.02, 6, 12), trim, 0, -0.05, 0).rotation.x = Math.PI / 2;

  const cape = monsterPart(group, new THREE.PlaneGeometry(0.55, 0.9, 4, 6), trim, 0, 1.15, 0.28);
  cape.material.side = THREE.DoubleSide;

  function sleeve(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.38 : 0.38, 1.5, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.1, 0.14, 0.62, 12), robe, 0, -0.32, 0);
    monsterPart(pivot, new THREE.SphereGeometry(0.08, 10, 8), charcoal, 0, -0.64, -0.02);
    return pivot;
  }
  const leftArmPivot = sleeve(true);
  const rightArmPivot = sleeve(false);
  group.add(leftArmPivot, rightArmPivot);

  function boot(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.16 : 0.16, 0.22, 0.04);
    monsterPart(pivot, new THREE.SphereGeometry(0.1, 10, 8), charcoal, 0, -0.06, 0.02).scale.set(0.9, 0.55, 1.3);
    return pivot;
  }
  const leftLegPivot = boot(true);
  const rightLegPivot = boot(false);
  group.add(leftLegPivot, rightLegPivot);

  const staff = new THREE.Group();
  staff.position.set(0.04, -0.35, -0.08);
  staff.rotation.x = -0.25;
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.15, 0.02),
    new THREE.Vector3(0.08, 0.4, -0.04),
    new THREE.Vector3(-0.06, 0.95, 0.02),
    new THREE.Vector3(0.05, 1.4, -0.02)
  ]);
  monsterPart(staff, new THREE.TubeGeometry(shaftCurve, 16, 0.035, 8, false), wood);
  const orb = monsterPart(
    staff,
    new THREE.SphereGeometry(0.13, 16, 12),
    paint(0xc084fc, { emissive: 0xa855f7, emissiveIntensity: 0.95 }),
    0.05, 1.55, -0.02
  );
  monsterPart(staff, new THREE.TorusGeometry(0.18, 0.018, 6, 14), trim, 0.05, 1.55, -0.02);
  rightArmPivot.add(staff);

  return finishMonster(group, monsterHitbox(0.9, 2.5, 1.25), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

function buildDarkRanger(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1);
  const cloth = paint(0x18181b);
  const hide = paint(0x166534);
  const cloakMat = paint(0x27272a);

  monsterPart(group, new THREE.CylinderGeometry(0.24, 0.3, 0.72, 14), cloth, 0, 1.18, 0);
  const chest = monsterPart(group, new THREE.BoxGeometry(0.62, 0.36, 0.3), hide, 0, 1.34, -0.04);
  [-0.32, 0.32].forEach((ox) => {
    const pad = monsterPart(group, new THREE.SphereGeometry(0.14, 12, 8), hide, ox, 1.52, -0.02);
    pad.scale.set(1.1, 0.7, 0.9);
  });
  const cloak = monsterPart(group, new THREE.PlaneGeometry(0.7, 1.15, 4, 6), cloakMat, 0, 1.05, 0.28);
  cloak.material.side = THREE.DoubleSide;

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.86, 0);
  group.add(headGroup);
  monsterPart(headGroup, new THREE.SphereGeometry(0.22, 16, 14), cloth);
  const hood = monsterPart(headGroup, new THREE.SphereGeometry(0.3, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), cloakMat, 0, 0.04, 0.04);
  hood.rotation.x = 0.35;
  const cowl = monsterPart(headGroup, new THREE.ConeGeometry(0.26, 0.42, 12), cloakMat, 0, 0.28, 0.06);
  cowl.rotation.x = 0.4;
  monsterPart(headGroup, new THREE.BoxGeometry(0.32, 0.14, 0.1), cloth, 0, -0.06, -0.18);
  glowEye(headGroup, -0.08, 0.03, -0.22, 0x4ade80, 0.038);
  glowEye(headGroup, 0.08, 0.03, -0.22, 0x4ade80, 0.038);

  addQuiver(group, -0.02, 1.28, 0.32, 0x292524, 0x86efac);

  function arm(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.42 : 0.42, 1.5, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.08, 0.07, 0.55, 12), cloth, 0, -0.3, 0);
    monsterPart(pivot, new THREE.SphereGeometry(0.08, 10, 8), hide, 0, -0.6, -0.02);
    return pivot;
  }
  const leftArmPivot = arm(true);
  const rightArmPivot = arm(false);
  group.add(leftArmPivot, rightArmPivot);
  addStrungBow(rightArmPivot, 1.2, 0x14532d, 0.28);

  function leg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.15 : 0.15, 0.78, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.1, 0.09, 0.5, 12), cloth, 0, -0.26, 0);
    const boot = monsterPart(pivot, new THREE.SphereGeometry(0.11, 10, 8), paint(0x1c1917), 0, -0.54, 0.02);
    boot.scale.set(0.9, 0.6, 1.35);
    return pivot;
  }
  const leftLegPivot = leg(true);
  const rightLegPivot = leg(false);
  group.add(leftLegPivot, rightLegPivot);

  return finishMonster(group, monsterHitbox(0.88, 2.4, 1.2), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

function buildHillGiant(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1.55);
  const skin = paint(0xd6a87c);
  const beardMat = paint(0x5c3a21);
  const fur = paint(0x78350f);
  const bone = paint(0xf5f5f4);
  const wood = paint(0x5c3a21);
  const stone = paint(0x78716c);

  const belly = monsterPart(group, new THREE.SphereGeometry(0.46, 16, 14), skin, 0, 1.12, 0.02);
  belly.scale.set(1.2, 1.05, 0.92);
  const chest = monsterPart(group, new THREE.SphereGeometry(0.4, 16, 12), skin, 0, 1.52, -0.04);
  chest.scale.set(1.4, 0.72, 0.82);
  const cloth = monsterPart(group, new THREE.ConeGeometry(0.42, 0.48, 10, 1, true), fur, 0, 0.72, 0.02);
  cloth.material.side = THREE.DoubleSide;
  const buckle = monsterPart(group, new THREE.SphereGeometry(0.11, 12, 8), bone, 0, 0.9, -0.28);
  glowEye(buckle, -0.035, 0.02, -0.08, 0x1c1917, 0.022);
  glowEye(buckle, 0.035, 0.02, -0.08, 0x1c1917, 0.022);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.02, 0);
  group.add(headGroup);
  const skull = monsterPart(headGroup, new THREE.SphereGeometry(0.28, 16, 14), skin);
  skull.scale.set(1.05, 1.02, 0.96);
  const brow = monsterPart(headGroup, new THREE.BoxGeometry(0.36, 0.07, 0.1), skin, 0, 0.08, -0.2);
  brow.rotation.x = -0.4;
  glowEye(headGroup, -0.09, 0.02, -0.25, 0x1c1917, 0.04);
  glowEye(headGroup, 0.09, 0.02, -0.25, 0x1c1917, 0.04);
  const beard = monsterPart(headGroup, new THREE.SphereGeometry(0.22, 12, 10), beardMat, 0, -0.16, -0.06);
  beard.scale.set(1.05, 1.25, 0.85);
  [-0.12, 0, 0.12].forEach((ox) => {
    const tuft = monsterPart(headGroup, new THREE.ConeGeometry(0.07, 0.28, 6), beardMat, ox, -0.38, -0.08);
    tuft.rotation.x = 0.25;
  });

  function arm(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.58 : 0.58, 1.58, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.14, 0.12, 0.48, 12), skin, 0, -0.26, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.11, 0.1, 0.4, 12), skin, 0, -0.62, -0.04);
    monsterPart(pivot, new THREE.SphereGeometry(0.13, 12, 8), skin, 0, -0.84, -0.06);
    return pivot;
  }
  const leftArmPivot = arm(true);
  const rightArmPivot = arm(false);
  group.add(leftArmPivot, rightArmPivot);

  const club = new THREE.Group();
  club.position.set(0.06, -0.7, -0.08);
  club.rotation.x = -1.15;
  const trunk = monsterPart(club, new THREE.CylinderGeometry(0.1, 0.18, 1.35, 8), wood, 0, 0.45, 0);
  trunk.rotation.z = 0.12;
  for (let i = 0; i < 6; i++) {
    const spike = monsterPart(trunk, new THREE.ConeGeometry(0.06, 0.22, 5), stone, 0, 0.15 + (i % 3) * 0.22, 0);
    spike.rotation.z = (i - 2) * 0.7;
    spike.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.8;
  }
  rightArmPivot.add(club);

  function leg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.22 : 0.22, 0.78, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.16, 0.14, 0.42, 12), skin, 0, -0.22, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.13, 0.12, 0.36, 12), skin, 0, -0.52, 0);
    const foot = monsterPart(pivot, new THREE.SphereGeometry(0.16, 12, 8), skin, 0, -0.72, -0.04);
    foot.scale.set(0.85, 0.5, 1.4);
    return pivot;
  }
  const leftLegPivot = leg(true);
  const rightLegPivot = leg(false);
  group.add(leftLegPivot, rightLegPivot);

  return finishMonster(group, monsterHitbox(0.95, 2.6, 1.3), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

function buildMossGuardian(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1.72);
  const stone = paint(0x44403c);
  const bark = paint(0x3f6212);
  const moss = paint(0x16a34a);

  const core = monsterPart(group, new THREE.SphereGeometry(0.5, 16, 14), stone, 0.06, 1.2, 0);
  core.scale.set(1.25, 1.05, 0.95);
  const barkPlate = monsterPart(group, new THREE.SphereGeometry(0.32, 14, 12), bark, -0.18, 1.35, -0.08);
  barkPlate.scale.set(1.1, 0.8, 0.7);
  const shoulderL = monsterPart(group, new THREE.SphereGeometry(0.34, 14, 12), stone, -0.48, 1.5, 0);
  const shoulderR = monsterPart(group, new THREE.SphereGeometry(0.28, 14, 12), bark, 0.5, 1.42, 0.04);
  [[0.05, 1.55, 0.22], [-0.35, 1.62, 0.12], [0.28, 1.48, -0.16], [0.1, 1.15, 0.28]].forEach(([x, y, z]) => {
    const pad = monsterPart(group, new THREE.SphereGeometry(0.2, 12, 10), moss, x, y, z);
    pad.scale.set(1.2, 0.65, 1);
  });

  const headGroup = new THREE.Group();
  headGroup.position.set(0.02, 1.62, -0.18);
  group.add(headGroup);
  const crag = monsterPart(headGroup, new THREE.SphereGeometry(0.24, 12, 10), bark);
  crag.scale.set(1.15, 0.8, 0.9);
  glowEye(headGroup, -0.08, 0.02, -0.18, 0x4ade80, 0.045);
  glowEye(headGroup, 0.08, 0.02, -0.18, 0x4ade80, 0.045);
  [-1, 1].forEach((side) => {
    const antler = monsterPart(headGroup, new THREE.CylinderGeometry(0.035, 0.06, 0.5, 7), bark, side * 0.16, 0.22, 0);
    antler.rotation.z = side * -0.7;
    const branch = monsterPart(antler, new THREE.CylinderGeometry(0.02, 0.035, 0.26, 6), bark, side * 0.1, 0.08, 0);
    branch.rotation.z = side * -1.1;
    const leaf = monsterPart(branch, new THREE.SphereGeometry(0.1, 8, 6), moss, 0, 0.14, 0);
    leaf.scale.set(1.2, 0.7, 0.8);
  });

  const leftArmPivot = monsterPivot(-0.62, 1.4, 0);
  const root = monsterPart(leftArmPivot, new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8), bark, -0.08, -0.38, 0);
  root.rotation.z = 0.25;
  monsterPart(leftArmPivot, new THREE.SphereGeometry(0.14, 10, 8), moss, -0.16, -0.72, -0.04);
  const rightArmPivot = monsterPivot(0.58, 1.38, 0);
  const boulder = monsterPart(rightArmPivot, new THREE.SphereGeometry(0.36, 14, 12), stone, 0.12, -0.5, -0.06);
  boulder.scale.set(1.15, 0.9, 1);
  const cap = monsterPart(boulder, new THREE.SphereGeometry(0.2, 10, 8), moss, 0.04, 0.2, -0.08);
  cap.scale.set(1.2, 0.6, 1);
  group.add(leftArmPivot, rightArmPivot);

  function rootLeg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.24 : 0.26, 0.78, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.16, 0.2, 0.46, 8), bark, 0, -0.24, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.12, 0.16, 0.36, 7), stone, 0, -0.55, 0.02);
    [-0.1, 0.1].forEach((ox) => {
      const toe = monsterPart(pivot, new THREE.ConeGeometry(0.05, 0.18, 5), bark, ox, -0.74, -0.06);
      toe.rotation.x = Math.PI / 2;
    });
    return pivot;
  }
  const leftLegPivot = rootLeg(true);
  const rightLegPivot = rootLeg(false);
  group.add(leftLegPivot, rightLegPivot);

  return finishMonster(group, monsterHitbox(1.05, 2.5, 1.25), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

function buildLesserDemon(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1.8);
  const skin = paint(0xdc2626);
  const hornMat = paint(0x111827);
  const mane = paint(0x1f2937);
  const hoofMat = paint(0x111827);

  const waist = monsterPart(group, new THREE.SphereGeometry(0.28, 14, 12), skin, 0, 1.02, 0);
  waist.scale.set(0.85, 1.15, 0.7);
  monsterPart(group, new THREE.SphereGeometry(0.22, 12, 10), skin, -0.14, 1.42, -0.08);
  monsterPart(group, new THREE.SphereGeometry(0.22, 12, 10), skin, 0.14, 1.42, -0.08);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.88, 0);
  group.add(headGroup);
  monsterPart(headGroup, new THREE.SphereGeometry(0.24, 16, 14), skin).scale.set(1.05, 0.95, 1.05);
  glowEye(headGroup, -0.08, 0.03, -0.2, 0xfde047, 0.045);
  glowEye(headGroup, 0.08, 0.03, -0.2, 0xfde047, 0.045);
  [-1, 1].forEach((side) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.1, 0.14, 0),
      new THREE.Vector3(side * 0.34, 0.36, 0.02),
      new THREE.Vector3(side * 0.16, 0.62, -0.06)
    ]);
    monsterPart(headGroup, new THREE.TubeGeometry(curve, 12, 0.055, 8, false), hornMat);
  });
  for (let i = 0; i < 5; i++) {
    const tuft = monsterPart(headGroup, new THREE.ConeGeometry(0.055, 0.26, 6), mane, (i - 2) * 0.07, 0.12, 0.12);
    tuft.rotation.x = -0.9;
  }

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(0.85, 0.55, 1.45, 0.2);
  wingShape.quadraticCurveTo(1.05, -0.2, 0.62, -0.48);
  wingShape.quadraticCurveTo(0.28, -0.22, 0, -0.32);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.045, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02
  });
  wingGeo.rotateX(Math.PI / 2);
  const wingMat = paint(0x111827);
  const lWing = new THREE.Mesh(wingGeo, wingMat);
  lWing.scale.x = -1;
  lWing.position.set(-0.28, 1.5, 0.12);
  lWing.castShadow = true;
  const rWing = new THREE.Mesh(wingGeo, wingMat);
  rWing.position.set(0.28, 1.5, 0.12);
  rWing.castShadow = true;
  group.add(lWing, rWing);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.95, 0.15),
    new THREE.Vector3(0.2, 0.72, 0.55),
    new THREE.Vector3(-0.12, 0.9, 0.95),
    new THREE.Vector3(0.05, 1.1, 1.25)
  ]);
  monsterPart(group, new THREE.TubeGeometry(tailCurve, 16, 0.045, 8, false), skin);
  const spade = monsterPart(group, new THREE.ConeGeometry(0.12, 0.28, 4), hornMat, 0.05, 1.16, 1.32);
  spade.scale.set(1.5, 1, 0.28);
  spade.rotation.x = 1.15;

  function arm(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.46 : 0.46, 1.48, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.09, 0.08, 0.46, 12), skin, 0, -0.24, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.07, 0.06, 0.36, 12), skin, 0, -0.56, -0.04);
    const hand = monsterPart(pivot, new THREE.SphereGeometry(0.09, 10, 8), skin, 0, -0.76, -0.06);
    [-0.05, 0.05].forEach((ox) => {
      const claw = monsterPart(hand, new THREE.ConeGeometry(0.02, 0.12, 5), hornMat, ox, -0.06, -0.06);
      claw.rotation.x = Math.PI / 2.4;
    });
    return pivot;
  }
  const leftArmPivot = arm(true);
  const rightArmPivot = arm(false);
  group.add(leftArmPivot, rightArmPivot);
  const blade = monsterPart(
    rightArmPivot,
    new THREE.BoxGeometry(0.07, 0.72, 0.16),
    paint(0x111827, { emissive: 0xf97316, emissiveIntensity: 0.55 }),
    0.02, -0.85, -0.16
  );
  blade.rotation.x = -0.7;

  function hoofLeg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.16 : 0.16, 0.78, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.1, 0.09, 0.4, 12), skin, 0, -0.2, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.08, 0.07, 0.32, 12), skin, 0, -0.48, 0);
    [-0.045, 0.045].forEach((ox) => {
      const hoof = monsterPart(pivot, new THREE.SphereGeometry(0.06, 8, 6), hoofMat, ox, -0.66, -0.02);
      hoof.scale.set(0.7, 0.5, 1.15);
    });
    return pivot;
  }
  const leftLegPivot = hoofLeg(true);
  const rightLegPivot = hoofLeg(false);
  group.add(leftLegPivot, rightLegPivot);

  return finishMonster(group, monsterHitbox(0.95, 2.55, 1.25), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot, lWing, rWing
  });
}

function buildElvargMesh(def) {
  const grp = new THREE.Group();
  const scaleMat = paint(def.bodyColor);
  const goldMat = paint(def.accentColor);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

  const body = monsterPart(grp, new THREE.SphereGeometry(1.35, 16, 14), scaleMat, 0, 1.65, 0);
  body.scale.set(1.0, 0.85, 1.65);

  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.8, -1.6),
    new THREE.Vector3(0, 2.7, -2.3),
    new THREE.Vector3(0, 3.65, -2.7)
  ]);
  monsterPart(grp, new THREE.TubeGeometry(neckCurve, 16, 0.48, 10, false), scaleMat);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.5, 1.6),
    new THREE.Vector3(0.4, 0.9, 3.2),
    new THREE.Vector3(-0.3, 0.5, 4.8)
  ]);
  monsterPart(grp, new THREE.TubeGeometry(tailCurve, 16, 0.32, 10, false), scaleMat);

  function spikesAlong(curve, count, length) {
    for (let i = 1; i < count; i++) {
      const p = curve.getPoint(i / count);
      const spike = monsterPart(grp, new THREE.ConeGeometry(0.08, length, 6), goldMat, p.x, p.y + length * 0.35, p.z);
      spike.rotation.x = -0.4;
    }
  }
  spikesAlong(neckCurve, 5, 0.42);
  spikesAlong(tailCurve, 6, 0.36);
  for (let i = 0; i < 5; i++) {
    const spike = monsterPart(grp, new THREE.ConeGeometry(0.1, 0.48, 6), goldMat, 0, 2.55, -0.85 + i * 0.42);
    spike.rotation.x = -0.2;
  }

  const head = monsterPart(grp, new THREE.SphereGeometry(0.62, 16, 14), scaleMat, 0, 3.75, -3.15);
  head.scale.set(0.88, 0.78, 1.45);
  [-0.32, 0.32].forEach((ox) => {
    const horn = monsterPart(grp, new THREE.ConeGeometry(0.14, 0.95, 10), goldMat, ox, 4.2, -2.8);
    horn.rotation.x = -0.85;
  });
  [-0.2, 0.2].forEach((ox) => {
    const eye = monsterPart(grp, new THREE.SphereGeometry(0.09, 12, 8), eyeMat, ox, 3.82, -3.85);
    eye.userData.noOutline = true;
  });

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(2.2, 0.9, 4.2, 0.4);
  wingShape.quadraticCurveTo(3.1, -0.6, 1.8, -0.9);
  wingShape.quadraticCurveTo(0.8, -0.5, 0, -0.8);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03
  });
  wingGeo.rotateX(Math.PI / 2);
  const lWing = new THREE.Mesh(wingGeo, goldMat);
  lWing.scale.x = -1;
  lWing.position.set(-0.9, 2.35, -0.4);
  lWing.castShadow = true;
  const rWing = new THREE.Mesh(wingGeo, goldMat);
  rWing.position.set(0.9, 2.35, -0.4);
  rWing.castShadow = true;
  grp.add(lWing, rWing);

  function dragonLeg(x, z) {
    const pivot = monsterPivot(x, 1.2, z);
    const s = Math.sign(x) || 1;
    const thigh = monsterPart(pivot, new THREE.CylinderGeometry(0.22, 0.15, 0.55, 12), scaleMat, s * 0.12, -0.28, 0);
    thigh.rotation.z = s * 0.4;
    monsterPart(pivot, new THREE.CylinderGeometry(0.13, 0.09, 0.48, 10), scaleMat, s * 0.28, -0.68, 0.04);
    const foot = monsterPart(pivot, new THREE.SphereGeometry(0.14, 12, 8), scaleMat, s * 0.32, -0.98, -0.05);
    foot.scale.set(1.05, 0.45, 1.35);
    [-0.08, 0, 0.08].forEach((oz) => {
      const claw = monsterPart(foot, new THREE.ConeGeometry(0.035, 0.18, 6), goldMat, 0, -0.02, -0.12 + oz);
      claw.rotation.x = Math.PI / 2;
    });
    return pivot;
  }
  const leftArmPivot = dragonLeg(-0.95, -0.85);
  const rightArmPivot = dragonLeg(0.95, -0.85);
  const leftLegPivot = dragonLeg(-0.8, 0.9);
  const rightLegPivot = dragonLeg(0.8, 0.9);
  grp.add(leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot);

  return finishMonster(grp, monsterHitbox(2.9, 4.4, 2.2), {
    leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot, lWing, rWing
  });
}

function createMonsterMesh(def, typeKey) {
  switch (typeKey) {
    case 'chicken': return buildChickenMesh(def);
    case 'goblin': return buildGoblinMesh(def, 'raider');
    case 'goblin_archer': return buildGoblinMesh(def, 'archer');
    case 'scorpion': return buildScorpionMesh();
    case 'dark_wizard': return buildDarkWizard(def);
    case 'dark_ranger': return buildDarkRanger(def);
    case 'hill_giant': return buildHillGiant(def);
    case 'moss_guardian': return buildMossGuardian(def);
    case 'lesser_demon': return buildLesserDemon(def);
    case 'elvarg_dragon': return buildElvargMesh(def);
    default:
      return buildGoblinMesh(def, 'raider');
  }
}

function poseMonsterLimbs(m, moving, now, dt) {
  const rig = m.rig;
  if (!rig) return;
  if (m.attackAnim > 0) {
    m.attackAnim = Math.max(0, m.attackAnim - dt * 3.4);
    const slash = Math.sin(m.attackAnim * Math.PI) * 1.35;
    if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -slash;
    if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = slash * 0.35;
    return;
  }
  if (moving && rig.leftLegPivot && rig.rightLegPivot) {
    const s = Math.sin(now * (m.inCombatWithPlayer ? 0.01 : 0.007)) * (m.inCombatWithPlayer ? 0.5 : 0.35);
    rig.leftLegPivot.rotation.x = s;
    rig.rightLegPivot.rotation.x = -s;
    if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = -s * 0.75;
    if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = s * 0.75;
    return;
  }
  const breath = Math.sin(now * 0.003) * 0.07;
  if (rig.leftLegPivot && rig.rightLegPivot) {
    rig.leftLegPivot.rotation.x *= 0.86;
    rig.rightLegPivot.rotation.x *= 0.86;
  }
  if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = breath;
  if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -breath * 0.45;
}

function spawnMonster(typeKey, x, z) {
  const def = MONSTER_TYPES[typeKey];
  if (!def) return;
  const rig = createMonsterMesh(def, typeKey);
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
    attackAnim: 0,
    breathCount: 0,
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

    const barkMat = facetMaterial({ color: def.trunkColor || 0x92400e });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 2.2, 12), barkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    visualMesh.add(trunk);

    const foliageHex = {
      normal_tree: 0x4ade80,
      oak_tree: 0x22c55e,
      willow_tree: 0x16a34a,
      maple_tree: 0x4ade80,
      yew_tree: 0x166534,
      magic_tree: 0x2dd4bf
    }[nodeKey] || def.foliageColor || 0x4ade80;
    const fMat = facetMaterial({ color: foliageHex });
    const puffs = [
      [0, 2.55, 0, 1.25],
      [0.72, 2.15, 0.28, 0.82],
      [-0.62, 2.2, -0.32, 0.78]
    ];
    puffs.forEach(([px, py, pz, rad]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 14), fMat);
      puff.scale.set(1.08, 0.88, 1.08);
      puff.position.set(px, py, pz);
      puff.castShadow = true;
      visualMesh.add(puff);
    });

    grp.add(visualMesh);

    depletedMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.52, 0.68, 6), barkMat);
    depletedMesh.position.y = 0.34;
    depletedMesh.visible = false;
    grp.add(depletedMesh);
  } else if (def.kind === 'rock') {
    visualMesh = new THREE.Group();
    const rockMat = facetMaterial({ color: 0x94a3b8 });
    const baseRock = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), rockMat);
    baseRock.position.y = 0.7;
    baseRock.scale.set(1.18, 0.78, 1.05);
    const sideRock = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10), rockMat);
    sideRock.position.set(0.78, 0.42, 0.2);
    sideRock.scale.set(1.1, 0.8, 0.95);
    visualMesh.add(baseRock, sideRock);
    const oreMat = facetMaterial({ color: def.oreColor, emissive: def.oreColor, emissiveIntensity: 0.2, flatShading: true });
    [[0.15, 0.95, 0.72], [-0.35, 0.7, -0.55]].forEach(([ox, oy, oz]) => {
      const vein = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), oreMat);
      vein.position.set(ox, oy, oz);
      visualMesh.add(vein);
    });
    grp.add(visualMesh);

    depletedMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.85, 0),
      facetMaterial({ color: 0x64748b })
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
  hitbox.userData.isCollider = true;
  grp.add(hitbox);
  addCartoonOutline(grp, 0.038);

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
  // Cartoon skies stay clear. Dust motes read as noise, so the world has none.
}


// ============================================================================
// 9. INPUT, CAMERA BEHIND CHARACTER, COMBAT, SKILLING, MINIMAP & MAIN LOOP
// ============================================================================
const keysPressed = {};
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();
let hoveredWorld = null;
let clickMarkerMesh = null;
let hoverTile = null;
const rightPress = { x: 0, y: 0, dist: 0 };
let contextTarget = null;

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
  const canvasHost = document.getElementById('game-canvas-container');
  if (canvasHost) canvasHost.addEventListener('contextmenu', onGameContextMenu);

  canvas.addEventListener('mousedown', e => {
    if (e.button === 2 || e.button === 1) {
      camState.isDragging = true;
      camState.lastMouseX = e.clientX;
      camState.lastMouseY = e.clientY;
      rightPress.x = e.clientX;
      rightPress.y = e.clientY;
      rightPress.dist = 0;
      return;
    }
    if (e.button === 0) {
      hideContextMenu();
      handleWorldClick(e);
    }
  });

  window.addEventListener('mousemove', e => {
    if (camState.isDragging) {
      const dx = e.clientX - camState.lastMouseX;
      const dy = e.clientY - camState.lastMouseY;
      camState.lastMouseX = e.clientX;
      camState.lastMouseY = e.clientY;
      rightPress.dist += Math.hypot(dx, dy);
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
    camState.distance = Math.max(3.6, Math.min(26, camState.distance + e.deltaY * 0.01));
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
  const onCanvas = !!(e.target && e.target.id === 'game-canvas');
  const modalOpen = !!document.querySelector('.modal-backdrop.open');
  if (!onCanvas || modalOpen) {
    hoveredWorld = null;
    hideHoverTooltip();
    if (hoverTile) hoverTile.visible = false;
    return;
  }
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
        hoveredWorld = ud;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY + 14) + 'px';
        tooltip.innerHTML = label;
        document.body.style.cursor = 'pointer';
        return;
      }
    }
  }
  hoveredWorld = null;
  tooltip.style.display = 'none';
  document.body.style.cursor = 'default';
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  contextTarget = null;
}

function pointerToWorld(clientX, clientY) {
  mouseVec.x = (clientX / window.innerWidth) * 2 - 1;
  mouseVec.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const hits = raycaster.intersectObjects(worldInteractiveObjects, false);
  const entityHit = hits.find((hit) => hit.object.userData && hit.object.userData.type && hit.object.userData.type !== 'ground');
  const groundHits = terrainMesh ? raycaster.intersectObject(terrainMesh, false) : [];
  return { entityHit, ground: groundHits[0] || null };
}

function onGameContextMenu(e) {
  e.preventDefault();
  if (rightPress.dist > 6) return;
  if (document.querySelector('.modal-backdrop.open')) return;
  const picked = pointerToWorld(e.clientX, e.clientY);
  const options = [];
  const ud = picked.entityHit ? picked.entityHit.object.userData : null;
  contextTarget = { ud, ground: picked.ground, point: picked.entityHit ? picked.entityHit.point : (picked.ground ? picked.ground.point : null) };

  if (ud && ud.type === 'monster' && ud.entity && !ud.entity.dead) {
    const tone = monsterThreatColor(ud.entity.def.level, getCombatLevel());
    options.push({
      label: attackOptionLabel(ud.entity.def.name, ud.entity.def.level),
      tone,
      run: () => {
        player.targetEntity = { type: 'monster', ref: ud.entity };
        player.targetPos = null;
        showClickMarker(ud.entity.pos.x, ud.entity.pos.z, 0xef4444);
        updateTargetHud();
      }
    });
  } else if (ud && ud.type === 'resource' && ud.entity && !ud.entity.depleted) {
    options.push({
      label: gatherVerb(ud.entity.def.kind, ud.entity.def.item),
      run: () => {
        player.targetEntity = { type: 'resource', ref: ud.entity };
        player.targetPos = null;
        showClickMarker(ud.entity.pos.x, ud.entity.pos.z, 0x38bdf8);
        updateTargetHud();
      }
    });
  } else if (ud && ud.type === 'interactive') {
    let label = `Use ${ud.name}`;
    if (ud.action === 'slayer') label = 'Talk-to Slayer Master Vannaka';
    else if (ud.action === 'bank') label = 'Bank';
    else if (ud.action === 'shop') label = 'Trade';
    const anchor = picked.entityHit.object.getWorldPosition(new THREE.Vector3());
    options.push({
      label,
      run: () => {
        player.targetEntity = { type: 'interactive', ref: ud, pos: anchor };
        player.targetPos = null;
        showClickMarker(anchor.x, anchor.z, 0xfde047);
      }
    });
  }

  options.push({
    label: 'Examine',
    run: () => {
      if (ud && ud.type === 'monster' && ud.entity) addChatMessage(`It's a level ${ud.entity.def.level} ${ud.entity.def.name}.`, 'skill');
      else if (ud && ud.type === 'resource' && ud.entity) addChatMessage(`It's a ${ud.entity.def.name}.`, 'skill');
      else if (ud && ud.type === 'interactive') addChatMessage(`It's ${ud.name}.`, 'skill');
      else addChatMessage("It's the ground.", 'skill');
    }
  });
  if (picked.ground) {
    const pt = picked.ground.point;
    options.push({
      label: 'Walk here',
      run: () => {
        if (!isWalkable(pt.x, pt.z)) {
          addChatMessage('You cannot walk there.', 'combat');
          return;
        }
        player.targetEntity = null;
        player.targetPos = new THREE.Vector3(pt.x, getTerrainHeight(pt.x, pt.z), pt.z);
        showClickMarker(pt.x, pt.z, 0xfde047);
        updateTargetHud();
      }
    });
  }
  options.push({ label: 'Cancel', run: () => {} });

  const menu = document.getElementById('context-menu');
  const list = document.getElementById('context-menu-list');
  if (!menu || !list) return;
  list.innerHTML = '';
  options.forEach((opt) => {
    const row = document.createElement('div');
    row.className = 'osrs-menu-item' + (opt.tone ? ` threat-${opt.tone}` : '');
    row.textContent = opt.label;
    row.addEventListener('click', (ev) => {
      ev.stopPropagation();
      hideContextMenu();
      opt.run();
    });
    list.appendChild(row);
  });
  const left = Math.min(window.innerWidth - 220, e.clientX);
  const top = Math.min(window.innerHeight - (options.length * 24 + 28), e.clientY);
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top = Math.max(8, top) + 'px';
  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');
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

function glowMaterial(color, opacity = 0.92) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

function spawnVfx(mesh, life, onTick) {
  scene.add(mesh);
  vfxList.push({ mesh, life, age: 0, onTick });
}

function launchProjectile(mesh, fromPos, toPos, onImpact, opts = {}) {
  const start = fromPos.clone().add(new THREE.Vector3(0, opts.y0 ?? 1.4, 0));
  const end = toPos.clone().add(new THREE.Vector3(0, opts.y1 ?? 1.2, 0));
  mesh.position.copy(start);
  scene.add(mesh);
  projectilesList.push({
    mesh,
    start,
    end,
    progress: 0,
    speed: opts.speed ?? 3.5,
    arc: opts.arc ?? 1.4,
    orient: !!opts.orient,
    onImpact,
    onTick: opts.onTick || null,
    trailAcc: 0
  });
}

function spawnProjectile(fromPos, toPos, colorHex, onImpact) {
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshBasicMaterial({ color: colorHex })
  );
  launchProjectile(orb, fromPos, toPos, onImpact, { speed: 3.5, arc: 1.4 });
}

function spawnBurst(origin, count, color, life = 0.5, speed = 3.2) {
  for (let i = 0; i < count; i++) {
    const mote = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glowMaterial(color, 1));
    mote.position.copy(origin);
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const vel = new THREE.Vector3(Math.cos(ang) * speed, 1.2 + Math.random() * 2.4, Math.sin(ang) * speed);
    spawnVfx(mote, life, (v, dt) => {
      vel.y -= 7 * dt;
      v.mesh.position.addScaledVector(vel, dt);
      v.mesh.material.opacity = 1 - v.age / v.life;
      v.mesh.scale.setScalar(1 - v.age / v.life * 0.6);
    });
  }
}

function spawnExpandingRing(position, color, life = 0.7, grow = 4.2, inner = 0.35, outer = 0.52) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 32),
    glowMaterial(color, 0.9)
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(position);
  ring.position.y += 0.08;
  spawnVfx(ring, life, (v) => {
    const t = v.age / v.life;
    v.mesh.scale.setScalar(1 + t * grow);
    const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    v.mesh.material.opacity = 0.95 * fade;
  });
  return ring;
}

function spawnSlashArc(color, origin, yaw, opts = {}) {
  const arc = new THREE.Mesh(
    new THREE.RingGeometry(opts.inner ?? 0.5, opts.outer ?? 0.78, 28, 1, opts.theta0 ?? 0.25, opts.thetaLen ?? 1.65),
    glowMaterial(color, opts.opacity ?? 0.95)
  );
  arc.position.copy(origin);
  arc.lookAt(origin.x + Math.sin(yaw) * 4, origin.y, origin.z + Math.cos(yaw) * 4);
  arc.rotateZ(opts.roll ?? 0.55);
  const base = opts.scale ?? 1;
  arc.scale.setScalar(base);
  spawnVfx(arc, opts.life ?? 0.48, (v) => {
    const t = v.age / v.life;
    v.mesh.scale.setScalar(base * (1 + t * 0.28));
    v.mesh.material.opacity = (opts.opacity ?? 0.95) * (1 - t);
  });
}

function metalSlashTint(item) {
  const tier = item?.tier;
  if (tier === 'bronze') return 0xd97706;
  if (tier === 'iron' || tier === 'steel' || tier === 'black') return 0x94a3b8;
  if (tier === 'mithril') return 0x60a5fa;
  if (tier === 'adamant') return 0x34d399;
  if (tier === 'rune') return 0x38bdf8;
  if (tier === 'gilded') return 0xfacc15;
  return item?.color || 0xe2e8f0;
}

function spawnMeleeSlashEffect(weaponItem, playerPos, playerYaw, targetPos, isSpec) {
  const id = weaponItem?.id || '';
  const forward = new THREE.Vector3(Math.sin(playerYaw), 0, Math.cos(playerYaw));
  const origin = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)).add(forward.clone().multiplyScalar(0.95));
  const specScale = isSpec ? 1.35 : 1;
  const impact = targetPos.clone().add(new THREE.Vector3(0, 1.15, 0));

  if (id === 'abyssal_whip') {
    const start = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
    const end = targetPos.clone().add(new THREE.Vector3(0, 1.05, 0));
    const side = new THREE.Vector3(-Math.cos(playerYaw), 0, Math.sin(playerYaw));
    const p1 = start.clone().lerp(end, 0.34).add(side.clone().multiplyScalar(0.72));
    p1.y += 0.5;
    const p2 = start.clone().lerp(end, 0.68).add(side.clone().multiplyScalar(-0.58));
    p2.y += 0.12;
    const curve = new THREE.CatmullRomCurve3([start, p1, p2, end]);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 28, 0.1, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x1c1917, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    ));
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.05, 8, false), glowMaterial(0xf87171, 1)));
    spawnVfx(grp, 0.75, (v) => {
      const t = v.age / v.life;
      v.mesh.traverse((obj) => {
        if (obj.material && obj.material.transparent) obj.material.opacity = 1 - t;
      });
    });
    if (isSpec) {
      const p1b = start.clone().lerp(end, 0.34).add(side.clone().multiplyScalar(-0.72));
      p1b.y += 0.5;
      const p2b = start.clone().lerp(end, 0.68).add(side.clone().multiplyScalar(0.58));
      p2b.y += 0.12;
      const twin = new THREE.CatmullRomCurve3([start, p1b, p2b, end]);
      const twinGrp = new THREE.Group();
      twinGrp.add(new THREE.Mesh(new THREE.TubeGeometry(twin, 28, 0.08, 8, false), glowMaterial(0x6d28d9, 0.9)));
      twinGrp.add(new THREE.Mesh(new THREE.TubeGeometry(twin, 28, 0.04, 8, false), glowMaterial(0xf87171, 1)));
      spawnVfx(twinGrp, 0.75, (v) => {
        const t = v.age / v.life;
        v.mesh.traverse((obj) => {
          if (obj.material && obj.material.transparent) obj.material.opacity = 1 - t;
        });
      });
    }
    const crack = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 20), glowMaterial(0x7c3aed, 0.9));
    crack.position.copy(end);
    crack.lookAt(end.x, end.y + 1, end.z);
    spawnVfx(crack, 0.48, (v) => {
      const t = v.age / v.life;
      v.mesh.scale.setScalar(1 + t * 1.8);
      v.mesh.material.opacity = 0.9 * (1 - t);
    });
    return;
  }

  if (id === 'dragon_scimitar' || id === 'dragon_dagger') {
    spawnSlashArc(0xdc2626, origin, playerYaw, { scale: 1.15 * specScale, roll: 0.7, life: 0.85 });
    spawnSlashArc(0xfde047, origin.clone().add(forward.clone().multiplyScalar(0.18)), playerYaw, {
      scale: 0.82 * specScale, roll: -0.35, inner: 0.42, outer: 0.62, life: 0.46
    });
    spawnBurst(impact, 8, 0xf97316, 0.48, 3.4);
    spawnBurst(impact, 4, 0xfde047, 0.4, 2.2);
    if (isSpec) {
      spawnSlashArc(0xdc2626, origin, playerYaw, { scale: 1.25, roll: Math.PI / 2, life: 0.7, inner: 0.45, outer: 0.72 });
      spawnSlashArc(0xfde047, origin, playerYaw, { scale: 1.05, roll: -Math.PI / 2, life: 0.55, inner: 0.35, outer: 0.55 });
    }
    return;
  }

  if (id === 'rune_scimitar') {
    spawnSlashArc(0x22d3ee, origin, playerYaw, { scale: 1.05 * specScale, life: 0.46 });
    spawnBurst(impact, 4, 0x67e8f9, 0.4, 2.6);
    return;
  }

  if (id === 'bandos_godsword' || id === 'master_sword' || id === 'deity_sword' || weaponItem?.iconKind === 'greatsword') {
    const sacred = id === 'master_sword' || id === 'deity_sword';
    const color = sacred ? 0x7dd3fc : 0xfde047;
    spawnSlashArc(color, origin, playerYaw, { scale: 1.45 * specScale, inner: 0.7, outer: 1.05, life: 0.58, roll: 0.3 });
    const pillarH = isSpec ? (id === 'bandos_godsword' ? 7.2 : 6.4) : 3.5;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(isSpec ? 0.28 : 0.16, isSpec ? 0.7 : 0.42, pillarH, 16, 1, true),
      glowMaterial(color, 0.8)
    );
    column.position.set(targetPos.x, targetPos.y + pillarH * 0.5, targetPos.z);
    if (isSpec && sacred) {
      const goldBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.2, pillarH + 1.2, 12, 1, true),
        glowMaterial(0xfde047, 0.85)
      );
      goldBeam.position.set(targetPos.x, targetPos.y + (pillarH + 1.2) * 0.5, targetPos.z);
      spawnVfx(goldBeam, 0.85, (v) => {
        const t = v.age / v.life;
        v.mesh.material.opacity = 0.85 * (1 - t);
      });
    }
    spawnVfx(column, 0.7, (v) => {
      const t = v.age / v.life;
      v.mesh.scale.set(1 + t * 0.4, 1, 1 + t * 0.4);
      v.mesh.material.opacity = 0.8 * (1 - t);
    });
    spawnExpandingRing(targetPos.clone().setY(targetPos.y), color, isSpec ? 0.85 : 0.6, isSpec ? 6.4 : 3.2);
    return;
  }

  spawnSlashArc(metalSlashTint(weaponItem), origin, playerYaw, { scale: specScale, life: 0.4 });
}

function spawnSpellImpact(spell, targetPos, casterPos) {
  const id = spell?.id || '';
  const ground = targetPos.clone();
  if (id === 'wind_strike') {
    spawnExpandingRing(ground, 0xe0f2fe, 1.25, 3.2, 0.28, 0.5);
    spawnExpandingRing(ground, 0x38bdf8, 1.05, 2.2, 0.15, 0.28);
    const gust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.42, 1.7, 16, 1, true),
      glowMaterial(0xf8fafc, 0.8)
    );
    gust.position.set(targetPos.x, targetPos.y + 0.9, targetPos.z);
    spawnVfx(gust, 0.7, (v) => {
      const t = v.age / v.life;
      v.mesh.scale.set(1 + t * 1.4, 1, 1 + t * 1.4);
      v.mesh.material.opacity = 0.8 * (1 - t);
    });
    spawnBurst(targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), 6, 0x7dd3fc, 0.45, 2.4);
    return;
  }
  if (id === 'fire_bolt') {
    spawnBurst(targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), 8, 0xf97316, 0.55, 3.6);
    spawnBurst(targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), 4, 0xef4444, 0.45, 2.4);
    return;
  }
  if (id === 'ice_burst') {
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 1.35, 6),
        new THREE.MeshBasicMaterial({
          color: 0x7dd3fc,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      const x = targetPos.x + Math.cos(ang) * 0.95;
      const z = targetPos.z + Math.sin(ang) * 0.95;
      spire.position.set(x, targetPos.y, z);
      spire.scale.y = 0.02;
      spawnVfx(spire, 1.45, (v) => {
        const grow = Math.min(1, v.age / 0.22);
        v.mesh.scale.y = grow;
        v.mesh.position.y = targetPos.y + (1.35 * grow) * 0.5;
        if (v.age > 0.9) v.mesh.material.opacity = 0.72 * (1 - (v.age - 0.9) / 0.55);
      });
    }
    spawnExpandingRing(ground, 0x38bdf8, 0.8, 4.6, 0.4, 0.62);
    return;
  }
  if (id === 'blood_barrage') {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.9, 4.2, 18, 1, true),
      glowMaterial(0xdc2626, 0.88)
    );
    pillar.position.set(targetPos.x, targetPos.y + 2.1, targetPos.z);
    for (let i = 0; i < 6; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowMaterial(0xfb7185, 1));
      const ang = (i / 6) * Math.PI * 2;
      drop.position.set(Math.cos(ang) * 0.72, -1.3 + i * 0.55, Math.sin(ang) * 0.72);
      pillar.add(drop);
    }
    spawnVfx(pillar, 1.35, (v, dt) => {
      const t = v.age / v.life;
      const pulse = 1 + Math.sin(v.age * 18) * 0.08;
      v.mesh.scale.set(pulse, 1, pulse);
      v.mesh.rotation.y += dt * 5;
      v.mesh.material.opacity = 0.88 * (1 - Math.max(0, t - 0.45) / 0.55);
    });
    const sigil = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 28), glowMaterial(0xbe123c, 0.95));
    sigil.rotation.x = -Math.PI / 2;
    sigil.position.set(targetPos.x, targetPos.y + 0.1, targetPos.z);
    spawnVfx(sigil, 1.2, (v) => {
      const t = v.age / v.life;
      v.mesh.scale.setScalar(1 + t * 2.4);
      v.mesh.rotation.z += 0.02;
      v.mesh.material.opacity = 0.95 * (1 - t);
    });
    spawnBurst(targetPos.clone().add(new THREE.Vector3(0, 1.3, 0)), 10, 0xfb7185, 0.7, 3.1);
    const from = targetPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const to = (casterPos || player.pos).clone().add(new THREE.Vector3(0, 1.35, 0));
    for (let i = 0; i < 3; i++) {
      const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glowMaterial(0xf43f5e, 1));
      const start = from.clone();
      const end = to.clone();
      const side = new THREE.Vector3((i - 1) * 0.7, 0, (1 - i) * 0.35);
      const ctrl = start.clone().lerp(end, 0.5).add(side);
      ctrl.y += 1.8 + i * 0.25;
      spawnVfx(wisp, 0.9, (v) => {
        const t = v.age / v.life;
        const a = start.clone().lerp(ctrl, t);
        const b = ctrl.clone().lerp(end, t);
        v.mesh.position.lerpVectors(a, b, t);
        v.mesh.material.opacity = 1 - t * 0.2;
      });
    }
  }
}

function spawnSpellProjectile(spell, fromPos, toPos, onImpact) {
  const id = spell?.id || 'wind_strike';
  const grp = new THREE.Group();
  let speed = 4.2;
  let arc = 0.7;
  let onTick = null;

  if (id === 'wind_strike') {
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), glowMaterial(0xf8fafc, 1)));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.028, 8, 20), glowMaterial(0xbae6fd, 0.95));
    ring.rotation.x = 1.1;
    grp.add(ring);
    speed = 6.2;
    arc = 0.35;
    onTick = (p, dt) => { ring.rotation.z += dt * 9; };
  } else if (id === 'fire_bolt') {
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), glowMaterial(0xf97316, 1)));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), glowMaterial(0xfde047, 1));
    grp.add(core);
    speed = 4.4;
    arc = 0.65;
    onTick = (p, dt) => {
      p.trailAcc += dt;
      if (p.trailAcc < 0.03) return;
      p.trailAcc = 0;
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMaterial(Math.random() > 0.5 ? 0xf97316 : 0xfde047, 0.9));
      ember.position.copy(p.mesh.position);
      spawnVfx(ember, 0.32, (v) => {
        v.mesh.scale.setScalar(1 - v.age / v.life);
        v.mesh.material.opacity = 0.9 * (1 - v.age / v.life);
      });
    };
  } else if (id === 'ice_burst') {
    const comet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), glowMaterial(0x38bdf8, 1));
    comet.scale.set(0.75, 1.45, 0.75);
    grp.add(comet);
    speed = 3.8;
    arc = 0.45;
  } else if (id === 'blood_barrage') {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), glowMaterial(0x7f1d1d, 0.85));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), glowMaterial(0xdc2626, 1));
    grp.add(shell, core);
    const drops = [0, 1, 2].map((i) => {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glowMaterial(0xfb7185, 1));
      drop.userData.orbit = i;
      grp.add(drop);
      return drop;
    });
    speed = 2.6;
    arc = 0.85;
    onTick = (p, dt) => {
      const pulse = 1 + Math.sin(p.progress * 28) * 0.14;
      shell.scale.setScalar(pulse);
      drops.forEach((drop, i) => {
        const a = performance.now() * 0.008 + i * (Math.PI * 2 / 3);
        drop.position.set(Math.cos(a) * 0.42, Math.sin(a * 1.4) * 0.12, Math.sin(a) * 0.42);
      });
    };
  } else {
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: spell?.color || 0xffffff })));
  }

  const orient = id === 'ice_burst';
  launchProjectile(grp, fromPos, toPos, () => {
    spawnSpellImpact(spell, toPos, fromPos);
    if (onImpact) onImpact();
  }, { speed, arc, orient, onTick, y0: 1.45, y1: 1.15 });
}

function spawnArrowProjectile(weapon, fromPos, toPos, onImpact) {
  const grp = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.015, 0.72, 8),
    new THREE.MeshBasicMaterial({ color: 0xe7e5e4 })
  );
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.16, 8),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc })
  );
  head.position.y = 0.42;
  grp.add(shaft, head);
  const fletchColor = weapon?.id === 'ancient_bow' ? 0x38bdf8 : weapon?.id === 'magic_bow' ? 0x34d399 : 0xf8fafc;
  for (let i = 0; i < 3; i++) {
    const fletch = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.16),
      new THREE.MeshBasicMaterial({ color: fletchColor, side: THREE.DoubleSide })
    );
    fletch.position.y = -0.28;
    fletch.rotation.y = (i / 3) * Math.PI;
    grp.add(fletch);
  }
  const trail = weapon?.id === 'ancient_bow' ? 0x22d3ee : weapon?.id === 'magic_bow' ? 0x34d399 : 0;
  launchProjectile(grp, fromPos, toPos, onImpact, {
    speed: 7.2,
    arc: 0.28,
    orient: true,
    y0: 1.35,
    y1: 1.15,
    onTick: trail ? (p, dt) => {
      p.trailAcc += dt;
      if (p.trailAcc < 0.025) return;
      p.trailAcc = 0;
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), glowMaterial(trail, 0.85));
      spark.position.copy(p.mesh.position);
      spawnVfx(spark, 0.22, (v) => {
        v.mesh.material.opacity = 0.85 * (1 - v.age / v.life);
      });
    } : null
  });
}

function spawnPiercingBeam(fromPos, toPos, color) {
  const start = fromPos.clone().add(new THREE.Vector3(0, 1.35, 0));
  const end = toPos.clone().add(new THREE.Vector3(0, 1.15, 0));
  const delta = end.clone().sub(start);
  const len = Math.max(0.2, delta.length());
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 10), glowMaterial(color, 0.95));
  beam.position.copy(start.clone().add(delta.clone().multiplyScalar(0.5)));
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  spawnVfx(beam, 0.45, (v) => {
    const t = v.age / v.life;
    v.mesh.material.opacity = 0.95 * (1 - t);
    v.mesh.scale.x = 1 + t * 2;
    v.mesh.scale.z = 1 + t * 2;
  });
  spawnBurst(end, 8, color, 0.4, 3.2);
}

function spawnRareLootBeam(worldPos) {
  const grp = new THREE.Group();
  const gold = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 6.5, 16, 1, true), glowMaterial(0xfde047, 0.88));
  gold.position.y = 3.25;
  const purple = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 6.8, 12, 1, true), glowMaterial(0xa855f7, 0.75));
  purple.position.y = 3.4;
  grp.add(gold, purple);
  grp.position.set(worldPos.x, worldPos.y, worldPos.z);
  spawnVfx(grp, 3.5, (v, dt) => {
    v.mesh.rotation.y += dt * 1.6;
    const t = v.age / v.life;
    const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    gold.material.opacity = 0.88 * fade;
    purple.material.opacity = 0.75 * fade;
  });
  for (let i = 0; i < 14; i++) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), glowMaterial(i % 2 ? 0xfde047 : 0xc084fc, 1));
    spark.position.set(worldPos.x, worldPos.y + 0.4, worldPos.z);
    const ang = (i / 14) * Math.PI * 2;
    const vel = new THREE.Vector3(Math.cos(ang) * 0.7, 1.5 + (i % 4) * 0.35, Math.sin(ang) * 0.7);
    spawnVfx(spark, 3.5, (v, dt) => {
      vel.y -= 0.35 * dt;
      v.mesh.position.addScaledVector(vel, dt);
      v.mesh.material.opacity = 1 - v.age / v.life;
    });
  }
}

function spawnDragonfireEffect(monster, onImpact) {
  const from = monster.pos.clone();
  const to = player.pos.clone();
  spawnExpandingRing(to, 0xf97316, 1.05, 2.6, 0.45, 0.75);
  const grp = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.6, 14), glowMaterial(0xf97316, 0.92));
  cone.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 12), glowMaterial(0xfde047, 1));
  core.rotation.x = Math.PI / 2;
  grp.add(cone, core);
  launchProjectile(grp, from, to, () => {
    spawnExpandingRing(player.pos, 0xef4444, 0.85, 4.2, 0.5, 0.8);
    spawnBurst(player.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 12, 0xf97316, 0.6, 3.4);
    spawnBurst(player.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 6, 0xfde047, 0.45, 2.2);
    if (onImpact) onImpact();
  }, { speed: 1.7, arc: 0.25, orient: true, y0: 3.2, y1: 1.1 });
}

function spawnShadowBolt(fromPos, toPos, onImpact) {
  const grp = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), glowMaterial(0x1c1917, 0.95));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMaterial(0x7c3aed, 1));
  grp.add(shell, core);
  launchProjectile(grp, fromPos, toPos, () => {
    spawnExpandingRing(toPos, 0x4c1d95, 0.6, 3.1, 0.32, 0.55);
    if (onImpact) onImpact();
  }, {
    speed: 4.1,
    arc: 0.35,
    y0: 1.7,
    y1: 1.2,
    onTick: (_p, dt) => {
      grp.rotation.y += dt * 9;
      grp.rotation.z += dt * 6;
    }
  });
}

function spawnHellfireOrb(fromPos, toPos, onImpact) {
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), glowMaterial(0xef4444, 1)));
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMaterial(0xf97316, 1)));
  launchProjectile(grp, fromPos, toPos, onImpact, {
    speed: 3.3,
    arc: 0.7,
    y0: 1.8,
    y1: 1.2,
    onTick: (p, dt) => {
      p.trailAcc += dt;
      if (p.trailAcc < 0.04) return;
      p.trailAcc = 0;
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), glowMaterial(0xf97316, 0.95));
      ember.position.copy(p.mesh.position);
      spawnVfx(ember, 0.32, (v) => {
        v.mesh.material.opacity = 0.95 * (1 - v.age / v.life);
      });
    }
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
    maxHit = Math.max(2, Math.floor(maxHit * dharokMultiplier(STATE)));
    accuracyScore = (s.attack.lvl + styleAtkBonus) * 1.35 + bon.atk + 12;
  }

  const spec = weaponSpecial(STATE.equipment.weapon);
  let isSpec = false;
  let specHeal = 0;
  if (STATE.specArmed) {
    if (STATE.specEnergy < spec.cost) {
      STATE.specArmed = false;
      addChatMessage(`You need ${spec.cost}% Special Attack energy to use <b>${spec.name}</b>.`, 'combat');
      player.attackAnim = 1.0;
    } else {
      isSpec = true;
      STATE.specArmed = false;
      STATE.specEnergy = Math.max(0, STATE.specEnergy - spec.cost);
      maxHit = Math.floor(maxHit * spec.multiplier);
      accuracyScore *= spec.accuracy;
      specHeal = spec.healRatio;
      player.spinAnim = 1.0;
      addChatMessage(`You unleash <b>${spec.name}</b>!`, 'lvlup');
    }
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
      if (specHeal > 0) {
        const healAmt = Math.max(1, Math.floor(dmg * specHeal));
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
    const wep = ITEMS[STATE.equipment.weapon];
    if (isSpec && (wep?.id === 'ancient_bow' || wep?.id === 'armadyl_crossbow')) {
      spawnPiercingBeam(player.pos, monster.pos, wep.id === 'armadyl_crossbow' ? 0xfde047 : 0x22d3ee);
    }
    spawnArrowProjectile(wep, player.pos, monster.pos, applyDamage);
  } else if (style === 'magic') {
    SFX.magic();
    const sp = SPELLS.find(x => x.id === STATE.activeSpell) || SPELLS[0];
    spawnSpellProjectile(sp, player.pos, monster.pos, applyDamage);
  } else {
    spawnMeleeSlashEffect(ITEMS[STATE.equipment.weapon], player.pos, player.yaw, monster.pos, isSpec);
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
  const kill = registerKill(STATE, monster.typeKey);
  if (kill.slayerKillXp > 0 && !kill.slayerCompleted) {
    addChatMessage(`Slayer progress: <b>${kill.remaining}</b> ${kill.taskName} remaining.`, 'skill');
  }
  if (kill.slayerCompleted) {
    addChatMessage(`Slayer bounty: <b style="color:#ffe642">${kill.bountyGp.toLocaleString()} GP</b> and <b>${kill.bountyXp} Attack XP</b>. Streak ${STATE.quests.slayerStreak}.`, 'loot');
    showBanner('Slayer Bounty', `${kill.taskName} complete`);
    spawnLevelUpFireworks(0xc084fc);
  }

  let rareBeam = isBossLoot(monster.typeKey);
  if (monster.def.drops) {
    monster.def.drops.forEach(d => {
      if (Math.random() <= d.chance) {
        if (d.gp) {
          const coins = d.gp[0] + Math.floor(Math.random() * (d.gp[1] - d.gp[0] + 1));
          STATE.gp += coins;
          SFX.coin();
          addChatMessage(`Looted <b style="color:#ffe642">${coins} GP</b> from ${monster.def.name}.`, 'loot');
        } else if (d.id && ITEMS[d.id]) {
          if (isRareLoot(ITEMS[d.id])) rareBeam = true;
          const qty = d.qty || 1;
          const gained = addItem(STATE, d.id, qty);
          if (gained.added > 0) addChatMessage('Looted <b>' + ITEMS[d.id].name + '</b>' + (gained.added > 1 ? ' x' + gained.added : '') + '.', 'loot');
          if (!gained.ok) addChatMessage('Your backpack is full. The <b>' + ITEMS[d.id].name + '</b> is left behind.', 'combat');
        }
      }
    });
  }
  if (rareBeam) spawnRareLootBeam(monster.pos);
  updateAllUI();
}

function performMonsterRetaliation(monster) {
  if (monster.dead || STATE.hp <= 0) return;
  monster.attackAnim = 1;
  const bon = getEquipmentBonuses();
  const defLvl = STATE.skills.defence.lvl + (STATE.combatStyle === 'defensive' ? 3 : 0);
  const prayDefMult = STATE.activePrayers.has('piety') ? 1.25 : (STATE.activePrayers.has('thick_skin') ? 1.15 : 1.0);
  const playerDefScore = (defLvl * 1.2 + bon.def) * prayDefMult + 10;
  const monAtkScore = monster.def.atk * 1.25 + 8;

  const hitChance = Math.min(0.82, Math.max(0.12, monAtkScore / (monAtkScore + playerDefScore)));
  monster.breathCount = (monster.breathCount || 0) + 1;
  const dragonfire = monster.typeKey === 'elvarg_dragon' && monster.breathCount % 3 === 0;

  let dmg = 0;
  let absorbedBreath = false;
  if (Math.random() < hitChance) {
    if (dragonfire) {
      const raw = Math.max(1, Math.floor(Math.random() * 43));
      const resolved = resolveDragonfire(raw, STATE);
      dmg = resolved.damage;
      absorbedBreath = resolved.absorbed && raw > 0;
    } else {
      dmg = Math.max(1, Math.floor(Math.random() * (monster.def.maxHit + 1)));
      dmg = mitigateDamage(dmg, monster.def.style, STATE.activePrayers);
    }
  }

  const applyHit = () => {
    if (absorbedBreath) {
      addChatMessage("Your shield / prayer absorbs most of Elvarg's dragonfire!", 'skill');
    }
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

  if (dragonfire) {
    addChatMessage('Elvarg rears back and breathes <b>Dragonfire</b>!', 'combat');
    spawnDragonfireEffect(monster, applyHit);
    return;
  }
  if (monster.typeKey === 'dark_wizard') {
    spawnShadowBolt(monster.pos, player.pos, applyHit);
  } else if (monster.typeKey === 'goblin_archer' || monster.typeKey === 'dark_ranger') {
    spawnArrowProjectile(null, monster.pos, player.pos, applyHit);
  } else if (monster.typeKey === 'lesser_demon') {
    spawnHellfireOrb(monster.pos, player.pos, applyHit);
  } else if (monster.typeKey === 'moss_guardian') {
    applyHit();
    spawnExpandingRing(player.pos, 0x22c55e, 0.65, 3.6, 0.4, 0.62);
    spawnBurst(player.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 8, 0x4ade80, 0.45, 2.4);
  } else if (monster.def.style === 'magic') {
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
    noteGather(STATE, def.item);
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

  // Monster names appear only while hovered or while they are the combat target.
  monstersList.forEach(m => {
    const aimed = player.targetEntity && player.targetEntity.type === 'monster' && player.targetEntity.ref === m;
    const hovered = hoveredWorld && hoveredWorld.type === 'monster' && hoveredWorld.entity === m;
    if (m.dead || (!aimed && !hovered && !m.inCombatWithPlayer)) {
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

    const tone = monsterThreatColor(m.def.level, playerCombatLvl);
    const col = tone === 'green' ? '#4ade80' : tone === 'red' ? '#f87171' : '#ffe642';

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
    const hovered = hoveredWorld && hoveredWorld.type === 'interactive' && hoveredWorld.name === n.name;
    const aimed = player.targetEntity && player.targetEntity.type === 'interactive' && player.targetEntity.ref && player.targetEntity.ref.name === n.name;
    if (!hovered && !aimed) {
      n.el.style.display = 'none';
      return;
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
          else if (act === 'slayer') openQuestsModal();
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
  if (player.parts.whipRig) {
    const stretch = player.attackAnim > 0 ? Math.sin(player.attackAnim * Math.PI) : 0;
    if (stretch > 0.001 || player.parts.whipRig.wasLashing) {
      syncWhipGeometry(player.parts.whipRig, stretch);
      player.parts.whipRig.wasLashing = stretch > 0.001;
    }
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
        m.breathCount = 0;
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
          poseMonsterLimbs(m, true, now, dt);
        } else {
          poseMonsterLimbs(m, false, now, dt);
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
          poseMonsterLimbs(m, true, now, dt);
        } else {
          poseMonsterLimbs(m, false, now, dt);
        }
      } else {
        poseMonsterLimbs(m, false, now, dt);
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
      const arc = p.arc == null ? 1.4 : p.arc;
      p.mesh.position.lerpVectors(p.start, p.end, p.progress);
      p.mesh.position.y += Math.sin(p.progress * Math.PI) * arc;
      if (p.orient) {
        const aheadT = Math.min(1, p.progress + 0.06);
        const next = new THREE.Vector3().lerpVectors(p.start, p.end, aheadT);
        next.y += Math.sin(aheadT * Math.PI) * arc;
        const dir = next.sub(p.mesh.position);
        if (dir.lengthSq() > 1e-8) {
          p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        }
      }
      if (p.onTick) p.onTick(p, dt);
    }
  }

  for (let i = vfxList.length - 1; i >= 0; i--) {
    const v = vfxList[i];
    v.age += dt;
    if (v.onTick) v.onTick(v, dt);
    if (v.age >= v.life) {
      scene.remove(v.mesh);
      vfxList.splice(i, 1);
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
  STATE.quests.openedBank = true;
  openModal('bank-modal');
  renderBankModal();
}

function openQuestsModal() {
  openModal('quest-modal');
  renderQuests();
}

function openSettingsModal() {
  syncSettingsButtons();
  openModal('settings-modal');
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
  bridge.showItemTooltip = (ev, it) => showItemTooltip(ev, it);
  bridge.moveItemTooltip = (ev) => moveItemTooltip(ev);
  bridge.hideItemTooltip = () => hideItemTooltip();
  bridge.claimQuest = (questId) => claimQuestReward(questId);
  bridge.locateRegion = (regionId) => locateQuestRegion(regionId);
  bridge.requestSlayer = () => requestSlayerTask();
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
