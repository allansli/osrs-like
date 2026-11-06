import { Buffer } from 'node:buffer';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { buildHumanoidRig } from '../src/engine/humanoid';
import { addCartoonOutline, facetMaterial } from '../src/engine/materials';
import { buildBodyVisual, buildRingVisual, buildShieldVisual, buildWeaponVisual } from '../src/engine/playerGear';
import {
  ALBEDO_IDS,
  BIOME_IDS,
  CREATURE_IDS,
  GROUND_REPEAT,
  GROUND_TILE_METERS,
  PROP_REPEAT,
  GEAR_IDS,
  albedoForItem,
  albedoUrl,
  assignGroundUvs,
  assignProjectedUvs,
  biomeAlbedoId,
  biomeGroundId,
  creatureAlbedoId,
  gearAlbedoId,
  loadAlbedo,
  offsetAlbedoPhase,
  speciesAlbedo,
  terrainMaterial
} from '../src/engine/textures';

const TEXTURE_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '../public/textures');

function solidMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.isOutline) return;
    found.push(mesh);
  });
  return found;
}

function decodePng(buffer: InstanceType<typeof Buffer>): { width: number; height: number; rgba: Uint8Array } {
  const sig = '89504e470d0a1a0a';
  expect(buffer.subarray(0, 8).toString('hex')).toBe(sig);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(6);
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  const stride = width * 4;
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    expect(filter).toBe(0);
    rgba.set(raw.subarray(src, src + stride), y * stride);
    src += stride;
  }
  return { width, height, rgba };
}

describe('facet albedo maps', () => {
  it('keeps the albedo map, repeats it, and still tints with the color token', () => {
    const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    const mat = facetMaterial({ color: 0x68a84e, map, metalness: 0.8, roughness: 0.2 });
    expect(mat.map).toBe(map);
    expect(mat.color.getHex()).toBe(0x68a84e);
    expect(map.wrapS).toBe(THREE.RepeatWrapping);
    expect(map.wrapT).toBe(THREE.RepeatWrapping);
    expect(map.magFilter).toBe(THREE.LinearFilter);
    expect('metalness' in mat).toBe(false);
  });

  it('cel-shades the sampled diffuse color and leaves the ink outline alone', () => {
    const map = new THREE.DataTexture(new Uint8Array([240, 230, 210, 255]), 1, 1);
    const mat = facetMaterial({ color: 0x334155, map });
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.lambert.vertexShader,
      fragmentShader: THREE.ShaderLib.lambert.fragmentShader
    };
    mat.onBeforeCompile(
      shader as unknown as Parameters<THREE.MeshLambertMaterial['onBeforeCompile']>[0],
      null as unknown as THREE.WebGLRenderer
    );
    expect(shader.fragmentShader).toContain('#include <map_fragment>');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb * mix(vec3(0.70, 0.72, 0.82), vec3(1.04), cel)');
    expect(shader.fragmentShader).toContain('smoothstep(0.33, 0.38, ndl)');
    expect(shader.fragmentShader).not.toContain(
      'reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance'
    );

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    addCartoonOutline(mesh, 0.028);
    const shell = mesh.children.find((child) => child.userData.isOutline) as THREE.Mesh;
    const outline = shell.material as THREE.ShaderMaterial;
    expect(outline.uniforms.uThickness.value).toBe(0.028);
    expect(outline.fragmentShader).not.toContain('map');
  });
});

