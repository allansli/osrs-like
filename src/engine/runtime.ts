// @ts-nocheck
import * as THREE from 'three';
import { TICK_SEC, player, camState, _tmpScratchVec, _camTargetVec, _lookTargetVec, telemetryInfo, G } from './context';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ITEMS, TIER_COLORS, isStackableInBackpack, unitSellPrice } from '../data/items';
import { SKILLS_META, OSRS_XP_TABLE, getLevelForXp } from '../data/skills';
import { PRAYERS, SPELLS } from '../data/magic';
import { tryCraft, isLogId } from '../data/recipes';
import { WORLD_REGIONS, MONSTER_TYPES, RESOURCE_NODES_DEF } from '../data/world';
import { STATE, applyState } from '../state/gameState';
import { addItem, removeItem, countItem, canAddItem, sellItem, buyItem, sellInventoryMatch, isGatheredGood, isUnequippedGear } from '../state/inventory';
import { readSave, writeSave, SAVE_KEY, LEGACY_SAVE_KEYS } from '../state/save';
import { prepareAttack, allowedStyles, mitigateDamage, canCastTeleport, equippedWeapon } from '../state/combat';
import {
  assignSlayerTask,
  adventureTracker,
  attackOptionLabel,
  applyRespawn,
  claimQuest,
  combatLevel,
  deathNotice,
  dharokMultiplier,
  gatherVerb,
  isBossLoot,
  hitSplatKind,
  isRareLoot,
  monsterThreatColor,
  noteGather,
  registerKill,
  RESPAWN_SECONDS,
  resolveDragonfire,
  slayerCard,
  weaponSpecial
} from '../state/adventure';
import { noteBury, notePlate, notePrayerOffered, notePurchase, noteSale } from '../state/quests';
import { moveWithCollision, isWalkable, isDeepWater } from '../state/collision';
import { getTerrainHeight, regionAt } from '../state/terrain';
import { discoverShrines } from '../state/shrines';
import { applyGold200k, applySkillsPlus10, matchCheat } from '../state/cheats';
import { addCartoonOutline, facetMaterial, grassMaterial, PALETTE } from './materials';
import {
  albedoForItem,
  albedoMaterial,
  applyAlbedo,
  assignGroundUvs,
  BIOME_COLORS,
  biomeAlbedoId,
  biomeGroundId,
  offsetAlbedoPhase,
  sealAlbedoUvs,
  speciesAlbedo,
  terrainMaterial
} from './textures';
import { buildHumanoidRig, LEAN_RIG } from './humanoid';
import { loadBlenderHeroTemplate, upgradeHumanoidRigWithGltf } from './blenderHero';
import { loadBlenderGearTemplate } from './blenderGear';
import { loadBlenderMonstersTemplate, upgradeMonsterRigWithGltf } from './blenderMonsters';
import {
  loadBlenderWorldTemplate,
  upgradeResourceNodeWithGltf,
  upgradeWorldPropWithGltf
} from './blenderWorld';
import {
  buildAmuletVisual,
  buildBodyVisual,
  buildBootVisual,
  buildCapeVisual,
  buildGloveVisual,
  buildHeadVisual,
  buildLegsVisual,
  buildRingVisual,
  buildShieldVisual,
  buildWeaponVisual,
  headShowsHair
} from './playerGear';
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
    slash: () => { tone(420, 'triangle', 0.08, 0.12, 180); },
    heavyChop: () => { tone(120, 'sawtooth', 0.16, 0.18, 40); tone(65, 'square', 0.12, 0.15, 30); },
    crush: () => { tone(180, 'square', 0.11, 0.16, 50); tone(90, 'sine', 0.14, 0.14, 40); },
    whipCrack: () => { tone(880, 'sawtooth', 0.04, 0.18, 220); setTimeout(() => tone(140, 'triangle', 0.09, 0.15, 60), 25); },
    crossbow: () => { tone(720, 'square', 0.06, 0.12, 280); setTimeout(() => tone(420, 'sine', 0.09, 0.10, 160), 30); },
    flinch: () => { tone(140, 'sine', 0.10, 0.11, 80); },
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
  const setCounts = {};
  for (const slot of Object.keys(STATE.equipment)) {
    const itemId = STATE.equipment[slot];
    if (itemId && ITEMS[itemId]) {
      const it = ITEMS[itemId];
      atk += (it.atk || 0);
      str += (it.str || 0);
      def += (it.def || 0);
      rng += (it.rng || 0);
      mag += (it.mag || 0);
      if (it.setName) {
        setCounts[it.setName] = (setCounts[it.setName] || 0) + 1;
      }
    }
  }

  const bodyIt = STATE.equipment.body ? ITEMS[STATE.equipment.body] : null;
  const legsIt = STATE.equipment.legs ? ITEMS[STATE.equipment.legs] : null;

  let dominantSetName = null;
  let dominantCount = 0;
  for (const [sName, count] of Object.entries(setCounts)) {
    if (count > dominantCount) {
      dominantSetName = sName;
      dominantCount = count;
    }
  }

  let matchedSet = null;
  let isFullKit = false;

  if (dominantSetName && dominantCount >= 4) {
    // 4+ matching kit pieces = Full Kit Set Bonus (+20% combat bonuses)
    matchedSet = `${dominantSetName} (${dominantCount} pcs)`;
    isFullKit = true;
    atk = Math.ceil(atk * 1.20);
    str = Math.ceil(str * 1.20);
    def = Math.ceil(def * 1.20);
    rng = Math.ceil(rng * 1.20);
    mag = Math.ceil(mag * 1.20);
  } else if (dominantSetName && dominantCount >= 3) {
    // 3 matching kit pieces = Tri-piece bonus (+15% combat bonuses)
    matchedSet = `${dominantSetName} (${dominantCount} pcs)`;
    atk = Math.ceil(atk * 1.15);
    str = Math.ceil(str * 1.15);
    def = Math.ceil(def * 1.15);
    rng = Math.ceil(rng * 1.15);
    mag = Math.ceil(mag * 1.15);
  } else if (bodyIt && legsIt && bodyIt.pairId === legsIt.id) {
    // Matched Top & Bottom pair = Pair bonus (+10% combat bonuses)
    matchedSet = bodyIt.setName || `${bodyIt.name} & ${legsIt.name}`;
    atk = Math.ceil(atk * 1.10);
    str = Math.ceil(str * 1.10);
    def = Math.ceil(def * 1.10);
    rng = Math.ceil(rng * 1.10);
    mag = Math.ceil(mag * 1.10);
  }

  return { atk, str, def, rng, mag, matchedSet, isFullKit, dominantCount, dominantSetName };
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
    spawnLevelUpFireworks();
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

function sellInventoryItem(index, qtyMode) {
  const slot = STATE.inventory[index];
  if (!slot) return;
  const item = ITEMS[slot.id];
  const mode = qtyMode ?? STATE.transferQty ?? 1;
  const result = sellItem(STATE, slot.id, mode);
  if (!result.ok) {
    addChatMessage(result.reason || 'Cannot sell that.', 'combat');
    return;
  }
  SFX.coin();
  noteSale(STATE);
  const name = item ? item.name : slot.id;
  addChatMessage('Sold <b>' + result.moved + ' × ' + name + '</b> for <b style="color:#ffe642">' + result.gp.toLocaleString() + ' GP</b> (65%).', 'loot');
  updateAllUI();
}

function sellPayoutLabel(itemId, mode) {
  const item = ITEMS[itemId];
  const have = countItem(STATE, itemId);
  const n = mode === 'all' ? have : Math.min(mode, have);
  const gp = (item ? unitSellPrice(item) : 1) * Math.max(0, n);
  return { n, gp };
}

function showSellChooseMenu(e, index) {
  const slot = STATE.inventory[index];
  if (!slot || !ITEMS[slot.id]) return;
  const modes = [1, 5, 10, 50, 'all'];
  const options = modes.map((mode) => {
    const payout = sellPayoutLabel(slot.id, mode);
    const label = mode === 'all'
      ? 'Sell All (' + payout.gp.toLocaleString() + ' GP)'
      : 'Sell ' + mode + ' (' + payout.gp.toLocaleString() + ' GP)';
    return {
      label,
      tone: 'yellow',
      run: () => sellInventoryItem(index, mode)
    };
  });
  options.push({ label: 'Cancel', run: () => {} });
  openChooseMenu(e.clientX, e.clientY, options);
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
    spawnHitSplatOnPlayer(healed, 'heal');
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
    noteBury(STATE);
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
    if (item.slot === 'body' && (item.id.includes('plate') || item.id.includes('chain'))) notePlate(STATE);
    SFX.coin();
    addChatMessage('Equipped <b>' + item.name + '</b> (' + item.slot + ').', 'skill');
    if (item.slot === 'weapon') {
      const styles = allowedStyles(ITEMS[item.id]);
      if (!styles.includes(STATE.combatStyle)) STATE.combatStyle = styles[0];
    }
    rebuildPlayerEquipmentMeshes();
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
    notePrayerOffered(STATE);
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
  const tracker = adventureTracker(STATE);
  const trackerTitle = document.getElementById('quest-tracker-title');
  const trackerStep = document.getElementById('quest-tracker-step');
  const trackerFill = document.getElementById('quest-tracker-fill');
  if (trackerTitle) trackerTitle.textContent = tracker.title;
  if (trackerStep) trackerStep.textContent = tracker.detail;
  if (trackerFill) trackerFill.style.width = `${Math.round((tracker.done / Math.max(1, tracker.total)) * 100)}%`;

  const card = slayerCard(STATE);
  const slayerName = document.getElementById('slayer-widget-name');
  const slayerDetail = document.getElementById('slayer-widget-detail');
  const slayerFill = document.getElementById('slayer-widget-fill');
  const slayerWidget = document.getElementById('slayer-widget');
  if (slayerName) slayerName.textContent = card.name;
  if (slayerDetail) slayerDetail.textContent = card.detail;
  if (slayerFill) slayerFill.style.width = `${Math.round(card.ratio * 100)}%`;
  if (slayerWidget) slayerWidget.classList.toggle('empty', card.empty);
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
      const reqInfo = getItemReqInfo(it);
      slotDiv.title = `${it.name}${statsInfo}\n${reqInfo.plain}\nLeft-Click: Use/Equip | Right-Click: Choose Option`;
      slotDiv.onclick = () => handleInventoryClick(i);
      slotDiv.onmouseenter = (ev) => showItemTooltip(ev, it);
      slotDiv.onmousemove = (ev) => moveItemTooltip(ev);
      slotDiv.onmouseleave = () => hideItemTooltip();
      slotDiv.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showSellChooseMenu(e, i);
      };
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
    if (bon.isFullKit) {
      pairStatusHtml = `<div style="margin-top:3px; color:#facc15; font-weight:800; text-shadow:0 0 10px rgba(250,204,21,0.6);">★ FULL KIT BONUS: ${bon.matchedSet} (+20% All Stats) ★</div>`;
    } else if (bon.dominantCount && bon.dominantCount >= 3) {
      pairStatusHtml = `<div style="margin-top:3px; color:#38bdf8; font-weight:800;">Set Synergy: ${bon.matchedSet} (+15% Stats) · Add 4th piece for Full Kit!</div>`;
    } else {
      pairStatusHtml = `<div style="margin-top:3px; color:#4ade80; font-weight:800;">Matched Pair: ${bon.matchedSet} (+10% Set Bonus)</div>`;
    }
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
    notePurchase(STATE);
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
  notePurchase(STATE);
  SFX.coin();
  addChatMessage('Purchased matched pair <b>' + ITEMS[topId].name + '</b> + <b>' + ITEMS[bottomId].name + '</b>.', 'loot');
  updateAllUI();
}

function sellAllLoot() {
  const result = sellInventoryMatch(STATE, isGatheredGood, 'No raw resources in your backpack to bulk-sell.');
  if (!result.ok) {
    addChatMessage(result.reason || 'No raw resources in your backpack to bulk-sell.');
    return;
  }
  SFX.coin();
  addChatMessage('Sold ' + result.moved + ' gathered goods for <b style="color:#ffe642">' + (result.gp || 0).toLocaleString() + ' GP</b> (65%).', 'loot');
  updateAllUI();
}

