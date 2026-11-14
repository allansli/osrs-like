import * as THREE from 'three';
import { G, player } from './context';
import type { MonsterEntity, ProjectileEntry, VfxEntry } from './context';
import { getTerrainHeight } from '../state/terrain';
import { worldToScreen } from './runtime';
import { el } from '../ui/hud';
import type { ItemDef } from '../data/items';
import type { SpellDef } from '../data/magic';

// ============================================================================
// 10. COMBAT HIT SPLATS, PROJECTILES & SKILLING EXECUTION
// ============================================================================
export function spawnHitSplatWorld(
  worldPos: THREE.Vector3,
  dmg: number,
  splatType = 'hit'
): void {
  const screenPos = worldToScreen(worldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.8, 0)));
  if (!screenPos.visible) return;
  const splatEl = document.createElement('div');
  splatEl.className = `hitsplat ${splatType}`;
  splatEl.style.left = screenPos.x + 'px';
  splatEl.style.top = screenPos.y + 'px';
  const label = splatType === 'heal' ? `+${dmg}` : String(dmg);
  splatEl.innerHTML = `<span class="hitsplat-num">${label}</span>`;
  el('world-labels').appendChild(splatEl);
  setTimeout(() => splatEl.remove(), 1050);
}

export function spawnHitSplatOnPlayer(dmg: number, splatType = 'hit'): void {
  spawnHitSplatWorld(player.pos, dmg, splatType);
}

export function glowMaterial(color: THREE.ColorRepresentation, opacity = 0.92): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

export function spawnVfx(
  mesh: THREE.Object3D,
  life: number,
  onTick?: (v: VfxEntry, dt: number) => void
): void {
  G.scene.add(mesh);
  G.vfxList.push({ mesh, life, age: 0, onTick });
}

export interface LaunchProjectileOptions {
  y0?: number;
  y1?: number;
  speed?: number;
  arc?: number;
  orient?: boolean;
  onImpact?: (() => void) | null;
  onTick?: ((p: ProjectileEntry, dt: number) => void) | null;
}

export function launchProjectile(
  mesh: THREE.Object3D,
  fromPos: THREE.Vector3,
  toPos: THREE.Vector3,
  onImpact?: (() => void) | null,
  opts: LaunchProjectileOptions = {}
): void {
  const start = fromPos.clone().add(new THREE.Vector3(0, opts.y0 ?? 1.4, 0));
  const end = toPos.clone().add(new THREE.Vector3(0, opts.y1 ?? 1.2, 0));
  mesh.position.copy(start);
  G.scene.add(mesh);
  G.projectilesList.push({
    mesh,
    start,
    end,
    progress: 0,
    speed: opts.speed ?? 3.5,
    arc: opts.arc ?? 1.4,
    orient: !!opts.orient,
    onImpact,
    onTick: opts.onTick || null,
    trailAcc: 0
  });
}

export function spawnProjectile(
  fromPos: THREE.Vector3,
  toPos: THREE.Vector3,
  colorHex: THREE.ColorRepresentation,
  onImpact?: (() => void) | null
): void {
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshBasicMaterial({ color: colorHex })
  );
  launchProjectile(orb, fromPos, toPos, onImpact, { speed: 3.5, arc: 1.4 });
}

export function spawnBurst(
  origin: THREE.Vector3,
  count: number,
  color: THREE.ColorRepresentation,
  life = 0.5,
  speed = 3.2
): void {
  for (let i = 0; i < count; i++) {
    const mote = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glowMaterial(color, 1));
    mote.position.copy(origin);
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const vel = new THREE.Vector3(Math.cos(ang) * speed, 1.2 + Math.random() * 2.4, Math.sin(ang) * speed);
    spawnVfx(mote, life, (v, dt) => {
      vel.y -= 7 * dt;
      v.mesh.position.addScaledVector(vel, dt);
      (mote.material as THREE.MeshBasicMaterial).opacity = 1 - v.age / v.life;
      v.mesh.scale.setScalar(1 - v.age / v.life * 0.6);
    });
  }
}

export function spawnExpandingRing(
  position: THREE.Vector3,
  color: THREE.ColorRepresentation,
  life = 0.7,
  grow = 4.2,
  inner = 0.35,
  outer = 0.52
): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 32),
    glowMaterial(color, 0.9)
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(position);
  ring.position.y += 0.08;
  spawnVfx(ring, life, (v) => {
    const t = v.age / v.life;
    v.mesh.scale.setScalar(1 + t * grow);
    const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * fade;
  });
  return ring;
}

