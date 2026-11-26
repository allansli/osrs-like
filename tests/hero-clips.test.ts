// H5 (models pass): the hero's Death clip, its wiring, and that Stage 4's reactions survive a playing clip (design 6.5, 8.3).
// Red against today's hero.glb (no Death clip) and today's actions.ts until H5b. `Hurt` is left out (decision N-6).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildHumanoidRig, type HumanoidRig } from '../src/engine/humanoid';
import { upgradeHumanoidRigWithGltf, type BlenderHeroAnimator, type HeroClipName } from '../src/engine/blenderHero';
import { player } from '../src/engine/context';
import { handlePlayerDeath, finishRespawn } from '../src/engine/actions';
import { flinchHero, knockBack, updateReactions } from '../src/engine/reactions';
import { FLINCH } from '../src/data/feel';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
vi.mock('../src/ui/hud', async (orig) => {
  const stub = () => ({ hidden: false, textContent: '', classList: { toggle() {}, add() {}, remove() {} } });
  return { ...(await orig<typeof import('../src/ui/hud')>()), el: stub, addChatMessage() {}, updateAllUI() {}, updateSkillsPanel() {}, requestUiRefresh() {} };
});

// H5b adds 'Death' to HeroClipName; until then the cast keeps TYPES green.
const DEATH = 'Death' as HeroClipName;
let gltf: GLTF;
beforeAll(async () => {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public/models/hero.glb'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  gltf = await new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
});

function makeHero(): { rig: HumanoidRig; animator: BlenderHeroAnimator } {
  const rig = buildHumanoidRig();
  const animator = upgradeHumanoidRigWithGltf(rig, gltf);
  if (!animator) throw new Error('hero.glb did not upgrade the rig');
  return { rig, animator };
}

const run = (a: BlenderHeroAnimator, seconds: number, step = 1 / 30): void => {
  for (let t = 0; t < seconds; t += step) a.update(step);
};
const quat = (o: THREE.Object3D): THREE.Quaternion => o.quaternion.clone();

function clip(name: string): THREE.AnimationClip {
  const c = gltf.animations.find((a) => a.name === name);
  if (!c) throw new Error(`hero.glb has no clip ${name}`);
  return c;
}

describe('Death', () => {
  it('plays once and clamps on the last pose', () => {
    const { rig, animator } = makeHero();
    const death = clip('Death');
    const action = animator.actions.get(DEATH)!;
    expect(action.loop).toBe(THREE.LoopOnce);
    expect(action.clampWhenFinished).toBe(true);
    animator.playAction(DEATH, 1);
    run(animator, death.duration + 0.5);
    const atEnd = quat(rig.torso);
    run(animator, 2);
    expect(quat(rig.torso).angleTo(atEnd)).toBeLessThan(1e-4);
    const track = death.tracks.find((t) => t.name === 'Torso.quaternion')!;
    const last = new THREE.Quaternion().fromArray(track.values as unknown as number[], track.times.length * 4 - 4);
    expect(atEnd.angleTo(last)).toBeLessThan(0.02);
  });

  describe('wiring', () => {
    let animator: BlenderHeroAnimator;
    beforeEach(() => {
      ({ animator } = makeHero());
      player.blenderAnimator = animator;
      player.downed = false;
      player.deathOutcome = undefined;
    });

    it('handlePlayerDeath plays Death', () => {
      handlePlayerDeath();
      run(animator, 0.3);
      expect(animator.actions.get(DEATH)!.isRunning()).toBe(true);
      expect(animator.actions.get(DEATH)!.getEffectiveWeight()).toBeGreaterThan(0.9);
    });

    it('finishRespawn returns to Idle', () => {
      handlePlayerDeath();
      run(animator, clip('Death').duration + 1);
      finishRespawn();
      run(animator, 1);
      expect(animator.actions.get(DEATH)!.getEffectiveWeight()).toBeLessThan(0.01);
      expect(animator.actions.get('Idle')!.getEffectiveWeight()).toBeGreaterThan(0.99);
    });
  });
});

describe("Stage 4's reactions while a clip plays", () => {
  it('torso lean and knock-back offsets are still applied after one update', () => {
    const { rig, animator } = makeHero();
    player.parts = { ...player.parts, torso: rig.torso };
    player.meshGroup = rig.group;
    player.pos.set(3, 0, 4);
    animator.playAction('Slash', 1);
    animator.update(0.1);
    const posed = quat(rig.torso);

    flinchHero(1, 0);
    updateReactions(0.05);
    expect(quat(rig.torso).angleTo(posed)).toBeGreaterThan(FLINCH.heroLeanRad * 0.1);
    expect(animator.actions.get('Slash')!.isRunning()).toBe(true);

    knockBack(player, 1, 0, 0.5);
    updateReactions(0.05);
    expect(rig.group.position.x).toBeGreaterThan(player.pos.x + 1e-4);
    expect(animator.actions.get('Slash')!.isRunning()).toBe(true);
  });
});

describe('two hero instances (the player and a merchant)', () => {
  it('pose independently', () => {
    const a = makeHero();
    const b = makeHero();
    const idleOnly = makeHero();
    a.animator.playAction('Slash', 1.2);
    for (const h of [a, b, idleOnly]) run(h.animator, 0.15);
    const ref = quat(idleOnly.rig.rightArmPivot);
    expect(quat(a.rig.rightArmPivot).angleTo(ref)).toBeGreaterThan(0.05);
    expect(quat(b.rig.rightArmPivot).angleTo(ref)).toBeLessThan(1e-4);
  });
});
