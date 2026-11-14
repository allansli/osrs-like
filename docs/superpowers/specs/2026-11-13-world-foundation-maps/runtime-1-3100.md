# runtime.ts map, lines 1-3100

Source: `src/engine/runtime.ts` (6253 lines total; first line is `// @ts-nocheck`). Facts only. Line numbers are from the branch `feat/world-foundation` as read.
The range ends inside `buildLesserDemon` (starts 3090, continues to about 3193). `buildElvargMesh` (3194) is the next function.
Only the file's own top-level functions are called by name below. "gameLoop" is at 5371-5981, "wireBridge" at 6130-6199 and the `DOMContentLoaded` handler at 6224 are outside this range.

## 1. Contiguous sections

| # | Lines | What it does | Functions / declarations |
|---|-------|--------------|--------------------------|
| A | 1-86 | `@ts-nocheck`, imports, `TICK_SEC` | `TICK_SEC` (86) |
| B | 89-141 | Web Audio synth (header "1."). IIFE with private `ctx`; every sound is `tone()` calls, some via `setTimeout` | `SFX` (92): `init`, `tone`, and keys `hit miss slash heavyChop crush whipCrack crossbow flinch bow magic chop mine fish eat coin prayer jump levelUp` |
| C | 143-159 | Static HUD icon injection (header "2.") | `initStaticSvgIcons` (146) |
| D | 161-263 | Chat log, combat level, item requirement display, equipment bonus and set-bonus maths | `addChatMessage` (161), `getCombatLevel` (172), `getItemReqInfo` (176), `getEquipmentBonuses` (202) |
| E | 265-318 | XP grant, level-up, XP drop, banners | `grantXp` (265), `spawnXpDrop` (293), `showLevelUpBanner` (304), `showBanner` (308); var `lvlBannerTimeout` (303) |
| F | 320-454 | Inventory ops and item use (sell, eat, drink, bury, equip, burn) | `addItemToInventory` (320), `countItemInInventory` (327), `removeItemsFromInventory` (331), `sellInventoryItem` (337), `sellPayoutLabel` (354), `showSellChooseMenu` (362), `handleInventoryClick` (381) |
| G | 456-573 | Equipment, tabs, combat style, special, prayer, spell, XP rate toggles | `unequipSlot` (456), `switchTab` (470), `setCombatStyle` (479), `toggleSpecialAttack` (498), `togglePrayer` (508), `handleSpellClick` (532), `toggleXpMultiplier` (564) |
| H | 575-803 | Full HUD/panel redraw (vitals, quest tracker, slayer widget, inventory grid, skills grid, paperdoll, equipment stats, prayer grid, magic grid), then autosave and re-render of open modals | `updateAllUI` (575) |
| I | 805-981 | Modals (header "6."): open/close, shop buy/sell, smithing, XP table, world map, quest claim, slayer task | `closeModals` (808), `hideHoverTooltip` (815), `openModal` (821), `openShopModal` (829), `renderShopModal` (835), `buyShopItem` (839), `buyShopPair` (850), `sellAllLoot` (870), `sellAllUnequippedGear` (881), `openSmithingModal` (892), `renderSmithingModal` (897), `craftRecipe` (901), `openXpTableModal` (914), `openWorldMapModal` (943), `locateQuestRegion` (948), `claimQuestReward` (953), `requestSlayerTask` (967) |
| J | 983-1063 | Save / load / reset against localStorage; one-time save migration (`OVERHAUL_FLAG`, 1018) | `saveGameState` (983), `loadGameState` (1009), `manualSaveToast` (1050), `resetGameSave` (1056) |
| K | 1066-1117 | Header "7." Three.js module state, `player` and `camState` objects | declarations 1069-1117 (see section 2 of this doc) |
| L | 1119-1160 | Terrain height function, biome colour | `getTerrainHeight` (1119), `rawHills` (1139), `getBiomeColor` (1149) |
| M | 1162-1228 | Scratch vectors, graphics quality tiers, outlines toggle | `getQualityDpr` (1170), `applyQualityTier` (1180), `cycleGraphicsQuality` (1203), `toggleOutlines` (1210), `syncGraphicsButtons` (1223); type `QualityTier` (1166); vars `currentQuality`, `outlinesEnabled` |
| N | 1230-1273 | GPU telemetry | `telemetryInfo` (1230), `frameCounter` (1237), `lastFpsTime` (1238), `initGpuTelemetry` (1240) |
| O | 1275-1333 | Engine bootstrap: scene, camera, renderer, lights, then calls all builders, registers resize and input | `init3DEngine` (1275) |
| P | 1335-1399 | Sky dome shader and time of day | `buildSkyDomeShader` (1336), `cycleTimeOfDay` (1374) |
| Q | 1401-1535 | Terrain mesh, water shader, grass instances, river bridge | `buildTerrainAndWater` (1401), `buildRiverBridge` (1502) |
| R | 1537-1754 | Biome landmarks and world population (shrines per region, castle, guards, props, altars, forges, merchants, bank, slayer master) | `buildBiomeLandmarks` (1537; inner `place`, `sandstoneArch`, `palmTree`, `plazaPillar`, `mysticMushroom`, `woodsLantern`, `obsidianSpire`, `lavaFissure`), `buildAllCitiesAndLandmarks` (1670) |
| S | 1756-2138 | World objects and NPC builders | `createCastleStructure` (1756), `createPrayerAltar` (1818), `createForgeStation` (1859), `createBankBooth` (1915), `createSlayerMaster` (1971), `createMerchantNPC` (2018), `loadBlenderGuardTemplate` (2049; var `cachedGuardPromise` 2048), `createCastleGuard` (2070), `spawnWorldProp` (2113) |
| T | 2141 | NPC animator list | `npcAnimatorsList` (2141) |
| U | 2143-2516 | Header "8." Player character build and equipment mesh rebuild | `buildPlayerCharacter` (2146), `syncWhipGeometry` (2189), `rebuildPlayerEquipmentMeshes` (2210) |
| V | 2518-2608 | Monster construction helpers | `monsterPart` (2522), `monsterPivot` (2530), `monsterHitbox` (2536), `finishMonster` (2546), `glowEye` (2552), `paint` (2563), `addQuiver` (2567), `addStrungBow` (2587) |
| W | 2610-3100+ | Per-species monster mesh builders | `buildChickenMesh` (2610), `buildGoblinMesh` (2647, role `archer` or other), `buildScorpionMesh` (2752), `buildDarkWizard` (2819), `buildDarkRanger` (2893), `buildHillGiant` (2950), `buildMossGuardian` (3026), `buildLesserDemon` (3090, continues past 3100) |

