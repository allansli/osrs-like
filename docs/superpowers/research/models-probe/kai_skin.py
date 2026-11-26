# Experiment: skin the hero source with ITS AUTHOR'S weights folded onto the 16-bone biped rig. Writes only to OUT.
import bpy, sys, os, math
from mathutils import Vector, Euler

src, OUT = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=src, use_scripts=False)
scene = bpy.context.scene
arm = bpy.data.objects["Armature"]
FOLD = {"waist": "Hips", "spine1": "Torso", "spine2": "Torso", "neck": "HeadGroup", "head": "HeadGroup"}
for s, S in (("L", "Left"), ("R", "Right")):
    FOLD.update({f"upperArm_{s}": S + "ArmPivot", f"lowerArm_{s}": S + "ElbowPivot", f"palm_{s}": S + "Hand",
                 f"upperLeg_{s}": S + "LegPivot", f"lowerLeg_{s}": S + "KneePivot", f"ankle_{s}": S + "Foot", f"foot1_{s}": S + "Foot", f"foot2_{s}": S + "Foot"})
    for f in ("thumb", "indexFinger", "middleFinger", "ringFinger", "pinkyFinger"):
        for i in range(1, 5):
            FOLD[f"{f}{i}_{s}"] = S + "Hand"
HEAD_OF = {"Hips": "waist", "Torso": "spine1", "HeadGroup": "neck"}
PARENT = {"Hips": "Root", "Torso": "Hips", "HeadGroup": "Torso"}
for s, S in (("L", "Left"), ("R", "Right")):
    HEAD_OF.update({S + "ArmPivot": f"upperArm_{s}", S + "ElbowPivot": f"lowerArm_{s}", S + "Hand": f"palm_{s}", S + "LegPivot": f"upperLeg_{s}", S + "KneePivot": f"lowerLeg_{s}", S + "Foot": f"ankle_{s}"})
    PARENT.update({S + "ArmPivot": "Torso", S + "ElbowPivot": S + "ArmPivot", S + "Hand": S + "ElbowPivot", S + "LegPivot": "Hips", S + "KneePivot": S + "LegPivot", S + "Foot": S + "KneePivot"})

meshes = [o for o in bpy.data.objects if o.type == "MESH" and any(m.type == "ARMATURE" and m.object == arm for m in o.modifiers)]
print("[kai] weighted meshes:", [o.name for o in meshes])
heads = {n: arm.matrix_world @ arm.data.bones[b].head_local for n, b in HEAD_OF.items()}
unknown = set()
tv = tt = 0
for o in meshes:
    me = o.data
    names = {g.index: g.name for g in o.vertex_groups}
    folded = []
    for v in me.vertices:
        acc = {}
        for g in v.groups:
            t = FOLD.get(names[g.group])
            if t is None:
                unknown.add(names[g.group]); continue
            acc[t] = acc.get(t, 0.0) + g.weight
        tot = sum(acc.values())
        folded.append({k: w / tot for k, w in acc.items()} if tot > 1e-6 else {"Torso": 1.0})
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    for t in HEAD_OF:
        o.vertex_groups.new(name=t)
    for i, acc in enumerate(folded):
        for t, w in acc.items():
            o.vertex_groups[t].add([i], w, "REPLACE")
    tv += len(me.vertices); tt += sum(len(p.vertices) - 2 for p in me.polygons)
    print(f"[kai] {o.name}: max influences after fold {max(len(a) for a in folded)}")
print("[kai] unmapped source groups:", sorted(unknown), "| verts", tv, "tris", tt)

rigd = bpy.data.armatures.new("HeroRig"); rig = bpy.data.objects.new("HeroRig", rigd); scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
eb = rigd.edit_bones.new("Root"); eb.head = (0, 0, heads["Hips"].z - 5.0); eb.tail = eb.head + Vector((0, 0, 0.3))
for n in HEAD_OF:
    eb = rigd.edit_bones.new(n); eb.head = heads[n]; eb.tail = heads[n] + Vector((0, 0, 0.3)); eb.roll = 0
for n, p in PARENT.items():
    rigd.edit_bones[n].parent = rigd.edit_bones[p]
bpy.ops.object.mode_set(mode="OBJECT")
for o in meshes:
    mw = o.matrix_world.copy()
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    o.parent = rig; o.matrix_world = mw
    o.modifiers.new("Armature", "ARMATURE").object = rig
keep = set(meshes) | {rig}
for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)
for o in keep:
    o.select_set(True)
for o in meshes:
    o.data.materials.clear()
p = os.path.join(OUT, "hero_skinned_author_weights.glb")
bpy.ops.export_scene.gltf(filepath=p, export_format="GLB", export_yup=True, use_selection=True, export_apply=False, export_animations=False,
                          export_skins=True, export_texcoords=False, export_materials="NONE", export_image_format="NONE")
print("[kai] wrote", os.path.getsize(p))
p2 = os.path.join(OUT, "hero_static_uv.glb")
bpy.ops.export_scene.gltf(filepath=p2, export_format="GLB", export_yup=True, use_selection=True, export_apply=False, export_animations=False,
                          export_skins=False, export_texcoords=True, export_materials="NONE", export_image_format="NONE")
print("[kai] wrote static+uv", os.path.getsize(p2))

lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
ctr = (lo + hi) / 2; H = hi.z - lo.z
scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = 12
scene.render.resolution_x = 300; scene.render.resolution_y = 420
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = H * 1.5
front = -1 if heads["LeftFoot"].y < 0 else 1
cam.location = ctr + Vector((H * 0.9, -front * H * 2.2, H * 0.15)); cam.data.clip_end = H * 10
d = (ctr - cam.location).normalized(); cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); scene.collection.objects.link(sun)
sun.rotation_euler = cam.rotation_euler; sun.data.energy = 3
if scene.world is None:
    scene.world = bpy.data.worlds.new("w")
scene.world.use_nodes = False; scene.world.color = (0.45, 0.45, 0.45)
poses = [("rest", {}), ("arms_down", {"LeftArmPivot": (0, 1.2, 0), "RightArmPivot": (0, -1.2, 0)}),
         ("walk", {"LeftArmPivot": (0, 1.2, 0), "RightArmPivot": (0, -1.2, 0), "LeftLegPivot": (0.6, 0, 0), "RightLegPivot": (-0.6, 0, 0), "RightKneePivot": (-0.7 * front, 0, 0)}),
         ("strike", {"LeftArmPivot": (0, 1.2, 0), "RightArmPivot": (-1.4, -0.4, 0), "RightElbowPivot": (-1.2, 0, 0), "Torso": (0.15, 0, -0.5), "HeadGroup": (0, 0, 0.5)}),
         ("crouch", {"LeftArmPivot": (0, 1.2, 0), "RightArmPivot": (0, -1.2, 0), "LeftLegPivot": (1.3, 0, 0), "LeftKneePivot": (-1.7, 0, 0), "Torso": (0.5, 0, 0)})]
for i, (pn, pose) in enumerate(poses):
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"; pb.rotation_euler = Euler(pose.get(pb.name, (0, 0, 0)), "XYZ")
    scene.render.filepath = os.path.join(OUT, f"kai_{i}_{pn}.png")
    bpy.ops.render.render(write_still=True)
print("[kai] done")
