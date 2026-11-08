/* A game session as one plain object (saved as JSON for Continue): the mode, the story stage or
   guardian, the engine game built with the profile's tech tree (paddle width, ball speed,
   lives, drops, power durations, allowed power-ups, a starting barrier, guardian damage),
   mutators, the wall count of the endless modes and their seeded wall generator, Second Chance,
   Boss Rush. tick() advances it on a fixed step and decides when the session is won or lost.
   No drawing, sound or storage here. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const E = NS.engine;
  const P = NS.progress;
  const W = NS.worldData;
  const SE = NS.seasons;
  const { makeRng, hashString } = NS.rng;

  /* the team modes and the edges their CPU partners guard */
  const TEAM = { duo: ['top'], arena: ['top', 'left', 'right'] };

  /* a symmetric wall for the endless modes; n grows the difficulty */
  function generateWall(seed, n) {
    const r = makeRng(seed);
    const rows = 5 + Math.min(5, Math.floor(n / 2)) + r.int(2);
    const half = C.COLS / 2;
    const kinds = ['1', '2', '3', '4', '5', '6'];
    const out = [];
    const motif = r.int(4);
    for (let y = 0; y < rows; ++y) {
      let row = '';
      const base = kinds[(y + r.int(2)) % kinds.length];
      for (let x = 0; x < half; ++x) {
        let ch = base;
        const v = r.next();
        if (motif === 1 && (x + y) % 3 === 0) ch = '.';
        if (motif === 2 && y % 3 === 1 && x % 2) ch = '.';
        if (motif === 3 && x === half - 1 - (y % half)) ch = 's';
        if (v < 0.04 + n * 0.006) ch = 's';
        else if (v < 0.07 + n * 0.008) ch = 'g';
        else if (v < 0.1 + n * 0.006) ch = 'b';
        else if (v < 0.12) ch = 'c';
        else if (n > 4 && v < 0.15 + n * 0.004) ch = 't';
        else if (n > 6 && v < 0.2) ch = 'r';
        row += ch;
      }
      out.push(row + row.split('').reverse().join(''));
    }
    return out;
  }

  function options(profile, mutators) {
    const T = name => P.stat(profile, name);
    const mut = mutators.map(id => SE.MUT_BY_ID[id]);
    const has = k => mut.find(m => m[k] != null);
    return {
      lives: 3 + Math.round(T('lives')), paddleMul: (1 + T('paddleW')) * (has('paddle') ? has('paddle').paddle : 1),
      speedMul: Math.max(0.6, 1 - T('ballSlow')) * (has('speed') ? has('speed').speed : 1),
      drops: (1 + T('dropGain')) * (has('drops') ? has('drops').drops : 1), durMul: 1 + T('duration'),
      powers: P.dropList(profile), barrier: T('startBarrier') > 0 ? 1 : 0, multi: has('multi') ? has('multi').multi : 1,
      gravity: has('gravity') ? has('gravity').gravity : 0, regrow: has('regrow') ? has('regrow').regrow : 0,
      scoreMul: 1 + T('scoreGain') + T('allGain'),
    };
  }

  /* opts: stage, seed, date, mutators */
  function build(mode, opts, profile) {
    opts = opts || {};
    const date = opts.date || new Date();
    const recipe = mode === 'daily' ? SE.dailyRecipe(date) : null;
    const seed = opts.seed != null ? opts.seed : recipe ? recipe.seed : (hashString(mode + ':' + Date.now() + ':' + Math.random()) >>> 0);
    const mutators = opts.mutators ? opts.mutators.slice() : recipe ? recipe.mutators.slice() : [];
    const st = mode === 'story' ? W.BY_ID[opts.stage] : null;
    const o = options(profile, mutators);
    o.seed = seed;
    if (st) {
      o.layout = st.layout;
      o.level = st.world * 6 + st.index;
    } else if (mode !== 'rush') {
      o.layout = generateWall(seed, 0);
      o.level = 0;
    }
    if (mode === 'blitz' || mode === 'zen' || mode === 'daily') o.infinite = true;
    if (TEAM[mode]) { o.sides = TEAM[mode]; o.center = true; o.cols = 12; }
    if (mode === 'zen') o.speedMul *= 0.85;
    const game = E.create(o);
    const run = {
      mode: mode, stage: st ? st.id : null, world: st ? st.world : 0, seed: seed, game: game, kind: st ? st.kind : mode,
      t: 0, acc: 0, timeLimit: st && st.kind === 'timed' ? st.time : mode === 'blitz' ? 120 : mode === 'daily' ? 180 : 0,
      wall: 1, revives: Math.round(P.stat(profile, 'revive')), mutators: mutators, dark: !!mutators.find(id => SE.MUT_BY_ID[id].dark),
      rushIndex: 0, tokens: 0, maxBalls: 1, done: false, won: false, reason: '', events: [], day: recipe ? recipe.key : '',
      damageMul: 1 + P.stat(profile, 'damage'), barrierCap: 1 + Math.round(P.stat(profile, 'barrierCap')),
    };
    if (st && st.kind === 'boss') NS.boss.attach(game, st.world, 1, run.damageMul);
    if (mode === 'rush') NS.boss.attach(game, 0, 0.8, run.damageMul);
    return run;
  }

  function objective(run) {
    const g = run.game;
    switch (run.kind) {
      case 'clear': case 'timed': return { have: run.startBricks - E.remaining(g), need: run.startBricks || 1, text: run.kind === 'timed' ? 'Clear the wall before time runs out' : 'Break every brick' };
      case 'gold': return { have: (run.startGold || 0) - E.goldLeft(g), need: run.startGold || 1, text: 'Break every gold target' };
      case 'boss': case 'rush': return { have: g.boss ? g.boss.max - g.boss.hp : 1, need: g.boss ? g.boss.max : 1, text: 'Defeat ' + W.BOSSES[run.world].name };
      case 'arcade': return { have: run.wall, need: 0, text: 'Wall ' + run.wall + ' - keep your balls alive' };
      case 'duo': case 'arena': return { have: run.wall, need: 0, text: 'Wall ' + run.wall + ' - keep the balls in play together' };
      case 'blitz': case 'daily': return { have: run.t, need: run.timeLimit, text: 'Score as much as you can' };
      default: return { have: run.wall, need: 0, text: 'Relax and break bricks' };
    }
  }

  function bonusMet(run, b) {
    const s = run.game.stats;
    if (!b) return false;
    if (b.k === 'nolose') return s.lost === 0;
    if (b.k === 'combo') return s.best >= b.n;
    if (b.k === 'catch') return s.caught >= b.n;
    return false;
  }

  function bonusText(b) {
    if (!b) return '';
    if (b.k === 'nolose') return 'Lose no ball';
    if (b.k === 'combo') return 'Reach a combo of ' + b.n;
    if (b.k === 'catch') return 'Catch ' + b.n + ' power-ups';
    return '';
  }

  function finish(run, won, reason) {
    if (run.done) return;
    run.done = true;
    run.won = won;
    run.reason = reason;
    run.events.push({ type: 'finish', won: won, reason: reason });
  }

  /* the next wall of an endless mode */
  function nextWall(run) {
    const g = run.game;
    ++run.wall;
    g.level = Math.min(24, run.wall - 1);
    E.loadLayout(g, generateWall((run.seed + run.wall * 7919) >>> 0, run.wall - 1));
    g.cleared = false;
    g.drops.length = 0;
    E.resetBalls(g);
    run.startBricks = E.remaining(g);
    run.events.push({ type: 'wall', n: run.wall });
  }

  function onEvent(run, e, profile) {
    const g = run.game;
    if (e.type === 'break') run.tokens += e.kind === 'gold' ? 3 : e.kind === 'crystal' ? 2 : 0.25;
    if (e.type === 'bossdown') run.tokens += 15;
    if (e.type === 'power' && e.id === 'barrier') g.barrier = Math.min(run.barrierCap, g.barrier);
    if (e.type === 'over') {
      if (run.revives > 0) {
        --run.revives;
        g.over = false;
        g.lives = 0;
        E.resetBalls(g);
        run.events.push({ type: 'revive' });
      } else finish(run, run.mode === 'arcade' || !!TEAM[run.mode], 'out');
    }
    if (e.type === 'cleared' || e.type === 'bossdown') {
      if (run.mode === 'story') finish(run, true, 'goal');
      else if (run.mode === 'rush') {
        if (run.rushIndex >= 4) finish(run, true, 'goal');
        else {
          ++run.rushIndex;
          run.world = run.rushIndex;
          g.cleared = false;
          NS.boss.attach(g, run.rushIndex, 0.8, run.damageMul);
          E.resetBalls(g);
          run.events.push({ type: 'nextboss', w: run.rushIndex });
        }
      } else nextWall(run);
    }
  }

  function tick(run, dt, input, profile) {
    if (run.done) return run.events;
    const g = run.game;
    if (run.startBricks == null) run.startBricks = E.remaining(g);
    if (run.startGold == null) run.startGold = E.goldLeft(g);
    run.acc += Math.min(dt, C.MAX_DT);
    let launched = false;
    while (run.acc >= C.STEP && !run.done) {
      run.acc -= C.STEP;
      run.t += C.STEP;
      let inp = launched ? Object.assign({}, input, { launch: false }) : input;
      if (g.mates.length) inp = Object.assign({}, inp, { mates: NS.bot.mateInputs(g, C.STEP) });
      E.step(g, C.STEP, inp);
      launched = launched || !!(input && input.launch);
      run.maxBalls = Math.max(run.maxBalls, g.balls.length);
      const evs = E.takeEvents(g);
      for (const e of evs) {
        run.events.push(e);
        onEvent(run, e, profile);
      }
      if (run.kind === 'gold' && !run.done && E.goldLeft(g) === 0) finish(run, true, 'goal');
      if (!run.done && run.timeLimit && run.t >= run.timeLimit) finish(run, run.mode === 'blitz' || run.mode === 'daily', 'time');
    }
    return run.events;
  }

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

  Object.assign(NS.run, { TEAM, generateWall, options, build, objective, bonusMet, bonusText, finish, nextWall, tick, starsFor, takeEvents });
})();
