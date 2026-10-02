;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const CombatFx = TR.CombatFx;

  const fakeCtx = () => document.createElement('canvas').getContext('2d');

  describe('CombatFx -- lifecycle', () => {

    it('starts idle', () => {
      const fx = new CombatFx();
      assert.equal(fx.busy, false);
      assert.equal(fx.numberCount, 0);
    });

    it('hit adds a damage number that expires', () => {
      const fx = new CombatFx();
      fx.hit('u1', 100, 100, 7);
      assert.equal(fx.numberCount, 1);
      for (let i = 0; i < 120; ++i)
        fx.update(1 / 60);
      assert.equal(fx.numberCount, 0);
    });

    it('clear removes numbers, reactions and deaths', () => {
      const fx = new CombatFx();
      fx.hit('u1', 0, 0, 3);
      fx.death('u1', 0, 0);
      fx.clear();
      assert.equal(fx.numberCount, 0);
      assert.equal(fx.isDying('u1'), false);
    });
  });

  describe('CombatFx -- unit reactions', () => {

    it('hit pushes the unit away from the attacker and flashes it', () => {
      const fx = new CombatFx();
      fx.hit('u1', 100, 100, 5, { fromX: 50, fromY: 100 });
      fx.update(0.1);
      const st = fx.unitState('u1', 48);
      assert.ok(st.dx > 0, 'knocked back to the right');
      assert.ok(st.flash > 0, 'flashing');
    });

    it('reactions settle back to rest', () => {
      const fx = new CombatFx();
      fx.hit('u1', 100, 100, 5, { fromX: 50, fromY: 100 });
      fx.update(1);
      const st = fx.unitState('u1', 48);
      assert.equal(st.dx, 0);
      assert.equal(st.flash, 0);
    });

    it('miss makes the unit sidestep', () => {
      const fx = new CombatFx();
      fx.miss('u1', 0, 0);
      fx.update(0.15);
      assert.ok(fx.unitState('u1', 48).dx < 0);
    });

    it('death fades the unit out but never fully', () => {
      const fx = new CombatFx();
      fx.death('u1', 0, 0);
      fx.update(5);
      const st = fx.unitState('u1', 48);
      assert.ok(st.dying);
      assert.ok(st.alpha > 0.2 && st.alpha < 0.35, `alpha ${st.alpha}`);
    });

    it('unknown units are at rest', () => {
      const st = new CombatFx().unitState('nobody', 48);
      assert.deepEqual(st, { dx: 0, dy: 0, flash: 0, alpha: 1, tint: null, dying: false });
    });
  });

  describe('CombatFx -- drawing', () => {

    it('draws numbers, particles and shake without throwing', () => {
      const fx = new CombatFx();
      const ctx = fakeCtx();
      fx.hit('u1', 10, 10, 12, { crit: true });
      fx.heal('u2', 20, 20, 4);
      fx.spell(30, 30, '#f0f');
      fx.update(0.05);
      fx.beginShake(ctx);
      fx.drawParticles(ctx);
      fx.drawNumbers(ctx);
      fx.endShake(ctx);
      assert.ok(true);
    });
  });
})();
