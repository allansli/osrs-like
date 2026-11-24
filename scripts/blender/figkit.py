"""
Figure kit utilities for model pipeline: merge, paint, and export.
"""

import os
import re
import sys
import bmesh
import bpy
from mathutils import Vector

sys.dont_write_bytecode = True

# Add scripts/blender directory to sys.path so paths can be imported
sys.path.append(os.path.dirname(__file__))
import paths

NAME_CLASSES = ("eye", "glow", "gem", "orb", "string")

# Meshes that must never be merged:
# - Hair*
# - CrownSpike_*
# - BackSpike_*
# - Sideburn_*
# - TorsoCoat (exact)
# - OuterCoat_*
# - CoatTrim_*
# - CoatTail_*
# - CoatTailTrim_*
# - InnerCollar (exact)
# - _legL_04_ / _legR_04_ (gear leg meshes hidden on hero, keeping _NN_ ordinals)
TOGGLED = re.compile(
    r"^(Hair|CrownSpike_|BackSpike_|Sideburn_|TorsoCoat$|OuterCoat_|CoatTrim_|CoatTail_|CoatTailTrim_|InnerCollar$)|_leg[LR]_04_"
)


def get_name_class(name: str) -> str:
    """Classify mesh name into one of: 'eye', 'glow', 'gem', 'orb', 'string', or 'other'."""
    n = name.lower()
    for cls in NAME_CLASSES:
        if cls in n:
            return cls
    return "other"


def matches_keep(name: str, keep_rule) -> bool:
    """Check if object name matches keep rule."""
    if keep_rule is None:
        return False
    if hasattr(keep_rule, "search"):
        return bool(keep_rule.search(name))
    if isinstance(keep_rule, str):
        return bool(re.search(keep_rule, name))
    if isinstance(keep_rule, (set, list, tuple)):
        return name in keep_rule
    if callable(keep_rule):
        return bool(keep_rule(name))
    raise TypeError(f"Unrecognised keep rule {keep_rule!r} ({type(keep_rule).__name__})")


def get_descendant_meshes(root) -> list[bpy.types.Object]:
    """Find all descendant mesh objects under root (or all mesh objects if root is None)."""
    if root is None:
        return [o for o in bpy.data.objects if o.type == "MESH"]
    if isinstance(root, str):
        root = bpy.data.objects[root]

    meshes = []

    def _collect(obj):
        for child in obj.children:
            if child.type == "MESH":
                meshes.append(child)
            _collect(child)

    if root.type == "MESH":
        meshes.append(root)
    _collect(root)
    return meshes


def merge_parts(root=None, keep=TOGGLED) -> list[bpy.types.Object]:
    """
    Joins meshes sharing parent, material, noOutline and name class ('eye', 'glow', 'gem', 'orb', 'string', other).
    Keeps a name in the class, keeps extras.
    Never merges a mesh whose name matches keep (default TOGGLED), keeping leg _NN_ ordinals unchanged.
    Other gear _04_ meshes merge freely.
    """
    meshes = get_descendant_meshes(root)
    if not meshes:
        return []

    # Filter out meshes that match keep
    to_merge = []
    kept_alone = []
    for m in meshes:
        if matches_keep(m.name, keep):
            kept_alone.append(m)
        else:
            to_merge.append(m)

    # Group candidate meshes by (parent, material_tuple, noOutline, name_class)
    groups: dict[tuple, list[bpy.types.Object]] = {}
    for m in to_merge:
        parent_key = m.parent.name if m.parent else None
        mat_key = (
            tuple(mat.name for mat in m.data.materials if mat)
            if m.data.materials
            else ()
        )
        no_outline = bool(m.get("noOutline", False))
        cls_key = get_name_class(m.name)
        key = (parent_key, mat_key, no_outline, cls_key)
        groups.setdefault(key, []).append(m)

    # Process each group
    result = list(kept_alone)
    for key, group_objs in groups.items():
        if len(group_objs) <= 1:
            result.extend(group_objs)
            continue

        # Target object keeps its name (which is already in the class)
        target = group_objs[0]

        # Gather extras across all objects in group
        merged_extras = {}
        for obj in group_objs:
            for k in obj.keys():
                if k == "_RNA_UI":
                    continue
                if k in merged_extras and merged_extras[k] != obj[k]:
                    raise ValueError(
                        f"merge_parts: extras key {k!r} has conflicting values "
                        f"{merged_extras[k]!r} vs {obj[k]!r} in group {key}"
                    )
                merged_extras[k] = obj[k]

        # Children of joined-away meshes are re-parented to the target, keeping world matrix
        orphans = [(c, c.matrix_world.copy()) for obj in group_objs[1:] for c in obj.children]

        # Deselect all, select group, make target active
        bpy.ops.object.select_all(action="DESELECT")
        for obj in group_objs:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = target

        # Join objects
        bpy.ops.object.join()

        for c, mw in orphans:
            c.parent = target
            c.matrix_world = mw

        # Target mesh name can match target object name
        target.data.name = target.name

        # Restore extras
        for k, v in merged_extras.items():
            target[k] = v

        # Clean duplicate material slots on target if join added them
        if len(target.data.materials) > 1:
            unique_mats = []
            mat_map = {}
            for mat in target.data.materials:
                if mat and mat.name not in mat_map:
                    mat_map[mat.name] = len(unique_mats)
                    unique_mats.append(mat)
            if len(unique_mats) < len(target.data.materials):
                for poly in target.data.polygons:
                    old_mat = target.data.materials[poly.material_index] if poly.material_index < len(target.data.materials) else None
                    if old_mat and old_mat.name in mat_map:
                        poly.material_index = mat_map[old_mat.name]
                target.data.materials.clear()
                for mat in unique_mats:
                    target.data.materials.append(mat)

        result.append(target)

    bpy.context.view_layer.update()
    return result


