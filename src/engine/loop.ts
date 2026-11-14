import * as THREE from 'three';
import {
  TICK_SEC,
  player,
  camState,
  _camTargetVec,
  _lookTargetVec,
  telemetryInfo,
  G,
  MonsterEntity,
  ResourceNodeEntity,
  type PlayerTargetEntity,
  ProjectileEntry,
  VfxEntry,
  SwayingFoliageEntry
} from './context';
import { SFX } from './audio';
import {
  spawnBurst,
  spawnExpandingRing,
  spawnLevelUpFireworks
} from './vfx';
import { poseMonsterLimbs } from './monsterMeshes';
import { syncWhipGeometry } from './playerMesh';
import {
  renderMinimap,
  updateFloatingWorldLabels
} from './overlay';
import { saveGameState } from './session';
import {
  checkRegionChange,
  performPlayerAttack,
  performMonsterRetaliation,
  finishRespawn,
  performResourceGather
} from './actions';
import { disposeObject3D } from './dispose';
import { PRAYERS } from '../data/magic';
import { WORLD_REGIONS } from '../data/world';
import { STATE } from '../state/gameState';
import { getEquipmentBonuses } from '../state/combat';
import { moveWithCollision } from '../state/collision';
import { isDown, stepMonster } from '../state/monsterAi';
import { getTerrainHeight } from '../state/terrain';
import { discoverShrines } from '../state/shrines';
import { addChatMessage, el, updateAllUI } from '../ui/hud';
import {
  openShopModal,
  openBankModal,
  openSmithingModal,
  openWorldMapModal,
  openQuestsModal
} from '../ui/playerActions';

export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

export interface FrameState {
  now: number;
  dt: number;
  elapsedSec: number;
  moveSpeed: number;
  hasMoveIntent: boolean;
  moveDirX: number;
  moveDirZ: number;
}

export function updateVitalsAndRegen(f: FrameState): void {
  if (player.downed) {
    player.downedTimer -= f.dt;
    const count = el('death-count');
    count.textContent = String(Math.max(0, Math.ceil(player.downedTimer)));
    if (player.downedTimer <= 0) finishRespawn();
  } else if (getEquipmentBonuses(STATE).matchedSet) {
    G.setBonusTimer += f.dt;
    const bon = getEquipmentBonuses(STATE);
    const threshold = bon.isFullKit ? 1.25 : 1.7;
    if (G.setBonusTimer > threshold) {
      G.setBonusTimer = 0;
      if (bon.isFullKit) {
        spawnExpandingRing(player.pos, 0x94a3b8, 0.55, 2.2, 0.45, 0.65);
        spawnExpandingRing(player.pos, 0xc5a059, 0.35, 1.5, 0.35, 0.45);
      } else {
        spawnExpandingRing(player.pos, 0xc5a059, 0.55, 1.8, 0.42, 0.55);
      }
    }
  }

  if (G.waterUniforms) G.waterUniforms.uTime.value = f.elapsedSec;
  if (G.skyUniforms) G.skyUniforms.uTime.value = f.elapsedSec;
  if (G.skyDomeMesh) G.skyDomeMesh.position.copy(player.pos);

  if (STATE.specEnergy < 100) {
    STATE.specEnergy = Math.min(100, STATE.specEnergy + f.dt * 2.5);
  }
  if (STATE.hp < STATE.maxHp && STATE.hp > 0) {
    STATE.hp = Math.min(STATE.maxHp, STATE.hp + f.dt * 0.25);
  }
  if (STATE.activePrayers.size > 0) {
    let drainRate = 0;
    PRAYERS.forEach(p => { if (STATE.activePrayers.has(p.id)) drainRate += p.drain; });
    STATE.prayerPts = Math.max(0, STATE.prayerPts - drainRate * f.dt);
    if (STATE.prayerPts <= 0) {
      STATE.activePrayers.clear();
      addChatMessage('You have run out of Prayer points! Your prayers have deactivated.', 'combat');
      updateAllUI();
    }
  }
}

