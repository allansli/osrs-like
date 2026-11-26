# Experiment: scripted rigged, weighted, animated figures -> GLB. Writes only into the dir given after "--".
import bpy, bmesh, sys, os, math, time
from mathutils import Vector, Euler

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def humanoid_joints(p):
    """Joint positions (Blender Z-up, front = +Y) from a proportion dict."""
    a = math.radians(p["arm_out"])
    hip, tor, neck, top = p["hip"], p["torso"], p["neck"], p["top"]
    sx, sy = p["shoulder_x"], p["shoulder_z"]
    ua, fa = p["upper_arm"], p["fore_arm"]
    J = {"Root": (0, 0, 0), "Hips": (0, 0, hip), "Torso": (0, 0, tor), "HeadGroup": (0, 0, neck), "_top": (0, 0, top)}
    for side, s in (("Left", -1), ("Right", 1)):
        sh = Vector((s * sx, 0, sy))
        el = sh + Vector((s * math.sin(a), 0, -math.cos(a))) * ua
        ha = el + Vector((s * math.sin(a), 0, -math.cos(a))) * fa
        hp = Vector((s * p["hip_x"], 0, hip))
        kn = Vector((s * p["hip_x"], 0.01, hip * 0.53))
        an = Vector((s * p["hip_x"], 0, 0.07))
        J[side + "ArmPivot"] = tuple(sh); J[side + "ElbowPivot"] = tuple(el); J["_" + side + "Hand"] = tuple(ha)
        J[side + "LegPivot"] = tuple(hp); J[side + "KneePivot"] = tuple(kn); J["_" + side + "Ankle"] = tuple(an)
    return J


# bone -> (parent, tail joint used by the WEIGHTING armature only)
BONES = [
    ("Root", None, "Hips"), ("Hips", "Root", "Torso"), ("Torso", "Hips", "HeadGroup"), ("HeadGroup", "Torso", "_top"),
    ("LeftArmPivot", "Torso", "LeftElbowPivot"), ("LeftElbowPivot", "LeftArmPivot", "_LeftHand"),
    ("RightArmPivot", "Torso", "RightElbowPivot"), ("RightElbowPivot", "RightArmPivot", "_RightHand"),
    ("LeftLegPivot", "Hips", "LeftKneePivot"), ("LeftKneePivot", "LeftLegPivot", "_LeftAnkle"),
    ("RightLegPivot", "Hips", "RightKneePivot"), ("RightKneePivot", "RightLegPivot", "_RightAnkle"),
]


def body_mesh(name, J, p, tris):
    """Organic body: skin modifier over a stick graph, voxel remesh, decimate."""
    pts, radii, edges = [], [], []

    def add(pos, r):
        pts.append(Vector(pos)); radii.append(r); return len(pts) - 1

    def chain(keys_r):
        idx = [add(J[k] if isinstance(k, str) else k, r) for k, r in keys_r]
        for a, b in zip(idx, idx[1:]):
            edges.append((a, b))
        return idx

    t = p["torso_r"]
    spine = chain([("Hips", t * 0.95), ("Torso", t * 0.85), ((0, 0, p["shoulder_z"]), t), ("HeadGroup", 0.06),
                   ((0, 0, (p["neck"] + p["top"]) / 2 + 0.02), p["head_r"])])
    for side in ("Left", "Right"):
        arm = chain([(side + "ArmPivot", p["arm_r"] * 1.2), (side + "ElbowPivot", p["arm_r"]), ("_" + side + "Hand", p["arm_r"] * 1.15)])
        edges.append((spine[2], arm[0]))
        an = Vector(J["_" + side + "Ankle"])
        leg = chain([(side + "LegPivot", p["leg_r"] * 1.15), (side + "KneePivot", p["leg_r"] * 0.9), ("_" + side + "Ankle", p["leg_r"] * 0.8),
                     (tuple(an + Vector((0, 0.13, -0.02))), p["leg_r"] * 0.7)])
        edges.append((spine[0], leg[0]))
    me = bpy.data.meshes.new(name + "_graph")
    me.from_pydata([tuple(v) for v in pts], edges, [])
    ob = bpy.data.objects.new(name + "_graph", me)
    col.objects.link(ob)
    ob.modifiers.new("skin", "SKIN")
    for i, sv in enumerate(me.skin_vertices[0].data):
        sv.radius = (radii[i], radii[i]); sv.use_root = (i == 0)
    ob.modifiers.new("sub", "SUBSURF").levels = 2
    rm = ob.modifiers.new("remesh", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = 0.022; rm.use_smooth_shade = True
    sm = ob.modifiers.new("smooth", "SMOOTH"); sm.iterations = 6; sm.factor = 0.5
    dg = bpy.context.evaluated_depsgraph_get()
    dense = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ntri = sum(len(f.vertices) - 2 for f in dense.polygons)
    body = bpy.data.objects.new(name, dense)
    col.objects.link(body)
    dec = body.modifiers.new("dec", "DECIMATE"); dec.ratio = min(1.0, tris / max(1, ntri))
    tri = body.modifiers.new("tri", "TRIANGULATE")
    dg = bpy.context.evaluated_depsgraph_get()
    final = bpy.data.meshes.new_from_object(body.evaluated_get(dg))
    body.modifiers.clear(); body.data = final
    for f in final.polygons:
        f.use_smooth = True
    bpy.data.objects.remove(ob)
    mat = bpy.data.materials.new(name + "_skin"); mat.diffuse_color = p["color"]
    final.materials.append(mat)
    return body


def armature(name, J, aligned):
    """aligned=True: every bone points straight up with roll 0 (identity rest rotation in glTF)."""
    arm = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, arm)
    col.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, parent, tailkey in BONES:
        eb = arm.edit_bones.new(bname)
        eb.head = Vector(J[bname])
        eb.tail = eb.head + Vector((0, 0, 0.08)) if aligned else Vector(J[tailkey])
        if (eb.tail - eb.head).length < 1e-4:
            eb.tail = eb.head + Vector((0, 0, 0.05))
        eb.roll = 0.0
        if parent:
            eb.parent = arm.edit_bones[parent]; eb.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def auto_weights(body, warm):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    body.select_set(True); warm.select_set(True)
    bpy.context.view_layer.objects.active = warm
    t = time.time()
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    dt = time.time() - t
    unweighted = sum(1 for v in body.data.vertices if sum(g.weight for g in v.groups) < 1e-4)
    return dt, unweighted


