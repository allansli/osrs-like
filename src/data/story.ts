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

export const STORY_QUESTS: StoryQuest[] = [];
