# Credits

The game's source code is released under the [MIT License](./LICENSE). The MIT License covers the code only. The third-party 3D assets below keep their own licences.

Facts come from the Blend Swap licence file kept with each asset in `blender/examples/` (for Kai, inside the zip). No Blend Swap licence file is kept in this repository for the knight; its facts are recorded in the `LICENSE.txt` that stays where its blend was. Where a fact is not recorded, this page says so. Source URLs are copied as written in those files.

## Shipped in the game (`public/models/`)

These assets are read by the generator scripts in `scripts/blender/`, and the resulting models are deployed with the game.

| Asset | Author | Source | Licence | Used in |
|---|---|---|---|---|
| "Game Anime RPG Character" (Kai, the player character) | uchiha007 | http://www.blendswap.com/blends/view/26667 | Creative Commons Attribution 3.0 (CC-BY 3.0) | `hero.glb`, from `blender/examples/Game Anime RPG Character.zip` |
| "Medieval Props" | Daniel74 | http://www.blendswap.com/blends/view/55083 | Creative Commons Zero (CC0) | `world.glb`, from `blender/examples/medieval_props_6679/` |
| "Low-Poly Weapons" | Drummyfish (3D models), based on a 2D weapon collection by Cethiel | http://www.blendswap.com/blends/view/93850 | Creative Commons Zero 1.0 (CC0) | `gear.glb`, from `blender/examples/weapons_22839/` |

The CC-BY 3.0 licence requires credit to the author: Kai is by uchiha007 and the old dragon, kept below, is by yoji (https://creativecommons.org/licenses/by/3.0/). CC0 assets need no credit; they are credited anyway.

## Kept in the repository, not shipped

These sources stay under `blender/examples/` with their licence files, but no shipped model is built from them any more: `monsters.glb` now holds an original dragon, Ashmantle and an original lesser demon.

| Asset | Author | Source | Licence | Was used in |
|---|---|---|---|---|
| "Dragon Rig And Textures" (the dragon) | yoji | http://www.blendswap.com/blends/view/21036 | Creative Commons Attribution 3.0 (CC-BY 3.0) | was `monsters.glb` (the dragon, until the dragon was rebuilt as an original model); the source stays in `blender/examples/dragon_3826/` |
| "Red Devil" | not recorded in the licence file | http://www.blendswap.com/blends/view/93774 | Creative Commons Zero 1.0 (CC0) | was `monsters.glb` (the lesser demon, until it was rebuilt as an original model); the source stays in `blender/examples/red_devil_22787/` |

## Source removed; credit kept

These assets no longer ship and their source files are gone from the repository. The credit stays, because earlier releases carried them.

| Asset | Author | Source | Licence | Was used in |
|---|---|---|---|---|
| "Rigged Knight in Armor" (the knight, Blend Swap blend 28541, used for the guard) | Xali | https://www.blendswap.com/blend/28541 | Creative Commons Zero (CC0) | `guard.glb` (removed; the guards are now built from the hero and gear models), from `knight.blend` (removed) |

Note on the knight: its author says the base mesh came from a CGTrader model whose terms are not stated. See `blender/examples/knight_28541/LICENSE.txt`, which stays.

## Fonts (`src/ui/fonts/`)

Basic Latin and Latin-1 subsets in woff2. Each family's licence text is shipped beside its files; `src/ui/fonts/SOURCE.md` records the commit, the SHA-256 of every downloaded and shipped file, and the subset command.

| Family | Author | Source | Licence | Shipped |
|---|---|---|---|---|
| Grenze 1.003 (display) | Renata Polastri, Omnibus-Type | https://github.com/Omnibus-Type/Grenze at commit `2af38b2f951f5d2d601825c896c2be9b8b282092` | SIL Open Font License 1.1 (OFL-1.1), no Reserved Font Name | `Grenze-SemiBold.woff2`, `Grenze-Bold.woff2`, `LICENSE-Grenze.txt` |
| Open Sans 3.003 (text) | Steve Matteson (The Open Sans Project Authors) | https://github.com/googlefonts/opensans at commit `6cbc400d4855abee59d85c4ed871d510399bce7b` | SIL Open Font License 1.1 (OFL-1.1), no Reserved Font Name | `OpenSans-Regular.woff2`, `OpenSans-SemiBold.woff2`, `LICENSE-OpenSans.txt` |
