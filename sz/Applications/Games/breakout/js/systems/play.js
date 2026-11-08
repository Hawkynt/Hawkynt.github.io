/* Playing a session on screen: starting a mode or stage (with the fortress and guardian
   cinematics the first time), Continue from the saved snapshot, the frame update with input,
   ball trails, turning engine and session events into sound, particles, shakes, floating words
   and cast call-outs, autosave, and finishing - stars, records, high scores, shards, XP, quests,
   festival tokens and achievements - into the results screen. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.engine;
  const P = NS.progress;
  const R = NS.run;
  const W = NS.worldData;
  const ST = NS.storyData;
  const FX = NS.fx;
  const { sfx, forEvent } = NS.audio;
  const { FIELD_X, FIELD_Y, UI, BRICKS, POWER_BY_ID } = C;

  function start(mode, opts) {
    opts = opts || {};
    const p = G.profile;
    G.run = R.build(mode, { stage: opts.stage, seed: opts.seed, date: new Date() }, p);
    G.run.wallT = 0;
    FX.clear();
    G.ui.callout = null;
    NS.screens.setScreen('game');
    const shots = [];
    const st = opts.stage ? W.BY_ID[opts.stage] : null;
    if (st) {
      const w = W.WORLDS[st.world];
      if (!p.seen.worlds[w.id]) {
        p.seen.worlds[w.id] = true;
        shots.push.apply(shots, ST.worldIntro(st.world, w));
      }
      if (st.kind === 'boss') shots.push.apply(shots, ST.bossIntro(st.world, w.boss));
      else shots.push({ kind: 'card', title: st.name, sub: R.objective(G.run).text + '  -  bonus: ' + R.bonusText(st.bonus), world: st.world, dur: 2.2 });
    } else if (mode === 'rush') shots.push.apply(shots, ST.bossIntro(0, W.BOSSES[0]));
    else {
      let line = NS.metaData.MODE_BY_ID[mode].desc;
      if (G.run.mutators.length) line += '  -  ' + G.run.mutators.map(id => NS.seasons.MUT_BY_ID[id].name).join(' + ');
      shots.push({ kind: 'card', title: NS.metaData.MODE_BY_ID[mode].name, sub: line, world: G.run.world, dur: 1.8 });
    }
    shots.push({ kind: 'count', dur: 1.5 });
    NS.cine.play(shots, mode === 'story' ? 'stage' : 'mode');
    NS.save.saveRun(G.run);
    NS.save.saveProfile(p);
  }

  function resume() {
    const saved = NS.save.loadRun();
    if (!saved) return false;
    G.run = saved;
    G.run.events = [];
    FX.clear();
    NS.screens.setScreen('paused');
    return true;
  }

  function quit() {
    const run = G.run;
    if (!run) return;
    R.finish(run, run.mode === 'zen' || run.mode === 'arcade', 'quit');
    complete();
  }

  function update(dt) {
    const run = G.run;
    if (!run || run.done) return;
    if (run.wallT < 1) run.wallT = Math.min(1, run.wallT + dt * 1.2);
    if (G.screen !== 'game' || G.cine) return;
    R.tick(run, dt, NS.input.state(), G.profile);
    G.input.launch = false;
    const evs = R.takeEvents(run);
    for (let i = 0; i < evs.length; ++i) present(evs[i]);
    trails(run.game);
    if (G.ui.callout && (G.ui.callout.t -= dt) <= 0) G.ui.callout = null;
    if (run.done) complete();
  }

  function trails(g) {
    const t = NS.metaData.TRAILS.find(x => x.id === G.profile.cosmetics.trail) || NS.metaData.TRAILS[0];
    for (const b of g.balls) {
      if (b.stuck || Math.random() > 0.7) continue;
      const kind = g.fireT > 0 ? 'ember' : t.kind === 'rainbow' ? 'spark' : t.kind;
      const color = g.fireT > 0 ? '#ff8a2a' : t.kind === 'rainbow' ? 'hsl(' + (((G.time * 300) % 360) / 30 | 0) * 30 + ',90%,65%)' : t.color;
      FX.spawn(FIELD_X + b.x + (Math.random() - 0.5) * 6, FIELD_Y + b.y + (Math.random() - 0.5) * 6, -b.vx * 0.05, -b.vy * 0.05, 0.4, 4, color, kind, 0);
    }
  }

  function callout(who, text) {
    G.ui.callout = { who: who, text: text, t: 2.4 };
  }

  function at(x, y) {
    return { x: FIELD_X + x, y: FIELD_Y + y };
  }

  function present(e) {
    forEvent(e);
    const run = G.run;
    const g = run.game;
    switch (e.type) {
      case 'break': {
        const c = at(e.x, e.y);
        const col = BRICKS[e.ch].color;
        const n = e.kind === 'glass' ? 18 : 12;
        FX.burst(c.x, c.y, n, [col, K_shade(col), '#ffffff'], e.kind === 'glass' ? 'shard' : 'square', 240, 500, 4);
        if (e.combo >= 5) FX.text(c.x, c.y - 10, '+' + e.points, e.combo >= 15 ? UI.gold : '#ffffff', 14 + Math.min(10, e.combo / 3), 0.8);
        if (e.combo > 0 && e.combo % 10 === 0) {
          FX.text(FIELD_X + C.FIELD_W / 2, FIELD_Y + 380, e.combo + ' COMBO!', UI.gold, 34, 1.3);
          FX.flash(0.2, '#ffffff');
          if (Math.random() < 0.6) callout('bolt', ST.CALLOUTS.combo[Math.floor(Math.random() * 3)]);
        }
        if (e.kind === 'gold') { FX.ring(c.x, c.y, 6, 90, 0.6, UI.gold, 4); FX.shake(5); }
        break;
      }
      case 'hit': FX.burst(at(e.x, e.y).x, at(e.x, e.y).y, 6, ['#ffffff', '#c8d8ff'], 'spark', 180, 200, 3); break;
      case 'bomb': {
        const c = at(e.x, e.y);
        FX.burst(c.x, c.y, 40, ['#ff9a3a', '#ffd25a', '#ffffff', '#ff4a2a'], 'ember', 420, 200, 7);
        FX.ring(c.x, c.y, 10, 120, 0.5, '#ffb05a', 6);
        FX.shake(10);
        FX.stop(0.04);
        break;
      }
      case 'paddle': FX.burst(FIELD_X + e.x, FIELD_Y + C.PADDLE_Y, 6, ['#ffffff', NS.fieldRender.paddleDef().accent], 'spark', 160, 300, 3); break;
      case 'power': {
        const pw = POWER_BY_ID[e.id];
        FX.text(FIELD_X + g.paddle.x, FIELD_Y + C.PADDLE_Y - 40, pw.name.toUpperCase() + (pw.good ? '!' : ''), pw.color, 22, 1.2);
        FX.ring(FIELD_X + g.paddle.x, FIELD_Y + C.PADDLE_Y, 10, 120, 0.5, pw.color, 4);
        if (pw.good && Math.random() < 0.25) callout('bolt', ST.CALLOUTS.power[Math.floor(Math.random() * 3)]);
        break;
      }
      case 'lost':
        FX.burst(FIELD_X + e.x, FIELD_Y + (e.y == null ? C.FIELD_H - 4 : e.y), 20, ['#ff5a6a', '#ffffff'], 'spark', 300, 400, 5);
        break;
      case 'mate': {
        const mate = NS.metaData.MATES[e.side];
        const def = NS.metaData.PADDLES.find(x => x.id === mate.paddle) || NS.metaData.PADDLES[0];
        FX.burst(FIELD_X + e.x, FIELD_Y + e.y, 7, ['#ffffff', def.accent], 'spark', 170, 0, 3);
        if (Math.random() < 0.04) callout(mate.who, ST.CALLOUTS.team[Math.floor(Math.random() * ST.CALLOUTS.team.length)]);
        break;
      }
      case 'life':
        FX.shake(12);
        FX.flash(0.4, '#ff3a3a');
        if (e.lives === 0) callout('juno', ST.CALLOUTS.danger[0]);
        break;
      case 'barrier': FX.burst(FIELD_X + e.x, FIELD_Y + C.FIELD_H - 4, 20, ['#8a8aff', '#ffffff'], 'spark', 260, 0, 4); break;
      case 'bosshit': {
        const c = at(e.x, e.y);
        FX.text(c.x, c.y - 40, '-' + e.dmg, '#ff6a6a', 24, 0.8);
        FX.burst(c.x, c.y, 16, [NS.worldData.BOSSES[g.boss.w].accent, '#ffffff'], 'star', 260, 200, 5);
        FX.shake(6);
        break;
      }
      case 'rage':
        FX.flash(0.6, '#ff2a2a');
        FX.shake(14);
        callout('boss', 'ENOUGH! Now you face my full power!');
        break;
      case 'special': callout('boss', { hedge: 'Grow, my garden!', frost: 'Freeze!', gear: 'Faster, faster!', kraken: 'Into the dark with you!', engine: 'Fall into the void!' }[e.id]); FX.shake(6); break;
      case 'stung': FX.flash(0.3, '#ff6a6a'); FX.shake(8); break;
      case 'bossdown': {
        const c = at(e.x, e.y);
        for (let k = 0; k < 4; ++k) FX.burst(c.x + (Math.random() - 0.5) * 120, c.y + (Math.random() - 0.5) * 80, 40, ['#ffd25a', '#ffffff', '#ff7ad8', '#7affea'], 'star', 520, 200, 7);
        FX.flash(1, '#ffffff');
        FX.shake(22);
        FX.stop(0.3);
        break;
      }
      case 'nextboss': {
        const b = W.BOSSES[e.w];
        FX.text(640, 300, b.name.toUpperCase(), b.accent, 40, 2);
        FX.flash(0.5, b.color);
        sfx('levelup', { pitch: 0.7 });
        break;
      }
      case 'wall':
        run.wallT = 0;
        FX.text(640, 330, 'WALL ' + e.n, UI.gold, 40, 1.6);
        sfx('levelup');
        if (SZ.GameMusic) SZ.GameMusic.stinger('level');
        break;
      case 'cleared':
        for (let i = 0; i < 60; ++i) FX.spawn(FIELD_X + Math.random() * C.FIELD_W, FIELD_Y + C.FIELD_H, (Math.random() - 0.5) * 200, -300 - Math.random() * 400, 1.6, 6, ['#ffd25a', '#ff7ad8', '#7affea', '#ffffff'][i % 4], 'confetti', 500);
        break;
      case 'revive':
        FX.flash(0.8, '#ffffff');
        FX.text(640, 360, 'SECOND CHANCE', UI.good, 32, 2);
        sfx('win', { pitch: 1.2 });
        break;
      case 'regrow': FX.flash(0.15, '#7affb0'); break;
    }
  }

  function K_shade(c) {
    return NS.artKit.shade(c, 0.4);
  }

  function complete() {
    const run = G.run;
    const p = G.profile;
    const g = run.game;
    const s = p.stats;
    const res = { mode: run.mode, stage: run.stage, won: run.won, reason: run.reason, score: g.score, bricks: g.stats.bricks, time: run.t, wall: run.wall,
      stats: g.stats, stars: [false, false, false], newStars: 0, gems: 0, rank: -1, best: false, levels: 0, quests: [], festival: [], achievements: [] };
    s.games += 1;
    s.bricks += g.stats.bricks;
    s.best = Math.max(s.best, g.stats.best);
    s.powers += g.stats.caught;
    s.bombs += g.stats.bombs;
    s.gold += g.stats.gold;
    s.crystals += g.stats.crystals;
    s.lasers += g.stats.lasers;
    s.lost += g.stats.lost;
    s.score += g.score;
    s.playSeconds += run.t;
    s.maxBalls = Math.max(s.maxBalls, run.maxBalls);
    s.bestCatch = Math.max(s.bestCatch, run.mode === 'story' ? g.stats.caught : 0);
    const day = G.today;
    if (run.mode === 'story' && run.won) {
      res.stars = R.starsFor(run);
      const rec = P.recordStage(p, run.stage, res.stars, run.t);
      res.newStars = rec.newStars;
      res.gems += rec.gems;
      ++s.stages;
      if (!g.stats.lost) ++s.flawless;
      if (W.BY_ID[run.stage].kind === 'boss') s.bosses = Math.max(s.bosses, P.bossesBeaten(p));
      P.questProgress(p, 'stage', 1).forEach(q => res.quests.push(q));
    }
    const entry = { score: g.score, wall: run.wall, day: day };
    if (run.mode === 'arcade') { res.rank = P.addScore(p.scores.arcade, entry, 'score'); res.best = run.wall > s.arcadeBest; s.arcadeBest = Math.max(s.arcadeBest, run.wall); }
    if (run.mode === 'blitz') { res.rank = P.addScore(p.scores.blitz, entry, 'score'); res.best = g.score > s.blitzBest; s.blitzBest = Math.max(s.blitzBest, g.score); }
    if (run.mode === 'daily' && run.reason === 'time') {
      const prev = p.scores.daily[run.day] || 0;
      res.best = g.score > prev;
      p.scores.daily[run.day] = Math.max(prev, g.score);
      ++s.dailies;
    }
    if (run.mode === 'zen') { s.zenSeconds += run.t; P.questProgress(p, 'zen', Math.floor(run.t / 60)).forEach(q => res.quests.push(q)); }
    if (run.mode === 'rush' && run.won) ++s.rushWins;
    if (g.mates.length) {
      const key = run.mode === 'duo' ? 'duoBest' : 'arenaBest';
      res.best = run.wall > s[key];
      s[key] = Math.max(s[key], run.wall);
      res.mateHits = g.mates.reduce((n, m) => n + m.hits, 0);
      s.mateHits += res.mateHits;
      if (run.wall > 1) P.questProgress(p, 'team', run.wall - 1).forEach(q => res.quests.push(q));
    }
    const mutShards = run.mutators.reduce((k, id) => k * NS.seasons.MUT_BY_ID[id].shards, 1);
    const pay = P.payout(p, { mode: run.mode, score: g.score, bricks: g.stats.bricks, best: g.stats.best, won: run.won, stars: res.newStars, mutatorShards: mutShards });
    p.shards += pay.shards;
    res.shards = pay.shards;
    res.xp = pay.xp;
    res.levels = P.addXp(p, pay.xp);
    const qk = [['bricks', g.stats.bricks], ['powers', g.stats.caught], ['bombs', g.stats.bombs], ['lasers', g.stats.lasers], ['gold', g.stats.gold], ['games', 1]];
    for (const [k, v] of qk) if (v) P.questProgress(p, k, v).forEach(q => res.quests.push(q));
    P.questProgress(p, 'combo', g.stats.best).forEach(q => res.quests.push(q));
    P.questProgress(p, 'score', g.score).forEach(q => res.quests.push(q));
    res.tokens = Math.floor(run.tokens);
    if (res.tokens) res.festival = P.addTokens(p, res.tokens, new Date());
    res.achievements = P.checkAchievements(p);
    G.result = res;
    G.resultT = G.time;
    NS.save.clearRun();
    NS.save.saveProfile(p);
    NS.screens.setScreen('results');
    if (run.mode === 'story' && run.won && W.BY_ID[run.stage].kind === 'boss') {
      const w = W.BY_ID[run.stage].world;
      const shots = ST.bossWin(w, W.BOSSES[w]);
      if (run.stage === 'gloom-6' && !p.seen.finale) {
        p.seen.finale = true;
        shots.push.apply(shots, ST.SHOTS.finale);
      }
      NS.cine.play(shots, 'victory');
    }
    if (SZ.GameMusic) SZ.GameMusic.stinger(run.won ? 'win' : 'lose');
  }

  function autosave(dt) {
    G.autoSaveT += dt;
    if (G.autoSaveT < C.AUTOSAVE) return;
    G.autoSaveT = 0;
    if (G.run && !G.run.done) NS.save.saveRun(G.run);
    NS.save.saveProfile(G.profile);
  }

  Object.assign(NS.play, { start, resume, quit, update, present, callout, complete, autosave });
})();
