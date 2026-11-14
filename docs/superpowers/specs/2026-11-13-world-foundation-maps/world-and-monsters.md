# World and monsters: how they work today

Branch `feat/world-foundation` (HEAD `1284a6e`). Facts only, read from source. `runtime.ts` means `src/engine/runtime.ts` (6253 lines, line 1 is `// @ts-nocheck`, so the compiler checks none of it). Coordinates are Three.js world units: X right, Z toward the camera/south, Y up. Line numbers are as read.

Two items verified by running no project code: the node lists of `public/models/world.glb` and `monsters.glb` were read by parsing the GLB JSON chunk with a standalone Python script.

## 0. Where the data lives (summary)

| Thing | Defined in | Notes |
|---|---|---|
| Region list (5) | `src/data/catalog.ts:431-437` `WORLD_REGIONS`; re-exported by `src/data/world.ts:7` | `RegionDef` type at `world.ts:9-18`. Each: `id, name, sub, x, z, radius, color, desc`. |
| Monster stat table (8 + 2) | `catalog.ts:439-480` `MONSTER_TYPES`; `world.ts:36-79` adds `goblin_archer`, `dark_ranger` | Runtime imports from `../data/world` (`runtime.ts:8`), not `catalog`. |
| Resource node table (14 + 1) | `catalog.ts:482-499` `RESOURCE_NODES_DEF`; `world.ts:81-95` adds `maple_tree` | Same import path. |
| Where monsters/trees/rocks/fish stand | `runtime.ts:3553-3590` `spawnAllResourcesAndMonsters` (hard-coded arrays) | The only placement list for these. |
| Terrain height / biome colour | `runtime.ts:1119-1160` | Plus a second copy of the biome rules in `src/engine/textures.ts` (section 1.5). |
| Walkability / collision | `src/state/collision.ts` | Pure functions, unit-tested for 7 points. |
| Monster AI | `runtime.ts:5788-5878` (loop), `4747-5029` (combat) | No separate module. |
| Save | `src/state/save.ts`, `runtime.ts:983-1048` | |

The data in `catalog.ts` is plain objects with no type annotations; `world.ts` casts it to `MonsterDef` (`world.ts:37`) and `Record<string, Record<string, unknown>>` (`RESOURCE_NODES_DEF`, `world.ts:82`, no `NodeDef` type).

## 1. Terrain

### 1.1 Height (`getTerrainHeight`, `runtime.ts:1119-1137`)
Evaluated in this order, first match returns:
1. For each region in `WORLD_REGIONS` order: `d = distance((x,z), region centre)`. `d < 16` returns exactly `0`. `16 <= d < 28` returns `rawHills(x,z) * smoothstep((d-16)/12)` (returns here even if the river is near; the river carve below is never reached inside 28 of any region centre).
2. River: `riverCenter = 28 + sin(z*0.05)*8`; if `|x - riverCenter| < 6.8` returns `-1.45 * cos((riverDist/6.8) * PI/2)` (a cosine trough, -1.45 at the centreline, 0 at the edge).
3. Otherwise `rawHills(x,z)`.

`rawHills` (`runtime.ts:1139-1147`): `h1 = sin(0.032x)*cos(0.032z)*1.85`, `h2 = sin(0.085x+0.065z)*0.55`, plus a "crag" ramp only where `x < -35 && z > 30` (`min(6.4, ((-35-x)+(z-30))*0.06) * (0.6 + 0.4*sin(0.13x)*cos(0.13z))`). Result `max(0.08, (h1+h2)*0.55 + 0.85 + crag)`. So land outside regions and river is never below 0.08. Maximum crag height reaches roughly 6.4 plus the base.

Callers: every placement function calls `getTerrainHeight(x,z)` once at build time to set Y (`createCastleStructure:1758`, `createPrayerAltar:1819`, `spawnWorldProp:2114`, `spawnMonster:3383`, `spawnResourceNode:3433` etc.). The player (`5558`), monsters (`5840`, `5869`, `3306`), camera (`5767`), click markers and labels call it every frame. There is no heightmap cache or array; it is the function itself.

### 1.2 Mesh and extents (`buildTerrainAndWater`, `runtime.ts:1401-1500`)
- `PlaneGeometry(260, 260, 80, 80)` rotated flat: 81x81 vertices, cell size 3.25 units, spans X and Z in [-130, 130] (`1402-1405`). Vertex Y set from `getTerrainHeight`, vertex colour from `getBiomeColor` (`1409-1416`), `computeVertexNormals`, then `assignGroundUvs` (UV = world XZ / 24, `textures.ts:367-381`).
- Material: `terrainMaterial()` (`textures.ts:445-480`), a Lambert material with vertex colours and an `onBeforeCompile` patch.
- The mesh is added to `worldInteractiveObjects` (`1426`) with `userData.type='ground'`; ground clicks are raycast against it.
- Walkable limit is +-118 (`collision.ts:47,54`), smaller than the +-130 mesh. Camera far plane 360 (`1280`), fog `FogExp2(0x9ab0c2, 0.0028)` (`1278`), sky dome radius 290 (`1344`).
- Grass: 900 instanced blades scattered with unseeded `Math.random()` over +-107.5 (`1482-1497`); skipped where height < 0.08 (so inside the flat region cores), in deep water, and in two hard-coded boxes `x<-30&&z>25` and `x>32&&z>28` (`1490`).

