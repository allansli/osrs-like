"""
Self-test for figkit: verifies merge_parts, bake_paint, and export_glb.
Asserts on a generated two-part figure and edge cases, exits non-zero on failure.
"""

import contextlib
import io
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
        rigs.BoneDef("Root", None, optional=False),
        rigs.BoneDef("LeftArmPivot", "Root", optional=False, ref_dir=(-0.468, 0.0, -0.884), ref_child="LeftElbowPivot"),
        rigs.BoneDef("LeftElbowPivot", "LeftArmPivot", optional=False, flag="code_posed"),
    ]
    cp_joints = {k: bad_joints[k] for k in ("Root", "LeftArmPivot", "LeftElbowPivot")}
    cp_rig = figkit.make_rig("CodePosedRig", code_posed_table, cp_joints)
    assert cp_rig is not None

    # The row's own code_posed flag exempts it; the same row unflagged is refused.
    for flag, ok in (("code_posed", True), (None, False)):
        row_table = [
            rigs.BoneDef("Root", None),
            rigs.BoneDef("LeftArmPivot", "Root", flag=flag, ref_dir=(-0.468, 0.0, -0.884), ref_child="LeftElbowPivot"),
            rigs.BoneDef("LeftElbowPivot", "LeftArmPivot"),
        ]
        clear_scene()
        if ok:
            assert figkit.make_rig("RowPosed", row_table, cp_joints) is not None
        else:
            try:
                figkit.make_rig("RowUnposed", row_table, cp_joints)
            except ValueError as e:
                assert "LeftArmPivot" in str(e) and "deviates" in str(e), str(e)
            else:
                raise AssertionError("the same row without code_posed must be refused")

    # Unknown joint keys raise, bare or prefixed: a typo must not drop a joint.
    for prefix, typo in ((None, "LeftShouldr"), ("g", "g_LeftShouldr")):
        j = {(f"{prefix}_{k}" if prefix else k): v for k, v in joints.items()}
        j[typo] = (-0.09, 0.0, 1.478)
        clear_scene()
        try:
            figkit.make_rig("TypoRig", rigs.BIPED_TABLE, j, prefix=prefix)
        except ValueError as e:
            assert typo in str(e), str(e)
        else:
            raise AssertionError(f"make_rig must raise on the unknown joint key {typo!r}")
    clear_scene()
    assert "g_LeftArmPivot" in figkit.make_rig(
        "PrefixRig", rigs.BIPED_TABLE, {f"g_{k}": v for k, v in joints.items()}, prefix="g"
    ).data.bones

    # The 20 degree line: a limb 25 degrees off the reference is refused, 15 degrees is accepted.
    ref = Vector(rigs.BIPED_TABLE[[e.bone for e in rigs.BIPED_TABLE].index("LeftArmPivot")].ref_dir).normalized()

    def elbow_off_by(deg):
        q = Quaternion((0.0, 1.0, 0.0), math.radians(deg))
        return tuple(Vector(joints["LeftArmPivot"]) + (q @ ref) * 0.28)

    for deg, ok in ((25.0, False), (15.0, True), (20.5, False), (19.5, True)):
        j = dict(joints)
        j["LeftElbowPivot"] = elbow_off_by(deg)
        # The forearm moves with the elbow, so only the upper arm is off the reference.
        shift = Vector(j["LeftElbowPivot"]) - Vector(joints["LeftElbowPivot"])
        j["LeftHand"] = tuple(Vector(joints["LeftHand"]) + shift)
        measured = math.degrees((Vector(j["LeftElbowPivot"]) - Vector(j["LeftArmPivot"])).angle(ref))
        assert abs(measured - deg) < 0.01, f"fixture is {measured} degrees off, wanted {deg}"
        clear_scene()
        if ok:
            assert figkit.make_rig(f"Arm{int(deg)}", rigs.BIPED_TABLE, j) is not None
        else:
            try:
                figkit.make_rig(f"Arm{int(deg)}", rigs.BIPED_TABLE, j)
            except ValueError as e:
                assert "LeftArmPivot" in str(e) and "deviates" in str(e), str(e)
            else:
                raise AssertionError(f"a limb {deg} degrees off the reference pose must be refused")

    # A bone with several children: HeadGroup 90 degrees sideways of Torso is refused.
    side = dict(joints)
    side["HeadGroup"] = (joints["Torso"][0] + 0.358, 0.0, joints["Torso"][2])
    try:
        figkit.make_rig("SideHead", rigs.BIPED_TABLE, side)
    except ValueError as e:
        assert "'Torso' -> 'HeadGroup'" in str(e) and "deviates" in str(e), str(e)
    else:
        raise AssertionError("HeadGroup 90 degrees sideways of Torso must be refused")

    # Shoulders (design 6.1.2): between Torso and the arm bones when present, else the arms hang from Torso.
    clear_scene()
    plain = figkit.make_rig("NoShoulders", rigs.BIPED_TABLE, joints)
    assert plain.data.bones["LeftArmPivot"].parent.name == "Torso"
    assert plain.data.bones["RightArmPivot"].parent.name == "Torso"
    assert "LeftShoulder" not in plain.data.bones
    with_sh = dict(joints)
    with_sh["LeftShoulder"] = (-0.09, 0.0, 1.478)
    with_sh["RightShoulder"] = (0.09, 0.0, 1.478)
    shoulder_rig = figkit.make_rig("WithShoulders", rigs.BIPED_TABLE, with_sh)
    for side_name in ("Left", "Right"):
        bones = shoulder_rig.data.bones
        assert bones[f"{side_name}Shoulder"].parent.name == "Torso", side_name
        assert bones[f"{side_name}ArmPivot"].parent.name == f"{side_name}Shoulder", side_name
        assert bones[f"{side_name}ElbowPivot"].parent.name == f"{side_name}ArmPivot", side_name
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
        rigs.BoneDef("Bone1", None, optional=False, ref_dir=(0.0, 0.0, 1.0), ref_child="Bone2"),
        rigs.BoneDef("Bone2", "Bone1", optional=False),
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
    # Before export: exactly one group, named after the bone, weight 1.0 on every vertex
    assert [vg.name for vg in acc.vertex_groups] == ["Bone2"], [vg.name for vg in acc.vertex_groups]
    for v in acc.data.vertices:
        assert len(v.groups) == 1 and acc.vertex_groups[v.groups[0].group].name == "Bone2", f"vertex {v.index}"
        assert v.groups[0].weight == 1.0, f"vertex {v.index} has weight {v.groups[0].weight}"

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
        assert "extras" not in b_node, f"Joint {b_name} gained extras: {b_node['extras']}"
    assert "extras" not in arm_node, f"Armature node gained extras: {arm_node['extras']}"

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
        rigs.BoneDef("BoneA", None, optional=False),
        rigs.BoneDef("BoneB", None, optional=False),
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

    # A group the mapping does not list raises; so does a mapping in the other direction.
    clear_scene()
    m2 = create_mesh_box("FoldBad", None, None)
    m2.vertex_groups.new(name="finger1")
    m2.vertex_groups.new(name="stray")
    for v in m2.data.vertices:
        m2.vertex_groups["finger1"].add([v.index], 1.0, "REPLACE")
        m2.vertex_groups["stray"].add([v.index], 1.0, "REPLACE")
    try:
        figkit.fold_weights(m2, {"Hand": ["finger1"]})
    except ValueError as e:
        assert "stray" in str(e), str(e)
    else:
        raise AssertionError("fold_weights must raise on a source group missing from the mapping")
    try:
        figkit.fold_weights(m2, {"finger1": "Hand", "stray": "Hand"})
    except TypeError:
        pass
    else:
        raise AssertionError("fold_weights takes {target: [sources]} only")
    print("[figkit_selftest] fold_weights test passed!")


