/* Runs and levels: starting a run in any mode (story, arcade, zen, daily, boss rush), setting up a
   level or wave (rocks from the edges, the titan, hazards, seasonal rocks, an opening gift), then
   each step: raider schedules, reinforcement waves, escape pods, Zen's gentle refills, objective
   tracking and the hand-off to progress when a level or wave is done; asks the rock art to pre-paint
   the level's rock types. Owns G.run and G.level. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { FIELD_W, FIELD_H, TAU } = NS.constants;
  const { CHAPTERS } = NS.campaign;
  const { BOSS_ORDER, BOSSES } = NS.enemyData;
  const { wrap, wrapD } = NS.rng;
  const rules = NS.rules;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { compact } = NS.grid;

  function rng() {
    return NS.sim.rng();
  }

  function clearWorld() {
    G.rocks.length = 0;
    G.bullets.length = 0;
    G.eBullets.length = 0;
    G.enemies.length = 0;
    G.pickups.length = 0;
    G.motes.length = 0;
    G.pods.length = 0;
    G.zones.length = 0;
    G.mines.length = 0;
    G.holes.length = 0;
    G.strikes.length = 0;
    G.drones.length = 0;
    G.beams.length = 0;
    G.arcs.length = 0;
    G.boss = null;
    G.banner = null;
    NS.fx.clear();
  }

  /* opts: chapter, level (story); seed (daily) */
  function startRun(mode, opts) {
    opts = opts || {};
    const st = G.stats;
    const daily = mode === 'daily' ? G.cal.daily : null;
    const seed = daily ? daily.seed : (Date.now() ^ 0x2545f491) >>> 0;
    NS.sim.seed(seed);
    G.run = {
      mode: mode, chapter: opts.chapter || 0, level: opts.level || 0, wave: 0, lives: mode === 'daily' ? 1 : st.lives,
      lost: 0, time: 0, timeLeft: 0, progress: 0, target: 0, cleared: false, clearT: 0, speed: 1,
      mods: daily ? daily.mods.slice() : [], foesT: 0, waveIdx: 0, rushIdx: 0, podsSpawned: 0, podT: 0, hazT: 3,
      zenT: 0, dayKey: G.cal.day, levelDust: 0, runDust: 0, kills: 0, refillT: 0, results: null,
    };
    G.score = 0;
    G.combo = 0;
    G.comboT = 0;
    G.bestCombo = 0;
    G.overdrive = 0;
    NS.progress.runStart();
    startLevel();
  }

  function levelSpec() {
    const run = G.run;
    switch (run.mode) {
      case 'story': return CHAPTERS[run.chapter].levels[run.level];
      case 'zen': return { name: 'Zen', obj: 'zen', rocks: [['normal', 3, 3], ['crystal', 3, 1], ['gold', 2, 1]], waves: [], foes: null, hazard: null, par: 0 };
      case 'rush': {
        const id = BOSS_ORDER[run.rushIdx];
        return { name: BOSSES[id].name, obj: 'boss', boss: id, rocks: [], waves: [], foes: null, hazard: null, par: 0 };
      }
    }
    /* arcade and daily: endless generated waves */
    const w = rules.arcadeWave(run.wave + 1, rng, run.mods);
    return { name: 'Wave ' + (run.wave + 1), obj: 'wave', rocks: w.rocks, waves: [], foes: w.foes, boss: w.boss, hazard: null, par: 0, speed: w.speed };
  }

  /* sets up the current level (story level, arcade wave, zen field or rush titan) */
  function startLevel(keepWorld) {
    const run = G.run;
    if (run.mode === 'arcade' || run.mode === 'daily') ++run.wave;
    const L = G.level = levelSpec();
    if (!keepWorld) clearWorld();
    /* make sure every rock this level can show is painted ahead of time */
    const groups = L.rocks.concat(...(L.waves || []));
    for (let i = 0; i < groups.length; ++i) NS.rockArt.want(groups[i][0]);
    run.cleared = false;
    run.clearT = 0;
    run.time = 0;
    run.lost = 0;
    run.progress = 0;
    run.target = L.target || 0;
    run.timeLeft = L.time || 0;
    run.waveIdx = 0;
    run.podsSpawned = 0;
    run.podT = 2;
    run.foesT = L.foes ? L.foes.first : 0;
    run.hazT = 3;
    run.levelDust = 0;
    run.speed = run.mode === 'story' ? 1 + run.chapter * 0.07 : run.mode === 'zen' ? 0.7 : L.speed || 1;
    if (!keepWorld || !G.ship) NS.ship.create(FIELD_W / 2, FIELD_H / 2);
    else {
      G.ship.lastStand = G.stats.lastStand > 0;
      if (G.stats.startShield) G.ship.shield = true;
      G.ship.invuln = Math.max(G.ship.invuln, 1.5);
    }
    spawnGroup(L.rocks);
    if (G.cal && run.mode !== 'rush' && rng() < 0.65) NS.rocks.spawnEdge(G.cal.seasonDef.token, 3, run.speed);
    if (L.boss) {
      const scale = run.mode === 'story' ? 1 : run.mode === 'rush' ? 1 + run.rushIdx * 0.15 : 0.8 + run.wave * 0.03;
      NS.bosses.spawn(L.boss, scale);
      fx.banner(BOSSES[L.boss].name.toUpperCase(), BOSSES[L.boss].title, BOSSES[L.boss].pal[3], 2.8);
    } else if (run.mode === 'story') {
      const ch = CHAPTERS[run.chapter];
      fx.banner(L.name.toUpperCase(), ch.sub + ' - ' + objectiveText(), ch.theme.accent, 2.6);
    } else if (run.mode === 'arcade' || run.mode === 'daily')
      fx.banner('WAVE ' + run.wave, run.wave % 5 === 0 ? 'A colossus approaches' : '', '#ffd25a', 1.8);
    else if (run.mode === 'zen')
      fx.banner('ZEN', 'No clock. No death. Just the belt.', '#6dff9a', 3);
    if (L.hazard === 'holes') {
      NS.hazards.hole(FIELD_W * 0.25, FIELD_H * 0.3, false);
      NS.hazards.hole(FIELD_W * 0.75, FIELD_H * 0.7, false);
    }
    if (G.stats.startPower && run.mode !== 'zen' && (run.mode === 'story' || run.mode === 'rush' || run.wave === 1)) {
      const k = NS.powerups.pick();
      if (k !== 'nova' && k !== 'gravity' && k !== 'life') NS.powerups.apply(k);
    }
    if (L.tip && NS.screens.toast) NS.screens.toast(L.tip, '#5ad8ff');
    sfx('whoosh', { volume: 0.5 });
  }

  function spawnGroup(group) {
    if (!group) return;
    for (let i = 0; i < group.length; ++i)
      for (let n = 0; n < group[i][2]; ++n) NS.rocks.spawnEdge(group[i][0], group[i][1], G.run.speed);
  }

  function objectiveText() {
    const L = G.level, run = G.run;
    if (!L) return '';
    switch (L.obj) {
      case 'clear': return 'Clear the field';
      case 'survive': return 'Survive ' + Math.ceil(run.timeLeft) + ' s';
      case 'collect': return 'Gather ' + run.target + ' star shards';
      case 'rescue': return 'Rescue ' + run.target + ' escape pods';
      case 'boss': return 'Destroy the titan';
      case 'wave': return 'Clear the wave';
      case 'zen': return 'Drift';
    }
    return '';
  }

  function update(dt) {
    const run = G.run, L = G.level;
    if (!run || !L) return;
    run.time += dt;
    if (run.mode === 'zen') {
      run.zenT += dt;
      NS.progress.zenTick(dt);
      /* a slow, quiet pad under the drifting: a low fifth every few seconds */
      run.padT = (run.padT || 0) - dt;
      if (run.padT <= 0) {
        run.padT = 4.2;
        const root = [0.5, 0.56, 0.63, 0.75][Math.floor(run.zenT / 16) % 4];
        if (SZ.GameAudio) {
          SZ.GameAudio.play('blip', { pitch: root, volume: 0.07 });
          if (SZ.GameAudio.tone) SZ.GameAudio.tone(220 * root * 1.5, 1.6, 'sine', 0.025, 0.05);
        }
      }
    }
    if (run.cleared) {
      run.clearT -= dt;
      if (run.clearT <= 0) NS.progress.levelDone();
      return;
    }
    /* raiders */
    if (L.foes && !(L.obj === 'clear' && rockCount() === 0 && run.waveIdx >= L.waves.length)) {
      run.foesT -= dt;
      if (run.foesT <= 0) {
        run.foesT = L.foes.every * (0.8 + rng() * 0.4);
        if (NS.enemies.countKinds() < L.foes.max) NS.enemies.spawn(L.foes.kinds[Math.floor(rng() * L.foes.kinds.length)]);
      }
    }
    pods(dt);
    const rocks = rockCount();
    switch (L.obj) {
      case 'clear':
      case 'wave':
        if (rocks <= 2 && run.waveIdx < L.waves.length) spawnGroup(L.waves[run.waveIdx++]);
        if (rocks === 0 && run.waveIdx >= L.waves.length && !G.boss && liveEnemies() === 0) finish();
        break;
      case 'survive':
        run.timeLeft -= dt;
        refill(rocks, 4);
        if (run.timeLeft <= 0) { run.timeLeft = 0; finish(); }
        break;
      case 'collect':
      case 'rescue':
        refill(rocks, 3);
        if (run.progress >= run.target) finish();
        break;
      case 'boss':
        if (L.rocks.length) refill(rocks, 2);
        break;
      case 'zen':
        run.refillT -= dt;
        if (rocks < 6 && run.refillT <= 0) {
          run.refillT = 1.6;
          const types = ['normal', 'normal', 'crystal', 'ice', 'gold', G.cal.seasonDef.token];
          NS.rocks.spawnEdge(types[Math.floor(rng() * types.length)], rng() < 0.7 ? 3 : 2, run.speed);
        }
        break;
    }
  }

  /* keeps a minimum of rocks on the field: queued waves first, then the level's own mix */
  function refill(rocks, min) {
    const run = G.run, L = G.level;
    if (rocks >= min) return;
    run.refillT = (run.refillT || 0) - NS.constants.STEP;
    if (run.refillT > 0) return;
    run.refillT = 1.2;
    if (run.waveIdx < L.waves.length) spawnGroup(L.waves[run.waveIdx++]);
    else if (L.rocks.length) {
      const g = L.rocks[Math.floor(rng() * L.rocks.length)];
      NS.rocks.spawnEdge(g[0], g[1], run.speed);
    } else NS.rocks.spawnEdge('normal', 3, run.speed);
  }

  function rockCount() {
    return NS.rocks.count();
  }

  function liveEnemies() {
    let n = 0;
    for (let i = 0; i < G.enemies.length; ++i) if (G.enemies[i].alive) ++n;
    return n;
  }

  /* escape pods drift in for rescue levels; fly into one to pick it up */
  function pods(dt) {
    const run = G.run, L = G.level;
    if (L.obj === 'rescue') {
      run.podT -= dt;
      if (run.podT <= 0 && G.pods.length < 2 && run.podsSpawned < run.target + 2) {
        run.podT = 5;
        ++run.podsSpawned;
        const a = rng() * TAU;
        G.pods.push({ alive: true, x: rng() * FIELD_W, y: rng() < 0.5 ? 1 : FIELD_H - 1, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, t: 0, a: rng() * TAU });
        sfx('blip', { pitch: 1.6, volume: 0.4 });
      }
      /* pods never run out: a lost cause respawns */
      if (run.podsSpawned >= run.target + 2 && G.pods.length === 0 && run.progress < run.target) run.podsSpawned = run.progress;
    }
    const s = G.ship;
    for (let i = 0; i < G.pods.length; ++i) {
      const p = G.pods[i];
      p.t += dt;
      p.a += dt * 0.6;
      p.x = wrap(p.x + p.vx * dt, FIELD_W);
      p.y = wrap(p.y + p.vy * dt, FIELD_H);
      if (s && !s.dead && s.hyperT <= 0) {
        const dx = wrapD(p.x - s.x, FIELD_W), dy = wrapD(p.y - s.y, FIELD_H);
        if (dx * dx + dy * dy < 34 * 34) {
          p.alive = false;
          NS.progress.objective(1);
          NS.progress.count('pods', 1);
          fx.text(p.x, p.y - 20, 'RESCUED', '#6dff9a', 16);
          fx.ring(p.x, p.y, 10, 60, 0.4, '#6dff9a', 5);
          sfx('pickup', { pitch: 0.9 });
        }
      }
    }
    compact(G.pods);
  }

  function finish() {
    const run = G.run;
    if (run.cleared) return;
    run.cleared = true;
    run.clearT = run.mode === 'arcade' || run.mode === 'daily' ? 1.4 : 2.4;
    G.eBullets.length = 0;
    if (run.mode === 'story' || run.mode === 'rush') {
      fx.banner(run.mode === 'story' ? 'LEVEL CLEAR' : 'TITAN DOWN', '', '#6dff9a', 2);
      sfx('win', { volume: 0.7 });
      fx.slowMo(0.8, 0.4);
    } else
      sfx('levelup', { volume: 0.6 });
  }

  Object.assign(NS.waves, {
    clearWorld, startRun, startLevel, update, objectiveText, finish, spawnGroup, rockCount
  });
})();
