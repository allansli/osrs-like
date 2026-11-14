import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { loadGltfOnce } from '../src/engine/gltf';

const fakeGltf = (): GLTF => ({ scene: {} }) as unknown as GLTF;

describe('loadGltfOnce', () => {
  it('returns the same promise for repeated calls', async () => {
    const load = vi.fn(async () => fakeGltf());
    const a = loadGltfOnce('/models/same.glb', load);
    const b = loadGltfOnce('/models/same.glb', load);
    expect(b).toBe(a);
    expect(await a).toBe(await b);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a failed load resolves null and the next call retries', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = fakeGltf();
    const load = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(ok);
    expect(await loadGltfOnce('/models/retry.glb', load)).toBeNull();
    expect(await loadGltfOnce('/models/retry.glb', load)).toBe(ok);
    expect(load).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('concurrent calls during a load share it', async () => {
    let resolve!: (g: GLTF) => void;
    const load = vi.fn(() => new Promise<GLTF>((r) => { resolve = r; }));
    const first = loadGltfOnce('/models/concurrent.glb', load);
    const second = loadGltfOnce('/models/concurrent.glb', load);
    const g = fakeGltf();
    resolve(g);
    expect(await first).toBe(g);
    expect(await second).toBe(g);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
