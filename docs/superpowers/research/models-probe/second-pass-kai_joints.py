import bpy, sys
src = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.open_mainfile(filepath=src, use_scripts=False)
S = 1.85 / 11.0498
Z0 = 4.2954
arm = bpy.data.objects["Armature"]
print("[kj] bones", len(arm.data.bones), "deform", sum(1 for b in arm.data.bones if b.use_deform))
for o in bpy.data.objects:
    if o.type == "MESH":
        mods = [m.object.name for m in o.modifiers if m.type == "ARMATURE" and m.object]
        unw = sum(1 for v in o.data.vertices if sum(g.weight for g in v.groups) < 1e-4)
        print(f"[kj] mesh {o.name} verts {len(o.data.vertices)} groups {len(o.vertex_groups)} armMod {mods} unweighted {unw}")
want = ["upperLeg_R", "lowerLeg_R", "palm_R", "ankle_R", "waist", "spine1", "spine2", "neck", "head", "upperArm_L", "lowerArm_L", "palm_L", "upperLeg_L", "lowerLeg_L", "ankle_L", "upperArm_R", "lowerArm_R"]
for n in want:
    b = arm.data.bones.get(n)
    if not b:
        print("[kj] missing", n); continue
    w = arm.matrix_world @ b.head_local
    # same transform build_hero applies to vertices: x->-x*S, y->-y*S, z->(z+Z0)*S ; then glTF: (bx, bz, -by)
    bx, by, bz = -w.x * S, -w.y * S, (w.z + Z0) * S
    print(f"[kj] {n}: gltf x={bx:.3f} y={bz:.3f} z={-by:.3f}")
