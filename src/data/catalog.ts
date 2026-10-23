export const SKILLS_META = {
  attack:      { name: 'Attack',      desc: 'Increases melee accuracy & unlocks higher weapon tiers.' },
  strength:    { name: 'Strength',    desc: 'Increases your maximum melee damage hit.' },
  defence:     { name: 'Defence',     desc: 'Reduces monster hit chance & unlocks higher armor sets.' },
  hitpoints:   { name: 'Hitpoints',   desc: 'Your life pool. Eat cooked fish, meat, or potions to heal.' },
  ranged:      { name: 'Ranged',      desc: 'Increases bow accuracy, ranged max hit & unlocks bows.' },
  magic:       { name: 'Magic',       desc: 'Unlocks elemental & ancient spells and city teleports.' },
  prayer:      { name: 'Prayer',      desc: 'Bury bones for XP. Unlocks overhead protection & boost prayers.' },
  woodcutting: { name: 'Woodcutting', desc: 'Chop trees from Normal up to Sacred Yew & Magic Korok trees.' },
  mining:      { name: 'Mining',      desc: 'Mine ore veins from Copper & Iron up to Gold & Runite.' },
  smithing:    { name: 'Smithing',    desc: 'Smelt bars & forge weapons, helmets, platebodies, and platelegs.' },
  fishing:     { name: 'Fishing',     desc: 'Catch shrimp, trout, salmon, lobster, and sharks.' },
  cooking:     { name: 'Cooking',     desc: 'Cook raw fish and stews on ranges or fires.' }
};

export const TIER_COLORS = {
  bronze:   '#b87333',
  iron:     '#9ca3af',
  steel:    '#cbd5e1',
  black:    '#334155',
  white:    '#f8fafc',
  mithril:  '#3b82f6',
  adamant:  '#10b981',
  rune:     '#06b6d4',
  gilded:   '#facc15',
  dragon:   '#dc2626',
  barrows:  '#65a30d',
  bandos:   '#d97706',
  raids:    '#a855f7',
  botw:     '#38e8ff'
};

