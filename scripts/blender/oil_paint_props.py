"""Oil-paint custom properties for glTF extras.

The game reads these from object or material userData:

  paint_palette   string   id in src/paint/palettes.ts
  stroke_dir      string   up | along_bone | surface_flow | flat
  dab_size        string   metres, width x length, e.g. 0.04x0.09
  jitter          float    0.5 cloth and skin, 0.25 metals
  dab_density     int      optional pin count for that mesh

Already-set properties are left alone, so a value typed in Blender's
Custom Properties panel survives a re-export.
"""

import bpy

SIZES = {
    "hero": "0.04x0.09",
    "boss": "0.04x0.09",
    "monster": "0.06x0.12",
    "gear": "0.03x0.07",
    "prop": "0.08x0.16",
    "tree": "0.12x0.30",
}

METALS = {"bronze", "iron", "steel", "mithril", "adamant", "rune"}

HERO = {
    "Head": ("kai_skin", "along_bone", "hero"),
    "Hair": ("kai_hair", "along_bone", "hero"),
    "Eyes": ("kai_skin", "along_bone", "hero"),
    "InnerChest": ("kai_tunic", "along_bone", "hero"),
    "TorsoCoat": ("kai_tunic", "along_bone", "hero"),
    "Belt": ("leather", "along_bone", "hero"),
    "Sleeve_L": ("kai_tunic", "along_bone", "hero"),
    "Sleeve_R": ("kai_tunic", "along_bone", "hero"),
    "Bracer_L": ("leather", "along_bone", "hero"),
    "Bracer_R": ("leather", "along_bone", "hero"),
    "Hand_L": ("kai_skin", "along_bone", "hero"),
    "Hand_R": ("kai_skin", "along_bone", "hero"),
    "Thigh_L": ("kai_tunic", "along_bone", "hero"),
    "Thigh_R": ("kai_tunic", "along_bone", "hero"),
    "Shin_L": ("kai_tunic", "along_bone", "hero"),
    "Shin_R": ("kai_tunic", "along_bone", "hero"),
    "Boot_L": ("leather", "along_bone", "hero"),
    "Boot_R": ("leather", "along_bone", "hero"),
}


def _has(block, key):
    try:
        return key in block.keys()
    except Exception:
        return False


def _write(block, palette, stroke, cls, jitter=None, density=None, size=None):
    if not _has(block, "paint_palette"):
        block["paint_palette"] = palette
    if not _has(block, "stroke_dir"):
        block["stroke_dir"] = stroke
    if not _has(block, "dab_size"):
        block["dab_size"] = size or SIZES[cls]
    if not _has(block, "jitter"):
        block["jitter"] = METALS.__contains__(palette) and 0.25 or 0.5 if jitter is None else float(jitter)
    if density is not None and not _has(block, "dab_density"):
        block["dab_density"] = int(density)


def stamp_block(block, palette, stroke, cls, **kwargs):
    _write(block, palette, stroke, cls, **kwargs)
    materials = getattr(block, "material_slots", None)
    if not materials:
        return
    for slot in materials:
        if slot.material:
            _write(slot.material, palette, stroke, cls, **kwargs)


def _walk(obj):
    yield obj
    for child in obj.children:
        yield from _walk(child)


def _stamp_named(name, palette, stroke, cls):
    obj = bpy.data.objects.get(name)
    if not obj:
        return
    for node in _walk(obj):
        if node.type in {"MESH", "EMPTY", "ARMATURE"}:
            stamp_block(node, palette, stroke, cls)


def _guess(name):
    n = name.lower()
    if any(k in n for k in ("scimitar", "sword", "blade", "dagger")):
        metal = "bronze"
        for key, palette in (
            ("rune", "rune"),
            ("adamant", "adamant"),
            ("addy", "adamant"),
            ("mith", "mithril"),
            ("steel", "steel"),
            ("iron", "iron"),
            ("bronze", "bronze"),
        ):
            if key in n:
                metal = palette
                break
        return metal, "along_bone", "gear"
    if "goblin" in n:
        if any(k in n for k in ("spear", "sword", "blade", "buckler")):
            return "bronze", "along_bone", "monster"
        return "goblin_hide", "surface_flow", "monster"
    if any(k in n for k in ("trunk", "bark", "pine", "tree")):
        return "pine_bark", "up", "tree"
    if any(k in n for k in ("cobble", "stone", "wall", "flagstone")):
        return "varrock_stone", "flat", "prop"
    if "sand" in n:
        return "alkharid_sand", "flat", "prop"
    return None


def stamp_scene():
    """Fill missing paint properties on the current Blender scene."""
    for name, spec in HERO.items():
        _stamp_named(name, *spec)
    for obj in list(bpy.data.objects):
        if obj.type not in {"MESH", "EMPTY"}:
            continue
        if _has(obj, "paint_palette"):
            continue
        guessed = _guess(obj.name)
        if not guessed:
            continue
        stamp_block(obj, *guessed)
