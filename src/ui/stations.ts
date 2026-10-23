import { ITEMS, TIER_COLORS, combatClassLabel, isStackableInBackpack, itemCombatClass, unitSellPrice, type ItemDef } from '../data/items';
import { SKILLS_META } from '../data/skills';
import { FORGE_RECIPES, recipeById } from '../data/recipes';
import { WORLD_REGIONS, type RegionDef } from '../data/world';
import { buyItem, buyRunePack, canAddItem, countItem, deposit, runePackCost, sellItem, withdraw } from '../state/inventory';
import { BACKPACK_SIZE, STATE } from '../state/gameState';
import { questView } from '../state/adventure';
import { isShrineDiscovered } from '../state/shrines';
import { canCastTeleport } from '../state/combat';
import { SPELLS } from '../data/magic';
import { getItemSvg } from './icons';
import { bridge } from './bridge';
import type { ItemStack, QtyMode } from '../state/types';

const QTYS: QtyMode[] = [1, 5, 10, 50, 100, 500, 'all'];
const STACK_BATCHES = [10, 50, 100, 500, 1000] as const;

function reqBadge(it: ItemDef): { canEquip: boolean; html: string } {
  if (!it.req || Object.keys(it.req).length === 0) {
    return { canEquip: true, html: `<div class="req-ok">Req: None</div>` };
  }
  let canEquip = true;
  const html = Object.entries(it.req).map(([skill, lvl]) => {
    const cur = STATE.skills[skill]?.lvl || 1;
    const met = cur >= lvl;
    if (!met) canEquip = false;
    const name = (SKILLS_META as Record<string, { name: string }>)[skill]?.name || skill;
    const col = met ? '#4ade80' : '#f87171';
    return `<div class="req-line" style="color:${col}">Req: Lv ${lvl} ${name} (${met ? 'Can Equip' : `Your Lv: ${cur}`})</div>`;
  }).join('');
  return { canEquip, html };
}

function qtyPills(): string {
  return `<div class="qty-pills">${QTYS.map((q) => {
    const active = STATE.transferQty === q ? ' active' : '';
    const label = q === 'all' ? 'All' : String(q);
    return `<button class="qty-pill${active}" data-qty="${q}">${label}</button>`;
  }).join('')}</div>`;
}

function formatGp(amount: number): string {
  return `${amount.toLocaleString('en-US')} GP`;
}

function batchLabel(qty: number): string {
  return qty === 1000 ? '+1k' : `+${qty}`;
}

function affordableBuyQty(it: ItemDef): number {
  const price = it.price || 0;
  if (price <= 0) return 0;
  let qty = Math.floor(STATE.gp / price);
  if (!isStackableInBackpack(it)) {
    qty = Math.min(qty, Math.max(0, BACKPACK_SIZE - STATE.inventory.length));
  } else if (qty > 0 && !canAddItem(STATE, it.id, 1)) {
    qty = 0;
  }
  return qty;
}

function shopBuyLabel(it: ItemDef): string {
  const price = it.price || 0;
  const mode = STATE.transferQty;
  if (mode === 'all') {
    const qty = affordableBuyQty(it);
    return `Buy All ×${qty.toLocaleString('en-US')} (${formatGp(price * qty)})`;
  }
  return `Buy ×${mode.toLocaleString('en-US')} (${formatGp(price * mode)})`;
}

function runePackButtons(): string {
  const filter = STATE.shopFilter || 'all';
  const prominent = filter === 'all' || filter === 'supplies' || filter === 'magic' ? ' prominent' : '';
  const button = (qty: number) => {
    const label = qty === 100 ? 'Buy Rune Pack ×100' : 'Buy Rune Pack ×500';
    return `<button type="button" class="rune-pack-btn" data-rune-pack="${qty}">${label} (${formatGp(runePackCost(qty))})</button>`;
  };
  return `<div class="rune-pack-actions${prominent}">${button(100)}${button(500)}</div>`;
}

function bindQty(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('[data-qty]').forEach((btn) => {
    btn.onclick = () => {
      const raw = btn.dataset.qty;
      STATE.transferQty = raw === 'all' ? 'all' : (Number(raw) as QtyMode);
      bridge.refresh();
    };
  });
}

