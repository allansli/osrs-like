import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { G } from '../src/engine/context';
import { buildHumanoidRig } from '../src/engine/humanoid';
import { getTerrainHeight } from '../src/state/terrain';
import { createSlayerMaster } from '../src/engine/worldBuild';
import { upgradeHumanoidRigWithGltf } from '../src/engine/blenderHero';
import { mountLoadout, type MountedRig } from '../src/engine/playerMesh';
import { ITEMS, type ItemDef } from '../src/data/items';

const { requested, pending } = vi.hoisted(() => ({ requested: [] as string[], pending: [] as Promise<unknown>[] }));
vi.mock('../src/engine/gltf', async () => {
  const fsm = await import('node:fs');
  const pathm = await import('node:path');
  const { GLTFLoader: Loader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  return {
    loadGltfOnce(url: string): Promise<GLTF | null> {
      requested.push(url);
      const file = pathm.resolve(__dirname, '../public', url.replace(/^\//, '').split('?')[0]);
      const p = fsm.existsSync(file)
        ? (() => {
            const buf = fsm.readFileSync(file);
            const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            return new Promise<GLTF | null>((resolve, reject) => new Loader().parse(ab as ArrayBuffer, '', resolve, reject));
          })()
        : Promise.resolve(null);
      pending.push(p);
      return p;
    }
  };
});

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
vi.stubGlobal('document', { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_: string) {} }) });

const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await Promise.all(pending);
    await new Promise((r) => setTimeout(r, 0));
  }
};

let heroGltf: GLTF;

beforeAll(async () => {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public/models/hero.glb'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  heroGltf = await new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
});

beforeEach(async () => {
  requested.length = 0;
  pending.length = 0;
  G.scene = new THREE.Scene();
  G.worldInteractiveObjects.length = 0;
  G.npcList.length = 0;
  G.npcAnimatorsList.length = 0;
});

describe('RF5: Vannaka gear alignment on the skinned hero', () => {
  it('after the upgrade, the sword and cape sit within 1 cm of where the same items sit on the player with the same loadout', async () => {
    const spotX = 10;
    const spotZ = 20;
    createSlayerMaster(spotX, spotZ);
    await settle();
    G.scene.updateMatrixWorld(true);

    const vannakaHitbox = G.worldInteractiveObjects.find((o) => o.userData.name === 'Slayer Master Vannaka')!;
    expect(vannakaHitbox).toBeDefined();
    const vannakaGroup = vannakaHitbox.parent!;

    // Player with the exact same loadout, position and upgrade
    const playerRig = buildHumanoidRig(0x4c1d95, 0x1c1917, 0x111827, 1.05);
    playerRig.group.position.set(spotX, getTerrainHeight(spotX, spotZ), spotZ);
    upgradeHumanoidRigWithGltf(playerRig, heroGltf, 0x4c1d95, 0x1c1917, 0x111827, { isPlayer: false });
    const wepItem = (ITEMS.godsword || ITEMS.rune_2h || { id: 'godsword', iconKind: 'greatsword', slot: 'weapon', color: 0xfacc15, trim: 0xfde047 }) as unknown as ItemDef;
    const capeItem = { id: 'slayer_cape', slot: 'cape', color: 0x4c1d95, trim: 0xfacc15 } as unknown as ItemDef;
    const mounted: MountedRig = playerRig;
    mountLoadout(mounted, { weapon: wepItem, cape: capeItem });
    G.scene.add(playerRig.group);
    G.scene.updateMatrixWorld(true);

    // Find sword on Vannaka and player
    const findSword = (root: THREE.Object3D) => {
      let found: THREE.Object3D | null = null;
      root.traverse((o) => {
        if (!found && o.name.toLowerCase().includes('sword') || (o.parent?.name === 'RightElbowPivot' || o.parent?.name === 'RightArmPivot') && o !== o.parent.children[0]) {
          found = o;
        }
      });
      return found ?? (root.getObjectByName('RightElbowPivot')?.children.find((c) => c.type === 'Group') ?? null);
    };

    // Find cape on Vannaka and player
    const findCape = (root: THREE.Object3D) => {
      const torso = root.getObjectByName('Torso') || root.getObjectByName('rig.torso');
      return torso?.children.find((c) => c.name.includes('cape') || c.type === 'Group') ?? null;
    };

    const vSword = findSword(vannakaGroup)!;
    const pSword = mounted.wepMesh || findSword(playerRig.group)!;
    expect(vSword).toBeDefined();
    expect(pSword).toBeDefined();

    const vSwordWorld = new THREE.Vector3();
    const pSwordWorld = new THREE.Vector3();
    vSword.getWorldPosition(vSwordWorld);
    pSword.getWorldPosition(pSwordWorld);
    expect(vSwordWorld.distanceTo(pSwordWorld)).toBeLessThan(0.01);

    const vCape = findCape(vannakaGroup)!;
    const pCape = mounted.capeMesh || findCape(playerRig.group)!;
    expect(vCape).toBeDefined();
    expect(pCape).toBeDefined();

    const vCapeWorld = new THREE.Vector3();
    const pCapeWorld = new THREE.Vector3();
    vCape.getWorldPosition(vCapeWorld);
    pCape.getWorldPosition(pCapeWorld);
    expect(vCapeWorld.distanceTo(pCapeWorld)).toBeLessThan(0.01);
  });
});
