# Reach, touch controls: design

Date: 2026-11-14. Branch: `feat/reach`, at `15b3667` (main with Stages 1 and 2 merged). All line numbers refer to that commit, and every one is given with a symbol name, because Stages 3, 4 and 5 land before this stage and will move the lines.

Status: proposal. The owner has not reviewed any of it. Every decision marked **CALL-7.n** is the lead's proposal and needs the owner's check (section 14). Nothing here has been agreed.

Inputs read for this document: `src/engine/input.ts`, `audio.ts`, `renderer.ts`, `session.ts`, `runtime.ts`, `context.ts`, `overlay.ts` (the projection helpers), `monsterMeshes.ts`, `humanoid.ts` and `spawns.ts` (the hit volumes), the timing and intent parts of `loop.ts`; `src/ui/hud.ts`, `playerActions.ts`, `stations.ts`, `styles.css`; `index.html`; `src/state/save.ts`; `tests/input-keys.test.ts`, `architecture.test.ts`, `globals.test.ts`, `source-limits.test.ts`; `vercel.json`, `package.json`, `vite.config.ts`; the Stage 1-2 design and plan (for format); the shelved compression design; the capture notes in `docs/superpowers/baseline/g4/README.md`; and the three reference copies of the approved designs for Stage 3 ("Start and pacing"), Stage 4 ("Combat with weight") and Stage 5 ("Visual pass").

**Nothing was run**: no test, no build, no dev server, no browser, no phone. Every statement about how a browser or a device behaves comes from the platform's published behaviour and from reading this code. Section 16 lists what only a device can settle.

This document covers one stage:

- **Stage 7: Reach.** The owner's sentence: "touch controls and lightweight loading (model compression)". The compression half was designed, measured and shelved by the owner on 2026-11-14 (section 2). So Stage 7 is: **the game fully playable on a phone and a tablet with touch only, and well on a small screen.**

**Merge order this design assumes.** Stages 3, 4 and 5 land before Stage 7. Stage 6 is being designed in parallel and may land before or after. Plan task R0 re-checks every premise of section 9 against the code that actually landed, before any code of this stage.

---

## 1. Intent and why

The game is click-to-act: click the ground to walk, click a thing to walk up to it and act. That maps onto a touch screen better than almost any other control scheme. A tap is a click. But today the game is built for a mouse with two buttons, a wheel and a keyboard, on a wide screen, and four things break on a phone.

1. **Half the inputs have no touch form.** The camera turns with a right-button drag (`input.ts` 115-139) or Q and E (`loop.ts` 136-137) and zooms with the wheel (`input.ts` 149-151). A phone has none of the three, so the camera cannot be moved at all. The options menu is a right click (`onGameContextMenu`, `input.ts` 255-350). Everything a player learns by pointing without clicking (what a monster is, its level and health, what an item does, what a prayer does) is on hover (`handleWorldHover`, `input.ts` 194-237; `showItemTooltip`, `hud.ts` 426-432) or in a `title` attribute (`hud.ts` 236, 262, 297, 338, 355), and a finger does not hover.
2. **What works, works by accident.** A tap reaches the game only because browsers send made-up mouse events after a touch. The tap therefore walks (`mousedown`, `input.ts` 115-128), and it also fires the hover code once, which leaves a tooltip stuck on the screen (nothing ever sends the matching "mouse left").
3. **The screen does not fit.** The vitals card is 292 px wide (`styles.css` 330, 386) and the minimap block 240 px (527); together they are wider than a 360 px phone. The panel is 268 by 432 px (592-593) and the chat 440 by 162 px (877-878), both pinned to the bottom. The whole stylesheet has one media query (1823). The page is `100vh` tall (31-35), which on a phone is taller than what the browser shows, so the bottom of the interface sits under the browser's bar.
4. **The browser fights the game.** Nothing tells the browser that a drag on the 3D view is the game's: there is no `touch-action` anywhere in the CSS. A pinch zooms the page, a pull down reloads it, a long press starts the system's own menu.

Stage 7 gives every input a touch form, makes the interface fit the hand, and tells the browser what belongs to the game. It does it without changing what a mouse and a keyboard do.

### Essence to preserve (CALL-7.1)

- Skills on the existing XP curve; a 28-slot backpack; bank, shops, forge; the faceted look. Stage 7 touches none of their rules.
- **Click-to-act.** Touch gets tap-to-act. No virtual joystick, no action buttons, no auto-aim (section 6.2 says why for each).
- Existing saves keep loading. No saved field is added, removed or renamed.
- Mouse and keyboard play is unchanged: every listener that exists today stays and behaves as it does today, and no existing test is edited.

---

## 2. The shelved half: model compression

`docs/superpowers/specs/2026-11-14-reach-compression-design.md` holds the design. The owner shelved it: the site already serves the models with Brotli (3.76 MB on the wire against 11.9 MB on disk), and a saving of about 1.2 MB did not pay for a build step and a decoder. Nothing here redoes it, and audit finding 27 stays deferred.

**When to revive it.** After a later stage that adds or grows models (a "models pass"), measure again with that design's own method. Revive it if either is true:

- the models weigh **more than 6.0 MB on the wire** (Brotli, summed over the model files as the deployment serves them). At the measured ratio that is the point where the saving reaches about 2 MB per first load; or
- the **memory budget of section 10 fails on the reference phone** and the geometry is the cause (quantised attributes also shrink what the GPU holds, which Brotli does not).

Otherwise leave it shelved. Audit findings 3 and 39 (the Blender scripts) were fixed after Stage 1, and finding 29 is fixed by Stage 5; none of them is owed here.

---

## 3. Constraints

| # | Constraint | Consequence |
|---|---|---|
| T1 | Mouse and keyboard play must not get worse. Existing tests are frozen. | The mouse and keyboard listeners in `setupInputHandlers` keep their behaviour. Touch is added beside them and acts only on pointers that are not a mouse (section 6.1 says exactly which lines of the existing code are edited). |
| T2 | `tests/input-keys.test.ts` calls `setupInputHandlers` with a canvas stub that has only `addEventListener` and `classList` (lines 8-10). | Nothing added to `setupInputHandlers` may touch `canvas.style`, `setPointerCapture`, `matchMedia` or any other member at set-up time. Browser hints go in CSS; pointer capture happens inside an event handler. |
| T3 | `tests/architecture.test.ts` forbids files under `src/state` to import the engine, the interface or three.js, **and to contain the words "document" or "window" anywhere, comments included**. | The gesture rules live in `src/state` as pure functions of numbers. Their text says "reaction time" and "time limit", never the second forbidden word. The plan repeats this in every task that writes there. |
| T4 | Vitest runs in `node` with no DOM (`vite.config.ts`). No new dependency, runtime or development. | What is proved automatically is DOM-free: gesture sequences as arrays of numbers, text scans of the CSS and the markup. The browser check uses the Playwright MCP browser that made the earlier captures (it is session tooling, not a package: `package.json` has no such entry). |
| T5 | Touch can only be judged in the hand. | Every goal has an automated proof and a line in the owner's device checklist (section 11). The stage is not accepted on the automated part alone. |
| T6 | The save is in `localStorage`, per browser and per device. | A phone starts a new game. Section 8.4 says so plainly and proposes a way to carry a save across. |
| T7 | Stages 3, 4 and 5 are approved and not yet in this tree. | Section 9 lists what this design assumes from each. Where it needs something they do not promise, it is written as a requirement on them, with what Stage 7 does if the requirement is not met. |
| T8 | Borrow techniques, never a specific game's look or names. | Section 5 names techniques by what they do. No layout, icon or wording is taken from a game. |

---

## 4. Goals, non-goals, anti-goals

Goals, each with a proof (section 11):

- **G7.1** Every action a player can take with a mouse and a keyboard, and that matters to play, can be taken with touch alone. The exceptions are named and are owner decisions (section 5.3).
- **G7.2** One gesture set, decided by one pure recogniser with stated thresholds.
- **G7.3** A tap picks what the player meant: exact hit first, then a tolerance that guarantees a 48 px target, with three stated exceptions.
- **G7.4** Nothing is learned only by hovering. Every tooltip has a touch form.
- **G7.5** The interface fits and is comfortable from 360 by 560 CSS px upward, in both orientations, inside the safe areas, with every control at least 44 px.
- **G7.6** The browser never takes a gesture the game needs, and the game never blocks one the player needs (typing, scrolling a list).
- **G7.7** Stage 4's warnings can be answered with a thumb, shown by arithmetic and by a measurement on the device.
- **G7.8** A phone holds a stated frame rate without overheating, survives being put in the background, and never loses progress to it.
- **G7.9** Mouse and keyboard play is unchanged: no existing test edited, and at 1280 by 720 every block of the interface keeps its position and size.
- **G7.10** No new runtime dependency. Stage 5's content policy stays as strict as it lands.

Non-goals: model compression (shelved); offline play; a native app; push notifications; cloud saves or accounts; gamepad support; a virtual joystick; a left-handed mirror layout; localisation; any change to rules, numbers, content or names.

Anti-goals:

- No sniffing of the browser's name. Behaviour follows what the device reports (pointer type, viewport, pixel ratio) and what the player actually uses.
- No second code path for the same action. A tap and a click end in the same function.
- No gesture that must be discovered to play. Tap alone finishes the starter quests; the other gestures are shown once on the first-run card.
- No timer on a ground tap. A walk order is never held back waiting for a possible double tap.

---

## 5. What the game takes as input today

### 5.1 How established games handle touch, and what fits here

Techniques only. "Fits" is judged against this game: one hero, click-to-act, a camera that follows from behind, fights decided by position since Stage 4.

| Technique | Where it is used | Fits? | Used here |
|---|---|---|---|
| **Tap to move and to act** | Mobile ports of click-to-move MMOs and of top-down action RPGs | Yes. It is the game's own verb. | Yes: 6.2. |
| **Long press for the options menu** | The same ports; every mobile operating system | Yes. It is the only widely known stand-in for the right button. It costs a wait, so nothing urgent may need it. | Yes, 500 ms: 6.2. Nothing in a fight needs it. |
| **One-finger drag to turn the camera** | Third-person mobile games; map applications | Yes, with a slop distance so a tap is not read as a drag. | Yes: 6.2. |
| **Pinch to zoom** | Universal | Yes. It must be taken from the browser, which uses the same gesture to zoom the page. | Yes: 6.2, 8.1. |
| **Virtual joystick and action buttons** | Mobile action games | No. It replaces click-to-act with direct steering, which is another game, and it puts a thumb permanently over the ground the player needs to read. The pathfinder already walks the hero. | No. |
| **Two-finger twist to rotate** | Map applications | No. It collides with pinch (both use two fingers) and one finger already turns the camera. | No. |
| **Double tap** (to run, to zoom) | Maps, some ports | No. Any double-tap meaning forces every single tap to wait about 300 ms to see whether a second one follows. Stage 4 cannot afford that. | No. Double tap means two taps. |
| **Fat-finger tolerance**: a tap near a small target counts as on it | Every serious touch interface; action RPG ports enlarge hit areas | Yes, with care: a tolerance that pulls a ground tap onto a monster would eat the dodge of Stage 4. | Yes, with three exceptions: 6.3. |
| **Target lock / auto-target nearest** | Mobile action games | No. The hero would attack what the player did not choose, and click-to-act is the essence. Stage 4's auto-retaliation already covers "something is hitting me". | No. |
| **Tap-and-hold preview instead of hover** | Card games, inventory-heavy ports | Partly. A separate "preview at 250 ms, menu at 500 ms" gives one press three meanings. One hold with one meaning is easier to learn. | Folded into the long press: the menu that opens carries the information the tooltip had (6.4). |
| **Bottom sheets**: panels that rise from the bottom edge | Mobile operating systems and most mobile games | Yes. The thumb reaches the bottom of a phone, not the top right corner where the panel is today. | Yes: 7.2. |
| **A dock of tabs along the bottom** | Same | Yes. The game already has a six-tab bar; it only needs to move. | Yes: 7.2. |
| **Safe areas**: keeping controls clear of notches and the home bar | Required by the hardware | Yes. | Yes: 7.5. |
| **Haptics**: a short buzz to confirm | Mobile games | Partly. The web can vibrate on Android only; iPhones offer nothing to a web page. It can confirm, never inform alone. | A buzz when a long press is recognised and when a warning starts, where available: 6.6. |
| **Auto-pause when the app loses focus** | Every mobile game | Yes. A phone interrupts constantly. | Yes: 10.4. |
| **Lower default quality on phones, with a frame cap** | Every mobile 3D game | Yes. | Yes: 10.1, 10.2. |

