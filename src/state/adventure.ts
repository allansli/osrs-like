import { getLevelForXp } from '../data/skills';
import { addItem, canAddItem } from './inventory';
import { noteGather as markGather, noteSmelt as markSmelt } from './quests';
import type { GameState, SlayerTask } from './types';

export const RARE_TIERS = ['rune', 'gilded', 'dragon', 'barrows', 'bandos', 'raids', 'botw'] as const;

const DRAGONFIRE_WARDS = ['hylian_shield', 'elysian_shield', 'dragon_defender'] as const;

export interface SlayerBand {
  monster: string;
  name: string;
  count: number;
  minCombat: number;
  maxCombat: number;
  bountyGp: number;
  bountyXp: number;
  killXp: number;
}

export const SLAYER_BANDS: SlayerBand[] = [
  { monster: 'goblin', name: 'Goblin Raider', count: 6, minCombat: 3, maxCombat: 15, bountyGp: 400, bountyXp: 80, killXp: 12 },
  { monster: 'scorpion', name: 'King Scorpion', count: 5, minCombat: 10, maxCombat: 22, bountyGp: 900, bountyXp: 160, killXp: 20 },
  { monster: 'dark_wizard', name: 'Dark Wizard', count: 5, minCombat: 16, maxCombat: 30, bountyGp: 1200, bountyXp: 220, killXp: 28 },
  { monster: 'hill_giant', name: 'Hill Giant', count: 5, minCombat: 24, maxCombat: 42, bountyGp: 1800, bountyXp: 320, killXp: 36 },
  { monster: 'moss_guardian', name: 'Moss Guardian', count: 4, minCombat: 40, maxCombat: 60, bountyGp: 3200, bountyXp: 480, killXp: 48 },
  { monster: 'lesser_demon', name: 'Lesser Demon', count: 4, minCombat: 55, maxCombat: 99, bountyGp: 5500, bountyXp: 700, killXp: 64 }
];

export interface QuestStep {
  label: string;
  met: (state: GameState) => boolean;
}

export interface QuestRewardItem {
  id: string;
  qty: number;
}

export interface QuestDef {
  id: string;
  name: string;
  region: string;
  lore: string;
  rewardText: string;
  steps: QuestStep[];
  gp: number;
  xp: Record<string, number>;
  items: QuestRewardItem[];
  ward?: boolean;
  title?: string;
}

export const QUEST_DEFS: QuestDef[] = [
  {
    id: 'lumbridge',
    name: 'Lumbridge Foundations',
    region: 'lumbridge',
    lore: 'Settle the haven: bank your coin, light a campfire, and drive off a goblin.',
    rewardText: '500 GP, 250 Attack XP, and 250 Hitpoints XP.',
    steps: [
      { label: 'Open the Lumbridge Bank', met: (s) => s.quests.openedBank },
      { label: 'Burn any log', met: (s) => s.quests.burnedLog },
      { label: 'Defeat a Goblin', met: (s) => s.quests.killedGoblin }
    ],
    gp: 500,
    xp: { attack: 250, hitpoints: 250 },
    items: []
  },
  {
    id: 'varrock',
    name: 'Varrock Arcane Trial',
    region: 'varrock',
    lore: 'Attune the plaza shrine, break a dark caster, and bring back iron or mithril.',
    rewardText: '1,500 GP, 40 Fire runes, and 40 Chaos runes.',
    steps: [
      { label: 'Discover the Varrock shrine', met: (s) => !!s.shrines.varrock },
      { label: 'Defeat a Dark Wizard or Dark Ranger', met: (s) => s.quests.killedArcane },
      { label: 'Mine Iron or Mithril ore', met: (s) => s.quests.minedMetal }
    ],
    gp: 1500,
    xp: {},
    items: [
      { id: 'fire_rune', qty: 40 },
      { id: 'chaos_rune', qty: 40 }
    ]
  },
  {
    id: 'desert',
    name: 'Sunscorched Oasis',
    region: 'desert',
    lore: 'Cross the golden dunes, slay a King Scorpion, and smelt a bar at the forge.',
    rewardText: '3,000 GP, 600 Smithing XP, and 600 Mining XP.',
    steps: [
      { label: 'Discover the Al-Kharid shrine', met: (s) => !!s.shrines.desert },
      { label: 'Defeat a King Scorpion', met: (s) => s.quests.killedScorpion },
      { label: 'Smelt any metal bar', met: (s) => s.quests.smeltedBar }
    ],
    gp: 3000,
    xp: { smithing: 600, mining: 600 },
    items: []
  },
  {
    id: 'woods',
    name: 'Whispering Sanctuary',
    region: 'woods',
    lore: 'Find the Korok shrine, fell ancient timber, and silence a Moss Guardian.',
    rewardText: '6,000 GP and 5 Hearty Durian Stews.',
    steps: [
      { label: 'Discover the Korok Woods shrine', met: (s) => !!s.shrines.woods },
      { label: 'Chop a Yew or Magic log', met: (s) => s.quests.choppedAncient },
      { label: 'Defeat a Moss Guardian', met: (s) => s.quests.killedMoss }
    ],
    gp: 6000,
    xp: {},
    items: [{ id: 'hearty_elixir', qty: 5 }]
  },
  {
    id: 'wilderness',
    name: 'Dragon Slayer',
    region: 'wilderness',
    lore: "Climb Dragon's Peak and slay Elvarg the Crag Dragon.",
    rewardText: '25,000 GP, the Dragonfire Ward blessing, 10 Dragon Bones, and the Dragon Slayer title.',
    steps: [
      { label: "Discover the Dragon's Peak shrine", met: (s) => !!s.shrines.wilderness },
      { label: 'Slay Elvarg the Crag Dragon', met: (s) => s.quests.killedElvarg }
    ],
    gp: 25000,
    xp: {},
    items: [{ id: 'dragon_bones', qty: 10 }],
    ward: true,
    title: 'Dragon Slayer'
  }
];

