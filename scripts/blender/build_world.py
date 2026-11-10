"""
Headless Blender 5.2 generator for the Gielinor World Asset Pack (`world.blend` & `world.glb`).

Generates 23 stylized sculpted OSRS-inspired world assets, resource nodes, interactive stations,
and biome landmarks rooted at `World_<id>` Empties:
  A. Resource Nodes:
     1. World_normal_tree
     2. World_oak_tree
     3. World_willow_tree
     4. World_maple_tree
     5. World_yew_tree
     6. World_magic_tree
     7. World_tree_stump
     8. World_ore_rock
     9. World_rock_depleted
    10. World_fishing_spot
  B. Interactive Stations & Structures:
    11. World_shrine
    12. World_altar
    13. World_forge
    14. World_bank_booth
    15. World_castle
  C. Biome Landmarks & Bridges:
    16. World_river_bridge
    17. World_sandstone_arch
    18. World_palm_tree
    19. World_plaza_pillar
    20. World_mystic_mushroom
    21. World_woods_lantern
    22. World_obsidian_spire
    23. World_lava_fissure

Coordinate Contract:
  - Built in Three.js coordinates (+X right, +Y up, -Z forward / +Z toward camera)
  - Converted to Blender (+X right, -Y toward camera, +Z up) via `t2b(tx, ty, tz) = (tx, -tz, ty)`
  - Every `World_<id>` root is an Empty placed in a Diorama Showcase Grid in `world.blend`
  - Every child mesh of `World_<id>` has `obj.location = (0, 0, 0)` and `obj.rotation_euler = (0, 0, 0)`
    with its `bmesh` vertices built in local Three.js origin space (`y = 0` at ground level).
"""

import math
import os
import sys
import bpy
import bmesh
from mathutils import Vector, Euler, Matrix


# =============================================================================
# BlendSwap Asset Cache & Loader
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


def add_imported_world_parts(
    asset_id: str,
    parent,
    src_obj: bpy.types.Object,
    mat_mapping: dict[int, bpy.types.Material],
    scale: float = 1.0,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    smooth: bool = True,
):
    bm_src = bmesh.new()
    bm_src.from_mesh(src_obj.data)
    min_z = min(v.co.z for v in bm_src.verts)

    for m_idx, mat in mat_mapping.items():
        bm_part = bm_src.copy()
        del_faces = [f for f in bm_part.faces if f.material_index != m_idx]
        bmesh.ops.delete(bm_part, geom=del_faces, context="FACES")
        del_verts = [v for v in bm_part.verts if not v.link_faces]
        bmesh.ops.delete(bm_part, geom=del_verts, context="VERTS")
        if not bm_part.faces:
            bm_part.free()
            continue

        bmesh.ops.recalc_face_normals(bm_part, faces=bm_part.faces)
        for v in bm_part.verts:
            bx = v.co.x * scale + tx
            by = v.co.y * scale - tz
            bz = (v.co.z - min_z) * scale + ty
            v.co = Vector((bx, by, bz))

        finalize_mesh(f"World_{asset_id}_{mat.name}", bm_part, parent, mat, smooth=smooth)
    bm_src.free()


# =============================================================================
# Coordinate Conversions & Scene Reset
# =============================================================================
def t2b(tx: float, ty: float, tz: float) -> tuple[float, float, float]:
    """Convert Three.js (tx, ty, tz) to Blender (bx, by, bz)."""
    return (tx, -tz, ty)


def t2b_pos(tx: float, ty: float, tz: float) -> tuple[float, float, float]:
    return (tx, -tz, ty)