export const ITEMS = {
  // =========================================================================
  // 1. WEAPONS (Melee Swords, Scimitars, Greataxes, Maces, Bows, Crossbows, Staffs)
  // =========================================================================
  bronze_scimitar:   { id: 'bronze_scimitar',   name: 'Bronze Scimitar',            type: 'equip', slot: 'weapon', iconKind: 'scimitar',   style: 'melee',  tier: 'bronze',  atk: 7,   str: 6,   req: { attack: 1 },  price: 45,    color: 0xb87333, trim: 0xfacc15 },
  iron_scimitar:     { id: 'iron_scimitar',     name: 'Iron Scimitar',              type: 'equip', slot: 'weapon', iconKind: 'scimitar',   style: 'melee',  tier: 'iron',    atk: 12,  str: 11,  req: { attack: 5 },  price: 140,   color: 0x9ca3af, trim: 0xe5e7eb },
  steel_longsword:   { id: 'steel_longsword',   name: 'Steel Longsword',            type: 'equip', slot: 'weapon', iconKind: 'sword',      style: 'melee',  tier: 'steel',   atk: 17,  str: 16,  req: { attack: 10 }, price: 290,   color: 0xe2e8f0, trim: 0xfacc15 },
  black_scimitar:    { id: 'black_scimitar',    name: 'Black Knight Scimitar',      type: 'equip', slot: 'weapon', iconKind: 'scimitar',   style: 'melee',  tier: 'black',   atk: 21,  str: 20,  req: { attack: 15 }, price: 440,   color: 0x1e293b, trim: 0xfacc15 },
  white_scimitar:    { id: 'white_scimitar',    name: 'White Knight Scimitar',      type: 'equip', slot: 'weapon', iconKind: 'scimitar',   style: 'melee',  tier: 'white',   atk: 22,  str: 20,  req: { attack: 15 }, price: 480,   color: 0xf8fafc, trim: 0xfacc15 },
  mith_scimitar:     { id: 'mith_scimitar',     name: 'Mithril Scimitar',           type: 'equip', slot: 'weapon', iconKind: 'scimitar',   style: 'melee',  tier: 'mithril', atk: 26,  str: 25,  req: { attack: 20 }, price: 580,   color: 0x2563eb, trim: 0x93c5fd },
  addy_scimitar:     { id: 'addy_scimitar',     name: 'Adamant Scimitar',           type: 'equip', slot: 'weapon', iconKind: 'scimitar',   style: 'melee',  tier: 'adamant', atk: 35,  str: 34,  req: { attack: 30 }, price: 1350,  color: 0x059669, trim: 0x6ee7b7 },
  rune_scimitar:     { id: 'rune_scimitar',     name: 'Rune Scimitar',              type: 'equip', slot: 'weapon', iconKind: 'scimitar',   style: 'melee',  tier: 'rune',    atk: 47,  str: 46,  req: { attack: 40 }, price: 3900,  color: 0x06b6d4, trim: 0xa5f3fc },
  gilded_scimitar:   { id: 'gilded_scimitar',   name: 'Gilded Scimitar',            type: 'equip', slot: 'weapon', iconKind: 'scimitar',   style: 'melee',  tier: 'gilded',  atk: 52,  str: 50,  req: { attack: 45 }, price: 6800,  color: 0xfacc15, trim: 0xfef08a },
  dragon_scimitar:   { id: 'dragon_scimitar',   name: 'Dragon Scimitar',            type: 'equip', slot: 'weapon', iconKind: 'scimitar',   style: 'melee',  tier: 'dragon',  atk: 67,  str: 66,  req: { attack: 60 }, price: 12000, color: 0xdc2626, trim: 0xfde047 },
  dharok_greataxe:   { id: 'dharok_greataxe',   name: "Dharok's Greataxe",          type: 'equip', slot: 'weapon', iconKind: 'greataxe',   style: 'melee',  tier: 'barrows', atk: 76,  str: 88,  req: { attack: 70 }, price: 19500, color: 0x4d7c0f, trim: 0xa3e635 },
  abyssal_whip:      { id: 'abyssal_whip',      name: 'Abyssal Whip',               type: 'equip', slot: 'weapon', iconKind: 'whip',       style: 'melee',  tier: 'dragon',  atk: 82,  str: 82,  req: { attack: 70 }, price: 24000, color: 0x991b1b, trim: 0xf87171 },
  inquisitor_mace:   { id: 'inquisitor_mace',   name: "Inquisitor's Mace",          type: 'equip', slot: 'weapon', iconKind: 'mace',       style: 'melee',  tier: 'raids',   atk: 89,  str: 90,  req: { attack: 75 }, price: 29000, color: 0x7f1d1d, trim: 0xfacc15 },
  bandos_godsword:   { id: 'bandos_godsword',   name: 'Bandos Godsword',            type: 'equip', slot: 'weapon', iconKind: 'greatsword', style: 'melee',  tier: 'bandos',  atk: 94,  str: 98,  req: { attack: 75 }, price: 32000, color: 0xd97706, trim: 0xfef08a },
  master_sword:      { id: 'master_sword',      name: 'Master Sword of Hyrule',     type: 'equip', slot: 'weapon', iconKind: 'greatsword', style: 'melee',  tier: 'botw',    atk: 108, str: 105, req: { attack: 75 }, price: 45000, color: 0x60a5fa, trim: 0x818cf8 },
  deity_sword:       { id: 'deity_sword',       name: 'Fierce Deity Helix Blade',   type: 'equip', slot: 'weapon', iconKind: 'greatsword', style: 'melee',  tier: 'botw',    atk: 118, str: 116, req: { attack: 80 }, price: 58000, color: 0x38bdf8, trim: 0xfef08a },

  shortbow:          { id: 'shortbow',          name: 'Oak Shortbow',               type: 'equip', slot: 'weapon', iconKind: 'bow',        style: 'ranged', tier: 'bronze',  rng: 16,  req: { ranged: 1 },  price: 95,    color: 0x92400e, trim: 0xfde68a },
  willow_bow:        { id: 'willow_bow',        name: 'Willow Longbow',             type: 'equip', slot: 'weapon', iconKind: 'bow',        style: 'ranged', tier: 'iron',    rng: 28,  req: { ranged: 15 }, price: 450,   color: 0x65a30d, trim: 0xfef08a },
  yew_bow:           { id: 'yew_bow',           name: 'Yew Compound Bow',           type: 'equip', slot: 'weapon', iconKind: 'bow',        style: 'ranged', tier: 'rune',    rng: 50,  req: { ranged: 35 }, price: 2100,  color: 0xca8a04, trim: 0x38bdf8 },
  rune_crossbow:     { id: 'rune_crossbow',     name: 'Rune Crossbow',              type: 'equip', slot: 'weapon', iconKind: 'crossbow',   style: 'ranged', tier: 'rune',    rng: 64,  req: { ranged: 45 }, price: 4800,  color: 0x06b6d4, trim: 0xa5f3fc },
  ancient_bow:       { id: 'ancient_bow',       name: 'Sheikah Ancient Bow',        type: 'equip', slot: 'weapon', iconKind: 'bow',        style: 'ranged', tier: 'botw',    rng: 88,  req: { ranged: 60 }, price: 16000, color: 0x0284c7, trim: 0x38e8ff },
  armadyl_crossbow:  { id: 'armadyl_crossbow',  name: 'Armadyl Crossbow',           type: 'equip', slot: 'weapon', iconKind: 'crossbow',   style: 'ranged', tier: 'raids',   rng: 102, req: { ranged: 70 }, price: 28000, color: 0xfef08a, trim: 0x94a3b8 },

  fire_staff:        { id: 'fire_staff',        name: 'Staff of Fire',              type: 'equip', slot: 'weapon', iconKind: 'staff',      style: 'magic',  tier: 'mithril', mag: 24,  atk: 8,  str: 7,  req: { magic: 1 },  price: 320,   color: 0xef4444, trim: 0xfde047 },
  mystic_staff:      { id: 'mystic_staff',      name: 'Mystic Water Staff',         type: 'equip', slot: 'weapon', iconKind: 'staff',      style: 'magic',  tier: 'rune',    mag: 46,  atk: 16, str: 14, req: { magic: 30 }, price: 2400,  color: 0x0ea5e9, trim: 0xe0f2fe },
  ancient_staff:     { id: 'ancient_staff',     name: 'Ancient Sceptre',            type: 'equip', slot: 'weapon', iconKind: 'staff',      style: 'magic',  tier: 'dragon',  mag: 75,  atk: 28, str: 24, req: { magic: 50 }, price: 11000, color: 0xa855f7, trim: 0xfde047 },
  ahrim_staff:       { id: 'ahrim_staff',       name: "Ahrim's Barrows Staff",      type: 'equip', slot: 'weapon', iconKind: 'staff',      style: 'magic',  tier: 'barrows', mag: 88,  atk: 34, str: 30, req: { magic: 65 }, price: 18500, color: 0x65a30d, trim: 0xd9f99d },
  kodai_wand:        { id: 'kodai_wand',        name: 'Kodai Elder Wand',           type: 'equip', slot: 'weapon', iconKind: 'wand',       style: 'magic',  tier: 'raids',   mag: 112, atk: 40, str: 35, req: { magic: 75 }, price: 36000, color: 0xc084fc, trim: 0xfef08a },

  // =========================================================================
  // 2. COMPLETE MATCHED TOP (body) & BOTTOM (legs) PAIRS — 33 FULL SETS (66 ITEMS)
  // Every Top has an exact pairId -> Bottom, and every Bottom has pairId -> Top!
  // =========================================================================

  // Pair 1: Hylian Traveler Set (Lv 1)
  hylian_tunic:      { id: 'hylian_tunic',      pairId: 'hylian_trousers',   setName: 'Hylian Traveler Set',   name: 'Hylian Traveler Tunic',   type: 'equip', slot: 'body', iconKind: 'tunic',       tier: 'bronze',  def: 6,  atk: 2,  req: { defence: 1 },  price: 60,    color: 0x15803d, trim: 0xfacc15 },
  hylian_trousers:   { id: 'hylian_trousers',   pairId: 'hylian_tunic',      setName: 'Hylian Traveler Set',   name: 'Hylian Trousers',         type: 'equip', slot: 'legs', iconKind: 'trousers',    tier: 'bronze',  def: 5,  atk: 1,  req: { defence: 1 },  price: 50,    color: 0xa1887f, trim: 0xd7ccc8 },

  // Pair 2: Bronze Plate Set (Lv 1)
  bronze_plate:      { id: 'bronze_plate',      pairId: 'bronze_legs',       setName: 'Bronze Plate Set',      name: 'Bronze Platebody',        type: 'equip', slot: 'body', iconKind: 'body',        tier: 'bronze',  def: 10, req: { defence: 1 },  price: 85,    color: 0xb87333, trim: 0xd97706 },
  bronze_legs:       { id: 'bronze_legs',       pairId: 'bronze_plate',      setName: 'Bronze Plate Set',      name: 'Bronze Platelegs',        type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'bronze',  def: 7,  req: { defence: 1 },  price: 65,    color: 0xb87333, trim: 0xd97706 },

  // Pair 3: Iron Plate Set (Lv 5)
  iron_plate:        { id: 'iron_plate',        pairId: 'iron_legs',         setName: 'Iron Plate Set',        name: 'Iron Platebody',          type: 'equip', slot: 'body', iconKind: 'body',        tier: 'iron',    def: 16, req: { defence: 5 },  price: 220,   color: 0x9ca3af, trim: 0xe5e7eb },
  iron_legs:         { id: 'iron_legs',         pairId: 'iron_plate',        setName: 'Iron Plate Set',        name: 'Iron Platelegs',          type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'iron',    def: 12, req: { defence: 5 },  price: 175,   color: 0x9ca3af, trim: 0xe5e7eb },

  // Pair 4: Steel Plate Set (Lv 10)
  steel_plate:       { id: 'steel_plate',       pairId: 'steel_legs',        setName: 'Steel Plate Set',       name: 'Steel Platebody',         type: 'equip', slot: 'body', iconKind: 'body',        tier: 'steel',   def: 22, req: { defence: 10 }, price: 460,   color: 0xcbd5e1, trim: 0xf8fafc },
  steel_legs:        { id: 'steel_legs',        pairId: 'steel_plate',       setName: 'Steel Plate Set',       name: 'Steel Platelegs',         type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'steel',   def: 17, req: { defence: 10 }, price: 360,   color: 0xcbd5e1, trim: 0xf8fafc },

  // Pair 5: Black Knight Set (Lv 15)
  black_plate:       { id: 'black_plate',       pairId: 'black_legs',        setName: 'Black Knight Set',      name: 'Black Platebody',         type: 'equip', slot: 'body', iconKind: 'body',        tier: 'black',   def: 26, str: 2,  req: { defence: 15 }, price: 640,   color: 0x1e293b, trim: 0xfacc15 },
  black_legs:        { id: 'black_legs',        pairId: 'black_plate',       setName: 'Black Knight Set',      name: 'Black Platelegs',         type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'black',   def: 20, str: 1,  req: { defence: 15 }, price: 510,   color: 0x1e293b, trim: 0xfacc15 },

  // Pair 6: White Knight Proselyte Set (Lv 15)
  white_plate:       { id: 'white_plate',       pairId: 'white_legs',        setName: 'White Knight Set',      name: 'White Knight Hauberk',    type: 'equip', slot: 'body', iconKind: 'body',        tier: 'white',   def: 27, atk: 3,  req: { defence: 15 }, price: 690,   color: 0xf8fafc, trim: 0xfacc15 },
  white_legs:        { id: 'white_legs',        pairId: 'white_plate',       setName: 'White Knight Set',      name: 'White Knight Cuisse',     type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'white',   def: 21, atk: 2,  req: { defence: 15 }, price: 540,   color: 0xf8fafc, trim: 0xfacc15 },

  // Pair 7: Mithril Plate Set (Lv 20)
  mith_plate:        { id: 'mith_plate',        pairId: 'mith_legs',         setName: 'Mithril Plate Set',     name: 'Mithril Platebody',       type: 'equip', slot: 'body', iconKind: 'body',        tier: 'mithril', def: 32, req: { defence: 20 }, price: 850,   color: 0x2563eb, trim: 0x93c5fd },
  mith_legs:         { id: 'mith_legs',         pairId: 'mith_plate',        setName: 'Mithril Plate Set',     name: 'Mithril Platelegs',       type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'mithril', def: 24, req: { defence: 20 }, price: 680,   color: 0x2563eb, trim: 0x93c5fd },

  // Pair 8: Adamant Plate Set (Lv 30)
  addy_plate:        { id: 'addy_plate',        pairId: 'addy_legs',         setName: 'Adamant Plate Set',     name: 'Adamant Platebody',       type: 'equip', slot: 'body', iconKind: 'body',        tier: 'adamant', def: 44, req: { defence: 30 }, price: 2100,  color: 0x059669, trim: 0x6ee7b7 },
  addy_legs:         { id: 'addy_legs',         pairId: 'addy_plate',        setName: 'Adamant Plate Set',     name: 'Adamant Platelegs',       type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'adamant', def: 33, req: { defence: 30 }, price: 1550,  color: 0x059669, trim: 0x6ee7b7 },

  // Pair 9: Rune Plate Set (Lv 40)
  rune_plate:        { id: 'rune_plate',        pairId: 'rune_legs',         setName: 'Rune Plate Set',        name: 'Rune Platebody',          type: 'equip', slot: 'body', iconKind: 'body',        tier: 'rune',    def: 58, req: { defence: 40 }, price: 5200,  color: 0x06b6d4, trim: 0xa5f3fc },
  rune_legs:         { id: 'rune_legs',         pairId: 'rune_plate',        setName: 'Rune Plate Set',        name: 'Rune Platelegs',          type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'rune',    def: 44, req: { defence: 40 }, price: 3800,  color: 0x06b6d4, trim: 0xa5f3fc },

  // Pair 10: Gilded Treasure Set (Lv 45)
  gilded_plate:      { id: 'gilded_plate',      pairId: 'gilded_legs',       setName: 'Gilded Treasure Set',   name: 'Gilded Platebody',        type: 'equip', slot: 'body', iconKind: 'body',        tier: 'gilded',  def: 62, str: 3,  req: { defence: 45 }, price: 8200,  color: 0xfacc15, trim: 0xfef08a },
  gilded_legs:       { id: 'gilded_legs',       pairId: 'gilded_plate',      setName: 'Gilded Treasure Set',   name: 'Gilded Platelegs',        type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'gilded',  def: 48, str: 2,  req: { defence: 45 }, price: 6500,  color: 0xfacc15, trim: 0xfef08a },

  // Pair 11: Granite Fortress Set (Lv 50)
  granite_body:      { id: 'granite_body',      pairId: 'granite_legs',      setName: 'Granite Fortress Set',  name: 'Granite Platebody',       type: 'equip', slot: 'body', iconKind: 'body',        tier: 'steel',   def: 66, str: 2,  req: { defence: 50 }, price: 9600,  color: 0x64748b, trim: 0x94a3b8 },
  granite_legs:      { id: 'granite_legs',      pairId: 'granite_body',      setName: 'Granite Fortress Set',  name: 'Granite Platelegs',       type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'steel',   def: 51, str: 2,  req: { defence: 50 }, price: 7400,  color: 0x64748b, trim: 0x94a3b8 },

  // Pair 12: Dragon Armor Set (Lv 60)
  dragon_chain:      { id: 'dragon_chain',      pairId: 'dragon_legs',       setName: 'Dragon Armor Set',      name: 'Dragon Platebody',        type: 'equip', slot: 'body', iconKind: 'body',        tier: 'dragon',  def: 72, str: 5,  req: { defence: 60 }, price: 14500, color: 0xdc2626, trim: 0xfacc15 },
  dragon_legs:       { id: 'dragon_legs',       pairId: 'dragon_chain',      setName: 'Dragon Armor Set',      name: 'Dragon Platelegs',        type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'dragon',  def: 56, str: 4,  req: { defence: 60 }, price: 11500, color: 0xdc2626, trim: 0xfacc15 },

  // Pair 13: Dharok's Barrows Set (Lv 70)
  dharok_body:       { id: 'dharok_body',       pairId: 'dharok_legs',       setName: "Dharok's Barrows Set",  name: "Dharok's Platebody",      type: 'equip', slot: 'body', iconKind: 'body',        tier: 'barrows', def: 78, str: 8,  req: { defence: 70 }, price: 19500, color: 0x3f6212, trim: 0xa3e635 },
  dharok_legs:       { id: 'dharok_legs',       pairId: 'dharok_body',       setName: "Dharok's Barrows Set",  name: "Dharok's Platelegs",      type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'barrows', def: 62, str: 6,  req: { defence: 70 }, price: 16500, color: 0x3f6212, trim: 0xa3e635 },

  // Pair 14: Torag's Barrows Set (Lv 70)
  torag_body:        { id: 'torag_body',        pairId: 'torag_legs',        setName: "Torag's Barrows Set",   name: "Torag's Platebody",       type: 'equip', slot: 'body', iconKind: 'body',        tier: 'barrows', def: 82, str: 5,  req: { defence: 70 }, price: 18500, color: 0x365314, trim: 0xfde047 },
  torag_legs:        { id: 'torag_legs',        pairId: 'torag_body',        setName: "Torag's Barrows Set",   name: "Torag's Platelegs",       type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'barrows', def: 66, str: 4,  req: { defence: 70 }, price: 15500, color: 0x365314, trim: 0xfde047 },

  // Pair 15: Bandos War God Set (Lv 65)
  bandos_chest:      { id: 'bandos_chest',      pairId: 'bandos_tassets',    setName: 'Bandos War God Set',    name: 'Bandos Chestplate',       type: 'equip', slot: 'body', iconKind: 'body',        tier: 'bandos',  def: 80, str: 12, req: { defence: 65 }, price: 26000, color: 0x57534e, trim: 0xd97706 },
  bandos_tassets:    { id: 'bandos_tassets',    pairId: 'bandos_chest',      setName: 'Bandos War God Set',    name: 'Bandos Tassets',          type: 'equip', slot: 'legs', iconKind: 'tassets',     tier: 'bandos',  def: 64, str: 10, req: { defence: 65 }, price: 22000, color: 0x78716c, trim: 0xd97706 },

  // Pair 16: Justiciar Paladin Set (Lv 75)
  justiciar_body:    { id: 'justiciar_body',    pairId: 'justiciar_legs',    setName: 'Justiciar Paladin Set', name: 'Justiciar Chestguard',    type: 'equip', slot: 'body', iconKind: 'body',        tier: 'raids',   def: 94, str: 6,  req: { defence: 75 }, price: 31000, color: 0xe2e8f0, trim: 0x38bdf8 },
  justiciar_legs:    { id: 'justiciar_legs',    pairId: 'justiciar_body',    setName: 'Justiciar Paladin Set', name: 'Justiciar Legguards',     type: 'equip', slot: 'legs', iconKind: 'tassets',     tier: 'raids',   def: 76, str: 5,  req: { defence: 75 }, price: 26500, color: 0xe2e8f0, trim: 0x38bdf8 },

  // Pair 17: Inquisitor's Crush Set (Lv 75)
  inquisitor_body:   { id: 'inquisitor_body',   pairId: 'inquisitor_legs',   setName: "Inquisitor's Set",      name: "Inquisitor's Hauberk",    type: 'equip', slot: 'body', iconKind: 'body',        tier: 'raids',   def: 76, atk: 16, str: 14, req: { defence: 75 }, price: 34000, color: 0x7f1d1d, trim: 0xd97706 },
  inquisitor_legs:   { id: 'inquisitor_legs',   pairId: 'inquisitor_body',   setName: "Inquisitor's Set",      name: "Inquisitor's Plateskirt", type: 'equip', slot: 'legs', iconKind: 'tassets',     tier: 'raids',   def: 60, atk: 12, str: 11, req: { defence: 75 }, price: 29000, color: 0x7f1d1d, trim: 0xd97706 },

  // Pair 18: Torva Ancient Nex Set (Lv 80)
  torva_body:        { id: 'torva_body',        pairId: 'torva_legs',        setName: 'Torva Ancient Set',     name: 'Torva Platebody',         type: 'equip', slot: 'body', iconKind: 'body',        tier: 'raids',   def: 98, str: 18, atk: 12, req: { defence: 80 }, price: 48000, color: 0x4c1d95, trim: 0xc084fc },
  torva_legs:        { id: 'torva_legs',        pairId: 'torva_body',        setName: 'Torva Ancient Set',     name: 'Torva Platelegs',         type: 'equip', slot: 'legs', iconKind: 'tassets',     tier: 'raids',   def: 80, str: 14, atk: 10, req: { defence: 80 }, price: 42000, color: 0x4c1d95, trim: 0xc084fc },

  // Pair 19: Champion of Hyrule Set (Lv 50)
  champion_tunic:    { id: 'champion_tunic',    pairId: 'champion_leggings', setName: 'Champion of Hyrule Set',name: "Champion's Tunic",        type: 'equip', slot: 'body', iconKind: 'tunic',       tier: 'botw',    def: 84, str: 12, rng: 12, mag: 12, req: { defence: 50 }, price: 19000, color: 0x0284c7, trim: 0xfde047 },
  champion_leggings: { id: 'champion_leggings', pairId: 'champion_tunic',    setName: 'Champion of Hyrule Set',name: "Champion's Trousers",     type: 'equip', slot: 'legs', iconKind: 'trousers',    tier: 'botw',    def: 66, str: 9,  rng: 9,  mag: 9,  req: { defence: 50 }, price: 15500, color: 0xd6c7ab, trim: 0x0284c7 },

  // Pair 20: Zora Royal Domain Set (Lv 55)
  zora_armor:        { id: 'zora_armor',        pairId: 'zora_greaves',      setName: 'Zora Royal Set',        name: 'Zora Scale Cuirass',      type: 'equip', slot: 'body', iconKind: 'body',        tier: 'botw',    def: 76, atk: 14, mag: 14, req: { defence: 55 }, price: 21000, color: 0x0ea5e9, trim: 0xe0f2fe },
  zora_greaves:      { id: 'zora_greaves',      pairId: 'zora_armor',        setName: 'Zora Royal Set',        name: 'Zora Scale Greaves',      type: 'equip', slot: 'legs', iconKind: 'legs',        tier: 'botw',    def: 60, atk: 10, mag: 10, req: { defence: 55 }, price: 17000, color: 0x0ea5e9, trim: 0xe0f2fe },

  // Pair 21: Fierce Deity Set (Lv 80)
  deity_armor:       { id: 'deity_armor',       pairId: 'deity_trousers',    setName: 'Fierce Deity Set',      name: 'Fierce Deity Cuirass',    type: 'equip', slot: 'body', iconKind: 'body',        tier: 'botw',    def: 104,str: 22, atk: 18, req: { defence: 80 }, price: 54000, color: 0x1e3a8a, trim: 0x38bdf8 },
  deity_trousers:    { id: 'deity_trousers',    pairId: 'deity_armor',       setName: 'Fierce Deity Set',      name: 'Fierce Deity Leggings',   type: 'equip', slot: 'legs', iconKind: 'tassets',     tier: 'botw',    def: 86, str: 18, atk: 14, req: { defence: 80 }, price: 46000, color: 0x1e3a8a, trim: 0x38bdf8 },

  // Pair 22: Green Dragonhide Ranged Set (Lv 20 Ranged)
  green_dhide_body:  { id: 'green_dhide_body',  pairId: 'green_dhide_chaps', setName: "Green D'hide Set",      name: "Green D'hide Body",       type: 'equip', slot: 'body', iconKind: 'dhide_body',  tier: 'adamant', def: 28, rng: 22, req: { ranged: 20 },  price: 1100,  color: 0x16a34a, trim: 0x86efac },
  green_dhide_chaps: { id: 'green_dhide_chaps', pairId: 'green_dhide_body',  setName: "Green D'hide Set",      name: "Green D'hide Chaps",      type: 'equip', slot: 'legs', iconKind: 'dhide_chaps', tier: 'adamant', def: 20, rng: 16, req: { ranged: 20 },  price: 850,   color: 0x16a34a, trim: 0x86efac },

  // Pair 23: Blue Dragonhide Ranged Set (Lv 35 Ranged)
  blue_dhide_body:   { id: 'blue_dhide_body',   pairId: 'blue_dhide_chaps',  setName: "Blue D'hide Set",       name: "Blue D'hide Body",        type: 'equip', slot: 'body', iconKind: 'dhide_body',  tier: 'mithril', def: 38, rng: 32, req: { ranged: 35 },  price: 2600,  color: 0x2563eb, trim: 0x93c5fd },
  blue_dhide_chaps:  { id: 'blue_dhide_chaps',  pairId: 'blue_dhide_body',   setName: "Blue D'hide Set",       name: "Blue D'hide Chaps",       type: 'equip', slot: 'legs', iconKind: 'dhide_chaps', tier: 'mithril', def: 28, rng: 24, req: { ranged: 35 },  price: 1950,  color: 0x2563eb, trim: 0x93c5fd },

  // Pair 24: Red Dragonhide Ranged Set (Lv 50 Ranged)
  red_dhide_body:    { id: 'red_dhide_body',    pairId: 'red_dhide_chaps',   setName: "Red D'hide Set",        name: "Red D'hide Body",         type: 'equip', slot: 'body', iconKind: 'dhide_body',  tier: 'dragon',  def: 48, rng: 44, req: { ranged: 50 },  price: 5800,  color: 0xb91c1c, trim: 0xfca5a5 },
  red_dhide_chaps:   { id: 'red_dhide_chaps',   pairId: 'red_dhide_body',    setName: "Red D'hide Set",        name: "Red D'hide Chaps",        type: 'equip', slot: 'legs', iconKind: 'dhide_chaps', tier: 'dragon',  def: 36, rng: 34, req: { ranged: 50 },  price: 4400,  color: 0xb91c1c, trim: 0xfca5a5 },

  // Pair 25: Black Dragonhide Ranged Set (Lv 60 Ranged)
  black_dhide_body:  { id: 'black_dhide_body',  pairId: 'black_dhide_chaps', setName: "Black D'hide Set",      name: "Black D'hide Body",       type: 'equip', slot: 'body', iconKind: 'dhide_body',  tier: 'black',   def: 58, rng: 56, req: { ranged: 60 },  price: 10500, color: 0x18181b, trim: 0xa1a1aa },
  black_dhide_chaps: { id: 'black_dhide_chaps', pairId: 'black_dhide_body',  setName: "Black D'hide Set",      name: "Black D'hide Chaps",      type: 'equip', slot: 'legs', iconKind: 'dhide_chaps', tier: 'black',   def: 44, rng: 42, req: { ranged: 60 },  price: 8200,  color: 0x18181b, trim: 0xa1a1aa },

  // Pair 26: Sheikah Stealth Ranged Set (Lv 55 Ranged)
  sheikah_top:       { id: 'sheikah_top',       pairId: 'sheikah_bottom',    setName: 'Sheikah Stealth Set',   name: 'Sheikah Stealth Garb',    type: 'equip', slot: 'body', iconKind: 'tunic',       tier: 'botw',    def: 54, rng: 62, atk: 8,  req: { ranged: 55 },  price: 14500, color: 0x312e81, trim: 0xef4444 },
  sheikah_bottom:    { id: 'sheikah_bottom',    pairId: 'sheikah_top',       setName: 'Sheikah Stealth Set',   name: 'Sheikah Stealth Tights',  type: 'equip', slot: 'legs', iconKind: 'trousers',    tier: 'botw',    def: 42, rng: 48, atk: 6,  req: { ranged: 55 },  price: 11800, color: 0x312e81, trim: 0xef4444 },

  // Pair 27: Armadyl Ranged Set (Lv 70 Ranged)
  armadyl_body:      { id: 'armadyl_body',      pairId: 'armadyl_legs',      setName: 'Armadyl Ranged Set',    name: 'Armadyl Chestplate',      type: 'equip', slot: 'body', iconKind: 'dhide_body',  tier: 'raids',   def: 72, rng: 78, req: { ranged: 70 },  price: 27000, color: 0xe2e8f0, trim: 0xfacc15 },
  armadyl_legs:      { id: 'armadyl_legs',      pairId: 'armadyl_body',      setName: 'Armadyl Ranged Set',    name: 'Armadyl Chainskirt',      type: 'equip', slot: 'legs', iconKind: 'dhide_chaps', tier: 'raids',   def: 58, rng: 62, req: { ranged: 70 },  price: 22500, color: 0xe2e8f0, trim: 0xfacc15 },

  // Pair 28: Masori Desert Ranger Set (Lv 80 Ranged)
  masori_body:       { id: 'masori_body',       pairId: 'masori_chaps',      setName: 'Masori Ranger Set',     name: 'Masori Body (f)',         type: 'equip', slot: 'body', iconKind: 'dhide_body',  tier: 'gilded',  def: 84, rng: 96, req: { ranged: 80 },  price: 44000, color: 0xd97706, trim: 0xfef08a },
  masori_chaps:      { id: 'masori_chaps',      pairId: 'masori_body',       setName: 'Masori Ranger Set',     name: 'Masori Chaps (f)',        type: 'equip', slot: 'legs', iconKind: 'dhide_chaps', tier: 'gilded',  def: 68, rng: 78, req: { ranged: 80 },  price: 38000, color: 0xd97706, trim: 0xfef08a },

  // Pair 29: Blue Wizard Apprentice Set (Lv 1 Magic)
  wizard_top:        { id: 'wizard_top',        pairId: 'wizard_bottom',     setName: 'Blue Wizard Set',       name: 'Blue Wizard Robe Top',    type: 'equip', slot: 'body', iconKind: 'robe_top',    tier: 'mithril', def: 6,  mag: 12, req: { magic: 1 },   price: 180,   color: 0x1d4ed8, trim: 0xfde047 },
  wizard_bottom:     { id: 'wizard_bottom',     pairId: 'wizard_top',        setName: 'Blue Wizard Set',       name: 'Blue Wizard Robe Skirt',  type: 'equip', slot: 'legs', iconKind: 'robe_bottom', tier: 'mithril', def: 5,  mag: 10, req: { magic: 1 },   price: 140,   color: 0x1d4ed8, trim: 0xfde047 },

  // Pair 30: Mystic Enchanted Magic Set (Lv 20 Magic)
  mystic_top:        { id: 'mystic_top',        pairId: 'mystic_bottom',     setName: 'Mystic Robe Set',       name: 'Mystic Robe Top',         type: 'equip', slot: 'body', iconKind: 'robe_top',    tier: 'rune',    def: 22, mag: 28, req: { magic: 20 },  price: 1800,  color: 0x1e40af, trim: 0x38bdf8 },
  mystic_bottom:     { id: 'mystic_bottom',     pairId: 'mystic_top',        setName: 'Mystic Robe Set',       name: 'Mystic Robe Bottom',      type: 'equip', slot: 'legs', iconKind: 'robe_bottom', tier: 'rune',    def: 18, mag: 22, req: { magic: 20 },  price: 1400,  color: 0x1e40af, trim: 0x38bdf8 },

  // Pair 31: Infinity Runecrafter Set (Lv 45 Magic)
  infinity_top:      { id: 'infinity_top',      pairId: 'infinity_bottom',   setName: 'Infinity Robe Set',     name: 'Infinity Top',            type: 'equip', slot: 'body', iconKind: 'robe_top',    tier: 'raids',   def: 36, mag: 44, req: { magic: 45 },  price: 7200,  color: 0x9333ea, trim: 0xf472b6 },
  infinity_bottom:   { id: 'infinity_bottom',   pairId: 'infinity_top',      setName: 'Infinity Robe Set',     name: 'Infinity Bottoms',        type: 'equip', slot: 'legs', iconKind: 'robe_bottom', tier: 'raids',   def: 28, mag: 35, req: { magic: 45 },  price: 5800,  color: 0x9333ea, trim: 0xf472b6 },

  // Pair 32: Ahrim's Barrows Magic Set (Lv 65 Magic)
  ahrim_top:         { id: 'ahrim_top',         pairId: 'ahrim_bottom',      setName: "Ahrim's Barrows Set",   name: "Ahrim's Robetop",         type: 'equip', slot: 'body', iconKind: 'robe_top',    tier: 'barrows', def: 54, mag: 62, req: { magic: 65 },  price: 17500, color: 0x3f6212, trim: 0xa3e635 },
  ahrim_bottom:      { id: 'ahrim_bottom',      pairId: 'ahrim_top',         setName: "Ahrim's Barrows Set",   name: "Ahrim's Robeskirt",       type: 'equip', slot: 'legs', iconKind: 'robe_bottom', tier: 'barrows', def: 42, mag: 50, req: { magic: 65 },  price: 14500, color: 0x3f6212, trim: 0xa3e635 },

  // Pair 33: Ancestral Archmage Set (Lv 75 Magic)
  ancestral_top:     { id: 'ancestral_top',     pairId: 'ancestral_bottom',  setName: 'Ancestral Robe Set',    name: 'Ancestral Robe Top',      type: 'equip', slot: 'body', iconKind: 'robe_top',    tier: 'raids',   def: 68, mag: 88, req: { magic: 75 },  price: 39000, color: 0x6366f1, trim: 0xfde047 },
  ancestral_bottom:  { id: 'ancestral_bottom',  pairId: 'ancestral_top',     setName: 'Ancestral Robe Set',    name: 'Ancestral Robe Bottom',   type: 'equip', slot: 'legs', iconKind: 'robe_bottom', tier: 'raids',   def: 54, mag: 72, req: { magic: 75 },  price: 33000, color: 0x6366f1, trim: 0xfde047 },

  // =========================================================================
  // 3. HELMETS, HATS, HOODS & CIRCLETS (head)
  // =========================================================================
  hylian_hood:       { id: 'hylian_hood',       name: 'Hylian Cloak Hood',          type: 'equip', slot: 'head', iconKind: 'hood',    tier: 'bronze',  def: 4,  atk: 1,  req: { defence: 1 },  price: 45,    color: 0x451a03, trim: 0xd97706 },
  bronze_helm:       { id: 'bronze_helm',       name: 'Bronze Full Helm',           type: 'equip', slot: 'head', iconKind: 'head',    tier: 'bronze',  def: 5,  req: { defence: 1 },  price: 40,    color: 0xb87333, trim: 0xd97706 },
  iron_helm:         { id: 'iron_helm',         name: 'Iron Full Helm',             type: 'equip', slot: 'head', iconKind: 'head',    tier: 'iron',    def: 9,  req: { defence: 5 },  price: 110,   color: 0x9ca3af, trim: 0xe5e7eb },
  steel_helm:        { id: 'steel_helm',        name: 'Steel Full Helm',            type: 'equip', slot: 'head', iconKind: 'head',    tier: 'steel',   def: 12, req: { defence: 10 }, price: 240,   color: 0xcbd5e1, trim: 0xf8fafc },
  black_helm:        { id: 'black_helm',        name: 'Black Full Helm',            type: 'equip', slot: 'head', iconKind: 'head',    tier: 'black',   def: 14, req: { defence: 15 }, price: 360,   color: 0x1e293b, trim: 0xfacc15 },
  white_helm:        { id: 'white_helm',        name: 'White Knight Sallet',        type: 'equip', slot: 'head', iconKind: 'head',    tier: 'white',   def: 15, req: { defence: 15 }, price: 390,   color: 0xf8fafc, trim: 0xfacc15 },
  mith_helm:         { id: 'mith_helm',         name: 'Mithril Full Helm',          type: 'equip', slot: 'head', iconKind: 'head',    tier: 'mithril', def: 17, req: { defence: 20 }, price: 420,   color: 0x2563eb, trim: 0x93c5fd },
  addy_helm:         { id: 'addy_helm',         name: 'Adamant Full Helm',          type: 'equip', slot: 'head', iconKind: 'head',    tier: 'adamant', def: 23, req: { defence: 30 }, price: 960,   color: 0x059669, trim: 0x6ee7b7 },
  rune_helm:         { id: 'rune_helm',         name: 'Rune Full Helm',             type: 'equip', slot: 'head', iconKind: 'head',    tier: 'rune',    def: 31, req: { defence: 40 }, price: 2200,  color: 0x06b6d4, trim: 0xa5f3fc },
  gilded_helm:       { id: 'gilded_helm',       name: 'Gilded Full Helm',           type: 'equip', slot: 'head', iconKind: 'head',    tier: 'gilded',  def: 35, req: { defence: 45 }, price: 4500,  color: 0xfacc15, trim: 0xfef08a },
  dragon_helm:       { id: 'dragon_helm',       name: 'Dragon Full Helm',           type: 'equip', slot: 'head', iconKind: 'head',    tier: 'dragon',  def: 44, str: 3,  req: { defence: 60 }, price: 7800,  color: 0xdc2626, trim: 0xfacc15 },
  neitiznot_helm:    { id: 'neitiznot_helm',    name: 'Helm of Neitiznot',          type: 'equip', slot: 'head', iconKind: 'head',    tier: 'bandos',  def: 48, str: 6,  atk: 4,  req: { defence: 55 }, price: 11500, color: 0xe2e8f0, trim: 0xfacc15 },
  dharok_helm:       { id: 'dharok_helm',       name: "Dharok's Barrows Helm",      type: 'equip', slot: 'head', iconKind: 'head',    tier: 'barrows', def: 52, str: 5,  req: { defence: 70 }, price: 12500, color: 0x3f6212, trim: 0xa3e635 },
  justiciar_helm:    { id: 'justiciar_helm',    name: 'Justiciar Faceguard',        type: 'equip', slot: 'head', iconKind: 'head',    tier: 'raids',   def: 60, str: 4,  req: { defence: 75 }, price: 19000, color: 0xe2e8f0, trim: 0x38bdf8 },
  torva_helm:        { id: 'torva_helm',        name: 'Torva Full Helm',            type: 'equip', slot: 'head', iconKind: 'head',    tier: 'raids',   def: 64, str: 10, atk: 6,  req: { defence: 80 }, price: 29000, color: 0x4c1d95, trim: 0xc084fc },
  champion_circlet:  { id: 'champion_circlet',  name: 'Diamond Royal Circlet',      type: 'equip', slot: 'head', iconKind: 'circlet', tier: 'botw',    def: 46, str: 8,  rng: 8,  mag: 8,  req: { defence: 50 }, price: 14000, color: 0x38bdf8, trim: 0xfacc15 },
  robin_hat:         { id: 'robin_hat',         name: 'Robin Hood Ranger Hat',      type: 'equip', slot: 'head', iconKind: 'hat',     tier: 'adamant', def: 14, rng: 18, req: { ranged: 25 },  price: 2800,  color: 0x16a34a, trim: 0xef4444 },
  sheikah_mask:      { id: 'sheikah_mask',      name: 'Sheikah Stealth Mask',       type: 'equip', slot: 'head', iconKind: 'hood',    tier: 'botw',    def: 28, rng: 30, req: { ranged: 55 },  price: 8500,  color: 0x312e81, trim: 0xef4444 },
  armadyl_helm:      { id: 'armadyl_helm',      name: 'Armadyl Beaked Helm',        type: 'equip', slot: 'head', iconKind: 'head',    tier: 'raids',   def: 42, rng: 40, req: { ranged: 70 },  price: 16500, color: 0xe2e8f0, trim: 0xfacc15 },
  wizard_hat:        { id: 'wizard_hat',        name: 'Blue Wizard Hat',            type: 'equip', slot: 'head', iconKind: 'hat',     tier: 'mithril', def: 3,  mag: 8,  req: { magic: 1 },   price: 90,    color: 0x1d4ed8, trim: 0xfde047 },
  mystic_hat:        { id: 'mystic_hat',        name: 'Mystic Pointed Hat',         type: 'equip', slot: 'head', iconKind: 'hat',     tier: 'rune',    def: 12, mag: 16, req: { magic: 20 },  price: 950,   color: 0x1e40af, trim: 0x38bdf8 },
  ahrim_hood:        { id: 'ahrim_hood',        name: "Ahrim's Barrows Hood",       type: 'equip', slot: 'head', iconKind: 'hood',    tier: 'barrows', def: 28, mag: 32, req: { magic: 65 },  price: 9800,  color: 0x3f6212, trim: 0xa3e635 },
  ancestral_hat:     { id: 'ancestral_hat',     name: 'Ancestral Archmage Hat',     type: 'equip', slot: 'head', iconKind: 'hat',     tier: 'raids',   def: 38, mag: 48, req: { magic: 75 },  price: 22000, color: 0x6366f1, trim: 0xfde047 },

  // =========================================================================
  // 4. SHIELDS & DEFENDERS (shield)
  // =========================================================================
  wooden_shield:     { id: 'wooden_shield',     name: 'Wooden Kiteshield',          type: 'equip', slot: 'shield', tier: 'bronze',  def: 6,  req: { defence: 1 },  price: 35,    color: 0x854d0e, trim: 0xca8a04 },
  bronze_shield:     { id: 'bronze_shield',     name: 'Bronze Kiteshield',          type: 'equip', slot: 'shield', tier: 'bronze',  def: 8,  req: { defence: 1 },  price: 60,    color: 0xb87333, trim: 0xd97706 },
  iron_shield:       { id: 'iron_shield',       name: 'Iron Kiteshield',            type: 'equip', slot: 'shield', tier: 'iron',    def: 12, req: { defence: 5 },  price: 140,   color: 0x9ca3af, trim: 0xd1d5db },
  steel_shield:      { id: 'steel_shield',      name: 'Steel Kiteshield',           type: 'equip', slot: 'shield', tier: 'steel',   def: 16, req: { defence: 10 }, price: 310,   color: 0xcbd5e1, trim: 0xf8fafc },
  black_shield:      { id: 'black_shield',      name: 'Black Kiteshield',           type: 'equip', slot: 'shield', tier: 'black',   def: 19, req: { defence: 15 }, price: 450,   color: 0x1e293b, trim: 0xfacc15 },
  mith_shield:       { id: 'mith_shield',       name: 'Mithril Kiteshield',         type: 'equip', slot: 'shield', tier: 'mithril', def: 22, req: { defence: 20 }, price: 540,   color: 0x2563eb, trim: 0x93c5fd },
  addy_shield:       { id: 'addy_shield',       name: 'Adamant Kiteshield',         type: 'equip', slot: 'shield', tier: 'adamant', def: 30, req: { defence: 30 }, price: 1250,  color: 0x059669, trim: 0x6ee7b7 },
  rune_shield:       { id: 'rune_shield',       name: 'Rune Kiteshield',            type: 'equip', slot: 'shield', tier: 'rune',    def: 42, req: { defence: 40 }, price: 3200,  color: 0x06b6d4, trim: 0xa5f3fc },
  gilded_shield:     { id: 'gilded_shield',     name: 'Gilded Kiteshield',          type: 'equip', slot: 'shield', tier: 'gilded',  def: 46, req: { defence: 45 }, price: 5600,  color: 0xfacc15, trim: 0xfef08a },
  dragon_defender:   { id: 'dragon_defender',   name: 'Dragon Defender',            type: 'equip', slot: 'shield', iconKind: 'defender', tier: 'dragon', def: 28, atk: 18, str: 14, req: { defence: 50 }, price: 9800, color: 0xdc2626, trim: 0xfde047 },
  hylian_shield:     { id: 'hylian_shield',     name: 'Hylian Royal Shield',        type: 'equip', slot: 'shield', tier: 'botw',    def: 65, str: 8,  atk: 6,  req: { defence: 45 }, price: 15000, color: 0x1d4ed8, trim: 0xfacc15 },
  elysian_shield:    { id: 'elysian_shield',    name: 'Elysian Spirit Shield',      type: 'equip', slot: 'shield', tier: 'raids',   def: 85, mag: 15, rng: 15, req: { defence: 75 }, price: 42000, color: 0x38bdf8, trim: 0xe0f2fe },

  // =========================================================================
  // 5. BOOTS & GREAVES (feet)
  // =========================================================================
  leather_boots:     { id: 'leather_boots',     name: 'Traveler Boots',             type: 'equip', slot: 'feet', tier: 'bronze',  def: 3,  req: { defence: 1 },  price: 30,    color: 0x5c3a21, trim: 0xa16207 },
  bronze_boots:      { id: 'bronze_boots',      name: 'Bronze Greaves',             type: 'equip', slot: 'feet', tier: 'bronze',  def: 4,  req: { defence: 1 },  price: 45,    color: 0xb87333, trim: 0xd97706 },
  iron_boots:        { id: 'iron_boots',        name: 'Iron Greaves',               type: 'equip', slot: 'feet', tier: 'iron',    def: 6,  str: 1,  req: { defence: 5 },  price: 120,   color: 0x9ca3af, trim: 0xd1d5db },
  steel_boots:       { id: 'steel_boots',       name: 'Steel Greaves',              type: 'equip', slot: 'feet', tier: 'steel',   def: 9,  str: 1,  req: { defence: 10 }, price: 240,   color: 0xcbd5e1, trim: 0xf8fafc },
  mith_boots:        { id: 'mith_boots',        name: 'Mithril Greaves',            type: 'equip', slot: 'feet', tier: 'mithril', def: 12, str: 2,  req: { defence: 20 }, price: 480,   color: 0x2563eb, trim: 0x93c5fd },
  addy_boots:        { id: 'addy_boots',        name: 'Adamant Greaves',            type: 'equip', slot: 'feet', tier: 'adamant', def: 14, str: 2,  req: { defence: 30 }, price: 950,   color: 0x059669, trim: 0x6ee7b7 },
  rune_boots:        { id: 'rune_boots',        name: 'Rune Greaves',               type: 'equip', slot: 'feet', tier: 'rune',    def: 17, str: 3,  req: { defence: 40 }, price: 1900,  color: 0x06b6d4, trim: 0xa5f3fc },
  gilded_boots:      { id: 'gilded_boots',      name: 'Gilded Greaves',             type: 'equip', slot: 'feet', tier: 'gilded',  def: 19, str: 4,  req: { defence: 45 }, price: 3600,  color: 0xfacc15, trim: 0xfef08a },
  dragon_boots:      { id: 'dragon_boots',      name: 'Dragon Boots',               type: 'equip', slot: 'feet', tier: 'dragon',  def: 24, str: 7,  req: { defence: 60 }, price: 6400,  color: 0xdc2626, trim: 0xfde047 },
  bandos_boots:      { id: 'bandos_boots',      name: 'Bandos Warboots',            type: 'equip', slot: 'feet', tier: 'bandos',  def: 28, str: 6,  req: { defence: 65 }, price: 8200,  color: 0x57534e, trim: 0xd97706 },
  primordial_boots:  { id: 'primordial_boots',  name: 'Primordial Boots',           type: 'equip', slot: 'feet', tier: 'raids',   def: 32, str: 12, atk: 8,  req: { defence: 75 }, price: 18500, color: 0xb91c1c, trim: 0xfde047 },
  ranger_boots:      { id: 'ranger_boots',      name: 'Robin Ranger Boots',         type: 'equip', slot: 'feet', tier: 'adamant', def: 12, rng: 16, req: { ranged: 30 },  price: 4200,  color: 0x16a34a, trim: 0x86efac },
  pegasian_boots:    { id: 'pegasian_boots',    name: 'Pegasian Winged Boots',      type: 'equip', slot: 'feet', tier: 'raids',   def: 24, rng: 28, req: { ranged: 75 },  price: 18500, color: 0x10b981, trim: 0xfef08a },
  mystic_boots:      { id: 'mystic_boots',      name: 'Mystic Boots',               type: 'equip', slot: 'feet', tier: 'rune',    def: 10, mag: 12, req: { magic: 20 },   price: 850,   color: 0x1e40af, trim: 0x38bdf8 },
  eternal_boots:     { id: 'eternal_boots',     name: 'Eternal Archmage Boots',     type: 'equip', slot: 'feet', tier: 'raids',   def: 24, mag: 28, req: { magic: 75 },   price: 18500, color: 0x7e22ce, trim: 0xe9d5ff },

  // =========================================================================
  // 6. GAUNTLETS & VAMBRACES (hands)
  // =========================================================================
  leather_gloves:    { id: 'leather_gloves',    name: 'Leather Vambraces',          type: 'equip', slot: 'hands', tier: 'bronze',  def: 3,  rng: 3,  req: { defence: 1 },  price: 35,    color: 0x78350f, trim: 0xb45309 },
  bronze_gloves:     { id: 'bronze_gloves',     name: 'Bronze Gauntlets',           type: 'equip', slot: 'hands', tier: 'bronze',  def: 4,  str: 1,  req: { defence: 1 },  price: 45,    color: 0xb87333, trim: 0xd97706 },
  iron_gloves:       { id: 'iron_gloves',       name: 'Iron Gauntlets',             type: 'equip', slot: 'hands', tier: 'iron',    def: 6,  str: 2,  req: { defence: 5 },  price: 110,   color: 0x9ca3af, trim: 0xe5e7eb },
  mith_gloves:       { id: 'mith_gloves',       name: 'Mithril Gauntlets',          type: 'equip', slot: 'hands', tier: 'mithril', def: 9,  str: 4,  req: { defence: 20 }, price: 420,   color: 0x2563eb, trim: 0x93c5fd },
  rune_gloves:       { id: 'rune_gloves',       name: 'Rune Gauntlets',             type: 'equip', slot: 'hands', tier: 'rune',    def: 12, atk: 6,  str: 6,  req: { defence: 35 }, price: 1600,  color: 0x06b6d4, trim: 0xa5f3fc },
  dragon_gloves:     { id: 'dragon_gloves',     name: 'Dragon Gauntlets',           type: 'equip', slot: 'hands', tier: 'dragon',  def: 15, atk: 9,  str: 9,  req: { defence: 55 }, price: 4500,  color: 0xdc2626, trim: 0xfacc15 },
  barrows_gloves:    { id: 'barrows_gloves',    name: 'Barrows Gloves',             type: 'equip', slot: 'hands', tier: 'barrows', def: 18, atk: 12, str: 12, rng: 12, mag: 10, req: { defence: 45 }, price: 7500, color: 0x451a03, trim: 0xfacc15 },
  ferocious_gloves:  { id: 'ferocious_gloves',  name: 'Ferocious Hydra Gloves',     type: 'equip', slot: 'hands', tier: 'raids',   def: 20, atk: 18, str: 16, req: { defence: 75 }, price: 17500, color: 0x991b1b, trim: 0xfde047 },
  green_dhide_vamb:  { id: 'green_dhide_vamb',  name: "Green D'hide Vambraces",     type: 'equip', slot: 'hands', tier: 'adamant', def: 8,  rng: 11, req: { ranged: 20 },  price: 550,   color: 0x16a34a, trim: 0x86efac },
  black_dhide_vamb:  { id: 'black_dhide_vamb',  name: "Black D'hide Vambraces",     type: 'equip', slot: 'hands', tier: 'black',   def: 14, rng: 18, req: { ranged: 60 },  price: 3200,  color: 0x18181b, trim: 0xa1a1aa },
  mystic_gloves:     { id: 'mystic_gloves',     name: 'Mystic Gloves',              type: 'equip', slot: 'hands', tier: 'rune',    def: 6,  mag: 10, req: { magic: 20 },   price: 650,   color: 0x1e40af, trim: 0x38bdf8 },

  // =========================================================================
  // 7. CAPES, AMULETS & RINGS (cape, neck, ring)
  // =========================================================================
  hylian_cape:       { id: 'hylian_cape',       name: 'Hylian Traveler Cloak',      type: 'equip', slot: 'cape', tier: 'bronze',  def: 5,  atk: 2,  req: { defence: 1 },  price: 250,   color: 0x451a03, trim: 0xd97706 },
  obsidian_cape:     { id: 'obsidian_cape',     name: 'Obsidian Cloak',             type: 'equip', slot: 'cape', tier: 'iron',    def: 9,  req: { defence: 1 },  price: 650,   color: 0x27272a, trim: 0xef4444 },
  ava_accumulator:   { id: 'ava_accumulator',   name: "Ava's Assembler Pack",       type: 'equip', slot: 'cape', tier: 'adamant', def: 12, rng: 16, req: { ranged: 30 },  price: 3800,  color: 0x15803d, trim: 0x38bdf8 },
  god_cape:          { id: 'god_cape',          name: 'Imbued Saradomin Cape',      type: 'equip', slot: 'cape', tier: 'rune',    def: 12, mag: 20, req: { magic: 40 },   price: 4500,  color: 0x1d4ed8, trim: 0xfde047 },
  fire_cape:         { id: 'fire_cape',         name: 'Infernal Fire Cape',         type: 'equip', slot: 'cape', tier: 'dragon',  def: 18, str: 12, atk: 8,  req: { defence: 1 },  price: 9000,  color: 0xea580c, trim: 0xfde047 },
  infernal_cape:     { id: 'infernal_cape',     name: 'TzKal Infernal Max Cape',    type: 'equip', slot: 'cape', tier: 'raids',   def: 26, str: 18, atk: 14, rng: 12, mag: 12, req: { defence: 70 }, price: 28000, color: 0x7f1d1d, trim: 0xf97316 },

  amulet_accuracy:   { id: 'amulet_accuracy',   name: 'Amulet of Accuracy',         type: 'equip', slot: 'neck', tier: 'bronze',  atk: 4,  rng: 4,  mag: 4,  def: 3,  req: { attack: 1 },  price: 180,   color: 0x2563eb, trim: 0xfacc15 },
  amulet_power:      { id: 'amulet_power',      name: 'Amulet of Power',            type: 'equip', slot: 'neck', tier: 'mithril', atk: 6,  str: 6,  def: 6,  rng: 6,  mag: 6,  req: { attack: 1 },  price: 720,   color: 0x38bdf8, trim: 0xfacc15 },
  amulet_glory:      { id: 'amulet_glory',      name: 'Amulet of Glory',            type: 'equip', slot: 'neck', tier: 'rune',    atk: 10, str: 6,  def: 6,  rng: 10, mag: 10, req: { attack: 1 },  price: 1950,  color: 0xa855f7, trim: 0xfacc15 },
  amulet_fury:       { id: 'amulet_fury',       name: 'Amulet of Fury',             type: 'equip', slot: 'neck', tier: 'dragon',  atk: 12, str: 10, def: 15, rng: 12, mag: 12, req: { attack: 1 },  price: 5400,  color: 0xdc2626, trim: 0xfacc15 },
  amulet_torture:    { id: 'amulet_torture',    name: 'Amulet of Torture',          type: 'equip', slot: 'neck', tier: 'raids',   atk: 18, str: 16, def: 10, req: { attack: 70 }, price: 16000, color: 0xea580c, trim: 0xfde047 },
  necklace_anguish:  { id: 'necklace_anguish',  name: 'Necklace of Anguish',        type: 'equip', slot: 'neck', tier: 'raids',   rng: 22, def: 10, req: { ranged: 70 }, price: 16000, color: 0xf97316, trim: 0xfde047 },
  occult_necklace:   { id: 'occult_necklace',   name: 'Occult Arcane Necklace',     type: 'equip', slot: 'neck', tier: 'raids',   mag: 24, def: 8,  req: { magic: 70 },  price: 14000, color: 0x6366f1, trim: 0x38bdf8 },

  warrior_ring:      { id: 'warrior_ring',      name: 'Warrior Ring (i)',           type: 'equip', slot: 'ring', tier: 'mithril', atk: 10, def: 6,  req: { attack: 1 },  price: 2200,  color: 0xf97316, trim: 0xfde047 },
  berserker_ring:    { id: 'berserker_ring',    name: 'Berserker Ring (i)',         type: 'equip', slot: 'ring', tier: 'dragon',  str: 10, atk: 6,  def: 6,  req: { attack: 1 },  price: 4800,  color: 0xb91c1c, trim: 0xfde047 },
  archers_ring:      { id: 'archers_ring',      name: 'Archers Ring (i)',           type: 'equip', slot: 'ring', tier: 'rune',    rng: 12, def: 5,  req: { ranged: 1 },  price: 4200,  color: 0x22c55e, trim: 0xfde047 },
  seers_ring:        { id: 'seers_ring',        name: 'Seers Ring (i)',             type: 'equip', slot: 'ring', tier: 'rune',    mag: 14, def: 5,  req: { magic: 1 },   price: 4200,  color: 0x38bdf8, trim: 0xfde047 },
  ultor_ring:        { id: 'ultor_ring',        name: 'Ultor Vestige Ring',         type: 'equip', slot: 'ring', tier: 'raids',   str: 16, atk: 12, def: 10, req: { attack: 75 }, price: 19000, color: 0xdc2626, trim: 0xfef08a },

  // =========================================================================
  // 8. COOKED FOOD, STEWS & POTIONS
  // =========================================================================
  cooked_chicken:    { id: 'cooked_chicken',    name: 'Roast Chicken',              type: 'food',   iconKind: 'meat',   heal: 5,  price: 15,   color: 0xd97706, trim: 0xfef3c7 },
  shrimp:            { id: 'shrimp',            name: 'Cooked Shrimp',              type: 'food',   iconKind: 'fish',   heal: 4,  price: 12,   color: 0xfb7185, trim: 0xfecdd3 },
  trout:             { id: 'trout',             name: 'Grilled Trout',              type: 'food',   iconKind: 'fish',   heal: 9,  price: 45,   color: 0x94a3b8, trim: 0xfda4af },
  salmon:            { id: 'salmon',            name: 'Smoked Salmon',              type: 'food',   iconKind: 'fish',   heal: 12, price: 75,   color: 0xf97316, trim: 0xfed7aa },
  lobster:           { id: 'lobster',           name: 'Roast Lobster',              type: 'food',   iconKind: 'fish',   heal: 16, price: 130,  color: 0xdc2626, trim: 0xfca5a5 },
  swordfish:         { id: 'swordfish',         name: 'Grilled Swordfish',          type: 'food',   iconKind: 'fish',   heal: 20, price: 210,  color: 0x6366f1, trim: 0xc7d2fe },
  shark:             { id: 'shark',             name: 'Cooked Manta Shark',         type: 'food',   iconKind: 'fish',   heal: 24, price: 280,  color: 0x475569, trim: 0x94a3b8 },
  anglerfish:        { id: 'anglerfish',        name: 'Blighted Anglerfish',        type: 'food',   iconKind: 'fish',   heal: 32, price: 420,  color: 0x0f766e, trim: 0x5eead4 },
  hearty_elixir:     { id: 'hearty_elixir',     name: 'Hearty Durian Stew',         type: 'food',   iconKind: 'stew',   heal: 45, price: 650,  color: 0xfacc15, trim: 0x4ade80 },
  saradomin_brew:    { id: 'saradomin_brew',    name: 'Saradomin Golden Brew',      type: 'food',   iconKind: 'potion', heal: 38, price: 540,  color: 0xfef08a, trim: 0xfacc15 },
  prayer_potion:     { id: 'prayer_potion',     name: 'Prayer Restore Vial',        type: 'potion', iconKind: 'potion', restorePrayer: 18, price: 240, color: 0x2dd4bf, trim: 0x99f6e4 },
  super_restore:     { id: 'super_restore',     name: 'Super Restore Elixir',       type: 'potion', iconKind: 'potion', restorePrayer: 32, price: 480, color: 0xec4899, trim: 0xfbcfe8 },

  // =========================================================================
  // 9. RAW FISH, LOGS, ORES & BONES
  // =========================================================================
  raw_shrimp:        { id: 'raw_shrimp',        name: 'Raw Shrimp',                 type: 'resource', iconKind: 'fish', price: 6,   color: 0xfda4af, trim: 0xffe4e6 },
  raw_trout:         { id: 'raw_trout',         name: 'Raw Trout',                  type: 'resource', iconKind: 'fish', price: 20,  color: 0x64748b, trim: 0xcbd5e1 },
  raw_lobster:       { id: 'raw_lobster',       name: 'Raw Lobster',                type: 'resource', iconKind: 'fish', price: 65,  color: 0x9a3412, trim: 0xfdba74 },
  raw_shark:         { id: 'raw_shark',         name: 'Raw Shark',                  type: 'resource', iconKind: 'fish', price: 150, color: 0x1e293b, trim: 0x94a3b8 },

  logs:              { id: 'logs',              name: 'Normal Logs',                type: 'resource', iconKind: 'logs', price: 12,  color: 0x78350f, trim: 0xb45309 },
  oak_logs:          { id: 'oak_logs',          name: 'Oak Logs',                   type: 'resource', iconKind: 'logs', price: 32,  color: 0x92400e, trim: 0xd97706 },
  willow_logs:       { id: 'willow_logs',       name: 'Willow Logs',                type: 'resource', iconKind: 'logs', price: 75,  color: 0x4d7c0f, trim: 0x84cc16 },
  yew_logs:          { id: 'yew_logs',          name: 'Sacred Yew Logs',            type: 'resource', iconKind: 'logs', price: 190, color: 0x9d174d, trim: 0xf472b6 },
  magic_logs:        { id: 'magic_logs',        name: 'Magic Korok Logs',           type: 'resource', iconKind: 'logs', price: 480, color: 0x0284c7, trim: 0x38e8ff },

  copper_ore:        { id: 'copper_ore',        name: 'Copper Ore',                 type: 'resource', iconKind: 'ore',  price: 16,  color: 0xd97706, trim: 0xfbbf24 },
  iron_ore:          { id: 'iron_ore',          name: 'Iron Ore',                   type: 'resource', iconKind: 'ore',  price: 42,  color: 0x9ca3af, trim: 0xe5e7eb },
  mithril_ore:       { id: 'mithril_ore',       name: 'Mithril Ore',                type: 'resource', iconKind: 'ore',  price: 115, color: 0x2563eb, trim: 0x60a5fa },
  gold_ore:          { id: 'gold_ore',          name: 'Gold Ore',                   type: 'resource', iconKind: 'ore',  price: 185, color: 0xfacc15, trim: 0xfef08a },
  runite_ore:        { id: 'runite_ore',        name: 'Runite Ore',                 type: 'resource', iconKind: 'ore',  price: 620, color: 0x06b6d4, trim: 0x67e8f9 },

  bones:             { id: 'bones',             name: 'Bones',                      type: 'bones',    iconKind: 'bones', xp: 15,  price: 10,  color: 0xe2e8f0, trim: 0xffffff },
  big_bones:         { id: 'big_bones',         name: 'Big Bones',                  type: 'bones',    iconKind: 'bones', xp: 45,  price: 45,  color: 0xfef3c7, trim: 0xfde68a },
  dragon_bones:      { id: 'dragon_bones',      name: 'Dragon Bones',               type: 'bones',    iconKind: 'bones', xp: 180, price: 380, color: 0xc084fc, trim: 0xf3e8ff }
};

