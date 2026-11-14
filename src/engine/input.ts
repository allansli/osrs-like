import * as THREE from 'three';
import { G, player, camState, type MonsterEntity, type ResourceNodeEntity } from './context';
import { noteCheatKey } from './session';
import { SFX } from './audio';
import { toggleSpecialAttack, closeModals, hideHoverTooltip } from '../ui/playerActions';
import { switchTab, addChatMessage, updateTargetHud, getCombatLevel, el } from '../ui/hud';
import { isWalkable } from '../state/collision';
import { getTerrainHeight } from '../state/terrain';
import { isDown } from '../state/monsterAi';
import { SKILLS_META } from '../data/skills';
import {
  attackOptionLabel,
  gatherVerb,
  monsterThreatColor
} from '../state/adventure';

export interface ChooseMenuOption {
  label: string;
  tone?: string;
  run: () => void;
}

export interface PickResult {
  entityHit: THREE.Intersection | undefined;
  ground: THREE.Intersection | null;
}

export function setupInputHandlers(): void {
  G.clickMarkerMesh = new THREE.Group();
  G.clickMarkerMesh.userData.life = 0;
  const crossMat = () => new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0, depthWrite: false });
  const armA = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.07), crossMat());
  armA.rotation.y = Math.PI / 4;
  const armB = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.07), crossMat());
  armB.rotation.y = -Math.PI / 4;
  G.clickMarkerMesh.add(armA, armB);
  G.scene.add(G.clickMarkerMesh);
  G.hoverTile = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
  );
  G.hoverTile.rotation.x = -Math.PI / 2;
  G.hoverTile.visible = false;
  G.scene.add(G.hoverTile);

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      closeModals();
    }
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) {
      return;
    }
    G.keysPressed[e.code] = true;
    noteCheatKey(e);
    if (e.code === 'Space' && player.isGrounded && !player.downed) {
      player.jumpVel = 7.8;
      player.isGrounded = false;
      SFX.jump();
    }
    if (e.code === 'KeyF') {
      toggleSpecialAttack();
    }
    const tabByKey: Record<string, string> = { F1: 'combat', F2: 'skills', F3: 'inventory', F4: 'equipment', F5: 'prayer', F6: 'magic' };
    if (tabByKey[e.code]) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        switchTab(tabByKey[e.code]);
      }
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    G.keysPressed[e.code] = false;
  });

  document.addEventListener('mousedown', (e: MouseEvent) => {
    const menu = el('context-menu');
    if (!menu.classList.contains('open')) return;
    if (e.target && menu.contains(e.target as Node)) return;
    hideContextMenu();
  });

  const canvas = G.renderer.domElement;
  canvas.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
  const canvasHost = el('game-canvas-container');
  canvasHost.addEventListener('contextmenu', onGameContextMenu);

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button === 2 || e.button === 1) {
      camState.isDragging = true;
      camState.lastMouseX = e.clientX;
      camState.lastMouseY = e.clientY;
      G.rightPress.x = e.clientX;
      G.rightPress.y = e.clientY;
      G.rightPress.dist = 0;
      return;
    }
    if (e.button === 0) {
      hideContextMenu();
      if (!player.downed) handleWorldClick(e);
    }
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (camState.isDragging) {
      const dx = e.clientX - camState.lastMouseX;
      const dy = e.clientY - camState.lastMouseY;
      camState.lastMouseX = e.clientX;
      camState.lastMouseY = e.clientY;
      G.rightPress.dist += Math.hypot(dx, dy);
      camState.manualOffset -= dx * 0.007;
      camState.pitch = Math.max(0.12, Math.min(1.15, camState.pitch + dy * 0.005));
    } else {
      handleWorldHover(e);
    }
  });

  window.addEventListener('mouseup', () => {
    camState.isDragging = false;
  });

  canvas.addEventListener('wheel', (e: WheelEvent) => {
    camState.distance = Math.max(3.6, Math.min(26, camState.distance + e.deltaY * 0.01));
  }, { passive: true });

  const mmCanvas = el<HTMLCanvasElement>('minimap-canvas');
  mmCanvas.addEventListener('click', (e: MouseEvent) => {
    const rect = mmCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const scale = 0.55;
    const sin = Math.sin(camState.yaw);
    const cos = Math.cos(camState.yaw);
    const wx = player.pos.x - (cx * cos - cy * sin) * scale;
    const wz = player.pos.z - (cx * sin + cy * cos) * scale;
    if (!isWalkable(wx, wz)) {
      addChatMessage('You cannot walk there.', 'combat');
      return;
    }
    player.targetEntity = null;
    player.targetPos = new THREE.Vector3(wx, getTerrainHeight(wx, wz), wz);
    showClickMarker(player.targetPos.x, player.targetPos.z, 0xfde047);
  });
}

