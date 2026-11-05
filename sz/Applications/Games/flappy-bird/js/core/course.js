;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Course logic for Flappy Bird: the six biomes, the 24 story stages (the fourth of every
   * land ends in a boss arena) and deterministic, seeded generation of gates, coins,
   * power-up bubbles, hazards, storm crows and seasonal tokens. The generator state can be
   * snapshotted and restored, so a saved run continues with exactly the same course.
   * Pure data - no drawing, no DOM, so it can run under node tests.
   */

  const GROUND_Y = 640;
  const GATE_W = 72;
  const MARGIN = 72;
  const MIN_GAP = 110;

  const BUBBLE_KINDS = ['shield', 'magnet', 'slow', 'ghost', 'double', 'tiny', 'blast', 'rush', 'heart', 'freeze', 'gold', 'buddy'];
  const BOSS_ORDER = ['bee', 'wyrm', 'owl', 'moth', 'crowbot', 'corvus'];

  /* mulberry32 with its state in an object, so the generator can be saved and resumed */
  function rngState(seed) {
    return { a: seed >>> 0 };
  }

  function nextRandom(st) {
    st.a = (st.a + 0x6D2B79F5) >>> 0;
    let t = st.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function rng(seed) {
    const st = rngState(seed);
    return function() {
      return nextRandom(st);
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

  function dateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function dailySeed(date) {
    return hashSeed('flappy-' + dateKey(date));
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
        gates: s === 3 ? 12 + 2 * w : 18 + 4 * s + 2 * w,
        gap: Math.round(205 - 2.4 * d),
        speed: +(2.7 + 0.06 * d).toFixed(2),
        spacing: 380 - 4 * d,
        moveChance: s === 0 ? 0 : Math.min(0.5, 0.15 + 0.03 * d),
        closeChance: w < 2 ? 0 : Math.min(0.4, 0.1 + 0.02 * d),
        hazardChance: w === 0 ? 0 : Math.min(0.75, 0.35 + 0.1 * s),
        crowChance: w === 0 || s === 0 ? 0 : Math.min(0.35, 0.08 + 0.03 * d),
        bubbleEvery: 6
      };
      if (s === 3) {
        stage.final = true;
        stage.boss = BOSS_ORDER[w];
      }
      STAGES.push(Object.freeze(stage));
    }
  }

  /* Endless parameters per gate index; the profile shapes them for Zen and Arcade */
  function endlessParams(index, profile) {
    const tier = Math.floor(index / 12);
    if (profile === 'zen') {
      return {
        gap: 235, speed: 2.3, spacing: 400, moveChance: tier < 2 ? 0 : 0.15, closeChance: 0,
        hazardChance: 0, crowChance: 0, biome: BIOME_ORDER[Math.floor(index / 30) % BIOME_ORDER.length], bubbleEvery: 6
      };
    }
    const arcade = profile === 'arcade';
    const t = arcade ? tier * 1.15 + 0.5 : tier;
    return {
      gap: Math.max(122, 190 - 2.5 * t),
      speed: Math.min(arcade ? 5.8 : 5.4, 2.7 + 0.18 * t),
      spacing: Math.max(252, 360 - 5 * t),
      moveChance: t < 1 ? 0 : Math.min(0.5, 0.1 + 0.04 * t),
      closeChance: t < 3 ? 0 : Math.min(0.35, 0.05 + 0.03 * t),
      hazardChance: t < 1 ? 0 : Math.min(0.6, 0.25 + 0.05 * t),
      crowChance: t < 2 ? 0 : Math.min(arcade ? 0.35 : 0.2, 0.05 + 0.025 * t),
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

  /* opts: seed, stage, profile ('endless' | 'zen' | 'arcade'), bubbleEvery, tokenEvery,
     mods { gapScale, speedScale, hazardBoost, crowBoost } (daily twists) */
  function createCourse(opts) {
    const stage = opts.stage || null;
    const mods = opts.mods || {};
    const gen = { r: rngState(opts.seed), nextX: 900, index: 0, totalCoins: 0, nextId: 1, prevLaser: false };
    const r = function() {
      return nextRandom(gen.r);
    };

    const course = {
      gates: [],
      coins: [],
      bubbles: [],
      hazards: [],
      tokens: [],
      finishX: Infinity,
      totalCoins: 0,
      stage: stage,
      ensure: function() {},
      prune: function() {},
      snapshot: snapshot,
      restore: restore
    };

    function params(i) {
      const p = stage || endlessParams(i, opts.profile);
      if (!mods.gapScale && !mods.speedScale && !mods.hazardBoost && !mods.crowBoost)
        return p;
      const q = Object.assign({}, p);
      if (mods.gapScale)
        q.gap = Math.max(MIN_GAP + 10, p.gap * mods.gapScale);
      if (mods.speedScale)
        q.speed = p.speed * mods.speedScale;
      if (mods.hazardBoost)
        q.hazardChance = Math.min(0.85, p.hazardChance + mods.hazardBoost);
      if (mods.crowBoost)
        q.crowChance = Math.min(0.6, (p.crowChance || 0) + mods.crowBoost);
      return q;
    }

    function addCoin(x, y) {
      course.coins.push({ id: gen.nextId++, x: x, y: y, taken: false });
      ++gen.totalCoins;
    }

    function addGate() {
      const i = gen.index++;
      const p = params(i);
      const biome = stage ? stage.biome : p.biome;
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
        // the gate right behind a laser gate holds still, so the beam never forces a lunge
        if (move.amp < 20 || gen.prevLaser)
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

      const x = gen.nextX;
      const gate = { id: gen.nextId++, index: i, x: x, gapY: gapY, gap: gap, biome: biome, move: move, close: close };
      course.gates.push(gate);
      gen.prevLaser = false;
      gen.nextX += p.spacing;

      if (prev) {
        const arcWanted = r() < 0.5;
        const mid = (prev.x + GATE_W + gate.x) / 2;
        const midY = (prev.gapY + gapY) / 2;
        let bubble = null;
        const every = typeof opts.bubbleEvery === 'number' ? opts.bubbleEvery : p.bubbleEvery;
        if (i % every === 0) {
          bubble = { id: gen.nextId++, x: mid, y: midY, kind: BUBBLE_KINDS[Math.floor(r() * BUBBLE_KINDS.length)], taken: false };
          course.bubbles.push(bubble);
        }
        let hazard = null;
        const hazardType = BIOMES[biome].hazard;
        if (!bubble && hazardType && r() < p.hazardChance) {
          const id = gen.nextId++;
          if (hazardType === 'gust')
            hazard = { id: id, type: 'gust', x: mid - 90, w: 180, dir: r() < 0.5 ? -1 : 1, strength: 0.22 };
          else if (hazardType === 'icicle')
            hazard = { id: id, type: 'icicle', x: mid, len: 70 + r() * 50 };
          else if (hazardType === 'bat')
            hazard = { id: id, type: 'bat', x: mid, y: midY, amp: 50 + r() * 40, period: 1.4 + r() * 0.8, phase: r() * Math.PI * 2 };
          else if (hazardType === 'laser') {
            // A scanner beam sweeps up and down across this gate's gap; the bird slips past
            // above or below it. One per pair of gates, never on a closing gate.
            // the gap of a laser gate is 30 px roomier and its sweep slow
            gate.gap += 30;
            const glo = MARGIN + gate.gap / 2, ghi = GROUND_Y - MARGIN - gate.gap / 2;
            gate.gapY = Math.max(glo, Math.min(ghi, gate.gapY));
            if (gate.move)
              gate.move.amp = Math.max(0, Math.min(gate.move.amp, gate.gapY - glo, ghi - gate.gapY));
            gate.close = null;
            hazard = { id: id, type: 'laser', x: gate.x, gate: i, period: 3.4 + r() * 1.0, phase: r() * Math.PI * 2, dir: r() < 0.5 ? -1 : 1,
              gapY: gate.gapY, gap: gate.gap, move: gate.move };
            gen.prevLaser = true;
          }
          else
            hazard = { id: id, type: 'fireball', x: mid, period: 2.2 + r() * 0.8, phase: r() * 3, height: 0.45 + r() * 0.25 };
          course.hazards.push(hazard);
        }
        // A storm crow waits between gates and dives at the bird once it comes close
        if (!bubble && !hazard && p.crowChance && r() < p.crowChance) {
          hazard = { id: gen.nextId++, type: 'crow', x: mid + 60, y: midY + (r() < 0.5 ? -1 : 1) * (40 + r() * 60), home: 0 };
          hazard.home = hazard.y;
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
      // Seasonal tokens wait just behind every few gaps, at the gap's height
      if (opts.tokenEvery && i % opts.tokenEvery === 2)
        course.tokens.push({ id: gen.nextId++, x: gate.x + GATE_W + 44, y: gapY, taken: false });
    }

    function snapshot() {
      return {
        gen: { a: gen.r.a, nextX: gen.nextX, index: gen.index, totalCoins: gen.totalCoins, nextId: gen.nextId, prevLaser: !!gen.prevLaser },
        gates: course.gates, coins: course.coins, bubbles: course.bubbles, hazards: course.hazards, tokens: course.tokens
      };
    }

    function restore(snap) {
      gen.r.a = snap.gen.a >>> 0;
      gen.nextX = snap.gen.nextX;
      gen.index = snap.gen.index;
      gen.totalCoins = snap.gen.totalCoins;
      gen.nextId = snap.gen.nextId;
      gen.prevLaser = !!snap.gen.prevLaser;
      course.gates = snap.gates;
      course.coins = snap.coins;
      course.bubbles = snap.bubbles;
      course.hazards = snap.hazards;
      course.tokens = snap.tokens || [];
      course.totalCoins = stage ? course.totalCoins : gen.totalCoins;
    }

    if (stage) {
      for (let i = 0; i < stage.gates; ++i)
        addGate();
      course.finishX = course.gates[course.gates.length - 1].x + GATE_W + 320;
      course.totalCoins = course.coins.length;
    } else {
      course.ensure = function(x) {
        while (gen.nextX < x + 1600)
          addGate();
        course.totalCoins = gen.totalCoins;
      };
      course.prune = function(x) {
        const cut = x - 400;
        const keep = o => o.x >= cut;
        if (course.gates.length && course.gates[0].x < cut)
          course.gates = course.gates.filter(keep);
        if (course.coins.length && course.coins[0].x < cut)
          course.coins = course.coins.filter(keep);
        if (course.bubbles.length && course.bubbles[0].x < cut)
          course.bubbles = course.bubbles.filter(keep);
        if (course.hazards.length && course.hazards[0].x < cut - 400)
          course.hazards = course.hazards.filter(h => h.x >= cut - 400);
        if (course.tokens.length && course.tokens[0].x < cut)
          course.tokens = course.tokens.filter(keep);
        course.totalCoins = gen.totalCoins;
      };
      course.ensure(0);
    }
    return course;
  }

  SZ.FlappyCourse = Object.freeze({
    GROUND_Y, GATE_W, MARGIN, MIN_GAP, BIOMES, BIOME_ORDER, STAGES, BUBBLE_KINDS, BOSS_ORDER,
    rng, rngState, nextRandom, hashSeed, dateKey, dailySeed, endlessParams, gateShape, createCourse
  });
})();
