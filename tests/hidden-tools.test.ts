import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { matchCheat, matchToolsCode } from '../src/state/cheats';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const html = read('../index.html');
const runtime = read('../src/engine/runtime.ts');
const session = read('../src/engine/session.ts');

const OPEN_TAG = /<[^>]*\bid="hidden-tools"[^>]*>/g;

describe('hidden tools', () => {
  it('the reveal word is matched on its own function', () => {
    expect(matchToolsCode('backroom')).toBe(true);
    expect(matchToolsCode('::backroom')).toBe(true);
    expect(matchToolsCode('wasdbackroom')).toBe(true);
    expect(matchToolsCode('backroo')).toBe(false);
    expect(matchToolsCode('hello')).toBe(false);
    expect(matchToolsCode('')).toBe(false);
  });

  it('the cheat matcher is untouched', () => {
    expect(matchCheat('backroom')).toBeNull();
    expect(matchCheat('skills10')).toBe('skills');
    expect(matchCheat('gold200k')).toBe('gold');
  });

  it('the tools block is hidden in the page', () => {
    const tags = html.match(OPEN_TAG) ?? [];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatch(/\bhidden\b/);
  });

  it('the 10x button and the cheat panel are inside the block', () => {
    const start = html.search(OPEN_TAG);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = html.indexOf('<div id="item-tooltip">', start);
    expect(end).toBeGreaterThan(start);
    const inside = html.slice(start, end);
    for (const needle of ['id="xp-rate-btn"', 'id="cheat-code-input"', 'data-action="cheatSkillsPlus10"', 'data-action="cheatGold200k"']) {
      expect(inside).toContain(needle);
    }
  });

  it('nothing outside the block names them', () => {
    const start = html.search(OPEN_TAG);
    expect(start).toBeGreaterThanOrEqual(0);
    const before = html.slice(0, start);
    for (const needle of ['xp-rate-btn', 'cheat', 'skills10', 'gold200k', '10x', 'League XP']) {
      expect(before).not.toContain(needle);
    }
  });

  it('the boot code does not advertise', () => {
    expect(runtime).not.toContain('skills10');
    expect(runtime).not.toContain('gold200k');
    expect(session).not.toContain('Try <b>skills10');
  });

  it('a save at 10x is told once', () => {
    expect(runtime).toContain('This character earns experience at');
  });
});