### 1.3 River and water
- The centreline formula `28 + sin(z*0.05)*8` exists in three places: `collision.ts:2-4` (`riverCenterX`, exported, used by `isDeepWater`), `runtime.ts:1131` (terrain; inline copy) and `runtime.ts:5154` (minimap strip; inline copy). It runs the full Z range; at z=0 the centre is x=28. The bridge position (28, 0) and the bridge rectangle in `collision.ts:35` are separate constants.
- Three widths: terrain trough half-width 6.8 (`1133`), deep-water collision half-width 4.6 (`collision.ts:34`), minimap stroke 14 px.
- Water mesh: one flat `PlaneGeometry(260,260,24,24)` at `y = -0.34` (`1435-1470`), a custom `ShaderMaterial` (`transparent`, alpha 0.94, vertex wave `sin(0.22x + 1.2t)*0.02`, fragment foam from `sin(0.45x + 0.7t)*cos(0.32z)`). It covers the whole map; it is visible only where terrain dips below -0.34, which is only the river trough. There is no per-water-body definition: no lake, pond, sea or oasis geometry exists. Region text mentions "Oasis" and "Waterfall" (`catalog.ts:434,435`) but there is no corresponding water.
- Bridge: `buildRiverBridge(28, 0)` (`runtime.ts:1473`, function `1502-1535`): 15 cylinder planks along X from x=21 to 35 and two tube rails, all procedural, then replaced by `World_river_bridge` from `world.glb` when loaded (`1531-1534`). Collision treats the bridge as `|z| <= 2.05 && 20.5 <= x <= 35.5` (`collision.ts:35`), independent of the mesh. Terrain height under the bridge is the river trough (no deck heightfield); the player Y is `max(-0.25, terrainHeight)` (`5558`), so the player walks at about -0.25 across the bridge and wades through the 4.6-6.8 margin.
- Fishing spots are placed at fixed Y `-0.30` (`3433`) inside the deep-water band, so they are not walkable; the player stops 3.1 away (`5474`).

### 1.4 Ground colour (`getBiomeColor`, `runtime.ts:1149-1160`)
Per-vertex colour, first match:
1. `h < -0.05` (river bed): dirt.
2. Road strip `z in (-22, 8) && x in (-8, 82) && |z - (-0.22x)| < 2.6`: dirt (Lumbridge to Varrock diagonal).
3. Within 18 of (78, -20): dirt (Varrock plaza).
4. `x > 40 && z > 36`: sand (`BIOME_COLORS.sand`).
5. `x < -40 && z > 36`: lava colour if `h > 3.1` else crag.
6. `x < -40 && z < 0`: canopy.
7. Otherwise one of three sage greens by `|floor(x/7) + floor(z/7)*2| % 3` (a coarse checker).

### 1.5 Biome texture choice (second copy of the rules)
`src/engine/textures.ts` holds its own boundaries:
- `biomeGroundId(x,z)` (`textures.ts:46-52`): `x>40&&z>36` alkharid-sand; `x<-40&&z>36` peak-volcanic; `x<-40&&z<0` korok-moss; within 22 of (78,-20) varrock-cobble; else `null`. Used for ore-rock textures (`blenderWorld.ts:203`, `runtime.ts:3479`), not for the terrain.
- Terrain fragment shader (`textures.ts:416-439`, `TERRAIN_SAMPLE`; `TERRAIN_PARS` at `393`): the base texture is chosen by matching the interpolated vertex colour to grass/dirt/sand/stone palette entries (`biomeWeight`, Gaussian in colour distance), then four biome tiles are mixed over it by smoothstep ramps on world XZ: desert `smoothstep(32,46,z)*smoothstep(32,48,x)`, peak `smoothstep(28,42,z)*smoothstep(-32,-46,x)`, korok `smoothstep(-4,-18,z)*smoothstep(-32,-46,x)`, plaza `1 - smoothstep(12,22,dist to (78,-20))` (`textures.ts:433-437`).
- So the Al-Kharid / Peak / Korok / Varrock ground areas are encoded as inequalities in: `getBiomeColor` (runtime 1153-1158), `biomeGroundId` (textures 46-52), the shader (textures 434-437), the grass exclusion (runtime 1490), the crag height ramp (runtime 1143), and the region table. None reads `WORLD_REGIONS`.
- Texture tiles: `public/textures/{grass,dirt,sand,stone}.png` plus `public/textures/biomes/{korok-moss,peak-volcanic,varrock-cobble,alkharid-sand}`. The lava vertex colour set in `getBiomeColor` (`BIOME_COLORS.lava`) is not one of the shader's palette targets (`uSage*`, `uCanopy`, `uDirt`, `uSand`, `uCrag`); the shader has a generic fallback when no palette weight matches (`textures.ts:426-430`).

