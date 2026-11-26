// G-6.0 H-0 captures: an aggressive camp, a passive camp, a gatherer hit. Run by scripts/capture-gpu.mjs.
// Each scene gets a fresh browser context (clean storage), seeded Math.random, the game's own loop; nothing in src/ is patched.
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
const facts = { renderer: null, scenes: {} };

async function open(browser, seedShift = 0) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(SEED.replace('0x9e3779b9', String((0x9e3779b9 + seedShift * 7919) >>> 0)));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { timeout: 60_000 });
  await page.evaluate(() => { const b = document.getElementById('onboarding'); if (b && !b.hidden) b.hidden = true; });
  await page.waitForFunction(() => window.__DEBUG && window.__DEBUG.look && window.__DEBUG.look.ready(), null, { timeout: 60_000 });
  facts.renderer ??= await rendererOf(page);
  await page.evaluate(() => window.__DEBUG.look.tier('balanced'));
  return { ctx, page, errors };
}

// Skills: xp from the OSRS curve so the game's own level reads agree.
async function setSkills(page, levels) {
  await page.evaluate((levels) => {
    const xpFor = (l) => { let p = 0; for (let i = 1; i < l; i++) p += Math.floor(i + 300 * Math.pow(2, i / 7)); return Math.floor(p / 4); };
    const S = window.__DEBUG.STATE;
    for (const [k, l] of Object.entries(levels)) { S.skills[k].lvl = l; S.skills[k].xp = xpFor(l); }
    if (levels.hitpoints) { S.hp = levels.hitpoints; S.maxHp = levels.hitpoints; }
  }, levels);
}

async function parkMouse(page) {
  const b = await page.locator('#top-left-hud').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
}

const read = (page) => page.evaluate(() => {
  const D = window.__DEBUG, t = D.player.targetEntity;
  const chat = [...document.querySelectorAll('#chat-messages > *')].map((e) => e.textContent.trim()).filter(Boolean);
  return {
    hp: D.STATE.hp, maxHp: D.STATE.maxHp, pos: [+D.player.pos.x.toFixed(2), +D.player.pos.z.toFixed(2)],
    target: t ? { type: t.type, name: t.ref?.def?.name ?? null, state: t.ref?.logic?.state ?? null } : null,
    chatTail: chat.slice(-6)
  };
});