def transform_t_point(
    lx: float,
    ly: float,
    lz: float,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
) -> tuple[float, float, float]:
    """Rotate (lx, ly, lz) by Three.js Euler (rx, ry, rz), translate by (tx, ty, tz), and convert to Blender."""
    if rx != 0.0:
        cx, sx = math.cos(rx), math.sin(rx)
        ny = ly * cx - lz * sx
        nz = ly * sx + lz * cx
        ly, lz = ny, nz
    if ry != 0.0:
        cy, sy = math.cos(ry), math.sin(ry)
        nx = lx * cy + lz * sy
        nz = -lx * sy + lz * cy
        lx, lz = nx, nz
    if rz != 0.0:
        cz, sz = math.cos(rz), math.sin(rz)
        nx = lx * cz - ly * sz
        ny = lx * sz + ly * cz
        lx, ly = nx, ny
    return t2b(lx + tx, ly + ty, lz + tz)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def s2l(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_rgba(hex_color: int, alpha: float = 1.0) -> tuple[float, float, float, float]:
    r = s2l(((hex_color >> 16) & 0xFF) / 255.0)
    g = s2l(((hex_color >> 8) & 0xFF) / 255.0)
    b = s2l((hex_color & 0xFF) / 255.0)
    return (r, g, b, alpha)


def make_material(
    name: str,
    hex_color: int,
    roughness: float = 0.52,
    metallic: float = 0.08,
    emission_hex: int | None = None,
    emission_strength: float = 0.0,
):
    mat = bpy.data.materials.new(name=name)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    rgba = hex_to_rgba(hex_color)
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission_hex is not None and emission_strength > 0:
            em_rgba = hex_to_rgba(emission_hex)
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = em_rgba
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.diffuse_color = rgba
    return mat


def create_material_library() -> dict:
    """Create the semantic materials used across all world props (Skyrim Nordic dark fantasy palette)."""
    return {
        "mat_bark": make_material("mat_bark", 0x38281A, roughness=0.82, metallic=0.02),
        "mat_wood": make_material("mat_wood", 0x5C4228, roughness=0.68, metallic=0.04),
        "mat_foliage": make_material("mat_foliage", 0x32422C, roughness=0.74, metallic=0.02),
        "mat_stone": make_material("mat_stone", 0x525C66, roughness=0.70, metallic=0.05),
        "mat_slate": make_material("mat_slate", 0x2D333B, roughness=0.55, metallic=0.12),
        "mat_sandstone": make_material("mat_sandstone", 0xB89458, roughness=0.72, metallic=0.04),
        "mat_obsidian": make_material("mat_obsidian", 0x1E1A29, roughness=0.25, metallic=0.45),
        "mat_iron": make_material("mat_iron", 0x283038, roughness=0.38, metallic=0.85),
        "mat_gold": make_material("mat_gold", 0xB8964D, roughness=0.26, metallic=0.84, emission_hex=0x967832, emission_strength=0.10),
        "mat_cloth": make_material("mat_cloth", 0x6A2424, roughness=0.75, metallic=0.04),
        "mat_water": make_material("mat_water", 0x243E4F, roughness=0.18, metallic=0.10, emission_hex=0x1E3340, emission_strength=0.20),
        "mat_ore_vein": make_material("mat_ore_vein", 0xBF6A1A, roughness=0.30, metallic=0.65, emission_hex=0xEA580C, emission_strength=0.30),
        "mat_mushroom_cap": make_material("mat_mushroom_cap", 0x6E427E, roughness=0.45, metallic=0.06, emission_hex=0x5E326E, emission_strength=0.40),
        "mat_crystal": make_material("mat_crystal", 0x479EA8, roughness=0.18, metallic=0.20, emission_hex=0x22D3EE, emission_strength=0.80),
        "mat_lava": make_material("mat_lava", 0xD95208, roughness=0.28, metallic=0.05, emission_hex=0xEA580C, emission_strength=1.15),
    }


def create_root_empty(asset_id: str, gx: float, gz: float):
    """Create `World_<id>` root Empty at Diorama Showcase Grid position (gx, 0, gz)."""
    root = bpy.data.objects.new(f"World_{asset_id}", None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.5
    root.location = t2b(gx, 0.0, gz)
    root.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
    root["worldAssetId"] = asset_id
    bpy.context.collection.objects.link(root)
    return root


def finalize_mesh(
    name: str,
    bm: bmesh.types.BMesh,
    parent,
    mat,
    smooth: bool = True,
    no_outline: bool = False,
):
    """Finalize a BMesh into a child mesh with `obj.location = (0, 0, 0)` and `obj.parent = parent`."""
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
    if mat:
        obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


# =============================================================================
# BMesh Sculpting Helpers (All built in local Three.js space)
# =============================================================================
def add_lofted_tube(
    name: str,
    parent,
    sections: list[tuple],
    vertices: int = 16,
    mat=None,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    cap_ends: bool = True,
    smooth: bool = True,
    twist: float = 0.0,
    flute_amp: float = 0.0,
    flute_freq: int = 8,
    no_outline: bool = False,
):
    """
    Loft a vertical tube in Three.js space from `sections` = [(y_pos, rad_x, rad_z, off_x, off_z, sq), ...].
    All vertices are transformed into `parent`'s Three.js origin space so `obj.location = (0, 0, 0)`.
    """
    bm = bmesh.new()
    ring_loops = []
    n_sec = max(1, len(sections) - 1)

    for s_idx, sec in enumerate(sections):
        y_pos = sec[0]
        rad_x = sec[1]
        rad_z = sec[2]
        off_x = sec[3] if len(sec) > 3 else 0.0
        off_z = sec[4] if len(sec) > 4 else 0.0
        sq = sec[5] if len(sec) > 5 else 0.0
        t_frac = s_idx / n_sec
        ang_offset = twist * t_frac

        verts = []
        for i in range(vertices):
            ang = (i / vertices) * math.pi * 2.0 + ang_offset
            ca = math.cos(ang)
            sa = math.sin(ang)
            if sq > 0.0:
                power = max(0.30, 1.0 - sq)
                cx = math.copysign(abs(ca) ** power, ca)
                sz = math.copysign(abs(sa) ** power, sa)
            else:
                cx, sz = ca, sa

            flute = 1.0 + flute_amp * math.cos(flute_freq * (i / vertices) * math.pi * 2.0) if flute_amp != 0.0 else 1.0
            lx = off_x + cx * rad_x * flute
            ly = y_pos
            lz = off_z + sz * rad_z * flute
            verts.append(bm.verts.new(transform_t_point(lx, ly, lz, tx, ty, tz, rx, ry, rz)))
        ring_loops.append(verts)

    for r_idx in range(len(ring_loops) - 1):
        loop_a = ring_loops[r_idx]
        loop_b = ring_loops[r_idx + 1]
        for i in range(vertices):
            i_next = (i + 1) % vertices
            bm.faces.new((loop_a[i], loop_a[i_next], loop_b[i_next], loop_b[i]))

    if cap_ends and len(ring_loops) >= 2:
        b_sec = sections[0]
        t_sec = sections[-1]
        bx_off = b_sec[3] if len(b_sec) > 3 else 0.0
        bz_off = b_sec[4] if len(b_sec) > 4 else 0.0
        tx_off = t_sec[3] if len(t_sec) > 3 else 0.0
        tz_off = t_sec[4] if len(t_sec) > 4 else 0.0
        bot_c = bm.verts.new(transform_t_point(bx_off, b_sec[0], bz_off, tx, ty, tz, rx, ry, rz))
        top_c = bm.verts.new(transform_t_point(tx_off, t_sec[0], tz_off, tx, ty, tz, rx, ry, rz))
        for i in range(vertices):
            i_next = (i + 1) % vertices
            bm.faces.new((ring_loops[0][i_next], ring_loops[0][i], bot_c))
            bm.faces.new((ring_loops[-1][i], ring_loops[-1][i_next], top_c))

    return finalize_mesh(name, bm, parent, mat, smooth=smooth, no_outline=no_outline)


def add_curve_tube(
    name: str,
    parent,
    path_points: list[tuple],
    vertices: int = 10,
    mat=None,
    cap_ends: bool = True,
    smooth: bool = True,
    no_outline: bool = False,
):
    """
    Sweep a 3D tube along `path_points` = [(x, y, z, rad_a, rad_b), ...] in Three.js coordinates.
    """
    bm = bmesh.new()
    ring_loops = []
    n_pts = len(path_points)

    for idx, pt in enumerate(path_points):
        px, py, pz, ra, rb = pt[0], pt[1], pt[2], max(0.003, pt[3]), max(0.003, pt[4])
        if idx == 0:
            nx, ny, nz = path_points[1][0] - px, path_points[1][1] - py, path_points[1][2] - pz
        elif idx == n_pts - 1:
            nx, ny, nz = px - path_points[idx - 1][0], py - path_points[idx - 1][1], pz - path_points[idx - 1][2]
        else:
            nx = path_points[idx + 1][0] - path_points[idx - 1][0]
            ny = path_points[idx + 1][1] - path_points[idx - 1][1]
            nz = path_points[idx + 1][2] - path_points[idx - 1][2]

        tangent = Vector((nx, ny, nz))
        if tangent.length < 1e-6:
            tangent = Vector((0.0, 1.0, 0.0))
        else:
            tangent.normalize()

        up_ref = Vector((0.0, 0.0, 1.0)) if abs(tangent.y) > 0.92 else Vector((0.0, 1.0, 0.0))
        side = tangent.cross(up_ref).normalized()
        binorm = side.cross(tangent).normalized()

        verts = []
        for i in range(vertices):
            ang = (i / vertices) * math.pi * 2.0
            ca, sa = math.cos(ang), math.sin(ang)
            vx = px + side.x * ca * ra + binorm.x * sa * rb
            vy = py + side.y * ca * ra + binorm.y * sa * rb
            vz = pz + side.z * ca * ra + binorm.z * sa * rb
            verts.append(bm.verts.new(t2b(vx, vy, vz)))
        ring_loops.append(verts)

    for r_idx in range(len(ring_loops) - 1):
        la = ring_loops[r_idx]
        lb = ring_loops[r_idx + 1]
        for i in range(vertices):
            i_next = (i + 1) % vertices
            bm.faces.new((la[i], la[i_next], lb[i_next], lb[i]))

    if cap_ends and len(ring_loops) >= 2:
        p0 = path_points[0]
        p1 = path_points[-1]
        c0 = bm.verts.new(t2b(p0[0], p0[1], p0[2]))
        c1 = bm.verts.new(t2b(p1[0], p1[1], p1[2]))
        for i in range(vertices):
            i_next = (i + 1) % vertices
            bm.faces.new((ring_loops[0][i_next], ring_loops[0][i], c0))
            bm.faces.new((ring_loops[-1][i], ring_loops[-1][i_next], c1))

    return finalize_mesh(name, bm, parent, mat, smooth=smooth, no_outline=no_outline)


def add_beveled_box(
    name: str,
    parent,
    wx: float,
    hy: float,
    dz: float,
    mat,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    bevel: float = 0.04,
    smooth: bool = False,
    no_outline: bool = False,
):
    """
    Create a box of full Three.js dimensions (wx, hy, dz) centered at (tx, ty, tz).
    """
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if bevel > 0.0:
        bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=min(0.32, bevel), segments=2, profile=0.5)
    for v in bm.verts:
        lx = v.co.x * wx
        ly = v.co.y * hy
        lz = v.co.z * dz
        bx, by, bz = transform_t_point(lx, ly, lz, tx, ty, tz, rx, ry, rz)
        v.co.x = bx
        v.co.y = by
        v.co.z = bz
    return finalize_mesh(name, bm, parent, mat, smooth=smooth, no_outline=no_outline)


def add_canopy_cluster(
    name: str,
    parent,
    rx_rad: float,
    ry_rad: float,
    rz_rad: float,
    mat,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    lobes: int = 7,
    lobe_amp: float = 0.14,
    seed: int = 1,
    smooth: bool = True,
):
    """
    Create a stylized sculpted foliage puff with organic lobes and slightly flattened underside.
    """
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        nx, ny, nz = v.co.x, v.co.y, v.co.z
        ang_h = math.atan2(nz, nx)
        ang_v = math.asin(max(-1.0, min(1.0, ny)))
        lobe = 1.0 + lobe_amp * math.sin(lobes * ang_h + seed * 1.3) * math.cos(ang_v)
        lobe += (lobe_amp * 0.55) * math.cos((lobes - 2) * ang_h - seed * 0.7) * math.sin(ang_v * 2.0)
        # Slightly flatten underside for painterly layered canopy silhouette
        y_scale = ry_rad * (0.72 if ny < 0.0 else 1.05)
        lx = nx * rx_rad * lobe
        ly = ny * y_scale * lobe
        lz = nz * rz_rad * lobe
        bx, by, bz = transform_t_point(lx, ly, lz, tx, ty, tz)
        v.co.x, v.co.y, v.co.z = bx, by, bz
    return finalize_mesh(name, bm, parent, mat, smooth=smooth)


def add_faceted_boulder(
    name: str,
    parent,
    rx_rad: float,
    ry_rad: float,
    rz_rad: float,
    mat,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    subdivisions: int = 2,
    crag: float = 0.18,
    seed: int = 1,
    flat_bottom: bool = True,
    smooth: bool = False,
):
    """
    Create a craggy faceted boulder / rock mesh in Three.js space.
    """
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    for v in bm.verts:
        nx, ny, nz = v.co.x, v.co.y, v.co.z
        h1 = math.sin(nx * 4.7 + ny * 3.1 + nz * 5.3 + seed * 1.9)
        h2 = math.cos(nx * 7.1 - ny * 4.3 + nz * 2.9 - seed * 2.7)
        factor = 1.0 + crag * (0.65 * h1 + 0.35 * h2)
        lx = nx * rx_rad * factor
        ly = ny * ry_rad * factor
        lz = nz * rz_rad * factor
        if flat_bottom and ly < -ry_rad * 0.55:
            ly = -ry_rad * 0.55 + (ly + ry_rad * 0.55) * 0.15
        bx, by, bz = transform_t_point(lx, ly, lz, tx, ty, tz, rx, ry, rz)
        v.co.x, v.co.y, v.co.z = bx, by, bz
    return finalize_mesh(name, bm, parent, mat, smooth=smooth)


def add_conifer_skirt(
    name: str,
    parent,
    y_base: float,
    y_peak: float,
    radius: float,
    mat,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    segments: int = 14,
    droop: float = 0.28,
    smooth: bool = True,
):
    """
    Creates an authentic tiered Nordic conifer / pine needle bough skirt.
    Has downward-sloping needle boughs with scalloped perimeter tips.
    """
    bm = bmesh.new()
    peak_v = bm.verts.new(t2b(tx, ty + y_peak, tz))
    base_center_v = bm.verts.new(t2b(tx, ty + y_base + droop * 0.4, tz))

    rim_verts = []
    inner_verts = []
    num_boughs = max(5, segments // 2)
    for i in range(segments):
        ang = (i / float(segments)) * math.pi * 2.0
        # Scallop: alternate between branch tips and inner valley notches
        scallop = 1.0 + 0.24 * math.sin(ang * num_boughs)
        cur_r = radius * scallop
        tip_y = y_base - droop * (0.80 + 0.35 * math.cos(ang * num_boughs))
        tip_x = math.cos(ang) * cur_r
        tip_z = math.sin(ang) * cur_r
        v_rim = bm.verts.new(t2b(tx + tip_x, ty + tip_y, tz + tip_z))
        rim_verts.append(v_rim)

        # Under-skirt inner ring
        in_r = cur_r * 0.45
        in_y = y_base + droop * 0.2
        v_in = bm.verts.new(t2b(tx + math.cos(ang) * in_r, ty + in_y, tz + math.sin(ang) * in_r))
        inner_verts.append(v_in)

    for i in range(segments):
        i_next = (i + 1) % segments
        # Upper cone faces from peak to rim
        bm.faces.new((peak_v, rim_verts[i], rim_verts[i_next]))
        # Under-skirt faces
        bm.faces.new((rim_verts[i_next], rim_verts[i], inner_verts[i], inner_verts[i_next]))
        bm.faces.new((inner_verts[i_next], inner_verts[i], base_center_v))

    return finalize_mesh(name, bm, parent, mat, smooth=smooth)


def add_crystal_prism(
    name: str,
    parent,
    radius: float,
    height: float,
    mat,
    sides: int = 6,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    double_ended: bool = False,
    smooth: bool = False,
    no_outline: bool = False,
):
    """
    Build a sharp faceted hexagonal/octagonal crystal shard or floating double-ended rune crystal.
    """
    if double_ended:
        half = height * 0.5
        sections = [
            (-half, 0.003, 0.003, 0.0, 0.0, 0.0),
            (-half * 0.38, radius, radius, 0.0, 0.0, 0.0),
            (half * 0.38, radius * 0.96, radius * 0.96, 0.0, 0.0, 0.0),
            (half, 0.003, 0.003, 0.0, 0.0, 0.0),
        ]
    else:
        sections = [
            (0.0, radius * 1.05, radius * 1.05, 0.0, 0.0, 0.0),
            (height * 0.68, radius * 0.86, radius * 0.86, 0.0, 0.0, 0.0),
            (height, 0.003, 0.003, 0.0, 0.0, 0.0),
        ]
    return add_lofted_tube(
        name,
        parent,
        sections,
        vertices=sides,
        mat=mat,
        tx=tx,
        ty=ty,
        tz=tz,
        rx=rx,
        ry=ry,
        rz=rz,
        cap_ends=True,
        smooth=smooth,
        no_outline=no_outline,
    )


def add_torus_ring(
    name: str,
    parent,
    major_rad: float,
    minor_rad: float,
    mat,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    major_seg: int = 24,
    minor_seg: int = 10,
    smooth: bool = True,
    no_outline: bool = False,
):
    """Create a horizontal torus ring in Three.js XZ plane centered at (tx, ty, tz)."""
    bm = bmesh.new()
    loops = []
    for i in range(major_seg):
        theta = (i / major_seg) * math.pi * 2.0
        ct, st = math.cos(theta), math.sin(theta)
        ring = []
        for j in range(minor_seg):
            phi = (j / minor_seg) * math.pi * 2.0
            cp, sp = math.cos(phi), math.sin(phi)
            r = major_rad + minor_rad * cp
            lx = r * ct
            ly = minor_rad * sp
            lz = r * st
            ring.append(bm.verts.new(transform_t_point(lx, ly, lz, tx, ty, tz, rx, ry, rz)))
        loops.append(ring)

    for i in range(major_seg):
        i_next = (i + 1) % major_seg
        for j in range(minor_seg):
            j_next = (j + 1) % minor_seg
            bm.faces.new((loops[i][j], loops[i_next][j], loops[i_next][j_next], loops[i][j_next]))

    return finalize_mesh(name, bm, parent, mat, smooth=smooth, no_outline=no_outline)


# =============================================================================
# A. RESOURCE NODES (1 - 10)
# =============================================================================
def build_normal_tree(mats: dict, gx: float, gz: float):
    root = create_root_empty("normal_tree", gx, gz)
    bark = mats["mat_bark"]
    foliage = mats["mat_foliage"]

    # Sculpted twisting trunk with root flare
    trunk_sections = [
        (0.00, 0.44, 0.44, 0.00, 0.00, 0.0),
        (0.28, 0.34, 0.34, 0.02, 0.01, 0.0),
        (0.75, 0.27, 0.26, 0.05, -0.02, 0.0),
        (1.30, 0.24, 0.23, 0.02, 0.03, 0.0),
        (1.85, 0.21, 0.20, -0.03, 0.02, 0.0),
        (2.35, 0.14, 0.14, 0.00, 0.00, 0.0),
    ]
    add_lofted_tube("NormalTree_Trunk", root, trunk_sections, vertices=14, mat=bark, twist=0.45, flute_amp=0.08, flute_freq=6)

    # 4 gnarled spreading roots
    for r_idx in range(4):
        ang = (r_idx / 4.0) * math.pi * 2.0 + 0.35
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (ca * 0.18, 0.42, sa * 0.18, 0.13, 0.11),
            (ca * 0.42, 0.18, sa * 0.42, 0.10, 0.08),
            (ca * 0.68, 0.03, sa * 0.68, 0.05, 0.04),
        ]
        add_curve_tube(f"NormalTree_Root_{r_idx}", root, pts, vertices=8, mat=bark)

    # 3 forked upper branches
    branch_defs = [
        [(0.0, 1.75, 0.0, 0.14, 0.14), (0.38, 2.10, 0.18, 0.10, 0.10), (0.72, 2.38, 0.28, 0.05, 0.05)],
        [(0.0, 1.80, 0.0, 0.13, 0.13), (-0.36, 2.15, -0.20, 0.09, 0.09), (-0.65, 2.42, -0.32, 0.05, 0.05)],
        [(0.0, 1.90, 0.0, 0.12, 0.12), (0.10, 2.25, -0.35, 0.08, 0.08), (0.18, 2.52, -0.58, 0.04, 0.04)],
    ]
    for b_idx, b_pts in enumerate(branch_defs):
        add_curve_tube(f"NormalTree_Branch_{b_idx}", root, b_pts, vertices=8, mat=bark)

    # 4 tiered Nordic pine needle bough skirts
    conifer_tiers = [
        ("TierBot", 1.55, 3.10, 1.65, 0.38, 14),
        ("TierMid", 2.25, 3.75, 1.35, 0.32, 12),
        ("TierHigh", 2.95, 4.35, 1.05, 0.26, 12),
        ("TierTop", 3.65, 4.85, 0.70, 0.20, 10),
    ]
    for cname, y_base, y_peak, rad, droop, segs in conifer_tiers:
        add_conifer_skirt(f"NormalTree_{cname}", root, y_base, y_peak, rad, foliage, segments=segs, droop=droop)
    # Spire crown needle tip
    add_conifer_skirt("NormalTree_SpireTip", root, 4.30, 5.25, 0.38, foliage, segments=8, droop=0.15)

    return root


def build_oak_tree(mats: dict, gx: float, gz: float):
    root = create_root_empty("oak_tree", gx, gz)
    bark = mats["mat_bark"]
    foliage = mats["mat_foliage"]

    # Thick ancient knotted oak trunk
    trunk_sections = [
        (0.00, 0.64, 0.62, 0.00, 0.00, 0.08),
        (0.35, 0.50, 0.48, 0.01, -0.01, 0.05),
        (0.90, 0.42, 0.40, -0.02, 0.02, 0.0),
        (1.50, 0.40, 0.39, 0.02, 0.01, 0.0),
        (2.05, 0.45, 0.44, 0.00, 0.00, 0.06),
        (2.35, 0.28, 0.28, 0.00, 0.00, 0.0),
    ]
    add_lofted_tube("OakTree_Trunk", root, trunk_sections, vertices=16, mat=bark, twist=0.32, flute_amp=0.11, flute_freq=7)

    # 6 heavy buttress roots
    for r_idx in range(6):
        ang = (r_idx / 6.0) * math.pi * 2.0 + 0.2
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (ca * 0.30, 0.62, sa * 0.30, 0.18, 0.14),
            (ca * 0.62, 0.26, sa * 0.62, 0.14, 0.10),
            (ca * 0.95, 0.04, sa * 0.95, 0.07, 0.05),
        ]
        add_curve_tube(f"OakTree_Root_{r_idx}", root, pts, vertices=8, mat=bark)

    # 4 heavy spreading oak boughs
    boughs = [
        [(0.0, 1.85, 0.0, 0.22, 0.22), (0.58, 2.18, 0.25, 0.16, 0.16), (1.05, 2.42, 0.42, 0.10, 0.10)],
        [(0.0, 1.82, 0.0, 0.22, 0.22), (-0.62, 2.15, 0.22, 0.16, 0.16), (-1.08, 2.38, 0.35, 0.10, 0.10)],
        [(0.0, 1.88, 0.0, 0.20, 0.20), (0.25, 2.22, -0.58, 0.15, 0.15), (0.48, 2.48, -0.98, 0.09, 0.09)],
        [(0.0, 1.90, 0.0, 0.20, 0.20), (-0.32, 2.24, -0.52, 0.14, 0.14), (-0.58, 2.46, -0.88, 0.09, 0.09)],
    ]
    for b_idx, b_pts in enumerate(boughs):
        add_curve_tube(f"OakTree_Bough_{b_idx}", root, b_pts, vertices=9, mat=bark)

    # Dense multi-tiered rounded oak canopy (7 puffs)
    canopy = [
        ("CenterDome", 0.00, 2.95, 0.00, 1.48, 1.08, 1.45, 11),
        ("EastDome", 1.02, 2.52, 0.38, 0.98, 0.78, 0.95, 12),
        ("WestDome", -1.04, 2.48, 0.32, 0.96, 0.76, 0.94, 13),
        ("NorthEast", 0.52, 2.58, -0.88, 0.92, 0.74, 0.92, 14),
        ("NorthWest", -0.58, 2.55, -0.82, 0.90, 0.72, 0.90, 15),
        ("SouthFront", 0.05, 2.45, 0.85, 0.88, 0.70, 0.86, 16),
        ("ApexCrown", 0.00, 3.48, -0.05, 0.95, 0.72, 0.95, 17),
    ]
    for cname, px, py, pz, rx, ry, rz, seed in canopy:
        add_canopy_cluster(f"OakTree_{cname}", root, rx, ry, rz, foliage, tx=px, ty=py, tz=pz, lobes=8, seed=seed)

    return root


