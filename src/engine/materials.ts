import * as THREE from 'three';
import { attachAtmosphere } from './atmosphere';
import { isPlainMode } from './post';

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

function outlineMaterial(thickness: number, color: number, skinned = false): THREE.ShaderMaterial {
  const key = `${thickness}:${color}${skinned ? ':skinned' : ''}`;
  const cached = outlineCache.get(key);
  if (cached) return cached;
  const vertexShader = skinned
    ? `
      uniform float uThickness;
      attribute vec3 outlineNormal;
      #include <skinning_pars_vertex>
      void main() {
        vec3 objectNormal = outlineNormal;
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 viewPos = modelViewMatrix * vec4(transformed, 1.0);
        vec3 viewNorm = normalize(normalMatrix * objectNormal);
        viewPos.xy += viewNorm.xy * uThickness;
        viewPos.z -= uThickness * 2.5 + 0.045;
        gl_Position = projectionMatrix * viewPos;
      }
    `
    : `
      uniform float uThickness;
      void main() {
        vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNorm = normalize(normalMatrix * normal);
        viewPos.xy += viewNorm.xy * uThickness;
        viewPos.z -= uThickness * 2.5 + 0.045;
        gl_Position = projectionMatrix * viewPos;
      }
    `;
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
    vertexShader,
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
 * Skinned outline push direction (plan S1d): per vertex, the normalised sum of the normals of every
 * vertex at the same position, so the split copies of a hard edge push the same way.
 * Two documented cases:
 * - no `normal` attribute: no `outlineNormal` is written. The shader then reads zero and the shell is
 *   not pushed, as before S1d, when it read the absent `normal` as zero. Every Blender build exports
 *   NORMAL; only hand-built fixtures (tests/fixtures/models/skinned-pair.glb) lack it.
 * - copies whose normals cancel (opposed faces at one position, as on goblin_body in the s3b
 *   one-material builds): the sum has no direction, so each copy keeps its own normal.
 */
const OUTLINE_ZERO_SUM = 1e-4;

function computeOutlineNormals(geometry: THREE.BufferGeometry): void {
  if (geometry.getAttribute('outlineNormal')) return;
  const normAttr = geometry.getAttribute('normal');
  if (!normAttr) return;
  const posAttr = geometry.getAttribute('position');
  const count = posAttr.count;
  const outlineNormals = new Float32Array(count * 3);

  const order = new Int32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  order.sort((a, b) => posAttr.getX(a) - posAttr.getX(b));

  const EPS = 1e-5;

  for (let k = 0; k < count; k++) {
    const i = order[k];
    const xi = posAttr.getX(i);
    const yi = posAttr.getY(i);
    const zi = posAttr.getZ(i);

    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;

    for (let back = k; back >= 0; back--) {
      const j = order[back];
      const dx = posAttr.getX(j) - xi;
      if (Math.abs(dx) > EPS) break;
      const dy = posAttr.getY(j) - yi;
      const dz = posAttr.getZ(j) - zi;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < EPS) {
        sumX += normAttr.getX(j);
        sumY += normAttr.getY(j);
        sumZ += normAttr.getZ(j);
      }
    }

    for (let fwd = k + 1; fwd < count; fwd++) {
      const j = order[fwd];
      const dx = posAttr.getX(j) - xi;
      if (Math.abs(dx) > EPS) break;
      const dy = posAttr.getY(j) - yi;
      const dz = posAttr.getZ(j) - zi;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < EPS) {
        sumX += normAttr.getX(j);
        sumY += normAttr.getY(j);
        sumZ += normAttr.getZ(j);
      }
    }

    let len = Math.sqrt(sumX * sumX + sumY * sumY + sumZ * sumZ);
    if (len < OUTLINE_ZERO_SUM) {
      sumX = normAttr.getX(i);
      sumY = normAttr.getY(i);
      sumZ = normAttr.getZ(i);
      len = Math.sqrt(sumX * sumX + sumY * sumY + sumZ * sumZ);
    }
    outlineNormals[i * 3] = sumX / len;
    outlineNormals[i * 3 + 1] = sumY / len;
    outlineNormals[i * 3 + 2] = sumZ / len;
  }

  geometry.setAttribute('outlineNormal', new THREE.Float32BufferAttribute(outlineNormals, 3));
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
  meshes.forEach((mesh) => {
    if (mesh.children.some((child) => child.userData?.isOutline)) return;
    const isSkinned = Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh);
    const mat = outlineMaterial(thickness, color, isSkinned);
    let shell: THREE.Mesh;
    if (isSkinned) {
      const skinnedMesh = mesh as THREE.SkinnedMesh;
      computeOutlineNormals(skinnedMesh.geometry);
      const skinnedShell = new THREE.SkinnedMesh(mesh.geometry, mat);
      skinnedShell.bind(skinnedMesh.skeleton, skinnedMesh.bindMatrix);
      const margin = thickness * 1.5 + 0.05;
      const meshSphere = skinnedMesh.boundingSphere;
      skinnedShell.boundingSphere = new THREE.Sphere(meshSphere!.center.clone(), meshSphere!.radius + margin);
      shell = skinnedShell;
    } else {
      shell = new THREE.Mesh(mesh.geometry, mat);
      if (!mesh.geometry.boundingSphere) {
        mesh.geometry.computeBoundingSphere();
      }
      if (mesh.geometry.boundingSphere) {
        shell.geometry.boundingSphere = mesh.geometry.boundingSphere.clone();
        shell.geometry.boundingSphere.radius += thickness * 1.5 + 0.05;
      }
    }
    shell.userData.isOutline = true;
    shell.castShadow = false;
    shell.receiveShadow = false;
    shell.frustumCulled = true;
    shell.visible = false;
    mesh.add(shell);
  });
}