export function resetCameraBehindPlayer(): void {
  camState.manualOffset = 0;
  camState.pitch = 0.24;
  camState.distance = 8.5;
}

export function showClickMarker(x: number, z: number, hexColor: number): void {
  if (!G.clickMarkerMesh) return;
  G.clickMarkerMesh.position.set(x, getTerrainHeight(x, z) + 0.16, z);
  G.clickMarkerMesh.userData.life = 1;
  G.clickMarkerMesh.scale.set(1, 1, 1);
  G.clickMarkerMesh.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.material && (mesh.material as THREE.MeshBasicMaterial).color) {
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(hexColor);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    }
  });
}

export function handleWorldHover(e: MouseEvent): void {
  const onCanvas = !!(e.target && (e.target as HTMLElement).id === 'game-canvas');
  const modalOpen = !!document.querySelector('.modal-backdrop.open');
  if (!onCanvas || modalOpen) {
    G.hoveredWorld = null;
    hideHoverTooltip();
    if (G.hoverTile) G.hoverTile.visible = false;
    return;
  }
  updateHoverTile(e);
  const tooltip = el('hover-tooltip');
  G.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);
  const hits = G.raycaster.intersectObjects(G.worldInteractiveObjects, false);
  if (hits.length > 0) {
    const ud = hits[0].object.userData;
    if (ud && ud.type !== 'ground') {
      let label = '';
      if (ud.type === 'monster' && !isDown(ud.entity.logic)) {
        const m = ud.entity as MonsterEntity;
        label = `Attack <b style="color:#ff981f">${m.def.name}</b> (Lv-${m.def.level}) [${m.logic.hp}/${m.logic.maxHp} HP]`;
      } else if (ud.type === 'resource' && !ud.entity.depleted) {
        const r = ud.entity as ResourceNodeEntity;
        label = `Gather <b style="color:#38bdf8">${r.def.name}</b> (Req Lv ${r.def.req} ${(SKILLS_META as Record<string, { name: string }>)[r.def.skill!].name})`;
      } else if (ud.type === 'interactive') {
        label = `Interact with <b style="color:#fde047">${ud.name}</b>`;
      }
      if (label) {
        G.hoveredWorld = ud;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY + 14) + 'px';
        tooltip.innerHTML = label;
        document.body.style.cursor = 'pointer';
        return;
      }
    }
  }
  G.hoveredWorld = null;
  tooltip.style.display = 'none';
  document.body.style.cursor = 'default';
}

export function hideContextMenu(): void {
  const menu = el('context-menu');
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
}

export function pointerToWorld(clientX: number, clientY: number): PickResult {
  G.mouseVec.x = (clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);
  const hits = G.raycaster.intersectObjects(G.worldInteractiveObjects, false);
  const entityHit = hits.find((hit) => hit.object.userData && hit.object.userData.type && hit.object.userData.type !== 'ground');
  const groundHits = G.terrainMesh ? G.raycaster.intersectObject(G.terrainMesh, false) : [];
  return { entityHit, ground: groundHits[0] || null };
}

export function onGameContextMenu(e: MouseEvent): void {
  e.preventDefault();
  if (G.rightPress.dist > 6) return;
  if (document.querySelector('.modal-backdrop.open')) return;
  const picked = pointerToWorld(e.clientX, e.clientY);
  const options: ChooseMenuOption[] = [];
  const ud = picked.entityHit ? picked.entityHit.object.userData : null;

  if (ud && ud.type === 'monster' && ud.entity && !isDown(ud.entity.logic)) {
    const tone = monsterThreatColor(ud.entity.def.level, getCombatLevel());
    options.push({
      label: attackOptionLabel(ud.entity.def.name, ud.entity.def.level),
      tone,
      run: () => {
        player.targetEntity = { type: 'monster', ref: ud.entity };
        player.targetPos = null;
        showClickMarker(ud.entity.pos.x, ud.entity.pos.z, 0xef4444);
        updateTargetHud();
      }
    });
  } else if (ud && ud.type === 'resource' && ud.entity && !ud.entity.depleted) {
    options.push({
      label: gatherVerb(ud.entity.def.kind, ud.entity.def.item),
      run: () => {
        player.targetEntity = { type: 'resource', ref: ud.entity };
        player.targetPos = null;
        showClickMarker(ud.entity.pos.x, ud.entity.pos.z, 0x38bdf8);
        updateTargetHud();
      }
    });
  } else if (ud && ud.type === 'interactive') {
    let label = `Use ${ud.name}`;
    if (ud.action === 'slayer') label = 'Talk-to Slayer Master Vannaka';
    else if (ud.action === 'bank') label = 'Bank';
    else if (ud.action === 'shop') label = 'Trade';
    else if (ud.action === 'dialogue') label = `Talk-to ${ud.name}`;
    const anchor = picked.entityHit!.object.getWorldPosition(new THREE.Vector3());
    options.push({
      label,
      run: () => {
        player.targetEntity = { type: 'interactive', ref: ud, pos: anchor };
        player.targetPos = null;
        showClickMarker(anchor.x, anchor.z, 0xfde047);
      }
    });
  }

  options.push({
    label: 'Examine',
    run: () => {
      if (ud && ud.type === 'monster' && ud.entity) addChatMessage(`It's a level ${ud.entity.def.level} ${ud.entity.def.name}.`, 'skill');
      else if (ud && ud.type === 'resource' && ud.entity) addChatMessage(`It's a ${ud.entity.def.name}.`, 'skill');
      else if (ud && ud.type === 'interactive') addChatMessage(`It's ${ud.name}.`, 'skill');
      else addChatMessage("It's the ground.", 'skill');
    }
  });
  if (picked.ground) {
    const pt = picked.ground.point;
    options.push({
      label: 'Walk here',
      run: () => {
        if (!isWalkable(pt.x, pt.z)) {
          addChatMessage('You cannot walk there.', 'combat');
          return;
        }
        player.targetEntity = null;
        player.targetPos = new THREE.Vector3(pt.x, getTerrainHeight(pt.x, pt.z), pt.z);
        showClickMarker(pt.x, pt.z, 0xfde047);
        updateTargetHud();
      }
    });
  }
  options.push({ label: 'Cancel', run: () => {} });
  openChooseMenu(e.clientX, e.clientY, options);
}

