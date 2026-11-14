// @ts-nocheck
import * as THREE from 'three';
import { TICK_SEC, player, camState, _tmpScratchVec, _camTargetVec, _lookTargetVec, telemetryInfo, G } from './context';
import { SFX } from './audio';
import {
  spawnHitSplatWorld,
  spawnHitSplatOnPlayer,
  glowMaterial,
  spawnVfx,
  launchProjectile,
  spawnProjectile,
  spawnBurst,
  spawnExpandingRing,
  spawnSlashArc,
  metalSlashTint,
  spawnMeleeSlashEffect,
  spawnSpellImpact,
  spawnRunicCircle,
  spawnSpellProjectile,
  spawnArrowProjectile,
  spawnPiercingBeam,
  spawnRareLootBeam,
  spawnDragonfireEffect,
  spawnShadowBolt,
  spawnHellfireOrb,
  spawnLevelUpFireworks
} from './vfx';
import { poseMonsterLimbs } from './monsterMeshes';
import { buildPlayerCharacter, rebuildPlayerEquipmentMeshes, syncWhipGeometry } from './playerMesh';
import {
  buildSkyDomeShader,
  cycleTimeOfDay,
  buildTerrainAndWater,
  buildRiverBridge,
  getBiomeColor
} from './worldMesh';
import { buildAllCitiesAndLandmarks } from './worldBuild';
import { spawnAllResourcesAndMonsters } from './spawns';
import { ITEMS, TIER_COLORS, isStackableInBackpack, unitSellPrice } from '../data/items';
import { SKILLS_META, OSRS_XP_TABLE, getLevelForXp } from '../data/skills';
import { PRAYERS, SPELLS } from '../data/magic';
import { tryCraft, isLogId } from '../data/recipes';
import { WORLD_REGIONS } from '../data/world';
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
  applyAlbedo,
  assignGroundUvs,
  BIOME_COLORS,
  biomeAlbedoId,
  sealAlbedoUvs,
  speciesAlbedo,
  terrainMaterial
} from './textures';
import { loadBlenderGearTemplate } from './blenderGear';
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

export function getEquipmentBonuses() {
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

export function worldToScreen(vec3: THREE.Vector3): { x: number; y: number; visible: boolean } {
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
