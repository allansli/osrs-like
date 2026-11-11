import * as THREE from 'three';
import { COMMON, EXTENT, LAND_RES } from '../oilpaint/common.js';
import { groundRings } from '../oilpaint/ground.js';
import { PALETTE_BY_ID, hexToPaint } from './palettes';
import { KIND_BYTE, classifyGround, type GroundKind } from './terrain';

/**
 * Same groundRings the painter ships. The wood's carpet is n=192; this slice uses a
 * smaller grid so the start area still paints on a software GL. Raise `n` and `levels`
 * when a real GPU is the target. The dabs themselves do not change with the camera.
 */
export const CARPET = { per: 2, n: 48, cell0: 0.28, levels: 4, minPx: [5, 9] as [number, number], maxPx: [4000, 4000] as [number, number], cells: [0, 8] as [number, number] };
export const TUFTS = { per: 3, n: 28, cell0: 0.72, levels: 3, minPx: [2.5, 10] as [number, number], maxPx: [48, 280] as [number, number], cells: [0, 4] as [number, number] };

const KIND_PALETTE: Record<GroundKind, string> = {
  meadow: 'meadow_grass',
  path: 'dirt_path',
  sand: 'alkharid_sand',
  stone: 'varrock_stone',
  volcanic: 'volcanic',
  pine: 'pine_bark',
  river: 'river_opaque'
};

function vec3(hex: string): string {
  const [r, g, b] = hexToPaint(hex);
  return `vec3(${r.toFixed(5)}, ${g.toFixed(5)}, ${b.toFixed(5)})`;
}

/** GLSL: a land-byte becomes one of the palette mixes. Thresholds match KIND_BYTE. */
function groundPaintGlsl(): string {
  const kinds: GroundKind[] = ['river', 'pine', 'volcanic', 'stone', 'sand', 'path', 'meadow'];
  const cuts = [220, 180, 140, 100, 60, 20, -1];
  const lines = kinds.map((kind, i) => {
    const p = PALETTE_BY_ID[KIND_PALETTE[kind]];
    const body = `return paint3(${vec3(p.light)}, ${vec3(p.half)}, ${vec3(p.shade)}, lit, r);`;
    if (i === kinds.length - 1) return `  ${body}`;
    return `  if (id > ${cuts[i].toFixed(1)}) ${body}`;
  });
  return `vec3 groundPaint(float id, float lit, float r) {\n${lines.join('\n')}\n}`;
}

const CARPET_BODY = /* glsl */ `
${groundPaintGlsl()}
void makeDab(inout Dab d) {
  vec2 cell; float sub;
  if (!ringCell(0.0, true, cell, sub)) { d.alive = 0.0; return; }
  vec4 r = hash4(cell, sub * 3.0 + 1.0);
  vec2 xz = (cell + r.xy) * uCell0;
  float lod;
  d.alive = ringGrow(distance(xz, cameraPosition.xz), lod);
  if (d.alive <= 0.0) return;
  vec3 P = vec3(xz.x, heightAt(xz), xz.y);
  vec3 Nn = normalAt(xz);
  float id = texture(tLand, landUv(xz)).b * 255.0;
  float lit = woodSunAt(P + vec3(0.0, 0.2, 0.0)) * clamp(dot(Nn, uSunDir) * 2.2, 0.0, 1.0);
  vec3 c1 = jitter(groundPaint(id, lit, r.z), r.wzy, 0.5);
  vec3 c2 = jitter(groundPaint(id, lit, r.w), r.zwy, 0.5);
  float a = r.y * 6.2831853;
  d.dir = vec3(cos(a), 0.0, sin(a));
  d.pos = P;
  d.size = uCell0 * vec2(1.15, 1.75) * lod;
  d.c1 = hazed(c1, P);
  d.c2 = hazed(c2, P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37;
  d.turnabout = 1.0;
  d.lie = 1.0;
  d.nrm = Nn;
  d.height = 0.02 + 0.05 * r.z;
  d.glaze = 1.0;
}
`;

