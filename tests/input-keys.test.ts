import { afterAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { G } from '../src/engine/context';
import { setupInputHandlers } from '../src/engine/input';

type Handler = (e: unknown) => void;
const handlers: Record<string, Handler> = {};
const node = { addEventListener: () => {}, classList: { contains: () => false } };
vi.stubGlobal('window', { addEventListener: (type: string, fn: Handler) => { handlers[type] = fn; } });
vi.stubGlobal('document', { addEventListener: () => {}, getElementById: () => node });
afterAll(() => vi.unstubAllGlobals());

it('a key held on the canvas is released by a keyup that lands in a text input (finding 22)', () => {
  G.scene = new THREE.Scene();
  G.renderer = { domElement: node } as unknown as THREE.WebGLRenderer;
  setupInputHandlers();
  const canvasTarget = { tagName: 'CANVAS', isContentEditable: false };
  const inputTarget = { tagName: 'INPUT', isContentEditable: false };
  handlers.keydown({ code: 'KeyW', key: 'w', target: canvasTarget, preventDefault() {} });
  expect(G.keysPressed.KeyW).toBe(true);
  handlers.keyup({ code: 'KeyW', key: 'w', target: inputTarget });
  expect(G.keysPressed.KeyW).toBe(false);
  handlers.keydown({ code: 'KeyA', key: 'a', target: inputTarget, preventDefault() {} });
  expect(G.keysPressed.KeyA).toBeFalsy();
});