export const PRAYERS = [
  { id: 'thick_skin',   name: 'Thick Skin',          req: 1,  drain: 0.15, desc: '+15% Defence Bonus' },
  { id: 'burst_str',    name: 'Burst of Strength',   req: 4,  drain: 0.20, desc: '+15% Melee Strength' },
  { id: 'sharp_eye',    name: 'Eagle Eye',           req: 8,  drain: 0.22, desc: '+20% Ranged Damage' },
  { id: 'mystic_might', name: 'Mystic Might',        req: 12, drain: 0.22, desc: '+20% Magic Damage' },
  { id: 'prot_magic',   name: 'Protect from Magic',  req: 25, drain: 0.35, overhead: 'prot_magic',  desc: 'Blocks 80% of monster Magic damage' },
  { id: 'prot_ranged',  name: 'Protect from Ranged', req: 28, drain: 0.35, overhead: 'prot_ranged', desc: 'Blocks 80% of monster Ranged damage' },
  { id: 'prot_melee',   name: 'Protect from Melee',  req: 30, drain: 0.35, overhead: 'prot_melee',  desc: 'Blocks 80% of monster Melee damage' },
  { id: 'piety',        name: 'Hylian Piety',        req: 50, drain: 0.50, overhead: 'piety',       desc: '+25% Attack, Strength & Defence' }
];

