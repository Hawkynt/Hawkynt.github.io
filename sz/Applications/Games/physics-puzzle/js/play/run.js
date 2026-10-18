;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * A run: one level being played in one mode (campaign, trick, daily,
   * sandbox). Starts, resets and leaves runs, builds the tray inventory and
   * the Daily level, and turns a won run into results and rewards.
   * Owns G.run and G.results; reads G.stats and writes G.save.
   */

  const G = NS.G;
  const Lv = G.Lv, Prog = G.Prog, Sim = G.Sim;
  const WORLDS = NS.C.WORLDS, SANDBOX_CAP = NS.C.SANDBOX_CAP;

  function sandboxLevel(world) {
    return {
      id: 'sandbox', name: 'Sandbox', world: world, launcher: [110, 566], sandbox: true,
      items: [['ground', 0, 1280]], targets: [[1100, 520]], stars: [], inv: {}, par: 99,
      tip: 'Build anything. Every part you have unlocked is in the tray. Drag the target to move it.'
    };
  }

  function inventoryFor(level, mode) {
    if (mode === 'sandbox') {
      const inv = {};
      for (const t of G.stats.sandboxParts)
        inv[t] = SANDBOX_CAP;
      return inv;
    }
    const inv = Object.assign({}, level.inv);
    if (!(level.rule && level.rule.noParts)) {
      if (G.stats.spare.plank)
        inv.plank = (inv.plank || 0) + G.stats.spare.plank;
      if (G.stats.spare.spring)
        inv.spring = (inv.spring || 0) + G.stats.spare.spring;
    }
    return inv;
  }

  function startLevel(mode, level, opts) {
    opts = opts || {};
    const theme = WORLDS[level.world];
    const rule = level.rule || {};
    G.run = {
      mode: mode, level: level, world: level.world, theme: theme,
      inv: inventoryFor(level, mode), placed: opts.placed ? opts.placed.slice() : [],
      att: null, phase: 'intro', introT: 0, aimAngle: 35, aimPower: 0.6, aiming: null,
      selected: -1, drag: null, wonT: 0, lastPaths: [], trails: [], bulletLeft: G.stats.bulletTime,
      blueprint: 0, nearMiss: {}, recoil: 0, readyT: 0, shotsTotal: 0, starsBest: 0,
      oneShot: !!rule.oneShot, minBounces: rule.minBounces || 0
    };
    rebuildAttempt();
    NS.field.warmCaches();
    G.fxWorld.clear();
    G.texts.clear();
    G.timeScale.reset();
    G.shake.reset();
    G.layerKey = '';
    NS.flow.setScreen('play');
    G.sfx('whoosh', { volume: 0.5 });
  }

  /* a fresh world for this level with the current parts */
  function rebuildAttempt() {
    const run = G.run;
    run.att = Sim.createAttempt(run.level, run.placed, { theme: run.theme, rubber: G.stats.rubber, oneShot: run.oneShot, minBounces: run.minBounces });
    run.phase = run.phase === 'intro' ? 'intro' : 'aim';
    run.selected = -1;
  }

  function restartLevel() {
    if (!G.run)
      return;
    const placed = G.run.placed.slice();
    const mode = G.run.mode, level = G.run.level;
    startLevel(mode, level, { placed: placed });
    G.run.phase = 'aim';
    G.showToast('Fresh start - your parts stay put', '#bfeaff');
  }

  function startCampaign(id) {
    startLevel('campaign', Lv.BY_ID[id]);
  }

  function startTrick(t) {
    startLevel('trick', Lv.trickLevel(t));
  }

  let dailyCache = null;
  function dailyLevel() {
    const key = G.localDate();
    if (!dailyCache || dailyCache.key !== key)
      dailyCache = { key: key, level: Sim.buildDaily(key, Lv.LEVELS, G.SOLUTIONS, WORLDS) };
    return dailyCache.level;
  }

  function startDaily() {
    startLevel('daily', dailyLevel());
  }

  function startSandbox(world) {
    startLevel('sandbox', sandboxLevel(world || 0));
  }

  function partsLeft(type) {
    let n = G.run.inv[type] || 0;
    for (const p of G.run.placed)
      if (p.type === type)
        --n;
    return n;
  }

  /* ── results ── */

  function finishLevel() {
    const run = G.run;
    const att = run.att;
    const result = { win: true, shots: att.shots, starsTaken: att.stars.filter(s => s.got).length };
    let reward = { coins: 0, stars: [true, false, false], newStars: 0, first: false };
    if (run.mode === 'campaign') {
      reward = Prog.applyLevelResult(G.save, run.level, result, G.stats);
    } else if (run.mode === 'trick') {
      const r = Prog.applyTrickResult(G.save, run.level.trick, true, G.stats);
      reward = { coins: r.coins, first: r.first, stars: [true, true, true], newStars: 0 };
    } else if (run.mode === 'daily') {
      const r = Prog.applyDailyResult(G.save, G.localDate(), result, run.level, G.stats);
      reward = { coins: r.coins, first: r.first, stars: Prog.runStars(run.level, result), newStars: 0 };
    }
    G.writeSave();
    G.results = {
      mode: run.mode, level: run.level, shots: att.shots, par: run.level.par,
      starsTaken: result.starsTaken, starsTotal: att.stars.length,
      stars: run.mode === 'campaign' ? Prog.runStars(run.level, result) : reward.stars,
      coins: reward.coins, first: reward.first, newStars: reward.newStars, t: 0, shown: 0, coinShown: 0
    };
    G.state = 'results';
    G.menuCursor = 0;
    NS.os.updateWindowTitle();
  }

  function nextLevel() {
    if (!G.results)
      return;
    const lvl = G.results.level;
    if (G.results.mode === 'campaign') {
      const i = Lv.LEVELS.findIndex(l => l.id === lvl.id);
      const nx = Lv.LEVELS[i + 1];
      if (nx && Prog.levelUnlocked(G.save, Lv.LEVELS, nx.id)) {
        startCampaign(nx.id);
        return;
      }
      NS.flow.openMap(nx ? nx.world : lvl.world);
      if (nx && !Prog.worldUnlocked(G.save, Lv.LEVELS, nx.world))
        G.showToast('Collect ' + Prog.STAR_GATES[nx.world] + ' stars to open ' + WORLDS[nx.world].name, '#ffe9a0');
      return;
    }
    if (G.results.mode === 'trick') {
      NS.flow.openTricks();
      return;
    }
    NS.flow.setScreen('title');
  }

  function retry() {
    const l = G.results.level, m = G.results.mode;
    G.results = null;
    startLevel(m, l, { placed: G.run ? G.run.placed : [] });
  }

  function quitToMenu() {
    const mode = G.run ? G.run.mode : 'campaign';
    const world = G.run ? G.run.world : 0;
    G.run = null;
    if (mode === 'campaign')
      NS.flow.openMap(world);
    else if (mode === 'trick')
      NS.flow.openTricks();
    else
      NS.flow.setScreen('title');
  }

  G.dailyLevel = dailyLevel;

  NS.run = {
    inventoryFor: inventoryFor, startLevel: startLevel, rebuildAttempt: rebuildAttempt, restartLevel: restartLevel,
    startCampaign: startCampaign, startTrick: startTrick, dailyLevel: dailyLevel, startDaily: startDaily, startSandbox: startSandbox,
    partsLeft: partsLeft, finishLevel: finishLevel, nextLevel: nextLevel, retry: retry, quitToMenu: quitToMenu
  };
})();
