import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MONSTER_TYPES } from '../src/data/world';
import { performMonsterRetaliation } from '../src/engine/actions';
import { G, player, type MonsterEntity, type ResourceNodeEntity } from '../src/engine/context';
import { STATE } from '../src/state/gameState';
import { createMonsterLogic } from '../src/state/monsterAi';

// CALL-6.29 (b), owner 2026-11-14 (plan table 0.5, written by G1 before G2): a monster attack that lands on a
// gathering hero ends the gather, so Stage 4's auto-retaliation answers it. Red until G2.

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), innerWidth: 800, innerHeight: 600 });
const stubEl = (): Record<string, unknown> => ({
  classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
  style: {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  appendChild() {},
  removeChild() {},
  remove() {},
  setAttribute() {},
  children: [],
  firstChild: null
});
vi.stubGlobal('document', { createElement: stubEl, getElementById: stubEl, querySelector: stubEl, querySelectorAll: () => [] });

// The hero's mesh is not built here; the hit's flash is a look, not the rule under test.
vi.mock('../src/engine/reactions', async (orig) => {
  const actual = await orig<typeof import('../src/engine/reactions')>();
  return { ...actual, flash: () => {} };
});
vi.mock('../src/state/combat', async (orig) => {
  const actual = await orig<typeof import('../src/state/combat')>();
  return { ...actual, rollMonsterHit: () => ({ dmg: 2, dragonfire: false, absorbed: false }) };
});

function goblin(): MonsterEntity {
  const group = new THREE.Group();
  group.position.set(1.5, 0, 0);
  const m = {
    id: 'g1',
    typeKey: 'goblin',
    def: MONSTER_TYPES.goblin,
    rig: { group, hitbox: new THREE.Mesh() },
    logic: createMonsterLogic('goblin', 1.5, 0),
    pos: group.position,
    labelEl: stubEl(),
    flinch: 0,
    attackAnim: 0
  } as unknown as MonsterEntity;
  m.logic.state = 'attack';
  return m;
}

/** Read through a function, so the assignment above each hit does not narrow its type. */
const targetType = (): string | undefined => player.targetEntity?.type;

const tree = { pos: new THREE.Vector3(0, 0, 3), depleted: false } as unknown as ResourceNodeEntity;

describe('CALL-6.29 (b): a hit stops the gather', () => {
  beforeEach(() => {
    G.monstersList.length = 0;
    G.camera = new THREE.PerspectiveCamera();
    for (const k of Object.keys(G.keysPressed)) G.keysPressed[k] = false;
    player.pos = new THREE.Vector3(0, 0, 0);
    player.isMoving = false;
    player.waypoints = [];
    player.downed = false;
    STATE.hp = 50;
  });

  it('an idle hero hit once fights back (Stage 4)', () => {
    const m = goblin();
    G.monstersList.push(m);
    player.targetEntity = null;
    performMonsterRetaliation(m);
    expect(STATE.hp).toBe(48);
    expect(targetType()).toBe('monster');
  });

  it('a gathering hero hit once is no longer gathering, and fights back', () => {
    const m = goblin();
    G.monstersList.push(m);
    player.targetEntity = { type: 'resource', ref: tree };
    performMonsterRetaliation(m);
    expect(STATE.hp).toBe(48);
    expect(targetType(), 'the gather has ended').not.toBe('resource');
    expect(targetType(), "Stage 4's auto-retaliation answers the hit").toBe('monster');
  });
});