### 5.2 Every input, its touch form, the conflict, the resolution

"Today on touch" is what the code implies for a phone before this stage (not run). `C` marks a conflict; the resolution follows it.

**The world (`src/engine/input.ts`)**

| # | Input today | Code | Today on touch | Touch form after Stage 7 | Conflict and resolution |
|---|---|---|---|---|---|
| 1 | Left press on ground: walk. On a monster, resource or station: walk up and act. Acts on the **press**. | `mousedown`, 115-128; `handleWorldClick`, 376-442 | Works through the browser's made-up mouse events, after the finger lifts | **Tap** | C: a touch may become a drag, a pinch or a long press, so it cannot act on contact. It acts when the finger lifts. That costs about 100 ms against a mouse; section 9.2 counts it. |
| 2 | Right or middle drag: turn and tilt the camera | 115-124, 131-139, 145-147 | Impossible | **One-finger drag** | C: against tap. A press that moves more than 10 px before lifting is a drag and never a tap. C: against the camera's own return behind the hero while walking (`loop.ts` 166-168, 268, 284). It already waits while `camState.isDragging` is true; the touch drag sets the same flag. |
| 3 | Q and E: turn the camera | `loop.ts` 136-137 | Impossible | Same drag | None. |
| 4 | Wheel: zoom, 3.6 to 26 units | 149-151 | Impossible | **Pinch** | C: the browser zooms the page with the same gesture. `touch-action: none` on the canvas gives the gesture to the game (8.1). |
| 5 | Right click: options menu (Attack, Gather, Use, Examine, Walk here, Cancel) | `onGameContextMenu`, 255-350; `openChooseMenu`, 352-374 | Android fires the event on a long press, so it half works; iPhone never fires it | **Long press**, 500 ms | C: Android would then open the menu twice (its own event and ours). The right-click handlers ignore the event when the last pointer was a finger (6.1). C: the system's own long-press menu and text selection: 8.3. |
| 6 | Hover: a tooltip naming the thing, its level and health; the tile under the pointer lights up; the pointer becomes a hand; the thing's label shows | `handleWorldHover`, 194-237; `updateHoverTile`, 444-453; `G.hoveredWorld` read at `overlay.ts` 236 and 281 | Fires once after each tap and leaves the tooltip and the tile stuck | **None while moving.** The information moves to the long-press menu's heading and to the target display after a tap (6.4) | C: stuck tooltip. A finger never reaches the hover code (6.1). |
| 7 | The click marker: a cross where the order landed, yellow for ground, red or blue for a thing | `showClickMarker`, 180-192 | Works | Unchanged. It is the confirmation that replaces seeing the pointer (6.5) | None. |
| 8 | Minimap click: walk there | 153-171 | Works | **Tap** | The handler assumes the map is 198 CSS px wide (`scale = 0.55`, line 158). The phone layout draws it smaller, so the scale is taken from the element's real width. On a desktop the result is the same number. |
| 9 | Compass click: camera behind the hero | `index.html` 166; `resetCameraBehindPlayer`, 174-178 | Works, but the badge is 32 px (`styles.css` 556-557) | Tap, 44 px | None. |

**The keyboard**

| # | Input today | Code | Touch form | Notes |
|---|---|---|---|---|
| 10 | W A S D and the arrows: walk and turn | `G.keysPressed`, `input.ts` 79; `loop.ts` 144-153 | **None.** Tap to move covers it. | A joystick is declined (5.1). CALL-7.2. |
| 11 | Space: jump | `input.ts` 81-85; `loop.ts` 316-321 | **None.** | The jump only lifts the hero for a moment; no rule reads it. CALL-7.2. |
| 12 | F: arm the special attack | 86-88 | **Tap the special-energy bar** in the vitals card. The button in the Combat tab (`index.html` 235) stays. | Without it, arming the special in a fight needs two taps and an open panel. |
| 13 | F1 to F6: the six panels | 89-96 | The tab buttons, which exist (`index.html` 179-184), moved into a dock (7.2) | None. |
| 14 | Esc: close every window | 72-74 | The close button of each window, 44 px instead of 28 (`styles.css` 962-963) | None. |
| 15 | Typed words: the two cheat codes today; after Stage 3 also the word that reveals the hidden tools | `noteCheatKey`, `session.ts` 107 | **None without a decision.** | CALL-7.11 (section 9.1). |
| 16 | Enter in the cheat box | `runtime.ts` 182 | The on-screen keyboard's own Enter key; the Apply button | None. |
| 17 | Typing in a text box does not move the hero | `input.ts` 75-78 | Holds for an on-screen keyboard too | None. |

**The interface (`index.html`, `src/ui`)**

| # | Input today | Code | Today on touch | Touch form after Stage 7 | Conflict and resolution |
|---|---|---|---|---|---|
| 18 | 38 buttons and rows wired with `onclick` | `index.html` (for example 114-116, 179-184, 191-226, 380-388) | Work: a tap makes a click | Unchanged. Stage 5 rewires them to one delegated click listener, which a tap also reaches | Sizes: 7.4. |
| 19 | Backpack slot: click uses, eats, buries or wears; in the shop it sells | `hud.ts` 237; `handleInventoryClick`, `playerActions.ts` 132-206 | Works | **Tap**, unchanged | C: a mis-tap sells or eats. Section 6.5. |
| 20 | Backpack slot: hover shows the item card with the comparison to what is worn | `hud.ts` 238-240; `showItemTooltip`, 426-432 | Sticks after a tap | **Long press** opens the item sheet: the same card, plus the actions (6.4) | C: long press against scrolling a list. A finger that moves more than 10 px is a scroll, taken by the browser, and the press is dropped. |
| 21 | Backpack slot and sell card: right click opens the sell menu | `hud.ts` 241-245; `stations.ts` 412-416; `showSellChooseMenu`, `playerActions.ts` 113-130 | Android only, by accident | The same item sheet lists the sell choices when the shop is open | As row 5. |
| 22 | `title` text as the only description of a skill, a worn item, a prayer, a spell, a shop button | `hud.ts` 236, 262, 297, 338, 355; `stations.ts` 312, 350, 356, 377, 401 | Never shown: a touch screen does not display `title` | **Long press** on any control that has one opens a small sheet with that text (6.4) | As row 20. |
| 23 | The performance readout: a click cycles the graphics quality | `index.html` 119 | A stray tap changes the quality, and after Stage 5 that switches the automatic step-down off for the session | Hidden on phones. The same button stays in Settings | None. |
| 24 | Bank search box | `stations.ts` 188, 233-239 | Works; an iPhone zooms the page into any text box whose text is under 16 px | Text at 16 px on touch; the box stays above the on-screen keyboard (7.6) | C: the on-screen keyboard covers half the screen. 7.6. |
| 25 | Bank and shop: click a stack to move or sell it at the chosen quantity; the small quick-sell buttons | `bindTransfer`, `stations.ts` 155-164; 386-409 | Work; the quick buttons are 9 px text (`styles.css` 1452) | Tap; the quick buttons become 44 px tall | 7.3. |
| 26 | The options menu's own layout | `openChooseMenu`, `input.ts` 368-369; rows 3 px of padding (`styles.css` 1731-1737) | Rows about 22 px tall, placed under the finger | On touch the same element is a sheet at the bottom edge with 48 px rows (6.4) | None. |
| 27 | Reset asks with the browser's own confirmation | `session.ts` 97 | Works | Unchanged | None. |
| 28 | Words on screen that name keys and buttons: the first-run card, the chat footer, the Settings help, the Combat tab hint, the backpack heading, two first-run chat lines | `index.html` 53-55, 239, 255, 283, 374-376; `runtime.ts` 177, 179 | Wrong for a phone | Each gets a touch wording, shown when the player is using touch (7.7) | None. |

### 5.3 What touch does not get

Three things, all by choice and all in CALL-7.2 or CALL-7.11: walking with held keys (tap covers it), jumping (it changes nothing in the rules), and typed words (decided in 9.1). Nothing else is missing.

---

## 6. The interaction model

### 6.1 Pointer Events, beside the mouse listeners (CALL-7.3)

**Decision: the touch path uses Pointer Events and nothing else. The existing mouse listeners stay and keep serving the mouse, with their behaviour unchanged.** There are no Touch Events (`touchstart` and its family) anywhere.

Three ways were weighed:

| | A. Replace the mouse listeners with Pointer Events for every device | B. Add Pointer Events for fingers and pens; keep the mouse listeners for the mouse (recommended) | C. Add Touch Events for fingers |
|---|---|---|---|
| For | One event family in the file. | The mouse listeners keep their bodies and their behaviour, so the mouse cannot regress and its test stays frozen. One modern event family for everything new. Pens come free. | Works on very old browsers. |
| Against | It rewrites working code that a frozen test and the owner's rule protect. A mouse acts on the press and has buttons and a wheel; a finger acts on the lift and has time and distance. The two recognisers share almost nothing, so merging them saves little. | Two sets of listeners on one canvas. They must not both fire for one tap (below). | A second, older event family with its own quirks, and non-passive listeners that the browser warns about. Nothing gained on any browser that can run this game's WebGL. |

Why B is still "one path": the *actions* are shared. A tap calls `handleWorldClick`, a long press calls the function that builds the options menu, a drag changes `camState.manualOffset` and `camState.pitch` with the mouse's own constants (0.007 and 0.005 radians per pixel, `input.ts` 138-139), a pinch changes `camState.distance` inside the wheel's own limits (3.6 to 26, line 150). Only the recognising differs, and it differs for a real reason.

How the two sets stay out of each other's way:

- **The touch listeners ignore the mouse.** Each begins with `if (e.pointerType === 'mouse') return`.
- **A finger never reaches the mouse listeners.** The touch `pointerdown` handler calls `preventDefault()`. By the Pointer Events rules that cancels the made-up mouse events for that touch, so `mousedown`, `mousemove` and `mouseup` on the canvas never see a finger. This is what stops the double walk order and the stuck hover tooltip.
- **The right-click handlers ignore a finger.** Android still fires `contextmenu` on a long press. The three handlers (`onGameContextMenu`; the backpack slot, `hud.ts` 241; the sell card, `stations.ts` 412) return early when the last pointer was not a mouse. They still call `preventDefault()`, which also keeps the system menu away.
- **One small module knows which input is in use.** `src/engine/inputMode.ts` listens for `pointerdown` on the page in the capture phase and remembers the last pointer type. It also sets `data-input="touch"` on the root element the first time a finger is used, and that value stays for the session. Before any touch, the value comes from the browser's "primary pointer is coarse" media query. CSS uses the attribute for sizes and wording; the layout itself follows the viewport (7.1). A laptop with a touch screen therefore looks exactly as today until its screen is actually touched.

**What is edited in the existing input code, in full**, so that "unchanged" can be checked line by line:

