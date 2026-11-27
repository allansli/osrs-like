import { BOSSES } from '../data/attacks';
import { DUNGEONS, type Dungeon } from '../data/dungeons';
import type { CampDef } from '../data/worldMap';
import { evalCond, type Cond } from './dialogue';
import { creditGp } from './economy';
import { addItem, canAddItem } from './inventory';
import { bump } from './progress';
import type { GameState, SavedPose } from './types';

export type { Dungeon };

export type DungeonRun = {
  id: string;
  startedAt: number;
  deadCamps: string[];
  bossDead: boolean;
  chestOpen: boolean;
  roll?: { id: string; qty: number }[];
};

export function zoneWalk(
  def: {
    origin: [number, number];
    size: number;
    rooms: Record<string, [number, number, number, number]>;
    gates?: { id: string; rect: [number, number, number, number] }[];
    solid?: [number, number, number, number][];
  },
  openGates: string[] = []
): (x: number, z: number) => boolean {
  const [ox, oz] = def.origin;
  const roomRects = Object.values(def.rooms);
  const shutGates = (def.gates ?? []).filter((g) => !openGates.includes(g.id));
  const solids = def.solid ?? [];

  return (wx: number, wz: number): boolean => {
    const lx = wx - ox;
    const lz = wz - oz;
    if (lx < 0 || lx > def.size || lz < 0 || lz > def.size) return false;
    for (const [sx0, sz0, sx1, sz1] of solids) {
      if (lx >= sx0 && lx <= sx1 && lz >= sz0 && lz <= sz1) return false;
    }
    for (const gate of shutGates) {
      const [gx0, gz0, gx1, gz1] = gate.rect;
      if (lx >= gx0 && lx <= gx1 && lz >= gz0 && lz <= gz1) return false;
    }
    for (const [rx0, rz0, rx1, rz1] of roomRects) {
      if (lx >= rx0 && lx <= rx1 && lz >= rz0 && lz <= rz1) return true;
    }
    return false;
  };
}

export function zoneSafe(
  def: { origin: [number, number]; entry: [number, number] },
  x: number,
  z: number
): boolean {
  const ex = def.origin[0] + def.entry[0];
  const ez = def.origin[1] + def.entry[1];
  return Math.hypot(x - ex, z - ez) <= 6;
}

export function canEnter(state: GameState, def: { needs: Cond }): boolean {
  return evalCond(state, def.needs);
}

export function savedPose(
  pose: SavedPose | null,
  zone: { door: { x: number; z: number } } | null
): SavedPose | null {
  if (!zone || !pose) return pose;
  return { x: zone.door.x, y: pose.y, z: zone.door.z, yaw: pose.yaw };
}

export function zoneCamps(def: Dungeon): CampDef[] {
  const [ox, oz] = def.origin;
  return def.camps.map((c) => {
    const worldMembers = c.members.map((m) => ({
      type: m.type,
      x: ox + m.x,
      z: oz + m.z,
      wander: m.wander
    }));
    const count = worldMembers.length;
    const cx = worldMembers.reduce((s, m) => s + m.x, 0) / count;
    const cz = worldMembers.reduce((s, m) => s + m.z, 0) / count;
    const maxDist = Math.max(...worldMembers.map((m) => Math.hypot(m.x - cx, m.z - cz)));
    return {
      id: `${def.id}:${c.id}`,
      x: cx,
      z: cz,
      radius: Math.ceil(maxDist + 4.5),
      aggressive: true,
      aggroRadius: c.aggro,
      arenaRadius: c.arenaRadius,
      keepsSight: true,
      members: worldMembers
    };
  });
}

export function runStep(run: DungeonRun, event: { campDead: string }): string[] {
  const def = DUNGEONS.find((d) => d.id === run.id);
  if (!def) throw new Error(`runStep: unknown dungeon id "${run.id}"`);
  const alreadyDead = run.deadCamps.includes(event.campDead);
  if (!alreadyDead) {
    run.deadCamps.push(event.campDead);
  }
  const bossCamp = def.camps.find((c) => c.members.some((m) => BOSSES[m.type]));
  if (bossCamp && bossCamp.id === event.campDead) {
    run.bossDead = true;
  }
  if (alreadyDead) return [];
  const opened: string[] = [];
  for (const gate of def.gates) {
    if (gate.opensWhen.includes(event.campDead)) {
      if (gate.opensWhen.every((cId) => run.deadCamps.includes(cId))) {
        opened.push(gate.id);
      }
    }
  }
  return opened;
}

export function openChest(
  state: GameState,
  def: Dungeon,
  run: DungeonRun,
  rand: () => number,
  now: number
): { ok: boolean; reason?: string } {
  if (!run.bossDead) {
    return { ok: false, reason: 'The boss is still alive.' };
  }
  if (run.chestOpen) {
    return { ok: false, reason: 'The chest has already been opened.' };
  }
  if (!run.roll) {
    const rolled: { id: string; qty: number }[] = [];
    for (const item of def.loot.run) {
      const min = item.qty[0];
      const max = item.qty[1];
      const qty = min + Math.floor(rand() * (max - min + 1));
      rolled.push({ id: item.id, qty });
    }
    for (const rare of def.loot.rare) {
      if (rand() < rare.chance) {
        rolled.push({ id: rare.id, qty: rare.qty });
      }
    }
    run.roll = rolled;
  }

  const rehearsal: GameState = {
    ...state,
    inventory: state.inventory.map((slot) => ({ ...slot }))
  };
  for (const item of run.roll) {
    if (!canAddItem(rehearsal, item.id, item.qty)) {
      return { ok: false, reason: 'Backpack is full.' };
    }
    addItem(rehearsal, item.id, item.qty);
  }

  for (const item of run.roll) {
    addItem(state, item.id, item.qty);
  }
  const minGp = def.loot.runGp[0];
  const maxGp = def.loot.runGp[1];
  const gp = minGp + Math.floor(rand() * (maxGp - minGp + 1));
  creditGp(state, gp);

  run.chestOpen = true;
  bump(state, `clear:${def.id}`);

  const progress = state.progress!; // bump above created it
  const dungeons = (progress.dungeons ??= {});
  const existing = dungeons[def.id];
  const elapsedSecs = Math.floor((now - run.startedAt) / 1000);
  const best = existing ? Math.min(existing.best, elapsedSecs) : elapsedSecs;
  const clears = (existing?.clears ?? 0) + 1;
  dungeons[def.id] = { clears, best };

  return { ok: true };
}
