import bpy, sys
src = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.open_mainfile(filepath=src, use_scripts=False)
for o in bpy.data.objects:
    if o.type == 'ARMATURE':
        print("[kai] armature", o.name, "bones", len(o.data.bones), "actions", [a.name for a in bpy.data.actions][:12])
        print("[kai] bones:", ", ".join(f"{b.name}<{b.parent.name if b.parent else '-'}{'*' if b.use_deform else ''}" for b in o.data.bones))
for o in bpy.data.objects:
    if o.type == 'MESH':
        me = o.data
        nv = len(me.vertices)
        unw = sum(1 for v in me.vertices if sum(g.weight for g in v.groups) < 1e-4)
        mx = max((len([g for g in v.groups if g.weight > 0.01]) for v in me.vertices), default=0)
        arm = [m.object.name for m in o.modifiers if m.type == 'ARMATURE' and m.object]
        print(f"[kai] mesh {o.name}: verts {nv} tris {sum(len(p.vertices)-2 for p in me.polygons)} groups {len(o.vertex_groups)} unweighted {unw} maxInfluences {mx} armatureMod {arm} parent {o.parent.name if o.parent else None}/{o.parent_type}")
