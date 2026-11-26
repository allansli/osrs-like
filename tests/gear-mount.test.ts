// H1 (models pass): the mount contract of the hero, written before anything changes (design 6.1.4, 8.3).
// Everything is measured in the FIGURE's space (the rig group's local space) at the REFERENCE POSE:
// every pivot or bone at identity rotation and at its rest position, which removes the frame of `Idle`
// that the shipped file carries (shoulders read 1.465 and hips 0.865 there). The fixture
// `tests/fixtures/hero-mounts.json` was written from TODAY's hero by `writeFixture` below:
//   HERO_MOUNTS_WRITE=1 npx vitest run tests/gear-mount.test.ts
// It must pass on today's hero and, unchanged, on the skinned hero (the joints move, the mesh does not).
// Nothing here reads a mesh by its node name: hide checks go by the engine's hide rules (Hair*, TorsoCoat and
// InnerCollar) and the hand, foot and head centres by `extras.part`, so a role-joined mesh plan passes too.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ITEMS } from '../src/data/items';
import { STATE } from '../src/state/gameState';
import { player } from '../src/engine/context';
import { buildHumanoidRig, type HumanoidRig } from '../src/engine/humanoid';
import { upgradeHumanoidRigWithGltf } from '../src/engine/blenderHero';
import { setBlenderGearRoot } from '../src/engine/blenderGear';
import { rebuildPlayerEquipmentMeshes } from '../src/engine/playerMesh';

const FIXTURE = path.resolve(__dirname, 'fixtures/hero-mounts.json');
const WRITE = process.env.HERO_MOUNTS_WRITE === '1';

// Both branches of the shield offsets (defender / kite) and of the cape offsets (ava / other) are pinned.
const LOADOUTS: Record<string, Record<string, string>> = {
  defenderAva: {
    weapon: 'rune_scimitar', shield: 'dragon_defender', head: 'neitiznot_helm', body: 'bandos_chest',
    legs: 'bandos_tassets', neck: 'amulet_torture', ring: 'berserker_ring', feet: 'primordial_boots',
    hands: 'barrows_gloves', cape: 'ava_accumulator'
  },
  kiteCape: {
    weapon: 'twisted_bow', shield: 'rune_shield', head: 'dragon_helm', body: 'torva_body',
    legs: 'torva_legs', neck: 'amulet_fury', ring: 'berserker_ring', feet: 'rune_boots',
    hands: 'rune_gloves', cape: 'fire_cape'
  },
  // A robe top is the only body item whose gear.glb nodes carry arm pieces, so bodyArmL and bodyArmR
  // (mounted on the arm pivots, the joint that moves most) are pinned here.
  robeStaff: {
    weapon: 'fire_staff', head: 'wizard_hat', body: 'wizard_top', legs: 'wizard_bottom',
    neck: 'amulet_glory', feet: 'wizard_boots', hands: 'wizard_gloves'
  }
};

const PIECE_KEYS = [
  'wepMesh', 'shieldMesh', 'helmMesh', 'capeMesh', 'amuletMesh', 'ringMesh',
  'bodyArmorMesh', 'bodyArmL', 'bodyArmR', 'legsArmorMesh', 'legsArmorL', 'legsArmorR',
  'feetMeshL', 'feetMeshR', 'handsMeshL', 'handsMeshR', 'setBonusCue'
] as const;
// Fixture key -> the `extras.part` that carries it and the sign of its x side (0 = the whole part).
const CENTRES: Record<string, [string, number]> = {
  Hand_L: ['hand', -1], Hand_R: ['hand', 1], Boot_L: ['boot', -1], Boot_R: ['boot', 1], Head: ['head', 0]
};
const CENTRE_NAMES = Object.keys(CENTRES);
const isHairName = (n: string) => n.startsWith('Hair');
const isCoatName = (n: string) => n === 'TorsoCoat' || n === 'InnerCollar';

// The builder's rest values (scripts/blender/build_hero.py `create_empty_pivot` calls), parent-relative.
const REST: Record<string, [number, number, number]> = {
  Torso: [0, 1.24, 0],
  HeadGroup: [0, 1.86, 0],
  LeftArmPivot: [-0.28, 1.5, 0],
  RightArmPivot: [0.28, 1.5, 0],
  LeftElbowPivot: [0, -0.26, 0],
  RightElbowPivot: [0, -0.26, 0],
  LeftLegPivot: [-0.11, 0.9, 0],
  RightLegPivot: [0.11, 0.9, 0],
  LeftKneePivot: [0, -0.38, 0],
  RightKneePivot: [0, -0.38, 0]
};

function parseGlb(rel: string): Promise<GLTF> {
  const buf = fs.readFileSync(path.resolve(__dirname, rel));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
}

