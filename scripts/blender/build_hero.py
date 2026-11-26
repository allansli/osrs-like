"""
Build the authentic Game Anime RPG Character (BlendSwap #4503 by uchiha007)
directly from Kai blend and export hero glb and hero blend: one skin on the
biped rig with the author's own weights, bound in the author's pose at the
author's joints, and the 10 clips keyed on its bones (models pass H3a); the face carved into planes,
the hands 15% larger and the paint layer (H3b); the hair as a carved mass of large swept spikes in
today's silhouette, blue irises with dark pupils, ears and a warmer skin (H3c); the biped library, eleven
clips as pose tables on a twelve-a-second grid with the feet held on the ground, and Death (H4).
"""

import bpy
import bmesh
import os
import sys
import math
from mathutils import Vector, Euler, Quaternion
from mathutils.bvhtree import BVHTree
import numpy as np

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
GROUND_TOL = 0.002  # H4: after the ground lock every frame's lowest point is within this of the ground
GROUND_SINK = 0.01  # H4: Walk's smoothed heights let a foot into the ground by this much at most
DEATH_LIE_MAX = -0.6  # H4: Death ends with the hips at least this far under their rest (0.963): lying


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
        middle = sum((v.co for v in inner + outer), Vector()) / (2 * k)
        flipped = 0
        for f in faces:  # every face looks away from the ear's own middle (the paint's occlusion needs it)
            f.normal_update()
            if f.normal.dot(f.calc_center_median() - middle) < 0:
                f.normal_flip()
                flipped += 1
        print(f"[BlenderHero] ear {side:+d}: {len(faces)} faces, {flipped} turned outward")
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
        assert near, f"{ob.name}: plane {small} is under PLANE_MIN and has no neighbour to join"
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
FPS = 24
GRID = 2  # a key every second frame: the twelve-a-second pose grid (design 5.7, 6.5)


def _smooth(t):
    return t * t * (3.0 - 2.0 * t)


EASE = {
    "io": _smooth,  # starts and stops at rest
    "in": lambda t: t * t,  # leaves at rest and arrives at speed: a strike, a fall
    "out": lambda t: 1.0 - (1.0 - t) * (1.0 - t),  # leaves at speed and settles: an impact, a landing
    "lin": lambda t: t,  # constant speed: the body of a spin
}


def _catmull(p0, p1, p2, p3, t):
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)


def pose_table(name, frames, base, keys, loop=False):
    """
    H4 (design 6.5): a clip as a short pose table, sampled per frame. `keys` are (frame, pose name, overrides,
    ease): each key's pose is `base` with its overrides, on the twelve-a-second grid (an even frame), the first
    at 0 and the last at `frames` (the clip's end, one frame past its last exported frame) or, for a one-shot
    that holds its last pose, at `frames - 1`. `ease` shapes the move into that key; "cr" is a Catmull-Rom
    curve through the neighbouring keys (wrapped round when `loop`), so a cycle never stops at a key. Values
    are three-space Euler triples (three's YZX order) per bone and "HipsPos", the Hips sideways and forward offset, as build_action
    reads them. Returns sample(u) for u = f / frames, with the keys' frames and names on `.keys`.
    """
    poses = []
    for frame, pose_name, over, ease in keys:
        assert frame % GRID == 0 or frame == frames, f"{name}: key {pose_name} at frame {frame} is off the 12/s grid"
        assert not set(over) - set(base), f"{name}: key {pose_name} names {sorted(set(over) - set(base))}, not in the base pose"
        assert ease == "cr" or ease in EASE, f"{name}: key {pose_name} has unknown ease {ease}"
        poses.append((frame, pose_name, {**base, **over}, ease))
    frames_at = [p[0] for p in poses]
    assert frames_at[0] == 0 and all(a < b for a, b in zip(frames_at, frames_at[1:])), f"{name}: keys out of order {frames_at}"
    assert frames_at[-1] in (frames, frames - 1), f"{name}: the last key is at {frames_at[-1]}, not the clip's end"
    if loop:
        assert frames_at[-1] == frames and poses[-1][2] == poses[0][2], f"{name}: a loop ends on its first pose"

    def neighbour(i):
        if 0 <= i < len(poses):
            return poses[i][2]
        if loop:  # the last key repeats the first
            return poses[i % (len(poses) - 1)][2]
        return poses[min(max(i, 0), len(poses) - 1)][2]

    def sample(u):
        f = u * frames
        for i in range(len(poses) - 1):
            f0, f1 = poses[i][0], poses[i + 1][0]
            if f0 <= f <= f1:
                t = (f - f0) / (f1 - f0)
                p1, p2, ease = poses[i][2], poses[i + 1][2], poses[i + 1][3]
                if ease == "cr":
                    p0, p3 = neighbour(i - 1), neighbour(i + 2)
                    return {b: tuple(_catmull(p0[b][c], p1[b][c], p2[b][c], p3[b][c], t) for c in range(3)) for b in p1}
                e = EASE[ease](t)
                return {b: tuple(p1[b][c] + (p2[b][c] - p1[b][c]) * e for c in range(3)) for b in p1}
        raise ValueError(f"{name}: frame {f} is past the last key")

    sample.keys = [(p[0], p[1]) for p in poses]
    return sample


