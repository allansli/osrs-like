import * as THREE from 'three';

/** BotW gouache tokens locked by the Phase 1 design pass. */
export const PALETTE = {
  sage: '#789c54',
  sageLit: '#9ab86c',
  dirt: '#c8b48a',
  rim: '#fef08a',
  shadow: '#6d5b86'
};

const RIM = new THREE.Color(PALETTE.rim);
const SHADOW = new THREE.Color(PALETTE.shadow);

/**
 * Faceted, non-metallic toon material.
 * Lambert still honors `flatShading`, and the fragment patch is a hard
 * 2-band cel: `step(0.42, NdotL)` against a world-space sun so the
 * south face of Lumbridge Castle stays in the lit band, with a softened
 * cool-violet shadow and a warm `#fef08a` rim.
 */
export function facetMaterial(params: Record<string, unknown> = {}): THREE.MeshLambertMaterial {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'metalness' || key === 'roughness') continue;
    cleaned[key] = value;
  }
  cleaned.flatShading = true;
  const bypass = Number(params.emissiveIntensity || 0) > 0.4 ? 1 : 0;
  const mat = new THREE.MeshLambertMaterial(cleaned as THREE.MeshLambertMaterialParameters);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCelBypass = { value: bypass };
    shader.fragmentShader =
      'uniform float uCelBypass;\n' +
      shader.fragmentShader.replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
        vec3 nCel = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        vec3 sunDir = normalize(vec3(0.42, 0.78, 0.55));
        float ndl = dot(nCel, sunDir);
        float cel = step(0.42, ndl);
        vec3 shadowTint = vec3(${SHADOW.r.toFixed(6)}, ${SHADOW.g.toFixed(6)}, ${SHADOW.b.toFixed(6)});
        vec3 celLit = mix(outgoingLight * mix(vec3(1.0), shadowTint, 0.38), outgoingLight, cel);
        float rim = pow(1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 2.2);
        celLit += vec3(${RIM.r.toFixed(6)}, ${RIM.g.toFixed(6)}, ${RIM.b.toFixed(6)}) * rim * 0.55;
        outgoingLight = mix(celLit, outgoingLight, uCelBypass);`
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
      uLightDir: { value: new THREE.Vector3(0.42, 0.78, 0.55).normalize() },
      uCam: { value: new THREE.Vector3() },
      uRim: { value: RIM.clone() },
      uShadow: { value: SHADOW.clone() }
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vH;
      void main() {
        vec3 p = position;
        #ifdef USE_INSTANCING
          float sway = sin(uTime * 1.8 + instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.21) * 0.22 * p.y;
          p.x += sway;
          p.z += sway * 0.35;
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
      uniform vec3 uCam;
      uniform vec3 uRim;
      uniform vec3 uShadow;
      varying vec3 vWorld;
      varying float vH;
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        float ndl = dot(n, normalize(uLightDir));
        float cel = step(0.42, ndl);
        vec3 albedo = mix(uBase, uLit, vH);
        vec3 shade = mix(vec3(1.0), uShadow, 0.38);
        vec3 col = mix(albedo * shade, albedo, cel);
        vec3 viewDir = normalize(uCam - vWorld);
        float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);
        col += uRim * rim * 0.45;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}
