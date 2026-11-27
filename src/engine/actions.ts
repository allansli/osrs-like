import * as THREE from 'three';
import { WORLD_REGIONS, type RegionDef } from '../data/world';
import { regionAt, getTerrainHeight } from '../state/terrain';
import { player, camState, G, commandClocks, TICK_SEC, type MonsterEntity, type ResourceNodeEntity } from './context';
import { planWalk, planEntityWalk, showClickMarker } from './input';
import { applyCommand, applyOpenChest, type PlayerCommand, type CommandResult } from '../state/commands';
import { applyDeathLoss, shouldRetaliate } from '../state/sustain';
import { SFX } from './audio';
import { bossDownPlan, impactPlan, phasePlan } from '../state/soundPlan';
import {
  spawnLevelUpFireworks,
  spawnHitSplatWorld,
  spawnHitSplatOnPlayer,
  spawnPiercingBeam,
  spawnArrowProjectile,
  spawnSpellProjectile,
  spawnMeleeSlashEffect,
  spawnBurst,
  spawnRareLootBeam,
  spawnDragonfireEffect,
  spawnShadowBolt,
  spawnHellfireOrb,
  spawnExpandingRing,
  spawnProjectile
} from './vfx';
import { addChatMessage, showBanner, updateTargetHud, updateAllUI, updateSkillsPanel, refreshCombatStyleLocks, requestUiRefresh, el } from '../ui/hud';
import { noteBossDown } from '../state/progress';
import { STATE } from '../state/gameState';
import { prepareAttack, playerAttackProfile, playerHitChance, rollMonsterHit, rollMonsterAttack, addMark, mitigateDamage } from '../state/combat';
import { creditGp, fishDepletes, gatherChance, rollDrops } from '../state/economy';
import { addItem, removeItem, canAddItem } from '../state/inventory';
import { SPELLS } from '../data/magic';
import { AGGRO_GRACE_MS, isDown, onPlayerHit } from '../state/monsterAi';
import { ITEMS } from '../data/items';
import { ATTACKS, BOSSES } from '../data/attacks';
import { CAMERA, HIT_STOP_MS, KNOCK_BACK } from '../data/feel';
import { cameraKick, cameraRumble, flash, flinchHero, hitStop, knockBack } from './reactions';
import { clearTelegraph } from './telegraphs';
import { SKILLS_META } from '../data/skills';
import { addItemToInventory, announceUnlocksSince, grantXp, skillLevels } from '../ui/playerActions';
import {
  applyRespawn,
  deathNotice,
  hitSplatKind,
  isBossLoot,
  isRareLoot,
  noteGather,
  registerKill,
  RESPAWN_SECONDS,
  weaponSpecial
} from '../state/adventure';
import { CAVES, DUNGEONS } from '../data/dungeons';
import { enterZone, handleZoneMonsterDied, isZoneNode, leaveZone } from './zones';

export function teleportToRegion(regionId?: string): void {
  const reg = WORLD_REGIONS.find((r: RegionDef) => r.id === regionId);
  if (!reg) return;
  if (G.zone) leaveZone();
  G.aggroGraceUntil = performance.now() + AGGRO_GRACE_MS;
  player.targetEntity = null;
  player.waypoints.length = 0;
  player.pos.set(reg.x, getTerrainHeight(reg.x, reg.z + 4), reg.z + 4);
  player.yaw = Math.PI;
  camState.yaw = Math.PI;
  camState.manualOffset = 0;
  SFX.magic();
  spawnLevelUpFireworks(0x38e8ff);
  addChatMessage(`Teleported to <b>${reg.name}</b>.`, 'region');
  triggerRegionBanner(reg);
}

let lastBannerRegion: string = '';
export function checkRegionChange(): void {
  const reg = regionAt(player.pos.x, player.pos.z);
  if (!reg) return;
  if (STATE.currentRegion !== reg.id) {
    STATE.currentRegion = reg.id;
    el('current-zone-footer').textContent = reg.name;
    triggerRegionBanner(reg);
  }
}

let bannerTimer: ReturnType<typeof setTimeout> | null = null;
export function triggerRegionBanner(reg: RegionDef): void {
  if (lastBannerRegion === reg.id) return;
  lastBannerRegion = reg.id;
  const b = el('region-banner');
  el('region-sub-text').textContent = reg.sub;
  el('region-title-text').textContent = reg.name;
  b.classList.add('visible');
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('visible'), 3600);
}

