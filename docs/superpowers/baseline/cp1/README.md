# CP-1 evidence (spine head 516d79a against a514508)

Both commits were served side by side and driven by the same script (headless, software renderer).

| Check | Before | After |
|---|---|---|
| Start pose | 1509 calls / 226k tris | 1509 calls / 226k tris |
| (60, -60) pose | 1027 / 162k | 1027 / 162k |
| Last shrine pose | 131 / 80k | 131 / 80k |
| Keys move the hero | yes | yes |
| Buy / sell | bronze_scimitar -45 gp / +18 gp | same |
| Bank opens, quest flag set | yes | yes |
| Melee on a Hill Giant deals damage | yes | yes |
| Shrine teleport | wilderness (-70, 72) | same |
| Save | version 4, same 26 keys | same |
| Reload restores position and gp | yes | yes |
| Console errors | 0 | 0 |

Screenshots: `cp1-*-shrine.jpg` and `cp1-shrine-side.jpg` are clean. `cp1-*-start.jpg` and `cp1-*-far.jpg`
were taken with the welcome window open, so they only show the HUD.

Not covered by the script: click-to-walk, bridge, chop/mine/fish, ranged and magic, death, altar, forge,
equip, typing in the bank search. Monster positions differ between runs (unseeded wander).

Found in both versions (not a regression): after a reload in another region the footer still reads
"Lumbridge Haven" until the hero crosses a region border.

Owner check (2026-11-14): the owner played both versions side by side (pre-refactor commit and the full Stage 1 branch)
and answered "sim, jogo ainda igual".
