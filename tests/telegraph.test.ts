import { describe, expect, it } from 'vitest';
import type { Shape } from '../src/data/attacks';
import { ATTACKS, REACTION_WINDOW } from '../src/data/attacks';
import { readFileSync } from 'node:fs';
import { escapeDistance, inShape, minWindupMs, shapeOutline } from '../src/state/telegraph';

// Shape geometry (design 6.2, 6.3; plan T1). Red until T2 adds src/state/telegraph.ts and src/data/attacks.ts.
//
// Contract the tests pin for T2:
//   inShape(shape, originX, originZ, dirX, dirZ, x, z): (dirX, dirZ) is a unit vector; the anchor of a circle is the
//     caller's business (it picks the origin), so both anchors give the same answer for the same origin.
//     cone: apex at the origin, within `length` along the direction and `halfAngleDeg` of it.
//     line: from the origin along the direction for `length`, `halfWidth` to each side.
//     ring: from `inner` to `outer` of the origin (the direction does not matter).
//   shapeOutline(shape, segments): the polygon in the shape's own frame: origin (0, 0), forward (0, 1), points [x, z]
//     (the frame of inShape(shape, 0, 0, 0, 1, x, z)). It returns closed loops (the first point is the last), one loop
//     for circle, cone and line, two for a ring (outer and inner); a point is inside the shape when an even-odd
//     test over all loops says so. `segments` is the number of segments of a full circle.

const ANGLES = [0, 37, 90, 200];
const ORIGINS: Array<[number, number]> = [[0, 0], [13.5, -7.25]];
const EPS = 0.02;

/** A point `along` the direction and `across` to its left, from an origin. */
function at(ox: number, oz: number, deg: number, along: number, across: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a), dz = Math.cos(a);
  return [ox + dx * along - dz * across, oz + dz * along + dx * across];
}
function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

type Probe = { shape: Shape; inside: Array<[number, number]>; outside: Array<[number, number]> };
const PROBES: Record<string, Probe> = {
  'circle at the target': {
    shape: { type: 'circle', anchor: 'target', radius: 2.5 },
    inside: [[0, 0], polar(2.5 - EPS, 10), polar(1, 200)],
    outside: [polar(2.5 + EPS, 10), polar(2.5 + EPS, 280), [0, 5]]
  },
  'circle around the monster': {
    shape: { type: 'circle', anchor: 'self', radius: 4.5 },
    inside: [[0, 0], polar(4.5 - EPS, 100), polar(2, 300)],
    outside: [polar(4.5 + EPS, 100), polar(4.5 + EPS, 0)]
  },
  cone: {
    shape: { type: 'cone', length: 4.5, halfAngleDeg: 40 },
    inside: [[4.5 - EPS, 0], [2, 0], polar(2.5, 40 - 0.5)],
    outside: [[4.5 + EPS, 0], polar(2.5, 40 + 0.5), [-0.5, 0], [0, 3]]
  },
  line: {
    shape: { type: 'line', length: 12, halfWidth: 1.2 },
    inside: [[EPS, 0], [12 - EPS, 0], [6, 1.2 - EPS], [6, -(1.2 - EPS)]],
    outside: [[12 + EPS, 0], [6, 1.2 + EPS], [6, -(1.2 + EPS)], [-EPS, 0]]
  },
  ring: {
    shape: { type: 'ring', inner: 8, outer: 20 },
    inside: [[8 + EPS, 0], [20 - EPS, 0], [0, 14]],
    outside: [[8 - EPS, 0], [20 + EPS, 0], [0, 0], [3, 3]]
  }
};
// Every probe is (along, across): polar(r, deg) is the point r from the origin, deg off the axis.

describe('inShape', () => {
  for (const [name, probe] of Object.entries(PROBES)) {
    it(`${name}: inside, outside and the edge, at every direction and origin`, () => {
      for (const [ox, oz] of ORIGINS) {
        for (const deg of ANGLES) {
          const a = (deg * Math.PI) / 180;
          const dx = Math.sin(a), dz = Math.cos(a);
          for (const [along, across] of probe.inside) {
            const [x, z] = at(ox, oz, deg, along, across);
            expect(inShape(probe.shape, ox, oz, dx, dz, x, z), `${name} inside (${along}, ${across}) at ${deg}`).toBe(true);
          }
          for (const [along, across] of probe.outside) {
            const [x, z] = at(ox, oz, deg, along, across);
            expect(inShape(probe.shape, ox, oz, dx, dz, x, z), `${name} outside (${along}, ${across}) at ${deg}`).toBe(false);
          }
        }
      }
    });
  }

  it('the anchor of a circle does not change the answer for the same origin', () => {
    const target: Shape = { type: 'circle', anchor: 'target', radius: 3 };
    const self: Shape = { type: 'circle', anchor: 'self', radius: 3 };
    for (const [x, z] of [[0, 0], [2.9, 0], [3.1, 0], [-2, 2.2]]) {
      expect(inShape(target, 4, 5, 0, 1, 4 + x, 5 + z)).toBe(inShape(self, 4, 5, 0, 1, 4 + x, 5 + z));
    }
  });

  it('a rotated line follows the direction and a rotated cone points along it', () => {
    const line: Shape = { type: 'line', length: 12, halfWidth: 1.2 };
    expect(inShape(line, 0, 0, 1, 0, 6, 0)).toBe(true);
    expect(inShape(line, 0, 0, 1, 0, 0, 6)).toBe(false);
    expect(inShape(line, 0, 0, 0, 1, 0, 6)).toBe(true);
    const cone: Shape = { type: 'cone', length: 4.5, halfAngleDeg: 40 };
    expect(inShape(cone, 0, 0, 1, 0, 3, 0)).toBe(true);
    expect(inShape(cone, 0, 0, 1, 0, 0, 3)).toBe(false);
    expect(inShape(cone, 0, 0, -1, 0, -3, 0.5)).toBe(true);
  });
});

