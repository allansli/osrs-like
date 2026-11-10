import bpy
import bmesh
import os
import math
from mathutils import Vector, Euler, Matrix

def export_guard():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    knight_blend = os.path.join(repo_root, "blender", "examples", "knight_28541", "knight.blend")
    guard_glb = os.path.join(repo_root, "public", "models", "guard.glb")
    
    bpy.ops.wm.open_mainfile(filepath=knight_blend)
    
    keep_names = {
        'Helmet', 'Torso_plate', 'Lower_torso_plate',
        'L_shoulder', 'R_shoulder', 'L_upperarm_plate', 'R_upperarm_plate',
        'L_forearm_plate', 'R_forearm_plate', 'L_wrist_plate', 'R_wrist_plate',
        'L_hand_1', 'R_hand1', 'L_hand2', 'R_hand2',
        'L_thigh_plate', 'R_thigh_plate', 'L_knee_plate', 'R_knee_plate',
        'L_shin_plate', 'R_shin_plate', 'L_foot_guard', 'R_foot_guard',
        'L_toe_plate', 'R_toe_plate', 'Longsword', 'Human_BaseMesh'
    }
    
    # Remove unwanted objects
    for obj in list(bpy.context.scene.objects):
        if obj.name not in keep_names:
            bpy.data.objects.remove(obj, do_unlink=True)
            
    # Clear parent relations and bone references
    for obj in bpy.data.objects:
        obj.parent = None
        obj.parent_type = 'OBJECT'
        obj.parent_bone = ''
        
    rot_z = Matrix.Rotation(math.pi, 4, 'Z')
    scale_factor = 1.85 / 4.88
    
    # Bake transforms directly into bmesh
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH':
            if len(obj.data.polygons) == 0:
                bpy.data.objects.remove(obj, do_unlink=True)
                continue
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            mw = obj.matrix_world
            bmesh.ops.transform(bm, matrix=mw, verts=bm.verts)
            bmesh.ops.transform(bm, matrix=rot_z, verts=bm.verts)
            bmesh.ops.transform(bm, matrix=Matrix.Scale(scale_factor, 4), verts=bm.verts)
            bm.to_mesh(obj.data)
            bm.free()
            obj.matrix_world = Matrix.Identity(4)
            
    # Calculate bounds and ground to Z = 0
    all_verts = []
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            all_verts.extend([v.co for v in obj.data.vertices])
            
    min_z = min(v.z for v in all_verts)
    max_z = max(v.z for v in all_verts)
    print(f"[Guard] Bounds: min_z={min_z:.2f}, max_z={max_z:.2f}, height={max_z - min_z:.2f}")
    
    shift_z = -min_z
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector((0, 0, shift_z))), verts=bm.verts)
            bm.to_mesh(obj.data)
            bm.free()
            
    # Create root Empty for the Guard
    root = bpy.data.objects.new("CastleGuard", None)
    bpy.context.collection.objects.link(root)
    
    # Create clean stylized materials
    mat_steel = bpy.data.materials.new("mat_guard_steel")
    bsdf = mat_steel.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.50, 0.54, 0.58, 1.0)
        bsdf.inputs["Metallic"].default_value = 0.85
        bsdf.inputs["Roughness"].default_value = 0.32
        
    mat_gold = bpy.data.materials.new("mat_guard_gold")
    bsdf = mat_gold.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.85, 0.68, 0.18, 1.0)
        bsdf.inputs["Metallic"].default_value = 0.90
        bsdf.inputs["Roughness"].default_value = 0.28
        
    mat_leather = bpy.data.materials.new("mat_guard_leather")
    bsdf = mat_leather.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.28, 0.18, 0.12, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.65
        
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            obj.parent = root
            obj.data.materials.clear()
            if 'Helmet' in obj.name or 'plate' in obj.name.lower() or 'guard' in obj.name.lower() or 'Longsword' in obj.name:
                obj.data.materials.append(mat_steel)
            elif 'hand' in obj.name.lower() or 'wrist' in obj.name.lower():
                obj.data.materials.append(mat_leather)
            else:
                obj.data.materials.append(mat_steel)
                
    # Export glTF
    bpy.ops.export_scene.gltf(
        filepath=guard_glb,
        export_format="GLB",
        export_yup=True
    )
    print(f"[Guard] Exported {guard_glb} cleanly!")

if __name__ == "__main__":
    export_guard()
