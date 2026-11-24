export interface ScrollableNode {
  scrollTop: number;
}

export interface FocusRecord {
  id: string;
  start: number;
  end: number;
}

export interface ScrollSnapshot {
  scrolls: Record<string, number>;
  focus: FocusRecord | null;
}

export function takeSnapshot(
  nodes: Record<string, ScrollableNode | null | undefined>,
  focus?: FocusRecord | null,
): ScrollSnapshot {
  const scrolls: Record<string, number> = {};
  for (const [key, node] of Object.entries(nodes)) {
    if (node) {
      scrolls[key] = node.scrollTop;
    }
  }
  return {
    scrolls,
    focus: focus ? { id: focus.id, start: focus.start, end: focus.end } : null,
  };
}

export function restoreSnapshot(
  nodes: Record<string, ScrollableNode | null | undefined>,
  snap: ScrollSnapshot,
): FocusRecord | null {
  for (const [key, scrollTop] of Object.entries(snap.scrolls)) {
    const node = nodes[key];
    if (node) {
      node.scrollTop = scrollTop;
    }
  }
  return snap.focus;
}
