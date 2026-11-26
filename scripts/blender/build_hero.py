"""
Build the authentic Game Anime RPG Character (BlendSwap #4503 by uchiha007)
directly from Kai blend and export hero glb and hero blend: one skin on the
biped rig with the author's own weights, bound in the author's pose at the
author's joints, and the 10 clips keyed on its bones (models pass H3a).
"""

import bpy
import bmesh
import os
import sys
import math
from mathutils import Vector, Euler, Quaternion

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(__file__))
import paths
import figkit
import rigs

# The source's 59 vertex groups folded onto the 16 biped bones (design 3.5 S13).
FINGERS = ("thumb1", "thumb2", "thumb3") + tuple(
    f"{f}Finger{i}" for f in ("index", "middle", "ring", "pinky") for i in (1, 2, 3, 4)
)
FOLD = {
    "Hips": ["waist"],
    "Torso": ["spine1", "spine2"],
    "HeadGroup": ["neck", "head"],
}
for _s, _side in (("L", "Left"), ("R", "Right")):
    FOLD[f"{_side}ArmPivot"] = [f"upperArm_{_s}"]
    FOLD[f"{_side}ElbowPivot"] = [f"lowerArm_{_s}"]
    FOLD[f"{_side}Hand"] = [f"palm_{_s}"] + [f"{g}_{_s}" for g in FINGERS]
    FOLD[f"{_side}LegPivot"] = [f"upperLeg_{_s}"]
    FOLD[f"{_side}KneePivot"] = [f"lowerLeg_{_s}"]
    FOLD[f"{_side}Foot"] = [f"ankle_{_s}", f"foot1_{_s}", f"foot2_{_s}"]

# Each biped joint sits at the head of this source bone (design 3.5 S14, decision N-5); Root at the origin.
JOINT_OF = {"Hips": "waist", "Torso": "spine1", "HeadGroup": "neck"}
for _s, _side in (("L", "Left"), ("R", "Right")):
    JOINT_OF.update({
        f"{_side}ArmPivot": f"upperArm_{_s}", f"{_side}ElbowPivot": f"lowerArm_{_s}", f"{_side}Hand": f"palm_{_s}",
        f"{_side}LegPivot": f"upperLeg_{_s}", f"{_side}KneePivot": f"lowerLeg_{_s}", f"{_side}Foot": f"ankle_{_s}",
    })

# Source mesh -> (mesh name, extras.part, noOutline). One mesh per engine role (design 6.1.4); the coat is split
# into TorsoCoat and Sleeves below because body armour hides the one and not the other.
MESHES = {
    "head.001": ("Head", "head", True),
    "hair.002": ("Hair", "hair", True),
    "eyes.001": ("Eyes", "eye", True),
    "UnderShirt.001": ("InnerCollar", "inner-tunic", False),
    "belt.001": ("Belt", "belt", False),
    "armbraces.001": ("Bracers", "bracer", True),
    "hands.001": ("Hands", "hand", True),
    "pants.001": ("Legs", "thigh", False),
    "Boots.001": ("Boots", "boot", False),
}
COAT = ("coat.001", ("TorsoCoat", "chest", False), ("Sleeves", "deltoid", False))
RIGID_ON_HEAD = ("Hair", "Eyes")  # design 6.1.4: hair and eyes do not bend

COLOURS = {
    'Head': (0.961, 0.847, 0.761, 1.0),        # skin (0xF5D8C2)
    'Hair': (0.243, 0.169, 0.118, 1.0),        # chestnut brown (0x3E2B1E)
    'Eyes': (0.133, 0.486, 0.831, 1.0),        # blue (0x227CD4)
    'InnerCollar': (0.157, 0.169, 0.180, 1.0), # slate charcoal undershirt (0x282B2E)
    'TorsoCoat': (0.345, 0.392, 0.212, 1.0),   # olive-moss coat (0x586436)
    'Sleeves': (0.345, 0.392, 0.212, 1.0),     # olive-moss sleeves
    'Belt': (0.118, 0.125, 0.133, 1.0),        # dark waist sash (0x1E2022)
    'Bracers': (0.306, 0.208, 0.141, 1.0),     # leather vambraces (0x4E3524)
    'Hands': (0.961, 0.847, 0.761, 1.0),       # skin
    'Legs': (0.314, 0.361, 0.188, 1.0),        # trousers (0x505C30)
    'Boots': (0.204, 0.141, 0.094, 1.0),       # riding boots (0x342418)
}

