import * as THREE from 'three';
import {
  G,
  player,
  camState,
  _tmpScratchVec,
  type MonsterEntity,
  type ResourceNodeEntity,
  type NpcLabel
} from './context';
import { WORLD_REGIONS, type RegionDef } from '../data/world';
import { PRAYERS } from '../data/magic';
import { STATE } from '../state/gameState';
import { getTerrainHeight } from '../state/terrain';
import { riverCenterX } from '../state/collision';
import { monsterThreatColor } from '../state/adventure';
import { inCombat, isDown } from '../state/monsterAi';
import { getPrayerSvg } from '../ui/icons';
import { el, getCombatLevel } from '../ui/hud';

// ============================================================================
// 11. ROTATING MINIMAP & FLOATING LABELS
// ============================================================================
export function renderMinimap(): void {
  const canvas = el<HTMLCanvasElement>('minimap-canvas');
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const scale = 1.75;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(camState.yaw - Math.PI);

  WORLD_REGIONS.forEach((reg: RegionDef) => {
    const rx = (reg.x - player.pos.x) * scale;
    const rz = (reg.z - player.pos.z) * scale;
    ctx.beginPath();
    ctx.arc(rx, rz, reg.radius * scale * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = reg.color + '28';
    ctx.fill();
    ctx.strokeStyle = reg.color + '88';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // River Strip
  ctx.strokeStyle = '#223842';
  ctx.lineWidth = 14;
  ctx.beginPath();
  for (let z = -110; z <= 110; z += 10) {
    const wx = riverCenterX(z);
    const px = (wx - player.pos.x) * scale;
    const pz = (z - player.pos.z) * scale;
    if (z === -110) ctx.moveTo(px, pz);
    else ctx.lineTo(px, pz);
  }
  ctx.stroke();

  // Resource Nodes (Muted Slate / Iron)
  G.resourceNodesList.forEach((r: ResourceNodeEntity) => {
    if (r.depleted) return;
    const px = (r.pos.x - player.pos.x) * scale;
    const pz = (r.pos.z - player.pos.z) * scale;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(px - 2, pz - 2, 4, 4);
  });

  // NPCs, Altars & Forges (Nordic Muted Brass)
  G.npcList.forEach((n: NpcLabel) => {
    const px = (n.pos.x - player.pos.x) * scale;
    const pz = (n.pos.z - player.pos.z) * scale;
    ctx.beginPath();
    ctx.arc(px, pz, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#c5a059';
    ctx.fill();
  });

  // Live Monsters (Nordic Blood Crimson)
  G.monstersList.forEach((m: MonsterEntity) => {
    if (isDown(m.logic)) return;
    const px = (m.pos.x - player.pos.x) * scale;
    const pz = (m.pos.z - player.pos.z) * scale;
    ctx.beginPath();
    ctx.arc(px, pz, m.typeKey === 'elvarg_dragon' ? 5.5 : 3.2, 0, Math.PI * 2);
    ctx.fillStyle = m.typeKey === 'elvarg_dragon' ? '#b91c1c' : '#881337';
    ctx.fill();
  });

  ctx.restore();

  // Player Center Dot
  ctx.beginPath();
  ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function worldToScreenPos(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
  _tmpScratchVec.set(x, y, z).project(G.camera);
  return {
    x: (_tmpScratchVec.x * 0.5 + 0.5) * window.innerWidth,
    y: (-(_tmpScratchVec.y * 0.5) + 0.5) * window.innerHeight,
    visible: _tmpScratchVec.z < 1.0
  };
}

export function worldToScreen(vec3: THREE.Vector3): { x: number; y: number; visible: boolean } {
  return worldToScreenPos(vec3.x, vec3.y, vec3.z);
}

export interface LandmarkDef {
  name: string;
  x: number;
  z: number;
  y: number;
  color: string;
}

export const LANDMARKS: LandmarkDef[] = [
  { name: 'Lumbridge Castle', x: 0, z: -25, y: 12.4, color: '#bfdbfe' },
  { name: 'Varrock Grand Plaza', x: 78, z: -20, y: 6.2, color: '#fde047' },
  { name: 'Al-Kharid Arch', x: 80, z: 82, y: 6.4, color: '#fdba74' },
  { name: 'Korok Lantern Grove', x: -72, z: -38, y: 4.2, color: '#86efac' },
  { name: "Dragon's Peak Spire", x: -58, z: 62, y: 8.2, color: '#fca5a5' }
];

let landmarkEls: HTMLElement[] | null = null;
let playerOverheadEl: HTMLElement | null = null;

export function updateLandmarkLabels(): void {
  const host = el('world-labels');
  if (!landmarkEls) {
    landmarkEls = LANDMARKS.map((mark) => {
      const markEl = document.createElement('div');
      markEl.className = 'landmark-label';
      markEl.innerHTML = `<div class="landmark-name" style="color:${mark.color}">${mark.name}</div>`;
      host.appendChild(markEl);
      return markEl;
    });
  }
  const els = landmarkEls;
  LANDMARKS.forEach((mark, index) => {
    const markEl = els[index];
    const dist = Math.hypot(player.pos.x - mark.x, player.pos.z - mark.z);
    if (dist > 78) {
      markEl.style.display = 'none';
      return;
    }
    const my = getTerrainHeight(mark.x, mark.z) + mark.y;
    const sp = worldToScreenPos(mark.x, my, mark.z);
    if (!sp.visible) {
      markEl.style.display = 'none';
      return;
    }
    markEl.style.display = 'flex';
    markEl.style.left = sp.x + 'px';
    markEl.style.top = sp.y + 'px';
    markEl.style.opacity = dist < 16 ? '1' : String(Math.max(0.55, 1 - (dist - 16) / 80));
  });
}

export function updateFloatingWorldLabels(): void {
  const playerCombatLvl = getCombatLevel();
  updateLandmarkLabels();

  // Player Overhead Prayer SVG Badge
  if (!playerOverheadEl) {
    playerOverheadEl = document.createElement('div');
    playerOverheadEl.className = 'entity-label';
    el('world-labels').appendChild(playerOverheadEl);
  }
  const overheadEl = playerOverheadEl;
  let overheadPrayerId: string | null = null;
  PRAYERS.forEach((p) => {
    if (p.overhead && STATE.activePrayers.has(p.id)) overheadPrayerId = p.id;
  });
  if (overheadPrayerId) {
    const sp = worldToScreenPos(player.pos.x, player.pos.y + 2.8, player.pos.z);
    if (sp.visible) {
      overheadEl.style.display = 'flex';
      overheadEl.style.left = sp.x + 'px';
      overheadEl.style.top = sp.y + 'px';
      if (overheadEl.dataset.prayer !== overheadPrayerId) {
        overheadEl.dataset.prayer = overheadPrayerId;
        overheadEl.innerHTML = `<div class="overhead-prayer-badge overhead-${overheadPrayerId}">${getPrayerSvg(overheadPrayerId)}</div>`;
      }
    } else {
      overheadEl.style.display = 'none';
    }
  } else {
    overheadEl.style.display = 'none';
  }

  // Monster names appear only while hovered or while they are the combat target.
  G.monstersList.forEach((m: MonsterEntity) => {
    const aimed = player.targetEntity && player.targetEntity.type === 'monster' && player.targetEntity.ref === m;
    const hovered = G.hoveredWorld && G.hoveredWorld.type === 'monster' && G.hoveredWorld.entity === m;
    if (isDown(m.logic) || (!aimed && !hovered && !inCombat(m.logic))) {
      m.labelEl.style.display = 'none';
      return;
    }
    const dist = player.pos.distanceTo(m.pos);
    if (dist > 34) {
      m.labelEl.style.display = 'none';
      return;
    }
    const topY = m.typeKey === 'elvarg_dragon' ? 4.6 : (2.4 * (m.def.scale || 1));
    const sp = worldToScreenPos(m.pos.x, m.pos.y + topY, m.pos.z);
    if (!sp.visible) {
      m.labelEl.style.display = 'none';
      return;
    }
    m.labelEl.style.display = 'flex';
    m.labelEl.style.left = sp.x + 'px';
    m.labelEl.style.top = sp.y + 'px';

    const tone = monsterThreatColor(m.def.level, playerCombatLvl);
    const col = tone === 'green' ? '#4ade80' : tone === 'red' ? '#f87171' : '#ffe642';

    const txtDiv = m.labelEl.querySelector<HTMLElement>('.label-text');
    if (txtDiv) txtDiv.style.color = col;

    const hpBar = m.labelEl.querySelector<HTMLElement>('.entity-hp-bar')!;
    const hpFill = m.labelEl.querySelector<HTMLElement>('.entity-hp-fill')!;
    if (m.logic.hp < m.logic.maxHp || inCombat(m.logic)) {
      hpBar.style.display = 'block';
      hpFill.style.width = Math.max(0, (m.logic.hp / m.logic.maxHp) * 100) + '%';
    } else {
      hpBar.style.display = 'none';
    }
  });

  // NPCs, Altars & Forges Floating Labels
  G.npcList.forEach((n: NpcLabel) => {
    if (!n.el) {
      n.el = document.createElement('div');
      n.el.className = 'entity-label';
      n.el.style.color = n.color || '#fde047';
      n.el.innerHTML = `<div class="label-text">${n.name}</div>`;
      el('world-labels').appendChild(n.el);
    }
    const hovered = G.hoveredWorld && G.hoveredWorld.type === 'interactive' && G.hoveredWorld.name === n.name;
    const aimed = player.targetEntity && player.targetEntity.type === 'interactive' && player.targetEntity.ref && player.targetEntity.ref.name === n.name;
    if (!hovered && !aimed) {
      n.el.style.display = 'none';
      return;
    }
    const dist = player.pos.distanceTo(n.pos);
    if (dist > 32) {
      n.el.style.display = 'none';
      return;
    }
    const sp = worldToScreenPos(n.pos.x, n.pos.y + (n.yOffset || 2.8), n.pos.z);
    if (!sp.visible) {
      n.el.style.display = 'none';
      return;
    }
    n.el.style.display = 'flex';
    n.el.style.left = sp.x + 'px';
    n.el.style.top = sp.y + 'px';
  });
}
