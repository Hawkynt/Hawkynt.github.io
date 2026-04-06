;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const SpellRegistry = TR.SpellRegistry;

  describe('SpellRegistry — Core API', () => {

    it('exists and is frozen', () => {
      assert.ok(SpellRegistry);
      assert.ok(Object.isFrozen(SpellRegistry));
    });

    it('has required methods', () => {
      assert.typeOf(SpellRegistry.get, 'function');
      assert.typeOf(SpellRegistry.getAll, 'function');
      assert.typeOf(SpellRegistry.has, 'function');
      assert.typeOf(SpellRegistry.filter, 'function');
      assert.typeOf(SpellRegistry.count, 'function');
    });

    it('count returns a positive number', () => {
      assert.ok(SpellRegistry.count() > 0, 'should have registered spells');
    });

    it('getAll returns array matching count', () => {
      const all = SpellRegistry.getAll();
      assert.isArray(all);
      assert.equal(all.length, SpellRegistry.count());
    });

    it('get returns spell by id', () => {
      const first = SpellRegistry.getAll()[0];
      const fetched = SpellRegistry.get(first.id);
      assert.ok(fetched);
      assert.equal(fetched.id, first.id);
    });

    it('has returns false for unknown id', () => {
      assert.ok(!SpellRegistry.has('nonexistent_spell_xyz'));
    });
  });

  describe('SpellRegistry — School/Class Indexes', () => {

    it('bySchool returns spells for evocation', () => {
      const evo = SpellRegistry.bySchool('evocation');
      assert.isArray(evo);
      assert.ok(evo.length > 0, 'should have evocation spells');
      for (const s of evo)
        assert.equal(s.school, 'evocation');
    });

    it('forClass returns spells for wizard', () => {
      const wiz = SpellRegistry.forClass('wizard');
      assert.isArray(wiz);
      assert.ok(wiz.length > 0, 'should have wizard spells');
      for (const s of wiz)
        assert.ok(s.level && s.level.wizard !== undefined, `${s.id} should have wizard in level`);
    });

    it('byClassAndLevel returns spells', () => {
      const cantrips = SpellRegistry.byClassAndLevel('wizard', 0);
      assert.isArray(cantrips);
      assert.ok(cantrips.length > 0, 'wizard should have cantrips');
    });
  });

  describe('SpellRegistry — Spell Data Integrity', () => {

    it('all spells have id, name, school', () => {
      for (const s of SpellRegistry.getAll()) {
        assert.ok(s.id, 'spell missing id');
        assert.ok(s.name, `${s.id} missing name`);
        assert.ok(s.school, `${s.id} missing school`);
      }
    });

    it('all spells have level as object', () => {
      for (const s of SpellRegistry.getAll()) {
        assert.ok(typeof s.level === 'object', `${s.id} level should be object, got ${typeof s.level}`);
        const vals = Object.values(s.level);
        for (const v of vals)
          assert.ok(v >= 0 && v <= 9, `${s.id} spell level out of range: ${v}`);
      }
    });
  });

  describe('SpellRegistry — DC and SR', () => {

    it('spellDC computes 10 + spell level + ability mod', () => {
      const spell = SpellRegistry.getAll()[0];
      if (!spell) return;
      const classId = Object.keys(spell.level)[0];
      const dc = SpellRegistry.spellDC(spell, classId, 4);
      const expectedLevel = spell.level[classId];
      assert.equal(dc, 10 + expectedLevel + 4);
    });

    it('casterLevelCheck uses d20 + caster level vs SR', () => {
      const PRNG = TR.PRNG;
      const prng = new PRNG(42);
      const result = SpellRegistry.casterLevelCheck(prng, 10, 15);
      assert.ok(result.roll >= 1 && result.roll <= 20);
      assert.equal(result.total, result.roll + 10);
      assert.equal(result.success, result.total >= 15);
    });
  });
})();
