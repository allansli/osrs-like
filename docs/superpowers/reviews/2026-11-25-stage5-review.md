# Stage 5 adversarial review (2026-11-25)

Two read-only opus reviews of `feat/visual-pass`: engine (src/engine, src/state, src/data, scripts) and interface and security (index.html, src/ui, input, overlay, vercel.json, fonts). No critical finding. Both high findings are fixed.

## Fixed

| Finding | Severity | Fix |
|---|---|---|
| UI-1: Space on a mouse-focused button fired the button instead of jumping; focus returned to mouse openers | high | 1966a29, `tests/input-button-keys.test.ts` |
| UI-5: generated badges at 10 px and weight 800 | low | 9a3cb83 |
| EN-1: plain mode left the full water shader on | high | this commit, `tests/plain-water.test.ts` |
| EN-2: one shader failure posted a chat line and rebuilt the output per failing program | medium | this commit (return when already plain) |
| EN-3: plain mode lit the horizon apron white | medium | this commit (`updateSky` writes the mesh's current material) |
| Found at CP-WX: particle shapes were back-facing, so no mote or falling weather was drawn | high | 6167863, `tests/particles-side.test.ts` |

## Deferred, with reasons

| Finding | Severity | Deferred to | Why |
|---|---|---|---|
| EN-4: flora scatter density stays at the start tier | medium | models pass, Slice 8 budgets | the deferred GR7 limits are measured there; re-scatter per tier changes the counts that pass measures |
| EN-5: per-frame allocations (dayFrameAt x3, weather state x2, hex parsing, matchMedia) | medium | models pass, with the frame-time work (OV-2) | needs the owner's GPU measurement to rank against the monster meshes, the known main cost |
| UI-2: keyboard focus lost after a bank, shop or inventory action | medium | Stage 7 (controls) | Stage 7 reworks input for touch and keyboard; the mouse path works |
| UI-3: skill, equipment, prayer and spell cards are not keyboard controls | medium | Stage 7 (controls) | same; the a11y test then extends to generated markup |
| UI-4: dialogs do not trap focus (`inert`) | low | Stage 7 | same |
| UI-6: CSP logs Vercel toolbar violations on previews | low | UI8c note | vercel.live errors on a preview are expected and are not the app's |
| EN-6: weather snaps when the heaviest region changes | low | Stage 6 | weather by region weight comes with the regions Stage 6 adds |
| EN-7: falling particles jump when the fall speed changes | low | fixed | closed by the CP-WX rain change (offsets accumulated per frame) |
| EN-8: carpet tuft normals unrotated | low | models pass polish | lighting nuance on tufts |
| EN-9: cloud shadows also dim point lights | low | models pass polish | high and ultra only, at night |
| EN-10: facet material registry never shrinks | low | models pass | the monster merge (M0) rebuilds materials and is where the registry is reworked |
| EN-11: plain mode drops emissive intensity | low | models pass polish | plain mode is the failure fallback |
| EN-12: time-of-day button label goes stale | low | Stage 6 | UI text pass |

## Pre-merge verification of the fixes (2026-11-25)

G-5 re-run with the +91 kB budget: all ten checks pass. The adversarial check of the post-review fixes found:

| Finding | Severity | Outcome |
|---|---|---|
| The Space fix read `:focus-visible`, which Chrome sets on the first key press, so it did nothing in a real browser; the test stubbed the selector | high | fixed: `src/ui/pointerFocus.ts` records the button a pointer press focused, Tab clears it; the test now stubs `:focus-visible` as always true, as Chrome reports it, and fails on the old fix; checked in Chrome through Playwright (Space after a click jumps, Space on a tabbed button presses it) |
| Rain lost its slant the moment rain gave way to a weather with no fall | medium | fixed: speed, lean and shape follow the weather whose fall is drawn |
| Fall and wind offsets grow without bound (float32 steps of 0.125 after about 24 h in one session) | low | accepted: the old speed × time term had the same size; a per-instance speed factor prevents wrapping on the host |
| Particle, apron and chat-line fixes are proved by source checks or not at all | low | accepted for this stage; the plain-mode water fix has a behaviour test |
