import { describe, expect, it } from 'vitest';
import { RESPAWN_SECONDS, applyRespawn, deathNotice, hitSplatKind } from '../src/state/adventure';
import { createDefaultState } from '../src/state/gameState';

describe('combat juice', () => {
  it('uses a blue miss, a red hit, and a heavier splat on a max hit', () => {
    expect(hitSplatKind(0, 12)).toBe('miss');
    expect(hitSplatKind(4, 12)).toBe('hit');
    expect(hitSplatKind(12, 12)).toBe('maxhit');
    expect(hitSplatKind(13, 12)).toBe('maxhit');
  });

  it('holds a death notice, then restores the hero in Lumbridge', () => {
    const notice = deathNotice();
    expect(notice.title).toMatch(/dead/i);
    expect(notice.body).toMatch(/Lumbridge/);
    expect(RESPAWN_SECONDS).toBeGreaterThan(2);

    const state = createDefaultState();
    state.hp = 0;
    state.prayerPts = 0;
    state.activePrayers.add('prot_melee');
    state.currentRegion = 'wilderness';
    applyRespawn(state);
    expect(state.hp).toBe(state.maxHp);
    expect(state.prayerPts).toBe(state.maxPrayerPts);
    expect(state.activePrayers.size).toBe(0);
    expect(state.currentRegion).toBe('lumbridge');
  });
});