Section numbers 3, 4 and 5 do not exist as headers; headers jump 2 to 6 (806).

## 2. Module-level mutable state declared in 1-3100

"Section" letters refer to the table above. Function names are the enclosing top-level function of each use (found by grepping the whole file). Items marked "past 3100" are uses outside this range.

### Plain `let` / `const` holding state

| Name | Line | Holds | Used in range (section: functions) | Used past 3100 |
|------|------|-------|-----------------------------------|----------------|
| `TICK_SEC` | 86 | const 0.6, combat tick seconds | none | `gameLoop` (5518, 5521, 5959) |
| `lvlBannerTimeout` | 303 | `setTimeout` id for the level-up banner | E: `showBanner` (316-317, read and write) | none |
| `scene` | 1069 | THREE.Scene (assigned in `init3DEngine` 1277) | M `toggleOutlines`; O `init3DEngine`; P `buildSkyDomeShader`, `cycleTimeOfDay` (`scene.fog`); Q `buildTerrainAndWater`, `buildRiverBridge`; R `buildBiomeLandmarks`, `buildAllCitiesAndLandmarks`; S `createCastleStructure`, `createPrayerAltar`, `createForgeStation`, `createBankBooth`, `createSlayerMaster`, `createMerchantNPC`, `createCastleGuard`, `spawnWorldProp`; U `buildPlayerCharacter` | `spawnMonster` (3420), `spawnResourceNode` (3545), `buildAtmosphericParticles` (3655), `setupInputHandlers` (3724, 3731), `spawnVfx` (4155), `launchProjectile` (4163), `spawnLevelUpFireworks` (4731, 4737), `gameLoop` (5895, 5920, 5963), `wireBridge` (6190) |
| `camera` | 1069 | THREE.PerspectiveCamera (assigned 1280) | O `init3DEngine` | `handleWorldHover` (3863), `pointerToWorld` (3905), `handleWorldClick` (4017), `worldToScreenPos` (5205), `gameLoop` (5771-5780, 5963), `onWindowResize` (6007-6008), `updateHoverTile` (6071, 6074), `wireBridge` (6188) |
| `renderer` | 1069 | THREE.WebGLRenderer (assigned 1282) | M `applyQualityTier`; O `init3DEngine` | `setupInputHandlers` (3768), `gameLoop` (5963, 5976-5977), `onWindowResize` (6009-6010) |
| `sunLight` | 1069 | DirectionalLight (assigned 1308) | M `applyQualityTier`; O `init3DEngine` | `gameLoop` (5783-5785) |
| `ambientLight` | 1069 | AmbientLight (assigned 1305) | O `init3DEngine` | none |
| `hemiLight` | 1069 | HemisphereLight (assigned 1302) | O `init3DEngine` | none |
| `terrainMesh` | 1070 | terrain Mesh (assigned 1422) | Q `buildTerrainAndWater` | `pointerToWorld` (3908), `updateHoverTile` (6071, 6075) |
| `waterMesh` | 1070 | water Mesh (assigned 1468) | Q `buildTerrainAndWater` | none |
| `skyDomeMesh` | 1070 | sky sphere Mesh (assigned 1370) | P `buildSkyDomeShader` | `gameLoop` (5399) |
| `grassInstanced` | 1070 | InstancedMesh (assigned 1483) | Q `buildTerrainAndWater` | `gameLoop` (5960-5961) |
| `waterUniforms` | 1071 | water shader uniforms (assigned 1429) | Q `buildTerrainAndWater` | `gameLoop` (5397) |
| `skyUniforms` | 1071 | sky shader uniforms (assigned 1337) | P `buildSkyDomeShader`, `cycleTimeOfDay` (mutates colors 1378-1394) | `gameLoop` (5398) |
| `worldInteractiveObjects` | 1072 | array of raycast targets | Q `buildTerrainAndWater` (1426); R `buildAllCitiesAndLandmarks` (1706, 1712); S `createPrayerAltar`, `createForgeStation`, `createBankBooth`, `createSlayerMaster`, `createMerchantNPC`, `createCastleGuard` (push) | `spawnMonster` (3419), `spawnResourceNode` (3544), `handleWorldHover` (3864), `pointerToWorld` (3906), `handleWorldClick` (4019) |
| `monstersList` | 1073 | array of live monsters | none | `spawnMonster` (3421), `handlePlayerDeath` (5039), `renderMinimap` (5182), `updateFloatingWorldLabels` (5290), `gameLoop` (5788), `wireBridge` (6195) |
| `resourceNodesList` | 1074 | array of resource nodes | none | `spawnResourceNode` (3546), `renderMinimap` (5163), `gameLoop` (5880) |
| `npcList` | 1075 | array of `{pos,name,color,yOffset}` label entries | S `createPrayerAltar` (1849), `createForgeStation` (1905), `createBankBooth` (1955), `createSlayerMaster` (2008), `createMerchantNPC` (2027), `createCastleGuard` (2094) (push) | `renderMinimap` (5172), `updateFloatingWorldLabels` (5329) |
| `projectilesList` | 1076 | array of projectiles | none | `launchProjectile` (4164), `gameLoop` (5891-5897) |
| `vfxList` | 1077 | array of timed effects | none | `spawnVfx` (4156), `gameLoop` (5915-5921) |
| `particlesList` | 1078 | array | none | no uses anywhere else in the file (declaration only) |
| `swayingFoliage` | 1079 | array of foliage to sway | none | `spawnResourceNode` (3512), `gameLoop` (5925) |
| `_tmpScratchVec` | 1162 | scratch Vector3 | none | `worldToScreenPos` (5205-5209) |
| `_camTargetVec` | 1163 | scratch Vector3 | none | `gameLoop` (5770-5771) |
| `_lookTargetVec` | 1164 | scratch Vector3 | none | `gameLoop` (5772-5773) |
| `currentQuality` | 1167 | `QualityTier`, init `'balanced'` | M `applyQualityTier` (write 1181), `cycleGraphicsQuality` (1205), `syncGraphicsButtons` (1225); O `init3DEngine` (1290) | `onWindowResize` (6010) |
| `outlinesEnabled` | 1168 | bool, init true | M `toggleOutlines` (read/write), `syncGraphicsButtons` (1227) | none |
| `telemetryInfo` | 1230 | `{gpuName,vendor,isHardwareAccelerated,fps,frameTimeMs}` | N `initGpuTelemetry` (writes) | `gameLoop` (5968, 5969, 5974, writes fps/frameTimeMs) |
| `frameCounter` | 1237 | frame count for FPS | none | `gameLoop` (5965-5970) |
| `lastFpsTime` | 1238 | `performance.now()` at last FPS sample | none | `gameLoop` (5966, 5967, 5971) |
| `cachedGuardPromise` | 2048 | memoised guard.glb load promise | S `loadBlenderGuardTemplate` (2053, 2055, 2067) | none |
| `npcAnimatorsList` | 2141 | array of animators from `upgradeHumanoidRigWithGltf` | S `createBankBooth` (1959), `createSlayerMaster` (2012), `createMerchantNPC` (2031) (push). Declared at 2141, after those functions (read at call time only) | `gameLoop` (5730-5731) |

