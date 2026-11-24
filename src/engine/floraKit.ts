import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HORIZON_APRON } from '../data/look';
import { getTerrainHeight } from '../state/terrain';

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
  const M = 180;
  const positions: number[] = [];
  const indices: number[] = [];

  // Loop 0: Inner boundary following the terrain's square edge at HORIZON_APRON.inner (130)
  for (let i = 0; i < M; i++) {
    const theta = (i / M) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const absCos = Math.abs(cosT);
    const absSin = Math.abs(sinT);
    const tInner = Math.min(
      absCos > 1e-6 ? HORIZON_APRON.inner / absCos : Infinity,
      absSin > 1e-6 ? HORIZON_APRON.inner / absSin : Infinity
    );
    const x0 = Math.max(-HORIZON_APRON.inner, Math.min(HORIZON_APRON.inner, tInner * cosT));
    const z0 = Math.max(-HORIZON_APRON.inner, Math.min(HORIZON_APRON.inner, tInner * sinT));
    const y0 = getTerrainHeight(x0, z0);
    positions.push(x0, y0, z0);
  }

  // Loop 1: First row of low jittered hills
  for (let i = 0; i < M; i++) {
    const theta = (i / M) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const absCos = Math.abs(cosT);
    const absSin = Math.abs(sinT);
    const tInner = Math.min(
      absCos > 1e-6 ? HORIZON_APRON.inner / absCos : Infinity,
      absSin > 1e-6 ? HORIZON_APRON.inner / absSin : Infinity
    );
    const r1 = tInner + (HORIZON_APRON.outer - tInner) * 0.45 + (rng() - 0.5) * 4.0;
    const x1 = r1 * cosT;
    const z1 = r1 * sinT;
    const y0 = positions[i * 3 + 1];
    const y1 = Math.max(y0 + 6.0, 14.0) + (rng() * 8.0 + 4.0) * (1.0 + 0.3 * Math.sin(6 * theta));
    positions.push(x1, y1, z1);
  }

  // Loop 2: Second row of hills out to HORIZON_APRON.outer (240)
  for (let i = 0; i < M; i++) {
    const theta = (i / M) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const r2 = HORIZON_APRON.outer + (rng() - 0.5) * 3.0;
    const x2 = r2 * cosT;
    const z2 = r2 * sinT;
    const y1 = positions[(M + i) * 3 + 1];
    const y2 = y1 + 10.0 + (rng() * 12.0 + 6.0) * (1.0 + 0.3 * Math.cos(4 * theta));
    positions.push(x2, y2, z2);
  }

  // Quads connecting Loop 0 to Loop 1, and Loop 1 to Loop 2 (counter-clockwise winding)
  for (let i = 0; i < M; i++) {
    const next = (i + 1) % M;
    indices.push(i, next, M + i);
    indices.push(next, M + next, M + i);

    indices.push(M + i, M + next, 2 * M + i);
    indices.push(M + next, 2 * M + next, 2 * M + i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(M * 3 * 2), 2));
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
