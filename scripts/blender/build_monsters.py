"""
Headless Blender 5.2 generator for the 10 Gielinor Monster species (`monsters.blend` + `monsters.glb`).
Sculpts authentic, high-detail OSRS / RuneScape Dragonwilds stylized monsters:
  1. Monster_chicken          - Plump feathered chicken with serrated red comb, wattle, hooked beak, layered wings, fanned tail & talons
  2. Monster_goblin           - Goblin Raider with hunched muscular torso, leather harness, spiked pauldron, barbed bronze war-spear & buckler
  3. Monster_goblin_archer    - Goblin Archer with stitched hood/cowl (ears poking out), bandolier, quiver of arrows & recurve shortbow
  4. Monster_scorpion         - King Scorpion with 5 segmented carapace plates, 8 multi-jointed arachnid legs, serrated chela pincers & arched stinger tail
  5. Monster_dark_wizard      - Dark Wizard in pleated indigo/purple cultist robes, gold/violet rune stole, crooked pointed hat & orb staff
  6. Monster_dark_ranger      - Dark Ranger in green dragonhide brigandine, spiked pauldrons, shadow cloak, assassin cowl & dark-yew longbow
  7. Monster_hill_giant       - Hill Giant with barrel-chested muscular torso, fur pelt loincloth, skull buckle, braided beard & spiked tree-trunk club
  8. Monster_moss_guardian    - Moss Guardian forest golem of craggy stone & twisted bark, glowing heart-core, mossy boulder pauldrons & branching antlers
  9. Monster_lesser_demon     - Lesser Demon with V-tapered crimson musculature, ram horns, ribbed bat wings, cloven hooves, spade tail & hellfire cleaver
 10. Monster_elvarg_dragon    - Elvarg the Crag Dragon world boss with golden belly scutes, S-curved neck, roaring fanged jaw, 16 dorsal horns, 4.2m wings & spiked tail club
"""

import math
import os
import sys
import bpy
import bmesh
from mathutils import Vector, Euler, Matrix


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
        return None
    try:
        with bpy.data.libraries.load(blend_file) as (df, dt):
            if obj_name in df.objects:
                dt.objects = [obj_name]
            else:
                return None
        if dt.objects:
            obj = dt.objects[0]
            bpy.context.collection.objects.link(obj)
            BLEND_ASSET_CACHE[cache_key] = obj
            return obj
    except Exception as e:
        print(f"[BlendAsset] Error loading {obj_name} from {blend_file}: {e}")
        return None
    return None


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
        "skin_lesser_demon": make_mat("mat_skin_lesser_demon", 0x5D1B1B, roughness=0.48, metallic=0.05),
        "skin_elvarg_dragon": make_mat("mat_skin_elvarg_dragon", 0x334235, roughness=0.45, metallic=0.12),
        # Shared materials
        "cloth": make_mat("mat_cloth", 0x4A3F32, roughness=0.75, metallic=0.02),
        "cloth_dark": make_mat("mat_cloth_dark", 0x1F2329, roughness=0.70, metallic=0.05),
        "robe": make_mat("mat_robe", 0x181528, roughness=0.65, metallic=0.06),
        "robe_trim": make_mat("mat_robe_trim", 0x4C2882, roughness=0.50, metallic=0.15),
        "dragonhide": make_mat("mat_leather_dragonhide", 0x233A28, roughness=0.50, metallic=0.12),
        "leather": make_mat("mat_leather", 0x2C1F16, roughness=0.65, metallic=0.06),
        "fur": make_mat("mat_fur", 0x3D2C1C, roughness=0.82, metallic=0.02),
        "wood": make_mat("mat_wood", 0x3E2C1C, roughness=0.70, metallic=0.02),
        "bark": make_mat("mat_bark", 0x2A1C12, roughness=0.80, metallic=0.02),
        "moss": make_mat("mat_moss", 0x2D4722, roughness=0.78, metallic=0.02),
        "stone": make_mat("mat_stone", 0x525C66, roughness=0.68, metallic=0.10),
        "iron": make_mat("mat_iron", 0x424A52, roughness=0.45, metallic=0.70),
        "obsidian": make_mat("mat_iron_obsidian", 0x16181C, roughness=0.35, metallic=0.50),
        "bronze": make_mat("mat_bronze", 0x7A5B32, roughness=0.45, metallic=0.65),
        "gold": make_mat("mat_gold", 0x9E8046, roughness=0.38, metallic=0.65),
        "bone": make_mat("mat_bone", 0xD4CBB8, roughness=0.52, metallic=0.06),
        "horn": make_mat("mat_horn", 0x1E1A17, roughness=0.45, metallic=0.12),
        "wing": make_mat("mat_wing", 0x421818, roughness=0.55, metallic=0.08),
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
def build_chicken(grid_pos: tuple[float, float, float], mats: dict):
    root = create_pivot("Monster_chicken", None, *grid_pos)

    # Plump feathered chicken body along Z (fore-aft)
    body_sections = [
        (-0.28, 0.08, 0.08, 0.0, 0.36, 0.10, 0.01, 0.0),
        (-0.20, 0.16, 0.15, 0.0, 0.34, 0.12, 0.03, 0.01),
        (-0.08, 0.21, 0.19, 0.0, 0.33, 0.14, 0.04, 0.01),
        (0.06, 0.20, 0.18, 0.0, 0.34, 0.14, 0.03, 0.02),
        (0.18, 0.15, 0.15, 0.0, 0.37, 0.12, 0.01, 0.03),
        (0.26, 0.09, 0.10, 0.0, 0.41, 0.08, 0.0, 0.02),
    ]
    add_lathe("chicken_body", root, mats["skin_chicken"], body_sections, segs=20, axis="Z")

    # S-curved neck & head rising at the front (-Z)
    neck_pts = [
        (0.0, 0.36, -0.18, 0.11, 0.11),
        (0.0, 0.45, -0.24, 0.09, 0.095),
        (0.0, 0.54, -0.25, 0.08, 0.085),
        (0.0, 0.62, -0.23, 0.085, 0.09),
        (0.0, 0.67, -0.24, 0.065, 0.07),
    ]
    add_curved_tube("chicken_neck_head", root, mats["skin_chicken"], neck_pts, segs=16)

    # Multi-lobed serrated red comb (`chicken_comb`)
    comb_bm = bmesh.new()
    comb_lobes = [
        (0.0, 0.69, -0.29, 0.026, 0.055),
        (0.0, 0.72, -0.25, 0.030, 0.075),
        (0.0, 0.71, -0.20, 0.028, 0.068),
        (0.0, 0.68, -0.16, 0.022, 0.050),
    ]
    for lx, ly, lz, r_base, h_lobe in comb_lobes:
        bmesh.ops.create_cone(
            comb_bm,
            cap_ends=True,
            cap_tris=True,
            segments=10,
            radius1=r_base,
            radius2=0.004,
            depth=h_lobe,
        )
        for v in comb_bm.verts[-12:]:
            v.co.x *= 0.45
            bx, by, bz = xform_pt(v.co.x, v.co.z + h_lobe * 0.4, v.co.y, lx, ly, lz)
            v.co.x, v.co.y, v.co.z = bx, by, bz
    finalize_obj("chicken_comb", comb_bm, root, mats["comb_red"], smooth=True)

    # Hanging red wattle under chin
    add_sphere("chicken_wattle_L", root, mats["comb_red"], 0.018, 0.042, 0.024, tx=-0.016, ty=0.56, tz=-0.29)
    add_sphere("chicken_wattle_R", root, mats["comb_red"], 0.018, 0.042, 0.024, tx=0.016, ty=0.56, tz=-0.29)

    # Sharp hooked yellow beak (upper & lower)
    add_cone_spike(
        "chicken_beak_upper",
        root,
        mats["beak_yellow"],
        base_r=0.034,
        length=0.11,
        tx=0.0,
        ty=0.62,
        tz=-0.29,
        rx=-math.pi * 0.52,
        curve_bend=-0.022,
        segs=10,
        flatten_x=0.82,
    )
    add_cone_spike(
        "chicken_beak_lower",
        root,
        mats["beak_yellow"],
        base_r=0.026,
        length=0.085,
        tx=0.0,
        ty=0.595,
        tz=-0.285,
        rx=-math.pi * 0.46,
        segs=8,
        flatten_x=0.78,
    )

    # Alert beaded eyes
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"chicken_eye_{s_tag}",
            root,
            mats["horn"],
            0.016,
            0.016,
            0.016,
            tx=side * 0.068,
            ty=0.635,
            tz=-0.255,
            no_outline=True,
        )

    # Layered side wing feathers (`chicken_LWing`, `chicken_RWing`)
    for side, w_name in ((-1.0, "chicken_LWing"), (1.0, "chicken_RWing")):
        wing_sec = [
            (-0.14, 0.028, 0.085, side * 0.19, 0.37, 0.15),
            (-0.04, 0.038, 0.115, side * 0.21, 0.36, 0.15),
            (0.08, 0.034, 0.105, side * 0.20, 0.37, 0.15),
            (0.18, 0.018, 0.065, side * 0.17, 0.39, 0.15),
        ]
        add_lathe(w_name, root, mats["skin_chicken_wing"], wing_sec, segs=14, axis="Z")
        for f_idx in range(3):
            add_cone_spike(
                f"{w_name}_feather_{f_idx}",
                root,
                mats["skin_chicken"],
                base_r=0.026,
                length=0.14,
                tx=side * (0.195 - f_idx * 0.008),
                ty=0.39 - f_idx * 0.035,
                tz=0.08,
                rx=math.pi * 0.44 + f_idx * 0.08,
                ry=side * 0.12,
                flatten_x=0.38,
            )

    # Fanned tail plumage (5 arched tail feathers)
    for t_idx in range(-2, 3):
        ang_fan = t_idx * 0.24
        add_curved_tube(
            f"chicken_tail_feather_{t_idx+2}",
            root,
            mats["skin_chicken_tail"] if abs(t_idx) >= 1 else mats["skin_chicken"],
            [
                (t_idx * 0.025, 0.40, 0.22, 0.026, 0.012),
                (math.sin(ang_fan) * 0.09, 0.51, 0.31, 0.036, 0.012),
                (math.sin(ang_fan) * 0.15, 0.58 - abs(t_idx) * 0.02, 0.40, 0.028, 0.010),
                (math.sin(ang_fan) * 0.19, 0.54 - abs(t_idx) * 0.03, 0.48, 0.008, 0.005),
            ],
            segs=10,
        )

    # Leg pivots at (-0.10, 0.24, 0.04) and (0.10, 0.24, 0.04)
    for side, piv_name in ((-1.0, "chicken_LeftLegPivot"), (1.0, "chicken_RightLegPivot")):
        leg_piv = create_pivot(piv_name, root, side * 0.10, 0.24, 0.04)
        # Feathered drumstick top + scaly yellow shank down to y = -0.22
        add_limb_tube(
            f"{piv_name}_drumstick",
            leg_piv,
            mats["skin_chicken"],
            (0.0, 0.04, 0.0),
            (0.0, -0.07, 0.02),
            0.052,
            0.024,
            segs=10,
        )
        add_limb_tube(
            f"{piv_name}_shank",
            leg_piv,
            mats["beak_yellow"],
            (0.0, -0.06, 0.02),
            (0.0, -0.22, -0.01),
            0.018,
            0.015,
            segs=8,
        )
        # 3 forward toes + 1 back spur resting on ground y = -0.24
        for toe_i, toe_ang in enumerate((-0.42, 0.0, 0.42)):
            dx = math.sin(toe_ang) * 0.095
            dz = -math.cos(toe_ang) * 0.105
            add_limb_tube(
                f"{piv_name}_toe_{toe_i}",
                leg_piv,
                mats["beak_yellow"],
                (0.0, -0.22, -0.01),
                (dx, -0.235, -0.01 + dz),
                0.013,
                0.007,
                segs=8,
            )
            add_cone_spike(
                f"{piv_name}_talon_{toe_i}",
                leg_piv,
                mats["horn"],
                base_r=0.008,
                length=0.032,
                tx=dx,
                ty=-0.235,
                tz=-0.01 + dz,
                rx=-math.pi * 0.48,
                ry=-toe_ang,
                segs=6,
            )

    return root