def test_four_influences():
    """Six bones around one body: automatic weights give more than 4 groups per vertex; auto_weights must cut them."""
    print("[figkit_selftest] Testing the 4-influence limit...")
    table = [rigs.BoneDef(f"B{i}", None) for i in range(6)]
    joints = {f"B{i}": (0.04 * (i - 2.5), 0.03 * ((i % 2) - 0.5), 0.05 + 0.03 * i) for i in range(6)}
    graph = ([(0, 0, 0), (0, 0, 0.15), (0, 0, 0.3)], [(0, 1), (1, 2)])

    # The fixture must be able to fail: raw automatic weights exceed 4 groups on some vertex.
    clear_scene()
    raw_rig = figkit.make_rig("RawRig", table, joints)
    raw_body = figkit.organic_body(graph, 0.12, voxel=0.03, triangles=150)
    bpy.ops.object.select_all(action="DESELECT")
    raw_body.select_set(True)
    raw_rig.select_set(True)
    bpy.context.view_layer.objects.active = raw_rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    raw_max = max(len(v.groups) for v in raw_body.data.vertices)
    assert raw_max > 4, f"fixture is too weak: raw automatic weights give at most {raw_max} groups"

    clear_scene()
    rig = figkit.make_rig("InfluenceRig", table, joints)
    body = figkit.organic_body(graph, 0.12, voxel=0.03, triangles=150)
    body.data.materials.append(bpy.data.materials.new("mat_skin_inf"))
    figkit.auto_weights(body, rig)
    worst = max(len(v.groups) for v in body.data.vertices)
    assert worst <= 4, f"a vertex has {worst} vertex groups after auto_weights"
    assert all(len(v.groups) >= 1 for v in body.data.vertices), "unweighted vertex"

    out_path = os.path.join(paths.out_dir(), "figkit_influence_selftest.glb")
    figkit.export_glb(out_path, export_all_influences=True)
    doc, bin_bytes = read_glb(out_path)
    prims = [pr for m in doc["meshes"] for pr in m["primitives"]]
    assert prims and all("JOINTS_0" in pr["attributes"] for pr in prims)
    for pr in prims:
        assert "WEIGHTS_1" not in pr["attributes"], f"file has WEIGHTS_1: {pr['attributes']}"
        assert "JOINTS_1" not in pr["attributes"], f"file has JOINTS_1: {pr['attributes']}"
    print("[figkit_selftest] 4-influence test passed!")


