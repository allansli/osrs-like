import * as THREE from 'three';
import { G } from './context';
import { STATE } from '../state/gameState';
import { DAY_CLOCK, GFX_TIERS, type QualityTier, SHADOW_BIAS, SHADOW_NORMAL_BIAS, SHADOW_SUN_STEP_DEG } from '../data/look';
import { dayFrameAt, phaseToPreset, presetToPhase, stepPhase, type DayFrame, type Vec3 } from '../state/dayCycle';
import { fitShadow, stepShadowDir } from '../state/shadowFit';
import { AIR, BASE_FOG_DENSITY } from './atmosphere';
import { getWeatherState } from './particles';

let currentPhase = presetToPhase(STATE.timeOfDay);
let currentDayIndex = 0;
let isFrozen = false;
let currentShadowDir: Vec3 = [0, 1, 0]; // set from the first frame in initLighting
let currentTier: QualityTier = 'balanced';

export function currentDayIndexValue(): number {
  return currentDayIndex;
}

export function currentPhaseValue(): number {
  return currentPhase;
}

const _camFwd = new THREE.Vector3();
const _shadowPos = new THREE.Vector3(); // where the shadow camera sits (stepped direction)
const _shadowTarget = new THREE.Vector3();
const _keepPos = new THREE.Vector3();
const _keepTarget = new THREE.Vector3();

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

export function currentDayFrame(): DayFrame {
  return dayFrameAt(currentPhase);
}

export function initLighting(): void {
  G.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0);
  G.scene.add(G.hemiLight);

  G.ambientLight = new THREE.AmbientLight(0xffffff, 0.04);
  G.scene.add(G.ambientLight);

  G.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
  G.sunLight.castShadow = true;
  G.sunLight.shadow.camera.near = 5;
  G.sunLight.shadow.camera.far = 250;
  G.scene.add(G.sunLight);
  G.scene.add(G.sunLight.target);

  // The light object sits along the true sun (shading); the shadow camera is placed from _shadowPos/_shadowTarget.
  const shadow = G.sunLight.shadow;
  const light = G.sunLight;
  const baseUpdate = shadow.updateMatrices.bind(shadow);
  shadow.updateMatrices = (l: THREE.Light) => {
    _keepPos.setFromMatrixPosition(light.matrixWorld);
    _keepTarget.setFromMatrixPosition(light.target.matrixWorld);
    light.matrixWorld.setPosition(_shadowPos);
    light.target.matrixWorld.setPosition(_shadowTarget);
    baseUpdate(l);
    light.matrixWorld.setPosition(_keepPos);
    light.target.matrixWorld.setPosition(_keepTarget);
  };

  currentPhase = presetToPhase(STATE.timeOfDay);
  currentShadowDir = clampCastDir(dayFrameAt(currentPhase).sunDir);
  updateLightingFrame(currentPhase);
}

export function applyShadowTier(tier: QualityTier): void {
  currentTier = tier;
  const cfg = GFX_TIERS[tier];

  G.renderer.shadowMap.type = THREE.PCFShadowMap;

  if (cfg.shadowSize > 0) {
    G.renderer.shadowMap.enabled = true;
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
    G.renderer.shadowMap.enabled = false;
    G.sunLight.castShadow = false;
  }

  if (G.sunLight.shadow.map) {
    G.sunLight.shadow.map.dispose();
    G.sunLight.shadow.map = null;
  }

  G.sunLight.shadow.bias = SHADOW_BIAS;
  G.sunLight.shadow.normalBias = SHADOW_NORMAL_BIAS;
}

// The key light shades along the true sun; only the shadow camera uses the clamped, stepped direction.
function clampCastDir(sunDir: Vec3): Vec3 {
  const sin12 = Math.sin((12 * Math.PI) / 180);
  const cos12 = Math.cos((12 * Math.PI) / 180);
  if (sunDir[1] >= sin12) return sunDir;
  const horiz = Math.hypot(sunDir[0], sunDir[2]);
  return [(sunDir[0] / horiz) * cos12, sin12, (sunDir[2] / horiz) * cos12];
}

function updateLightingFrame(phase: number): void {
  const frame = dayFrameAt(phase);
  const weather = getWeatherState(currentDayIndex, phase);

  G.sunLight.color.setRGB(frame.key[0], frame.key[1], frame.key[2]);
  G.sunLight.intensity = frame.keyIntensity * weather.keyScale;
  G.hemiLight.color.setRGB(frame.fill[0], frame.fill[1], frame.fill[2]);
  G.hemiLight.groundColor.setRGB(frame.bounce[0], frame.bounce[1], frame.bounce[2]);
  G.renderer.toneMappingExposure = frame.exposure;

  AIR.uFogDensity.value = BASE_FOG_DENSITY * weather.fogScale;

  const clampedCastDir = clampCastDir(frame.sunDir);

  currentShadowDir = stepShadowDir(currentShadowDir, clampedCastDir, SHADOW_SUN_STEP_DEG);

  const cfg = GFX_TIERS[currentTier];
  if (cfg.shadowSize > 0 && cfg.shadowRange > 0) {
    const camPos: Vec3 = [G.camera.position.x, G.camera.position.y, G.camera.position.z];
    G.camera.getWorldDirection(_camFwd);
    const camFwd: Vec3 = [_camFwd.x, _camFwd.y, _camFwd.z];

    const fit = fitShadow(camPos, camFwd, currentShadowDir, cfg.shadowRange, cfg.shadowSize);
    _shadowPos.set(fit.lightPos[0], fit.lightPos[1], fit.lightPos[2]);
    _shadowTarget.set(fit.target[0], fit.target[1], fit.target[2]);
  } else {
    _shadowPos.set(
      G.camera.position.x + currentShadowDir[0] * 100,
      G.camera.position.y + currentShadowDir[1] * 100,
      G.camera.position.z + currentShadowDir[2] * 100
    );
    _shadowTarget.copy(G.camera.position);
  }

  G.sunLight.target.position.copy(_shadowTarget);
  G.sunLight.position.set(
    _shadowTarget.x + frame.sunDir[0] * 100,
    _shadowTarget.y + frame.sunDir[1] * 100,
    _shadowTarget.z + frame.sunDir[2] * 100
  );
  G.sunLight.target.updateMatrixWorld();
  G.sunLight.updateMatrixWorld();
}

export function updateLighting(dt: number): void {
  if (!isFrozen) {
    const prev = currentPhase;
    currentPhase = stepPhase(currentPhase, dt, DAY_CLOCK);
    if (currentPhase < prev) {
      currentDayIndex++;
    }
  }

  const preset = phaseToPreset(currentPhase);
  if (preset !== STATE.timeOfDay) {
    STATE.timeOfDay = preset;
  }

  updateLightingFrame(currentPhase);
}