function bindItemTooltip(el: HTMLElement, it: ItemDef | undefined): void {
  if (!it) return;
  el.addEventListener('mouseenter', (ev) => bridge.showItemTooltip(ev, it));
  el.addEventListener('mousemove', (ev) => bridge.moveItemTooltip(ev));
  el.addEventListener('mouseleave', () => bridge.hideItemTooltip());
  el.addEventListener('click', () => bridge.hideItemTooltip());
}

function slotButton(stack: ItemStack, action: string): HTMLButtonElement {
  const it = ITEMS[stack.id];
  const btn = document.createElement('button');
  btn.className = 'stack-slot';
  btn.dataset.action = action;
  btn.dataset.item = stack.id;
  bindItemTooltip(btn, it);
  const tier = it?.tier && (TIER_COLORS as Record<string, string>)[it.tier];
  btn.innerHTML = `
    <span class="stack-icon">${getItemSvg(it)}</span>
    <span class="stack-name">${it?.name || stack.id}</span>
    <span class="qty-badge">${stack.qty}</span>
    ${tier ? `<span class="item-tier-dot" style="background:${tier}"></span>` : ''}
  `;
  return btn;
}

function visibleBankSlots(): ItemStack[] {
  const query = (STATE.bankQuery || '').trim().toLowerCase();
  const filter = STATE.bankFilter;
  return STATE.bank.filter((slot) => {
    const it = ITEMS[slot.id];
    if (!it) return false;
    if (query && !it.name.toLowerCase().includes(query)) return false;
    if (filter === 'gear' && it.type !== 'equip') return false;
    if (filter === 'resources' && it.type === 'equip') return false;
    if (filter === 'runes' && it.type !== 'rune' && it.type !== 'ammo') return false;
    return true;
  });
}

function bindTransfer(btn: HTMLButtonElement): void {
  btn.onclick = () => {
    const id = btn.dataset.item || '';
    const mode = STATE.transferQty;
    const result = btn.dataset.action === 'withdraw' ? withdraw(STATE, id, mode) : deposit(STATE, id, mode);
    if (!result.ok) bridge.chat(result.reason || 'Transfer failed.', 'combat');
    else bridge.chat(`${btn.dataset.action === 'withdraw' ? 'Withdrew' : 'Deposited'} ${result.moved} × ${ITEMS[id]?.name}.`, 'loot');
    bridge.refresh();
  };
}

function paintVaultGrid(grid: HTMLElement): void {
  const bank = visibleBankSlots();
  grid.replaceChildren();
  if (bank.length === 0) {
    grid.innerHTML = `<div class="empty-note">The vault is empty. Deposit from your backpack.</div>`;
    return;
  }
  bank.forEach((slot) => {
    const btn = slotButton(slot, 'withdraw');
    bindTransfer(btn);
    grid.appendChild(btn);
  });
}

export function renderBankModal(): void {
  const body = document.getElementById('bank-body');
  if (!body) return;
  bridge.hideItemTooltip();

  body.innerHTML = `
    <div class="station-toolbar">
      ${qtyPills()}
      <input id="bank-search" class="bank-search" placeholder="Search the vault" value="${escapeAttr(STATE.bankQuery)}" />
      <div class="filter-pills" id="bank-filters"></div>
      <span class="vault-count">${STATE.bank.length} stacks · ${STATE.inventory.length}/28 backpack</span>
    </div>
    <div class="station-panes">
      <section class="pane">
        <h3>Bank Vault</h3>
        <div class="stack-grid" id="bank-grid"></div>
      </section>
      <section class="pane">
        <h3>Backpack</h3>
        <div class="stack-grid backpack-grid" id="bank-pack"></div>
      </section>
    </div>
  `;

  const filters = [
    ['all', 'All'],
    ['gear', 'Armor & Weapons'],
    ['resources', 'Resources'],
    ['runes', 'Runes & Ammo']
  ];
  const filterHost = body.querySelector('#bank-filters')!;
  const filter = STATE.bankFilter;
  filters.forEach(([id, label]) => {
    const b = document.createElement('button');
    b.className = 'filter-pill' + (filter === id ? ' active' : '');
    b.textContent = label;
    b.onclick = () => { STATE.bankFilter = id; renderBankModal(); };
    filterHost.appendChild(b);
  });

  paintVaultGrid(body.querySelector<HTMLElement>('#bank-grid')!);

  const pack = body.querySelector('#bank-pack')!;
  if (STATE.inventory.length === 0) pack.innerHTML = `<div class="empty-note">Backpack empty.</div>`;
  STATE.inventory.forEach((slot) => {
    const btn = slotButton(slot, 'deposit');
    bindTransfer(btn);
    pack.appendChild(btn);
  });

  bindQty(body);
  const search = body.querySelector<HTMLInputElement>('#bank-search');
  if (search) {
    search.oninput = () => {
      STATE.bankQuery = search.value;
      const grid = body.querySelector<HTMLElement>('#bank-grid');
      if (grid) paintVaultGrid(grid);
    };
  }
}