export interface SlashArcOptions {
  inner?: number;
  outer?: number;
  theta0?: number;
  thetaLen?: number;
  opacity?: number;
  roll?: number;
  scale?: number;
  life?: number;
}

export function spawnSlashArc(
  color: THREE.ColorRepresentation,
  origin: THREE.Vector3,
  yaw: number,
  opts: SlashArcOptions = {}
): void {
  const arc = new THREE.Mesh(
    new THREE.RingGeometry(opts.inner ?? 0.5, opts.outer ?? 0.78, 28, 1, opts.theta0 ?? 0.25, opts.thetaLen ?? 1.65),
    glowMaterial(color, opts.opacity ?? 0.95)
  );
  arc.position.copy(origin);
  arc.lookAt(origin.x + Math.sin(yaw) * 4, origin.y, origin.z + Math.cos(yaw) * 4);
  arc.rotateZ(opts.roll ?? 0.55);
  const base = opts.scale ?? 1;
  arc.scale.setScalar(base);
  spawnVfx(arc, opts.life ?? 0.48, (v) => {
    const t = v.age / v.life;
    v.mesh.scale.setScalar(base * (1 + t * 0.28));
    (arc.material as THREE.MeshBasicMaterial).opacity = (opts.opacity ?? 0.95) * (1 - t);
  });
}

export function metalSlashTint(item?: Partial<ItemDef> | null): number {
  const tier = item?.tier;
  if (tier === 'bronze') return 0xd97706;
  if (tier === 'iron' || tier === 'steel' || tier === 'black') return 0x94a3b8;
  if (tier === 'mithril') return 0x60a5fa;
  if (tier === 'adamant') return 0x34d399;
  if (tier === 'rune') return 0x38bdf8;
  if (tier === 'gilded') return 0xfacc15;
  return (item?.color as number | undefined) || 0xe2e8f0;
}

