# G-6 smoke, Stage 3 (branch feat/start-pacing)

Run by the main session in a headless browser with a software renderer, on a new game (no save), after the review fixes.

| Check | Result |
|---|---|
| New game: gold, backpack, worn gear | 0 GP, 0 items, nothing worn |
| Experience rate | 1x |
| Quest tracker | "A Name in the Ledger" (first starter quest) |
| Hidden tools block at start | hidden |
| After typing `backroom` during play | shown |
| Buy a Bronze Scimitar through the shop button's function | 450 GP (ten times its list price of 45) |
| Sell it back through the backpack click | +29 GP (65% of list) |
| Quest flags after that buy and sale | `boughtWares` and `soldWares` both true (review finding 3 and 4) |
| Console errors | 0 |

`01-new-game.jpg` is the screen at the end of that run.

Not done here (needs a person): playing the six starter quests end to end, fishing with one click per fish and
its cues, the unlock line on a level-up, the forge with bars, Reset, an existing save loaded with gear, and the
10x notice.
