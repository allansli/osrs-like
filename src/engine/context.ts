import * as THREE from 'three';
import type { MonsterEntityLike } from './blenderMonsters';
import type { ResourceNodeLike } from './blenderWorld';
import type { BlenderHeroAnimator } from './blenderHero';
import type { MonsterDef } from '../data/world';

export const TICK_SEC = 0.6;

export interface PlayerTargetEntity {
  type: string;
  ref?: any;
  pos?: THREE.Vector3;
}

export interface PlayerState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  targetPos: THREE.Vector3 | null;
  targetEntity: PlayerTargetEntity | null;
  isMoving: boolean;
  isGrounded: boolean;
  jumpVel: number;
  animTime: number;
  attackAnim: number;
  spinAnim: number;
  actionCooldown: number;
  downed: boolean;
  downedTimer: number;
  meshGroup: THREE.Group | null;
  currentSpeed: number;
  yawVelocity: number;
  bankRoll: number;
  capeAngleX: number;
  capeAngleY: number;
  capeAngleZ: number;
  activeWeaponKind: string;
  parts: any;
  blenderAnimator?: BlenderHeroAnimator | null;
}

export const player: PlayerState = {
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

export interface CamState {
  yaw: number;
  manualOffset: number;
  pitch: number;
  distance: number;
  currentLookAt: THREE.Vector3;
  shake: number;
  isDragging: boolean;
  lastMouseX: number;
  lastMouseY: number;
}

export const camState: CamState = {
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

export interface TelemetryInfo {
  gpuName: string;
  vendor: string;
  isHardwareAccelerated: boolean;
  fps: number;
  frameTimeMs: number;
}

export const telemetryInfo: TelemetryInfo = {
  gpuName: 'Detecting GPU...',
  vendor: '',
  isHardwareAccelerated: true,
  fps: 60,
  frameTimeMs: 16.6
};

export interface MonsterEntity extends MonsterEntityLike {
  def: Omit<MonsterDef, 'drops'> & MonsterEntityLike['def'] & {
    drops: Array<{ id?: string; chance: number; gp?: [number, number]; qty?: number }>;
  };
  spawnPos: THREE.Vector3;
  hp: number;
  maxHp: number;
  dead: boolean;
  isDying: boolean;
  dyingTimer: number;
  flinch: number;
  flashTimer: number;
  respawnTimer: number;
  wanderTimer: number;
  attackCooldown: number;
  attackAnim: number;
  breathCount: number;
  inCombatWithPlayer: boolean;
  labelEl: HTMLElement;
  wanderTarget?: THREE.Vector3;
}

export interface ResourceNodeEntity extends ResourceNodeLike {
  def: ResourceNodeLike['def'] & {
    name?: string;
    skill?: string;
    req?: number;
    xp?: number;
    item?: string;
    respawn?: number;
  };
  respawnTimer: number;
}

export interface NpcLabel {
  pos: THREE.Vector3;
  name: string;
  color?: string;
  yOffset?: number;
  el?: HTMLElement;
}

export type VfxEntry = {
  mesh: THREE.Object3D;
  life: number;
  age: number;
  onTick?: (v: VfxEntry, dt: number) => void;
};

export interface ProjectileEntry {
  mesh: THREE.Object3D;
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  speed: number;
  arc?: number;
  orient?: boolean;
  onImpact?: (() => void) | null;
  onTick?: ((p: ProjectileEntry, dt: number) => void) | null;
  trailAcc?: number;
}

export interface SwayingFoliageEntry {
  mesh: THREE.Object3D;
  speed: number;
  rotY?: boolean;
}

export interface NpcAnimator {
  update(dt: number): void;
}

export interface EngineContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sunLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  skyDomeMesh: THREE.Mesh;
  grassInstanced: THREE.InstancedMesh;
  waterUniforms: Record<string, THREE.IUniform>;
  skyUniforms: Record<string, THREE.IUniform>;
  worldInteractiveObjects: THREE.Object3D[];
  monstersList: MonsterEntity[];
  resourceNodesList: ResourceNodeEntity[];
  npcList: NpcLabel[];
  projectilesList: ProjectileEntry[];
  vfxList: VfxEntry[];
  swayingFoliage: SwayingFoliageEntry[];
  frameCounter: number;
  lastFpsTime: number;
  npcAnimatorsList: NpcAnimator[];
  keysPressed: Record<string, boolean>;
  raycaster: THREE.Raycaster;
  mouseVec: THREE.Vector2;
  hoveredWorld: any;
  clickMarkerMesh: THREE.Group;
  hoverTile: THREE.Mesh;
  rightPress: { x: number; y: number; dist: number };
  lastFrameTime: number;
  setBonusTimer: number;
  lastAutoSaveTime: number;
  labelTick: number;
  miniTick: number;
  lastLabelX: number;
  lastLabelZ: number;
}

export const G: EngineContext = {
  scene: null as unknown as THREE.Scene,
  camera: null as unknown as THREE.PerspectiveCamera,
  renderer: null as unknown as THREE.WebGLRenderer,
  sunLight: null as unknown as THREE.DirectionalLight,
  ambientLight: null as unknown as THREE.AmbientLight,
  hemiLight: null as unknown as THREE.HemisphereLight,
  terrainMesh: null as unknown as THREE.Mesh,
  waterMesh: null as unknown as THREE.Mesh,
  skyDomeMesh: null as unknown as THREE.Mesh,
  grassInstanced: null as unknown as THREE.InstancedMesh,
  waterUniforms: null as unknown as Record<string, THREE.IUniform>,
  skyUniforms: null as unknown as Record<string, THREE.IUniform>,
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
  clickMarkerMesh: null as unknown as THREE.Group,
  hoverTile: null as unknown as THREE.Mesh,
  rightPress: { x: 0, y: 0, dist: 0 },
  lastFrameTime: typeof performance !== 'undefined' ? performance.now() : 0,
  setBonusTimer: 0,
  lastAutoSaveTime: 0,
  labelTick: 0,
  miniTick: 1,
  lastLabelX: 999,
  lastLabelZ: 999
};
