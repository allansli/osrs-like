"""
Re-exports a blend file after manual edits in the Blender GUI to the output directory.

Run via:
  npm run blender:export
"""

import os
import sys
import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(__file__))
import paths


def main():
    blend_name = "hero"
    if "--" in sys.argv:
        extra = sys.argv[sys.argv.index("--") + 1 :]
        i = 0
        while i < len(extra):
            if extra[i] == "--out":
                i += 2
            elif extra[i].startswith("--"):
                i += 1
            else:
                blend_name = extra[i]
                break
    elif bpy.data.filepath:
        blend_name = os.path.splitext(os.path.basename(bpy.data.filepath))[0]

    if blend_name.endswith(".blend"):
        blend_name = blend_name[:-6]

    glb_path = paths.glb_path(blend_name)

    bpy.ops.export_scene.gltf(
        filepath=paths.glb_path(blend_name),
        export_format="GLB",
        export_yup=True,
        export_extras=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_optimize_animation_size=False,
        export_nla_strips_merged_animation_name="Animation",
    )
    print(f"[Blender] Exported manual edits -> {glb_path}")


if __name__ == "__main__":
    main()
