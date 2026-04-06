;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const ConditionTracker = TR.ConditionTracker;
  const CONDITIONS = TR.CONDITIONS;

  describe('ConditionEngine — CONDITIONS enum', () => {

    it('CONDITIONS exists and is frozen', () => {
      assert.ok(CONDITIONS);
      assert.ok(Object.isFrozen(CONDITIONS));
    });

    it('has standard D&D conditions', () => {
      assert.ok(CONDITIONS.blinded);
      assert.ok(CONDITIONS.stunned);
      assert.ok(CONDITIONS.prone);
      assert.ok(CONDITIONS.paralyzed);
      assert.ok(CONDITIONS.frightened);
    });

    it('each condition has id, name, effects', () => {
      for (const [key, cond] of Object.entries(CONDITIONS)) {
        assert.ok(cond.id, `${key} missing id`);
        assert.ok(cond.name, `${key} missing name`);
        assert.ok(cond.effects, `${key} missing effects`);
      }
    });
  });

  describe('ConditionEngine — ConditionTracker', () => {
    const UNIT = 'unit_1';

    it('ConditionTracker class exists', () => {
      assert.ok(ConditionTracker);
    });

    it('new tracker has no active conditions', () => {
      const tracker = new ConditionTracker();
      const active = tracker.getActive(UNIT);
      assert.isArray(active);
      assert.equal(active.length, 0);
    });

    it('apply adds a condition', () => {
      const tracker = new ConditionTracker();
      tracker.apply(UNIT, 'stunned', 2);
      assert.ok(tracker.has(UNIT, 'stunned'));
    });

    it('remove removes a condition', () => {
      const tracker = new ConditionTracker();
      tracker.apply(UNIT, 'stunned', 2);
      tracker.remove(UNIT, 'stunned');
      assert.ok(!tracker.has(UNIT, 'stunned'));
    });

    it('has returns false for non-applied condition', () => {
      const tracker = new ConditionTracker();
      assert.ok(!tracker.has(UNIT, 'stunned'));
    });

    it('getActive returns all applied conditions', () => {
      const tracker = new ConditionTracker();
      tracker.apply(UNIT, 'stunned', 2);
      tracker.apply(UNIT, 'prone', -1);
      const active = tracker.getActive(UNIT);
      assert.equal(active.length, 2);
    });

    it('tickRound decrements duration', () => {
      const tracker = new ConditionTracker();
      tracker.apply(UNIT, 'stunned', 2);
      tracker.tickRound(UNIT);
      assert.ok(tracker.has(UNIT, 'stunned'), 'should still be active after 1 tick');
      tracker.tickRound(UNIT);
      assert.ok(!tracker.has(UNIT, 'stunned'), 'should expire after 2 ticks');
    });

    it('permanent conditions do not expire on tick', () => {
      const tracker = new ConditionTracker();
      tracker.apply(UNIT, 'prone', -1);
      for (let i = 0; i < 100; ++i)
        tracker.tickRound(UNIT);
      assert.ok(tracker.has(UNIT, 'prone'), 'permanent condition should persist');
    });

    it('getEffects returns aggregate effects', () => {
      const tracker = new ConditionTracker();
      tracker.apply(UNIT, 'prone', 3);
      const effects = tracker.getEffects(UNIT);
      assert.ok(effects, 'should return effects object');
    });

    it('tickRound returns expired condition ids', () => {
      const tracker = new ConditionTracker();
      tracker.apply(UNIT, 'dazed', 1);
      const expired = tracker.tickRound(UNIT);
      assert.isArray(expired);
      assert.equal(expired.length, 1);
      assert.equal(expired[0], 'dazed');
    });
  });
})();
