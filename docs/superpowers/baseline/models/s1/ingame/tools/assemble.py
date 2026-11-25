import os, sys
from PIL import Image, ImageDraw
MP = "/home/rdrosa/gitprojects/allan/osrs-like-wp/MP"
OUT = f"{MP}/docs/superpowers/baseline/models/s1/ingame"
SRC = f"{MP}/scratch/s3b/out"
os.makedirs(OUT, exist_ok=True)
LABELS = ["base", "a3", "b3", "a1", "b1"]
NAMES = {"base": "today", "a3": "a3 route a, 3 mats", "b3": "b3 route b, 3 mats", "a1": "a1 route a, 1 mat", "b1": "b1 route b, 1 mat"}
Q = 80
ARCH = "archers beside it: today's rigid models"

def load(l, n):
    return Image.open(f"{SRC}/{l}/{l}-{n}.png").convert("RGB")

def grid(tiles, cols, tw, th, caps=None, foot=None):
    rows = (len(tiles) + cols - 1) // cols
    g = Image.new("RGB", (cols * tw, rows * th + (14 if foot else 0)), (20, 20, 20))
    d = ImageDraw.Draw(g)
    for i, t in enumerate(tiles):
        t = t.resize((tw, th), Image.LANCZOS)
        g.paste(t, ((i % cols) * tw, (i // cols) * th))
        if caps:
            x, y = (i % cols) * tw + 4, (i // cols) * th + 3
            d.rectangle([x - 2, y - 1, x + 6 * len(caps[i]) + 2, y + 11], fill=(0, 0, 0))
            d.text((x, y), caps[i], fill=(255, 255, 255))
    if foot:
        d.text((4, rows * th + 1), foot, fill=(230, 230, 230))
    return g

def save(img, name):
    p = f"{OUT}/{name}"
    img.save(p, "JPEG", quality=Q, optimize=True)
    return os.path.getsize(p)

total = 0
for l in LABELS:
    box = (360, 340, 940, 700)
    hs = ["stand", "walk", "attack", "flinch", "windup"]
    t = [load(l, f"noon-{h}").crop(box) for h in hs]
    total += save(grid(t, 3, 300, 187, [f"{NAMES[l]}: {h}" for h in ["standing", "walking", "attack", "flinch", "wind-up"]], f"left figure of each tile: the {'raider (today)' if l=='base' else 'skinned raider'}; " + ARCH), f"{l}-poses-noon.jpg")
    box2 = (240, 330, 1040, 720)
    t = [load(l, n).crop(box2) for n in ["dusk-attack-yaw0", "dusk-attack-yaw2", "dusk-windup-yaw4", "dusk-shadow-top"]]
    total += save(grid(t, 2, 380, 185, [f"{NAMES[l]}: dusk {c}" for c in ["attack, camera yaw 0", "attack, yaw 2.2", "wind-up, yaw 4.2", "attack, from above"]], ARCH), f"{l}-dusk.jpg")
    t = [load(l, f"shadow-y{y}-{h}").crop((380, 230, 980, 610)) for y in ["0.6", "2.4"] for h in ["stand", "attack", "windup", "flinch"]]
    total += save(grid(t, 4, 250, 159, [f"{NAMES[l].split()[0]} yaw {y} {h}" for y in ["0.6", "2.4"] for h in ["stand", "attack", "wind-up", "flinch"]], "raider alone, phase 0.62, pitch 1.0, outline on"), f"{l}-shadow.jpg")
    if l != "base":
        t = [load(l, f"clip-{c}-{i}").crop((470, 330, 810, 700)) for c in ["Walk", "Slash"] for i in range(6)]
        total += save(grid(t, 6, 150, 163, [f"{c} {i}" for c in ["Walk", "Slash"] for i in range(6)]), f"{l}-hero-clips.jpg")
edge, caps = [], []
for l in LABELS:
    edge += [load(l, "edge-in").crop((960, 330, 1280, 720)), load(l, "edge-half").crop((960, 330, 1280, 720)), load(l, "edge-left-half").crop((0, 200, 320, 590))]
    caps += [f"{NAMES[l].split()[0]} right edge", "half off right", "half off left"]
total += save(grid(edge, 3, 170, 207, caps, "raider alone, attack pose, outline on; archers hidden"), "edge.jpg")
# distance sheets: rows = builds, columns = standing, attack
def crop26(im): return im.crop((520, 310, 780, 450)).resize((520, 280), Image.LANCZOS)
def crop85(im): return im.crop((340, 300, 940, 660))
for d, fn, tw, th in [("26", crop26, 300, 161), ("8.5", crop85, 290, 174)]:
    t, c = [], []
    for l in LABELS:
        for h in ["stand", "attack"]:
            t.append(fn(load(l, f"dist{d}-{h}"))); c.append(f"{NAMES[l]}: {h}")
    total += save(grid(t, 2, tw, th, c, ("distance 26, about 85 px tall, crop enlarged 2x; " if d == "26" else "distance 8.5; ") + "left figure of each tile is the raider, the other two are today's rigid archers"), f"distance-{d}.jpg")
# camp, natural game (perf shot)
t = [load(l, "../perf-camp") if False else Image.open(f"{SRC}/{l}/perf-camp.png").convert("RGB") for l in LABELS]
total += save(grid(t, 2, 360, 203, [NAMES[l] for l in LABELS], "three_kettle_camp, balanced, noon, monsters wandering; every goblin on screen is the raider in its build, the archers are today's"), "camp.jpg")
# P-e
heads, hands, caps = [], [], []
for l in LABELS:
    im = load(l, "close-front")
    heads.append(im.crop((530, 380, 770, 500))); hands.append(im.crop((500, 470, 780, 620))); caps.append(NAMES[l])
gh = grid(heads, len(heads), 240, 120, caps)
gd = grid(hands, len(hands), 240, 128, None)
g = Image.new("RGB", (gh.width, gh.height + gd.height)); g.paste(gh, (0, 0)); g.paste(gd, (0, gh.height))
total += save(g, "close-head-hands.jpg")
print("total bytes", total)