export function spawnMeleeSlashEffect(
  weaponItem: Partial<ItemDef> | null | undefined,
  playerPos: THREE.Vector3,
  playerYaw: number,
  targetPos: THREE.Vector3,
  isSpec?: boolean
): void {
  const id = weaponItem?.id || '';
  const forward = new THREE.Vector3(Math.sin(playerYaw), 0, Math.cos(playerYaw));
  const origin = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)).add(forward.clone().multiplyScalar(0.95));
  const specScale = isSpec ? 1.35 : 1;
  const impact = targetPos.clone().add(new THREE.Vector3(0, 1.15, 0));

  if (id === 'abyssal_whip') {
    const start = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
    const end = targetPos.clone().add(new THREE.Vector3(0, 1.05, 0));
    const side = new THREE.Vector3(-Math.cos(playerYaw), 0, Math.sin(playerYaw));
    const p1 = start.clone().lerp(end, 0.34).add(side.clone().multiplyScalar(0.72));
    p1.y += 0.5;
    const p2 = start.clone().lerp(end, 0.68).add(side.clone().multiplyScalar(-0.58));
    p2.y += 0.12;
    const curve = new THREE.CatmullRomCurve3([start, p1, p2, end]);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 28, 0.1, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x1c1917, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    ));
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.05, 8, false), glowMaterial(0xf87171, 1)));
    spawnVfx(grp, 0.75, (v) => {
      const t = v.age / v.life;
      v.mesh.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.material && (mesh.material as THREE.Material).transparent) {
          (mesh.material as THREE.Material).opacity = 1 - t;
        }
      });
    });
    if (isSpec) {
      const p1b = start.clone().lerp(end, 0.34).add(side.clone().multiplyScalar(-0.72));
      p1b.y += 0.5;
      const p2b = start.clone().lerp(end, 0.68).add(side.clone().multiplyScalar(0.58));
      p2b.y += 0.12;
      const twin = new THREE.CatmullRomCurve3([start, p1b, p2b, end]);
      const twinGrp = new THREE.Group();
      twinGrp.add(new THREE.Mesh(new THREE.TubeGeometry(twin, 28, 0.08, 8, false), glowMaterial(0x6d28d9, 0.9)));
      twinGrp.add(new THREE.Mesh(new THREE.TubeGeometry(twin, 28, 0.04, 8, false), glowMaterial(0xf87171, 1)));
      spawnVfx(twinGrp, 0.75, (v) => {
        const t = v.age / v.life;
        v.mesh.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.material && (mesh.material as THREE.Material).transparent) {
            (mesh.material as THREE.Material).opacity = 1 - t;
          }
        });
      });
    }
    const crack = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 20), glowMaterial(0x7c3aed, 0.9));
    crack.position.copy(end);
    crack.lookAt(end.x, end.y + 1, end.z);
    spawnVfx(crack, 0.48, (v) => {
      const t = v.age / v.life;
      v.mesh.scale.setScalar(1 + t * 1.8);
      (crack.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    });
    return;
  }

  if (id === 'dragon_scimitar' || id === 'dragon_dagger') {
    spawnSlashArc(0xdc2626, origin, playerYaw, { scale: 1.15 * specScale, roll: 0.7, life: 0.85 });
    spawnSlashArc(0xfde047, origin.clone().add(forward.clone().multiplyScalar(0.18)), playerYaw, {
      scale: 0.82 * specScale, roll: -0.35, inner: 0.42, outer: 0.62, life: 0.46
    });
    spawnBurst(impact, 8, 0xf97316, 0.48, 3.4);
    spawnBurst(impact, 4, 0xfde047, 0.4, 2.2);
    if (isSpec) {
      spawnSlashArc(0xdc2626, origin, playerYaw, { scale: 1.25, roll: Math.PI / 2, life: 0.7, inner: 0.45, outer: 0.72 });
      spawnSlashArc(0xfde047, origin, playerYaw, { scale: 1.05, roll: -Math.PI / 2, life: 0.55, inner: 0.35, outer: 0.55 });
    }
    return;
  }

  if (id === 'rune_scimitar') {
    spawnSlashArc(0x22d3ee, origin, playerYaw, { scale: 1.05 * specScale, life: 0.46 });
    spawnBurst(impact, 4, 0x67e8f9, 0.4, 2.6);
    return;
  }

  if (id === 'dharok_greataxe' || weaponItem?.iconKind === 'greataxe') {
    // Massive two-handed vertical downward chop
    spawnSlashArc(0xa3e635, origin, playerYaw, { scale: 1.55 * specScale, roll: Math.PI / 2, life: 0.55 });
    spawnExpandingRing(targetPos.clone().setY(targetPos.y), 0xa3e635, isSpec ? 0.8 : 0.55, isSpec ? 6.2 : 3.8);
    spawnBurst(impact, 10, 0x78350f, 0.5, 3.4);
    spawnBurst(impact, 8, 0xbef264, 0.42, 2.8);
    return;
  }

  if (id === 'inquisitor_mace' || weaponItem?.iconKind === 'mace') {
    // Heavy blunt crushing slam with holy radiance
    spawnSlashArc(0xfacc15, origin, playerYaw, { scale: 1.35 * specScale, roll: Math.PI / 2.3, life: 0.48 });
    spawnExpandingRing(targetPos.clone().setY(targetPos.y), 0xfacc15, 0.6, 3.6);
    spawnBurst(impact, 12, 0xfde047, 0.45, 3.8);
    spawnBurst(impact, 6, 0xffffff, 0.35, 2.4);
    return;
  }

  if (id === 'bandos_godsword' || id === 'master_sword' || id === 'deity_sword' || weaponItem?.iconKind === 'greatsword') {
    const sacred = id === 'master_sword' || id === 'deity_sword';
    const color = sacred ? 0x7dd3fc : 0xfde047;
    spawnSlashArc(color, origin, playerYaw, { scale: 1.45 * specScale, inner: 0.7, outer: 1.05, life: 0.58, roll: 0.3 });
    const pillarH = isSpec ? (id === 'bandos_godsword' ? 7.2 : 6.4) : 3.5;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(isSpec ? 0.28 : 0.16, isSpec ? 0.7 : 0.42, pillarH, 16, 1, true),
      glowMaterial(color, 0.8)
    );
    column.position.set(targetPos.x, targetPos.y + pillarH * 0.5, targetPos.z);
    if (isSpec && sacred) {
      const goldBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.2, pillarH + 1.2, 12, 1, true),
        glowMaterial(0xfde047, 0.85)
      );
      goldBeam.position.set(targetPos.x, targetPos.y + (pillarH + 1.2) * 0.5, targetPos.z);
      spawnVfx(goldBeam, 0.85, (v) => {
        const t = v.age / v.life;
        (goldBeam.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
      });
    }
    spawnVfx(column, 0.7, (v) => {
      const t = v.age / v.life;
      v.mesh.scale.set(1 + t * 0.4, 1, 1 + t * 0.4);
      (column.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
    });
    spawnExpandingRing(targetPos.clone().setY(targetPos.y), color, isSpec ? 0.85 : 0.6, isSpec ? 6.4 : 3.2);
    return;
  }

  spawnSlashArc(metalSlashTint(weaponItem), origin, playerYaw, { scale: specScale, life: 0.4 });
}

