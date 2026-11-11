import * as THREE from 'three';
import { createBrushSheet } from '../oilpaint/brush.js';
import { createShared } from '../oilpaint/common.js';
import { createFrame } from '../oilpaint/finish.js';
import { createShade } from '../oilpaint/shade.js';
import type { PaintClass } from './contract';
import { applyGroundMaps, createPaintedGround, fillGroundMaps, type PaintedGround } from './ground';
import { pinPaint, type PaintActor, type PinnedPaint } from './pinned';

export interface OilSession {
  low: boolean;
  lastFrameMs: number;
  pinCount: number;
  drawCalls: number;
  triangles: number;
  bindActors: (actors: PaintActor[]) => void;
  render: (gameScene: THREE.Scene, camera: THREE.PerspectiveCamera, focus: THREE.Vector3, overlay: THREE.Scene | null, dt: number) => void;
  setPixelRatio: (dpr: number) => void;
  resize: () => void;
  setLow: (low: boolean) => void;
}

export function webgl2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

/** The painter owns the picture: no tone mapping, colours written as paint, WebGL2. */
export function createOilRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false
  });
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const clear = new THREE.Color().setRGB(0.6, 0.6, 0.67, THREE.LinearSRGBColorSpace);
  renderer.setClearColor(clear, 1);
  renderer.domElement.id = 'game-canvas';
  return renderer;
}

export function attachOilPaint(
  renderer: THREE.WebGLRenderer,
  gameScene: THREE.Scene,
  heightAt: (x: number, z: number) => number,
  low: boolean,
  stillCasters: THREE.Object3D[]
): OilSession {
  const shared = createShared();
  shared.tBrush.value = createBrushSheet();
  const maps = fillGroundMaps(heightAt);
  applyGroundMaps(shared, maps);
  const ground: PaintedGround = createPaintedGround(shared);
  if (low) ground.tufts.visible = false;

  const keep = new Set(stillCasters);
  const hidden: THREE.Object3D[] = [];
  gameScene.children.forEach((child) => {
    if (!keep.has(child) && child.visible) {
      child.visible = false;
      hidden.push(child);
    }
  });
  const shade = createShade(renderer, shared, gameScene);
  hidden.forEach((child) => {
    child.visible = true;
  });

  const oilScene = new THREE.Scene();
  oilScene.add(ground.group);
  const frame = createFrame(renderer, shared, { samples: low ? 1 : 4 });
  frame.uniforms.uShafts.value = low ? 0 : 1;

  let pins: PinnedPaint | null = null;
  let time = 0;
  const size = new THREE.Vector2();
  const session: OilSession = {
    low,
    lastFrameMs: 0,
    pinCount: 0,
    drawCalls: 0,
    triangles: 0,
    bindActors(actors) {
      if (pins) {
        pins.dispose();
        pins = null;
      }
      const painted = pinPaint(shared, actors);
      session.pinCount = painted ? painted.count : 0;
      if (!painted) return;
      pins = painted;
      oilScene.add(painted.mesh);
      for (const actor of actors) {
        actor.root.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) mesh.layers.enable(1);
        });
      }
    },
    setLow(next) {
      session.low = next;
      frame.uniforms.uShafts.value = next ? 0 : 1;
      ground.tufts.visible = !next;
    },
    setPixelRatio(dpr) {
      const cap = session.low ? 1 : 1.5;
      renderer.setPixelRatio(Math.min(Math.max(dpr, 1), cap));
      session.resize();
    },
    resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      frame.resize();
    },
    render(gameScene, camera, focus, overlay, dt) {
      const t0 = performance.now();
      renderer.info.autoReset = false;
      renderer.info.reset();
      time += Math.min(0.05, Math.max(0, dt));
      shared.uTime.value = time;
      shared.uFocus.value.set(focus.x, focus.y, focus.z);
      renderer.getDrawingBufferSize(size);
      const fov = THREE.MathUtils.degToRad(camera.fov);
      shared.uPixel.value = (2 * Math.tan(fov / 2)) / Math.max(1, size.y);
      gameScene.updateMatrixWorld(true);
      ground.follow(camera.position.x, camera.position.z);
      if (pins) pins.update();
      shade.update(gameScene, focus);
      frame.render(oilScene, camera);
      if (overlay) {
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(overlay, camera);
      }
      session.drawCalls = renderer.info.render.calls;
      session.triangles = renderer.info.render.triangles;
      session.lastFrameMs = performance.now() - t0;
    }
  };
  return session;
}

export type { PaintClass };
