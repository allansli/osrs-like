# Second-pass experiment: a prefixed skinned figure under a translated Monster_ node, an empty keyed the way
# build_hero.py keys pivots today, and bone clips keyed in two Euler modes. Writes only into OUT.
import bpy, bmesh, sys, os
from mathutils import Vector, Euler

OUT = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.context.scene.collection


def t2b(t):
    return Vector((t[0], -t[2], t[1]))


def t2b_euler(r):
    return (r[0], -r[2], r[1])


ROT = (0.3, 0.5, 0.7)  # a three-space Euler as build_hero's sample functions return it

# armature object at glTF (6, 0, 2), like monsters.glb lays out its Monster_ nodes
ad = bpy.data.armatures.new("probe_arm")
arm = bpy.data.objects.new("Monster_probe", ad)
col.objects.link(arm)
arm.location = t2b((6, 0, 2))
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
J = {"probe_Root": ((0, 0, 0), None), "probe_Hips": ((0, 0.9, 0), "probe_Root"),
     "probe_Torso": ((0, 1.24, 0), "probe_Hips"), "probe_HeadGroup": ((0, 1.6, 0), "probe_Torso"),
     "probe_RightArmPivot": ((0.28, 1.5, 0), "probe_Torso"), "probe_RightElbowPivot": ((0.28, 1.24, 0), "probe_RightArmPivot")}
for n, (p, par) in J.items():
    eb = ad.edit_bones.new(n)
    eb.head = t2b(p)
    eb.tail = eb.head + Vector((0, 0, 0.08))
    eb.roll = 0
    if par:
        eb.parent = ad.edit_bones[par]
bpy.ops.object.mode_set(mode="OBJECT")

# body: torso box and an arm box, in the armature's space
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0, matrix=__import__("mathutils").Matrix.LocRotScale(t2b((0, 1.25, 0)), None, (0.3, 0.2, 0.7)))
bmesh.ops.create_cube(bm, size=1.0, matrix=__import__("mathutils").Matrix.LocRotScale(t2b((0.28, 1.2, 0)), None, (0.1, 0.1, 0.6)))
me = bpy.data.meshes.new("probe_body")
bm.to_mesh(me)
bm.free()
body = bpy.data.objects.new("probe_body", me)
col.objects.link(body)
body.parent = arm
for n in J:
    body.vertex_groups.new(name=n)
for v in me.vertices:
    x, z = v.co.x, v.co.z
    if x > 0.2:
        g = "probe_RightArmPivot" if z > 1.24 else "probe_RightElbowPivot"
    else:
        g = "probe_Torso"
    body.vertex_groups[g].add([v.index], 1.0, "REPLACE")
body.modifiers.new("Armature", "ARMATURE").object = arm
mat = bpy.data.materials.new("probe_skin")
me.materials.append(mat)

# bone clips: the same three-space Euler keyed directly on the bone, mode XZY and mode XYZ
arm.animation_data_create()
for mode in ("XZY",):
    act = bpy.data.actions.new("Bone" + mode)
    arm.animation_data.action = act
    pb = arm.pose.bones["probe_RightArmPivot"]
    pb.rotation_mode = mode
    for f in (0, 4):
        pb.rotation_euler = Euler(ROT if f else (0, 0, 0), mode)
        pb.keyframe_insert("rotation_euler", frame=f)
    tr = arm.animation_data.nla_tracks.new()
    tr.name = "Bone" + mode
    st = tr.strips.new("Bone" + mode, 0, act)
    st.name = "Bone" + mode
    arm.animation_data.action = None
    pb.rotation_euler = Euler((0, 0, 0), mode)

# today's way: an empty pivot keyed with t2b_euler and Blender XYZ (build_hero.py build_action)
emp = bpy.data.objects.new("RefPivot", None)
col.objects.link(emp)
emp.animation_data_create()
act = bpy.data.actions.new("RefEmpty")
emp.animation_data.action = act
for f in (0, 4):
    emp.rotation_euler = Euler(t2b_euler(ROT) if f else (0, 0, 0), "XYZ")
    emp.keyframe_insert("rotation_euler", frame=f)
tr = emp.animation_data.nla_tracks.new()
tr.name = "RefEmpty"
st = tr.strips.new("RefEmpty", 0, act)
st.name = "RefEmpty"
emp.animation_data.action = None
emp.rotation_euler = (0, 0, 0)

bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "rig2.glb"), export_format="GLB", export_yup=True,
                          export_apply=False, export_animations=True, export_animation_mode="NLA_TRACKS",
                          export_skins=True, export_texcoords=False, export_extras=True,
                          export_optimize_animation_keep_anim_armature=False)
print("[rig2] wrote", os.path.getsize(os.path.join(OUT, "rig2.glb")))
