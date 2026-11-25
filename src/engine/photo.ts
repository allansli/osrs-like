import { WORLD_REGIONS } from '../data/world';
import { PATHS, POIS } from '../data/worldMap';
import { STATE } from '../state/gameState';
import { getTerrainHeight } from '../state/terrain';
import { el } from '../ui/hud';
import { loadBlenderWorldTemplate } from './blenderWorld';
import { camState, G, player } from './context';
import { applyQualityTier, type QualityTier } from './renderer';
import { cycleTimeOfDay } from './worldMesh';
import { setPhase } from './lighting';
import { setWeatherOverride } from './particles';

export let playerChoseTier = false;

export function setPlayerChoseTier(val = true): void {
  playerChoseTier = val;
}

export interface LookHooks {
  ready(): boolean;
  pose(row: { place: string; yaw: number; pitch: number; distance: number }): void;
  phase(p: number): void;
  preset(n: 0 | 1 | 2): void;
  hud(on: boolean): void;
  tier(id: QualityTier): void;
  bench(frames: number): number;
  weather(id: string): void;
}

const HUD_ROOT_IDS = [
  'top-left-hud',
  'minimap-wrapper',
  'right-panel',
  'chatbox',
  'world-labels',
  'xp-drops-container',
  'region-banner',
  'levelup-banner',
  'hover-tooltip',
  'context-menu',
  'item-tooltip',
  'low-health-vignette'
];

let worldGlbSettled = false;
let glbHooked = false;

function ensureGlbTracking(): void {
  if (glbHooked) return;
  glbHooked = true;
  loadBlenderWorldTemplate()
    .then(() => {
      worldGlbSettled = true;
    })
    .catch(() => {
      worldGlbSettled = true;
    });
}

export function createLookHooks(): LookHooks {
  return {
    ready(): boolean {
      ensureGlbTracking();
      return worldGlbSettled;
    },

    pose(row: { place: string; yaw: number; pitch: number; distance: number }): void {
      let targetX: number | undefined;
      let targetZ: number | undefined;

      const poi = POIS.find((p) => p.id === row.place);
      if (poi) {
        targetX = poi.x;
        targetZ = poi.z;
      } else {
        const reg = WORLD_REGIONS.find((r) => r.id === row.place);
        if (reg) {
          targetX = reg.x;
          targetZ = reg.z;
        } else {
          const path = PATHS.find((p) => p.id === row.place);
          if (path) {
            if (path.id === 'millrace_road') {
              targetX = 18;
              targetZ = 0;
            }
          }
        }
      }

      if (targetX === undefined || targetZ === undefined) {
        throw new Error(`Unknown place: ${row.place}`);
      }

      const targetY = getTerrainHeight(targetX, targetZ);
      player.pos.set(targetX, targetY, targetZ);
      player.waypoints.length = 0;

      camState.yaw = row.yaw;
      camState.manualOffset = row.yaw - player.yaw;
      camState.pitch = Math.max(0.12, Math.min(1.15, row.pitch));
      camState.distance = Math.max(3.6, Math.min(26, row.distance));
    },

    phase(p: number): void {
      setPhase(p, true);
    },

    preset(n: 0 | 1 | 2): void {
      while (STATE.timeOfDay !== n) {
        cycleTimeOfDay();
      }
    },

    hud(on: boolean): void {
      for (const id of HUD_ROOT_IDS) {
        el(id).style.display = on ? '' : 'none';
      }
    },

    tier(id: QualityTier): void {
      playerChoseTier = true;
      applyQualityTier(id);
    },

    bench(frames: number): number {
      const count = Math.max(1, Math.min(600, Math.floor(frames)));
      const t0 = performance.now();
      for (let i = 0; i < count; i++) {
        G.renderer.render(G.scene, G.camera);
      }
      const gl = G.renderer.getContext();
      gl.finish();
      const elapsed = performance.now() - t0;
      return elapsed / count;
    },

    weather(id: string): void {
      setWeatherOverride(id);
    }
  };
}