let lastRefusalMonster: MonsterEntity | null = null;
let lastRefusalReason: string | null = null;

export function handleBossPhase(monster: MonsterEntity, phaseIndex: number): void {
  const boss = BOSSES[monster.logic.typeKey];
  const phase = boss.phases[phaseIndex];
  showBanner(monster.def.name, phase.name);
  // Ashmantle's opening warning (CALL-4.18): only a boss whose attacks are magic says so.
  if (phaseIndex === 0 && monster.def.style === 'magic') {
    addChatMessage('Its bolts are magic.', 'combat');
  }
  spawnExpandingRing(monster.pos, 0xfde047);
  cameraRumble(CAMERA.rumbleMs);
  SFX.play(phasePlan(), false);
  updateTargetHud();
}

export function dispatchCommand(cmd: PlayerCommand): CommandResult {
  if (cmd.kind === 'move') {
    const path = planWalk([cmd.x, cmd.z]);
    if (!path) {
      addChatMessage('You cannot walk there.', 'combat');
      return { ok: false, reason: 'You cannot walk there.' };
    }
    player.targetEntity = null;
    player.waypoints = path;
    showClickMarker(cmd.x, cmd.z, 0xfde047);
    updateTargetHud();
    return { ok: true, reason: '' };
  }

  if (cmd.kind === 'attack') {
    const m = G.monstersList.find((mon) => mon.id === cmd.targetId);
    if (!m || isDown(m.logic)) {
      return { ok: false, reason: 'Target is not available.' };
    }
    const stopDist =
      STATE.combatStyle === 'rapid' || STATE.combatStyle === 'ranged' || STATE.combatStyle === 'magic'
        ? 13.5
        : 2.9;
    const path = planEntityWalk([m.pos.x, m.pos.z], stopDist);
    if (!path) {
      addChatMessage('You cannot walk there.', 'combat');
      return { ok: false, reason: 'You cannot walk there.' };
    }
    player.targetEntity = { type: 'monster', ref: m, madeAt: [m.pos.x, m.pos.z] };
    player.waypoints = path;
    showClickMarker(m.pos.x, m.pos.z, 0xef4444);
    updateTargetHud();
    return { ok: true, reason: '' };
  }

  const now = performance.now() / 1000;

  if (cmd.kind === 'enterDungeon') {
    const res = applyCommand(STATE, cmd, commandClocks, now);
    if (!res.ok) {
      addChatMessage(res.reason, 'combat');
      return res;
    }
    enterZone((DUNGEONS.find((d) => d.id === cmd.dungeonId) ?? CAVES.find((c) => c.id === cmd.dungeonId))!);
    return res;
  }

  if (cmd.kind === 'leaveDungeon') {
    const res = applyCommand(STATE, cmd, commandClocks, now);
    if (!res.ok) {
      addChatMessage(res.reason, 'combat');
      return res;
    }
    leaveZone();
    return res;
  }

  if (cmd.kind === 'openChest') {
    const res = applyOpenChest(STATE, G.zone!.run!, Math.random, Date.now());
    if (!res.ok) {
      addChatMessage(res.reason, 'combat');
      return res;
    }
    updateAllUI();
    return res;
  }

  const item =
    cmd.kind === 'eat' || cmd.kind === 'drink'
      ? ITEMS[STATE.inventory[cmd.slot].id]
      : null;
  const res = applyCommand(STATE, cmd, commandClocks, now);
  if (!res.ok) {
    addChatMessage(res.reason, 'combat');
    if (cmd.kind === 'style') {
      refreshCombatStyleLocks();
    }
    return res;
  }

  if (cmd.kind === 'eat') {
    player.actionCooldown = Math.max(player.actionCooldown, TICK_SEC);
    SFX.eat();
    const healed = res.restored!;
    addChatMessage(`You eat the <b>${item!.name}</b> and restore ${healed} Hitpoints.`, 'skill');
    spawnHitSplatOnPlayer(healed, 'heal');
    updateAllUI();
  } else if (cmd.kind === 'drink') {
    SFX.prayer();
    addChatMessage(`You drink the <b>${item!.name}</b> and restore your Prayer energy.`, 'skill');
    updateAllUI();
  } else if (cmd.kind === 'style') {
    refreshCombatStyleLocks();
    updateAllUI();
  } else if (cmd.kind === 'prayer') {
    if (STATE.activePrayers.has(cmd.id)) SFX.prayer();
    updateAllUI();
  } else {
    updateAllUI();
  }
  return res;
}

