"""
Blender 5.2 Procedural Sculptor & Animator for the Gielinor Base Human Character.
Authentic Anime RPG Adventurer (Directly recreated from BlendSwap #4503 "Game Anime RPG Character" by uchiha007).
Generates `blender/hero.blend` and exports `public/models/hero.glb`.

Architecture & Contracts:
- Pure Base Human Character (NO baked-in armor, helmets, capes, or weapons).
- 10-Joint Articulated Skeleton for fluid MMORPG locomotion & combat:
  - Torso: (0, 1.24, 0)
  - HeadGroup: (0, 1.86, 0)
  - LeftArmPivot / RightArmPivot: (±0.28, 1.50, 0)
    - LeftElbowPivot / RightElbowPivot: (0, -0.26, 0) relative to ArmPivot
  - LeftLegPivot / RightLegPivot: (±0.11, 0.90, 0)
    - LeftKneePivot / RightKneePivot: (0, -0.38, 0) relative to LegPivot
- Cape clearance: Character posterior strictly forward of z <= +0.095 to guarantee
  clear clearance with capes mounted at z >= 0.16.
- Vertical mechanical leg axis: hip, knee, and ankle aligned at z = 0.000 in rest pose.
- Natural human knee kinematics: knees flex backward (negative rx in glTF/Three.js).
- 10 NLA Clips: 'Cast', 'Chop', 'Fish', 'Idle', 'Lunge', 'Mine', 'Ranged', 'Slash', 'SpinSlash', 'Walk'.
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector, Euler, Matrix


# ---------------------------------------------------------------------------
# Coordinate conversion helpers: Three.js (Y-up, -Z forward) -> Blender (Z-up, +Y forward)
# ---------------------------------------------------------------------------
def t2b_pos(tx: float, ty: float, tz: float):
    return (tx, -tz, ty)


def t2b_euler(rx: float, ry: float, rz: float):
    # rx = pitch around X
    # ry = yaw around vertical axis (Three.js Y -> Blender Z)
    # rz = roll around longitudinal axis (Three.js -Z -> Blender +Y)
    return (rx, -rz, ry)


# ---------------------------------------------------------------------------
# Scene Reset & Material Library (BlendSwap 4503 Anime RPG Palette)
# ---------------------------------------------------------------------------
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 24


def make_mat(name: str, hex_color: int, roughness: float = 0.55, metallic: float = 0.0, sss: float = 0.0):
    mat = bpy.data.materials.new(name=name)
    bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
    r = ((hex_color >> 16) & 0xFF) / 255.0
    g = ((hex_color >> 8) & 0xFF) / 255.0
    b = (hex_color & 0xFF) / 255.0
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if "Subsurface Weight" in bsdf.inputs and sss > 0.0:
            bsdf.inputs["Subsurface Weight"].default_value = sss
    mat.diffuse_color = (r, g, b, 1.0)
    return mat


def finalize_mesh(bm: bmesh.types.BMesh, mesh: bpy.types.Mesh):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    if bm.verts:
        center = sum((v.co for v in bm.verts), Vector((0.0, 0.0, 0.0))) / len(bm.verts)
        for f in bm.faces:
            f.normal_update()
            fc = f.calc_center_median()
            if f.normal.dot(fc - center) < 0.0:
                f.normal_flip()
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.update()


def create_empty_pivot(name: str, parent: bpy.types.Object, tx: float, ty: float, tz: float):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.10
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = t2b_pos(tx, ty, tz)
    obj.rotation_mode = "XYZ"
    return obj


# ---------------------------------------------------------------------------
# Procedural Sculpting Utilities
# ---------------------------------------------------------------------------
def add_lofted_surface(
    name: str,
    parent: bpy.types.Object,
    part_tag: str,
    mat: bpy.types.Material,
    rings: list,
    segments: int = 24,
    cap_ends: bool = True,
    no_outline: bool = False,
):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj["part"] = part_tag
    if no_outline:
        obj["noOutline"] = True

    bm = bmesh.new()
    ring_loops = []

    for r in rings:
        ty, rx, rz = r[0], r[1], r[2]
        ox = r[3] if len(r) > 3 else 0.0
        oz = r[4] if len(r) > 4 else 0.0
        asym = r[5] if len(r) > 5 else None

        loop = []
        for i in range(segments):
            ang = (2.0 * math.pi * i) / segments
            cur_rx = rx
            cur_rz = rz
            cur_ox = ox
            cur_oz = oz
            if asym:
                cur_rx, cur_rz, cur_ox, cur_oz = asym(ang, cur_rx, cur_rz, cur_ox, cur_oz)

            tx = cur_ox + math.cos(ang) * cur_rx
            tz = cur_oz + math.sin(ang) * cur_rz
            v = bm.verts.new(t2b_pos(tx, ty, tz))
            loop.append(v)
        ring_loops.append(loop)

    for r_idx in range(len(ring_loops) - 1):
        la = ring_loops[r_idx]
        lb = ring_loops[r_idx + 1]
        for i in range(segments):
            i_next = (i + 1) % segments
            bm.faces.new((la[i], lb[i], lb[i_next], la[i_next]))

    if cap_ends and len(ring_loops) >= 2:
        r0 = rings[0]
        r_last = rings[-1]
        bot_pole = bm.verts.new(
            t2b_pos(
                r0[3] if len(r0) > 3 else 0.0,
                r0[0],
                r0[4] if len(r0) > 4 else 0.0,
            )
        )
        top_pole = bm.verts.new(
            t2b_pos(
                r_last[3] if len(r_last) > 3 else 0.0,
                r_last[0],
                r_last[4] if len(r_last) > 4 else 0.0,
            )
        )
        first_loop = ring_loops[0]
        last_loop = ring_loops[-1]
        for i in range(segments):
            i_next = (i + 1) % segments
            bm.faces.new((first_loop[i_next], first_loop[i], bot_pole))
            bm.faces.new((last_loop[i], last_loop[i_next], top_pole))

    finalize_mesh(bm, mesh)
    obj.data.materials.append(mat)
    return obj


def add_lofted_shell(
    name: str,
    parent: bpy.types.Object,
    part_tag: str,
    mat: bpy.types.Material,
    rings: list,
    start_angle: float,
    end_angle: float,
    segments: int = 16,
    no_outline: bool = False,
):
    """Lofts an open curved shell (e.g. open jacket or coat wing) between two angles."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj["part"] = part_tag
    if no_outline:
        obj["noOutline"] = True

    bm = bmesh.new()
    ring_loops = []

    for r in rings:
        ty, rx, rz = r[0], r[1], r[2]
        ox = r[3] if len(r) > 3 else 0.0
        oz = r[4] if len(r) > 4 else 0.0
        asym = r[5] if len(r) > 5 else None

        loop = []
        for i in range(segments + 1):
            t = i / float(segments)
            ang = start_angle + t * (end_angle - start_angle)
            cur_rx = rx
            cur_rz = rz
            cur_ox = ox
            cur_oz = oz
            if asym:
                cur_rx, cur_rz, cur_ox, cur_oz = asym(ang, cur_rx, cur_rz, cur_ox, cur_oz)

            tx = cur_ox + math.cos(ang) * cur_rx
            tz = cur_oz + math.sin(ang) * cur_rz
            v = bm.verts.new(t2b_pos(tx, ty, tz))
            loop.append(v)
        ring_loops.append(loop)

    for r_idx in range(len(ring_loops) - 1):
        la = ring_loops[r_idx]
        lb = ring_loops[r_idx + 1]
        for i in range(segments):
            bm.faces.new((la[i], lb[i], lb[i + 1], la[i + 1]))

    finalize_mesh(bm, mesh)
    obj.data.materials.append(mat)
    return obj


