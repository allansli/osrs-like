import sys; sys.path.insert(0, sys.argv[1])
from lib import Doc
d = Doc('/path/to/osrs-like-wp/MP/docs/superpowers/specs/2026-11-14-models-pass-design.md')

d.sub("- No image is embedded (K3) and none is added to `public/`.\n\n### 6.4",
"- A skinned figure adds two attributes per vertex: `JOINTS_0` (4 bytes) and `WEIGHTS_0` (16 bytes as floats). Measured (3.5 S9): about 6.3 bytes per vertex on the wire. Organic bodies compress about 1.1:1, so the figures of this stage are heavier per triangle than today's box figures; section 9 budgets for it, and decision N-3 offers 8-bit normals, weights and colour, which need no decoder.\n- No image is embedded (K3) and none is added to `public/`.\n\n### 6.4")

d.sub("| **Contract** | The **built file against the manifest** (which the same task updates): node names and parents; pivot translations within 0.0001 of the manifest; scales; material names; mesh name classes and the toggled names of 8.1; mount-relevant part centres within 0.01; `extras`; clip names; that each clip still moves the pivots the tests read; `COLOR_0` all or none. |",
"| **Contract** | The **built file against the manifest** (which the same task updates): node names and parents; pivot or bone translations within 0.0001 of the manifest; scales; material names; mesh name classes and the toggled names of 8.1; mount-relevant part centres within 0.01; `extras`; clip names; that each clip still moves the pivots or bones the tests read; `COLOR_0` all or none. **For a skinned figure also**: the bone list and parents of its skeleton (6.1.2); every joint's rest rotation is identity; every vertex has at most 4 influences, weights that sum to 1 within 0.01 and joint indices inside the skin; shared clips hold rotation tracks only, plus `Hips` position; each attack clip's anticipation time. |")
d.sub("**Each pivot's active action is cleared before one clip's track is unmuted**; otherwise the importer's `Idle` overrides every clip (critique C2). The sheet prints, per clip, the measured rotation range of each pivot. | Anticipation, strike, follow-through; joint gaps in the worst pose |",
"**Each pivot's or armature's active action is cleared before one clip's track is unmuted**; otherwise the importer's `Idle` overrides every clip (critique C2; the probe of 3.5 hit the same trap with NLA tracks overriding a hand-set pose). The sheet prints, per clip, the measured rotation range of each bone. A **worst-pose sheet** per skinned figure (deep crouch, arm overhead, full twist) shows what the weights do at the limits. | Anticipation, strike, follow-through; how the skin bends, pinches or tears in the worst pose |")

