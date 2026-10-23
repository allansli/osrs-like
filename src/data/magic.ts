import { PRAYERS, SPELLS as BASE_SPELLS } from './catalog';

export { PRAYERS };

export type RuneCost = Record<string, number>;

export type SpellDef = {
  id: string;
  name: string;
  type: string;
  req: number;
  maxHit?: number;
  xp: number;
  color: number;
  desc: string;
  healRatio?: number;
  regionId?: string;
  runes: RuneCost;
};

const RUNE_COSTS: Record<string, RuneCost> = {
  wind_strike: { air_rune: 1, mind_rune: 1 },
  fire_bolt: { air_rune: 2, fire_rune: 1 },
  ice_burst: { water_rune: 2, chaos_rune: 2 },
  blood_barrage: { blood_rune: 2, death_rune: 2 },
  tele_lumbridge: { air_rune: 1, law_rune: 1 },
  tele_varrock: { air_rune: 1, law_rune: 1 },
  tele_woods: { earth_rune: 1, law_rune: 1 },
  tele_peak: { fire_rune: 1, law_rune: 1 }
};

export const SPELLS: SpellDef[] = (BASE_SPELLS as Omit<SpellDef, 'runes'>[]).map((spell) => ({
  ...spell,
  runes: RUNE_COSTS[spell.id] || {}
}));