### Shared state objects

| Name | Line | Holds | Used in range | Used past 3100 |
|------|------|-------|---------------|----------------|
| `player` | 1081-1105 | pos/vel Vector3, yaw, targetPos, targetEntity, movement and anim timers, `meshGroup`, `parts` (rig), `blenderAnimator` (added dynamically at 2179), cape angles, `activeWeaponKind`, downed flags | J `saveGameState` (985-989), `loadGameState` (1033-1036, writes pos.x, pos.z, yaw); U `buildPlayerCharacter` (writes meshGroup, parts, parts.spinRing, pos.y, blenderAnimator), `rebuildPlayerEquipmentMeshes` (66 lines: reads/writes `player.parts.*` gear keys and materials) | 25+ functions: `updateAtmosphericParticles`, `setupInputHandlers`, `onGameContextMenu`, `handleWorldClick`, `updateTargetHud`, `teleportToRegion`, `checkRegionChange`, `spawnHitSplatOnPlayer`, `spawnSpellImpact`, `spawnDragonfireEffect`, `spawnLevelUpFireworks`, `performPlayerAttack` (25 uses), `handleMonsterDeath`, `performMonsterRetaliation`, `handlePlayerDeath`, `finishRespawn`, `performResourceGather`, `renderMinimap`, `updateLandmarkLabels`, `updateFloatingWorldLabels`, `gameLoop` (176 uses), `wireBridge`, `DOMContentLoaded` handler |
| `camState` | 1107-1117 | yaw, manualOffset, pitch, distance, currentLookAt Vector3, shake, drag state | J `saveGameState` (991-995 read), `loadGameState` (1027-1030 write in migration, 1038-1042 write from save) | `setupInputHandlers` (14 uses), `resetCameraBehindPlayer`, `teleportToRegion`, `performPlayerAttack` (4853), `finishRespawn`, `renderMinimap` (5135), `gameLoop` (19 uses), `wireBridge` (6189), `DOMContentLoaded` handler (6251) |
| `STATE` (imported, not declared here) | import line 9 | the whole game state | used in 127 lines of 1-3100 across sections D to J and U | 74 more lines past 3100 |

