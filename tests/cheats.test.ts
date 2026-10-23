import { describe, expect, it } from 'vitest';
import { getLevelForXp, OSRS_XP_TABLE } from '../src/data/skills';
import { applyGold200k, applySkillsPlus10, matchCheat } from '../src/state/cheats';
import { createDefaultState } from '../src/state/gameState';

describe('cheat codes', () => {
  it('raises every skill by 10 and syncs XP, hitpoints, and prayer', () => {
    const state = createDefaultState();
    const before = Object.fromEntries(
      Object.entries(state.skills).map(([key, skill]) => [key, skill.lvl])
    );

    applySkillsPlus10(state);

    for (const [key, skill] of Object.entries(state.skills)) {
      const expected = Math.min(99, before[key] + 10);
      expect(skill.lvl).toBe(expected);
      expect(skill.xp).toBeGreaterThanOrEqual(OSRS_XP_TABLE[skill.lvl - 1]);
      expect(skill.xp).toBeGreaterThanOrEqual(OSRS_XP_TABLE[skill.lvl]);
      expect(getLevelForXp(skill.xp)).toBe(skill.lvl);
    }
    expect(state.maxHp).toBe(state.skills.hitpoints.lvl);
    expect(state.hp).toBe(state.maxHp);
    expect(state.maxPrayerPts).toBe(state.skills.prayer.lvl);
    expect(state.prayerPts).toBe(state.maxPrayerPts);
    expect(state.skills.hitpoints.lvl).toBe(20);
    expect(state.skills.prayer.lvl).toBe(11);
    expect(state.skills.attack.lvl).toBe(11);
  });

  it('caps a skill at level 99 and keeps experience already past that threshold', () => {
    const state = createDefaultState();
    state.skills.attack = { lvl: 95, xp: OSRS_XP_TABLE[95] };
    state.skills.strength = { lvl: 99, xp: OSRS_XP_TABLE[99] + 500 };

    applySkillsPlus10(state);

    expect(state.skills.attack.lvl).toBe(99);
    expect(state.skills.attack.xp).toBe(OSRS_XP_TABLE[99]);
    expect(getLevelForXp(state.skills.attack.xp)).toBe(99);
    expect(state.skills.strength.lvl).toBe(99);
    expect(state.skills.strength.xp).toBe(OSRS_XP_TABLE[99] + 500);
  });

  it('adds exactly 200,000 GP', () => {
    const state = createDefaultState();
    state.gp = 1250;
    applyGold200k(state);
    expect(state.gp).toBe(201250);
  });

  it('recognizes the keyboard aliases and a :: prefix', () => {
    expect(matchCheat('skills10')).toBe('skills');
    expect(matchCheat('up10')).toBe('skills');
    expect(matchCheat('levelup')).toBe('skills');
    expect(matchCheat('lvl10')).toBe('skills');
    expect(matchCheat('::lvl10')).toBe('skills');
    expect(matchCheat('wiseoldman')).toBe('skills');
    expect(matchCheat('::skills10')).toBe('skills');
    expect(matchCheat('xxSKILLS10')).toBe('skills');
    expect(matchCheat('gold200k')).toBe('gold');
    expect(matchCheat('gp200k')).toBe('gold');
    expect(matchCheat('motherlode')).toBe('gold');
    expect(matchCheat('200k')).toBe('gold');
    expect(matchCheat('::200k')).toBe('gold');
    expect(matchCheat('::gold200k')).toBe('gold');
    expect(matchCheat('wasdgold200k')).toBe('gold');
    expect(matchCheat('hello')).toBe(null);
    expect(matchCheat('')).toBe(null);
  });
});
