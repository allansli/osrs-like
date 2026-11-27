// Plan Q5, the data test of design 7.2: every dialogue tree, and the text of every table that reaches a chat line.
// It reads the live tables, so it is vacuous while they are empty (Q5) and covers each later slice without edits.
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { DIALOGUES } from '../src/data/dialogue';
import { NPCS } from '../src/data/npcs';
import { STORY_QUESTS } from '../src/data/story';
import { STARTER_QUESTS } from '../src/state/adventure';
import type { Cond, Dialogue, Effect } from '../src/state/dialogue';
import { collectStrings, condProblems, mustLeaves, optionalModule } from './support/satisfy';

const SAY_MAX = 280;
const OPTION_MAX = 80;
const OPTIONS_MAX = 4;
const has = (table: object, id: string) => Object.hasOwn(table, id);
const storyIds = new Set(STORY_QUESTS.map((q) => q.id));
const starterIds = new Set(STARTER_QUESTS.map((q) => q.id));
const npcIds = new Set(NPCS.map((n) => n.id));
const dungeons = await optionalModule<{ id: string }[]>('dungeons', 'DUNGEONS', []);
const diary = await optionalModule<unknown>('diary', 'DIARY', []);
const dungeonIds = new Set(dungeons.map((d) => d.id));

function effectProblems(e: Effect, where: string, out: string[]) {
  const bad = (what: string) => out.push(`${where}: ${what}`);
  if ('start' in e && !storyIds.has(e.start)) bad(`start ${e.start}`);
  if ('advance' in e && !storyIds.has(e.advance)) bad(`advance ${e.advance}`);
  if ('finish' in e && !storyIds.has(e.finish)) bad(`finish ${e.finish}`);
  if ('claimStarter' in e && !starterIds.has(e.claimStarter)) bad(`claimStarter ${e.claimStarter}`);
  if ('give' in e && !has(ITEMS, e.give[0])) bad(`give ${e.give[0]}`);
  if ('take' in e && !has(ITEMS, e.take[0])) bad(`take ${e.take[0]}`);
  if ('enter' in e && !dungeonIds.has(e.enter)) bad(`enter ${e.enter}`);
}

/** The quests and starter quests a condition pins from the top, through `all` only: the option is shown at that stage and no other. */
function pins(c: Cond | undefined): { quests: Set<string>; stages: Set<string>; starters: Set<string> } {
  const quests = new Set<string>();
  const stages = new Set<string>();
  const starters = new Set<string>();
  for (const leaf of c ? mustLeaves(c) : []) {
    if ('stage' in leaf) {
      stages.add(leaf.stage[0]);
      quests.add(leaf.stage[0]);
    }
    if ('quest' in leaf && leaf.quest[1] === 'none') quests.add(leaf.quest[0]);
    if ('starter' in leaf) starters.add(leaf.starter[0]);
  }
  return { quests, stages, starters };
}

