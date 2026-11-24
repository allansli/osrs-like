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
    `table` is a list of rigs.BoneDef. Refuses a joint whose direction to its reference
    child (BoneDef.ref_child) is more than 20 degrees from BoneDef.ref_dir, unless the row
    or its reference child is flagged 'code_posed'. Only that one child is checked, however
    many children the bone has. A bone whose `parent` has no joint takes `fallback_parent`.
    A joint key that is neither a table bone nor `<prefix>_<bone>` raises (a typo must not
    silently drop a joint). Each bone's reference child is recorded on the armature data
    (`figkit_ref_child`, not exported) for the weighting segments.
    """
    def key_of(bone):
        pk = f"{prefix}_{bone}" if prefix else None
        return pk if pk is not None and pk in joints else bone

    def full(bone):
        return f"{prefix}_{bone}" if prefix else bone

    entries = {e.bone: e for e in table}
    known = set(entries) | {full(b) for b in entries}
    unknown = sorted(k for k in joints if k not in known)
    if unknown:
        raise ValueError(f"make_rig: joint keys {unknown} are not bones of the table (prefix {prefix!r})")
    present = {b for b in entries if key_of(b) in joints}

    # 1. Refusal check against the reference pose
    for bone, entry in entries.items():
        if bone not in present or entry.ref_dir is None:
            continue
        child = entries.get(entry.ref_child)
        if child is None:
            raise ValueError(f"make_rig: row {bone!r} has ref_dir but ref_child {entry.ref_child!r} is not in the table")
        if child.bone not in present:
            continue  # optional reference child absent: nothing to compare
        if "code_posed" in (entry.flag or "") or "code_posed" in (child.flag or ""):
            continue
        delta = Vector(joints[key_of(child.bone)]) - Vector(joints[key_of(bone)])
        if delta.length < 1e-5:
            raise ValueError(f"make_rig: joints '{bone}' and '{child.bone}' coincide")
        ref_v = Vector(entry.ref_dir).normalized()
        angle_deg = math.degrees(math.acos(max(-1.0, min(1.0, delta.normalized().dot(ref_v)))))
        if angle_deg > 20.0001:
            raise ValueError(
                f"make_rig: Joint '{bone}' -> '{child.bone}' limb direction {tuple(delta.normalized())} deviates "
                f"{angle_deg:.2f} degrees from reference pose {tuple(ref_v)} (max 20 degrees allowed)"
            )

    for bone, entry in entries.items():
        if bone not in present and not entry.optional:
            raise ValueError(f"make_rig: Required joint '{bone}' (key {key_of(bone)!r}) not found in joints dict")

    def parent_of(entry):
        if entry.parent is None:
            return None
        if entry.parent in present:
            return entry.parent
        if entry.fallback_parent is not None:
            return entry.fallback_parent
        raise ValueError(f"make_rig: parent '{entry.parent}' of '{entry.bone}' has no joint and no fallback_parent")

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
    created = {}
    for entry in table:
        if entry.bone not in present:
            continue
        eb = arm_data.edit_bones.new(full(entry.bone))
        head_pos = Vector(joints[key_of(entry.bone)])
        eb.head = head_pos
        eb.tail = head_pos + Vector((0.0, 0.0, 0.1))
        eb.roll = 0.0
        eb.use_connect = False
        created[entry.bone] = eb
    for entry in table:
        if entry.bone in created:
            parent = parent_of(entry)
            if parent is not None:
                created[entry.bone].parent = created[parent]

    bpy.ops.object.mode_set(mode="OBJECT")
    # On the armature data, which the glTF exporter does not write (bone and object
    # properties would become extras).
    arm_data["figkit_ref_child"] = {
        full(e.bone): full(e.ref_child) for e in table if e.bone in present and e.ref_child in present
    }
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

    def pair(r):
        return (float(r), float(r)) if isinstance(r, (int, float)) else (float(r[0]), float(r[1]))

    if isinstance(radii, (int, float)):
        radii_list = [pair(radii)] * len(pts)
    elif isinstance(radii, dict):
        missing = [i for i in range(len(pts)) if i not in radii]
        if missing:
            raise ValueError(f"organic_body: no radius for graph vertices {missing}")
        radii_list = [pair(radii[i]) for i in range(len(pts))]
    else:
        radii_list = [pair(r) for r in radii]
        if len(radii_list) != len(pts):
            raise ValueError(f"organic_body: {len(radii_list)} radii for {len(pts)} graph vertices")

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
        sv.radius = radii_list[i]
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


def _limb_segment(rig: bpy.types.Object, b: bpy.types.Bone) -> tuple[Vector, Vector]:
    """
    Start and end of bone b's limb in rig space: to its reference child (make_rig's
    figkit_ref_child), else to its only child. A bone with no such child continues the
    direction from its parent's joint to its own for its own length; a parentless one points up.
    """
    head = b.head_local.copy()
    ref = rig.data.get("figkit_ref_child", {}).get(b.name)
    child = rig.data.bones[ref] if ref else (b.children[0] if len(b.children) == 1 else None)
    if child is not None and (child.head_local - head).length > 1e-4:
        return head, child.head_local.copy()
    if b.parent is not None:
        d = head - b.parent.head_local
        if d.length > 1e-4:
            return head, head + d.normalized() * b.length
    return head, head + Vector((0.0, 0.0, b.length))


def segment_weights(body: bpy.types.Object, rig: bpy.types.Object, limb_radius) -> int:
    """
    Fallback weighting for vertices that have no weight: distance to each limb segment
    over the limb's radius, blended across the two nearest (one bone: weight 1).
    Vertices that already carry weight are not touched. `limb_radius` is a float (all
    limbs) or a dict bone name -> radius; a bone missing from the dict raises.
    Prints that it ran and returns the number of vertices it rewrote.
    """
    segs = []
    for b in rig.data.bones:
        if isinstance(limb_radius, dict):
            if b.name not in limb_radius:
                raise ValueError(f"segment_weights: no limb radius for bone {b.name!r}")
            r = float(limb_radius[b.name])
        else:
            r = float(limb_radius)
        if r <= 0.0:
            raise ValueError(f"segment_weights: limb radius for bone {b.name!r} must be positive, got {r}")
        p0, p1 = _limb_segment(rig, b)
        segs.append((b.name, p0, p1, r))
        if b.name not in body.vertex_groups:
            body.vertex_groups.new(name=b.name)
    if not segs:
        raise ValueError("segment_weights: rig has no bones")

    todo = [v for v in body.data.vertices if not any(g.weight > 1e-4 for g in v.groups)]
    for v in todo:
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
        if len(ds) == 1:
            body.vertex_groups[ds[0][1]].add([v.index], 1.0, "REPLACE")
            continue
        (d0, b0), (d1, b1) = ds[0], ds[1]
        w0 = max(0.01, 1.0 / (d0 + 1e-4))
        w1 = max(0.01, 1.0 / (d1 + 1e-4))
        total_w = w0 + w1
        body.vertex_groups[b0].add([v.index], w0 / total_w, "REPLACE")
        body.vertex_groups[b1].add([v.index], w1 / total_w, "REPLACE")
    print(f"[figkit] segment_weights ran on {len(todo)} unweighted vertices of {body.name}")
    return len(todo)


def auto_weights(
    body: bpy.types.Object,
    rig: bpy.types.Object,
    *,
    limb_radius=None,
) -> None:
    """
    Builds a limb-aligned twin of the rig with the same names, runs Blender's
    automatic weights against it, re-binds the body to the world-aligned rig,
    limits to 4 influences and normalises.
    If any vertex is unweighted it calls segment_weights(body, rig, limb_radius), which
    prints that it ran; limb_radius (float or dict bone -> radius) is then required.
    There is no spread_pose parameter: the plan binds bodies in the reference pose (design
    6.1.1 rule 3), so there is no re-pose step for it to drive.
    """
    twin_data = bpy.data.armatures.new(f"{rig.name}_twin")
    twin_obj = bpy.data.objects.new(f"{rig.name}_twin", twin_data)
    bpy.context.collection.objects.link(twin_obj)
    bpy.context.view_layer.objects.active = twin_obj
    bpy.ops.object.mode_set(mode="EDIT")

    for b in rig.data.bones:
        tb = twin_data.edit_bones.new(b.name)
        tb.head, tb.tail = _limb_segment(rig, b)
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
        if limb_radius is None:
            raise ValueError(
                f"auto_weights: {len(unweighted)} vertices of {body.name} are unweighted and no limb_radius was given"
            )
        segment_weights(body, rig, limb_radius)

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


def fold_weights(mesh: bpy.types.Object, mapping: dict, *, unweighted_to: str | None = None) -> None:
    """
    Sums a source's vertex groups onto the rig's bones and normalises.
    `mapping` is {target bone name: [source group names]}, in that direction only.
    Raises if a source is listed under two targets or if the mesh has a vertex group
    that no target lists.
    A vertex with no source weight (or a total of 0) raises, naming the count, unless
    `unweighted_to` names a target bone: those vertices then get weight 1 on it and the
    count is printed (the hero source's 4 unweighted coat vertices go to Torso, critique
    "Second pass").
    """
    src_to_target = {}
    for tgt, sources in mapping.items():
        if not isinstance(sources, (list, tuple)):
            raise TypeError(f"fold_weights: mapping[{tgt!r}] must be a list of source groups, got {type(sources).__name__}")
        for src in sources:
            if src in src_to_target:
                raise ValueError(f"fold_weights: source group {src!r} is mapped to both {src_to_target[src]!r} and {tgt!r}")
            src_to_target[src] = tgt
    unmapped = [vg.name for vg in mesh.vertex_groups if vg.name not in src_to_target]
    if unmapped:
        raise ValueError(f"fold_weights: vertex groups {unmapped} of {mesh.name} are not in the mapping")

    num_verts = len(mesh.data.vertices)
    vg_names = {vg.index: vg.name for vg in mesh.vertex_groups}
    target_weights = [{} for _ in range(num_verts)]

    for v in mesh.data.vertices:
        for g in v.groups:
            tgt = src_to_target[vg_names[g.group]]
            target_weights[v.index][tgt] = target_weights[v.index].get(tgt, 0.0) + g.weight

    for vg in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(vg)

    target_vgs = {}
    for tgt in set(src_to_target.values()):
        target_vgs[tgt] = mesh.vertex_groups.new(name=tgt)

    if unweighted_to is not None and unweighted_to not in mapping:
        raise ValueError(f"fold_weights: unweighted_to {unweighted_to!r} is not a target of the mapping")
    bare = [i for i, tw in enumerate(target_weights) if sum(tw.values()) <= 1e-6]
    if bare and unweighted_to is None:
        raise ValueError(
            f"fold_weights: {len(bare)} vertices of {mesh.name} have no source weight; "
            f"pass unweighted_to=<bone> to put them on one bone"
        )
    if bare:
        print(f"[figkit] fold_weights put {len(bare)} unweighted vertices of {mesh.name} on {unweighted_to}")

    for v_idx, tw in enumerate(target_weights):
        items = sorted(tw.items(), key=lambda x: x[1], reverse=True)[:4]
        total = sum(w for _, w in items)
        if total > 1e-6:
            for tgt, w in items:
                target_vgs[tgt].add([v_idx], w / total, "REPLACE")
        else:
            target_vgs[unweighted_to].add([v_idx], 1.0, "REPLACE")

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)


def _srgb_byte(c: float) -> int:
    """Linear channel to the 0-255 byte three's Color.getHex() gives (sRGB encode, clamp, round)."""
    c = max(0.0, min(1.0, c))
    e = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1.0 / 2.4)) - 0.055
    return int(math.floor(max(0.0, min(1.0, e)) * 255.0 + 0.5))


