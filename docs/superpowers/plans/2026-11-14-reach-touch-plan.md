# Reach, touch controls: implementation plan

Date: 2026-11-14. Branch: `feat/reach`, at `15b3667`. Design: `docs/superpowers/specs/2026-11-14-reach-touch-design.md` (called "the design" below; section numbers refer to it). Source line numbers are at `15b3667` and are only a hint: Stages 3, 4 and 5 land first and move them, so every task finds symbols by name.

The design is still a proposal. Nothing in this plan starts before owner step **O-1**, and no code task starts before **R0**.

---

## 0. Conventions

### 0.1 Task tags and tiers

- **[AGY]**: the task is specified fully enough to hand to the agy backend through `/agy-implement` (one worktree) or `/agy-parallel` (several lanes). It always runs in three stages, never merged into one:
  1. A **haiku** stage runs the `agy -p` command, waits for agy to exit, and returns the diff stat, the test output and the exit status. Its prompt says what to run and what to return, and nothing else.
  2. A **sonnet** stage implements the task only if agy failed or refused, and records that it did.
  3. An **opus** verify stage (a [CLAUDE] step) checks the diff against the task's file allowlist, runs the Accept check, and looks for weakened or deleted assertions, for edits to [CLAUDE] tests, and for test-only shortcuts.
  On an [AGY] task, "Tier" names the tier that does the work if agy fails. The verify is always opus and is part of the task. agy's own report is never evidence.
