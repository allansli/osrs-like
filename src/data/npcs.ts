export interface NpcDef {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  tunic: number;
  hat?: number;
}

// Stage 6, slice 2 (Q6, design 7.2): the cast. Coordinates are the content file's, checked on the real world.
export const NPCS: NpcDef[] = [
  { id: 'bran_tolley', name: 'Bran Tolley', role: 'Gatewarden of the start town; voice of the starter chain', x: 4, z: 12, tunic: 0x7c5a2e },
  { id: 'odalys_venn', name: 'Odalys Venn', role: 'The last Lampwright; main-line quest giver', x: -8, z: -6, tunic: 0xb7791f },
  { id: 'pell_greaves', name: 'Pell Greaves', role: 'Cook and brewer at the start-town range', x: 12, z: -8, tunic: 0x8c3b2a },
  { id: 'tamsin_reeve', name: 'Tamsin Reeve', role: 'Master smith at the east forge', x: 88, z: -22, tunic: 0x475569 },
  { id: 'qadir_salthand', name: 'Qadir Salt-Hand', role: 'Tanner and caravan master in the dunes', x: 60, z: 66, tunic: 0xc2410c },
  { id: 'hesper_moth', name: 'Hesper Moth', role: 'Hermit runebinder at the hollow on the woods road', x: -52, z: -10, tunic: 0x4c5d8a },
  { id: 'corin_ashby', name: 'Corin Ashby', role: 'Warden of the cairn before the pass', x: -5, z: 48, tunic: 0x6b7280 }
];