/** Reference pose: identity rotations; rest positions (pivots) or the bind pose (bones). */
function referencePose(rig: HumanoidRig): void {
  let skinned = false;
  rig.group.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) {
      skinned = true;
      sm.skeleton.pose();
    }
  });
  for (const [name, p] of Object.entries(REST)) {
    const node = rig.group.getObjectByName(name);
    expect(node, `reference-pose node ${name}`).toBeTruthy();
    node!.quaternion.identity();
    if (!skinned) node!.position.set(...p);
  }
  rig.group.updateMatrixWorld(true);
}

/** `node`'s transform in the figure's space. */
function inFigure(rig: HumanoidRig, node: THREE.Object3D) {
  rig.group.updateMatrixWorld(true);
  const m = new THREE.Matrix4().copy(rig.group.matrixWorld).invert().multiply(node.matrixWorld);
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  m.decompose(p, q, s);
  return { p, q, s };
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

async function dressed(loadout: Record<string, string>, heroGltf: GLTF): Promise<HumanoidRig> {
  const rig = buildHumanoidRig();
  expect(upgradeHumanoidRigWithGltf(rig, heroGltf)).not.toBeNull();
  player.meshGroup = rig.group;
  player.parts = rig;
  Object.assign(STATE.equipment, { head: null, cape: null, neck: null, weapon: null, body: null, shield: null, legs: null, hands: null, feet: null, ring: null }, loadout);
  referencePose(rig);
  rebuildPlayerEquipmentMeshes();
  referencePose(rig);
  return rig;
}

function snapshot(rig: HumanoidRig) {
  const pieces: Record<string, { p: number[]; q: number[]; s: number[] }> = {};
  for (const key of PIECE_KEYS) {
    const node = (rig as unknown as Record<string, THREE.Object3D | null>)[key];
    if (!node) continue;
    const t = inFigure(rig, node);
    pieces[key] = { p: t.p.toArray().map(r6), q: t.q.toArray().map(r6), s: t.s.toArray().map(r6) };
  }
  const hidden: string[] = [];
  rig.group.traverse((o) => {
    if (!o.visible && o.name) hidden.push(o.name); // unnamed nodes are outline shells, not figure parts
  });
  return { pieces, hidden: hidden.sort() };
}

/** Centre of the bounding box of the posed vertices of every mesh whose `extras.part` is `part`, per x side. */
function centres(rig: HumanoidRig): Record<string, number[]> {
  rig.group.updateMatrixWorld(true);
  const toFigure = new THREE.Matrix4().copy(rig.group.matrixWorld).invert();
  const out: Record<string, number[]> = {};
  for (const [key, [part, side]] of Object.entries(CENTRES)) {
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    rig.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData?.part !== part) return;
      const toFig = new THREE.Matrix4().multiplyMatrices(toFigure, m.matrixWorld);
      const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i++) {
        m.getVertexPosition(i, v).applyMatrix4(toFig); // skinned meshes are posed here
        if (side === 0 || Math.sign(v.x) === side) box.expandByPoint(v);
      }
    });
    expect(box.isEmpty(), `vertices of part ${part} on side ${side}`).toBe(false);
    out[key] = box.getCenter(new THREE.Vector3()).toArray().map(r6);
  }
  return out;
}

let heroGltf: GLTF;
let fixture: { loadouts: Record<string, { equipment: Record<string, string>; pieces: Record<string, { p: number[]; q: number[]; s: number[] }>; hidden: string[] }>; centres: Record<string, number[]> };
const savedEquipment = { ...STATE.equipment };

beforeAll(async () => {
  heroGltf = await parseGlb('../public/models/hero.glb');
  setBlenderGearRoot((await parseGlb('../public/models/gear.glb')).scene);
  if (WRITE) {
    const out: typeof fixture = { loadouts: {}, centres: {} };
    for (const [name, equipment] of Object.entries(LOADOUTS)) {
      const rig = await dressed(equipment, heroGltf);
      out.loadouts[name] = { equipment, ...snapshot(rig) };
      if (name === 'defenderAva') out.centres = centres(rig);
    }
    fs.writeFileSync(FIXTURE, JSON.stringify(out, null, 1) + '\n');
  }
  fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
});

afterAll(() => {
  setBlenderGearRoot(null);
  Object.assign(STATE.equipment, savedEquipment);
});