export function renderShopModal(): void {
  const body = document.getElementById('shop-body');
  if (!body) return;
  bridge.hideItemTooltip();
  const filter = STATE.shopFilter || 'all';
  body.innerHTML = `
    <div class="station-toolbar shop-toolbar">
      ${qtyPills()}
      <span class="gp-inline">${STATE.gp.toLocaleString('en-US')} GP · sell-back ${Math.round(0.65 * 100)}%</span>
      ${runePackButtons()}
      <div class="filter-pills" id="shop-filter-pills"></div>
    </div>
    <div class="station-panes">
      <section class="pane">
        <h3>General Store</h3>
        <div class="shop-grid" id="shop-items-grid"></div>
      </section>
      <section class="pane">
        <h3>Backpack — click to sell</h3>
        <div class="stack-grid backpack-grid" id="shop-pack"></div>
      </section>
    </div>
  `;

  const filters = [
    ['all', 'All'],
    ['melee', 'Melee'],
    ['ranged', 'Ranged'],
    ['magic', 'Magic'],
    ['all_around', 'All-Around'],
    ['usable', 'Can Equip Now'],
    ['pairs', 'Top & Bottom Sets'],
    ['food', 'Food & Potions'],
    ['supplies', 'Runes & Supplies']
  ];
  const pills = body.querySelector('#shop-filter-pills')!;
  filters.forEach(([id, label]) => {
    const b = document.createElement('button');
    b.className = 'filter-pill filter-' + id + (filter === id ? ' active' : '');
    b.dataset.shopFilter = id;
    b.textContent = label;
    b.onclick = () => { STATE.shopFilter = id; renderShopModal(); };
    pills.appendChild(b);
  });

  const grid = body.querySelector('#shop-items-grid')!;
  const entries: { it: ItemDef; req: { canEquip: boolean; html: string }; combat: ReturnType<typeof itemCombatClass> }[] = [];
  Object.values(ITEMS).forEach((it) => {
    if (filter !== 'supplies' && (it.type === 'resource' || it.type === 'bones' || it.type === 'bar')) return;
    if (filter === 'supplies' && !['rune', 'ammo', 'resource', 'bones', 'bar', 'food', 'potion'].includes(it.type)) return;
    const req = reqBadge(it);
    const combat = itemCombatClass(it);
    if (filter === 'usable' && !req.canEquip) return;
    if (filter === 'pairs' && !['body', 'legs'].includes(it.slot || '')) return;
    if (filter === 'food' && !['food', 'potion'].includes(it.type)) return;
    if (filter === 'melee' || filter === 'ranged' || filter === 'magic' || filter === 'all_around') {
      if (combat !== filter) return;
    }
    entries.push({ it, req, combat });
  });
  if (filter === 'supplies') {
    const rank = (type: string) => (type === 'rune' ? 0 : type === 'ammo' ? 1 : 2);
    entries.sort((a, b) => rank(a.it.type) - rank(b.it.type));
  }
  entries.forEach(({ it, req, combat }) => {
    const stackable = isStackableInBackpack(it);
    const batches = stackable
      ? `<div class="shop-batch-row">${STACK_BATCHES.map((qty) => {
          const cost = (it.price || 0) * qty;
          return `<button type="button" class="shop-batch-btn" data-buy-batch="${qty}" data-batch-item="${it.id}" title="Buy ${qty.toLocaleString('en-US')} for ${formatGp(cost)}">${batchLabel(qty)}</button>`;
        }).join('')}</div>`
      : '';
    const card = document.createElement('div');
    card.className = 'shop-card combat-' + combat + (stackable ? ' stackable-card' : '');
    card.innerHTML = `
      <div class="shop-card-top">
        <div class="shop-card-icon">${getItemSvg(it)}</div>
        <div>
          <div class="shop-card-name-row">
            <div class="shop-card-name">${it.name}</div>
            <span class="combat-class-badge ${combat}">${combatClassLabel(combat)}</span>
          </div>
          <div class="shop-card-desc">${it.slot ? it.slot : it.type} · ${it.price.toLocaleString('en-US')} GP</div>
          ${req.html}
        </div>
      </div>
      <div class="shop-card-actions">
        <button type="button" class="shop-buy-btn" data-buy="${it.id}">${shopBuyLabel(it)}</button>
        ${batches}
      </div>
    `;
    bindItemTooltip(card, it);
    grid.appendChild(card);
  });

  const pack = body.querySelector('#shop-pack')!;
  if (STATE.inventory.length === 0) pack.innerHTML = `<div class="empty-note">Nothing to sell.</div>`;
  STATE.inventory.forEach((slot) => {
    const btn = slotButton(slot, 'sell');
    const unit = unitSellPrice(ITEMS[slot.id]);
    btn.title = `Sell for ${unit} GP each`;
    pack.appendChild(btn);
  });

  bindQty(body);
  const reportBuy = (result: { ok: boolean; moved: number; reason?: string; gp?: number }, name: string) => {
    if (!result.ok) bridge.chat(result.reason || 'Cannot buy that.', 'combat');
    else {
      bridge.coin();
      bridge.chat(`Bought ${result.moved.toLocaleString('en-US')} × <b>${name}</b> for ${result.gp?.toLocaleString('en-US')} GP.`, 'loot');
    }
    bridge.refresh();
  };
  body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((btn) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.buy || '';
      reportBuy(buyItem(STATE, id, STATE.transferQty), ITEMS[id]?.name || id);
    };
  });
  body.querySelectorAll<HTMLButtonElement>('[data-buy-batch]').forEach((btn) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.batchItem || '';
      const qty = Number(btn.dataset.buyBatch || 0);
      reportBuy(buyItem(STATE, id, qty), ITEMS[id]?.name || id);
    };
  });
  body.querySelectorAll<HTMLButtonElement>('[data-rune-pack]').forEach((btn) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const qty = Number(btn.dataset.runePack || 500);
      const result = buyRunePack(STATE, qty);
      if (!result.ok) bridge.chat(result.reason || 'Cannot buy that rune pack.', 'combat');
      else {
        bridge.coin();
        bridge.chat(`Bought a rune pack: <b>${qty.toLocaleString('en-US')}</b> of every rune (${result.moved.toLocaleString('en-US')} runes) for ${result.gp?.toLocaleString('en-US')} GP.`, 'loot');
      }
      bridge.refresh();
    };
  });
  body.querySelectorAll<HTMLButtonElement>('[data-action="sell"]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.item || '';
      const result = sellItem(STATE, id, STATE.transferQty);
      if (!result.ok) bridge.chat(result.reason || 'Cannot sell that.', 'combat');
      else {
        bridge.coin();
        bridge.chat(`Sold ${result.moved} × <b>${ITEMS[id]?.name}</b> for ${result.gp?.toLocaleString()} GP (65%).`, 'loot');
      }
      bridge.refresh();
    };
  });
}

