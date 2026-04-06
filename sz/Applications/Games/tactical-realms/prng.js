;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  class PRNG {
    #state;

    constructor(seed) {
      this.#state = seed >>> 0;
    }

    next() {
      let z = (this.#state += 0x6d2b79f5) >>> 0;
      z = Math.imul(z ^ (z >>> 15), z | 1) >>> 0;
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61) >>> 0;
      return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
    }

    nextInt(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    }

    nextBool(p) {
      if (p === undefined)
        p = 0.5;
      return this.next() < p;
    }

    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; --i) {
        const j = this.nextInt(0, i);
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
      }
      return a;
    }

    pick(arr) {
      return arr[this.nextInt(0, arr.length - 1)];
    }

    roll(count, sides) {
      let total = 0;
      for (let i = 0; i < count; ++i)
        total += this.nextInt(1, sides);
      return total;
    }

    d20() {
      return this.nextInt(1, 20);
    }

    fork(label) {
      return new PRNG(this.#state ^ PRNG.hashCode(label));
    }

    get state() {
      return this.#state;
    }

    static hashCode(str) {
      let h = 0;
      for (let i = 0; i < str.length; ++i) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
      }
      return h >>> 0;
    }

    static fromDate(dateStr) {
      return new PRNG(PRNG.hashCode(dateStr));
    }

    // Non-deterministic PRNG for combat, dice rolls, encounters.
    // Seeded from current time + entropy so results are unpredictable.
    static random() {
      return new PRNG((Date.now() ^ (Math.random() * 0x100000000)) >>> 0);
    }
  }

  TR.PRNG = PRNG;
})();
