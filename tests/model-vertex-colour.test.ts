import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ItemDef } from '../src/data/items';
import { buildHumanoidRig } from '../src/engine/humanoid';
import { upgradeHumanoidRigWithGltf } from '../src/engine/blenderHero';
import { cloneBlenderGearNode, setBlenderGearRoot } from '../src/engine/blenderGear';
import { upgradeMonsterRigWithGltf, type MonsterEntityLike } from '../src/engine/blenderMonsters';
import { buildColouredHero, buildColouredMonster, glbBytes } from './fixtures/models/vertexColourGlb';
import type { Doc } from './fixtures/models/tinyGlb';

const parse = (bytes: ArrayBuffer): Promise<GLTF> =>
  new Promise((resolve, reject) => new GLTFLoader().parse(bytes, '', resolve, reject));
const parseDoc = (doc: Doc) => parse(glbBytes(doc));
const parseShipped = (name: string) => {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public/models', name));
  return parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
};

/** The figure's own meshes, outline shells excluded. */
function figureMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.isOutline) out.push(m);
  });
  return out;
}
const materialsOf = (meshes: THREE.Mesh[]) =>
  meshes.flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material])) as THREE.MeshLambertMaterial[];

function monsterEntity(key: string): MonsterEntityLike {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh();
  group.add(hitbox);
  return { typeKey: key, def: { bodyColor: 0x65a30d }, rig: { group, hitbox }, pos: new THREE.Vector3() };
}

// The figures the manifest paints (`vertexColor.figures`): the goblin since S4, the dragon, Ashmantle and the demon since D5, the archer and the chicken since M4a, the scorpion, wizard and ranger since K4, the hill giant and moss guardian since M4c.
const PAINTED = new Set(['goblin', 'goblin_archer', 'chicken', 'scorpion', 'dark_wizard', 'dark_ranger', 'hill_giant', 'moss_guardian', 'elvarg_dragon', 'ashmantle', 'lesser_demon']);

describe('vertex colour reaches the engine materials (H6; red until H6b)', () => {
  it('the fixtures carry COLOR_0 on every mesh, as the loader parses it', async () => {
    const gltf = await parseDoc(buildColouredHero());
    const meshes = figureMeshes(gltf.scene);
    expect(meshes.length).toBeGreaterThanOrEqual(8);
    for (const m of meshes) expect(m.geometry.getAttribute('color'), m.name).toBeDefined();
  });

  it('a hero whose file carries COLOR_0 gets vertexColors true on every role material, and rig.tunicMat is the coat mesh material', async () => {
    const gltf = await parseDoc(buildColouredHero());
    const rig = buildHumanoidRig();
    expect(upgradeHumanoidRigWithGltf(rig, gltf)).not.toBeNull();
    const meshes = figureMeshes(rig.group).filter((m) => m.geometry.getAttribute('color'));
    expect(meshes.length).toBeGreaterThanOrEqual(8);
    for (const m of meshes) expect((m.material as THREE.MeshLambertMaterial).vertexColors, m.name).toBe(true);
    for (const mat of [rig.tunicMat, rig.legsMat, rig.bootMat, rig.gloveMat, rig.bracerMat]) {
      expect(mat?.vertexColors).toBe(true);
    }
    const coat = meshes.find((m) => m.name === 'TorsoCoat')!;
    expect(coat.material).toBe(rig.tunicMat);
    // recolouring still reaches it: one instance, no second material for the coat
    rig.tunicMat.color.setHex(0x123456);
    expect((coat.material as THREE.MeshLambertMaterial).color.getHex()).toBe(0x123456);
  });

  it('a monster whose meshes carry a color attribute gets materials with vertexColors true', async () => {
    const doc = buildColouredMonster('goblin');
    const gltf = await parseDoc(doc);
    // the fixture's own materials are 'skin' and 'cloth' (albedo routes); add the plain facet and glow routes
    const template = gltf.scene.getObjectByName('Monster_goblin')!;
    const base = figureMeshes(template)[0];
    for (const matName of ['plain', 'glow']) {
      const extra = new THREE.Mesh(base.geometry, new THREE.MeshStandardMaterial({ name: matName }));
      extra.name = `Extra_${matName}`;
      template.add(extra);
    }
    const ent = monsterEntity('goblin');
    expect(upgradeMonsterRigWithGltf(ent, gltf)).toBe(true);
    const meshes = figureMeshes(ent.rig.group).filter((m) => m !== ent.rig.hitbox && m.geometry.getAttribute('color'));
    expect(meshes.length).toBeGreaterThanOrEqual(7);
    for (const m of meshes) {
      const mat = m.material as THREE.Material & { vertexColors?: boolean };
      if (mat.type === 'MeshBasicMaterial') continue; // eyes: flat, no lighting
      expect(mat.vertexColors, `${m.name} (${(m.material as THREE.Material).name})`).toBe(true);
    }
  });

  it('a gear piece whose meshes carry a color attribute gets materials with vertexColors true', async () => {
    const gltf = await parseDoc(buildColouredHero());
    const piece = new THREE.Group();
    piece.name = 'Gear_multi';
    const base = figureMeshes(gltf.scene).find((m) => m.name === 'Head')!;
    for (const matName of ['gear_primary', 'gear_trim', 'gear_wood', 'gear_leather', 'gear_glow', 'gear_dark']) {
      const m = new THREE.Mesh(base.geometry, new THREE.MeshStandardMaterial({ name: matName }));
      m.name = `Part_${matName}`;
      piece.add(m);
    }
    gltf.scene.add(piece);
    setBlenderGearRoot(gltf.scene);
    try {
      const group = cloneBlenderGearNode('Gear_multi', { color: 0x888888 } as ItemDef)!;
      expect(group).not.toBeNull();
      const meshes = figureMeshes(group);
      expect(meshes).toHaveLength(6);
      for (const m of meshes) {
        expect((m.material as THREE.MeshLambertMaterial).vertexColors, m.name).toBe(true);
      }
    } finally {
      setBlenderGearRoot(null);
    }
  });

  it("the hero's and the painted monsters' materials have vertexColors true and every other monster's false", async () => {
    const hero = await parseShipped('hero.glb');
    const rig = buildHumanoidRig();
    expect(upgradeHumanoidRigWithGltf(rig, hero)).not.toBeNull();
    for (const m of materialsOf(figureMeshes(rig.group).filter((o) => o !== rig.hitbox))) expect(m.vertexColors).toBe(true);

    const monsters = await parseShipped('monsters.glb');
    const keys = monsters.scene.children.filter((c) => c.name.startsWith('Monster_')).map((c) => c.name.slice(8));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const ent = monsterEntity(key);
      expect(upgradeMonsterRigWithGltf(ent, monsters), key).toBe(true);
      for (const m of materialsOf(figureMeshes(ent.rig.group).filter((o) => o !== ent.rig.hitbox))) expect(m.vertexColors, key).toBe(PAINTED.has(key));
    }

    const gear = await parseShipped('gear.glb');
    setBlenderGearRoot(gear.scene);
    try {
      const nodes = gear.scene.children.filter((c) => c.name.startsWith('Gear_'));
      expect(nodes.length).toBeGreaterThan(0);
      for (const n of nodes) {
        const g = cloneBlenderGearNode(n.name, { color: 0x888888 } as ItemDef);
        if (!g) continue;
        for (const m of materialsOf(figureMeshes(g))) expect(m.vertexColors, n.name).toBe(false);
      }
    } finally {
      setBlenderGearRoot(null);
    }
  });
});