export function updatePlayerIntent(f: FrameState): void {
  const turnSpeed = 2.6;

  if (G.keysPressed['KeyQ']) camState.manualOffset += turnSpeed * f.dt;
  if (G.keysPressed['KeyE']) camState.manualOffset -= turnSpeed * f.dt;

  if (player.downed) {
    player.targetPos = null;
    player.targetEntity = null;
  }

  if (!player.downed && (G.keysPressed['KeyA'] || G.keysPressed['ArrowLeft'])) {
    player.yaw += turnSpeed * f.dt;
  }
  if (!player.downed && (G.keysPressed['KeyD'] || G.keysPressed['ArrowRight'])) {
    player.yaw -= turnSpeed * f.dt;
  }

  let forwardInput = 0;
  if (!player.downed && (G.keysPressed['KeyW'] || G.keysPressed['ArrowUp'])) forwardInput += 1;
  if (!player.downed && (G.keysPressed['KeyS'] || G.keysPressed['ArrowDown'])) forwardInput -= 0.75;

  let hasMoveIntent = false;
  let moveDirX = 0;
  let moveDirZ = 0;

  if (forwardInput !== 0) {
    hasMoveIntent = true;
    player.targetPos = null;
    player.targetEntity = null;
    const sign = forwardInput > 0 ? 1 : -0.75;
    moveDirX = Math.sin(player.yaw) * sign;
    moveDirZ = Math.cos(player.yaw) * sign;
    if (!camState.isDragging) {
      camState.manualOffset *= Math.pow(0.15, f.dt);
    }
  } else if (player.targetEntity) {
    const tType = player.targetEntity.type;
    let targetVec: THREE.Vector3 | null = null;
    let stopDist = 2.8;

    if (tType === 'monster') {
      const m = player.targetEntity.ref;
      if (isDown(m.logic)) {
        player.targetEntity = null;
      } else {
        targetVec = m.pos;
        stopDist = (STATE.combatStyle === 'rapid' || STATE.combatStyle === 'ranged' || STATE.combatStyle === 'magic') ? 13.5 : 2.9;
      }
    } else if (tType === 'resource') {
      const r = player.targetEntity.ref;
      if (r.depleted) {
        player.targetEntity = null;
      } else {
        targetVec = r.pos;
        stopDist = 3.1;
      }
    } else if (tType === 'interactive') {
      targetVec = player.targetEntity.pos ?? null;
      stopDist = 3.5;
    }

    if (targetVec) {
      const dx = targetVec.x - player.pos.x;
      const dz = targetVec.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      const desiredYaw = Math.atan2(dx, dz);
      player.yaw = lerpAngle(player.yaw, desiredYaw, Math.min(1, f.dt * 10));

      if (dist > stopDist) {
        hasMoveIntent = true;
        moveDirX = dx / dist;
        moveDirZ = dz / dist;
        if (!camState.isDragging) camState.manualOffset *= Math.pow(0.25, f.dt);
      } else {
        if (tType === 'interactive') {
          const act = (player.targetEntity!.ref as THREE.Object3D['userData']).action;
          player.targetEntity = null;
          if (act === 'shop') openShopModal('all');
          else if (act === 'bank') openBankModal();
          else if (act === 'forge') openSmithingModal();
          else if (act === 'worldmap') openWorldMapModal();
          else if (act === 'slayer') openQuestsModal();
          else if (act === 'dialogue') {
            const dlg = ((player.targetEntity as PlayerTargetEntity | null)!.ref as THREE.Object3D['userData']).dialogue || 'Greetings, traveler.';
            const name = ((player.targetEntity as PlayerTargetEntity | null)!.ref as THREE.Object3D['userData']).name || 'Guard';
            addChatMessage(`${name}: "${dlg}"`, 'combat');
          }
          else if (act === 'altar') {
            STATE.prayerPts = STATE.maxPrayerPts;
            STATE.hp = STATE.maxHp;
            SFX.prayer();
            spawnLevelUpFireworks(0x38bdf8);
            addChatMessage('You pray at the sacred Altar. Your Prayer points and Hitpoints are fully restored!', 'skill');
            updateAllUI();
          }
        } else if (player.actionCooldown <= 0) {
          if (tType === 'monster') {
            performPlayerAttack(player.targetEntity!.ref as MonsterEntity);
            player.actionCooldown = TICK_SEC;
          } else if (tType === 'resource') {
            performResourceGather(player.targetEntity!.ref as ResourceNodeEntity);
            player.actionCooldown = TICK_SEC;
          }
        }
      }
    }
  } else if (player.targetPos) {
    const dx = player.targetPos.x - player.pos.x;
    const dz = player.targetPos.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.45) {
      hasMoveIntent = true;
      const desiredYaw = Math.atan2(dx, dz);
      player.yaw = lerpAngle(player.yaw, desiredYaw, Math.min(1, f.dt * 10));
      moveDirX = dx / dist;
      moveDirZ = dz / dist;
      if (!camState.isDragging) camState.manualOffset *= Math.pow(0.25, f.dt);
    } else {
      player.targetPos = null;
    }
  }

  f.hasMoveIntent = hasMoveIntent;
  f.moveDirX = moveDirX;
  f.moveDirZ = moveDirZ;
}