### 1.6 Time of day
`cycleTimeOfDay` (`runtime.ts:1374-1399`) changes sky uniform colours and fog colour/density only (three presets). Lights are not changed. Saved `timeOfDay` is applied at load by cycling once (`5999-6001`).

## 2. Placement (every list that puts something in the world)

All spawning happens once at startup from `init3DEngine` (`runtime.ts:1324-1329`): sky, `buildTerrainAndWater`, `buildAllCitiesAndLandmarks`, `buildPlayerCharacter`, `spawnAllResourcesAndMonsters`. Nothing is created, moved or streamed afterwards. There is no chunking, no map file, no level data format.

### 2.1 Regions (`catalog.ts:431-437`)
| id | name | centre x,z | radius |
|---|---|---|---|
| lumbridge | Lumbridge Haven | 0, 0 | 46 |
| varrock | Varrock Grand Plaza | 78, -20 | 44 |
| desert | Al-Kharid Golden Dunes | 68, 68 | 44 |
| woods | Whispering Korok Woods | -75, -30 | 45 |
| wilderness | Dragon's Peak Highlands | -70, 68 | 46 |

Used as: flat-terrain centres (`getTerrainHeight`, flat radius 16, blend to 28), HUD region detection (`checkRegionChange`, `4098-4110`: first region whose radius contains the player sets `STATE.currentRegion` and a banner; outside all radii nothing changes), minimap discs (`5136-5147`), teleport targets (`teleportToRegion`, `4082-4095`: puts the player at `(x, terrainHeight, z+4)`), shrine positions, death respawn (lumbridge, `5060-5063`). The radius has no effect on monsters, spawns, terrain colour or collision.

### 2.2 Shrines (one per region)
Position `(region.x, region.z - 6)`, built in `buildAllCitiesAndLandmarks` (`runtime.ts:1671-1716`) and duplicated as `shrineWorldPos` in `src/state/shrines.ts:5-7`. Procedural stacked boxes plus a rune octahedron, upgraded to `World_shrine` (`1709-1715`). `userData.action='worldmap'` (opens the world map on interact).

### 2.3 Structures, stations and NPCs (`buildAllCitiesAndLandmarks`, `runtime.ts:1670-1754`)
- Lumbridge castle `createCastleStructure(0, -25)` (`1719`, body `1756-1816`), upgraded to `World_castle`. Its collision is separate: `castleBlockers()` (`collision.ts:18-30`) six hard-coded boxes keyed to the same (0,-25).
- Castle guards (2): `createCastleGuard` at (-2.4,-16.5) and (2.4,-16.5) (`1720-1721`). Visual from `public/models/guard.glb` (separate loader `2048-2068`), not `world.glb`. Action `dialogue`.
- Props from `world.glb` via `spawnWorldProp` (`2113-2138`, no collision, no interaction): `World_barrel`, `World_crate`, `World_box_cabbage`, `World_box_apples`, `World_bag_grain`, `World_bag_closed` at 12 hard-coded points (`1724-1737`).
- Altars (`createPrayerAltar`): (-10,-4) and (72,-26) (`1740-1741`), `World_altar`.
- Forges/ranges (`createForgeStation`): (10,-4) and (86,-16) (`1744-1745`), `World_forge`.
- Merchants (`createMerchantNPC`, humanoid rig from `hero.glb`): (-7,5), (78,-12), (64,62) (`1748-1750`); no world.glb node.
- Bank booth `createBankBooth(2.2, 4.2)` (`1751`, body `1915-1969`), `World_bank_booth`. Slayer master `createSlayerMaster(5.5, 8.5)` (`1752`, `1971-2016`), humanoid rig, no world.glb node.
- All interactive pieces register hitboxes in `worldInteractiveObjects` with `userData {type:'interactive', action, name, interactRadius}`; `interactRadius` is stored but never read (grep: only assignments). The player stop distance for interactives is hard-coded 3.5 (`5478`).
- NPC names/positions are also pushed to `npcList` for minimap dots and labels.

### 2.4 Biome landmarks (`buildBiomeLandmarks`, `runtime.ts:1537-1668`, placements `1655-1667`)
Procedural fallback builders, each upgraded to a `world.glb` node of the given name:
- `World_sandstone_arch` (80, 82); `World_palm_tree` (58,58), (74,52)
- `World_plaza_pillar` (70,-16), (86,-24), (78,-30)
- `World_mystic_mushroom` (-66,-22) purple, (-84,-26) cyan (colour via `mushroomHex` override)
- `World_woods_lantern` (-72,-38), (-90,-34)
- `World_obsidian_spire` (-58,62), (-66,90); `World_lava_fissure` (-74,70)
No collision, no interaction.

Floating labels: `LANDMARKS` (`runtime.ts:5217-5223`), 5 hard-coded name/position/height rows, a third list of overlapping positions (castle, plaza, arch, lantern, spire).

