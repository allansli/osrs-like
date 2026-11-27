// G-6.3a H-3a captures: the demons' cave (Slagfall Terrace, CAVES.slagfall_cave) in the game on the GPU. Run by
// scripts/capture-gpu.mjs. Each scene gets a fresh browser context (clean storage), seeded Math.random and the game's
// own loop; nothing in src/ is patched. The hero goes in through the overworld door, found by the game's own hover label
// and clicked with the game's own mousedown handler, so the `enterDungeon` command runs as in play. Inside, the hero is
// moved with `__DEBUG.look.pose`. The live scene and the renderer are reached through three.js's devtools hook (as
// G-6.1 and G-6.3): the job reads each cave monster from its rig group's `userData.entity`, counts the cave's props, and
// reads the draw calls from the game's own perf HUD (`#perf-calls`, the renderer's count of one frame). It wraps `renderer.render` in the page only to remember the perspective
// camera it was last given, so it can say where the camera stood. The job throws on any page or console error, when the
// renderer is not the NVIDIA GPU, or when the door does not let the hero in.
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
const HOOK = `window.__scenes=[];window.__renderers=[];window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',(e)=>{const d=e.detail;if(!d)return;if(d.isScene)window.__scenes.push(d);if(d.isWebGLRenderer){window.__renderers.push(d);const o=d.render.bind(d);d.render=(s,c)=>{if(c&&c.isPerspectiveCamera)window.__cam=c;return o(s,c);};}});`;
// src/data/dungeons.ts CAVES[0]: origin (1000, 600), door (-84, 98), entry (12, 34); world = origin + local.
const ORIGIN = [1000, 600];
const W = (x, z) => [ORIGIN[0] + x, ORIGIN[1] + z];
const DOOR = [-84, 98];
const ROOMS = { entry: [4, 26, 20, 42], c1: [20, 31, 26, 37], front: [26, 20, 50, 48], c2: [50, 31, 56, 37], back: [56, 18, 84, 50] };
const facts = { renderer: null, scenes: {} };
const ONLY = process.env.ONLY; // e.g. ONLY=EF runs scenes E and F only

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(SEED + HOOK);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL, { timeout: 60_000 });
  await settle(page);
  if (facts.renderer === null) {
    facts.renderer = await rendererOf(page);
    if (!/NVIDIA/.test(facts.renderer)) throw new Error(`not the NVIDIA GPU: ${facts.renderer}`);
  }
  return { ctx, page, errors };
}

async function settle(page) {
  await page.evaluate(() => { const b = document.getElementById('onboarding'); if (b && !b.hidden) b.hidden = true; });
  await page.waitForFunction(() => window.__DEBUG && window.__DEBUG.look && window.__DEBUG.look.ready(), null, { timeout: 60_000 });
  await page.evaluate(() => window.__DEBUG.look.tier('balanced'));
}

// Every combat skill at `lvl` (hitpoints at `hp`), as G-6.3's hero. The cave needs nothing (`needs: { all: [] }`).
async function readyHero(page, lvl, hp) {
  await page.evaluate(([lvl, hp]) => {
    const xpFor = (l) => { let p = 0; for (let i = 1; i < l; i++) p += Math.floor(i + 300 * Math.pow(2, i / 7)); return Math.floor(p / 4); };
    const S = window.__DEBUG.STATE;
    for (const k of ['attack', 'strength', 'defence', 'ranged', 'magic', 'prayer']) { S.skills[k].lvl = lvl; S.skills[k].xp = xpFor(lvl); }
    S.skills.hitpoints.lvl = hp; S.skills.hitpoints.xp = xpFor(hp);
    S.hp = hp; S.maxHp = hp;
  }, [lvl, hp]);
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
  return {
    hp: +D.STATE.hp.toFixed(2), maxHp: D.STATE.maxHp, pos: [+D.player.pos.x.toFixed(2), +D.player.pos.z.toFixed(2)],
    target: t ? { type: t.type, name: t.ref?.def?.name ?? t.ref?.name ?? null, state: t.ref?.logic?.state ?? null } : null,
    deathOverlay: !document.getElementById('death-overlay').hidden,
    perfHud: [document.getElementById('perf-fps').textContent, document.getElementById('perf-calls').textContent],
    chatTail: chat.slice(-4)
  };
});

