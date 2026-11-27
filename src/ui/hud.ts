import { STATE } from '../state/gameState';
import { getEquipmentBonuses, equippedWeapon, allowedStyles } from '../state/combat';
import { weaponSpecial, adventureTracker, slayerCard, combatLevel } from '../state/adventure';
import { ITEMS, TIER_COLORS, isStackableInBackpack, type ItemDef } from '../data/items';
import { SKILLS_META, OSRS_XP_TABLE } from '../data/skills';
import { PRAYERS, SPELLS, type SpellDef } from '../data/magic';
import { keepCorrupt, legacyPreview, recoveryExit, LIMIT_BYTES } from '../state/saveRecovery';
import { readLegacy, type MigratedSave } from '../state/save';

type PrayerDef = (typeof PRAYERS)[number];
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
import { renderJournal } from './journal';
import { cycleTimeOfDay } from '../engine/worldMesh';
import { isDown } from '../state/monsterAi';
import { player, commandClocks, type MonsterEntity, type ResourceNodeEntity } from '../engine/context';
import { FOOD_CD_SECS, POTION_CD_SECS } from '../state/sustain';
import {
  handleInventoryClick,
  showSellChooseMenu,
  openXpTableModal,
  unequipSlot,
  togglePrayer,
  handleSpellClick,
  renderShopModal,
  renderSmithingModal
} from './playerActions';

export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (!node) {
    throw new Error(`missing #${id}`);
  }
  return node as T;
}

export function initStaticSvgIcons(): void {
  el('hero-crest-icon').innerHTML = getUiSvg('crest');
  el('hud-icon-hp').innerHTML = getUiSvg('hp');
  el('hud-icon-prayer').innerHTML = getUiSvg('prayer');
  el('hud-icon-spec').innerHTML = getUiSvg('spec');
  el('gp-coin-svg').innerHTML = getUiSvg('coins');

  el('tab-btn-combat').innerHTML = getUiSvg('tab_combat');
  el('tab-btn-skills').innerHTML = getUiSvg('tab_skills');
  el('tab-btn-inventory').innerHTML = getUiSvg('tab_inv');
  el('tab-btn-equipment').innerHTML = getUiSvg('tab_equip');
  el('tab-btn-prayer').innerHTML = getUiSvg('prayer');
  el('tab-btn-magic').innerHTML = getUiSvg('tab_magic');
}

