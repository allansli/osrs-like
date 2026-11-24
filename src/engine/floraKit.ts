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
    default:
      throw new Error(`Unknown kit piece: ${id}`);
  }
}
