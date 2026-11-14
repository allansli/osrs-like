export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (!node) {
    throw new Error(`missing #${id}`);
  }
  return node as T;
}
