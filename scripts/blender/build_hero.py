"""
Build the authentic Game Anime RPG Character (BlendSwap #4503 by uchiha007)
directly from Kai blend and export hero glb and hero blend: one skin on the
biped rig with the author's own weights, bound in the author's pose at the
author's joints, and the 10 clips keyed on its bones (models pass H3a); the face carved into planes,
the hands 15% larger and the paint layer (H3b); the hair as a carved mass of large swept spikes in
today's silhouette, blue irises with dark pupils, ears and a warmer skin (H3c).
"""

import bpy
import bmesh
import os
import sys
import math
from mathutils import Vector, Euler, Quaternion
from mathutils.bvhtree import BVHTree

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
SKIN = ("Head", "Hands")

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


# H3b (design 5.2 to 5.4), in Blender space: +Z up, +Y is the hero's front, +X the hero's right.
HAND_SCALE = 1.15  # hands 15% over life, each about its own bounds centre, so the mounts hold
CREASE = math.radians(32.0)  # head and hair edges sharper than this are hard (the pilot's value)
PLANE_SPREAD = math.radians(40.0)  # a plane holds the faces within this angle of its first face
PLANE_MIN = 0.01  # a plane under this share of the part's area joins a neighbour
PLANE_TONE = (-0.25, 0.15)  # a plane facing PLANE_LIGHT is 15% lighter, one facing away 25% darker
PLANE_LIGHT = Vector((0.0, 1.0, 1.0)).normalized()  # up and forward
OCCLUSION = 0.35  # bake_paint's occlusion strength
HEAD_SPREAD = math.radians(26.0)  # the face's planes are tighter, so cheek, brow, nose and jaw each get one (H3c)
HEAD_SHIFT_MAX = 0.005  # the face edits and the ears may move the Head's bounds centre this far (mount tolerance 0.01)
HAIR_TOP_MAX = 1.8503  # the shipped hair's top; the figure's bounds hold (3%, H3a)
HAIR_BOUNDS_SLACK = 0.004  # the new hair stays inside the shipped hair's bounds by this (today's silhouette, H3c)
STRAND_MIN = 0.044  # design 5.3 rule 5: no spike thinner than this before its last third
EAR_REACH = 0.015  # each ear's rim stands this far outside the Head's half-width
EAR_SIZE = (0.044, 0.058)  # front to back, bottom to top: over 0.044, so it reads at 8.5
# The engine draws part 'eye' with a white material, so the Eyes' paint is the colour itself (sRGB hex).
EYE_WHITE, EYE_IRIS, EYE_PUPIL = 0xE9EDF2, 0x227CD4, 0x0E1620  # the iris is the shipped Mat_Eyes blue
IRIS_SIZE = (0.036, 0.044)  # across, tall, in an eye 0.050 by 0.047 at its inner edge: the lids cut it
PUPIL_SIZE = (0.014, 0.020)
# The skin's paint (Head and Hands): a warm multiplier under the engine's skin colour, and a value v shaded
# as (v^r, v^g, v^b), so a plane turned from the light goes to a warm brown and not to grey.
SKIN_WARM = (1.0, 0.90, 0.80)
SKIN_SHADE = (0.70, 1.0, 1.25)


def srgb_linear(hex_colour: int) -> tuple:
    """COLOR_0 is linear; the engine's colours are sRGB hex."""
    chans = [((hex_colour >> s) & 255) / 255.0 for s in (16, 8, 0)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in chans)


def _bump(d: float, r: float) -> float:
    """1 at d = 0, falling smoothly to 0 at |d| = r."""
    t = d / r
    return (1.0 - t * t) ** 2 if abs(t) < 1.0 else 0.0


def bounds_centre(cos) -> Vector:
    cos = list(cos)
    return Vector([(min(c[i] for c in cos) + max(c[i] for c in cos)) / 2 for i in range(3)])