export interface WeaponSpec {
  name: string;
  cost: number;
  multiplier: number;
  healRatio: number;
  accuracy: number;
  kind: 'melee' | 'ranged';
}

export function combatLevel(state: GameState): number {
  const skills = state.skills;
  const defence = skills.defence?.lvl || 1;
  const hitpoints = skills.hitpoints?.lvl || 10;
  const prayer = skills.prayer?.lvl || 1;
  const attack = skills.attack?.lvl || 1;
  const strength = skills.strength?.lvl || 1;
  const ranged = skills.ranged?.lvl || 1;
  const magic = skills.magic?.lvl || 1;
  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  const range = 0.325 * Math.floor(ranged * 1.5);
  const mage = 0.325 * Math.floor(magic * 1.5);
  return Math.max(3, Math.floor(base + Math.max(melee, range, mage)));
}

export type ThreatTone = 'green' | 'yellow' | 'red';

/** Green when the monster is below the player, yellow when equal or within 3 levels, red when higher. */
export function monsterThreatColor(monsterLevel: number, playerCombat: number): ThreatTone {
  if (monsterLevel < playerCombat) return 'green';
  if (monsterLevel <= playerCombat + 3) return 'yellow';
  return 'red';
}

export function attackOptionLabel(name: string, level: number): string {
  return `Attack ${name} (level-${level})`;
}

export function isRareLoot(item: { tier?: string } | null | undefined): boolean {
  return !!item?.tier && (RARE_TIERS as readonly string[]).includes(item.tier);
}

export function isBossLoot(typeKey: string): boolean {
  return typeKey === 'elvarg_dragon';
}

export function gatherVerb(kind: string, itemId: string): string {
  if (kind === 'tree') return 'Chop down';
  if (kind === 'rock') return 'Mine';
  if (itemId === 'raw_shrimp') return 'Net';
  if (itemId === 'raw_trout') return 'Lure';
  if (itemId === 'raw_lobster' || itemId === 'raw_shark') return 'Cage';
  return 'Gather';
}