export const SPELLS = [
  { id: 'wind_strike',    name: 'Wind Strike',       type: 'combat',   req: 1,  maxHit: 6,  xp: 18,  color: 0xe2e8f0, desc: 'Air gust projectile (Max Hit 6)' },
  { id: 'fire_bolt',      name: 'Fire Bolt',         type: 'combat',   req: 12, maxHit: 13, xp: 38,  color: 0xf97316, desc: 'Blazing fireball spell (Max Hit 13)' },
  { id: 'ice_burst',      name: 'Ancient Ice Burst', type: 'combat',   req: 28, maxHit: 22, xp: 68,  color: 0x38bdf8, desc: 'Freezes & shatters target (Max Hit 22)' },
  { id: 'blood_barrage',  name: 'Blood Barrage',     type: 'combat',   req: 50, maxHit: 34, xp: 115, color: 0xdc2626, healRatio: 0.25, desc: 'Heals 25% of damage dealt (Max 34)' },
  { id: 'tele_lumbridge', name: 'Lumbridge Teleport',type: 'teleport', req: 1,  regionId: 'lumbridge',  xp: 25, color: 0x3b82f6, desc: 'Teleport to Lumbridge Haven' },
  { id: 'tele_varrock',   name: 'Varrock Teleport',  type: 'teleport', req: 10, regionId: 'varrock',    xp: 35, color: 0xeab308, desc: 'Teleport to Varrock Plaza' },
  { id: 'tele_woods',     name: 'Korok Woods Tele',  type: 'teleport', req: 20, regionId: 'woods',      xp: 50, color: 0x10b981, desc: 'Teleport to Whispering Sanctuary' },
  { id: 'tele_peak',      name: "Dragon's Peak Tele",type: 'teleport', req: 35, regionId: 'wilderness', xp: 75, color: 0xef4444, desc: 'Teleport to Volcanic Highlands' }
];