# =============================================================================
# Shared Goblin Anatomy Helper (used by Goblin Raider & Goblin Archer)
# =============================================================================
def build_goblin_base(key: str, grid_pos: tuple[float, float, float], mats: dict, is_archer: bool = False):
    root = create_pivot(f"Monster_{key}", None, *grid_pos)

    # Hunched muscular green goblin torso with broad deltoid shoulders, rib definition & lean forward
    torso_sections = [
        (0.66, 0.17, 0.12, 0.0, 0.02, 0.22, 0.01, 0.01),
        (0.80, 0.16, 0.11, 0.0, 0.01, 0.18, 0.02, 0.02),
        (0.96, 0.21, 0.15, 0.0, -0.01, 0.24, 0.035, 0.03),
        (1.14, 0.29, 0.18, 0.0, -0.04, 0.28, 0.045, 0.04),
        (1.30, 0.38, 0.19, 0.0, -0.07, 0.28, 0.035, 0.03),
        (1.42, 0.20, 0.14, 0.0, -0.07, 0.18, 0.0, 0.02),
    ]
    add_lathe(f"{key}_torso", root, mats["skin_goblin"], torso_sections, segs=22, axis="Y")

    # Rib definition ridges on side of torso
    for r_i, ry_pos in enumerate((0.92, 1.01, 1.10)):
        for side in (-1.0, 1.0):
            add_curved_tube(
                f"{key}_rib_{r_i}_{'L' if side < 0 else 'R'}",
                root,
                mats["skin_goblin_dark"],
                [
                    (side * 0.07, ry_pos, -0.14, 0.018, 0.014),
                    (side * 0.18, ry_pos + 0.02, -0.08, 0.020, 0.015),
                    (side * 0.21, ry_pos + 0.05, 0.03, 0.015, 0.012),
                ],
                segs=8,
                no_outline=True,
            )

    # Stitched leather waist belt + bronze buckle + tattered loincloth
    add_lathe(
        f"{key}_belt",
        root,
        mats["leather"],
        [
            (0.68, 0.175, 0.135, 0.0, 0.02, 0.25),
            (0.77, 0.172, 0.132, 0.0, 0.015, 0.25),
        ],
        segs=20,
    )
    add_box(f"{key}_buckle", root, mats["bronze"], 0.09, 0.08, 0.04, tx=0.0, ty=0.725, tz=-0.125)
    # Front and back tattered loincloth flaps
    add_box(f"{key}_loincloth_front", root, mats["cloth"], 0.18, 0.28, 0.03, tx=0.0, ty=0.56, tz=-0.12, rx=-0.08)
    add_box(f"{key}_loincloth_back", root, mats["cloth"], 0.20, 0.26, 0.03, tx=0.0, ty=0.56, tz=0.14, rx=0.10)

    # Stitched leather chest harness / bandolier strap
    add_curved_tube(
        f"{key}_harness_strap",
        root,
        mats["leather"],
        [
            (-0.22, 1.34, -0.06, 0.032, 0.016),
            (-0.04, 1.08, -0.17, 0.034, 0.016),
            (0.16, 0.76, -0.12, 0.032, 0.016),
            (0.18, 0.76, 0.12, 0.032, 0.016),
            (-0.02, 1.10, 0.13, 0.034, 0.016),
            (-0.22, 1.34, -0.06, 0.032, 0.016),
        ],
        segs=10,
    )

    # HeadGroup pivot at (0, 1.48, -0.08)
    head_piv = create_pivot(f"{key}_HeadGroup", root, 0.0, 1.48, -0.08)
    skull_sections = [
        (-0.04, 0.11, 0.11, 0.0, 0.0, 0.15),
        (0.04, 0.17, 0.18, 0.0, -0.02, 0.20),
        (0.14, 0.19, 0.20, 0.0, -0.02, 0.22),
        (0.24, 0.17, 0.18, 0.0, -0.01, 0.18),
        (0.31, 0.11, 0.12, 0.0, 0.01, 0.12),
    ]
    add_lathe(f"{key}_skull", head_piv, mats["skin_goblin"], skull_sections, segs=20)

    # Heavy scowling brow ridge
    add_curved_tube(
        f"{key}_brow_ridge",
        head_piv,
        mats["skin_goblin_dark"],
        [
            (-0.14, 0.18, -0.15, 0.028, 0.024),
            (-0.06, 0.16, -0.20, 0.035, 0.028),
            (0.0, 0.145, -0.21, 0.032, 0.026),
            (0.06, 0.16, -0.20, 0.035, 0.028),
            (0.14, 0.18, -0.15, 0.028, 0.024),
        ],
        segs=10,
    )

    # Long hooked warty goblin nose
    add_cone_spike(
        f"{key}_nose",
        head_piv,
        mats["skin_goblin"],
        base_r=0.048,
        length=0.17,
        tx=0.0,
        ty=0.12,
        tz=-0.18,
        rx=-math.pi * 0.56,
        curve_bend=-0.045,
        segs=10,
        flatten_x=0.75,
    )

    # Glowing yellow goblin eyes
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"{key}_eye_{s_tag}",
            head_piv,
            mats["glow_yellow"],
            0.032,
            0.024,
            0.022,
            tx=side * 0.075,
            ty=0.135,
            tz=-0.185,
            rz=side * -0.22,
            no_outline=True,
        )

    # Protruding lower jaw + 2 sharp lower fangs
    add_box(f"{key}_jaw", head_piv, mats["skin_goblin_dark"], 0.18, 0.07, 0.16, tx=0.0, ty=0.02, tz=-0.12, bevel=0.02)
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_cone_spike(
            f"{key}_fang_{s_tag}",
            head_piv,
            mats["bone"],
            base_r=0.016,
            length=0.065,
            tx=side * 0.058,
            ty=0.045,
            tz=-0.195,
            rx=-0.15,
            segs=8,
        )
        # Long bat-like pointed goblin ears sweeping out and back
        add_cone_spike(
            f"{key}_ear_{s_tag}",
            head_piv,
            mats["skin_goblin"],
            base_r=0.048,
            length=0.26,
            tx=side * 0.16,
            ty=0.14,
            tz=-0.02,
            rx=0.22,
            rz=-side * 1.28,
            curve_bend=0.04,
            segs=10,
            flatten_x=0.45,
        )

    # Bowed goblin legs under LeftLegPivot (-0.16, 0.70, 0) & RightLegPivot (0.16, 0.70, 0)
    for side, piv_name in ((-1.0, f"{key}_LeftLegPivot"), (1.0, f"{key}_RightLegPivot")):
        leg_piv = create_pivot(piv_name, root, side * 0.16, 0.70, 0.0)
        knee = (side * 0.06, -0.32, -0.07)
        ankle = (side * 0.02, -0.62, 0.02)
        add_limb_tube(f"{piv_name}_thigh", leg_piv, mats["skin_goblin"], (0.0, 0.0, 0.0), knee, 0.095, 0.072, segs=12)
        add_limb_tube(f"{piv_name}_calf", leg_piv, mats["skin_goblin"], knee, ankle, 0.075, 0.052, segs=12)
        # Wrapped cloth ankle wraps
        add_limb_tube(
            f"{piv_name}_wrap",
            leg_piv,
            mats["cloth"],
            (side * 0.03, -0.46, -0.02),
            ankle,
            0.066,
            0.056,
            segs=10,
        )
        # 3-clawed goblin foot at y = -0.66..-0.70
        add_box(
            f"{piv_name}_foot",
            leg_piv,
            mats["skin_goblin_dark"],
            0.12,
            0.07,
            0.20,
            tx=side * 0.02,
            ty=-0.66,
            tz=-0.05,
            bevel=0.02,
        )
        for c_i, c_off in enumerate((-0.038, 0.0, 0.038)):
            add_cone_spike(
                f"{piv_name}_claw_{c_i}",
                leg_piv,
                mats["horn"],
                base_r=0.014,
                length=0.055,
                tx=side * 0.02 + c_off,
                ty=-0.67,
                tz=-0.15,
                rx=-math.pi * 0.48,
                segs=6,
            )

    left_arm_piv = create_pivot(f"{key}_LeftArmPivot", root, -0.46, 1.28, -0.08)
    right_arm_piv = create_pivot(f"{key}_RightArmPivot", root, 0.46, 1.28, -0.08)

    return root, head_piv, left_arm_piv, right_arm_piv


# =============================================================================
# 2. Monster_goblin (Goblin Raider)
# =============================================================================
def build_goblin(grid_pos: tuple[float, float, float], mats: dict):
    root, head_piv, left_arm, right_arm = build_goblin_base("goblin", grid_pos, mats, is_archer=False)

    # Spiked iron left shoulder pauldron with 3 cones
    add_sphere(
        "goblin_pauldron_L",
        left_arm,
        mats["iron"],
        0.13,
        0.10,
        0.13,
        tx=-0.02,
        ty=0.05,
        tz=0.0,
        rz=0.35,
    )
    for s_i, s_ang in enumerate((-0.45, 0.0, 0.45)):
        add_cone_spike(
            f"goblin_pauldron_spike_{s_i}",
            left_arm,
            mats["bone"],
            base_r=0.024,
            length=0.10,
            tx=-0.04,
            ty=0.11,
            tz=math.sin(s_ang) * 0.08,
            rx=s_ang * 0.7,
            rz=0.45,
            segs=8,
        )

    # Left Arm + Hand + Wooden Plank Buckler Shield with Bronze Boss & Iron Rim Studs
    l_elbow = (-0.06, -0.24, -0.04)
    l_hand = (-0.04, -0.42, -0.20)
    add_limb_tube("goblin_upper_arm_L", left_arm, mats["skin_goblin"], (0.10, 0.04, 0.0), l_elbow, 0.095, 0.064, segs=12)
    add_limb_tube("goblin_forearm_L", left_arm, mats["skin_goblin"], l_elbow, l_hand, 0.064, 0.052, segs=12)
    add_sphere("goblin_hand_L", left_arm, mats["skin_goblin_dark"], 0.058, 0.055, 0.062, tx=l_hand[0], ty=l_hand[1], tz=l_hand[2])

    # Wooden buckler shield mounted on left forearm
    sh_x, sh_y, sh_z = -0.14, -0.36, -0.24
    add_lathe(
        "goblin_buckler_rim",
        left_arm,
        mats["iron"],
        [
            (-0.02, 0.30, 0.30),
            (0.02, 0.30, 0.30),
        ],
        segs=20,
        tx=sh_x,
        ty=sh_y,
        tz=sh_z,
        rz=math.pi * 0.44,
        ry=0.32,
    )
    add_lathe(
        "goblin_buckler_wood",
        left_arm,
        mats["wood"],
        [
            (-0.025, 0.27, 0.27),
            (0.025, 0.27, 0.27),
        ],
        segs=20,
        tx=sh_x,
        ty=sh_y,
        tz=sh_z,
        rz=math.pi * 0.44,
        ry=0.32,
    )
    add_sphere(
        "goblin_buckler_boss",
        left_arm,
        mats["bronze"],
        0.085,
        0.085,
        0.085,
        tx=sh_x - 0.03,
        ty=sh_y,
        tz=sh_z - 0.03,
    )
    for stud_i in range(6):
        ang = (stud_i / 6.0) * math.pi * 2.0
        add_sphere(
            f"goblin_buckler_stud_{stud_i}",
            left_arm,
            mats["iron"],
            0.020,
            tx=sh_x - 0.02,
            ty=sh_y + math.sin(ang) * 0.23,
            tz=sh_z + math.cos(ang) * 0.23,
            no_outline=True,
        )

    # Right Arm + Hand + Barbed Bronze War-Spear with leather grip wraps and side hook
    r_elbow = (0.06, -0.24, -0.02)
    r_hand = (0.04, -0.40, -0.22)
    add_limb_tube("goblin_upper_arm_R", right_arm, mats["skin_goblin"], (-0.10, 0.04, 0.0), r_elbow, 0.095, 0.064, segs=12)
    add_limb_tube("goblin_forearm_R", right_arm, mats["skin_goblin"], r_elbow, r_hand, 0.064, 0.052, segs=12)
    add_sphere("goblin_hand_R", right_arm, mats["skin_goblin_dark"], 0.058, 0.055, 0.062, tx=r_hand[0], ty=r_hand[1], tz=r_hand[2])

    # War-spear shaft & barbed bronze blade
    add_limb_tube(
        "goblin_spear_shaft",
        right_arm,
        mats["wood"],
        (0.06, -0.78, 0.38),
        (0.06, 0.22, -0.95),
        0.026,
        0.024,
        segs=10,
    )
    add_limb_tube(
        "goblin_spear_grip",
        right_arm,
        mats["leather"],
        (0.06, -0.48, -0.08),
        (0.06, -0.28, -0.34),
        0.032,
        0.032,
        segs=10,
    )
    add_cone_spike(
        "goblin_spear_tip",
        right_arm,
        mats["bronze"],
        base_r=0.058,
        length=0.38,
        tx=0.06,
        ty=0.20,
        tz=-0.92,
        rx=-0.92,
        segs=8,
        flatten_x=0.38,
    )
    add_cone_spike(
        "goblin_spear_barb",
        right_arm,
        mats["bronze"],
        base_r=0.026,
        length=0.14,
        tx=0.06,
        ty=0.22,
        tz=-0.96,
        rx=2.15,
        rz=0.45,
        segs=6,
    )

    return root


