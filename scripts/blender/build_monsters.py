"""
Headless Blender 5.2 generator for the 10 Gielinor Monster species (`monsters.blend` + `monsters.glb`).
Sculpts authentic, high-detail OSRS / RuneScape Dragonwilds stylized monsters:
  1. Monster_chicken          - Plump feathered chicken with serrated red comb, wattle, hooked beak, layered wings, fanned tail & talons
  2. Monster_goblin           - Goblin Raider with hunched muscular torso, leather harness, spiked pauldron, barbed bronze war-spear & buckler
  3. Monster_goblin_archer    - Goblin Archer with stitched hood/cowl (ears poking out), bandolier, quiver of arrows & recurve shortbow
  4. Monster_scorpion         - King Scorpion with 5 segmented carapace plates, 8 multi-jointed arachnid legs, serrated chela pincers & arched stinger tail
  5. Monster_dark_wizard      - Dark Wizard, rebuilt and skinned on the biped rig: a stooped caster with a wide crooked hat, bell sleeves, a pleated robe skirt that swings & an orb staff held out at the side
  6. Monster_dark_ranger      - Dark Ranger, rebuilt and skinned on the biped rig: a lean hunter with a peaked hood & mask, a cloak in a triangle outline, one pauldron, a hip quiver & a recurve bow held out
  7. Monster_hill_giant       - Hill Giant with barrel-chested muscular torso, fur pelt loincloth, skull buckle, braided beard & spiked tree-trunk club
  8. Monster_moss_guardian    - Moss Guardian forest golem of craggy stone & twisted bark, glowing heart-core, mossy boulder pauldrons & branching antlers
  9. Monster_lesser_demon     - Lesser Demon, rebuilt and skinned on the biped rig: a slate brute with a forward hunch, swept horns, wings raised from the back, a spade tail & an ember-edged cleaver
 10. Monster_elvarg_dragon    - Elvarg the Crag Dragon world boss, a new skinned model on the dragon rig: low heavy-shouldered body, wedge head with a jaw, swept horns, crag plates down the spine, raised wings & spade tail
 11. Monster_ashmantle        - Ashmantle the Slag Wyrm, its own skinned body on the dragon rig: heavier chest, slag crown, back plates with glowing seams, clubbed tail
"""

import math
import os
import random
import re
import sys
import bpy
import bmesh
from mathutils import Vector, Euler, Matrix

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(__file__))
import paths
import figkit


# =============================================================================
# Coordinate Conversion & Core Helpers
# =============================================================================
def t2b(tx: float, ty: float, tz: float) -> tuple[float, float, float]:
    """Convert Three.js (+X right, +Y up, -Z forward) to Blender (+X right, +Y back, +Z up)."""
    return (tx, -tz, ty)


def t2b_pos(tx: float, ty: float, tz: float) -> tuple[float, float, float]:
    return (tx, -tz, ty)


def t2b_euler(rx: float, ry: float, rz: float) -> Euler:
    return Euler((rx, -rz, ry), "XYZ")


def xform_pt(
    x: float,
    y: float,
    z: float,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
) -> tuple[float, float, float]:
    """Rotate (x, y, z) in Three.js space by (rx, ry, rz), translate by (tx, ty, tz), then convert to Blender."""
    if rx != 0.0:
        c, s = math.cos(rx), math.sin(rx)
        y, z = y * c - z * s, y * s + z * c
    if ry != 0.0:
        c, s = math.cos(ry), math.sin(ry)
        x, z = x * c + z * s, -x * s + z * c
    if rz != 0.0:
        c, s = math.cos(rz), math.sin(rz)
        x, y = x * c - y * s, x * s + y * c
    return t2b(x + tx, y + ty, z + tz)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def s2l(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_rgba(hex_color: int, alpha: float = 1.0) -> tuple[float, float, float, float]:
    r = s2l(((hex_color >> 16) & 0xFF) / 255.0)
    g = s2l(((hex_color >> 8) & 0xFF) / 255.0)
    b = s2l((hex_color & 0xFF) / 255.0)
    return (r, g, b, alpha)


def make_mat(
    name: str,
    hex_color: int,
    roughness: float = 0.48,
    metallic: float = 0.10,
    emission_hex: int | None = None,
    emission_strength: float = 0.0,
):
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name=name)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    rgba = hex_to_rgba(hex_color)
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission_hex is not None and emission_strength > 0.0:
            em_rgba = hex_to_rgba(emission_hex)
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = em_rgba
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.diffuse_color = rgba
    return mat


def create_pivot(name: str, parent, tx: float = 0.0, ty: float = 0.0, tz: float = 0.0):
    """Create an Empty pivot parented to `parent` at parent-local Three.js coordinates (tx, ty, tz)."""
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    obj.location = t2b_pos(tx, ty, tz)
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def finalize_obj(
    name: str,
    bm: bmesh.types.BMesh,
    parent,
    mat=None,
    smooth: bool = True,
    no_outline: bool = False,
):
    """
    Finalize a BMesh into a Blender Mesh Object parented to `parent` with zero local offset
    (all vertices are already built in `parent`-local coordinates).
    """
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        poly.use_smooth = smooth

    obj = bpy.data.objects.new(name, mesh)
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
    if no_outline:
        obj["noOutline"] = True
    if mat is not None:
        if isinstance(mat, (list, tuple)):
            for m in mat:
                obj.data.materials.append(m)
        else:
            obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


# =============================================================================
# BlendSwap Asset Cache & Submesh Extraction
# =============================================================================
BLEND_ASSET_CACHE: dict[str, bpy.types.Object] = {}

def get_blend_object(blend_rel_path: str, obj_name: str) -> bpy.types.Object | None:
    cache_key = f"{blend_rel_path}::{obj_name}"
    if cache_key in BLEND_ASSET_CACHE:
        return BLEND_ASSET_CACHE[cache_key]
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    blend_file = os.path.join(repo_root, blend_rel_path)
    if not os.path.exists(blend_file):
        raise FileNotFoundError(f"[BlendAsset] {blend_file} not found (needed for object {obj_name!r})")
    try:
        with bpy.data.libraries.load(blend_file) as (df, dt):
            if obj_name not in df.objects:
                raise KeyError(f"[BlendAsset] object {obj_name!r} not found in {blend_file}")
            dt.objects = [obj_name]
    except (OSError, RuntimeError) as e:
        raise RuntimeError(f"[BlendAsset] failed to load object {obj_name!r} from {blend_file}: {e}") from e
    obj = dt.objects[0]
    bpy.context.collection.objects.link(obj)
    BLEND_ASSET_CACHE[cache_key] = obj
    return obj


def add_imported_submesh(
    name: str,
    parent: bpy.types.Object,
    mat: bpy.types.Material,
    src_obj: bpy.types.Object,
    transform_matrix: Matrix,
    vert_indices: set[int] | None = None,
    smooth: bool = True,
    no_outline: bool = False,
):
    bm = bmesh.new()
    bm.from_mesh(src_obj.data)
    if vert_indices is not None:
        del_faces = [f for f in bm.faces if any(v.index not in vert_indices for v in f.verts)]
        bmesh.ops.delete(bm, geom=del_faces, context="FACES")
        del_verts = [v for v in bm.verts if not v.link_faces]
        bmesh.ops.delete(bm, geom=del_verts, context="VERTS")
    if not bm.faces:
        bm.free()
        return None
    bm.transform(transform_matrix)
    return finalize_obj(name, bm, parent, mat, smooth=smooth, no_outline=no_outline)


# =============================================================================
# High-Detail Sculpting Primitives (All in Parent-Local Three.js Coordinates)
# =============================================================================
def add_lathe(
    name: str,
    parent,
    mat,
    sections: list[tuple],
    segs: int = 20,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    axis: str = "Y",
    cap_ends: bool = True,
    smooth: bool = True,
    no_outline: bool = False,
):
    """
    Multi-profile lofted lathe along Three.js `Y` (vertical) or `Z` (fore-aft).
    Each section tuple:
      - If axis == 'Y': (y_pos, rad_x, rad_z[, off_x=0, off_z=0, sq=0, pec=0, ridge=0])
      - If axis == 'Z': (z_pos, rad_x, rad_y[, off_x=0, off_y=0, sq=0, belly=0, ridge=0])
    """
    bm = bmesh.new()
    ring_loops = []

    for sec in sections:
        s_pos = sec[0]
        r1 = max(0.001, sec[1])
        r2 = max(0.001, sec[2])
        off1 = sec[3] if len(sec) > 3 else 0.0
        off2 = sec[4] if len(sec) > 4 else 0.0
        sq = sec[5] if len(sec) > 5 else 0.0
        bulge = sec[6] if len(sec) > 6 else 0.0
        ridge = sec[7] if len(sec) > 7 else 0.0

        verts = []
        for i in range(segs):
            ang = (i / segs) * math.pi * 2.0
            ca = math.cos(ang)
            sa = math.sin(ang)
            if sq > 0.0:
                p = max(0.35, 1.0 - sq)
                cx = math.copysign(abs(ca) ** p, ca)
                cy = math.copysign(abs(sa) ** p, sa)
            else:
                cx, cy = ca, sa

            if axis == "Y":
                vx = off1 + cx * r1
                front_f = max(0.0, -sa)
                back_f = max(0.0, sa)
                pec_lobe = bulge * front_f * (0.35 + 0.65 * abs(ca))
                dorsal = ridge * (back_f ** 2.0) * (1.0 - abs(ca))
                vz = off2 + cy * r2 - pec_lobe + dorsal
                vy = s_pos
            else:
                vx = off1 + cx * r1
                top_f = max(0.0, sa)
                bot_f = max(0.0, -sa)
                dorsal = ridge * (top_f ** 2.2) * (1.0 - abs(ca))
                belly_drop = bulge * (bot_f ** 1.6) * (1.0 - 0.4 * abs(ca))
                vy = off2 + cy * r2 + dorsal - belly_drop
                vz = s_pos

            verts.append(bm.verts.new(xform_pt(vx, vy, vz, tx, ty, tz, rx, ry, rz)))
        ring_loops.append(verts)

    for r_idx in range(len(ring_loops) - 1):
        la = ring_loops[r_idx]
        lb = ring_loops[r_idx + 1]
        for i in range(segs):
            inext = (i + 1) % segs
            if axis == "Y":
                bm.faces.new((la[i], la[inext], lb[inext], lb[i]))
            else:
                bm.faces.new((la[i], lb[i], lb[inext], la[inext]))

    if cap_ends and len(ring_loops) >= 2:
        s0 = sections[0]
        s1 = sections[-1]
        o1_0 = s0[3] if len(s0) > 3 else 0.0
        o2_0 = s0[4] if len(s0) > 4 else 0.0
        o1_1 = s1[3] if len(s1) > 3 else 0.0
        o2_1 = s1[4] if len(s1) > 4 else 0.0
        if axis == "Y":
            c0 = bm.verts.new(xform_pt(o1_0, s0[0], o2_0, tx, ty, tz, rx, ry, rz))
            c1 = bm.verts.new(xform_pt(o1_1, s1[0], o2_1, tx, ty, tz, rx, ry, rz))
            for i in range(segs):
                inext = (i + 1) % segs
                bm.faces.new((ring_loops[0][inext], ring_loops[0][i], c0))
                bm.faces.new((ring_loops[-1][i], ring_loops[-1][inext], c1))
        else:
            c0 = bm.verts.new(xform_pt(o1_0, o2_0, s0[0], tx, ty, tz, rx, ry, rz))
            c1 = bm.verts.new(xform_pt(o1_1, o2_1, s1[0], tx, ty, tz, rx, ry, rz))
            for i in range(segs):
                inext = (i + 1) % segs
                bm.faces.new((ring_loops[0][i], ring_loops[0][inext], c0))
                bm.faces.new((ring_loops[-1][inext], ring_loops[-1][i], c1))

    return finalize_obj(name, bm, parent, mat, smooth=smooth, no_outline=no_outline)


def add_curved_tube(
    name: str,
    parent,
    mat,
    points: list[tuple],
    segs: int = 12,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    cap_start: bool = True,
    cap_end: bool = True,
    smooth: bool = True,
    dorsal_ridge: float = 0.0,
    no_outline: bool = False,
):
    """
    Lofts a 3D tube along a list of control points `(x, y, z, rad_w[, rad_h])` in parent-local Three.js space.
    Uses parallel transport frames so S-curved necks, tails, horns, staves, and bows never twist or kink.
    """
    bm = bmesh.new()
    n = len(points)
    if n < 2:
        return finalize_obj(name, bm, parent, mat, smooth=smooth, no_outline=no_outline)

    centers = [Vector((p[0], p[1], p[2])) for p in points]
    r_w = [max(0.001, p[3]) for p in points]
    r_h = [max(0.001, p[4] if len(p) > 4 else p[3]) for p in points]

    tangents = []
    for i in range(n):
        if i == 0:
            t_vec = centers[1] - centers[0]
        elif i == n - 1:
            t_vec = centers[-1] - centers[-2]
        else:
            t_vec = centers[i + 1] - centers[i - 1]
        if t_vec.length < 1e-6:
            t_vec = Vector((0.0, 1.0, 0.0))
        else:
            t_vec.normalize()
        tangents.append(t_vec)

    # Initial frame
    t0 = tangents[0]
    up_ref = Vector((0.0, 1.0, 0.0))
    if abs(t0.dot(up_ref)) > 0.92:
        up_ref = Vector((0.0, 0.0, 1.0))
    side = t0.cross(up_ref).normalized()
    up_v = side.cross(t0).normalized()

    ring_loops = []
    for i in range(n):
        ti = tangents[i]
        if i > 0:
            axis_rot = tangents[i - 1].cross(ti)
            if axis_rot.length > 1e-5:
                ang_rot = math.atan2(axis_rot.length, max(-1.0, min(1.0, tangents[i - 1].dot(ti))))
                axis_rot.normalize()
                from mathutils import Matrix
                rot_m = Matrix.Rotation(ang_rot, 3, axis_rot)
                side = (rot_m @ side).normalized()
                up_v = side.cross(ti).normalized()

        c = centers[i]
        rw = r_w[i]
        rh = r_h[i]
        verts = []
        for s in range(segs):
            ang = (s / segs) * math.pi * 2.0
            ca = math.cos(ang)
            sa = math.sin(ang)
            ridge_boost = dorsal_ridge * rh * (max(0.0, sa) ** 2.2) * (1.0 - abs(ca))
            pt = c + side * (ca * rw) + up_v * (sa * rh + ridge_boost)
            verts.append(bm.verts.new(xform_pt(pt.x, pt.y, pt.z, tx, ty, tz, rx, ry, rz)))
        ring_loops.append(verts)

    for i in range(n - 1):
        la = ring_loops[i]
        lb = ring_loops[i + 1]
        for s in range(segs):
            snext = (s + 1) % segs
            bm.faces.new((la[s], la[snext], lb[snext], lb[s]))

    if cap_start:
        c0 = bm.verts.new(xform_pt(centers[0].x, centers[0].y, centers[0].z, tx, ty, tz, rx, ry, rz))
        for s in range(segs):
            snext = (s + 1) % segs
            bm.faces.new((ring_loops[0][snext], ring_loops[0][s], c0))

    if cap_end:
        c1 = bm.verts.new(xform_pt(centers[-1].x, centers[-1].y, centers[-1].z, tx, ty, tz, rx, ry, rz))
        for s in range(segs):
            snext = (s + 1) % segs
            bm.faces.new((ring_loops[-1][s], ring_loops[-1][snext], c1))

    return finalize_obj(name, bm, parent, mat, smooth=smooth, no_outline=no_outline)


def add_limb_tube(
    name: str,
    parent,
    mat,
    p0: tuple[float, float, float],
    p1: tuple[float, float, float],
    r0: float,
    r1: float,
    r_mid: float | None = None,
    bend: tuple[float, float, float] = (0.0, 0.0, 0.0),
    segs: int = 12,
    steps: int = 6,
    smooth: bool = True,
    no_outline: bool = False,
):
    """Sculpts a muscular or jointed limb segment between p0 and p1 with mid-belly bulge and bend offset."""
    if r_mid is None:
        r_mid = max(r0, r1) * 1.08
    pts = []
    for i in range(steps):
        t = i / (steps - 1)
        arch = math.sin(t * math.pi)
        x = p0[0] + (p1[0] - p0[0]) * t + bend[0] * arch
        y = p0[1] + (p1[1] - p0[1]) * t + bend[1] * arch
        z = p0[2] + (p1[2] - p0[2]) * t + bend[2] * arch
        r_lin = r0 + (r1 - r0) * t
        r = r_lin + (r_mid - (r0 + r1) * 0.5) * arch
        pts.append((x, y, z, r, r * 1.05))
    return add_curved_tube(
        name, parent, mat, pts, segs=segs, smooth=smooth, no_outline=no_outline
    )


def add_box(
    name: str,
    parent,
    mat,
    wx: float,
    hy: float,
    dz: float,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    bevel: float = 0.08,
    smooth: bool = False,
    no_outline: bool = False,
):
    """Creates a beveled box of full Three.js dimensions (wx, hy, dz) at parent-local (tx, ty, tz)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if bevel > 0.0:
        bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bevel, segments=2, profile=0.5)
    for v in bm.verts:
        vx = v.co.x * wx
        vy = v.co.y * hy
        vz = v.co.z * dz
        bx, by, bz = xform_pt(vx, vy, vz, tx, ty, tz, rx, ry, rz)
        v.co.x, v.co.y, v.co.z = bx, by, bz
    return finalize_obj(name, bm, parent, mat, smooth=smooth, no_outline=no_outline)


def add_sphere(
    name: str,
    parent,
    mat,
    rx_rad: float,
    ry_rad: float | None = None,
    rz_rad: float | None = None,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    segs: int = 14,
    rings: int = 10,
    smooth: bool = True,
    no_outline: bool = False,
):
    """Creates an ellipsoid with radii (rx_rad, ry_rad, rz_rad) at parent-local (tx, ty, tz)."""
    if ry_rad is None:
        ry_rad = rx_rad
    if rz_rad is None:
        rz_rad = rx_rad
    sections = []
    for i in range(rings):
        t = i / (rings - 1)
        phi = (t - 0.5) * math.pi
        y_loc = math.sin(phi) * ry_rad
        ring_scale = max(0.02, math.cos(phi))
        sections.append((y_loc, rx_rad * ring_scale, rz_rad * ring_scale))
    return add_lathe(
        name,
        parent,
        mat,
        sections,
        segs=segs,
        tx=tx,
        ty=ty,
        tz=tz,
        rx=rx,
        ry=ry,
        rz=rz,
        axis="Y",
        cap_ends=True,
        smooth=smooth,
        no_outline=no_outline,
    )


def add_cone_spike(
    name: str,
    parent,
    mat,
    base_r: float,
    length: float,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    curve_bend: float = 0.0,
    segs: int = 10,
    flatten_x: float = 1.0,
    smooth: bool = True,
    no_outline: bool = False,
):
    """Creates a tapered cone, horn, fang, talon, or spike growing from (0,0,0) to (0, length, curve_bend)."""
    sections = []
    steps = 6
    for i in range(steps):
        t = i / (steps - 1)
        r = max(0.002, base_r * ((1.0 - t) ** 1.15))
        bz = (t ** 1.7) * curve_bend
        sections.append((t * length, r * flatten_x, r, 0.0, bz, 0.1))
    return add_lathe(
        name,
        parent,
        mat,
        sections,
        segs=segs,
        tx=tx,
        ty=ty,
        tz=tz,
        rx=rx,
        ry=ry,
        rz=rz,
        axis="Y",
        cap_ends=True,
        smooth=smooth,
        no_outline=no_outline,
    )


def add_wing_web(
    name: str,
    parent,
    mat,
    elbow_pt: tuple[float, float, float],
    tip_a: tuple[float, float, float],
    tip_b: tuple[float, float, float],
    thickness: float = 0.016,
    scallop_dip: float = 0.08,
):
    """Creates a double-sided scalloped bat/dragon wing membrane panel between elbow_pt and two finger tips."""
    bm = bmesh.new()
    steps = 7
    front_a = bm.verts.new(t2b(*elbow_pt[0:2], elbow_pt[2] - thickness * 0.5))
    back_a = bm.verts.new(t2b(*elbow_pt[0:2], elbow_pt[2] + thickness * 0.5))

    f_verts = []
    b_verts = []
    for i in range(steps):
        t = i / (steps - 1)
        dip = math.sin(t * math.pi) * scallop_dip
        px = tip_a[0] + (tip_b[0] - tip_a[0]) * t
        py = tip_a[1] + (tip_b[1] - tip_a[1]) * t + dip * (elbow_pt[1] - (tip_a[1] + tip_b[1]) * 0.5)
        pz = tip_a[2] + (tip_b[2] - tip_a[2]) * t + dip * 0.25
        f_verts.append(bm.verts.new(t2b(px, py, pz - thickness * 0.5)))
        b_verts.append(bm.verts.new(t2b(px, py, pz + thickness * 0.5)))

    for i in range(steps - 1):
        bm.faces.new((front_a, f_verts[i], f_verts[i + 1]))
        bm.faces.new((back_a, b_verts[i + 1], b_verts[i]))
        bm.faces.new((f_verts[i], b_verts[i], b_verts[i + 1], f_verts[i + 1]))

    return finalize_obj(name, bm, parent, mat, smooth=True)


# =============================================================================
# Semantic Material Palette
# =============================================================================
def build_materials() -> dict:
    return {
        # Species skins - Nordic dark fantasy earthy tones
        "skin_chicken": make_mat("mat_skin_chicken", 0xE8E0D0, roughness=0.62, metallic=0.02),
        "skin_chicken_wing": make_mat("mat_skin_chicken_wing", 0xD6C8AE, roughness=0.60, metallic=0.02),
        "skin_chicken_tail": make_mat("mat_skin_chicken_tail", 0x9E7846, roughness=0.58, metallic=0.04),
        "skin_goblin": make_mat("mat_skin_goblin", 0x4A5D3B, roughness=0.58, metallic=0.04),
        "skin_goblin_dark": make_mat("mat_skin_goblin_dark", 0x324227, roughness=0.62, metallic=0.04),
        "skin_scorpion": make_mat("mat_skin_scorpion", 0x3A2416, roughness=0.38, metallic=0.15),
        "skin_scorpion_plate": make_mat("mat_skin_scorpion_plate", 0x24170E, roughness=0.32, metallic=0.20),
        "skin_hill_giant": make_mat("mat_skin_hill_giant", 0x9D7A5E, roughness=0.65, metallic=0.02),
        "skin_moss_guardian": make_mat("mat_skin_moss_guardian", 0x384A32, roughness=0.72, metallic=0.04),
        "skin_elvarg_dragon": make_mat("mat_skin_elvarg_dragon", 0x334235, roughness=0.45, metallic=0.12),
        # Shared materials
        "cloth": make_mat("mat_cloth", 0x4A3F32, roughness=0.75, metallic=0.02),
        "leather": make_mat("mat_leather", 0x2C1F16, roughness=0.65, metallic=0.06),
        "fur": make_mat("mat_fur", 0x3D2C1C, roughness=0.82, metallic=0.02),
        "wood": make_mat("mat_wood", 0x3E2C1C, roughness=0.70, metallic=0.02),
        "bark": make_mat("mat_bark", 0x2A1C12, roughness=0.80, metallic=0.02),
        "moss": make_mat("mat_moss", 0x2D4722, roughness=0.78, metallic=0.02),
        "stone": make_mat("mat_stone", 0x525C66, roughness=0.68, metallic=0.10),
        "iron": make_mat("mat_iron", 0x424A52, roughness=0.45, metallic=0.70),
        "obsidian": make_mat("mat_iron_obsidian", 0x16181C, roughness=0.35, metallic=0.50),
        "bronze": make_mat("mat_bronze", 0x7A5B32, roughness=0.45, metallic=0.65),
        "bone": make_mat("mat_bone", 0xD4CBB8, roughness=0.52, metallic=0.06),
        "horn": make_mat("mat_horn", 0x1E1A17, roughness=0.45, metallic=0.12),
        "wing_dragon": make_mat("mat_wing_dragon", 0x4A3E2A, roughness=0.55, metallic=0.08),
        "comb_red": make_mat("mat_cloth_comb", 0x8A2020, roughness=0.48, metallic=0.04),
        "beak_yellow": make_mat("mat_gold_beak", 0xA87824, roughness=0.45, metallic=0.10),
        # Emissive glow materials - atmospheric fantasy embers
        "glow_yellow": make_mat(
            "mat_glow_yellow", 0xE6B820, roughness=0.18, metallic=0.0, emission_hex=0xD49F1A, emission_strength=1.4
        ),
        "glow_crimson": make_mat(
            "mat_glow_crimson", 0xB82828, roughness=0.20, metallic=0.05, emission_hex=0xA01E1E, emission_strength=1.5
        ),
        "glow_purple": make_mat(
            "mat_glow_purple", 0x7C3AED, roughness=0.18, metallic=0.05, emission_hex=0x6D28D9, emission_strength=1.5
        ),
        "glow_emerald": make_mat(
            "mat_glow_emerald", 0x16A34A, roughness=0.18, metallic=0.0, emission_hex=0x15803D, emission_strength=1.4
        ),
        "glow_orange": make_mat(
            "mat_glow_orange", 0xD97706, roughness=0.20, metallic=0.10, emission_hex=0xB45309, emission_strength=1.5
        ),
    }


# =============================================================================
# 1. Monster_chicken
# =============================================================================
# Kept and re-rigged (plan M3a): the segment counts that bring today's 4,680 triangles under 2,500
CHICKEN_TRIANGLES = 2500
CHICKEN_OCCLUSION = 0.35  # bake_paint's default occlusion: the chicken keeps today's look
CHICKEN_SEGS = {"body": 12, "neck": 10, "comb": 6, "wing": 8, "feather": 5, "tail": 6, "drumstick": 8, "shank": 6, "toe": 5, "talon": 4}


def build_chicken(grid_pos: tuple[float, float, float], mats: dict):
    """
    The chicken, kept and re-rigged (plan M3a, design 4.6): today's shape, its parts fused into three
    skinned meshes on the biped rig, every part hard-weighted to one bone. It never plays a shared clip:
    the engine poses it in code with today's numbers, on bones of today's names. The legs swing on
    LeftLegPivot and RightLegPivot at today's places; the wings are on LWing and RWing, which the engine
    looks up by those names and flaps (loop.ts), at each wing's root. Every rig row is flagged code_posed,
    so the 20-degree bind rule does not hold for it, and the manifest lists none of its limbs.
    grid_pos is not used: a skinned figure stands at the file's origin (design 6.1.1 rule 2b).
    """
    import rigs

    # White: the paint is the colour. Each part keeps today's material colour as its paint, so the engine,
    # which multiplies the same tiles as before ('skin' the feather tile, 'cloth' the cloth tile, 'gold'
    # none), shows today's chicken. The material names keep today's family words.
    skin = make_mat("mat_skin_chicken_paint", 0xFFFFFF, roughness=0.62, metallic=0.02)
    comb = make_mat("mat_cloth_chicken_paint", 0xFFFFFF, roughness=0.48, metallic=0.04)
    beak = make_mat("mat_gold_chicken_paint", 0xFFFFFF, roughness=0.45, metallic=0.10)
    hard = []  # (object, bone)

    def add(obj, bone: str, colour: int):
        _goblin_tint(obj, colour)
        hard.append((obj, f"chicken_{bone}"))

    # Plump feathered body along Z (fore-aft)
    body_sections = [
        (-0.28, 0.08, 0.08, 0.0, 0.36, 0.10, 0.01, 0.0),
        (-0.20, 0.16, 0.15, 0.0, 0.34, 0.12, 0.03, 0.01),
        (-0.08, 0.21, 0.19, 0.0, 0.33, 0.14, 0.04, 0.01),
        (0.06, 0.20, 0.18, 0.0, 0.34, 0.14, 0.03, 0.02),
        (0.18, 0.15, 0.15, 0.0, 0.37, 0.12, 0.01, 0.03),
        (0.26, 0.09, 0.10, 0.0, 0.41, 0.08, 0.0, 0.02),
    ]
    add(add_lathe("chk_body", None, skin, body_sections, segs=CHICKEN_SEGS["body"], axis="Z"), "Hips", 0xE8E0D0)

    # S-curved neck and head rising at the front (-Z)
    neck_pts = [
        (0.0, 0.36, -0.18, 0.11, 0.11),
        (0.0, 0.45, -0.24, 0.09, 0.095),
        (0.0, 0.54, -0.25, 0.08, 0.085),
        (0.0, 0.62, -0.23, 0.085, 0.09),
        (0.0, 0.67, -0.24, 0.065, 0.07),
    ]
    add(add_curved_tube("chk_neck_head", None, skin, neck_pts, segs=CHICKEN_SEGS["neck"]), "HeadGroup", 0xE8E0D0)

    # Multi-lobed serrated red comb. Today's builder moved only the last 12 vertices of each lobe, so the
    # shipped comb has a sliver down to the ground (its bounds reach y -0.038); each lobe's own vertices move here.
    comb_bm = bmesh.new()
    for lx, ly, lz, r_base, h_lobe in (
        (0.0, 0.69, -0.29, 0.026, 0.055),
        (0.0, 0.72, -0.25, 0.030, 0.075),
        (0.0, 0.71, -0.20, 0.028, 0.068),
        (0.0, 0.68, -0.16, 0.022, 0.050),
    ):
        n = CHICKEN_SEGS["comb"]
        lobe = bmesh.ops.create_cone(comb_bm, cap_ends=True, cap_tris=True, segments=n, radius1=r_base, radius2=0.004, depth=h_lobe)
        for v in lobe["verts"]:
            v.co.x *= 0.45
            bx, by, bz = xform_pt(v.co.x, v.co.z + h_lobe * 0.4, v.co.y, lx, ly, lz)
            v.co.x, v.co.y, v.co.z = bx, by, bz
    add(finalize_obj("chk_comb", comb_bm, None, comb, smooth=True), "HeadGroup", 0x8A2020)

    # Hanging red wattle under the chin
    for side in (-1.0, 1.0):
        add(
            add_sphere("chk_wattle", None, comb, 0.018, 0.042, 0.024, tx=side * 0.016, ty=0.56, tz=-0.29, segs=6, rings=5),
            "HeadGroup",
            0x8A2020,
        )

    # Hooked yellow beak (upper and lower)
    add(
        add_cone_spike(
            "chk_beak_upper", None, beak, base_r=0.034, length=0.11, tx=0.0, ty=0.62, tz=-0.29,
            rx=-math.pi * 0.52, curve_bend=-0.022, segs=6, flatten_x=0.82,
        ),
        "HeadGroup",
        0xA87824,
    )
    add(
        add_cone_spike(
            "chk_beak_lower", None, beak, base_r=0.026, length=0.085, tx=0.0, ty=0.595, tz=-0.285,
            rx=-math.pi * 0.46, segs=6, flatten_x=0.78,
        ),
        "HeadGroup",
        0xA87824,
    )

    # Beaded eyes, 0.046 across (0.032 until M3a: nothing on screen under 0.044, design 5.3). No object's
    # name holds 'eye': the engine draws a whole mesh unlit by that word.
    for side in (-1.0, 1.0):
        add(add_sphere("chk_bead", None, beak, 0.023, 0.023, 0.020, tx=side * 0.07, ty=0.635, tz=-0.255, segs=6, rings=5), "HeadGroup", 0x1E1A17)

    # Layered side wing feathers, each wing on its own bone
    for side, bone in ((-1.0, "LWing"), (1.0, "RWing")):
        wing_sec = [
            (-0.14, 0.028, 0.085, side * 0.19, 0.37, 0.15),
            (-0.04, 0.038, 0.115, side * 0.21, 0.36, 0.15),
            (0.08, 0.034, 0.105, side * 0.20, 0.37, 0.15),
            (0.18, 0.018, 0.065, side * 0.17, 0.39, 0.15),
        ]
        add(add_lathe("chk_wing", None, skin, wing_sec, segs=CHICKEN_SEGS["wing"], axis="Z"), bone, 0xD6C8AE)
        for f_idx in range(3):
            add(
                add_cone_spike(
                    "chk_feather", None, skin, base_r=0.026, length=0.14, tx=side * (0.195 - f_idx * 0.008),
                    ty=0.39 - f_idx * 0.035, tz=0.08, rx=math.pi * 0.44 + f_idx * 0.08, ry=side * 0.12,
                    flatten_x=0.38, segs=CHICKEN_SEGS["feather"],
                ),
                bone,
                0xE8E0D0,
            )

    # Fanned tail plumage (5 arched tail feathers)
    for t_idx in range(-2, 3):
        ang_fan = t_idx * 0.24
        add(
            add_curved_tube(
                "chk_tail",
                None,
                skin,
                [
                    (t_idx * 0.025, 0.40, 0.22, 0.026, 0.012),
                    (math.sin(ang_fan) * 0.09, 0.51, 0.31, 0.036, 0.012),
                    (math.sin(ang_fan) * 0.15, 0.58 - abs(t_idx) * 0.02, 0.40, 0.028, 0.010),
                    (math.sin(ang_fan) * 0.19, 0.54 - abs(t_idx) * 0.03, 0.48, 0.008, 0.005),
                ],
                segs=CHICKEN_SEGS["tail"],
            ),
            "Hips",
            0x9E7846 if abs(t_idx) >= 1 else 0xE8E0D0,
        )

    # Legs on LeftLegPivot (-0.10, 0.24, 0.04) and RightLegPivot (0.10, 0.24, 0.04), as today: the whole
    # leg swings on that bone. Points are given leg-local as before and moved to the pivot.
    joints = {"Root": (0.0, 0.0, 0.0), "Hips": (0.0, 0.36, 0.0), "Torso": (0.0, 0.40, -0.14), "HeadGroup": (0.0, 0.46, -0.21)}
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        px, py, pz = side * 0.10, 0.24, 0.04
        joints[f"{tag}LegPivot"] = (px, py, pz)
        joints[f"{tag}KneePivot"] = (px, py - 0.11, pz + 0.01)
        joints[f"{tag}Foot"] = (px, py - 0.22, pz - 0.01)
        # The biped's arm bones exist and carry nothing; the wings hinge at their roots
        joints[f"{tag}ArmPivot"] = (side * 0.15, 0.40, -0.08)
        joints[f"{tag}ElbowPivot"] = (side * 0.20, 0.36, 0.0)
        joints[f"{tag}Hand"] = (side * 0.20, 0.34, 0.08)

        def at(p):
            return (px + p[0], py + p[1], pz + p[2])

        bone = f"{tag}LegPivot"
        add(add_limb_tube("chk_drumstick", None, skin, at((0.0, 0.04, 0.0)), at((0.0, -0.07, 0.02)), 0.052, 0.024, segs=CHICKEN_SEGS["drumstick"]), bone, 0xE8E0D0)
        add(add_limb_tube("chk_shank", None, beak, at((0.0, -0.06, 0.02)), at((0.0, -0.22, -0.01)), 0.018, 0.015, segs=CHICKEN_SEGS["shank"]), bone, 0xA87824)
        # 3 forward toes and talons resting on the ground
        for toe_ang in (-0.42, 0.0, 0.42):
            dx = math.sin(toe_ang) * 0.095
            dz = -math.cos(toe_ang) * 0.105
            add(add_limb_tube("chk_toe", None, beak, at((0.0, -0.22, -0.01)), at((dx, -0.235, -0.01 + dz)), 0.013, 0.007, segs=CHICKEN_SEGS["toe"]), bone, 0xA87824)
            t = at((dx, -0.235, -0.01 + dz))
            add(
                add_cone_spike("chk_talon", None, beak, base_r=0.008, length=0.032, tx=t[0], ty=t[1], tz=t[2], rx=-math.pi * 0.48, ry=-toe_ang, segs=CHICKEN_SEGS["talon"]),
                bone,
                0x1E1A17,
            )
    joints["LWing"] = (-0.16, 0.42, 0.0)
    joints["RWing"] = (0.16, 0.42, 0.0)

    table = [row._replace(flag="code_posed") for row in rigs.BIPED_TABLE]
    rig = figkit.make_rig("Monster_chicken", table, {k: t2b(*p) for k, p in joints.items()}, prefix="chicken")
    for obj, bone in hard:
        figkit.hard_weights(obj, bone)
        obj.parent = rig

    merged = figkit.merge_by_family(rig)
    names = {"skin": "chicken_body", "cloth": "chicken_comb", "plain": "chicken_beak"}
    for ob in merged:
        ob.name = ob.data.name = names[figkit.get_material_family(ob)]
    _figure_paint(rig, merged, CHICKEN_OCCLUSION)

    tris = sum(len(p.vertices) - 2 for ob in merged for p in ob.data.polygons)
    if tris > CHICKEN_TRIANGLES:
        raise ValueError(f"chicken: {tris} triangles, over the budget of {CHICKEN_TRIANGLES}")
    print(f"[Blender] chicken: {tris} triangles in {len(merged)} meshes")
    return rig


# =============================================================================
# 2. Monster_goblin (Goblin Raider): the pilot, rebuilt and skinned (plan S2)
# =============================================================================
# One build, the owner's choice at OM-P (2026-11-25): the body from figkit.organic_body over a
# stick graph (route a) and three engine material families (skin, wood, metal). Coordinates are
# three-space like the rest of this file (+Y up, -Z forward). The figure stands at the file's
# origin (design 6.1.1 rule 2b).
GOBLIN_TRIANGLES = 4400  # the builder's own budget (S2d), under the manifest's 5,000: what keeps the figure under 115 kB on the wire with the head's planes
GOBLIN_OCCLUSION = 0.5  # bake_paint's occlusion strength for the goblin (0.35 by default)
GOBLIN_PLANE_SPREAD = math.radians(40.0)  # a plane holds the faces within this angle of its first face
GOBLIN_PLANE_MIN = 0.01  # a plane under this share of the skin's area joins a neighbour
GOBLIN_CREASE = math.radians(32.0)  # body edges sharper than this are hard; the rest stay smooth
GOBLIN_KIN_SPREAD = math.radians(30.0)  # the raider's and the archer's body planes (M3a): a step between chest and belly
GOBLIN_SHIELD_SEGS = 12  # the raider's shield rim and planks (18 until M3a), which pay for the narrower planes
# Plane tone (plan S2c, widened at S2d): a plane facing GOBLIN_PLANE_LIGHT is 15% lighter, one facing
# away 25% darker. The engine's cut shade bands only the planes the key reaches; on the shade side
# the tone is all that parts one plane from the next.
GOBLIN_PLANE_TONE = (-0.25, 0.15)
GOBLIN_PLANE_LIGHT = Vector(t2b(0.0, 1.0, -1.0)).normalized()  # up and forward
GOBLIN_BELT_SEGS = 16  # the belt is three bands of this many quads
GOBLIN_SCALE = 1.02  # the numbers below build a figure 1.752 tall; the shipped goblin is 1.785
GOBLIN_COLOURS = {
    "skin": 0x666E46,  # warm grey olive, 43% value
    "skin_dark": 0x474D32,  # hands and feet, 30% value
    "bone": 0xBDB39C,
    "rust_cloth": 0x8A4A2C,
    "iris": 0xE6B820,
    "pupil": 0x1E1410,
    "mouth": 0x3B2018,
    "wood": 0x735238,  # 45% value
    "leather": 0x4D3627,  # 30% value
    "bronze": 0xAA7A2E,  # 67% value
    "rust": 0x80502C,  # 50% value, 16.5 points under bronze
}
# The engine multiplies a skin mesh by this tile (textures.ts, 'goblin-hide'), a grey yellow green:
# the skin's paint is divided by the tile's mean so the game shows the colours above (plan S2c).
GOBLIN_HIDE_TILE = "public/textures/creatures/goblin-hide.png"


def goblin_joints() -> dict:
    """
    Joints of the biped rig. The bind pose is the goblin's stance, each limb within 20 degrees
    of the biped reference (design 6.1.1 rule 3): spine and neck lean forward, arms held out
    from the body, knees bent and bowed.
    """
    j = {
        "Root": (0.0, 0.0, 0.0),
        "Hips": (0.0, 0.68, 0.04),
        "Torso": (0.0, 0.87, -0.025),
        "HeadGroup": (0.0, 1.31, -0.175),
        "Jaw": (0.0, 1.40, -0.26),
    }
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        j[f"{tag}ArmPivot"] = (side * 0.30, 1.22, -0.10)
        j[f"{tag}ElbowPivot"] = (side * 0.506, 0.968, -0.044)
        j[f"{tag}Hand"] = (side * 0.624, 0.695, -0.131)
        j[f"{tag}LegPivot"] = (side * 0.14, 0.66, 0.03)
        j[f"{tag}KneePivot"] = (side * 0.2325, 0.384, -0.06)
        j[f"{tag}Foot"] = (side * 0.2085, 0.099, 0.03)
    j["WeaponPivot"] = j["RightHand"]
    j["OffhandPivot"] = j["LeftHand"]
    return j


def _goblin_hide_mean(tile: str) -> list:
    """Mean colour of an albedo tile, linear, read from the engine's own file."""
    img = bpy.data.images.load(os.path.join(paths.repo_root(), tile))
    px = [0.0] * (len(img.pixels))
    img.pixels.foreach_get(px)  # an 8-bit file's pixels come as stored, sRGB
    count = len(px) // img.channels
    mean = [sum(s2l(c) for c in px[k :: img.channels]) / count for k in range(3)]
    bpy.data.images.remove(img)
    print(f"[Blender] {os.path.splitext(os.path.basename(tile))[0]} tile mean, linear: {mean[0]:.4f} {mean[1]:.4f} {mean[2]:.4f}")
    return mean


