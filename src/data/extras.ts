/** Phase-1 items that give logs, ammo, runes, and bars a real inventory identity. */
export const EXTRA_ITEMS = {
  maple_logs: { id: 'maple_logs', name: 'Maple Logs', type: 'resource', iconKind: 'logs', price: 110, color: 0x9a6b32, trim: 0xd4a017 },
  arrow_shaft: { id: 'arrow_shaft', name: 'Arrow Shafts', type: 'ammo', iconKind: 'arrow', price: 2, color: 0xd6c4a8, trim: 0x8d6b3a },
  feather: { id: 'feather', name: 'Feather', type: 'ammo', iconKind: 'feather', price: 3, color: 0xf8fafc, trim: 0xe2e8f0 },
  bronze_arrow: { id: 'bronze_arrow', name: 'Bronze Arrow', type: 'ammo', iconKind: 'arrow', price: 8, color: 0xb87333, trim: 0xfde68a },
  bronze_bolts: { id: 'bronze_bolts', name: 'Bronze Bolts', type: 'ammo', iconKind: 'bolts', price: 10, color: 0xb87333, trim: 0xe2e8f0 },
  ashes: { id: 'ashes', name: 'Ashes', type: 'resource', iconKind: 'ore', price: 4, color: 0x78716c, trim: 0xd6d3d1 },

  bronze_bar: { id: 'bronze_bar', name: 'Bronze Bar', type: 'bar', iconKind: 'bar', price: 28, color: 0xb87333, trim: 0xfbbf24 },
  iron_bar: { id: 'iron_bar', name: 'Iron Bar', type: 'bar', iconKind: 'bar', price: 70, color: 0x9ca3af, trim: 0xe5e7eb },
  mithril_bar: { id: 'mithril_bar', name: 'Mithril Bar', type: 'bar', iconKind: 'bar', price: 180, color: 0x2563eb, trim: 0x93c5fd },
  gold_bar: { id: 'gold_bar', name: 'Gold Bar', type: 'bar', iconKind: 'bar', price: 240, color: 0xfacc15, trim: 0xfef08a },
  runite_bar: { id: 'runite_bar', name: 'Runite Bar', type: 'bar', iconKind: 'bar', price: 780, color: 0x06b6d4, trim: 0xa5f3fc },

  air_rune: { id: 'air_rune', name: 'Air Rune', type: 'rune', iconKind: 'rune', price: 6, color: 0xe2e8f0, trim: 0xf8fafc },
  mind_rune: { id: 'mind_rune', name: 'Mind Rune', type: 'rune', iconKind: 'rune', price: 5, color: 0xf472b6, trim: 0xfbcfe8 },
  water_rune: { id: 'water_rune', name: 'Water Rune', type: 'rune', iconKind: 'rune', price: 6, color: 0x38bdf8, trim: 0xe0f2fe },
  earth_rune: { id: 'earth_rune', name: 'Earth Rune', type: 'rune', iconKind: 'rune', price: 6, color: 0x65a30d, trim: 0xbef264 },
  fire_rune: { id: 'fire_rune', name: 'Fire Rune', type: 'rune', iconKind: 'rune', price: 7, color: 0xf97316, trim: 0xfde047 },
  chaos_rune: { id: 'chaos_rune', name: 'Chaos Rune', type: 'rune', iconKind: 'rune', price: 40, color: 0xf59e0b, trim: 0xfef08a },
  death_rune: { id: 'death_rune', name: 'Death Rune', type: 'rune', iconKind: 'rune', price: 90, color: 0x334155, trim: 0x94a3b8 },
  blood_rune: { id: 'blood_rune', name: 'Blood Rune', type: 'rune', iconKind: 'rune', price: 160, color: 0xdc2626, trim: 0xfecaca },
  law_rune: { id: 'law_rune', name: 'Law Rune', type: 'rune', iconKind: 'rune', price: 120, color: 0x1d4ed8, trim: 0xfde047 },

  maple_bow: { id: 'maple_bow', name: 'Maple Shortbow', type: 'equip', slot: 'weapon', iconKind: 'bow', style: 'ranged', tier: 'steel', rng: 36, req: { ranged: 25 }, price: 900, color: 0x9a6b32, trim: 0xfde68a },
  magic_bow: { id: 'magic_bow', name: 'Magic Longbow', type: 'equip', slot: 'weapon', iconKind: 'bow', style: 'ranged', tier: 'rune', rng: 72, req: { ranged: 50 }, price: 6400, color: 0x0284c7, trim: 0xfef08a }
};
