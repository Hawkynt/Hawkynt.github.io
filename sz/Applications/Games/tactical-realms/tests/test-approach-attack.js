;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const { Controller, CombatGrid } = window.SZ.TacticalRealms;

  /* Left-clicking a creature on the battlefield runs Controller#_approachAndAttack:
     it walks to a square the action is legal from and attacks from there -- as close
     as needed, never closer: a reach weapon keeps its wielder a square further back,
     and a creature too far away this turn just closes the distance. */
  function openGrid(w, h) {
    const terrain = [];
    for (let i = 0; i < w * h; ++i)
      terrain.push('plains');
    return new CombatGrid(w, h, terrain);
  }

  function scenario(unit, target) {
    const grid = openGrid(16, 16);
    const calls = { move: [], target: [], attack: 0 };
    const eng = {
      grid,
      currentUnit: unit,
      moveRange: null,
      selectMoveTile: (col, row) => { calls.move.push({ col, row }); return true; },
      confirmMove: () => {},
      selectAttack: () => { calls.attack++; },
      selectTarget: (col, row) => { calls.target.push({ col, row }); return null; },
    };
    const { Pathfinding } = window.SZ.TacticalRealms;
    eng.moveRange = Pathfinding.movementRange(grid, unit.position, unit.speedTiles, unit.faction, unit.passMode);
    const self = Object.create(Controller.prototype);
    self._combatEngine = eng;
    self._startAttackAnim = () => {};
    Controller.prototype._approachAndAttack.call(self, target);
    return { calls, self };
  }

  function makeUnit(col, row, speedTiles, weaponProperties) {
    return {
      id: 'u1',
      faction: 'party',
      position: { col, row },
      speedTiles,
      passMode: null,
      character: {
        equipment: weaponProperties ? { mainHand: { properties: weaponProperties } } : null,
      },
    };
  }

  describe('spell ranges on the grid', () => {
    it('reads the ranges the book writes as words', () => {
      const { Spells } = window.SZ.TacticalRealms;
      assert.equal(Spells.rangeTiles('personal'), 0);
      assert.equal(Spells.rangeTiles('touch'), 1);
      assert.equal(Spells.rangeTiles('close'), 5);
      assert.equal(Spells.rangeTiles('medium'), 20);
      assert.equal(Spells.rangeTiles('long'), 40);
      assert.ok(Spells.isInRange(0, 0, 3, 1, Spells.rangeTiles('close')), 'a close spell reaches 4 squares away');
      assert.ok(!Spells.isInRange(0, 0, 3, 3, Spells.rangeTiles('touch')), 'a touch spell does not');
    });

    it('converts feet to squares and leaves the shipped spells alone', () => {
      const { Spells } = window.SZ.TacticalRealms;
      assert.equal(Spells.rangeTiles(60), 12, '60 feet is twelve squares');
      assert.equal(Spells.rangeTiles(5), 5);
      assert.equal(Spells.rangeTiles(3), 3, 'the built-in spells already count squares');
      assert.equal(Spells.rangeTiles(0), 0);
    });
  });

  describe('weapon reach', () => {
    it('a reach weapon hits from two squares, anything else from one', () => {
      const { D20 } = window.SZ.TacticalRealms;
      const reach = { equipment: { mainHand: { properties: ['reach', 'trip'] } } };
      const plain = { equipment: { mainHand: { properties: [] } } };
      assert.equal(D20.attackReach(reach), 2);
      assert.equal(D20.attackReach(plain), 1);
      assert.equal(D20.attackReach(null), 1, 'an unarmed character still swings normally');
      assert.ok(D20.isAdjacent({ col: 0, row: 0 }, { col: 2, row: 0 }, D20.attackReach(reach)));
      assert.ok(!D20.isAdjacent({ col: 0, row: 0 }, { col: 2, row: 0 }, D20.attackReach(plain)));
    });
  });

  describe('_approachAndAttack', () => {
    it('walks to a square next to the target and attacks from there', () => {
      const unit = makeUnit(9, 0, 6, null);
      const target = { id: 't1', faction: 'enemy', position: { col: 12, row: 0 } };
      const { calls, self } = scenario(unit, target);
      assert.deepEqual(calls.move, [{ col: 11, row: 0 }], 'one step to the target\'s flank');
      assert.equal(typeof self._combatMoveCallback, 'function', 'the swing waits for the walk to land');
      self._combatMoveCallback();
      assert.equal(calls.attack, 1, 'and then the attack is attempted');
      assert.deepEqual(calls.target, [{ col: 12, row: 0 }], 'at the target');
    });

    it('a reach weapon stops one square further back', () => {
      const unit = makeUnit(9, 0, 6, ['reach']);
      const target = { id: 't1', faction: 'enemy', position: { col: 12, row: 0 } };
      const { calls, self } = scenario(unit, target);
      assert.deepEqual(calls.move, [{ col: 10, row: 0 }], 'two squares off, the reach of the weapon');
      self._combatMoveCallback();
      assert.equal(calls.attack, 1, 'and the attack still lands from there');
    });

    it('closes the distance without swinging when nothing reachable is in reach', () => {
      const unit = makeUnit(0, 0, 2, null);
      const target = { id: 't1', faction: 'enemy', position: { col: 12, row: 8 } };
      const { calls } = scenario(unit, target);
      assert.equal(calls.move.length, 1, 'it does move');
      const moved = calls.move[0];
      const before = Math.abs(0 - 12) + Math.abs(0 - 8);
      const after = Math.abs(moved.col - 12) + Math.abs(moved.row - 8);
      assert.ok(after < before, `steps toward the target (${before} -> ${after})`);
      assert.equal(calls.attack, 0, 'no swing is wasted from out of reach');
    });
  });
})();