export function updatePlayerMotion(f: FrameState): void {
  // Smooth Acceleration & Deceleration Momentum
  const targetSpeed = f.hasMoveIntent ? f.moveSpeed : 0;
  const accelRate = f.hasMoveIntent ? 16 : 12;
  player.currentSpeed = (player.currentSpeed ?? 0) + (targetSpeed - (player.currentSpeed ?? 0)) * Math.min(1, f.dt * accelRate);
  if (!f.hasMoveIntent && Math.abs(player.currentSpeed) < 0.05) {
    player.currentSpeed = 0;
  }

  if (player.currentSpeed > 0.02 && (f.moveDirX !== 0 || f.moveDirZ !== 0)) {
    const stepped = moveWithCollision(player.pos.x, player.pos.z, f.moveDirX * player.currentSpeed * f.dt, f.moveDirZ * player.currentSpeed * f.dt);
    player.pos.x = stepped.x;
    player.pos.z = stepped.z;
  }

  if (player.actionCooldown > 0) player.actionCooldown -= f.dt;

  const groundY = Math.max(-0.25, getTerrainHeight(player.pos.x, player.pos.z));
  if (!player.isGrounded) {
    player.pos.y += player.jumpVel * f.dt;
    player.jumpVel -= 20.0 * f.dt;
    if (player.pos.y <= groundY) {
      player.pos.y = groundY;
      player.isGrounded = true;
      player.jumpVel = 0;
    }
  } else {
    // Smooth terrain follow
    player.pos.y += (groundY - player.pos.y) * Math.min(1, f.dt * 18);
  }

  player.isMoving = player.currentSpeed > 0.4;
  player.meshGroup!.position.copy(player.pos);

  // Smooth Yaw & Turning Angular Velocity
  const lastMeshYaw = player.meshGroup!.rotation.y;
  const targetMeshYaw = player.yaw + Math.PI;
  player.meshGroup!.rotation.y = lerpAngle(player.meshGroup!.rotation.y, targetMeshYaw, Math.min(1, f.dt * 12));

  let turnDelta = (player.meshGroup!.rotation.y - lastMeshYaw) / Math.max(0.001, f.dt);
  if (turnDelta > Math.PI) turnDelta -= Math.PI * 2;
  if (turnDelta < -Math.PI) turnDelta += Math.PI * 2;
  player.yawVelocity = (player.yawVelocity ?? 0) * 0.8 + turnDelta * 0.2;

  // Dynamic Bank Roll (lean subtly into turns while running)
  const targetBank = player.isMoving ? THREE.MathUtils.clamp(-player.yawVelocity * 0.07, -0.20, 0.20) : 0;
  player.bankRoll = (player.bankRoll ?? 0) + (targetBank - (player.bankRoll ?? 0)) * Math.min(1, f.dt * 10);
  player.meshGroup!.rotation.z = player.bankRoll;
}

