// G-6.2 H-2 captures: the dialogue panel, the tracker line and the journal, in the game on the GPU. Run by
// scripts/capture-gpu.mjs. Each scene gets a fresh browser context (clean storage), seeded Math.random and the game's own
// loop; nothing in src/ is patched. A person is found by the game's own hover label (one scan of synthetic mousemoves on
// the canvas) and clicked with the game's own mousedown handler; options are chosen with the panel's own keys 1 to 4.
// The job throws on any page or console error, or when the panel text is not the table's.
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

// The table's lines for the nodes the job reaches (src/data/dialogue.ts), so a stale or wrong panel fails the run.
const EXPECT = {
  ledger_open: "Name, and what you carry. Nothing? Then you will fit in. Put your name in the task master's ledger and I will find you a blade.",
  wards_offer: 'Tolley sent you. Good. He counts people and I look at them, and you will do. Three wardlights on three roads are guttering, and I am one woman with one pair of knees. I need hands.',
  wards_brief: 'A wardlight burns ash to keep ash away, the way you bleed a fever. The town lamp is nearly out of it. Burn three logs at any forge and bring me what is left. Three measures of ashes. Do not sift them.'
};
const CHAIN = ['arrival', 'sq_ledger', 'sq_quarrel', 'sq_gather', 'sq_forge', 'sq_keeping', 'sq_coin'];

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(SEED);
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

// One scan of the canvas for the person's hover label, then a click there through the game's own handler.
async function talkTo(page, name) {
  const at = await page.evaluate((name) => {
    const canvas = document.getElementById('game-canvas'), tip = document.getElementById('hover-tooltip');
    const ev = (type, x, y) => canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }));
    for (let y = 120; y <= 640; y += 12) for (let x = 200; x <= 1080; x += 12) {
      ev('mousemove', x, y);
      if (tip.style.display === 'block' && tip.textContent.includes(name)) { ev('mousedown', x, y); ev('mouseup', x, y); return [x, y]; }
    }
    return null;
  }, name);
  if (!at) throw new Error(`no hover label for ${name}`);
  await page.waitForSelector('#dialogue-panel:not([hidden])', { timeout: 15_000 });
  await parkMouse(page);
  await page.waitForTimeout(600);
  return at;
}

const panel = (page) => page.evaluate(() => ({
  open: !document.getElementById('dialogue-panel').hidden,
  speaker: document.getElementById('dialogue-speaker').textContent,
  say: document.getElementById('dialogue-say').textContent,
  options: [...document.querySelectorAll('#dialogue-options button')].map((b) => b.textContent.trim())
}));

const tracker = (page) => page.evaluate(() => ({
  title: document.getElementById('quest-tracker-title').textContent,
  step: document.getElementById('quest-tracker-step').textContent
}));

function check(key, got, node) {
  if (got.say !== EXPECT[node]) throw new Error(`${key}: panel says ${JSON.stringify(got.say)}, the table's ${node} says ${JSON.stringify(EXPECT[node])}`);
}

export default async function job(_page, browser) {
  // A: a new game (combat 3, the starter chain at its first open quest). The hero stands 3 south of Bran Tolley (4, 12),
  // the camera behind it looking north (yaw 3.14 looks toward -z).
  {
    const { ctx, page, errors } = await open(browser);
    await parkMouse(page);
    await page.waitForTimeout(1500);
    await pose(page, 4, 15, 3.14, 0.45, 7);
    await page.waitForTimeout(1200);
    const clickedAt = await talkTo(page, 'Bran Tolley');
    const p = await panel(page);
    await shot(page, 'd1-bran-new-game.jpg');
    check('a_bran', p, 'ledger_open');
    facts.scenes.a_bran = { file: 'd1-bran-new-game.jpg', heroAt: [4, 15], clickedAt, panel: p, tracker: await tracker(page), pageErrors: errors };
    await ctx.close();
    if (errors.length) throw new Error(`a_bran: ${errors.join(' | ')}`);
  }

  // B: a hero who finished the starter chain (its seven ids written into quests.claimed through __DEBUG.STATE) at
  // combat 20 (attack, strength, defence, hitpoints 20), so A Vow Kept (combat 15) is also on offer. The hero stands
  // 2.5 south of Odalys Venn (-8, -6). Everything after the setup goes through the game: the click, keys 1 and 1.
  {
    const { ctx, page, errors } = await open(browser);
    await setSkills(page, { attack: 20, strength: 20, defence: 20, hitpoints: 20 });
    await page.evaluate((chain) => { window.__DEBUG.STATE.quests.claimed = [...chain]; }, CHAIN);
    await parkMouse(page);
    await page.waitForTimeout(1500);
    await pose(page, -8, -3.5, 3.14, 0.45, 7);
    await page.waitForTimeout(1200);
    const s = { heroAt: [-8, -3.5], chainClaimed: CHAIN, pageErrors: errors };
    s.clickedAt = await talkTo(page, 'Odalys Venn');
    s.offer = await panel(page);
    s.trackerBefore = await tracker(page);
    await shot(page, 'd2-odalys-offer.jpg');
    check('b_odalys offer', s.offer, 'wards_offer');
    await page.keyboard.press('1'); // "What do you need?": start ml_wards, go to wards_brief
    await page.waitForTimeout(600);
    s.brief = await panel(page);
    await shot(page, 'd3-odalys-brief.jpg');
    check('b_odalys brief', s.brief, 'wards_brief');
    await page.keyboard.press('1'); // "Three measures of ashes. I will bring them.": advance to stage 1, end
    await page.waitForTimeout(1000);
    s.afterChoices = await panel(page);
    s.story = await page.evaluate(() => ({ ...window.__DEBUG.STATE.progress?.story }));
    s.trackerAfter = await tracker(page);
    await page.locator('#quest-tracker').screenshot({ path: `${OUT}/t1-tracker.jpg`, type: 'jpeg', quality: 90 });
    await shot(page, 't2-tracker-in-hud.jpg');
    await page.click('#btn-quests');
    await page.waitForSelector('#log-tab-journal.active', { timeout: 10_000 });
    await parkMouse(page);
    await page.waitForTimeout(600);
    s.journal = await page.evaluate(() => document.getElementById('log-tab-journal').innerText.split('\n').map((l) => l.trim()).filter(Boolean));
    await shot(page, 'j1-journal.jpg');
    facts.scenes.b_odalys = s;
    await ctx.close();
    if (errors.length) throw new Error(`b_odalys: ${errors.join(' | ')}`);
    if (s.afterChoices.open) throw new Error('b_odalys: the panel is still open after the ending choice');
  }
  writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 1) + '\n');
}
