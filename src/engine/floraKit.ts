import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HORIZON_APRON } from '../data/look';
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

function applyColorsAndNormals(
  geo: THREE.BufferGeometry,
  baseHex: string,
  topHex?: string,
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
  const M = 32;
  const INNER = HORIZON_APRON.inner;
  const STEP = TERRAIN_SIZE / TERRAIN_SEGMENTS;
  const positions: number[] = [];
  const indices: number[] = [];
  const loopStart: number[] = [];
  const theta0 = -Math.PI / 4;

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
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return { theta, c, s, tIn: INNER / Math.max(Math.abs(c), Math.abs(s)) };
  };
  const addLoop = (f: (i: number, d: ReturnType<typeof dir>) => [number, number, number]) => {
    loopStart.push(positions.length / 3);
    for (let i = 0; i < M; i++) {
      const [x, y, z] = f(i, dir(i));
      positions.push(x, y, z);
    }
  };

  addLoop((_i, d) => {
    const x = INNER * Math.max(-1, Math.min(1, d.c / Math.max(Math.abs(d.c), Math.abs(d.s))));
    const z = INNER * Math.max(-1, Math.min(1, d.s / Math.max(Math.abs(d.c), Math.abs(d.s))));
    const r = d.tIn + 24.0;
    return [r * d.c, getTerrainHeight(x, z), r * d.s];
  });
  addLoop((i, d) => {
    const r1 = d.tIn + (HORIZON_APRON.outer - d.tIn) * 0.65 + (rng() - 0.5) * 4.0;
    const y0 = positions[(loopStart[1] + i) * 3 + 1];
    const y1 = Math.max(y0 + 6.0, 14.0) + (rng() * 8.0 + 4.0) * (1.0 + 0.3 * Math.sin(6 * d.theta));
    return [r1 * d.c, y1, r1 * d.s];
  });
  addLoop((i, d) => {
    const r2 = HORIZON_APRON.outer + (rng() - 0.5) * 3.0;
    const y1 = positions[(loopStart[2] + i) * 3 + 1];
    const y2 = y1 + 10.0 + (rng() * 12.0 + 6.0) * (1.0 + 0.3 * Math.cos(4 * d.theta));
    return [r2 * d.c, y2, r2 * d.s];
  });

  {
    const a0 = 0;
    const b0 = loopStart[1];
    let i = 0;
    let j = 0;
    while (i < innerLen || j < M) {
      const nextInner = i < innerLen ? (i + 1 < innerLen ? innerAngles[i + 1] : Math.PI * 2) : Infinity;
      const nextOuter = j < M ? ((j + 1) / M) * Math.PI * 2 : Infinity;
      const a = a0 + (i % innerLen);
      const b = b0 + (j % M);
      if (i < innerLen && (j >= M || nextInner <= nextOuter)) {
        indices.push(a, a0 + ((i + 1) % innerLen), b);
        i++;
      } else {
        indices.push(a, b0 + ((j + 1) % M), b);
        j++;
      }
    }
  }
  for (let r = 1; r < 3; r++) {
    for (let i = 0; i < M; i++) {
      const next = (i + 1) % M;
      const a = loopStart[r] + i;
      const an = loopStart[r] + next;
      const b = loopStart[r + 1] + i;
      const bn = loopStart[r + 1] + next;
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

function buildBoulderGeometry(radius: number, heightScale: number, jitter: number, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (rng() - 0.5) * jitter,
      pos.getY(i) * heightScale + radius * 0.4,
      pos.getZ(i) + (rng() - 0.5) * jitter
    );
  }
  return applyColorsAndNormals(geo, '#4d555e', '#626c78', 0.05, rng);
}

function buildBushGeometry(radius: number, heightScale: number, jitter: number, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(radius, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (rng() - 0.5) * jitter,
      pos.getY(i) * heightScale + radius * 0.5,
      pos.getZ(i) + (rng() - 0.5) * jitter
    );
  }
  return applyColorsAndNormals(geo, '#35472e', '#4d6342', 0.05, rng);
}