export function spawnSpellImpact(
  spell: Partial<SpellDef> | null | undefined,
  targetPos: THREE.Vector3,
  casterPos?: THREE.Vector3 | null
): void {
  const id = spell?.id || '';
  const ground = targetPos.clone();
  if (id === 'wind_strike') {
    spawnExpandingRing(ground, 0xe0f2fe, 1.25, 3.2, 0.28, 0.5);
    spawnExpandingRing(ground, 0x38bdf8, 1.05, 2.2, 0.15, 0.28);
    const gust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.42, 1.7, 16, 1, true),
      glowMaterial(0xf8fafc, 0.8)
    );
    gust.position.set(targetPos.x, targetPos.y + 0.9, targetPos.z);
    spawnVfx(gust, 0.7, (v) => {
      const t = v.age / v.life;
      v.mesh.scale.set(1 + t * 1.4, 1, 1 + t * 1.4);
      (gust.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
    });
    spawnBurst(targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), 6, 0x7dd3fc, 0.45, 2.4);
    return;
  }
  if (id === 'fire_bolt') {
    spawnBurst(targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), 8, 0xf97316, 0.55, 3.6);
    spawnBurst(targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)), 4, 0xef4444, 0.45, 2.4);
    return;
  }
  if (id === 'ice_burst') {
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 1.35, 6),
        new THREE.MeshBasicMaterial({
          color: 0x7dd3fc,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      const x = targetPos.x + Math.cos(ang) * 0.95;
      const z = targetPos.z + Math.sin(ang) * 0.95;
      spire.position.set(x, targetPos.y, z);
      spire.scale.y = 0.02;
      spawnVfx(spire, 1.45, (v) => {
        const grow = Math.min(1, v.age / 0.22);
        v.mesh.scale.y = grow;
        v.mesh.position.y = targetPos.y + (1.35 * grow) * 0.5;
        if (v.age > 0.9) (spire.material as THREE.MeshBasicMaterial).opacity = 0.72 * (1 - (v.age - 0.9) / 0.55);
      });
    }
    spawnExpandingRing(ground, 0x38bdf8, 0.8, 4.6, 0.4, 0.62);
    return;
  }
  if (id === 'blood_barrage') {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.9, 4.2, 18, 1, true),
      glowMaterial(0xdc2626, 0.88)
    );
    pillar.position.set(targetPos.x, targetPos.y + 2.1, targetPos.z);
    for (let i = 0; i < 6; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowMaterial(0xfb7185, 1));
      const ang = (i / 6) * Math.PI * 2;
      drop.position.set(Math.cos(ang) * 0.72, -1.3 + i * 0.55, Math.sin(ang) * 0.72);
      pillar.add(drop);
    }
    spawnVfx(pillar, 1.35, (v, dt) => {
      const t = v.age / v.life;
      const pulse = 1 + Math.sin(v.age * 18) * 0.08;
      v.mesh.scale.set(pulse, 1, pulse);
      v.mesh.rotation.y += dt * 5;
      (pillar.material as THREE.MeshBasicMaterial).opacity = 0.88 * (1 - Math.max(0, t - 0.45) / 0.55);
    });
    const sigil = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 28), glowMaterial(0xbe123c, 0.95));
    sigil.rotation.x = -Math.PI / 2;
    sigil.position.set(targetPos.x, targetPos.y + 0.1, targetPos.z);
    spawnVfx(sigil, 1.2, (v) => {
      const t = v.age / v.life;
      v.mesh.scale.setScalar(1 + t * 2.4);
      v.mesh.rotation.z += 0.02;
      (sigil.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
    });
    spawnBurst(targetPos.clone().add(new THREE.Vector3(0, 1.3, 0)), 10, 0xfb7185, 0.7, 3.1);
    const from = targetPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const to = (casterPos || player.pos).clone().add(new THREE.Vector3(0, 1.35, 0));
    for (let i = 0; i < 3; i++) {
      const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glowMaterial(0xf43f5e, 1));
      const start = from.clone();
      const end = to.clone();
      const side = new THREE.Vector3((i - 1) * 0.7, 0, (1 - i) * 0.35);
      const ctrl = start.clone().lerp(end, 0.5).add(side);
      ctrl.y += 1.8 + i * 0.25;
      spawnVfx(wisp, 0.9, (v) => {
        const t = v.age / v.life;
        const a = start.clone().lerp(ctrl, t);
        const b = ctrl.clone().lerp(end, t);
        v.mesh.position.lerpVectors(a, b, t);
        (wisp.material as THREE.MeshBasicMaterial).opacity = 1 - t * 0.2;
      });
    }
  }
}