# =============================================================================
# 3. Monster_goblin_archer (Goblin Archer)
# =============================================================================
def build_goblin_archer(grid_pos: tuple[float, float, float], mats: dict):
    root, head_piv, left_arm, right_arm = build_goblin_base("goblin_archer", grid_pos, mats, is_archer=True)

    # Dark stitched archer hood/cowl over goblin_archer_HeadGroup (ears poking out the sides!)
    hood_sections = [
        (-0.05, 0.15, 0.15, 0.0, 0.02, 0.20),
        (0.06, 0.19, 0.20, 0.0, 0.01, 0.22),
        (0.18, 0.21, 0.22, 0.0, 0.0, 0.22),
        (0.28, 0.18, 0.21, 0.0, 0.04, 0.18),
        (0.36, 0.11, 0.16, 0.0, 0.12, 0.12),
        (0.41, 0.03, 0.06, 0.0, 0.22, 0.08),
    ]
    add_lathe("goblin_archer_hood", head_piv, mats["cloth_dark"], hood_sections, segs=18)

    # Leather quiver on back stuffed with 5 feathered arrows
    add_lathe(
        "goblin_archer_quiver",
        root,
        mats["leather"],
        [
            (0.88, 0.058, 0.048),
            (1.36, 0.075, 0.062),
        ],
        segs=14,
        tx=0.12,
        ty=0.0,
        tz=0.16,
        rz=-0.22,
        rx=0.14,
    )
    for a_i in range(5):
        ox = 0.08 + (a_i - 2) * 0.022
        oz = 0.16 + ((a_i % 2) - 0.5) * 0.025
        add_limb_tube(
            f"goblin_archer_arrow_{a_i}",
            root,
            mats["wood"],
            (ox, 1.28, oz),
            (ox - 0.06, 1.56, oz + 0.04),
            0.008,
            0.008,
            segs=6,
        )
        add_cone_spike(
            f"goblin_archer_fletch_{a_i}",
            root,
            mats["skin_chicken"],
            base_r=0.022,
            length=0.07,
            tx=ox - 0.06,
            ty=1.52,
            tz=oz + 0.04,
            rz=0.22,
            flatten_x=0.35,
            segs=6,
        )

    # Left & Right arms with leather archer bracers on forearms
    for side, arm_piv, s_tag in ((-1.0, left_arm, "L"), (1.0, right_arm, "R")):
        elbow = (side * 0.05, -0.22, -0.05)
        hand = (side * 0.04, -0.38, -0.24)
        add_limb_tube(f"goblin_archer_uarm_{s_tag}", arm_piv, mats["skin_goblin"], (-side * 0.10, 0.04, 0.0), elbow, 0.092, 0.058, segs=12)
        add_limb_tube(f"goblin_archer_farm_{s_tag}", arm_piv, mats["skin_goblin"], elbow, hand, 0.060, 0.048, segs=12)
        add_limb_tube(
            f"goblin_archer_bracer_{s_tag}",
            arm_piv,
            mats["leather"],
            (elbow[0] * 0.85, -0.26, -0.09),
            (hand[0] * 1.02, -0.36, -0.21),
            0.066,
            0.056,
            segs=10,
        )
        add_sphere(f"goblin_archer_hand_{s_tag}", arm_piv, mats["skin_goblin_dark"], 0.054, tx=hand[0], ty=hand[1], tz=hand[2])

    # Carved recurve shortbow with taut string under `goblin_archer_RightArmPivot`
    bow_pts = [
        (0.06, 0.14, -0.14, 0.012, 0.014),
        (0.06, 0.04, -0.28, 0.022, 0.026),
        (0.06, -0.18, -0.36, 0.028, 0.034),
        (0.06, -0.38, -0.30, 0.032, 0.036),
        (0.06, -0.58, -0.36, 0.028, 0.034),
        (0.06, -0.80, -0.28, 0.022, 0.026),
        (0.06, -0.90, -0.14, 0.012, 0.014),
    ]
    add_curved_tube("goblin_archer_bow", right_arm, mats["wood"], bow_pts, segs=10)
    add_limb_tube(
        "goblin_archer_bowstring",
        right_arm,
        mats["bone"],
        (0.06, 0.13, -0.14),
        (0.06, -0.89, -0.14),
        0.005,
        0.005,
        segs=6,
        no_outline=True,
    )

    return root


# =============================================================================
# 4. Monster_scorpion (King Scorpion)
# =============================================================================
def build_scorpion(grid_pos: tuple[float, float, float], mats: dict):
    root = create_pivot("Monster_scorpion", None, *grid_pos)

    # Armored prosoma head plate at front (-Z)
    add_lathe(
        "scorpion_prosoma",
        root,
        mats["skin_scorpion_plate"],
        [
            (-0.78, 0.18, 0.10, 0.0, 0.48, 0.25, 0.02, 0.03),
            (-0.56, 0.34, 0.16, 0.0, 0.50, 0.28, 0.03, 0.05),
            (-0.32, 0.40, 0.19, 0.0, 0.52, 0.28, 0.04, 0.06),
        ],
        segs=20,
        axis="Z",
    )

    # 6 glowing yellow arachnid eyes & serrated chelicerae mandibles
    for side in (-1.0, 1.0):
        for e_i in range(3):
            add_sphere(
                f"scorpion_eye_{'L' if side < 0 else 'R'}_{e_i}",
                root,
                mats["glow_yellow"],
                0.022,
                tx=side * (0.08 + e_i * 0.045),
                ty=0.58 - e_i * 0.015,
                tz=-0.68 + e_i * 0.04,
                no_outline=True,
            )
        add_cone_spike(
            f"scorpion_mandible_{'L' if side < 0 else 'R'}",
            root,
            mats["horn"],
            base_r=0.045,
            length=0.22,
            tx=side * 0.09,
            ty=0.45,
            tz=-0.74,
            rx=-math.pi * 0.48,
            ry=side * 0.25,
            curve_bend=-side * 0.04,
            segs=10,
        )

    # 5 overlapping segmented chitinous carapace plates with dorsal ridges
    plate_z = [-0.28, -0.06, 0.16, 0.38, 0.58]
    plate_w = [0.42, 0.45, 0.43, 0.38, 0.30]
    for p_idx, (pz, pw) in enumerate(zip(plate_z, plate_w)):
        add_lathe(
            f"scorpion_carapace_plate_{p_idx}",
            root,
            mats["skin_scorpion"] if p_idx % 2 == 0 else mats["skin_scorpion_plate"],
            [
                (pz - 0.14, pw * 0.92, 0.17, 0.0, 0.50, 0.24, 0.04, 0.05),
                (pz, pw, 0.20, 0.0, 0.52, 0.26, 0.05, 0.07),
                (pz + 0.13, pw * 0.95, 0.18, 0.0, 0.51, 0.24, 0.04, 0.06),
            ],
            segs=20,
            axis="Z",
        )

    # 6-segment arched metasoma tail sweeping high over the back + swollen venomous telson bulb + crimson stinger
    tail_nodes = [
        (0.0, 0.54, 0.68, 0.18),
        (0.0, 0.72, 0.92, 0.15),
        (0.0, 1.02, 1.06, 0.13),
        (0.0, 1.36, 1.02, 0.12),
        (0.0, 1.66, 0.80, 0.11),
        (0.0, 1.84, 0.46, 0.10),
        (0.0, 1.88, 0.12, 0.095),
    ]
    for seg_i in range(6):
        p_a = tail_nodes[seg_i]
        p_b = tail_nodes[seg_i + 1]
        add_limb_tube(
            f"scorpion_tail_seg_{seg_i}",
            root,
            mats["skin_scorpion"],
            p_a[:3],
            p_b[:3],
            p_a[3],
            p_b[3] * 0.92,
            r_mid=(p_a[3] + p_b[3]) * 0.58,
            segs=14,
        )
        # Chitinous armor ring joint
        add_sphere(
            f"scorpion_tail_ring_{seg_i}",
            root,
            mats["skin_scorpion_plate"],
            p_b[3] * 1.12,
            p_b[3] * 0.95,
            p_b[3] * 1.12,
            tx=p_b[0],
            ty=p_b[1],
            tz=p_b[2],
        )

    # Swollen venomous telson bulb + curved glowing crimson stinger barb
    add_sphere("scorpion_telson_bulb", root, mats["skin_scorpion_plate"], 0.14, 0.12, 0.18, tx=0.0, ty=1.86, tz=-0.02)
    add_cone_spike(
        "scorpion_stinger_barb",
        root,
        mats["glow_crimson"],
        base_r=0.065,
        length=0.38,
        tx=0.0,
        ty=1.85,
        tz=-0.16,
        rx=-math.pi * 0.68,
        curve_bend=-0.12,
        segs=12,
    )

    # 4 multi-jointed arachnid legs per side under LeftLegPivot (-0.22, 0.50, 0) & RightLegPivot (0.22, 0.50, 0)
    leg_z_offsets = [-0.50, -0.16, 0.18, 0.50]
    for side, piv_name in ((-1.0, "scorpion_LeftLegPivot"), (1.0, "scorpion_RightLegPivot")):
        leg_piv = create_pivot(piv_name, root, side * 0.22, 0.50, 0.0)
        for l_idx, z_off in enumerate(leg_z_offsets):
            splay_z = (l_idx - 1.5) * 0.16
            coxa = (side * 0.12, 0.02, z_off)
            femur_top = (side * 0.48, 0.22, z_off + splay_z * 0.5)
            tibia_mid = (side * 0.78, -0.12, z_off + splay_z * 0.85)
            tarsus_tip = (side * 0.92, -0.50, z_off + splay_z)
            add_limb_tube(f"{piv_name}_femur_{l_idx}", leg_piv, mats["skin_scorpion"], coxa, femur_top, 0.055, 0.048, segs=10)
            add_limb_tube(f"{piv_name}_tibia_{l_idx}", leg_piv, mats["skin_scorpion_plate"], femur_top, tibia_mid, 0.048, 0.036, segs=10)
            add_limb_tube(f"{piv_name}_tarsus_{l_idx}", leg_piv, mats["horn"], tibia_mid, tarsus_tip, 0.034, 0.012, segs=8)

    # Pedipalp arms + massive bulbous crab-like crushing chela pincers under LeftArmPivot / RightArmPivot
    for side, piv_name in ((-1.0, "scorpion_LeftArmPivot"), (1.0, "scorpion_RightArmPivot")):
        arm_piv = create_pivot(piv_name, root, side * 0.28, 0.52, -0.82)
        elbow = (side * 0.34, 0.06, -0.14)
        wrist = (side * 0.26, 0.04, -0.52)
        add_limb_tube(f"{piv_name}_pedipalp_1", arm_piv, mats["skin_scorpion"], (0.0, 0.0, 0.0), elbow, 0.075, 0.068, segs=12)
        add_limb_tube(f"{piv_name}_pedipalp_2", arm_piv, mats["skin_scorpion_plate"], elbow, wrist, 0.072, 0.088, segs=12)
        # Bulbous crushing chela palm
        add_sphere(
            f"{piv_name}_chela_palm",
            arm_piv,
            mats["skin_scorpion_plate"],
            0.16,
            0.12,
            0.22,
            tx=side * 0.24,
            ty=0.04,
            tz=-0.68,
            ry=-side * 0.22,
        )
        # Outer & inner pincer blades with serrated inner teeth
        add_cone_spike(
            f"{piv_name}_pincer_outer",
            arm_piv,
            mats["horn"],
            base_r=0.065,
            length=0.38,
            tx=side * 0.30,
            ty=0.04,
            tz=-0.82,
            rx=-math.pi * 0.50,
            ry=side * 0.28,
            curve_bend=-side * 0.08,
            segs=10,
        )
        add_cone_spike(
            f"{piv_name}_pincer_inner",
            arm_piv,
            mats["horn"],
            base_r=0.052,
            length=0.32,
            tx=side * 0.16,
            ty=0.03,
            tz=-0.82,
            rx=-math.pi * 0.50,
            ry=-side * 0.24,
            curve_bend=side * 0.06,
            segs=10,
        )
        for tooth_i in range(3):
            add_cone_spike(
                f"{piv_name}_tooth_{tooth_i}",
                arm_piv,
                mats["bone"],
                base_r=0.016,
                length=0.045,
                tx=side * 0.25,
                ty=0.04,
                tz=-0.88 - tooth_i * 0.065,
                rz=side * math.pi * 0.5,
                segs=6,
            )

    return root


