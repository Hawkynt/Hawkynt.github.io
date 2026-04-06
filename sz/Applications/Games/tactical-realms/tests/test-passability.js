;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const PassMode = TR.PassMode;
  const Passability = TR.Passability;

  describe('Passability — PassMode Constants', () => {

    it('PassMode exists and is frozen', () => {
      assert.ok(PassMode);
      assert.ok(Object.isFrozen(PassMode));
    });

    it('has all movement mode flags', () => {
      assert.equal(PassMode.WALK, 0b00001);
      assert.equal(PassMode.FLY, 0b00010);
      assert.equal(PassMode.SWIM, 0b00100);
      assert.equal(PassMode.BURROW, 0b01000);
      assert.equal(PassMode.ETHEREAL, 0b10000);
    });

    it('flags are powers of 2', () => {
      assert.equal(PassMode.WALK, 1);
      assert.equal(PassMode.FLY, 2);
      assert.equal(PassMode.SWIM, 4);
      assert.equal(PassMode.BURROW, 8);
      assert.equal(PassMode.ETHEREAL, 16);
    });

    it('flags can be combined with bitwise OR', () => {
      const flySwim = PassMode.FLY | PassMode.SWIM;
      assert.equal(flySwim, 6);
      assert.ok(flySwim & PassMode.FLY);
      assert.ok(flySwim & PassMode.SWIM);
      assert.ok(!(flySwim & PassMode.WALK));
    });
  });

  describe('Passability — canTraverse', () => {

    it('Passability exists and is frozen', () => {
      assert.ok(Passability);
      assert.ok(Object.isFrozen(Passability));
    });

    it('walker can traverse walkable tile', () => {
      assert.ok(Passability.canTraverse(PassMode.WALK, PassMode.WALK));
    });

    it('walker cannot traverse fly-only tile', () => {
      assert.ok(!Passability.canTraverse(PassMode.WALK, PassMode.FLY));
    });

    it('flyer can traverse fly tile', () => {
      assert.ok(Passability.canTraverse(PassMode.FLY, PassMode.FLY));
    });

    it('flyer can traverse walk+fly tile', () => {
      assert.ok(Passability.canTraverse(PassMode.FLY, PassMode.WALK | PassMode.FLY));
    });

    it('swimmer can traverse swim tile', () => {
      assert.ok(Passability.canTraverse(PassMode.SWIM, PassMode.SWIM));
    });

    it('ethereal passes through everything with ethereal flag', () => {
      assert.ok(Passability.canTraverse(PassMode.ETHEREAL, PassMode.ETHEREAL));
    });

    it('multi-mode creature can use any matching mode', () => {
      const creature = PassMode.WALK | PassMode.FLY;
      assert.ok(Passability.canTraverse(creature, PassMode.FLY));
      assert.ok(Passability.canTraverse(creature, PassMode.WALK));
    });
  });

  describe('Passability — creaturePassMode', () => {

    it('land speed grants WALK', () => {
      const mode = Passability.creaturePassMode({ land: 30 });
      assert.ok(mode & PassMode.WALK);
    });

    it('fly speed grants FLY', () => {
      const mode = Passability.creaturePassMode({ land: 30, fly: 60 });
      assert.ok(mode & PassMode.FLY);
    });

    it('swim speed grants SWIM', () => {
      const mode = Passability.creaturePassMode({ land: 30, swim: 30 });
      assert.ok(mode & PassMode.SWIM);
    });

    it('burrow speed grants BURROW', () => {
      const mode = Passability.creaturePassMode({ land: 20, burrow: 10 });
      assert.ok(mode & PassMode.BURROW);
    });

    it('no speeds defaults to WALK', () => {
      const mode = Passability.creaturePassMode(null);
      assert.equal(mode, PassMode.WALK);
    });
  });

  describe('Passability — Wall Destruction', () => {

    it('damageObstacle returns no damage for non-destructible', () => {
      const result = Passability.damageObstacle(null, 10);
      assert.ok(!result.destroyed);
      assert.equal(result.damageDealt, 0);
    });

    it('damageObstacle applies hardness reduction', () => {
      const terrain = { destructible: true, hp: 30, hardness: 5 };
      const result = Passability.damageObstacle(terrain, 10);
      assert.equal(result.damageDealt, 5); // 10 - 5 hardness
      assert.ok(!result.destroyed);
    });

    it('damageObstacle destroys at 0 HP', () => {
      const terrain = { destructible: true, hp: 5, hardness: 0 };
      const result = Passability.damageObstacle(terrain, 10);
      assert.ok(result.destroyed);
      assert.equal(result.remainingHp, 0);
    });

    it('breakCheck uses d20 + STR vs DC', () => {
      const PRNG = TR.PRNG;
      const prng = new PRNG(42);
      const result = Passability.breakCheck(prng, 5, 20);
      assert.ok(result.roll >= 1 && result.roll <= 20);
      assert.equal(result.total, result.roll + 5);
      assert.equal(result.success, result.total >= 20);
    });
  });
})();
