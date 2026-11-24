import * as THREE from 'three';
import { G } from './context';
import { GFX_TIERS, SKY_DOME_RADIUS } from '../data/look';
import { AIR, AIR_GLSL, COLOR_FOOTER, setAirTier } from './atmosphere';
import { facetMaterial } from './materials';
import { buildKitPiece, makeRng } from './floraKit';
import { currentQuality } from './renderer';
import type { DayFrame } from '../state/dayCycle';

const uNight = { value: 0 };

// The dome takes the air at the distance where its view ray meets a ceiling this high, capped by its radius:
// thick at the horizon, thin overhead even on the tier without the height term.
const AIR_SKY_CEILING = '40.0';
const AIR_SKY_RADIUS = SKY_DOME_RADIUS.toFixed(1);

interface CloudInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
}

interface CloudGroup {
  mesh: THREE.InstancedMesh;
  instances: CloudInstance[];
}

let apronMat: THREE.MeshLambertMaterial;
const cloudGroups: CloudGroup[] = [];
let lastCloudTime = 0;
const dummy = new THREE.Object3D();

export function buildSky(): void {
  const skyGeo = new THREE.SphereGeometry(SKY_DOME_RADIUS, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      ...AIR,
      uNight,
    },
    side: THREE.BackSide,
    depthWrite: false,
    dithering: true,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uKeyColor;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform float uNight;
      varying vec3 vDir;
      #include <common>
      #include <dithering_pars_fragment>
      ${AIR_GLSL}

      float hashStars(vec3 p) {
        vec3 cell = floor(p * 120.0);
        return fract(sin(dot(cell, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);

        // Three-stop gradient; the middle stop sits between horizon and zenith, not on the fill,
        // which carries the shadow light's level and would wash the band out
        vec3 skyMid = mix(uHorizon, uZenith, 0.5);
        vec3 sky = mix(uHorizon, skyMid, smoothstep(0.0, 0.25, h));
        sky = mix(sky, uZenith, smoothstep(0.25, 0.85, h));

        // Horizon glow toward uSunDir
        vec3 sunDirNorm = normalize(uSunDir);
        float sunDot = max(dot(dir, sunDirNorm), 0.0);
        float horizonMask = 1.0 - smoothstep(0.0, 0.25, h);
        float horizonGlow = pow(sunDot, 4.0) * horizonMask;
        sky += uKeyColor * (horizonGlow * 0.35);

        // Sun and moon discs as step edges with one halo step
        float cosAngle = dot(dir, sunDirNorm);
        float disc = step(0.998, cosAngle);
        float halo = step(0.992, cosAngle) * (1.0 - disc);
        vec3 discColor = mix(vec3(0.0), uKeyColor * 0.4, halo);
        discColor = mix(discColor, uKeyColor * 1.8, disc);
        sky += discColor;

        // Stars from a hash of the direction with a hard threshold, drawn only when uNight is above 0
        if (uNight > 0.0) {
          float starRand = hashStars(dir);
          float star = step(0.995, starRand) * step(0.12, dir.y);
          sky += vec3(star * 0.8) * uNight;
        }

        sky = applyAir(sky, cameraPosition + dir * min(${AIR_SKY_RADIUS}, ${AIR_SKY_CEILING} / max(dir.y, 1e-3)));
        gl_FragColor = vec4(sky, 1.0);
        ${COLOR_FOOTER}
        #include <dithering_fragment>
      }
    `,
  });

  G.skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
  G.scene.add(G.skyDomeMesh);

  // Horizon apron: one mesh welded to the terrain square, rising to hills
  const apronRng = makeRng(0x5ca1e);
  const apronGeo = buildKitPiece('horizon_apron', apronRng);
  apronMat = facetMaterial({ shade: 'cut', color: AIR.uAirColor.value.clone() });
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.castShadow = false;
  apronMesh.receiveShadow = false;
  G.scene.add(apronMesh);

  // Clouds: instanced meshes of cloud solids drifting 60 to 90 units up
  const cloudRng = makeRng(0xc100d);
  const CLOUD_IDS = ['cloud_a', 'cloud_b', 'cloud_c'] as const;
  const INSTANCES_PER_VARIANT = 8;

  for (const id of CLOUD_IDS) {
    const geo = buildKitPiece(id, cloudRng);
    const mat = facetMaterial({ shade: 'cut', vertexColors: true, color: 0xffffff });
    const instMesh = new THREE.InstancedMesh(geo, mat, INSTANCES_PER_VARIANT);
    instMesh.castShadow = false;
    instMesh.receiveShadow = false;
    instMesh.frustumCulled = false;

    const instances: CloudInstance[] = [];
    for (let i = 0; i < INSTANCES_PER_VARIANT; i++) {
      const inst: CloudInstance = {
        x: (cloudRng() - 0.5) * 260,
        y: 60 + cloudRng() * 30,
        z: (cloudRng() - 0.5) * 260,
        scale: 2.0 + cloudRng() * 1.5,
        rotY: cloudRng() * Math.PI * 2,
      };
      instances.push(inst);
      dummy.position.set(inst.x, inst.y, inst.z);
      dummy.rotation.y = inst.rotY;
      dummy.scale.set(inst.scale, inst.scale * 0.6, inst.scale);
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    G.scene.add(instMesh);
    cloudGroups.push({ mesh: instMesh, instances });
  }

  lastCloudTime = AIR.uTime.value;
}

export function updateSky(frame: DayFrame): void {
  // ponytail: polls the tier each frame because renderer.ts (applyQualityTier) is outside AR2's files; AR4b can call setAirTier there
  setAirTier(currentQuality);
  uNight.value = frame.keyIsMoon ? 1.0 : 0.0;
  G.skyDomeMesh.position.copy(G.camera.position);
  (G.scene.fog as THREE.FogExp2).color.copy(AIR.uAirColor.value);
  (G.scene.fog as THREE.FogExp2).density = AIR.uFogDensity.value;

  apronMat.color.copy(AIR.uAirColor.value);

  const cloudsEnabled = GFX_TIERS[currentQuality].clouds;
  const curTime = AIR.uTime.value;
  const dt = lastCloudTime > 0 ? Math.min(Math.max(curTime - lastCloudTime, 0), 0.1) : 0;
  lastCloudTime = curTime;

  for (const group of cloudGroups) {
    group.mesh.count = cloudsEnabled ? group.instances.length : 0;
    group.mesh.visible = cloudsEnabled;

    if (cloudsEnabled && dt > 0) {
      for (let i = 0; i < group.instances.length; i++) {
        const inst = group.instances[i];
        inst.x += AIR.uWind.value.x * 2.5 * dt;
        inst.z += AIR.uWind.value.y * 2.5 * dt;

        // Wrap inside the 260-unit square [-130, 130]
        if (inst.x > 130) inst.x -= 260;
        else if (inst.x < -130) inst.x += 260;

        if (inst.z > 130) inst.z -= 260;
        else if (inst.z < -130) inst.z += 260;

        dummy.position.set(inst.x, inst.y, inst.z);
        dummy.rotation.y = inst.rotY;
        dummy.scale.set(inst.scale, inst.scale * 0.6, inst.scale);
        dummy.updateMatrix();
        group.mesh.setMatrixAt(i, dummy.matrix);
      }
      group.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
