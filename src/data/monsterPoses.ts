// Monster motion table (design 6.1.3, 6.5; plan M1, M1b).
// Pure data: per model key either today's code-pose numbers or the names of the clips
// for idle, walk, attack, hurt and death, the skeleton it stands on.
// No imports from three.

export type MonsterSkeleton = 'biped' | 'dragon' | 'crawler';

export type MonsterMotionClips = Record<string, string> & {
  idle: string;
  walk: string;
  attack: string;
  death: string;
  hurt?: string;
  /** Held while `logic.windup` is set, instead of `attack` (plan D2b amendments). */
  windup?: string;
};

export interface CodeAttackPose {
  rightArmX?: number;
  leftArmX?: number;
  headX?: number;
  headBase?: number;
  headProgress?: number;
  lWingBase?: number;
  lWingProgress?: number;
  rWingBase?: number;
  rWingProgress?: number;
  y: number;
}

export interface MonsterMotionRow {
  skeleton: MonsterSkeleton;
  bones: string[];
  clips?: MonsterMotionClips;
  anticipation?: number;
  codeAttack?: CodeAttackPose;
}

export const MONSTER_MOTION: Record<string, MonsterMotionRow> = {
  goblin: {
    skeleton: 'biped',
    bones: [
      'Hips',
      'Torso',
      'HeadGroup',
      'LeftArmPivot',
      'LeftElbowPivot',
      'RightArmPivot',
      'RightElbowPivot',
      'LeftLegPivot',
      'LeftKneePivot',
      'LeftFoot',
      'RightLegPivot',
      'RightKneePivot',
      'RightFoot'
    ],
    clips: {
      idle: 'Idle',
      walk: 'Walk',
      attack: 'Slash',
      death: 'Death'
    },
    anticipation: 0.25,
    // Today's swing, kept for the frames before the hero file arrives.
    codeAttack: {
      rightArmX: -1.55,
      leftArmX: 0.4,
      y: 0.25
    }
  },
  chicken: {
    skeleton: 'biped',
    bones: [],
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  goblin_archer: {
    skeleton: 'biped',
    // The rebuilt archer's bones (plan M3a): the raider's rig, shooting with the hero file's `Ranged`.
    bones: [
      'Hips',
      'Torso',
      'HeadGroup',
      'LeftArmPivot',
      'LeftElbowPivot',
      'RightArmPivot',
      'RightElbowPivot',
      'LeftLegPivot',
      'LeftKneePivot',
      'LeftFoot',
      'RightLegPivot',
      'RightKneePivot',
      'RightFoot'
    ],
    clips: { idle: 'Idle', walk: 'Walk', attack: 'Ranged', death: 'Death' },
    anticipation: 0.583333,
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  scorpion: {
    skeleton: 'crawler',
    // The re-rigged scorpion's bones (plan M3b): every bone its own library keys; its clips are monsters.glb's `scorpion_` library.
    bones: [
      'Hips',
      'HeadGroup',
      'LeftArmPivot',
      'LeftElbowPivot',
      'RightArmPivot',
      'RightElbowPivot',
      'LeftLegPivot',
      'RightLegPivot',
      'LegL1',
      'LegL2',
      'LegL3',
      'LegL4',
      'LegR1',
      'LegR2',
      'LegR3',
      'LegR4',
      'TailPivot',
      'TailPivot2',
      'TailPivot3'
    ],
    clips: { idle: 'Idle', walk: 'Walk', attack: 'Strike', death: 'Death' },
    anticipation: 0.333333,
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  dark_wizard: {
    skeleton: 'biped',
    // The rebuilt wizard's bones (plan M3e): the biped clips' thirteen. It casts with the hero file's `Cast`.
    bones: [
      'Hips',
      'Torso',
      'HeadGroup',
      'LeftArmPivot',
      'LeftElbowPivot',
      'RightArmPivot',
      'RightElbowPivot',
      'LeftLegPivot',
      'LeftKneePivot',
      'LeftFoot',
      'RightLegPivot',
      'RightKneePivot',
      'RightFoot'
    ],
    clips: { idle: 'Idle', walk: 'Walk', attack: 'Cast', death: 'Death' },
    anticipation: 0.25,
    codeAttack: {
      rightArmX: -1.65,
      leftArmX: -1.45,
      headX: -0.25,
      y: 0.12
    }
  },
  dark_ranger: {
    skeleton: 'biped',
    // The rebuilt ranger's bones (plan M3e): the biped clips' thirteen; it shoots with the hero file's `Ranged`.
    bones: [
      'Hips',
      'Torso',
      'HeadGroup',
      'LeftArmPivot',
      'LeftElbowPivot',
      'RightArmPivot',
      'RightElbowPivot',
      'LeftLegPivot',
      'LeftKneePivot',
      'LeftFoot',
      'RightLegPivot',
      'RightKneePivot',
      'RightFoot'
    ],
    clips: { idle: 'Idle', walk: 'Walk', attack: 'Ranged', death: 'Death' },
    anticipation: 0.583333,
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  hill_giant: {
    skeleton: 'biped',
    // The re-rigged giant's bones (plan M3c): the biped clips' thirteen. It swings its club with the hero file's `Slash`.
    bones: [
      'Hips',
      'Torso',
      'HeadGroup',
      'LeftArmPivot',
      'LeftElbowPivot',
      'RightArmPivot',
      'RightElbowPivot',
      'LeftLegPivot',
      'LeftKneePivot',
      'LeftFoot',
      'RightLegPivot',
      'RightKneePivot',
      'RightFoot'
    ],
    clips: { idle: 'Idle', walk: 'Walk', attack: 'Slash', death: 'Death' },
    anticipation: 0.25,
    codeAttack: {
      rightArmX: -1.8,
      leftArmX: -1.8,
      y: 0.22
    }
  },
  moss_guardian: {
    skeleton: 'biped',
    // The re-rigged guardian's bones (plan M3c): the biped clips' thirteen; it brings its fist down with the hero file's `Chop`.
    bones: [
      'Hips',
      'Torso',
      'HeadGroup',
      'LeftArmPivot',
      'LeftElbowPivot',
      'RightArmPivot',
      'RightElbowPivot',
      'LeftLegPivot',
      'LeftKneePivot',
      'LeftFoot',
      'RightLegPivot',
      'RightKneePivot',
      'RightFoot'
    ],
    clips: { idle: 'Idle', walk: 'Walk', attack: 'Chop', death: 'Death' },
    anticipation: 0.5,
    codeAttack: {
      rightArmX: -1.8,
      leftArmX: -1.8,
      y: 0.22
    }
  },
  lesser_demon: {
    skeleton: 'biped',
    // The rebuilt demon's bones (plan M3d): the biped clips' thirteen, the jaw, the wings and the tail.
    bones: [
      'Hips',
      'Torso',
      'HeadGroup',
      'Jaw',
      'LeftArmPivot',
      'LeftElbowPivot',
      'RightArmPivot',
      'RightElbowPivot',
      'LeftLegPivot',
      'LeftKneePivot',
      'LeftFoot',
      'RightLegPivot',
      'RightKneePivot',
      'RightFoot',
      'LWing',
      'RWing',
      'TailPivot',
      'TailPivot2'
    ],
    clips: {
      idle: 'Idle',
      walk: 'Walk',
      attack: 'Slash',
      death: 'Death'
    },
    anticipation: 0.25,
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  elvarg_dragon: {
    skeleton: 'dragon',
    bones: [
      'Hips',
      'Torso',
      'Neck1',
      'Neck2',
      'HeadGroup',
      'Jaw',
      'LeftArmPivot',
      'LeftElbowPivot',
      'RightArmPivot',
      'RightElbowPivot',
      'LeftLegPivot',
      'LeftKneePivot',
      'RightLegPivot',
      'RightKneePivot',
      'LWing',
      'LWing2',
      'RWing',
      'RWing2',
      'TailPivot',
      'TailPivot2',
      'TailPivot3'
    ],
    clips: {
      idle: 'Idle',
      walk: 'Walk',
      attack: 'Bite',
      windup: 'WingBuffet',
      death: 'Death'
    },
    anticipation: 0.333333,
    codeAttack: {
      headBase: -0.35,
      headProgress: 0.65,
      lWingBase: 0.2,
      lWingProgress: 0.55,
      rWingBase: -0.2,
      rWingProgress: -0.55,
      y: 0.32
    }
  }
};
