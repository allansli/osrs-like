import { ITEMS, isStackableInBackpack, isStackableInBank, unitSellPrice } from '../data/items';
import { BACKPACK_SIZE, BANK_CAPACITY } from './gameState';
import type { GameState, ItemStack, QtyMode } from './types';

export function resolveQty(mode: QtyMode, available: number): number {
  if (available <= 0) return 0;
  if (mode === 'all') return available;
  return Math.min(mode, available);
}

export function countIn(slots: ItemStack[], itemId: string): number {
  let total = 0;
  for (const slot of slots) {
    if (slot && slot.id === itemId) total += slot.qty || 0;
  }
  return total;
}

export function countItem(state: GameState, itemId: string): number {
  return countIn(state.inventory, itemId);
}

function canPlace(slots: ItemStack[], itemId: string, qty: number, stackable: boolean, capacity: number): boolean {
  if (qty <= 0) return true;
  if (stackable) {
    if (slots.some((s) => s.id === itemId)) return true;
    return slots.length < capacity;
  }
  return slots.length + qty <= capacity;
}

function place(slots: ItemStack[], itemId: string, qty: number, stackable: boolean, capacity: number): number {
  if (qty <= 0) return 0;
  if (stackable) {
    const existing = slots.find((s) => s.id === itemId);
    if (existing) {
      existing.qty += qty;
      return qty;
    }
    if (slots.length >= capacity) return 0;
    slots.push({ id: itemId, qty });
    return qty;
  }
  const free = capacity - slots.length;
  const n = Math.min(qty, Math.max(0, free));
  for (let i = 0; i < n; i++) slots.push({ id: itemId, qty: 1 });
  return n;
}

export function removeFrom(slots: ItemStack[], itemId: string, qty: number): number {
  let left = qty;
  for (let i = 0; i < slots.length && left > 0; ) {
    const slot = slots[i];
    if (!slot || slot.id !== itemId) {
      i++;
      continue;
    }
    const take = Math.min(slot.qty, left);
    slot.qty -= take;
    left -= take;
    if (slot.qty <= 0) slots.splice(i, 1);
    else i++;
  }
  return qty - left;
}

export function compactSlots(raw: ItemStack[] | undefined, bank: boolean): ItemStack[] {
  const out: ItemStack[] = [];
  const capacity = bank ? BANK_CAPACITY : 10000;
  if (!Array.isArray(raw)) return out;
  for (const slot of raw) {
    if (!slot || !ITEMS[slot.id]) continue;
    const qty = Math.max(1, Math.floor(Number(slot.qty) || 1));
    const item = ITEMS[slot.id];
    const stackable = bank ? isStackableInBank(item) : isStackableInBackpack(item);
    place(out, slot.id, qty, stackable, capacity);
  }
  return bank ? out : out.slice(0, BACKPACK_SIZE);
}

export function canAddItem(state: GameState, itemId: string, qty = 1): boolean {
  const item = ITEMS[itemId];
  if (!item || qty <= 0) return false;
  return canPlace(state.inventory, itemId, qty, isStackableInBackpack(item), BACKPACK_SIZE);
}

export function addItem(state: GameState, itemId: string, qty = 1): { ok: boolean; added: number } {
  const item = ITEMS[itemId];
  if (!item || qty <= 0) return { ok: false, added: 0 };
  const added = place(state.inventory, itemId, qty, isStackableInBackpack(item), BACKPACK_SIZE);
  return { ok: added === qty, added };
}

export function removeItem(state: GameState, itemId: string, qty = 1): number {
  return removeFrom(state.inventory, itemId, qty);
}

export interface TransferResult {
  ok: boolean;
  moved: number;
  reason?: string;
  gp?: number;
  unit?: number;
}

export function deposit(state: GameState, itemId: string, mode: QtyMode): TransferResult {
  const have = countIn(state.inventory, itemId);
  const n = resolveQty(mode, have);
  if (n <= 0) return { ok: false, moved: 0, reason: 'Nothing to deposit.' };
  if (!canPlace(state.bank, itemId, n, true, BANK_CAPACITY)) {
    return { ok: false, moved: 0, reason: 'The bank vault is full.' };
  }
  removeFrom(state.inventory, itemId, n);
  place(state.bank, itemId, n, true, BANK_CAPACITY);
  return { ok: true, moved: n };
}

export function withdraw(state: GameState, itemId: string, mode: QtyMode): TransferResult {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, moved: 0, reason: 'Unknown item.' };
  const have = countIn(state.bank, itemId);
  let n = resolveQty(mode, have);
  if (n <= 0) return { ok: false, moved: 0, reason: 'Nothing to withdraw.' };
  const stackable = isStackableInBackpack(item);
  if (!stackable) {
    const free = BACKPACK_SIZE - state.inventory.length;
    if (free <= 0) return { ok: false, moved: 0, reason: 'Your backpack is full.' };
    n = Math.min(n, free);
  } else if (!canPlace(state.inventory, itemId, n, true, BACKPACK_SIZE)) {
    return { ok: false, moved: 0, reason: 'Your backpack is full.' };
  }
  removeFrom(state.bank, itemId, n);
  place(state.inventory, itemId, n, stackable, BACKPACK_SIZE);
  return { ok: true, moved: n };
}

export function buyItem(state: GameState, itemId: string, mode: QtyMode): TransferResult {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, moved: 0, reason: 'Unknown item.' };
  const price = item.price || 0;
  if (price <= 0) return { ok: false, moved: 0, reason: 'That cannot be bought.' };
  const affordable = Math.floor(state.gp / price);
  let want = resolveQty(mode, affordable);
  if (want <= 0) return { ok: false, moved: 0, reason: `You need ${price.toLocaleString()} GP to buy ${item.name}.` };
  const stackable = isStackableInBackpack(item);
  if (!stackable) {
    want = Math.min(want, BACKPACK_SIZE - state.inventory.length);
  } else if (!canPlace(state.inventory, itemId, want, true, BACKPACK_SIZE)) {
    want = 0;
  }
  if (want <= 0) return { ok: false, moved: 0, reason: 'Your backpack is full.' };
  state.gp -= price * want;
  place(state.inventory, itemId, want, stackable, BACKPACK_SIZE);
  return { ok: true, moved: want, gp: price * want, unit: price };
}

export function sellItem(state: GameState, itemId: string, mode: QtyMode): TransferResult {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, moved: 0, reason: 'Unknown item.' };
  const have = countIn(state.inventory, itemId);
  const n = resolveQty(mode, have);
  if (n <= 0) return { ok: false, moved: 0, reason: 'Nothing to sell.' };
  const unit = unitSellPrice(item);
  removeFrom(state.inventory, itemId, n);
  const gp = unit * n;
  state.gp += gp;
  return { ok: true, moved: n, gp, unit };
}
