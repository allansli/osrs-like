import * as THREE from 'three';
import { G } from './context';
import { STATE } from '../state/gameState';
import { DAY_CLOCK, GFX_TIERS, type QualityTier, SHADOW_SUN_STEP_DEG } from '../data/look';
import { dayFrameAt, phaseToPreset, presetToPhase, stepPhase, type Vec3 } from '../state/dayCycle';
import { fitShadow, stepShadowDir } from '../state/shadowFit';

let currentPhase = presetToPhase(STATE.timeOfDay);
let isFrozen = false;
let currentShadowDir: Vec3 = [0.52, 0.78, 0.34];
let currentTier: QualityTier = 'balanced';

const _camFwd = new THREE.Vector3();

export function setPhase(p: number, frozen: boolean): void {
  let next = p % 1;
  if (next < 0) next += 1;
  currentPhase = next;
  isFrozen = frozen;
  const preset = phaseToPreset(currentPhase);
  if (preset !== STATE.timeOfDay) {
    STATE.timeOfDay = preset;
  }
  updateLightingFrame(currentPhase);
}

export function initLighting(): void {
  G.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0);
  G.scene.add(G.hemiLight);

  G.ambientLight = new THREE.AmbientLight(0xffffff, 0.04);
  G.scene.add(G.ambientLight);

  G.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
  G.sunLight.castShadow = true;
  G.sunLight.shadow.mapSize.width = 2048;
  G.sunLight.shadow.mapSize.height = 2048;
  G.sunLight.shadow.camera.near = 5;
  G.sunLight.shadow.camera.far = 250;
  G.sunLight.shadow.bias = -0.0004;
  G.sunLight.shadow.normalBias = 0.02;
  G.scene.add(G.sunLight);
  G.scene.add(G.sunLight.target);

  currentPhase = presetToPhase(STATE.timeOfDay);
  updateLightingFrame(currentPhase);
}

export function applyShadowTier(tier: QualityTier): void {
  currentTier = tier;
  const cfg = GFX_TIERS[tier];

  if (G.renderer) {
    G.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  if (!G.sunLight) return;

  if (cfg.shadowSize > 0) {
    if (G.renderer) G.renderer.shadowMap.enabled = true;
    G.sunLight.castShadow = true;
    G.sunLight.shadow.mapSize.width = cfg.shadowSize;
    G.sunLight.shadow.mapSize.height = cfg.shadowSize;
    const r = cfg.shadowRange;
    G.sunLight.shadow.camera.left = -r;
    G.sunLight.shadow.camera.right = r;
    G.sunLight.shadow.camera.top = r;
    G.sunLight.shadow.camera.bottom = -r;
    G.sunLight.shadow.camera.updateProjectionMatrix();
  } else {
    if (G.renderer) G.renderer.shadowMap.enabled = false;
    G.sunLight.castShadow = false;
  }

  if (G.sunLight.shadow.map) {
    G.sunLight.shadow.map.dispose();
    G.sunLight.shadow.map = null;
  }

  G.sunLight.shadow.bias = -0.0004;
  G.sunLight.shadow.normalBias = 0.02;
}

function updateLightingFrame(phase: number): void {
  const frame = dayFrameAt(phase);

  if (G.sunLight) {
    G.sunLight.color.setRGB(frame.key[0], frame.key[1], frame.key[2]);
    G.sunLight.intensity = frame.keyIntensity;
  }

  if (G.hemiLight) {
    G.hemiLight.color.setRGB(frame.fill[0], frame.fill[1], frame.fill[2]);
    G.hemiLight.groundColor.setRGB(frame.bounce[0], frame.bounce[1], frame.bounce[2]);
  }

  if (G.renderer) {
    G.renderer.toneMappingExposure = frame.exposure;
  }

  const sin12 = Math.sin((12 * Math.PI) / 180);
  const cos12 = Math.cos((12 * Math.PI) / 180);
  let clampedCastDir: Vec3;
  if (frame.sunDir[1] < sin12) {
    const horiz = Math.hypot(frame.sunDir[0], frame.sunDir[2]);
    clampedCastDir = horiz > 1e-6
      ? [(frame.sunDir[0] / horiz) * cos12, sin12, (frame.sunDir[2] / horiz) * cos12]
      : [cos12, sin12, 0];
  } else {
    clampedCastDir = frame.sunDir;
  }

  currentShadowDir = stepShadowDir(currentShadowDir, clampedCastDir, SHADOW_SUN_STEP_DEG);

  if (G.sunLight && G.camera) {
    const cfg = GFX_TIERS[currentTier];
    if (cfg.shadowSize > 0 && cfg.shadowRange > 0) {
      const camPos: Vec3 = [G.camera.position.x, G.camera.position.y, G.camera.position.z];
      G.camera.getWorldDirection(_camFwd);
      const camFwd: Vec3 = [_camFwd.x, _camFwd.y, _camFwd.z];

      const fit = fitShadow(camPos, camFwd, currentShadowDir, cfg.shadowRange, cfg.shadowSize);
      G.sunLight.position.set(fit.lightPos[0], fit.lightPos[1], fit.lightPos[2]);
      G.sunLight.target.position.set(fit.target[0], fit.target[1], fit.target[2]);
      G.sunLight.target.updateMatrixWorld();
    } else {
      G.sunLight.position.set(
        G.camera.position.x + currentShadowDir[0] * 100,
        G.camera.position.y + currentShadowDir[1] * 100,
        G.camera.position.z + currentShadowDir[2] * 100
      );
      G.sunLight.target.position.set(G.camera.position.x, G.camera.position.y, G.camera.position.z);
      G.sunLight.target.updateMatrixWorld();
    }
  }
}

export function updateLighting(dt: number): void {
  if (!isFrozen) {
    currentPhase = stepPhase(currentPhase, dt, DAY_CLOCK);
  }

  const preset = phaseToPreset(currentPhase);
  if (preset !== STATE.timeOfDay) {
    STATE.timeOfDay = preset;
  }

  updateLightingFrame(currentPhase);
}