let mapHighlight: string | null = null;

export function renderWorldMap(highlightId?: string | null): void {
  if (highlightId !== undefined) mapHighlight = highlightId;
  const grid = document.getElementById('worldmap-regions-grid');
  if (!grid) return;
  grid.innerHTML = '';
  (WORLD_REGIONS as RegionDef[]).forEach((reg) => {
    const known = isShrineDiscovered(STATE.shrines, reg.id);
    const card = document.createElement('div');
    const highlighted = mapHighlight === reg.id;
    card.className = 'shop-card' + (known ? '' : ' locked-card') + (highlighted ? ' region-target' : '');
    if (highlighted) card.id = 'region-target-card';
    const spell = SPELLS.find((s) => s.type === 'teleport' && s.regionId === reg.id);
    card.innerHTML = `
      <div>
        <div class="shop-card-name" style="color:${known ? reg.color : '#6b7280'}">${known ? reg.name : 'Undiscovered Shrine'}</div>
        <div class="shop-card-desc">${known ? reg.desc : 'A locked silhouette. Walk up to the shrine in the world to attune it. Magic teleports still follow spell level and runes.'}</div>
      </div>
    `;
    const mapBtn = document.createElement('button');
    mapBtn.className = 'shop-buy-btn';
    mapBtn.textContent = known ? 'Teleport to Shrine' : 'Locked';
    mapBtn.disabled = !known;
    mapBtn.onclick = () => {
      if (!known) {
        bridge.chat('That shrine is still a silhouette. Explore until you walk within range of it.', 'combat');
        return;
      }
      bridge.teleportSpell(reg.id);
      bridge.close();
    };
    card.appendChild(mapBtn);
    if (spell) {
      const note = document.createElement('div');
      note.className = 'shop-card-desc';
      const gate = canCastTeleport(STATE, spell.id);
      note.textContent = gate.ok
        ? `${spell.name} is ready in the Magic tab.`
        : `${spell.name}: ${gate.reason}`;
      card.appendChild(note);
    }
    grid.appendChild(card);
  });
}

