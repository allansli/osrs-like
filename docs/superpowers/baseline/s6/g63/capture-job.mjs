// G-6.3 H-3 captures: Saltfang Warren in the game on the GPU. The door on the overworld, the entry room after the
// door is used, a room with its camp, and Matron Saltfang on her own body. Run by scripts/capture-gpu.mjs. Each scene
// gets a fresh browser context (clean storage), seeded Math.random and the game's own loop; nothing in src/ is patched.
// The hero goes in through the door: the door is found by the game's own hover label (one scan of synthetic mousemoves
// on the canvas) and clicked with the game's own mousedown handler, so the door's `enterDungeon` command and its needs
// check run as in play. Inside, the hero is moved with `__DEBUG.look.pose`. The live scene is reached through three.js's
// devtools hook (as G-6.1), so the job can read which skinned mesh and bones draw the Matron. The job throws on any page
// or console error, when the door does not let the hero in, or when the Matron is not drawn by the skinned `saltfang_` meshes of her own body (`Monster_saltfang` in monsters.glb).
import { writeFileSync } from 'node:fs';
// rendererOf is copied from scripts/capture-gpu.mjs: importing that module from its own job deadlocks (it awaits main() at top level).
const rendererOf = (page) => page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return 'no webgl2';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
});

const URL = process.env.CAP_URL;
const OUT = process.env.CAP_OUT;
const SEED = `let s=0x9e3779b9;Math.random=()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};`;
const HOOK = `window.__scenes=[];window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',(e)=>{if(e.detail&&e.detail.isScene)window.__scenes.push(e.detail);});`;
// src/data/dungeons.ts: origin (1000, -200), door (106, 74), entry (12, 32); world = origin + local.
const ORIGIN = [1000, -200];
const W = (x, z) => [ORIGIN[0] + x, ORIGIN[1] + z];
const facts = { renderer: null, scenes: {} };

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(SEED + HOOK);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL, { timeout: 60_000 });
  await page.evaluate(() => { const b = document.getElementById('onboarding'); if (b && !b.hidden) b.hidden = true; });
  await page.waitForFunction(() => window.__DEBUG && window.__DEBUG.look && window.__DEBUG.look.ready(), null, { timeout: 60_000 });
  facts.renderer ??= await rendererOf(page);
  await page.evaluate(() => window.__DEBUG.look.tier('balanced'));
  return { ctx, page, errors };
}

