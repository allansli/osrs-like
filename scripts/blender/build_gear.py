"""
Headless Blender 5.2 generator for the Gielinor Armory (`gear.blend` & `gear.glb`).
Sculpts all 47 OSRS / fantasy equipment silhouettes across 61 root Empty nodes:
  - 13 Weapons: Scimitar, Sword, Godsword, Dharok's Greataxe, Flanged Mace,
    Kodai Wand, Elemental Battlestaff, Zaros Ancient Staff, Ahrim's Staff,
    Recurve Bow, Twisted/Crystal Ancient Bow, Crossbow, Abyssal Whip
  - 4 Shields: Dragon/Avernic Defender, Kiteshield, Elysian Spirit Shield, Hylian Shield
  - 9 Headgear: Full Helm, Neitiznot Faceguard, Horned Helm, Armadyl Helm,
    Wizard Hat, Robin Hood Hat, Cultist Hood, Sheikah Mask, Royal Circlet
  - 6 Body Armors: Platebody, Trimmed/Torva Plate, Bandos Chestplate,
    Dragonhide Body, Mystic Robe Top (+ Arm Cuffs), Champion's Tunic
  - 5 Leg Armors: Robe Skirt, Bandos Tassets, Dragonhide Chaps, Platelegs, Trousers
  - 4 Boot Tiers (L/R), Vambrace Gloves (L/R), 3 Capes, Amulet & Ring

Coordinate & Material Contract:
  - Three.js uses (+X right, +Y up, -Z forward).
  - `t2b(tx, ty, tz)` / `t2b_pos(tx, ty, tz)` maps Three.js `(tx, ty, tz)` -> Blender `(tx, -tz, ty)`.
  - Every gear template has a root Empty (`Gear_<name>`) positioned on the Armory Showcase Grid,
    and all child meshes have `obj.location = (0, 0, 0)` and `obj.parent = root_empty`, with their
    `bmesh` vertices built directly in the exact Three.js local mount coordinate space expected by `playerGear.ts`.
  - Semantic material slots: `gear_primary`, `gear_trim`, `gear_glow`, `gear_wood`,
    `gear_leather`, `gear_dark`, `gear_white`, `gear_crimson`.
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


# =============================================================================
# Coordinate Conversions (Three.js <-> Blender)
# =============================================================================
def t2b(tx: float, ty: float, tz: float) -> tuple[float, float, float]:
    return (tx, -tz, ty)


def t2b_pos(tx: float, ty: float, tz: float) -> tuple[float, float, float]:
    return (tx, -tz, ty)


def t2b_euler(rx: float, ry: float, rz: float) -> Euler:
    return Euler((rx, -rz, ry), "XYZ")


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
    roughness: float = 0.38,
    metallic: float = 0.25,
    emission_hex: int | None = None,
    emission_strength: float = 0.0,
):
    mat = bpy.data.materials.new(name=name)
    bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
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


def create_semantic_materials() -> dict[str, bpy.types.Material]:
    return {
        "primary": make_material("gear_primary", 0x424A52, roughness=0.45, metallic=0.70),
        "trim": make_material("gear_trim", 0x9E8046, roughness=0.38, metallic=0.65),
        "glow": make_material(
            "gear_glow",
            0x2D8BB8,
            roughness=0.18,
            metallic=0.10,
            emission_hex=0x38A0D4,
            emission_strength=1.6,
        ),
        "wood": make_material("gear_wood", 0x3E2C1C, roughness=0.68, metallic=0.02),
        "leather": make_material("gear_leather", 0x241A13, roughness=0.64, metallic=0.04),
        "dark": make_material("gear_dark", 0x1A1E24, roughness=0.50, metallic=0.55),
        "white": make_material("gear_white", 0xD8DBDF, roughness=0.42, metallic=0.20),
        "crimson": make_material(
            "gear_crimson",
            0x6C2323,
            roughness=0.58,
            metallic=0.05,
        ),
    }


# =============================================================================
# BMesh Sculpting Builder (Vertices built in Three.js Local Mount Space)
# =============================================================================
class GearBuilder:
    """
    Creates a root Empty placed on the Armory Showcase Grid in `gear.blend`
    and builds child meshes with `obj.location = (0, 0, 0)` and `obj.parent = root_empty`
    whose vertices are in exact Three.js local mount coordinates.
    """

    def __init__(
        self,
        root_name: str,
        showcase_pos: tuple[float, float, float],
        showcase_rot: tuple[float, float, float] = (0.0, 0.0, 0.0),
        group_rx: float = 0.0,
        group_ry: float = 0.0,
        group_rz: float = 0.0,
        group_scale: float = 1.0,
    ):
        self.root_name = root_name
        self.root = bpy.data.objects.new(root_name, None)
        self.root.empty_display_size = 0.14
        self.root.location = t2b_pos(*showcase_pos)
        self.root.rotation_euler = t2b_euler(*showcase_rot)
        bpy.context.collection.objects.link(self.root)
        self.group_euler = Euler((group_rx, group_ry, group_rz), "XYZ")
        self.group_scale = group_scale
        self.part_idx = 0

    def _xform(
        self,
        vx: float,
        vy: float,
        vz: float,
        tx: float = 0.0,
        ty: float = 0.0,
        tz: float = 0.0,
        rx: float = 0.0,
        ry: float = 0.0,
        rz: float = 0.0,
    ) -> tuple[float, float, float]:
        v = Vector((vx, vy, vz))
        if rx != 0.0 or ry != 0.0 or rz != 0.0:
            v.rotate(Euler((rx, ry, rz), "XYZ"))
        v.x += tx
        v.y += ty
        v.z += tz
        if self.group_scale != 1.0:
            v *= self.group_scale
        if (
            self.group_euler.x != 0.0
            or self.group_euler.y != 0.0
            or self.group_euler.z != 0.0
        ):
            v.rotate(self.group_euler)
        return t2b_pos(v.x, v.y, v.z)

    def commit_bm(
        self,
        bm: bmesh.types.BMesh,
        mat: bpy.types.Material,
        smooth: bool = True,
        no_outline: bool = False,
    ) -> bpy.types.Object:
        self.part_idx += 1
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

        uv_layer = bm.loops.layers.uv.verify()
        for face in bm.faces:
            for loop in face.loops:
                co = loop.vert.co
                u = 0.5 + math.atan2(co.x, co.y) / (2.0 * math.pi)
                v = 0.5 + co.z * 0.5
                loop[uv_layer].uv = (u, v)

        suffix = "_string" if no_outline else ""
        mesh_name = f"{self.root_name}_{self.part_idx:02d}_{mat.name}{suffix}"
        mesh = bpy.data.meshes.new(mesh_name)
        bm.to_mesh(mesh)
        bm.free()

        for poly in mesh.polygons:
            poly.use_smooth = smooth

        obj = bpy.data.objects.new(mesh_name, mesh)
        obj.location = (0.0, 0.0, 0.0)
        obj.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
        obj.scale = (1.0, 1.0, 1.0)
        if no_outline:
            obj["noOutline"] = True
        obj.data.materials.append(mat)
        bpy.context.collection.objects.link(obj)
        obj.parent = self.root
        return obj

    def add_imported_mesh_parts(
        self,
        src_obj: bpy.types.Object,
        mat_mapping: dict[int, bpy.types.Material],
        local_matrix: Matrix | None = None,
        apply_world: bool = False,
        smooth: bool = True,
        no_outline: bool = False,
    ):
        bm_src = bmesh.new()
        bm_src.from_mesh(src_obj.data)
        if apply_world:
            bm_src.transform(src_obj.matrix_world)
        if local_matrix:
            bm_src.transform(local_matrix)

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
                bx, by, bz = self._xform(v.co.x, v.co.y, v.co.z)
                v.co.x = bx
                v.co.y = by
                v.co.z = bz

            self.part_idx += 1
            suffix = "_string" if no_outline else ""
            mesh_name = f"{self.root_name}_{self.part_idx:02d}_{mat.name}{suffix}"
            mesh = bpy.data.meshes.new(mesh_name)
            bm_part.to_mesh(mesh)
            bm_part.free()

            for poly in mesh.polygons:
                poly.use_smooth = smooth

            obj = bpy.data.objects.new(mesh_name, mesh)
            obj.location = (0.0, 0.0, 0.0)
            obj.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
            obj.scale = (1.0, 1.0, 1.0)
            if no_outline:
                obj["noOutline"] = True
            obj.data.materials.append(mat)
            bpy.context.collection.objects.link(obj)
            obj.parent = self.root

        bm_src.free()

    def add_imported_mesh(
        self,
        src_obj: bpy.types.Object,
        mat: bpy.types.Material,
        local_matrix: Matrix | None = None,
        apply_world: bool = False,
        smooth: bool = True,
        no_outline: bool = False,
    ):
        bm_src = bmesh.new()
        bm_src.from_mesh(src_obj.data)
        if apply_world:
            bm_src.transform(src_obj.matrix_world)
        if local_matrix:
            bm_src.transform(local_matrix)

        bmesh.ops.recalc_face_normals(bm_src, faces=bm_src.faces)

        for v in bm_src.verts:
            bx, by, bz = self._xform(v.co.x, v.co.y, v.co.z)
            v.co.x = bx
            v.co.y = by
            v.co.z = bz

        self.part_idx += 1
        suffix = "_string" if no_outline else ""
        mesh_name = f"{self.root_name}_{self.part_idx:02d}_{mat.name}{suffix}"
        mesh = bpy.data.meshes.new(mesh_name)
        bm_src.to_mesh(mesh)
        bm_src.free()

        for poly in mesh.polygons:
            poly.use_smooth = smooth

        obj = bpy.data.objects.new(mesh_name, mesh)
        obj.location = (0.0, 0.0, 0.0)
        obj.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
        obj.scale = (1.0, 1.0, 1.0)
        if no_outline:
            obj["noOutline"] = True
        obj.data.materials.append(mat)
        bpy.context.collection.objects.link(obj)
        obj.parent = self.root
        return obj

    def add_lofted(
        self,
        sections: list[tuple],
        mat: bpy.types.Material,
        vertices: int = 20,
        tx: float = 0.0,
        ty: float = 0.0,
        tz: float = 0.0,
        rx: float = 0.0,
        ry: float = 0.0,
        rz: float = 0.0,
        cap_ends: bool = True,
        smooth: bool = True,
        no_outline: bool = False,
    ):
        bm = bmesh.new()
        ring_loops = []
        for sec in sections:
            y_pos, rad_x, rad_z = sec[0], sec[1], sec[2]
            off_x = sec[3] if len(sec) > 3 else 0.0
            off_z = sec[4] if len(sec) > 4 else 0.0
            sq = sec[5] if len(sec) > 5 else 0.0
            pec = sec[6] if len(sec) > 6 else 0.0
            keel = sec[7] if len(sec) > 7 else 0.0
            verts = []
            for i in range(vertices):
                ang = (i / vertices) * math.pi * 2.0
                ca = math.cos(ang)
                sa = math.sin(ang)
                if sq > 0.0:
                    power = max(0.32, 1.0 - sq)
                    cx = math.copysign(abs(ca) ** power, ca)
                    sz_val = math.copysign(abs(sa) ** power, sa)
                else:
                    cx, sz_val = ca, sa
                vx = off_x + cx * rad_x
                front_f = max(0.0, -sa)
                lobe = pec * front_f * (0.35 + 0.65 * abs(ca))
                v_k = keel * (front_f ** 2.0) * (1.0 - abs(ca))
                vz = off_z + sz_val * rad_z - lobe - v_k
                vy = y_pos
                verts.append(
                    bm.verts.new(self._xform(vx, vy, vz, tx, ty, tz, rx, ry, rz))
                )
            ring_loops.append(verts)

        for r_idx in range(len(ring_loops) - 1):
            la = ring_loops[r_idx]
            lb = ring_loops[r_idx + 1]
            for i in range(vertices):
                i_n = (i + 1) % vertices
                bm.faces.new((la[i], la[i_n], lb[i_n], lb[i]))

        if cap_ends and len(ring_loops) >= 2:
            b_sec = sections[0]
            t_sec = sections[-1]
            bx = b_sec[3] if len(b_sec) > 3 else 0.0
            bz = b_sec[4] if len(b_sec) > 4 else 0.0
            tx_c = t_sec[3] if len(t_sec) > 3 else 0.0
            tz_c = t_sec[4] if len(t_sec) > 4 else 0.0
            bot_c = bm.verts.new(self._xform(bx, b_sec[0], bz, tx, ty, tz, rx, ry, rz))
            top_c = bm.verts.new(self._xform(tx_c, t_sec[0], tz_c, tx, ty, tz, rx, ry, rz))
            for i in range(vertices):
                i_n = (i + 1) % vertices
                bm.faces.new((ring_loops[0][i_n], ring_loops[0][i], bot_c))
                bm.faces.new((ring_loops[-1][i], ring_loops[-1][i_n], top_c))

        return self.commit_bm(bm, mat, smooth=smooth, no_outline=no_outline)

    def add_beveled_box(
        self,
        wx: float,
        hy: float,
        dz: float,
        mat: bpy.types.Material,
        tx: float = 0.0,
        ty: float = 0.0,
        tz: float = 0.0,
        rx: float = 0.0,
        ry: float = 0.0,
        rz: float = 0.0,
        bevel: float = 0.12,
        smooth: bool = False,
        no_outline: bool = False,
    ):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        if bevel > 0.0:
            bmesh.ops.bevel(
                bm,
                geom=bm.edges[:] + bm.verts[:],
                offset=bevel,
                segments=2,
                profile=0.5,
            )
        for v in bm.verts:
            px = v.co.x * wx
            py = v.co.y * hy
            pz = v.co.z * dz
            v.co = Vector(self._xform(px, py, pz, tx, ty, tz, rx, ry, rz))
        return self.commit_bm(bm, mat, smooth=smooth, no_outline=no_outline)

    def add_torus(
        self,
        major_r: float,
        minor_r: float,
        mat: bpy.types.Material,
        maj_seg: int = 20,
        min_seg: int = 8,
        arc: float = math.pi * 2.0,
        tx: float = 0.0,
        ty: float = 0.0,
        tz: float = 0.0,
        rx: float = 0.0,
        ry: float = 0.0,
        rz: float = 0.0,
        scale_x: float = 1.0,
        scale_y: float = 1.0,
        scale_z: float = 1.0,
        smooth: bool = True,
        no_outline: bool = False,
    ):
        """Torus lying in the Three.js XZ plane (axis = +Y) unless rotated via rx, ry, rz."""
        bm = bmesh.new()
        closed = abs(arc - math.pi * 2.0) < 1e-4
        rings = []
        steps = maj_seg if closed else maj_seg + 1
        for i in range(steps):
            u = (i / maj_seg) * arc
            cu, su = math.cos(u), math.sin(u)
            ring = []
            for j in range(min_seg):
                v = (j / min_seg) * math.pi * 2.0
                cv, sv = math.cos(v), math.sin(v)
                r = major_r + minor_r * cv
                px = r * cu * scale_x
                py = minor_r * sv * scale_y
                pz = r * su * scale_z
                ring.append(
                    bm.verts.new(self._xform(px, py, pz, tx, ty, tz, rx, ry, rz))
                )
            rings.append(ring)

        ring_count = len(rings) if closed else len(rings) - 1
        for i in range(ring_count):
            ra = rings[i]
            rb = rings[(i + 1) % len(rings)]
            for j in range(min_seg):
                jn = (j + 1) % min_seg
                bm.faces.new((ra[j], ra[jn], rb[jn], rb[j]))

        if not closed and len(rings) >= 2:
            c0 = bm.verts.new(
                self._xform(major_r * scale_x, 0.0, 0.0, tx, ty, tz, rx, ry, rz)
            )
            c1 = bm.verts.new(
                self._xform(
                    major_r * math.cos(arc) * scale_x,
                    0.0,
                    major_r * math.sin(arc) * scale_z,
                    tx,
                    ty,
                    tz,
                    rx,
                    ry,
                    rz,
                )
            )
            for j in range(min_seg):
                jn = (j + 1) % min_seg
                bm.faces.new((rings[0][jn], rings[0][j], c0))
                bm.faces.new((rings[-1][j], rings[-1][jn], c1))

        return self.commit_bm(bm, mat, smooth=smooth, no_outline=no_outline)

    def add_curved_spike(
        self,
        base_r: float,
        length: float,
        bend_z: float,
        mat: bpy.types.Material,
        bend_x: float = 0.0,
        tx: float = 0.0,
        ty: float = 0.0,
        tz: float = 0.0,
        rx: float = 0.0,
        ry: float = 0.0,
        rz: float = 0.0,
        sides: int = 10,
        steps: int = 7,
        flatten_x: float = 1.0,
        smooth: bool = True,
        no_outline: bool = False,
    ):
        sections = []
        for s in range(steps):
            t = s / (steps - 1)
            r = max(0.002, base_r * ((1.0 - t) ** 1.10))
            ox = (t ** 1.7) * bend_x
            oz = (t ** 1.7) * bend_z
            sections.append((t * length, r * flatten_x, r, ox, oz, 0.12))
        return self.add_lofted(
            sections,
            mat=mat,
            vertices=sides,
            tx=tx,
            ty=ty,
            tz=tz,
            rx=rx,
            ry=ry,
            rz=rz,
            smooth=smooth,
            no_outline=no_outline,
        )

    def add_gem(
        self,
        rx_g: float,
        ry_g: float,
        rz_g: float,
        mat: bpy.types.Material,
        tx: float = 0.0,
        ty: float = 0.0,
        tz: float = 0.0,
        rx: float = 0.0,
        ry: float = 0.0,
        rz: float = 0.0,
        sides: int = 8,
        no_outline: bool = False,
    ):
        """Faceted double-pyramid / brilliant-cut crystal gem."""
        secs = [
            (-ry_g, 0.002, 0.002, 0.0, 0.0, 0.0),
            (-ry_g * 0.35, rx_g * 0.85, rz_g * 0.85, 0.0, 0.0, 0.0),
            (ry_g * 0.35, rx_g, rz_g, 0.0, 0.0, 0.0),
            (ry_g, 0.002, 0.002, 0.0, 0.0, 0.0),
        ]
        return self.add_lofted(
            secs,
            mat=mat,
            vertices=sides,
            tx=tx,
            ty=ty,
            tz=tz,
            rx=rx,
            ry=ry,
            rz=rz,
            smooth=False,
            no_outline=no_outline,
        )

    def add_arc_shell(
        self,
        sections: list[tuple],
        arc_start: float,
        arc_end: float,
        thickness: float,
        mat: bpy.types.Material,
        steps: int = 14,
        tx: float = 0.0,
        ty: float = 0.0,
        tz: float = 0.0,
        rx: float = 0.0,
        ry: float = 0.0,
        rz: float = 0.0,
        smooth: bool = True,
    ):
        """
        Builds a thickened 3D curved armor plate / cowl / pauldron / cape shell.
        Each section in `sections` is `(y_pos, rad_x, rad_z, off_x, off_z)`.
        Angle 0 is +X, -pi/2 is -Z (front), +pi/2 is +Z (back), pi is -X.
        """
        bm = bmesh.new()
        outer_rows = []
        inner_rows = []
        for sec in sections:
            y_pos, rad_x, rad_z = sec[0], sec[1], sec[2]
            off_x = sec[3] if len(sec) > 3 else 0.0
            off_z = sec[4] if len(sec) > 4 else 0.0
            o_row = []
            i_row = []
            for s in range(steps):
                t = s / (steps - 1)
                ang = arc_start + t * (arc_end - arc_start)
                ca, sa = math.cos(ang), math.sin(ang)
                ox = off_x + ca * rad_x
                oz = off_z + sa * rad_z
                ix = off_x + ca * max(0.01, rad_x - thickness)
                iz = off_z + sa * max(0.01, rad_z - thickness)
                o_row.append(
                    bm.verts.new(self._xform(ox, y_pos, oz, tx, ty, tz, rx, ry, rz))
                )
                i_row.append(
                    bm.verts.new(self._xform(ix, y_pos, iz, tx, ty, tz, rx, ry, rz))
                )
            outer_rows.append(o_row)
            inner_rows.append(i_row)

        n_rows = len(sections)
        for r in range(n_rows - 1):
            for s in range(steps - 1):
                bm.faces.new(
                    (
                        outer_rows[r][s],
                        outer_rows[r][s + 1],
                        outer_rows[r + 1][s + 1],
                        outer_rows[r + 1][s],
                    )
                )
                bm.faces.new(
                    (
                        inner_rows[r][s + 1],
                        inner_rows[r][s],
                        inner_rows[r + 1][s],
                        inner_rows[r + 1][s + 1],
                    )
                )
            bm.faces.new(
                (
                    inner_rows[r][0],
                    outer_rows[r][0],
                    outer_rows[r + 1][0],
                    inner_rows[r + 1][0],
                )
            )
            bm.faces.new(
                (
                    outer_rows[r][-1],
                    inner_rows[r][-1],
                    inner_rows[r + 1][-1],
                    outer_rows[r + 1][-1],
                )
            )

        for s in range(steps - 1):
            bm.faces.new(
                (
                    inner_rows[0][s],
                    inner_rows[0][s + 1],
                    outer_rows[0][s + 1],
                    outer_rows[0][s],
                )
            )
            bm.faces.new(
                (
                    outer_rows[-1][s],
                    outer_rows[-1][s + 1],
                    inner_rows[-1][s + 1],
                    inner_rows[-1][s],
                )
            )

        return self.commit_bm(bm, mat, smooth=smooth)

    def add_forged_blade(
        self,
        stations: list[tuple[float, float, float, float, float]],
        mat: bpy.types.Material,
        tx: float = 0.0,
        ty: float = 0.0,
        tz: float = 0.0,
        rx: float = 0.0,
        ry: float = 0.0,
        rz: float = 0.0,
        smooth: bool = False,
    ):
        """
        Builds a diamond/hexagonal cross-section blade along +Y with width in Z and thickness in X.
        Each station is `(y_pos, z_front_edge, z_back_edge, ridge_z, half_thick_x)`.
        """
        bm = bmesh.new()
        rings = []
        for y_pos, z_front, z_back, z_ridge, hx in stations[:-1]:
            v_front = bm.verts.new(self._xform(0.0, y_pos, z_front, tx, ty, tz, rx, ry, rz))
            v_right = bm.verts.new(self._xform(hx, y_pos, z_ridge, tx, ty, tz, rx, ry, rz))
            v_back = bm.verts.new(self._xform(0.0, y_pos, z_back, tx, ty, tz, rx, ry, rz))
            v_left = bm.verts.new(self._xform(-hx, y_pos, z_ridge, tx, ty, tz, rx, ry, rz))
            rings.append((v_front, v_right, v_back, v_left))

        tip_y, tip_zf, tip_zb, _, _ = stations[-1]
        v_tip = bm.verts.new(
            self._xform(0.0, tip_y, 0.5 * (tip_zf + tip_zb), tx, ty, tz, rx, ry, rz)
        )

        for r in range(len(rings) - 1):
            ra = rings[r]
            rb = rings[r + 1]
            for i in range(4):
                inext = (i + 1) % 4
                bm.faces.new((ra[i], ra[inext], rb[inext], rb[i]))

        last_r = rings[-1]
        for i in range(4):
            inext = (i + 1) % 4
            bm.faces.new((last_r[i], last_r[inext], v_tip))

        r0 = rings[0]
        bm.faces.new((r0[3], r0[2], r0[1], r0[0]))

        return self.commit_bm(bm, mat, smooth=smooth)

    def add_tube_path(
        self,
        points_r: list[tuple[float, float, float, float, float]],
        mat: bpy.types.Material,
        sides: int = 12,
        cap_ends: bool = True,
        smooth: bool = True,
        no_outline: bool = False,
    ):
        """
        Builds a 3D tube along a sequence of `(x, y, z, rx, rz)` points in Three.js space.
        """
        bm = bmesh.new()
        rings = []
        n = len(points_r)
        for idx, (px, py, pz, rad_x, rad_z) in enumerate(points_r):
            if idx == 0:
                tang = Vector(points_r[1][:3]) - Vector((px, py, pz))
            elif idx == n - 1:
                tang = Vector((px, py, pz)) - Vector(points_r[idx - 1][:3])
            else:
                tang = Vector(points_r[idx + 1][:3]) - Vector(points_r[idx - 1][:3])
            if tang.length < 1e-6:
                tang = Vector((0.0, 1.0, 0.0))
            tang.normalize()

            up_ref = Vector((1.0, 0.0, 0.0)) if abs(tang.x) < 0.85 else Vector((0.0, 1.0, 0.0))
            b1 = tang.cross(up_ref).normalized()
            b2 = tang.cross(b1).normalized()

            ring = []
            for s in range(sides):
                ang = (s / sides) * math.pi * 2.0
                ca, sa = math.cos(ang), math.sin(ang)
                pt = Vector((px, py, pz)) + b1 * (ca * rad_x) + b2 * (sa * rad_z)
                ring.append(bm.verts.new(self._xform(pt.x, pt.y, pt.z)))
            rings.append(ring)

        for r in range(n - 1):
            ra = rings[r]
            rb = rings[r + 1]
            for s in range(sides):
                sn = (s + 1) % sides
                bm.faces.new((ra[s], ra[sn], rb[sn], rb[s]))

        if cap_ends and n >= 2:
            p0 = points_r[0]
            p1 = points_r[-1]
            c0 = bm.verts.new(self._xform(p0[0], p0[1], p0[2]))
            c1 = bm.verts.new(self._xform(p1[0], p1[1], p1[2]))
            for s in range(sides):
                sn = (s + 1) % sides
                bm.faces.new((rings[0][sn], rings[0][s], c0))
                bm.faces.new((rings[-1][s], rings[-1][sn], c1))

        return self.commit_bm(bm, mat, smooth=smooth, no_outline=no_outline)


# =============================================================================
# A. WEAPONS (13 Sculpted Templates)
# =============================================================================
def build_weapons(mats: dict[str, bpy.types.Material]):
    row_y = 3.05
    row_z = 0.0
    xs = [-4.68 + i * 0.78 for i in range(13)]
    aim_melee = -math.pi / 2.45

    # 1. Gear_scimitar: Handpainted Curved Scimitar / Falchion (#22839)
    gb = GearBuilder(
        "Gear_scimitar",
        showcase_pos=(xs[0], row_y, row_z),
        showcase_rot=(-aim_melee, math.pi / 2.0, 0.0),
        group_rx=aim_melee,
    )
    src_scim = get_blend_object("blender/examples/weapons_22839/handpainted weapons 2-79.blend", "sword_b")
    if src_scim:
        m = Matrix.Translation(Vector((0.0, -0.05, 0.0))) @ Matrix.Scale(0.42, 4)
        gb.add_imported_mesh_parts(src_scim, {0: mats["primary"], 1: mats["trim"]}, local_matrix=m)
    else:
        gb.add_torus(
            0.048, 0.016, mats["trim"], arc=math.pi * 1.35, ty=-0.155, rz=math.pi * 0.82
        )
        gb.add_gem(0.022, 0.026, 0.022, mats["glow"], ty=-0.145)
        gb.add_lofted(
            [
                (-0.13, 0.022, 0.028),
                (-0.07, 0.025, 0.032),
                (0.00, 0.026, 0.033),
                (0.065, 0.023, 0.029),
            ],
            mats["leather"],
            vertices=14,
        )
        for gy in (-0.11, -0.04, 0.03):
            gb.add_torus(0.027, 0.005, mats["trim"], ty=gy, scale_z=1.18)
        gb.add_tube_path(
            [
                (0.0, 0.045, -0.19, 0.012, 0.012),
                (0.0, 0.075, -0.11, 0.020, 0.018),
                (0.0, 0.082, 0.00, 0.028, 0.026),
                (0.0, 0.088, 0.11, 0.020, 0.018),
                (0.0, 0.125, 0.19, 0.012, 0.012),
            ],
            mats["trim"],
            sides=10,
        )
        gb.add_beveled_box(0.046, 0.055, 0.085, mats["trim"], ty=0.095, tz=-0.01)
        gb.add_forged_blade(
            [
                (0.11, -0.045, 0.035, -0.010, 0.020),
                (0.28, -0.068, 0.030, -0.018, 0.021),
                (0.48, -0.105, 0.022, -0.032, 0.022),
                (0.68, -0.148, 0.018, -0.045, 0.022),
                (0.88, -0.172, 0.025, -0.052, 0.020),
                (1.04, -0.145, 0.042, -0.035, 0.016),
                (1.15, -0.082, 0.032, -0.015, 0.011),
                (1.22, -0.015, 0.010, -0.005, 0.003),
            ],
            mats["primary"],
        )
        gb.add_tube_path(
            [
                (0.0, 0.18, 0.005, 0.023, 0.009),
                (0.0, 0.48, -0.012, 0.024, 0.011),
                (0.0, 0.76, -0.026, 0.023, 0.011),
                (0.0, 0.98, -0.015, 0.018, 0.008),
            ],
            mats["dark"],
            sides=8,
        )

    # 2. Gear_sword: Handpainted Knightly Broadsword (#22839)
    gb = GearBuilder(
        "Gear_sword",
        showcase_pos=(xs[1], row_y, row_z),
        showcase_rot=(-aim_melee, math.pi / 2.0, 0.0),
        group_rx=aim_melee,
    )
    src_swd = get_blend_object("blender/examples/weapons_22839/handpainted weapons 2-79.blend", "sword_a")
    if src_swd:
        m = Matrix.Translation(Vector((0.0, -0.05, 0.0))) @ Matrix.Scale(0.42, 4)
        gb.add_imported_mesh_parts(src_swd, {0: mats["primary"], 1: mats["trim"]}, local_matrix=m)
    else:
        gb.add_lofted(
            [
                (-0.185, 0.012, 0.012),
                (-0.155, 0.038, 0.042),
                (-0.125, 0.022, 0.024),
            ],
            mats["trim"],
            vertices=8,
            smooth=False,
        )
        gb.add_gem(0.024, 0.020, 0.016, mats["glow"], ty=-0.155)
        gb.add_lofted(
            [
                (-0.125, 0.021, 0.026),
                (-0.03, 0.025, 0.031),
                (0.065, 0.022, 0.028),
            ],
            mats["leather"],
            vertices=14,
        )
        for gy in (-0.09, -0.03, 0.03):
            gb.add_torus(0.026, 0.0045, mats["trim"], ty=gy, rx=0.22, scale_z=1.18)
        gb.add_tube_path(
            [
                (0.0, 0.115, -0.17, 0.012, 0.012),
                (0.0, 0.088, -0.10, 0.022, 0.020),
                (0.0, 0.078, 0.00, 0.030, 0.028),
                (0.0, 0.088, 0.10, 0.022, 0.020),
                (0.0, 0.115, 0.17, 0.012, 0.012),
            ],
            mats["trim"],
            sides=10,
        )
        gb.add_gem(0.032, 0.034, 0.028, mats["glow"], ty=0.085)
        gb.add_forged_blade(
            [
                (0.10, -0.052, 0.052, 0.0, 0.021),
                (0.24, -0.060, 0.060, 0.0, 0.022),
                (0.32, -0.048, 0.048, 0.0, 0.020),
                (0.75, -0.052, 0.052, 0.0, 0.019),
                (1.06, -0.044, 0.044, 0.0, 0.015),
                (1.28, -0.004, 0.004, 0.0, 0.002),
            ],
            mats["primary"],
        )
        gb.add_beveled_box(0.044, 0.48, 0.018, mats["dark"], ty=0.46)
        for oy, oz in ((0.22, 0.0), (0.17, -0.016), (0.17, 0.016)):
            gb.add_gem(0.023, 0.022, 0.014, mats["glow"], ty=oy, tz=oz, sides=4)

    # 3. Gear_greatsword: Handpainted Executioner Greatsword (#22839)
    gb = GearBuilder(
        "Gear_greatsword",
        showcase_pos=(xs[2], row_y - 0.15, row_z),
        showcase_rot=(-aim_melee, math.pi / 2.0, 0.0),
        group_rx=aim_melee,
    )
    src_gs = get_blend_object("blender/examples/weapons_22839/handpainted weapons 2-79.blend", "sword_f")
    if src_gs:
        m = Matrix.Translation(Vector((0.0, -0.05, 0.0))) @ Matrix.Scale(0.62, 4)
        gb.add_imported_mesh_parts(src_gs, {0: mats["primary"], 1: mats["trim"]}, local_matrix=m)
    else:
        gb.add_lofted(
            [
                (-0.26, 0.018, 0.020),
                (-0.21, 0.048, 0.056),
                (-0.17, 0.028, 0.032),
            ],
            mats["trim"],
            vertices=10,
        )
        gb.add_gem(0.034, 0.038, 0.034, mats["glow"], ty=-0.22)
        gb.add_lofted(
            [
                (-0.17, 0.024, 0.030),
                (-0.08, 0.028, 0.035),
                (0.00, 0.027, 0.034),
                (0.08, 0.025, 0.032),
            ],
            mats["leather"],
            vertices=14,
        )
        for gy in (-0.13, -0.04, 0.05):
            gb.add_torus(0.030, 0.006, mats["trim"], ty=gy, scale_z=1.18)
        gb.add_tube_path(
            [
                (0.0, 0.20, -0.28, 0.014, 0.014),
                (0.0, 0.14, -0.20, 0.028, 0.024),
                (0.0, 0.095, -0.10, 0.038, 0.032),
                (0.0, 0.085, 0.00, 0.045, 0.040),
                (0.0, 0.095, 0.10, 0.038, 0.032),
                (0.0, 0.14, 0.20, 0.028, 0.024),
                (0.0, 0.20, 0.28, 0.014, 0.014),
            ],
            mats["trim"],
            sides=12,
        )
        for side in (-1.0, 1.0):
            gb.add_curved_spike(
                0.022,
                0.16,
                side * 0.09,
                mats["white"],
                ty=0.11,
                tz=side * 0.12,
                rx=side * 0.45,
            )
        gb.add_gem(0.044, 0.048, 0.038, mats["glow"], ty=0.10)
        gb.add_forged_blade(
            [
                (0.11, -0.082, 0.082, 0.0, 0.028),
                (0.28, -0.105, 0.105, 0.0, 0.030),
                (0.36, -0.072, 0.072, 0.0, 0.026),
                (0.52, -0.098, 0.098, 0.0, 0.027),
                (0.92, -0.088, 0.088, 0.0, 0.025),
                (1.28, -0.102, 0.102, 0.0, 0.022),
                (1.58, -0.005, 0.005, 0.0, 0.003),
            ],
            mats["primary"],
        )
        for side in (-1.0, 1.0):
            gb.add_curved_spike(
                0.024,
                0.14,
                side * 0.06,
                mats["trim"],
                ty=0.28,
                tz=side * 0.075,
                rx=side * 0.95,
                flatten_x=0.55,
            )
            gb.add_curved_spike(
                0.020,
                0.11,
                side * 0.05,
                mats["trim"],
                ty=0.48,
                tz=side * 0.070,
                rx=side * 0.85,
                flatten_x=0.55,
            )
        gb.add_beveled_box(0.056, 0.82, 0.026, mats["glow"], ty=0.66)

    # 4. Gear_greataxe: Dharok's Greataxe
    aim_axe = -math.pi / 2.6
    gb = GearBuilder(
        "Gear_greataxe",
        showcase_pos=(xs[3], row_y - 0.05, row_z),
        showcase_rot=(-aim_axe, math.pi / 2.0, 0.0),
        group_rx=aim_axe,
    )
    gb.add_lofted(
        [
            (-0.34, 0.036, 0.042),
            (-0.10, 0.030, 0.035),
            (0.45, 0.032, 0.038),
            (0.95, 0.038, 0.045),
            (1.18, 0.032, 0.036),
        ],
        mats["wood"],
        vertices=14,
    )
    gb.add_lofted(
        [(-0.08, 0.033, 0.038), (0.26, 0.034, 0.039)],
        mats["leather"],
        vertices=14,
    )
    gb.add_curved_spike(0.032, 0.11, 0.0, mats["trim"], ty=-0.34, rx=math.pi)
    gb.add_beveled_box(0.058, 0.34, 0.068, mats["dark"], ty=0.90)
    gb.add_curved_spike(0.036, 0.22, 0.0, mats["primary"], ty=1.16)
    gb.add_forged_blade(
        [
            (0.60, -0.26, -0.08, -0.18, 0.022),
            (0.74, -0.33, -0.05, -0.21, 0.028),
            (0.92, -0.35, -0.03, -0.20, 0.032),
            (1.08, -0.30, -0.05, -0.18, 0.026),
            (1.18, -0.18, -0.06, -0.12, 0.014),
        ],
        mats["primary"],
    )
    gb.add_tube_path(
        [
            (0.0, 0.60, -0.25, 0.010, 0.014),
            (0.0, 0.76, -0.33, 0.012, 0.018),
            (0.0, 0.92, -0.35, 0.013, 0.018),
            (0.0, 1.08, -0.30, 0.012, 0.016),
            (0.0, 1.18, -0.18, 0.009, 0.012),
        ],
        mats["glow"],
        sides=8,
    )
    gb.add_forged_blade(
        [
            (0.72, 0.05, 0.20, 0.13, 0.020),
            (0.84, 0.03, 0.25, 0.16, 0.025),
            (0.96, 0.03, 0.26, 0.16, 0.025),
            (1.08, 0.05, 0.19, 0.12, 0.016),
        ],
        mats["primary"],
    )
    gb.add_torus(0.048, 0.012, mats["trim"], ty=0.72)
    gb.add_torus(0.048, 0.012, mats["trim"], ty=1.10)

    # 5. Gear_mace: Flanged War-Mace / Morningstar
    gb = GearBuilder(
        "Gear_mace",
        showcase_pos=(xs[4], row_y + 0.15, row_z),
        showcase_rot=(-aim_melee, 0.45, 0.0),
        group_rx=aim_melee,
    )
    gb.add_lofted(
        [
            (-0.20, 0.032, 0.032),
            (-0.14, 0.025, 0.025),
            (0.18, 0.028, 0.028),
            (0.56, 0.034, 0.034),
        ],
        mats["wood"],
        vertices=14,
    )
    gb.add_lofted(
        [(-0.12, 0.028, 0.028), (0.08, 0.029, 0.029)],
        mats["leather"],
        vertices=14,
    )
    gb.add_torus(0.036, 0.009, mats["trim"], ty=-0.16)
    gb.add_torus(0.044, 0.012, mats["trim"], ty=0.56)
    gb.add_lofted(
        [
            (0.56, 0.055, 0.055),
            (0.63, 0.108, 0.108),
            (0.68, 0.118, 0.118),
            (0.73, 0.108, 0.108),
            (0.80, 0.052, 0.052),
        ],
        mats["primary"],
        vertices=16,
    )
    gb.add_torus(0.116, 0.012, mats["glow"], ty=0.68)
    for i in range(8):
        ang = (i / 8) * math.pi * 2.0
        gb.add_beveled_box(
            0.018,
            0.20,
            0.095,
            mats["primary"],
            tx=math.sin(ang) * 0.09,
            ty=0.68,
            tz=math.cos(ang) * 0.09,
            ry=ang,
        )
        gb.add_curved_spike(
            0.026,
            0.11,
            0.0,
            mats["trim"],
            tx=math.sin(ang) * 0.105,
            ty=0.68,
            tz=math.cos(ang) * 0.105,
            rx=math.pi / 2.0,
            ry=ang,
            sides=6,
            smooth=False,
        )
    gb.add_curved_spike(0.034, 0.14, 0.0, mats["trim"], ty=0.79, sides=6, smooth=False)

    # 6. Gear_wand: Kodai / Master Wand
    aim_wand = -math.pi / 2.7
    gb = GearBuilder(
        "Gear_wand",
        showcase_pos=(xs[5], row_y + 0.30, row_z),
        showcase_rot=(-aim_wand, 0.45, 0.0),
        group_rx=aim_wand,
    )
    gb.add_lofted(
        [
            (-0.14, 0.030, 0.030),
            (-0.08, 0.024, 0.024),
            (0.16, 0.022, 0.022),
            (0.40, 0.016, 0.016),
        ],
        mats["wood"],
        vertices=12,
    )
    gb.add_gem(0.024, 0.030, 0.024, mats["glow"], ty=-0.15)
    for ry_pos, r_maj in ((0.02, 0.028), (0.18, 0.026), (0.34, 0.032)):
        gb.add_torus(r_maj, 0.007, mats["trim"], ty=ry_pos)
    for i in range(4):
        ang = (i / 4) * math.pi * 2.0
        gb.add_curved_spike(
            0.014,
            0.13,
            -0.025,
            mats["trim"],
            tx=math.sin(ang) * 0.022,
            ty=0.36,
            tz=math.cos(ang) * 0.022,
            ry=ang,
        )
    gb.add_gem(0.068, 0.085, 0.068, mats["glow"], ty=0.49, sides=8)
    gb.add_torus(0.072, 0.008, mats["trim"], ty=0.49, rx=0.65, rz=0.35)

    # 7. Gear_staff: Elemental Mystic Battlestaff
    aim_staff = -math.pi / 2.8
    gb = GearBuilder(
        "Gear_staff",
        showcase_pos=(xs[6], row_y - 0.05, row_z),
        showcase_rot=(-aim_staff, 0.45, 0.0),
        group_rx=aim_staff,
    )
    gb.add_lofted(
        [
            (-0.42, 0.034, 0.034),
            (-0.10, 0.030, 0.030),
            (0.45, 0.034, 0.034),
            (0.95, 0.040, 0.040),
            (1.12, 0.048, 0.048),
        ],
        mats["wood"],
        vertices=14,
    )
    gb.add_lofted(
        [(0.02, 0.034, 0.034), (0.34, 0.036, 0.036)],
        mats["leather"],
        vertices=14,
    )
    for gy in (-0.38, 0.00, 0.36, 0.76, 1.08):
        gb.add_torus(0.042, 0.008, mats["trim"], ty=gy)
    for i in range(4):
        ang = (i / 4) * math.pi * 2.0 + math.pi * 0.25
        gb.add_curved_spike(
            0.024,
            0.26,
            -0.05,
            mats["trim"],
            tx=math.sin(ang) * 0.045,
            ty=1.08,
            tz=math.cos(ang) * 0.045,
            ry=ang,
        )
    gb.add_lofted(
        [
            (1.10, 0.02, 0.02),
            (1.15, 0.11, 0.11),
            (1.23, 0.145, 0.145),
            (1.31, 0.11, 0.11),
            (1.36, 0.02, 0.02),
        ],
        mats["glow"],
        vertices=18,
    )
    gb.add_torus(0.215, 0.016, mats["trim"], ty=1.23, rx=math.pi / 2.4, rz=0.25)

    # 8. Gear_ancient-staff: Zaros Ancient Staff
    gb = GearBuilder(
        "Gear_ancient-staff",
        showcase_pos=(xs[7], row_y - 0.05, row_z),
        showcase_rot=(-aim_staff, 0.0, 0.0),
        group_rx=aim_staff,
    )
    gb.add_lofted(
        [
            (-0.42, 0.032, 0.032),
            (0.20, 0.030, 0.030),
            (0.85, 0.036, 0.036),
            (1.06, 0.044, 0.044),
        ],
        mats["dark"],
        vertices=14,
    )
    for gy in (-0.36, 0.05, 0.45, 0.85, 1.04):
        gb.add_torus(0.040, 0.008, mats["trim"], ty=gy)
    gb.add_torus(
        0.185,
        0.020,
        mats["trim"],
        arc=math.pi * 1.45,
        ty=1.22,
        rx=math.pi / 2.0,
        rz=-math.pi * 0.22,
    )
    gb.add_beveled_box(0.32, 0.028, 0.028, mats["trim"], ty=1.10)
    gb.add_beveled_box(0.24, 0.024, 0.024, mats["trim"], ty=1.34)
    gb.add_gem(0.11, 0.15, 0.06, mats["glow"], ty=1.22, sides=4)
    for side in (-1.0, 1.0):
        gb.add_curved_spike(
            0.022, 0.14, 0.0, mats["trim"], tx=side * 0.16, ty=1.24, rz=-side * 0.25
        )

    # 9. Gear_ahrim-staff: Ahrim's Barrows Staff
    gb = GearBuilder(
        "Gear_ahrim-staff",
        showcase_pos=(xs[8], row_y - 0.05, row_z),
        showcase_rot=(-aim_staff, 0.0, 0.0),
        group_rx=aim_staff,
    )
    gb.add_tube_path(
        [
            (0.0, -0.42, 0.0, 0.034, 0.034),
            (0.015, -0.05, -0.01, 0.030, 0.030),
            (-0.015, 0.38, 0.012, 0.032, 0.032),
            (0.012, 0.78, -0.015, 0.036, 0.036),
            (0.0, 1.08, 0.0, 0.044, 0.044),
        ],
        mats["wood"],
        sides=12,
    )
    for gy in (-0.25, 0.22, 0.68, 1.04):
        gb.add_torus(0.042, 0.009, mats["dark"], ty=gy)
    gb.add_lofted(
        [
            (1.06, 0.065, 0.075, 0.0, -0.02, 0.25),
            (1.15, 0.115, 0.125, 0.0, -0.03, 0.25),
            (1.24, 0.105, 0.115, 0.0, -0.01, 0.20),
            (1.30, 0.060, 0.065, 0.0, 0.01, 0.15),
        ],
        mats["primary"],
        vertices=14,
    )
    for side in (-1.0, 1.0):
        gb.add_gem(
            0.028, 0.024, 0.024, mats["glow"], tx=side * 0.052, ty=1.20, tz=-0.115
        )
        gb.add_curved_spike(
            0.038,
            0.24,
            -0.10,
            mats["trim"],
            bend_x=side * 0.12,
            tx=side * 0.085,
            ty=1.22,
            tz=-0.01,
            rz=-side * 0.95,
        )
    gb.add_curved_spike(0.038, 0.16, 0.0, mats["trim"], ty=1.28)

    # 10. Gear_bow: Sculpted Recurve Bow
    gb = GearBuilder(
        "Gear_bow",
        showcase_pos=(xs[9], row_y + 0.35, row_z),
        showcase_rot=(0.0, 1.25, 0.0),
    )
    gb.add_tube_path(
        [
            (0.0, -0.64, 0.17, 0.014, 0.016),
            (0.0, -0.52, 0.04, 0.024, 0.030),
            (0.0, -0.32, -0.16, 0.030, 0.038),
            (0.0, -0.12, -0.23, 0.034, 0.042),
            (0.0, 0.00, -0.24, 0.036, 0.044),
            (0.0, 0.12, -0.23, 0.034, 0.042),
            (0.0, 0.32, -0.16, 0.030, 0.038),
            (0.0, 0.52, 0.04, 0.024, 0.030),
            (0.0, 0.64, 0.17, 0.014, 0.016),
        ],
        mats["primary"],
        sides=12,
    )
    gb.add_lofted(
        [
            (-0.11, 0.038, 0.046, 0.0, -0.235),
            (0.00, 0.042, 0.048, 0.0, -0.240),
            (0.11, 0.038, 0.046, 0.0, -0.235),
        ],
        mats["leather"],
        vertices=14,
    )
    for gy, gz in ((-0.12, -0.23), (0.12, -0.23), (-0.62, 0.16), (0.62, 0.16)):
        gb.add_torus(0.038, 0.009, mats["trim"], ty=gy, tz=gz)
    gb.add_lofted(
        [(-0.62, 0.006, 0.006, 0.0, 0.16), (0.62, 0.006, 0.006, 0.0, 0.16)],
        mats["white"],
        vertices=8,
        no_outline=True,
    )

    # 11. Gear_ancient-bow: Twisted Bow / Crystal Bow
    gb = GearBuilder(
        "Gear_ancient-bow",
        showcase_pos=(xs[10], row_y + 0.35, row_z),
        showcase_rot=(0.0, 1.25, 0.0),
    )
    gb.add_tube_path(
        [
            (0.0, -0.66, 0.17, 0.012, 0.016),
            (0.025, -0.48, 0.02, 0.026, 0.034),
            (-0.022, -0.28, -0.17, 0.032, 0.042),
            (0.0, 0.00, -0.24, 0.038, 0.048),
            (0.022, 0.28, -0.17, 0.032, 0.042),
            (-0.025, 0.48, 0.02, 0.026, 0.034),
            (0.0, 0.66, 0.17, 0.012, 0.016),
        ],
        mats["primary"],
        sides=12,
    )
    for sy in (-1.0, 1.0):
        gb.add_curved_spike(
            0.024,
            0.16,
            -0.06,
            mats["glow"],
            ty=sy * 0.24,
            tz=-0.20,
            rx=-sy * 0.85,
        )
        gb.add_curved_spike(
            0.022,
            0.15,
            0.05,
            mats["trim"],
            ty=sy * 0.58,
            tz=0.10,
            rx=sy * 0.45,
        )
    gb.add_gem(0.042, 0.065, 0.048, mats["glow"], ty=0.0, tz=-0.25)
    gb.add_lofted(
        [(-0.63, 0.007, 0.007, 0.0, 0.16), (0.63, 0.007, 0.007, 0.0, 0.16)],
        mats["glow"],
        vertices=8,
        no_outline=True,
    )

    # 12. Gear_crossbow: Armadyl / Dragon Crossbow
    aim_cbow = -0.45
    gb = GearBuilder(
        "Gear_crossbow",
        showcase_pos=(xs[11], row_y + 0.35, row_z),
        showcase_rot=(-aim_cbow + 1.15, 0.25, 0.0),
        group_rx=aim_cbow,
    )
    gb.add_beveled_box(0.072, 0.065, 0.68, mats["primary"], ty=0.0, tz=0.04)
    gb.add_beveled_box(0.052, 0.14, 0.075, mats["leather"], ty=-0.08, tz=0.14, rx=0.28)
    gb.add_beveled_box(0.078, 0.025, 0.42, mats["dark"], ty=0.038, tz=-0.04)
    gb.add_tube_path(
        [
            (-0.28, 0.0, -0.08, 0.012, 0.016),
            (-0.20, 0.0, -0.20, 0.024, 0.028),
            (0.00, 0.0, -0.26, 0.032, 0.036),
            (0.20, 0.0, -0.20, 0.024, 0.028),
            (0.28, 0.0, -0.08, 0.012, 0.016),
        ],
        mats["trim"],
        sides=10,
    )
    gb.add_torus(
        0.058,
        0.009,
        mats["dark"],
        arc=math.pi * 1.2,
        ty=0.0,
        tz=-0.33,
        ry=-math.pi * 0.6,
    )
    gb.add_tube_path(
        [
            (-0.26, 0.01, -0.09, 0.005, 0.005),
            (0.00, 0.02, 0.12, 0.006, 0.006),
            (0.26, 0.01, -0.09, 0.005, 0.005),
        ],
        mats["white"],
        sides=6,
        no_outline=True,
    )
    gb.add_lofted(
        [(0.0, 0.012, 0.012), (0.34, 0.012, 0.012)],
        mats["glow"],
        vertices=8,
        ty=0.032,
        tz=0.10,
        rx=-math.pi / 2.0,
    )
    gb.add_curved_spike(
        0.024, 0.085, 0.0, mats["glow"], ty=0.032, tz=-0.24, rx=-math.pi / 2.0, sides=6
    )

    # 13. Gear_whip: Abyssal Whip
    gb = GearBuilder(
        "Gear_whip",
        showcase_pos=(xs[12], row_y + 0.05, row_z),
        showcase_rot=(math.pi / 2.15, 0.0, 0.0),
    )
    gb.add_lofted(
        [
            (-0.14, 0.032, 0.032, 0.0, 0.08),
            (0.02, 0.028, 0.028, 0.0, 0.02),
        ],
        mats["leather"],
        vertices=12,
    )
    gb.add_torus(0.036, 0.009, mats["trim"], ty=-0.12, tz=0.07)
    gb.add_torus(0.038, 0.010, mats["trim"], ty=0.02, tz=0.02)
    whip_pts = [
        (0.00, 0.02, 0.02, 0.034, 0.034),
        (0.04, 0.14, -0.08, 0.032, 0.032),
        (0.07, 0.26, -0.20, 0.030, 0.030),
        (-0.01, 0.38, -0.33, 0.028, 0.028),
        (-0.09, 0.46, -0.46, 0.026, 0.026),
        (0.01, 0.41, -0.61, 0.024, 0.024),
        (0.10, 0.34, -0.76, 0.022, 0.022),
        (0.04, 0.24, -0.91, 0.019, 0.019),
        (-0.02, 0.14, -1.05, 0.012, 0.012),
    ]
    gb.add_tube_path(whip_pts, mats["dark"], sides=10)
    for idx, (wx, wy, wz, wr, _) in enumerate(whip_pts[1:]):
        node_mat = mats["glow"] if idx % 2 == 0 else mats["crimson"]
        gb.add_gem(wr * 1.65, wr * 1.65, wr * 1.65, node_mat, tx=wx, ty=wy, tz=wz)

    # 14. Gear_blowpipe: Zulrah Toxic Blowpipe
    gb = GearBuilder(
        "Gear_blowpipe",
        showcase_pos=(-4.68 + 13 * 0.78, row_y, row_z),
        showcase_rot=(-aim_melee, math.pi / 2.0, 0.0),
        group_rx=aim_melee,
    )
    gb.add_lofted(
        [
            (-0.25, 0.038, 0.038),
            (0.15, 0.032, 0.032),
            (0.48, 0.026, 0.026),
        ],
        mats["primary"],
        vertices=12,
    )
    gb.add_torus(0.042, 0.012, mats["dark"], ty=-0.24)
    gb.add_gem(0.050, 0.050, 0.050, mats["glow"], ty=0.42)
    for side in (-0.032, 0.032):
        gb.add_curved_spike(0.016, 0.09, 0.0, mats["trim"], tx=side, ty=0.46, tz=0.01, rz=0.2 if side < 0 else -0.2)

    # 15. Gear_twisted-bow: Twisted Elder Bow
    gb = GearBuilder(
        "Gear_twisted-bow",
        showcase_pos=(-4.68 + 14 * 0.78, row_y, row_z),
        showcase_rot=(-aim_melee, math.pi / 2.0, 0.0),
        group_rx=aim_melee,
    )
    bow_pts = [
        (0.00, -0.74, 0.20, 0.042, 0.042),
        (0.00, -0.42, -0.18, 0.040, 0.040),
        (0.00, 0.00, -0.26, 0.044, 0.044),
        (0.00, 0.42, -0.18, 0.040, 0.040),
        (0.00, 0.74, 0.20, 0.042, 0.042),
    ]
    gb.add_tube_path(bow_pts, mats["wood"], sides=10)
    for dir in (-1.0, 1.0):
        gb.add_curved_spike(0.036, 0.18, 0.06 * dir, mats["trim"], ty=dir * 0.78, tz=0.22, rx=dir * 0.3)
    gb.add_beveled_box(0.008, 1.48, 0.008, mats["glow"], ty=0.0, tz=0.20)
    gb.add_beveled_box(0.055, 0.18, 0.055, mats["leather"], ty=0.0, tz=-0.24)

    # 16. Gear_shadow-staff: Tumeken's Solar Shadow
    gb = GearBuilder(
        "Gear_shadow-staff",
        showcase_pos=(-4.68 + 15 * 0.78, row_y, row_z),
        showcase_rot=(-aim_melee, math.pi / 2.0, 0.0),
        group_rx=aim_melee,
    )
    gb.add_lofted(
        [
            (-0.35, 0.040, 0.040),
            (0.50, 0.036, 0.036),
            (1.10, 0.034, 0.034),
        ],
        mats["wood"],
        vertices=10,
    )
    gb.add_torus(0.22, 0.024, mats["trim"], ty=1.28)
    gb.add_gem(0.12, 0.12, 0.12, mats["glow"], ty=1.28, sides=12)
    for i in range(6):
        ang = (i / 6.0) * math.pi * 2.0
        gb.add_curved_spike(
            0.024, 0.14, 0.0, mats["trim"], ty=1.28 + math.sin(ang) * 0.26, tz=math.cos(ang) * 0.26, rx=-ang
        )


# =============================================================================
# B. SHIELDS (4 Sculpted Templates)
# =============================================================================
def add_sculpted_kite_base(gb: GearBuilder, mats: dict[str, bpy.types.Material]):
    """
    Builds a curved faceted kiteshield oriented in Three.js shield space:
    height along Y (-0.45..+0.38), width along Z (-0.34..+0.34), front face at +X.
    """
    secs = [
        (-0.45, 0.026, 0.022, 0.030, 0.0, 0.15),
        (-0.28, 0.032, 0.175, 0.025, 0.0, 0.22),
        (-0.06, 0.036, 0.295, 0.022, 0.0, 0.28),
        (0.16, 0.036, 0.340, 0.022, 0.0, 0.32),
        (0.32, 0.032, 0.310, 0.026, 0.0, 0.30),
        (0.40, 0.026, 0.160, 0.030, 0.0, 0.20),
    ]
    gb.add_lofted(secs, mats["primary"], vertices=20, smooth=False)
    rim_path = [
        (0.038, -0.45, 0.00, 0.024, 0.024),
        (0.032, -0.24, -0.20, 0.024, 0.024),
        (0.030, 0.05, -0.33, 0.025, 0.025),
        (0.032, 0.31, -0.30, 0.025, 0.025),
        (0.038, 0.40, 0.00, 0.025, 0.025),
        (0.032, 0.31, 0.30, 0.025, 0.025),
        (0.030, 0.05, 0.33, 0.025, 0.025),
        (0.032, -0.24, 0.20, 0.024, 0.024),
        (0.038, -0.45, 0.00, 0.024, 0.024),
    ]
    gb.add_tube_path(rim_path, mats["trim"], sides=8, cap_ends=False)
    # Recessed back leather arm straps strictly on -X face
    gb.add_beveled_box(0.012, 0.14, 0.04, mats["leather"], tx=-0.018, ty=0.05, tz=-0.10)
    gb.add_beveled_box(0.012, 0.14, 0.04, mats["leather"], tx=-0.018, ty=0.05, tz=0.10)


def build_shields(mats: dict[str, bpy.types.Material]):
    row_y = 2.00
    row_z = -0.15

    # 14. Gear_defender: Dragon / Avernic Defender
    gb = GearBuilder(
        "Gear_defender",
        showcase_pos=(-4.65, row_y, row_z),
        showcase_rot=(0.9, 0.25, 0.0),
        group_rx=-0.9,
        group_scale=0.85,
    )
    gb.add_curved_spike(0.032, 0.09, 0.0, mats["trim"], ty=-0.18, rx=math.pi)
    gb.add_lofted(
        [(-0.18, 0.026, 0.030), (-0.02, 0.030, 0.034)],
        mats["leather"],
        vertices=12,
    )
    gb.add_beveled_box(0.24, 0.038, 0.055, mats["trim"], ty=0.01)
    for side in (-1.0, 1.0):
        gb.add_curved_spike(
            0.026,
            0.16,
            0.0,
            mats["trim"],
            bend_x=side * 0.03,
            tx=side * 0.09,
            ty=0.02,
            rz=-side * 0.32,
        )
    gb.add_forged_blade(
        [
            (0.03, -0.045, 0.045, 0.0, 0.022),
            (0.22, -0.052, 0.052, 0.0, 0.024),
            (0.38, -0.038, 0.038, 0.0, 0.018),
            (0.52, -0.004, 0.004, 0.0, 0.003),
        ],
        mats["primary"],
    )
    gb.add_gem(0.026, 0.032, 0.026, mats["glow"], ty=0.015)

    # 15. Gear_kiteshield: Handpainted Knightly Kiteshield (#22839)
    gb = GearBuilder(
        "Gear_kiteshield",
        showcase_pos=(-3.85, row_y, row_z),
        showcase_rot=(0.0, math.pi / 2.0, 0.0),
    )
    src_sh = get_blend_object("blender/examples/weapons_22839/handpainted weapons 2-79.blend", "shield_b")
    if src_sh:
        m = Matrix.Translation(Vector((0.04, 0.02, 0.0))) @ Matrix.Rotation(math.pi / 2.0, 4, 'Y') @ Matrix.Scale(0.65, 4)
        gb.add_imported_mesh(src_sh, mats["primary"], local_matrix=m)
        gb.add_beveled_box(0.035, 0.52, 0.055, mats["trim"], tx=0.060, ty=-0.01, tz=0.0)
        gb.add_beveled_box(0.035, 0.055, 0.38, mats["trim"], tx=0.060, ty=0.06, tz=0.0)
    else:
        add_sculpted_kite_base(gb, mats)
        gb.add_beveled_box(0.035, 0.56, 0.065, mats["trim"], tx=0.060, ty=-0.01, tz=0.0)
        gb.add_beveled_box(0.035, 0.065, 0.44, mats["trim"], tx=0.060, ty=0.06, tz=0.0)
        gb.add_lofted(
            [
                (0.06 - 0.09, 0.02, 0.02, 0.065, 0.0),
                (0.06, 0.065, 0.095, 0.065, 0.0),
                (0.06 + 0.09, 0.02, 0.02, 0.065, 0.0),
            ],
            mats["trim"],
            vertices=14,
        )

    # 16. Gear_elysian: Elysian Spirit Shield
    gb = GearBuilder(
        "Gear_elysian",
        showcase_pos=(-3.00, row_y, row_z),
        showcase_rot=(0.0, math.pi / 2.0, 0.0),
    )
    add_sculpted_kite_base(gb, mats)
    gb.add_torus(
        0.135, 0.022, mats["glow"], tx=0.062, ty=0.04, tz=0.0, rz=math.pi / 2.0
    )
    gb.add_gem(0.045, 0.16, 0.055, mats["glow"], tx=0.068, ty=0.04, tz=0.0)
    for side in (-1.0, 1.0):
        gb.add_curved_spike(
            0.028,
            0.24,
            side * 0.12,
            mats["glow"],
            tx=0.065,
            ty=-0.02,
            tz=side * 0.06,
            rx=side * 0.55,
        )

    # 17. Gear_hylian-shield: Hylian Shield
    gb = GearBuilder(
        "Gear_hylian-shield",
        showcase_pos=(-2.15, row_y, row_z),
        showcase_rot=(0.0, math.pi / 2.0, 0.0),
    )
    add_sculpted_kite_base(gb, mats)
    gb.add_beveled_box(0.032, 0.16, 0.095, mats["crimson"], tx=0.062, ty=-0.08, tz=0.0)
    for side in (-1.0, 1.0):
        gb.add_beveled_box(
            0.032,
            0.075,
            0.20,
            mats["crimson"],
            tx=0.062,
            ty=-0.05,
            tz=side * 0.14,
            rx=side * 0.28,
        )
    for ty_tri, tz_tri in ((0.22, 0.0), (0.13, -0.065), (0.13, 0.065)):
        gb.add_gem(
            0.035,
            0.058,
            0.058,
            mats["trim"],
            tx=0.068,
            ty=ty_tri,
            tz=tz_tri,
            sides=4,
        )

    # 18. Gear_book: Arcane Grimoire / Tome of Spells
    gb = GearBuilder(
        "Gear_book",
        showcase_pos=(-1.30, row_y, row_z),
        showcase_rot=(0.0, math.pi / 2.0, 0.0),
    )
    gb.add_beveled_box(0.060, 0.34, 0.26, mats["primary"], tx=0.050, ty=0.02, tz=0.0)
    gb.add_beveled_box(0.046, 0.31, 0.23, mats["white"], tx=0.052, ty=0.02, tz=0.0)
    for cy, cz in ((-0.14, -0.10), (-0.14, 0.10), (0.14, -0.10), (0.14, 0.10)):
        gb.add_beveled_box(0.068, 0.045, 0.045, mats["trim"], tx=0.050, ty=0.02 + cy, tz=cz)
    gb.add_beveled_box(0.066, 0.35, 0.035, mats["trim"], tx=0.050, ty=0.02, tz=-0.12)
    gb.add_torus(0.065, 0.012, mats["trim"], tx=0.082, ty=0.02, tz=0.0, ry=math.pi / 2.0)
    gb.add_gem(0.048, 0.048, 0.048, mats["glow"], tx=0.086, ty=0.02, tz=0.0, sides=6)

    # 19. Gear_arcane-shield: Arcane Spirit Shield
    gb = GearBuilder(
        "Gear_arcane-shield",
        showcase_pos=(-0.45, row_y, row_z),
        showcase_rot=(0.0, math.pi / 2.0, 0.0),
    )
    add_sculpted_kite_base(gb, mats)
    gb.add_torus(0.145, 0.022, mats["glow"], tx=0.062, ty=0.04, tz=0.0, ry=math.pi / 2.0)
    gb.add_gem(0.055, 0.16, 0.065, mats["glow"], tx=0.068, ty=0.04, tz=0.0)
    for side in (-1.0, 1.0):
        gb.add_curved_spike(
            0.028, 0.22, side * 0.10, mats["glow"], tx=0.065, ty=-0.02, tz=side * 0.06, rx=side * 0.55
        )

    # 20. Gear_ward: Elidinis' Sun Ward / Odium Amber Ward
    gb = GearBuilder(
        "Gear_ward",
        showcase_pos=(0.40, row_y, row_z),
        showcase_rot=(0.0, math.pi / 2.0, 0.0),
    )
    gb.add_lofted(
        [
            (-0.02, 0.22, 0.22, 0.04, 0.0, 0.0),
            (0.02, 0.18, 0.18, 0.06, 0.0, 0.0),
        ],
        mats["primary"],
        vertices=8,
    )
    gb.add_torus(0.12, 0.018, mats["trim"], tx=0.065, ty=0.02, tz=0.0, ry=math.pi / 2.0)
    gb.add_gem(0.065, 0.065, 0.065, mats["glow"], tx=0.075, ty=0.02, tz=0.0, sides=8)
    for side in (-1.0, 1.0):
        gb.add_curved_spike(
            0.035, 0.20, side * 0.08, mats["trim"], tx=0.062, ty=-0.08, tz=side * 0.12, rx=side * 0.6
        )

    # 21. Gear_twisted-buckler: Twisted Dragonfang Buckler
    gb = GearBuilder(
        "Gear_twisted-buckler",
        showcase_pos=(1.25, row_y, row_z),
        showcase_rot=(0.0, math.pi / 2.0, 0.0),
    )
    gb.add_lofted(
        [
            (-0.03, 0.24, 0.24, 0.03, 0.0, 0.0),
            (0.04, 0.20, 0.20, 0.06, 0.0, 0.0),
        ],
        mats["wood"],
        vertices=16,
    )
    gb.add_torus(0.21, 0.018, mats["trim"], tx=0.055, ty=0.02, tz=0.0, ry=math.pi / 2.0)
    gb.add_gem(0.065, 0.065, 0.065, mats["glow"], tx=0.09, ty=0.02, tz=0.0, sides=6)
    for i in range(4):
        ang = (i / 4.0) * math.pi * 2.0
        gb.add_curved_spike(
            0.028, 0.15, 0.05, mats["white"], tx=0.07, ty=0.02 + math.sin(ang) * 0.18, tz=math.cos(ang) * 0.18, rx=-ang, rz=-0.4
        )


# =============================================================================
# C. HEADGEAR (9 Sculpted Templates, headRadius = 0.195, -Z forward)
# =============================================================================
def add_helm_dome_base(
    gb: GearBuilder,
    mats: dict[str, bpy.types.Material],
    with_cheek_guards: bool = True,
):
    gb.add_lofted(
        [
            (-0.04, 0.212, 0.220, 0.0, 0.005, 0.12),
            (0.04, 0.222, 0.228, 0.0, 0.002, 0.14),
            (0.12, 0.205, 0.214, 0.0, 0.004, 0.12),
            (0.19, 0.155, 0.165, 0.0, 0.006, 0.08),
            (0.23, 0.065, 0.075, 0.0, 0.008, 0.0),
        ],
        mats["primary"],
        vertices=20,
    )
    gb.add_torus(0.216, 0.016, mats["trim"], ty=-0.015, scale_z=1.04)
    if with_cheek_guards:
        gb.add_arc_shell(
            [
                (-0.14, 0.200, 0.210, 0.0, 0.0),
                (-0.02, 0.216, 0.222, 0.0, 0.0),
            ],
            arc_start=-math.pi * 0.28,
            arc_end=math.pi * 1.28,
            thickness=0.024,
            mat=mats["primary"],
            steps=14,
        )


def build_headgear(mats: dict[str, bpy.types.Material]):
    row_y = 1.98
    row_z = -0.15
    xs = [0.75 + i * 0.49 for i in range(9)]

    # 18. Gear_helm: Knightly Greathelm
    gb = GearBuilder("Gear_helm", showcase_pos=(xs[0], row_y, row_z))
    # Full cylindrical barrel dome with rounded crown
    gb.add_lofted(
        [
            (-0.16, 0.208, 0.218, 0.0, 0.0, 0.16),
            (-0.04, 0.216, 0.224, 0.0, -0.002, 0.18),
            (0.08, 0.218, 0.226, 0.0, -0.002, 0.18),
            (0.18, 0.175, 0.185, 0.0, 0.002, 0.12),
            (0.24, 0.075, 0.085, 0.0, 0.004, 0.06),
        ],
        mats["primary"],
        vertices=18,
    )
    # Heavy brow trim rim
    gb.add_torus(0.220, 0.016, mats["trim"], ty=0.03, scale_z=1.04)
    # Cross-ocular visor horizontal eye slit
    gb.add_beveled_box(
        0.185, 0.036, 0.034, mats["dark"], ty=-0.012, tz=-0.212, no_outline=True
    )
    # Central reinforcing nasal pillar
    gb.add_beveled_box(0.038, 0.160, 0.032, mats["trim"], ty=-0.025, tz=-0.222)
    # Perforated breathing vents (left and right)
    for side in (-1.0, 1.0):
        for vy, vz in ((-0.08, -0.210), (-0.11, -0.204)):
            gb.add_beveled_box(0.016, 0.016, 0.020, mats["dark"], tx=side * 0.07, ty=vy, tz=vz, no_outline=True)
    # Knightly crown comb ridge
    gb.add_beveled_box(0.028, 0.085, 0.280, mats["trim"], ty=0.22, tz=0.01)
    # Sweeping heraldic feather plume
    gb.add_curved_spike(
        0.052,
        0.320,
        0.18,
        mats["crimson"],
        ty=0.23,
        tz=0.03,
        rx=-0.48,
        flatten_x=0.42,
    )

    # 19. Gear_neitiznot-helm: Neitiznot Winged Faceguard (Nordic T-Bar + Valkyrie Wings)
    gb = GearBuilder("Gear_neitiznot-helm", showcase_pos=(xs[1], row_y, row_z))
    # Nordic skullcap dome
    gb.add_lofted(
        [
            (-0.02, 0.214, 0.222, 0.0, 0.002, 0.12),
            (0.06, 0.222, 0.228, 0.0, 0.002, 0.14),
            (0.14, 0.198, 0.208, 0.0, 0.004, 0.10),
            (0.22, 0.135, 0.145, 0.0, 0.006, 0.05),
            (0.26, 0.045, 0.055, 0.0, 0.006, 0.0),
        ],
        mats["primary"],
        vertices=18,
    )
    # Riveted bronze brow band
    gb.add_torus(0.220, 0.018, mats["trim"], ty=0.015, scale_z=1.04)
    # T-shaped faceguard nasal plate and jaw guards
    gb.add_beveled_box(0.042, 0.20, 0.034, mats["trim"], ty=-0.03, tz=-0.224)
    gb.add_beveled_box(0.210, 0.032, 0.032, mats["trim"], ty=0.025, tz=-0.218)
    gb.add_beveled_box(0.180, 0.038, 0.032, mats["dark"], ty=-0.015, tz=-0.208, no_outline=True)
    for side in (-1.0, 1.0):
        # Swept cheek flukes
        gb.add_beveled_box(0.035, 0.14, 0.030, mats["trim"], tx=side * 0.105, ty=-0.07, tz=-0.202)
        # Triple layered Valkyrie swept wing feathers
        for feather_i, (fy, fz, flen, fbend) in enumerate(
            ((0.02, -0.02, 0.32, 0.06), (0.07, 0.02, 0.26, 0.05), (0.12, 0.05, 0.20, 0.04))
        ):
            gb.add_curved_spike(
                0.038 - feather_i * 0.005,
                flen,
                0.12,
                mats["white"],
                bend_x=side * fbend,
                tx=side * 0.210,
                ty=fy,
                tz=fz,
                rx=-0.42,
                rz=-side * 0.32,
                flatten_x=0.30,
            )

    # 20. Gear_horned-helm: Dharok / Torva Dreadnought Ram-Horn Helm
    gb = GearBuilder("Gear_horned-helm", showcase_pos=(xs[2], row_y, row_z))
    # Angular dreadnought steel helm dome
    gb.add_lofted(
        [
            (-0.08, 0.215, 0.222, 0.0, 0.004, 0.25),
            (0.04, 0.224, 0.230, 0.0, 0.002, 0.28),
            (0.14, 0.202, 0.212, 0.0, 0.004, 0.22),
            (0.21, 0.145, 0.155, 0.0, 0.006, 0.14),
            (0.25, 0.055, 0.065, 0.0, 0.008, 0.08),
        ],
        mats["primary"],
        vertices=14,
    )
    # Narrow menacing eye slit
    gb.add_beveled_box(
        0.185, 0.032, 0.035, mats["dark"], ty=-0.015, tz=-0.215, no_outline=True
    )
    # Lower jagged jaw guard and chin reinforcement
    gb.add_beveled_box(0.225, 0.062, 0.060, mats["trim"], ty=-0.09, tz=-0.205)
    # Massive dreadnought curled ram horns with spiked ridges
    for side in (-1.0, 1.0):
        # Base horn mount boss
        gb.add_gem(0.045, 0.045, 0.030, mats["dark"], tx=side * 0.17, ty=0.10, tz=-0.02, sides=6)
        # Main curling ram horn (curving back, then curling down)
        gb.add_curved_spike(
            0.052,
            0.32,
            -0.16,
            mats["trim"],
            bend_x=side * 0.16,
            tx=side * 0.170,
            ty=0.11,
            tz=-0.01,
            rz=-side * 0.78,
        )
        # Forward cheek tusk
        gb.add_curved_spike(
            0.026,
            0.12,
            -0.05,
            mats["trim"],
            tx=side * 0.09,
            ty=-0.09,
            tz=-0.215,
            rx=-0.92,
        )

    # 21. Gear_armadyl-helm: Armadyl Falcon/Eagle Avian Helm
    gb = GearBuilder("Gear_armadyl-helm", showcase_pos=(xs[3], row_y, row_z))
    # Aerodynamic avian dome
    gb.add_lofted(
        [
            (-0.06, 0.208, 0.216, 0.0, 0.008, 0.12),
            (0.04, 0.218, 0.224, 0.0, 0.004, 0.14),
            (0.12, 0.198, 0.206, 0.0, 0.002, 0.10),
            (0.18, 0.148, 0.158, 0.0, -0.002, 0.06),
            (0.22, 0.062, 0.072, 0.0, -0.004, 0.0),
        ],
        mats["primary"],
        vertices=18,
    )
    # Hooked eagle beak nasal guard arching downward over nose
    gb.add_curved_spike(
        0.065,
        0.24,
        0.09,
        mats["trim"],
        ty=-0.02,
        tz=-0.185,
        rx=-math.pi / 2.05,
        sides=6,
        flatten_x=0.72,
        smooth=False,
    )
    # Slanted glowing sapphire eagle eyes
    for side in (-1.0, 1.0):
        gb.add_gem(
            0.032, 0.015, 0.018, mats["glow"], tx=side * 0.072, ty=0.015, tz=-0.216, rz=-side * 0.25
        )
        # Aerodynamic swept temple wings
        gb.add_curved_spike(
            0.042,
            0.28,
            0.14,
            mats["trim"],
            bend_x=side * 0.10,
            tx=side * 0.195,
            ty=0.06,
            tz=-0.01,
            rx=-0.48,
            rz=-side * 0.38,
            flatten_x=0.32,
        )
    # Tri-feather crown crest
    for cy, c_len, c_rz in ((0.21, 0.18, 0.0), (0.23, 0.14, 0.18), (0.23, 0.14, -0.18)):
        gb.add_curved_spike(
            0.024, c_len, 0.06, mats["trim"], ty=cy, tz=0.02, rx=-0.35, rz=c_rz, flatten_x=0.35
        )

    # 22. Gear_wizard-hat: Pointed Wizard Hat (Broad Undulating Brim + Bent Cone Peak)
    gb = GearBuilder("Gear_wizard-hat", showcase_pos=(xs[4], row_y, row_z))
    # Flared broad sloping circular brim
    gb.add_lofted(
        [
            (0.040, 0.295, 0.275, 0.0, 0.00),
            (0.065, 0.280, 0.260, 0.0, 0.00),
            (0.082, 0.142, 0.142, 0.0, -0.01),
        ],
        mats["primary"],
        vertices=24,
    )
    # Golden brim wire trim
    gb.add_torus(0.285, 0.011, mats["trim"], ty=0.050, scale_z=0.92)
    # Buckled leather hatband
    gb.add_torus(0.134, 0.020, mats["leather"], ty=0.096, tz=-0.01)
    gb.add_beveled_box(0.055, 0.048, 0.024, mats["trim"], ty=0.098, tz=-0.145)
    # Glowing crescent moon / star talisman on the band
    gb.add_gem(0.035, 0.035, 0.022, mats["glow"], ty=0.100, tz=-0.155, sides=5)
    # Crooked bending conical crown (characterful MMORPG curve)
    gb.add_curved_spike(
        0.135, 0.46, 0.18, mats["primary"], bend_x=0.04, ty=0.08, tz=-0.01, rx=0.12, rz=-0.08, sides=18
    )

    # 22b. Gear_infinity-hat: Infinity Runecrafter Hat (Curled Peak + Orbiting Rings)
    gb = GearBuilder("Gear_infinity-hat", showcase_pos=(xs[4] + 0.4, row_y + 0.5, row_z))
    gb.add_lofted(
        [
            (0.035, 0.300, 0.280, 0.0, 0.00),
            (0.060, 0.285, 0.265, 0.0, 0.00),
            (0.080, 0.140, 0.140, 0.0, 0.00),
        ],
        mats["primary"],
        vertices=24,
    )
    gb.add_torus(0.290, 0.012, mats["trim"], ty=0.045, scale_z=0.92)
    gb.add_curved_spike(
        0.130, 0.50, 0.22, mats["primary"], bend_x=0.05, ty=0.08, tz=0.02, rx=0.18, rz=0.12, sides=18
    )
    gb.add_torus(0.170, 0.015, mats["trim"], ty=0.26, tz=0.04, rx=math.pi / 4.0, ry=0.3)
    gb.add_gem(0.045, 0.045, 0.045, mats["glow"], ty=0.50, tz=0.20, sides=8)

    # 23. Gear_robin-hat: Robin Hood Ranger Cap (Turned-Up Side Brim + Long Pheasant Feather)
    gb = GearBuilder("Gear_robin-hat", showcase_pos=(xs[5], row_y, row_z))
    # Asymmetric ranger felt cap
    gb.add_lofted(
        [
            (0.035, 0.215, 0.235, 0.0, 0.01, 0.18),
            (0.105, 0.200, 0.245, -0.018, -0.015, 0.22),
            (0.175, 0.118, 0.185, -0.035, -0.035, 0.16),
            (0.215, 0.035, 0.070, -0.045, -0.055, 0.10),
        ],
        mats["primary"],
        vertices=18,
    )
    # Upturned side brim band
    gb.add_torus(0.210, 0.016, mats["trim"], ty=0.052, rz=-0.22, scale_z=1.08)
    # Gold brooch clasp pinning the feather
    gb.add_gem(0.032, 0.032, 0.022, mats["glow"], tx=0.145, ty=0.085, tz=-0.02, sides=6)
    # Long swept pheasant feather
    gb.add_curved_spike(
        0.032,
        0.34,
        0.15,
        mats["crimson"],
        bend_x=0.09,
        tx=0.15,
        ty=0.09,
        tz=-0.02,
        rx=-0.38,
        rz=-0.48,
        flatten_x=0.32,
    )

    # 24. Gear_hood: Ahrim / Cultist Hood (Deep Shadowed Void + Piercing Spirit Eyes)
    gb = GearBuilder("Gear_hood", showcase_pos=(xs[6], row_y, row_z))
    # Flared cowl hood draping down to shoulders
    gb.add_lofted(
        [
            (-0.16, 0.235, 0.240, 0.0, 0.02, 0.18),
            (-0.02, 0.245, 0.250, 0.0, 0.01, 0.18),
            (0.12, 0.225, 0.240, 0.0, 0.02, 0.16),
            (0.22, 0.150, 0.185, 0.0, 0.05, 0.12),
            (0.29, 0.048, 0.080, 0.0, 0.10, 0.10),
        ],
        mats["primary"],
        vertices=20,
    )
    # Deep shadow face void cavity
    gb.add_beveled_box(
        0.185, 0.175, 0.050, mats["dark"], ty=-0.01, tz=-0.200, no_outline=True
    )
    # Two eerie glowing spirit eye embers inside the cowl
    for side in (-1.0, 1.0):
        gb.add_gem(
            0.018, 0.012, 0.012, mats["glow"], tx=side * 0.055, ty=0.015, tz=-0.185, no_outline=True
        )
    # Embroidered runic cowl hem framing face
    gb.add_torus(0.224, 0.016, mats["trim"], ty=-0.06, tz=-0.01, rx=0.22)
    gb.add_torus(
        0.142, 0.015, mats["trim"], arc=math.pi, ty=0.02, tz=-0.190, rx=math.pi / 2.2
    )

    # 25. Gear_sheikah-mask: Stealth Ninja Cowl + Lower Face Wrap + Forehead Plate
    gb = GearBuilder("Gear_sheikah-mask", showcase_pos=(xs[7], row_y, row_z))
    # Tight ninja shinobi cowl
    gb.add_lofted(
        [
            (-0.12, 0.218, 0.224, 0.0, 0.01, 0.12),
            (0.02, 0.228, 0.234, 0.0, 0.01, 0.12),
            (0.14, 0.208, 0.218, 0.0, 0.02, 0.12),
            (0.22, 0.118, 0.138, 0.0, 0.04, 0.10),
        ],
        mats["primary"],
        vertices=18,
    )
    # Lower face cloth mask covering mouth and jaw
    gb.add_beveled_box(
        0.218, 0.115, 0.068, mats["dark"], ty=-0.065, tz=-0.190, no_outline=True
    )
    # Steel hitai-ate forehead protector plate
    gb.add_beveled_box(0.165, 0.044, 0.026, mats["trim"], ty=0.078, tz=-0.218)
    # Centered Sheikah eye talisman on the forehead plate
    gb.add_gem(0.028, 0.028, 0.018, mats["glow"], ty=0.078, tz=-0.230)
    # Glowing ninja eyes in narrow visor slit
    for side in (-1.0, 1.0):
        gb.add_gem(
            0.030,
            0.012,
            0.014,
            mats["glow"],
            tx=side * 0.065,
            ty=0.020,
            tz=-0.216,
            no_outline=True,
        )

    # 26. Gear_circlet: Royal Gemmed Circlet (5 Filigree Spires + Forehead Diamond)
    gb = GearBuilder("Gear_circlet", showcase_pos=(xs[8], row_y, row_z))
    # Delicate woven golden brow ring
    gb.add_torus(0.204, 0.016, mats["trim"], ty=0.055, scale_z=0.96)
    # 5 crowned spires (center spire tallest, cascading to sides)
    for ang_deg, h_spire in ((-44, 0.080), (-22, 0.110), (0, 0.145), (22, 0.110), (44, 0.080)):
        rad = math.radians(ang_deg)
        sx = math.sin(rad) * 0.204
        sz = -math.cos(rad) * 0.198
        gb.add_curved_spike(
            0.020,
            h_spire,
            0.0,
            mats["trim"],
            tx=sx,
            ty=0.055,
            tz=sz,
            sides=6,
            smooth=False,
        )
        # Small teardrop jewel on spire tip
        gb.add_gem(0.016, 0.020, 0.016, mats["glow"], tx=sx, ty=0.055 + h_spire * 0.85, tz=sz)
    # Radiant center teardrop diamond on forehead
    gb.add_gem(0.055, 0.072, 0.038, mats["glow"], ty=0.100, tz=-0.216, sides=4)


# =============================================================================
# D. BODY ARMOR & E. LEG ARMOR (Assembled on 6 Showcase Armor Stands!)
# =============================================================================
def add_pauldron_pair(
    gb: GearBuilder,
    mats: dict[str, bpy.types.Material],
    left_scale: float = 1.0,
    right_scale: float = 1.0,
    spiked_right: bool = False,
    with_besagews: bool = False,
):
    for side, sc in ((-1.0, left_scale), (1.0, right_scale)):
        px = side * 0.28
        py = 0.26
        # Sculpted layered pauldron plate
        gb.add_lofted(
            [
                (py - 0.050 * sc, 0.096 * sc, 0.086 * sc, px, 0.0, 0.20),
                (py + 0.018 * sc, 0.104 * sc, 0.092 * sc, px, 0.0, 0.22),
                (py + 0.070 * sc, 0.058 * sc, 0.055 * sc, px, 0.0, 0.14),
            ],
            mats["primary"],
            vertices=16,
        )
        gb.add_torus(
            0.092 * sc,
            0.014 * sc,
            mats["trim"],
            tx=px,
            ty=py - 0.042 * sc,
            rz=-side * 0.18,
            scale_z=0.88,
        )
        # Circular besagew disk guarding armpit
        if with_besagews:
            gb.add_gem(
                0.042 * sc,
                0.042 * sc,
                0.016 * sc,
                mats["trim"],
                tx=side * 0.23,
                ty=py - 0.06 * sc,
                tz=-0.12,
                sides=8,
            )
        if spiked_right and side > 0:
            # Massive dual war spikes for barbarian warlord
            gb.add_curved_spike(
                0.042,
                0.24,
                -0.04,
                mats["trim"],
                bend_x=0.08,
                tx=px + 0.05,
                ty=py + 0.05,
                rz=-0.58,
            )
            gb.add_curved_spike(
                0.032,
                0.18,
                -0.03,
                mats["trim"],
                bend_x=0.06,
                tx=px + 0.08,
                ty=py - 0.01,
                rz=-0.88,
            )


def build_body_and_leg_armors(mats: dict[str, bpy.types.Material]):
    stand_y = 0.85
    stand_z = -0.35
    stand_xs = [-4.2, -2.52, -0.84, 0.84, 2.52, 4.2]

    # -------------------------------------------------------------------------
    # Stand 1: Gear_plate-body_torso + Gear_platelegs_legL / legR
    # Knightly Peascod Cuirass + Articulated Greaves with Knee Fans
    # -------------------------------------------------------------------------
    s1 = stand_xs[0]
    gb = GearBuilder("Gear_plate-body_torso", showcase_pos=(s1, stand_y, stand_z))
    add_pauldron_pair(gb, mats, 1.05, 1.05, with_besagews=True)
    # Peascod breastplate with distinct medial vertical keel ridge and pecs
    gb.add_lofted(
        [
            (-0.34, 0.180, 0.134, 0.0, 0.0, 0.24, 0.0, 0.016),
            (-0.12, 0.202, 0.148, 0.0, -0.005, 0.26, 0.016, 0.022),
            (0.14, 0.236, 0.165, 0.0, -0.008, 0.30, 0.024, 0.024),
            (0.32, 0.224, 0.150, 0.0, 0.0, 0.24, 0.010, 0.008),
        ],
        mats["primary"],
        vertices=20,
    )
    # Raised steel gorget collar shielding the throat
    gb.add_torus(0.198, 0.020, mats["trim"], ty=0.29, rx=0.14, scale_z=0.76)
    # Embossed lion / heraldic cross shield chest emblem
    gb.add_beveled_box(0.135, 0.160, 0.038, mats["trim"], ty=0.10, tz=-0.178)
    gb.add_gem(0.042, 0.052, 0.024, mats["primary"], ty=0.10, tz=-0.195, sides=4)
    # Riveted fauld rim at belt line
    gb.add_torus(0.188, 0.022, mats["trim"], ty=-0.34, scale_z=0.76)
    for bx in (-0.10, 0.10):
        gb.add_beveled_box(0.082, 0.100, 0.028, mats["trim"], tx=bx, ty=-0.38, tz=-0.145)

    for side, suffix in ((-1.0, "legL"), (1.0, "legR")):
        lgb = GearBuilder(
            f"Gear_platelegs_{suffix}",
            showcase_pos=(s1 + side * 0.11, stand_y - 0.34, stand_z),
        )
        # Armored thigh cuisses with horizontal fluting, fitted to Kai's athletic proportions
        lgb.add_lofted(
            [
                (-0.36, 0.136, 0.140, 0.0, -0.005, 0.20),
                (-0.08, 0.146, 0.148, 0.0, -0.005, 0.20),
            ],
            mats["primary"],
            vertices=14,
        )
        # Articulated knee poleyn with flared lateral side wing fan
        lgb.add_beveled_box(0.140, 0.095, 0.065, mats["trim"], ty=-0.38, tz=-0.075)
        lgb.add_curved_spike(
            0.028, 0.10, -0.02, mats["trim"], bend_x=side * 0.04, tx=side * 0.085, ty=-0.38, tz=-0.05, rz=-side * 0.75
        )

    # -------------------------------------------------------------------------
    # Stand 2: Gear_trim-plate_torso
    # Paladin Royal Cuirass + Arched Gorget + Sunburst Pauldrons + Zenyte
    # -------------------------------------------------------------------------
    s2 = stand_xs[1]
    gb = GearBuilder("Gear_trim-plate_torso", showcase_pos=(s2, stand_y, stand_z))
    # Broad golden sunburst pauldrons
    add_pauldron_pair(gb, mats, 1.18, 1.18)
    gb.add_lofted(
        [
            (-0.34, 0.184, 0.138, 0.0, 0.0, 0.26, 0.0, 0.014),
            (0.12, 0.242, 0.170, 0.0, -0.010, 0.32, 0.026, 0.018),
            (0.34, 0.228, 0.154, 0.0, 0.0, 0.26, 0.012, 0.0),
        ],
        mats["primary"],
        vertices=20,
    )
    # High arched ceremonial throat guard
    gb.add_arc_shell(
        [
            (0.24, 0.185, 0.130, 0.0, 0.0),
            (0.35, 0.175, 0.125, 0.0, 0.01),
        ],
        arc_start=-math.pi * 0.22,
        arc_end=math.pi * 1.22,
        thickness=0.026,
        mat=mats["trim"],
        steps=14,
    )
    # Central heraldic ceremonial tabard running down breastplate
    gb.add_beveled_box(0.135, 0.52, 0.034, mats["trim"], ty=0.00, tz=-0.172)
    # Radiant centered glowing zenyte medallion
    gb.add_gem(0.075, 0.098, 0.038, mats["glow"], ty=0.12, tz=-0.190, sides=4)
    # Double-layered gilded waist rim
    gb.add_torus(0.192, 0.024, mats["trim"], ty=-0.34, scale_z=0.76)
    gb.add_torus(0.182, 0.016, mats["trim"], ty=-0.30, scale_z=0.76)

    # -------------------------------------------------------------------------
    # Stand 3: Gear_bandos-chest_torso + Gear_tassets_torso / legL / legR
    # Barbarian Warlord Asymmetric Harness + Spiked Pauldron + Bone Tassets
    # -------------------------------------------------------------------------
    s3 = stand_xs[2]
    gb = GearBuilder("Gear_bandos-chest_torso", showcase_pos=(s3, stand_y, stand_z))
    # Asymmetric: bare left side, massive dual-spiked right pauldron
    add_pauldron_pair(gb, mats, left_scale=0.0, right_scale=1.28, spiked_right=True)
    gb.add_lofted(
        [
            (-0.34, 0.178, 0.132, 0.0, 0.0, 0.24),
            (0.10, 0.234, 0.164, 0.0, -0.008, 0.28, 0.022, 0.008),
            (0.30, 0.222, 0.148, 0.0, 0.0, 0.22),
        ],
        mats["primary"],
        vertices=20,
    )
    # Diagonal rugged leather chest straps with studs
    gb.add_beveled_box(0.044, 0.44, 0.034, mats["leather"], tx=0.03, ty=0.05, tz=-0.170, rz=-0.62)
    gb.add_beveled_box(0.044, 0.44, 0.034, mats["leather"], tx=-0.03, ty=0.05, tz=-0.170, rz=0.62)
    # Heavy central forged iron harness ring
    gb.add_torus(0.055, 0.015, mats["trim"], ty=0.06, tz=-0.180)
    # Thick barbarian leather war belt with carved bone skull centerpiece
    gb.add_torus(0.190, 0.024, mats["leather"], ty=-0.34, scale_z=0.76)
    gb.add_gem(0.058, 0.068, 0.036, mats["white"], ty=-0.34, tz=-0.168, sides=6)

    # Gear_tassets_torso: Layered barbarian fauld skirt with iron side plates
    tgb = GearBuilder("Gear_tassets_torso", showcase_pos=(s3, stand_y, stand_z))
    tgb.add_lofted(
        [
            (-0.52, 0.240, 0.182, 0.0, 0.0, 0.20),
            (-0.32, 0.184, 0.140, 0.0, 0.0, 0.18),
        ],
        mats["primary"],
        vertices=16,
    )
    # Heavy central maille/leather groin apron
    tgb.add_beveled_box(0.125, 0.28, 0.034, mats["trim"], tx=0.0, ty=-0.52, tz=-0.158)
    # Segmented iron hip plates with brass rivets
    for side in (-1.0, 1.0):
        tgb.add_beveled_box(
            0.105,
            0.24,
            0.048,
            mats["trim"],
            tx=side * 0.15,
            ty=-0.50,
            tz=-0.12,
            rz=side * 0.20,
        )
        tgb.add_gem(0.024, 0.024, 0.020, mats["glow"], tx=side * 0.15, ty=-0.44, tz=-0.14, sides=6)

    for side, suffix in ((-1.0, "legL"), (1.0, "legR")):
        lgb = GearBuilder(
            f"Gear_tassets_{suffix}",
            showcase_pos=(s3 + side * 0.11, stand_y - 0.34, stand_z),
        )
        # Heavy curved barbarian thigh guard fitted to Kai's proportions
        lgb.add_beveled_box(
            0.145,
            0.24,
            0.082,
            mats["primary"],
            tx=side * 0.035,
            ty=-0.20,
            tz=-0.04,
            rz=side * 0.15,
        )
        # Studded knee plate
        lgb.add_beveled_box(0.130, 0.085, 0.058, mats["trim"], ty=-0.38, tz=-0.065)

    # -------------------------------------------------------------------------
    # Stand 4: Gear_dhide-body_torso + Gear_dhide-chaps_torso / legL / legR
    # Ranger Dragonhide Brigandine + Low-Profile Caps + Quiver Baldric
    # -------------------------------------------------------------------------
    s4 = stand_xs[3]
    gb = GearBuilder("Gear_dhide-body_torso", showcase_pos=(s4, stand_y, stand_z))
    # Streamlined archer shoulder caps that allow full bow draw
    add_pauldron_pair(gb, mats, 0.82, 0.82)
    gb.add_lofted(
        [
            (-0.32, 0.176, 0.130, 0.0, 0.0, 0.18),
            (0.12, 0.228, 0.158, 0.0, -0.006, 0.22, 0.014, 0.0),
            (0.30, 0.216, 0.144, 0.0, 0.0, 0.18),
        ],
        mats["primary"],
        vertices=18,
    )
    # High stand-up leather collar protecting the neck
    gb.add_torus(0.185, 0.018, mats["leather"], ty=0.28, rx=0.12, scale_z=0.76)
    # Segmented quilted dragon-scale chest panels
    for py_scale, pw in ((0.16, 0.28), (0.05, 0.26), (-0.06, 0.24), (-0.17, 0.22)):
        gb.add_beveled_box(pw, 0.038, 0.032, mats["trim"], ty=py_scale, tz=-0.165)
    # Diagonal ranger bandolier quiver baldric strap with brass buckle
    gb.add_beveled_box(0.044, 0.48, 0.028, mats["leather"], tx=0.02, ty=0.04, tz=-0.170, rz=0.52)
    gb.add_beveled_box(0.058, 0.058, 0.034, mats["trim"], tx=0.02, ty=0.04, tz=-0.178)

    cgb = GearBuilder("Gear_dhide-chaps_torso", showcase_pos=(s4, stand_y, stand_z))
    cgb.add_torus(0.184, 0.022, mats["leather"], ty=-0.36, scale_z=0.76)
    cgb.add_beveled_box(0.082, 0.060, 0.040, mats["trim"], ty=-0.36, tz=-0.158)

    for side, suffix in ((-1.0, "legL"), (1.0, "legR")):
        lgb = GearBuilder(
            f"Gear_dhide-chaps_{suffix}",
            showcase_pos=(s4 + side * 0.11, stand_y - 0.34, stand_z),
        )
        lgb.add_lofted(
            [
                (-0.36, 0.134, 0.138, 0.0, -0.005, 0.16),
                (-0.08, 0.144, 0.146, 0.0, -0.005, 0.18),
            ],
            mats["primary"],
            vertices=14,
        )
        # Criss-cross outer-thigh laced drawstrings
        for lace_y in (-0.14, -0.22, -0.30):
            lgb.add_beveled_box(0.032, 0.016, 0.024, mats["leather"], tx=side * 0.125, ty=lace_y, tz=-0.02)
        # Studded dragon leather knee patch
        lgb.add_beveled_box(0.130, 0.085, 0.055, mats["trim"], ty=-0.38, tz=-0.078)
        lgb.add_gem(0.024, 0.024, 0.018, mats["glow"], ty=-0.38, tz=-0.098, sides=6)

    # -------------------------------------------------------------------------
    # Stand 5: Gear_robe-top_torso + armL/armR + Gear_robe-skirt_torso
    # Archmage High Standing Collar + Draped Stole + Bell Sleeves + Full Skirt
    # -------------------------------------------------------------------------
    s5 = stand_xs[4]
    gb = GearBuilder("Gear_robe-top_torso", showcase_pos=(s5, stand_y, stand_z))
    # High stiff sorcerer standing collar framing the neck & jaw
    gb.add_arc_shell(
        [
            (0.22, 0.190, 0.135, 0.0, 0.01),
            (0.38, 0.205, 0.145, 0.0, 0.02),
        ],
        arc_start=math.pi * 0.05,
        arc_end=math.pi * 0.95,
        thickness=0.024,
        mat=mats["trim"],
        steps=14,
    )
    gb.add_lofted(
        [
            (-0.34, 0.178, 0.132, 0.0, 0.0, 0.16),
            (0.14, 0.230, 0.160, 0.0, -0.006, 0.20),
            (0.32, 0.220, 0.146, 0.0, 0.0, 0.18),
        ],
        mats["primary"],
        vertices=18,
    )
    # Draped ceremonial runic stole hanging over both shoulders down to waist
    for side in (-1.0, 1.0):
        gb.add_beveled_box(0.065, 0.44, 0.026, mats["trim"], tx=side * 0.10, ty=0.02, tz=-0.165)
    # Floating glowing elemental rune crystal medallion at sternum
    gb.add_gem(0.052, 0.068, 0.034, mats["glow"], ty=0.16, tz=-0.178, sides=6)
    # Gold rope sash waistband
    gb.add_torus(0.186, 0.020, mats["trim"], ty=-0.34, scale_z=0.76)

    for side, suffix in ((-1.0, "armL"), (1.0, "armR")):
        agb = GearBuilder(
            f"Gear_robe-top_{suffix}",
            showcase_pos=(s5 + side * 0.28, stand_y + 0.26, stand_z),
        )
        # Dramatic flared bell sleeves widening toward wrist
        agb.add_lofted(
            [
                (-0.64, 0.102, 0.102),
                (-0.48, 0.064, 0.064),
            ],
            mats["primary"],
            vertices=14,
        )
        # Embroidered gold cuff band
        agb.add_torus(0.102, 0.014, mats["trim"], ty=-0.63)

    sgb = GearBuilder("Gear_robe-skirt_torso", showcase_pos=(s5, stand_y, stand_z))
    # Cascading flared wizard skirt widening down to ankles
    sgb.add_lofted(
        [
            (-1.08, 0.285, 0.220, 0.0, 0.0, 0.12),
            (-0.70, 0.238, 0.182, 0.0, 0.0, 0.14),
            (-0.32, 0.180, 0.138, 0.0, 0.0, 0.16),
        ],
        mats["primary"],
        vertices=20,
    )
    # Wide golden hem band
    sgb.add_torus(0.282, 0.018, mats["trim"], ty=-1.05, scale_z=0.78)
    # Full-length central embroidered runic stole
    sgb.add_beveled_box(0.082, 0.74, 0.028, mats["trim"], ty=-0.68, tz=-0.190)
    for ry in (-0.50, -0.70, -0.90):
        sgb.add_gem(0.024, 0.024, 0.020, mats["glow"], ty=ry, tz=-0.200, sides=4)

    # -------------------------------------------------------------------------
    # Stand 6: Gear_tunic_torso + Gear_trousers_torso / legL / legR
    # Adventurer Linen Tunic + Folded V-Neck + Baldric + Potion Flask & Pouch
    # -------------------------------------------------------------------------
    s6 = stand_xs[5]
    gb = GearBuilder("Gear_tunic_torso", showcase_pos=(s6, stand_y, stand_z))
    gb.add_lofted(
        [
            (-0.34, 0.176, 0.130, 0.0, 0.0, 0.18),
            (0.12, 0.226, 0.156, 0.0, -0.005, 0.20),
            (0.30, 0.212, 0.142, 0.0, 0.0, 0.16),
        ],
        mats["primary"],
        vertices=18,
    )
    # Folded V-neck collar showing linen undershirt
    gb.add_beveled_box(0.090, 0.120, 0.025, mats["white"], ty=0.20, tz=-0.160)
    gb.add_torus(0.196, 0.016, mats["trim"], ty=0.26, rx=0.12, scale_z=0.74)
    # Diagonal sword baldric strap with brass buckle
    gb.add_beveled_box(
        0.052, 0.48, 0.034, mats["leather"], tx=-0.04, ty=0.02, tz=-0.164, rz=0.38
    )
    gb.add_beveled_box(0.065, 0.065, 0.038, mats["trim"], tx=-0.04, ty=0.02, tz=-0.172)
    # Adventurer belt with attached potion flask & utility pouch
    gb.add_torus(0.184, 0.022, mats["leather"], ty=-0.34, scale_z=0.76)
    # Glowing glass potion flask
    gb.add_gem(0.038, 0.065, 0.038, mats["glow"], tx=-0.14, ty=-0.34, tz=-0.12)
    gb.add_beveled_box(0.022, 0.025, 0.022, mats["wood"], tx=-0.14, ty=-0.29, tz=-0.12)
    # Stitched leather utility pouch
    gb.add_beveled_box(0.075, 0.085, 0.052, mats["leather"], tx=0.14, ty=-0.34, tz=-0.12)

    tr_gb = GearBuilder("Gear_trousers_torso", showcase_pos=(s6, stand_y, stand_z))
    tr_gb.add_torus(0.182, 0.020, mats["trim"], ty=-0.36, scale_z=0.76)

    for side, suffix in ((-1.0, "legL"), (1.0, "legR")):
        lgb = GearBuilder(
            f"Gear_trousers_{suffix}",
            showcase_pos=(s6 + side * 0.11, stand_y - 0.34, stand_z),
        )
        lgb.add_lofted(
            [
                (-0.62, 0.070, 0.074),
                (-0.08, 0.090, 0.092),
            ],
            mats["primary"],
            vertices=14,
        )
        # Criss-cross calf leather gaiter wraps from mid-calf to ankle
        for gy, grz in ((-0.44, 0.28), (-0.50, -0.28), (-0.56, 0.28), (-0.62, -0.28)):
            lgb.add_torus(0.072, 0.009, mats["leather"], ty=gy, rz=grz)


# =============================================================================
# F. BOOTS, GLOVES, CAPES, AMULET & RING (17 Sculpted Templates)
# =============================================================================
def build_boots_gloves_capes_jewelry(mats: dict[str, bpy.types.Material]):
    cape_y = 2.00
    cape_z = -0.15

    # 43. Gear_cape: Flowing pleated adventurer's cape
    # Anchored at clavicle/shoulder line (y = 0.0); drapes downward to y = -0.80
    gb = GearBuilder(
        "Gear_cape",
        showcase_pos=(-1.35, cape_y, cape_z),
    )
    # Flowing pleated cloak body with regal backward billow & generous buttock/leg clearance
    gb.add_arc_shell(
        [
            (0.02, 0.20, 0.07, 0.0, 0.03),   # Collar line resting over trapezius
            (-0.24, 0.24, 0.09, 0.0, 0.07),  # Mid-back curve
            (-0.52, 0.29, 0.11, 0.0, 0.15),  # Arches generously past belt & buttocks
            (-0.82, 0.33, 0.14, 0.0, 0.24),  # Billowing lower hem
        ],
        arc_start=math.pi * 0.26,
        arc_end=math.pi * 0.74,
        thickness=0.024,
        mat=mats["primary"],
        steps=18,
    )
    # Scalloped bottom hem border
    gb.add_arc_shell(
        [
            (-0.78, 0.325, 0.138, 0.0, 0.23),
            (-0.84, 0.335, 0.142, 0.0, 0.25),
        ],
        arc_start=math.pi * 0.25,
        arc_end=math.pi * 0.75,
        thickness=0.030,
        mat=mats["trim"],
        steps=18,
    )
    # Twin lion/gem shoulder clasps resting at clavicles
    for side in (-1.0, 1.0):
        gb.add_gem(0.045, 0.045, 0.032, mats["trim"], tx=side * 0.14, ty=0.00, tz=0.02)
        gb.add_gem(0.024, 0.024, 0.018, mats["glow"], tx=side * 0.14, ty=0.00, tz=-0.01)
    # Collar chain link connecting the clasps
    gb.add_torus(0.14, 0.012, mats["trim"], arc=math.pi * 0.70, ty=0.01, tz=-0.01, rx=math.pi * 0.35)

    # 44. Gear_lava-cape: Infernal / Fire Cape
    # Anchored at clavicles (y = 0.0); flowing molten magma sheet with dynamic rear clearance
    gb = GearBuilder(
        "Gear_lava-cape",
        showcase_pos=(-0.60, cape_y, cape_z),
    )
    # Obsidian shoulder collar
    gb.add_arc_shell(
        [
            (0.02, 0.19, 0.07, 0.0, 0.02),
            (-0.06, 0.22, 0.08, 0.0, 0.05),
        ],
        arc_start=math.pi * 0.25,
        arc_end=math.pi * 0.75,
        thickness=0.036,
        mat=mats["dark"],
        steps=16,
    )
    # Molten magma cascading sheet
    gb.add_arc_shell(
        [
            (-0.04, 0.21, 0.07, 0.0, 0.05),
            (-0.28, 0.25, 0.09, 0.0, 0.09),
            (-0.55, 0.29, 0.11, 0.0, 0.16),
            (-0.84, 0.33, 0.13, 0.0, 0.25),
        ],
        arc_start=math.pi * 0.26,
        arc_end=math.pi * 0.74,
        thickness=0.028,
        mat=mats["primary"],
        steps=18,
    )
    # Dripping serrated magma teeth along scalloped bottom hem
    for tx_tooth, r_sc in ((-0.20, 0.8), (-0.11, 1.1), (0.0, 1.3), (0.11, 1.1), (0.20, 0.8)):
        gb.add_curved_spike(
            0.038 * r_sc,
            0.15 * r_sc,
            -0.02,
            mats["glow"],
            tx=tx_tooth,
            ty=-0.82,
            tz=0.33,
            rx=math.pi,
            sides=6,
            smooth=False,
        )
    # Embedded glowing magma nodes
    for ty_node, tx_node, tz_n in ((-0.22, -0.09, 0.16), (-0.42, 0.08, 0.22), (-0.62, -0.06, 0.29), (-0.35, 0.0, 0.19)):
        gb.add_gem(0.042, 0.055, 0.028, mats["glow"], tx=tx_node, ty=ty_node, tz=tz_n)

    # 45. Gear_ava: Ava's Accumulator
    # Anchored at upper back (ty = 0.0, tz = 0.14)
    gb = GearBuilder(
        "Gear_ava",
        showcase_pos=(0.15, cape_y, cape_z),
    )
    # Brass accumulator main housing
    gb.add_beveled_box(0.24, 0.32, 0.12, mats["primary"], ty=-0.12, tz=0.14)
    # Clockwork dial gauge and power core
    gb.add_torus(0.085, 0.018, mats["trim"], ty=-0.12, tz=0.21, rx=math.pi / 2.0)
    gb.add_gem(0.046, 0.046, 0.032, mats["glow"], ty=-0.12, tz=0.22)
    # Steam pipes and copper fittings
    for side in (-1.0, 1.0):
        gb.add_torus(0.035, 0.010, mats["trim"], tx=side * 0.09, ty=-0.12, tz=0.20, rx=math.pi / 2.0)
    # Arrow quiver cylinder angled at side
    gb.add_lofted(
        [(-0.16, 0.055, 0.055), (0.18, 0.065, 0.065)],
        mats["leather"],
        vertices=12,
        tx=0.12,
        ty=-0.10,
        tz=0.16,
        rz=-0.28,
    )
    # Fletched arrows protruding
    for ax, ay, az in ((0.14, 0.24, 0.15), (0.18, 0.26, 0.18), (0.11, 0.22, 0.19)):
        gb.add_curved_spike(
            0.018, 0.14, 0.0, mats["white"], tx=ax, ty=ay, tz=az, rz=-0.28, sides=6
        )
    # Leather harness straps wrapping forward over shoulders
    for side in (-1.0, 1.0):
        gb.add_beveled_box(0.042, 0.22, 0.024, mats["leather"], tx=side * 0.11, ty=0.02, tz=0.06, rx=0.45)

    # Row 4: 4 Boot Tiers (L/R), Gloves (L/R), Amulet & Ring
    boot_y = -0.10
    boot_z = -0.55
    boot_configs = [
        ("Gear_boots", -4.0),
        ("Gear_primordial-boots", -2.5),
        ("Gear_pegasian-boots", -1.0),
        ("Gear_eternal-boots", 0.5),
    ]

    for base_name, bx in boot_configs:
        for is_left in (True, False):
            side = -1.0 if is_left else 1.0
            suffix = "L" if is_left else "R"
            gb = GearBuilder(
                f"{base_name}_{suffix}",
                showcase_pos=(bx + side * 0.15, boot_y, boot_z),
            )
            gb.add_torus(0.086, 0.016, mats["trim"], ty=-0.67, tz=0.01)
            gb.add_lofted(
                [
                    (-0.84, 0.078, 0.086, 0.0, 0.01, 0.22),
                    (-0.67, 0.082, 0.084, 0.0, 0.01, 0.18),
                ],
                mats["primary"],
                vertices=14,
            )
            gb.add_beveled_box(
                0.096, 0.062, 0.125, mats["primary"], ty=-0.83, tz=-0.045
            )

            if base_name == "Gear_primordial-boots":
                gb.add_beveled_box(
                    0.102, 0.045, 0.065, mats["trim"], ty=-0.83, tz=-0.085
                )
                gb.add_curved_spike(
                    0.032,
                    0.18,
                    0.08,
                    mats["trim"],
                    bend_x=side * 0.06,
                    tx=side * 0.082,
                    ty=-0.72,
                    tz=0.02,
                    rx=-0.45,
                    rz=-side * 0.45,
                )
                gb.add_gem(
                    0.026,
                    0.036,
                    0.026,
                    mats["glow"],
                    tx=side * 0.085,
                    ty=-0.74,
                    tz=0.0,
                )
            elif base_name == "Gear_pegasian-boots":
                for wy, wlen in ((-0.76, 0.20), (-0.71, 0.16)):
                    gb.add_curved_spike(
                        0.032,
                        wlen,
                        0.09,
                        mats["white"],
                        bend_x=side * 0.05,
                        tx=side * 0.086,
                        ty=wy,
                        tz=0.01,
                        rx=-0.42,
                        rz=-side * 0.38,
                        flatten_x=0.32,
                    )
            elif base_name == "Gear_eternal-boots":
                gb.add_curved_spike(
                    0.038,
                    0.11,
                    -0.05,
                    mats["trim"],
                    ty=-0.83,
                    tz=-0.09,
                    rx=-0.65,
                )
                gb.add_gem(
                    0.038, 0.052, 0.038, mats["glow"], tx=0.0, ty=-0.71, tz=-0.065
                )

    # 42. Gear_gloves_L & Gear_gloves_R
    for is_left in (True, False):
        side = -1.0 if is_left else 1.0
        suffix = "L" if is_left else "R"
        gb = GearBuilder(
            f"Gear_gloves_{suffix}",
            showcase_pos=(2.0 + side * 0.16, boot_y - 0.12, boot_z),
        )
        gb.add_lofted(
            [
                (-0.64, 0.064, 0.066),
                (-0.48, 0.074, 0.076),
            ],
            mats["primary"],
            vertices=14,
        )
        for gy in (-0.50, -0.56, -0.62):
            gb.add_torus(0.072, 0.011, mats["trim"], ty=gy)
        gb.add_beveled_box(0.082, 0.065, 0.045, mats["trim"], ty=-0.67, tz=-0.035)

    # 46. Gear_amulet
    gb = GearBuilder("Gear_amulet", showcase_pos=(3.3, boot_y - 0.95, boot_z))
    gb.add_torus(0.105, 0.014, mats["trim"], ty=0.38, tz=-0.04, rx=0.52, scale_z=1.25)
    gb.add_gem(0.048, 0.072, 0.036, mats["glow"], ty=0.25, tz=-0.20)
    for side in (-1.0, 1.0):
        gb.add_curved_spike(
            0.022,
            0.09,
            -0.02,
            mats["trim"],
            tx=side * 0.045,
            ty=0.26,
            tz=-0.19,
            rz=side * 0.55,
        )

    # 47. Gear_ring
    gb = GearBuilder("Gear_ring", showcase_pos=(4.3, boot_y - 0.10, boot_z))
    gb.add_torus(0.042, 0.010, mats["trim"], ty=-0.63, tz=-0.02, ry=math.pi / 2.0)
    gb.add_gem(0.028, 0.032, 0.028, mats["glow"], ty=-0.60, tz=-0.055)


# =============================================================================
# Studio Showcase Environment & Render (Added AFTER exporting gear.glb!)
# =============================================================================
def setup_armory_studio_and_render(render_path: str | None):
    scene = bpy.context.scene

    world = bpy.data.worlds.new("ArmoryStudioWorld")
    scene.world = world
    bg = world.node_tree.nodes.get("Background") if world.node_tree else None
    if bg:
        bg.inputs["Color"].default_value = hex_to_rgba(0x0F172A)
        bg.inputs["Strength"].default_value = 1.05

    plinth_mat = make_material("ShowcasePlinth", 0x1E293B, roughness=0.65, metallic=0.20)
    for tier_y, tier_z, tier_h in (
        (2.45, 0.25, 0.07),
        (1.42, 0.05, 0.07),
        (-0.02, -0.35, 0.07),
        (-1.02, -0.50, 0.09),
    ):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co = Vector(
                t2b_pos(
                    v.co.x * 11.2,
                    tier_y + v.co.y * tier_h,
                    tier_z + v.co.z * 0.55,
                )
            )
        mesh = bpy.data.meshes.new("ArmoryShelf")
        bm.to_mesh(mesh)
        bm.free()
        shelf = bpy.data.objects.new("ArmoryShelf", mesh)
        shelf.data.materials.append(plinth_mat)
        bpy.context.collection.objects.link(shelf)

    cam_data = bpy.data.cameras.new("ArmoryCamera")
    cam_data.lens = 32
    cam_obj = bpy.data.objects.new("ArmoryCamera", cam_data)
    cam_obj.location = t2b_pos(0.0, 1.48, -11.4)
    target = Vector(t2b_pos(0.0, 1.42, 0.0))
    direction = target - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    def add_light(lname, ltype, energy, hex_c, t_loc, t_target=(0.0, 1.4, 0.0)):
        ldata = bpy.data.lights.new(name=lname, type=ltype)
        ldata.energy = energy
        ldata.color = hex_to_rgba(hex_c)[:3]
        lobj = bpy.data.objects.new(name=lname, object_data=ldata)
        lobj.location = t2b_pos(*t_loc)
        d = Vector(t2b_pos(*t_target)) - lobj.location
        lobj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(lobj)
        return lobj

    add_light("KeyLight", "AREA", 1900.0, 0xFFFBEB, (3.5, 5.5, -7.8))
    add_light("FillLight", "AREA", 1200.0, 0x93C5FD, (-4.5, 3.8, -7.0))
    add_light("RimLight", "AREA", 1600.0, 0xF59E0B, (0.0, 4.8, 4.2))

    scene.render.use_freestyle = False

    if render_path:
        os.makedirs(os.path.dirname(os.path.abspath(render_path)), exist_ok=True)
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 1050
        scene.render.filepath = render_path
        bpy.ops.render.render(write_still=True)
        print(f"[Blender] Rendered Armory preview image: {render_path}")


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    blend_dir = os.path.join(repo_root, "blender")
    models_dir = os.path.join(repo_root, "public", "models")
    os.makedirs(blend_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    render_path = r"C:\Users\User\.gemini\antigravity-cli\brain\28c9539a-1323-4489-8927-620e19a4a583\scratch\gear_render.png"
    if "--" in sys.argv:
        extra = sys.argv[sys.argv.index("--") + 1 :]
        if "--render" in extra:
            idx = extra.index("--render")
            if idx + 1 < len(extra):
                render_path = extra[idx + 1]

    clear_scene()
    mats = create_semantic_materials()

    build_weapons(mats)
    build_shields(mats)
    build_headgear(mats)
    build_body_and_leg_armors(mats)
    build_boots_gloves_capes_jewelry(mats)

    # Clean up imported asset cache from the scene before export
    for o in list(BLEND_ASSET_CACHE.values()):
        try:
            bpy.data.objects.remove(o, do_unlink=True)
        except Exception:
            pass
    BLEND_ASSET_CACHE.clear()

    blend_path = os.path.join(blend_dir, "gear.blend")
    glb_path = os.path.join(models_dir, "gear.glb")

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_yup=True,
        export_extras=True,
        export_animations=False,
    )
    print(f"[Blender] Exported glTF binary: {glb_path}")

    setup_armory_studio_and_render(render_path)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[Blender] Saved editable source file: {blend_path}")


if __name__ == "__main__":
    main()
