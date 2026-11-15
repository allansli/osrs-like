import * as THREE from 'three';
import { ATTACKS } from '../data/attacks';
import type { Shape } from '../data/attacks';
import { shapeOutline } from '../state/telegraph';
import { getTerrainHeight } from '../state/terrain';
import { disposeObject3D } from './dispose';
import { G } from './context';
import type { MonsterEntity } from './context';

export interface TelegraphInstance {
  monster: MonsterEntity;
  group: THREE.Group;
  haloMesh: THREE.Mesh;
  outlineMesh: THREE.Mesh;
  fillMesh: THREE.Mesh;
  durationSecs: number;
  progress: number;
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  baseCoords: number[];
}

const activeTelegraphs = new Set<TelegraphInstance>();

function localToWorld(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  lx: number,
  lz: number
): [number, number] {
  return [
    ox + lx * dz + lz * dx,
    oz - lx * dx + lz * dz
  ];
}

function subdivideLocalLoop(loop: Array<[number, number]>, maxLen = 1.0): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (let i = 0; i < loop.length - 1; i++) {
    const a = loop[i];
    const b = loop[i + 1];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(d / maxLen));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  result.push([loop[loop.length - 1][0], loop[loop.length - 1][1]]);
  return result;
}

function buildCircleFillData(radius: number): { baseCoords: number[]; indices: number[] } {
  const baseCoords: number[] = [0, 0];
  const indices: number[] = [];
  const nr = Math.max(2, Math.ceil(radius / 1.0));
  const nTheta = Math.max(12, Math.ceil((2 * Math.PI * radius) / 1.0));

  for (let rIdx = 1; rIdx <= nr; rIdx++) {
    const r = (rIdx / nr) * radius;
    for (let tIdx = 0; tIdx < nTheta; tIdx++) {
      const theta = (tIdx / nTheta) * 2 * Math.PI;
      baseCoords.push(r * Math.sin(theta), r * Math.cos(theta));
    }
  }

  for (let tIdx = 0; tIdx < nTheta; tIdx++) {
    const nextT = (tIdx + 1) % nTheta;
    indices.push(0, 1 + tIdx, 1 + nextT);
  }

  for (let rIdx = 1; rIdx < nr; rIdx++) {
    const rowA = 1 + (rIdx - 1) * nTheta;
    const rowB = 1 + rIdx * nTheta;
    for (let tIdx = 0; tIdx < nTheta; tIdx++) {
      const nextT = (tIdx + 1) % nTheta;
      const a1 = rowA + tIdx;
      const a2 = rowA + nextT;
      const b1 = rowB + tIdx;
      const b2 = rowB + nextT;
      indices.push(a1, b1, a2, a2, b1, b2);
    }
  }

  return { baseCoords, indices };
}

function buildConeFillData(length: number, halfAngleDeg: number): { baseCoords: number[]; indices: number[] } {
  const baseCoords: number[] = [0, 0];
  const indices: number[] = [];
  const halfRad = (halfAngleDeg * Math.PI) / 180;
  const nr = Math.max(2, Math.ceil(length / 1.0));
  const arcLen = 2 * halfRad * length;
  const nTheta = Math.max(4, Math.ceil(arcLen / 1.0));
  const cols = nTheta + 1;

  for (let rIdx = 1; rIdx <= nr; rIdx++) {
    const r = (rIdx / nr) * length;
    for (let tIdx = 0; tIdx < cols; tIdx++) {
      const theta = -halfRad + (tIdx / nTheta) * (2 * halfRad);
      baseCoords.push(r * Math.sin(theta), r * Math.cos(theta));
    }
  }

  for (let tIdx = 0; tIdx < nTheta; tIdx++) {
    indices.push(0, 1 + tIdx, 1 + tIdx + 1);
  }

  for (let rIdx = 1; rIdx < nr; rIdx++) {
    const rowA = 1 + (rIdx - 1) * cols;
    const rowB = 1 + rIdx * cols;
    for (let tIdx = 0; tIdx < nTheta; tIdx++) {
      const a1 = rowA + tIdx;
      const a2 = rowA + tIdx + 1;
      const b1 = rowB + tIdx;
      const b2 = rowB + tIdx + 1;
      indices.push(a1, b1, a2, a2, b1, b2);
    }
  }

  return { baseCoords, indices };
}

