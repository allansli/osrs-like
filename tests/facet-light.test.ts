import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { facetMaterial } from '../src/engine/materials';
import { terrainMaterial } from '../src/engine/textures';

// Design 6.1 and 8.1 (G5.1), plan task LT3. Band thresholds, band values, the foot factor and
// the terrain's facet amount are tuned by LT7, so no assertion here pins those numbers.

type CompiledShader = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

const LAMBERT_SUM = 'reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance';

function compile(mat: THREE.Material): CompiledShader {
  const shader: CompiledShader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.lambert.vertexShader,
    fragmentShader: THREE.ShaderLib.lambert.fragmentShader
  };
  mat.onBeforeCompile(
    shader as unknown as Parameters<THREE.MeshLambertMaterial['onBeforeCompile']>[0],
    null as unknown as THREE.WebGLRenderer
  );
  return shader;
}

function definesOf(mat: THREE.Material): Record<string, unknown> {
  return (mat as THREE.Material & { defines?: Record<string, unknown> }).defines ?? {};
}

function stubTerrain(): THREE.MeshLambertMaterial {
  return terrainMaterial({
    load(url: string) {
      const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      tex.name = url;
      tex.needsUpdate = true;
      return tex;
    }
  });
}

describe('facet light model', () => {
  it("three's lambert fragment still includes lights_lambert_pars_fragment and fog_fragment", () => {
    const frag = THREE.ShaderLib.lambert.fragmentShader;
    expect(frag).toContain('#include <lights_lambert_pars_fragment>');
    expect(frag).toContain('#include <fog_fragment>');
    expect(frag).toContain(LAMBERT_SUM);
    const pars = THREE.ShaderChunk.lights_lambert_pars_fragment;
    expect(pars).toContain('RE_Direct_Lambert');
    expect(pars).toContain('BRDF_Lambert( material.diffuseColor )');
  });

  it('facetMaterial replaces RE_Direct_Lambert with a banded response', () => {
    const frag = compile(facetMaterial({ color: 0x334155 })).fragmentShader;
    expect(frag).not.toContain('#include <lights_lambert_pars_fragment>');
    expect(frag).toContain('RE_Direct_Lambert');
    expect(frag).toContain('facetBand(');
    expect(frag).toContain('FACET_CUT');
    expect(frag).not.toContain('BRDF_Lambert( material.diffuseColor )');
    expect(frag).toContain('#include <map_fragment>');
  });

  it('the Lambert sum is used again', () => {
    const frag = compile(facetMaterial({ color: 0x334155 })).fragmentShader;
    expect(frag).toContain(LAMBERT_SUM);
    expect(frag).not.toContain('vec3(0.52, 0.78, 0.34)');
    expect(frag).not.toContain('vCelNormal');
  });

  it('shade cut sets flatShading and three bands', () => {
    const mat = facetMaterial({ color: 0x334155, shade: 'cut' });
    expect(mat.flatShading).toBe(true);
    expect(definesOf(mat)).toHaveProperty('FACET_CUT');
    expect(definesOf(mat)).not.toHaveProperty('FACET_BLEND');
  });

  it('shade round keeps smooth normals and two bands', () => {
    const mat = facetMaterial({ color: 0x334155, shade: 'round' });
    expect(mat.flatShading).toBe(false);
    expect(definesOf(mat)).not.toHaveProperty('FACET_CUT');
    expect(definesOf(mat)).not.toHaveProperty('FACET_BLEND');
    expect(compile(mat).fragmentShader).toContain('facetBand(');
  });

  it('the default shade is round', () => {
    const mat = facetMaterial({ color: 0x334155 });
    expect(mat.flatShading).toBe(false);
    expect(definesOf(mat)).not.toHaveProperty('FACET_CUT');
    expect(mat.customProgramCacheKey()).toBe(facetMaterial({ shade: 'round' }).customProgramCacheKey());
  });

  it('terrainMaterial declares uFacet, defines FACET_BLEND, does not set flatShading, and still samples the eight ground maps', () => {
    const mat = stubTerrain();
    expect(mat.flatShading).toBe(false);
    expect(definesOf(mat)).toHaveProperty('FACET_BLEND');
    expect(definesOf(mat)).not.toHaveProperty('FACET_CUT');
    const shader = compile(mat);
    expect(shader.uniforms).toHaveProperty('uFacet');
    expect(typeof shader.uniforms.uFacet?.value).toBe('number');
    expect(shader.fragmentShader).toContain('uFacet');
    expect(shader.fragmentShader).toContain('facetBand(');
    expect(shader.fragmentShader).toContain('texture2D( map, vMapUv )');
    expect(shader.fragmentShader).toContain('texture2D( uDirtMap, vMapUv )');
    expect(shader.fragmentShader).toContain('texture2D( uSandMap, vMapUv )');
    expect(shader.fragmentShader).toContain('texture2D( uStoneMap, vMapUv )');
    expect(shader.fragmentShader).toContain('texture2D(uKorokMap, vMapUv)');
    expect(shader.fragmentShader).toContain('texture2D(uVolcanicMap, vMapUv)');
    expect(shader.fragmentShader).toContain('texture2D(uCobbleMap, vMapUv)');
    expect(shader.fragmentShader).toContain('texture2D(uCrackedSandMap, vMapUv)');
  });

  it('the foot gradient is off when uFootHeight is 0', () => {
    const plain = compile(facetMaterial({ color: 0x334155 }));
    expect(plain.uniforms).toHaveProperty('uFootHeight');
    expect(plain.uniforms.uFootHeight?.value).toBe(0);
    expect(plain.fragmentShader).toContain('uFootHeight');
    const footed = compile(facetMaterial({ color: 0x334155, footHeight: 1.5 }));
    expect(footed.uniforms.uFootHeight?.value).toBe(1.5);
  });

  it('customProgramCacheKey differs between terrainMaterial, a cut facetMaterial and a round facetMaterial', () => {
    const keys = [
      stubTerrain().customProgramCacheKey(),
      facetMaterial({ shade: 'cut' }).customProgramCacheKey(),
      facetMaterial({ shade: 'round' }).customProgramCacheKey()
    ];
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
  });
});