export function renderQuests(): void {
  const host = document.getElementById('quest-list');
  if (!host) return;
  const task = STATE.quests.slayer;
  const taskLine = task && task.remaining > 0
    ? `<b>${task.name}</b> — ${task.remaining} / ${task.total} remaining`
    : 'No active task. Ask Vannaka for one.';
  const slayer = `
    <div class="quest-card slayer-card">
      <div class="quest-name">Slayer Master Vannaka</div>
      <div class="shop-card-desc">The purple-caped master waits in the Lumbridge courtyard. Matching kills count down your task and pay a bounty.</div>
      <div class="quest-progress">${taskLine}</div>
      <div class="shop-card-desc">Tasks completed: ${STATE.quests.slayerTasksCompleted} · Streak: ${STATE.quests.slayerStreak}</div>
      <div class="quest-actions">
        <button class="quest-claim" type="button" data-slayer="assign">${task && task.remaining > 0 ? 'View Task' : 'Get a Slayer Task'}</button>
      </div>
    </div>
  `;
  const cards = questView(STATE).map((quest) => {
    const steps = quest.steps.map((step) => `<li class="${step.met ? 'met' : ''}">${step.met ? '✓' : '○'} ${step.label}</li>`).join('');
    const claimLabel = quest.claimed ? 'Reward claimed' : 'Claim Reward';
    const disabled = quest.claimed || !quest.complete ? ' disabled' : '';
    return `
      <article class="quest-card ${quest.complete ? 'done' : ''}">
        <div class="quest-name">${quest.complete ? '✓' : '○'} ${quest.name}</div>
        <div class="shop-card-desc">${quest.lore}</div>
        <div class="quest-progress">${quest.done} / ${quest.total}</div>
        <ul class="quest-steps">${steps}</ul>
        <div class="quest-reward">Reward: ${quest.rewardText}</div>
        <div class="quest-actions">
          <button class="quest-claim" type="button" data-claim="${quest.id}"${disabled}>${claimLabel}</button>
          <button class="quest-locate" type="button" data-locate="${quest.region}">Locate on Map</button>
        </div>
      </article>
    `;
  }).join('');
  host.innerHTML = slayer + cards;
  host.querySelector<HTMLButtonElement>('[data-slayer]')?.addEventListener('click', () => bridge.requestSlayer());
  host.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) => {
    btn.addEventListener('click', () => bridge.claimQuest(btn.dataset.claim || ''));
  });
  host.querySelectorAll<HTMLButtonElement>('[data-locate]').forEach((btn) => {
    btn.addEventListener('click', () => bridge.locateRegion(btn.dataset.locate || ''));
  });
}