describe('albedo atlas', () => {
  it('loads each painted tile from /textures with ground and prop repeats', () => {
    const urls: string[] = [];
    const loader = {
      load(url: string) {
        urls.push(url);
        const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
        tex.needsUpdate = true;
        return tex;
      }
    };
    const grass = loadAlbedo('grass', GROUND_REPEAT, loader);
    const iron = loadAlbedo('iron', PROP_REPEAT, loader);
    expect(GROUND_REPEAT).toBeGreaterThanOrEqual(2);
    expect(GROUND_REPEAT).toBeLessThanOrEqual(4);
    expect(PROP_REPEAT).toBeGreaterThanOrEqual(1);
    expect(PROP_REPEAT).toBeLessThanOrEqual(2);
    expect(urls).toEqual(['/textures/grass.png', '/textures/iron.png']);
    expect(grass.repeat.x).toBeCloseTo(GROUND_REPEAT);
    expect(grass.repeat.y).toBeCloseTo(GROUND_REPEAT);
    expect(iron.repeat.x).toBeCloseTo(PROP_REPEAT);
    expect(grass.wrapS).toBe(THREE.RepeatWrapping);
    expect(grass.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('ships a seamless 256 painted albedo for every family and no pbr maps', () => {
    const files = readdirSync(TEXTURE_DIR).filter((name) => name.endsWith('.png')).sort();
    expect(files).toEqual([...ALBEDO_IDS].map((id) => `${id}.png`).sort());
    for (const file of files) {
      const image = decodePng(readFileSync(join(TEXTURE_DIR, file)));
      expect(image.width).toBe(256);
      expect(image.height).toBe(256);
      let sum = 0;
      let sumSq = 0;
      let seam = 0;
      let neighbor = 0;
      const count = image.width * image.height;
      for (let i = 0; i < count; i++) {
        const r = image.rgba[i * 4];
        const g = image.rgba[i * 4 + 1];
        const b = image.rgba[i * 4 + 2];
        const luma = (r + g + b) / 3;
        sum += luma;
        sumSq += luma * luma;
        expect(luma).toBeGreaterThan(150);
      }
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      expect(variance).toBeGreaterThan(12);
      for (let y = 0; y < image.height; y++) {
        for (let c = 0; c < 3; c++) {
          const edge = image.rgba[(y * image.width + image.width - 1) * 4 + c];
          const wrap = image.rgba[y * image.width * 4 + c];
          const next = image.rgba[(y * image.width + 1) * 4 + c];
          seam += Math.abs(edge - wrap);
          neighbor += Math.abs(wrap - next);
        }
      }
      expect(seam / image.height).toBeLessThan((neighbor / image.height) * 2.5 + 8);
    }
  });
});

describe('uv mapping and terrain blend', () => {
  it('maps ground from world XZ even when a corner is lifted', () => {
    const geo = new THREE.PlaneGeometry(16, 16, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    pos.setY(0, 4);
    assignGroundUvs(geo);
    const uv = geo.getAttribute('uv');
    const divisor = GROUND_TILE_METERS * GROUND_REPEAT;
    for (let i = 0; i < pos.count; i++) {
      expect(uv.getX(i)).toBeCloseTo(pos.getX(i) / divisor);
      expect(uv.getY(i)).toBeCloseTo(pos.getZ(i) / divisor);
    }
  });

  it('projects primary geometry so large faces tile and small props still repeat', () => {
    const wall = new THREE.BoxGeometry(10, 4, 1);
    assignProjectedUvs(wall, 2, PROP_REPEAT, 1);
    const uv = wall.getAttribute('uv');
    let minU = Infinity;
    let maxU = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      minU = Math.min(minU, uv.getX(i));
      maxU = Math.max(maxU, uv.getX(i));
    }
    expect(maxU - minU).toBeGreaterThan(2);

    const bead = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    assignProjectedUvs(bead, 2, PROP_REPEAT, 1);
    const beadUv = bead.getAttribute('uv');
    let beadMin = Infinity;
    let beadMax = -Infinity;
    for (let i = 0; i < beadUv.count; i++) {
      beadMin = Math.min(beadMin, beadUv.getX(i));
      beadMax = Math.max(beadMax, beadUv.getX(i));
    }
    expect(beadMax - beadMin).toBeGreaterThanOrEqual(1);
  });

  it('slides creature tiles and leaves untextured meshes alone', () => {
    const painted = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshLambertMaterial());
    (painted.material as THREE.MeshLambertMaterial).userData.albedoId = 'creature:dragon-scale';
    const beforeU = painted.geometry.getAttribute('uv').getX(3);
    const beforeV = painted.geometry.getAttribute('uv').getY(3);
    offsetAlbedoPhase(painted, 0.33, 0.12);
    expect(painted.geometry.getAttribute('uv').getX(3)).toBeCloseTo(beforeU + 0.33);
    expect(painted.geometry.getAttribute('uv').getY(3)).toBeCloseTo(beforeV + 0.12);
    const bare = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshLambertMaterial());
    const bareBefore = bare.geometry.getAttribute('uv').getX(3);
    offsetAlbedoPhase(bare, 0.5, 0.5);
    expect(bare.geometry.getAttribute('uv').getX(3)).toBeCloseTo(bareBefore);
  });

  it('blends grass, dirt, sand, and stone in the terrain cel shader', () => {
    const mat = terrainMaterial({
      load(url: string) {
        const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
        tex.name = url;
        tex.needsUpdate = true;
        return tex;
      }
    });
    expect(mat.vertexColors).toBe(true);
    expect((mat.map as THREE.Texture).name).toBe('/textures/grass.png');
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: THREE.ShaderLib.lambert.vertexShader,
      fragmentShader: THREE.ShaderLib.lambert.fragmentShader
    };
    mat.onBeforeCompile(
      shader as unknown as Parameters<THREE.MeshLambertMaterial['onBeforeCompile']>[0],
      null as unknown as THREE.WebGLRenderer
    );
    expect(shader.fragmentShader).toContain('texture2D( map, vMapUv )');
    expect(shader.fragmentShader).toContain('texture2D( uDirtMap, vMapUv )');
    expect(shader.fragmentShader).toContain('texture2D( uSandMap, vMapUv )');
    expect(shader.fragmentShader).toContain('texture2D( uStoneMap, vMapUv )');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb * mix(vec3(0.70, 0.72, 0.82), vec3(1.04), cel)');
    expect(shader.uniforms.uDirtMap.value).toBeTruthy();
    expect(shader.uniforms.uSandMap.value).toBeTruthy();
    expect(shader.uniforms.uStoneMap.value).toBeTruthy();
    expect(shader.fragmentShader).toContain('texture2D(uKorokMap, vMapUv)');
    expect(shader.fragmentShader).toContain('texture2D(uVolcanicMap, vMapUv)');
    expect(shader.fragmentShader).toContain('texture2D(uCobbleMap, vMapUv)');
    expect(shader.fragmentShader).toContain('texture2D(uCrackedSandMap, vMapUv)');
    expect(shader.uniforms.uKorokMap.value).toBeTruthy();
    expect((shader.uniforms.uSand.value as THREE.Color).getStyle()).toBe(new THREE.Color('#e7c27a').getStyle());
  });
});