const MEADOW = PALETTE_BY_ID.meadow_grass;
const TUFT_BODY = /* glsl */ `
void makeDab(inout Dab d) {
  vec2 cell; float sub;
  if (!ringCell(3.0, false, cell, sub)) { d.alive = 0.0; return; }
  vec4 r = hash4(cell, 9.0);
  vec4 f = hash4(cell + sub * 7.7 + 3.1, sub * 13.0 + 3.0);
  vec2 foot = (cell + r.xy) * uCell0;
  float lod;
  d.alive = ringGrow(distance(foot, cameraPosition.xz), lod);
  if (d.alive <= 0.0) return;
  float id = texture(tLand, landUv(foot)).b * 255.0;
  if (id > 20.0) { d.alive = 0.0; return; }
  if (r.z > 0.72) { d.alive = 0.0; return; }
  float a = (sub + f.x) / 4.0 * 6.2831853;
  vec2 fan = vec2(cos(a), sin(a));
  vec2 xz = foot + fan * 0.04;
  vec3 P = vec3(xz.x, heightAt(xz), xz.y);
  float lit = sunAt(P + vec3(0.0, 0.25, 0.0));
  vec3 c = paint3(${vec3(MEADOW.light)}, ${vec3(MEADOW.half)}, ${vec3(MEADOW.shade)}, lit, f.w);
  c = jitter(c, f.zwx, 0.5);
  float gust = gustAt(xz);
  d.dir = normalize(vec3(fan.x * (0.15 + 0.35 * gust), 1.0, fan.y * (0.15 + 0.35 * gust)));
  d.pos = P;
  d.size = vec2(0.035, 0.26) * vec2(1.0, 0.75 + 0.5 * f.z);
  d.c1 = hazed(c, P);
  d.c2 = hazed(jitter(c * 1.15, f.xzy, 0.5), P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37 + 0.5;
  d.base = 1.0;
  d.lift = 0.2;
}
`;

export function fillGroundMaps(heightAt: (x: number, z: number) => number): { heights: Float32Array; land: Uint8Array } {
  const n = LAND_RES as number;
  const extent = EXTENT as number;
  const heights = new Float32Array(n * n);
  const land = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    const z = -extent + (j / (n - 1)) * 2 * extent;
    for (let i = 0; i < n; i++) {
      const x = -extent + (i / (n - 1)) * 2 * extent;
      const h = heightAt(x, z);
      heights[i + j * n] = h;
      const kind = classifyGround(x, z, h);
      const k = (i + j * n) * 4;
      land[k] = kind === 'path' ? 255 : 0;
      land[k + 1] = kind === 'meadow' ? 255 : 0;
      land[k + 2] = KIND_BYTE[kind];
      land[k + 3] = 255;
    }
  }
  return { heights, land };
}

export function applyGroundMaps(shared: { tHeight: { value: THREE.Texture }; tLand: { value: THREE.Texture } }, maps: { heights: Float32Array; land: Uint8Array }): void {
  const n = LAND_RES as number;
  const tHeight = new THREE.DataTexture(maps.heights, n, n, THREE.RedFormat, THREE.FloatType);
  tHeight.minFilter = THREE.LinearFilter;
  tHeight.magFilter = THREE.LinearFilter;
  tHeight.generateMipmaps = false;
  tHeight.colorSpace = THREE.NoColorSpace;
  tHeight.needsUpdate = true;
  const tLand = new THREE.DataTexture(maps.land, n, n);
  tLand.minFilter = THREE.NearestFilter;
  tLand.magFilter = THREE.NearestFilter;
  tLand.generateMipmaps = false;
  tLand.colorSpace = THREE.NoColorSpace;
  tLand.needsUpdate = true;
  shared.tHeight.value = tHeight;
  shared.tLand.value = tLand;
}

function underpaint(shared: object): THREE.Mesh {
  const extent = EXTENT as number;
  const geometry = new THREE.PlaneGeometry(extent * 1.1, extent * 1.1, 96, 96);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared as Record<string, THREE.IUniform>,
    vertexShader: /* glsl */ `
      ${COMMON}
      out vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        world.y = heightAt(world.xz) - 0.06;
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      ${groundPaintGlsl()}
      in vec3 vWorld;
      layout(location = 0) out vec4 outC;
      void main() {
        float id = texture(tLand, landUv(vWorld.xz)).b * 255.0;
        float lit = woodSunAt(vWorld + vec3(0.0, 0.2, 0.0));
        vec3 c = groundPaint(id, lit, 0.5);
        c *= 0.82 + 0.18 * texture(tNoise, vWorld.xz / 9.0).r;
        outC = vec4(hazed(c, vWorld), 1.0);
      }`
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  return mesh;
}

export interface PaintedGround {
  group: THREE.Group;
  tufts: THREE.Object3D;
  follow: (x: number, z: number) => void;
}

export function createPaintedGround(shared: object): PaintedGround {
  const carpet = groundRings(shared, { body: CARPET_BODY, ...CARPET });
  const tufts = groundRings(shared, { body: TUFT_BODY, ...TUFTS });
  const group = new THREE.Group();
  group.add(underpaint(shared), carpet.group, tufts.group);
  return {
    group,
    tufts: tufts.group,
    follow(x: number, z: number) {
      carpet.follow(x, z);
      tufts.follow(x, z);
    }
  };
}
