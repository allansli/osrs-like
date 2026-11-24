import * as THREE from 'three';
import { G, telemetryInfo } from './context';
import { addChatMessage, el } from '../ui/hud';
import { buildTerrainAndWater } from './worldMesh';
import { buildSky } from './sky';
import { CAMERA_FAR, GFX_TIERS } from '../data/look';
import { buildAllCitiesAndLandmarks } from './worldBuild';
import { buildPlayerCharacter } from './playerMesh';
import { spawnAllResourcesAndMonsters } from './spawns';
import { sealAlbedoUvs } from './textures';
import { setupInputHandlers } from './input';
import { buildWalkGrid } from '../state/pathfind';
import { applyShadowTier, initLighting } from './lighting';
import { createOutput, effectivePixelRatio, enterPlainMode, TIER_LABELS, type OutputPipeline } from './post';
import { setAirTier } from './atmosphere';
import { setPlayerChoseTier } from './photo';

export type QualityTier = 'performance' | 'balanced' | 'high' | 'ultra';
export let currentQuality: QualityTier = 'balanced';
export let outlinesEnabled = false;
export let output!: OutputPipeline;
export { TIER_LABELS };

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
  const prevTier = currentQuality;
  currentQuality = tier;
  setAirTier(tier);
  const dpr = effectivePixelRatio(tier, window.innerWidth, window.innerHeight, window.devicePixelRatio);
  if (G.renderer && typeof window !== 'undefined') {
    G.renderer.setPixelRatio(dpr);
    G.renderer.setSize(window.innerWidth, window.innerHeight);
    applyShadowTier(tier);

    // rebuild on every tier change: sample counts are baked into the composer targets
    if (!output || prevTier !== tier) {
      output?.dispose();
      output = createOutput(G.renderer, G.scene, G.camera, tier);
    } else {
      output.setSize(window.innerWidth, window.innerHeight);
    }
  }
  const dprEl = el('perf-dpr');
  dprEl.textContent = `${dpr.toFixed(2)}x DPR`;
  syncGraphicsButtons();
}

export function cycleGraphicsQuality(): void {
  setPlayerChoseTier(true);
  const tiers: QualityTier[] = ['performance', 'balanced', 'high', 'ultra'];
  const nextIdx = (tiers.indexOf(currentQuality) + 1) % tiers.length;
  applyQualityTier(tiers[nextIdx]);
  addChatMessage(`Graphics Quality set to <b>${TIER_LABELS[tiers[nextIdx]]}</b> (${getQualityDpr(tiers[nextIdx]).toFixed(2)}x DPR).`, 'skill');
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
  gBtn.textContent = `Graphics: ${TIER_LABELS[currentQuality]}`;
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

  G.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, CAMERA_FAR);

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
  G.renderer.shadowMap.type = THREE.PCFShadowMap;
  G.renderer.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer.toneMappingExposure = 1.05;
  G.renderer.domElement.id = 'game-canvas';
  container.appendChild(G.renderer.domElement);

  initGpuTelemetry(G.renderer.getContext());
  G.renderer.debug.onShaderError = (gl, program) => {
    const log = gl.getProgramInfoLog(program);
    console.error(log);
    enterPlainMode(G.scene);
    output.dispose();
    output = createOutput(G.renderer, G.scene, G.camera, currentQuality);
    addChatMessage('Shader compile error: switched to plain mode.', 'skill');
  };
  if (new URLSearchParams(location.search).has('plain')) {
    enterPlainMode(G.scene);
  }
  initLighting();
  applyQualityTier('balanced');

  G.walkGrid = buildWalkGrid();
  buildSky();
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
  const dpr = effectivePixelRatio(currentQuality, window.innerWidth, window.innerHeight, window.devicePixelRatio);
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(dpr);
  output.setSize(window.innerWidth, window.innerHeight);
}
