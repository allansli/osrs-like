import { describe, expect, it } from 'vitest';
import { loadAlbedo } from '../src/engine/textures';

// finding 29: one texture source per albedo id, one clone per id:repeat
describe('albedo texture cache', () => {
  it('shares one source between repeats and keeps each repeat on its own texture', () => {
    const a = loadAlbedo('grass', 3);
    const b = loadAlbedo('grass', 1.5);
    expect(a).not.toBe(b);
    expect(a.source).toBe(b.source);
    expect(a.repeat.x).toBe(3);
    expect(a.repeat.y).toBe(3);
    expect(b.repeat.x).toBe(1.5);
    expect(b.repeat.y).toBe(1.5);
  });

  it('returns the same object for the same id and repeat', () => {
    expect(loadAlbedo('iron', 2)).toBe(loadAlbedo('iron', 2));
  });

  it('does not share a source between different ids', () => {
    expect(loadAlbedo('grass', 3).source).not.toBe(loadAlbedo('iron', 3).source);
  });
});