d.between("All of these are kept. They become the manifest of 7.2.", "---\n\n## 9. Budgets", r"""All of these become the manifest of 7.2. **What skinning does to them:** every pivot name in the table becomes a bone of the same name (6.1.1), so every name lookup holds. Four things change, each declared:

| Contract | Change | Why |
|---|---|---|
| Hero pivots are siblings under `HeroRoot` | They become a chain: `Root`, `Hips`, `Torso`, then `HeadGroup` and the arm bones; the leg bones under `Hips` | A lean of the torso must carry the head and arms. Shoulder and hip x offsets are unchanged; the local height of `Torso` and `HeadGroup` is not (8.3, replacement 2). |
| `HeadGroup` at height 1.86 | The neck joint, about 1.60 | A skinned head turns about the neck. Helm and hat offsets shift by the same amount in the shared mounting function; a test pins the helm's rest position. |
| Hide loops search the head and torso pivots for `Hair*`, `TorsoCoat`, `InnerCollar` and the coat prefixes | They search the figure's group | A skinned mesh hangs under the root, not under a bone. The names do not change. |
| Monster and hero templates are cloned with `clone(true)` | Skinned templates are cloned with the skeleton utility | 3.5 S5 |

### 8.2 What is added (never renamed)

| Addition | For | Engine side |
|---|---|---|
| `COLOR_0` on figure meshes, all or none per file | 6.3 | One flag in three upgrade functions |
| A skin on a figure: `JOINTS_0`, `WEIGHTS_0`, one skeleton per figure with the bones of 6.1.2, named `<model key>_<Bone>` in `monsters.glb` and bare in `hero.glb` | 6.1 | The skinned path: clone with the skeleton utility, strip the prefix, skinned outline shell, fixed culling sphere, skeleton disposal |
| Optional bones `Jaw`, `WeaponPivot`, `OffhandPivot`, `LWing`, `RWing`, `TailPivot`, `TailPivot2` (biped); the dragon and crawler bones of 6.1.2 | 6.5, Stage 4's wind-up | Found by name; a missing optional bone is skipped, as `findPivot` already allows |
| Bones `Root`, `Hips`, `LeftHand`, `RightHand`, `LeftFoot`, `RightFoot` on bipeds | 6.1.2 | `Hips` position is the one shared position track, scaled per figure |
| Hero clips `Death`, `Hurt` (decided 2026-11-14) | 6.5 | `HeroClipName` and two call sites |
| Clip libraries on the dragon and the scorpion in `monsters.glb` | 6.5 | A motion table per model key names the clips a model plays |
| Nodes `Kit_saltback_stalker` and `Kit_thornwatch_marksman`, whose children are rigid meshes named after the base figure's bones | 5.6 | A look field `kit?: string` on Stage 4's two rows; after the base clone the kit's children are added under the bones of the same name |
| Node `Monster_ashmantle`: its own skinned body on the dragon skeleton | Owner decision: Ashmantle gets its own model | A look field `body?: string` on Stage 4's boss row. The node lookup reads `Monster_<body ?? model key>`; skeleton, motion table, minimap and every other use of the model key still read `model: 'elvarg_dragon'`. **No model key changes** (critique C4), so Stage 4's tests ("ten distinct model keys", "the boss uses the dragon's model key") stay as Stage 4 left them. |

The gear band nodes (`_b2`, `_b3`) move to the follow-up stage with the bands (section 10).

### 8.3 Tests

**Kept green, untouched:** `tests/run-blender.test.ts`; `tests/credits.test.ts` (the knight's credit line and licence file stay, 10.3); `src/__tests__/lean-rig.test.ts` (it tests the procedural placeholder rig, which stays rigid); `tests/textures.test.ts` and `tests/dispose.test.ts` (they read the outline shell of a **plain** mesh, which keeps today's shell and material; Stage 5's own replacements in `textures.test.ts` are Stage 5's); `tests/gltf-loader.test.ts`; Stage 4's tests over model keys; and `src/__tests__/blender-hero.test.ts` except the two assertions below. In that file these lines must stay green **as written** with the skinned hero: 49 (no gear mesh names), 53-54, 58-61 (shoulder and hip x, which do not change under the new hierarchy), 66 (`Walk` turns `leftLegPivot.rotation.x` past 0.01) and 70 (`Slash` turns `rightArmPivot.rotation.x` past 0.05). Lines 66 and 70 hold only because bones are world-aligned (6.1.1); that is the reason for the rule.

**Declared replacements** (two, both in `src/__tests__/blender-hero.test.ts`, both made in the hero slice):

1. Lines 39-42, `expect(clipNames).toEqual(['Cast', 'Chop', 'Fish', 'Idle', 'Lunge', 'Mine', 'Ranged', 'Slash', 'SpinSlash', 'Walk'].sort())`: exactly ten clip names. Replaced by: those ten are all present, and the full sorted list equals the manifest's hero clips (which adds `Death` and `Hurt`).
2. Lines 56-57, `expect(rig.torso.position.y).toBeCloseTo(LEAN_RIG.torsoY, 2)` and `expect(rig.headGroup.position.y).toBeCloseTo(LEAN_RIG.headY, 2)`: local heights, which assume the flat pivot layout. Replaced by: the height of `rig.torso` **in the rig group's space** is `LEAN_RIG.torsoY` to two decimals, and the height of `rig.headGroup` in the same space equals the manifest's neck height to two decimals. Their intent (the body's joints sit where the gear expects them) is kept and widened by the new mount test below.

Checked at the premise re-check (plan R0): Stage 4 rewrites the monsters case of the same file to iterate the ten distinct model keys; this stage changes no model key, so that case and `tests/new-monsters.test.ts` stay untouched. R0 also lists every figure assertion of `tests/textures.test.ts` and `tests/dispose.test.ts` as they stand after Stage 5.

**New contract tests** (new files; they replace what the frozen tests cannot see):

| Test | Asserts |
|---|---|
| `tests/model-contract.test.ts` | The shipped files satisfy the manifest of 7.2, including the skin rules (bone list and parents, identity rest rotations, at most 4 influences, weights summing to 1, joint indices in range, rotation-only shared clips) and the budgets of section 9 |
| `tests/skinned-figure.test.ts` | On a tiny skinned fixture: two instances cloned from one template pose independently and leave the template at rest; bone names lose their prefix; every pivot field of the rig is a bone; the outline shell of a skinned mesh is a skinned mesh on the same skeleton with the skinned outline material, and a plain mesh still gets today's shell; the culling sphere is fixed and at least the rest sphere times 1.5; disposal calls `skeleton.dispose`; a rigid figure in the same file still takes the rigid path |
| `tests/gear-mount.test.ts` | For a full ten-slot loadout, the rest position of every mounted piece in the figure's space equals a snapshot taken from today's hero within 0.01; `Hair*` hides under a helm and `TorsoCoat` and `InnerCollar` under body armour; the armour recolours the five role materials on the meshes that carry them |
| `tests/hero-model.test.ts`, `tests/hero-clips.test.ts` | Motion ranges per clip, the two frozen samples restated, `Death` and `Hurt` wiring |
| `tests/guards.test.ts` | Guards are dressed hero instances; no request for `guard.glb` |
| `tests/monster-motion.test.ts` | Every bone a model's motion table names exists on its skeleton and has weight on at least one vertex (a bone that moves nothing is how the old dragon was a statue, critique C1); a biped monster plays the hero file's `Walk` and `Slash` and keeps its own bone lengths; the `Hips` track is scaled by hip height; the wind-up scrub stops at the clip's anticipation time |
| `tests/monster-kits.test.ts`, `tests/monster-body.test.ts` | A kit attaches under the base bones; `body` changes the node and nothing else; model keys equal a snapshot |
| `tests/monster-merge.test.ts`, `tests/gear-merge.test.ts` | Triangles per engine material family are unchanged by a merge |
| `tests/model-cache-key.test.ts`, `tests/model-licences.test.ts`, the path-leak case | As before |

---
""")
d.save(); print('d3 ok')
