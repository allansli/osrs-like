// Test-only dialogue and story fixture (plan Q1; Q3 reuses it). Two people, two small quests, no content of the game.
//
// The live tables are empty until Q6 and Q5/Q6 fill them, and `progress.ts` reads the table of people at module load
// (to build STAT_KEYS), so a test file registers these rows by mocking the three data modules before anything imports them:
//
//   vi.mock('../src/data/npcs', async (orig) => (await import('./support/dialogueFixture')).withFixture('NPCS', await orig()));
//   vi.mock('../src/data/dialogue', async (orig) => (await import('./support/dialogueFixture')).withFixture('DIALOGUES', await orig()));
//   vi.mock('../src/data/story', async (orig) => (await import('./support/dialogueFixture')).withFixture('STORY_QUESTS', await orig()));
//
// Assumed names (design 7.2, 7.3): tables NPCS, DIALOGUES, STORY_QUESTS; a result of `chooseOption` is
// `{ ok, reason?, view, events }` with `view` the next view or null at the end, and each event has a `type`.
// If Q2 names them otherwise, only `viewOf`, `eventTypes` and `withFixture` change.

export const FX_NPCS = [
  { id: 'fx_keeper', name: 'Fixture Keeper', role: 'Test person', x: 0, z: 0, tunic: 0x808080 },
  { id: 'fx_other', name: 'Fixture Other', role: 'Second test person', x: 1, z: 1, tunic: 0x404040 }
];

/** fx_job: a `do` stage then a `talk` stage. fx_relay: two `talk` stages (so `advance` has a stage to leave). */
export const FX_STORY_QUESTS = [
  {
    id: 'fx_job',
    name: 'Fixture Job',
    line: 'side',
    giver: 'fx_keeper',
    region: 'lumbridge',
    needs: { gp: 0 },
    stages: [
      { kind: 'do', done: { stat: ['kill:goblin', 2] }, journal: 'Kill two goblins.' },
      { kind: 'talk', at: 'fx_keeper', journal: 'Tell the keeper.' }
    ],
    reward: { gp: 100, xp: { mining: 50 }, items: [{ id: 'shrimp', qty: 3 }], title: 'Fixture Hero' }
  },
  {
    id: 'fx_relay',
    name: 'Fixture Relay',
    line: 'side',
    giver: 'fx_keeper',
    region: 'lumbridge',
    needs: { gp: 0 },
    stages: [
      { kind: 'talk', at: 'fx_keeper', journal: 'Bring the keeper two logs.' },
      { kind: 'talk', at: 'fx_keeper', journal: 'Tell the keeper it is done.' }
    ],
    reward: { gp: 0, xp: {}, items: [] }
  }
];

