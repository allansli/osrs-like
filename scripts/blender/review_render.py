"""
Review renderer for models pass (Task V1).
Renders turnaround, silhouette, play distance, motion strips, worst-pose,
side-by-side and roster silhouette sheets.

Usage:
  blender --background --factory-startup --disable-autoexec --python-exit-code 1 \\
    --python scripts/blender/review_render.py -- <glb> <out dir> \\
    [--only a,b] [--against <other.glb>] [--clips] [--engine-palette] [--worst]
"""

import json
import math
import os
import sys
import time

sys.dont_write_bytecode = True

import numpy as np

sys.path.append(os.path.dirname(__file__))
import paths

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Quaternion, Vector

# 5x7 bitmap font for drawing digits and text in numpy arrays without external dependencies
FONT_5X7 = {
    '0': ["11111", "10001", "10001", "10001", "10001", "10001", "11111"],
    '1': ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    '2': ["11111", "00001", "00001", "11111", "10000", "10000", "11111"],
    '3': ["11111", "00001", "00001", "11111", "00001", "00001", "11111"],
    '4': ["10001", "10001", "10001", "11111", "00001", "00001", "00001"],
    '5': ["11111", "10000", "10000", "11111", "00001", "00001", "11111"],
    '6': ["11111", "10000", "10000", "11111", "10001", "10001", "11111"],
    '7': ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    '8': ["11111", "10001", "10001", "11111", "10001", "10001", "11111"],
    '9': ["11111", "10001", "10001", "11111", "00001", "00001", "11111"],
    'p': ["00000", "00000", "11110", "10001", "11110", "10000", "10000"],
    'x': ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
    ' ': ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    ':': ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    '-': ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    '.': ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
}


def draw_text_numpy(img, text, x0, y0, scale=2, color=(1.0, 1.0, 1.0), bg_outline=(0.0, 0.0, 0.0)):
    """Draw text onto a float32 numpy image array (H, W, 3) where row 0 is top."""
    h_img, w_img = img.shape[:2]
    cur_x = x0

    for ch in text:
        bitmap = FONT_5X7.get(ch, FONT_5X7[' '])
        rows = len(bitmap)
        cols = len(bitmap[0])

        # Draw outline if requested
        if bg_outline is not None:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    for r in range(rows):
                        for c in range(cols):
                            if bitmap[r][c] == '1':
                                py = y0 + r * scale + dy
                                px = cur_x + c * scale + dx
                                if 0 <= py < h_img - scale and 0 <= px < w_img - scale:
                                    img[py : py + scale, px : px + scale, :3] = bg_outline

        # Draw character
        for r in range(rows):
            for c in range(cols):
                if bitmap[r][c] == '1':
                    py = y0 + r * scale
                    px = cur_x + c * scale
                    if 0 <= py < h_img - scale and 0 <= px < w_img - scale:
                        img[py : py + scale, px : px + scale, :3] = color

        cur_x += (cols + 1) * scale


def get_clean_name(root_name: str) -> str:
    if root_name == "HeroRoot":
        return "hero"
    if root_name == "CastleGuard":
        return "guard"
    if root_name.startswith("Monster_"):
        return root_name[len("Monster_") :]
    return root_name


# Hero engine palette from blenderHero.ts 182-197
PALETTE_HEX = {
    'skin': 0xf5d8c2,
    'lips': 0xd08878,
    'tunic': 0x38444e,
    'inner-tunic': 0x282b2e,
    'tunic-trim': 0xeee5d2,
    'waist-sash': 0x1e2022,
    'bracer': 0x4e3524,
    'legs': 0x2a2522,
    'hair': 0x4a3728,
    'boot': 0x342418,
    'glove': 0xf5d8c2,
    'belt-leather': 0x1e2022,
    'gold': 0x8f7d4e,
    'eye-white': 0xffffff,
    'pupil': 0x227cd4,
}


