import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonsterEntity } from '../src/engine/context';

// Plan AR1, design 6.10 (shader failure) and 8.1 G5.13; the flash-cache case is A11 item 4. Red until AR4b.
// Plain mode is module state, so every test loads fresh copies of the modules that share it.

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

type Shader = { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };

function compile(mat: THREE.Material): Shader {
  const shader: Shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.lambert.vertexShader,
    fragmentShader: THREE.ShaderLib.lambert.fragmentShader
  };
  mat.onBeforeCompile(shader as unknown as Parameters<THREE.MeshLambertMaterial['onBeforeCompile']>[0], null as unknown as THREE.WebGLRenderer);
  return shader;
}

async function load() {
  vi.resetModules();
  const materials = await import('../src/engine/materials');
  const post = await import('../src/engine/post');
  const reactions = await import('../src/engine/reactions');
  return { materials, post, reactions };
}

function tex(): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

describe('plain mode', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('enterPlainMode(scene) is idempotent', async () => {
    const { materials, post } = await load();
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), materials.facetMaterial({ color: 0x336699 }));
    scene.add(mesh);
    expect(post.isPlainMode()).toBe(false);
    post.enterPlainMode(scene);
    const first = mesh.material;
    expect(post.isPlainMode()).toBe(true);
    expect(() => post.enterPlainMode(scene)).not.toThrow();
    expect(post.isPlainMode()).toBe(true);
    expect(mesh.material).toBe(first);
  });

  it('a facet material built while plain mode is on is a stock Lambert with no custom chunk', async () => {
    const { materials, post } = await load();
    post.enterPlainMode(new THREE.Scene());
    const mat = materials.facetMaterial({ color: 0x336699, shade: 'cut' });
    const frag = compile(mat).fragmentShader;
    expect(frag).not.toContain('facetBand(');
    expect(frag).not.toContain('applyAir(');
    expect(mat).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(mat.color.getHex()).toBe(0x336699);
  });

  it('replaces a facet material registered earlier with a stock Lambert of the same look', async () => {
    const { materials, post } = await load();
    const scene = new THREE.Scene();
    const map = tex();
    const facet = materials.facetMaterial({ color: 0x336699, map, emissive: 0x112233, side: THREE.FrontSide, vertexColors: true, shade: 'cut' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), facet);
    scene.add(mesh);
    expect(compile(facet).fragmentShader).toContain('facetBand(');

    post.enterPlainMode(scene);

    const now = mesh.material as THREE.MeshLambertMaterial;
    expect(now).not.toBe(facet);
    expect(now).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(now.color.getHex()).toBe(0x336699);
    expect(now.map).toBe(facet.map);
    expect(now.emissive.getHex()).toBe(0x112233);
    expect(now.side).toBe(THREE.FrontSide);
    expect(now.vertexColors).toBe(true);
    expect(compile(now).fragmentShader).not.toContain('facetBand(');
  });

  it('a body whose materials the flash cache holds still flashes after the swap', async () => {
    const { materials, post, reactions } = await load();
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), materials.facetMaterial({ color: 0xc03030 }));
    group.add(mesh);
    scene.add(group);
    const monster = { rig: { group, hitbox: new THREE.Mesh() } } as unknown as MonsterEntity;
    reactions.collectFlashMaterials(monster);

    post.enterPlainMode(scene);

    const live = mesh.material as THREE.MeshLambertMaterial;
    expect(live.color.getHex()).toBe(0xc03030);
    reactions.flash(monster);
    reactions.updateReactions(0.045); // mid flash: the live material is lerped toward white
    expect(live.color.getHex()).not.toBe(0xc03030);
    reactions.updateReactions(1); // flash over: the colour is restored
    expect(live.color.getHex()).toBe(0xc03030);
  });
});
