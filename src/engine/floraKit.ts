import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HORIZON_APRON, KIT_PIECES, type KitPieceDef } from '../data/look';
import { getTerrainHeight, TERRAIN_SEGMENTS, TERRAIN_SIZE } from '../state/terrain';

/**
 * 32-bit seeded pseudo-random number generator (Mulberry32).
 * Deterministic PRNG using the supplied seed.
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Tint = { base: string; top: string; accentBase: string; accentTop: string };

// Vertex colours per tint family (KIT_PIECES[id].tintFamily). accent is the second part of a piece: crowns, caps.
const TINTS: Record<KitPieceDef['tintFamily'], Tint> = {
  stone: { base: '#4d555e', top: '#626c78', accentBase: '#4d555e', accentTop: '#626c78' },
  foliage: { base: '#2f4429', top: '#4d6342', accentBase: '#2f4429', accentTop: '#4d6342' },
  wood: { base: '#423326', top: '#6b543e', accentBase: '#2c4529', accentTop: '#43603c' },
  fungus: { base: '#d4cdb8', top: '#e2dcc8', accentBase: '#8c3e23', accentTop: '#aa4e2d' },
};

// Displace every unique position once (keyed on the rounded original position), so duplicated seam and cap vertices stay welded.
function jitterUnique(
  geo: THREE.BufferGeometry,
  amp: [number, number, number],
  rng: () => number,
  only: (y: number) => boolean = () => true
): void {
  const pos = geo.attributes.position;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (!only(y)) continue;
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let d = seen.get(key);
    if (!d) {
      d = [(rng() - 0.5) * amp[0], (rng() - 0.5) * amp[1], (rng() - 0.5) * amp[2]];
      seen.set(key, d);
    }
    pos.setXYZ(i, x + d[0], y + d[1], z + d[2]);
  }
}

function applyColorsAndNormals(
  geo: THREE.BufferGeometry,
  baseHex: THREE.ColorRepresentation,
  topHex?: THREE.ColorRepresentation,
  variation = 0.04,
  rng?: () => number
): THREE.BufferGeometry {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  const pos = nonIndexed.attributes.position;
  const count = pos.count;
  const cBase = new THREE.Color(baseHex);
  const cTop = topHex ? new THREE.Color(topHex) : cBase;

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(0.001, maxY - minY);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    const t = (y - minY) / span;
    c.copy(cBase).lerp(cTop, t);
    const v = rng ? (rng() - 0.5) * variation : 0;
    colors[i * 3] = Math.max(0, Math.min(1, c.r + v));
    colors[i * 3 + 1] = Math.max(0, Math.min(1, c.g + v));
    colors[i * 3 + 2] = Math.max(0, Math.min(1, c.b + v));
  }
  nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (!nonIndexed.attributes.uv) {
    nonIndexed.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

function buildCloudGeometry(puffCount: number, rng: () => number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < puffCount; i++) {
    const radius = 3.5 + rng() * 2.0;
    const geo = new THREE.IcosahedronGeometry(radius, 0);
    const pos = geo.attributes.position;

    // Distribute puffs horizontally around the central puff
    const angle = i === 0 ? 0 : ((i - 1) / (puffCount - 1)) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const dist = i === 0 ? 0 : 2.5 + rng() * 2.5;
    const offsetX = Math.cos(angle) * dist;
    const offsetY = (rng() - 0.5) * 1.2;
    const offsetZ = Math.sin(angle) * dist;

    for (let j = 0; j < pos.count; j++) {
      const vx = pos.getX(j) + (rng() - 0.5) * 1.0 + offsetX;
      const vy = (pos.getY(j) + (rng() - 0.5) * 0.8 + offsetY) * 0.75;
      const vz = pos.getZ(j) + (rng() - 0.5) * 1.0 + offsetZ;
      pos.setXYZ(j, vx, vy, vz);
    }

    const colors = new Float32Array(pos.count * 3);
    for (let j = 0; j < pos.count; j++) {
      const vy = pos.getY(j);
      const t = Math.max(0, Math.min(1, (vy + 2.5) / 5.0));
      const shade = 0.88 + 0.12 * t;
      colors[j * 3] = shade;
      colors[j * 3 + 1] = shade;
      colors[j * 3 + 2] = Math.min(1.0, shade + 0.04);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geos.push(geo);
  }

  const merged = mergeGeometries(geos, false);
  merged.computeVertexNormals();
  return merged;
}

function buildHorizonApronGeometry(rng: () => number): THREE.BufferGeometry {
  // Outer loops are coarse (M); the inner loop has one vertex per terrain edge vertex so the seam is exact.
  const M = 32;
  const INNER = HORIZON_APRON.inner;
  const STEP = TERRAIN_SIZE / TERRAIN_SEGMENTS;
  const positions: number[] = [];
  const indices: number[] = [];
  const loopStart: number[] = [];
  const theta0 = -Math.PI / 4;

  // Loop 0: the terrain's edge vertices, from (+inner, -inner) counter-clockwise (increasing z at x=+inner first).
  const edge: [number, number][] = [];
  const n = TERRAIN_SEGMENTS;
  for (let k = 0; k < n; k++) edge.push([INNER, -INNER + k * STEP]);
  for (let k = 0; k < n; k++) edge.push([INNER - k * STEP, INNER]);
  for (let k = 0; k < n; k++) edge.push([-INNER, INNER - k * STEP]);
  for (let k = 0; k < n; k++) edge.push([-INNER + k * STEP, -INNER]);
  loopStart.push(0);
  const innerAngles: number[] = [];
  for (const [x, z] of edge) {
    positions.push(x, getTerrainHeight(x, z), z);
    innerAngles.push((((Math.atan2(z, x) - theta0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
  }
  const innerLen = edge.length;

  const dir = (i: number) => {
    const theta = theta0 + (i / M) * Math.PI * 2;
    const c = Math.cos(theta), s = Math.sin(theta);
    return { theta, c, s, tIn: INNER / Math.max(Math.abs(c), Math.abs(s)) };
  };
  const addLoop = (f: (i: number, d: ReturnType<typeof dir>) => [number, number, number]) => {
    loopStart.push(positions.length / 3);
    for (let i = 0; i < M; i++) {
      const [x, y, z] = f(i, dir(i));
      positions.push(x, y, z);
    }
  };

  // Loop 1: flat shelf at terrain edge height, kept under the camera's reach
  // (camera stands up to 26 units outside the square, ~5 above ground).
  addLoop((_i, d) => {
    const x = INNER * Math.max(-1, Math.min(1, d.c / Math.max(Math.abs(d.c), Math.abs(d.s))));
    const z = INNER * Math.max(-1, Math.min(1, d.s / Math.max(Math.abs(d.c), Math.abs(d.s))));
    const r = d.tIn + 24.0;
    return [r * d.c, getTerrainHeight(x, z), r * d.s];
  });
  // Loop 2: first row of low jittered hills
  addLoop((i, d) => {
    const r1 = d.tIn + (HORIZON_APRON.outer - d.tIn) * 0.65 + (rng() - 0.5) * 4.0;
    const y0 = positions[(loopStart[1] + i) * 3 + 1];
    const y1 = Math.max(y0 + 6.0, 14.0) + (rng() * 8.0 + 4.0) * (1.0 + 0.3 * Math.sin(6 * d.theta));
    return [r1 * d.c, y1, r1 * d.s];
  });
  // Loop 3: second row of hills out to HORIZON_APRON.outer
  addLoop((i, d) => {
    const r2 = HORIZON_APRON.outer + (rng() - 0.5) * 3.0;
    const y1 = positions[(loopStart[2] + i) * 3 + 1];
    const y2 = y1 + 10.0 + (rng() * 12.0 + 6.0) * (1.0 + 0.3 * Math.cos(4 * d.theta));
    return [r2 * d.c, y2, r2 * d.s];
  });

  // Stitch the fine inner loop to the coarse shelf by walking both in angle order.
  {
    const a0 = 0, b0 = loopStart[1];
    let i = 0, j = 0;
    while (i < innerLen || j < M) {
      const nextInner = i < innerLen ? (i + 1 < innerLen ? innerAngles[i + 1] : Math.PI * 2) : Infinity;
      const nextOuter = j < M ? ((j + 1) / M) * Math.PI * 2 : Infinity;
      const a = a0 + (i % innerLen), b = b0 + (j % M);
      if (i < innerLen && (j >= M || nextInner <= nextOuter)) {
        indices.push(a, a0 + ((i + 1) % innerLen), b);
        i++;
      } else {
        indices.push(a, b0 + ((j + 1) % M), b);
        j++;
      }
    }
  }
  // Coarse quads between loops 1-2 and 2-3 (counter-clockwise winding)
  for (let r = 1; r < 3; r++) {
    for (let i = 0; i < M; i++) {
      const next = (i + 1) % M;
      const a = loopStart[r] + i, an = loopStart[r] + next, b = loopStart[r + 1] + i, bn = loopStart[r + 1] + next;
      indices.push(a, an, b);
      indices.push(an, bn, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildBoulderGeometry(t: Tint, radius: number, heightScale: number, jitter: number, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 0);
  jitterUnique(geo, [jitter, 0, jitter], rng);
  geo.scale(1, heightScale, 1);
  geo.translate(0, radius * 0.4, 0);
  return applyColorsAndNormals(geo, t.base, t.top, 0.05, rng);
}

function buildBushGeometry(t: Tint, radius: number, heightScale: number, jitter: number, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(radius, 0);
  jitterUnique(geo, [jitter, 0, jitter], rng);
  geo.scale(1, heightScale, 1);
  geo.translate(0, radius * 0.5, 0);
  return applyColorsAndNormals(geo, t.base, t.top, 0.05, rng);
}

function buildFernGeometry(t: Tint, rng: () => number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let k = 0; k < 5; k++) {
    const angle = (k / 5) * Math.PI * 2 + (rng() - 0.5) * 0.2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = -sin;
    const nz = cos;
    const w = 0.08;
    const len = 0.45;
    const h = 0.55;
    const mx = cos * len * 0.5;
    const mz = sin * len * 0.5;
    const tx = cos * len;
    const tz = sin * len;
    positions.push(0, 0.02, 0, mx - nx * w, h, mz - nz * w, mx + nx * w, h, mz + nz * w);
    positions.push(mx - nx * w, h, mz - nz * w, tx, h * 0.5, tz, mx + nx * w, h, mz + nz * w);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return applyColorsAndNormals(geo, t.base, t.top, 0.04, rng);
}

function buildReedGeometry(t: Tint, rng: () => number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let k = 0; k < 5; k++) {
    const ox = (rng() - 0.5) * 0.2;
    const oz = (rng() - 0.5) * 0.2;
    // Tallest blade 0.98: at the scatter's largest reed scale (1.17) it stays under maxHeight 1.2.
    const h = 0.8 + rng() * 0.18;
    const w = 0.035;
    const angle = rng() * Math.PI * 2;
    const nx = Math.cos(angle) * w;
    const nz = Math.sin(angle) * w;
    positions.push(ox - nx, 0, oz - nz, ox + nx, 0, oz + nz, ox - nx * 0.3, h * 0.6, oz - nz * 0.3);
    positions.push(ox + nx, 0, oz + nz, ox, h, oz, ox - nx * 0.3, h * 0.6, oz - nz * 0.3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return applyColorsAndNormals(geo, t.base, t.top, 0.04, rng);
}

function buildLogGeometry(t: Tint, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.2, 0.24, 1.3, 6);
  geo.rotateZ(Math.PI / 2);
  geo.translate(0, 0.2, 0);
  return applyColorsAndNormals(geo, t.base, t.top, 0.04, rng);
}

function buildSnagGeometry(t: Tint, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.18, 0.42, 3.8, 6);
  geo.translate(0, 1.9, 0);
  jitterUnique(geo, [0, 0.4, 0], rng, (y) => y > 3.5);
  return applyColorsAndNormals(geo, t.base, t.top, 0.04, rng);
}

function buildSaplingGeometry(t: Tint, rng: () => number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.04, 0.07, 0.6, 5);
  trunk.translate(0, 0.3, 0);
  const tCol = applyColorsAndNormals(trunk, t.base, t.top, 0.03, rng);
  const crown = new THREE.ConeGeometry(0.35, 0.45, 5);
  crown.translate(0, 0.775, 0);
  const cCol = applyColorsAndNormals(crown, t.accentBase, t.accentTop, 0.04, rng);
  const merged = mergeGeometries([tCol, cCol], false);
  merged.computeVertexNormals();
  return merged;
}

function buildMushroomsGeometry(t: Tint, rng: () => number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  // Tallest cap tip 0.325: at the scatter's largest scale (1.2) it stays under maxHeight 0.4.
  const coords = [
    [0, 0, 0.245, 0.12],
    [-0.15, 0.12, 0.196, 0.1],
    [0.12, -0.1, 0.154, 0.08],
  ];
  for (const [x, z, h, r] of coords) {
    const stem = new THREE.CylinderGeometry(0.02, 0.03, h, 3, 1, true);
    stem.translate(x, h * 0.5, z);
    const stemCol = applyColorsAndNormals(stem, t.base, t.top, 0.02, rng);
    const cap = new THREE.ConeGeometry(r, h * 0.45, 4, 1, true);
    cap.translate(x, h + h * 0.1, z);
    const capCol = applyColorsAndNormals(cap, t.accentBase, t.accentTop, 0.04, rng);
    geos.push(stemCol, capCol);
  }
  const merged = mergeGeometries(geos, false);
  merged.computeVertexNormals();
  return merged;
}

function buildBackdropTreeAGeometry(t: Tint, rng: () => number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.28, 0.42, 4.5, 6);
  trunk.translate(0, 2.25, 0);
  const tCol = applyColorsAndNormals(trunk, t.base, t.top, 0.04, rng);
  const crown = new THREE.DodecahedronGeometry(1.6, 0);
  crown.scale(1.1, 1.4, 1.1);
  crown.translate(0, 5.8, 0);
  jitterUnique(crown, [0.4, 0.4, 0.4], rng);
  const cCol = applyColorsAndNormals(crown, t.accentBase, t.accentTop, 0.05, rng);
  const merged = mergeGeometries([tCol, cCol], false);
  merged.scale(0.88, 0.88, 0.88); // top 8.09 -> 7.12: stays under maxHeight 9 at the largest scatter scale (1.2)
  merged.computeVertexNormals();
  return merged;
}

function buildBackdropTreeBGeometry(t: Tint, rng: () => number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.3, 0.45, 5.0, 6);
  trunk.translate(0, 2.5, 0);
  const parts = [applyColorsAndNormals(trunk, t.base, t.top, 0.04, rng)];
  for (const [r, h, y] of [
    [1.8, 3.2, 4.8],
    [1.4, 3.0, 6.8],
    [0.9, 2.8, 8.8],
  ]) {
    const cone = new THREE.ConeGeometry(r, h, 6);
    cone.translate(0, y, 0);
    jitterUnique(cone, [0.3, 0.2, 0.3], rng);
    parts.push(applyColorsAndNormals(cone, t.accentBase, t.accentTop, 0.04, rng));
  }
  const merged = mergeGeometries(parts, false);
  merged.scale(0.88, 0.88, 0.88); // top 10.2 -> 8.98: stays under maxHeight 11 at the largest scatter scale (1.2)
  merged.computeVertexNormals();
  return merged;
}

function buildCragGeometry(t: Tint, rTop: number, rBottom: number, height: number, radialSegs: number, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, radialSegs, 1);
  geo.translate(0, height * 0.5, 0);
  jitterUnique(geo, [0.15, 0.15, 0.15], rng);
  return applyColorsAndNormals(geo, t.base, t.top, 0.06, rng);
}

// Trunk radii rBottom/rTop times the instance scale (0.92 to 1.08) stay inside design 6.11's 0.30 to 0.42.
// The upper crown cone rises far enough above the trunk top that its (aligned hexagonal) section there is wider than the trunk.
function buildWoodsTreeGeometry(
  t: Tint,
  rBottom: number,
  rTop: number,
  height: number,
  crownBaseY: number,
  crownR1: number,
  crownR2: number,
  rng: () => number
): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(rTop, rBottom, height, 6);
  trunk.translate(0, height * 0.5, 0);
  const tCol = applyColorsAndNormals(trunk, t.base, t.top, 0.04, rng);

  // Crown colours: the wood family's crown tint, darkened so it reads darker and less saturated than a harvestable tree.
  // Darkened in sRGB: three's offsetHSL works in linear space, where -0.04 turns the crown black.
  const hsl = { h: 0, s: 0, l: 0 };
  const dark = (hex: string, l: number) => {
    const c = new THREE.Color(hex);
    c.getHSL(hsl, THREE.SRGBColorSpace);
    return c.setHSL(hsl.h, Math.max(0, hsl.s - 0.04), Math.max(0, hsl.l + l), THREE.SRGBColorSpace);
  };
  const h1 = (height - crownBaseY) * 0.65;
  const c1 = new THREE.ConeGeometry(crownR1, h1, 6);
  c1.translate(0, crownBaseY + h1 * 0.5, 0);
  const c1Col = applyColorsAndNormals(c1, dark(t.accentBase, -0.04), dark(t.accentTop, -0.04), 0.04, rng);

  const h2 = (height - crownBaseY) * 0.6;
  const apex = height + (h2 * rTop * 1.1) / crownR2;
  const c2 = new THREE.ConeGeometry(crownR2, h2, 6);
  c2.translate(0, apex - h2 * 0.5, 0);
  const c2Col = applyColorsAndNormals(c2, dark(t.accentBase, -0.02), dark(t.accentTop, -0.02), 0.04, rng);

  const merged = mergeGeometries([tCol, c1Col, c2Col], false);
  merged.computeVertexNormals();
  return merged;
}

export function buildKitPiece(id: string, rng: () => number): THREE.BufferGeometry {
  switch (id) {
    case 'cloud_a':
      return buildCloudGeometry(3, rng);
    case 'cloud_b':
      return buildCloudGeometry(4, rng);
    case 'cloud_c':
      return buildCloudGeometry(5, rng);
    case 'horizon_apron':
      return buildHorizonApronGeometry(rng);
    case 'boulder_s':
      return buildBoulderGeometry(TINTS[KIT_PIECES[id].tintFamily], 0.35, 0.7, 0.08, rng);
    case 'boulder_m':
      return buildBoulderGeometry(TINTS[KIT_PIECES[id].tintFamily], 0.6, 0.7, 0.12, rng);
    case 'boulder_l':
      return buildBoulderGeometry(TINTS[KIT_PIECES[id].tintFamily], 0.85, 0.75, 0.16, rng);
    case 'bush_a':
      return buildBushGeometry(TINTS[KIT_PIECES[id].tintFamily], 0.65, 0.75, 0.12, rng);
    case 'bush_b':
      return buildBushGeometry(TINTS[KIT_PIECES[id].tintFamily], 0.77, 0.72, 0.15, rng);
    case 'fern':
      return buildFernGeometry(TINTS[KIT_PIECES[id].tintFamily], rng);
    case 'reed':
      return buildReedGeometry(TINTS[KIT_PIECES[id].tintFamily], rng);
    case 'log':
      return buildLogGeometry(TINTS[KIT_PIECES[id].tintFamily], rng);
    case 'snag':
      return buildSnagGeometry(TINTS[KIT_PIECES[id].tintFamily], rng);
    case 'sapling':
      return buildSaplingGeometry(TINTS[KIT_PIECES[id].tintFamily], rng);
    case 'mushrooms':
      return buildMushroomsGeometry(TINTS[KIT_PIECES[id].tintFamily], rng);
    case 'backdrop_tree_a':
      return buildBackdropTreeAGeometry(TINTS[KIT_PIECES[id].tintFamily], rng);
    case 'backdrop_tree_b':
      return buildBackdropTreeBGeometry(TINTS[KIT_PIECES[id].tintFamily], rng);
    case 'crag_a':
      return buildCragGeometry(TINTS[KIT_PIECES[id].tintFamily], 0.4, 1.2, 4.6, 5, rng);
    case 'crag_b':
      return buildCragGeometry(TINTS[KIT_PIECES[id].tintFamily], 0.5, 1.5, 6.2, 6, rng);
    case 'woods_tree_a':
      return buildWoodsTreeGeometry(TINTS.wood, 0.38, 0.33, 8.5, 3.5, 1.25, 0.95, rng);
    case 'woods_tree_b':
      return buildWoodsTreeGeometry(TINTS.wood, 0.385, 0.335, 9.0, 3.6, 1.3, 1.0, rng);
    default:
      throw new Error(`Unknown kit piece: ${id}`);
  }
}
