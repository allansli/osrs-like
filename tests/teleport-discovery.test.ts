import { describe, expect, it } from 'vitest';
import { canCastTeleport } from '../src/state/combat';
import { createDefaultState } from '../src/state/gameState';
import { WORLD_REGIONS } from '../src/data/world';

// Red until A4 makes canCastTeleport require the destination shrine (plan 2.3, CALL-9).

const SPELL = 'tele_peak'; // Magic 35, destination 'wilderness'
const REGION = 'wilderness';

function mage() {
  const state = createDefaultState();
  state.skills.magic.lvl = 99;
  state.inventory.push({ id: 'fire_rune', qty: 50 }, { id: 'law_rune', qty: 50 });
  return state;
}

describe('teleport discovery', () => {
  it('canCastTeleport refuses a destination whose shrine is undiscovered', () => {
    const state = mage();
    state.shrines[REGION] = false;
    expect(canCastTeleport(state, SPELL).ok).toBe(false);
  });

  it('canCastTeleport accepts it once discovered', () => {
    const state = mage();
    state.shrines[REGION] = true;
    const gate = canCastTeleport(state, SPELL);
    expect(gate.ok).toBe(true);
    expect(gate.regionId).toBe(REGION);
  });

  it('the refusal reason names the shrine', () => {
    const state = mage();
    state.shrines[REGION] = false;
    const gate = canCastTeleport(state, SPELL);
    const region = WORLD_REGIONS.find((r) => r.id === REGION)!;
    expect(gate.reason).toContain(region.name);
  });
});