export function performPlayerAttack(monster: MonsterEntity): void {
  if (isDown(monster.logic) || player.downed) return;
  if (monster.logic.state === 'return') {
    // Immune on the way home (design 6.5): spend nothing, say it once, drop the target.
    addChatMessage(`The ${monster.def.name} has lost interest.`, 'combat');
    player.targetEntity = null;
    return;
  }
  const prep = prepareAttack(STATE);
  if (!prep.ok) {
    addChatMessage(prep.reason, 'combat');
    player.targetEntity = null;
    return;
  }
  prep.consume.forEach(cost => removeItem(STATE, cost.id, cost.qty));
  const profile = playerAttackProfile(STATE);
  let maxHit = profile.maxHit;
  let accuracyScore = profile.accuracy;
  const style = STATE.combatStyle;

  const wepId = STATE.equipment.weapon;
  const wepDef = wepId ? (ITEMS[wepId] || null) : null;
  const wepKind = wepDef?.iconKind || 'scimitar';
  player.activeWeaponKind = wepKind;

  const spec = weaponSpecial(STATE.equipment.weapon);
  let isSpec = false;
  let specHeal = 0;
  if (STATE.specArmed) {
    if (STATE.specEnergy < spec.cost) {
      STATE.specArmed = false;
      addChatMessage(`You need ${spec.cost}% Special Attack energy to use <b>${spec.name}</b>.`, 'combat');
      player.attackAnim = 1.0;
    } else {
      isSpec = true;
      STATE.specArmed = false;
      STATE.specEnergy = Math.max(0, STATE.specEnergy - spec.cost);
      maxHit = Math.floor(maxHit * spec.multiplier);
      accuracyScore *= spec.accuracy;
      specHeal = spec.healRatio;
      player.spinAnim = 1.0;
      if (player.blenderAnimator) {
        if (wpKindIsChop(wepKind)) player.blenderAnimator.playAction('Chop', 1.35);
        else player.blenderAnimator.playAction('SpinSlash', 1.25);
      }
      addChatMessage(`You unleash <b>${spec.name}</b>!`, 'lvlup');
    }
  } else {
    player.attackAnim = 1.0;
    if (player.blenderAnimator) {
      if (wepKind === 'greataxe') {
        player.blenderAnimator.playAction('Chop', 1.05);
      } else if (wepKind === 'mace') {
        player.blenderAnimator.playAction('Chop', 1.25);
      } else if (wepKind === 'bow') {
        player.blenderAnimator.playAction('Ranged', 1.3);
      } else if (wepKind === 'crossbow') {
        player.blenderAnimator.playAction('Ranged', 1.45);
      } else if (wepKind === 'staff' || wepKind === 'wand') {
        player.blenderAnimator.playAction('Cast', wepKind === 'wand' ? 1.4 : 1.15);
      } else if (wepKind === 'greatsword') {
        player.blenderAnimator.playAction('Slash', 0.95);
      } else if (wepKind === 'whip') {
        player.blenderAnimator.playAction('Slash', 1.45);
      } else if (style === 'rapid' || style === 'ranged') {
        player.blenderAnimator.playAction('Ranged', 1.2);
      } else if (style === 'magic') {
        player.blenderAnimator.playAction('Cast', 1.2);
      } else if (style === 'aggressive') {
        player.blenderAnimator.playAction('Lunge', 1.25);
      } else {
        player.blenderAnimator.playAction('Slash', 1.25);
      }
    }
  }

  const hitChance = playerHitChance(accuracyScore, monster.def.def);
  const didHit = Math.random() < hitChance;
  const dmg = didHit ? Math.max(1, Math.floor(Math.random() * (maxHit + 1))) : 0;

  const applyDamage = (): void => {
    const hit = onPlayerHit(monster.logic, dmg);
    if (!hit.applied) {
      SFX.miss();
      spawnHitSplatWorld(monster.pos, 0, 'miss');
      for (const ev of hit.events) {
        if (ev.kind === 'phase') handleBossPhase(monster, ev.index);
      }
      const refusal = hit.reason === 'shift' ? 'is untouchable.' : hit.reason === 'arena' ? 'is out of the arena.' : null;
      if (refusal) {
        if (lastRefusalMonster !== monster || lastRefusalReason !== hit.reason) {
          addChatMessage(`The ${monster.def.name} ${refusal}`, 'combat');
          lastRefusalMonster = monster;
          lastRefusalReason = hit.reason!;
        }
      } else {
        lastRefusalMonster = null;
        lastRefusalReason = null;
        if (player.targetEntity?.ref === monster) {
          addChatMessage(`The ${monster.def.name} has lost interest.`, 'combat');
          player.targetEntity = null;
        }
      }
      return;
    }
    lastRefusalMonster = null;
    lastRefusalReason = null;
    if (dmg > 0) {
      SFX.play(impactPlan(dmg / maxHit), true);
      monster.flinch = 1.0;
      monster.flashTimer = 0.12;
      spawnHitSplatWorld(monster.pos, dmg, isSpec ? 'maxhit' : hitSplatKind(dmg, maxHit));
      flash(monster);

      const isKilled = hit.events.some((ev) => ev.kind === 'died');
      const stopMs = isKilled
        ? HIT_STOP_MS.monsterKill
        : isSpec || dmg >= maxHit
          ? HIT_STOP_MS.monsterMaxHit
          : HIT_STOP_MS.monsterHit;
      hitStop(monster, stopMs);
      hitStop(player, stopMs);

      const kbAmount = isSpec || dmg >= maxHit ? KNOCK_BACK.monsterMaxHit.amount : KNOCK_BACK.monsterHit.amount;
      knockBack(monster, monster.pos.x - player.pos.x, monster.pos.z - player.pos.z, kbAmount);

      if (isSpec || wepKind === 'greataxe' || wepKind === 'greatsword' || dmg >= maxHit * 0.75) {
        cameraKick(
          monster.pos.x - player.pos.x,
          monster.pos.z - player.pos.z,
          Math.min(CAMERA.kickMax, 0.04 + (dmg / maxHit) * 0.06)
        );
      }

      if (style === 'magic' && STATE.activeSpell === 'blood_barrage') {
        const healAmt = Math.max(1, Math.floor(dmg * 0.25));
        STATE.hp = Math.min(STATE.maxHp, STATE.hp + healAmt);
        spawnHitSplatOnPlayer(healAmt, 'heal');
      }
      if (specHeal > 0) {
        const healAmt = Math.max(1, Math.floor(dmg * specHeal));
        STATE.hp = Math.min(STATE.maxHp, STATE.hp + healAmt);
        spawnHitSplatOnPlayer(healAmt, 'heal');
      }

      grantXp('hitpoints', dmg * 1.5);
      if (style === 'accurate') grantXp('attack', dmg * 4);
      else if (style === 'aggressive') grantXp('strength', dmg * 4);
      else if (style === 'defensive') grantXp('defence', dmg * 4);
      else if (style === 'controlled') {
        grantXp('attack', dmg * 1.4);
        grantXp('strength', dmg * 1.3);
        grantXp('defence', dmg * 1.3);
      }
      else if (style === 'rapid' || style === 'ranged') grantXp('ranged', dmg * 4);
      else if (style === 'magic') {
        const sp = SPELLS.find(x => x.id === STATE.activeSpell) || SPELLS[0];
        grantXp('magic', dmg * 3 + sp.xp * 0.4);
      }

      for (const ev of hit.events) {
        if (ev.kind === 'died') {
          handleMonsterDeath(monster);
        } else if (ev.kind === 'phase') {
          handleBossPhase(monster, ev.index);
        } else if (ev.kind === 'cancel') {
          clearTelegraph(monster);
        }
      }
    } else {
      SFX.miss();
      spawnHitSplatWorld(monster.pos, 0, 'miss');
      for (const ev of hit.events) {
        if (ev.kind === 'phase') {
          handleBossPhase(monster, ev.index);
        } else if (ev.kind === 'cancel') {
          clearTelegraph(monster);
        }
      }
    }
    updateTargetHud();
    requestUiRefresh();
  };

  player.sinceCombat = 0;

  if ((style === 'rapid' || style === 'ranged')) {
    if (wepKind === 'crossbow') SFX.crossbow();
    else SFX.bow();
    const wep = ITEMS[STATE.equipment.weapon!];
    if (isSpec && (wep?.id === 'ancient_bow' || wep?.id === 'armadyl_crossbow')) {
      spawnPiercingBeam(player.pos, monster.pos, wep.id === 'armadyl_crossbow' ? 0xfde047 : 0x22d3ee);
    }
    spawnArrowProjectile(wep, player.pos, monster.pos, applyDamage);
  } else if (style === 'magic') {
    SFX.magic();
    const sp = SPELLS.find(x => x.id === STATE.activeSpell) || SPELLS[0];
    spawnSpellProjectile(sp, player.pos, monster.pos, applyDamage);
  } else {
    if (wepKind === 'greataxe' || wepKind === 'greatsword') SFX.heavyChop();
    else if (wepKind === 'mace') SFX.crush();
    else if (wepKind === 'whip') SFX.whipCrack();
    else SFX.slash();
    spawnMeleeSlashEffect(ITEMS[STATE.equipment.weapon!], player.pos, player.yaw, monster.pos, isSpec);
    applyDamage();
  }
}