def segment_weights(body, J, p):
    """Deterministic fallback: distance to each bone's limb segment, scaled by limb radius, blended across the two nearest."""
    for vg in list(body.vertex_groups):
        body.vertex_groups.remove(vg)
    rad = {"Hips": p["torso_r"], "Torso": p["torso_r"], "HeadGroup": p["head_r"]}
    segs = []
    for bname, parent, tailkey in BONES:
        if bname == "Root":
            continue
        r = rad.get(bname, p["arm_r"] if "Arm" in bname or "Elbow" in bname else p["leg_r"])
        segs.append((bname, Vector(J[bname]), Vector(J[tailkey]), r))
        body.vertex_groups.new(name=bname)
    for v in body.data.vertices:
        ds = []
        for bname, a, b, r in segs:
            ab = b - a; t = max(0.0, min(1.0, (v.co - a).dot(ab) / ab.length_squared))
            ds.append((((v.co - (a + ab * t)).length / r), bname))
        ds.sort()
        (d0, b0), (d1, b1) = ds[0], ds[1]
        w1 = max(0.0, 1.0 - (d1 - d0) / 0.9) * 0.5
        body.vertex_groups[b0].add([v.index], 1.0 - w1, "REPLACE")
        if w1 > 0:
            body.vertex_groups[b1].add([v.index], w1, "REPLACE")


def bind(body, rig):
    body.parent = rig; body.parent_type = "OBJECT"
    for m in list(body.modifiers):
        if m.type == "ARMATURE":
            body.modifiers.remove(m)
    body.modifiers.new("Armature", "ARMATURE").object = rig


def clip(rig, name, frames, fn):
    rig.animation_data_create()
    act = bpy.data.actions.new(name)
    rig.animation_data.action = act
    for f in range(frames + 1):
        pose = fn(f / frames)
        for b, (rx, ry, rz) in pose.items():
            pb = rig.pose.bones[b]; pb.rotation_mode = "XYZ"
            pb.rotation_euler = Euler((rx, ry, rz), "XYZ")
            pb.keyframe_insert("rotation_euler", frame=f)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, 0, act); st.name = name
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_euler = Euler((0, 0, 0), "XYZ")


def walk(u):
    s = math.sin(u * 2 * math.pi)
    return {"LeftLegPivot": (0.55 * s, 0, 0), "RightLegPivot": (-0.55 * s, 0, 0),
            "LeftKneePivot": (-0.5 * max(0, -math.cos(u * 2 * math.pi)), 0, 0), "RightKneePivot": (-0.5 * max(0, math.cos(u * 2 * math.pi)), 0, 0),
            "LeftArmPivot": (-0.4 * s, 0, 0), "RightArmPivot": (0.4 * s, 0, 0), "Torso": (0, 0.08 * s, 0)}


def slash(u):
    k = [(0, 0.1), (0.25, -0.7), (0.45, 1.3), (0.7, 0.6), (1.0, 0.1)]
    for (u0, v0), (u1, v1) in zip(k, k[1:]):
        if u0 <= u <= u1:
            t = (u - u0) / (u1 - u0); t = t * t * (3 - 2 * t); a = v0 + (v1 - v0) * t; break
    return {"RightArmPivot": (-a, 0, 0), "RightElbowPivot": (-0.6 * abs(a), 0, 0), "Torso": (0.1 * a, -0.35 * a, 0), "HeadGroup": (0, 0.2 * a, 0)}


HUMAN = dict(hip=0.90, torso=1.24, neck=1.58, top=1.85, shoulder_x=0.26, shoulder_z=1.50, upper_arm=0.26, fore_arm=0.30, arm_out=28,
             hip_x=0.11, torso_r=0.15, head_r=0.13, arm_r=0.052, leg_r=0.075, color=(0.8, 0.6, 0.5, 1))