export function weaponSpecial(weaponId: string | null | undefined): WeaponSpec {
  switch (weaponId) {
    case 'dragon_scimitar':
      return { name: 'Sever', cost: 25, multiplier: 1.65, healRatio: 0, accuracy: 1.5, kind: 'melee' };
    case 'abyssal_whip':
      return { name: 'Energy Drain Lash', cost: 25, multiplier: 1.6, healRatio: 0.15, accuracy: 1.8, kind: 'melee' };
    case 'bandos_godsword':
      return { name: 'Warstrike', cost: 50, multiplier: 1.85, healRatio: 0, accuracy: 1.5, kind: 'melee' };
    case 'master_sword':
    case 'deity_sword':
      return { name: 'Skyward Crescent Beam', cost: 25, multiplier: 1.8, healRatio: 0, accuracy: 1.5, kind: 'melee' };
    case 'ancient_bow':
      return { name: 'Ancient Piercing Shot', cost: 25, multiplier: 1.7, healRatio: 0, accuracy: 1.5, kind: 'ranged' };
    case 'armadyl_crossbow':
      return { name: 'Armadyl Eye', cost: 25, multiplier: 1.7, healRatio: 0, accuracy: 1.5, kind: 'ranged' };
    default:
      return { name: 'Hylian Spin-Slash', cost: 25, multiplier: 1.55, healRatio: 0, accuracy: 1.5, kind: 'melee' };
  }
}

export function wearingDharok(state: GameState): boolean {
  return state.equipment.head === 'dharok_helm'
    && state.equipment.body === 'dharok_body'
    && state.equipment.legs === 'dharok_legs'
    && state.equipment.weapon === 'dharok_greataxe';
}

/** Melee damage scale for the full Dharok set: 1 + missing-health ratio × 0.85. */
export function dharokMultiplier(state: GameState): number {
  if (!wearingDharok(state)) return 1;
  const maxHp = Math.max(1, state.maxHp || 1);
  const missing = Math.max(0, maxHp - state.hp);
  return 1 + (missing / maxHp) * 0.85;
}

export interface DragonfireResult {
  damage: number;
  absorbed: boolean;
}

/**
 * Dragonfire keeps 25% when Protect from Magic or a warding shield is up.
 * It does not also apply the generic 80% overhead reduction.
 */
export function resolveDragonfire(raw: number, state: GameState): DragonfireResult {
  const amount = Math.max(0, Math.floor(raw));
  const shield = state.equipment.shield || '';
  const absorbed = state.activePrayers.has('prot_magic') || (DRAGONFIRE_WARDS as readonly string[]).includes(shield);
  return {
    damage: absorbed ? Math.floor(amount * 0.25) : amount,
    absorbed
  };
}

function grantExactXp(state: GameState, skillKey: string, amount: number): void {
  const skill = state.skills[skillKey];
  if (!skill || amount <= 0) return;
  const oldLevel = skill.lvl;
  skill.xp += amount;
  skill.lvl = getLevelForXp(skill.xp);
  if (skillKey === 'hitpoints') {
    state.maxHp = skill.lvl;
    state.hp = Math.min(state.maxHp, state.hp + Math.max(0, skill.lvl - oldLevel));
  }
  if (skillKey === 'prayer') {
    state.maxPrayerPts = skill.lvl;
  }
}

export interface QuestView {
  id: string;
  name: string;
  region: string;
  lore: string;
  rewardText: string;
  steps: Array<{ label: string; met: boolean }>;
  done: number;
  total: number;
  complete: boolean;
  claimed: boolean;
}

export function questView(state: GameState): QuestView[] {
  return QUEST_DEFS.map((def) => {
    const steps = def.steps.map((step) => ({ label: step.label, met: step.met(state) }));
    const done = steps.filter((step) => step.met).length;
    return {
      id: def.id,
      name: def.name,
      region: def.region,
      lore: def.lore,
      rewardText: def.rewardText,
      steps,
      done,
      total: steps.length,
      complete: done === steps.length,
      claimed: state.quests.claimed.includes(def.id)
    };
  });
}

export interface ClaimResult {
  ok: boolean;
  reason?: string;
  banner?: string;
  chat?: string;
  gp?: number;
}

function canHoldRewards(state: GameState, items: QuestRewardItem[]): boolean {
  const rehearsal = { ...state, inventory: state.inventory.map((slot) => ({ ...slot })) };
  for (const item of items) {
    if (!canAddItem(rehearsal, item.id, item.qty)) return false;
    addItem(rehearsal, item.id, item.qty);
  }
  return true;
}

