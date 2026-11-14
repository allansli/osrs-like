# Start and pacing: critique of the design and the plan

Date: 2026-11-14. Branch: `feat/start-pacing`. Documents reviewed: `docs/superpowers/specs/2026-11-14-start-pacing-design.md` ("the design") and `docs/superpowers/plans/2026-11-14-start-pacing-plan.md` ("the plan"), at commit `ef5baba`. Source cited at `a8cad85` (the branch base) and at `feat/world-place` head `50d0fe7` for Stage 2.

Method: every number the design uses was checked against the source. The pacing model was re-implemented independently, from the code and the text of design 4.2, without access to the author's script (`pace.py`, a scratch script, not committed). The gathering table and every recipe ratio were recomputed. No test, type check, build or dev server was run.

## Verdict: READY-WITH-FIXES

The changes themselves are sound, small and reversible: data tables, one shop function, a new-game state that never touches a loaded save. The save-compatibility claims hold. The "today" numbers reproduce.

The proof does not. The stage's acceptance test asserts time windows that were drawn around one script's output, with 2 to 6 minutes of slack. A second implementation of the same written assumptions misses one window and three wait bounds at the proposed markup. No markup in the plan's tuning range (8 to 12) passes all of them. The purchase rule that decides this is not written down. As planned, that failure would surface at T1, after every other task is done.

The fixes below move that check to the front, pin the rule, add a negative control and fix a reset bug that blocks the new start for existing players. The test bounds themselves are the owner's (CALL-3.2) and are left as decision Q3.5. The verdict depends on that answer. With option (b) the plan can run as written. With option (a), the bounds as drafted, the critic's model expects the stage to stop at M1's dry run and come back to the owner (O-13b).

## 1. Recomputed numbers

### 1.1 Time to wear each tier's kit (weapon, body, legs), model-optimal, minutes unless "h"

| Row | Source | bronze | iron | steel | black | mithril | adamant | rune | dragon |
|---|---|---|---|---|---|---|---|---|---|
| T2 today, 10x, no Slayer | design | 0 | 3 | 4 | 9 | 10 | 12 | 17 | 38 |
| | critic | 0 | 3 | 4 | 8 | 8 | 10 | 15 | 36 |
| T2 today, 1x, no Slayer | design | 0 | 5 | 9 | 15 | 21 | 36 | 69 | 4.5 h |
| | critic | 0 | 5 | 8 | 14 | 21 | 36 | 68 | 4.5 h |
| T4 today + Stage 2, 10x | design | 0 | 3 | 6 | 8 | 12 | 13 | 18 | 44 |
| | critic | 0 | 3 | 5 | 9 | 10 | 12 | 17 | 43 |
| T4 today + Stage 2, 1x | design | 0 | 4 | 10 | 16 | 23 | 40 | 73 | 5.2 h |
| | critic | 0 | 4 | 10 | 16 | 22 | 39 | 72 | 5.2 h |
| **A1 after, shop only, 1x** | design | 5 | 21 | 31 | 45 | 53 | 76 | 2.1 h | 5.5 h |
| | critic, "buy the best wearable piece you can afford" | 5 | 18 | **37** | 49 | 58 | 83 | 2.3 h | 5.4 h |
| | critic, "buy only the highest wearable tier" (4.2 read literally) | 5 | **37** | **37** | 37 | 37 | 64 | 2.0 h | 5.3 h |
| A1 level gates (Attack and Defence) | design (section 5) | | 8 | 12 | 22 | 28 | 48 | 83 | 5.5 h |
| | critic | | 7 | 12 | 17 | 24 | 45 | 81 | 5.4 h |

**Where we agree.** All four "today" rows agree within 2 minutes; on the short 10x times that is up to 20%, and on the 1x rows at most 11%. The author's hand-copied combat formulas are right, and so is the conclusion that the 10x default does most of the damage today.

**Where we disagree.** On the A1 row, which carries the stage:

