;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const ActionEconomy = TR.ActionEconomy;
  const ActionType = TR.ActionType;
  const ActionBudget = TR.ActionBudget;

  describe('ActionEconomy — ActionType Enum', () => {

    it('ActionType exists and is frozen', () => {
      assert.ok(ActionType);
      assert.ok(Object.isFrozen(ActionType));
    });

    it('has standard action types', () => {
      assert.ok(ActionType.STANDARD);
      assert.ok(ActionType.MOVE);
      assert.ok(ActionType.SWIFT);
      assert.ok(ActionType.FREE);
      assert.ok(ActionType.FULL_ROUND);
    });
  });

  describe('ActionEconomy — ActionBudget', () => {

    it('ActionBudget class exists', () => {
      assert.ok(ActionBudget);
    });

    it('new budget has standard + move + swift available', () => {
      const budget = new ActionBudget();
      assert.ok(budget.canStandard);
      assert.ok(budget.canMove);
      assert.ok(budget.canSwift);
    });

    it('using standard makes it unavailable', () => {
      const budget = new ActionBudget();
      budget.useStandard();
      assert.ok(!budget.canStandard);
    });

    it('using move makes it unavailable', () => {
      const budget = new ActionBudget();
      budget.useMove();
      assert.ok(!budget.canMove);
    });

    it('using swift makes it unavailable', () => {
      const budget = new ActionBudget();
      budget.useSwift();
      assert.ok(!budget.canSwift);
    });

    it('full round consumes standard and move', () => {
      const budget = new ActionBudget();
      assert.ok(budget.canFullRound);
      budget.useFullRound();
      assert.ok(!budget.canStandard);
      assert.ok(!budget.canMove);
    });

    it('using standard prevents full round', () => {
      const budget = new ActionBudget();
      budget.useStandard();
      assert.ok(!budget.canFullRound);
    });

    it('canAoO defaults to true', () => {
      const budget = new ActionBudget();
      assert.ok(budget.canAoO);
    });

    it('useAoO tracks AoO usage', () => {
      const budget = new ActionBudget();
      budget.useAoO();
      assert.ok(!budget.canAoO, '1 base AoO should be consumed');
    });

    it('Combat Reflexes grants extra AoOs', () => {
      const budget = new ActionBudget(3);
      budget.useAoO();
      assert.ok(budget.canAoO, 'should still have AoOs left');
    });

    it('standardToMove converts standard action', () => {
      const budget = new ActionBudget();
      assert.ok(budget.standardToMove());
      assert.ok(!budget.canStandard);
    });
  });

  describe('ActionEconomy — Iterative Attacks', () => {

    it('iterativeAttacks exists', () => {
      assert.typeOf(ActionEconomy.iterativeAttacks, 'function');
    });

    it('BAB 1 gives 1 attack', () => {
      const attacks = ActionEconomy.iterativeAttacks(1);
      assert.equal(attacks.length, 1);
      assert.equal(attacks[0], 1);
    });

    it('BAB 6 gives 2 attacks at +6/+1', () => {
      const attacks = ActionEconomy.iterativeAttacks(6);
      assert.equal(attacks.length, 2);
      assert.equal(attacks[0], 6);
      assert.equal(attacks[1], 1);
    });

    it('BAB 11 gives 3 attacks', () => {
      const attacks = ActionEconomy.iterativeAttacks(11);
      assert.equal(attacks.length, 3);
    });

    it('BAB 16 gives 4 attacks', () => {
      const attacks = ActionEconomy.iterativeAttacks(16);
      assert.equal(attacks.length, 4);
    });
  });

  describe('ActionEconomy — XP Table', () => {

    it('xpForLevel returns 0 for level 1', () => {
      assert.equal(ActionEconomy.xpForLevel(1), 0);
    });

    it('xpForLevel returns 1000 for level 2', () => {
      assert.equal(ActionEconomy.xpForLevel(2), 1000);
    });

    it('levelFromXp returns 1 for 0 XP', () => {
      assert.equal(ActionEconomy.levelFromXp(0), 1);
    });

    it('levelFromXp returns 2 for 1000 XP', () => {
      assert.equal(ActionEconomy.levelFromXp(1000), 2);
    });

    it('levelFromXp and xpForLevel are consistent for 1-20', () => {
      for (let level = 1; level <= 20; ++level) {
        const xp = ActionEconomy.xpForLevel(level);
        assert.equal(ActionEconomy.levelFromXp(xp), level, `levelFromXp(${xp}) should be ${level}`);
      }
    });
  });

  describe('ActionEconomy — Epic XP (Levels 21-100)', () => {

    it('xpForLevel(21) is greater than xpForLevel(20)', () => {
      assert.ok(ActionEconomy.xpForLevel(21) > ActionEconomy.xpForLevel(20));
    });

    it('xpForLevel monotonically increases to level 100', () => {
      for (let l = 2; l <= 100; ++l)
        assert.ok(ActionEconomy.xpForLevel(l) > ActionEconomy.xpForLevel(l - 1), `level ${l} XP should exceed level ${l - 1}`);
    });

    it('levelFromXp works for epic levels', () => {
      const xp50 = ActionEconomy.xpForLevel(50);
      assert.equal(ActionEconomy.levelFromXp(xp50), 50);
      assert.equal(ActionEconomy.levelFromXp(xp50 - 1), 49);
    });

    it('levelFromXp returns 100 for very high XP', () => {
      const xp100 = ActionEconomy.xpForLevel(100);
      assert.equal(ActionEconomy.levelFromXp(xp100), 100);
      assert.equal(ActionEconomy.levelFromXp(xp100 + 999999), 100);
    });

    it('levelFromXp and xpForLevel are consistent for 21-100', () => {
      for (let level = 21; level <= 100; ++level) {
        const xp = ActionEconomy.xpForLevel(level);
        assert.equal(ActionEconomy.levelFromXp(xp), level, `levelFromXp(${xp}) should be ${level}`);
        if (level > 1)
          assert.equal(ActionEconomy.levelFromXp(xp - 1), level - 1, `levelFromXp(${xp - 1}) should be ${level - 1}`);
      }
    });

    it('XP_TABLE has entries for levels 0-100', () => {
      assert.ok(ActionEconomy.XP_TABLE.length >= 101);
    });
  });

  describe('ActionEconomy — Two-Weapon Fighting', () => {

    it('twoWeaponPenalties returns penalties', () => {
      assert.typeOf(ActionEconomy.twoWeaponPenalties, 'function');
      const result = ActionEconomy.twoWeaponPenalties(false, false, false, false);
      assert.ok(result.mainPenalty < 0);
      assert.ok(result.offPenalty < 0);
    });

    it('light offhand reduces penalties', () => {
      const heavy = ActionEconomy.twoWeaponPenalties(false, false, false, false);
      const light = ActionEconomy.twoWeaponPenalties(true, false, false, false);
      assert.ok(light.mainPenalty > heavy.mainPenalty, 'light offhand should reduce main penalty');
    });

    it('TWF feat reduces penalties', () => {
      const noFeat = ActionEconomy.twoWeaponPenalties(false, false, false, false);
      const withFeat = ActionEconomy.twoWeaponPenalties(false, true, false, false);
      assert.ok(withFeat.mainPenalty > noFeat.mainPenalty, 'TWF should reduce main penalty');
    });
  });
})();
