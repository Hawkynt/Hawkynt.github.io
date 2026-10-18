;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Course logic for Flappy Bird: the six biomes, the 24 adventure stages and
   * deterministic, seeded generation of gates, coins, power-up bubbles and
   * hazards. Pure data - no drawing, no DOM, so it can run under node tests.
   */

  const GROUND_Y = 640;
  const GATE_W = 72;
  const MARGIN = 72;
  const MIN_GAP = 110;

  const BUBBLE_KINDS = ['shield', 'magnet', 'slow', 'ghost', 'double', 'tiny'];

  function rng(seed) {
    let a = seed >>> 0;
    return function() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; ++i) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function dailySeed(date) {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return hashSeed('flappy-' + y + '-' + m + '-' + d);
  }

  const BIOMES = {
    meadow: Object.freeze({ id: 'meadow', name: 'Sunny Meadow', hazard: null }),
    desert: Object.freeze({ id: 'desert', name: 'Dune Canyon', hazard: 'gust' }),
    frost: Object.freeze({ id: 'frost', name: 'Frost Peaks', hazard: 'icicle' }),
    forest: Object.freeze({ id: 'forest', name: 'Twilight Woods', hazard: 'bat' }),
    city: Object.freeze({ id: 'city', name: 'Neon City', hazard: 'laser' }),
    volcano: Object.freeze({ id: 'volcano', name: 'Ember Volcano', hazard: 'fireball' })
  };
  const BIOME_ORDER = Object.freeze(['meadow', 'desert', 'frost', 'forest', 'city', 'volcano']);

  const STAGES = [];
  for (let w = 0; w < 6; ++w) {
    for (let s = 0; s < 4; ++s) {
      const d = w * 4 + s;
      const biome = BIOME_ORDER[w];
      const stage = {
        id: `${w + 1}-${s + 1}`,
        world: w,
        stage: s,
        biome: biome,
        name: `${BIOMES[biome].name} ${s + 1}`,
        gates: 18 + 4 * s + 2 * w,
        gap: 205 - 3 * d,
        speed: +(2.7 + 0.08 * d).toFixed(2),
        spacing: 380 - 4 * d,
        moveChance: s === 0 ? 0 : Math.min(0.6, 0.15 + 0.03 * d),
        closeChance: w < 2 ? 0 : Math.min(0.4, 0.1 + 0.02 * d),
        hazardChance: w === 0 ? 0 : Math.min(0.75, 0.35 + 0.1 * s),
        bubbleEvery: 6
      };
      if (s === 3)
        stage.final = true;
      STAGES.push(Object.freeze(stage));
    }
  }

  function endlessParams(index) {
    const tier = Math.floor(index / 12);
    return {
      gap: Math.max(122, 190 - 2.5 * tier),
      speed: Math.min(5.4, 2.7 + 0.18 * tier),
      spacing: Math.max(252, 360 - 5 * tier),
      moveChance: tier < 1 ? 0 : Math.min(0.5, 0.1 + 0.04 * tier),
      closeChance: tier < 3 ? 0 : Math.min(0.35, 0.05 + 0.03 * tier),
      hazardChance: tier < 1 ? 0 : Math.min(0.6, 0.25 + 0.05 * tier),
      biome: BIOME_ORDER[Math.floor(index / 25) % BIOME_ORDER.length],
      bubbleEvery: 7
    };
  }

  // Where a gate's opening is and how wide it is at t seconds into the run.
  function gateShape(gate, t) {
    const y = gate.gapY + (gate.move
      ? gate.move.amp * Math.sin(Math.PI * 2 * t / gate.move.period + gate.move.phase)
      : 0);
    const gap = gate.gap - (gate.close
      ? gate.close.amount * (0.5 + 0.5 * Math.sin(Math.PI * 2 * t / gate.close.period + gate.close.phase))
      : 0);
    return { y: y, gap: gap };
  }

  function createCourse(opts) {
    const stage = opts.stage || null;
    const r = rng(opts.seed);
    let nextX = 900;
    let index = 0;
    let totalCoins = 0;

    const course = {
      gates: [],
      coins: [],
      bubbles: [],
      hazards: [],
      finishX: Infinity,
      totalCoins: 0,
      stage: stage,
      ensure: function() {},
      prune: function() {}
    };

    function params(i) {
      return stage || endlessParams(i);
    }

    function addCoin(x, y) {
      course.coins.push({ x: x, y: y, taken: false });
      ++totalCoins;
    }

    function addGate() {
      const i = index++;
      const p = params(i);
      const biome = stage ? stage.biome : endlessParams(i).biome;
      const gap = p.gap;
      const lo = MARGIN + gap / 2;
      const hi = GROUND_Y - MARGIN - gap / 2;
      let gapY = lo + r() * (hi - lo);
      const prev = course.gates.length ? course.gates[course.gates.length - 1] : null;
      if (prev) {
        const maxDelta = 150 + p.spacing * 0.4;
        if (gapY < prev.gapY - maxDelta)
          gapY = prev.gapY - maxDelta;
        else if (gapY > prev.gapY + maxDelta)
          gapY = prev.gapY + maxDelta;
      }
      if (gapY < lo)
        gapY = lo;
      else if (gapY > hi)
        gapY = hi;

      let move = null;
      if (r() < p.moveChance) {
        move = {
          amp: Math.min(60 + r() * 50, gapY - lo, hi - gapY),
          period: 2.2 + r() * 1.6,
          phase: r() * Math.PI * 2
        };
        if (move.amp < 20)
          move = null;
      }
      let close = null;
      if (!move && r() < p.closeChance) {
        close = {
          amount: Math.min(40, gap - MIN_GAP),
          period: 1.8 + r() * 1.2,
          phase: r() * Math.PI * 2
        };
        if (close.amount < 12)
          close = null;
      }

      const gate = { index: i, x: nextX, gapY: gapY, gap: gap, biome: biome, move: move, close: close };
      course.gates.push(gate);
      nextX += p.spacing;

      if (prev) {
        const arcWanted = r() < 0.5;
        let bubble = null;
        if (i % (typeof opts.bubbleEvery === 'number' ? opts.bubbleEvery : p.bubbleEvery) === 0) {
          bubble = {
            x: (prev.x + GATE_W + gate.x) / 2,
            y: (prev.gapY + gapY) / 2,
            kind: BUBBLE_KINDS[Math.floor(r() * BUBBLE_KINDS.length)],
            taken: false
          };
          course.bubbles.push(bubble);
        }
        let hazard = null;
        const hazardType = BIOMES[biome].hazard;
        if (!bubble && hazardType && r() < p.hazardChance) {
          const mid = (prev.x + GATE_W + gate.x) / 2;
          if (hazardType === 'gust')
            hazard = { type: 'gust', x: mid - 90, w: 180, dir: r() < 0.5 ? -1 : 1, strength: 0.22 };
          else if (hazardType === 'icicle')
            hazard = { type: 'icicle', x: mid, len: 70 + r() * 50 };
          else if (hazardType === 'bat')
            hazard = { type: 'bat', x: mid, y: (prev.gapY + gapY) / 2, amp: 50 + r() * 40, period: 1.4 + r() * 0.8, phase: r() * Math.PI * 2 };
          else if (hazardType === 'laser')
            // One hazard per pair of gates, so a gate ever carries at most one beam.
            hazard = { type: 'laser', x: gate.x, gate: i, on: 1.0 + r() * 0.4, off: 1.2 + r() * 0.6, phase: r() * 2 };
          else
            hazard = { type: 'fireball', x: mid, period: 2.2 + r() * 0.8, phase: r() * 3, height: 0.45 + r() * 0.25 };
          course.hazards.push(hazard);
        }
        // Arc coins go in before this gate's coins so the coin list stays sorted by x.
        if (arcWanted && !bubble && !hazard) {
          for (let k = 1; k <= 5; ++k) {
            const u = k / 6;
            addCoin(
              prev.x + GATE_W + u * (gate.x - prev.x - GATE_W),
              prev.gapY + (gapY - prev.gapY) * u - 70 * Math.sin(Math.PI * u)
            );
          }
        }
      }
      addCoin(gate.x + GATE_W / 2 - 40, gapY);
      addCoin(gate.x + GATE_W / 2, gapY);
      addCoin(gate.x + GATE_W / 2 + 40, gapY);
    }

    if (stage) {
      for (let i = 0; i < stage.gates; ++i)
        addGate();
      course.finishX = course.gates[course.gates.length - 1].x + GATE_W + 320;
      course.totalCoins = course.coins.length;
    } else {
      course.ensure = function(x) {
        while (nextX < x + 1600)
          addGate();
        course.totalCoins = totalCoins;
      };
      course.prune = function(x) {
        const cut = x - 400;
        course.gates = course.gates.filter(g => g.x >= cut);
        course.coins = course.coins.filter(c => c.x >= cut);
        course.bubbles = course.bubbles.filter(b => b.x >= cut);
        course.hazards = course.hazards.filter(h => h.x >= cut);
        course.totalCoins = totalCoins;
      };
      course.ensure(0);
    }
    return course;
  }

  SZ.FlappyCourse = Object.freeze({
    GROUND_Y, GATE_W, BIOMES, BIOME_ORDER, STAGES,
    rng, hashSeed, dailySeed, endlessParams, gateShape, createCourse
  });
})();