export const FORGE_RECIPES = [
  { id: 'cook_shrimp',       name: 'Cook Shrimp',            skill: 'cooking',  req: 1,  xp: 30,  input: { raw_shrimp: 1 },  output: 'shrimp' },
  { id: 'cook_trout',        name: 'Grill Trout',            skill: 'cooking',  req: 10, xp: 70,  input: { raw_trout: 1 },   output: 'trout' },
  { id: 'cook_lobster',      name: 'Roast Lobster',          skill: 'cooking',  req: 25, xp: 130, input: { raw_lobster: 1 }, output: 'lobster' },
  { id: 'cook_shark',        name: 'Cook Manta Shark',       skill: 'cooking',  req: 45, xp: 240, input: { raw_shark: 1 },   output: 'shark' },
  { id: 'smith_bronze_legs', name: 'Forge Bronze Platelegs', skill: 'smithing', req: 1,  xp: 35,  input: { copper_ore: 2 },  output: 'bronze_legs' },
  { id: 'smith_bronze_plate',name: 'Forge Bronze Platebody', skill: 'smithing', req: 2,  xp: 50,  input: { copper_ore: 3 },  output: 'bronze_plate' },
  { id: 'smith_iron_scim',   name: 'Forge Iron Scimitar',    skill: 'smithing', req: 5,  xp: 65,  input: { iron_ore: 2 },    output: 'iron_scimitar' },
  { id: 'smith_iron_legs',   name: 'Forge Iron Platelegs',   skill: 'smithing', req: 7,  xp: 80,  input: { iron_ore: 2 },    output: 'iron_legs' },
  { id: 'smith_iron_plate',  name: 'Forge Iron Platebody',   skill: 'smithing', req: 9,  xp: 105, input: { iron_ore: 3 },    output: 'iron_plate' },
  { id: 'smith_mith_scim',   name: 'Forge Mithril Scimitar', skill: 'smithing', req: 20, xp: 150, input: { mithril_ore: 2 }, output: 'mith_scimitar' },
  { id: 'smith_mith_legs',   name: 'Forge Mithril Platelegs',skill: 'smithing', req: 22, xp: 175, input: { mithril_ore: 2 }, output: 'mith_legs' },
  { id: 'smith_mith_plate',  name: 'Forge Mithril Platebody',skill: 'smithing', req: 24, xp: 210, input: { mithril_ore: 3 }, output: 'mith_plate' },
  { id: 'smith_gilded_legs', name: 'Forge Gilded Platelegs', skill: 'smithing', req: 35, xp: 280, input: { gold_ore: 2 },    output: 'gilded_legs' },
  { id: 'smith_gilded_plate',name: 'Forge Gilded Platebody', skill: 'smithing', req: 38, xp: 340, input: { gold_ore: 3 },    output: 'gilded_plate' },
  { id: 'smith_rune_scim',   name: 'Forge Rune Scimitar',    skill: 'smithing', req: 40, xp: 380, input: { runite_ore: 2 },  output: 'rune_scimitar' },
  { id: 'smith_rune_legs',   name: 'Forge Rune Platelegs',   skill: 'smithing', req: 42, xp: 440, input: { runite_ore: 2 },  output: 'rune_legs' },
  { id: 'smith_rune_plate',  name: 'Forge Rune Platebody',   skill: 'smithing', req: 45, xp: 520, input: { runite_ore: 3 },  output: 'rune_plate' }
];

