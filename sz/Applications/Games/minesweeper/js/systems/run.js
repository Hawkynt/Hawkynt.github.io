/* A game session as one plain object (saved as JSON for Continue): the mode, the story stage or
   guardian, the engine field built with the profile's tech tree (shields, chests, score), the
   mutators, powers and their slots, Second Chance, the fields of the endless modes and their seeded
   sizes, a guardian fight or a Gauntlet chain, a Versus race. tick() advances it on a fixed step,
   hands chests out as powers, drives smoke and tremors, the guardian and the rival, and decides
   when the session is won or lost. No drawing, sound or storage here.
   Modes: story (proven fields), classic (the original sizes and rules, best times; proven fields
   only when asked), daily (one proven field per day with two mutators), zen (endless proven fields,
   a mine only costs points), rush (three minutes of small proven fields, a mine costs ten seconds),
   gauntlet (all five guardians), versus (a race against the CPU). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const C = NS.constants;
  const E = NS.engine;
  const P = NS.progress;
  const W = NS.worldData;
  const SE = NS.seasons;
  const { makeRng, hashString } = NS.rng;

  const SMOKE_EVERY = 11, QUAKE_EVERY = 14, RUSH_PENALTY = 10, ZEN_PENALTY = 500;

  /* the size of the n-th endless field (Zen and Rush) */
  function endlessSize(mode, n, seed) {
    const r = makeRng(hashString(mode + ':' + seed + ':' + n));
    if (mode === 'rush') {
      const k = Math.min(4, Math.floor((n - 1) / 2));
      const w = 9 + k + r.int(2), h = 9 + Math.floor(k / 2);
      return { w: w, h: h, mines: Math.round(w * h * (0.12 + k * 0.01)) };
    }
    const k = Math.min(8, n - 1);
    const w = 9 + k + r.int(3), h = 9 + Math.floor(k * 0.6);
    return { w: w, h: h, mines: Math.round(w * h * (0.13 + k * 0.006)) };
  }

  function mutatorSet(ids) {
    const mut = ids.map(id => SE.MUT_BY_ID[id]);
    return k => mut.find(m => m[k] != null);
  }

  /* engine options for the field a session plays now */
  function fieldOptions(run, profile, n) {
    const T = name => P.stat(profile, name);
    const has = mutatorSet(run.mutators);
    const o = { seed: run.seed + ':' + n, marks: profile.settings.marks !== false, scoreMul: 1 + T('scoreGain') + T('allGain'), noGuess: true, gems: 0, chests: 0, lives: 0 };
    if (run.mode === 'story') {
      const st = W.BY_ID[run.stage];
      const b = st.kind === 'boss' ? W.BOSSES[st.world] : st;
      Object.assign(o, { w: b.w, h: b.h, mines: b.mines, gems: st.gems || 0, chests: (st.chests || 0) + Math.round(T('chests')), lives: Math.round(T('shields')), seed: 'stage-' + st.id });
    } else if (run.mode === 'gauntlet') {
      const b = W.BOSSES[run.gauntletIndex];
      Object.assign(o, { w: b.w, h: b.h, mines: b.mines, chests: 2, lives: Math.round(T('shields')), seed: run.seed + ':g' + run.gauntletIndex });
    } else if (run.mode === 'classic') {
      const d = run.diff === 'custom' ? profile.settings.custom : C.DIFFS[run.diff];
      Object.assign(o, { w: d.w, h: d.h, mines: d.mines, noGuess: !!run.proven, scoreMul: 1 });
    } else if (run.mode === 'daily') {
      const k = has('size') ? Math.sqrt(has('size').size) : 1;
      const w = Math.min(30, Math.round(20 * k)), h = Math.min(24, Math.round(14 * k));
      Object.assign(o, { w: w, h: h, mines: Math.round(w * h * 0.18 * (has('mines') ? has('mines').mines : 1)), gems: 3 + (has('gems') ? has('gems').gems : 0), chests: 2, seed: 'daily-' + run.day });
    } else if (run.mode === 'zen' || run.mode === 'rush') {
      Object.assign(o, endlessSize(run.mode, n, run.seed), { gems: run.mode === 'zen' ? 2 : 1, chests: run.mode === 'zen' ? 1 : 0 });
      if (run.mode === 'zen' && T('zenShield') > 0) o.lives = 1;
    } else if (run.mode === 'versus') {
      Object.assign(o, { w: 16, h: 16, mines: 40, gems: 0, chests: 0 });
    }
    if (has('noFlags')) o.noFlags = true;
    return o;
  }

  /* opts: stage, seed, date, mutators, diff, proven, cpu */
  function build(mode, opts, profile) {
    opts = opts || {};
    const T = name => P.stat(profile, name);
    const date = opts.date || new Date();
    const recipe = mode === 'daily' ? SE.dailyRecipe(date) : null;
    const seed = String(opts.seed != null ? opts.seed : recipe ? recipe.seed : (hashString(mode + ':' + Date.now() + ':' + Math.random()) >>> 0));
    const st = mode === 'story' ? W.BY_ID[opts.stage] : null;
    const mutators = opts.mutators ? opts.mutators.slice() : recipe ? recipe.mutators.slice() : [];
    const has = mutatorSet(mutators);
    const run = {
      mode: mode, stage: st ? st.id : null, world: st ? st.world : 0, seed: seed, kind: st ? st.kind : mode, day: recipe ? recipe.key : '',
      diff: opts.diff || profile.settings.classicDiff || 'beginner', proven: opts.proven != null ? !!opts.proven : !!profile.settings.proven,
      mutators: mutators, dark: !!has('dark'), smoke: !!has('fog') || (st && st.kind === 'fog'), quake: !!has('quake'),
      smokeT: SMOKE_EVERY * 0.6, quakeT: QUAKE_EVERY, thaw: Math.max(0.2, 1 - T('thaw')),
      t: 0, acc: 0, timeLimit: 0, field: 1, fields: 0, powers: [], slots: 0, powersUsed: 0, revives: Math.round(T('revive')),
      bossState: null, gauntletIndex: 0, tokens: 0, score: 0, opened: 0, gems: 0, chords: 0, flagsCorrect: 0, mines: 0,
      done: false, won: false, reason: '', events: [],
    };
    if (mode !== 'classic' && mode !== 'versus') run.slots = Math.min(C.MAX_POWERS + 2, 2 + Math.round(T('slots')));
    if (st && st.kind === 'timed') run.timeLimit = st.time + T('time');
    if (mode === 'rush') run.timeLimit = 180 + T('time');
    if (mode === 'daily' && has('clock')) run.timeLimit = 240 + T('time');
    run.game = E.create(fieldOptions(run, profile, 1));
    if (mode !== 'classic' && mode !== 'versus' && mode !== 'rush' && T('scanStart') > 0) run.powers.push('scan');
    if (st && st.kind === 'boss') run.bossState = NS.boss.create(st.world, profile, 1);
    if (mode === 'gauntlet') run.bossState = NS.boss.create(0, profile, 1.15);
    if (mode === 'versus') NS.versus.attach(run, opts.cpu || profile.settings.vsCpu, fieldOptions(run, profile, 1), T('rivalDelay'));
    E.takeEvents(run.game);
    return run;
  }

  function objective(run) {
    const g = run.game;
    switch (run.kind) {
      case 'clear': case 'fog': case 'timed': return { have: g.opened, need: E.safeCount(g), text: run.kind === 'timed' ? 'Clear the field before time runs out' : 'Open every safe cell' };
      case 'gems': return { have: g.stats.gems, need: g.gems, text: 'Clear the field and collect every gem' };
      case 'boss': case 'gauntlet': return { have: g.opened, need: E.safeCount(g), text: 'Clear the field before ' + W.BOSSES[run.bossState ? run.bossState.w : run.world].name + '\'s fuse burns down' };
      case 'classic': return { have: g.opened, need: E.safeCount(g), text: (run.diff === 'custom' ? 'Custom' : C.DIFFS[run.diff].name) + ' - ' + g.w + ' x ' + g.h + ', ' + g.mines + ' mines' };
      case 'daily': return { have: g.opened, need: E.safeCount(g), text: 'Clear today\'s field' };
      case 'zen': return { have: run.fields, need: 0, text: 'Field ' + run.field + ' - no clock, no pressure' };
      case 'rush': return { have: run.t, need: run.timeLimit, text: 'Clear as many fields as you can' };
      case 'versus': return { have: g.opened, need: E.safeCount(g), text: 'Clear the field before ' + NS.versus.CPU_BY_ID[run.vs.cpu].name + ' does' };
      default: return { have: g.opened, need: E.safeCount(g), text: '' };
    }
  }

  function bonusMet(run, b) {
    const g = run.game;
    if (!b) return false;
    if (b.k === 'nohit') return g.stats.shields === 0 && run.revives === run.revivesStart;
    if (b.k === 'noflag') return g.stats.flags === 0;
    if (b.k === 'nopower') return run.powersUsed === 0;
    if (b.k === 'chords') return g.stats.chords >= b.n;
    if (b.k === 'gems') return g.gems > 0 && g.stats.gems >= g.gems;
    return false;
  }

  function bonusText(b) {
    if (!b) return '';
    if (b.k === 'nohit') return 'Never touch a mine';
    if (b.k === 'noflag') return 'Plant no flags at all';
    if (b.k === 'nopower') return 'Use no powers';
    if (b.k === 'chords') return 'Chord ' + b.n + ' times';
    if (b.k === 'gems') return 'Collect every gem';
    return '';
  }

  function finish(run, won, reason) {
    if (run.done) return;
    run.done = true;
    run.won = won;
    run.reason = reason;
    run.events.push({ type: 'finish', won: won, reason: reason });
  }

  /* the totals of a field are banked before the next one replaces it */
  function bank(run) {
    const g = run.game;
    if (g.banked) return;
    g.banked = true;
    run.score += g.score;
    run.opened += g.stats.opened;
    run.gems += g.stats.gems;
    run.chords += g.stats.chords;
    if (g.mine) for (let i = 0; i < g.w * g.h; ++i) if (g.flag[i] === 1 && g.mine[i] && !g.defused[i]) ++run.flagsCorrect;
  }

  function nextField(run, profile) {
    bank(run);
    ++run.fields;
    ++run.field;
    const lives = run.game.lives;
    run.game = E.create(fieldOptions(run, profile, run.field));
    if (run.mode === 'gauntlet') run.game.lives = Math.max(run.game.lives, lives);
    if (run.mode === 'zen' && P.stat(profile, 'scanStart') > 0 && run.powers.length < run.slots) run.powers.push('scan');
    run.events.push({ type: 'field', n: run.field });
  }

  /* a mine was hit: what the mode does about it */
  function onBoom(run, i) {
    const g = run.game;
    const defuse = () => { g.state = 'play'; g.hit = -1; g.defused[i] = 1; g.flag[i] = 1; };
    if (run.mode === 'zen') {
      defuse();
      g.score = Math.max(0, g.score - ZEN_PENALTY);
      run.events.push({ type: 'penalty', i: i, points: ZEN_PENALTY });
      return;
    }
    if (run.mode === 'rush') {
      defuse();
      run.t += RUSH_PENALTY;
      run.events.push({ type: 'penalty', i: i, seconds: RUSH_PENALTY });
      return;
    }
    if (run.mode === 'versus') { NS.versus.onBoom(run, 'you', i); return; }
    if (run.revives > 0 && run.mode !== 'classic') {
      --run.revives;
      defuse();
      run.events.push({ type: 'revive', i: i });
      return;
    }
    finish(run, false, 'boom');
  }

  function onWin(run, profile) {
    if (run.mode === 'zen' || run.mode === 'rush') { nextField(run, profile); return; }
    if (run.mode === 'gauntlet') {
      if (run.gauntletIndex >= 4) { bank(run); ++run.fields; finish(run, true, 'goal'); return; }
      ++run.gauntletIndex;
      run.world = run.gauntletIndex;
      nextField(run, profile);
      run.bossState = NS.boss.create(run.gauntletIndex, profile, 1.15);
      run.events.push({ type: 'nextboss', w: run.gauntletIndex });
      return;
    }
    if (run.mode === 'versus') return;
    bank(run);
    ++run.fields;
    finish(run, true, 'goal');
  }

  function gainPower(run, profile) {
    const list = P.dropList(profile);
    const id = list[Math.floor(E.rand(run.game) * list.length)];
    if (run.powers.length < run.slots) run.powers.push(id);
    else run.game.score += 150;
    run.events.push({ type: 'power', id: id, kept: run.powers.length <= run.slots });
  }

  /* uses power slot k (at cell i where it matters); -> true when used */
  function usePower(run, k, i) {
    const id = run.powers[k];
    const g = run.game;
    if (!id || g.state !== 'play' || run.done) return false;
    let ok = true;
    if (id === 'scan') ok = E.scan(g) >= 0;
    else if (id === 'sonar') ok = E.sonar(g) >= 0;
    else if (id === 'lantern') ok = E.lantern(g, i == null ? -1 : i) >= 0;
    else if (id === 'shield') ++g.lives;
    if (!ok) return false;
    run.powers.splice(k, 1);
    ++run.powersUsed;
    run.events.push({ type: 'usepower', id: id, i: i });
    return true;
  }

  /* player actions route through here so the session sees their outcome */
  function act(run, kind, i, profile) {
    if (run.done) return '';
    if (run.vs && run.vs.stunYou > 0) return '';
    const g = run.game;
    let r = '';
    if (kind === 'reveal') r = E.reveal(g, i);
    else if (kind === 'flag') r = E.toggleFlag(g, i) ? 'flag' : '';
    else if (kind === 'chord') r = E.chord(g, i);
    collectEvents(run, profile);
    if (r === 'boom') onBoom(run, g.hit >= 0 ? g.hit : i);
    judge(run, profile);
    return r;
  }

  function collectEvents(run, profile) {
    for (const e of E.takeEvents(run.game)) {
      run.events.push(e);
      if (e.type === 'chest') gainPower(run, profile);
      if (e.type === 'gem') run.tokens += 2;
      if (e.type === 'open') run.tokens += e.cells.length * 0.02;
    }
  }

  function judge(run, profile) {
    if (run.done) return;
    const g = run.game;
    if (run.vs) {
      const w = NS.versus.winner(run);
      if (w) { bank(run); if (w === 'you') ++run.fields; finish(run, w === 'you', w === 'you' ? 'ko' : 'beaten'); }
      return;
    }
    if (g.state === 'won') onWin(run, profile);
    if (!run.done && run.bossState && run.bossState.fuse <= 0 && run.game.state === 'play') { E.takeEvents(run.game); finish(run, false, 'fuse'); }
    if (!run.done && run.timeLimit && run.t >= run.timeLimit) {
      if (run.mode === 'rush') { bank(run); finish(run, true, 'time'); } else finish(run, false, 'time');
    }
  }

  function tick(run, dt, profile) {
    if (run.done) return run.events;
    if (run.revivesStart == null) run.revivesStart = run.revives;
    run.acc += Math.min(dt, C.MAX_DT);
    while (run.acc >= C.STEP && !run.done) {
      run.acc -= C.STEP;
      const g = run.game;
      const live = g.state === 'play';
      if (live || run.mode === 'rush' && run.field > 1) run.t += C.STEP;
      E.step(g, C.STEP);
      if (live && run.smoke) {
        run.smokeT -= C.STEP;
        if (run.smokeT <= 0) { run.smokeT = SMOKE_EVERY; E.fog(g, 4, 6 * run.thaw); }
      }
      if (live && run.quake) {
        run.quakeT -= C.STEP;
        if (run.quakeT <= 0) { run.quakeT = QUAKE_EVERY; E.unflag(g, 2); }
      }
      if (run.bossState) NS.boss.update(run, C.STEP);
      if (run.vs) NS.versus.step(run, C.STEP);
      collectEvents(run, profile);
      judge(run, profile);
    }
    return run.events;
  }

  /* stars of a finished story stage: [won, par, bonus] */
  function starsFor(run, profile) {
    const st = W.BY_ID[run.stage];
    if (!st || !run.won) return [false, false, false];
    const par = st.par * (1 + P.stat(profile || P.newProfile(), 'par'));
    return [true, run.t <= par, bonusMet(run, st.bonus)];
  }

  function takeEvents(run) {
    const e = run.events;
    run.events = [];
    return e;
  }

  Object.assign(NS.run, { SMOKE_EVERY, QUAKE_EVERY, RUSH_PENALTY, ZEN_PENALTY, endlessSize, fieldOptions, build, objective, bonusMet, bonusText, finish, bank,
    nextField, onBoom, onWin, gainPower, usePower, act, judge, tick, starsFor, takeEvents });
})();
