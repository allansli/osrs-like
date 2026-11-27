// SF3 captures: the cave's look (Slagfall Terrace, CAVES.slagfall_cave) on the GPU. Run by scripts/capture-gpu.mjs,
// with CAP_URL and CAP_OUT set, as G-6.3a's job. Nothing in src/ is patched. The hero enters through the overworld door,
// found by its hover label and clicked through the game's own handler. The live scene is reached through three.js's
// devtools hook, and the job wraps `renderer.render` only to remember the main camera (the 1280x720 perspective camera).
//
// What it reads (D runs before C, while every cave member is still at home):
//  - A: the "Slagfall Terrace" place labels shown over the cave mouth.
//  - B: the banner and the footer inside the cave.
//  - C: every lava fissure's footprint, against the cave row's rooms and pillars, and a picture from above.
//  - D: the Ember Hurler against the Lesser Demons and what is behind each (silhouette from a flat-magenta frame), at the
//    front hall's mouth and at fight range, as the game draws it and in two ways set in the page only (hurlerAs).
//  - E: the banner and the footer after leaving.
// The job throws on a page or console error, or when the renderer is not the NVIDIA GPU.
import { writeFileSync } from 'node:fs';
const rendererOf = (page) => page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
});
const URL = process.env.CAP_URL;
const OUT = process.env.CAP_OUT;
const SEED = `let s=0x9e3779b9;Math.random=()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};`;
const HOOK = `window.__scenes=[];window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',(e)=>{const d=e.detail;if(!d)return;if(d.isScene)window.__scenes.push(d);if(d.isWebGLRenderer){const o=d.render.bind(d);d.render=(s,c)=>{if(c&&c.isPerspectiveCamera&&Math.abs(c.aspect-1280/720)<0.01&&s.isScene)window.__cam=c;return o(s,c);};}});`;
// src/data/dungeons.ts CAVES[0]
const ORIGIN = [1000, 600];
const W = (x, z) => [ORIGIN[0] + x, ORIGIN[1] + z];
const DOOR = [-84, 98];
const ROOMS = { entry: [4, 26, 20, 42], c1: [20, 31, 26, 37], front: [26, 20, 50, 48], c2: [50, 31, 56, 37], back: [56, 18, 84, 50] };
const SOLID = [[31, 27, 33, 29], [31, 39, 33, 41], [61, 24, 63, 26], [61, 42, 63, 44], [69, 30, 71, 32]];
const facts = { renderer: null };

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}`, type: 'jpeg', quality: 82 });
async function parkMouse(page) {
  const b = await page.locator('#top-left-hud').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
}
const pose = (page, x, z, yaw, pitch, distance) => page.evaluate((a) => window.__DEBUG.look.pose(a), { x, z, yaw, pitch, distance });
const names = (page) => page.evaluate(() => ({
  bannerShown: document.getElementById('region-banner').classList.contains('visible'),
  bannerTitle: document.getElementById('region-title-text').textContent,
  bannerSub: document.getElementById('region-sub-text').textContent,
  footer: document.getElementById('current-zone-footer').textContent,
  savedRegion: window.__DEBUG.STATE.currentRegion,
  hero: [+window.__DEBUG.player.pos.x.toFixed(2), +window.__DEBUG.player.pos.z.toFixed(2)]
}));
const placeLabels = (page, text) => page.evaluate((text) => [...document.querySelectorAll('#world-labels .entity-label')]
  .filter((e) => e.textContent.trim() === text).map((e) => ({ shown: e.style.display !== 'none', at: [e.style.left, e.style.top] })), text);

async function clickLabel(page, text) {
  const at = await page.evaluate((text) => {
    const canvas = document.getElementById('game-canvas'), tip = document.getElementById('hover-tooltip');
    const ev = (type, x, y) => canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }));
    for (let y = 80; y <= 660; y += 12) for (let x = 160; x <= 1120; x += 12) {
      ev('mousemove', x, y);
      if (tip.style.display === 'block' && tip.textContent.includes(text)) { ev('mousedown', x, y); ev('mouseup', x, y); return { at: [x, y], label: tip.textContent }; }
    }
    return null;
  }, text);
  if (!at) throw new Error(`no hover label "${text}"`);
  await parkMouse(page);
  return at;
}

// Every fissure in the cave's area: its world box (Box3.setFromObject; the walls are axis-aligned and every fissure is
// turned by a multiple of 90 degrees, so the box is its footprint), its corners and 9 points along each box edge, in
// cave-local coordinates.
const fissures = (page) => page.evaluate(([ox, oz]) => {
  const out = [];
  for (const sc of window.__scenes) sc.traverse((o) => {
    if (o.name !== 'World_lava_fissure') return;
    const p = o.getWorldPosition(o.position.clone());
    if (p.x < 900 || p.z < 550) return;
    const mesh = o.getObjectByProperty('isMesh', true);
    mesh.geometry.computeBoundingBox();
    const b = new mesh.geometry.boundingBox.constructor().setFromObject(o); // three's Box3, reached through a mesh
    const x0 = b.min.x - ox, x1 = b.max.x - ox, z0 = b.min.z - oz, z1 = b.max.z - oz;
    const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], pts = [];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 9; k++) { const t = k / 9, [ax, az] = c[i], [bx, bz] = c[(i + 1) % 4]; pts.push([+(ax + (bx - ax) * t).toFixed(3), +(az + (bz - az) * t).toFixed(3)]); }
    out.push({ at: [+(p.x - ox).toFixed(2), +(p.z - oz).toFixed(2)], rotY: +o.rotation.y.toFixed(3), scale: +o.scale.x.toFixed(2), box: [x0, z0, x1, z1].map((v) => +v.toFixed(3)), pts });
  });
  return out;
}, [ORIGIN[0], ORIGIN[1]]);

// The cave's monsters, each with its rig group.
const MOBS = `(() => { const out = [], seen = new Set(); for (const sc of window.__scenes) sc.traverse((o) => { const e = o.userData?.type === 'monster' ? o.userData.entity : null; if (!e || o !== e.rig.group || seen.has(e) || !o.visible || !String(e.logic.campId).startsWith('slagfall_cave:')) return; seen.add(e); out.push([e, o]); }); return out; })()`;
const png = async (page) => (await page.screenshot({ type: 'png' })).toString('base64');
// One figure: its silhouette is the frame with every drawn mesh of it in flat magenta (no fog, no light); its colour
// is the normal frame over that silhouette; "behind" is the frame without it over the same pixels.
async function figure(page, idx) {
  const info = await page.evaluate(([MOBS, idx]) => {
    const [e, o] = eval(MOBS)[idx];
    const cam = window.__cam.position;
    return { type: e.typeKey, state: e.logic.state, at: [+e.logic.x.toFixed(1), +e.logic.z.toFixed(1)], cameraDistance: +Math.hypot(e.logic.x - cam.x, e.logic.z - cam.z).toFixed(1) };
  }, [MOBS, idx]);
  const normal = await png(page);
  await page.evaluate(([MOBS, idx]) => {
    const [, o] = eval(MOBS)[idx];
    o.traverse((m) => {
      if (!m.isMesh || !m.visible || m.material.visible === false) return;
      m.userData.__mat = m.material;
      const flat = m.material.clone();
      for (const k of ['map', 'emissiveMap', 'normalMap', 'aoMap', 'lightMap']) if (k in flat) flat[k] = null;
      flat.vertexColors = false; flat.fog = false;
      if (flat.color) flat.color.setRGB(1, 0, 1);
      if (flat.emissive) flat.emissive.setRGB(1, 0, 1);
      flat.emissiveIntensity = 50; flat.toneMapped = false; flat.onBeforeCompile = () => {}; flat.customProgramCacheKey = () => 'sf3-flat';
      flat.needsUpdate = true;
      m.material = flat;
    });
  }, [MOBS, idx]);
  await page.waitForTimeout(120);
  const flat = await png(page);
  await page.evaluate(([MOBS, idx]) => {
    const [, o] = eval(MOBS)[idx];
    o.traverse((m) => { if (m.userData.__mat) { m.material.dispose(); m.material = m.userData.__mat; delete m.userData.__mat; } if (m.isMesh && m.visible) { m.visible = false; m.userData.__hid = true; } });
  }, [MOBS, idx]);
  await page.waitForTimeout(120);
  const without = await png(page);
  await page.evaluate(([MOBS, idx]) => { const [, o] = eval(MOBS)[idx]; o.traverse((m) => { if (m.userData.__hid) { m.visible = true; delete m.userData.__hid; } }); }, [MOBS, idx]);
  const stats = await page.evaluate(async ([n0, f0, w0]) => {
    const load = async (s) => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, 1280, 720).data; };
    const N = await load(n0), F = await load(f0), B = await load(w0);
    const hud = (x, y) => (x > 990 && y > 270) || (x < 310 && y < 520) || (y > 540 && x < 460) || (x > 1030 && y < 250);
    let n = 0; const f = [0, 0, 0], k = [0, 0, 0];
    for (let y = 0; y < 720; y++) for (let x = 0; x < 1280; x++) {
      if (hud(x, y)) continue;
      const i = (y * 1280 + x) * 4;
      if (!(F[i] > 200 && F[i + 1] < 60 && F[i + 2] > 200)) continue; // magenta: the figure
      n++; for (let c = 0; c < 3; c++) { f[c] += N[i + c]; k[c] += B[i + c]; }
    }
    if (!n) return { pixels: 0 };
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const hue = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; const h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); return Math.round((h * 60 + 360) % 360); };
    const sat = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? +((mx - mn) / mx).toFixed(2) : 0; };
    const fig = f.map((v) => Math.round(v / n)), behind = k.map((v) => Math.round(v / n));
    const L1 = lum(fig), L2 = lum(behind);
    return { pixels: n, figureRgb: fig, figureHue: hue(fig), figureSat: sat(fig), figureLum: +L1.toFixed(4), behindRgb: behind, behindLum: +L2.toFixed(4), contrastToBehind: +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(3) };
  }, [normal, flat, without]);
  return { ...info, ...stats };
}
async function figures(page) {
  const n = await page.evaluate((MOBS) => eval(MOBS).length, MOBS);
  const out = [];
  for (let i = 0; i < n; i++) { const f = await figure(page, i); if (f.pixels > 0) out.push(f); }
  return out;
}
// How the models draw: material colour, vertex colours on, colour attribute present (body, horn, membrane).
const materials = (page) => page.evaluate((MOBS) => {
  const out = {};
  for (const [e, o] of eval(MOBS)) {
    if (out[e.typeKey]) continue;
    out[e.typeKey] = [];
    o.traverse((m) => { if (m.isMesh && /body|horn|membrane/.test(m.name)) out[e.typeKey].push({ mesh: m.name, colour: m.material.color.getHexString(), vertexColors: m.material.vertexColors, colourAttribute: Boolean(m.geometry.getAttribute('color')) }); });
  }
  return out;
}, MOBS);
// Only in the page: the Hurler's body, horns and wing membranes drawn another way. 'charcoal' multiplies 0x3a3530 into
// the vertex colours as the tint does today; 'tintAsColour' is the amendment's proposal (0xb8b2a7 as the colour, vertex
// colours off). Nothing in src/ does either.
const hurlerAs = (page, mode) => page.evaluate(([MOBS, mode]) => {
  for (const [e, o] of eval(MOBS)) if (e.typeKey === 'ember_hurler') o.traverse((m) => {
    if (!m.isMesh || !/body|horn|membrane/.test(m.name)) return;
    m.userData.__orig ??= { c: m.material.color.getHex(), vc: m.material.vertexColors };
    const O = m.userData.__orig;
    if (mode === 'current') { m.material.color.setHex(O.c); m.material.vertexColors = O.vc; }
    if (mode === 'charcoal') { m.material.color.setHex(0x3a3530); m.material.vertexColors = O.vc; }
    if (mode === 'tintAsColour') { m.material.color.setHex(0xb8b2a7); m.material.vertexColors = false; }
    m.material.needsUpdate = true;
  });
}, [MOBS, mode]);

export default async function job(_page, browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(SEED + HOOK);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  try {
    await page.goto(URL, { timeout: 60_000 });
    await page.evaluate(() => { const b = document.getElementById('onboarding'); if (b && !b.hidden) b.hidden = true; });
    await page.waitForFunction(() => window.__DEBUG?.look?.ready(), null, { timeout: 60_000 });
    await page.evaluate(() => window.__DEBUG.look.tier('balanced'));
    facts.renderer = await rendererOf(page);
    if (!/NVIDIA/.test(facts.renderer)) throw new Error(`not the NVIDIA GPU: ${facts.renderer}`);
    // Hitpoints 990 so no fight in the cave ends the run; the cave needs nothing.
    await page.evaluate(() => { const S = window.__DEBUG.STATE; S.skills.hitpoints.lvl = 990; S.hp = 990; S.maxHp = 990; });
    await parkMouse(page);
    await page.waitForTimeout(3500);

    // A: the cave mouth, 3.5 south of the door, and from 10 south.
    await pose(page, DOOR[0], DOOR[1] + 3.5, 3.14, 0.5, 10);
    await page.waitForTimeout(1500);
    await shot(page, 'a1-cave-mouth.jpg');
    facts.a1 = { hero: 'door + (0, 3.5)', labels: await placeLabels(page, 'Slagfall Terrace'), ...(await names(page)) };
    await pose(page, DOOR[0], DOOR[1] + 10, 3.14, 0.45, 14);
    await page.waitForTimeout(1500);
    await shot(page, 'a2-cave-mouth-far.jpg');
    facts.a2 = { hero: 'door + (0, 10)', labels: await placeLabels(page, 'Slagfall Terrace'), ...(await names(page)) };

    // B: through the door; the banner and the footer inside.
    await pose(page, DOOR[0], DOOR[1] + 3.5, 3.14, 0.5, 10);
    await page.waitForTimeout(1500);
    facts.door = await clickLabel(page, 'Slagfall Terrace');
    await page.waitForFunction(() => window.__DEBUG.player.pos.x > 400, null, { timeout: 20_000 });
    await page.waitForTimeout(600);
    await shot(page, 'b1-inside-banner.jpg');
    facts.b1 = await names(page);

    // D: the Hurler against the demons. D1 at the front hall's mouth, every member idle at home; D2 at fight range, the
    // hero 4 into the hall and the members on him. Each in three ways of drawing the Hurler (hurlerAs).
    await page.waitForTimeout(2500);
    await pose(page, ...W(26.5, 34), 1.57, 0.45, 9);
    await page.waitForTimeout(2500);
    facts.materials = await materials(page);
    facts.d1 = {};
    for (const mode of ['current', 'charcoal', 'tintAsColour']) {
      await hurlerAs(page, mode);
      await page.waitForTimeout(300);
      await shot(page, `d1-mouth-${mode}.jpg`);
      facts.d1[mode] = await figures(page);
    }
    await hurlerAs(page, 'current');
    await pose(page, ...W(30, 34), 1.57, 0.5, 10);
    await page.waitForTimeout(5000);
    facts.d2 = {};
    for (const mode of ['current', 'charcoal', 'tintAsColour']) {
      await hurlerAs(page, mode);
      await page.waitForTimeout(300);
      await shot(page, `d2-fight-${mode}.jpg`);
      facts.d2[mode] = await figures(page);
    }
    await hurlerAs(page, 'current');

    // C: the fissures, read and from above.
    const fs = await fissures(page);
    const inRoom = ([x, z]) => Object.values(ROOMS).some(([a, b, c, d]) => x > a && x < c && z > b && z < d);
    const inSolid = ([x, z]) => SOLID.some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d);
    facts.c = {
      count: fs.length,
      everyPointInsideARoom: fs.every((f) => f.pts.every(inRoom)),
      noPointOnAPillar: fs.every((f) => f.pts.every((p) => !inSolid(p))),
      nearestToAWallLine: +Math.min(...fs.flatMap((f) => f.pts.map(([x, z]) => Math.min(...Object.values(ROOMS).filter(([a, b, c, d]) => x > a && x < c && z > b && z < d).map(([a, b, c, d]) => Math.min(x - a, c - x, z - b, d - z)))))).toFixed(3),
      fissures: fs.map(({ at, rotY, scale, box }) => ({ at, rotY, scale, box }))
    };
    await pose(page, ...W(12, 34), 1.2, 1.15, 26);
    await page.waitForTimeout(1500);
    await shot(page, 'c1-entry-from-above.jpg');
    await pose(page, ...W(38, 34), 1.57, 1.15, 26);
    await page.waitForTimeout(1500);
    await shot(page, 'c2-front-hall-from-above.jpg');
    await pose(page, ...W(70, 46), 1.57, 1.15, 26);
    await page.waitForTimeout(1500);
    await shot(page, 'c3-back-hall-from-above.jpg');

    // E: out by the engine's leave (the door's command calls it).
    await page.evaluate(() => window.__DEBUG.leaveZone());
    await page.waitForTimeout(600);
    await shot(page, 'e1-left-banner.jpg');
    facts.e1 = { ...(await names(page)), labels: await placeLabels(page, 'Slagfall Terrace') };
    facts.pageErrors = errors;
    if (errors.length) throw new Error(errors.join(' | '));
  } finally {
    writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 1) + '\n');
    await ctx.close();
  }
}
