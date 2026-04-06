;(function() {
  'use strict';
  const { describe, it, beforeEach, assert } = window.TestRunner;
  const { CombatGrid, Terrain, PRNG } = window.SZ.TacticalRealms;

  describe('CombatGrid', () => {
    let grid;

    beforeEach(() => {
      const terrain = [];
      for (let i = 0; i < 8 * 8; ++i)
        terrain.push('plains');
      grid = new CombatGrid(8, 8, terrain);
    });

    it('constructor stores cols and rows', () => {
      assert.equal(grid.cols, 8);
      assert.equal(grid.rows, 8);
    });

    it('inBounds returns true for valid coords', () => {
      assert.ok(grid.inBounds(0, 0));
      assert.ok(grid.inBounds(7, 7));
      assert.ok(grid.inBounds(3, 4));
    });

    it('inBounds returns false for out-of-range coords', () => {
      assert.ok(!grid.inBounds(-1, 0));
      assert.ok(!grid.inBounds(0, -1));
      assert.ok(!grid.inBounds(8, 0));
      assert.ok(!grid.inBounds(0, 8));
    });

    it('terrainAt returns terrain object for valid coords', () => {
      const t = grid.terrainAt(0, 0);
      assert.ok(t);
      assert.equal(t.id, 'plains');
    });

    it('terrainAt returns null for out-of-bounds coords', () => {
      assert.isNull(grid.terrainAt(-1, 0));
      assert.isNull(grid.terrainAt(99, 0));
    });

    it('terrainIdAt returns terrain id string', () => {
      assert.equal(grid.terrainIdAt(0, 0), 'plains');
    });

    it('moveCostAt returns correct move cost', () => {
      assert.equal(grid.moveCostAt(0, 0), 1);
    });

    it('constructor with mixed terrain', () => {
      const terrain = [];
      for (let i = 0; i < 16; ++i)
        terrain.push(i % 2 === 0 ? 'forest' : 'plains');
      const g = new CombatGrid(4, 4, terrain);
      assert.equal(g.terrainIdAt(0, 0), 'forest');
      assert.equal(g.terrainIdAt(1, 0), 'plains');
      assert.equal(g.moveCostAt(0, 0), 2);
    });

    it('placeUnit places a unit at given position', () => {
      grid.placeUnit('u1', 3, 4);
      assert.equal(grid.unitAt(3, 4), 'u1');
    });

    it('placeUnit throws if position is occupied', () => {
      grid.placeUnit('u1', 3, 4);
      assert.throws(() => grid.placeUnit('u2', 3, 4));
    });

    it('placeUnit throws if out of bounds', () => {
      assert.throws(() => grid.placeUnit('u1', -1, 0));
      assert.throws(() => grid.placeUnit('u1', 8, 0));
    });

    it('removeUnit removes a placed unit', () => {
      grid.placeUnit('u1', 3, 4);
      grid.removeUnit('u1');
      assert.isNull(grid.unitAt(3, 4));
    });

    it('removeUnit for unknown unit does not throw', () => {
      grid.removeUnit('nonexistent');
    });

    it('moveUnit changes unit position', () => {
      grid.placeUnit('u1', 0, 0);
      grid.moveUnit('u1', 2, 3);
      assert.isNull(grid.unitAt(0, 0));
      assert.equal(grid.unitAt(2, 3), 'u1');
    });

    it('moveUnit throws if target occupied by another unit', () => {
      grid.placeUnit('u1', 0, 0);
      grid.placeUnit('u2', 1, 0);
      assert.throws(() => grid.moveUnit('u1', 1, 0));
    });

    it('unitPosition returns {col, row} for placed unit', () => {
      grid.placeUnit('u1', 5, 6);
      const pos = grid.unitPosition('u1');
      assert.equal(pos.col, 5);
      assert.equal(pos.row, 6);
    });

    it('unitPosition returns null for unknown unit', () => {
      assert.isNull(grid.unitPosition('nope'));
    });

    it('isOccupied returns true when unit present', () => {
      grid.placeUnit('u1', 2, 2);
      assert.ok(grid.isOccupied(2, 2));
    });

    it('isOccupied returns false when empty', () => {
      assert.ok(!grid.isOccupied(2, 2));
    });

    it('neighbors returns 4 cardinal for center tile', () => {
      const n = grid.neighbors(3, 3);
      assert.equal(n.length, 4);
      const keys = n.map(p => `${p.col},${p.row}`).sort();
      assert.deepEqual(keys, ['2,3', '3,2', '3,4', '4,3']);
    });

    it('neighbors returns 2 for corner (0,0)', () => {
      const n = grid.neighbors(0, 0);
      assert.equal(n.length, 2);
    });

    it('neighbors returns 3 for edge tile', () => {
      const n = grid.neighbors(0, 3);
      assert.equal(n.length, 3);
    });

    it('neighbors returns 2 for corner (7,7)', () => {
      const n = grid.neighbors(7, 7);
      assert.equal(n.length, 2);
    });

    it('generate creates grid with valid terrain', () => {
      const prng = new PRNG(42);
      const g = CombatGrid.generate(10, 10, prng, 'plains');
      assert.equal(g.cols, 10);
      assert.equal(g.rows, 10);
      for (let r = 0; r < 10; ++r)
        for (let c = 0; c < 10; ++c) {
          const tid = g.terrainIdAt(c, r);
          assert.ok(Terrain.byId(tid), `invalid terrain at ${c},${r}: ${tid}`);
        }
    });

    it('generate is deterministic with same seed', () => {
      const g1 = CombatGrid.generate(8, 8, new PRNG(99), 'forest');
      const g2 = CombatGrid.generate(8, 8, new PRNG(99), 'forest');
      for (let r = 0; r < 8; ++r)
        for (let c = 0; c < 8; ++c)
          assert.equal(g1.terrainIdAt(c, r), g2.terrainIdAt(c, r));
    });

    it('generate with dungeon biome uses dungeon-appropriate terrain', () => {
      const g = CombatGrid.generate(8, 8, new PRNG(7), 'dungeon');
      let hasDungeon = false;
      for (let r = 0; r < 8; ++r)
        for (let c = 0; c < 8; ++c)
          if (g.terrainIdAt(c, r) === 'dungeon_floor')
            hasDungeon = true;
      assert.ok(hasDungeon);
    });

    it('serialize and deserialize roundtrip', () => {
      grid.placeUnit('u1', 2, 3);
      const data = grid.serialize();
      assert.ok(data);
      assert.equal(data.cols, 8);
      assert.equal(data.rows, 8);
      assert.isArray(data.terrain);
    });

    it('deserialize restores grid state', () => {
      grid.placeUnit('u1', 2, 3);
      const data = grid.serialize();
      const restored = CombatGrid.deserialize(data);
      assert.equal(restored.cols, 8);
      assert.equal(restored.rows, 8);
      assert.equal(restored.terrainIdAt(0, 0), 'plains');
    });

    it('multiple units can be placed and queried independently', () => {
      grid.placeUnit('a', 0, 0);
      grid.placeUnit('b', 1, 1);
      grid.placeUnit('c', 7, 7);
      assert.equal(grid.unitAt(0, 0), 'a');
      assert.equal(grid.unitAt(1, 1), 'b');
      assert.equal(grid.unitAt(7, 7), 'c');
      assert.isNull(grid.unitAt(3, 3));
    });

    it('unitAt returns null for out-of-bounds', () => {
      assert.isNull(grid.unitAt(-1, 0));
    });

    it('fromOverworldTiles maps grass to plains', () => {
      const tiles = [1, 1, 1, 1];
      const g = CombatGrid.fromOverworldTiles(tiles, 2, 2);
      assert.equal(g.cols, 2);
      assert.equal(g.rows, 2);
      assert.equal(g.terrainIdAt(0, 0), 'plains');
    });

    it('fromOverworldTiles maps forest to forest', () => {
      const tiles = [2, 2, 2, 2];
      const g = CombatGrid.fromOverworldTiles(tiles, 2, 2);
      assert.equal(g.terrainIdAt(0, 0), 'forest');
    });

    it('fromOverworldTiles maps mountain to mountain', () => {
      const tiles = [3];
      const g = CombatGrid.fromOverworldTiles(tiles, 1, 1);
      assert.equal(g.terrainIdAt(0, 0), 'mountain');
    });

    it('fromOverworldTiles maps water to water', () => {
      const tiles = [8];
      const g = CombatGrid.fromOverworldTiles(tiles, 1, 1);
      assert.equal(g.terrainIdAt(0, 0), 'water');
    });

    it('fromOverworldTiles maps all overworld tile types', () => {
      const tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const g = CombatGrid.fromOverworldTiles(tiles, 3, 3);
      assert.equal(g.terrainIdAt(0, 0), 'plains');
      assert.equal(g.terrainIdAt(1, 0), 'forest');
      assert.equal(g.terrainIdAt(2, 0), 'mountain');
      assert.equal(g.terrainIdAt(0, 1), 'plains');
      assert.equal(g.terrainIdAt(1, 1), 'road');
      assert.equal(g.terrainIdAt(2, 1), 'road');
      assert.equal(g.terrainIdAt(0, 2), 'plains');
      assert.equal(g.terrainIdAt(1, 2), 'water');
      assert.equal(g.terrainIdAt(2, 2), 'desert');
    });
  });
})();