def _weights_box(name, weighted):
    """A unit-ish box on the z axis with group B0 = 0.7 on the vertices in `weighted`."""
    box = create_mesh_box(name, None, None, center=(0.0, 0.0, 0.25), size=(0.3, 0.3, 0.5))
    vg = box.vertex_groups.new(name="B0")
    for i in weighted:
        vg.add([i], 0.7, "REPLACE")
    return box


def _run_captured(fn, *a, **kw):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        result = fn(*a, **kw)
    return result, buf.getvalue()


def test_segment_weights():
    print("[figkit_selftest] Testing segment_weights...")
    two = [rigs.BoneDef("B0", None), rigs.BoneDef("B1", "B0")]
    clear_scene()
    rig = figkit.make_rig("SegRig", two, {"B0": (0.0, 0.0, 0.0), "B1": (0.0, 0.0, 0.5)})

    # Only the unweighted vertices are rewritten, and the call says it ran.
    box = _weights_box("SegBox", weighted=[0, 1, 2, 3])
    n, out = _run_captured(figkit.segment_weights, box, rig, 0.2)
    assert n == 4, f"expected 4 rewritten vertices, got {n}"
    assert "segment_weights ran on 4" in out, f"no print of the run: {out!r}"
    for i in range(4):
        v = box.data.vertices[i]
        assert len(v.groups) == 1 and abs(v.groups[0].weight - 0.7) < 1e-6, (
            f"weighted vertex {i} was rewritten: {[(g.group, g.weight) for g in v.groups]}"
        )
    for i in range(4, 8):
        v = box.data.vertices[i]
        total = sum(g.weight for g in v.groups)
        assert abs(total - 1.0) < 1e-5 and 1 <= len(v.groups) <= 2, f"vertex {i}: {[(g.group, g.weight) for g in v.groups]}"

    # The limb's radius is used: a larger radius on B1 pulls weight towards B1.
    def b0_weight(radii):
        b = _weights_box("RadiusBox", weighted=[])
        figkit.segment_weights(b, rig, radii)
        v = b.data.vertices[0]
        return next((g.weight for g in v.groups if b.vertex_groups[g.group].name == "B0"), 0.0)

    narrow = b0_weight({"B0": 0.1, "B1": 0.1})
    wide_b1 = b0_weight({"B0": 0.1, "B1": 0.6})
    assert wide_b1 < narrow - 0.01, f"a larger B1 radius must lower the B0 weight: {narrow} vs {wide_b1}"
    for bad in ({"B0": 0.1}, 0.0):
        try:
            figkit.segment_weights(_weights_box("BadRadius", weighted=[]), rig, bad)
        except ValueError:
            pass
        else:
            raise AssertionError(f"segment_weights must raise on limb_radius {bad!r}")

    # A one-bone rig.
    clear_scene()
    one = figkit.make_rig("OneRig", [rigs.BoneDef("B0", None)], {"B0": (0.0, 0.0, 0.0)})
    b = _weights_box("OneBox", weighted=[])
    n, out = _run_captured(figkit.segment_weights, b, one, 0.2)
    assert n == 8 and "segment_weights ran on 8" in out, (n, out)
    for v in b.data.vertices:
        assert len(v.groups) == 1 and v.groups[0].weight == 1.0, [(g.group, g.weight) for g in v.groups]

    # auto_weights reaches it: a body island far from every bone gets no automatic weight.
    clear_scene()
    rig = figkit.make_rig("IslandRig", two, {"B0": (0.0, 0.0, 0.0), "B1": (0.0, 0.0, 0.5)})
    graph = ([(0, 0, 0), (0, 0, 0.5), (0, 0, 1.0)], [(0, 1), (1, 2)])

    def island_body():
        body = figkit.organic_body(graph, 0.12, voxel=0.04, triangles=150)
        import bmesh
        from mathutils import Matrix
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bmesh.ops.create_cube(bm, size=0.1, matrix=Matrix.Translation((3.0, 0.0, 0.5)))
        bm.to_mesh(body.data)
        bm.free()
        return body

    try:
        figkit.auto_weights(island_body(), rig)
    except ValueError as e:
        assert "limb_radius" in str(e), str(e)
    else:
        raise AssertionError("auto_weights must raise when vertices are unweighted and no limb_radius is given")
    clear_scene()
    rig = figkit.make_rig("IslandRig2", two, {"B0": (0.0, 0.0, 0.0), "B1": (0.0, 0.0, 0.5)})
    body = island_body()
    try:
        figkit.auto_weights(body, rig, 0.2)
    except TypeError:
        pass
    else:
        raise AssertionError("limb_radius must be keyword-only")
    _, out = _run_captured(figkit.auto_weights, body, rig, limb_radius=0.2)
    assert "segment_weights ran on 8" in out, f"auto_weights did not run segment_weights on the island: {out!r}"
    for v in body.data.vertices:
        assert 1 <= len(v.groups) <= 4 and abs(sum(g.weight for g in v.groups) - 1.0) < 1e-4
    print("[figkit_selftest] segment_weights test passed!")