def _lowest(meshes):
    """The lowest point of the posed body (Blender z, the figure's height)."""
    dg = bpy.context.evaluated_depsgraph_get()
    low = math.inf
    for ob in meshes:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        co = np.empty(3 * len(me.vertices))
        me.vertices.foreach_get("co", co)
        mw = np.array(ev.matrix_world)
        z = (co.reshape(-1, 3) @ mw[2, :3]) + mw[2, 3]
        ev.to_mesh_clear()
        low = min(low, float(z.min()))
    return low


def build_action(rig, action_name: str, total_frames: int, sample_fn, feet_level_with="ground", smooth_loop=False):
    """Keys one clip on the rig's bones (design 6.1.5, H3a's conversion for the chain).

    The pose gives each pivot's rotation as three-space Euler numbers in three's YZX order (Blender XZY,
    design 3.5 S16), in the space of the hips (the figure's space while Hips is not turned); a bone's local
    axes are the figure's (6.1.1 rule 2). HeadGroup and the arms are children of Torso, so their local rotation
    is the torso's inverse times the pose's, except the arms in SpinSlash, which keep their numbers as local
    rotations. Elbows, knees, legs, Torso and Hips are relative to their parents. Frames 0 to total_frames - 1
    at u = f / total_frames, so every clip keeps its length.

    H4: the Hips track (the clips' one position track) holds the figure on the ground. "HipsPos" gives its
    sideways and forward offset; its height is measured, frame by frame, so the posed body's lowest point is
    at the ground: a bent knee or a stride lowers the body by what it takes, and no foot sinks or floats.
    The feet are keyed level: each Foot turns back what its leg and knee turn on x, and with the hips when
    `feet_level_with` is "ground", so the sole meets the ground flat instead of on its toe or heel; Death
    passes "hips", so a lying figure's toes point away from its body. With `smooth_loop` (Walk) the heights are
    smoothed round the cycle where the standing foot changes, never more than GROUND_SINK under the lock.
    Returns the lowest point of the body per frame after that, and the Hips heights.
    """
    rig.animation_data_create()
    action = bpy.data.actions.new(name=action_name)
    rig.animation_data.action = action
    hips = rig.pose.bones["Hips"]
    poses = [sample_fn(f / float(total_frames)) for f in range(total_frames)]
    for f, pose in enumerate(poses):
        torso_inv = Euler(pose["Torso"], "XZY").to_quaternion().inverted()
        for p_name, value in pose.items():
            if p_name == "HipsPos":
                continue
            q = Euler(value, "XZY").to_quaternion()
            if p_name == "HeadGroup" or (p_name in ARM_BONES and action_name != "SpinSlash"):
                q = torso_inv @ q
            pb = rig.pose.bones[p_name]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
        for side in ("Left", "Right"):
            tilt = pose[f"{side}LegPivot"][0] + pose[f"{side}KneePivot"][0]
            if feet_level_with == "ground" and "Hips" in pose:  # only clips whose base pose names Hips turn it
                tilt += pose["Hips"][0]
            pb = rig.pose.bones[f"{side}Foot"]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = Euler((-tilt, 0.0, 0.0), "XZY").to_quaternion()
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
        offset = pose["HipsPos"]
        assert offset[1] == 0.0, f"{action_name}: HipsPos height is measured, not authored"
        hips.location = Vector(offset)
        hips.keyframe_insert(data_path="location", frame=f)

    meshes = figkit.get_descendant_meshes(rig)
    earlier = list(rig.animation_data.nla_tracks)
    for tr in earlier:  # the clips already pushed would hold their channels under this one
        tr.mute = True
    lock = []
    for f in range(total_frames):  # a Hips move shifts every vertex alike (no vertex is on Root)
        bpy.context.scene.frame_set(f)
        lock.append(-_lowest(meshes))
    heights = list(lock)
    if smooth_loop:
        for _ in range(4):
            n = len(heights)
            heights = [max(lock[i] - GROUND_SINK, (heights[i - 1] + 2 * heights[i] + heights[(i + 1) % n]) / 4) for i in range(n)]
    for f, pose in enumerate(poses):
        hips.location = Vector(pose["HipsPos"]) + Vector((0.0, heights[f], 0.0))
        hips.keyframe_insert(data_path="location", frame=f)
    lows = []
    for f in range(total_frames):
        bpy.context.scene.frame_set(f)
        lo = _lowest(meshes)
        lows.append(lo)
        held = lo >= -GROUND_SINK - GROUND_TOL if smooth_loop else abs(lo) <= GROUND_TOL
        assert held, f"{action_name} frame {f}: lowest point {lo:+.4f} after the ground lock"
    bpy.context.scene.frame_set(0)
    for tr in earlier:
        tr.mute = False

    track = rig.animation_data.nla_tracks.new()
    track.name = action_name
    strip = track.strips.new(action_name, 0, action)
    strip.name = action_name
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    keys = ", ".join(f"{n} {k}" for k, n in sample_fn.keys)
    print(f"[BlenderHero] {action_name}: {total_frames} frames, {(total_frames - 1) / FPS:.4f} s; keys {keys}; "
          f"Hips height {min(heights):+.3f} to {max(heights):+.3f}, lowest point {min(lows):+.3f} to {max(lows):+.3f}; "
          f"Hips height per frame (cm) {' '.join(str(round(100 * h)) for h in heights)}")
    return lows, heights


