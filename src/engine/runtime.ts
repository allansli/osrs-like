// @ts-nocheck
import * as THREE from 'three';
import { TICK_SEC, player, camState, _tmpScratchVec, _camTargetVec, _lookTargetVec, telemetryInfo, G } from './context';
import { SFX } from './audio';
import {
  spawnBurst,
  spawnExpandingRing,
  spawnLevelUpFireworks
} from './vfx';
import { poseMonsterLimbs } from './monsterMeshes';
import { buildPlayerCharacter, rebuildPlayerEquipmentMeshes, syncWhipGeometry } from './playerMesh';
import {
  buildSkyDomeShader,
  cycleTimeOfDay,
  buildTerrainAndWater,
  buildRiverBridge,
  getBiomeColor
} from './worldMesh';
import { buildAllCitiesAndLandmarks } from './worldBuild';
import { spawnAllResourcesAndMonsters } from './spawns';
import {
  renderMinimap,
  updateFloatingWorldLabels,
  worldToScreen
} from './overlay';
export { worldToScreen };
import {
  saveGameState,
  loadGameState,
  manualSaveToast,
  resetGameSave,
  noteCheatKey,
  cheatSkillsPlus10,
  cheatGold200k,
  applyTypedCheat,
  dismissOnboarding,
  replayOnboarding,
  maybeShowOnboarding
} from './session';
import {
  teleportToRegion,
  checkRegionChange,
  triggerRegionBanner,
  performPlayerAttack,
  performMonsterRetaliation,
  finishRespawn,
  performResourceGather
} from './actions';
import { ITEMS, TIER_COLORS, isStackableInBackpack } from '../data/items';
import { SKILLS_META, OSRS_XP_TABLE } from '../data/skills';
import { PRAYERS, SPELLS } from '../data/magic';
import { tryCraft } from '../data/recipes';
import { WORLD_REGIONS } from '../data/world';
import { STATE } from '../state/gameState';
import { getEquipmentBonuses } from '../state/combat';
import {
  attackOptionLabel,
  gatherVerb,
  monsterThreatColor
} from '../state/adventure';
import { moveWithCollision, isWalkable, isDeepWater } from '../state/collision';
import { getTerrainHeight } from '../state/terrain';
import { discoverShrines } from '../state/shrines';
import { addCartoonOutline, facetMaterial, grassMaterial, PALETTE } from './materials';
import {
  albedoForItem,
  applyAlbedo,
  assignGroundUvs,
  BIOME_COLORS,
  biomeAlbedoId,
  sealAlbedoUvs,
  speciesAlbedo,
  terrainMaterial
} from './textures';
import { loadBlenderGearTemplate } from './blenderGear';
import { hexToCss } from '../ui/icons';
import { bridge } from '../ui/bridge';
import {
  renderWorldMap,
  syncSettingsButtons
} from '../ui/stations';
import {
  initStaticSvgIcons,
  addChatMessage,
  getCombatLevel,
  getItemReqInfo,
  showBanner,
  switchTab,
  updateAllUI,
  updateTargetHud,
  applyLoadedStateToHud,
  refreshCombatStyleLocks,
  showItemTooltip,
  moveItemTooltip,
  hideItemTooltip
} from '../ui/hud';
import {
  sellInventoryItem,
  showSellChooseMenu,
  handleInventoryClick,
  unequipSlot,
  setCombatStyle,
  toggleSpecialAttack,
  togglePrayer,
  handleSpellClick,
  toggleXpMultiplier,
  closeModals,
  hideHoverTooltip,
  openModal,
  openShopModal,
  renderShopModal,
  buyShopItem,
  buyShopPair,
  sellAllLoot,
  sellAllUnequippedGear,
  openSmithingModal,
  renderSmithingModal,
  craftRecipe,
  openXpTableModal,
  openWorldMapModal,
  locateQuestRegion,
  claimQuestReward,
  requestSlayerTask,
  openBankModal,
  openQuestsModal,
  openSettingsModal,
  toggleAudio
} from '../ui/playerActions';


// ============================================================================
// 7. 2026 SMOOTH 3D ENGINE, GLSL SKY & WATER SHADERS, PROCEDURAL TEXTURES
// ============================================================================





type QualityTier = 'performance' | 'balanced' | 'high' | 'ultra';
let currentQuality: QualityTier = 'balanced';
let outlinesEnabled = true;

function getQualityDpr(tier: QualityTier): number {
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  switch (tier) {
    case 'performance': return 1.0;
    case 'balanced': return Math.min(dpr, 1.25);
    case 'high': return Math.min(dpr, 1.5);
    case 'ultra': return Math.min(dpr, 2.0);
  }
}

function applyQualityTier(tier: QualityTier): void {
  currentQuality = tier;
  const dpr = getQualityDpr(tier);
  if (G.renderer && typeof window !== 'undefined') {
    G.renderer.setPixelRatio(dpr);
    G.renderer.setSize(window.innerWidth, window.innerHeight);
    if (tier === 'performance') {
      G.renderer.shadowMap.enabled = false;
    } else {
      G.renderer.shadowMap.enabled = true;
      G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (G.sunLight) {
        G.sunLight.castShadow = true;
        const res = tier === 'ultra' ? 2048 : (tier === 'high' ? 2048 : 1024);
        G.sunLight.shadow.mapSize.set(res, res);
      }
    }
  }
  const dprEl = document.getElementById('perf-dpr');
  if (dprEl) dprEl.textContent = `${dpr.toFixed(2)}x DPR`;
  syncGraphicsButtons();
}

function cycleGraphicsQuality(): void {
  const tiers: QualityTier[] = ['performance', 'balanced', 'high', 'ultra'];
  const nextIdx = (tiers.indexOf(currentQuality) + 1) % tiers.length;
  applyQualityTier(tiers[nextIdx]);
  addChatMessage(`Graphics Quality set to <b>${tiers[nextIdx].toUpperCase()}</b> (${getQualityDpr(tiers[nextIdx]).toFixed(2)}x DPR).`, 'skill');
}

function toggleOutlines(): void {
  outlinesEnabled = !outlinesEnabled;
  if (G.scene) {
    G.scene.traverse((obj) => {
      if (obj.userData?.isOutline) {
        obj.visible = outlinesEnabled;
      }
    });
  }
  syncGraphicsButtons();
  addChatMessage(`Cartoon Outlines <b>${outlinesEnabled ? 'Enabled' : 'Disabled (Ultra FPS)'}</b>.`, 'skill');
}

