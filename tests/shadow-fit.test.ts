import { describe, expect, it } from 'vitest';
import { CAMERA_LIMITS, GFX_TIERS, SHADOW_SUN_STEP_DEG } from '../src/data/look';
import { fitShadow, stepShadowDir } from '../src/state/shadowFit';

// Plan LT1, design 6.2 and G5.2. Conventions pinned for LT2:
// - Vec3 is a [x, y, z] tuple; lightDir points from the scene TOWARD the light and is a unit vector.
// - The shadow camera looks from lightPos to target with up (0, 1, 0), as three's DirectionalLight shadow does,
//   so its right axis is normalize(cross(up, lightDir)) and its up axis is cross(lightDir, right).
// - The frustum is a square of half-side `range` in those two axes; texel = 2 * range / mapSize.
// - The centre is 0.35 * range ahead of the camera along `forward` flattened onto the ground (y = 0).
// - Snapping moves lightPos (and target with it, so lightPos - target stays parallel to lightDir) by whole texels laterally.
type V = [number, number, number];
const norm = (v: V): V => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const axes = (lightDir: V): { x: V; y: V } => { const x = norm(cross([0, 1, 0], lightDir)); return { x, y: cross(lightDir, x) }; };

const LIGHTS: V[] = [norm([0.52, 0.78, 0.34]), norm([0.9, 0.12, 0.2]), norm([-0.3, 0.5, -0.8]), norm([0.05, 0.99, 0.02])];
const TIERS = (['balanced', 'high', 'ultra'] as const).map((id) => GFX_TIERS[id]);
const forwardOf = (yaw: number, pitch = 0.6): V => [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
const ideal = (cam: V, fwd: V, range: number): V => {
  const h = Math.hypot(fwd[0], fwd[2]);
  return [cam[0] + (fwd[0] / h) * 0.35 * range, 0, cam[2] + (fwd[2] / h) * 0.35 * range];
};

describe('fitShadow', () => {
  it('reads range and map size from the tier table', () => {
    expect(TIERS).toHaveLength(3);
    for (const t of TIERS) {
      const fit = fitShadow([3, 12, -7], forwardOf(0.4), LIGHTS[0], t.shadowRange, t.shadowSize);
      expect(fit.texel).toBeCloseTo((2 * t.shadowRange) / t.shadowSize, 9);
    }
  });

  it('puts lightPos along lightDir from the target', () => {
    expect(LIGHTS).toHaveLength(4);
    for (const l of LIGHTS) {
      const fit = fitShadow([10, 12, 4], forwardOf(1.1), l, 54, 2048);
      const d = sub(fit.lightPos, fit.target);
      expect(Math.hypot(...d)).toBeGreaterThan(54);
      expect(dot(norm(d), l)).toBeGreaterThan(1 - 1e-6);
    }
  });

  it('centres the frustum 0.35 of the range ahead of the camera, to within a texel', () => {
    for (const l of LIGHTS) {
      const { x, y } = axes(l);
      for (let k = 0; k < 8; k++) {
        const cam: V = [k * 13.7 - 40, 12, 22 - k * 9.1];
        const fwd = forwardOf((k * Math.PI) / 4);
        const fit = fitShadow(cam, fwd, l, 54, 2048);
        const off = sub(fit.target, ideal(cam, fwd, 54));
        expect(Math.abs(dot(off, x)), `light ${l} yaw ${k} x`).toBeLessThanOrEqual(fit.texel);
        expect(Math.abs(dot(off, y)), `light ${l} yaw ${k} y`).toBeLessThanOrEqual(fit.texel);
      }
    }
  });

  it('snaps the light position to a whole multiple of the texel on both light-space axes', () => {
    for (const l of LIGHTS) {
      const { x, y } = axes(l);
      for (let k = 0; k < 20; k++) {
        const fit = fitShadow([k * 3.137 - 25, 9, k * 1.911 - 14], forwardOf(k * 0.7), l, 40, 2048);
        for (const [name, axis] of [['x', x], ['y', y]] as const) {
          const cells = dot(fit.lightPos, axis) / fit.texel;
          expect(Math.abs(cells - Math.round(cells)), `light ${l} step ${k} ${name}`).toBeLessThan(1e-4);
        }
      }
    }
  });

  it('does not crawl: moving the camera in tenths of a texel changes the light only in whole texels', () => {
    for (const l of LIGHTS) {
      const { x, y } = axes(l);
      const fwd = forwardOf(0.9);
      const texel = (2 * 54) / 2048;
      let prev = fitShadow([5, 12, 5], fwd, l, 54, 2048).lightPos;
      let changes = 0;
      for (let i = 1; i <= 100; i++) {
        const cur = fitShadow([5 + i * 0.1 * texel, 12, 5 + i * 0.07 * texel], fwd, l, 54, 2048).lightPos;
        const d = sub(cur, prev);
        for (const axis of [x, y]) {
          const cells = dot(d, axis) / texel;
          expect(Math.abs(cells - Math.round(cells)), `light ${l} step ${i}`).toBeLessThan(1e-4);
        }
        if (Math.hypot(...d) > 1e-9) changes++;
        prev = cur;
      }
      // ten texels of travel can cross at most about eleven boundaries on each of two axes
      expect(changes, `light ${l}`).toBeLessThanOrEqual(22);
      expect(changes, `light ${l}`).toBeGreaterThan(0);
    }
  });

  it('keeps a camera movement below one texel from moving the light more than one texel', () => {
    for (const l of LIGHTS) {
      const a = fitShadow([8, 12, 8], forwardOf(2), l, 70, 4096);
      const b = fitShadow([8 + a.texel * 0.4, 12, 8], forwardOf(2), l, 70, 4096);
      expect(Math.hypot(...sub(a.lightPos, b.lightPos))).toBeLessThanOrEqual(a.texel * 2 + 1e-6);
    }
  });

  it('contains the hero at every camera yaw, pitch and distance the player can reach', () => {
    expect(TIERS).toHaveLength(3);
    for (const t of TIERS) {
      for (const l of LIGHTS) {
        const { x, y } = axes(l);
        for (let k = 0; k < 16; k++) {
          const yaw = (k * Math.PI) / 8;
          for (const pitch of [CAMERA_LIMITS.pitchMin, 0.6, CAMERA_LIMITS.pitchMax]) {
            for (const distance of [CAMERA_LIMITS.distanceMin, 14, CAMERA_LIMITS.distanceMax]) {
              const hero: V = [31.3, 0, -17.9];
              const fwd = forwardOf(yaw, pitch);
              const cam: V = [hero[0] - fwd[0] * distance, distance * Math.sin(pitch), hero[2] - fwd[2] * distance];
              const fit = fitShadow(cam, fwd, l, t.shadowRange, t.shadowSize);
              const off = sub(hero, fit.target);
              expect(Math.abs(dot(off, x)), `range ${t.shadowRange} yaw ${k} pitch ${pitch} dist ${distance}`).toBeLessThan(t.shadowRange);
              expect(Math.abs(dot(off, y)), `range ${t.shadowRange} yaw ${k} pitch ${pitch} dist ${distance}`).toBeLessThan(t.shadowRange);
            }
          }
        }
      }
    }
  });
});

describe('stepShadowDir', () => {
  const rotY = (deg: number): V => { const r = (deg * Math.PI) / 180; return [Math.sin(r) * 0.8, 0.6, Math.cos(r) * 0.8]; };

  it('uses the half degree step of the plan', () => {
    expect(SHADOW_SUN_STEP_DEG).toBe(0.5);
  });

  it('holds below the step and snaps beyond it', () => {
    const cur = rotY(0);
    expect(stepShadowDir(cur, rotY(0), SHADOW_SUN_STEP_DEG)).toEqual(cur);
    const near = rotY(0.4 / 0.8);
    expect(stepShadowDir(cur, near, SHADOW_SUN_STEP_DEG)).toEqual(cur);
    const far = rotY(0.7 / 0.8);
    expect(stepShadowDir(cur, far, SHADOW_SUN_STEP_DEG)).toEqual(far);
    expect(stepShadowDir(cur, rotY(40), SHADOW_SUN_STEP_DEG)).toEqual(rotY(40));
  });

  it('follows a moving sun within the step and snaps about every two seconds at the running clock', () => {
    // 0.25 degree per second of sun travel is the running clock of CALL-V3 (24 minutes for 360 degrees)
    let cur = rotY(0);
    let snaps = 0;
    for (let i = 1; i <= 600; i++) {
      const sun = rotY((0.25 * i * 0.1) / 0.8);
      const next = stepShadowDir(cur, sun, SHADOW_SUN_STEP_DEG);
      if (next !== cur && (next[0] !== cur[0] || next[1] !== cur[1] || next[2] !== cur[2])) snaps++;
      cur = next;
      const err = (Math.acos(Math.min(1, dot(norm(cur), norm(sun)))) * 180) / Math.PI;
      expect(err, `tick ${i}`).toBeLessThanOrEqual(SHADOW_SUN_STEP_DEG + 1e-6);
    }
    expect(snaps).toBeGreaterThanOrEqual(25);
    expect(snaps).toBeLessThanOrEqual(35);
  });
});
