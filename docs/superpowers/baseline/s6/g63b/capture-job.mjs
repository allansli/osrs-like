// G-6.3b H-3b captures: line of sight (design 7.13, CALL-6.32) in the game on the GPU. Run by scripts/capture-gpu.mjs.
// Each scene gets a fresh browser context (clean storage), seeded Math.random and the game's own loop; nothing in src/ is
// patched. The hero goes into the cave through the overworld door (the game's hover label and mousedown handler, as
// G-6.3a). A recorder in the page reads, on every animation frame, the watched monsters' logic (position, state, attack
// cooldown, wind-up) and the hero's position and hitpoints, from the rig groups' `userData.entity` through three.js's
// devtools hook. The job writes those rows to `trace-<scene>.json`; `los-check.ts` rebuilds the game's own walk grids and
// says, for every row, whether `segmentWalkable` holds from the monster to the hero, and finds each shot (a wind-up that
// starts, or the attack cooldown jumping up in `attack`). The job throws on any page or console error, when the renderer
// is not the NVIDIA GPU, or when a door or a label is not found.
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
const ONLY = process.env.ONLY; // e.g. ONLY=AB runs scenes A and B only
const SEED = `let s=0x9e3779b9;Math.random=()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};`;
const HOOK = `window.__scenes=[];window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',(e)=>{const d=e.detail;if(d&&d.isScene)window.__scenes.push(d);});`;
// src/data/dungeons.ts CAVES[0]: origin (1000, 600), door (-84, 98); world = origin + local.
const W = (x, z) => [1000 + x, 600 + z];
const DOOR = [-84, 98];
const WATCH_MS = 25_000;
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
  await page.evaluate(() => window.__DEBUG.look.tier('balanced'));
  if (facts.renderer === null) {
    facts.renderer = await rendererOf(page);
    if (!/NVIDIA/.test(facts.renderer)) throw new Error(`not the NVIDIA GPU: ${facts.renderer}`);
  }
  // Every combat skill 70 (combat 89), hitpoints 99, as G-6.3a's fight scenes.
  await page.evaluate(() => {
    const xpFor = (l) => { let p = 0; for (let i = 1; i < l; i++) p += Math.floor(i + 300 * Math.pow(2, i / 7)); return Math.floor(p / 4); };
    const S = window.__DEBUG.STATE;
    for (const k of ['attack', 'strength', 'defence', 'ranged', 'magic', 'prayer']) { S.skills[k].lvl = 70; S.skills[k].xp = xpFor(70); }
    S.skills.hitpoints.lvl = 99; S.skills.hitpoints.xp = xpFor(99);
    S.hp = 99; S.maxHp = 99;
  });
  await parkMouse(page);
  await page.waitForTimeout(3500); // the aggression grace after load (AGGRO_GRACE_MS 3000)
  return { ctx, page, errors };
}

async function parkMouse(page) {
  const b = await page.locator('#top-left-hud').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
}