def _goblin_skin_paint(hex_colour: int, tile: list) -> list:
    """The paint that shows hex_colour in the game on a mesh the goblin-hide tile multiplies."""
    paint = [c / m for c, m in zip(hex_to_rgba(hex_colour), tile)]
    if max(paint) > 1.0 / (1.0 + GOBLIN_PLANE_TONE[1]):
        raise ValueError(f"goblin: skin colour {hex_colour:#08x} over the hide tile's mean is too light to paint: {paint}")
    return paint


def _goblin_tint(obj, colour, planes: bool = False, tone: tuple = GOBLIN_PLANE_TONE) -> None:
    """
    A 'Tint' colour on every face corner, which the paint layer multiplies. All the goblin's
    materials are white, so the tint is the colour itself: a hex colour, or linear RGB for the
    skin (the colour over the hide tile's mean). With planes, each face's corners also take the
    tone of the face's plane (_goblin_plane_tones).
    """
    tint = list(hex_to_rgba(colour)[:3]) if isinstance(colour, int) else colour
    tones = _goblin_plane_tones(obj, tone) if planes else [1.0] * len(obj.data.polygons)
    cols = []
    for p, tone in zip(obj.data.polygons, tones):
        cols += [*(c * tone for c in tint), 1.0] * len(p.vertices)
    obj.data.color_attributes.new("Tint", "FLOAT_COLOR", "CORNER").data.foreach_set("color", cols)


def _goblin_skin(ob, name: str, mat, triangles: int, soften: int, keep: tuple = (), crease: float | None = None, spread: float = GOBLIN_PLANE_SPREAD):
    """
    Rounds a voxel skin (soften smoothing passes), cuts it flat at the ground, decimates it to its
    triangle count, validates, names it and gives it its one material. keep is (centre, radius)
    balls in Blender space whose inside takes a fifth of the smoothing, rising to all of it at
    1.6 radii: the passes shrink a limb's end to a stump, and a hand or a foot has to keep its
    shape. crease is an angle: every edge whose faces meet more sharply is marked hard, and so is
    every edge between two planes of _goblin_planes, so the exporter splits its vertices and the
    form reads as carved planes; None leaves all smooth. spread is _goblin_planes' angle.
    """
    bpy.context.view_layer.objects.active = ob
    smooth = ob.modifiers.new("Soften", "SMOOTH")
    if keep:
        group = ob.vertex_groups.new(name="Soften")
        for v in ob.data.vertices:
            t = min(max(0.0, min(((v.co - c).length / r - 1.0) / 0.6 for c, r in keep)), 1.0)
            group.add([v.index], 0.2 + 0.8 * t * t * (3.0 - 2.0 * t), "REPLACE")
        smooth.vertex_group = group.name
    smooth.factor = 0.5
    smooth.iterations = soften
    bpy.ops.object.modifier_apply(modifier="Soften")
    for v in ob.data.vertices:  # soles flat on the ground
        v.co.z = max(v.co.z, 0.0)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris > triangles:
        dec = ob.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = triangles / tris
        bpy.ops.object.modifier_apply(modifier="Decimate")
    ob.data.validate()
    ob.vertex_groups.clear()
    ob.name = ob.data.name = name
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    if crease is not None:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        # The decimate leaves a loose sliver, one triangle joined to nothing, off the tip of a thin
        # blade (each ear). It is removed; the check below still stops a real hole.
        loose = [f for f in bm.faces if all(e.is_boundary for e in f.edges)]
        bmesh.ops.delete(bm, geom=loose + [v for f in loose for v in f.verts], context="VERTS")
        print(f"[Blender] {name}: {len(loose)} loose triangles removed before the closed-skin check")
        bm.faces.index_update()
        open_edges = sum(1 for e in bm.edges if not e.is_manifold)
        assert open_edges == 0, f"{name}: {open_edges} of {len(bm.edges)} edges do not have exactly two faces; the skin must be closed before its hard edges are marked"
        euler = len(bm.verts) - len(bm.edges) + len(bm.faces)
        assert euler == 2, f"{name}: vertices less edges plus faces is {euler}, not 2; the skin has tunnels or loose pieces"
        plane = _goblin_planes(bm, crease, spread)
        for e in bm.edges:
            e.smooth = plane[e.link_faces[0].index] == plane[e.link_faces[1].index] and e.calc_face_angle() < crease
        bm.to_mesh(ob.data)
        bm.free()
    return ob


def _goblin_planes(bm, crease: float, spread: float = GOBLIN_PLANE_SPREAD) -> list:
    """
    The body's faces sorted into planes (plan S2c): from the largest free face, a plane grows across
    every edge under the crease angle to faces within spread (GOBLIN_PLANE_SPREAD) of that first face's
    normal, so a limb comes out as four or five sides. A plane under GOBLIN_PLANE_MIN of the skin's
    area then joins the neighbour it faces most nearly. The edges between two planes are marked
    hard with the creases, so the hard edges close round each plane; edges over an angle alone
    leave most of them open (at S2b one region held 96% of route a's skin and 79% of route b's).
    """
    plane = [-1] * len(bm.faces)
    normals, areas = [], []
    for seed in sorted(bm.faces, key=lambda f: -f.calc_area()):
        if plane[seed.index] >= 0:
            continue
        plane[seed.index] = len(normals)
        queue, normal, area = [seed], Vector(), 0.0
        for f in queue:  # grows while it is read: breadth first from the seed
            normal += f.normal * f.calc_area()
            area += f.calc_area()
            for e in f.edges:
                if e.calc_face_angle() >= crease:
                    continue
                for g in e.link_faces:
                    if plane[g.index] < 0 and g.normal.angle(seed.normal) < spread:
                        plane[g.index] = len(normals)
                        queue.append(g)
        normals.append(normal.normalized())
        areas.append(area)
    total = sum(areas)
    for small in sorted(range(len(areas)), key=lambda i: areas[i]):
        if areas[small] >= GOBLIN_PLANE_MIN * total:
            continue  # large from the start, or grown past the limit by the planes that joined it
        faces = [f for f in bm.faces if plane[f.index] == small]
        near = {plane[g.index] for f in faces for e in f.edges for g in e.link_faces} - {small}
        into = max(near, key=lambda i: normals[i].dot(normals[small]))
        for f in faces:
            plane[f.index] = into
        normals[into] = (normals[into] * areas[into] + normals[small] * areas[small]).normalized()
        areas[into] += areas[small]
        areas[small] = total  # gone
    return plane


def _goblin_fuse(objs: list, name: str, mat, voxel: float, triangles: int, soften: int, crease: float | None = None):
    """Closed primitives fused into one continuous skin: join, voxel remesh, soften, decimate (the head)."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    ob = objs[0]
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    ob.data.remesh_voxel_size = voxel
    bpy.ops.object.voxel_remesh()
    return _goblin_skin(ob, name, mat, triangles, soften, crease=crease)


def _goblin_limb_dir(a: tuple, b: tuple) -> Vector:
    return (Vector(b) - Vector(a)).normalized()


def _goblin_body_graph(j: dict) -> tuple[list, list, list, list]:
    """
    The stick graph and radii for figkit.organic_body, and the keep balls of hands and feet
    for _goblin_skin, in Blender space. Each limb narrows between its joints, so shoulder, elbow,
    hip and knee stand out as forms after the smoothing.
    """
    pts, radii, edges, keep = [], [], [], []

    def chain(start, nodes):
        prev = start
        for p, r in nodes:
            pts.append(t2b(*p))
            radii.append(r)
            if prev is not None:
                edges.append((prev, len(pts) - 1))
            prev = len(pts) - 1
        return prev

    def along(a, b, t):
        return tuple(Vector(a).lerp(Vector(b), t))

    pelvis = chain(None, [((0.0, 0.66, 0.04), (0.165, 0.14))])
    # The waist is narrower than hips and ribs: one break between chest and waist
    # and the chest is two wide flat ellipses, so its front and back are planes (plan S2c)
    chest = chain(pelvis, [((0.0, 0.82, -0.02), 0.125), ((0.0, 0.97, -0.05), (0.26, 0.19)), ((0.0, 1.11, -0.07), (0.27, 0.19))])
    chain(chest, [((0.0, 1.24, -0.17), 0.13), ((0.0, 1.40, -0.27), 0.11)])  # neck, thrust forward into the head
    # The hump: one node standing off the back, which the skin modifier makes a block with a face
    # of its own. A second node down the back lies in the back's surface and leaves tunnels.
    chain(chest, [((0.0, 1.23, 0.10), 0.15)])
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        shoulder, elbow, hand = j[f"{tag}ArmPivot"], j[f"{tag}ElbowPivot"], Vector(j[f"{tag}Hand"])
        d = _goblin_limb_dir(elbow, hand)
        chain(chest, [
            ((side * 0.15, 1.19, -0.08), (0.18, 0.13)),  # collar: the shoulder line slopes instead of squaring off
            (shoulder, 0.105),
            (along(shoulder, elbow, 0.6), 0.078),
            (elbow, 0.092),
            (along(elbow, hand, 0.35), 0.07),
            (tuple(hand - d * 0.08), 0.056),  # wrist
            (tuple(hand - d * 0.02), 0.084),  # the hand: a fist wider than the wrist, around the hand joint
            (tuple(hand + d * 0.09), 0.078),
        ])
        keep.append((Vector(t2b(*(hand + d * 0.04))), 0.15))
        hip, knee, ankle = (side * 0.14, 0.64, 0.03), j[f"{tag}KneePivot"], j[f"{tag}Foot"]
        chain(pelvis, [
            (hip, 0.118),
            (along(hip, knee, 0.7), 0.082),
            (knee, 0.098),
            (along(knee, ankle, 0.3), 0.08),  # calf
            (along(knee, ankle, 0.8), 0.052),
            # The foot: a slab from the heel under the ankle joint to the toe box, 0.185 in front.
            # Heel and toe box are at one height, 0.05 tall, and reach under the ground, where
            # _goblin_skin cuts them flat. On this level edge the skin modifier's second radius is
            # the one across the foot: 0.062 at the heel, 0.09 at the toe box.
            ((ankle[0], 0.045, 0.03), (0.05, 0.062)),
            # The instep (M3a): the top of the foot rises from the toe box to the ankle
            ((ankle[0] * 1.015, 0.07, -0.06), (0.065, 0.07)),
            ((ankle[0] * 1.03, 0.045, -0.155), (0.05, 0.09)),  # toe box 0.09 across (0.075 until M3a)
        ])
        keep.append((Vector(t2b(ankle[0], 0.04, -0.07)), 0.17))
    return pts, edges, radii, keep


def _goblin_belt(body, mat, tag: str = "gob"):
    """
    The belt, laid on the finished body: sixteen rays from the body's axis at two heights find its
    surface, and the band stands 0.02 outside it, with a lip turned in above and below. A lathe of
    fixed radii sank into the belly and could not be seen.
    """
    from mathutils.bvhtree import BVHTree

    tree = BVHTree.FromPolygons([v.co for v in body.data.vertices], [tuple(p.vertices) for p in body.data.polygons])
    bm = bmesh.new()
    rings = []
    for y, gap in ((0.655, -0.012), (0.66, 0.02), (0.75, 0.02), (0.755, -0.012)):
        ring = []
        for i in range(GOBLIN_BELT_SEGS):
            a = i / GOBLIN_BELT_SEGS * math.pi * 2.0
            out = Vector((math.cos(a), math.sin(a), 0.0))
            hit = tree.ray_cast(Vector(t2b(0.0, y, 0.03)), out)[0]
            if hit is None:
                raise ValueError(f"{tag}: the belt's ray at height {y}, angle {a:.2f} leaves the body without a hit")
            ring.append(bm.verts.new(hit + out * gap))
        rings.append(ring)
    for lo, hi in zip(rings, rings[1:]):
        for i in range(GOBLIN_BELT_SEGS):
            k = (i + 1) % GOBLIN_BELT_SEGS
            bm.faces.new((lo[i], lo[k], hi[k], hi[i]))
    return finalize_obj(f"{tag}_belt", bm, None, mat)


def _goblin_head(mat):
    """The head: skull, heavy brow, hooked nose and big ears fused into one form, with hard edges round its planes like the body."""
    parts = [
        add_sphere("gob_skull", None, mat, 0.24, 0.24, 0.25, tx=0.0, ty=1.50, tz=-0.30, segs=16, rings=12),
        add_curved_tube(
            "gob_brow",
            None,
            mat,
            [
                (-0.20, 1.60, -0.43, 0.04),
                (-0.09, 1.585, -0.525, 0.05),
                (0.0, 1.57, -0.545, 0.042),
                (0.09, 1.585, -0.525, 0.05),
                (0.20, 1.60, -0.43, 0.04),
            ],
            segs=8,
        ),
        add_cone_spike(
            "gob_nose", None, mat, base_r=0.068, length=0.23, tx=0.0, ty=1.50, tz=-0.52,
            rx=-math.pi * 0.56, curve_bend=-0.05, segs=10, flatten_x=0.75,
        ),
    ]
    for side in (-1.0, 1.0):
        # flatten_x above 1: the ear is a blade seen broad from the front, 0.06 thick
        parts.append(
            add_cone_spike(
                "gob_ear", None, mat, base_r=0.03, length=0.52, tx=side * 0.19, ty=1.53, tz=-0.24,
                rx=0.30, rz=-side * 1.15, curve_bend=0.06, segs=10, flatten_x=3.2,
            )
        )
    return _goblin_fuse(parts, "gob_head", mat, 0.012, 800, soften=3, crease=GOBLIN_CREASE)


def _goblin_plane_tones(body, tone: tuple = GOBLIN_PLANE_TONE) -> list:
    """
    One tone per face of a part, the same for every face of a plane (plan S2c). A plane is the
    smooth faces joined by edges that are not hard, or one flat face of a faceted part; its tone
    comes from its area-weighted normal against GOBLIN_PLANE_LIGHT. Two corners of one vertex in
    different planes are parted by hard edges or flat faces, which the exporter splits anyway, so
    the tone costs no vertex.
    """
    bm = bmesh.new()
    bm.from_mesh(body.data)
    plane = [-1] * len(bm.faces)
    tones, areas = [], []
    for seed in bm.faces:
        if plane[seed.index] >= 0:
            continue
        plane[seed.index] = len(tones)
        stack, normal, area = [seed], Vector(), 0.0
        while stack:
            f = stack.pop()
            a = f.calc_area()
            normal += f.normal * a
            area += a
            for e in f.edges:
                if e.smooth and f.smooth:
                    for g in e.link_faces:
                        if plane[g.index] < 0 and g.smooth:
                            plane[g.index] = len(tones)
                            stack.append(g)
        s = normal.dot(GOBLIN_PLANE_LIGHT) / area  # a plane that wraps round a form averages to no tone
        tones.append(1.0 + s * (tone[1] if s > 0.0 else -tone[0]))
        areas.append(area)
    bm.free()
    total = sum(areas)
    top = sorted(areas, reverse=True)
    print(
        f"[Blender] goblin planes of {body.name}: {len(tones)} on {len(plane)} faces; largest {top[0] / total:.1%} of the area, "
        f"five largest {sum(top[:5]) / total:.1%}; tones {min(tones):.3f} to {max(tones):.3f}"
    )
    return [tones[i] for i in plane]


def _goblin_body_tint(body, main: list, dark: list) -> None:
    """
    Paint rule of the body: olive, going to the darker olive on hands and feet, times each plane's
    tone. A vertex that a hand or foot bone holds by half or more is all dark, so a foot is one slab
    of the dark tone and the change to olive lies on the shin.
    """
    ends = {g.index for g in body.vertex_groups if g.name.endswith(("Hand", "Foot"))}
    base = []
    for v in body.data.vertices:
        t = min(1.0, 2.0 * sum(g.weight for g in v.groups if g.group in ends))
        base.append([main[c] + (dark[c] - main[c]) * t for c in range(3)])
    cols = []
    for p, tone in zip(body.data.polygons, _goblin_plane_tones(body)):
        for vi in p.vertices:
            cols += [c * tone for c in base[vi]] + [1.0]
    body.data.color_attributes.new("Tint", "FLOAT_COLOR", "CORNER").data.foreach_set("color", cols)


def _figure_paint(rig, merged: list, ao: float) -> None:
    """
    The paint layer of a skinned figure, on its merged meshes (README pattern step 8): the baked layer
    (occlusion, height gradient, warm to cool, one value a vertex) times each part's 'Tint' (colour
    and plane tone, one value a face corner), stored per face corner so a tone can change across a
    hard edge. Nothing else is in the bake, so no neighbour on the grid shades the figure. The meshes
    drop their UV layers and take the armature modifier.
    """
    others = [o for o in bpy.data.objects if o not in merged and not o.hide_render]
    for o in others:
        o.hide_render = True
    figkit.bake_paint(rig, ao=ao)
    for o in others:
        o.hide_render = False
    for ob in merged:
        attrs = ob.data.color_attributes
        baked, tint = [0.0] * (4 * len(ob.data.vertices)), [0.0] * (4 * len(ob.data.loops))
        attrs["Col"].data.foreach_get("color", baked)
        attrs["Tint"].data.foreach_get("color", tint)
        assert min(tint[3::4]) == 1.0, f"{ob.name}: a face corner came through the merge without a Tint"
        for li, loop in enumerate(ob.data.loops):
            for c in range(3):
                tint[4 * li + c] *= baked[4 * loop.vertex_index + c]
        attrs.remove(attrs["Col"])  # bake_paint's layer is one value a vertex; the exported one is per corner
        attrs.remove(attrs["Tint"])
        attrs.new("Col", "FLOAT_COLOR", "CORNER").data.foreach_set("color", tint)
        while ob.data.uv_layers:  # no figure reads GLB UVs (design 6.3)
            ob.data.uv_layers.remove(ob.data.uv_layers[0])
        attrs.active_color = attrs["Col"]
        attrs.render_color_index = attrs.active_color_index
        ob.modifiers.new("Armature", "ARMATURE").object = rig


def _build_goblin_kin(key: str, tag: str, colours: dict, kit):
    """
    One goblin of the raider's rig and proportions (the pilot's pattern, README): the kit's rigid parts
    first, then the body from what is left of the triangle budget, the belt laid on it, the rig named
    Monster_<key> with bones <key>_<Bone>, the weights, the tint, a merge by family into <key>_body,
    <key>_wood and <key>_metal, and the paint. kit(add, j, col, mats, aim) builds the head and every other
    rigid part through add(obj, bone, colour, planes) and returns a check of the finished body, or None.
    tag prefixes the objects the build makes, so two goblins never share a name.
    """
    import rigs  # the biped table; imported here because only the skinned builders read it (plan S2)

    # White: vertex colour multiplies the material's colour and can only darken it, so every colour
    # is paint. The wood and the metal family have a white material of the goblin's own too (the engine
    # picks a family by 'wood' and 'bronze' in the name): on the shared mat_wood and mat_bronze, wood
    # stopped at 24% value and bronze at 48%.
    mats = {
        "skin": make_mat("mat_skin_goblin_paint", 0xFFFFFF, roughness=0.58, metallic=0.04),
        "wood": make_mat("mat_wood_goblin_paint", 0xFFFFFF, roughness=0.70, metallic=0.02),
        "metal": make_mat("mat_bronze_goblin_paint", 0xFFFFFF, roughness=0.45, metallic=0.65),
    }
    tile = _goblin_hide_mean(GOBLIN_HIDE_TILE)
    col = dict(colours, skin=_goblin_skin_paint(colours["skin"], tile), skin_dark=_goblin_skin_paint(colours["skin_dark"], tile))
    j = goblin_joints()
    hard = []  # (object, bone): rigid parts, weight 1 on one bone

    def add(obj, bone: str, colour, planes: bool = False):
        _goblin_tint(obj, colour, planes)
        hard.append((obj, f"{key}_{bone}"))

    def aim(d) -> dict:
        """The rx and rz that turn a primitive's own +Y axis to the unit vector d."""
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    check = kit(add, j, col, mats, aim)

    # Body: what is left of the triangle budget, with hard edges so its planes read (plan S2b)
    hard_tris = sum(len(p.vertices) - 2 for obj, _ in hard for p in obj.data.polygons)
    body_tris = GOBLIN_TRIANGLES - 40 - hard_tris - GOBLIN_BELT_SEGS * 6
    pts, edges, radii, keep = _goblin_body_graph(j)
    # organic_body's own decimate is left out (a ceiling it never reaches): the skin is softened first.
    # Fourteen passes round the skin modifier's square limbs and leave the joints standing.
    body = _goblin_skin(
        figkit.organic_body((pts, edges), radii, 0.02, 10**9), f"{tag}_body", mats["skin"], body_tris, soften=14, keep=tuple(keep),
        crease=GOBLIN_CREASE, spread=GOBLIN_KIN_SPREAD,
    )
    if check:
        check(body)
    # The belt hangs from the hips like the loincloth, on the paint material like it (leather is
    # lighter than the shared mat_wood), and is laid on the finished body
    add(_goblin_belt(body, mats["skin"], tag), "Hips", col["leather"])

    for obj in [body] + [obj for obj, _ in hard]:
        obj.data.transform(Matrix.Scale(GOBLIN_SCALE, 4))
    j = {k: tuple(c * GOBLIN_SCALE for c in p) for k, p in j.items()}
    rig = figkit.make_rig(f"Monster_{key}", rigs.BIPED_TABLE, {k: t2b(*p) for k, p in j.items()}, prefix=key)

    # Weight rule 1: the body takes automatic weights from the sixteen limb bones only. Jaw and the
    # two hand mounts hold rigid parts, and a Root bone standing from the ground to the hips would
    # take the inner legs, so the weighting rig leaves the three out and starts Root inside the pelvis.
    core = {k: t2b(*p) for k, p in j.items() if k not in ("Jaw", "WeaponPivot", "OffhandPivot")}
    core["Root"] = t2b(0.0, 0.64 * GOBLIN_SCALE, 0.04 * GOBLIN_SCALE)
    weight_rig = figkit.make_rig(f"{key}_weight_rig", rigs.BIPED_TABLE, core, prefix=key)
    figkit.auto_weights(body, weight_rig, limb_radius=0.12 * GOBLIN_SCALE)
    # Weight rule 2: Root deforms nothing; its share goes to Hips.
    figkit.fold_weights(
        body,
        {b.name: ([b.name, f"{key}_Root"] if b.name == f"{key}_Hips" else [b.name]) for b in weight_rig.data.bones if b.name != f"{key}_Root"},
    )
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    weight_data = weight_rig.data
    bpy.data.objects.remove(weight_rig, do_unlink=True)
    bpy.data.armatures.remove(weight_data)
    _goblin_body_tint(body, col["skin"], col["skin_dark"])

    # Weight rule 3: every other part is rigid on one bone.
    for obj, bone in hard:
        figkit.hard_weights(obj, bone)
    for obj in [body] + [obj for obj, _ in hard]:
        obj.parent = rig

    merged = figkit.merge_by_family(rig)
    names = {"skin": f"{key}_body", "wood": f"{key}_wood", "metal": f"{key}_metal"}
    for ob in merged:
        ob.name = ob.data.name = names[figkit.get_material_family(ob)]

    _figure_paint(rig, merged, GOBLIN_OCCLUSION)

    tris = sum(len(p.vertices) - 2 for ob in merged for p in ob.data.polygons)
    if tris > GOBLIN_TRIANGLES:
        raise ValueError(f"{key}: {tris} triangles, over the budget of {GOBLIN_TRIANGLES}")
    print(f"[Blender] {key}: {tris} triangles in {len(merged)} meshes")
    return rig


def _goblin_eyes(add, skin, col, tag: str) -> None:
    """Yellow irises, each with a dark pupil standing just proud of it, 0.048 wide: nothing on the face is thinner than 0.044."""
    for side, s in ((-1.0, "L"), (1.0, "R")):
        iris = add_sphere(f"{tag}_iris_{s}", None, skin, 0.055, 0.04, 0.022, tx=side * 0.10, ty=1.505, tz=-0.522, rz=side * -0.25, segs=8, rings=6)
        add(iris, "HeadGroup", col["iris"])
        pupil = add_sphere(f"{tag}_pupil_{s}", None, skin, 0.024, 0.028, 0.014, tx=side * 0.10, ty=1.505, tz=-0.536, rz=side * -0.25, segs=8, rings=5)
        add(pupil, "HeadGroup", col["pupil"])


def _goblin_flaps(add, skin, colour, tag: str) -> None:
    """The loincloth hangs from the hips, never from the legs: two flaps 0.22 long, tapering to 0.6 of their width at the hem."""
    for name, tz, rx in ((f"{tag}_cloth_front", -0.16, -0.10), (f"{tag}_cloth_back", 0.19, 0.10)):
        flap = add_box(name, None, skin, 0.20, 0.22, 0.05, tx=0.0, ty=0.57, tz=tz, rx=rx, bevel=0.0)
        heights = [v.co.z for v in flap.data.vertices]
        for v in flap.data.vertices:
            v.co.x *= 0.6 + 0.4 * (v.co.z - min(heights)) / (max(heights) - min(heights))
        add(flap, "Hips", colour)


def _goblin_thumbs(add, j, skin, col, aim, tag: str) -> None:
    """A thumb on each fist: a blunt flat-faced block on the hand bone, lying up along the fist's inner front, half of it standing out of the fist."""
    for side, hand in ((-1.0, "Left"), (1.0, "Right")):
        h = Vector(j[f"{hand}Hand"])
        thumb = add_box(
            f"{tag}_thumb_{hand[0]}", None, skin, 0.055, 0.13, 0.06, tx=h.x - side * 0.075, ty=h.y + 0.045, tz=h.z - 0.10,
            bevel=0.0, **aim(Vector((-side * 0.15, 0.80, -0.58)).normalized()),
        )
        add(thumb, f"{hand}Hand", col["skin_dark"], planes=True)


def _raider_kit(add, j, col, mats, aim):
    """The raider's head and kit: lantern jaw and tusks, one pauldron, a spear in the right hand and a round shield on the left forearm."""
    skin, wood, metal = mats["skin"], mats["wood"], mats["metal"]
    # Head: rigid with the head bone, its planes toned like the body's. The irises are their own
    # vertices, so the paint stays crisp.
    add(_goblin_head(skin), "HeadGroup", col["skin"], planes=True)
    _goblin_eyes(add, skin, col, "gob")
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        # Underbite tusks rise from the jaw's front corners, outside the iris column and ending under it
        add(
            add_cone_spike(f"gob_fang_{tag}", None, skin, base_r=0.036, length=0.10, tx=side * 0.17, ty=1.33, tz=-0.585, rx=-0.10, rz=-side * 0.18, segs=6),
            "Jaw",
            col["bone"],
        )
        # Two bone spikes on the one pauldron
        add(
            add_cone_spike(f"gob_spike_{tag}", None, skin, base_r=0.035, length=0.13, tx=-0.37, ty=1.35, tz=-0.10 + side * 0.07, rz=0.5, segs=6),
            "LeftArmPivot",
            col["bone"],
        )
    # Lantern jaw: wider than the skull above it and 0.11 in front of the upper lip, so its top is a shelf
    # seen from the game's camera. The mouth is a dark slab between lip and jaw; it stays with the head.
    # Jaw, pauldron and boss are faceted (S2d): few flat faces, each with its own plane tone.
    add(add_sphere("gob_jaw", None, skin, 0.23, 0.10, 0.20, tx=0.0, ty=1.30, tz=-0.44, segs=8, rings=6, smooth=False), "Jaw", col["skin"], planes=True)
    add(add_sphere("gob_mouth", None, skin, 0.185, 0.03, 0.15, tx=0.0, ty=1.395, tz=-0.44, segs=10, rings=6), "HeadGroup", col["mouth"])

    _goblin_flaps(add, skin, col["rust_cloth"], "gob")
    add(
        add_sphere("gob_pauldron", None, metal, 0.15, 0.10, 0.15, tx=-0.33, ty=1.28, tz=-0.10, rz=0.35, segs=6, rings=5, smooth=False),
        "LeftArmPivot",
        col["rust"],
        planes=True,
    )
    _goblin_thumbs(add, j, skin, col, aim, "gob")

    # Spear in the right hand: butt on the ground outside the foot, head up, out and back, clear of the
    # body outline and, side-on, behind the skull instead of across the face (S2d)
    hand = Vector(j["RightHand"])
    d = Vector((0.30, 0.94, 0.20)).normalized()
    butt, top = hand - d * 0.69, hand + d * 0.80
    add(add_limb_tube("gob_spear_shaft", None, wood, tuple(butt), tuple(top), 0.034, 0.032, r_mid=0.033, segs=8, steps=3), "WeaponPivot", col["wood"])
    add(
        add_limb_tube("gob_spear_collar", None, metal, tuple(top - d * 0.10), tuple(top + d * 0.02), 0.048, 0.048, r_mid=0.048, segs=8, steps=2),
        "WeaponPivot",
        col["rust"],
    )
    add(
        add_cone_spike("gob_spear_head", None, metal, base_r=0.03, length=0.32, tx=top.x, ty=top.y, tz=top.z, segs=8, flatten_x=2.6, **aim(d)),
        "WeaponPivot",
        col["bronze"],
    )

    # Round shield on the left forearm, facing out and forward. Its face lies along the forearm and stands
    # 0.15 off the forearm's axis, so the fist (0.133 from that axis at most) is behind the planks, not through them.
    # Twelve sides (eighteen until M3a): they pay for the body's narrower planes.
    f = _goblin_limb_dir(j["LeftElbowPivot"], j["LeftHand"])
    n = Vector((-0.80, 0.10, -0.59))
    n = (n - f * n.dot(f)).normalized()
    c = (Vector(j["LeftElbowPivot"]) + Vector(j["LeftHand"])) / 2.0 + n * 0.15
    face = aim(n)
    segs = GOBLIN_SHIELD_SEGS
    add(add_lathe("gob_shield_rim", None, metal, [(-0.02, 0.30, 0.30), (0.02, 0.30, 0.30)], segs=segs, tx=c.x, ty=c.y, tz=c.z, **face), "OffhandPivot", col["bronze"])
    add(add_lathe("gob_shield_wood", None, wood, [(-0.026, 0.27, 0.27), (0.026, 0.27, 0.27)], segs=segs, tx=c.x, ty=c.y, tz=c.z, **face), "OffhandPivot", col["wood"])
    boss = c + n * 0.03
    add(add_sphere("gob_shield_boss", None, metal, 0.09, tx=boss.x, ty=boss.y, tz=boss.z, segs=6, rings=4, smooth=False), "OffhandPivot", col["bronze"], planes=True)

    def no_skin_through_the_shield(body):
        cb, nb = Vector(t2b(*c)), Vector(t2b(*n))
        through = sum(1 for v in body.data.vertices if (v.co - cb).dot(nb) > 0.026 and ((v.co - cb) - nb * (v.co - cb).dot(nb)).length < 0.27)
        if through:
            raise ValueError(f"goblin: {through} body vertices stand in front of the shield's planks")

    return no_skin_through_the_shield


