/* A run from start to finish: creating one per mode (story stage, arcade, zen, daily, boss rush,
   or the attract-mode demo), continuing the autosaved one, the per-step clocks (dot chain,
   multiplier decay, Zen time and ambience, autosave), advancing after a cleared maze (story
   chapters, relightings and the ending), paying shards as it goes, and the final tally into
   records, achievements, quests and the results screen. Owns G.run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { WORLDS } = NS.worlds;
  const R = NS.rules;
  const RNG = NS.rng;
  const { sfx } = NS.audio;

  function create(mode, opts) {
    opts = opts || {};
    const st = G.stats;
    const run = {
      v: 1, mode: mode, demo: !!opts.demo, seed: opts.seed !== undefined ? opts.seed : (Math.random() * 1e9) >>> 0,
      world: opts.world || 0, stage: opts.stage || 0, n: 0, score: 0, lives: st.lives, mult: 1, multPts: 0,
      chain: 0, chainT: 0, bestChain: 0, mods: opts.mods || [], reviveUsed: false, paid: 0, shards: 0,
      tally: { dots: 0, ghosts: 0, powerups: 0, fruits: 0, bosses: 0, tokens: 0, mazes: 0 },
      playTime: 0, startedAt: Date.now(), lvl: null, over: false, autosaveT: 0, checkT: 0, dayKey: opts.dayKey || '',
    };
    if (run.mods.indexOf('glass') >= 0) run.lives = 1;
    if (mode === 'zen') run.lives = 1;
    if (opts.demo) run.lives = 3;
    return run;
  }

  /* Starts a run and its first maze */
  function begin(run) {
    G.run = run;
    NS.level.start(run);
    if (!run.demo) {
      const p = G.profile;
      R.bump(p, 'runs', 1);
      const bonus = R.touchStreak(p, RNG.dayNumber(G.date));
      if (bonus) NS.screens.toast('Day ' + p.streak.count + ' streak - +' + bonus + ' shards', '#7af0ff');
      NS.save.saveRun();
      NS.save.writeProfile();
    }
  }

  function demo() {
    const run = create('arcade', { demo: true, seed: (Math.random() * 1e9) >>> 0 });
    run.n = Math.floor(Math.random() * 10);
    G.run = run;
    NS.level.start(run);
    run.lvl.phase = 'play';
    return run;
  }

  /* Restores the autosaved run exactly; returns false when there is none */
  function resume() {
    const r = NS.save.loadRun();
    if (!r) return false;
    G.run = r;
    NS.fx.clear();
    if (r.lvl.phase === 'dying' || r.lvl.phase === 'clear') r.lvl.phase = 'ready';
    if (r.lvl.phase === 'play') NS.level.setPhase(r.lvl, 'ready');
    return true;
  }

  function update(run, dt) {
    if (run.chainT > 0) {
      run.chainT -= dt;
      if (run.chainT <= 0) {
        if (run.chain >= 30 && !run.demo) {
          R.bumpMax(G.profile, 'bestChain', run.chain);
          const pac = run.lvl.pac;
          NS.fx.floater(NS.grid.px(pac.x), NS.grid.py(pac.y) - 24, 'chain ' + run.chain, '#7af0ff', 15, 1);
        }
        run.chain = 0;
      }
    } else if (run.multPts > 0 && run.lvl.phase === 'play') {
      run.multPts = Math.max(0, run.multPts - dt * 5);
      run.mult = NS.level.multiplier(run);
    }
    if (run.demo) return;
    run.playTime += dt;
    G.profile.stats.playTime += dt;
    if (run.mode === 'zen') {
      R.bump(G.profile, 'zenTime', dt);
      NS.audio.ambience(dt, run.seed % 7);
    }
    run.autosaveT += dt;
    if (run.autosaveT >= C.AUTOSAVE_EVERY) {
      run.autosaveT = 0;
      NS.save.saveRun();
      NS.save.writeProfile();
    }
    run.checkT += dt;
    if (run.checkT >= 1) {
      run.checkT = 0;
      check();
    }
  }

  /* achievements, quests and unlocks earned so far */
  function check() {
    const p = G.profile;
    R.bumpMax(p, 'bestChain', G.run ? G.run.bestChain : 0);
    const ach = R.checkAchievements(p);
    if (ach.length) NS.screens.achievements(ach);
    const quests = R.checkQuests(p);
    for (let i = 0; i < quests.length; ++i) NS.screens.toast('Quest done: ' + quests[i].text + '  +' + quests[i].reward + ' shards', '#5aff9a');
    const got = R.syncUnlocks(p);
    for (let i = 0; i < got.length; ++i) NS.screens.toast('Unlocked ' + got[i].kind + ': ' + got[i].item.name, '#ffd23a');
  }

  /* converts score earned since the last payout into shards */
  function pay(run, mazeBonus) {
    if (run.demo) return 0;
    const pts = run.score - run.paid;
    run.paid = run.score;
    const n = Math.floor((pts / (run.mode === 'zen' ? 260 : 200) + (mazeBonus || 0)) * G.stats.shardBonus);
    run.shards += n;
    R.addShards(G.profile, n);
    return n;
  }

  function stars(lvl) {
    return lvl.perfect ? 3 : lvl.deaths <= 1 ? 2 : 1;
  }

  function mazeCleared(run) {
    const lvl = run.lvl;
    if (run.demo) {
      ++run.n;
      NS.level.start(run);
      run.lvl.phase = 'play';
      return;
    }
    const p = G.profile;
    ++run.tally.mazes;
    R.bump(p, 'mazes', 1);
    if (lvl.perfect && lvl.kind === 'maze') {
      const a = R.feat(p, 'perfect');
      if (a) NS.screens.achievements([a]);
    }
    pay(run, 6);
    switch (run.mode) {
      case 'story': {
        const key = run.world + '-' + run.stage;
        p.story.cleared[key] = Math.max(p.story.cleared[key] || 0, stars(lvl));
        p.story.best[key] = Math.max(p.story.best[key] || 0, run.score);
        ++run.stage;
        if (run.stage > 4) {
          const w = run.world;
          p.story.reached = Math.max(p.story.reached, w + 1);
          checkBosses(p);
          if (w >= WORLDS.length - 1) {
            p.story.done = true;
            const a = R.feat(p, 'story');
            if (a) NS.screens.achievements([a]);
            check();
            NS.cinematics.play('ending', { world: w }, () => finish(run, true));
            return;
          }
          run.world = w + 1;
          run.stage = 0;
          next(run);
          NS.cinematics.play('relight', { world: w }, () => NS.screens.chapter(run.world, () => NS.screens.setScreen('playing')));
          return;
        }
        next(run);
        if (run.stage === 4) {
          NS.cinematics.play('boss', { world: run.world, boss: WORLDS[run.world].boss }, () => NS.screens.setScreen('playing'));
          return;
        }
        break;
      }
      case 'daily':
        ++run.n;
        if (run.n >= 3) { finish(run, true); return; }
        next(run);
        break;
      case 'bossrush':
        ++run.n;
        checkBosses(p);
        if (run.n >= WORLDS.length) { finish(run, true); return; }
        next(run);
        break;
      default:
        ++run.n;
        next(run);
        if (run.lvl.kind === 'boss') {
          NS.cinematics.play('boss', { world: run.lvl.world, boss: run.lvl.bossId }, () => NS.screens.setScreen('playing'));
          return;
        }
        if (run.mode === 'arcade' && run.n % 4 === 0) {
          NS.cinematics.play('intermission', { world: run.lvl.world }, () => NS.screens.setScreen('playing'));
          return;
        }
    }
    NS.screens.setScreen('playing');
    G.ui.wipe = 1;
  }

  function checkBosses(p) {
    let all = true;
    for (let i = 0; i < WORLDS.length; ++i) if (!p.seen['boss:' + WORLDS[i].boss]) all = false;
    if (all) {
      const a = R.feat(p, 'bosses5');
      if (a) NS.screens.achievements([a]);
    }
  }

  function next(run) {
    NS.level.start(run);
    NS.save.saveRun();
    NS.save.writeProfile();
  }

  function gameOver(run) {
    if (run.demo) {
      demo();
      return;
    }
    finish(run, false);
  }

  /* the end of a run: payouts, records, the results screen */
  function finish(run, won) {
    run.over = true;
    const p = G.profile;
    pay(run, 0);
    let rank = -1;
    const date = RNG.dayKey(G.date);
    if (run.mode === 'arcade' || run.mode === 'daily' || run.mode === 'bossrush') {
      const detail = run.mode === 'arcade' ? 'Maze ' + (run.n + 1) : run.mode === 'daily' ? 'Daily ' + date : run.n + ' bosses';
      rank = R.addHighScore(p, { score: run.score, mode: run.mode, detail: detail, date: date });
    }
    const best = p.best[run.mode] || 0;
    const record = run.mode !== 'story' && run.score > best;
    if (record) p.best[run.mode] = run.score;
    if (run.mode === 'arcade') R.bumpMax(p, 'bestArcade', run.score);
    if (run.mode === 'daily') {
      if (p.daily.key !== run.dayKey) p.daily = { key: run.dayKey, best: 0, runs: 0 };
      p.daily.best = Math.max(p.daily.best, run.score);
      ++p.daily.runs;
      if (won) R.bump(p, 'dailies', 1);
    }
    R.bumpMax(p, 'bestChain', run.bestChain);
    check();
    NS.save.clearRun();
    NS.save.writeProfile();
    G.ui.results = { mode: run.mode, won: won, score: run.score, shards: run.shards, tally: run.tally, rank: rank, record: record,
      world: run.world, stage: run.stage, n: run.n, time: run.playTime, bestChain: run.bestChain, t: 0 };
    G.run = null;
    NS.screens.setScreen('results');
    sfx(won ? 'win' : 'lose', { volume: 0.6 });
  }

  /* leaves to the title keeping the autosave (Continue picks it up) */
  function suspend() {
    if (G.run && !G.run.demo) {
      NS.save.saveRun();
      NS.save.writeProfile();
    }
    G.run = null;
  }

  Object.assign(NS.run, {
    create, begin, demo, resume, update, check, pay, mazeCleared, gameOver, finish, suspend, stars
  });
})();