def test_organic_body_radii():
    print("[figkit_selftest] Testing organic_body radii...")
    clear_scene()
    graph = ([(0, 0, 0), (0, 0, 0.5), (0, 0, 1.0)], [(0, 1), (1, 2)])
    for bad in ({0: 0.1, 1: 0.1}, [0.1, 0.1]):
        try:
            figkit.organic_body(graph, bad, voxel=0.05, triangles=100)
        except ValueError as e:
            assert "radi" in str(e), str(e)
        else:
            raise AssertionError(f"organic_body must raise on missing radius {bad!r}")
    assert figkit.organic_body(graph, {0: 0.1, 1: 0.1, 2: 0.1}, voxel=0.05, triangles=100) is not None
    print("[figkit_selftest] organic_body radii test passed!")


def _clip_rig(prefix):
    clear_scene()
    table = [rigs.BoneDef("Bone1", None), rigs.BoneDef("Bone2", "Bone1")]
    return figkit.make_rig("ClipRig", table, {"Bone1": (0.0, 0.0, 0.0), "Bone2": (0.0, 0.0, 0.5)}, prefix=prefix)


def _clip_quat(rig, bone, frame):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    return Quaternion(rig.pose.bones[bone].rotation_quaternion)


def test_make_clip_forms_and_names():
    print("[figkit_selftest] Testing make_clip forms and bone names...")
    want = Euler((0.3, 0.5, 0.7), "XZY").to_quaternion()
    zero = Quaternion((1.0, 0.0, 0.0, 0.0))

    # Unknown names raise: a typo, and the bare name of a prefixed bone (no "_<name>" fallback).
    rig = _clip_rig("g")
    assert "g_Bone2" in rig.pose.bones
    actions_before = len(bpy.data.actions)
    for bad in ({"Bone2": (0.3, 0.5, 0.7)}, {"g_Bonee2": (0.3, 0.5, 0.7)}, {1: {"Nope": (0.1, 0.0, 0.0)}}):
        try:
            figkit.make_clip(rig, "Bad", 2, bad)
        except ValueError as e:
            assert "no bone" in str(e), str(e)
        else:
            raise AssertionError(f"make_clip must raise on an unknown bone: {bad!r}")
    assert len(bpy.data.actions) == actions_before, "a refused clip left an action behind"
    assert rig.animation_data is None or not rig.animation_data.nla_tracks

    # Constant triple on every frame.
    rig = _clip_rig(None)
    figkit.make_clip(rig, "Const", 2, {"Bone2": (0.3, 0.5, 0.7)})
    for f in (0, 1, 2):
        q = _clip_quat(rig, "Bone2", f)
        assert (q - want).magnitude < 1e-5, f"constant triple, frame {f}: {tuple(q)} vs {tuple(want)}"

    # One triple per frame.
    rig = _clip_rig(None)
    figkit.make_clip(rig, "PerFrame", 2, {"Bone2": [(0.0, 0.0, 0.0), (0.3, 0.5, 0.7), (0.0, 0.0, 0.0)]})
    for f, expect in ((0, zero), (1, want), (2, zero)):
        q = _clip_quat(rig, "Bone2", f)
        assert (q - expect).magnitude < 1e-5, f"per-frame list, frame {f}: {tuple(q)} vs {tuple(expect)}"
    try:
        figkit.make_clip(_clip_rig(None), "Short", 2, {"Bone2": [(0.0, 0.0, 0.0), (0.3, 0.5, 0.7)]})
    except ValueError as e:
        assert "per-frame" in str(e), str(e)
    else:
        raise AssertionError("a per-frame list of the wrong length must raise")

    # Frame-keyed form and prefixed full names still work.
    rig = _clip_rig("g")
    figkit.make_clip(rig, "Framed", 1, {0: {"g_Bone2": (0.0, 0.0, 0.0)}, 1: {"g_Bone2": (0.3, 0.5, 0.7)}})
    assert (_clip_quat(rig, "g_Bone2", 1) - want).magnitude < 1e-5
    print("[figkit_selftest] make_clip forms and names test passed!")


