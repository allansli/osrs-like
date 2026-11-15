import type { AttackDef, Shape } from '../data/attacks';
import { REACTION_WINDOW } from '../data/attacks';

const BODY = REACTION_WINDOW.heroBodyRadius;

export function escapeDistance(attack: AttackDef): number {
  const s = attack.shape;
  if (s.type === 'circle') return s.radius + BODY;
  if (s.type === 'line') return s.halfWidth + BODY;
  if (s.type === 'ring') return Math.max(0, Math.min(attack.reach, s.outer) - s.inner) + BODY;
  let worst = 0;
  const sin = Math.sin((s.halfAngleDeg * Math.PI) / 180);
  for (let d = 0.5; d <= Math.min(attack.reach, s.length); d += 0.05) {
    worst = Math.max(worst, Math.min(d * sin, s.length - d));
  }
  return worst + BODY;
}

export function minWindupMs(attack: AttackDef): number {
  const w = REACTION_WINDOW;
  return w.humanMs + w.deviceMs + w.accelerationMs + (escapeDistance(attack) / w.heroRunSpeed) * 1000;
}

export function inShape(
  shape: Shape,
  originX: number,
  originZ: number,
  dirX: number,
  dirZ: number,
  x: number,
  z: number
): boolean {
  const rx = x - originX;
  const rz = z - originZ;
  switch (shape.type) {
    case 'circle': {
      return Math.hypot(rx, rz) <= shape.radius;
    }
    case 'ring': {
      const dist = Math.hypot(rx, rz);
      return dist >= shape.inner && dist <= shape.outer;
    }
    case 'line': {
      const along = rx * dirX + rz * dirZ;
      if (along < 0 || along > shape.length) return false;
      const across = Math.abs(-rx * dirZ + rz * dirX);
      return across <= shape.halfWidth;
    }
    case 'cone': {
      const dist = Math.hypot(rx, rz);
      if (dist === 0) return true;
      if (dist > shape.length) return false;
      const along = rx * dirX + rz * dirZ;
      if (along <= 0) return false;
      const cosAngle = along / dist;
      const cosHalfAngle = Math.cos((shape.halfAngleDeg * Math.PI) / 180);
      return cosAngle >= cosHalfAngle - 1e-9;
    }
  }
}

export function shapeOutline(shape: Shape, segments: number): Array<Array<[number, number]>> {
  switch (shape.type) {
    case 'circle': {
      const loop: Array<[number, number]> = [];
      const r = shape.radius;
      for (let i = 0; i < segments; i++) {
        const theta = (i * 2 * Math.PI) / segments;
        loop.push([r * Math.sin(theta), r * Math.cos(theta)]);
      }
      loop.push([loop[0][0], loop[0][1]]);
      return [loop];
    }
    case 'ring': {
      const outerLoop: Array<[number, number]> = [];
      const innerLoop: Array<[number, number]> = [];
      for (let i = 0; i < segments; i++) {
        const theta = (i * 2 * Math.PI) / segments;
        outerLoop.push([shape.outer * Math.sin(theta), shape.outer * Math.cos(theta)]);
        innerLoop.push([shape.inner * Math.sin(theta), shape.inner * Math.cos(theta)]);
      }
      outerLoop.push([outerLoop[0][0], outerLoop[0][1]]);
      innerLoop.push([innerLoop[0][0], innerLoop[0][1]]);
      return [outerLoop, innerLoop];
    }
    case 'line': {
      const hw = shape.halfWidth;
      const len = shape.length;
      return [
        [
          [-hw, 0],
          [hw, 0],
          [hw, len],
          [-hw, len],
          [-hw, 0]
        ]
      ];
    }
    case 'cone': {
      const loop: Array<[number, number]> = [];
      const halfRad = (shape.halfAngleDeg * Math.PI) / 180;
      const r = shape.length;
      const arcSteps = Math.max(2, Math.ceil(segments * ((2 * shape.halfAngleDeg) / 360)));
      loop.push([0, 0]);
      for (let i = 0; i <= arcSteps; i++) {
        const a = -halfRad + (2 * halfRad * i) / arcSteps;
        loop.push([r * Math.sin(a), r * Math.cos(a)]);
      }
      loop.push([0, 0]);
      return [loop];
    }
  }
}

// The growing fill at progress p: a point of the full fill at distance r from the origin is drawn at r * fillScale.
// Circle, cone and line grow from the origin. A ring grows outward from its inner edge, so it never covers the safe centre.
export function fillScale(shape: Shape, r: number, p: number): number {
  if (shape.type !== 'ring' || r === 0) return p;
  return (shape.inner + (r - shape.inner) * p) / r;
}
