"""
Self-test for figkit: verifies merge_parts, bake_paint, and export_glb.
Asserts on a generated two-part figure and edge cases, exits non-zero on failure.
"""

import json
import os
import struct
import sys
import bpy
from mathutils import Vector

sys.dont_write_bytecode = True

sys.path.append(os.path.dirname(__file__))
import figkit
import paths


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


if __name__ == "__main__":
    try:
        test_two_part_figure()
        test_toggled_and_edge_cases()
        test_conflict_reparent_keep()
        print("[figkit_selftest] ALL TESTS PASSED.")
        sys.exit(0)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[figkit_selftest] FAILED: {e}", file=sys.stderr)
        sys.exit(1)