def _emissive_material(name, color=(1.0, 0.5, 0.0), strength=1.0, connected_node="BSDF_PRINCIPLED", extra_node_strength=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    pr = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    pr.inputs["Emission Color"].default_value = (*color, 1.0)
    pr.inputs["Emission Strength"].default_value = strength
    if connected_node == "EMISSION":
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (*color, 1.0)
        em.inputs["Strength"].default_value = strength
        nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
        pr.inputs["Emission Strength"].default_value = 0.0
    if extra_node_strength is not None:
        # An Emission node that is NOT linked to the output: the exporter ignores it.
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (1.0, 0.0, 0.0, 1.0)
        em.inputs["Strength"].default_value = extra_node_strength
    return mat


def test_family_emissive_mirrors_engine():
    """The family rule's emissive test mirrors extractEmissiveHex (blenderMonsters.ts) on what the exporter writes."""
    print("[figkit_selftest] Testing the emissive rule against the exported file...")
    clear_scene()
    cases = {
        "mat_plain_dim": dict(strength=0.03),
        "mat_plain_half": dict(strength=0.5),
        "mat_plain_bright": dict(color=(0.8, 0.4, 0.0), strength=2.0),
        "mat_plain_zero": dict(strength=0.0),
        "mat_plain_tiny": dict(color=(1.0, 0.0, 0.0), strength=0.0001),
        "mat_plain_node": dict(strength=3.0, connected_node="EMISSION"),
        "mat_plain_loose": dict(strength=0.0, extra_node_strength=5.0),
    }
    objs = {}
    for i, (name, kw) in enumerate(cases.items()):
        mat = _emissive_material(name, **kw)
        objs[name] = create_mesh_box(f"Blob{i}", None, mat, center=(i * 0.5, 0.0, 0.0), size=(0.2, 0.2, 0.2))
    out_path = os.path.join(paths.out_dir(), "figkit_emissive_selftest.glb")
    figkit.export_glb(out_path)
    doc = parse_glb(out_path)

    def srgb_byte(c):
        c = max(0.0, min(1.0, c))
        e = 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
        return math.floor(e * 255 + 0.5)

    exported = {m["name"]: m for m in doc["materials"]}
    for name, obj in objs.items():
        m = exported[name]
        factor = m.get("emissiveFactor", [0.0, 0.0, 0.0])
        ext = m.get("extensions", {}).get("KHR_materials_emissive_strength", {})
        intensity = ext.get("emissiveStrength", 1.0)
        hex_ = (srgb_byte(factor[0]) << 16) | (srgb_byte(factor[1]) << 8) | srgb_byte(factor[2])
        engine = hex_ if hex_ > 0 and intensity > 0.05 else None
        mat = obj.data.materials[0]
        assert figkit.engine_emissive_hex(mat) == engine, (
            f"{name}: engine rule gives {figkit.engine_emissive_hex(mat)}, exported file gives {engine} "
            f"(factor {factor}, strength {intensity})"
        )
        want_family = "glow" if engine is not None else "plain"
        assert figkit.get_material_family(obj) == want_family, f"{name}: family {figkit.get_material_family(obj)}"
    # The cases that pin the rule
    assert figkit.engine_emissive_hex(objs["mat_plain_dim"].data.materials[0]) is not None, "strength 0.03 is emissive for the engine"
    assert figkit.get_material_family(objs["mat_plain_dim"]) == "glow"
    assert figkit.engine_emissive_hex(objs["mat_plain_bright"].data.materials[0]) is not None
    assert figkit.engine_emissive_hex(objs["mat_plain_node"].data.materials[0]) is not None
    assert figkit.engine_emissive_hex(objs["mat_plain_tiny"].data.materials[0]) is None, "factor rounds to hex 0"
    assert figkit.engine_emissive_hex(objs["mat_plain_zero"].data.materials[0]) is None
    assert figkit.engine_emissive_hex(objs["mat_plain_loose"].data.materials[0]) is None, "a disconnected EMISSION node must not count"
    assert figkit.get_material_family(objs["mat_plain_loose"]) == "plain"
    print("[figkit_selftest] emissive rule test passed!")


def test_merge_by_family_single_primitive():
    print("[figkit_selftest] Testing merge_by_family collapses a family to one material...")
    clear_scene()
    root = bpy.data.objects.new("FamilyRoot", None)
    bpy.context.collection.objects.link(root)
    m1 = bpy.data.materials.new("mat_skin_a")
    m2 = bpy.data.materials.new("mat_skin_b")
    create_mesh_box("SkinA", root, m1, center=(0.0, 0.0, 0.2), size=(0.2, 0.2, 0.2))
    create_mesh_box("SkinB", root, m2, center=(0.0, 0.0, 0.6), size=(0.2, 0.2, 0.2))
    survivors = figkit.merge_by_family(root)
    assert len(survivors) == 1, [o.name for o in survivors]
    assert len(survivors[0].data.materials) == 1 and survivors[0].data.materials[0].name in ("mat_skin_a", "mat_skin_b")
    assert all(p.material_index == 0 for p in survivors[0].data.polygons)
    out_path = os.path.join(paths.out_dir(), "figkit_family_selftest.glb")
    figkit.export_glb(out_path)
    doc = parse_glb(out_path)
    assert len(doc["meshes"]) == 1, len(doc["meshes"])
    assert len(doc["meshes"][0]["primitives"]) == 1, f"{len(doc['meshes'][0]['primitives'])} primitives, so as many draw calls"
    print("[figkit_selftest] merge_by_family single primitive test passed!")


def test_merge_by_family_group_key():
    print("[figkit_selftest] Testing merge_by_family group key: parent name, parent type, lone mesh, mixed families...")
    # Same family under two different parents: never merged.
    clear_scene()
    root = bpy.data.objects.new("KeyRoot", None)
    bpy.context.collection.objects.link(root)
    pa = bpy.data.objects.new("ParentA", None)
    pb = bpy.data.objects.new("ParentB", None)
    for p in (pa, pb):
        p.parent = root
        bpy.context.collection.objects.link(p)
    mat = bpy.data.materials.new("mat_skin_key")
    create_mesh_box("UnderA", pa, mat, center=(0.0, 0.0, 0.2), size=(0.2, 0.2, 0.2))
    create_mesh_box("UnderB", pb, mat, center=(0.0, 0.0, 0.6), size=(0.2, 0.2, 0.2))
    names = {o.name for o in figkit.merge_by_family(root)}
    assert names == {"UnderA", "UnderB"}, f"same family under different parents merged: {names}"

    # OBJECT- and ARMATURE-parented meshes under one armature: never merged.
    clear_scene()
    rig = figkit.make_rig("KeyRig", [rigs.BoneDef("B0", None)], {"B0": (0.0, 0.0, 0.0)})
    mat = bpy.data.materials.new("mat_skin_pt")
    create_mesh_box("ObjParented", rig, mat, center=(0.0, 0.0, 0.2), size=(0.2, 0.2, 0.2))
    arm_child = create_mesh_box("ArmParented", rig, mat, center=(0.0, 0.0, 0.6), size=(0.2, 0.2, 0.2))
    arm_child.parent_type = "ARMATURE"
    names = {o.name for o in figkit.merge_by_family(rig)}
    assert names == {"ObjParented", "ArmParented"}, f"OBJECT and ARMATURE parented meshes merged: {names}"

    # A lone mesh with two materials of one family collapses to one slot and one primitive.
    clear_scene()
    root = bpy.data.objects.new("LoneRoot", None)
    bpy.context.collection.objects.link(root)
    lone = create_mesh_box("Lone", root, bpy.data.materials.new("mat_skin_x"), size=(0.2, 0.2, 0.2))
    lone.data.materials.append(bpy.data.materials.new("mat_skin_y"))
    for poly in lone.data.polygons[:3]:
        poly.material_index = 1
    survivors = figkit.merge_by_family(root)
    assert [o.name for o in survivors] == ["Lone"], [o.name for o in survivors]
    assert len(lone.data.materials) == 1, [m.name for m in lone.data.materials]
    assert all(p.material_index == 0 for p in lone.data.polygons)
    out_path = os.path.join(paths.out_dir(), "figkit_lone_selftest.glb")
    figkit.export_glb(out_path)
    doc = parse_glb(out_path)
    assert len(doc["meshes"]) == 1 and len(doc["meshes"][0]["primitives"]) == 1, (
        f"lone mesh exports {len(doc['meshes'][0]['primitives'])} primitives"
    )

    # One family under one parent, differing only in noOutline: never merged.
    clear_scene()
    root = bpy.data.objects.new("OutlineRoot", None)
    bpy.context.collection.objects.link(root)
    mat = bpy.data.materials.new("mat_skin_ol")
    create_mesh_box("Outlined", root, mat, center=(0.0, 0.0, 0.2), size=(0.2, 0.2, 0.2))
    create_mesh_box("Unoutlined", root, mat, center=(0.0, 0.0, 0.6), size=(0.2, 0.2, 0.2), no_outline=True)
    names = {o.name for o in figkit.merge_by_family(root)}
    assert names == {"Outlined", "Unoutlined"}, f"meshes differing only in noOutline merged: {names}"

    # A kept (TOGGLED) mesh is never merged or recoloured: skin and metal slots both survive.
    clear_scene()
    root = bpy.data.objects.new("KeptRoot", None)
    bpy.context.collection.objects.link(root)
    hair = create_mesh_box("Hair", root, bpy.data.materials.new("mat_skin_h"), size=(0.2, 0.2, 0.2))
    hair.data.materials.append(bpy.data.materials.new("mat_iron_h"))
    for poly in hair.data.polygons[:3]:
        poly.material_index = 1
    survivors = figkit.merge_by_family(root)
    assert [o.name for o in survivors] == ["Hair"], [o.name for o in survivors]
    assert [m.name for m in hair.data.materials] == ["mat_skin_h", "mat_iron_h"], [m.name for m in hair.data.materials]
    assert [p.material_index for p in hair.data.polygons] == [1, 1, 1, 0, 0, 0]

    # A mesh whose materials fall in two families is refused, naming the mesh and the families.
    clear_scene()
    root = bpy.data.objects.new("MixRoot", None)
    bpy.context.collection.objects.link(root)
    mixed = create_mesh_box("MixedMesh", root, bpy.data.materials.new("mat_skin_m"), size=(0.2, 0.2, 0.2))
    mixed.data.materials.append(bpy.data.materials.new("mat_iron_m"))
    try:
        figkit.merge_by_family(root)
    except ValueError as e:
        assert "MixedMesh" in str(e) and "skin" in str(e) and "metal" in str(e), str(e)
    else:
        raise AssertionError("merge_by_family must refuse a mesh with materials in two families")
    print("[figkit_selftest] merge_by_family group key test passed!")


def test_emission_refuses_unmirrored_graphs():
    print("[figkit_selftest] Testing exported_emission refuses graphs it cannot mirror...")
    clear_scene()

    def base(name):
        mat = bpy.data.materials.new(name)
        nt = mat.node_tree
        return mat, nt, next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")

    mat_mix, nt, pr, out = base("em_mix")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 5.0
    mix = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(pr.outputs["BSDF"], mix.inputs[0])
    nt.links.new(em.outputs["Emission"], mix.inputs[1])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])

    mat_noout, nt, pr, out = base("em_noout")
    nt.nodes.remove(out)

    mat_linked, nt, pr, out = base("em_linked")
    rgb = nt.nodes.new("ShaderNodeRGB")
    nt.links.new(rgb.outputs["Color"], pr.inputs["Emission Color"])

    mat_muted, nt, pr, out = base("em_muted")
    pr.inputs["Emission Strength"].default_value = 2.0
    pr.mute = True

    mat_linked_strength, nt, pr, out = base("em_linked_strength")
    val = nt.nodes.new("ShaderNodeValue")
    val.outputs[0].default_value = 3.0
    nt.links.new(val.outputs[0], pr.inputs["Emission Strength"])

    # Blender 5 ignores mute on a Material Output, so this one is a stand-in over a real
    # material whose output reports muted (a file from elsewhere could still carry it).
    class _Over:
        def __init__(self, real, **over):
            self.__dict__.update(over)
            self._real = real

        def __getattr__(self, k):
            return getattr(self._real, k)

    real_muted_out, nt, pr, out = base("em_muted_out")
    mat_muted_out = _Over(real_muted_out, node_tree=_Over(nt, nodes=[pr, _Over(out, mute=True)]))

    mat_muted_link, nt, pr, out = base("em_muted_link")
    out.inputs["Surface"].links[0].is_muted = True

    mat_unlinked, nt, pr, out = base("em_unlinked")
    nt.links.remove(out.inputs["Surface"].links[0])

    for mat in (mat_mix, mat_noout, mat_linked, mat_muted, mat_linked_strength, mat_muted_out, mat_muted_link, mat_unlinked):
        try:
            figkit.exported_emission(mat)
        except ValueError as e:
            assert mat.name in str(e), str(e)
        else:
            raise AssertionError(f"exported_emission must refuse {mat.name}")
    plain, _, _, _ = base("em_plain")
    assert figkit.exported_emission(plain) is None
    print("[figkit_selftest] exported_emission refusal test passed!")