function buildFernGeometry(rng: () => number): THREE.BufferGeometry {
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
  return applyColorsAndNormals(geo, '#2b4028', '#44663e', 0.04, rng);
}

function buildReedGeometry(rng: () => number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let k = 0; k < 5; k++) {
    const ox = (rng() - 0.5) * 0.2;
    const oz = (rng() - 0.5) * 0.2;
    const h = 0.95 + rng() * 0.22;
    const w = 0.035;
    const angle = rng() * Math.PI * 2;
    const nx = Math.cos(angle) * w;
    const nz = Math.sin(angle) * w;
    positions.push(ox - nx, 0, oz - nz, ox + nx, 0, oz + nz, ox - nx * 0.3, h * 0.6, oz - nz * 0.3);
    positions.push(ox + nx, 0, oz + nz, ox, h, oz, ox - nx * 0.3, h * 0.6, oz - nz * 0.3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return applyColorsAndNormals(geo, '#384d2a', '#5c6e3b', 0.04, rng);
}

function buildLogGeometry(rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.2, 0.24, 1.3, 6);
  geo.rotateZ(Math.PI / 2);
  geo.translate(0, 0.2, 0);
  return applyColorsAndNormals(geo, '#423326', '#6b543e', 0.04, rng);
}

function buildSnagGeometry(rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.18, 0.42, 3.8, 6);
  geo.translate(0, 1.9, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 3.5) {
      pos.setY(i, pos.getY(i) + (rng() - 0.5) * 0.4);
    }
  }
  return applyColorsAndNormals(geo, '#473f38', '#5e544a', 0.04, rng);
}

function buildSaplingGeometry(rng: () => number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.04, 0.07, 0.7, 5);
  trunk.translate(0, 0.35, 0);
  const tCol = applyColorsAndNormals(trunk, '#4a382c', '#5e4638', 0.03, rng);
  const crown = new THREE.ConeGeometry(0.35, 0.55, 5);
  crown.translate(0, 0.85, 0);
  const cCol = applyColorsAndNormals(crown, '#3f5932', '#527342', 0.04, rng);
  const merged = mergeGeometries([tCol, cCol], false);
  merged.computeVertexNormals();
  return merged;
}

function buildMushroomsGeometry(rng: () => number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const coords = [
    [0, 0, 0.35, 0.12],
    [-0.15, 0.12, 0.28, 0.1],
    [0.12, -0.1, 0.22, 0.08],
  ];
  for (const [x, z, h, r] of coords) {
    const stem = new THREE.CylinderGeometry(0.02, 0.03, h, 3, 1, true);
    stem.translate(x, h * 0.5, z);
    const stemCol = applyColorsAndNormals(stem, '#d4cdb8', '#e2dcc8', 0.02, rng);
    const cap = new THREE.ConeGeometry(r, h * 0.45, 4, 1, true);
    cap.translate(x, h + h * 0.1, z);
    const capCol = applyColorsAndNormals(cap, '#8c3e23', '#aa4e2d', 0.04, rng);
    geos.push(stemCol, capCol);
  }
  const merged = mergeGeometries(geos, false);
  merged.computeVertexNormals();
  return merged;
}

function buildBackdropTreeAGeometry(rng: () => number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.28, 0.42, 4.5, 6);
  trunk.translate(0, 2.25, 0);
  const tCol = applyColorsAndNormals(trunk, '#3d2e24', '#4d3b2e', 0.04, rng);
  const crown = new THREE.DodecahedronGeometry(1.6, 0);
  crown.scale(1.1, 1.4, 1.1);
  crown.translate(0, 5.8, 0);
  const cCol = applyColorsAndNormals(crown, '#283e26', '#3b5437', 0.05, rng);
  const merged = mergeGeometries([tCol, cCol], false);
  merged.computeVertexNormals();
  return merged;
}