export function syncGraphicsButtons(): void {
  const gBtn = document.getElementById('graphics-quality-btn');
  if (gBtn) gBtn.textContent = `Graphics: ${currentQuality.charAt(0).toUpperCase() + currentQuality.slice(1)}`;
  const oBtn = document.getElementById('outlines-toggle-btn');
  if (oBtn) oBtn.textContent = outlinesEnabled ? 'Outlines: On' : 'Outlines: Off';
}


function initGpuTelemetry(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      telemetryInfo.gpuName = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || 'WebGL Renderer';
      telemetryInfo.vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '';
    } else {
      telemetryInfo.gpuName = (gl.getParameter(gl.RENDERER) as string) || 'WebGL';
    }
  } catch {
    telemetryInfo.gpuName = 'Hardware WebGL';
  }

  const lower = telemetryInfo.gpuName.toLowerCase();
  let cleanName = telemetryInfo.gpuName;
  const match = telemetryInfo.gpuName.match(/NVIDIA GeForce [^,)]+|Radeon [^,)]+|Intel\(R\) [^,)]+/i);
  if (match) cleanName = match[0];

  telemetryInfo.isHardwareAccelerated = !/swiftshader|software|llvmpipe|basic render/i.test(lower);

  const nameEl = document.getElementById('perf-gpu-name');
  const dotEl = document.getElementById('perf-dot');
  if (nameEl) {
    if (!telemetryInfo.isHardwareAccelerated) {
      nameEl.textContent = 'CPU SwiftShader (GPU Acceleration OFF!)';
      nameEl.title = 'Hardware acceleration is disabled in your browser. Enable it in chrome://settings/system!';
      if (dotEl) dotEl.className = 'perf-status-dot warning';
    } else {
      nameEl.textContent = cleanName;
      nameEl.title = telemetryInfo.gpuName;
      if (dotEl) dotEl.className = 'perf-status-dot';
    }
  }
}

function init3DEngine() {
  const container = document.getElementById('game-canvas-container');
  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.FogExp2(0x9ab0c2, 0.0028);

  G.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 360);

  G.renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    precision: 'highp',
    stencil: false,
    depth: true
  });
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(getQualityDpr(currentQuality));
  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.renderer.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer.toneMappingExposure = 1.05;
  G.renderer.domElement.id = 'game-canvas';
  container.appendChild(G.renderer.domElement);

  initGpuTelemetry(G.renderer.getContext());
  applyQualityTier('balanced');

  G.hemiLight = new THREE.HemisphereLight(0xa5b8c9, 0x333d32, 0.52);
  G.scene.add(G.hemiLight);

  G.ambientLight = new THREE.AmbientLight(0x617282, 0.28);
  G.scene.add(G.ambientLight);

  G.sunLight = new THREE.DirectionalLight(0xf8f5ed, 1.15);
  G.sunLight.position.set(45, 68, 35);
  G.sunLight.castShadow = true;
  G.sunLight.shadow.mapSize.width = 2048;
  G.sunLight.shadow.mapSize.height = 2048;
  G.sunLight.shadow.camera.near = 5;
  G.sunLight.shadow.camera.far = 170;
  const d = 54;
  G.sunLight.shadow.camera.left = -d;
  G.sunLight.shadow.camera.right = d;
  G.sunLight.shadow.camera.top = d;
  G.sunLight.shadow.camera.bottom = -d;
  G.sunLight.shadow.bias = -0.0004;
  G.scene.add(G.sunLight);
  G.scene.add(G.sunLight.target);

  buildSkyDomeShader();
  buildTerrainAndWater();
  buildAllCitiesAndLandmarks();
  buildPlayerCharacter();
  spawnAllResourcesAndMonsters();
  sealAlbedoUvs(G.scene);

  window.addEventListener('resize', onWindowResize);
  setupInputHandlers();
}





// ============================================================================
// 9. INPUT, CAMERA BEHIND CHARACTER, COMBAT, SKILLING, MINIMAP & MAIN LOOP
// ============================================================================