const pose = (page, x, z, yaw, pitch, distance) =>
  page.evaluate(([x, z, yaw, pitch, distance]) => window.__DEBUG.look.pose({ x, z, yaw, pitch, distance }), [x, z, yaw, pitch, distance]);

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}`, type: 'jpeg', quality: 82 });

const read = (page) => page.evaluate(() => {
  const D = window.__DEBUG, t = D.player.targetEntity;
  const chat = [...document.querySelectorAll('#chat-messages > *')].map((e) => e.textContent.trim()).filter(Boolean);
  return {
    hp: +D.STATE.hp.toFixed(2), pos: [+D.player.pos.x.toFixed(2), +D.player.pos.z.toFixed(2)],
    target: t ? { type: t.type, name: t.ref?.def?.name ?? t.ref?.name ?? null, home: t.ref?.logic ? [t.ref.logic.homeX, t.ref.logic.homeZ] : null } : null,
    perfHud: [document.getElementById('perf-fps').textContent, document.getElementById('perf-calls').textContent],
    chatTail: chat.slice(-4)
  };
});

// One scan of the canvas for a hover label, then a click there through the game's own handler. With `home`, a click
// counts only when the hero's target is then the monster with that home; the scan goes on otherwise.
async function clickLabel(page, text, home = null) {
  const at = await page.evaluate(([text, home]) => {
    const canvas = document.getElementById('game-canvas'), tip = document.getElementById('hover-tooltip');
    const ev = (type, x, y) => canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }));
    const seen = new Set();
    for (let y = 20; y <= 660; y += 12) for (let x = 160; x <= 1120; x += 12) {
      ev('mousemove', x, y);
      if (tip.style.display === 'block') seen.add(tip.textContent);
      if (tip.style.display === 'block' && tip.textContent.includes(text)) {
        ev('mousedown', x, y); ev('mouseup', x, y);
        const L = window.__DEBUG.player.targetEntity?.ref?.logic;
        if (!home || (L && L.homeX === home[0] && L.homeZ === home[1])) return { at: [x, y], label: tip.textContent };
      }
    }
    return { missing: [...seen] };
  }, [text, home]);
  if (at.missing) await shot(page, 'FAILED-label.jpg');
  if (at.missing) throw new Error(`no hover label "${text}" (labels seen: ${JSON.stringify(at.missing)})`);
  await parkMouse(page);
  return at;
}

async function useDoor(page) {
  await pose(page, DOOR[0], DOOR[1] + 3.5, 3.14, 0.5, 10);
  await page.waitForTimeout(1500);
  const at = await clickLabel(page, 'Slagfall Terrace');
  await page.waitForFunction(() => window.__DEBUG.player.pos.x > 400, null, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  return at;
}

// The recorder: every animation frame, one row per watched monster (found by its home).
// Row: [ms since start, index, x, z, state, attackCooldown, windup attack id or null, hero x, hero z, hero hp].
const startRecorder = (page, homes) => page.evaluate((homes) => {
  const ents = homes.map(([hx, hz]) => {
    let r = null;
    for (const sc of window.__scenes) sc.traverse((o) => {
      const e = o.userData && o.userData.type === 'monster' ? o.userData.entity : null;
      if (e && o === e.rig.group && e.logic.homeX === hx && e.logic.homeZ === hz) r = e;
    });
    if (!r) throw new Error(`no monster with home ${hx}, ${hz}`);
    return r;
  });
  const rec = { t0: performance.now(), rows: [], on: true, types: ents.map((e) => e.typeKey), camps: ents.map((e) => e.logic.campId) };
  window.__rec = rec;
  const P = window.__DEBUG.player, S = window.__DEBUG.STATE;
  const tick = () => {
    if (!rec.on) return;
    const t = Math.round(performance.now() - rec.t0);
    ents.forEach((e, i) => {
      const L = e.logic;
      rec.rows.push([t, i, +L.x.toFixed(3), +L.z.toFixed(3), L.state, +L.attackCooldown.toFixed(3), L.windup ? L.windup.attackId : null, +P.pos.x.toFixed(3), +P.pos.z.toFixed(3), +S.hp.toFixed(2)]);
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { types: rec.types, camps: rec.camps };
}, homes);

// Waits until the recorder has seen the first shot (a wind-up, or the cooldown jumping up in `attack`) of monster 0.
const untilShot = (page, ms) => page.waitForFunction(() => {
  const r = window.__rec.rows.filter((row) => row[1] === 0);
  for (let i = 1; i < r.length; i++) {
    if (r[i][6] && !r[i - 1][6]) return true;
    if (r[i][4] === 'attack' && r[i][5] > r[i - 1][5] + 0.2) return true;
  }
  return false;
}, null, { timeout: ms, polling: 50 }).then(() => true, () => false);

async function stopRecorder(page, key) {
  const rec = await page.evaluate(() => { window.__rec.on = false; return { types: window.__rec.types, camps: window.__rec.camps, rows: window.__rec.rows }; });
  writeFileSync(`${OUT}/trace-${key}.json`, JSON.stringify(rec) + '\n');
  return rec.rows.length;
}

async function protectFromMelee(page) {
  await page.evaluate(() => {
    window.__DEBUG.STATE.prayerPts = 70;
    const card = [...document.querySelectorAll('#prayer-grid .action-card')].find((c) => c.title === 'Blocks 80% of monster Melee damage');
    if (!card) throw new Error('no Protect from Melee card');
    card.click();
  });
  return page.evaluate(() => [...window.__DEBUG.STATE.activePrayers]);
}

async function done(key, s, ctx, errors) {
  delete facts.scenes[`scene${facts.n}`];
  facts.scenes[key] = s;
  await ctx.close();
  if (errors.length) throw new Error(`${key}: ${errors.join(' | ')}`);
}

const begin = (s) => { facts.scenes[`scene${facts.n = (facts.n ?? 0) + 1}`] = s; }; // kept if a later step throws

export default async function job(_page, browser) {
  try { await scenes(browser); } finally { writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 1) + '\n'); }
}

async function scenes(browser) {
  // A: the cave's pillar (solid [69, 30, 71, 32]). The hero at local (66.8, 33.4), 9 from the back hall's Ember Hurler at
  // its home (74, 28), the pillar between them (L1 case 7's spot). The back hall's Lesser Demon (home 66, 34) stands
  // beside the hero; Protect from Melee is on so the hero stands the 25 s. The camera looks from behind the hero at the
  // Hurler. The hero fights back as the game decides (auto-retaliation); the recorder reads where it stands.
  if (!ONLY || ONLY.includes('A')) {
    const { ctx, page, errors } = await open(browser);
    const s = { pageErrors: errors, shots: [] };
    begin(s);
    s.door = await useDoor(page);
    s.prayersOn = await protectFromMelee(page);
    await pose(page, ...W(66.8, 33.4), 2.215, 0.75, 13);
    s.watched = await startRecorder(page, [W(74, 28), W(66, 34), W(74, 40)]);
    await page.waitForTimeout(1500);
    await shot(page, 'a1-pillar-blocked.jpg');
    s.shots.push({ file: 'a1-pillar-blocked.jpg', afterMs: 1500, ...(await read(page)) });
    s.firstShotSeen = await untilShot(page, WATCH_MS);
    await shot(page, 'a2-pillar-first-shot.jpg');
    s.shots.push({ file: 'a2-pillar-first-shot.jpg', note: 'taken when the recorder saw the Hurler\'s first shot', ...(await read(page)) });
    await page.waitForTimeout(2000);
    await shot(page, 'a3-pillar-after.jpg');
    s.shots.push({ file: 'a3-pillar-after.jpg', ...(await read(page)) });
    s.rows = await stopRecorder(page, 'a_pillar');
    await done('a_pillar', s, ctx, errors);
  }

  // B and C: a wall corner. A Hurler acquires the hero inside its camp's circle (a hero outside the circle is not
  // acquired). The job waits for it to leave `idle`, then poses the hero round a corner and clears the hero's target and
  // walk (as a player who stops), so the hero stands; it does it twice, 0.7 s apart, in case a hit already in flight sets
  // off the auto-retaliation. The recorder starts at the corner pose; shots from 1.5 s on count.
  // B: the front hall's Hurler (home 44, 34; camp centre 38.67, 34, radius 10, leash 14) acquires the hero at local
  // (47, 34); the corner spot is in the back hall at (57, 30.5), 13.5 from its home, the c2 corridor's south wall between
  // them from the front hall.
  // C: the back hall's Hurler (home 74, 28; camp centre 71.33, 34, radius 12, leash 16) acquires the hero at local
  // (64, 28); the corner spot is inside corridor c2 at (51.5, 31.5), the back hall's west wall between them.
  const corners = [
    ['B', 'b_corner', W(47, 34), [W(44, 34), W(36, 30), W(36, 38)], W(57, 30.5), 5.03],
    ['C', 'c_corridor', W(64, 28), [W(74, 28), W(66, 34), W(74, 40)], W(51.5, 31.5), 1.57]
  ];
  for (const [letter, key, pullAt, homes, cornerAt, yaw] of corners) {
    if (ONLY && !ONLY.includes(letter)) continue;
    const l = letter.toLowerCase();
    const { ctx, page, errors } = await open(browser);
    const s = { pageErrors: errors, shots: [], pullAt, cornerAt };
    begin(s);
    s.door = await useDoor(page);
    s.prayersOn = await protectFromMelee(page);
    await pose(page, ...pullAt, yaw, 0.75, 12);
    s.acquired = await page.waitForFunction((home) => {
      let st = null;
      for (const sc of window.__scenes) sc.traverse((o) => { const e = o.userData?.type === 'monster' ? o.userData.entity : null; if (e && o === e.rig.group && e.logic.homeX === home[0] && e.logic.homeZ === home[1]) st = e.logic.state; });
      return st !== 'idle';
    }, homes[0], { timeout: 10_000, polling: 20 }).then(() => true);
    s.watched = await startRecorder(page, homes);
    const corner = async () => {
      await pose(page, ...cornerAt, yaw, 0.6, 11);
      await page.evaluate(() => { const P = window.__DEBUG.player; P.targetEntity = null; P.waypoints.length = 0; });
    };
    await corner();
    await page.waitForTimeout(700);
    await corner();
    await page.waitForTimeout(800);
    await shot(page, `${l}1-corner-blocked.jpg`);
    s.shots.push({ file: `${l}1-corner-blocked.jpg`, afterMs: 1500, ...(await read(page)) });
    s.firstShotSeen = await page.waitForFunction(() => {
      const r = window.__rec.rows.filter((row) => row[1] === 0 && row[0] >= 1500);
      for (let i = 1; i < r.length; i++) {
        if (r[i][6] && !r[i - 1][6]) return true;
        if (r[i][4] === 'attack' && r[i][5] > r[i - 1][5] + 0.2) return true;
      }
      return false;
    }, null, { timeout: WATCH_MS, polling: 50 }).then(() => true, () => false);
    await shot(page, `${l}2-corner-first-shot.jpg`);
    s.shots.push({ file: `${l}2-corner-first-shot.jpg`, note: 'taken when the recorder saw the Hurler\'s first shot after the corner pose, or at the end of the watch', ...(await read(page)) });
    s.rows = await stopRecorder(page, key);
    await done(key, s, ctx, errors);
  }

  // D: across the river from the goblin archers. Three Kettle Camp is passive, so the hero pulls the archer at (27, 19)
  // with an Oak Shortbow from the east bank at (39.6, 19), 12.6 from its home (the hero's ranged reach is 13.5), the
  // river Lum between them. The job equips the bow, puts 500 Bronze Arrows in the backpack, sets the style and Ranged 1
  // (so the archer, 12 hp, lives through several shots) through `__DEBUG.STATE`, then clicks the archer by its hover
  // label once it has wandered within 13 of the hero. When the archer is pulled the hero stops (see below).
  if (!ONLY || ONLY.includes('D')) {
    const { ctx, page, errors } = await open(browser);
    const s = { pageErrors: errors, shots: [] };
    begin(s);
    await page.evaluate(() => {
      const S = window.__DEBUG.STATE;
      S.equipment.weapon = 'shortbow';
      S.inventory.push({ id: 'bronze_arrow', qty: 500 });
      S.combatStyle = 'ranged';
      S.skills.ranged.lvl = 1; S.skills.ranged.xp = 0;
      window.__DEBUG.rebuildPlayerEquipmentMeshes();
    });
    await pose(page, 39.6, 19, 4.71, 0.35, 9);
    await page.waitForTimeout(1500);
    s.watched = await startRecorder(page, [[27, 19], [24, 13]]);
    // The archer wanders; the click waits until it is within 13 of the hero, so the hero shoots from where it stands.
    s.inReachMs = await page.waitForFunction(() => {
      const r = window.__rec.rows.filter((row) => row[1] === 0).at(-1);
      return r && Math.hypot(r[2] - r[7], r[3] - r[8]) <= 13;
    }, null, { timeout: 60_000, polling: 50 }).then(() => true);
    s.attackClick = await clickLabel(page, 'Goblin Archer', [27, 19]);
    // Once the archer is pulled (`chase`), the hero stops shooting and stands on the bank (target and walk cleared, the
    // hero put back on its spot), so the archer lives and has to come to the hero.
    s.pulled = await page.waitForFunction(() => window.__rec.rows.some((row) => row[1] === 0 && row[4] === 'chase'), null, { timeout: 20_000, polling: 20 }).then(() => true);
    await page.evaluate(() => { const P = window.__DEBUG.player; P.targetEntity = null; P.waypoints.length = 0; });
    await pose(page, 39.6, 19, 4.71, 0.35, 9);
    s.stoppedAt = await read(page);
    await page.waitForTimeout(2500);
    await shot(page, 'd1-river-pulled.jpg');
    s.shots.push({ file: 'd1-river-pulled.jpg', afterMs: 2500, ...(await read(page)) });
    s.firstShotSeen = await untilShot(page, WATCH_MS);
    await shot(page, 'd2-river-end.jpg');
    s.shots.push({ file: 'd2-river-end.jpg', note: 'taken when the recorder saw the archer\'s first shot, or at the end of the watch', ...(await read(page)) });
    s.rows = await stopRecorder(page, 'd_river');
    await done('d_river', s, ctx, errors);
  }
}