Other module state in range that is not a declaration: `SFX` (92) holds a closure `ctx` (AudioContext, lazily created in `init` 94-100). `SFX` is referenced at 276, 347, 397, 407, 416, 423, 443, 527, 843, 865, 876, 887, 908, 959-960, 978, 1052 in range, and at 3739, 4091, 4846, 4886, 4894-4909, 4948, 5091, 5094, 5097, 5510, 6103, 6113, 6134 past 3100.
Persistent browser keys touched in range: `SAVE_KEY` and `LEGACY_SAVE_KEYS` (1059-1060), `'gielinor_anime_hero_v1'` (1018-1020), both via `localStorage`.

## 3. Call dependencies between sections

In-range calls (caller section -> callee section):

- D `getEquipmentBonuses` has no calls. D `addChatMessage` has no calls.
- E `grantXp` -> E `spawnXpDrop`, E `showLevelUpBanner` -> E `showBanner`; `grantXp` -> D `addChatMessage`, B `SFX.levelUp`, H `updateAllUI`, and `spawnLevelUpFireworks` (past range, via `typeof` guard at 288).
- F `addItemToInventory`, `removeItemsFromInventory`, `sellInventoryItem` -> D `addChatMessage`, H `updateAllUI`. `sellInventoryItem` -> B `SFX.coin`.
- F `showSellChooseMenu` -> F `sellPayoutLabel`, F `sellInventoryItem`, `openChooseMenu` (past range, 4000s).
- F `handleInventoryClick` -> F `sellInventoryItem`, D `addChatMessage`, E `grantXp`, H `updateAllUI`, U `rebuildPlayerEquipmentMeshes` (typeof guard 449), `spawnHitSplatOnPlayer` (past range, typeof guard 409). Reads DOM `#shop-modal` (386).
- G `unequipSlot` -> D `addChatMessage`, U `rebuildPlayerEquipmentMeshes`, H `updateAllUI`.
- G `setCombatStyle` -> D `addChatMessage`, `refreshCombatStyleLocks` (past range, 6014), H `updateAllUI`.
- G `toggleSpecialAttack`, `togglePrayer`, `toggleXpMultiplier` -> D `addChatMessage`, H `updateAllUI`.
- G `handleSpellClick` -> D `addChatMessage`, `teleportToRegion` (past range, 4082), E `grantXp`, H `updateAllUI`.
- H `updateAllUI` -> D `getCombatLevel`, `getItemReqInfo`, `getEquipmentBonuses`; F `handleInventoryClick`, `showSellChooseMenu`; G `unequipSlot`, `togglePrayer`, `handleSpellClick`; I `openXpTableModal`, `renderShopModal`, `renderSmithingModal`; J `saveGameState`; past range: `showItemTooltip` (6050), `moveItemTooltip` (6058), `hideItemTooltip` (6065), `refreshCombatStyleLocks` (6014). Also calls imported `renderBankModal`, `renderWorldMap`, `renderQuests`, `syncSettingsButtons`.
- I `closeModals` -> I `hideHoverTooltip`; past range `hideItemTooltip`, `hideContextMenu` (3894). `openModal` -> `closeModals`, `hideHoverTooltip`.
- I `openShopModal`, `openSmithingModal`, `openXpTableModal`, `openWorldMapModal`, `locateQuestRegion` -> I `openModal` (+ `renderShopModal` / `renderSmithingModal`).
- I `buyShopItem`, `buyShopPair`, `sellAllLoot`, `sellAllUnequippedGear`, `requestSlayerTask` -> D `addChatMessage`, H `updateAllUI`. `requestSlayerTask` -> D `getCombatLevel`.
- I `craftRecipe` -> D `addChatMessage`, I `renderSmithingModal`, E `grantXp`.
- I `claimQuestReward` -> D `addChatMessage`, E `showBanner`, H `updateAllUI`, `spawnLevelUpFireworks` (past range, direct call 963, no guard).
- J `manualSaveToast` -> J `saveGameState`, D `addChatMessage`.
- L `getTerrainHeight` -> L `rawHills`. Called by Q, R, S, U in range (1412, 1489, 1549, 1674, 1758, 1819, 1860, 1916, 1972, 2019, 2071, 2114, 2164) and from 19 more lines past 3100.
- M `applyQualityTier` -> `getQualityDpr`, `syncGraphicsButtons`. `cycleGraphicsQuality` -> `applyQualityTier`, D `addChatMessage`. `toggleOutlines` -> `syncGraphicsButtons`, D `addChatMessage`.
- O `init3DEngine` -> M `getQualityDpr`, N `initGpuTelemetry`, M `applyQualityTier`, P `buildSkyDomeShader`, Q `buildTerrainAndWater`, R `buildAllCitiesAndLandmarks`, U `buildPlayerCharacter`, `spawnAllResourcesAndMonsters` (past range, 3553), `setupInputHandlers` (past range, 3715); registers `onWindowResize` (past range, 6006) as resize handler (1331).
- Q `buildTerrainAndWater` -> L `getTerrainHeight`, `getBiomeColor`; Q `buildRiverBridge`.
- R `buildAllCitiesAndLandmarks` -> S `createCastleStructure`, `createCastleGuard`, `spawnWorldProp`, `createPrayerAltar`, `createForgeStation`, `createMerchantNPC`, `createBankBooth`, `createSlayerMaster`; R `buildBiomeLandmarks`.
- S `createCastleGuard` -> S `loadBlenderGuardTemplate`.
- U `buildPlayerCharacter` -> U `rebuildPlayerEquipmentMeshes`; `rebuildPlayerEquipmentMeshes` -> U `syncWhipGeometry`, D `getEquipmentBonuses`.
- V helpers: `glowEye`, `addQuiver`, `addStrungBow` -> `monsterPart`, `paint`.
- W builders -> V `paint`, `monsterPart`, `monsterPivot`, `monsterHitbox`, `finishMonster`, `glowEye`; goblin and ranger also -> `addQuiver`, `addStrungBow`.

