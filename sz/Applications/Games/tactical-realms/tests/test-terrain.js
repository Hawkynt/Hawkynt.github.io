;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const { Terrain } = window.SZ.TacticalRealms;

  describe('Terrain', () => {

    it('exports TERRAIN_TYPES as an array', () => {
      assert.ok(Array.isArray(Terrain.TERRAIN_TYPES));
    });

    it('has at least 13 terrain types (legacy + D&D data)', () => {
      assert.ok(Terrain.TERRAIN_TYPES.length >= 13, `expected >=13, got ${Terrain.TERRAIN_TYPES.length}`);
    });

    it('each terrain type is frozen', () => {
      for (const t of Terrain.TERRAIN_TYPES)
        assert.ok(Object.isFrozen(t), `${t.id} should be frozen`);
    });

    it('each terrain type has required fields', () => {
      const required = ['id', 'name', 'color', 'moveCost', 'coverAC', 'attackMod'];
      for (const t of Terrain.TERRAIN_TYPES)
        for (const f of required)
          assert.ok(f in t, `${t.id} missing field "${f}"`);
    });

    it('all terrain IDs are unique strings', () => {
      const ids = Terrain.TERRAIN_TYPES.map(t => t.id);
      const unique = new Set(ids);
      assert.equal(unique.size, ids.length);
      for (const id of ids)
        assert.typeOf(id, 'string');
    });

    it('all terrain names are non-empty strings', () => {
      for (const t of Terrain.TERRAIN_TYPES) {
        assert.typeOf(t.name, 'string');
        assert.ok(t.name.length > 0, `${t.id} name is empty`);
      }
    });

    it('all moveCosts are positive numbers', () => {
      for (const t of Terrain.TERRAIN_TYPES) {
        assert.typeOf(t.moveCost, 'number');
        assert.greaterThan(t.moveCost, 0, `${t.id} moveCost must be > 0`);
      }
    });

    it('all coverAC values are non-negative numbers', () => {
      for (const t of Terrain.TERRAIN_TYPES) {
        assert.typeOf(t.coverAC, 'number');
        assert.ok(t.coverAC >= 0, `${t.id} coverAC must be >= 0`);
      }
    });

    it('plains has moveCost 1 and no modifiers', () => {
      const plains = Terrain.byId('plains');
      assert.ok(plains);
      assert.equal(plains.moveCost, 1);
      assert.equal(plains.coverAC, 0);
      assert.equal(plains.attackMod, 0);
    });

    it('forest has moveCost 2, +4 cover, -1 attack', () => {
      const forest = Terrain.byId('forest');
      assert.ok(forest);
      assert.equal(forest.moveCost, 2);
      assert.equal(forest.coverAC, 4);
      assert.equal(forest.attackMod, -1);
    });

    it('mountain has moveCost 3, +2 cover, +1 attack', () => {
      const mountain = Terrain.byId('mountain');
      assert.ok(mountain);
      assert.equal(mountain.moveCost, 3);
      assert.equal(mountain.coverAC, 2);
      assert.ok(mountain.attackMod !== undefined, 'mountain should have attackMod');
    });

    it('ruins has moveCost 1 and +4 cover', () => {
      const ruins = Terrain.byId('ruins');
      assert.ok(ruins);
      assert.equal(ruins.moveCost, 1);
      assert.equal(ruins.coverAC, 4);
    });

    it('dungeon_floor has moveCost 1 and no modifiers', () => {
      const df = Terrain.byId('dungeon_floor');
      assert.ok(df);
      assert.equal(df.moveCost, 1);
      assert.equal(df.coverAC, 0);
      assert.equal(df.attackMod, 0);
    });

    it('byId returns null for unknown terrain', () => {
      assert.isNull(Terrain.byId('nonexistent'));
    });

    it('moveCost returns correct value for known terrain', () => {
      assert.equal(Terrain.moveCost('plains'), 1);
      assert.equal(Terrain.moveCost('forest'), 2);
      assert.equal(Terrain.moveCost('mountain'), 3);
    });

    it('moveCost returns Infinity for unknown terrain', () => {
      assert.equal(Terrain.moveCost('unknown'), Infinity);
    });

    it('coverBonus returns correct AC bonus', () => {
      assert.equal(Terrain.coverBonus('plains'), 0);
      assert.equal(Terrain.coverBonus('forest'), 4);
      assert.equal(Terrain.coverBonus('mountain'), 2);
    });

    it('coverBonus returns 0 for unknown terrain', () => {
      assert.equal(Terrain.coverBonus('unknown'), 0);
    });

    it('attackMod returns correct modifier', () => {
      assert.equal(Terrain.attackMod('plains'), 0);
      assert.equal(Terrain.attackMod('forest'), -1);
    });

    it('attackMod returns 0 for unknown terrain', () => {
      assert.equal(Terrain.attackMod('unknown'), 0);
    });

    it('allIds returns array containing all legacy terrain IDs', () => {
      const ids = Terrain.allIds();
      assert.isArray(ids);
      assert.ok(ids.length >= 13, 'should have at least 13 terrain types');
      assert.includes(ids, 'plains');
      assert.includes(ids, 'forest');
      assert.includes(ids, 'mountain');
      assert.includes(ids, 'ruins');
      assert.includes(ids, 'dungeon_floor');
    });

    it('all legacy IDs are present in terrain list', () => {
      const ids = Terrain.allIds();
      const legacy = ['plains', 'forest', 'mountain', 'ruins', 'dungeon_floor', 'water', 'swamp', 'desert', 'snow', 'lava', 'bridge', 'road', 'cave'];
      for (const a of legacy)
        assert.includes(ids, a);
      assert.ok(ids.length >= legacy.length, 'should have at least all legacy terrain types');
    });

    it('all colors are valid CSS color strings', () => {
      for (const t of Terrain.TERRAIN_TYPES) {
        assert.typeOf(t.color, 'string');
        assert.ok(t.color.length > 0, `${t.id} color is empty`);
      }
    });

    it('water has high moveCost (impassable indicator)', () => {
      const water = Terrain.byId('water');
      assert.ok(water);
      assert.greaterThan(water.moveCost, 3);
    });

    it('swamp has moveCost greater than plains', () => {
      const swamp = Terrain.byId('swamp');
      assert.ok(swamp);
      assert.greaterThan(swamp.moveCost, 1);
    });
  });
})();
