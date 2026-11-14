import { player, camState } from './context';
import { SFX } from './audio';
import { spawnLevelUpFireworks } from './vfx';
import { STATE, applyState } from '../state/gameState';
import { readSave, writeSave, SAVE_KEY, LEGACY_SAVE_KEYS, sanitizeCam } from '../state/save';
import { matchCheat, applySkillsPlus10, applyGold200k } from '../state/cheats';
import { el, addChatMessage, showBanner, updateAllUI } from '../ui/hud';
import { closeModals } from '../ui/playerActions';

export function saveGameState(): void {
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
    const saveBtn = el('save-status-btn');
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    saveBtn.textContent = 'Saved (' + hh + ':' + mm + ':' + ss + ')';
  } catch (e) {}
}

export function loadGameState(): boolean {
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
      const cam = sanitizeCam(migrated.cam);
      camState.yaw = cam.yaw;
      camState.manualOffset = cam.manualOffset;
      camState.pitch = cam.pitch;
      camState.distance = cam.distance;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function manualSaveToast(): void {
  saveGameState();
  SFX.coin();
  addChatMessage('Progress & state saved to <b>localStorage</b> (Skills, XP, GP, Inventory, 10-Slot Equipment, Vitals, Prayers & World Coordinates).', 'lvlup');
}

export function resetGameSave(): void {
  if (!confirm('Reset your saved character progress in localStorage and start fresh?')) return;
  try {
    localStorage.removeItem(SAVE_KEY);
    LEGACY_SAVE_KEYS.forEach(key => localStorage.removeItem(key));
  } catch (e) {}
  window.location.reload();
}

let cheatBuffer: string = '';

export function noteCheatKey(e: KeyboardEvent): void {
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

export function cheatSkillsPlus10(): void {
  applySkillsPlus10(STATE);
  SFX.levelUp();
  spawnLevelUpFireworks();
  showBanner('Cheat Activated', 'All skills increased by +10 levels!');
  addChatMessage('Cheat code <b>skills10</b> activated: all skills increased by <b>+10</b>!', 'lvlup');
  updateAllUI();
  saveGameState();
}

export function cheatGold200k(): void {
  applyGold200k(STATE);
  SFX.coin();
  showBanner('Cheat Activated', '+200,000 GP added to your coin pouch!');
  addChatMessage('Cheat code <b>gold200k</b> activated: <b>+200,000 GP</b> added!', 'loot');
  updateAllUI();
  saveGameState();
}

export function applyTypedCheat(): void {
  const input = el<HTMLInputElement>('cheat-code-input');
  const kind = matchCheat(input.value);
  input.value = '';
  if (kind === 'skills') cheatSkillsPlus10();
  else if (kind === 'gold') cheatGold200k();
  else addChatMessage('Unknown cheat code. Try <b>skills10</b> or <b>gold200k</b>.', 'combat');
}

export const INTRO_KEY = 'gielinor_hero_intro_v1';

export function dismissOnboarding(): void {
  const board = el('onboarding');
  board.hidden = true;
  try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
}

export function replayOnboarding(): void {
  closeModals();
  const board = el('onboarding');
  board.hidden = false;
}

export function maybeShowOnboarding(): void {
  let seen = false;
  try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) {}
  const board = el('onboarding');
  board.hidden = seen;
}
