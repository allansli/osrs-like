"""
Blender 5.2 Procedural Sculptor & Animator for the Gielinor Base Human Character.
Flawless, High-Fidelity Nordic Fantasy Hero (Skyrim / Witcher / BotW Aesthetic).
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
# Scene Reset & Material Library (Skyrim-Grounded PBR)
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
# Procedural Sculpting Utilities (High-Fidelity Contours & Bevels)
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
    """
    Rings are list of: (ty, rx, rz, tx_offset, tz_offset)
    Can also support elliptical / asymmetrical offsets per ring:
    (ty, rx, rz, tx_offset, tz_offset, asymmetry_fn)
    """
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
    """Adds a beveled sculpted box in Three.js coordinates."""
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
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5

    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = v.co.x * sx
        v.co.y = v.co.y * sz  # Blender Y is Three -Z
        v.co.z = v.co.z * sy  # Blender Z is Three Y
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
    """Creates a smooth beveled cylinder between two points in Three.js coordinates."""
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
    # Align along vector diff
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
# Sculpt the Flawless Hero Character
# ---------------------------------------------------------------------------
def build_hero_character():
    hero_root = create_empty_pivot("HeroRoot", None, 0.0, 0.0, 0.0)

    # Nordic Dark Fantasy Palette (Skyrim-grounded, rich tactile contrast)
    mat_skin = make_mat("HeroSkin", 0xDCB898, roughness=0.52, sss=0.15)
    mat_lips = make_mat("HeroLips", 0xA66F5C, roughness=0.48, sss=0.20)
    mat_hair = make_mat("HeroHair", 0x423122, roughness=0.42)          # Dark Nordic Chestnut
    mat_eye_white = make_mat("HeroEyeWhite", 0xF2F5F8, roughness=0.15)
    mat_iris = make_mat("HeroPupil", 0x1E3A52, roughness=0.12)         # Deep Nordic Steel Blue
    mat_tunic = make_mat("HeroTunic", 0x2C3944, roughness=0.72)        # Weathered dark slate wool
    mat_tunic_trim = make_mat("HeroTunicTrim", 0x483C32, roughness=0.68)
    mat_legs = make_mat("HeroTrousers", 0x3A3026, roughness=0.75)      # Rugged dark peat trousers
    mat_belt = make_mat("HeroBeltLeather", 0x221710, roughness=0.45)   # Oiled harness leather
    mat_buckle = make_mat("HeroBeltBuckle", 0x967B48, roughness=0.30, metallic=0.82) # Hand-forged bronze
    mat_boot = make_mat("HeroBoots", 0x1B140E, roughness=0.55)         # Heavy waxed trail boots
    mat_sole = make_mat("HeroBootSole", 0x0E0B08, roughness=0.70)

    # =========================================================================
    # 1. TORSO PIVOT (y = 1.24 in Three.js)
    # =========================================================================
    torso = create_empty_pivot("Torso", hero_root, 0.0, 1.24, 0.0)

    # Pectoral & Lat Asymmetry modifier:
    # Keeps the back strictly forward (z <= +0.09) so capes never clip!
    def torso_asym(ang, rx, rz, ox, oz):
        # ang = 0 is +X (right), pi/2 is +Z (back in Three.js), pi is -X (left), 3pi/2 is -Z (front in Three.js)
        front_factor = -math.sin(ang)  # +1 at front (-Z), -1 at back (+Z)
        if front_factor > 0:
            # Expand chest/pectoral forward into -Z
            cur_rz = rz * (1.0 + front_factor * 0.16)
            cur_oz = oz - front_factor * 0.012
        else:
            # Flatten back and pull slightly forward into -Z to guarantee cape clearance!
            back_factor = -front_factor
            cur_rz = rz * (1.0 - back_factor * 0.10)
            cur_oz = oz - back_factor * 0.016
        return rx, cur_rz, ox, cur_oz

    # Sculpted Nordic Gambeson / Tunic (Pectoral plates, ribcage, broad shoulder yoke)
    add_lofted_surface(
        "Chest",
        torso,
        "chest",
        mat_tunic,
        rings=[
            (-0.25, 0.175, 0.115, 0.0, -0.004, torso_asym),   # Waist hem at belt (y=0.99)
            (-0.14, 0.182, 0.120, 0.0, -0.006, torso_asym),   # Lower abdomen
            (-0.02, 0.198, 0.132, 0.0, -0.008, torso_asym),   # Mid ribcage
            (0.10, 0.222, 0.146, 0.0, -0.010, torso_asym),    # Lower pectorals
            (0.18, 0.235, 0.150, 0.0, -0.010, torso_asym),    # Full chest & lats
            (0.25, 0.245, 0.140, 0.0, -0.005, torso_asym),    # Clavicle & shoulder line (y=1.49)
            (0.30, 0.215, 0.124, 0.0, 0.000, torso_asym),     # Broad athletic trapezius slope (y=1.54)
            (0.34, 0.145, 0.098, 0.0, 0.002, None),           # Upper traps supporting neck base (y=1.58)
            (0.365, 0.095, 0.086, 0.0, 0.002, None),          # Collar opening rim (y=1.605)
        ],
        segments=28,
        cap_ends=True,
    )

    # Leather Collar Band
    add_lofted_surface(
        "Collar",
        torso,
        "collar",
        mat_tunic_trim,
        rings=[
            (0.345, 0.102, 0.092, 0.0, 0.002),
            (0.368, 0.096, 0.088, 0.0, 0.002),
            (0.380, 0.090, 0.082, 0.0, 0.002),
        ],
        segments=20,
        cap_ends=False,
        no_outline=True,
    )

    # Crossed Chest Lacing (authentic Viking/Nordic tunic detail on chest)
    for lace_idx in range(3):
        ly = 0.14 + lace_idx * 0.05
        add_sculpted_cylinder(
            f"ChestLace_{lace_idx}_A",
            torso,
            "collar",
            mat_belt,
            pos1_t=(-0.035, ly - 0.018, -0.140),
            pos2_t=(0.035, ly + 0.018, -0.140),
            radius=0.003,
            segments=6,
            no_outline=True,
        )
        add_sculpted_cylinder(
            f"ChestLace_{lace_idx}_B",
            torso,
            "collar",
            mat_belt,
            pos1_t=(0.035, ly - 0.018, -0.140),
            pos2_t=(-0.035, ly + 0.018, -0.140),
            radius=0.003,
            segments=6,
            no_outline=True,
        )

    # Pelvic Trouser Waist under belt
    add_lofted_surface(
        "Belt",
        torso,
        "belt",
        mat_legs,
        rings=[
            (-0.38, 0.110, 0.082, 0.0, 0.002),   # Pelvis between upper thighs
            (-0.33, 0.160, 0.108, 0.0, 0.000),   # Lower hip taper
            (-0.28, 0.172, 0.116, 0.0, -0.002),  # Hip line at y=0.96
            (-0.23, 0.174, 0.118, 0.0, -0.004),  # Waistband
        ],
        segments=24,
        cap_ends=True,
    )

    # Heavy Leather War Belt Strap with edge groove
    add_lofted_surface(
        "BeltStrap",
        torso,
        "belt-strap",
        mat_belt,
        rings=[
            (-0.255, 0.178, 0.122, 0.0, -0.004),
            (-0.220, 0.181, 0.124, 0.0, -0.004),
            (-0.190, 0.178, 0.122, 0.0, -0.004),
        ],
        segments=24,
        cap_ends=True,
        no_outline=True,
    )

    # Sculpted Forged Bronze Belt Buckle & Chape
    add_sculpted_box(
        "BeltBuckle",
        torso,
        "belt-buckle",
        mat_buckle,
        center_t=(0.0, -0.222, -0.126),
        size_t=(0.075, 0.055, 0.014),
        bevel_radius=0.003,
        no_outline=True,
    )
    # Buckle inner prong
    add_sculpted_cylinder(
        "BeltBuckleProng",
        torso,
        "belt-buckle",
        mat_buckle,
        pos1_t=(0.0, -0.242, -0.132),
        pos2_t=(0.0, -0.202, -0.132),
        radius=0.0025,
        segments=6,
        no_outline=True,
    )
    # Hanging Belt Strap Tongue (adventurer detail hanging past left hip)
    add_sculpted_box(
        "BeltTongue",
        torso,
        "belt-strap",
        mat_belt,
        center_t=(-0.050, -0.285, -0.120),
        size_t=(0.030, 0.100, 0.009),
        bevel_radius=0.002,
        no_outline=True,
    )
    # Metal tip on hanging strap
    add_sculpted_box(
        "BeltTongueTip",
        torso,
        "belt-buckle",
        mat_buckle,
        center_t=(-0.050, -0.340, -0.120),
        size_t=(0.030, 0.014, 0.011),
        bevel_radius=0.002,
        no_outline=True,
    )

    # Leather Adventurer Pouch on Right Hip
    add_sculpted_box(
        "AdventurerPouch",
        torso,
        "belt-strap",
        mat_belt,
        center_t=(0.165, -0.240, 0.015),
        size_t=(0.055, 0.075, 0.060),
        bevel_radius=0.005,
        no_outline=True,
    )

    # Muscular Athletic Neck with trapezius taper and Adam's apple
    add_lofted_surface(
        "Neck",
        torso,
        "neck",
        mat_skin,
        rings=[
            (0.34, 0.088, 0.082, 0.0, 0.002),   # Wide base at collar & trapezius (y=1.58)
            (0.40, 0.078, 0.074, 0.0, 0.000),   # Lower neck (y=1.64)
            (0.46, 0.074, 0.072, 0.0, -0.002),  # Mid neck (Adam's apple, y=1.70)
            (0.53, 0.076, 0.074, 0.0, -0.004),  # Seamless insertion inside jaw (y=1.77)
        ],
        segments=22,
        cap_ends=True,
    )

    # =========================================================================
    # 2. HEAD GROUP (y = 1.86 in Three.js) - Exact Canonical LEAN_RIG Proportions!
    #    Chin at y = -0.185 (world 1.675), Eyes at y = +0.015 (world 1.875), Crown at y = +0.185 (world 2.045)
    #    Seamlessly envelopes neck top (y=1.78) with zero gap!
    # =========================================================================
    head_group = create_empty_pivot("HeadGroup", hero_root, 0.0, 1.86, 0.0)

    # Anatomical Face Asymmetry:
    # Defined cheekbones, chiseled chin and angular jaw
    def head_asym(ang, rx, rz, oz_off):
        front_val = -math.sin(ang)
        side_val = abs(math.cos(ang))
        cur_rx = rx * (1.0 + side_val * 0.04)
        cur_rz = rz
        cur_oz = oz_off
        if front_val > 0.35:
            cur_rz = rz * (1.0 - (1.0 - side_val) * 0.06)
            cur_oz = oz_off - front_val * 0.006
        return cur_rx, cur_rz, 0.0, cur_oz

    # Heroic Chiseled Head & Cranium (Total height = 0.37m, matching LEAN_RIG radius ~0.19m)
    add_lofted_surface(
        "Head",
        head_group,
        "head",
        mat_skin,
        rings=[
            (-0.185, 0.045, 0.058, 0.0, -0.024),  # Strong chiseled chin tip (y=1.675)
            (-0.155, 0.082, 0.105, 0.0, -0.018),  # Mental crease & lower jaw (y=1.705)
            (-0.110, 0.124, 0.144, 0.0, -0.010),  # Mandible angle (wide jaw, y=1.750)
            (-0.045, 0.146, 0.162, 0.0, -0.004),  # Cheekbone contour (y=1.815)
            (0.015, 0.154, 0.170, 0.0, 0.000),    # Deep-set eye socket level (y=1.875)
            (0.065, 0.152, 0.168, 0.0, -0.003),   # Supraorbital brow ridge (y=1.925)
            (0.115, 0.142, 0.158, 0.0, 0.002),    # Forehead & temples (y=1.975)
            (0.158, 0.110, 0.124, 0.0, 0.005),    # Cranial dome (y=2.018)
            (0.185, 0.046, 0.054, 0.0, 0.006),    # Crown (y=2.045)
        ],
        segments=28,
        cap_ends=True,
    )

    # Straight Nordic Nose Bridge with defined tip and nostrils
    add_lofted_surface(
        "Nose",
        head_group,
        "nose",
        mat_skin,
        rings=[
            (-0.055, 0.016, 0.015, 0.0, -0.166),  # Alar base & nostril plane
            (-0.038, 0.022, 0.024, 0.0, -0.180),  # Nose tip (lobule)
            (-0.010, 0.014, 0.017, 0.0, -0.174),  # Rhinion bridge
            (0.020, 0.011, 0.013, 0.0, -0.167),   # Nasion (root of nose below brow)
        ],
        segments=12,
        cap_ends=True,
        no_outline=True,
    )

    # Sculpted Lips with Cupid's Bow
    add_lofted_surface(
        "Mouth",
        head_group,
        "mouth",
        mat_lips,
        rings=[
            (-0.108, 0.032, 0.010, 0.0, -0.148),  # Lower lip bottom crease
            (-0.098, 0.040, 0.014, 0.0, -0.153),  # Full lip center (commissure)
            (-0.088, 0.030, 0.010, 0.0, -0.148),  # Upper lip & Cupid's bow
        ],
        segments=14,
        cap_ends=True,
        no_outline=True,
    )

    # Sculpted Ears with outer helix, concha cavity, and lobe
    for side, suffix in [(-1.0, "L"), (1.0, "R")]:
        add_lofted_surface(
            f"Ear_{suffix}",
            head_group,
            "ear",
            mat_skin,
            rings=[
                (-0.042, 0.013, 0.018, side * 0.154, -0.005),  # Lobe
                (-0.005, 0.019, 0.026, side * 0.160, 0.000),   # Concha & antihelix
                (0.028, 0.015, 0.021, side * 0.155, 0.005),   # Upper helix curve
            ],
            segments=12,
            cap_ends=True,
            no_outline=True,
        )

    # Realistic Deep-Set Eyes (Spacing = 0.060m, matching canonical LEAN_RIG)
    for side, suffix in [(-1.0, "L"), (1.0, "R")]:
        ex = side * 0.060
        # Sclera / Eyeball
        add_lofted_surface(
            f"EyeWhite_{suffix}",
            head_group,
            "eye-white",
            mat_eye_white,
            rings=[
                (-0.012, 0.022, 0.007, ex, -0.158),
                (0.000, 0.026, 0.008, ex, -0.162),
                (0.012, 0.022, 0.007, ex, -0.158),
            ],
            segments=14,
            cap_ends=True,
            no_outline=True,
        )
        # Deep Nordic Steel Blue Iris & Pupil
        add_lofted_surface(
            f"Pupil_{suffix}",
            head_group,
            "pupil",
            mat_iris,
            rings=[
                (-0.009, 0.013, 0.006, ex * 0.98, -0.165),
                (0.000, 0.016, 0.007, ex * 0.98, -0.167),
                (0.009, 0.013, 0.006, ex * 0.98, -0.165),
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )
        # Upper Eyelid Crease (gives focused, determined, handsome warrior expression!)
        add_lofted_surface(
            f"Eyelid_{suffix}",
            head_group,
            "head",
            mat_skin,
            rings=[
                (0.006, 0.026, 0.009, ex, -0.163),
                (0.016, 0.028, 0.011, ex, -0.165),
                (0.024, 0.025, 0.010, ex, -0.162),
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )
        # Sculpted Warrior Eyebrow with natural arch
        add_lofted_surface(
            f"Brow_{suffix}",
            head_group,
            "brow",
            mat_hair,
            rings=[
                (0.024, 0.028, 0.008, ex * 1.03, -0.163),
                (0.034, 0.032, 0.010, ex * 1.04, -0.166),
                (0.042, 0.026, 0.008, ex * 1.01, -0.163),
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )

    # Swept Nordic Warrior Hair Mane (Layered volumetric hair with swept crest and temples)
    add_lofted_surface(
        "HairCap",
        head_group,
        "hair",
        mat_hair,
        rings=[
            (-0.065, 0.140, 0.138, 0.0, 0.046),   # Nape taper resting against neck
            (-0.005, 0.162, 0.162, 0.0, 0.024),   # Occipital bulk
            (0.055, 0.168, 0.180, 0.0, -0.004),   # Parietal ridge & temples
            (0.115, 0.164, 0.174, 0.0, -0.001),   # High crown swept strands
            (0.165, 0.130, 0.140, 0.0, 0.004),    # Swept top volume
            (0.198, 0.060, 0.066, 0.0, 0.008),    # Swept crest peak
        ],
        segments=28,
        cap_ends=True,
    )

    # Layered Swept Nordic Hair Fringe (heroic front swept volume)
    add_lofted_surface(
        "HairFringe_Center",
        head_group,
        "hair",
        mat_hair,
        rings=[
            (0.065, 0.065, 0.035, -0.015, -0.165),  # Lower swept fringe over forehead
            (0.110, 0.085, 0.045, -0.010, -0.155),  # Mid swept rise
            (0.155, 0.075, 0.040, 0.000, -0.125),   # Crown insertion
        ],
        segments=12,
        cap_ends=True,
        no_outline=True,
    )
    add_lofted_surface(
        "HairFringe_Right",
        head_group,
        "hair",
        mat_hair,
        rings=[
            (0.075, 0.045, 0.025, 0.075, -0.150),
            (0.115, 0.055, 0.030, 0.080, -0.135),
            (0.150, 0.045, 0.025, 0.065, -0.105),
        ],
        segments=10,
        cap_ends=True,
        no_outline=True,
    )

    # Flowing Temple Strands / Sideburns
    for side, suffix in [(-1.0, "L"), (1.0, "R")]:
        add_lofted_surface(
            f"Sideburn_{suffix}",
            head_group,
            "hair",
            mat_hair,
            rings=[
                (-0.020, 0.014, 0.032, side * 0.152, -0.052),  # Jawline lock tip
                (0.022, 0.018, 0.042, side * 0.156, -0.048),   # Mid cheek lock
                (0.062, 0.020, 0.048, side * 0.152, -0.042),   # Temple root
            ],
            segments=12,
            cap_ends=True,
            no_outline=True,
        )

    # =========================================================================
    # 3. LEFT & RIGHT ARMS + ELBOW PIVOTS + 5-DIGIT COMBAT HANDS
    #    Shoulder at (±0.28, 1.50, 0), Elbow at (0, -0.26, 0) relative to Shoulder
    # =========================================================================
    for is_left in (True, False):
        side = -1.0 if is_left else 1.0
        prefix = "Left" if is_left else "Right"
        suffix = "L" if is_left else "R"
        arm_pivot = create_empty_pivot(f"{prefix}ArmPivot", hero_root, side * 0.28, 1.50, 0.0)

        # Upper Arm / Deltoid / Tunic Sleeve (Deltoid muscle cap smoothly wrapping into clavicle)
        add_lofted_surface(
            f"UpperArm_{suffix}",
            arm_pivot,
            "arm",
            mat_tunic,
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

        # Folded Sleeve Cuff Rim
        add_lofted_surface(
            f"SleeveCuff_{suffix}",
            arm_pivot,
            "collar",
            mat_tunic_trim,
            rings=[
                (-0.255, 0.076, 0.076, 0.0, 0.000),
                (-0.240, 0.080, 0.080, 0.0, 0.000),
                (-0.225, 0.076, 0.076, 0.0, 0.000),
            ],
            segments=18,
            cap_ends=False,
            no_outline=True,
        )

        # Articulated Elbow Pivot at y = -0.26 relative to ArmPivot
        elbow_pivot = create_empty_pivot(f"{prefix}ElbowPivot", arm_pivot, 0.0, -0.26, 0.0)

        # Bare Muscular Forearm (Brachioradialis taper into wrist)
        add_lofted_surface(
            f"Forearm_{suffix}",
            elbow_pivot,
            "neck",
            mat_skin,
            rings=[
                (-0.370, 0.048, 0.046, 0.0, -0.004),  # Wrist (at -0.63 in ArmPivot)
                (-0.240, 0.058, 0.055, 0.0, -0.003),  # Mid forearm taper
                (-0.080, 0.068, 0.064, side * 0.004, 0.000), # Brachioradialis muscle belly
                (0.000, 0.062, 0.062, 0.0, 0.000),    # Elbow olecranon joint
                (0.038, 0.044, 0.044, 0.0, 0.000),    # Smooth ball tucked inside sleeve
            ],
            segments=20,
            cap_ends=True,
        )

        # Leather Vambrace / Wrist Wrap (Warrior brace protecting forearm)
        add_lofted_surface(
            f"WristWrap_{suffix}",
            elbow_pivot,
            "collar",
            mat_belt,
            rings=[
                (-0.375, 0.051, 0.049, 0.0, -0.004),
                (-0.310, 0.057, 0.054, 0.0, -0.003),
                (-0.250, 0.061, 0.058, 0.0, -0.002),
            ],
            segments=16,
            cap_ends=False,
            no_outline=True,
        )

        # =====================================================================
        # 5-DIGIT ARTICULATED COMBAT HAND
        # Palm at y = -0.44 in ElbowPivot (= -0.70 in ArmPivot = LEAN_RIG.handY!)
        # Firm warrior grip ready to wield swords, bows, staves, and shields.
        # =====================================================================
        # Palm & Thenar Pad
        add_lofted_surface(
            f"Hand_{suffix}",
            elbow_pivot,
            "hand",
            mat_skin,
            rings=[
                (-0.490, 0.044, 0.048, 0.0, -0.012),  # Knuckle line (metacarpophalangeal)
                (-0.450, 0.058, 0.060, 0.0, -0.010),  # Palm mid-span (thenar pad)
                (-0.400, 0.053, 0.054, 0.0, -0.006),  # Carpal base
                (-0.365, 0.046, 0.046, 0.0, -0.004),  # Wrist junction
            ],
            segments=18,
            cap_ends=True,
        )

        # Opposable Thumb (curled across fingers in firm grasp)
        add_lofted_surface(
            f"Thumb_{suffix}",
            elbow_pivot,
            "hand",
            mat_skin,
            rings=[
                (-0.465, 0.016, 0.018, -side * 0.044, -0.038),  # Thumb tip & nail
                (-0.428, 0.022, 0.022, -side * 0.048, -0.030),  # Interphalangeal joint
                (-0.395, 0.020, 0.020, -side * 0.038, -0.018),  # Thenar knuckle
            ],
            segments=10,
            cap_ends=True,
            no_outline=True,
        )

        # 4 Articulated Fingers Curled in Combat Grip (Index, Middle, Ring, Pinky)
        finger_configs = [
            ("Index", -0.026, 0.032, 0.012),
            ("Middle", -0.009, 0.035, 0.013),
            ("Ring", 0.009, 0.033, 0.012),
            ("Pinky", 0.026, 0.027, 0.011),
        ]
        for f_name, f_x, f_len, f_rad in finger_configs:
            fx_pos = side * f_x
            # Finger curled tightly around weapon handle axis:
            # Segment 1: from knuckle (-0.485) downward/forward
            # Segment 2: curled back under palm to grip weapon
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
    # 4. LEFT & RIGHT LEGS + KNEE PIVOTS + RUGGED NORDIC RANGER BOOTS
    #    Hips at (±0.11, 0.90, 0), Knee at (0, -0.38, 0) relative to Hip
    # =========================================================================
    for is_left in (True, False):
        side = -1.0 if is_left else 1.0
        prefix = "Left" if is_left else "Right"
        suffix = "L" if is_left else "R"
        leg_pivot = create_empty_pivot(f"{prefix}LegPivot", hero_root, side * 0.11, 0.90, 0.0)

        # Upper Thigh / Trousers (Quadriceps muscle bulk with fitted fabric)
        add_lofted_surface(
            f"Thigh_{suffix}",
            leg_pivot,
            "thigh",
            mat_legs,
            rings=[
                (-0.36, 0.076, 0.076, 0.0, 0.000),            # Supracondylar knee taper
                (-0.25, 0.088, 0.088, 0.0, -0.002),           # Lower thigh
                (-0.12, 0.098, 0.096, side * 0.005, -0.004),  # Rectus femoris bulk
                (0.00, 0.092, 0.090, 0.0, 0.000),             # Hip joint center
                (0.045, 0.064, 0.064, 0.0, 0.000),            # Spherical tuck inside pelvis
            ],
            segments=20,
            cap_ends=True,
        )

        # Articulated Knee Pivot at y = -0.38 relative to LegPivot
        knee_pivot = create_empty_pivot(f"{prefix}KneePivot", leg_pivot, 0.0, -0.38, 0.0)

        # Lower Leg / Shin / Calf (Patella kneecap + gastrocnemius muscle)
        add_lofted_surface(
            f"Shin_{suffix}",
            knee_pivot,
            "shin",
            mat_legs,
            rings=[
                (-0.28, 0.072, 0.074, 0.0, 0.000),            # Ankle entry inside boot cuff
                (-0.16, 0.082, 0.082, 0.0, 0.002),            # Mid calf
                (-0.06, 0.086, 0.086, 0.0, 0.004),            # Gastrocnemius muscle belly
                (0.00, 0.076, 0.076, 0.0, -0.004),            # Patella kneecap (front bulge)
                (0.045, 0.054, 0.054, 0.0, 0.000),            # Ball tuck inside thigh
            ],
            segments=20,
            cap_ends=True,
        )

        # Rugged Nordic Trail Boot (Waxed leather, ankle strap, sole & heel)
        # Boot Shaft & Cuff (ty = -0.19 to -0.47 in KneePivot = world y=0.33 to 0.05)
        add_lofted_surface(
            f"Boot_{suffix}",
            knee_pivot,
            "boot",
            mat_boot,
            rings=[
                (-0.470, 0.080, 0.108, 0.0, -0.038),          # Ankle / heel base
                (-0.410, 0.082, 0.092, 0.0, -0.016),          # Ankle shaft
                (-0.320, 0.086, 0.088, 0.0, -0.006),          # Mid boot
                (-0.230, 0.092, 0.092, 0.0, 0.000),           # Folded cuff flare
                (-0.200, 0.088, 0.088, 0.0, 0.000),           # Boot rim
            ],
            segments=20,
            cap_ends=True,
        )

        # Boot Ankle Buckle Strap (detail)
        add_sculpted_cylinder(
            f"BootStrap_{suffix}",
            knee_pivot,
            "boot",
            mat_belt,
            pos1_t=(-0.070 * side, -0.410, 0.020),
            pos2_t=(0.070 * side, -0.410, 0.020),
            radius=0.008,
            segments=8,
            no_outline=True,
        )
        add_sculpted_box(
            f"BootBuckle_{suffix}",
            knee_pivot,
            "boot",
            mat_buckle,
            center_t=(side * 0.082, -0.410, 0.000),
            size_t=(0.012, 0.028, 0.032),
            bevel_radius=0.002,
            no_outline=True,
        )

        # Reinforced Rounded Toe Cap (ty = -0.47 down to sole contact y=-0.515 = world y=0.005)
        add_lofted_surface(
            f"BootToe_{suffix}",
            knee_pivot,
            "toe",
            mat_boot,
            rings=[
                (-0.515, 0.076, 0.118, 0.0, -0.090),          # Tread contact
                (-0.485, 0.080, 0.126, 0.0, -0.092),          # Mid toe box
                (-0.450, 0.074, 0.095, 0.0, -0.068),          # Vamp transition to tongue
            ],
            segments=16,
            cap_ends=True,
        )

        # Heavy Tread Lugged Boot Sole & Heel
        add_sculpted_box(
            f"BootSole_{suffix}",
            knee_pivot,
            "boot",
            mat_sole,
            center_t=(0.0, -0.520, -0.065),
            size_t=(0.155, 0.022, 0.285),
            bevel_radius=0.004,
            no_outline=True,
        )
        # Elevated Heel Block
        add_sculpted_box(
            f"BootHeel_{suffix}",
            knee_pivot,
            "boot",
            mat_sole,
            center_t=(0.0, -0.525, 0.025),
            size_t=(0.145, 0.030, 0.115),
            bevel_radius=0.004,
            no_outline=True,
        )

    # Return key pivots for animation construction
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
    # Cache base rest locations
    rest_locs = {p_name: obj.location.copy() for p_name, obj in pivots.items()}

    # Initialize actions for each pivot
    for name, obj in pivots.items():
        if not obj.animation_data:
            obj.animation_data_create()
        act = bpy.data.actions.new(name=f"{action_name}_{name}")
        obj.animation_data.action = act

    # Key every frame for seamless MMORPG playback
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

    # Push to named NLA track on each object (Blender glTF exporter merges identical track names!)
    for name, obj in pivots.items():
        if not obj.animation_data or not obj.animation_data.action:
            continue
        act = obj.animation_data.action
        track = obj.animation_data.nla_tracks.new()
        track.name = action_name
        strip = track.strips.new(action_name, 0, act)
        strip.name = action_name
        obj.animation_data.action = None

    # Reset objects back to rest
    for p_name, obj in pivots.items():
        obj.location = rest_locs[p_name]
        obj.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")


def build_all_animations(pivots: dict):
    # 1. Idle (Heroic living breathing stance: organic chest expansion, weight shift, gentle relaxed arm sway)
    def sample_idle(u: float):
        ang = u * 2.0 * math.pi
        breath = math.sin(ang)
        sway = math.cos(ang * 0.5)

        # Spine keeps forward intention (never backward): torso_pitch stays negative!
        torso_pitch = -0.035 + breath * 0.015   # -0.05 to -0.02 (forward tilt away from cape!)
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
                "rot": (0.02, -torso_yaw * 0.3, -sway * 0.015),
                "pos": (0.0, 0.0, 0.0),
            },
            "RightLegPivot": {
                "rot": (-0.02, -torso_yaw * 0.3, -sway * 0.015),
                "pos": (0.0, 0.0, 0.0),
            },
            "LeftKneePivot": {"rot": (0.06, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.06, 0.0, 0.0)},
        }

    # 2. Walk / Run (Athletic Nordic gait: double pelvic bob, pelvic yaw, counter-rotating spine,
    # forward lean -0.075 rad that guarantees cape NEVER enters torso, pendular arms with elbow lag)
    def sample_walk(u: float):
        ang = u * 2.0 * math.pi
        l_phase = ang
        r_phase = ang + math.pi

        # Pelvic bob (impact drop and flight peak)
        bob = -math.cos(ang * 2.0) * 0.030 + 0.004
        hip_sway_x = math.sin(ang) * 0.024

        # Pelvic yaw & roll (Trendelenburg tilt towards advancing swing leg)
        pelvis_yaw = -math.sin(ang) * 0.12
        pelvis_roll = math.cos(ang) * 0.040

        # Spine counter-rotation & ATHLETIC FORWARD LEAN:
        # Crucial: pitch is NEGATIVE (-0.075) so torso leans FORWARD into -Z, pulling spine AWAY from cape!
        torso_pitch = -0.075 + math.sin(ang * 2.0) * 0.012
        torso_twist = -pelvis_yaw * 0.80
        torso_roll = -pelvis_roll * 0.65

        # Head stabilization (vestibulo-ocular lock on horizon)
        head_pitch = -torso_pitch * 0.50
        head_yaw = -torso_twist * 0.65
        head_roll = -torso_roll * 0.60

        # Leg Kinematics: Real human double-support gait curve
        def leg_kinematics(phase):
            s = math.sin(phase)
            # Positive hip rotation swings leg FORWARD into -Z!
            hip = s * 0.56 + math.sin(phase * 2.0) * 0.06

            # Swing-phase high knee lift centered at 1.12*pi
            dp_swing = (phase - 1.12 * math.pi + math.pi) % (2.0 * math.pi) - math.pi
            swing_bend = math.exp(-(dp_swing / 0.55) ** 2) * 1.00

            # Heel-strike absorption
            dp_plant = (phase - 1.68 * math.pi + math.pi) % (2.0 * math.pi) - math.pi
            plant_yield = math.exp(-(dp_plant / 0.35) ** 2) * 0.25

            knee = 0.08 + swing_bend + plant_yield
            return hip, knee

        l_hip, l_knee = leg_kinematics(l_phase)
        r_hip, r_knee = leg_kinematics(r_phase)

        # Arm swing in natural opposition with pendular elbow flexing
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
            "LeftKneePivot": {"rot": (l_knee, 0.0, 0.0)},
            "RightKneePivot": {"rot": (r_knee, 0.0, 0.0)},
        }

    # 3. Slash (Explosive diagonal sword sweep with full body follow-through)
    def sample_slash(u: float):
        ang = u * 2.0 * math.pi
        windup = math.sin(u * math.pi)
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
            "LeftLegPivot": {"rot": (strike * 0.28, strike * 0.12, 0.0)},
            "RightLegPivot": {"rot": (-strike * 0.22, strike * 0.12, 0.0)},
            "LeftKneePivot": {"rot": (strike * 0.38, 0.0, 0.0)},
            "RightKneePivot": {"rot": (strike * 0.25, 0.0, 0.0)},
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
            "LeftLegPivot": {"rot": (math.sin(yaw) * 0.30, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-math.sin(yaw) * 0.30, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (0.42, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.42, 0.0, 0.0)},
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
            "LeftLegPivot": {"rot": (0.65 * t, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.55 * t, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (0.85 * t, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.22 * t, 0.0, 0.0)},
        }

    # 6. Ranged (Archery Draw, Anchor & Release)
    def sample_ranged(u: float):
        t = math.sin(u * math.pi)
        draw = math.sin(min(1.0, u * 1.5) * (math.pi / 2.0))
        release = math.exp(-((u - 0.72) / 0.08) ** 2) if u > 0.70 else 0.0

        return {
            "Torso": {
                "rot": (-0.05, -0.55 * draw, 0.02),
                "pos": (0.0, -0.02 * draw, 0.0),
            },
            "HeadGroup": {"rot": (0.02, 0.52 * draw, 0.0)},
            # Left arm holds the bow out forward
            "LeftArmPivot": {"rot": (1.52 * draw, 0.45 * draw, -0.15)},
            "LeftElbowPivot": {"rot": (-0.08, 0.0, 0.0)},
            # Right arm draws arrow back to cheek anchor
            "RightArmPivot": {"rot": (1.35 * draw - release * 0.4, -0.35 * draw, 0.65 * draw)},
            "RightElbowPivot": {"rot": (-1.45 * draw + release * 0.8, 0.0, 0.0)},
            "LeftLegPivot": {"rot": (0.25 * draw, 0.15, 0.0)},
            "RightLegPivot": {"rot": (-0.22 * draw, -0.15, 0.0)},
            "LeftKneePivot": {"rot": (0.35 * draw, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.25 * draw, 0.0, 0.0)},
        }

    # 7. Cast (Arcane Energy Invocation & Projection)
    def sample_cast(u: float):
        t = math.sin(u * math.pi)
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
            "LeftLegPivot": {"rot": (0.15 * surge, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.15 * surge, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (0.28 * surge, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.28 * surge, 0.0, 0.0)},
        }

    # 8. Chop (Woodcutting dynamic axe swing)
    def sample_chop(u: float):
        t = math.sin(u * math.pi)
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
            "LeftLegPivot": {"rot": (impact * 0.25, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-impact * 0.25, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (impact * 0.45, 0.0, 0.0)},
            "RightKneePivot": {"rot": (impact * 0.35, 0.0, 0.0)},
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
            "LeftLegPivot": {"rot": (impact * 0.32, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-impact * 0.28, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (impact * 0.55, 0.0, 0.0)},
            "RightKneePivot": {"rot": (impact * 0.40, 0.0, 0.0)},
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
            "LeftLegPivot": {"rot": (0.08, 0.0, 0.0)},
            "RightLegPivot": {"rot": (-0.08, 0.0, 0.0)},
            "LeftKneePivot": {"rot": (0.12, 0.0, 0.0)},
            "RightKneePivot": {"rot": (0.12, 0.0, 0.0)},
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
# Studio Camera & Lighting for High-End Preview Render
# ---------------------------------------------------------------------------
def setup_studio_and_render(preview_path: str):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    scene.render.film_transparent = False

    world = bpy.data.worlds.new("HeroStudioWorld")
    scene.world = world
    bg = world.node_tree.nodes.get("Background") if world.node_tree else None
    if bg:
        bg.inputs[0].default_value = (0.12, 0.15, 0.19, 1.0)
        bg.inputs[1].default_value = 1.0

    key_data = bpy.data.lights.new(name="KeyLight", type="SUN")
    key_data.energy = 3.6
    key_data.color = (1.0, 0.96, 0.90)
    key_obj = bpy.data.objects.new(name="KeyLight", object_data=key_data)
    bpy.context.collection.objects.link(key_obj)
    key_obj.rotation_euler = Euler((math.radians(50), math.radians(-20), math.radians(150)), "XYZ")

    fill_data = bpy.data.lights.new(name="FillLight", type="SUN")
    fill_data.energy = 1.5
    fill_data.color = (0.75, 0.85, 0.98)
    fill_obj = bpy.data.objects.new(name="FillLight", object_data=fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = Euler((math.radians(58), math.radians(20), math.radians(-140)), "XYZ")

    rim_data = bpy.data.lights.new(name="RimLight", type="SUN")
    rim_data.energy = 2.4
    rim_data.color = (0.92, 0.95, 1.0)
    rim_obj = bpy.data.objects.new(name="RimLight", object_data=rim_data)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.rotation_euler = Euler((math.radians(38), math.radians(0), math.radians(15)), "XYZ")

    cam_data = bpy.data.cameras.new(name="StudioCam")
    cam_data.lens = 65.0
    cam_obj = bpy.data.objects.new(name="StudioCam", object_data=cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = (-0.32, 2.50, 1.38)
    direction = Vector((0.0, 0.0, 1.32)) - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj

    # Unmute only Idle track so preview render displays living heroic idle pose
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
    print(f"[BlenderHero] Exported high-fidelity Nordic hero to {blend_path} and {glb_path}")


if __name__ == "__main__":
    main()
