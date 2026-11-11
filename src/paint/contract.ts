import { PALETTE_BY_ID, type Palette } from './palettes';

/** The only stroke directions. Blender's Custom Properties panel must use these spellings. */
export const STROKE_DIRS = ['up', 'along_bone', 'surface_flow', 'flat'] as const;
export type StrokeDir = (typeof STROKE_DIRS)[number];

export type PaintClass = 'hero' | 'boss' | 'monster' | 'gear' | 'prop' | 'tree';

/** Metres, width (across) x length (along). */
export const DAB_SIZE_BY_CLASS: Record<PaintClass, readonly [number, number]> = {
  hero: [0.04, 0.09],
  boss: [0.04, 0.09],
  monster: [0.06, 0.12],
  gear: [0.03, 0.07],
  prop: [0.08, 0.16],
  tree: [0.12, 0.3]
};

export const DEFAULT_JITTER = 0.5;
export const METAL_JITTER = 0.25;

const STROKE_SET = new Set<string>(STROKE_DIRS);

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ResolvedPaint {
  paletteId: string;
  palette: Palette;
  stroke: StrokeDir;
  size: [number, number];
  jitter: number;
  /** Pins on this mesh. Null means the class budget decides. */
  density: number | null;
  source: 'object' | 'material' | 'default';
}

export interface ResolvePaintInput {
  objectUserData?: Record<string, unknown> | null;
  materialUserData?: Record<string, unknown> | null;
  paintClass?: PaintClass;
  part?: string | null;
  name?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readStroke(value: unknown): StrokeDir | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return STROKE_SET.has(v) ? (v as StrokeDir) : null;
}

function readSize(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) {
    const w = Number(value[0]);
    const h = Number(value[1]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return [w, h];
    return null;
  }
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d*\.?\d+)\s*[x×,]\s*(\d*\.?\d+)$/i);
    if (!m) return null;
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (w > 0 && h > 0) return [w, h];
  }
  return null;
}