# =============================================================================
# 5. Monster_dark_wizard (Dark Wizard)
# =============================================================================
def build_dark_wizard(grid_pos: tuple[float, float, float], mats: dict):
    root = create_pivot("Monster_dark_wizard", None, *grid_pos)

    # Layered dark-indigo & purple cultist robe skirt with pleated folds + upper torso
    robe_sections = [
        (0.04, 0.44, 0.36, 0.0, 0.02, 0.18, 0.0, 0.04),
        (0.32, 0.36, 0.30, 0.0, 0.01, 0.16, 0.0, 0.03),
        (0.68, 0.27, 0.22, 0.0, 0.0, 0.18, 0.0, 0.02),
        (0.98, 0.21, 0.17, 0.0, 0.0, 0.22, 0.01, 0.01),
        (1.28, 0.26, 0.19, 0.0, -0.01, 0.24, 0.03, 0.02),
        (1.56, 0.29, 0.20, 0.0, -0.01, 0.22, 0.02, 0.02),
        (1.76, 0.18, 0.15, 0.0, 0.0, 0.15, 0.0, 0.01),
    ]
    add_lathe("dark_wizard_robe", root, mats["robe"], robe_sections, segs=24, axis="Y")

    # Golden/violet arcane rune trim along the hem and central stole
    add_lathe(
        "dark_wizard_hem_trim",
        root,
        mats["gold"],
        [
            (0.03, 0.45, 0.37, 0.0, 0.02, 0.18),
            (0.09, 0.43, 0.35, 0.0, 0.02, 0.18),
        ],
        segs=24,
    )
    add_box("dark_wizard_stole", root, mats["robe_trim"], 0.15, 1.38, 0.04, tx=0.0, ty=0.82, tz=-0.22, rx=0.08)
    for r_i in range(4):
        add_box(
            f"dark_wizard_stole_rune_{r_i}",
            root,
            mats["gold"],
            0.09,
            0.035,
            0.02,
            tx=0.0,
            ty=0.35 + r_i * 0.26,
            tz=-0.26 - (3 - r_i) * 0.02,
            no_outline=True,
        )

    # High upturned warlock collar & shoulder mantle + flowing back cape
    add_lathe(
        "dark_wizard_mantle",
        root,
        mats["robe_trim"],
        [
            (1.48, 0.36, 0.24, 0.0, 0.0, 0.22),
            (1.68, 0.32, 0.22, 0.0, 0.02, 0.20),
            (1.88, 0.24, 0.20, 0.0, 0.08, 0.15),
        ],
        segs=20,
        cap_ends=False,
    )
    add_box("dark_wizard_cape", root, mats["cloth_dark"], 0.56, 1.48, 0.04, tx=0.0, ty=0.92, tz=0.24, rx=0.12)

    # HeadGroup at (0, 1.92, 0): shadowed void hood/skull with glowing violet eyes + crooked pointed wizard hat
    head_piv = create_pivot("dark_wizard_HeadGroup", root, 0.0, 1.92, 0.0)
    add_sphere("dark_wizard_void_skull", head_piv, mats["obsidian"], 0.14, 0.16, 0.15, tx=0.0, ty=0.02, tz=-0.02)
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"dark_wizard_eye_{s_tag}",
            head_piv,
            mats["glow_purple"],
            0.030,
            0.020,
            0.020,
            tx=side * 0.055,
            ty=0.03,
            tz=-0.15,
            no_outline=True,
        )

    # Wide-brimmed crooked pointed wizard hat with buckled band and bent tip
    add_lathe(
        "dark_wizard_hat_brim",
        head_piv,
        mats["robe"],
        [
            (0.10, 0.44, 0.42, 0.0, 0.0, 0.05),
            (0.13, 0.38, 0.36, 0.0, 0.0, 0.05),
            (0.15, 0.18, 0.18, 0.0, 0.0, 0.08),
        ],
        segs=22,
    )
    add_lathe(
        "dark_wizard_hat_band",
        head_piv,
        mats["gold"],
        [
            (0.14, 0.185, 0.185),
            (0.19, 0.175, 0.175),
        ],
        segs=20,
    )
    add_curved_tube(
        "dark_wizard_hat_cone",
        head_piv,
        mats["robe"],
        [
            (0.0, 0.15, 0.0, 0.175, 0.175),
            (0.02, 0.32, 0.02, 0.125, 0.125),
            (0.06, 0.48, 0.06, 0.075, 0.075),
            (0.14, 0.60, 0.14, 0.038, 0.038),
            (0.22, 0.56, 0.22, 0.010, 0.010),
        ],
        segs=16,
    )

    # LeftArmPivot (-0.38, 1.50, 0) & RightArmPivot (0.38, 1.50, 0)
    left_arm = create_pivot("dark_wizard_LeftArmPivot", root, -0.38, 1.50, 0.0)
    right_arm = create_pivot("dark_wizard_RightArmPivot", root, 0.38, 1.50, 0.0)

    for side, arm_piv, s_tag in ((-1.0, left_arm, "L"), (1.0, right_arm, "R")):
        add_limb_tube(
            f"dark_wizard_sleeve_{s_tag}",
            arm_piv,
            mats["robe"],
            (0.0, 0.0, 0.0),
            (side * 0.08, -0.44, -0.18),
            0.095,
            0.145,
            segs=14,
        )
        add_sphere(
            f"dark_wizard_hand_{s_tag}",
            arm_piv,
            mats["bone"],
            0.052,
            tx=side * 0.08,
            ty=-0.46,
            tz=-0.20,
        )

    # Under `dark_wizard_RightArmPivot`: gnarled twisted darkwood staff cradling a glowing purple arcane orb + rune rings
    staff_pts = [
        (0.08, -1.38, -0.16, 0.026, 0.026),
        (0.08, -0.85, -0.18, 0.032, 0.032),
        (0.09, -0.35, -0.22, 0.035, 0.035),
        (0.06, 0.18, -0.24, 0.038, 0.038),
        (0.14, 0.42, -0.24, 0.044, 0.044),
        (0.08, 0.64, -0.24, 0.028, 0.028),
    ]
    add_curved_tube("dark_wizard_staff", right_arm, mats["bark"], staff_pts, segs=12)
    add_sphere("dark_wizard_orb", right_arm, mats["glow_purple"], 0.105, tx=0.06, ty=0.56, tz=-0.24)
    add_lathe(
        "dark_wizard_orb_ring",
        right_arm,
        mats["gold"],
        [
            (-0.012, 0.15, 0.15),
            (0.012, 0.15, 0.15),
        ],
        segs=18,
        tx=0.06,
        ty=0.56,
        tz=-0.24,
        rx=0.65,
        rz=0.45,
    )

    # Leg pivots at (-0.16, 0.22, 0.04) and (0.16, 0.22, 0.04)
    for side, piv_name in ((-1.0, "dark_wizard_LeftLegPivot"), (1.0, "dark_wizard_RightLegPivot")):
        leg_piv = create_pivot(piv_name, root, side * 0.16, 0.22, 0.04)
        add_box(
            f"{piv_name}_boot",
            leg_piv,
            mats["leather"],
            0.12,
            0.22,
            0.22,
            tx=0.0,
            ty=-0.11,
            tz=-0.04,
            bevel=0.03,
        )

    return root