def test_fold_weights_unweighted():
    print("[figkit_selftest] Testing fold_weights on unweighted vertices...")

    def box():
        clear_scene()
        m = create_mesh_box("FoldGap", None, None)
        g = m.vertex_groups.new(name="spine1")
        g.add([0, 1, 2, 3, 4, 5], 1.0, "REPLACE")
        g.add([6], 0.0, "REPLACE")  # vertex 6: a total of 0; vertex 7: no group at all
        return m

    def source_groups(m):
        return [vg.name for vg in m.vertex_groups], [[(g.group, g.weight) for g in v.groups] for v in m.data.vertices]

    m = box()
    before = source_groups(m)
    try:
        figkit.fold_weights(m, {"Torso": ["spine1"]})
    except ValueError as e:
        assert "2 vertices" in str(e), str(e)
    else:
        raise AssertionError("fold_weights must raise on vertices with no source weight")
    assert source_groups(m) == before, f"a raising fold_weights changed the source groups: {source_groups(m)} vs {before}"

    m = box()
    _, out = _run_captured(figkit.fold_weights, m, {"Torso": ["spine1"]}, unweighted_to="Torso")
    assert "put 2 unweighted vertices" in out, out
    for v in m.data.vertices:
        assert len(v.groups) == 1 and abs(v.groups[0].weight - 1.0) < 1e-6, (v.index, [(g.group, g.weight) for g in v.groups])
    m = box()
    before = source_groups(m)
    try:
        figkit.fold_weights(m, {"Torso": ["spine1"]}, unweighted_to="Hips")
    except ValueError as e:
        assert "Hips" in str(e), str(e)
    else:
        raise AssertionError("unweighted_to must name a target of the mapping")
    assert source_groups(m) == before, f"a raising fold_weights changed the source groups: {source_groups(m)} vs {before}"
    print("[figkit_selftest] fold_weights unweighted test passed!")


