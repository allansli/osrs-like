"""
Skeleton definitions and reference poses for shared character rigs:
- Biped (16 core bones + optional bones; reference pose: hero source A-pose)
- Dragon (22 bones; winged quadruped standing pose)
- Crawler (20 bones; scorpion multi-legged standing pose)
"""

from typing import NamedTuple, Optional


class BoneDef(NamedTuple):
    bone: str
    parent: Optional[str]
    optional: bool = False
    flag: Optional[str] = None
    # Unit direction from this bone's joint to its reference child's joint in the
    # skeleton's reference pose. make_rig checks only that one child. Rows without
    # a reference child have ref_dir None and ref_child None.
    ref_dir: Optional[tuple[float, float, float]] = None
    ref_child: Optional[str] = None
    # Parent used when `parent` has no joint in the figure (an optional parent that
    # is absent, e.g. the shoulder). None means the parent is required to exist.
    fallback_parent: Optional[str] = None


def _row(bone, parent, ref_dir=None, ref_child=None, optional=False, flag=None, fallback_parent=None):
    return BoneDef(bone, parent, optional, flag, ref_dir, ref_child, fallback_parent)


# -----------------------------------------------------------------------------
# 1. Biped Skeleton (Design 6.1.2)
# Reference pose: Hero source A-pose (Design 3.5 S14)
# Upper arms ~28 deg out, forearms ~32 deg out, legs ~10 deg out, spine upright.
# Directions from a joint to its reference child, Blender coords (X right, Y fwd, Z up):
# LeftArmPivot -> LeftElbowPivot: (-0.468, 0, -0.884), LeftElbowPivot -> LeftHand: (-0.528, 0, -0.849)
# LeftLegPivot -> LeftKneePivot: (-0.183, 0, -0.983), LeftKneePivot -> LeftFoot: straight down.
# Design 6.1.2: LeftShoulder and RightShoulder sit between Torso and the arm bones. When the
# figure has no shoulder joint the arm bones fall back to Torso (fallback_parent).
# -----------------------------------------------------------------------------
BIPED_TABLE: list[BoneDef] = [
    _row("Root", None, (0.0, 0.0, 1.0), "Hips"),
    _row("Hips", "Root", (0.0, 0.0, 1.0), "Torso"),
    _row("Torso", "Hips", (0.0, 0.0, 1.0), "HeadGroup"),
    _row("HeadGroup", "Torso"),
    # Shoulders (optional): Torso -> Shoulder -> ArmPivot
    _row("LeftShoulder", "Torso", (-1.0, 0.0, 0.0), "LeftArmPivot", optional=True),
    _row("RightShoulder", "Torso", (1.0, 0.0, 0.0), "RightArmPivot", optional=True),
    # Arms
    _row("LeftArmPivot", "LeftShoulder", (-0.468, 0.0, -0.884), "LeftElbowPivot", fallback_parent="Torso"),
    _row("LeftElbowPivot", "LeftArmPivot", (-0.528, 0.0, -0.849), "LeftHand"),
    _row("LeftHand", "LeftElbowPivot"),
    _row("RightArmPivot", "RightShoulder", (0.468, 0.0, -0.884), "RightElbowPivot", fallback_parent="Torso"),
    _row("RightElbowPivot", "RightArmPivot", (0.528, 0.0, -0.849), "RightHand"),
    _row("RightHand", "RightElbowPivot"),
    # Legs
    _row("LeftLegPivot", "Hips", (-0.183, 0.0, -0.983), "LeftKneePivot"),
    _row("LeftKneePivot", "LeftLegPivot", (0.0, 0.0, -1.0), "LeftFoot"),
    _row("LeftFoot", "LeftKneePivot"),
    _row("RightLegPivot", "Hips", (0.183, 0.0, -0.983), "RightKneePivot"),
    _row("RightKneePivot", "RightLegPivot", (0.0, 0.0, -1.0), "RightFoot"),
    _row("RightFoot", "RightKneePivot"),
    # Optional bones
    _row("Jaw", "HeadGroup", optional=True),
    _row("WeaponPivot", "RightHand", optional=True),
    _row("OffhandPivot", "LeftHand", optional=True),
    _row("LWing", "Torso", optional=True),
    _row("RWing", "Torso", optional=True),
    _row("TailPivot", "Hips", (0.0, -0.928, -0.371), "TailPivot2", optional=True),
    _row("TailPivot2", "TailPivot", optional=True),
]