# =============================================================================
# 6. Monster_dark_ranger (Dark Ranger)
# =============================================================================
def build_dark_ranger(grid_pos: tuple[float, float, float], mats: dict):
    root = create_pivot("Monster_dark_ranger", None, *grid_pos)

    # Dark green dragonhide brigandine chestpiece with angled scale plates & belted tunic
    torso_sections = [
        (0.62, 0.25, 0.18, 0.0, 0.01, 0.24),
        (0.78, 0.19, 0.14, 0.0, 0.0, 0.24),
        (0.98, 0.21, 0.15, 0.0, 0.0, 0.26, 0.02, 0.01),
        (1.24, 0.26, 0.18, 0.0, -0.01, 0.28, 0.04, 0.02),
        (1.52, 0.30, 0.19, 0.0, -0.01, 0.26, 0.03, 0.02),
        (1.74, 0.18, 0.14, 0.0, 0.0, 0.18),
    ]
    add_lathe("dark_ranger_brigandine", root, mats["dragonhide"], torso_sections, segs=22)

    # Angled dragonhide scale plates across chest + belt
    for s_idx, sy in enumerate((1.05, 1.22, 1.39)):
        for side in (-1.0, 1.0):
            add_box(
                f"dark_ranger_scale_{s_idx}_{'L' if side < 0 else 'R'}",
                root,
                mats["leather"],
                0.16,
                0.08,
                0.04,
                tx=side * 0.11,
                ty=sy,
                tz=-0.18,
                rz=side * 0.18,
                ry=side * 0.22,
                no_outline=True,
            )
    add_lathe(
        "dark_ranger_belt",
        root,
        mats["leather"],
        [(0.76, 0.21, 0.16, 0.0, 0.0, 0.25), (0.85, 0.21, 0.16, 0.0, 0.0, 0.25)],
        segs=20,
    )
    add_box("dark_ranger_buckle", root, mats["iron"], 0.09, 0.08, 0.04, tx=0.0, ty=0.805, tz=-0.165)

    # Layered spiked ranger pauldrons + windswept shadow cloak + quiver of emerald-fletched arrows
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"dark_ranger_pauldron_{s_tag}",
            root,
            mats["dragonhide"],
            0.16,
            0.11,
            0.16,
            tx=side * 0.36,
            ty=1.58,
            tz=0.0,
            rz=-side * 0.32,
        )
        add_cone_spike(
            f"dark_ranger_pauldron_spike_{s_tag}",
            root,
            mats["iron"],
            base_r=0.028,
            length=0.12,
            tx=side * 0.42,
            ty=1.64,
            tz=0.0,
            rz=-side * 0.65,
            segs=8,
        )
    add_box("dark_ranger_cloak", root, mats["cloth_dark"], 0.62, 1.38, 0.04, tx=0.0, ty=1.02, tz=0.22, rx=0.14)
    add_lathe(
        "dark_ranger_quiver",
        root,
        mats["leather"],
        [(1.05, 0.06, 0.05), (1.58, 0.08, 0.065)],
        segs=14,
        tx=0.15,
        ty=0.0,
        tz=0.18,
        rz=-0.20,
    )
    for a_i in range(4):
        ox = 0.11 + (a_i - 1.5) * 0.025
        add_cone_spike(
            f"dark_ranger_arrow_fletch_{a_i}",
            root,
            mats["glow_emerald"],
            base_r=0.022,
            length=0.09,
            tx=ox - 0.05,
            ty=1.64,
            tz=0.20,
            rz=0.20,
            flatten_x=0.35,
            segs=6,
        )

    # HeadGroup at (0, 1.86, 0): deep assassin cowl hood, stealth face-mask, glowing emerald eyes
    head_piv = create_pivot("dark_ranger_HeadGroup", root, 0.0, 1.86, 0.0)
    cowl_sections = [
        (-0.08, 0.16, 0.16, 0.0, 0.01, 0.20),
        (0.04, 0.18, 0.19, 0.0, 0.0, 0.22),
        (0.18, 0.19, 0.21, 0.0, -0.01, 0.22),
        (0.30, 0.14, 0.19, 0.0, -0.02, 0.18),
        (0.36, 0.05, 0.10, 0.0, 0.04, 0.12),
    ]
    add_lathe("dark_ranger_cowl", head_piv, mats["cloth_dark"], cowl_sections, segs=20)
    add_box("dark_ranger_mask", head_piv, mats["obsidian"], 0.20, 0.14, 0.14, tx=0.0, ty=0.04, tz=-0.11, bevel=0.03)
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"dark_ranger_eye_{s_tag}",
            head_piv,
            mats["glow_emerald"],
            0.032,
            0.018,
            0.018,
            tx=side * 0.055,
            ty=0.125,
            tz=-0.195,
            rz=-side * 0.18,
            no_outline=True,
        )

    # LeftArmPivot (-0.42, 1.50, 0) & RightArmPivot (0.42, 1.50, 0)
    left_arm = create_pivot("dark_ranger_LeftArmPivot", root, -0.42, 1.50, 0.0)
    right_arm = create_pivot("dark_ranger_RightArmPivot", root, 0.42, 1.50, 0.0)
    for side, arm_piv, s_tag in ((-1.0, left_arm, "L"), (1.0, right_arm, "R")):
        elbow = (side * 0.05, -0.26, -0.06)
        hand = (side * 0.04, -0.46, -0.24)
        add_limb_tube(f"dark_ranger_uarm_{s_tag}", arm_piv, mats["cloth_dark"], (-side * 0.08, 0.04, 0.0), elbow, 0.095, 0.068, segs=12)
        add_limb_tube(f"dark_ranger_bracer_{s_tag}", arm_piv, mats["dragonhide"], elbow, hand, 0.072, 0.058, segs=12)
        add_sphere(f"dark_ranger_glove_{s_tag}", arm_piv, mats["leather"], 0.055, tx=hand[0], ty=hand[1], tz=hand[2])

    # Long sculpted recurve dark-yew longbow with bowstring under `dark_ranger_RightArmPivot`
    longbow_pts = [
        (0.06, 0.36, -0.14, 0.012, 0.014),
        (0.06, 0.18, -0.32, 0.024, 0.028),
        (0.06, -0.16, -0.42, 0.032, 0.038),
        (0.06, -0.46, -0.34, 0.036, 0.042),
        (0.06, -0.76, -0.42, 0.032, 0.038),
        (0.06, -1.10, -0.32, 0.024, 0.028),
        (0.06, -1.28, -0.14, 0.012, 0.014),
    ]
    add_curved_tube("dark_ranger_longbow", right_arm, mats["bark"], longbow_pts, segs=12)
    add_limb_tube(
        "dark_ranger_bowstring",
        right_arm,
        mats["bone"],
        (0.06, 0.35, -0.14),
        (0.06, -1.27, -0.14),
        0.005,
        0.005,
        segs=6,
        no_outline=True,
    )

    # LeftLegPivot (-0.15, 0.78, 0) & RightLegPivot (0.15, 0.78, 0)
    for side, piv_name in ((-1.0, "dark_ranger_LeftLegPivot"), (1.0, "dark_ranger_RightLegPivot")):
        leg_piv = create_pivot(piv_name, root, side * 0.15, 0.78, 0.0)
        knee = (0.0, -0.36, -0.03)
        ankle = (0.0, -0.70, 0.0)
        add_limb_tube(f"{piv_name}_thigh", leg_piv, mats["dragonhide"], (0.0, 0.0, 0.0), knee, 0.105, 0.082, segs=12)
        add_limb_tube(f"{piv_name}_greave", leg_piv, mats["leather"], knee, ankle, 0.085, 0.064, segs=12)
        add_box(f"{piv_name}_boot", leg_piv, mats["obsidian"], 0.12, 0.10, 0.22, tx=0.0, ty=-0.73, tz=-0.04, bevel=0.02)

    return root


# =============================================================================
# 7. Monster_hill_giant (Hill Giant)
# =============================================================================
def build_hill_giant(grid_pos: tuple[float, float, float], mats: dict):
    root = create_pivot("Monster_hill_giant", None, *grid_pos)

    # Massive barrel-chested muscular giant torso with pectoral/abdominal definition
    torso_sections = [
        (0.72, 0.30, 0.24, 0.0, 0.0, 0.25, 0.03, 0.02),
        (0.96, 0.33, 0.27, 0.0, -0.02, 0.26, 0.06, 0.03),
        (1.24, 0.39, 0.30, 0.0, -0.03, 0.28, 0.08, 0.04),
        (1.56, 0.46, 0.32, 0.0, -0.02, 0.30, 0.09, 0.05),
        (1.80, 0.42, 0.28, 0.0, 0.0, 0.24, 0.04, 0.04),
        (1.98, 0.24, 0.20, 0.0, 0.01, 0.18, 0.0, 0.02),
    ]
    add_lathe("hill_giant_torso", root, mats["skin_hill_giant"], torso_sections, segs=24)

    # Shaggy fur pelt loincloth & shoulder strap + oversized horned beast-skull belt buckle
    add_lathe(
        "hill_giant_pelt_skirt",
        root,
        mats["fur"],
        [
            (0.54, 0.36, 0.28, 0.0, 0.0, 0.24),
            (0.76, 0.34, 0.27, 0.0, 0.0, 0.26),
            (0.92, 0.35, 0.28, 0.0, 0.0, 0.26),
        ],
        segs=22,
    )
    add_curved_tube(
        "hill_giant_fur_strap",
        root,
        mats["fur"],
        [
            (-0.36, 1.86, 0.0, 0.065, 0.035),
            (-0.08, 1.40, -0.31, 0.072, 0.035),
            (0.24, 0.92, -0.26, 0.065, 0.035),
            (0.24, 0.92, 0.26, 0.065, 0.035),
            (-0.08, 1.44, 0.28, 0.072, 0.035),
            (-0.36, 1.86, 0.0, 0.065, 0.035),
        ],
        segs=10,
    )
    # Horned beast-skull belt buckle with dark eye sockets
    add_sphere("hill_giant_skull_buckle", root, mats["bone"], 0.12, 0.13, 0.10, tx=0.0, ty=0.88, tz=-0.28)
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"hill_giant_buckle_socket_{s_tag}",
            root,
            mats["obsidian"],
            0.032,
            tx=side * 0.045,
            ty=0.90,
            tz=-0.36,
            no_outline=True,
        )
        add_cone_spike(
            f"hill_giant_buckle_horn_{s_tag}",
            root,
            mats["horn"],
            base_r=0.032,
            length=0.16,
            tx=side * 0.09,
            ty=0.94,
            tz=-0.29,
            rz=-side * 1.15,
            curve_bend=-0.05,
            segs=8,
        )

    # HeadGroup at (0, 2.02, 0): brutish craggy head, Neanderthal brow, broad nose, fierce dark eyes & multi-braided beard
    head_piv = create_pivot("hill_giant_HeadGroup", root, 0.0, 2.02, 0.0)
    add_lathe(
        "hill_giant_head",
        head_piv,
        mats["skin_hill_giant"],
        [
            (-0.04, 0.18, 0.18, 0.0, 0.0, 0.22),
            (0.08, 0.22, 0.23, 0.0, -0.02, 0.25),
            (0.22, 0.21, 0.22, 0.0, -0.02, 0.24),
            (0.34, 0.16, 0.17, 0.0, 0.0, 0.18),
        ],
        segs=20,
    )
    add_box("hill_giant_brow", head_piv, mats["skin_hill_giant"], 0.30, 0.07, 0.12, tx=0.0, ty=0.22, tz=-0.19, bevel=0.02)
    add_sphere("hill_giant_nose", head_piv, mats["skin_hill_giant"], 0.055, 0.065, 0.075, tx=0.0, ty=0.15, tz=-0.23)
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"hill_giant_eye_{s_tag}",
            head_piv,
            mats["obsidian"],
            0.026,
            tx=side * 0.075,
            ty=0.18,
            tz=-0.215,
            no_outline=True,
        )

    # Thick multi-braided brown beard with bone beads
    add_sphere("hill_giant_beard_main", head_piv, mats["fur"], 0.21, 0.20, 0.18, tx=0.0, ty=-0.02, tz=-0.14)
    for b_idx, bx in enumerate((-0.10, 0.0, 0.10)):
        add_limb_tube(
            f"hill_giant_beard_braid_{b_idx}",
            head_piv,
            mats["fur"],
            (bx, -0.06, -0.18),
            (bx * 1.15, -0.34 + abs(bx) * 0.4, -0.22),
            0.062,
            0.032,
            segs=10,
        )
        add_sphere(
            f"hill_giant_beard_bead_{b_idx}",
            head_piv,
            mats["bone"],
            0.042,
            0.030,
            0.042,
            tx=bx * 1.08,
            ty=-0.22 + abs(bx) * 0.2,
            tz=-0.21,
        )

    # LeftArmPivot (-0.58, 1.58, 0) & RightArmPivot (0.58, 1.58, 0)
    left_arm = create_pivot("hill_giant_LeftArmPivot", root, -0.58, 1.58, 0.0)
    right_arm = create_pivot("hill_giant_RightArmPivot", root, 0.58, 1.58, 0.0)
    for side, arm_piv, s_tag in ((-1.0, left_arm, "L"), (1.0, right_arm, "R")):
        elbow = (side * 0.08, -0.36, -0.06)
        hand = (side * 0.06, -0.72, -0.26)
        add_limb_tube(f"hill_giant_uarm_{s_tag}", arm_piv, mats["skin_hill_giant"], (-side * 0.14, 0.08, 0.0), elbow, 0.175, 0.118, segs=14)
        add_limb_tube(f"hill_giant_farm_{s_tag}", arm_piv, mats["skin_hill_giant"], elbow, hand, 0.122, 0.095, segs=14)
        add_sphere(f"hill_giant_fist_{s_tag}", arm_piv, mats["skin_hill_giant"], 0.105, tx=hand[0], ty=hand[1], tz=hand[2])
        # Bone/leather armband on bicep
        add_lathe(
            f"hill_giant_armband_{s_tag}",
            arm_piv,
            mats["bone"] if side > 0 else mats["leather"],
            [(-0.22, 0.138, 0.138), (-0.15, 0.142, 0.142)],
            segs=14,
            tx=side * 0.04,
            ty=0.0,
            tz=-0.03,
        )

    # Massive gnarled tree-trunk war-club bound with iron straps and studded with 8 jagged stone spikes
    club_pts = [
        (0.08, -0.82, -0.10, 0.042, 0.042),
        (0.08, -0.66, -0.32, 0.055, 0.055),
        (0.08, -0.44, -0.62, 0.095, 0.095),
        (0.08, -0.24, -0.92, 0.155, 0.145),
        (0.08, -0.08, -1.16, 0.185, 0.175),
        (0.08, 0.02, -1.32, 0.135, 0.130),
    ]
    add_curved_tube("hill_giant_club_wood", right_arm, mats["wood"], club_pts, segs=16)
    # Iron binding straps around club head
    for strap_i, (sy, sz, sr) in enumerate(((-0.34, -0.77, 0.13), (-0.12, -1.08, 0.185))):
        add_lathe(
            f"hill_giant_club_strap_{strap_i}",
            right_arm,
            mats["iron"],
            [(-0.025, sr, sr), (0.025, sr, sr)],
            segs=16,
            tx=0.08,
            ty=sy,
            tz=sz,
            rx=-0.92,
        )
    # 8 jagged stone spikes around club head
    for sp_i in range(8):
        ang = (sp_i / 8.0) * math.pi * 2.0
        ring_z = -0.85 if sp_i < 4 else -1.12
        ring_y = -0.28 if sp_i < 4 else -0.10
        add_cone_spike(
            f"hill_giant_club_spike_{sp_i}",
            right_arm,
            mats["stone"],
            base_r=0.045,
            length=0.18,
            tx=0.08 + math.cos(ang) * 0.14,
            ty=ring_y + math.sin(ang) * 0.12,
            tz=ring_z,
            rx=math.sin(ang) * 1.2,
            rz=-math.cos(ang) * 1.2,
            segs=6,
        )

    # LeftLegPivot (-0.22, 0.78, 0) & RightLegPivot (0.22, 0.78, 0)
    for side, piv_name in ((-1.0, "hill_giant_LeftLegPivot"), (1.0, "hill_giant_RightLegPivot")):
        leg_piv = create_pivot(piv_name, root, side * 0.22, 0.78, 0.0)
        knee = (side * 0.03, -0.36, -0.04)
        ankle = (side * 0.03, -0.68, 0.0)
        add_limb_tube(f"{piv_name}_thigh", leg_piv, mats["skin_hill_giant"], (0.0, 0.0, 0.0), knee, 0.165, 0.132, segs=14)
        add_limb_tube(f"{piv_name}_shin_wrap", leg_piv, mats["fur"], knee, ankle, 0.138, 0.112, segs=14)
        add_box(
            f"{piv_name}_bare_foot",
            leg_piv,
            mats["skin_hill_giant"],
            0.20,
            0.11,
            0.30,
            tx=side * 0.03,
            ty=-0.725,
            tz=-0.06,
            bevel=0.03,
        )

    return root