// The six cave monsters, read from their rig groups (they stay in the scene, hidden, while the hero is outside).
const caveMobs = (page) => page.evaluate(() => {
  const seen = new Set(), out = [];
  for (const sc of window.__scenes) sc.traverse((o) => {
    const e = o.userData && o.userData.type === 'monster' ? o.userData.entity : null;
    if (!e || o !== e.rig.group || seen.has(e) || !String(e.logic.campId).startsWith('slagfall_cave:')) return;
    seen.add(e);
    const L = e.logic;
    out.push({
      type: e.typeKey, camp: L.campId, state: L.state, hp: +L.hp.toFixed(1), at: [+L.x.toFixed(2), +L.z.toFixed(2)],
      home: [L.homeX, L.homeZ], timer: +L.timer.toFixed(2), windup: L.windup ? L.windup.attackId : null, visible: o.visible
    });
  });
  return out;
});

// The cave's props (spires on the pillars, fissures along the walls) and the overworld door's figure count.
const caveProps = (page) => page.evaluate(() => {
  const n = { World_obsidian_spire: 0, World_lava_fissure: 0, meshes: 0, visibleMeshesInCaveArea: 0 };
  for (const sc of window.__scenes) sc.traverse((o) => {
    if (o.isMesh && o.visible) {
      const p = o.getWorldPosition(o.position.clone());
      if (p.x > 900 && p.z > 550) n.visibleMeshesInCaveArea++;
    }
    if (!(o.name in n)) return;
    const p = o.getWorldPosition(o.position.clone());
    if (p.x > 900 && p.z > 550) { n[o.name]++; o.traverse((c) => { if (c.isMesh) n.meshes++; }); }
  });
  return n;
});

// Where the camera stands, in cave-local coordinates, and the room rectangle it is in (null: outside every room).
const camera = (page) => page.evaluate(([ox, oz, rooms]) => {
  const c = window.__cam.position;
  const lx = +(c.x - ox).toFixed(2), lz = +(c.z - oz).toFixed(2);
  const room = Object.entries(rooms).find(([, [x0, z0, x1, z1]]) => lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1);
  const C = window.__DEBUG.camState;
  return { local: [lx, lz], height: +c.y.toFixed(2), room: room ? room[0] : null, camState: { yaw: +C.yaw.toFixed(3), pitch: +C.pitch.toFixed(3), distance: +C.distance.toFixed(2) } };
}, [ORIGIN[0], ORIGIN[1], ROOMS]);

// One scan of the canvas for a hover label, then a click there through the game's own handler.
async function clickLabel(page, text) {
  const at = await page.evaluate((text) => {
    const canvas = document.getElementById('game-canvas'), tip = document.getElementById('hover-tooltip');
    const ev = (type, x, y) => canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }));
    const seen = new Set();
    for (let y = 80; y <= 660; y += 12) for (let x = 160; x <= 1120; x += 12) {
      ev('mousemove', x, y);
      if (tip.style.display === 'block') seen.add(tip.textContent);
      if (tip.style.display === 'block' && tip.textContent.includes(text)) { ev('mousedown', x, y); ev('mouseup', x, y); return { at: [x, y], label: tip.textContent }; }
    }
    return { missing: [...seen] };
  }, text);
  if (at.missing) await shot(page, 'FAILED-label.jpg');
  if (at.missing) throw new Error(`no hover label "${text}" (hero at ${JSON.stringify(await page.evaluate(() => [window.__DEBUG.player.pos.x, window.__DEBUG.player.pos.z]))}; labels seen: ${JSON.stringify(at.missing)})`);
  await parkMouse(page);
  return at;
}

// The overworld door: the hero 3.5 south of it, the camera behind it looking north (yaw 3.14 looks toward -z).
async function useDoor(page) {
  await pose(page, DOOR[0], DOOR[1] + 3.5, 3.14, 0.5, 10);
  await page.waitForTimeout(1500);
  const at = await clickLabel(page, 'Slagfall Terrace');
  await page.waitForFunction(() => window.__DEBUG.player.pos.x > 400, null, { timeout: 20_000 });
  return at;
}