export function spawnRunicCircle(
  pos: THREE.Vector3,
  colorHex: THREE.ColorRepresentation,
  life = 0.85,
  scale = 1.0
): void {
  const grp = new THREE.Group();
  grp.position.set(pos.x, getTerrainHeight(pos.x, pos.z) + 0.05, pos.z);

  const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.72 * scale, 0.82 * scale, 32), glowMaterial(colorHex, 0.9));
  outerRing.rotation.x = -Math.PI / 2;
  grp.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.36 * scale, 0.42 * scale, 24), glowMaterial(colorHex, 0.95));
  innerRing.rotation.x = -Math.PI / 2;
  grp.add(innerRing);

  const glyphs = new THREE.Group();
  for (let a = 0; a < 8; a++) {
    const spoke = new THREE.Mesh(new THREE.PlaneGeometry(0.04 * scale, 0.36 * scale), glowMaterial(colorHex, 0.9));
    spoke.rotation.x = -Math.PI / 2;
    spoke.rotation.z = (a / 8) * Math.PI * 2;
    spoke.position.set(Math.cos(spoke.rotation.z) * 0.56 * scale, 0, Math.sin(spoke.rotation.z) * 0.56 * scale);
    glyphs.add(spoke);
  }
  grp.add(glyphs);

  spawnVfx(grp, life, (v, dt) => {
    const t = v.age / v.life;
    glyphs.rotation.y += dt * 2.5;
    outerRing.rotation.z -= dt * 1.5;
    const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    v.mesh.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.material && (mesh.material as THREE.Material).transparent) {
        (mesh.material as THREE.Material).opacity = fade * 0.92;
      }
    });
  });
}

export function spawnSpellProjectile(
  spell: Partial<SpellDef> | null | undefined,
  fromPos: THREE.Vector3,
  toPos: THREE.Vector3,
  onImpact?: (() => void) | null
): void {
  const id = spell?.id || 'wind_strike';
  const spellColor = id === 'fire_bolt' ? 0xf97316 : (id === 'ice_burst' ? 0x38bdf8 : (id === 'blood_barrage' ? 0xf43f5e : 0xa855f7));
  spawnRunicCircle(fromPos, spellColor, 0.8, 1.15);
  const grp = new THREE.Group();
  let speed = 4.2;
  let arc = 0.7;
  let onTick: ((p: ProjectileEntry, dt: number) => void) | null = null;

  if (id === 'wind_strike') {
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), glowMaterial(0xf8fafc, 1)));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.028, 8, 20), glowMaterial(0xbae6fd, 0.95));
    ring.rotation.x = 1.1;
    grp.add(ring);
    speed = 6.2;
    arc = 0.35;
    onTick = (_p, dt) => { ring.rotation.z += dt * 9; };
  } else if (id === 'fire_bolt') {
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), glowMaterial(0xf97316, 1)));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), glowMaterial(0xfde047, 1));
    grp.add(core);
    speed = 4.4;
    arc = 0.65;
    onTick = (p, dt) => {
      p.trailAcc = (p.trailAcc ?? 0) + dt;
      if (p.trailAcc < 0.03) return;
      p.trailAcc = 0;
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMaterial(Math.random() > 0.5 ? 0xf97316 : 0xfde047, 0.9));
      ember.position.copy(p.mesh.position);
      spawnVfx(ember, 0.32, (v) => {
        v.mesh.scale.setScalar(1 - v.age / v.life);
        (ember.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - v.age / v.life);
      });
    };
  } else if (id === 'ice_burst') {
    const comet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), glowMaterial(0x38bdf8, 1));
    comet.scale.set(0.75, 1.45, 0.75);
    grp.add(comet);
    speed = 3.8;
    arc = 0.45;
  } else if (id === 'blood_barrage') {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), glowMaterial(0x7f1d1d, 0.85));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), glowMaterial(0xdc2626, 1));
    grp.add(shell, core);
    const drops = [0, 1, 2].map((i) => {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glowMaterial(0xfb7185, 1));
      drop.userData.orbit = i;
      grp.add(drop);
      return drop;
    });
    speed = 2.6;
    arc = 0.85;
    onTick = (p) => {
      const pulse = 1 + Math.sin(p.progress * 28) * 0.14;
      shell.scale.setScalar(pulse);
      drops.forEach((drop, i) => {
        const a = performance.now() * 0.008 + i * (Math.PI * 2 / 3);
        drop.position.set(Math.cos(a) * 0.42, Math.sin(a * 1.4) * 0.12, Math.sin(a) * 0.42);
      });
    };
  } else {
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: spell?.color || 0xffffff })));
  }

  const orient = id === 'ice_burst';
  launchProjectile(grp, fromPos, toPos, () => {
    spawnSpellImpact(spell, toPos, fromPos);
    if (onImpact) onImpact();
  }, { speed, arc, orient, onTick, y0: 1.45, y1: 1.15 });
}

