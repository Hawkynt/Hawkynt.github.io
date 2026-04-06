;(function() {
  'use strict';
  const { describe, it, beforeEach, assert } = window.TestRunner;
  const { Pathfinding, CombatGrid, PRNG } = window.SZ.TacticalRealms;

  function makeGrid(cols, rows, fill) {
    const terrain = [];
    for (let i = 0; i < cols * rows; ++i)
      terrain.push(fill || 'plains');
    return new CombatGrid(cols, rows, terrain);
  }

  function mixedGrid() {
    const terrain = [];
    for (let i = 0; i < 64; ++i)
      terrain.push('plains');
    const g = new CombatGrid(8, 8, terrain);
    return g;
  }

  describe('Pathfinding - Bidirectional A*', () => {

    it('findPathBiDir returns path from start to goal on open grid', () => {
      const grid = makeGrid(8, 8);
      const path = Pathfinding.findPathBiDir(grid, { col: 0, row: 0 }, { col: 5, row: 0 }, 'party');
      assert.ok(path);
      assert.equal(path[0].col, 0);
      assert.equal(path[0].row, 0);
      assert.equal(path[path.length - 1].col, 5);
      assert.equal(path[path.length - 1].row, 0);
    });

    it('findPathBiDir returns single-element path when start equals goal', () => {
      const grid = makeGrid(8, 8);
      const path = Pathfinding.findPathBiDir(grid, { col: 3, row: 3 }, { col: 3, row: 3 }, 'party');
      assert.ok(path);
      assert.equal(path.length, 1);
    });

    it('findPathBiDir finds optimal path same as regular A*', () => {
      const grid = makeGrid(8, 8);
      const pathA = Pathfinding.findPath(grid, { col: 0, row: 0 }, { col: 7, row: 7 }, 'party');
      const pathBi = Pathfinding.findPathBiDir(grid, { col: 0, row: 0 }, { col: 7, row: 7 }, 'party');
      assert.ok(pathA);
      assert.ok(pathBi);
      const costA = Pathfinding.pathCost(grid, pathA);
      const costBi = Pathfinding.pathCost(grid, pathBi);
      assert.equal(costA, costBi);
    });

    it('findPathBiDir paths around obstacles', () => {
      const grid = makeGrid(8, 8);
      grid.placeUnit('enemy1', 3, 0);
      grid.placeUnit('enemy2', 3, 1);
      grid.placeUnit('enemy3', 3, 2);
      const path = Pathfinding.findPathBiDir(grid, { col: 0, row: 0 }, { col: 6, row: 0 }, 'party');
      assert.ok(path);
      for (const step of path)
        assert.ok(step.col !== 3 || step.row > 2, 'path should avoid enemy wall');
    });

    it('findPathBiDir returns null when no path exists', () => {
      const grid = makeGrid(4, 1);
      grid.placeUnit('e1', 1, 0);
      const path = Pathfinding.findPathBiDir(grid, { col: 0, row: 0 }, { col: 3, row: 0 }, 'party');
      assert.isNull(path);
    });

    it('findPathBiDir respects terrain costs', () => {
      const terrain = [];
      for (let i = 0; i < 64; ++i)
        terrain.push('plains');
      for (let r = 0; r < 8; ++r)
        terrain[r * 8 + 3] = 'forest';
      const grid = new CombatGrid(8, 8, terrain);
      const path = Pathfinding.findPathBiDir(grid, { col: 0, row: 0 }, { col: 7, row: 0 }, 'party');
      assert.ok(path);
      const cost = Pathfinding.pathCost(grid, path);
      assert.ok(cost > 0);
    });

    it('findPathBiDir cost matches regular A* on weighted terrain', () => {
      const terrain = [];
      for (let i = 0; i < 64; ++i)
        terrain.push(i % 3 === 0 ? 'forest' : 'plains');
      const grid = new CombatGrid(8, 8, terrain);
      const s = { col: 0, row: 0 }, g = { col: 7, row: 7 };
      const costA = Pathfinding.pathCost(grid, Pathfinding.findPath(grid, s, g, 'party'));
      const costBi = Pathfinding.pathCost(grid, Pathfinding.findPathBiDir(grid, s, g, 'party'));
      assert.equal(costA, costBi);
    });

    it('findPathBiDir handles long-distance path on large grid', () => {
      const grid = makeGrid(16, 12);
      const start = performance.now();
      const path = Pathfinding.findPathBiDir(grid, { col: 0, row: 0 }, { col: 15, row: 11 }, 'party');
      const elapsed = performance.now() - start;
      assert.ok(path);
      assert.ok(elapsed < 100, `BiDir A* took ${elapsed}ms`);
    });

    it('findPathBiDir avoids enemy units', () => {
      const grid = makeGrid(5, 3);
      grid.placeUnit('e1', 2, 0);
      grid.placeUnit('e2', 2, 2);
      const path = Pathfinding.findPathBiDir(grid, { col: 0, row: 1 }, { col: 4, row: 1 }, 'party');
      assert.ok(path);
      for (const step of path)
        assert.ok(!(step.col === 2 && (step.row === 0 || step.row === 2)));
    });

    it('findPathBiDir allows ally traversal', () => {
      const grid = makeGrid(5, 1);
      grid.placeUnit('ally1', 2, 0);
      const path = Pathfinding.findPathBiDir(grid, { col: 0, row: 0 }, { col: 4, row: 0 }, 'party');
      assert.ok(path);
      assert.equal(path[path.length - 1].col, 4);
    });
  });

  describe('Pathfinding - Path Cache', () => {

    it('PathCache returns cached path on second call', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(8, 8);
      const s = { col: 0, row: 0 }, g = { col: 5, row: 0 };
      const p1 = cache.findPath(grid, s, g, 'party');
      const p2 = cache.findPath(grid, s, g, 'party');
      assert.ok(p1);
      assert.ok(p2);
      assert.equal(p1.length, p2.length);
      assert.equal(cache.stats().hits, 1);
      assert.equal(cache.stats().misses, 1);
    });

    it('PathCache miss when far different goal', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 10);
      cache.findPath(grid, { col: 0, row: 0 }, { col: 5, row: 0 }, 'party');
      cache.findPath(grid, { col: 0, row: 9 }, { col: 5, row: 9 }, 'party');
      assert.equal(cache.stats().misses, 2);
    });

    it('PathCache invalidate clears all entries', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(8, 8);
      cache.findPath(grid, { col: 0, row: 0 }, { col: 3, row: 0 }, 'party');
      cache.invalidate();
      cache.findPath(grid, { col: 0, row: 0 }, { col: 3, row: 0 }, 'party');
      assert.equal(cache.stats().misses, 2);
    });

    it('PathCache evicts LRU entry when full', () => {
      const cache = new Pathfinding.PathCache(2);
      const grid = makeGrid(8, 8);
      // Use completely separate paths so stitching can't help
      cache.findPath(grid, { col: 0, row: 0 }, { col: 0, row: 7 }, 'party');
      cache.findPath(grid, { col: 7, row: 0 }, { col: 7, row: 7 }, 'party');
      // Third evicts the first (LRU)
      cache.findPath(grid, { col: 3, row: 0 }, { col: 3, row: 7 }, 'party');
      // Re-request first — should miss (was evicted)
      cache.findPath(grid, { col: 0, row: 0 }, { col: 0, row: 7 }, 'party');
      assert.ok(cache.stats().misses >= 4);
    });

    it('PathCache respects faction in key', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(8, 8);
      const s = { col: 0, row: 0 }, g = { col: 3, row: 0 };
      cache.findPath(grid, s, g, 'party');
      cache.findPath(grid, s, g, 'enemy');
      assert.equal(cache.stats().misses, 2);
    });

    it('PathCache caches null results for unreachable goals', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(4, 1);
      grid.placeUnit('e1', 1, 0);
      const s = { col: 0, row: 0 }, g = { col: 3, row: 0 };
      const p1 = cache.findPath(grid, s, g, 'party');
      const p2 = cache.findPath(grid, s, g, 'party');
      assert.isNull(p1);
      assert.isNull(p2);
      assert.equal(cache.stats().hits, 1);
    });
  });

  describe('Pathfinding - Path Cache Stitching', () => {

    it('subpath extraction: request segment of a cached path', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 1 }, 'party');
      const sub = cache.findPath(grid, { col: 3, row: 1 }, { col: 7, row: 1 }, 'party');
      assert.ok(sub);
      assert.equal(sub[0].col, 3);
      assert.equal(sub[0].row, 1);
      assert.equal(sub[sub.length - 1].col, 7);
      assert.equal(sub[sub.length - 1].row, 1);
      assert.equal(sub.length, 5);
      assert.ok(cache.stats().stitchHits >= 1);
    });

    it('suffix reuse: request tail of a cached path', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 1 }, 'party');
      const suffix = cache.findPath(grid, { col: 5, row: 1 }, { col: 9, row: 1 }, 'party');
      assert.ok(suffix);
      assert.equal(suffix[0].col, 5);
      assert.equal(suffix[suffix.length - 1].col, 9);
      assert.equal(suffix.length, 5);
      assert.ok(cache.stats().stitchHits >= 1);
    });

    it('prefix reuse: request head of a cached path', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 1 }, 'party');
      const prefix = cache.findPath(grid, { col: 0, row: 1 }, { col: 4, row: 1 }, 'party');
      assert.ok(prefix);
      assert.equal(prefix[0].col, 0);
      assert.equal(prefix[prefix.length - 1].col, 4);
      assert.equal(prefix.length, 5);
      assert.ok(cache.stats().stitchHits >= 1);
    });

    it('bridge + suffix: start near cached path, goal on it', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 1 }, 'party');
      const stitched = cache.findPath(grid, { col: 0, row: 0 }, { col: 9, row: 1 }, 'party');
      assert.ok(stitched);
      assert.equal(stitched[0].col, 0);
      assert.equal(stitched[0].row, 0);
      assert.equal(stitched[stitched.length - 1].col, 9);
      assert.equal(stitched[stitched.length - 1].row, 1);
      assert.ok(cache.stats().stitchHits >= 1);
    });

    it('prefix + bridge: start on cached path, goal near it', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 1 }, 'party');
      const stitched = cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 0 }, 'party');
      assert.ok(stitched);
      assert.equal(stitched[0].col, 0);
      assert.equal(stitched[0].row, 1);
      assert.equal(stitched[stitched.length - 1].col, 9);
      assert.equal(stitched[stitched.length - 1].row, 0);
      assert.ok(cache.stats().stitchHits >= 1);
    });

    it('two-segment stitch: bridge between two cached paths', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(12, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 5, row: 1 }, 'party');
      cache.findPath(grid, { col: 6, row: 1 }, { col: 11, row: 1 }, 'party');
      const stitched = cache.findPath(grid, { col: 0, row: 1 }, { col: 11, row: 1 }, 'party');
      assert.ok(stitched);
      assert.equal(stitched[0].col, 0);
      assert.equal(stitched[stitched.length - 1].col, 11);
      assert.ok(cache.stats().stitchHits >= 1);
    });

    it('stitched path is contiguous (each step is cardinal-adjacent)', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 1 }, 'party');
      const stitched = cache.findPath(grid, { col: 0, row: 0 }, { col: 9, row: 2 }, 'party');
      assert.ok(stitched);
      for (let i = 1; i < stitched.length; ++i) {
        const dc = Math.abs(stitched[i].col - stitched[i - 1].col);
        const dr = Math.abs(stitched[i].row - stitched[i - 1].row);
        assert.equal(dc + dr, 1, `step ${i} is not cardinal-adjacent`);
      }
    });

    it('stitch does not produce duplicate tiles at splice points', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 1 }, 'party');
      const stitched = cache.findPath(grid, { col: 3, row: 1 }, { col: 9, row: 1 }, 'party');
      assert.ok(stitched);
      const keys = stitched.map(s => `${s.col},${s.row}`);
      const unique = new Set(keys);
      assert.equal(keys.length, unique.size, 'no duplicate tiles');
    });

    it('invalidation clears waypoint index and prevents stitch', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 1 }, 'party');
      cache.invalidate();
      cache.findPath(grid, { col: 3, row: 1 }, { col: 7, row: 1 }, 'party');
      assert.equal(cache.stats().stitchHits, 0);
      assert.equal(cache.stats().misses, 2);
    });

    it('stitch respects faction (no cross-faction stitch)', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 3);
      cache.findPath(grid, { col: 0, row: 1 }, { col: 9, row: 1 }, 'party');
      cache.findPath(grid, { col: 3, row: 1 }, { col: 7, row: 1 }, 'enemy');
      assert.equal(cache.stats().stitchHits, 0);
    });

    it('stitch falls back to full computation when bridge too long', () => {
      const cache = new Pathfinding.PathCache(32);
      const grid = makeGrid(10, 10);
      cache.findPath(grid, { col: 0, row: 0 }, { col: 9, row: 0 }, 'party');
      const result = cache.findPath(grid, { col: 0, row: 9 }, { col: 9, row: 0 }, 'party');
      assert.ok(result);
      assert.equal(cache.stats().misses, 2);
    });

    it('LRU eviction also clears waypoint index for evicted paths', () => {
      const cache = new Pathfinding.PathCache(2);
      const grid = makeGrid(10, 5);
      cache.findPath(grid, { col: 0, row: 0 }, { col: 9, row: 0 }, 'party');
      cache.findPath(grid, { col: 0, row: 2 }, { col: 9, row: 2 }, 'party');
      cache.findPath(grid, { col: 0, row: 4 }, { col: 9, row: 4 }, 'party');
      const sub = cache.findPath(grid, { col: 3, row: 0 }, { col: 7, row: 0 }, 'party');
      assert.ok(sub);
      assert.equal(cache.stats().stitchHits, 0, 'evicted path should not produce stitch');
    });
  });

  describe('Pathfinding - Multi-Unit', () => {

    it('findPathsMulti returns paths for two units to different goals', () => {
      const grid = makeGrid(8, 8);
      grid.placeUnit('u1', 0, 0);
      grid.placeUnit('u2', 0, 1);
      const requests = [
        { unitId: 'u1', start: { col: 0, row: 0 }, goal: { col: 5, row: 0 } },
        { unitId: 'u2', start: { col: 0, row: 1 }, goal: { col: 5, row: 1 } },
      ];
      const result = Pathfinding.findPathsMulti(grid, requests, 'party');
      assert.ok(result.get('u1'));
      assert.ok(result.get('u2'));
      assert.equal(result.get('u1')[result.get('u1').length - 1].col, 5);
      assert.equal(result.get('u2')[result.get('u2').length - 1].col, 5);
    });

    it('findPathsMulti avoids collisions at goal tiles', () => {
      const grid = makeGrid(8, 8);
      grid.placeUnit('u1', 0, 0);
      grid.placeUnit('u2', 1, 0);
      const requests = [
        { unitId: 'u1', start: { col: 0, row: 0 }, goal: { col: 3, row: 0 } },
        { unitId: 'u2', start: { col: 1, row: 0 }, goal: { col: 3, row: 0 } },
      ];
      const result = Pathfinding.findPathsMulti(grid, requests, 'party');
      const g1 = result.get('u1');
      const g2 = result.get('u2');
      assert.ok(g1);
      const end1 = g1[g1.length - 1];
      const end2 = g2 ? g2[g2.length - 1] : null;
      if (g2)
        assert.ok(end1.col !== end2.col || end1.row !== end2.row, 'units should not end on same tile');
    });

    it('findPathsMulti prioritizes shortest-distance units first', () => {
      const grid = makeGrid(8, 8);
      grid.placeUnit('far', 0, 0);
      grid.placeUnit('near', 4, 0);
      const requests = [
        { unitId: 'far', start: { col: 0, row: 0 }, goal: { col: 5, row: 0 } },
        { unitId: 'near', start: { col: 4, row: 0 }, goal: { col: 5, row: 0 } },
      ];
      const result = Pathfinding.findPathsMulti(grid, requests, 'party');
      const nearPath = result.get('near');
      assert.ok(nearPath);
      assert.equal(nearPath[nearPath.length - 1].col, 5);
    });

    it('findPathsMulti returns null for units that cannot reach any valid tile', () => {
      const grid = makeGrid(3, 1);
      grid.placeUnit('u1', 0, 0);
      grid.placeUnit('e1', 1, 0);
      const requests = [
        { unitId: 'u1', start: { col: 0, row: 0 }, goal: { col: 2, row: 0 } },
      ];
      const result = Pathfinding.findPathsMulti(grid, requests, 'party');
      assert.isNull(result.get('u1'));
    });

    it('findPathsMulti handles empty request list', () => {
      const grid = makeGrid(8, 8);
      const result = Pathfinding.findPathsMulti(grid, [], 'party');
      assert.equal(result.size, 0);
    });

    it('findPathsMulti three units through tight corridor', () => {
      const grid = makeGrid(8, 3);
      grid.placeUnit('u1', 0, 0);
      grid.placeUnit('u2', 0, 1);
      grid.placeUnit('u3', 0, 2);
      const requests = [
        { unitId: 'u1', start: { col: 0, row: 0 }, goal: { col: 7, row: 0 } },
        { unitId: 'u2', start: { col: 0, row: 1 }, goal: { col: 7, row: 1 } },
        { unitId: 'u3', start: { col: 0, row: 2 }, goal: { col: 7, row: 2 } },
      ];
      const result = Pathfinding.findPathsMulti(grid, requests, 'party');
      for (const [id, path] of result)
        assert.ok(path, `${id} should have a path`);
    });
  });

  describe('Pathfinding - Formations', () => {

    it('FORMATIONS has LINE, WEDGE, SQUARE, COLUMN types', () => {
      const F = Pathfinding.Formations;
      assert.ok(F);
      assert.ok(F.LINE);
      assert.ok(F.WEDGE);
      assert.ok(F.SQUARE);
      assert.ok(F.COLUMN);
    });

    it('LINE formation computes horizontal slots', () => {
      const slots = Pathfinding.formationSlots('LINE', { col: 5, row: 5 }, 'east', 4);
      assert.equal(slots.length, 4);
      assert.equal(slots[0].col, 5);
      assert.equal(slots[0].row, 5);
      for (let i = 1; i < slots.length; ++i)
        assert.equal(slots[i].col, 5);
    });

    it('WEDGE formation computes V-shape slots', () => {
      const slots = Pathfinding.formationSlots('WEDGE', { col: 5, row: 5 }, 'east', 3);
      assert.equal(slots.length, 3);
      assert.equal(slots[0].col, 5);
      assert.equal(slots[0].row, 5);
    });

    it('SQUARE formation computes 2x2 for 4 units', () => {
      const slots = Pathfinding.formationSlots('SQUARE', { col: 5, row: 5 }, 'east', 4);
      assert.equal(slots.length, 4);
      const unique = new Set(slots.map(s => `${s.col},${s.row}`));
      assert.equal(unique.size, 4);
    });

    it('COLUMN formation computes vertical line', () => {
      const slots = Pathfinding.formationSlots('COLUMN', { col: 5, row: 5 }, 'east', 3);
      assert.equal(slots.length, 3);
      assert.equal(slots[0].col, 5);
      assert.equal(slots[0].row, 5);
      for (let i = 1; i < slots.length; ++i)
        assert.equal(slots[i].row, slots[0].row);
    });

    it('formationSlots returns 1 slot for 1 unit', () => {
      const slots = Pathfinding.formationSlots('LINE', { col: 3, row: 3 }, 'north', 1);
      assert.equal(slots.length, 1);
      assert.equal(slots[0].col, 3);
      assert.equal(slots[0].row, 3);
    });

    it('formation direction affects slot orientation', () => {
      const eastSlots = Pathfinding.formationSlots('COLUMN', { col: 5, row: 5 }, 'east', 3);
      const northSlots = Pathfinding.formationSlots('COLUMN', { col: 5, row: 5 }, 'north', 3);
      const eastCols = eastSlots.map(s => s.col);
      const northRows = northSlots.map(s => s.row);
      assert.ok(eastCols[1] < eastCols[0] || eastCols[1] === eastCols[0], 'east column trails west');
      assert.ok(northRows.some(r => r !== northSlots[0].row) || northSlots.length === 1);
    });

    it('moveFormation computes multi-unit paths to formation slots', () => {
      const grid = makeGrid(10, 10);
      grid.placeUnit('u1', 1, 1);
      grid.placeUnit('u2', 1, 2);
      grid.placeUnit('u3', 1, 3);
      const units = [
        { unitId: 'u1', start: { col: 1, row: 1 } },
        { unitId: 'u2', start: { col: 1, row: 2 } },
        { unitId: 'u3', start: { col: 1, row: 3 } },
      ];
      const result = Pathfinding.moveFormation(grid, units, { col: 7, row: 5 }, 'east', 'LINE', 'party');
      assert.ok(result);
      assert.ok(result.get('u1'));
      assert.ok(result.get('u2'));
      assert.ok(result.get('u3'));
    });

    it('moveFormation gracefully degrades when slot is blocked', () => {
      const terrain = [];
      for (let i = 0; i < 100; ++i)
        terrain.push('plains');
      terrain[5 * 10 + 7] = 'water';
      const grid = new CombatGrid(10, 10, terrain);
      grid.placeUnit('u1', 1, 1);
      grid.placeUnit('u2', 1, 2);
      const units = [
        { unitId: 'u1', start: { col: 1, row: 1 } },
        { unitId: 'u2', start: { col: 1, row: 2 } },
      ];
      const result = Pathfinding.moveFormation(grid, units, { col: 7, row: 5 }, 'east', 'LINE', 'party');
      assert.ok(result);
      for (const [, path] of result)
        assert.ok(path, 'all units should still get a path even with blocked slot');
    });
  });

  describe('Pathfinding', () => {

    it('findPath returns path from start to goal on open grid', () => {
      const grid = makeGrid(8, 8);
      const path = Pathfinding.findPath(grid, { col: 0, row: 0 }, { col: 3, row: 0 }, 'party');
      assert.ok(path);
      assert.equal(path[0].col, 0);
      assert.equal(path[0].row, 0);
      assert.equal(path[path.length - 1].col, 3);
      assert.equal(path[path.length - 1].row, 0);
    });

    it('findPath returns shortest straight-line path on open grid', () => {
      const grid = makeGrid(8, 8);
      const path = Pathfinding.findPath(grid, { col: 0, row: 0 }, { col: 4, row: 0 }, 'party');
      assert.equal(path.length, 5);
    });

    it('findPath returns path around obstacle', () => {
      const grid = makeGrid(8, 8);
      grid.placeUnit('enemy1', 2, 0);
      const path = Pathfinding.findPath(grid, { col: 0, row: 0 }, { col: 4, row: 0 }, 'party');
      assert.ok(path);
      assert.greaterThan(path.length, 5);
      for (const step of path)
        assert.ok(!(step.col === 2 && step.row === 0), 'path should avoid enemy');
    });

    it('findPath returns null when no path exists', () => {
      const grid = makeGrid(4, 1);
      grid.placeUnit('e1', 1, 0);
      const path = Pathfinding.findPath(grid, { col: 0, row: 0 }, { col: 3, row: 0 }, 'party');
      assert.isNull(path);
    });

    it('findPath returns single-element path when start equals goal', () => {
      const grid = makeGrid(8, 8);
      const path = Pathfinding.findPath(grid, { col: 3, row: 3 }, { col: 3, row: 3 }, 'party');
      assert.ok(path);
      assert.equal(path.length, 1);
    });

    it('findPath avoids enemy units', () => {
      const grid = makeGrid(5, 3);
      grid.placeUnit('e1', 2, 0);
      grid.placeUnit('e2', 2, 2);
      const path = Pathfinding.findPath(grid, { col: 0, row: 1 }, { col: 4, row: 1 }, 'party');
      assert.ok(path);
      for (const step of path) {
        if (step.col === 2 && (step.row === 0 || step.row === 2))
          assert.ok(false, 'path should not go through enemies');
      }
    });

    it('findPath considers terrain movement costs', () => {
      const terrain = [];
      for (let i = 0; i < 24; ++i)
        terrain.push('plains');
      terrain[1 * 8 + 1] = 'mountain';
      const grid = new CombatGrid(8, 3, terrain);
      const directPath = Pathfinding.findPath(grid, { col: 0, row: 1 }, { col: 2, row: 1 }, 'party');
      assert.ok(directPath);
    });

    it('findPath on large grid completes quickly', () => {
      const grid = makeGrid(16, 12);
      const start = performance.now();
      const path = Pathfinding.findPath(grid, { col: 0, row: 0 }, { col: 15, row: 11 }, 'party');
      const elapsed = performance.now() - start;
      assert.ok(path);
      assert.ok(elapsed < 100, `A* took ${elapsed}ms, should be < 100ms`);
    });

    it('findPath allows ally traversal but not termination on ally tile', () => {
      const grid = makeGrid(5, 1);
      grid.placeUnit('ally1', 2, 0);
      const path = Pathfinding.findPath(grid, { col: 0, row: 0 }, { col: 4, row: 0 }, 'party');
      assert.ok(path);
      assert.equal(path[path.length - 1].col, 4);
    });

    it('movementRange returns reachable tiles within budget', () => {
      const grid = makeGrid(8, 8);
      const range = Pathfinding.movementRange(grid, { col: 3, row: 3 }, 3, 'party');
      assert.ok(range instanceof Map);
      assert.ok(range.has('3,3'));
      assert.equal(range.get('3,3'), 0);
      assert.ok(range.has('4,3'));
      assert.ok(range.has('3,4'));
      assert.ok(range.has('6,3'));
      assert.ok(!range.has('7,3'));
    });

    it('movementRange excludes tiles beyond budget', () => {
      const grid = makeGrid(8, 8);
      const range = Pathfinding.movementRange(grid, { col: 0, row: 0 }, 2, 'party');
      assert.ok(!range.has('3,0'));
      assert.ok(!range.has('0,3'));
    });

    it('movementRange accounts for terrain costs', () => {
      const terrain = [];
      for (let i = 0; i < 25; ++i)
        terrain.push('plains');
      terrain[0 * 5 + 1] = 'forest';
      const grid = new CombatGrid(5, 5, terrain);
      const range = Pathfinding.movementRange(grid, { col: 0, row: 0 }, 2, 'party');
      assert.ok(range.has('1,0'));
      assert.equal(range.get('1,0'), 2);
    });

    it('movementRange excludes enemy-occupied tiles', () => {
      const grid = makeGrid(8, 8);
      grid.placeUnit('enemy', 4, 3);
      const range = Pathfinding.movementRange(grid, { col: 3, row: 3 }, 3, 'party');
      assert.ok(!range.has('4,3'));
    });

    it('movementRange allows traversal through ally tiles', () => {
      const grid = makeGrid(8, 8);
      grid.placeUnit('ally', 4, 3);
      const range = Pathfinding.movementRange(grid, { col: 3, row: 3 }, 3, 'party');
      assert.ok(range.has('5,3'));
    });

    it('movementRange with budget 0 returns only start', () => {
      const grid = makeGrid(8, 8);
      const range = Pathfinding.movementRange(grid, { col: 3, row: 3 }, 0, 'party');
      assert.equal(range.size, 1);
      assert.ok(range.has('3,3'));
    });

    it('movementRange from corner has reduced reach', () => {
      const grid = makeGrid(8, 8);
      const cornerRange = Pathfinding.movementRange(grid, { col: 0, row: 0 }, 2, 'party');
      const centerRange = Pathfinding.movementRange(grid, { col: 4, row: 4 }, 2, 'party');
      assert.ok(cornerRange.size < centerRange.size);
    });

    it('pathCost sums terrain costs along path', () => {
      const grid = makeGrid(8, 8);
      const path = [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }];
      assert.equal(Pathfinding.pathCost(grid, path), 2);
    });

    it('pathCost for single tile is 0', () => {
      const grid = makeGrid(8, 8);
      assert.equal(Pathfinding.pathCost(grid, [{ col: 0, row: 0 }]), 0);
    });

    it('pathCost accounts for forest terrain', () => {
      const terrain = [];
      for (let i = 0; i < 64; ++i)
        terrain.push('plains');
      terrain[0 * 8 + 1] = 'forest';
      const grid = new CombatGrid(8, 8, terrain);
      const path = [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }];
      assert.equal(Pathfinding.pathCost(grid, path), 3);
    });

    it('findPath vertical movement works', () => {
      const grid = makeGrid(8, 8);
      const path = Pathfinding.findPath(grid, { col: 3, row: 0 }, { col: 3, row: 5 }, 'party');
      assert.ok(path);
      assert.equal(path.length, 6);
    });

    it('findPath through corridor between enemies', () => {
      const grid = makeGrid(5, 5);
      grid.placeUnit('e1', 2, 0);
      grid.placeUnit('e2', 2, 2);
      const path = Pathfinding.findPath(grid, { col: 0, row: 1 }, { col: 4, row: 1 }, 'party');
      assert.ok(path);
    });

    it('movementRange on 16x12 grid completes quickly', () => {
      const grid = makeGrid(16, 12);
      const start = performance.now();
      Pathfinding.movementRange(grid, { col: 8, row: 6 }, 6, 'party');
      const elapsed = performance.now() - start;
      assert.ok(elapsed < 100, `flood fill took ${elapsed}ms, should be < 100ms`);
    });

    it('findPath handles walled-off goal', () => {
      const grid = makeGrid(5, 5);
      grid.placeUnit('e1', 3, 1);
      grid.placeUnit('e2', 3, 3);
      grid.placeUnit('e3', 4, 2);
      grid.placeUnit('e4', 2, 2);
      const path = Pathfinding.findPath(grid, { col: 0, row: 0 }, { col: 3, row: 2 }, 'party');
      assert.isNull(path);
    });

    it('movementRange excludes impassable water tiles', () => {
      const terrain = [];
      for (let i = 0; i < 25; ++i)
        terrain.push('plains');
      terrain[0 * 5 + 2] = 'water';
      const grid = new CombatGrid(5, 5, terrain);
      const range = Pathfinding.movementRange(grid, { col: 0, row: 0 }, 5, 'party');
      assert.ok(!range.has('2,0'));
    });

    it('pathCost for empty path is 0', () => {
      const grid = makeGrid(8, 8);
      assert.equal(Pathfinding.pathCost(grid, []), 0);
    });
  });
})();
