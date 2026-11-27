import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAVES, DUNGEONS, type Zone } from '../src/data/dungeons';
import { G, camState, player } from '../src/engine/context';
import { buildCarpet } from '../src/engine/flora';
import { updateCamera } from '../src/engine/loop';
import { initParticles } from '../src/engine/particles';
import { buildSky } from '../src/engine/sky';
import { enterZone, leaveZone } from '../src/engine/zones';
import { buildWalkGrid } from '../src/state/pathfind';

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
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => true,
  children: [],
  firstChild: null
});
vi.stubGlobal('document', {
  createElement: stubEl,
  createElementNS: stubEl,
  getElementById: stubEl,
  querySelector: stubEl,
  querySelectorAll: () => []
});

vi.mock('../src/engine/textures', async (orig) => {
  const actual = await orig<typeof import('../src/engine/textures')>();
  return {
    ...actual,
    loadAlbedo: (id: string, repeat = 1.5) => {
      const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      tex.name = id;
      tex.repeat.set(repeat, repeat);
      return tex;
    }
  };
});

vi.mock('../src/engine/blenderWorld', async (orig) => {
  const actual = await orig<typeof import('../src/engine/blenderWorld')>();
  const dummyMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  const fakeGltf = {
    scene: {
      getObjectByName: () => dummyMesh
    }
  };
  return {
    ...actual,
    loadBlenderWorldTemplate: async () => fakeGltf,
    upgradeResourceNodeWithGltf: () => {},
    upgradeWorldPropWithGltf: () => {}
  };
});

vi.mock('../src/engine/blenderHero', async (orig) => {
  const actual = await orig<typeof import('../src/engine/blenderHero')>();
  return {
    ...actual,
    loadBlenderHeroTemplate: async () => ({ scene: new THREE.Scene() })
  };
});

vi.mock('../src/engine/blenderMonsters', async (orig) => {
  const actual = await orig<typeof import('../src/engine/blenderMonsters')>();
  return {
    ...actual,
    loadBlenderMonstersTemplate: async () => ({ scene: new THREE.Scene() }),
    upgradeMonsterRigWithGltf: () => {}
  };
});

// SF2: inside a zone the camera's eye stays inside the room walls (G-6.3a finding 2).
const PITCHES = [0.12, 0.3, 1.15];
const DISTANCES = [3.6, 14, 26];
const YAWS = Array.from({ length: 72 }, (_, i) => (i / 72) * Math.PI * 2);
// The eye and every point 0.45 around it (the near plane's reach) are walkable: no wall is behind or beside the lens.
const SIDE = 0.45;

function eyeOutside(def: Zone, lx: number, lz: number): string[] {
  const [ox, oz] = def.origin;
  const bad: string[] = [];
  for (const pitch of PITCHES) {
    for (const distance of DISTANCES) {
      for (const yaw of YAWS) {
        player.pos.set(ox + lx, 0, oz + lz);
        player.yaw = yaw;
        camState.manualOffset = 0;
        camState.yaw = yaw;
        camState.pitch = pitch;
        camState.distance = distance;
        camState.shake = 0;
        updateCamera({ dt: 1 } as Parameters<typeof updateCamera>[0]);
        const { x, z } = G.camera.position;
        const ok = [[0, 0], [SIDE, 0], [-SIDE, 0], [0, SIDE], [0, -SIDE]].every(([sx, sz]) => G.walkGrid.walkable(x + sx, z + sz));
        if (!ok) bad.push(`${def.id} hero (${lx}, ${lz}) pitch ${pitch} arm ${distance} yaw ${yaw.toFixed(2)}: eye (${(x - ox).toFixed(2)}, ${(z - oz).toFixed(2)})`);
      }
    }
  }
  return bad;
}

describe('SF2: zone camera', () => {
  afterEach(() => {
    if (G.zone) leaveZone();
  });

  function enter(def: Zone): void {
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 1000);
    G.terrainMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    G.groundMesh = G.terrainMesh;
    G.walkGrid = buildWalkGrid();
    G.worldInteractiveObjects = [];
    G.monstersList = [];
    G.resourceNodesList = [];
    buildSky();
    buildCarpet('balanced');
    initParticles(G.scene, 'balanced');
    enterZone(def);
  }

  it('the G-6.3a corner of the cave entry room (local 6, 28): the eye is inside the open cells at every yaw', () => {
    const cave = CAVES.find((c) => c.id === 'slagfall_cave')!;
    enter(cave);
    expect(eyeOutside(cave, 6, 28)).toEqual([]);
  });

  it('every zone, 2 in from every corner of every room: the eye is inside the open cells at every yaw', () => {
    for (const def of [...CAVES, ...DUNGEONS]) {
      enter(def);
      const bad: string[] = [];
      for (const [x0, z0, x1, z1] of Object.values(def.rooms)) {
        for (const [lx, lz] of [[x0 + 2, z0 + 2], [x1 - 2, z0 + 2], [x0 + 2, z1 - 2], [x1 - 2, z1 - 2]]) {
          if (!G.walkGrid.walkable(def.origin[0] + lx, def.origin[1] + lz)) continue;
          bad.push(...eyeOutside(def, lx, lz));
        }
      }
      expect(bad).toEqual([]);
      leaveZone();
    }
  });

  it('in open ground far from a wall the arm is not shortened', () => {
    const cave = CAVES.find((c) => c.id === 'slagfall_cave')!;
    enter(cave);
    const [ox, oz] = cave.origin;
    player.pos.set(ox + 67, 0, oz + 37); // the back hall, 11 to 13 from every wall, clear of the pillars
    player.yaw = 0;
    camState.manualOffset = 0;
    camState.yaw = 0;
    camState.pitch = 0.3;
    camState.distance = 8;
    updateCamera({ dt: 1 } as Parameters<typeof updateCamera>[0]);
    expect(oz + 37 - G.camera.position.z).toBeCloseTo(Math.cos(0.3) * 8, 5);
  });
});