export const WORLD_REGIONS = [
  { id: 'lumbridge',  name: 'Lumbridge Haven',        sub: 'KINGDOM OF MISTHALIN',    x: 0,   z: 0,   radius: 46, color: '#3b82f6', desc: 'Peaceful castle town, Chickens (Lv 1), Goblin Raiders (Lv 2), River Fishing, Altar & Forge.' },
  { id: 'varrock',    name: 'Varrock Grand Plaza',    sub: 'ROYAL TRADE CAPITAL',     x: 78,  z: -20, radius: 44, color: '#eab308', desc: 'Grand Fountain, Dark Wizards (Lv 18), Hill Giants (Lv 28), East Quarry Mines.' },
  { id: 'desert',     name: 'Al-Kharid Golden Dunes', sub: 'SUNSCORCHED OASIS',       x: 68,  z: 68,  radius: 44, color: '#f59e0b', desc: 'King Scorpions (Lv 12), Oasis Fishing, Gold & Mithril Rock Quarry.' },
  { id: 'woods',      name: 'Whispering Korok Woods', sub: 'SACRED FOREST SANCTUARY', x: -75, z: -30, radius: 45, color: '#10b981', desc: 'Sacred Yew & Magic Korok Trees, Moss Guardians (Lv 45), Lobster/Shark Waterfall.' },
  { id: 'wilderness', name: "Dragon's Peak Highlands",sub: 'VOLCANIC OBSIDIAN CRAG',  x: -70, z: 68,  radius: 46, color: '#ef4444', desc: 'Runite Veins, Lesser Demons (Lv 68), and Elvarg the Crag Dragon (Lv 95 World Boss).' }
];