def build_willow_tree(mats: dict, gx: float, gz: float):
    root = create_root_empty("willow_tree", gx, gz)
    bark = mats["mat_bark"]
    foliage = mats["mat_foliage"]

    # Leaning waterside willow trunk
    trunk_sections = [
        (0.00, 0.48, 0.46, 0.00, 0.00, 0.0),
        (0.45, 0.36, 0.35, 0.06, 0.03, 0.0),
        (1.05, 0.30, 0.29, 0.16, 0.08, 0.0),
        (1.65, 0.26, 0.25, 0.24, 0.12, 0.0),
        (2.25, 0.20, 0.20, 0.28, 0.14, 0.0),
    ]
    add_lofted_tube("WillowTree_Trunk", root, trunk_sections, vertices=14, mat=bark, twist=0.5, flute_amp=0.09, flute_freq=6)

    # 4 roots gripping the riverbank
    for r_idx in range(4):
        ang = (r_idx / 4.0) * math.pi * 2.0 + 0.4
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (ca * 0.22, 0.40, sa * 0.22, 0.14, 0.11),
            (ca * 0.52, 0.15, sa * 0.52, 0.10, 0.08),
            (ca * 0.78, 0.02, sa * 0.78, 0.05, 0.04),
        ]
        add_curve_tube(f"WillowTree_Root_{r_idx}", root, pts, vertices=8, mat=bark)

    # 4 sweeping upper branches
    for b_idx in range(4):
        ang = (b_idx / 4.0) * math.pi * 2.0 + 0.35
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (0.24, 1.95, 0.12, 0.15, 0.15),
            (0.24 + ca * 0.52, 2.45, 0.12 + sa * 0.52, 0.11, 0.11),
            (0.24 + ca * 0.95, 2.55, 0.12 + sa * 0.95, 0.07, 0.07),
        ]
        add_curve_tube(f"WillowTree_Branch_{b_idx}", root, pts, vertices=8, mat=bark)

    # Upper canopy dome
    add_canopy_cluster("WillowTree_CrownMain", root, 1.28, 0.82, 1.25, foliage, tx=0.22, ty=2.75, tz=0.10, lobes=8, seed=21)
    add_canopy_cluster("WillowTree_CrownTop", root, 0.88, 0.65, 0.88, foliage, tx=0.18, ty=3.18, tz=0.08, lobes=7, seed=22)

    # 8 cascading curtain-like weeping foliage fronds hanging down toward the water
    for f_idx in range(8):
        ang = (f_idx / 8.0) * math.pi * 2.0 + 0.15
        ca, sa = math.cos(ang), math.sin(ang)
        ox = 0.22 + ca * 1.05
        oz = 0.10 + sa * 1.05
        bot_y = 0.42 + (f_idx % 2) * 0.22
        frond_pts = [
            (ox * 0.82, 2.72, oz * 0.82, 0.22, 0.12),
            (ox * 0.98, 2.25, oz * 0.98, 0.30, 0.15),
            (ox * 1.08, 1.55, oz * 1.08, 0.28, 0.14),
            (ox * 1.12, 0.92, oz * 1.12, 0.20, 0.10),
            (ox * 1.14, bot_y, oz * 1.14, 0.06, 0.04),
        ]
        add_curve_tube(f"WillowTree_Frond_{f_idx}", root, frond_pts, vertices=8, mat=foliage)

    return root


def build_maple_tree(mats: dict, gx: float, gz: float):
    root = create_root_empty("maple_tree", gx, gz)
    bark = mats["mat_bark"]
    foliage = mats["mat_foliage"]

    # Straight sculpted maple trunk with forked crown
    trunk_sections = [
        (0.00, 0.45, 0.45, 0.00, 0.00, 0.0),
        (0.35, 0.33, 0.33, 0.00, 0.00, 0.0),
        (1.00, 0.26, 0.26, -0.02, 0.01, 0.0),
        (1.75, 0.22, 0.22, 0.01, -0.01, 0.0),
        (2.40, 0.15, 0.15, 0.00, 0.00, 0.0),
    ]
    add_lofted_tube("MapleTree_Trunk", root, trunk_sections, vertices=12, mat=bark, flute_amp=0.06, flute_freq=6)

    for b_idx in range(3):
        ang = (b_idx / 3.0) * math.pi * 2.0 + 0.5
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (0.0, 1.75, 0.0, 0.14, 0.14),
            (ca * 0.45, 2.20, sa * 0.45, 0.10, 0.10),
            (ca * 0.80, 2.55, sa * 0.80, 0.06, 0.06),
        ]
        add_curve_tube(f"MapleTree_Branch_{b_idx}", root, pts, vertices=8, mat=bark)

    # 6 layered angular/faceted leaf canopies
    layers = [
        ("LayerBot", 0.00, 2.35, 0.00, 1.28, 0.72, 1.28, 31),
        ("LayerMid", 0.05, 2.82, -0.04, 1.12, 0.74, 1.12, 32),
        ("LayerTop", -0.04, 3.25, 0.03, 0.84, 0.65, 0.84, 33),
        ("SideEast", 0.78, 2.48, 0.25, 0.76, 0.58, 0.76, 34),
        ("SideWest", -0.74, 2.52, 0.28, 0.74, 0.56, 0.74, 35),
        ("SideNorth", 0.04, 2.55, -0.76, 0.75, 0.58, 0.75, 36),
    ]
    for cname, px, py, pz, rx, ry, rz, seed in layers:
        add_faceted_boulder(
            f"MapleTree_{cname}",
            root,
            rx,
            ry,
            rz,
            foliage,
            tx=px,
            ty=py,
            tz=pz,
            subdivisions=2,
            crag=0.14,
            seed=seed,
            flat_bottom=False,
            smooth=False,
        )

    return root


def build_yew_tree(mats: dict, gx: float, gz: float):
    root = create_root_empty("yew_tree", gx, gz)
    bark = mats["mat_bark"]
    foliage = mats["mat_foliage"]
    cloth = mats["mat_cloth"]

    # Sacred dark-barked ancient yew with twisted hollow-ribbed trunk
    trunk_sections = [
        (0.00, 0.58, 0.56, 0.00, 0.00, 0.06),
        (0.40, 0.46, 0.44, 0.02, -0.02, 0.04),
        (1.00, 0.40, 0.38, -0.03, 0.02, 0.0),
        (1.60, 0.38, 0.37, 0.02, 0.02, 0.0),
        (2.15, 0.32, 0.32, 0.00, 0.00, 0.0),
    ]
    add_lofted_tube("YewTree_Trunk", root, trunk_sections, vertices=16, mat=bark, twist=0.75, flute_amp=0.14, flute_freq=8)

    # 5 twisted outer trunk ribs / aerial roots
    for r_idx in range(5):
        ang = (r_idx / 5.0) * math.pi * 2.0
        ca, sa = math.cos(ang), math.sin(ang)
        ang2 = ang + 0.45
        ca2, sa2 = math.cos(ang2), math.sin(ang2)
        pts = [
            (ca * 0.55, 0.04, sa * 0.55, 0.11, 0.09),
            (ca * 0.42, 0.75, sa * 0.42, 0.10, 0.09),
            (ca2 * 0.38, 1.55, sa2 * 0.38, 0.09, 0.08),
            (ca2 * 0.72, 2.25, sa2 * 0.72, 0.08, 0.07),
        ]
        add_curve_tube(f"YewTree_Rib_{r_idx}", root, pts, vertices=8, mat=bark)

    # Wide tiered evergreen cedar / yew canopy pads
    pads = [
        ("MainPad", 0.00, 2.65, 0.00, 1.42, 0.72, 1.40, 41),
        ("UpperPad", 0.00, 3.18, 0.00, 1.05, 0.62, 1.05, 42),
        ("EastPad", 0.92, 2.38, 0.25, 0.85, 0.54, 0.82, 43),
        ("WestPad", -0.90, 2.40, -0.22, 0.84, 0.54, 0.82, 44),
        ("SouthPad", 0.12, 2.32, 0.82, 0.78, 0.50, 0.78, 45),
    ]
    for cname, px, py, pz, rx, ry, rz, seed in pads:
        add_conifer_skirt(f"YewTree_{cname}", root, py - 0.25, py + 0.55, rx, foliage, tx=px, tz=pz, segments=12, droop=0.32)

    # Sacred yew berry / blossom accents
    berries = [
        (0.65, 2.62, 0.85),
        (-0.72, 2.58, 0.74),
        (0.88, 2.55, -0.45),
        (-0.55, 2.85, -0.68),
        (0.22, 3.35, 0.52),
        (-0.32, 3.28, 0.48),
    ]
    for b_idx, (bx, by, bz) in enumerate(berries):
        add_faceted_boulder(
            f"YewTree_Berry_{b_idx}",
            root,
            0.11,
            0.11,
            0.11,
            cloth,
            tx=bx,
            ty=by,
            tz=bz,
            subdivisions=1,
            crag=0.05,
            seed=b_idx,
            flat_bottom=False,
            smooth=True,
        )

    return root


def build_magic_tree(mats: dict, gx: float, gz: float):
    root = create_root_empty("magic_tree", gx, gz)
    wood = mats["mat_wood"]
    foliage = mats["mat_foliage"]
    crystal = mats["mat_crystal"]
    gold = mats["mat_gold"]

    # Pale golden-white enchanted trunk
    trunk_sections = [
        (0.00, 0.50, 0.50, 0.00, 0.00, 0.0),
        (0.40, 0.36, 0.36, 0.02, 0.00, 0.0),
        (0.95, 0.29, 0.29, -0.03, 0.02, 0.0),
        (1.55, 0.25, 0.25, 0.03, -0.02, 0.0),
        (2.15, 0.20, 0.20, 0.00, 0.00, 0.0),
    ]
    add_lofted_tube("MagicTree_Trunk", root, trunk_sections, vertices=14, mat=wood, twist=0.65, flute_amp=0.07, flute_freq=6)

    # 2 glowing cyan rune spirals coiling up the trunk
    for s_idx in range(2):
        spiral_pts = []
        steps = 14
        for i in range(steps):
            t = i / (steps - 1)
            y = 0.12 + t * 2.05
            r = (0.42 * (1.0 - t * 0.45)) + 0.02
            ang = t * math.pi * 2.6 + s_idx * math.pi
            spiral_pts.append((math.cos(ang) * r, y, math.sin(ang) * r, 0.035, 0.022))
        add_curve_tube(f"MagicTree_RuneSpiral_{s_idx}", root, spiral_pts, vertices=6, mat=crystal, no_outline=True)

    # Golden arcane collar rings around trunk
    add_torus_ring("MagicTree_GoldRingBot", root, 0.36, 0.035, gold, ty=0.55, rx=0.08)
    add_torus_ring("MagicTree_GoldRingTop", root, 0.27, 0.030, gold, ty=1.45, rx=-0.08)

    # 4 curling arcane branches
    for b_idx in range(4):
        ang = (b_idx / 4.0) * math.pi * 2.0 + 0.4
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (0.0, 1.85, 0.0, 0.14, 0.14),
            (ca * 0.48, 2.25, sa * 0.48, 0.10, 0.10),
            (ca * 0.85, 2.55, sa * 0.85, 0.07, 0.07),
            (ca * 0.72, 2.78, sa * 0.72, 0.04, 0.04),
        ]
        add_curve_tube(f"MagicTree_Branch_{b_idx}", root, pts, vertices=8, mat=wood)

    # Shimmering foliage clusters + glowing arcane cyan canopy crowns
    puffs = [
        ("CrownCenter", 0.00, 2.75, 0.00, 1.18, 0.92, 1.18, 51, foliage),
        ("CrownEast", 0.76, 2.42, 0.22, 0.78, 0.65, 0.78, 52, foliage),
        ("CrownWest", -0.76, 2.45, -0.22, 0.78, 0.65, 0.78, 53, foliage),
        ("CrownSouth", 0.18, 2.48, 0.74, 0.74, 0.62, 0.74, 54, foliage),
        ("CrownApex", 0.00, 3.32, 0.00, 0.82, 0.68, 0.82, 55, crystal),
        ("ArcaneLobeE", 0.86, 2.68, 0.25, 0.48, 0.42, 0.48, 56, crystal),
        ("ArcaneLobeW", -0.84, 2.70, -0.20, 0.48, 0.42, 0.48, 57, crystal),
    ]
    for cname, px, py, pz, rx, ry, rz, seed, cmat in puffs:
        add_canopy_cluster(f"MagicTree_{cname}", root, rx, ry, rz, cmat, tx=px, ty=py, tz=pz, lobes=8, seed=seed)

    # 6 floating arcane crystal motes around the canopy
    for m_idx in range(6):
        ang = (m_idx / 6.0) * math.pi * 2.0
        mx = math.cos(ang) * 1.25
        mz = math.sin(ang) * 1.25
        my = 1.85 + (m_idx % 3) * 0.48
        add_crystal_prism(
            f"MagicTree_Mote_{m_idx}",
            root,
            0.13,
            0.38,
            crystal,
            sides=6,
            tx=mx,
            ty=my,
            tz=mz,
            rx=0.2,
            rz=0.15,
            double_ended=True,
            no_outline=True,
        )

    return root


