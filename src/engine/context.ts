// @ts-nocheck
import * as THREE from 'three';

export const TICK_SEC = 0.6;

export const player = {
  pos: new THREE.Vector3(-4, 0, -3),
  vel: new THREE.Vector3(0, 0, 0),
  yaw: 0.48,
  targetPos: null,
  targetEntity: null,
  isMoving: false,
  isGrounded: true,
  jumpVel: 0,
  animTime: 0,
  attackAnim: 0,
  spinAnim: 0,
  actionCooldown: 0,
  downed: false,
  downedTimer: 0,
  meshGroup: null,
  currentSpeed: 0,
  yawVelocity: 0,
  bankRoll: 0,
  capeAngleX: -0.12,
  capeAngleY: 0,
  capeAngleZ: 0,
  activeWeaponKind: 'scimitar',
  parts: {}
};

export const camState = {
  yaw: 0.48,
  manualOffset: 0.65,
  pitch: 0.18,
  distance: 5.4,
  currentLookAt: new THREE.Vector3(-4, 2, -3),
  shake: 0,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0
};

export const _tmpScratchVec = new THREE.Vector3();
export const _camTargetVec = new THREE.Vector3();
export const _lookTargetVec = new THREE.Vector3();

export const telemetryInfo = {
  gpuName: 'Detecting GPU...',
  vendor: '',
  isHardwareAccelerated: true,
  fps: 60,
  frameTimeMs: 16.6
};

export const G = {
  scene: null,
  camera: null,
  renderer: null,
  sunLight: null,
  ambientLight: null,
  hemiLight: null,
  terrainMesh: null,
  waterMesh: null,
  skyDomeMesh: null,
  grassInstanced: null,
  waterUniforms: null,
  skyUniforms: null,
  worldInteractiveObjects: [],
  monstersList: [],
  resourceNodesList: [],
  npcList: [],
  projectilesList: [],
  vfxList: [],
  swayingFoliage: [],
  frameCounter: 0,
  lastFpsTime: typeof performance !== 'undefined' ? performance.now() : 0,
  npcAnimatorsList: [],
  keysPressed: {},
  raycaster: new THREE.Raycaster(),
  mouseVec: new THREE.Vector2(),
  hoveredWorld: null,
  clickMarkerMesh: null,
  hoverTile: null,
  rightPress: { x: 0, y: 0, dist: 0 },
  lastFrameTime: typeof performance !== 'undefined' ? performance.now() : 0,
  setBonusTimer: 0,
  lastAutoSaveTime: 0,
  labelTick: 0,
  miniTick: 1,
  lastLabelX: 999,
  lastLabelZ: 999
};
