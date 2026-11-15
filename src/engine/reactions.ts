// Hit reactions: hit stop, flash, flinch, knock-back, camera kick, low-health vignette.
// Offsets are applied to meshes only; rules positions (logic.x, logic.z, player.pos) are never written.

import * as THREE from 'three';
import { G, player } from './context';
import type { MonsterEntity } from './context';
import {
  CAMERA,
  FLASH,
  FLINCH,
  KNOCK_BACK,
  flashAmount,
  springOffset,
} from '../data/feel';

type Entity = MonsterEntity | typeof player;

// Reduced motion turns off only the camera kick and rumble and steadies the vignette (design 6.5, section 10).
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function meshRoot(entity: Entity): THREE.Object3D {
  return entity === player ? player.meshGroup! : (entity as MonsterEntity).rig.group;
}

const hitStoppedEntities = new Map<Entity, number>();

export function hitStop(entity: Entity, ms: number): void {
  if (ms <= 0) return;
  const current = hitStoppedEntities.has(entity) ? hitStoppedEntities.get(entity)! : 0;
  hitStoppedEntities.set(entity, Math.max(current, ms));
}

export function isHitStopped(entity: Entity): boolean {
  return hitStoppedEntities.has(entity);
}

interface FlashState {
  materials: THREE.Material[];
  originalColors: number[];
  elapsedMs: number;
}

const entityFlashes = new Map<Entity, FlashState>();
const entityLastFlashTime = new Map<Entity, number>();
let reactionTimeMs = 0;
const _whiteColor = new THREE.Color(0xffffff);
const _tempColor = new THREE.Color();

const flashMaterials = new WeakMap<Entity, THREE.Material[]>();

// Collects the body's materials once (design 6.5): spawn code calls it for each monster, and the hero calls it
// after every rebuildPlayerEquipmentMeshes, since gear meshes are replaced when equipment changes.
export function collectFlashMaterials(entity: Entity): void {
  const materials: THREE.Material[] = [];
  meshRoot(entity).traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh;
    // Outline shells share one colourless ShaderMaterial: never flash them.
    if (mesh.isMesh && !mesh.userData.isOutline) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list) if ('color' in m) materials.push(m);
    }
  });
  flashMaterials.set(entity, materials);
}

export function flash(entity: Entity): void {
  const materials = flashMaterials.get(entity);
  if (!materials) throw new Error('flash: collectFlashMaterials was never called for this entity');
  const lastTime = entityLastFlashTime.get(entity);
  if (lastTime !== undefined && reactionTimeMs - lastTime < FLASH.minGapMs) {
    return;
  }
  entityLastFlashTime.set(entity, reactionTimeMs);

  const originalColors: number[] = [];
  for (const mat of materials) {
    const std = mat as THREE.MeshStandardMaterial;
    originalColors.push(std.color.getHex());
  }

  entityFlashes.set(entity, {
    materials,
    originalColors,
    elapsedMs: 0,
  });
}

interface HeroFlinchState {
  dirX: number;
  dirZ: number;
  elapsedMs: number;
  durationMs: number;
  lastX: number;
  lastZ: number;
  // The torso rotation left after last frame's lean, to tell whether the pose has rewritten the axis since.
  leftX: number;
  leftZ: number;
}

let activeHeroFlinch: HeroFlinchState | null = null;

export function flinchHero(dirX: number, dirZ: number): void {
  const len = Math.hypot(dirX, dirZ);
  if (len === 0) return;
  // A flinch that restarts one still running keeps its last lean, so the next update removes it.
  const prev = activeHeroFlinch;
  activeHeroFlinch = {
    dirX: dirX / len,
    dirZ: dirZ / len,
    elapsedMs: 0,
    durationMs: FLINCH.heroMs,
    lastX: prev ? prev.lastX : 0,
    lastZ: prev ? prev.lastZ : 0,
    leftX: prev ? prev.leftX : NaN,
    leftZ: prev ? prev.leftZ : NaN,
  };
}

interface KnockBackState {
  // Visual targets with their resting positions: the hero group (base = player.pos, rewritten each frame by
  // the loop) or the monster's mesh children (never the group, whose position is the rules position m.pos).
  targets: { obj: THREE.Object3D; base: THREE.Vector3 }[];
  // The monster's rig group, whose frame (yaw and scale) the children's positions are in; null for the hero.
  group: THREE.Object3D | null;
  isHero: boolean;
  dirX: number;
  dirZ: number;
  amount: number;
  durationMs: number;
  elapsedMs: number;
}