Calls from past 3100 into this range (selected, caller -> callee):

- `createMonsterMesh` (3285) -> every W builder (3287-3298).
- `gameLoop` -> `getEquipmentBonuses` (5382, 5384), `syncWhipGeometry` (5736), `saveGameState` (5931), `openShopModal` (5497), `openSmithingModal` (5499), `openWorldMapModal` (5500).
- `performPlayerAttack` -> `grantXp` (4867-4869), `getEquipmentBonuses` (4756). `performMonsterRetaliation` -> `getEquipmentBonuses` (4967). `performResourceGather` -> `grantXp` (5105), `addItemToInventory` (5103). `handleMonsterDeath` -> `showBanner` (4937). `onGameContextMenu` -> `getCombatLevel` (3922). `updateFloatingWorldLabels` -> `getCombatLevel` (5259).
- `setupInputHandlers` -> `toggleSpecialAttack` (3742), `closeModals` (3745), `switchTab` (3752). `handleWorldHover` -> `hideHoverTooltip` (3855).
- `wireBridge` (6130-6199) calls (per grep): `closeModals`, `manualSaveToast`, `resetGameSave`, `cycleTimeOfDay`, `toggleXpMultiplier`, `showSellChooseMenu`, `sellAllLoot`, `sellAllUnequippedGear`, `setCombatStyle`, `switchTab`, `craftRecipe`, `openWorldMapModal`, `openShopModal`, `openSmithingModal`, `openXpTableModal`, `claimQuestReward`, `requestSlayerTask`, `locateQuestRegion`, `cycleGraphicsQuality`, `toggleOutlines`, `sellInventoryItem`, `buyShopItem`, `buyShopPair`, `unequipSlot`, `toggleSpecialAttack`, `togglePrayer`, `handleSpellClick`, `rebuildPlayerEquipmentMeshes`.
- `openBankModal` (6026), `openQuestsModal` (6032), `replayOnboarding` (6208) -> `openModal` / `closeModals`. `openSettingsModal` (6037) -> `openModal`, `syncGraphicsButtons`. `toggleAudio` (6043), `cheatSkillsPlus10` (6101), `cheatGold200k` (6111) -> `saveGameState`; the two cheats also -> `showBanner`. `applyLoadedStateToHud` (5991) -> `cycleTimeOfDay` (6003).
- `DOMContentLoaded` handler (6224) -> `initStaticSvgIcons` (6226), `loadGameState` (6227), `init3DEngine` (6228), `rebuildPlayerEquipmentMeshes` (6251). `window.addEventListener('beforeunload', saveGameState)` at 5989.
- `addChatMessage` is called from many functions past 3100 (performPlayerAttack etc.); `updateAllUI` likewise.
- `renderShopModal` (835) is a wrapper for imported `renderShopModalUi`; `renderSmithingModal` (897) wraps imported `renderForge`.
- `countItemInInventory` (327) and `removeItemsFromInventory` (331) have no callers anywhere in the file.