def build_goblin(grid_pos: tuple[float, float, float], mats: dict):
    # grid_pos is not used: a skinned figure stands at the file's origin (design 6.1.1 rule 2b)
    return _build_goblin_kin("goblin", "gob", GOBLIN_COLOURS, _raider_kit)


# =============================================================================
# 3. Monster_goblin_archer (Goblin Archer): rebuilt on the raider's rig and proportions (plan M3a)
# =============================================================================
# Its own head (a hood the long ears come through, a longer hooked nose, a narrow chin with two small
# fangs), a lighter skin than the raider's (design 5.4: the ranged role lighter than the brute), a
# recurve bow held out on the left hand and a tall quiver standing over the right shoulder.
ARCHER_COLOURS = dict(
    GOBLIN_COLOURS,
    skin=0x7C8656,  # 53% value, ten points over the raider's
    skin_dark=0x575E3E,  # 37%
    hood=0x524436,  # dark brown cowl and loincloth, 32%
    fletch=0xC9BFA6,
)


def _archer_head(mat):
    """The archer's head: the raider's skull with a lighter brow, a longer hooked nose and ears swept back to come through the hood."""
    parts = [
        add_sphere("gar_skull", None, mat, 0.24, 0.24, 0.25, tx=0.0, ty=1.50, tz=-0.30, segs=16, rings=12),
        add_curved_tube(
            "gar_brow",
            None,
            mat,
            [
                (-0.19, 1.605, -0.43, 0.034),
                (-0.09, 1.59, -0.52, 0.042),
                (0.0, 1.575, -0.54, 0.036),
                (0.09, 1.59, -0.52, 0.042),
                (0.19, 1.605, -0.43, 0.034),
            ],
            segs=8,
        ),
        add_cone_spike(
            "gar_nose", None, mat, base_r=0.06, length=0.27, tx=0.0, ty=1.50, tz=-0.52,
            rx=-math.pi * 0.56, curve_bend=-0.075, segs=10, flatten_x=0.72,
        ),
    ]
    for side in (-1.0, 1.0):
        # flatten_x above 1: the ear is a blade seen broad from the front; swept further back than the raider's
        parts.append(
            add_cone_spike(
                "gar_ear", None, mat, base_r=0.03, length=0.50, tx=side * 0.19, ty=1.55, tz=-0.22,
                rx=0.48, rz=-side * 1.05, curve_bend=0.06, segs=10, flatten_x=3.2,
            )
        )
    return _goblin_fuse(parts, "gar_head", mat, 0.012, 800, soften=3, crease=GOBLIN_CREASE)


def _archer_hood(mat):
    """
    The cowl: a faceted shell over the skull, open in front of the face below the brow's top, with the
    ears passing through its sides; it hangs down the sides of the neck and the back to the hump, so it
    reads as a hood and not as a cap.
    """
    c = Vector((0.0, 1.49, -0.24))
    hood = add_sphere("gar_hood", None, mat, 0.29, 0.34, 0.31, tx=c.x, ty=c.y, tz=c.z, segs=10, rings=8, smooth=False)
    cb = Vector(t2b(*c))
    bm = bmesh.new()
    bm.from_mesh(hood.data)
    # Blender space: +Y is the figure's front, +Z up
    opening = [f for f in bm.faces if f.calc_center_median().y > cb.y + 0.04 and f.calc_center_median().z < 1.66]
    bmesh.ops.delete(bm, geom=opening, context="FACES")
    bm.to_mesh(hood.data)
    bm.free()
    return hood


def _archer_kit(add, j, col, mats, aim):
    skin, wood = mats["skin"], mats["wood"]
    add(_archer_head(skin), "HeadGroup", col["skin"], planes=True)
    _goblin_eyes(add, skin, col, "gar")
    add(_archer_hood(skin), "HeadGroup", col["hood"], planes=True)
    # The hood's point droops back from its crown
    d = Vector((0.0, -0.15, 1.0)).normalized()
    add(add_cone_spike("gar_hood_point", None, skin, base_r=0.10, length=0.32, tx=0.0, ty=1.66, tz=0.0, segs=6, smooth=False, **aim(d)), "HeadGroup", col["hood"], planes=True)
    # A narrow chin, faceted, with two small fangs rising from its corners; the mouth a dark slab
    add(add_sphere("gar_jaw", None, skin, 0.17, 0.085, 0.165, tx=0.0, ty=1.315, tz=-0.43, segs=8, rings=6, smooth=False), "Jaw", col["skin"], planes=True)
    add(add_sphere("gar_mouth", None, skin, 0.15, 0.028, 0.13, tx=0.0, ty=1.395, tz=-0.45, segs=10, rings=6), "HeadGroup", col["mouth"])
    for side in (-1.0, 1.0):
        add(
            add_cone_spike("gar_fang", None, skin, base_r=0.028, length=0.07, tx=side * 0.11, ty=1.34, tz=-0.555, rx=-0.10, rz=-side * 0.12, segs=6),
            "Jaw",
            col["bone"],
        )
    _goblin_flaps(add, skin, col["hood"], "gar")
    _goblin_thumbs(add, j, skin, col, aim, "gar")

    # A leather bracer on the bow arm's forearm
    e, h = Vector(j["LeftElbowPivot"]), Vector(j["LeftHand"])
    add(
        add_limb_tube("gar_bracer", None, skin, tuple(e.lerp(h, 0.30)), tuple(e.lerp(h, 0.78)), 0.088, 0.074, r_mid=0.084, segs=8, steps=3, smooth=False),
        "LeftElbowPivot",
        col["leather"],
        planes=True,
    )

    # The tall quiver on the back, standing over the right shoulder: a faceted leather case from the hips to
    # above the head's height, with the fletchings of four arrows out of its mouth
    lo, hi = Vector((0.24, 0.86, 0.155)), Vector((0.15, 1.53, 0.255))
    q = (hi - lo).normalized()
    add(add_limb_tube("gar_quiver", None, skin, tuple(lo), tuple(hi), 0.075, 0.085, r_mid=0.08, segs=8, steps=3, smooth=False), "Torso", col["leather"], planes=True)
    add(add_limb_tube("gar_quiver_lip", None, skin, tuple(hi - q * 0.06), tuple(hi + q * 0.01), 0.096, 0.096, r_mid=0.096, segs=8, steps=2, smooth=False), "Torso", col["hood"])
    for k, (dx, dz) in enumerate(((-0.035, -0.02), (0.03, -0.025), (-0.02, 0.03), (0.035, 0.025))):
        at = hi + q * 0.02 + Vector((dx, 0.0, dz))
        fd = (q + Vector((dx, 0.0, dz)) * 4.0).normalized()
        add(add_cone_spike(f"gar_fletch_{k}", None, wood, base_r=0.036, length=0.15, tx=at.x, ty=at.y, tz=at.z, segs=4, flatten_x=0.7, smooth=False, **aim(fd)), "Torso", col["fletch"])

    # The recurve bow in the left hand, held out at the side and upright: the grip in the fist is its most
    # forward point, the limbs sweep back to the tips and flick forward, the string runs tip to tip behind it.
    # Nothing on it is thinner than 0.044 (design 5.3), so the string is too.
    h = Vector(j["LeftHand"]) + Vector((-0.035, 0.0, 0.0))
    arc = [(0.012, 0.62, 0.11, 0.022), (0.0, 0.56, 0.15, 0.024), (-0.01, 0.40, 0.07, 0.028), (-0.01, 0.20, 0.012, 0.032), (0.0, 0.0, 0.0, 0.036),
           (-0.01, -0.20, 0.012, 0.032), (-0.01, -0.36, 0.07, 0.028), (0.0, -0.46, 0.14, 0.024), (0.012, -0.51, 0.10, 0.022)]
    add(add_curved_tube("gar_bow", None, wood, [(h.x + x, h.y + y, h.z + z, r) for x, y, z, r in arc], segs=6, smooth=False), "OffhandPivot", col["wood"], planes=True)
    add(
        add_limb_tube("gar_string", None, wood, (h.x, h.y + 0.56, h.z + 0.15), (h.x, h.y - 0.46, h.z + 0.14), 0.022, 0.022, r_mid=0.022, segs=4, steps=2),
        "OffhandPivot",
        col["bone"],
    )
    return None


def build_goblin_archer(grid_pos: tuple[float, float, float], mats: dict):
    # grid_pos is not used: a skinned figure stands at the file's origin (design 6.1.1 rule 2b)
    return _build_goblin_kin("goblin_archer", "gar", ARCHER_COLOURS, _archer_kit)


# =============================================================================
# 4. Monster_scorpion (King Scorpion): kept and re-rigged on the crawler rig, with its library (plan M3b)
# =============================================================================
# Today's design kept (design 4.6): a prosoma, five carapace plates, a six-segment tail arched over the
# back to the telson and sting, eight legs and two pincered claws. Chitin is rigid, so every part is
# hard-weighted to one bone. The legs are thickened (nothing under 0.044 across, design 5.3), each on
# its own bone, and the values are lifted to ochre and bone (design 5.4).
SCORPION_TRIANGLES = 5000
SCORPION_OCCLUSION = 0.5  # bake_paint's occlusion strength, as the goblin's
SCORPION_HEIGHT = 1.984  # the shipped scorpion's height; the re-rigged one stays within 5%
SCORPION_CHITIN_TILE = "public/textures/creatures/scorpion-chitin.png"  # the engine's tile for scorpion (textures.ts)
SCORPION_COLOURS = {  # as the game shows them
    "shell": 0x84582A,  # ochre: prosoma, odd plates, tail segments, femurs, upper claws (37% value; lighter melts into the dune sand)
    "plate": 0x6A4422,  # darker ochre: even plates, tibiae, forearms, telson (29%)
    "ring": 0x583A1C,  # joint rings and leg roots (24%)
    "bone": 0xC2B293,  # pincers, mandibles, tarsi (70%)
}
SCORPION_SEGS = {"plate": 12, "tail": 8, "ring": 8, "leg": 6, "claw": 8, "ball": 6}
SCORPION_LEGS = (  # coxa joint z, fan angle (0 straight out, + toward the tail), front to back
    (-0.12, -0.62),
    (0.02, -0.20),
    (0.16, 0.22),
    (0.30, 0.58),
)
SCORPION_TAIL = (  # (x, y, z, radius) along the tail, today's
    (0.0, 0.54, 0.68, 0.18),
    (0.0, 0.72, 0.92, 0.15),
    (0.0, 1.02, 1.06, 0.13),
    (0.0, 1.36, 1.02, 0.12),
    (0.0, 1.66, 0.80, 0.11),
    (0.0, 1.84, 0.46, 0.10),
    (0.0, 1.88, 0.12, 0.095),
)


def scorpion_joints() -> dict:
    """
    The crawler rig at today's pivots (three space, figure at the origin). LeftArmPivot and LeftLegPivot
    stand where today's pivots stood. Each leg's bone is at its coxa joint on the body's side; LegL1, the
    front leg, lies out to the side of LeftLegPivot (the table's reference child). The tail's three bones
    are today's first three tail nodes, so TailPivot3 carries the arch from the third node to the sting.
    """
    j = {"Root": (0.0, 0.0, 0.0), "Hips": (0.0, 0.50, 0.0), "HeadGroup": (0.0, 0.50, -0.55)}
    for s, tag, leg in ((-1.0, "Left", "L"), (1.0, "Right", "R")):
        j[f"{tag}ArmPivot"] = (s * 0.28, 0.52, -0.82)
        j[f"{tag}ElbowPivot"] = (s * 0.50, 0.54, -1.16)
        j[f"{tag}LegPivot"] = (s * 0.22, 0.50, 0.0)
        for n, (zc, _) in enumerate(SCORPION_LEGS, start=1):
            j[f"Leg{leg}{n}"] = (s * 0.62, 0.44, zc)
    for k, name in enumerate(("TailPivot", "TailPivot2", "TailPivot3")):
        j[name] = SCORPION_TAIL[k][:3]
    return j


def build_scorpion(grid_pos: tuple[float, float, float], mats: dict):
    """
    The king scorpion, kept and re-rigged (plan M3b): today's parts, three skinned meshes on the crawler
    rig, every part hard on one bone. grid_pos is not used: a skinned figure stands at the file's
    origin (design 6.1.1 rule 2b).
    """
    import rigs

    # White, like the goblin's: the paint is the colour. 'skin' draws with the scorpion-chitin tile, so
    # its paint is the colour over that tile's mean; the bone material is plain; the sting and the eyes
    # are the file's own mat_glow_crimson.
    skin = make_mat("mat_skin_scorpion_paint", 0xFFFFFF, roughness=0.38, metallic=0.15)
    bone_mat = make_mat("mat_bone_scorpion_paint", 0xFFFFFF, roughness=0.45, metallic=0.06)
    glow = mats["glow_crimson"]
    tile = _goblin_hide_mean(SCORPION_CHITIN_TILE)
    col = {k: _goblin_skin_paint(v, tile) for k, v in SCORPION_COLOURS.items() if k != "bone"}
    col["bone"] = SCORPION_COLOURS["bone"]
    col["glow"] = 0xFFFFFF
    seg = SCORPION_SEGS
    j = scorpion_joints()
    hard = []  # (object, bone)

    def add(obj, bone: str, colour: str):
        _goblin_tint(obj, col[colour])
        hard.append((obj, f"scorpion_{bone}"))

    # Prosoma, the head plate, on HeadGroup
    add(add_lathe("scp_prosoma", None, skin, [
        (-0.78, 0.18, 0.10, 0.0, 0.48, 0.25, 0.02, 0.03),
        (-0.56, 0.34, 0.16, 0.0, 0.50, 0.28, 0.03, 0.05),
        (-0.32, 0.40, 0.19, 0.0, 0.52, 0.28, 0.04, 0.06),
    ], segs=seg["plate"], axis="Z"), "HeadGroup", "shell")
    # Two eyes a side, 0.052 across, on the glow (no mesh name holds 'eye': the engine would draw it unlit)
    for side in (-1.0, 1.0):
        for e_i in range(2):
            add(add_sphere("scp_ocellus", None, glow, 0.026, tx=side * (0.08 + e_i * 0.06), ty=0.585 - e_i * 0.02,
                           tz=-0.68 + e_i * 0.05, segs=seg["ball"], rings=4), "HeadGroup", "glow")
        add(add_cone_spike("scp_mandible", None, bone_mat, base_r=0.045, length=0.22, tx=side * 0.09, ty=0.45, tz=-0.74,
                           rx=-math.pi * 0.48, ry=side * 0.25, curve_bend=-side * 0.04, segs=seg["leg"]), "HeadGroup", "bone")

    # Five overlapping carapace plates on Hips
    for p_idx, (pz, pw) in enumerate(zip((-0.28, -0.06, 0.16, 0.38, 0.58), (0.42, 0.45, 0.43, 0.38, 0.30))):
        add(add_lathe("scp_plate", None, skin, [
            (pz - 0.14, pw * 0.92, 0.17, 0.0, 0.50, 0.24, 0.04, 0.05),
            (pz, pw, 0.20, 0.0, 0.52, 0.26, 0.05, 0.07),
            (pz + 0.13, pw * 0.95, 0.18, 0.0, 0.51, 0.24, 0.04, 0.06),
        ], segs=seg["plate"], axis="Z"), "Hips", "shell" if p_idx % 2 == 0 else "plate")

    # The tail: segment k rides TailPivot, TailPivot2, then TailPivot3 from the third node on; the ring at
    # a node sits on the bone of the segment that starts there, centred on that bone's joint
    tail_bone = ("TailPivot", "TailPivot2", "TailPivot3", "TailPivot3", "TailPivot3", "TailPivot3")
    for k in range(6):
        a, b = SCORPION_TAIL[k], SCORPION_TAIL[k + 1]
        add(add_limb_tube("scp_tail", None, skin, a[:3], b[:3], a[3], b[3] * 0.92, r_mid=(a[3] + b[3]) * 0.58,
                          segs=seg["tail"], steps=4), tail_bone[k], "shell")
        ring_bone = tail_bone[k + 1] if k + 1 < 6 else "TailPivot3"
        add(add_sphere("scp_ring", None, skin, b[3] * 1.12, b[3] * 0.95, b[3] * 1.12, tx=b[0], ty=b[1], tz=b[2],
                       segs=seg["ring"], rings=5), ring_bone, "ring")
    add(add_sphere("scp_telson", None, skin, 0.14, 0.12, 0.18, tx=0.0, ty=1.86, tz=-0.02, segs=seg["ring"], rings=6), "TailPivot3", "plate")
    add(add_cone_spike("scp_sting", None, glow, base_r=0.065, length=0.38, tx=0.0, ty=1.85, tz=-0.16, rx=-math.pi * 0.68,
                       curve_bend=-0.12, segs=seg["claw"]), "TailPivot3", "glow")

    # Eight legs: the coxa from the body's side to the leg's joint rides the side pivot; femur, tibia
    # and tarsus ride the leg's own bone. Each leg fans out from its joint and ends on the ground.
    for s, tag, leg in ((-1.0, "Left", "L"), (1.0, "Right", "R")):
        for n, (zc, fan) in enumerate(SCORPION_LEGS, start=1):
            c = Vector(j[f"Leg{leg}{n}"])
            d = Vector((s * math.cos(fan), 0.0, math.sin(fan)))
            knee = c + d * 0.22 + Vector((0.0, 0.20, 0.0))
            ankle = c + d * 0.46 + Vector((0.0, -0.04, 0.0))
            tip = c + d * 0.58 + Vector((0.0, -0.44, 0.0))
            add(add_limb_tube("scp_coxa", None, skin, (s * 0.36, 0.48, zc * 0.8), tuple(c), 0.075, 0.062,
                              segs=seg["leg"], steps=3), f"{tag}LegPivot", "ring")
            add(add_sphere("scp_hinge", None, skin, 0.064, tx=c.x, ty=c.y, tz=c.z, segs=seg["ball"], rings=4), f"Leg{leg}{n}", "ring")
            add(add_limb_tube("scp_femur", None, skin, tuple(c), tuple(knee), 0.058, 0.050, segs=seg["leg"], steps=4), f"Leg{leg}{n}", "shell")
            add(add_limb_tube("scp_tibia", None, skin, tuple(knee), tuple(ankle), 0.050, 0.042, segs=seg["leg"], steps=4), f"Leg{leg}{n}", "plate")
            add(add_limb_tube("scp_tarsus", None, bone_mat, tuple(ankle), tuple(tip), 0.040, 0.024, segs=seg["leg"], steps=4), f"Leg{leg}{n}", "bone")

    # Claws: the pedipalp's upper arm rides the arm pivot; the forearm, the chela palm and both pincers
    # ride the elbow, which is set forward of today's bend so the arm lies within 20 degrees of the
    # rig's reference (forward and a little out)
    for s, tag in ((-1.0, "Left"), (1.0, "Right")):
        arm, elbow = j[f"{tag}ArmPivot"], j[f"{tag}ElbowPivot"]
        add(add_limb_tube("scp_pedipalp", None, skin, arm, elbow, 0.075, 0.068, segs=seg["claw"], steps=4), f"{tag}ArmPivot", "shell")
        add(add_sphere("scp_wrist", None, skin, 0.072, tx=elbow[0], ty=elbow[1], tz=elbow[2], segs=seg["ball"], rings=4), f"{tag}ElbowPivot", "ring")
        add(add_limb_tube("scp_forearm", None, skin, elbow, (s * 0.46, 0.56, -1.38), 0.068, 0.085, segs=seg["claw"], steps=4), f"{tag}ElbowPivot", "plate")
        add(add_sphere("scp_chela", None, skin, 0.15, 0.12, 0.21, tx=s * 0.45, ty=0.56, tz=-1.52, ry=-s * 0.22,
                       segs=seg["claw"], rings=6), f"{tag}ElbowPivot", "shell")
        add(add_cone_spike("scp_pincer", None, bone_mat, base_r=0.065, length=0.38, tx=s * 0.52, ty=0.56, tz=-1.62,
                           rx=-math.pi * 0.50, ry=s * 0.28, curve_bend=-s * 0.08, segs=seg["claw"]), f"{tag}ElbowPivot", "bone")
        add(add_cone_spike("scp_pincer", None, bone_mat, base_r=0.052, length=0.32, tx=s * 0.38, ty=0.55, tz=-1.62,
                           rx=-math.pi * 0.50, ry=-s * 0.24, curve_bend=s * 0.06, segs=seg["claw"]), f"{tag}ElbowPivot", "bone")

    rig = figkit.make_rig("Monster_scorpion", rigs.CRAWLER_TABLE, {k: t2b(*p) for k, p in j.items()}, prefix="scorpion")
    for obj, bone in hard:
        figkit.hard_weights(obj, bone)
        obj.parent = rig

    merged = figkit.merge_by_family(rig)
    names = {"skin": "scorpion_body", "plain": "scorpion_bone", "glow": "scorpion_sting"}
    for ob in merged:
        ob.name = ob.data.name = names[figkit.get_material_family(ob)]
    _figure_paint(rig, merged, SCORPION_OCCLUSION)

    tris = sum(len(p.vertices) - 2 for ob in merged for p in ob.data.polygons)
    if tris > SCORPION_TRIANGLES:
        raise ValueError(f"scorpion: {tris} triangles, over the budget of {SCORPION_TRIANGLES}")
    cos = [v.co for ob in merged for v in ob.data.vertices]
    size = [max(c[a] for c in cos) - min(c[a] for c in cos) for a in (0, 2, 1)]  # width, height, length
    print(f"[Blender] scorpion: {tris} triangles in {len(merged)} meshes; width {size[0]:.3f}, height {size[1]:.3f}, "
          f"length {size[2]:.3f}; lowest {min(c.z for c in cos):.4f}")
    if abs(size[1] / SCORPION_HEIGHT - 1.0) > 0.05:
        raise ValueError(f"scorpion: height {size[1]:.3f} is more than 5% from the shipped scorpion's {SCORPION_HEIGHT}")
    build_dragon_library(rig, merged, prefix="scorpion_", tables=_scorpion_clip_tables, label="scorpion", clip_prefix="scorpion_")
    return rig


# The crawler library (plan M3b, design 6.5): Idle, Walk, Strike, Death on the scorpion's bones, as the
# dragon's: pose tables on the twelve-a-second grid, rotation only, plus the measured Hips height. Values
# are three-space Euler triples local to the bone's parent (every rest rotation is identity). The figure
# faces -z: +x lifts a forward bone (a claw, the head) and tips the tail back and down, -x rears the tail
# up and over; on a left leg -y swings it forward and -z lifts its tip, mirrored on the right; +y opens a
# left claw outward, -y a right one. No Hurt clip (decision N-6). Strike's anticipation key is frame 8.
SCORPION_ANTICIPATION_FRAME = 8
SCORPION_BONES = (
    "Hips", "HeadGroup", "LeftArmPivot", "LeftElbowPivot", "RightArmPivot", "RightElbowPivot",
    "LeftLegPivot", "RightLegPivot", "LegL1", "LegL2", "LegL3", "LegL4", "LegR1", "LegR2", "LegR3", "LegR4",
    "TailPivot", "TailPivot2", "TailPivot3",
)


def _scorpion_clip_tables(pose_table):
    Z = (0.0, 0.0, 0.0)
    rest = {b: Z for b in SCORPION_BONES}

    def mirror(pose):
        """Left and right swapped (claws, side pivots and legs); y and z change sign."""
        out = {}
        for b, (x, y, z) in pose.items():
            o = b.replace("Left", "#").replace("Right", "Left").replace("#", "Right")
            if o == b:
                o = b.replace("LegL", "#").replace("LegR", "LegL").replace("#", "LegR")
            out[o] = (x, -y, -z)
        return out

    def legs(group, swing=0.0, lift=0.0):
        """Each (side, n) leg swung forward by `swing` and its tip raised by `lift` (radians)."""
        return {f"Leg{side}{n}": (0.0, (-1.0 if side == "L" else 1.0) * swing, (-1.0 if side == "L" else 1.0) * lift)
                for side, n in group}

    every = [(side, n) for side in "LR" for n in range(1, 5)]
    a_set = [("L", 1), ("R", 2), ("L", 3), ("R", 4)]  # the alternating tetrapod gait: these four step together
    b_set = [("R", 1), ("L", 2), ("R", 3), ("L", 4)]

    # Idle: the claws open and close a little out of phase, the tail sways and the sting bobs.
    idle_a = {"LeftArmPivot": (0.06, 0.05, 0.0), "RightArmPivot": (0.02, -0.02, 0.0), "LeftElbowPivot": (0.0, 0.06, 0.0),
              "TailPivot": (0.0, 0.05, 0.0), "TailPivot3": (-0.05, 0.0, 0.0), "HeadGroup": (0.02, 0.0, 0.0)}
    idle_b = {"LeftArmPivot": (0.03, 0.08, 0.0), "RightArmPivot": (0.03, -0.08, 0.0), "LeftElbowPivot": (0.0, 0.10, 0.0),
              "RightElbowPivot": (0.0, -0.10, 0.0), "TailPivot2": (-0.04, 0.0, 0.0), "TailPivot3": (0.06, 0.0, 0.0), "Hips": (0.015, 0.0, 0.0)}
    idle = pose_table("Idle", 48, rest, [
        (0, "rest", {}, "cr"), (12, "open", idle_a, "cr"), (24, "full", idle_b, "cr"),
        (36, "close", mirror(idle_a), "cr"), (48, "rest", {}, "cr"),
    ], loop=True)

    # Walk: two sets of four legs step in turn; the set in the air swings forward lifted, the set on
    # the ground pushes back. The body yaws a little against the step and the tail counters it.
    reach = {**legs(a_set, swing=0.22), **legs(b_set, swing=-0.22), "Hips": (0.0, 0.03, 0.0), "TailPivot": (0.0, -0.06, 0.0),
             "HeadGroup": (0.0, -0.02, 0.0), "LeftArmPivot": (0.05, 0.0, 0.0), "RightArmPivot": (-0.02, 0.0, 0.0)}
    passing = {**legs(b_set, lift=0.28), "TailPivot3": (0.03, 0.0, 0.0)}
    walk = pose_table("Walk", 16, rest, [
        (0, "reach", reach, "cr"), (4, "pass", passing, "cr"), (8, "reach other", mirror(reach), "cr"),
        (12, "pass other", mirror(passing), "cr"), (16, "reach", reach, "cr"),
    ], loop=True)

    # Strike: the tail rears and the sting draws back while the claws rise and spread (the telegraph),
    # then the tail whips over the head and the sting drives down in front, the claws snap in.
    a = SCORPION_ANTICIPATION_FRAME
    cock = {"TailPivot": (-0.12, 0.0, 0.0), "TailPivot2": (0.10, 0.0, 0.0), "TailPivot3": (0.40, 0.0, 0.0),
            "LeftArmPivot": (0.22, 0.18, 0.0), "RightArmPivot": (0.22, -0.18, 0.0), "LeftElbowPivot": (0.0, 0.15, 0.0),
            "RightElbowPivot": (0.0, -0.15, 0.0), "Hips": (0.04, 0.0, 0.0), "HeadGroup": (0.05, 0.0, 0.0)}
    hit = {"TailPivot": (-0.20, 0.0, 0.0), "TailPivot2": (-0.25, 0.0, 0.0), "TailPivot3": (-0.45, 0.0, 0.0),
           "LeftArmPivot": (-0.04, 0.05, 0.0), "RightArmPivot": (-0.04, -0.05, 0.0), "LeftElbowPivot": (0.0, -0.12, 0.0),
           "RightElbowPivot": (0.0, 0.12, 0.0), "Hips": (-0.05, 0.0, 0.0), "HeadGroup": (-0.06, 0.0, 0.0)}
    strike = pose_table("Strike", 20, rest, [
        (0, "rest", {}, "io"), (a, "cock", cock, "io"), (12, "strike", hit, "in"),
        (14, "hold", {k: tuple(v * 0.9 for v in val) for k, val in hit.items()}, "out"), (20, "settle", {}, "io"),
    ])

    # Death: a recoil, the legs buckle and lift, raised out to the sides, as the body drops onto its
    # plates rolled a little; the claws sag and the tail falls back and to the side.
    fall = {**legs(every, lift=0.85), "LeftArmPivot": (-0.20, 0.25, 0.0), "RightArmPivot": (-0.20, -0.20, 0.0),
            "LeftElbowPivot": (0.0, 0.30, 0.0), "RightElbowPivot": (0.0, -0.30, 0.0), "TailPivot": (0.55, 0.45, 0.0),
            "TailPivot2": (0.30, 0.20, 0.0), "TailPivot3": (0.45, 0.15, 0.0), "Hips": (0.0, 0.10, 0.10), "HeadGroup": (-0.08, 0.0, 0.0)}
    death = pose_table("Death", 26, rest, [
        (0, "rest", {}, "io"),
        (6, "recoil", {**legs(every, lift=0.10), "TailPivot": (-0.15, 0.0, 0.0), "TailPivot3": (0.25, 0.0, 0.0),
                       "LeftArmPivot": (0.20, 0.10, 0.0), "RightArmPivot": (0.20, -0.10, 0.0), "Hips": (0.05, 0.0, 0.0)}, "out"),
        (12, "buckle", {**legs(every, lift=0.35), "LeftArmPivot": (-0.05, 0.10, 0.0), "RightArmPivot": (-0.05, -0.10, 0.0),
                        "TailPivot": (0.15, 0.15, 0.0), "Hips": (0.0, 0.0, 0.04)}, "io"),
        (20, "fall", fall, "in"),
        (24, "bounce", dict(fall, Hips=(0.0, 0.10, 0.08), TailPivot=(0.50, 0.45, 0.0)), "out"),
        (26, "still", dict(fall, TailPivot=(0.58, 0.47, 0.0)), "io"),
    ])
    return [("Idle", idle, 48, True), ("Walk", walk, 16, True), ("Strike", strike, 20, False), ("Death", death, 26, False)]


# =============================================================================
# 4b. Kit_saltback_stalker: the Saltback Stalker's kit on the scorpion (plan K1, design 5.6)
# =============================================================================
# A clone of the scorpion plus rigid pieces of its own: salt crystals standing on the back plates, a
# forked double sting flanking the scorpion's own, and heavier salt-crusted claws. The engine adds each
# child of Kit_saltback_stalker under the scorpion bone its name gives without the kit_ prefix, keeping
# the child's own transform, so each child is one rigid mesh named <kit>_<Bone> (plan O-6.1b.6 amendment:
# GLB node names are unique, and two kits ride HeadGroup), at identity, whose vertices are relative to
# that bone's joint (every rest rotation is identity). Nothing of the scorpion is hidden:
# every piece is added over it. The paint is a corner colour on the scorpion's own white materials
# (mat_bone_scorpion_paint, plain; mat_glow_crimson for the prongs), so the kit adds no material, and
# Stage 4's tint multiplies it with the rest of the figure.
SALTBACK_KIT_TRIANGLES = 1200
SALTBACK_COLOURS = {  # as the game shows them before Stage 4's tint
    "salt": 0xE4DED0,  # crystal faces (87% Rec. 601 luma)
    "crust": 0xC9C1B0,  # the claw shells and the flank crystals (76%)
    "glow": 0xFFFFFF,
}
SALTBACK_BONES = ("Hips", "TailPivot3", "LeftElbowPivot", "RightElbowPivot")


def _salt_crystal(name: str, mat, r: float, h: float, tx: float, ty: float, tz: float, rx: float = 0.0, rz: float = 0.0):
    """A five-sided faceted crystal of base radius r and height h, growing along +y before the rotation."""
    return add_lathe(name, None, mat, [(0.0, r, r * 0.8), (h * 0.55, r * 0.8, r * 0.64), (h, 0.004, 0.004)],
                     segs=5, tx=tx, ty=ty, tz=tz, rx=rx, rz=rz, smooth=False)


def _kit_root(key: str, parts: dict, j: dict, budget: int):
    """
    Kit_<key> at the origin with one child per bone of parts ({bone: [objects]}), each the join of its
    pieces, named <key>_<bone> (object and mesh), its vertices relative to that bone's joint in
    j, painted with its 'Tint' as Col and without UVs. Refuses a taken name, a piece of more than one
    material and a kit over budget triangles.
    """
    kit = bpy.data.objects.new(f"Kit_{key}", None)
    bpy.context.collection.objects.link(kit)
    tris = 0
    for bone, objs in parts.items():
        bpy.ops.object.select_all(action="DESELECT")
        for ob in objs:
            ob.select_set(True)
        target = objs[0]
        bpy.context.view_layer.objects.active = target
        bpy.ops.object.join()
        target.name = f"{key}_{bone}"
        target.data.name = f"{key}_{bone}"
        if target.name != f"{key}_{bone}":
            raise ValueError(f"{key} kit: the piece for bone {bone} was named {target.name!r} (the name is taken)")
        if len(target.data.materials) != 1:
            raise ValueError(f"{key} kit: piece {bone} has {len(target.data.materials)} materials, one expected")
        target.data.transform(Matrix.Translation(-Vector(t2b(*j[bone]))))  # relative to the bone's joint
        attrs = target.data.color_attributes
        attrs["Tint"].name = "Col"
        attrs.active_color = attrs["Col"]
        attrs.render_color_index = attrs.active_color_index
        while target.data.uv_layers:  # no figure reads GLB UVs (design 6.3)
            target.data.uv_layers.remove(target.data.uv_layers[0])
        target.parent = kit
        tris += sum(len(p.vertices) - 2 for p in target.data.polygons)
    print(f"[Blender] {key} kit: {tris} triangles in {len(parts)} pieces")
    if tris > budget:
        raise ValueError(f"{key} kit: {tris} triangles, over the budget of {budget}")
    return kit


def build_saltback_stalker_kit(mats: dict):
    """
    The Saltback Stalker's kit (plan K1): Kit_saltback_stalker at the origin, with one child per bone in
    SALTBACK_BONES, each the join of its pieces, named saltback_stalker_<Bone>.
    """
    salt = bpy.data.materials["mat_bone_scorpion_paint"]  # build_scorpion's; the kit is built after it
    glow = mats["glow_crimson"]
    j = scorpion_joints()
    parts = {b: [] for b in SALTBACK_BONES}

    def add(obj, bone: str, colour: str):
        _goblin_tint(obj, SALTBACK_COLOURS[colour])
        parts[bone].append(obj)

    # The back: on each carapace plate a tall crystal on the spine, leaning back, and one each side
    # leaning out, so the back's outline is a jagged ridge from the side and a crown from the front
    for pz, pw, h in zip((-0.28, -0.06, 0.16, 0.38, 0.58), (0.42, 0.45, 0.43, 0.38, 0.30), (0.20, 0.28, 0.32, 0.26, 0.18)):
        add(_salt_crystal("ssk_ridge", salt, 0.075, h, 0.0, 0.70, pz, rx=0.28), "Hips", "salt")
        for side in (-1.0, 1.0):
            add(_salt_crystal("ssk_flank", salt, 0.06, h * 0.55, side * pw * 0.66, 0.66, pz + 0.03, rz=-side * 0.75), "Hips", "crust")

    # The fork: two prongs from the telson's sides, splayed out from the scorpion's own sting
    for side in (-1.0, 1.0):
        add(add_cone_spike("ssk_prong", None, glow, base_r=0.055, length=0.36, tx=side * 0.07, ty=1.86, tz=-0.10,
                           rx=-math.pi * 0.66, ry=-side * 0.50, curve_bend=-0.08, segs=6, smooth=False), "TailPivot3", "glow")

    # The claws: a faceted shell over the forearm, a heavier shell over the chela, and three crystals on top
    for s, tag in ((-1.0, "Left"), (1.0, "Right")):
        bone = f"{tag}ElbowPivot"
        elbow = j[bone]
        add(add_limb_tube("ssk_sleeve", None, salt, elbow, (s * 0.46, 0.56, -1.38), 0.095, 0.11, segs=6, steps=3,
                          smooth=False), bone, "crust")
        add(add_sphere("ssk_shell", None, salt, 0.20, 0.155, 0.27, tx=s * 0.47, ty=0.58, tz=-1.50, ry=-s * 0.22,
                       segs=7, rings=5, smooth=False), bone, "crust")
        for k, (cz, ch) in enumerate(((-1.34, 0.13), (-1.48, 0.17), (-1.62, 0.12))):
            add(_salt_crystal("ssk_claw_crystal", salt, 0.05, ch, s * (0.47 + 0.03 * k), 0.70, cz, rz=-s * 0.35), bone, "salt")

    return _kit_root("saltback_stalker", parts, j, SALTBACK_KIT_TRIANGLES)