export function updatePlayerAnimation(f: FrameState): void {
  // Dynamic cape physics: realistic cloth aerodynamics in Three.js coordinates
  // Note: with Y-up & -Z forward, negative rotation.x swings cape BACKWARD (+Z away from body).
  const updateCapePhysics = (isMoving: boolean, animTime: number): void => {
    if (!player.parts.capeMesh) return;
    const isAva = player.parts.capeMesh.userData?.silhouette === 'ava';
    if (isAva) {
      player.parts.capeMesh.rotation.set(0, 0, 0);
      return;
    }

    // Dynamic backward leg clearance:
    // In our rig, positive rotation.x swings thigh backward (+Z into the cape volume)
    const leftLegRx = player.parts.leftLegPivot?.rotation.x ?? 0;
    const rightLegRx = player.parts.rightLegPivot?.rotation.x ?? 0;
    const maxRearLegKick = Math.max(0, leftLegRx, rightLegRx);
    const rearLegClearance = maxRearLegKick * 0.55;

    const speedRatio = player.currentSpeed / f.moveSpeed;
    // Aerodynamic wind billow pushes cape BACKWARD (negative pitch) in slipstream
    const windFlare = speedRatio * 0.44;

    const flutter = isMoving
      ? (Math.sin(animTime * 2.2) * 0.05 + Math.cos(animTime * 4.4) * 0.02)
      : (Math.sin(animTime * 0.8) * 0.012);

    // Resting backward drape: -0.12 rad cleanly arches backward past buttocks & belt
    const baseBackwardDrape = isMoving ? 0.28 : 0.12;
    const targetWorldBackwardPitch = -(baseBackwardDrape + windFlare + rearLegClearance + flutter);

    // Counteract torso pitch so torso forward lean never pulls cape into the body
    const torsoPitch = player.parts.torso?.rotation.x ?? 0;
    const targetLocalPitch = targetWorldBackwardPitch - torsoPitch;

    // Centrifugal roll & inertia during turns: cloth swings outward away from turn
    const targetRoll = THREE.MathUtils.clamp(player.yawVelocity * 0.22, -0.38, 0.38) + (isMoving ? Math.sin(animTime * 1.8) * 0.03 : 0);
    const targetYaw = THREE.MathUtils.clamp(-player.yawVelocity * 0.10, -0.20, 0.20);

    player.capeAngleX = (player.capeAngleX ?? -0.12) + (targetLocalPitch - (player.capeAngleX ?? -0.12)) * Math.min(1, f.dt * 10);
    player.capeAngleZ = (player.capeAngleZ ?? 0) + (targetRoll - (player.capeAngleZ ?? 0)) * Math.min(1, f.dt * 8);
    player.capeAngleY = (player.capeAngleY ?? 0) + (targetYaw - (player.capeAngleY ?? 0)) * Math.min(1, f.dt * 8);

    player.parts.capeMesh.rotation.x = player.capeAngleX;
    player.parts.capeMesh.rotation.z = player.capeAngleZ;
    player.parts.capeMesh.rotation.y = player.capeAngleY;

    if (player.parts.capeMesh.userData?.silhouette === 'lava-cape' && Math.random() < 0.22) {
      const emberPos = player.pos.clone().add(new THREE.Vector3(
        -Math.sin(player.yaw) * 0.45 + (Math.random() - 0.5) * 0.2,
        0.5 + Math.random() * 0.3,
        -Math.cos(player.yaw) * 0.45 + (Math.random() - 0.5) * 0.2
      ));
      spawnBurst(emberPos, 1, 0xf97316, 0.35, 0.6);
    }
  };

  if (player.blenderAnimator) {
    player.animTime += f.dt * (player.isMoving ? 4.5 : 2.0);
    player.blenderAnimator.setMoving(player.isMoving);
    player.blenderAnimator.setWalkSpeed(player.currentSpeed / f.moveSpeed);
    player.blenderAnimator.update(f.dt);
    updateCapePhysics(player.isMoving, player.animTime);

    if (player.attackAnim > 0) {
      player.attackAnim = Math.max(0, player.attackAnim - f.dt * 3.6);
    }
  } else {
    if (player.isMoving) {
      player.animTime += f.dt * (player.currentSpeed / f.moveSpeed * 10);
      const phase = player.animTime;
      const swing = Math.sin(phase) * 0.62;
      const bob = Math.cos(phase * 2) * 0.03;
      const sway = Math.sin(phase) * 0.02;

      player.parts.leftLegPivot.rotation.x = swing;
      player.parts.rightLegPivot.rotation.x = -swing;
      player.parts.leftLegPivot.rotation.z = sway * 0.5;
      player.parts.rightLegPivot.rotation.z = -sway * 0.5;

      if (player.parts.leftKneePivot) player.parts.leftKneePivot.rotation.x = -(0.05 + Math.max(0, -swing) * 0.75);
      if (player.parts.rightKneePivot) player.parts.rightKneePivot.rotation.x = -(0.05 + Math.max(0, swing) * 0.75);

      if (player.parts.torso) {
        player.parts.torso.rotation.x = 0.12 + Math.cos(phase * 2) * 0.02;
        player.parts.torso.rotation.y = -Math.sin(phase) * 0.12;
      }

      player.parts.leftArmPivot.rotation.x = 0.10 - swing * 0.58;
      player.parts.leftArmPivot.rotation.z = 0.28;
      if (player.parts.leftElbowPivot) player.parts.leftElbowPivot.rotation.x = 0.45 + Math.max(0, -swing) * 0.25;

      if (player.attackAnim <= 0) {
        player.parts.rightArmPivot.rotation.x = 0.10 + swing * 0.58;
        player.parts.rightArmPivot.rotation.z = -0.28;
        if (player.parts.rightElbowPivot) player.parts.rightElbowPivot.rotation.x = 0.45 + Math.max(0, swing) * 0.25;
      }
      updateCapePhysics(true, player.animTime);
    } else {
      player.animTime += f.dt * 2.0;
      const breath = Math.sin(player.animTime) * 0.035;
      player.parts.leftLegPivot.rotation.x *= 0.85;
      player.parts.rightLegPivot.rotation.x *= 0.85;
      if (player.parts.leftKneePivot) player.parts.leftKneePivot.rotation.x *= 0.85;
      if (player.parts.rightKneePivot) player.parts.rightKneePivot.rotation.x *= 0.85;
      if (player.parts.torso) {
        player.parts.torso.rotation.x = breath * 0.5;
        player.parts.torso.rotation.y *= 0.88;
      }
      player.parts.leftArmPivot.rotation.x = 0.10 + breath;
      player.parts.leftArmPivot.rotation.z = 0.28;
      if (player.parts.leftElbowPivot) player.parts.leftElbowPivot.rotation.x = 0.60 + breath * 0.5;
      if (player.attackAnim <= 0) {
        player.parts.rightArmPivot.rotation.x = 0.10 - breath;
        player.parts.rightArmPivot.rotation.z = -0.28;
        if (player.parts.rightElbowPivot) player.parts.rightElbowPivot.rotation.x = 0.50 - breath * 0.5;
      }
      updateCapePhysics(false, player.animTime);
    }

    if (player.attackAnim > 0) {
      player.attackAnim = Math.max(0, player.attackAnim - f.dt * 3.6);
      const slashAngle = Math.sin(player.attackAnim * Math.PI) * 1.65;
      const k = player.activeWeaponKind;
      if (k === 'greataxe') {
        player.parts.rightArmPivot.rotation.x = -slashAngle;
        if (player.parts.leftArmPivot) player.parts.leftArmPivot.rotation.x = -slashAngle * 0.85;
      } else if (k === 'greatsword') {
        player.parts.rightArmPivot.rotation.x = -slashAngle * 1.1;
        if (player.parts.leftArmPivot) player.parts.leftArmPivot.rotation.x = -slashAngle * 0.9;
      } else if (k === 'mace') {
        player.parts.rightArmPivot.rotation.x = -slashAngle * 1.15;
      } else if (k === 'bow' || k === 'crossbow') {
        if (player.parts.leftArmPivot) player.parts.leftArmPivot.rotation.x = -1.2;
        player.parts.rightArmPivot.rotation.x = -slashAngle * 0.8;
      } else if (k === 'staff' || k === 'wand') {
        player.parts.rightArmPivot.rotation.x = -1.35 * Math.sin(player.attackAnim * Math.PI);
      } else {
        player.parts.rightArmPivot.rotation.x = -slashAngle;
      }
    }
  }
  for (let i = 0; i < G.npcAnimatorsList.length; i++) {
    G.npcAnimatorsList[i].update(f.dt);
  }
  if (player.parts.whipRig) {
    const stretch = player.attackAnim > 0 ? Math.sin(player.attackAnim * Math.PI) : 0;
    if (stretch > 0.001 || player.parts.whipRig.wasLashing) {
      syncWhipGeometry(player.parts.whipRig, stretch);
      player.parts.whipRig.wasLashing = stretch > 0.001;
    }
  }

  if (player.spinAnim > 0) {
    player.spinAnim = Math.max(0, player.spinAnim - f.dt * 2.4);
    player.meshGroup!.rotation.y += (1 - player.spinAnim) * Math.PI * 4;
    player.parts.spinRing.material.opacity = player.spinAnim * 0.85;
    player.parts.spinRing.scale.setScalar(0.8 + (1 - player.spinAnim) * 0.9);
  } else if (player.parts.spinRing) {
    player.parts.spinRing.material.opacity = 0;
  }

  if (G.clickMarkerMesh && G.clickMarkerMesh.userData.life > 0) {
    G.clickMarkerMesh.userData.life = Math.max(0, G.clickMarkerMesh.userData.life - f.dt * 1.4);
    const life = G.clickMarkerMesh.userData.life;
    G.clickMarkerMesh.scale.setScalar(1 + (1 - life) * 0.35);
    G.clickMarkerMesh.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.material && (mesh.material as THREE.Material).transparent) {
        (mesh.material as THREE.Material).opacity = life;
      }
    });
  }
}