# =============================================================================
# 8. Monster_moss_guardian (Moss Guardian)
# =============================================================================
def build_moss_guardian(grid_pos: tuple[float, float, float], mats: dict):
    root = create_pivot("Monster_moss_guardian", None, *grid_pos)

    # Ancient forest golem of interlocking craggy stone slabs and twisted ancient tree bark
    core_sections = [
        (0.72, 0.26, 0.20, 0.0, 0.02, 0.35),
        (0.98, 0.32, 0.24, 0.0, 0.0, 0.35, 0.04, 0.05),
        (1.28, 0.44, 0.32, 0.0, -0.04, 0.38, 0.08, 0.08),
        (1.56, 0.48, 0.34, 0.0, -0.06, 0.38, 0.06, 0.09),
        (1.74, 0.28, 0.24, 0.0, -0.04, 0.30, 0.0, 0.05),
    ]
    add_lathe("moss_guardian_bark_torso", root, mats["bark"], core_sections, segs=18)

    # Interlocking craggy stone chest slabs + glowing green heart-core runes in the chest
    add_sphere("moss_guardian_heart_core", root, mats["glow_emerald"], 0.16, 0.22, 0.16, tx=0.0, ty=1.32, tz=-0.32)
    slab_specs = [
        (-0.24, 1.44, -0.26, 0.22, 0.22, 0.14, 0.15, 0.25),
        (0.24, 1.42, -0.26, 0.22, 0.22, 0.14, -0.12, -0.25),
        (-0.20, 1.14, -0.24, 0.20, 0.18, 0.14, -0.10, 0.20),
        (0.20, 1.14, -0.24, 0.20, 0.18, 0.14, 0.10, -0.20),
        (0.0, 1.38, 0.26, 0.44, 0.42, 0.20, 0.18, 0.0),
    ]
    for idx, (sx, sy, sz, wx, hy, dz, rx_v, ry_v) in enumerate(slab_specs):
        add_box(
            f"moss_guardian_stone_slab_{idx}",
            root,
            mats["stone"],
            wx,
            hy,
            dz,
            tx=sx,
            ty=sy,
            tz=sz,
            rx=rx_v,
            ry=ry_v,
            bevel=0.05,
        )

    # Asymmetric boulder/bark pauldrons covered in lush moss cushions and small mushrooms
    for side, s_tag, px, py in ((-1.0, "L", -0.52, 1.56), (1.0, "R", 0.50, 1.54)):
        add_box(
            f"moss_guardian_pauldron_stone_{s_tag}",
            root,
            mats["stone"],
            0.36,
            0.28,
            0.34,
            tx=px,
            ty=py,
            tz=-0.02,
            rz=-side * 0.24,
            bevel=0.06,
        )
        add_sphere(
            f"moss_guardian_pauldron_moss_{s_tag}",
            root,
            mats["moss"],
            0.21,
            0.11,
            0.20,
            tx=px,
            ty=py + 0.13,
            tz=-0.02,
        )
        # Small glowing forest mushrooms sprouting from left mossy pauldron
        if side < 0:
            for m_i, (mx, mz) in enumerate(((-0.56, -0.06), (-0.46, 0.06))):
                add_limb_tube(
                    f"moss_guardian_shroom_stem_{m_i}",
                    root,
                    mats["bone"],
                    (mx, py + 0.18, mz),
                    (mx - 0.02, py + 0.28, mz),
                    0.016,
                    0.012,
                    segs=8,
                )
                add_sphere(
                    f"moss_guardian_shroom_cap_{m_i}",
                    root,
                    mats["glow_emerald"],
                    0.048,
                    0.028,
                    0.048,
                    tx=mx - 0.02,
                    ty=py + 0.29,
                    tz=mz,
                )

    # HeadGroup at (0.02, 1.62, -0.18): craggy bark-mask head with glowing emerald eyes + branching wooden antlers
    head_piv = create_pivot("moss_guardian_HeadGroup", root, 0.02, 1.62, -0.18)
    add_box("moss_guardian_bark_mask", head_piv, mats["bark"], 0.34, 0.38, 0.28, tx=0.0, ty=0.14, tz=-0.04, bevel=0.05)
    add_sphere("moss_guardian_crown_moss", head_piv, mats["moss"], 0.20, 0.09, 0.16, tx=0.0, ty=0.33, tz=-0.02)
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"moss_guardian_eye_{s_tag}",
            head_piv,
            mats["glow_emerald"],
            0.038,
            0.024,
            0.024,
            tx=side * 0.085,
            ty=0.16,
            tz=-0.185,
            rz=-side * 0.15,
            no_outline=True,
        )
        # Tall branching wooden antlers sprouting leaf clusters
        antler_main = [
            (side * 0.12, 0.28, -0.02, 0.042, 0.042),
            (side * 0.24, 0.46, 0.02, 0.034, 0.034),
            (side * 0.36, 0.68, 0.06, 0.024, 0.024),
            (side * 0.28, 0.88, 0.02, 0.012, 0.012),
        ]
        add_curved_tube(f"moss_guardian_antler_{s_tag}", head_piv, mats["wood"], antler_main, segs=10)
        add_limb_tube(
            f"moss_guardian_antler_tine_{s_tag}",
            head_piv,
            mats["wood"],
            (side * 0.24, 0.48, 0.02),
            (side * 0.44, 0.62, -0.08),
            0.024,
            0.008,
            segs=8,
        )
        add_sphere(
            f"moss_guardian_leaf_cluster_{s_tag}",
            head_piv,
            mats["moss"],
            0.085,
            0.065,
            0.075,
            tx=side * 0.35,
            ty=0.72,
            tz=0.04,
        )

    # LeftArmPivot (-0.62, 1.40, 0) & RightArmPivot (0.58, 1.38, 0)
    left_arm = create_pivot("moss_guardian_LeftArmPivot", root, -0.62, 1.40, 0.0)
    right_arm = create_pivot("moss_guardian_RightArmPivot", root, 0.58, 1.38, 0.0)

    # Left arm: gnarled root-tendril limb & wooden claws
    add_limb_tube("moss_guardian_uarm_L", left_arm, mats["bark"], (0.0, 0.0, 0.0), (-0.10, -0.38, -0.08), 0.13, 0.10, segs=12)
    add_limb_tube("moss_guardian_farm_L", left_arm, mats["wood"], (-0.10, -0.38, -0.08), (-0.08, -0.78, -0.24), 0.11, 0.09, segs=12)
    for c_i, c_off in enumerate((-0.05, 0.0, 0.05)):
        add_cone_spike(
            f"moss_guardian_claw_L_{c_i}",
            left_arm,
            mats["bark"],
            base_r=0.028,
            length=0.16,
            tx=-0.08 + c_off,
            ty=-0.78,
            tz=-0.26,
            rx=math.pi * 0.78,
            segs=8,
        )

    # Right arm: massive stone-boulder crushing gauntlet overgrown with vines and moss
    add_limb_tube("moss_guardian_uarm_R", right_arm, mats["bark"], (0.0, 0.0, 0.0), (0.12, -0.36, -0.08), 0.14, 0.12, segs=12)
    add_box(
        "moss_guardian_boulder_gauntlet",
        right_arm,
        mats["stone"],
        0.38,
        0.48,
        0.38,
        tx=0.14,
        ty=-0.66,
        tz=-0.22,
        rx=-0.24,
        bevel=0.06,
    )
    add_sphere("moss_guardian_gauntlet_moss", right_arm, mats["moss"], 0.20, 0.14, 0.20, tx=0.14, ty=-0.46, tz=-0.22)

    # LeftLegPivot (-0.24, 0.78, 0) & RightLegPivot (0.26, 0.78, 0)
    for side, piv_name, lx in ((-1.0, "moss_guardian_LeftLegPivot", -0.24), (1.0, "moss_guardian_RightLegPivot", 0.26)):
        leg_piv = create_pivot(piv_name, root, lx, 0.78, 0.0)
        add_limb_tube(f"{piv_name}_trunk", leg_piv, mats["bark"], (0.0, 0.0, 0.0), (0.0, -0.72, 0.0), 0.17, 0.19, segs=14)
        add_sphere(f"{piv_name}_knee_stone", leg_piv, mats["stone"], 0.14, 0.12, 0.14, tx=0.0, ty=-0.34, tz=-0.08)
        for r_i, r_ang in enumerate((-0.45, 0.0, 0.45)):
            add_cone_spike(
                f"{piv_name}_root_claw_{r_i}",
                leg_piv,
                mats["wood"],
                base_r=0.045,
                length=0.22,
                tx=math.sin(r_ang) * 0.10,
                ty=-0.72,
                tz=-0.10,
                rx=-math.pi * 0.46,
                ry=-r_ang,
                segs=8,
            )

    return root