# The rest pose every clip starts from: today's arm numbers (the A-pose arms brought in by 0.28 on z,
# design 3.5 S14) and elbows bent. Today's Torso pitch sign is read the other way round from its author's
# intent: +x on an upright bone tips it back (the hero faces -z; the shipped Lunge leans back 0.24 while it
# moves forward), so H4 writes a forward lean as a negative x on Torso and on Hips.
ZERO = (0.0, 0.0, 0.0)


def _rest(**over):
    pose = {
        "Torso": ZERO, "HeadGroup": ZERO, "HipsPos": ZERO,
        "LeftArmPivot": (0.10, 0.05, 0.28), "RightArmPivot": (0.10, -0.05, -0.28),
        "LeftElbowPivot": (0.60, 0.0, 0.0), "RightElbowPivot": (0.50, 0.0, 0.0),
        "LeftLegPivot": ZERO, "RightLegPivot": ZERO, "LeftKneePivot": ZERO, "RightKneePivot": ZERO,
    }
    pose.update(over)
    return pose


def _x(v):
    return (v, 0.0, 0.0)


def build_all_animations(rig):
    """The biped library (design 5.7, 6.5): eleven clips as pose tables. Returns each attack clip's
    anticipation time in seconds (the wind-up key, where Stage 4's telegraph stops) and the Death lows."""
    anticipation = {}

    # 1. Idle: breath twice a loop, weight from one leg to the other, a look round (design 5.7)
    idle = pose_table("Idle", 48, _rest(Torso=(-0.025, 0.0, 0.0), HeadGroup=_x(0.015),
                                        LeftElbowPivot=(0.60, -0.05, 0.0), RightElbowPivot=(0.50, 0.05, 0.0)), [
        (0, "weight left", {"Torso": (-0.025, 0.0, 0.015), "HeadGroup": (0.015, -0.03, -0.010),
                            "LeftLegPivot": _x(0.04), "LeftKneePivot": _x(-0.09)}, "cr"),
        (12, "breathe in", {"Torso": (-0.045, 0.012, 0.006), "HeadGroup": (0.025, 0.05, -0.004),
                            "LeftArmPivot": (0.12, 0.05, 0.27), "RightArmPivot": (0.12, -0.05, -0.27),
                            "LeftElbowPivot": (0.64, -0.05, 0.0), "RightElbowPivot": (0.54, 0.05, 0.0),
                            "LeftLegPivot": _x(0.02), "LeftKneePivot": _x(-0.045)}, "cr"),
        (24, "weight right, look", {"Torso": (-0.025, 0.0, -0.015), "HeadGroup": (0.015, 0.11, 0.010),
                                    "RightLegPivot": _x(0.04), "RightKneePivot": _x(-0.09)}, "cr"),
        (36, "breathe in", {"Torso": (-0.045, -0.012, -0.006), "HeadGroup": (0.025, 0.03, 0.004),
                            "LeftArmPivot": (0.12, 0.05, 0.27), "RightArmPivot": (0.12, -0.05, -0.27),
                            "LeftElbowPivot": (0.64, -0.05, 0.0), "RightElbowPivot": (0.54, 0.05, 0.0),
                            "RightLegPivot": _x(0.02), "RightKneePivot": _x(-0.045)}, "cr"),
        (48, "weight left", {"Torso": (-0.025, 0.0, 0.015), "HeadGroup": (0.015, -0.03, -0.010),
                             "LeftLegPivot": _x(0.04), "LeftKneePivot": _x(-0.09)}, "cr"),
    ], loop=True)
    build_action(rig, "Idle", 48, idle)

    # 2. Walk: today's stride and phase; the swing knee folds at the passing pose and the front leg lands
    #    straight; the body is lowest at the contacts; the torso counter-turns the hips; the head stays level.
    def walk_step(lead, trail, sign, lead_leg, lead_knee, trail_leg, trail_knee, arm, yaw):
        """`lead` is the leg ahead; its arm swings back by `arm` and the trailing arm forward; the torso turns
        the trailing shoulder forward by `yaw`, and the head turns it back to look ahead."""
        return {f"{lead}LegPivot": _x(lead_leg), f"{lead}KneePivot": _x(lead_knee),
                f"{trail}LegPivot": _x(trail_leg), f"{trail}KneePivot": _x(trail_knee),
                f"{lead}ArmPivot": (0.10 - arm, 0.05 * sign, 0.28 * sign), f"{trail}ArmPivot": (0.10 + arm, -0.05 * sign, -0.28 * sign),
                f"{lead}ElbowPivot": _x(0.55 - 0.6 * arm), f"{trail}ElbowPivot": _x(0.55 + 0.8 * arm),
                "Torso": (-0.03, yaw * sign, 0.15 * yaw * sign), "HeadGroup": (0.0, -0.5 * yaw * sign, 0.0)}

    def walk_pass(swing, stance):
        return {f"{swing}KneePivot": _x(-0.85), f"{stance}KneePivot": _x(-0.10)}

    # a key every four frames: the swing knee stays folded until the foot has passed the standing one, so the
    # foot clears the ground, and the leg reaches straight only at the contact
    walk = pose_table("Walk", 32, _rest(Torso=_x(-0.03)), [
        (0, "left passes", walk_pass("Left", "Right"), "cr"),
        (4, "left reaches", walk_step("Left", "Right", 1, 0.30, -0.90, -0.25, -0.12, 0.15, 0.04), "cr"),
        (8, "left contact", walk_step("Left", "Right", 1, 0.48, -0.05, -0.48, -0.02, 0.25, 0.07), "cr"),
        (12, "left takes the weight", walk_step("Left", "Right", 1, 0.25, -0.15, -0.30, -0.55, 0.15, 0.04), "cr"),
        (16, "right passes", walk_pass("Right", "Left"), "cr"),
        (20, "right reaches", walk_step("Right", "Left", -1, 0.30, -0.90, -0.25, -0.12, 0.15, 0.04), "cr"),
        (24, "right contact", walk_step("Right", "Left", -1, 0.48, -0.05, -0.48, -0.02, 0.25, 0.07), "cr"),
        (28, "right takes the weight", walk_step("Right", "Left", -1, 0.25, -0.15, -0.30, -0.55, 0.15, 0.04), "cr"),
        (32, "left passes", walk_pass("Left", "Right"), "cr"),
    ], loop=True)
    build_action(rig, "Walk", 32, walk, smooth_loop=True)

    # 3. Slash: today's three beats and arm numbers; the elbow cocks in the wind-up and opens on the strike;
    #    the torso leans into the strike.
    slash_base = _rest(Torso=_x(-0.04), RightElbowPivot=_x(0.45), LeftArmPivot=(0.12, 0.10, 0.28), LeftElbowPivot=_x(0.65),
                       LeftLegPivot=_x(0.12), RightLegPivot=_x(-0.18), LeftKneePivot=_x(-0.10), RightKneePivot=_x(-0.12))
    slash = pose_table("Slash", 24, slash_base, [
        (0, "ready", {}, "io"),
        (6, "wind-up", {"RightArmPivot": (-0.62, -0.38, 0.14), "RightElbowPivot": _x(1.00), "Torso": (-0.04, -0.40, 0.0),
                        "HeadGroup": (0.0, 0.20, 0.0), "LeftArmPivot": (0.25, 0.10, 0.20),
                        "LeftKneePivot": _x(-0.18), "RightKneePivot": _x(-0.20)}, "io"),
        (10, "strike", {"RightArmPivot": (1.15, 0.42, -0.26), "RightElbowPivot": _x(0.22), "Torso": (-0.17, 0.50, 0.0),
                        "HeadGroup": (0.0, -0.25, 0.0), "LeftArmPivot": (-0.10, 0.10, 0.35),
                        "LeftKneePivot": _x(-0.22), "RightKneePivot": _x(-0.16)}, "in"),
        (12, "impact", {"RightArmPivot": (1.28, 0.47, -0.28), "RightElbowPivot": _x(0.20), "Torso": (-0.19, 0.56, 0.0),
                        "HeadGroup": (0.0, -0.27, 0.0), "LeftArmPivot": (-0.10, 0.10, 0.35),
                        "LeftKneePivot": _x(-0.22), "RightKneePivot": _x(-0.16)}, "out"),
        (16, "follow-through", {"RightArmPivot": (0.62, 0.17, -0.28), "RightElbowPivot": _x(0.40), "Torso": (-0.09, 0.25, 0.0),
                                "HeadGroup": (0.0, -0.12, 0.0)}, "io"),
        (24, "settle", {"RightArmPivot": (0.12, -0.04, -0.28), "Torso": (-0.045, 0.02, 0.0)}, "io"),
    ])
    build_action(rig, "Slash", 24, slash)
    anticipation["Slash"] = 6

    # 4. Lunge: re-made (critique E12, design 6.1.5): a wind-back that draws the arm and coils the torso, then
    #    the thrust as hip and torso pitch into a front-knee lunge, in place of the dropped torso translation.
    #    The hips pitch forward 0.10; the legs carry +0.10 so their numbers read in the figure's space.
    lunge = pose_table("Lunge", 24, _rest(RightArmPivot=(0.10, 0.0, -0.28), LeftArmPivot=(0.10, 0.12, 0.28), Hips=ZERO), [
        (0, "ready", {}, "io"),
        (8, "draw back", {"RightArmPivot": (-0.35, 0.05, -0.32), "RightElbowPivot": _x(1.10), "Torso": (0.10, -0.25, 0.0),
                          "HeadGroup": (-0.06, 0.18, 0.0), "LeftArmPivot": (0.50, 0.12, 0.22), "LeftElbowPivot": _x(0.80),
                          "LeftLegPivot": _x(0.18), "RightLegPivot": _x(-0.12), "LeftKneePivot": _x(-0.25), "RightKneePivot": _x(-0.12)}, "io"),
        (12, "thrust", {"RightArmPivot": (1.30, 0.0, -0.12), "RightElbowPivot": _x(0.10), "Torso": (-0.24, 0.18, 0.0),
                        "HeadGroup": (0.06, -0.12, 0.0), "LeftArmPivot": (-0.40, 0.12, 0.30), "LeftElbowPivot": _x(0.50),
                        "Hips": _x(-0.10), "LeftLegPivot": _x(0.55), "RightLegPivot": _x(-0.35),
                        "LeftKneePivot": _x(-0.55), "RightKneePivot": _x(-0.08)}, "in"),
        (14, "extend", {"RightArmPivot": (1.36, 0.0, -0.12), "RightElbowPivot": _x(0.08), "Torso": (-0.27, 0.20, 0.0),
                        "HeadGroup": (0.06, -0.12, 0.0), "LeftArmPivot": (-0.40, 0.12, 0.30), "LeftElbowPivot": _x(0.50),
                        "Hips": _x(-0.10), "LeftLegPivot": _x(0.55), "RightLegPivot": _x(-0.35),
                        "LeftKneePivot": _x(-0.55), "RightKneePivot": _x(-0.08)}, "out"),
        (24, "recover", {}, "io"),
    ])
    build_action(rig, "Lunge", 24, lunge)
    anticipation["Lunge"] = 8

    # 5. Ranged: today's draw; the string hand snaps back on the release and the bow arm kicks.
    full_draw = {"Torso": (0.04, -0.55, 0.0), "HeadGroup": (0.0, 0.45, 0.0),
                 "LeftArmPivot": (1.45, -0.20, 0.10), "LeftElbowPivot": _x(0.15),
                 "RightArmPivot": (1.25, 0.25, -0.15), "RightElbowPivot": _x(1.25),
                 "LeftLegPivot": _x(0.12), "RightLegPivot": _x(-0.18), "LeftKneePivot": _x(-0.06), "RightKneePivot": _x(-0.08)}
    ranged = pose_table("Ranged", 30, _rest(Torso=_x(0.04)), [
        (0, "ready", {}, "io"),
        (14, "full draw", full_draw, "io"),
        (18, "aim", {**full_draw, "Torso": (0.04, -0.56, 0.0), "RightElbowPivot": _x(1.30)}, "io"),
        (20, "release", {**full_draw, "Torso": (0.05, -0.58, 0.0), "RightArmPivot": (1.15, 0.42, -0.10), "RightElbowPivot": _x(1.50),
                         "LeftArmPivot": (1.40, -0.20, 0.10)}, "out"),
        (30, "recover", {}, "io"),
    ])
    build_action(rig, "Ranged", 30, ranged)
    anticipation["Ranged"] = 14

    # 6. Cast: the torso leads (design 6.5): it gathers back, then reaches forward before the arms arrive.
    def cast_arms(x, elbow):
        return {"LeftArmPivot": (x, -0.20 if x > 1.0 else -0.05, 0.15 if x > 1.0 else 0.10),
                "RightArmPivot": (x, 0.20 if x > 1.0 else 0.05, -0.15 if x > 1.0 else -0.10),
                "LeftElbowPivot": _x(elbow), "RightElbowPivot": _x(elbow)}

    def cast_legs(knee, leg):
        return {"LeftKneePivot": _x(knee), "RightKneePivot": _x(knee), "LeftLegPivot": _x(leg), "RightLegPivot": _x(leg)}

    cast = pose_table("Cast", 28, _rest(), [
        (0, "ready", {}, "io"),
        (6, "gather", {"Torso": (0.10, -0.08, 0.0), "HeadGroup": (-0.04, 0.06, 0.0), **cast_arms(0.55, 1.25),
                       **cast_legs(-0.12, 0.06)}, "io"),
        (10, "lead", {"Torso": (-0.20, 0.04, 0.0), "HeadGroup": (0.05, 0.0, 0.0), **cast_arms(0.95, 0.95),
                      **cast_legs(-0.18, 0.09)}, "in"),
        (14, "cast", {"Torso": _x(-0.24), "HeadGroup": _x(0.12), **cast_arms(1.50, 0.30), **cast_legs(-0.20, 0.10)}, "out"),
        (18, "pulse", {"Torso": _x(-0.21), "HeadGroup": _x(0.12), **cast_arms(1.38, 0.38), **cast_legs(-0.20, 0.10)}, "io"),
        (22, "pulse", {"Torso": _x(-0.22), "HeadGroup": _x(0.12), **cast_arms(1.46, 0.32), **cast_legs(-0.20, 0.10)}, "io"),
        (28, "recover", {}, "io"),
    ])
    build_action(rig, "Cast", 28, cast)
    anticipation["Cast"] = 6

    # 7. Chop: today's arm swing from behind to the front; the elbows fold on the raise and open on the
    #    strike; the torso leans back on the raise and forward into the strike, the knees give.
    chop_base = _rest(RightArmPivot=(0.10, 0.10, -0.20), LeftArmPivot=(0.10, -0.15, 0.20), RightElbowPivot=_x(0.55),
                      LeftElbowPivot=_x(0.65), LeftLegPivot=_x(0.12), RightLegPivot=_x(-0.12),
                      LeftKneePivot=_x(-0.10), RightKneePivot=_x(-0.10))
    chop_strike = {"Torso": _x(-0.27), "HeadGroup": _x(0.216), "RightElbowPivot": _x(0.25), "LeftElbowPivot": _x(0.30),
                   "LeftKneePivot": _x(-0.28), "RightKneePivot": _x(-0.28), "LeftLegPivot": _x(0.20), "RightLegPivot": _x(-0.04)}
    chop = pose_table("Chop", 26, chop_base, [
        (0, "ready", {}, "io"),
        (12, "raise", {"RightArmPivot": (-1.55, 0.10, -0.20), "LeftArmPivot": (-1.32, -0.15, 0.20), "Torso": _x(0.18),
                       "HeadGroup": _x(-0.144), "RightElbowPivot": _x(1.10), "LeftElbowPivot": _x(1.15),
                       "LeftKneePivot": _x(-0.06), "RightKneePivot": _x(-0.06)}, "io"),
        (16, "strike", {**chop_strike, "RightArmPivot": (1.30, 0.10, -0.20), "LeftArmPivot": (1.10, -0.15, 0.20)}, "in"),
        (18, "impact", {**chop_strike, "RightArmPivot": (1.36, 0.10, -0.20), "LeftArmPivot": (1.16, -0.15, 0.20), "Torso": _x(-0.29)}, "out"),
        (26, "recover", {}, "io"),
    ])
    build_action(rig, "Chop", 26, chop)
    anticipation["Chop"] = 12

    # 8. Mine: as Chop, one-handed, with today's torso turn.
    mine_base = _rest(RightArmPivot=(0.10, 0.15, -0.20), RightElbowPivot=_x(0.60), LeftArmPivot=(0.15, 0.10, 0.28),
                      LeftElbowPivot=_x(0.65), LeftLegPivot=_x(0.15), RightLegPivot=_x(-0.15),
                      LeftKneePivot=_x(-0.12), RightKneePivot=_x(-0.12))
    mine_strike = {"HeadGroup": _x(0.21), "RightElbowPivot": _x(0.25), "LeftKneePivot": _x(-0.26), "RightKneePivot": _x(-0.26),
                   "LeftLegPivot": _x(0.22), "RightLegPivot": _x(-0.08)}
    mine = pose_table("Mine", 24, mine_base, [
        (0, "ready", {}, "io"),
        (10, "raise", {"RightArmPivot": (-1.40, 0.15, -0.20), "Torso": (0.22, 0.143, 0.0), "HeadGroup": _x(-0.154),
                       "RightElbowPivot": _x(1.10), "LeftElbowPivot": _x(0.75), "LeftKneePivot": _x(-0.08), "RightKneePivot": _x(-0.08)}, "io"),
        (14, "strike", {**mine_strike, "RightArmPivot": (1.20, 0.15, -0.20), "Torso": (-0.30, 0.143, 0.0)}, "in"),
        (16, "impact", {**mine_strike, "RightArmPivot": (1.26, 0.15, -0.20), "Torso": (-0.32, 0.13, 0.0), "RightElbowPivot": _x(0.22)}, "out"),
        (24, "recover", {}, "io"),
    ])
    build_action(rig, "Mine", 24, mine)
    anticipation["Mine"] = 10

    # 9. Fish: the rod hand twitches up, drops, waits and tugs (design 6.5: arm motion); a soft stance,
    #    the torso leaning toward the water and the head looking down at it.
    def fish(r_arm, l_arm, r_elbow, l_elbow, torso, head=(-0.10, 0.0, 0.0), knee=-0.06):
        return {"RightArmPivot": (r_arm, 0.10, -0.20), "LeftArmPivot": (l_arm, -0.12, 0.20),
                "RightElbowPivot": _x(r_elbow), "LeftElbowPivot": _x(l_elbow), "Torso": torso, "HeadGroup": head,
                "LeftKneePivot": _x(knee), "RightKneePivot": _x(knee), "LeftLegPivot": _x(-knee * 0.5), "RightLegPivot": _x(-knee * 0.5)}

    hold = fish(0.70, 0.60, 0.55, 0.65, _x(-0.04))
    fish_clip = pose_table("Fish", 36, _rest(), [
        (0, "hold", hold, "cr"),
        (6, "twitch up", fish(1.02, 0.92, 0.80, 0.88, _x(-0.02)), "cr"),
        (12, "drop", fish(0.62, 0.52, 0.50, 0.60, _x(-0.06), knee=-0.08), "cr"),
        (18, "wait", fish(0.70, 0.60, 0.55, 0.65, (-0.05, 0.03, 0.0), head=(-0.12, 0.05, 0.0)), "cr"),
        (24, "tug", fish(0.82, 0.72, 0.70, 0.78, (-0.07, 0.03, 0.0), knee=-0.10), "cr"),
        (30, "wait", fish(0.68, 0.58, 0.55, 0.65, _x(-0.045)), "cr"),
        (36, "hold", hold, "cr"),
    ], loop=True)
    build_action(rig, "Fish", 36, fish_clip)

    # 10. SpinSlash: today's two turns of the torso with the arms out (local, design 6.1.5), now with a coil
    #     before and a settle after (three beats), at one speed through the turn; the head trails the torso
    #     by a quarter turn at most, in place of today's 0.85 of its yaw (1.9 rad behind the chest at the end).
    def spin(yaw, lag, arms, elbows, knees, pitch=-0.12):
        return {"Torso": (pitch, yaw, 0.0), "HeadGroup": (0.0, yaw + lag, 0.0),
                "RightArmPivot": (arms, 0.0, 0.35), "LeftArmPivot": (arms, 0.0, -0.35),
                "RightElbowPivot": _x(elbows), "LeftElbowPivot": _x(elbows),
                "LeftKneePivot": _x(knees), "RightKneePivot": _x(knees)}

    # coil -0.45, then 'in' over 4 frames, 'lin' over 10 and 'out' over 4 meet at one speed: the three moves
    # are d, 5d and d, ending 0.10 past two turns
    d = (4.0 * math.pi + 0.10 + 0.45) / 7.0
    spin_clip = pose_table("SpinSlash", 24, _rest(LeftLegPivot=_x(-0.08), RightLegPivot=_x(0.08)), [
        (0, "ready", spin(0.0, 0.0, 1.35, 0.35, -0.15), "io"),
        (4, "coil", spin(-0.45, 0.15, 1.10, 0.60, -0.25, pitch=-0.10), "io"),
        (8, "launch", spin(-0.45 + d, -0.32, 1.40, 0.30, -0.20), "in"),
        (18, "spin", spin(-0.45 + 6 * d, -0.25, 1.50, 0.30, -0.20), "lin"),
        (22, "follow-through", spin(4.0 * math.pi + 0.10, -0.05, 1.40, 0.35, -0.18), "out"),
        (24, "settle", spin(4.0 * math.pi, 0.0, 1.30, 0.35, -0.15), "io"),
    ])
    build_action(rig, "SpinSlash", 24, spin_clip)
    anticipation["SpinSlash"] = 4

    # 11. Death (design 6.5; owner "ok", 2026-11-14): 1.083 s, the hit snaps the head and chest back, the
    #     knees buckle, the body tips back onto the ground and lies there, one knee up, arms out, head turned.
    #     Hips turns and moves the whole figure; every other number is in the hips' space.
    lie = {"Hips": _x(1.57), "HipsPos": (0.0, 0.0, 0.62), "LeftLegPivot": _x(0.32), "RightLegPivot": _x(-0.02),
           "LeftKneePivot": _x(-0.60), "RightKneePivot": _x(-0.10), "Torso": _x(0.02), "HeadGroup": (0.10, 0.45, 0.0),
           "LeftArmPivot": (0.0, 0.05, -1.00), "RightArmPivot": (0.0, -0.05, 1.05),
           "LeftElbowPivot": _x(0.35), "RightElbowPivot": _x(0.30)}
    death = pose_table("Death", 27, _rest(Torso=_x(-0.025), HeadGroup=_x(0.015), Hips=ZERO), [
        (0, "hit", {}, "io"),
        (4, "recoil", {"Torso": (0.22, 0.10, 0.05), "HeadGroup": (0.32, 0.10, 0.0),
                       "LeftArmPivot": (-0.25, 0.05, 0.05), "RightArmPivot": (-0.30, -0.05, -0.10),
                       "LeftElbowPivot": _x(0.95), "RightElbowPivot": _x(0.90),
                       "LeftKneePivot": _x(-0.12), "RightKneePivot": _x(-0.08), "HipsPos": (0.0, 0.0, 0.02)}, "out"),
        (10, "buckle", {"Hips": _x(0.18), "HipsPos": (0.0, 0.0, 0.10), "LeftLegPivot": _x(0.65), "RightLegPivot": _x(0.55),
                        "LeftKneePivot": _x(-1.10), "RightKneePivot": _x(-1.00), "Torso": (0.12, 0.08, 0.0),
                        "HeadGroup": (0.15, 0.15, 0.0), "LeftArmPivot": (0.25, 0.05, -0.15), "RightArmPivot": (0.20, -0.05, 0.20),
                        "LeftElbowPivot": _x(0.70), "RightElbowPivot": _x(0.70)}, "io"),
        (18, "fall", {"Hips": _x(1.15), "HipsPos": (0.0, 0.0, 0.42), "LeftLegPivot": _x(0.45), "RightLegPivot": _x(0.30),
                      "LeftKneePivot": _x(-0.70), "RightKneePivot": _x(-0.55), "Torso": _x(0.10), "HeadGroup": (-0.15, 0.20, 0.0),
                      "LeftArmPivot": (-0.10, 0.05, -0.70), "RightArmPivot": (-0.15, -0.05, 0.75),
                      "LeftElbowPivot": _x(0.50), "RightElbowPivot": _x(0.45)}, "in"),
        (22, "land", lie, "out"),
        (24, "bounce", {**lie, "Hips": _x(1.50), "HipsPos": (0.0, 0.0, 0.62),
                        "LeftArmPivot": (0.05, 0.05, -0.95), "RightArmPivot": (0.05, -0.05, 1.00)}, "io"),
        (26, "lying", lie, "io"),
    ])
    _, heights = build_action(rig, "Death", 27, death, feet_level_with="hips")
    assert heights[-1] < DEATH_LIE_MAX, f"Death: the hips end {heights[-1]:+.3f} over their rest, so the body is not lying"
    return {k: f / FPS for k, f in anticipation.items()}, heights


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

    # 7. The biped library on the bones (H4: eleven clips, pose tables on the 12/s grid)
    anticipation, _ = build_all_animations(rig)
    print("[BlenderHero] attack anticipation (s): " + ", ".join(f"{k} {v:.6f}" for k, v in sorted(anticipation.items())))

    # 8. Save blend and export GLB (rotation-only clips plus the Hips position, skins, no UVs: design 6.1, 6.3)
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
