/* A run in any mode: builds each cave with the perks applied, steps it, turns its events into
   score (with the combo multiplier), gold, stats, quest progress and seasonal tokens, handles
   the clock, deaths, lives, cave clears and game over per mode, and writes the autosave
   snapshot that Continue restores exactly. Owns G.run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const G = NS.state;
  const P = NS.progression;
  const L = NS.levels;
  const I = NS.items;
  const ST = NS.story;

  const NO_INTENT = { dir: -1, grab: false, bomb: false };

  function newRun(mode, opts) {
    opts = opts || {};
    const today = G.today || NS.rng.dateKey(new Date());
    const run = {
      mode, ch: opts.ch || 0, lv: opts.lv || 0, n: 1, seed: opts.seed || ((Date.now() ^ 0x5bd1e995) >>> 0),
      day: today, mod: null, score: 0, lives: 3, combo: 0, comboT: 0, comboBest: 0, mult: 1, gold: 0,
      timeLeft: 0, state: 'intro', stateT: 0, caveTime: 0, caveGems: 0, deaths: 0, caves: 0, tokens: 0,
      params: null, cave: null, banner: '', bannerT: 0, tally: 0, zenT: 0
    };
    if (mode === 'daily') run.mod = P.dailyModifier(today);
    const pk = G.perks;
    if (mode === 'arcade' || mode === 'daily') run.lives = 3 + (pk.lives | 0);
    if (mode === 'daily' && run.mod.id === 'fragile') run.lives = 1;
    if (mode === 'time') run.timeLeft = 120;
    return run;
  }

  function paramsFor(run) {
    switch (run.mode) {
      case 'story': return L.storyParams(run.ch, run.lv);
      case 'arcade': return L.arcadeParams(run.n, run.seed);
      case 'zen': return L.zenParams(run.n, run.seed);
      case 'daily': return L.dailyParams(run.day, run.mod);
      case 'time': return L.timeParams(run.n, run.seed);
    }
    return L.storyParams(0, 0);
  }

  function seasonTokens() {
    return G.season ? 2 + (G.perks.tokens | 0) : 0;
  }

  /* builds (or rebuilds after a death) the current cave */
  function loadCave(run) {
    const p = paramsFor(run);
    p.tokens = p.kind === 'boss' ? 1 : seasonTokens();
    p.items = (p.items || 0) + (G.perks.extraPowerups | 0);
    run.params = p;
    const cv = L.build(p);
    applyPerks(run, cv);
    run.cave = cv;
    run.caveTime = 0;
    run.caveGems = 0;
    run.state = 'intro';
    run.stateT = 0;
    run.tally = 0;
    if (run.mode !== 'time') run.timeLeft = p.time ? p.time + (G.perks.timeBonus | 0) : 0;
    NS.fx.reset();
    return cv;
  }

  function applyPerks(run, cv) {
    const pk = G.perks;
    cv.perks = pk;
    cv.zen = run.mode === 'zen';
    cv.escape = pk.escape || 0;
    cv.grace = pk.grit ? 18 : 10;
    cv.quick = run.mod && run.mod.id === 'quick';
    cv.player.shield = pk.startShield ? Math.min(pk.shieldMax, 1) : 0;
    cv.player.bombs = (pk.startBombs | 0) + (run.mod && run.mod.id === 'powder' ? 6 : 0);
  }

  function start(mode, opts) {
    const run = newRun(mode, opts);
    G.run = run;
    loadCave(run);
    ++G.save.stats.runs;
    NS.save.writeSave();
    autosave();
    return run;
  }

  /* ── Scoring ── */
  function scoreMult(run) {
    let m = run.mult;
    if (run.mode === 'daily' && run.mod.id === 'fragile') m *= 2;
    return m;
  }

  function addScore(run, base, i) {
    const pts = Math.round(base * scoreMult(run));
    run.score += pts;
    return pts;
  }

  function gold(n) {
    const g = P.earnGold(G.save, G.perks, n);
    if (G.run) G.run.gold += g;
    return g;
  }

  function onEvents(run) {
    const cv = run.cave;
    const ev = cv.events;
    const s = G.save;
    const pk = G.perks;
    for (let k = 0; k < ev.length; ++k) {
      const e = ev[k];
      switch (e.t) {
        case 'gem': {
          run.caveGems += e.v;
          run.combo += 1;
          run.comboT = C.COMBO_WINDOW + (pk.comboWindow || 0);
          run.mult = Math.min(C.COMBO_MAX, 1 + Math.floor(run.combo / 5));
          run.comboBest = Math.max(run.comboBest, run.mult);
          const clover = cv.player.pow.clover > 0 ? 2 : 1;
          e.pts = addScore(run, (e.big ? C.BIGGEM_SCORE : C.GEM_SCORE) * (1 + pk.gemValue) * clover, e.i);
          let g = e.v * clover;
          if (run.mode === 'zen') g *= 0.5 * (1 + (pk.zenGold || 0));
          run.goldFrac = (run.goldFrac || 0) + g;
          if (run.goldFrac >= 1) { gold(Math.floor(run.goldFrac)); run.goldFrac -= Math.floor(run.goldFrac); }
          P.addStat(s, 'gems', e.v);
          if (e.big) P.addStat(s, 'bigGems', 1);
          if (run.mode === 'time') { run.timeLeft += e.v; run.timeGems = (run.timeGems || 0) + e.v; }
          break;
        }
        case 'dig': P.addStat(s, 'dug', 1); break;
        case 'push': P.addStat(s, 'pushes', 1); break;
        case 'bombSet': P.addStat(s, 'bombs', 1); break;
        case 'brick': P.addStat(s, 'bricks', 1); break;
        case 'item': {
          P.addStat(s, 'powerups', 1);
          const def = I.POWERUPS[e.kind];
          if (def && def.key === 'life') {
            if (run.mode === 'arcade' || run.mode === 'daily' || run.mode === 'time') ++run.lives;
            else gold(15);
          }
          break;
        }
        case 'token':
          ++run.tokens;
          P.addStat(s, 'tokens', 1);
          if (G.season) {
            ++s.season.tokens;
            const got = P.claimTrack(s, G.season, pk);
            for (let q = 0; q < got.length; ++q) NS.screens.toast('Event reward: ' + got[q].text, G.season.color);
          } else gold(5);
          e.pts = addScore(run, 50, e.i);
          break;
        case 'kill':
          P.addStat(s, 'kills', 1);
          if (e.k === C.BUTTERFLY) P.addStat(s, 'butterflies', 1);
          if (e.by === 'crush' || e.by === 'ice' || e.by === 'bomb' || e.by === 'tnt') {
            P.addStat(s, 'crushes', 1);
            e.pts = addScore(run, C.KILL_SCORE, e.i);
            gold(3);
          }
          break;
        case 'chain':
          P.bestStat(s, 'bestChain', e.n);
          if (e.n > 1) e.pts = addScore(run, 40 * e.n * (1 + (pk.chainBonus || 0)), e.i);
          break;
        case 'bossHit': e.pts = addScore(run, 300, e.i); break;
        case 'bossDie':
          P.addStat(s, 'bosses', 1);
          e.pts = addScore(run, C.BOSS_SCORE, e.i);
          gold(150);
          break;
        case 'exitOpen':
          run.banner = 'The exit is open!';
          run.bannerT = 2.2;
          break;
        case 'death': P.addStat(s, 'deaths', 1); break;
      }
    }
    if (cv.timeAdd) {
      if (run.mode !== 'zen') run.timeLeft += cv.timeAdd;
      cv.timeAdd = 0;
    }
    NS.fx.onEvents(cv, ev, run);
    ev.length = 0;
  }

  /* ── Flow ── */
  function update(dt) {
    const run = G.run;
    if (!run) return;
    const cv = run.cave;
    run.stateT += dt;
    if (run.bannerT > 0) run.bannerT -= dt;
    if (run.state === 'intro') {
      /* the cave holds still while its name is shown */
      if (run.stateT > 1.6 || NS.input.anyMove()) { run.state = 'play'; run.stateT = 0; }
      return;
    }
    if (run.state === 'play') {
      const intent = NS.input.intent();
      NS.sim.stepCave(cv, intent);
      run.caveTime += dt;
      if (run.mode === 'zen') {
        run.zenT += dt;
        if (run.zenT >= 1) { run.zenT -= 1; P.addStat(G.save, 'zenTime', 1); }
      } else if (run.timeLeft > 0 || run.mode === 'time') {
        run.timeLeft -= dt;
        if (run.timeLeft <= 0) {
          run.timeLeft = 0;
          if (run.mode === 'time') { gameOver(run); return; }
          const esc = cv.escape;
          cv.escape = 0;
          if (NS.physics.hitPlayer(cv, 'time')) NS.physics.explodeAt(cv, cv.player.r * cv.w + cv.player.c, C.EMPTY, 1, 'time');
          else run.timeLeft = 10;
          cv.escape = esc;
        }
      }
      if (run.comboT > 0) {
        run.comboT -= dt;
        if (run.comboT <= 0) { run.combo = 0; run.mult = 1; }
      }
      onEvents(run);
      if (cv.won) { run.state = 'won'; run.stateT = 0; onWin(run); }
      else if (!cv.player.alive) { run.state = 'dying'; run.stateT = 0; }
      return;
    }
    NS.sim.stepCave(cv, NO_INTENT);
    onEvents(run);
    if (run.state === 'dying' && run.stateT > 1.8) onDeath(run);
    else if (run.state === 'won') {
      /* the remaining seconds tick into the score */
      if (run.timeLeft > 0 && run.mode !== 'time' && run.mode !== 'zen') {
        const take = Math.min(run.timeLeft, dt * 60);
        run.timeLeft -= take;
        run.tally += take;
        run.score += Math.round(take * C.TIME_BONUS);
        if (Math.floor(G.time * 20) % 2 === 0) SZ.GameAudio && SZ.GameAudio.play('coin', { volume: 0.12, pitch: 1.6 });
      } else if (run.stateT > 1.4) finishCave(run);
    }
  }

  function onWin(run) {
    const s = G.save;
    ++run.caves;
    P.addStat(s, 'caves', 1);
    P.bestStat(s, 'bestCombo', run.comboBest);
    gold(10 + run.ch * 4 + (run.params.kind === 'boss' ? 40 : 0));
    if (run.mode === 'time') run.timeLeft += 10;
  }

  function onDeath(run) {
    ++run.deaths;
    run.combo = 0; run.mult = 1;
    if (run.mode === 'arcade' || run.mode === 'daily') {
      --run.lives;
      if (run.lives <= 0) { gameOver(run); return; }
    }
    if (run.mode === 'time') run.timeLeft = Math.max(5, run.timeLeft - 10);
    loadCave(run);
    autosave();
  }

  function finishCave(run) {
    const s = G.save;
    if (run.mode === 'story') {
      const key = P.levelKey(run.ch, run.lv);
      const p = run.params;
      const goal = p.kind === 'boss' ? 8 : Math.min(run.cave.gemsTotal, Math.ceil(run.cave.required * 1.4));
      const par = p.kind === 'bonus' ? p.time * 0.6 : p.time * 0.5;
      const stars = P.starsFor({ timeUsed: run.caveTime, par, gems: run.caveGems, gemsGoal: goal });
      const first = !(s.story.stars[key] | 0);
      if (first) gold(30 + run.ch * 10);
      if (stars === 3 && (s.story.stars[key] | 0) < 3) P.addStat(s, 'perfects', 1);
      s.story.stars[key] = Math.max(s.story.stars[key] | 0, stars);
      s.story.best[key] = Math.max(s.story.best[key] | 0, run.score);
      let chapterDone = false;
      if (p.kind === 'boss' && s.stats.chapters < run.ch + 1) { s.stats.chapters = run.ch + 1; chapterDone = true; }
      G.results = { mode: 'story', ch: run.ch, lv: run.lv, stars, score: run.score, gold: run.gold, time: run.caveTime, par,
        gems: run.caveGems, goal, first, chapterDone, deaths: run.deaths, ach: [] };
      endRun();
      return;
    }
    if (run.mode === 'daily') {
      gameOver(run, true);
      return;
    }
    /* endless modes roll on to the next cave */
    ++run.n;
    loadCave(run);
    run.banner = (run.mode === 'zen' ? 'Breathe. Cave ' : 'Cave ') + run.n;
    run.bannerT = 2;
    autosave();
  }

  function gameOver(run, cleared) {
    const s = G.save;
    let rank = -1;
    if (run.mode === 'arcade') {
      rank = P.addHighScore(s.high.arcade, { score: run.score, level: run.n, date: Date.now() });
      P.bestStat(s, 'bestArcade', run.score);
    } else if (run.mode === 'time') {
      rank = P.addHighScore(s.high.time, { score: run.score, level: run.n, gems: G.save.stats.gems, date: Date.now() });
      P.bestStat(s, 'bestTimeGems', run.timeGems || 0);
    } else if (run.mode === 'daily') {
      const prev = s.high.daily[run.day] | 0;
      s.high.daily[run.day] = Math.max(prev, run.score);
      P.addStat(s, 'dailies', 1);
      rank = run.score > prev ? 0 : -1;
    }
    P.bestStat(s, 'bestCombo', run.comboBest);
    G.results = { mode: run.mode, score: run.score, gold: run.gold, caves: run.caves, n: run.n, rank, cleared: !!cleared,
      mod: run.mod, best: run.mode === 'daily' ? s.high.daily[run.day] : 0, ach: [] };
    endRun();
  }

  function endRun() {
    G.results.ach = P.checkAchievements(G.save, G.perks);
    G.run = null;
    NS.save.clearRun();
    NS.save.writeSave();
    NS.screens.setScreen('results');
  }

  /* leaving mid-run keeps the snapshot so the title offers Continue */
  function quit() {
    autosave();
    G.run = null;
  }

  /* ── Snapshot ── */
  const ARRAYS = ['cells', 'aux', 'dir', 'fall', 'item', 'bg'];

  function packBytes(a) {
    let s = '';
    for (let i = 0; i < a.length; ++i) s += String.fromCharCode(65 + a[i]);
    return s;
  }

  function unpackBytes(s, n) {
    const a = new Uint8Array(n);
    for (let i = 0; i < n && i < s.length; ++i) a[i] = s.charCodeAt(i) - 65;
    return a;
  }

  function snapshot(run) {
    const cv = run.cave;
    const cave = {
      w: cv.w, h: cv.h, rng: cv.rng.s, seed: cv.seed, tick: cv.tick, clock: cv.clock, startR: cv.startR, startC: cv.startC,
      exitR: cv.exitR, exitC: cv.exitC, required: cv.required, gems: cv.gems, gemsTotal: cv.gemsTotal, exitOpen: cv.exitOpen,
      magic: cv.magic, amoeba: cv.amoeba, boss: cv.boss, bossDefeated: cv.bossDefeated, bombs: cv.bombs, chain: cv.chain,
      player: cv.player
    };
    for (let k = 0; k < ARRAYS.length; ++k) cave[ARRAYS[k]] = packBytes(cv[ARRAYS[k]]);
    const r = {};
    for (const key in run) if (key !== 'cave' && key !== 'params') r[key] = run[key];
    if (r.state !== 'won' && r.state !== 'dying') r.state = 'play';
    return { v: P.SAVE_VERSION, at: Date.now(), run: r, cave };
  }

  function restore(snap) {
    if (!snap || !snap.run || !snap.cave) return null;
    const run = Object.assign(newRun(snap.run.mode), snap.run);
    const sc = snap.cave;
    const cv = NS.cavegen.newCave(sc.w, sc.h, sc.seed);
    const n = sc.w * sc.h;
    for (let k = 0; k < ARRAYS.length; ++k) cv[ARRAYS[k]] = unpackBytes(sc[ARRAYS[k]], n);
    const keys = ['tick', 'clock', 'startR', 'startC', 'exitR', 'exitC', 'required', 'gems', 'gemsTotal', 'exitOpen', 'magic',
      'amoeba', 'boss', 'bossDefeated', 'bombs', 'chain', 'player'];
    for (let k = 0; k < keys.length; ++k) cv[keys[k]] = sc[keys[k]];
    cv.rng.s = sc.rng >>> 0;
    run.params = paramsFor(run);
    applyPerks(run, cv);
    cv.player = sc.player;
    cv.player.pow = cv.player.pow || {};
    run.cave = cv;
    if (run.state === 'dying') { run.stateT = 0; }
    if (run.state === 'won') { run.state = 'play'; cv.won = false; }
    run.state = run.state === 'dying' ? 'dying' : 'intro';
    run.stateT = 0;
    run.banner = 'Welcome back!';
    run.bannerT = 2;
    G.run = run;
    NS.fx.reset();
    return run;
  }

  function autosave() {
    const run = G.run;
    if (run && run.cave && (run.state === 'play' || run.state === 'intro')) NS.save.writeRun(snapshot(run));
    NS.save.writeSave();
  }

  Object.assign(NS.run, { start, loadCave, update, onEvents, finishCave, gameOver, quit, snapshot, restore, autosave, paramsFor });
})();
