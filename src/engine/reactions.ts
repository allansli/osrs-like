// Hit reactions: hit stop, flash, flinch, knock-back, camera kick, low-health vignette.
// Offsets are applied to meshes only; rules positions (logic.x, logic.z, player.pos) are never written.

import * as THREE from 'three';
import { G, player } from './context';
import {
  CAMERA,
  FLASH,
  FLINCH,
  KNOCK_BACK,
  flashAmount,
  springOffset,
} from '../data/feel';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const hitStoppedEntities = new Map<any, number>();

export function hitStop(entity: any, ms: number): void {
  if (!entity || ms <= 0 || prefersReducedMotion()) return;
  const current = hitStoppedEntities.get(entity) ?? 0;
  hitStoppedEntities.set(entity, Math.max(current, ms));
}

export function isHitStopped(entity: any): boolean {
  return (hitStoppedEntities.get(entity) ?? 0) > 0;
}

interface FlashState {
  materials: THREE.Material[];
  originalColors: number[];
  elapsedMs: number;
}

const entityFlashes = new Map<any, FlashState>();
const entityLastFlashTime = new Map<any, number>();
const entityMaterialsCache = new WeakMap<any, THREE.Material[]>();
let reactionTimeMs = 0;
const _whiteColor = new THREE.Color(0xffffff);
const _tempColor = new THREE.Color();

function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = [];
  root.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      if (Array.isArray(mesh.material)) {
        materials.push(...mesh.material);
      } else {
        materials.push(mesh.material);
      }
    }
  });
  return materials;
}

