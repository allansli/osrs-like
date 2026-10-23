import * as THREE from 'three';

/** Flat OSRS 2008 × Wind Waker cartoon tokens. */
export const PALETTE = {
  sage: '#68a84e',
  sageLit: '#78b85a',
  sageShade: '#5a9642',
  dirt: '#d9c298',
  stone: '#e5e7eb',
  roof: '#475569',
  skyZenith: '#3b82f6',
  skyMid: '#bae6fd',
  skyHorizon: '#fef3c7',
  water: '#38bdf8',
  foam: '#e0f2fe',
  ink: '#1c1610'
};

const outlineCache = new Map<string, THREE.ShaderMaterial>();

function outlineMaterial(thickness: number, color: number): THREE.ShaderMaterial {
  const key = `${thickness}:${color}`;
  const cached = outlineCache.get(key);
  if (cached) return cached;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uThickness: { value: thickness }
    },
    vertexShader: `
      uniform float uThickness;
      void main() {
        vec3 pos = position + normal * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
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
 * Thickness is in the mesh's local space so silhouettes stay crisp.
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
    shell.frustumCulled = false;
    mesh.add(shell);
  });
}

/**
 * Flat 2-band cartoon albedo. Ignores Lambert's continuous N·L and the yellow rim.
 * Lit faces stay the material color; shadow faces take one cool step.
 */
export function facetMaterial(params: Record<string, unknown> = {}): THREE.MeshLambertMaterial {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'metalness' || key === 'roughness' || key === 'map') continue;
    cleaned[key] = value;
  }
  cleaned.flatShading = true;
  const mat = new THREE.MeshLambertMaterial(cleaned as THREE.MeshLambertMaterialParameters);
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      vCelNormal = normalize(mat3(modelMatrix) * objectNormal);`
    );
    shader.vertexShader = 'varying vec3 vCelNormal;\n' + shader.vertexShader;
    shader.fragmentShader = 'varying vec3 vCelNormal;\n' + shader.fragmentShader.replace(
      'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
      `vec3 vCelWorld = normalize(vCelNormal);
      #ifdef FLAT_SHADED
        vCelWorld = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
      #endif
      float ndl = dot(normalize(vCelWorld), normalize(vec3(0.52, 0.78, 0.34)));
      float cel = step(0.38, ndl);
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
          float sway = sin(uTime * 1.6 + instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.21) * 0.16 * p.y;
          p.x += sway;
          vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
        #else
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
        float cel = step(0.38, ndl);
        vec3 albedo = mix(uBase, uLit, step(0.45, vH));
        vec3 col = albedo * mix(vec3(0.70, 0.72, 0.82), vec3(1.04), cel);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}