const activeKnockBacks = new Map<Entity, KnockBackState>();

function applyKnockBack(kb: KnockBackState, offset: number): void {
  if (kb.isHero) {
    // The loop copies player.pos into the group every frame: write the absolute position after that copy.
    const g = player.meshGroup!;
    g.position.copy(player.pos);
    g.position.x += kb.dirX * offset;
    g.position.z += kb.dirZ * offset;
    return;
  }
  // The children sit in the rotated, scaled group: turn the world direction into its frame at its current yaw.
  const g = kb.group!;
  const c = Math.cos(g.rotation.y);
  const s = Math.sin(g.rotation.y);
  const lx = ((kb.dirX * c - kb.dirZ * s) * offset) / g.scale.x;
  const lz = ((kb.dirX * s + kb.dirZ * c) * offset) / g.scale.z;
  for (const t of kb.targets) {
    t.obj.position.set(t.base.x + lx, t.base.y, t.base.z + lz);
  }
}

export function knockBack(entity: Entity, dirX: number, dirZ: number, amount: number): void {
  const len = Math.hypot(dirX, dirZ);
  if (len === 0) return;
  const isHero = entity === player;
  const durationMs = isHero ? KNOCK_BACK.heroHeavy.ms : KNOCK_BACK.monsterHit.ms;

  const existing = activeKnockBacks.get(entity);
  if (existing) applyKnockBack(existing, 0);

  const rig = isHero ? null : (entity as MonsterEntity).rig;
  const targets = isHero
    ? []
    : rig!.group.children
        .filter((c) => c !== rig!.hitbox)
        .map((obj) => ({ obj, base: obj.position.clone() }));

  activeKnockBacks.set(entity, {
    targets,
    group: rig ? rig.group : null,
    isHero,
    dirX: dirX / len,
    dirZ: dirZ / len,
    amount,
    durationMs,
    elapsedMs: 0,
  });
}

interface CameraKickState {
  dirX: number;
  dirZ: number;
  amount: number;
  durationMs: number;
  elapsedMs: number;
  lastOffset: number;
}

let activeCameraKick: CameraKickState | null = null;

export function cameraKick(dirX: number, dirZ: number, amount: number): void {
  if (prefersReducedMotion()) return;
  const len = Math.hypot(dirX, dirZ);
  if (len === 0) return;
  const cappedAmount = Math.min(amount, CAMERA.kickMax);
  if (cappedAmount <= 0) return;

  if (activeCameraKick) {
    G.camera.position.x -= activeCameraKick.dirX * activeCameraKick.lastOffset;
    G.camera.position.z -= activeCameraKick.dirZ * activeCameraKick.lastOffset;
  }

  activeCameraKick = {
    dirX: dirX / len,
    dirZ: dirZ / len,
    amount: cappedAmount,
    durationMs: CAMERA.kickMs,
    elapsedMs: 0,
    lastOffset: 0,
  };
}

interface CameraRumbleState {
  durationMs: number;
  elapsedMs: number;
  lastOffsetX: number;
  lastOffsetY: number;
}

let activeCameraRumble: CameraRumbleState | null = null;

export function cameraRumble(ms: number = CAMERA.rumbleMs): void {
  if (prefersReducedMotion()) return;
  if (activeCameraRumble) {
    G.camera.position.x -= activeCameraRumble.lastOffsetX;
    G.camera.position.y -= activeCameraRumble.lastOffsetY;
  }
  activeCameraRumble = {
    durationMs: ms,
    elapsedMs: 0,
    lastOffsetX: 0,
    lastOffsetY: 0,
  };
}

let lowHealthActive = false;

export function isLowHealth(): boolean {
  return lowHealthActive;
}

export function setLowHealth(on: boolean): void {
  lowHealthActive = on;
  const vignette = document.getElementById('low-health-vignette')!;
  vignette.classList.toggle('active', on);
  vignette.classList.toggle('steady', on && prefersReducedMotion());
}