describe('biome ground tiles', () => {
  it('picks Korok, Peak, Varrock, and Al-Kharid tiles by world position', () => {
    expect(biomeGroundId(-80, -20)).toBe('korok-moss');
    expect(biomeGroundId(-70, 70)).toBe('peak-volcanic');
    expect(biomeGroundId(78, -20)).toBe('varrock-cobble');
    expect(biomeGroundId(70, 70)).toBe('alkharid-sand');
    expect(biomeGroundId(0, 0)).toBeNull();
    expect(biomeAlbedoId('korok-moss')).toBe('biome:korok-moss');
  });

  it('ships a seamless 256 gouache tile for each regional ground', () => {
    const dir = join(TEXTURE_DIR, 'biomes');
    const files = readdirSync(dir).filter((name) => name.endsWith('.png')).sort();
    expect(files).toEqual([...BIOME_IDS].map((id) => `${id}.png`).sort());
    for (const file of files) {
      const image = decodePng(readFileSync(join(dir, file)));
      expect(image.width).toBe(256);
      expect(image.height).toBe(256);
      let sum = 0;
      let sumSq = 0;
      let seam = 0;
      let neighbor = 0;
      const count = image.width * image.height;
      for (let i = 0; i < count; i++) {
        const luma = (image.rgba[i * 4] + image.rgba[i * 4 + 1] + image.rgba[i * 4 + 2]) / 3;
        sum += luma;
        sumSq += luma * luma;
        expect(luma).toBeGreaterThan(150);
      }
      const mean = sum / count;
      expect(sumSq / count - mean * mean).toBeGreaterThan(12);
      for (let y = 0; y < image.height; y++) {
        for (let c = 0; c < 3; c++) {
          const edge = image.rgba[(y * image.width + image.width - 1) * 4 + c];
          const wrap = image.rgba[y * image.width * 4 + c];
          const next = image.rgba[(y * image.width + 1) * 4 + c];
          seam += Math.abs(edge - wrap);
          neighbor += Math.abs(wrap - next);
        }
      }
      expect(seam / image.height).toBeLessThan((neighbor / image.height) * 2.5 + 8);
    }
  });
});