def carve_face(head) -> None:
    """
    Planes that read at 260 px (design 5.1, 5.2): a brow shelf over the eyes, a longer nose wedge,
    a squarer chin and jaw corners. Vertices move; none is added, so the author's weights hold.
    """
    cx = bounds_centre(v.co for v in head.data.vertices).x
    for v in head.data.vertices:
        c, n = v.co, v.normal
        dx = c.x - cx
        if c.y < 0.04 or n.y < 0.2:
            continue  # the face only
        brow = _bump(c.z - 1.737, 0.018) * _bump(dx, 0.09)  # clear of the eyes' top at 1.717 (H3c)
        nose = _bump(dx, 0.024) * _bump(c.z - 1.668, 0.032) * (c.y > 0.11)
        chin = _bump(dx, 0.04) * _bump(c.z - 1.575, 0.028)
        c.y += 0.014 * brow + 0.008 * nose + 0.008 * chin
        c.z -= 0.003 * brow
        corner = _bump(c.z - 1.595, 0.04) * _bump(c.y - 0.05, 0.07) * (abs(dx) > 0.025)
        c.x = cx + dx * (1.0 + 0.10 * corner)
        # H3c: a cheekbone under each eye and a hollow below it, so the cheek is a plane of its own
        side = _bump(abs(dx) - 0.06, 0.03)
        cheek = 0.006 * side * _bump(c.z - 1.662, 0.022) - 0.005 * side * _bump(c.z - 1.618, 0.024)
        c.x += n.x * cheek
        c.y += n.y * cheek
    head.data.update()


def build_ears(head) -> None:
    """
    H3c: an ear a side on the Head mesh, a flat-faced wedge that stands off the skull at the back with a
    sunk bowl, EAR_SIZE across so it reads at 8.5 (design 5.3 rule 5). Both rims are at one distance from
    the Head's bounds centre, so that centre (the helm's mount, pinned in the manifest) does not move in x.
    The new vertices are the author's 'head' group whole, which folds onto HeadGroup.
    """
    cos = [v.co for v in head.data.vertices]
    cx = bounds_centre(cos).x
    half = (max(c.x for c in cos) - min(c.x for c in cos)) / 2
    group = head.vertex_groups["head"].index
    bm = bmesh.new()
    bm.from_mesh(head.data)
    dl = bm.verts.layers.deform.verify()
    skull = BVHTree.FromBMesh(bm)
    d, h = EAR_SIZE
    y0, z0 = 0.030, 1.652  # the ear's lower front corner: behind the jaw's hinge, from nose tip to brow
    outline = [(0.012, 0.0, 0.2), (d * 0.9, h * 0.30, 0.25), (d, h * 0.80, 0.55), (d * 0.55, h, 1.0), (0.0, h * 0.78, 1.0), (-0.004, h * 0.25, 0.7)]
    for side in (-1, 1):
        inner, outer = [], []
        for back, up, off in outline:
            y, z = y0 - back, z0 + up
            hit = skull.ray_cast(Vector((cx + side * 0.4, y, z)), Vector((-side, 0.0, 0.0)))[0]
            assert hit is not None, f"Head: no skull under the ear at y {y:.3f}, z {z:.3f}"
            inner.append(bm.verts.new((hit.x - side * 0.012, y, z)))
            x = hit.x + side * 0.006 + (cx + side * (half + EAR_REACH) - hit.x - side * 0.006) * off
            outer.append(bm.verts.new((x, y - 0.012 * off, z)))
        bowl = sum((v.co for v in outer), Vector()) / len(outer)
        bowl = bm.verts.new((bowl.x - side * 0.010, bowl.y + 0.004, bowl.z))
        faces = []
        k = len(outline)
        for i in range(k):
            j = (i + 1) % k
            faces.append(bm.faces.new((inner[i], inner[j], outer[j], outer[i])))
            faces.append(bm.faces.new((outer[i], outer[j], bowl)))
        for v in inner + outer + [bowl]:
            v[dl][group] = 1.0
        bmesh.ops.recalc_face_normals(bm, faces=faces)
    bm.to_mesh(head.data)
    bm.free()
    head.data.update()


