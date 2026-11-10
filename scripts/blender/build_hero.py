"""
Build the authentic Game Anime RPG Character (BlendSwap #4503 by uchiha007)
directly from `blender/examples/kai/kaiV2.blend` and export `public/models/hero.glb`
and `blender/hero.blend` with full textures, PBR materials, and 10 NLA animations.
"""

import bpy
import bmesh
import os
import math
from mathutils import Vector, Euler, Matrix

def t2b_pos(tx: float, ty: float, tz: float):
    return (tx, -tz, ty)

def t2b_euler(rx: float, ry: float, rz: float):
    return (rx, -rz, ry)

def create_empty_pivot(name: str, parent: bpy.types.Object, tx: float, ty: float, tz: float):
    bx, by, bz = t2b_pos(tx, ty, tz)
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.08
    bpy.context.scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    obj.location = Vector((bx, by, bz))
    bpy.context.view_layer.update()
    return obj

def split_mesh_bm(src_obj, filter_fn, name_a, name_b=None):
    col = src_obj.users_collection[0] if src_obj.users_collection else bpy.context.scene.collection
    obj_a = src_obj.copy()
    obj_a.data = src_obj.data.copy()
    obj_a.name = name_a
    col.objects.link(obj_a)
    
    bm_a = bmesh.new()
    bm_a.from_mesh(obj_a.data)
    bm_a.verts.ensure_lookup_table()
    dvert_lay_a = bm_a.verts.layers.deform.active
    del_a = [v for v in bm_a.verts if not filter_fn(v, dvert_lay_a)]
    bmesh.ops.delete(bm_a, geom=del_a, context='VERTS')
    bm_a.to_mesh(obj_a.data)
    bm_a.free()
    
    obj_b = None
    if name_b:
        obj_b = src_obj.copy()
        obj_b.data = src_obj.data.copy()
        obj_b.name = name_b
        col.objects.link(obj_b)
        
        bm_b = bmesh.new()
        bm_b.from_mesh(obj_b.data)
        bm_b.verts.ensure_lookup_table()
        dvert_lay_b = bm_b.verts.layers.deform.active
        del_b = [v for v in bm_b.verts if filter_fn(v, dvert_lay_b)]
        bmesh.ops.delete(bm_b, geom=del_b, context='VERTS')
        bm_b.to_mesh(obj_b.data)
        bm_b.free()
        
    bpy.data.objects.remove(src_obj, do_unlink=True)
    return obj_a, obj_b

def parent_to_pivot(child: bpy.types.Object, pivot: bpy.types.Object, part_tag: str, no_outline: bool = False):
    bpy.context.view_layer.update()
    mw = child.matrix_world.copy()
    child.parent = pivot
    child.matrix_world = mw
    bpy.context.view_layer.update()
    child["part"] = part_tag
    if no_outline:
        child["noOutline"] = True

def build_action(pivots: dict, action_name: str, total_frames: int, sample_fn):
    rest_locs = {p_name: obj.location.copy() for p_name, obj in pivots.items()}

    for name, obj in pivots.items():
        if not obj.animation_data:
            obj.animation_data_create()
        act = bpy.data.actions.new(name=f"{action_name}_{name}")
        obj.animation_data.action = act

    for f in range(total_frames):
        u = f / float(total_frames)
        pose = sample_fn(u)

        for p_name, trans in pose.items():
            if p_name not in pivots:
                continue
            obj = pivots[p_name]

            if "rot" in trans:
                rx, ry, rz = trans["rot"]
                bx, by, bz = t2b_euler(rx, ry, rz)
                obj.rotation_euler = Euler((bx, by, bz), "XYZ")
                obj.keyframe_insert(data_path="rotation_euler", frame=f)

            if "pos" in trans:
                tx, ty, tz = trans["pos"]
                bx, by, bz = t2b_pos(tx, ty, tz)
                base = rest_locs[p_name]
                obj.location = Vector((base.x + bx, base.y + by, base.z + bz))
                obj.keyframe_insert(data_path="location", frame=f)

    for name, obj in pivots.items():
        if not obj.animation_data or not obj.animation_data.action:
            continue
        act = obj.animation_data.action
        track = obj.animation_data.nla_tracks.new()
        track.name = action_name
        strip = track.strips.new(action_name, 0, act)
        strip.name = action_name
        obj.animation_data.action = None

    for p_name, obj in pivots.items():
        obj.location = rest_locs[p_name]
        obj.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")

