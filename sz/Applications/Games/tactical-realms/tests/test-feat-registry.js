;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const FeatRegistry = TR.FeatRegistry;

  describe('FeatRegistry — Core API', () => {

    it('exists and is frozen', () => {
      assert.ok(FeatRegistry);
      assert.ok(Object.isFrozen(FeatRegistry));
    });

    it('has required methods', () => {
      assert.typeOf(FeatRegistry.get, 'function');
      assert.typeOf(FeatRegistry.getAll, 'function');
      assert.typeOf(FeatRegistry.has, 'function');
    });

    it('has feats registered', () => {
      assert.ok(FeatRegistry.getAll().length > 0);
    });

    it('get returns feat by id', () => {
      const all = FeatRegistry.getAll();
      if (all.length === 0) return;
      const first = all[0];
      const fetched = FeatRegistry.get(first.id);
      assert.ok(fetched);
      assert.equal(fetched.id, first.id);
    });

    it('has returns false for unknown feat', () => {
      assert.ok(!FeatRegistry.has('nonexistent_feat_xyz'));
    });
  });

  describe('FeatRegistry — Feat Data', () => {

    it('all feats have id, name, type', () => {
      for (const f of FeatRegistry.getAll()) {
        assert.ok(f.id, 'feat missing id');
        assert.ok(f.name, `${f.id} missing name`);
        assert.ok(f.type, `${f.id} missing type`);
      }
    });

    it('feat types are valid', () => {
      const validTypes = ['general', 'combat', 'fighter', 'metamagic', 'item_creation', 'class', 'racial', 'divine', 'psionic', 'epic', 'magic', 'tactical'];
      for (const f of FeatRegistry.getAll())
        assert.ok(validTypes.includes(f.type), `${f.id} has invalid type: ${f.type}`);
    });
  });

  describe('FeatRegistry — Feat Slot Progression', () => {

    it('featSlotsAtLevel returns correct count', () => {
      if (!FeatRegistry.featSlotsAtLevel) return;
      assert.ok(FeatRegistry.featSlotsAtLevel(1) >= 1, 'level 1 should have at least 1 feat');
      assert.ok(FeatRegistry.featSlotsAtLevel(3) >= 2, 'level 3 should have at least 2 feats');
    });
  });
})();