function treeProblems(d: Dialogue): string[] {
  const out: string[] = [];
  const at = (node: string) => `${d.npc}.${node}`;
  if (!npcIds.has(d.npc)) out.push(`${d.npc}: dialogue has no person`);
  if (d.greet.length === 0) out.push(`${d.npc}: no greet`);
  else if (d.greet[d.greet.length - 1].when) out.push(`${d.npc}: the last greet has a condition, so a state can hold none`);
  for (const g of d.greet) {
    if (!has(d.nodes, g.node)) out.push(`${d.npc}: greet names missing node ${g.node}`);
    if (g.when) condProblems(g.when, `${d.npc} greet`, out);
  }

  const edges = new Map<string, string[]>();
  const ends = new Set<string>();
  for (const [name, node] of Object.entries(d.nodes)) {
    const here = at(name);
    if (node.options.length === 0) out.push(`${here}: no option`);
    if (node.options.length > OPTIONS_MAX) out.push(`${here}: ${node.options.length} options`);
    if (node.say.length > SAY_MAX) out.push(`${here}: say is ${node.say.length} characters`);
    if (node.by !== undefined && node.by !== 'hero') out.push(`${here}: by is ${String(node.by)}`);
    const targets: string[] = [];
    node.options.forEach((opt, i) => {
      const where = `${here}[${i}]`;
      if (opt.text.length > OPTION_MAX) out.push(`${where}: text is ${opt.text.length} characters`);
      if (opt.goto === 'end') ends.add(name);
      else if (!has(d.nodes, opt.goto)) out.push(`${where}: goto missing node ${opt.goto}`);
      else targets.push(opt.goto);
      if (opt.when) condProblems(opt.when, where, out);
      for (const e of opt.then ?? []) effectProblems(e, where, out);

      // Once only, by construction: a paying option is shown at one stage and moves that quest on.
      const effects = opt.then ?? [];
      const paying = effects.filter((e) => 'give' in e || 'take' in e || 'finish' in e || 'claimStarter' in e);
      if (paying.length > 0) {
        const pin = pins(opt.when);
        if (pin.quests.size === 0 && pin.starters.size === 0) out.push(`${where}: pays or takes with no stage or starter pinned`);
        const moves = effects.some(
          (e) =>
            ('start' in e && pin.quests.has(e.start)) ||
            ('advance' in e && pin.quests.has(e.advance)) ||
            ('finish' in e && pin.quests.has(e.finish)) ||
            ('claimStarter' in e && pin.starters.has(e.claimStarter))
        );
        if (!moves) out.push(`${where}: pays or takes without moving the quest or starter step it pins`);
        for (const e of effects) {
          if ('finish' in e && !pin.stages.has(e.finish)) out.push(`${where}: finish ${e.finish} without pinning its stage`);
          if ('claimStarter' in e && !pin.starters.has(e.claimStarter)) out.push(`${where}: claimStarter ${e.claimStarter} without pinning that step`);
        }
      }
    });
    edges.set(name, targets);
  }

  // Every node is reached from a greet; every node can reach an end.
  const reached = new Set<string>();
  const queue = d.greet.map((g) => g.node).filter((n) => has(d.nodes, n));
  while (queue.length > 0) {
    const n = queue.pop()!;
    if (reached.has(n)) continue;
    reached.add(n);
    queue.push(...edges.get(n)!);
  }
  for (const name of Object.keys(d.nodes)) if (!reached.has(name)) out.push(`${at(name)}: no path reaches it`);
  const ending = new Set(ends);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [n, targets] of edges) {
      if (!ending.has(n) && targets.some((t) => ending.has(t))) {
        ending.add(n);
        grew = true;
      }
    }
  }
  for (const name of Object.keys(d.nodes)) if (!ending.has(name)) out.push(`${at(name)}: can never end`);
  return out;
}

describe('dialogue data (design 7.2)', () => {
  it('every tree is well formed, reachable, bounded and uses only ids that exist', () => {
    expect(DIALOGUES.flatMap(treeProblems)).toEqual([]);
  });

  it('a person has exactly one dialogue and a dialogue has a person', () => {
    const seen = new Map<string, number>();
    for (const d of DIALOGUES) seen.set(d.npc, (seen.get(d.npc) ?? 0) + 1);
    const problems = [
      ...NPCS.filter((n) => !seen.has(n.id)).map((n) => `${n.id}: no dialogue`),
      ...[...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id}: ${n} dialogues`),
      ...DIALOGUES.filter((d) => !npcIds.has(d.npc)).map((d) => `${d.npc}: no person`)
    ];
    expect(problems).toEqual([]);
  });

  it('person ids are unique', () => {
    expect(NPCS.length).toBe(npcIds.size);
  });

  it('no text can reach the chat as markup or name a forbidden global', () => {
    // Names and journal lines reach chat lines, which are written as markup (critique M6): no `<` or `&`, and neither
    // word the architecture test forbids in the data layer.
    const tables: Record<string, unknown> = { NPCS, STORY_QUESTS, DIALOGUES, DIARY: diary, DUNGEONS: dungeons };
    const bad: string[] = [];
    for (const [name, table] of Object.entries(tables)) {
      for (const text of collectStrings(table)) {
        if (/[<&]/.test(text) || /\b(?:document|window)\b/i.test(text)) bad.push(`${name}: ${text.slice(0, 60)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