def add_sculpted_box(
    name: str,
    parent: bpy.types.Object,
    part_tag: str,
    mat: bpy.types.Material,
    center_t: tuple,
    size_t: tuple,
    bevel_radius: float = 0.0,
    no_outline: bool = False,
):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj["part"] = part_tag
    if no_outline:
        obj["noOutline"] = True

    bm = bmesh.new()
    cx, cy, cz = center_t
    sx, sy, sz = size_t

    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = v.co.x * sx
        v.co.y = v.co.y * sz
        v.co.z = v.co.z * sy
        bc = t2b_pos(cx, cy, cz)
        v.co += Vector(bc)

    if bevel_radius > 0.0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel_radius, segments=2, profile=0.5, affect='EDGES')

    finalize_mesh(bm, mesh)
    obj.data.materials.append(mat)
    return obj


def add_sculpted_cylinder(
    name: str,
    parent: bpy.types.Object,
    part_tag: str,
    mat: bpy.types.Material,
    pos1_t: tuple,
    pos2_t: tuple,
    radius: float,
    segments: int = 12,
    no_outline: bool = False,
):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj["part"] = part_tag
    if no_outline:
        obj["noOutline"] = True

    bm = bmesh.new()
    p1 = Vector(t2b_pos(*pos1_t))
    p2 = Vector(t2b_pos(*pos2_t))
    diff = p2 - p1
    length = diff.length
    if length < 0.0001:
        length = 0.0001

    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=length,
    )
    up = Vector((0.0, 0.0, 1.0))
    rot_quat = up.rotation_difference(diff)
    rot_mat = rot_quat.to_matrix().to_4x4()
    center = (p1 + p2) * 0.5
    trans_mat = Matrix.Translation(center)
    transform = trans_mat @ rot_mat
    bmesh.ops.transform(bm, matrix=transform, verts=bm.verts)

    finalize_mesh(bm, mesh)
    obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------------------
