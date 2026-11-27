import type { Cond } from '../state/dialogue';

export type StoryStage =
  | { kind: 'talk'; at: string; journal: string }
  | { kind: 'do'; done: Cond; journal: string };

export interface StoryQuestReward {
  gp: number;
  xp: Record<string, number>;
  items: { id: string; qty: number }[];
  title?: string;
}

export interface StoryQuest {
  id: string;
  name: string;
  line: 'main' | 'side';
  giver: string;
  region: string;
  needs: Cond;
  stages: StoryStage[];
  reward: StoryQuestReward;
}

// Stage 6, slices 2 and 3 (Q6, Z5, design 7.3): chapters 1 to 3 and four side quests. Ids, names, givers and regions are the
// content file's; stages and rewards are the design's table. A stage whose next conversation takes an item also asks
// that the item is carried, so the hand-in can always be made when the stage is reached.
export const STORY_QUESTS: StoryQuest[] = [
  {
    id: 'ml_wards',
    name: 'The Guttering Wards',
    line: 'main',
    giver: 'odalys_venn',
    region: 'lumbridge',
    // Offered when the starter chain is finished, or at once to a save that never had the chain. Its combat gate is 3,
    // the level every hero starts at, so no leaf states it.
    needs: { any: [{ claimed: 'sq_coin' }, { not: { claimed: 'arrival' } }] },
    stages: [
      { kind: 'talk', at: 'odalys_venn', journal: 'Hear what Odalys Venn wants. She stands by the altar in town, north of the store.' },
      { kind: 'do', done: { has: ['ashes', 3] }, journal: 'Burn logs at a forge until you carry 3 Ashes.' },
      { kind: 'talk', at: 'odalys_venn', journal: 'Bring the 3 Ashes to Odalys Venn in town.' },
      { kind: 'talk', at: 'corin_ashby', journal: 'Follow Cinder Stair south as far as Wardstone Cairn, before the pass, and speak with Corin Ashby there.' }
    ],
    reward: { gp: 300, xp: { prayer: 300 }, items: [{ id: 'ember_faint', qty: 1 }] }
  },
  {
    id: 'ml_east',
    name: 'Iron for the East Lamp',
    line: 'main',
    giver: 'tamsin_reeve',
    region: 'varrock',
    needs: { all: [{ quest: ['ml_wards', 'done'] }, { combat: 15 }] },
    stages: [
      { kind: 'talk', at: 'tamsin_reeve', journal: 'Hear what Tamsin Reeve needs. She works at the east forge, at the end of Millrace Road.' },
      { kind: 'do', done: { stat: ['gather:coal', 4] }, journal: 'Mine 4 Coal from the seams east of the east forge.' },
      {
        kind: 'do',
        done: { all: [{ stat: ['craft:smelt_steel', 2] }, { has: ['steel_bar', 2] }] },
        journal: 'Smelt 2 Steel Bars at a forge, one Iron Ore and one Coal each, and keep them with you.'
      },
      { kind: 'talk', at: 'tamsin_reeve', journal: 'Bring the 2 Steel Bars to Tamsin Reeve at the east forge.' },
      { kind: 'talk', at: 'odalys_venn', journal: 'Tell Odalys Venn in town that the east lamp has its bracket.' }
    ],
    reward: { gp: 1200, xp: { smithing: 600 }, items: [{ id: 'ember_faint', qty: 1 }] }
  },
  {
    id: 'ml_salt',
    name: 'Salt on the Wind',
    line: 'main',
    giver: 'qadir_salthand',
    region: 'desert',
    needs: { all: [{ quest: ['ml_east', 'done'] }, { combat: 50 }] },
    // Stage 6, slice 3 (Z5). The Warren's door (DUNGEONS.saltfang_warren.needs) opens from stage 3, where Qadir has
    // shown it, and stays open once the chapter is done.
    stages: [
      { kind: 'talk', at: 'qadir_salthand', journal: 'Hear what Qadir Salt-Hand has lost. He trades by the store in the dunes, past the end of Saltwind Track.' },
      { kind: 'do', done: { stat: ['kill:saltback_stalker', 4] }, journal: 'Kill 4 Saltback Stalkers. They hunt the shore in the far south-east of the dunes.' },
      { kind: 'talk', at: 'qadir_salthand', journal: 'Tell Qadir Salt-Hand in the dunes that four stalkers are dead.' },
      {
        kind: 'do',
        done: { stat: ['kill:saltfang', 1] },
        journal: 'Go into Saltfang Warren by the door east of the gold veins in the dunes, and kill Matron Saltfang.'
      },
      { kind: 'talk', at: 'odalys_venn', journal: 'Tell Odalys Venn in town that the Matron is dead and the salt road is open.' }
    ],
    // Design 7.3 also pays 2,000 Crafting XP. The skill does not exist until slice 4, and the story data test refuses
    // a reward skill outside SKILL_KEYS. K2 appends `crafting: 2000` here and tops up a save that finished the chapter
    // without it (plan, Z5 repair amendment).
    reward: {
      gp: 4000,
      xp: {},
      items: [
        { id: 'adamant_bar', qty: 8 },
        { id: 'ember_steady', qty: 1 }
      ],
      title: 'Warrenbreaker'
    }
  },
  {
    id: 'sq_steel',
    name: 'A Harder Edge',
    line: 'side',
    giver: 'tamsin_reeve',
    region: 'varrock',
    needs: { all: [{ quest: ['ml_east', 'done'] }, { combat: 10 }] },
    stages: [
      { kind: 'talk', at: 'tamsin_reeve', journal: 'Hear how Tamsin Reeve makes blacksteel, at the east forge.' },
      {
        kind: 'do',
        done: { any: [{ stat: ['craft:smith_black_scim', 1] }, { stat: ['craft:smith_black_legs', 1] }, { stat: ['craft:smith_black_plate', 1] }] },
        journal: 'Smelt Blacksteel Bars, a Steel Bar and a Coal each, and forge any one blacksteel piece.'
      },
      { kind: 'talk', at: 'tamsin_reeve', journal: 'Tell Tamsin Reeve at the east forge what you made.' }
    ],
    reward: { gp: 0, xp: { smithing: 600 }, items: [{ id: 'black_bar', qty: 4 }] }
  },
  {
    id: 'sq_kettle',
    name: 'The Fourth Kettle',
    line: 'side',
    giver: 'pell_greaves',
    region: 'lumbridge',
    needs: { all: [{ skill: ['cooking', 30] }, { combat: 20 }] },
    stages: [
      { kind: 'talk', at: 'pell_greaves', journal: 'Hear what Pell Greaves wants brewed. He cooks by the range in town.' },
      { kind: 'do', done: { stat: ['craft:brew_prayer', 1] }, journal: 'Brew a Prayer Restore Vial at a range: one Sting Gland and two Ashes.' },
      { kind: 'talk', at: 'pell_greaves', journal: 'Tell Pell Greaves in town that the vial held.' }
    ],
    reward: { gp: 0, xp: { cooking: 800 }, items: [{ id: 'sting_gland', qty: 3 }, { id: 'prayer_potion', qty: 2 }] }
  },
  {
    id: 'sq_vow',
    name: 'A Vow Kept',
    line: 'side',
    giver: 'odalys_venn',
    region: 'lumbridge',
    needs: { combat: 15 },
    stages: [
      { kind: 'talk', at: 'odalys_venn', journal: 'Hear what Odalys Venn asks about the Lantern Vow, in town.' },
      { kind: 'do', done: { stat: ['vows', 1] }, journal: 'Take a Lantern Vow at an altar.' },
      { kind: 'talk', at: 'odalys_venn', journal: 'Tell Odalys Venn in town that the vow is sworn.' }
    ],
    reward: { gp: 1000, xp: { prayer: 500 }, items: [] }
  },
  {
    id: 'sq_toll',
    name: "The Tollmaster's Due",
    line: 'side',
    giver: 'bran_tolley',
    region: 'lumbridge',
    needs: { combat: 40 },
    stages: [
      { kind: 'talk', at: 'bran_tolley', journal: 'Hear what Bran Tolley knows of the Tollmaster. He keeps the gate south of the bank.' },
      { kind: 'do', done: { stat: ['kill:marrowjaw', 1] }, journal: 'Kill Marrowjaw the Tollmaster, on the open ground far north of town.' },
      { kind: 'talk', at: 'bran_tolley', journal: 'Tell Bran Tolley in town that the toll is lifted.' }
    ],
    reward: { gp: 2500, xp: {}, items: [{ id: 'ember_steady', qty: 1 }], title: 'Tollbreaker' }
  }
];