def exported_emission(mat) -> tuple[list[float], float] | None:
    """
    The emissive factor and KHR_materials_emissive_strength the glTF exporter writes for mat
    (io_scene_gltf2 material/extensions/emission.py), for the one node graph the builders use:
    a Principled BSDF or Emission node, not muted, whose emission colour and strength inputs
    are unlinked, linked straight (unmuted link) into the Surface of an active, unmuted
    Material Output. The factor is colour times strength; if any channel exceeds 1 it is
    divided by its maximum and that maximum becomes the strength, else the strength is 1
    (no extension). Returns None for no material or a zero factor (the exporter writes none).
    Raises ValueError on every other graph, which this function cannot mirror: no node tree,
    no active output, Surface unlinked or fed by any other node (a Mix or Add shader), a
    linked colour or strength input, a muted node or link. Nodes not linked to the output
    are ignored, as the exporter ignores them.
    """
    if mat is None:
        return None

    def refuse(why):
        raise ValueError(f"exported_emission: material {mat.name!r}: {why}; only an unlinked Principled BSDF or Emission node wired straight into the active Material Output is supported")

    if mat.node_tree is None:
        refuse("no node tree")
    out = next((n for n in mat.node_tree.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
    if out is None:
        refuse("no active Material Output")
    if out.mute:
        refuse("the Material Output is muted")
    links = out.inputs["Surface"].links
    if not links:
        refuse("Surface is not linked")
    if links[0].is_muted:
        refuse("the Surface link is muted")
    node = links[0].from_node
    if node.type == "BSDF_PRINCIPLED":
        color_sock, strength_sock = node.inputs["Emission Color"], node.inputs["Emission Strength"]
    elif node.type == "EMISSION":
        color_sock, strength_sock = node.inputs["Color"], node.inputs["Strength"]
    else:
        refuse(f"Surface is fed by a {node.type} node")
    if node.mute:
        refuse(f"node {node.name!r} is muted")
    if color_sock.is_linked or strength_sock.is_linked:
        refuse(f"an emission input of {node.name!r} is linked")
    color = [float(c) for c in color_sock.default_value[:3]]
    strength = float(strength_sock.default_value)
    factor = [c * strength for c in color]
    if factor == [0.0, 0.0, 0.0]:
        return None
    peak = max(factor)
    if peak > 1.0:
        return [f / peak for f in factor], peak
    return factor, 1.0


def engine_emissive_hex(mat) -> int | None:
    """
    Mirror of extractEmissiveHex in src/engine/blenderMonsters.ts: three reads the exported
    factor as linear, getHex() sRGB-encodes it, and the engine takes it when hex > 0 and
    emissiveIntensity (the extension's strength, else 1) > 0.05.
    """
    e = exported_emission(mat)
    if e is None:
        return None
    factor, intensity = e
    r, g, b = (_srgb_byte(c) for c in factor)
    hex_ = (r << 16) | (g << 8) | b
    return hex_ if hex_ > 0 and intensity > 0.05 else None


def get_material_family(obj: bpy.types.Object) -> str:
    """
    Engine material family rule from blenderMonsters.ts 103-136.
    Classifies mesh into one of: 'eye', 'glow', 'skin', 'cloth', 'leather',
    'wood', 'bark', 'moss', 'stone', 'metal', or 'plain'.
    Every material slot is classified; a mesh whose slots fall in more than one family
    raises, naming the mesh and the families (merging it would recolour faces).
    """
    mats = list(obj.data.materials) if obj.data else []
    families = {_material_family(obj.name, m) for m in (mats or [None])}
    if len(families) > 1:
        raise ValueError(f"get_material_family: mesh {obj.name!r} has materials in several families {sorted(families)}")
    return families.pop()


def _material_family(obj_name: str, mat) -> str:
    mesh_name = obj_name.lower()
    mat_name = mat.name.lower() if mat else ""

    is_emissive = engine_emissive_hex(mat) is not None

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
    Every non-kept mesh, alone or merged, ends with one material slot. Any input mesh whose
    materials fall in more than one family raises (get_material_family).
    """
    meshes = get_descendant_meshes(root)
    if not meshes:
        return []

    to_merge = []
    kept_alone = []
    for m in meshes:
        get_material_family(m)  # refuses a mesh with materials in several families, kept or not
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
        target = group_objs[0]
        if len(group_objs) > 1:
            _join_group(group_objs, key)

        # One material slot per merged family, so one primitive and one draw call; a lone
        # mesh with several slots of one family collapses too.
        if len(target.data.materials) > 1:
            first = target.data.materials[0]
            for poly in target.data.polygons:
                poly.material_index = 0
            target.data.materials.clear()
            target.data.materials.append(first)

        result.append(target)

    bpy.context.view_layer.update()
    return result


def _join_group(group_objs, key) -> None:
    """Joins group_objs into group_objs[0], keeping every extra (conflicts raise) and re-parenting children."""
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
    Bone names are the rig's own bone names (with prefix); a name the rig lacks raises.
    pose_table forms:
      callable(u) -> {bone: triple}, u in 0..1
      {frame: {bone: triple}}                 (int keys)
      {bone: triple}                          constant on every frame
      {bone: [triple] * (frames + 1)}         one triple per frame
      {bone: {frame: triple}}
    """
    if frames < 1:
        raise ValueError(f"make_clip: frames must be at least 1, got {frames}")

    def is_triple(v):
        return isinstance(v, (list, tuple)) and len(v) == 3 and all(isinstance(x, (int, float)) for x in v)

    def pose_at(f):
        if callable(pose_table):
            return pose_table(f / frames)
        if not isinstance(pose_table, dict):
            raise TypeError(f"make_clip: Unrecognised pose_table type {type(pose_table)}")
        if pose_table and all(isinstance(k, int) for k in pose_table):
            return pose_table.get(f, {})
        pose = {}
        for b, v in pose_table.items():
            if not isinstance(b, str):
                raise TypeError(f"make_clip: pose_table mixes frame and bone keys ({b!r})")
            if is_triple(v):
                pose[b] = v
            elif isinstance(v, dict):
                if f in v:
                    pose[b] = v[f]
            elif isinstance(v, (list, tuple)):
                if len(v) != frames + 1:
                    raise ValueError(f"make_clip: bone {b!r} has {len(v)} per-frame triples, expected {frames + 1}")
                pose[b] = v[f]
            else:
                raise TypeError(f"make_clip: bone {b!r} has an unrecognised value {v!r}")
        return pose

    # Resolve and validate every frame before touching the rig.
    poses = [pose_at(f) for f in range(frames + 1)]
    for f, pose in enumerate(poses):
        for b_name, rot in pose.items():
            if rig.pose.bones.get(b_name) is None:
                raise ValueError(f"make_clip: rig {rig.name!r} has no bone {b_name!r} (frame {f}, clip {name!r})")
            if not is_triple(rot):
                raise TypeError(f"make_clip: rotation of {b_name!r} at frame {f} must be 3 numbers, got {rot!r}")

    if rig.animation_data is None:
        rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action

    for f, pose in enumerate(poses):
        for b_name, (rx, ry, rz) in pose.items():
            pb = rig.pose.bones[b_name]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = Euler((rx, ry, rz), "XZY").to_quaternion()
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