- Under the reading "buy the best wearable piece you can afford" the critic is 3 minutes earlier at iron and 4 to 8 minutes later from steel on (steel +6, adamant +7, rune about +12). That is 6 to 19%, inside the plan's own 20% tolerance, but steel then misses its window (37 against 15 to 35). The waits after the level are 11, 25, 32, 34 and 38 minutes against the asserted 10 to 30, so black, mithril and adamant fail.
- Under the literal reading of 4.2 ("for the highest tier the fighter can wear"), the fighter keeps saving for a target that moves up faster than the purse fills. It never wears iron, steel or black, and goes from bronze to mithril at 37 minutes. Iron and steel miss their windows. This reading is degenerate (at 10x it wears nothing past bronze for 2.5 hours), so the author almost certainly used another rule. The point is that the text does not say which.
- The critic's A1 level gates come 5, 4 and 3 minutes earlier at black, mithril and adamant. Some other assumption differs too, and it is not identifiable from the text.

**Markup sweep** (critic, "best affordable piece" rule; ✗ = an assertion of plan M1 fails):

| Markup | kit iron / steel / black / mithril / adamant | wait after level | Fails |
|---|---|---|---|
| 8 | 16 / 33 / 44 / 52 / 73 | 9 / 21 / 27 / 28 / 28 | ✗ iron wait < 10 |
| 9 | 17 / 35 / 46 / 55 / 78 | 10 / 23 / 28 / 31 / 33 | ✗ steel window, 2 waits |
| 10 | 18 / 37 / 49 / 58 / 83 | 11 / 25 / 32 / 34 / 38 | ✗ steel window, 3 waits |
| 11 | 19 / 38 / 51 / 61 / 88 | 12 / 26 / 34 / 37 / 43 | ✗ 3 windows, 3 waits |
| 12 | 20 / 40 / 54 / 65 / 94 | 13 / 28 / 37 / 41 / 49 | ✗ 5 windows, 3 waits |

The second knob of T1, the drop-rate factor, cannot move A1 at all, because A1 uses no drops. So by this implementation T1's bounded tuning cannot pass and the stage stops at its last task.