def build_eyes(eyes) -> None:
    """
    H3c: an iris and a pupil on each eye of the rigid Eyes mesh: two flat fans that lie on the source's
    eye surface, the iris 0.002 and the pupil 0.004 proud of it; a point past the eye's edge is moved
    onto it, so the lids cut the iris. Each face is tagged in the face
    attribute 'eye' (0 white, 1 iris, 2 pupil), which paint() turns into the colour and removes.
    """
    bm = bmesh.new()
    bm.from_mesh(eyes.data)
    bm.normal_update()
    kind = bm.faces.layers.int.new("eye")
    surface = BVHTree.FromBMesh(bm)
    cx = bounds_centre(v.co for v in bm.verts).x
    for side in (-1, 1):
        faces = [f for f in bm.faces if (f.calc_center_median().x - cx) * side > 0]
        centre = bounds_centre(v.co for f in faces for v in f.verts)
        n = sum((f.normal * f.calc_area() for f in faces), Vector()).normalized()
        if n.y < 0:
            n = -n  # the eye looks forward whatever the source's winding
        u = Vector((0.0, 0.0, 1.0)).cross(n).normalized()
        v = n.cross(u)

        def on_eye(a, b, proud):
            p = centre + u * a + v * b
            hit = surface.ray_cast(p + n * 0.05, -n)[0]
            if hit is None:  # past the lid: the iris is cut by the eye's own outline
                hit = surface.find_nearest(p)[0]
            return bm.verts.new(hit + n * proud)

        for size, sides, proud, tag in ((IRIS_SIZE, 8, 0.002, 1), (PUPIL_SIZE, 6, 0.004, 2)):
            hub = on_eye(0.0, 0.0, proud + 0.0005)
            rim = [on_eye(size[0] / 2 * math.cos(2 * math.pi * (i + 0.5) / sides), size[1] / 2 * math.sin(2 * math.pi * (i + 0.5) / sides), proud)
                   for i in range(sides)]
            for i in range(sides):
                f = bm.faces.new((hub, rim[i], rim[(i + 1) % sides]))
                f.smooth = True
                f.normal_update()
                if f.normal.dot(n) < 0:
                    f.normal_flip()
                f[kind] = tag
    bm.to_mesh(eyes.data)
    bm.free()


def grow_hands(hands) -> None:
    """
    Each hand (one loose piece a side) 15% larger about its own bounds centre (design 5.2). The source's
    hand faces point into the hand (180 of 180 normal rays hit the hand within 0.1), which makes bake_paint's
    AO read every hand vertex as fully occluded; they are turned outward here, before paint().
    """
    bm = bmesh.new()
    bm.from_mesh(hands.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for side in (-1, 1):
        verts = [v for v in bm.verts if v.co.x * side > 0]
        centre = bounds_centre(v.co for v in verts)
        for v in verts:
            v.co = centre + (v.co - centre) * HAND_SCALE
    bm.to_mesh(hands.data)
    bm.free()


def _spike(bm, p0, p1, p2, centre, width, thick, rings=4) -> None:
    """One spike: a blade of diamond section along a quadratic curve, flat-faced, tapering to a point.
    Its root stands inside the cap. STRAND_MIN wide or more until its last third."""
    p0, p1, p2 = Vector(p0), Vector(p1), Vector(p2)
    taper = lambda t: 1.0 - 0.8 * t * t
    assert width * taper(2 / 3) >= STRAND_MIN, f"Hair: a spike {width} wide is under {STRAND_MIN} before its last third"
    sections = []
    for i in range(rings):
        t = i / (rings - 1)
        at = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2
        if i == rings - 1:
            sections.append([bm.verts.new(at)])
            break
        tangent = (2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1)).normalized()
        out = at - centre
        out = (out - tangent * out.dot(tangent)).normalized()
        side = tangent.cross(out)
        w, th = width * taper(t) / 2, thick * taper(t)
        sections.append([bm.verts.new(at + side * w), bm.verts.new(at + out * th * 0.7),
                         bm.verts.new(at - side * w), bm.verts.new(at - out * th * 0.3)])
    bm.faces.new(sections[0])
    for a, b in zip(sections, sections[1:]):
        for j in range(4):
            if len(b) == 1:
                bm.faces.new((a[j], b[0], a[(j + 1) % 4]))
            else:
                bm.faces.new((a[j], b[j], b[(j + 1) % 4], a[(j + 1) % 4]))


