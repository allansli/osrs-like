# Painting a mesh in Blender

Gielinor Hero draws with Blendi's oil-paint renderer ([patch.gg/blendi/oil-paint](https://patch.gg/blendi/oil-paint), release 1.0.1). The painter owns the picture. A mesh does not keep its texture. It gets three mixes of colour and a direction for the stroke. Colour is paint: the hex you choose is the colour on the canvas, and nothing is tone-mapped.

The player is the oil-paint demo's wanderer (hat, cloak, and clips). Other meshes take their colour from `src/paint/palettes.ts`. A painted thing is a solid body first; dabs are the impasto on top of it.

## Custom Properties

On the object **or** its material, open **Object Properties → Custom Properties** (or the material's) and add:

| Property | Type | What to type |
|---|---|---|
| `paint_palette` | String | An id from the palette table. Spike ids: `meadow_grass`, `dirt_path`, `kai_skin`, `kai_hair`, `kai_tunic`, `goblin_hide`, `bronze`, `leather`. |
| `stroke_dir` | String | One of `up`, `along_bone`, `surface_flow`, `flat`. |
| `dab_size` | String | Metres, width × length. Example: `0.04x0.09`. |
| `jitter` | Float | How much each dab is mixed differently. `0.5` for cloth, skin, hide, and ground. `0.25` for metals. |
| `dab_density` | Integer | Optional. How many pins on this mesh. Leave it off to use the class budget. |

`stroke_dir`:

- `up` — trunks and grass. The stroke runs with local Y.
- `along_bone` — limbs, a cloak, a blade. Local Y, carried by the bone or the pivot.
- `surface_flow` — fur or scales. The stroke lies on the surface, following the body axis.
- `flat` — ground and laid stone. The dab lies on the face instead of turning toward the camera.

If a property is missing, the loader fills it in:

| Class | Size (m) | Stroke | Palette when the name does not say |
|---|---|---|---|
| hero, boss | 0.04 × 0.09 | `along_bone` | `kai_tunic` (hair → `kai_hair`, head and hands → `kai_skin`, boots and bracers → `leather`) |
| monster | 0.06 × 0.12 | `surface_flow` | `goblin_hide` (a blade on the same mesh → `bronze`) |
| gear | 0.03 × 0.07 | `along_bone` | `bronze`, jitter 0.25 |
| prop | 0.08 × 0.16 | `flat` | `varrock_stone` |
| tree | 0.12 × 0.30 | `up` | `pine_bark` |

An object property wins over the same property on the material. An unknown palette id or an unknown stroke is ignored and the default is used.

Shade mixes are dark colour, never black. The locked shade stops are meadow `#3F5A33`, path `#4E3A2C`, skin `#7A4E3E`, hair `#1E1210`, tunic `#26354A`, goblin `#33421F`, bronze `#5A3A22`, leather `#3A2618`. Other biomes and metal tiers are marked `placeholder: true` in `src/paint/palettes.ts` for Design to replace.

## Export

`scripts/blender/build_hero.py`, `build_monsters.py`, `build_gear.py`, and `build_world.py` call `scripts/blender/oil_paint_props.py` before `export_scene.gltf`. That helper writes the properties above when they are not already set, and the export already passes `export_extras=True`, so they arrive as glTF extras and three.js `userData`.

`npm run blender:export` re-exports `hero.blend` the same way, and will not overwrite a property you typed in the panel.

You do not need to re-export to see the spike. The current hero, the first goblin, and the equipped bronze scimitar already fall through to these defaults.

## See it

```bash
npm install
npm run dev
```

Open the dev server. You start in Lumbridge. The ground is oil paint (meadow, the dirt path, and the river as opaque paint). The wanderer wears the demo's hat and blue cloak, and the bronze scimitar sits in his right hand. Goblins, chickens, trees, rocks, and the Lumbridge buildings are solid paint plus dabs.

The HUD, names, hover tooltip, and the click X are drawn after the canvas, so they stay sharp.

- `?quality=low` turns off the sun in the mist and the grass tufts, and caps the pixel ratio at 1.
- `?renderer=legacy` is the old cel picture.
- Frame time is the `N FPS (Xms)` line in the top-left perf readout, plus `paint Yms` for the painter itself. After a couple of seconds the console logs one line: `[oil-paint] … ms/frame … on <gpu>`.

Change a Custom Property, export the GLB, and reload. `tests/paint-contract.test.ts` loads a fixture and a tiny glTF to prove an extra changes palette and stroke without opening Blender.

## What this spike does not do

The wood demo's 78 m leash is not in the game. Walking is still our collision.

Oil paint is WebGL2, everything opaque, and it ignores model textures. The River Lum is an opaque `river_opaque` band (a placeholder), not transparent water. Glass, the spin-slash ring, and projectiles are not dabs.

The still-world shadow is the author's sun camera, a wide picture centred near the origin, so Lumbridge is in it. It is drawn once from the terrain, so a building that is not painted does not cast a shadow of an invisible mesh. A moving shadow is one small picture around the wanderer. The goblin glazes the ground when it stands in that picture. The glaze inside the vendored dab shader is the author's; the palette shade stops are ours and are never black.

Buildings, trees, and the other monsters are still in the scene for clicks and combat. They are not in the oil picture yet. Ground dabs use `groundRings` with a smaller grid than the wood (`n=48`, four levels) so the slice can run here. The function is the author's; the counts are in `src/paint/ground.ts`.
