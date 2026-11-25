import json, os, sys
from PIL import Image, ImageDraw
MP = "/home/rdrosa/gitprojects/allan/osrs-like-wp/MP"
OUT = f"{MP}/docs/superpowers/baseline/models/s1/ingame"
SRC = f"{MP}/scratch/s3/out"
os.makedirs(OUT, exist_ok=True)
LABELS = ["base", "a3", "b3", "a1", "b1"]
NAMES = {"base": "today", "a3": "a3 route a, 3 mats", "b3": "b3 route b, 3 mats", "a1": "a1 route a, 1 mat", "b1": "b1 route b, 1 mat"}
Q = 80

def load(l, n):
    return Image.open(f"{SRC}/{l}/{l}-{n}.png").convert("RGB")

def grid(tiles, cols, tw, th, caps=None):
    rows = (len(tiles) + cols - 1) // cols
    g = Image.new("RGB", (cols * tw, rows * th), (20, 20, 20))
    d = ImageDraw.Draw(g)
    for i, t in enumerate(tiles):
        t = t.resize((tw, th), Image.LANCZOS)
        g.paste(t, ((i % cols) * tw, (i // cols) * th))
        if caps:
            x, y = (i % cols) * tw + 4, (i // cols) * th + 3
            d.rectangle([x - 2, y - 1, x + 7 * len(caps[i]) + 2, y + 11], fill=(0, 0, 0))
            d.text((x, y), caps[i], fill=(255, 255, 255))
    return g

def save(img, name):
    p = f"{OUT}/{name}"
    img.save(p, "JPEG", quality=Q, optimize=True)
    return os.path.getsize(p)

total = 0
for l in LABELS:
    if not os.path.exists(f"{SRC}/{l}/result.json"):
        print("skip", l); continue
    # poses at noon: raider and two rigid archers
    box = (360, 340, 940, 700)
    t = [load(l, f"noon-{h}").crop(box) for h in ["stand", "walk", "attack", "flinch", "windup"]]
    total += save(grid(t, 3, 386, 240, [f"{NAMES[l]}: {h}" for h in ["standing", "walking", "attack", "flinch", "wind-up"]]), f"{l}-poses-noon.jpg")
    # dusk: arm in light and in shadow, ground shadow from above
    box2 = (240, 330, 1040, 720)
    t = [load(l, n).crop(box2) for n in ["dusk-attack-yaw0", "dusk-attack-yaw2", "dusk-windup-yaw4", "dusk-shadow-top"]]
    total += save(grid(t, 2, 480, 234, [f"{NAMES[l]}: dusk {c}" for c in ["attack, camera yaw 0", "attack, yaw 2.2", "wind-up, yaw 4.2", "attack, from above"]]), f"{l}-dusk.jpg")
    # edge
    t = [load(l, "edge-in").crop((960, 330, 1280, 720)), load(l, "edge-half").crop((960, 330, 1280, 720)), load(l, "edge-left-half").crop((0, 330, 320, 720))]
    total += save(grid(t, 3, 240, 292, [f"{NAMES[l][:2]} right edge", "half off right", "half off left"]), f"{l}-edge.jpg")
    if l != "base" and os.path.exists(f"{SRC}/{l}/{l}-clip-Walk-0.png"):
        t = [load(l, f"clip-{c}-{i}").crop((470, 330, 810, 700)) for c in ["Walk", "Slash"] for i in range(6)]
        total += save(grid(t, 6, 200, 218, [f"{c} {i}" for c in ["Walk", "Slash"] for i in range(6)]), f"{l}-hero-clips.jpg")
# P-e: head and hands, five columns
heads, hands, caps = [], [], []
for l in LABELS:
    if not os.path.exists(f"{SRC}/{l}/{l}-close-front.png"): continue
    im = load(l, "close-front")
    heads.append(im.crop((530, 380, 770, 500))); hands.append(im.crop((500, 470, 780, 620))); caps.append(NAMES[l])
gh = grid(heads, len(heads), 240, 120, caps)
gd = grid(hands, len(hands), 240, 128, None)
g = Image.new("RGB", (gh.width, gh.height + gd.height)); g.paste(gh, (0, 0)); g.paste(gd, (0, gh.height))
total += save(g, "close-head-hands.jpg")
print("total bytes", total, "dir bytes", sum(os.path.getsize(f"{OUT}/{f}") for f in os.listdir(OUT)))
