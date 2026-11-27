import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAVES, DUNGEONS } from '../src/data/dungeons';
import { G, player } from '../src/engine/context';
import { buildCarpet, getCarpetMeshes } from '../src/engine/flora';
import { getWeatherEmitters, initParticles, updateParticles } from '../src/engine/particles';
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

describe('SF1: zone air (carpet and weather emitters hidden inside zones)', () => {
  beforeEach(() => {
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera();
    G.terrainMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    G.groundMesh = G.terrainMesh;
    G.walkGrid = buildWalkGrid();
    G.worldInteractiveObjects = [];
    G.monstersList = [];
    G.resourceNodesList = [];
    player.pos.set(0, 0, 0);

    buildSky();
    buildCarpet('balanced');
    initParticles(G.scene, 'balanced');
  });

  it('dungeon: after enterZone the carpet and every weather emitter are not visible; after leaveZone they are as before', () => {
    const carpet = getCarpetMeshes();
    const emitters = getWeatherEmitters();
    expect(carpet.length).toBeGreaterThan(0);
    expect(emitters.length).toBeGreaterThan(0);
    expect(carpet.every((m) => m.visible)).toBe(true);
    expect(emitters.every((m) => m.visible)).toBe(true);

    const dungeon = DUNGEONS[0];
    enterZone(dungeon);

    expect(G.zone).not.toBeNull();
    expect(carpet.every((m) => !m.visible)).toBe(true);
    expect(emitters.every((m) => !m.visible)).toBe(true);

    // Frame updates while in zone do not restore particle visibility
    updateParticles(0.016, G.camera);
    expect(emitters.every((m) => !m.visible)).toBe(true);

    leaveZone();

    expect(G.zone).toBeNull();
    expect(carpet.every((m) => m.visible)).toBe(true);
    expect(emitters.every((m) => m.visible)).toBe(true);
  });

  it('cave: after enterZone the carpet and every weather emitter are not visible; after leaveZone they are as before', () => {
    const carpet = getCarpetMeshes();
    const emitters = getWeatherEmitters();
    expect(carpet.length).toBeGreaterThan(0);
    expect(emitters.length).toBeGreaterThan(0);
    expect(carpet.every((m) => m.visible)).toBe(true);
    expect(emitters.every((m) => m.visible)).toBe(true);

    const cave = CAVES[0];
    enterZone(cave);

    expect(G.zone).not.toBeNull();
    expect(carpet.every((m) => !m.visible)).toBe(true);
    expect(emitters.every((m) => !m.visible)).toBe(true);

    leaveZone();

    expect(G.zone).toBeNull();
    expect(carpet.every((m) => m.visible)).toBe(true);
    expect(emitters.every((m) => m.visible)).toBe(true);

    // Second entry (cached cave session state) also hides carpet and emitters
    enterZone(cave);
    expect(G.zone).not.toBeNull();
    expect(carpet.every((m) => !m.visible)).toBe(true);
    expect(emitters.every((m) => !m.visible)).toBe(true);

    leaveZone();
    expect(G.zone).toBeNull();
    expect(carpet.every((m) => m.visible)).toBe(true);
    expect(emitters.every((m) => m.visible)).toBe(true);
  });
});
