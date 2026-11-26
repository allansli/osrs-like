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
 10. Monster_elvarg_dragon    - Elvarg the Crag Dragon world boss, a new skinned model on the dragon rig: low heavy-shouldered body, wedge head with a jaw, swept horns, crag plates down the spine, raised wings & spade tail
"""

import math
import os
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


def load_imported_character(blend_rel_path: str, mesh_names: list[str], target_height: float, rot_z_180: bool = True):
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    blend_file = os.path.join(repo_root, blend_rel_path)
    if not os.path.exists(blend_file):
        return None
    try:
        with bpy.data.libraries.load(blend_file) as (df, dt):
            # Also pull in the armature: eyes/teeth are bone-parented to it, so their
            # world matrices are only correct when the armature is evaluated.
            wanted = [o for o in mesh_names if o in df.objects]
            if "Armature" in df.objects and "Armature" not in wanted:
                wanted.append("Armature")
            dt.objects = wanted
        for o in dt.objects:
            if o.name not in bpy.context.collection.objects:
                bpy.context.collection.objects.link(o)

        # Force rest pose so bone-parented parts line up with the (armature-free) rest-pose body.
        for o in dt.objects:
            if o.type == 'ARMATURE':
                o.data.pose_position = 'REST'

        for o in dt.objects:
            if o.type == 'MESH':
                for m in list(o.modifiers):
                    if m.type == 'ARMATURE':
                        o.modifiers.remove(m)
        bpy.context.view_layer.update()
        
        main_obj = next((o for o in dt.objects if o.name in mesh_names and o.type == 'MESH'), None)
        if not main_obj:
            for o in dt.objects:
                bpy.data.objects.remove(o, do_unlink=True)
            return None
            
        raw_verts = [main_obj.matrix_world @ v.co for v in main_obj.data.vertices]
        min_x = min(v.x for v in raw_verts)
        max_x = max(v.x for v in raw_verts)
        min_y = min(v.y for v in raw_verts)
        max_y = max(v.y for v in raw_verts)
        min_z = min(v.z for v in raw_verts)
        max_z = max(v.z for v in raw_verts)
        mid_x = (min_x + max_x) * 0.5
        mid_y = (min_y + max_y) * 0.5
        h = max_z - min_z
        scale = target_height / h if h > 0.001 else 1.0
        
        rot_m = Matrix.Rotation(math.pi, 4, 'Z') if rot_z_180 else Matrix.Identity(4)
        scale_m = Matrix.Scale(scale, 4)
        trans_m = Matrix.Translation(Vector((-mid_x, -mid_y, -min_z)))
        xform = scale_m @ rot_m @ trans_m
        
        result_bms = {}
        for mname in mesh_names:
            o = next((obj for obj in dt.objects if obj.name == mname and obj.type == 'MESH'), None)
            if not o:
                o = next((obj for obj in dt.objects if obj.name.startswith(mname) and obj.type == 'MESH'), None)
            if o:
                bm = bmesh.new()
                bm.from_mesh(o.data)
                bm.transform(o.matrix_world)
                bm.transform(xform)
                result_bms[mname] = bm
                
        for o in dt.objects:
            bpy.data.objects.remove(o, do_unlink=True)
        return result_bms
    except Exception as e:
        print(f"[load_imported_character] Error loading {blend_rel_path}: {e}")
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


def _goblin_hide_mean(tile: str = GOBLIN_HIDE_TILE) -> list:
    """Mean colour of an albedo tile (the goblin-hide tile by default), linear, read from the engine's own file."""
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


def _goblin_tint(obj, colour, planes: bool = False) -> None:
    """
    A 'Tint' colour on every face corner, which the paint layer multiplies. All the goblin's
    materials are white, so the tint is the colour itself: a hex colour, or linear RGB for the
    skin (the colour over the hide tile's mean). With planes, each face's corners also take the
    tone of the face's plane (_goblin_plane_tones).
    """
    tint = list(hex_to_rgba(colour)[:3]) if isinstance(colour, int) else colour
    tones = _goblin_plane_tones(obj) if planes else [1.0] * len(obj.data.polygons)
    cols = []
    for p, tone in zip(obj.data.polygons, tones):
        cols += [*(c * tone for c in tint), 1.0] * len(p.vertices)
    obj.data.color_attributes.new("Tint", "FLOAT_COLOR", "CORNER").data.foreach_set("color", cols)