export const MONSTER_TYPES = {
  chicken: {
    name: 'Plump Chicken', level: 1, hp: 4, maxHit: 1, atk: 1, def: 1, scale: 0.72,
    style: 'melee', bodyColor: 0xfef3c7, accentColor: 0xef4444, kind: 'bird',
    drops: [{ id: 'bones', chance: 1.0 }, { id: 'cooked_chicken', chance: 0.6 }, { gp: [6, 18], chance: 0.85 }]
  },
  goblin: {
    name: 'Goblin Raider', level: 2, hp: 8, maxHit: 2, atk: 3, def: 2, scale: 0.9,
    style: 'melee', bodyColor: 0x4d7c0f, accentColor: 0x78350f, kind: 'goblin', weaponColor: 0xb87333,
    drops: [{ id: 'bones', chance: 1.0 }, { gp: [12, 36], chance: 0.9 }, { id: 'iron_plate', chance: 0.16 }, { id: 'iron_legs', chance: 0.16 }, { id: 'shrimp', chance: 0.35 }]
  },
  scorpion: {
    name: 'King Scorpion', level: 12, hp: 22, maxHit: 5, atk: 12, def: 10, scale: 1.05,
    style: 'melee', bodyColor: 0xb45309, accentColor: 0x451a03, kind: 'scorpion',
    drops: [{ id: 'bones', chance: 1.0 }, { gp: [40, 95], chance: 0.95 }, { id: 'steel_plate', chance: 0.22 }, { id: 'steel_legs', chance: 0.22 }, { id: 'trout', chance: 0.4 }]
  },
  dark_wizard: {
    name: 'Dark Wizard', level: 18, hp: 30, maxHit: 7, atk: 18, def: 14, scale: 1.02,
    style: 'magic', bodyColor: 0x1e1b4b, accentColor: 0x9333ea, kind: 'wizard', weaponColor: 0xa855f7,
    drops: [{ id: 'bones', chance: 1.0 }, { gp: [65, 160], chance: 0.95 }, { id: 'mystic_top', chance: 0.20 }, { id: 'mystic_bottom', chance: 0.20 }, { id: 'mith_scimitar', chance: 0.18 }]
  },
  hill_giant: {
    name: 'Hill Giant', level: 28, hp: 48, maxHit: 10, atk: 26, def: 22, scale: 1.55,
    style: 'melee', bodyColor: 0xd6a87c, accentColor: 0x57534e, kind: 'giant', weaponColor: 0x78350f,
    drops: [{ id: 'big_bones', chance: 1.0 }, { gp: [110, 260], chance: 0.95 }, { id: 'addy_plate', chance: 0.22 }, { id: 'addy_legs', chance: 0.22 }, { id: 'lobster', chance: 0.45 }]
  },
  moss_guardian: {
    name: 'Moss Guardian', level: 45, hp: 78, maxHit: 15, atk: 42, def: 38, scale: 1.72,
    style: 'melee', bodyColor: 0x15803d, accentColor: 0x4ade80, kind: 'guardian', weaponColor: 0x166534,
    drops: [{ id: 'big_bones', chance: 1.0 }, { gp: [200, 500], chance: 1.0 }, { id: 'rune_plate', chance: 0.22 }, { id: 'rune_legs', chance: 0.22 }, { id: 'green_dhide_body', chance: 0.24 }, { id: 'green_dhide_chaps', chance: 0.24 }]
  },
  lesser_demon: {
    name: 'Lesser Demon', level: 68, hp: 125, maxHit: 22, atk: 64, def: 55, scale: 1.85,
    style: 'melee', bodyColor: 0xb91c1c, accentColor: 0x1c1917, kind: 'demon', weaponColor: 0xf97316,
    drops: [{ id: 'dragon_bones', chance: 1.0 }, { gp: [450, 980], chance: 1.0 }, { id: 'dragon_chain', chance: 0.20 }, { id: 'dragon_legs', chance: 0.20 }, { id: 'dragon_scimitar', chance: 0.18 }, { id: 'shark', chance: 0.65 }]
  },
  elvarg_dragon: {
    name: 'Elvarg the Crag Dragon', level: 95, hp: 260, maxHit: 32, atk: 88, def: 78, scale: 2.35,
    style: 'magic', bodyColor: 0x15803d, accentColor: 0xfacc15, kind: 'dragon',
    drops: [{ id: 'dragon_bones', chance: 1.0 }, { gp: [1800, 3800], chance: 1.0 }, { id: 'bandos_chest', chance: 0.35 }, { id: 'bandos_tassets', chance: 0.35 }, { id: 'champion_tunic', chance: 0.35 }, { id: 'champion_leggings', chance: 0.35 }]
  }
};

