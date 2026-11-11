import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {
  LOCKED_PALETTES,
  PALETTE_BY_ID,
  PALETTES,
  hexToPaint
} from '../src/paint/palettes';
import {
  DAB_SIZE_BY_CLASS,
  inferPaletteId,
  readPaintFlags,
  resolvePaint,
  shouldPaintMesh,
  strokeDirection
} from '../src/paint/contract';
import { classifyGround } from '../src/paint/terrain';

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/paint/fixtures/extras-spike.json'), 'utf8')
) as {
  object: Record<string, unknown>;
  material: Record<string, unknown>;
};

describe('oil-paint palette contract', () => {
  it('locks the spike mixes as sRGB hex, light / half / shade', () => {
    expect(LOCKED_PALETTES).toEqual({
      meadow_grass: ['#B9C46A', '#7E9443', '#3F5A33'],
      dirt_path: ['#C9A877', '#8E6B45', '#4E3A2C'],
      kai_skin: ['#F2CFAE', '#C9946F', '#7A4E3E'],
      kai_hair: ['#5A3A2A', '#3A2419', '#1E1210'],
      kai_tunic: ['#6F8FB0', '#45607E', '#26354A'],
      goblin_hide: ['#9DB05A', '#647A36', '#33421F'],
      bronze: ['#E0A862', '#A8703A', '#5A3A22'],
      leather: ['#A87B4F', '#6E4A2E', '#3A2618']
    });
    for (const [id, mixes] of Object.entries(LOCKED_PALETTES)) {
      const palette = PALETTE_BY_ID[id];
      expect(palette.placeholder).toBe(false);
      expect([palette.light, palette.half, palette.shade]).toEqual(mixes);
      expect(palette.shade.toUpperCase()).not.toBe('#000000');
    }
  });

  it('writes hex bytes as paint, not a tone-mapped linear conversion', () => {
    const [r, g, b] = hexToPaint('#B9C46A');
    expect(r).toBeCloseTo(0xb9 / 255, 6);
    expect(g).toBeCloseTo(0xc4 / 255, 6);
    expect(b).toBeCloseTo(0x6a / 255, 6);
  });

  it('marks every other biome and metal tier as a placeholder and never black', () => {
    const placeholders = PALETTES.filter((p) => p.placeholder).map((p) => p.id);
    expect(placeholders).toEqual(
      expect.arrayContaining([
        'alkharid_sand',
        'varrock_stone',
        'volcanic',
        'pine_bark',
        'iron',
        'steel',
        'mithril',
        'adamant',
        'rune',
        'cloth',
        'skin',
        'river_opaque'
      ])
    );
    for (const palette of PALETTES) {
      expect(palette.shade.toUpperCase()).not.toBe('#000000');
      expect(palette.light.toUpperCase()).not.toBe('#000000');
    }
  });
});