**Camp assumptions.** Re-running the A1 row with the attacker counts that `feat/world-place` holds today (one scorpion camp of 5, guardians 4, demons 4, against the design's 3 / 2 / 2) changes nothing. When the fighter meets those monsters it is already above their level. A1 is not sensitive to camp sizes.

**Not recomputed.** The critic's model has no Slayer, so the Slayer rows (T1, T3 and A3), the 10x-after row and the smithing row S were not checked by anyone but their author.

**Negative control.** With the new start, 1x, Stage 2 camps and today's prices, drops and bounties, without Slayer, the critic gets iron 7, steel 13, black 19, mithril 26, adamant 43 and rune 75 minutes, and the wait after each level is 0 to 1 minute. The author's with-Slayer control (5 / 9 / 17 / 28 / 37 / 61) sits inside the windows. This one, without Slayer, misses the lower bound at every tier from iron to rune. So the absolute windows tell the two economies apart only on some routes, by accident. The wait assertions do tell them apart on both.

### 1.2 Gathering (design 4.5 and 7.1 item 4)

Reproduced exactly for every rock, tree and the shrimp, lobster and shark spots, today and after. One error: the **trout spot today** is listed as 2,323 to 3,592 fish an hour (the shrimp numbers). The trout site is one spot (`placements.ts` 69-70, 40 units apart), which gives 1,895 to 2,662 an hour and 55k to 77k GP an hour cooked, not 67k to 104k. The F6 conclusion still holds.

### 1.3 Recipe ratios, prices, bounties, drops

All recomputed and correct: the kit list prices (61,245 GP iron to dragon), the ten quest rewards (57,300), the bounty per kill before and after, the 23 drop chances, the "after" ratios (bronze arrows 2.50 exactly, cooked shrimp 2.33, trout 2.23, yew and magic bows 2.22, smithing 1.01 to 1.33 over bars, gilded 1.39 and 1.44, oak shortbow 3.05), the shop prices quoted in 7.4 and the 83 Smithing XP for level 2 from five smelts.

One edge to know: bronze arrows sit exactly on the 2.5 bound (75 against 30), so "at most 2.5" passes only at equality. A one-coin change to arrow, shaft or feather prices fails it.

## 2. Findings

### Critical

**C-1. The stage's proof does not reproduce, and it would fail last.** Evidence: section 1.1. The A1 numbers depend on a purchase rule that design 4.2 does not state. Two readings of the text give results 5 to 16 minutes apart. The windows and wait bounds leave 2 to 6 minutes of slack (A1 iron 21 in 8-25, steel 31 in 15-35, adamant wait 28 in 10-30), less than that spread. Plan M1 reproduces only the "today" rows before the data tasks. The "after" rows are first measured at T1, which depends on R1, after every implementation task. If T1 cannot pass, 15 tasks of work wait on a design change.
*Fix (applied):* design 4.2 now states the purchase rule ("weapon, then body, then legs: equip an owned piece or buy the highest-tier piece that is both wearable and affordable"), the Slayer rule and the quest rule. Plan M1 now runs the A1 and A3 rows once with the design's parameters injected (markup 10, drop chances × 0.05, five bounties ÷ 3) before any data task, with a stop rule. The `simulate` options gain `dropChanceOf` and `bountyOf` so this needs no data edit. The window and wait numbers stay the owner's (Q3.5).

### High

**H-1. Circular bounds, with a recommended replacement.** Design 5 and 14 say it themselves: the windows were drawn around the model's output. They record what one script printed. They are not a target the owner chose. The wait assertions are the only part that tells the new economy from today's, and the plan only asserts that in prose.
*Fix (applied):* plan M1 adds a negative-control test. With the new start and today's prices, drops and bounties, the wait assertion must fail; if it passes, the test proves nothing. *Owner decision Q3.5:* what to assert. Recommendation: assert the wait after the level on wide bounds (5 to 45 minutes from iron to adamant on the shop-only route), keep the clock windows as a printed table only, and keep the negative control.

**H-2. The quest tracker sends a new character to an aggressive camp.** `adventureTracker` (`adventure.ts` 529-550) shows the first unclaimed quest in `QUEST_DEFS` order. After Lumbridge Foundations that is the Varrock Arcane Trial: discover the Varrock shrine, kill a dark wizard or ranger, mine iron or mithril. After Stage 2, the wizards (level 18) attack in a pack anyone of combat 18 or below. The start-town quest the model counts on at minute one (Cook, 800 GP: cook, bury, buy) is never shown until all five original quests are claimed. `tests/phase3-content.test.ts` (line 41) pins "Varrock Arcane Trial" as the next title, so the fix needs a planned test replacement, which plan rule 0.3.3 forbids. That makes it the owner's call.
*Owner decision Q3.6.* Recommendation: allow one planned replacement and show open quests of discovered regions first.

**H-3. "Reset" does not reset, so an existing player cannot reach the new start.** `resetGameSave` (`session.ts` 94-101) removes the save and calls `location.reload()`. `boot()` registered `beforeunload → saveGameState` (`runtime.ts` 159), and `saveGameState` (`session.ts` 10-35) writes `STATE` back unconditionally (`save.ts` 204-206). The reload therefore restores the old character. The browser fires `beforeunload` on reload; this was established by reading the code, not by running it. Stage 2 does not change it (`feat/world-place` `session.ts` 94, `runtime.ts` 159). The G-6 check "A new game (reset, or a private window)" would pass only in a private window.
*Fix (applied):* plan N2 adds a module flag in `session.ts`. `resetGameSave` sets it before removing the keys, and `saveGameState` returns early while it is set. A G-6 human check covers it, and the design records it in the ledger as a defect found here.

**H-4. Fishing becomes one click per fish, for no first-hour gain.** When a node depletes, `performResourceGather` clears the player's target (`actions.ts` 432-438: `player.targetEntity = null`). "Deplete on every catch" therefore makes fishing click-per-item, as trees and rocks already are. Today it is the one gathering activity where one click yields about three items. Fishing is not on the first hour's critical path, so the change fixes an hourly-rate imbalance (F6), not the first hour. The same yield is reached with no rule change: keep today's 35% depletion chance and lengthen the respawn to shrimp 17 s, trout 8.5 s, lobster 20 s and shark 23 s. That gives 1,510, 862, 878 and 778 fish an hour at the requirement level, against the design's 1,500, 857, 878 and 783 (critic's computation with the design's own gather formula). It is a data-only change of four numbers, it needs no `actions.ts` edit, and it needs about a third of the clicks.
*Owner decision Q3.7.* Recommendation: the data-only variant. The plan's alternative table says what changes (D4 becomes a data commit and T1's respawn range widens to 25 s).