# =============================================================================
# 5 and 6. Monster_dark_wizard and Monster_dark_ranger: rebuilt on the biped rig (plan M3e)
# =============================================================================
# Two humans on the pilot's pattern (docs/superpowers/baseline/models/README.md), built as the demon is:
# the rigid parts first, the body from what is left of the triangle budget, automatic weights from the
# limb bones, every rigid part hard on one bone, and the one cloth of each figure weighted by rule: the
# wizard's robe skirt between Hips and the thighs, the ranger's cloak between Torso and Hips.
# Coordinates are three-space (+Y up, -Z forward); each figure stands at the file's origin (design
# 6.1.1 rule 2b). Neither has a species tile (textures.ts), so a 'skin' material draws plain, and every
# paint is the colour over the mean of the tile its family draws with.
HUMAN_OCCLUSION = 0.5  # bake_paint's occlusion strength, as the goblin's
HUMAN_VOXEL = 0.02  # the goblin's: these are figures of its size
CLOTH_TILE = "public/textures/cloth.png"  # 'robe' and 'cloth' in a material name draw with this tile (blenderMonsters.ts)
LEATHER_TILE = "public/textures/leather.png"
WOOD_TILE = "public/textures/wood.png"
SKIRT_LEG_SHARE = 0.55  # the most of a hem vertex the thighs hold: the skirt swings with the stride and does not cling to it


def _human_body_graph(j: dict, r: dict) -> tuple[list, list, list, list]:
    """
    The stick graph and radii for figkit.organic_body and the keep balls of hands and feet for
    _goblin_skin, in Blender space: the goblin's graph at a human's joints. A narrow waist under a chest
    of two flat ellipses, the neck up to the head joint, and limbs that narrow between their joints, so
    shoulder, elbow, hip and knee stand as forms. r holds the radii.
    """
    pts, radii, edges, keep = [], [], [], []

    def chain(start, nodes):
        prev = start
        for p, rad in nodes:
            pts.append(t2b(*p))
            radii.append(rad)
            if prev is not None:
                edges.append((prev, len(pts) - 1))
            prev = len(pts) - 1
        return prev

    def along(a, b, t):
        return tuple(Vector(a).lerp(Vector(b), t))

    hips, torso, head = j["Hips"], j["Torso"], j["HeadGroup"]
    pelvis = chain(None, [(hips, r["pelvis"])])
    chest = chain(pelvis, [(torso, r["waist"]), (along(torso, head, 0.35), r["chest"]), (along(torso, head, 0.62), r["chest2"])])
    chain(chest, [(along(torso, head, 0.86), r["neck"]), (head, r["neck"] * 0.9)])
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        shoulder, elbow, hand = j[f"{tag}ArmPivot"], j[f"{tag}ElbowPivot"], Vector(j[f"{tag}Hand"])
        d = (hand - Vector(elbow)).normalized()
        chain(chest, [
            ((shoulder[0] * 0.55, shoulder[1] - 0.03, shoulder[2]), r["collar"]),  # the shoulder line slopes from the neck
            (shoulder, r["shoulder"]),
            (along(shoulder, elbow, 0.6), r["upper"]),
            (elbow, r["elbow"]),
            (along(elbow, hand, 0.35), r["fore"]),
            (tuple(hand - d * 0.07), r["wrist"]),
            (tuple(hand - d * 0.01), r["hand"]),  # the fist, around the hand joint
            (tuple(hand + d * 0.08), r["hand"] * 0.92),
        ])
        keep.append((Vector(t2b(*(hand + d * 0.03))), 0.13))
        hip, knee, ankle = j[f"{tag}LegPivot"], j[f"{tag}KneePivot"], j[f"{tag}Foot"]
        chain(pelvis, [
            (hip, r["hip"]),
            (along(hip, knee, 0.6), r["thigh"]),
            (knee, r["knee"]),
            (along(knee, ankle, 0.3), r["calf"]),
            (along(knee, ankle, 0.8), r["ankle"]),
            # The foot: one flat slab from the heel under the ankle joint to the toe box, cut flat at the ground
            ((ankle[0], 0.045, ankle[2]), (0.05, r["heel"])),
            ((ankle[0] * 1.03, 0.045, ankle[2] - r["foot"]), (0.05, r["toe"])),
        ])
        keep.append((Vector(t2b(ankle[0], 0.04, ankle[2] - r["foot"] * 0.5)), 0.16))
    return pts, edges, radii, keep


def _human_body_tint(body, key: str, colour_of) -> None:
    """
    The body's Tint: colour_of(co, weights) gives each vertex its colour from its place and its bone
    weights ({bone: weight}, the key's prefix stripped), times each plane's tone (_goblin_plane_tones).
    """
    names = {g.index: g.name[len(key) + 1 :] for g in body.vertex_groups}
    base = [colour_of(v.co, {names[g.group]: g.weight for g in v.groups}) for v in body.data.vertices]
    cols = []
    for p, tone in zip(body.data.polygons, _goblin_plane_tones(body)):
        for vi in p.vertices:
            cols += [c * tone for c in base[vi]] + [1.0]
    body.data.color_attributes.new("Tint", "FLOAT_COLOR", "CORNER").data.foreach_set("color", cols)


def _drape_weights(obj, key: str, weights) -> None:
    """A cloth weighted by rule: weights(co) gives each vertex {bone: weight}; they must sum to 1 on at most four bones."""
    groups = {}
    for v in obj.data.vertices:
        w = {b: x for b, x in weights(v.co).items() if x > 1e-6}
        if len(w) > 4 or abs(sum(w.values()) - 1.0) > 1e-6 or min(w.values()) < 0.0:
            raise ValueError(f"{obj.name}: vertex {v.index} weights {w} must be at most four, at least 0 and sum to 1")
        for b, x in w.items():
            if b not in groups:
                groups[b] = obj.vertex_groups.new(name=f"{key}_{b}")
            groups[b].add([v.index], x, "REPLACE")


def _open_front(obj, centre_z: float) -> None:
    """Deletes the faces of a shell whose centre lies in front of three-space z centre_z."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    front = [f for f in bm.faces if f.calc_center_median().y > -centre_z]
    bmesh.ops.delete(bm, geom=front, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()


def _build_human(key: str, j: dict, radii: dict, triangles: int, height: float, mats: dict, body_family: str, names: dict, kit, colour_of):
    """
    One human of the biped rig: kit(add, drape) builds every part but the body, through add(obj, bone,
    colour, planes) for a rigid part and drape(obj, colour, weights) for a cloth weighted by rule; then
    the body from what is left of the triangle budget, the rig named Monster_<key> with bones <key>_<Bone>,
    the weights, the tint (colour_of, _human_body_tint), a merge by family into the meshes names gives
    each family, and the paint. Refuses a figure over its budget or more than 5% from height.
    """
    import rigs  # the biped table

    hard, draped = [], []  # (object, bone), (object, weights)

    def add(obj, bone: str, colour, planes: bool = False):
        _goblin_tint(obj, colour, planes)
        hard.append((obj, f"{key}_{bone}"))

    def drape(obj, colour, weights):
        _goblin_tint(obj, colour, planes=True)
        draped.append((obj, weights))

    kit(add, drape)
    parts = [obj for obj, _ in hard + draped]
    body_tris = triangles - 40 - sum(len(p.vertices) - 2 for obj in parts for p in obj.data.polygons)
    pts, edges, rads, keep = _human_body_graph(j, radii)
    body = _goblin_skin(
        figkit.organic_body((pts, edges), rads, HUMAN_VOXEL, 10**9), f"{key}_body_skin", mats[body_family], body_tris, soften=14,
        keep=tuple(keep), crease=GOBLIN_CREASE, spread=GOBLIN_KIN_SPREAD,
    )
    rig = figkit.make_rig(f"Monster_{key}", rigs.BIPED_TABLE, {k: t2b(*p) for k, p in j.items()}, prefix=key)

    # Weight rule 1: the body takes automatic weights from the sixteen limb bones only. The hand mounts
    # hold rigid parts, and a Root standing from the ground to the hips would take the inner legs, so
    # the weighting rig leaves the mounts out and starts Root inside the pelvis.
    core = {k: t2b(*p) for k, p in j.items() if k not in ("WeaponPivot", "OffhandPivot")}
    core["Root"] = t2b(j["Hips"][0], j["Hips"][1] - 0.04, j["Hips"][2])
    weight_rig = figkit.make_rig(f"{key}_weight_rig", rigs.BIPED_TABLE, core, prefix=key)
    figkit.auto_weights(body, weight_rig, limb_radius=0.12)
    # Weight rule 2: Root deforms nothing; its share goes to Hips.
    figkit.fold_weights(
        body,
        {b.name: ([b.name, f"{key}_Root"] if b.name == f"{key}_Hips" else [b.name]) for b in weight_rig.data.bones if b.name != f"{key}_Root"},
    )
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    weight_data = weight_rig.data
    bpy.data.objects.remove(weight_rig, do_unlink=True)
    bpy.data.armatures.remove(weight_data)
    _human_body_tint(body, key, colour_of)

    # Weight rule 3: every other part is rigid on one bone, but the cloth, weighted by its own rule.
    for obj, bone in hard:
        figkit.hard_weights(obj, bone)
    for obj, weights in draped:
        _drape_weights(obj, key, weights)
    for obj in [body] + parts:
        obj.parent = rig

    merged = figkit.merge_by_family(rig)
    for ob in merged:
        ob.name = ob.data.name = names[figkit.get_material_family(ob)]
    _figure_paint(rig, merged, HUMAN_OCCLUSION)

    tris = sum(len(p.vertices) - 2 for ob in merged for p in ob.data.polygons)
    if tris > triangles:
        raise ValueError(f"{key}: {tris} triangles, over the budget of {triangles}")
    cos = [v.co for ob in merged for v in ob.data.vertices]
    size = [max(c[a] for c in cos) - min(c[a] for c in cos) for a in (0, 2, 1)]  # width, height, depth
    print(f"[Blender] {key}: {tris} triangles in {len(merged)} meshes; width {size[0]:.3f}, height {size[1]:.3f}, depth {size[2]:.3f}; lowest {min(c.z for c in cos):.4f}")
    if abs(size[1] / height - 1.0) > 0.05:
        raise ValueError(f"{key}: height {size[1]:.3f} is more than 5% from the shipped figure's {height}")
    return rig


def _human_mats(key: str, families: dict, glow) -> tuple[dict, dict]:
    """White materials of the figure's own, one a family (every colour is paint), and each family's tile mean ({} for no tile)."""
    mats = {fam: make_mat(name, 0xFFFFFF, roughness=rough, metallic=metal) for fam, (name, rough, metal) in families.items()}
    mats["glow"] = glow
    tiles = {"cloth": CLOTH_TILE, "leather": LEATHER_TILE, "wood": WOOD_TILE}
    means = {fam: _goblin_hide_mean(tiles[fam]) for fam in families if fam in tiles}
    return mats, means


def _human_paint(colours: dict, family_of: dict, means: dict) -> dict:
    """Each colour as the paint that shows it in the game: over the mean of its family's tile, or as it is with no tile."""
    return {k: (_goblin_skin_paint(c, means[family_of[k]]) if family_of[k] in means else c) for k, c in colours.items()}


# --- 5. Monster_dark_wizard ---------------------------------------------------------------------------------------
# A tall, stooped caster: the hat and the bell sleeves exaggerated (design 5.2), a pleated robe skirt
# that swings with the stride, a grey beard, the staff held out at the right side, away from the body,
# with an orb in its crook. The darker of the two humans (plan M3e: the ranger is clearly lighter).
WIZARD_TRIANGLES = 4400  # the builder's own budget, under the manifest's 5,000, as the goblin's
WIZARD_HEIGHT = 2.556  # the shipped wizard's height, hat included; the rebuilt one stays within 5%
WIZARD_COLOURS = {  # as the game shows them
    "robe": 0x40346A,  # indigo, 42% value
    "robe_dark": 0x2C2550,  # collar, sash and the hat's crown, 31%
    "trim": 0xB08A3A,  # gold hem, cuffs and hat band, 69%
    "skin": 0xB5A08A,  # pale face and hands, 71%
    "beard": 0x9C978D,  # grey, 61%
    "boot": 0x4A3A2E,  # 29%
    "staff": 0x6E5034,  # 43%
}
WIZARD_FAMILY = {"robe": "cloth", "robe_dark": "cloth", "trim": "cloth", "skin": "cloth", "boot": "cloth", "beard": "skin", "staff": "wood"}
WIZARD_RADII = {
    "pelvis": (0.17, 0.14), "waist": 0.14, "chest": (0.22, 0.16), "chest2": (0.24, 0.16), "neck": 0.062,
    "collar": (0.15, 0.11), "shoulder": 0.10, "upper": 0.09, "elbow": 0.085, "fore": 0.07, "wrist": 0.044, "hand": 0.06,
    "hip": 0.10, "thigh": 0.08, "knee": 0.066, "calf": 0.066, "ankle": 0.05, "heel": 0.055, "toe": 0.066, "foot": 0.17,
}


def wizard_joints() -> dict:
    """Joints of the biped rig, the stance: the neck stooped forward, the arms held out from the robe, each limb within 20 degrees of the biped reference."""
    j = {
        "Root": (0.0, 0.0, 0.0),
        "Hips": (0.0, 1.00, 0.03),
        "Torso": (0.0, 1.22, 0.01),
        "HeadGroup": (0.0, 1.76, -0.10),
    }
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        j[f"{tag}ArmPivot"] = (side * 0.26, 1.62, -0.04)
        j[f"{tag}ElbowPivot"] = (side * 0.42, 1.32, -0.08)
        j[f"{tag}Hand"] = (side * 0.60, 1.05, -0.15)
        j[f"{tag}LegPivot"] = (side * 0.12, 0.96, 0.03)
        j[f"{tag}KneePivot"] = (side * 0.17, 0.52, -0.01)
        j[f"{tag}Foot"] = (side * 0.18, 0.10, 0.03)
    j["WeaponPivot"] = j["RightHand"]
    return j