def _goblin_skin(ob, name: str, mat, triangles: int, soften: int, keep: tuple = (), crease: float | None = None):
    """
    Rounds a voxel skin (soften smoothing passes), cuts it flat at the ground, decimates it to its
    triangle count, validates, names it and gives it its one material. keep is (centre, radius)
    balls in Blender space whose inside takes a fifth of the smoothing, rising to all of it at
    1.6 radii: the passes shrink a limb's end to a stump, and a hand or a foot has to keep its
    shape. crease is an angle: every edge whose faces meet more sharply is marked hard, and so is
    every edge between two planes of _goblin_planes, so the exporter splits its vertices and the
    form reads as carved planes; None leaves all smooth.
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
        plane = _goblin_planes(bm, crease)
        for e in bm.edges:
            e.smooth = plane[e.link_faces[0].index] == plane[e.link_faces[1].index] and e.calc_face_angle() < crease
        bm.to_mesh(ob.data)
        bm.free()
    return ob


def _goblin_planes(bm, crease: float) -> list:
    """
    The body's faces sorted into planes (plan S2c): from the largest free face, a plane grows across
    every edge under the crease angle to faces within GOBLIN_PLANE_SPREAD of that first face's
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
                    if plane[g.index] < 0 and g.normal.angle(seed.normal) < GOBLIN_PLANE_SPREAD:
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
            # The foot: one flat slab from the heel under the ankle joint to the toe box, 0.185 in
            # front. Both nodes are at one height, 0.05 tall, and reach under the ground, where
            # _goblin_skin cuts them flat. On this level edge the skin modifier's second radius is
            # the one across the foot: 0.062 at the heel, 0.075 at the toe box (0.16 wide as built).
            ((ankle[0], 0.045, 0.03), (0.05, 0.062)),
            ((ankle[0] * 1.03, 0.045, -0.155), (0.05, 0.075)),
        ])
        keep.append((Vector(t2b(ankle[0], 0.04, -0.07)), 0.17))
    return pts, edges, radii, keep


def _goblin_belt(body, mat):
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
                raise ValueError(f"goblin: the belt's ray at height {y}, angle {a:.2f} leaves the body without a hit")
            ring.append(bm.verts.new(hit + out * gap))
        rings.append(ring)
    for lo, hi in zip(rings, rings[1:]):
        for i in range(GOBLIN_BELT_SEGS):
            k = (i + 1) % GOBLIN_BELT_SEGS
            bm.faces.new((lo[i], lo[k], hi[k], hi[i]))
    return finalize_obj("gob_belt", bm, None, mat)


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


