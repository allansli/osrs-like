import { STATE } from '../state/gameState';
import type { QtyMode } from '../state/types';
import { getLevelForXp, SKILLS_META, OSRS_XP_TABLE } from '../data/skills';
import { ITEMS, unitSellPrice } from '../data/items';
import {
  addItem,
  removeItem,
  countItem,
  canAddItem,
  sellItem,
  buyItem,
  buyPrice,
  sellInventoryMatch,
  isGatheredGood,
  isUnequippedGear
} from '../state/inventory';
import { tryCraft, isLogId } from '../data/recipes';
import { noteBury, notePlate } from '../state/quests';
import { equippedWeapon, allowedStyles, canCastTeleport } from '../state/combat';
import { claimQuest, assignSlayerTask } from '../state/adventure';
import { levelUnlockLines } from '../state/unlocks';
import { isPointerFocused } from './pointerFocus';
import { SPELLS } from '../data/magic';
import { dispatchCommand } from '../engine/actions';
import { getSkillSvg } from './icons';
import { closeDialogue } from './dialogue';
import {
  renderShopModal as renderShopModalUi,
  renderForge,
  renderBankModal,
  renderWorldMap,
  renderQuests,
  syncSettingsButtons
} from './stations';
import {
  el,
  addChatMessage,
  getCombatLevel,
  spawnXpDrop,
  showLevelUpBanner,
  showBanner,
  updateAllUI,
  requestUiRefresh,
  hideItemTooltip
} from './hud';
import { SFX } from '../engine/audio';
import { spawnLevelUpFireworks } from '../engine/vfx';
import { rebuildPlayerEquipmentMeshes } from '../engine/playerMesh';
import { saveGameState } from '../engine/session';
import { teleportToRegion } from '../engine/actions';
import { openChooseMenu, hideContextMenu } from '../engine/input';
import { syncGraphicsButtons } from '../engine/renderer';

type SkillMeta = { name: string; desc: string };
const metaMap = SKILLS_META as Record<string, SkillMeta>;

export function grantXp(skillKey: string, baseAmount: number): void {
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
    const meta = metaMap[skillKey]!;
    addChatMessage(`Level Up! Your <b>${meta.name}</b> level is now <b>${s.lvl}</b>!`, 'lvlup');
    printUnlocks(skillKey, oldLvl, s.lvl);
    showLevelUpBanner(meta.name, s.lvl);
    spawnLevelUpFireworks();
  }
  requestUiRefresh();
}

function printUnlocks(skillKey: string, fromLevel: number, toLevel: number): void {
  for (const line of levelUnlockLines(skillKey, metaMap[skillKey]!.name, fromLevel, toLevel)) addChatMessage(line, 'skill');
}

export function skillLevels(): Record<string, number> {
  return Object.fromEntries(Object.entries(STATE.skills).map(([key, skill]) => [key, skill.lvl]));
}

/** Unlock lines for levels raised outside grantXp (quest and Slayer experience). */
export function announceUnlocksSince(before: Record<string, number>): void {
  for (const [key, level] of Object.entries(before)) printUnlocks(key, level, STATE.skills[key]!.lvl);
}

export function addItemToInventory(itemId: string, count: number = 1): boolean {
  const result = addItem(STATE, itemId, count);
  if (!result.ok) addChatMessage('Your backpack is full.', 'combat');
  updateAllUI();
  return result.added > 0;
}

export function sellInventoryItem(index: number, qtyMode?: QtyMode): void {
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
  const name = item ? item.name : slot.id;
  addChatMessage('Sold <b>' + result.moved + ' × ' + name + '</b> for <b style="color:#ffe642">' + result.gp!.toLocaleString() + ' GP</b> (65%).', 'loot');
  updateAllUI();
}

export function sellPayoutLabel(itemId: string, mode: QtyMode): { n: number; gp: number } {
  const item = ITEMS[itemId];
  const have = countItem(STATE, itemId);
  const n = mode === 'all' ? have : Math.min(mode, have);
  const gp = (item ? unitSellPrice(item) : 1) * Math.max(0, n);
  return { n, gp };
}

export function showSellChooseMenu(e: MouseEvent, index: number): void {
  const slot = STATE.inventory[index];
  if (!slot || !ITEMS[slot.id]) return;
  const modes: QtyMode[] = [1, 5, 10, 50, 'all'];
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
  options.push({ label: 'Cancel', tone: '', run: () => {} });
  openChooseMenu(e.clientX, e.clientY, options);
}