describe('gear mount contract at the reference pose', () => {
  for (const name of Object.keys(LOADOUTS)) {
    it(`${name}: every mounted piece's transform in the figure's space equals the fixture (0.01, 0.02 rad)`, async () => {
      const want = fixture.loadouts[name];
      expect(want.equipment).toEqual(LOADOUTS[name]);
      for (const item of Object.values(want.equipment)) expect(ITEMS[item], item).toBeDefined();
      const rig = await dressed(LOADOUTS[name], heroGltf);
      const got = snapshot(rig);
      expect(Object.keys(got.pieces).sort()).toEqual(Object.keys(want.pieces).sort());
      if (name !== 'robeStaff') expect(Object.keys(want.pieces).length).toBeGreaterThanOrEqual(15);
      else for (const k of ['bodyArmL', 'bodyArmR']) expect(want.pieces[k], `${k} is pinned`).toBeDefined();
      for (const [key, w] of Object.entries(want.pieces)) {
        const g = got.pieces[key];
        expect(new THREE.Vector3(...g.p).distanceTo(new THREE.Vector3(...w.p)), `${key} position`).toBeLessThanOrEqual(0.01);
        expect(new THREE.Quaternion(...(g.q as [number, number, number, number])).angleTo(new THREE.Quaternion(...(w.q as [number, number, number, number]))), `${key} rotation`).toBeLessThanOrEqual(0.02);
        expect(new THREE.Vector3(...g.s).distanceTo(new THREE.Vector3(...w.s)), `${key} scale`).toBeLessThanOrEqual(0.01);
      }
      // Hidden meshes go by the engine's hide rules: whatever the fixture hid of the Hair* and
      // TorsoCoat/InnerCollar families is hidden in full (every mesh of the family the figure has), and nothing else is hidden.
      const present: string[] = [];
      rig.group.traverse((o) => {
        if (o.name) present.push(o.name);
      });
      const ruled = (n: string) => isHairName(n) || isCoatName(n);
      const expectHidden = [
        ...(want.hidden.some(isHairName) ? present.filter(isHairName) : []),
        ...(want.hidden.some(isCoatName) ? present.filter(isCoatName) : [])
      ];
      expect(want.hidden.some(ruled), 'the fixture hides a ruled family').toBe(true);
      expect(got.hidden.filter(ruled).sort(), 'hidden by the hide rules').toEqual([...new Set(expectHidden)].sort());
      expect(got.hidden.filter((n) => !ruled(n)), 'other hidden meshes').toEqual(want.hidden.filter((n) => !ruled(n)));
    });
  }

  it('the hand, foot and head centres in the figure space are within 0.01 of the fixture', async () => {
    const got = centres(await dressed(LOADOUTS.defenderAva, heroGltf));
    for (const name of CENTRE_NAMES) {
      expect(new THREE.Vector3(...got[name]).distanceTo(new THREE.Vector3(...fixture.centres[name])), name).toBeLessThanOrEqual(0.01);
    }
  });

  it('with the right arm bone turned 1 rad on x, the weapon turns about that bone\'s joint', async () => {
    const rig = await dressed(LOADOUTS.defenderAva, heroGltf);
    const arm = rig.group.getObjectByName('RightArmPivot')!;
    const weapon = (rig as unknown as { wepMesh: THREE.Object3D }).wepMesh;
    const offset = () => inFigure(rig, weapon).p.sub(inFigure(rig, arm).p);
    const before = offset();
    arm.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1);
    const after = offset();
    const want = before.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), 1);
    expect(after.distanceTo(want)).toBeLessThanOrEqual(0.01);
    expect(after.distanceTo(before)).toBeGreaterThan(0.1);
  });

  it('a helm hides every Hair* mesh; body armour hides TorsoCoat and InnerCollar', async () => {
    const find = (rig: HumanoidRig, test: (n: string) => boolean) => {
      const out: THREE.Object3D[] = [];
      rig.group.traverse((o) => {
        if (test(o.name)) out.push(o);
      });
      return out;
    };
    const isHair = isHairName;
    const isCoat = isCoatName;

    const bare = await dressed({}, heroGltf);
    expect(find(bare, isHair).length).toBeGreaterThan(0);
    expect(find(bare, isCoat).length).toBeGreaterThan(0);
    for (const o of [...find(bare, isHair), ...find(bare, isCoat)]) expect(o.visible, `${o.name} bare`).toBe(true);

    const worn = await dressed(LOADOUTS.defenderAva, heroGltf);
    for (const o of find(worn, isHair)) expect(o.visible, `${o.name} under a helm`).toBe(false);
    expect(find(worn, isCoat).length).toBeGreaterThan(0);
    for (const o of find(worn, isCoat)) expect(o.visible, `${o.name} under body armour`).toBe(false);
  });

  it('armour recolours the role materials on the meshes that carry them', async () => {
    const rig = await dressed(LOADOUTS.defenderAva, heroGltf);
    const roles: [string, THREE.Material | undefined, string][] = [
      ['tunicMat', rig.tunicMat, 'bandos_chest'],
      ['legsMat', rig.legsMat, 'bandos_tassets'],
      ['bootMat', rig.bootMat, 'primordial_boots'],
      ['gloveMat', rig.gloveMat, 'barrows_gloves'],
      ['bracerMat', rig.bracerMat, 'barrows_gloves']
    ];
    for (const [role, mat, item] of roles) {
      expect(mat, role).toBeDefined();
      const carriers: THREE.Mesh[] = [];
      rig.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material === mat) carriers.push(m);
      });
      expect(carriers.length, `${role} is carried by a mesh`).toBeGreaterThan(0);
      expect((mat as THREE.MeshLambertMaterial).color.getHex(), `${role} colour`).toBe(ITEMS[item].color);
    }
  });
});
