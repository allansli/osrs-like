"""
Re-exports blender/hero.blend after manual edits in the Blender GUI straight to public/models/hero.glb.

Run via:
  npm run blender:export
"""

import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from oil_paint_props import stamp_scene

def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    glb_path = os.path.join(repo_root, "public", "models", "hero.glb")
    os.makedirs(os.path.dirname(glb_path), exist_ok=True)

    stamp_scene()
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_yup=True,
        export_extras=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_optimize_animation_size=False,
        export_nla_strips_merged_animation_name="Animation",
    )
    print(f"[Blender] Exported manual edits from hero.blend -> {glb_path}")

if __name__ == "__main__":
    main()