function buildLineFillData(length: number, halfWidth: number): { baseCoords: number[]; indices: number[] } {
  const baseCoords: number[] = [];
  const indices: number[] = [];
  const nx = Math.max(2, Math.ceil((2 * halfWidth) / 1.0));
  const nz = Math.max(2, Math.ceil(length / 1.0));
  const cols = nx + 1;

  for (let iz = 0; iz <= nz; iz++) {
    const lz = (iz / nz) * length;
    for (let ix = 0; ix <= nx; ix++) {
      const lx = -halfWidth + (ix / nx) * (2 * halfWidth);
      baseCoords.push(lx, lz);
    }
  }

  for (let iz = 0; iz < nz; iz++) {
    const rowA = iz * cols;
    const rowB = (iz + 1) * cols;
    for (let ix = 0; ix < nx; ix++) {
      const a1 = rowA + ix;
      const a2 = rowA + ix + 1;
      const b1 = rowB + ix;
      const b2 = rowB + ix + 1;
      indices.push(a1, b1, a2, a2, b1, b2);
    }
  }

  return { baseCoords, indices };
}

function buildRingFillData(inner: number, outer: number): { baseCoords: number[]; indices: number[] } {
  const baseCoords: number[] = [];
  const indices: number[] = [];
  const nr = Math.max(2, Math.ceil((outer - inner) / 1.0));
  const nTheta = Math.max(16, Math.ceil((2 * Math.PI * outer) / 1.0));

  for (let rIdx = 0; rIdx <= nr; rIdx++) {
    const r = inner + (rIdx / nr) * (outer - inner);
    for (let tIdx = 0; tIdx < nTheta; tIdx++) {
      const theta = (tIdx / nTheta) * 2 * Math.PI;
      baseCoords.push(r * Math.sin(theta), r * Math.cos(theta));
    }
  }

  for (let rIdx = 0; rIdx < nr; rIdx++) {
    const rowA = rIdx * nTheta;
    const rowB = (rIdx + 1) * nTheta;
    for (let tIdx = 0; tIdx < nTheta; tIdx++) {
      const nextT = (tIdx + 1) % nTheta;
      const a1 = rowA + tIdx;
      const a2 = rowA + nextT;
      const b1 = rowB + tIdx;
      const b2 = rowB + nextT;
      indices.push(a1, b1, a2, a2, b1, b2);
    }
  }

  return { baseCoords, indices };
}

function buildFillData(shape: Shape): { baseCoords: number[]; indices: number[] } {
  switch (shape.type) {
    case 'circle':
      return buildCircleFillData(shape.radius);
    case 'cone':
      return buildConeFillData(shape.length, shape.halfAngleDeg);
    case 'line':
      return buildLineFillData(shape.length, shape.halfWidth);
    case 'ring':
      return buildRingFillData(shape.inner, shape.outer);
  }
}

function updateTelegraphProgress(t: TelegraphInstance, p: number): void {
  const posAttr = t.fillMesh.geometry.attributes.position;
  const arr = posAttr.array as Float32Array;
  const { ox, oz, dx, dz, baseCoords } = t;

  for (let i = 0; i < baseCoords.length; i += 2) {
    const lx = p * baseCoords[i];
    const lz = p * baseCoords[i + 1];
    const wx = ox + lx * dz + lz * dx;
    const wz = oz - lx * dx + lz * dz;
    const wy = getTerrainHeight(wx, wz) + 0.06;
    const idx = (i / 2) * 3;
    arr[idx] = wx;
    arr[idx + 1] = wy;
    arr[idx + 2] = wz;
  }
  posAttr.needsUpdate = true;
  t.fillMesh.visible = p > 0.001;
}

