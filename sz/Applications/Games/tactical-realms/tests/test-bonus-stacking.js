;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const BonusStacking = TR.BonusStacking;
  const BonusType = TR.BonusType;
  const BonusAggregator = TR.BonusAggregator;

  describe('BonusStacking — BonusType Enum', () => {

    it('BonusType exists and is frozen', () => {
      assert.ok(BonusType);
      assert.ok(Object.isFrozen(BonusType));
    });

    it('has standard D&D bonus types', () => {
      assert.equal(BonusType.ARMOR, 'armor');
      assert.equal(BonusType.SHIELD, 'shield');
      assert.equal(BonusType.NATURAL, 'natural');
      assert.equal(BonusType.DEFLECTION, 'deflection');
      assert.equal(BonusType.DODGE, 'dodge');
      assert.equal(BonusType.SIZE, 'size');
      assert.equal(BonusType.UNTYPED, 'untyped');
    });
  });

  describe('BonusStacking — BonusAggregator', () => {

    it('BonusAggregator class exists', () => {
      assert.ok(BonusAggregator);
    });

    it('empty aggregator returns 0', () => {
      const agg = new BonusAggregator();
      assert.equal(agg.total('ac'), 0);
    });

    it('aggregator computes total correctly', () => {
      const agg = new BonusAggregator();
      agg.add('ac', BonusType.ARMOR, 5, 'chainmail');
      agg.add('ac', BonusType.SHIELD, 2, 'buckler');
      const total = agg.total('ac');
      assert.equal(total, 7);
    });

    it('same-type bonuses do not stack (highest wins)', () => {
      const agg = new BonusAggregator();
      agg.add('ac', BonusType.ARMOR, 5, 'chainmail');
      agg.add('ac', BonusType.ARMOR, 3, 'leather');
      assert.equal(agg.total('ac'), 5);
    });

    it('dodge bonuses always stack', () => {
      const agg = new BonusAggregator();
      agg.add('ac', BonusType.DODGE, 1, 'feat1');
      agg.add('ac', BonusType.DODGE, 2, 'feat2');
      assert.equal(agg.total('ac'), 3);
    });

    it('untyped bonuses always stack', () => {
      const agg = new BonusAggregator();
      agg.add('ac', BonusType.UNTYPED, 3, 'src1');
      agg.add('ac', BonusType.UNTYPED, 2, 'src2');
      assert.equal(agg.total('ac'), 5);
    });

    it('different bonus types stack', () => {
      const agg = new BonusAggregator();
      agg.add('ac', BonusType.ARMOR, 5, 'plate');
      agg.add('ac', BonusType.SHIELD, 2, 'shield');
      agg.add('ac', BonusType.NATURAL, 3, 'scales');
      agg.add('ac', BonusType.DEFLECTION, 1, 'ring');
      assert.equal(agg.total('ac'), 11);
    });

    it('penalties always stack', () => {
      const agg = new BonusAggregator();
      agg.add('ac', BonusType.PENALTY, -2, 'condition1');
      agg.add('ac', BonusType.PENALTY, -1, 'condition2');
      assert.equal(agg.total('ac'), -3);
    });

    it('clear resets the aggregator', () => {
      const agg = new BonusAggregator();
      agg.add('ac', BonusType.ARMOR, 5, 'plate');
      agg.clear();
      assert.equal(agg.total('ac'), 0);
    });
  });

  describe('BonusStacking — computeAC', () => {

    it('BonusStacking is frozen', () => {
      assert.ok(Object.isFrozen(BonusStacking));
    });

    it('computeAC exists', () => {
      assert.typeOf(BonusStacking.computeAC, 'function');
    });

    it('computeAC returns number for a basic character', () => {
      const char = { stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, size: 'Medium' };
      const ac = BonusStacking.computeAC(char);
      assert.ok(typeof ac === 'number');
      assert.equal(ac, 10); // base 10 + dex mod 0
    });

    it('computeAC adds dex modifier', () => {
      const char = { stats: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 }, size: 'Medium' };
      const ac = BonusStacking.computeAC(char);
      assert.equal(ac, 12); // 10 + 2 dex
    });
  });
})();
