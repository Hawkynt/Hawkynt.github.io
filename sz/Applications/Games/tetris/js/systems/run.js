/* A game session as one plain object (saved as JSON for Continue): the mode, the story stage or
   guardian, the engine game built with the profile's tech tree (preview, lock delay, gravity,
   orbs, score), mutators, the stage objective, power slots, Aegis and Second Chance, rising
   garbage, a guardian fight or a Boss Rush chain. tick() advances it on a fixed step, feeds the
   engine's events to the guardian and the powers, and decides when the session is won or lost.
   No drawing, sound or storage here. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const C = NS.constants;
  const E = NS.engine;
  const P = NS.progress;
  const W = NS.worldData;
  const SE = NS.seasons;
  const { hashString } = NS.rng;

  /* opts: stage (id), seed, date */
  function build(mode, opts, profile) {
    opts = opts || {};
    const T = name => P.stat(profile, name);
    const date = opts.date || new Date();
    const seed = opts.seed != null ? opts.seed : mode === 'daily' ? SE.dailyRecipe(date).seed : (hashString(mode + ':' + Date.now() + ':' + Math.random()) >>> 0);
    const stage = mode === 'story' ? W.BY_ID[opts.stage] : null;
    let mutators = [];
    if (mode === 'daily') mutators = SE.dailyRecipe(date).mutators.slice();
    if (opts.mutators) mutators = opts.mutators.slice();
    const mut = mutators.map(id => SE.MUT_BY_ID[id]);
    const has = k => mut.find(m => m[k]);
    let level = 1, levelMode = 'lines', gravity = 0;
    if (stage) { level = stage.level; levelMode = 'fixed'; }
    if (mode === 'sprint' || mode === 'zen') levelMode = 'fixed';
    if (mode === 'master') gravity = 1200;
    if (has('levelUp')) level += has('levelUp').levelUp;
    const gravityMul = stage ? Math.max(0.5, 1 - T('gravityCut')) : mode === 'zen' ? 0.6 : 1;
    const preview = Math.min(C.NEXT_MAX, 3 + Math.round(T('preview')));
    const holdAllowed = !has('noHold');
    const game = E.create({
      seed: seed, level: level, levelMode: levelMode, gravity: gravity, gravityMul: gravityMul,
      lockDelay: C.LOCK_DELAY + T('lockDelay'), preview: has('preview') ? 2 : preview, hold: holdAllowed,
      orbChance: mode === 'master' ? 0 : (has('orbs') ? has('orbs').orbs : 0.07 + T('orbChance')), zen: mode === 'zen',
    });
    const scoreMul = 1 + T('scoreGain') + T('allGain');
    game.scoreMul = scoreMul;
    const run = {
      mode: mode, stage: stage ? stage.id : null, world: stage ? stage.world : mode === 'rush' ? 0 : 0, seed: seed, game: game,
      t: 0, acc: 0, timeLimit: 0, kind: stage ? stage.kind : mode, target: stage ? stage.n : 0,
      powers: [], slots: 1 + Math.round(T('slots')), powersUsed: 0, rushT: 0, shield: false, revives: Math.round(T('revive')),
      baseScoreMul: scoreMul, baseGravityMul: gravityMul, holdAllowed: holdAllowed,
      riseT: 0, rise: 0, mirrorT: 0, mirror: 0, invisible: !!has('invisible'), mutators: mutators,
      boss: false, bossState: null, rushIndex: 0, hitsTaken: 0, tokens: 0, b2bChain: 0, bestB2B: 0, noHoldLines: 0,
      events: [], done: false, won: false, reason: '', day: mode === 'daily' ? SE.dailyRecipe(date).key : '',
    };
    if (stage) {
      if (stage.time) run.timeLimit = stage.time;
      if (stage.kind === 'dig' || stage.kind === 'gems' || stage.kind === 'combo') {
        const n = stage.garbage || 0;
        for (let i = 0; i < n; ++i) E.addGarbage(game, 1, null, { gem: stage.kind === 'gems' && i % 2 === 0 });
      }
      if (stage.kind === 'survive') { run.timeLimit = stage.time; run.rise = stage.rise; run.riseT = stage.rise; }
      if (stage.kind === 'boss') startBoss(run, stage.world, profile, 1);
    }
    if (mode === 'sprint') run.target = 40;
    if (mode === 'ultra') run.timeLimit = 120;
    if (mode === 'daily') run.timeLimit = 180;
    if (mode === 'rush') startBoss(run, 0, profile, 0.8);
    if (has('rise')) { run.rise = has('rise').rise; run.riseT = run.rise; }
    if (has('mirror')) { run.mirror = has('mirror').mirror; run.mirrorT = run.mirror; }
    if (has('gems')) for (let i = 0; i < has('gems').gems; ++i) E.addGarbage(game, 1, null, { gem: true });
    E.takeEvents(game);
    return run;
  }

  function startBoss(run, w, profile, scale) {
    run.boss = true;
    run.world = w;
    run.bossState = NS.boss.create(w, profile, scale);
    if (P.stat(profile, 'startShield') > 0) run.shield = true;
  }

  /* what the objective needs and has: { have, need, text } */
  function objective(run) {
    const g = run.game;
    switch (run.kind) {
      case 'lines': return { have: g.lines, need: run.target, text: 'Clear ' + run.target + ' lines' };
      case 'score': return { have: g.score, need: run.target, text: 'Score ' + run.target.toLocaleString('en-US') };
      case 'dig': return { have: run.digStart ? run.digStart - E.garbageLeft(g) / C.COLS : 0, need: run.digStart || 1, text: 'Dig out every garbage row' };
      case 'gems': return { have: (run.gemStart || 0) - E.gemsLeft(g), need: run.gemStart || 1, text: 'Clear every gem' };
      case 'survive': return { have: Math.min(run.t, run.timeLimit), need: run.timeLimit, text: 'Survive the rising tide' };
      case 'combo': return { have: g.stats.maxCombo, need: run.target, text: 'Reach a combo of ' + run.target };
      case 'boss': case 'rush': {
        const bs = run.bossState;
        return { have: bs ? bs.max - bs.hp : 0, need: bs ? bs.max : 1, text: 'Defeat ' + W.BOSSES[run.world].name };
      }
      case 'sprint': return { have: g.lines, need: 40, text: 'Clear 40 lines' };
      case 'ultra': case 'daily': return { have: run.t, need: run.timeLimit, text: 'Score as much as you can' };
      default: return { have: g.lines, need: 0, text: '' };
    }
  }

  function bonusMet(run, b) {
    const s = run.game.stats;
    if (!b) return false;
    if (b.k === 'quads') return s.quads >= b.n;
    if (b.k === 'tspins') return s.tspins >= b.n;
    if (b.k === 'combo') return s.maxCombo >= b.n;
    if (b.k === 'nohold') return s.holds === 0;
    if (b.k === 'perfect') return s.perfects >= 1;
    if (b.k === 'nohit') return run.hitsTaken === 0;
    return false;
  }

  function bonusText(b) {
    if (!b) return '';
    if (b.k === 'quads') return 'Clear ' + (b.n > 1 ? b.n + ' quads' : 'a quad');
    if (b.k === 'tspins') return 'Land ' + (b.n > 1 ? b.n + ' T-spin clears' : 'a T-spin clear');
    if (b.k === 'combo') return 'Reach a combo of ' + b.n;
    if (b.k === 'nohold') return 'Never use hold';
    if (b.k === 'perfect') return 'Make a perfect clear';
    if (b.k === 'nohit') return 'Take no garbage hits';
    return '';
  }

  function finish(run, won, reason) {
    if (run.done) return;
    run.done = true;
    run.won = won;
    run.reason = reason;
    run.events.push({ type: 'finish', won: won, reason: reason });
  }

  /* the objective is checked after every step */
  function judge(run, profile) {
    const g = run.game;
    if (run.done) return;
    if (g.over) {
      if (run.revives > 0) {
        --run.revives;
        revive(run);
        return;
      }
      if (run.shield && g.reason !== 'lockout') {
        run.shield = false;
        revive(run);
        return;
      }
      finish(run, run.mode === 'marathon' || run.mode === 'master', 'topout');
      return;
    }
    const o = objective(run);
    switch (run.kind) {
      case 'lines': case 'sprint': if (g.lines >= o.need) finish(run, true, 'goal'); break;
      case 'score': if (g.score >= o.need) finish(run, true, 'goal'); break;
      case 'dig': if (!E.garbageLeft(g)) finish(run, true, 'goal'); break;
      case 'gems': if (!E.gemsLeft(g)) finish(run, true, 'goal'); break;
      case 'combo': if (g.stats.maxCombo >= run.target) finish(run, true, 'goal'); break;
      case 'survive': if (run.t >= run.timeLimit) finish(run, true, 'goal'); break;
      case 'boss': if (run.bossState.hp <= 0) finish(run, true, 'goal'); break;
      case 'rush':
        if (run.bossState.hp <= 0) {
          if (run.rushIndex >= 4) finish(run, true, 'goal');
          else {
            ++run.rushIndex;
            run.events.push({ type: 'nextboss', w: run.rushIndex });
            const shield = run.shield;
            startBoss(run, run.rushIndex, profile || P.newProfile(), 0.8);
            run.shield = run.shield || shield;
          }
        }
        break;
    }
    if (!run.done && run.timeLimit && run.kind !== 'survive' && run.t >= run.timeLimit)
      finish(run, run.mode === 'ultra' || run.mode === 'daily', 'time');
  }

  /* Second Chance and Aegis: the bottom eight rows vanish and play goes on */
  function revive(run) {
    const g = run.game;
    const n = 8;
    g.board.splice(C.ROWS * C.COLS - n * C.COLS, n * C.COLS);
    g.tags.splice(C.ROWS * C.COLS - n * C.COLS, n * C.COLS);
    for (let i = 0; i < n * C.COLS; ++i) { g.board.unshift(0); g.tags.unshift(0); }
    g.over = false;
    g.reason = '';
    g.piece = null;
    g.spawnT = 0.3;
    run.events.push({ type: 'revive' });
  }

  /* one frame of play; input: { soft } */
  function tick(run, dt, input, profile) {
    if (run.done) return run.events;
    if (run.digStart == null) run.digStart = Math.round(E.garbageLeft(run.game) / C.COLS);
    if (run.gemStart == null) run.gemStart = E.gemsLeft(run.game);
    run.acc += Math.min(dt, C.MAX_DT);
    const g = run.game;
    while (run.acc >= C.STEP && !run.done) {
      run.acc -= C.STEP;
      run.t += C.STEP;
      E.step(g, C.STEP, input);
      if (run.bossState) NS.boss.update(run, C.STEP, profile);
      NS.powers.update(run, C.STEP);
      if (run.rise) {
        run.riseT -= C.STEP;
        if (run.riseT <= 0) {
          run.riseT = run.rise;
          E.addGarbage(g, 1, null);
        }
      }
      if (run.mirror) {
        run.mirrorT -= C.STEP;
        if (run.mirrorT <= 0) {
          run.mirrorT = run.mirror;
          E.mirror(g);
        }
      }
      const evs = E.takeEvents(g);
      for (let i = 0; i < evs.length; ++i) {
        const e = evs[i];
        if (e.type === 'clear') onClear(run, e, profile);
        run.events.push(e);
      }
      judge(run, profile);
    }
    return run.events;
  }

  function onClear(run, e, profile) {
    const g = run.game;
    if (e.lines) {
      run.tokens += e.lines + (e.lines === 4 ? 3 : 0) + (e.tspin === 'full' ? 3 : 0) + (e.perfect ? 10 : 0);
      if (g.stats.holds === 0) run.noHoldLines = g.lines;
    }
    if (e.tspin === 'full' && e.lines === 3) run.tst = (run.tst || 0) + 1;
    if (e.source === 'piece' && e.lines) {
      run.b2bChain = e.b2b ? run.b2bChain + 1 : (e.lines === 4 || e.tspin ? 1 : 0);
      run.bestB2B = Math.max(run.bestB2B, run.b2bChain);
    }
    for (let i = 0; i < e.orbs; ++i) NS.powers.gainOrb(run, profile);
    if (e.gems && run.mutators.indexOf('gems') >= 0) g.score += e.gems * 500;
    if (run.bossState) {
      const hit = NS.boss.onClear(run, e, profile);
      if (hit) e.hit = hit;
    }
  }

  /* stars of a finished story stage: [won, par, bonus] */
  function starsFor(run) {
    const st = W.BY_ID[run.stage];
    if (!st || !run.won) return [false, false, false];
    return [true, run.t <= st.par, bonusMet(run, st.bonus)];
  }

  function takeEvents(run) {
    const e = run.events;
    run.events = [];
    return e;
  }

  Object.assign(NS.run, { build, startBoss, objective, bonusMet, bonusText, judge, tick, starsFor, takeEvents, finish });
})();