describe('gear and body families', () => {
  it('picks a gear tile per material tier and keeps the item color', () => {
    expect(albedoForItem(ITEMS.hylian_tunic)).toBe(gearAlbedoId('cloth'));
    expect(albedoForItem(ITEMS.green_dhide_body)).toBe(gearAlbedoId('hide'));
    expect(albedoForItem(ITEMS.wooden_shield)).toBe(gearAlbedoId('wood'));
    expect(albedoForItem(ITEMS.bronze_plate)).toBe(gearAlbedoId('bronze'));
    expect(albedoForItem(ITEMS.iron_plate)).toBe(gearAlbedoId('iron'));
    expect(albedoForItem(ITEMS.steel_plate)).toBe(gearAlbedoId('steel'));
    expect(albedoForItem(ITEMS.mith_plate)).toBe(gearAlbedoId('mithril'));
    expect(albedoForItem(ITEMS.addy_plate)).toBe(gearAlbedoId('adamant'));
    expect(albedoForItem(ITEMS.rune_plate)).toBe(gearAlbedoId('rune'));
    expect(albedoForItem(ITEMS.shortbow)).toBe(gearAlbedoId('wood'));
    expect(albedoForItem(ITEMS.leather_boots)).toBe(gearAlbedoId('leather'));
    expect(albedoForItem(ITEMS.rune_boots)).toBe(gearAlbedoId('rune'));
    expect(albedoForItem(ITEMS.berserker_ring)).toBe(gearAlbedoId('rune'));
    expect(albedoForItem(ITEMS.amulet_glory)).toBe(gearAlbedoId('rune'));

    const ring = buildRingVisual(ITEMS.berserker_ring);
    const ringMeshes = solidMeshes(ring);
    expect(ringMeshes.some((mesh) => (mesh.material as THREE.MeshLambertMaterial).userData.albedoId === gearAlbedoId('rune'))).toBe(true);
    expect(ringMeshes.some((mesh) => !(mesh.material as THREE.MeshLambertMaterial).map)).toBe(true);

    const plate = buildBodyVisual(ITEMS.rune_plate);
    const painted = solidMeshes(plate.torso!).find((mesh) => (mesh.material as THREE.MeshLambertMaterial).map);
    const plateMat = painted!.material as THREE.MeshLambertMaterial;
    expect(plateMat.color.getHex()).toBe(ITEMS.rune_plate.color);
    expect(plateMat.userData.albedoId).toBe(gearAlbedoId('rune'));

    const shield = buildShieldVisual(ITEMS.wooden_shield);
    const shieldMat = solidMeshes(shield).find((mesh) => (mesh.material as THREE.MeshLambertMaterial).userData.albedoId === gearAlbedoId('wood'))!
      .material as THREE.MeshLambertMaterial;
    expect(shieldMat.color.getHex()).toBe(ITEMS.wooden_shield.color);

    const bow = buildWeaponVisual(ITEMS.shortbow);
    const bowMat = solidMeshes(bow.group).find((mesh) => (mesh.material as THREE.MeshLambertMaterial).userData.albedoId === gearAlbedoId('wood'))!
      .material as THREE.MeshLambertMaterial;
    expect(bowMat.map).toBeTruthy();

    const rig = buildHumanoidRig();
    expect(rig.tunicMat.userData.albedoId).toBe(gearAlbedoId('cloth'));
    expect(rig.tunicMat.color.getHex()).toBe(0x0284c7);
    expect(rig.bootMat.userData.albedoId).toBe(gearAlbedoId('leather'));
    expect(rig.gloveMat.map).toBeTruthy();
    const headMat = rig.head.material as THREE.MeshLambertMaterial;
    const hairMat = rig.hairCap.material as THREE.MeshLambertMaterial;
    expect(headMat.map).toBeTruthy();
    expect(headMat.userData.albedoId).toBe(creatureAlbedoId('skin'));
    expect(headMat.color.getHex()).toBe(0xffd7b5);
    expect(hairMat.userData.albedoId).toBe(creatureAlbedoId('hair'));
    expect(hairMat.color.getHex()).toBe(0xfacc15);
    const eye = solidMeshes(rig.group).find((mesh) => mesh.userData.part === 'eye');
    expect((eye!.material as THREE.MeshLambertMaterial).userData.albedoId).toBe(creatureAlbedoId('eyes'));
  });
});