def _wizard_kit(j: dict, col: dict, mats: dict):
    robe, skin, wood, glow = mats["cloth"], mats["skin"], mats["wood"], mats["glow"]

    def aim(d) -> dict:
        d = Vector(d).normalized()
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    def kit(add, drape):
        # Head: a gaunt skull, a heavy brow and a long nose fused into one form with hard edges round its planes
        parts = [
            add_sphere("wiz_skull", None, skin, 0.13, 0.16, 0.15, tx=0.0, ty=1.90, tz=-0.13, segs=12, rings=10),
            add_curved_tube("wiz_brow", None, skin, [(-0.11, 1.955, -0.24, 0.03), (0.0, 1.945, -0.285, 0.036), (0.11, 1.955, -0.24, 0.03)], segs=6),
            add_cone_spike("wiz_nose", None, skin, base_r=0.042, length=0.15, tx=0.0, ty=1.905, tz=-0.265, rx=-math.pi * 0.58, curve_bend=-0.03, segs=8, flatten_x=0.8),
        ]
        add(_goblin_fuse(parts, "wiz_head", skin, 0.012, 560, soften=3, crease=GOBLIN_CREASE), "HeadGroup", col["skin_face"], planes=True)
        # The beard, a long faceted wedge from the chin onto the chest; two violet glints under the brow
        # (no mesh name holds 'eye': the engine would draw the whole mesh unlit)
        add(add_cone_spike("wiz_beard", None, skin, base_r=0.10, length=0.40, tx=0.0, ty=1.82, tz=-0.23, segs=6, flatten_x=1.25, smooth=False, **aim((0.0, -1.0, -0.22))), "HeadGroup", col["beard"], planes=True)
        for side, tag in ((-1.0, "L"), (1.0, "R")):
            add(add_sphere(f"wiz_glint_{tag}", None, glow, 0.03, 0.022, 0.02, tx=side * 0.055, ty=1.915, tz=-0.262, segs=6, rings=4), "HeadGroup", 0xFFFFFF)

        # The hat, the one feature that names the wizard with the sleeves (design 5.2): a wide faceted brim
        # and a tall crown that bends back and droops at its tip, a gold band at its foot
        add(add_lathe("wiz_hat_brim", None, robe, [(2.00, 0.48, 0.46), (2.025, 0.45, 0.43), (2.05, 0.20, 0.19)], segs=10, tz=-0.12, smooth=False), "HeadGroup", col["robe"], planes=True)
        crown = [(0.0, 2.03, -0.12, 0.19), (0.0, 2.20, -0.08, 0.15), (0.0, 2.34, -0.01, 0.10), (0.03, 2.44, 0.09, 0.06), (0.07, 2.49, 0.21, 0.035), (0.10, 2.47, 0.31, 0.022)]
        add(add_curved_tube("wiz_hat_crown", None, robe, crown, segs=8, smooth=False), "HeadGroup", col["robe_dark"], planes=True)
        add(add_lathe("wiz_hat_band", None, robe, [(2.04, 0.196, 0.196), (2.10, 0.18, 0.18)], segs=8, tz=-0.12, cap_ends=False, smooth=False), "HeadGroup", col["trim"], planes=True)

        # A high collar standing up behind the head, open in front, on the chest
        collar = add_lathe("wiz_collar", None, robe, [(1.58, 0.17, 0.15), (1.72, 0.20, 0.17), (1.86, 0.26, 0.21)], segs=10, tz=-0.03, cap_ends=False, smooth=False)
        _open_front(collar, -0.08)
        add(collar, "Torso", col["robe_dark"], planes=True)

        # Bell sleeves on the forearms, flaring past the wrist with a gold cuff; the hand comes out of the mouth
        for tag in ("Left", "Right"):
            e, h = Vector(j[f"{tag}ElbowPivot"]), Vector(j[f"{tag}Hand"])
            d = (h - e).normalized()
            start, mouth = e - d * 0.03, h - d * 0.05
            add(add_limb_tube(f"wiz_sleeve_{tag[0]}", None, robe, tuple(start), tuple(mouth), 0.092, 0.19, r_mid=0.13, segs=8, steps=3, smooth=False), f"{tag}ElbowPivot", col["robe"], planes=True)
            add(add_limb_tube(f"wiz_cuff_{tag[0]}", None, robe, tuple(mouth - d * 0.045), tuple(mouth + d * 0.005), 0.198, 0.198, r_mid=0.198, segs=8, steps=2, smooth=False), f"{tag}ElbowPivot", col["trim"])

        # The sash over the seam of body and skirt, on the hips
        add(add_lathe("wiz_sash", None, robe, [(1.00, 0.215, 0.19, 0.0, 0.03), (1.13, 0.20, 0.175, 0.0, 0.02)], segs=12, cap_ends=False, smooth=False), "Hips", col["robe_dark"], planes=True)

        # The robe skirt, pleated: every other column stands out, and its hem stops above the ankle so the
        # boots show. Weighted by rule, between Hips and the thighs: at the waist all Hips, toward the hem up
        # to SKIRT_LEG_SHARE on the thighs, split between them by the side the vertex is on
        top, hem, segs = 1.06, 0.20, 14
        sections = [(1.06, 0.20, 0.17, 0.0, 0.03), (0.86, 0.25, 0.21, 0.0, 0.03), (0.60, 0.31, 0.27, 0.0, 0.035), (0.36, 0.37, 0.32, 0.0, 0.04), (hem, 0.41, 0.36, 0.0, 0.05)]
        skirt = add_lathe("wiz_skirt", None, robe, sections, segs=segs, cap_ends=False, smooth=False)
        for v in skirt.data.vertices:
            if v.index % 2 and v.index >= segs:  # every other column, below the waist ring
                cz = -sections[v.index // segs][4]  # the ring's centre, Blender y
                v.co.x *= 1.08
                v.co.y = cz + (v.co.y - cz) * 1.08
        trim = add_lathe("wiz_hem", None, robe, [(hem - 0.005, 0.445, 0.39, 0.0, 0.05), (hem + 0.07, 0.425, 0.37, 0.0, 0.048)], segs=segs, cap_ends=False, smooth=False)

        def skirt_weights(co):
            t = min(max((top - co.z) / (top - hem), 0.0), 1.0)
            s = SKIRT_LEG_SHARE * t**1.5
            right = min(max(0.5 + co.x / 0.40, 0.0), 1.0)
            return {"Hips": 1.0 - s, "LeftLegPivot": s * (1.0 - right), "RightLegPivot": s * right}

        drape(skirt, col["robe"], skirt_weights)
        drape(trim, col["trim"], skirt_weights)

        # The staff in the right hand, held out at the side and away from the robe: foot on the ground,
        # gnarled, leaning out, a three-pronged crook at the top with the orb in it
        hand = Vector(j["RightHand"])
        d = Vector((-0.03, 1.0, -0.04)).normalized()
        foot, head = hand - d * 1.04, hand + d * 1.02
        wobble = [(0.0, 0.0), (0.015, -0.01), (-0.012, 0.012), (0.012, 0.0), (-0.01, -0.012), (0.0, 0.0)]
        shaft = [(*(foot.lerp(head, k / 5) + Vector((dx, 0.0, dz))), 0.034 - 0.004 * k / 5) for k, (dx, dz) in enumerate(wobble)]
        add(add_curved_tube("wiz_staff", None, wood, shaft, segs=6, smooth=False), "WeaponPivot", col["staff"], planes=True)
        orb = head + d * 0.13
        for k in range(3):
            a = k * 2.0 * math.pi / 3.0 + 0.4
            out = Vector((math.cos(a), 0.0, math.sin(a)))
            add(add_cone_spike(f"wiz_prong_{k}", None, wood, base_r=0.03, length=0.24, tx=head.x, ty=head.y, tz=head.z, segs=5, smooth=False, **aim(d + out * 0.75)), "WeaponPivot", col["staff"], planes=True)
        add(add_sphere("wiz_orb", None, glow, 0.10, tx=orb.x, ty=orb.y, tz=orb.z, segs=8, rings=6, smooth=False), "WeaponPivot", 0xFFFFFF)

    return kit


def _wizard_colour(col: dict):
    def colour_of(co, w):
        """Robe on the trunk and arms, pale hands, boots under the hem."""
        if w.get("LeftHand", 0.0) + w.get("RightHand", 0.0) >= 0.5:
            return col["skin"]
        if co.z < 0.30:
            return col["boot"]
        return col["robe"]

    return colour_of


def build_dark_wizard(grid_pos: tuple[float, float, float], mats: dict):
    # grid_pos is not used: a skinned figure stands at the file's origin (design 6.1.1 rule 2b)
    own, means = _human_mats(
        "dark_wizard",
        {"cloth": ("mat_robe_dark_wizard_paint", 0.68, 0.04), "skin": ("mat_skin_dark_wizard_paint", 0.55, 0.04), "wood": ("mat_wood_dark_wizard_paint", 0.72, 0.02)},
        mats["glow_purple"],
    )
    col = _human_paint(WIZARD_COLOURS, WIZARD_FAMILY, means)
    col["skin_face"] = WIZARD_COLOURS["skin"]  # the face is on the plain skin material, the hands on the robe's
    names = {"cloth": "dark_wizard_robe", "skin": "dark_wizard_face", "wood": "dark_wizard_staff", "glow": "dark_wizard_glow"}
    j = wizard_joints()
    return _build_human("dark_wizard", j, WIZARD_RADII, WIZARD_TRIANGLES, WIZARD_HEIGHT, own, "cloth", names, _wizard_kit(j, col, own), _wizard_colour(col))


# --- 5b. Kit_cinder_adept: the Cinder Adept's kit on the wizard (Stage 6 plan MK1, design 7.5) -------------------
# The wizard plus rigid pieces of its own, each one mesh named cinder_adept_<Bone> after the wizard bone it
# rides on, as K1's and K2's: a fitted hood (HeadGroup) round the skull, worn under the wizard's hat, ash
# grey outside and lined with ember at its mouth, which is open on the face, the glints and the beard; a brazier on
# the staff head (WeaponPivot) whose iron bowl swallows the wizard's prongs and purple orb, with four tines
# and an ember-lit rim; the fire standing in it (RightHand, which no clip turns against WeaponPivot: same
# joint, one glow material a piece); and an ember held over the open left hand (LeftHand). The hood is
# painted on the wizard's robe material (over the cloth tile's mean), the iron and the rim on its wood
# material (over the wood tile's mean), as _human_paint does, and the fire on the file's mat_glow_orange,
# so the kit adds no material.
CINDER_KIT_TRIANGLES = 1200
CINDER_COLOURS = {  # as the game shows them before Stage 6's tint
    "iron": 0x4A423C,  # the bowl and tines, a charred iron: 27% luma, 29% value
    "ember": 0xBC5C28,  # the rim's ember band and the hood's lining: 45% luma, 74% value (design 5.4's top of 75%)
    "ash": 0x5E5852,  # the hood outside, ash grey: 35% luma, 37% value
}
CINDER_CLOTH = ("ash", "ember")  # painted on the robe material, over the cloth tile's mean; the rest over the wood tile's


def build_cinder_adept_kit():
    """
    The Cinder Adept's kit (plan MK1): Kit_cinder_adept at the origin with the children
    cinder_adept_HeadGroup, _WeaponPivot, _RightHand and _LeftHand (_kit_root). Built after
    build_dark_wizard, on its robe and wood materials.
    """
    robe = bpy.data.materials["mat_robe_dark_wizard_paint"]  # build_dark_wizard's
    wood = bpy.data.materials["mat_wood_dark_wizard_paint"]
    glow = bpy.data.materials["mat_glow_orange"]  # build_materials'
    col = {k: _goblin_skin_paint(c, _goblin_hide_mean(WOOD_TILE)) for k, c in CINDER_COLOURS.items()}
    cloth = {k: _goblin_skin_paint(CINDER_COLOURS[k], _goblin_hide_mean(CLOTH_TILE)) for k in CINDER_CLOTH}
    j = wizard_joints()
    parts = {"HeadGroup": [], "WeaponPivot": [], "RightHand": [], "LeftHand": []}

    def add(obj, bone: str, colour, planes: bool = True):
        _goblin_tint(obj, colour, planes)
        parts[bone].append(obj)

    def aim(d) -> dict:
        d = Vector(d).normalized()
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    def spike(name: str, mat, r: float, length: float, at, d):
        """A four-sided spike of base radius r along d from at (K2's thorn)."""
        return add_lathe(name, None, mat, [(0.0, r, r), (length * 0.5, r * 0.55, r * 0.55), (length, 0.004, 0.004)],
                         segs=4, tx=at.x, ty=at.y, tz=at.z, smooth=False, **aim(d))

    # The hood: a fitted cowl worn under the wizard's hat. It wraps the skull (radii 0.13, 0.16, 0.15 round
    # (0, 1.90, -0.13)) a few centimetres out, stands clear of the high collar behind the head (top ring 0.26
    # by 0.21 at y 1.86) and falls in a short mantle over the shoulder balls (±0.36 at y 1.62). Its open top
    # ring stops at y 1.995, under the hat's brim (y 2.00 to 2.05, 0.48 across), so the brim covers it and the
    # hat sits on the hood. The mouth is cut where the face and beard are: faces with three z < -0.28 (the three front columns) between
    # the hem and y 1.97; the band from 1.97 to 1.995 stays whole as a brow under the brim. A shell 0.03
    # thick (solidify, rims filled): ash grey outside, ember only on the inner faces of the front half, which
    # the mouth shows
    sections = [(1.56, 0.41, 0.33, 0.0, -0.02), (1.68, 0.39, 0.32, 0.0, -0.03), (1.80, 0.31, 0.30, 0.0, -0.06),
                (1.90, 0.26, 0.27, 0.0, -0.09), (1.97, 0.20, 0.22, 0.0, -0.11), (1.995, 0.185, 0.21, 0.0, -0.12)]
    hood = add_lathe("cad_hood", None, robe, sections, segs=14, cap_ends=False, smooth=False)
    bm = bmesh.new()
    bm.from_mesh(hood.data)
    mouth = [f for f in bm.faces if f.calc_center_median().y > 0.28 and f.calc_center_median().z < 1.97]  # three z < -0.28: the three front columns
    bmesh.ops.delete(bm, geom=mouth, context="FACES")
    bm.to_mesh(hood.data)
    bm.free()
    solid = hood.modifiers.new("shell", "SOLIDIFY")
    solid.thickness, solid.offset, solid.use_rim = 0.03, -1.0, True
    bpy.context.view_layer.objects.active = hood
    bpy.ops.object.modifier_apply(modifier=solid.name)
    _goblin_tint(hood, cloth["ash"], planes=True)
    tint = hood.data.color_attributes["Tint"].data
    lining = [*cloth["ember"], 1.0]
    for poly in hood.data.polygons:
        c = Vector(poly.center)
        inward = Vector((-c.x, 0.08 - c.y, 0.0))  # toward the hood's axis at three z -0.08 (Blender y is -three z)
        if c.y > 0.05 and poly.normal.dot(inward) > 0.0:  # the front half only (three z < -0.05)
            for li in poly.loop_indices:
                tint[li].color = lining
    parts["HeadGroup"].append(hood)

    # The staff's axis and head as _wizard_kit builds them; the bowl starts just under the head, so the
    # prongs (0.24 long, 0.6 out) and the orb (radius 0.10, 0.13 up) stand inside it
    hand = Vector(j["RightHand"])
    d = Vector((-0.03, 1.0, -0.04)).normalized()
    base = hand + d * 0.97
    side = d.cross(Vector((0.0, 0.0, 1.0))).normalized()
    fwd = side.cross(d).normalized()
    bowl = [(0.0, 0.045, 0.045), (0.07, 0.10, 0.10), (0.16, 0.22, 0.22), (0.28, 0.245, 0.245), (0.32, 0.265, 0.265), (0.345, 0.25, 0.25)]
    add(add_lathe("cad_bowl", None, wood, bowl, segs=8, tx=base.x, ty=base.y, tz=base.z, smooth=False, **aim(d)), "WeaponPivot", col["iron"])
    add(add_lathe("cad_rim", None, wood, [(0.29, 0.272, 0.272), (0.335, 0.278, 0.278)], segs=8, tx=base.x, ty=base.y, tz=base.z, cap_ends=False, smooth=False, **aim(d)),
        "WeaponPivot", col["ember"], planes=False)
    for k in range(4):
        a = math.pi * (0.25 + 0.5 * k)
        out = side * math.cos(a) + fwd * math.sin(a)
        add(spike(f"cad_tine_{k}", wood, 0.03, 0.24, base + d * 0.30 + out * 0.25, d + out * 0.45), "WeaponPivot", col["iron"])

    # The fire: one tall faceted flame out of the bowl and six tongues round it, leaning out, so the staff
    # ends in a flame higher than the hat's tip
    top = base + d * 0.31
    flame = [(0.0, 0.20, 0.20), (0.12, 0.17, 0.16), (0.26, 0.11, 0.10), (0.40, 0.05, 0.045), (0.52, 0.004, 0.004)]
    add(add_lathe("cad_flame", None, glow, flame, segs=6, tx=top.x, ty=top.y, tz=top.z, smooth=False, **aim(d + side * 0.06)), "RightHand", 0xFFFFFF, planes=False)
    for k in range(6):
        a = math.pi * k / 3.0 + 0.3
        out = side * math.cos(a) + fwd * math.sin(a)
        add(spike(f"cad_tongue_{k}", glow, 0.07, 0.30 if k % 2 else 0.22, top + out * 0.13, d + out * 0.35 + side * 0.15),
            "RightHand", 0xFFFFFF, planes=False)

    # The ember over the open left hand: a faceted coal with three tongues, held a little out and forward
    lh = Vector(j["LeftHand"]) + Vector((-0.03, 0.15, -0.06))
    add(add_sphere("cad_coal", None, glow, 0.085, 0.08, 0.085, tx=lh.x, ty=lh.y, tz=lh.z, segs=6, rings=4, smooth=False), "LeftHand", 0xFFFFFF, planes=False)
    for k in range(3):
        a = 2.0 * math.pi * k / 3.0
        out = Vector((math.cos(a), 0.0, math.sin(a)))
        add(spike(f"cad_lick_{k}", glow, 0.045, 0.20 if k == 0 else 0.14, lh + out * 0.04 + Vector((0.0, 0.04, 0.0)), Vector((0.0, 1.0, 0.0)) + out * 0.3),
            "LeftHand", 0xFFFFFF, planes=False)
    return _kit_root("cinder_adept", parts, j, CINDER_KIT_TRIANGLES)


# --- 6. Monster_dark_ranger ---------------------------------------------------------------------------------------
# A lean hunter: a cloak that falls from the shoulders to a wide hem behind, a triangle outline from
# every side; a peaked hood with a mask under its shadow; the bow held out on the left hand, a quiver at
# the right hip and one pauldron on the bow shoulder. Clearly lighter than the wizard (plan M3e).
RANGER_TRIANGLES = 4400  # the builder's own budget, under the manifest's 5,000
RANGER_HEIGHT = 2.220  # the shipped ranger's height, hood included; the rebuilt one stays within 5%
RANGER_COLOURS = {  # as the game shows them
    "tunic": 0x6F7B4D,  # dragonhide green, 48% value
    "trousers": 0x555D3D,  # 36%
    "dark": 0x5C4733,  # gloves, boots, belt, bracer, tassets, quiver and pauldron leather, 36%
    "cloak": 0x5F6B47,  # grey green, 42% value; luminance 39% against the wizard robe's 23%
    "face": 0x8A7460,  # the shadowed face round the eyes, 54%
    "mask": 0x4A443C,  # 29%
    "bow": 0x8A6440,  # 54%
    "string": 0xB4A482,  # as light as the wood tile lets a paint go
    "fletch": 0xB0A07E,
}
RANGER_FAMILY = {"tunic": "leather", "trousers": "leather", "dark": "leather", "face": "leather", "mask": "leather", "cloak": "cloth", "bow": "wood", "string": "wood", "fletch": "wood"}
RANGER_RADII = {
    "pelvis": (0.16, 0.13), "waist": 0.14, "chest": (0.23, 0.16), "chest2": (0.25, 0.17), "neck": 0.065,
    "collar": (0.15, 0.11), "shoulder": 0.095, "upper": 0.076, "elbow": 0.07, "fore": 0.068, "wrist": 0.046, "hand": 0.062,
    "hip": 0.105, "thigh": 0.095, "knee": 0.078, "calf": 0.08, "ankle": 0.055, "heel": 0.06, "toe": 0.072, "foot": 0.18,
}


def ranger_joints() -> dict:
    """Joints of the biped rig, the stance: a slight forward lean, the arms out from the cloak, each limb within 20 degrees of the biped reference."""
    j = {
        "Root": (0.0, 0.0, 0.0),
        "Hips": (0.0, 0.98, 0.03),
        "Torso": (0.0, 1.18, 0.0),
        "HeadGroup": (0.0, 1.72, -0.10),
    }
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        j[f"{tag}ArmPivot"] = (side * 0.25, 1.56, -0.04)
        j[f"{tag}ElbowPivot"] = (side * 0.41, 1.28, -0.09)
        j[f"{tag}Hand"] = (side * 0.57, 1.02, -0.16)
        j[f"{tag}LegPivot"] = (side * 0.12, 0.95, 0.03)
        j[f"{tag}KneePivot"] = (side * 0.17, 0.52, -0.03)
        j[f"{tag}Foot"] = (side * 0.18, 0.10, 0.03)
    j["OffhandPivot"] = j["LeftHand"]
    return j


def _ranger_kit(j: dict, col: dict, mats: dict):
    leather, cloth, wood, glow = mats["leather"], mats["cloth"], mats["wood"], mats["glow"]

    def aim(d) -> dict:
        d = Vector(d).normalized()
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    def kit(add, drape):
        # Head in the hood's shadow: a faceted skull, a mask over the lower face, two emerald glints
        add(add_sphere("rng_skull", None, leather, 0.125, 0.15, 0.14, tx=0.0, ty=1.86, tz=-0.13, segs=8, rings=6, smooth=False), "HeadGroup", col["face"], planes=True)
        add(add_box("rng_mask", None, leather, 0.23, 0.12, 0.11, tx=0.0, ty=1.78, tz=-0.22, rx=0.15, bevel=0.0), "HeadGroup", col["mask"], planes=True)
        for side, tag in ((-1.0, "L"), (1.0, "R")):
            add(add_sphere(f"rng_glint_{tag}", None, glow, 0.03, 0.022, 0.02, tx=side * 0.05, ty=1.885, tz=-0.262, segs=6, rings=4), "HeadGroup", 0xFFFFFF)
        # The hood: a faceted shell open in front of the face, hanging to the shoulders, its peak swept up and back
        c = Vector((0.0, 1.87, -0.11))
        hood = add_sphere("rng_hood", None, cloth, 0.185, 0.215, 0.20, tx=c.x, ty=c.y, tz=c.z, segs=10, rings=8, smooth=False)
        bm = bmesh.new()
        bm.from_mesh(hood.data)
        cb = Vector(t2b(*c))
        opening = [f for f in bm.faces if f.calc_center_median().y > cb.y + 0.03 and f.calc_center_median().z < 1.98]
        bmesh.ops.delete(bm, geom=opening, context="FACES")
        bm.to_mesh(hood.data)
        bm.free()
        add(hood, "HeadGroup", col["cloak"], planes=True)
        add(add_cone_spike("rng_hood_peak", None, cloth, base_r=0.11, length=0.30, tx=0.0, ty=2.00, tz=-0.02, segs=6, smooth=False, **aim((0.0, 0.62, 0.78))), "HeadGroup", col["cloak"], planes=True)

        # Leather tassets, a flap front and back below the belt, on the hips (never on the legs)
        for name, tz, rx in (("rng_tunic_front", -0.15, -0.12), ("rng_tunic_back", 0.17, 0.12)):
            flap = add_box(name, None, leather, 0.26, 0.30, 0.05, tx=0.0, ty=0.78, tz=tz, rx=rx, bevel=0.0)
            heights = [v.co.z for v in flap.data.vertices]
            for v in flap.data.vertices:
                v.co.x *= 0.75 + 0.25 * (v.co.z - min(heights)) / (max(heights) - min(heights))
            add(flap, "Hips", col["dark"], planes=True)

        # One pauldron, on the bow shoulder (design 5.3: asymmetry in one place), and a bracer on the bow arm
        s = Vector(j["LeftArmPivot"])
        add(add_sphere("rng_pauldron", None, leather, 0.15, 0.09, 0.14, tx=s.x - 0.03, ty=s.y + 0.03, tz=s.z, rz=0.35, segs=6, rings=5, smooth=False), "LeftArmPivot", col["dark"], planes=True)
        e, h = Vector(j["LeftElbowPivot"]), Vector(j["LeftHand"])
        add(add_limb_tube("rng_bracer", None, leather, tuple(e.lerp(h, 0.30)), tuple(e.lerp(h, 0.78)), 0.086, 0.074, r_mid=0.082, segs=8, steps=3, smooth=False), "LeftElbowPivot", col["dark"], planes=True)

        # The quiver at the right hip, standing out and back, with four fletchings out of its mouth
        lo, hi = Vector((0.27, 0.66, 0.06)), Vector((0.35, 1.16, 0.12))
        q = (hi - lo).normalized()
        add(add_limb_tube("rng_quiver", None, leather, tuple(lo), tuple(hi), 0.07, 0.082, r_mid=0.078, segs=8, steps=3, smooth=False), "Hips", col["dark"], planes=True)
        for k, (dx, dz) in enumerate(((-0.03, -0.02), (0.03, -0.022), (-0.02, 0.028), (0.032, 0.022))):
            at = hi + q * 0.01 + Vector((dx, 0.0, dz))
            fd = (q + Vector((dx, 0.0, dz)) * 4.0).normalized()
            add(add_cone_spike(f"rng_fletch_{k}", None, wood, base_r=0.034, length=0.15, tx=at.x, ty=at.y, tz=at.z, segs=4, flatten_x=0.7, smooth=False, **aim(fd)), "Hips", col["fletch"])

        # The bow in the left hand, held out at the side and upright: a recurve whose grip in the fist is its
        # most forward point, the string tip to tip behind it, nothing thinner than 0.044 (design 5.3)
        h = Vector(j["LeftHand"]) + Vector((-0.035, 0.0, 0.0))
        arc = [(0.015, 0.80, 0.14, 0.022), (0.0, 0.72, 0.19, 0.024), (-0.012, 0.52, 0.09, 0.03), (-0.012, 0.26, 0.016, 0.034), (0.0, 0.0, 0.0, 0.038),
               (-0.012, -0.26, 0.016, 0.034), (-0.012, -0.47, 0.09, 0.03), (0.0, -0.60, 0.18, 0.024), (0.015, -0.66, 0.13, 0.022)]
        add(add_curved_tube("rng_bow", None, wood, [(h.x + x, h.y + y, h.z + z, r) for x, y, z, r in arc], segs=6, smooth=False), "OffhandPivot", col["bow"], planes=True)
        add(add_limb_tube("rng_string", None, wood, (h.x, h.y + 0.72, h.z + 0.19), (h.x, h.y - 0.60, h.z + 0.18), 0.022, 0.022, r_mid=0.022, segs=4, steps=2), "OffhandPivot", col["string"])

        # The cloak: a faceted shell behind the figure from the back of the shoulders to a wide hem, open in
        # front, so from the front, the side and behind it makes a triangle. Weighted by rule between Torso
        # and Hips: all Torso at the shoulders, all Hips at the hem
        shoulder, hem = 1.64, 0.32
        sections = [(shoulder, 0.20, 0.12, 0.0, 0.07), (1.50, 0.29, 0.17, 0.0, 0.10), (1.10, 0.39, 0.26, 0.0, 0.14), (0.70, 0.47, 0.32, 0.0, 0.17), (hem, 0.53, 0.37, 0.0, 0.19)]
        cloak = add_lathe("rng_cloak", None, cloth, sections, segs=16, cap_ends=False, smooth=False)
        bm = bmesh.new()
        bm.from_mesh(cloak.data)
        # Blender y is three-space -z: a face whose centre is in front of its ring's centre goes
        front = [f for f in bm.faces if f.calc_center_median().y > -0.10 - 0.07 * (shoulder - f.calc_center_median().z) / (shoulder - hem)]
        bmesh.ops.delete(bm, geom=front, context="FACES")
        bm.to_mesh(cloak.data)
        bm.free()
        drape(cloak, col["cloak"], lambda co: (lambda t: {"Torso": t, "Hips": 1.0 - t})(min(max((co.z - hem) / (shoulder - hem), 0.0), 1.0)))

    return kit


def _ranger_colour(col: dict):
    def colour_of(co, w):
        """Tunic on the trunk and arms, gloves, a belt, trousers on the legs and boots below the knee."""
        if w.get("LeftHand", 0.0) + w.get("RightHand", 0.0) >= 0.5 or co.z < 0.40:
            return col["dark"]
        if 0.90 < co.z < 0.99:
            return col["dark"]  # the belt
        legs = sum(w.get(b, 0.0) for b in ("LeftLegPivot", "RightLegPivot", "LeftKneePivot", "RightKneePivot", "LeftFoot", "RightFoot"))
        return col["trousers"] if legs >= 0.5 else col["tunic"]

    return colour_of


def build_dark_ranger(grid_pos: tuple[float, float, float], mats: dict):
    # grid_pos is not used: a skinned figure stands at the file's origin (design 6.1.1 rule 2b)
    own, means = _human_mats(
        "dark_ranger",
        {"leather": ("mat_leather_dark_ranger_paint", 0.62, 0.06), "cloth": ("mat_cloth_dark_ranger_paint", 0.72, 0.02), "wood": ("mat_wood_dark_ranger_paint", 0.70, 0.02)},
        mats["glow_emerald"],
    )
    col = _human_paint(RANGER_COLOURS, RANGER_FAMILY, means)
    names = {"leather": "dark_ranger_body", "cloth": "dark_ranger_cloak", "wood": "dark_ranger_wood", "glow": "dark_ranger_glow"}
    j = ranger_joints()
    return _build_human("dark_ranger", j, RANGER_RADII, RANGER_TRIANGLES, RANGER_HEIGHT, own, "leather", names, _ranger_kit(j, col, own), _ranger_colour(col))


# --- 6b. Kit_thornwatch_marksman: the Thornwatch Marksman's kit on the ranger (plan K2, design 5.6) ---------------
# The ranger plus three rigid pieces of its own, each one mesh named thornwatch_marksman_<Bone> after the
# ranger bone it rides on, as K1's: a wreath of thorns round the hood (HeadGroup), a tall bramble quiver on the back over the right
# shoulder (Torso; the bare name Hips is K1's, and the ranger's own hip quiver cannot be hidden, so this
# one is a second, on the back), and a longbow (OffhandPivot) that swallows the ranger's recurve: its arc
# runs along the recurve's, fatter, and its limbs reach past both tips, with a fatter string on the
# recurve string's own line. Painted on the ranger's own wood material (each colour over the wood tile's
# mean, as _human_paint does), so the kit adds no material; Stage 4's tint multiplies it.
THORNWATCH_KIT_TRIANGLES = 1200
THORNWATCH_COLOURS = {  # as the game shows them before Stage 4's tint
    "bramble": 0x9A8A68,  # the vines and the quiver's weave, weathered pale: 32% luma under Stage 4's tint, over the cloak's 23%
    "thorn": 0xB4A482,  # thorn points, as light as the wood tile lets a paint go: 38% under the tint, 15 points over the cloak
    "bow": 0x6E4C30,  # darker than the ranger's 0x8A6440, 18% under the tint (design 5.4's floor)
    "string": 0xB4A482,
    "fletch": 0xB0A07E,
}


def build_thornwatch_marksman_kit():
    """
    The Thornwatch Marksman's kit (plan K2): Kit_thornwatch_marksman at the origin with the children
    HeadGroup, Torso and OffhandPivot (_kit_root). Built after build_dark_ranger, on its wood material.
    """
    wood = bpy.data.materials["mat_wood_dark_ranger_paint"]  # build_dark_ranger's
    col = {k: _goblin_skin_paint(c, _goblin_hide_mean(WOOD_TILE)) for k, c in THORNWATCH_COLOURS.items()}
    j = ranger_joints()
    parts = {"HeadGroup": [], "Torso": [], "OffhandPivot": []}

    def add(obj, bone: str, colour: str, planes: bool = True):
        _goblin_tint(obj, col[colour], planes)
        parts[bone].append(obj)

    def aim(d) -> dict:
        d = Vector(d).normalized()
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    def spike(name: str, r: float, length: float, at, d):
        """A four-sided spike of base radius r along d from at: three rings, a cheaper cone than add_cone_spike's seven."""
        return add_lathe(name, None, wood, [(0.0, r, r), (length * 0.5, r * 0.55, r * 0.55), (length, 0.004, 0.004)],
                         segs=4, tx=at.x, ty=at.y, tz=at.z, smooth=False, **aim(d))

    def thorn(at, d, length: float, bone: str):
        add(spike("tmk_thorn", 0.03, length, at, d), bone, "thorn")

    # The wreath: a bramble ring round the hood, higher at the brow than behind, and eleven thorns standing
    # out of it, up and out, long and short in turn, so the head's outline is a crown of spikes
    c, rx, rz = Vector((0.0, 1.95, -0.10)), 0.205, 0.215
    ring = []
    for k in range(13):
        a = 2.0 * math.pi * k / 12
        ring.append((c.x + rx * math.sin(a), c.y + 0.05 * math.cos(a), c.z - rz * math.cos(a), 0.03))
    add(add_curved_tube("tmk_wreath", None, wood, ring, segs=5, smooth=False), "HeadGroup", "bramble")
    for k in range(11):
        a = 2.0 * math.pi * (k + 0.5) / 11
        out = Vector((math.sin(a), 0.0, -math.cos(a)))
        at = Vector((c.x + rx * out.x, c.y + 0.05 * math.cos(a), c.z + rz * out.z))
        thorn(at, out + Vector((0.0, 0.9, 0.0)), 0.20 if k % 2 else 0.13, "HeadGroup")

    # The quiver: tall, on the back from the left hip to over the right shoulder, clear of the cloak; a
    # bramble vine wound round it with thorns, and five fletched arrows out of its mouth
    lo, hi = Vector((-0.14, 0.95, 0.54)), Vector((0.26, 2.05, 0.30))
    q = (hi - lo).normalized()
    side = q.cross(Vector((0.0, 0.0, 1.0))).normalized()
    back = side.cross(q).normalized()
    add(add_limb_tube("tmk_quiver", None, wood, tuple(lo), tuple(hi), 0.085, 0.10, r_mid=0.09, segs=7, steps=3, smooth=False), "Torso", "bramble")
    vine = []
    for k in range(15):
        t, a = 0.06 + 0.88 * k / 14, 4.0 * math.pi * k / 14
        p = lo.lerp(hi, t) + (side * math.cos(a) + back * math.sin(a)) * (0.10 + 0.015 * t)
        vine.append((p.x, p.y, p.z, 0.024))
        if k % 3 == 1:
            thorn(p, side * math.cos(a) + back * math.sin(a), 0.11, "Torso")
    add(add_curved_tube("tmk_quiver_vine", None, wood, vine, segs=4, smooth=False), "Torso", "bramble")
    for k, (ds, db) in enumerate(((-0.04, -0.02), (0.035, -0.03), (0.0, 0.035), (-0.045, 0.03), (0.045, 0.02))):
        at = hi + q * 0.02 + side * ds + back * db
        add(spike(f"tmk_fletch_{k}", 0.04, 0.20, at, q + (side * ds + back * db) * 4.0), "Torso", "fletch")

    # The longbow: the ranger's recurve arc (rng_bow, the same points) 0.014 fatter, its limbs carried on past
    # each recurve tip, bulging forward and back to a nock on the recurve string's line, 0.40 higher and 0.26
    # lower; the string along that line, fatter, from nock to nock. The low tip stays 0.1 off the ground
    h = Vector(j["LeftHand"]) + Vector((-0.035, 0.0, 0.0))
    string_z = lambda y: 0.18 + (y + 0.60) * 0.01 / 1.32  # the recurve string runs (0.72, 0.19) to (-0.60, 0.18)
    arc = [(0.015, 1.16, 0.15, 0.03), (0.0, 1.10, string_z(1.10), 0.034), (0.008, 1.02, 0.15, 0.036), (0.02, 0.92, 0.12, 0.036), (0.02, 0.82, 0.13, 0.036),
           (0.0, 0.72, 0.19, 0.038), (-0.012, 0.52, 0.09, 0.044), (-0.012, 0.26, 0.016, 0.048), (0.0, 0.0, 0.0, 0.052),
           (-0.012, -0.26, 0.016, 0.048), (-0.012, -0.47, 0.09, 0.044), (0.0, -0.60, 0.18, 0.038), (0.02, -0.70, 0.12, 0.036),
           (0.012, -0.80, 0.14, 0.034), (0.0, -0.86, string_z(-0.86), 0.034), (0.015, -0.90, 0.15, 0.03)]
    add(add_curved_tube("tmk_bow", None, wood, [(h.x + x, h.y + y, h.z + z, r) for x, y, z, r in arc], segs=6, smooth=False), "OffhandPivot", "bow")
    add(add_limb_tube("tmk_string", None, wood, (h.x, h.y + 1.10, h.z + string_z(1.10)), (h.x, h.y - 0.86, h.z + string_z(-0.86)), 0.025, 0.025, r_mid=0.025, segs=4, steps=2), "OffhandPivot", "string", planes=False)
    return _kit_root("thornwatch_marksman", parts, j, THORNWATCH_KIT_TRIANGLES)


# =============================================================================
# 7. Monster_hill_giant (Hill Giant): kept and re-rigged on the biped rig (plan M3c)
# =============================================================================
# Today's giant (design 4.6: good mass, kept) on the pilot's pattern, built as the wizard is
# (_build_human): today's torso, arms, fists, legs and feet fused into one skin, so the stacked-ball
# joints go; the shoulders and the fists exaggerated (design 5.2); the arms held out from the belly
# in the bind pose, so the shared clips that turn them in keep them clear; the club hard on
# WeaponPivot and carried hanging at the right side, outside the body, not in front of the belly.
# Today's head, brow, nose and braided beard, pelt skirt, fur strap, horned skull buckle, armbands,
# shin wraps, iron straps and stone spikes are kept. Coordinates are three-space (+Y up, -Z forward).
GIANT_TRIANGLES = 5600  # the builder's own budget, under the manifest's 7,000 (design 9.1's large class)
GIANT_HEIGHT = 2.36  # the shipped giant's height; the re-rigged one stays within 5%
GIANT_FUR_TILE = "public/textures/creatures/giant-fur.png"  # the engine's tile for hill_giant on 'skin' (textures.ts)
GIANT_COLOURS = {  # as the game shows them
    "skin": 0xA8805E,  # weathered tan, 66% value
    "skin_dark": 0x86644A,  # fists and feet, 53%
    "wrap": 0x6A4A30,  # the shin wraps, painted on the skin, 42%
    "pelt": 0x6E4E32,  # pelt skirt and strap, 43%
    "beard": 0x5A3E28,  # 35%
    "bone": 0xBCAC8C,  # buckle, horns, beads, armband, 74%
    "void": 0x2A2420,  # eyes and the skull's sockets: deliberate voids (design 5.4)
    "iron": 0x6C6E72,  # the club's straps, 45%
    "spike": 0x8C877C,  # the club's stone spikes, 55%
    "wood": 0x6E5034,  # the club, 43%
}
GIANT_FAMILY = {"skin": "skin", "skin_dark": "skin", "wrap": "skin", "pelt": "leather", "beard": "leather",
                "bone": "plain", "void": "plain", "iron": "plain", "spike": "plain", "wood": "wood"}
GIANT_RADII = {
    "pelvis": (0.32, 0.26), "waist": (0.37, 0.31), "chest": (0.46, 0.33), "chest2": (0.50, 0.32), "neck": 0.17,
    "collar": (0.24, 0.17), "shoulder": 0.20, "upper": 0.14, "elbow": 0.13, "fore": 0.145, "wrist": 0.088, "hand": 0.175,
    "hip": 0.17, "thigh": 0.16, "knee": 0.13, "calf": 0.14, "ankle": 0.10, "heel": 0.085, "toe": 0.105, "foot": 0.27,
}


def giant_joints() -> dict:
    """
    Joints of the biped rig at today's pivots (HeadGroup, arms and legs within 0.05 of them). The
    stance: the arms held wide of the belly, upper arm 32 degrees out and forearm 20, a little forward;
    the knees bent and out; each limb within 20 degrees of the biped reference.
    """
    j = {
        "Root": (0.0, 0.0, 0.0),
        "Hips": (0.0, 0.86, 0.02),
        "Torso": (0.0, 1.14, 0.0),
        "HeadGroup": (0.0, 2.02, -0.05),
    }
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        j[f"{tag}ArmPivot"] = (side * 0.58, 1.58, -0.02)
        j[f"{tag}ElbowPivot"] = (side * 0.845, 1.156, -0.08)
        j[f"{tag}Hand"] = (side * 0.995, 0.743, -0.16)
        j[f"{tag}LegPivot"] = (side * 0.22, 0.78, 0.02)
        j[f"{tag}KneePivot"] = (side * 0.27, 0.42, -0.04)
        j[f"{tag}Foot"] = (side * 0.28, 0.10, 0.02)
    j["WeaponPivot"] = j["RightHand"]
    return j


def _giant_kit(j: dict, col: dict, mats: dict):
    skin, fur, bone, wood = mats["skin"], mats["leather"], mats["plain"], mats["wood"]

    def aim(d) -> dict:
        d = Vector(d).normalized()
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    def kit(add, drape):
        # Head: today's craggy skull, Neanderthal brow, broad nose and heavy chin, with small ears,
        # fused into one form with hard edges round its planes
        parts = [
            add_sphere("gnt_skull", None, skin, 0.20, 0.19, 0.21, tx=0.0, ty=2.17, tz=-0.07, segs=12, rings=10),
            add_box("gnt_brow", None, skin, 0.32, 0.075, 0.12, tx=0.0, ty=2.235, tz=-0.215, bevel=0.02),
            add_sphere("gnt_nose", None, skin, 0.06, 0.07, 0.075, tx=0.0, ty=2.15, tz=-0.27, segs=8, rings=6),
            add_sphere("gnt_chin", None, skin, 0.17, 0.085, 0.13, tx=0.0, ty=2.04, tz=-0.15, segs=10, rings=6),
        ]
        for side in (-1.0, 1.0):
            parts.append(add_sphere("gnt_ear", None, skin, 0.035, 0.07, 0.05, tx=side * 0.195, ty=2.16, tz=-0.04, segs=6, rings=4))
        add(_goblin_fuse(parts, "gnt_head", skin, 0.014, 700, soften=3, crease=GOBLIN_CREASE), "HeadGroup", col["skin_face"], planes=True)
        # Small dark eyes deep under the brow: deliberate voids (no mesh name holds 'eye': the engine
        # would draw that whole mesh unlit)
        for side in (-1.0, 1.0):
            add(add_sphere("gnt_pupil", None, bone, 0.032, 0.026, 0.02, tx=side * 0.078, ty=2.185, tz=-0.248, segs=6, rings=4), "HeadGroup", col["void"])

        # Today's braided beard: a faceted mass under the chin and three braids with bone beads
        add(add_sphere("gnt_beard", None, fur, 0.20, 0.17, 0.15, tx=0.0, ty=1.99, tz=-0.20, segs=8, rings=6, smooth=False), "HeadGroup", col["beard"], planes=True)
        for k, bx in enumerate((-0.10, 0.0, 0.10)):
            top, end = (bx, 1.93, -0.33), (bx * 1.15, 1.64 + abs(bx) * 0.4, -0.40)
            add(add_limb_tube(f"gnt_braid_{k}", None, fur, top, end, 0.062, 0.034, segs=6, steps=3, smooth=False), "HeadGroup", col["beard"], planes=True)
            add(add_sphere(f"gnt_bead_{k}", None, bone, 0.045, 0.032, 0.045, tx=end[0], ty=end[1] + 0.05, tz=end[2], segs=6, rings=4, smooth=False), "HeadGroup", col["bone"], planes=True)

        # The pelt skirt, its hem jagged: every other vertex of the hem ring hangs lower. Weighted by
        # rule, as the wizard's skirt: all Hips at the belt, toward the hem up to SKIRT_LEG_SHARE on the
        # thighs, split by side, so it swings with the stride
        top, hem, segs = 0.98, 0.52, 12
        sections = [(top, 0.37, 0.31, 0.0, 0.01), (0.80, 0.43, 0.36, 0.0, 0.01), (hem, 0.48, 0.41, 0.0, 0.01)]
        skirt = add_lathe("gnt_pelt", None, fur, sections, segs=segs, cap_ends=False, smooth=False)
        for v in skirt.data.vertices:
            if v.index >= 2 * segs and v.index % 2:
                v.co.z -= 0.07

        def skirt_weights(co):
            t = min(max((top - co.z) / (top - hem), 0.0), 1.0)
            s = SKIRT_LEG_SHARE * t**1.5
            right = min(max(0.5 + co.x / 0.44, 0.0), 1.0)
            return {"Hips": 1.0 - s, "LeftLegPivot": s * (1.0 - right), "RightLegPivot": s * right}

        drape(skirt, col["pelt"], skirt_weights)
        # The horned beast-skull buckle on the belt, its sockets dark
        add(add_sphere("gnt_buckle", None, bone, 0.12, 0.13, 0.10, tx=0.0, ty=0.90, tz=-0.40, segs=8, rings=6, smooth=False), "Hips", col["bone"], planes=True)
        for side in (-1.0, 1.0):
            add(add_sphere("gnt_socket", None, bone, 0.034, tx=side * 0.045, ty=0.92, tz=-0.485, segs=6, rings=4), "Hips", col["void"])
            add(add_cone_spike("gnt_buckle_horn", None, bone, base_r=0.034, length=0.17, tx=side * 0.09, ty=0.95, tz=-0.41, rz=-side * 1.15, curve_bend=-0.05, segs=6, smooth=False), "Hips", col["bone"], planes=True)

        # The fur strap from the left shoulder across the chest and back to the right hip, weighted by
        # rule from all Torso over the chest to all Hips at the belt, so it follows a twist of the trunk
        strap = [(-0.40, 1.86, 0.0, 0.07, 0.04), (-0.10, 1.44, -0.385, 0.075, 0.04), (0.26, 1.02, -0.36, 0.07, 0.04),
                 (0.26, 1.02, 0.31, 0.07, 0.04), (-0.10, 1.46, 0.33, 0.075, 0.04), (-0.40, 1.86, 0.0, 0.07, 0.04)]

        def strap_weights(co):
            t = min(max((1.40 - co.z) / 0.38, 0.0), 1.0)
            return {"Torso": 1.0 - t, "Hips": t}

        drape(add_curved_tube("gnt_strap", None, fur, strap, segs=6, smooth=False), col["pelt"], strap_weights)

        # A bone armband on the right upper arm, leather on the left (asymmetry in one place)
        for tag in ("Left", "Right"):
            a, e = Vector(j[f"{tag}ArmPivot"]), Vector(j[f"{tag}ElbowPivot"])
            p0, p1 = a.lerp(e, 0.42), a.lerp(e, 0.60)
            add(add_limb_tube(f"gnt_armband_{tag[0]}", None, bone if tag == "Right" else fur, tuple(p0), tuple(p1), 0.215, 0.205, r_mid=0.215, segs=8, steps=2, smooth=False),
                f"{tag}ArmPivot", col["bone"] if tag == "Right" else col["pelt"], planes=True)

        # The club in the right fist, carried hanging at the side and a little forward, outside the
        # body: the grip through the fist, the head near the ground, two iron straps and six stone spikes
        hand = Vector(j["RightHand"])
        d = Vector((0.10, -1.0, -0.14)).normalized()
        knots = [(-0.16, 0.046), (0.06, 0.052), (0.24, 0.08), (0.42, 0.14), (0.56, 0.172), (0.66, 0.13)]
        club = [(*(hand + d * t), r) for t, r in knots]
        add(add_curved_tube("gnt_club", None, wood, club, segs=8, smooth=False), "WeaponPivot", col["wood"], planes=True)
        for k, (t, r) in enumerate(((0.36, 0.13), (0.54, 0.18))):
            add(add_limb_tube(f"gnt_club_strap_{k}", None, bone, tuple(hand + d * (t - 0.025)), tuple(hand + d * (t + 0.025)), r, r, r_mid=r, segs=8, steps=2, smooth=False),
                "WeaponPivot", col["iron"], planes=True)
        side_a = d.cross(Vector((0.0, 0.0, 1.0))).normalized()
        side_b = d.cross(side_a).normalized()
        for k in range(6):
            a = k * math.pi / 3.0 + (0.3 if k % 2 else 0.0)
            out = side_a * math.cos(a) + side_b * math.sin(a)
            at = hand + d * (0.45 if k % 2 else 0.60) + out * 0.12
            add(add_cone_spike(f"gnt_club_spike_{k}", None, bone, base_r=0.045, length=0.16, tx=at.x, ty=at.y, tz=at.z, segs=5, smooth=False, **aim(out)), "WeaponPivot", col["spike"], planes=True)

    return kit


def _giant_colour(col: dict):
    def colour_of(co, w):
        """Tan skin, darker on the fists and feet, the shin wraps of fur between ankle and knee."""
        if w.get("LeftHand", 0.0) + w.get("RightHand", 0.0) + w.get("LeftFoot", 0.0) + w.get("RightFoot", 0.0) >= 0.5:
            return col["skin_dark"]
        if 0.17 < co.z < 0.40:
            return col["wrap"]
        return col["skin"]

    return colour_of


def build_hill_giant(grid_pos: tuple[float, float, float], mats: dict):
    # grid_pos is not used: a skinned figure stands at the file's origin (design 6.1.1 rule 2b).
    # White materials of the giant's own: 'skin' draws with the giant-fur tile, 'fur' with the leather
    # tile, 'wood' with the wood tile, and the bone material plain (buckle, horns, beads, armband, iron
    # straps, stone spikes and the voids, each painted). 'skin_hill_giant' stays in the skin's name.
    own = {
        "skin": make_mat("mat_skin_hill_giant_paint", 0xFFFFFF, roughness=0.60, metallic=0.04),
        "leather": make_mat("mat_fur_hill_giant_paint", 0xFFFFFF, roughness=0.75, metallic=0.02),
        "wood": make_mat("mat_wood_hill_giant_paint", 0xFFFFFF, roughness=0.72, metallic=0.02),
        "plain": make_mat("mat_bone_hill_giant_paint", 0xFFFFFF, roughness=0.50, metallic=0.06),
    }
    means = {"skin": _goblin_hide_mean(GIANT_FUR_TILE), "leather": _goblin_hide_mean(LEATHER_TILE), "wood": _goblin_hide_mean(WOOD_TILE)}
    col = _human_paint(GIANT_COLOURS, GIANT_FAMILY, means)
    col["skin_face"] = col["skin"]
    names = {"skin": "hill_giant_body", "leather": "hill_giant_fur", "wood": "hill_giant_club", "plain": "hill_giant_bone"}
    j = giant_joints()
    return _build_human("hill_giant", j, GIANT_RADII, GIANT_TRIANGLES, GIANT_HEIGHT, own, "skin", names, _giant_kit(j, col, own), _giant_colour(col))


# --- 7b. Kit_slag_brute: the Slag Brute's kit on the hill giant (Stage 6 plan MK2, design 7.5) --------------------
# The giant plus rigid pieces of its own, each one mesh named slag_brute_<Bone> after the giant bone it rides
# on, as MK1's: a pauldron of three overlapping slag lames over each shoulder ball, centred on the arm's joint
# so it turns with the arm in the Overhead Slam (Left/RightArmPivot); a hunch of shingled slag slabs over the
# upper back, rising behind the neck, with three blunt knobs and nothing above the skull (Torso); and a
# cooled-slag maul head of three stacked slabs across the club's head, swallowing its spikes (WeaponPivot).
# Every slab is a chamfered box with its corners knocked about, so it reads as broken slag, not cut stone.
# The hot slag shows only where a plate overlaps the next: the undersides and inner faces of the plates and
# the seams between the maul's slabs are painted ember. All on the giant's plain bone material (no tile, so
# the colours are painted as they are), so the kit adds no material and no emissive.
SLAG_KIT_TRIANGLES = 1200
SLAG_COLOURS = {  # as the game shows them before Stage 6's tint
    "basalt": 0x4A4440,  # the plates, 27% luma, 29% value
    "crust": 0x5C5550,  # the maul's cooled slag and the knobs, 34% luma, 36% value
    "ember": 0xBC5C28,  # the seams, 45% luma, 74% value (MK1's ember, under design 5.4's top of 75%)
}


def _slag_chunk(name: str, mat, size, centre, basis, rng, jitter: float = 0.014):
    """
    A chamfered box of full sizes (along basis[0], basis[1], basis[2], three-space unit vectors) at centre,
    each vertex moved up to jitter by rng, so its faces break like slag. Built flat-shaded.
    """
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=0.14, segments=1, profile=0.5)
    c = Vector(centre)
    axes = [Vector(a).normalized() for a in basis]
    for v in bm.verts:
        p = c + sum((axes[k] * (v.co[k] * size[k]) for k in range(3)), Vector())
        p += Vector([rng.uniform(-jitter, jitter) for _ in range(3)])
        v.co = Vector(t2b(*p))
    bm.normal_update()  # finalize_obj's recalc_face_normals reads the face normals: stale ones turn the box inside out
    return finalize_obj(name, bm, None, mat, smooth=False)


def _slag_ember(obj, colour: list, hot) -> None:
    """Paints ember on every face for which hot(centre, normal) holds, both in three-space."""
    tint = obj.data.color_attributes["Tint"].data
    for poly in obj.data.polygons:
        c, n = Vector(poly.center), Vector(poly.normal)
        if hot(Vector((c.x, c.z, -c.y)), Vector((n.x, n.z, -n.y))):
            for li in poly.loop_indices:
                tint[li].color = [*colour, 1.0]