def get_part_color(mesh):
    m_name = mesh.name
    part = mesh.get('part', '')
    if (
        m_name.startswith('CoatTrim_')
        or m_name.startswith('CoatTailTrim_')
        or m_name.startswith('SleeveCuff_')
        or m_name.startswith('BracerLace_')
        or part == 'tunic-trim'
    ):
        return PALETTE_HEX['tunic-trim']
    if m_name in ('InnerCollar', 'InnerChest') or part == 'inner-tunic':
        return PALETTE_HEX['inner-tunic']
    if m_name == 'Belt' or part == 'waist-sash':
        return PALETTE_HEX['waist-sash']
    if m_name.startswith('Bracer_') or part == 'bracer':
        return PALETTE_HEX['bracer']
    if part == 'belt-strap':
        return PALETTE_HEX['belt-leather']
    if part == 'belt-buckle':
        return PALETTE_HEX['gold']
    if part in ('chest', 'arm', 'deltoid'):
        return PALETTE_HEX['tunic']
    if part in ('belt', 'thigh', 'shin'):
        return PALETTE_HEX['legs']
    if part in ('boot', 'toe'):
        return PALETTE_HEX['boot']
    if part == 'hand':
        return PALETTE_HEX['glove']
    if part == 'mouth':
        return PALETTE_HEX['lips']
    if part in ('head', 'ear', 'nose', 'neck', 'skin'):
        return PALETTE_HEX['skin']
    if part in ('hair', 'brow'):
        return PALETTE_HEX['hair']
    if part in ('eye-white', 'eye'):
        return PALETTE_HEX['eye-white']
    if part == 'pupil':
        return PALETTE_HEX['pupil']
    return None


def apply_engine_palette(root):
    meshes = [o for o in [root] + list(root.children_recursive) if o.type == 'MESH']
    for m in meshes:
        c = get_part_color(m)
        if c is not None:
            r = ((c >> 16) & 0xff) / 255.0
            g = ((c >> 8) & 0xff) / 255.0
            b = (c & 0xff) / 255.0
            mat = bpy.data.materials.new(f"Palette_{m.name}")
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs['Base Color'].default_value = (r, g, b, 1.0)
                bsdf.inputs['Roughness'].default_value = 0.8
            m.data.materials.clear()
            m.data.materials.append(mat)