function wpKindIsChop(kind: string): boolean {
  return kind === 'greataxe' || kind === 'mace';
}

export function handleMonsterDeath(monster: MonsterEntity): void {
  hitStop(monster, HIT_STOP_MS.monsterKill);
  clearTelegraph(monster);
  if (player.targetEntity && player.targetEntity.ref === monster) {
    player.targetEntity = null;
  }
  if (G.zone) handleZoneMonsterDied(monster);
  spawnBurst(monster.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 6, 0x64748b, 0.6, 1.4);

  if (BOSSES[monster.logic.typeKey]) {
    SFX.play(bossDownPlan(), false);
    noteBossDown(STATE, monster.typeKey, Date.now());
  }

  addChatMessage(`Defeated <b>${monster.def.name}</b> (Lv-${monster.def.level}).`, 'combat');
  const before = skillLevels();
  const kill = registerKill(STATE, monster.typeKey);
  if (kill.slayerKillXp > 0 && !kill.slayerCompleted) {
    addChatMessage(`Slayer progress: <b>${kill.remaining}</b> ${kill.taskName} remaining.`, 'skill');
  }
  if (kill.slayerCompleted) {
    addChatMessage(`Slayer bounty: <b style="color:#ffe642">${kill.bountyGp.toLocaleString()} GP</b> and <b>${kill.bountyXp} Attack XP</b>. Streak ${STATE.quests.slayerStreak}.`, 'loot');
    showBanner('Slayer Bounty', `${kill.taskName} complete`);
    spawnLevelUpFireworks(0xc084fc);
  }
  announceUnlocksSince(before);

  let rareBeam = isBossLoot(monster.typeKey);
  const drops = rollDrops(monster.typeKey, Math.random);
  for (const drop of drops) {
    if (drop.kind === 'gp') {
      creditGp(STATE, drop.amount);
      SFX.coin();
      addChatMessage(`Looted <b style="color:#ffe642">${drop.amount} GP</b> from ${monster.def.name}.`, 'loot');
    } else if (drop.kind === 'item' && ITEMS[drop.id]) {
      if (isRareLoot(ITEMS[drop.id])) rareBeam = true;
      const gained = addItem(STATE, drop.id, drop.qty);
      if (gained.added > 0) addChatMessage('Looted <b>' + ITEMS[drop.id].name + '</b>' + (gained.added > 1 ? ' x' + gained.added : '') + '.', 'loot');
      if (!gained.ok) addChatMessage('Your backpack is full. The <b>' + ITEMS[drop.id].name + '</b> is left behind.', 'combat');
    }
  }
  if (rareBeam) spawnRareLootBeam(monster.pos);
  requestUiRefresh();
}

