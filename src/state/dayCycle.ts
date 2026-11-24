// Day cycle, sky colours, light directions, and phase stepping (design 5.3).

import { DAY_CLOCK, DAY_KEYS, PRESET_PHASE } from '../data/look';

export type Vec3 = [number, number, number];
export type Rgb = [number, number, number];

export interface DayFrame {
  key: Rgb;
  keyIntensity: number;
  zenith: Rgb;
  horizon: Rgb;
  air: Rgb;
  fill: Rgb;
  bounce: Rgb;
  exposure: number;
  sunDir: Vec3;
  keyIsMoon: boolean;
}

function hexToLinear(hex: string): Rgb {
  const c = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [c(0), c(1), c(2)];
}

function rgbToOklab(c: Rgb): Rgb {
  const [r, g, b] = c;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function oklabToRgb(lab: Rgb): Rgb {
  const [L, a, b] = lab;
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3,
  ];
}

function mixOklab(c1: Rgb, c2: Rgb, t: number): Rgb {
  if (t <= 0) return [c1[0], c1[1], c1[2]];
  if (t >= 1) return [c2[0], c2[1], c2[2]];
  const lab1 = rgbToOklab(c1);
  const lab2 = rgbToOklab(c2);
  const lab: Rgb = [
    lab1[0] * (1 - t) + lab2[0] * t,
    lab1[1] * (1 - t) + lab2[1] * t,
    lab1[2] * (1 - t) + lab2[2] * t,
  ];
  return oklabToRgb(lab);
}

const tilt = (57 * Math.PI) / 180;
const yaw = (12 * Math.PI) / 180;
const roll = (-1 * Math.PI) / 180;
const cy = 0.12;
const p0 = 0.50;

const u0: Vec3 = [Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)];
const v0: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
const w0: Vec3 = [
  u0[1] * v0[2] - u0[2] * v0[1],
  u0[2] * v0[0] - u0[0] * v0[2],
  u0[0] * v0[1] - u0[1] * v0[0],
];
const v: Vec3 = [
  v0[0] * Math.cos(roll) + w0[0] * Math.sin(roll),
  v0[1] * Math.cos(roll) + w0[1] * Math.sin(roll),
  v0[2] * Math.cos(roll) + w0[2] * Math.sin(roll),
];

// Horizon crossings of the sun circle: sy(th) = (A cos th + B sin th + cy) / h, zero where A cos th + B sin th = -cy.
const SUNSET_FADE = 0.02; // phase span after the sunset crossing over which the sun's key fades to zero before the moon takes over
const horizonCrossings = (() => {
  const A = u0[1];
  const B = v[1];
  const phi = Math.atan2(B, A);
  const d = Math.acos(-cy / Math.hypot(A, B));
  const wrap = (th: number) => (((p0 + th / (2 * Math.PI)) % 1) + 1) % 1;
  const a = wrap(phi + d);
  const b = wrap(phi - d);
  const rising = (p: number) => -A * Math.sin(2 * Math.PI * (p - p0)) + B * Math.cos(2 * Math.PI * (p - p0)) > 0;
  return rising(a) ? { rise: a, set: b } : { rise: b, set: a };
})();
const P_RISE = horizonCrossings.rise;
const P_SET = horizonCrossings.set;
const P_HAND = P_SET + SUNSET_FADE;