function setupInputHandlers() {
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

  window.addEventListener('keydown', e => {
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
    if (e.code === 'Escape') {
      closeModals();
    }
    const tabByKey = { F1: 'combat', F2: 'skills', F3: 'inventory', F4: 'equipment', F5: 'prayer', F6: 'magic' };
    if (tabByKey[e.code]) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        switchTab(tabByKey[e.code]);
      }
    }
  });

  window.addEventListener('keyup', e => {
    G.keysPressed[e.code] = false;
  });

  document.addEventListener('mousedown', (e) => {
    const menu = document.getElementById('context-menu');
    if (!menu || !menu.classList.contains('open')) return;
    if (menu.contains(e.target)) return;
    hideContextMenu();
  });

  const canvas = G.renderer.domElement;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const canvasHost = document.getElementById('game-canvas-container');
  if (canvasHost) canvasHost.addEventListener('contextmenu', onGameContextMenu);

  canvas.addEventListener('mousedown', e => {
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

  window.addEventListener('mousemove', e => {
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

  canvas.addEventListener('wheel', e => {
    camState.distance = Math.max(3.6, Math.min(26, camState.distance + e.deltaY * 0.01));
  }, { passive: true });

  const mmCanvas = document.getElementById('minimap-canvas');
  mmCanvas.addEventListener('click', e => {
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

function resetCameraBehindPlayer() {
  camState.manualOffset = 0;
  camState.pitch = 0.24;
  camState.distance = 8.5;
}

function showClickMarker(x, z, hexColor) {
  if (!G.clickMarkerMesh) return;
  G.clickMarkerMesh.position.set(x, getTerrainHeight(x, z) + 0.16, z);
  G.clickMarkerMesh.userData.life = 1;
  G.clickMarkerMesh.scale.set(1, 1, 1);
  G.clickMarkerMesh.traverse(obj => {
    if (obj.material && obj.material.color) {
      obj.material.color.setHex(hexColor);
      obj.material.opacity = 1;
    }
  });
}

function handleWorldHover(e) {
  const onCanvas = !!(e.target && e.target.id === 'game-canvas');
  const modalOpen = !!document.querySelector('.modal-backdrop.open');
  if (!onCanvas || modalOpen) {
    G.hoveredWorld = null;
    hideHoverTooltip();
    if (G.hoverTile) G.hoverTile.visible = false;
    return;
  }
  updateHoverTile(e);
  const tooltip = document.getElementById('hover-tooltip');
  G.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);
  const hits = G.raycaster.intersectObjects(G.worldInteractiveObjects, false);
  if (hits.length > 0) {
    const ud = hits[0].object.userData;
    if (ud && ud.type !== 'ground') {
      let label = '';
      if (ud.type === 'monster' && !ud.entity.dead) {
        const m = ud.entity;
        label = `Attack <b style="color:#ff981f">${m.def.name}</b> (Lv-${m.def.level}) [${m.hp}/${m.maxHp} HP]`;
      } else if (ud.type === 'resource' && !ud.entity.depleted) {
        const r = ud.entity;
        label = `Gather <b style="color:#38bdf8">${r.def.name}</b> (Req Lv ${r.def.req} ${SKILLS_META[r.def.skill].name})`;
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

export function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
}

function pointerToWorld(clientX, clientY) {
  G.mouseVec.x = (clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);
  const hits = G.raycaster.intersectObjects(G.worldInteractiveObjects, false);
  const entityHit = hits.find((hit) => hit.object.userData && hit.object.userData.type && hit.object.userData.type !== 'ground');
  const groundHits = G.terrainMesh ? G.raycaster.intersectObject(G.terrainMesh, false) : [];
  return { entityHit, ground: groundHits[0] || null };
}

function onGameContextMenu(e) {
  e.preventDefault();
  if (G.rightPress.dist > 6) return;
  if (document.querySelector('.modal-backdrop.open')) return;
  const picked = pointerToWorld(e.clientX, e.clientY);
  const options = [];
  const ud = picked.entityHit ? picked.entityHit.object.userData : null;

  if (ud && ud.type === 'monster' && ud.entity && !ud.entity.dead) {
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
    const anchor = picked.entityHit.object.getWorldPosition(new THREE.Vector3());
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

export function openChooseMenu(clientX, clientY, options) {
  const menu = document.getElementById('context-menu');
  const list = document.getElementById('context-menu-list');
  if (!menu || !list) return;
  list.innerHTML = '';
  options.forEach((opt) => {
    const row = document.createElement('div');
    row.className = 'osrs-menu-item' + (opt.tone ? ` threat-${opt.tone}` : '');
    row.setAttribute('role', 'menuitem');
    row.textContent = opt.label;
    row.addEventListener('click', (ev) => {
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

function handleWorldClick(e) {
  G.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  G.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  G.raycaster.setFromCamera(G.mouseVec, G.camera);

  const hits = G.raycaster.intersectObjects(G.worldInteractiveObjects, false);
  if (hits.length === 0) return;

  let chosen = hits.find(h => h.object.userData && h.object.userData.type !== 'ground') || hits[0];
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
    if (ud.entity.dead) return;
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
    showClickMarker(player.targetEntity.pos.x, player.targetEntity.pos.z, 0xef4444);
  }
}


// ============================================================================
// 12. MAIN ANIMATION, SHADERS & PHYSICS LOOP
// ============================================================================

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.08, (now - G.lastFrameTime) / 1000);
  G.lastFrameTime = now;
  const elapsedSec = now * 0.001;

  if (player.downed) {
    player.downedTimer -= dt;
    const count = document.getElementById('death-count');
    if (count) count.textContent = String(Math.max(0, Math.ceil(player.downedTimer)));
    if (player.downedTimer <= 0) finishRespawn();
  } else if (getEquipmentBonuses(STATE).matchedSet) {
    G.setBonusTimer += dt;
    const bon = getEquipmentBonuses(STATE);
    const threshold = bon.isFullKit ? 1.25 : 1.7;
    if (G.setBonusTimer > threshold) {
      G.setBonusTimer = 0;
      if (bon.isFullKit) {
        spawnExpandingRing(player.pos, 0x94a3b8, 0.55, 2.2, 0.45, 0.65);
        spawnExpandingRing(player.pos, 0xc5a059, 0.35, 1.5, 0.35, 0.45);
      } else {
        spawnExpandingRing(player.pos, 0xc5a059, 0.55, 1.8, 0.42, 0.55);
      }
    }
  }

  if (G.waterUniforms) G.waterUniforms.uTime.value = elapsedSec;
  if (G.skyUniforms) G.skyUniforms.uTime.value = elapsedSec;
  if (G.skyDomeMesh) G.skyDomeMesh.position.copy(player.pos);

  if (STATE.specEnergy < 100) {
    STATE.specEnergy = Math.min(100, STATE.specEnergy + dt * 2.5);
  }
  if (STATE.hp < STATE.maxHp && STATE.hp > 0) {
    STATE.hp = Math.min(STATE.maxHp, STATE.hp + dt * 0.25);
  }
  if (STATE.activePrayers.size > 0) {
    let drainRate = 0;
    PRAYERS.forEach(p => { if (STATE.activePrayers.has(p.id)) drainRate += p.drain; });
    STATE.prayerPts = Math.max(0, STATE.prayerPts - drainRate * dt);
    if (STATE.prayerPts <= 0) {
      STATE.activePrayers.clear();
      addChatMessage('You have run out of Prayer points! Your prayers have deactivated.', 'combat');
      updateAllUI();
    }
  }

  const moveSpeed = 11.5;
  const turnSpeed = 2.6;
  let manualMoving = false;

  if (G.keysPressed['KeyQ']) camState.manualOffset += turnSpeed * dt;
  if (G.keysPressed['KeyE']) camState.manualOffset -= turnSpeed * dt;

  if (player.downed) {
    player.targetPos = null;
    player.targetEntity = null;
  }

  if (!player.downed && (G.keysPressed['KeyA'] || G.keysPressed['ArrowLeft'])) {
    player.yaw += turnSpeed * dt;
  }
  if (!player.downed && (G.keysPressed['KeyD'] || G.keysPressed['ArrowRight'])) {
    player.yaw -= turnSpeed * dt;
  }

  let forwardInput = 0;
  if (!player.downed && (G.keysPressed['KeyW'] || G.keysPressed['ArrowUp'])) forwardInput += 1;
  if (!player.downed && (G.keysPressed['KeyS'] || G.keysPressed['ArrowDown'])) forwardInput -= 0.75;

  let hasMoveIntent = false;
  let moveDirX = 0;
  let moveDirZ = 0;

  if (forwardInput !== 0) {
    hasMoveIntent = true;
    player.targetPos = null;
    player.targetEntity = null;
    const sign = forwardInput > 0 ? 1 : -0.75;
    moveDirX = Math.sin(player.yaw) * sign;
    moveDirZ = Math.cos(player.yaw) * sign;
    if (!camState.isDragging) {
      camState.manualOffset *= Math.pow(0.15, dt);
    }
  } else if (player.targetEntity) {
    const tType = player.targetEntity.type;
    let targetVec = null;
    let stopDist = 2.8;

    if (tType === 'monster') {
      const m = player.targetEntity.ref;
      if (m.dead) {
        player.targetEntity = null;
      } else {
        targetVec = m.pos;
        stopDist = (STATE.combatStyle === 'rapid' || STATE.combatStyle === 'ranged' || STATE.combatStyle === 'magic') ? 13.5 : 2.9;
      }
    } else if (tType === 'resource') {
      const r = player.targetEntity.ref;
      if (r.depleted) {
        player.targetEntity = null;
      } else {
        targetVec = r.pos;
        stopDist = 3.1;
      }
    } else if (tType === 'interactive') {
      targetVec = player.targetEntity.pos;
      stopDist = 3.5;
    }

    if (targetVec) {
      const dx = targetVec.x - player.pos.x;
      const dz = targetVec.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      const desiredYaw = Math.atan2(dx, dz);
      player.yaw = lerpAngle(player.yaw, desiredYaw, Math.min(1, dt * 10));

      if (dist > stopDist) {
        hasMoveIntent = true;
        moveDirX = dx / dist;
        moveDirZ = dz / dist;
        if (!camState.isDragging) camState.manualOffset *= Math.pow(0.25, dt);
      } else {
        if (tType === 'interactive') {
          const act = player.targetEntity.ref.action;
          player.targetEntity = null;
          if (act === 'shop') openShopModal('all');
          else if (act === 'bank') openBankModal();
          else if (act === 'forge') openSmithingModal();
          else if (act === 'worldmap') openWorldMapModal();
          else if (act === 'slayer') openQuestsModal();
          else if (act === 'dialogue') {
            const dlg = player.targetEntity.ref.dialogue || 'Greetings, traveler.';
            const name = player.targetEntity.ref.name || 'Guard';
            addChatMessage(`${name}: "${dlg}"`, 'combat');
          }
          else if (act === 'altar') {
            STATE.prayerPts = STATE.maxPrayerPts;
            STATE.hp = STATE.maxHp;
            SFX.prayer();
            spawnLevelUpFireworks(0x38bdf8);
            addChatMessage('You pray at the sacred Altar. Your Prayer points and Hitpoints are fully restored!', 'skill');
            updateAllUI();
          }
        } else if (player.actionCooldown <= 0) {
          if (tType === 'monster') {
            performPlayerAttack(player.targetEntity.ref);
            player.actionCooldown = TICK_SEC;
          } else if (tType === 'resource') {
            performResourceGather(player.targetEntity.ref);
            player.actionCooldown = TICK_SEC;
          }
        }
      }
    }
  } else if (player.targetPos) {
    const dx = player.targetPos.x - player.pos.x;
    const dz = player.targetPos.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.45) {
      hasMoveIntent = true;
      const desiredYaw = Math.atan2(dx, dz);
      player.yaw = lerpAngle(player.yaw, desiredYaw, Math.min(1, dt * 10));
      moveDirX = dx / dist;
      moveDirZ = dz / dist;
      if (!camState.isDragging) camState.manualOffset *= Math.pow(0.25, dt);
    } else {
      player.targetPos = null;
    }
  }

  // Smooth Acceleration & Deceleration Momentum
  const targetSpeed = hasMoveIntent ? moveSpeed : 0;
  const accelRate = hasMoveIntent ? 16 : 12;
  player.currentSpeed = (player.currentSpeed ?? 0) + (targetSpeed - (player.currentSpeed ?? 0)) * Math.min(1, dt * accelRate);
  if (!hasMoveIntent && Math.abs(player.currentSpeed) < 0.05) {
    player.currentSpeed = 0;
  }

  if (player.currentSpeed > 0.02 && (moveDirX !== 0 || moveDirZ !== 0)) {
    const stepped = moveWithCollision(player.pos.x, player.pos.z, moveDirX * player.currentSpeed * dt, moveDirZ * player.currentSpeed * dt);
    player.pos.x = stepped.x;
    player.pos.z = stepped.z;
  }

  if (player.actionCooldown > 0) player.actionCooldown -= dt;

  const groundY = Math.max(-0.25, getTerrainHeight(player.pos.x, player.pos.z));
  if (!player.isGrounded) {
    player.pos.y += player.jumpVel * dt;
    player.jumpVel -= 20.0 * dt;
    if (player.pos.y <= groundY) {
      player.pos.y = groundY;
      player.isGrounded = true;
      player.jumpVel = 0;
    }
  } else {
    // Smooth terrain follow
    player.pos.y += (groundY - player.pos.y) * Math.min(1, dt * 18);
  }

  player.isMoving = player.currentSpeed > 0.4;
  player.meshGroup.position.copy(player.pos);

  // Smooth Yaw & Turning Angular Velocity
  const lastMeshYaw = player.meshGroup.rotation.y;
  const targetMeshYaw = player.yaw + Math.PI;
  player.meshGroup.rotation.y = lerpAngle(player.meshGroup.rotation.y, targetMeshYaw, Math.min(1, dt * 12));

  let turnDelta = (player.meshGroup.rotation.y - lastMeshYaw) / Math.max(0.001, dt);
  if (turnDelta > Math.PI) turnDelta -= Math.PI * 2;
  if (turnDelta < -Math.PI) turnDelta += Math.PI * 2;
  player.yawVelocity = (player.yawVelocity ?? 0) * 0.8 + turnDelta * 0.2;

  // Dynamic Bank Roll (lean subtly into turns while running)
  const targetBank = player.isMoving ? THREE.MathUtils.clamp(-player.yawVelocity * 0.07, -0.20, 0.20) : 0;
  player.bankRoll = (player.bankRoll ?? 0) + (targetBank - (player.bankRoll ?? 0)) * Math.min(1, dt * 10);
  player.meshGroup.rotation.z = player.bankRoll;

  // Dynamic cape physics: realistic cloth aerodynamics in Three.js coordinates
  // Note: with Y-up & -Z forward, negative rotation.x swings cape BACKWARD (+Z away from body).
  const updateCapePhysics = (isMoving, animTime) => {
    if (!player.parts.capeMesh) return;
    const isAva = player.parts.capeMesh.userData?.silhouette === 'ava';
    if (isAva) {
      player.parts.capeMesh.rotation.set(0, 0, 0);
      return;
    }

    // Dynamic backward leg clearance:
    // In our rig, positive rotation.x swings thigh backward (+Z into the cape volume)
    const leftLegRx = player.parts.leftLegPivot?.rotation.x ?? 0;
    const rightLegRx = player.parts.rightLegPivot?.rotation.x ?? 0;
    const maxRearLegKick = Math.max(0, leftLegRx, rightLegRx);
    const rearLegClearance = maxRearLegKick * 0.55;

    const speedRatio = player.currentSpeed / moveSpeed;
    // Aerodynamic wind billow pushes cape BACKWARD (negative pitch) in slipstream
    const windFlare = speedRatio * 0.44;

    const flutter = isMoving
      ? (Math.sin(animTime * 2.2) * 0.05 + Math.cos(animTime * 4.4) * 0.02)
      : (Math.sin(animTime * 0.8) * 0.012);

    // Resting backward drape: -0.12 rad cleanly arches backward past buttocks & belt
    const baseBackwardDrape = isMoving ? 0.28 : 0.12;
    const targetWorldBackwardPitch = -(baseBackwardDrape + windFlare + rearLegClearance + flutter);

    // Counteract torso pitch so torso forward lean never pulls cape into the body
    const torsoPitch = player.parts.torso?.rotation.x ?? 0;
    const targetLocalPitch = targetWorldBackwardPitch - torsoPitch;

    // Centrifugal roll & inertia during turns: cloth swings outward away from turn
    const targetRoll = THREE.MathUtils.clamp(player.yawVelocity * 0.22, -0.38, 0.38) + (isMoving ? Math.sin(animTime * 1.8) * 0.03 : 0);
    const targetYaw = THREE.MathUtils.clamp(-player.yawVelocity * 0.10, -0.20, 0.20);

    player.capeAngleX = (player.capeAngleX ?? -0.12) + (targetLocalPitch - (player.capeAngleX ?? -0.12)) * Math.min(1, dt * 10);
    player.capeAngleZ = (player.capeAngleZ ?? 0) + (targetRoll - (player.capeAngleZ ?? 0)) * Math.min(1, dt * 8);
    player.capeAngleY = (player.capeAngleY ?? 0) + (targetYaw - (player.capeAngleY ?? 0)) * Math.min(1, dt * 8);

    player.parts.capeMesh.rotation.x = player.capeAngleX;
    player.parts.capeMesh.rotation.z = player.capeAngleZ;
    player.parts.capeMesh.rotation.y = player.capeAngleY;

    if (player.parts.capeMesh.userData?.silhouette === 'lava-cape' && Math.random() < 0.22) {
      const emberPos = player.pos.clone().add(new THREE.Vector3(
        -Math.sin(player.yaw) * 0.45 + (Math.random() - 0.5) * 0.2,
        0.5 + Math.random() * 0.3,
        -Math.cos(player.yaw) * 0.45 + (Math.random() - 0.5) * 0.2
      ));
      spawnBurst(emberPos, 1, 0xf97316, 0.35, 0.6);
    }
  };

  if (player.blenderAnimator) {
    player.animTime += dt * (player.isMoving ? 4.5 : 2.0);
    player.blenderAnimator.setMoving(player.isMoving);
    player.blenderAnimator.setWalkSpeed(player.currentSpeed / moveSpeed);
    player.blenderAnimator.update(dt);
    updateCapePhysics(player.isMoving, player.animTime);

    if (player.attackAnim > 0) {
      player.attackAnim = Math.max(0, player.attackAnim - dt * 3.6);
    }
  } else {
    if (player.isMoving) {
      player.animTime += dt * (player.currentSpeed / moveSpeed * 10);
      const phase = player.animTime;
      const swing = Math.sin(phase) * 0.62;
      const bob = Math.cos(phase * 2) * 0.03;
      const sway = Math.sin(phase) * 0.02;

      player.parts.leftLegPivot.rotation.x = swing;
      player.parts.rightLegPivot.rotation.x = -swing;
      player.parts.leftLegPivot.rotation.z = sway * 0.5;
      player.parts.rightLegPivot.rotation.z = -sway * 0.5;

      if (player.parts.leftKneePivot) player.parts.leftKneePivot.rotation.x = -(0.05 + Math.max(0, -swing) * 0.75);
      if (player.parts.rightKneePivot) player.parts.rightKneePivot.rotation.x = -(0.05 + Math.max(0, swing) * 0.75);

      if (player.parts.torso) {
        player.parts.torso.rotation.x = 0.12 + Math.cos(phase * 2) * 0.02;
        player.parts.torso.rotation.y = -Math.sin(phase) * 0.12;
      }

      player.parts.leftArmPivot.rotation.x = 0.10 - swing * 0.58;
      player.parts.leftArmPivot.rotation.z = 0.28;
      if (player.parts.leftElbowPivot) player.parts.leftElbowPivot.rotation.x = 0.45 + Math.max(0, -swing) * 0.25;

      if (player.attackAnim <= 0) {
        player.parts.rightArmPivot.rotation.x = 0.10 + swing * 0.58;
        player.parts.rightArmPivot.rotation.z = -0.28;
        if (player.parts.rightElbowPivot) player.parts.rightElbowPivot.rotation.x = 0.45 + Math.max(0, swing) * 0.25;
      }
      updateCapePhysics(true, player.animTime);
    } else {
      player.animTime += dt * 2.0;
      const breath = Math.sin(player.animTime) * 0.035;
      player.parts.leftLegPivot.rotation.x *= 0.85;
      player.parts.rightLegPivot.rotation.x *= 0.85;
      if (player.parts.leftKneePivot) player.parts.leftKneePivot.rotation.x *= 0.85;
      if (player.parts.rightKneePivot) player.parts.rightKneePivot.rotation.x *= 0.85;
      if (player.parts.torso) {
        player.parts.torso.rotation.x = breath * 0.5;
        player.parts.torso.rotation.y *= 0.88;
      }
      player.parts.leftArmPivot.rotation.x = 0.10 + breath;
      player.parts.leftArmPivot.rotation.z = 0.28;
      if (player.parts.leftElbowPivot) player.parts.leftElbowPivot.rotation.x = 0.60 + breath * 0.5;
      if (player.attackAnim <= 0) {
        player.parts.rightArmPivot.rotation.x = 0.10 - breath;
        player.parts.rightArmPivot.rotation.z = -0.28;
        if (player.parts.rightElbowPivot) player.parts.rightElbowPivot.rotation.x = 0.50 - breath * 0.5;
      }
      updateCapePhysics(false, player.animTime);
    }

    if (player.attackAnim > 0) {
      player.attackAnim = Math.max(0, player.attackAnim - dt * 3.6);
      const slashAngle = Math.sin(player.attackAnim * Math.PI) * 1.65;
      const k = player.activeWeaponKind;
      if (k === 'greataxe') {
        player.parts.rightArmPivot.rotation.x = -slashAngle;
        if (player.parts.leftArmPivot) player.parts.leftArmPivot.rotation.x = -slashAngle * 0.85;
      } else if (k === 'greatsword') {
        player.parts.rightArmPivot.rotation.x = -slashAngle * 1.1;
        if (player.parts.leftArmPivot) player.parts.leftArmPivot.rotation.x = -slashAngle * 0.9;
      } else if (k === 'mace') {
        player.parts.rightArmPivot.rotation.x = -slashAngle * 1.15;
      } else if (k === 'bow' || k === 'crossbow') {
        if (player.parts.leftArmPivot) player.parts.leftArmPivot.rotation.x = -1.2;
        player.parts.rightArmPivot.rotation.x = -slashAngle * 0.8;
      } else if (k === 'staff' || k === 'wand') {
        player.parts.rightArmPivot.rotation.x = -1.35 * Math.sin(player.attackAnim * Math.PI);
      } else {
        player.parts.rightArmPivot.rotation.x = -slashAngle;
      }
    }
  }
  for (let i = 0; i < G.npcAnimatorsList.length; i++) {
    G.npcAnimatorsList[i].update(dt);
  }
  if (player.parts.whipRig) {
    const stretch = player.attackAnim > 0 ? Math.sin(player.attackAnim * Math.PI) : 0;
    if (stretch > 0.001 || player.parts.whipRig.wasLashing) {
      syncWhipGeometry(player.parts.whipRig, stretch);
      player.parts.whipRig.wasLashing = stretch > 0.001;
    }
  }

  if (player.spinAnim > 0) {
    player.spinAnim = Math.max(0, player.spinAnim - dt * 2.4);
    player.meshGroup.rotation.y += (1 - player.spinAnim) * Math.PI * 4;
    player.parts.spinRing.material.opacity = player.spinAnim * 0.85;
    player.parts.spinRing.scale.setScalar(0.8 + (1 - player.spinAnim) * 0.9);
  } else if (player.parts.spinRing) {
    player.parts.spinRing.material.opacity = 0;
  }

  if (G.clickMarkerMesh && G.clickMarkerMesh.userData.life > 0) {
    G.clickMarkerMesh.userData.life = Math.max(0, G.clickMarkerMesh.userData.life - dt * 1.4);
    const life = G.clickMarkerMesh.userData.life;
    G.clickMarkerMesh.scale.setScalar(1 + (1 - life) * 0.35);
    G.clickMarkerMesh.traverse(obj => {
      if (obj.material && obj.material.transparent) obj.material.opacity = life;
    });
  }

  // Smooth Behind-Character Chase Camera
  const desiredCamYaw = player.yaw + camState.manualOffset;
  camState.yaw = lerpAngle(camState.yaw, desiredCamYaw, Math.min(1, dt * 8.5));

  const horizDist = Math.cos(camState.pitch) * camState.distance;
  const vertDist  = Math.sin(camState.pitch) * camState.distance;
  const camTargetX = player.pos.x - Math.sin(camState.yaw) * horizDist;
  const camTargetZ = player.pos.z - Math.cos(camState.yaw) * horizDist;
  const terrainUnderCam = getTerrainHeight(camTargetX, camTargetZ);
  const camTargetY = Math.max(terrainUnderCam + 1.2, player.pos.y + 1.85 + vertDist);

  _camTargetVec.set(camTargetX, camTargetY, camTargetZ);
  G.camera.position.lerp(_camTargetVec, Math.min(1, dt * 12));
  _lookTargetVec.set(player.pos.x, player.pos.y + 1.85, player.pos.z);
  camState.currentLookAt.lerp(_lookTargetVec, Math.min(1, dt * 14));
  G.camera.lookAt(camState.currentLookAt);

  // Micro-Camera Shake Impulse
  if (camState.shake > 0.001) {
    camState.shake *= Math.pow(0.012, dt);
    G.camera.position.x += (Math.random() - 0.5) * camState.shake;
    G.camera.position.y += (Math.random() - 0.5) * camState.shake;
  }

  G.sunLight.position.set(player.pos.x + 38, player.pos.y + 58, player.pos.z + 28);
  G.sunLight.target.position.copy(player.pos);
  G.sunLight.target.updateMatrixWorld();

  // Monsters Update
  G.monstersList.forEach(m => {
    if (m.isDying) {
      m.dyingTimer -= dt;
      const progress = Math.max(0, 1 - m.dyingTimer / 0.85);
      m.rig.group.rotation.x = progress * (Math.PI / 2.3);
      m.rig.group.position.y = getTerrainHeight(m.pos.x, m.pos.z) - progress * 0.45;
      if (m.dyingTimer <= 0) {
        m.isDying = false;
        m.rig.group.visible = false;
        m.rig.group.rotation.x = 0;
      }
      return;
    }

    if (m.dead) {
      m.respawnTimer -= dt;
      if (m.respawnTimer <= 0) {
        m.dead = false;
        m.isDying = false;
        m.hp = m.maxHp;
        m.breathCount = 0;
        m.flinch = 0;
        m.inCombatWithPlayer = false;
        m.pos.copy(m.spawnPos);
        m.rig.group.position.copy(m.spawnPos);
        m.rig.group.position.y = getTerrainHeight(m.spawnPos.x, m.spawnPos.z);
        m.rig.group.rotation.set(0, 0, 0);
        m.rig.group.visible = true;
      }
      return;
    }

    if (m.rig.lWing && m.rig.rWing) {
      const flap = Math.sin(now * 0.006) * 0.35;
      m.rig.lWing.rotation.z = 0.22 + flap;
      m.rig.rWing.rotation.z = -0.22 - flap;
    }

    if (m.inCombatWithPlayer) {
      const dx = player.pos.x - m.pos.x;
      const dz = player.pos.z - m.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 26) {
        m.inCombatWithPlayer = false;
      } else {
        const targetMonYaw = Math.atan2(dx, dz) + Math.PI;
        m.rig.group.rotation.y = lerpAngle(m.rig.group.rotation.y, targetMonYaw, Math.min(1, dt * 9));
        const atkRange = (m.def.style === 'magic' || m.def.style === 'ranged') ? 11.0 : 2.9;
        if (dist > atkRange) {
          const stepped = moveWithCollision(m.pos.x, m.pos.z, (dx / dist) * 5.2 * dt, (dz / dist) * 5.2 * dt);
          m.pos.x = stepped.x;
          m.pos.z = stepped.z;
          m.pos.y = getTerrainHeight(m.pos.x, m.pos.z);
          poseMonsterLimbs(m, true, now, dt);
        } else {
          poseMonsterLimbs(m, false, now, dt);
          m.attackCooldown -= dt;
          if (m.attackCooldown <= 0) {
            performMonsterRetaliation(m);
            m.attackCooldown = 1.65;
          }
        }
      }
    } else {
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0) {
        m.wanderTimer = 2.5 + Math.random() * 4;
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 4.5;
        m.wanderTarget = new THREE.Vector3(m.spawnPos.x + Math.cos(ang) * rad, 0, m.spawnPos.z + Math.sin(ang) * rad);
      }
      if (m.wanderTarget) {
        const dx = m.wanderTarget.x - m.pos.x;
        const dz = m.wanderTarget.z - m.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.3) {
          const targetWanderYaw = Math.atan2(dx, dz) + Math.PI;
          m.rig.group.rotation.y = lerpAngle(m.rig.group.rotation.y, targetWanderYaw, Math.min(1, dt * 7));
          const stepped = moveWithCollision(m.pos.x, m.pos.z, (dx / dist) * 1.8 * dt, (dz / dist) * 1.8 * dt);
          m.pos.x = stepped.x;
          m.pos.z = stepped.z;
          m.pos.y = getTerrainHeight(m.pos.x, m.pos.z);
          poseMonsterLimbs(m, true, now, dt);
        } else {
          poseMonsterLimbs(m, false, now, dt);
        }
      } else {
        poseMonsterLimbs(m, false, now, dt);
      }
    }
  });

  G.resourceNodesList.forEach(r => {
    if (r.depleted) {
      r.respawnTimer -= dt;
      if (r.respawnTimer <= 0) {
        r.depleted = false;
        r.visualMesh.visible = true;
        r.depletedMesh.visible = false;
      }
    }
  });

  for (let i = G.projectilesList.length - 1; i >= 0; i--) {
    const p = G.projectilesList[i];
    p.progress += p.speed * dt;
    if (p.progress >= 1.0) {
      G.scene.remove(p.mesh);
      if (p.onImpact) p.onImpact();
      G.projectilesList.splice(i, 1);
    } else {
      const arc = p.arc == null ? 1.4 : p.arc;
      p.mesh.position.lerpVectors(p.start, p.end, p.progress);
      p.mesh.position.y += Math.sin(p.progress * Math.PI) * arc;
      if (p.orient) {
        const aheadT = Math.min(1, p.progress + 0.06);
        const next = new THREE.Vector3().lerpVectors(p.start, p.end, aheadT);
        next.y += Math.sin(aheadT * Math.PI) * arc;
        const dir = next.sub(p.mesh.position);
        if (dir.lengthSq() > 1e-8) {
          p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        }
      }
      if (p.onTick) p.onTick(p, dt);
    }
  }

  for (let i = G.vfxList.length - 1; i >= 0; i--) {
    const v = G.vfxList[i];
    v.age += dt;
    if (v.onTick) v.onTick(v, dt);
    if (v.age >= v.life) {
      G.scene.remove(v.mesh);
      G.vfxList.splice(i, 1);
    }
  }

  G.swayingFoliage.forEach(item => {
    if (item.rotY) item.mesh.rotation.z += dt * item.speed;
  });

  if (now - G.lastAutoSaveTime > 2000) {
    G.lastAutoSaveTime = now;
    saveGameState();
  }

  checkRegionChange();
  G.labelTick += dt;
  G.miniTick += dt;
  if (G.labelTick >= 0.1 || Math.hypot(player.pos.x - G.lastLabelX, player.pos.z - G.lastLabelZ) > 0.4) {
    G.labelTick = 0;
    G.lastLabelX = player.pos.x;
    G.lastLabelZ = player.pos.z;
    updateFloatingWorldLabels();
    const found = discoverShrines(player.pos.x, player.pos.z, STATE.shrines);
    if (found.unlocked.length) {
      STATE.shrines = found.shrines;
      found.unlocked.forEach(id => {
        const reg = WORLD_REGIONS.find(r => r.id === id);
        addChatMessage('You discover the <b>' + (reg ? reg.name : id) + '</b> shrine.', 'region');
      });
    }
  }
  const compass = document.getElementById('compass-badge');
  if (compass) compass.style.transform = `rotate(${(camState.yaw - Math.PI)}rad)`;

  if (G.miniTick >= 0.08 || Math.hypot(player.pos.x - G.lastLabelX, player.pos.z - G.lastLabelZ) > 0.4) {
    G.miniTick = 0;
    renderMinimap();
  }
  const tickArc = document.getElementById('tick-arc');
  if (tickArc) tickArc.style.strokeDashoffset = String(88 * Math.max(0, Math.min(1, player.actionCooldown / TICK_SEC)));
  if (G.grassInstanced && G.grassInstanced.material && G.grassInstanced.material.uniforms) {
    G.grassInstanced.material.uniforms.uTime.value = elapsedSec;
  }
  G.renderer.render(G.scene, G.camera);

  G.frameCounter++;
  if (now - G.lastFpsTime >= 500) {
    const elapsed = now - G.lastFpsTime;
    telemetryInfo.fps = Math.round((G.frameCounter * 1000) / elapsed);
    telemetryInfo.frameTimeMs = Number((elapsed / G.frameCounter).toFixed(1));
    G.frameCounter = 0;
    G.lastFpsTime = now;

    const fpsEl = document.getElementById('perf-fps');
    if (fpsEl) fpsEl.textContent = `${telemetryInfo.fps} FPS (${telemetryInfo.frameTimeMs}ms)`;
    const callsEl = document.getElementById('perf-calls');
    if (callsEl && G.renderer) {
      callsEl.textContent = `${G.renderer.info.render.calls} calls • ${Math.round(G.renderer.info.render.triangles / 1000)}k tris`;
    }
  }
}


function onWindowResize() {
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(getQualityDpr(currentQuality));
}



function updateHoverTile(e) {
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

function wireBridge() {
  bridge.chat = (text, type) => addChatMessage(text, type || '');
  bridge.refresh = () => updateAllUI();
  bridge.close = () => closeModals();
  bridge.coin = () => SFX.coin();
  bridge.saveToast = () => manualSaveToast();
  bridge.reset = () => resetGameSave();
  bridge.cycleTime = () => cycleTimeOfDay();
  bridge.toggleXp = () => toggleXpMultiplier();
  bridge.toggleAudio = () => toggleAudio();
  bridge.teleportSpell = (regionId) => teleportToRegion(regionId);
  bridge.noteBank = () => { STATE.quests.openedBank = true; };
  bridge.noteQuest = () => {};
  bridge.showItemTooltip = (ev, it) => showItemTooltip(ev, it);
  bridge.moveItemTooltip = (ev) => moveItemTooltip(ev);
  bridge.hideItemTooltip = () => hideItemTooltip();
  bridge.claimQuest = (questId) => claimQuestReward(questId);
  bridge.locateRegion = (regionId) => locateQuestRegion(regionId);
  bridge.requestSlayer = () => requestSlayerTask();
  bridge.showSellMenu = (ev, index) => showSellChooseMenu(ev, index);
  bridge.sellGathered = () => sellAllLoot();
  bridge.sellGear = () => sellAllUnequippedGear();
  window.cheatSkillsPlus10 = cheatSkillsPlus10;
  window.cheatGold200k = cheatGold200k;
  window.applyTypedCheat = applyTypedCheat;
  window.setCombatStyle = setCombatStyle;
  window.closeModals = closeModals;
  window.switchTab = switchTab;
  window.craftRecipe = craftRecipe;
  window.openWorldMapModal = openWorldMapModal;
  window.openShopModal = openShopModal;
  window.openSmithingModal = openSmithingModal;
  window.openXpTableModal = openXpTableModal;
  window.openBankModal = openBankModal;
  window.openQuestsModal = openQuestsModal;
  window.openSettingsModal = openSettingsModal;
  window.cycleGraphicsQuality = cycleGraphicsQuality;
  window.toggleOutlines = toggleOutlines;
  window.toggleXpMultiplier = toggleXpMultiplier;
  window.cycleTimeOfDay = cycleTimeOfDay;
  window.toggleAudio = toggleAudio;
  window.resetGameSave = resetGameSave;
  window.manualSaveToast = manualSaveToast;
  window.sellInventoryItem = sellInventoryItem;
  window.buyShopItem = buyShopItem;
  window.buyShopPair = buyShopPair;
  window.sellAllLoot = sellAllLoot;
  window.sellAllUnequippedGear = sellAllUnequippedGear;
  window.unequipSlot = unequipSlot;
  window.toggleSpecialAttack = toggleSpecialAttack;
  window.togglePrayer = togglePrayer;
  window.handleSpellClick = handleSpellClick;
  window.teleportToRegion = teleportToRegion;
  window.resetCameraBehindPlayer = resetCameraBehindPlayer;
  window.dismissOnboarding = dismissOnboarding;
  window.replayOnboarding = replayOnboarding;
  (window as any).__DEV_ACCESS__ = {
    player,
    get camera() { return G.camera; },
    camState,
    get scene() { return G.scene; },
    STATE,
    ITEMS,
    rebuildPlayerEquipmentMeshes,
    loadBlenderGearTemplate,
    monstersList: G.monstersList,
    getAnimator: () => player.blenderAnimator,
  };
}

// ============================================================================
// 13. BOOTSTRAP GAME ON LOAD
// ============================================================================
export function boot(): void {
  window.addEventListener('beforeunload', saveGameState);
  window.addEventListener('DOMContentLoaded', () => {
    wireBridge();
    initStaticSvgIcons();
    const hadSave = loadGameState();
    init3DEngine();
    applyLoadedStateToHud();
    updateAllUI();
    maybeShowOnboarding();
    addChatMessage('Welcome to <b>Gielinor Hero</b>.', 'lvlup');
    if (hadSave) {
      addChatMessage('Restored your saved progress & world state from <b>localStorage</b>.', 'skill');
    } else {
      addChatMessage('Use <b>WASD / Arrows</b> or <b>Click</b> anywhere to move, fight monsters, chop trees, mine ores, or fish.', 'skill');
    }
    addChatMessage('The courtyard holds the <b>Bank booth</b>, the <b>General Store</b>, and the <b>Anvil</b>. Walk up to use them. Press <b>F1–F6</b> to switch panels and <b>Esc</b> to close a window.', 'loot');
    addChatMessage('Cheat codes: type <b>skills10</b> to raise every skill by 10, or <b>gold200k</b> for 200,000 GP. Both are also in Settings.', 'skill');
    const cheatInput = document.getElementById('cheat-code-input');
    if (cheatInput) {
      cheatInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          applyTypedCheat();
        }
      });
    }
    const startReg = WORLD_REGIONS.find(r => r.id === STATE.currentRegion) || WORLD_REGIONS[0];
    triggerRegionBanner(startReg);
    (window as unknown as { __DEBUG?: unknown }).__DEBUG = { STATE, player, camState, rebuildPlayerEquipmentMeshes, ITEMS };
    requestAnimationFrame(gameLoop);
  });
}