function maybeRetaliate(monster: MonsterEntity): void {
  let walking = player.isMoving || player.waypoints.length > 0;
  if (player.targetEntity?.type === 'resource') {
    // CALL-6.29 (b): a hit ends the gather, and the walk to the node with it, so the auto-retaliation answers.
    player.targetEntity = null;
    player.waypoints.length = 0;
    walking = false;
  }
  const hasTarget = player.targetEntity !== null;
  const keyHeld = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].some(
    (k) => !!G.keysPressed[k]
  );
  const downed = player.downed;
  const windupLive = G.monstersList.some(
    (m) => (m.logic.state === 'chase' || m.logic.state === 'attack') && m.logic.windup !== null
  );
  if (shouldRetaliate({ hasTarget, walking, keyHeld, downed, windupLive })) {
    dispatchCommand({ kind: 'attack', targetId: monster.id });
  }
}

export function performMonsterRetaliation(monster: MonsterEntity): void {
  if (isDown(monster.logic) || player.downed || STATE.hp <= 0) return;
  player.sinceCombat = 0;
  monster.logic.breathCount = (monster.logic.breathCount || 0) + 1;
  const { dmg, dragonfire, absorbed: absorbedBreath } = rollMonsterHit(
    monster.typeKey,
    monster.logic.breathCount,
    STATE,
    Math.random
  );
  monster.attackAnim = 1;

  const applyHit = (): void => {
    player.sinceCombat = 0;
    if (absorbedBreath) {
      addChatMessage("Your shield / prayer absorbs most of Elvarg's dragonfire!", 'skill');
    }
    const isMitigated = absorbedBreath ||
      mitigateDamage(monster.def.maxHit, monster.def.style, STATE.activePrayers) < monster.def.maxHit;
    if (dmg > 0) {
      STATE.hp = Math.max(0, STATE.hp - dmg);
      flash(player);
      spawnHitSplatOnPlayer(dmg, isMitigated ? 'blocked' : hitSplatKind(dmg, monster.def.maxHit));
      if (STATE.hp <= 0) {
        handlePlayerDeath();
      } else {
        maybeRetaliate(monster);
      }
    } else {
      spawnHitSplatOnPlayer(0, absorbedBreath ? 'blocked' : 'miss');
      if (absorbedBreath) {
        maybeRetaliate(monster);
      }
    }
    requestUiRefresh();
  };

  if (dragonfire) {
    addChatMessage('Elvarg rears back and breathes <b>Dragonfire</b>!', 'combat');
    spawnDragonfireEffect(monster, applyHit);
    return;
  }
  if (monster.typeKey === 'dark_wizard') {
    spawnShadowBolt(monster.pos, player.pos, applyHit);
  } else if (monster.typeKey === 'goblin_archer' || monster.typeKey === 'dark_ranger') {
    spawnArrowProjectile(null, monster.pos, player.pos, applyHit);
  } else if (monster.typeKey === 'lesser_demon' || monster.typeKey === 'ember_hurler') {
    spawnHellfireOrb(monster.pos, player.pos, applyHit);
  } else if (monster.typeKey === 'moss_guardian') {
    applyHit();
    spawnExpandingRing(player.pos, 0x22c55e, 0.65, 3.6, 0.4, 0.62);
    spawnBurst(player.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 8, 0x4ade80, 0.45, 2.4);
  } else if (monster.def.style === 'magic') {
    spawnProjectile(monster.pos, player.pos, 0xa855f7, applyHit);
  } else if (monster.def.style === 'ranged') {
    spawnProjectile(monster.pos, player.pos, 0xfde047, applyHit);
  } else {
    applyHit();
  }
}

