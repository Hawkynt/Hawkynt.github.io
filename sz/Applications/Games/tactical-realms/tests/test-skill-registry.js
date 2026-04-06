;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const SkillRegistry = TR.SkillRegistry;

  describe('SkillRegistry — Core API', () => {

    it('exists and is frozen', () => {
      assert.ok(SkillRegistry);
      assert.ok(Object.isFrozen(SkillRegistry));
    });

    it('has required methods', () => {
      assert.typeOf(SkillRegistry.get, 'function');
      assert.typeOf(SkillRegistry.getAll, 'function');
      assert.typeOf(SkillRegistry.has, 'function');
    });

    it('has skills registered', () => {
      assert.ok(SkillRegistry.getAll().length > 0);
    });

    it('get returns skill by id', () => {
      const all = SkillRegistry.getAll();
      if (all.length === 0) return;
      const first = all[0];
      const fetched = SkillRegistry.get(first.id);
      assert.ok(fetched);
      assert.equal(fetched.id, first.id);
    });

    it('has returns false for unknown skill', () => {
      assert.ok(!SkillRegistry.has('nonexistent_skill_xyz'));
    });
  });

  describe('SkillRegistry — Skill Data', () => {

    it('all skills have id, name, ability', () => {
      for (const s of SkillRegistry.getAll()) {
        assert.ok(s.id, 'skill missing id');
        assert.ok(s.name, `${s.id} missing name`);
        assert.ok(s.ability, `${s.id} missing ability`);
      }
    });

    it('skill abilities are valid', () => {
      const validAbilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      for (const s of SkillRegistry.getAll())
        assert.ok(validAbilities.includes(s.ability), `${s.id} has invalid ability: ${s.ability}`);
    });
  });

  describe('SkillRegistry — Skill Checks', () => {

    it('skillCheck uses d20 + ranks + ability', () => {
      if (!SkillRegistry.skillCheck) return;
      const PRNG = TR.PRNG;
      const prng = new PRNG(42);
      const result = SkillRegistry.skillCheck(prng, 5, 3, 0);
      assert.ok(result.roll >= 1 && result.roll <= 20);
      assert.equal(result.total, result.roll + 5 + 3);
    });

    it('take10 returns 10 + ranks + ability', () => {
      if (!SkillRegistry.take10) return;
      assert.equal(SkillRegistry.take10(5, 3, 0), 18);
    });

    it('take20 returns 20 + ranks + ability', () => {
      if (!SkillRegistry.take20) return;
      assert.equal(SkillRegistry.take20(5, 3, 0), 28);
    });
  });
})();