async function pose(page, x, z, yaw = 0.6, pitch = 0.75, distance = 16) {
  await page.evaluate(([x, z, yaw, pitch, distance]) => window.__DEBUG.look.pose({ x, z, yaw, pitch, distance }), [x, z, yaw, pitch, distance]);
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}`, type: 'jpeg', quality: 82 });

// Watch for `secs`, sampling every 250 ms; returns the first sample where hp dropped (or null) and the last sample.
async function watch(page, secs, hp0) {
  let firstHit = null, last = null;
  for (let i = 0; i < secs * 4; i++) {
    await page.waitForTimeout(250);
    last = await read(page);
    if (firstHit === null && last.hp < hp0) firstHit = { atSecs: (i + 1) / 4, ...last };
  }
  return { firstHit, last };
}

async function campScene(browser, key, levels, x, z, secs, file, camera) {
  const { ctx, page, errors } = await open(browser);
  if (levels) await setSkills(page, levels);
  await parkMouse(page);
  await page.waitForTimeout(3500); // the aggression grace after load (AGGRO_GRACE_MS 3000) runs out before the pose
  await pose(page, x, z, ...camera);
  const before = await read(page);
  const w = await watch(page, secs, before.hp);
  await shot(page, file);
  facts.scenes[key] = { file, combat: await page.evaluate(() => document.getElementById('combat-lvl-badge')?.textContent ?? null), levels, placedAt: [x, z], watchedSecs: secs, before, ...w, pageErrors: errors };
  await ctx.close();
}

export default async function job(_page, browser) {
  // A: aggressive scorpion camp (dune_nest_west), a new hero (combat 3, below the scorpions' 12): full sight 9, they come.
  if (!process.env.ONLY_C) await campScene(browser, 'a1_scorpions_new_hero', null, 48, 33, 4, 'a1-scorpions-new-hero.jpg', [0.6, 0.8, 18]);
  // A2: the same spot, a strong hero (every combat skill 99): sight 3, nothing comes from 6 units away.
  const strong = { attack: 99, strength: 99, defence: 99, hitpoints: 99, ranged: 99, magic: 99, prayer: 99 };
  if (!process.env.ONLY_C) await campScene(browser, 'a2_scorpions_strong_hero', strong, 48, 33, 10, 'a2-scorpions-strong-hero.jpg', [0.6, 0.8, 18]);
  // B: passive camp (three_kettle), a new hero among the goblins: nobody starts a fight.
  if (!process.env.ONLY_C) await campScene(browser, 'b_three_kettle_passive', null, 17, 12, 10, 'b-three-kettle-passive.jpg', [0.6, 0.8, 18]);

  // C: a combat-70 hero chops the yews of deep_woods_west (moss guardians, level 45, homes (-99, -26) and (-99, -34);
  // yews at (-96, -24) and (-102, -27)). A yew gives one log and then rests 8.5 s, and a swing succeeds half the time
  // at the requirement (woodcutting 35), so each gather is short. The page plays a player who keeps chopping: whenever
  // the hero has no target and no hit has landed, it finds a standing yew by the game's own hover label and clicks it
  // (synthetic canvas events, the game's own handlers). A frame watcher records the target and hit points of every
  // frame, so the frame before the first hit says whether the hero was gathering. Each attempt is a fresh page.
  {
    const P = [-94.5, -22.5];
    const scene = { placedAt: P, attempts: [] };
    for (let attempt = 0; attempt < 10; attempt++) {
      const { ctx, page, errors } = await open(browser, attempt);
      await setSkills(page, { attack: 61, strength: 61, defence: 61, hitpoints: 61, woodcutting: 35 });
      await parkMouse(page);
      await page.waitForTimeout(3500);
      await pose(page, P[0], P[1], 2.4, 0.95, 13);
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        const D = window.__DEBUG, canvas = document.getElementById('game-canvas'), tip = document.getElementById('hover-tooltip'), hud = document.getElementById('top-left-hud');
        const w = (window.__watch = { frames: [], clicks: [] }); const t0 = performance.now(); let lastScan = -1;
        const ev = (type, x, y, target) => target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }));
        const findYew = () => {
          for (let y = 80; y <= 660; y += 14) for (let x = 120; x <= 1160; x += 14) { ev('mousemove', x, y, canvas); if (tip.style.display === 'block' && /Sacred Blossom Yew/.test(tip.textContent)) return [x, y]; }
          return null;
        };
        const tick = () => {
          const now = (performance.now() - t0) / 1000, t = D.player.targetEntity;
          w.frames.push({ t: +now.toFixed(3), hp: +D.STATE.hp.toFixed(3), target: t ? t.type : null, monster: t && t.type === 'monster' ? t.ref.def.name : null, pos: [+D.player.pos.x.toFixed(2), +D.player.pos.z.toFixed(2)], moving: !!(D.player.isMoving || D.player.waypoints.length > 0) });
          if (w.frames.length > 6000) w.frames.shift();
          const hit = w.frames.some((f) => f.hp < 61);
          if (!hit && !t && now - lastScan > 0.3 && now < 40) {
            lastScan = now;
            const at = findYew();
            const r = hud.getBoundingClientRect(); ev('mousemove', r.x + r.width / 2, r.y + r.height / 2, hud);
            if (at) { ev('mousedown', at[0], at[1], canvas); w.clicks.push(+now.toFixed(2)); }
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      let shotC1 = false;
      const start = Date.now();
      while (Date.now() - start < 42000) {
        const r = await read(page);
        const still = await page.evaluate(() => !(window.__DEBUG.player.isMoving || window.__DEBUG.player.waypoints.length > 0));
      if (!shotC1 && still && r.target?.type === 'resource' && r.hp === 61) { await shot(page, `c1-yew-chopping-try${attempt}.jpg`); shotC1 = true; }
        if (r.hp < 61) break;
        await page.waitForTimeout(50);
      }
      const W = await page.evaluate(() => window.__watch);
      const w = W.frames, i = w.findIndex((f) => f.hp < 61);
      const a = { attempt, errors, clicks: W.clicks, hit: i >= 0, frameBefore: i > 0 ? w[i - 1] : null, frameOfHit: i >= 0 ? w[i] : null, framesAfter: i >= 0 ? w.slice(i + 1, i + 4) : null, gatheringFrames: w.filter((f) => f.target === 'resource').length, frames: w.length, chatTail: (await read(page)).chatTail.slice(-4) };
      a.gatheringWhenHit = !!a.frameBefore && a.frameBefore.target === 'resource' && !a.frameBefore.moving;
      a.walkingToTreeWhenHit = !!a.frameBefore && a.frameBefore.target === 'resource' && a.frameBefore.moving;
      if (i >= 0) { await page.waitForTimeout(2500); a.after2_5s = await read(page); a.movingAfter = await page.evaluate(() => !!(window.__DEBUG.player.isMoving || window.__DEBUG.player.waypoints.length > 0)); }
      if (a.gatheringWhenHit) {
        await shot(page, 'c2-yew-hit-fighting-back.jpg');
        a.c1 = shotC1 ? `c1-yew-chopping-try${attempt}.jpg` : null;
      }
      scene.attempts.push(a);
      await ctx.close();
      if (a.gatheringWhenHit) break;
    }
    facts.scenes.c_yew_gatherer = scene;
  }
  writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 1) + '\n');
}