export function updateCamera(f: FrameState): void {
  // Smooth Behind-Character Chase Camera
  const desiredCamYaw = player.yaw + camState.manualOffset;
  camState.yaw = lerpAngle(camState.yaw, desiredCamYaw, Math.min(1, f.dt * 8.5));

  const horizDist = Math.cos(camState.pitch) * camState.distance;
  const vertDist  = Math.sin(camState.pitch) * camState.distance;
  const camTargetX = player.pos.x - Math.sin(camState.yaw) * horizDist;
  const camTargetZ = player.pos.z - Math.cos(camState.yaw) * horizDist;
  const terrainUnderCam = getTerrainHeight(camTargetX, camTargetZ);
  const camTargetY = Math.max(terrainUnderCam + 1.2, player.pos.y + 1.85 + vertDist);

  _camTargetVec.set(camTargetX, camTargetY, camTargetZ);
  G.camera.position.lerp(_camTargetVec, Math.min(1, f.dt * 12));
  _lookTargetVec.set(player.pos.x, player.pos.y + 1.85, player.pos.z);
  camState.currentLookAt.lerp(_lookTargetVec, Math.min(1, f.dt * 14));
  G.camera.lookAt(camState.currentLookAt);

  // Micro-Camera Shake Impulse
  if (camState.shake > 0.001) {
    camState.shake *= Math.pow(0.012, f.dt);
    G.camera.position.x += (Math.random() - 0.5) * camState.shake;
    G.camera.position.y += (Math.random() - 0.5) * camState.shake;
  }

  G.sunLight.position.set(player.pos.x + 38, player.pos.y + 58, player.pos.z + 28);
  G.sunLight.target.position.copy(player.pos);
  G.sunLight.target.updateMatrixWorld();
}

