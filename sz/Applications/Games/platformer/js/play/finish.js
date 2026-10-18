/*
 * Finishing: reaching the goal, banking a cleared level or Daily Run, chaining Endless stages and
 * ending an Endless run.
 * Writes G.save, G.results.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { INTRO_TIME } = NS.config;
  const Prog = SZ.PlatformerProgress;
  const Fx = SZ.PlatformerFx;
  const Storage = NS.module('storage');
  const Session = NS.module('session');
  const { sfx } = NS.module('sound');
  const { formatTime } = NS.module('util');
  const fxWorld = G.fxWorld;
  const fxView = G.fxView;
  const flash = G.flash;

  function reachGoal() {
    const r = G.run, p = r.player;
    if (r.clearT > 0)
      return;
    r.clearT = 1.3;
    p.vx = 0;
    Fx.checkpoint(fxWorld, r.goal.x, r.goal.y - 60, '#ffd75a');
    for (let k = 0; k < 3; ++k)
      Fx.firework(fxWorld, r.goal.x + (k - 1) * 120, r.goal.y - 40, null);
    flash.fire('#ffffff', 0.4, 2);
    sfx('win');
  }

  function finishLevel() {
    const r = G.run;
    const coins = Math.floor(r.coinsRun);
    if (r.mode === 'endless') {
      /* straight into the next stage, keeping hearts and coins */
      const carry = { seed: r.seed, stage: r.stage + 1, hearts: r.hearts, coins: r.coinsRun, gemBank: r.gemBank };
      Session.startEndless(carry);
      G.run.introT = INTRO_TIME;
      return;
    }
    const res = { mode: r.mode, name: r.level.name, world: r.world, time: r.t, coins: coins, gems: r.gemsRun.slice(), deaths: r.deaths, t: 0, target: r.level.timeTarget };
    if (r.mode === 'daily') {
      const first = !G.save.daily.cleared;
      res.prevBest = G.save.daily.bestTime;
      res.newBest = !G.save.daily.bestTime || r.t < G.save.daily.bestTime;
      if (res.newBest)
        G.save.daily.bestTime = r.t;
      G.save.daily.cleared = true;
      res.bonus = 0;
      if (first && !G.save.daily.rewarded) {
        G.save.daily.rewarded = true;
        res.bonus = 150;
        G.save.gems += 2;
        res.newGems = 2;
      }
      G.save.coins += coins + res.bonus;
      res.stars = [true, r.gemsRun.every(Boolean), r.t <= r.level.timeTarget];
      Storage.addHighScore(Math.max(0, 10000 - Math.round(r.t * 50)) + coins * 10, 'Daily', G.save.daily.date + ' ' + formatTime(r.t));
    } else {
      const id = r.spec.id;
      const prev = G.save.levels[id];
      res.prevBest = prev ? prev.bestTime : 0;
      const ghost = Prog.encodeGhost(r.ghostRec);
      const out = Prog.completeLevel(G.save, id, r.level.timeTarget, { coins: coins, gems: r.gemsRun, time: r.t, ghost: ghost });
      Object.assign(res, out);
      res.prevStars = prev ? Prog.starsOf(prev) : [false, false, false];
      if (r.world < 4 && r.spec.index === 5 && out.firstClear)
        res.unlockedWorld = r.world + 1;
    }
    G.save.stats.playTime += r.t;
    Storage.writeSave();
    G.results = res;
    Session.setScreen('results');
    G.fade = 0.6;
    G.menuCursor = 0;
    for (let k = 0; k < 4; ++k)
      setTimeout(() => { if (G.screen === 'results') Fx.firework(fxView, 260 + Math.random() * 760, 700, null); }, k * 380);
  }

  function endEndless() {
    const r = G.run;
    const coins = Math.floor(r.coinsRun);
    const score = r.stage * 1000 + coins * 10 + Math.round(r.t);
    G.save.coins += coins;
    G.save.gems += r.gemBank;
    const best = score > G.save.endless.best;
    if (best)
      G.save.endless.best = score;
    G.save.endless.bestStage = Math.max(G.save.endless.bestStage, r.stage);
    G.save.stats.playTime += r.t;
    Storage.writeSave();
    Storage.addHighScore(score, 'Endless', 'stage ' + (r.stage + 1));
    G.results = { mode: 'endless', stage: r.stage, coins: coins, gems: r.gemBank, score: score, best: best, t: 0, time: r.t };
    Session.setScreen('results');
  }

  Object.assign(NS.module('finish'), {
    reachGoal,
    finishLevel,
    endEndless
  });
})();
