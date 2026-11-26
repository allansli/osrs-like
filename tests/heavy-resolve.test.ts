import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { G, player, type MonsterEntity } from '../src/engine/context';
import { updateMonsters, type FrameState } from '../src/engine/loop';
import { createMonsterLogic, type MonsterEvent } from '../src/state/monsterAi';
import { MONSTER_TYPES } from '../src/data/world';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
vi.stubGlobal('document', {
  createElement: () => ({
    querySelector: () => ({ style: {} }),
    style: {}
  }),
  getElementById: () => ({
    classList: { contains: () => false, add() {}, remove() {} },
    style: {}
  })
});

let mockEvents: MonsterEvent[] = [];
vi.mock('../src/state/monsterAi', async (orig) => {
  const actual = await orig<typeof import('../src/state/monsterAi')>();
  return {
    ...actual,
    stepMonster: () => mockEvents
  };
});

describe('RF2: dodged heavy resolve releases attackAnim', () => {
  beforeEach(() => {
    mockEvents = [];
    G.monstersList.length = 0;
    player.pos = new THREE.Vector3(0, 0, 0);
  });

  it('after a resolve with hit: false, the monster attackAnim is 1 and a cancel leaves it 0', () => {
    const group = new THREE.Group();
    const hitbox = new THREE.Mesh();
    group.add(hitbox);
    const m = {
      typeKey: 'goblin',
      def: MONSTER_TYPES.goblin,
      rig: { group, hitbox },
      logic: createMonsterLogic('goblin', 0, 0),
      pos: group.position,
      labelEl: { querySelector: () => ({ style: {} }), style: {} },
      flinch: 0,
      attackAnim: 0
    } as unknown as MonsterEntity;
    G.monstersList.push(m);

    // 1. Resolve with hit: false sets attackAnim to 1
    mockEvents = [{ kind: 'resolve', attackId: 'ember_cone', hit: false }];
    m.attackAnim = 0;
    updateMonsters({ now: 1000, dt: 0 } as unknown as FrameState);
    expect(m.attackAnim).toBe(1);

    // 2. Cancel leaves attackAnim at 0
    mockEvents = [{ kind: 'cancel' }];
    m.attackAnim = 0;
    updateMonsters({ now: 1016, dt: 0 } as unknown as FrameState);
    expect(m.attackAnim).toBe(0);
  });
});
