import * as THREE from 'three';
import { ATTACKS } from '../data/attacks';
import type { Shape } from '../data/attacks';
import { fillScale, shapeOutline } from '../state/telegraph';
import { getTerrainHeight, TERRAIN_SEGMENTS, TERRAIN_SIZE } from '../state/terrain';
import { disposeObject3D } from './dispose';
import { G } from './context';
import type { VoiceStop } from './audio';
import type { MonsterEntity } from './context';

export interface TelegraphInstance {
  monster: MonsterEntity;
  shape: Shape;
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
  heights: HeightGrid;
  // The wind-up cue's voices, stopped when the shape is cleared (a cancel, a death, a reset, the resolve).
  sound: VoiceStop[];
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

// Fill lattice spacing: the terrain's own vertex spacing (design 6.5), so the ground cannot poke through on a slope.
const FILL_STEP = 1.5;

type FillData = { baseCoords: number[]; indices: number[] };

// A lattice of rows by segments, with an optional centre vertex fanned to the first row. A wrapped lattice
// closes each row on itself; an open one has segments + 1 columns. point(row, col) is the vertex's local x, z.
function buildLattice(
  center: boolean,
  lastRow: number,
  segments: number,
  wrap: boolean,
  point: (row: number, col: number) => [number, number]
): FillData {
  const baseCoords: number[] = center ? [0, 0] : [];
  const indices: number[] = [];
  const first = center ? 1 : 0;
  const cols = wrap ? segments : segments + 1;
  const next = (c: number) => (wrap ? (c + 1) % segments : c + 1);

  for (let row = first; row <= lastRow; row++) {
    for (let col = 0; col < cols; col++) baseCoords.push(...point(row, col));
  }
  if (center) {
    for (let c = 0; c < segments; c++) indices.push(0, 1 + c, 1 + next(c));
  }
  for (let row = 0; row < lastRow - first; row++) {
    const rowA = first + row * cols;
    const rowB = rowA + cols;
    for (let c = 0; c < segments; c++) {
      const a1 = rowA + c;
      const a2 = rowA + next(c);
      const b1 = rowB + c;
      const b2 = rowB + next(c);
      indices.push(a1, b1, a2, a2, b1, b2);
    }
  }
  return { baseCoords, indices };
}

function buildFillData(shape: Shape): FillData {
  switch (shape.type) {
    case 'circle': {
      const nr = Math.max(2, Math.ceil(shape.radius / FILL_STEP));
      const nTheta = Math.max(12, Math.ceil((2 * Math.PI * shape.radius) / FILL_STEP));
      return buildLattice(true, nr, nTheta, true, (rIdx, tIdx) => {
        const r = (rIdx / nr) * shape.radius;
        const theta = (tIdx / nTheta) * 2 * Math.PI;
        return [r * Math.sin(theta), r * Math.cos(theta)];
      });
    }
    case 'cone': {
      const halfRad = (shape.halfAngleDeg * Math.PI) / 180;
      const nr = Math.max(2, Math.ceil(shape.length / FILL_STEP));
      const nTheta = Math.max(4, Math.ceil((2 * halfRad * shape.length) / FILL_STEP));
      return buildLattice(true, nr, nTheta, false, (rIdx, tIdx) => {
        const r = (rIdx / nr) * shape.length;
        const theta = -halfRad + (tIdx / nTheta) * (2 * halfRad);
        return [r * Math.sin(theta), r * Math.cos(theta)];
      });
    }
    case 'line': {
      const nx = Math.max(2, Math.ceil((2 * shape.halfWidth) / FILL_STEP));
      const nz = Math.max(2, Math.ceil(shape.length / FILL_STEP));
      return buildLattice(false, nz, nx, false, (iz, ix) => [
        -shape.halfWidth + (ix / nx) * (2 * shape.halfWidth),
        (iz / nz) * shape.length
      ]);
    }
    case 'ring': {
      const { inner, outer } = shape;
      const nr = Math.max(2, Math.ceil((outer - inner) / FILL_STEP));
      const nTheta = Math.max(16, Math.ceil((2 * Math.PI * outer) / FILL_STEP));
      return buildLattice(false, nr, nTheta, true, (rIdx, tIdx) => {
        const r = inner + (rIdx / nr) * (outer - inner);
        const theta = (tIdx / nTheta) * 2 * Math.PI;
        return [r * Math.sin(theta), r * Math.cos(theta)];
      });
    }
  }
}

// Terrain heights at the terrain mesh's own vertices under the shape, sampled once when the shape is built.
// gridHeight interpolates them with the mesh's triangulation, so the fill lies on the ground as drawn.
interface HeightGrid {
  ix0: number;
  iz0: number;
  nx: number;
  nz: number;
  h: Float32Array;
}

const TERRAIN_STEP = TERRAIN_SIZE / TERRAIN_SEGMENTS;
const TERRAIN_HALF = TERRAIN_SIZE / 2;

function buildHeightGrid(baseCoords: number[], ox: number, oz: number, dx: number, dz: number): HeightGrid {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < baseCoords.length; i += 2) {
    const [wx, wz] = localToWorld(ox, oz, dx, dz, baseCoords[i], baseCoords[i + 1]);
    minX = Math.min(minX, wx);
    maxX = Math.max(maxX, wx);
    minZ = Math.min(minZ, wz);
    maxZ = Math.max(maxZ, wz);
  }
  const cell = (w: number) => Math.min(TERRAIN_SEGMENTS, Math.max(0, (w + TERRAIN_HALF) / TERRAIN_STEP));
  const ix0 = Math.min(TERRAIN_SEGMENTS - 1, Math.floor(cell(minX)));
  const iz0 = Math.min(TERRAIN_SEGMENTS - 1, Math.floor(cell(minZ)));
  const nx = Math.max(ix0 + 1, Math.ceil(cell(maxX))) - ix0 + 1;
  const nz = Math.max(iz0 + 1, Math.ceil(cell(maxZ))) - iz0 + 1;
  const h = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      h[j * nx + i] = getTerrainHeight((ix0 + i) * TERRAIN_STEP - TERRAIN_HALF, (iz0 + j) * TERRAIN_STEP - TERRAIN_HALF);
    }
  }
  return { ix0, iz0, nx, nz, h };
}

