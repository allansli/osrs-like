# P-d: the hero's Walk and Slash, converted by design 6.1.5 (rotation-only plus the legs' Hips keys), built through figkit.make_clip
# on the goblin's armature, exported as a clips-only GLB. blender --background <monsters.blend> --python clips.py -- <out.glb>
import bpy, sys, os, math
from mathutils import Euler
MP = "/home/rdrosa/gitprojects/allan/osrs-like-wp/MP"
sys.path.insert(0, MP + "/scripts/blender")
import build_hero, figkit

out = sys.argv[sys.argv.index("--") + 1]
captured = {}
build_hero.build_action = lambda pivots, name, frames, sample: captured.__setitem__(name, (frames, sample))
build_hero.build_all_animations({})

rig = bpy.data.objects["Monster_goblin"]
P = "goblin_"
hips_z = rig.data.bones[P + "Hips"].head_local.z
HERO_HIP = 0.9  # LEAN_RIG.hipY
scale = hips_z / HERO_HIP
print("goblin hips z", hips_z, "scale", scale)

def q_of(t):
    return Euler(tuple(t), "XZY").to_quaternion()

FOLLOW = {"HeadGroup", "LeftArmPivot", "RightArmPivot"}  # children of Torso now: rotation conversion (6.1.5 step 1)
for name in ("Walk", "Slash"):
    frames, sample = captured[name]
    table = {}
    hips = []
    for f in range(frames + 1):
        s = sample(f / frames)
        tq = q_of(s["Torso"]["rot"])
        for bone, tr in s.items():
            rot = tr["rot"]
            if bone in FOLLOW:
                ql = tq.inverted() @ q_of(rot)
                prev = table.get(P + bone, [None])[-1]
                e = ql.to_euler("XZY", Euler(prev, "XZY")) if prev else ql.to_euler("XZY")
                rot = (e.x, e.y, e.z)
            table.setdefault(P + bone, []).append(tuple(rot))
        pos = s.get("LeftLegPivot", {}).get("pos")
        hips.append(pos[1] * scale if pos else 0.0)
    figkit.make_clip(rig, name, frames, table)
    if any(abs(h) > 1e-9 for h in hips):
        strip = rig.animation_data.nla_tracks[-1].strips[0]
        rig.animation_data.action = strip.action
        pb = rig.pose.bones[P + "Hips"]
        for f, h in enumerate(hips):
            pb.location = (0.0, h, 0.0)  # bone-local Y is world up (bones stand up with roll 0)
            pb.keyframe_insert(data_path="location", frame=f)
        pb.location = (0.0, 0.0, 0.0)
        rig.animation_data.action = None
    print("clip", name, frames, "hips keys", any(abs(h) > 1e-9 for h in hips))

bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True,
                          export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True)
print("exported", out)
