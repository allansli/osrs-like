import * as THREE from 'three';
import { G } from './context';
import { SKY_DOME_RADIUS } from '../data/look';
import { AIR, COLOR_FOOTER } from './atmosphere';
import type { DayFrame } from '../state/dayCycle';

const uNight = { value: 0 };

export function buildSky(): void {
  const skyGeo = new THREE.SphereGeometry(SKY_DOME_RADIUS, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      ...AIR,
      uNight,
    },
    side: THREE.BackSide,
    depthWrite: false,
    dithering: true,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uKeyColor;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uFill;
      uniform float uNight;
      varying vec3 vDir;
      #include <common>
      #include <dithering_pars_fragment>

      float hashStars(vec3 p) {
        vec3 cell = floor(p * 120.0);
        return fract(sin(dot(cell, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);

        // Three-stop gradient
        vec3 sky = mix(uHorizon, uFill, smoothstep(0.0, 0.25, h));
        sky = mix(sky, uZenith, smoothstep(0.25, 0.85, h));

        // Horizon glow toward uSunDir
        vec3 sunDirNorm = normalize(uSunDir);
        float sunDot = max(dot(dir, sunDirNorm), 0.0);
        float horizonMask = 1.0 - smoothstep(0.0, 0.25, h);
        float horizonGlow = pow(sunDot, 4.0) * horizonMask;
        sky += uKeyColor * (horizonGlow * 0.35);

        // Sun and moon discs as step edges with one halo step
        float cosAngle = dot(dir, sunDirNorm);
        float disc = step(0.998, cosAngle);
        float halo = step(0.992, cosAngle) * (1.0 - disc);
        vec3 discColor = mix(vec3(0.0), uKeyColor * 0.4, halo);
        discColor = mix(discColor, uKeyColor * 1.8, disc);
        sky += discColor;

        // Stars from a hash of the direction with a hard threshold, drawn only when uNight is above 0
        if (uNight > 0.0) {
          float starRand = hashStars(dir);
          float star = step(0.995, starRand) * step(0.12, dir.y);
          sky += vec3(star * 0.8) * uNight;
        }

        gl_FragColor = vec4(sky, 1.0);
        ${COLOR_FOOTER}
        #include <dithering_fragment>
      }
    `,
  });

  G.skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
  G.scene.add(G.skyDomeMesh);
}

export function updateSky(frame: DayFrame): void {
  uNight.value = frame.keyIsMoon ? 1.0 : 0.0;
  G.skyDomeMesh.position.copy(G.camera.position);
  (G.scene.fog as THREE.FogExp2).color.copy(AIR.uAirColor.value);
  (G.scene.fog as THREE.FogExp2).density = AIR.uFogDensity.value;
}