def build_tree_stump(mats: dict, gx: float, gz: float):
    root = create_root_empty("tree_stump", gx, gz)
    bark = mats["mat_bark"]
    wood = mats["mat_wood"]

    # Outer bark stump wall (height ~ 0.65m)
    stump_sections = [
        (0.00, 0.56, 0.54, 0.00, 0.00, 0.05),
        (0.22, 0.44, 0.43, 0.00, 0.00, 0.0),
        (0.48, 0.39, 0.38, 0.01, 0.00, 0.0),
        (0.64, 0.37, 0.36, 0.00, 0.00, 0.0),
    ]
    add_lofted_tube("TreeStump_BarkBody", root, stump_sections, vertices=14, mat=bark, flute_amp=0.09, flute_freq=7)

    # Pale heartwood cut face with concentric ring step at top
    heart_sections = [
        (0.60, 0.32, 0.31, 0.00, 0.00, 0.0),
        (0.65, 0.32, 0.31, 0.00, 0.00, 0.0),
        (0.665, 0.18, 0.18, 0.00, 0.00, 0.0),
    ]
    add_lofted_tube("TreeStump_Heartwood", root, heart_sections, vertices=14, mat=wood, smooth=False)

    # Side axe chop wedge notch
    add_beveled_box("TreeStump_AxeNotch", root, 0.24, 0.16, 0.18, wood, tx=0.30, ty=0.40, tz=0.0, rz=0.25, bevel=0.02)

    # 5 spreading roots
    for r_idx in range(5):
        ang = (r_idx / 5.0) * math.pi * 2.0 + 0.25
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (ca * 0.32, 0.30, sa * 0.32, 0.14, 0.10),
            (ca * 0.58, 0.12, sa * 0.58, 0.10, 0.08),
            (ca * 0.80, 0.02, sa * 0.80, 0.05, 0.04),
        ]
        add_curve_tube(f"TreeStump_Root_{r_idx}", root, pts, vertices=8, mat=bark)

    return root


def build_ore_rock(mats: dict, gx: float, gz: float):
    root = create_root_empty("ore_rock", gx, gz)
    stone = mats["mat_stone"]
    ore = mats["mat_ore_vein"]

    # 2 main interlocking craggy boulders + 2 smaller basal stones (radius ~ 1.1m, height ~ 1.25m)
    add_faceted_boulder("OreRock_MainBoulder", root, 0.92, 0.74, 0.86, stone, tx=-0.12, ty=0.58, tz=-0.05, crag=0.18, seed=61)
    add_faceted_boulder("OreRock_SideBoulder", root, 0.66, 0.54, 0.62, stone, tx=0.58, ty=0.42, tz=0.22, crag=0.18, seed=62)
    add_faceted_boulder("OreRock_FrontStone", root, 0.45, 0.35, 0.42, stone, tx=-0.48, ty=0.26, tz=0.48, crag=0.16, seed=63)
    add_faceted_boulder("OreRock_BackStone", root, 0.42, 0.32, 0.40, stone, tx=0.25, ty=0.24, tz=-0.62, crag=0.16, seed=64)

    # 5 protruding sharp hexagonal crystal/ore veins (`mat_ore_vein`)
    veins = [
        # (tx, ty, tz, radius, height, rx, ry, rz)
        (0.12, 0.82, 0.42, 0.18, 0.58, 0.48, 0.15, -0.22),
        (-0.38, 0.78, 0.22, 0.16, 0.54, 0.25, -0.35, 0.42),
        (-0.18, 0.85, -0.38, 0.17, 0.56, -0.45, 0.20, 0.18),
        (0.55, 0.58, 0.35, 0.15, 0.48, 0.38, 0.40, -0.48),
        (0.28, 0.72, -0.18, 0.14, 0.46, -0.22, 0.10, -0.35),
    ]
    for v_idx, (vx, vy, vz, vr, vh, vrx, vry, vrz) in enumerate(veins):
        add_crystal_prism(
            f"OreRock_Vein_{v_idx}",
            root,
            vr,
            vh,
            ore,
            sides=6,
            tx=vx,
            ty=vy,
            tz=vz,
            rx=vrx,
            ry=vry,
            rz=vrz,
            double_ended=False,
            smooth=False,
        )

    return root


def build_rock_depleted(mats: dict, gx: float, gz: float):
    root = create_root_empty("rock_depleted", gx, gz)
    slate = mats["mat_slate"]
    stone = mats["mat_stone"]

    # Shattered hollowed-out quarry rock rim (height ~ 0.75m)
    rim_chunks = [
        ("RimNorth", 0.00, 0.36, -0.38, 0.68, 0.42, 0.42, 71),
        ("RimWest", -0.45, 0.34, 0.05, 0.46, 0.38, 0.58, 72),
        ("RimEast", 0.48, 0.32, 0.08, 0.48, 0.36, 0.54, 73),
        ("RimSouth", 0.05, 0.22, 0.42, 0.52, 0.26, 0.36, 74),
    ]
    for rname, rx, ry, rz, sx, sy, sz, seed in rim_chunks:
        add_faceted_boulder(f"RockDepleted_{rname}", root, sx, sy, sz, slate, tx=rx, ty=ry, tz=rz, crag=0.20, seed=seed)

    # Scattered angular rubble chunks around base
    rubble = [
        (-0.68, 0.14, 0.52, 0.22, 0.16, 0.20, 75),
        (0.65, 0.13, -0.45, 0.24, 0.15, 0.22, 76),
        (0.32, 0.12, 0.65, 0.19, 0.14, 0.18, 77),
        (-0.52, 0.12, -0.58, 0.20, 0.14, 0.19, 78),
        (0.00, 0.14, 0.00, 0.34, 0.14, 0.32, 79),
    ]
    for idx, (rx, ry, rz, sx, sy, sz, seed) in enumerate(rubble):
        add_faceted_boulder(f"RockDepleted_Rubble_{idx}", root, sx, sy, sz, stone, tx=rx, ty=ry, tz=rz, crag=0.22, seed=seed)

    return root


def build_fishing_spot(mats: dict, gx: float, gz: float):
    root = create_root_empty("fishing_spot", gx, gz)
    water = mats["mat_water"]
    cloth = mats["mat_cloth"]
    stone = mats["mat_stone"]
    wood = mats["mat_wood"]
    iron = mats["mat_iron"]

    # 3 swirling concentric water ripple rings (y = 0.05..0.11)
    add_torus_ring("FishingSpot_RippleOuter", root, 1.18, 0.045, water, ty=0.05, major_seg=28, minor_seg=8, no_outline=True)
    add_torus_ring("FishingSpot_RippleMid", root, 0.78, 0.040, water, ty=0.075, major_seg=24, minor_seg=8, no_outline=True)
    add_torus_ring("FishingSpot_RippleInner", root, 0.38, 0.035, water, ty=0.10, major_seg=18, minor_seg=8, no_outline=True)

    # 2 red-and-white wooden fishing bobber floats
    bobbers = [(-0.42, 0.12, 0.28, 0.15), (0.48, 0.10, -0.32, -0.18)]
    for b_idx, (bx, by, bz, tilt) in enumerate(bobbers):
        add_faceted_boulder(
            f"FishingSpot_BobberRed_{b_idx}",
            root,
            0.11,
            0.09,
            0.11,
            cloth,
            tx=bx,
            ty=by + 0.04,
            tz=bz,
            rz=tilt,
            subdivisions=2,
            crag=0.0,
            flat_bottom=False,
            smooth=True,
        )
        add_faceted_boulder(
            f"FishingSpot_BobberWhite_{b_idx}",
            root,
            0.105,
            0.08,
            0.105,
            stone,
            tx=bx,
            ty=by - 0.02,
            tz=bz,
            rz=tilt,
            subdivisions=2,
            crag=0.0,
            flat_bottom=False,
            smooth=True,
        )
        add_beveled_box(
            f"FishingSpot_BobberPeg_{b_idx}",
            root,
            0.03,
            0.14,
            0.03,
            wood,
            tx=bx,
            ty=by + 0.12,
            tz=bz,
            rz=tilt,
            bevel=0.005,
        )

    # 2 curved leaping silver fish silhouettes arching above the surface
    fish_configs = [
        # (center_x, center_z, yaw, height_boost)
        (-0.15, -0.18, 0.35, 0.0),
        (0.28, 0.30, -2.45, -0.08),
    ]
    for f_idx, (fx, fz, fyaw, h_off) in enumerate(fish_configs):
        ca, sa = math.cos(fyaw), math.sin(fyaw)
        local_arc = [
            # (s_along, y_height, rad_vertical, rad_thick)
            (-0.36, 0.12 + h_off, 0.025, 0.015),
            (-0.22, 0.28 + h_off, 0.065, 0.035),
            (0.00, 0.42 + h_off, 0.095, 0.048),
            (0.20, 0.32 + h_off, 0.075, 0.038),
            (0.34, 0.16 + h_off, 0.030, 0.015),
        ]
        pts = [(fx + s * ca, y, fz + s * sa, rv, rt) for (s, y, rv, rt) in local_arc]
        add_curve_tube(f"FishingSpot_FishBody_{f_idx}", root, pts, vertices=10, mat=iron, smooth=True)
        # Tail fin V-blades at the start of the arc
        tx_tail = fx - 0.40 * ca
        tz_tail = fz - 0.40 * sa
        add_beveled_box(
            f"FishingSpot_FishTail_{f_idx}",
            root,
            0.14,
            0.16,
            0.025,
            iron,
            tx=tx_tail,
            ty=0.10 + h_off,
            tz=tz_tail,
            ry=-fyaw,
            rz=0.55,
            bevel=0.005,
        )

    return root


# =============================================================================
# B. INTERACTIVE STATIONS & STRUCTURES (11 - 15)
# =============================================================================
def build_shrine(mats: dict, gx: float, gz: float):
    root = create_root_empty("shrine", gx, gz)
    slate = mats["mat_slate"]
    stone = mats["mat_stone"]
    gold = mats["mat_gold"]
    crystal = mats["mat_crystal"]

    # Two-tier octagonal carved stone dais (width ~ 2.6m)
    dais_sections = [
        (0.00, 1.38, 1.38, 0.0, 0.0, 0.15),
        (0.26, 1.32, 1.32, 0.0, 0.0, 0.15),
    ]
    add_lofted_tube("Shrine_DaisStepA", root, dais_sections, vertices=8, mat=slate, smooth=False)

    dais_b_sections = [
        (0.26, 0.98, 0.98, 0.0, 0.0, 0.15),
        (0.52, 0.92, 0.92, 0.0, 0.0, 0.15),
    ]
    add_lofted_tube("Shrine_DaisStepB", root, dais_b_sections, vertices=8, mat=stone, smooth=False)

    # 4 corner runic bollards on the dais
    for c_idx in range(4):
        ang = (c_idx / 4.0) * math.pi * 2.0 + math.pi * 0.25
        bx = math.cos(ang) * 0.98
        bz = math.sin(ang) * 0.98
        bollard_sec = [
            (0.24, 0.15, 0.15, 0.0, 0.0, 0.1),
            (0.88, 0.11, 0.11, 0.0, 0.0, 0.1),
        ]
        add_lofted_tube(f"Shrine_Bollard_{c_idx}", root, bollard_sec, vertices=6, mat=stone, tx=bx, tz=bz, smooth=False)
        add_crystal_prism(
            f"Shrine_BollardGem_{c_idx}",
            root,
            0.09,
            0.22,
            crystal,
            sides=6,
            tx=bx,
            ty=0.88,
            tz=bz,
            smooth=False,
        )

    # Tapered fluted obelisk pillar (y = 0.52..2.68)
    pillar_sections = [
        (0.52, 0.58, 0.58, 0.0, 0.0, 0.0),
        (0.75, 0.48, 0.48, 0.0, 0.0, 0.0),
        (1.65, 0.42, 0.42, 0.0, 0.0, 0.0),
        (2.55, 0.36, 0.36, 0.0, 0.0, 0.0),
        (2.68, 0.44, 0.44, 0.0, 0.0, 0.0),
    ]
    add_lofted_tube("Shrine_ObeliskPillar", root, pillar_sections, vertices=16, mat=stone, flute_amp=0.06, flute_freq=8)

    # Golden collar bands & slate capital
    add_torus_ring("Shrine_GoldBandBot", root, 0.49, 0.045, gold, ty=0.78, major_seg=20, minor_seg=8)
    add_torus_ring("Shrine_GoldBandTop", root, 0.39, 0.040, gold, ty=2.45, major_seg=20, minor_seg=8)
    add_beveled_box("Shrine_CapitalCap", root, 0.86, 0.18, 0.86, slate, ty=2.74, bevel=0.04)
    add_torus_ring("Shrine_GoldHalo", root, 0.52, 0.032, gold, ty=3.15, rx=math.pi * 0.5, ry=0.35, major_seg=24, minor_seg=8)

    # Floating faceted teleportation crystal (centered at y = 3.15)
    add_crystal_prism("Shrine_TeleportRune", root, 0.34, 0.78, crystal, sides=8, ty=3.15, double_ended=True, smooth=False)

    # 4 orbiting rune shards
    for s_idx in range(4):
        ang = (s_idx / 4.0) * math.pi * 2.0
        sx = math.cos(ang) * 0.62
        sz = math.sin(ang) * 0.62
        add_crystal_prism(
            f"Shrine_OrbitShard_{s_idx}",
            root,
            0.08,
            0.26,
            crystal,
            sides=6,
            tx=sx,
            ty=3.15 + (0.06 if s_idx % 2 == 0 else -0.06),
            tz=sz,
            rx=0.25,
            rz=-0.25,
            double_ended=True,
            smooth=False,
        )

    return root