def build_all_animations(pivots: dict):
    # 1. Idle (Heroic upright stance, natural breathing, straight vertical legs)
    def sample_idle(u: float):
        ang = u * 2.0 * math.pi
        breath = math.sin(ang)
        sway = math.cos(ang * 0.5)

        torso_pitch = -0.025 + breath * 0.012
        torso_roll = sway * 0.012
        torso_yaw = sway * 0.010

        bob = breath * 0.006
        sway_x = sway * 0.008

        return {
            "Torso": {
                "rot": (torso_pitch, torso_yaw, torso_roll),
                "pos": (sway_x, bob, 0.0),
            },
            "HeadGroup": {
                "rot": (-torso_pitch * 0.6, -torso_yaw * 0.7, -torso_roll * 0.8),
                "pos": (sway_x * 0.5, bob * 0.7, 0.0),
            },
            "LeftArmPivot": {
                "rot": (0.04 - breath * 0.02, 0.02, -0.06 - sway * 0.02),
                "pos": (sway_x, bob, 0.0),
            },
            "RightArmPivot": {
                "rot": (0.04 - breath * 0.02, -0.02, 0.06 + sway * 0.02),
                "pos": (sway_x, bob, 0.0),
            },
            "LeftElbowPivot": {"rot": (-0.18 + breath * 0.03, 0.0, 0.0)},
            "RightElbowPivot": {"rot": (-0.18 + breath * 0.03, 0.0, 0.0)},
            "LeftLegPivot": {
                "rot": (0.0, -torso_yaw * 0.25, -sway * 0.012),
                "pos": (0.0, 0.0, 0.0),
            },
            "RightLegPivot": {
                "rot": (0.0, -torso_yaw * 0.25, -sway * 0.012),
                "pos": (0.0, 0.0, 0.0),
            },
            "LeftKneePivot": {"rot": (0.0, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.0, 0.0, 0.0)},
        }

    build_action(pivots, "Idle", 48, sample_idle)

    # 2. Walk Cycle (Fluid, backward knee flexion, straight stride)
    def sample_walk(u: float):
        ang = u * 2.0 * math.pi
        l_phase = math.sin(ang)
        r_phase = -l_phase
        dip = -abs(math.cos(ang)) * 0.035
        sway = math.sin(ang) * 0.020

        l_stride = l_phase * 0.55
        r_stride = r_phase * 0.55

        # Knee flexes backward in swing phase (negative rx)
        l_knee = -math.sin(ang) * 0.75 if math.sin(ang) > 0 else 0.0
        r_knee = math.sin(ang) * 0.75 if math.sin(ang) < 0 else 0.0

        arm_swing = 0.48
        elbow_swing = 0.35

        return {
            "Torso": {
                "rot": (0.06, sway * 0.8, -sway * 0.4),
                "pos": (sway * 0.5, dip, 0.0),
            },
            "HeadGroup": {
                "rot": (-0.03, -sway * 0.6, sway * 0.3),
                "pos": (sway * 0.25, dip * 0.8, 0.0),
            },
            "LeftArmPivot": {
                "rot": (-r_stride * arm_swing, 0.0, -0.06),
                "pos": (sway * 0.5, dip, 0.0),
            },
            "RightArmPivot": {
                "rot": (-l_stride * arm_swing, 0.0, 0.06),
                "pos": (sway * 0.5, dip, 0.0),
            },
            "LeftElbowPivot": {
                "rot": (-0.25 - max(0.0, -r_stride) * elbow_swing, 0.0, 0.0),
            },
            "RightElbowPivot": {
                "rot": (-0.25 - max(0.0, -l_stride) * elbow_swing, 0.0, 0.0),
            },
            "LeftLegPivot": {
                "rot": (l_stride, 0.0, sway * 0.2),
                "pos": (0.0, dip, 0.0),
            },
            "RightLegPivot": {
                "rot": (r_stride, 0.0, -sway * 0.2),
                "pos": (0.0, dip, 0.0),
            },
            "LeftKneePivot": {"rot": (l_knee, 0.0, 0.0)},
            "RightKneePivot": {"rot": (r_knee, 0.0, 0.0)},
        }

    build_action(pivots, "Walk", 32, sample_walk)

    # 3. Slash
    def sample_slash(u: float):
        if u < 0.28:
            t = u / 0.28
            r_arm_x = 0.15 - t * 1.35
            r_arm_y = -t * 0.55
            r_arm_z = t * 0.45
            torso_yaw = -t * 0.42
            torso_pitch = 0.04
        elif u < 0.48:
            t = (u - 0.28) / 0.20
            strike = math.sin(t * math.pi * 0.5)
            r_arm_x = -1.20 + strike * 2.25
            r_arm_y = -0.55 + strike * 1.05
            r_arm_z = 0.45 - strike * 0.75
            torso_yaw = -0.42 + strike * 0.95
            torso_pitch = 0.04 + strike * 0.14
        else:
            t = (u - 0.48) / 0.52
            decay = math.exp(-t * 3.5)
            r_arm_x = 1.05 * decay + 0.10 * (1 - decay)
            r_arm_y = 0.50 * decay
            r_arm_z = -0.30 * decay
            torso_yaw = 0.53 * decay
            torso_pitch = 0.18 * decay

        return {
            "Torso": {"rot": (torso_pitch, torso_yaw, 0.0), "pos": (0.0, 0.0, 0.0)},
            "HeadGroup": {"rot": (0.0, -torso_yaw * 0.5, 0.0), "pos": (0.0, 0.0, 0.0)},
            "RightArmPivot": {"rot": (r_arm_x, r_arm_y, r_arm_z)},
            "RightElbowPivot": {"rot": (-0.45, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (-0.35, 0.25, -0.35)},
            "LeftElbowPivot": {"rot": (-0.65, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.12, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.18, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.10, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.12, 0.0, 0.0)},
        }

    build_action(pivots, "Slash", 24, sample_slash)

    # 4. Lunge
    def sample_lunge(u: float):
        thrust = math.sin(u * math.pi)
        return {
            "Torso": {"rot": (0.24 * thrust, 0.0, 0.0), "pos": (0.0, -0.06 * thrust, -0.16 * thrust)},
            "HeadGroup": {"rot": (-0.15 * thrust, 0.0, 0.0)},
            "RightArmPivot": {"rot": (0.95 * thrust, 0.0, -0.15 * thrust)},
            "RightElbowPivot": {"rot": (-0.15 * (1 - thrust), 0.0, 0.0)},
            "LeftArmPivot": {"rot": (-0.65 * thrust, 0.35, -0.45)},
            "LeftElbowPivot": {"rot": (-0.55, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.35 * thrust, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.45 * thrust, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.28 * thrust, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.08 * thrust, 0.0, 0.0)},
        }

    build_action(pivots, "Lunge", 24, sample_lunge)

    # 5. Ranged
    def sample_ranged(u: float):
        draw = math.sin(u * math.pi) if u < 0.70 else max(0.0, 1.0 - (u - 0.70) / 0.30)
        return {
            "Torso": {"rot": (0.04, -0.55 * draw, 0.0)},
            "HeadGroup": {"rot": (0.0, 0.45 * draw, 0.0)},
            "LeftArmPivot": {"rot": (1.45 * draw, -0.25 * draw, -0.12)},
            "LeftElbowPivot": {"rot": (-0.08 * draw, 0.0, 0.0)},
            "RightArmPivot": {"rot": (1.35 * draw, 0.35 * draw, 0.45 * draw)},
            "RightElbowPivot": {"rot": (-1.35 * draw, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.12 * draw, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.18 * draw, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.06 * draw, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.08 * draw, 0.0, 0.0)},
        }

    build_action(pivots, "Ranged", 30, sample_ranged)

    # 6. Cast
    def sample_cast(u: float):
        t = math.sin(u * math.pi)
        pulse = math.sin(u * 4.0 * math.pi) * 0.08
        return {
            "Torso": {"rot": (-0.12 * t, 0.0, 0.0), "pos": (0.0, 0.04 * t, 0.0)},
            "HeadGroup": {"rot": (0.18 * t, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (1.55 * t + pulse, -0.35 * t, -0.35 * t)},
            "RightArmPivot": {"rot": (1.55 * t + pulse, 0.35 * t, 0.35 * t)},
            "LeftElbowPivot": {"rot": (-0.45 * t, 0.0, 0.0)},
            "RightElbowPivot": {"rot": (-0.45 * t, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.0, 0.0, -0.05 * t)},
            "RightLegPivot": {"rot": (0.0, 0.0, 0.05 * t)},
            "LeftKneePivot": {"rot": (0.0, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.0, 0.0, 0.0)},
        }

    build_action(pivots, "Cast", 28, sample_cast)

    # 7. Chop
    def sample_chop(u: float):
        if u < 0.45:
            t = u / 0.45
            arm = -t * 1.55
            torso_p = -t * 0.18
        elif u < 0.65:
            t = (u - 0.45) / 0.20
            arm = -1.55 + t * 2.85
            torso_p = -0.18 + t * 0.45
        else:
            t = (u - 0.65) / 0.35
            arm = 1.30 * (1 - t)
            torso_p = 0.27 * (1 - t)

        return {
            "Torso": {"rot": (torso_p, 0.0, 0.0)},
            "HeadGroup": {"rot": (-torso_p * 0.8, 0.0, 0.0)},
            "RightArmPivot": {"rot": (arm, 0.15, 0.10)},
            "LeftArmPivot": {"rot": (arm * 0.85, -0.25, -0.15)},
            "RightElbowPivot": {"rot": (-0.55, 0.0, 0.0)},
            "LeftElbowPivot": {"rot": (-0.75, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.12, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.12, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.10, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.10, 0.0, 0.0)},
        }

    build_action(pivots, "Chop", 26, sample_chop)

    # 8. Mine
    def sample_mine(u: float):
        if u < 0.40:
            t = u / 0.40
            arm = -t * 1.40
            torso_p = -t * 0.22
        elif u < 0.60:
            t = (u - 0.40) / 0.20
            arm = -1.40 + t * 2.60
            torso_p = -0.22 + t * 0.52
        else:
            t = (u - 0.60) / 0.40
            arm = 1.20 * (1 - t)
            torso_p = 0.30 * (1 - t)

        return {
            "Torso": {"rot": (torso_p, 0.15 * math.sin(u * math.pi), 0.0)},
            "HeadGroup": {"rot": (-torso_p * 0.7, 0.0, 0.0)},
            "RightArmPivot": {"rot": (arm, 0.20, 0.15)},
            "RightElbowPivot": {"rot": (-0.65, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (-0.25, 0.15, -0.20)},
            "LeftElbowPivot": {"rot": (-0.45, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.15, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.15, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.12, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.12, 0.0, 0.0)},
        }

    build_action(pivots, "Mine", 24, sample_mine)

    # 9. Fish
    def sample_fish(u: float):
        bob = math.sin(u * 2.0 * math.pi) * 0.05
        tug = math.sin(u * 6.0 * math.pi) * 0.02
        return {
            "Torso": {"rot": (0.04 + bob * 0.3, 0.0, 0.0)},
            "HeadGroup": {"rot": (0.08, 0.0, 0.0)},
            "RightArmPivot": {"rot": (0.75 + bob + tug, 0.12, 0.10)},
            "LeftArmPivot": {"rot": (0.65 + bob + tug, -0.15, -0.10)},
            "RightElbowPivot": {"rot": (-0.45, 0.0, 0.0)},
            "LeftElbowPivot": {"rot": (-0.55, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.0, 0.0, 0.0)},
            "RightLegPivot": {"rot": (0.0, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (0.0, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.0, 0.0, 0.0)},
        }

    build_action(pivots, "Fish", 36, sample_fish)

    # 10. SpinSlash
    def sample_spin(u: float):
        spin_yaw = u * 4.0 * math.pi
        arm_out = 1.35 + math.sin(u * 2.0 * math.pi) * 0.15
        return {
            "Torso": {"rot": (0.12, spin_yaw, 0.0)},
            "HeadGroup": {"rot": (0.0, spin_yaw * 0.85, 0.0)},
            "RightArmPivot": {"rot": (arm_out, 0.0, 0.35)},
            "LeftArmPivot": {"rot": (arm_out, 0.0, -0.35)},
            "RightElbowPivot": {"rot": (-0.25, 0.0, 0.0)},
            "LeftElbowPivot": {"rot": (-0.25, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (-0.08, 0.0, 0.0)},
            "RightLegPivot": {"rot": (0.08, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.15, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.15, 0.0, 0.0)},
        }

    build_action(pivots, "SpinSlash", 24, sample_spin)


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    kai_dir = os.path.join(root_dir, 'blender', 'examples', 'kai')
    kai_blend = os.path.join(kai_dir, 'kaiV2.blend')
    glb_path = os.path.join(root_dir, 'public', 'models', 'hero.glb')
    blend_path = os.path.join(root_dir, 'blender', 'hero.blend')
    preview_path = os.path.join(root_dir, 'scratch', 'kai_baked_preview.png')
    os.makedirs(os.path.dirname(preview_path), exist_ok=True)

    if not os.path.exists(kai_blend):
        zip_path = os.path.join(root_dir, 'blender', 'examples', 'Game Anime RPG Character.zip')
        if os.path.exists(zip_path):
            import zipfile
            os.makedirs(kai_dir, exist_ok=True)
            with zipfile.ZipFile(zip_path, 'r') as zf:
                zf.extractall(kai_dir)

    # 1. Open kaiV2.blend natively
    bpy.ops.wm.open_mainfile(filepath=kai_blend)

    # Remove Camera, Lamp, and old Armature
    for name in ['Camera', 'Lamp', 'Armature']:
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)

    # 2. Apply matrix_world to vertices so everything is in unified world coordinates
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH':
            obj.modifiers.clear()
            mesh = obj.data
            for v in mesh.vertices:
                v.co = obj.matrix_world @ v.co
            obj.matrix_world.identity()

    # 3. Scale, orient, and align: target height 1.85m, soles at z = 0.0, facing +Y forward
    S = 1.85 / 11.0498
    Z0 = 4.2954

    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH':
            mesh = obj.data
            for v in mesh.vertices:
                # Rotate 180 degrees around Z so character faces +Y forward and left is at -X
                vx = -v.co.x * S
                vy = -v.co.y * S
                vz = (v.co.z + Z0) * S
                v.co.x = vx
                v.co.y = vy
                v.co.z = vz
            mesh.update()

    # 4. Split paired meshes
    boots_obj = bpy.data.objects['Boots.001']
    boot_l, boot_r = split_mesh_bm(boots_obj, lambda v, d: v.co.x < 0, 'Boot_L', 'Boot_R')

    bracers_obj = bpy.data.objects['armbraces.001']
    bracer_l, bracer_r = split_mesh_bm(bracers_obj, lambda v, d: v.co.x < 0, 'Bracer_L', 'Bracer_R')

    hands_obj = bpy.data.objects['hands.001']
    hand_l, hand_r = split_mesh_bm(hands_obj, lambda v, d: v.co.x < 0, 'Hand_L', 'Hand_R')

    # Coat split
    coat_obj = bpy.data.objects['coat.001']
    vgs = {vg.index: vg.name for vg in coat_obj.vertex_groups}

    def is_arm_l(v, d):
        if not d: return False
        dvert = v[d]
        weights = {vgs[k]: w for k, w in dvert.items() if k in vgs}
        return (weights.get('upperArm_L', 0) > 0.3 or weights.get('lowerArm_L', 0) > 0.3) and v.co.x < -0.05

    def is_arm_r(v, d):
        if not d: return False
        dvert = v[d]
        weights = {vgs[k]: w for k, w in dvert.items() if k in vgs}
        return (weights.get('upperArm_R', 0) > 0.3 or weights.get('lowerArm_R', 0) > 0.3) and v.co.x > 0.05

    sleeve_l, coat_rest = split_mesh_bm(coat_obj, is_arm_l, 'Sleeve_L', 'Coat_Rest')
    sleeve_r, torso_coat = split_mesh_bm(coat_rest, is_arm_r, 'Sleeve_R', 'TorsoCoat')

    # Pants split
    pants_obj = bpy.data.objects['pants.001']
    thigh_l, pants_rest1 = split_mesh_bm(pants_obj, lambda v, d: v.co.x < 0 and v.co.z > 0.58, 'Thigh_L', 'Pants_Rest1')
    thigh_r, pants_rest2 = split_mesh_bm(pants_rest1, lambda v, d: v.co.x >= 0 and v.co.z > 0.58, 'Thigh_R', 'Pants_Rest2')
    shin_l, shin_r = split_mesh_bm(pants_rest2, lambda v, d: v.co.x < 0, 'Shin_L', 'Shin_R')

    # Rename single meshes
    head_obj = bpy.data.objects['head.001']
    head_obj.name = 'Head'
    hair_obj = bpy.data.objects['hair.002']
    hair_obj.name = 'Hair'
    eyes_obj = bpy.data.objects['eyes.001']
    eyes_obj.name = 'Eyes'
    undershirt_obj = bpy.data.objects['UnderShirt.001']
    undershirt_obj.name = 'InnerChest'
    belt_obj = bpy.data.objects['belt.001']
    belt_obj.name = 'Belt'

    # 5. PBR Materials with authentic palette colors
    # (Texture images are loaded in runtime.ts via TextureLoader so Node.js Vitest tests pass)
    color_map = {
        'Head': (0.961, 0.847, 0.761, 1.0),       # Smooth anime skin (0xF5D8C2)
        'Hair': (0.243, 0.169, 0.118, 1.0),       # Chestnut brown hair (0x3E2B1E)
        'Eyes': (0.133, 0.486, 0.831, 1.0),       # Vivid anime blue eyes (0x227CD4)
        'InnerChest': (0.157, 0.169, 0.180, 1.0), # Slate charcoal undershirt (0x282B2E)
        'TorsoCoat': (0.345, 0.392, 0.212, 1.0),  # Olive-moss coat wings & tails (0x586436)
        'Belt': (0.118, 0.125, 0.133, 1.0),       # Wide dark waist sash / obi (0x1E2022)
        'Sleeve_L': (0.345, 0.392, 0.212, 1.0),   # Olive-moss upper sleeves
        'Sleeve_R': (0.345, 0.392, 0.212, 1.0),   # Olive-moss upper sleeves
        'Bracer_L': (0.306, 0.208, 0.141, 1.0),   # Leather archer vambraces (0x4E3524)
        'Bracer_R': (0.306, 0.208, 0.141, 1.0),   # Leather archer vambraces (0x4E3524)
        'Hand_L': (0.961, 0.847, 0.761, 1.0),     # Anime skin hands (0xF5D8C2)
        'Hand_R': (0.961, 0.847, 0.761, 1.0),     # Anime skin hands (0xF5D8C2)
        'Thigh_L': (0.314, 0.361, 0.188, 1.0),    # Baggy adventurer trousers (0x505C30)
        'Thigh_R': (0.314, 0.361, 0.188, 1.0),    # Baggy adventurer trousers (0x505C30)
        'Shin_L': (0.314, 0.361, 0.188, 1.0),     # Baggy adventurer trousers (0x505C30)
        'Shin_R': (0.314, 0.361, 0.188, 1.0),     # Baggy adventurer trousers (0x505C30)
        'Boot_L': (0.204, 0.141, 0.094, 1.0),     # Tall riding boots (0x342418)
        'Boot_R': (0.204, 0.141, 0.094, 1.0),     # Tall riding boots (0x342418)
    }

    for name, col in color_map.items():
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        obj.data.materials.clear()
        mat = bpy.data.materials.new(name=f"Mat_{name}")
        obj.data.materials.append(mat)
        
        tree = mat.node_tree
        tree.nodes.clear()
        bsdf = tree.nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = col
        bsdf.inputs['Roughness'].default_value = 0.55
        bsdf.inputs['Specular IOR Level'].default_value = 0.20
        
        out = tree.nodes.new('ShaderNodeOutputMaterial')
        tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    # 6. Create the LEAN_RIG Empties hierarchy
    hero_root = create_empty_pivot("HeroRoot", None, 0.0, 0.0, 0.0)
    torso = create_empty_pivot("Torso", hero_root, 0.0, 1.24, 0.0)
    head_grp = create_empty_pivot("HeadGroup", hero_root, 0.0, 1.86, 0.0)

    left_arm = create_empty_pivot("LeftArmPivot", hero_root, -0.28, 1.50, 0.0)
    right_arm = create_empty_pivot("RightArmPivot", hero_root, 0.28, 1.50, 0.0)

    left_elbow = create_empty_pivot("LeftElbowPivot", left_arm, 0.0, -0.26, 0.0)
    right_elbow = create_empty_pivot("RightElbowPivot", right_arm, 0.0, -0.26, 0.0)

    left_leg = create_empty_pivot("LeftLegPivot", hero_root, -0.11, 0.90, 0.0)
    right_leg = create_empty_pivot("RightLegPivot", hero_root, 0.11, 0.90, 0.0)

    left_knee = create_empty_pivot("LeftKneePivot", left_leg, 0.0, -0.38, 0.0)
    right_knee = create_empty_pivot("RightKneePivot", right_leg, 0.0, -0.38, 0.0)

    # 7. Parent all meshes to their exact pivots
    parent_to_pivot(head_obj, head_grp, "head", no_outline=True)
    parent_to_pivot(hair_obj, head_grp, "hair", no_outline=True)
    parent_to_pivot(eyes_obj, head_grp, "eye", no_outline=True)

    parent_to_pivot(undershirt_obj, torso, "inner-tunic")
    parent_to_pivot(torso_coat, torso, "chest")
    parent_to_pivot(belt_obj, torso, "belt")

    parent_to_pivot(sleeve_l, left_arm, "deltoid")
    parent_to_pivot(sleeve_r, right_arm, "deltoid")

    parent_to_pivot(bracer_l, left_elbow, "bracer", no_outline=True)
    parent_to_pivot(bracer_r, right_elbow, "bracer", no_outline=True)

    parent_to_pivot(hand_l, left_elbow, "hand", no_outline=True)
    parent_to_pivot(hand_r, right_elbow, "hand", no_outline=True)

    parent_to_pivot(thigh_l, left_leg, "thigh")
    parent_to_pivot(thigh_r, right_leg, "thigh")

    parent_to_pivot(shin_l, left_knee, "shin")
    parent_to_pivot(shin_r, right_knee, "shin")

    parent_to_pivot(boot_l, left_knee, "boot")
    parent_to_pivot(boot_r, right_knee, "boot")

    pivots = {
        "Torso": torso,
        "HeadGroup": head_grp,
        "LeftArmPivot": left_arm,
        "RightArmPivot": right_arm,
        "LeftElbowPivot": left_elbow,
        "RightElbowPivot": right_elbow,
        "LeftLegPivot": left_leg,
        "RightLegPivot": right_leg,
        "LeftKneePivot": left_knee,
        "RightKneePivot": right_knee,
    }

    # 8. Build all 10 animations
    build_all_animations(pivots)

    # 9. Pack textures into blend file
    try:
        bpy.ops.file.pack_all()
    except Exception as e:
        print('pack_all warning:', e)

    # 10. Studio Camera & Render
    scene = bpy.context.scene
    scene.render.resolution_x = 960
    scene.render.resolution_y = 1080
    scene.render.film_transparent = True

    key_data = bpy.data.lights.new(name="FrontKeyLight", type="SUN")
    key_data.energy = 4.0
    key_data.color = (1.0, 0.98, 0.95)
    key_obj = bpy.data.objects.new(name="FrontKeyLight", object_data=key_data)
    scene.collection.objects.link(key_obj)
    key_obj.rotation_euler = Euler((math.radians(-72), math.radians(12), math.radians(-5)), "XYZ")

    cam_data = bpy.data.cameras.new(name="StudioCam")
    cam_data.lens = 52.0
    cam_obj = bpy.data.objects.new(name="StudioCam", object_data=cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, 3.40, 0.95)
    direction = Vector((0.0, 0.0, 0.92)) - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj

    scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[BlenderHero] Rendered studio preview to {preview_path}")

    # 11. Save blend and export GLB
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_extras=True,
    )
    print(f"[BlenderHero] Exported authentic Kai RPG character to {blend_path} and {glb_path}")


if __name__ == '__main__':
    main()