def _goblin_plane_tones(body, planes_out: list | None = None) -> list:
    """
    One tone per face of a part, the same for every face of a plane (plan S2c). A plane is the
    smooth faces joined by edges that are not hard, or one flat face of a faceted part; its tone
    comes from its area-weighted normal against GOBLIN_PLANE_LIGHT. Two corners of one vertex in
    different planes are parted by hard edges or flat faces, which the exporter splits anyway, so
    the tone costs no vertex. planes_out, if given, takes each face's plane index (the dragon
    colours its body by plane).
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
        tones.append(1.0 + s * (GOBLIN_PLANE_TONE[1] if s > 0.0 else -GOBLIN_PLANE_TONE[0]))
        areas.append(area)
    bm.free()
    total = sum(areas)
    top = sorted(areas, reverse=True)
    print(
        f"[Blender] goblin planes of {body.name}: {len(tones)} on {len(plane)} faces; largest {top[0] / total:.1%} of the area, "
        f"five largest {sum(top[:5]) / total:.1%}; tones {min(tones):.3f} to {max(tones):.3f}"
    )
    if planes_out is not None:
        planes_out.extend(plane)
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


def build_goblin(grid_pos: tuple[float, float, float], mats: dict):
    # grid_pos is not used: a skinned figure stands at the file's origin (design 6.1.1 rule 2b)
    import rigs  # the biped table; imported here because only this builder is skinned (plan S2)

    # White: vertex colour multiplies the material's colour and can only darken it, so every colour
    # of the raider is paint. The wood and the metal family have a white material of the goblin's own
    # too (the engine picks a family by 'wood' and 'bronze' in the name): on the shared mat_wood and
    # mat_bronze, wood stopped at 24% value and bronze at 48%.
    skin = make_mat("mat_skin_goblin_paint", 0xFFFFFF, roughness=0.58, metallic=0.04)
    wood = make_mat("mat_wood_goblin_paint", 0xFFFFFF, roughness=0.70, metallic=0.02)
    metal = make_mat("mat_bronze_goblin_paint", 0xFFFFFF, roughness=0.45, metallic=0.65)
    tile = _goblin_hide_mean()
    col = dict(GOBLIN_COLOURS, skin=_goblin_skin_paint(GOBLIN_COLOURS["skin"], tile), skin_dark=_goblin_skin_paint(GOBLIN_COLOURS["skin_dark"], tile))
    j = goblin_joints()
    hard = []  # (object, bone): rigid parts, weight 1 on one bone

    def add(obj, bone: str, colour: int, planes: bool = False):
        _goblin_tint(obj, colour, planes)
        hard.append((obj, f"goblin_{bone}"))

    def aim(d) -> dict:
        """The rx and rz that turn a primitive's own +Y axis to the unit vector d."""
        return {"rx": math.asin(d.z), "rz": -math.atan2(d.x, d.y)}

    # Head: rigid with the head bone, its planes toned like the body's. The irises are their own
    # vertices, so the paint stays crisp.
    add(_goblin_head(skin), "HeadGroup", col["skin"], planes=True)
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        add(
            add_sphere(f"gob_iris_{tag}", None, skin, 0.055, 0.04, 0.022, tx=side * 0.10, ty=1.505, tz=-0.522, rz=side * -0.25, segs=8, rings=6),
            "HeadGroup",
            col["iris"],
        )
        # A dark pupil standing just proud of the iris, 0.048 wide: nothing on the face is thinner than 0.044
        add(
            add_sphere(f"gob_pupil_{tag}", None, skin, 0.024, 0.028, 0.014, tx=side * 0.10, ty=1.505, tz=-0.536, rz=side * -0.25, segs=8, rings=5),
            "HeadGroup",
            col["pupil"],
        )
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

    # Loincloth and belt hang from the hips, never from the legs
    # Each flap is 0.22 long (0.30 before S2d) from the same top edge, and tapers to 0.6 of its width
    for name, tz, rx in (("gob_cloth_front", -0.16, -0.10), ("gob_cloth_back", 0.19, 0.10)):
        flap = add_box(name, None, skin, 0.20, 0.22, 0.05, tx=0.0, ty=0.57, tz=tz, rx=rx, bevel=0.0)
        heights = [v.co.z for v in flap.data.vertices]
        for v in flap.data.vertices:
            v.co.x *= 0.6 + 0.4 * (v.co.z - min(heights)) / (max(heights) - min(heights))
        add(flap, "Hips", col["rust_cloth"])
    add(
        add_sphere("gob_pauldron", None, metal, 0.15, 0.10, 0.15, tx=-0.33, ty=1.28, tz=-0.10, rz=0.35, segs=6, rings=5, smooth=False),
        "LeftArmPivot",
        col["rust"],
        planes=True,
    )

    # A thumb on each fist: a blunt flat-faced block on the hand bone, lying up along the shaft on the
    # fist's inner front, half of it standing out of the fist
    for side, tag in ((-1.0, "Left"), (1.0, "Right")):
        h = Vector(j[f"{tag}Hand"])
        add(
            add_box(
                f"gob_thumb_{tag[0]}", None, skin, 0.055, 0.13, 0.06, tx=h.x - side * 0.075, ty=h.y + 0.045, tz=h.z - 0.10,
                bevel=0.0, **aim(Vector((-side * 0.15, 0.80, -0.58)).normalized()),
            ),
            f"{tag}Hand",
            col["skin_dark"],
            planes=True,
        )

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
        add_cone_spike(
            "gob_spear_head", None, metal, base_r=0.03, length=0.32, tx=top.x, ty=top.y, tz=top.z,
            segs=8, flatten_x=2.6, **aim(d),
        ),
        "WeaponPivot",
        col["bronze"],
    )

    # Round shield on the left forearm, facing out and forward. Its face lies along the forearm and stands
    # 0.15 off the forearm's axis, so the fist (0.133 from that axis at most) is behind the planks, not through them.
    f = _goblin_limb_dir(j["LeftElbowPivot"], j["LeftHand"])
    n = Vector((-0.80, 0.10, -0.59))
    n = (n - f * n.dot(f)).normalized()
    c = (Vector(j["LeftElbowPivot"]) + Vector(j["LeftHand"])) / 2.0 + n * 0.15
    face = aim(n)
    add(add_lathe("gob_shield_rim", None, metal, [(-0.02, 0.30, 0.30), (0.02, 0.30, 0.30)], segs=18, tx=c.x, ty=c.y, tz=c.z, **face), "OffhandPivot", col["bronze"])
    add(add_lathe("gob_shield_wood", None, wood, [(-0.026, 0.27, 0.27), (0.026, 0.27, 0.27)], segs=18, tx=c.x, ty=c.y, tz=c.z, **face), "OffhandPivot", col["wood"])
    boss = c + n * 0.03
    add(add_sphere("gob_shield_boss", None, metal, 0.09, tx=boss.x, ty=boss.y, tz=boss.z, segs=6, rings=4, smooth=False), "OffhandPivot", col["bronze"], planes=True)

    # Body: what is left of the triangle budget, with hard edges so its planes read (plan S2b)
    hard_tris = sum(len(p.vertices) - 2 for obj, _ in hard for p in obj.data.polygons)
    body_tris = GOBLIN_TRIANGLES - 40 - hard_tris - GOBLIN_BELT_SEGS * 6
    pts, edges, radii, keep = _goblin_body_graph(j)
    # organic_body's own decimate is left out (a ceiling it never reaches): the skin is softened first.
    # Fourteen passes round the skin modifier's square limbs and leave the joints standing.
    body = _goblin_skin(
        figkit.organic_body((pts, edges), radii, 0.02, 10**9), "gob_body", skin, body_tris, soften=14, keep=tuple(keep), crease=GOBLIN_CREASE
    )
    # No skin in front of the shield's planks: the fist stays behind them
    cb, nb = Vector(t2b(*c)), Vector(t2b(*n))
    through = sum(1 for v in body.data.vertices if (v.co - cb).dot(nb) > 0.026 and ((v.co - cb) - nb * (v.co - cb).dot(nb)).length < 0.27)
    if through:
        raise ValueError(f"goblin: {through} body vertices stand in front of the shield's planks")
    # The belt hangs from the hips like the loincloth, on the paint material like it (leather is
    # lighter than the shared mat_wood), and is laid on the finished body
    add(_goblin_belt(body, skin), "Hips", col["leather"])

    for obj in [body] + [obj for obj, _ in hard]:
        obj.data.transform(Matrix.Scale(GOBLIN_SCALE, 4))
    j = {k: tuple(c * GOBLIN_SCALE for c in p) for k, p in j.items()}
    rig = figkit.make_rig("Monster_goblin", rigs.BIPED_TABLE, {k: t2b(*p) for k, p in j.items()}, prefix="goblin")

    # Weight rule 1: the body takes automatic weights from the sixteen limb bones only. Jaw and the
    # two hand mounts hold rigid parts, and a Root bone standing from the ground to the hips would
    # take the inner legs, so the weighting rig leaves the three out and starts Root inside the pelvis.
    core = {k: t2b(*p) for k, p in j.items() if k not in ("Jaw", "WeaponPivot", "OffhandPivot")}
    core["Root"] = t2b(0.0, 0.64 * GOBLIN_SCALE, 0.04 * GOBLIN_SCALE)
    weight_rig = figkit.make_rig("goblin_weight_rig", rigs.BIPED_TABLE, core, prefix="goblin")
    figkit.auto_weights(body, weight_rig, limb_radius=0.12 * GOBLIN_SCALE)
    # Weight rule 2: Root deforms nothing; its share goes to Hips.
    figkit.fold_weights(
        body,
        {b.name: ([b.name, "goblin_Root"] if b.name == "goblin_Hips" else [b.name]) for b in weight_rig.data.bones if b.name != "goblin_Root"},
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
    names = {"skin": "goblin_body", "wood": "goblin_wood", "metal": "goblin_metal"}
    for ob in merged:
        ob.name = ob.data.name = names[figkit.get_material_family(ob)]

    _figure_paint(rig, merged, GOBLIN_OCCLUSION)

    tris = sum(len(p.vertices) - 2 for ob in merged for p in ob.data.polygons)
    if tris > GOBLIN_TRIANGLES:
        raise ValueError(f"goblin: {tris} triangles, over the budget of {GOBLIN_TRIANGLES}")
    print(f"[Blender] goblin: {tris} triangles in {len(merged)} meshes")
    return rig


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
    head_piv = create_pivot("lesser_demon_HeadGroup", root, 0.0, 1.88, -0.73)
    left_arm = create_pivot("lesser_demon_LeftArmPivot", root, -0.65, 1.45, -0.25)
    right_arm = create_pivot("lesser_demon_RightArmPivot", root, 0.65, 1.45, -0.25)
    left_leg = create_pivot("lesser_demon_LeftLegPivot", root, -0.25, 0.95, 0.05)
    right_leg = create_pivot("lesser_demon_RightLegPivot", root, 0.25, 0.95, 0.05)

    # Ribbed bat-like demon wings under `lesser_demon_LWing` & `lesser_demon_RWing`
    for side, w_name in ((-1.0, "lesser_demon_LWing"), (1.0, "lesser_demon_RWing")):
        wing_piv = create_pivot(w_name, root, side * 0.28, 1.50, 0.18)
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
        (0.32, -0.75, -0.20),
        (0.32, -0.45, -0.54),
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
        tx=0.32,
        ty=-0.23,
        tz=-0.84,
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
        tx=0.32,
        ty=-0.31,
        tz=-0.88,
        rx=-0.65,
        bevel=0.01,
    )

    imported_parts = load_imported_character(
        "blender/examples/red_devil_22787/RedDevil-Ex.blend",
        ["Devil", "TeethUpper", "TeethLower", "Eye.L", "Eye.R"],
        target_height=2.35,
        rot_z_180=True,
    )

    if imported_parts and "Devil" in imported_parts:
        finalize_obj(
            "lesser_demon_body",
            imported_parts["Devil"],
            root,
            mat=[mats["skin_lesser_demon"], mats["horn"], mats["horn"]],
            smooth=True,
        )
        if "TeethUpper" in imported_parts:
            finalize_obj("lesser_demon_teeth_upper", imported_parts["TeethUpper"], root, mat=mats["bone"], smooth=True)
        if "TeethLower" in imported_parts:
            finalize_obj("lesser_demon_teeth_lower", imported_parts["TeethLower"], root, mat=mats["bone"], smooth=True)
        if "Eye.L" in imported_parts:
            finalize_obj("lesser_demon_eye_l", imported_parts["Eye.L"], root, mat=mats["glow_yellow"], smooth=True, no_outline=True)
        if "Eye.R" in imported_parts:
            finalize_obj("lesser_demon_eye_r", imported_parts["Eye.R"], root, mat=mats["glow_yellow"], smooth=True, no_outline=True)
    else:
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


