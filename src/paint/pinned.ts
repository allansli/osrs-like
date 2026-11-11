import * as THREE from 'three';
import { dabGeometry, dabMaterial, dabMesh } from '../oilpaint/dabs.js';
import { resolvePaint, shouldPaintMesh, strokeDirection, type PaintClass } from './contract';
import { PALETTES, hexToPaint } from './palettes';

/** Pins for one actor, shared across that actor's meshes by surface area. */
const ACTOR_BUDGET: Record<PaintClass, number> = {
  hero: 900,
  boss: 900,
  monster: 420,
  gear: 220,
  prop: 280,
  tree: 340
};

export interface PaintActor {
  root: THREE.Object3D;
  paintClass: PaintClass;
  /** When set, this actor's meshes use this pin count instead of the shared budget. */
  count?: number;
  /** Meshes under these roots are left to another actor (the sword on Kai's hand). */
  skip?: THREE.Object3D[];
}

/** How many strokes one still mesh needs so a box does not read as flat colour. */
export function dabsForMesh(radius: number, paintClass: PaintClass): number {
  const floor = paintClass === 'tree' ? 64 : paintClass === 'boss' ? 48 : paintClass === 'monster' ? 40 : paintClass === 'gear' ? 90 : 36;
  const cap = paintClass === 'tree' ? 220 : paintClass === 'boss' ? 160 : paintClass === 'monster' ? 110 : paintClass === 'gear' ? 220 : 180;
  const r = Number.isFinite(radius) && radius > 0 ? radius : 0.4;
  return Math.round(Math.min(cap, Math.max(floor, r * 42)));
}

interface Pin {
  mesh: THREE.Mesh;
  v: number;
  p: THREE.Vector3;
  n: THREE.Vector3;
  d: THREE.Vector3;
}

export interface PinnedPaint {
  mesh: THREE.Mesh;
  count: number;
  skinned: THREE.SkinnedMesh[];
  update: () => void;
  dispose: () => void;
}

function materialUserData(mesh: THREE.Mesh): Record<string, unknown> | null {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const ud = material?.userData;
  if (!ud || typeof ud !== 'object') return null;
  return ud as Record<string, unknown>;
}

function isUnder(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = node;
  while (p) {
    if (p === ancestor) return true;
    p = p.parent;
  }
  return false;
}

function triangleWeight(mesh: THREE.Mesh): number {
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute | undefined;
  if (!pos) return 0;
  const index = mesh.geometry.index;
  const tris = index ? index.count / 3 : pos.count / 3;
  const at = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, at(t, 0));
    b.fromBufferAttribute(pos, at(t, 1));
    c.fromBufferAttribute(pos, at(t, 2));
    total += b.sub(a).cross(c.sub(a)).length();
  }
  return total;
}

interface MeshJob {
  mesh: THREE.Mesh;
  paintClass: PaintClass;
  actor: number;
  weight: number;
  density: number | null;
}

function collectJobs(actors: PaintActor[]): MeshJob[] {
  const jobs: MeshJob[] = [];
  actors.forEach((actor, actorIndex) => {
    const skip = actor.skip ?? [];
    actor.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (skip.some((root) => root !== actor.root && isUnder(mesh, root))) return;
      if (!shouldPaintMesh(mesh.userData as Record<string, unknown>, mesh.name)) return;
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (material?.transparent) return;
      if (!mesh.geometry?.attributes?.position) return;
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
      const resolved = resolvePaint({
        objectUserData: mesh.userData as Record<string, unknown>,
        materialUserData: materialUserData(mesh),
        paintClass: actor.paintClass,
        part: (mesh.userData?.part as string) ?? null,
        name: mesh.name
      });
      const weight = triangleWeight(mesh);
      if (weight <= 0 && resolved.density == null && actor.count == null) return;
      const density = actor.count ?? resolved.density;
      jobs.push({ mesh, paintClass: actor.paintClass, actor: actorIndex, weight, density });
    });
  });
  return jobs;
}