# Source to figure: 1.85 tall, soles at 0, turned 180 degrees about Z (as before this task). No x centring:
# the mesh stays where the shipped hero's is, so the hand, foot and head centres hold (gear-mount, 0.01), and
# the spine bones sit at the author's x (-0.0114) instead.
S = 1.85 / 11.0498
Z0 = 4.2954


def to_figure(co):
    return Vector((-co.x * S, -co.y * S, (co.z + Z0) * S))


def split_faces(src_obj, face_in_a, name_a, name_b):
    """Splits a mesh by faces (each face goes to one side whole), so the two halves share the seam's vertices
    and, carrying the same weights, stay closed when the skin bends."""
    halves = []
    for name, keep_a in ((name_a, True), (name_b, False)):
        obj = src_obj.copy()
        obj.data = src_obj.data.copy()
        obj.name = name
        src_obj.users_collection[0].objects.link(obj)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        dl = bm.verts.layers.deform.active
        drop = [f for f in bm.faces if face_in_a(f, dl) != keep_a]
        bmesh.ops.delete(bm, geom=drop, context='FACES')
        bm.to_mesh(obj.data)
        bm.free()
        halves.append(obj)
    bpy.data.objects.remove(src_obj, do_unlink=True)
    return halves


ARM_BONES = ("LeftArmPivot", "RightArmPivot")


def build_action(rig, action_name: str, total_frames: int, sample_fn):
    """Keys one clip on the rig's bones, converted from today's flat pivots for the chain (design 6.1.5).

    The sample functions give each pivot's rotation in the figure's space as three-space Euler numbers in
    three's YZX order (Blender XZY, design 3.5 S16); a bone's local axes are the figure's (6.1.1 rule 2).
    HeadGroup and the arms are children of Torso, so their local rotation is the torso's inverse times
    today's, except the arms in SpinSlash, which keep today's numbers as local rotations. Elbows, knees and
    legs are already relative to their parents. Only the legs' position keys become the Hips track; the
    torso's own and the follow-the-torso position keys are dropped. Frames 0 to total_frames - 1 at
    u = f / total_frames, as before, so every clip keeps its length.
    """
    rig.animation_data_create()
    action = bpy.data.actions.new(name=action_name)
    rig.animation_data.action = action
    hips = rig.pose.bones["Hips"]

    for f in range(total_frames):
        pose = sample_fn(f / float(total_frames))
        torso_inv = Euler(pose["Torso"]["rot"], "XZY").to_quaternion().inverted()
        for p_name, trans in pose.items():
            q = Euler(trans["rot"], "XZY").to_quaternion()
            if p_name == "HeadGroup" or (p_name in ARM_BONES and action_name != "SpinSlash"):
                q = torso_inv @ q
            pb = rig.pose.bones[p_name]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
        left, right = pose["LeftLegPivot"].get("pos"), pose["RightLegPivot"].get("pos")
        if left != right:
            raise ValueError(f"{action_name} frame {f}: the legs' position keys differ ({left} and {right}); one Hips track cannot carry both")
        if left is not None:
            hips.location = Vector(left)
            hips.keyframe_insert(data_path="location", frame=f)

    track = rig.animation_data.nla_tracks.new()
    track.name = action_name
    strip = track.strips.new(action_name, 0, action)
    strip.name = action_name
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()


