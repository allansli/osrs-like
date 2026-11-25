# usage: python3 cutview.py <glb> <out.png> [--views "az,el,sunaz;..."] [--size N] [--zoom "cx,cy,cz,scale"]
# A software picture of the goblin as the engine's cut shade draws it (materials.ts, FACET_CUT):
# flat normal per triangle, the key banded 0.22 / 0.62 / 1.0 at n.l 0.15 and 0.55, hemisphere fill,
# the family's albedo tile mean, noon frame of src/data/look.ts, ACES and sRGB. No cast shadow, no
# texture detail, a 2 px silhouette line standing in for the outline. Not the game: S3d captures that.
import json, struct, sys, math
import numpy as np
from PIL import Image

def s2l(v): return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
def hexlin(h): return s2l(np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]))
def tile_mean(path): return s2l(np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255).reshape(-1, 3).mean(0)

args = sys.argv[1:]
glb, out = args[0], args[1]
opt = dict(zip(args[2::2], args[3::2]))
size = int(opt.get("--size", 560))
views = [tuple(float(x) for x in v.split(",")) for v in opt.get("--views", "25,20,-40;90,20,-40;205,20,-40;25,20,140").split(";")]
zoom = [float(x) for x in opt["--zoom"].split(",")] if "--zoom" in opt else [0.0, 0.92, 0.0, 2.3]

buf = open(glb, "rb").read()
jl = struct.unpack_from("<I", buf, 12)[0]
J = json.loads(buf[20:20 + jl]); B = buf[20 + jl + 8:]
CT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
def acc(i):
    a = J["accessors"][i]; bv = J["bufferViews"][a["bufferView"]]
    dt = np.dtype("<" + CT[a["componentType"]]); n = NC[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0); stride = bv.get("byteStride", dt.itemsize * n)
    arr = np.ndarray((a["count"], n), dt, B, off, (stride, dt.itemsize)).astype(np.float64)
    if a.get("normalized"): arr /= np.iinfo(dt).max
    return arr

TILES = {"skin": tile_mean("public/textures/creatures/goblin-hide.png"), "wood": tile_mean("public/textures/wood.png"), "bronze": tile_mean("public/textures/iron.png")}
P, C, T = [], [], []
base = 0
for node in J["nodes"]:
    if node.get("name") not in ("goblin_body", "goblin_wood", "goblin_metal"): continue
    for prim in J["meshes"][node["mesh"]]["primitives"]:
        mat = J["materials"][prim["material"]]["name"]
        tile = next(v for k, v in TILES.items() if k in mat)
        pos = acc(prim["attributes"]["POSITION"]); col = acc(prim["attributes"]["COLOR_0"])[:, :3] * tile
        idx = acc(prim["indices"]).astype(int).reshape(-1, 3)
        P.append(pos); C.append(col); T.append(idx + base); base += len(pos)
P, C, T = np.vstack(P), np.vstack(C), np.vstack(T)
print("triangles", len(T), "vertices", len(P), "bounds", P.min(0).round(3), P.max(0).round(3))

KEY = hexlin("#fff4dc") * 0.95; SKY = hexlin("#9cc0ea"); GROUND = hexlin("#6a6a4e"); EXPO = 1.6
def aces(c):
    c = c * EXPO / 0.6
    m1 = np.array([[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]])
    m2 = np.array([[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]])
    v = c @ m1.T; v = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081)
    v = np.clip(v @ m2.T, 0, 1)
    return np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)
def step(e, x): t = np.clip((x - (e - 0.02)) / 0.04, 0, 1); return t * t * (3 - 2 * t)
def band(x): return (0.22 + (0.62 - 0.22) * step(0.15, x)) * (1 - step(0.55, x)) + step(0.55, x)
GRASS = np.array([0.40, 0.60, 0.26])

tiles = []
for az, el, sunaz in views:
    a, e = math.radians(az), math.radians(el)
    # camera looks at the figure from direction f (three space; the goblin's front is -Z, az 0 = from the front)
    f = np.array([math.sin(a) * math.cos(e), math.sin(e), -math.cos(a) * math.cos(e)])
    r = np.cross([0, 1, 0], f); r /= np.linalg.norm(r); u = np.cross(f, r)
    s = math.radians(sunaz + az); sun = np.array([math.sin(s) * math.cos(math.radians(62)), math.sin(math.radians(62)), -math.cos(s) * math.cos(math.radians(62))])
    Q = P - np.array(zoom[:3]); k = size / zoom[3]
    X = Q @ r * k + size / 2; Y = size / 2 - Q @ u * k; Z = Q @ f
    img = np.tile(GRASS, (size, size, 1)); zb = np.full((size, size), -1e9); mask = np.zeros((size, size), bool)
    for t in T:
        p = P[t]; n = np.cross(p[1] - p[0], p[2] - p[0]); ln = np.linalg.norm(n)
        if ln == 0: continue
        n /= ln
        if n @ f < 0: n = -n  # double sided
        x, y, z = X[t], Y[t], Z[t]
        x0, x1 = max(int(x.min()), 0), min(int(x.max()) + 1, size - 1); y0, y1 = max(int(y.min()), 0), min(int(y.max()) + 1, size - 1)
        if x0 > x1 or y0 > y1: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
        if abs(d) < 1e-9: continue
        w0 = ((y[1] - y[2]) * (gx - x[2]) + (x[2] - x[1]) * (gy - y[2])) / d
        w1 = ((y[2] - y[0]) * (gx - x[2]) + (x[0] - x[2]) * (gy - y[2])) / d
        w2 = 1 - w0 - w1; inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        zz = w0 * z[0] + w1 * z[1] + w2 * z[2]
        sub = zb[y0:y1 + 1, x0:x1 + 1]; hit = inside & (zz > sub)
        if not hit.any(): continue
        nl = n @ sun
        light = (KEY * band(min(max(nl, 0), 1)) if nl > 0 else 0) + GROUND + (SKY - GROUND) * (0.5 * n[1] + 0.5) + 0.04
        colr = (w0[..., None] * C[t[0]] + w1[..., None] * C[t[1]] + w2[..., None] * C[t[2]]) * light
        sub[hit] = zz[hit]; img[y0:y1 + 1, x0:x1 + 1][hit] = aces(colr[hit]); mask[y0:y1 + 1, x0:x1 + 1][hit] = True
    grow = mask.copy()
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            grow |= np.roll(np.roll(mask, dy, 0), dx, 1)
    img[grow & ~mask] = 0.02
    tiles.append(img)
Image.fromarray((np.hstack(tiles) * 255).astype(np.uint8)).save(out)
print("wrote", out)
