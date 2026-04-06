;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const PRNG = window.SZ.TacticalRealms.PRNG;

  describe('PRNG', () => {

    it('produces deterministic sequences from same seed', () => {
      const a = new PRNG(42);
      const b = new PRNG(42);
      for (let i = 0; i < 100; ++i)
        assert.equal(a.next(), b.next());
    });

    it('produces different sequences from different seeds', () => {
      const a = new PRNG(1);
      const b = new PRNG(2);
      let same = 0;
      for (let i = 0; i < 50; ++i)
        if (a.next() === b.next()) ++same;
      assert.lessThan(same, 5);
    });

    it('next() returns values in [0, 1)', () => {
      const rng = new PRNG(99);
      for (let i = 0; i < 1000; ++i) {
        const v = rng.next();
        assert.ok(v >= 0 && v < 1, `Value ${v} out of [0,1)`);
      }
    });

    it('nextInt() returns values in [min, max]', () => {
      const rng = new PRNG(7);
      const seen = new Set();
      for (let i = 0; i < 500; ++i) {
        const v = rng.nextInt(3, 7);
        assert.ok(v >= 3 && v <= 7, `Value ${v} out of [3,7]`);
        seen.add(v);
      }
      assert.equal(seen.size, 5);
    });

    it('nextBool() respects probability', () => {
      const rng = new PRNG(100);
      let trueCount = 0;
      const n = 10000;
      for (let i = 0; i < n; ++i)
        if (rng.nextBool(0.3)) ++trueCount;
      const ratio = trueCount / n;
      assert.ok(ratio > 0.25 && ratio < 0.35, `Ratio ${ratio} not near 0.3`);
    });

    it('nextBool() defaults to 50%', () => {
      const rng = new PRNG(200);
      let trueCount = 0;
      const n = 10000;
      for (let i = 0; i < n; ++i)
        if (rng.nextBool()) ++trueCount;
      const ratio = trueCount / n;
      assert.ok(ratio > 0.45 && ratio < 0.55, `Ratio ${ratio} not near 0.5`);
    });

    it('shuffle() returns a permutation of the input', () => {
      const rng = new PRNG(55);
      const arr = [1, 2, 3, 4, 5, 6, 7, 8];
      const shuffled = rng.shuffle(arr);
      assert.equal(shuffled.length, arr.length);
      assert.deepEqual(shuffled.slice().sort((a, b) => a - b), arr);
    });

    it('shuffle() does not mutate the original array', () => {
      const rng = new PRNG(55);
      const arr = [1, 2, 3];
      const copy = arr.slice();
      rng.shuffle(arr);
      assert.deepEqual(arr, copy);
    });

    it('shuffle() is deterministic', () => {
      const a = new PRNG(55);
      const b = new PRNG(55);
      const arr = [1, 2, 3, 4, 5];
      assert.deepEqual(a.shuffle(arr), b.shuffle(arr));
    });

    it('pick() returns an element from the array', () => {
      const rng = new PRNG(33);
      const arr = ['a', 'b', 'c'];
      for (let i = 0; i < 50; ++i)
        assert.includes(arr, rng.pick(arr));
    });

    it('roll() returns values in expected range', () => {
      const rng = new PRNG(10);
      for (let i = 0; i < 200; ++i) {
        const v = rng.roll(2, 6);
        assert.ok(v >= 2 && v <= 12, `2d6 roll ${v} out of [2,12]`);
      }
    });

    it('d20() returns values in [1, 20]', () => {
      const rng = new PRNG(20);
      const seen = new Set();
      for (let i = 0; i < 1000; ++i) {
        const v = rng.d20();
        assert.ok(v >= 1 && v <= 20, `d20 ${v} out of [1,20]`);
        seen.add(v);
      }
      assert.equal(seen.size, 20);
    });

    it('fork() creates a new independent PRNG', () => {
      const parent = new PRNG(42);
      parent.next();
      const child = parent.fork('combat');
      const parentVal = parent.next();
      const childVal = child.next();
      assert.notEqual(parentVal, childVal);
    });

    it('fork() is deterministic for same label', () => {
      const a = new PRNG(42);
      const b = new PRNG(42);
      const childA = a.fork('loot');
      const childB = b.fork('loot');
      assert.equal(childA.next(), childB.next());
    });

    it('fork() produces different streams for different labels', () => {
      const rng = new PRNG(42);
      const state = rng.state;
      const c1 = new PRNG(42).fork('a');
      const c2 = new PRNG(42).fork('b');
      assert.notEqual(c1.next(), c2.next());
    });

    it('hashCode() is deterministic', () => {
      assert.equal(PRNG.hashCode('hello'), PRNG.hashCode('hello'));
    });

    it('hashCode() produces different values for different strings', () => {
      assert.notEqual(PRNG.hashCode('foo'), PRNG.hashCode('bar'));
    });

    it('hashCode() handles empty string', () => {
      assert.equal(PRNG.hashCode(''), 0);
    });

    it('fromDate() creates deterministic PRNG from date string', () => {
      const a = PRNG.fromDate('2024-01-15');
      const b = PRNG.fromDate('2024-01-15');
      assert.equal(a.next(), b.next());
    });

    it('fromDate() produces different streams for different dates', () => {
      const a = PRNG.fromDate('2024-01-15');
      const b = PRNG.fromDate('2024-01-16');
      assert.notEqual(a.next(), b.next());
    });

    it('handles seed of 0', () => {
      const rng = new PRNG(0);
      const v = rng.next();
      assert.ok(v >= 0 && v < 1);
    });

    it('handles large seed values', () => {
      const rng = new PRNG(0xffffffff);
      const v = rng.next();
      assert.ok(v >= 0 && v < 1);
    });
  });
})();