function buildBackdropTreeBGeometry(rng: () => number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.3, 0.45, 5.0, 6);
  trunk.translate(0, 2.5, 0);
  const tCol = applyColorsAndNormals(trunk, '#3d2e24', '#4d3b2e', 0.04, rng);
  const c1 = new THREE.ConeGeometry(1.8, 3.2, 6);
  c1.translate(0, 4.8, 0);
  const c1Col = applyColorsAndNormals(c1, '#1e3322', '#28422c', 0.04, rng);
  const c2 = new THREE.ConeGeometry(1.4, 3.0, 6);
  c2.translate(0, 6.8, 0);
  const c2Col = applyColorsAndNormals(c2, '#223826', '#2d4a32', 0.04, rng);
  const c3 = new THREE.ConeGeometry(0.9, 2.8, 6);
  c3.translate(0, 8.8, 0);
  const c3Col = applyColorsAndNormals(c3, '#263e2a', '#325238', 0.04, rng);
  const merged = mergeGeometries([tCol, c1Col, c2Col, c3Col], false);
  merged.computeVertexNormals();
  return merged;
}

function buildCragGeometry(rTop: number, rBottom: number, height: number, radialSegs: number, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, radialSegs, 1);
  geo.translate(0, height * 0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (rng() - 0.5) * 0.15,
      pos.getY(i) + (rng() - 0.5) * 0.15,
      pos.getZ(i) + (rng() - 0.5) * 0.15
    );
  }
  return applyColorsAndNormals(geo, '#4c5561', '#5e6875', 0.06, rng);
}

function buildWoodsTreeGeometry(
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
  const tCol = applyColorsAndNormals(trunk, '#362a22', '#46372d', 0.04, rng);

  const h1 = (height - crownBaseY) * 0.65;
  const c1 = new THREE.ConeGeometry(crownR1, h1, 6);
  c1.translate(0, crownBaseY + h1 * 0.5, 0);
  const c1Col = applyColorsAndNormals(c1, '#223124', '#2c3c2e', 0.04, rng);

  const h2 = (height - crownBaseY) * 0.6;
  const c2 = new THREE.ConeGeometry(crownR2, h2, 6);
  c2.translate(0, crownBaseY + h1 * 0.5 + h2 * 0.5, 0);
  const c2Col = applyColorsAndNormals(c2, '#263729', '#324535', 0.04, rng);

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
      return buildBoulderGeometry(0.35, 0.7, 0.08, rng);
    case 'boulder_m':
      return buildBoulderGeometry(0.6, 0.7, 0.12, rng);
    case 'boulder_l':
      return buildBoulderGeometry(0.85, 0.75, 0.16, rng);
    case 'bush_a':
      return buildBushGeometry(0.65, 0.75, 0.12, rng);
    case 'bush_b':
      return buildBushGeometry(0.85, 0.72, 0.15, rng);
    case 'fern':
      return buildFernGeometry(rng);
    case 'reed':
      return buildReedGeometry(rng);
    case 'log':
      return buildLogGeometry(rng);
    case 'snag':
      return buildSnagGeometry(rng);
    case 'sapling':
      return buildSaplingGeometry(rng);
    case 'mushrooms':
      return buildMushroomsGeometry(rng);
    case 'backdrop_tree_a':
      return buildBackdropTreeAGeometry(rng);
    case 'backdrop_tree_b':
      return buildBackdropTreeBGeometry(rng);
    case 'crag_a':
      return buildCragGeometry(0.4, 1.2, 5.5, 5, rng);
    case 'crag_b':
      return buildCragGeometry(0.5, 1.5, 7.5, 6, rng);
    case 'woods_tree_a':
      return buildWoodsTreeGeometry(0.38, 0.32, 8.5, 3.5, 1.25, 0.95, rng);
    case 'woods_tree_b':
      return buildWoodsTreeGeometry(0.41, 0.34, 10.0, 3.6, 1.3, 1.0, rng);
    default:
      throw new Error(`Unknown kit piece: ${id}`);
  }
}