def build_all_animations(rig):
    # 1. Idle (Heroic warrior stance, elbows bent forward, arms tucked inward along flank)
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
                "rot": (0.10 + breath * 0.015, 0.05, 0.28 - sway * 0.02),
                "pos": (sway_x, bob, 0.0),
            },
            "RightArmPivot": {
                "rot": (0.10 + breath * 0.015, -0.05, -0.28 + sway * 0.02),
                "pos": (sway_x, bob, 0.0),
            },
            "LeftElbowPivot": {"rot": (0.60 + breath * 0.03, -0.05, 0.0)},
            "RightElbowPivot": {"rot": (0.50 + breath * 0.03, 0.05, 0.0)},
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

    build_action(rig, "Idle", 48, sample_idle)

    # 2. Walk Cycle (Fluid warrior stride, elbows bent forward, arms swinging along flanks)
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

        arm_swing = 0.45
        elbow_swing = 0.25

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
                "rot": (0.10 + r_stride * arm_swing, 0.05, 0.28),
                "pos": (sway * 0.5, dip, 0.0),
            },
            "RightArmPivot": {
                "rot": (0.10 + l_stride * arm_swing, -0.05, -0.28),
                "pos": (sway * 0.5, dip, 0.0),
            },
            "LeftElbowPivot": {
                "rot": (0.45 + max(0.0, r_stride) * elbow_swing, 0.0, 0.0),
            },
            "RightElbowPivot": {
                "rot": (0.45 + max(0.0, l_stride) * elbow_swing, 0.0, 0.0),
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

    build_action(rig, "Walk", 32, sample_walk)

    # 3. Slash
    def sample_slash(u: float):
        if u < 0.28:
            t = u / 0.28
            r_arm_x = 0.10 - t * 0.75
            r_arm_y = -0.05 - t * 0.35
            r_arm_z = -0.28 + t * 0.45
            torso_yaw = -t * 0.42
            torso_pitch = 0.04
        elif u < 0.48:
            t = (u - 0.28) / 0.20
            strike = math.sin(t * math.pi * 0.5)
            r_arm_x = -0.65 + strike * 1.85
            r_arm_y = -0.40 + strike * 0.85
            r_arm_z = 0.17 - strike * 0.45
            torso_yaw = -0.42 + strike * 0.95
            torso_pitch = 0.04 + strike * 0.14
        else:
            t = (u - 0.48) / 0.52
            decay = math.exp(-t * 3.5)
            r_arm_x = 1.20 * decay + 0.10 * (1 - decay)
            r_arm_y = 0.45 * decay - 0.05 * (1 - decay)
            r_arm_z = -0.28
            torso_yaw = 0.53 * decay
            torso_pitch = 0.18 * decay

        decay_val = math.exp(-max(0.0, u - 0.48) / 0.52 * 3.5) if u >= 0.48 else 1.0
        return {
            "Torso": {"rot": (torso_pitch, torso_yaw, 0.0), "pos": (0.0, 0.0, 0.0)},
            "HeadGroup": {"rot": (0.0, -torso_yaw * 0.5, 0.0), "pos": (0.0, 0.0, 0.0)},
            "RightArmPivot": {"rot": (r_arm_x, r_arm_y, r_arm_z)},
            "RightElbowPivot": {"rot": (0.45 * decay_val + 0.50 * (1 - decay_val), 0.0, 0.0)},
            "LeftArmPivot": {"rot": (0.12, 0.10, 0.28)},
            "LeftElbowPivot": {"rot": (0.65, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.12, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.18, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.10, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.12, 0.0, 0.0)},
        }

    build_action(rig, "Slash", 24, sample_slash)

    # 4. Lunge
    def sample_lunge(u: float):
        thrust = math.sin(u * math.pi)
        return {
            "Torso": {"rot": (0.24 * thrust, 0.0, 0.0), "pos": (0.0, -0.06 * thrust, -0.16 * thrust)},
            "HeadGroup": {"rot": (-0.15 * thrust, 0.0, 0.0)},
            "RightArmPivot": {"rot": (0.10 * (1 - thrust) + 1.15 * thrust, 0.0, -0.28 * (1 - thrust) - 0.10 * thrust)},
            "RightElbowPivot": {"rot": (0.50 * (1 - thrust) + 0.15 * thrust, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (0.10 * (1 - thrust) - 0.35 * thrust, 0.12, 0.28)},
            "LeftElbowPivot": {"rot": (0.60, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.35 * thrust, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.45 * thrust, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.28 * thrust, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.08 * thrust, 0.0, 0.0)},
        }

    build_action(rig, "Lunge", 24, sample_lunge)

    # 5. Ranged
    def sample_ranged(u: float):
        draw = math.sin(u * math.pi) if u < 0.70 else max(0.0, 1.0 - (u - 0.70) / 0.30)
        return {
            "Torso": {"rot": (0.04, -0.55 * draw, 0.0)},
            "HeadGroup": {"rot": (0.0, 0.45 * draw, 0.0)},
            "LeftArmPivot": {"rot": (0.10 * (1 - draw) + 1.45 * draw, 0.05 * (1 - draw) - 0.20 * draw, 0.28 * (1 - draw) + 0.10 * draw)},
            "LeftElbowPivot": {"rot": (0.60 * (1 - draw) + 0.15 * draw, 0.0, 0.0)},
            "RightArmPivot": {"rot": (0.10 * (1 - draw) + 1.25 * draw, -0.05 * (1 - draw) + 0.25 * draw, -0.28 * (1 - draw) - 0.15 * draw)},
            "RightElbowPivot": {"rot": (0.50 * (1 - draw) + 1.25 * draw, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.12 * draw, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.18 * draw, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.06 * draw, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.08 * draw, 0.0, 0.0)},
        }

    build_action(rig, "Ranged", 30, sample_ranged)

    # 6. Cast
    def sample_cast(u: float):
        t = math.sin(u * math.pi)
        pulse = math.sin(u * 4.0 * math.pi) * 0.08
        return {
            "Torso": {"rot": (-0.12 * t, 0.0, 0.0), "pos": (0.0, 0.04 * t, 0.0)},
            "HeadGroup": {"rot": (0.18 * t, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (0.10 * (1 - t) + 1.45 * t + pulse, 0.05 * (1 - t) - 0.20 * t, 0.28 * (1 - t) + 0.15 * t)},
            "RightArmPivot": {"rot": (0.10 * (1 - t) + 1.45 * t + pulse, -0.05 * (1 - t) + 0.20 * t, -0.28 * (1 - t) - 0.15 * t)},
            "LeftElbowPivot": {"rot": (0.60 * (1 - t) + 0.45 * t, 0.0, 0.0)},
            "RightElbowPivot": {"rot": (0.50 * (1 - t) + 0.45 * t, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.0, 0.0, -0.05 * t)},
            "RightLegPivot": {"rot": (0.0, 0.0, 0.05 * t)},
            "LeftKneePivot": {"rot": (0.0, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.0, 0.0, 0.0)},
        }

    build_action(rig, "Cast", 28, sample_cast)

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
            "RightArmPivot": {"rot": (0.10 * (1 - t) + arm, 0.10, -0.20)},
            "LeftArmPivot": {"rot": (0.10 * (1 - t) + arm * 0.85, -0.15, 0.20)},
            "RightElbowPivot": {"rot": (0.55, 0.0, 0.0)},
            "LeftElbowPivot": {"rot": (0.65, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.12, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.12, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.10, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.10, 0.0, 0.0)},
        }

    build_action(rig, "Chop", 26, sample_chop)

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
            "RightArmPivot": {"rot": (0.10 * (1 - t) + arm, 0.15, -0.20)},
            "RightElbowPivot": {"rot": (0.60, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (0.15, 0.10, 0.28)},
            "LeftElbowPivot": {"rot": (0.65, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.15, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.15, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.12, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.12, 0.0, 0.0)},
        }

    build_action(rig, "Mine", 24, sample_mine)

    # 9. Fish
    def sample_fish(u: float):
        bob = math.sin(u * 2.0 * math.pi) * 0.05
        tug = math.sin(u * 6.0 * math.pi) * 0.02
        return {
            "Torso": {"rot": (0.04 + bob * 0.3, 0.0, 0.0)},
            "HeadGroup": {"rot": (0.08, 0.0, 0.0)},
            "RightArmPivot": {"rot": (0.70 + bob + tug, 0.10, -0.20)},
            "LeftArmPivot": {"rot": (0.60 + bob + tug, -0.12, 0.20)},
            "RightElbowPivot": {"rot": (0.55, 0.0, 0.0)},
            "LeftElbowPivot": {"rot": (0.65, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.0, 0.0, 0.0)},
            "RightLegPivot": {"rot": (0.0, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (0.0, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.0, 0.0, 0.0)},
        }

    build_action(rig, "Fish", 36, sample_fish)

    # 10. SpinSlash
    def sample_spin(u: float):
        spin_yaw = u * 4.0 * math.pi
        arm_out = 1.35 + math.sin(u * 2.0 * math.pi) * 0.15
        return {
            "Torso": {"rot": (0.12, spin_yaw, 0.0)},
            "HeadGroup": {"rot": (0.0, spin_yaw * 0.85, 0.0)},
            "RightArmPivot": {"rot": (arm_out, 0.0, 0.35)},
            "LeftArmPivot": {"rot": (arm_out, 0.0, -0.35)},
            "RightElbowPivot": {"rot": (0.35, 0.0, 0.0)},
            "LeftElbowPivot": {"rot": (0.35, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (-0.08, 0.0, 0.0)},
            "RightLegPivot": {"rot": (0.08, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.15, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.15, 0.0, 0.0)},
        }

    build_action(rig, "SpinSlash", 24, sample_spin)


def main():
    kai_dir = os.path.join(paths.out_dir(), "kai")
    kai_blend = os.path.join(kai_dir, "kaiV2.blend")

    if not os.path.exists(kai_blend):
        zip_path = paths.source("Game Anime RPG Character.zip")
        if os.path.exists(zip_path):
            paths.extract_zip(zip_path, kai_dir)

    # 1. Open kaiV2.blend natively
    bpy.ops.wm.open_mainfile(filepath=kai_blend)

    # 2. The author's joints: bone heads at rest, through the same transform as the mesh (design 3.5 S14).
    #    The source armature is read, not exported: the rig below is built at its joints.
    src_rig = bpy.data.objects["Armature"]
    heads = {b.name: to_figure(src_rig.matrix_world @ b.head_local) for b in src_rig.data.bones}
    joints = {bone: heads[src] for bone, src in JOINT_OF.items()}
    joints["Root"] = Vector((0.0, 0.0, 0.0))
    for name in ['Camera', 'Lamp', 'Armature']:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    for action in list(bpy.data.actions):  # the source's own actions target the author's bones; exported per action below
        bpy.data.actions.remove(action)

    # 3. Meshes into the figure's space, bind pose = the source's own pose (no re-pose, decision N-5).
    #    The armature and solidify modifiers are dropped, as before.
    for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        obj.modifiers.clear()
        mw = obj.matrix_world.copy()
        for v in obj.data.vertices:
            v.co = to_figure(mw @ v.co)
        obj.parent = None
        obj.matrix_world.identity()
        obj.data.update()

    # 4. One mesh per engine role. The coat's sleeves are the faces most of whose vertices the upper or lower
    #    arm holds by more than 0.3, away from the centre line (the vertex rule the pivot build used).
    coat_src, coat_spec, sleeve_spec = COAT
    coat = bpy.data.objects[coat_src]
    arm_groups = {vg.index for vg in coat.vertex_groups if vg.name.split("_")[0] in ("upperArm", "lowerArm")}

    def in_sleeve(face, dl):
        hits = sum(1 for v in face.verts if abs(v.co.x) > 0.05 and any(g in arm_groups and w > 0.3 for g, w in v[dl].items()))
        return 2 * hits > len(face.verts)

    sleeves, torso_coat = split_faces(coat, in_sleeve, sleeve_spec[0], coat_spec[0])
    specs = {sleeves: sleeve_spec, torso_coat: coat_spec}
    for src, spec in MESHES.items():
        obj = bpy.data.objects[src]
        obj.name = spec[0]
        specs[obj] = spec

    # 5. Rig at the author's joints, every bone pointing up with roll 0, root at the origin (design 6.1.1).
    rig = figkit.make_rig("HeroRoot", rigs.BIPED_TABLE, joints)

    # 6. Weights: the author's, folded onto the biped bones; hair and eyes rigid on the head bone.
    for obj, (name, part, no_outline) in specs.items():
        obj.data.name = name
        if name in RIGID_ON_HEAD:
            figkit.hard_weights(obj, "HeadGroup")
        else:
            # the source leaves 4 coat vertices unweighted (design 3.5 S14); they go on Torso
            figkit.fold_weights(obj, FOLD, unweighted_to="Torso" if obj in (sleeves, torso_coat) else None)
        while obj.data.color_attributes:  # paint is H3b's; this build carries no COLOR_0
            obj.data.color_attributes.remove(obj.data.color_attributes[0])
        obj.data.materials.clear()
        mat = bpy.data.materials.new(name=f"Mat_{name}")
        tree = mat.node_tree
        tree.nodes.clear()
        bsdf = tree.nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = COLOURS[name]
        bsdf.inputs['Roughness'].default_value = 0.55
        bsdf.inputs['Specular IOR Level'].default_value = 0.20
        tree.links.new(bsdf.outputs['BSDF'], tree.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])
        obj.data.materials.append(mat)
        obj["part"] = part
        if no_outline:
            obj["noOutline"] = True
        obj.parent = rig
        obj.modifiers.new("Armature", "ARMATURE").object = rig
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        held = sorted({obj.vertex_groups[g.group].name for v in obj.data.vertices for g in v.groups if g.weight > 0.01})
        print(f"[BlenderHero] {name}: {len(obj.data.vertices)} vertices, {tris} triangles, bones {held}")

    # 7. The ten clips on the bones
    build_all_animations(rig)

    # 8. Save blend and export GLB (rotation-only clips plus Hips, skins, no UVs: design 6.1, 6.3)
    blend_path = paths.blend_path("hero")
    glb_path = paths.glb_path("hero")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    # One animation per action: in NLA_TRACKS mode the exporter bakes, cannot tell a keyed channel from an
    # unkeyed one, and drops every channel that holds one value through a clip (Slash's left elbow, legs and
    # knees), so those bones would fall back to their rest pose in the game.
    figkit.export_glb(glb_path, export_animation_mode="ACTIONS")
    print(f"[BlenderHero] Exported the skinned Kai RPG character to {blend_path} and {glb_path}")


if __name__ == '__main__':
    main()