def build_altar(mats: dict, gx: float, gz: float):
    root = create_root_empty("altar", gx, gz)
    slate = mats["mat_slate"]
    stone = mats["mat_stone"]
    gold = mats["mat_gold"]
    cloth = mats["mat_cloth"]
    crystal = mats["mat_crystal"]
    lava = mats["mat_lava"]

    # Stepped marble platform
    add_beveled_box("Altar_PlatformStepA", root, 2.95, 0.14, 1.75, slate, ty=0.07, bevel=0.03)
    add_beveled_box("Altar_PlatformStepB", root, 2.65, 0.14, 1.48, stone, ty=0.21, bevel=0.03)

    # Ornate gothic altar body (2.35 x 0.68 x 1.12)
    add_beveled_box("Altar_MainBase", root, 2.32, 0.64, 1.10, stone, ty=0.58, bevel=0.04)

    # 4 gothic colonnettes along front & back faces
    for cx in (-1.02, -0.42, 0.42, 1.02):
        for cz in (-0.54, 0.54):
            col_sec = [
                (0.28, 0.08, 0.08, 0.0, 0.0, 0.0),
                (0.86, 0.07, 0.07, 0.0, 0.0, 0.0),
            ]
            add_lofted_tube(f"Altar_Col_{cx:.1f}_{cz:.1f}", root, col_sec, vertices=10, mat=stone, tx=cx, tz=cz)

    # Overhanging beveled mensa slab at y = 0.94
    add_beveled_box("Altar_MensaSlab", root, 2.72, 0.16, 1.40, stone, ty=0.94, bevel=0.04)
    add_beveled_box("Altar_GoldFriezeFront", root, 2.38, 0.07, 0.08, gold, ty=0.82, tz=0.56, bevel=0.01)
    add_beveled_box("Altar_GoldFriezeBack", root, 2.38, 0.07, 0.08, gold, ty=0.82, tz=-0.56, bevel=0.01)

    # Draped crimson altar cloth + gold trim down front and back
    add_beveled_box("Altar_ClothTop", root, 0.88, 0.04, 1.44, cloth, ty=1.02, bevel=0.01)
    add_beveled_box("Altar_ClothFrontDrop", root, 0.84, 0.62, 0.06, cloth, ty=0.68, tz=0.69, bevel=0.01)
    add_beveled_box("Altar_ClothBackDrop", root, 0.84, 0.62, 0.06, cloth, ty=0.68, tz=-0.69, bevel=0.01)
    add_beveled_box("Altar_GoldCrossFront", root, 0.10, 0.36, 0.03, gold, ty=0.68, tz=0.72, bevel=0.005)
    add_beveled_box("Altar_GoldCrossBar", root, 0.28, 0.09, 0.03, gold, ty=0.74, tz=0.72, bevel=0.005)

    # Twin golden candlesticks + glowing flames on the ends (x = ±0.98)
    for side_idx, sx in enumerate((-0.98, 0.98)):
        c_sec = [
            (1.02, 0.16, 0.16, 0.0, 0.0, 0.0),
            (1.08, 0.06, 0.06, 0.0, 0.0, 0.0),
            (1.32, 0.045, 0.045, 0.0, 0.0, 0.0),
            (1.38, 0.11, 0.11, 0.0, 0.0, 0.0),
        ]
        add_lofted_tube(f"Altar_Candlestick_{side_idx}", root, c_sec, vertices=12, mat=gold, tx=sx)
        wax_sec = [(1.38, 0.055, 0.055, 0.0, 0.0, 0.0), (1.54, 0.048, 0.048, 0.0, 0.0, 0.0)]
        add_lofted_tube(f"Altar_CandleWax_{side_idx}", root, wax_sec, vertices=10, mat=stone, tx=sx)
        add_crystal_prism(f"Altar_CandleFlame_{side_idx}", root, 0.045, 0.14, lava, sides=6, tx=sx, ty=1.54, no_outline=True)

    # Golden chalice in center + floating celestial prayer crystal at y = 1.58
    chalice_sec = [
        (1.02, 0.12, 0.12, 0.0, 0.0, 0.0),
        (1.12, 0.035, 0.035, 0.0, 0.0, 0.0),
        (1.22, 0.14, 0.14, 0.0, 0.0, 0.0),
        (1.30, 0.16, 0.16, 0.0, 0.0, 0.0),
    ]
    add_lofted_tube("Altar_Chalice", root, chalice_sec, vertices=12, mat=gold)
    add_crystal_prism("Altar_PrayerCrystal", root, 0.28, 0.62, crystal, sides=8, ty=1.66, double_ended=True, smooth=False)
    add_torus_ring("Altar_CelestialHalo", root, 0.42, 0.025, gold, ty=1.66, rx=math.pi * 0.5, major_seg=24, minor_seg=8)

    return root


def build_forge(mats: dict, gx: float, gz: float):
    root = create_root_empty("forge", gx, gz)
    bark = mats["mat_bark"]
    wood = mats["mat_wood"]
    iron = mats["mat_iron"]
    stone = mats["mat_stone"]
    slate = mats["mat_slate"]
    lava = mats["mat_lava"]
    cloth = mats["mat_cloth"]
    water = mats["mat_water"]

    # 1. At x = -1.2: Heavy oak stump bound with iron hoops + Forged London-Pattern Horn Anvil
    stump_sec = [
        (0.00, 0.56, 0.56, 0.0, 0.0, 0.06),
        (0.46, 0.48, 0.48, 0.0, 0.0, 0.06),
    ]
    add_lofted_tube("Forge_AnvilStump", root, stump_sec, vertices=12, mat=bark, tx=-1.2, flute_amp=0.05, flute_freq=6)
    add_torus_ring("Forge_StumpHoopBot", root, 0.53, 0.028, iron, tx=-1.2, ty=0.14, major_seg=18, minor_seg=6)
    add_torus_ring("Forge_StumpHoopTop", root, 0.49, 0.028, iron, tx=-1.2, ty=0.38, major_seg=18, minor_seg=6)

    # Anvil stepped foot, waist, and working face
    add_beveled_box("Forge_AnvilFoot", root, 0.88, 0.14, 0.62, iron, tx=-1.2, ty=0.52, bevel=0.03)
    add_beveled_box("Forge_AnvilWaist", root, 0.56, 0.24, 0.42, iron, tx=-1.2, ty=0.68, bevel=0.04)
    add_beveled_box("Forge_AnvilFace", root, 1.18, 0.24, 0.48, iron, tx=-1.15, ty=0.88, bevel=0.03)

    # Conical anvil horn pointing to x = -2.32, y = 0.90
    horn_sec = [
        (0.00, 0.12, 0.22, 0.0, 0.0, 0.15),
        (0.32, 0.09, 0.14, 0.02, 0.0, 0.10),
        (0.66, 0.02, 0.02, 0.04, 0.0, 0.0),
    ]
    add_lofted_tube("Forge_AnvilHorn", root, horn_sec, vertices=10, mat=iron, tx=-1.68, ty=0.88, tz=0.0, rz=math.pi * 0.5)

    # Resting blacksmith hammer on the anvil face
    add_beveled_box("Forge_HammerShaft", root, 0.46, 0.045, 0.045, wood, tx=-1.05, ty=1.02, tz=0.08, ry=0.45, bevel=0.01)
    add_beveled_box("Forge_HammerHead", root, 0.12, 0.10, 0.22, iron, tx=-1.20, ty=1.05, tz=0.00, ry=0.45, bevel=0.02)

    # Wooden quench bucket at x = -0.35, z = -0.58
    bucket_sec = [
        (0.00, 0.24, 0.24, 0.0, 0.0, 0.0),
        (0.48, 0.29, 0.29, 0.0, 0.0, 0.0),
    ]
    add_lofted_tube("Forge_QuenchBucket", root, bucket_sec, vertices=12, mat=wood, tx=-0.35, tz=-0.58)
    add_torus_ring("Forge_BucketWater", root, 0.16, 0.11, water, tx=-0.35, ty=0.44, tz=-0.58, major_seg=14, minor_seg=6)

    # 2. At x = +1.3: Domed stone-and-brick blacksmith furnace + glowing molten coal bed + chimney
    add_beveled_box("Forge_FurnacePlinth", root, 1.95, 0.72, 1.72, slate, tx=1.30, ty=0.36, tz=0.0, bevel=0.04)
    # Left, right, and back hearth walls framing the front opening
    add_beveled_box("Forge_HearthLeftWall", root, 0.42, 0.95, 1.56, stone, tx=0.58, ty=1.15, tz=0.0, bevel=0.04)
    add_beveled_box("Forge_HearthRightWall", root, 0.42, 0.95, 1.56, stone, tx=2.02, ty=1.15, tz=0.0, bevel=0.04)
    add_beveled_box("Forge_HearthBackWall", root, 1.82, 0.95, 0.46, stone, tx=1.30, ty=1.15, tz=-0.55, bevel=0.04)

    # Domed stone hood & tall chimney stack
    hood_sec = [
        (1.58, 0.96, 0.84, 0.0, 0.0, 0.35),
        (2.15, 0.62, 0.56, 0.0, -0.06, 0.25),
        (2.95, 0.42, 0.42, 0.0, -0.10, 0.10),
        (3.12, 0.48, 0.48, 0.0, -0.10, 0.10),
    ]
    add_lofted_tube("Forge_ChimneyStack", root, hood_sec, vertices=12, mat=slate, tx=1.30, smooth=False)
    add_beveled_box("Forge_ArchKeystone", root, 1.48, 0.22, 0.26, iron, tx=1.30, ty=1.56, tz=0.72, bevel=0.02)

    # Glowing molten coal bed inside and spilling warm light at the hearth mouth
    add_faceted_boulder(
        "Forge_MoltenCoalBed",
        root,
        0.64,
        0.36,
        0.58,
        lava,
        tx=1.30,
        ty=0.84,
        tz=0.18,
        subdivisions=2,
        crag=0.22,
        seed=88,
        flat_bottom=True,
    )

    # Side leather-and-wood bellows at x = 2.42
    add_beveled_box("Forge_BellowsTop", root, 0.68, 0.10, 0.48, wood, tx=2.45, ty=1.02, tz=0.0, rz=0.18, bevel=0.02)
    add_beveled_box("Forge_BellowsBag", root, 0.62, 0.24, 0.42, cloth, tx=2.45, ty=0.88, tz=0.0, rz=0.08, bevel=0.03)
    add_beveled_box("Forge_BellowsBot", root, 0.68, 0.08, 0.48, wood, tx=2.45, ty=0.74, tz=0.0, bevel=0.02)

    return root


def build_bank_booth(mats: dict, gx: float, gz: float):
    root = create_root_empty("bank_booth", gx, gz)
    wood = mats["mat_wood"]
    stone = mats["mat_stone"]
    gold = mats["mat_gold"]
    iron = mats["mat_iron"]
    sandstone = mats["mat_sandstone"]

    # Stone base plinth & carved mahogany counter at z = 0.4, width = 2.4m
    add_beveled_box("Bank_StonePlinth", root, 2.52, 0.16, 0.84, stone, tx=0.0, ty=0.08, tz=0.40, bevel=0.02)
    add_beveled_box("Bank_CounterBody", root, 2.40, 0.88, 0.72, wood, tx=0.0, ty=0.56, tz=0.40, bevel=0.03)
    add_beveled_box("Bank_CounterTopSlab", root, 2.56, 0.10, 0.86, wood, tx=0.0, ty=1.04, tz=0.40, bevel=0.02)

    # Decorative front gold recessed panel frames
    for px in (-0.75, 0.0, 0.75):
        add_beveled_box(f"Bank_FrontPanel_{px:.2f}", root, 0.56, 0.56, 0.04, gold, tx=px, ty=0.56, tz=0.76, bevel=0.01)

    # Twin fluted side columns supporting the roof lintel
    for sx in (-1.12, 1.12):
        col_sec = [
            (1.08, 0.12, 0.12, 0.0, 0.0, 0.0),
            (1.88, 0.10, 0.10, 0.0, 0.0, 0.0),
        ]
        add_lofted_tube(f"Bank_Column_{sx:.2f}", root, col_sec, vertices=12, mat=wood, tx=sx, tz=0.40, flute_amp=0.07, flute_freq=6)

    # Brass/Iron teller window grille bars on left and right sides (leaving center teller opening clear)
    for bx in (-0.92, -0.74, -0.56, 0.56, 0.74, 0.92):
        bar_sec = [(1.08, 0.022, 0.022, 0.0, 0.0, 0.0), (1.86, 0.022, 0.022, 0.0, 0.0, 0.0)]
        add_lofted_tube(f"Bank_GrilleBar_{bx:.2f}", root, bar_sec, vertices=8, mat=gold, tx=bx, tz=0.58)
    add_beveled_box("Bank_GrilleTransom", root, 2.36, 0.05, 0.06, iron, tx=0.0, ty=1.46, tz=0.58, bevel=0.01)

    # Stacked piles of golden coins & parchment scroll ledger on counter top (y = 1.09)
    for c_idx, (cx, cz, ch) in enumerate([(-0.68, 0.35, 0.14), (-0.54, 0.42, 0.09), (0.62, 0.38, 0.12)]):
        coin_sec = [(1.09, 0.08, 0.08, 0.0, 0.0, 0.0), (1.09 + ch, 0.075, 0.075, 0.0, 0.0, 0.0)]
        add_lofted_tube(f"Bank_CoinStack_{c_idx}", root, coin_sec, vertices=10, mat=gold, tx=cx, tz=cz)
    add_beveled_box("Bank_LedgerScroll", root, 0.38, 0.04, 0.28, sandstone, tx=0.12, ty=1.10, tz=0.36, ry=0.18, bevel=0.01)

    # Gilded frieze roof lintel at y = 1.95 (leaving y = 1.55, z = 0.82 clear for Three.js BANK sign)
    add_beveled_box("Bank_RoofCornice", root, 2.66, 0.16, 1.02, wood, tx=0.0, ty=1.88, tz=0.35, bevel=0.03)
    add_beveled_box("Bank_GoldLintel", root, 2.74, 0.16, 1.08, gold, tx=0.0, ty=2.02, tz=0.35, bevel=0.03)
    # Recessed wooden sign backing board at z = 0.75 (behind z = 0.82 sign plane)
    add_beveled_box("Bank_SignBoardBacking", root, 1.72, 0.46, 0.06, wood, tx=0.0, ty=1.55, tz=0.74, bevel=0.01)

    return root


