import bpy
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import paths

bpy.ops.wm.read_factory_settings(use_empty=True)

glb_path = paths.glb_path("gear")
if "--" in sys.argv:
    extra = sys.argv[sys.argv.index("--") + 1 :]
    if "--glb" in extra:
        idx = extra.index("--glb")
        if idx + 1 < len(extra):
            glb_path = os.path.abspath(extra[idx + 1])
elif "--glb" in sys.argv:
    idx = sys.argv.index("--glb")
    if idx + 1 < len(sys.argv):
        glb_path = os.path.abspath(sys.argv[idx + 1])

bpy.ops.import_scene.gltf(filepath=glb_path)

print("=== CHECKING ALL GEAR NODES IN GEAR.GLB ===")
for obj in bpy.data.objects:
    if obj.name.startswith("Gear_"):
        # Calculate bounding box of all meshes under this Empty or Mesh
        all_verts = []
        for child in [obj] + list(obj.children_recursive):
            if child.type == 'MESH':
                # world coords relative to root
                mw = child.matrix_world
                all_verts.extend([mw @ v.co for v in child.data.vertices])
        if all_verts:
            min_x = min(v.x for v in all_verts)
            max_x = max(v.x for v in all_verts)
            min_y = min(v.y for v in all_verts)
            max_y = max(v.y for v in all_verts)
            min_z = min(v.z for v in all_verts)
            max_z = max(v.z for v in all_verts)
            dims = (max_x - min_x, max_y - min_y, max_z - min_z)
            center = ((min_x + max_x)/2, (min_y + max_y)/2, (min_z + max_z)/2)
            print(f"{obj.name:30} dims=({dims[0]:.2f}, {dims[1]:.2f}, {dims[2]:.2f}) center=({center[0]:.2f}, {center[1]:.2f}, {center[2]:.2f})")
        else:
            print(f"{obj.name:30} NO MESHES")
