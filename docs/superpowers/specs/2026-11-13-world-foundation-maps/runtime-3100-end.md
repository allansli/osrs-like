# runtime.ts lines 3100-6253 map

Source: `src/engine/runtime.ts` (6253 lines). Range starts mid-function (end of `buildLesserDemon`, which starts at 3090) and ends at the `DOMContentLoaded` handler. All line numbers refer to that file. No behaviour notes beyond what the code shows.

## 1. Contiguous sections

| Lines | Section | What it does | Functions defined |
|---|---|---|---|
| 3100-3192 | tail of `buildLesserDemon` (starts 3090) | Builds demon head, horns, wings, tail, arms, hoof legs; returns `finishMonster(...)` rig | (inner) `arm` 3153, `hoofLeg` 3175 |
| 3194-3283 | Elvarg dragon mesh | Procedural dragon mesh from primitives | `buildElvargMesh` 3194 (inner `spikesAlong` 3216, `dragonLeg` 3260) |
| 3285-3300 | Monster mesh factory | switch on typeKey to builder (builders for chicken..lesser_demon are defined before 3100) | `createMonsterMesh` 3285 |
| 3302-3375 | Monster limb animation | Flinch, attack, walk, idle poses; reads/writes monster state (`flinch`, `attackAnim`) | `poseMonsterLimbs` 3302 |
| 3377-3426 | Monster spawn | Creates mesh, DOM label in `#world-labels`, entity object, pushes to `worldInteractiveObjects` and `monstersList`, async GLTF upgrade | `spawnMonster` 3377 |
| 3428-3551 | Resource node spawn | Builds tree/rock/fish-ring meshes, hitbox, entity object, pushes to `worldInteractiveObjects`/`resourceNodesList`/`swayingFoliage`, async GLTF upgrade | `spawnResourceNode` 3429 |
| 3553-3590 | World population table | Hard-coded coordinates for monsters and nodes per region (Lumbridge, Varrock, Al-Kharid, Korok, Dragon's Peak) | `spawnAllResourcesAndMonsters` 3553 |
| 3592-3700 | Atmospheric motes | Point-sprite particles, colour by `STATE.currentRegion` | `createSoftMoteTexture` 3594, `buildAtmosphericParticles` 3614, `updateAtmosphericParticles` 3658 |
| 3703-3713 | Section 9 header + input state | Module vars for input (see part 2) | - |
| 3715-3829 | Input handler wiring | Creates click marker and hover tile meshes; registers keydown/keyup/mousedown/mousemove/mouseup/wheel/minimap click listeners | `setupInputHandlers` 3715 |
| 3831-3835 | Camera reset | Sets camState offset/pitch/distance | `resetCameraBehindPlayer` 3831 |
| 3837-3848 | Click marker | Positions and recolours marker | `showClickMarker` 3837 |
| 3850-3892 | Hover tooltip | Raycast, builds tooltip HTML, sets cursor | `handleWorldHover` 3850 |
| 3894-3900 | Context menu hide | Closes `#context-menu` | `hideContextMenu` 3894 |
| 3902-3910 | Pointer picking | Raycast entities and terrain | `pointerToWorld` 3902 |
| 3912-3987 | Right-click menu builder | Builds options (Attack/Gather/Use/Examine/Walk here/Cancel) with `run` closures that set player targets | `onGameContextMenu` 3912 |
| 3989-4012 | Menu renderer | Writes option rows into `#context-menu-list` | `openChooseMenu` 3989 |
| 4014-4058 | Left-click handler | Raycast, sets `player.targetPos` / `player.targetEntity` | `handleWorldClick` 4014 |
| 4060-4080 | Target HUD | Writes `#target-hud` fields | `updateTargetHud` 4060 |
| 4082-4095 | Teleport | Moves player to region, effects, chat, banner | `teleportToRegion` 4082 |
| 4097-4122 | Region detection and banner | Distance check against `WORLD_REGIONS`, sets `STATE.currentRegion`, footer text, banner timer | `checkRegionChange` 4098, `triggerRegionBanner` 4113 |
| 4124-4142 | Hit splats | DOM splat elements in `#world-labels` | `spawnHitSplatWorld` 4127, `spawnHitSplatOnPlayer` 4140 |
| 4144-4233 | VFX primitives | Glow material, vfx list push, projectile launch, orb projectile, burst, ring, slash arc | `glowMaterial` 4144, `spawnVfx` 4154, `launchProjectile` 4159, `spawnProjectile` 4178, `spawnBurst` 4186, `spawnExpandingRing` 4201, `spawnSlashArc` 4218 |
| 4235-4370 | Melee slash VFX | Per-weapon-id effect selection | `metalSlashTint` 4235, `spawnMeleeSlashEffect` 4246 |
| 4372-4574 | Spell VFX | Spell impact, runic circle, per-spell projectile | `spawnSpellImpact` 4372, `spawnRunicCircle` 4472, `spawnSpellProjectile` 4505 |
| 4576-4721 | Other projectile/VFX | Arrow, piercing beam, rare loot beam, dragonfire, shadow bolt, hellfire orb | `spawnArrowProjectile` 4576, `spawnPiercingBeam` 4618, `spawnRareLootBeam` 4635, `spawnDragonfireEffect` 4663, `spawnShadowBolt` 4681, `spawnHellfireOrb` 4701 |
| 4723-4745 | Level-up fireworks | Self-driven rAF particle loop (not in `vfxList`) | `spawnLevelUpFireworks` 4723 |
| 4747-4917 | Player attack | Damage/accuracy calc, special attack, animation choice, SFX, XP, heal, death trigger, VFX dispatch | `performPlayerAttack` 4747 (inner `applyDamage` 4842), `wpKindIsChop` 4915 |
| 4919-4962 | Monster death | Sets death flags, kill registration, slayer messages, loot rolls, rare beam | `handleMonsterDeath` 4919 |
| 4964-5029 | Monster retaliation | Hit chance, dragonfire, mitigation, per-type projectile dispatch | `performMonsterRetaliation` 4964 (inner `applyHit` 4991) |
| 5031-5070 | Player death/respawn | Sets downed state, death overlay DOM, respawn teleport | `handlePlayerDeath` 5031, `finishRespawn` 5054 |
| 5072-5117 | Resource gather | Level/space check, animation/SFX, success roll, XP, depletion | `performResourceGather` 5072 |
| 5119-5202 | Minimap | 2D canvas draw of regions, river, nodes, NPCs, monsters | `renderMinimap` 5122 |
| 5204-5215 | World-to-screen | Projects using `_tmpScratchVec` and `camera` | `worldToScreenPos` 5204, `worldToScreen` 5213 |
| 5217-5256 | Landmark labels | Constant list and DOM label updater | `LANDMARKS` 5217, `updateLandmarkLabels` 5226 |
| 5258-5357 | Floating labels | Player prayer overhead badge, monster labels/HP bars, NPC labels | `updateFloatingWorldLabels` 5258 |
| 5359-5369 | Loop helper | Angle lerp | `lerpAngle` 5364 |
| 5371-5980 | Main loop | See breakdown below | `gameLoop` 5371 (inner `updateCapePhysics` 5592) |
| 5982-5989 | Loop timers + unload save | Timer vars and `beforeunload` listener | - |
| 5991-6004 | HUD sync after load | Style buttons, XP button, time-of-day | `applyLoadedStateToHud` 5991 |
| 6006-6011 | Resize | Camera aspect, renderer size, DPR | `onWindowResize` 6006 |
| 6014-6024 | Combat style lock UI | Toggles classes on `#style-*` | `refreshCombatStyleLocks` 6014 |
| 6026-6048 | Modal openers, audio | `openBankModal` 6026, `openQuestsModal` 6032, `openSettingsModal` 6037, `toggleAudio` 6043 |
| 6050-6068 | Item tooltip | `showItemTooltip` 6050, `moveItemTooltip` 6058, `hideItemTooltip` 6065 |
| 6070-6085 | Hover tile | `updateHoverTile` 6070 |
| 6087-6128 | Cheats | `cheatBuffer` 6087, `noteCheatKey` 6089, `cheatSkillsPlus10` 6101, `cheatGold200k` 6111, `applyTypedCheat` 6120 |
| 6130-6198 | Bridge/window wiring | Assigns `bridge.*` callbacks, ~45 `window.*` globals, `window.__DEV_ACCESS__` | `wireBridge` 6130 |
| 6200-6219 | Onboarding | `INTRO_KEY` 6200 (localStorage), `dismissOnboarding` 6202, `replayOnboarding` 6208, `maybeShowOnboarding` 6214 |
| 6221-6253 | Bootstrap | `DOMContentLoaded` handler: wireBridge, initStaticSvgIcons, loadGameState, init3DEngine, applyLoadedStateToHud, updateAllUI, maybeShowOnboarding, chat messages, cheat input, region banner, `window.__DEBUG`, starts rAF `gameLoop` | anonymous callback |

### `gameLoop` breakdown (5371-5980)

| Lines | Block |
|---|---|
| 5372-5375 | rAF re-arm, dt clamp 0.08, elapsed |
| 5377-5395 | Downed countdown / `finishRespawn`; else set-bonus ring VFX using `setBonusTimer` |
| 5397-5399 | water/sky uniform time, sky dome follows player |
| 5401-5416 | Spec energy regen, HP regen, prayer drain and deactivation |
| 5418-5540 | Input to movement intent: Q/E camera, A/D turn, W/S forward, target-entity approach and in-range actions (interactive: shop/bank/forge/worldmap/slayer/dialogue/altar; monster: `performPlayerAttack`; resource: `performResourceGather`), click-to-move |
| 5542-5570 | Momentum, `moveWithCollision`, action cooldown, jump/terrain follow |
| 5572-5588 | Mesh yaw, bank roll |
| 5590-5643 | `updateCapePhysics` closure (includes random ember `spawnBurst` for lava cape) |
| 5645-5729 | Player animation: Blender animator branch, else procedural limbs and attack swing |
| 5730-5739 | `npcAnimatorsList` update, whip rig sync |
| 5741-5748 | Spin attack ring |
| 5750-5757 | Click marker fade |
| 5759-5785 | Chase camera, shake, sun light follow |
| 5787-5878 | Monster update: dying, respawn, wing flap, chase/attack/wander |
| 5880-5889 | Resource respawn |
| 5891-5913 | Projectile advance, impact callbacks |
| 5915-5923 | VFX tick |
| 5925-5927 | Foliage sway |
| 5929-5932 | Autosave every 2000 ms |
| 5934-5950 | `checkRegionChange`, label tick, shrine discovery (writes `STATE.shrines`) |
| 5951-5952 | Compass rotate |
| 5954-5957 | Minimap redraw |
| 5958-5962 | Tick arc DOM, grass uTime |
| 5963 | `renderer.render` |
| 5965-5979 | FPS counter, perf DOM |

## 2. Module-level mutable state declared in range

| Name | Line | Holds | Uses (line numbers in whole file) |
|---|---|---|---|
| `atmosphericMotes` | 3592 | Object `{points, positions, colors, phases, speeds, count}` or null | W 3647 in `buildAtmosphericParticles`; R 3659-3678 in `updateAtmosphericParticles`. Neither function is called anywhere in the file (only defined 3614, 3658). |
| `keysPressed` | 3706 | Map of `KeyboardEvent.code` to bool | W 3734, 3758 (`setupInputHandlers` listeners); R 5422-5439 (`gameLoop`) |
| `raycaster` | 3707 | `THREE.Raycaster` | 3863-3864 (`handleWorldHover`), 3905-3906 (`pointerToWorld`), 4017-4019 (`handleWorldClick`), 6074-6075 (`updateHoverTile`) |
| `mouseVec` | 3708 | `THREE.Vector2` scratch | same functions as `raycaster`: 3861-3863, 3903-3905, 4015-4017, 6072-6074 |
| `hoveredWorld` | 3709 | userData of hovered entity or null | W 3854, 3879, 3889 (`handleWorldHover`); R 5292, 5337 (`updateFloatingWorldLabels`) |
| `clickMarkerMesh` | 3710 | `THREE.Group` marker or null | W 3716 (`setupInputHandlers`); R/W 3838-3842 (`showClickMarker`), 5750-5754 (`gameLoop`) |
| `hoverTile` | 3711 | Hover tile mesh or null | W 3725-3731 (`setupInputHandlers`); R/W 3856 (`handleWorldHover`), 6071-6084 (`updateHoverTile`) |
| `rightPress` | 3712 | `{x,y,dist}` right-drag tracker | W 3778-3780, 3795 (listeners); R 3914 (`onGameContextMenu`) |
| `contextTarget` | 3713 | Last context menu pick `{ud, ground, point}` or null | W 3899 (`hideContextMenu`), 3919 (`onGameContextMenu`). Never read. |
| `lastBannerRegion` | 4097 | Region id last shown in banner | R/W 4114-4115 (`triggerRegionBanner`) |
| `bannerTimer` | 4112 | `setTimeout` handle | R/W 4120-4121 (`triggerRegionBanner`) |
| `LANDMARKS` | 5217 | const array of landmark records | R 5230, 5238 (`updateLandmarkLabels`) |
| `landmarkEls` | 5224 | Lazily created DOM elements | R/W 5229-5239 (`updateLandmarkLabels`) |
| `playerOverheadEl` | 5225 | Lazily created DOM div | R/W 5263-5286 (`updateFloatingWorldLabels`) |
| `lastFrameTime` | 5362 | rAF timestamp | R/W 5373-5374 (`gameLoop`) |
| `setBonusTimer` | 5982 | Seconds accumulator for set-bonus rings | R/W 5383-5387 (`gameLoop`); declared after `gameLoop` text |
| `lastAutoSaveTime` | 5983 | ms of last autosave | R/W 5929-5930 (`gameLoop`) |
| `labelTick` | 5984 | Label update accumulator | R/W 5935-5938 (`gameLoop`) |
| `miniTick` | 5985 | Minimap accumulator | R/W 5936, 5954-5955 (`gameLoop`) |
| `lastLabelX` | 5986 | Player x at last label update | R/W 5937, 5939, 5954 (`gameLoop`) |
| `lastLabelZ` | 5987 | Player z at last label update | R/W 5937, 5940, 5954 (`gameLoop`) |
| `lastMiniYaw` | 5988 | const-like number 999 | Declared only; no other reference in the file |
| `cheatBuffer` | 6087 | Last 16 typed chars | R/W 6093-6096 (`noteCheatKey`) |
| `INTRO_KEY` | 6200 | localStorage key string | R 6205, 6216 |

### State declared before 3100 and used in range (shared, not owned by range)

| Name | Declared | Used in range by |
|---|---|---|
| `scene`, `camera`, `renderer`, `sunLight`, `ambientLight`, `hemiLight` | 1069 | `scene` in spawn*/VFX/setup; `camera` in hover/click/projection/loop/resize; `renderer` in input setup/loop/resize; `sunLight` loop 5783-5785 |
| `terrainMesh`, `waterMesh`, `skyDomeMesh`, `grassInstanced` | 1070 | `terrainMesh` 3908, 6071-6075; `skyDomeMesh` 5399; `grassInstanced` 5960-5962 |
| `waterUniforms`, `skyUniforms` | 1071 | 5397-5398 |
| `worldInteractiveObjects` | 1072 | W 3419, 3544; R 3864, 3906, 4019 |
| `monstersList` | 1073 | W 3421; R 5039, 5182, 5290, 5788 |
| `resourceNodesList` | 1074 | W 3546; R 5163, 5880 |
| `npcList` | 1075 | R 5172, 5329 |
| `projectilesList` | 1076 | W 4164; R/W 5891-5913 |
| `vfxList` | 1077 | W 4156; R/W 5915-5923 |
| `swayingFoliage` | 1079 | W 3512; R 5925 |
| `player` | 1081 | Throughout (targeting, combat, loop, labels, minimap) |
| `camState` | 1107 | Input drag, reset, teleport, respawn, loop camera, minimap, compass |
| `_tmpScratchVec`, `_camTargetVec`, `_lookTargetVec` | 1162-1164 | `worldToScreenPos` 5205; loop 5770-5774 |
| `currentQuality` | 1167 | 6010 |
| `telemetryInfo`, `frameCounter`, `lastFpsTime` | 1230, 1237, 1238 | 5965-5972 (`gameLoop`) |
| `npcAnimatorsList` | 2141 | 5730-5731 |
| `STATE` (import) | - | Throughout |

## 3. Call dependencies

### Calls from range into code before 3100 (line of definition)

- Monster build helpers: `monsterPart` 2522, `monsterPivot` 2530, `monsterHitbox` 2536, `finishMonster` 2546, `glowEye` 2552, `paint` 2563; builders `buildChickenMesh` 2610, `buildGoblinMesh` 2647, `buildScorpionMesh` 2752, `buildDarkWizard` 2819, `buildDarkRanger` 2893, `buildHillGiant` 2950, `buildMossGuardian` 3026, `buildLesserDemon` 3090 (called by `createMonsterMesh`).
- World: `getTerrainHeight` 1119, `getQualityDpr` 1170, `syncGraphicsButtons` 1223, `cycleTimeOfDay` 1374, `init3DEngine` 1275, `rebuildPlayerEquipmentMeshes` 2210 (via `__DEV_ACCESS__`/`__DEBUG`), `syncWhipGeometry` 2189.
- UI/state: `addChatMessage` 161, `initStaticSvgIcons` 146, `getCombatLevel` 172, `getEquipmentBonuses` 202, `grantXp` 265, `showBanner` 308, `addItemToInventory` 320, `showSellChooseMenu` 362, `switchTab` 470, `toggleSpecialAttack` 498, `toggleXpMultiplier` 564, `updateAllUI` 575, `closeModals` 808, `hideHoverTooltip` 815, `openModal` 821, `openShopModal` 829, `sellAllLoot` 870, `sellAllUnequippedGear` 881, `openSmithingModal` 892, `openWorldMapModal` 943, `locateQuestRegion` 948, `claimQuestReward` 953, `requestSlayerTask` 967, `saveGameState` 983, `loadGameState` 1009, `manualSaveToast` 1050, `resetGameSave` 1056.
- `bridge.*` assignments (6131-6151) bind to: `addChatMessage`, `updateAllUI`, `closeModals`, `SFX.coin`, `manualSaveToast`, `resetGameSave`, `cycleTimeOfDay`, `toggleXpMultiplier`, `toggleAudio`, `teleportToRegion`, `claimQuestReward`, `locateQuestRegion`, `requestSlayerTask`, `showSellChooseMenu`, `sellAllLoot`, `sellAllUnequippedGear`, `showItemTooltip`, `moveItemTooltip`, `hideItemTooltip`.
- `window.*` assignments (6152-6185) bind to functions defined before 3100: `setCombatStyle` 479, `switchTab` 470, `craftRecipe` 901, `openWorldMapModal` 943, `openShopModal` 829, `openSmithingModal` 892, `openXpTableModal` 914, `cycleGraphicsQuality` 1203, `toggleOutlines` 1210, `toggleXpMultiplier` 564, `cycleTimeOfDay` 1374, `resetGameSave` 1056, `manualSaveToast` 1050, `sellInventoryItem` 337, `buyShopItem` 839, `buyShopPair` 850, `sellAllLoot` 870, `sellAllUnequippedGear` 881, `unequipSlot` 456, `toggleSpecialAttack` 498, `togglePrayer` 508, `handleSpellClick` 532; and to range functions `teleportToRegion`, `resetCameraBehindPlayer`, `dismissOnboarding`, `replayOnboarding`, `openBankModal`, `openQuestsModal`, `openSettingsModal`, `toggleAudio`, `cheat*`, `applyTypedCheat`.
- `SFX.*` (92): bow, chop, coin, crossbow, crush, fish, heavyChop, hit, jump, levelUp, magic, mine, miss, prayer, slash, whipCrack.
- Constant `TICK_SEC` 86 (5517-5521, 5959).

### Calls from before 3100 into range

| Caller line | Callee |
|---|---|
| 288 | `spawnLevelUpFireworks` (guarded by `typeof ... === 'function'`) |
| 378 | `openChooseMenu` |
| 409 | `spawnHitSplatOnPlayer` (guarded by `typeof`) |
| 490, 494, 791 | `refreshCombatStyleLocks` |
| 557 | `teleportToRegion` |
| 663-665 | `showItemTooltip`, `moveItemTooltip`, `hideItemTooltip` |
| 811, 812 | `hideItemTooltip`, `hideContextMenu` (in `closeModals`) |
| 963 | `spawnLevelUpFireworks` |
| 1328 | `spawnAllResourcesAndMonsters` (in `init3DEngine`) |
| 1331 | `onWindowResize` |
| 1332 | `setupInputHandlers` |

`buildAtmosphericParticles` and `updateAtmosphericParticles` have no callers anywhere.

### Calls within range (caller -> callees)

- `createMonsterMesh` -> `buildElvargMesh` (3296), `buildLesserDemon` (3295, defined before range), others before range.
- `spawnMonster` -> `createMonsterMesh`, `offsetAlbedoPhase`, `getTerrainHeight`, `loadBlenderMonstersTemplate`/`upgradeMonsterRigWithGltf`.
- `spawnResourceNode` -> `albedoMaterial`, `biomeGroundId`, `biomeAlbedoId`, `facetMaterial`, `sealAlbedoUvs`, `addCartoonOutline`, `loadBlenderWorldTemplate`/`upgradeResourceNodeWithGltf`.
- `spawnAllResourcesAndMonsters` -> `spawnMonster`, `spawnResourceNode`.
- `setupInputHandlers` -> `noteCheatKey`, `toggleSpecialAttack`, `closeModals`, `switchTab`, `hideContextMenu`, `handleWorldClick`, `handleWorldHover`, `isWalkable`, `addChatMessage`, `showClickMarker`, `getTerrainHeight`, `SFX.jump`; registers `onGameContextMenu`.
- `handleWorldHover` -> `hideHoverTooltip`, `updateHoverTile`.
- `onGameContextMenu` -> `pointerToWorld`, `monsterThreatColor`, `attackOptionLabel`, `gatherVerb`, `getCombatLevel`, `showClickMarker`, `updateTargetHud`, `isWalkable`, `addChatMessage`, `openChooseMenu`.
- `handleWorldClick` -> `isWalkable`, `addChatMessage`, `showClickMarker`, `updateTargetHud`.
- `teleportToRegion` -> `SFX.magic`, `spawnLevelUpFireworks`, `addChatMessage`, `triggerRegionBanner`.
- `checkRegionChange` -> `triggerRegionBanner`.
- `spawnHitSplatWorld` -> `worldToScreen`; `spawnHitSplatOnPlayer` -> `spawnHitSplatWorld`; `worldToScreen` -> `worldToScreenPos`.
- VFX/projectile builders -> `spawnVfx`, `launchProjectile`, `glowMaterial`, `spawnBurst`, `spawnExpandingRing`, `spawnSlashArc`; `spawnMeleeSlashEffect` -> `metalSlashTint`; `spawnSpellProjectile` -> `spawnRunicCircle`, `spawnSpellImpact`; `spawnProjectile` -> `launchProjectile`; `spawnDragonfireEffect` -> `launchProjectile`, `spawnExpandingRing`, `spawnBurst`.
- `performPlayerAttack` -> `prepareAttack`, `removeItem`, `getEquipmentBonuses`, `dharokMultiplier`, `weaponSpecial`, `wpKindIsChop`, `hitSplatKind`, `spawnHitSplatWorld`, `spawnHitSplatOnPlayer`, `grantXp`, `handleMonsterDeath`, `updateTargetHud`, `updateAllUI`, `spawnPiercingBeam`, `spawnArrowProjectile`, `spawnSpellProjectile`, `spawnMeleeSlashEffect`, `addChatMessage`, SFX.
- `handleMonsterDeath` -> `spawnBurst`, `registerKill`, `showBanner`, `spawnLevelUpFireworks`, `isBossLoot`, `isRareLoot`, `addItem`, `spawnRareLootBeam`, `updateAllUI`.
- `performMonsterRetaliation` -> `getEquipmentBonuses`, `resolveDragonfire`, `mitigateDamage`, `spawnHitSplatOnPlayer`, `handlePlayerDeath`, `spawnDragonfireEffect`, `spawnShadowBolt`, `spawnArrowProjectile`, `spawnHellfireOrb`, `spawnExpandingRing`, `spawnBurst`, `spawnProjectile`, `updateAllUI`.
- `handlePlayerDeath` -> `deathNotice`, `updateAllUI`; `finishRespawn` -> `applyRespawn`, `triggerRegionBanner`, `deathNotice`, `addChatMessage`, `updateAllUI`.
- `performResourceGather` -> `canAddItem`, `addItemToInventory`, `noteGather`, `grantXp`, `addChatMessage`, `updateTargetHud`, SFX.
- `updateFloatingWorldLabels` -> `updateLandmarkLabels`, `worldToScreenPos`, `getPrayerSvg`, `monsterThreatColor`, `getCombatLevel`; `updateLandmarkLabels` -> `getTerrainHeight`, `worldToScreenPos`.
- `gameLoop` -> `finishRespawn`, `getEquipmentBonuses`, `spawnExpandingRing`, `lerpAngle`, `openShopModal`, `openBankModal`, `openSmithingModal`, `openWorldMapModal`, `openQuestsModal`, `spawnLevelUpFireworks`, `updateAllUI`, `performPlayerAttack`, `performResourceGather`, `moveWithCollision`, `getTerrainHeight`, `spawnBurst`, `syncWhipGeometry`, `poseMonsterLimbs`, `performMonsterRetaliation`, `checkRegionChange`, `updateFloatingWorldLabels`, `discoverShrines`, `renderMinimap`, `saveGameState`, `addChatMessage`.
- `poseMonsterLimbs` -> `getTerrainHeight`.
- `openBankModal` -> `openModal`, `renderBankModal`; `openQuestsModal` -> `openModal`, `renderQuests`; `openSettingsModal` -> `syncSettingsButtons`, `syncGraphicsButtons`, `openModal`; `toggleAudio` -> `syncSettingsButtons`, `addChatMessage`, `saveGameState`.
- `applyLoadedStateToHud` -> `cycleTimeOfDay` (after setting `STATE.timeOfDay` to `(saved+2)%3`).
- `noteCheatKey` -> `matchCheat`, `cheatSkillsPlus10`, `cheatGold200k`; cheats -> `applySkillsPlus10`/`applyGold200k`, SFX, `spawnLevelUpFireworks`, `showBanner`, `addChatMessage`, `updateAllUI`, `saveGameState`.
- `DOMContentLoaded` -> `wireBridge`, `initStaticSvgIcons`, `loadGameState`, `init3DEngine`, `applyLoadedStateToHud`, `updateAllUI`, `maybeShowOnboarding`, `addChatMessage`, `applyTypedCheat`, `triggerRegionBanner`, `gameLoop`.
- `showItemTooltip` -> `itemCompareHtml`, `moveItemTooltip`.
- `refreshCombatStyleLocks` -> `equippedWeapon`, `allowedStyles`.

## 4. Imports used in range

Import block is lines 2-84. Used by the range:

| Module | Names used in range |
|---|---|
| `three` | `THREE` (everywhere) |
| `../data/items` | `ITEMS` |
| `../data/skills` | `SKILLS_META` (3874, 4076, 5077) |
| `../data/magic` | `PRAYERS` (5269, 5409), `SPELLS` (4770, 4878, 4903) |
| `../data/world` | `WORLD_REGIONS`, `MONSTER_TYPES`, `RESOURCE_NODES_DEF` |
| `../state/gameState` | `STATE` |
| `../state/inventory` | `addItem`, `removeItem`, `canAddItem` |
| `../state/combat` | `prepareAttack`, `allowedStyles`, `mitigateDamage`, `equippedWeapon` |
| `../state/adventure` | `applyRespawn`, `attackOptionLabel`, `deathNotice`, `dharokMultiplier`, `gatherVerb`, `isBossLoot`, `hitSplatKind`, `isRareLoot`, `monsterThreatColor`, `noteGather`, `registerKill`, `RESPAWN_SECONDS`, `resolveDragonfire`, `weaponSpecial` |
| `../state/collision` | `moveWithCollision`, `isWalkable` |
| `../state/shrines` | `discoverShrines` |
| `../state/cheats` | `applyGold200k`, `applySkillsPlus10`, `matchCheat` |
| `./materials` | `addCartoonOutline`, `facetMaterial` |
| `./textures` | `albedoMaterial`, `biomeAlbedoId`, `biomeGroundId`, `offsetAlbedoPhase`, `sealAlbedoUvs` |
| `./blenderGear` | `loadBlenderGearTemplate` (6194, in `__DEV_ACCESS__`) |
| `./blenderMonsters` | `loadBlenderMonstersTemplate`, `upgradeMonsterRigWithGltf` |
| `./blenderWorld` | `loadBlenderWorldTemplate`, `upgradeResourceNodeWithGltf` |
| `../ui/icons` | `getPrayerSvg` (5280) |
| `../ui/bridge` | `bridge` (6131-6151) |
| `../ui/stations` | `renderBankModal`, `renderQuests`, `syncSettingsButtons`, `itemCompareHtml` |

Not imported but used: `localStorage`, `document`, `window`, `performance`, `requestAnimationFrame`, `setTimeout`, `clearTimeout`. `buildLesserDemon` (3090-3192) uses the rig helpers before the range.

## 5. Game rules mixed into rendering or DOM code

- `performPlayerAttack` 4747-4913: max-hit and accuracy formulas (4759-4779), prayer multipliers, special-attack energy checks (4789-4807), hit roll (4837-4840), HP healing (4856-4865), XP grants by style (4867-4880), inside the same function as animation selection (4802-4834), SFX and VFX dispatch (4893-4912), and DOM refresh calls (4889-4890).
- `performMonsterRetaliation` 4964-5029: hit chance, dragonfire 1-in-3 cadence (4975), damage, mitigation, HP subtraction (4996) in the `applyHit` closure that also spawns hit splat DOM and is passed as a projectile impact callback.
- `handleMonsterDeath` 4919-4962: loot rolls (4944), GP and item grants (4947-4955), slayer progress, kill registration, mixed with `spawnBurst`, `spawnRareLootBeam`, chat and banner DOM.
- `performResourceGather` 5072-5117: level requirement, backpack check, success formula `0.50 + (lvl-req)*0.02` (5101), XP, depletion flags with `respawnTimer` (5110), toggles `visualMesh`/`depletedMesh` visibility (5111-5112).
- `handlePlayerDeath` 5031-5052 and `finishRespawn` 5054-5070: clear prayers, `STATE.hp = 0` (5037-5038), respawn countdown, `#death-overlay` DOM, respawn teleport to Lumbridge region.
- `gameLoop` 5371-5980 mixes in:
  - Prayer drain and deactivation (5407-5416), spec energy regen (5401-5403), HP regen (5404-5406).
  - Set-bonus ring VFX tied to `getEquipmentBonuses().matchedSet` (5382-5394).
  - Interactive-target actions: altar restores `STATE.prayerPts` and `STATE.hp` (5507-5514), shop/bank/forge/worldmap/slayer modal openers, dialogue chat (5494-5514).
  - Combat range by combat style (13.5 vs 2.9, 5466), action cooldown `TICK_SEC` (5517-5521).
  - Monster AI: aggro drop distance 26 (5830), chase speed 5.2, attack range 11.0 / 2.9 (5835), attack cooldown 1.65 (5845-5847), wander radius and timers (5852-5857), respawn restore of `hp`, `breathCount`, `flinch` (5802-5816), death timers (5789-5799).
  - Resource respawn countdown (5880-5889).
  - Shrine discovery writes `STATE.shrines` and posts chat (5942-5949).
  - Autosave timer calling `saveGameState` (5929-5932).
  - Region change detection (5934) and `STATE.currentRegion` write.
- `checkRegionChange` 4098-4110: sets `STATE.currentRegion` and `#current-zone-footer` text.
- `spawnMonster` 3377-3426: entity fields `hp`, `maxHp`, `attackCooldown`, `respawnTimer`, `wanderTimer`, `breathCount`, `inCombatWithPlayer` created alongside meshes and `#world-labels` DOM label; interact radius by `def.style` (3416).
- `spawnResourceNode` 3429-3551: entity fields `depleted`, `respawnTimer`; `y = -0.30` for fish (3433); per-node foliage colours keyed by `nodeKey` (3449-3456).
- `poseMonsterLimbs` 3302-3375: mutates game state (`m.flinch`, `m.attackAnim` decrements at 3310, 3323) and branches on `typeKey`.
- `spawnAllResourcesAndMonsters` 3553-3590: game-world content table (positions per type) in the same file as rendering.
- `updateAtmosphericParticles` 3658-3700: reads `STATE.currentRegion` ids `'crandor'`, `'draynor'`, `'wilderness'` for colours (not called).
- Input/click handlers (`handleWorldClick` 4014, `onGameContextMenu` 3912, minimap click 3812-3828): set `player.targetEntity`/`targetPos`, check `isWalkable`, post chat; context menu labels depend on `ud.action` (3944-3948).
- `handleWorldHover` 3850-3892: tooltip HTML embeds monster HP, level, skill requirement from game data.
- `updateTargetHud` 4060-4080: reads `m.hp`, `r.def.req`, `SKILLS_META` and writes DOM.
- `renderMinimap` 5122-5202: reads `WORLD_REGIONS`, `resourceNodesList`, `npcList`, `monstersList` state (`depleted`, `dead`); hardcoded river path formula `28 + sin(z*0.05)*8` (5154).
- `updateFloatingWorldLabels` 5258-5357: reads `STATE.activePrayers` and `PRAYERS` (5268-5271), monster HP and combat state, threat colour from combat level, writes DOM styles.
- `teleportToRegion` 4082-4095 and `applyLoadedStateToHud` 5991-6004: mutate player position or `STATE.timeOfDay` and touch DOM.
- Cheats 6087-6128: apply state changes (`applySkillsPlus10`, `applyGold200k`) with SFX, VFX, banner, chat, save.
- `toggleAudio` 6043-6048: flips `STATE.audioEnabled` and saves.
- `openBankModal` 6026-6030: sets `STATE.quests.openedBank = true`.
- `wireBridge` 6141: `bridge.noteBank` sets `STATE.quests.openedBank`.
- `spawnHitSplatWorld` 4127-4138 and `spawnLevelUpFireworks` 4723-4745: `spawnLevelUpFireworks` uses its own `requestAnimationFrame` loop with fixed 0.016 step per frame (4740), separate from `vfxList`.