function allocate(jobs: MeshJob[]): number[] {
  const counts = jobs.map((job) => (job.density != null ? Math.min(4000, job.density) : 0));
  const actors = new Set(jobs.map((job) => job.actor));
  for (const actor of actors) {
    const open = jobs
      .map((job, i) => ({ job, i }))
      .filter(({ job }) => job.actor === actor && job.density == null && job.weight > 0);
    const weight = open.reduce((sum, item) => sum + item.job.weight, 0);
    if (weight <= 0) continue;
    const budget = ACTOR_BUDGET[open[0].job.paintClass];
    let left = budget;
    open.forEach((item, n) => {
      const share = n === open.length - 1
        ? left
        : Math.max(8, Math.round((budget * item.job.weight) / weight));
      const count = Math.max(0, Math.min(share, left));
      counts[item.i] = count;
      left -= count;
    });
  }
  return counts;
}

function paletteList(channel: 0 | 1 | 2): string {
  return PALETTES.map((p) => {
    const hex = channel === 0 ? p.light : channel === 1 ? p.half : p.shade;
    const [r, g, b] = hexToPaint(hex);
    return `vec3(${r.toFixed(5)}, ${g.toFixed(5)}, ${b.toFixed(5)})`;
  }).join(', ');
}

/**
 * Paint on a mesh, rigged or not. This is the author's pinDabs path (sample the
 * surface, carry the pin with the bone or the matrix) with one extra per pin:
 * the contract's jitter, and `flat` laid down instead of turned toward the eye.
 * pinDabs itself bakes jitter at 0.45 and has no lie flag, so the game calls
 * dabMaterial / dabGeometry / dabMesh — the same primitives — and fills makeDab.
 */