export function flash(entity: any): void {
  if (!entity || prefersReducedMotion()) return;
  const lastTime = entityLastFlashTime.get(entity);
  if (lastTime !== undefined && reactionTimeMs - lastTime < FLASH.minGapMs) {
    return;
  }
  entityLastFlashTime.set(entity, reactionTimeMs);

  let materials = entityMaterialsCache.get(entity);
  if (!materials) {
    const root = entity.rig?.group ?? entity.meshGroup ?? (entity.isObject3D ? entity : null);
    materials = root ? collectMaterials(root) : [];
    entityMaterialsCache.set(entity, materials);
  }

  const originalColors: number[] = [];
  for (const mat of materials) {
    const std = mat as THREE.MeshStandardMaterial;
    originalColors.push(std.color ? std.color.getHex() : 0xffffff);
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
}

let activeHeroFlinch: HeroFlinchState | null = null;

export function flinchHero(dirX: number, dirZ: number): void {
  if (prefersReducedMotion()) return;
  const len = Math.hypot(dirX, dirZ);
  if (len === 0) return;
  activeHeroFlinch = {
    dirX: dirX / len,
    dirZ: dirZ / len,
    elapsedMs: 0,
    durationMs: FLINCH.heroMs,
  };
}

interface KnockBackState {
  mesh: THREE.Object3D;
  dirX: number;
  dirZ: number;
  amount: number;
  durationMs: number;
  elapsedMs: number;
  lastOffset: number;
}

const activeKnockBacks = new Map<any, KnockBackState>();

export function knockBack(entity: any, dirX: number, dirZ: number, amount?: number): void {
  if (!entity || prefersReducedMotion()) return;
  const len = Math.hypot(dirX, dirZ);
  if (len === 0) return;
  const mesh: THREE.Object3D | null =
    entity === player
      ? player.meshGroup
      : (entity.rig?.group ?? entity.meshGroup ?? (entity.isObject3D ? entity : null));
  if (!mesh) return;

  const isHero = entity === player;
  const defaultAmount = isHero ? KNOCK_BACK.heroHeavy.amount : KNOCK_BACK.monsterHit.amount;
  const durationMs = isHero ? KNOCK_BACK.heroHeavy.ms : KNOCK_BACK.monsterHit.ms;
  const effectiveAmount = amount ?? defaultAmount;

  const existing = activeKnockBacks.get(entity);
  if (existing) {
    mesh.position.x -= existing.dirX * existing.lastOffset;
    mesh.position.z -= existing.dirZ * existing.lastOffset;
  }

  activeKnockBacks.set(entity, {
    mesh,
    dirX: dirX / len,
    dirZ: dirZ / len,
    amount: effectiveAmount,
    durationMs,
    elapsedMs: 0,
    lastOffset: 0,
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

export function cameraKick(dirX: number, dirZ: number, amount?: number): void {
  if (prefersReducedMotion()) return;
  const len = Math.hypot(dirX, dirZ);
  if (len === 0) return;
  const cappedAmount = Math.min(amount ?? CAMERA.kickMax, CAMERA.kickMax);
  if (cappedAmount <= 0) return;

  if (activeCameraKick && G.camera) {
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
  if (activeCameraRumble && G.camera) {
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
  if (typeof document === 'undefined') return;
  const vignette =
    document.getElementById('low-health-vignette') ||
    document.querySelector('.low-health-vignette');
  if (vignette) {
    if (on) {
      vignette.classList.add('active');
      if (prefersReducedMotion()) {
        vignette.classList.add('steady');
      } else {
        vignette.classList.remove('steady');
      }
    } else {
      vignette.classList.remove('active', 'steady');
    }
  }
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
        if (mat.color && typeof mat.color.setHex === 'function') {
          mat.color.setHex(state.originalColors[i]);
        }
      }
      entityFlashes.delete(entity);
    } else {
      const amount = flashAmount(state.elapsedMs);
      for (let i = 0; i < state.materials.length; i++) {
        const mat = state.materials[i] as THREE.MeshStandardMaterial;
        if (mat.color && typeof mat.color.setHex === 'function') {
          _tempColor.setHex(state.originalColors[i]);
          _tempColor.lerp(_whiteColor, amount);
          mat.color.copy(_tempColor);
        }
      }
    }
  }

  if (activeHeroFlinch) {
    activeHeroFlinch.elapsedMs += dtMs;
    const torso = player.parts?.torso as THREE.Group | undefined;
    if (activeHeroFlinch.elapsedMs >= activeHeroFlinch.durationMs) {
      if (torso) {
        torso.rotation.x = 0;
        torso.rotation.z = 0;
      }
      activeHeroFlinch = null;
    } else {
      const progress = activeHeroFlinch.elapsedMs / activeHeroFlinch.durationMs;
      const lean = Math.sin(progress * Math.PI) * 0.18;
      if (torso) {
        torso.rotation.z = -activeHeroFlinch.dirX * lean;
        torso.rotation.x = activeHeroFlinch.dirZ * lean;
      }
    }
  }

  for (const [entity, kb] of activeKnockBacks) {
    kb.mesh.position.x -= kb.dirX * kb.lastOffset;
    kb.mesh.position.z -= kb.dirZ * kb.lastOffset;

    kb.elapsedMs += dtMs;
    if (kb.elapsedMs >= kb.durationMs) {
      activeKnockBacks.delete(entity);
    } else {
      const curOffset = springOffset(kb.elapsedMs, kb.amount, kb.durationMs);
      kb.mesh.position.x += kb.dirX * curOffset;
      kb.mesh.position.z += kb.dirZ * curOffset;
      kb.lastOffset = curOffset;
    }
  }

  if (activeCameraKick) {
    if (G.camera) {
      G.camera.position.x -= activeCameraKick.dirX * activeCameraKick.lastOffset;
      G.camera.position.z -= activeCameraKick.dirZ * activeCameraKick.lastOffset;
    }
    activeCameraKick.elapsedMs += dtMs;
    if (activeCameraKick.elapsedMs >= activeCameraKick.durationMs) {
      activeCameraKick = null;
    } else {
      const curOffset = springOffset(
        activeCameraKick.elapsedMs,
        activeCameraKick.amount,
        activeCameraKick.durationMs
      );
      if (G.camera) {
        G.camera.position.x += activeCameraKick.dirX * curOffset;
        G.camera.position.z += activeCameraKick.dirZ * curOffset;
      }
      activeCameraKick.lastOffset = curOffset;
    }
  }

  if (activeCameraRumble) {
    if (G.camera) {
      G.camera.position.x -= activeCameraRumble.lastOffsetX;
      G.camera.position.y -= activeCameraRumble.lastOffsetY;
    }
    activeCameraRumble.elapsedMs += dtMs;
    if (activeCameraRumble.elapsedMs >= activeCameraRumble.durationMs) {
      activeCameraRumble = null;
    } else {
      const remaining = 1 - activeCameraRumble.elapsedMs / activeCameraRumble.durationMs;
      const amp = 0.08 * remaining;
      const ox = (Math.random() - 0.5) * amp;
      const oy = (Math.random() - 0.5) * amp;
      if (G.camera) {
        G.camera.position.x += ox;
        G.camera.position.y += oy;
      }
      activeCameraRumble.lastOffsetX = ox;
      activeCameraRumble.lastOffsetY = oy;
    }
  }
}
