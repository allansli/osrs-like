"""
Figure kit utilities for model pipeline: merge, paint, and export.
"""

import os
import re
import sys
import math
import bmesh
import bpy
from mathutils import Vector, Euler, Quaternion

sys.dont_write_bytecode = True

# Add scripts/blender directory to sys.path so paths and rigs can be imported
sys.path.append(os.path.dirname(__file__))
import paths
import rigs

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


def _plain(v):
    """IDProperty arrays and groups compare by identity; compare their plain values."""
    if hasattr(v, "to_dict"):
        return v.to_dict()
    if hasattr(v, "to_list"):
        return v.to_list()
    return v


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
                # Plain copies: an IDProperty array or group compares by identity, and
                # a reference into a joined-away object dangles after the join.
                v = _plain(obj[k])
                if k in merged_extras and merged_extras[k] != v:
                    raise ValueError(
                        f"merge_parts: extras key {k!r} has conflicting values "
                        f"{merged_extras[k]!r} vs {v!r} in group {key}"
                    )
                merged_extras[k] = v

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
    Export scene to GLB with active vertex color, no texcoords, extras, skins, NLA tracks, and Y-up.
    """
    checked_path = paths.checked_write(path)
    opts = {
        "filepath": checked_path,
        "export_format": "GLB",
        "export_vertex_color": "ACTIVE",
        "export_texcoords": False,
        "export_extras": True,
        "export_yup": True,
        "export_skins": True,
        "export_animation_mode": "NLA_TRACKS",
        "export_optimize_animation_keep_anim_armature": False,
    }
    opts.update(kwargs)
    bpy.ops.export_scene.gltf(**opts)
    return checked_path


def make_rig(
    name: str,
    table,
    joints: dict,
    prefix: str | None = None,
) -> bpy.types.Object:
    """
    Creates an armature object at the origin with identity transform whose every bone
    points straight up with roll 0, heads at the given joint positions, named
    <prefix>_<Bone> when a prefix is given.
    Refuses joints whose limb directions are more than 20 degrees from the skeleton's
    reference pose (unless the table row is flagged 'code_posed').
    """
    # 1. Refusal check for limb directions > 20 degrees from reference pose
    # Find children per bone
    children_map: dict[str, list] = {}
    entry_map = {}
    for entry in table:
        bone = entry.bone if hasattr(entry, "bone") else entry[0]
        parent = entry.parent if hasattr(entry, "parent") else entry[1]
        entry_map[bone] = entry
        if parent:
            children_map.setdefault(parent, []).append(bone)

    for bone, entry in entry_map.items():
        flag = getattr(entry, "flag", None) or (entry[3] if len(entry) > 3 and isinstance(entry[3], str) else None)
        ref_dir = getattr(entry, "ref_dir", None) or (
            entry[4] if len(entry) > 4 else (entry[3] if len(entry) > 3 and not isinstance(entry[3], str) else None)
        )

        if ref_dir is not None and bone in children_map:
            # Check if flagged code_posed
            if flag and "code_posed" in str(flag):
                continue

            b_key = f"{prefix}_{bone}" if prefix and f"{prefix}_{bone}" in joints else bone
            if b_key not in joints:
                continue

            # Check against primary limb child (e.g. Torso -> HeadGroup, LeftArmPivot -> LeftElbowPivot)
            candidate_children = children_map[bone]
            for child_bone in candidate_children:
                c_entry = entry_map[child_bone]
                c_flag = getattr(c_entry, "flag", None) or (c_entry[3] if len(c_entry) > 3 and isinstance(c_entry[3], str) else None)
                if c_flag and "code_posed" in str(c_flag):
                    continue

                c_key = f"{prefix}_{child_bone}" if prefix and f"{prefix}_{child_bone}" in joints else child_bone
                if c_key in joints:
                    delta = Vector(joints[c_key]) - Vector(joints[b_key])
                    if delta.length > 1e-5:
                        actual_dir = delta.normalized()
                        ref_v = Vector(ref_dir).normalized()
                        dot = max(-1.0, min(1.0, actual_dir.dot(ref_v)))
                        angle_deg = math.degrees(math.acos(dot))
                        # If bone has multiple children (e.g. Torso -> HeadGroup, arms), only test if this child is the reference child
                        if len(candidate_children) > 1 and angle_deg > 20.0001:
                            continue
                        if angle_deg > 20.0001:
                            raise ValueError(
                                f"make_rig: Joint '{bone}' -> '{child_bone}' limb direction {tuple(actual_dir)} deviates "
                                f"{angle_deg:.2f}° from reference pose {tuple(ref_v)} (max 20° allowed)"
                            )
                        break

    # 2. Create armature object at origin with identity transform
    arm_data = bpy.data.armatures.new(name)
    arm_obj = bpy.data.objects.new(name, arm_data)
    arm_obj.location = (0.0, 0.0, 0.0)
    arm_obj.rotation_euler = (0.0, 0.0, 0.0)
    arm_obj.scale = (1.0, 1.0, 1.0)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj

    # 3. Create bones pointing straight up (+Z) with roll 0
    bpy.ops.object.mode_set(mode="EDIT")
    created_bones = {}

    for entry in table:
        bone = entry.bone if hasattr(entry, "bone") else entry[0]
        parent = entry.parent if hasattr(entry, "parent") else entry[1]
        optional = entry.optional if hasattr(entry, "optional") else (entry[2] if len(entry) > 2 and isinstance(entry[2], bool) else False)

        b_key = f"{prefix}_{bone}" if prefix and f"{prefix}_{bone}" in joints else bone
        if b_key not in joints:
            if optional:
                continue
            raise ValueError(f"make_rig: Required joint '{bone}' (key {b_key!r}) not found in joints dict")

        bone_name = f"{prefix}_{bone}" if prefix else bone
        eb = arm_data.edit_bones.new(bone_name)
        head_pos = Vector(joints[b_key])
        eb.head = head_pos
        eb.tail = head_pos + Vector((0.0, 0.0, 0.1))
        eb.roll = 0.0
        eb.use_connect = False
        created_bones[bone] = eb

    # Link parents
    for entry in table:
        bone = entry.bone if hasattr(entry, "bone") else entry[0]
        parent = entry.parent if hasattr(entry, "parent") else entry[1]
        if bone in created_bones and parent and parent in created_bones:
            created_bones[bone].parent = created_bones[parent]

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    return arm_obj


def organic_body(
    graph,
    radii,
    voxel: float,
    triangles: int,
) -> bpy.types.Object:
    """
    Builds a continuous, manifold organic body: stick graph, skin modifier,
    voxel remesh, smooth, decimate to target triangles, and validate().
    """
    if isinstance(graph, tuple):
        pts, edges = graph
    else:
        pts = graph.vertices if hasattr(graph, "vertices") else graph[0]
        edges = graph.edges if hasattr(graph, "edges") else graph[1]

    if isinstance(radii, (int, float)):
        radii_list = [(float(radii), float(radii))] * len(pts)
    elif isinstance(radii, dict):
        radii_list = []
        for i in range(len(pts)):
            r = radii.get(i, 0.1)
            if isinstance(r, (int, float)):
                radii_list.append((float(r), float(r)))
            else:
                radii_list.append((float(r[0]), float(r[1])))
    else:
        radii_list = []
        for r in radii:
            if isinstance(r, (int, float)):
                radii_list.append((float(r), float(r)))
            else:
                radii_list.append((float(r[0]), float(r[1])))

    me = bpy.data.meshes.new("organic_body_graph")
    me.from_pydata([tuple(v) for v in pts], list(edges), [])
    me.update()

    ob = bpy.data.objects.new("organic_body", me)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)

    # 1. Skin modifier
    mod_skin = ob.modifiers.new("Skin", "SKIN")
    for i, sv in enumerate(me.skin_vertices[0].data):
        r = radii_list[i] if i < len(radii_list) else (0.1, 0.1)
        sv.radius = r
        sv.use_root = (i == 0)
    bpy.ops.object.modifier_apply(modifier="Skin")

    # 2. Voxel remesh
    ob.data.remesh_voxel_size = voxel
    bpy.ops.object.voxel_remesh()

    # 3. Smooth
    mod_smooth = ob.modifiers.new("Smooth", "SMOOTH")
    mod_smooth.factor = 0.5
    mod_smooth.iterations = 2
    bpy.ops.object.modifier_apply(modifier="Smooth")

    # 4. Decimate to target triangles
    current_tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if current_tris > triangles:
        mod_dec = ob.modifiers.new("Decimate", "DECIMATE")
        mod_dec.ratio = max(0.01, min(1.0, triangles / max(1, current_tris)))
        bpy.ops.object.modifier_apply(modifier="Decimate")

    # 5. validate()
    ob.data.validate()
    bpy.context.view_layer.update()
    return ob


def segment_weights(body: bpy.types.Object, rig: bpy.types.Object) -> None:
    """
    Fallback weighting: distance to each limb segment over the limb's radius,
    blended across the two nearest.
    """
    segs = []
    for b in rig.data.bones:
        p0 = b.head_local
        if b.children:
            p1 = b.children[0].head_local
        else:
            p1 = b.tail_local
        length = (p1 - p0).length
        r = max(0.05, length * 0.3)
        segs.append((b.name, p0, p1, r))
        if b.name not in body.vertex_groups:
            body.vertex_groups.new(name=b.name)

    if not segs:
        return

    for v in body.data.vertices:
        ds = []
        for bname, a, b, r in segs:
            ab = b - a
            len_sq = ab.length_squared
            if len_sq > 1e-8:
                t = max(0.0, min(1.0, (v.co - a).dot(ab) / len_sq))
                dist = (v.co - (a + ab * t)).length
            else:
                dist = (v.co - a).length
            ds.append((dist / r, bname))

        ds.sort(key=lambda item: item[0])
        (d0, b0), (d1, b1) = ds[0], ds[1]
        w0 = max(0.01, 1.0 / (d0 + 1e-4))
        w1 = max(0.01, 1.0 / (d1 + 1e-4))
        total_w = w0 + w1
        body.vertex_groups[b0].add([v.index], w0 / total_w, "REPLACE")
        body.vertex_groups[b1].add([v.index], w1 / total_w, "REPLACE")


def auto_weights(
    body: bpy.types.Object,
    rig: bpy.types.Object,
    spread_pose=None,
) -> None:
    """
    Builds a limb-aligned twin of the rig with the same names, runs Blender's
    automatic weights against it, re-binds the body to the world-aligned rig,
    limits to 4 influences and normalises.
    If any vertex is unweighted it calls segment_weights and prints that it did.
    """
    twin_data = bpy.data.armatures.new(f"{rig.name}_twin")
    twin_obj = bpy.data.objects.new(f"{rig.name}_twin", twin_data)
    bpy.context.collection.objects.link(twin_obj)
    bpy.context.view_layer.objects.active = twin_obj
    bpy.ops.object.mode_set(mode="EDIT")

    for b in rig.data.bones:
        tb = twin_data.edit_bones.new(b.name)
        tb.head = b.head_local.copy()
        if b.children:
            child_head = b.children[0].head_local
            if (child_head - tb.head).length > 1e-4:
                tb.tail = child_head.copy()
            else:
                tb.tail = tb.head + Vector((0.0, 0.0, 0.1))
        elif b.parent:
            parent_dir = b.head_local - b.parent.head_local
            if parent_dir.length > 1e-4:
                tb.tail = tb.head + parent_dir.normalized() * 0.1
            else:
                tb.tail = tb.head + Vector((0.0, 0.0, 0.1))
        else:
            tb.tail = tb.head + Vector((0.0, 0.0, 0.1))
        tb.roll = 0.0
        tb.use_connect = False

    for b in rig.data.bones:
        if b.parent:
            twin_data.edit_bones[b.name].parent = twin_data.edit_bones[b.parent.name]

    bpy.ops.object.mode_set(mode="OBJECT")

    # Run automatic weights against twin
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    twin_obj.select_set(True)
    bpy.context.view_layer.objects.active = twin_obj
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    # Check unweighted vertices
    unweighted = [
        v.index
        for v in body.data.vertices
        if not v.groups or sum(g.weight for g in v.groups) < 1e-4
    ]
    if unweighted:
        print(f"[figkit] Unweighted vertices found ({len(unweighted)}); segment_weights fallback applied")
        segment_weights(body, rig)

    # Re-bind to world-aligned rig
    body.parent = rig
    body.parent_type = "OBJECT"
    for m in list(body.modifiers):
        if m.type == "ARMATURE":
            body.modifiers.remove(m)
    arm_mod = body.modifiers.new("Armature", "ARMATURE")
    arm_mod.object = rig

    # Cleanup twin rig
    bpy.data.objects.remove(twin_obj, do_unlink=True)
    bpy.data.armatures.remove(twin_data, do_unlink=True)

    # Limit to 4 influences and normalize
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    bpy.context.view_layer.update()


def hard_weights(part: bpy.types.Object, bone: str | bpy.types.Bone) -> None:
    """Assigns weight 1 on one bone across all vertices of part."""
    b_name = bone if isinstance(bone, str) else bone.name
    for vg in list(part.vertex_groups):
        if vg.name != b_name:
            part.vertex_groups.remove(vg)
    vg = part.vertex_groups.get(b_name)
    if vg is None:
        vg = part.vertex_groups.new(name=b_name)
    if len(part.data.vertices) > 0:
        vg.add(list(range(len(part.data.vertices))), 1.0, "REPLACE")


def fold_weights(mesh: bpy.types.Object, mapping: dict) -> None:
    """Sums a source's vertex groups onto the rig's bones and normalises."""
    src_to_target = {}
    for k, v in mapping.items():
        if isinstance(v, (list, tuple, set)):
            for src in v:
                src_to_target[src] = k
        else:
            src_to_target[k] = v

    num_verts = len(mesh.data.vertices)
    vg_names = {vg.index: vg.name for vg in mesh.vertex_groups}
    target_weights = [{} for _ in range(num_verts)]

    for v in mesh.data.vertices:
        for g in v.groups:
            src_name = vg_names.get(g.group)
            if src_name in src_to_target:
                tgt = src_to_target[src_name]
                target_weights[v.index][tgt] = target_weights[v.index].get(tgt, 0.0) + g.weight

    for vg in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(vg)

    target_vgs = {}
    for tgt in set(src_to_target.values()):
        target_vgs[tgt] = mesh.vertex_groups.new(name=tgt)

    for v_idx, tw in enumerate(target_weights):
        if not tw:
            continue
        items = sorted(tw.items(), key=lambda x: x[1], reverse=True)[:4]
        total = sum(w for _, w in items)
        if total > 1e-6:
            for tgt, w in items:
                target_vgs[tgt].add([v_idx], w / total, "REPLACE")

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)


def get_material_family(obj: bpy.types.Object) -> str:
    """
    Engine material family rule from blenderMonsters.ts 103-136.
    Classifies mesh into one of: 'eye', 'glow', 'skin', 'cloth', 'leather',
    'wood', 'bark', 'moss', 'stone', 'metal', or 'plain'.
    """
    mesh_name = obj.name.lower()
    mat = obj.data.materials[0] if (obj.data and obj.data.materials) else None
    mat_name = mat.name.lower() if mat else ""

    is_emissive = False
    if mat and mat.use_nodes and mat.node_tree:
        for n in mat.node_tree.nodes:
            if n.type == "EMISSION":
                is_emissive = True
                break
            if n.type == "BSDF_PRINCIPLED":
                strength = n.inputs.get("Emission Strength")
                color = n.inputs.get("Emission Color")
                if strength and strength.default_value > 0.05 and color:
                    if any(c > 0.0 for c in color.default_value[:3]):
                        is_emissive = True
                        break

    if "eye" in mesh_name:
        return "eye"
    if "glow" in mat_name or is_emissive:
        return "glow"
    if any(k in mat_name for k in ("skin", "scale", "chitin", "feather")):
        return "skin"
    if any(k in mat_name for k in ("cloth", "robe")):
        return "cloth"
    if any(k in mat_name for k in ("leather", "fur", "wing", "hoof")):
        return "leather"
    if "wood" in mat_name:
        return "wood"
    if "bark" in mat_name:
        return "bark"
    if any(k in mat_name for k in ("moss", "grass", "leaf")):
        return "moss"
    if "stone" in mat_name:
        return "stone"
    if any(k in mat_name for k in ("iron", "bronze", "steel")):
        return "metal"
    return "plain"


def merge_by_family(root=None, keep=TOGGLED) -> list[bpy.types.Object]:
    """
    One skinned mesh per engine material family and outline flag.
    Groups meshes by parent object AND parent_type and parent_bone,
    material family, and noOutline flag, so meshes parented to different
    bones of one armature never merge.
    Never merges a mesh whose name matches keep (default TOGGLED).
    """
    meshes = get_descendant_meshes(root)
    if not meshes:
        return []

    to_merge = []
    kept_alone = []
    for m in meshes:
        if matches_keep(m.name, keep):
            kept_alone.append(m)
        else:
            to_merge.append(m)

    groups: dict[tuple, list[bpy.types.Object]] = {}
    for m in to_merge:
        parent_name = m.parent.name if m.parent else None
        parent_type = m.parent_type
        parent_bone = m.parent_bone
        family = get_material_family(m)
        no_outline = bool(m.get("noOutline", False)) or ("eye" in m.name.lower())
        key = (parent_name, parent_type, parent_bone, family, no_outline)
        groups.setdefault(key, []).append(m)

    result = list(kept_alone)
    for key, group_objs in groups.items():
        if len(group_objs) <= 1:
            result.extend(group_objs)
            continue

        target = group_objs[0]

        merged_extras = {}
        for obj in group_objs:
            for k in obj.keys():
                if k == "_RNA_UI":
                    continue
                v = _plain(obj[k])
                if k in merged_extras and merged_extras[k] != v:
                    raise ValueError(
                        f"merge_by_family: extras key {k!r} has conflicting values "
                        f"{merged_extras[k]!r} vs {v!r} in group {key}"
                    )
                merged_extras[k] = v

        orphans = [(c, c.matrix_world.copy()) for obj in group_objs[1:] for c in obj.children]

        bpy.ops.object.select_all(action="DESELECT")
        for obj in group_objs:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = target

        bpy.ops.object.join()

        for c, mw in orphans:
            c.parent = target
            c.matrix_world = mw

        target.data.name = target.name

        for k, v in merged_extras.items():
            target[k] = v

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


def make_clip(
    rig: bpy.types.Object,
    name: str,
    frames: int,
    pose_table,
) -> bpy.types.NlaTrack:
    """
    Samples a pose table per frame onto pose bones as quaternions (rotation_mode = 'QUATERNION'),
    where the table's rotations are three-space Euler triples read in three's YZX order
    (Blender mode 'XZY'), one NLA track per clip, clears the active action.
    """
    if rig.animation_data is None:
        rig.animation_data_create()

    action = bpy.data.actions.new(name)
    rig.animation_data.action = action

    for f in range(frames + 1):
        if callable(pose_table):
            u = f / frames if frames > 0 else 0.0
            pose = pose_table(u)
        elif isinstance(pose_table, dict):
            if f in pose_table:
                pose = pose_table[f]
            else:
                pose = {}
                for b, v in pose_table.items():
                    if isinstance(v, dict) and f in v:
                        pose[b] = v[f]
                    elif isinstance(v, (list, tuple)) and f < len(v):
                        pose[b] = v[f]
                    elif isinstance(v, (list, tuple)) and len(v) == 3 and isinstance(v[0], (int, float)):
                        pose[b] = v
        else:
            raise TypeError(f"make_clip: Unrecognised pose_table type {type(pose_table)}")

        for b_name, rot in pose.items():
            pb = rig.pose.bones.get(b_name)
            if pb is None:
                for b_cand in rig.pose.bones:
                    if b_cand.name.endswith(f"_{b_name}"):
                        pb = b_cand
                        break
            if pb is None:
                continue

            pb.rotation_mode = "QUATERNION"
            rx, ry, rz = rot
            q = Euler((rx, ry, rz), "XZY").to_quaternion()
            pb.rotation_quaternion = q
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)

    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, action)
    strip.name = name
    rig.animation_data.action = None

    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)

    bpy.context.view_layer.update()
    return track
