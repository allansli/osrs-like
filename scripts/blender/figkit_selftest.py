"""
Self-test for figkit: verifies merge_parts, bake_paint, and export_glb.
Asserts on a generated two-part figure and edge cases, exits non-zero on failure.
"""

import json
import math
import os
import struct
import sys
import bpy
from mathutils import Vector, Euler, Quaternion

sys.dont_write_bytecode = True

sys.path.append(os.path.dirname(__file__))
import figkit
import paths
import rigs


def clear_scene():
    bpy.ops.object.select_all(action="DESELECT")
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)


def create_mesh_box(name, parent, mat, center=(0, 0, 0), size=(0.4, 0.4, 0.4), no_outline=False, extras=None):
    cx, cy, cz = center
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
    verts = [
        (cx - sx, cy - sy, cz - sz),
        (cx + sx, cy - sy, cz - sz),
        (cx + sx, cy + sy, cz - sz),
        (cx - sx, cy + sy, cz - sz),
        (cx - sx, cy - sy, cz + sz),
        (cx + sx, cy - sy, cz + sz),
        (cx + sx, cy + sy, cz + sz),
        (cx - sx, cy + sy, cz + sz),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.uv_layers.new()

    obj = bpy.data.objects.new(name, mesh)
    if parent is not None:
        obj.parent = parent
    if mat is not None:
        obj.data.materials.append(mat)
    if no_outline:
        obj["noOutline"] = True
    if extras:
        for k, v in extras.items():
            obj[k] = v

    bpy.context.collection.objects.link(obj)
    return obj


def parse_glb(path: str) -> dict:
    """Read JSON chunk from binary glTF (GLB)."""
    with open(path, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        if magic != b"glTF":
            raise ValueError(f"Not a glTF file: {magic}")
        chunk_len, chunk_type = struct.unpack("<I4s", f.read(8))
        if chunk_type != b"JSON":
            raise ValueError(f"First chunk is not JSON: {chunk_type}")
        json_bytes = f.read(chunk_len)
        return json.loads(json_bytes.decode("utf-8"))


def test_two_part_figure():
    """
    Asserts on a generated two-part figure:
    Exports with COLOR_0, no TEXCOORD_0, and half the meshes.
    """
    print("[figkit_selftest] Testing standalone two-part figure...")
    clear_scene()

    mat = bpy.data.materials.new("mat_twopart")
    root = bpy.data.objects.new("TwoPartFigure", None)
    bpy.context.collection.objects.link(root)

    # Two parts sharing parent, material, noOutline=False, class 'other'
    p1 = create_mesh_box("Part_Lower", root, mat, center=(0, 0, 0.4), size=(0.4, 0.4, 0.4), )
    p2 = create_mesh_box("Part_Upper", root, mat, center=(0, 0, 0.8), size=(0.4, 0.4, 0.4), extras={"tag": "twopart"})

    meshes_before = [o for o in root.children if o.type == "MESH"]
    assert len(meshes_before) == 2, f"Expected 2 meshes before merge, got {len(meshes_before)}"

    # Merge
    surviving = figkit.merge_parts(root)
    assert len(surviving) == 1, f"Expected 1 mesh after merge (half the meshes), got {len(surviving)}"
    merged_obj = surviving[0]
    assert merged_obj.get("tag") == "twopart", "Extras should be preserved on merged object"

    # Bake paint
    figkit.bake_paint(root, ao=0.35, gradient=0.15, warm_cool=0.05)
    ca = merged_obj.data.color_attributes.get("Col")
    assert ca is not None, "Merged object missing 'Col' attribute"
    assert ca.domain == "POINT", f"Expected domain POINT, got {ca.domain}"

    # Export
    out_path = os.path.join(paths.out_dir(), "figkit_twopart.glb")
    figkit.export_glb(out_path)
    assert os.path.isfile(out_path), f"File was not exported: {out_path}"

    # Verify GLB
    doc = parse_glb(out_path)
    exported_meshes = doc.get("meshes", [])
    assert len(exported_meshes) == 1, f"Expected 1 exported mesh (half of 2), got {len(exported_meshes)}"

    prim = exported_meshes[0]["primitives"][0]
    attrs = prim.get("attributes", {})
    assert "COLOR_0" in attrs, f"Exported primitive missing COLOR_0: {attrs}"
    assert "TEXCOORD_0" not in attrs, f"Exported primitive has unwanted TEXCOORD_0: {attrs}"
    print("[figkit_selftest] Standalone two-part figure test passed!")


def test_toggled_and_edge_cases():
    """
    Asserts that a mesh named TorsoCoat survives a merge alone,
    gear leg meshes keep _04_ ordinals, gear non-leg _04_ meshes merge,
    eyes merge into eye class, and extras are preserved.
    """
    print("[figkit_selftest] Testing TOGGLED and edge cases...")
    clear_scene()

    mat_body = bpy.data.materials.new("mat_body")
    mat_wood = bpy.data.materials.new("mat_wood")
    mat_eye = bpy.data.materials.new("mat_eye")

    root = bpy.data.objects.new("FigureRoot", None)
    bpy.context.collection.objects.link(root)

    sub_pivot = bpy.data.objects.new("ArmPivot", None)
    sub_pivot.parent = root
    bpy.context.collection.objects.link(sub_pivot)

    # 1. Two body parts
    p1 = create_mesh_box("Part_A", root, mat_body, center=(0, 0, 0.5), size=(0.4, 0.4, 0.4), extras={"partTag": "body"})
    p2 = create_mesh_box("Part_B", root, mat_body, center=(0, 0, 0.9), size=(0.4, 0.4, 0.4), extras={"partB": "fromB"})

    # 2. TorsoCoat: shares parent, mat_body, noOutline=False, class 'other' -> matches TOGGLED -> MUST SURVIVE ALONE
    torso_coat = create_mesh_box("TorsoCoat", root, mat_body, center=(0, 0, 0.7), size=(0.45, 0.45, 0.5))

    # 3. Gear leg mesh matching _leg[LR]_04_ -> matches TOGGLED -> MUST SURVIVE ALONE, KEEPING _04_
    leg_mesh = create_mesh_box("Gear_trousers_legL_04_", root, mat_body, center=(-0.2, 0, 0.2), size=(0.2, 0.2, 0.4))

    # 4. Other gear _04_ meshes (not leg) -> MUST MERGE FREELY
    g1 = create_mesh_box("Gear_shield_04_a", root, mat_wood, center=(0.4, 0, 0.5), size=(0.1, 0.3, 0.3))
    g2 = create_mesh_box("Gear_shield_04_b", root, mat_wood, center=(0.4, 0.1, 0.5), size=(0.1, 0.1, 0.1))

    # 5. Eye meshes: class 'eye', noOutline=True -> MUST MERGE into class 'eye'
    eye_l = create_mesh_box("goblin_eye_L", root, mat_eye, center=(-0.1, 0.25, 1.2), size=(0.08, 0.08, 0.08), no_outline=True)
    eye_r = create_mesh_box("goblin_eye_R", root, mat_eye, center=(0.1, 0.25, 1.2), size=(0.08, 0.08, 0.08), no_outline=True)

    # 6. Different parent mesh under sub_pivot -> MUST NOT merge with root meshes
    sub_mesh = create_mesh_box("Hand", sub_pivot, mat_body, center=(0.5, 0, 0.5), size=(0.15, 0.15, 0.15))

    # 7. Different noOutline: mat_body mesh with noOutline=True -> MUST NOT merge with noOutline=False
    outline_diff = create_mesh_box("Accent", root, mat_body, center=(0, 0, 1.1), size=(0.1, 0.1, 0.1), no_outline=True)

    initial_meshes = [o for o in root.children if o.type == "MESH"]
    assert len(initial_meshes) == 9, f"Expected 9 initial meshes under root, got {len(initial_meshes)}"

    # Run merge_parts
    surviving = figkit.merge_parts(root)
    surviving_names = {o.name for o in surviving}
    print(f"[figkit_selftest] Surviving objects ({len(surviving)}): {sorted(surviving_names)}")

    # Assertions on merge_parts
    has_part_a = "Part_A" in surviving_names
    has_part_b = "Part_B" in surviving_names
    assert (has_part_a and not has_part_b) or (has_part_b and not has_part_a), (
        f"Two body parts should merge into 1 mesh: Part_A={has_part_a}, Part_B={has_part_b}"
    )
    merged_body = bpy.data.objects["Part_A" if has_part_a else "Part_B"]
    assert merged_body.get("partTag") == "body", "Extras should be preserved on merged object"
    assert merged_body.get("partB") == "fromB", "Extras of a non-target merged part must survive the merge"

    # TorsoCoat survived alone
    assert "TorsoCoat" in surviving_names, "TorsoCoat MUST survive merge alone"
    tc_obj = bpy.data.objects["TorsoCoat"]
    assert tc_obj.parent == root, "TorsoCoat must keep its parent"

    # Leg _04_ mesh survived alone with _04_ intact
    assert "Gear_trousers_legL_04_" in surviving_names, "Gear leg _04_ mesh MUST survive alone"

    # Gear non-leg _04_ meshes merged
    has_g1 = "Gear_shield_04_a" in surviving_names
    has_g2 = "Gear_shield_04_b" in surviving_names
    assert (has_g1 and not has_g2) or (has_g2 and not has_g1), "Non-leg _04_ meshes must merge freely"

    # Eyes merged into 1 mesh
    has_el = "goblin_eye_L" in surviving_names
    has_er = "goblin_eye_R" in surviving_names
    assert (has_el and not has_er) or (has_er and not has_el), "Eye meshes must merge into one"
    merged_eye = bpy.data.objects["goblin_eye_L" if has_el else "goblin_eye_R"]
    assert bool(merged_eye.get("noOutline", False)) is True, "Merged eye must keep noOutline=True"
    assert figkit.get_name_class(merged_eye.name) == "eye", "Merged eye must keep name in class 'eye'"

    # Different parent was not merged into root
    assert "Hand" in [o.name for o in sub_pivot.children if o.type == "MESH"], "Mesh under sub_pivot must keep sub_pivot parent"

    # Different noOutline was not merged
    assert "Accent" in surviving_names, "Mesh with different noOutline must not be merged"

    # Test bake_paint fast_paint
    figkit.bake_paint(root, ao=0.35, gradient=0.15, warm_cool=0.05, fast_paint=True)
    for obj in figkit.get_descendant_meshes(root):
        ca = obj.data.color_attributes.get("Col")
        assert ca is not None, f"Object {obj.name} missing 'Col' attribute"
        assert ca.domain == "POINT", f"Object {obj.name} 'Col' domain is {ca.domain}, expected POINT"

    # Test bake_paint Cycles AO bake
    figkit.bake_paint(root, ao=0.35, gradient=0.15, warm_cool=0.05, fast_paint=False)
    for obj in figkit.get_descendant_meshes(root):
        ca = obj.data.color_attributes.get("Col")
        assert ca is not None, f"Object {obj.name} missing 'Col' attribute"
        assert ca.domain == "POINT", f"Object {obj.name} 'Col' domain is {ca.domain}, expected POINT"
        for col_item in ca.data:
            r, g, b, a = col_item.color
            assert 0.0 <= r <= 1.0 and 0.0 <= g <= 1.0 and 0.0 <= b <= 1.0, f"Color out of bounds: {col_item.color}"

    # Export GLB and test structure
    out_path = os.path.join(paths.out_dir(), "figkit_selftest.glb")
    figkit.export_glb(out_path)
    assert os.path.isfile(out_path), f"File was not exported: {out_path}"

    doc = parse_glb(out_path)
    for mesh in doc.get("meshes", []):
        for prim in mesh.get("primitives", []):
            attrs = prim.get("attributes", {})
            assert "COLOR_0" in attrs, f"Primitive missing COLOR_0: {attrs}"
            assert "TEXCOORD_0" not in attrs, f"Primitive has unwanted TEXCOORD_0: {attrs}"

    print("[figkit_selftest] TOGGLED and edge cases test passed!")


def test_conflict_reparent_keep():
    print("[figkit_selftest] Testing extras conflict, child re-parenting, bad keep...")
    clear_scene()
    mat = bpy.data.materials.new("mat_c")
    root = bpy.data.objects.new("CRoot", None)
    bpy.context.collection.objects.link(root)

    # Conflicting extras raise and name the key
    create_mesh_box("C_A", root, mat, extras={"slot": 1})
    create_mesh_box("C_B", root, mat, center=(0, 0, 0.5), extras={"slot": 2})
    try:
        figkit.merge_parts(root)
    except ValueError as e:
        assert "slot" in str(e), f"Conflict error must name the key: {e}"
    else:
        raise AssertionError("merge_parts must raise on conflicting extras values")

    # Equal list- and dict-valued extras are not a conflict
    clear_scene()
    mat = bpy.data.materials.new("mat_e")
    root = bpy.data.objects.new("ERoot", None)
    bpy.context.collection.objects.link(root)
    create_mesh_box("E_A", root, mat, extras={"v": [1.0, 2.0], "d": {"a": 1}})
    create_mesh_box("E_B", root, mat, center=(0, 0, 0.5), extras={"v": [1.0, 2.0], "d": {"a": 1}})
    surviving = figkit.merge_parts(root)
    assert len(surviving) == 1, f"Equal array/dict extras must merge, got {len(surviving)}"
    assert list(surviving[0]["v"]) == [1.0, 2.0], "List extra must survive the merge"

    # Child of a joined-away mesh is re-parented to the target, world position kept
    clear_scene()
    mat = bpy.data.materials.new("mat_d")
    root = bpy.data.objects.new("DRoot", None)
    bpy.context.collection.objects.link(root)
    a = create_mesh_box("D_A", root, mat)
    b = create_mesh_box("D_B", root, mat, center=(0, 0, 0.5))
    b.location = (1.0, 0.0, 0.0)
    child = bpy.data.objects.new("D_Child", None)
    child.parent = b
    child.location = (0.0, 2.0, 0.0)
    bpy.context.collection.objects.link(child)
    bpy.context.view_layer.update()
    before = child.matrix_world.translation.copy()
    surviving = figkit.merge_parts(root)
    assert len(surviving) == 1, f"Expected 1 merged mesh, got {len(surviving)}"
    bpy.context.view_layer.update()
    assert child.parent == surviving[0], f"Child must be re-parented to join target, got {child.parent}"
    assert (child.matrix_world.translation - before).length < 1e-5, (
        f"Child world position moved: {before} -> {child.matrix_world.translation}"
    )

    # Unrecognised keep value raises TypeError
    try:
        figkit.matches_keep("X", 42)
    except TypeError:
        pass
    else:
        raise AssertionError("matches_keep must raise TypeError for an unrecognised keep value")
    print("[figkit_selftest] Conflict, re-parent and keep test passed!")


def read_glb(path: str) -> tuple[dict, bytes]:
    with open(path, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        if magic != b"glTF":
            raise ValueError(f"Not a glTF file: {magic}")
        chunk_len, chunk_type = struct.unpack("<I4s", f.read(8))
        json_bytes = f.read(chunk_len)
        doc = json.loads(json_bytes.decode("utf-8"))
        # Read BIN chunk if present
        bin_bytes = b""
        if f.tell() < length:
            bin_len, bin_type = struct.unpack("<I4s", f.read(8))
            bin_bytes = f.read(bin_len)
        return doc, bin_bytes


def read_accessor_data(doc: dict, bin_bytes: bytes, accessor_idx: int) -> list[tuple]:
    acc = doc["accessors"][accessor_idx]
    bv = doc["bufferViews"][acc["bufferView"]]
    offset = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    comp_type = acc["componentType"]
    type_str = acc["type"]
    num_comps = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[type_str]

    if comp_type == 5126:  # FLOAT
        fmt_char = "f"
    elif comp_type == 5123:  # UNSIGNED_SHORT
        fmt_char = "H"
    elif comp_type == 5121:  # UNSIGNED_BYTE
        fmt_char = "B"
    elif comp_type == 5125:  # UNSIGNED_INT
        fmt_char = "I"
    elif comp_type == 5120:  # BYTE
        fmt_char = "b"
    elif comp_type == 5122:  # SHORT
        fmt_char = "h"
    else:
        raise ValueError(f"Unknown componentType: {comp_type}")

    fmt = f"<{num_comps}{fmt_char}"
    stride = bv.get("byteStride", struct.calcsize(fmt))

    vals = []
    for i in range(count):
        cur = offset + i * stride
        vals.append(struct.unpack(fmt, bin_bytes[cur : cur + struct.calcsize(fmt)]))
    return vals


def read_accessor_floats(doc: dict, bin_bytes: bytes, accessor_idx: int) -> list[tuple[float, ...]]:
    return read_accessor_data(doc, bin_bytes, accessor_idx)


def test_rigs_and_directions():
    print("[figkit_selftest] Testing rigs and limb directions...")
    clear_scene()

    # Valid joints matching BIPED_TABLE reference pose within 20 deg
    joints = {
        "Root": (0.0, 0.0, 0.0),
        "Hips": (0.0, 0.0, 0.963),
        "Torso": (0.0, 0.0, 1.146),
        "HeadGroup": (0.0, 0.0, 1.504),
        "LeftArmPivot": (-0.178, 0.0, 1.478),
        "LeftElbowPivot": (-0.31, 0.0, 1.229),
        "LeftHand": (-0.44, 0.0, 1.02),
        "RightArmPivot": (0.178, 0.0, 1.478),
        "RightElbowPivot": (0.31, 0.0, 1.229),
        "RightHand": (0.44, 0.0, 1.02),
        "LeftLegPivot": (-0.111, 0.0, 1.007),
        "LeftKneePivot": (-0.186, 0.0, 0.604),
        "LeftFoot": (-0.186, 0.0, 0.166),
        "RightLegPivot": (0.111, 0.0, 1.007),
        "RightKneePivot": (0.186, 0.0, 0.604),
        "RightFoot": (0.186, 0.0, 0.166),
    }

    rig = figkit.make_rig("TestBipedRig", rigs.BIPED_TABLE, joints)
    assert rig.location == Vector((0.0, 0.0, 0.0)), f"Armature not at origin: {rig.location}"
    assert rig.rotation_euler == Euler((0.0, 0.0, 0.0)), f"Armature has non-zero rotation: {rig.rotation_euler}"
    assert rig.scale == Vector((1.0, 1.0, 1.0)), f"Armature scale is not 1: {rig.scale}"

    # Every bone points straight up (+Z) with roll 0
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for eb in rig.data.edit_bones:
        diff = eb.tail - eb.head
        assert diff.x == 0.0 and diff.y == 0.0 and diff.z > 0.0, f"Bone {eb.name} does not point straight up: {diff}"
        assert eb.roll == 0.0, f"Bone {eb.name} has non-zero roll: {eb.roll}"
    bpy.ops.object.mode_set(mode="OBJECT")

    # Refusal of joints deviating > 20 degrees from reference pose
    bad_joints = dict(joints)
    bad_joints["LeftElbowPivot"] = (-0.178, 0.5, 1.478)
    try:
        figkit.make_rig("BadRig", rigs.BIPED_TABLE, bad_joints)
    except ValueError as e:
        assert "deviates" in str(e), f"Expected deviation error message, got: {e}"
    else:
        raise AssertionError("make_rig must raise ValueError when limb direction deviates > 20 degrees")

    # Flag code_posed allows deviation
    code_posed_table = [
        rigs.BoneDef("Root", None, optional=False, ref_dir=(0.0, 0.0, 1.0)),
        rigs.BoneDef("LeftArmPivot", "Root", optional=False, ref_dir=(-0.468, 0.0, -0.884)),
        rigs.BoneDef("LeftElbowPivot", "LeftArmPivot", optional=False, flag="code_posed", ref_dir=(-0.528, 0.0, -0.849)),
    ]
    cp_rig = figkit.make_rig("CodePosedRig", code_posed_table, bad_joints)
    assert cp_rig is not None
    print("[figkit_selftest] Rigs and limb directions test passed!")


def test_skinned_figure_build_and_export():
    """
    Builds a two-limb skinned figure with one clip and asserts, on exported file:
    - armature node has no transform;
    - pose table entry (0.3, 0.5, 0.7) on a bone exports same quaternion as empty keyed by build_action (within 1e-5);
    - every joint has identity rotation;
    - no unweighted vertex;
    - at most 4 influences;
    - clip has rotation channels only;
    - part given hard_weights has weight 1 on its bone.
    """
    print("[figkit_selftest] Testing two-limb skinned figure build and export...")
    clear_scene()

    table = [
        rigs.BoneDef("Bone1", None, optional=False, ref_dir=(0.0, 0.0, 1.0)),
        rigs.BoneDef("Bone2", "Bone1", optional=False, ref_dir=(0.0, 0.0, 1.0)),
    ]
    joints = {
        "Bone1": (0.0, 0.0, 0.0),
        "Bone2": (0.0, 0.0, 0.5),
    }

    rig = figkit.make_rig("TwoLimbArmature", table, joints)

    # Build organic body for the two limbs
    graph = ([(0.0, 0.0, 0.0), (0.0, 0.0, 0.5), (0.0, 0.0, 1.0)], [(0, 1), (1, 2)])
    body = figkit.organic_body(graph, 0.12, voxel=0.04, triangles=120)
    mat_skin = bpy.data.materials.new("mat_skin_body")
    body.data.materials.append(mat_skin)

    # Automatic weights
    figkit.auto_weights(body, rig)

    # Create an accessory part and assign hard weights to Bone2
    mat_metal = bpy.data.materials.new("mat_iron_plate")
    acc = create_mesh_box("Accessory", rig, mat_metal, center=(0.0, 0.0, 0.7), size=(0.1, 0.1, 0.1))
    figkit.hard_weights(acc, "Bone2")
    acc.parent = rig
    mod_acc = acc.modifiers.new("Armature", "ARMATURE")
    mod_acc.object = rig

    # Key clip with pose table entry (0.3, 0.5, 0.7) on Bone2
    pose_table = {
        0: {"Bone2": (0.0, 0.0, 0.0)},
        1: {"Bone2": (0.3, 0.5, 0.7)},
    }
    figkit.make_clip(rig, "TwoLimbClip", 1, pose_table)

    # Reference empty keyed the way build_hero.py keys pivots (t2b_euler + XYZ Euler)
    def t2b_euler(rx, ry, rz):
        return (rx, -rz, ry)

    ref_empty = bpy.data.objects.new("RefEmpty", None)
    bpy.context.collection.objects.link(ref_empty)
    ref_empty.animation_data_create()
    ref_act = bpy.data.actions.new("RefAction")
    ref_empty.animation_data.action = ref_act
    # frame 0: 0, frame 1: (0.3, 0.5, 0.7)
    ref_empty.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
    ref_empty.keyframe_insert("rotation_euler", frame=0)
    bx, by, bz = t2b_euler(0.3, 0.5, 0.7)
    ref_empty.rotation_euler = Euler((bx, by, bz), "XYZ")
    ref_empty.keyframe_insert("rotation_euler", frame=1)
    ref_track = ref_empty.animation_data.nla_tracks.new()
    ref_track.name = "RefTrack"
    ref_track.strips.new("RefStrip", 0, ref_act)
    ref_empty.animation_data.action = None

    # Export to GLB
    out_path = os.path.join(paths.out_dir(), "figkit_skinned_selftest.glb")
    figkit.export_glb(out_path)
    assert os.path.isfile(out_path), f"File not exported: {out_path}"

    # Read back GLB and assert structure
    doc, bin_bytes = read_glb(out_path)

    # 1. Armature node has no transform
    nodes_by_name = {n.get("name"): n for n in doc.get("nodes", [])}
    arm_node = nodes_by_name.get("TwoLimbArmature")
    assert arm_node is not None, "Missing TwoLimbArmature node in GLB"
    assert "translation" not in arm_node or arm_node["translation"] == [0.0, 0.0, 0.0], f"Armature has translation: {arm_node}"
    assert "rotation" not in arm_node or arm_node["rotation"] == [0.0, 0.0, 0.0, 1.0], f"Armature has rotation: {arm_node}"
    assert "scale" not in arm_node or arm_node["scale"] == [1.0, 1.0, 1.0], f"Armature has scale: {arm_node}"

    # 2. Every joint has identity rotation in rest pose
    for b_name in ("Bone1", "Bone2"):
        b_node = nodes_by_name.get(b_name)
        assert b_node is not None, f"Missing joint node {b_name} in GLB"
        assert "rotation" not in b_node or b_node["rotation"] == [0.0, 0.0, 0.0, 1.0], (
            f"Joint {b_name} has non-identity rest rotation: {b_node.get('rotation')}"
        )

    # 3. Weights and influences on skinned meshes
    skins = doc.get("skins", [])
    assert len(skins) >= 1, f"Expected at least 1 skin, got {len(skins)}"
    skin = skins[0]
    skin_joints = skin["joints"]
    joint_node_names = [doc["nodes"][j]["name"] for j in skin_joints]
    bone2_skin_idx = joint_node_names.index("Bone2")

    for mesh in doc.get("meshes", []):
        for prim in mesh.get("primitives", []):
            attrs = prim.get("attributes", {})
            if "JOINTS_0" in attrs and "WEIGHTS_0" in attrs:
                w_acc_idx = attrs["WEIGHTS_0"]
                weights_list = read_accessor_floats(doc, bin_bytes, w_acc_idx)
                for w4 in weights_list:
                    w_sum = sum(w4)
                    assert abs(w_sum - 1.0) < 0.02, f"Weights do not sum to 1.0: {w4} (sum={w_sum})"
                    influences = sum(1 for w in w4 if w > 1e-4)
                    assert influences <= 4, f"More than 4 influences: {w4}"
                    assert influences > 0, f"Unweighted vertex found: {w4}"

    # 4. Part given hard_weights has weight 1 on Bone2
    acc_mesh = None
    for n in doc.get("nodes", []):
        if n.get("name") == "Accessory" and "mesh" in n:
            acc_mesh = doc["meshes"][n["mesh"]]
            break
    assert acc_mesh is not None, "Accessory mesh not found"
    acc_prim = acc_mesh["primitives"][0]
    acc_attrs = acc_prim["attributes"]
    assert "JOINTS_0" in acc_attrs and "WEIGHTS_0" in acc_attrs, "Accessory missing skin attributes"
    acc_weights = read_accessor_floats(doc, bin_bytes, acc_attrs["WEIGHTS_0"])
    acc_joints = read_accessor_floats(doc, bin_bytes, acc_attrs["JOINTS_0"])
    for j4, w4 in zip(acc_joints, acc_weights):
        # Bone2 must carry weight 1.0
        found_bone2 = False
        for j_val, w_val in zip(j4, w4):
            if int(round(j_val)) == bone2_skin_idx and abs(w_val - 1.0) < 1e-3:
                found_bone2 = True
                break
        assert found_bone2, f"Accessory vertex does not have weight 1.0 on Bone2: joints={j4}, weights={w4}"

    # 5. Clip has rotation channels only
    anims = doc.get("animations", [])
    clip_anim = next((a for a in anims if a.get("name") == "TwoLimbClip"), None)
    assert clip_anim is not None, f"Clip TwoLimbClip not found in animations: {[a.get('name') for a in anims]}"
    for ch in clip_anim.get("channels", []):
        assert ch["target"]["path"] == "rotation", f"Non-rotation channel found: {ch}"

    # 6. Pose table entry (0.3, 0.5, 0.7) on Bone2 exports same quaternion as empty keyed by build_action (within 1e-5)
    ref_anim = next((a for a in anims if "Ref" in a.get("name", "")), None)
    assert ref_anim is not None, "Ref animation not found"
    ref_ch = ref_anim["channels"][0]
    ref_sampler = ref_anim["samplers"][ref_ch["sampler"]]
    ref_quats = read_accessor_floats(doc, bin_bytes, ref_sampler["output"])
    ref_q_at_1 = ref_quats[1]  # frame 1

    bone2_node_idx = next(i for i, n in enumerate(doc["nodes"]) if n.get("name") == "Bone2")
    bone2_ch = next(ch for ch in clip_anim["channels"] if ch["target"]["node"] == bone2_node_idx)
    bone2_sampler = clip_anim["samplers"][bone2_ch["sampler"]]
    bone2_quats = read_accessor_floats(doc, bin_bytes, bone2_sampler["output"])
    bone2_q_at_1 = bone2_quats[1]  # frame 1

    print(f"[figkit_selftest] Bone2 quat at frame 1: {bone2_q_at_1}")
    print(f"[figkit_selftest] RefEmpty quat at frame 1: {ref_q_at_1}")
    for i in range(4):
        diff = abs(bone2_q_at_1[i] - ref_q_at_1[i])
        assert diff < 1e-5, f"Quaternion mismatch at component {i}: bone={bone2_q_at_1[i]}, ref={ref_q_at_1[i]}, diff={diff}"

    print("[figkit_selftest] Two-limb skinned figure build and export test passed!")


def test_merge_by_family_and_bone_parenting():
    """
    Asserts that merge_by_family groups meshes by:
    parent object AND parent_type AND parent_bone AND material family AND outline flag.
    Specifically asserts that meshes parented to different bones of one armature NEVER merge,
    and meshes matching TOGGLED survive alone.
    """
    print("[figkit_selftest] Testing merge_by_family and bone parenting...")
    clear_scene()

    table = [
        rigs.BoneDef("BoneA", None, optional=False, ref_dir=(0.0, 0.0, 1.0)),
        rigs.BoneDef("BoneB", None, optional=False, ref_dir=(0.0, 0.0, 1.0)),
    ]
    joints = {"BoneA": (-0.3, 0.0, 0.5), "BoneB": (0.3, 0.0, 0.5)}
    rig = figkit.make_rig("TestRigFamily", table, joints)

    mat_skin_1 = bpy.data.materials.new("mat_skin_1")
    mat_skin_2 = bpy.data.materials.new("mat_skin_2")
    mat_iron = bpy.data.materials.new("mat_iron_plate")

    # Meshes parented to BoneA with skin family
    mA1 = create_mesh_box("mA1", rig, mat_skin_1, center=(-0.3, 0.0, 0.4), size=(0.2, 0.2, 0.2))
    mA1.parent_type = "BONE"
    mA1.parent_bone = "BoneA"

    mA2 = create_mesh_box("mA2", rig, mat_skin_2, center=(-0.3, 0.0, 0.6), size=(0.2, 0.2, 0.2))
    mA2.parent_type = "BONE"
    mA2.parent_bone = "BoneA"

    # Mesh parented to BoneB with skin family -> MUST NEVER MERGE with BoneA meshes
    mB1 = create_mesh_box("mB1", rig, mat_skin_1, center=(0.3, 0.0, 0.5), size=(0.2, 0.2, 0.2))
    mB1.parent_type = "BONE"
    mB1.parent_bone = "BoneB"

    # Mesh parented to BoneA with iron/metal family -> MUST NOT MERGE with skin family
    mA_metal = create_mesh_box("mA_metal", rig, mat_iron, center=(-0.3, 0.1, 0.5), size=(0.15, 0.15, 0.15))
    mA_metal.parent_type = "BONE"
    mA_metal.parent_bone = "BoneA"

    # Mesh matching TOGGLED on BoneA -> MUST SURVIVE ALONE
    tc = create_mesh_box("TorsoCoat", rig, mat_skin_1, center=(-0.3, 0.0, 0.5), size=(0.22, 0.22, 0.22))
    tc.parent_type = "BONE"
    tc.parent_bone = "BoneA"

    surviving = figkit.merge_by_family(rig)
    surviving_names = {o.name for o in surviving}
    print(f"[figkit_selftest] Surviving family meshes ({len(surviving)}): {sorted(surviving_names)}")

    # mA1 and mA2 should have merged together
    has_a1 = "mA1" in surviving_names
    has_a2 = "mA2" in surviving_names
    assert (has_a1 and not has_a2) or (has_a2 and not has_a1), f"mA1 and mA2 must merge: a1={has_a1}, a2={has_a2}"

    # mB1 on BoneB MUST NOT have merged into BoneA
    assert "mB1" in surviving_names, "mB1 parented to BoneB must NOT merge with BoneA meshes"
    mb_obj = bpy.data.objects["mB1"]
    assert mb_obj.parent == rig and mb_obj.parent_type == "BONE" and mb_obj.parent_bone == "BoneB"

    # mA_metal MUST NOT have merged into skin family
    assert "mA_metal" in surviving_names, "mA_metal (metal family) must NOT merge with skin family"

    # TorsoCoat MUST survive alone
    assert "TorsoCoat" in surviving_names, "TorsoCoat matching TOGGLED must survive merge alone"
    tc_obj = bpy.data.objects["TorsoCoat"]
    assert tc_obj.parent == rig and tc_obj.parent_bone == "BoneA"

    print("[figkit_selftest] merge_by_family and bone parenting test passed!")


def test_fold_weights():
    print("[figkit_selftest] Testing fold_weights...")
    clear_scene()

    mesh_obj = create_mesh_box("MeshToFold", None, None)
    v1 = mesh_obj.vertex_groups.new(name="finger1")
    v2 = mesh_obj.vertex_groups.new(name="finger2")
    v3 = mesh_obj.vertex_groups.new(name="spine1")
    v4 = mesh_obj.vertex_groups.new(name="spine2")

    for v in mesh_obj.data.vertices:
        v1.add([v.index], 0.25, "REPLACE")
        v2.add([v.index], 0.25, "REPLACE")
        v3.add([v.index], 0.3, "REPLACE")
        v4.add([v.index], 0.2, "REPLACE")

    mapping = {
        "Hand": ["finger1", "finger2"],
        "Torso": ["spine1", "spine2"],
    }
    figkit.fold_weights(mesh_obj, mapping)

    vg_names = {vg.name for vg in mesh_obj.vertex_groups}
    assert vg_names == {"Hand", "Torso"}, f"Expected vertex groups {{Hand, Torso}}, got {vg_names}"

    for v in mesh_obj.data.vertices:
        w_hand = next(g.weight for g in v.groups if mesh_obj.vertex_groups[g.group].name == "Hand")
        w_torso = next(g.weight for g in v.groups if mesh_obj.vertex_groups[g.group].name == "Torso")
        assert abs(w_hand - 0.5) < 1e-4, f"Hand weight should be 0.5, got {w_hand}"
        assert abs(w_torso - 0.5) < 1e-4, f"Torso weight should be 0.5, got {w_torso}"
        assert abs(w_hand + w_torso - 1.0) < 1e-4

    print("[figkit_selftest] fold_weights test passed!")


if __name__ == "__main__":
    try:
        test_two_part_figure()
        test_toggled_and_edge_cases()
        test_conflict_reparent_keep()
        test_rigs_and_directions()
        test_skinned_figure_build_and_export()
        test_merge_by_family_and_bone_parenting()
        test_fold_weights()
        print("[figkit_selftest] ALL TESTS PASSED.")
        sys.exit(0)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[figkit_selftest] FAILED: {e}", file=sys.stderr)
        sys.exit(1)