// A hero who may use the door (design 7.6, `DUNGEONS.saltfang_warren.needs`): combat 50 or more, and chapter 3 at its
// stage 3 (Qadir has shown the door). Every combat skill 70 (combat 89), chapters 1 and 2 claimed, `ml_salt` at 3.
async function readyHero(page) {
  await page.evaluate(() => {
    const xpFor = (l) => { let p = 0; for (let i = 1; i < l; i++) p += Math.floor(i + 300 * Math.pow(2, i / 7)); return Math.floor(p / 4); };
    const S = window.__DEBUG.STATE;
    for (const k of ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer']) { S.skills[k].lvl = 70; S.skills[k].xp = xpFor(70); }
    S.hp = 70; S.maxHp = 70;
    S.quests.claimed = [...S.quests.claimed, 'ml_wards', 'ml_east'];
    S.progress = { ...(S.progress ?? {}), story: { ml_salt: 3 } };
  });
}

async function parkMouse(page) {
  const b = await page.locator('#top-left-hud').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
}

async function pose(page, x, z, yaw, pitch, distance) {
  await page.evaluate(([x, z, yaw, pitch, distance]) => window.__DEBUG.look.pose({ x, z, yaw, pitch, distance }), [x, z, yaw, pitch, distance]);
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}`, type: 'jpeg', quality: 82 });

const read = (page) => page.evaluate(() => {
  const D = window.__DEBUG, t = D.player.targetEntity;
  const chat = [...document.querySelectorAll('#chat-messages > *')].map((e) => e.textContent.trim()).filter(Boolean);
  const boss = document.getElementById('boss-bar');
  return {
    hp: +D.STATE.hp.toFixed(2), maxHp: D.STATE.maxHp, pos: [+D.player.pos.x.toFixed(2), +D.player.pos.z.toFixed(2)],
    target: t ? { type: t.type, name: t.ref?.def?.name ?? null, state: t.ref?.logic?.state ?? null } : null,
    bossBar: boss.hidden ? null : boss.innerText.split('\n').map((l) => l.trim()).filter(Boolean),
    chatTail: chat.slice(-4)
  };
});

// One scan of the canvas for the door's hover label, then a click there through the game's own handler; the hero walks
// to the door and the door's command runs. Waits until the hero stands in the zone (x above 400).
async function useDoor(page) {
  const at = await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas'), tip = document.getElementById('hover-tooltip');
    const ev = (type, x, y) => canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }));
    for (let y = 80; y <= 660; y += 12) for (let x = 160; x <= 1120; x += 12) {
      ev('mousemove', x, y);
      if (tip.style.display === 'block' && tip.textContent.includes('Saltfang Warren')) { ev('mousedown', x, y); ev('mouseup', x, y); return { at: [x, y], label: tip.textContent }; }
    }
    return null;
  });
  if (!at) throw new Error('no hover label for the Saltfang Warren door');
  await parkMouse(page);
  await page.waitForFunction(() => window.__DEBUG.player.pos.x > 400, null, { timeout: 20_000 });
  return at;
}

// The Matron's figure in the live scenes. The loader moves the children of its clone of `Monster_<body>` into the
// monster's rig group (src/engine/blenderMonsters.ts), so the job reads every skinned mesh whose figure stands in the
// lair (local 48..76 x 50..78; the Matron is its only monster), with its name, bones and triangles.
const matronBody = (page) => page.evaluate(() => {
  const out = [];
  for (const sc of window.__scenes) sc.traverse((o) => {
    if (!o.isSkinnedMesh || o.name === '') return; // the unnamed copies are addCartoonOutline's shells
    let root = o; while (root.parent && !root.parent.isScene) root = root.parent;
    const p = root.position;
    if (p.x < 1048 || p.x > 1076 || p.z < -150 || p.z > -122) return;
    out.push({
      mesh: o.name, bones: o.skeleton.bones.length, firstBones: o.skeleton.bones.slice(0, 4).map((b) => b.name),
      triangles: (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3,
      figureAt: [+p.x.toFixed(1), +p.z.toFixed(1)], figureScale: +root.scale.x.toFixed(2)
    });
  });
  return out;
});

async function enterScene(browser) {
  const o = await open(browser);
  await readyHero(o.page);
  await parkMouse(o.page);
  await o.page.waitForTimeout(3500); // the aggression grace after load (AGGRO_GRACE_MS 3000)
  // 3 south of the door (106, 74), camera behind the hero looking north (yaw 3.14 looks toward -z).
  await pose(o.page, 106, 77.5, 3.14, 0.5, 10);
  await o.page.waitForTimeout(1500);
  return o;
}

export default async function job(_page, browser) {
  try { await scenes(browser); } finally { writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 1) + '\n'); }
}

async function scenes(browser) {
  // A: the door on the overworld, then the entry room once the door has been used.
  {
    const { ctx, page, errors } = await enterScene(browser);
    const s = { pageErrors: errors, shots: [] };
    await shot(page, 'a1-door-overworld.jpg');
    s.shots.push({ file: 'a1-door-overworld.jpg', camera: [3.14, 0.5, 10], ...(await read(page)) });
    s.door = await useDoor(page);
    await page.waitForTimeout(2500);
    await shot(page, 'a2-entry-room.jpg');
    s.shots.push({ file: 'a2-entry-room.jpg', note: 'camera as the game left it after the door', ...(await read(page)) });
    await pose(page, ...W(12, 32), 1.2, 0.95, 22);
    await page.waitForTimeout(1500);
    await shot(page, 'a3-entry-room-high.jpg');
    s.shots.push({ file: 'a3-entry-room-high.jpg', heroAt: W(12, 32), camera: [1.2, 0.95, 22], ...(await read(page)) });
    await page.locator('#minimap-wrapper').screenshot({ path: `${OUT}/a4-minimap-entry.jpg`, type: 'jpeg', quality: 90 });
    s.shots.push({ file: 'a4-minimap-entry.jpg' });
    facts.scenes.a_entry = s;
    await ctx.close();
    if (errors.length) throw new Error(`a_entry: ${errors.join(' | ')}`);
  }

  // B: a room. The nest (local 26..46 x 20..44) holds eight Scree Skitters; the camp is aggressive and keeps its sight
  // (aggro 9 at any level). The hero stands in corridor c1 at its east end (local 25, 32), 6 or more from every skitter,
  // the camera behind it looking east (yaw 1.57 looks toward +x).
  {
    const { ctx, page, errors } = await enterScene(browser);
    const s = { pageErrors: errors, shots: [] };
    s.door = await useDoor(page);
    await page.waitForTimeout(1500);
    await pose(page, ...W(23, 32), 1.57, 0.75, 16);
    await page.waitForTimeout(1200);
    await shot(page, 'b1-nest-from-corridor.jpg');
    s.shots.push({ file: 'b1-nest-from-corridor.jpg', heroAt: W(23, 32), camera: [1.57, 0.75, 16], ...(await read(page)) });
    await pose(page, ...W(30, 32), 1.57, 0.55, 9);
    await page.waitForTimeout(3000);
    await shot(page, 'b2-nest-fight.jpg');
    s.shots.push({ file: 'b2-nest-fight.jpg', heroAt: W(30, 32), camera: [1.57, 0.55, 9], afterMs: 3000, ...(await read(page)) });
    facts.scenes.b_nest = s;
    await ctx.close();
    if (errors.length) throw new Error(`b_nest: ${errors.join(' | ')}`);
  }

  // C: Matron Saltfang in the lair (local 48..76 x 50..78; she stands at 62, 64, aggro 12, keepsSight, arena 10). The
  // gate is shut, so the hero is put inside the lair with the pose hook: first 13 north of her (outside her sight),
  // camera looking south (yaw 0 looks toward +z); then 6 north of her; then 4 north of her.
  {
    const { ctx, page, errors } = await enterScene(browser);
    const s = { pageErrors: errors, shots: [] };
    s.door = await useDoor(page);
    await page.waitForTimeout(1500);
    await pose(page, ...W(62, 51), 0, 0.5, 12);
    const t0 = Date.now();
    while ((await matronBody(page)).length === 0 && Date.now() - t0 < 30_000) await page.waitForTimeout(250);
    s.body = await matronBody(page);
    s.bodyWaitMs = Date.now() - t0;
    await page.waitForTimeout(1500);
    await shot(page, 'c1-matron-idle.jpg');
    s.shots.push({ file: 'c1-matron-idle.jpg', heroAt: W(62, 51), camera: [0, 0.5, 12], ...(await read(page)) });
    // 6 from her: inside her aggro 12, but outside her camp's circle. zoneCamps (src/state/dungeon.ts) gives a camp the
    // radius ceil(spread of its members + 4.5), which is 5 for a camp of one, and stepMonster acquires only a hero inside
    // that circle. This shot records what she does there.
    await pose(page, ...W(62, 58), 0.5, 0.55, 11);
    await page.waitForTimeout(3000);
    await shot(page, 'c2-matron-6-away-3s.jpg');
    s.shots.push({ file: 'c2-matron-6-away-3s.jpg', heroAt: W(62, 58), camera: [0.5, 0.55, 11], afterMs: 3000, ...(await read(page)) });
    // 4 from her, inside the circle: the fight, shot 3 s and 6 s later.
    await pose(page, ...W(62, 60), 0.5, 0.55, 11);
    await page.waitForTimeout(3000);
    await shot(page, 'c3-matron-fight-3s.jpg');
    s.shots.push({ file: 'c3-matron-fight-3s.jpg', heroAt: W(62, 60), camera: [0.5, 0.55, 11], afterMs: 3000, ...(await read(page)) });
    await page.waitForTimeout(3000);
    await shot(page, 'c4-matron-fight-6s.jpg');
    s.shots.push({ file: 'c4-matron-fight-6s.jpg', note: 'no new pose: the fight goes on', afterMs: 3000, ...(await read(page)) });
    s.bench = await page.evaluate(() => window.__DEBUG.look.bench(120));
    facts.scenes.c_matron = s;
    await ctx.close();
    if (errors.length) throw new Error(`c_matron: ${errors.join(' | ')}`);
    if (s.body.length === 0 || !s.body.every((b) => b.mesh.startsWith('saltfang_'))) throw new Error('c_matron: the Matron is not drawn by the skinned meshes of her own body');
  }
}
