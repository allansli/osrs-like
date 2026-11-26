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
    // The re-rigged scorpion's bones (plan M3b): every bone its own library keys. Its clips are staged
    // below until K4 promotes the skinned scorpion (the shipped one is rigid and has no library).
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
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  dark_wizard: {
    skeleton: 'biped',
    // The rebuilt wizard's bones (plan M3e): the biped clips' thirteen. Its clips are staged below until K4
    // promotes the skinned wizard (the shipped one is rigid and has no Hips).
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
    codeAttack: {
      rightArmX: -1.65,
      leftArmX: -1.45,
      headX: -0.25,
      y: 0.12
    }
  },
  dark_ranger: {
    skeleton: 'biped',
    // The rebuilt ranger's bones (plan M3e): the biped clips' thirteen; its clips are staged below, as the wizard's.
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
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  hill_giant: {
    skeleton: 'biped',
    bones: [],
    codeAttack: {
      rightArmX: -1.8,
      leftArmX: -1.8,
      y: 0.22
    }
  },
  moss_guardian: {
    skeleton: 'biped',
    bones: [],
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

/**
 * The scorpion's crawler library (plan M3b), staged as the dragon's and the archer's were: K4's promote
 * sets the live row's `clips` and `anticipation` to these and removes the export. In monsters.glb Idle, Walk
 * and Death are named `scorpion_<clip>` (the dragon's library holds the bare names); the loader strips the prefix.
 */
export const PENDING_SCORPION_CLIPS: Pick<MonsterMotionRow, 'clips' | 'anticipation'> = {
  clips: { idle: 'Idle', walk: 'Walk', attack: 'Strike', death: 'Death' },
  anticipation: 0.333333
};

/**
 * The rebuilt wizard and ranger (plan M3e) play the hero file's biped library: the wizard casts with `Cast`, the
 * ranger shoots with `Ranged`, each anticipation the hero manifest's. Staged as the scorpion's: K4's promote sets the
 * live rows' `clips` and `anticipation` to these and removes the exports.
 */
export const PENDING_WIZARD_CLIPS: Pick<MonsterMotionRow, 'clips' | 'anticipation'> = {
  clips: { idle: 'Idle', walk: 'Walk', attack: 'Cast', death: 'Death' },
  anticipation: 0.25
};

export const PENDING_RANGER_CLIPS: Pick<MonsterMotionRow, 'clips' | 'anticipation'> = {
  clips: { idle: 'Idle', walk: 'Walk', attack: 'Ranged', death: 'Death' },
  anticipation: 0.583333
};
