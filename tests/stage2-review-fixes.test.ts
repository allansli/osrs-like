import { describe, expect, it } from 'vitest';
import { createMonsterLogic, stepMonster } from '../src/state/monsterAi';

// Confirmed Stage 2 review findings (docs/superpowers/baseline/stage2-review-findings.json).

describe('review 0: a returning monster that cannot reach home', () => {
  it('a three_kettle goblin stuck on the east bank snaps home after a stall, with the arrival effects', () => {
    const m = createMonsterLogic('goblin', 12, 4, { campId: 'three_kettle' });
    // Where the bridge lure leaves it: east of the river, off the bridge deck.
    m.x = 35.21;
    m.z = 2.77;
    m.state = 'return';
    m.hp = m.maxHp - 1;
    m.breathCount = 2;
    const all: string[] = [];
    let t = 0;
    while (m.state === 'return' && t < 15) {
      all.push(...stepMonster(m, { playerX: 60, playerZ: 0, playerDown: false, dt: 0.02, rand: () => 0.5 }).map((e) => e.kind));
      t += 0.02;
    }
    expect(m.state).toBe('idle');
    expect(all).toContain('reset');
    expect(m.x).toBe(m.homeX);
    expect(m.z).toBe(m.homeZ);
    expect(m.hp).toBe(m.maxHp);
    expect(m.breathCount).toBe(0);
  });
});