export function spawnArrowProjectile(
  weapon: Partial<ItemDef> | null | undefined,
  fromPos: THREE.Vector3,
  toPos: THREE.Vector3,
  onImpact?: (() => void) | null
): void {
  const grp = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.015, 0.72, 8),
    new THREE.MeshBasicMaterial({ color: 0xe7e5e4 })
  );
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.16, 8),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc })
  );
  head.position.y = 0.42;
  grp.add(shaft, head);
  const fletchColor = weapon?.id === 'ancient_bow' ? 0x38bdf8 : weapon?.id === 'magic_bow' ? 0x34d399 : 0xf8fafc;
  for (let i = 0; i < 3; i++) {
    const fletch = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.16),
      new THREE.MeshBasicMaterial({ color: fletchColor, side: THREE.DoubleSide })
    );
    fletch.position.y = -0.28;
    fletch.rotation.y = (i / 3) * Math.PI;
    grp.add(fletch);
  }
  const trail = weapon?.id === 'ancient_bow' ? 0x22d3ee : weapon?.id === 'magic_bow' ? 0x34d399 : 0;
  launchProjectile(grp, fromPos, toPos, onImpact, {
    speed: 7.2,
    arc: 0.28,
    orient: true,
    y0: 1.35,
    y1: 1.15,
    onTick: trail ? (p, dt) => {
      p.trailAcc = (p.trailAcc ?? 0) + dt;
      if (p.trailAcc < 0.025) return;
      p.trailAcc = 0;
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), glowMaterial(trail, 0.85));
      spark.position.copy(p.mesh.position);
      spawnVfx(spark, 0.22, (v) => {
        (spark.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - v.age / v.life);
      });
    } : null
  });
}

export function spawnPiercingBeam(
  fromPos: THREE.Vector3,
  toPos: THREE.Vector3,
  color: THREE.ColorRepresentation
): void {
  const start = fromPos.clone().add(new THREE.Vector3(0, 1.35, 0));
  const end = toPos.clone().add(new THREE.Vector3(0, 1.15, 0));
  const delta = end.clone().sub(start);
  const len = Math.max(0.2, delta.length());
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 10), glowMaterial(color, 0.95));
  beam.position.copy(start.clone().add(delta.clone().multiplyScalar(0.5)));
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  spawnVfx(beam, 0.45, (v) => {
    const t = v.age / v.life;
    (beam.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
    v.mesh.scale.x = 1 + t * 2;
    v.mesh.scale.z = 1 + t * 2;
  });
  spawnBurst(end, 8, color, 0.4, 3.2);
}