# The spikes (H3c), read off the shipped hair (before-hero-turnaround.jpg, the head-close sheet's top row):
# (root, bend, tip) as (x from the head's centre line, y, z), then width and thickness. +x is the hero's
# right, +y its front. A fringe of three swept to the hero's right with the long one between the eyes, two
# wings a side that flare out over and behind the ear (the right pair wider, as today), two across the
# crown, two down the back of the skull and three down the nape.
SPIKES = (
    ((0.020, 0.085, 1.800), (0.000, 0.168, 1.792), (0.014, 0.150, 1.700), 0.085, 0.034),   # fringe, centre
    ((0.052, 0.075, 1.790), (0.092, 0.150, 1.782), (0.090, 0.128, 1.712), 0.080, 0.032),   # fringe, right
    ((-0.040, 0.080, 1.795), (-0.074, 0.156, 1.790), (-0.060, 0.142, 1.728), 0.076, 0.032),  # fringe, left
    ((0.065, 0.040, 1.780), (0.150, 0.045, 1.765), (0.172, 0.000, 1.690), 0.084, 0.036),   # right wing
    ((0.072, -0.020, 1.740), (0.128, -0.036, 1.690), (0.132, -0.058, 1.612), 0.074, 0.030),  # right, behind the ear
    ((-0.065, 0.040, 1.780), (-0.130, 0.045, 1.768), (-0.142, 0.004, 1.702), 0.080, 0.036),  # left wing
    ((-0.072, -0.020, 1.740), (-0.120, -0.038, 1.700), (-0.112, -0.056, 1.628), 0.072, 0.030),  # left, behind the ear
    ((0.045, -0.010, 1.795), (0.000, 0.020, 1.842), (-0.078, 0.050, 1.834), 0.074, 0.022),  # crown, ending in the cowlick
    ((-0.035, 0.000, 1.795), (0.020, -0.030, 1.840), (0.088, -0.055, 1.790), 0.072, 0.022),  # crown, down the back right
    ((0.030, -0.015, 1.800), (0.062, -0.080, 1.765), (0.052, -0.070, 1.668), 0.080, 0.022),  # back of the skull, right
    ((-0.035, -0.015, 1.800), (-0.064, -0.080, 1.770), (-0.048, -0.068, 1.682), 0.080, 0.022),  # back of the skull, left
    ((0.000, -0.035, 1.735), (0.000, -0.076, 1.655), (0.008, -0.060, 1.556), 0.090, 0.022),  # nape, centre
    ((0.055, -0.025, 1.735), (0.088, -0.070, 1.668), (0.096, -0.052, 1.580), 0.080, 0.022),  # nape, right
    ((-0.055, -0.025, 1.735), (-0.086, -0.070, 1.676), (-0.090, -0.050, 1.594), 0.080, 0.022),  # nape, left
)


