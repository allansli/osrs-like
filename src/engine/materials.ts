import * as THREE from 'three';

/** Flat Nordic fantasy tokens inspired by Skyrim. */
export const PALETTE = {
  sage: '#3d4c38',
  sageLit: '#4f6147',
  sageShade: '#2b3826',
  dirt: '#473b30',
  stone: '#525c66',
  roof: '#2d333b',
  skyZenith: '#2e4359',
  skyMid: '#5f788e',
  skyHorizon: '#9ab0c2',
  water: '#1c2d36',
  foam: '#8da0a8',
  ink: '#14171a'
};

const outlineCache = new Map<string, THREE.ShaderMaterial>();

export function isSharedOutlineMaterial(m: THREE.Material): boolean {
  for (const mat of outlineCache.values()) {
    if (mat === m) return true;
  }
  return false;
}

function outlineMaterial(thickness: number, color: number): THREE.ShaderMaterial {
  const key = `${thickness}:${color}`;
  const cached = outlineCache.get(key);
  if (cached) return cached;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uThickness: { value: thickness }
    },
    vertexShader: `
      uniform float uThickness;
      void main() {
        vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNorm = normalize(normalMatrix * normal);
        viewPos.xy += viewNorm.xy * uThickness;
        viewPos.z -= uThickness * 2.5 + 0.045;
        gl_Position = projectionMatrix * viewPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `
  });
  outlineCache.set(key, mat);
  return mat;
}

function isSkippableOutline(obj: THREE.Object3D): boolean {
  const mesh = obj as THREE.Mesh;
  if (!mesh.isMesh) return true;
  if (mesh.userData?.isOutline || mesh.userData?.noOutline || mesh.userData?.isCollider) return true;
  const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
  if (!material || Array.isArray(material)) return !material;
  if (material.visible === false) return true;
  return false;
}

/**
 * Inverted-hull ink outline. Skips invisible colliders and meshes already outlined.
 * Pushes silhouette outward in view XY and biases view Z back so internal intersecting
 * sub-meshes (foliage clusters, castle blocks, armor overlays) never poke black spots through surfaces.
 */
export function addCartoonOutline(rootOrMesh: THREE.Object3D, thickness = 0.028, color = 0x1c1610): void {
  if (!rootOrMesh) return;
  const meshes: THREE.Mesh[] = [];
  const consider = (obj: THREE.Object3D) => {
    if (isSkippableOutline(obj)) return;
    meshes.push(obj as THREE.Mesh);
  };
  consider(rootOrMesh);
  rootOrMesh.traverse((obj) => {
    if (obj !== rootOrMesh) consider(obj);
  });
  const mat = outlineMaterial(thickness, color);
  meshes.forEach((mesh) => {
    if (mesh.children.some((child) => child.userData?.isOutline)) return;
    const shell = new THREE.Mesh(mesh.geometry, mat);
    shell.userData.isOutline = true;
    shell.castShadow = false;
    shell.receiveShadow = false;
    shell.frustumCulled = true;
    shell.visible = false;
    if (!mesh.geometry.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }
    if (mesh.geometry.boundingSphere) {
      shell.geometry.boundingSphere = mesh.geometry.boundingSphere.clone();
      shell.geometry.boundingSphere.radius += thickness * 1.5 + 0.05;
    }
    mesh.add(shell);
  });
}

/**
 * Smooth 2-band cartoon albedo. Lit faces stay the material color; shadow faces take one cool step.
 * An optional `map` is sampled by the Lambert `map_fragment` chunk into `diffuseColor` before the cel step,
 * so the texture tints the color token. No normal or roughness maps.
 * Normals interpolate across the surface so spheres and capsules stay round.
 * Pass flatShading: true only for cut gems and crystals.
 */
export function facetMaterial(params: Record<string, unknown> = {}): THREE.MeshLambertMaterial {
  const cleaned: Record<string, unknown> = {};
  let flat = false;
  let map: THREE.Texture | null = null;
  for (const [key, value] of Object.entries(params)) {
    if (key === 'metalness' || key === 'roughness') continue;
    if (key === 'flatShading') {
      flat = value === true;
      continue;
    }
    if (key === 'map') {
      map = (value as THREE.Texture) || null;
      continue;
    }
    cleaned[key] = value;
  }
  if (map) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.magFilter = THREE.LinearFilter;
    map.colorSpace = THREE.SRGBColorSpace;
    cleaned.map = map;
  }
  cleaned.flatShading = flat;
  if (cleaned.side === undefined) {
    cleaned.side = THREE.DoubleSide;
  }
  const mat = new THREE.MeshLambertMaterial(cleaned as THREE.MeshLambertMaterialParameters);
  if (map) mat.userData.albedoSpace = 'prop';
  const flatNormal = flat
    ? `#ifdef FLAT_SHADED
      vCelWorld = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    #endif
    `
    : '';
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      vCelNormal = normalize(mat3(modelMatrix) * objectNormal);`
    );
    shader.vertexShader = 'varying vec3 vCelNormal;\n' + shader.vertexShader;
    shader.fragmentShader = 'varying vec3 vCelNormal;\n' + shader.fragmentShader.replace(
      'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
      `vec3 vCelWorld = normalize(vCelNormal) * (gl_FrontFacing ? 1.0 : -1.0);
      ${flatNormal}float ndl = dot(normalize(vCelWorld), normalize(vec3(0.52, 0.78, 0.34)));
      float cel = smoothstep(0.33, 0.38, ndl);
      vec3 outgoingLight = diffuseColor.rgb * mix(vec3(0.70, 0.72, 0.82), vec3(1.04), cel) + totalEmissiveRadiance;`
    );
  };
  return mat;
}

export function grassMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new THREE.Color(PALETTE.sage) },
      uLit: { value: new THREE.Color(PALETTE.sageLit) },
      uLightDir: { value: new THREE.Vector3(0.52, 0.78, 0.34).normalize() }
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vH;
      void main() {
        vec3 p = position;
        #ifdef USE_INSTANCING
          float sway = (sin(uTime * 1.8 + instanceMatrix[3][0] * 0.42 + instanceMatrix[3][2] * 0.28) * 0.18 +
                        cos(uTime * 3.1 + instanceMatrix[3][0] * 0.85) * 0.06) * p.y;
          p.x += sway;
          p.z += sway * 0.4;
          vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
        #else
          float sway = sin(uTime * 1.8 + world.x * 0.42 + world.z * 0.28) * 0.16 * p.y;
          p.x += sway;
          vec4 world = modelMatrix * vec4(p, 1.0);
        #endif
        vWorld = world.xyz;
        vH = clamp(position.y, 0.0, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uBase;
      uniform vec3 uLit;
      uniform vec3 uLightDir;
      varying vec3 vWorld;
      varying float vH;
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        float ndl = dot(n, normalize(uLightDir));
        float cel = smoothstep(0.28, 0.42, ndl);
        vec3 albedo = mix(uBase, uLit, smoothstep(0.20, 0.85, vH));
        vec3 col = albedo * mix(vec3(0.64, 0.68, 0.80), vec3(1.08, 1.04, 0.96), cel);
        col += vec3(0.12, 0.16, 0.04) * smoothstep(0.60, 1.0, vH) * cel;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}