function readJitter(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function readDensity(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

function take<T>(primary: Record<string, unknown> | null, fallback: Record<string, unknown> | null, key: string, read: (v: unknown) => T | null): { value: T | null; from: 'object' | 'material' | null } {
  if (primary && Object.prototype.hasOwnProperty.call(primary, key)) {
    const value = read(primary[key]);
    if (value != null) return { value, from: 'object' };
  }
  if (fallback && Object.prototype.hasOwnProperty.call(fallback, key)) {
    const value = read(fallback[key]);
    if (value != null) return { value, from: 'material' };
  }
  return { value: null, from: null };
}

function blobOf(part?: string | null, name?: string | null): string {
  return `${part ?? ''} ${name ?? ''}`.toLowerCase();
}

export function inferPaletteId(paintClass: PaintClass, part?: string | null, name?: string | null): string {
  const blob = blobOf(part, name);
  if (/hair|brow|sideburn/.test(blob)) return 'kai_hair';
  if (/chicken|feather/.test(blob)) return 'chicken_feather';
  if (/leaf|canopy|foliage|frond/.test(blob)) return 'foliage';
  if (/spear|sword|scimitar|blade|buckler|dagger/.test(blob)) return 'bronze';
  if (/boot|bracer|belt|leather/.test(blob)) return 'leather';
  if (/trunk|bark|log|timber|plank|wood/.test(blob)) return paintClass === 'tree' ? 'pine_bark' : 'timber';
  if (/rock|stone|castle|wall|cobble|tower/.test(blob)) return 'castle_stone';
  if (paintClass === 'hero' || paintClass === 'boss') {
    if (/head|face|ear|nose|mouth|neck|skin|hand|finger/.test(blob)) return 'kai_skin';
    return 'kai_tunic';
  }
  if (paintClass === 'monster') return 'goblin_hide';
  if (paintClass === 'gear') return 'bronze';
  if (paintClass === 'tree') return 'pine_bark';
  if (paintClass === 'prop') return 'varrock_stone';
  return 'meadow_grass';
}

export function inferStroke(paintClass: PaintClass, part?: string | null, name?: string | null): StrokeDir {
  const blob = blobOf(part, name);
  if (/ground|floor|path|cobble|flagstone|tile/.test(blob)) return 'flat';
  if (/wall|hedge|fence|merlon|tower|pillar|keep|battlement/.test(blob)) return 'up';
  if (/leaf|canopy|foliage|crown|frond|tier/.test(blob)) return 'surface_flow';
  if (paintClass === 'tree') return 'up';
  if (paintClass === 'prop') return 'flat';
  if (paintClass === 'monster' || paintClass === 'boss') return 'surface_flow';
  return 'along_bone';
}

function lengthOf(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function normalise(v: Vec3): Vec3 {
  const l = lengthOf(v);
  if (l < 1e-8) return { x: 0, y: 1, z: 0 };
  return scale(v, 1 / l);
}

/**
 * Stroke direction in the mesh's local space. `up` and `along_bone` run with local Y
 * (a trunk, or a limb whose pivot carries the bone). `surface_flow` lies on the
 * surface along that axis. `flat` is an in-plane stroke; the dab also lies down.
 */
export function strokeDirection(mode: StrokeDir, normal: Vec3): Vec3 {
  if (mode === 'up' || mode === 'along_bone') return { x: 0, y: 1, z: 0 };
  const n = normalise(normal);
  const up = { x: 0, y: 1, z: 0 };
  const axis = mode === 'flat' && Math.abs(n.y) > 0.85 ? { x: 1, y: 0, z: 0 } : up;
  const along = n.x * axis.x + n.y * axis.y + n.z * axis.z;
  const tangent = {
    x: axis.x - n.x * along,
    y: axis.y - n.y * along,
    z: axis.z - n.z * along
  };
  if (lengthOf(tangent) < 1e-6) return { x: 1, y: 0, z: 0 };
  return normalise(tangent);
}

export function resolvePaint(input: ResolvePaintInput): ResolvedPaint {
  const paintClass = input.paintClass ?? 'prop';
  const objectUd = asRecord(input.objectUserData);
  const materialUd = asRecord(input.materialUserData);
  const palettePick = take(objectUd, materialUd, 'paint_palette', (v) => (typeof v === 'string' && PALETTE_BY_ID[v] ? v : null));
  const paletteId = palettePick.value ?? inferPaletteId(paintClass, input.part, input.name);
  const palette = PALETTE_BY_ID[paletteId] ?? PALETTE_BY_ID.meadow_grass;
  const strokePick = take(objectUd, materialUd, 'stroke_dir', readStroke);
  const stroke = strokePick.value ?? inferStroke(paintClass, input.part, input.name);
  const sizePick = take(objectUd, materialUd, 'dab_size', readSize);
  const size = sizePick.value ?? [DAB_SIZE_BY_CLASS[paintClass][0], DAB_SIZE_BY_CLASS[paintClass][1]];
  const jitterPick = take(objectUd, materialUd, 'jitter', readJitter);
  const jitter = jitterPick.value ?? (palette.metal ? METAL_JITTER : DEFAULT_JITTER);
  const densityPick = take(objectUd, materialUd, 'dab_density', readDensity);
  const source = palettePick.from ?? 'default';
  return {
    paletteId: palette.id,
    palette,
    stroke,
    size,
    jitter,
    density: densityPick.value,
    source
  };
}

const SKIP_PARTS = new Set(['eye', 'pupil', 'eye-white', 'eyes']);

/** Outlines, colliders, and eyes stay out of the pins. Eyes are too small to be a dab. */
export function shouldPaintMesh(userData: Record<string, unknown> | null | undefined, name = ''): boolean {
  const ud = userData ?? {};
  if (ud.isOutline || ud.isCollider || ud.noPaint) return false;
  const part = String(ud.part ?? '').toLowerCase();
  if (SKIP_PARTS.has(part)) return false;
  const n = name.toLowerCase();
  if (n === 'eyes' || n.startsWith('pupil') || n.startsWith('eye')) return false;
  return true;
}

export interface PaintFlags {
  legacy: boolean;
  low: boolean;
}

/** `?renderer=legacy` keeps the old picture. `?quality=low` drops the sun in the mist. */
export function readPaintFlags(search: string): PaintFlags {
  const q = new URLSearchParams(search.replace(/^\?/, ''));
  return {
    legacy: q.get('renderer') === 'legacy',
    low: q.get('quality') === 'low'
  };
}
