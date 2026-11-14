import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

const brassFills = vi.hoisted(() => [] as number[]);
vi.mock('../src/ui/hud', async (orig) => {
  const ctx = new Proxy({ fillStyle: '' } as Record<string, unknown>, {
    get(target, key) {
      if (key === 'fill') return () => { if (target.fillStyle === '#c5a059') brassFills.push(1); };
      if (key in target) return target[key as string];
      return () => {};
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    }
  });
  return {
    ...(await orig<typeof import('../src/ui/hud')>()),
    el: () => ({ width: 200, height: 200, getContext: () => ctx })
  };
});

import { G } from '../src/engine/context';
import { renderMinimap } from '../src/engine/overlay';

// Stage 2 review 5 follow-up: place labels share G.npcList but are not NPCs.
describe('minimap NPC markers', () => {
  it('draws a brass dot for a real NPC and none for a place label', () => {
    G.npcList.length = 0;
    G.npcList.push({ pos: new THREE.Vector3(5, 0, 5), name: 'Shopkeeper', color: '#fff', yOffset: 2 });
    G.npcList.push({
      pos: new THREE.Vector3(-29, 0, -30),
      name: 'Reedglass Tarn',
      color: '#fde047',
      yOffset: 3,
      showWithin: 24
    });
    renderMinimap();
    expect(brassFills.length).toBe(1);
  });
});