export function spawnRareLootBeam(worldPos: THREE.Vector3): void {
  const grp = new THREE.Group();
  const gold = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 6.5, 16, 1, true), glowMaterial(0xfde047, 0.88));
  gold.position.y = 3.25;
  const purple = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 6.8, 12, 1, true), glowMaterial(0xa855f7, 0.75));
  purple.position.y = 3.4;
  grp.add(gold, purple);
  grp.position.set(worldPos.x, worldPos.y, worldPos.z);
  spawnVfx(grp, 3.5, (v, dt) => {
    v.mesh.rotation.y += dt * 1.6;
    const t = v.age / v.life;
    const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    (gold.material as THREE.MeshBasicMaterial).opacity = 0.88 * fade;
    (purple.material as THREE.MeshBasicMaterial).opacity = 0.75 * fade;
  });
  for (let i = 0; i < 14; i++) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), glowMaterial(i % 2 ? 0xfde047 : 0xc084fc, 1));
    spark.position.set(worldPos.x, worldPos.y + 0.4, worldPos.z);
    const ang = (i / 14) * Math.PI * 2;
    const vel = new THREE.Vector3(Math.cos(ang) * 0.7, 1.5 + (i % 4) * 0.35, Math.sin(ang) * 0.7);
    spawnVfx(spark, 3.5, (v, dt) => {
      vel.y -= 0.35 * dt;
      v.mesh.position.addScaledVector(vel, dt);
      (spark.material as THREE.MeshBasicMaterial).opacity = 1 - v.age / v.life;
    });
  }
}

export function spawnDragonfireEffect(
  monster: Pick<MonsterEntity, 'pos'>,
  onImpact?: (() => void) | null
): void {
  const from = monster.pos.clone();
  const to = player.pos.clone();
  spawnExpandingRing(to, 0xf97316, 1.05, 2.6, 0.45, 0.75);
  const grp = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.6, 14), glowMaterial(0xf97316, 0.92));
  cone.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 12), glowMaterial(0xfde047, 1));
  core.rotation.x = Math.PI / 2;
  grp.add(cone, core);
  launchProjectile(grp, from, to, () => {
    spawnExpandingRing(player.pos, 0xef4444, 0.85, 4.2, 0.5, 0.8);
    spawnBurst(player.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 12, 0xf97316, 0.6, 3.4);
    spawnBurst(player.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 6, 0xfde047, 0.45, 2.2);
    if (onImpact) onImpact();
  }, { speed: 1.7, arc: 0.25, orient: true, y0: 3.2, y1: 1.1 });
}

export function spawnShadowBolt(
  fromPos: THREE.Vector3,
  toPos: THREE.Vector3,
  onImpact?: (() => void) | null
): void {
  const grp = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), glowMaterial(0x1c1917, 0.95));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMaterial(0x7c3aed, 1));
  grp.add(shell, core);
  launchProjectile(grp, fromPos, toPos, () => {
    spawnExpandingRing(toPos, 0x4c1d95, 0.6, 3.1, 0.32, 0.55);
    if (onImpact) onImpact();
  }, {
    speed: 4.1,
    arc: 0.35,
    y0: 1.7,
    y1: 1.2,
    onTick: (_p, dt) => {
      grp.rotation.y += dt * 9;
      grp.rotation.z += dt * 6;
    }
  });
}

export function spawnHellfireOrb(
  fromPos: THREE.Vector3,
  toPos: THREE.Vector3,
  onImpact?: (() => void) | null
): void {
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), glowMaterial(0xef4444, 1)));
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMaterial(0xf97316, 1)));
  launchProjectile(grp, fromPos, toPos, onImpact, {
    speed: 3.3,
    arc: 0.7,
    y0: 1.8,
    y1: 1.2,
    onTick: (p, dt) => {
      p.trailAcc = (p.trailAcc ?? 0) + dt;
      if (p.trailAcc < 0.04) return;
      p.trailAcc = 0;
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), glowMaterial(0xf97316, 0.95));
      ember.position.copy(p.mesh.position);
      spawnVfx(ember, 0.32, (v) => {
        (ember.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - v.age / v.life);
      });
    }
  });
}

export function spawnLevelUpFireworks(colorHex: THREE.ColorRepresentation = 0xfde047): void {
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 7, 6),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    const ang = (i / 16) * Math.PI * 2;
    p.position.copy(player.pos).add(new THREE.Vector3(Math.cos(ang) * 0.8, 1.0, Math.sin(ang) * 0.8));
    G.scene.add(p);
    const vel = new THREE.Vector3(Math.cos(ang) * 2.5, 3.5 + Math.random() * 2, Math.sin(ang) * 2.5);
    const startT = performance.now();
    const tick = (): void => {
      const dt = (performance.now() - startT) / 1000;
      if (dt > 0.9) {
        G.scene.remove(p);
        return;
      }
      p.position.addScaledVector(vel, 0.016);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