def build_slag_brute_kit():
    """
    The Slag Brute's kit (plan MK2): Kit_slag_brute at the origin with the children slag_brute_Torso,
    _LeftArmPivot, _RightArmPivot and _WeaponPivot (_kit_root). Built after build_hill_giant, on its bone
    material.
    """
    plain = bpy.data.materials["mat_bone_hill_giant_paint"]  # build_hill_giant's
    col = {k: list(hex_to_rgba(c)[:3]) for k, c in SLAG_COLOURS.items()}  # no tile: painted as they are
    j = giant_joints()
    rng = random.Random(58)
    parts = {"Torso": [], "LeftArmPivot": [], "RightArmPivot": [], "WeaponPivot": []}

    def add(obj, bone: str, colour: str, hot=None):
        _goblin_tint(obj, col[colour], planes=True)
        if hot is not None:
            _slag_ember(obj, col["ember"], hot)
        parts[bone].append(obj)

    # The pauldrons: three lames of a dome round the shoulder ball (radius 0.20 at the arm's joint), each a
    # little larger than the one above and overlapping it, the dome's axis tilted 0.55 out from the vertical.
    # A shell 0.035 thick; ember on the rims and the inner faces, which show in the step between two lames
    lames = ((0.27, (0.0, 0.32, 0.62)), (0.29, (0.52, 1.02)), (0.31, (0.93, 1.42)))
    for s, tag in ((-1.0, "Left"), (1.0, "Right")):
        bone = f"{tag}ArmPivot"
        joint = Vector(j[bone])
        for k, (radius, angles) in enumerate(lames):
            sections = [(radius * math.cos(a), max(0.004, radius * math.sin(a)), max(0.004, radius * math.sin(a))) for a in angles]
            lame = add_lathe(f"sbr_lame_{tag[0]}{k}", None, plain, sections, segs=8, tx=joint.x, ty=joint.y, tz=joint.z,
                             rz=-s * 0.55, cap_ends=False, smooth=False)
            for v in lame.data.vertices:
                v.co += Vector([rng.uniform(-0.012, 0.012) for _ in range(3)])
            solid = lame.modifiers.new("shell", "SOLIDIFY")
            solid.thickness, solid.offset, solid.use_rim = 0.035, -1.0, True
            bpy.context.view_layer.objects.active = lame
            bpy.ops.object.modifier_apply(modifier=solid.name)
            add(lame, bone, "basalt", lambda c, n, o=joint: n.dot((c - o).normalized()) < 0.5)

    # The hunch: four rows of shingled slabs over the upper back, each slab's face turned to the back's
    # slope (phi from straight up toward the back) and lying on it (the back's skin is at three z 0.22 to 0.27
    # between y 1.4 and 1.7), the top row behind the neck at
    # y 1.88, clear of the head's back (three z 0.14); wide and low, nothing above the skull. Ember on the
    # undersides and their chamfers, which show between a slab and the one below
    rows = (  # (x, y, z, phi, yaw, width, thickness, length)
        (0.0, 1.88, 0.30, 0.60, 0.0, 0.66, 0.14, 0.34),
        (-0.21, 1.68, 0.33, 1.10, 0.25, 0.40, 0.15, 0.30), (0.21, 1.68, 0.33, 1.10, -0.25, 0.40, 0.15, 0.30),
        (-0.19, 1.46, 0.35, 1.45, 0.30, 0.38, 0.14, 0.28), (0.19, 1.46, 0.35, 1.45, -0.30, 0.38, 0.14, 0.28),
        (0.0, 1.26, 0.33, 1.75, 0.0, 0.48, 0.12, 0.22),
    )
    for k, (x, y, z, phi, yaw, w, t, length) in enumerate(rows):
        normal = Vector((math.sin(yaw) * math.sin(phi), math.cos(phi), math.cos(yaw) * math.sin(phi)))
        across = Vector((math.cos(yaw), 0.0, -math.sin(yaw)))
        along = normal.cross(across).normalized()
        add(_slag_chunk(f"sbr_slab_{k}", plain, (w, t, length), (x, y, z), (across, normal, along), rng), "Torso", "basalt",
            lambda c, n: n.y < -0.3)
    for k, (x, y, z, lean) in enumerate(((0.0, 1.96, 0.36, 0.0), (-0.24, 1.80, 0.41, 0.35), (0.24, 1.80, 0.41, -0.35))):
        add(add_lathe(f"sbr_knob_{k}", None, plain, [(0.0, 0.07, 0.07), (0.08, 0.055, 0.05), (0.14, 0.012, 0.012)], segs=5,
                      tx=x, ty=y, tz=z, rx=0.75, rz=lean, smooth=False), "Torso", "crust")

    # The maul head: three slabs stacked along the club's axis (as _giant_kit carries it, hanging at the
    # right side), across it 0.52 to 0.64 (the lowest the widest, over the spikes' tips at 0.28 from the axis at
    # 0.60 of it) and fore and aft 0.64 to 0.76 (the lowest the shortest, so its corners stay off the ground),
    # each turned a little about the axis so their edges stagger; the club's head, straps and spikes inside them.
    # Ember only on the seams between the slabs: the top slab's upper face, where the handle goes in, and the
    # lowest slab's end face, which faces the camera in the Overhead Slam, stay crust
    hand = Vector(j["RightHand"])
    d = Vector((0.10, -1.0, -0.14)).normalized()
    side = d.cross(Vector((0.0, 0.0, 1.0))).normalized()
    fwd = side.cross(d).normalized()
    for k, (t, w, h, length, turn) in enumerate(((0.33, 0.52, 0.13, 0.68, 0.10), (0.46, 0.60, 0.13, 0.76, -0.07), (0.595, 0.64, 0.15, 0.64, 0.12))):
        a = side * math.cos(turn) + fwd * math.sin(turn)
        b = fwd * math.cos(turn) - side * math.sin(turn)
        hot = {0: lambda c, n: n.dot(d) > 0.3, 1: lambda c, n: abs(n.dot(d)) > 0.3, 2: lambda c, n: n.dot(d) < -0.3}[k]
        add(_slag_chunk(f"sbr_maul_{k}", plain, (w, h, length), hand + d * t, (a, d, b), rng, jitter=0.03), "WeaponPivot", "crust", hot)
    return _kit_root("slag_brute", parts, j, SLAG_KIT_TRIANGLES)


# =============================================================================
# 8. Monster_moss_guardian (Moss Guardian): kept and re-rigged on the biped rig (plan M3c)
# =============================================================================
# Today's golem (design 4.6: it needs value separation, not a new shape) on the biped rig. Stone and
# bark do not bend, so every block is hard on one bone, as the scorpion's parts are: the bark trunk
# cut at the waist, each limb cut at its joints with a stone cap over the joint. Stone stands 20
# points of value over the bark, moss between them in hue, and the heart core is the one glow: the
# eyes are dark sockets and the mushroom caps pale, no longer emissive. The boulder gauntlet on the
# right fist is the one asymmetry. Coordinates are three-space (+Y up, -Z forward).
GUARDIAN_TRIANGLES = 5600  # under the manifest's 7,000 (design 9.1's large class)
GUARDIAN_HEIGHT = 2.489  # the shipped guardian's height, antlers included; the re-rigged one stays within 5%
BARK_TILE = "public/textures/bark.png"  # 'bark' in a material name draws with this tile (blenderMonsters.ts)
STONE_TILE = "public/textures/stone.png"
GRASS_TILE = "public/textures/grass.png"  # 'moss' draws with the grass tile
GUARDIAN_COLOURS = {  # as the game shows them
    "bark": 0x5E4A36,  # 37% value
    "bark_dark": 0x4E3E2E,  # the trunk's lower blocks, 31%
    "antler": 0x75603F,  # 46%
    "stone": 0x9A978E,  # 60%: 23 points over the bark
    "stone_dark": 0x86837A,  # 53%
    "moss": 0x5F7F38,  # 50%
    "cap": 0xB4A688,  # mushroom caps on the stone, 71%: a small accent
    "void": 0x221E1A,  # the eye sockets: deliberate voids (design 5.4)
}
GUARDIAN_FAMILY = {"bark": "bark", "bark_dark": "bark", "antler": "bark", "stone": "stone", "stone_dark": "stone",
                   "cap": "stone", "void": "stone", "moss": "moss"}


def guardian_joints() -> dict:
    """
    Joints of the biped rig at today's pivots, made symmetric (each within 0.02 of today's): the trunk
    leaning forward 18 degrees into the head, heavy arms hanging out and forward, the legs wide.
    """
    j = {
        "Root": (0.0, 0.0, 0.0),
        "Hips": (0.0, 0.84, 0.02),
        "Torso": (0.0, 1.06, 0.0),
        "HeadGroup": (0.0, 1.62, -0.18),
    }
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        j[f"{tag}ArmPivot"] = (side * 0.60, 1.39, 0.0)
        j[f"{tag}ElbowPivot"] = (side * 0.763, 1.025, -0.05)
        j[f"{tag}Hand"] = (side * 0.913, 0.654, -0.14)
        j[f"{tag}LegPivot"] = (side * 0.25, 0.78, 0.0)
        j[f"{tag}KneePivot"] = (side * 0.30, 0.42, -0.03)
        j[f"{tag}Foot"] = (side * 0.30, 0.09, 0.02)
    return j


def build_moss_guardian(grid_pos: tuple[float, float, float], mats: dict):
    """
    The moss guardian, kept and re-rigged (plan M3c): today's blocks, four skinned meshes on the biped
    rig, every block hard on one bone. grid_pos is not used: a skinned figure stands at the file's
    origin (design 6.1.1 rule 2b).
    """
    import rigs

    # White materials of the guardian's own, the paint over each tile's mean. The figure key is kept
    # out of the names: 'moss' in 'mat_stone_moss_guardian' would draw the stone with the grass tile.
    bark = make_mat("mat_bark_guardian_paint", 0xFFFFFF, roughness=0.80, metallic=0.02)
    stone = make_mat("mat_stone_guardian_paint", 0xFFFFFF, roughness=0.85, metallic=0.02)
    moss = make_mat("mat_moss_guardian_paint", 0xFFFFFF, roughness=0.90, metallic=0.0)
    glow = mats["glow_emerald"]
    means = {"bark": _goblin_hide_mean(BARK_TILE), "stone": _goblin_hide_mean(STONE_TILE), "moss": _goblin_hide_mean(GRASS_TILE)}
    col = _human_paint(GUARDIAN_COLOURS, GUARDIAN_FAMILY, means)
    j = guardian_joints()
    hard = []  # (object, bone)

    def add(obj, bone: str, colour, planes: bool = True):
        _goblin_tint(obj, colour, planes)
        hard.append((obj, f"moss_guardian_{bone}"))

    # Hips: the lower trunk, a bark block from under the leg joints to the waist
    add(add_lathe("mgd_pelvis", None, bark, [(0.66, 0.24, 0.19), (0.84, 0.32, 0.25, 0.0, 0.02), (1.02, 0.31, 0.24, 0.0, 0.0)], segs=8, smooth=False), "Hips", col["bark_dark"])
    # Torso: today's bark chest, its stone slabs, the glowing heart core between them and the back slab
    add(add_lathe("mgd_chest", None, bark, [(0.98, 0.30, 0.23), (1.28, 0.44, 0.32, 0.0, -0.04), (1.56, 0.48, 0.34, 0.0, -0.06), (1.74, 0.28, 0.24, 0.0, -0.04)], segs=10, smooth=False), "Torso", col["bark"])
    add(add_sphere("mgd_core", None, glow, 0.15, 0.21, 0.15, tx=0.0, ty=1.32, tz=-0.32, segs=8, rings=6, smooth=False), "Torso", 0xFFFFFF, planes=False)
    slab_specs = [
        (-0.25, 1.46, -0.30, 0.22, 0.22, 0.14, 0.15, 0.25, "stone"),
        (0.25, 1.44, -0.30, 0.22, 0.22, 0.14, -0.12, -0.25, "stone_dark"),
        (-0.21, 1.14, -0.27, 0.20, 0.18, 0.14, -0.10, 0.20, "stone_dark"),
        (0.21, 1.14, -0.27, 0.20, 0.18, 0.14, 0.10, -0.20, "stone"),
        (0.0, 1.38, 0.28, 0.44, 0.42, 0.20, 0.18, 0.0, "stone"),
    ]
    for k, (sx, sy, sz, wx, hy, dz, rx_v, ry_v, tone) in enumerate(slab_specs):
        add(add_box(f"mgd_slab_{k}", None, stone, wx, hy, dz, tx=sx, ty=sy, tz=sz, rx=rx_v, ry=ry_v, bevel=0.0), "Torso", col[tone])

    # Head: today's bark mask, crowned with moss; dark sockets for eyes; branching antlers in a lighter
    # bark with leaf clusters. Thickened: nothing under 0.044 across (design 5.3)
    hx, hy, hz = j["HeadGroup"]
    add(add_box("mgd_mask", None, bark, 0.34, 0.38, 0.28, tx=hx, ty=hy + 0.14, tz=hz - 0.04, bevel=0.0), "HeadGroup", col["bark"])
    add(add_sphere("mgd_crown", None, moss, 0.20, 0.09, 0.16, tx=hx, ty=hy + 0.33, tz=hz - 0.02, segs=8, rings=5, smooth=False), "HeadGroup", col["moss"])
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        add(add_box(f"mgd_socket_{tag}", None, stone, 0.08, 0.05, 0.03, tx=hx + side * 0.085, ty=hy + 0.16, tz=hz - 0.185, rz=-side * 0.15, bevel=0.0), "HeadGroup", col["void"], planes=False)
        antler = [(hx + side * 0.12, hy + 0.28, hz - 0.02, 0.045), (hx + side * 0.24, hy + 0.46, hz + 0.02, 0.038),
                  (hx + side * 0.36, hy + 0.68, hz + 0.06, 0.03), (hx + side * 0.28, hy + 0.87, hz + 0.02, 0.024)]
        add(add_curved_tube(f"mgd_antler_{tag}", None, bark, antler, segs=6, smooth=False), "HeadGroup", col["antler"])
        add(add_limb_tube(f"mgd_tine_{tag}", None, bark, (hx + side * 0.24, hy + 0.48, hz + 0.02), (hx + side * 0.44, hy + 0.62, hz - 0.08), 0.03, 0.023, segs=5, steps=2, smooth=False), "HeadGroup", col["antler"])
        add(add_sphere(f"mgd_leaves_{tag}", None, moss, 0.085, 0.065, 0.075, tx=hx + side * 0.35, ty=hy + 0.72, tz=hz + 0.04, segs=6, rings=4, smooth=False), "HeadGroup", col["moss"])

    # Shoulders: today's boulder pauldrons under moss cushions, on the arm bones; two pale mushrooms
    # on the left one
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        px, py, pz = j[f"{tag}ArmPivot"]
        add(add_box(f"mgd_pauldron_{tag}", None, stone, 0.36, 0.28, 0.34, tx=px, ty=py + 0.16, tz=pz - 0.02, rz=-side * 0.24, bevel=0.0), f"{tag}ArmPivot", col["stone"])
        add(add_sphere(f"mgd_cushion_{tag}", None, moss, 0.21, 0.11, 0.20, tx=px, ty=py + 0.29, tz=pz - 0.02, segs=8, rings=5, smooth=False), f"{tag}ArmPivot", col["moss"])
        if side < 0:
            for k, (mx, mz) in enumerate(((px + 0.04, -0.06), (px + 0.14, 0.06))):
                add(add_limb_tube(f"mgd_stem_{k}", None, stone, (mx, py + 0.34, mz), (mx - 0.02, py + 0.44, mz), 0.024, 0.022, segs=5, steps=2, smooth=False), f"{tag}ArmPivot", col["cap"])
                add(add_sphere(f"mgd_cap_{k}", None, stone, 0.055, 0.032, 0.055, tx=mx - 0.02, ty=py + 0.45, tz=mz, segs=6, rings=4, smooth=False), f"{tag}ArmPivot", col["cap"])

    # Arms: a bark upper arm, a stone cap over the elbow, a bark forearm; the left hand ends in three
    # bark claws, the right in today's boulder gauntlet with its moss
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        a, e, h = (Vector(j[f"{tag}{n}"]) for n in ("ArmPivot", "ElbowPivot", "Hand"))
        add(add_limb_tube(f"mgd_upper_{tag}", None, bark, tuple(a), tuple(e), 0.14, 0.11, segs=7, steps=3, smooth=False), f"{tag}ArmPivot", col["bark"])
        add(add_sphere(f"mgd_elbow_{tag}", None, stone, 0.16, 0.14, 0.16, tx=e.x, ty=e.y, tz=e.z, segs=7, rings=5, smooth=False), f"{tag}ElbowPivot", col["stone_dark"])
        add(add_limb_tube(f"mgd_fore_{tag}", None, bark, tuple(e), tuple(h), 0.115, 0.095, segs=7, steps=3, smooth=False), f"{tag}ElbowPivot", col["bark"])
        d = (h - e).normalized()
        if side < 0:
            add(add_sphere("mgd_fist_L", None, bark, 0.10, 0.09, 0.10, tx=h.x, ty=h.y, tz=h.z, segs=7, rings=5, smooth=False), f"{tag}Hand", col["bark_dark"])
            for k, dz in enumerate((-0.05, 0.0, 0.05)):
                at = h + d * 0.06 + Vector((0.0, 0.0, dz - 0.03))
                add(add_cone_spike(f"mgd_claw_{k}", None, bark, base_r=0.032, length=0.17, tx=at.x, ty=at.y, tz=at.z, segs=5, smooth=False,
                                   rx=math.asin(d.z), rz=-math.atan2(d.x, d.y)), f"{tag}Hand", col["antler"])
        else:
            c = h + d * 0.12
            add(add_box("mgd_gauntlet", None, stone, 0.38, 0.48, 0.38, tx=c.x, ty=c.y, tz=c.z, rx=-0.24, rz=math.atan2(d.x, -d.y), bevel=0.0), f"{tag}Hand", col["stone"])
            add(add_sphere("mgd_gauntlet_moss", None, moss, 0.20, 0.12, 0.20, tx=c.x, ty=c.y + 0.22, tz=c.z, segs=8, rings=5, smooth=False), f"{tag}Hand", col["moss"])

    # Legs: a bark thigh, a stone knee cap, a bark shin; the foot a stone block with three root claws
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        hip, knee, foot = (Vector(j[f"{tag}{n}"]) for n in ("LegPivot", "KneePivot", "Foot"))
        add(add_limb_tube(f"mgd_thigh_{tag}", None, bark, tuple(hip + Vector((0.0, 0.06, 0.0))), tuple(knee), 0.17, 0.15, segs=7, steps=3, smooth=False), f"{tag}LegPivot", col["bark_dark"])
        add(add_sphere(f"mgd_knee_{tag}", None, stone, 0.18, 0.15, 0.17, tx=knee.x, ty=knee.y, tz=knee.z - 0.06, segs=7, rings=5, smooth=False), f"{tag}KneePivot", col["stone_dark"])
        add(add_limb_tube(f"mgd_shin_{tag}", None, bark, tuple(knee), tuple(foot), 0.15, 0.18, segs=7, steps=3, smooth=False), f"{tag}KneePivot", col["bark"])
        add(add_box(f"mgd_foot_{tag}", None, stone, 0.30, 0.12, 0.34, tx=foot.x, ty=0.06, tz=foot.z - 0.05, bevel=0.0), f"{tag}Foot", col["stone_dark"])
        for k, ang in enumerate((-0.45, 0.0, 0.45)):
            add(add_cone_spike(f"mgd_root_{tag}_{k}", None, bark, base_r=0.045, length=0.20, tx=foot.x + math.sin(ang) * 0.10, ty=0.05, tz=foot.z - 0.18,
                               rx=-math.pi * 0.46, ry=-ang, segs=5, smooth=False), f"{tag}Foot", col["antler"])

    rig = figkit.make_rig("Monster_moss_guardian", rigs.BIPED_TABLE, {k: t2b(*p) for k, p in j.items()}, prefix="moss_guardian")
    for obj, bone in hard:
        figkit.hard_weights(obj, bone)
        obj.parent = rig

    merged = figkit.merge_by_family(rig)
    names = {"bark": "moss_guardian_bark", "stone": "moss_guardian_stone", "moss": "moss_guardian_moss", "glow": "moss_guardian_core"}
    for ob in merged:
        ob.name = ob.data.name = names[figkit.get_material_family(ob)]
    _figure_paint(rig, merged, HUMAN_OCCLUSION)

    tris = sum(len(p.vertices) - 2 for ob in merged for p in ob.data.polygons)
    if tris > GUARDIAN_TRIANGLES:
        raise ValueError(f"moss_guardian: {tris} triangles, over the budget of {GUARDIAN_TRIANGLES}")
    cos = [v.co for ob in merged for v in ob.data.vertices]
    size = [max(c[a] for c in cos) - min(c[a] for c in cos) for a in (0, 2, 1)]  # width, height, depth
    print(f"[Blender] moss_guardian: {tris} triangles in {len(merged)} meshes; width {size[0]:.3f}, height {size[1]:.3f}, "
          f"depth {size[2]:.3f}; lowest {min(c.z for c in cos):.4f}")
    if abs(size[1] / GUARDIAN_HEIGHT - 1.0) > 0.05:
        raise ValueError(f"moss_guardian: height {size[1]:.3f} is more than 5% from the shipped guardian's {GUARDIAN_HEIGHT}")
    return rig


# =============================================================================
# 9. Monster_lesser_demon (Lesser Demon): rebuilt and skinned on the biped rig (plan M3d)
# =============================================================================
# An original demon on the pilot's pattern (docs/superpowers/baseline/models/README.md): a brute
# with a forward hunch, long arms and a small head under big swept horns, wings raised from the
# middle of the back, a tail in two bones with a spade, and a cleaver held low and forward on
# WeaponPivot. Slate hide, ember membrane, eyes, mouth and cleaver edge. Coordinates are
# three-space like the rest of this file (+Y up, -Z forward). The figure stands at the file's
# origin (design 6.1.1 rule 2b).
DEMON_TRIANGLES = 5500  # the builder's own budget, under the manifest's 7,000: what keeps the figure under design 9.1's 160 kB as exported
DEMON_OCCLUSION = 0.5  # bake_paint's occlusion strength, as the goblin's
DEMON_VOXEL = 0.025  # the goblin's 0.02 on a figure a third taller
DEMON_HEIGHT = 2.350  # the shipped demon's height; the new one stays within 5%
DEMON_COLOURS = {  # as the game shows them
    "hide": 0x58616C,  # slate, 42% value
    "hide_dark": 0x3A4049,  # hands and feet, 29% value
    "membrane": 0x7E3826,  # ember red, 49% value
    "horn": 0xB3A58B,  # horns, claws, fangs and spade, pale horn, 70% value
    "blade": 0x4C5057,  # the cleaver's blade, dark iron, 34% value
    "grip": 0x5A3E2C,  # the cleaver's grip and the loincloth, 35% value
}
DEMON_HIDE_TILE = "public/textures/creatures/demon-hide.png"  # the engine's tile for lesser_demon (textures.ts)
DEMON_LEATHER_TILE = "public/textures/leather.png"  # 'wing' in a material name draws with the leather tile


def demon_joints() -> dict:
    """
    Joints of the biped rig with the wing and tail bones. The bind pose is the stance, each limb
    within 20 degrees of the biped reference (design 6.1.1 rule 3): the spine leans forward 19
    degrees into the neck, the long arms hang out and forward, the knees are bent. The hunch of
    the back and the head's thrust are mesh. The wings root on the middle of the back.
    """
    j = {
        "Root": (0.0, 0.0, 0.0),
        "Hips": (0.0, 1.02, 0.06),
        "Torso": (0.0, 1.30, 0.02),
        "HeadGroup": (0.0, 1.86, -0.17),
        "Jaw": (0.0, 1.90, -0.33),
        "TailPivot": (0.0, 0.98, 0.24),
        "TailPivot2": (0.0, 0.80, 0.66),
    }
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        j[f"{tag}ArmPivot"] = (side * 0.44, 1.72, -0.08)
        j[f"{tag}ElbowPivot"] = (side * 0.62, 1.31, -0.20)
        j[f"{tag}Hand"] = (side * 0.80, 0.93, -0.30)
        j[f"{tag}LegPivot"] = (side * 0.19, 0.98, 0.06)
        j[f"{tag}KneePivot"] = (side * 0.29, 0.54, -0.08)
        j[f"{tag}Foot"] = (side * 0.28, 0.11, 0.06)
        j[f"{tag[0]}Wing"] = (side * 0.16, 1.64, 0.20)
    j["WeaponPivot"] = j["RightHand"]
    return j


def _demon_body_graph(j: dict) -> tuple[list, list, list, list]:
    """
    The stick graph and radii for figkit.organic_body, and the keep balls of hands and feet for
    _goblin_skin, in Blender space: trunk, neck, arms, legs and tail are one skin. The chest is two
    wide flat ellipses over a narrow waist, the shoulders and the hump stand as forms of their own,
    and each limb narrows between its joints.
    """
    pts, radii, edges, keep = [], [], [], []

    def chain(start, nodes):
        prev = start
        for p, r in nodes:
            pts.append(t2b(*p))
            radii.append(r)
            if prev is not None:
                edges.append((prev, len(pts) - 1))
            prev = len(pts) - 1
        return prev

    def along(a, b, t):
        return tuple(Vector(a).lerp(Vector(b), t))

    pelvis = chain(None, [((0.0, 1.00, 0.06), (0.24, 0.19))])
    chest = chain(pelvis, [((0.0, 1.18, 0.02), 0.18), ((0.0, 1.40, -0.04), (0.36, 0.25)), ((0.0, 1.60, -0.08), (0.40, 0.27))])
    chain(chest, [((0.0, 1.80, -0.15), 0.16), ((0.0, 1.95, -0.26), 0.13)])  # neck, thrust forward into the head
    chain(chest, [((0.0, 1.76, 0.10), 0.21)])  # the hump: one node standing off the back
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        shoulder, elbow, hand = j[f"{tag}ArmPivot"], j[f"{tag}ElbowPivot"], Vector(j[f"{tag}Hand"])
        d = (hand - Vector(elbow)).normalized()
        chain(chest, [
            ((side * 0.24, 1.70, -0.07), (0.22, 0.16)),  # collar: the shoulder line slopes from the neck
            (shoulder, 0.16),
            (along(shoulder, elbow, 0.6), 0.11),
            (elbow, 0.12),
            (along(elbow, hand, 0.35), 0.115),  # the forearm's bulk
            (tuple(hand - d * 0.10), 0.075),  # wrist
            (tuple(hand - d * 0.02), 0.105),  # the fist, around the hand joint
            (tuple(hand + d * 0.10), 0.095),
        ])
        keep.append((Vector(t2b(*(hand + d * 0.04))), 0.18))
        hip, knee, ankle = j[f"{tag}LegPivot"], j[f"{tag}KneePivot"], j[f"{tag}Foot"]
        chain(pelvis, [
            (hip, 0.17),
            (along(hip, knee, 0.6), 0.13),
            (knee, 0.115),
            (along(knee, ankle, 0.3), 0.11),  # calf
            (along(knee, ankle, 0.8), 0.07),
            # The hoof: one flat slab from the heel under the ankle joint to the toe, cut flat at the ground
            ((ankle[0], 0.05, ankle[2]), (0.06, 0.08)),
            ((ankle[0] * 1.03, 0.05, ankle[2] - 0.22), (0.06, 0.09)),
        ])
        keep.append((Vector(t2b(ankle[0], 0.05, ankle[2] - 0.10)), 0.20))
    # The tail leaves the pelvis, runs back and down along its two bones and curls up at the spade
    chain(pelvis, [(j["TailPivot"], 0.09), (j["TailPivot2"], 0.06), ((0.0, 0.70, 1.00), 0.045), ((0.0, 0.82, 1.24), 0.04)])
    return pts, edges, radii, keep


def _demon_head(mat):
    """The head: a blocky skull with a heavy brow, a short muzzle and swept ears, fused into one form with hard edges round its planes."""
    parts = [
        add_sphere("dem_skull", None, mat, 0.16, 0.15, 0.18, tx=0.0, ty=2.02, tz=-0.28, segs=8, rings=6, smooth=False),
        add_curved_tube(
            "dem_brow", None, mat,
            [(-0.17, 2.09, -0.34, 0.04), (-0.07, 2.07, -0.44, 0.05), (0.0, 2.06, -0.45, 0.045), (0.07, 2.07, -0.44, 0.05), (0.17, 2.09, -0.34, 0.04)],
            segs=4, smooth=False,
        ),
        add_box("dem_muzzle", None, mat, 0.20, 0.13, 0.16, tx=0.0, ty=1.94, tz=-0.45, rx=0.10, bevel=0.0),
    ]
    for side in (-1.0, 1.0):
        parts.append(
            add_cone_spike(
                "dem_ear", None, mat, base_r=0.035, length=0.20, tx=side * 0.15, ty=2.04, tz=-0.24,
                rx=0.20, rz=-side * 1.25, segs=6, flatten_x=2.4, smooth=False,
            )
        )
    return _goblin_fuse(parts, "dem_head", mat, 0.014, 700, soften=1, crease=GOBLIN_CREASE)


def build_lesser_demon(grid_pos: tuple[float, float, float], mats: dict):
    # grid_pos is not used: a skinned figure stands at the file's origin (design 6.1.1 rule 2b)
    import rigs  # the biped table

    # White, like the goblin's: every colour of the demon is paint. The names give the engine its
    # families: 'skin' the hide with the demon-hide tile, 'wing' the membrane and loincloth (leather,
    # both sides drawn), the horn material plain for horns, claws, fangs, spade and the cleaver. The
    # eyes, mouth and cleaver edge are on the file's own mat_glow_orange.
    skin = make_mat("mat_skin_lesser_demon_paint", 0xFFFFFF, roughness=0.50, metallic=0.06)
    wing = make_mat("mat_wing_lesser_demon_paint", 0xFFFFFF, roughness=0.55, metallic=0.04)
    horn = make_mat("mat_horn_lesser_demon_paint", 0xFFFFFF, roughness=0.42, metallic=0.20)
    glow = mats["glow_orange"]
    hide_tile, leather_tile = _goblin_hide_mean(DEMON_HIDE_TILE), _goblin_hide_mean(DEMON_LEATHER_TILE)
    col = dict(DEMON_COLOURS)
    for key, tile in (("hide", hide_tile), ("hide_dark", hide_tile), ("membrane", leather_tile), ("grip", leather_tile)):
        col[key] = _goblin_skin_paint(DEMON_COLOURS[key], tile)
    j = demon_joints()
    hard = []  # (object, bone): rigid parts, weight 1 on one bone

    def add(obj, bone: str, colour, planes: bool = False):
        _goblin_tint(obj, colour, planes)
        hard.append((obj, f"lesser_demon_{bone}"))

    def aim(d) -> dict:
        """The rx and rz that turn a primitive's own +Y axis to the direction d."""
        d = Vector(d).normalized()
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    # Head, jaw and mouth. The mouth glows between brow and jaw; the eyes are ember slits on the
    # glow (no mesh name holds 'eye': the engine would draw that whole mesh unlit).
    add(_demon_head(skin), "HeadGroup", col["hide"], planes=True)
    add(add_sphere("dem_jaw", None, skin, 0.15, 0.06, 0.13, tx=0.0, ty=1.86, tz=-0.40, segs=8, rings=6, smooth=False), "Jaw", col["hide"], planes=True)
    add(add_sphere("dem_maw", None, glow, 0.11, 0.025, 0.08, tx=0.0, ty=1.91, tz=-0.47, segs=8, rings=5), "HeadGroup", 0xFFFFFF)
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        add(add_sphere(f"dem_ember_{tag}", None, glow, 0.05, 0.024, 0.02, tx=side * 0.085, ty=2.02, tz=-0.45, rz=side * 0.30, segs=6, rings=4), "HeadGroup", 0xFFFFFF)
        add(add_cone_spike(f"dem_fang_{tag}", None, horn, base_r=0.025, length=0.09, tx=side * 0.10, ty=1.87, tz=-0.50, rx=-0.15, segs=5, smooth=False), "Jaw", col["horn"])
        # The horns: the one feature that names the demon (design 5.2), swept out, up and forward
        # from the crown, faceted, with the tips over the shoulders
        add(
            add_curved_tube(
                f"dem_horn_{tag}", None, horn,
                [(side * 0.11, 2.13, -0.26, 0.075), (side * 0.30, 2.22, -0.20, 0.062), (side * 0.46, 2.30, -0.14, 0.046),
                 (side * 0.56, 2.33, -0.22, 0.03), (side * 0.60, 2.31, -0.34, 0.012)],
                segs=6, smooth=False,
            ),
            "HeadGroup", col["horn"], planes=True,
        )

    # Wings, raised from the middle of the back: the arm and three fingers are struts, the membrane
    # lies between them. Each wing is rigid on its bone, so it beats as one plate.
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        root, wrist = Vector(j[f"{tag}Wing"]), Vector((side * 0.62, 2.18, 0.46))
        tips = [Vector((side * 1.40, 2.26, 0.50)), Vector((side * 1.46, 1.62, 0.62)), Vector((side * 1.02, 1.06, 0.56))]
        flank = Vector((side * 0.20, 1.22, 0.27))
        sunk = root - (wrist - root).normalized() * 0.08  # the arm starts inside the back
        add(add_limb_tube(f"dem_wing_arm_{tag}", None, skin, tuple(sunk), tuple(wrist), 0.075, 0.05, segs=6, steps=3, smooth=False), f"{tag}Wing", col["hide_dark"], planes=True)
        for k, tip in enumerate(tips):
            add(
                add_limb_tube(f"dem_wing_finger_{tag}_{k}", None, skin, tuple(wrist), tuple(tip), 0.045, 0.022, r_mid=0.034, segs=5, steps=3, smooth=False),
                f"{tag}Wing", col["hide_dark"], planes=True,
            )
        add(
            add_cone_spike(f"dem_wing_claw_{tag}", None, horn, base_r=0.04, length=0.14, tx=wrist.x, ty=wrist.y + 0.03, tz=wrist.z, segs=5, smooth=False, **aim((side * 0.30, 0.90, -0.30))),
            f"{tag}Wing", col["horn"], planes=True,
        )
        # The dragon's membrane, every vertex then held by the one wing bone
        m = _dragon_membrane(
            f"dem_membrane_{tag}", wing, root, wrist, tips, flank,
            (f"lesser_demon_{tag}Wing", f"lesser_demon_{tag}Wing_tip", "lesser_demon_Torso"),
        )
        add(m, f"{tag}Wing", col["membrane"], planes=True)

    # Claws: three on each fist, on the hand bone
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        h = Vector(j[f"{tag}Hand"])
        d = (h - Vector(j[f"{tag}ElbowPivot"])).normalized()
        for k, dx in enumerate((-0.05, 0.0, 0.05)):
            at = h + d * 0.09 + Vector((side * 0.02, 0.0, dx - 0.04))  # rooted inside the fist
            add(add_cone_spike(f"dem_claw_{tag}_{k}", None, horn, base_r=0.03, length=0.10, tx=at.x, ty=at.y, tz=at.z, segs=5, smooth=False, **aim(d)), f"{tag}Hand", col["horn"])
    # The tail ends in a flat spade, turned up
    add(
        add_cone_spike("dem_tail_spade", None, horn, base_r=0.09, length=0.22, tx=0.0, ty=0.82, tz=1.22, segs=4, flatten_x=2.4, smooth=False, **aim((0.0, 0.6, 0.8))),
        "TailPivot2", col["horn"], planes=True,
    )
    # A short loincloth front and back, on the hips (never on the legs)
    for name, tz, rx in (("dem_cloth_front", -0.17, -0.12), ("dem_cloth_back", 0.27, 0.12)):
        flap = add_box(name, None, wing, 0.26, 0.26, 0.04, tx=0.0, ty=0.86, tz=tz, rx=rx, bevel=0.0)
        heights = [v.co.z for v in flap.data.vertices]
        for v in flap.data.vertices:
            v.co.x *= 0.6 + 0.4 * (v.co.z - min(heights)) / (max(heights) - min(heights))
        add(flap, "Hips", col["grip"])

    # The cleaver in the right fist, held low and forward, outside the body outline: a grip through
    # the fist, a heavy blade, and the glowing edge along its bottom
    hand = Vector(j["RightHand"])
    fwd = Vector((0.10, -0.20, -1.0)).normalized()
    add(add_limb_tube("dem_cleaver_grip", None, horn, tuple(hand - fwd * 0.14), tuple(hand + fwd * 0.20), 0.034, 0.034, r_mid=0.034, segs=6, steps=2, smooth=False), "WeaponPivot", col["grip"])
    tilt = math.asin(-fwd.y)  # the blade lies along fwd: its length is the box's z
    centre = hand + fwd * 0.56 + Vector((0.0, -0.06, 0.0))
    add(add_box("dem_cleaver_blade", None, horn, 0.05, 0.30, 0.72, tx=centre.x, ty=centre.y, tz=centre.z, rx=-tilt, ry=math.atan2(-fwd.x, -fwd.z), bevel=0.0), "WeaponPivot", col["blade"], planes=True)
    edge = centre + Vector((0.0, -0.155 * math.cos(tilt), 0.155 * math.sin(tilt)))
    add(add_box("dem_cleaver_edge", None, glow, 0.06, 0.04, 0.70, tx=edge.x, ty=edge.y, tz=edge.z, rx=-tilt, ry=math.atan2(-fwd.x, -fwd.z), bevel=0.0), "WeaponPivot", 0xFFFFFF)

    # Body: what is left of the triangle budget
    hard_tris = sum(len(p.vertices) - 2 for obj, _ in hard for p in obj.data.polygons)
    body_tris = DEMON_TRIANGLES - 40 - hard_tris
    pts, edges, radii, keep = _demon_body_graph(j)
    body = _goblin_skin(
        figkit.organic_body((pts, edges), radii, DEMON_VOXEL, 10**9), "dem_body", skin, body_tris, soften=14, keep=tuple(keep), crease=GOBLIN_CREASE
    )

    rig = figkit.make_rig("Monster_lesser_demon", rigs.BIPED_TABLE, {k: t2b(*p) for k, p in j.items()}, prefix="lesser_demon")

    # Weight rule 1: the body takes automatic weights from the limb, spine and tail bones only. The
    # jaw, the weapon mount and the wing bones hold rigid parts, and a Root standing from the ground
    # to the hips would take the inner legs, so the weighting rig leaves them out and starts Root
    # inside the pelvis.
    core = {k: t2b(*p) for k, p in j.items() if k not in ("Jaw", "WeaponPivot", "LWing", "RWing")}
    core["Root"] = t2b(0.0, 0.96, 0.06)
    weight_rig = figkit.make_rig("lesser_demon_weight_rig", rigs.BIPED_TABLE, core, prefix="lesser_demon")
    figkit.auto_weights(body, weight_rig, limb_radius=0.16)
    # Weight rule 2: Root deforms nothing; its share goes to Hips.
    figkit.fold_weights(
        body,
        {b.name: ([b.name, "lesser_demon_Root"] if b.name == "lesser_demon_Hips" else [b.name]) for b in weight_rig.data.bones if b.name != "lesser_demon_Root"},
    )
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    weight_data = weight_rig.data
    bpy.data.objects.remove(weight_rig, do_unlink=True)
    bpy.data.armatures.remove(weight_data)
    _goblin_body_tint(body, col["hide"], col["hide_dark"])

    # Weight rule 3: every other part is rigid on one bone.
    for obj, bone in hard:
        figkit.hard_weights(obj, bone)
    for obj in [body] + [obj for obj, _ in hard]:
        obj.parent = rig

    merged = figkit.merge_by_family(rig)
    names = {"skin": "lesser_demon_body", "leather": "lesser_demon_membrane", "plain": "lesser_demon_horn", "glow": "lesser_demon_embers"}
    for ob in merged:
        ob.name = ob.data.name = names[figkit.get_material_family(ob)]
    _figure_paint(rig, merged, DEMON_OCCLUSION)

    tris = sum(len(p.vertices) - 2 for ob in merged for p in ob.data.polygons)
    if tris > DEMON_TRIANGLES:
        raise ValueError(f"lesser_demon: {tris} triangles, over the budget of {DEMON_TRIANGLES}")
    cos = [v.co for ob in merged for v in ob.data.vertices]
    size = [max(c[a] for c in cos) - min(c[a] for c in cos) for a in (0, 2, 1)]  # width, height, depth
    print(f"[Blender] lesser_demon: {tris} triangles in {len(merged)} meshes; width {size[0]:.3f}, height {size[1]:.3f}, depth {size[2]:.3f}; lowest {min(c.z for c in cos):.4f}")
    if abs(size[1] / DEMON_HEIGHT - 1.0) > 0.05:
        raise ValueError(f"lesser_demon: height {size[1]:.3f} is more than 5% from the shipped demon's {DEMON_HEIGHT}")
    return rig


