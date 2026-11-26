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
    bones: [],
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  scorpion: {
    skeleton: 'crawler',
    bones: [],
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  dark_wizard: {
    skeleton: 'biped',
    bones: [],
    codeAttack: {
      rightArmX: -1.65,
      leftArmX: -1.45,
      headX: -0.25,
      y: 0.12
    }
  },
  dark_ranger: {
    skeleton: 'biped',
    bones: [],
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
    bones: [],
    codeAttack: {
      rightArmX: -1.45,
      leftArmX: 0.58,
      y: 0.1
    }
  },
  elvarg_dragon: {
    // The dragon library in monsters.glb (plan D2b); Ashmantle shares this row through its model key.
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
      // The wind-up's clip. poseMonsterLimbs still holds `attack` during a wind-up; Bite and WingBuffet share
      // the anticipation key, so either one held there is a true telegraph.
      windup: 'WingBuffet',
      death: 'Death'
    },
    anticipation: 0.333333,
    // Today's head and wing swing, kept for the frames before monsters.glb arrives.
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
