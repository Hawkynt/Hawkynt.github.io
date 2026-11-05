/* The run: starting a mode (Story, Arcade, Zen, Daily, Boss Rush), building and entering each
   stage (with chapter and boss cinematics in Story), the per-step objective (clear enemies, find
   the open exit, topple the boss, empty the Zen garden), timers and Hurry Up, score with the
   combo multiplier, clearing a stage (stars, gems, XP, unlocks), game over, banking gems and
   the autosave cadence. Owns G.run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { COLS, ROWS } = C;
  const { WORLDS, LEVELS_PER_WORLD } = NS.story;
  const { BOSSES, BOSS_ORDER } = NS.content;
  const rules = NS.rules;
  const LG = NS.levelgen;
  const R = NS.rng;
  const fx = NS.fx;

  const N = COLS * ROWS;
  let autosaveT = 0;

  function rand() {
    const run = G.run;
    if (!run) return Math.random();
    const r = R.holder(run, 'rs')();
    return r;
  }

  function hasMod(id) {
    return !!(G.run && G.run.mods.indexOf(id) >= 0);
  }

  /* ── starting ── */
  function newRun(mode, opts) {
    opts = opts || {};
    bankStoredRun();
    const P = G.perks;
    const seed = mode === 'daily' ? G.daily.seed : (opts.seed >>> 0) || ((Date.now() ^ 0x2545f491) >>> 0);
    const run = {
      v: NS.save.RUN_VERSION, mode: mode, world: opts.world || 0, levelIndex: opts.level || 0, stage: 1, seed: seed, rs: seed ^ 0x9e3779b9,
      mods: mode === 'daily' ? G.daily.mods.slice() : [], dailyKey: mode === 'daily' ? G.daily.key : '',
      score: 0, lives: mode === 'daily' ? 1 : mode === 'zen' ? 0 : P.lives, gemsRun: 0, tokensRun: 0, kills: 0, blocks: 0, powerupsRun: 0,
      combo: 0, comboT: 0, bestMult: 1, groups: [], hurt: false, t: 0, timeLeft: 0, hurryT: 0, rushTime: 0,
      phase: 'intro', phaseT: 0, exitShown: false, exitAt: -1, exitOpen: false, freezeT: 0, phoenixUsed: false,
      level: null, player: null, enemies: [], bombs: [], pickups: [], boss: null, tele: [],
      fire: [], fireDir: [], fireG: [], fireO: [], nextId: 1, scoreAtStart: 0, stagesCleared: 0, over: false, levelDirty: true
    };
    G.run = run;
    NS.tracker.stat('runs', 1);
    enterStage(null);
    begin();
  }

  /* The stage the run is on, built fresh from its seed */
  function buildLevel() {
    const run = G.run, P = G.perks;
    const tokens = run.mode === 'zen' ? 3 : 2;
    const common = { luck: P.luck, heartRate: P.heartRate, drop: P.drop, tokens: tokens };
    switch (run.mode) {
      case 'story': return LG.storyLevel(run.world, run.levelIndex, common);
      case 'arcade': return LG.arcadeLevel(run.stage, run.seed, common);
      case 'zen': return LG.zenLevel(run.stage, run.seed, common);
      case 'daily': return LG.dailyLevel(run.stage - 1, G.daily, common);
      case 'rush': return LG.rushLevel(run.stage - 1);
    }
    return LG.arcadeLevel(1, run.seed, common);
  }

  /* Builds the next stage into the run; story stages may open with a cinematic first */
  function enterStage(oldPlayer) {
    const run = G.run;
    const level = buildLevel();
    run.level = level;
    run.levelDirty = true;
    run.fire = new Array(N).fill(0);
    run.fireDir = new Array(N).fill(0);
    run.fireG = new Array(N).fill(0);
    run.fireO = new Array(N).fill(0);
    run.bombs = [];
    run.enemies = [];
    run.pickups = [];
    run.tele = [];
    run.groups = [];
    run.boss = null;
    run.exitShown = false;
    run.exitAt = level.exit;
    run.exitOpen = false;
    run.freezeT = 0;
    run.hurt = false;
    run.t = 0;
    run.combo = 0;
    run.comboT = 0;
    run.timeLeft = level.time ? level.time + G.perks.time : 0;
    run.hurryT = 0;
    run.phase = 'intro';
    run.phaseT = 0;
    run.scoreAtStart = run.score;
    run.gemStreak = 0;
    G.lvl.dirty = true;
    const keep = oldPlayer && !(run.mode === 'story' && run.levelIndex === 0);
    run.player = keep ? NS.player.carry(oldPlayer, level.spawn, run.mods) : NS.player.create(level.spawn, run.mods);
    if (run.mode === 'rush' && !oldPlayer) {
      const p = run.player;
      p.bombs = Math.max(p.bombs, 4); p.fire = Math.max(p.fire, 4); p.speed = Math.max(p.speed, 3); p.kick = true;
    }
    NS.arena.rebuild();
    for (let k = 0; k < level.enemies.length; ++k) {
      const e = level.enemies[k];
      NS.enemies.spawn(e.type, e.i % COLS, (e.i / COLS) | 0, { instant: true });
    }
    if (level.kind === 'boss') {
      const hpMul = run.mode === 'arcade' ? 1 + run.stage / 25 : 1;
      run.boss = NS.bosses.create(level.boss, level.bossAt >= 0 ? level.bossAt : NS.arena.idx(9, 5), hpMul);
    }
    NS.arena.rebuild();
    fx.clear();
    NS.backdrop.setWorld(level.world);
  }

  /* Shows the stage: first the cinematic it is owed (story), then the READY-GO intro */
  function begin() {
    const run = G.run;
    const save = G.save;
    let cine = null;
    if (run.mode === 'story') {
      if (!save.seen.intro) { cine = 'intro'; save.seen.intro = true; }
      else if (run.levelIndex === 0 && !save.seen.chapters[run.world]) { cine = 'chapter' + run.world; save.seen.chapters[run.world] = true; }
      else if (run.levelIndex === LEVELS_PER_WORLD - 1 && !save.seen.bosses[run.world]) { cine = 'boss' + run.world; save.seen.bosses[run.world] = true; }
    }
    NS.save.writeSave();
    NS.save.saveRun();
    if (cine) {
      NS.cine.play(cine, () => {
        /* chapter openers lead straight on to the boss intro when needed, else play */
        if (cine === 'intro' && run.levelIndex === 0 && !save.seen.chapters[run.world]) {
          save.seen.chapters[run.world] = true;
          NS.cine.play('chapter' + run.world, () => NS.screens.setScreen('playing'));
        } else NS.screens.setScreen('playing');
      });
    } else NS.screens.setScreen('playing');
    announce();
  }

  function announce() {
    const run = G.run;
    const sub = run.mode === 'zen' ? 'clear the garden at your own pace' : run.level.kind === 'boss' ? BOSSES[run.level.boss].title : run.mode === 'daily' ? run.mods.map(m => NS.content.MODIFIER_BY_ID[m].name).join(' + ') : 'defeat every enemy, then find the exit';
    fx.banner(run.level.name.toUpperCase(), sub, '#ffd84a', 2.2);
  }

  /* ── per step ── */
  function update(dt) {
    const run = G.run;
    if (!run) return;
    run.phaseT += dt;
    if (run.phase === 'intro') {
      if (run.phaseT > 1.3) {
        run.phase = 'play';
        run.phaseT = 0;
        fx.sfx('select', { pitch: 1.3 });
      }
      return;
    }
    if (run.phase === 'clear') {
      if (run.phaseT > 1.9) finishStage();
      return;
    }
    if (run.phase !== 'play') return;
    run.t += dt;
    if (run.mode === 'rush') run.rushTime += dt;
    if (run.mode === 'zen' && Math.floor((run.t - dt) / 60) !== Math.floor(run.t / 60)) NS.tracker.stat('zenMinutes', 1);
    if (run.comboT > 0) {
      run.comboT -= dt;
      if (run.comboT <= 0) run.combo = 0;
    }
    if (run.gemStreakT > 0) {
      run.gemStreakT -= dt;
      if (run.gemStreakT <= 0) run.gemStreak = 0;
    }
    if (run.timeLeft > 0) {
      run.timeLeft -= dt;
      if (run.timeLeft <= 0) {
        run.timeLeft = 0;
        fx.banner('HURRY UP!', 'they are coming', '#ff5d5d', 1.8);
        fx.sfx('lose', { pitch: 1.4, volume: 0.5 });
        run.hurryT = 1;
      }
    } else if (run.hurryT > 0 && run.mode !== 'zen') {
      run.hurryT -= dt;
      if (run.hurryT <= 0) {
        run.hurryT = C.HURRY_INTERVAL;
        hurrySpawn();
      }
    }
    objective();
    autosaveT += dt;
    if (autosaveT >= C.AUTOSAVE_EVERY) {
      autosaveT = 0;
      NS.save.saveRun();
    }
  }

  function hurrySpawn() {
    const run = G.run, p = run.player;
    let hunters = 0;
    for (let k = 0; k < run.enemies.length; ++k) if (run.enemies[k].hurry) ++hunters;
    if (hunters >= 6 || run.enemies.length > 14) return;
    const g = run.level.grid;
    let best = -1, bestD = -1;
    for (let i = 0; i < N; ++i) {
      if (!LG.isFloor(g[i]) || g[i] === C.T_TELE) continue;
      const d = Math.abs(i % COLS - p.x) + Math.abs(((i / COLS) | 0) - p.y);
      if (d > bestD && rand() < 0.5) { bestD = d; best = i; }
    }
    if (best >= 0) {
      NS.enemies.spawn('wisp', best % COLS, (best / COLS) | 0).hurry = true;
      fx.burst(fx.px(best % COLS), fx.py((best / COLS) | 0), 20, '#d6c8ff', 200, 0.6, 6, true);
    }
  }

  function objective() {
    const run = G.run, p = run.player;
    if (run.mode === 'zen') {
      if (NS.arena.countBricks() === 0 && run.pickups.every(pk => pk.type !== 'gem' && pk.type !== 'gem5')) stageCleared();
      return;
    }
    if (run.level.kind === 'boss') {
      if (run.boss && run.boss.state === 'dead' && run.exitOpen && onExit(p)) stageCleared();
      return;
    }
    /* the wisps of Hurry Up hunt you but never keep the exit shut */
    if (!run.exitOpen && run.enemies.every(e => e.hurry)) {
      run.exitOpen = true;
      fx.banner('EXIT OPEN!', run.exitShown ? 'head for the door' : 'it hides under a brick', '#9af0ff', 1.6);
      fx.sfx('levelup', { pitch: 1.2 });
      if (run.exitShown) fx.ring(fx.px(run.exitAt % COLS), fx.py((run.exitAt / COLS) | 0), 6, 90, 0.6, '#9af0ff', 5);
    }
    if (run.exitOpen && run.exitShown && onExit(p)) stageCleared();
  }

  function onExit(p) {
    const run = G.run;
    if (p.dead || run.exitAt < 0) return false;
    const ex = run.exitAt % COLS, ey = (run.exitAt / COLS) | 0;
    return Math.abs(p.x - ex) < 0.4 && Math.abs(p.y - ey) < 0.4 && run.level.grid[run.exitAt] !== C.T_SOFT && run.level.grid[run.exitAt] !== C.T_CRATE;
  }

  function bossDefeated(b) {
    const run = G.run;
    NS.tracker.stat('bosses', 1);
    addScore(BOSSES[b.type].points, b.x, b.y, false);
    const c = Math.round(b.x), r = Math.round(b.y);
    const i = NS.arena.idx(c, r);
    run.level.grid[i] = C.T_EMPTY;
    run.levelDirty = true;
    run.exitAt = i;
    run.exitShown = true;
    run.exitOpen = true;
    run.enemies.length = 0;
    for (let k = 0; k < 6; ++k) NS.items.spawn(k < 5 ? 'gem5' : 'heart', i, 1);
    for (let k = 0; k < run.pickups.length; ++k) {
      const pk = run.pickups[k];
      if (pk.i === i && (pk.type === 'gem5' || pk.type === 'heart')) {
        pk.x += Math.cos(k * 1.3) * 1.2;
        pk.y += Math.sin(k * 1.3) * 1.0;
        pk.x = Math.max(1, Math.min(COLS - 2, pk.x));
        pk.y = Math.max(1, Math.min(ROWS - 2, pk.y));
      }
    }
    fx.banner('EMBER RECOVERED!', 'step into the light', '#ffd84a', 2.2);
  }

  /* ── score ── */
  function addScore(pts, x, y, useMult) {
    const run = G.run;
    if (!run) return 0;
    const mult = useMult ? rules.comboMultiplier(run.combo) : 1;
    const v = Math.round(pts * mult);
    run.score += v;
    if (x !== undefined && v >= 50) fx.text(x, y, (mult > 1 ? 'x' + mult + ' ' : '') + v, mult > 1 ? '#ffd84a' : '#ffffff', Math.min(26, 13 + Math.log(v) * 1.4));
    return v;
  }

  /* ── ending a stage ── */
  function stageCleared() {
    const run = G.run;
    if (run.phase !== 'play') return;
    run.phase = 'clear';
    run.phaseT = 0;
    const p = run.player;
    p.squash = 0.5;
    fx.confetti(fx.px(p.x), fx.py(p.y), 50);
    fx.sfx('win');
    fx.banner(run.mode === 'zen' ? 'GARDEN CLEAR' : 'STAGE CLEAR!', '', '#7cf08a', 1.8);
    /* leftover time is worth points */
    if (run.timeLeft > 0) addScore(Math.floor(run.timeLeft) * 10);
  }

  /* Pays the run's gems into the save (with the gem perk and daily modifiers) */
  function bankGems(extra) {
    const run = G.run;
    const base = (run ? run.gemsRun : 0) + (extra || 0);
    const paid = rules.gemPayout(base, G.perks, run ? run.mods : null);
    G.save.gems += paid;
    NS.tracker.stat('gems', paid);
    if (run) run.gemsRun = 0;
    return paid;
  }

  /* A run left in storage (abandoned for a new one) still pays its gems */
  function bankStoredRun() {
    const old = NS.save.loadRun();
    if (old && old.gemsRun > 0) G.save.gems += rules.gemPayout(old.gemsRun, G.perks, old.mods);
    NS.save.clearRun();
  }

  function finishStage() {
    const run = G.run;
    const save = G.save;
    run.phase = 'between';
    ++run.stagesCleared;
    NS.tracker.stat('levels', 1);
    const gained = run.score - run.scoreAtStart;
    NS.tracker.stat('xp', gained);
    const res = { mode: run.mode, cleared: true, title: run.level.name, score: run.score, stageScore: gained, time: run.t, kills: run.kills, lines: [], buttons: [] };
    let reward = 0;
    if (run.mode === 'story') {
      const stars = rules.starRating({ hurt: run.hurt, time: run.t, par: run.level.par });
      const first = !rules.levelCleared(save, run.world, run.levelIndex);
      const newStars = rules.recordStars(save, run.world, run.levelIndex, stars);
      reward = rules.stageReward('story', run.world, newStars, first);
      res.stars = stars;
      res.par = run.level.par;
      res.hurt = run.hurt;
      res.lines.push(['Stage reward', reward]);
    } else {
      reward = rules.stageReward(run.mode, run.level.world, 0, false);
      res.lines.push(['Stage reward', reward]);
    }
    res.lines.push(['Gems collected', run.gemsRun]);
    const paid = bankGems(reward);
    res.gems = paid;
    res.tokens = run.tokensRun;
    res.unlocks = rules.unlockEarned(save);
    NS.tracker.check();
    /* advance */
    const oldPlayer = run.player;
    let done = false;
    if (run.mode === 'story') {
      const bossDone = run.levelIndex === LEVELS_PER_WORLD - 1;
      if (bossDone && run.world === WORLDS.length - 1) done = true;
      else if (bossDone) { ++run.world; run.levelIndex = 0; }
      else ++run.levelIndex;
      res.next = done ? null : 'story';
      if (bossDone) res.worldCleared = run.world - (done ? 0 : 1);
    } else if (run.mode === 'daily' && run.stage >= 3) done = true;
    else if (run.mode === 'rush' && run.stage >= BOSS_ORDER.length) done = true;
    ++run.stage;
    if (done) {
      endRun(true, res);
      if (run.mode === 'story' && !save.seen.finale) {
        save.seen.finale = true;
        NS.save.writeSave();
        NS.cine.play('finale', () => NS.results.show(res));
        return;
      }
      NS.results.show(res);
      return;
    }
    enterStage(oldPlayer);
    run.phase = 'intro';
    NS.save.writeSave();
    NS.save.saveRun();
    NS.results.show(res);
  }

  function gameOver() {
    const run = G.run;
    if (!run || run.over) return;
    const res = { mode: run.mode, cleared: false, title: run.mode === 'story' ? run.level.name : 'Game Over', score: run.score, time: run.t, kills: run.kills, lines: [], buttons: [] };
    NS.tracker.stat('xp', run.score - run.scoreAtStart);
    res.lines.push(['Gems collected', run.gemsRun]);
    res.gems = bankGems(0);
    res.tokens = run.tokensRun;
    endRun(false, res);
    fx.sfx('lose');
    NS.results.show(res);
  }

  /* Closes the run: score tables, mode records, and the stored run is cleared */
  function endRun(won, res) {
    const run = G.run;
    const save = G.save;
    run.over = true;
    const today = R.dayKey();
    if (run.mode === 'arcade' || run.mode === 'zen' || run.mode === 'daily' || run.mode === 'rush') {
      res.rank = rules.addScore(save, run.mode, run.score, run.stage - (won ? 1 : 0), today);
      if (run.mode === 'arcade') {
        NS.tracker.best('arcadeBest', run.score);
        NS.tracker.best('arcadeStage', run.stage);
      }
    }
    if (run.mode === 'daily') {
      if (run.score > save.daily.best) save.daily.best = run.score;
      if (won && !save.daily.done) {
        save.daily.done = true;
        NS.tracker.stat('dailyClears', 1);
        save.gems += 80;
        res.lines.push(['Daily bonus', 80]);
        res.gems = (res.gems || 0) + 80;
      }
    }
    if (run.mode === 'rush' && won) {
      NS.tracker.stat('rushClears', 1);
      if (!save.stats.rushBest || run.rushTime < save.stats.rushBest) save.stats.rushBest = Math.round(run.rushTime);
      res.lines.push(['Rush time', Math.round(run.rushTime) + 's']);
    }
    res.won = won;
    NS.tracker.check();
    NS.save.clearRun();
    NS.save.writeSave();
  }

  /* Save & Quit: the run stays in storage for Continue */
  function suspend() {
    if (!G.run || G.run.over) return;
    NS.save.saveRun();
    NS.save.writeSave();
    NS.save.probeContinue();
  }

  /* Abandon: pays gems, records the score, forgets the run */
  function abandon() {
    const run = G.run;
    if (!run || run.over) return;
    bankGems(0);
    endRun(false, { lines: [] });
    G.run = null;
  }

  /* Continue: restores the stored run exactly as it was */
  function resume() {
    const r = NS.save.loadRun();
    if (!r) return false;
    G.run = r;
    G.lvl.dirty = true;
    r.levelDirty = true;
    r.player.onBomb = r.player.onBomb || [];
    fx.clear();
    NS.arena.rebuild();
    NS.backdrop.setWorld(r.level.world);
    NS.screens.setScreen('paused');
    fx.banner('WELCOME BACK', r.level.name, '#7cf08a', 1.8);
    return true;
  }

  Object.assign(NS.run, {
    rand, hasMod, newRun, buildLevel, enterStage, begin, update, addScore, bossDefeated, stageCleared, bankGems, finishStage,
    gameOver, endRun, suspend, abandon, resume
  });
})();