export function handleInventoryClick(index: number): void {
  const slot = STATE.inventory[index];
  if (!slot) return;
  const item = ITEMS[slot.id];
  if (!item) return;
  const shopOpen = el('shop-modal').classList.contains('open');
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
    dispatchCommand({ kind: 'eat', slot: index });
    return;
  }
  if (item.type === 'potion') {
    dispatchCommand({ kind: 'drink', slot: index });
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
          const reqMeta = metaMap[reqSkill]!;
          addChatMessage('You need <b>Level ' + reqLvl + ' ' + reqMeta.name + '</b> to equip ' + item.name + '.', 'combat');
          return;
        }
      }
    }
    const prevEquipped = STATE.equipment[item.slot!];
    removeItem(STATE, item.id, 1);
    if (prevEquipped && ITEMS[prevEquipped]) addItem(STATE, prevEquipped, 1);
    STATE.equipment[item.slot!] = item.id;
    if (item.slot === 'body' && (item.id.includes('plate') || item.id.includes('chain'))) notePlate(STATE);
    SFX.coin();
    addChatMessage('Equipped <b>' + item.name + '</b> (' + item.slot + ').', 'skill');
    if (item.slot === 'weapon') {
      const styles = allowedStyles(ITEMS[item.id] || null);
      if (!styles.includes(STATE.combatStyle)) STATE.combatStyle = styles[0];
    }
    rebuildPlayerEquipmentMeshes();
    updateAllUI();
    return;
  }
  const price = buyPrice(item);
  addChatMessage(`<b>${item.name}</b> — ${price === null ? '' : `Shop ${price.toLocaleString('en-US')} GP · `}sells for ${unitSellPrice(item).toLocaleString('en-US')} GP. Use it at the Bank, Anvil, or General Store.`);
}

