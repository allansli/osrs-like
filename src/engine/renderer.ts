import * as THREE from 'three';
import { G, telemetryInfo } from './context';
import { addChatMessage, el } from '../ui/hud';
import { buildSkyDomeShader, buildTerrainAndWater } from './worldMesh';
import { buildAllCitiesAndLandmarks } from './worldBuild';
import { buildPlayerCharacter } from './playerMesh';
import { spawnAllResourcesAndMonsters } from './spawns';
import { sealAlbedoUvs } from './textures';
import { setupInputHandlers } from './input';

export type QualityTier = 'performance' | 'balanced' | 'high' | 'ultra';
export let currentQuality: QualityTier = 'balanced';
export let outlinesEnabled = true;

export function getQualityDpr(tier: QualityTier): number {
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  switch (tier) {
    case 'performance': return 1.0;
    case 'balanced': return Math.min(dpr, 1.25);
    case 'high': return Math.min(dpr, 1.5);
    case 'ultra': return Math.min(dpr, 2.0);
  }
}

export function applyQualityTier(tier: QualityTier): void {
  currentQuality = tier;
  const dpr = getQualityDpr(tier);
  if (G.renderer && typeof window !== 'undefined') {
    G.renderer.setPixelRatio(dpr);
    G.renderer.setSize(window.innerWidth, window.innerHeight);
    if (tier === 'performance') {
      G.renderer.shadowMap.enabled = false;
    } else {
      G.renderer.shadowMap.enabled = true;
      G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (G.sunLight) {
        G.sunLight.castShadow = true;
        const res = tier === 'ultra' ? 2048 : (tier === 'high' ? 2048 : 1024);
        G.sunLight.shadow.mapSize.set(res, res);
      }
    }
  }
  const dprEl = el('perf-dpr');
  dprEl.textContent = `${dpr.toFixed(2)}x DPR`;
  syncGraphicsButtons();
}

export function cycleGraphicsQuality(): void {
  const tiers: QualityTier[] = ['performance', 'balanced', 'high', 'ultra'];
  const nextIdx = (tiers.indexOf(currentQuality) + 1) % tiers.length;
  applyQualityTier(tiers[nextIdx]);
  addChatMessage(`Graphics Quality set to <b>${tiers[nextIdx].toUpperCase()}</b> (${getQualityDpr(tiers[nextIdx]).toFixed(2)}x DPR).`, 'skill');
}

export function toggleOutlines(): void {
  outlinesEnabled = !outlinesEnabled;
  if (G.scene) {
    G.scene.traverse((obj) => {
      if (obj.userData?.isOutline) {
        obj.visible = outlinesEnabled;
      }
    });
  }
  syncGraphicsButtons();
  addChatMessage(`Cartoon Outlines <b>${outlinesEnabled ? 'Enabled' : 'Disabled (Ultra FPS)'}</b>.`, 'skill');
}

export function syncGraphicsButtons(): void {
  const gBtn = el('graphics-quality-btn');
  gBtn.textContent = `Graphics: ${currentQuality.charAt(0).toUpperCase() + currentQuality.slice(1)}`;
  const oBtn = el('outlines-toggle-btn');
  oBtn.textContent = outlinesEnabled ? 'Outlines: On' : 'Outlines: Off';
}

export function initGpuTelemetry(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      telemetryInfo.gpuName = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string) || 'WebGL Renderer';
      telemetryInfo.vendor = (gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string) || '';
    } else {
      telemetryInfo.gpuName = (gl.getParameter(gl.RENDERER) as string) || 'WebGL';
    }
  } catch {
    telemetryInfo.gpuName = 'Hardware WebGL';
  }

  const lower = telemetryInfo.gpuName.toLowerCase();
  let cleanName = telemetryInfo.gpuName;
  const match = telemetryInfo.gpuName.match(/NVIDIA GeForce [^,)]+|Radeon [^,)]+|Intel\(R\) [^,)]+/i);
  if (match) cleanName = match[0];

  telemetryInfo.isHardwareAccelerated = !/swiftshader|software|llvmpipe|basic render/i.test(lower);

  const nameEl = el('perf-gpu-name');
  const dotEl = el('perf-dot');
  if (!telemetryInfo.isHardwareAccelerated) {
    nameEl.textContent = 'CPU SwiftShader (GPU Acceleration OFF!)';
    nameEl.title = 'Hardware acceleration is disabled in your browser. Enable it in chrome://settings/system!';
    dotEl.className = 'perf-status-dot warning';
  } else {
    nameEl.textContent = cleanName;
    nameEl.title = telemetryInfo.gpuName;
    dotEl.className = 'perf-status-dot';
  }
}

export function init3DEngine(): void {
  const container = el('game-canvas-container');
  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.FogExp2(0x9ab0c2, 0.0028);

  G.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 360);

  G.renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    precision: 'highp',
    stencil: false,
    depth: true
  });
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(getQualityDpr(currentQuality));
  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.renderer.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer.toneMappingExposure = 1.05;
  G.renderer.domElement.id = 'game-canvas';
  container.appendChild(G.renderer.domElement);

  initGpuTelemetry(G.renderer.getContext());
  applyQualityTier('balanced');

  G.hemiLight = new THREE.HemisphereLight(0xa5b8c9, 0x333d32, 0.52);
  G.scene.add(G.hemiLight);

  G.ambientLight = new THREE.AmbientLight(0x617282, 0.28);
  G.scene.add(G.ambientLight);

  G.sunLight = new THREE.DirectionalLight(0xf8f5ed, 1.15);
  G.sunLight.position.set(45, 68, 35);
  G.sunLight.castShadow = true;
  G.sunLight.shadow.mapSize.width = 2048;
  G.sunLight.shadow.mapSize.height = 2048;
  G.sunLight.shadow.camera.near = 5;
  G.sunLight.shadow.camera.far = 170;
  const d = 54;
  G.sunLight.shadow.camera.left = -d;
  G.sunLight.shadow.camera.right = d;
  G.sunLight.shadow.camera.top = d;
  G.sunLight.shadow.camera.bottom = -d;
  G.sunLight.shadow.bias = -0.0004;
  G.scene.add(G.sunLight);
  G.scene.add(G.sunLight.target);

  buildSkyDomeShader();
  buildTerrainAndWater();
  buildAllCitiesAndLandmarks();
  buildPlayerCharacter();
  spawnAllResourcesAndMonsters();
  sealAlbedoUvs(G.scene);

  window.addEventListener('resize', onWindowResize);
  setupInputHandlers();
}

export function onWindowResize(): void {
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(getQualityDpr(currentQuality));
}
