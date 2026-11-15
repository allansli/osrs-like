# Stage 4 bundle breakdown (review finding 17)

Finding 17 asks for the JS chunk to be at most 985.97 kB, which is the R0 baseline of 955.97 kB plus the 30 kB stage budget. It also says: if the budget cannot be met without cutting a feature, stop and report a per-module breakdown. This file is that report. **The budget is not met.**

## Real builds (`vite build`, same config)

| Build | JS chunk | gzip |
|---|---|---|
| R0 = `main` at db15263, scratch copy | 955.97 kB | 263.46 kB |
| 8a15beb (before review-17 round 2), scratch copy | 995.90 kB | 276.19 kB |
| HEAD of feat/combat-weight | 991.45 kB | 275.65 kB |
| Budget | 985.97 kB | n/a |

The R0 snapshot rebuilds to exactly the plan's 955.97 kB, so it is the right baseline. The seven round-2 commits (706f944..fc6a544) removed duplicated code and saved 4.45 kB: one voice constructor, one lattice builder, one followPath, one refusal path, and the removed Stage-3 shake. HEAD is still **+35.48 kB over R0, which is 5.48 kB over budget**. That gap is about 15% of the stage's net addition.

## Per module (src only)

Method: each module's code as rendered into the chunk is minified on its own with esbuild. Names are not mangled across modules, so these figures are larger than the real ones. The deltas add up to +42.6 kB, while the real chunk grew +35.48 kB, a ratio of about 0.83. Read the table for the ranking, not as exact chunk bytes. node_modules (three.js) is flat: 653,396 B on R0 and 653,406 B on HEAD. All of the growth is Stage 4 source.

| Module | R0 (B) | HEAD (B) | Delta |
|---|---|---|---|
| `src/engine/reactions.ts` | 0 | 5,687 | +5,687 |
| `src/engine/telegraphs.ts` | 0 | 5,415 | +5,415 |
| `src/engine/actions.ts` | 9,456 | 14,056 | +4,600 |
| `src/state/monsterAi.ts` | 3,415 | 7,400 | +3,985 |
| `src/state/sustain.ts` | 0 | 3,043 | +3,043 |
| `src/data/attacks.ts` | 0 | 2,567 | +2,567 |
| `src/engine/audio.ts` | 1,788 | 4,237 | +2,449 |
| `src/state/soundPlan.ts` | 0 | 2,387 | +2,387 |
| `src/state/monsterPattern.ts` | 0 | 2,248 | +2,248 |
| `src/engine/loop.ts` | 17,746 | 19,979 | +2,233 |
| `src/ui/hud.ts` | 11,883 | 13,337 | +1,454 |
| `src/data/world.ts` | 843 | 2,177 | +1,334 |
| `src/state/telegraph.ts` | 0 | 1,279 | +1,279 |
| `src/state/commands.ts` | 0 | 1,169 | +1,169 |
| `src/engine/monsterMeshes.ts` | 22,484 | 23,247 | +763 |
| `src/state/combat.ts` | 5,475 | 6,234 | +759 |
| `src/state/adventure.ts` | 15,972 | 16,686 | +714 |
| `src/data/feel.ts` | 0 | 660 | +660 |
| `src/state/pathfind.ts` | 4,261 | 4,827 | +566 |
| `src/data/worldMap.ts` | 4,267 | 4,629 | +362 |
| `src/engine/spawns.ts` | 3,655 | 3,839 | +184 |
| `src/engine/context.ts` | 1,493 | 1,619 | +126 |
| `src/engine/blenderMonsters.ts` | 2,938 | 3,031 | +93 |
| `src/engine/playerMesh.ts` | 7,655 | 7,715 | +60 |
| `src/state/quests.ts` | 2,223 | 2,260 | +37 |
| `src/engine/overlay.ts` | 5,575 | 5,602 | +27 |
| `src/state/terrain.ts` | 2,159 | 2,176 | +17 |
| `src/engine/worldMesh.ts` | 5,438 | 5,445 | +7 |
| `src/state/collision.ts` | 1,935 | 1,921 | -14 |
| `src/engine/input.ts` | 10,353 | 10,207 | -146 |
| `src/ui/playerActions.ts` | 11,735 | 10,257 | -1,478 |

## What is left, by feature

- **reactions.ts**: hit stop, flash, hero flinch, knock-back, camera kick, rumble and the low-health vignette. Each effect is a separate design-6.5 feature. There is no copy left to merge.
- **telegraphs.ts and telegraph.ts**: the ground shapes for the attack wind-ups. These are the fill lattice (already one builder), the outline band, and the terrain height grid.
- **actions.ts**: the command dispatcher, boss phases, heavy attacks, retaliation, death loss, and the hit reactions wired into hits.
- **monsterAi.ts and monsterPattern.ts**: the attack patterns, wind-ups, boss arena, shift and phase rules.
- **sustain.ts and commands.ts**: food and potion cooldowns, regen, death XP loss, and the Lantern Vow.
- **attacks.ts, soundPlan.ts and audio.ts**: attack and boss data, and the wind-up, resolve and impact sound plans.

Candidates checked and rejected as too small to close the gap:

| Candidate | Real-chunk estimate |
|---|---|
| Drop the unread `id`/`name` fields from `ATTACKS` | about 0.3 kB |
| Merge `eat` and `drink` in sustain.ts | about 0.3 kB |
| Smaller copies elsewhere | under 0.5 kB together |

Even all together, these stay under 1.5 kB of the 5.48 kB needed. Closing the rest would mean removing one of the features listed above, and the finding forbids that.

## Options for the owner (not applied)

- Accept the stage at +35.5 kB and raise the stage-4 budget to 36 kB.
- Load the boss-only code (the Ashmantle phases, `BOSSES` and the boss sound plans) with a dynamic `import()`. This only moves bytes out of the index chunk; it does not ship less JS.
- Change the build settings (target, or a terser minify). This would also shrink R0, so the comparison against the budget would no longer be like-for-like.
