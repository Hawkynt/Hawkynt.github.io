/* One maze of a run: builds it for the mode, world and stage (maze, difficulty, roster, theme),
   places Pac-Man and the ghosts, runs the phase machine (ready, play, dying, clear), the
   scatter/chase rhythm and the fright timer, scores with the multiplier, and decides what being
   caught means (shield, Second Wind, Zen bump, a lost life). Owns G.run.lvl. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { WORLDS, BOSSES } = NS.worlds;
  const { GHOSTS } = NS.items;
  const M = NS.mazes;
  const R = NS.rules;
  const { sfx } = NS.audio;
  const grid = NS.grid;
  const FX = NS.fx;

  const SPECIALS = ['gobbler', 'dasher', 'phantom'];

  /* what the next maze of a run is: { world, kind, seed, features, roster, boss } */
  function plan(run) {
    const w = run.world;
    switch (run.mode) {
      case 'story': {
        const W = WORLDS[w];
        if (run.stage >= 4) return { world: w, kind: 'boss', seed: 'boss-' + w, features: [], roster: [], boss: W.boss };
        return { world: w, kind: 'maze', seed: W.levels[run.stage].seed, features: W.features, roster: W.roster };
      }
      case 'bossrush': {
        const W = WORLDS[run.n % WORLDS.length];
        return { world: run.n % WORLDS.length, kind: 'boss', seed: 'rush-' + run.n, features: [], roster: [], boss: W.boss };
      }
      case 'daily': {
        const W = WORLDS[(run.world + run.n) % WORLDS.length];
        return { world: (run.world + run.n) % WORLDS.length, kind: 'maze', seed: run.seed + run.n * 7919, features: W.features, roster: W.roster };
      }
      default: {
        const wi = Math.floor(run.n / 2) % WORLDS.length;
        const W = WORLDS[wi];
        const roster = W.roster.slice();
        if (run.mode === 'arcade' && run.n >= 6) roster.push(SPECIALS[(run.n + run.seed) % 3]);
        const features = run.mode === 'zen' ? W.features.filter(f => f !== 'vents' && f !== 'dark') : W.features;
        if (run.mode === 'arcade' && run.n > 0 && run.n % 6 === 5)
          return { world: wi, kind: 'boss', seed: run.seed + run.n * 31, features: [], roster: [], boss: WORLDS[(run.n / 6 | 0) % WORLDS.length].boss };
        return { world: wi, kind: 'maze', seed: run.n === 0 && run.mode === 'arcade' ? 'classic' : run.seed + run.n * 7919, features: features, roster: roster };
      }
    }
  }

  function makeMaze(pl) {
    if (pl.kind === 'boss') return M.generate(pl.seed, { close: 0.14, arena: true });
    if (pl.seed === 'classic') {
      const m = M.classic();
      if (pl.features.length) M.placeFeatures(m, NS.rng.makeRng(7), pl.features);
      return m;
    }
    return M.generate(pl.seed, { features: pl.features });
  }

  function makeGhost(kind, slot, release) {
    const g = GHOSTS[kind];
    const s = C.HOUSE_SLOTS[Math.min(slot, 3)];
    const out = slot === 0;
    return {
      kind: kind, slot: slot, color: g.color, x: out ? 13.5 : s.x + (slot > 3 ? (slot - 4) * 1.4 - 0.7 : 0), y: s.y, dir: 0,
      mode: out ? 'out' : 'house', release: release, scared: false, frozen: 0, stun: 0, dash: 0, dashCd: 0, belly: 0,
      bob: slot * 1.3, flash: 0, squash: 0, lastTile: -1,
    };
  }

  function build(run) {
    const pl = plan(run);
    const maze = makeMaze(pl);
    const cfg = R.levelConfig(run.mode, run.mode === 'story' ? run.world * 2 + run.stage : run.n, run.mods);
    const lvl = {
      kind: pl.kind, world: pl.world, features: pl.features.slice(), maze: maze, cfg: cfg,
      dark: cfg.dark || pl.features.indexOf('dark') >= 0,
      phase: 'ready', phaseT: 0, time: 0,
      pac: null, ghosts: [], boss: null,
      modeIdx: 0, modeT: 0, mode: 'scatter', frightT: 0, frightMax: 1, ghostCombo: 0,
      dotsLeft: maze.dotCount, dotsTotal: maze.dotCount, dotsEaten: 0,
      items: [], nextPowerT: 4, fruitIdx: 0, tokenIdx: 0,
      effects: {}, shots: [], puddles: [], decoy: null, ventT: 0, pelletRespawn: 0,
      perfect: true, gobbled: 0, deaths: 0, bossId: pl.boss || '',
    };
    if (pl.kind === 'boss') {
      lvl.dotsLeft = lvl.dotsTotal = maze.dotCount;
      lvl.nextPowerT = 6;
    }
    const roster = pl.roster.slice();
    for (let i = 0; i < cfg.extraGhosts; ++i) roster.push(SPECIALS[(run.n + i) % 3]);
    for (let i = 0; i < roster.length; ++i) lvl.ghosts.push(makeGhost(roster[i], i, cfg.release[Math.min(i, 3)] + Math.max(0, i - 3) * 3));
    lvl.pac = makePac();
    if (pl.kind === 'boss') lvl.boss = NS.boss.create(pl.boss, run);
    return lvl;
  }

  function makePac() {
    return {
      x: C.PAC_START.x, y: C.PAC_START.y, dir: 0, face: 0, want: -1, mouth: 0, moving: false,
      padT: 0, burstT: 0, grace: 0, portalLock: -1, lastTile: -1, squash: 0, trailT: 0, deathT: 0, shotT: 0, bump: 0,
    };
  }

  /* back to the start after a lost life */
  function resetActors(lvl) {
    const roster = lvl.ghosts.slice();
    lvl.pac = makePac();
    lvl.ghosts.length = 0;
    for (let i = 0; i < roster.length; ++i) {
      if (roster[i].minion) continue;
      lvl.ghosts.push(makeGhost(roster[i].kind, i, lvl.cfg.release[Math.min(i, 3)] * 0.6 + Math.max(0, i - 3) * 2));
    }
    lvl.frightT = 0;
    lvl.shots.length = 0;
    lvl.decoy = null;
    lvl.modeIdx = 0;
    lvl.modeT = 0;
    lvl.mode = 'scatter';
    if (lvl.boss) NS.boss.reset(lvl.boss);
  }

  /* Starts the run's current maze */
  function start(run) {
    run.lvl = build(run);
    const st = G.stats;
    if (!run.demo) {
      if (st.shieldStart && run.mode !== 'zen') NS.powerups.activate('shield', true);
      if (st.headStart) NS.powerups.activate(NS.pickups.rollPowerup(run, NS.rng.fx), true);
    }
    FX.clear();
    NS.mazeArt.invalidate && NS.mazeArt.invalidate();
  }

  function setPhase(lvl, phase) {
    lvl.phase = phase;
    lvl.phaseT = 0;
  }

  /* ── scoring ── */
  function multiplier(run) {
    const steps = C.MULT_STEPS;
    let m = 1;
    for (let i = 1; i < steps.length; ++i) if (run.multPts >= steps[i]) m = i + 1;
    return Math.min(m, G.stats.multCap);
  }

  function addMult(run, pts) {
    const before = multiplier(run);
    const cap = C.MULT_STEPS[Math.min(C.MULT_STEPS.length - 1, G.stats.multCap - 1)] + 40;
    run.multPts = Math.min(cap, run.multPts + pts);
    const after = multiplier(run);
    if (after > before && !run.demo) {
      run.mult = after;
      R.bumpMax(G.profile, 'bestMult', after);
      const pac = run.lvl.pac;
      FX.floater(Math.max(C.MAZE_X + 100, Math.min(C.MAZE_X + C.MAZE_W - 100, grid.px(pac.x))), grid.py(pac.y) - 30, 'x' + after + ' MULTIPLIER', '#ffd23a', 22, 1.4);
      FX.ring(grid.px(pac.x), grid.py(pac.y), 10, 90, 0.5, '#ffd23a', 4);
      sfx('levelup', { pitch: 1 + after * 0.08, volume: 0.45 });
    }
    run.mult = after;
  }

  /* base points times multiplier, Double Points and mode bonus; returns the points given */
  function addScore(run, base, x, y, color, size) {
    const lvl = run.lvl;
    let pts = base * multiplier(run) * lvl.cfg.scoreMul;
    if (lvl.effects.double > 0) pts *= 2;
    pts = Math.round(pts);
    const before = run.score;
    run.score += pts;
    if (run.mode !== 'zen' && !run.demo) {
      const every = G.stats.lifeEvery;
      if (Math.floor(run.score / every) > Math.floor(before / every)) {
        ++run.lives;
        FX.floater(grid.px(lvl.pac.x), grid.py(lvl.pac.y) - 44, 'EXTRA LIFE!', '#5aff9a', 22, 1.6);
        sfx('win', { volume: 0.5 });
      }
    }
    if (x !== undefined && size) FX.floater(x, y, String(pts), color || '#ffffff', size, 0.9);
    return pts;
  }

  /* ── being caught ── */
  function caught(run, by) {
    const lvl = run.lvl;
    const pac = lvl.pac;
    if (pac.grace > 0 || lvl.phase !== 'play') return false;
    const px = grid.px(pac.x), py = grid.py(pac.y);
    if (lvl.effects.shield > 0) {
      lvl.effects.shield = 0;
      pac.grace = 1.2;
      FX.ring(px, py, 14, 120, 0.5, '#5affc8', 6);
      FX.burst(px, py, 26, '#5affc8', 260, 0.6, 6, 0);
      FX.addShake(6);
      sfx('bounce', { pitch: 0.8 });
      if (by && by.kind) NS.ghosts.sendHome(by);
      return false;
    }
    if (run.mode === 'zen') {
      pac.grace = 2;
      pac.bump = 0.5;
      run.multPts = 0;
      run.mult = 1;
      run.chain = 0;
      FX.ring(px, py, 10, 80, 0.5, '#9af4ff', 4);
      FX.floater(px, py - 26, 'oops', '#9af4ff', 18, 1);
      sfx('bounce', { pitch: 0.6, volume: 0.4 });
      if (by && by.kind) NS.ghosts.sendHome(by);
      return false;
    }
    if (G.stats.revive && !run.reviveUsed && !run.demo) {
      run.reviveUsed = true;
      pac.grace = 2.5;
      FX.ring(px, py, 10, 220, 0.8, '#ffffff', 8);
      FX.confetti(px, py, 40);
      FX.floater(px, py - 30, 'SECOND WIND!', '#ffffff', 24, 1.6);
      FX.flash('#ffffff', 0.5);
      sfx('powerup');
      for (let i = 0; i < lvl.ghosts.length; ++i) NS.ghosts.sendHome(lvl.ghosts[i]);
      return false;
    }
    setPhase(lvl, 'dying');
    lvl.perfect = false;
    ++lvl.deaths;
    run.multPts = 0;
    run.mult = 1;
    run.chain = 0;
    FX.addShake(10);
    FX.hitStop(0.25);
    FX.flash('#ff3b3b', 0.35);
    sfx('lose', { volume: 0.7 });
    if (!run.demo) R.bump(G.profile, 'deaths', 1);
    return true;
  }

  /* ── the phase machine ── */
  function update(run, dt) {
    const lvl = run.lvl;
    lvl.phaseT += dt;
    switch (lvl.phase) {
      case 'ready':
        if (lvl.phaseT === dt) sfx('whoosh', { volume: 0.4 });
        if (lvl.phaseT > (run.demo ? 0.6 : 1.8)) setPhase(lvl, 'play');
        NS.ghosts.idle(lvl, dt);
        if (lvl.boss) NS.boss.idle(lvl, dt);
        return;
      case 'dying':
        lvl.pac.deathT += dt;
        if (lvl.phaseT > 1.9) afterDeath(run);
        return;
      case 'clear':
        if (lvl.phaseT > 2.6) NS.run.mazeCleared(run);
        return;
      case 'play':
        break;
      default:
        return;
    }
    lvl.time += dt;
    modeClock(lvl, dt);
    NS.powerups.update(run, dt);
    NS.pac.update(run, dt);
    if (lvl.phase !== 'play') return;
    NS.ghosts.update(run, dt);
    if (lvl.boss) NS.boss.update(run, dt);
    NS.hazards.update(run, dt);
    NS.pickups.update(run, dt);
    NS.ghosts.collide(run);
    if (lvl.phase !== 'play') return;
    if (lvl.kind === 'maze' && lvl.dotsLeft <= 0) clear(run);
  }

  function modeClock(lvl, dt) {
    if (lvl.frightT > 0) {
      lvl.frightT -= dt;
      if (lvl.frightT <= 0) {
        lvl.frightT = 0;
        for (let i = 0; i < lvl.ghosts.length; ++i) lvl.ghosts[i].scared = false;
      }
      return;
    }
    lvl.modeT += dt;
    const times = lvl.cfg.modeTimes;
    if (lvl.modeT >= times[lvl.modeIdx] && lvl.modeIdx < times.length - 1) {
      lvl.modeT = 0;
      ++lvl.modeIdx;
      lvl.mode = lvl.modeIdx % 2 === 0 ? 'scatter' : 'chase';
      NS.ghosts.reverseAll(lvl);
    }
  }

  function clear(run) {
    const lvl = run.lvl;
    setPhase(lvl, 'clear');
    lvl.items.length = 0;
    lvl.shots.length = 0;
    const p = lvl.pac;
    FX.confetti(grid.px(p.x), grid.py(p.y), 70, 3);
    FX.flash('#ffffff', 0.4);
    sfx('win');
  }

  function afterDeath(run) {
    const lvl = run.lvl;
    --run.lives;
    if (run.lives <= 0) {
      NS.run.gameOver(run);
      return;
    }
    resetActors(lvl);
    lvl.pac.grace = G.stats.grace;
    setPhase(lvl, 'ready');
    NS.save.saveRun();
  }

  Object.assign(NS.level, {
    plan, build, start, setPhase, multiplier, addMult, addScore, caught, update, clear, resetActors, makeGhost
  });
})();