### 2.5 Resource nodes (`spawnAllResourcesAndMonsters`, `runtime.ts:3553-3590`)
Hard-coded `[[x,z],...]` arrays, one `forEach(spawnResourceNode(key, x, z))` per line. Y = terrain height, or fixed `-0.30` for `kind:'fish'` (`3433`).

| Group (comment) | Entries |
|---|---|
| Lumbridge | normal_tree (-19,-2) (-24,8) (-20,-11) (17,-11) (22,-4); oak_tree (-14,24) (8,26) (-25,20); maple_tree (-6,22) (16,24) (4,30); fish_shrimp (27,5) (28,14) (26,-8); fish_trout (29,22) (27,-18); copper_rock (-18,-22) (-12,-25) |
| Varrock | iron_rock (94,-8) (98,-14) (92,-2); mith_rock (102,-18) (100,-24); willow_tree (64,-32) (70,-38) |
| Al-Kharid | gold_rock (85,55) (88,62) (82,48); mith_rock (54,78) (58,84) |
| Woods | yew_tree (-60,-32) (-66,-48) (-88,-18) (-92,-30); magic_tree (-75,-14) (-84,-48) (-95,-40); fish_lobster (25,-36) (27,-44); fish_shark (26,-54) (28,-62) |
| Dragon's Peak | runite_rock (-92,68) (-88,76) (-74,92) |