// Returns the damage dealt, 0 when the heavy missed or the hero or the monster is already down.
export function performMonsterHeavy(monster: MonsterEntity, attackId: string): number {
  if (isDown(monster.logic) || player.downed || STATE.hp <= 0) return 0;
  player.sinceCombat = 0;
  const attack = ATTACKS[attackId];
  const marks = player.marks;
  const boss = BOSSES[monster.logic.typeKey];
  const { dmg } = rollMonsterAttack(monster.typeKey, attack, STATE, marks, Math.random);
  monster.attackAnim = 1;

  if (dmg > 0) {
    if (boss) {
      addMark(marks, boss);
    }
    STATE.hp = Math.max(0, STATE.hp - dmg);
    flash(player);
    hitStop(player, HIT_STOP_MS.heroHeavy);
    hitStop(monster, HIT_STOP_MS.heroHeavy);
    flinchHero(player.pos.x - monster.pos.x, player.pos.z - monster.pos.z);
    knockBack(player, player.pos.x - monster.pos.x, player.pos.z - monster.pos.z, KNOCK_BACK.heroHeavy.amount);
    cameraKick(player.pos.x - monster.pos.x, player.pos.z - monster.pos.z, CAMERA.kickMax);
    spawnHitSplatOnPlayer(dmg, 'heavy');
    if (STATE.hp <= 0) {
      handlePlayerDeath();
    } else {
      maybeRetaliate(monster);
    }
  } else {
    spawnHitSplatOnPlayer(0, 'miss');
  }
  requestUiRefresh();
  return dmg;
}