# =============================================================================
# 9. Monster_lesser_demon (Lesser Demon)
# =============================================================================
def build_lesser_demon(grid_pos: tuple[float, float, float], mats: dict):
    root = create_pivot("Monster_lesser_demon", None, *grid_pos)
    head_piv = create_pivot("lesser_demon_HeadGroup", root, 0.0, 1.88, 0.0)
    left_arm = create_pivot("lesser_demon_LeftArmPivot", root, -0.46, 1.48, 0.0)
    right_arm = create_pivot("lesser_demon_RightArmPivot", root, 0.46, 1.48, 0.0)
    left_leg = create_pivot("lesser_demon_LeftLegPivot", root, -0.16, 0.78, 0.0)
    right_leg = create_pivot("lesser_demon_RightLegPivot", root, 0.16, 0.78, 0.0)

    # Ribbed bat-like demon wings under `lesser_demon_LWing` (-0.28, 1.50, 0.12) & `lesser_demon_RWing` (0.28, 1.50, 0.12)
    for side, w_name in ((-1.0, "lesser_demon_LWing"), (1.0, "lesser_demon_RWing")):
        wing_piv = create_pivot(w_name, root, side * 0.28, 1.50, 0.12)
        elbow = (side * 0.48, 0.42, 0.18)
        tip_top = (side * 1.12, 0.66, 0.28)
        tip_mid = (side * 1.04, 0.12, 0.26)
        tip_bot = (side * 0.66, -0.34, 0.22)
        tip_in = (side * 0.18, -0.38, 0.14)
        add_limb_tube(f"{w_name}_strut_root", wing_piv, mats["horn"], (0.0, 0.0, 0.0), elbow, 0.045, 0.035, segs=10)
        for f_i, tip in enumerate((tip_top, tip_mid, tip_bot)):
            add_limb_tube(f"{w_name}_finger_{f_i}", wing_piv, mats["horn"], elbow, tip, 0.028, 0.010, segs=8)
        add_wing_web(f"{w_name}_web_1", wing_piv, mats["wing"], elbow, tip_top, tip_mid)
        add_wing_web(f"{w_name}_web_2", wing_piv, mats["wing"], elbow, tip_mid, tip_bot)
        add_wing_web(f"{w_name}_web_3", wing_piv, mats["wing"], (0.0, 0.0, 0.0), elbow, tip_in, scallop_dip=0.02)

    # Jagged obsidian/hellfire demon cleaver blade with glowing orange lava edge under `lesser_demon_RightArmPivot`
    add_limb_tube(
        "lesser_demon_cleaver_hilt",
        right_arm,
        mats["obsidian"],
        (0.06, -0.72, -0.08),
        (0.06, -0.42, -0.42),
        0.028,
        0.032,
        segs=10,
    )
    add_box(
        "lesser_demon_cleaver_blade",
        right_arm,
        mats["obsidian"],
        0.04,
        0.22,
        0.68,
        tx=0.06,
        ty=-0.20,
        tz=-0.72,
        rx=-0.65,
        bevel=0.02,
    )
    add_box(
        "lesser_demon_cleaver_lava_edge",
        right_arm,
        mats["glow_orange"],
        0.048,
        0.055,
        0.66,
        tx=0.06,
        ty=-0.28,
        tz=-0.76,
        rx=-0.65,
        bevel=0.01,
    )

    torso_sections = [
        (0.72, 0.21, 0.16, 0.0, 0.0, 0.24, 0.01, 0.02),
        (0.94, 0.19, 0.15, 0.0, 0.0, 0.22, 0.03, 0.03),
        (1.18, 0.26, 0.19, 0.0, -0.01, 0.26, 0.05, 0.04),
        (1.44, 0.36, 0.23, 0.0, -0.02, 0.28, 0.07, 0.05),
        (1.66, 0.38, 0.22, 0.0, -0.01, 0.24, 0.04, 0.04),
        (1.82, 0.20, 0.16, 0.0, 0.0, 0.18, 0.0, 0.02),
    ]
    add_lathe("lesser_demon_torso", root, mats["skin_lesser_demon"], torso_sections, segs=24)
    add_lathe(
        "lesser_demon_waist_chain",
        root,
        mats["obsidian"],
        [(0.74, 0.23, 0.18, 0.0, 0.0, 0.25), (0.83, 0.23, 0.18, 0.0, 0.0, 0.25)],
        segs=20,
    )
    add_box("lesser_demon_loincloth", root, mats["obsidian"], 0.18, 0.32, 0.04, tx=0.0, ty=0.62, tz=-0.17)
    for m_i in range(4):
        add_cone_spike(
            f"lesser_demon_dorsal_spike_{m_i}",
            root,
            mats["horn"],
            base_r=0.035,
            length=0.14,
            tx=0.0,
            ty=1.22 + m_i * 0.14,
            tz=0.19,
            rx=math.pi * 0.38,
            segs=8,
        )

    tail_pts = [
        (0.0, 0.78, 0.16, 0.065, 0.065),
        (0.0, 0.62, 0.44, 0.048, 0.048),
        (0.08, 0.58, 0.76, 0.036, 0.036),
        (0.14, 0.78, 1.04, 0.028, 0.028),
        (0.06, 1.06, 1.22, 0.020, 0.020),
    ]
    add_curved_tube("lesser_demon_tail", root, mats["skin_lesser_demon"], tail_pts, segs=12)
    add_cone_spike(
        "lesser_demon_tail_spade",
        root,
        mats["horn"],
        base_r=0.065,
        length=0.18,
        tx=0.06,
        ty=1.05,
        tz=1.21,
        rx=0.55,
        flatten_x=0.35,
        segs=8,
    )

    add_lathe(
        "lesser_demon_skull",
        head_piv,
        mats["skin_lesser_demon"],
        [
            (-0.04, 0.14, 0.15, 0.0, 0.0, 0.22),
            (0.08, 0.18, 0.20, 0.0, -0.02, 0.24),
            (0.20, 0.17, 0.19, 0.0, -0.01, 0.22),
            (0.30, 0.12, 0.14, 0.0, 0.01, 0.18),
        ],
        segs=20,
    )
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"lesser_demon_eye_{s_tag}",
            head_piv,
            mats["glow_yellow"],
            0.032,
            0.020,
            0.020,
            tx=side * 0.065,
            ty=0.14,
            tz=-0.185,
            rz=-side * 0.24,
            no_outline=True,
        )
        add_cone_spike(
            f"lesser_demon_fang_{s_tag}",
            head_piv,
            mats["bone"],
            base_r=0.018,
            length=0.065,
            tx=side * 0.055,
            ty=0.04,
            tz=-0.19,
            rx=math.pi,
            segs=8,
        )
        horn_pts = [
            (side * 0.12, 0.22, -0.02, 0.062, 0.062),
            (side * 0.28, 0.28, 0.06, 0.050, 0.050),
            (side * 0.38, 0.42, 0.02, 0.036, 0.036),
            (side * 0.32, 0.56, -0.10, 0.022, 0.022),
            (side * 0.22, 0.64, -0.20, 0.008, 0.008),
        ]
        add_curved_tube(f"lesser_demon_horn_{s_tag}", head_piv, mats["horn"], horn_pts, segs=12)

    for side, arm_piv, s_tag in ((-1.0, left_arm, "L"), (1.0, right_arm, "R")):
        elbow = (side * 0.06, -0.30, -0.06)
        hand = (side * 0.05, -0.58, -0.24)
        add_limb_tube(f"lesser_demon_uarm_{s_tag}", arm_piv, mats["skin_lesser_demon"], (-side * 0.12, 0.08, 0.0), elbow, 0.145, 0.088, segs=12)
        add_limb_tube(f"lesser_demon_farm_{s_tag}", arm_piv, mats["skin_lesser_demon"], elbow, hand, 0.092, 0.072, segs=12)
        add_sphere(f"lesser_demon_hand_{s_tag}", arm_piv, mats["skin_lesser_demon"], 0.075, tx=hand[0], ty=hand[1], tz=hand[2])

    for side, piv_name in ((-1.0, "lesser_demon_LeftLegPivot"), (1.0, "lesser_demon_RightLegPivot")):
        leg_piv = left_leg if side < 0 else right_leg
        knee = (side * 0.04, -0.28, -0.14)
        hock = (side * 0.04, -0.50, 0.12)
        hoof_top = (side * 0.04, -0.70, -0.04)
        add_limb_tube(f"{piv_name}_thigh", leg_piv, mats["skin_lesser_demon"], (0.0, 0.0, 0.0), knee, 0.125, 0.092, segs=12)
        add_limb_tube(f"{piv_name}_calf", leg_piv, mats["skin_lesser_demon"], knee, hock, 0.092, 0.068, segs=12)
        add_limb_tube(f"{piv_name}_fetlock", leg_piv, mats["skin_lesser_demon"], hock, hoof_top, 0.068, 0.058, segs=10)
        add_box(
            f"{piv_name}_cloven_hoof",
            leg_piv,
            mats["horn"],
            0.14,
            0.12,
            0.18,
            tx=side * 0.04,
            ty=-0.72,
            tz=-0.06,
            bevel=0.02,
        )

    return root