## 4. Imports from other `src/` files used in range 1-3100

Used in range (import line number -> first uses in 1-3100). Names imported on lines 4-84 that have no use in 1-3100 are listed at the end.

| Module | Names used in range |
|--------|--------------------|
| `three` (2), `three/examples/jsm/loaders/GLTFLoader.js` (3) | `THREE` (280 lines); `GLTFLoader` (2054 only). Type `GLTF` (2048, 2049) is not imported; the file is `@ts-nocheck` |
| `../data/items` (4) | `ITEMS`, `TIER_COLORS` (645-646), `isStackableInBackpack` (642), `unitSellPrice` (358) |
| `../data/skills` (5) | `SKILLS_META`, `OSRS_XP_TABLE`, `getLevelForXp` (271) |
| `../data/magic` (6) | `PRAYERS`, `SPELLS` |
| `../data/recipes` (7) | `tryCraft` (392, 902), `isLogId` (391) |
| `../data/world` (8) | `WORLD_REGIONS` (1120, 1671) |
| `../state/gameState` (9) | `STATE` (127 lines), `applyState` (1013) |
| `../state/inventory` (10) | `addItem`, `removeItem`, `countItem`, `canAddItem`, `sellItem`, `buyItem`, `sellInventoryMatch`, `isGatheredGood`, `isUnequippedGear` |
| `../state/save` (11) | `readSave` (1011), `writeSave` (997), `SAVE_KEY`, `LEGACY_SAVE_KEYS` (1059-1060) |
| `../state/combat` (12) | `allowedStyles`, `canCastTeleport` (551), `equippedWeapon` (480, 542) |
| `../state/adventure` (13-33) | `assignSlayerTask` (974), `adventureTracker` (598), `claimQuest` (954), `combatLevel` (173), `slayerCard` (606), `weaponSpecial` (499, 591) |
| `../state/quests` (34) | `noteBury` (425), `notePlate` (442), `notePrayerOffered` (526), `notePurchase` (844, 864), `noteSale` (348) |
| `../state/collision` (35) | `isDeepWater` (1490) |
| `./materials` (38) | `addCartoonOutline` (15 uses), `facetMaterial` (13), `grassMaterial` (1481), `PALETTE` (1150-1151, 1339-1341, 1431-1432) |
| `./textures` (39-51) | `albedoForItem` (2244-2287), `albedoMaterial` (19), `applyAlbedo` (10), `assignGroundUvs` (1419), `BIOME_COLORS` (1155-1157), `biomeAlbedoId` (1538-1544), `sealAlbedoUvs` (1329, 1528, 1550, 1809, 2135, 2514), `speciesAlbedo` (10), `terrainMaterial` (1421) |
| `./humanoid` (52) | `buildHumanoidRig` (1944, 1973, 2020, 2147), `LEAN_RIG` (1986, 2316, 2337, 2498, 2506, 2513) |
| `./blenderHero` (53) | `loadBlenderHeroTemplate` (1956, 2009, 2028, 2171), `upgradeHumanoidRigWithGltf` (1958, 2011, 2030, 2173) |
| `./blenderGear` (54) | `loadBlenderGearTemplate` (2009, 2028, 2183) |
| `./blenderWorld` (56-60) | `loadBlenderWorldTemplate` (8 uses), `upgradeWorldPropWithGltf` (7 uses) |
| `./playerGear` (61-73) | `buildAmuletVisual` (2408), `buildBodyVisual` (2368), `buildBootVisual` (2430-2431), `buildCapeVisual` (1992, 2483), `buildGloveVisual` (2459-2460), `buildHeadVisual` (2038, 2358), `buildLegsVisual` (2390), `buildRingVisual` (2417), `buildShieldVisual` (2325), `buildWeaponVisual` (1980, 2310), `headShowsHair` (2343) |
| `../ui/icons` (74) | `getUiSvg` (147-153+), `getSkillSvg` (298, 691, 925), `getItemSvg` (641, 721), `getPrayerSvg` (766), `getSpellSvg` (783) |
| `../ui/stations` (76-84) | `renderBankModal` (799), `renderShopModalUi` (836, imported as alias of `renderShopModal`), `renderWorldMap` (801, 945, 950), `renderQuests` (802), `renderForge` (898), `syncSettingsButtons` (792) |