GOBLIN = dict(hip=0.55, torso=0.80, neck=1.08, top=1.42, shoulder_x=0.30, shoulder_z=1.02, upper_arm=0.30, fore_arm=0.36, arm_out=35,
              hip_x=0.14, torso_r=0.19, head_r=0.19, arm_r=0.06, leg_r=0.08, color=(0.3, 0.45, 0.2, 1))

report = []
rigs = {}
for name, p, tris, with_clips, prefix in (("Human", HUMAN, 5000, True, ""), ("Goblin", GOBLIN, 5000, False, "")):
    J = humanoid_joints(p)
    body = body_mesh(name + "Body", J, p, tris)
    ntri = len(body.data.polygons); nv = len(body.data.vertices)
    warm = armature(name + "_W", J, aligned=False)
    dt, unw = auto_weights(body, warm)
    report.append(f"{name}: tris={ntri} verts={nv} bone-heat seconds={dt:.2f} unweighted={unw}")
    if unw > 0 or os.environ.get("FORCE_SEGMENT") == name:
        segment_weights(body, J, p); report.append(f"{name}: used segment weights fallback")
    maxinf = max(len([g for g in v.groups if g.weight > 0.01]) for v in body.data.vertices)
    report.append(f"{name}: max influences per vertex={maxinf}")
    rig = armature(name + "Rig", J, aligned=True)
    body.matrix_parent_inverse.identity()
    bind(body, rig)
    bpy.data.objects.remove(warm)
    if with_clips:
        clip(rig, "Walk", 32, walk); clip(rig, "Slash", 24, slash)
    rigs[name] = (rig, body)

print("\n".join("[exp] " + r for r in report))


def export(path, objs, anim=True, skins=True):
    for o in bpy.context.view_layer.objects:
        o.select_set(o in objs)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, use_selection=True, export_apply=False,
                              export_animations=anim, export_animation_mode="NLA_TRACKS", export_skins=skins,
                              export_texcoords=False, export_extras=True,
                              export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=False)
    print(f"[exp] wrote {os.path.basename(path)} {os.path.getsize(path)} bytes")


export(os.path.join(OUT, "human_skinned.glb"), list(rigs["Human"]))
export(os.path.join(OUT, "human_noanim.glb"), list(rigs["Human"]), anim=False)
export(os.path.join(OUT, "human_static.glb"), [rigs["Human"][1]], anim=False, skins=False)
export(os.path.join(OUT, "goblin_skinned.glb"), list(rigs["Goblin"]), anim=False)
export(os.path.join(OUT, "both_same_names.glb"), list(rigs["Human"]) + list(rigs["Goblin"]))


# variant sharing the goblin's mesh data: own armature object, linked mesh data, plus one small kit piece weighted to the head
g_rig, g_body = rigs["Goblin"]
v_rig = g_rig.copy(); v_rig.data = g_rig.data.copy(); v_rig.name = "VariantRig"; col.objects.link(v_rig)
v_body = g_body.copy(); v_body.name = "VariantBody"; col.objects.link(v_body)
bind(v_body, v_rig)
print("[exp] variant shares mesh data:", v_body.data is g_body.data)
export(os.path.join(OUT, "goblin_plus_variant.glb"), [g_rig, g_body, v_rig, v_body], anim=False)
if os.environ.get("NO_RENDER"):
    sys.exit(0)
# worst-pose strip of the Human Slash + Walk, Cycles CPU
rig, body = rigs["Human"]
for t in rig.animation_data.nla_tracks:
    t.mute = True
for o in list(rigs["Goblin"]):
    o.hide_render = True
scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = 12
scene.render.resolution_x = 300; scene.render.resolution_y = 420
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); col.objects.link(cam); scene.camera = cam
cam.location = (2.6, 3.4, 1.25); cam.rotation_euler = Euler((math.radians(86), 0, math.radians(142.5)), "XYZ")
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); col.objects.link(sun)
sun.rotation_euler = Euler((math.radians(50), 0, math.radians(120)), "XYZ"); sun.data.energy = 3
world = bpy.data.worlds.new("w"); scene.world = world; world.color = (0.5, 0.5, 0.5)
poses = [("rest", {}), ("walk25", walk(0.25)), ("walk0", walk(0.5)), ("slash_back", slash(0.25)), ("slash_hit", slash(0.45)),
         ("deep", {"LeftLegPivot": (1.3, 0, 0), "LeftKneePivot": (-1.6, 0, 0), "RightArmPivot": (-2.2, 0, 0.3), "RightElbowPivot": (-1.5, 0, 0), "Torso": (0.4, 0.5, 0), "HeadGroup": (0, 0.7, 0)})]
for i, (pn, pose) in enumerate(poses):
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"; pb.rotation_euler = Euler(pose.get(pb.name, (0, 0, 0)), "XYZ")
    scene.render.filepath = os.path.join(OUT, f"pose_{i}_{pn}.png")
    bpy.ops.render.render(write_still=True)
print("[exp] done")
