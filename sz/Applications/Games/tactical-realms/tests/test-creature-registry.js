;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const CreatureRegistry = TR.CreatureRegistry;

  describe('CreatureRegistry — Core API', () => {

    it('exists and is frozen', () => {
      assert.ok(CreatureRegistry);
      assert.ok(Object.isFrozen(CreatureRegistry));
    });

    it('has required methods', () => {
      assert.typeOf(CreatureRegistry.get, 'function');
      assert.typeOf(CreatureRegistry.getAll, 'function');
      assert.typeOf(CreatureRegistry.has, 'function');
      assert.typeOf(CreatureRegistry.filter, 'function');
      assert.typeOf(CreatureRegistry.count, 'function');
    });

    it('count returns a positive number', () => {
      assert.ok(CreatureRegistry.count() > 0, 'should have registered creatures');
    });

    it('getAll returns array matching count', () => {
      const all = CreatureRegistry.getAll();
      assert.isArray(all);
      assert.equal(all.length, CreatureRegistry.count());
    });

    it('has returns true for registered creature', () => {
      const first = CreatureRegistry.getAll()[0];
      assert.ok(CreatureRegistry.has(first.id));
    });

    it('has returns false for unknown id', () => {
      assert.ok(!CreatureRegistry.has('nonexistent_creature_xyz'));
    });

    it('get returns creature by id', () => {
      const first = CreatureRegistry.getAll()[0];
      const fetched = CreatureRegistry.get(first.id);
      assert.ok(fetched);
      assert.equal(fetched.id, first.id);
      assert.equal(fetched.name, first.name);
    });

    it('get returns undefined for unknown id', () => {
      assert.ok(!CreatureRegistry.get('nonexistent_creature_xyz'));
    });

    it('filter returns subset', () => {
      const all = CreatureRegistry.getAll();
      const filtered = CreatureRegistry.filter(c => c.size === 'M' || c.size === 'Medium');
      assert.ok(filtered.length > 0, 'should have medium creatures');
      assert.ok(filtered.length <= all.length);
    });
  });

  describe('CreatureRegistry — Race/Monster Separation', () => {

    it('getRaces returns playable races', () => {
      if (!CreatureRegistry.getRaces) return;
      const races = CreatureRegistry.getRaces();
      assert.isArray(races);
      assert.ok(races.length > 0, 'should have playable races');
      for (const r of races)
        assert.ok(r.playable !== false, `${r.id} should be playable`);
    });

    it('getMonsters returns non-playable creatures', () => {
      if (!CreatureRegistry.getMonsters) return;
      const monsters = CreatureRegistry.getMonsters();
      assert.isArray(monsters);
      assert.ok(monsters.length > 0, 'should have monsters');
    });

    it('getCoreRaces returns core availability races', () => {
      if (!CreatureRegistry.getCoreRaces) return;
      const core = CreatureRegistry.getCoreRaces();
      assert.isArray(core);
      assert.ok(core.length > 0, 'should have core races');
    });
  });

  describe('CreatureRegistry — Creature Data Integrity', () => {

    it('all creatures have required fields', () => {
      for (const c of CreatureRegistry.getAll()) {
        assert.ok(c.id, `creature missing id`);
        assert.ok(c.name, `${c.id} missing name`);
        assert.ok(c.type || c.creatureType, `${c.id} missing type`);
      }
    });

    it('all creatures have a size field', () => {
      const validSizes = ['F', 'D', 'T', 'S', 'M', 'L', 'H', 'G', 'C', 'Fine', 'Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Colossal'];
      for (const c of CreatureRegistry.getAll())
        assert.ok(validSizes.includes(c.size), `${c.id} has invalid size: ${c.size}`);
    });
  });
})();