export function updateReactions(dt: number): void {
  const dtMs = dt * 1000;
  reactionTimeMs += dtMs;

  for (const [entity, remaining] of hitStoppedEntities) {
    const next = remaining - dtMs;
    if (next <= 0) {
      hitStoppedEntities.delete(entity);
    } else {
      hitStoppedEntities.set(entity, next);
    }
  }

  for (const [entity, state] of entityFlashes) {
    state.elapsedMs += dtMs;
    if (state.elapsedMs >= FLASH.ms) {
      for (let i = 0; i < state.materials.length; i++) {
        const mat = state.materials[i] as THREE.MeshStandardMaterial;
        mat.color.setHex(state.originalColors[i]);
      }
      entityFlashes.delete(entity);
    } else {
      const amount = flashAmount(state.elapsedMs);
      for (let i = 0; i < state.materials.length; i++) {
        const mat = state.materials[i] as THREE.MeshStandardMaterial;
        _tempColor.setHex(state.originalColors[i]);
        _tempColor.lerp(_whiteColor, amount);
        mat.color.copy(_tempColor);
      }
    }
  }

  if (activeHeroFlinch) {
    // Additive lean on top of the pose. An axis still holding the value left last frame was not rewritten by the
    // pose (the procedural rig never writes rotation.z), so last frame's lean is removed from it first; an axis
    // the pose rewrote this frame (the procedural rig's rotation.x, a mixer track) has already lost it.
    const f = activeHeroFlinch;
    const torso = player.parts.torso as THREE.Group;
    if (torso.rotation.x === f.leftX) torso.rotation.x -= f.lastX;
    if (torso.rotation.z === f.leftZ) torso.rotation.z -= f.lastZ;
    f.elapsedMs += dtMs;
    if (f.elapsedMs >= f.durationMs) {
      activeHeroFlinch = null;
    } else {
      // The torso sits under meshGroup (rotation.y = yaw + PI): turn the world blow direction into its frame.
      const yaw = player.meshGroup!.rotation.y;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const localX = f.dirX * c - f.dirZ * s;
      const localZ = f.dirX * s + f.dirZ * c;
      const lean = Math.sin((f.elapsedMs / f.durationMs) * Math.PI) * FLINCH.heroLeanRad;
      f.lastX = localZ * lean;
      f.lastZ = -localX * lean;
      torso.rotation.x += f.lastX;
      torso.rotation.z += f.lastZ;
      f.leftX = torso.rotation.x;
      f.leftZ = torso.rotation.z;
    }
  }

  for (const [entity, kb] of activeKnockBacks) {
    kb.elapsedMs += dtMs;
    if (kb.elapsedMs >= kb.durationMs) {
      applyKnockBack(kb, 0);
      activeKnockBacks.delete(entity);
    } else {
      applyKnockBack(kb, springOffset(kb.elapsedMs, kb.amount, kb.durationMs));
    }
  }

  if (activeCameraKick) {
    G.camera.position.x -= activeCameraKick.dirX * activeCameraKick.lastOffset;
    G.camera.position.z -= activeCameraKick.dirZ * activeCameraKick.lastOffset;
    activeCameraKick.elapsedMs += dtMs;
    if (activeCameraKick.elapsedMs >= activeCameraKick.durationMs) {
      activeCameraKick = null;
    } else {
      const curOffset = springOffset(
        activeCameraKick.elapsedMs,
        activeCameraKick.amount,
        activeCameraKick.durationMs
      );
      G.camera.position.x += activeCameraKick.dirX * curOffset;
      G.camera.position.z += activeCameraKick.dirZ * curOffset;
      activeCameraKick.lastOffset = curOffset;
    }
  }

  if (activeCameraRumble) {
    G.camera.position.x -= activeCameraRumble.lastOffsetX;
    G.camera.position.y -= activeCameraRumble.lastOffsetY;
    activeCameraRumble.elapsedMs += dtMs;
    if (activeCameraRumble.elapsedMs >= activeCameraRumble.durationMs) {
      activeCameraRumble = null;
    } else {
      const remaining = 1 - activeCameraRumble.elapsedMs / activeCameraRumble.durationMs;
      const amp = CAMERA.rumbleAmp * remaining;
      const ox = (Math.random() - 0.5) * amp;
      const oy = (Math.random() - 0.5) * amp;
      G.camera.position.x += ox;
      G.camera.position.y += oy;
      activeCameraRumble.lastOffsetX = ox;
      activeCameraRumble.lastOffsetY = oy;
    }
  }
}
