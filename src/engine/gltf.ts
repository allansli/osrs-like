import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const cache = new Map<string, Promise<GLTF | null>>();

function defaultGltfLoad(url: string): Promise<GLTF> {
  return new GLTFLoader().loadAsync(url);
}

export function loadGltfOnce(
  url: string,
  load: (url: string) => Promise<GLTF> = defaultGltfLoad
): Promise<GLTF | null> {
  const existing = cache.get(url);
  if (existing) {
    return existing;
  }

  const promise = load(url).catch((err) => {
    cache.delete(url);
    console.warn(`[GLTF] Failed to load ${url}:`, err);
    return null;
  });

  cache.set(url, promise);
  return promise;
}
