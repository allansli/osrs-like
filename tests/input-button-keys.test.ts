import { afterAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { G, player } from '../src/engine/context';
import { setupInputHandlers } from '../src/engine/input';

type Handler = (e: unknown) => void;
const handlers: Record<string, Handler> = {};
const node = { addEventListener: () => {}, classList: { contains: () => false } };
vi.stubGlobal('window', { addEventListener: (type: string, fn: Handler) => { handlers[type] = fn; } });
vi.stubGlobal('document', { addEventListener: () => {}, getElementById: () => node });
afterAll(() => vi.unstubAllGlobals());

function buttonTarget(focusVisible: boolean) {
  const button = { blurred: false, matches: (q: string) => q === ':focus-visible' && focusVisible, blur() { button.blurred = true; } };
  return { button, target: { tagName: 'BUTTON', isContentEditable: false, closest: (q: string) => (q === 'button' ? button : null) } };
}

it('Space on a button focused by a mouse click blurs it and jumps; on a keyboard-focused button it is left to the button', () => {
  G.scene = new THREE.Scene();
  G.renderer = { domElement: node } as unknown as THREE.WebGLRenderer;
  setupInputHandlers();
  player.isGrounded = true;
  player.downed = false;

  const kb = buttonTarget(true);
  let prevented = false;
  handlers.keydown({ code: 'Space', key: ' ', target: kb.target, preventDefault() { prevented = true; } });
  expect(player.isGrounded).toBe(true);
  expect(kb.button.blurred).toBe(false);
  expect(prevented).toBe(false);

  const mouse = buttonTarget(false);
  handlers.keydown({ code: 'Space', key: ' ', target: mouse.target, preventDefault() { prevented = true; } });
  expect(mouse.button.blurred).toBe(true);
  expect(prevented).toBe(true);
  expect(player.isGrounded).toBe(false);
});