// Triangle band of half-width hw around every outline loop, lifted onto the terrain.
function buildBandGeometry(
  rawLoops: Array<Array<[number, number]>>,
  event: { ox: number; oz: number; dx: number; dz: number },
  hw: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (const rawLoop of rawLoops) {
    const subLoop = subdivideLocalLoop(rawLoop, 1.0);
    const worldLoop = subLoop.map(p => localToWorld(event.ox, event.oz, event.dx, event.dz, p[0], p[1]));
    const N = worldLoop.length - 1;
    if (N < 2) continue;

    const loopStartIndex = positions.length / 3;

    for (let i = 0; i < N; i++) {
      const cur = worldLoop[i];
      const prev = worldLoop[(i - 1 + N) % N];
      const next = worldLoop[(i + 1) % N];

      const inX = cur[0] - prev[0];
      const inZ = cur[1] - prev[1];
      const inLen = Math.hypot(inX, inZ);
      const n1X = -inZ / inLen;
      const n1Z = inX / inLen;

      const outX = next[0] - cur[0];
      const outZ = next[1] - cur[1];
      const outLen = Math.hypot(outX, outZ);
      const n2X = -outZ / outLen;
      const n2Z = outX / outLen;

      let mX = n1X + n2X;
      let mZ = n1Z + n2Z;
      const mLen = Math.hypot(mX, mZ);
      if (mLen > 1e-4) {
        mX /= mLen;
        mZ /= mLen;
      } else {
        mX = n1X;
        mZ = n1Z;
      }

      const dot = mX * n1X + mZ * n1Z;
      const scale = dot > 0.1 ? Math.min(2, 1 / dot) : 1;
      const w = hw * scale;

      const lx = cur[0] + mX * w;
      const lz = cur[1] + mZ * w;
      const rx = cur[0] - mX * w;
      const rz = cur[1] - mZ * w;
      positions.push(lx, getTerrainHeight(lx, lz) + 0.06, lz);
      positions.push(rx, getTerrainHeight(rx, rz) + 0.06, rz);
    }

    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const a1 = loopStartIndex + i * 2;
      const a2 = a1 + 1;
      const b1 = loopStartIndex + next * 2;
      const b2 = b1 + 1;
      indices.push(a1, a2, b1, b1, a2, b2);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  return geom;
}

export function showTelegraph(
  monster: MonsterEntity,
  event: { kind: 'windup'; attackId: string; ox: number; oz: number; dx: number; dz: number; ms: number }
): void {
  if (monster.telegraph) {
    clearTelegraph(monster);
  }

  const attack = ATTACKS[event.attackId];

  const shape = attack.shape;
  const rawLoops = shapeOutline(shape, 64);

  const outlineGeom = buildBandGeometry(rawLoops, event, 0.11);
  const haloGeom = buildBandGeometry(rawLoops, event, 0.11 + 0.12);

  // Halo and band ignore depth so a canopy or a prop never hides the edge; the halo is drawn first.
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x140a08,
    transparent: true,
    opacity: 0.75,
    fog: false,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const haloMesh = new THREE.Mesh(haloGeom, haloMat);
  haloMesh.renderOrder = 998;

  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.85,
    fog: false,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const outlineMesh = new THREE.Mesh(outlineGeom, outlineMat);
  outlineMesh.renderOrder = 999;

  // Build fill mesh
  const fillData = buildFillData(shape);
  const fillGeom = new THREE.BufferGeometry();
  const numVertices = fillData.baseCoords.length / 2;
  const fillPositions = new Float32Array(numVertices * 3);
  fillGeom.setAttribute('position', new THREE.BufferAttribute(fillPositions, 3));
  fillGeom.setIndex(fillData.indices);

  const fillMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.35,
    fog: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide
  });

  const fillMesh = new THREE.Mesh(fillGeom, fillMat);
  fillMesh.visible = false;

  const group = new THREE.Group();
  group.add(haloMesh);
  group.add(outlineMesh);
  group.add(fillMesh);

  G.scene.add(group);

  const durationSecs = event.ms / 1000;
  const instance: TelegraphInstance = {
    monster,
    group,
    haloMesh,
    outlineMesh,
    fillMesh,
    durationSecs,
    progress: 0,
    ox: event.ox,
    oz: event.oz,
    dx: event.dx,
    dz: event.dz,
    baseCoords: fillData.baseCoords
  };

  monster.telegraph = instance;
  activeTelegraphs.add(instance);
  updateTelegraphProgress(instance, 0);
}

export function updateTelegraphs(dt: number): void {
  for (const t of activeTelegraphs) {
    t.progress = Math.min(1, t.progress + dt / t.durationSecs);
    updateTelegraphProgress(t, t.progress);
  }
}

export function clearTelegraph(monster: MonsterEntity): void {
  const t = monster.telegraph;
  if (!t) return;
  monster.telegraph = null;
  activeTelegraphs.delete(t);
  disposeObject3D(t.group);
}