export function renderForge(): void {
  const grid = document.getElementById('smithing-recipes-grid');
  if (!grid) return;
  grid.innerHTML = '';
  FORGE_RECIPES.forEach((recipe) => {
    const out = recipe.output ? ITEMS[recipe.output] : null;
    const reqText = Object.entries(recipe.input).map(([id, qty]) => `${qty}× ${ITEMS[id]?.name || id} (${countItem(STATE, id)})`).join(', ');
    const lvl = STATE.skills[recipe.skill]?.lvl || 1;
    const ok = lvl >= recipe.req;
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.innerHTML = `
      <div class="shop-card-top">
        <div class="shop-card-icon">${out ? getItemSvg(out) : ''}</div>
        <div>
          <div class="shop-card-name">${recipe.name}</div>
          <div class="shop-card-desc" style="color:${ok ? '#4ade80' : '#f87171'}">Lv ${recipe.req} ${recipe.skill} (You: ${lvl}) · +${recipe.xp * STATE.xpMultiplier} XP</div>
          <div class="shop-card-desc">${reqText}</div>
        </div>
      </div>
      <button class="shop-buy-btn" data-craft="${recipe.id}">Craft</button>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.craft || '';
      const recipe = recipeById(id);
      if (!recipe) return;
      const result = (window as unknown as { craftRecipe?: (id: string) => void }).craftRecipe;
      if (result) result(id);
    };
  });
}

export function syncSettingsButtons(): void {
  const xp = document.getElementById('xp-rate-btn');
  if (xp) {
    xp.textContent = STATE.xpMultiplier === 10 ? '10x League XP' : '1x Classic XP';
    xp.classList.toggle('active', STATE.xpMultiplier === 10);
  }
  const audio = document.getElementById('audio-btn');
  if (audio) {
    audio.textContent = STATE.audioEnabled ? 'Audio On' : 'Audio Off';
    audio.classList.toggle('active', STATE.audioEnabled);
  }
  const time = document.getElementById('time-of-day-btn');
  if (time) {
    time.textContent = ['Golden Hour', 'High Noon', 'Starry Night'][STATE.timeOfDay] || 'Golden Hour';
  }
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

export function itemCompareHtml(it: ItemDef): string {
  if (it.type !== 'equip' || !it.slot) {
    const bits = [];
    if (it.heal) bits.push(`Heals +${it.heal}`);
    if (it.restorePrayer) bits.push(`Prayer +${it.restorePrayer}`);
    if (it.xp) bits.push(`Bury for ${it.xp} Prayer XP`);
    bits.push(`Value ${it.price} GP · sell ${unitSellPrice(it)} GP`);
    return `<div class="tip-title">${it.name}</div><div>${bits.join('<br>')}</div>`;
  }
  const equippedId = STATE.equipment[it.slot];
  const equipped = equippedId ? ITEMS[equippedId] : null;
  const keys = [
    ['atk', 'Attack'],
    ['str', 'Strength'],
    ['def', 'Defence'],
    ['rng', 'Ranged'],
    ['mag', 'Magic']
  ] as const;
  const rows = keys.map(([key, label]) => {
    const next = Number(it[key] || 0);
    const prev = Number(equipped?.[key] || 0);
    const delta = next - prev;
    const sign = delta > 0 ? '+' : '';
    const col = delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : '#d6c7ab';
    return `<div>${label} ${next} <b style="color:${col}">(${sign}${delta})</b></div>`;
  }).join('');
  const versus = equipped ? `vs ${equipped.name}` : 'vs empty slot';
  return `<div class="tip-title">${it.name}</div><div class="tip-sub">${it.slot} · ${versus}</div>${rows}`;
}