export function pinPaint(shared: object, actors: PaintActor[]): PinnedPaint | null {
  const jobs = collectJobs(actors);
  const counts = allocate(jobs);
  let seed = 9151;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pins: Pin[] = [];
  const extras: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  jobs.forEach((job, jobIndex) => {
    const want = counts[jobIndex];
    if (!want) return;
    const g = job.mesh.geometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nrmAttr = g.attributes.normal as THREE.BufferAttribute;
    const index = g.index;
    const tris = index ? index.count / 3 : pos.count / 3;
    const at = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    const sums = new Float32Array(tris);
    let total = 0;
    for (let t = 0; t < tris; t++) {
      a.fromBufferAttribute(pos, at(t, 0));
      b.fromBufferAttribute(pos, at(t, 1));
      c.fromBufferAttribute(pos, at(t, 2));
      total += b.sub(a).cross(c.sub(a)).length();
      sums[t] = total;
    }
    if (total <= 0) return;
    const resolved = resolvePaint({
      objectUserData: job.mesh.userData as Record<string, unknown>,
      materialUserData: materialUserData(job.mesh),
      paintClass: job.paintClass,
      part: (job.mesh.userData?.part as string) ?? null,
      name: job.mesh.name
    });
    for (let made = 0, tries = 0; made < want && tries < want * 40; tries++) {
      const target = rand() * total;
      let lo = 0;
      let hi = tris - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sums[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      const v = at(lo, Math.floor(rand() * 3));
      const p = new THREE.Vector3().fromBufferAttribute(pos, v);
      nrm.fromBufferAttribute(nrmAttr, v);
      const dir = strokeDirection(resolved.stroke, { x: nrm.x, y: nrm.y, z: nrm.z });
      pins.push({
        mesh: job.mesh,
        v,
        p,
        n: nrm.clone(),
        d: new THREE.Vector3(dir.x, dir.y, dir.z)
      });
      extras.push(rand() * 1000, resolved.size[0], resolved.size[1], paletteIndexOf(resolved.paletteId), resolved.jitter, resolved.stroke === 'flat' ? 1 : 0);
      made++;
    }
  });

  const count = pins.length;
  if (!count) return null;
  const aPos = new Float32Array(count * 3);
  const aDir = new Float32Array(count * 3);
  const aNrm = new Float32Array(count * 3);
  const aData = new Float32Array(count * 4);
  const aExtra = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    aData[i * 4] = extras[i * 6];
    aData[i * 4 + 1] = extras[i * 6 + 1];
    aData[i * 4 + 2] = extras[i * 6 + 2];
    aData[i * 4 + 3] = extras[i * 6 + 3];
    aExtra[i * 4] = extras[i * 6 + 4];
    aExtra[i * 4 + 1] = extras[i * 6 + 5];
  }
  const geometry = dabGeometry(count, { aPos: [aPos, 3], aDir: [aDir, 3], aNrm: [aNrm, 3] }, true);
  geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 4));
  geometry.setAttribute('aExtra', new THREE.InstancedBufferAttribute(aExtra, 4));
  const n = PALETTES.length;
  const mesh = dabMesh(geometry, dabMaterial(shared, {
    head: /* glsl */ `
      in vec3 aPos; in vec3 aDir; in vec3 aNrm; in vec4 aData; in vec4 aExtra;
      const vec3 FIG_L[${n}] = vec3[${n}](${paletteList(0)});
      const vec3 FIG_M[${n}] = vec3[${n}](${paletteList(1)});
      const vec3 FIG_S[${n}] = vec3[${n}](${paletteList(2)});`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec3 Nn = normalize(aNrm);
        if (aExtra.y < 0.5 && dot(Nn, normalize(cameraPosition - aPos)) < -0.05) { d.alive = 0.0; return; }
        vec4 r = hash4(aData.x);
        int k = int(aData.w + 0.5);
        float lit = sunAt(aPos + Nn * 0.08) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
        vec3 col = paint3(FIG_L[k], FIG_M[k], FIG_S[k], lit, r.x);
        col += vec3(0.05, 0.08, 0.04) * max(-Nn.y, 0.0) * (1.0 - lit);
        col = mix(col, col * vec3(0.86, 0.95, 1.08), (1.0 - lit) * max(Nn.y, 0.0) * 0.55);
        float jit = max(aExtra.x, 0.0);
        col = jitter(col, r.yzw, jit);
        d.pos = aPos;
        d.dir = normalize(aDir);
        d.size = aData.yz * (0.8 + 0.45 * r.y);
        d.c1 = hazed(col, aPos);
        d.c2 = hazed(jitter(col * 1.18, r.wxy, jit), aPos);
        d.seed = aData.x;
        d.lift = 0.3;
        d.turnabout = 1.0;
        if (aExtra.y > 0.5) {
          d.lie = 1.0;
          d.nrm = Nn;
          d.height = 0.012;
          d.glaze = 1.0;
        }
      }`,
    minPx: [16, 30],
    maxPx: [90, 160],
    cells: [0, 6]
  } as never), 5);

  const skinned: THREE.SkinnedMesh[] = [];
  const seen = new Set<THREE.SkinnedMesh>();
  for (const pin of pins) {
    const sk = pin.mesh as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh && !seen.has(sk)) {
      seen.add(sk);
      skinned.push(sk);
    }
  }
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const pc = new THREE.Vector3();
  return {
    mesh,
    count,
    skinned,
    update() {
      for (const sk of skinned) sk.skeleton.update();
      for (let i = 0; i < count; i++) {
        const pin = pins[i];
        const m = pin.mesh;
        const k = i * 3;
        const skinned = (m as THREE.SkinnedMesh).isSkinnedMesh;
        pa.copy(pin.p);
        if (skinned) (m as THREE.SkinnedMesh).applyBoneTransform(pin.v, pa);
        pa.applyMatrix4(m.matrixWorld);
        pb.copy(pin.p).addScaledVector(pin.n, 0.03);
        if (skinned) (m as THREE.SkinnedMesh).applyBoneTransform(pin.v, pb);
        pb.applyMatrix4(m.matrixWorld);
        pc.copy(pin.p).addScaledVector(pin.d, 0.03);
        if (skinned) (m as THREE.SkinnedMesh).applyBoneTransform(pin.v, pc);
        pc.applyMatrix4(m.matrixWorld);
        aPos[k] = pa.x; aPos[k + 1] = pa.y; aPos[k + 2] = pa.z;
        aNrm[k] = pb.x - pa.x; aNrm[k + 1] = pb.y - pa.y; aNrm[k + 2] = pb.z - pa.z;
        aDir[k] = pc.x - pa.x; aDir[k + 1] = pc.y - pa.y; aDir[k + 2] = pc.z - pa.z;
      }
      geometry.attributes.aPos.needsUpdate = true;
      geometry.attributes.aDir.needsUpdate = true;
      geometry.attributes.aNrm.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      const mat = mesh.material as THREE.Material;
      mat.dispose();
      mesh.removeFromParent();
    }
  };
}

function paletteIndexOf(id: string): number {
  const i = PALETTES.findIndex((p) => p.id === id);
  return i < 0 ? 0 : i;
}