/** Even-odd containment over all loops. */
function insidePolygon(loops: Array<Array<[number, number]>>, x: number, z: number): boolean {
  let inside = false;
  for (const loop of loops) {
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const [xi, zi] = loop[i], [xj, zj] = loop[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
  }
  return inside;
}

describe('shapeOutline', () => {
  for (const [name, probe] of Object.entries(PROBES)) {
    it(`${name}: closed loops that contain the points inShape accepts, on a 0.25 grid`, () => {
      const loops = shapeOutline(probe.shape, 96) as Array<Array<[number, number]>>;
      expect(loops.length).toBe(probe.shape.type === 'ring' ? 2 : 1);
      for (const loop of loops) {
        expect(loop.length).toBeGreaterThanOrEqual(4);
        expect(loop[0]).toEqual(loop[loop.length - 1]);
        for (const [x, z] of loop) {
          expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true);
        }
      }
      let checked = 0, inCount = 0;
      for (let gx = -22; gx <= 22; gx += 0.25) {
        for (let gz = -22; gz <= 22; gz += 0.25) {
          const f = (x: number, z: number) => inShape(probe.shape, 0, 0, 0, 1, x, z);
          const d = 0.05;
          const here = f(gx, gz);
          // A point within 0.05 of the boundary may fall either side of a polygon edge: skip it.
          if (f(gx + d, gz) !== here || f(gx - d, gz) !== here || f(gx, gz + d) !== here || f(gx, gz - d) !== here) continue;
          checked++;
          if (here) inCount++;
          expect(insidePolygon(loops, gx, gz), `${name} at (${gx}, ${gz})`).toBe(here);
        }
      }
      expect(checked).toBeGreaterThan(1000);
      expect(inCount).toBeGreaterThan(10);
    });
  }
});

// The "Escape" column of design 6.3, by attack name. The boss rows arrive in B2: a row that is not in ATTACKS yet is skipped,
// the six ordinary rows are required.
const ESCAPE: Array<[string, number, boolean]> = [
  ['Tail Lash', 2.05, true], ['Hexfall', 2.8, true], ['Pinning Volley', 2.8, true], ['Overhead Slam', 3.3, true],
  ['Rootquake', 4.8, true], ['Scorch Lane', 1.5, true],
  ['Ember Cone', 6.91, false], ['Tail Sweep', 5.3, false], ['Slag Rain', 2.8, false], ['Ashen Nova', 5.8, false], ['Slagburst', 8.3, false]
];

describe('escapeDistance and minWindupMs', () => {
  for (const [name, expected, required] of ESCAPE) {
    it(`${name}: escape distance is ${expected} within 0.05`, () => {
      const row = Object.values(ATTACKS).find((a) => a.name === name);
      if (!row) {
        expect(required, `${name} must exist`).toBe(false);
        return;
      }
      expect(Math.abs(escapeDistance(row) - expected)).toBeLessThanOrEqual(0.05);
    });
  }

  it('a circle around the monster counts its full radius', () => {
    const row = { ...Object.values(ATTACKS)[0], shape: { type: 'circle', anchor: 'self', radius: 4.5 } as Shape, reach: 2.9 };
    expect(Math.abs(escapeDistance(row) - 4.8)).toBeLessThanOrEqual(0.05);
  });

  it('minWindupMs is 700 + 160 + 90 + escape / 11.5 s', () => {
    const row = Object.values(ATTACKS).find((a) => a.name === 'Rootquake');
    expect(row).toBeDefined();
    expect(Math.abs(minWindupMs(row!) - (950 + (escapeDistance(row!) / 11.5) * 1000))).toBeLessThan(0.5);
    expect(Math.abs(minWindupMs(row!) - 1367)).toBeLessThanOrEqual(2);
  });

  it('the reaction-window numbers of design 6.3 live in src/data/attacks.ts, not as literals in telegraph.ts', () => {
    expect(REACTION_WINDOW).toEqual({ humanMs: 700, deviceMs: 160, accelerationMs: 90, heroRunSpeed: 11.5, heroBodyRadius: 0.3 });
    const src = readFileSync('src/state/telegraph.ts', 'utf8');
    expect(src).not.toMatch(/\b(?:700|160|90|11\.5)\b|=\s*0\.3\b/);
  });
});
