import bpy
import os

bpy.ops.wm.read_factory_settings(use_empty=True)
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
glb_path = os.path.join(repo_root, "public", "models", "gear.glb")

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
