import { describe, expect, it } from 'vitest';
import { restoreSnapshot, takeSnapshot } from '../src/ui/scrollSnapshot';

// Plan UI2 and UI6, finding 24. The contract UI6 must meet:
//   takeSnapshot(nodes, focus?)  nodes: Record<string, { scrollTop: number } | null>; focus: { id, start, end } | null
//   restoreSnapshot(nodes, snap) writes scrollTop back to nodes that exist and returns the focus record (or null)
//                                for the caller to re-apply to the DOM.
// Red until UI6.
type N = { scrollTop: number };

describe('scroll and focus snapshot', () => {
  it('round-trips scrollTop onto fresh nodes', () => {
    const snap = takeSnapshot({ '#bank-grid': { scrollTop: 340 }, '#bank-pack': { scrollTop: 12 } });
    const next: Record<string, N> = { '#bank-grid': { scrollTop: 0 }, '#bank-pack': { scrollTop: 0 } };
    restoreSnapshot(next, snap);
    expect(next['#bank-grid'].scrollTop).toBe(340);
    expect(next['#bank-pack'].scrollTop).toBe(12);
  });

  it('round-trips a focus record with its selection range', () => {
    const focus = { id: 'bank-search', start: 2, end: 5 };
    const snap = takeSnapshot({ '#bank-grid': { scrollTop: 1 } }, focus);
    expect(restoreSnapshot({ '#bank-grid': { scrollTop: 0 } }, snap)).toEqual(focus);
  });

  it('returns null when nothing was focused', () => {
    const snap = takeSnapshot({ '#shop-pack': { scrollTop: 9 } });
    expect(restoreSnapshot({ '#shop-pack': { scrollTop: 0 } }, snap)).toBeNull();
    expect(restoreSnapshot({ '#shop-pack': { scrollTop: 0 } }, takeSnapshot({}, null))).toBeNull();
  });

  it('the snapshot is a copy: later scrolling does not change it', () => {
    const live: N = { scrollTop: 100 };
    const snap = takeSnapshot({ a: live });
    live.scrollTop = 0;
    const next: Record<string, N> = { a: { scrollTop: 0 } };
    restoreSnapshot(next, snap);
    expect(next.a.scrollTop).toBe(100);
  });

  it('skips nodes that are missing at take or at restore', () => {
    const snap = takeSnapshot({ a: { scrollTop: 5 }, gone: null });
    const next: Record<string, N | null> = { a: { scrollTop: 0 }, gone: { scrollTop: 7 } };
    expect(() => restoreSnapshot(next, snap)).not.toThrow();
    expect(next.a!.scrollTop).toBe(5);
    expect(next.gone!.scrollTop).toBe(7); // not in the snapshot, left alone
    expect(() => restoreSnapshot({ a: null }, snap)).not.toThrow();
    expect(() => restoreSnapshot({}, snap)).not.toThrow();
  });
});