- **[CLAUDE]**: tests that define acceptance; text the player reads; layout work that has to be tuned against the browser check and so cannot be fully specified; anything driven in a live browser; and every verification. A test that defines acceptance for an [AGY] task is its own [CLAUDE] task and comes first.
- **[OWNER]** and **[HUMAN]**: a decision only the owner can make, or something a person has to do with a real device. These are not agent tasks.
- Agents never merge, tag, push or open pull requests. The main session merges lane branches after verification. No commit carries an AI attribution trailer of any kind (owner's global rule).
- No prompt to agy names the owner, a person or a device model.

### 0.2 Commands

Run every command from the worktree root. `scripts/capped.sh <cmd>` starts it in an allowlisted environment (no token reaches a test process) under the memory cap.

| Name | Command | Expected |
|---|---|---|
| SUITE | `scripts/capped.sh npx vitest run` | exit 0; every test passes, including every test that exists when R0 runs |
| ONE(file) | `scripts/capped.sh npx vitest run <file>` | as stated in the task |
| TYPES | `scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| BUILD | `scripts/capped.sh npm run build` | exit 0; the JS and CSS sizes are reported |

**Standard gate (SG)**: SUITE, TYPES and BUILD all pass. Every task below ends with SG unless it says otherwise. An OOM kill under the wrapper is a defect to fix. Never raise the cap. Run at most 3 or 4 agents at a time on this machine, one BUILD at a time, and never a dev server in more than one lane at once.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it. The opus verify rejects a diff with any other file in it.
2. **Existing tests are frozen.** No edit to any file that exists under `tests/` or `src/__tests__/` when R0 runs, including the tests Stages 3, 4 and 5 added. New tests go in new files under `tests/`. This plan declares **no** test replacement.
3. **Test-first pairs.** A [CLAUDE] test task may leave the suite red until the [AGY] task that implements it lands on the same branch. Allowed in that span: SUITE failures only in the new test file, and TYPES or BUILD errors only in the new test file and only because a module or export the paired task adds does not exist yet. The opus verify of the test task lists them. Any other error is a defect. The paired task's Accept restores full SG.
4. **Mouse and keyboard keep their behaviour.** The existing `keydown`, `keyup`, `mousedown`, `mousemove`, `mouseup`, `wheel`, `contextmenu` and minimap `click` listeners stay. The only edits allowed to existing input code are the list in design 6.1: the three right-click guards and the tooltip guard (T5); the two camera numbers lifted into named constants, and optional arguments on `handleWorldClick` whose default is today's behaviour (T6); the minimap scale (T7); the shared label helper and the optional heading on `openChooseMenu` (S1). Each must give a mouse or a key exactly today's result. `tests/input-keys.test.ts` passes unedited after every task, which also means nothing added to `setupInputHandlers` may use a member of the canvas other than `addEventListener` at set-up time (design T2).
5. **Two words are banned under `src/state`.** `tests/architecture.test.ts` fails any file there that contains the word "document" or the word "window", **in code, comments or strings**. Write "reaction time", "time limit", "viewport", "the page". Files under `src/state` import nothing from `src/engine`, `src/ui` or three.js.
6. **No browser sniffing.** No task reads the user-agent string. Behaviour follows `pointerType`, media queries, the viewport and the pixel ratio.
7. **No new dependency**, runtime or development. No service worker.
8. **No inline handler and no inline script** is added to `index.html`. Stage 5's content policy and its test pass unedited.
9. **Boundaries validate once.** A value that comes from the device or from pasted text is checked where it enters (`touchInput.ts`, `view.ts`, `importSaveText`). Code behind that point does not check it again.
10. **Commit messages** name a kind and the task: `test(T1): gesture sequences`, `feat(T2): gesture recogniser`, `style(L4): phone upright layout`, `docs(D1): touch section in the README`. One task, one commit.

### 0.4 Branches, worktrees, lanes

Lanes are cut from `feat/reach` after R0, PRE-1 and the spine task T0, each in its own worktree `../osrs-like-wp/S7-<lane>` on a local branch `rt/<lane>`. Lane branches are never pushed; only `feat/reach` goes to the remote. Workflow scripts live in `docs/superpowers/workflows/`, so a crash loses nothing.

| Lane | Tasks | Files it owns |
|---|---|---|
| **touch** | T1 to T7, then S1 to S3 | `src/state/gestures.ts`, `src/state/pick.ts`, `src/engine/touchInput.ts`, `src/engine/input.ts`, `src/ui/hud.ts`, `src/ui/stations.ts`, `src/ui/playerActions.ts`, `src/ui/sheets.ts`, their tests |
| **layout** | L1 to L7 | `index.html`, `src/ui/touch.css`, `src/ui/dock.ts`, `src/main.ts`, `tests/touch-css.test.ts` |
| **view** | V1 to V4, and W1 | `src/state/view.ts`, `src/engine/renderer.ts`, `src/engine/loop.ts`, `src/engine/phoneLife.ts`, their tests |

The three lanes share no file, with two stated exceptions: `boot` in `src/engine/runtime.ts` gains one call in T0 (before the lanes are cut), one in S2, one in L4 and one in V4, and L7 edits its two first-run chat lines (separate lines; the merge keeps them all); and V4 fetches two elements that L2 adds to `index.html`, so V4 starts after L2 has merged. Merge order: touch, layout, view. W2, the X tasks, D1, P1 and the gate run on `feat/reach` after all three.

### 0.5 Order of work

1. **Before any code**: O-1, then R0, TM-1, PRE-1. Then the spine task **T0** on `feat/reach`, because all three lanes read the input mode it provides.
2. **Three lanes in parallel**: touch (T1 to T7, S1 to S3), layout (L1 to L7), view (V1 to V4, W1). Inside a lane the tasks are serial.
3. **Merge** touch, layout, view into `feat/reach`, with SG after each.
4. **On `feat/reach`**: W2, then the tasks the owner said yes to (X0 to X5), then D1.
5. **Proof and gate**: P1, G-1, G-2, G-3 (W3 if it failed), O-9.

Model tiers: no task uses fable. Opus is used only for R0, TM-1, X0, G-1, the judging in W3, and the verify stage of every task. Everything else is haiku (the agy runner) or sonnet.

### 0.6 Owner and human steps (where they block)

| Step | What the owner decides or does | Blocks |
|---|---|---|
| O-1 | Approve the scope and the model: CALL-7.1 (what Stage 7 is), 7.2 (gestures), 7.3 (how it is built), 7.4 (fat-finger help), 7.5 (phone layout), 7.6 (smallest screen), 7.7 (upright camera), 7.8 (page zoom off), 7.14 (pause on return), 7.16 (phones start on Low), 7.18 (size). | Everything |
| O-2 | **CALL-7.17**: name the reference phone and tablet, and say whether an iPhone is available. | PRE-1's record, G-2 |
| O-3 | **CALL-7.9**: "Move this save", yes or no. | X0, X1, X2 |
| O-4 | **CALL-7.13**: full screen and the home-screen shortcut, yes or no (recommended only with O-3 yes). | X3, X4 |
| O-5 | **CALL-7.11**: seven taps into the hidden tools, yes or no. | X5 |
| O-6 | **CALL-7.10**: ask before selling equipment on touch, yes or no. | the question in S3 |
| O-7 | **CALL-7.12**: the buzz, yes or no. | the buzz in W2 |
| O-8 | **CALL-7.15**: measure the warnings on the phone, then 15% for everyone if it fails (or one of the two alternatives). | G-3, W3 |
| G-2 | [HUMAN] The device checklist of design 11.3. | O-9 |
| G-3 | [HUMAN] The warning measurement of design 9.2. | W3, O-9 |
| O-9 | Accept Stage 7. | the pull request |

If an owner answer is "no", the blocked task is skipped, or shrinks as stated inside it. No other task changes. O-3 to O-8 can be answered at any time before the task they block; none of them blocks the lanes.

---

## 1. Before any code

### R0 Premise re-check [CLAUDE]
- **Tier**: opus (it judges whether the design still stands on code it has not seen).
- **Depends**: O-1; Stages 3, 4 and 5 merged into `main`; `main` merged into `feat/reach`.
- **Files**: `docs/superpowers/baseline/s7-touch/premises.md` (new); this plan and the design (amendments only).
- **Change**: read the landed code and record, for each line below, "holds", or what is different and which task changes. Where a symbol or file name differs from this plan, amend the task's text so that every [AGY] task names real symbols before it is dispatched.
  - **From Stage 3** (design 9.1): the hidden tools are one block revealed by one function; is that function exported and free of any keyboard event? The first-run card, the chat footer, the Settings help and the first-run chat lines: their ids and where the text lives. The tracker's element ids. The guard that stops the unload save from writing an old character back after Reset (its F16): its name.
  - **From Stage 4** (design 9.2, R4.1 to R4.6): `TELEGRAPH_TIME_SCALE` exists and multiplies every wind-up. Where the "already-targeted monster within stop distance is a ground click" rule lives. Where the altar's vow entry is added, and the wording of its chat hint. Which events unlock audio. How the boss bar, banner and vignette are positioned. How the engine learns that a wind-up aimed at the hero started and whether one is live. The attack table's file and shape.
  - **From Stage 5** (design 9.3, R5.1 to R5.6): the delegated `data-action` listener and the event it handles. The token names. Whether hover rules are inside a hover media query. Where focus goes when a window opens. How the minimap is sized. The function that chooses the starting tier and the one that sets the pixel ratio. The automatic step-down's entry point. Which of its tests scan `styles.css`, and whether a second stylesheet can join their list. The exact policy string. The CSS and JS sizes after Stage 5 (the budget of design 10.3 is counted from them).
  - **From Stage 6**, if it has landed: each line of design 9.4, as "met" or "not met". A "not met" becomes a note to the owner, not a task of this plan.
  - **Still true at the new head**: every line of design 5.2 ("code" column), by symbol.
- **Accept**: `premises.md` has one row per premise. Every "different" row names the amended task. If a premise that a goal rests on has failed with no stated fall-back (design 9.2 and 9.3 give one for each requirement), the task stops and returns to the owner.
- **Must not change**: anything under `src/`, `tests/`, `index.html`.

### TM-1 Threat model review [CLAUDE]
- **Tier**: opus (security analysis).
- **Depends**: R0.
- **Files**: `docs/superpowers/baseline/s7-touch/threat-review.md` (new).
- **Change**: run the `appsec-threat-modelling` agent on design section 13 and on the landed code R0 read, as the owner's global rule requires before a new feature. Record its findings. A finding that changes a task amends that task; a finding the lead rejects is recorded with the reason.
- **Accept**: the file lists each finding with "applied in task X" or "rejected because".
- **Must not change**: anything under `src/`, `tests/`.

### PRE-1 Desktop baseline and touch-emulation probe [CLAUDE]
- **Tier**: sonnet (it drives the browser by a written recipe; judging is P1 and G-1).
- **Depends**: R0, O-2.
- **Files**: `docs/superpowers/baseline/s7-touch/README.md`, `desktop-boxes.json`, `probe.md`, `before-*.png` (all new).
- **Change**:
  1. Start `npm run dev` under the cap. Open the game in the Playwright MCP browser at 1280 by 720.
  2. Record in `desktop-boxes.json` the bounding box of every interface block (`#top-left-hud`, `#minimap-wrapper`, `#right-panel`, `#chatbox`, `#target-hud` with a target, an open `.modal-window`, `#context-menu` open at a fixed point) and take one screenshot of each state.
  3. **Probe touch emulation** and write the result in `probe.md`: can the session open a page with touch enabled and a mobile pixel ratio at 390 by 844; does a tap arrive as a pointer event with pointer type "touch"; can two fingers be driven (through the browser's debugging protocol); if not, does a synthetic `PointerEvent` with pointer type "touch" dispatched on the canvas reach a listener.
  4. Record the devices the owner named in O-2.
- **Accept**: the boxes file, the screenshots, and a `probe.md` that says which of the three ways P1 will use for one finger and for two.
- **Must not change**: anything outside `docs/superpowers/baseline/s7-touch/`.

---

### T0 Input mode (spine, on `feat/reach`, before the lanes are cut) [AGY]
- **Tier**: sonnet (one small module).
- **Depends**: PRE-1.
- **Files**: `src/engine/inputMode.ts` (new), `src/engine/runtime.ts` (one call in `boot`).
- **Change**: `inputMode.ts` exports `lastPointer(): 'mouse' | 'touch'` (a pen counts as touch); `isTouchSession(): boolean`; and `watchInputMode(): void`, called once from `boot`, which sets `data-input` on the root element from the "primary pointer is coarse" media query, then listens for `pointerdown` on the page in the capture phase, records the pointer type, and sets `data-input="touch"` the first time a finger or pen is seen. It never sets it back. Nothing runs at import time (`tests/architecture.test.ts` imports every module in node), and nothing is called from `setupInputHandlers` (rule 0.3.4).
- **Accept**: SG. In the browser with a mouse the root element has `data-input="mouse"`; nothing else in the game changes.
- **Must not change**: any existing listener.

---

## 2. Lane touch: gestures, picking, sheets

### T1 Gesture tests [CLAUDE]
- **Tier**: sonnet (tests written from design 6.2 and 11.1).
- **Depends**: PRE-1.
- **Files**: `tests/gestures.test.ts` (new).
- **Change**: the tests of design 11.1, row G7.2, against this contract:
  - `GESTURE = { slopPx: 10, longPressMs: 500, pinchSlopPx: 8 }`.
  - `initialGesture(): GestureState`.
  - `stepGesture(state, input, cfg = GESTURE): { state: GestureState; events: GestureEvent[] }`, where `input` is `{ type: 'down' | 'move' | 'up' | 'cancel', id, x, y, t }` or `{ type: 'tick', t }` or `{ type: 'reset' }`.
  - `GestureEvent` is one of `{ kind: 'tap', x, y }`, `{ kind: 'longPress', x, y }`, `{ kind: 'dragStart' }`, `{ kind: 'drag', dx, dy }`, `{ kind: 'dragEnd' }`, `{ kind: 'pinch', ratio }` (finger gap at the start divided by the gap now), `{ kind: 'pinchEnd' }`.
  - `longPressDueAt(state): number | null`, the time at which a tick would fire a long press, so the caller can set one timer.
  - A helper in the test turns a compact script (`'d1 0,0 @0; m1 11,0 @40; u1 @80'`) into inputs. The seeded random test uses a small fixed generator in the test file, no library.
- **Accept**: `ONE(tests/gestures.test.ts)` fails only with "Cannot find module '../src/state/gestures'".
- **Must not change**: any existing file.

### T2 Gesture recogniser [AGY]
- **Tier**: sonnet (a pure reducer against a complete test).
- **Depends**: T1.
- **Files**: `src/state/gestures.ts` (new).
- **Change**: implement the contract of T1 as a pure reducer. Phases: `idle`, `pressing` (one finger, inside the slop, before the time limit), `dragging`, `pinching`, `spent` (wait for every finger to lift, emit nothing). Rules of design 6.2: a tap is emitted on `up` from `pressing`; `tick` at or after `longPressMs` in `pressing` emits one `longPress` and goes to `spent`; the `move` that first leaves the slop emits `dragStart` with no `drag`, and later moves emit `drag` with the change since the previous sample; a second `down` in `pressing` or `dragging` goes to `pinching` (emitting `dragEnd` if it was dragging); `pinch` is emitted once the gap has changed by `pinchSlopPx`; an `up` in `pinching` emits `pinchEnd` and goes to `spent`; a third `down` is ignored; `cancel` and `reset` go to `idle` from any phase, emitting `dragEnd` or `pinchEnd` if one is open and never a `tap` or `longPress`; an `up` or `move` for an unknown id is ignored; a `t` earlier than the press start counts as no time passed. No timers, no globals, no imports. Rule 0.3.5 applies to every comment.
- **Accept**: `ONE(tests/gestures.test.ts)` passes, `ONE(tests/architecture.test.ts)` passes, then SG.
- **Must not change**: the test file.

### T3 Pick tests [CLAUDE]
- **Tier**: sonnet (tests written from design 6.3 and 11.1).
- **Depends**: PRE-1.
- **Files**: `tests/pick.test.ts` (new).
- **Change**: the tests of design 11.1, row G7.3, against this contract:
  - `PICK = { minRadiusPx: 24, tieBand: 0.1 }`.
  - `PickCandidate = { key: number; kind: 'monster' | 'station' | 'resource'; cx: number; cy: number; rPx: number; depth: number; current: boolean }`.
  - `assistedPick(tapX, tapY, candidates, opts: { pointer: 'mouse' | 'touch'; warningLive: boolean }, cfg = PICK): number | null` returns the `key` or `null`.
- **Accept**: `ONE(tests/pick.test.ts)` fails only with "Cannot find module '../src/state/pick'".
- **Must not change**: any existing file.

### T4 Assisted pick [AGY]
- **Tier**: sonnet (one pure function against a complete test).
- **Depends**: T3.
- **Files**: `src/state/pick.ts` (new).
- **Change**: implement `assistedPick`. Return `null` at once when `opts.pointer` is `'mouse'` or `opts.warningLive` is true. Drop candidates with `current` true. Effective radius is `max(rPx, minRadiusPx)`. Keep candidates whose distance from the tap is at most their effective radius; score each by distance divided by effective radius; the lowest score wins; scores within `tieBand` of the lowest are ordered monster, station, resource, then smaller `depth`. Rule 0.3.5 applies.
- **Accept**: `ONE(tests/pick.test.ts)` and `ONE(tests/architecture.test.ts)` pass, then SG.
- **Must not change**: the test file.

### T5 The right-click and tooltip guards [AGY]
- **Tier**: sonnet (four one-line edits).
- **Depends**: T0.
- **Files**: `src/engine/input.ts`, `src/ui/hud.ts`, `src/ui/stations.ts`.
- **Change**:
  - The three right-click handlers (`onGameContextMenu` in `input.ts`; the backpack slot's in `hud.ts`; the sell card's in `stations.ts`) gain one first line each: call `preventDefault()` and return when `lastPointer()` is `'touch'`.
  - `showItemTooltip` (`hud.ts`) returns at once when `lastPointer()` is `'touch'`, so the browser's made-up mouse events on a tapped slot leave no stuck card.
- **Accept**: SG. `ONE(tests/input-keys.test.ts)` passes unedited. `git diff` shows no other change inside the mouse and keyboard listeners.
- **Must not change**: the bodies of the existing listeners beyond the guards; any behaviour when `lastPointer()` is `'mouse'`.

### T6 Touch on the canvas [AGY]
- **Tier**: sonnet (wiring against a stated contract; R0 has written the landed symbol names into this task).
- **Depends**: T2, T4, T5.
- **Files**: `src/engine/touchInput.ts` (new), `src/engine/input.ts`.
- **Change**:
  - `touchInput.ts` exports `attachTouchInput(canvas)`. It registers `pointerdown`, `pointermove`, `pointerup`, `pointercancel` and `lostpointercapture` on the canvas, and resets on the page losing focus or being hidden. Every handler returns first when `e.pointerType === 'mouse'`. It validates each event once (finite `clientX` and `clientY`, else the event is dropped), feeds `stepGesture`, and keeps one timer set from `longPressDueAt`, cleared on every transition.
  - `pointerdown`: `preventDefault()`, `canvas.setPointerCapture(e.pointerId)` inside the handler, close an open options sheet.
  - Events to actions: `tap` calls the world-click function with the tap's coordinates, unless the hero is down; `longPress` calls the function that builds and opens the options list; `dragStart` and `dragEnd` set and clear `camState.isDragging`; `drag` applies `manualOffset -= dx * 0.007` and the pitch change `dy * 0.005` clamped to 0.12 and 1.15, using the same constants the mouse path uses (lift them into two named constants in `input.ts` that both paths read; the mouse listener's arithmetic is otherwise unchanged); `pinch` sets `camState.distance` to the distance at the pinch's start times `ratio`, clamped to 3.6 and 26.
  - **Picking.** `handleWorldClick` takes `(point: { clientX: number; clientY: number }, pointer: 'mouse' | 'touch' = 'mouse')`; a `MouseEvent` still fits the first argument, so the mouse call site is not edited. It gains the tolerance step of design 6.3: after its ray finds no monster, resource or station, and only when `pointer` is `'touch'`, it builds the candidate list from `G.worldInteractiveObjects` (live monsters, undepleted resources, stations), projecting each with `worldToScreenPos` and the object's hit-cylinder radius, marks the hero's current target, and calls `assistedPick` with the "warning live" answer from Stage 4. A returned key is then handled exactly as if the ray had hit it. The mouse call site passes nothing new and behaves as before.
  - **Stage 4's rule** ("a click on the monster already targeted, within stop distance, is a ground click"): if R0 found it outside `handleWorldClick`, move it inside so the tap gets it. If R0 found the altar's vow entry outside the list builder, move it into the list builder.
  - `setupInputHandlers` gains one line, `attachTouchInput(canvas)`. Nothing else is added there (rule 0.3.4).
- **Accept**: SG. `ONE(tests/input-keys.test.ts)` passes unedited. The opus verify reads the diff of the existing listeners and of `handleWorldClick` and confirms the only changes are the two named constants and the optional second argument, and that a call without it takes exactly today's path.
- **Must not change**: what a mouse click, drag, wheel or right click does; `G.worldInteractiveObjects`' contents.

### T7 Minimap scale [AGY]
- **Tier**: sonnet (one line).
- **Depends**: T6.
- **Files**: `src/engine/input.ts`.
- **Change**: in the minimap click handler, replace the fixed `scale = 0.55` by `0.55 * 198 / rect.width` (or the equivalent against the size Stage 5 left, as R0 recorded). At the desktop size the value is unchanged.
- **Accept**: SG. P1 later checks a minimap tap at 112 px.
- **Must not change**: the walk logic of the handler.

### S1 The options sheet's heading [AGY]
- **Tier**: sonnet.
- **Depends**: T6.
- **Files**: `src/engine/input.ts`.
- **Change**: move the label text of `handleWorldHover` into `worldLabelHtml(ud): string`, called by `handleWorldHover` (same output as today) and by the options list builder. `openChooseMenu` gains an optional last argument `headingHtml?: string`; when given, it creates one heading element above the list (by script; `index.html` is not edited) and removes it when the argument is absent. The builder passes `worldLabelHtml` for a monster, resource or station. The heading text comes only from the game's own tables.
- **Accept**: SG. The mouse hover tooltip's text is byte-identical (the opus verify compares the strings).
- **Must not change**: the options offered; the menu's position for a mouse.

### S2 Long press on the interface: item and description sheets [AGY]
- **Tier**: sonnet.
- **Depends**: S1.
- **Files**: `src/ui/sheets.ts` (new), `src/ui/playerActions.ts`, `src/engine/runtime.ts` (one call in `boot`).
- **Change**: `sheets.ts` exports `watchLongPress()`, called once from `boot`. It listens for pointer events on the page, ignores the mouse and the canvas, and runs a second `stepGesture` state. On `longPress` it finds the nearest ancestor of the pressed element that is a backpack slot, a bank or shop stack, a sell card, or carries a `title`:
  - an item: `openChooseMenu` with the item card (`itemCompareHtml`) as the heading and the rows "the slot's normal action" (which calls the same function the click calls), the sell choices of `showSellChooseMenu` when the shop is open, and Cancel;
  - a `title`: the title's text as the heading (set with `textContent`, never as HTML) and one row, OK.
  It then swallows the next `click` once (a capture-phase listener that stops it and removes itself, also removed after 700 ms). A `move` beyond the slop or a `pointercancel` (the browser took the touch to scroll) drops the press.
- **Accept**: SG. P1 checks that a long press on a slot opens the sheet and does not use the item.
- **Must not change**: what a tap or a click on any of these elements does.

### S3 The special bar, and the sell question [AGY]
- **Tier**: sonnet.
- **Depends**: S2; the sell question also needs O-6.
- **Files**: `src/ui/sheets.ts`, `src/ui/playerActions.ts`, `src/ui/stations.ts`.
- **Change**:
  - A click on the special-energy row of the vitals card calls `toggleSpecialAttack` (registered in `watchLongPress`'s set-up by element id; no inline handler).
  - The bank search box (created in `renderBankModal`, `stations.ts`) gets `inputmode="search"`, `enterkeyhint="search"`, `autocapitalize="off"` and `autocorrect="off"`, and Enter blurs it (design 7.6). If R0 found that opening a window focuses this box (R5.3 not met), the focus is skipped on a touch session.
  - If O-6 is yes: in the two places a tap sells one stack (`sellInventoryItem` when called from a backpack tap in the shop, and `reportSell` from a sell card), when `lastPointer()` is `'touch'` and the item's type is `equip`, open the sheet with "Sell <name> for <N> GP" and "Cancel" instead of selling; the first row sells. The price shown is computed by the function the sale itself uses. A mouse never sees the sheet. If O-6 is no, this part is skipped.
- **Accept**: SG. The frozen shop and sale tests pass unedited.
- **Must not change**: any sale's amount; any behaviour with a mouse.

---

## 3. Lane layout: the page on a small screen

Stage 5 rewrites `styles.css`. Every task here describes elements by id and by intent; R0 has recorded the landed token names, and the tasks use only those tokens for colour, line and type. No task in this lane edits `styles.css`.

### L1 CSS and markup scan [CLAUDE]
- **Tier**: sonnet (a text-scan test written from design 11.1).
- **Depends**: PRE-1.
- **Files**: `tests/touch-css.test.ts` (new).
- **Change**: the assertions of design 11.1, row "G7.5, G7.6", reading `index.html` and `src/ui/touch.css` as text. The "every rule is scoped" check splits `touch.css` into top-level blocks and accepts: an `@media` block whose query is one of the two phone queries, the wide-and-short query of design 7.4, or a hover or reduced-motion query; a rule whose every selector starts with `html[data-input="touch"]`; and the rules whose selectors are in a list named `GLOBAL_RULES` in the test (`html`, `body`, `html, body`, `#game-canvas-container`, `#pause-card`, `#reload-card`). The same scans Stage 5's tests apply to `styles.css` (no absolute URL, no `backdrop-filter`, no token from the two old families) are repeated here for `touch.css`.
- **Accept**: `ONE(tests/touch-css.test.ts)` fails only because `src/ui/touch.css` does not exist and the viewport tag is the old one.
- **Must not change**: any existing file.

### L2 Platform rules and the two cards [AGY]
- **Tier**: sonnet.
- **Depends**: L1.
- **Files**: `index.html`, `src/ui/touch.css` (new), `src/main.ts`.
- **Change**:
  - `index.html`: the viewport tag becomes `width=device-width, initial-scale=1.0, viewport-fit=cover`. Add two hidden blocks beside `#death-overlay`, built like it: `#pause-card` ("Paused. Tap to continue.") and `#reload-card` ("The 3D view was lost. Your progress is saved." with one button, `#reload-btn`). No handler attribute.
  - `main.ts`: import `./ui/touch.css` after the existing stylesheet.
  - `touch.css`, global rules only: `html, body { height: 100vh; height: 100dvh; overscroll-behavior: none; touch-action: pan-x pan-y; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }`; `#game-canvas-container { touch-action: none; }`; the two cards' base style (hidden unless shown, centred, inside the safe areas).
- **Accept**: SG; the platform assertions of `tests/touch-css.test.ts` pass (the layout ones may still fail until L6). Stage 5's policy and markup tests pass unedited.
- **Must not change**: any other tag or element of `index.html`; `styles.css`.

### L3 Finger-sized controls [AGY]
- **Tier**: sonnet.
- **Depends**: L2.
- **Files**: `src/ui/touch.css`.
- **Change**: under `html[data-input="touch"]` only: a minimum of 44 by 44 px for tab buttons, window close buttons, the compass (padding around the visible badge), quantity and filter pills, quick-sell and batch-buy buttons, Settings buttons, and every button inside a window; a minimum height of 44 px for backpack, bank and shop slots and of 48 px for the rows of the options sheet; the options sheet drawn along the bottom edge (full width up to 420 px, above `env(safe-area-inset-bottom)`), overriding the left and top that `openChooseMenu` sets; text boxes at 16 px; the keyboard-hint line under the chat hidden. If R0 found hover rules outside a hover media query (R5.1 not met), neutralise each of them here.
- **Accept**: SG. No rule in this task is outside `html[data-input="touch"]`.
- **Must not change**: anything a mouse session renders.

### L4 Phone upright [CLAUDE]
- **Tier**: sonnet (layout tuned against the browser at four sizes; it cannot be specified to the pixel in advance). The verify is opus.
- **Depends**: L3.
- **Files**: `src/ui/touch.css`, `src/ui/dock.ts` (new), `index.html` (the More button and its sheet only), `src/engine/runtime.ts` (one call in `boot`).
- **Change**: the layout of design 7.2 inside `@media (max-width: 749px) and (min-height: 500px)`:
  - vitals reduced to three bars, top left; tracker as one line; target display under it; minimap 112 px top right with compass and coins; the three top buttons, the Slayer widget, the performance readout and the tick meter not shown;
  - the tab bar as a dock across the bottom with a seventh button, More; `#right-panel` as a sheet above it, at most 52% of the height, closed when it has the class `collapsed`;
  - chat as three lines above the dock with `pointer-events: none` and a dark strip; XP drops and banners under the top block;
  - every block inset by the safe areas.
  - `dock.ts` exports `watchDock()`, called from `boot`: a capture-phase click listener on the tab bar that adds `collapsed` to the panel when the clicked tab is already the open one and the panel is open, and removes it otherwise; it sets `collapsed` at start; a `keydown` listener removes `collapsed` on F1 to F6, so the keys never switch a panel that is closed; the More button opens a short sheet (through `openChooseMenu`) with World Map, Quests, Settings and Messages, each calling the function the existing buttons call; Messages shows the chat log full height until it is tapped again. The `collapsed` class has no style outside the two phone queries.
  - The performance readout is shown again while the hidden tools are revealed (the selector R0 recorded for the revealed state).
- **Accept**: SG. In the browser at 360 by 560, 360 by 640, 390 by 844 and 700 by 900 with touch: no two blocks overlap, nothing is outside the viewport, every control measures at least 44 by 44, no text is under 12 px, the backpack shows 4 by 7. At 1280 by 720 the boxes equal `desktop-boxes.json`. At 700 by 900 with a mouse, F3 opens the backpack.
- **Must not change**: `styles.css`; `switchTab`; the desktop layout at 750 px wide and above.

### L5 Phone on its side [CLAUDE]
- **Tier**: sonnet (as L4).
- **Depends**: L4.
- **Files**: `src/ui/touch.css`.
- **Change**: the layout of design 7.3 inside `@media (max-height: 499px)`: minimap 96 px; dock at the bottom right, panel sheet 336 px wide above it; the backpack grid 7 columns by 4 rows; chat at most 45% of the width. Also the one rule of design 7.4 for the wide layout under 740 px of height (minimap at 150 px).
- **Accept**: SG. In the browser at 640 by 320, 640 by 360 and 844 by 390 with touch: the same four measurements as L4, and the backpack shows 28 slots in 7 by 4, in order. At 1024 by 690 with touch the minimap and the panel do not touch.
- **Must not change**: the upright rules; the desktop layout.

### L6 Windows as full-screen sheets [CLAUDE]
- **Tier**: sonnet (as L4).
- **Depends**: L5.
- **Files**: `src/ui/touch.css`.
- **Change**: in both phone queries, design 7.5: every `.modal-window` fills the viewport inside the safe areas, with a heading that stays on top and a body that scrolls with `overscroll-behavior: contain`; bank and shop panes stacked, the vault grid at most 36% and each backpack grid at most 30% of the height, each with its own scroll; forge, world map and quest cards one per row; Settings in two columns; the XP table in three; the death notice and the first-run card at most 90% wide.
- **Accept**: SG; `ONE(tests/touch-css.test.ts)` passes in full. In the browser at 360 by 560 and 640 by 320: each of the seven windows opens, scrolls to its last element, and closes by its button; with the bank open, focusing the search box leaves the box and at least two rows of the vault visible.
- **Must not change**: any window at the wide layout.

### L7 Words for touch [CLAUDE]
- **Tier**: sonnet (text the player reads).
- **Depends**: L6.
- **Files**: `index.html`, `src/ui/touch.css`, `src/engine/runtime.ts` (the two first-run chat lines).
- **Change**: for each text of design 5.2 row 28 as Stage 3 left it, add a second wording for touch beside it (classes `for-mouse` and `for-touch`; `touch.css` shows one or the other from `data-input`, and the default without the attribute is the mouse wording). The touch wording of the first-run card is the paragraph in design 7.7, plus one line: "Your character is saved on this device." If O-3 is yes, it adds "Settings has 'Move this save'." The two chat lines are chosen in `boot` by `isTouchSession()`.
- **Accept**: SG. Stage 3's text tests pass unedited. In the browser with touch the card shows the touch wording; with a mouse it shows exactly what it showed before this task.
- **Must not change**: the mouse wording.

---

## 4. Lane view: camera, tier, and the phone's life

### V1 View tests [CLAUDE]
- **Tier**: sonnet (tests written from design 7.8, 10.1, 10.2 and 11.1).
- **Depends**: PRE-1.
- **Files**: `tests/view.test.ts` (new).
- **Change**: the tests of design 11.1, row G7.8, against this contract (R0 has replaced the tier names and the pixel-budget signature with the landed ones):
  - `fovForAspect(aspect: number): number`, in degrees.
  - `startTier(device: { coarse: boolean; shortSidePx: number; software: boolean }): QualityTier`.
  - `pixelRatioFor(tierCap: number, deviceRatio: number, cssW: number, cssH: number, floorOn: boolean): number`.
  - `frameDue(nowMs: number, lastDrawnMs: number, capFps: number | null): boolean`.
  - `UPRIGHT_MIN_DISTANCE = 10`.
- **Accept**: `ONE(tests/view.test.ts)` fails only with "Cannot find module '../src/state/view'".
- **Must not change**: any existing file.

### V2 View functions [AGY]
- **Tier**: sonnet.
- **Depends**: V1.
- **Files**: `src/state/view.ts` (new).
- **Change**: the four functions. `fovForAspect`: 50 when the aspect is not a finite positive number or is at least 0.78; otherwise `2 * atan(tan(20 degrees) / aspect)` in degrees, clamped to 50 and 75. `startTier`: the lowest tier when `software` is true or when `coarse` is true and `shortSidePx` is under 600; otherwise the default tier. `pixelRatioFor`: clamp `deviceRatio` to 1 and 4 (1 when it is not finite); the base is `min(deviceRatio, tierCap)`; when `floorOn` is true and `cssW * cssH` is under 600,000, the result is `max(base, min(deviceRatio, 2, sqrt(1,000,000 / (cssW * cssH))))`; a non-finite or non-positive size gives the base. `frameDue`: true when `capFps` is null or at least `1000 / capFps - 1.5` ms have passed. Each validates its inputs once and returns a value in range for any input. Rule 0.3.5 applies.
- **Accept**: `ONE(tests/view.test.ts)` and `ONE(tests/architecture.test.ts)` pass, then SG.
- **Must not change**: the test file.

### V3 Wire the view [AGY]
- **Tier**: sonnet.
- **Depends**: V2.
- **Files**: `src/engine/renderer.ts`, `src/engine/loop.ts`.
- **Change**:
  - `onWindowResize` and the camera's creation set `G.camera.fov = fovForAspect(aspect)` before `updateProjectionMatrix()`.
  - At start, and on a resize that turns the viewport upright (aspect under 0.78 where it was not), `camState.distance = max(camState.distance, UPRIGHT_MIN_DISTANCE)`.
  - The starting tier comes from `startTier` through the function R0 recorded; the pixel ratio from `pixelRatioFor` with `floorOn` true on a touch session, wrapped around Stage 5's megapixel cap, which still applies last.
  - The automatic step-down, when it fires on the lowest tier on a touch session, sets `floorOn` false once and prints one chat line.
  - `gameLoop` returns before stepping or drawing when `frameDue` is false, with a cap of 60 on a touch session and no cap otherwise. `G.lastFrameTime` is advanced only on frames that run, so the step size stays right.
- **Accept**: SG. Stage 5's tier tests pass unedited. In the browser at 1280 by 720 the field of view is 50 and the pixel ratio equals the tier's own; at 390 by 844 with touch the field of view is 75, the distance is at least 10 and about one megapixel is drawn.
- **Must not change**: any tier's features; `sanitizeCam`; the step cap of 0.08 s.

### V4 The phone's life [AGY]
- **Tier**: sonnet.
- **Depends**: V3; L2 merged (the two cards).
- **Files**: `src/engine/phoneLife.ts` (new), `src/engine/runtime.ts` (one call in `boot`), `src/engine/loop.ts`.
- **Change**: `phoneLife.ts` exports `watchPhoneLife()`, called from `boot`:
  - `pagehide` runs `saveGameState`, as `visibilitychange` already does.
  - After the first successful save, call `navigator.storage.persist()` when it exists; the answer is ignored and a rejection is caught and logged once.
  - `webglcontextlost` on the canvas: `preventDefault()`, save, show `#reload-card`; `#reload-btn` reloads the page.
  - If O-1 took CALL-7.14: when the page becomes visible after more than 3 s hidden on a touch session, show `#pause-card` and set a flag; `gameLoop` returns before stepping or drawing while the flag is set; a tap on the card clears it and sets `G.lastFrameTime` to now.
- **Accept**: SG. In the browser: hiding and showing the page for 4 s with touch shows the card and no world time passes behind it (a monster's position is equal before and after); the same with a mouse shows no card.
- **Must not change**: the existing `visibilitychange` and `beforeunload` saves.

### W1 Warning timing and reaction log tests [CLAUDE]
- **Tier**: sonnet (tests written from design 9.2 and 11.1).
- **Depends**: V1; Stage 4's attack table as R0 recorded it.
- **Files**: `tests/touch-timing.test.ts` (new).
- **Change**: (a) from Stage 4's attack table and its own escape-distance function, recompute "spare" for every heavy attack and assert the numbers of design 9.2's table for the mouse column (this pins the premise), then assert that with the scale at 1.15 and 250 ms added to the person every row keeps at least 200 ms; (b) the contract of the log: `createReactionLog(size = 64)`, `noteWarning(log, { attackId, startMs, windupMs })`, `noteAnswer(log, atMs)` (the first answer after the latest open warning counts; later ones are ignored), `noteResolve(log, { hit })`, `allowanceMs(attack)` (Stage 4's Margin for that attack plus 500, computed from the attack table), `summarise(log, allowances): Array<{ attackId, warnings, cleared, medianMs, inside }>`; the ring never holds more than its size; a summary of an empty log is an empty list; an attack with no answer counts as not inside.
- **Accept**: part (a) passes at once (it tests Stage 4's data); part (b) fails only with "Cannot find module '../src/state/reactions'".
- **Must not change**: any existing file.

### W2 Reaction log, its line in Settings, and the buzz [AGY] (runs after the merge)
- **Tier**: sonnet.
- **Depends**: W1; the three lanes merged (it runs on `feat/reach`).
- **Files**: `src/state/reactions.ts` (new), `src/engine/phoneLife.ts`, `src/engine/touchInput.ts` and `src/ui/sheets.ts` (the buzz call on a long press), `src/engine/input.ts` (one call where a walk order is accepted), the engine file where Stage 4 handles the wind-up and resolve events (R0 names it).
- **Change**: `reactions.ts` implements W1's contract, pure. The engine calls `noteWarning` when a wind-up aimed at the hero starts, `noteAnswer` when a walk order is accepted, `noteResolve` when it lands. While the hidden tools are revealed, the tools block shows one text line per attack seen ("Tail Sweep: 8 of 10 cleared, typical answer 810 ms, allowance 789 ms, 5 of 10 inside it"), written with `textContent`. `window.__DEBUG.touch` exposes the log for the remote inspector. If O-7 is yes: `buzz(ms)` calls `navigator.vibrate(ms)` when it exists and the browser does not ask for reduced motion; 10 on a recognised long press, 20 when a wind-up aimed at the hero starts. Nothing is stored and nothing is sent.
- **Accept**: SG; `ONE(tests/touch-timing.test.ts)` passes in full.
- **Must not change**: any timing, any rule, any Stage 4 file beyond the calls named.

---

## 5. After the lanes merge: tasks that depend on an owner answer

### X0 Threat review of the save transfer [CLAUDE]
- **Tier**: opus (security analysis of a new trust boundary).
- **Depends**: O-3 yes; TM-1.
- **Files**: `docs/superpowers/baseline/s7-touch/threat-review.md` (append).
- **Change**: with the landed `save.ts` in hand, confirm that `migrateLegacySave` reads only keys it names and builds its result from a fresh default state (at `15b3667` it does, lines 30-135), that nothing in the load path writes pasted text as HTML, and that Stage 3's unload guard covers a load followed by a reload. List anything the reader does not clamp.
- **Accept**: a written "safe to build on as is", or the amendments to X1 and X2.
- **Must not change**: anything under `src/`, `tests/`.

### X1 Save transfer tests [CLAUDE]
- **Tier**: sonnet (tests written from design 8.4 and 11.1).
- **Depends**: X0.
- **Files**: `tests/save-transfer.test.ts` (new).
- **Change**: the tests of design 11.1, row "CALL-7.9", against: `IMPORT_MAX_CHARS = 262144`; `importSaveText(text: unknown): { ok: true; save: MigratedSave } | { ok: false; reason: string }`; `exportSaveText(state, pose, cam): string` (the same string `serializeState` returns). It reuses `tests/fixtures/save-hostile.json` and compares against what `migrateLegacySave` returns for it, so it inherits every expectation of the existing hardening test without copying them.
- **Accept**: fails only with "has no exported member 'importSaveText'".
- **Must not change**: any existing file.

### X2 "Move this save" [AGY]
- **Tier**: sonnet.
- **Depends**: X1.
- **Files**: `src/state/save.ts`, `src/engine/session.ts`, `index.html` (one button and one window in Settings), `src/ui/touch.css` if a rule is needed.
- **Change**:
  - `save.ts`: `importSaveText` and `exportSaveText`, added below the existing functions; no existing function is edited. `importSaveText` returns a reason for a non-string, an empty string, a string over the limit, text that does not parse, and a parsed value that is not a plain object; otherwise it returns `migrateLegacySave(parsed, SAVE_KEY)`.
  - `session.ts`: `copySaveText()` fills a read-only text box with the export and tries the clipboard, falling back to selecting the text; `loadSaveText()` reads the paste box, shows the reason in a text node on failure, and on success asks with the browser's own confirmation, copies the current raw save to the key `gielinor_hero_save_v1_before_import`, writes the validated result with `writeSave`, sets Stage 3's unload guard and reloads.
  - `index.html`: a "Move this save" button in Settings that opens a window with the two boxes and the two buttons, wired the way Stage 5 wires every button (no inline handler). Text boxes at 16 px.
- **Accept**: SG; `ONE(tests/save-transfer.test.ts)` passes; every frozen save test passes unedited. In the browser: copy, reset, paste, load gives the same character back; pasting `hello` shows a reason and changes nothing.
- **Must not change**: the save format; `readSave`, `writeSave`, `migrateLegacySave`, `sanitizePose`, `sanitizeCam`.

### X3 Manifest test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: O-4 yes.
- **Files**: `tests/manifest.test.ts` (new).
- **Change**: the test of design 11.1, row "CALL-7.13": `public/manifest.webmanifest` parses; `start_url` and `scope` are `/`; `display` is `standalone`; each icon path exists under `public/`; `index.html` links the manifest and an apple touch icon; no file under `src/` contains "serviceWorker".
- **Accept**: fails only because the manifest does not exist.
- **Must not change**: any existing file.

### X4 Full screen and the home-screen shortcut [CLAUDE]
- **Tier**: sonnet (the icons are rendered in the browser from the existing shield mark, which is not an agy job).
- **Depends**: X3; X2 merged (design 8.6: only together with the save transfer).
- **Files**: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (all new), `index.html`, `src/engine/phoneLife.ts`, `CREDITS.md` only if its test requires a row for new images.
- **Change**: render the three icons from the favicon's own SVG (`index.html` 28) on the game's dark ground with the Playwright MCP browser; write the manifest (name, short name, the theme colour `index.html` already declares, `display: standalone`, `start_url` and `scope` `/`, the two icons); add the manifest link, the apple touch icon link and the two tags an iPhone needs for a standalone page; add a "Full screen" button to Settings, shown by `watchPhoneLife` only when `document.fullscreenEnabled` is true, that toggles full screen on the root element.
- **Accept**: SG; `ONE(tests/manifest.test.ts)` passes; Stage 5's policy test passes unedited; `vercel.json` is not edited.
- **Must not change**: caching headers; anything that would register a service worker.

### X5 Seven taps into the hidden tools [AGY]
- **Tier**: sonnet.
- **Depends**: O-5 yes.
- **Files**: `src/ui/sheets.ts`, `src/engine/session.ts` only if R0 found the reveal function unexported.
- **Change**: a click counter on the Settings window's title: seven clicks within 3 s call Stage 3's reveal function; the count resets after 3 s or when the window closes. Nothing is stored. The comment names no word and no code.
- **Accept**: SG. Stage 3's "no leak" text test passes unedited. In the browser, seven quick taps reveal the block and a reload hides it.
- **Must not change**: the typed word; `matchCheat`; what the block contains.

### D1 README [CLAUDE]
- **Tier**: sonnet (text the public reads).
- **Depends**: the lanes merged; X2 and X4 if taken.
- **Files**: `README.md`.
- **Change**: a "Touch" section: the four gestures; the smallest supported screen; that a save belongs to one browser on one device, and "Move this save" if it exists; that the game can be added to the home screen, if it can; which devices it was checked on (after G-2). No mention of the hidden tools.
- **Accept**: SG (the credits and README tests pass unedited).
- **Must not change**: any other section.

---

## 6. Proof and gate

### P1 Browser check at phone sizes [CLAUDE]
- **Tier**: sonnet to run the recipe; the pictures and numbers are judged in G-1.
- **Depends**: the three lanes merged; X2, X4, X5 if taken.
- **Files**: `docs/superpowers/baseline/s7-touch/after-<size>-<state>.png`, `report.md` (new).
- **Change**: design 11.2 in full, by the way `probe.md` chose: every viewport it lists; the behaviours read through `window.__DEBUG`; the four measurements at each phone size; the desktop boxes against `desktop-boxes.json`; screenshots of the HUD with the panel closed and open, each window, the options sheet, the item sheet, the pause card and the death notice at each size. `report.md` lists every measurement and every miss.
- **Accept**: `report.md` exists and has no unexplained miss. A miss is fixed in the lane that owns the file and P1 is run again.
- **Must not change**: anything outside `docs/superpowers/baseline/s7-touch/`.

### G-1 Stage 7 verification [CLAUDE]
- **Tier**: opus (verification).
- **Depends**: P1, D1.
- **Files**: none (read-only; a written report in the session).
- **Check**:
  1. SUITE, TYPES and BUILD pass.
  2. `git diff <R0 head> -- tests src/__tests__` shows only new files. No assertion anywhere was weakened, skipped or marked todo.
  3. `git diff <R0 head> -- package.json package-lock.json` is empty.
  4. The diff of the existing input code is exactly the list of rule 0.3.4, and each item gives a mouse or a key today's result. P1's desktop section (click, right-drag, wheel, right click, hover, F1 to F6) passed.
  5. `grep -rn "userAgent\|touchstart\|touchmove\|touchend\|serviceWorker" src index.html` finds nothing (or only what Stage 4 landed for audio, as R0 recorded).
  6. JS grew by at most 12 kB and CSS by at most 8 kB over the sizes R0 recorded.
  7. Every goal G7.1 to G7.10 maps to a passing proof (section 7 below).
  8. Every premise row of `premises.md` and every finding of `threat-review.md` is closed.
  9. `report.md` of P1: read every screenshot; the desktop boxes are equal.
  10. No commit on the branch carries an attribution trailer.
- **Accept**: a written pass.
- **Must not change**: anything; the task is read-only.

### G-2 Device checklist [HUMAN]
The twenty items of design 11.3, on the phone and the tablet named in O-2, upright and on its side, each answered yes or no with a note. A "no" on items 1 to 11 or 15 to 17 blocks acceptance and goes back to the lane that owns the file; a constant in `GESTURE`, `PICK` or `view.ts` is the expected kind of fix, and T1, T3 or V1 is extended first. Item 18 (heat, battery, frame time) is judged against the budgets of design 10.3: a miss on the frame budget tries the step below Low, then a 30-frame cap, then returns to the owner. If no iPhone was available, the README says which devices were checked and the iPhone lines of design section 16 stay open in writing.

### G-3 Warning measurement [HUMAN] + [OWNER]
After Stage 4 is in the build: item 12 of the checklist, with the Settings line. The pass rule is in design 9.2: for each of three ordinary monsters and for the boss, 9 of 10 warnings cleared and three of four answers inside that warning's allowance. The owner records pass or fail per attack.

### W3 Longer warnings, only if G-3 failed [AGY] + [CLAUDE]
- **Tier**: sonnet for the edit; opus to re-run and judge Stage 4's proofs.
- **Depends**: G-3 recorded as failed; O-8 as recommended.
- **Files**: the file that holds `TELEGRAPH_TIME_SCALE`; Stage 4's committed model outputs.
- **Change**: set the constant to 1.15. Re-run Stage 4's model scripts and its tests. This is the remedy Stage 4's own CALL-4.16 names, for every player.
- **Accept**: SG. Stage 4's proofs hold at 1.15, or the rows that move are listed for the owner with their new values. G-3 is run again on the phone.
- **Must not change**: any attack row; any other constant.

### O-9 Accept Stage 7 [OWNER]
The owner accepts after G-1, G-2 and G-3 (and W3 if it ran). The main session opens the pull request and merges after CI is green.

---

## 7. Coverage

### 7.1 Goals to proofs

| Goal | Proof task(s) |
|---|---|
| G7.1 every action by touch | T6, S2, S3, L4 (More), P1, G-2 items 1 to 14 |
| G7.2 one recogniser | T1, T2 |
| G7.3 picking | T3, T4, T6, G-2 items 2 and 3 |
| G7.4 nothing by hover only | S1, S2, T5, P1 ("no stuck tooltip"), G-2 item 8 |
| G7.5 fits from 360 by 560 | L1, L4, L5, L6, P1, G-2 items 7 and 9 to 11 |
| G7.6 the browser takes nothing | L1, L2, G-2 items 6 and 15 |
| G7.7 warnings by thumb | W1, W2, G-3, W3 |
| G7.8 frame rate, heat, being put away | V1 to V4, G-2 items 16 and 18 |
| G7.9 mouse and keyboard unchanged | rule 0.3.4, G-1 steps 2 and 4, P1 desktop boxes, G-2 item 20 |
| G7.10 no dependency, policy intact | G-1 steps 3 and 5 |

### 7.2 Owner decisions to tasks

| Decision | If yes | If no |
|---|---|---|
| CALL-7.9 save transfer | X0, X1, X2 | skipped; L7 drops its sentence; X4 is not recommended |
| CALL-7.10 sell question | the second part of S3 | that part is skipped |
| CALL-7.11 tools on touch | X5 | skipped; G-3 needs a carried-over save or a character played up on the phone |
| CALL-7.12 buzz | the buzz in W2 | that part is skipped |
| CALL-7.13 full screen, home screen | X3, X4 | skipped |
| CALL-7.14 pause on return | the pause part of V4 | that part and `#pause-card` are skipped |
| CALL-7.15 warnings | G-3, then W3 on a fail | "now, for everyone": W3 runs without G-3. "Touch only": a new task, not planned here, and Stage 4's models must prove both scales. |
| CALL-7.16 phones start on Low | V2, V3 as written | V3 keeps Stage 5's start tier and ratio; only the field of view, the floor on distance and the frame cap remain |

### 7.3 Requirements on other stages to where they are checked

| Requirement | Checked in | If not met |
|---|---|---|
| R4.1 one time scale | R0 | W3 has nothing to set; returns to the owner |
| R4.2 same-target rule in the shared path | R0 | T6 moves it |
| R4.3 vow entry in the list builder, neutral hint | R0 | T6 moves it; L7 adds a touch wording |
| R4.4 audio unlock on the finger's lift | R0, G-2 item 17 | V4 adds a `pointerup` listener that calls the same unlock |
| R4.5 boss bar by CSS | R0 | L4 places it by its id |
| R4.6 wind-up start and "live" query | R0 | W2 and T6 add the smallest hook Stage 4's events allow |
| R5.1 hover inside a hover query | R0 | L3 neutralises |
| R5.2 delegated `click` | R0 | none needed if it is `click`; otherwise returns to the owner |
| R5.3 no focus into the search box | R0, P1 | the guard in S3 |
| R5.4 minimap sized from its CSS size | R0 | L4 keeps the minimap at its landed size and shrinks it with a transform; T7 follows |
| R5.5 one function each for start tier and pixel ratio | R0 | V3 wraps the call sites |
| R5.6 its CSS scans can take a second file | R0 | L1 repeats the scans (it does so anyway) |
| Stage 6, design 9.4 | R0 if landed; otherwise sent to that stage's design now | a note to the owner |

---

# Review log

No independent critique has been run on this plan. Run one, with the design, before asking for approval. Nothing in this plan was executed: no test, no build, no dev server, no browser.
