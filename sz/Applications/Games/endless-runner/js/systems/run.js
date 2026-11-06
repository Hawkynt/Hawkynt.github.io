/* A run from start to end: building it for a mode (story stage, Arcade, the weekly featured
   Arcade, Zen, the Daily Run, Boss Rush or the title demo) with its course settings, mutators
   and starting boosts; continuing a saved one; the per-frame flow (ready, play, dying, revive,
   done) with distance score, combo multiplier, milestones, ghost recording and autosave; the
   finish and the end, which settles rewards and opens the results or a cinematic. Owns the
   run's lifecycle. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const PH = NS.physics;
  const CO = NS.course;
  const PW = NS.powers;
  const rules = NS.rules;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { hashString } = NS.rng;
  const { MUTATOR_BY_ID } = NS.seasons;
  const { POWERS } = NS.items;
  const R = NS.rng.fx;

  const GHOST_CH = 35;

  function mergeMutators(ids) {
    const m = { ids: ids || [], coins: 1, score: 1, grav: 1, speed: 1, power: 1, gemRate: 0 };
    for (let i = 0; i < m.ids.length; ++i) {
      const d = MUTATOR_BY_ID[m.ids[i]];
      if (!d) continue;
      m.coins *= d.coins || 1;
      m.score *= d.score || 1;
      m.grav *= d.grav || 1;
      m.speed *= d.speed || 1;
      m.power *= d.power || 1;
      m.gemRate += d.gemRate || 0;
      if (d.dark) m.dark = true;
      if (d.glass) m.glass = true;
      if (d.pits) m.pits = true;
    }
    return m;
  }

  /* opts: { stageId, world, demo } */
  function create(mode, opts) {
    opts = opts || {};
    const st = G.stats;
    let mut = mergeMutators([]);
    const cfg = { mode: mode, x0: 0, world: 0, seed: (Date.now() ^ (R() * 4294967295)) >>> 0, diff: 0.1,
      v0: C.ARCADE_BASE, vMax: C.ARCADE_MAX, ramp: 1800, lenM: 0, powerEvery: st.powerEvery, gemRate: st.gemRate,
      token: !!G.season && !opts.demo };
    let stage = null;
    if (mode === 'story') {
      stage = NS.worlds.stageById(opts.stageId);
      cfg.world = stage.w;
      cfg.seed = hashString('runner-stage-' + stage.id);
      cfg.v0 = stage.v0; cfg.v1 = stage.v1; cfg.vMax = stage.v1 + 1; cfg.ramp = 2400; cfg.diff = stage.diff;
      if (!stage.boss) { cfg.lenM = stage.lenM; cfg.shards = 3; }
    } else if (mode === 'arcade' || mode === 'weekly' || mode === 'demo') {
      cfg.world = opts.world || 0;
      cfg.cycle = mode === 'demo' ? 0 : 1200;
      if (mode === 'weekly' && G.weekly) mut = mergeMutators([G.weekly.id]);
    } else if (mode === 'zen') {
      cfg.world = opts.world !== undefined ? opts.world : (G.season ? G.season.world : 0);
      cfg.cycle = 1500;
      cfg.diff = 0.15;
      cfg.noPower = ['revive', 'shield'];
    } else if (mode === 'daily') {
      const d = G.daily;
      cfg.world = d.world; cfg.seed = d.seed; cfg.lenM = d.lenM; cfg.v0 = 11; cfg.v1 = 15.5; cfg.diff = 0.32;
      mut = mergeMutators(d.mutators);
    } else if (mode === 'rush') {
      cfg.world = 0;
      cfg.v0 = 12; cfg.vMax = 17; cfg.ramp = 3000; cfg.diff = 0.4;
    }
    if (mut.speed !== 1) { cfg.v0 *= mut.speed; cfg.vMax *= mut.speed; if (cfg.v1) cfg.v1 *= mut.speed; }
    cfg.powerEvery *= mut.power;
    cfg.gemRate += mut.gemRate;
    if (mut.pits) cfg.pits = true;
    if (mut.glass) cfg.noPower = ['shield', 'revive'];
    if (opts.demo) { cfg.noPowers = false; cfg.firstPower = 1400; }

    const run = {
      mode: mode, demo: !!opts.demo, stageId: stage ? stage.id : '', boss: null, bs: null,
      course: CO.create(cfg), p: PH.newPlayer(0), x0: 0, world: cfg.world, worldFrom: cfg.world, worldFade: 0,
      phase: 'ready', phaseT: opts.demo ? 0 : 1.5, t: 0,
      score: 0, coins: 0, gems: 0, shards: 0, shardMask: 0, tokens: 0, nears: 0, smashes: 0, jumps: 0, slides: 0, dashes: 0,
      powersUsed: 0, hits: 0, combo: 0, comboT: 0, comboBest: 0, chain: 0, chainT: -9, sq: 0, flip: 0, trailT: 0,
      pw: {}, shieldHits: 0, revives: mut.glass ? 0 : st.revives, revived: 0, guardianUsed: 0, mut: mut, mods: {},
      projs: [], bolts: [], rain: [], sky: [], rainNext: 0, skyNext: 0, flyLane: 0,
      jumpBuf: 0, dashBuf: 0, lastX: 0, saveT: 0, milestone: 500, gRec: '', gStep: 0, ghost: '', bestX: 0, passedBest: 0,
      finished: 0, why: '', rush: null, rushIdx: 0,
    };
    run.mods = PW.mods(run, {});
    if (mode === 'story' && stage && !stage.boss) run.ghost = G.save.ghosts[stage.id] || '';
    if (mode === 'daily' && G.save.ghosts.daily && G.save.ghosts.daily.key === G.daily.key) run.ghost = G.save.ghosts.daily.data || '';
    if (mode === 'arcade' && G.save.stats.arcadeBest) run.bestX = G.save.stats.arcadeBest * C.PX_PER_M;
    return run;
  }

  /* starting boosts from the tree, then the guardian for boss stages */
  function begin(run) {
    const st = G.stats;
    NS.stream.build(run);
    CO.ensure(run.course, C.GEN_AHEAD);
    if (!run.demo) {
      if (st.startShield && !run.mut.glass && run.mode !== 'zen') PW.activate(run, 'shield', true);
      if (st.luckyStart && run.mode !== 'zen') {
        const pool = POWERS.filter(p => p.dur > 0 && p.id !== 'shield');
        PW.activate(run, pool[(R() * pool.length) | 0].id, true);
      }
      if (st.headStartM && (run.mode === 'arcade' || run.mode === 'weekly')) {
        PW.activate(run, 'rocket', true);
        run.pw.rocket = st.headStartM * C.PX_PER_M / (2 * CO.speedAt(run.course.cfg, 0));
      }
    }
    if (run.mode === 'story') {
      const stage = NS.worlds.stageById(run.stageId);
      if (stage.boss) NS.bosses.start(run, stage.boss, false);
    } else if (run.mode === 'rush') {
      run.rush = ['boar', 'wyrm', 'avalanche', 'warden', 'king'];
      NS.bosses.start(run, run.rush[0], true);
    }
    run.mods = PW.mods(run, run.mods);
  }

  function start(mode, opts) {
    NS.fx.clear();
    NS.save.clearRun();
    const run = create(mode, opts);
    G.run = run;
    begin(run);
    G.cam.x = run.p.x - C.PLAYER_SCREEN_X;
    G.cam.y = 0;
    NS.screens.setScreen('playing');
    sfx('select');
    return run;
  }

  /* a saved run comes back exactly where it was, after a short ready count */
  function resume(saved) {
    NS.fx.clear();
    const run = saved;
    G.run = run;
    if (run.feel) { G.hitstop = 0; G.slowmo = 0; }
    NS.stream.build(run);
    if (run.phase === 'play' || run.phase === 'dying' || run.phase === 'revive') {
      if (run.phase !== 'play') NS.player.revive(run);
      run.phase = 'ready';
      run.phaseT = 1.2;
    }
    run.mods = PW.mods(run, run.mods || {});
    G.cam.x = run.p.x - C.PLAYER_SCREEN_X;
    NS.screens.setScreen('playing');
    return run;
  }

  /* ── scoring ── */
  function mult(run) {
    const st = G.stats;
    return rules.comboMul(run.combo, st.comboCap) * (PW.on(run, 'multi') ? 2 : 1) * st.scoreMul * (run.mut.score || 1);
  }

  function addScore(run, base, x, y, color) {
    const pts = base * mult(run);
    run.score += pts;
    if (color && !run.demo) fx.text(x, y, '+' + Math.round(pts), color, 20, 0.8);
    return pts;
  }

  function bumpCombo(run, n) {
    const cap = G.stats.comboCap;
    const before = rules.comboTier(run.combo, cap);
    run.combo += n;
    run.comboT = G.stats.comboWindow;
    if (run.combo > run.comboBest) run.comboBest = run.combo;
    const after = rules.comboTier(run.combo, cap);
    if (after > before && !run.demo) {
      const p = run.p;
      fx.text(p.x + 40, p.y - 160, 'x' + C.COMBO_MULS[after] + ' COMBO!', '#ff6ad5', 34, 1.3);
      fx.ring(p.x, p.y - 40, 20, 200, 0.5, '#ff6ad5', 6);
      sfx('levelup', { pitch: 1 + after * 0.12, volume: 0.6 });
    }
  }

  /* ── the per-frame flow ── */
  function update(run, dt) {
    const p = run.p;
    G.active = run;
    if (run.worldFade > 0) run.worldFade = Math.max(0, run.worldFade - dt * 0.8);
    if (run.phase === 'ready') {
      run.phaseT -= dt;
      if (run.phaseT <= 0) {
        run.phase = 'play';
        if (!run.demo) sfx('select', { pitch: 1.3 });
      }
      return;
    }
    if (run.phase === 'dying') { NS.player.updateDying(run, dt); fx.update(dt); return; }
    if (run.phase === 'revive') {
      run.phaseT -= dt;
      if (run.phaseT <= 0) over(run);
      return;
    }
    if (run.phase === 'over') return;
    const sdt = dt * PW.timeScale(run);
    run.t += sdt;
    PW.update(run, sdt);
    run.mods = PW.mods(run, run.mods);
    const env = NS.stream.get(run);
    env.mods = run.mods;
    const bits = run.demo ? NS.autopilot.bits(run, env) : NS.player.input(run);
    NS.player.tick(run, sdt);
    const res = PH.step(p, bits, env, sdt);
    NS.player.events(run);
    if (res && run.phase === 'play') NS.player.hit(run, res);
    else if (res && run.phase === 'done' && res === 'fall') NS.player.rescue(run);
    if (run.phase === 'dying') return;
    NS.hazards.update(run);
    NS.pickups.update(run, sdt);
    NS.bosses.update(run, sdt);
    NS.stream.update(run);
    NS.player.trail(run, sdt);
    if (run.flip > 0) run.flip = Math.max(0, run.flip - sdt * 2.6);

    /* distance score and the combo clock */
    const dm = (p.x - run.lastX) / C.PX_PER_M;
    run.lastX = p.x;
    if (dm > 0 && run.phase === 'play') run.score += dm * mult(run);
    if (run.combo > 0) {
      run.comboT -= sdt;
      if (run.comboT <= 0) run.combo = 0;
    }
    if (!run.demo) {
      milestones(run);
      record(run);
      run.saveT += dt;
      if (run.saveT >= C.AUTOSAVE_EVERY) { run.saveT = 0; NS.save.writeRun(); }
    }
    if (run.phase === 'done') {
      run.phaseT -= dt;
      if (Math.random() < 0.3) fx.burst(p.x + 200 + R() * 600, C.GROUND_Y - 300 - R() * 200, 12, ['#ffd24a', '#ff6ad5', '#5ee0ff', '#7cff9a'], 300, 0.8, 10, fx.SQUARE, 300);
      if (run.phaseT <= 0) end(run);
    }
  }

  function milestones(run) {
    const p = run.p;
    const m = rules.metres(p.x, run.x0);
    if (m >= run.milestone) {
      fx.text(p.x + 200, C.GROUND_Y - 260, run.milestone + ' m', '#ffffff', 40, 1.4);
      fx.burst(p.x + 200, C.GROUND_Y - 260, 24, ['#ffd24a', '#ffffff'], 380, 0.8, 12, fx.STAR);
      sfx('levelup', { volume: 0.4 });
      run.milestone += 500;
    }
    if (run.bestX && !run.passedBest && p.x >= run.bestX) {
      run.passedBest = 1;
      fx.text(p.x + 160, C.GROUND_Y - 320, 'NEW BEST!', '#ffd24a', 44, 1.8);
      fx.flash('#ffd24a', 0.25);
      sfx('win', { volume: 0.6 });
    }
  }

  /* the ghost: three characters every four steps (x / 16 in two, y in one) */
  function record(run) {
    if (++run.gStep % 4 !== 0 || run.gRec.length > 24000) return;
    const p = run.p;
    const gx = Math.max(0, Math.min(8463, Math.round((p.x - run.x0) / 16)));
    const gy = Math.max(0, Math.min(91, Math.round((p.y + 200) / 12)));
    run.gRec += String.fromCharCode(GHOST_CH + ((gx / 92) | 0), GHOST_CH + gx % 92, GHOST_CH + gy);
  }

  /* where the ghost was after the same running time */
  function ghostAt(run) {
    const g = run.ghost;
    if (!g) return null;
    const i = Math.floor(run.gStep / 4) * 3;
    if (i + 2 >= g.length) return null;
    const gx = (g.charCodeAt(i) - GHOST_CH) * 92 + (g.charCodeAt(i + 1) - GHOST_CH);
    const gy = g.charCodeAt(i + 2) - GHOST_CH;
    return { x: run.x0 + gx * 16, y: gy * 12 - 200 };
  }

  function finish(run) {
    if (run.finished) return;
    run.finished = 1;
    run.phase = 'done';
    run.phaseT = 2.2;
    const p = run.p;
    p.invT = 99;
    fx.flash('#ffffff', 0.4);
    fx.burst(p.x, p.y - 60, 60, ['#ffd24a', '#ff6ad5', '#5ee0ff', '#7cff9a', '#ffffff'], 700, 1.2, 14, fx.SQUARE, 500);
    sfx('win');
    NS.save.clearRun();
  }

  function over(run) {
    run.phase = 'over';
    end(run);
  }

  /* settle, then results - or a cinematic first when a guardian fell in the story */
  function end(run) {
    if (run.ended) return;
    run.ended = 1;
    run.phase = 'over';
    NS.save.clearRun();
    const sum = NS.progress.settle(run);
    G.lastSum = sum;
    const stage = run.stageId ? NS.worlds.stageById(run.stageId) : null;
    if (run.mode === 'story' && stage && stage.boss && run.finished) {
      NS.cine.play('win_' + stage.boss, () => NS.screens.setScreen('results'));
      return;
    }
    NS.screens.setScreen('results');
    sfx(run.finished ? 'levelup' : 'lose', { volume: 0.7 });
  }

  /* leaving mid-run for the title: the snapshot stays for Continue */
  function abandon() {
    const run = G.run;
    if (!run || run.demo) return;
    if (run.phase !== 'over' && !run.ended) {
      run.why = 'quit';
      over(run);
    }
  }

  Object.assign(NS.run, {
    mergeMutators, create, begin, start, resume, mult, addScore, bumpCombo, update, ghostAt, finish, over, end, abandon
  });
})();
