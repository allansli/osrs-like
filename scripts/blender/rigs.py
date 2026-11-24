"""
Skeleton definitions and reference poses for shared character rigs:
- Biped (16 core bones + optional bones; reference pose: hero source A-pose)
- Dragon (22 bones; winged quadruped standing pose)
- Crawler (20 bones; scorpion multi-legged standing pose)
"""

from typing import NamedTuple, Optional
from mathutils import Vector


class BoneDef(NamedTuple):
    bone: str
    parent: Optional[str]
    optional: bool = False
    flag: Optional[str] = None
    ref_dir: Optional[tuple[float, float, float]] = None


# -----------------------------------------------------------------------------
# 1. Biped Skeleton (Design 6.1.2)
# Reference pose: Hero source A-pose (Design 3.5 S14)
# Upper arms ~28° out, forearms ~32° out, legs ~10° out, spine upright.
# -----------------------------------------------------------------------------
# Directions from parent joint to child joint in Blender coords (X right, Y fwd, Z up):
# LeftArmPivot -> LeftElbowPivot: (-0.132, 0, -0.249) -> ~27.9° out
# LeftElbowPivot -> LeftHand: (-0.13, 0, -0.209) -> ~31.9° out
# LeftLegPivot -> LeftKneePivot: (-0.075, 0, -0.403) -> ~10.5° out
# LeftKneePivot -> LeftFoot: (0, 0, -1) -> straight down
BIPED_TABLE: list[BoneDef] = [
    # Core spine / head
    BoneDef("Root", None, optional=False, ref_dir=(0.0, 0.0, 1.0)),
    BoneDef("Hips", "Root", optional=False, ref_dir=(0.0, 0.0, 1.0)),
    BoneDef("Torso", "Hips", optional=False, ref_dir=(0.0, 0.0, 1.0)),
    BoneDef("HeadGroup", "Torso", optional=False, ref_dir=(0.0, 0.0, 1.0)),
    # Arms (Left)
    BoneDef("LeftArmPivot", "Torso", optional=False, ref_dir=(-0.468, 0.0, -0.884)),
    BoneDef("LeftElbowPivot", "LeftArmPivot", optional=False, ref_dir=(-0.528, 0.0, -0.849)),
    BoneDef("LeftHand", "LeftElbowPivot", optional=False, ref_dir=None),
    # Arms (Right)
    BoneDef("RightArmPivot", "Torso", optional=False, ref_dir=(0.468, 0.0, -0.884)),
    BoneDef("RightElbowPivot", "RightArmPivot", optional=False, ref_dir=(0.528, 0.0, -0.849)),
    BoneDef("RightHand", "RightElbowPivot", optional=False, ref_dir=None),
    # Legs (Left)
    BoneDef("LeftLegPivot", "Hips", optional=False, ref_dir=(-0.183, 0.0, -0.983)),
    BoneDef("LeftKneePivot", "LeftLegPivot", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    BoneDef("LeftFoot", "LeftKneePivot", optional=False, ref_dir=None),
    # Legs (Right)
    BoneDef("RightLegPivot", "Hips", optional=False, ref_dir=(0.183, 0.0, -0.983)),
    BoneDef("RightKneePivot", "RightLegPivot", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    BoneDef("RightFoot", "RightKneePivot", optional=False, ref_dir=None),
    # Optional bones
    BoneDef("Jaw", "HeadGroup", optional=True, ref_dir=None),
    BoneDef("WeaponPivot", "RightHand", optional=True, ref_dir=None),
    BoneDef("OffhandPivot", "LeftHand", optional=True, ref_dir=None),
    BoneDef("LWing", "Torso", optional=True, ref_dir=(-0.707, -0.2, 0.677)),
    BoneDef("RWing", "Torso", optional=True, ref_dir=(0.707, -0.2, 0.677)),
    BoneDef("TailPivot", "Hips", optional=True, ref_dir=(0.0, -0.928, -0.371)),
    BoneDef("TailPivot2", "TailPivot", optional=True, ref_dir=(0.0, -0.928, -0.371)),
    BoneDef("LeftShoulder", "Torso", optional=True, ref_dir=(-1.0, 0.0, 0.0)),
    BoneDef("RightShoulder", "Torso", optional=True, ref_dir=(1.0, 0.0, 0.0)),
]


# -----------------------------------------------------------------------------
# 2. Dragon Skeleton (Design 6.1.2) - 22 bones
# Winged quadruped standing pose
# -----------------------------------------------------------------------------
DRAGON_TABLE: list[BoneDef] = [
    # Spine & Head
    BoneDef("Root", None, optional=False, ref_dir=(0.0, 0.0, 1.0)),
    BoneDef("Hips", "Root", optional=False, ref_dir=(0.0, 0.8, 0.6)),
    BoneDef("Torso", "Hips", optional=False, ref_dir=(0.0, 0.8, 0.6)),
    BoneDef("Neck1", "Torso", optional=False, ref_dir=(0.0, 0.8, 0.6)),
    BoneDef("Neck2", "Neck1", optional=False, ref_dir=(0.0, 0.8, 0.6)),
    BoneDef("HeadGroup", "Neck2", optional=False, ref_dir=(0.0, 1.0, 0.0)),
    BoneDef("Jaw", "HeadGroup", optional=False, ref_dir=None),
    # Front legs (under Torso)
    BoneDef("LeftArmPivot", "Torso", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    BoneDef("LeftElbowPivot", "LeftArmPivot", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    BoneDef("RightArmPivot", "Torso", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    BoneDef("RightElbowPivot", "RightArmPivot", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    # Hind legs (under Hips)
    BoneDef("LeftLegPivot", "Hips", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    BoneDef("LeftKneePivot", "LeftLegPivot", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    BoneDef("RightLegPivot", "Hips", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    BoneDef("RightKneePivot", "RightLegPivot", optional=False, ref_dir=(0.0, 0.0, -1.0)),
    # Wings (under Torso)
    BoneDef("LWing", "Torso", optional=False, ref_dir=(-0.85, 0.0, 0.52)),
    BoneDef("LWing2", "LWing", optional=False, ref_dir=(-0.85, 0.0, 0.52)),
    BoneDef("RWing", "Torso", optional=False, ref_dir=(0.85, 0.0, 0.52)),
    BoneDef("RWing2", "RWing", optional=False, ref_dir=(0.85, 0.0, 0.52)),
    # Tail (under Hips)
    BoneDef("TailPivot", "Hips", optional=False, ref_dir=(0.0, -0.95, -0.31)),
    BoneDef("TailPivot2", "TailPivot", optional=False, ref_dir=(0.0, -0.95, -0.31)),
    BoneDef("TailPivot3", "TailPivot2", optional=False, ref_dir=None),
]


# -----------------------------------------------------------------------------
# 3. Crawler Skeleton (Design 6.1.2) - 20 bones
# Multi-legged standing pose
# -----------------------------------------------------------------------------
CRAWLER_TABLE: list[BoneDef] = [
    # Core body
    BoneDef("Root", None, optional=False, ref_dir=(0.0, 0.0, 1.0)),
    BoneDef("Hips", "Root", optional=False, ref_dir=(0.0, 1.0, 0.0)),
    BoneDef("HeadGroup", "Hips", optional=False, ref_dir=(0.0, 1.0, 0.0)),
    # Claws / Pedipalps
    BoneDef("LeftArmPivot", "HeadGroup", optional=False, ref_dir=(-0.316, 0.949, 0.0)),
    BoneDef("LeftElbowPivot", "LeftArmPivot", optional=False, ref_dir=(-0.316, 0.949, 0.0)),
    BoneDef("RightArmPivot", "HeadGroup", optional=False, ref_dir=(0.316, 0.949, 0.0)),
    BoneDef("RightElbowPivot", "RightArmPivot", optional=False, ref_dir=(0.316, 0.949, 0.0)),
    # Leg side pivots (each swings whole side)
    BoneDef("LeftLegPivot", "Hips", optional=False, ref_dir=(-1.0, 0.0, 0.0)),
    BoneDef("RightLegPivot", "Hips", optional=False, ref_dir=(1.0, 0.0, 0.0)),
    # Optional per-leg bones
    BoneDef("LegL1", "LeftLegPivot", optional=True, ref_dir=(-0.98, 0.0, -0.2)),
    BoneDef("LegL2", "LeftLegPivot", optional=True, ref_dir=(-0.98, 0.0, -0.2)),
    BoneDef("LegL3", "LeftLegPivot", optional=True, ref_dir=(-0.98, 0.0, -0.2)),
    BoneDef("LegL4", "LeftLegPivot", optional=True, ref_dir=(-0.98, 0.0, -0.2)),
    BoneDef("LegR1", "RightLegPivot", optional=True, ref_dir=(0.98, 0.0, -0.2)),
    BoneDef("LegR2", "RightLegPivot", optional=True, ref_dir=(0.98, 0.0, -0.2)),
    BoneDef("LegR3", "RightLegPivot", optional=True, ref_dir=(0.98, 0.0, -0.2)),
    BoneDef("LegR4", "RightLegPivot", optional=True, ref_dir=(0.98, 0.0, -0.2)),
    # Tail
    BoneDef("TailPivot", "Hips", optional=False, ref_dir=(0.0, -0.8, 0.6)),
    BoneDef("TailPivot2", "TailPivot", optional=False, ref_dir=(0.0, -0.6, 0.8)),
    BoneDef("TailPivot3", "TailPivot2", optional=False, ref_dir=None),
]


SKELETONS = {
    "biped": BIPED_TABLE,
    "dragon": DRAGON_TABLE,
    "crawler": CRAWLER_TABLE,
}