export function addChatMessage(text: string, type: string = ''): void {
  const box = el('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-line ' + type;
  div.innerHTML = text;
  box.appendChild(div);
  while (box.children.length > 60) box.removeChild(box.firstChild!);
  box.scrollTop = box.scrollHeight;
}

export function getCombatLevel(): number {
  return combatLevel(STATE);
}

export interface ItemReqInfo {
  canEquip: boolean;
  plain: string;
  badgeHtml: string;
}

export function getItemReqInfo(it: ItemDef | null | undefined): ItemReqInfo {
  if (!it || !it.req || Object.keys(it.req).length === 0) {
    return {
      canEquip: true,
      plain: 'No Level Requirement',
      badgeHtml: `<div style="font-size:0.6875rem; color:#86efac; font-weight:700; margin-top:2px;">Req: None (Ready to Use)</div>`
    };
  }
  const parts: Array<{ skillName: string; reqLvl: number; curLvl: number; met: boolean }> = [];
  let allMet = true;
  for (const [skKey, reqLvl] of Object.entries(it.req)) {
    const meta = (SKILLS_META as Record<string, { name: string }>)[skKey] || { name: skKey };
    const curLvl = STATE.skills[skKey] ? STATE.skills[skKey].lvl : 1;
    const met = curLvl >= (reqLvl as number);
    if (!met) allMet = false;
    parts.push({ skillName: meta.name, reqLvl: reqLvl as number, curLvl, met });
  }
  const plain = 'Requires: ' + parts.map(p => `Lv ${p.reqLvl} ${p.skillName} (You: ${p.curLvl})`).join(', ');
  const badgeHtml = parts.map(p => {
    const col = p.met ? '#4ade80' : '#f87171';
    const status = p.met ? 'Can Equip' : `Your Lv: ${p.curLvl}`;
    return `<div style="font-size:0.6875rem; color:${col}; font-weight:700; margin-top:2px; background:rgba(0,0,0,0.35); padding:2px 5px; border-radius:4px; border-left:2px solid ${col};">Req: Lv ${p.reqLvl} ${p.skillName} (${status})</div>`;
  }).join('');
  return { canEquip: allMet, plain, badgeHtml };
}

export function spawnXpDrop(skillKey: string, amount: number): void {
  const container = el('xp-drops-container');
  const dropEl = document.createElement('div');
  dropEl.className = 'xp-drop';
  dropEl.innerHTML = `${getSkillSvg(skillKey)}<span>+${amount.toLocaleString()} XP</span>`;
  container.appendChild(dropEl);
  setTimeout(() => dropEl.remove(), 1850);
}

let lvlBannerTimeout: ReturnType<typeof setTimeout> | number | null = null;
export function showLevelUpBanner(skillName: string, newLvl: number): void {
  showBanner('Skill Level Up', `Congratulations, your ${skillName} level is now ${newLvl}!`);
}

export function showBanner(kicker: string, message: string): void {
  const banner = el('levelup-banner');
  const text = el('levelup-text');
  const head = el('levelup-kicker');
  head.textContent = kicker;
  text.textContent = message;
  banner.classList.add('show');
  if (lvlBannerTimeout) clearTimeout(lvlBannerTimeout);
  lvlBannerTimeout = setTimeout(() => banner.classList.remove('show'), 3500);
}

export function switchTab(tabName: string): void {
  const panel = el('right-panel');
  panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  panel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const btn = el('tab-btn-' + tabName);
  const content = el('tab-' + tabName);
  btn.classList.add('active');
  content.classList.add('active');
}

let uiRefreshDirty = false;

export function requestUiRefresh(): void {
  uiRefreshDirty = true;
}

export function consumeUiRefreshRequest(): boolean {
  if (uiRefreshDirty) {
    uiRefreshDirty = false;
    return true;
  }
  return false;
}

export function updateVitalsBars(): void {
  STATE.maxHp = STATE.skills.hitpoints.lvl;
  STATE.maxPrayerPts = STATE.skills.prayer.lvl;
  const hpPct = Math.max(0, Math.min(100, (STATE.hp / STATE.maxHp) * 100));
  const prayPct = Math.max(0, Math.min(100, (STATE.prayerPts / STATE.maxPrayerPts) * 100));
  el('hp-fill').style.width = hpPct + '%';
  el('hp-text').textContent = `${Math.ceil(STATE.hp)} / ${STATE.maxHp}`;
  el('prayer-fill').style.width = prayPct + '%';
  el('prayer-text').textContent = `${Math.ceil(STATE.prayerPts)} / ${STATE.maxPrayerPts}`;
  el('spec-fill').style.width = STATE.specEnergy + '%';
  el('spec-text').textContent = `Special ${Math.floor(STATE.specEnergy)}%`;
  el('lantern-mark').hidden = !STATE.quests.lanternVow;
  updateCooldownOverlays();
}

// The share of the food or potion cooldown still to run, 0 when that item can be used.
function cooldownRatio(type: 'food' | 'potion', now: number): number {
  const left = type === 'food' ? commandClocks.food.readyAt - now : commandClocks.potion.readyAt - now;
  return Math.max(0, Math.min(1, left / (type === 'food' ? FOOD_CD_SECS : POTION_CD_SECS)));
}

export function updateCooldownOverlays(): void {
  const now = performance.now() / 1000;

  const slotDivs = el('inventory-grid').querySelectorAll<HTMLElement>('.inv-slot');
  slotDivs.forEach((slotDiv, i) => {
    // The grid may be stale (rebuilt after this runs): only slots already drawn with an overlay are updated.
    const overlay = slotDiv.querySelector<HTMLElement>('.cooldown-overlay');
    const entry = STATE.inventory[i];
    if (!overlay || !entry) return;
    const it = (ITEMS as Record<string, ItemDef>)[entry.id];
    if (it.type === 'food' || it.type === 'potion') {
      const ratio = cooldownRatio(it.type, now);
      slotDiv.classList.toggle('cooldown', ratio > 0);
      slotDiv.style.setProperty('--cd', String(ratio));
      overlay.style.setProperty('--cd', String(ratio));
    }
  });
}

export function updateSkillsPanel(): void {
  const skillsGrid = el('skills-grid');
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
  el('total-lvl-val').textContent = String(totalLvl);
  el('total-xp-val').textContent = `${totalXp.toLocaleString()} XP`;
}

export function updateAllUI(): void {
  uiRefreshDirty = false;
  updateVitalsBars();

  el('combat-lvl-badge').textContent = `Combat Lv. ${getCombatLevel()}`;
  el('gp-amount').textContent = `${STATE.gp.toLocaleString()} GP`;

  const specBtn = el('spec-btn');
  const spec = weaponSpecial(STATE.equipment.weapon);
  specBtn.classList.toggle('armed', STATE.specArmed);
  specBtn.textContent = STATE.specArmed
    ? `SPECIAL ARMED — ${spec.name} (${Math.floor(STATE.specEnergy)}%)`
    : `SPECIAL: ${spec.name} (${Math.floor(STATE.specEnergy)}% · Cost ${spec.cost}%)`;

  const tracker = adventureTracker(STATE);
  el('quest-tracker-title').textContent = tracker.title;
  el('quest-tracker-step').textContent = tracker.detail;
  el('quest-tracker-fill').style.width = `${Math.round((tracker.done / Math.max(1, tracker.total)) * 100)}%`;

  const card = slayerCard(STATE);
  el('slayer-widget-name').textContent = card.name;
  el('slayer-widget-detail').textContent = card.detail;
  el('slayer-widget-fill').style.width = `${Math.round(card.ratio * 100)}%`;
  el('slayer-widget').classList.toggle('empty', card.empty);

  const titleEl = el('hero-title');
  if (STATE.quests.title) {
    titleEl.hidden = false;
    titleEl.textContent = STATE.quests.title;
  } else {
    titleEl.hidden = true;
  }

  const wepId = STATE.equipment.weapon;
  const wepName = wepId && (ITEMS as Record<string, ItemDef>)[wepId] ? (ITEMS as Record<string, ItemDef>)[wepId].name : 'Unarmed Fists';
  el('equipped-weapon-title').textContent = wepName;
  const spObj = SPELLS.find(x => x.id === STATE.activeSpell);
  if (spObj) el('active-spell-badge').textContent = spObj.name;

  // 28-Slot Inventory with Custom SVG Artwork
  const invGrid = el('inventory-grid');
  el('inv-count').textContent = String(STATE.inventory.length);
  invGrid.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const slotDiv = document.createElement('button');
    slotDiv.type = 'button';
    slotDiv.className = 'inv-slot';
    const entry = STATE.inventory[i];
    if (entry && (ITEMS as Record<string, ItemDef>)[entry.id]) {
      const it = (ITEMS as Record<string, ItemDef>)[entry.id];
      slotDiv.setAttribute('aria-label', it.name + (entry.qty > 1 ? ` (${entry.qty})` : ''));
      slotDiv.innerHTML = `<div class="item-svg-wrap">${getItemSvg(it)}</div>`;
      if (isStackableInBackpack(it) || entry.qty > 1) {
        slotDiv.innerHTML += `<span class="qty-badge">${entry.qty}</span>`;
      }
      if (it.tier && (TIER_COLORS as Record<string, string>)[it.tier]) {
        slotDiv.innerHTML += `<span class="item-tier-dot" style="background:${(TIER_COLORS as Record<string, string>)[it.tier]}"></span>`;
      }
      if (it.type === 'food' || it.type === 'potion') {
        const ratio = cooldownRatio(it.type, performance.now() / 1000);
        if (ratio > 0) {
          slotDiv.classList.add('cooldown');
        }
        slotDiv.style.setProperty('--cd', String(ratio));
        slotDiv.innerHTML += `<div class="cooldown-overlay" style="--cd: ${ratio}"></div>`;
      }
      let statsInfo = '';
      if (it.type === 'equip') {
        const st: string[] = [];
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
      slotDiv.onmouseenter = (ev: MouseEvent) => showItemTooltip(ev, it);
      slotDiv.onmousemove = (ev: MouseEvent) => moveItemTooltip(ev);
      slotDiv.onmouseleave = () => hideItemTooltip();
      slotDiv.oncontextmenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        showSellChooseMenu(e, i);
      };
    } else {
      slotDiv.setAttribute('aria-label', `Empty slot ${i + 1}`);
    }
    invGrid.appendChild(slotDiv);
  }

  updateSkillsPanel();

  // Full 10-Slot Equipment Paperdoll (3x4 layout)
  const doll = el('equip-doll');
  const paperdollLayout: Array<{ key: string; label: string } | null> = [
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
    if (eqId && (ITEMS as Record<string, ItemDef>)[eqId]) {
      const it = (ITEMS as Record<string, ItemDef>)[eqId];
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
      pairStatusHtml = `<div style="margin-top:3px; color:#facc15; font-weight:700; text-shadow:0 0 10px rgba(250,204,21,0.6);">★ FULL KIT BONUS: ${bon.matchedSet} (+20% All Stats) ★</div>`;
    } else if (bon.dominantCount && bon.dominantCount >= 3) {
      pairStatusHtml = `<div style="margin-top:3px; color:#38bdf8; font-weight:700;">Set Synergy: ${bon.matchedSet} (+15% Stats) · Add 4th piece for Full Kit!</div>`;
    } else {
      pairStatusHtml = `<div style="margin-top:3px; color:#4ade80; font-weight:700;">Matched Pair: ${bon.matchedSet} (+10% Set Bonus)</div>`;
    }
  } else {
    const bIt = STATE.equipment.body ? (ITEMS as Record<string, ItemDef>)[STATE.equipment.body] : null;
    const lIt = STATE.equipment.legs ? (ITEMS as Record<string, ItemDef>)[STATE.equipment.legs] : null;
    if (bIt && bIt.pairId && (ITEMS as Record<string, ItemDef>)[bIt.pairId]) {
      pairStatusHtml = `<div style="margin-top:3px; color:#facc15;">Pair with <b>${(ITEMS as Record<string, ItemDef>)[bIt.pairId].name}</b> for +10% Set Bonus</div>`;
    } else if (lIt && lIt.pairId && (ITEMS as Record<string, ItemDef>)[lIt.pairId]) {
      pairStatusHtml = `<div style="margin-top:3px; color:#facc15;">Pair with <b>${(ITEMS as Record<string, ItemDef>)[lIt.pairId].name}</b> for +10% Set Bonus</div>`;
    }
  }
  el('equip-stats-box').innerHTML = `
    <div><b>Melee Accuracy:</b> +${bon.atk} &nbsp;|&nbsp; <b>Melee Strength:</b> +${bon.str}</div>
    <div><b>Armor Defence:</b> +${bon.def}</div>
    <div><b>Ranged Bonus:</b> +${bon.rng} &nbsp;|&nbsp; <b>Magic Bonus:</b> +${bon.mag}</div>
    ${pairStatusHtml}
  `;

  // Prayers Grid
  const pGrid = el('prayer-grid');
  pGrid.innerHTML = '';
  PRAYERS.forEach((p: PrayerDef) => {
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
  const mGrid = el('magic-grid');
  mGrid.innerHTML = '';
  SPELLS.forEach((sp: SpellDef) => {
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

  refreshCombatStyleLocks();
  syncSettingsButtons();
  const shopOpen = el('shop-modal');
  const bankOpen = el('bank-modal');
  const forgeOpen = el('smithing-modal');
  const mapOpen = el('worldmap-modal');
  const questOpen = el('quest-modal');
  if (shopOpen.classList.contains('open')) renderShopModal();
  if (bankOpen.classList.contains('open')) renderBankModal();
  if (forgeOpen.classList.contains('open')) renderSmithingModal();
  if (mapOpen.classList.contains('open')) renderWorldMap();
  if (questOpen.classList.contains('open')) {
    renderQuests();
    renderJournal();
  }
}

export function updateTargetHud(): void {
  const hud = el('target-hud');
  if (player.targetEntity && player.targetEntity.type === 'monster' && !isDown(player.targetEntity.ref.logic)) {
    const m: MonsterEntity = player.targetEntity.ref;
    hud.classList.add('visible');
    const isUntouchable = m.logic.shiftLeft > 0;
    hud.classList.toggle('untouchable', isUntouchable);
    el('target-name').textContent = m.def.name;
    el('target-lvl-tag').textContent = `Lv ${m.def.level}`;
    const pct = Math.max(0, Math.min(100, (m.logic.hp / m.logic.maxHp) * 100));
    el('target-hp-fill').style.width = pct + '%';
    el('target-hp-text').textContent = isUntouchable ? 'Untouchable' : `${Math.ceil(m.logic.hp)} / ${m.logic.maxHp}`;
  } else if (player.targetEntity && player.targetEntity.type === 'resource' && !player.targetEntity.ref.depleted) {
    const r: ResourceNodeEntity = player.targetEntity.ref;
    hud.classList.add('visible');
    hud.classList.remove('untouchable');
    el('target-name').textContent = r.def.name!;
    el('target-lvl-tag').textContent = `Req Lv ${r.def.req}`;
    el('target-hp-fill').style.width = '100%';
    el('target-hp-text').textContent = (SKILLS_META as Record<string, { name: string }>)[r.def.skill!].name;
  } else {
    hud.classList.remove('visible');
    hud.classList.remove('untouchable');
  }
}

export function updateBossBar(monster: MonsterEntity | null, markCount: number): void {
  const bar = el('boss-bar');
  if (!monster) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  el('boss-name').textContent = monster.def.name;
  const pct = Math.max(0, Math.min(100, (monster.logic.hp / monster.logic.maxHp) * 100));
  el('boss-hp-fill').style.width = pct + '%';
  el('boss-hp-text').textContent = `${Math.ceil(monster.logic.hp)} / ${monster.logic.maxHp}`;
  el('boss-marks').textContent = `Marks: ${markCount}`;
}

export function applyLoadedStateToHud(): void {
  ['accurate', 'aggressive', 'defensive', 'controlled', 'rapid', 'ranged', 'magic'].forEach(s => {
    const btn = document.getElementById('style-' + s);
    if (btn) btn.classList.toggle('active', s === STATE.combatStyle);
  });
  const xpBtn = el('xp-rate-btn');
  xpBtn.textContent = STATE.xpMultiplier === 10 ? '10x League XP' : '1x Classic OSRS';
  xpBtn.classList.toggle('active', STATE.xpMultiplier === 10);
  const savedTod = STATE.timeOfDay;
  STATE.timeOfDay = (savedTod + 2) % 3;
  cycleTimeOfDay();
}

export function refreshCombatStyleLocks(): void {
  const weapon = equippedWeapon(STATE);
  const allowed = allowedStyles(weapon);
  ['accurate', 'aggressive', 'defensive', 'controlled', 'rapid', 'magic'].forEach(id => {
    const styleEl = el('style-' + id);
    const on = STATE.combatStyle === id;
    styleEl.classList.toggle('active', on);
    styleEl.classList.toggle('style-locked', allowed.indexOf(id) === -1);
  });
}

export function showItemTooltip(ev: MouseEvent, it: ItemDef): void {
  if (!it) return;
  const tip = el('item-tooltip');
  tip.innerHTML = itemCompareHtml(it);
  tip.style.display = 'block';
  moveItemTooltip(ev);
}

export function moveItemTooltip(ev: MouseEvent): void {
  const tip = el('item-tooltip');
  tip.style.left = Math.min(window.innerWidth - 260, ev.clientX + 14) + 'px';
  tip.style.top = Math.min(window.innerHeight - 120, ev.clientY + 14) + 'px';
}

export function hideItemTooltip(): void {
  el('item-tooltip').style.display = 'none';
}

export interface SaveRecoveryNoticeCallbacks {
  onNewGame: () => void;
  onLoadOlder: (legacy: MigratedSave) => void;
}

let saveRecoveryWired = false;
let currentSaveRecoveryCallbacks: SaveRecoveryNoticeCallbacks | null = null;
let saveRecoveryAskOnceMoreNew = false;
let saveRecoveryAskOnceMoreOlder = false;
let saveRecoveryRaw = '';
let saveRecoveryFailedKey = '';

/** While the notice is open the rest of the page is inert, so no key or click can reach another control. */
function setPageInert(except: HTMLElement, inert: boolean): void {
  for (const c of Array.from(document.body.children)) if (c !== except) (c as HTMLElement).inert = inert;
}

function keepFailedText(action: string): string {
  return saveRecoveryRaw.length > LIMIT_BYTES
    ? `This save is too large to keep a backup copy. Click ${action} again to proceed without a backup.`
    : `Could not keep a backup copy. Click ${action} again to proceed without saving a backup.`;
}

/** `raw` is the stored string of the key that was read and could not be used (the main key, or the legacy key it migrated from). */
export function showSaveRecoveryNotice(raw: string, callbacks: SaveRecoveryNoticeCallbacks, failedKey: string): void {
  saveRecoveryRaw = raw;
  saveRecoveryFailedKey = failedKey;
  currentSaveRecoveryCallbacks = callbacks;
  saveRecoveryAskOnceMoreNew = false;
  saveRecoveryAskOnceMoreOlder = false;

  const modal = el('save-recovery-modal');
  const title = el('save-recovery-title');
  const msg = el('save-recovery-msg');
  const warn = el('save-recovery-warn');
  const olderBtn = el('save-recovery-older-btn');
  const fallbackBox = el('save-recovery-fallback-box');
  const fallbackText = el<HTMLTextAreaElement>('save-recovery-fallback-text');
  const copyStatus = el('save-recovery-copy-status');

  title.textContent = 'Save File Error';
  msg.textContent = 'The saved character could not be loaded because the save file is corrupted or could not be applied.';
  warn.textContent = '';
  copyStatus.textContent = '';
  fallbackBox.hidden = true;
  fallbackText.value = '';

  const preview = legacyPreview(localStorage, saveRecoveryFailedKey);
  if (preview) {
    olderBtn.hidden = false;
    olderBtn.textContent = `Load older save (${preview.gp.toLocaleString()} GP, Total Lv ${preview.totalLevel})`;
  } else {
    olderBtn.hidden = true;
  }

  if (!saveRecoveryWired) {
    saveRecoveryWired = true;

    document.addEventListener('keydown', (ev) => {
      if (!modal.classList.contains('open')) return;
      // Only Tab, Enter and Space aimed at the notice's own controls pass; input.ts's window listener sees nothing else.
      const own = ev.target instanceof Node && modal.contains(ev.target);
      if (own && (ev.code === 'Tab' || ev.code === 'Enter' || ev.code === 'Space')) return;
      ev.stopImmediatePropagation();
    }, true);

    el('save-recovery-new-btn').addEventListener('click', () => {
      const result = keepCorrupt(localStorage, saveRecoveryRaw);
      if (!recoveryExit('new', result)) {
        if (!saveRecoveryAskOnceMoreNew) {
          saveRecoveryAskOnceMoreNew = true;
          warn.textContent = keepFailedText('Start New Game');
          return;
        }
      }
      saveRecoveryAskOnceMoreNew = false;
      currentSaveRecoveryCallbacks!.onNewGame(); // a throw leaves the notice open
      modal.classList.remove('open');
      setPageInert(modal, false);
      updateAllUI();
    });

    olderBtn.addEventListener('click', () => {
      const legacy = readLegacy(localStorage, undefined, saveRecoveryFailedKey);
      if (!legacy) throw new Error('save recovery: Load Older Save clicked but no legacy save can be read');
      const result = keepCorrupt(localStorage, saveRecoveryRaw);
      if (!recoveryExit('older', result)) {
        if (!saveRecoveryAskOnceMoreOlder) {
          saveRecoveryAskOnceMoreOlder = true;
          warn.textContent = keepFailedText('Load Older Save');
          return;
        }
      }
      saveRecoveryAskOnceMoreOlder = false;
      currentSaveRecoveryCallbacks!.onLoadOlder(legacy); // a throw leaves the notice open
      modal.classList.remove('open');
      setPageInert(modal, false);
      updateAllUI();
    });

    el('save-recovery-copy-btn').addEventListener('click', () => {
      const raw = saveRecoveryRaw;
      const showFallback = () => {
        fallbackBox.hidden = false;
        fallbackText.value = raw;
        fallbackText.readOnly = true;
        fallbackText.select();
        copyStatus.textContent = 'Save text shown below. Copy it manually:';
      };

      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(raw).then(() => {
            copyStatus.textContent = 'Save text copied to clipboard.';
          }).catch(() => {
            showFallback();
          });
        } else {
          showFallback();
        }
      } catch {
        showFallback();
      }
    });
  }

  modal.classList.add('open');
  setPageInert(modal, true);
  (document.activeElement as HTMLElement | null)?.blur();
  el('save-recovery-new-btn').focus();
}
