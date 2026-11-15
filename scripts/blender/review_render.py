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
import re
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
        if not os.path.isfile(scales_path):
            raise FileNotFoundError(f"review scales table missing: {scales_path}")
        with open(scales_path, "r", encoding="utf-8") as f:
            self.scales = json.load(f)

        # Temporary files directory for still renders
        self.temp_render_path = paths.checked_write(
            os.path.join(self.out_dir, ".temp_render.png")
        )

        self._setup_scene()

    def get_scale(self, clean_name: str, root_name: str) -> float:
        for key in (clean_name, root_name):
            if key in self.scales:
                return self.scales[key]
        raise KeyError(
            f"no in-game scale for figure '{clean_name}' (root '{root_name}') "
            f"in scripts/blender/review_scales.json; add its entry"
        )

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
        self.scene.render.image_settings.color_mode = 'RGBA'
        # Transparent film: the alpha channel is the figure's silhouette, used to
        # measure pixel heights; render_tile composites it over the world colour.
        self.scene.render.film_transparent = True
        self.bg_display = 0.7  # sRGB display value of the 0.45 grey world

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
            self.bg_display = 1.0
            bpy.context.view_layer.material_override = self.silhouette_mat
            self.sun_key.hide_render = True
            self.sun_fill.hide_render = True
        else:
            self.world_bg.inputs['Color'].default_value = (0.45, 0.45, 0.45, 1.0)
            self.bg_display = 0.7
            bpy.context.view_layer.material_override = None
            self.sun_key.hide_render = False
            self.sun_fill.hide_render = False

    def find_roots(self):
        roots = []
        for o in self.scene.objects:
            if o.parent is None and o not in (self.sun_key, self.sun_fill, self.cam):
                # skip the importer's bone-shape helper objects
                if all(c.name.startswith('glTF_not_exported') for c in o.users_collection):
                    continue
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
        self.scene.render.image_settings.color_mode = 'RGBA'  # save_jpeg leaves RGB behind
        self.scene.render.filepath = self.temp_render_path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(self.temp_render_path)
        # Blender pixels are bottom-to-top RGBA float32 in [0, 1]
        pix = np.array(img.pixels[:], dtype=np.float32).reshape((h, w, 4))
        bpy.data.images.remove(img)
        # Flip to top-to-bottom; composite over the world colour, keep alpha in channel 3
        pix = np.flipud(pix)
        a = pix[:, :, 3:4]
        pix[:, :, :3] = pix[:, :, :3] * a + self.bg_display * (1.0 - a)
        return pix

    @staticmethod
    def mask_height(tile: np.ndarray) -> int:
        """Pixel height of the rendered figure: rows holding any alpha > 0.5, clipped to the tile."""
        rows = np.where((tile[:, :, 3] > 0.5).any(axis=1))[0]
        return int(rows[-1] - rows[0] + 1) if rows.size else 0

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
        height = 0

        for ang in angles:
            cam_x = cx + dist * math.sin(ang)
            cam_y = cy + dist * math.cos(ang)
            cam_z = cz + dims.z * 0.08
            self.cam.location = Vector((cam_x, cam_y, cam_z))
            direction = Vector((cx, cy, cz)) - self.cam.location
            self.cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()

            tile = self.render_tile(512, 512)
            height = max(height, self.mask_height(tile))
            tiles.append(tile[:, :, :3])

        self.set_silhouette_mode(False)

        # Assemble side-by-side horizontally
        sheet = np.concatenate(tiles, axis=1)
        return sheet, height

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
        for dist, pitch in params:
            horiz = dist * math.cos(pitch)
            vert = dist * math.sin(pitch)
            self.cam.location = Vector((cx, cy + horiz, cz + vert))
            direction = Vector((cx, cy, cz)) - self.cam.location
            self.cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()

            # Render frame (row 0 is top) and measure the figure from its alpha mask
            frame = self.render_tile(1920, 1080)
            ys, xs = np.where(frame[:, :, 3] > 0.5)
            if ys.size == 0:
                raise RuntimeError(f"play distance {dist}: figure '{root.name}' not visible in frame")
            px_h = int(ys.max() - ys.min() + 1)  # clipped to the 1080-line frame
            measured_heights.append(px_h)

            top_y = max(0, int(ys.min()) - 16)
            bot_y = min(1080, int(ys.max()) + 17)
            left_x = max(0, int(xs.min()) - 16)
            right_x = min(1920, int(xs.max()) + 17)

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
            px_h = 0
            for f in frames:
                self.scene.frame_set(int(round(f)))
                bpy.context.view_layer.update()
                tile = self.render_tile(256, 384)
                px_h = max(px_h, self.mask_height(tile))
                tiles.append(tile[:, :, :3])

            strip = np.concatenate(tiles, axis=1)
            strip_path = os.path.join(self.out_dir, f"{clean_name}-{clip_name}-strip.jpg")
            self.save_jpeg(strip, strip_path)

            elapsed = time.time() - t0
            print(f"{strip_path} {elapsed:.2f}s height: {px_h}px (measured, 384-line tile)")

    def render_worst_pose(self, root, clean_name: str):
        armatures = [
            o for o in [root] + list(root.children_recursive) if o.type == 'ARMATURE'
        ]
        if not armatures:
            if self.opts.get('worst'):
                print(f"{clean_name}: no armature, worst-pose sheet skipped")
            return

        t0 = time.time()
        # Hold what the pose touches so it can be restored: animation, NLA mutes, pose bones.
        saved = []
        for arm in armatures:
            ad = arm.animation_data
            anim = (ad.action, [tr.mute for tr in ad.nla_tracks]) if ad else None
            bones = [
                (b, b.rotation_mode, b.location.copy(), b.rotation_quaternion.copy(),
                 b.rotation_euler.copy(), b.scale.copy())
                for b in arm.pose.bones
            ]
            saved.append((arm, anim, bones))
            if ad:  # animation would overwrite the pose at render time
                ad.action = None
                for tr in ad.nla_tracks:
                    tr.mute = True
            for b in arm.pose.bones:
                b.rotation_mode = 'QUATERNION'
                b.location = (0.0, 0.0, 0.0)
                b.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))
                b.scale = (1.0, 1.0, 1.0)

        try:
            for arm in armatures:
                for b in arm.pose.bones:
                    bname = b.name.lower()
                    if b.parent is None:
                        # Crouch: drop 0.3 m along armature Z, expressed in the bone's rest space
                        # (bones run along Y, so a plain location.z would not lower the figure).
                        down = b.bone.matrix_local.to_3x3().inverted() @ Vector((0.0, 0.0, -0.3))
                        b.location = down
                    elif 'rightarm' in bname or 'rightshoulder' in bname:
                        b.rotation_quaternion = Euler((2.4, 0.2, -0.4)).to_quaternion()
                    elif 'torso' in bname or 'spine' in bname:
                        b.rotation_quaternion = Euler((0.3, 0.0, 0.8)).to_quaternion()
                    elif 'head' in bname:
                        b.rotation_quaternion = Euler((0.0, 0.0, 0.8)).to_quaternion()
                    elif 'wing' in bname:
                        b.rotation_quaternion = Euler((1.2, 0.5, 0.0)).to_quaternion()
                    elif 'tail' in bname:
                        b.rotation_quaternion = Euler((0.8, 0.6, 0.0)).to_quaternion()

            bpy.context.view_layer.update()
            sheet, px_h = self.render_turnaround_or_silhouette(root, is_silhouette=False)
            out_path = os.path.join(self.out_dir, f"{clean_name}-worst-pose.jpg")
            self.save_jpeg(sheet, out_path)
            print(f"{out_path} {time.time()-t0:.2f}s height: {px_h}px (measured)")
        finally:
            for arm, anim, bones in saved:
                for b, mode, loc, quat, eul, scl in bones:
                    b.rotation_mode = mode
                    b.location = loc
                    b.rotation_quaternion = quat
                    b.rotation_euler = eul
                    b.scale = scl
                if anim:
                    arm.animation_data.action = anim[0]
                    for tr, m in zip(arm.animation_data.nla_tracks, anim[1]):
                        tr.mute = m
            bpy.context.view_layer.update()

    def render_against(self, root, clean_name: str, against_path: str):
        against_path = os.path.abspath(against_path)
        if not os.path.isfile(against_path):
            raise FileNotFoundError(f"--against file not found: {against_path}")

        t0 = time.time()
        # One camera for both tiles, framed on the current figure.
        _, _, center, dims = self.get_figure_bounds(root)
        cx, cy, cz = center.x, center.y, center.z
        max_dim = max(dims.z, dims.x, dims.y * 0.8)
        half_fov = self.cam_data.angle_y / 2.0
        dist = max_dim / (1.5 * math.tan(half_fov))

        self.cam.location = Vector((cx, cy + dist * math.cos(0.5), cz + dims.z * 0.08))
        direction = Vector((cx, cy, cz)) - self.cam.location
        self.cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        tile_current = self.render_tile(512, 512)

        # Import the other file, find the root that matches this figure, render it alone.
        before_objs = set(self.scene.objects)
        before_actions = set(bpy.data.actions)
        bpy.ops.import_scene.gltf(filepath=against_path)
        new_objs = [o for o in self.scene.objects if o not in before_objs]
        new_roots = [
            o for o in new_objs
            if o.parent is None
            and any(c.type == 'MESH' for c in [o] + list(o.children_recursive))
        ]
        match = [
            r for r in new_roots
            if get_clean_name(re.sub(r"\.\d{3}$", "", r.name)) == clean_name
        ]
        try:
            if len(match) != 1:
                raise RuntimeError(
                    f"--against {against_path}: expected one root for '{clean_name}', "
                    f"found {[r.name for r in new_roots]}"
                )
            self.isolate_figure(match[0])
            bpy.context.view_layer.update()
            # Same camera relative to the figure: a figure placed elsewhere in its file
            # (unskinned monsters sit at their own spots) is framed the same way.
            _, _, center_other, _ = self.get_figure_bounds(match[0])
            self.cam.location = self.cam.location + (center_other - center)
            bpy.context.view_layer.update()
            tile_other = self.render_tile(512, 512)
        finally:
            for o in new_objs:
                bpy.data.objects.remove(o, do_unlink=True)
            for a in [a for a in bpy.data.actions if a not in before_actions]:
                bpy.data.actions.remove(a)
            self.isolate_figure(root)

        # Left is the against file (before), right is the current file (after).
        sheet = np.concatenate([tile_other[:, :, :3], tile_current[:, :, :3]], axis=1)
        px_h = max(self.mask_height(tile_other), self.mask_height(tile_current))
        out_path = os.path.join(self.out_dir, f"{clean_name}-against.jpg")
        self.save_jpeg(sheet, out_path)
        print(f"{out_path} {time.time()-t0:.2f}s height: {px_h}px (measured, left=against, right=current)")

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
        measured = []
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
            measured.append(int(max_y - min_y + 1))

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
        print(f"{out_path} {elapsed:.2f}s height: {max(measured)}px (measured)")

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
            turnaround_sheet, th = self.render_turnaround_or_silhouette(root, is_silhouette=False)
            t_path = os.path.join(self.out_dir, f"{clean}-turnaround.jpg")
            self.save_jpeg(turnaround_sheet, t_path)
            print(f"{t_path} {time.time()-t0:.2f}s height: {th}px (measured, 512 tile)")

            # 2. Silhouette
            t0 = time.time()
            sil_sheet, sh = self.render_turnaround_or_silhouette(root, is_silhouette=True)
            s_path = os.path.join(self.out_dir, f"{clean}-silhouette.jpg")
            self.save_jpeg(sil_sheet, s_path)
            print(f"{s_path} {time.time()-t0:.2f}s height: {sh}px (measured, 512 tile)")

            # 3. Play distance
            t0 = time.time()
            play_sheet, heights = self.render_play_distance(root, scale)
            p_path = os.path.join(self.out_dir, f"{clean}-play-distance.jpg")
            self.save_jpeg(play_sheet, p_path)
            h_str = ", ".join(f"{h}px" for h in heights)
            print(f"{p_path} {time.time()-t0:.2f}s heights (measured, 1080 frame): {h_str}")

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