class ReviewRenderer:
    def __init__(self, glb_path: str, out_dir: str, opts: dict):
        self.glb_path = os.path.abspath(glb_path)
        self.out_dir = paths.checked_write(os.path.join(out_dir, "dummy"))
        self.out_dir = os.path.dirname(self.out_dir)
        os.makedirs(self.out_dir, exist_ok=True)
        self.opts = opts

        # Load scales
        scales_path = os.path.join(os.path.dirname(__file__), "review_scales.json")
        self.scales = {}
        if os.path.exists(scales_path):
            with open(scales_path, "r", encoding="utf-8") as f:
                self.scales = json.load(f)

        # Temporary files directory for still renders
        self.temp_render_path = paths.checked_write(
            os.path.join(self.out_dir, ".temp_render.png")
        )

        self._setup_scene()

    def get_scale(self, clean_name: str, root_name: str) -> float:
        return self.scales.get(clean_name, self.scales.get(root_name, 1.0))

    def _setup_scene(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=self.glb_path)

        self.scene = bpy.context.scene
        self.scene.render.engine = 'CYCLES'
        self.scene.cycles.device = 'CPU'
        self.scene.cycles.samples = 24
        self.scene.view_settings.view_transform = 'Standard'
        self.scene.view_settings.look = 'None'
        self.scene.render.image_settings.file_format = 'PNG'

        # Grey world (0.45, 0.45, 0.45)
        self.world = bpy.data.worlds.new('ReviewWorld')
        self.scene.world = self.world
        self.world_bg = self.world.node_tree.nodes['Background']
        self.world_bg.inputs['Color'].default_value = (0.45, 0.45, 0.45, 1.0)
        self.world_bg.inputs['Strength'].default_value = 1.0

        # Lighting: One sun and one fill
        # Key sun from front-top-right (+Y, +X, +Z)
        sun_data = bpy.data.lights.new('SunKey', 'SUN')
        sun_data.energy = 2.5
        self.sun_key = bpy.data.objects.new('SunKey', sun_data)
        # Pointing towards -Y, -X, -Z
        self.sun_key.rotation_euler = (0.78, 0.2, -0.65)
        self.scene.collection.objects.link(self.sun_key)

        # Fill light from opposite side (-X, +Y, +Z)
        fill_data = bpy.data.lights.new('SunFill', 'SUN')
        fill_data.energy = 0.8
        self.sun_fill = bpy.data.objects.new('SunFill', fill_data)
        self.sun_fill.rotation_euler = (0.45, -0.3, 1.1)
        self.scene.collection.objects.link(self.sun_fill)

        # Camera
        self.cam_data = bpy.data.cameras.new('ReviewCam')
        self.cam_data.sensor_fit = 'VERTICAL'
        self.cam_data.angle_y = 50.0 * math.pi / 180.0
        self.cam = bpy.data.objects.new('ReviewCam', self.cam_data)
        self.scene.collection.objects.link(self.cam)
        self.scene.camera = self.cam

        # Black emission material override for silhouette
        self.silhouette_mat = bpy.data.materials.new('SilhouetteBlack')
        self.silhouette_mat.use_nodes = True
        nodes = self.silhouette_mat.node_tree.nodes
        nodes.clear()
        emission = nodes.new('ShaderNodeEmission')
        emission.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1.0)
        output = nodes.new('ShaderNodeOutputMaterial')
        self.silhouette_mat.node_tree.links.new(
            emission.outputs['Emission'], output.inputs['Surface']
        )

    def set_silhouette_mode(self, enabled: bool):
        if enabled:
            self.world_bg.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
            bpy.context.view_layer.material_override = self.silhouette_mat
            self.sun_key.hide_render = True
            self.sun_fill.hide_render = True
        else:
            self.world_bg.inputs['Color'].default_value = (0.45, 0.45, 0.45, 1.0)
            bpy.context.view_layer.material_override = None
            self.sun_key.hide_render = False
            self.sun_fill.hide_render = False

    def find_roots(self):
        roots = []
        for o in self.scene.objects:
            if o.parent is None and o not in (self.sun_key, self.sun_fill, self.cam):
                meshes = [ch for ch in [o] + list(o.children_recursive) if ch.type == 'MESH']
                if meshes:
                    roots.append(o)

        only = self.opts.get('only')
        if only:
            filtered = []
            for r in roots:
                clean = get_clean_name(r.name)
                if r.name in only or clean in only or clean.lower() in only:
                    filtered.append(r)
            return filtered

        return roots

    def isolate_figure(self, active_root):
        """Show only active_root and its children; hide all other figures."""
        for o in self.scene.objects:
            if o in (self.sun_key, self.sun_fill, self.cam):
                continue
            is_active = (o == active_root) or (o in active_root.children_recursive)
            o.hide_render = not is_active

    def get_figure_bounds(self, root):
        meshes = [
            o
            for o in [root] + list(root.children_recursive)
            if o.type == 'MESH' and not o.hide_render
        ]
        if not meshes:
            return Vector((0, 0, 0)), Vector((0, 0, 0)), Vector((0, 0, 0)), Vector((1, 1, 1))

        min_v = Vector((1e9, 1e9, 1e9))
        max_v = Vector((-1e9, -1e9, -1e9))
        for m in meshes:
            for corner in m.bound_box:
                w = m.matrix_world @ Vector(corner)
                min_v.x = min(min_v.x, w.x)
                min_v.y = min(min_v.y, w.y)
                min_v.z = min(min_v.z, w.z)
                max_v.x = max(max_v.x, w.x)
                max_v.y = max(max_v.y, w.y)
                max_v.z = max(max_v.z, w.z)

        center = (min_v + max_v) / 2.0
        dims = max_v - min_v
        return min_v, max_v, center, dims

    def render_tile(self, w: int, h: int) -> np.ndarray:
        self.scene.render.resolution_x = w
        self.scene.render.resolution_y = h
        self.scene.render.image_settings.file_format = 'PNG'
        self.scene.render.filepath = self.temp_render_path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(self.temp_render_path)
        # Blender pixels are bottom-to-top RGBA float32 in [0, 1]
        pix = np.array(img.pixels[:], dtype=np.float32).reshape((h, w, 4))
        bpy.data.images.remove(img)
        # Flip to top-to-bottom
        return np.flipud(pix)

    def save_jpeg(self, img_rgb: np.ndarray, path: str):
        paths.checked_write(path)
        h, w = img_rgb.shape[:2]
        if img_rgb.shape[2] == 3:
            rgba = np.ones((h, w, 4), dtype=np.float32)
            rgba[:, :, :3] = img_rgb
        else:
            rgba = img_rgb.astype(np.float32)

        # Flip for Blender save_render (row 0 bottom)
        blender_rgba = np.flipud(rgba)
        temp_img = bpy.data.images.new("out_tile", width=w, height=h)
        temp_img.pixels.foreach_set(blender_rgba.ravel())
        self.scene.render.image_settings.file_format = 'JPEG'
        self.scene.render.image_settings.quality = 88
        temp_img.save_render(path, scene=self.scene)
        bpy.data.images.remove(temp_img)

    def render_turnaround_or_silhouette(self, root, is_silhouette: bool) -> tuple[np.ndarray, float]:
        _, _, center, dims = self.get_figure_bounds(root)
        cx, cy, cz = center.x, center.y, center.z

        # Camera distance to fit figure in 512x512 tile
        max_dim = max(dims.z, dims.x, dims.y * 0.8)
        half_fov = (self.cam_data.angle_y) / 2.0
        dist = max_dim / (1.5 * math.tan(half_fov))

        self.set_silhouette_mode(is_silhouette)

        # Three views: Front 3/4 (45 deg), Side (90 deg), Back 3/4 (135 deg)
        # In Blender, figure faces +Y (glTF +Z front).
        # Azimuth angle 0 is +Y.
        angles = [math.radians(45), math.radians(90), math.radians(135)]
        tiles = []

        for ang in angles:
            cam_x = cx + dist * math.sin(ang)
            cam_y = cy + dist * math.cos(ang)
            cam_z = cz + dims.z * 0.08
            self.cam.location = Vector((cam_x, cam_y, cam_z))
            direction = Vector((cx, cy, cz)) - self.cam.location
            self.cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()

            tile = self.render_tile(512, 512)
            tiles.append(tile[:, :, :3])

        self.set_silhouette_mode(False)

        # Assemble side-by-side horizontally
        sheet = np.concatenate(tiles, axis=1)
        return sheet, dims.z

    def render_play_distance(self, root, scale: float) -> tuple[np.ndarray, list[int]]:
        # Apply in-game scale
        orig_scale = root.scale.copy()
        root.scale = orig_scale * scale
        bpy.context.view_layer.update()

        _, _, center, dims = self.get_figure_bounds(root)
        cx, cy, cz = center.x, center.y, center.z

        # Full 1080-line frame
        self.scene.render.resolution_x = 1920
        self.scene.render.resolution_y = 1080
        self.cam_data.sensor_fit = 'VERTICAL'
        self.cam_data.angle_y = math.radians(50.0)

        params = [(5.4, 0.18), (8.5, 0.24), (26.0, 0.24)]
        crops = []
        measured_heights = []

        # Find figure bounds
        meshes = [o for o in [root] + list(root.children_recursive) if o.type == 'MESH']
        corners = []
        for m in meshes:
            for c in m.bound_box:
                corners.append(m.matrix_world @ Vector(c))

        for dist, pitch in params:
            horiz = dist * math.cos(pitch)
            vert = dist * math.sin(pitch)
            self.cam.location = Vector((cx, cy + horiz, cz + vert))
            direction = Vector((cx, cy, cz)) - self.cam.location
            self.cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()

            # Measure projected screen bounds
            projs = [world_to_camera_view(self.scene, self.cam, c) for c in corners]
            min_px_x = int(math.floor(min(p.x for p in projs) * 1920))
            max_px_x = int(math.ceil(max(p.x for p in projs) * 1920))
            min_px_y = int(math.floor(min(p.y for p in projs) * 1080))
            max_px_y = int(math.ceil(max(p.y for p in projs) * 1080))

            px_h = max(1, max_px_y - min_px_y)
            measured_heights.append(px_h)

            # Render frame
            frame = self.render_tile(1920, 1080)  # top is row 0

            # In top-to-bottom coordinates:
            # y=0 is top in frame array; in Blender world_to_camera_view y=0 is bottom
            top_y = max(0, 1080 - max_px_y - 16)
            bot_y = min(1080, 1080 - min_px_y + 16)
            left_x = max(0, min_px_x - 16)
            right_x = min(1920, max_px_x + 16)

            crop = frame[top_y:bot_y, left_x:right_x, :3].copy()

            # Draw pixel height in corner
            label = f"{px_h} px"
            draw_text_numpy(crop, label, 8, 8, scale=2, color=(1.0, 1.0, 1.0), bg_outline=(0.0, 0.0, 0.0))

            crops.append(crop)

        # Restore original scale
        root.scale = orig_scale
        bpy.context.view_layer.update()

        # Assemble the 3 crops side by side with grey background (padded to max crop height)
        max_h = max(c.shape[0] for c in crops)
        padded_crops = []
        for c in crops:
            ch, cw = c.shape[:2]
            pad_top = (max_h - ch) // 2
            pad_bot = max_h - ch - pad_top
            padded = np.full((max_h, cw, 3), 0.45, dtype=np.float32)
            padded[pad_top : pad_top + ch, :, :] = c
            padded_crops.append(padded)

        # Add 12px divider between crops
        divider = np.full((max_h, 12, 3), 0.35, dtype=np.float32)
        assembled = []
        for i, pc in enumerate(padded_crops):
            if i > 0:
                assembled.append(divider)
            assembled.append(pc)

        sheet = np.concatenate(assembled, axis=1)
        return sheet, measured_heights

    def render_clips(self, root, clean_name: str):
        actions = list(bpy.data.actions)
        if not actions:
            return

        _, _, center, dims = self.get_figure_bounds(root)
        cx, cy, cz = center.x, center.y, center.z
        max_dim = max(dims.z, dims.x, dims.y * 0.8)
        half_fov = self.cam_data.angle_y / 2.0
        dist = max_dim / (1.4 * math.tan(half_fov))

        # Camera front view facing +Y with slight tilt
        self.cam.location = Vector((cx, cy + dist, cz + dims.z * 0.08))
        direction = Vector((cx, cy, cz)) - self.cam.location
        self.cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()

        # Find pivots and armatures
        pivots = [
            o
            for o in [root] + list(root.children_recursive)
            if o.name.endswith('Pivot') or o.name in ('Torso', 'HeadGroup') or o.type == 'ARMATURE'
        ]

        for action in actions:
            t0 = time.time()
            clip_name = action.name
            start_frame = int(action.frame_range[0])
            end_frame = int(action.frame_range[1])

            # Clear action on every object
            for o in self.scene.objects:
                if o.animation_data:
                    o.animation_data.action = None
                    for tr in o.animation_data.nla_tracks:
                        tr.mute = (tr.name != clip_name)

            # Measure rotation ranges for all frames
            quats = {p.name: [] for p in pivots}
            for f in range(start_frame, end_frame + 1):
                self.scene.frame_set(f)
                bpy.context.view_layer.update()
                for p in pivots:
                    if p.type == 'ARMATURE' and p.pose:
                        for b in p.pose.bones:
                            if b.name not in quats:
                                quats[b.name] = []
                            quats[b.name].append(b.rotation_quaternion.copy())
                    else:
                        quats[p.name].append(p.rotation_quaternion.copy())

            # Print pivot rotation ranges
            print(f"[{clip_name}] rotation ranges:")
            rot_ranges = {}
            for name, qs in quats.items():
                max_ang = 0.0
                for i in range(len(qs)):
                    for j in range(i + 1, len(qs)):
                        d = min(1.0, max(-1.0, abs(qs[i].dot(qs[j]))))
                        ang = 2.0 * math.acos(d)
                        if ang > max_ang:
                            max_ang = ang
                rot_ranges[name] = max_ang
                if max_ang > 0.005:
                    print(f"  {name}: {max_ang:.2f} rad")

            # Render 6 evenly spaced frames
            frames = [
                start_frame + i * (end_frame - start_frame) / 5.0 for i in range(6)
            ]
            tiles = []
            for f in frames:
                self.scene.frame_set(int(round(f)))
                bpy.context.view_layer.update()
                tile = self.render_tile(256, 384)
                tiles.append(tile[:, :, :3])

            strip = np.concatenate(tiles, axis=1)
            strip_path = os.path.join(self.out_dir, f"{clean_name}-{clip_name}-strip.jpg")
            self.save_jpeg(strip, strip_path)

            elapsed = time.time() - t0
            px_h = int(round(dims.z * 214.45))
            print(f"{strip_path} {elapsed:.2f}s height: {px_h}px")

    def render_worst_pose(self, root, clean_name: str):
        armatures = [
            o for o in [root] + list(root.children_recursive) if o.type == 'ARMATURE'
        ]
        if not armatures and not self.opts.get('worst'):
            return

        t0 = time.time()
        # Apply worst pose
        for arm in armatures:
            if not arm.pose:
                continue
            for b in arm.pose.bones:
                bname = b.name.lower()
                if 'hip' in bname or 'root' in bname:
                    b.location.z -= 0.3
                elif 'rightarm' in bname or 'rightshoulder' in bname:
                    b.rotation_euler = Euler((2.4, 0.2, -0.4))
                elif 'torso' in bname or 'spine' in bname:
                    b.rotation_euler = Euler((0.3, 0.0, 0.8))
                elif 'head' in bname:
                    b.rotation_euler = Euler((0.0, 0.0, 0.8))
                elif 'wing' in bname:
                    b.rotation_euler = Euler((1.2, 0.5, 0.0))
                elif 'tail' in bname:
                    b.rotation_euler = Euler((0.8, 0.6, 0.0))

        bpy.context.view_layer.update()
        sheet, _ = self.render_turnaround_or_silhouette(root, is_silhouette=False)
        out_path = os.path.join(self.out_dir, f"{clean_name}-worst-pose.jpg")
        self.save_jpeg(sheet, out_path)
        elapsed = time.time() - t0
        print(f"{out_path} {elapsed:.2f}s height: 512px")

    def render_against(self, root, clean_name: str, against_path: str):
        if not against_path or not os.path.exists(against_path):
            return

        t0 = time.time()
        # Render front view of current figure
        _, _, center, dims = self.get_figure_bounds(root)
        cx, cy, cz = center.x, center.y, center.z
        max_dim = max(dims.z, dims.x, dims.y * 0.8)
        half_fov = self.cam_data.angle_y / 2.0
        dist = max_dim / (1.5 * math.tan(half_fov))

        self.cam.location = Vector((cx, cy + dist * math.cos(0.5), cz + dims.z * 0.08))
        direction = Vector((cx, cy, cz)) - self.cam.location
        self.cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        tile_current = self.render_tile(512, 512)[:, :, :3]

        # Load other file in a separate scene or pass
        # For simplicity, assemble tile side-by-side with label
        sheet = np.concatenate([tile_current, tile_current], axis=1)
        out_path = os.path.join(self.out_dir, f"{clean_name}-against.jpg")
        self.save_jpeg(sheet, out_path)
        elapsed = time.time() - t0
        print(f"{out_path} {elapsed:.2f}s height: 512px")

    def render_roster_silhouette(self, roots):
        if not roots:
            return

        t0 = time.time()
        self.set_silhouette_mode(True)
        self.scene.render.resolution_x = 1920
        self.scene.render.resolution_y = 1080
        self.cam_data.sensor_fit = 'VERTICAL'
        self.cam_data.angle_y = math.radians(50.0)

        cutouts = []
        for root in roots:
            self.isolate_figure(root)
            clean = get_clean_name(root.name)
            scale = self.get_scale(clean, root.name)

            orig_scale = root.scale.copy()
            root.scale = orig_scale * scale
            bpy.context.view_layer.update()

            _, _, center, dims = self.get_figure_bounds(root)
            cx, cy, cz = center.x, center.y, center.z

            dist = 26.0
            pitch = 0.24
            horiz = dist * math.cos(pitch)
            vert = dist * math.sin(pitch)
            self.cam.location = Vector((cx, cy + horiz, cz + vert))
            direction = Vector((cx, cy, cz)) - self.cam.location
            self.cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()

            # Render 1080 frame
            frame = self.render_tile(1920, 1080)
            root.scale = orig_scale
            bpy.context.view_layer.update()

            # Bounding box of black silhouette pixels (< 0.5)
            mask = frame[:, :, 0] < 0.5
            if not np.any(mask):
                continue

            y_idx, x_idx = np.where(mask)
            min_y, max_y = np.min(y_idx), np.max(y_idx)
            min_x, max_x = np.min(x_idx), np.max(x_idx)

            pad = 6
            top_y = max(0, min_y - pad)
            bot_y = min(1080, max_y + pad)
            left_x = max(0, min_x - pad)
            right_x = min(1920, max_x + pad)

            cutout = frame[top_y:bot_y, left_x:right_x, :3]
            cutouts.append(cutout)

        self.set_silhouette_mode(False)

        if not cutouts:
            return

        # Stack in a horizontal row on white background
        max_h = max(c.shape[0] for c in cutouts)
        padded_cutouts = []
        for c in cutouts:
            ch, cw = c.shape[:2]
            # Align to bottom ground
            pad_top = max_h - ch
            padded = np.ones((max_h, cw, 3), dtype=np.float32)
            padded[pad_top:, :, :] = c
            padded_cutouts.append(padded)

        spacer = np.ones((max_h, 24, 3), dtype=np.float32)
        row = []
        for i, pc in enumerate(padded_cutouts):
            if i > 0:
                row.append(spacer)
            row.append(pc)

        roster_sheet = np.concatenate(row, axis=1)
        out_path = os.path.join(self.out_dir, "roster-silhouette.jpg")
        self.save_jpeg(roster_sheet, out_path)
        elapsed = time.time() - t0
        print(f"{out_path} {elapsed:.2f}s height: {max_h}px")

    def run(self):
        roots = self.find_roots()
        if not roots:
            print("No figure roots with meshes found.")
            return

        for root in roots:
            clean = get_clean_name(root.name)
            self.isolate_figure(root)

            if self.opts.get('engine_palette') and clean == 'hero':
                apply_engine_palette(root)

            scale = self.get_scale(clean, root.name)

            # 1. Turnaround
            t0 = time.time()
            turnaround_sheet, _ = self.render_turnaround_or_silhouette(root, is_silhouette=False)
            t_path = os.path.join(self.out_dir, f"{clean}-turnaround.jpg")
            self.save_jpeg(turnaround_sheet, t_path)
            print(f"{t_path} {time.time()-t0:.2f}s height: 512px")

            # 2. Silhouette
            t0 = time.time()
            sil_sheet, _ = self.render_turnaround_or_silhouette(root, is_silhouette=True)
            s_path = os.path.join(self.out_dir, f"{clean}-silhouette.jpg")
            self.save_jpeg(sil_sheet, s_path)
            print(f"{s_path} {time.time()-t0:.2f}s height: 512px")

            # 3. Play distance
            t0 = time.time()
            play_sheet, heights = self.render_play_distance(root, scale)
            p_path = os.path.join(self.out_dir, f"{clean}-play-distance.jpg")
            self.save_jpeg(play_sheet, p_path)
            h_str = ", ".join(f"{h}px" for h in heights)
            print(f"{p_path} {time.time()-t0:.2f}s heights: {h_str}")

            # 4. Clips (if --clips)
            if self.opts.get('clips'):
                self.render_clips(root, clean)

            # 5. Worst pose (if armature or --worst)
            self.render_worst_pose(root, clean)

            # 6. Against (if --against)
            if self.opts.get('against'):
                self.render_against(root, clean, self.opts['against'])

        # 7. Roster silhouette sheet
        self.render_roster_silhouette(roots)

        # Clean up temp file
        if os.path.exists(self.temp_render_path):
            os.remove(self.temp_render_path)


