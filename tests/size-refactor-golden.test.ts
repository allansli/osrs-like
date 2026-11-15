// Review 17 (JS chunk over the stage budget): the byte-cutting refactors of soundPlan.ts and telegraphs.ts
// must not change one voice or one vertex. Digests of the outputs taken before the refactor.
// Regenerate (only before a refactor, never to make one pass): GOLDEN_WRITE=1 npx vitest run tests/size-refactor-golden.test.ts
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ATTACKS } from '../src/data/attacks';
import { G } from '../src/engine/context';
import type { MonsterEntity } from '../src/engine/context';
import { clearTelegraph, showTelegraph, updateTelegraphs } from '../src/engine/telegraphs';
import * as sp from '../src/state/soundPlan';

const FILE = 'tests/fixtures/size-refactor-golden.json';
const digest = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex');

function plans(): Record<string, unknown> {
  const out: Record<string, unknown> = {
    heavyTaken: sp.heavyTakenPlan(),
    dodged: sp.dodgedPlan(),
    phase: sp.phasePlan(),
    bossDown: sp.bossDownPlan(),
    heartbeat: sp.heartbeatPlan(),
    foodReady: sp.foodReadyPlan()
  };
  for (const r of [0, 0.25, 0.5, 1]) out[`impact ${r}`] = sp.impactPlan(r);
  for (const [inS, d] of [[true, 0], [true, 5], [false, 0], [false, 5]] as const) out[`heavyImpact ${inS} ${d}`] = sp.heavyImpactPlan(inS, d);
  for (const c of ['low', 'mid', 'high', 'fire'] as const) {
    out[`resolve ${c}`] = sp.resolvePlan(c);
    for (const a of Object.values(ATTACKS)) out[`windup ${a.id} ${c}`] = sp.windupPlan(a, c);
  }
  // Keys present with an undefined value would be lost by JSON: record the key lists too.
  for (const [k, p] of Object.entries(out)) out[`${k} keys`] = (p as object[]).map((v) => Object.keys(v).sort());
  return out;
}

function meshData(mesh: THREE.Mesh): unknown {
  const mat = mesh.material as THREE.MeshBasicMaterial;
  return {
    pos: Array.from(mesh.geometry.attributes.position.array as Float32Array),
    index: Array.from(mesh.geometry.index!.array),
    mat: [mat.color.getHex(), mat.opacity, mat.transparent, mat.fog, mat.depthTest, mat.depthWrite, mat.side,
      mat.polygonOffset, mat.polygonOffsetFactor, mat.polygonOffsetUnits],
    order: mesh.renderOrder,
    visible: mesh.visible,
    culled: mesh.frustumCulled
  };
}

function telegraphs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of Object.keys(ATTACKS)) {
    G.scene = new THREE.Scene();
    const monster = { telegraph: null } as unknown as MonsterEntity;
    const ms = ATTACKS[id].windupMs;
    showTelegraph(monster, { kind: 'windup', attackId: id, ox: 37.3, oz: -21.7, dx: 0.6, dz: 0.8, ms });
    const t = monster.telegraph!;
    const start = [meshData(t.haloMesh), meshData(t.outlineMesh), meshData(t.fillMesh), t.baseCoords];
    updateTelegraphs((0.4 * ms) / 1000);
    out[id] = digest([...start, meshData(t.fillMesh), t.group.children.length]);
    clearTelegraph(monster);
  }
  return out;
}

describe('review 17: refactors for bundle size keep every output', () => {
  const current = { plans: digest(plans()), telegraphs: telegraphs() };
  if (process.env.GOLDEN_WRITE === '1') writeFileSync(FILE, JSON.stringify(current, null, 2) + '\n');
  const golden = JSON.parse(readFileSync(FILE, 'utf8')) as typeof current;

  it('every sound plan is unchanged', () => {
    expect(current.plans).toBe(golden.plans);
  });

  it('every telegraph mesh and fill step is unchanged', () => {
    expect(Object.keys(golden.telegraphs).length).toBe(Object.keys(ATTACKS).length);
    expect(current.telegraphs).toEqual(golden.telegraphs);
  });
});