export function unequipSlot(slotName: string): void {
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

export function setCombatStyle(style: string): void {
  const normalized = style === 'ranged' ? 'rapid' : style;
  dispatchCommand({ kind: 'style', style: normalized });
}

export function toggleSpecialAttack(): void {
  dispatchCommand({ kind: 'special' });
}

export function togglePrayer(prayerId: string): void {
  dispatchCommand({ kind: 'prayer', id: prayerId });
}

export function handleSpellClick(spellId: string): void {
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

export function toggleXpMultiplier(): void {
  STATE.xpMultiplier = STATE.xpMultiplier === 10 ? 1 : 10;
  const btn = el('xp-rate-btn');
  btn.textContent = STATE.xpMultiplier === 10 ? '10x League XP' : '1x Classic XP';
  btn.classList.toggle('active', STATE.xpMultiplier === 10);
  addChatMessage(`XP Multiplier set to <b>${STATE.xpMultiplier}x</b>.`, 'skill');
  updateAllUI();
}

let lastActiveElement: HTMLElement | null = null;

export function closeModals(): void {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  hideHoverTooltip();
  hideItemTooltip();
  hideContextMenu();
  closeDialogue();
  if (lastActiveElement) {
    lastActiveElement.focus();
    lastActiveElement = null;
  }
}

export function hideHoverTooltip(): void {
  const tooltip = el('hover-tooltip');
  tooltip.style.display = 'none';
  document.body.style.cursor = 'default';
}

export function openModal(id: string): HTMLElement {
  const active = document.activeElement as HTMLElement;
  // A modal opened from inside another modal keeps the original HUD opener.
  // Focus goes back only to an opener reached by keyboard; a mouse click leaves focus to the game.
  const opener = active.closest('.modal-backdrop') ? lastActiveElement : isPointerFocused(active) ? null : active;
  closeModals();
  lastActiveElement = opener;
  const modal = el(id);
  modal.classList.add('open');
  hideHoverTooltip();
  modal.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')!.focus();
  return modal;
}

export function openShopModal(filter: string = 'all'): void {
  STATE.shopFilter = filter;
  openModal('shop-modal');
  renderShopModal();
}

export function renderShopModal(): void {
  renderShopModalUi();
}

export function buyShopItem(itemId: string): void {
  const result = buyItem(STATE, itemId, STATE.transferQty || 1);
  if (!result.ok) addChatMessage(result.reason || 'Cannot buy that.', 'combat');
  else {
    SFX.coin();
    addChatMessage('Purchased <b>' + result.moved + ' × ' + ITEMS[itemId].name + '</b> for ' + (result.gp || 0).toLocaleString() + ' GP.', 'loot');
  }
  updateAllUI();
}

export function buyShopPair(topId: string, bottomId: string): void {
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

export function sellAllLoot(): void {
  const result = sellInventoryMatch(STATE, isGatheredGood, 'No raw resources in your backpack to bulk-sell.');
  if (!result.ok) {
    addChatMessage(result.reason || 'No raw resources in your backpack to bulk-sell.');
    return;
  }
  SFX.coin();
  addChatMessage('Sold ' + result.moved + ' gathered goods for <b style="color:#ffe642">' + (result.gp || 0).toLocaleString() + ' GP</b> (65%).', 'loot');
  updateAllUI();
}

export function sellAllUnequippedGear(): void {
  const result = sellInventoryMatch(STATE, isUnequippedGear, 'No unequipped gear in your backpack to sell.');
  if (!result.ok) {
    addChatMessage(result.reason || 'No unequipped gear in your backpack to sell.');
    return;
  }
  SFX.coin();
  addChatMessage('Sold ' + result.moved + ' unequipped gear for <b style="color:#ffe642">' + (result.gp || 0).toLocaleString() + ' GP</b> (65%).', 'loot');
  updateAllUI();
}

export function openSmithingModal(): void {
  openModal('smithing-modal');
  renderSmithingModal();
}

export function renderSmithingModal(): void {
  renderForge();
}

export function craftRecipe(recipeId: string): void {
  const result = tryCraft(STATE, recipeId);
  if (!result.ok) {
    addChatMessage(result.reason || 'You cannot craft that yet.', 'combat');
    if (el('smithing-modal').classList.contains('open')) renderSmithingModal();
    return;
  }
  SFX.mine();
  const made = result.output && ITEMS[result.output] ? ITEMS[result.output].name : 'the item';
  addChatMessage('Crafted <b>' + made + '</b>.', 'skill');
  if (result.skill) grantXp(result.skill, result.xp || 0);
}

export function openXpTableModal(skillKey: string = 'attack'): void {
  openModal('xptable-modal');
  const sk = STATE.skills[skillKey] || STATE.skills.attack;
  const meta = metaMap[skillKey] || SKILLS_META.attack;
  const nextLvl = Math.min(99, sk.lvl + 1);
  const nextXp = OSRS_XP_TABLE[nextLvl];
  const remXp = Math.max(0, nextXp - sk.xp);

  el('xptable-skill-summary').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="display:flex; align-items:center; gap:8px;">
        <span style="width:20px;height:20px;display:inline-flex;">${getSkillSvg(skillKey)}</span>
        <b>${meta.name}</b> — Current Level: <b style="color:#ffe642">${sk.lvl} / 99</b>
      </span>
      <span>Current XP: <b>${sk.xp.toLocaleString()}</b> &nbsp;|&nbsp; Next Level (${nextLvl}): <b style="color:#38bdf8">${remXp.toLocaleString()} XP needed</b></span>
    </div>
    <div style="margin-top:4px; color:#b8aa91;">${meta.desc}</div>
  `;

  const grid = el('xptable-grid');
  grid.innerHTML = '';
  for (let lvl = 1; lvl <= 99; lvl++) {
    const cell = document.createElement('div');
    cell.className = 'xp-cell' + (sk.lvl >= lvl ? ' reached' : '');
    cell.innerHTML = `<span class="lvl-num">Lv ${lvl}</span><span class="xp-num">${OSRS_XP_TABLE[lvl].toLocaleString()}</span>`;
    grid.appendChild(cell);
  }
}

export function openWorldMapModal(): void {
  openModal('worldmap-modal');
  renderWorldMap(null);
}

export function locateQuestRegion(regionId: string): void {
  openModal('worldmap-modal');
  renderWorldMap(regionId);
}

export function claimQuestReward(questId: string): void {
  const before = skillLevels();
  const result = claimQuest(STATE, questId);
  if (!result.ok) {
    addChatMessage(result.reason || 'You cannot claim that yet.', 'combat');
    return;
  }
  SFX.coin();
  SFX.levelUp();
  addChatMessage(result.chat || 'Quest complete.', 'lvlup');
  announceUnlocksSince(before);
  showBanner('Quest Reward', result.banner || 'Reward claimed');
  spawnLevelUpFireworks(0xfde047);
  updateAllUI();
}

export function requestSlayerTask(): void {
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

export function openBankModal(): void {
  STATE.quests.openedBank = true;
  openModal('bank-modal');
  renderBankModal();
}

export function openQuestsModal(): void {
  openModal('quest-modal');
  renderQuests();
}

export function openSettingsModal(): void {
  syncSettingsButtons();
  syncGraphicsButtons();
  openModal('settings-modal');
}

export function toggleAudio(): void {
  STATE.audioEnabled = !STATE.audioEnabled;
  syncSettingsButtons();
  addChatMessage(STATE.audioEnabled ? 'Audio on.' : 'Audio muted.', 'skill');
  saveGameState();
}
