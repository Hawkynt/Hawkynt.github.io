;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const ClassRegistry = TR.ClassRegistry;

  describe('ClassRegistry — Core API', () => {

    it('exists and is frozen', () => {
      assert.ok(ClassRegistry);
      assert.ok(Object.isFrozen(ClassRegistry));
    });

    it('has required methods', () => {
      assert.typeOf(ClassRegistry.get, 'function');
      assert.typeOf(ClassRegistry.getAll, 'function');
      assert.typeOf(ClassRegistry.has, 'function');
      assert.typeOf(ClassRegistry.filter, 'function');
      assert.typeOf(ClassRegistry.count, 'function');
    });

    it('count returns a positive number', () => {
      assert.ok(ClassRegistry.count() > 0, 'should have registered classes');
    });

    it('getAll returns array matching count', () => {
      const all = ClassRegistry.getAll();
      assert.isArray(all);
      assert.equal(all.length, ClassRegistry.count());
    });

    it('get returns class by id', () => {
      const first = ClassRegistry.getAll()[0];
      const fetched = ClassRegistry.get(first.id);
      assert.ok(fetched);
      assert.equal(fetched.id, first.id);
    });

    it('has returns false for unknown id', () => {
      assert.ok(!ClassRegistry.has('nonexistent_class_xyz'));
    });
  });

  describe('ClassRegistry — Base/Prestige Separation', () => {

    it('getBaseClasses returns base classes', () => {
      if (!ClassRegistry.getBaseClasses) return;
      const base = ClassRegistry.getBaseClasses();
      assert.isArray(base);
      assert.ok(base.length > 0, 'should have base classes');
      for (const c of base)
        assert.equal(c.type, 'base');
    });

    it('getPrestigeClasses returns prestige classes', () => {
      if (!ClassRegistry.getPrestigeClasses) return;
      const prestige = ClassRegistry.getPrestigeClasses();
      assert.isArray(prestige);
      assert.ok(prestige.length > 0, 'should have prestige classes');
      for (const c of prestige)
        assert.equal(c.type, 'prestige');
    });
  });

  describe('ClassRegistry — BAB/Save Calculation', () => {

    it('calcBAB returns positive values for valid progressions', () => {
      if (!ClassRegistry.calcBAB) return;
      const full = ClassRegistry.calcBAB('full', 5);
      assert.ok(full > 0, 'full BAB at level 5 should be positive');
      const half = ClassRegistry.calcBAB('1/2', 5);
      assert.ok(half >= 0, 'half BAB at level 5 should be non-negative');
      assert.ok(full > half, 'full BAB should exceed half BAB');
    });

    it('calcSave returns positive values for good progression', () => {
      if (!ClassRegistry.calcSave) return;
      const good = ClassRegistry.calcSave(true, 5);
      assert.ok(good > 0, 'good save at level 5 should be positive');
      const poor = ClassRegistry.calcSave(false, 5);
      assert.ok(good > poor, 'good save should exceed poor save');
    });
  });

  describe('ClassRegistry — Data Integrity', () => {

    it('all classes have required fields', () => {
      for (const c of ClassRegistry.getAll()) {
        assert.ok(c.id, 'class missing id');
        assert.ok(c.name, `${c.id} missing name`);
        assert.ok(c.type === 'base' || c.type === 'prestige' || c.type === 'npc', `${c.id} has invalid type: ${c.type}`);
      }
    });

    it('all classes have hitDie', () => {
      for (const c of ClassRegistry.getAll())
        assert.ok(c.hitDie > 0, `${c.id} should have positive hitDie`);
    });
  });
})();