# =============================================================================
# 10. Monster_elvarg_dragon (Elvarg the Crag Dragon): a new model, skinned on the dragon rig (plan D2)
# =============================================================================
# An original dragon on the pilot's pattern (docs/superpowers/baseline/models/README.md): a low,
# heavy-shouldered body from figkit.organic_body, a wedge head with a jaw, horns swept back (one
# broken), crag plates down the spine, wings held up with the membrane as its own material, a spade
# on the tail. Coordinates are three-space like the rest of this file (+Y up, -Z forward). The
# figure stands at the file's origin (design 6.1.1 rule 2b).
DRAGON_TRIANGLES = 10000  # the builder's own budget, under the manifest's 14,000: what the wire ceiling allows
DRAGON_HEAD_TRIANGLES = 700
DRAGON_VOXEL = 0.05  # the goblin's 0.02 on a body four times the size
DRAGON_OCCLUSION = 0.5  # bake_paint's occlusion strength, as the goblin's
DRAGON_BOUNDS = (10.458, 3.600, 7.101)  # the shipped dragon's width, height and length; the new one stays within 5%
DRAGON_COLOURS = {
    "hide": 0x3F6139,  # crag green, 38% value
    "hide_dark": 0x2E4A2E,  # feet and wing struts, 29% value
    "membrane": 0x80402E,  # 50% value
    "belly": 0x9E8748,  # ochre, 62% value
    "horn": 0xB8AD90,  # horns, plates, claws and teeth, 72% value
    "iris": 0xE6B820,
    "pupil": 0x1E1410,
}
# The engine multiplies the hide by the dragon-scale tile and the membrane by the leather tile
# (blenderMonsters.ts: 'skin' and 'wing' in the material name): each paint is divided by its tile's mean.
DRAGON_SCALE_TILE = "public/textures/creatures/dragon-scale.png"
DRAGON_LEATHER_TILE = "public/textures/leather.png"


def dragon_joints() -> dict:
    """
    Joints of the dragon rig. The bind pose is the stance, each limb within 20 degrees of the dragon
    reference (rigs.DRAGON_TABLE): the spine climbs from low hips to heavy shoulders, the neck rises
    in two bones and levels into the head, the wings are held up and out, the tail runs back and
    down. Root stands on the ground under the hips (the reference wants Root to Hips upright); the
    armature itself is at the origin.
    """
    j = {
        "Root": (0.0, 0.0, 0.95),
        "Hips": (0.0, 1.00, 0.95),
        "Torso": (0.0, 1.36, 0.0),
        "Neck1": (0.0, 1.75, -0.95),
        "Neck2": (0.0, 2.46, -1.50),
        "HeadGroup": (0.0, 2.82, -2.38),
        "Jaw": (0.0, 2.76, -2.62),
        "TailPivot": (0.0, 0.98, 1.60),
        "TailPivot2": (0.0, 0.76, 2.35),
        "TailPivot3": (0.0, 0.56, 3.00),
    }
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        j[f"{tag}ArmPivot"] = (side * 0.80, 1.30, -0.72)
        j[f"{tag}ElbowPivot"] = (side * 1.03, 0.62, -0.66)
        j[f"{tag}LegPivot"] = (side * 0.62, 1.00, 1.02)
        j[f"{tag}KneePivot"] = (side * 0.73, 0.58, 0.95)
        j[f"{tag[0]}Wing"] = (side * 0.42, 1.88, -0.55)
        j[f"{tag[0]}Wing2"] = (side * 2.22, 2.98, -0.45)
    return j


def _dragon_body_graph(j: dict) -> tuple[list, list, list, list, list]:
    """
    The stick graph and radii for figkit.organic_body, the keep balls of the four feet for
    _goblin_skin, and the spine (the nodes from head to tail tip with their half heights, for the
    belly's paint), in Blender space: trunk, neck, tail and legs are one skin. On a level edge a
    radius pair is (half height, half width). Shoulders and haunches are the widest nodes of their
    legs, so they stand outside the trunk.
    """
    pts, radii, edges, keep = [], [], [], []

    def chain(start, nodes):
        prev = start
        for p, r in nodes:
            pts.append(t2b(*p))
            radii.append(r)
            if prev is not None:
                edges.append((prev, len(pts) - 1))
            prev = len(pts) - 1
        return prev

    def along(a, b, t):
        return tuple(Vector(a).lerp(Vector(b), t))

    pelvis = chain(None, [((0.0, 1.02, 0.95), (0.46, 0.50))])
    waist = chain(pelvis, [((0.0, 1.16, 0.30), (0.42, 0.45))])
    chest = chain(waist, [((0.0, 1.27, -0.40), (0.64, 0.72))])
    withers = chain(chest, [((0.0, 1.48, -0.92), (0.58, 0.64))])
    # The neck rises steeply from the withers and levels into the head, where its last node ends inside the skull
    chain(withers, [((0.0, 1.92, -1.20), 0.40), (j["Neck2"], 0.28), ((0.0, 2.72, -1.95), 0.22), ((0.0, 2.82, -2.40), 0.20)])
    chain(pelvis, [(j["TailPivot"], 0.34), (j["TailPivot2"], 0.22), (j["TailPivot3"], 0.13), ((0.0, 0.50, 3.28), 0.08)])
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        shoulder, elbow = j[f"{tag}ArmPivot"], j[f"{tag}ElbowPivot"]
        chain(withers, [
            (shoulder, 0.42),
            # The arm stands clear of the chest below the shoulder: an elbow against the ribs seals a pocket in the skin
            (along(shoulder, elbow, 0.55), 0.24),
            (elbow, 0.24),
            ((side * 1.05, 0.34, -0.78), 0.18),
            # The foot: one flat slab, heel to toe box, reaching under the ground where _goblin_skin cuts it flat
            ((side * 1.06, 0.10, -0.86), (0.10, 0.22)),
            ((side * 1.08, 0.10, -1.20), (0.10, 0.29)),
        ])
        keep.append((Vector(t2b(side * 1.07, 0.08, -1.03)), 0.40))
        hip, knee = j[f"{tag}LegPivot"], j[f"{tag}KneePivot"]
        chain(pelvis, [
            (hip, 0.44),
            (along(hip, knee, 0.6), 0.28),
            (knee, 0.20),
            ((side * 0.80, 0.42, 1.40), 0.14),  # the hock stands behind the knee
            # The hind foot is low and ends behind the knee: a toe box that reaches the knee leaves a tunnel in the skin
            ((side * 0.80, 0.08, 1.36), (0.08, 0.17)),
            ((side * 0.82, 0.08, 1.04), (0.08, 0.27)),
        ])
        keep.append((Vector(t2b(side * 0.81, 0.08, 1.20)), 0.40))
    spine = [(Vector(p), r if isinstance(r, float) else r[0]) for p, r in zip(pts, radii) if p[0] == 0.0]
    return pts, edges, radii, keep, sorted(spine, key=lambda s: s[0].y)


def _dragon_head(mat):
    """
    The head: a block skull running into a six-sided snout with a flat top, a brow ridge over each
    eye, jowls and nostrils, fused into one form with hard edges round its planes. It is built of
    flat-sided parts and softened once, so the planes are chosen ones (a head of spheres came out a
    smooth lump).
    """
    parts = [
        add_box("drg_skull", None, mat, 0.58, 0.40, 0.64, tx=0.0, ty=2.88, tz=-2.60, rx=-0.12, bevel=0.0),
        add_curved_tube(
            "drg_snout", None, mat,
            [(0.0, 2.86, -2.78, 0.27, 0.18), (0.0, 2.79, -3.10, 0.21, 0.14), (0.0, 2.70, -3.42, 0.15, 0.10), (0.0, 2.67, -3.53, 0.11, 0.08)],
            segs=6, smooth=False,
        ),
    ]
    for side in (-1.0, 1.0):
        # The brow: a four-sided ridge over the eye that runs down into the snout
        parts.append(add_curved_tube(
            "drg_brow", None, mat,
            [(side * 0.21, 3.05, -2.34, 0.11, 0.07), (side * 0.25, 3.08, -2.72, 0.11, 0.08), (side * 0.15, 2.95, -3.08, 0.06, 0.05)],
            segs=4, smooth=False,
        ))
        parts.append(add_box("drg_jowl", None, mat, 0.16, 0.24, 0.36, tx=side * 0.29, ty=2.79, tz=-2.52, bevel=0.0))
        parts.append(add_box("drg_nostril", None, mat, 0.10, 0.07, 0.12, tx=side * 0.085, ty=2.78, tz=-3.44, rx=-0.25, bevel=0.0))
    return _goblin_fuse(parts, "drg_head", mat, 0.025, DRAGON_HEAD_TRIANGLES, soften=1, crease=GOBLIN_CREASE)


def _dragon_body_tint(body, spine: list, hide: list, dark: list, belly: list, tones3: tuple = (GOBLIN_PLANE_TONE,) * 3) -> None:
    """
    Paint rule of the body: one band of belly from the throat to the tail's tip (the faces under the
    spine's line that do not look up, within three quarters of the spine's half height of the
    midline), the dark tone on the feet, hide on the rest; each times its plane's tone. The edges
    round the belly and round the feet are made hard first, so the colour changes only where the
    exporter splits a vertex anyway and each patch is a plane of its own.
    """
    def under_spine(c) -> bool:
        for (a, ra), (b, rb) in zip(spine, spine[1:]):
            if a.y <= c.y <= b.y:
                t = (c.y - a.y) / (b.y - a.y)
                r = ra + (rb - ra) * t
                return abs(c.x) < 0.75 * r and c.z < a.z + (b.z - a.z) * t - 0.35 * r
        return False

    polys = body.data.polygons
    kind = [2 if p.center.z < 0.16 else 1 if p.normal.z < -0.15 and under_spine(p.center) else 0 for p in polys]
    bm = bmesh.new()
    bm.from_mesh(body.data)
    for e in bm.edges:
        if kind[e.link_faces[0].index] != kind[e.link_faces[1].index]:
            e.smooth = False
    bm.to_mesh(body.data)
    bm.free()
    by_tone = {t: _goblin_plane_tones(body, t) for t in set(tones3)}  # tones3: the plane tone of hide, belly and dark
    cols = []
    for i, (p, k) in enumerate(zip(polys, kind)):
        cols += [*(c * by_tone[tones3[k]][i] for c in (hide, belly, dark)[k]), 1.0] * len(p.vertices)
    body.data.color_attributes.new("Tint", "FLOAT_COLOR", "CORNER").data.foreach_set("color", cols)
    print(f"[Blender] dragon body faces: {kind.count(1)} belly, {kind.count(2)} foot, of {len(kind)}")


def _dragon_membrane(name: str, mat, root: Vector, wrist: Vector, tips: list, flank: Vector, bones: tuple):
    """
    One wing's membrane: a fan of flat panels from the wrist to the three finger tips and the flank,
    and one panel from the wing's root to the wrist and the flank, each trailing edge scalloped
    toward the wrist. It is a closed sheet 0.04 thick, so the outline shell holds on it. Weights are
    by rule (design 6.1.6): what the fingers carry is on the second wing bone, the root on the first,
    the flank on the hips, and a panel's middle is shared between its corners' bones.
    bones is (first wing bone, second wing bone, hips), full names.
    """
    wing1, wing2, hips = bones
    bm = bmesh.new()
    made = {}  # three-space position -> (vertex, weights)

    def vert(p: Vector, weights: dict):
        key = tuple(round(c, 5) for c in p)
        if key not in made:
            made[key] = (bm.verts.new(t2b(*p)), weights)
        return made[key][0]

    sag = Vector((0.0, -0.10, 0.0))
    rim = [(t, {wing2: 1.0}) for t in tips] + [(flank, {hips: 1.0})]
    w = vert(wrist, {wing2: 1.0})
    for (p, wp), (q, wq) in zip(rim, rim[1:]):
        shared = {b: (wp.get(b, 0.0) + wq.get(b, 0.0)) / 2.0 for b in bones}  # in the order of bones: a set's order changes from run to run
        a, b = vert(p, wp), vert(q, wq)
        mid = vert(((p + q) / 2.0).lerp(wrist, 0.20), shared)
        third = {b: (wp.get(b, 0.0) + wq.get(b, 0.0) + (1.0 if b == wing2 else 0.0)) / 3.0 for b in bones}
        centre = vert((wrist + p + q) / 3.0 + sag, third)
        for tri in ((w, a, centre), (a, mid, centre), (mid, b, centre), (b, w, centre)):
            bm.faces.new(tri)
    r, f = vert(root, {wing1: 1.0}), vert(flank, {hips: 1.0})
    centre = vert((root + wrist + flank) / 3.0, {wing1: 0.4, wing2: 0.3, hips: 0.3})
    for tri in ((r, w, centre), (w, f, centre), (f, r, centre)):
        bm.faces.new(tri)
    # The sheet is closed by hand (a second skin 0.04 under the first and a rim between them):
    # bmesh's solidify gave another index order from run to run.
    bm.normal_update()
    rule = [(v.co.copy(), weights) for v, weights in made.values()]
    upper = [tuple(f.verts) for f in bm.faces]
    rim_edges = [(l.vert, l.link_loop_next.vert) for f in bm.faces for l in f.loops if l.edge.is_boundary]
    lower = {v: bm.verts.new(v.co - v.normal * 0.04) for v in list(bm.verts)}
    for a, b, c in upper:
        bm.faces.new((lower[c], lower[b], lower[a]))
    for a, b in rim_edges:
        bm.faces.new((b, a, lower[a], lower[b]))
    ob = finalize_obj(name, bm, None, mat, smooth=False)
    groups = {b: ob.vertex_groups.new(name=b) for b in bones}
    for v in ob.data.vertices:
        co, weights = min(rule, key=lambda item: (item[0] - v.co).length_squared)
        assert (co - v.co).length < 0.05, f"{name}: a membrane vertex is {(co - v.co).length:.3f} from every vertex of the weight rule"
        for b in bones:
            if weights.get(b, 0.0) > 0.0:
                groups[b].add([v.index], weights[b], "REPLACE")
    return ob


def build_elvarg_dragon(grid_pos: tuple[float, float, float], mats: dict):
    # grid_pos is not used: a skinned figure stands at the file's origin (design 6.1.1 rule 2b)
    import rigs  # the dragon table
    from mathutils.bvhtree import BVHTree

    # White, like the goblin's: every colour of the dragon is paint. The names give the engine its
    # families: 'skin' the hide with the dragon-scale tile, 'wing' the membrane (leather, both sides
    # drawn), the horn material plain. The mouth's glow is the file's own mat_glow_orange.
    skin = make_mat("mat_skin_elvarg_dragon_paint", 0xFFFFFF, roughness=0.45, metallic=0.12)
    wing = make_mat("mat_wing_elvarg_dragon_paint", 0xFFFFFF, roughness=0.55, metallic=0.08)
    horn = make_mat("mat_horn_elvarg_dragon_paint", 0xFFFFFF, roughness=0.45, metallic=0.12)
    glow = mats["glow_orange"]
    scale_tile, leather_tile = _goblin_hide_mean(DRAGON_SCALE_TILE), _goblin_hide_mean(DRAGON_LEATHER_TILE)
    col = dict(DRAGON_COLOURS)
    for key, tile in (("hide", scale_tile), ("hide_dark", scale_tile), ("belly", scale_tile), ("membrane", leather_tile)):
        col[key] = _goblin_skin_paint(DRAGON_COLOURS[key], tile)
    j = dragon_joints()
    hard = []  # (object, bone): rigid parts, weight 1 on one bone

    def add(obj, bone: str, colour, planes: bool = False):
        _goblin_tint(obj, colour, planes)
        hard.append((obj, f"elvarg_dragon_{bone}"))

    def aim(d) -> dict:
        """The rx and rz that turn a primitive's own +Y axis to the direction d."""
        d = Vector(d).normalized()
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    # Head and jaw. The jaw hangs open a little in the bind pose, so the glow of the mouth shows
    # between the teeth; it is a faceted wedge in the belly's colour. Eyes are paint on the horn
    # mesh (no mesh name holds 'eye': the engine would draw that whole mesh unlit).
    add(_dragon_head(skin), "HeadGroup", col["hide"], planes=True)
    add(
        add_curved_tube(
            "drg_jaw", None, skin,
            [(0.0, 2.68, -2.50, 0.25, 0.10), (0.0, 2.58, -2.95, 0.21, 0.09), (0.0, 2.46, -3.30, 0.14, 0.07), (0.0, 2.42, -3.46, 0.08, 0.05)],
            segs=6, smooth=False,
        ),
        "Jaw", col["belly"], planes=True,
    )
    add(add_sphere("drg_maw", None, glow, 0.15, 0.04, 0.36, tx=0.0, ty=2.57, tz=-3.05, rx=-0.18, segs=8, rings=5), "HeadGroup", 0xFFFFFF)
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        add(add_sphere(f"drg_iris_{tag}", None, horn, 0.03, 0.05, 0.075, tx=side * 0.285, ty=2.95, tz=-2.76, segs=8, rings=6), "HeadGroup", col["iris"])
        add(add_sphere(f"drg_pupil_{tag}", None, horn, 0.03, 0.048, 0.026, tx=side * 0.30, ty=2.95, tz=-2.77, segs=6, rings=5), "HeadGroup", col["pupil"])
        for k, (tz, tx, ty) in enumerate(((-3.44, 0.085, 2.61), (-3.26, 0.14, 2.64), (-3.06, 0.185, 2.67))):
            add(add_cone_spike(f"drg_fang_{tag}_{k}", None, horn, base_r=0.036, length=0.13, tx=side * tx, ty=ty, tz=tz, rx=math.pi, segs=5), "HeadGroup", col["horn"])
        for k, (tz, tx, ty) in enumerate(((-3.36, 0.10, 2.49), (-3.14, 0.16, 2.56))):
            add(add_cone_spike(f"drg_tusk_{tag}_{k}", None, horn, base_r=0.036, length=0.12, tx=side * tx, ty=ty, tz=tz, segs=5), "Jaw", col["horn"])
        # A small horn on each jowl
        add(
            add_cone_spike(f"drg_cheek_horn_{tag}", None, horn, base_r=0.06, length=0.36, tx=side * 0.30, ty=2.80, tz=-2.46, segs=5, smooth=False, **aim((side * 0.62, 0.12, 0.77))),
            "HeadGroup", col["horn"], planes=True,
        )
    # Two horns swept back from the skull; the left one is broken short (the one asymmetry, design 5.3)
    sweep = Vector((0.22, 0.50, 0.84)).normalized()
    add(
        add_cone_spike("drg_horn_R", None, horn, base_r=0.105, length=0.90, tx=0.17, ty=3.00, tz=-2.36, segs=6, smooth=False, **aim(sweep)),
        "HeadGroup", col["horn"], planes=True,
    )
    stump = Vector((-0.17, 3.00, -2.36))
    sweep.x = -sweep.x
    add(
        add_limb_tube("drg_horn_L", None, horn, tuple(stump), tuple(stump + sweep * 0.40), 0.105, 0.075, r_mid=0.09, segs=6, steps=2, smooth=False),
        "HeadGroup", col["horn"], planes=True,
    )

    # Wings: arm and fingers are rigid struts on the two wing bones, the membrane lies between them
    membranes = []
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        root, wrist = Vector(j[f"{tag}Wing"]), Vector(j[f"{tag}Wing2"])
        tips = [Vector((side * 5.20, 2.55, -0.10)), Vector((side * 4.45, 1.75, 1.15)), Vector((side * 3.05, 1.45, 1.85))]
        flank = Vector((side * 0.35, 1.40, 0.75))
        sunk = root - (wrist - root).normalized() * 0.12  # the arm starts inside the back
        add(add_limb_tube(f"drg_wing_arm_{tag}", None, skin, tuple(sunk), tuple(wrist), 0.17, 0.11, segs=6, steps=3, smooth=False), f"{tag}Wing", col["hide"], planes=True)
        add(add_sphere(f"drg_wing_wrist_{tag}", None, skin, 0.13, tx=wrist.x, ty=wrist.y, tz=wrist.z, segs=6, rings=4, smooth=False), f"{tag}Wing2", col["hide_dark"], planes=True)
        for k, tip in enumerate(tips):
            add(
                add_limb_tube(f"drg_wing_finger_{tag}_{k}", None, skin, tuple(wrist), tuple(tip), 0.085, 0.035, r_mid=0.06, segs=5, steps=3, smooth=False),
                f"{tag}Wing2", col["hide_dark"], planes=True,
            )
        # The wrist's claw stands up to the shipped dragon's height
        add(
            add_cone_spike(f"drg_wing_claw_{tag}", None, horn, base_r=0.07, length=0.58, tx=wrist.x, ty=wrist.y + 0.08, tz=wrist.z, segs=5, smooth=False, **aim((side * 0.10, 0.93, -0.35))),
            f"{tag}Wing2", col["horn"], planes=True,
        )
        m = _dragon_membrane(
            f"drg_membrane_{tag}", wing, root, wrist, tips, flank,
            (f"elvarg_dragon_{tag}Wing", f"elvarg_dragon_{tag}Wing2", "elvarg_dragon_Hips"),
        )
        _goblin_tint(m, col["membrane"], planes=True)
        membranes.append(m)

    # Claws: three on each foot, on the bone that holds the lower leg
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        for bone, x, z in ((f"{tag}ElbowPivot", 1.08, -1.22), (f"{tag}KneePivot", 0.82, 1.02)):
            for k, dx in enumerate((-0.15, 0.0, 0.15)):
                add(
                    add_cone_spike(f"drg_claw_{bone}_{k}", None, horn, base_r=0.07, length=0.26, tx=side * x + dx, ty=0.10, tz=z, segs=5, smooth=False, **aim((dx * 0.8, -0.12, -1.0))),
                    bone, col["horn"], planes=True,
                )
    # The tail ends in a flat spade
    add(
        add_cone_spike("drg_tail_blade", None, horn, base_r=0.10, length=0.40, tx=0.0, ty=0.50, tz=3.15, segs=4, flatten_x=2.6, smooth=False, **aim((0.0, -0.10, 1.0))),
        "TailPivot3", col["horn"], planes=True,
    )

    # Body: what is left of the triangle budget after the rigid parts and the twelve spine plates
    plates = [  # (z along the spine, half length, height)
        (-2.05, 0.16, 0.30), (-1.72, 0.19, 0.36), (-1.36, 0.22, 0.42), (-0.98, 0.25, 0.50), (-0.50, 0.26, 0.52), (-0.02, 0.24, 0.46),
        (0.45, 0.22, 0.42), (0.90, 0.21, 0.40), (1.38, 0.19, 0.36), (1.85, 0.16, 0.30), (2.30, 0.13, 0.25), (2.72, 0.10, 0.20),
    ]
    hard_tris = sum(len(p.vertices) - 2 for obj in [obj for obj, _ in hard] + membranes for p in obj.data.polygons)
    body_tris = DRAGON_TRIANGLES - 40 - hard_tris - len(plates) * 48
    pts, edges, radii, keep, spine_line = _dragon_body_graph(j)
    body = _goblin_skin(
        figkit.organic_body((pts, edges), radii, DRAGON_VOXEL, 10**9), "drg_body", skin, body_tris, soften=14, keep=tuple(keep), crease=GOBLIN_CREASE
    )

    # Crag plates stand on the finished back: a ray from above finds the spine's surface, and each
    # plate is a four-sided blade leaning back, rigid on the spine bone under it
    tree = BVHTree.FromPolygons([v.co for v in body.data.vertices], [tuple(p.vertices) for p in body.data.polygons])
    spine = [("Neck2", j["Neck2"][2]), ("Neck1", j["Neck1"][2]), ("Torso", j["Torso"][2]), ("Hips", j["TailPivot"][2]),
             ("TailPivot", j["TailPivot2"][2]), ("TailPivot2", j["TailPivot3"][2]), ("TailPivot3", 99.0)]
    for k, (z, half, height) in enumerate(plates):
        hit = tree.ray_cast(Vector(t2b(0.0, 10.0, z)), Vector((0.0, 0.0, -1.0)))[0]
        if hit is None:
            raise ValueError(f"dragon: no back under the spine plate at z {z}")
        add(
            add_cone_spike(f"drg_plate_{k}", None, horn, base_r=half, length=height + 0.06, tx=0.0, ty=hit.z - 0.06, tz=z, rx=0.45, segs=4, flatten_x=0.35, smooth=False),
            next(bone for bone, end in spine if z < end), col["horn"], planes=True,
        )

    rig = figkit.make_rig("Monster_elvarg_dragon", rigs.DRAGON_TABLE, {k: t2b(*p) for k, p in j.items()}, prefix="elvarg_dragon")

    # Weight rule 1: the body takes automatic weights from a second rig whose Root, jaw and wing
    # bones lie inside the body (a wing arm standing in the air gives the heat solver nothing to find).
    core = dict(j, Root=(0.0, 0.90, 0.95))
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        core[f"{tag}Wing"], core[f"{tag}Wing2"] = (side * 0.10, 1.50, -0.55), (side * 0.40, 1.68, -0.55)
    weight_rig = figkit.make_rig("elvarg_dragon_weight_rig", rigs.DRAGON_TABLE, {k: t2b(*p) for k, p in core.items()}, prefix="elvarg_dragon")
    figkit.auto_weights(body, weight_rig, limb_radius=0.35)
    # Weight rule 2: Root, the jaw and the wing bones deform no skin; their shares go to hips, head and torso.
    fold = {"Root": "Hips", "Jaw": "HeadGroup", "LWing": "Torso", "LWing2": "Torso", "RWing": "Torso", "RWing2": "Torso"}
    mapping = {}
    for b in weight_rig.data.bones:
        bone = b.name[len("elvarg_dragon_"):]
        mapping.setdefault(f"elvarg_dragon_{fold.get(bone, bone)}", []).append(b.name)
    figkit.fold_weights(body, mapping)
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    weight_data = weight_rig.data
    bpy.data.objects.remove(weight_rig, do_unlink=True)
    bpy.data.armatures.remove(weight_data)
    _dragon_body_tint(body, spine_line, col["hide"], col["hide_dark"], col["belly"])

    # Weight rule 3: every other part is rigid on one bone (the membranes carry their own rule).
    for obj, bone in hard:
        figkit.hard_weights(obj, bone)
    for obj in [body] + membranes + [obj for obj, _ in hard]:
        obj.parent = rig

    merged = figkit.merge_by_family(rig)
    names = {"skin": "elvarg_dragon_body", "leather": "elvarg_dragon_membrane", "plain": "elvarg_dragon_horn", "glow": "elvarg_dragon_maw"}
    for ob in merged:
        ob.name = ob.data.name = names[figkit.get_material_family(ob)]
    _figure_paint(rig, merged, DRAGON_OCCLUSION)

    tris = sum(len(p.vertices) - 2 for ob in merged for p in ob.data.polygons)
    if tris > DRAGON_TRIANGLES:
        raise ValueError(f"dragon: {tris} triangles, over the budget of {DRAGON_TRIANGLES}")
    cos = [v.co for ob in merged for v in ob.data.vertices]
    size = [max(c[a] for c in cos) - min(c[a] for c in cos) for a in (0, 2, 1)]  # width, height, length
    print(f"[Blender] dragon: {tris} triangles in {len(merged)} meshes; width {size[0]:.3f}, height {size[1]:.3f}, length {size[2]:.3f}; lowest {min(c.z for c in cos):.4f}")
    for got, shipped, what in zip(size, DRAGON_BOUNDS, ("width", "height", "length")):
        if abs(got / shipped - 1.0) > 0.05:
            raise ValueError(f"dragon: {what} {got:.3f} is more than 5% from the shipped dragon's {shipped}")
    build_dragon_library(rig, merged)
    return rig


# =============================================================================
# The dragon library (plan D2b, design 6.5): Idle, Walk, Bite, WingBuffet, Death on the dragon's bones
# =============================================================================
# Pose tables on the hero's twelve-a-second grid (build_hero.pose_table), rotation only, plus the
# measured Hips height that holds the lowest point of the body on the ground. Every rotation is a
# three-space Euler triple in three's YZX order, local to the bone's parent (every rest rotation is
# identity, so a bone's axes are the figure's). The figure faces -z: +x lifts a forward bone (neck,
# head, tail tip goes down) and swings a hanging leg forward; -x opens the jaw and folds a hock back,
# and +x lifts a fore foot (the lower fore leg slants forward, so folding it back would dig it in); -z raises the left wing and +z the right; +y sweeps the left wing back, -y the right.
# Bite and WingBuffet share the anticipation key (frame 8), so the motion row's one anticipation time
# holds for either attack clip.
DRAGON_ANTICIPATION_FRAME = 8
DRAGON_BONES = (
    "Hips", "Torso", "Neck1", "Neck2", "HeadGroup", "Jaw",
    "LeftArmPivot", "LeftElbowPivot", "RightArmPivot", "RightElbowPivot",
    "LeftLegPivot", "LeftKneePivot", "RightLegPivot", "RightKneePivot",
    "LWing", "LWing2", "RWing", "RWing2", "TailPivot", "TailPivot2", "TailPivot3",
)