// Options with give, take, finish or claimStarter pin a stage or a starter state, as the data test of 7.2 demands,
// except the three marked LOOSE, which exist to test a rule's own guard.
export const FX_DIALOGUES = [
  {
    npc: 'fx_keeper',
    greet: [
      { when: { quest: ['fx_relay', 'active'] }, node: 'relay' },
      { when: { quest: ['fx_job', 'done'] }, node: 'thanks' },
      { when: { quest: ['fx_job', 'active'] }, node: 'working' },
      { node: 'hello' }
    ],
    nodes: {
      hello: {
        say: 'Hello, traveller.',
        options: [
          { text: 'Any work?', when: { quest: ['fx_job', 'none'] }, then: [{ start: 'fx_job' }], goto: 'working' },
          { text: 'Show me your wares.', then: [{ open: 'shop' }], goto: 'end' },
          { text: 'Lead me in.', then: [{ enter: 'fx_dungeon' }], goto: 'end' },
          {
            text: 'It is done.',
            when: { starter: ['sq_ledger', 'ready'] },
            then: [{ claimStarter: 'sq_ledger' }],
            goto: 'end'
          }
        ]
      },
      working: {
        say: 'Still at it?',
        options: [
          { text: 'The goblins are down.', when: { stage: ['fx_job', 1] }, then: [{ finish: 'fx_job' }], goto: 'thanks' },
          { text: 'Never mind.', goto: 'end' }
        ]
      },
      relay: {
        say: 'Two logs, please.',
        options: [
          {
            text: 'Here are two logs.',
            when: { stage: ['fx_relay', 0] },
            then: [{ take: ['logs', 2] }, { give: ['shrimp', 1] }, { advance: 'fx_relay' }],
            goto: 'relay'
          },
          { text: 'All done.', when: { stage: ['fx_relay', 1] }, then: [{ finish: 'fx_relay' }], goto: 'end' }
        ]
      },
      gifts: {
        say: 'A trade.',
        options: [
          {
            text: 'Take a gift.',
            when: { stage: ['fx_relay', 0] },
            then: [{ give: ['bronze_scimitar', 1] }, { advance: 'fx_relay' }],
            goto: 'end'
          },
          {
            text: 'Take it back.',
            when: { stage: ['fx_relay', 0] },
            then: [{ take: ['bronze_scimitar', 1] }, { advance: 'fx_relay' }],
            goto: 'end'
          }
        ]
      },
      edge: {
        say: 'Odd requests.',
        options: [
          // give then take of one item succeeds only when the effects apply in order
          { text: 'Swap.', then: [{ give: ['copper_ore', 1] }, { take: ['copper_ore', 1] }], goto: 'end' },
          // LOOSE: take then give of one item the hero lacks must be refused
          { text: 'Reverse swap.', then: [{ take: ['copper_ore', 1] }, { give: ['copper_ore', 1] }], goto: 'end' },
          // LOOSE: no `when`; the effect itself must refuse a chain step that is not open
          { text: 'Claim a later step.', then: [{ claimStarter: 'sq_forge' }], goto: 'end' },
          // LOOSE: the give succeeds on the copy, the take fails, so the copy is dropped and nothing is given
          { text: 'Half and half.', then: [{ give: ['copper_ore', 1] }, { take: ['bronze_scimitar', 1] }], goto: 'end' }
        ]
      },
      thanks: { say: 'Well done.', options: [{ text: 'Farewell.', goto: 'end' }] }
    }
  },
  {
    npc: 'fx_other',
    greet: [{ node: 'hello' }],
    nodes: {
      hello: { say: 'Hm.', options: [{ text: 'Hm.', goto: 'secret' }] },
      secret: { say: 'Only I say this.', options: [{ text: 'Bye.', goto: 'end' }] }
    }
  }
];

const ROWS = { NPCS: FX_NPCS, DIALOGUES: FX_DIALOGUES, STORY_QUESTS: FX_STORY_QUESTS } as const;

/** Adds the fixture rows to a live table, an array or a record keyed by id (or by `npc` for a dialogue). */
export function addRows(table: unknown, rows: readonly object[]): void {
  for (const row of rows) {
    const r = row as { id?: string; npc?: string };
    if (Array.isArray(table)) table.push(row);
    else (table as Record<string, unknown>)[(r.id ?? r.npc) as string] = row;
  }
}

/** For `vi.mock` factories: the real module with the fixture rows added to its table. */
export function withFixture<T extends Record<string, unknown>>(key: keyof typeof ROWS, mod: T): T {
  addRows(mod[key], ROWS[key]);
  return mod;
}

/** The ids of a table of people, array or record. */
export function npcIds(table: unknown): string[] {
  return Array.isArray(table) ? table.map((n) => (n as { id: string }).id) : Object.keys(table as object);
}

/** A comparable copy of a state (Sets become arrays). */
export function snapshot(state: unknown): string {
  return JSON.stringify(state, (_k, v) => (v instanceof Set ? [...v].sort() : v));
}

interface Result {
  ok: boolean;
  reason?: string;
  view?: { nodeId: string; say: string; options: { index: number; text: string }[] } | null;
  events?: { type: string }[];
}

export const viewOf = (r: unknown) => (r as Result).view!;
export const eventTypes = (r: unknown) => (r as Result).events!.map((e) => e.type);
