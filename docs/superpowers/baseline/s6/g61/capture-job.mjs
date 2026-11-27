// G-6.1 H-1 captures: the two new camps (cinder_circle, brute_shelf) and Marrowjaw (tollmaster), each with its kit, in the
// game on the GPU. Run by scripts/capture-gpu.mjs. Each scene gets a fresh browser context (clean storage), seeded
// Math.random and the game's own loop; nothing in src/ is patched. The live scene is reached through three.js's own
// devtools hook (a `__THREE_DEVTOOLS__` EventTarget set before the page loads: every THREE.Scene announces itself), so the
// job can read which kit children hang on which bone of each figure. The job throws on any page or console error.
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
const KITS = ['cinder_adept', 'slag_brute', 'marrowjaw'];
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

async function pose(page, x, z, yaw, pitch, distance) {
  await page.evaluate(([x, z, yaw, pitch, distance]) => window.__DEBUG.look.pose({ x, z, yaw, pitch, distance }), [x, z, yaw, pitch, distance]);
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}`, type: 'jpeg', quality: 82 });

// Every kit child in the live scenes: its name, the bone it hangs on, and the figure's world position (rounded).
const kitChildren = (page, kit) => page.evaluate((kit) => {
  const out = [];
  for (const sc of window.__scenes) sc.traverse((o) => {
    if (!o.name.startsWith(kit + '_') || !o.parent) return;
    let root = o.parent; while (root.parent && !root.parent.isScene) root = root.parent;
    const p = root.position;
    out.push({ child: o.name, parent: o.parent.name, parentIsBone: !!o.parent.isBone, figureAt: [+p.x.toFixed(1), +p.z.toFixed(1)] });
  });
  return out;
}, kit);

const read = (page) => page.evaluate(() => {
  const D = window.__DEBUG, t = D.player.targetEntity;
  const chat = [...document.querySelectorAll('#chat-messages > *')].map((e) => e.textContent.trim()).filter(Boolean);
  return {
    hp: +D.STATE.hp.toFixed(2), maxHp: D.STATE.maxHp, pos: [+D.player.pos.x.toFixed(2), +D.player.pos.z.toFixed(2)],
    target: t ? { type: t.type, name: t.ref?.def?.name ?? null, state: t.ref?.logic?.state ?? null } : null,
    chatTail: chat.slice(-4)
  };
});

// One scene: wait until the kit is on its figures (the models load after the world), then each shot in turn.
async function scene(browser, key, kit, levels, shots) {
  const { ctx, page, errors } = await open(browser);
  await setSkills(page, levels);
  await parkMouse(page);
  await page.waitForTimeout(3500); // the aggression grace after load (AGGRO_GRACE_MS 3000)
  await pose(page, ...shots[0].at, ...shots[0].camera);
  const t0 = Date.now();
  while ((await kitChildren(page, kit)).length === 0 && Date.now() - t0 < 30_000) await page.waitForTimeout(250);
  const kids = await kitChildren(page, kit);
  const s = { kit, levels, kitChildren: kids, kitWaitMs: Date.now() - t0, shots: [], pageErrors: errors };
  for (const sh of shots) {
    if (sh !== shots[0] && !sh.keep) await pose(page, ...sh.at, ...sh.camera);
    await page.waitForTimeout(sh.waitMs);
    await shot(page, sh.file);
    s.shots.push({ file: sh.file, heroAt: sh.at, camera: sh.camera, afterMs: sh.waitMs, ...(await read(page)) });
  }
  facts.scenes[key] = s;
  await ctx.close();
  if (errors.length) throw new Error(`${key}: ${errors.join(' | ')}`);
  if (kids.length === 0 || !kids.every((k) => k.parentIsBone)) throw new Error(`${key}: kit ${kit} not on a bone of its figures`);
}

export default async function job(_page, browser) {
  // A strong hero (every combat skill 99, combat 126): an ordinary camp's sight is SIGHT_MIN 3 at that gap, so the hero
  // can stand among the Adepts and the Brutes (each member is more than 4 units from where it stands) and nothing comes.
  const strong = { attack: 99, strength: 99, defence: 99, hitpoints: 99, ranged: 99, magic: 99, prayer: 99 };
  // cinder_circle: members (-2, 67), (4, 74), (-4, 77); centre (-0.7, 72.7).
  await scene(browser, 'a_cinder_circle', 'cinder_adept', strong, [
    { file: 'a1-cinder-circle-wide.jpg', at: [-0.7, 72.7], camera: [0.6, 0.8, 18], waitMs: 1500 },
    { file: 'a2-cinder-adept-close.jpg', at: [0, 70], camera: [0.9, 0.45, 7], waitMs: 1500 }
  ]);
  // brute_shelf: members (-6, 100), (2, 104); centre (-2, 102).
  await scene(browser, 'b_brute_shelf', 'slag_brute', strong, [
    { file: 'b1-brute-shelf-wide.jpg', at: [-2, 102], camera: [0.6, 0.8, 18], waitMs: 1500 },
    { file: 'b2-slag-brute-close.jpg', at: [-2.5, 100.5], camera: [3.5, 0.45, 7], waitMs: 1500 }
  ]);
  // Camera yaw: the view looks along (sin yaw, cos yaw) on the ground (yaw 3.14 looks toward -z).
  // tollmaster: Marrowjaw at (7, -73), arena 12, keepsSight (full sight 9 at any level). The hero first stands 14 away
  // (outside his sight), then 5 away: he comes, and the job shoots the fight 3 s and 6 s later.
  await scene(browser, 'c_marrowjaw', 'marrowjaw', strong, [
    { file: 'c1-marrowjaw-idle.jpg', at: [7, -59], camera: [3.14, 0.55, 14], waitMs: 1500 },
    { file: 'c2-marrowjaw-fight-3s.jpg', at: [7, -68], camera: [3.14, 0.55, 11], waitMs: 3000 },
    { file: 'c3-marrowjaw-fight-6s.jpg', at: [7, -68], camera: [3.14, 0.55, 11], waitMs: 3000, keep: true } // no new pose: the fight goes on
  ]);
  writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 1) + '\n');
}
