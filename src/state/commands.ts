import { ITEMS } from '../data/items';
import { PRAYERS } from '../data/magic';
import { DUNGEONS } from '../data/dungeons';
import { weaponSpecial } from './adventure';
import { canUseStyle } from './combat';
import { openDialogue, chooseOption, type DialogueView, type DialogueEvent } from './dialogue';
import { canEnter, openChest, type DungeonRun } from './dungeon';
import { STORY_QUESTS } from '../data/story';
import type { Cond } from './dialogue';
import { useEmber } from './story';
import { notePrayerOffered } from './quests';
import { type CooldownClock, drink, eat } from './sustain';
import type { GameState } from './types';

export type PlayerCommand =
  | { kind: 'attack'; targetId: string }
  | { kind: 'move'; x: number; z: number }
  | { kind: 'eat'; slot: number }
  | { kind: 'drink'; slot: number }
  | { kind: 'prayer'; id: string }
  | { kind: 'style'; style: string }
  | { kind: 'special' }
  | { kind: 'talk'; npcId: string }
  | { kind: 'choose'; npcId: string; nodeId: string; index: number }
  | { kind: 'useEmber'; itemId: string; skillKey: string }
  | { kind: 'enterDungeon'; dungeonId: string }
  | { kind: 'leaveDungeon' }
  | { kind: 'openChest' };

export interface CommandClocks {
  food: CooldownClock;
  potion: CooldownClock;
}

export interface CommandResult {
  ok: boolean;
  reason: string;
  restored?: number;
  view?: DialogueView | null;
  events?: DialogueEvent[];
}

export type CommandListener = (cmd: PlayerCommand, res: CommandResult) => void;
const commandListeners: CommandListener[] = [];

export function addCommandListener(fn: CommandListener): void {
  commandListeners.push(fn);
}

export function applyCommand(
  state: GameState,
  cmd: PlayerCommand,
  clocks: CommandClocks,
  now: number
): CommandResult {
  const result = executeCommand(state, cmd, clocks, now);
  for (const listener of commandListeners) {
    listener(cmd, result);
  }
  return result;
}

function executeCommand(
  state: GameState,
  cmd: PlayerCommand,
  clocks: CommandClocks,
  now: number
): CommandResult {
  switch (cmd.kind) {
    case 'eat':
      return eat(state, cmd.slot, clocks.food, now);
    case 'drink':
      return drink(state, cmd.slot, clocks.potion, now);
    case 'prayer': {
      const p = PRAYERS.find((x) => x.id === cmd.id);
      if (!p) {
        return { ok: false, reason: 'Unknown prayer.' };
      }
      if (state.activePrayers.has(cmd.id)) {
        state.activePrayers.delete(cmd.id);
        return { ok: true, reason: '' };
      }
      if (state.skills.prayer.lvl < p.req) {
        return {
          ok: false,
          reason: `You need <b>Prayer Level ${p.req}</b> to activate ${p.name}.`
        };
      }
      if (state.prayerPts <= 0) {
        return {
          ok: false,
          reason: 'You have no Prayer points left! Recharge at any Sacred Altar.'
        };
      }
      if (p.overhead) {
        PRAYERS.filter((o) => o.overhead && o.id !== cmd.id).forEach((o) =>
          state.activePrayers.delete(o.id)
        );
      }
      state.activePrayers.add(cmd.id);
      notePrayerOffered(state);
      return { ok: true, reason: '' };
    }
    case 'style': {
      const weapon = state.equipment.weapon ? ITEMS[state.equipment.weapon] || null : null;
      const check = canUseStyle(cmd.style, weapon, state);
      if (!check.ok) {
        return { ok: false, reason: check.reason };
      }
      state.combatStyle = cmd.style;
      return { ok: true, reason: '' };
    }
    case 'special': {
      const spec = weaponSpecial(state.equipment.weapon);
      if (state.specEnergy < spec.cost && !state.specArmed) {
        return {
          ok: false,
          reason: `You need at least ${spec.cost}% Special Attack energy for <b>${spec.name}</b>!`
        };
      }
      state.specArmed = !state.specArmed;
      return { ok: true, reason: '' };
    }
    case 'talk': {
      const view = openDialogue(state, cmd.npcId);
      if (!view) {
        return { ok: false, reason: 'Unknown person.' };
      }
      return { ok: true, reason: '', view };
    }
    case 'choose': {
      const res = chooseOption(state, cmd.npcId, cmd.nodeId, cmd.index);
      if (!res.ok && res.reason === undefined) throw new Error('chooseOption refused without a reason');
      return {
        ok: res.ok,
        reason: res.reason ?? '',
        view: res.view,
        events: res.events
      };
    }
    case 'useEmber': {
      const res = useEmber(state, cmd.itemId, cmd.skillKey);
      return {
        ok: res.ok,
        reason: res.ok ? '' : res.reason
      };
    }
    case 'enterDungeon': {
      const def = DUNGEONS.find((d) => d.id === cmd.dungeonId);
      if (!def) {
        return { ok: false, reason: 'Unknown dungeon.' };
      }
      if (!canEnter(state, def)) {
        return { ok: false, reason: `${def.name} needs ${describeNeeds(def.needs)}.` };
      }
      return { ok: true, reason: '' };
    }
    case 'leaveDungeon':
      return { ok: true, reason: '' };
    case 'openChest':
      return { ok: false, reason: 'The chest opens through applyOpenChest.' };
    case 'attack':
    case 'move':
      return { ok: false, reason: 'Movement and attacks are handled by the engine.' };
    default:
      return { ok: false, reason: `Unknown command kind: ${(cmd as { kind: string }).kind}` };
  }
}

/** The openChest applier: the run and the random source are both required, the dispatcher supplies them. */
export function applyOpenChest(
  state: GameState,
  run: DungeonRun,
  rand: () => number,
  now: number
): CommandResult {
  const def = DUNGEONS.find((d) => d.id === run.id)!;
  const res = openChest(state, def, run, rand, now);
  return { ok: res.ok, reason: res.reason ?? '' };
}

const questName = (id: string): string => STORY_QUESTS.find((q) => q.id === id)!.name;

/** A dungeon's `needs` as a sentence fragment; a condition kind a door does not use throws. */
export function describeNeeds(c: Cond): string {
  if ('all' in c) return c.all.map(describeNeeds).join(', ');
  if ('any' in c) return c.any.map(describeNeeds).join(' or ');
  if ('combat' in c) return `Combat ${c.combat}`;
  if ('stage' in c) return `${questName(c.stage[0])} (stage ${c.stage[1]})`;
  if ('quest' in c) return `${questName(c.quest[0])} (${c.quest[1]})`;
  throw new Error(`describeNeeds: unsupported condition ${JSON.stringify(c)}`);
}
