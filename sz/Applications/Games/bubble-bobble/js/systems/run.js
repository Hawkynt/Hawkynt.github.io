/* A game session as one plain object (saved as JSON for Continue): the mode, the story stage or
   guardian, the engine stage built with the profile's tech tree (bubble range and rate, trap
   time, run speed, calmer enemies, candy, elemental bubbles, lives, a starting shield, guardian
   damage, patience), mutators, the room count of the endless modes with their seeded rooms,
   Second Chance and Boss Rush. tick() advances it on a fixed step and decides when it is won
   or lost. No drawing, sound or storage here. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const E = NS.engine;
  const P = NS.progress;
  const W = NS.worldData;
  const SE = NS.seasons;
  const { hashString } = NS.rng;

  const POOL = ['walker', 'hopper', 'flyer', 'charger', 'shooter', 'ghost', 'brute'];

  /* room n of an endless mode */
  function endlessRoom(seed, n, extra) {
    const style = W.WORLDS[(n - 1) % W.WORLDS.length].platform;
    const kinds = POOL.slice(0, Math.min(POOL.length, 2 + Math.floor(n / 2)));
    return W.levelOf ? NS.levels.generate((seed + n * 7919) >>> 0, style, { kinds: kinds, count: 3 + Math.floor(n / 2) + (extra || 0) }) : null;
  }

  function options(profile, mutators) {
    const T = name => P.stat(profile, name);
    const mut = mutators.map(id => SE.MUT_BY_ID[id]);
    const has = k => mut.find(m => m[k] != null);
    return {
      lives: 3 + Math.round(T('lives')), range: (1 + T('range')) * (has('range') ? has('range').range : 1), rateMul: 1 + T('rate'),
      trapMul: (1 + T('trap')) * (has('trap') ? has('trap').trap : 1), runMul: 1 + T('run'), speedMul: Math.max(0.6, 1 - T('slow')) * (has('speed') ? has('speed').speed : 1),
      drops: (1 + T('dropGain')) * (has('drops') ? has('drops').drops : 1), elements: has('elements') ? has('elements').elements : 11 / (1 + T('elements')),
      powers: P.dropList(profile), startShield: T('startShield') > 0, invMul: 1 + T('invuln'), patience: T('patience'),
      scoreMul: 1 + T('scoreGain') + T('allGain'), extra: has('extra') ? has('extra').extra : 0,
    };
  }

  function build(mode, opts, profile) {
    opts = opts || {};
    const date = opts.date || new Date();
    const recipe = mode === 'daily' ? SE.dailyRecipe(date) : null;
    const seed = opts.seed != null ? opts.seed : recipe ? recipe.seed : (hashString(mode + ':' + Date.now() + ':' + Math.random()) >>> 0);
    const mutators = opts.mutators ? opts.mutators.slice() : recipe ? recipe.mutators.slice() : [];
    const st = mode === 'story' ? W.BY_ID[opts.stage] : null;
    const o = options(profile, mutators);
    o.seed = seed;
    let level;
    if (st) {
      level = W.levelOf(st.kind === 'boss' || !o.extra ? st : Object.assign({}, st, { count: st.count + o.extra }));
      o.speed = st.speed * o.speedMul;
    } else if (mode === 'rush') {
      level = W.levelOf({ kind: 'boss' });
      o.speed = 1.3 * o.speedMul;
    } else {
      level = endlessRoom(seed, 1, o.extra);
      o.speed = o.speedMul;
    }
    o.level = level;
    if (mode === 'blitz' || mode === 'zen' || mode === 'daily') o.infinite = true;
    if (mode === 'zen') { o.noHurry = true; o.speed *= 0.8; }
    const game = E.create(o);
    if (mode === 'zen') game.player.inv = 1e9;
    const run = {
      mode: mode, stage: st ? st.id : null, world: st ? st.world : 0, seed: seed, game: game, kind: st ? st.kind : mode,
      t: 0, acc: 0, timeLimit: st && st.kind === 'timed' ? st.time : mode === 'blitz' || mode === 'daily' ? 180 : 0,
      room: 1, revives: Math.round(P.stat(profile, 'revive')), mutators: mutators, dark: !!mutators.find(id => SE.MUT_BY_ID[id].dark), extra: o.extra,
      rushIndex: 0, tokens: 0, calm: 0, starLives: 0, done: false, won: false, reason: '', events: [], day: recipe ? recipe.key : '',
      damageMul: 1 + P.stat(profile, 'damage'), wall: 1,
    };
    if (st && st.kind === 'boss') NS.boss.attach(game, st.world, 1, run.damageMul);
    if (mode === 'rush') NS.boss.attach(game, 0, 0.8, run.damageMul);
    return run;
  }

  function objective(run) {
    const g = run.game;
    switch (run.kind) {
      case 'clear': case 'timed': return { have: (run.startEnemies || 0) - g.enemies.length - g.bubbles.filter(b => b.trap).length, need: run.startEnemies || 1, text: run.kind === 'timed' ? 'Clear the room before time runs out' : 'Trap and pop every enemy' };
      case 'boss': case 'rush': return { have: g.boss ? g.boss.max - g.boss.hp : 1, need: g.boss ? g.boss.max : 1, text: 'Defeat ' + W.BOSSES[run.world].name };
      case 'arcade': return { have: run.room, need: 0, text: 'Room ' + run.room + ' - keep your lives' };
      case 'blitz': case 'daily': return { have: run.t, need: run.timeLimit, text: 'Score as much as you can' };
      default: return { have: run.room, need: 0, text: 'Relax and blow bubbles' };
    }
  }

  function bonusMet(run, b) {
    const s = run.game.stats;
    if (!b) return false;
    if (b.k === 'nodeath') return s.deaths === 0;
    if (b.k === 'chain') return s.bestChain >= b.n;
    if (b.k === 'fruit') return s.fruit >= b.n;
    return false;
  }

  function bonusText(b) {
    if (!b) return '';
    if (b.k === 'nodeath') return 'Lose no life';
    if (b.k === 'chain') return 'Pop a chain of ' + b.n;
    if (b.k === 'fruit') return 'Collect ' + b.n + ' fruit';
    return '';
  }

  function finish(run, won, reason) {
    if (run.done) return;
    run.done = true;
    run.won = won;
    run.reason = reason;
    run.events.push({ type: 'finish', won: won, reason: reason });
  }

  function nextRoom(run) {
    const g = run.game;
    ++run.room;
    run.wall = run.room;
    g.speed = Math.min(1.8, g.speed + 0.04);
    E.loadLevel(g, endlessRoom(run.seed, run.room, run.extra));
    if (run.mode === 'zen') g.player.inv = 1e9;
    run.startEnemies = g.enemies.length;
    run.events.push({ type: 'room', n: run.room });
  }

  function onEvent(run, e, profile) {
    const g = run.game;
    if (e.type === 'pop') run.tokens += 1 + e.n * 0.5;
    if (e.type === 'fruit') run.tokens += 0.25;
    if (e.type === 'bossdown') run.tokens += 15;
    if (e.type === 'extralife') ++run.starLives;
    if (e.type === 'over') {
      if (run.revives > 0) {
        --run.revives;
        g.over = false;
        g.lives = 0;
        g.player.dead = 0;
        g.player.inv = C.INVULN * 2;
        run.events.push({ type: 'revive' });
      } else finish(run, run.mode === 'arcade', 'out');
    }
    if (e.type === 'cleared' || e.type === 'bossdown') {
      if (!g.angry) ++run.calm;
      if (run.mode === 'story') finish(run, true, 'goal');
      else if (run.mode === 'rush') {
        if (run.rushIndex >= 4) finish(run, true, 'goal');
        else {
          ++run.rushIndex;
          run.world = run.rushIndex;
          g.cleared = false;
          g.shots.length = 0;
          NS.boss.attach(g, run.rushIndex, 0.8, run.damageMul);
          run.events.push({ type: 'nextboss', w: run.rushIndex });
        }
      } else nextRoom(run);
    }
  }

  function tick(run, dt, input, profile) {
    if (run.done) return run.events;
    const g = run.game;
    if (run.startEnemies == null) run.startEnemies = g.enemies.length;
    run.acc += Math.min(dt, C.MAX_DT);
    while (run.acc >= C.STEP && !run.done) {
      run.acc -= C.STEP;
      run.t += C.STEP;
      E.step(g, C.STEP, input);
      const evs = E.takeEvents(g);
      for (const e of evs) {
        run.events.push(e);
        onEvent(run, e, profile);
      }
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

  Object.assign(NS.run, { endlessRoom, options, build, objective, bonusMet, bonusText, finish, nextRoom, tick, starsFor, takeEvents });
})();