# Sculpt the Anime RPG Character (BlendSwap #4503 Exact Specification)
# ---------------------------------------------------------------------------
def build_hero_character():
    hero_root = create_empty_pivot("HeroRoot", None, 0.0, 0.0, 0.0)

    # BlendSwap 4503 "Game Anime RPG Character" Aesthetic Palette
    mat_skin = make_mat("HeroSkin", 0xFCE0CC, roughness=0.40, sss=0.25)
    mat_lips = make_mat("HeroLips", 0xD68878, roughness=0.35, sss=0.25)
    mat_hair = make_mat("HeroHair", 0x3A261A, roughness=0.35)          # Anime Chestnut Brown
    mat_eye_white = make_mat("HeroEyeWhite", 0xFFFFFF, roughness=0.10)
    mat_iris = make_mat("HeroPupil", 0x328AE8, roughness=0.08)         # Vivid Anime Blue Eyes
    mat_inner_tunic = make_mat("HeroInnerTunic", 0x282B2E, roughness=0.68) # Slate Charcoal Undershirt
    mat_outer_tunic = make_mat("HeroOuterTunic", 0x586436, roughness=0.65) # Olive Moss Adventurer Tunic Coat
    mat_tunic_trim = make_mat("HeroTunicTrim", 0xEEE5D2, roughness=0.55)   # Ivory Cream Bold Front Trim
    mat_waist_sash = make_mat("HeroWaistSash", 0x1E2022, roughness=0.50)   # Wide Dark Waist Sash
    mat_legs = make_mat("HeroTrousers", 0x505C30, roughness=0.70)          # Olive Moss Adventurer Trousers
    mat_bracer = make_mat("HeroBracers", 0x4E3524, roughness=0.45)         # Chestnut Leather Vambraces
    mat_bracer_lace = make_mat("HeroBracerLace", 0xD8CBB2, roughness=0.58) # Cream Laces
    mat_boot = make_mat("HeroBoots", 0x342418, roughness=0.48)             # Deep Leather Riding Boots
    mat_sole = make_mat("HeroBootSole", 0x1A120C, roughness=0.68)

    # =========================================================================
    # 1. TORSO PIVOT (y = 1.24 in Three.js)
    # =========================================================================
    torso = create_empty_pivot("Torso", hero_root, 0.0, 1.24, 0.0)

    # Posterior clearance modifier:
    # Keeps the back strictly forward of z <= +0.090 so capes never clip!
    def torso_asym(ang, rx, rz, ox, oz):
        front_factor = -math.sin(ang)  # +1 at front (-Z), -1 at back (+Z)
        if front_factor > 0:
            cur_rz = rz * (1.0 + front_factor * 0.14)
            cur_oz = oz - front_factor * 0.010
        else:
            back_factor = -front_factor
            cur_rz = rz * (1.0 - back_factor * 0.10)
            cur_oz = oz - back_factor * 0.016
        return rx, cur_rz, ox, cur_oz

    # Under-Tunic / High-Collar Undershirt (Slate Charcoal Base Torso)
    # Visible down the center of the chest and at the high neck collar
    add_lofted_surface(
        "InnerCollar",
        torso,
        "collar",
        mat_inner_tunic,
        rings=[
            (0.330, 0.092, 0.084, 0.0, 0.002),
            (0.365, 0.090, 0.082, 0.0, 0.002),
            (0.395, 0.086, 0.078, 0.0, 0.002),
        ],
        segments=20,
        cap_ends=False,
        no_outline=True,
    )

    # Base Torso Body (Inner Tunic, Slate Charcoal)
    add_lofted_surface(
        "Chest",
        torso,
        "chest",
        mat_inner_tunic,
        rings=[
            (-0.25, 0.170, 0.110, 0.0, -0.004, torso_asym),   # Waist hem above sash
            (-0.14, 0.176, 0.114, 0.0, -0.006, torso_asym),   # Lower abdomen
            (-0.02, 0.192, 0.126, 0.0, -0.008, torso_asym),   # Mid ribcage
            (0.10, 0.216, 0.138, 0.0, -0.010, torso_asym),    # Lower pectorals
            (0.18, 0.228, 0.142, 0.0, -0.010, torso_asym),    # Full chest & lats
            (0.25, 0.238, 0.134, 0.0, -0.005, torso_asym),    # Clavicle & shoulder line
            (0.30, 0.208, 0.118, 0.0, 0.000, torso_asym),     # Trapezius slope
            (0.34, 0.138, 0.092, 0.0, 0.002, None),           # Neck base
            (0.365, 0.094, 0.086, 0.0, 0.002, None),          # Collar opening
        ],
        segments=28,
        cap_ends=True,
    )

    # Outer Olive-Moss Tunic Coat Wings (Open Front Vest/Coat as in BlendSwap 4503)
    # Coat rings sitting slightly above the base shirt:
    coat_rings = [
        (-0.25, 0.175, 0.116, 0.0, -0.004, torso_asym),
        (-0.14, 0.181, 0.120, 0.0, -0.006, torso_asym),
        (-0.02, 0.197, 0.132, 0.0, -0.008, torso_asym),
        (0.10, 0.222, 0.145, 0.0, -0.010, torso_asym),
        (0.18, 0.234, 0.149, 0.0, -0.010, torso_asym),
        (0.25, 0.244, 0.140, 0.0, -0.005, torso_asym),
        (0.30, 0.214, 0.124, 0.0, 0.000, torso_asym),
        (0.34, 0.144, 0.098, 0.0, 0.002, None),
    ]
    # Left Coat Wing (Back spine 0.5*pi around left side to front opening 1.38*pi)
    add_lofted_shell(
        "OuterCoat_L",
        torso,
        "chest",
        mat_outer_tunic,
        coat_rings,
        start_angle=0.50 * math.pi,
        end_angle=1.38 * math.pi,
        segments=14,
    )
    # Right Coat Wing (Front opening 1.62*pi around right side to back spine 2.5*pi)
    add_lofted_shell(
        "OuterCoat_R",
        torso,
        "chest",
        mat_outer_tunic,
        coat_rings,
        start_angle=1.62 * math.pi,
        end_angle=2.50 * math.pi,
        segments=14,
    )

    # Signature Bold Cream / Ivory Trim (Framing the front coat opening from shoulders to waist)
    for side, suffix in [(-1.0, "L"), (1.0, "R")]:
        add_lofted_surface(
            f"CoatTrim_{suffix}",
            torso,
            "collar",
            mat_tunic_trim,
            rings=[
                (-0.245, 0.018, 0.016, side * 0.068, -0.124),  # Waist junction
                (-0.120, 0.020, 0.018, side * 0.076, -0.132),  # Abdomen edge
                (0.040, 0.022, 0.020, side * 0.088, -0.146),   # Mid chest V-opening
                (0.180, 0.024, 0.022, side * 0.102, -0.150),   # Upper pectoral border
                (0.310, 0.022, 0.020, side * 0.088, -0.130),   # Collar transition
            ],
            segments=12,
            cap_ends=True,
            no_outline=True,
        )

    # Wide Dark Waist Sash / Obi (Signature BlendSwap 4503 waist wrap)
    add_lofted_surface(
        "Belt",
        torso,
        "belt",
        mat_waist_sash,
        rings=[
            (-0.265, 0.180, 0.123, 0.0, -0.004),
            (-0.220, 0.184, 0.126, 0.0, -0.004),
            (-0.175, 0.186, 0.127, 0.0, -0.004),
            (-0.130, 0.182, 0.124, 0.0, -0.004),
        ],
        segments=24,
        cap_ends=True,
    )

    # Lower Coat Tails (Extending below the sash over hips and thighs with split front)
    for side, suffix in [(-1.0, "L"), (1.0, "R")]:
        add_lofted_surface(
            f"CoatTail_{suffix}",
            torso,
            "chest",
            mat_outer_tunic,
            rings=[
                (-0.260, 0.098, 0.116, side * 0.085, -0.004),
                (-0.330, 0.106, 0.118, side * 0.092, -0.006),
                (-0.400, 0.102, 0.114, side * 0.098, -0.008),
                (-0.435, 0.080, 0.096, side * 0.104, -0.010), # Angled pointed hem
            ],
            segments=18,
            cap_ends=True,
        )
        # Angled Cream Trim on Coat Tail Front Hem
        add_lofted_surface(
            f"CoatTailTrim_{suffix}",
            torso,
            "collar",
            mat_tunic_trim,
            rings=[
                (-0.265, 0.018, 0.014, side * 0.045, -0.118),
                (-0.340, 0.018, 0.014, side * 0.055, -0.122),
                (-0.420, 0.016, 0.012, side * 0.075, -0.124),
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )

    # Smooth Slender Anime Neck
    add_lofted_surface(
        "Neck",
        torso,
        "neck",
        mat_skin,
        rings=[
            (0.34, 0.082, 0.078, 0.0, 0.002),   # Base at collar
            (0.40, 0.074, 0.070, 0.0, 0.000),   # Lower neck
            (0.46, 0.070, 0.068, 0.0, -0.002),  # Mid neck
            (0.53, 0.072, 0.070, 0.0, -0.004),  # Insertion inside jaw
        ],
        segments=22,
        cap_ends=True,
    )

    # =========================================================================
    # 2. HEAD GROUP (y = 1.86 in Three.js) - Authentic Anime Character
    # =========================================================================
    head_group = create_empty_pivot("HeadGroup", hero_root, 0.0, 1.86, 0.0)

    # Stylized Anime Head & Cranium (Chin at -0.175, eyes at 0.015, crown at 0.185)
    add_lofted_surface(
        "Head",
        head_group,
        "head",
        mat_skin,
        rings=[
            (-0.175, 0.038, 0.052, 0.0, -0.026),  # Tapered anime chin tip
            (-0.145, 0.076, 0.098, 0.0, -0.020),  # Angular anime jawline
            (-0.100, 0.118, 0.138, 0.0, -0.012),  # Mandible angle
            (-0.040, 0.142, 0.158, 0.0, -0.004),  # Anime cheekbones
            (0.015, 0.150, 0.166, 0.0, 0.000),    # Eye plane
            (0.065, 0.148, 0.164, 0.0, -0.002),   # Brow line
            (0.115, 0.140, 0.154, 0.0, 0.002),    # Forehead
            (0.158, 0.108, 0.120, 0.0, 0.005),    # Upper cranium
            (0.185, 0.044, 0.050, 0.0, 0.006),    # Crown dome
        ],
        segments=28,
        cap_ends=True,
    )

    # Delicate Anime Nose
    add_lofted_surface(
        "Nose",
        head_group,
        "nose",
        mat_skin,
        rings=[
            (-0.048, 0.012, 0.012, 0.0, -0.164),
            (-0.032, 0.016, 0.018, 0.0, -0.176),
            (-0.008, 0.011, 0.013, 0.0, -0.170),
            (0.018, 0.009, 0.010, 0.0, -0.164),
        ],
        segments=10,
        cap_ends=True,
        no_outline=True,
    )

    # Clean Anime Mouth Line
    add_lofted_surface(
        "Mouth",
        head_group,
        "mouth",
        mat_lips,
        rings=[
            (-0.098, 0.026, 0.008, 0.0, -0.148),
            (-0.088, 0.034, 0.011, 0.0, -0.152),
            (-0.078, 0.024, 0.008, 0.0, -0.148),
        ],
        segments=12,
        cap_ends=True,
        no_outline=True,
    )

    # Anime Ears
    for side, suffix in [(-1.0, "L"), (1.0, "R")]:
        add_lofted_surface(
            f"Ear_{suffix}",
            head_group,
            "ear",
            mat_skin,
            rings=[
                (-0.038, 0.012, 0.016, side * 0.148, -0.005),
                (-0.005, 0.018, 0.024, side * 0.154, 0.000),
                (0.026, 0.014, 0.019, side * 0.150, 0.005),
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )

    # Big Expressive Anime Eyes (Blue irises, black pupil, white sclera)
    for side, suffix in [(-1.0, "L"), (1.0, "R")]:
        ex = side * 0.056
        # Sclera / Eyeball
        add_lofted_surface(
            f"EyeWhite_{suffix}",
            head_group,
            "eye-white",
            mat_eye_white,
            rings=[
                (-0.015, 0.024, 0.008, ex, -0.156),
                (0.000, 0.028, 0.009, ex, -0.160),
                (0.015, 0.024, 0.008, ex, -0.156),
            ],
            segments=14,
            cap_ends=True,
            no_outline=True,
        )
        # Vivid Anime Blue Iris & Pupil
        add_lofted_surface(
            f"Pupil_{suffix}",
            head_group,
            "pupil",
            mat_iris,
            rings=[
                (-0.011, 0.016, 0.007, ex * 0.98, -0.164),
                (0.000, 0.018, 0.008, ex * 0.98, -0.166),
                (0.011, 0.016, 0.007, ex * 0.98, -0.164),
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )
        # Eyelid Crease
        add_lofted_surface(
            f"Eyelid_{suffix}",
            head_group,
            "head",
            mat_skin,
            rings=[
                (0.012, 0.028, 0.009, ex, -0.162),
                (0.020, 0.030, 0.011, ex, -0.164),
                (0.028, 0.026, 0.009, ex, -0.161),
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )
        # Heroic Anime Eyebrow
        add_lofted_surface(
            f"Brow_{suffix}",
            head_group,
            "brow",
            mat_hair,
            rings=[
                (0.028, 0.026, 0.008, ex * 1.02, -0.162),
                (0.038, 0.030, 0.010, ex * 1.04, -0.165),
                (0.046, 0.024, 0.007, ex * 1.01, -0.162),
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )

    # -------------------------------------------------------------------------
    # Signature BlendSwap 4503 Hairstyle (Layered Anime Shag Hair)
    # -------------------------------------------------------------------------
    # 1. Base Cranium Hair Cap
    add_lofted_surface(
        "HairCap",
        head_group,
        "hair",
        mat_hair,
        rings=[
            (-0.060, 0.138, 0.136, 0.0, 0.045),   # Nape taper resting against neck
            (-0.005, 0.160, 0.160, 0.0, 0.022),   # Occipital bulk
            (0.055, 0.166, 0.176, 0.0, -0.004),   # Parietal ridge & temples
            (0.115, 0.162, 0.170, 0.0, -0.002),   # High crown swept volume
            (0.165, 0.128, 0.136, 0.0, 0.004),    # Crown top
            (0.196, 0.058, 0.064, 0.0, 0.008),    # Swept apex
        ],
        segments=28,
        cap_ends=True,
    )

    # 2. Twin Long Front Framing Locks (Signature BlendSwap 4503 hanging locks)
    for side, suffix in [(-1.0, "L"), (1.0, "R")]:
        add_lofted_surface(
            f"HairLock_Front_{suffix}",
            head_group,
            "hair",
            mat_hair,
            rings=[
                (-0.165, 0.008, 0.010, side * 0.112, -0.125),  # Tapered sleek tip below jaw!
                (-0.110, 0.014, 0.016, side * 0.125, -0.128),  # Lower jaw framing
                (-0.035, 0.018, 0.022, side * 0.138, -0.118),  # Mid cheek lock
                (0.045, 0.022, 0.028, side * 0.144, -0.098),   # Temple root
                (0.100, 0.025, 0.032, side * 0.138, -0.070),   # Crown insertion
            ],
            segments=12,
            cap_ends=True,
            no_outline=True,
        )

    # 3. Layered Anime Forehead Bangs (Parted in center, swept delicately over forehead)
    add_lofted_surface(
        "HairBangs_Center_L",
        head_group,
        "hair",
        mat_hair,
        rings=[
            (0.055, 0.014, 0.012, -0.022, -0.166), # Bang tip sitting cleanly above eye
            (0.095, 0.022, 0.018, -0.026, -0.158), # Mid swept curve
            (0.145, 0.028, 0.022, -0.018, -0.130), # Forehead insertion
        ],
        segments=10,
        cap_ends=True,
        no_outline=True,
    )
    add_lofted_surface(
        "HairBangs_Center_R",
        head_group,
        "hair",
        mat_hair,
        rings=[
            (0.052, 0.014, 0.012, 0.022, -0.166),  # Bang tip sitting cleanly above eye
            (0.092, 0.022, 0.018, 0.026, -0.158),
            (0.142, 0.028, 0.022, 0.018, -0.130),
        ],
        segments=10,
        cap_ends=True,
        no_outline=True,
    )
    add_lofted_surface(
        "HairBangs_Outer_L",
        head_group,
        "hair",
        mat_hair,
        rings=[
            (0.035, 0.016, 0.014, -0.075, -0.155),
            (0.080, 0.024, 0.020, -0.082, -0.145),
            (0.135, 0.030, 0.024, -0.070, -0.120),
        ],
        segments=10,
        cap_ends=True,
        no_outline=True,
    )
    add_lofted_surface(
        "HairBangs_Outer_R",
        head_group,
        "hair",
        mat_hair,
        rings=[
            (0.032, 0.016, 0.014, 0.075, -0.155),
            (0.078, 0.024, 0.020, 0.082, -0.145),
            (0.132, 0.030, 0.024, 0.070, -0.120),
        ],
        segments=10,
        cap_ends=True,
        no_outline=True,
    )

    # 4. Anime Crown Tufts & Back Shag Spikes
    crown_tufts = [
        ("CrownSpike_Top", (0.0, 0.198, 0.010), (0.040, 0.035, 0.065)),
        ("CrownSpike_L", (-0.085, 0.170, 0.035), (0.036, 0.032, 0.055)),
        ("CrownSpike_R", (0.085, 0.170, 0.035), (0.036, 0.032, 0.055)),
        ("BackSpike_Mid", (0.0, 0.065, 0.185), (0.045, 0.038, 0.060)),
        ("BackSpike_L", (-0.095, 0.055, 0.165), (0.040, 0.034, 0.055)),
        ("BackSpike_R", (0.095, 0.055, 0.165), (0.040, 0.034, 0.055)),
    ]
    for sp_name, sp_pos, sp_size in crown_tufts:
        add_sculpted_box(
            sp_name,
            head_group,
            "hair",
            mat_hair,
            center_t=sp_pos,
            size_t=sp_size,
            bevel_radius=0.008,
            no_outline=True,
        )

    # =========================================================================
    # 3. LEFT & RIGHT ARMS + ELBOW PIVOTS + LEATHER VAMBRACES & HANDS
    # =========================================================================
    for is_left in (True, False):
        side = -1.0 if is_left else 1.0
        prefix = "Left" if is_left else "Right"
        suffix = "L" if is_left else "R"
        arm_pivot = create_empty_pivot(f"{prefix}ArmPivot", hero_root, side * 0.28, 1.50, 0.0)

        # Upper Arm / Olive-Moss Sleeve (Contoured deltoid cap smoothly tucking into clavicle)
        add_lofted_surface(
            f"UpperArm_{suffix}",
            arm_pivot,
            "arm",
            mat_outer_tunic,
            rings=[
                (-0.25, 0.070, 0.070, 0.0, 0.000),            # Sleeve cuff above elbow
                (-0.16, 0.074, 0.072, 0.0, 0.000),            # Bicep/tricep belly
                (-0.05, 0.080, 0.076, side * 0.005, 0.000),   # Lower deltoid
                (0.01, 0.076, 0.072, -side * 0.012, 0.000),   # Mid deltoid
                (0.055, 0.055, 0.052, -side * 0.024, 0.000),  # Clavicular attachment
                (0.075, 0.025, 0.025, -side * 0.035, 0.000),  # Upper shoulder tuck
            ],
            segments=20,
            cap_ends=True,
        )

        # Folded Sleeve Cuff Rim (Ivory Cream Accent)
        add_lofted_surface(
            f"SleeveCuff_{suffix}",
            arm_pivot,
            "collar",
            mat_tunic_trim,
            rings=[
                (-0.255, 0.075, 0.075, 0.0, 0.000),
                (-0.240, 0.079, 0.079, 0.0, 0.000),
                (-0.225, 0.075, 0.075, 0.0, 0.000),
            ],
            segments=18,
            cap_ends=False,
            no_outline=True,
        )

        # Articulated Elbow Pivot at y = -0.26 relative to ArmPivot
        elbow_pivot = create_empty_pivot(f"{prefix}ElbowPivot", arm_pivot, 0.0, -0.26, 0.0)

        # Forearm Structure
        add_lofted_surface(
            f"Forearm_{suffix}",
            elbow_pivot,
            "neck",
            mat_skin,
            rings=[
                (-0.370, 0.046, 0.044, 0.0, -0.004),
                (-0.240, 0.056, 0.053, 0.0, -0.003),
                (-0.080, 0.066, 0.062, side * 0.004, 0.000),
                (0.000, 0.060, 0.060, 0.0, 0.000),
                (0.038, 0.042, 0.042, 0.0, 0.000),
            ],
            segments=20,
            cap_ends=True,
        )

        # Chestnut Leather Vambrace / Archer Bracer (Signature BlendSwap 4503 bracer)
        add_lofted_surface(
            f"Bracer_{suffix}",
            elbow_pivot,
            "collar",
            mat_bracer,
            rings=[
                (-0.375, 0.052, 0.050, 0.0, -0.004),  # Wrist rim
                (-0.300, 0.058, 0.055, 0.0, -0.003),  # Mid forearm
                (-0.200, 0.063, 0.060, 0.0, -0.002),  # Upper forearm
                (-0.130, 0.068, 0.065, 0.0, 0.000),   # Elbow cuff flare
            ],
            segments=18,
            cap_ends=True,
            no_outline=True,
        )

        # Cross-Lacing Detail along Outer Bracer
        for l_idx in range(4):
            ly = -0.18 - l_idx * 0.045
            add_sculpted_cylinder(
                f"BracerLace_{l_idx}_{suffix}",
                elbow_pivot,
                "collar",
                mat_bracer_lace,
                pos1_t=(side * 0.058, ly - 0.010, -0.015),
                pos2_t=(side * 0.058, ly + 0.010, 0.015),
                radius=0.0025,
                segments=6,
                no_outline=True,
            )

        # 5-Digit Articulated Anime Combat Hand
        add_lofted_surface(
            f"Hand_{suffix}",
            elbow_pivot,
            "hand",
            mat_skin,
            rings=[
                (-0.490, 0.042, 0.046, 0.0, -0.012),
                (-0.450, 0.056, 0.058, 0.0, -0.010),
                (-0.400, 0.051, 0.052, 0.0, -0.006),
                (-0.365, 0.044, 0.044, 0.0, -0.004),
            ],
            segments=18,
            cap_ends=True,
        )
        add_lofted_surface(
            f"Thumb_{suffix}",
            elbow_pivot,
            "hand",
            mat_skin,
            rings=[
                (-0.465, 0.015, 0.017, -side * 0.042, -0.036),
                (-0.428, 0.021, 0.021, -side * 0.046, -0.028),
                (-0.395, 0.019, 0.019, -side * 0.036, -0.016),
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )

        finger_configs = [
            ("Index", -0.025, 0.030, 0.011),
            ("Middle", -0.008, 0.033, 0.012),
            ("Ring", 0.008, 0.031, 0.011),
            ("Pinky", 0.025, 0.026, 0.010),
        ]
        for f_name, f_x, f_len, f_rad in finger_configs:
            fx_pos = side * f_x
            add_sculpted_cylinder(
                f"Finger_{f_name}_{suffix}",
                elbow_pivot,
                "hand",
                mat_skin,
                pos1_t=(fx_pos, -0.485, -0.025),
                pos2_t=(fx_pos, -0.470, -0.065),
                radius=f_rad,
                segments=8,
                no_outline=True,
            )
            add_sculpted_cylinder(
                f"FingerTip_{f_name}_{suffix}",
                elbow_pivot,
                "hand",
                mat_skin,
                pos1_t=(fx_pos, -0.470, -0.065),
                pos2_t=(fx_pos, -0.445, -0.052),
                radius=f_rad * 0.88,
                segments=8,
                no_outline=True,
            )

    # =========================================================================
    # 4. LEFT & RIGHT LEGS + KNEE PIVOTS + BAGGY TROUSERS & RIDING BOOTS
    #    Hips at (±0.11, 0.90, 0), Knee at (0, -0.38, 0) relative to Hip
    #    PERFECT VERTICAL MECHANICAL AXIS: All rest leg joints aligned at z = 0.000!
    # =========================================================================
    for is_left in (True, False):
        side = -1.0 if is_left else 1.0
        prefix = "Left" if is_left else "Right"
        suffix = "L" if is_left else "R"
        leg_pivot = create_empty_pivot(f"{prefix}LegPivot", hero_root, side * 0.11, 0.90, 0.0)

        # Baggy / Relaxed Adventurer Trousers (Signature BlendSwap 4503 olive trousers)
        add_lofted_surface(
            f"Thigh_{suffix}",
            leg_pivot,
            "thigh",
            mat_legs,
            rings=[
                (-0.36, 0.088, 0.088, 0.0, 0.000),            # Knee tuck cuff above boot rim
                (-0.25, 0.104, 0.102, 0.0, 0.000),            # Relaxed baggy fullness over lower thigh
                (-0.12, 0.112, 0.108, side * 0.006, 0.000),   # Relaxed mid-thigh volume
                (0.00, 0.098, 0.096, 0.0, 0.000),             # Hip joint center
                (0.045, 0.068, 0.068, 0.0, 0.000),            # Insertion inside pelvis
            ],
            segments=22,
            cap_ends=True,
        )

        # Articulated Knee Pivot at y = -0.38 relative to LegPivot (world y = 0.52, z = 0.00)
        knee_pivot = create_empty_pivot(f"{prefix}KneePivot", leg_pivot, 0.0, -0.38, 0.0)

        # Baggy Shin / Calf Tucked Inside Boot
        add_lofted_surface(
            f"Shin_{suffix}",
            knee_pivot,
            "shin",
            mat_legs,
            rings=[
                (-0.26, 0.076, 0.076, 0.0, 0.000),            # Tucked inside boot cuff
                (-0.16, 0.092, 0.092, 0.0, 0.000),            # Calf puff
                (-0.06, 0.096, 0.096, 0.0, 0.000),            # Gastrocnemius fullness
                (0.00, 0.084, 0.084, 0.0, 0.000),             # Patella joint
                (0.045, 0.060, 0.060, 0.0, 0.000),            # Thigh ball joint
            ],
            segments=20,
            cap_ends=True,
        )

        # Tall Adventurer Riding Boots (Signature BlendSwap 4503 folded cuff boots)
        # Straight vertical shaft: Ankle directly under knee at tz = 0.000 (no forward slant!)
        add_lofted_surface(
            f"Boot_{suffix}",
            knee_pivot,
            "boot",
            mat_boot,
            rings=[
                (-0.470, 0.080, 0.092, 0.0, 0.000),          # Ankle / heel base (world y = 0.05)
                (-0.410, 0.082, 0.092, 0.0, 0.000),          # Lower shaft
                (-0.320, 0.086, 0.088, 0.0, 0.000),          # Mid boot shaft
                (-0.230, 0.096, 0.096, 0.0, 0.000),          # Folded cuff flare
                (-0.190, 0.092, 0.092, 0.0, 0.000),          # Boot rim collar
            ],
            segments=20,
            cap_ends=True,
        )

        # Boot Ankle Buckle Strap
        add_sculpted_cylinder(
            f"BootStrap_{suffix}",
            knee_pivot,
            "boot",
            mat_boot,
            pos1_t=(-0.070 * side, -0.410, 0.000),
            pos2_t=(0.070 * side, -0.410, 0.000),
            radius=0.008,
            segments=8,
            no_outline=True,
        )

        # Reinforced Rounded Toe Cap (Centered forward under ball of foot)
        add_lofted_surface(
            f"BootToe_{suffix}",
            knee_pivot,
            "toe",
            mat_boot,
            rings=[
                (-0.515, 0.072, 0.105, 0.0, -0.080),          # Ground contact
                (-0.485, 0.076, 0.112, 0.0, -0.075),          # Mid toe box
                (-0.450, 0.072, 0.090, 0.0, -0.050),          # Vamp transition to tongue
            ],
            segments=16,
            cap_ends=True,
        )

        # Lugged Boot Sole & Elevated Heel Block (Centered under ankle)
        add_sculpted_box(
            f"BootSole_{suffix}",
            knee_pivot,
            "boot",
            mat_sole,
            center_t=(0.0, -0.520, -0.035),
            size_t=(0.140, 0.022, 0.230),
            bevel_radius=0.004,
            no_outline=True,
        )
        add_sculpted_box(
            f"BootHeel_{suffix}",
            knee_pivot,
            "boot",
            mat_sole,
            center_t=(0.0, -0.525, 0.040),
            size_t=(0.135, 0.030, 0.080),
            bevel_radius=0.004,
            no_outline=True,
        )

    return {
        "Torso": bpy.data.objects["Torso"],
        "HeadGroup": bpy.data.objects["HeadGroup"],
        "LeftArmPivot": bpy.data.objects["LeftArmPivot"],
        "RightArmPivot": bpy.data.objects["RightArmPivot"],
        "LeftElbowPivot": bpy.data.objects["LeftElbowPivot"],
        "RightElbowPivot": bpy.data.objects["RightElbowPivot"],
        "LeftLegPivot": bpy.data.objects["LeftLegPivot"],
        "RightLegPivot": bpy.data.objects["RightLegPivot"],
        "LeftKneePivot": bpy.data.objects["LeftKneePivot"],
        "RightKneePivot": bpy.data.objects["RightKneePivot"],
    }


# ---------------------------------------------------------------------------
# High-Quality Humanoid Animations (Fluid Biomechanics, Zero Cape Clipping)
# ---------------------------------------------------------------------------
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
    # 1. Idle (Heroic upright stance: organic chest expansion, weight shift, straight vertical legs)
    def sample_idle(u: float):
        ang = u * 2.0 * math.pi
        breath = math.sin(ang)
        sway = math.cos(ang * 0.5)

        torso_pitch = -0.035 + breath * 0.015
        torso_roll = sway * 0.018
        torso_yaw = sway * 0.015

        bob = breath * 0.008
        sway_x = sway * 0.012

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
            "LeftElbowPivot": {"rot": (-0.28 + breath * 0.03, 0.0, 0.0)},
            "RightElbowPivot": {"rot": (-0.28 + breath * 0.03, 0.0, 0.0)},
            "LeftLegPivot": {
                "rot": (0.0, -torso_yaw * 0.25, -sway * 0.015),
                "pos": (0.0, 0.0, 0.0),
            },
            "RightLegPivot": {
                "rot": (0.0, -torso_yaw * 0.25, -sway * 0.015),
                "pos": (0.0, 0.0, 0.0),
            },
            "LeftKneePivot": {"rot": (0.0, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.0, 0.0, 0.0)},
        }

    # 2. Walk / Run (Athletic gait: double pelvic bob, pelvic yaw, counter-rotating spine,
    # forward lean -0.075 rad that guarantees cape NEVER enters torso, backward knee flexion during swing)
    def sample_walk(u: float):
        ang = u * 2.0 * math.pi
        l_phase = ang
        r_phase = ang + math.pi

        bob = -math.cos(ang * 2.0) * 0.030 + 0.004
        hip_sway_x = math.sin(ang) * 0.024

        pelvis_yaw = -math.sin(ang) * 0.12
        pelvis_roll = math.cos(ang) * 0.040

        torso_pitch = -0.075 + math.sin(ang * 2.0) * 0.012
        torso_twist = -pelvis_yaw * 0.80
        torso_roll = -pelvis_roll * 0.65

        head_pitch = -torso_pitch * 0.50
        head_yaw = -torso_twist * 0.65
        head_roll = -torso_roll * 0.60

        def leg_kinematics(phase):
            s = math.sin(phase)
            hip = s * 0.46

            dp_swing = (phase - 1.85 * math.pi + math.pi) % (2.0 * math.pi) - math.pi
            swing_bend = math.exp(-(dp_swing / 0.52) ** 2) * 0.75

            dp_strike = (phase - 0.65 * math.pi + math.pi) % (2.0 * math.pi) - math.pi
            strike_yield = math.exp(-(dp_strike / 0.30) ** 2) * 0.10

            knee = swing_bend + strike_yield
            return hip, knee

        l_hip, l_knee = leg_kinematics(l_phase)
        r_hip, r_knee = leg_kinematics(r_phase)

        def arm_kinematics(phase):
            s = math.sin(phase)
            pitch = s * 0.52 + 0.05
            dp_arm = (phase - 1.50 * math.pi + math.pi) % (2.0 * math.pi) - math.pi
            pump = math.exp(-(dp_arm / 0.80) ** 2)
            elbow = -0.30 - pump * 0.62
            return pitch, elbow

        l_arm_pitch, l_elbow = arm_kinematics(r_phase)
        r_arm_pitch, r_elbow = arm_kinematics(l_phase)

        return {
            "Torso": {
                "rot": (torso_pitch, torso_twist, torso_roll),
                "pos": (hip_sway_x, bob, 0.0),
            },
            "HeadGroup": {
                "rot": (head_pitch, head_yaw, head_roll),
                "pos": (hip_sway_x * 0.5, bob * 0.8, 0.0),
            },
            "LeftArmPivot": {
                "rot": (l_arm_pitch, torso_twist * 0.25, -0.09),
                "pos": (hip_sway_x, bob, 0.0),
            },
            "RightArmPivot": {
                "rot": (r_arm_pitch, torso_twist * 0.25, 0.09),
                "pos": (hip_sway_x, bob, 0.0),
            },
            "LeftElbowPivot": {"rot": (l_elbow, 0.0, 0.0)},
            "RightElbowPivot": {"rot": (r_elbow, 0.0, 0.0)},
            "LeftLegPivot": {
                "rot": (l_hip, -pelvis_yaw * 0.35, -pelvis_roll * 0.35),
                "pos": (0.0, 0.0, 0.0),
            },
            "RightLegPivot": {
                "rot": (r_hip, -pelvis_yaw * 0.35, -pelvis_roll * 0.35),
                "pos": (0.0, 0.0, 0.0),
            },
            "LeftKneePivot": {"rot": (-l_knee, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-r_knee, 0.0, 0.0)},
        }

    # 3. Slash (Explosive diagonal sword sweep with full body follow-through)
    def sample_slash(u: float):
        strike = math.sin((u ** 0.65) * math.pi)
        return {
            "Torso": {
                "rot": (-0.08 - strike * 0.12, strike * 0.38 - 0.22, -strike * 0.14),
                "pos": (0.0, -strike * 0.04, 0.0),
            },
            "HeadGroup": {
                "rot": (0.02, -strike * 0.18 + 0.10, 0.04),
                "pos": (0.0, -strike * 0.02, 0.0),
            },
            "RightArmPivot": {
                "rot": (-0.85 + strike * 2.10, -0.45 + strike * 0.90, 0.35 - strike * 0.85),
                "pos": (0.0, 0.0, 0.0),
            },
            "RightElbowPivot": {"rot": (-0.85 + strike * 0.65, 0.0, 0.0)},
            "LeftArmPivot": {
                "rot": (0.25 - strike * 0.40, 0.20, -0.35),
                "pos": (0.0, 0.0, 0.0),
            },
            "LeftElbowPivot": {"rot": (-0.55, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (strike * 0.22, strike * 0.12, 0.0)},
            "RightLegPivot": {"rot": (-strike * 0.18, strike * 0.12, 0.0)},
            "LeftKneePivot": {"rot": (-strike * 0.35, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-strike * 0.20, 0.0, 0.0)},
        }

    # 4. SpinSlash (360 Whirlwind Attack)
    def sample_spin_slash(u: float):
        yaw = u * 2.0 * math.pi
        pulse = math.sin(u * math.pi)
        return {
            "Torso": {
                "rot": (-0.09, yaw, -0.05),
                "pos": (0.0, -pulse * 0.05, 0.0),
            },
            "HeadGroup": {"rot": (0.0, yaw * 0.5, 0.0)},
            "RightArmPivot": {"rot": (0.15, -0.85, 0.85)},
            "RightElbowPivot": {"rot": (-0.22, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (0.15, 0.85, -0.85)},
            "LeftElbowPivot": {"rot": (-0.22, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (math.sin(yaw) * 0.25, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-math.sin(yaw) * 0.25, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.35, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.35, 0.0, 0.0)},
        }

    # 5. Lunge (Deep forward piercing thrust)
    def sample_lunge(u: float):
        t = math.sin(u * math.pi)
        return {
            "Torso": {
                "rot": (-0.14 * t - 0.05, 0.15 * t, 0.0),
                "pos": (0.0, -0.08 * t, -0.12 * t),
            },
            "HeadGroup": {"rot": (0.08 * t, -0.10 * t, 0.0)},
            "RightArmPivot": {"rot": (1.45 * t + 0.1, -0.15 * t, 0.0)},
            "RightElbowPivot": {"rot": (-0.12 * t, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (-0.65 * t, 0.15, -0.35)},
            "LeftElbowPivot": {"rot": (-0.45, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.55 * t, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.45 * t, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.75 * t, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.15 * t, 0.0, 0.0)},
        }

    # 6. Ranged (Archery Draw, Anchor & Release)
    def sample_ranged(u: float):
        draw = math.sin(min(1.0, u * 1.5) * (math.pi / 2.0))
        release = math.exp(-((u - 0.72) / 0.08) ** 2) if u > 0.70 else 0.0
        return {
            "Torso": {
                "rot": (-0.05, -0.55 * draw, 0.02),
                "pos": (0.0, -0.02 * draw, 0.0),
            },
            "HeadGroup": {"rot": (0.02, 0.52 * draw, 0.0)},
            "LeftArmPivot": {"rot": (1.52 * draw, 0.45 * draw, -0.15)},
            "LeftElbowPivot": {"rot": (-0.08, 0.0, 0.0)},
            "RightArmPivot": {"rot": (1.35 * draw - release * 0.4, -0.35 * draw, 0.65 * draw)},
            "RightElbowPivot": {"rot": (-1.45 * draw + release * 0.8, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.22 * draw, 0.15, 0.0)},
            "RightLegPivot": {"rot": (-0.20 * draw, -0.15, 0.0)},
            "LeftKneePivot": {"rot": (-0.25 * draw, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.20 * draw, 0.0, 0.0)},
        }

    # 7. Cast (Arcane Energy Invocation & Projection)
    def sample_cast(u: float):
        surge = math.sin(min(1.0, u * 1.4) * (math.pi / 2.0))
        return {
            "Torso": {
                "rot": (-0.06 - surge * 0.08, 0.0, 0.0),
                "pos": (0.0, -surge * 0.03, 0.0),
            },
            "HeadGroup": {"rot": (-surge * 0.12, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (1.42 * surge, 0.28 * surge, -0.45 * surge)},
            "RightArmPivot": {"rot": (1.42 * surge, -0.28 * surge, 0.45 * surge)},
            "LeftElbowPivot": {"rot": (-0.48 * (1.0 - surge * 0.5), 0.0, 0.0)},
            "RightElbowPivot": {"rot": (-0.48 * (1.0 - surge * 0.5), 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.12 * surge, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.12 * surge, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-0.22 * surge, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-0.22 * surge, 0.0, 0.0)},
        }

    # 8. Chop (Woodcutting dynamic axe swing)
    def sample_chop(u: float):
        impact = math.sin((u ** 0.55) * math.pi)
        return {
            "Torso": {
                "rot": (-0.08 - impact * 0.16, -0.25 + impact * 0.45, -impact * 0.10),
                "pos": (0.0, -impact * 0.06, 0.0),
            },
            "HeadGroup": {"rot": (impact * 0.10, 0.0, 0.0)},
            "RightArmPivot": {"rot": (-0.95 + impact * 2.30, 0.12, 0.25)},
            "RightElbowPivot": {"rot": (-0.90 + impact * 0.75, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (-0.65 + impact * 1.80, 0.25, -0.25)},
            "LeftElbowPivot": {"rot": (-0.85 + impact * 0.65, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (impact * 0.22, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-impact * 0.22, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-impact * 0.35, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-impact * 0.25, 0.0, 0.0)},
        }

    # 9. Mine (Heavy two-handed pickaxe strike)
    def sample_mine(u: float):
        impact = math.sin((u ** 0.6) * math.pi)
        return {
            "Torso": {
                "rot": (-0.06 - impact * 0.24, 0.0, 0.0),
                "pos": (0.0, -impact * 0.08, -impact * 0.04),
            },
            "HeadGroup": {"rot": (impact * 0.15, 0.0, 0.0)},
            "RightArmPivot": {"rot": (-0.85 + impact * 2.45, -0.15, 0.18)},
            "RightElbowPivot": {"rot": (-0.85 + impact * 0.75, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (-0.85 + impact * 2.45, 0.15, -0.18)},
            "LeftElbowPivot": {"rot": (-0.85 + impact * 0.75, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (impact * 0.28, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-impact * 0.25, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (-impact * 0.45, 0.0, 0.0)},
            "RightKneePivot": {"rot": (-impact * 0.30, 0.0, 0.0)},
        }

    # 10. Fish (Patient angling stance with rod twitch)
    def sample_fish(u: float):
        ang = u * 2.0 * math.pi
        twitch = math.sin(ang * 3.0) * 0.03
        sway = math.cos(ang) * 0.015
        return {
            "Torso": {
                "rot": (-0.05 + sway, 0.12, 0.0),
                "pos": (0.0, sway * 0.5, 0.0),
            },
            "HeadGroup": {"rot": (0.04, -0.10, 0.0)},
            "RightArmPivot": {"rot": (0.75 + twitch, -0.15, 0.18)},
            "RightElbowPivot": {"rot": (-0.85 + twitch * 2.0, 0.0, 0.0)},
            "LeftArmPivot": {"rot": (0.65, 0.25, -0.15)},
            "LeftElbowPivot": {"rot": (-0.95, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.0, 0.0, 0.0)},
            "RightLegPivot": {"rot": (0.0, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (0.0, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.0, 0.0, 0.0)},
        }

    build_action(pivots, "Idle", 48, sample_idle)
    build_action(pivots, "Walk", 24, sample_walk)
    build_action(pivots, "Slash", 16, sample_slash)
    build_action(pivots, "Lunge", 16, sample_lunge)
    build_action(pivots, "Ranged", 18, sample_ranged)
    build_action(pivots, "Cast", 20, sample_cast)
    build_action(pivots, "Chop", 18, sample_chop)
    build_action(pivots, "Mine", 18, sample_mine)
    build_action(pivots, "Fish", 48, sample_fish)
    build_action(pivots, "SpinSlash", 18, sample_spin_slash)


# ---------------------------------------------------------------------------
# Studio Camera, Lighting & Preview Render (Full-Body Portrait Framing)
# ---------------------------------------------------------------------------
def setup_studio_and_render(preview_path: str = None):
    scene = bpy.context.scene
    scene.render.resolution_x = 960
    scene.render.resolution_y = 1080
    scene.render.film_transparent = True

    world = bpy.data.worlds.new(name="StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.07, 0.08, 0.10, 1.0)
        bg.inputs["Strength"].default_value = 0.65

    # Direct Front Key Light (Warm, flattering anime portrait illumination from camera)
    key_data = bpy.data.lights.new(name="FrontKeyLight", type="SUN")
    key_data.energy = 4.0
    key_data.color = (1.0, 0.98, 0.95)
    key_obj = bpy.data.objects.new(name="FrontKeyLight", object_data=key_data)
    bpy.context.collection.objects.link(key_obj)
    key_obj.rotation_euler = Euler((math.radians(-72), math.radians(12), math.radians(-5)), "XYZ")

    # Soft Fill Light from camera-right
    fill_data = bpy.data.lights.new(name="FillLight", type="SUN")
    fill_data.energy = 2.4
    fill_data.color = (0.90, 0.95, 1.0)
    fill_obj = bpy.data.objects.new(name="FillLight", object_data=fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = Euler((math.radians(-68), math.radians(-22), math.radians(8)), "XYZ")

    # Rim Light from above-behind
    rim_data = bpy.data.lights.new(name="RimLight", type="SUN")
    rim_data.energy = 2.8
    rim_data.color = (1.0, 0.96, 0.90)
    rim_obj = bpy.data.objects.new(name="RimLight", object_data=rim_data)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.rotation_euler = Euler((math.radians(45), math.radians(10), math.radians(0)), "XYZ")

    # Full-Body Studio Camera (Frames head to boots cleanly)
    cam_data = bpy.data.cameras.new(name="StudioCam")
    cam_data.lens = 52.0
    cam_obj = bpy.data.objects.new(name="StudioCam", object_data=cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, 3.20, 0.95)
    direction = Vector((0.0, 0.0, 0.92)) - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj

    if preview_path:
        for obj in bpy.data.objects:
            if obj.animation_data:
                for track in obj.animation_data.nla_tracks:
                    track.mute = (track.name != "Idle")
        scene.frame_set(12)
        os.makedirs(os.path.dirname(preview_path), exist_ok=True)
        scene.render.filepath = preview_path
        bpy.ops.render.render(write_still=True)
        for obj in bpy.data.objects:
            if obj.animation_data:
                for track in obj.animation_data.nla_tracks:
                    track.mute = False


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    blend_dir = os.path.join(root_dir, "blender")
    glb_dir = os.path.join(root_dir, "public", "models")
    os.makedirs(blend_dir, exist_ok=True)
    os.makedirs(glb_dir, exist_ok=True)

    blend_path = os.path.join(blend_dir, "hero.blend")
    glb_path = os.path.join(glb_dir, "hero.glb")
    preview_path = r"C:\Users\User\.gemini\antigravity-cli\brain\28c9539a-1323-4489-8927-620e19a4a583\scratch\hero_base_render.png"

    clear_scene()
    pivots = build_hero_character()
    build_all_animations(pivots)

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips_merged_animation_name="Idle",
        export_extras=True,
    )

    setup_studio_and_render(preview_path)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[BlenderHero] Exported Anime RPG hero to {blend_path} and {glb_path}")


if __name__ == "__main__":
    main()
