import { ITEMS, shopPrice } from '../data/items';
import { FORGE_RECIPES } from '../data/recipes';
import { RESOURCE_NODES_DEF } from '../data/world';
import { PRAYERS, SPELLS } from '../data/magic';

export interface Unlock {
  kind: 'gear' | 'recipe' | 'node' | 'prayer' | 'spell';
  name: string;
  id: string;
}

export function unlocksAt(skill: string, level: number): Unlock[] {
  const unlocks: Unlock[] = [];

  for (const item of Object.values(ITEMS)) {
    if (item.type === 'equip' && item.req && item.req[skill] === level) {
      unlocks.push({ kind: 'gear', name: item.name, id: item.id });
    }
  }

  for (const recipe of FORGE_RECIPES) {
    if (recipe.skill === skill && recipe.req === level) {
      unlocks.push({ kind: 'recipe', name: recipe.name, id: recipe.id });
    }
  }

  for (const [id, raw] of Object.entries(RESOURCE_NODES_DEF)) {
    const node = raw as { name: string; skill: string; req: number };
    if (node.skill === skill && node.req === level) {
      unlocks.push({ kind: 'node', name: node.name, id });
    }
  }

  if (skill === 'prayer') {
    for (const prayer of PRAYERS) {
      if (prayer.req === level) {
        unlocks.push({ kind: 'prayer', name: prayer.name, id: prayer.id });
      }
    }
  }

  if (skill === 'magic') {
    for (const spell of SPELLS) {
      if (spell.req === level) {
        unlocks.push({ kind: 'spell', name: spell.name, id: spell.id });
      }
    }
  }

  return unlocks;
}

export function forgeHint(itemId: string): string | null {
  const recipe = FORGE_RECIPES.find(
    (r) => r.output === itemId && (r.kind === 'smith' || r.kind === 'fletch')
  );
  if (!recipe) return null;

  const parts = Object.entries(recipe.input).map(([id, qty]) => {
    return `${qty} ${ITEMS[id].name}`;
  });

  return `forge: ${parts.join(', ')} at Smithing ${recipe.req}`;
}

export function unlockLine(
  skillName: string,
  level: number,
  unlocks: readonly Unlock[]
): string | null {
  if (unlocks.length === 0) return null;

  const formatEntry = (u: Unlock): string => {
    if (u.kind === 'gear') {
      const price = shopPrice(ITEMS[u.id]).toLocaleString('en-US');
      const hint = forgeHint(u.id);
      if (hint) {
        return `<b>${u.name}</b> (shop ${price} GP, or ${hint})`;
      }
      return `<b>${u.name}</b> (shop ${price} GP)`;
    }
    return `<b>${u.name}</b>`;
  };

  if (unlocks.length <= 3) {
    const formatted = unlocks.map(formatEntry).join(', ');
    return `Level ${level} ${skillName} unlocks: ${formatted}.`;
  }

  const shown = unlocks.slice(0, 3).map(formatEntry).join(', ');
  const remaining = unlocks.length - 3;
  return `Level ${level} ${skillName} unlocks: ${shown} and ${remaining} more.`;
}

/** One unlock line per level from fromLevel + 1 to toLevel that unlocks anything. */
export function levelUnlockLines(skill: string, skillName: string, fromLevel: number, toLevel: number): string[] {
  const lines: string[] = [];
  for (let level = fromLevel + 1; level <= toLevel; level++) {
    const line = unlockLine(skillName, level, unlocksAt(skill, level));
    if (line) lines.push(line);
  }
  return lines;
}