export function openChooseMenu(clientX: number, clientY: number, options: ChooseMenuOption[]): void {
  const menu = el('context-menu');
  const list = el('context-menu-list');
  list.innerHTML = '';
  options.forEach((opt) => {
    const row = document.createElement('div');
    row.className = 'osrs-menu-item' + (opt.tone ? ` threat-${opt.tone}` : '');
    row.setAttribute('role', 'menuitem');
    row.textContent = opt.label;
    row.addEventListener('click', (ev: MouseEvent) => {
      ev.stopPropagation();
      hideContextMenu();
      opt.run();
    });
    list.appendChild(row);
  });
  const left = Math.min(window.innerWidth - 280, clientX);
  const top = Math.min(window.innerHeight - (options.length * 24 + 36), clientY);
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top = Math.max(8, top) + 'px';
  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');
}

export function handleWorldClick(e: MouseEvent): void {
  G.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);

  const hits = G.raycaster.intersectObjects(G.worldInteractiveObjects, false);
  if (hits.length === 0) return;

  const chosen = hits.find(h => h.object.userData && h.object.userData.type !== 'ground') || hits[0];
  const ud = chosen.object.userData;

  if (!ud || ud.type === 'ground') {
    const pt = chosen.point;
    if (!isWalkable(pt.x, pt.z)) {
      addChatMessage('You cannot walk there.', 'combat');
      return;
    }
    player.targetEntity = null;
    player.targetPos = new THREE.Vector3(pt.x, getTerrainHeight(pt.x, pt.z), pt.z);
    showClickMarker(pt.x, pt.z, 0xfde047);
    updateTargetHud();
    return;
  }

  if (ud.type === 'monster') {
    if (isDown(ud.entity.logic)) return;
    player.targetEntity = { type: 'monster', ref: ud.entity };
    player.targetPos = null;
    showClickMarker(ud.entity.pos.x, ud.entity.pos.z, 0xef4444);
    updateTargetHud();
  } else if (ud.type === 'resource') {
    if (ud.entity.depleted) {
      addChatMessage(`This ${ud.entity.def.name} is depleted. Wait a moment for it to replenish.`);
      return;
    }
    player.targetEntity = { type: 'resource', ref: ud.entity };
    player.targetPos = null;
    showClickMarker(ud.entity.pos.x, ud.entity.pos.z, 0xef4444);
    updateTargetHud();
  } else if (ud.type === 'interactive') {
    player.targetEntity = { type: 'interactive', ref: ud, pos: chosen.object.getWorldPosition(new THREE.Vector3()) };
    player.targetPos = null;
    showClickMarker(player.targetEntity.pos!.x, player.targetEntity.pos!.z, 0xef4444);
  }
}

export function updateHoverTile(e: MouseEvent): void {
  if (!G.hoverTile || !G.terrainMesh || !G.camera) return;
  G.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);
  const hits = G.raycaster.intersectObject(G.terrainMesh, false);
  if (!hits.length) {
    G.hoverTile.visible = false;
    return;
  }
  const p = hits[0].point;
  const gx = Math.floor(p.x) + 0.5;
  const gz = Math.floor(p.z) + 0.5;
  G.hoverTile.visible = true;
  G.hoverTile.position.set(gx, getTerrainHeight(gx, gz) + 0.08, gz);
}