def build_castle(mats: dict, gx: float, gz: float):
    """
    Sculpted Lumbridge Castle Keep matching exact coordinates of `createCastleStructure` in `runtime.ts`:
      - Central Keep at (0, 4.1, -3.5) with pitched slate roof at (0, 9.6, -3.5)
      - 4 Corner Battlement Towers at (-9, -9), (9, -9), (-9, 8), (9, 8) with spires at y = 10.0 and finials at y = 12.0
      - Curtain walls along z = -9, x = ±9, and front gate walls along z = 8 with central archway (x = -1.7..1.7)
    """
    root = create_root_empty("castle", gx, gz)
    stone = mats["mat_stone"]
    slate = mats["mat_slate"]
    gold = mats["mat_gold"]
    wood = mats["mat_wood"]
    iron = mats["mat_iron"]

    # 1. Central 2-story stone Keep at (0, 4.1, -3.5) (7.6 x 8.2 x 6.2)
    add_beveled_box("Castle_KeepBody", root, 7.6, 8.2, 6.2, stone, tx=0.0, ty=4.1, tz=-3.5, bevel=0.04)
    add_beveled_box("Castle_KeepPlinth", root, 8.0, 0.9, 6.6, slate, tx=0.0, ty=0.45, tz=-3.5, bevel=0.03)
    add_beveled_box("Castle_KeepStringcourse", root, 7.85, 0.28, 6.45, stone, tx=0.0, ty=4.4, tz=-3.5, bevel=0.02)
    add_beveled_box("Castle_KeepCornice", root, 8.0, 0.36, 6.6, stone, tx=0.0, ty=8.1, tz=-3.5, bevel=0.03)

    # Keep corner pilaster buttresses
    for bx in (-3.75, 3.75):
        for bz in (-6.55, -0.45):
            add_beveled_box(f"Castle_KeepPilaster_{bx}_{bz}", root, 0.55, 8.2, 0.55, stone, tx=bx, ty=4.1, tz=bz, bevel=0.02)

    # Keep arched windows & grand oak double doors on front face (z = -0.4)
    add_beveled_box("Castle_KeepDoorFrame", root, 1.85, 2.85, 0.28, slate, tx=0.0, ty=1.42, tz=-0.38, bevel=0.03)
    add_beveled_box("Castle_KeepDoorWood", root, 1.48, 2.55, 0.18, wood, tx=0.0, ty=1.28, tz=-0.32, bevel=0.02)
    for wx in (-2.2, 0.0, 2.2):
        add_beveled_box(f"Castle_KeepWindowUpper_{wx}", root, 0.78, 1.55, 0.22, slate, tx=wx, ty=6.15, tz=-0.38, bevel=0.02)

    # Pitched 4-sided overhanging pyramid slate roof over Keep (y = 8.15..11.25, centered at z = -3.5)
    keep_roof_sec = [
        (8.15, 6.15, 5.15, 0.0, 0.0, 0.0),
        (8.35, 6.00, 5.00, 0.0, 0.0, 0.0),
        (11.25, 0.05, 0.05, 0.0, 0.0, 0.0),
    ]
    add_lofted_tube("Castle_KeepRoof", root, keep_roof_sec, vertices=4, mat=slate, tx=0.0, tz=-3.5, ry=math.pi * 0.25, smooth=False)
    add_crystal_prism("Castle_KeepFinial", root, 0.22, 0.85, gold, sides=6, tx=0.0, ty=11.15, tz=-3.5, smooth=False)

    # 2. Curtain walls & Crenelations
    # Back wall along z = -9
    add_beveled_box("Castle_WallBack", root, 19.2, 5.2, 1.4, stone, tx=0.0, ty=2.6, tz=-9.0, bevel=0.03)
    # Left & Right walls along x = ±9
    add_beveled_box("Castle_WallLeft", root, 1.4, 5.2, 17.0, stone, tx=-9.0, ty=2.6, tz=-0.5, bevel=0.03)
    add_beveled_box("Castle_WallRight", root, 1.4, 5.2, 17.0, stone, tx=9.0, ty=2.6, tz=-0.5, bevel=0.03)
    # Front gate walls along z = 8 (leaving x = -1.7..1.7 open for gateway)
    add_beveled_box("Castle_WallFrontLeft", root, 7.4, 5.2, 1.4, stone, tx=-5.4, ty=2.6, tz=8.0, bevel=0.03)
    add_beveled_box("Castle_WallFrontRight", root, 7.4, 5.2, 1.4, stone, tx=5.4, ty=2.6, tz=8.0, bevel=0.03)

    # Central Gatehouse Archway above y = 3.8 at z = 8.0 + Timber Hoarding + Raised Iron Portcullis
    add_beveled_box("Castle_GatehouseHeader", root, 3.8, 1.45, 1.65, stone, tx=0.0, ty=4.55, tz=8.0, bevel=0.03)
    add_beveled_box("Castle_GatehouseHoarding", root, 3.6, 0.55, 1.85, wood, tx=0.0, ty=4.65, tz=8.0, bevel=0.02)
    for px in (-1.2, -0.72, -0.24, 0.24, 0.72, 1.2):
        add_beveled_box(f"Castle_PortcullisSpike_{px:.2f}", root, 0.09, 0.75, 0.09, iron, tx=px, ty=3.68, tz=8.0, bevel=0.01)

    def add_merlons(prefix: str, x0: float, z0: float, x1: float, z1: float, y_top: float):
        length = math.hypot(x1 - x0, z1 - z0)
        n = max(2, int(length // 1.15))
        for i in range(n):
            if i % 2 == 1:
                continue
            t = 0.5 if n == 1 else i / (n - 1)
            mx = x0 + (x1 - x0) * t
            mz = z0 + (z1 - z0) * t
            add_beveled_box(f"Castle_Merlon_{prefix}_{i}", root, 0.70, 0.55, 0.70, stone, tx=mx, ty=y_top, tz=mz, bevel=0.02)

    add_merlons("Back", -9.0, -9.0, 9.0, -9.0, 5.4)
    add_merlons("FrontL", -9.1, 8.0, -1.7, 8.0, 5.4)
    add_merlons("FrontR", 1.7, 8.0, 9.1, 8.0, 5.4)
    add_merlons("Left", -9.0, -9.0, -9.0, 8.0, 5.4)
    add_merlons("Right", 9.0, -9.0, 9.0, 8.0, 5.4)

    # 3. 4 Octagonal/Cylindrical Corner Battlement Towers at (-9, -9), (9, -9), (-9, 8), (9, 8)
    towers = [(-9.0, -9.0, "NW"), (9.0, -9.0, "NE"), (-9.0, 8.0, "SW"), (9.0, 8.0, "SE")]
    for tx, tz, t_tag in towers:
        t_sec = [
            (0.0, 2.05, 2.05, 0.0, 0.0, 0.22),
            (0.9, 1.78, 1.78, 0.0, 0.0, 0.22),
            (7.6, 1.68, 1.68, 0.0, 0.0, 0.22),
            (8.0, 1.92, 1.92, 0.0, 0.0, 0.22),
            (8.4, 1.92, 1.92, 0.0, 0.0, 0.22),
        ]
        add_lofted_tube(f"Castle_Tower_{t_tag}", root, t_sec, vertices=8, mat=stone, tx=tx, tz=tz, smooth=False)

        # Conical/octagonal slate spire (y = 8.35..11.75, centered around y = 10.0)
        spire_sec = [
            (8.35, 2.15, 2.15, 0.0, 0.0, 0.15),
            (11.75, 0.04, 0.04, 0.0, 0.0, 0.15),
        ]
        add_lofted_tube(f"Castle_Spire_{t_tag}", root, spire_sec, vertices=8, mat=slate, tx=tx, tz=tz, smooth=False)
        add_crystal_prism(f"Castle_Finial_{t_tag}", root, 0.22, 0.72, gold, sides=6, tx=tx, ty=11.65, tz=tz, smooth=False)

    return root


# =============================================================================
# C. BIOME LANDMARKS & BRIDGES (16 - 23)
# =============================================================================
def build_river_bridge(mats: dict, gx: float, gz: float):
    """
    Arched medieval stone-and-timber bridge (`x = -7.2..7.2, z = -1.9..1.9`) matching `buildRiverBridge` in `runtime.ts`.
    """
    root = create_root_empty("river_bridge", gx, gz)
    wood = mats["mat_wood"]
    stone = mats["mat_stone"]
    slate = mats["mat_slate"]

    # Stone abutment piers at both ends (x = ±6.8)
    for sx in (-6.85, 6.85):
        add_beveled_box(f"Bridge_Abutment_{sx:.1f}", root, 1.15, 0.95, 4.15, stone, tx=sx, ty=0.22, tz=0.0, bevel=0.04)

    # Twin arched timber stringer beams underneath the deck
    for sz in (-1.35, 1.35):
        beam_pts = []
        for i in range(-7, 8):
            t = i / 7.0
            arch_y = math.cos(t * math.pi * 0.5) * 1.15 - 0.26
            beam_pts.append((i * 1.0, arch_y, sz, 0.14, 0.14))
        add_curve_tube(f"Bridge_Stringer_{sz:.2f}", root, beam_pts, vertices=8, mat=wood, smooth=False)

    # 15 arched timber deck planks following `archY = cos(t * pi * 0.5) * 1.15 - 0.1`
    for i in range(-7, 8):
        t = i / 7.0
        arch_y = math.cos(t * math.pi * 0.5) * 1.15 - 0.10
        slope = 0.18 * math.sin(t * math.pi * 0.5)
        add_beveled_box(
            f"Bridge_Plank_{i + 7}",
            root,
            0.84,
            0.22,
            3.80,
            wood,
            tx=i * 1.0,
            ty=arch_y,
            tz=0.0,
            rz=-slope,
            bevel=0.02,
        )

    # Stone parapet posts & curved handrails along z = ±1.8
    for oz in (-1.82, 1.82):
        for px_i in (-7, -3, 0, 3, 7):
            t = px_i / 7.0
            base_y = math.cos(t * math.pi * 0.5) * 1.15 - 0.10
            add_beveled_box(
                f"Bridge_Post_{oz:.1f}_{px_i}",
                root,
                0.32,
                1.05,
                0.32,
                stone,
                tx=px_i * 1.0,
                ty=base_y + 0.52,
                tz=oz,
                bevel=0.02,
            )
            add_beveled_box(
                f"Bridge_PostCap_{oz:.1f}_{px_i}",
                root,
                0.38,
                0.12,
                0.38,
                slate,
                tx=px_i * 1.0,
                ty=base_y + 1.08,
                tz=oz,
                bevel=0.02,
            )

        rail_pts = []
        for i in range(-7, 8):
            t = i / 7.0
            ry = math.cos(t * math.pi * 0.5) * 1.25 + 0.80
            rail_pts.append((i * 1.02, ry, oz, 0.11, 0.11))
        add_curve_tube(f"Bridge_Handrail_{oz:.1f}", root, rail_pts, vertices=8, mat=stone)

    return root


def build_sandstone_arch(mats: dict, gx: float, gz: float):
    root = create_root_empty("sandstone_arch", gx, gz)
    sandstone = mats["mat_sandstone"]
    gold = mats["mat_gold"]
    crystal = mats["mat_crystal"]

    # Twin tapered carved sandstone obelisk pillars (x = ±1.6, height = 4.2m)
    for sx in (-1.6, 1.6):
        add_beveled_box(f"SandstoneArch_Plinth_{sx:.1f}", root, 1.42, 0.36, 1.42, sandstone, tx=sx, ty=0.18, bevel=0.03)
        p_sec = [
            (0.36, 0.62, 0.62, 0.0, 0.0, 0.25),
            (3.85, 0.45, 0.45, 0.0, 0.0, 0.25),
            (4.18, 0.58, 0.58, 0.0, 0.0, 0.25),
        ]
        add_lofted_tube(f"SandstoneArch_Pillar_{sx:.1f}", root, p_sec, vertices=12, mat=sandstone, tx=sx, flute_amp=0.04, flute_freq=6)
        # Hieroglyphic gold collar bands
        add_torus_ring(f"SandstoneArch_BandBot_{sx:.1f}", root, 0.58, 0.04, gold, tx=sx, ty=1.25, major_seg=16, minor_seg=6)
        add_torus_ring(f"SandstoneArch_BandTop_{sx:.1f}", root, 0.49, 0.04, gold, tx=sx, ty=3.15, major_seg=16, minor_seg=6)

    # Stepped cornice lintel at y = 4.3
    add_beveled_box("SandstoneArch_LintelLower", root, 4.25, 0.46, 1.12, sandstone, ty=4.22, bevel=0.04)
    add_beveled_box("SandstoneArch_LintelGold", root, 4.42, 0.14, 1.22, gold, ty=4.50, bevel=0.02)
    add_beveled_box("SandstoneArch_LintelCornice", root, 4.65, 0.26, 1.32, sandstone, ty=4.68, bevel=0.03)

    # Winged golden sun-disc crest at y = 4.95
    add_faceted_boulder("SandstoneArch_SunDisc", root, 0.48, 0.48, 0.24, gold, ty=5.02, subdivisions=2, crag=0.0, flat_bottom=False, smooth=True)
    add_crystal_prism("SandstoneArch_SunGem", root, 0.18, 0.36, crystal, sides=8, ty=5.02, tz=0.22, rx=math.pi * 0.5, double_ended=True)
    for wx, tilt in ((-0.78, 0.22), (0.78, -0.22)):
        add_beveled_box(f"SandstoneArch_Wing_{wx:.2f}", root, 0.92, 0.24, 0.14, gold, tx=wx, ty=4.98, rz=tilt, bevel=0.02)

    return root


def build_palm_tree(mats: dict, gx: float, gz: float):
    root = create_root_empty("palm_tree", gx, gz)
    bark = mats["mat_bark"]
    foliage = mats["mat_foliage"]
    gold = mats["mat_gold"]

    # Curved desert date palm trunk (height = 3.4m) with segmented ring texture
    trunk_sections = []
    segs = 15
    for i in range(segs):
        t = i / (segs - 1)
        y = t * 3.35
        rib = 1.0 + (0.12 if i % 2 == 1 else -0.04)
        r = (0.29 * (1.0 - t * 0.42)) * rib
        off_x = (t ** 1.55) * 0.48
        off_z = math.sin(t * math.pi) * 0.08
        trunk_sections.append((y, r, r, off_x, off_z, 0.0))
    add_lofted_tube("PalmTree_Trunk", root, trunk_sections, vertices=12, mat=bark)

    # Cluster of golden dates at y = 2.85..3.15
    crown_x, crown_y, crown_z = 0.48, 3.32, 0.0
    for d_idx in range(5):
        ang = (d_idx / 5.0) * math.pi * 2.0
        dx = crown_x + math.cos(ang) * 0.20
        dz = crown_z + math.sin(ang) * 0.20
        add_faceted_boulder(
            f"PalmTree_Dates_{d_idx}",
            root,
            0.14,
            0.18,
            0.14,
            gold,
            tx=dx,
            ty=3.02,
            tz=dz,
            subdivisions=1,
            crag=0.05,
            seed=d_idx,
            flat_bottom=False,
            smooth=True,
        )

    # 7 arching ribbed palm fronds radiating cleanly from the crown
    for f_idx in range(7):
        ang = (f_idx / 7.0) * math.pi * 2.0 + 0.25
        ca, sa = math.cos(ang), math.sin(ang)
        tx_tan, tz_tan = -sa, ca
        bm = bmesh.new()
        arc_profile = [
            # (dist_out, y_off, half_width, spine_thick)
            (0.05, 0.02, 0.08, 0.05),
            (0.48, 0.24, 0.30, 0.06),
            (0.98, 0.14, 0.36, 0.05),
            (1.42, -0.22, 0.24, 0.04),
            (1.75, -0.68, 0.03, 0.02),
        ]
        rings = []
        for dist_out, y_off, hw, st in arc_profile:
            px = crown_x + ca * dist_out
            py = crown_y + y_off
            pz = crown_z + sa * dist_out
            v_top = bm.verts.new(t2b(px, py + st, pz))
            v_right = bm.verts.new(t2b(px + tx_tan * hw, py - st * 0.6, pz + tz_tan * hw))
            v_bot = bm.verts.new(t2b(px, py - st * 0.4, pz))
            v_left = bm.verts.new(t2b(px - tx_tan * hw, py - st * 0.6, pz - tz_tan * hw))
            rings.append((v_top, v_right, v_bot, v_left))
        for r_i in range(len(rings) - 1):
            ra, rb = rings[r_i], rings[r_i + 1]
            for k in range(4):
                k_next = (k + 1) % 4
                bm.faces.new((ra[k], ra[k_next], rb[k_next], rb[k]))
        bm.faces.new((rings[0][3], rings[0][2], rings[0][1], rings[0][0]))
        bm.faces.new((rings[-1][0], rings[-1][1], rings[-1][2], rings[-1][3]))
        finalize_mesh(f"PalmTree_Frond_{f_idx}", bm, root, foliage, smooth=False)

    return root


def build_plaza_pillar(mats: dict, gx: float, gz: float):
    root = create_root_empty("plaza_pillar", gx, gz)
    stone = mats["mat_stone"]
    slate = mats["mat_slate"]
    gold = mats["mat_gold"]
    iron = mats["mat_iron"]
    lava = mats["mat_lava"]

    # Stepped marble plinth (y = 0..0.48)
    add_beveled_box("PlazaPillar_BaseSlab", root, 1.78, 0.22, 1.78, slate, ty=0.11, bevel=0.03)
    plinth_sec = [
        (0.22, 0.84, 0.84, 0.0, 0.0, 0.0),
        (0.48, 0.68, 0.68, 0.0, 0.0, 0.0),
    ]
    add_lofted_tube("PlazaPillar_PlinthMold", root, plinth_sec, vertices=16, mat=stone)
    add_torus_ring("PlazaPillar_BaseRing", root, 0.64, 0.05, gold, ty=0.50, major_seg=20, minor_seg=8)

    # Fluted marble Corinthian shaft (y = 0.48..5.15)
    shaft_sec = [
        (0.48, 0.55, 0.55, 0.0, 0.0, 0.0),
        (2.80, 0.49, 0.49, 0.0, 0.0, 0.0),
        (5.05, 0.43, 0.43, 0.0, 0.0, 0.0),
        (5.18, 0.52, 0.52, 0.0, 0.0, 0.0),
    ]
    add_lofted_tube("PlazaPillar_FlutedShaft", root, shaft_sec, vertices=20, mat=stone, flute_amp=0.06, flute_freq=10)
    add_torus_ring("PlazaPillar_NeckRing", root, 0.48, 0.045, gold, ty=5.06, major_seg=20, minor_seg=8)

    # Ornate golden capital + abacus at y = 5.35
    cap_sec = [
        (5.12, 0.46, 0.46, 0.0, 0.0, 0.15),
        (5.42, 0.68, 0.68, 0.0, 0.0, 0.25),
    ]
    add_lofted_tube("PlazaPillar_GoldCapital", root, cap_sec, vertices=12, mat=gold, flute_amp=0.08, flute_freq=6)
    add_beveled_box("PlazaPillar_Abacus", root, 1.24, 0.18, 1.24, stone, ty=5.48, bevel=0.03)

    # Ceremonial brazier bowl & glowing flame on top (y = 5.55..6.05)
    bowl_sec = [
        (5.56, 0.24, 0.24, 0.0, 0.0, 0.0),
        (5.78, 0.48, 0.48, 0.0, 0.0, 0.0),
        (5.86, 0.44, 0.44, 0.0, 0.0, 0.0),
    ]
    add_lofted_tube("PlazaPillar_BrazierBowl", root, bowl_sec, vertices=14, mat=iron)
    add_crystal_prism("PlazaPillar_BrazierFlame", root, 0.28, 0.46, lava, sides=7, ty=5.82, no_outline=True)

    return root


def build_mystic_mushroom(mats: dict, gx: float, gz: float):
    root = create_root_empty("mystic_mushroom", gx, gz)
    stone = mats["mat_stone"]
    sandstone = mats["mat_sandstone"]
    cap_mat = mats["mat_mushroom_cap"]
    crystal = mats["mat_crystal"]

    def add_mushroom(prefix: str, ox: float, oz: float, scale: float, lean_x: float, lean_z: float):
        # Curved pale stalk
        stem_sec = [
            (0.00 * scale, 0.34 * scale, 0.34 * scale, ox, oz, 0.0),
            (0.45 * scale, 0.25 * scale, 0.25 * scale, ox + lean_x * 0.35, oz + lean_z * 0.35, 0.0),
            (0.95 * scale, 0.21 * scale, 0.21 * scale, ox + lean_x * 0.75, oz + lean_z * 0.75, 0.0),
            (1.32 * scale, 0.26 * scale, 0.26 * scale, ox + lean_x, oz + lean_z, 0.0),
        ]
        add_lofted_tube(f"{prefix}_Stem", root, stem_sec, vertices=14, mat=stone)

        # Pleated underside gills
        gill_sec = [
            (1.18 * scale, 0.24 * scale, 0.24 * scale, ox + lean_x, oz + lean_z, 0.0),
            (1.30 * scale, 0.82 * scale, 0.82 * scale, ox + lean_x, oz + lean_z, 0.0),
        ]
        add_lofted_tube(f"{prefix}_Gills", root, gill_sec, vertices=20, mat=sandstone, flute_amp=0.08, flute_freq=10)

        # Domed bioluminescent cap (`mat_mushroom_cap`)
        cap_sec = [
            (1.26 * scale, 0.92 * scale, 0.92 * scale, ox + lean_x, oz + lean_z, 0.0),
            (1.42 * scale, 0.86 * scale, 0.86 * scale, ox + lean_x, oz + lean_z, 0.0),
            (1.66 * scale, 0.58 * scale, 0.58 * scale, ox + lean_x, oz + lean_z, 0.0),
            (1.82 * scale, 0.22 * scale, 0.22 * scale, ox + lean_x, oz + lean_z, 0.0),
            (1.86 * scale, 0.01 * scale, 0.01 * scale, ox + lean_x, oz + lean_z, 0.0),
        ]
        add_lofted_tube(f"{prefix}_Cap", root, cap_sec, vertices=18, mat=cap_mat)

    # Main giant mushroom (height ~ 1.85m, cap base at y = 1.35m) + 2 companion mushrooms
    add_mushroom("Mushroom_Main", 0.0, 0.0, 1.0, 0.06, -0.04)
    add_mushroom("Mushroom_SubA", 0.62, 0.32, 0.46, 0.14, 0.08)
    add_mushroom("Mushroom_SubB", -0.54, 0.28, 0.36, -0.12, 0.06)

    # Glowing bioluminescent spots on main cap
    spots = [
        (0.06, 1.82, -0.04, 0.12),
        (0.42, 1.62, 0.28, 0.10),
        (-0.36, 1.64, 0.25, 0.10),
        (0.22, 1.60, -0.45, 0.09),
        (-0.28, 1.58, -0.38, 0.09),
    ]
    for s_idx, (sx, sy, sz, sr) in enumerate(spots):
        add_faceted_boulder(
            f"Mushroom_GlowSpot_{s_idx}",
            root,
            sr,
            sr * 0.55,
            sr,
            crystal,
            tx=sx,
            ty=sy,
            tz=sz,
            subdivisions=1,
            crag=0.0,
            flat_bottom=False,
            smooth=True,
        )

    return root


def build_woods_lantern(mats: dict, gx: float, gz: float):
    root = create_root_empty("woods_lantern", gx, gz)
    stone = mats["mat_stone"]
    slate = mats["mat_slate"]
    bark = mats["mat_bark"]
    foliage = mats["mat_foliage"]
    iron = mats["mat_iron"]
    gold = mats["mat_gold"]
    lava = mats["mat_lava"]

    # Mossy stepped stone pedestal
    add_beveled_box("WoodsLantern_PedestalA", root, 0.86, 0.18, 0.86, slate, ty=0.09, bevel=0.03)
    add_beveled_box("WoodsLantern_PedestalB", root, 0.62, 0.22, 0.62, stone, ty=0.28, bevel=0.03)
    add_canopy_cluster("WoodsLantern_BaseMoss", root, 0.42, 0.16, 0.42, foliage, tx=0.14, ty=0.22, tz=0.16, lobes=5, seed=91)

    # Curved mossy wooden post arching over at the top
    post_pts = [
        (-0.12, 0.32, 0.0, 0.13, 0.13),
        (-0.22, 1.05, 0.0, 0.11, 0.11),
        (-0.26, 1.85, 0.0, 0.095, 0.095),
        (-0.12, 2.52, 0.0, 0.08, 0.08),
        (0.18, 2.68, 0.0, 0.065, 0.065),
    ]
    add_curve_tube("WoodsLantern_Post", root, post_pts, vertices=10, mat=bark)
    add_canopy_cluster("WoodsLantern_PostMoss", root, 0.22, 0.14, 0.20, foliage, tx=-0.16, ty=2.55, tz=0.0, lobes=5, seed=92)

    # Hanging iron chain & pagoda-roofed lantern cage at (x = 0.12, y = 2.30, z = 0.0)
    add_torus_ring("WoodsLantern_ChainRing", root, 0.06, 0.018, iron, tx=0.12, ty=2.58, rz=math.pi * 0.5, major_seg=12, minor_seg=6)
    cage_roof_sec = [
        (2.42, 0.34, 0.34, 0.12, 0.0, 0.2),
        (2.56, 0.04, 0.04, 0.12, 0.0, 0.2),
    ]
    add_lofted_tube("WoodsLantern_PagodaRoof", root, cage_roof_sec, vertices=6, mat=slate, smooth=False)
    cage_base_sec = [
        (2.06, 0.18, 0.18, 0.12, 0.0, 0.2),
        (2.14, 0.26, 0.26, 0.12, 0.0, 0.2),
    ]
    add_lofted_tube("WoodsLantern_CageBase", root, cage_base_sec, vertices=6, mat=slate, smooth=False)

    # Warm glowing spirit orb at y = 2.28
    add_faceted_boulder(
        "WoodsLantern_SpiritOrb",
        root,
        0.22,
        0.24,
        0.22,
        gold,
        tx=0.12,
        ty=2.28,
        tz=0.0,
        subdivisions=2,
        crag=0.0,
        flat_bottom=False,
        smooth=True,
    )
    add_crystal_prism("WoodsLantern_FlameCore", root, 0.14, 0.32, lava, sides=6, tx=0.12, ty=2.28, double_ended=True, no_outline=True)

    return root


def build_obsidian_spire(mats: dict, gx: float, gz: float):
    root = create_root_empty("obsidian_spire", gx, gz)
    obsidian = mats["mat_obsidian"]
    lava = mats["mat_lava"]
    slate = mats["mat_slate"]

    # Craggy volcanic base rock
    add_faceted_boulder("ObsidianSpire_BaseCrust", root, 1.35, 0.55, 1.35, slate, ty=0.28, crag=0.22, seed=101)

    # Main hexagonal black obsidian monolith (height = 6.4m) + 3 flanking shards
    add_crystal_prism("ObsidianSpire_MainMonolith", root, 0.85, 6.40, obsidian, sides=7, smooth=False)
    flanking = [
        ("ShardA", 0.68, 0.0, 0.32, 0.46, 3.85, 0.08, 0.0, -0.22),
        ("ShardB", -0.62, 0.0, 0.38, 0.42, 3.25, 0.12, 0.0, 0.24),
        ("ShardC", 0.05, 0.0, -0.68, 0.38, 2.65, -0.24, 0.0, 0.05),
    ]
    for sname, sx, sy, sz, sr, sh, srx, sry, srz in flanking:
        add_crystal_prism(
            f"ObsidianSpire_{sname}",
            root,
            sr,
            sh,
            obsidian,
            sides=6,
            tx=sx,
            ty=sy,
            tz=sz,
            rx=srx,
            ry=sry,
            rz=srz,
            smooth=False,
        )

    # Glowing orange magma veins running up the spire seams
    for v_idx in range(3):
        ang = (v_idx / 3.0) * math.pi * 2.0 + 0.3
        ca, sa = math.cos(ang), math.sin(ang)
        vein_pts = [
            (ca * 0.92, 0.15, sa * 0.92, 0.09, 0.06),
            (ca * 0.76, 1.65, sa * 0.76, 0.07, 0.05),
            (ca * 0.58, 3.35, sa * 0.58, 0.055, 0.04),
            (ca * 0.36, 4.75, sa * 0.36, 0.035, 0.025),
        ]
        add_curve_tube(f"ObsidianSpire_MagmaVein_{v_idx}", root, vein_pts, vertices=6, mat=lava, no_outline=True)

    # Floating hellfire core at y = 5.6 + orbiting magma crystals
    add_crystal_prism("ObsidianSpire_HellfireCore", root, 0.28, 0.68, lava, sides=8, ty=5.65, double_ended=True, smooth=False)
    for o_idx in range(3):
        ang = (o_idx / 3.0) * math.pi * 2.0
        ox = math.cos(ang) * 0.65
        oz = math.sin(ang) * 0.65
        add_crystal_prism(
            f"ObsidianSpire_OrbitShard_{o_idx}",
            root,
            0.09,
            0.30,
            lava,
            sides=6,
            tx=ox,
            ty=5.65,
            tz=oz,
            rx=0.3,
            rz=-0.3,
            double_ended=True,
        )

    return root


def build_lava_fissure(mats: dict, gx: float, gz: float):
    root = create_root_empty("lava_fissure", gx, gz)
    obsidian = mats["mat_obsidian"]
    slate = mats["mat_slate"]
    lava = mats["mat_lava"]

    # Raised cracked black basalt lip edges framing the magma trench
    lips = [
        (-1.05, 0.14, -0.62, 0.85, 0.22, 0.38, 0.40, 111),
        (0.05, 0.15, -0.18, 0.95, 0.24, 0.40, 0.40, 112),
        (1.12, 0.14, 0.28, 0.82, 0.22, 0.36, 0.40, 113),
        (-0.85, 0.13, -0.02, 0.78, 0.20, 0.36, 0.40, 114),
        (0.75, 0.14, 0.72, 0.75, 0.22, 0.38, -0.75, 115),
    ]
    for idx, (lx, ly, lz, sx, sy, sz, ry_ang, seed) in enumerate(lips):
        mat = obsidian if idx % 2 == 0 else slate
        add_faceted_boulder(
            f"LavaFissure_BasaltLip_{idx}",
            root,
            sx,
            sy,
            sz,
            mat,
            tx=lx,
            ty=ly,
            tz=lz,
            ry=ry_ang,
            crag=0.20,
            seed=seed,
        )

    # Main glowing molten lava trench (length ~ 3.5m, rotated y = 0.4) + secondary branch (rotated y = -0.8)
    add_beveled_box("LavaFissure_MainCrack", root, 3.48, 0.12, 0.38, lava, tx=0.0, ty=0.08, tz=0.0, ry=0.40, bevel=0.03)
    add_beveled_box("LavaFissure_BranchCrack", root, 1.68, 0.12, 0.26, lava, tx=0.42, ty=0.09, tz=0.46, ry=-0.80, bevel=0.03)

    # Bubbling magma blisters along the fissure
    for b_idx, (bx, bz, br) in enumerate([(-0.95, -0.38, 0.14), (0.05, 0.02, 0.17), (0.92, 0.38, 0.13), (0.55, 0.58, 0.12)]):
        add_faceted_boulder(
            f"LavaFissure_Bubble_{b_idx}",
            root,
            br,
            br * 0.8,
            br,
            lava,
            tx=bx,
            ty=0.14,
            tz=bz,
            subdivisions=1,
            crag=0.08,
            seed=b_idx,
            flat_bottom=True,
            smooth=True,
        )

    return root


# =============================================================================
# BlendSwap Medieval Props (#6679)
# =============================================================================
def build_barrel(mats: dict, gx: float, gz: float):
    root = create_root_empty("barrel", gx, gz)
    src_obj = get_blend_object("blender/examples/medieval_props_6679/Props1.blend", "Barrel")
    if src_obj:
        add_imported_world_parts("barrel", root, src_obj, {0: mats["mat_wood"], 1: mats["mat_iron"]}, scale=1.0)
    return root

def build_crate(mats: dict, gx: float, gz: float):
    root = create_root_empty("crate", gx, gz)
    src_obj = get_blend_object("blender/examples/medieval_props_6679/Props1.blend", "Crate")
    if src_obj:
        add_imported_world_parts("crate", root, src_obj, {0: mats["mat_wood"]}, scale=0.85)
    return root

def build_box_cabbage(mats: dict, gx: float, gz: float):
    root = create_root_empty("box_cabbage", gx, gz)
    src_obj = get_blend_object("blender/examples/medieval_props_6679/Props1.blend", "Box.001")
    if src_obj:
        add_imported_world_parts("box_cabbage", root, src_obj, {0: mats["mat_wood"], 1: mats["mat_foliage"]}, scale=1.1)
    return root

def build_box_apples(mats: dict, gx: float, gz: float):
    root = create_root_empty("box_apples", gx, gz)
    src_obj = get_blend_object("blender/examples/medieval_props_6679/Props1.blend", "BoxWithApples")
    if src_obj:
        add_imported_world_parts("box_apples", root, src_obj, {0: mats["mat_cloth"], 1: mats["mat_wood"]}, scale=1.1)
    return root

def build_bag_grain(mats: dict, gx: float, gz: float):
    root = create_root_empty("bag_grain", gx, gz)
    src_obj = get_blend_object("blender/examples/medieval_props_6679/Props1.blend", "BagWithGrain")
    if src_obj:
        add_imported_world_parts("bag_grain", root, src_obj, {0: mats["mat_cloth"], 1: mats["mat_sandstone"]}, scale=1.0)
    return root

def build_bag_closed(mats: dict, gx: float, gz: float):
    root = create_root_empty("bag_closed", gx, gz)
    src_obj = get_blend_object("blender/examples/medieval_props_6679/Props1.blend", "BagClosed")
    if src_obj:
        add_imported_world_parts("bag_closed", root, src_obj, {0: mats["mat_wood"], 1: mats["mat_cloth"]}, scale=1.0)
    return root


# =============================================================================
# Diorama Showcase Builder & Preview Studio Render
# =============================================================================
def build_all_world_assets():
    mats = create_material_library()

    # Back row: Lumbridge Castle + River Bridge + Tall Biome Landmarks
    build_castle(mats, 0.0, -21.0)
    build_obsidian_spire(mats, -14.5, -15.0)
    build_plaza_pillar(mats, -18.5, -9.5)
    build_sandstone_arch(mats, 14.5, -15.0)
    build_river_bridge(mats, 0.0, -7.2)

    # Middle Row 1 (z = 0.0): All 7 Tree Species
    build_normal_tree(mats, -14.4, 0.0)
    build_oak_tree(mats, -9.6, 0.0)
    build_willow_tree(mats, -4.8, 0.0)
    build_magic_tree(mats, 0.0, 0.0)
    build_yew_tree(mats, 4.8, 0.0)
    build_maple_tree(mats, 9.6, 0.0)
    build_palm_tree(mats, 14.4, 0.0)

    # Middle Row 2 (z = 6.2): Interactive Stations & Forest Landmarks
    build_shrine(mats, -12.8, 6.2)
    build_altar(mats, -7.6, 6.2)
    build_forge(mats, -1.8, 6.2)
    build_bank_booth(mats, 4.0, 6.2)
    build_woods_lantern(mats, 8.8, 6.2)
    build_mystic_mushroom(mats, 13.2, 6.2)

    # Front Row 1 (z = 11.8): Resource Nodes & Volcanic Fissure
    build_tree_stump(mats, -9.2, 11.8)
    build_ore_rock(mats, -4.6, 11.8)
    build_rock_depleted(mats, 0.0, 11.8)
    build_fishing_spot(mats, 4.6, 11.8)
    build_lava_fissure(mats, 9.2, 11.8)

    # Front Row 2 (z = 16.5): Medieval Props & Market Goods (#6679)
    build_barrel(mats, -10.0, 16.5)
    build_crate(mats, -6.0, 16.5)
    build_box_cabbage(mats, -2.0, 16.5)
    build_box_apples(mats, 2.0, 16.5)
    build_bag_grain(mats, 6.0, 16.5)
    build_bag_closed(mats, 10.0, 16.5)


def setup_preview_studio_and_render(render_path: str | None):
    scene = bpy.context.scene

    world = bpy.data.worlds.new("WorldAssetStudio")
    scene.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = hex_to_rgba(0x161D2A)
        bg.inputs["Strength"].default_value = 1.05

    # Studio floor plinth (added AFTER glTF export so it only lives in world.blend & preview render)
    floor_mat = make_material("StudioFloorMat", 0x1E293B, roughness=0.78, metallic=0.05)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 48.0
        v.co.y *= 48.0
        v.co.z = (v.co.z - 0.5) * 0.4
    finalize_mesh("StudioDioramaFloor", bm, None, floor_mat, smooth=False, no_outline=True)

    cam_data = bpy.data.cameras.new("WorldShowcaseCamera")
    cam_data.lens = 31
    cam_data.clip_end = 250.0
    cam_obj = bpy.data.objects.new("WorldShowcaseCamera", cam_data)
    # Position camera in front (+Z in Three.js -> -Y in Blender) looking across the diorama grid toward the Castle
    cam_obj.location = t2b(0.0, 17.5, 34.5)
    target = Vector(t2b(0.0, 2.0, -1.0))
    direction = target - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    def add_light(lname, ltype, energy, hex_c, t_loc, t_target=(0.0, 2.0, 0.0)):
        ldata = bpy.data.lights.new(name=lname, type=ltype)
        ldata.energy = energy
        ldata.color = hex_to_rgba(hex_c)[:3]
        lobj = bpy.data.objects.new(name=lname, object_data=ldata)
        lobj.location = t2b(*t_loc)
        d = Vector(t2b(*t_target)) - lobj.location
        lobj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(lobj)
        return lobj

    add_light("SunKeyLight", "SUN", 3.6, 0xFFFBEB, (18.0, 28.0, 22.0), (0.0, 0.0, -4.0))
    add_light("SkyFillLight", "SUN", 1.4, 0x93C5FD, (-20.0, 20.0, 16.0), (0.0, 0.0, -4.0))
    add_light("WarmRimLight", "SUN", 1.8, 0xFDBA74, (0.0, 22.0, -32.0), (0.0, 2.0, 2.0))

    scene.render.use_freestyle = False

    if render_path:
        os.makedirs(os.path.dirname(os.path.abspath(render_path)), exist_ok=True)
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 1000
        scene.render.filepath = render_path
        bpy.ops.render.render(write_still=True)
        print(f"[Blender] Rendered world diorama preview: {render_path}")


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    blend_dir = os.path.join(repo_root, "blender")
    models_dir = os.path.join(repo_root, "public", "models")
    os.makedirs(blend_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    render_path = r"C:\Users\User\.gemini\antigravity-cli\brain\28c9539a-1323-4489-8927-620e19a4a583\scratch\world_render.png"
    if "--" in sys.argv:
        extra = sys.argv[sys.argv.index("--") + 1 :]
        if "--render" in extra:
            idx = extra.index("--render")
            if idx + 1 < len(extra):
                render_path = extra[idx + 1]

    clear_scene()
    build_all_world_assets()

    # Clean up imported asset cache from the scene before export
    for o in list(BLEND_ASSET_CACHE.values()):
        try:
            bpy.data.objects.remove(o, do_unlink=True)
        except Exception:
            pass
    BLEND_ASSET_CACHE.clear()

    blend_path = os.path.join(blend_dir, "world.blend")
    glb_path = os.path.join(models_dir, "world.glb")

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_yup=True,
        export_extras=True,
        export_apply=False,
    )
    print(f"[Blender] Exported world glTF binary: {glb_path}")

    setup_preview_studio_and_render(render_path)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[Blender] Saved editable world source file: {blend_path}")


if __name__ == "__main__":
    main()