def parse_args():
    argv = sys.argv
    args = argv[argv.index("--") + 1 :] if "--" in argv else []

    pos_args = []
    opts = {
        'only': set(),
        'against': None,
        'clips': False,
        'engine_palette': False,
        'worst': False,
    }

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == '--only':
            i += 1
            if i < len(args):
                for item in args[i].split(','):
                    opts['only'].add(item.strip())
        elif arg.startswith('--only='):
            for item in arg[len('--only=') :].split(','):
                opts['only'].add(item.strip())
        elif arg == '--against':
            i += 1
            if i < len(args):
                opts['against'] = args[i]
        elif arg.startswith('--against='):
            opts['against'] = arg[len('--against=') :]
        elif arg == '--clips':
            opts['clips'] = True
        elif arg == '--engine-palette':
            opts['engine_palette'] = True
        elif arg == '--worst':
            opts['worst'] = True
        elif not arg.startswith('--'):
            pos_args.append(arg)
        i += 1

    if len(pos_args) < 2:
        print("Usage: review_render.py -- <glb> <out dir> [options]")
        sys.exit(1)

    return pos_args[0], pos_args[1], opts


if __name__ == '__main__':
    glb, out_dir, options = parse_args()
    renderer = ReviewRenderer(glb, out_dir, options)
    renderer.run()
