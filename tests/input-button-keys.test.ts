import { afterAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { G, player } from '../src/engine/context';
import { setupInputHandlers } from '../src/engine/input';

type Handler = (e: unknown) => void;
const handlers: Record<string, Handler> = {};
const node = { addEventListener: () => {}, classList: { contains: () => false } };
class FakeElement {}
vi.stubGlobal('Element', FakeElement);
vi.stubGlobal('window', { addEventListener: (type: string, fn: Handler) => { handlers[type] = fn; } });
vi.stubGlobal('document', { addEventListener: () => {}, getElementById: () => node });
afterAll(() => vi.unstubAllGlobals());

// Chrome reports :focus-visible as true for any focused button once a key is down, so the stub always says true.
function makeButton() {
  const button = Object.assign(new FakeElement(), {
    tagName: 'BUTTON',
    isContentEditable: false,
    blurred: false,
    matches: (q: string) => q === ':focus-visible',
    blur() { button.blurred = true; },
    closest: (q: string) => (q === 'button' ? button : null)
  });
  return button;
}

function space(target: unknown) {
  const ev = { code: 'Space', key: ' ', target, prevented: false, preventDefault() { ev.prevented = true; } };
  handlers.keydown(ev);
  return ev;
}

it('Space after a mouse click on a button jumps; on a button reached by Tab it is left to the button', () => {
  G.scene = new THREE.Scene();
  G.renderer = { domElement: node } as unknown as THREE.WebGLRenderer;
  setupInputHandlers();
  player.downed = false;

  const clicked = makeButton();
  handlers.pointerdown({ target: clicked });
  player.isGrounded = true;
  const ev = space(clicked);
  expect(clicked.blurred).toBe(true);
  expect(ev.prevented).toBe(true);
  expect(player.isGrounded).toBe(false);

  handlers.keydown({ code: 'Tab', key: 'Tab', target: clicked, preventDefault() {} });
  const tabbed = makeButton();
  player.isGrounded = true;
  const ev2 = space(tabbed);
  expect(tabbed.blurred).toBe(false);
  expect(ev2.prevented).toBe(false);
  expect(player.isGrounded).toBe(true);
});