Facts about this list: the lobster and shark spots are under the "WOODS" comment but sit on the river at x 25-28, z -36 to -62 (about 100 units from the woods centre at (-75,-30); the lobster spots are within Lumbridge's radius of (0,0), the shark spots at z -54/-62 are inside no region radius). Al-Kharid has no fishing spot although its description says "Oasis Fishing" (`catalog.ts:434`). Tree and rock sizes: `def.scale` for trees (`3439`), fixed for rocks. `RESOURCE_NODES_DEF` per-node fields: `name, skill, req, xp, item, respawn (ms), kind ('tree'|'rock'|'fish')` plus `foliageColor/trunkColor/scale` (trees) or `oreColor` (rocks) (`catalog.ts:483-498`).

### 2.6 Monsters (same function)
| Type | Positions | Region comment |
|---|---|---|
| chicken | (-13,4) (-16,10) (-11,14) (-17,17) | Lumbridge |
| goblin | (12,4) (15,11) (18,17) (10,19) (20,8) | Lumbridge |
| goblin_archer | (24,13) (27,19) | Lumbridge |
| dark_wizard | (62,-6) (68,-2) (58,-14) | Varrock |
| dark_ranger | (74,-10) (80,-4) | Varrock |
| hill_giant | (88,-36) (96,-28) (82,-42) (95,-40) | Varrock |
| scorpion | (52,54) (60,76) (76,58) (82,72) (68,84) | Al-Kharid |
| moss_guardian | (-64,-18) (-82,-22) (-70,-44) (-86,-38) | Woods |
| lesser_demon | (-56,56) (-64,78) (-82,58) (-58,84) | Dragon's Peak |
| elvarg_dragon | (-82,82) (single) | Dragon's Peak |

Total 34 monsters (4+5+2+3+2+4+5+4+4+1), 10 spawn lines (`3555-3588`). No spawn table, density, level band or region binding in data: the region is only the code comment. `MONSTER_TYPES` has no placement fields.

### 2.7 Player start
`player.pos = (-4, 0, -3)`, yaw 0.48 (`runtime.ts:1082-1084`), overwritten by the save pose if one loads (`1033-1037`). Death and teleport use `region + (0, 4)` (`4087`, `5062`).

## 3. Movement and collision

### 3.1 Walkability (`src/state/collision.ts`)
`isWalkable(x,z)` (`46-51`) is true unless any of: outside +-118 on either axis; `isDeepWater` (`32-37`: within 4.6 of `riverCenterX(z)` and not on the bridge rectangle `|z|<=2.05, 20.5<=x<=35.5`); `hitsCastleWall` (`39-44`: point inside any of six AABBs built around (0,-25): north wall, two south wall segments with a 3.4-wide gate gap at x in (-1.7, 1.7), west wall, east wall, central keep `x +-3.8, z -31.6..-25.4`).
`moveWithCollision(x,z,dx,dz)` (`53-61`): clamp to +-118, try the full step; if blocked try X only, then Z only, else stay. It tests the destination point only; there is no entity radius, no swept test, and the player moves 11.5 units/s with dt capped at 0.08, so at most 0.92 units per frame; the castle walls are 1.4 thick (`t = 0.7` each side, `collision.ts:21`), so a single step cannot skip over one.
Nothing else is an obstacle. Trees, rocks, ore veins, shrines, altars, forges, bank, NPCs, guards, props, landmarks, monsters and the player do not block movement (no collision data exists for them; resource hitboxes at `3520-3526` are click colliders only). Terrain slope does not block movement.

### 3.2 Staying on the ground
- Player: each frame `groundY = max(-0.25, getTerrainHeight)`; grounded players lerp Y toward it at `dt*18`; jump uses `jumpVel 7.8` and gravity 20 (`5558-5570`, `3736-3740`).
- Monsters: Y is set directly to `getTerrainHeight(x,z)` on every move (`5840`, `5869`) with no clamp (a monster in the river trough would sit at -1.45), and `poseMonsterLimbs` re-sets group Y from terrain each frame (`3306`).
- Camera: target Y is `max(terrainUnderCamera + 1.2, player.y + 1.85 + vertDist)` (`5767-5768`).

### 3.3 Where input is validated against walkability
Ground click (`handleWorldClick:4025-4035`), minimap click (`3821`) and context-menu "walk here" (`3974`) call `isWalkable` on the clicked point only. Then `player.targetPos` is set and the player walks in a straight line (`5526-5540`); each frame goes through `moveWithCollision`.

### 3.4 Pathfinding
None. Grep for pathfinding, A*, navmesh, grid or waypoints finds nothing. All movement (player click-to-move, player chasing a target, monster chasing, monster wandering) is a straight-line vector toward the destination, filtered by `moveWithCollision`'s axis-slide. A destination behind the river or the castle makes the mover slide along the obstacle or stop, and nothing re-routes it. Player target arrival radius 0.45 for ground clicks (`5530`) and a stop distance for entities: monsters 2.9 melee / 13.5 for rapid, ranged and magic styles (`5466`), resources 3.1 (`5474`), interactives 3.5 (`5478`). There is no line-of-sight test for ranged or magic; range is horizontal distance only.

## 4. Monster behaviour

### 4.1 State (object created in `spawnMonster`, `runtime.ts:3377-3426`)
`typeKey, def (MONSTER_TYPES entry), rig (meshes, hitbox, limb pivots), pos (alias of rig.group.position), spawnPos (Vector3 at spawn), hp, maxHp (= def.hp), dead, isDying, dyingTimer, flinch, flashTimer, respawnTimer, wanderTimer (initial random 0-3 s), attackCooldown (0), attackAnim, breathCount, inCombatWithPlayer, labelEl`. Added later: `wanderTarget` (`5857`). `userData = {type:'monster', entity, interactRadius}` (interactRadius unread). `def` fields: `name, level, hp, maxHit, atk, def, scale, style ('melee'|'ranged'|'magic'), bodyColor, accentColor, kind, weaponColor?, drops[]`.
Registered in `monstersList` (`3421`), its hitbox in `worldInteractiveObjects` (`3419`).

### 4.2 Initiating combat and aggression
- **No monster ever starts combat.** `inCombatWithPlayer` is set true in only one place: `applyDamage` inside `performPlayerAttack` (`4844`), which runs when the player's attack lands (or after the projectile impact), including a miss. There is no aggro radius, no aggression flag, no per-monster "aggressive" field, and no line-of-sight or sight check. Walking next to any monster, including Elvarg, does nothing.
- The player starts a fight by clicking a monster (`handleWorldClick:4038-4043`) which sets `player.targetEntity`; the loop walks in until within `stopDist` and attacks once per 0.6 s tick (`TICK_SEC`, `86`, `5515-5518`).
- A monster leaves combat when: it dies (`4923`), the player dies (`5039`, all monsters cleared), the player is farther than 26 horizontally (`5830-5831`), or it respawns (`5810`).

### 4.3 In combat (`runtime.ts:5826-5850`)
Each frame while `inCombatWithPlayer`: rotate to face the player (lerp `dt*9`); attack range `11.0` if `def.style` is `'magic'` or `'ranged'` else `2.9`. If `dist > range`: step toward the player at 5.2 units/s via `moveWithCollision` (chase; faster than wander 1.8, slower than player 11.5) and play walk pose. Else: `attackCooldown -= dt`; at <= 0 call `performMonsterRetaliation` and reset the cooldown to 1.65 s (fixed for every monster; first swing is immediate because the cooldown starts at 0).
Attack roll (`4964-5029`): `monAtk = def.atk*1.25 + 8`; `playerDef = (defLvl*1.2 + equipment def)*prayerMult + 10`; `hitChance = clamp(monAtk/(monAtk+playerDef), 0.12, 0.82)`; damage `max(1, floor(random*(maxHit+1)))` through `mitigateDamage` (`combat.ts:108-117`, protect prayers cut to 20% by `def.style`). Elvarg: every third attack (`breathCount % 3 === 0`) is dragonfire, raw `max(1, floor(random*43))` through `resolveDragonfire` (`adventure.ts:356`). Delivery is hard-coded per `typeKey`: dark_wizard shadow bolt; goblin_archer and dark_ranger arrows; lesser_demon hellfire orb; moss_guardian instant plus ring effect; any other magic or ranged style a generic bolt; everything else instant (`5012-5028`).
There is no damage-over-time, no multi-target, no monster special beyond dragonfire, no flee, and no monster-to-monster interaction.

### 4.4 Out of combat: wander (`5851-5877`)
Every 2.5-6.5 s pick a new `wanderTarget` at a random angle and radius 0-4.5 from `spawnPos`; walk to it at 1.8 units/s via `moveWithCollision`, with walk/idle pose. Anything outside combat therefore returns toward its spawn within a few seconds. There is no explicit leash or reset: a monster pulled up to 26 units away just drops combat there, keeps its current HP (no regeneration exists: grep shows only two writes to a monster's `hp`, damage `4849` and respawn reset `5807`), and wanders back.

### 4.5 Death and respawn
- A player hit that takes the monster's HP to 0 calls `handleMonsterDeath` (`4882`, `4919-4962`): `dead = true`, `isDying = true`, `dyingTimer 0.85`, `respawnTimer 7.5` (fixed, same for the dragon; not in `MONSTER_TYPES`), clears the player's target, bursts, chat line, `registerKill` (`adventure.ts:469-501`: sets quest flags by `typeKey`, advances slayer task), drops, rare-loot beam.
- Death animation (`5789-5800`): tilt and sink 0.45 over 0.85 s, then `group.visible = false`.
- Respawn (`5802-5818`): after `respawnTimer` hits 0, HP restored, position reset to `spawnPos`, flags cleared, visible again. Always in the same spot; not blocked by the player standing there.
- Dead monsters stay in `monstersList`; their hitboxes stay in `worldInteractiveObjects` but click handlers reject `dead`.

### 4.6 Drops
Rolled at death, in `def.drops` order (`4941-4959`): each entry `{id, chance}` or `{gp:[min,max], chance}`; `Math.random() <= chance`; gold is added straight to `STATE.gp`; items go straight into the backpack via `addItem` (`state/inventory.ts`), with a "backpack is full" message and the item lost if no room. No ground loot objects exist, no loot ownership, no quantity field in the data (`d.qty || 1`, `4952`, not set on any entry). `isBossLoot` is true only for `elvarg_dragon` (`adventure.ts:285`).

### 4.7 Rendering link
`createMonsterMesh(def, typeKey)` (`3285-3300`) switches on `typeKey` to ten procedural builders (`2610-3283`), defaulting to the goblin raider for unknown keys. After spawn, `loadBlenderMonstersTemplate()` (`3422-3425`) swaps the rig for `Monster_<typeKey>` from `monsters.glb` (section 7). `typeKey` is also branched in: `poseMonsterLimbs` animations (`3325-3350`), `performMonsterRetaliation` (above), `registerKill`, `SPECIES_HIDE` (`textures.ts:60-69`), `SLAYER_BANDS` (`adventure.ts:24-31`), minimap size/colour (`5187`), label height (`5302`).

## 5. What the save stores

`src/state/save.ts`. Key `gielinor_hero_save_v1` (`11`); legacy keys `runewilds_save_v3`, `runewilds_save_v2` (`12`); `readSave` tries them in that order and returns the first that parses (`150-162`).
`serializeState` (`113-142`) writes a flat JSON object with `version: 4` and these fields: `gp, xpMultiplier, combatStyle, activeSpell, specArmed, specEnergy, hp, maxHp, prayerPts, maxPrayerPts, activePrayers[], currentRegion, timeOfDay, audioEnabled, transferQty, skills, equipment, inventory, bank, shrines, quests, playerPos {x,y,z,yaw}, cam {yaw, manualOffset, pitch, distance}`.

World-related content:
- **Position**: `playerPos`, rounded to 2 decimals (`runtime.ts:985-990`). On load only `x`, `z`, `yaw` are applied (`1033-1037`); `y` is ignored and recomputed from terrain. The loaded position is not checked with `isWalkable` or clamped, so a position that is now inside a wall or deep water would be restored as-is.
- **Region**: `currentRegion` (a region id string). Accepted if it is any string (`save.ts:36`); not checked against `WORLD_REGIONS`. At startup the banner uses `WORLD_REGIONS.find(id) || WORLD_REGIONS[0]` (`runtime.ts:6246`); `checkRegionChange` then overwrites it as soon as the player is inside a region radius.
- **Shrines**: `shrines: Record<regionId, boolean>`. On load (`save.ts:65-71`) the map is rebuilt from `initialShrines()` (keys come from `WORLD_REGIONS`, `shrines.ts:9-15`), so unknown saved ids are dropped and new region ids default to false; `lumbridge` is forced true. A second hard-coded copy of the five ids exists in `gameState.ts:11-17` (`STARTER_SHRINES`).
- **Time of day**: `timeOfDay % 3`.
- **Not saved**: monster HP, dead state or positions; resource depletion; the player's target; camera lights; anything about the map layout. Every load rebuilds a fresh world from the code in section 2.

Version and migration: one function, `migrateLegacySave(raw, source)` (`26-111`), starts from `createDefaultState()` and copies each field after a type check, with clamps; missing or wrongly typed fields keep defaults. There is no version dispatch and no stepwise migrations: `data.version` is read only in the `migratedFrom` expression (`109`), which returns the source key when the source differs from the current key or when `version < 4`. Legacy-key loads add `hylian_cape` if the cape slot is empty (`58-60`). Quests go through `normalizeQuests` (`quests.ts`). Writing happens through `writeSave` every 2 s by the game loop (`runtime.ts:5929-5932`; the autosave `try/catch` is empty, `1006`) and on manual save. The `gielinor_anime_hero_v1` localStorage flag (`1018-1032`) is a separate one-time gear/camera migration in `runtime.ts`.

## 6. Test coverage

Runner: `vitest run` (`package.json` `test`); six files in `tests/`. Nothing imports `runtime.ts`.

| Area | Covered by | What is asserted |
|---|---|---|
| `isWalkable`, `riverCenterX` | `tests/phase1.test.ts:193-203` | 7 points: (4,12) true, (28,0) true (bridge), river centre at z=40 false, (0,-34) and (0,-28) false (castle north wall, keep), (0,-17) and (0,-23) true (gate, courtyard). `moveWithCollision`, `isDeepWater`, `castleBlockers`, +-118 bound are not tested directly. |
| Shrine discovery | `phase1.test.ts:176-191` | Initial state, discovery within range of `shrineWorldPos`, only that region unlocks. Uses `WORLD_REGIONS` via `data/world`. |
| Save migration | `phase1.test.ts:22-84`, `phase2.test.ts` (quest flags), `phase3-content.test.ts:23` | Legacy v3 key, equipment, stacking, shrine defaults. No test for `playerPos`, `cam`, `currentRegion`, the `version` field, `serializeState`, or `writeSave`. |
| Respawn state | `tests/phase4-combat.test.ts:13` | `applyRespawn` and `RESPAWN_SECONDS`, `deathNotice` only (player respawn, not monster respawn). |
| Monster kill hooks | `phase2.test.ts:121-176`, `phase3-content.test.ts` | `registerKill`, slayer counting. |
| Combat helpers | `phase1.test.ts:131-174` | `canUseStyle`, `prepareAttack`, `mitigateDamage`. |
| Biome ground id | `tests/textures.test.ts:275-284` | 5 points for `biomeGroundId`. |
| Terrain shader | `textures.test.ts:238-274` | Shader string contains the expected texture lookups and uniforms. |
| UV mapping | `textures.test.ts:185-200` | `assignGroundUvs` maps by XZ. |
| Texture assets | `textures.test.ts:147-318` | Existence/format of `public/textures` files, species hide mapping (`399-412`). |

Only in `runtime.ts` (no test, and `// @ts-nocheck` so no type checking either): `getTerrainHeight`, `rawHills`, `getBiomeColor`, terrain/water/grass construction, every placement list, `spawnMonster`, `spawnResourceNode`, monster wander/chase/attack timing, respawn timing, drop rolling, `performMonsterRetaliation`, `performPlayerAttack`, `handleMonsterDeath`, `checkRegionChange`, `teleportToRegion`, `saveGameState`/`loadGameState`, the minimap and labels. Not tested anywhere: `blenderWorld.ts`, `blenderMonsters.ts` (they need a loaded GLB), `data/world.ts` consistency (no test that every `MONSTER_TYPES` key has a builder, a `Monster_<key>` node or a spawn; none that spawn points are walkable).

## 7. world.glb dependence vs TypeScript

Blender is not installed on the build machine, so anything in the left column cannot be regenerated; the checked-in GLBs are the only source.

### 7.1 Files
- `scripts/blender/build_world.py` (2328 lines) writes `public/models/world.glb` (`2311-2320`) and `world.blend`; header `1-38` says 23 assets, but `build_all_world_assets` (`2182-2223`) builds 29 and the GLB scene roots are 29 `World_*` empties (verified from the GLB). The six assets beyond the header list are `World_barrel`, `World_crate`, `World_box_cabbage`, `World_box_apples`, `World_bag_grain`, `World_bag_closed` (builders `2136-2178`, partly imported from `.blend` files via `get_blend_object`, `54-115`).
- Roots in world.glb: altar, bag_closed, bag_grain, bank_booth, barrel, box_apples, box_cabbage, castle, crate, fishing_spot, forge, lava_fissure, magic_tree, maple_tree, mystic_mushroom, normal_tree, oak_tree, obsidian_spire, ore_rock, palm_tree, plaza_pillar, river_bridge, rock_depleted, sandstone_arch, shrine, tree_stump, willow_tree, woods_lantern, yew_tree. There is no `World_yew`-like alias, no terrain, no water, no region, no road, no village or building other than the castle.
- `monsters.glb` roots: `Monster_` + chicken, goblin, goblin_archer, scorpion, dark_wizard, dark_ranger, hill_giant, moss_guardian, lesser_demon, elvarg_dragon (10, one per `MONSTER_TYPES` key). `guard.glb`: one root `CastleGuard`. `hero.glb` is used for the player, merchants and slayer master (not read for this document).

### 7.2 How runtime finds nodes (`blenderWorld.ts`)
- `cloneWorldNode(gltf, name, overrides)` (`135-158`): `gltf.scene.getObjectByName(name)`, clone, zero its transform, re-material, move its children into a new group. Name is an exact string; missing name returns null and the procedural fallback stays.
- Trees (`163-201`): visual `World_${nodeKey}` where `nodeKey` is the `RESOURCE_NODES_DEF` key (`normal_tree`, `oak_tree`, `willow_tree`, `maple_tree`, `yew_tree`, `magic_tree`), falling back to `World_normal_tree`; depleted state `World_tree_stump`. Foliage and trunk colours come from a TS table (`blenderWorld.ts:168-178`) and `def.trunkColor`, not from the GLB.
- Rocks (`202-230`): all five ore keys share `World_ore_rock`; depleted `World_rock_depleted`; ore colour from `def.oreColor`, stone tile from `biomeGroundId` at the node position.
- Fishing (`231-241`): all four fish keys share `World_fishing_spot`; no depleted mesh.
- Props (`upgradeWorldPropWithGltf`, `259-310`): `targetGroup.clear()`, keeps hitboxes registered in `worldInteractiveObjects` (made invisible), adds the cloned children and copies the interactive `userData` onto every mesh.
- Materials: `applyWorldMaterials` (`62-133`) replaces every GLB material by substring match on the GLB material or mesh name (`ore_vein`, `mushroom_cap`, `crystal`, `lava`, `foliage/leaf/grass/moss`, `bark`, `wood`, `sand`, `obsidian`, `slate/roof`, `stone/marble/rock`, `iron/anvil/steel`, `gold/brass`, `cloth`, `water`; default `facetMaterial` using the GLB base colour). So material names in the GLB steer appearance.
- Monsters (`blenderMonsters.ts:91-179`): exact name `Monster_${typeKey}`; swaps the rig's children; limb pivots found by name `<typeKey>_HeadGroup|LeftArmPivot|RightArmPivot|LeftLegPivot|RightLegPivot|LWing|RWing` (`findPivot`, `72-86`, also matches the bare suffix). Animation in `poseMonsterLimbs` rotates these pivots; a node without them just does not animate. Hitbox and collider children of the procedural rig are kept.
- Failure mode: both loaders resolve null on error and the game continues with the procedural meshes (`blenderWorld.ts:19-22`, `blenderMonsters.ts:19-22`). Every world prop and monster has a complete procedural builder in `runtime.ts` (props `1537-2016`, monsters `2610-3283`), so a GLB is a visual upgrade only.

### 7.3 Split
Depends on GLB contents (changing needs Blender, to re-run the `.py` scripts):
- Look of: castle, river bridge, shrine, altar, forge, bank booth, the seven landmark types (arch, palm, pillar, mushroom, lantern, spire, fissure), the six market props, the six tree species and stump, ore rock and depleted rock, fishing spot, and all ten monster models and their pivot names/rig.
- Not an object in the GLB: the slayer master, merchants (hero rig), guards (own GLB).
- Scale, pivot origin at ground (Y=0) and footprint of each node are baked in the GLB; the runtime does not scale monster or prop clones (`cloned.scale.set(1,1,1)`, `blenderWorld.ts:143`, `blenderMonsters.ts:99`) apart from tree `def.scale` applied on the group (`runtime.ts:3440`) and `spawnWorldProp`'s optional scale.

Generated entirely in TypeScript at runtime (no Blender needed):
- Terrain height field, mesh resolution and extents, biome vertex colours, terrain shader and biome tile blending, water plane and shader, river, grass scatter, sky dome, lights, fog, time of day.
- Region table, shrine placement, every placement list in section 2 (positions, counts, rotation of props, which node goes where), collision, walkable bounds, castle colliders, road strip.
- All monster and resource stats, drop tables, AI, respawn, save format.
- Procedural fallback geometry for every structure, prop, node and monster (the same code that runs when a GLB is missing).
- The `World_`/`Monster_` name strings that connect the two sides: nodeKey and typeKey equal the data keys; prop names are string literals at `runtime.ts:1533, 1555 (via place), 1655-1667, 1711, 1724-1737, 1814, 1852, 1908, 1963`.

## 8. Notes found while reading (observed behaviours, not recommendations)

- `runtime.ts:5494-5506`: for interactive targets the loop sets `player.targetEntity = null` (5496) and then reads `player.targetEntity.ref.dialogue` / `.name` in the `dialogue` branch (5503-5505), which would dereference null. The `shop`, `bank`, `forge`, `worldmap`, `slayer` and `altar` branches do not read it. Not exercised by any test.
- `interactRadius` values (2.8-4.2) in every `userData` are never read.
- `desert` (Al-Kharid) is the only region with no teleport spell (`catalog.ts:405-408`); it is reachable by the world map shrine teleport after discovery (`ui/stations.ts:456-496`).
- World-map teleport from a discovered shrine does not use runes (`bridge.teleportSpell` -> `teleportToRegion`, `runtime.ts:6140`); the spell route checks level and runes (`handleSpellClick`, `532-560`) and does not check shrine discovery.
- Walkable bound +-118 is a literal in `collision.ts:47,54`, not derived from the +-130 mesh or the region table.
- Terrain flat core (16) and blend (28) are smaller than region radii (44-46), so the "region" is bigger than the flattened area; region effects other than the HUD banner are none.