# -----------------------------------------------------------------------------
# 2. Dragon Skeleton (Design 6.1.2) - 22 bones
# Winged quadruped standing pose
# -----------------------------------------------------------------------------
DRAGON_TABLE: list[BoneDef] = [
    _row("Root", None, (0.0, 0.0, 1.0), "Hips"),
    _row("Hips", "Root", (0.0, 0.8, 0.6), "Torso"),
    _row("Torso", "Hips", (0.0, 0.8, 0.6), "Neck1"),
    _row("Neck1", "Torso", (0.0, 0.8, 0.6), "Neck2"),
    _row("Neck2", "Neck1", (0.0, 0.8, 0.6), "HeadGroup"),
    _row("HeadGroup", "Neck2", (0.0, 1.0, 0.0), "Jaw"),
    _row("Jaw", "HeadGroup"),
    # Front legs (under Torso)
    _row("LeftArmPivot", "Torso", (0.0, 0.0, -1.0), "LeftElbowPivot"),
    _row("LeftElbowPivot", "LeftArmPivot"),
    _row("RightArmPivot", "Torso", (0.0, 0.0, -1.0), "RightElbowPivot"),
    _row("RightElbowPivot", "RightArmPivot"),
    # Hind legs (under Hips)
    _row("LeftLegPivot", "Hips", (0.0, 0.0, -1.0), "LeftKneePivot"),
    _row("LeftKneePivot", "LeftLegPivot"),
    _row("RightLegPivot", "Hips", (0.0, 0.0, -1.0), "RightKneePivot"),
    _row("RightKneePivot", "RightLegPivot"),
    # Wings (under Torso)
    _row("LWing", "Torso", (-0.85, 0.0, 0.52), "LWing2"),
    _row("LWing2", "LWing"),
    _row("RWing", "Torso", (0.85, 0.0, 0.52), "RWing2"),
    _row("RWing2", "RWing"),
    # Tail (under Hips)
    _row("TailPivot", "Hips", (0.0, -0.95, -0.31), "TailPivot2"),
    _row("TailPivot2", "TailPivot", (0.0, -0.95, -0.31), "TailPivot3"),
    _row("TailPivot3", "TailPivot2"),
]


# -----------------------------------------------------------------------------
# 3. Crawler Skeleton (Design 6.1.2) - 20 bones
# Multi-legged standing pose
# -----------------------------------------------------------------------------
CRAWLER_TABLE: list[BoneDef] = [
    _row("Root", None, (0.0, 0.0, 1.0), "Hips"),
    _row("Hips", "Root", (0.0, 1.0, 0.0), "HeadGroup"),
    _row("HeadGroup", "Hips"),
    # Claws / Pedipalps
    _row("LeftArmPivot", "HeadGroup", (-0.316, 0.949, 0.0), "LeftElbowPivot"),
    _row("LeftElbowPivot", "LeftArmPivot"),
    _row("RightArmPivot", "HeadGroup", (0.316, 0.949, 0.0), "RightElbowPivot"),
    _row("RightElbowPivot", "RightArmPivot"),
    # Leg side pivots (each swings its whole side); reference child is the first optional leg
    _row("LeftLegPivot", "Hips", (-0.98, 0.0, -0.2), "LegL1"),
    _row("RightLegPivot", "Hips", (0.98, 0.0, -0.2), "LegR1"),
    # Optional per-leg bones
    _row("LegL1", "LeftLegPivot", optional=True),
    _row("LegL2", "LeftLegPivot", optional=True),
    _row("LegL3", "LeftLegPivot", optional=True),
    _row("LegL4", "LeftLegPivot", optional=True),
    _row("LegR1", "RightLegPivot", optional=True),
    _row("LegR2", "RightLegPivot", optional=True),
    _row("LegR3", "RightLegPivot", optional=True),
    _row("LegR4", "RightLegPivot", optional=True),
    # Tail
    _row("TailPivot", "Hips", (0.0, -0.8, 0.6), "TailPivot2"),
    _row("TailPivot2", "TailPivot", (0.0, -0.6, 0.8), "TailPivot3"),
    _row("TailPivot3", "TailPivot2"),
]


SKELETONS = {
    "biped": BIPED_TABLE,
    "dragon": DRAGON_TABLE,
    "crawler": CRAWLER_TABLE,
}
