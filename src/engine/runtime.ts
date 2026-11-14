import { player, camState, G } from './context';
import { SFX } from './audio';
import { rebuildPlayerEquipmentMeshes } from './playerMesh';
import { cycleTimeOfDay } from './worldMesh';
import { worldToScreen } from './overlay';
export { worldToScreen };
import {
  saveGameState,
  loadGameState,
  manualSaveToast,
  resetGameSave,
  cheatSkillsPlus10,
  cheatGold200k,
  applyTypedCheat,
  dismissOnboarding,
  replayOnboarding,
  maybeShowOnboarding
} from './session';
import {
  teleportToRegion,
  triggerRegionBanner
} from './actions';
import {
  resetCameraBehindPlayer
} from './input';
import {
  cycleGraphicsQuality,
  toggleOutlines,
  init3DEngine
} from './renderer';
import { ITEMS } from '../data/items';
import { WORLD_REGIONS } from '../data/world';
import { STATE } from '../state/gameState';
import { loadBlenderGearTemplate } from './blenderGear';
import { bridge } from '../ui/bridge';
import {
  el,
  initStaticSvgIcons,
  addChatMessage,
  switchTab,
  updateAllUI,
  applyLoadedStateToHud,
  showItemTooltip,
  moveItemTooltip,
  hideItemTooltip
} from '../ui/hud';
import {
  sellInventoryItem,
  showSellChooseMenu,
  unequipSlot,
  setCombatStyle,
  toggleSpecialAttack,
  togglePrayer,
  handleSpellClick,
  toggleXpMultiplier,
  closeModals,
  openShopModal,
  buyShopItem,
  buyShopPair,
  sellAllLoot,
  sellAllUnequippedGear,
  openSmithingModal,
  craftRecipe,
  openXpTableModal,
  openWorldMapModal,
  locateQuestRegion,
  claimQuestReward,
  requestSlayerTask,
  openBankModal,
  openQuestsModal,
  openSettingsModal,
  toggleAudio
} from '../ui/playerActions';
import { gameLoop } from './loop';

const WINDOW_ACTIONS = {
  cheatSkillsPlus10,
  cheatGold200k,
  applyTypedCheat,
  setCombatStyle,
  closeModals,
  switchTab,
  craftRecipe,
  openWorldMapModal,
  openShopModal,
  openSmithingModal,
  openXpTableModal,
  openBankModal,
  openQuestsModal,
  openSettingsModal,
  cycleGraphicsQuality,
  toggleOutlines,
  toggleXpMultiplier,
  cycleTimeOfDay,
  toggleAudio,
  resetGameSave,
  manualSaveToast,
  sellInventoryItem,
  buyShopItem,
  buyShopPair,
  sellAllLoot,
  sellAllUnequippedGear,
  unequipSlot,
  toggleSpecialAttack,
  togglePrayer,
  handleSpellClick,
  teleportToRegion,
  resetCameraBehindPlayer,
  dismissOnboarding,
  replayOnboarding,
};

export const WINDOW_GLOBALS: readonly string[] = Object.keys(WINDOW_ACTIONS);

function wireBridge(): void {
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

  for (const [name, fn] of Object.entries(WINDOW_ACTIONS)) {
    (window as unknown as Record<string, unknown>)[name] = fn;
  }
  (window as unknown as { __DEV_ACCESS__?: unknown }).__DEV_ACCESS__ = {
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

// ============================================================================
// 13. BOOTSTRAP GAME ON LOAD
// ============================================================================
export function boot(): void {
  window.addEventListener('beforeunload', saveGameState);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveGameState();
    }
  });
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
    const cheatInput = el<HTMLInputElement>('cheat-code-input');
    cheatInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        applyTypedCheat();
      }
    });
    const startReg = WORLD_REGIONS.find(r => r.id === STATE.currentRegion) || WORLD_REGIONS[0];
    triggerRegionBanner(startReg);
    (window as unknown as { __DEBUG?: unknown }).__DEBUG = { STATE, player, camState, rebuildPlayerEquipmentMeshes, ITEMS };
    requestAnimationFrame(gameLoop);
  });
}