export function updateMonsters(f: FrameState): void {
  // Monsters Update: rules in stepMonster, mesh, pose and events here.
  G.monstersList.forEach((m: MonsterEntity) => {
    const L = m.logic;
    const prevState = L.state;
    const prevTimer = L.timer;
    const fromX = m.pos.x;
    const fromZ = m.pos.z;
    const events = stepMonster(L, { playerX: player.pos.x, playerZ: player.pos.z, playerDown: !!player.downed, dt: f.dt, rand: Math.random });

    if (prevState === 'dying') {
      const progress = Math.max(0, 1 - (prevTimer - f.dt) / 0.85);
      m.rig.group.rotation.x = progress * (Math.PI / 2.3);
      m.rig.group.position.y = getTerrainHeight(m.pos.x, m.pos.z) - progress * 0.45;
      if (L.state === 'dead') {
        m.rig.group.visible = false;
        m.rig.group.rotation.x = 0;
      }
      return;
    }

    if (prevState === 'dead') {
      if (events.some(e => e.kind === 'respawned')) {
        m.flinch = 0;
        m.pos.set(L.x, getTerrainHeight(L.x, L.z), L.z);
        m.rig.group.rotation.set(0, 0, 0);
        m.rig.group.visible = true;
      }
      return;
    }

    if (m.rig.lWing && m.rig.rWing) {
      const flap = Math.sin(f.now * 0.006) * 0.35;
      m.rig.lWing.rotation.z = 0.22 + flap;
      m.rig.rWing.rotation.z = -0.22 - flap;
    }

    if (L.state === 'chase' || L.state === 'attack') {
      const dx = player.pos.x - fromX;
      const dz = player.pos.z - fromZ;
      const targetMonYaw = Math.atan2(dx, dz) + Math.PI;
      m.rig.group.rotation.y = lerpAngle(m.rig.group.rotation.y, targetMonYaw, Math.min(1, f.dt * 9));
      if (L.state === 'chase') {
        m.pos.x = L.x;
        m.pos.z = L.z;
        m.pos.y = getTerrainHeight(m.pos.x, m.pos.z);
        poseMonsterLimbs(m, true, f.now, f.dt);
      } else {
        poseMonsterLimbs(m, false, f.now, f.dt);
        if (events.some(e => e.kind === 'attack')) performMonsterRetaliation(m);
      }
    } else if (prevState === 'idle') {
      const dx = L.wanderX - fromX;
      const dz = L.wanderZ - fromZ;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.3) {
        const targetWanderYaw = Math.atan2(dx, dz) + Math.PI;
        m.rig.group.rotation.y = lerpAngle(m.rig.group.rotation.y, targetWanderYaw, Math.min(1, f.dt * 7));
        m.pos.x = L.x;
        m.pos.z = L.z;
        m.pos.y = getTerrainHeight(m.pos.x, m.pos.z);
        poseMonsterLimbs(m, true, f.now, f.dt);
      } else {
        poseMonsterLimbs(m, false, f.now, f.dt);
      }
    }
    // chase or attack that dropped to idle this step: nothing else, as before.
  });
}

