import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BLOOM, GFX_TIERS, type QualityTier } from '../data/look';
import { registeredFacetMaterials } from './materials';
import { refreshFlashMaterials } from './reactions';

export interface OutputPipeline {
  render(): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

export const TIER_LABELS: Record<QualityTier, string> = {
  performance: 'Low',
  balanced: 'Medium',
  high: 'High',
  ultra: 'Ultra'
};

let plainMode = false;

export function isPlainMode(): boolean {
  return plainMode;
}

export function enterPlainMode(scene: THREE.Scene): void {
  if (plainMode) return;
  plainMode = true;

  const regMap = new Map<THREE.Material, (typeof registeredFacetMaterials)[number]['params']>();
  for (const reg of registeredFacetMaterials) {
    regMap.set(reg.material, reg.params);
  }

  const stockMap = new Map<THREE.Material, THREE.MeshLambertMaterial>();
  const replaceMat = (mat: THREE.Material): THREE.Material => {
    const params = regMap.get(mat);
    if (!params) return mat;
    let stock = stockMap.get(mat);
    if (!stock) {
      stock = new THREE.MeshLambertMaterial({
        color: params.color,
        map: params.map,
        emissive: params.emissive,
        side: params.side,
        vertexColors: params.vertexColors
      });
      stockMap.set(mat, stock);
    }
    return stock;
  };

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(replaceMat) : replaceMat(mesh.material);
  });

  refreshFlashMaterials();
}

const TIER_ORDER: QualityTier[] = ['performance', 'balanced', 'high', 'ultra'];

export function nextTier(
  tier: QualityTier,
  frameTimes: number[],
  state: { hidden: boolean; playerChose: boolean }
): QualityTier {
  if (state.playerChose || state.hidden || frameTimes.length === 0) {
    return tier;
  }

  const sorted = [...frameTimes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  if (median > 24) {
    const idx = TIER_ORDER.indexOf(tier);
    if (idx > 0) {
      return TIER_ORDER[idx - 1];
    }
  }

  return tier;
}

export function effectivePixelRatio(
  tier: QualityTier,
  width: number,
  height: number,
  devicePixelRatio: number
): number {
  const tierConfig = GFX_TIERS[tier];
  const targetRatio = Math.min(devicePixelRatio, tierConfig.pixelRatioCap);
  const maxPixels = tierConfig.megapixelCap * 1e6;
  const area = width * height;
  return Math.min(targetRatio, Math.sqrt(maxPixels / area));
}

export function createOutput(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  tier: QualityTier
): OutputPipeline {
  if (isPlainMode() || !GFX_TIERS[tier].composer) {
    return {
      render: () => {
        renderer.render(scene, camera);
      },
      setSize: (_width: number, _height: number) => {},
      dispose: () => {},
    };
  }

  const canHalfFloat = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
  const targetType = canHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;

  const size = renderer.getSize(new THREE.Vector2());
  const pixelRatio = renderer.getPixelRatio();
  const effW = Math.round(size.width * pixelRatio);
  const effH = Math.round(size.height * pixelRatio);
  const samples = effW * effH > 8.3 * 1e6 ? GFX_TIERS[tier].composerSamplesAbove83Mp : GFX_TIERS[tier].composerSamples;

  const renderTarget = new THREE.WebGLRenderTarget(effW, effH, {
    type: targetType,
    samples,
  });

  const composer = new EffectComposer(renderer, renderTarget);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.width, size.height),
    BLOOM.strength,
    BLOOM.radius,
    BLOOM.threshold
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(size.width, size.height);

  return {
    render: () => {
      composer.render();
    },
    setSize: (width: number, height: number) => {
      const dpr = renderer.getPixelRatio();
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      const s = w * h > 8.3 * 1e6 ? GFX_TIERS[tier].composerSamplesAbove83Mp : GFX_TIERS[tier].composerSamples;
      composer.renderTarget1.samples = s;
      composer.renderTarget2.samples = s;
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
    },
    dispose: () => {
      bloomPass.dispose();
      outputPass.dispose();
      composer.dispose();
    },
  };
}
