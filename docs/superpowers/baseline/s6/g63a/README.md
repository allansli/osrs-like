# Slice 3a gate (G-6.3a): captures for H-3a

**H-3a is still open.** These pictures are evidence for the owner's play check. They do not replace it. The owner still has to do design 11.2's cave item on a real screen: enter at the terrace, fight both rooms, step out and back in, die inside, reload inside, teleport out; leave by the door while a Hurler winds up Pinning Volley, then be hit outside and see the hero fight back; judge the light, the seams and the camera at every yaw and pitch; read the perf HUD inside. O-6.2 still has to search "Ember Hurler".

## How the pictures were made

- **Tree:** `feat/content-systems` at `24d37dd`, which is slice 3a: C1, C2, C3 and their repairs.
- **Build and server:**
  - BUILD ran through the capped wrapper (gate status below).
  - Then `node_modules/.bin/vite preview --port 4396 --strictPort` served that `dist/` on the host.
  - The shell line checked that the port was free first. Afterwards it stopped the server by its PID and checked that nothing was left listening on 4396. The committed job does not do this.
- **Command:** `CAP_URL=http://localhost:4396/ CAP_OUT=<dir> node scripts/capture-gpu.mjs docs/superpowers/baseline/s6/g63a/capture-job.mjs http://localhost:4396/`, exit 0.
  - Every picture from `a1` to `h1` and `facts.json` come from one run of the committed job (scenes A to H), copied unchanged.
  - `i1`, `i2` and `facts-i.json` come from a second run of the same job with `ONLY=I` (scene I only, its `facts.json` renamed). Scene I was added after the first run because no earlier run had clicked the exit door in a quiet room.
  - Between the two runs the job changed only by scene I, two added counters in `caveProps` (meshes under the props, visible meshes in the cave's area) and a comment. The steps of scenes A to H are the ones that made their pictures, so `facts.json`'s `a_entry.props` has no mesh counters.
  - Earlier runs shaped the job:
    - The first scene E killed all three front-hall members, and the hero died first.
    - Two tries at the exit door after a fight failed: once the hero had died and respawned, once the fight went on. Then a quiet try failed because the door sat above the scanned band of the screen at pitch 0.5; scene I uses pitch 0.8.
    - A draw-call reader that set `renderer.info.autoReset` broke the HUD's own count. It was replaced by reading the HUD.
- **Renderer:** headless Chromium on the NVIDIA GPU, `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)` (`facts.renderer`). The job throws if it is not the NVIDIA GPU. 1280x720, quality tier `balanced`.
- **Browser state:** each scene got a fresh browser context, so storage started empty and the game began as a new game.
  - `Math.random` was seeded as in G-6.0.
  - The onboarding panel was hidden, the run waited for `look.ready()`, then waited 3.5 s for the aggression grace, and the mouse was parked on `#top-left-hud`.
- **Hero:** set through `__DEBUG.STATE`: every combat skill 70 (combat 89), and in scenes C, D and E hitpoints 99 so the hero stands a fight. The cave needs nothing (`needs: { all: [] }`). The hero has no gear. The badge reads "Combat Lv. 3" until a fight refreshes it, as in G-6.0 to G-6.3.
- **The door is used as in play:**
  - The hero stands 3.5 south of the door at (-84, 98).
  - The job finds the door by the game's own hover label ("Interact with Slagfall Terrace", `facts.*.door`) and clicks it through the game's own mousedown handler.
  - The hero walks to the door, the `enterDungeon` command runs, and the hero stands at the cave's entry (1012, 634).
  - Inside, the hero is moved with `__DEBUG.look.pose`.
- **What the job sets beyond the hero, all through the page, never in `src/`:**
  - Scene D leaves through `__DEBUG.leaveZone()`, the function the door's `leaveDungeon` command calls. A walk to the exit door is 56 units, longer than the 1.6 s wind-up.
  - Scene E sets one Lesser Demon's hp to 1 and turns on Protect from Melee by clicking its card in the prayer panel. Then it clicks that demon by its hover label ("Attack Lesser Demon (Lv-68) [1/125 HP]"), and leaves through `__DEBUG.leaveZone()` the moment the demon is down.
  - Scene H gives one air and one law rune and clicks the Lumbridge Teleport card in the magic panel.
  - The job wraps `renderer.render` in the page only to remember the last perspective camera, so it can say where the camera stood.
  - Monsters ran on the game's own loop. The job reads each cave monster from its rig group's `userData.entity` through three.js's devtools hook.
- **No page or console error** in any scene (`pageErrors` is empty in all nine).

## The pictures

| File | Scene | What the run read (`facts.json`) |
|---|---|---|
| `a1-door-overworld.jpg` | The cave mouth on the terrace, from 3.5 south | The door (two charcoal posts) between the terrace's two obsidian spires. HUD 510 calls, 442k triangles |
| `a2-entry-room.jpg` | The entry room, as the game leaves the camera after the door | The hero is at (1012, 634), the row's `entry` (12, 34). The log line is the door's prompt "Slagfall Terrace: nothing is needed." All six members are idle at their homes (`mobsOnEntry`). The props are 5 `World_obsidian_spire` and 22 `World_lava_fissure`. HUD 978 calls, 587k triangles |
| `a3-entry-room-high.jpg` | The same room from the highest pitch and the longest arm (1.15, 26) | The camera stands in the entry room (local 4.2, 31.0). The grass carpet covers the floor and the black beyond the walls (finding 1). The fissures lie as flat orange slabs across the wall lines (finding 3) |
| `a4-minimap-entry.jpg` | The minimap in the entry room | The entry room, the corridor and the front hall are drawn, with no gates, and four members as dots; the back hall is past the frame's edge at this zoom |
| `b1-corner-yaw0.jpg` to `b4-corner-yaw270.jpg` | The hero at a corner of the entry room (local 6, 28: 2 from the west wall and from the north wall, the one at local z 26; the job's north is -z), pitch 0.3, arm 14, at four yaws | At yaw 0 the camera is at local (6, 24.6), outside the north wall. At yaw 1.57 it is at (2.6, 28), outside the west wall. Both pictures show black and a few grass blades, and not the hero (finding 2). At yaw 3.14 and 4.71 the camera is inside the room |
| `b5-corner-high.jpg` | The same corner, pitch 1.15, arm 26 | The camera is inside the room (13.5, 35.5). The carpet covers the black outside |
| `c1-front-hall-from-corridor.jpg` | The hero in corridor c1 (local 25, 34), 3 s later | All six members are idle. The nearest demon is 11.7 away, outside its sight of 9 |
| `c2-front-hall-fight.jpg` | The hero one step into the front hall (29, 34), 3.5 s later | One Lesser Demon is in `attack`. "Lesser Demon attacks!" The second demon had wandered to 10.2 from the hero, beyond its sight of 9 (`after1500`), and the Hurler is 15 away, beyond its 12, so both stay idle. HUD 1,213 calls |
| `d1-hurler-windup.jpg` | The back hall, the hero at (68, 34) | 6.5 s after the pose, a Hurler is winding up `pinning_volley`, with its red circle on the hero. All three back-hall members are in `attack`. The log reads "Ember Hurler attacks!" (the hellfire orb's branch). HP 25/99 |
| `d2-left-during-windup.jpg` | Right after leaving during that wind-up | The hero is at the door (-84, 98). Every cave member is hidden, at home, `idle`, with `windup` null, and no circle is drawn. The target panel still shows "Ember Hurler 73/105" although `player.targetEntity` is null (finding 6) |
| `d3-overworld-hit-fights-back.jpg` | The hero on a scorpion's home in `dune_nest_west` (aggressive) | A scorpion hit after 11.7 s. 2.5 s later the log reads "Defeated King Scorpion (Lv-12)": the hero fought back and killed it. This stands in for H-3a's goblin, because `three_kettle` is a passive camp |
| `e1-reentry-still-dead.jpg` | The hero back in the cave after 20 s outside | The killed demon left as `dying` with 0.78 s left. Its timer was the same 20 s later (`after20sOutside`: not stepped while held). On re-entry it went on: now `dead`, 12.43 s left, hidden |
| `e2-back-after-their-time.jpg` | The same spot, once the demon is back | It returned 12.4 s after re-entry, `idle` at its home (1036, 630). That is 13.5 s of time inside from death to return, CALL-6.33 (a) |
| `f1-died-inside.jpg` | A 70 hp unarmed hero among the front hall's members | Death after 8.1 s, with the overlay over the cave |
| `f2-after-respawn.jpg` | After the respawn (2.6 s later) | The hero is at Lumbridge (0, 4). Every cave member is hidden, at home and `idle` |
| `g1-after-reload.jpg` | The page reloaded after 3 s in the entry room | Before the reload the save button read "Saved (11:22:31)". After it, the hero stands at the door (-84, 98), and the log reads "Restored your saved progress". No cave monster exists until the next entry, so a reload starts it full |
| `h1-teleported-out.jpg` | Lumbridge Teleport cast in the entry room | "Teleported to Lumbridge Haven." The hero is at (0, 4) by the bank booth, in daylight with the overworld's weather, and the cave members are hidden |
| `i1-exit-door.jpg` | Second run, scene I: the hero at the entry (local 12, 34), the camera looking north at the exit door 4 away | No fight. HUD 979 calls, 588k triangles |
| `i2-out-by-the-door.jpg` | The exit door clicked by its hover label ("Interact with Doorway (Leave)") | The hero was out 110 ms after the click (it stood inside the door's reach), at the overworld door (-84, 98). Every cave member is hidden and `idle`. HUD 189 calls |

Perf, read on the shared machine:
- **HUD in the cave:** 978 to 1,213 calls and 587k to 634k triangles a frame in the shots the job read, at 33 to 50 FPS (the HUD drawn in `b1` to `b5` shows 966 to 974). Outside the cave the job read 189 to 762 calls.
- **`look.bench(120)`:** the scene drawn 120 times with no post pass, in ms a frame. 64.6 on the overworld at the door, 132.9 in the entry room, 223.2 in the front-hall fight, 68.8 back at Lumbridge. Three runs agreed within about 20%.
- **These bench figures are unexplained.** They disagree with the HUD's 20 ms frames in the same page, and they cannot be compared with G-6.3's 7.5 ms. They are recorded, not used as evidence for any finding.

## Gate status (runs of 2026-11-27 on `24d37dd`)

Each command ran from the worktree root behind `flock /tmp/claude-capped.lock scripts/capped.sh`:
- **SUITE** (`npx vitest run`): exit 0. 151 files, 1,767 passed, 3 skipped. G-6.3's run had 150 files and 1,735 tests.
- **TYPES** (`npx tsc --noEmit`): exit 0, no output.
- **BUILD** (`npm run build`): exit 0.
  - The JS chunk `dist/assets/index-Bx0Boc_i.js` is 1,196.61 kB (gzip 341.78 kB), and the CSS is 39.82 kB.
  - This is reported only, since the owner retired the hard limit. G-6.3's chunk was 1,190.03 kB, so slice 3a adds 6.58 kB.
- **ECON:** `tests/pacing.test.ts` passed 11 of 11, and `tests/economy-invariants.test.ts` passed 7 of 7.
- **C3's accept:** `tests/cave.test.ts` passed 27 of 27, and `tests/architecture.test.ts` passed 2 of 2.
  - The cave test printed: "cave: front 0.867, back 0.734, both in turn 0.690 of 178.5 GP/s (the Hurler's hide, 0.10, is added by K2)".
  - Every ratio is at most 0.9 with the 13.5 s wait.
- **MODEL** (`bash docs/superpowers/research/content-model/run.sh`): exit 0.
  - `results.txt` ends with `ALL CHECKS PASS`, `check-results.txt` with `EVERY BOUND HOLDS, WITH TODAY'S FORMULA AND WITH THE REBALANCE`, and `aggro-results.txt` with `ALL AGGRESSION CHECKS PASS`.
  - `check-results.txt` and `aggro-results.txt` came out byte-identical to the committed files.
  - `results.txt` changed in three lines:
    - `ashes` gained `drop` as a source (the Hurler's 2 ashes).
    - The save section's stat keys went from 134 to 135 (`kill:ember_hurler`), and the new block at every bound went from 5,005 to 5,036 bytes.
  - The content file holds no `ember_hurler` row and no cave. So MODEL does not model the cave, and the "shipped so far" line does not list the Hurler. The cave's income bound is held by `tests/cave.test.ts` (above).
- **PACE** (`bash docs/superpowers/research/content-model/pacing-rerun.sh`, because `CAMPS` changed): exit 0, six blocks, each ending with `EVERY ASSERTION OF pacing.test.ts HOLDS`, and block 3 at gap 10 is identical to block 0.
  - **What slice 3a moved:** the same script was run on `8a67c06`, the last commit before C1, from a copy of that tree in the worktree, since `git archive` does not work inside the capped container. Blocks 0, 1 and 3 (gaps 10, 5 and 20) are identical before and after slice 3a.
  - **Only block 2 moved.** That is the convention-only variant, which counts a type's pack over camps that do not keep their sight. With `slagfall_terrace` gone, no such Lesser Demon camp is left, so its dragon rows (A1, A3) and A1 10x's adamant, rune and dragon rows now choose more demons.
  - **The sentries' 4 are still the largest Lesser Demon camp.** `pass_sentries` is now the only one in `CAMPS` (`src/data/worldMap.ts` 226-230).
  - **The chosen targets per tier against R0's** (block 0 here against R0's gap-10 block, `e025220`): 20 of 24 rows are identical. The 4 that differ all gain `slag_brute`, which came with slice 1 (D3): A1 and A3 dragon, and A1 10x rune and dragon. None of them is slice 3a's.
  - The committed `pacing-results.txt` was last regenerated at G-6.0 (`6332d5d`). Its regenerated copy is committed here, so its diff also carries slice 1's and slice 2's moves: the Slag Brute rows and the steel and black forge lines (D1).
- The regenerated `results.txt` and `pacing-results.txt` are committed with this gate, under a proposed amendment in the plan (the same kind as G-6.1's to G-6.3's).

**Each task's diff against its file list** (`git diff 8a67c06 24d37dd`, where `8a67c06` is the last commit of G-6.3):
- **C1:**
  - `tests/cave.test.ts` (new).
  - The seven declared edits, each exactly as C1 names it:
    - `tests/content-freeze.test.ts`: `ember_hurler` appended to `DECLARED_NEW_MONSTERS` under a slice 3a comment.
    - `tests/world-budget.test.ts`: 48 to 46, with the test's name following.
    - `tests/world-data.test.ts`: 48 to 46.
    - `src/__tests__/blender-hero.test.ts`: 18 to 19.
    - `tests/scatter.test.ts`: 18 to 17 camps, 48 to 46 members.
    - `tests/woods-trees.test.ts`: 48 to 46 members, 18 to 17 camps.
    - `tests/new-monsters.test.ts`: `NEW` gains `ember_hurler`.
  - The edits declared by O-6.1b.1 items 2 and 3 for C1:
    - `tests/monster-kits.test.ts`: `ember_hurler: 'lesser_demon'`.
    - `tests/monster-models.test.ts`: one SNAPSHOT row, matching C1's row without the hide.
  - Table 0.5 row (a): `tests/support/income.ts`, where `campRate` gains `wait` with a `RESPAWN_WAIT` default.
  - No assertion was removed or loosened. `gate-simulation`, `monster-patterns`, `sustain`, `zone-rules`, `dungeon-data`, `pacing` and `economy-invariants` are unedited.
- **C2:**
  - `src/state/dungeon.ts`: the `Zone` type re-exported, `zoneWalk` without gates, an optional `aggro`, `zoneRespawns`.
  - `src/data/dungeons.ts`: `Zone`, `Dungeon = Zone & {…}`, `respawnSecs?`, and the `CAVES` row.
  - `src/data/world.ts`: the `ember_hurler` row.
  - `src/data/worldMap.ts`: the four lines of the `slagfall_terrace` camp removed, and nothing else.
  - `src/state/monsterAi.ts`: `sendHome`, and also more than `sendHome`:
    - the `respawnSecs` field on `MonsterLogic` and in `createMonsterLogic`'s options;
    - in `stepMonster`, the dying-to-dead line: `m.timer = m.respawnSecs !== undefined ? m.respawnSecs - DYING_SECS : boss ? … : DEAD_SECS`.
    - Table 0.5 row (a) names the option ("`createMonsterLogic` takes it through Z2's options"), but not this timer line. The line is the only way the option has an effect, and it changes nothing for a monster without `respawnSecs`. **Named here for the main session.**
  - `createMonsterLogic`'s other lines, `runStep`, `openChest`, the `lesser_demon` row, `pass_sentries` and `POIS` are untouched.
- **C3:**
  - Engine files: `src/engine/zones.ts`, `spawns.ts` (the `respawnSecs` option type), `loop.ts` (`caveArmLength` in `updateCamera`; the net diff is 2 lines), `worldBuild.ts`, `actions.ts`, `lighting.ts`, `particles.ts`.
  - The other files: `src/state/commands.ts`, `src/state/dayCycle.ts` (only `frameOf` and its import; `dayFrameAt` is untouched) and `src/data/look.ts` (`CAVE_LIGHT`, `CAVE_FOG_SCALE`).
  - Under the C3 repair amendment, **still awaiting ratification**: `src/engine/context.ts` and `src/engine/overlay.ts`.
  - `actions.ts` also routes `enterDungeon` to a `CAVES` row in `dispatchCommand`, beside the one-line `performMonsterRetaliation` edit.
- **Also in the range:** the plan's C3 repair amendment. **No other file changed.**

## Findings for the main session (none is fixed here: each is outside this gate's files)

1. **The overworld's grass carpet draws inside the cave.** This is G-6.3's finding 1, which is still open: `src/engine/flora.ts` is unchanged.
   - In `a2`, `a3`, `b5`, `c1`, `c2`, `d1`, `e1`, `e2` and `f1`, the carpet's blades cover the cave floor and stand in the black beyond the walls.
   - Design 7.6 says "the overworld and its carpet are out of sight at x 1000". They are not, because the carpet follows the hero (`updateCarpet(heroX, heroZ, tier)`).
   - The weather's fall mesh is hidden in the cave by C3's line in `updateParticles` (read in the code; no falling streak shows in the cave pictures). The ash and ember motes are there.
   - The fix is the Z6 repair G-6.3 named (it needs `flora.ts`), and it applies to the cave too.
2. **The camera shows the outside of a wall near a corner.** `caveArmLength` shortens the arm only down to `CAMERA_LIMITS.distanceMin x cos(pitch)` (3.44 at pitch 0.3), as C3 specifies.
   - With the hero 2 from a wall, the shortest arm still ends outside the room. In `b1` and `b2` the camera stands at local (6, 24.6) and (2.6, 28), behind the north and west walls. The picture is black, and the hero is not in it.
   - Two causes add up: the walls are single planes with nothing drawn on their outer side, and the arm test reads only the arm's end point.
   - This fails H-3a's "the camera never shows the outside of a wall". A fix needs a design choice: let the arm go below `distanceMin` in a cave, or keep the hero away from walls. It would be in `zones.ts` (C3's file).
3. **The lava seams are not seams.** The 22 `World_lava_fissure` clones lie flat on the floor, centred on the wall lines (every 8 units along each wall segment, rotated to the wall).
   - From above (`a3`, `b5`) they read as large orange slabs that cross the walls, half inside and half outside the rooms.
   - Design 7.6 asks for "seams along the walls' inner face". This is for the owner's eye at H-3a and a C3 repair (an offset into the room and a smaller scale), in `zones.ts`.
4. **Draw calls: the cave draws about 1,000 calls a frame.** The HUD read 978 to 1,213 calls in the cave, against 510 on the overworld at the door.
   - Design 10 says "at most 150, the overworld culled by distance". The design's figure is for a dungeon, and the cave is a zone built the same way. G-6.3 did not read a dungeon's count.
   - Scene I counted 302 meshes under the 27 prop clones, and 346 visible meshes in the cave's area in all (`facts-i.json`, `props`). So the spire and fissure clones bring about 11 meshes each, and they are most of what is drawn there. The carpet's share and the per-pass cost (shadow, outline) were not traced.
5. **The Hurler's tint does not read in the cave light.** In `d1` the Ember Hurler (`tint 0xb8b2a7`, ash-pale, owner's words) reads as the same dark red as the Lesser Demon under `CAVE_LIGHT`'s ember key and bounce. Its smaller scale (0.85) is the visible difference. This is for the owner at H-3a, a [CLAUDE] data retune of `CAVE_LIGHT` or the tint.
6. **The target panel outlives the cave.** After leaving during the fight (`d2`), the target panel still names the Ember Hurler with its hp, while `player.targetEntity` is null.
   - `leaveZone` clears the target but does not refresh the panel.
   - G-6.0 noted the same kind of stale panel for `maybeRetaliate`. It is cosmetic, and it is gone once a new target is taken (`d3`).
7. **Two "Slagfall Terrace" labels over the cave mouth** (`d2`): the POI's name and the door's label stand one above the other. This is for the owner's eye.
8. **The region names do not follow the cave.** The banner and the footer read "Dragon's Peak Highlands" inside the cave (`a2` onward), since region detection does not know about zones. After the reload (`g1`) the footer reads "Lumbridge Haven" while the hero stands at the volcanic door. This is cosmetic and for the owner.
9. **The C3 repair amendment awaits ratification** (`context.ts`, `overlay.ts`). The C2 timer line in `stepMonster` is named under C2 above.

What holds, for the record:
- **Respawn timers only run inside:** E's 0.78 s did not move in 20 s outside, and the demon was back 13.5 s of time inside after its death.
- **Held members are hidden, at home, `idle`, with no wind-up or circle** after leaving, after a death and after a teleport.
- **The hero fights back on the overworld** after leaving during a wind-up.
- **A reload inside puts the hero at the door.**
- **The exit door works by a click** (`i1`, `i2`).
- **Props:** 5 spires on the 5 pillars and 22 fissures, which is 27 props, under design 10's 30.
- **No page or console error.**

## What these pictures cannot prove

- How the cave feels in play: the light judged by eye on the owner's screen, the camera while it moves, the fights with a mouse and with a trackpad.
- The cover of the pillars. That is slice 3b's line of sight, and H-3b's to check.
- The exit door used by a click right after a fight. Scenes D and E left through the engine's leave function. The door's click was captured only in a quiet room (scene I).
- Frame rate on the owner's machine. The HUD and `bench` figures come from a shared machine.

**H-3a stays open for the owner.**