export function dayFrameAt(phase: number): DayFrame {
  let p = phase % 1;
  if (p < 0) p += 1;

  const th = 2 * Math.PI * (p - p0);
  const vx = u0[0] * Math.cos(th) + v[0] * Math.sin(th);
  const vy = u0[1] * Math.cos(th) + v[1] * Math.sin(th) + cy;
  const vz = u0[2] * Math.cos(th) + v[2] * Math.sin(th);
  const h = Math.hypot(vx, vy, vz);
  const sx = vx / h;
  const sy = vy / h;
  const sz = vz / h;

  const keyIsMoon = p >= P_HAND || p < P_RISE;
  let sunDir: Vec3;
  if (keyIsMoon) sunDir = [-sx, -sy, -sz];
  else if (sy > 0) sunDir = [sx, sy, sz];
  else {
    // sunset fade: the key stays on the horizon while it fades out
    const hh = Math.hypot(sx, sz);
    sunDir = [sx / hh, 0, sz / hh];
  }

  let idx = 0;
  while (idx < DAY_KEYS.length - 1 && p >= DAY_KEYS[idx + 1].phase) {
    idx++;
  }

  const k1 = DAY_KEYS[idx];
  const k2 = DAY_KEYS[(idx + 1) % DAY_KEYS.length];
  const p1 = k1.phase;
  const p2 = idx < DAY_KEYS.length - 1 ? k2.phase : 1.0;
  const t = (p - p1) / (p2 - p1);

  const exposure = (1 - t) * k1.exposure + t * k2.exposure;

  let keyIntensity: number;
  if (p < 0.25) {
    // moon fades to zero at sunrise, then the sun rises to the 0.25 key
    keyIntensity = p < P_RISE ? DAY_KEYS[0].keyIntensity * (1 - p / P_RISE) : DAY_KEYS[1].keyIntensity * ((p - P_RISE) / (0.25 - P_RISE));
  } else {
    keyIntensity = (1 - t) * k1.keyIntensity + t * k2.keyIntensity;
    if (p >= P_SET && p < P_HAND) keyIntensity *= 1 - (p - P_SET) / SUNSET_FADE;
    else if (p >= P_HAND) keyIntensity *= Math.min(1, (p - P_HAND) / SUNSET_FADE);
  }

  return {
    key: mixOklab(hexToLinear(k1.key), hexToLinear(k2.key), t),
    keyIntensity,
    zenith: mixOklab(hexToLinear(k1.zenith), hexToLinear(k2.zenith), t),
    horizon: mixOklab(hexToLinear(k1.horizon), hexToLinear(k2.horizon), t),
    air: mixOklab(hexToLinear(k1.air), hexToLinear(k2.air), t),
    fill: mixOklab(hexToLinear(k1.fill), hexToLinear(k2.fill), t),
    bounce: mixOklab(hexToLinear(k1.bounce), hexToLinear(k2.bounce), t),
    exposure,
    sunDir,
    keyIsMoon,
  };
}

export function presetToPhase(n: number): number {
  return PRESET_PHASE[n];
}

export function phaseToPreset(phase: number): number {
  let p = phase % 1;
  if (p < 0) p += 1;
  if (p >= 0.40 && p < 0.60) return 1;
  if (p >= 0.60 && p < 0.85) return 0;
  if (p >= 0.15 && p < 0.40) return 0;
  return 2;
}

export function stepPhase(phase: number, dtSec: number, clock: typeof DAY_CLOCK): number {
  if (dtSec === 0) return phase;
  const isNight = phase < clock.sunDownBelow || phase >= clock.sunDownFrom;
  const speed = isNight ? clock.nightSpeed : 1;
  const perSec = (1 / (clock.dayMinutes * 60)) * speed;
  let next = phase + dtSec * perSec;
  next = next % 1;
  if (next < 0) next += 1;
  return next;
}

function toSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function litGroundValue(frame: DayFrame, albedoValue: number): number {
  const dotNL = Math.max(0, frame.sunDir[1]);
  let band = 0.0;
  if (dotNL > 0.55) band = 1.0;
  else if (dotNL > 0.15) band = 0.62;
  else if (dotNL > 0.0) band = 0.22;

  const r = (frame.keyIntensity * band * frame.key[0] + frame.fill[0]) * albedoValue * frame.exposure;
  const g = (frame.keyIntensity * band * frame.key[1] + frame.fill[1]) * albedoValue * frame.exposure;
  const b = (frame.keyIntensity * band * frame.key[2] + frame.fill[2]) * albedoValue * frame.exposure;

  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return toSrgb(lum);
}