async function enterScene(browser, lvl = 70, hp = 70) {
  const o = await open(browser);
  await readyHero(o.page, lvl, hp);
  await parkMouse(o.page);
  await o.page.waitForTimeout(3500); // the aggression grace after load (AGGRO_GRACE_MS 3000)
  return o;
}

const until = async (page, fn, arg, ms) => {
  const t0 = Date.now();
  for (;;) {
    const v = await page.evaluate(fn, arg);
    if (v) return Date.now() - t0;
    if (Date.now() - t0 > ms) return null;
    await page.waitForTimeout(100);
  }
};

export default async function job(_page, browser) {
  try { await scenes(browser); } finally { writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 1) + '\n'); }
}

async function done(key, s, ctx, errors) {
  delete facts.scenes[`scene${facts.n}`];
  facts.scenes[key] = s;
  await ctx.close();
  if (errors.length) throw new Error(`${key}: ${errors.join(' | ')}`);
}

async function scenes(browser) {
  // A: the door on the overworld, the entry room once it has been used, the room from high up, the minimap, the props
  // and `look.bench(120)` (the scene rendered 120 times straight, no post pass) on the overworld and in the cave.
  if (!ONLY || ONLY.includes('A')) {
    const { ctx, page, errors } = await enterScene(browser);
    const s = { pageErrors: errors, shots: [] };
    facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; // kept if a later step throws
    await pose(page, DOOR[0], DOOR[1] + 3.5, 3.14, 0.5, 10);
    await page.waitForTimeout(1500);
    await shot(page, 'a1-door-overworld.jpg');
    s.shots.push({ file: 'a1-door-overworld.jpg', camera: [3.14, 0.5, 10], ...(await read(page)) });
    s.benchMsOverworld = +(await page.evaluate(() => window.__DEBUG.look.bench(120))).toFixed(2);
    s.door = await useDoor(page);
    await page.waitForTimeout(2500);
    await shot(page, 'a2-entry-room.jpg');
    s.shots.push({ file: 'a2-entry-room.jpg', note: 'camera as the game left it after the door', camera: await camera(page), ...(await read(page)) });
    s.mobsOnEntry = await caveMobs(page);
    s.props = await caveProps(page);
    s.benchMsCave = +(await page.evaluate(() => window.__DEBUG.look.bench(120))).toFixed(2);
    await pose(page, ...W(12, 34), 1.2, 1.15, 26);
    await page.waitForTimeout(1500);
    await shot(page, 'a3-entry-room-high.jpg');
    s.shots.push({ file: 'a3-entry-room-high.jpg', heroAt: W(12, 34), asked: [1.2, 1.15, 26], camera: await camera(page), ...(await read(page)) });
    await page.locator('#minimap-wrapper').screenshot({ path: `${OUT}/a4-minimap-entry.jpg`, type: 'jpeg', quality: 90 });
    s.shots.push({ file: 'a4-minimap-entry.jpg' });
    await done('a_entry', s, ctx, errors);
  }

  // B: the camera at a wall corner of the entry room (local 6, 28: 2 from the west wall and the north wall, -z), at four
  // yaws with the pitch low and the arm long, then at the highest pitch and the longest arm.
  if (!ONLY || ONLY.includes('B')) {
    const { ctx, page, errors } = await enterScene(browser);
    const s = { pageErrors: errors, shots: [] };
    facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; // kept if a later step throws
    s.door = await useDoor(page);
    await page.waitForTimeout(1500);
    const rows = [['b1-corner-yaw0.jpg', 0, 0.3, 14], ['b2-corner-yaw90.jpg', 1.57, 0.3, 14], ['b3-corner-yaw180.jpg', 3.14, 0.3, 14],
      ['b4-corner-yaw270.jpg', 4.71, 0.3, 14], ['b5-corner-high.jpg', 3.93, 1.15, 26]];
    for (const [file, yaw, pitch, dist] of rows) {
      await pose(page, ...W(6, 28), yaw, pitch, dist);
      await page.waitForTimeout(1200);
      await shot(page, file);
      s.shots.push({ file, heroAt: W(6, 28), asked: [yaw, pitch, dist], camera: await camera(page) });
    }
    await done('b_camera', s, ctx, errors);
  }

  // C: the front hall. From corridor c1 (local 25, 34), 11.7 from the nearest Lesser Demon, then one step in (29, 34):
  // 8.1 from both demons (sight 9), 15 from the Hurler (sight 12). Hitpoints 99 so the hero stands the fight.
  if (!ONLY || ONLY.includes('C')) {
    const { ctx, page, errors } = await enterScene(browser, 70, 99);
    const s = { pageErrors: errors, shots: [] };
    facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; // kept if a later step throws
    s.door = await useDoor(page);
    await page.waitForTimeout(1500);
    await pose(page, ...W(25, 34), 1.57, 0.6, 14);
    await page.waitForTimeout(3000);
    await shot(page, 'c1-front-hall-from-corridor.jpg');
    s.shots.push({ file: 'c1-front-hall-from-corridor.jpg', heroAt: W(25, 34), afterMs: 3000, camera: await camera(page), ...(await read(page)), mobs: await caveMobs(page) });
    await pose(page, ...W(29, 34), 1.57, 0.55, 11);
    await page.waitForTimeout(1500);
    s.after1500 = { ...(await read(page)), mobs: await caveMobs(page) };
    await page.waitForTimeout(2000);
    await shot(page, 'c2-front-hall-fight.jpg');
    s.shots.push({ file: 'c2-front-hall-fight.jpg', heroAt: W(29, 34), afterMs: 3500, camera: await camera(page), ...(await read(page)), mobs: await caveMobs(page) });
    s.benchMsFight = +(await page.evaluate(() => window.__DEBUG.look.bench(120))).toFixed(2);
    await done('c_front', s, ctx, errors);
  }

  // D: the back hall. The hero at local (68, 34), 2 from the Lesser Demon, 6.3 from the Hurlers. The job waits for a
  // Hurler to wind up Pinning Volley, shoots it, and leaves at once through the engine's leave path (`__DEBUG.leaveZone`,
  // the function the door's `leaveDungeon` command calls; a click on the exit door would need the hero to walk 56 units
  // first, longer than the 1.6 s wind-up). On the overworld it reads the cave's monsters, then stands the hero on a
  // scorpion's home in dune_nest_west (aggressive; sight 3 at this level) until a scorpion hits, and reads the target.
  if (!ONLY || ONLY.includes('D')) {
    const { ctx, page, errors } = await enterScene(browser, 70, 99);
    const s = { pageErrors: errors, shots: [] };
    facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; // kept if a later step throws
    s.door = await useDoor(page);
    await page.waitForTimeout(1500);
    await pose(page, ...W(68, 34), 1.57, 0.6, 12);
    s.windupWaitMs = await until(page, () => {
      for (const sc of window.__scenes) {
        let hit = false;
        sc.traverse((o) => { const e = o.userData?.type === 'monster' ? o.userData.entity : null; if (e && o === e.rig.group && e.typeKey === 'ember_hurler' && e.logic.windup) hit = true; });
        if (hit) return true;
      }
      return false;
    }, null, 30_000);
    await page.waitForTimeout(300);
    await shot(page, 'd1-hurler-windup.jpg');
    s.shots.push({ file: 'd1-hurler-windup.jpg', heroAt: W(68, 34), camera: await camera(page), ...(await read(page)), mobs: await caveMobs(page) });
    await page.evaluate(() => window.__DEBUG.leaveZone());
    await page.waitForTimeout(1500);
    await shot(page, 'd2-left-during-windup.jpg');
    s.shots.push({ file: 'd2-left-during-windup.jpg', note: 'camera as the game left it after leaving', ...(await read(page)), mobs: await caveMobs(page) });
    await pose(page, 44.5, 42.5, 0.6, 0.7, 12);
    const hp0 = await page.evaluate(() => window.__DEBUG.STATE.hp);
    s.scorpionHitWaitMs = await until(page, (hp0) => window.__DEBUG.STATE.hp < hp0, hp0, 15_000);
    await page.waitForTimeout(2500);
    await shot(page, 'd3-overworld-hit-fights-back.jpg');
    s.shots.push({ file: 'd3-overworld-hit-fights-back.jpg', heroAt: [44.5, 42.5], afterHitMs: 2500, ...(await read(page)) });
    await done('d_windup_leave', s, ctx, errors);
  }

  // E: the dead stay dead while the hero is outside. The job sets the hp of one front-hall Lesser Demon (home 36, 30) to 1
  // through the scene hook, turns on Protect from Melee by clicking its card in the prayer panel (in a trial run with
  // three weakened demons the hero died first), and clicks that demon by its hover label, so the hero attacks it as in
  // play; the death, the drops and the timer are the game's. The moment it is down the hero leaves through the engine's
  // leave path (`__DEBUG.leaveZone`, as in D: the other demons are on the hero, and a walk to the exit door would let the
  // fight go on). The hero waits 20 s outside, more than the 13.5 s wait, comes back in by the overworld door, and stands
  // in the entry room until the demon is back.
  if (!ONLY || ONLY.includes('E')) {
    const { ctx, page, errors } = await enterScene(browser, 70, 99);
    const s = { pageErrors: errors, shots: [] };
    facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; // kept if a later step throws
    s.door = await useDoor(page);
    await page.waitForTimeout(1500);
    const marked = (W0, Z0) => `e.logic.homeX === ${W0} && e.logic.homeZ === ${Z0}`;
    const isIt = marked(...W(36, 30));
    const findIt = `(() => { let r = null; for (const sc of window.__scenes) sc.traverse((o) => { const e = o.userData?.type === 'monster' ? o.userData.entity : null; if (e && o === e.rig.group && ${isIt}) r = e; }); return r; })()`;
    await page.evaluate((findIt) => {
      const e = eval(findIt);
      e.logic.hp = 1;
      window.__DEBUG.STATE.prayerPts = 70;
      const card = [...document.querySelectorAll('#prayer-grid .action-card')].find((c) => c.title === 'Blocks 80% of monster Melee damage');
      if (!card) throw new Error('no Protect from Melee card');
      card.click();
    }, findIt);
    s.prayersOn = await page.evaluate(() => [...window.__DEBUG.STATE.activePrayers]);
    await pose(page, ...W(31, 30), 1.57, 0.6, 10);
    await page.waitForTimeout(400);
    s.attackClick = await clickLabel(page, '[1/125 HP]');
    s.killWaitMs = await until(page, (findIt) => { const e = eval(findIt); return e.logic.state === 'dying' || e.logic.state === 'dead'; }, findIt, 30_000);
    await page.evaluate(() => window.__DEBUG.leaveZone());
    s.leftAt = { ...(await read(page)), mobs: await caveMobs(page) };
    await page.waitForTimeout(20_000);
    s.after20sOutside = { mobs: await caveMobs(page) };
    s.reentry = await useDoor(page);
    await page.waitForTimeout(300);
    s.onReentry = { mobs: await caveMobs(page) };
    await pose(page, ...W(16, 34), 1.57, 0.55, 12);
    await page.waitForTimeout(500);
    await shot(page, 'e1-reentry-still-dead.jpg');
    s.shots.push({ file: 'e1-reentry-still-dead.jpg', heroAt: W(16, 34), ...(await read(page)), mobs: await caveMobs(page) });
    s.backWaitMs = await until(page, (findIt) => { const e = eval(findIt); return e.logic.state !== 'dead' && e.logic.state !== 'dying'; }, findIt, 20_000);
    await page.waitForTimeout(1000);
    await shot(page, 'e2-back-after-their-time.jpg');
    s.shots.push({ file: 'e2-back-after-their-time.jpg', heroAt: W(16, 34), ...(await read(page)), mobs: await caveMobs(page) });
    await done('e_dead_stay_dead', s, ctx, errors);
  }

  // F: die inside. An unarmed combat-70 hero (70 hp) stands among the front hall's three members until the death
  // overlay shows, then until the respawn has run (it leaves the zone).
  if (!ONLY || ONLY.includes('F')) {
    const { ctx, page, errors } = await enterScene(browser);
    const s = { pageErrors: errors, shots: [] };
    facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; // kept if a later step throws
    s.door = await useDoor(page);
    await page.waitForTimeout(1500);
    await pose(page, ...W(38, 34), 1.57, 0.6, 12);
    s.deathWaitMs = await until(page, () => !document.getElementById('death-overlay').hidden, null, 90_000);
    await page.waitForTimeout(500);
    await shot(page, 'f1-died-inside.jpg');
    s.shots.push({ file: 'f1-died-inside.jpg', ...(await read(page)) });
    s.respawnWaitMs = await until(page, () => document.getElementById('death-overlay').hidden, null, 30_000);
    await page.waitForTimeout(2000);
    await shot(page, 'f2-after-respawn.jpg');
    s.shots.push({ file: 'f2-after-respawn.jpg', note: 'camera as the game left it after the respawn', ...(await read(page)), mobs: await caveMobs(page) });
    await done('f_death', s, ctx, errors);
  }

  // G: reload inside. The hero stands in the entry room for 3 s (the game saves every 2 s), the page reloads in the same
  // context (storage kept), and the job reads where the hero stands.
  if (!ONLY || ONLY.includes('G')) {
    const { ctx, page, errors } = await enterScene(browser);
    const s = { pageErrors: errors, shots: [] };
    facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; // kept if a later step throws
    s.door = await useDoor(page);
    await page.waitForTimeout(3000);
    s.beforeReload = { ...(await read(page)), saveButton: await page.evaluate(() => document.getElementById('save-status-btn').textContent) };
    await page.reload({ timeout: 60_000 });
    await settle(page);
    await parkMouse(page);
    await page.waitForTimeout(2500);
    await shot(page, 'g1-after-reload.jpg');
    s.shots.push({ file: 'g1-after-reload.jpg', note: 'camera as the save left it', ...(await read(page)), saveButton: await page.evaluate(() => document.getElementById('save-status-btn').textContent), mobs: await caveMobs(page) });
    await done('g_reload', s, ctx, errors);
  }

  // H: teleport out. In the entry room the hero gets one air and one law rune and casts Lumbridge Teleport by clicking
  // its card in the magic panel (the panel's own click handler).
  if (!ONLY || ONLY.includes('H')) {
    const { ctx, page, errors } = await enterScene(browser);
    const s = { pageErrors: errors, shots: [] };
    facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; // kept if a later step throws
    s.door = await useDoor(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const S = window.__DEBUG.STATE;
      S.inventory.push({ id: 'air_rune', qty: 1 }, { id: 'law_rune', qty: 1 });
      const card = [...document.querySelectorAll('#magic-grid .action-card')].find((c) => c.title === 'Teleport to Lumbridge Haven');
      if (!card) throw new Error('no Lumbridge Teleport card');
      card.click();
    });
    await page.waitForTimeout(2500);
    await shot(page, 'h1-teleported-out.jpg');
    s.shots.push({ file: 'h1-teleported-out.jpg', note: 'camera as the game left it after the teleport', ...(await read(page)), mobs: await caveMobs(page) });
    s.benchMsAfter = +(await page.evaluate(() => window.__DEBUG.look.bench(120))).toFixed(2);
    await done('h_teleport', s, ctx, errors);
  }

  // I: the exit door, clicked as in play from a quiet entry room (no fight): the hero stands at the entry, 4 south of the
  // door (local 12, 34; the door is at 12, 30), the camera behind it looking north, and the job clicks the door by its hover
  // label. It also counts the cave's props, the meshes under them and every visible mesh in the cave's area.
  if (!ONLY || ONLY.includes('I')) {
    const { ctx, page, errors } = await enterScene(browser);
    const s = { pageErrors: errors, shots: [] };
    facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; // kept if a later step throws
    s.door = await useDoor(page);
    await page.waitForTimeout(1500);
    s.props = await caveProps(page);
    await pose(page, ...W(12, 34), 3.14, 0.8, 10);
    await page.waitForTimeout(1000);
    await shot(page, 'i1-exit-door.jpg');
    s.shots.push({ file: 'i1-exit-door.jpg', heroAt: W(12, 34), camera: await camera(page), ...(await read(page)) });
    s.exitDoor = await clickLabel(page, 'Doorway (Leave)');
    s.exitWaitMs = await until(page, () => window.__DEBUG.player.pos.x < 400, null, 15_000);
    await page.waitForTimeout(1500);
    await shot(page, 'i2-out-by-the-door.jpg');
    s.shots.push({ file: 'i2-out-by-the-door.jpg', ...(await read(page)), mobs: await caveMobs(page) });
    await done('i_exit_door', s, ctx, errors);
  }
}
