import * as THREE from 'three';
import { WORLD_REGIONS, type RegionDef } from '../data/world';
import { regionAt, getTerrainHeight } from '../state/terrain';
import { player, camState, G, type MonsterEntity, type ResourceNodeEntity } from './context';
import { SFX } from './audio';
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
import { addChatMessage, showBanner, updateTargetHud, updateAllUI, requestUiRefresh, el } from '../ui/hud';
import { STATE } from '../state/gameState';
import { prepareAttack, getEquipmentBonuses, rollMonsterHit } from '../state/combat';
import { addItem, removeItem, canAddItem } from '../state/inventory';
import { SPELLS } from '../data/magic';
import { isDown, onPlayerHit } from '../state/monsterAi';
import { ITEMS } from '../data/items';
import { SKILLS_META } from '../data/skills';
import { addItemToInventory, grantXp } from '../ui/playerActions';
import {
  applyRespawn,
  deathNotice,
  dharokMultiplier,
  hitSplatKind,
  isBossLoot,
  isRareLoot,
  noteGather,
  registerKill,
  RESPAWN_SECONDS,
  weaponSpecial
} from '../state/adventure';

export function teleportToRegion(regionId?: string): void {
  const reg = WORLD_REGIONS.find((r: RegionDef) => r.id === regionId);
  if (!reg) return;
  G.aggroGraceUntil = performance.now() + 3000;
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
  const bon = getEquipmentBonuses(STATE);
  const s = STATE.skills;
  const style = STATE.combatStyle;
  let maxHit = 2;
  let accuracyScore = 10;

  const prayStrMult = STATE.activePrayers.has('piety') ? 1.25 : (STATE.activePrayers.has('burst_str') ? 1.15 : 1.0);
  const prayRngMult = STATE.activePrayers.has('sharp_eye') ? 1.20 : 1.0;
  const prayMagMult = STATE.activePrayers.has('mystic_might') ? 1.20 : 1.0;

  if ((style === 'rapid' || style === 'ranged')) {
    maxHit = Math.max(2, Math.floor((2 + s.ranged.lvl * 0.35 + bon.rng * 0.22) * prayRngMult));
    accuracyScore = s.ranged.lvl * 1.4 + bon.rng + 12;
  } else if (style === 'magic') {
    const sp = SPELLS.find(x => x.id === STATE.activeSpell) || SPELLS[0];
    maxHit = Math.max(3, Math.floor((sp.maxHit! + s.magic.lvl * 0.22 + bon.mag * 0.18) * prayMagMult));
    accuracyScore = s.magic.lvl * 1.5 + bon.mag + 16;
  } else {
    const styleStrBonus = style === 'aggressive' ? 2 : (style === 'controlled' ? 1 : 0);
    const styleAtkBonus = style === 'accurate' ? 4 : (style === 'controlled' ? 2 : 0);
    maxHit = Math.max(2, Math.floor((1.5 + (s.strength.lvl + styleStrBonus) * 0.32 + bon.str * 0.22) * prayStrMult));
    maxHit = Math.max(2, Math.floor(maxHit * dharokMultiplier(STATE)));
    accuracyScore = (s.attack.lvl + styleAtkBonus) * 1.35 + bon.atk + 12;
  }

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

  const monsterDefRoll = monster.def.def * 1.1 + 4;
  const hitChance = Math.min(0.94, Math.max(0.22, accuracyScore / (accuracyScore + monsterDefRoll * 0.75)));
  const didHit = Math.random() < hitChance;
  const dmg = didHit ? Math.max(1, Math.floor(Math.random() * (maxHit + 1))) : 0;

  const applyDamage = (): void => {
    const hit = onPlayerHit(monster.logic, dmg);
    if (!hit.applied) {
      SFX.miss();
      spawnHitSplatWorld(monster.pos, 0, 'miss');
      // A projectile that lands after the monster turned home. If the player still targets it,
      // this is the one message and the target goes; otherwise the guard above already said it.
      if (player.targetEntity?.ref === monster) {
        addChatMessage(`The ${monster.def.name} has lost interest.`, 'combat');
        player.targetEntity = null;
      }
      return;
    }
    if (dmg > 0) {
      SFX.hit();
      monster.flinch = 1.0;
      monster.flashTimer = 0.12;
      spawnHitSplatWorld(monster.pos, dmg, isSpec ? 'maxhit' : hitSplatKind(dmg, maxHit));

      if (isSpec || wepKind === 'greataxe' || wepKind === 'greatsword' || dmg >= maxHit * 0.75) {
        camState.shake = Math.min(0.12, 0.04 + (dmg / maxHit) * 0.06);
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

      if (hit.events.some(e => e.kind === 'died')) {
        handleMonsterDeath(monster);
      }
    } else {
      SFX.miss();
      spawnHitSplatWorld(monster.pos, 0, 'miss');
    }
    updateTargetHud();
    requestUiRefresh();
  };

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
  if (player.targetEntity && player.targetEntity.ref === monster) {
    player.targetEntity = null;
  }
  spawnBurst(monster.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 6, 0x64748b, 0.6, 1.4);

  addChatMessage(`Defeated <b>${monster.def.name}</b> (Lv-${monster.def.level}).`, 'combat');
  const kill = registerKill(STATE, monster.typeKey);
  if (kill.slayerKillXp > 0 && !kill.slayerCompleted) {
    addChatMessage(`Slayer progress: <b>${kill.remaining}</b> ${kill.taskName} remaining.`, 'skill');
  }
  if (kill.slayerCompleted) {
    addChatMessage(`Slayer bounty: <b style="color:#ffe642">${kill.bountyGp.toLocaleString()} GP</b> and <b>${kill.bountyXp} Attack XP</b>. Streak ${STATE.quests.slayerStreak}.`, 'loot');
    showBanner('Slayer Bounty', `${kill.taskName} complete`);
    spawnLevelUpFireworks(0xc084fc);
  }

  let rareBeam = isBossLoot(monster.typeKey);
  if (monster.def.drops) {
    monster.def.drops.forEach(d => {
      if (Math.random() <= d.chance) {
        if (d.gp) {
          const coins = d.gp[0] + Math.floor(Math.random() * (d.gp[1] - d.gp[0] + 1));
          STATE.gp += coins;
          SFX.coin();
          addChatMessage(`Looted <b style="color:#ffe642">${coins} GP</b> from ${monster.def.name}.`, 'loot');
        } else if (d.id && ITEMS[d.id]) {
          if (isRareLoot(ITEMS[d.id])) rareBeam = true;
          const qty = d.qty || 1;
          const gained = addItem(STATE, d.id, qty);
          if (gained.added > 0) addChatMessage('Looted <b>' + ITEMS[d.id].name + '</b>' + (gained.added > 1 ? ' x' + gained.added : '') + '.', 'loot');
          if (!gained.ok) addChatMessage('Your backpack is full. The <b>' + ITEMS[d.id].name + '</b> is left behind.', 'combat');
        }
      }
    });
  }
  if (rareBeam) spawnRareLootBeam(monster.pos);
  requestUiRefresh();
}

export function performMonsterRetaliation(monster: MonsterEntity): void {
  if (isDown(monster.logic) || player.downed || STATE.hp <= 0) return;
  monster.logic.breathCount = (monster.logic.breathCount || 0) + 1;
  const { dmg, dragonfire, absorbed: absorbedBreath } = rollMonsterHit(
    monster.typeKey,
    monster.logic.breathCount,
    STATE,
    Math.random
  );
  monster.attackAnim = 1;

  const applyHit = (): void => {
    if (absorbedBreath) {
      addChatMessage("Your shield / prayer absorbs most of Elvarg's dragonfire!", 'skill');
    }
    if (dmg > 0) {
      STATE.hp = Math.max(0, STATE.hp - dmg);
      spawnHitSplatOnPlayer(dmg, hitSplatKind(dmg, monster.def.maxHit));
      if (STATE.hp <= 0) {
        handlePlayerDeath();
      }
    } else {
      spawnHitSplatOnPlayer(0, 'miss');
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
  } else if (monster.typeKey === 'lesser_demon') {
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

export function handlePlayerDeath(): void {
  if (player.downed) return;
  player.downed = true;
  player.downedTimer = RESPAWN_SECONDS;
  player.targetEntity = null;
  player.waypoints.length = 0;
  STATE.hp = 0;
  STATE.activePrayers.clear();
  const notice = deathNotice();
  const overlay = el('death-overlay');
  overlay.hidden = false;
  el('death-title').textContent = notice.title;
  el('death-body').textContent = notice.body;
  el('death-count').textContent = String(Math.ceil(RESPAWN_SECONDS));
  updateAllUI();
}

export function finishRespawn(): void {
  G.aggroGraceUntil = performance.now() + 3000;
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
  addChatMessage(`<b>${deathNotice().title}</b> ${deathNotice().body}`, 'combat');
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

  const successChance = Math.min(0.92, 0.50 + (skillLvl - def.req!) * 0.02);
  if (Math.random() <= successChance) {
    addItemToInventory(def.item!, 1);
    noteGather(STATE, def.item!);
    grantXp(def.skill!, def.xp!);
    addChatMessage(`Gathered <b>${ITEMS[def.item!].name}</b>.`, 'skill');

    if (def.kind !== 'fish' || Math.random() < 0.35) {
      node.depleted = true;
      node.respawnTimer = def.respawn! / 1000;
      node.visualMesh.visible = false;
      node.depletedMesh.visible = true;
      player.targetEntity = null;
      updateTargetHud();
    }
  }
}