def _dragon_clip_tables(pose_table):
    Z = (0.0, 0.0, 0.0)
    rest = {b: Z for b in DRAGON_BONES}

    def mirror(pose):
        """Left and right swapped: a leg's numbers move to the other side; y and z change sign."""
        out = {}
        for b, (x, y, z) in pose.items():
            o = b.replace("Left", "#").replace("Right", "Left").replace("#", "Right")
            if o == b:
                o = b.replace("LWing", "#").replace("RWing", "LWing").replace("#", "RWing")
            out[o] = (x, -y, -z)
        return out

    # Idle: a slow breath through neck, jaw and wings; the tail and head sway out of phase.
    idle_a = {"Neck1": (-0.03, 0.0, 0.0), "Neck2": (0.04, 0.03, 0.0), "HeadGroup": (0.02, 0.10, 0.0), "Jaw": (-0.04, 0.0, 0.0),
              "Torso": (0.0, 0.0, 0.012), "LWing": (0.0, 0.0, 0.04), "RWing": (0.0, 0.0, -0.04), "LWing2": (0.0, 0.0, 0.03), "RWing2": (0.0, 0.0, -0.03),
              "TailPivot": (0.0, 0.08, 0.0), "TailPivot2": (0.0, 0.05, 0.0), "TailPivot3": (0.0, 0.02, 0.0)}
    idle_b = {"Neck1": (0.02, 0.0, 0.0), "Neck2": (-0.02, 0.0, 0.0), "HeadGroup": (-0.02, 0.0, 0.0), "Jaw": (-0.10, 0.0, 0.0),
              "LWing": (0.0, 0.0, 0.07), "RWing": (0.0, 0.0, -0.07), "LWing2": (0.0, 0.0, 0.05), "RWing2": (0.0, 0.0, -0.05),
              "TailPivot": (0.0, 0.0, 0.0), "TailPivot2": (0.0, 0.08, 0.0), "TailPivot3": (0.0, 0.10, 0.0)}
    idle_c = dict(mirror(idle_a), Jaw=(-0.04, 0.0, 0.0))
    idle = pose_table("Idle", 48, rest, [
        (0, "rest", {}, "cr"), (12, "breathe in", idle_a, "cr"), (24, "full", idle_b, "cr"),
        (36, "breathe out", idle_c, "cr"), (48, "rest", {}, "cr"),
    ], loop=True)

    # Walk: a diagonal gait (left fore with right hind), front legs 0.40 and hind legs 0.55 so both
    # pairs step about 1.0 a stance; the swinging pair folds elbow and hock to clear the ground.
    reach = {"LeftArmPivot": (0.40, 0.0, 0.0), "RightLegPivot": (0.55, 0.0, 0.0),
             "RightArmPivot": (-0.40, 0.0, 0.0), "RightElbowPivot": (0.10, 0.0, 0.0),
             "LeftLegPivot": (-0.55, 0.0, 0.0), "LeftKneePivot": (-0.20, 0.0, 0.0),
             "Torso": (0.0, -0.03, 0.03), "Hips": (0.0, 0.03, -0.02), "Neck2": (0.0, 0.05, 0.0), "HeadGroup": (0.02, 0.0, 0.0),
             "TailPivot": (0.0, -0.10, 0.0), "TailPivot2": (0.0, -0.04, 0.0), "TailPivot3": (0.0, 0.04, 0.0),
             "LWing": (0.0, 0.0, -0.02), "RWing": (0.0, 0.0, 0.02), "Jaw": (-0.04, 0.0, 0.0)}
    passing = {"RightElbowPivot": (0.50, 0.0, 0.0), "RightArmPivot": (0.05, 0.0, 0.0), "LeftKneePivot": (-0.70, 0.0, 0.0), "LeftLegPivot": (0.05, 0.0, 0.0),
               "HeadGroup": (-0.04, 0.0, 0.0), "Neck1": (0.02, 0.0, 0.0), "TailPivot2": (0.0, -0.10, 0.0), "TailPivot3": (0.0, -0.08, 0.0),
               "LWing": (0.0, 0.0, 0.04), "RWing": (0.0, 0.0, -0.04), "LWing2": (0.0, 0.0, 0.03), "RWing2": (0.0, 0.0, -0.03), "Jaw": (-0.04, 0.0, 0.0)}
    walk = pose_table("Walk", 16, rest, [
        (0, "reach", reach, "cr"), (4, "pass", passing, "cr"), (8, "reach other", mirror(reach), "cr"),
        (12, "pass other", mirror(passing), "cr"), (16, "reach", reach, "cr"),
    ], loop=True)

    a = DRAGON_ANTICIPATION_FRAME
    # Bite: the neck rears and the jaw opens with the wings lifted (the telegraph), the head drives
    # down and forward, the jaw snaps shut, the body settles.
    bite = pose_table("Bite", 20, rest, [
        (0, "rest", {}, "io"),
        (a, "rear", {"Neck1": (0.30, 0.0, 0.0), "Neck2": (0.18, 0.0, 0.0), "HeadGroup": (0.10, 0.0, 0.0), "Jaw": (-0.45, 0.0, 0.0),
                     "LWing": (0.0, 0.0, -0.22), "RWing": (0.0, 0.0, 0.22), "LWing2": (0.0, 0.0, -0.12), "RWing2": (0.0, 0.0, 0.12),
                     "LeftArmPivot": (-0.06, 0.0, 0.0), "RightArmPivot": (-0.06, 0.0, 0.0), "TailPivot": (-0.12, 0.0, 0.0), "TailPivot2": (-0.06, 0.0, 0.0)}, "io"),
        (12, "strike", {"Neck1": (-0.32, 0.0, 0.0), "Neck2": (-0.28, 0.0, 0.0), "HeadGroup": (-0.12, 0.0, 0.0), "Jaw": (-0.55, 0.0, 0.0),
                        "LWing": (0.0, 0.0, 0.10), "RWing": (0.0, 0.0, -0.10), "LeftArmPivot": (0.10, 0.0, 0.0), "RightArmPivot": (0.10, 0.0, 0.0),
                        "TailPivot": (0.08, 0.0, 0.0), "TailPivot2": (0.04, 0.0, 0.0)}, "in"),
        (14, "snap", {"Neck1": (-0.30, 0.0, 0.0), "Neck2": (-0.22, 0.0, 0.0), "HeadGroup": (-0.18, 0.0, 0.0), "Jaw": (0.02, 0.0, 0.0),
                      "LWing": (0.0, 0.0, 0.08), "RWing": (0.0, 0.0, -0.08), "LeftArmPivot": (0.08, 0.0, 0.0), "RightArmPivot": (0.08, 0.0, 0.0),
                      "TailPivot": (0.06, 0.0, 0.0)}, "out"),
        (20, "settle", {}, "io"),
    ])

    # WingBuffet: the raised pose Stage 4's wind-up showed, now a motion: wings up and back, then one
    # beat down and forward, kept above the ground (the tips stay clear, or the ground lock would lift
    # the body), and the follow-through.
    buffet = pose_table("WingBuffet", 24, rest, [
        (0, "rest", {}, "io"),
        (a, "raise", {"LWing": (0.0, 0.20, -0.60), "RWing": (0.0, -0.20, 0.60), "LWing2": (0.0, 0.0, -0.35), "RWing2": (0.0, 0.0, 0.35),
                      "Neck1": (0.22, 0.0, 0.0), "Neck2": (0.10, 0.0, 0.0), "HeadGroup": (0.08, 0.0, 0.0), "Jaw": (-0.25, 0.0, 0.0),
                      "LeftArmPivot": (-0.08, 0.0, 0.0), "RightArmPivot": (-0.08, 0.0, 0.0), "TailPivot": (-0.10, 0.0, 0.0)}, "io"),
        (12, "beat", {"LWing": (0.0, -0.30, 0.18), "RWing": (0.0, 0.30, -0.18), "LWing2": (0.0, 0.0, 0.12), "RWing2": (0.0, 0.0, -0.12),
                      "Neck1": (-0.12, 0.0, 0.0), "Neck2": (-0.10, 0.0, 0.0), "HeadGroup": (-0.05, 0.0, 0.0), "Jaw": (-0.40, 0.0, 0.0),
                      "LeftArmPivot": (0.06, 0.0, 0.0), "RightArmPivot": (0.06, 0.0, 0.0), "TailPivot": (0.06, 0.0, 0.0)}, "in"),
        (16, "follow", {"LWing": (0.0, -0.20, 0.12), "RWing": (0.0, 0.20, -0.12), "LWing2": (0.0, 0.0, 0.08), "RWing2": (0.0, 0.0, -0.08),
                        "Neck1": (-0.08, 0.0, 0.0), "Neck2": (-0.05, 0.0, 0.0), "Jaw": (-0.20, 0.0, 0.0)}, "out"),
        (24, "settle", {}, "io"),
    ])

    # Death: a recoil, the legs buckle, the body falls onto its belly rolled a little to the left with
    # the legs splayed, neck and head down on the ground, wings folded back along the body.
    fall = {"LeftArmPivot": (0.35, 0.0, -0.95), "RightArmPivot": (0.35, 0.0, 0.85), "LeftElbowPivot": (0.80, 0.0, 0.0), "RightElbowPivot": (0.70, 0.0, 0.0),
            "LeftLegPivot": (0.45, 0.0, -0.85), "RightLegPivot": (0.40, 0.0, 0.80), "LeftKneePivot": (-1.20, 0.0, 0.0), "RightKneePivot": (-1.10, 0.0, 0.0),
            "Hips": (-0.04, 0.0, 0.16), "Neck1": (-0.35, 0.0, 0.0), "Neck2": (-0.25, 0.20, 0.0), "HeadGroup": (-0.15, 0.35, 0.15), "Jaw": (-0.35, 0.0, 0.0),
            "LWing": (0.0, 0.50, 0.10), "LWing2": (0.0, 0.40, 0.15), "RWing": (0.0, -0.50, -0.10), "RWing2": (0.0, -0.40, -0.15),
            "TailPivot": (0.15, 0.25, 0.0), "TailPivot2": (0.10, 0.25, 0.0), "TailPivot3": (0.05, 0.20, 0.0)}
    death = pose_table("Death", 26, rest, [
        (0, "rest", {}, "io"),
        (6, "recoil", {"Neck1": (0.25, 0.0, 0.0), "Neck2": (0.15, 0.0, 0.0), "HeadGroup": (0.20, 0.0, 0.0), "Jaw": (-0.50, 0.0, 0.0),
                       "LWing": (0.0, 0.0, -0.25), "RWing": (0.0, 0.0, 0.25), "TailPivot": (-0.15, 0.0, 0.0), "Hips": (0.04, 0.0, 0.0)}, "out"),
        (12, "buckle", {"LeftArmPivot": (0.25, 0.0, 0.0), "RightArmPivot": (0.25, 0.0, 0.0), "LeftElbowPivot": (0.35, 0.0, 0.0), "RightElbowPivot": (0.30, 0.0, 0.0),
                        "LeftLegPivot": (0.35, 0.0, 0.0), "RightLegPivot": (0.35, 0.0, 0.0), "LeftKneePivot": (-0.70, 0.0, 0.0), "RightKneePivot": (-0.70, 0.0, 0.0),
                        "Hips": (0.0, 0.0, 0.06), "Neck1": (-0.10, 0.0, 0.0), "Neck2": (-0.15, 0.0, 0.0), "HeadGroup": (-0.10, 0.0, 0.0), "Jaw": (-0.30, 0.0, 0.0),
                        "LWing": (0.0, 0.0, 0.05), "RWing": (0.0, 0.0, -0.05)}, "io"),
        (20, "fall", fall, "in"),
        (24, "bounce", dict(fall, Hips=(-0.04, 0.0, 0.14), Neck1=(-0.30, 0.0, 0.0), HeadGroup=(-0.10, 0.35, 0.15)), "out"),
        (26, "still", dict(fall, Neck1=(-0.36, 0.0, 0.0), HeadGroup=(-0.18, 0.38, 0.18), Jaw=(-0.25, 0.0, 0.0)), "io"),
    ])
    return [("Idle", idle, 48, True), ("Walk", walk, 16, True), ("Bite", bite, 20, False),
            ("WingBuffet", buffet, 24, False), ("Death", death, 26, False)]


def build_dragon_library(rig, meshes, prefix="elvarg_dragon_", tables=_dragon_clip_tables, label="dragon", clip_prefix=""):
    """
    Keys the five clips on the dragon's armature, one NLA track each. The scorpion's library (plan M3b)
    goes through here too, with its own bones, tables and label: a clip whose name the dragon's library
    already holds (Idle, Walk, Death) carries `clip_prefix`, since the file's animation names must be
    unique; the engine strips it again (attachMonsterGltfAnimator). Frames 0 to the clip's last key
    are keyed (a one-shot ends on its settle or held pose, a loop's last frame repeats its first). The
    Hips height is measured per frame so the posed body's lowest point is on the ground; loops are
    smoothed round the cycle and may let a foot 0.01 into the ground, as the hero's Walk.
    """
    import build_hero  # the pose-table sampler, its eases and the lowest-point probe (H4)

    hips = rig.pose.bones[prefix + "Hips"]
    taken = {n for n, *_ in _dragon_clip_tables(build_hero.pose_table)} if clip_prefix else set()
    for name, sample, frames, loop in tables(build_hero.pose_table):
        if name in taken:
            name = clip_prefix + name
        rig.animation_data_create()
        action = bpy.data.actions.new(name=name)
        rig.animation_data.action = action
        last = frames  # loops and one-shots alike key their last key's frame
        poses = [sample(f / float(frames)) for f in range(last + 1)]
        for f, pose in enumerate(poses):
            for b, value in pose.items():
                pb = rig.pose.bones[prefix + b]
                pb.rotation_mode = "QUATERNION"
                pb.rotation_quaternion = Euler(value, "XZY").to_quaternion()
                pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
            hips.location = Vector()
            hips.keyframe_insert(data_path="location", frame=f)
        earlier = [tr for tr in rig.animation_data.nla_tracks]
        for tr in earlier:
            tr.mute = True
        lock = []
        for f in range(last + 1):
            bpy.context.scene.frame_set(f)
            lock.append(-build_hero._lowest(meshes))
        heights = list(lock)
        if loop:
            n = len(heights) - 1  # the last frame is the first
            ring = heights[:n]
            for _ in range(4):
                ring = [max(lock[i] - build_hero.GROUND_SINK, (ring[i - 1] + 2 * ring[i] + ring[(i + 1) % n]) / 4) for i in range(n)]
            heights = ring + [ring[0]]
        for f, h in enumerate(heights):
            hips.location = Vector((0.0, h, 0.0))
            hips.keyframe_insert(data_path="location", frame=f)
        lows = []
        for f in range(last + 1):
            bpy.context.scene.frame_set(f)
            lo = build_hero._lowest(meshes)
            lows.append(lo)
            held = lo >= -build_hero.GROUND_SINK - build_hero.GROUND_TOL if loop else abs(lo) <= build_hero.GROUND_TOL
            if not held:
                raise ValueError(f"{label} {name} frame {f}: lowest point {lo:+.4f} after the ground lock")
        bpy.context.scene.frame_set(0)
        for tr in earlier:
            tr.mute = False
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, action)
        strip.name = name
        rig.animation_data.action = None
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
            pb.location = Vector()
        keys = ", ".join(f"{n} {k}" for k, n in sample.keys)
        print(f"[Blender] {label} {name}: {last + 1} frames, {last / build_hero.FPS:.4f} s; keys {keys}; "
              f"Hips height {min(heights):+.3f} to {max(heights):+.3f}, lowest point {min(lows):+.3f} to {max(lows):+.3f}")
    bpy.context.view_layer.update()


# =============================================================================
# 11. Monster_ashmantle (Ashmantle the Slag Wyrm): its own body on the dragon skeleton (plan D3)
# =============================================================================
# Design 5.6: a second body on the dragon's bones (ashmantle_<Bone>), at the dragon's joints so the
# dragon's clips, whose Hips track is absolute, play on it unchanged; it has no clips of its own.
# What tells it from the dragon: a heavier chest, a slag crown fused to the skull in place of the
# swept horns, back plates split by glowing seams, a clubbed tail; ash and ember values at least
# 15 points from the dragon's. The engine multiplies Stage 4's tint into every material but the
# glow (blenderMonsters.ts), so each paint is the colour wanted in the game over its tile's mean and
# over the tint.
ASHMANTLE_TRIANGLES = 9600  # the builder's own budget, under the manifest's 12,000: what the wire ceiling allows
ASHMANTLE_TINT = 0x8A8580  # Stage 4's tint on the ashmantle row (src/data/world.ts)
ASHMANTLE_COLOURS = {  # as the game shows them, value against the dragon's (DRAGON_COLOURS)
    "hide": 0x2E2B28,  # charcoal ash, 18%, the floor (dragon 38%)
    "hide_dark": 0x7A756E,  # feet, wing wrists and struts in the pale slag, on the crust material, 48% (dragon 29%)
    "membrane": 0x3A2A24,  # 23% (dragon 50%)
    "belly": 0x5A534B,  # ash grey, 35% (dragon 62%)
    "crust": 0x7A756E,  # crown, plates, club and claws, pale cooled slag, 48% (dragon's horn 72%)
}
# Plane tones (GOBLIN_PLANE_TONE's form): the dark hide and membrane take a wide one, so its lit
# planes stand well clear of its shade planes in the game; belly and crust keep a narrow one, as
# their paint is near the top of what the tile and tint leave.
ASHMANTLE_WIDE_TONE = (-0.40, 0.85)
ASHMANTLE_NARROW_TONE = (-0.25, 0.30)
ASHMANTLE_TONES = {"hide": ASHMANTLE_WIDE_TONE, "hide_dark": ASHMANTLE_NARROW_TONE, "membrane": ASHMANTLE_WIDE_TONE,
                   "belly": ASHMANTLE_NARROW_TONE, "crust": ASHMANTLE_NARROW_TONE}
ASHMANTLE_HEAVY = {  # three-space node of the dragon's stick graph -> radius factor: the heavier chest and neck base
    (0.0, 1.27, -0.40): 1.28,  # chest
    (0.0, 1.48, -0.92): 1.26,  # withers
    (0.0, 1.16, 0.30): 1.06,  # waist
    (0.0, 1.92, -1.20): 1.12,  # neck base
}


def _ashmantle_paint(hex_colour: int, tile: list, tone: tuple) -> list:
    """The paint that shows hex_colour in the game on a mesh the tile and Stage 4's tint multiply."""
    tint = hex_to_rgba(ASHMANTLE_TINT)
    paint = [c / (m * t) for c, m, t in zip(hex_to_rgba(hex_colour), tile, tint)]
    if max(paint) > 1.0 / (1.0 + tone[1]):
        raise ValueError(f"ashmantle: colour {hex_colour:#08x} over its tile and the tint is too light to paint: {paint}")
    return paint


def _ashmantle_feet(body, mat):
    """Splits the body's foot faces (the dragon's foot rule in _dragon_body_tint) off into a mesh of their own on mat."""
    foot = [p.center.z < 0.16 for p in body.data.polygons]
    feet = body.copy()
    feet.data = body.data.copy()
    feet.name = feet.data.name = "ash_feet"
    for c in body.users_collection:
        c.objects.link(feet)
    for ob, keep_feet in ((body, False), (feet, True)):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if foot[f.index] != keep_feet], context="FACES")
        bm.to_mesh(ob.data)
        bm.free()
    feet.data.materials.clear()
    feet.data.materials.append(mat)
    assert feet.data.polygons and body.data.polygons, "ashmantle: the foot rule found no feet, or nothing else"
    return feet


def _ashmantle_body_graph(j: dict) -> tuple[list, list, list, list, list]:
    """The dragon's stick graph with the chest, withers and neck base thickened and a deep brisket under the chest."""
    pts, edges, radii, keep, _ = _dragon_body_graph(j)
    heavy = {Vector(t2b(*p)).freeze(): f for p, f in ASHMANTLE_HEAVY.items()}
    for i, p in enumerate(pts):
        f = heavy.get(Vector(p).freeze())
        if f is not None:
            radii[i] = radii[i] * f if isinstance(radii[i], float) else tuple(r * f for r in radii[i])
    assert sum(Vector(p).freeze() in heavy for p in pts) == len(heavy), "ashmantle: a heavy node is not in the dragon's graph"
    chest = next(i for i, p in enumerate(pts) if Vector(p).freeze() == Vector(t2b(0.0, 1.27, -0.40)).freeze())
    pts.append(t2b(0.0, 1.02, -0.70))  # the brisket: the chest hangs low between the fore legs
    radii.append((0.56, 0.60))
    edges.append((chest, len(pts) - 1))
    spine = [(Vector(p), r if isinstance(r, float) else r[0]) for p, r in zip(pts[:-1], radii) if p[0] == 0.0]
    return pts, edges, radii, keep, sorted(spine, key=lambda s: s[0].y)


def build_ashmantle(mats: dict):
    import rigs  # the dragon table
    from mathutils.bvhtree import BVHTree

    prefix = "ashmantle_"
    skin = make_mat("mat_skin_ashmantle_paint", 0xFFFFFF, roughness=0.55, metallic=0.10)
    wing = make_mat("mat_wing_ashmantle_paint", 0xFFFFFF, roughness=0.60, metallic=0.06)
    crust = make_mat("mat_horn_ashmantle_paint", 0xFFFFFF, roughness=0.70, metallic=0.05)
    glow = mats["glow_orange"]  # the seams, the maw and the eyes: the engine draws it lit and never tints it
    scale_tile, leather_tile = _goblin_hide_mean(DRAGON_SCALE_TILE), _goblin_hide_mean(DRAGON_LEATHER_TILE)
    tiles = {"hide": scale_tile, "hide_dark": [1.0, 1.0, 1.0], "belly": scale_tile, "membrane": leather_tile, "crust": [1.0, 1.0, 1.0]}
    col = {k: _ashmantle_paint(v, tiles[k], ASHMANTLE_TONES[k]) for k, v in ASHMANTLE_COLOURS.items()}
    j = dragon_joints()
    hard = []  # (object, bone): rigid parts, weight 1 on one bone

    def add(obj, bone: str, part: str, planes: bool = False):
        """part is a key of ASHMANTLE_COLOURS (its paint and tone), or 'glow' (white, no planes)."""
        if part == "glow":
            assert not planes, f"ashmantle: {obj.name} on the glow takes no plane tones"
            _goblin_tint(obj, 0xFFFFFF)
        else:
            _goblin_tint(obj, col[part], planes, ASHMANTLE_TONES[part])
        hard.append((obj, prefix + bone))

    def aim(d) -> dict:
        """The rx and rz that turn a primitive's own +Y axis to the direction d."""
        d = Vector(d).normalized()
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    # Head and jaw as the dragon's; the eyes are ember slits on the glow, the maw glows between the teeth
    add(_dragon_head(skin), "HeadGroup", "hide", planes=True)
    add(
        add_curved_tube(
            "ash_jaw", None, skin,
            [(0.0, 2.68, -2.50, 0.25, 0.10), (0.0, 2.58, -2.95, 0.21, 0.09), (0.0, 2.46, -3.30, 0.14, 0.07), (0.0, 2.42, -3.46, 0.08, 0.05)],
            segs=6, smooth=False,
        ),
        "Jaw", "belly", planes=True,
    )
    add(add_sphere("ash_maw", None, glow, 0.15, 0.04, 0.36, tx=0.0, ty=2.57, tz=-3.05, rx=-0.18, segs=8, rings=5), "HeadGroup", "glow")
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        add(add_sphere(f"ash_ember_{tag}", None, glow, 0.03, 0.026, 0.085, tx=side * 0.29, ty=2.95, tz=-2.76, rz=side * 0.3, segs=6, rings=4), "HeadGroup", "glow")
        for k, (tz, tx, ty) in enumerate(((-3.44, 0.085, 2.61), (-3.26, 0.14, 2.64), (-3.06, 0.185, 2.67))):
            add(add_cone_spike(f"ash_fang_{tag}_{k}", None, crust, base_r=0.036, length=0.13, tx=side * tx, ty=ty, tz=tz, rx=math.pi, segs=5), "HeadGroup", "crust")
        for k, (tz, tx, ty) in enumerate(((-3.36, 0.10, 2.49), (-3.14, 0.16, 2.56))):
            add(add_cone_spike(f"ash_tusk_{tag}_{k}", None, crust, base_r=0.036, length=0.12, tx=side * tx, ty=ty, tz=tz, segs=5), "Jaw", "crust")
    # The slag crown: blunt crags rooted inside the skull, tallest at the back, in an arc over the brow
    crown = [  # (x, z, length, base radius, direction)
        (0.0, -2.30, 0.62, 0.17, (0.0, 0.80, 0.60)),
        (0.20, -2.38, 0.52, 0.15, (0.35, 0.80, 0.50)),
        (0.31, -2.58, 0.42, 0.13, (0.65, 0.70, 0.30)),
        (0.27, -2.80, 0.30, 0.11, (0.70, 0.70, 0.0)),
    ]
    for k, (x, z, length, base, d) in enumerate(crown):
        for side in ((1.0,) if x == 0.0 else (-1.0, 1.0)):
            add(
                add_cone_spike(f"ash_crown_{k}", None, crust, base_r=base, length=length + 0.12, tx=side * x, ty=2.96, tz=z, segs=5, smooth=False, **aim((side * d[0], d[1], d[2]))),
                "HeadGroup", "crust", planes=True,
            )

    # Wings: the dragon's struts and membranes, on Ashmantle's bones and in its colours
    membranes = []
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        root, wrist = Vector(j[f"{tag}Wing"]), Vector(j[f"{tag}Wing2"])
        tips = [Vector((side * 5.20, 2.55, -0.10)), Vector((side * 4.45, 1.75, 1.15)), Vector((side * 3.05, 1.45, 1.85))]
        flank = Vector((side * 0.35, 1.40, 0.75))
        sunk = root - (wrist - root).normalized() * 0.12
        add(add_limb_tube(f"ash_wing_arm_{tag}", None, skin, tuple(sunk), tuple(wrist), 0.19, 0.12, segs=6, steps=3, smooth=False), f"{tag}Wing", "hide", planes=True)
        add(add_sphere(f"ash_wing_wrist_{tag}", None, crust, 0.14, tx=wrist.x, ty=wrist.y, tz=wrist.z, segs=6, rings=4, smooth=False), f"{tag}Wing2", "hide_dark", planes=True)
        for k, tip in enumerate(tips):
            add(
                add_limb_tube(f"ash_wing_finger_{tag}_{k}", None, crust, tuple(wrist), tuple(tip), 0.085, 0.035, r_mid=0.06, segs=5, steps=3, smooth=False),
                f"{tag}Wing2", "hide_dark", planes=True,
            )
        add(
            add_cone_spike(f"ash_wing_claw_{tag}", None, crust, base_r=0.08, length=0.58, tx=wrist.x, ty=wrist.y + 0.08, tz=wrist.z, segs=5, smooth=False, **aim((side * 0.10, 0.93, -0.35))),
            f"{tag}Wing2", "crust", planes=True,
        )
        m = _dragon_membrane(f"ash_membrane_{tag}", wing, root, wrist, tips, flank, (f"{prefix}{tag}Wing", f"{prefix}{tag}Wing2", f"{prefix}Hips"))
        _goblin_tint(m, col["membrane"], planes=True, tone=ASHMANTLE_TONES["membrane"])
        membranes.append(m)

    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        for bone, x, z in ((f"{tag}ElbowPivot", 1.08, -1.22), (f"{tag}KneePivot", 0.82, 1.02)):
            for k, dx in enumerate((-0.15, 0.0, 0.15)):
                add(
                    add_cone_spike(f"ash_claw_{bone}_{k}", None, crust, base_r=0.08, length=0.26, tx=side * x + dx, ty=0.10, tz=z, segs=5, smooth=False, **aim((dx * 0.8, -0.12, -1.0))),
                    bone, "crust", planes=True,
                )
    # The club: a faceted knot of slag round the tail's tip, with blunt knobs
    club = Vector((0.0, 0.56, 3.26))
    add(add_sphere("ash_club", None, crust, 0.40, 0.34, 0.44, tx=club.x, ty=club.y, tz=club.z, segs=6, rings=5, smooth=False), "TailPivot3", "crust", planes=True)
    for k, d in enumerate(((0.0, 1.0, 0.2), (1.0, 0.25, 0.1), (-1.0, 0.25, 0.1), (0.0, 0.2, 1.0), (0.7, 0.6, 0.6), (-0.7, 0.6, 0.6))):
        dn = Vector(d).normalized()
        at = club + Vector((dn.x * 0.30, dn.y * 0.24, dn.z * 0.34))
        add(add_cone_spike(f"ash_club_knob_{k}", None, crust, base_r=0.13, length=0.26, tx=at.x, ty=at.y, tz=at.z, segs=4, smooth=False, **aim(d)), "TailPivot3", "crust", planes=True)

    # Body: what is left of the triangle budget after the rigid parts and the back plates (three boxes each)
    plates = [  # (z along the spine, length, height)
        (-1.72, 0.34, 0.48), (-1.30, 0.42, 0.66), (-0.84, 0.48, 0.80), (-0.32, 0.52, 0.86), (0.20, 0.50, 0.78),
        (0.70, 0.46, 0.66), (1.18, 0.40, 0.54), (1.64, 0.34, 0.42), (2.08, 0.28, 0.34), (2.50, 0.22, 0.26),
    ]
    hard_tris = sum(len(p.vertices) - 2 for obj in [obj for obj, _ in hard] + membranes for p in obj.data.polygons)
    body_tris = ASHMANTLE_TRIANGLES - 40 - hard_tris - len(plates) * 3 * 12
    pts, edges, radii, keep, spine_line = _ashmantle_body_graph(j)
    body = _goblin_skin(
        figkit.organic_body((pts, edges), radii, DRAGON_VOXEL, 10**9), "ash_body", skin, body_tris, soften=14, keep=tuple(keep), crease=GOBLIN_CREASE
    )

    # Back plates on the finished back: each is two flat slabs of crust leaning apart over a glowing
    # core that stands a little taller, so the seam glows along the plate's crest and between its halves
    tree = BVHTree.FromPolygons([v.co for v in body.data.vertices], [tuple(p.vertices) for p in body.data.polygons])
    spine = [("Neck2", j["Neck2"][2]), ("Neck1", j["Neck1"][2]), ("Torso", j["Torso"][2]), ("Hips", j["TailPivot"][2]),
             ("TailPivot", j["TailPivot2"][2]), ("TailPivot2", j["TailPivot3"][2]), ("TailPivot3", 99.0)]
    for k, (z, half, height) in enumerate(plates):
        hit = tree.ray_cast(Vector(t2b(0.0, 10.0, z)), Vector((0.0, 0.0, -1.0)))[0]
        if hit is None:
            raise ValueError(f"ashmantle: no back under the back plate at z {z}")
        bone = next(b for b, end in spine if z < end)
        # A box is centred on its point: each stands with its foot 0.10 inside the back
        base = hit.z - 0.10
        add(add_box(f"ash_seam_{k}", None, glow, 0.05, height + 0.08, half * 0.80, tx=0.0, ty=base + (height + 0.08) / 2.0, tz=z, rx=0.25, bevel=0.0), bone, "glow")
        for side in (-1.0, 1.0):
            add(
                add_box(f"ash_plate_{k}", None, crust, 0.07, height, half, tx=side * 0.06, ty=base + height / 2.0, tz=z, rx=0.25, rz=-side * 0.10, bevel=0.0),
                bone, "crust", planes=True,
            )

    rig = figkit.make_rig("Monster_ashmantle", rigs.DRAGON_TABLE, {k: t2b(*p) for k, p in j.items()}, prefix="ashmantle")

    # Weight rules as the dragon's: automatic weights from a second rig whose Root, jaw and wing
    # bones lie inside the body, their shares folded onto hips, head and torso; every part rigid.
    core = dict(j, Root=(0.0, 0.90, 0.95))
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        core[f"{tag}Wing"], core[f"{tag}Wing2"] = (side * 0.10, 1.50, -0.55), (side * 0.40, 1.68, -0.55)
    weight_rig = figkit.make_rig("ashmantle_weight_rig", rigs.DRAGON_TABLE, {k: t2b(*p) for k, p in core.items()}, prefix="ashmantle")
    figkit.auto_weights(body, weight_rig, limb_radius=0.35)
    fold = {"Root": "Hips", "Jaw": "HeadGroup", "LWing": "Torso", "LWing2": "Torso", "RWing": "Torso", "RWing2": "Torso"}
    mapping = {}
    for b in weight_rig.data.bones:
        bone = b.name[len(prefix):]
        mapping.setdefault(prefix + fold.get(bone, bone), []).append(b.name)
    figkit.fold_weights(body, mapping)
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    weight_data = weight_rig.data
    bpy.data.objects.remove(weight_rig, do_unlink=True)
    bpy.data.armatures.remove(weight_data)
    _dragon_body_tint(body, spine_line, col["hide"], col["hide_dark"], col["belly"], tuple(ASHMANTLE_TONES[k] for k in ("hide", "belly", "hide_dark")))
    feet = _ashmantle_feet(body, crust)  # painted for the crust above, so they join the crust mesh

    for obj, bone in hard:
        figkit.hard_weights(obj, bone)
    for obj in [body, feet] + membranes + [obj for obj, _ in hard]:
        obj.parent = rig

    merged = figkit.merge_by_family(rig)
    names = {"skin": "ashmantle_body", "leather": "ashmantle_membrane", "plain": "ashmantle_crust", "glow": "ashmantle_embers"}
    for ob in merged:
        ob.name = ob.data.name = names[figkit.get_material_family(ob)]
    _figure_paint(rig, merged, DRAGON_OCCLUSION)

    tris = sum(len(p.vertices) - 2 for ob in merged for p in ob.data.polygons)
    if tris > ASHMANTLE_TRIANGLES:
        raise ValueError(f"ashmantle: {tris} triangles, over the budget of {ASHMANTLE_TRIANGLES}")
    cos = [v.co for ob in merged for v in ob.data.vertices]
    size = [max(c[a] for c in cos) - min(c[a] for c in cos) for a in (0, 2, 1)]  # width, height, length
    print(f"[Blender] ashmantle: {tris} triangles in {len(merged)} meshes; width {size[0]:.3f}, height {size[1]:.3f}, length {size[2]:.3f}; lowest {min(c.z for c in cos):.4f}")
    # Stage 4 draws it at modelScale 1.2 of the dragon it wore: it stays the dragon's size
    for got, shipped, what in zip(size, DRAGON_BOUNDS, ("width", "height", "length")):
        if abs(got / shipped - 1.0) > 0.05:
            raise ValueError(f"ashmantle: {what} {got:.3f} is more than 5% from the dragon's {shipped}")
    return rig


# =============================================================================
# Studio Showcase Grid, Lighting, Freestyle & Export
# =============================================================================
def setup_studio_and_render(render_path: str | None):
    scene = bpy.context.scene

    world = bpy.data.worlds.new("MonstersStudioWorld")
    scene.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = hex_to_rgba(0x141923)
        bg.inputs["Strength"].default_value = 1.15

    # Showcase Ground Pedestal Slab (only for .blend & studio render; created AFTER glTF export!)
    mat_floor = make_mat("mat_studio_floor", 0x1E2533, roughness=0.75, metallic=0.10)
    add_box("StudioFloor", None, mat_floor, wx=24.0, hy=0.16, dz=16.0, tx=0.0, ty=-0.08, tz=-2.0, bevel=0.04, no_outline=True)

    cam_data = bpy.data.cameras.new("MonstersPreviewCamera")
    cam_data.lens = 31
    cam_obj = bpy.data.objects.new("MonstersPreviewCamera", cam_data)
    # In Blender coords: X is right, Y is back (-Z_three), Z is up (+Y_three)
    cam_obj.location = (0.9, 15.2, 6.2)
    target = Vector((0.8, -1.4, 1.75))
    direction = target - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    def add_light(lname: str, ltype: str, energy: float, hex_c: int, loc: tuple, tgt: tuple = (0.0, -1.5, 1.5)):
        ldata = bpy.data.lights.new(name=lname, type=ltype)
        ldata.energy = energy
        ldata.color = hex_to_rgba(hex_c)[:3]
        if ltype == "AREA":
            ldata.size = 6.0
        lobj = bpy.data.objects.new(name=lname, object_data=ldata)
        lobj.location = loc
        d = Vector(tgt) - Vector(loc)
        lobj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(lobj)
        return lobj

    add_light("KeyLight", "AREA", 2400.0, 0xFFFBEB, (6.5, 9.5, 8.5))
    add_light("FillLight", "AREA", 1400.0, 0x93C5FD, (-7.5, 8.0, 5.5))
    add_light("RimLight", "AREA", 2200.0, 0xF97316, (0.0, -9.5, 7.5))

    scene.render.use_freestyle = False

    if render_path:
        os.makedirs(os.path.dirname(os.path.abspath(render_path)), exist_ok=True)
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 1000
        scene.render.filepath = paths.checked_write(render_path)
        bpy.ops.render.render(write_still=True)
        print(f"[Blender] Rendered monsters preview image: {render_path}")


def main():
    render_path = None
    if "--" in sys.argv:
        extra = sys.argv[sys.argv.index("--") + 1 :]
        if "--render" in extra:
            idx = extra.index("--render")
            if idx + 1 >= len(extra):
                raise SystemExit("--render requires an output path: blender ... -- --render <file.png>")
            render_path = paths.checked_write(extra[idx + 1])

    clear_scene()
    mats = build_materials()

    # Build all 10 Monster species on a 2-row showcase grid (Three.js X, Y=0, Z)
    # Front row (Z = -1.6 -> Blender Y = +1.6, closer to camera at Y = +12.8)
    build_chicken((-5.2, 0.0, -2.0), mats)
    build_goblin((-3.0, 0.0, -2.0), mats)
    build_goblin_archer((-0.8, 0.0, -2.0), mats)
    build_scorpion((1.8, 0.0, -2.0), mats)
    build_saltback_stalker_kit(mats)
    build_dark_wizard((4.4, 0.0, -2.0), mats)
    build_cinder_adept_kit()

    # Back row (Z = +2.4 -> Blender Y = -2.4, behind front row)
    build_dark_ranger((-6.0, 0.0, 2.2), mats)
    build_thornwatch_marksman_kit()
    build_hill_giant((-3.4, 0.0, 2.2), mats)
    build_slag_brute_kit()
    build_moss_guardian((-0.6, 0.0, 2.2), mats)
    build_lesser_demon((2.2, 0.0, 2.2), mats)
    build_elvarg_dragon((6.2, 0.0, 2.6), mats)
    build_ashmantle(mats)

    # Merge-only pass (plan M0): one merge_parts call per Monster_* root, no shape, name or colour change.
    # The chicken's wings are meshes the engine flaps by name (findPivot 'LWing'/'RWing'), so they stay alone.
    keep = re.compile(figkit.TOGGLED.pattern + r"|^chicken_[LR]Wing$")
    for obj in [o for o in bpy.data.objects if o.name.startswith("Monster_") and o.parent is None]:
        figkit.merge_parts(obj, keep=keep)

    blend_path = paths.blend_path("monsters")
    glb_path = paths.glb_path("monsters")

    # Export clean glTF binary before adding studio camera/lights/floor
    bpy.ops.export_scene.gltf(
        filepath=paths.glb_path("monsters"),
        export_format="GLB",
        export_yup=True,
        export_extras=True,
        export_vertex_color="ACTIVE",  # the goblin's paint layer; no other figure has a colour layer (plan S2)
        export_animation_mode="ACTIONS",  # the dragon library (D2b): one animation per NLA track, as the hero's
        export_optimize_animation_keep_anim_armature=False,
    )
    print(f"[Blender] Exported glTF binary: {glb_path}")

    setup_studio_and_render(render_path)
    bpy.ops.wm.save_as_mainfile(filepath=paths.blend_path("monsters"))
    print(f"[Blender] Saved editable source file: {blend_path}")


if __name__ == "__main__":
    main()
