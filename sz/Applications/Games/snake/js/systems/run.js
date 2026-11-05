/* Runs: building one for each mode (Story levels, Arcade stages, Zen, the Daily Garden, Time
   Attack, Guardian Rush and the title-screen demo), the countdown, the story exit gate, Arcade
   stage-ups, clocks, deaths and respawns, guardians falling, the end of a run with its rewards,
   high scores and stars, Save & Quit and restoring an autosaved run exactly. Owns G.run and
   G.rng. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const C = NS.constants;
  const { WORLDS, BOSSES, BOSS_ORDER, LEVELS_PER_WORLD, THEMES } = NS.worlds;
  const { makeRng, hashString } = NS.rng;
  const L = NS.levels;
  const B = NS.board;
  const fx = NS.fx;
  const rules = NS.rules;
  const { sfx } = NS.audio;

  const ARCADE_CRITTERS = ['ant', 'beetle', 'hornet', 'hedgehog', 'rival', 'imp', 'wisp'];

  function blank(mode, seed) {
    G.rng = makeRng(seed >>> 0);
    const st = G.stats;
    return {
      mode: mode, w: 0, l: 0, stage: 1, rushList: null, rushIndex: 0, level: null, speed: 0.15, rngS: 0,
      snake: null, foods: [], power: null, powerT: 5, act: {}, shield: Math.floor(st.shields), venom: st.venom > 0 ? 2 : 0,
      venomFruit: 0, enemies: [], boss: null, shots: [], marks: [], gate: -1, score: 0, combo: 0, comboT: 0, maxCombo: 0,
      eaten: 0, stageFruit: 0, eggs: [], deaths: 0, lives: 1, time: 0, hazT: 0, timeLeft: 0, tokens: 0, gems: 0, kills: 0,
      powerUses: 0, maxLength: C.START_LEN, phase: 'ready', phaseT: 1.8, tokenT: 8, shardT: 1.2, respawnCritters: true,
      mutators: [], auto: false, immortal: false, bossDown: false, secT: 0, saveT: 0, banner: null, daily: '',
    };
  }

  function boardTheme() {
    const eq = NS.cosmetics.find('board', G.save.equip.board);
    if (eq.theme >= 0) return eq.theme;
    return G.season ? G.season.theme : 0;
  }

  /* fills the board with the level's starting contents */
  function setupLevel(level) {
    const run = G.run;
    level.ver = 0;
    run.level = level;
    run.foods = [];
    run.enemies = [];
    run.marks = [];
    run.shots = [];
    run.power = null;
    run.gate = -1;
    run.boss = null;
    run.eggs = level.eggs.map(() => false);
    NS.snake.reset(level.start, C.START_LEN);
    for (let k = 0; k < level.eggs.length; ++k) NS.food.add(level.eggs[k], 'egg');
    if (level.boss) run.boss = NS.bosses.create(level.boss);
    B.rebuildOcc();
    NS.enemies.spawnAll(level.enemies || []);
    if (run.mutators.indexOf('hornets') >= 0) NS.enemies.spawnAll(['hornet', 'hornet', 'hornet']);
    NS.food.ensure();
    if (G.stats.starter > 0 && run.mode !== 'demo') {
      const pool = ['dash', 'magnet', 'golden', 'shield', 'warp'];
      run.pendingStarter = pool[Math.floor(G.rng() * pool.length)];
    }
    run.phase = 'ready';
    run.phaseT = 1.8;
    G.prevBody = run.snake.body.slice();
    fx.clear();
  }

  function begin(run) {
    G.run = run;
    if (run.mode !== 'demo') {
      NS.progress.dayStart();
      NS.progress.add('runs', 1);
    }
  }

  function startStory(w, l) {
    const lv = L.storyLevel(w, l);
    const run = blank('story', hashString('story-run-' + w + '-' + l + '-' + Date.now()));
    run.w = w;
    run.l = l;
    run.speed = lv.speed;
    run.lives = 3 + Math.floor(G.stats.lives);
    run.respawnCritters = true;
    begin(run);
    setupLevel(lv);
    run.banner = { title: WORLDS[w].name + '  ' + (w + 1) + '-' + (l + 1), sub: lv.boss ? BOSSES[lv.boss].name : lv.name + ' - eat ' + lv.goal + ' fruit, then find the exit', t: 0 };
    play();
  }

  function arcadeBoard(seed, theme, extra) {
    const opts = Object.assign({ seed: seed, theme: theme, motif: 'open', wrap: false, crates: 3, eggs: 0, hazards: {} }, extra || {});
    const lv = L.buildBoard(opts);
    lv.goal = 0;
    lv.enemies = [];
    lv.boss = null;
    return lv;
  }

  function applyMutatorBoard(muts) {
    const ex = { hazards: {} };
    if (muts.indexOf('portals') >= 0) ex.portals = 2;
    if (muts.indexOf('ice') >= 0) ex.hazards.ice = 40;
    return ex;
  }

  function startArcade() {
    const seed = (Date.now() ^ 0x2545f491) >>> 0;
    const run = blank('arcade', seed);
    run.mutators = [G.weekly.id];
    run.lives = 1 + Math.floor(G.stats.lives);
    run.speed = 0.15;
    begin(run);
    const lv = arcadeBoard(seed, boardTheme(), applyMutatorBoard(run.mutators));
    lv.enemies = ['ant'];
    setupLevel(lv);
    run.banner = { title: 'ARCADE  -  Stage 1', sub: 'This week: ' + G.weekly.name + ' - ' + G.weekly.desc, t: 0 };
    play();
  }

  function startZen() {
    const seed = (Date.now() ^ 0x7f4a7c15) >>> 0;
    const run = blank('zen', seed);
    run.speed = 0.17;
    run.immortal = true;
    run.shield = 0;
    run.venom = 0;
    begin(run);
    const lv = L.buildBoard({ seed: seed, theme: boardTheme(), motif: 'none', wrap: true, eggs: 0 });
    lv.goal = 0; lv.enemies = []; lv.boss = null;
    setupLevel(lv);
    run.banner = { title: 'ZEN', sub: 'No crashes, no clock. Biting your tail sheds it as petals.', t: 0 };
    play();
  }

  function startTime() {
    const seed = (Date.now() ^ 0x1b873593) >>> 0;
    const run = blank('time', seed);
    run.speed = 0.14;
    run.timeLeft = 90;
    run.lives = 99;
    begin(run);
    const lv = arcadeBoard(seed, boardTheme());
    lv.enemies = ['ant', 'beetle'];
    setupLevel(lv);
    run.banner = { title: 'TIME ATTACK', sub: '90 seconds. Golden apples add 3 seconds, crashes cost 10.', t: 0 };
    play();
  }

  function startDaily() {
    const rec = NS.seasons.dailyRecipe(new Date());
    const run = blank('daily', rec.seed);
    run.daily = rec.key;
    run.mutators = rec.mutators.slice();
    run.speed = 0.14;
    run.timeLeft = 120;
    run.lives = 99;
    begin(run);
    const ex = applyMutatorBoard(run.mutators);
    ex.motif = rec.motif;
    ex.crates = 4;
    const lv = arcadeBoard(rec.seed, rec.theme, ex);
    lv.enemies = WORLDS[rec.theme].levels[2].enemies.slice(0, 2);
    setupLevel(lv);
    const names = run.mutators.map(id => NS.seasons.MUTATOR_BY_ID[id].name).join(' + ');
    run.banner = { title: 'DAILY GARDEN  ' + rec.key, sub: names + ' - two minutes, best score counts', t: 0 };
    play();
  }

  function startRush() {
    const list = rules.freedInOrder(G.save);
    if (!list.length) return;
    const run = blank('rush', (Date.now() ^ 0x85ebca6b) >>> 0);
    run.rushList = list;
    run.rushIndex = 0;
    run.lives = 3 + Math.floor(G.stats.lives);
    begin(run);
    rushLevel();
    play();
  }

  function rushLevel() {
    const run = G.run;
    const boss = run.rushList[run.rushIndex];
    const w = BOSSES[boss].world;
    const lv = L.storyLevel(w, LEVELS_PER_WORLD - 1);
    run.w = w;
    run.l = LEVELS_PER_WORLD - 1;
    run.speed = lv.speed;
    run.bossDown = false;
    lv.eggs = [];
    setupLevel(lv);
    run.respawnCritters = true;
    run.banner = { title: 'GUARDIAN RUSH  ' + (run.rushIndex + 1) + ' / ' + run.rushList.length, sub: BOSSES[boss].name, t: 0 };
  }

  /* the title screen's self-playing board */
  function startDemo() {
    const seed = (Date.now() ^ 0x68e31da4) >>> 0;
    const run = blank('demo', seed);
    run.auto = true;
    run.immortal = true;
    run.speed = 0.11;
    run.lives = 99;
    G.run = run;
    const lv = L.buildBoard({ seed: seed, theme: boardTheme(), motif: 'pillars', wrap: false, crates: 2, eggs: 0 });
    lv.goal = 0; lv.enemies = ['ant']; lv.boss = null;
    setupLevel(lv);
    run.phase = 'play';
    run.snake.grow = 8;
  }

  /* story entry from the map: the intro, chapter and guardian cinematics play first, once */
  function storyEntry(w, l) {
    const seen = G.save.seen;
    const go = () => startStory(w, l);
    if (!seen.intro) { NS.cine.play('intro', () => storyEntry(w, l)); return; }
    if (l === 0 && !seen['chapter' + w]) { NS.cine.play('chapter' + w, go); return; }
    if (l === LEVELS_PER_WORLD - 1 && !seen['boss' + w]) { NS.cine.play('boss' + w, go); return; }
    go();
  }

  function play() {
    NS.screens.setScreen('playing');
    sfx('select');
  }

  /* ── per-frame flow (called by sim while playing) ── */
  function update(dt) {
    const run = G.run;
    run.time += dt;
    if (run.banner) {
      run.banner.t += dt;
      if (run.banner.t > 3.2) run.banner = null;
    }
    if (run.phase === 'ready') {
      run.phaseT -= dt;
      const prev = Math.ceil(run.phaseT + dt), now = Math.ceil(run.phaseT);
      if (now !== prev && now > 0 && run.mode !== 'demo') sfx('blip', { pitch: 0.8 });
      if (run.phaseT <= 0) {
        run.phase = 'play';
        if (run.mode !== 'demo') sfx('select', { pitch: 1.3 });
        if (run.pendingStarter) { NS.powerups.activate(run.pendingStarter); run.pendingStarter = null; }
      }
      return false;
    }
    if (run.phase === 'won' || run.phase === 'over') {
      run.phaseT -= dt;
      if (run.phaseT <= 0) finishPhase();
      return run.phase === 'won';
    }
    if (run.mode === 'demo') return true;
    run.secT += dt;
    if (run.secT >= 1) {
      run.secT -= 1;
      NS.progress.add('playTime', 1);
      if (run.mode === 'zen') NS.progress.add('zenTime', 1);
    }
    if ((run.mode === 'time' || run.mode === 'daily') && run.snake.alive) {
      run.timeLeft -= dt;
      if (run.timeLeft <= 0) {
        run.timeLeft = 0;
        endPhase('over', 'time');
      }
    }
    if (run.mode === 'story' && !run.level.boss && run.gate < 0 && run.eaten >= run.level.goal) openGate();
    if (run.mode === 'arcade' && run.stageFruit !== run.eaten) arcadeProgress();
    run.saveT += dt;
    if (run.saveT >= C.AUTOSAVE_EVERY) {
      run.saveT = 0;
      NS.save.writeRun();
    }
    return true;
  }

  function openGate() {
    const run = G.run;
    const i = B.freeCell(8);
    if (i < 0) return;
    run.gate = i;
    fx.ring(fx.cx(i), fx.cy(i), 6, 120, 0.8, '#ffe07a', 8);
    fx.burst(fx.cx(i), fx.cy(i), 30, ['#ffe07a', '#ffffff', '#7ee07a'], 300, 0.8, 9, fx.STAR);
    run.banner = { title: 'The exit is open!', sub: 'Reach the glowing gate' + (run.eggs.every(e => e) ? '' : ' - or grab the last golden eggs first'), t: 0.6 };
    sfx('levelup');
  }

  function arcadeProgress() {
    const run = G.run;
    const per = 12;
    const stage = 1 + Math.floor(run.eaten / per);
    run.stageFruit = run.eaten;
    if (stage <= run.stage) return;
    run.stage = stage;
    run.speed = Math.max(0.075, run.speed * 0.94);
    const lv = run.level;
    if (stage % 3 === 1) {
      lv.theme = (lv.theme + 1) % 5;
      lv.ver = (lv.ver || 0) + 1;
    }
    for (let k = 0; k < Math.min(6, stage); ++k) {
      const i = B.freeCell(5);
      if (i >= 0) B.addMark(i, 'warn', 1.4, 'crate');
    }
    if (stage % 2 === 0) NS.enemies.spawnOne(ARCADE_CRITTERS[Math.min(ARCADE_CRITTERS.length - 1, Math.floor(stage / 2))]);
    run.banner = { title: 'STAGE ' + stage, sub: THEMES[lv.theme].name + ' - faster, busier, x' + (1 + (stage - 1) * 0.1).toFixed(1) + ' points', t: 0 };
    fx.flash('#ffffff', 0.25);
    sfx('levelup');
  }

  function levelComplete() {
    const run = G.run;
    if (run.phase !== 'play') return;
    const h = run.snake.body[0];
    fx.ring(fx.cx(h), fx.cy(h), 10, 260, 0.9, '#ffe07a', 10);
    for (let k = 0; k < 5; ++k) fx.burst(fx.cx(h) + (k - 2) * 60, fx.cy(h) - 40, 20, ['#ffe07a', '#7ee07a', '#ffffff', '#6fd3ff'], 360, 1.0, 9, fx.STAR, 200);
    fx.flash('#fff6c0', 0.4);
    sfx('win');
    endPhase('won', 'cleared');
  }

  function bossDefeated() {
    const run = G.run;
    run.bossDown = true;
    if (run.mode === 'rush' && run.rushIndex < run.rushList.length - 1) {
      run.phase = 'won';
      run.phaseT = 2.4;
      run.outcome = 'next-boss';
      return;
    }
    endPhase('won', 'cleared');
    run.phaseT = 2.6;
  }

  function endPhase(phase, outcome) {
    const run = G.run;
    run.phase = phase;
    run.phaseT = phase === 'won' ? 1.8 : 1.4;
    run.outcome = outcome;
    if (phase === 'over') sfx('lose');
  }

  function finishPhase() {
    const run = G.run;
    if (run.outcome === 'next-boss') {
      run.rushIndex += 1;
      rushLevel();
      return;
    }
    finish(run.outcome);
  }

  function afterDeath() {
    const run = G.run;
    if (run.mode === 'time' || run.mode === 'daily') {
      run.timeLeft = Math.max(0, run.timeLeft - 10);
      fx.text(fx.cx(run.level.start.i), fx.cy(run.level.start.i) - 30, '-10s', '#ff6a6a', 24);
      if (run.timeLeft <= 0) { endPhase('over', 'time'); return; }
      respawn();
      return;
    }
    run.lives -= 1;
    if (run.lives > 0) respawn();
    else endPhase('over', 'failed');
  }

  function respawn() {
    const run = G.run;
    let start = run.level.start;
    if (run.mode !== 'story' && run.mode !== 'rush') {
      const i = B.freeCell(6, (c) => {
        if (c % C.COLS > C.COLS - 7) return false;
        for (let k = 1; k <= 5; ++k) if (!B.isFree(c + k)) return false;
        return true;
      });
      if (i >= 0) start = { i: i, dir: 1 };
    }
    NS.snake.reset(start, C.START_LEN);
    run.snake.iframes = C.RESPAWN_IFRAMES + G.stats.iframes;
    run.shield = Math.max(run.shield, Math.floor(G.stats.shields));
    run.marks = run.marks.filter(m => m.kind === 'rock');
    const h = run.snake.body[0];
    fx.ring(fx.cx(h), fx.cy(h), 80, 6, 0.5, '#ffffff', 5);
    sfx('powerup', { pitch: 0.8, volume: 0.6 });
  }

  /* the run is over: rewards, records, results screen */
  function finish(outcome) {
    const run = G.run;
    const save = G.save;
    const res = { mode: run.mode, outcome: outcome, score: run.score, length: run.maxLength, combo: run.maxCombo, time: run.time,
      kills: run.kills, tokens: run.tokens, gems: run.gems, w: run.w, l: run.l, stars: null, newStars: 0, high: false, scales: 0 };
    let mul = 1;
    for (let k = 0; k < run.mutators.length; ++k) mul *= NS.seasons.MUTATOR_BY_ID[run.mutators[k]].scales || 1;
    if (run.mode === 'story') {
      const got = run.eggs.filter(e => e).length;
      res.eggs = got;
      res.eggTotal = run.eggs.length;
      res.deaths = run.deaths;
      if (outcome === 'cleared') {
        res.stars = rules.levelStars(true, got, run.eggs.length, run.deaths);
        res.newStars = rules.recordLevel(save, run.w, run.l, res.stars, run.score);
        NS.progress.add('levelsCleared', 1);
        if (run.level.boss && save.story.freed.indexOf(run.level.boss) < 0) {
          save.story.freed.push(run.level.boss);
          res.freed = run.level.boss;
        }
        res.boss = !!run.level.boss;
      }
    }
    if (run.mode === 'arcade') {
      res.stage = run.stage;
      NS.progress.best('arcadeBest', run.score);
    }
    if (run.mode === 'time') NS.progress.best('timeBest', run.score);
    if (run.mode === 'daily') {
      const prev = save.daily[run.daily] || 0;
      res.prevBest = prev;
      save.daily[run.daily] = Math.max(prev, run.score);
      NS.progress.add('dailyDone', 1);
      if (!prev) mul *= 1.5;
    }
    if (run.mode === 'rush' && outcome === 'cleared') {
      NS.progress.add('rushClears', 1);
      res.boss = true;
    }
    res.cleared = outcome === 'cleared';
    res.scales = rules.scalesForRun(res, G.stats, mul);
    NS.progress.addScales(res.scales);
    if (run.mode !== 'zen' && run.mode !== 'story' && run.score > 0) res.high = addHighScore(run);
    NS.progress.checkAchievements();
    NS.save.clearRun();
    run.phase = 'over';
    NS.save.writeSave();
    G.ui.results = res;
    NS.screens.setScreen('results');
    if (res.freed) NS.cine.play(res.freed === 'eclipse' ? 'finale' : 'outro' + BOSSES[res.freed].world, () => NS.screens.setScreen('results'));
  }

  function addHighScore(run) {
    const list = G.save.highScores;
    const names = { arcade: 'Arcade', time: 'Time Attack', daily: 'Daily', rush: 'Guardian Rush' };
    const entry = { score: run.score, mode: names[run.mode] || run.mode, detail: run.mode === 'arcade' ? 'stage ' + run.stage : 'length ' + run.maxLength, date: Date.now() };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    if (list.length > C.MAX_HIGH_SCORES) list.length = C.MAX_HIGH_SCORES;
    return list.indexOf(entry) >= 0 && list.indexOf(entry) < 3;
  }

  /* pause menu: leave now but keep the autosave to continue later */
  function saveAndQuit() {
    NS.save.writeRun();
    NS.save.writeSave();
    G.run = null;
    NS.screens.toTitle();
  }

  /* pause menu: give up the run (still pays out what was earned) */
  function abandon() {
    const run = G.run;
    if (!run) return;
    finish(run.mode === 'zen' ? 'rested' : 'quit');
  }

  function restart() {
    const run = G.run;
    if (!run) return;
    NS.save.clearRun();
    switch (run.mode) {
      case 'story': startStory(run.w, run.l); break;
      case 'arcade': startArcade(); break;
      case 'zen': startZen(); break;
      case 'time': startTime(); break;
      case 'daily': startDaily(); break;
      case 'rush': startRush(); break;
    }
  }

  /* brings back an autosaved run, paused, exactly where it was left */
  function restore(snap) {
    G.rng = makeRng(1);
    G.rng.s = snap.rngS >>> 0;
    G.run = snap;
    if (!snap.level.portals) L.linkPortals(snap.level);
    snap.level.ver = (snap.level.ver || 0) + 1;
    G.prevBody = snap.snake.body.slice();
    fx.clear();
    if (snap.feel) { G.hitstop = snap.feel[0] || 0; G.slowmo = snap.feel[1] || 0; }
    B.rebuildOcc();
    NS.screens.setScreen('paused');
    NS.progress.toast('Welcome back - your run is right where you left it', '#7cff9a', 'check');
    return true;
  }

  function scoreMul() {
    const run = G.run;
    return run && run.mode === 'arcade' ? 1 + (run.stage - 1) * 0.1 : 1;
  }

  Object.assign(NS.run, {
    BOSS_ORDER, blank, setupLevel, storyEntry, startStory, startArcade, startZen, startTime, startDaily, startRush, startDemo, update,
    openGate, levelComplete, bossDefeated, afterDeath, respawn, finish, saveAndQuit, abandon, restart, restore, scoreMul, boardTheme
  });
})();
