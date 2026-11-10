import bpy
import os

bpy.ops.wm.read_factory_settings(use_empty=True)
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
glb_path = os.path.join(repo_root, "public", "models", "gear.glb")
bpy.ops.import_scene.gltf(filepath=glb_path)

check_keys = [
    'Gear_amulet', 'Gear_boots_L', 'Gear_boots_R', 'Gear_gloves_L', 'Gear_gloves_R',
    'Gear_helm', 'Gear_plate-body_torso', 'Gear_platelegs_legL', 'Gear_platelegs_legR',
    'Gear_scimitar', 'Gear_sword', 'Gear_greatsword', 'Gear_kiteshield'
]

for name in check_keys:
    obj = bpy.data.objects.get(name)
    if not obj:
        print(f"NOT FOUND: {name}")
        continue
    # Vertices relative to the object itself (local coords when cloned in Three.js!)
    # When cloneBlenderGearNode clones `template`, `cloned.position.set(0,0,0)`.
    # So the local mesh coordinates relative to `obj` ARE what Three.js sees!
    all_local_verts = []
    inv_mw = obj.matrix_world.inverted()
    for child in [obj] + list(obj.children_recursive):
        if child.type == 'MESH':
            all_local_verts.extend([inv_mw @ (child.matrix_world @ v.co) for v in child.data.vertices])
    if all_local_verts:
        min_x = min(v.x for v in all_local_verts)
        max_x = max(v.x for v in all_local_verts)
        min_y = min(v.y for v in all_local_verts)
        max_y = max(v.y for v in all_local_verts)
        min_z = min(v.z for v in all_local_verts)
        max_z = max(v.z for v in all_local_verts)
        dims = (max_x - min_x, max_y - min_y, max_z - min_z)
        center = ((min_x + max_x)/2, (min_y + max_y)/2, (min_z + max_z)/2)
        print(f"{name:25} LOCAL DIMS: ({dims[0]:.3f}, {dims[1]:.3f}, {dims[2]:.3f}) CENTER: ({center[0]:.3f}, {center[1]:.3f}, {center[2]:.3f})")
    else:
        print(f"{name:25} NO VERTS")