# =============================================================================
# 10. Monster_elvarg_dragon (Elvarg the Crag Dragon - World Boss)
# =============================================================================
def build_elvarg_dragon(grid_pos: tuple[float, float, float], mats: dict):
    root = create_pivot("Monster_elvarg_dragon", None, *grid_pos)
    head_piv = create_pivot("elvarg_dragon_HeadGroup", root, 0.0, 3.25, -2.60)
    l_wing = create_pivot("elvarg_dragon_LWing", root, -0.90, 2.35, -0.40)
    r_wing = create_pivot("elvarg_dragon_RWing", root, 0.90, 2.35, -0.40)
    left_arm = create_pivot("elvarg_dragon_LeftArmPivot", root, -0.95, 1.20, -0.85)
    right_arm = create_pivot("elvarg_dragon_RightArmPivot", root, 0.95, 1.20, -0.85)
    left_leg = create_pivot("elvarg_dragon_LeftLegPivot", root, -0.80, 1.20, 0.90)
    right_leg = create_pivot("elvarg_dragon_RightLegPivot", root, 0.80, 1.20, 0.90)

    # Massive green dragon body along Z with muscular shoulders and haunches
    body_sections = [
        (-1.45, 0.52, 0.46, 0.0, 1.52, 0.18, 0.06, 0.10),
        (-0.95, 0.88, 0.72, 0.0, 1.48, 0.22, 0.14, 0.14),
        (-0.30, 0.96, 0.78, 0.0, 1.46, 0.22, 0.18, 0.16),
        (0.45, 0.84, 0.70, 0.0, 1.48, 0.20, 0.12, 0.14),
        (1.15, 0.68, 0.58, 0.0, 1.44, 0.18, 0.06, 0.12),
        (1.65, 0.42, 0.38, 0.0, 1.36, 0.15, 0.02, 0.08),
    ]
    add_lathe("elvarg_body", root, mats["skin_elvarg_dragon"], body_sections, segs=26, axis="Z")

    # Golden belly scutes (`elvarg_belly`) running under chest and abdomen
    belly_sections = [
        (-1.38, 0.36, 0.22, 0.0, 1.16, 0.25),
        (-0.85, 0.58, 0.28, 0.0, 0.96, 0.28),
        (-0.20, 0.62, 0.30, 0.0, 0.92, 0.28),
        (0.50, 0.52, 0.26, 0.0, 0.98, 0.26),
        (1.15, 0.36, 0.20, 0.0, 1.08, 0.22),
    ]
    add_lathe("elvarg_belly", root, mats["gold"], belly_sections, segs=20, axis="Z")

    # S-curved armored neck rising to (0, 3.75, -3.15)
    neck_pts = [
        (0.0, 1.62, -1.30, 0.46, 0.48),
        (0.0, 2.05, -1.85, 0.38, 0.42),
        (0.0, 2.65, -2.25, 0.33, 0.36),
        (0.0, 3.25, -2.60, 0.29, 0.32),
        (0.0, 3.65, -2.95, 0.27, 0.30),
        (0.0, 3.75, -3.15, 0.30, 0.32),
    ]
    add_curved_tube("elvarg_neck", root, mats["skin_elvarg_dragon"], neck_pts, segs=20, dorsal_ridge=0.18)

    # Fierce sculpted dragon head at (0, 3.75, -3.15): upper snout, horned brow ridges, roaring lower jaw, fangs, golden eyes & horns
    snout_sections = [
        (-4.15, 0.14, 0.12, 0.0, 3.68, 0.28, 0.0, 0.04),
        (-3.80, 0.24, 0.18, 0.0, 3.74, 0.28, 0.0, 0.06),
        (-3.45, 0.34, 0.26, 0.0, 3.80, 0.26, 0.0, 0.08),
        (-3.00, 0.38, 0.32, 0.0, 3.80, 0.24, 0.0, 0.06),
    ]
    add_lathe("elvarg_upper_snout", root, mats["skin_elvarg_dragon"], snout_sections, segs=20, axis="Z")

    # Roaring open lower jaw angled downward + rows of sharp white fangs
    add_box(
        "elvarg_lower_jaw",
        root,
        mats["skin_elvarg_dragon"],
        0.42,
        0.16,
        0.88,
        tx=0.0,
        ty=3.34,
        tz=-3.52,
        rx=-0.34,
        bevel=0.04,
    )
    for f_i in range(4):
        fz = -3.98 + f_i * 0.16
        for side in (-1.0, 1.0):
            add_cone_spike(
                f"elvarg_fang_top_{'L' if side < 0 else 'R'}_{f_i}",
                root,
                mats["bone"],
                base_r=0.025,
                length=0.11,
                tx=side * (0.14 + f_i * 0.02),
                ty=3.62,
                tz=fz,
                rx=math.pi,
                segs=8,
            )
            add_cone_spike(
                f"elvarg_fang_bot_{'L' if side < 0 else 'R'}_{f_i}",
                root,
                mats["bone"],
                base_r=0.022,
                length=0.095,
                tx=side * (0.12 + f_i * 0.02),
                ty=3.26 + f_i * 0.05,
                tz=fz,
                rx=-0.25,
                segs=8,
            )

    # Glowing golden dragon eyes + 2 sweeping curved golden crown horns + 4 cheek spikes
    for side, s_tag in ((-1.0, "L"), (1.0, "R")):
        add_sphere(
            f"elvarg_eye_{s_tag}",
            root,
            mats["glow_yellow"],
            0.058,
            0.038,
            0.045,
            tx=side * 0.24,
            ty=3.84,
            tz=-3.48,
            ry=side * 0.35,
            no_outline=True,
        )
        crown_horn = [
            (side * 0.22, 3.92, -3.12, 0.10, 0.10),
            (side * 0.38, 4.18, -2.72, 0.075, 0.075),
            (side * 0.52, 4.46, -2.28, 0.048, 0.048),
            (side * 0.58, 4.68, -1.88, 0.016, 0.016),
        ]
        add_curved_tube(f"elvarg_crown_horn_{s_tag}", root, mats["gold"], crown_horn, segs=14)
        for ch_i in range(2):
            add_cone_spike(
                f"elvarg_cheek_spike_{s_tag}_{ch_i}",
                root,
                mats["gold"],
                base_r=0.042,
                length=0.22,
                tx=side * 0.32,
                ty=3.68 - ch_i * 0.10,
                tz=-3.18 + ch_i * 0.14,
                rx=0.45,
                rz=-side * 1.15,
                segs=8,
            )

    # Long S-curved whip tail (z up to 4.8) ending in a spiked tail club
    tail_pts = [
        (0.0, 1.36, 1.55, 0.38, 0.36),
        (0.14, 1.12, 2.25, 0.28, 0.27),
        (0.26, 0.92, 2.95, 0.21, 0.20),
        (0.08, 0.84, 3.65, 0.15, 0.15),
        (-0.14, 0.96, 4.25, 0.11, 0.11),
        (0.0, 1.18, 4.80, 0.08, 0.08),
    ]
    add_curved_tube("elvarg_tail", root, mats["skin_elvarg_dragon"], tail_pts, segs=18, dorsal_ridge=0.16)
    add_sphere("elvarg_tail_club", root, mats["gold"], 0.18, 0.14, 0.24, tx=0.0, ty=1.18, tz=4.78)
    for tc_side in (-1.0, 1.0):
        add_cone_spike(
            f"elvarg_tail_club_spike_{'L' if tc_side < 0 else 'R'}",
            root,
            mats["gold"],
            base_r=0.048,
            length=0.26,
            tx=tc_side * 0.14,
            ty=1.18,
            tz=4.78,
            rz=-tc_side * math.pi * 0.48,
            segs=8,
        )

    # Dorsal spine ridge of 16 golden horns running from neck down the tail
    spine_coords = [
        (0.0, 3.55, -2.80, 0.22),
        (0.0, 3.15, -2.50, 0.24),
        (0.0, 2.60, -2.18, 0.26),
        (0.0, 2.15, -1.78, 0.28),
        (0.0, 2.12, -1.15, 0.30),
        (0.0, 2.22, -0.65, 0.34),
        (0.0, 2.24, -0.15, 0.34),
        (0.0, 2.18, 0.35, 0.32),
        (0.0, 2.06, 0.85, 0.28),
        (0.0, 1.84, 1.35, 0.25),
        (0.06, 1.52, 1.88, 0.22),
        (0.18, 1.24, 2.45, 0.20),
        (0.24, 1.04, 3.05, 0.18),
        (0.10, 0.96, 3.60, 0.16),
        (-0.08, 1.02, 4.10, 0.15),
        (-0.04, 1.14, 4.48, 0.14),
    ]
    for sp_i, (sx, sy, sz, sh) in enumerate(spine_coords):
        add_cone_spike(
            f"elvarg_dorsal_horn_{sp_i}",
            root,
            mats["gold"],
            base_r=sh * 0.24,
            length=sh,
            tx=sx,
            ty=sy,
            tz=sz,
            rx=0.42,
            curve_bend=0.04,
            segs=8,
        )

    # Colossal ribbed dragon wings (`span ~ 4.2m` each) under `elvarg_dragon_LWing` & `elvarg_dragon_RWing`
    for side, w_name in ((-1.0, "elvarg_dragon_LWing"), (1.0, "elvarg_dragon_RWing")):
        wing_piv = l_wing if side < 0 else r_wing
        elbow = (side * 1.45, 1.15, -0.15)
        wrist = (side * 2.45, 1.65, 0.10)
        tip_1 = (side * 4.20, 1.95, 0.45)
        tip_2 = (side * 3.85, 0.65, 0.55)
        tip_3 = (side * 2.85, -0.35, 0.65)
        tip_4 = (side * 1.55, -0.65, 0.60)
        body_anchor = (side * 0.10, -0.45, 0.85)

        add_limb_tube(f"{w_name}_humerus", wing_piv, mats["skin_elvarg_dragon"], (0.0, 0.0, 0.0), elbow, 0.14, 0.11, segs=12)
        add_limb_tube(f"{w_name}_radius", wing_piv, mats["skin_elvarg_dragon"], elbow, wrist, 0.11, 0.085, segs=12)
        # Golden thumb claw at the wing bend
        add_cone_spike(
            f"{w_name}_thumb_claw",
            wing_piv,
            mats["gold"],
            base_r=0.055,
            length=0.28,
            tx=wrist[0],
            ty=wrist[1],
            tz=wrist[2] - 0.06,
            rx=-0.85,
            rz=-side * 0.35,
            segs=8,
        )
        for f_i, f_tip in enumerate((tip_1, tip_2, tip_3, tip_4)):
            add_limb_tube(f"{w_name}_finger_{f_i}", wing_piv, mats["horn"], wrist, f_tip, 0.065, 0.022, segs=10)

        add_wing_web(f"{w_name}_membrane_1", wing_piv, mats["wing_dragon"], wrist, tip_1, tip_2, thickness=0.025)
        add_wing_web(f"{w_name}_membrane_2", wing_piv, mats["wing_dragon"], wrist, tip_2, tip_3, thickness=0.025)
        add_wing_web(f"{w_name}_membrane_3", wing_piv, mats["wing_dragon"], wrist, tip_3, tip_4, thickness=0.025)
        add_wing_web(f"{w_name}_membrane_4", wing_piv, mats["wing_dragon"], elbow, tip_4, body_anchor, thickness=0.025)

    # 4 Dragon Leg Pivots:
    limb_specs = [
        (-1.0, "elvarg_dragon_LeftArmPivot", left_arm, -0.18),
        (1.0, "elvarg_dragon_RightArmPivot", right_arm, -0.18),
        (-1.0, "elvarg_dragon_LeftLegPivot", left_leg, 0.22),
        (1.0, "elvarg_dragon_RightLegPivot", right_leg, 0.22),
    ]
    for side, piv_name, leg_piv, knee_z in limb_specs:
        knee = (side * 0.14, -0.54, knee_z)
        ankle = (side * 0.08, -1.04, -0.08)
        add_limb_tube(f"{piv_name}_thigh", leg_piv, mats["skin_elvarg_dragon"], (0.0, 0.0, 0.0), knee, 0.28, 0.20, segs=16)
        add_limb_tube(f"{piv_name}_shin", leg_piv, mats["skin_elvarg_dragon"], knee, ankle, 0.21, 0.15, segs=16)
        add_box(
            f"{piv_name}_foot",
            leg_piv,
            mats["skin_elvarg_dragon"],
            0.36,
            0.16,
            0.44,
            tx=side * 0.08,
            ty=-1.12,
            tz=-0.18,
            bevel=0.04,
        )
        for c_i, c_off in enumerate((-0.11, 0.0, 0.11)):
            add_cone_spike(
                f"{piv_name}_talon_{c_i}",
                leg_piv,
                mats["gold"],
                base_r=0.042,
                length=0.22,
                tx=side * 0.08 + c_off,
                ty=-1.14,
                tz=-0.40,
                rx=-math.pi * 0.48,
                curve_bend=-0.04,
                segs=8,
            )

    return root


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
        scene.render.filepath = render_path
        bpy.ops.render.render(write_still=True)
        print(f"[Blender] Rendered monsters preview image: {render_path}")


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    blend_dir = os.path.join(repo_root, "blender")
    models_dir = os.path.join(repo_root, "public", "models")
    os.makedirs(blend_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    render_path = r"C:\Users\User\.gemini\antigravity-cli\brain\28c9539a-1323-4489-8927-620e19a4a583\scratch\monsters_render.png"
    if "--" in sys.argv:
        extra = sys.argv[sys.argv.index("--") + 1 :]
        if "--render" in extra:
            idx = extra.index("--render")
            if idx + 1 < len(extra):
                render_path = extra[idx + 1]

    clear_scene()
    mats = build_materials()

    # Build all 10 Monster species on a 2-row showcase grid (Three.js X, Y=0, Z)
    # Front row (Z = -1.6 -> Blender Y = +1.6, closer to camera at Y = +12.8)
    build_chicken((-5.2, 0.0, -2.0), mats)
    build_goblin((-3.0, 0.0, -2.0), mats)
    build_goblin_archer((-0.8, 0.0, -2.0), mats)
    build_scorpion((1.8, 0.0, -2.0), mats)
    build_dark_wizard((4.4, 0.0, -2.0), mats)

    # Back row (Z = +2.4 -> Blender Y = -2.4, behind front row)
    build_dark_ranger((-6.0, 0.0, 2.2), mats)
    build_hill_giant((-3.4, 0.0, 2.2), mats)
    build_moss_guardian((-0.6, 0.0, 2.2), mats)
    build_lesser_demon((2.2, 0.0, 2.2), mats)
    build_elvarg_dragon((6.2, 0.0, 2.6), mats)

    blend_path = os.path.join(blend_dir, "monsters.blend")
    glb_path = os.path.join(models_dir, "monsters.glb")

    # Export clean glTF binary before adding studio camera/lights/floor
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_yup=True,
        export_extras=True,
    )
    print(f"[Blender] Exported glTF binary: {glb_path}")

    setup_studio_and_render(render_path)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[Blender] Saved editable source file: {blend_path}")


if __name__ == "__main__":
    main()