export const RESOURCE_NODES_DEF = {
  normal_tree: { name: 'Normal Tree',         skill: 'woodcutting', req: 1,  xp: 25,  item: 'logs',        respawn: 5000,  kind: 'tree', foliageColor: 0x2e7d32, trunkColor: 0x5d4037, scale: 1.0 },
  oak_tree:    { name: 'Aged Oak Tree',       skill: 'woodcutting', req: 10, xp: 55,  item: 'oak_logs',    respawn: 6500,  kind: 'tree', foliageColor: 0x388e3c, trunkColor: 0x4e342e, scale: 1.35 },
  willow_tree: { name: 'Weeping Willow Tree', skill: 'woodcutting', req: 20, xp: 95,  item: 'willow_logs', respawn: 7000,  kind: 'tree', foliageColor: 0x65a30d, trunkColor: 0x5d4037, scale: 1.45 },
  yew_tree:    { name: 'Sacred Blossom Yew',  skill: 'woodcutting', req: 35, xp: 175, item: 'yew_logs',    respawn: 8500,  kind: 'tree', foliageColor: 0xf472b6, trunkColor: 0x4a2c2a, scale: 1.65 },
  magic_tree:  { name: 'Magic Korok Tree',    skill: 'woodcutting', req: 50, xp: 310, item: 'magic_logs',  respawn: 10000, kind: 'tree', foliageColor: 0x38bdf8, trunkColor: 0xfef08a, scale: 1.8 },

  copper_rock: { name: 'Copper Ore Vein',     skill: 'mining',      req: 1,  xp: 28,  item: 'copper_ore',  respawn: 4500,  kind: 'rock', oreColor: 0xd97706 },
  iron_rock:   { name: 'Iron Ore Vein',       skill: 'mining',      req: 10, xp: 58,  item: 'iron_ore',    respawn: 5500,  kind: 'rock', oreColor: 0x9ca3af },
  mith_rock:   { name: 'Mithril Ore Vein',    skill: 'mining',      req: 25, xp: 120, item: 'mithril_ore', respawn: 7000,  kind: 'rock', oreColor: 0x2563eb },
  gold_rock:   { name: 'Gold Ore Vein',       skill: 'mining',      req: 35, xp: 175, item: 'gold_ore',    respawn: 8000,  kind: 'rock', oreColor: 0xfacc15 },
  runite_rock: { name: 'Runite Ore Vein',     skill: 'mining',      req: 50, xp: 320, item: 'runite_ore',  respawn: 11000, kind: 'rock', oreColor: 0x06b6d4 },

  fish_shrimp: { name: 'Net Fishing Spot',    skill: 'fishing',     req: 1,  xp: 30,  item: 'raw_shrimp',  respawn: 2000,  kind: 'fish' },
  fish_trout:  { name: 'River Lure Spot',     skill: 'fishing',     req: 12, xp: 68,  item: 'raw_trout',   respawn: 2000,  kind: 'fish' },
  fish_lobster:{ name: 'Cage Lobster Spot',   skill: 'fishing',     req: 28, xp: 135, item: 'raw_lobster', respawn: 2500,  kind: 'fish' },
  fish_shark:  { name: 'Mystic Shark Pool',   skill: 'fishing',     req: 45, xp: 245, item: 'raw_shark',   respawn: 3000,  kind: 'fish' }
};
