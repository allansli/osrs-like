import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { G } from '../src/engine/context';
import { buildTerrainAndWater } from '../src/engine/worldMesh';
import { TERRAIN_SEGMENTS } from '../src/state/terrain';

// telegraphs.ts gridHeight assumes three's stock quad split on every cell (A11.3).
describe('the game terrain keeps the stock quad diagonal', () => {
  it('index buffer equals a stock PlaneGeometry of the same size', () => {
    G.scene = new THREE.Scene();
    G.worldInteractiveObjects = [];
    buildTerrainAndWater();
    const stock = new THREE.PlaneGeometry(1, 1, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    expect(Array.from(G.terrainMesh!.geometry.index!.array)).toEqual(Array.from(stock.index!.array));
  });
});
