export interface NpcDef {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  tunic: number;
  hat?: number;
}

export const NPCS: NpcDef[] = [];