describe('gear tier albedos', () => {
  it('ships a 256 gouache tile for every metal tier plus wood, hide, leather, and cloth', () => {
    const dir = join(TEXTURE_DIR, 'gear');
    const files = readdirSync(dir).filter((name) => name.endsWith('.png')).sort();
    expect(files).toEqual([...GEAR_IDS].map((id) => `${id}.png`).sort());
    for (const file of files) {
      const image = decodePng(readFileSync(join(dir, file)));
      expect(image.width).toBe(256);
      expect(image.height).toBe(256);
      let sum = 0;
      let sumSq = 0;
      const count = image.width * image.height;
      for (let i = 0; i < count; i++) {
        const luma = (image.rgba[i * 4] + image.rgba[i * 4 + 1] + image.rgba[i * 4 + 2]) / 3;
        sum += luma;
        sumSq += luma * luma;
        expect(luma).toBeGreaterThan(150);
      }
      const mean = sum / count;
      expect(sumSq / count - mean * mean).toBeGreaterThan(12);
    }
  });
});

describe('creature identity albedos', () => {
  it('maps each hunted species onto its own hide and keeps the player on skin', () => {
    expect(speciesAlbedo('goblin')).toBe('creature:goblin-hide');
    expect(speciesAlbedo('goblin_archer')).toBe('creature:goblin-hide');
    expect(speciesAlbedo('scorpion')).toBe('creature:scorpion-chitin');
    expect(speciesAlbedo('elvarg_dragon')).toBe('creature:dragon-scale');
    expect(speciesAlbedo('moss_guardian')).toBe('creature:moss-bark');
    expect(speciesAlbedo('lesser_demon')).toBe('creature:demon-hide');
    expect(speciesAlbedo('hill_giant')).toBe('creature:giant-fur');
    expect(speciesAlbedo('chicken')).toBe('creature:chicken-feathers');
    expect(speciesAlbedo('dark_wizard')).toBeNull();
    expect(albedoUrl(creatureAlbedoId('skin'))).toBe('/textures/creatures/skin.png');
  });

  it('ships a 256 gouache tile for skin, hair, eyes, and every species hide', () => {
    const dir = join(TEXTURE_DIR, 'creatures');
    const files = readdirSync(dir).filter((name) => name.endsWith('.png')).sort();
    expect(files).toEqual([...CREATURE_IDS].map((id) => `${id}.png`).sort());
    for (const file of files) {
      const image = decodePng(readFileSync(join(dir, file)));
      expect(image.width).toBe(256);
      expect(image.height).toBe(256);
      let sum = 0;
      let sumSq = 0;
      const count = image.width * image.height;
      for (let i = 0; i < count; i++) {
        const luma = (image.rgba[i * 4] + image.rgba[i * 4 + 1] + image.rgba[i * 4 + 2]) / 3;
        sum += luma;
        sumSq += luma * luma;
        expect(luma).toBeGreaterThan(150);
      }
      const mean = sum / count;
      expect(sumSq / count - mean * mean).toBeGreaterThan(12);
    }
  });
});