**H-5. The "how other games do it" comparison was missing.** The owner asked for every pacing and economy choice to be compared with established strategies, named and judged. The design compares only internal options (6.1-6.4).
*Fix (applied):* new design section 6.5, one row per choice: starting kit, XP rate, gear price and resale spread, drop rates, resource depletion, gold sinks and faucets, crafting margins, bounties, unlocks, onboarding, crafted gear, tiered vendors, diminishing returns. Each row names the strategy, how established games use it, what the design does, and a judgement. It adds no content and no name.

**H-6. The markup makes the middle of the curve longer, not differently shaped.** CALL-3.5 said the markup "does not lengthen the game". That holds only for dragon. The critic ran the shop-only route with the new start at 1x twice, once with today's list prices and once with the markup of 10 ("best affordable piece" rule). With the markup, iron arrives 9 minutes later (9 to 18), mithril 31 (27 to 58), adamant 38 (45 to 83) and rune 60 (78 minutes to 2.3 hours). Dragon arrives at the same time (5.3 to 5.4 hours). The design's own A1 row shows the same thing: rune 2.1 hours against a rune gate of 83 minutes. During the wait, a player who only fights does exactly what it did before: it kills the same monster for coins. The markup adds no goal. What turns the wait into a choice is the forge (bronze, iron, mithril and rune at the level, row S) and gathering for money (F15). Nothing in the game tells the player about either at the moment it matters. The cheaper way to the same level curve is the 1x default plus the new start alone: they set every level gate, and the markup only adds the wait.
*Fix (applied, text only):* CALL-3.5 now states the real effect. *Recommendation, part of Q3.1:* keep the markup only if the wait is meant as a nudge toward the forge, and make the nudge visible. For example, U2's unlock line could name the forge recipe of a newly wearable piece next to its shop price. That would be one more clause in `unlockLine`, and it is not specified here.

### Medium

**M-1. The model leaves money-by-skilling out, and G3.3 bounds ratios, not income.** After the change, fletching maple bows earns about 181k GP an hour at level 25 (design 7.1 item 5). The critic's model gives scorpion coins at about 66k an hour at combat 28, and hill giants at 110k to 167k an hour at combat 34 to 57. A player who gathers and crafts affords each kit about 2 to 3 times faster than the routes the windows measure. That is earning, and it fits the owner's intent, but the design does not say so, and its "money matters" claim covers only a fighter.
*Fix (applied):* design 4.6 adds finding F15, and plan M1's printed table adds the best gathering and crafting GP an hour per tier next to combat coin income. Nothing is asserted.

**M-2. One sink, no recurring sink.** Gold has one sink: the shop's equipment price. Runes and arrows are cheap, and food is optional (F9). Once a player owns the kit they want, gold accumulates with no use. Established economies balance faucets against recurring sinks: repair costs, death fees, travel fees, consumables.
*Fix (applied):* stated in 6.5 and 7.2 as a Stage 4 dependency (the cost of dying), next to F9.