export function updateWorldTimers(f: FrameState): void {
  G.resourceNodesList.forEach((r: ResourceNodeEntity) => {
    if (r.depleted) {
      r.respawnTimer -= f.dt;
      if (r.respawnTimer <= 0) {
        r.depleted = false;
        r.visualMesh.visible = true;
        r.depletedMesh.visible = false;
      }
    }
  });

  for (let i = G.projectilesList.length - 1; i >= 0; i--) {
    const p: ProjectileEntry = G.projectilesList[i];
    p.progress += p.speed * f.dt;
    if (p.progress >= 1.0) {
      if (p.onImpact) p.onImpact();
      disposeObject3D(p.mesh);
      G.projectilesList.splice(i, 1);
    } else {
      const arc = p.arc == null ? 1.4 : p.arc;
      p.mesh.position.lerpVectors(p.start, p.end, p.progress);
      p.mesh.position.y += Math.sin(p.progress * Math.PI) * arc;
      if (p.orient) {
        const aheadT = Math.min(1, p.progress + 0.06);
        const next = new THREE.Vector3().lerpVectors(p.start, p.end, aheadT);
        next.y += Math.sin(aheadT * Math.PI) * arc;
        const dir = next.sub(p.mesh.position);
        if (dir.lengthSq() > 1e-8) {
          p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        }
      }
      if (p.onTick) p.onTick(p, f.dt);
    }
  }

  for (let i = G.vfxList.length - 1; i >= 0; i--) {
    const v: VfxEntry = G.vfxList[i];
    v.age += f.dt;
    if (v.onTick) v.onTick(v, f.dt);
    if (v.age >= v.life) {
      disposeObject3D(v.mesh);
      G.vfxList.splice(i, 1);
    }
  }

  G.swayingFoliage.forEach((item: SwayingFoliageEntry) => {
    if (item.rotY) item.mesh.rotation.z += f.dt * item.speed;
  });

  if (f.now - G.lastAutoSaveTime > 2000) {
    G.lastAutoSaveTime = f.now;
    saveGameState();
  }
}

