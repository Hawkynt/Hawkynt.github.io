;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const { Controller } = window.SZ.TacticalRealms;

  /* Left-clicking a creature on the battlefield runs Controller#_approachAndAttack:
     it walks to a tile next to the target and attacks from there. When no tile
     adjacent to the target is inside the movement range, it has to close the gap
     by picking the reachable tile that is genuinely nearest the target. */
  function stubEngine(moveRange, unit) {
    const calls = [];
    return {
      calls,
      currentUnit: unit,
      moveRange,
      grid: { isOccupied: () => false, unitAt: () => null, inBounds: () => false, neighbors: () => [] },
      selectMoveTile: (col, row) => { calls.push({ col, row }); return true; },
      confirmMove: () => {},
      selectAttack: () => {},
      selectTarget: () => null,
    };
  }

  function approach(moveRange, unit, target) {
    const eng = stubEngine(moveRange, unit);
    const self = { _combatEngine: eng, _startAttackAnim: () => {} };
    Controller.prototype._approachAndAttack.call(self, target);
    return eng.calls[0];
  }

  describe('_approachAndAttack', () => {
    it('attacks from a tile adjacent to the target when one is reachable', () => {
      const unit = { id: 'u1', position: { col: 9, row: 0 } };
      const target = { id: 't1', position: { col: 12, row: 0 } };
      const range = new Map([['11,0', 2], ['9,8', 2]]);
      const moved = approach(range, unit, target);
      assert.deepEqual(moved, { col: 11, row: 0 }, 'walks next to the target instead of anywhere else');
    });

    it('closes the gap toward the target when no adjacent tile is reachable', () => {
      const unit = { id: 'u1', position: { col: 0, row: 0 } };
      const target = { id: 't1', position: { col: 12, row: 8 } };
      /* neither tile touches the target, so the approach has to fall back to the
         reachable one nearest it: (14,8) is 2 steps away, (10,4) is 6 -- a metric
         that leans on the column alone prefers (10,4) and the unit sidesteps */
      const range = new Map([['10,4', 6], ['14,8', 6]]);
      const moved = approach(range, unit, target);
      assert.deepEqual(moved, { col: 14, row: 8 }, 'steps toward the target, not along the column');
    });
  });
})();