**M-3. The in-play stack cap is unreachable in real play.** The cheapest buyable stack, arrow shafts at 2 GP, needs 4.3 billion GP of lifetime spending to reach 2,147,483,647, over 8,000 hours at the best income in design 4.5. A gathered, looted or crafted stack grows by at most 15 per action. (`MAX_GP` caps the balance, not lifetime spending, so the argument rests on hours of income.) The stack half of C2 (`canPlace`, `place`, `buyItem`, `buyRunePack`, `withdraw`, `deposit`) edits six paths that frozen tests guard, for a state no play can reach.
*Fix (applied):* the gold cap in play stays: `creditGp` at every gold gain, and a sale refused at the cap. The stack cap stays on load, from one constant. The stack half is closed in writing with this reason in design 7.1 item 6, G3.5, R3, R9, CALL-3.11 and the ledger. C1 and C2 shrink accordingly. This narrows an item the owner confirmed as owed to Stage 3 (world-foundation design 9.1), so the owner sees it in CALL-3.11.

**M-4. What existing players lose was not fully disclosed.** Design section 8 says nothing is taken. Three capabilities do change:
- Gilded armour moves from Smithing 35/38 with gold ore to Smithing 46/48, and it consumes a rune piece. A player at Smithing 35 to 45 loses a recipe they had.
- Logs in the bank make one third to one sixth as many bows.
- A Slayer task in progress pays the reduced bounty when it completes.

None of these takes an item away, and none makes anything unreachable. Item prices at the markup stay within late-game income: the dearest, 720,000 GP, is a few hours of demon kills.
*Fix (applied):* rows added to the table in design section 8 and to CALL-3.8.

**M-5. Model policy decisions were left to the implementer.** Plan M1 says choosing what the model assumes is "judgment" for an opus implementer. Those choices (the purchase rule, the Slayer rule, the quest timing) decide the numbers, so they belong in the design that the owner approves.
*Fix (applied):* pinned in design 4.2 (C-1). M1 implements them and keeps opus because it is trusted without re-checking.

**M-6. The first-run chat advertises `gold200k` to a brand-new character.** `boot()` prints the cheat codes to every player on every load (`runtime.ts` 180). On the first screen of a stage whose point is "earn the equipment", it offers 200,000 GP, forty adamant kits at today's list price, or one and a half rune kits at the new shop price.
*Owner decision Q3.8.* Recommendation: do not print it in a new game; the codes stay in Settings.

**M-7. Magic is locked for the first half hour, and the design does not discuss it.** A spell needs a staff (`combat.ts` 54-57). The only staff a new character can wear is the Staff of Fire, which has no recipe and costs 3,200 GP after the markup. Ranged opens at Smithing 5 and Woodcutting 10 (the oak shortbow from one oak log), or for 950 GP.
*Owner decision Q3.9.* Recommendation: accept and disclose; the three styles are not in the essence list.

### Low

- **L-1.** The examine line (`playerActions.ts` 205) still says "Value: 5200 GP" while the shop charges 52,000. Plan D2 deliberately does not touch it. *Fix (applied):* U2, which already edits `playerActions.ts`, changes it to "Shop X GP · sells for Y GP"; no test reads the line.
- **L-2.** Design 4.5 has the trout error described in 1.2. *Fixed.*
- **L-3.** Bronze arrows sit exactly on the 2.5 bound. *Fix (applied):* noted in design 7.1 item 5, so a later price edit knows why the test fails.
- **L-4.** The model's kill rates are far above a person's: about 1,200 goblins an hour, one every 3 seconds. The "twice as slow" factor is a guess, and G-6 measures only the first 30 minutes. Not changed; it is already listed in section 14.
- **L-5.** `STATE` starts from `createDefaultState()` (`gameState.ts` 89). If the tab is hidden between script load and `DOMContentLoaded`, `visibilitychange` saves the old 23-item kit as a save. The window is tiny, so this is recorded only.

## 3. Checks that passed