def _vertex_weight(obj, vi, group):
    return next((g.weight for g in obj.data.vertices[vi].groups if obj.vertex_groups[g.group].name == group), 0.0)


def _point_box(name, co):
    """A one-vertex mesh at co."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([co], [], [])
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def test_limb_segments():
    print("[figkit_selftest] Testing limb segments: reference child and leaf direction...")
    # The reference child, not children[0]: B2 is created first, so it is children[0] of B0.
    # Bare and prefixed ("goblin_B0"): the reference child is looked up by the full bone name.
    table = [
        rigs.BoneDef("B0", None, ref_dir=(0.0, 0.0, 1.0), ref_child="B1"),
        rigs.BoneDef("B2", "B0"),
        rigs.BoneDef("B1", "B0"),
    ]
    for prefix in (None, "goblin"):
        clear_scene()
        n = (lambda b: f"{prefix}_{b}") if prefix else (lambda b: b)
        rig = figkit.make_rig("RefRig", table, {"B0": (0.0, 0.0, 0.0), "B1": (0.0, 0.0, 0.5), "B2": (0.5, 0.0, 0.0)}, prefix=prefix)
        assert rig.data.bones[n("B0")].children[0].name == n("B2"), "fixture: children[0] must be the non-reference child"
        p = _point_box("RefPoint", (0.0, 0.0, 0.25))
        figkit.segment_weights(p, rig, 0.2)
        w = _vertex_weight(p, 0, n("B0"))
        assert w > 0.9, f"a point on the {n('B0')} -> {n('B1')} limb must belong to {n('B0')}, got {w}"

    # A leaf continues its parent's direction: a horizontal limb, a point beyond the leaf joint.
    clear_scene()
    rig = figkit.make_rig("LeafRig", [rigs.BoneDef("B0", None), rigs.BoneDef("B1", "B0")],
                          {"B0": (0.0, 0.0, 0.0), "B1": (0.5, 0.0, 0.0)})
    p = _point_box("LeafPoint", (0.58, 0.0, 0.0))
    figkit.segment_weights(p, rig, 0.2)
    w = _vertex_weight(p, 0, "B1")
    assert w > 0.9, f"a point past the leaf joint along the limb must belong to the leaf, got {w}"

    # auto_weights' twin lies along the limbs: on a horizontal chain B0 -> B1 -> B2, the body
    # between x 0.6 and 0.9 lies on B0's limb, though B1's joint (x 1) is nearer than B0's (x 0).
    clear_scene()
    chain = [rigs.BoneDef("B0", None), rigs.BoneDef("B1", "B0"), rigs.BoneDef("B2", "B1")]
    rig = figkit.make_rig("TwinRig", chain, {"B0": (0.0, 0.0, 0.0), "B1": (1.0, 0.0, 0.0), "B2": (2.0, 0.0, 0.0)})
    body = figkit.organic_body(([(0, 0, 0), (1, 0, 0), (2, 0, 0)], [(0, 1), (1, 2)]), 0.12, voxel=0.04, triangles=600)
    figkit.auto_weights(body, rig)  # no limb_radius: segment_weights must not rescue the twin
    mid = [v.index for v in body.data.vertices if 0.6 < v.co.x < 0.9]
    assert len(mid) >= 4, f"fixture: {len(mid)} body vertices between x 0.6 and 0.9"
    b0 = sum(_vertex_weight(body, i, "B0") for i in mid) / len(mid)
    assert b0 > 0.6, f"body on the B0 -> B1 limb must lean to B0 under auto_weights, mean B0 weight {b0:.3f}"
    print("[figkit_selftest] limb segments test passed!")


if __name__ == "__main__":
    try:
        test_two_part_figure()
        test_toggled_and_edge_cases()
        test_conflict_reparent_keep()
        test_rigs_and_directions()
        test_skinned_figure_build_and_export()
        test_merge_by_family_and_bone_parenting()
        test_fold_weights()
        test_four_influences()
        test_segment_weights()
        test_organic_body_radii()
        test_make_clip_forms_and_names()
        test_family_emissive_mirrors_engine()
        test_merge_by_family_single_primitive()
        test_merge_by_family_group_key()
        test_emission_refuses_unmirrored_graphs()
        test_fold_weights_unweighted()
        test_limb_segments()
        print("[figkit_selftest] ALL TESTS PASSED.")
        sys.exit(0)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[figkit_selftest] FAILED: {e}", file=sys.stderr)
        sys.exit(1)