Imported but not used anywhere in 1-3100: `MONSTER_TYPES`, `RESOURCE_NODES_DEF`, `prepareAttack`, `mitigateDamage`, `attackOptionLabel`, `applyRespawn`, `deathNotice`, `dharokMultiplier`, `gatherVerb`, `isBossLoot`, `hitSplatKind`, `isRareLoot`, `monsterThreatColor`, `noteGather`, `registerKill`, `RESPAWN_SECONDS`, `resolveDragonfire`, `moveWithCollision`, `isWalkable`, `discoverShrines`, `applyGold200k`, `applySkillsPlus10`, `matchCheat`, `biomeGroundId`, `offsetAlbedoPhase`, `loadBlenderMonstersTemplate`, `upgradeMonsterRigWithGltf`, `upgradeResourceNodeWithGltf`, `hexToCss`, `bridge`, `itemCompareHtml`.

Direct network fetch in range: `GLTFLoader.load('/models/guard.glb')` (2054-2064), not through a `./blender*` module.

## 5. Game rules mixed into rendering or DOM code

Rules living inside DOM/render functions or in functions that also touch DOM:

- `grantXp` (265-291): XP multiplier (`STATE.xpMultiplier`, 268), level recompute (271), HP/prayer max and heal on level up (277-284), plus DOM xp drop, chat, banner and fireworks calls (273, 286-288). Level-up also mutates `STATE.maxHp`, `STATE.hp`, `STATE.maxPrayerPts`, `STATE.prayerPts`.
- `getEquipmentBonuses` (202-263): pure arithmetic on `STATE`, but the set-bonus rules (+20% at 4 pieces, +15% at 3, +10% for body+legs pair, rounding `Math.ceil`) live here, and the result is used for both HUD text (`updateAllUI` 730-754) and a mesh cue (`rebuildPlayerEquipmentMeshes` 2494-2510).
- `getItemReqInfo` (176-200): requirement check (`STATE.skills[k].lvl >= req`) returns HTML strings with inline styles.
- `handleInventoryClick` (381-454): decides log burning, eating (`STATE.hp` heal 402-411), potion (`STATE.prayerPts` restore 413-420), bury (421-428), equip with level requirement check (429-452, mutates `STATE.equipment`, `STATE.combatStyle`), all mixed with `SFX`, chat HTML, mesh rebuild and `updateAllUI`. Also branches on DOM state (`#shop-modal` has class `open`, 386).
- `unequipSlot` (456-468): backpack-room rule, resets `STATE.combatStyle` when weapon removed, then rebuilds meshes.
- `setCombatStyle` (479-496), `toggleSpecialAttack` (498-506), `togglePrayer` (508-530, level req, prayer points, overhead exclusivity, `notePrayerOffered`), `handleSpellClick` (532-562, level req, weapon-style gate, teleport rune cost removal and magic XP grant): rules plus chat/SFX in the same function.
- `toggleXpMultiplier` (564-573): flips `STATE.xpMultiplier` (1 or 10) and edits the button text in the same function.
- `updateAllUI` (575-803): derives `STATE.maxHp` and `STATE.maxPrayerPts` from skills (576-577); clamps vitals; computes next-level XP from `OSRS_XP_TABLE` (684); builds item stat strings; and calls `saveGameState()` on every redraw (790). Also calls `refreshCombatStyleLocks` and `syncSettingsButtons`.
- `buyShopItem` (839-848), `buyShopPair` (850-868, manual refund of first purchase 858-859), `sellInventoryItem` (337-352, 65% price shown in text 350), `sellAllLoot` (870-879), `sellAllUnequippedGear` (881-890): commerce calls to `../state/inventory` with chat/SFX/`updateAllUI`; the "65%" sell-rate appears as literal text in 350, 877, 888.
- `sellPayoutLabel` (354-360): payout calculation (`unitSellPrice * n`) used only for menu labels.
- `craftRecipe` (901-912): calls `tryCraft`, then grants skill XP.
- `claimQuestReward` (953-965), `requestSlayerTask` (967-981): quest/slayer state calls plus chat, banner, SFX.
- `loadGameState` (1009-1048): save migration rules (clears starter gear ids `hylian_*`, `leather_*`, 1021-1026) and camera clamps (`pitch <= 0.42`, `distance <= 9.5`, 1041-1042) in the same function that applies state; `saveGameState` (983-1007) serializes `player.pos`/`camState` and then writes a button label with the time (998-1005).
- `getTerrainHeight` (1119-1137) and `rawHills` (1139-1147): terrain shape and river geometry (river centre `28 + sin(z*0.05)*8`, half width 6.8) and flat zones around `WORLD_REGIONS` (radius 16 flat, 28 blend). Used by mesh builders in range and by movement/spawn code past 3100. `isDeepWater` (imported from `../state/collision`) is used in `buildTerrainAndWater` (1490) as a grass placement filter.
- `getBiomeColor` (1149-1160): hard-coded biome boundaries by coordinates (e.g. `x > 40 && z > 36` sand, `x < -40 && z > 36` crag/lava, `x < -40 && z < 0` canopy, road line at 1153, plaza at 1154). `buildTerrainAndWater` also hard-codes biome exclusion rectangles for grass (1490).
- `cycleTimeOfDay` (1374-1399): sets `STATE.timeOfDay` (state), shader colours, fog, and the button label together.
- `buildAllCitiesAndLandmarks` (1670-1754): world layout coordinates for shrines, castle, props, altars, forges, merchants, bank, slayer master. Shrine `userData` carries `action: 'worldmap'` (1699), altar `action: 'altar'` (1842), forge `'forge'` (1898), bank `'bank'` (1947), slayer `'slayer'` (2003), merchant `'shop'` (2022), guard `'dialogue'` with dialogue text (2076-2082) and `interactRadius` values (4.0 to 4.2, 3.5). These `userData.action` values are read past 3100 (for example `onGameContextMenu` 3945-3948 and the `gameLoop` interact branch at 5495).
- `createPrayerAltar` (1818), `createForgeStation` (1859), `createBankBooth` (1915): each pushes into `npcList` with a label colour and `yOffset` (1849, 1905, 1955); name strings such as `'Lumbridge Bank'` (1947, 1955) are the display name and interaction name.
- `createSlayerMaster` (1971-2016): visual gear choice (`ITEMS.godsword || ITEMS.rune_2h` fallback, 1980) inside the world builder.
- `createMerchantNPC` (2018-2046): hat choice depends on the merchant's name substring (`'Varrock'`, `'Al-Kharid'`, 2033-2037).
- `createBankBooth` (1915-1969): builds a canvas 2D texture for the "BANK" sign using `document.createElement('canvas')` (1928-1938).
- `rebuildPlayerEquipmentMeshes` (2210-2516): reads `STATE.equipment` directly (2239, 2253, 2266, 2278, `equip()` 2301); hard-codes per-item material rules by item id (`champion_tunic` 2242-2243, `hylian_trousers` 2256-2257, `leather_boots` 2269, `leather_gloves` 2281, 2285-2286); hides hair/coat/boot/bracer parts based on equipped items (2344-2356, 2373-2386, 2442-2455, 2471-2479); calls `getEquipmentBonuses()` to draw the set-bonus ring (2494-2510).
- `getItemReqInfo` and `updateAllUI` embed colours and inline `style` strings for requirement and set-bonus text (181, 197, 734-746).
- `createMonsterMesh`-fed builders (W) take `def.scale`, `def.bodyColor`, `def.accentColor` from monster definitions (2612-2614, 2649, 2820, 2951, 3027, 3092), and `buildGoblinMesh` branches on `role === 'archer'` (2722). Hitbox sizes (`monsterHitbox` args) are set in each builder (2644, 2747, 2814, 2888, 2945, 3021, 3085) and `monsterHitbox` sets `userData.isCollider = true` (2542); the flag is also set at 3525 and never read anywhere in the file. Hitbox size is a gameplay-facing value defined in the mesh code.