export function updateOverlay(f: FrameState): void {
  checkRegionChange();
  G.labelTick += f.dt;
  G.miniTick += f.dt;
  if (G.labelTick >= 0.1 || Math.hypot(player.pos.x - G.lastLabelX, player.pos.z - G.lastLabelZ) > 0.4) {
    G.labelTick = 0;
    G.lastLabelX = player.pos.x;
    G.lastLabelZ = player.pos.z;
    updateFloatingWorldLabels();
    const found = discoverShrines(player.pos.x, player.pos.z, STATE.shrines);
    if (found.unlocked.length) {
      STATE.shrines = found.shrines;
      found.unlocked.forEach(id => {
        const reg = WORLD_REGIONS.find(r => r.id === id);
        addChatMessage('You discover the <b>' + (reg ? reg.name : id) + '</b> shrine.', 'region');
      });
    }
  }
  el('compass-badge').style.transform = `rotate(${(camState.yaw - Math.PI)}rad)`;

  if (G.miniTick >= 0.08 || Math.hypot(player.pos.x - G.lastLabelX, player.pos.z - G.lastLabelZ) > 0.4) {
    G.miniTick = 0;
    renderMinimap();
  }
  el('tick-arc').style.strokeDashoffset = String(88 * Math.max(0, Math.min(1, player.actionCooldown / TICK_SEC)));
}

export function renderFrame(f: FrameState): void {
  if (G.grassInstanced && G.grassInstanced.material && (G.grassInstanced.material as THREE.ShaderMaterial).uniforms) {
    (G.grassInstanced.material as THREE.ShaderMaterial).uniforms.uTime.value = f.elapsedSec;
  }
  G.renderer.render(G.scene, G.camera);

  G.frameCounter++;
  if (f.now - G.lastFpsTime >= 500) {
    const elapsed = f.now - G.lastFpsTime;
    telemetryInfo.fps = Math.round((G.frameCounter * 1000) / elapsed);
    telemetryInfo.frameTimeMs = Number((elapsed / G.frameCounter).toFixed(1));
    G.frameCounter = 0;
    G.lastFpsTime = f.now;

    el('perf-fps').textContent = `${telemetryInfo.fps} FPS (${telemetryInfo.frameTimeMs}ms)`;
    if (G.renderer) {
      el('perf-calls').textContent = `${G.renderer.info.render.calls} calls • ${Math.round(G.renderer.info.render.triangles / 1000)}k tris`;
    }
  }
}

export function gameLoop(now: number): void {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.08, (now - G.lastFrameTime) / 1000);
  G.lastFrameTime = now;
  const elapsedSec = now * 0.001;

  const f: FrameState = {
    now,
    dt,
    elapsedSec,
    moveSpeed: 11.5,
    hasMoveIntent: false,
    moveDirX: 0,
    moveDirZ: 0
  };

  updateVitalsAndRegen(f);
  updatePlayerIntent(f);
  updatePlayerMotion(f);
  updatePlayerAnimation(f);
  updateCamera(f);
  updateMonsters(f);
  updateWorldTimers(f);
  updateOverlay(f);
  renderFrame(f);
}
