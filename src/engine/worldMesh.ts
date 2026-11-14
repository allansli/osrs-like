import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { G } from './context';
import { STATE } from '../state/gameState';
import { PALETTE, addCartoonOutline, grassMaterial } from './materials';
import {
  BIOME_COLORS,
  assignGroundUvs,
  terrainMaterial,
  albedoMaterial,
  sealAlbedoUvs
} from './textures';
import { getTerrainHeight } from '../state/terrain';
import { isDeepWater } from '../state/collision';
import { loadBlenderWorldTemplate, upgradeWorldPropWithGltf } from './blenderWorld';
import { el } from '../ui/hud';

export function getBiomeColor(x: number, z: number, h: number): THREE.Color {
  const dirt = new THREE.Color(PALETTE.dirt);
  const grass = [PALETTE.sageShade, PALETTE.sage, PALETTE.sageLit].map((hex) => new THREE.Color(hex));
  if (h < -0.05) return dirt;
  if (z > -22 && z < 8 && x > -8 && x < 82 && Math.abs(z - (-x * 0.22)) < 2.6) return dirt;
  if (Math.hypot(x - 78, z + 20) < 18) return dirt;
  if (x > 40 && z > 36) return new THREE.Color(BIOME_COLORS.sand);
  if (x < -40 && z > 36) return new THREE.Color(h > 3.1 ? BIOME_COLORS.lava : BIOME_COLORS.crag);
  if (x < -40 && z < 0) return new THREE.Color(BIOME_COLORS.canopy);
  const band = Math.abs(Math.floor(x / 7) + Math.floor(z / 7) * 2) % 3;
  return grass[band];
}