def build_hair(head, bounds):
    """
    H3c (design 5.2, 5.3): the hair as a carved mass that keeps the shipped hair's silhouette: a
    flat-faced cap over the skull, sunk into the head below the hairline, and the SPIKES, each a
    flat-faced blade. Nothing is fused or smoothed: every face is a chosen plane. The form stays inside
    `bounds`, the shipped hair's (low, high) corners, and covers the scalp. Returns a new mesh object.
    """
    cx = bounds_centre(v.co for v in head.data.vertices).x
    centre = Vector((cx, 0.04, 1.705))

    def hairline(co):
        """Over the brow at the front, above the ear's top at the side, down to the nape behind the ear."""
        step = lambda t: min(max(t, 0.0), 1.0) ** 2 * (3 - 2 * min(max(t, 0.0), 1.0))
        return 1.60 + 0.128 * step((co.y + 0.06) / 0.03) + 0.02 * step((co.y - 0.03) / 0.09)

    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        v.co = centre + Vector((v.co.x * 0.110, v.co.y * 0.116, v.co.z * 0.128))
        if v.co.z < hairline(v.co):
            v.co = centre + (v.co - centre) * 0.62  # under the hairline the cap is inside the head
    for p0, p1, p2, width, thick in SPIKES:
        _spike(bm, *(Vector((cx + p[0], p[1], p[2])) for p in (p0, p1, p2)), centre, width, thick)
    bm.normal_update()

    low, high = bounds
    for i in range(3):
        lo, hi = min(v.co[i] for v in bm.verts), max(v.co[i] for v in bm.verts)
        assert lo >= low[i] - HAIR_BOUNDS_SLACK and hi <= high[i] + HAIR_BOUNDS_SLACK, \
            f"Hair: axis {i} runs {lo:.4f} to {hi:.4f}, outside the shipped hair's {low[i]:.4f} to {high[i]:.4f}"
    assert max(v.co.z for v in bm.verts) <= HAIR_TOP_MAX, "Hair: over the shipped hair's top"
    print("[BlenderHero] Hair bounds " + ", ".join(
        f"{min(v.co[i] for v in bm.verts):.3f} to {max(v.co[i] for v in bm.verts):.3f} (shipped {low[i]:.3f} to {high[i]:.3f})" for i in range(3)))

    # the scalp is covered: from every Head vertex well above the hairline, the way out meets hair
    tree = BVHTree.FromBMesh(bm)
    bare = [v.index for v in head.data.vertices
            if v.co.z > hairline(v.co) + 0.03 and tree.ray_cast(v.co, (v.co - centre).normalized(), 0.12)[0] is None]
    assert not bare, f"Hair: {len(bare)} scalp vertices show through"

    me = bpy.data.meshes.new("HairNew")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("HairNew", me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mark_planes(ob, spread=PLANE_SPREAD) -> None:
    """
    The pilot's planes (baseline README, pattern step 3): from the largest free face a plane grows
    across edges under CREASE to faces within PLANE_SPREAD of that face; a plane under PLANE_MIN of
    the area joins the neighbour it faces most nearly. Edges between two planes, edges over CREASE
    and open edges (the neck's cut) are hard; the exporter splits them, so the planes read in the
    engine's smooth shading.
    """
    assert not ob.data.has_custom_normals, f"{ob.name}: custom normals would override the hard edges"
    for p in ob.data.polygons:
        p.use_smooth = True
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    angle = lambda e: e.calc_face_angle(math.pi)  # an open edge counts as a crease
    plane = [-1] * len(bm.faces)
    normals, areas = [], []
    for seed in sorted(bm.faces, key=lambda f: -f.calc_area()):
        if plane[seed.index] >= 0:
            continue
        plane[seed.index] = len(normals)
        queue, normal, area = [seed], Vector(), 0.0
        for f in queue:
            normal += f.normal * f.calc_area()
            area += f.calc_area()
            for e in f.edges:
                if angle(e) >= CREASE:
                    continue
                for g in e.link_faces:
                    if plane[g.index] < 0 and g.normal.angle(seed.normal, 0.0) < spread:
                        plane[g.index] = len(normals)
                        queue.append(g)
        normals.append(normal.normalized())
        areas.append(area)
    total = sum(areas)
    for small in sorted(range(len(areas)), key=lambda i: areas[i]):
        if areas[small] >= PLANE_MIN * total:
            continue
        faces = [f for f in bm.faces if plane[f.index] == small]
        near = {plane[g.index] for f in faces for e in f.edges for g in e.link_faces} - {small}
        if not near:
            continue  # a loose face of its own (none is built)
        into = max(near, key=lambda i: normals[i].dot(normals[small]))
        for f in faces:
            plane[f.index] = into
        normals[into] = (normals[into] * areas[into] + normals[small] * areas[small]).normalized()
        areas[into] += areas[small]
        areas[small] = total  # gone
    for e in bm.edges:
        lf = e.link_faces
        e.smooth = len(lf) == 2 and plane[lf[0].index] == plane[lf[1].index] and angle(e) < CREASE
    bm.to_mesh(ob.data)
    bm.free()
    kept = sorted({p for p in plane}, key=lambda i: -areas[i])
    print(f"[BlenderHero] {ob.name}: {len(kept)} planes on {len(plane)} faces, largest {areas[kept[0]] / total:.1%} of the area")


def plane_tones(ob) -> list:
    """One tone per face, the same for every face of a plane: the smooth faces joined by edges that
    are not hard, toned by their area-weighted normal against PLANE_LIGHT (the pilot's step 6)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    plane = [-1] * len(bm.faces)
    tones = []
    for seed in bm.faces:
        if plane[seed.index] >= 0:
            continue
        plane[seed.index] = len(tones)
        stack, normal, area = [seed], Vector(), 0.0
        while stack:
            f = stack.pop()
            normal += f.normal * f.calc_area()
            area += f.calc_area()
            for e in f.edges:
                if e.smooth:
                    for g in e.link_faces:
                        if plane[g.index] < 0:
                            plane[g.index] = len(tones)
                            stack.append(g)
        s = normal.dot(PLANE_LIGHT) / area  # a plane that wraps round a form averages to no tone
        tones.append(1.0 + s * (PLANE_TONE[1] if s > 0.0 else -PLANE_TONE[0]))
    bm.free()
    print(f"[BlenderHero] {ob.name} tones: {len(tones)} planes, {min(tones):.3f} to {max(tones):.3f}")
    return [tones[i] for i in plane]


def paint(rig, toned) -> None:
    """
    Design 5.4 and 6.3, the pilot's step 8: bake_paint's occlusion, height gradient and warm-to-cool
    shift (one value a vertex), times the plane tone of the parts in `toned` (one value a face),
    written as one 'Col' layer on the face corners. Tone only: the engine sets every hero colour and
    recolours the role materials; the layer multiplies them. Two exceptions (H3c): the skin (Head, Hands)
    is shaded warm (SKIN_WARM, SKIN_SHADE), and the Eyes carry their colours whole (white, iris, pupil by
    the face attribute build_eyes left), since the engine's eye material is white. Every mesh carries it
    (COLOR_0 is all or none on the hero file). The paint can only darken the material, so a toned
    part's tones are divided by the lightest one: its neutral planes sit 13% under its lit planes,
    which are the baked value itself, and no corner is clipped at white.
    """
    figkit.bake_paint(rig, ao=OCCLUSION)
    for ob in figkit.get_descendant_meshes(rig):
        attrs = ob.data.color_attributes
        baked = [0.0] * (4 * len(ob.data.vertices))
        attrs["Col"].data.foreach_get("color", baked)
        lift = 1.0 + PLANE_TONE[1]
        tones = [t / lift for t in plane_tones(ob)] if ob in toned else [1.0] * len(ob.data.polygons)
        loops = ob.data.loops
        cols = [1.0] * (4 * len(loops))
        for p, tone in zip(ob.data.polygons, tones):
            for li in p.loop_indices:
                vi = loops[li].vertex_index
                for c in range(3):
                    cols[4 * li + c] = baked[4 * vi + c] * tone
                if ob.name in SKIN:
                    for c in range(3):
                        cols[4 * li + c] = SKIN_WARM[c] * cols[4 * li + c] ** SKIN_SHADE[c]
        if ob.name == "Eyes":
            eye = ob.data.attributes["eye"]
            colours = [srgb_linear(h) for h in (EYE_WHITE, EYE_IRIS, EYE_PUPIL)]
            for p in ob.data.polygons:
                for li in p.loop_indices:
                    cols[4 * li:4 * li + 3] = colours[eye.data[p.index].value]
            ob.data.attributes.remove(eye)
        assert max(cols) <= 1.0, f"{ob.name}: a paint value over 1 would be clipped at white"
        attrs.remove(attrs["Col"])
        attrs.new("Col", "FLOAT_COLOR", "CORNER").data.foreach_set("color", cols)
        attrs.active_color = attrs["Col"]
        attrs.render_color_index = attrs.active_color_index


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

    # 4b. H3b: the face's planes, the hands 15% larger (design 5.2 to 5.4). H3c: ears, irises and pupils,
    #     and the hair as large swept spikes inside the shipped hair's bounds.
    head, hair = bpy.data.objects["Head"], bpy.data.objects["Hair"]
    head_centre = bounds_centre(v.co for v in head.data.vertices)
    carve_face(head)
    build_ears(head)
    shift = (bounds_centre(v.co for v in head.data.vertices) - head_centre).length
    assert shift <= HEAD_SHIFT_MAX, f"Head: the face edits and the ears moved its centre {shift:.4f}, over {HEAD_SHIFT_MAX}"
    print(f"[BlenderHero] face carved, ears added; Head centre moved {shift:.4f}")
    grow_hands(bpy.data.objects["Hands"])
    build_eyes(bpy.data.objects["Eyes"])
    hair_cos = [v.co for v in hair.data.vertices]
    new_hair = build_hair(head, tuple(Vector([f(c[i] for c in hair_cos) for i in range(3)]) for f in (min, max)))
    old_hair_data = hair.data
    hair.data = new_hair.data
    bpy.data.objects.remove(new_hair, do_unlink=True)
    bpy.data.meshes.remove(old_hair_data)
    mark_planes(head, HEAD_SPREAD)
    mark_planes(hair)

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
        while obj.data.color_attributes:  # the source's own layers; paint() writes the one exported
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
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        held = sorted({obj.vertex_groups[g.group].name for v in obj.data.vertices for g in v.groups if g.weight > 0.01})
        print(f"[BlenderHero] {name}: {len(obj.data.vertices)} vertices, {tris} triangles, bones {held}")

    # 6b. Paint in the bind pose, before the armature modifiers (H3b)
    paint(rig, (head, hair))
    for obj in specs:
        obj.modifiers.new("Armature", "ARMATURE").object = rig

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
