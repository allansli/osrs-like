// @ts-nocheck
import { STATE } from '../state/gameState';
import { getEquipmentBonuses, equippedWeapon, allowedStyles } from '../state/combat';
import { weaponSpecial, adventureTracker, slayerCard, combatLevel } from '../state/adventure';
import { ITEMS, TIER_COLORS, isStackableInBackpack } from '../data/items';
import { SKILLS_META, OSRS_XP_TABLE } from '../data/skills';
import { PRAYERS, SPELLS } from '../data/magic';
import {
  getUiSvg,
  getSkillSvg,
  getItemSvg,
  getPrayerSvg,
  getSpellSvg
} from './icons';
import {
  itemCompareHtml,
  renderBankModal,
  renderWorldMap,
  renderQuests,
  syncSettingsButtons
} from './stations';
import { cycleTimeOfDay } from '../engine/worldMesh';
import { player } from '../engine/context';
import {
  handleInventoryClick,
  showSellChooseMenu,
  openXpTableModal,
  unequipSlot,
  togglePrayer,
  handleSpellClick,
  saveGameState,
  renderShopModal,
  renderSmithingModal
} from '../engine/runtime';

export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (!node) {
    throw new Error(`missing #${id}`);
  }
  return node as T;
}

export function initStaticSvgIcons() {
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

export function addChatMessage(text, type = '') {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'chat-line ' + type;
  div.innerHTML = text;
  box.appendChild(div);
  while (box.children.length > 60) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

export function getCombatLevel() {
  return combatLevel(STATE);
}

export function getItemReqInfo(it) {
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

export function spawnXpDrop(skillKey, amount) {
  const container = document.getElementById('xp-drops-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'xp-drop';
  el.innerHTML = `${getSkillSvg(skillKey)}<span>+${amount.toLocaleString()} XP</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 1850);
}

let lvlBannerTimeout = null;
export function showLevelUpBanner(skillName, newLvl) {
  showBanner('Skill Level Up', `Congratulations, your ${skillName} level is now ${newLvl}!`);
}

export function showBanner(kicker, message) {
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

export function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const btn = document.getElementById('tab-btn-' + tabName);
  const content = document.getElementById('tab-' + tabName);
  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

export function updateAllUI() {
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

  const bon = getEquipmentBonuses(STATE);
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

export function updateTargetHud() {
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

export function applyLoadedStateToHud() {
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

export function refreshCombatStyleLocks() {
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

export function showItemTooltip(ev, it) {
  const tip = document.getElementById('item-tooltip');
  if (!tip || !it) return;
  tip.innerHTML = itemCompareHtml(it);
  tip.style.display = 'block';
  moveItemTooltip(ev);
}

export function moveItemTooltip(ev) {
  const tip = document.getElementById('item-tooltip');
  if (!tip) return;
  tip.style.left = Math.min(window.innerWidth - 260, ev.clientX + 14) + 'px';
  tip.style.top = Math.min(window.innerHeight - 120, ev.clientY + 14) + 'px';
}

export function hideItemTooltip() {
  const tip = document.getElementById('item-tooltip');
  if (tip) tip.style.display = 'none';
}