- three one-line guards at the top of the right-click handlers (above);
- one guard at the top of `showItemTooltip`, so a tapped slot leaves no stuck card;
- the two camera numbers inside the `mousemove` listener (0.007 and 0.005) become two named constants that the touch drag reads too; the arithmetic is the same;
- `handleWorldClick`, `openChooseMenu` and the hover label gain optional arguments or a shared helper whose default reproduces today's result exactly (a click still calls them the way it does today);
- the minimap's scale is computed from the element's width (the same number at today's size).

Nothing else in `setupInputHandlers` or in the functions it calls changes for a mouse or a key.

Constraint T2 shapes the wiring: the new listeners are registered with `canvas.addEventListener` only, `touch-action` is set in CSS, and the pointer is captured inside the `pointerdown` handler. `setupInputHandlers` gains one call and nothing that the frozen test's stub lacks.

### 6.2 The gestures and their thresholds (CALL-7.2)

All distances are CSS pixels measured from where the finger first touched. All times are from that moment. The values are constants in one table (`GESTURE` in `src/state/gestures.ts`) so the device check can tune them without touching logic.

| Gesture | What it does | Threshold |
|---|---|---|
| **Tap** on the world | Walks to the ground point, or walks up to the thing and acts. The same function as a left click. | One finger; never moved more than **10 px**; lifted before **500 ms**. Acts when the finger lifts. No wait after the lift. |
| **Long press** on the world | Opens the options sheet for what is under the finger, with its name, level and health as the heading. | One finger; still within **10 px** for **500 ms**. Fires at 500 ms while the finger is still down. Lifting afterwards does nothing. |
| **Drag** with one finger | Turns and tilts the camera. | Moves more than **10 px** before 500 ms. From then on it is a drag until the finger lifts: 0.007 rad per px sideways, 0.005 rad per px up and down, tilt held between 0.12 and 1.15 (the mouse's numbers). The first 10 px are not applied, so the camera does not jump. |
| **Pinch** with two fingers | Zooms. | A second finger lands. Zoom starts once the distance between the fingers has changed by **8 px**. Camera distance = distance at the start × (finger gap at the start ÷ finger gap now), held between 3.6 and 26. |
| **Tap** on the minimap, the compass, a dock tab, a button | What a click does today. | The browser's own click. No delay (8.2). |
| **Tap** on the special-energy bar | Arms or disarms the special attack. | Same. |
| **Long press** on a backpack slot, a bank or shop stack, or any control with a description | Opens the item or description sheet. | Still within 10 px for 500 ms. A finger that moves is a scroll. |

Rules that close the gaps between gestures:

- **A second finger cancels everything pending.** The tap or long press that was forming is dropped. When one of two fingers lifts, the one that remains does nothing more: no tap, no drag, until every finger is up. This prevents the camera lurch at the end of every pinch.
- **A third finger is ignored.**
- **A cancelled touch never acts.** When the browser or the system takes the touch away (`pointercancel`: an incoming call, a palm, a system gesture), the recogniser returns to idle and emits nothing. Losing focus or the page being hidden does the same.
- **A drag that began on a monster is still a drag.** Nothing is picked until a tap completes.
- **While the hero is down**, a tap does nothing (as `input.ts` 127 does for a click). The camera gestures still work.
- **A tap on the world with a sheet open** closes the sheet and acts, as a left click does today (`input.ts` 126-127). It never costs an extra tap to dismiss something before answering a warning.

Why 10 px and 500 ms: both are the values mobile operating systems use for the same two questions (their touch slop is 8 to 10 points, their long press about 500 ms), so the game behaves like everything else on the phone. Whether 10 px survives a hurried thumb is on the device checklist (11.3).

### 6.3 Target selection (CALL-7.4)

**Today** a click casts one ray and takes the first thing on it that is not ground; otherwise the ground (`handleWorldClick`, `input.ts` 381-384). Monsters, resources and stations are picked through invisible cylinders: radius 0.8 to 1.25 units for ordinary monsters and 2.9 for the dragon (`monsterMeshes.ts` 135-771), 0.55 for people such as the banker and the shopkeeper (`humanoid.ts` 222-224), 1.45 for trees, rocks and fishing spots (`spawns.ts` 182-184). There are no items on the ground in this game, so "item" does not enter the rule; if a later stage adds ground loot it takes the lowest priority below.

**How big those cylinders are under a finger.** With the camera's 50° vertical view (`renderer.ts` 112), one world unit at depth *d* covers `(viewport height ÷ 2) ÷ (tan 25° × d)` pixels (for the upright phone, which gets a wider view in 7.8, the half-angle is 37.5°).

| Screen | Pixels per unit at depth 9 | at depth 26 (zoomed out, or a far monster) | A person (1.1 wide) at depth 26 | A chicken (1.6 wide) at depth 26 |
|---|---|---|---|---|
| Desktop, 1080 px tall | 129 | 44.5 | **49 px** | 71 px |
| Phone on its side, 360 px tall | 43 | 14.8 | **16 px** | 24 px |
| Phone upright, 800 px tall, with the wider view of 7.8 | 58 | 20 | **22 px** | 32 px |

So the smallest target a mouse player ever meets is about 49 px, and a phone shows the same target at 16 to 22 px. The rule below gives the finger what the mouse already has.

**The rule, in order:**

1. **Exact hit first.** Cast the ray as today. If it meets a monster, resource or station, that is the target. Identical to the mouse.
2. **Otherwise, tolerance.** Project every live monster, undepleted resource and station to the screen as a circle: its centre, and its cylinder's radius in pixels. Give each an **effective radius of at least 24 px** (a 48 px target). Among those whose effective circle contains the tap, take the one where the tap is proportionally closest to the centre. A near tie (within one tenth) goes to a monster, then a station, then a resource; then to the nearer one.
3. **Otherwise, the ground** under the finger.

A target already wider than 48 px gains nothing from step 2, so on a close camera the rule changes nothing. 48 px is the minimum hit size for anything in the world; 44 px is the minimum for a control in the interface (7.4).

**Three exceptions, each of which turns step 2 off:**

- **A mouse never gets tolerance.** Step 2 runs only for a tap. Mouse behaviour is unchanged.
- **Never onto the thing the hero is already fighting or gathering.** Tapping the current target again is useless (Stage 4 says the same, its 6.4), and the ground next to the monster being fought is exactly where a dodge lands.
- **Never while a warning aimed at the hero is live** (a Stage 4 wind-up). During those 1.5 to 2 seconds a tap means what it exactly touched. Section 9.2 makes this a requirement on Stage 4.

Step 2 is a pure function (`assistedPick` in `src/state/pick.ts`) over a list of circles. The engine builds the list only when step 1 found nothing, from the same objects the ray tests (`G.worldInteractiveObjects`), with the projection `overlay.ts` already has (`worldToScreenPos`, 137-144). It is at most a few hundred multiplications per tap and nothing per frame. Like the ray today, it does not know about walls.

### 6.4 What replaces hover, and what replaces the right button

| On a mouse | On touch |
|---|---|
| Hover tooltip on a monster, resource or station: name, level, health, requirement | **After a tap**: the target display, which already shows name, level and health or the required skill (`updateTargetHud`, `hud.ts` 377-398). **Without committing**: a long press, whose sheet carries the tooltip's line as its heading. |
| Hover tile: which cell a click would land on | **Nothing before the tap.** After it, the click marker shows where the order landed. A finger hides the tile it would light, so showing one buys nothing. |
| Hand-shaped pointer over a thing | Nothing. Things that can be tapped already carry labels when the hero is near (`overlay.ts`). |
| Item card on hover, with the comparison to what is worn | **Long press on the slot**: the item sheet. The card on top, the actions under it: the slot's normal action (Wear, Eat, Bury, Use), the sell choices when the shop is open, Cancel. |
| `title` text | **Long press**: a sheet with that text and one "OK" row. One delegated handler covers every control that has a `title`, today and in later stages. |
| Right-click menu in the world | **Long press**: the same list, built by the same function. |
| Right-click sell menu | Inside the item sheet. |

**The sheet.** The options menu is one element today (`#context-menu`, `index.html` 71-74). On touch the same element is drawn as a sheet along the bottom edge: full width up to 420 px, rows 48 px tall, above the home bar. On a mouse it stays where the pointer is, as today. `openChooseMenu` gains one optional argument, a heading block, which is the tooltip's content. The heading for an item is built by the existing `itemCompareHtml`; for a world thing, by the label code of `handleWorldHover`, moved into a small function so both callers share it. No new markup beyond one heading element.

**Long press on the interface** is recognised by the same pure recogniser, fed from one delegated `pointerdown` listener on the page. When it fires, the click that the browser would send on lifting the finger is swallowed once, so a long press on a backpack slot opens the sheet and does not also eat the food.

### 6.5 Undoing a mis-tap

- **In the world, a tap is an order, and the next tap replaces it.** This is already true (`handleWorldClick` overwrites `player.targetEntity` and `player.waypoints`). The click marker shows at once what was understood: yellow on ground, red on a thing. A wrong monster costs nothing until the hero reaches it; a wrong fight is left by tapping the ground, and Stage 2's leash ends it.
- **"Cancel" is the last row of every sheet**, and a tap outside a sheet closes it.
- **Spending is deliberate.** Teleports, quest claims, Stage 4's vow: each is a labelled button or a sheet row, 44 px or more, never a bare tap on the world.
- **Three taps cannot be taken back**: eating, burying and selling. Eating and burying are cheap and are left as they are. **Selling is not cheap after Stage 3** (the shop sells equipment at ten times what it pays), and on a phone the sell target is one fat finger away from the item next to it. Proposal (CALL-7.10): on touch only, selling a piece of **equipment** asks once, with the existing sheet: "Sell Steel Platebody for N GP" and "Cancel". Everything else sells on one tap as today. A mouse never sees the question.
- **The backpack sheet does not cover the fight** (7.2), and a tap on the world while it is open acts at once.

### 6.6 Haptics (CALL-7.12)

`navigator.vibrate`, where it exists (Android browsers; not iPhone, where a web page cannot vibrate the device). Two uses, each a single short pulse: 10 ms when a long press is recognised, and 20 ms when a warning aimed at the hero starts (a phone is often muted, and Stage 4 promises a cue beyond colour). Never a pattern, never repeated, off when the browser asks for reduced motion. It is a confirmation on top of what is drawn; nothing is told by vibration alone.

---

## 7. Layout on small screens

### 7.1 Three layouts, chosen by the viewport

The layout follows the **size of the viewport**, by CSS media queries. Sizes of controls and the wording of hints follow **the input in use** (`data-input="touch"`, 6.1). The two are independent on purpose: a small desktop window gets the compact layout with mouse-sized controls, and a tablet gets today's layout with finger-sized controls.

| Layout | When | Devices |
|---|---|---|
| **Phone upright** | width under 750 px and height of 500 px or more | phones held upright; a narrow desktop window |
| **Phone on its side** | height under 500 px | phones held sideways |
| **Wide** (today's layout) | everything else: at least 750 px wide and 500 px tall | tablets either way, laptops, desktops |

Why 750: today's chat (440 px), panel (268 px) and their three margins need 750 px side by side. Below that they already overlap today, so the compact layout starts there. The queries use width and height only, never "orientation", so a keyboard that shrinks the page cannot be mistaken for a rotation.

**Smallest supported viewport (CALL-7.6): 360 by 560 CSS px upright, and 640 by 320 on its side.** These are what the smallest common phones show once the browser's own bars are counted (a 360 by 640 Android phone; a 375 by 667 iPhone). Below that the game still loads and nothing is hidden on purpose, but nothing is promised. A 320 px wide phone (the first small iPhone) is below the line.

**Orientation: both, never locked.** A web page cannot lock the orientation on an iPhone, and a game that works only one way up is a weaker game. Upright is the better posture for this game (the thumb reaches everything and the tall screen shows far ahead), and the first-run card says so in one line. Rotating re-flows the layout and re-fits the camera at once (`onWindowResize`, `renderer.ts` 168-173, already runs on it).

All new rules live in one new file, `src/ui/touch.css`, imported after `styles.css`. Stage 5 rewrites `styles.css`; keeping Stage 7's rules apart keeps the two from colliding and makes the "desktop is unchanged" claim easy to check: every rule in the new file sits inside a media query for one of the two phone layouts or under `html[data-input="touch"]`, except the four global rules of section 8.

### 7.2 Phone upright

```
+--------------------------------------+   <- safe area top
| HP  ########--   |        ( minimap )|
| Pr  ######----   |        (  112px  )|
| Sp  ##########   |         [ GP 500 ]|
| > Open the bank (tracker, one line)  |
| [ Goblin Raider  Lv 2  ####---- ]    |   target display, only with a target
|                                      |
|            the world                 |
|     (tap, drag, pinch, long press)   |
|                                      |
| last three chat lines (taps pass     |
| through to the world)                |
+--------------------------------------+
|  panel sheet, when a tab is open:    |
|  backpack 4 x 7, slots 48 px tall    |
+--------------------------------------+
| Cmb | Skl | Bag | Worn | Pray | Mag | More |   dock, 48 px + safe area bottom
+--------------------------------------+
```

- **Vitals**, top left: the three bars only. The hero's name and the combat-level pill move into the Skills panel heading. Tapping the special bar arms the special attack.
- **Quest tracker**: one line under the vitals (the step text, with the quest's title on a long press). A tap opens the quest window. Stage 3's starter chain depends on this line being visible, so it never collapses further. The Slayer widget is not shown on a phone; its content is in the quest window.
- **Target display**: under the tracker, the width of the left column. Stage 4's boss bar takes the same place (9.2).
- **Minimap**, top right, 112 px (198 today), with the compass on its corner at 44 px and the coin count under it. It stays a tap target for walking.
- **Dock**, bottom: the six existing tab buttons plus **More**, seven buttons across the full width, each at least 51 px wide and 48 px tall. **More** opens a short sheet: World Map, Quests, Settings, Messages. That replaces the three top buttons (`index.html` 113-117), which are hidden on a phone.
- **Panel sheet**: the existing right panel (`#right-panel`), drawn as a sheet above the dock. **Closed by default.** Tapping a tab opens that panel; tapping the open tab again closes it. Open, it is at most 52% of the viewport height, so the upper half of the world, where the hero and what is ahead of it are, stays visible and tappable. The backpack stays 4 columns by 7 rows, each slot at least 44 px tall.
- **Chat**: the last three lines above the dock or the sheet, on a dark strip so they read over the world, and **taps pass through them** (the chat has no input of its own; it is output only, `addChatMessage`, `hud.ts` 60-68). The full log (the 60 lines the game keeps) is under More, Messages. The line of keyboard hints under the chat (`index.html` 283) is not shown on touch.
- **XP drops, banners**: under the top block, centred, clear of the minimap.
- **The performance readout and the tick meter** are not shown. The readout comes back while Stage 3's hidden tools are revealed, which is how the budgets of section 10 are read on the device.

The only script the layout needs is one small module: a tap on the tab that is already open closes the panel (a `collapsed` class), any other tab opens it, **and F1 to F6 open it too**, so that a key never switches a panel nobody can see (a narrow desktop window, or a phone with a keyboard attached). A small handler opens the More sheet. The class has no effect outside the two phone layouts, so a desktop at its usual size is untouched.

### 7.3 Phone on its side

- Vitals top left and minimap (96 px) top right, as upright. Tracker under the vitals.
- **Dock** at the bottom right, 7 buttons of 48 px. **Panel sheet** above it, 336 px wide, on the right edge; closed by default.
- **The backpack is drawn 7 columns by 4 rows here.** Still 28 slots in the same order; only the grid's shape changes, because 7 rows of 44 px do not fit in 320 px of height. Stage 5 fixes the backpack at "4 by 7"; this is the one place Stage 7 departs from it, and it is in CALL-7.5.
- Chat: three lines at the bottom left, at most 45% of the width, taps pass through.
- On its side, a phone shows a monster at less than half the size of the upright view (6.3), so the tolerance rule does most of its work here.

### 7.4 Tablet, and sizes on any touch device

A tablet uses today's layout: at 768 by 1024 and 1024 by 768 the four blocks fit without touching (292 + 240 px across the top; 440 + 268 px across the bottom; about 254 + 446 px down the right edge). A tablet on its side shows only about 690 px of height once the browser's bars are counted, which is 10 px short, so in the wide layout under 740 px of height the minimap is drawn at 150 px. What changes on any device that is being touched (`html[data-input="touch"]`):

- **Every control is at least 44 by 44 px**: the six tabs, the close buttons (28 px today), the compass (32 px), the quantity pills, the filter pills, the quick-sell buttons (9 px text today), the Settings buttons, the rows of every sheet (48 px). Backpack, bank and shop slots are at least 44 px tall. Where the visible shape should stay small (the compass), the tappable area is enlarged around it with padding.
- **No hover styles.** Stage 5 is asked to put its hover rules inside the "device can hover" media query (9.3), so a tapped button does not stay lit. Pressed states (`:active`) are kept: they are the finger's feedback.
- **Text**: nothing under 12 px in the phone layouts (Stage 5's floor for desktop is 11); body text 14 px; any text box 16 px (an iPhone zooms the page into a box with smaller text).

### 7.5 Windows: bank, shop, forge, world map, quests, settings, XP table

On the two phone layouts every window (`.modal-window`, 760 px wide today, `styles.css` 932-943) is a **full-screen sheet**: the whole viewport inside the safe areas, a heading that stays at the top with a 44 px close button, and a body that scrolls. No window is ever wider than the screen.

| Window | On a phone |
|---|---|
| **Bank** | Toolbar on top: quantity pills, search, filters, in two rows. Under it the vault, then the backpack, each a grid with its own scroll (the vault at most 36% of the height, the backpack at most 30%), so both are on screen at once and a withdrawal is one tap with the result visible. The one-column fall-back at 800 px (`styles.css` 1823) already stacks them. A long press on a stack shows the item card. |
| **Shop** | Stock on top, "Your backpack" under it, each with its own scroll. Quick-sell buttons 44 px tall. Selling equipment asks once (6.5). |
| **Forge** | One recipe per row, the Make button 44 px at the right. |
| **World map** | One region card per row. |
| **Quests** | One card per row; Claim and Locate buttons 44 px. Stage 6's journal is asked to use the same window (9.4). |
| **Settings** | Buttons in two columns, 44 px. The help text shows the touch wording. If CALL-7.9 and CALL-7.13 are taken, "Move this save" and "Full screen" are here. |
| **XP table** | Three columns of cells; scrolls. |
| **Death notice, first-run card** | A centred card at most 90% of the width, text 14 px, inside the safe areas. The first-run card lists the four gestures when the player is on touch. |
| **Options and item sheets** | 6.4. |

Safe areas, notches, the home bar: the viewport tag gains `viewport-fit=cover`, so the 3D view fills the whole glass, and every block of the interface is inset by the four `env(safe-area-inset-*)` values. The dock sits above the home bar; on a phone on its side the left and right insets keep the vitals and the minimap out of the notch.

Height: `html` and `body` use `100dvh` (the height actually visible) with `100vh` as the fall-back for older browsers. The renderer already sizes itself from `window.innerHeight` (`renderer.ts` 121, 171), which is the same visible height.

### 7.6 The on-screen keyboard over the bank search

The search box is in the toolbar at the top of the bank sheet, and the vault grid is directly under it. When the keyboard rises it covers the lower part of the screen, which is the backpack; the box and the first rows of results stay visible. Nothing has to move.

- The box's text is 16 px, so an iPhone does not zoom the page on focus.
- It is marked as a search field (`inputmode="search"`, `enterkeyhint="search"`, no capitals, no correction), and Enter closes the keyboard.
- **Opening the bank never focuses the box on touch.** Stage 5 moves focus into a window when it opens; on touch that focus must go to the window itself, or every visit to the bank would raise the keyboard (requirement 9.3).
- Typing does not move the hero (`input.ts` 75-78 already ignores keys typed into a text box).
- Stage 5's fix for audit finding 24 keeps the box focused while the grid redraws, so the keyboard does not drop after each letter. Stage 7 depends on it.

### 7.7 Words that name the input

Every text that names a key or a mouse button (row 28 of 5.2) gets a second wording for touch. Both are in the markup, and CSS shows the one that matches `data-input`. The two first-run chat lines are chosen in script by the same value. Stage 3 rewrites the first-run card and those lines; Stage 7 adds the touch wording to whatever Stage 3 leaves (9.1).

Touch wording of the first-run card: "**Tap** the ground to walk, or a monster, a tree or a shop to use it. **Drag** to look around, **pinch** to zoom. **Press and hold** anything for its options. The tabs along the bottom open your backpack and skills."

### 7.8 The camera on an upright phone (CALL-7.7)

The camera's view is 50° tall (`renderer.ts` 112). On a wide screen that is about 79° across. On an upright phone (390 by 844) it is only **24° across**: at the starting camera distance of 5.4 (`context.ts` 85) the screen shows 1.2 units to each side of the hero. A Stage 4 warning circle is 2.5 to 4.5 units in radius, so it would run off both sides of the screen and "step to the side" would have nowhere on screen to tap.

Two changes, both for viewports narrower than about 4:5 only:

- **A wider view when upright.** `fovForAspect(aspect)`: 50° whenever the viewport is at least 0.78 as wide as it is tall (every desktop, laptop and sideways phone: unchanged); below that, the vertical angle grows so that the view across never falls under 40°, up to a ceiling of 75°. On a 390 by 844 phone that gives 75° tall and 39° across; on an upright tablet, 52°.
- **A camera that starts no closer than 10 units when upright.** Applied once at start and when the device is rotated to upright; the player can pinch closer afterwards.

Together, at a distance of 10 the upright phone shows 3.5 units to each side of the hero, and the ground ahead to the horizon. That covers the sideways step of every ordinary Stage 4 warning except the 4.5 circle around a Moss Guardian, whose answer is to back away along the screen's long axis, which an upright phone shows best.

The cost is that an upright phone has a slightly wide-angle look. Whether it flatters the faceted world is on the device checklist.

### 7.9 Reading it outdoors

- Stage 5 gives every text and surface pair a contrast of at least 4.5 to 1. In the phone layouts, text that sits **over the world** (chat lines, the tracker, the target display, damage numbers) also gets a dark strip or a dark outline, because the world behind it can be any colour and the sun washes the screen out.
- Vitals are read by the length of the bar first and the number second.
- Stage 4's warnings are an outline, a moving fill and a sound, never colour alone; that already suits sunlight.
- Nothing in the phone layouts is under 12 px.

---

## 8. Platform matters

### 8.1 The viewport tag and the browser's zoom (CALL-7.8)

- The tag becomes `width=device-width, initial-scale=1, viewport-fit=cover`. It does **not** say `user-scalable=no` or set a maximum scale: iPhones ignore both, and they are the wrong tool.
- **The 3D view**: `touch-action: none` on the canvas container. Every drag and pinch there is the game's.
- **The rest of the page**: `touch-action: pan-x pan-y` on the root. Lists scroll; the page does not zoom by pinch or double tap.

The trade-off is real: a player who relies on pinching the page to enlarge text loses that. Zooming a page whose every block is pinned to an edge does not enlarge the text usefully anyway; it slides the interface off the screen, and with half the screen owned by the game there is then no easy way back. In exchange the phone layouts carry larger text (7.4), and the system's own text-size and zoom accessibility features keep working because they act outside the page.

### 8.2 Tap delay, passive listeners

- The old 300 ms wait after a tap exists only on pages without a mobile viewport tag. This page has one (`index.html` 5), so buttons answer at once. The world does not use clicks at all on touch; it reads the pointer directly.
- With `touch-action` set in CSS, no handler needs to call `preventDefault()` on a move, so no listener blocks scrolling. The only non-passive act is `preventDefault()` on `pointerdown` on the canvas (6.1). There are no touch-event or wheel listeners added; the existing wheel listener is already passive (`input.ts` 151).
- Pointer moves can arrive faster than frames. The move handler only adds to two numbers; no ray is cast on a move.

### 8.3 Gestures the browser or the system would take

| Threat to a gesture | What is done |
|---|---|
| Pull down to reload | `overscroll-behavior: none` on the root; `contain` on every scrolling list. The page itself never scrolls (`overflow: hidden`, `styles.css` 34). |
| Pinch and double-tap page zoom | 8.1. |
| Swipe from the screen edge to go back (iPhone), or the system back gesture (Android) | **Cannot be blocked by a web page.** Nothing in the layout needs a drag that starts within 20 px of a side edge. If the player does leave, the game has already saved (8.5), so it costs a reload and no progress. Installed to the home screen (8.6), an iPhone has no edge-swipe back. |
| The system's long-press menu, text selection, the magnifier | Selection is already off everywhere but text boxes (`styles.css` 18-29). Added: `-webkit-touch-callout: none` and a transparent tap highlight. `contextmenu` is already cancelled on the canvas (`input.ts` 111). |
| The home bar swipe at the bottom | The dock sits above the safe area. |
| A second app in split view, a rotated screen | The layout follows the viewport at every size from 7.1 upward. |

### 8.4 The save is per device (CALL-7.9)

**A phone starts a new game.** The save is in the browser's `localStorage` (`writeSave`, `save.ts` 204-206), which belongs to one browser on one device. Opening the game on a phone does not find the character played on a computer. On an iPhone there are two more facts: the browser may delete a site's stored data after seven days of browser use without a visit to the site (the browser's published tracking-prevention rule; not verified here), and a copy installed to the home screen has its own storage, separate from the browser's.

**Proposal: a plain "Move this save" in Settings.**

- **Copy**: shows the save as text in a box, with a Copy button. The text is exactly what the game already writes (`serializeState`, `save.ts` 137).
- **Load**: a box to paste into and a Load button. It asks before replacing the character on this device, keeps the replaced one under a backup key (one slot, the same idea as the existing corrupt-save backup, `save.ts` 174), writes the **validated result** (never the pasted text itself) and reloads. One trap is known: the game saves the current character as the page unloads (`runtime.ts` 159-164), which would write the old character back over the new one. Stage 3 meets the same trap in Reset and adds a guard for it (its finding F16); the load uses that guard.

The pasted text is **untrusted input**. It goes through one new pure function, `importSaveText`, which does three things and no more: refuses anything over 262,144 characters before parsing; parses it as JSON inside a try; and hands the result to `migrateLegacySave` (`save.ts` 30), **the same reader that validates every save on load**, with every clamp and known-id check it has. Nothing from the text is ever written into the page as HTML, and the function throws nothing: it returns the validated save or a reason. A hostile fixture already exists (`tests/fixtures/save-hostile.json`) and is reused.

Why text and not a file or a code: text needs no file picker, no download permission and no server, and it travels through any notes or message app the player already has. A save is a few kilobytes.

What it is not: a cloud save, an account, or anti-cheat. A player can edit the text, as they can edit `localStorage` today. This is a single-player game and that is accepted.

Also, at no cost: after the first save the game asks the browser to keep its storage (`navigator.storage.persist()` where it exists). The browser may refuse; nothing depends on the answer.

### 8.5 Being put away, and coming back

- **Saving.** The game saves when the page is hidden (`runtime.ts` 160-164) and on `beforeunload` (159). On phones `beforeunload` often never fires. Added: the same save on `pagehide`. Together these cover switching apps, locking the screen and swiping the browser away.
- **Pausing.** Animation frames stop while the page is hidden, and the step is capped at 0.08 s on return (`loop.ts` 774), so no time passes for the world while the phone is in a pocket. But on return the fight resumes on the very next frame, before the player has found their thumb. Proposal (CALL-7.14): on touch, after the page has been hidden for more than 3 seconds, the game comes back **paused behind a card that says "Paused. Tap to continue."** The world is frozen behind it. A desktop is unchanged.
- **Losing the 3D context.** A phone under memory pressure can take the graphics context away without closing the page. Today nothing handles it (there is no `webglcontextlost` listener in `src/`), and the player would see a frozen or black view. Added: on that event the game saves and shows a card with one button, "Reload". No attempt is made to rebuild the scene in place; a reload is the simple, certain recovery.
- **Audio.** Today the audio context is created the first time a sound plays (`init`, `audio.ts` 30-38), which is usually not inside a touch, and on an iPhone a context created or resumed outside one stays silent. Stage 4 moves the creation into the first gesture and keeps the listener armed. Stage 7 needs that listener to include the **lift** of a finger (`pointerup` or `touchend`) and `click`, because an iPhone unlocks audio on the lift and not on the touch-down (requirement 9.2). An iPhone's mute switch silences the game whatever the page does; the checklist says so, so it is not reported as a defect.

### 8.6 Full screen and the home screen (CALL-7.13)

- **Full screen.** A "Full screen" button in Settings, shown only where the browser offers it (`document.fullscreenEnabled`): Android phones and all tablets. It hides the browser's bars and gives the game the whole screen. An iPhone does not offer it to a web page.
- **A home-screen shortcut.** The only way to get the whole screen on an iPhone is to add the page to the home screen. That needs a small manifest file, three icon images (192 and 512 px, and a 180 px one for iPhones) drawn from the existing shield mark, and four tags in `index.html`. Opened from the home screen the game has no browser bars, no edge-swipe back, no pull to reload, and its storage is not subject to the seven-day rule.
- **No offline support.** That would need a service worker, which caches the game's files and then must be told, correctly and forever, when to drop them; a mistake leaves players on an old build that nobody can fix from the server. The game is 4.7 MB and already cached by the browser's normal rules (`vercel.json` gives hashed assets a year). Nothing about touch needs it. It is not built.
- The catch, stated plainly: on an iPhone the home-screen copy does not see the character played in the browser tab. With "Move this save" (8.4) that is one copy and one paste; without it, it is a new game. So the shortcut is recommended **only together with** CALL-7.9.

---

## 9. What the earlier stages add, and what touch needs from them

These three stages are approved and land before this one. The reference copies were read; the code was not, because it does not exist yet. Plan task R0 checks each line below against what landed.

### 9.1 Stage 3: start and pacing

| Stage 3 adds | What touch does with it |
|---|---|
| **The hidden tools.** The 10x button and the cheats sit in a hidden block in Settings, shown by typing one word during play. Its design says: "A device with no keyboard cannot reach the tools", and the owner accepted that limit. | **An owner decision, CALL-7.11**, because it amends an accepted limit. A phone has no way to type during play (`noteCheatKey` ignores keys typed into a text box, `session.ts` 107-109, and outside a text box a phone shows no keyboard). Proposal: **seven taps on the Settings window's title within three seconds** reveal the block, through the same function the typed word calls. It is as hidden as a word nobody is told, it stores nothing, and it lasts until reload, as Stage 3 specifies. The reason to want it: the owner cannot judge Stage 4's fights on a phone with a new level-3 character, and the phone starts a new game. If the owner declines, the phone has no tools, as Stage 3 already accepts, and "Move this save" (8.4) becomes the only way to test late-game play in the hand. |
| **The unlock line**: one chat line per level, naming up to three unlocks with shop price and forge recipe. | Long lines. The phone chat shows three lines and wraps; the line stays in the Messages log. Nothing to change in Stage 3. |
| **The starter quest chain**, shown first in the tracker under the health bar. | The tracker line is always visible on a phone (7.2) and opens the quest window on a tap. The six quests must be completable with taps alone; they are (each is "walk, act, claim"). On the checklist. |
| **Rewritten first-run card and first chat lines.** | Stage 7 adds the touch wording beside whatever Stage 3 wrote (7.7). |
| **The examine line** and shop prices through `shopPrice`. | The sell question of 6.5 reads the same functions. |

Requirement on Stage 3 (already met by its design if built as written): the reveal is one exported function that takes no keyboard event, so a second caller can use it. If it is not, Stage 7's task extracts it.

### 9.2 Stage 4: combat with weight

**The reaction arithmetic (Stage 4's CALL-4.16 left touch open).**

Stage 4's rule for every warning: `wind-up >= 700 (person) + 160 (device) + 90 (hero's acceleration) + escape distance / 11.5 x 1000 + 200 (reserve)`. Its 700 ms is 250 to see, 150 to decide and 300 to move a mouse pointer to open ground and click. A mouse acts on the press (`input.ts` 115-128).

The same person with a thumb:

| Part | Mouse | Thumb | Basis |
|---|---|---|---|
| See the shape | 250 | 250 | Same eyes. Assumed. |
| Decide | 150 | 150 | Same. Assumed. |
| Reach the spot | 300 | 300 (a slow thumb: 400) | A thumb travels 30 to 40 mm to a large target in about the time a pointer does. Assumed; measurable (below). |
| **Contact** | 0 | **+100** | A touch can only act when the finger lifts (5.2 row 1); a tap stays down 70 to 130 ms. Structural. Measurable exactly from the pointer events. |
| **Touch panel and system delay beyond a mouse's** | 0 | **+50** | Estimate from published panel latencies. Not measurable from inside a page. |
| **Total** | **700** | **850** (slow thumb: 950) | |

The other terms do not change. The device term (160 ms, two frames at 12.5 frames a second) already covers a touch being delivered one frame late.

Applied to Stage 4's own table (its section 6.3; "spare" is its Margin column, the wind-up minus everything except the 200 ms reserve, so the rule asks for at least 200):

| Warning | Wind-up | Spare, mouse | Spare, thumb (+150) | Spare, slow thumb (+250) | Spare, thumb, warnings 15% longer |
|---|---|---|---|---|---|
| Tail Lash | 1600 | 472 | 322 | 222 | 562 |
| Hexfall, Pinning Volley | 1600 | 407 | 257 | 157 | 497 |
| Overhead Slam | 1600 | 363 | 213 | 113 | 453 |
| Rootquake | 1700 | 333 | **183** | 83 | 438 |
| Scorch Lane | 1600 | 520 | 370 | 270 | 610 |
| Ember Cone (boss) | 1800 | 249 | **99** | **-1** | 369 |
| Tail Sweep (boss) | 1700 | 289 | **139** | 39 | 394 |
| Slag Rain (boss) | 1500 | 307 | **157** | 57 | 382 |
| Ashen Nova (boss) | 2000 | 546 | 396 | 296 | 696 |
| Slagburst (boss) | 2000 | 328 | **178** | 78 | 478 |

**Do the windows hold?** Every warning can still be answered by a thumb: the smallest spare is 99 ms. But the rule's own 200 ms reserve holds on six rows and is missed on five (bold), four of them the boss's. For a slow thumb one row has nothing left. So: answerable, yes; with the safety the rule promises, no. With every warning 15% longer the reserve holds on every row, for the slow thumb too (the lowest is then 269 ms), and for Stage 4's own trackpad case at +300 ms (the lowest is 219 ms).

Two things a thumb has that the arithmetic cannot show: the hand covers part of the screen, and on an upright phone the shape may not fit across it. The first is why a tap never needs a dismissal first (6.2) and why the backpack sheet stops at half the screen (7.2). The second is section 7.8.

**Proposal (CALL-7.15), which keeps the owner's decision on CALL-4.16 and extends it.** That decision was: leave the warnings as they are, test with a trackpad, and if the test fails lengthen every warning by 15% for everyone (the constant `TELEGRAPH_TIME_SCALE`) rather than add an option. Stage 7 applies the same decision to the phone:

1. Ship touch with the warnings as Stage 4 built them.
2. **Measure on the phone.** The engine keeps the last 64 warnings aimed at the hero in memory: which attack, how long after its start the first walk order arrived, and whether the hero was clear when it landed. Nothing is stored or sent. With the hidden tools revealed, Settings shows one line per attack seen: "Tail Sweep: 8 of 10 cleared, typical answer 810 ms, allowance 789 ms, 5 of 10 inside it".
3. **The pass rule.** Each warning has an **allowance**: the time a person may take while the rule's 200 ms reserve stays untouched. It is the wind-up minus the device, acceleration, escape and reserve terms, which is Stage 4's Margin plus 500: 749 ms for Ember Cone, 789 for Tail Sweep, 807 for Slag Rain, 828 for Slagburst, 833 for Rootquake, 863 for Overhead Slam, and 907 to 1,046 for the other five. On the reference phone, in the owner's hand, for three ordinary monsters (one cone, one circle on the hero, one circle around the monster) and for the boss: at least 9 of 10 warnings cleared, **and** three of four answers inside that warning's allowance.
4. **If it fails**: set `TELEGRAPH_TIME_SCALE` to 1.15, for everyone, and re-run Stage 4's proofs with it. This is the remedy the owner already chose. It also settles the trackpad.

The lead's expectation, stated so the owner is not surprised: the estimated thumb answers in about 850 ms, which is outside the allowance of five warnings: Ember Cone, Tail Sweep, Slag Rain, Slagburst and Rootquake, the same five that lose the reserve in the table (four are the boss's). If the estimate is right, step 3 fails on those and the 15% is applied; with it every allowance grows by 225 to 300 ms and all eleven clear 850 ms. The estimate may be wrong in either direction, which is why the phone is measured before anything is changed.

Considered and not proposed: **longer warnings on touch only.** It would leave mouse play exactly as approved, but it makes two sets of fight rules that Stage 4's models must both prove, it makes a device's input a rule input, and it sits badly with the plan to keep the rules ready for co-op. **Acting on contact instead of on lift during a warning** would win back the 100 ms, but then every camera drag begun during a warning would start with a walk order.

**Other things Stage 4 adds:**

| Stage 4 adds | What touch does with it |
|---|---|
| **One click on open ground answers a warning.** | One tap. The shapes are never click targets (its 6.5), so a tap on a shape is a tap on the ground. The tolerance rule stands aside during a warning (6.3). |
| **"A click on the monster the hero already targets, within stop distance, is a ground click."** | Touch needs the same rule and gets it only if it lives in the shared pick path. Requirement R4.2. |
| **The altar's right-click entry "Take the Lantern Vow".** | A long press on the altar lists it, because the long press calls the same list builder. Its chat hint must not say "right-click". Requirement R4.3. |
| **Auto-retaliation** when hit with no target, no walk and no key held. | Works as designed: a touch player never holds a key. Nothing to change. |
| **Eating and praying in a fight.** | A dock tab, then the slot: two taps the first time, one after that, because the sheet stays open and does not cover the hero. On the checklist. |
| **The boss bar, the phase banner, the low-health vignette.** | The bar takes the target display's place (7.2). The banner and vignette are CSS and stay inside the safe areas. Requirement R4.5. |
| **Hit stop, camera kick, rumble.** | Unchanged; all drawn. Control is never lost, on touch as on a mouse. |
| **Audio created inside the first gesture.** | Needs the finger's lift among the gestures. Requirement R4.4. |

Requirements on Stage 4. Each says what Stage 7 does if it is not met, so none of them blocks Stage 4:

- **R4.1** `TELEGRAPH_TIME_SCALE` is the single multiplier of every wind-up, read when a wind-up starts. (Its design says so.)
- **R4.2** The "already-targeted monster within stop distance counts as ground" rule is applied inside the function every pointer path calls (`handleWorldClick` or what replaces it), not in the `mousedown` listener. *If not: Stage 7's task T6 moves it.*
- **R4.3** The vow entry is added where the options list is built (`onGameContextMenu`'s list), and the chat hint says "the altar's options" rather than naming a mouse button. *If not: T6 moves the entry; the wording gets a touch variant (7.7).*
- **R4.4** The audio unlock listens for `pointerup` (or `touchend`), `click` and `keydown`, and stays armed while the context is not running. *If it listens only for the touch-down: Stage 7 adds the lift.*
- **R4.5** The boss bar, the phase banner and the vignette are positioned by CSS classes, not by pixel numbers set from script.
- **R4.6** The engine can ask "is a wind-up aimed at the hero live?" (it must already, for the auto-retaliation guard) and receives each wind-up's start with its attack id. Stage 7 uses both for the tolerance exception, the reaction log and the buzz.

### 9.3 Stage 5: the visual pass

| Stage 5 adds | What touch does with it |
|---|---|
| **The interface identity**: `--ui-*` tokens, chamfered panels, two type faces, slots and menu rows that are real buttons, a focus ring. | Stage 7 uses those tokens and adds no colour, face or shape of its own. Buttons everywhere is exactly what touch wants. |
| **A root font size** that scales the interface up on large displays (never below 16 px) and sizes in rem. | On a phone the scale is 1. Stage 7's 12, 14 and 16 px floors are stated in rem against it. |
| **Four tiers**, Low to Ultra, with pixel-ratio caps of 1.0, 1.25, 1.5 and 2.0 and megapixel caps of 3.7 to 16.6; default Medium; software rendering starts on Low. | A phone must not start on Medium, and Low's ratio of 1.0 is too coarse for a phone's dense screen. Section 10.1 proposes both changes (CALL-7.16). |
| **The automatic step-down**: one tier down when the typical frame is over 24 ms for 4 s; never up; off once the player picks a tier by hand. | Good for phones as it is. Section 10.1 adds one step below Low for phones. The readout that cycles tiers on a click is hidden on phones so a stray tap cannot switch the step-down off (5.2 row 23). |
| **The strict content policy** with the 38 inline handlers replaced by one delegated click listener. | Stage 7 adds no inline handler and no inline script. A manifest is same-origin and is allowed by `default-src 'self'`. "Move this save" uses a text box and the clipboard, which the policy does not restrict. Stage 5's policy test must still pass unedited. |
| **Reduced motion.** | The sheets' slide and the dock's transitions are off under it. The buzz is off under it. |
| **The minimap** drawn at the device's pixel ratio. | It must stay sharp at 112 px. Requirement R5.4. |
| **Modal windows** with dialog roles, focus moved in on open and returned on close. | Focus must not land in a text box on touch (7.6). Requirement R5.3. |

Requirements on Stage 5, each with the fall-back:

- **R5.1** Every hover rule sits inside `@media (hover: hover)`. *If not: Stage 7's stylesheet neutralises them under `data-input="touch"`, which is longer and more fragile.*
- **R5.2** The delegated listener handles `click`, not `mousedown`. (Its design says `onclick` becomes `data-action`.)
- **R5.3** On opening a window, focus goes to the window or its close button, never to `#bank-search`.
- **R5.4** The minimap's drawing size follows its CSS size and the pixel ratio, and nothing but `input.ts` assumes 198 px.
- **R5.5** The starting tier is chosen in one function and the pixel budget in another, so Stage 7 can extend both without editing the tier table.
- **R5.6** Stage 5's tests that scan `styles.css` (no font under 11 px, no absolute URL, no `backdrop-filter`, the token names) are written so a second stylesheet can be added to their list. Stage 7's own test applies the same scans to `touch.css`.

### 9.4 Stage 6: requirements, not tasks

Stage 6 (quests with dialogue, dungeons, a diary) is being designed now. Stage 7 builds none of it. For touch to serve it, its interfaces must provide:

- **Dialogue choices are buttons**, each at least 44 px tall and as wide as the dialogue box, one per row. Never revealed by hover, never chosen only by a number key.
- **Dialogue advances by a visible "Continue" button**, not only by a key or by a click anywhere.
- **The dialogue box sits at the bottom**, above the dock and inside the safe areas, and never covers the hero.
- **The hero is safe while a dialogue is open**, or the dialogue closes when the hero is hit. A player with a full-width box under their thumb cannot dodge.
- **Journal and diary are windows of the existing kind** (`.modal-window` with a scrolling body), so they become full-screen sheets on a phone with no extra work. No fixed width over 320 px inside them, and scrolling in one direction only.
- **Nothing is told only by `title` or by hover.** A description that matters is on the page or behind a long press.
- **No drag-and-drop, and no keyboard-only action.** Every shortcut has a button.
- **Things to use in the world** (dungeon doors, levers, quest characters) are ordinary interactive hit volumes at least 0.55 units in radius, with their extra options added where the options list is built.
- **Any text box** has 16 px text.
- **Any timed challenge** uses Stage 4's single time scale, so the phone's answer to CALL-7.15 covers it.
- **Dungeon corridors are checked with the upright camera** of 7.8: a 39° view in a narrow corridor is the hardest case for the camera.

---

## 10. Performance, heat and memory on phones

### 10.1 The starting tier and the pixel ratio (CALL-7.16)

A phone's problem is not the number of pixels. A 390 by 844 phone at a ratio of 2 draws 1.3 megapixels, less than a 1080p monitor at 1. Its problems are a weak graphics chip per pixel, heat, and a battery.

- **A phone starts on Low.** Low has no shadow pass, no ground cover, no particles, no clouds and no bloom (Stage 5's tier table). "A phone" is: the primary pointer is coarse and the shorter side of the screen is under 600 CSS px. **A tablet starts on Medium**, as a desktop does, and the step-down handles a weak one.
- **A pixel floor for small screens.** Low caps the ratio at 1.0, which on a phone is 390 pixels across, visibly blocky on a screen that has three times that. On viewports under 0.6 megapixels of CSS area, the ratio is raised until about **1.0 megapixel** is drawn, never above 2.0 and never above the device's own ratio. A 390 by 844 phone then draws at 1.74. Desktop windows are larger than 0.6 megapixels, so no desktop tier changes.
- **One step below Low, on phones.** When the step-down fires on Low, it drops the pixel floor (the ratio returns to 1.0) and says so in the chat. That is the last step.

All three are pure functions with tests (`startTier`, `pixelRatioFor`).

### 10.2 Frame rate, battery and heat

- **A cap of 60 frames a second on touch.** Many phones and tablets refresh at 120 Hz, and drawing 120 frames doubles the work for no gain a player of this game can feel. A frame is skipped when less than 15 ms have passed since the last one drawn. That gives 60 on a 60 Hz or 120 Hz screen and 45 on a 90 Hz screen (every second frame), which is accepted: it is steady, and above the budget. Desktop is not capped (a 144 Hz monitor keeps its 144).
- **No 30-frame mode is built now.** It is the remedy if the heat or battery budget below fails, and it is one number.
- **No screen wake lock.** The game is played by tapping; the screen does not dim under a player who is playing.
- The renderer asks for the high-performance GPU (`renderer.ts` 116). On a phone that hint does nothing; it is left alone.

### 10.3 Budgets, and how each is measured on the reference device

The reference phone and tablet are the owner's own (CALL-7.17 names them). Numbers are read from the performance readout, which is visible while the hidden tools are revealed, or over a USB cable with the browser's remote inspector.

| Budget | Value | How it is measured |
|---|---|---|
| Frame time, Low **with** the pixel floor, three places (start town, Cinderstep Pass, the boss arena) | typical frame at most **24 ms**, which is Stage 5's own step-down line, so the phone keeps its sharp picture; goal 16.7 ms | The readout's frame time, watched for 60 s at each place. The chat says so if the step-down fires. |
| Frame time after the last step (Low, ratio 1.0) | typical frame at most **33 ms** (30 a second). A phone that needs this step is still supported, with a coarser picture; a phone that misses 33 ms here is not | The same, after the step. |
| Heat | after **20 minutes** of play the typical frame is within 20% of its value at minute 2, and the step-down has not fired between minute 2 and minute 20 | Read at minute 2 and minute 20 in the same place. |
| Battery | at most **10% in 30 minutes** at half brightness | Battery percentage before and after. |
| Memory | no reload of the page in 30 minutes that include five trips to another app; geometry and texture counts flat | The page does not restart; `renderer.info.memory` at minute 2 and minute 30 (the leak check Stage 1 already defined). On Android, the JavaScript heap stays under 250 MB in the remote inspector. |
| First load | first frame within **8 s** on home Wi-Fi, cold cache | A stopwatch from the tap on the link. |
| Pixels drawn on a phone | about 1.0 megapixel, ratio between 1.0 and 2.0 | The readout's ratio line, and the unit test. |
| Size of this stage | at most **+12 kB** of minified JS and **+8 kB** of CSS over what Stage 5 leaves; no new font, image or model except the three icons of CALL-7.13 | The build output. |

### 10.4 Memory, and the page being killed

A phone browser discards a page it needs memory from, and reloads it when the player returns. The design assumes this **will** happen:

- The game has saved before it can (8.5).
- A reload restores position, camera and time of day, as on a desktop today.
- Losing only the graphics context shows the Reload card (8.5).
- Nothing is kept only in memory that a player would miss: the reaction log and the revealed tools are tools, not progress.

### 10.5 What a slow phone does to Stage 4's timing

- **Under 12.5 frames a second**, the loop caps each step at 0.08 s (`loop.ts` 774), so the rules' clock runs slower than the wall clock and every warning lasts longer in real time. A slow phone can only give the player more time, never less. This is Stage 4's own argument, and nothing in Stage 7 changes the cap.
- **Between 12.5 and 30 frames a second**, a tap is seen up to one frame late and its effect is drawn one frame after that. Both frames are inside Stage 4's 160 ms device term.
- **A hitch** (a tier step-down compiling shaders in the middle of a fight) is one long frame, capped the same way.
- **The 60-frame cap** costs nothing here: 16.7 ms per frame against a 160 ms allowance.
- **The pause card** (8.5) means a warning never runs out while the phone was in a pocket.
- What a slow phone does *not* do is slow the thumb. The +150 ms of 9.2 is the same on every phone, which is why the remedy is a time scale and not a graphics setting.

---

## 11. Proof

Touch can only be judged in the hand. So the proof has three parts, and the stage needs all three.

### 11.1 Automated, in vitest (no DOM)

| Goal | Test file and what it asserts |
|---|---|
| G7.2 | `tests/gestures.test.ts`, driven by arrays of `{type, id, x, y, t}`: a press lifted at 120 ms within 9 px is one tap at the lift, with no other event. A press that moves 11 px is a drag, and lifting it gives no tap. The first drag step carries no jump. A press held to 499 ms then lifted is a tap; held to 500 ms it is one long press and the lift gives nothing. A second finger cancels a forming tap and gives pinch ratios (gap doubled gives 0.5 of the distance). After one of two fingers lifts, the other gives nothing until all are up. A third finger is ignored. A cancel in every phase returns to idle with no action. An unknown pointer id is ignored. A thousand seeded random sequences never throw and always end idle once every pointer is up or cancelled. |
| G7.3 | `tests/pick.test.ts`: a tap inside a 60 px circle picks it; a tap 20 px from the centre of a 16 px circle picks it (the 24 px floor); 25 px away picks nothing. Of two overlapping circles the proportionally closer wins; a near tie goes monster, station, resource, then nearer. The current target is never returned. With the "warning live" flag set, nothing is returned. With the pointer type "mouse", nothing is returned. |
| G7.5, G7.6 | `tests/touch-css.test.ts`, a text scan of `index.html` and `src/ui/touch.css`: the viewport tag has `viewport-fit=cover` and neither `user-scalable` nor `maximum-scale`; the canvas container has `touch-action: none`; the root has `overscroll-behavior: none`; `100dvh` is present with a `100vh` fall-back before it; all four safe-area insets are used; `-webkit-touch-callout: none` is present; no font size under 12 px and no `:hover` outside a hover query in `touch.css`; text boxes are 16 px under touch; every rule in `touch.css` is inside a phone media query or under `html[data-input="touch"]`, except a named list of global rules. |
| G7.7 | `tests/touch-timing.test.ts`: recomputes the table of 9.2 from Stage 4's attack table and asserts that at a scale of 1.15 every row keeps 200 ms with 250 ms added to the person; that each attack's allowance equals its Margin plus 500; and that the reaction log is a ring of 64 that reports, per attack, the warnings seen, the number cleared, the typical answer and the number inside the allowance. |
| G7.8 | `tests/view.test.ts`: `fovForAspect` returns 50 for every aspect of 0.78 and above, 75 at 0.46, about 52 at 0.75, and never leaves 50 to 75; `startTier` returns Low for a coarse pointer with a short side under 600 and Medium otherwise, and Low for software rendering as Stage 5 has it; `pixelRatioFor` draws 0.95 to 1.05 megapixels on a 390 by 844 viewport with a device ratio of 3, never exceeds 2.0 or the device ratio, and returns the tier's own cap on a 1280 by 720 viewport; the frame cap skips a frame at 8 ms and at 11 ms and draws one at 16 ms. Each function is also given zero, negative, infinite and missing inputs and returns a value inside its range. |
| G7.9 | No file that exists under `tests/` or `src/__tests__/` before this stage is edited (`git diff` at the gate). `tests/input-keys.test.ts` passing unedited proves `setupInputHandlers` still runs against its bare stub. |
| G7.10 | The gate reads `git diff -- package.json`: no change to `dependencies` or `devDependencies`. Stage 5's policy test passes unedited. |
| CALL-7.9, if taken | `tests/save-transfer.test.ts`: the export of a state, imported, equals what `migrateLegacySave` gives for the same state; the hostile fixture imports to the same sanitised state the existing hardening test expects; text that is not JSON, an empty string, an array, a number and a string of 262,145 characters are each refused with a reason and without a throw. |
| CALL-7.13, if taken | `tests/manifest.test.ts`: the manifest parses, its start address and scope are `/`, each icon file exists, and no file under `src/` mentions a service worker. |

### 11.2 Automated, in a browser at phone sizes

A written recipe, run by an agent with the Playwright MCP browser that made the Stage 2 captures (session tooling; no package is added). It is not part of the test suite, because the suite has no browser. It runs headless on a software renderer at a few frames a second, so, like those captures, **it says nothing about speed or feel**.

- Viewports: 360 by 640, 390 by 844, 700 by 900, 640 by 360, 844 by 390, 768 by 1024, 1024 by 768, each with touch and a mobile pixel ratio switched on; and 1280 by 720 and 700 by 900 with a mouse.
- **The first task of the plan finds out whether that browser can emulate touch** (a context with touch enabled, and two-finger input through the browser's debugging protocol). If it cannot, the recipe falls back to dispatching synthetic pointer events with pointer type "touch" on the canvas, which drives the same listeners.
- At each phone size, read through `window.__DEBUG` (`runtime.ts` 190):
  - a tap on open ground gives the hero exactly one path (one order, not two); a second tap replaces it;
  - a drag changes the camera offset and leaves the path alone;
  - a pinch changes the camera distance;
  - a long press opens the options sheet with a heading, and no walk order is given;
  - a tap on a dock tab opens the panel; a second tap closes it; the hero and the ground above the sheet stay tappable;
  - a long press on a backpack slot opens the item sheet and does not use the item;
  - no stuck tooltip after any of these;
  - with the bank open, focusing the search box does not move or resize the 3D view.
- **Measured from the page at each size**: no two of the interface's blocks overlap; nothing lies outside the viewport; every visible button, tab, slot and sheet row is at least 44 by 44 px (the recipe lists any that is not); no text is under 12 px.
- **Desktop unchanged**: at 1280 by 720 with a mouse, the position and size of every interface block equal the values recorded before the stage's first change. A click, a right-drag, the wheel, a right click, hover and each of F1 to F6 do what they did. At 700 by 900 with a mouse and the panel closed, F3 opens the backpack.
- Screenshots of every window at every size go to `docs/superpowers/baseline/s7-touch/` for the owner to look at.

### 11.3 In the hand: the owner's checklist

Run on a real phone and a real tablet (CALL-7.17), upright and on its side, each item answered yes or no. What to look for is written beside each.

**Moving and acting**
1. Tap the ground a few paces away, then far away, then across the river. *The hero walks there, by the bridge; the cross appears once, where you meant. No tooltip is left on the screen (if one is, the browser is still sending its made-up mouse events).*
2. Tap a monster, a tree, the banker. *The right thing is chosen. Try a far, small one on a sideways phone.*
3. In a crowd of goblins, tap the ground between them. *The hero walks; a goblin is not attacked by mistake.*
4. Drag to turn, pinch to zoom, both in the middle of a walk. *No walk order is given by a drag; the camera does not jump when a finger lifts after a pinch.*
5. Tap quickly and sloppily, as in a fight, twenty times. *Count the taps read as drags (the hero does not move). More than one in twenty means the 10 px slop is too small.*
6. Press and hold a monster, the ground, the altar. *The sheet opens once, not twice (Android), and no system menu or text selection appears (iPhone).*

**Reading**
7. Read every text at arm's length indoors, then outdoors in daylight. *Vitals, chat, the target display, a warning shape on grass and on ash.*
8. Press and hold a backpack item, a prayer, a spell, a skill. *The description appears; nothing is eaten or toggled.*

**Windows**
9. Bank: withdraw, deposit, search for "rune". *The keyboard does not cover the box or the results; the page does not zoom; the keyboard stays up while typing; the layout does not rearrange itself when the keyboard rises.*
10. Shop: buy, sell a fish, sell a sword. *The sword asks first; nothing is sold by a neighbouring tap.*
11. Forge, world map, quests, settings. *Everything is reachable by scrolling; the close button is easy to hit.*

**Fights (after Stage 4)**
12. Fight a King Scorpion, a Hill Giant and a Moss Guardian; answer ten warnings of each. Then the boss. *The Settings lines give, per attack, the count cleared and the answers inside the allowance (9.2). Note whether the shape is fully on screen when upright.*
13. Eat during a fight. *Two taps at most; the hero stays visible.*
14. Die. *The notice is readable; the game continues after it.*

**The phone being a phone**
15. Pull down, pinch on a panel, swipe from each edge, rotate. *No reload, no page zoom; after a rotation everything is in place within a second.*
16. Take a call or switch apps in a fight; come back. *The pause card; the fight is where you left it. Close the browser entirely; open again. Progress is there.*
17. First sound after the first tap (iPhone: with the mute switch off).
18. Play for 20 minutes. *Read the frame time at minute 2 and minute 20, and the battery. Is the phone hot to hold?*
19. A tablet with a mouse or a keyboard attached: use both. *Mouse and keys behave as on a desktop.*
20. On a desktop, with a mouse: the smoke list of the Stage 1-2 plan's final verification. *Nothing has changed.*

---

## 12. Save format, and what is stored

Stage 7 adds, removes and renames no saved field. Not stored: the graphics tier (as today), the input in use, the revealed tools, the reaction log, the panel being open or closed. Two new `localStorage` keys may appear, both outside the save: the one-slot backup made before a save is replaced by "Move this save" (CALL-7.9), and nothing else. Stage 2's and Stage 3's save goldens pass unedited.

The upright camera's 10-unit floor is applied after loading and is not a save change: `sanitizeCam` (`save.ts` 231-238) is not edited.

---

## 13. Threat model

### 13.1 What are we working on?

A single-player browser game served as static files. No server, no account, no network call from game code. What Stage 7 adds:

| Flow | Source | Trust | Ends in |
|---|---|---|---|
| Pointer events from fingers and pens | The device | Untrusted in sequence and value: events can arrive out of order, stop without an end, or carry odd numbers | The recogniser, then the same actions a click reaches |
| Viewport size, pixel ratio, pointer kind, safe-area insets | The device | Untrusted in range | Layout, camera angle, tier, render size |
| Pasted save text (CALL-7.9) | The player, or someone who gave it to the player | **Untrusted** | `importSaveText`, then `migrateLegacySave`, then `localStorage` |
| Copied save text | The game | Ours | The clipboard |
| Manifest and icons (CALL-7.13) | Our own static files | Ours | The browser's install flow |
| Seven taps on a title (CALL-7.11) | The player | The player | The reveal function |

Trust boundaries: the device (events and sizes), the paste box (the one new place where outside data enters), and the response headers (unchanged).

### 13.2 What can go wrong?

| # | Failure |
|---|---|
| W1 | A touch never ends (the finger slides off, a call arrives): the camera turns forever, or the dragging flag stays set and the camera never returns behind the hero. |
| W2 | One tap gives two orders: ours and the browser's made-up mouse event. |
| W3 | One long press opens two menus (Android), or the system's menu over ours. |
| W4 | A long press on a slot also uses the item when the finger lifts. |
| W5 | A mis-tap sells, eats or spends. |
| W6 | The tolerance pulls a dodge onto a monster and the hero dies standing still. |
| W7 | The browser takes a gesture (zoom, reload, back) in the middle of a fight. |
| W8 | Pasted text is not a save: broken JSON, megabytes of it, a hostile save with absurd numbers, unknown ids, markup in a name, keys meant to poison an object's prototype. |
| W9 | A good paste replaces a character the player wanted to keep. |
| W10 | Absurd device values (a ratio of 0 or 40, a viewport of 0 by 0, an aspect that is not a number) size a render target or a camera angle. |
| W11 | The graphics context is lost and the game looks alive but is not; or the page is discarded before a save. |
| W12 | Storage is refused or full (private mode), or emptied by the browser after a week away. |
| W13 | A flood of pointer moves (240 a second from a stylus) starves the frame. |
| W14 | The pause card hides a fight that is still running. |
| W15 | The hidden tools become easy to find. |
| W16 | A home-screen copy pinned to an old build, or a manifest that sends the player elsewhere. |
| W17 | A player who needs page zoom can no longer read the game. |
| W18 | The reaction log grows without end, or leaves the device. |
| W19 | Touch changes break mouse or keyboard play. |

### 13.3 What are we going to do about it?

| # | Response |
|---|---|
| W1 | Mitigate. The pointer is captured, so its end is delivered even off the canvas. `pointercancel`, lost capture, losing focus and the page being hidden all reset the recogniser to idle and clear the dragging flag. The seeded test proves the recogniser always returns to idle. |
| W2 | Mitigate. `preventDefault()` on the touch `pointerdown`; the touch listeners ignore the mouse; the browser recipe asserts one path per tap. |
| W3 | Mitigate. The right-click handlers ignore a finger and still cancel the system menu; the callout is off in CSS. Device check 6. |
| W4 | Mitigate. The click after a recognised long press is swallowed once. Browser recipe. |
| W5 | Mitigate. 44 px controls; the sell question for equipment on touch (CALL-7.10); spending only by labelled buttons. Accept: eating and burying stay one tap. |
| W6 | Mitigate. Exact hit first; never onto the current target; never during a warning. Tests in `pick.test.ts`; device check 3 and 12. |
| W7 | Mitigate. `touch-action`, `overscroll-behavior`, safe areas. Accept: the system's back gesture cannot be blocked; the game has saved. |
| W8 | Mitigate. Size limit before parsing; parse inside a try; then the existing reader, which already clamps numbers, checks every id against the game's tables and builds its result from a fresh default state, so no pasted key is ever copied onto an object. The text is never written as HTML. The function returns a reason and never throws. Test with the hostile fixture. |
| W9 | Mitigate. A question before replacing, and a one-slot backup of the replaced save. |
| W10 | Mitigate. `fovForAspect`, `startTier` and `pixelRatioFor` validate their inputs once, at the boundary, and clamp to their ranges; tested with zero, negative, infinite and missing values. Stage 5's megapixel caps still apply above them. |
| W11 | Mitigate. Save on `pagehide` as well as on hidden; a Reload card on context loss. |
| W12 | Mitigate. `storage.persist()` is asked for; "Move this save" lets a player keep a copy; the existing "Save failed" label still shows a refused write. Accept the remainder: a browser may still delete a site's data, and the game cannot prevent it. |
| W13 | Mitigate. The move handler only adds to two numbers; no ray is cast on a move. |
| W14 | Mitigate. While the card is shown the loop draws and steps nothing; the first frame after the tap starts with a zero step. |
| W15 | Accept. It is as findable as a typed word, and it changes only the player's own single-player game. |
| W16 | Eliminate the first: no service worker, so the home-screen copy loads the current build like any tab. Mitigate the second: start address and scope are `/`, checked by a test. |
| W17 | Accept, with reason and in the open (CALL-7.8): page zoom does not make this interface readable; larger text in the phone layouts and the system's own zoom do. |
| W18 | Mitigate. A ring of 64 entries, in memory, never stored, never sent. |
| W19 | Mitigate. The edits to existing input code are the short list of 6.1 and nothing else, each with a default that reproduces today's result; the gate reads that diff line by line; frozen tests; the desktop layout comparison; the F1 to F6 check of 11.2; device check 20. |

### 13.4 Did we do a good enough job?

By the tests of 11.1 for everything that is logic; by the browser recipe of 11.2 for wiring and layout; by the checklist of 11.3 for feel, heat and the two phone platforms. The boundary that matters most, pasted text, has its own test with the hostile fixture and five kinds of non-save. If the device check finds a gesture the browser still takes, or a threshold that does not suit a thumb, the fix is a constant in the gesture table or a CSS rule, and the check is run again. The stage is not accepted on the automated parts alone.

---

## 14. Decisions for the owner

Each is the lead's proposal. The real trade-off comes first, the recommendation after. "Section" says where the detail is.

| # | The decision, and what it costs either way | Recommendation | Section |
|---|---|---|---|
| **CALL-7.1** | **What Stage 7 is.** Touch and small screens only. Compression stays shelved until the models grow past 6.0 MB on the wire or a phone runs out of memory because of them. Nothing in the rules, the content or the save changes. | Accept. | 1, 2 |
| **CALL-7.2** | **The gestures.** Tap to walk and act, drag to look, pinch to zoom, press and hold for options. No joystick and no action buttons, so the game stays click-to-act and the thumbs stay off the ground; the price is that a phone cannot walk by holding a direction and cannot jump. No double-tap meaning, so a single tap never waits. | Accept. A joystick would make it another game, and jumping changes no rule. | 5.1, 6.2 |
| **CALL-7.3** | **How it is built.** Touch is added beside the mouse code, not merged into it. Two sets of listeners live in one file; in exchange the mouse listeners keep their behaviour, and the few lines of existing input code that are edited are listed one by one. | Accept. | 6.1 |
| **CALL-7.4** | **Fat-finger help.** A tap near a small thing counts as on it, up to a 48 px target. Too generous and it would grab taps meant for the ground, so it never applies to the monster already being fought and never during a warning. A mouse gets none of it. | Accept. | 6.3 |
| **CALL-7.5** | **The phone layout.** A dock of tabs along the bottom; the panel rises from it and is closed by default, so the world is seen first and the backpack is one tap away rather than always on screen. The three top buttons move under "More". The chat shrinks to three lines that taps pass through. The Slayer widget and the performance readout are not shown on a phone. On a sideways phone the backpack is 7 across and 4 down instead of 4 by 7. | Accept. The alternative, keeping today's blocks and shrinking them, leaves every target too small. | 7.2, 7.3, 7.5 |
| **CALL-7.6** | **The smallest screen promised**: 360 by 560 upright, 640 by 320 sideways; both ways up, never locked. Promising 320 px wide phones too would cost a fourth layout for very few players. | Accept. | 7.1 |
| **CALL-7.7** | **The camera on an upright phone**: a wider view (up to 75° tall instead of 50°) and a start no closer than 10 units. Without it Stage 4's warning shapes run off the sides of the screen. With it, an upright phone has a slightly wide-angle look. Desktops and sideways phones are unchanged. | Accept, and judge the look on the phone. | 7.8 |
| **CALL-7.8** | **Page zoom is switched off inside the game.** Pinch belongs to the camera. A player who enlarges web pages by pinching loses that here; the phone layouts carry larger text instead, and the phone's own accessibility zoom still works. Leaving page zoom on means a stray pinch on a panel slides the interface off the screen in a fight. | Switch it off. | 8.1 |
| **CALL-7.9** | **"Move this save".** A phone starts a new game, because the save lives in one browser on one device; and an iPhone may delete a site's data after a week away. A copy-and-paste box in Settings lets a player carry a character across and keep a copy. It is a new place where outside text enters the game, so it goes through the same checks as every loaded save and has its own tests. A player can edit the text, as they can edit the save today. Cost: two tasks. | **Add it.** Without it the owner cannot test late-game play on the phone except with the tools of CALL-7.11, and a phone player can lose a character to the browser. | 8.4 |
| **CALL-7.10** | **Ask before selling equipment, on touch only.** After Stage 3 a sold piece costs about fifteen times as much to buy back, and on a phone the neighbouring item is one fat finger away. The price is one more tap for every piece of gear sold on a phone. | Ask. Only for equipment, only on touch. | 6.5 |
| **CALL-7.11** | **A way into the hidden tools on a phone.** You accepted in Stage 3 that a device with no keyboard cannot reach them. This would change that: seven quick taps on the Settings title reveal them until reload. It is no easier to find than a word nobody is told. Without it, checking Stage 4's fights on a phone needs a carried-over save. | **Add it**, because your own checks on the phone need it. Decline it and nothing else changes. | 9.1 |
| **CALL-7.12** | **A short buzz** when a press-and-hold is recognised and when a warning starts. Android only; iPhones give web pages no vibration. Off under reduced motion. | Add it. It is three lines. | 6.6 |
| **CALL-7.13** | **Full screen and a home-screen shortcut.** A "Full screen" button where the browser offers one (Android, tablets). A small manifest and three icons so the game can be added to the home screen, which is the only way to lose the browser's bars on an iPhone and also protects the save from the one-week rule. **No offline support**: it needs a service worker, and a mistake there strands players on an old build. The catch: an iPhone's home-screen copy does not see the character played in the browser tab. | **Add both, only if CALL-7.9 is taken**, so that catch is one copy and one paste. | 8.6 |
| **CALL-7.14** | **Pause on return.** On touch, when the game comes back after more than 3 seconds away, it waits behind "Paused. Tap to continue." Otherwise a fight resumes the instant the phone is unlocked. Desktop is unchanged. | Add it. | 8.5 |
| **CALL-7.15** | **Stage 4's warnings on a phone.** By the arithmetic a thumb is about 150 ms slower than a mouse, because a touch can only act when the finger lifts. Every warning can still be answered, but five of the eleven lose the 200 ms of safety the rule promises, four of them the boss's. Your decision on CALL-4.16 was: leave them, test, and if the test fails make every warning 15% longer for everyone. This applies the same decision to the phone, with a measurement the game takes itself and a pass rule stated per warning (does the answer leave the 200 ms untouched). The alternatives: lengthen them now without measuring (simpler, and mouse players get easier fights without evidence); or lengthen them on touch only (two sets of fight rules to prove and keep). | **Measure on the phone, then apply the 15% for everyone if it fails.** If the 150 ms estimate is right, it will fail on five warnings, four of them the boss's. | 9.2 |
| **CALL-7.16** | **Phones start on Low**, drawn at about one megapixel rather than Low's blocky ratio of 1.0, and capped at 60 frames a second on touch. Tablets start on Medium. This extends Stage 5's tier rule (its CALL-V5) for small screens only; no desktop tier changes. The price is that a strong phone starts below what it could show, and its owner must raise the tier by hand. | Accept. Heat and battery are the phone's real limits, and stepping up automatically is something Stage 5 chose never to do. | 10.1, 10.2 |
| **CALL-7.17** | **Which phone and tablet are the reference**, and whether an iPhone is among them. Everything in section 16 is checked on those. If no iPhone is available, iPhone behaviour stays unverified and the README says "tested on Android". | The owner names them (plan step O-2). | 10.3, 11.3 |
| **CALL-7.18** | **Size.** This stage may add up to 12 kB of JS and 8 kB of CSS over Stage 5's budget, and three icon files if CALL-7.13 is taken. | Accept. | 10.3 |

---

## 15. Risks

| # | Risk | Likelihood | Effect | Response |
|---|---|---|---|---|
| K1 | An iPhone behaves differently from the published rules this design relies on (`touch-action` on the root, audio unlock on lift, no `contextmenu`, the callout). | Medium | A gesture is taken by the browser, or there is no sound. | Each is on the device checklist. The known fall-back for a stubborn pinch zoom is one non-standard `gesturestart` listener for that browser only; it is not built unless the check fails. |
| K2 | Stage 5 lands with a stylesheet shaped differently from what section 7 assumes. | High | Layout tasks need other selectors. | Layout is described by element id and by intent, and R0 re-reads the landed CSS before any layout task. The ids (`#right-panel`, `#chatbox`, `#minimap-wrapper`, `#top-left-hud`) are fetched by script today, so they are unlikely to change. |
| K3 | The browser the agent drives cannot emulate two fingers. | Medium | Pinch is not covered by 11.2. | Synthetic pointer events drive the same listeners; the recogniser's own tests cover pinch fully; the device check covers the rest. |
| K4 | 10 px is too little slop for a thumb in a fight. | Medium | Dodge taps are read as tiny drags and nothing happens. | One constant. Device check 5 counts it. |
| K5 | The upright camera looks distorted, or Stage 6's corridors are too tight for it. | Medium | The upright phone looks wrong. | The ceiling (75°) and the floor (10 units) are two constants; lowering the ceiling trades look against how much of a warning fits. |
| K6 | The phone misses 24 ms with the pixel floor, or 33 ms after the last step. | Medium | A coarser picture in the first case; an unpleasant game in the second. | The step below Low is automatic. Past it: a 30-frame cap, then the owner decides whether that phone is supported. |
| K7 | The measurement of CALL-7.15 fails and the 15% changes Stage 4's proofs. | High | Stage 4's models are re-run at 1.15; the boss's volley slows slightly. | Stage 4 designed the constant for this, and the owner chose this remedy. The re-run is a planned task, not a surprise. |
| K8 | A laptop with a touch screen switches to large controls when its screen is touched once by accident. | Low | The layout changes size for that session. | It lasts only until reload. Accepted. |
| K9 | Stage 6 lands interfaces that ignore section 9.4. | Medium | Dialogue is not usable on a phone. | The requirements are sent to that stage's design now; R0 or a follow-up task checks them. |
| K10 | The home-screen copy on an iPhone confuses a player who expected their character. | Medium | "My save is gone." | CALL-7.13 depends on CALL-7.9, and the first-run card of a new game says in one line that saves are per device and where "Move this save" is. |

---

## 16. What could not be verified without a real device

Nothing was run for this document. Beyond that, these can only be settled with a phone and a tablet in the hand:

- Whether the gestures **feel** right: the 10 px slop under a hurried thumb, the 500 ms hold, the drag and pinch speeds, the 48 px tolerance in a crowd.
- The **150 ms** thumb penalty of section 9.2. The contact time can be measured exactly by the game; the reach time and the panel's delay are estimates until the reaction log has real answers.
- Whether Stage 4's shapes are **fully visible** on an upright phone with the camera of 7.8, and whether that camera looks right.
- Every **iPhone** behaviour: that cancelling `pointerdown` really stops the browser's made-up mouse events, which the "one tap, one order" design rests on (the fall-back, if it does not: the mouse listeners ignore events that arrive within half a second of a finger, one more guard of the kind 6.1 lists); that `touch-action` on the root stops page zoom, that audio unlocks on the finger's lift, that no system menu or magnifier appears on a long press, that a text box at 16 px does not zoom the page, how the keyboard moves the page, the seven-day storage rule, and the home-screen copy's separate storage. If no iPhone is available (CALL-7.17) these stay open.
- **Android's** double menu on a long press, its back gesture, whether `overscroll-behavior` stops the pull to reload on the owner's browser, and whether that browser resizes the page for the keyboard (which could switch the layout while typing).
- **Frame time, heat, battery and memory** on a real graphics chip. The agent's browser runs a software renderer at a few frames a second and says nothing about any of them.
- **Readability outdoors.**
- Whether **safe-area insets** are right on the owner's notch and home bar.
- Whether the agent's browser can **emulate touch** at all (the plan's first proof task finds out).
- Everything section 9 assumes about **Stages 3, 4 and 5**, which are designs and not yet code. Plan task R0 exists for that.

---

## Review log

No independent critique has been run on this document. Run one before asking for approval, as was done for Stages 3, 4 and 5.
