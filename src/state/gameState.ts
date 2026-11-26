import { getLevelForXp, SKILL_KEYS } from '../data/skills';
import { copyQuests, defaultQuests, STARTER_ARRIVAL } from './quests';
import type { GameState, Progress, QtyMode } from './types';

export const BACKPACK_SIZE = 28;
/** Room for every armor set (33 pairs + helms, weapons, shields) plus resource stacks. */
export const BANK_CAPACITY = 480;

export const EQUIP_SLOTS = ['head', 'cape', 'neck', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'] as const;

const STARTER_SHRINES: Record<string, boolean> = {
  lumbridge: true,
  varrock: false,
  desert: false,
  woods: false,
  wilderness: false
};

export function createDefaultState(): GameState {
  const skills: GameState['skills'] = {};
  for (const key of SKILL_KEYS) {
    skills[key] = key === 'hitpoints' ? { xp: 1154, lvl: 10 } : { xp: 0, lvl: 1 };
  }
  skills.hitpoints.lvl = getLevelForXp(skills.hitpoints.xp);

  return {
    gp: 500,
    xpMultiplier: 10,
    combatStyle: 'accurate',
    activeSpell: 'wind_strike',
    specArmed: false,
    specEnergy: 100,
    hp: 10,
    maxHp: 10,
    prayerPts: 1,
    maxPrayerPts: 1,
    activePrayers: new Set<string>(),
    currentRegion: 'lumbridge',
    timeOfDay: 0,
    shopFilter: 'all',
    bankFilter: 'all',
    bankQuery: '',
    audioEnabled: true,
    transferQty: 1 as QtyMode,
    skills,
    equipment: {
      head: null,
      cape: null,
      neck: null,
      weapon: 'bronze_scimitar',
      body: null,
      shield: null,
      legs: null,
      hands: null,
      feet: null,
      ring: null
    },
    inventory: [
      { id: 'hylian_hood', qty: 1 },
      { id: 'hylian_tunic', qty: 1 },
      { id: 'hylian_trousers', qty: 1 },
      { id: 'hylian_cape', qty: 1 },
      { id: 'wooden_shield', qty: 1 },
      { id: 'leather_gloves', qty: 1 },
      { id: 'leather_boots', qty: 1 },
      { id: 'bronze_plate', qty: 1 },
      { id: 'bronze_legs', qty: 1 },
      { id: 'wizard_top', qty: 1 },
      { id: 'wizard_bottom', qty: 1 },
      { id: 'bronze_helm', qty: 1 },
      { id: 'shortbow', qty: 1 },
      { id: 'fire_staff', qty: 1 },
      { id: 'cooked_chicken', qty: 3 },
      { id: 'shrimp', qty: 5 },
      { id: 'prayer_potion', qty: 2 },
      { id: 'bones', qty: 3 },
      { id: 'bronze_arrow', qty: 50 },
      { id: 'feather', qty: 40 },
      { id: 'air_rune', qty: 80 },
      { id: 'mind_rune', qty: 80 },
      { id: 'law_rune', qty: 15 }
    ],
    bank: [],
    shrines: { ...STARTER_SHRINES },
    quests: defaultQuests()
  };
}

export function createNewGameState(): GameState {
  const state = createDefaultState();
  state.gp = 0;
  state.xpMultiplier = 1;
  for (const slot of EQUIP_SLOTS) {
    state.equipment[slot] = null;
  }
  state.inventory = [];
  state.quests.claimed = [STARTER_ARRIVAL];
  return state;
}

export const STATE = createDefaultState();

function copyProgress(p?: Progress): Progress | undefined {
  if (!p) return undefined;
  return {
    story: p.story ? { ...p.story } : undefined,
    stats: p.stats ? { ...p.stats } : undefined,
    diary: p.diary ? [...p.diary] : undefined,
    dungeons: p.dungeons
      ? Object.fromEntries(Object.entries(p.dungeons).map(([k, v]) => [k, { ...v }]))
      : undefined,
    bossDownUntil: p.bossDownUntil ? { ...p.bossDownUntil } : undefined
  };
}

export function cloneState(state: GameState = createDefaultState()): GameState {
  return {
    ...state,
    activePrayers: new Set(state.activePrayers),
    skills: Object.fromEntries(Object.entries(state.skills).map(([k, v]) => [k, { ...v }])),
    equipment: { ...state.equipment },
    inventory: state.inventory.map((s) => ({ ...s })),
    bank: state.bank.map((s) => ({ ...s })),
    shrines: { ...state.shrines },
    quests: copyQuests(state.quests),
    progress: copyProgress(state.progress)
  };
}

export function applyState(target: GameState, next: GameState): void {
  target.gp = next.gp;
  target.xpMultiplier = next.xpMultiplier;
  target.combatStyle = next.combatStyle;
  target.activeSpell = next.activeSpell;
  target.specArmed = next.specArmed;
  target.specEnergy = next.specEnergy;
  target.hp = next.hp;
  target.maxHp = next.maxHp;
  target.prayerPts = next.prayerPts;
  target.maxPrayerPts = next.maxPrayerPts;
  target.activePrayers = new Set(next.activePrayers);
  target.currentRegion = next.currentRegion;
  target.timeOfDay = next.timeOfDay;
  target.shopFilter = next.shopFilter;
  target.bankFilter = next.bankFilter;
  target.bankQuery = next.bankQuery;
  target.audioEnabled = next.audioEnabled;
  target.transferQty = next.transferQty;
  for (const key of Object.keys(target.skills)) {
    if (next.skills[key]) {
      target.skills[key].xp = next.skills[key].xp;
      target.skills[key].lvl = next.skills[key].lvl;
    }
  }
  for (const key of Object.keys(target.equipment)) {
    target.equipment[key] = next.equipment[key] ?? null;
  }
  target.inventory = next.inventory.map((s) => ({ ...s }));
  target.bank = next.bank.map((s) => ({ ...s }));
  target.shrines = { ...next.shrines };
  target.quests = copyQuests(next.quests);
  target.progress = copyProgress(next.progress);
}