export function handlePlayerDeath(): void {
  if (player.downed) return;
  player.downed = true;
  player.downedTimer = RESPAWN_SECONDS;
  player.targetEntity = null;
  player.waypoints.length = 0;
  player.marks.count = 0;
  player.marks.left = 0;
  STATE.hp = 0;
  STATE.activePrayers.clear();
  const outcome = applyDeathLoss(STATE);
  player.deathOutcome = outcome;
  const notice = deathNotice(outcome);
  const overlay = el('death-overlay');
  overlay.hidden = false;
  el('death-title').textContent = notice.title;
  el('death-body').textContent = notice.body;
  el('death-count').textContent = String(Math.ceil(RESPAWN_SECONDS));
  if (outcome.kind === 'lost') {
    updateSkillsPanel();
  }
  if (player.blenderAnimator) {
    player.blenderAnimator.playAction('Death', 1);
  }
  updateAllUI();
}

export function finishRespawn(): void {
  if (G.zone) leaveZone();
  G.aggroGraceUntil = performance.now() + AGGRO_GRACE_MS;
  applyRespawn(STATE);
  player.downed = false;
  player.downedTimer = 0;
  el('death-overlay').hidden = true;
  const reg = WORLD_REGIONS.find((r: RegionDef) => r.id === 'lumbridge');
  if (reg) {
    player.pos.set(reg.x, getTerrainHeight(reg.x, reg.z + 4), reg.z + 4);
    player.yaw = Math.PI;
    camState.yaw = Math.PI;
    camState.manualOffset = 0;
    triggerRegionBanner(reg);
  }
  const outcome = player.deathOutcome;
  const notice = deathNotice(outcome);
  delete player.deathOutcome;
  addChatMessage(`<b>${notice.title}</b> ${notice.body}`, 'combat');
  if (player.blenderAnimator) {
    player.blenderAnimator.playAction('Idle');
  }
  updateAllUI();
}

export function performResourceGather(node: ResourceNodeEntity): void {
  if (node.depleted) return;
  const def = node.def;
  const skillMeta = (SKILLS_META as Record<string, { name: string }>)[def.skill!];
  const skillLvl = STATE.skills[def.skill!].lvl;
  if (skillLvl < def.req!) {
    addChatMessage(`You need <b>Level ${def.req} ${skillMeta.name}</b> to gather from ${def.name}.`, 'combat');
    player.targetEntity = null;
    updateTargetHud();
    return;
  }
  if (!canAddItem(STATE, def.item!, 1)) {
    addChatMessage('Your backpack is full. The resource stays where it is.', 'combat');
    player.targetEntity = null;
    updateTargetHud();
    return;
  }

  player.attackAnim = 1.0;
  if (def.skill === 'woodcutting') {
    SFX.chop();
    if (player.blenderAnimator) player.blenderAnimator.playAction('Chop', 1.2);
  } else if (def.skill === 'mining') {
    SFX.mine();
    if (player.blenderAnimator) player.blenderAnimator.playAction('Mine', 1.2);
  } else {
    SFX.fish();
    if (player.blenderAnimator) player.blenderAnimator.playAction('Fish', 1.15);
  }

  const successChance = gatherChance(skillLvl, def.req!);
  if (Math.random() <= successChance) {
    addItemToInventory(def.item!, 1);
    noteGather(STATE, def.item!);
    grantXp(def.skill!, def.xp!);
    addChatMessage(`Gathered <b>${ITEMS[def.item!].name}</b>.`, 'skill');

    if (def.kind !== 'fish' || fishDepletes(Math.random())) {
      node.depleted = true;
      node.respawnTimer = isZoneNode(node) ? Infinity : def.respawn! / 1000;
      node.visualMesh.visible = false;
      node.depletedMesh.visible = true;
      if (def.kind === 'fish') SFX.spotEmpty();
      player.targetEntity = null;
      updateTargetHud();
    }
  }
}