def _dragon_body_tint(body, spine: list, hide: list, dark: list, belly: list) -> None:
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
    tones = _goblin_plane_tones(body)
    cols = []
    for p, k, tone in zip(polys, kind, tones):
        cols += [*(c * tone for c in (hide, belly, dark)[k]), 1.0] * len(p.vertices)
    body.data.color_attributes.new("Tint", "FLOAT_COLOR", "CORNER").data.foreach_set("color", cols)
    print(f"[Blender] dragon body faces: {kind.count(1)} belly, {kind.count(2)} foot, of {len(kind)}")


def _dragon_membrane(name: str, mat, side: float, root: Vector, wrist: Vector, tips: list, flank: Vector, bones: tuple):
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
            f"drg_membrane_{tag}", wing, side, root, wrist, tips, flank,
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
    build_dark_wizard((4.4, 0.0, -2.0), mats)

    # Back row (Z = +2.4 -> Blender Y = -2.4, behind front row)
    build_dark_ranger((-6.0, 0.0, 2.2), mats)
    build_hill_giant((-3.4, 0.0, 2.2), mats)
    build_moss_guardian((-0.6, 0.0, 2.2), mats)
    build_lesser_demon((2.2, 0.0, 2.2), mats)
    build_elvarg_dragon((6.2, 0.0, 2.6), mats)

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
    )
    print(f"[Blender] Exported glTF binary: {glb_path}")

    setup_studio_and_render(render_path)
    bpy.ops.wm.save_as_mainfile(filepath=paths.blend_path("monsters"))
    print(f"[Blender] Saved editable source file: {blend_path}")


if __name__ == "__main__":
    main()
