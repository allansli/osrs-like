# Stage 5 capture procedure (CAP)

Run by the main session with the Playwright browser tools. No dependency, nothing under `src/`.
Headless pictures are valid; frame times are not (software renderer). Frame times come only from `look.bench` on the owner's GPU.
Poses and times: `poses.json` (same folder). Presets: 0 = golden, 1 = noon, 2 = night (`look.preset(n)` until LT5a adds `look.phase`; after it, call `look.phase` with the named time; `look.weather` likewise when a pose has `weather`).

## Steps

1. **Build and serve.** From the worktree root: `scripts/capped.sh npm run build`, then `scripts/capped.sh npx vite preview --port 4173` in the background. One serve on the machine at a time. Stop it when the run ends (kill by PID, not `pkill -f`, which matches its own command line).
2. **Open.** One `browser_run_code_unsafe` call, `async (page) => {...}`, so the init script is registered before navigation:
   - `await page.context().addInitScript(() => { /* seeded generator */ })` replacing `Math.random` with mulberry32, seed `0x9e3779b9`:
     `let s=0x9e3779b9; Math.random=()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};`
   - `await page.setViewportSize({width:1280,height:720})` (P11 uses the sizes in `poses.json` `viewports`).
   - `await page.goto('http://localhost:4173/')`. The tool's browser profile is throwaway; nothing is saved between runs.
3. **Dismiss onboarding.** `await page.evaluate(() => { const b = document.getElementById('onboarding'); if (b && !b.hidden) b.hidden = true; })` (element id `onboarding`; the page's own button calls `dismissOnboarding()`).
4. **Wait for ready.** `await page.waitForFunction(() => window.__DEBUG && window.__DEBUG.look && window.__DEBUG.look.ready(), null, {timeout: 60000})`. A timeout is a failed run; do not capture.
5. **For each tier id, pose row and time** (tiers: `performance`, `balanced`, `high`, `ultra`):
   - **Hide the hover tile.** The game draws a pale ground quad (`G.hoverTile`, `src/engine/input.ts` `updateHoverTile`) under the mouse; it is not a shadow and must not appear in a picture. It is updated only by `window` `mousemove`, and a move whose target is not `#game-canvas` hides it. So, with the HUD shown: `await page.evaluate(() => __DEBUG.look.hud(true))`; `const b = await page.locator('#top-left-hud').boundingBox()`; `await page.mouse.move(b.x+b.width/2, b.y+b.height/2)`. Confirm: `page.evaluate(([x,y]) => !!document.elementFromPoint(x,y)?.closest('#top-left-hud'), [cx,cy])` is `true`; if it is `false` the run fails, do not capture. The mouse then stays still, so no later event can show the tile. Never click or move the mouse on the canvas during a run.
   - `page.evaluate` of `look.tier(id); look.pose({place,yaw,pitch,distance}); look.preset(n) /* or look.phase(time) */; look.weather(w) /* only if the row has weather */; look.hud(false)`.
   - `await page.waitForTimeout(2000)`.
   - `await page.screenshot({path: '<abs worktree>/docs/superpowers/baseline/stage5/<slice>/<pose>-<time>-<tier>.jpg', type: 'jpeg', quality: 80})`.
6. **Read the perf HUD.** After the screenshot: `look.hud(true)`, read `document.getElementById('perf-calls').textContent` (format `<calls> calls • <tris>k tris`, includes the shadow pass), `look.hud(false)`. Append one row per picture to `<slice>/perf.md`: pose, time, tier, calls, triangles.
7. **Finish.** Stop the preview process. Commit the pictures and `perf.md` only when the task says so.

## Proof (V1c)

P1 at noon, `proof/P1-noon-performance.jpg` and `proof/P1-noon-balanced.jpg`, 1280x720:

| tier | HUD |
|---|---|
| performance | 1499 calls • 261k tris |
| balanced | 3247 calls • 601k tris |

Captured with the hover-tile step of step 5 (mouse on `#top-left-hud`, confirmed by `elementFromPoint`); no hover tile shows in either picture.

The evidence of the shadow pass is the HUD count: balanced draws about twice the calls and triangles of performance, and since V1b that count includes the shadow pass. No shadow is visible in either picture: before the LT slice no facet surface receives a shadow (design section 1 item 2), so the two pictures differ only in animated monsters and the water strip. Monsters move between frames, so pictures are not byte-stable even with the seeded generator; compare by eye or by the HUD numbers.


## Poses in aggressive ground (added by the main session, 2026-11-24, from the V2 repair)

P4 and P5 stand in or near aggressive camps (Cinderstep Pass, the wilderness). A level-3 hero is attacked there and can die during the capture, which puts the death screen, a monster or Lumbridge in the picture and wrong numbers in the table. Before the first P4 or P5 pose: start from a fresh load (`localStorage` cleared in the init script), raise `__DEBUG.STATE.skills` to 99 so no camp threatens the hero, and check each shot for a live player within 1 unit of the pose target and no monster in chase or attack. P11 starts from a fresh save with unmodified skills.
