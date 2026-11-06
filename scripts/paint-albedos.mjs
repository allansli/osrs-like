/**
 * Author seamless 256×256 gouache albedo tiles (OSRS × BotW, not pixel art, not PBR).
 * Values stay high-key so a material color token tints the texture instead of being replaced.
 * Run: node scripts/paint-albedos.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const SIZE = 256;
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures');

function hash(ix, iy, seed) {
  let n = Math.imul(ix + seed * 13, 374761393) + Math.imul(iy + seed * 7, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function noise(x, y, seed, px, py) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const wrap = (i, p) => ((i % p) + p) % p;
  const v00 = hash(wrap(x0, px), wrap(y0, py), seed);
  const v10 = hash(wrap(x0 + 1, px), wrap(y0, py), seed);
  const v01 = hash(wrap(x0, px), wrap(y0 + 1, py), seed);
  const v11 = hash(wrap(x0 + 1, px), wrap(y0 + 1, py), seed);
  return v00 + (v10 - v00) * tx + (v01 - v00) * ty * (1 - tx) + (v11 - v10) * tx * ty;
}

function fbm(u, v, seed, fx, fy) {
  let amp = 0.55;
  let sum = 0;
  let norm = 0;
  let x = u * fx;
  let y = v * fy;
  let px = fx;
  let py = fy;
  for (let o = 0; o < 5; o++) {
    sum += amp * noise(x, y, seed + o * 17, px, py);
    norm += amp;
    amp *= 0.5;
    x *= 2;
    y *= 2;
    px *= 2;
    py *= 2;
  }
  return sum / norm;
}

function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k
  ];
}

function lift(rgb) {
  // Park brush values in a high sRGB band so materialColor * texture stays near the token.
  const luma = (rgb[0] + rgb[1] + rgb[2]) / 3;
  const t = Math.max(0, Math.min(1, (luma - 110) / 120));
  const outL = 180 + t * 60;
  const scale = outL / Math.max(luma, 1);
  return rgb.map((c) => Math.max(0, Math.min(244, Math.round(c * scale))));
}

function knot(u, v, cu, cv, sx, sy) {
  let dx = Math.abs(u - cu);
  let dy = Math.abs(v - cv);
  dx = Math.min(dx, 1 - dx);
  dy = Math.min(dy, 1 - dy);
  return Math.exp(-(dx * dx * sx + dy * dy * sy));
}

const recipes = {
  grass(u, v) {
    const blot = fbm(u, v, 3, 5, 5);
    const tuft = fbm(u, v, 11, 8, 4);
    const sun = Math.pow(fbm(u, v, 19, 3, 3), 2);
    let col = mix([228, 236, 168], [118, 160, 64], blot);
    col = mix(col, [236, 240, 190], tuft * 0.75);
    col = mix(col, [96, 128, 52], sun * 0.8);
    return col;
  },
  dirt(u, v) {
    const clod = fbm(u, v, 5, 5, 5);
    const crumb = fbm(u, v, 14, 8, 8);
    const pebble = Math.pow(fbm(u, v, 23, 6, 6), 5);
    let col = mix([236, 206, 156], [90, 58, 32], clod);
    col = mix(col, [236, 214, 176], crumb * 0.55);
    col = mix(col, [160, 132, 102], pebble);
    return col;
  },
  sand(u, v) {
    const wind = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 6 + fbm(u, v, 2, 3, 2) * 2.4);
    const speck = Math.pow(fbm(u, v, 16, 8, 8), 4);
    let col = mix([238, 220, 170], [198, 168, 118], wind);
    col = mix(col, [168, 142, 104], speck * 0.7);
    return col;
  },
  stone(u, v) {
    const block = fbm(u, v, 4, 4, 4);
    const pit = Math.pow(fbm(u, v, 18, 6, 6), 3);
    const crack = Math.abs(fbm(u, v, 7, 3, 3) * 2 - 1);
    let col = mix([220, 218, 208], [132, 136, 128], block);
    col = mix(col, [108, 112, 106], Math.pow(1 - crack, 3) * 0.7);
    col = mix(col, [96, 100, 96], pit * 0.45);
    return col;
  },
  wood(u, v) {
    const grain = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 8 + fbm(u, v, 3, 2, 4) * 3.1);
    const curl = fbm(u, v, 9, 3, 2);
    const eye = Math.max(knot(u, v, 0.32, 0.62, 90, 160), knot(u, v, 0.74, 0.28, 70, 120) * 0.85);
    let col = mix([228, 186, 132], [176, 128, 86], grain);
    col = mix(col, [236, 206, 160], curl * 0.35);
    col = mix(col, [150, 102, 70], eye);
    return col;
  },
  bark(u, v) {
    const ridge = Math.pow(Math.abs(Math.sin(u * Math.PI * 2 * 6 + fbm(u, v, 8, 2, 5) * 1.5)), 0.4);
    const flake = fbm(u, v, 15, 4, 7);
    let col = mix([220, 176, 132], [120, 78, 52], 1 - ridge);
    col = mix(col, [230, 196, 156], flake * 0.4);
    return col;
  },
  slate(u, v) {
    const courses = 5;
    const row = v * courses;
    const rowIndex = Math.floor(row);
    const rowFrac = row - rowIndex;
    const shift = (rowIndex % 2) * 0.5;
    const x = (u + shift) % 1;
    const tile = (Math.sin(x * Math.PI * 2 * 3) + 1) * 0.5;
    const mortarV = Math.pow(Math.min(rowFrac, 1 - rowFrac) * 2, 0.35);
    const mortarH = Math.pow(Math.abs(Math.sin(x * Math.PI * 2 * 3)), 0.28);
    let col = mix([168, 178, 190], [214, 220, 226], tile);
    col = mix(col, [150, 158, 166], (1 - mortarV) * 0.75 + (1 - mortarH) * 0.45);
    return col;
  },
  leather(u, v) {
    const pore = fbm(u, v, 6, 8, 8);
    const crease = Math.pow(Math.abs(Math.sin(v * Math.PI * 2 * 3 + fbm(u, v, 12, 3, 2) * 2.2)), 0.45);
    let col = mix([220, 170, 126], [112, 68, 44], pore);
    col = mix(col, [230, 196, 158], crease * 0.55);
    return col;
  },
  cloth(u, v) {
    const warp = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 12);
    const weft = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 12);
    const nap = fbm(u, v, 4, 3, 3);
    const weave = warp * 0.62 + weft * 0.38;
    let col = mix([186, 176, 156], [236, 230, 214], weave);
    col = mix(col, [168, 156, 136], nap * 0.45);
    return col;
  },
  iron(u, v) {
    const dent = fbm(u, v, 2, 4, 4);
    const hammer = fbm(u, v, 17, 7, 7);
    let col = mix([78, 96, 124], [236, 240, 246], dent);
    col = mix(col, [150, 168, 188], hammer * 0.85);
    return col;
  }
};

function paint(recipe) {
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const rgb = lift(recipe(x / SIZE, y / SIZE));
      const i = (y * SIZE + x) * 4;
      rgba[i] = rgb[0];
      rgba[i + 1] = rgb[1];
      rgba[i + 2] = rgb[2];
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 0);
  return Buffer.concat([length, name, data, crc]);
}

function png(rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(root, { recursive: true });
for (const [id, recipe] of Object.entries(recipes)) {
  const rgba = paint(recipe);
  writeFileSync(join(root, `${id}.png`), png(rgba));
  let min = 255;
  let sum = 0;
  let sumSq = 0;
  const count = SIZE * SIZE;
  for (let i = 0; i < count; i++) {
    const luma = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3;
    min = Math.min(min, luma);
    sum += luma;
    sumSq += luma * luma;
  }
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  console.log(`${id}.png  min ${min.toFixed(1)}  mean ${mean.toFixed(1)}  var ${variance.toFixed(1)}`);
}