// Band edges and values of design 5.2, kept as GLSL literal text so LT7 tunes constants only.
const BAND_WIDTH_HALF = '0.02';
const CUT_LOW_EDGE = '0.15';
const CUT_HIGH_EDGE = '0.55';
const CUT_GRAZE = '0.22';
const CUT_HALF = '0.62';
const ROUND_EDGE = '0.30';
const ROUND_SHADE = '0.62';
const FOOT_FLOOR = '0.75';

/** three's lights_lambert_pars_fragment with a banded key and no division by pi (design 6.1). */
const FACET_LIGHT_PARS = `
varying vec3 vViewPosition;

struct LambertMaterial {
  vec3 diffuseColor;
  float specularStrength;
};

float facetStep(float edge, float x) {
  return smoothstep(edge - ${BAND_WIDTH_HALF}, edge + ${BAND_WIDTH_HALF}, x);
}

float facetBand(float x) {
#ifdef FACET_CUT
  return mix(mix(${CUT_GRAZE}, ${CUT_HALF}, facetStep(${CUT_LOW_EDGE}, x)), 1.0, facetStep(${CUT_HIGH_EDGE}, x));
#else
  return mix(${ROUND_SHADE}, 1.0, facetStep(${ROUND_EDGE}, x));
#endif
}

void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  float rawNL = dot( geometryNormal, directLight.direction );
  float lit = 1.0 - step( rawNL, 0.0 );
#ifdef CLOUD_SHADOW
  lit *= cloudShade( vAirWorld.xz );
#endif
  reflectedLight.directDiffuse += lit * facetBand( saturate( rawNL ) ) * directLight.color * material.diffuseColor;
}

void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance * material.diffuseColor;
}

#define RE_Direct RE_Direct_Lambert
#define RE_IndirectDiffuse RE_IndirectDiffuse_Lambert

#ifdef FACET_BLEND
uniform float uFacet;
#endif
uniform float uFootHeight;
varying float vFootHeight;
`;

const FACET_FOOT = `#include <color_fragment>
diffuseColor.rgb *= uFootHeight > 0.0 ? mix(${FOOT_FLOOR}, 1.0, smoothstep(0.0, uFootHeight, vFootHeight)) : 1.0;`;