function sellAllUnequippedGear() {
  const result = sellInventoryMatch(STATE, isUnequippedGear, 'No unequipped gear in your backpack to sell.');
  if (!result.ok) {
    addChatMessage(result.reason || 'No unequipped gear in your backpack to sell.');
    return;
  }
  SFX.coin();
  addChatMessage('Sold ' + result.moved + ' unequipped gear for <b style="color:#ffe642">' + (result.gp || 0).toLocaleString() + ' GP</b> (65%).', 'loot');
  updateAllUI();
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

    // One-time automatic migration for existing saves:
    // If the saved character was wearing the starter outfit (hood, tunic, trousers, cape) that covers
    // the newly overhauled BlendSwap 4503 Anime RPG character model, un-equip them so the new model is instantly visible!
    const OVERHAUL_FLAG = 'gielinor_anime_hero_v1';
    if (!localStorage.getItem(OVERHAUL_FLAG)) {
      try { localStorage.setItem(OVERHAUL_FLAG, '1'); } catch (e) {}
      if (STATE.equipment.head === 'hylian_hood') STATE.equipment.head = null;
      if (STATE.equipment.body === 'hylian_tunic') STATE.equipment.body = null;
      if (STATE.equipment.cape === 'hylian_cape') STATE.equipment.cape = null;
      if (STATE.equipment.legs === 'hylian_trousers') STATE.equipment.legs = null;
      if (STATE.equipment.feet === 'leather_boots') STATE.equipment.feet = null;
      if (STATE.equipment.hands === 'leather_gloves') STATE.equipment.hands = null;
      if (camState) {
        camState.manualOffset = 0.65;
        camState.pitch = 0.18;
        camState.distance = 5.2;
      }
    }
    if (migrated.pose && player && player.pos) {
      player.pos.x = migrated.pose.x;
      player.pos.z = migrated.pose.z;
      if (typeof migrated.pose.yaw === 'number') player.yaw = migrated.pose.yaw;
    }
    if (migrated.cam && camState) {
      camState.yaw = migrated.cam.yaw;
      camState.manualOffset = migrated.cam.manualOffset;
      camState.pitch = Math.min(migrated.cam.pitch, 0.42);
      camState.distance = Math.min(migrated.cam.distance, 9.5);
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


function getBiomeColor(x, z, h) {
  const dirt = new THREE.Color(PALETTE.dirt);
  const grass = [PALETTE.sageShade, PALETTE.sage, PALETTE.sageLit].map((hex) => new THREE.Color(hex));
  if (h < -0.05) return dirt;
  if (z > -22 && z < 8 && x > -8 && x < 82 && Math.abs(z - (-x * 0.22)) < 2.6) return dirt;
  if (Math.hypot(x - 78, z + 20) < 18) return dirt;
  if (x > 40 && z > 36) return new THREE.Color(BIOME_COLORS.sand);
  if (x < -40 && z > 36) return new THREE.Color(h > 3.1 ? BIOME_COLORS.lava : BIOME_COLORS.crag);
  if (x < -40 && z < 0) return new THREE.Color(BIOME_COLORS.canopy);
  const band = Math.abs(Math.floor(x / 7) + Math.floor(z / 7) * 2) % 3;
  return grass[band];
}


type QualityTier = 'performance' | 'balanced' | 'high' | 'ultra';
let currentQuality: QualityTier = 'balanced';
let outlinesEnabled = true;

function getQualityDpr(tier: QualityTier): number {
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  switch (tier) {
    case 'performance': return 1.0;
    case 'balanced': return Math.min(dpr, 1.25);
    case 'high': return Math.min(dpr, 1.5);
    case 'ultra': return Math.min(dpr, 2.0);
  }
}

function applyQualityTier(tier: QualityTier): void {
  currentQuality = tier;
  const dpr = getQualityDpr(tier);
  if (G.renderer && typeof window !== 'undefined') {
    G.renderer.setPixelRatio(dpr);
    G.renderer.setSize(window.innerWidth, window.innerHeight);
    if (tier === 'performance') {
      G.renderer.shadowMap.enabled = false;
    } else {
      G.renderer.shadowMap.enabled = true;
      G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (G.sunLight) {
        G.sunLight.castShadow = true;
        const res = tier === 'ultra' ? 2048 : (tier === 'high' ? 2048 : 1024);
        G.sunLight.shadow.mapSize.set(res, res);
      }
    }
  }
  const dprEl = document.getElementById('perf-dpr');
  if (dprEl) dprEl.textContent = `${dpr.toFixed(2)}x DPR`;
  syncGraphicsButtons();
}

function cycleGraphicsQuality(): void {
  const tiers: QualityTier[] = ['performance', 'balanced', 'high', 'ultra'];
  const nextIdx = (tiers.indexOf(currentQuality) + 1) % tiers.length;
  applyQualityTier(tiers[nextIdx]);
  addChatMessage(`Graphics Quality set to <b>${tiers[nextIdx].toUpperCase()}</b> (${getQualityDpr(tiers[nextIdx]).toFixed(2)}x DPR).`, 'skill');
}

function toggleOutlines(): void {
  outlinesEnabled = !outlinesEnabled;
  if (G.scene) {
    G.scene.traverse((obj) => {
      if (obj.userData?.isOutline) {
        obj.visible = outlinesEnabled;
      }
    });
  }
  syncGraphicsButtons();
  addChatMessage(`Cartoon Outlines <b>${outlinesEnabled ? 'Enabled' : 'Disabled (Ultra FPS)'}</b>.`, 'skill');
}

function syncGraphicsButtons(): void {
  const gBtn = document.getElementById('graphics-quality-btn');
  if (gBtn) gBtn.textContent = `Graphics: ${currentQuality.charAt(0).toUpperCase() + currentQuality.slice(1)}`;
  const oBtn = document.getElementById('outlines-toggle-btn');
  if (oBtn) oBtn.textContent = outlinesEnabled ? 'Outlines: On' : 'Outlines: Off';
}


function initGpuTelemetry(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      telemetryInfo.gpuName = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || 'WebGL Renderer';
      telemetryInfo.vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '';
    } else {
      telemetryInfo.gpuName = (gl.getParameter(gl.RENDERER) as string) || 'WebGL';
    }
  } catch {
    telemetryInfo.gpuName = 'Hardware WebGL';
  }

  const lower = telemetryInfo.gpuName.toLowerCase();
  let cleanName = telemetryInfo.gpuName;
  const match = telemetryInfo.gpuName.match(/NVIDIA GeForce [^,)]+|Radeon [^,)]+|Intel\(R\) [^,)]+/i);
  if (match) cleanName = match[0];

  telemetryInfo.isHardwareAccelerated = !/swiftshader|software|llvmpipe|basic render/i.test(lower);

  const nameEl = document.getElementById('perf-gpu-name');
  const dotEl = document.getElementById('perf-dot');
  if (nameEl) {
    if (!telemetryInfo.isHardwareAccelerated) {
      nameEl.textContent = 'CPU SwiftShader (GPU Acceleration OFF!)';
      nameEl.title = 'Hardware acceleration is disabled in your browser. Enable it in chrome://settings/system!';
      if (dotEl) dotEl.className = 'perf-status-dot warning';
    } else {
      nameEl.textContent = cleanName;
      nameEl.title = telemetryInfo.gpuName;
      if (dotEl) dotEl.className = 'perf-status-dot';
    }
  }
}

function init3DEngine() {
  const container = document.getElementById('game-canvas-container');
  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.FogExp2(0x9ab0c2, 0.0028);

  G.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 360);

  G.renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    precision: 'highp',
    stencil: false,
    depth: true
  });
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(getQualityDpr(currentQuality));
  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.renderer.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer.toneMappingExposure = 1.05;
  G.renderer.domElement.id = 'game-canvas';
  container.appendChild(G.renderer.domElement);

  initGpuTelemetry(G.renderer.getContext());
  applyQualityTier('balanced');

  G.hemiLight = new THREE.HemisphereLight(0xa5b8c9, 0x333d32, 0.52);
  G.scene.add(G.hemiLight);

  G.ambientLight = new THREE.AmbientLight(0x617282, 0.28);
  G.scene.add(G.ambientLight);

  G.sunLight = new THREE.DirectionalLight(0xf8f5ed, 1.15);
  G.sunLight.position.set(45, 68, 35);
  G.sunLight.castShadow = true;
  G.sunLight.shadow.mapSize.width = 2048;
  G.sunLight.shadow.mapSize.height = 2048;
  G.sunLight.shadow.camera.near = 5;
  G.sunLight.shadow.camera.far = 170;
  const d = 54;
  G.sunLight.shadow.camera.left = -d;
  G.sunLight.shadow.camera.right = d;
  G.sunLight.shadow.camera.top = d;
  G.sunLight.shadow.camera.bottom = -d;
  G.sunLight.shadow.bias = -0.0004;
  G.scene.add(G.sunLight);
  G.scene.add(G.sunLight.target);

  buildSkyDomeShader();
  buildTerrainAndWater();
  buildAllCitiesAndLandmarks();
  buildPlayerCharacter();
  spawnAllResourcesAndMonsters();
  sealAlbedoUvs(G.scene);

  window.addEventListener('resize', onWindowResize);
  setupInputHandlers();
}

