// Where the sun reaches. The wood's shade is drawn once, from the sun, into a depth picture that every dab asks
// about for itself; the wanderer's own shadow is a second, small picture that follows them and is redrawn each
// frame.
import * as THREE from 'three';
import { SUN } from './common.js';

const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

function depthTarget(w, h) {
  const target = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, generateMipmaps: false });
  target.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
  target.depthTexture.compareFunction = THREE.LessEqualCompare;
  target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.LinearFilter;
  return target;
}

export function createShade(renderer, shared, woodShade) {
  // the wood, once: wide across the sun's direction, and only as tall as the trees need
  const wood = depthTarget(4096, 2560);
  const sunCam = new THREE.OrthographicCamera(-165, 165, 104, -104, 10, 800);
  const centre = new THREE.Vector3(0, 11, -8);
  sunCam.position.copy(centre).addScaledVector(SUN, 400);
  sunCam.lookAt(centre);
  sunCam.updateMatrixWorld(true);
  sunCam.updateProjectionMatrix();
  renderer.setRenderTarget(wood);
  renderer.clear();
  renderer.render(woodShade, sunCam);
  renderer.setRenderTarget(null);
  shared.tTreeShade.value = wood.depthTexture;
  shared.uTreeShadeMat.value.copy(BIAS).multiply(sunCam.projectionMatrix).multiply(sunCam.matrixWorldInverse);

  // the wanderer: a few metres round them, drawn from the things on layer 1
  const fig = depthTarget(256, 256);
  const figCam = new THREE.OrthographicCamera(-3.2, 3.2, 3.2, -3.2, 1, 60);
  figCam.layers.set(1);
  shared.tFigShade.value = fig.depthTexture;
  const depthOnly = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  return {
    update(scene, at) {
      figCam.position.set(at.x, at.y + 1.0, at.z).addScaledVector(SUN, 30);
      figCam.lookAt(at.x, at.y + 1.0, at.z);
      figCam.updateMatrixWorld(true);
      shared.uFigShadeMat.value.copy(BIAS).multiply(figCam.projectionMatrix).multiply(figCam.matrixWorldInverse);
      const before = scene.overrideMaterial;
      scene.overrideMaterial = depthOnly;
      renderer.setRenderTarget(fig);
      renderer.clear();
      renderer.render(scene, figCam);
      renderer.setRenderTarget(null);
      scene.overrideMaterial = before;
    },
  };
}