const FACET_BLEND_NORMAL = `#include <normal_fragment_begin>
#ifdef FACET_BLEND
normal = normalize(mix(normal, normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition))), uFacet));
#endif`;

export type FacetShade = 'cut' | 'round';

export interface RegisteredFacetMaterial {
  material: THREE.MeshLambertMaterial;
  params: {
    color: THREE.Color;
    map: THREE.Texture | null;
    emissive: THREE.Color;
    side: THREE.Side;
    vertexColors: boolean;
  };
}

export const registeredFacetMaterials: RegisteredFacetMaterial[] = [];

/**
 * Banded Lambert albedo (design 6.1). The scene's lights and shadows reach the surface through
 * three's own Lambert sum; only the key's response is banded.
 * `shade: 'cut'` (flat normals, three bands) or `'round'` (smooth normals, two bands, the default).
 * `facetBlend` (terrain) keeps smooth normals and mixes in the face normal by that amount.
 * `footHeight` darkens the lowest units of the object toward its foot; 0 turns it off.
 * An optional `map` is sampled by `map_fragment` into `diffuseColor`. No normal or roughness maps.
 * Every variant is a key in `material.defines`, so three's program cache tells them apart.
 */
export function facetMaterial(params: Record<string, unknown> = {}): THREE.MeshLambertMaterial {
  const cleaned: Record<string, unknown> = {};
  let flat = false;
  let shade: FacetShade = 'round';
  let facetBlend: number | null = null;
  let footHeight = 0;
  let map: THREE.Texture | null = null;
  for (const [key, value] of Object.entries(params)) {
    if (key === 'metalness' || key === 'roughness') continue;
    if (key === 'flatShading') {
      flat = value === true;
      continue;
    }
    if (key === 'shade') {
      shade = value as FacetShade;
      continue;
    }
    if (key === 'facetBlend') {
      facetBlend = value as number;
      continue;
    }
    if (key === 'footHeight') {
      footHeight = value as number;
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
  if (cleaned.side === undefined) {
    cleaned.side = THREE.DoubleSide;
  }
  if (isPlainMode()) {
    const stock = new THREE.MeshLambertMaterial(cleaned as THREE.MeshLambertMaterialParameters);
    if (map) stock.userData.albedoSpace = 'prop';
    return stock;
  }
  const defines: Record<string, string> = {};
  let cacheKey: string;
  if (facetBlend !== null) {
    flat = false;
    defines.FACET_BLEND = '';
    cacheKey = 'facet|blend';
  } else if (shade === 'cut') {
    flat = true;
    defines.FACET_CUT = '';
    cacheKey = 'facet|cut';
  } else {
    cacheKey = 'facet|round';
  }
  cleaned.flatShading = flat;
  const mat = new THREE.MeshLambertMaterial(cleaned as THREE.MeshLambertMaterialParameters);
  registeredFacetMaterials.push({
    material: mat,
    params: {
      color: mat.color.clone(),
      map: mat.map,
      emissive: mat.emissive.clone(),
      side: mat.side,
      vertexColors: mat.vertexColors
    }
  });
  mat.defines = { ...mat.defines, ...defines };
  if (map) mat.userData.albedoSpace = 'prop';
  const foot = { value: footHeight };
  mat.onBeforeCompile = (shader) => {
    if (facetBlend !== null) shader.uniforms.uFacet = { value: facetBlend };
    shader.uniforms.uFootHeight = foot;
    shader.vertexShader = 'varying float vFootHeight;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vFootHeight = transformed.y;`
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_lambert_pars_fragment>', FACET_LIGHT_PARS)
      .replace('#include <color_fragment>', FACET_FOOT)
      .replace('#include <normal_fragment_begin>', FACET_BLEND_NORMAL);
  };
  mat.customProgramCacheKey = () => cacheKey;
  attachAtmosphere(mat);
  return mat;
}
