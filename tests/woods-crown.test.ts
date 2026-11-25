import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildKitPiece, makeRng } from '../src/engine/floraKit';

/*
 * Design 5.6: a woods tree's crown stays darker than every harvestable tree's. The darkest is the yew, whose
 * crown albedo is 0x223628 (spawns.ts, blenderWorld.ts) times the grass texture. The measure is linear relative
 * luminance of the albedo (plan GR8 amendment, ground/fixes.md section 3), not sRGB HSL lightness.
 */

const YEW_CROWN = 0x223628;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Mean linear RGB of an 8-bit RGBA, non-interlaced PNG (the format of public/textures/grass.png).
function pngLinearMean(path: string): [number, number, number] {
  const buf = readFileSync(path);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  expect([buf[24], buf[25], buf[28]], 'bit depth, colour type, interlace').toEqual([8, 6, 0]);
  const idat: Buffer[] = [];
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    if (buf.toString('latin1', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let p: number;
      if (filter === 0) p = 0;
      else if (filter === 1) p = a;
      else if (filter === 2) p = b;
      else if (filter === 3) p = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else throw new Error(`PNG filter ${filter} on row ${y}`);
      px[y * stride + x] = (v + p) & 0xff;
    }
  }
  const sum = [0, 0, 0];
  for (let i = 0; i < px.length; i += bpp) for (let k = 0; k < 3; k++) sum[k] += srgbToLinear(px[i + k] / 255);
  const n = width * height;
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

describe('woods-tree crowns (design 5.6)', () => {
  const grass = pngLinearMean(new URL('../public/textures/grass.png', import.meta.url).pathname);
  const yew = new THREE.Color(YEW_CROWN); // linear, as three stores it
  const yewLum = luminance(yew.r * grass[0], yew.g * grass[1], yew.b * grass[2]);

  it('the yew crown albedo luminance is the one fixes.md measures', () => {
    expect(yewLum).toBeGreaterThan(0.025);
    expect(yewLum).toBeLessThan(0.028);
  });

  // The trunk is a 6-sided cylinder built first; every vertex after it belongs to the two crown cones.
  const trunkVertices = new THREE.CylinderGeometry(1, 1, 1, 6).index!.count;

  for (const [id, seed] of [['woods_tree_a', 1], ['woods_tree_b', 2]] as const) {
    it(`${id}: every crown vertex colour is darker than the yew crown`, () => {
      const geo = buildKitPiece(id, makeRng(seed));
      const col = geo.attributes.color;
      expect(col.count).toBeGreaterThan(trunkVertices);
      let max = 0;
      for (let i = trunkVertices; i < col.count; i++) {
        const lum = luminance(col.getX(i), col.getY(i), col.getZ(i));
        expect(col.getY(i), `vertex ${i} is crown green`).toBeGreaterThan(col.getX(i));
        max = Math.max(max, lum);
      }
      expect(max).toBeGreaterThan(0);
      expect(max).toBeLessThan(yewLum);
    });
  }
});