def _compute_crease_ao(obj: bpy.types.Object) -> list[float]:
    """Compute crease-angle occlusion term per vertex for fast paint without Cycles raytracing."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    bm.verts.ensure_lookup_table()

    ao_values = []
    for v in bm.verts:
        concavities = []
        for e in v.link_edges:
            other = e.other_vert(v)
            diff = other.co - v.co
            length = diff.length
            if length > 1e-6:
                concavities.append((diff / length).dot(v.normal))
        if concavities:
            mean_c = sum(concavities) / len(concavities)
            # Concave valley has mean_c > 0
            occ = max(0.0, min(1.0, mean_c * 2.0))
            ao_values.append(1.0 - occ)
        else:
            ao_values.append(1.0)

    bm.free()
    return ao_values


def bake_paint(
    root=None,
    ao: float = 0.35,
    gradient: float = 0.15,
    warm_cool: float = 0.05,
    fast_paint: bool | None = None,
) -> None:
    """
    Cycles CPU vertex bake of ambient occlusion into a colour attribute named 'Col' on the POINT domain,
    multiplied by a height gradient and a front-to-back tint.
    With --fast-paint a crease-angle term replaces the ray-traced one.
    """
    meshes = get_descendant_meshes(root)
    if not meshes:
        return

    if fast_paint is None:
        fast_paint = "--fast-paint" in sys.argv

    # Ensure each mesh has color attribute named 'Col' on POINT domain
    for obj in meshes:
        mesh = obj.data
        ca = mesh.color_attributes.get("Col")
        if ca is None:
            ca = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
        elif ca.domain != "POINT":
            mesh.color_attributes.remove(ca)
            ca = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
        mesh.color_attributes.active_color = ca

    crease_terms = {}
    if fast_paint:
        for obj in meshes:
            crease_terms[obj] = _compute_crease_ao(obj)
    else:
        # Cycles CPU vertex bake of AO
        bpy.ops.object.select_all(action="DESELECT")
        for obj in meshes:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]

        scene = bpy.context.scene
        old_engine = scene.render.engine
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 16
        scene.render.bake.target = "VERTEX_COLORS"
        scene.cycles.bake_type = "AO"

        bpy.ops.object.bake(type="AO")
        scene.render.engine = old_engine

    # Compute bounding box across all meshes in world space for figure-wide gradient & tint
    min_y, max_y = float("inf"), float("-inf")
    min_z, max_z = float("inf"), float("-inf")

    for obj in meshes:
        mat = obj.matrix_world
        for v in obj.data.vertices:
            w = mat @ v.co
            if w.y < min_y: min_y = w.y
            if w.y > max_y: max_y = w.y
            if w.z < min_z: min_z = w.z
            if w.z > max_z: max_z = w.z

    inv_dy = 1.0 / (max_y - min_y) if (max_y - min_y) > 1e-6 else 0.0
    inv_dz = 1.0 / (max_z - min_z) if (max_z - min_z) > 1e-6 else 0.0

    for obj in meshes:
        mesh = obj.data
        ca = mesh.color_attributes.get("Col")
        mat = obj.matrix_world
        fast_vals = crease_terms.get(obj)

        for i, v in enumerate(mesh.vertices):
            w = mat @ v.co

            if fast_paint and fast_vals:
                v_ao = fast_vals[i]
            else:
                v_ao = ca.data[i].color[0]

            ao_factor = 1.0 - ao * (1.0 - v_ao)

            # Height gradient: top is 1.0, foot is 1.0 - gradient
            tz = (w.z - min_z) * inv_dz if inv_dz > 0.0 else 0.5
            grad_factor = 1.0 - gradient * (1.0 - tz)

            # Front-to-back tint: +Y is front (warm), -Y is back (cool)
            ty = (w.y - min_y) * inv_dy if inv_dy > 0.0 else 0.5
            y_shift = 2.0 * ty - 1.0
            tint_r = 1.0 + warm_cool * y_shift
            tint_g = 1.0
            tint_b = 1.0 - warm_cool * y_shift

            r = max(0.0, min(1.0, ao_factor * grad_factor * tint_r))
            g = max(0.0, min(1.0, ao_factor * grad_factor * tint_g))
            b = max(0.0, min(1.0, ao_factor * grad_factor * tint_b))

            ca.data[i].color = (r, g, b, 1.0)


def export_glb(path: str, **kwargs) -> str:
    """
    Export scene to GLB with active vertex color, no texcoords, extras and Y-up.
    """
    checked_path = paths.checked_write(path)
    opts = {
        "filepath": checked_path,
        "export_format": "GLB",
        "export_vertex_color": "ACTIVE",
        "export_texcoords": False,
        "export_extras": True,
        "export_yup": True,
    }
    opts.update(kwargs)
    bpy.ops.export_scene.gltf(**opts)
    return checked_path