- **Save compatibility.** No field, no key and no version change. `serializeState`, `migrateLegacySave` and `createDefaultState` are unedited, and the goldens pin them. The new-game state is applied only when `loadGameState()` returns `false` (`session.ts` 37-86). A save without `xpMultiplier` keeps 10 through the unchanged default. The fixtures exist (`tests/fixtures/save-v4.json`) and the `UPDATE_GOLDEN` pattern exists (`tests/terrain-golden.test.ts` 20).
- **Frozen tests.** Design 9.3 checks out against the test files: phase1 (oak shortbow from one log), phase2 (goblin bounty 400, smelt bronze), bulk-buy and shop-gathered (runes and arrows at list), bulk-sell (`unitSellPrice`). No test reads a drop table, a respawn or a `smith_*` recipe.
- **Stage 2 fit.** Nothing starts before the Stage 2 merge. P0 records the real camps against the assumed ones. The model reads `CAMPS` and is insensitive to camp size on the A1 route (1.1). T1 has a bounded knob and a stop rule. Stage 2's camps on `feat/world-place` are still all `aggressive: false`, and W5 is not done, as the design says.
- **Deferred items.** Audit finding 9 and the in-play cap (world-foundation design 9 and 9.1, the only two rows assigned to Stage 3) are resolved. The second half of audit finding 6 is closed. F9, F12, F13 and F14 are deferred again in writing with reasons.
- **Arbitrage.** The shop refuses ores, raw fish, logs, bars and bones (`inventory.ts` 176, 208-214), so no buy-craft-sell loop exists. Bought shafts and feathers make arrows at break-even (75 GP in, 75 out).
- **Plan hygiene.** Tests come before their implementation, every task is tagged [AGY] or [CLAUDE], AGY tasks run the three-stage haiku/sonnet/opus pattern, the tiers fit the global rule, no existing test is edited, and allowlists exist on every task.

## 4. Owner decisions (added as Q3.5 to Q3.9 in design section 15)

The ones with a real trade-off come first.

1. **Q3.5: what the pacing test asserts (CALL-3.2).** The current minute windows fit one script's output with a few minutes of slack, and a second implementation misses them. *Recommendation:* assert the wait between reaching a level and wearing its gear (5 to 45 minutes, iron to adamant, shop-only player), print the minute table without asserting it, and keep a check that today's economy fails the test.
2. **Q3.7: how fishing spots run out.** (a) As designed: the spot empties after every fish, so one click per fish, like trees and rocks. (b) Keep today's "empties about one catch in three" and make an empty spot stay empty longer (17, 8.5, 20 and 23 seconds). Same fish per hour, a third of the clicks, only four numbers change. *Recommendation:* (b).
3. **Q3.1 (existing), the ten-times shop price for gear with Slayer bounties cut to a third.** Unchanged by this review, with two notes. First, by the critic's model the shop-only player waits up to 38 minutes after reaching a level, not 28. Second, during that wait a player who only fights just keeps fighting; the markup adds time, not a new goal (H-6). *Recommendation:* keep 10. Under the drafted bounds no markup from 8 to 12 passes in the critic's model, so the M1 dry run decides; under Q3.5's wide wait bound, 8 to 11 all pass.
4. **Q3.6: what the quest tracker points at after the first quest.** Today it points at Varrock's wizard camp, which will attack a new character in a pack. Fixing it means replacing one frozen test. *Recommendation:* allow that one replacement and show quests in already-discovered regions first, so the start-town Cook quest comes second.
5. **Q3.8: cheat codes in the first chat lines of a new game.** *Recommendation:* stop printing them in a new game; they stay in Settings.
6. **Q3.9: magic in the first half hour.** A new character cannot cast until it has 3,200 GP for the only staff. *Recommendation:* accept it and say so in the README.
7. Q3.2 (10x button placement), Q3.3 (bronze scimitar or nothing) and Q3.4 (5 to 8 hours to dragon) stand as the design wrote them.
