import { ITEMS } from '../data/items';
import { PRAYERS } from '../data/magic';
import { weaponSpecial } from './adventure';
import { canUseStyle } from './combat';
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
  | { kind: 'talk'; npcId: string };

export interface CommandClocks {
  food: CooldownClock;
  potion: CooldownClock;
}

export interface CommandResult {
  ok: boolean;
  reason: string;
  restored?: number;
}

export function applyCommand(
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
    case 'attack':
    case 'move':
    case 'talk':
      return { ok: false, reason: 'Movement and attacks are handled by the engine.' };
  }
}