// PlaneGeometry splits each cell along the diagonal from (x0, z1) to (x1, z0).
function gridHeight(g: HeightGrid, wx: number, wz: number): number {
  const fx = (wx + TERRAIN_HALF) / TERRAIN_STEP - g.ix0;
  const fz = (wz + TERRAIN_HALF) / TERRAIN_STEP - g.iz0;
  const i = Math.min(g.nx - 2, Math.max(0, Math.floor(fx)));
  const j = Math.min(g.nz - 2, Math.max(0, Math.floor(fz)));
  const tx = fx - i;
  const tz = fz - j;
  const h00 = g.h[j * g.nx + i];
  const h10 = g.h[j * g.nx + i + 1];
  const h01 = g.h[(j + 1) * g.nx + i];
  const h11 = g.h[(j + 1) * g.nx + i + 1];
  if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
  return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
}

function updateTelegraphProgress(t: TelegraphInstance, p: number): void {
  const posAttr = t.fillMesh.geometry.attributes.position;
  const arr = posAttr.array as Float32Array;
  const { ox, oz, dx, dz, baseCoords, shape, heights } = t;

  for (let i = 0; i < baseCoords.length; i += 2) {
    const k = fillScale(shape, Math.hypot(baseCoords[i], baseCoords[i + 1]), p);
    const lx = k * baseCoords[i];
    const lz = k * baseCoords[i + 1];
    const wx = ox + lx * dz + lz * dx;
    const wz = oz - lx * dx + lz * dz;
    const idx = (i / 2) * 3;
    arr[idx] = wx;
    arr[idx + 1] = gridHeight(heights, wx, wz) + 0.06;
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

function telegraphMaterial(
  color: number,
  opacity: number,
  extra: THREE.MeshBasicMaterialParameters
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    fog: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    ...extra
  });
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
  const haloMesh = new THREE.Mesh(haloGeom, telegraphMaterial(0x140a08, 0.75, { depthTest: false }));
  haloMesh.renderOrder = 998;
  const outlineMesh = new THREE.Mesh(outlineGeom, telegraphMaterial(0xef4444, 0.85, { depthTest: false }));
  outlineMesh.renderOrder = 999;

  // Build fill mesh
  const fillData = buildFillData(shape);
  const fillGeom = new THREE.BufferGeometry();
  const numVertices = fillData.baseCoords.length / 2;
  const fillPositions = new Float32Array(numVertices * 3);
  fillGeom.setAttribute('position', new THREE.BufferAttribute(fillPositions, 3));
  fillGeom.setIndex(fillData.indices);

  const fillMat = telegraphMaterial(0xef4444, 0.35, {
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  const fillMesh = new THREE.Mesh(fillGeom, fillMat);
  fillMesh.visible = false;
  // The fill grows from a point: three computes a mesh's culling sphere once, on its first tiny frame.
  fillMesh.frustumCulled = false;

  const group = new THREE.Group();
  group.add(haloMesh);
  group.add(outlineMesh);
  group.add(fillMesh);

  G.scene.add(group);

  const durationSecs = event.ms / 1000;
  const instance: TelegraphInstance = {
    monster,
    shape,
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
    baseCoords: fillData.baseCoords,
    heights: buildHeightGrid(fillData.baseCoords, event.ox, event.oz, event.dx, event.dz),
    sound: []
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
  for (const stop of t.sound) stop();
  disposeObject3D(t.group);
}