export function claimQuest(state: GameState, questId: string): ClaimResult {
  const def = QUEST_DEFS.find((quest) => quest.id === questId);
  if (!def) return { ok: false, reason: 'Unknown quest.' };
  if (state.quests.claimed.includes(def.id)) return { ok: false, reason: 'You already claimed that reward.' };
  const complete = def.steps.every((step) => step.met(state));
  if (!complete) return { ok: false, reason: 'Finish every objective before claiming the reward.' };
  if (!canHoldRewards(state, def.items)) return { ok: false, reason: 'Your backpack is full.' };

  state.gp += def.gp;
  for (const [skill, amount] of Object.entries(def.xp)) grantExactXp(state, skill, amount);
  for (const item of def.items) addItem(state, item.id, item.qty);
  if (def.ward) state.quests.dragonfireWard = true;
  if (def.title) state.quests.title = def.title;
  state.quests.claimed = [...state.quests.claimed, def.id];
  return {
    ok: true,
    gp: def.gp,
    banner: `${def.name} complete`,
    chat: `Quest complete: <b>${def.name}</b>. Reward: ${def.rewardText}`
  };
}

export function noteGather(state: GameState, itemId: string): void {
  markGather(state, itemId);
}

export function noteSmelt(state: GameState): void {
  markSmelt(state);
}

export interface KillResult {
  slayerKillXp: number;
  slayerCompleted: boolean;
  bountyGp: number;
  bountyXp: number;
  remaining: number;
  taskName: string;
}

export function registerKill(state: GameState, typeKey: string): KillResult {
  const quests = state.quests;
  if (typeKey === 'goblin' || typeKey === 'goblin_archer') quests.killedGoblin = true;
  if (typeKey === 'dark_wizard' || typeKey === 'dark_ranger') quests.killedArcane = true;
  if (typeKey === 'scorpion') quests.killedScorpion = true;
  if (typeKey === 'moss_guardian') quests.killedMoss = true;
  if (typeKey === 'elvarg_dragon') quests.killedElvarg = true;

  const result: KillResult = {
    slayerKillXp: 0,
    slayerCompleted: false,
    bountyGp: 0,
    bountyXp: 0,
    remaining: quests.slayer?.remaining ?? 0,
    taskName: quests.slayer?.name ?? ''
  };
  const task = quests.slayer;
  if (!task || task.remaining <= 0 || task.monster !== typeKey) return result;

  const band = SLAYER_BANDS.find((entry) => entry.monster === task.monster);
  task.remaining -= 1;
  result.remaining = task.remaining;
  result.taskName = task.name;
  result.slayerKillXp = band?.killXp ?? 0;
  grantExactXp(state, 'attack', result.slayerKillXp);
  if (task.remaining <= 0) {
    result.slayerCompleted = true;
    result.bountyGp = band?.bountyGp ?? 0;
    result.bountyXp = band?.bountyXp ?? 0;
    state.gp += result.bountyGp;
    grantExactXp(state, 'attack', result.bountyXp);
    quests.slayerTasksCompleted += 1;
    quests.slayerStreak += 1;
  }
  return result;
}

export function pickSlayerBand(combat: number): SlayerBand | null {
  const eligible = SLAYER_BANDS.filter((band) => combat >= band.minCombat);
  if (!eligible.length) return null;
  const covering = eligible.filter((band) => combat <= band.maxCombat);
  const pool = covering.length ? covering : [eligible[eligible.length - 1]];
  return pool.reduce((best, band) => (band.minCombat > best.minCombat ? band : best));
}

export interface AssignResult {
  ok: boolean;
  reason?: string;
  task: SlayerTask | null;
}

export function assignSlayerTask(state: GameState, combat: number): AssignResult {
  const current = state.quests.slayer;
  if (current && current.remaining > 0) {
    return { ok: false, reason: 'You already have a Slayer task.', task: current };
  }
  const band = pickSlayerBand(combat);
  if (!band) return { ok: false, reason: 'Vannaka has no task for your combat level yet.', task: null };
  const task: SlayerTask = {
    monster: band.monster,
    name: band.name,
    remaining: band.count,
    total: band.count
  };
  state.quests.slayer = task;
  return { ok: true, task };
}