// Custom GLSL Atmospheric Sky Dome with Volumetric Clouds & Sun Disc
function buildSkyDomeShader() {
  G.skyUniforms = {
    uTime: { value: 0 },
    uTopColor: { value: new THREE.Color(PALETTE.skyZenith) },
    uMidColor: { value: new THREE.Color(PALETTE.skyMid) },
    uHorizonColor: { value: new THREE.Color(PALETTE.skyHorizon) }
  };

  const skyGeo = new THREE.SphereGeometry(290, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: G.skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vNormPos;
      void main() {
        vNormPos = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      varying vec3 vNormPos;
      void main() {
        float h = clamp(vNormPos.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, h));
        col = mix(col, uTopColor, smoothstep(0.28, 0.85, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  G.skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
  G.scene.add(G.skyDomeMesh);
}

function cycleTimeOfDay() {
  STATE.timeOfDay = (STATE.timeOfDay + 1) % 3;
  const btn = document.getElementById('time-of-day-btn');
  if (STATE.timeOfDay === 0) {
    G.skyUniforms.uTopColor.value.setHex(0x253545);
    G.skyUniforms.uMidColor.value.setHex(0x5a6875);
    G.skyUniforms.uHorizonColor.value.setHex(0x8a8a92);
    G.scene.fog.color.setHex(0x8a8a92);
    G.scene.fog.density = 0.0030;
    if (btn) btn.textContent = 'Golden Hour';
  } else if (STATE.timeOfDay === 1) {
    G.skyUniforms.uTopColor.value.setHex(0x2e4359);
    G.skyUniforms.uMidColor.value.setHex(0x5f788e);
    G.skyUniforms.uHorizonColor.value.setHex(0x9ab0c2);
    G.scene.fog.color.setHex(0x9ab0c2);
    G.scene.fog.density = 0.0028;
    if (btn) btn.textContent = 'High Noon';
  } else {
    G.skyUniforms.uTopColor.value.setHex(0x090e14);
    G.skyUniforms.uMidColor.value.setHex(0x141d27);
    G.skyUniforms.uHorizonColor.value.setHex(0x1e2936);
    G.scene.fog.color.setHex(0x1e2936);
    G.scene.fog.density = 0.0042;
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
  assignGroundUvs(geo);

  const mat = terrainMaterial();
  G.terrainMesh = new THREE.Mesh(geo, mat);
  G.terrainMesh.receiveShadow = true;
  G.terrainMesh.userData = { type: 'ground' };
  G.scene.add(G.terrainMesh);
  G.worldInteractiveObjects.push(G.terrainMesh);

  // Custom GLSL Animated Water Shader with Specular Sun Glint & Ripples
  G.waterUniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(PALETTE.water) },
    uShallowColor: { value: new THREE.Color(PALETTE.foam) }
  };

  const waterGeo = new THREE.PlaneGeometry(size, size, 24, 24);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: G.waterUniforms,
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
        float foam = smoothstep(0.48, 0.78, rip);
        vec3 col = mix(uDeepColor, uShallowColor, foam);
        gl_FragColor = vec4(col, 0.94);
      }
    `
  });
  G.waterMesh = new THREE.Mesh(waterGeo, waterMat);
  G.waterMesh.position.y = -0.34;
  G.scene.add(G.waterMesh);

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
  G.grassInstanced = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
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
    G.grassInstanced.setMatrixAt(idx++, dummy.matrix);
  }
  G.grassInstanced.instanceMatrix.needsUpdate = true;
  G.scene.add(G.grassInstanced);
}

function buildRiverBridge(bx, bz) {
  const grp = new THREE.Group();
  grp.position.set(bx, 0, bz);
  const woodMat = albedoMaterial(0x42352a, 'wood');
  const stoneMat = albedoMaterial(0x505a63, 'stone');

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
  sealAlbedoUvs(grp);
  G.scene.add(grp);
  addCartoonOutline(grp, 0.038);
  loadBlenderWorldTemplate().then((gltf) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_river_bridge', gltf, { outlineThickness: 0.035 });
  });
}

function buildBiomeLandmarks() {
  const sand = albedoMaterial(0xe7c07a, biomeAlbedoId('alkharid-sand'));
  const palm = albedoMaterial(0x4ade80, 'grass');
  const bark = albedoMaterial(0x92400e, 'bark');
  const moss = albedoMaterial(0x4ade80, biomeAlbedoId('korok-moss'));
  const stone = albedoMaterial(0xe5e7eb, biomeAlbedoId('varrock-cobble'));
  const gold = facetMaterial({ color: 0xfacc15 });
  const obsidian = albedoMaterial(0xa8a29e, biomeAlbedoId('peak-volcanic'));
  const lava = facetMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.85 });

  function place(builder, x, z, worldAssetName, overrides = {}) {
    const grp = builder();
    grp.position.set(x, getTerrainHeight(x, z), z);
    sealAlbedoUvs(grp);
    addCartoonOutline(grp, 0.038);
    G.scene.add(grp);
    if (worldAssetName) {
      loadBlenderWorldTemplate().then((gltf) => {
        if (!gltf) return;
        upgradeWorldPropWithGltf(grp, worldAssetName, gltf, { overrides, outlineThickness: 0.035 });
      });
    }
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
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), moss);
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

  place(sandstoneArch, 80, 82, 'World_sandstone_arch');
  place(palmTree, 58, 58, 'World_palm_tree');
  place(palmTree, 74, 52, 'World_palm_tree');
  place(plazaPillar, 70, -16, 'World_plaza_pillar');
  place(plazaPillar, 86, -24, 'World_plaza_pillar');
  place(plazaPillar, 78, -30, 'World_plaza_pillar');
  place(() => mysticMushroom(0xa855f7), -66, -22, 'World_mystic_mushroom', { mushroomHex: 0xa855f7 });
  place(() => mysticMushroom(0x22d3ee), -84, -26, 'World_mystic_mushroom', { mushroomHex: 0x22d3ee });
  place(woodsLantern, -72, -38, 'World_woods_lantern');
  place(woodsLantern, -90, -34, 'World_woods_lantern');
  place(obsidianSpire, -58, 62, 'World_obsidian_spire');
  place(obsidianSpire, -66, 90, 'World_obsidian_spire');
  place(lavaFissure, -74, 70, 'World_lava_fissure');
}

function buildAllCitiesAndLandmarks() {
  WORLD_REGIONS.forEach(reg => {
    const sx = reg.x;
    const sz = reg.z - 6;
    const sy = getTerrainHeight(sx, sz);
    const shrineGroup = new THREE.Group();
    shrineGroup.position.set(sx, sy, sz);
    const stone = albedoMaterial(0x525c66, 'stone');
    const slate = albedoMaterial(0x2d333b, 'slate');
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
      facetMaterial({ color: 0x5d8096, emissive: 0x2d4857, emissiveIntensity: 0.45, flatShading: true })
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
    G.worldInteractiveObjects.push(pillar, rune);
    addCartoonOutline(shrineGroup, 0.038);
    G.scene.add(shrineGroup);
    loadBlenderWorldTemplate().then((gltf) => {
      if (!gltf) return;
      upgradeWorldPropWithGltf(shrineGroup, 'World_shrine', gltf, {
        interactiveObjectsList: G.worldInteractiveObjects,
        outlineThickness: 0.035
      });
    });
  });

  // 2. Sculpted Lumbridge Castle Keep & Cylindrical Battlement Towers
  createCastleStructure(0, -25);
  createCastleGuard(-2.4, -16.5, 'Lumbridge Castle Guard', 0);
  createCastleGuard(2.4, -16.5, 'Lumbridge Castle Guard', 0);

  // BlendSwap #6679 Props: Barrels, Crates, Cabbage & Apple Boxes, Grain Sacks
  spawnWorldProp('World_barrel', -3.6, -17.8, 0.4);
  spawnWorldProp('World_barrel', 3.6, -17.8, -0.3);
  spawnWorldProp('World_crate', -4.8, -18.4, 0.2);
  spawnWorldProp('World_crate', 4.8, -18.4, -0.5);
  spawnWorldProp('World_box_cabbage', -3.5, -22.0, 0.1);
  spawnWorldProp('World_box_apples', 3.5, -22.0, -0.2);
  spawnWorldProp('World_bag_grain', -5.0, -23.5, 0.3);
  spawnWorldProp('World_bag_closed', 5.0, -23.5, -0.4);

  spawnWorldProp('World_barrel', 12.2, -3.2, 0.2);
  spawnWorldProp('World_crate', 12.5, -4.5, -0.3);

  spawnWorldProp('World_bag_grain', -0.5, 5.5, 0.2);
  spawnWorldProp('World_barrel', 4.2, 5.2, -0.2);

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
  const stoneMat = albedoMaterial(0x525c66, 'stone');
  const roofMat = albedoMaterial(0x2d333b, 'slate');
  const goldMat = facetMaterial({ color: 0x8f7d4e });
  const timberMat = albedoMaterial(0x42352a, 'wood');
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
  sealAlbedoUvs(grp);
  addCartoonOutline(grp, 0.03);
  G.scene.add(grp);
  loadBlenderWorldTemplate().then((gltf) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_castle', gltf, { outlineThickness: 0.03 });
  });
}

function createPrayerAltar(x, z, name) {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);

  const marbleMat = albedoMaterial(0x6b7280, 'stone');
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 1.15), marbleMat);
  base.position.y = 0.42;
  base.castShadow = true;
  grp.add(base);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 1.4), albedoMaterial(0x525c66, 'stone'));
  slab.position.y = 0.92;
  grp.add(slab);
  const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.08, 0.12), facetMaterial({ color: 0x8f7d4e }));
  goldTrim.position.set(0, 0.7, 0.58);
  grp.add(goldTrim);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    facetMaterial({ color: 0x5d8096, emissive: 0x2d4857, emissiveIntensity: 0.35, flatShading: true })
  );
  crystal.position.y = 1.45;
  grp.add(crystal);

  const uData = { type: 'interactive', action: 'altar', name, interactRadius: 4.0 };
  grp.userData = uData;
  base.userData = uData;
  crystal.userData = uData;
  G.worldInteractiveObjects.push(base, crystal);
  addCartoonOutline(grp, 0.038);
  G.scene.add(grp);
  G.npcList.push({ pos: grp.position, name, color: '#38bdf8', yOffset: 3.4 });
  loadBlenderWorldTemplate().then((gltf) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_altar', gltf, {
      interactiveObjectsList: G.worldInteractiveObjects,
      outlineThickness: 0.035
    });
  });
}

function createForgeStation(x, z, name) {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);

  // Sculpted Blacksmith Horn Anvil (Lathe + Extruded Bevel Top)
  const ironMat = albedoMaterial(0x334155, 'iron');
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
    albedoMaterial(0x92400e, 'wood')
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
  G.worldInteractiveObjects.push(anvilTop, furnace);
  addCartoonOutline(grp, 0.038);
  G.scene.add(grp);
  G.npcList.push({ pos: grp.position, name, color: '#ff981f', yOffset: 3.5 });
  loadBlenderWorldTemplate().then((gltf) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_forge', gltf, {
      interactiveObjectsList: G.worldInteractiveObjects,
      outlineThickness: 0.035
    });
  });
}

function createBankBooth(x, z) {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const wood = albedoMaterial(0x6b4423, 'wood');
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
  G.worldInteractiveObjects.push(rig.hitbox, counter);
  addCartoonOutline(counter, 0.038);
  addCartoonOutline(lintel, 0.038);
  G.scene.add(grp);
  G.npcList.push({ pos: grp.position, name: 'Lumbridge Bank', color: '#fde047', yOffset: 2.6 });
  loadBlenderHeroTemplate().then((gltf) => {
    if (!gltf) return;
    const anim = upgradeHumanoidRigWithGltf(rig, gltf, 0x1e3a8a, 0xfacc15, 0x334155, { isPlayer: false });
    if (anim) G.npcAnimatorsList.push(anim);
  });
  loadBlenderWorldTemplate().then((gltf) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_bank_booth', gltf, {
      keepChildren: (ch) => ch === sign || ch === rig.group,
      interactiveObjectsList: G.worldInteractiveObjects,
      outlineThickness: 0.035
    });
  });
}

function createSlayerMaster(x, z) {
  const y = getTerrainHeight(x, z);
  const rig = buildHumanoidRig(0x4c1d95, 0x1c1917, 0x111827, 1.05);
  rig.group.position.set(x, y, z);
  let vannakaWep = null;
  let vannakaCape = null;
  const attachVannakaGear = () => {
    if (vannakaWep && vannakaWep.parent) vannakaWep.parent.remove(vannakaWep);
    if (vannakaCape && vannakaCape.parent) vannakaCape.parent.remove(vannakaCape);
    const wepVis = buildWeaponVisual(ITEMS.godsword || ITEMS.rune_2h || { id: 'godsword', iconKind: 'greatsword', slot: 'weapon', color: 0xfacc15, trim: 0xfde047 });
    if (rig.rightElbowPivot) {
      wepVis.group.position.set(0.19, -0.32, 0.08);
      wepVis.group.rotation.set(-0.2, 0.0, 0.1);
      rig.rightElbowPivot.add(wepVis.group);
    } else {
      wepVis.group.position.set(0, LEAN_RIG.handY, -0.08);
      rig.rightArmPivot.add(wepVis.group);
    }
    vannakaWep = wepVis.group;
    addCartoonOutline(vannakaWep, 0.02);

    const capeVis = buildCapeVisual({ id: 'slayer_cape', slot: 'cape', color: 0x4c1d95, trim: 0xfacc15 });
    if (rig.group.userData.isBlenderHero || rig.leftElbowPivot) {
      capeVis.position.set(0, 0.22, 0.02);
    } else {
      capeVis.position.set(0, 0.285, 0.175);
    }
    rig.torso.add(capeVis);
    vannakaCape = capeVis;
    addCartoonOutline(vannakaCape, 0.02);
  };
  attachVannakaGear();
  const uData = { type: 'interactive', action: 'slayer', name: 'Slayer Master Vannaka', interactRadius: 4.0 };
  rig.group.userData = uData;
  rig.hitbox.userData = uData;
  G.worldInteractiveObjects.push(rig.hitbox);
  G.scene.add(rig.group);
  G.npcList.push({ pos: rig.group.position, name: 'Slayer Master Vannaka', color: '#c084fc', yOffset: 2.9 });
  Promise.all([loadBlenderHeroTemplate(), loadBlenderGearTemplate()]).then(([heroGltf]) => {
    if (heroGltf) {
      const anim = upgradeHumanoidRigWithGltf(rig, heroGltf, 0x4c1d95, 0x1c1917, 0x111827, { isPlayer: false });
      if (anim) G.npcAnimatorsList.push(anim);
    }
    attachVannakaGear();
  });
}

function createMerchantNPC(x, z, name, tunicColor) {
  const y = getTerrainHeight(x, z);
  const rig = buildHumanoidRig(tunicColor, 0xfacc15, 0x334155, 1.02);
  rig.group.position.set(x, y, z);
  const uData = { type: 'interactive', action: 'shop', name, interactRadius: 4.0 };
  rig.group.userData = uData;
  rig.hitbox.userData = uData;
  G.worldInteractiveObjects.push(rig.hitbox);
  G.scene.add(rig.group);
  G.npcList.push({ pos: rig.group.position, name, color: '#ffe642', yOffset: 2.85 });
  Promise.all([loadBlenderHeroTemplate(), loadBlenderGearTemplate()]).then(([heroGltf]) => {
    if (heroGltf) {
      const anim = upgradeHumanoidRigWithGltf(rig, heroGltf, tunicColor, 0xfacc15, 0x334155, { isPlayer: false });
      if (anim) G.npcAnimatorsList.push(anim);
    }
    const hatItem = name.includes('Varrock')
      ? { id: 'wizard_hat', slot: 'head', iconKind: 'hat', color: tunicColor, trim: 0xfacc15 }
      : name.includes('Al-Kharid')
      ? { id: 'hood', slot: 'head', iconKind: 'hood', color: tunicColor, trim: 0xfacc15 }
      : { id: 'circlet', slot: 'head', iconKind: 'circlet', color: 0x38bdf8, trim: 0xfacc15 };
    const hat = buildHeadVisual(hatItem);
    if (rig.leftElbowPivot || rig.group.userData.isBlenderHero) {
      hat.scale.set(0.74, 0.74, 0.74);
      hat.position.set(0, -0.16, 0.01);
    }
    rig.headGroup.add(hat);
    addCartoonOutline(hat, 0.018);
  });
}

let cachedGuardPromise: Promise<GLTF | null> | null = null;
function loadBlenderGuardTemplate(): Promise<GLTF | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (!cachedGuardPromise) {
    const loader = new GLTFLoader();
    cachedGuardPromise = new Promise((resolve) => {
      loader.load(
        '/models/guard.glb',
        (gltf) => resolve(gltf),
        undefined,
        (err) => {
          console.warn('[Guard] Failed to load guard.glb:', err);
          resolve(null);
        }
      );
    });
  }
  return cachedGuardPromise;
}

function createCastleGuard(x: number, z: number, name: string, rotY = 0) {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;

  const uData = {
    type: 'interactive',
    action: 'dialogue',
    name,
    dialogue: 'Halt! Welcome to Lumbridge Castle, adventurer. Keep your weapons sheathed within the courtyard.',
    interactRadius: 3.5
  };
  grp.userData = uData;

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.85, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 0.92;
  hitbox.userData = uData;
  grp.add(hitbox);
  G.worldInteractiveObjects.push(hitbox);
  G.scene.add(grp);
  G.npcList.push({ pos: grp.position, name, color: '#94a3b8', yOffset: 2.5 });

  loadBlenderGuardTemplate().then((gltf) => {
    if (!gltf) return;
    const cloned = gltf.scene.clone(true);
    cloned.position.set(0, 0, 0);
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        m.userData = { ...m.userData, ...uData };
      }
    });
    grp.add(cloned);
    addCartoonOutline(cloned, 0.024);
  });
}

function spawnWorldProp(assetName: string, x: number, z: number, rotY = 0, scale = 1.0) {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  if (scale !== 1.0) grp.scale.set(scale, scale, scale);
  G.scene.add(grp);

  loadBlenderWorldTemplate().then((gltf) => {
    if (!gltf) return;
    const node = gltf.scene.getObjectByName(assetName);
    if (!node) return;
    const cloned = node.clone(true);
    cloned.position.set(0, 0, 0);
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    grp.add(cloned);
    sealAlbedoUvs(grp);
    addCartoonOutline(grp, 0.028);
  });
}



// ============================================================================
// 8. SMOOTH SCULPTED 3D CHARACTER, 10-SLOT GEAR, MONSTERS & ORGANIC TREES
// ============================================================================
function buildPlayerCharacter() {
  const rig = buildHumanoidRig(0x586436, 0x3e2b1e, 0x505c30, 1.06);
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
  G.scene.add(player.meshGroup);

  rebuildPlayerEquipmentMeshes();

  loadBlenderHeroTemplate().then((gltf) => {
    if (!gltf) return;
    const animator = upgradeHumanoidRigWithGltf(rig, gltf, 0x586436, 0x3e2b1e, 0x505c30, {
      isPlayer: true,
      bootHex: 0x342418,
      skinHex: 0xf5d8c2
    });
    if (animator) {
      player.blenderAnimator = animator;
      rebuildPlayerEquipmentMeshes();
    }
  });
  loadBlenderGearTemplate().then((gearGltf) => {
    if (!gearGltf) return;
    rebuildPlayerEquipmentMeshes();
  });
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
  const lLeg = player.parts.leftLegPivot;
  const rLeg = player.parts.rightLegPivot;

  const gearKeys = [
    'wepMesh', 'shieldMesh', 'helmMesh', 'capeMesh', 'amuletMesh', 'ringMesh',
    'bodyArmorMesh', 'bodyArmL', 'bodyArmR',
    'legsArmorMesh', 'legsArmorL', 'legsArmorR',
    'feetMeshL', 'feetMeshR', 'handsMeshL', 'handsMeshR', 'setBonusCue'
  ];
  gearKeys.forEach((key) => {
    const node = player.parts[key];
    if (node && node.parent) node.parent.remove(node);
    player.parts[key] = null;
  });
  player.parts.whipRig = null;

  const mount = (parent, node, key) => {
    if (!parent || !node) return;
    parent.add(node);
    player.parts[key] = node;
  };

  // 1. Body Armor Material
  const bodyId = STATE.equipment.body;
  if (bodyId && ITEMS[bodyId]) {
    player.parts.tunicMat.color.setHex(ITEMS[bodyId].color || 0x586436);
    player.parts.tunicMat.metalness = bodyId === 'champion_tunic' ? 0.1 : 0.65;
    player.parts.tunicMat.roughness = bodyId === 'champion_tunic' ? 0.5 : 0.28;
    applyAlbedo(player.parts.tunicMat, albedoForItem(ITEMS[bodyId]));
  } else {
    player.parts.tunicMat.color.setHex(0x586436);
    player.parts.tunicMat.metalness = 0.08;
    player.parts.tunicMat.roughness = 0.52;
    applyAlbedo(player.parts.tunicMat, 'gear:cloth');
  }

  // 2. Leg Armor Material (Platelegs / Tassets / Trousers)
  const legsId = STATE.equipment.legs;
  if (legsId && ITEMS[legsId]) {
    player.parts.legsMat.color.setHex(ITEMS[legsId].color || 0x505c30);
    player.parts.legsMat.metalness = legsId === 'hylian_trousers' ? 0.05 : 0.65;
    player.parts.legsMat.roughness = legsId === 'hylian_trousers' ? 0.65 : 0.28;
    applyAlbedo(player.parts.legsMat, albedoForItem(ITEMS[legsId]));
  } else {
    player.parts.legsMat.color.setHex(0x505c30);
    player.parts.legsMat.metalness = 0.05;
    applyAlbedo(player.parts.legsMat, 'gear:cloth');
  }

  // 3. Boots Material (Feet)
  const feetId = STATE.equipment.feet;
  if (feetId && ITEMS[feetId]) {
    player.parts.bootMat.color.setHex(ITEMS[feetId].color || 0x342418);
    player.parts.bootMat.metalness = feetId === 'leather_boots' ? 0.1 : 0.65;
    applyAlbedo(player.parts.bootMat, albedoForItem(ITEMS[feetId]));
  } else {
    player.parts.bootMat.color.setHex(0x342418);
    player.parts.bootMat.metalness = 0.1;
    applyAlbedo(player.parts.bootMat, 'gear:leather');
  }

  // 4. Gauntlets Material (Hands & Bracers)
  const handsId = STATE.equipment.hands;
  if (handsId && ITEMS[handsId]) {
    player.parts.gloveMat.color.setHex(ITEMS[handsId].color || 0x78350f);
    player.parts.gloveMat.metalness = handsId === 'leather_gloves' ? 0.1 : 0.6;
    applyAlbedo(player.parts.gloveMat, albedoForItem(ITEMS[handsId]));
    if (player.parts.bracerMat) {
      player.parts.bracerMat.color.setHex(ITEMS[handsId].color || 0x78350f);
      player.parts.bracerMat.metalness = handsId === 'leather_gloves' ? 0.1 : 0.65;
      player.parts.bracerMat.roughness = handsId === 'leather_gloves' ? 0.65 : 0.3;
      applyAlbedo(player.parts.bracerMat, albedoForItem(ITEMS[handsId]));
    }
  } else {
    player.parts.gloveMat.color.setHex(0xf5d8c2);
    player.parts.gloveMat.metalness = 0.05;
    applyAlbedo(player.parts.gloveMat, 'creature:skin');
    if (player.parts.bracerMat) {
      player.parts.bracerMat.color.setHex(0x4e3524);
      player.parts.bracerMat.metalness = 0.1;
      player.parts.bracerMat.roughness = 0.65;
      applyAlbedo(player.parts.bracerMat, 'gear:leather');
    }
  }

  const equip = (slot) => {
    const id = STATE.equipment[slot];
    return id && ITEMS[id] ? ITEMS[id] : null;
  };

  const isBlenderHero = !!player.parts.leftElbowPivot;

  const weapon = equip('weapon');
  if (weapon) {
    const visual = buildWeaponVisual(weapon);
    if (player.parts.rightElbowPivot) {
      visual.group.position.set(0.19, -0.32, 0.08);
      visual.group.rotation.set(-0.2, 0.0, 0.1);
      mount(player.parts.rightElbowPivot, visual.group, 'wepMesh');
    } else {
      visual.group.position.set(0, LEAN_RIG.handY, -0.08);
      mount(rArm, visual.group, 'wepMesh');
    }
    player.parts.whipRig = visual.whipRig;
    if (visual.whipRig) syncWhipGeometry(visual.whipRig, 0);
  }

  const shieldItem = equip('shield');
  if (shieldItem) {
    const shield = buildShieldVisual(shieldItem);
    const defender = shield.userData.silhouette === 'defender';
    if (player.parts.leftElbowPivot) {
      if (defender) {
        shield.position.set(-0.19, -0.31, 0.08);
        shield.rotation.set(0, 0, 0);
      } else {
        shield.position.set(-0.20, -0.22, 0.08);
        shield.rotation.set(0, -Math.PI / 2, 0);
      }
      mount(player.parts.leftElbowPivot, shield, 'shieldMesh');
    } else {
      shield.position.set(defender ? 0.0 : -0.08, defender ? LEAN_RIG.handY + 0.04 : -0.46, defender ? -0.1 : -0.05);
      mount(lArm, shield, 'shieldMesh');
    }
  }

  const headItem = equip('head');
  const showHair = headShowsHair(headItem);
  if (player.parts.hairCap) player.parts.hairCap.visible = showHair;
  if (headG) {
    headG.traverse((ch) => {
      if (
        ch.name.startsWith('Hair') ||
        ch.name.startsWith('CrownSpike_') ||
        ch.name.startsWith('BackSpike_') ||
        ch.name.startsWith('Sideburn_')
      ) {
        ch.visible = showHair;
      }
    });
  }
  if (headItem) {
    const helmVisual = buildHeadVisual(headItem);
    if (isBlenderHero) {
      helmVisual.scale.set(0.74, 0.74, 0.74);
      helmVisual.position.set(0, -0.16, 0.01);
    }
    mount(headG, helmVisual, 'helmMesh');
  }

  const bodyItem = equip('body');
  if (bodyItem) {
    const body = buildBodyVisual(bodyItem);
    mount(torso, body.torso, 'bodyArmorMesh');
    mount(lArm, body.left, 'bodyArmL');
    mount(rArm, body.right, 'bodyArmR');
  }
  if (torso) {
    torso.traverse((ch) => {
      if (
        ch.name === 'TorsoCoat' ||
        ch.name.startsWith('OuterCoat_') ||
        ch.name.startsWith('CoatTrim_') ||
        ch.name.startsWith('CoatTail_') ||
        ch.name.startsWith('CoatTailTrim_') ||
        ch.name === 'InnerCollar'
      ) {
        ch.visible = !bodyItem;
      }
    });
  }

  const legsItem = equip('legs');
  if (legsItem) {
    const legs = buildLegsVisual(legsItem);
    mount(torso, legs.torso, 'legsArmorMesh');
    mount(lLeg, legs.left, 'legsArmorL');
    mount(rLeg, legs.right, 'legsArmorR');
    if (isBlenderHero) {
      [legs.left, legs.right].forEach((side) => {
        if (!side) return;
        side.traverse((ch) => {
          if (ch.name.includes('_04_')) {
            ch.visible = false;
          }
        });
      });
    }
  }

  const neck = equip('neck');
  if (neck) {
    const amulet = buildAmuletVisual(neck);
    if (isBlenderHero) {
      amulet.position.set(0, -0.16, -0.04);
    }
    mount(torso, amulet, 'amuletMesh');
  }

  const ring = equip('ring');
  if (ring) {
    const ringMesh = buildRingVisual(ring);
    if (player.parts.rightElbowPivot) {
      ringMesh.position.set(0.19, -0.32, 0.08);
      ringMesh.scale.set(1.0, 1.0, 1.0);
      mount(player.parts.rightElbowPivot, ringMesh, 'ringMesh');
    } else {
      ringMesh.position.set(0, 0, 0);
      mount(rArm, ringMesh, 'ringMesh');
    }
  }

  const feet = equip('feet');
  if (feet) {
    const bootL = buildBootVisual(feet, true);
    const bootR = buildBootVisual(feet, false);
    if (player.parts.leftKneePivot && player.parts.rightKneePivot) {
      bootL.position.set(-0.11, 0.38, -0.01);
      bootR.position.set(0.085, 0.38, -0.01);
      mount(player.parts.leftKneePivot, bootL, 'feetMeshL');
      mount(player.parts.rightKneePivot, bootR, 'feetMeshR');
    } else {
      mount(lLeg, bootL, 'feetMeshL');
      mount(rLeg, bootR, 'feetMeshR');
    }
  }
  if (!isBlenderHero && lLeg && rLeg) {
    [lLeg, rLeg].forEach((leg) => {
      leg.traverse((ch) => {
        if (
          ch.name.startsWith('Boot_') ||
          ch.name.startsWith('BootCuff_') ||
          ch.name.startsWith('BootSole_') ||
          ch.name.startsWith('BootHeel_')
        ) {
          ch.visible = !feet;
        }
      });
    });
  }

  const hands = equip('hands');
  if (hands) {
    const gloveL = buildGloveVisual(hands, true);
    const gloveR = buildGloveVisual(hands, false);
    if (player.parts.leftElbowPivot && player.parts.rightElbowPivot) {
      gloveL.position.set(-0.18, 0.32, 0.08);
      gloveR.position.set(0.18, 0.32, 0.08);
      mount(player.parts.leftElbowPivot, gloveL, 'handsMeshL');
      mount(player.parts.rightElbowPivot, gloveR, 'handsMeshR');
    } else {
      mount(lArm, gloveL, 'handsMeshL');
      mount(rArm, gloveR, 'handsMeshR');
    }
  }
  if (!isBlenderHero && lArm && rArm) {
    [lArm, rArm].forEach((arm) => {
      arm.traverse((ch) => {
        if (ch.name.startsWith('Bracer_') || ch.name.startsWith('BracerLace_')) {
          ch.visible = !hands;
        }
      });
    });
  }

  const capeItem = equip('cape');
  if (capeItem) {
    const cape = buildCapeVisual(capeItem);
    if (isBlenderHero) {
      if (cape.userData.silhouette === 'ava') cape.position.set(0, 0.12, 0.02);
      else cape.position.set(0, 0.22, 0.02);
    } else {
      if (cape.userData.silhouette === 'ava') cape.position.set(0, 0.16, 0.14);
      else cape.position.set(0, 0.285, 0.175);
    }
    mount(torso, cape, 'capeMesh');
  }

  const currentBon = getEquipmentBonuses();
  if (currentBon.matchedSet && torso) {
    const isFull = currentBon.isFullKit;
    const cue = new THREE.Mesh(
      new THREE.TorusGeometry(LEAN_RIG.beltRadius + 0.03, isFull ? 0.024 : 0.016, 8, 24),
      facetMaterial({
        color: isFull ? 0x38bdf8 : 0xfde047,
        emissive: isFull ? 0x0284c7 : 0xfacc15,
        emissiveIntensity: isFull ? 0.95 : 0.7
      })
    );
    cue.rotation.x = Math.PI / 2;
    cue.position.y = LEAN_RIG.beltY - LEAN_RIG.torsoY;
    cue.userData.setBonusCue = true;
    cue.userData.noOutline = true;
    mount(torso, cue, 'setBonusCue');
  }

  if (player.meshGroup) {
    addCartoonOutline(player.meshGroup, LEAN_RIG.outline);
    sealAlbedoUvs(player.meshGroup);
  }
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

function paint(color, extra = {}, family = null) {
  return family ? albedoMaterial(color, family, extra) : facetMaterial({ color, ...extra });
}

function addQuiver(parent, x, y, z, leatherHex, fletchHex) {
  const quiver = new THREE.Group();
  quiver.position.set(x, y, z);
  quiver.rotation.x = -0.55;
  monsterPart(quiver, new THREE.CylinderGeometry(0.09, 0.12, 0.46, 10), paint(leatherHex, {}, 'leather'));
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
  monsterPart(bow, new THREE.TubeGeometry(curve, 16, 0.03, 8, false), paint(color, {}, 'wood'));
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
  const bodyMat = paint(def.bodyColor, {}, speciesAlbedo('chicken'));
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
  const skin = paint(0x65a30d, {}, speciesAlbedo('goblin'));
  const leather = paint(0x78350f, {}, 'leather');
  const rag = paint(0x92400e, {}, 'cloth');
  const dark = paint(0x451a03, {}, 'cloth');
  const iron = paint(0x9ca3af, {}, 'iron');
  const bronze = paint(0xb87333, {}, 'iron');
  const wood = paint(0x92400e, {}, 'wood');

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
  const shell = paint(0xb45309, {}, speciesAlbedo('scorpion'));
  const dark = paint(0x451a03, {}, speciesAlbedo('scorpion'));
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
  const robe = paint(0x1e1b4b, {}, 'cloth');
  const trim = paint(0x9333ea, { emissive: 0x6d28d9, emissiveIntensity: 0.35 });
  const charcoal = paint(0x111827);
  const wood = paint(0x44403c, {}, 'wood');

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
  const cloth = paint(0x18181b, {}, 'cloth');
  const hide = paint(0x166534, {}, 'leather');
  const cloakMat = paint(0x27272a, {}, 'cloth');

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
    const boot = monsterPart(pivot, new THREE.SphereGeometry(0.11, 10, 8), paint(0x1c1917, {}, 'leather'), 0, -0.54, 0.02);
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
  const skin = paint(0xd6a87c, {}, speciesAlbedo('hill_giant'));
  const beardMat = paint(0x5c3a21, {}, speciesAlbedo('hill_giant'));
  const fur = paint(0x78350f, {}, speciesAlbedo('hill_giant'));
  const bone = paint(0xf5f5f4);
  const wood = paint(0x5c3a21, {}, 'wood');
  const stone = paint(0x78716c, {}, 'stone');

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
  const stone = paint(0x44403c, {}, speciesAlbedo('moss_guardian'));
  const bark = paint(0x3f6212, {}, speciesAlbedo('moss_guardian'));
  const moss = paint(0x16a34a, {}, 'grass');

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
  const skin = paint(0xdc2626, {}, speciesAlbedo('lesser_demon'));
  const hornMat = paint(0x111827);
  const mane = paint(0x1f2937);
  const hoofMat = paint(0x111827, {}, 'leather');

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
  const wingMat = paint(0x111827, {}, 'leather');
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
  const scaleMat = paint(def.bodyColor, {}, speciesAlbedo('elvarg_dragon'));
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
  if (!rig || m.isDying) return;

  const groundY = getTerrainHeight(m.pos.x, m.pos.z);

  // Flinch Reaction on Hit
  if (m.flinch > 0) {
    m.flinch = Math.max(0, m.flinch - dt * 3.8);
    const curve = Math.sin(m.flinch * Math.PI);
    rig.group.position.y = groundY + curve * 0.16;
    rig.group.rotation.x = curve * 0.24;
    if (rig.headGroup) rig.headGroup.rotation.x = -curve * 0.36;
    if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = curve * 0.45;
    if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = curve * 0.35;
    return;
  }
  rig.group.rotation.x = 0;

  // Distinct Attack Animations
  if (m.attackAnim > 0) {
    m.attackAnim = Math.max(0, m.attackAnim - dt * 3.2);
    const progress = Math.sin(m.attackAnim * Math.PI);
    if (m.typeKey === 'elvarg_dragon') {
      if (rig.headGroup) rig.headGroup.rotation.x = -0.35 + progress * 0.65;
      if (rig.lWing && rig.rWing) {
        rig.lWing.rotation.z = 0.2 + progress * 0.55;
        rig.rWing.rotation.z = -0.2 - progress * 0.55;
      }
      rig.group.position.y = groundY + progress * 0.32;
    } else if (m.typeKey === 'dark_wizard') {
      if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -1.65 * progress;
      if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = -1.45 * progress;
      if (rig.headGroup) rig.headGroup.rotation.x = -0.25 * progress;
      rig.group.position.y = groundY + progress * 0.12;
    } else if (m.typeKey === 'moss_guardian' || m.typeKey === 'hill_giant') {
      if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -1.8 * progress;
      if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = -1.8 * progress;
      rig.group.position.y = groundY + progress * 0.22;
    } else if (m.typeKey === 'goblin' || m.typeKey === 'hobgoblin') {
      if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -1.55 * progress;
      if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = progress * 0.4;
      rig.group.position.y = groundY + progress * 0.25;
    } else {
      const slash = progress * 1.45;
      if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -slash;
      if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = slash * 0.4;
      rig.group.position.y = groundY + progress * 0.1;
    }
    return;
  }

  // Locomotion Walk Poses
  if (moving && rig.leftLegPivot && rig.rightLegPivot) {
    const s = Math.sin(now * (m.inCombatWithPlayer ? 0.01 : 0.007)) * (m.inCombatWithPlayer ? 0.52 : 0.38);
    rig.leftLegPivot.rotation.x = s;
    rig.rightLegPivot.rotation.x = -s;
    if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = -s * 0.75;
    if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = s * 0.75;
    rig.group.position.y = groundY + Math.abs(Math.sin(now * 0.014)) * 0.06;
    return;
  }

  // Idle Breathing & Ambient Alive Pose
  const breath = Math.sin(now * 0.003) * 0.07;
  rig.group.position.y = groundY + Math.abs(breath) * 0.04;
  if (rig.headGroup) rig.headGroup.rotation.y = Math.sin(now * 0.0016) * 0.14;
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
  const phase = ((Math.abs(x) * 12.9898 + Math.abs(z) * 78.233) % 1);
  offsetAlbedoPhase(rig.group, phase, (phase * 1.618) % 1);
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
    isDying: false,
    dyingTimer: 0,
    flinch: 0,
    flashTimer: 0,
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
  G.worldInteractiveObjects.push(rig.hitbox);
  G.scene.add(rig.group);
  G.monstersList.push(mObj);
  loadBlenderMonstersTemplate().then((gltf) => {
    if (!gltf) return;
    upgradeMonsterRigWithGltf(mObj, gltf);
  });
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

    const barkMat = albedoMaterial(def.trunkColor || 0x92400e, 'bark');
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 2.2, 12), barkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    visualMesh.add(trunk);

    const foliageHex = {
      normal_tree: 0x334835,
      oak_tree: 0x3e4f38,
      willow_tree: 0x48523c,
      maple_tree: 0x5c4228,
      yew_tree: 0x223628,
      magic_tree: 0x35545b
    }[nodeKey] || def.foliageColor || 0x334835;
    const fMat = albedoMaterial(foliageHex, 'grass');
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
    const rockBiome = biomeGroundId(x, z);
    const rockMat = albedoMaterial(0x94a3b8, rockBiome ? biomeAlbedoId(rockBiome) : 'stone');
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
      albedoMaterial(0x64748b, 'stone')
    );
    depletedMesh.scale.set(0.95, 0.75, 0.95);
    depletedMesh.visible = false;
    grp.add(depletedMesh);
  } else {
    visualMesh = new THREE.Group();
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.05, 5, 8),
      new THREE.MeshBasicMaterial({ color: 0x7a96a3 })
    );
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.06;
    visualMesh.add(ring1);
    G.swayingFoliage.push({ mesh: ring1, speed: 1.8, rotY: true });
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
  sealAlbedoUvs(grp);
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
  G.worldInteractiveObjects.push(hitbox);
  G.scene.add(grp);
  G.resourceNodesList.push(rObj);
  loadBlenderWorldTemplate().then((gltf) => {
    if (!gltf) return;
    upgradeResourceNodeWithGltf(rObj, gltf);
  });
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

// ============================================================================
// 9. INPUT, CAMERA BEHIND CHARACTER, COMBAT, SKILLING, MINIMAP & MAIN LOOP
// ============================================================================

function setupInputHandlers() {
  G.clickMarkerMesh = new THREE.Group();
  G.clickMarkerMesh.userData.life = 0;
  const crossMat = () => new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0, depthWrite: false });
  const armA = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.07), crossMat());
  armA.rotation.y = Math.PI / 4;
  const armB = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.07), crossMat());
  armB.rotation.y = -Math.PI / 4;
  G.clickMarkerMesh.add(armA, armB);
  G.scene.add(G.clickMarkerMesh);
  G.hoverTile = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
  );
  G.hoverTile.rotation.x = -Math.PI / 2;
  G.hoverTile.visible = false;
  G.scene.add(G.hoverTile);

  window.addEventListener('keydown', e => {
    G.keysPressed[e.code] = true;
    noteCheatKey(e);
    if (e.code === 'Space' && player.isGrounded && !player.downed) {
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
    G.keysPressed[e.code] = false;
  });

  document.addEventListener('mousedown', (e) => {
    const menu = document.getElementById('context-menu');
    if (!menu || !menu.classList.contains('open')) return;
    if (menu.contains(e.target)) return;
    hideContextMenu();
  });

  const canvas = G.renderer.domElement;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const canvasHost = document.getElementById('game-canvas-container');
  if (canvasHost) canvasHost.addEventListener('contextmenu', onGameContextMenu);

  canvas.addEventListener('mousedown', e => {
    if (e.button === 2 || e.button === 1) {
      camState.isDragging = true;
      camState.lastMouseX = e.clientX;
      camState.lastMouseY = e.clientY;
      G.rightPress.x = e.clientX;
      G.rightPress.y = e.clientY;
      G.rightPress.dist = 0;
      return;
    }
    if (e.button === 0) {
      hideContextMenu();
      if (!player.downed) handleWorldClick(e);
    }
  });

  window.addEventListener('mousemove', e => {
    if (camState.isDragging) {
      const dx = e.clientX - camState.lastMouseX;
      const dy = e.clientY - camState.lastMouseY;
      camState.lastMouseX = e.clientX;
      camState.lastMouseY = e.clientY;
      G.rightPress.dist += Math.hypot(dx, dy);
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
  camState.pitch = 0.24;
  camState.distance = 8.5;
}

function showClickMarker(x, z, hexColor) {
  if (!G.clickMarkerMesh) return;
  G.clickMarkerMesh.position.set(x, getTerrainHeight(x, z) + 0.16, z);
  G.clickMarkerMesh.userData.life = 1;
  G.clickMarkerMesh.scale.set(1, 1, 1);
  G.clickMarkerMesh.traverse(obj => {
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
    G.hoveredWorld = null;
    hideHoverTooltip();
    if (G.hoverTile) G.hoverTile.visible = false;
    return;
  }
  updateHoverTile(e);
  const tooltip = document.getElementById('hover-tooltip');
  G.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);
  const hits = G.raycaster.intersectObjects(G.worldInteractiveObjects, false);
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
        G.hoveredWorld = ud;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY + 14) + 'px';
        tooltip.innerHTML = label;
        document.body.style.cursor = 'pointer';
        return;
      }
    }
  }
  G.hoveredWorld = null;
  tooltip.style.display = 'none';
  document.body.style.cursor = 'default';
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
}

function pointerToWorld(clientX, clientY) {
  G.mouseVec.x = (clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);
  const hits = G.raycaster.intersectObjects(G.worldInteractiveObjects, false);
  const entityHit = hits.find((hit) => hit.object.userData && hit.object.userData.type && hit.object.userData.type !== 'ground');
  const groundHits = G.terrainMesh ? G.raycaster.intersectObject(G.terrainMesh, false) : [];
  return { entityHit, ground: groundHits[0] || null };
}

function onGameContextMenu(e) {
  e.preventDefault();
  if (G.rightPress.dist > 6) return;
  if (document.querySelector('.modal-backdrop.open')) return;
  const picked = pointerToWorld(e.clientX, e.clientY);
  const options = [];
  const ud = picked.entityHit ? picked.entityHit.object.userData : null;

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
    else if (ud.action === 'dialogue') label = `Talk-to ${ud.name}`;
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
  openChooseMenu(e.clientX, e.clientY, options);
}

function openChooseMenu(clientX, clientY, options) {
  const menu = document.getElementById('context-menu');
  const list = document.getElementById('context-menu-list');
  if (!menu || !list) return;
  list.innerHTML = '';
  options.forEach((opt) => {
    const row = document.createElement('div');
    row.className = 'osrs-menu-item' + (opt.tone ? ` threat-${opt.tone}` : '');
    row.setAttribute('role', 'menuitem');
    row.textContent = opt.label;
    row.addEventListener('click', (ev) => {
      ev.stopPropagation();
      hideContextMenu();
      opt.run();
    });
    list.appendChild(row);
  });
  const left = Math.min(window.innerWidth - 280, clientX);
  const top = Math.min(window.innerHeight - (options.length * 24 + 36), clientY);
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top = Math.max(8, top) + 'px';
  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');
}

function handleWorldClick(e) {
  G.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);

  const hits = G.raycaster.intersectObjects(G.worldInteractiveObjects, false);
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
  const reg = regionAt(player.pos.x, player.pos.z);
  if (!reg) return;
  if (STATE.currentRegion !== reg.id) {
    STATE.currentRegion = reg.id;
    document.getElementById('current-zone-footer').textContent = reg.name;
    triggerRegionBanner(reg);
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
  const label = splatType === 'heal' ? `+${dmg}` : String(dmg);
  el.innerHTML = `<span class="hitsplat-num">${label}</span>`;
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
  G.scene.add(mesh);
  G.vfxList.push({ mesh, life, age: 0, onTick });
}

function launchProjectile(mesh, fromPos, toPos, onImpact, opts = {}) {
  const start = fromPos.clone().add(new THREE.Vector3(0, opts.y0 ?? 1.4, 0));
  const end = toPos.clone().add(new THREE.Vector3(0, opts.y1 ?? 1.2, 0));
  mesh.position.copy(start);
  G.scene.add(mesh);
  G.projectilesList.push({
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

  if (id === 'dharok_greataxe' || weaponItem?.iconKind === 'greataxe') {
    // Massive two-handed vertical downward chop
    spawnSlashArc(0xa3e635, origin, playerYaw, { scale: 1.55 * specScale, roll: Math.PI / 2, life: 0.55 });
    spawnExpandingRing(targetPos.clone().setY(targetPos.y), 0xa3e635, isSpec ? 0.8 : 0.55, isSpec ? 6.2 : 3.8);
    spawnBurst(impact, 10, 0x78350f, 0.5, 3.4);
    spawnBurst(impact, 8, 0xbef264, 0.42, 2.8);
    return;
  }

  if (id === 'inquisitor_mace' || weaponItem?.iconKind === 'mace') {
    // Heavy blunt crushing slam with holy radiance
    spawnSlashArc(0xfacc15, origin, playerYaw, { scale: 1.35 * specScale, roll: Math.PI / 2.3, life: 0.48 });
    spawnExpandingRing(targetPos.clone().setY(targetPos.y), 0xfacc15, 0.6, 3.6);
    spawnBurst(impact, 12, 0xfde047, 0.45, 3.8);
    spawnBurst(impact, 6, 0xffffff, 0.35, 2.4);
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

function spawnRunicCircle(pos, colorHex, life = 0.85, scale = 1.0) {
  const grp = new THREE.Group();
  grp.position.set(pos.x, getTerrainHeight(pos.x, pos.z) + 0.05, pos.z);

  const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.72 * scale, 0.82 * scale, 32), glowMaterial(colorHex, 0.9));
  outerRing.rotation.x = -Math.PI / 2;
  grp.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.36 * scale, 0.42 * scale, 24), glowMaterial(colorHex, 0.95));
  innerRing.rotation.x = -Math.PI / 2;
  grp.add(innerRing);

  const glyphs = new THREE.Group();
  for (let a = 0; a < 8; a++) {
    const spoke = new THREE.Mesh(new THREE.PlaneGeometry(0.04 * scale, 0.36 * scale), glowMaterial(colorHex, 0.9));
    spoke.rotation.x = -Math.PI / 2;
    spoke.rotation.z = (a / 8) * Math.PI * 2;
    spoke.position.set(Math.cos(spoke.rotation.z) * 0.56 * scale, 0, Math.sin(spoke.rotation.z) * 0.56 * scale);
    glyphs.add(spoke);
  }
  grp.add(glyphs);

  spawnVfx(grp, life, (v, dt) => {
    const t = v.age / v.life;
    glyphs.rotation.y += dt * 2.5;
    outerRing.rotation.z -= dt * 1.5;
    const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    v.mesh.traverse((obj) => {
      if (obj.material && obj.material.transparent) obj.material.opacity = fade * 0.92;
    });
  });
}

function spawnSpellProjectile(spell, fromPos, toPos, onImpact) {
  const id = spell?.id || 'wind_strike';
  const spellColor = id === 'fire_bolt' ? 0xf97316 : (id === 'ice_burst' ? 0x38bdf8 : (id === 'blood_barrage' ? 0xf43f5e : 0xa855f7));
  spawnRunicCircle(fromPos, spellColor, 0.8, 1.15);
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
    G.scene.add(p);
    const vel = new THREE.Vector3(Math.cos(ang) * 2.5, 3.5 + Math.random() * 2, Math.sin(ang) * 2.5);
    const startT = performance.now();
    const tick = () => {
      const dt = (performance.now() - startT) / 1000;
      if (dt > 0.9) {
        G.scene.remove(p);
        return;
      }
      p.position.addScaledVector(vel, 0.016);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function performPlayerAttack(monster) {
  if (monster.dead || player.downed) return;
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

  const wepId = STATE.equipment.weapon;
  const wepDef = wepId ? (ITEMS[wepId] || null) : null;
  const wepKind = wepDef?.iconKind || 'scimitar';
  player.activeWeaponKind = wepKind;

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
      if (player.blenderAnimator) {
        if (wpKindIsChop(wepKind)) player.blenderAnimator.playAction('Chop', 1.35);
        else player.blenderAnimator.playAction('SpinSlash', 1.25);
      }
      addChatMessage(`You unleash <b>${spec.name}</b>!`, 'lvlup');
    }
  } else {
    player.attackAnim = 1.0;
    if (player.blenderAnimator) {
      if (wepKind === 'greataxe') {
        player.blenderAnimator.playAction('Chop', 1.05);
      } else if (wepKind === 'mace') {
        player.blenderAnimator.playAction('Chop', 1.25);
      } else if (wepKind === 'bow') {
        player.blenderAnimator.playAction('Ranged', 1.3);
      } else if (wepKind === 'crossbow') {
        player.blenderAnimator.playAction('Ranged', 1.45);
      } else if (wepKind === 'staff' || wepKind === 'wand') {
        player.blenderAnimator.playAction('Cast', wepKind === 'wand' ? 1.4 : 1.15);
      } else if (wepKind === 'greatsword') {
        player.blenderAnimator.playAction('Slash', 0.95);
      } else if (wepKind === 'whip') {
        player.blenderAnimator.playAction('Slash', 1.45);
      } else if (style === 'rapid' || style === 'ranged') {
        player.blenderAnimator.playAction('Ranged', 1.2);
      } else if (style === 'magic') {
        player.blenderAnimator.playAction('Cast', 1.2);
      } else if (style === 'aggressive') {
        player.blenderAnimator.playAction('Lunge', 1.25);
      } else {
        player.blenderAnimator.playAction('Slash', 1.25);
      }
    }
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
      monster.flinch = 1.0;
      monster.flashTimer = 0.12;
      monster.hp = Math.max(0, monster.hp - dmg);
      spawnHitSplatWorld(monster.pos, dmg, isSpec ? 'maxhit' : hitSplatKind(dmg, maxHit));

      if (isSpec || wepKind === 'greataxe' || wepKind === 'greatsword' || dmg >= maxHit * 0.75) {
        camState.shake = Math.min(0.12, 0.04 + (dmg / maxHit) * 0.06);
      }

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
    if (wepKind === 'crossbow') SFX.crossbow();
    else SFX.bow();
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
    if (wepKind === 'greataxe' || wepKind === 'greatsword') SFX.heavyChop();
    else if (wepKind === 'mace') SFX.crush();
    else if (wepKind === 'whip') SFX.whipCrack();
    else SFX.slash();
    spawnMeleeSlashEffect(ITEMS[STATE.equipment.weapon], player.pos, player.yaw, monster.pos, isSpec);
    applyDamage();
  }
}

function wpKindIsChop(kind) {
  return kind === 'greataxe' || kind === 'mace';
}

function handleMonsterDeath(monster) {
  monster.isDying = true;
  monster.dyingTimer = 0.85;
  monster.dead = true;
  monster.inCombatWithPlayer = false;
  monster.respawnTimer = 7.5;
  if (player.targetEntity && player.targetEntity.ref === monster) {
    player.targetEntity = null;
  }
  spawnBurst(monster.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 6, 0x64748b, 0.6, 1.4);

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
  if (monster.dead || player.downed || STATE.hp <= 0) return;
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
      spawnHitSplatOnPlayer(dmg, hitSplatKind(dmg, monster.def.maxHit));
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
  if (player.downed) return;
  player.downed = true;
  player.downedTimer = RESPAWN_SECONDS;
  player.targetEntity = null;
  player.targetPos = null;
  STATE.hp = 0;
  STATE.activePrayers.clear();
  G.monstersList.forEach(m => { m.inCombatWithPlayer = false; });
  const notice = deathNotice();
  const overlay = document.getElementById('death-overlay');
  if (overlay) {
    overlay.hidden = false;
    const title = document.getElementById('death-title');
    const body = document.getElementById('death-body');
    if (title) title.textContent = notice.title;
    if (body) body.textContent = notice.body;
  }
  const count = document.getElementById('death-count');
  if (count) count.textContent = String(Math.ceil(RESPAWN_SECONDS));
  updateAllUI();
}

function finishRespawn() {
  applyRespawn(STATE);
  player.downed = false;
  player.downedTimer = 0;
  const overlay = document.getElementById('death-overlay');
  if (overlay) overlay.hidden = true;
  const reg = WORLD_REGIONS.find(r => r.id === 'lumbridge');
  if (reg) {
    player.pos.set(reg.x, getTerrainHeight(reg.x, reg.z + 4), reg.z + 4);
    player.yaw = Math.PI;
    camState.yaw = Math.PI;
    camState.manualOffset = 0;
    triggerRegionBanner(reg);
  }
  addChatMessage(`<b>${deathNotice().title}</b> ${deathNotice().body}`, 'combat');
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
  if (def.skill === 'woodcutting') {
    SFX.chop();
    if (player.blenderAnimator) player.blenderAnimator.playAction('Chop', 1.2);
  } else if (def.skill === 'mining') {
    SFX.mine();
    if (player.blenderAnimator) player.blenderAnimator.playAction('Mine', 1.2);
  } else {
    SFX.fish();
    if (player.blenderAnimator) player.blenderAnimator.playAction('Fish', 1.15);
  }

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
  ctx.strokeStyle = '#223842';
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

  // Resource Nodes (Muted Slate / Iron)
  G.resourceNodesList.forEach(r => {
    if (r.depleted) return;
    const px = (r.pos.x - player.pos.x) * scale;
    const pz = (r.pos.z - player.pos.z) * scale;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(px - 2, pz - 2, 4, 4);
  });

  // NPCs, Altars & Forges (Nordic Muted Brass)
  G.npcList.forEach(n => {
    const px = (n.pos.x - player.pos.x) * scale;
    const pz = (n.pos.z - player.pos.z) * scale;
    ctx.beginPath();
    ctx.arc(px, pz, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#c5a059';
    ctx.fill();
  });

  // Live Monsters (Nordic Blood Crimson)
  G.monstersList.forEach(m => {
    if (m.dead) return;
    const px = (m.pos.x - player.pos.x) * scale;
    const pz = (m.pos.z - player.pos.z) * scale;
    ctx.beginPath();
    ctx.arc(px, pz, m.typeKey === 'elvarg_dragon' ? 5.5 : 3.2, 0, Math.PI * 2);
    ctx.fillStyle = m.typeKey === 'elvarg_dragon' ? '#b91c1c' : '#881337';
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

function worldToScreenPos(x, y, z) {
  _tmpScratchVec.set(x, y, z).project(G.camera);
  return {
    x: (_tmpScratchVec.x * 0.5 + 0.5) * window.innerWidth,
    y: (-(_tmpScratchVec.y * 0.5) + 0.5) * window.innerHeight,
    visible: _tmpScratchVec.z < 1.0
  };
}

function worldToScreen(vec3) {
  return worldToScreenPos(vec3.x, vec3.y, vec3.z);
}

const LANDMARKS = [
  { name: 'Lumbridge Castle', x: 0, z: -25, y: 12.4, color: '#bfdbfe' },
  { name: 'Varrock Grand Plaza', x: 78, z: -20, y: 6.2, color: '#fde047' },
  { name: 'Al-Kharid Arch', x: 80, z: 82, y: 6.4, color: '#fdba74' },
  { name: 'Korok Lantern Grove', x: -72, z: -38, y: 4.2, color: '#86efac' },
  { name: "Dragon's Peak Spire", x: -58, z: 62, y: 8.2, color: '#fca5a5' }
];
let landmarkEls = null;
let playerOverheadEl = null;
function updateLandmarkLabels() {
  const host = document.getElementById('world-labels');
  if (!host) return;
  if (!landmarkEls) {
    landmarkEls = LANDMARKS.map((mark) => {
      const el = document.createElement('div');
      el.className = 'landmark-label';
      el.innerHTML = `<div class="landmark-name" style="color:${mark.color}">${mark.name}</div>`;
      host.appendChild(el);
      return el;
    });
  }
  LANDMARKS.forEach((mark, index) => {
    const el = landmarkEls[index];
    const dist = Math.hypot(player.pos.x - mark.x, player.pos.z - mark.z);
    if (dist > 78) {
      el.style.display = 'none';
      return;
    }
    const my = getTerrainHeight(mark.x, mark.z) + mark.y;
    const sp = worldToScreenPos(mark.x, my, mark.z);
    if (!sp.visible) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'flex';
    el.style.left = sp.x + 'px';
    el.style.top = sp.y + 'px';
    el.style.opacity = dist < 16 ? '1' : String(Math.max(0.55, 1 - (dist - 16) / 80));
  });
}

function updateFloatingWorldLabels() {
  const playerCombatLvl = getCombatLevel();
  updateLandmarkLabels();

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
    const sp = worldToScreenPos(player.pos.x, player.pos.y + 2.8, player.pos.z);
    if (sp.visible) {
      playerOverheadEl.style.display = 'flex';
      playerOverheadEl.style.left = sp.x + 'px';
      playerOverheadEl.style.top = sp.y + 'px';
      if (playerOverheadEl.dataset.prayer !== overheadPrayerId) {
        playerOverheadEl.dataset.prayer = overheadPrayerId;
        playerOverheadEl.innerHTML = `<div class="overhead-prayer-badge overhead-${overheadPrayerId}">${getPrayerSvg(overheadPrayerId)}</div>`;
      }
    } else {
      playerOverheadEl.style.display = 'none';
    }
  } else {
    playerOverheadEl.style.display = 'none';
  }

  // Monster names appear only while hovered or while they are the combat target.
  G.monstersList.forEach(m => {
    const aimed = player.targetEntity && player.targetEntity.type === 'monster' && player.targetEntity.ref === m;
    const hovered = G.hoveredWorld && G.hoveredWorld.type === 'monster' && G.hoveredWorld.entity === m;
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
    const sp = worldToScreenPos(m.pos.x, m.pos.y + topY, m.pos.z);
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
  G.npcList.forEach(n => {
    if (!n.el) {
      n.el = document.createElement('div');
      n.el.className = 'entity-label';
      n.el.style.color = n.color || '#fde047';
      n.el.innerHTML = `<div class="label-text">${n.name}</div>`;
      document.getElementById('world-labels').appendChild(n.el);
    }
    const hovered = G.hoveredWorld && G.hoveredWorld.type === 'interactive' && G.hoveredWorld.name === n.name;
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
    const sp = worldToScreenPos(n.pos.x, n.pos.y + (n.yOffset || 2.8), n.pos.z);
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

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.08, (now - G.lastFrameTime) / 1000);
  G.lastFrameTime = now;
  const elapsedSec = now * 0.001;

  if (player.downed) {
    player.downedTimer -= dt;
    const count = document.getElementById('death-count');
    if (count) count.textContent = String(Math.max(0, Math.ceil(player.downedTimer)));
    if (player.downedTimer <= 0) finishRespawn();
  } else if (getEquipmentBonuses().matchedSet) {
    G.setBonusTimer += dt;
    const bon = getEquipmentBonuses();
    const threshold = bon.isFullKit ? 1.25 : 1.7;
    if (G.setBonusTimer > threshold) {
      G.setBonusTimer = 0;
      if (bon.isFullKit) {
        spawnExpandingRing(player.pos, 0x94a3b8, 0.55, 2.2, 0.45, 0.65);
        spawnExpandingRing(player.pos, 0xc5a059, 0.35, 1.5, 0.35, 0.45);
      } else {
        spawnExpandingRing(player.pos, 0xc5a059, 0.55, 1.8, 0.42, 0.55);
      }
    }
  }

  if (G.waterUniforms) G.waterUniforms.uTime.value = elapsedSec;
  if (G.skyUniforms) G.skyUniforms.uTime.value = elapsedSec;
  if (G.skyDomeMesh) G.skyDomeMesh.position.copy(player.pos);

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

  if (G.keysPressed['KeyQ']) camState.manualOffset += turnSpeed * dt;
  if (G.keysPressed['KeyE']) camState.manualOffset -= turnSpeed * dt;

  if (player.downed) {
    player.targetPos = null;
    player.targetEntity = null;
  }

  if (!player.downed && (G.keysPressed['KeyA'] || G.keysPressed['ArrowLeft'])) {
    player.yaw += turnSpeed * dt;
  }
  if (!player.downed && (G.keysPressed['KeyD'] || G.keysPressed['ArrowRight'])) {
    player.yaw -= turnSpeed * dt;
  }

  let forwardInput = 0;
  if (!player.downed && (G.keysPressed['KeyW'] || G.keysPressed['ArrowUp'])) forwardInput += 1;
  if (!player.downed && (G.keysPressed['KeyS'] || G.keysPressed['ArrowDown'])) forwardInput -= 0.75;

  let hasMoveIntent = false;
  let moveDirX = 0;
  let moveDirZ = 0;

  if (forwardInput !== 0) {
    hasMoveIntent = true;
    player.targetPos = null;
    player.targetEntity = null;
    const sign = forwardInput > 0 ? 1 : -0.75;
    moveDirX = Math.sin(player.yaw) * sign;
    moveDirZ = Math.cos(player.yaw) * sign;
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
        hasMoveIntent = true;
        moveDirX = dx / dist;
        moveDirZ = dz / dist;
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
          else if (act === 'dialogue') {
            const dlg = player.targetEntity.ref.dialogue || 'Greetings, traveler.';
            const name = player.targetEntity.ref.name || 'Guard';
            addChatMessage(`${name}: "${dlg}"`, 'combat');
          }
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
      hasMoveIntent = true;
      const desiredYaw = Math.atan2(dx, dz);
      player.yaw = lerpAngle(player.yaw, desiredYaw, Math.min(1, dt * 10));
      moveDirX = dx / dist;
      moveDirZ = dz / dist;
      if (!camState.isDragging) camState.manualOffset *= Math.pow(0.25, dt);
    } else {
      player.targetPos = null;
    }
  }

  // Smooth Acceleration & Deceleration Momentum
  const targetSpeed = hasMoveIntent ? moveSpeed : 0;
  const accelRate = hasMoveIntent ? 16 : 12;
  player.currentSpeed = (player.currentSpeed ?? 0) + (targetSpeed - (player.currentSpeed ?? 0)) * Math.min(1, dt * accelRate);
  if (!hasMoveIntent && Math.abs(player.currentSpeed) < 0.05) {
    player.currentSpeed = 0;
  }

  if (player.currentSpeed > 0.02 && (moveDirX !== 0 || moveDirZ !== 0)) {
    const stepped = moveWithCollision(player.pos.x, player.pos.z, moveDirX * player.currentSpeed * dt, moveDirZ * player.currentSpeed * dt);
    player.pos.x = stepped.x;
    player.pos.z = stepped.z;
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
    // Smooth terrain follow
    player.pos.y += (groundY - player.pos.y) * Math.min(1, dt * 18);
  }

  player.isMoving = player.currentSpeed > 0.4;
  player.meshGroup.position.copy(player.pos);

  // Smooth Yaw & Turning Angular Velocity
  const lastMeshYaw = player.meshGroup.rotation.y;
  const targetMeshYaw = player.yaw + Math.PI;
  player.meshGroup.rotation.y = lerpAngle(player.meshGroup.rotation.y, targetMeshYaw, Math.min(1, dt * 12));

  let turnDelta = (player.meshGroup.rotation.y - lastMeshYaw) / Math.max(0.001, dt);
  if (turnDelta > Math.PI) turnDelta -= Math.PI * 2;
  if (turnDelta < -Math.PI) turnDelta += Math.PI * 2;
  player.yawVelocity = (player.yawVelocity ?? 0) * 0.8 + turnDelta * 0.2;

  // Dynamic Bank Roll (lean subtly into turns while running)
  const targetBank = player.isMoving ? THREE.MathUtils.clamp(-player.yawVelocity * 0.07, -0.20, 0.20) : 0;
  player.bankRoll = (player.bankRoll ?? 0) + (targetBank - (player.bankRoll ?? 0)) * Math.min(1, dt * 10);
  player.meshGroup.rotation.z = player.bankRoll;

  // Dynamic cape physics: realistic cloth aerodynamics in Three.js coordinates
  // Note: with Y-up & -Z forward, negative rotation.x swings cape BACKWARD (+Z away from body).
  const updateCapePhysics = (isMoving, animTime) => {
    if (!player.parts.capeMesh) return;
    const isAva = player.parts.capeMesh.userData?.silhouette === 'ava';
    if (isAva) {
      player.parts.capeMesh.rotation.set(0, 0, 0);
      return;
    }

    // Dynamic backward leg clearance:
    // In our rig, positive rotation.x swings thigh backward (+Z into the cape volume)
    const leftLegRx = player.parts.leftLegPivot?.rotation.x ?? 0;
    const rightLegRx = player.parts.rightLegPivot?.rotation.x ?? 0;
    const maxRearLegKick = Math.max(0, leftLegRx, rightLegRx);
    const rearLegClearance = maxRearLegKick * 0.55;

    const speedRatio = player.currentSpeed / moveSpeed;
    // Aerodynamic wind billow pushes cape BACKWARD (negative pitch) in slipstream
    const windFlare = speedRatio * 0.44;

    const flutter = isMoving
      ? (Math.sin(animTime * 2.2) * 0.05 + Math.cos(animTime * 4.4) * 0.02)
      : (Math.sin(animTime * 0.8) * 0.012);

    // Resting backward drape: -0.12 rad cleanly arches backward past buttocks & belt
    const baseBackwardDrape = isMoving ? 0.28 : 0.12;
    const targetWorldBackwardPitch = -(baseBackwardDrape + windFlare + rearLegClearance + flutter);

    // Counteract torso pitch so torso forward lean never pulls cape into the body
    const torsoPitch = player.parts.torso?.rotation.x ?? 0;
    const targetLocalPitch = targetWorldBackwardPitch - torsoPitch;

    // Centrifugal roll & inertia during turns: cloth swings outward away from turn
    const targetRoll = THREE.MathUtils.clamp(player.yawVelocity * 0.22, -0.38, 0.38) + (isMoving ? Math.sin(animTime * 1.8) * 0.03 : 0);
    const targetYaw = THREE.MathUtils.clamp(-player.yawVelocity * 0.10, -0.20, 0.20);

    player.capeAngleX = (player.capeAngleX ?? -0.12) + (targetLocalPitch - (player.capeAngleX ?? -0.12)) * Math.min(1, dt * 10);
    player.capeAngleZ = (player.capeAngleZ ?? 0) + (targetRoll - (player.capeAngleZ ?? 0)) * Math.min(1, dt * 8);
    player.capeAngleY = (player.capeAngleY ?? 0) + (targetYaw - (player.capeAngleY ?? 0)) * Math.min(1, dt * 8);

    player.parts.capeMesh.rotation.x = player.capeAngleX;
    player.parts.capeMesh.rotation.z = player.capeAngleZ;
    player.parts.capeMesh.rotation.y = player.capeAngleY;

    if (player.parts.capeMesh.userData?.silhouette === 'lava-cape' && Math.random() < 0.22) {
      const emberPos = player.pos.clone().add(new THREE.Vector3(
        -Math.sin(player.yaw) * 0.45 + (Math.random() - 0.5) * 0.2,
        0.5 + Math.random() * 0.3,
        -Math.cos(player.yaw) * 0.45 + (Math.random() - 0.5) * 0.2
      ));
      spawnBurst(emberPos, 1, 0xf97316, 0.35, 0.6);
    }
  };

  if (player.blenderAnimator) {
    player.animTime += dt * (player.isMoving ? 4.5 : 2.0);
    player.blenderAnimator.setMoving(player.isMoving);
    player.blenderAnimator.setWalkSpeed(player.currentSpeed / moveSpeed);
    player.blenderAnimator.update(dt);
    updateCapePhysics(player.isMoving, player.animTime);

    if (player.attackAnim > 0) {
      player.attackAnim = Math.max(0, player.attackAnim - dt * 3.6);
    }
  } else {
    if (player.isMoving) {
      player.animTime += dt * (player.currentSpeed / moveSpeed * 10);
      const phase = player.animTime;
      const swing = Math.sin(phase) * 0.62;
      const bob = Math.cos(phase * 2) * 0.03;
      const sway = Math.sin(phase) * 0.02;

      player.parts.leftLegPivot.rotation.x = swing;
      player.parts.rightLegPivot.rotation.x = -swing;
      player.parts.leftLegPivot.rotation.z = sway * 0.5;
      player.parts.rightLegPivot.rotation.z = -sway * 0.5;

      if (player.parts.leftKneePivot) player.parts.leftKneePivot.rotation.x = -(0.05 + Math.max(0, -swing) * 0.75);
      if (player.parts.rightKneePivot) player.parts.rightKneePivot.rotation.x = -(0.05 + Math.max(0, swing) * 0.75);

      if (player.parts.torso) {
        player.parts.torso.rotation.x = 0.12 + Math.cos(phase * 2) * 0.02;
        player.parts.torso.rotation.y = -Math.sin(phase) * 0.12;
      }

      player.parts.leftArmPivot.rotation.x = 0.10 - swing * 0.58;
      player.parts.leftArmPivot.rotation.z = 0.28;
      if (player.parts.leftElbowPivot) player.parts.leftElbowPivot.rotation.x = 0.45 + Math.max(0, -swing) * 0.25;

      if (player.attackAnim <= 0) {
        player.parts.rightArmPivot.rotation.x = 0.10 + swing * 0.58;
        player.parts.rightArmPivot.rotation.z = -0.28;
        if (player.parts.rightElbowPivot) player.parts.rightElbowPivot.rotation.x = 0.45 + Math.max(0, swing) * 0.25;
      }
      updateCapePhysics(true, player.animTime);
    } else {
      player.animTime += dt * 2.0;
      const breath = Math.sin(player.animTime) * 0.035;
      player.parts.leftLegPivot.rotation.x *= 0.85;
      player.parts.rightLegPivot.rotation.x *= 0.85;
      if (player.parts.leftKneePivot) player.parts.leftKneePivot.rotation.x *= 0.85;
      if (player.parts.rightKneePivot) player.parts.rightKneePivot.rotation.x *= 0.85;
      if (player.parts.torso) {
        player.parts.torso.rotation.x = breath * 0.5;
        player.parts.torso.rotation.y *= 0.88;
      }
      player.parts.leftArmPivot.rotation.x = 0.10 + breath;
      player.parts.leftArmPivot.rotation.z = 0.28;
      if (player.parts.leftElbowPivot) player.parts.leftElbowPivot.rotation.x = 0.60 + breath * 0.5;
      if (player.attackAnim <= 0) {
        player.parts.rightArmPivot.rotation.x = 0.10 - breath;
        player.parts.rightArmPivot.rotation.z = -0.28;
        if (player.parts.rightElbowPivot) player.parts.rightElbowPivot.rotation.x = 0.50 - breath * 0.5;
      }
      updateCapePhysics(false, player.animTime);
    }

    if (player.attackAnim > 0) {
      player.attackAnim = Math.max(0, player.attackAnim - dt * 3.6);
      const slashAngle = Math.sin(player.attackAnim * Math.PI) * 1.65;
      const k = player.activeWeaponKind;
      if (k === 'greataxe') {
        player.parts.rightArmPivot.rotation.x = -slashAngle;
        if (player.parts.leftArmPivot) player.parts.leftArmPivot.rotation.x = -slashAngle * 0.85;
      } else if (k === 'greatsword') {
        player.parts.rightArmPivot.rotation.x = -slashAngle * 1.1;
        if (player.parts.leftArmPivot) player.parts.leftArmPivot.rotation.x = -slashAngle * 0.9;
      } else if (k === 'mace') {
        player.parts.rightArmPivot.rotation.x = -slashAngle * 1.15;
      } else if (k === 'bow' || k === 'crossbow') {
        if (player.parts.leftArmPivot) player.parts.leftArmPivot.rotation.x = -1.2;
        player.parts.rightArmPivot.rotation.x = -slashAngle * 0.8;
      } else if (k === 'staff' || k === 'wand') {
        player.parts.rightArmPivot.rotation.x = -1.35 * Math.sin(player.attackAnim * Math.PI);
      } else {
        player.parts.rightArmPivot.rotation.x = -slashAngle;
      }
    }
  }
  for (let i = 0; i < G.npcAnimatorsList.length; i++) {
    G.npcAnimatorsList[i].update(dt);
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

  if (G.clickMarkerMesh && G.clickMarkerMesh.userData.life > 0) {
    G.clickMarkerMesh.userData.life = Math.max(0, G.clickMarkerMesh.userData.life - dt * 1.4);
    const life = G.clickMarkerMesh.userData.life;
    G.clickMarkerMesh.scale.setScalar(1 + (1 - life) * 0.35);
    G.clickMarkerMesh.traverse(obj => {
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

  _camTargetVec.set(camTargetX, camTargetY, camTargetZ);
  G.camera.position.lerp(_camTargetVec, Math.min(1, dt * 12));
  _lookTargetVec.set(player.pos.x, player.pos.y + 1.85, player.pos.z);
  camState.currentLookAt.lerp(_lookTargetVec, Math.min(1, dt * 14));
  G.camera.lookAt(camState.currentLookAt);

  // Micro-Camera Shake Impulse
  if (camState.shake > 0.001) {
    camState.shake *= Math.pow(0.012, dt);
    G.camera.position.x += (Math.random() - 0.5) * camState.shake;
    G.camera.position.y += (Math.random() - 0.5) * camState.shake;
  }

  G.sunLight.position.set(player.pos.x + 38, player.pos.y + 58, player.pos.z + 28);
  G.sunLight.target.position.copy(player.pos);
  G.sunLight.target.updateMatrixWorld();

  // Monsters Update
  G.monstersList.forEach(m => {
    if (m.isDying) {
      m.dyingTimer -= dt;
      const progress = Math.max(0, 1 - m.dyingTimer / 0.85);
      m.rig.group.rotation.x = progress * (Math.PI / 2.3);
      m.rig.group.position.y = getTerrainHeight(m.pos.x, m.pos.z) - progress * 0.45;
      if (m.dyingTimer <= 0) {
        m.isDying = false;
        m.rig.group.visible = false;
        m.rig.group.rotation.x = 0;
      }
      return;
    }

    if (m.dead) {
      m.respawnTimer -= dt;
      if (m.respawnTimer <= 0) {
        m.dead = false;
        m.isDying = false;
        m.hp = m.maxHp;
        m.breathCount = 0;
        m.flinch = 0;
        m.inCombatWithPlayer = false;
        m.pos.copy(m.spawnPos);
        m.rig.group.position.copy(m.spawnPos);
        m.rig.group.position.y = getTerrainHeight(m.spawnPos.x, m.spawnPos.z);
        m.rig.group.rotation.set(0, 0, 0);
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
        const targetMonYaw = Math.atan2(dx, dz) + Math.PI;
        m.rig.group.rotation.y = lerpAngle(m.rig.group.rotation.y, targetMonYaw, Math.min(1, dt * 9));
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
          const targetWanderYaw = Math.atan2(dx, dz) + Math.PI;
          m.rig.group.rotation.y = lerpAngle(m.rig.group.rotation.y, targetWanderYaw, Math.min(1, dt * 7));
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

  G.resourceNodesList.forEach(r => {
    if (r.depleted) {
      r.respawnTimer -= dt;
      if (r.respawnTimer <= 0) {
        r.depleted = false;
        r.visualMesh.visible = true;
        r.depletedMesh.visible = false;
      }
    }
  });

  for (let i = G.projectilesList.length - 1; i >= 0; i--) {
    const p = G.projectilesList[i];
    p.progress += p.speed * dt;
    if (p.progress >= 1.0) {
      G.scene.remove(p.mesh);
      if (p.onImpact) p.onImpact();
      G.projectilesList.splice(i, 1);
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

  for (let i = G.vfxList.length - 1; i >= 0; i--) {
    const v = G.vfxList[i];
    v.age += dt;
    if (v.onTick) v.onTick(v, dt);
    if (v.age >= v.life) {
      G.scene.remove(v.mesh);
      G.vfxList.splice(i, 1);
    }
  }

  G.swayingFoliage.forEach(item => {
    if (item.rotY) item.mesh.rotation.z += dt * item.speed;
  });

  if (now - G.lastAutoSaveTime > 2000) {
    G.lastAutoSaveTime = now;
    saveGameState();
  }

  checkRegionChange();
  G.labelTick += dt;
  G.miniTick += dt;
  if (G.labelTick >= 0.1 || Math.hypot(player.pos.x - G.lastLabelX, player.pos.z - G.lastLabelZ) > 0.4) {
    G.labelTick = 0;
    G.lastLabelX = player.pos.x;
    G.lastLabelZ = player.pos.z;
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
  const compass = document.getElementById('compass-badge');
  if (compass) compass.style.transform = `rotate(${(camState.yaw - Math.PI)}rad)`;

  if (G.miniTick >= 0.08 || Math.hypot(player.pos.x - G.lastLabelX, player.pos.z - G.lastLabelZ) > 0.4) {
    G.miniTick = 0;
    renderMinimap();
  }
  const tickArc = document.getElementById('tick-arc');
  if (tickArc) tickArc.style.strokeDashoffset = String(88 * Math.max(0, Math.min(1, player.actionCooldown / TICK_SEC)));
  if (G.grassInstanced && G.grassInstanced.material && G.grassInstanced.material.uniforms) {
    G.grassInstanced.material.uniforms.uTime.value = elapsedSec;
  }
  G.renderer.render(G.scene, G.camera);

  G.frameCounter++;
  if (now - G.lastFpsTime >= 500) {
    const elapsed = now - G.lastFpsTime;
    telemetryInfo.fps = Math.round((G.frameCounter * 1000) / elapsed);
    telemetryInfo.frameTimeMs = Number((elapsed / G.frameCounter).toFixed(1));
    G.frameCounter = 0;
    G.lastFpsTime = now;

    const fpsEl = document.getElementById('perf-fps');
    if (fpsEl) fpsEl.textContent = `${telemetryInfo.fps} FPS (${telemetryInfo.frameTimeMs}ms)`;
    const callsEl = document.getElementById('perf-calls');
    if (callsEl && G.renderer) {
      callsEl.textContent = `${G.renderer.info.render.calls} calls • ${Math.round(G.renderer.info.render.triangles / 1000)}k tris`;
    }
  }
}


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
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(getQualityDpr(currentQuality));
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
  syncGraphicsButtons();
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
  if (!G.hoverTile || !G.terrainMesh || !G.camera) return;
  G.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);
  const hits = G.raycaster.intersectObject(G.terrainMesh, false);
  if (!hits.length) {
    G.hoverTile.visible = false;
    return;
  }
  const p = hits[0].point;
  const gx = Math.floor(p.x) + 0.5;
  const gz = Math.floor(p.z) + 0.5;
  G.hoverTile.visible = true;
  G.hoverTile.position.set(gx, getTerrainHeight(gx, gz) + 0.08, gz);
}

let cheatBuffer = '';

function noteCheatKey(e) {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (!e.key || e.key.length !== 1) return;
  cheatBuffer = (cheatBuffer + e.key.toLowerCase()).slice(-16);
  const kind = matchCheat(cheatBuffer);
  if (!kind) return;
  cheatBuffer = '';
  if (kind === 'skills') cheatSkillsPlus10();
  else cheatGold200k();
}

function cheatSkillsPlus10() {
  applySkillsPlus10(STATE);
  SFX.levelUp();
  spawnLevelUpFireworks();
  showBanner('Cheat Activated', 'All skills increased by +10 levels!');
  addChatMessage('Cheat code <b>skills10</b> activated: all skills increased by <b>+10</b>!', 'lvlup');
  updateAllUI();
  saveGameState();
}

function cheatGold200k() {
  applyGold200k(STATE);
  SFX.coin();
  showBanner('Cheat Activated', '+200,000 GP added to your coin pouch!');
  addChatMessage('Cheat code <b>gold200k</b> activated: <b>+200,000 GP</b> added!', 'loot');
  updateAllUI();
  saveGameState();
}

function applyTypedCheat() {
  const input = document.getElementById('cheat-code-input');
  if (!input) return;
  const kind = matchCheat(input.value);
  input.value = '';
  if (kind === 'skills') cheatSkillsPlus10();
  else if (kind === 'gold') cheatGold200k();
  else addChatMessage('Unknown cheat code. Try <b>skills10</b> or <b>gold200k</b>.', 'combat');
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
  bridge.showSellMenu = (ev, index) => showSellChooseMenu(ev, index);
  bridge.sellGathered = () => sellAllLoot();
  bridge.sellGear = () => sellAllUnequippedGear();
  window.cheatSkillsPlus10 = cheatSkillsPlus10;
  window.cheatGold200k = cheatGold200k;
  window.applyTypedCheat = applyTypedCheat;
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
  window.cycleGraphicsQuality = cycleGraphicsQuality;
  window.toggleOutlines = toggleOutlines;
  window.toggleXpMultiplier = toggleXpMultiplier;
  window.cycleTimeOfDay = cycleTimeOfDay;
  window.toggleAudio = toggleAudio;
  window.resetGameSave = resetGameSave;
  window.manualSaveToast = manualSaveToast;
  window.sellInventoryItem = sellInventoryItem;
  window.buyShopItem = buyShopItem;
  window.buyShopPair = buyShopPair;
  window.sellAllLoot = sellAllLoot;
  window.sellAllUnequippedGear = sellAllUnequippedGear;
  window.unequipSlot = unequipSlot;
  window.toggleSpecialAttack = toggleSpecialAttack;
  window.togglePrayer = togglePrayer;
  window.handleSpellClick = handleSpellClick;
  window.teleportToRegion = teleportToRegion;
  window.resetCameraBehindPlayer = resetCameraBehindPlayer;
  window.dismissOnboarding = dismissOnboarding;
  window.replayOnboarding = replayOnboarding;
  (window as any).__DEV_ACCESS__ = {
    player,
    get camera() { return G.camera; },
    camState,
    get scene() { return G.scene; },
    STATE,
    ITEMS,
    rebuildPlayerEquipmentMeshes,
    loadBlenderGearTemplate,
    monstersList: G.monstersList,
    getAnimator: () => player.blenderAnimator,
  };
}

const INTRO_KEY = 'gielinor_hero_intro_v1';

function dismissOnboarding() {
  const board = document.getElementById('onboarding');
  if (board) board.hidden = true;
  try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
}

function replayOnboarding() {
  closeModals();
  const board = document.getElementById('onboarding');
  if (board) board.hidden = false;
}

function maybeShowOnboarding() {
  let seen = false;
  try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) {}
  const board = document.getElementById('onboarding');
  if (board) board.hidden = seen;
}

// ============================================================================
// 13. BOOTSTRAP GAME ON LOAD
// ============================================================================
export function boot(): void {
  window.addEventListener('beforeunload', saveGameState);
  window.addEventListener('DOMContentLoaded', () => {
    wireBridge();
    initStaticSvgIcons();
    const hadSave = loadGameState();
    init3DEngine();
    applyLoadedStateToHud();
    updateAllUI();
    maybeShowOnboarding();
    addChatMessage('Welcome to <b>Gielinor Hero</b>.', 'lvlup');
    if (hadSave) {
      addChatMessage('Restored your saved progress & world state from <b>localStorage</b>.', 'skill');
    } else {
      addChatMessage('Use <b>WASD / Arrows</b> or <b>Click</b> anywhere to move, fight monsters, chop trees, mine ores, or fish.', 'skill');
    }
    addChatMessage('The courtyard holds the <b>Bank booth</b>, the <b>General Store</b>, and the <b>Anvil</b>. Walk up to use them. Press <b>F1–F6</b> to switch panels and <b>Esc</b> to close a window.', 'loot');
    addChatMessage('Cheat codes: type <b>skills10</b> to raise every skill by 10, or <b>gold200k</b> for 200,000 GP. Both are also in Settings.', 'skill');
    const cheatInput = document.getElementById('cheat-code-input');
    if (cheatInput) {
      cheatInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          applyTypedCheat();
        }
      });
    }
    const startReg = WORLD_REGIONS.find(r => r.id === STATE.currentRegion) || WORLD_REGIONS[0];
    triggerRegionBanner(startReg);
    (window as unknown as { __DEBUG?: unknown }).__DEBUG = { STATE, player, camState, rebuildPlayerEquipmentMeshes, ITEMS };
    requestAnimationFrame(gameLoop);
  });
}