// Custom GLSL Atmospheric Sky Dome with Volumetric Clouds & Sun Disc
export function buildSkyDomeShader(): void {
  G.skyUniforms = {
    uTime: { value: 0 },
    uTopColor: { value: new THREE.Color(PALETTE.skyZenith) },
    uMidColor: { value: new THREE.Color(PALETTE.skyMid) },
    uHorizonColor: { value: new THREE.Color(PALETTE.skyHorizon) }
  };

  const skyGeo = new THREE.SphereGeometry(290, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: G.skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vNormPos;
      void main() {
        vNormPos = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      varying vec3 vNormPos;
      void main() {
        float h = clamp(vNormPos.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, h));
        col = mix(col, uTopColor, smoothstep(0.28, 0.85, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  G.skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
  G.scene.add(G.skyDomeMesh);
}

export function cycleTimeOfDay(): void {
  STATE.timeOfDay = (STATE.timeOfDay + 1) % 3;
  const btn = el('time-of-day-btn');
  const fog = G.scene.fog as THREE.FogExp2;
  if (STATE.timeOfDay === 0) {
    G.skyUniforms.uTopColor.value.setHex(0x253545);
    G.skyUniforms.uMidColor.value.setHex(0x5a6875);
    G.skyUniforms.uHorizonColor.value.setHex(0x8a8a92);
    fog.color.setHex(0x8a8a92);
    fog.density = 0.0030;
    btn.textContent = 'Golden Hour';
  } else if (STATE.timeOfDay === 1) {
    G.skyUniforms.uTopColor.value.setHex(0x2e4359);
    G.skyUniforms.uMidColor.value.setHex(0x5f788e);
    G.skyUniforms.uHorizonColor.value.setHex(0x9ab0c2);
    fog.color.setHex(0x9ab0c2);
    fog.density = 0.0028;
    btn.textContent = 'High Noon';
  } else {
    G.skyUniforms.uTopColor.value.setHex(0x090e14);
    G.skyUniforms.uMidColor.value.setHex(0x141d27);
    G.skyUniforms.uHorizonColor.value.setHex(0x1e2936);
    fog.color.setHex(0x1e2936);
    fog.density = 0.0042;
    btn.textContent = 'Starry Night';
  }
}

export function buildTerrainAndWater(): void {
  const size = 260;
  const segs = 80;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const colors: number[] = [];
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getTerrainHeight(vx, vz);
    posAttr.setY(i, vy);
    const col = getBiomeColor(vx, vz, vy);
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  assignGroundUvs(geo);

  const mat = terrainMaterial();
  G.terrainMesh = new THREE.Mesh(geo, mat);
  G.terrainMesh.receiveShadow = true;
  G.terrainMesh.userData = { type: 'ground' };
  G.scene.add(G.terrainMesh);
  G.worldInteractiveObjects.push(G.terrainMesh);

  // Custom GLSL Animated Water Shader with Specular Sun Glint & Ripples
  G.waterUniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(PALETTE.water) },
    uShallowColor: { value: new THREE.Color(PALETTE.foam) }
  };

  const waterGeo = new THREE.PlaneGeometry(size, size, 24, 24);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: G.waterUniforms,
    transparent: true,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.22 + uTime * 1.2) * 0.02;
        p.y += w;
        vWave = w;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        float rip = sin(vWorldPos.x * 0.45 + uTime * 0.7) * cos(vWorldPos.z * 0.32);
        float foam = smoothstep(0.48, 0.78, rip);
        vec3 col = mix(uDeepColor, uShallowColor, foam);
        gl_FragColor = vec4(col, 0.94);
      }
    `
  });
  G.waterMesh = new THREE.Mesh(waterGeo, waterMat);
  G.waterMesh.position.y = -0.34;
  G.scene.add(G.waterMesh);

  // Arched Wooden & Stone Footbridge over the River at (28, 0)
  buildRiverBridge(28, 0);

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.09, 0);
  bladeShape.lineTo(0, 0.85);
  bladeShape.lineTo(0.09, 0);
  bladeShape.closePath();
  const bladeGeo = new THREE.ShapeGeometry(bladeShape, 1);
  const bladeMat = grassMaterial();
  const grassCount = 900;
  G.grassInstanced = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let i = 0; i < grassCount * 3 && idx < grassCount; i++) {
    const gx = (Math.random() - 0.5) * 215;
    const gz = (Math.random() - 0.5) * 215;
    const gy = getTerrainHeight(gx, gz);
    if (gy < 0.08 || isDeepWater(gx, gz) || (gx < -30 && gz > 25) || (gx > 32 && gz > 28)) continue;
    dummy.position.set(gx, gy, gz);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    const s = 0.7 + Math.random() * 0.85;
    dummy.scale.set(s, s * (0.85 + Math.random() * 0.4), s);
    dummy.updateMatrix();
    G.grassInstanced.setMatrixAt(idx++, dummy.matrix);
  }
  G.grassInstanced.instanceMatrix.needsUpdate = true;
  G.scene.add(G.grassInstanced);
}

export function buildRiverBridge(bx: number, bz: number): void {
  const grp = new THREE.Group();
  grp.position.set(bx, 0, bz);
  const woodMat = albedoMaterial(0x42352a, 'wood');
  const stoneMat = albedoMaterial(0x505a63, 'stone');

  for (let i = -7; i <= 7; i++) {
    const t = i / 7;
    const archY = Math.cos(t * Math.PI * 0.5) * 1.15 - 0.1;
    const plank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.8, 6), woodMat);
    plank.rotation.x = Math.PI / 2;
    plank.position.set(i * 1.0, archY, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    grp.add(plank);
  }
  [-1.8, 1.8].forEach((oz: number) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.2, 0.8, oz),
      new THREE.Vector3(0, 2.05, oz),
      new THREE.Vector3(7.2, 0.8, oz)
    ]);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.1, 5, false), stoneMat);
    rail.castShadow = true;
    grp.add(rail);
  });
  sealAlbedoUvs(grp);
  G.scene.add(grp);
  addCartoonOutline(grp, 0.038);
  loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_river_bridge', gltf, { outlineThickness: 0.035 });
  });
}