describe('Blender extras become paint options', () => {
  it('lets object extras replace the material, with monster size and metal jitter defaults', () => {
    const fromFixture = resolvePaint({
      objectUserData: fixture.object,
      materialUserData: fixture.material,
      paintClass: 'monster'
    });
    expect(fromFixture.paletteId).toBe('goblin_hide');
    expect(fromFixture.stroke).toBe('surface_flow');
    expect(fromFixture.size).toEqual([0.06, 0.12]);
    expect(fromFixture.jitter).toBe(0.5);
    expect(fromFixture.density).toBe(40);
    expect(fromFixture.source).toBe('object');

    const bronze = resolvePaint({
      objectUserData: { paint_palette: 'bronze', stroke_dir: 'along_bone' },
      paintClass: 'gear'
    });
    expect(bronze.size).toEqual([0.03, 0.07]);
    expect(bronze.jitter).toBe(0.25);

    const explicitJitter = resolvePaint({
      objectUserData: { paint_palette: 'bronze', jitter: 0.8 },
      paintClass: 'gear'
    });
    expect(explicitJitter.jitter).toBe(0.8);
  });

  it('falls back by class when extras are missing or unknown', () => {
    expect(DAB_SIZE_BY_CLASS.hero).toEqual([0.04, 0.09]);
    expect(DAB_SIZE_BY_CLASS.boss).toEqual([0.04, 0.09]);
    expect(DAB_SIZE_BY_CLASS.tree).toEqual([0.12, 0.3]);
    expect(DAB_SIZE_BY_CLASS.prop).toEqual([0.08, 0.16]);

    const hero = resolvePaint({ paintClass: 'hero', part: 'hair', name: 'Hair' });
    expect(hero.paletteId).toBe('kai_hair');
    expect(hero.stroke).toBe('along_bone');
    expect(hero.size).toEqual([0.04, 0.09]);
    expect(hero.jitter).toBe(0.5);
    expect(hero.source).toBe('default');

    expect(inferPaletteId('hero', 'boot', 'Boot_L')).toBe('leather');
    expect(inferPaletteId('hero', 'chest', 'TorsoCoat')).toBe('kai_tunic');
    expect(inferPaletteId('hero', 'head', 'Head')).toBe('kai_skin');

    const unknown = resolvePaint({
      objectUserData: { paint_palette: 'not_a_mix', stroke_dir: 'along_x' },
      paintClass: 'monster'
    });
    expect(unknown.paletteId).toBe('goblin_hide');
    expect(unknown.stroke).toBe('surface_flow');

    const materialOnly = resolvePaint({
      materialUserData: { paint_palette: 'kai_tunic', stroke_dir: 'flat', dab_size: '0.05x0.11' },
      paintClass: 'hero'
    });
    expect(materialOnly.paletteId).toBe('kai_tunic');
    expect(materialOnly.stroke).toBe('flat');
    expect(materialOnly.size).toEqual([0.05, 0.11]);
    expect(materialOnly.source).toBe('material');
  });

  it('names only the four stroke directions and aims them', () => {
    expect(strokeDirection('up', { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 1, z: 0 });
    expect(strokeDirection('along_bone', { x: 1, y: 0, z: 0 })).toEqual({ x: 0, y: 1, z: 0 });
    const flow = strokeDirection('surface_flow', { x: 1, y: 0, z: 0 });
    expect(flow.x).toBeCloseTo(0, 5);
    expect(flow.y).toBeCloseTo(1, 5);
    const flat = strokeDirection('flat', { x: 0, y: 1, z: 0 });
    expect(flat.y).toBeCloseTo(0, 5);
    expect(Math.hypot(flat.x, flat.y, flat.z)).toBeCloseTo(1, 5);
  });

  it('skips outlines, colliders, and eyes so pins stay on the body', () => {
    expect(shouldPaintMesh({ isOutline: true }, 'Coat')).toBe(false);
    expect(shouldPaintMesh({ isCollider: true }, 'Hitbox')).toBe(false);
    expect(shouldPaintMesh({ part: 'eye' }, 'Eyes')).toBe(false);
    expect(shouldPaintMesh({ part: 'chest' }, 'TorsoCoat')).toBe(true);
  });

  it('reads ?quality=low and ?renderer=legacy', () => {
    expect(readPaintFlags('')).toEqual({ legacy: false, low: false });
    expect(readPaintFlags('?quality=low')).toEqual({ legacy: false, low: true });
    expect(readPaintFlags('?renderer=legacy&quality=low')).toEqual({ legacy: true, low: true });
  });

  it('loads glTF extras onto userData and those extras change palette and stroke', async () => {
    const positions = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
    const gltfJson = {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{
        mesh: 0,
        extras: {
          paint_palette: 'bronze',
          stroke_dir: 'along_bone',
          dab_size: '0.03x0.07',
          jitter: 0.25
        }
      }],
      materials: [{
        pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] },
        extras: { paint_palette: 'leather', stroke_dir: 'flat', jitter: 0.9 }
      }],
      meshes: [{
        primitives: [{ attributes: { POSITION: 0 }, material: 0 }]
      }],
      accessors: [{
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0]
      }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
      buffers: [{ byteLength: 36 }]
    };
    const jsonText = JSON.stringify(gltfJson);
    const jsonPad = (4 - (Buffer.byteLength(jsonText) % 4)) % 4;
    const jsonChunk = Buffer.concat([Buffer.from(jsonText), Buffer.alloc(jsonPad, 0x20)]);
    const binChunk = positions;
    const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
    const glb = Buffer.alloc(total);
    glb.writeUInt32LE(0x46546c67, 0);
    glb.writeUInt32LE(2, 4);
    glb.writeUInt32LE(total, 8);
    let cursor = 12;
    glb.writeUInt32LE(jsonChunk.length, cursor);
    cursor += 4;
    glb.writeUInt32LE(0x4e4f534a, cursor);
    cursor += 4;
    jsonChunk.copy(glb, cursor);
    cursor += jsonChunk.length;
    glb.writeUInt32LE(binChunk.length, cursor);
    cursor += 4;
    glb.writeUInt32LE(0x004e4942, cursor);
    cursor += 4;
    binChunk.copy(glb, cursor);
    const arrayBuffer = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
    const loader = new GLTFLoader();
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(arrayBuffer, '', (parsed) => resolve(parsed), (err) => reject(err));
    });
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((obj: THREE.Object3D) => {
      const candidate = obj as THREE.Mesh;
      if (candidate.isMesh) meshes.push(candidate);
    });
    expect(meshes.length).toBe(1);
    const painted = meshes[0];
    const material = painted.material as THREE.Material;
    expect(painted.userData.paint_palette).toBe('bronze');
    expect(material.userData.paint_palette).toBe('leather');
    const resolved = resolvePaint({
      objectUserData: painted.userData,
      materialUserData: material.userData,
      paintClass: 'gear'
    });
    expect(resolved.paletteId).toBe('bronze');
    expect(resolved.stroke).toBe('along_bone');
    expect(resolved.size).toEqual([0.03, 0.07]);
    expect(resolved.jitter).toBe(0.25);
  });
});

describe('ground kinds from the existing terrain', () => {
  it('paints Lumbridge as meadow, the path as dirt, and the river as opaque paint', () => {
    expect(classifyGround(0, -8, 1)).toBe('meadow');
    expect(classifyGround(10, -2.2, 1)).toBe('path');
    expect(classifyGround(31.8, 10, -1)).toBe('river');
    expect(classifyGround(68, 68, 1)).toBe('sand');
    expect(classifyGround(-70, 68, 4)).toBe('volcanic');
    expect(classifyGround(-75, -30, 1)).toBe('pine');
    expect(classifyGround(78, -40, 1)).toBe('stone');
  });
});
