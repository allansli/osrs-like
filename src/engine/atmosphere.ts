import * as THREE from 'three';
import type { DayFrame } from '../state/dayCycle';

export const COLOR_FOOTER = `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

export const AIR = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyColor: { value: new THREE.Color(0xffffff) },
  uAirColor: { value: new THREE.Color(0xffffff) },
  uAirSunColor: { value: new THREE.Color(0xffffff) },
  uZenith: { value: new THREE.Color(0xffffff) },
  uHorizon: { value: new THREE.Color(0xffffff) },
  uFill: { value: new THREE.Color(0xffffff) },
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0, 0) },
  uFogDensity: { value: 0.0028 },
  uFogHeightFalloff: { value: 0 },
  uFogBase: { value: 0 },
  uRegionTint: { value: new THREE.Color(0x000000) },
};

export function updateAir(frame: DayFrame, dt: number): void {
  AIR.uSunDir.value.set(frame.sunDir[0], frame.sunDir[1], frame.sunDir[2]);
  AIR.uKeyColor.value.setRGB(frame.key[0], frame.key[1], frame.key[2]);
  AIR.uAirColor.value.setRGB(frame.air[0], frame.air[1], frame.air[2]);
  AIR.uAirSunColor.value.setRGB(frame.key[0], frame.key[1], frame.key[2]);
  AIR.uZenith.value.setRGB(frame.zenith[0], frame.zenith[1], frame.zenith[2]);
  AIR.uHorizon.value.setRGB(frame.horizon[0], frame.horizon[1], frame.horizon[2]);
  AIR.uFill.value.setRGB(frame.fill[0], frame.fill[1], frame.fill[2]);
  AIR.uTime.value += dt;
}
