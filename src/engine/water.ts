import * as THREE from 'three';
import { G } from './context';
import { GFX_TIERS, type QualityTier } from '../data/look';
import { AIR, AIR_GLSL, COLOR_FOOTER } from './atmosphere';
import { PALETTE } from './materials';
import { buildWaterGrid } from '../state/waterGrid';
import { isPlainMode } from './post';

let waterMaterial: THREE.ShaderMaterial | null = null;
let currentWaterTier: QualityTier = 'balanced';

export const waterUniforms = {
  ...AIR,
  uDeepColor: { value: new THREE.Color(PALETTE.water) },
  uShallowColor: { value: new THREE.Color(0x2e6b72) },
  uBankColor: { value: new THREE.Color(0xc7ae80) },
  uFoamColor: { value: new THREE.Color(PALETTE.foam) },
};

export function setWaterTier(tier: QualityTier): void {
  currentWaterTier = tier;
  if (!waterMaterial) return;
  if (isPlainMode() || GFX_TIERS[tier].waterMode === 'ramp') {
    waterMaterial.defines = { ...waterMaterial.defines, WATER_SIMPLE: '' };
  } else {
    delete waterMaterial.defines.WATER_SIMPLE;
  }
  waterMaterial.needsUpdate = true;
}

export function buildWater(): THREE.Mesh {
  const grid = buildWaterGrid();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(grid.positions, 3));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(grid.depth, 1));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(grid.flow, 2));
  geo.setIndex(grid.index);

  const defines: Record<string, string> = {};
  if (isPlainMode() || GFX_TIERS[currentWaterTier].waterMode === 'ramp') {
    defines.WATER_SIMPLE = '';
  }

  waterMaterial = new THREE.ShaderMaterial({
    defines,
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: `
      attribute float aDepth;
      attribute vec2 aFlow;
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vDepth;
      varying float vWave;

      void main() {
        vDepth = aDepth;
        vec3 p = position;
        float flowLen = length(aFlow);
        float s;
        if (flowLen > 0.1) {
          s = dot(position.xz, aFlow);
        } else {
          vec2 center = position.x < 20.0 ? vec2(-40.0, -30.0) : vec2(96.0, 90.0);
          s = length(position.xz - center);
        }

        float w = sin(s * 1.8 - uTime * 2.2) * 0.025 + sin(s * 3.7 - uTime * 3.4) * 0.012;
        vWave = w;

#ifndef WATER_SIMPLE
        p.y += w;
#endif

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      #include <common>
      ${AIR_GLSL}

      uniform vec3 uKeyColor;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uBankColor;
      uniform vec3 uFoamColor;

      varying vec3 vWorldPos;
      varying float vDepth;
      varying float vWave;

      void main() {
        // Three-stop colour ramp over aDepth: bank, shallow, PALETTE.water
        float t1 = smoothstep(0.0, 0.35, vDepth);
        float t2 = smoothstep(0.35, 0.9, vDepth);
        vec3 col = mix(mix(uBankColor, uShallowColor, t1), uDeepColor, t2);

        // Foam where depth is under 0.12, broken by the sines
        float foamDist = 0.12 + vWave * 0.8;
        float foam = 1.0 - smoothstep(foamDist - 0.03, foamDist, vDepth);
        col = mix(col, uFoamColor, foam * 0.85);

        // Alpha from depth so the riverbed shows through at the bank
        float alpha = mix(0.4, 0.94, smoothstep(0.0, 0.6, vDepth));
        alpha = max(alpha, foam * 0.9);

#ifndef WATER_SIMPLE
        // Face normal from derivatives
        vec3 dX = dFdx(vWorldPos);
        vec3 dY = dFdy(vWorldPos);
        vec3 cr = cross(dX, dY);
        vec3 N = length(cr) > 1e-6 ? normalize(cr) : vec3(0.0, 1.0, 0.0);
        if (N.y < 0.0) N = -N;

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 R = reflect(-V, N);
        vec3 L = normalize(uSunDir);

        // Stepped flash of uKeyColor where reflected view direction is within sun's cone
        float dotRL = dot(R, L);
        float flash = step(0.975, dotRL);
        col += uKeyColor * (flash * 0.75);

        // Fresnel mix toward uHorizon and uZenith
        float cosTheta = clamp(dot(V, N), 0.0, 1.0);
        float fresnel = pow(1.0 - cosTheta, 3.0);
        vec3 skyReflection = mix(uHorizon, uZenith, smoothstep(0.0, 0.7, max(R.y, 0.0)));
        col = mix(col, skyReflection, fresnel * 0.75);
#endif

        col = applyAir(col, vWorldPos);
        gl_FragColor = vec4(col, alpha);
        ${COLOR_FOOTER}
      }
    `,
  });
  waterMaterial.customProgramCacheKey = () => 'water';

  const mesh = new THREE.Mesh(geo, waterMaterial);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  G.waterMesh = mesh;
  G.scene.add(mesh);
  return mesh;
}
