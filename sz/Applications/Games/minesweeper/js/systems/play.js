/* Playing a session on screen: starting a mode or stage (with the land and guardian cinematics the
   first time), restarting from Tock's face, Continue from the saved snapshot, the player's actions
   on cells and powers, the frame update, turning engine and session events into sound, particles,
   shakes, floating words, the opening ripple and cast call-outs, autosave, and finishing - stars,
   best times and streaks, high scores, shards, XP, quests, festival tokens and achievements - into
   the results screen. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.engine;
  const P = NS.progress;
  const R = NS.run;
  const W = NS.worldData;
  const ST = NS.storyData;
  const FX = NS.fx;
  const BR = NS.boardRender;
  const { sfx, forEvent } = NS.audio;
  const { UI, POWER_BY_ID } = C;

  let lastStart = null;

  function start(mode, opts) {
    opts = opts || {};
    const p = G.profile;
    lastStart = { mode: mode, opts: Object.assign({}, opts) };
    G.run = R.build(mode, { stage: opts.stage, seed: opts.seed, diff: opts.diff, proven: opts.proven, cpu: opts.cpu, date: new Date() }, p);
    FX.clear();
    G.ui.callout = null;
    G.input.cursor = -1;
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
    } else if (mode === 'gauntlet') shots.push.apply(shots, ST.bossIntro(0, W.BOSSES[0]));
    else if (mode !== 'classic') {
      let line = NS.metaData.MODE_BY_ID[mode].desc;
      if (G.run.mutators.length) line += '  -  ' + G.run.mutators.map(id => NS.seasons.MUT_BY_ID[id].name).join(' + ');
      if (mode === 'versus') line = 'Race ' + NS.versus.CPU_BY_ID[G.run.vs.cpu].name + ' on the same field - a mine stuns you for ' + NS.versus.STUN + ' seconds';
      shots.push({ kind: 'card', title: NS.metaData.MODE_BY_ID[mode].name, sub: line, world: G.run.world, dur: 1.8 });
    }
    if (shots.length) NS.cine.play(shots, mode === 'story' ? 'stage' : 'mode');
    NS.save.saveRun(G.run);
    NS.save.saveProfile(p);
  }

  /* Tock's face: a fresh game of the same kind (a new deal outside the story) */
  function restart() {
    const run = G.run;
    if (!run) return;
    if (!run.done && run.game.state === 'play' && run.mode !== 'classic') return NS.screens.pause();
    const o = lastStart || { mode: run.mode, opts: { stage: run.stage, diff: run.diff } };
    if (!run.done && run.game.state === 'play') { R.finish(run, false, 'quit'); NS.save.clearRun(); }
    sfx('click');
    start(o.mode, Object.assign({}, o.opts, { seed: undefined }));
    G.cine = null;
  }

  function resume() {
    const saved = NS.save.loadRun();
    if (!saved) return false;
    G.run = saved;
    G.run.events = [];
    lastStart = { mode: saved.mode, opts: { stage: saved.stage, diff: saved.diff } };
    FX.clear();
    NS.screens.setScreen('paused');
    return true;
  }

  function quit() {
    const run = G.run;
    if (!run) return;
    R.bank(run);
    R.finish(run, run.mode === 'zen' || run.mode === 'rush', 'quit');
    complete();
  }

  /* a player action on cell i: 'reveal', 'flag' or 'chord' */
  function act(kind, i) {
    const run = G.run;
    if (!run || run.done || G.screen !== 'game' || G.cine || i < 0) return '';
    const r = R.act(run, kind, i, G.profile);
    flush();
    return r;
  }

  function usePower(k) {
    const run = G.run;
    if (!run || run.done || G.cine) return false;
    const ok = R.usePower(run, k, G.input.cursor >= 0 ? G.input.cursor : G.input.hoverCell);
    flush();
    if (!ok && run.powers[k]) sfx('error', { volume: 0.4 });
    return ok;
  }

  function flush() {
    const run = G.run;
    const evs = R.takeEvents(run);
    for (let i = 0; i < evs.length; ++i) present(evs[i]);
    if (run.done) complete();
  }

  function update(dt) {
    const run = G.run;
    if (!run || run.done) return;
    if (G.screen !== 'game' || G.cine) return;
    R.tick(run, dt, G.profile);
    flush();
    if (G.ui.callout && (G.ui.callout.t -= dt) <= 0) G.ui.callout = null;
  }

  function callout(who, text) {
    G.ui.callout = { who: who, text: text, t: 2.6 };
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /* the view-plane centre of cell i of the field in play */
  function cellXY(i, g) {
    g = g || G.run.game;
    const L = BR.layout(g);
    return { x: L.x0 + (i % g.w + 0.5) * L.s, y: L.y0 + (Math.floor(i / g.w) + 0.5) * L.s, s: L.s };
  }

  function effectDef() {
    return NS.metaData.EFFECTS.find(x => x.id === G.profile.cosmetics.effect) || NS.metaData.EFFECTS[0];
  }

  function present(e) {
    forEvent(e);
    const run = G.run;
    const g = run.game;
    const fx = effectDef();
    switch (e.type) {
      case 'open': {
        BR.ripple(g, e.from, e.cells);
        const c = cellXY(e.from);
        const n = e.cells.length;
        if (n >= 12) {
          FX.ring(c.x, c.y, 6, Math.min(260, 40 + n * 2), 0.6, 'rgba(255,255,255,0.7)', 3);
          for (let k = 0; k < Math.min(60, n); ++k) {
            const j = e.cells[Math.floor(Math.random() * n)], p = cellXY(j);
            FX.spawn(p.x, p.y, (Math.random() - 0.5) * 120, -60 - Math.random() * 120, 0.6, 4, fx.color, fx.kind, 200);
          }
        }
        if (n >= 40) {
          FX.text(c.x, c.y - 30, n + ' CELLS!', UI.gold, 22, 1.1);
          FX.shake(3);
          if (Math.random() < 0.4) callout(Math.random() < 0.5 ? 'wren' : 'tock', pick(ST.CALLOUTS.big));
        }
        break;
      }
      case 'flag': {
        const c = cellXY(e.i);
        if (e.f === 1) FX.burst(c.x, c.y - c.s * 0.2, 5, [BR.flagDef().color, '#ffffff'], 'spark', 90, 200, 3);
        if (e.sonar || e.lantern) FX.ring(c.x, c.y, 4, c.s * 1.2, 0.5, '#ff9a3a', 3);
        break;
      }
      case 'chord': {
        const c = cellXY(e.i);
        FX.ring(c.x, c.y, c.s * 0.4, c.s * 1.7, 0.35, 'rgba(255,255,255,0.6)', 2);
        break;
      }
      case 'boom': {
        const c = cellXY(e.i);
        FX.shake(16);
        FX.flash(0.6, '#ff3a1a');
        FX.stop(0.12);
        FX.ring(c.x, c.y, 6, 180, 0.7, '#ffb04a', 8);
        FX.burst(c.x, c.y, 70, ['#ff5a1a', '#ffd25a', '#ffffff', '#3a2a2a'], 'ember', 520, 300, 7);
        break;
      }
      case 'lose':
        if (g.mine) {
          let k = 0;
          for (let i = 0; i < g.w * g.h && k < 40; ++i) if (g.mine[i] && i !== e.i && g.flag[i] !== 1) { const c = cellXY(i); FX.burst(c.x, c.y, 4, ['#ff7a3a', '#ffd25a'], 'ember', 160, 200, 4); ++k; }
        }
        break;
      case 'shield': {
        const c = cellXY(e.i);
        FX.ring(c.x, c.y, 6, 120, 0.6, '#c8a0ff', 6);
        FX.burst(c.x, c.y, 24, ['#c8a0ff', '#ffffff'], 'spark', 260, 0, 5);
        FX.text(c.x, c.y - 30, 'DEFUSED!', '#e0d0ff', 22, 1.2);
        FX.shake(6);
        callout('tock', pick(ST.CALLOUTS.shield));
        break;
      }
      case 'gem': {
        const c = cellXY(e.i);
        FX.burst(c.x, c.y, 22, ['#ff7ad8', '#ffffff', '#ffd0f0'], 'shard', 220, 300, 5);
        FX.text(c.x, c.y - 26, '+GEM', UI.gem, 20, 1);
        if (Math.random() < 0.3) callout('wren', pick(ST.CALLOUTS.gem));
        break;
      }
      case 'chest': {
        const c = cellXY(e.i);
        FX.burst(c.x, c.y, 26, ['#ffd25a', '#ffffff', '#a0602a'], 'star', 240, 300, 5);
        break;
      }
      case 'power': {
        const pw = POWER_BY_ID[e.id];
        FX.text(150, 520, pw.name + (e.kept ? '!' : ' (pack full: +150)'), pw.color, 20, 1.4);
        sfx('powerup', { pitch: 1.2, volume: 0.6 });
        if (Math.random() < 0.4) callout('tock', pick(ST.CALLOUTS.chest));
        break;
      }
      case 'usepower': {
        const pw = POWER_BY_ID[e.id];
        FX.flash(0.3, pw.color);
        FX.text(640, 120, pw.name.toUpperCase(), pw.color, 28, 1.2);
        break;
      }
      case 'win': {
        const L = BR.layout(g);
        FX.flash(0.4, '#ffffff');
        for (let i = 0; i < 90; ++i) FX.spawn(L.x0 + Math.random() * g.w * L.s, L.y0 + g.h * L.s, (Math.random() - 0.5) * 260, -300 - Math.random() * 460, 1.8, 6, ['#ffd25a', '#ff7ad8', '#7affea', '#ffffff', fx.color][i % 5], i % 2 ? 'confetti' : fx.kind, 500);
        break;
      }
      case 'field':
        FX.text(640, 330, 'FIELD ' + e.n, UI.gold, 38, 1.4);
        if (SZ.GameMusic) SZ.GameMusic.stinger('level');
        break;
      case 'penalty': {
        const c = cellXY(e.i);
        FX.burst(c.x, c.y, 30, ['#ff5a1a', '#ffd25a'], 'ember', 300, 300, 5);
        FX.text(c.x, c.y - 30, e.seconds ? '+' + e.seconds + ' s' : '-' + e.points, UI.bad, 22, 1.2);
        FX.shake(8);
        break;
      }
      case 'stun':
        if (e.who === 'you') { FX.shake(12); FX.flash(0.4, '#ff3a1a'); const c = cellXY(e.i); FX.burst(c.x, c.y, 40, ['#ff5a1a', '#ffd25a'], 'ember', 360, 300, 6); }
        break;
      case 'rival':
        if (e.ev.type === 'win') callout('wren', 'They beat us to it!');
        break;
      case 'windup':
        callout('boss', { bury: 'Back underground with you!', frost: 'Freeze!', smoke: 'Smoke and ash!', quake: 'Shelves, shake!' }[e.kind]);
        break;
      case 'strike': {
        FX.shake(8);
        const tint = { bury: '#8a6a3a', frost: '#9ad8ff', smoke: '#7a7a8a', quake: '#5ae0d0' }[e.kind];
        FX.flash(0.3, tint);
        for (const i of e.cells || []) { const c = cellXY(i); FX.burst(c.x, c.y, 8, [tint, '#ffffff'], e.kind === 'bury' ? 'square' : 'spark', 160, 300, 4); }
        break;
      }
      case 'rage':
        FX.flash(0.5, '#ff2a2a');
        FX.shake(12);
        callout('boss', 'NOW I AM ANGRY!');
        break;
      case 'fuse':
        FX.flash(0.9, '#ffb04a');
        FX.shake(20);
        break;
      case 'nextboss': {
        const b = W.BOSSES[e.w];
        FX.text(640, 300, b.name.toUpperCase(), b.accent, 38, 2);
        FX.flash(0.5, b.color);
        break;
      }
      case 'revive':
        FX.flash(0.8, '#ffffff');
        FX.text(640, 360, 'SECOND CHANCE', UI.good, 32, 2);
        sfx('win', { pitch: 1.2 });
        break;
    }
    if (run.bossState && run.bossState.fuse < 30 && run.bossState.fuse > 29.9) callout('wren', pick(ST.CALLOUTS.fuse));
  }

  /* the session ended: settle everything and open the results */
  function complete() {
    const run = G.run;
    const p = G.profile;
    const g = run.game;
    const s = p.stats;
    R.bank(run);
    const score = run.score;
    const res = { mode: run.mode, stage: run.stage, won: run.won, reason: run.reason, score: score, opened: run.opened, fields: run.fields, time: run.t,
      gems: run.gems, chords: run.chords, diff: run.diff, cpu: run.vs ? run.vs.cpu : null, stars: [false, false, false], newStars: 0, gemsWon: 0, rank: -1, best: false, levels: 0,
      quests: [], festival: [], achievements: [], classicTime: 0 };
    s.games += 1;
    s.opened += res.opened;
    s.flags += g.stats.flags;
    s.correctFlags += run.flagsCorrect;
    s.chords += res.chords;
    s.biggest = Math.max(s.biggest, g.stats.biggest);
    s.gems += res.gems;
    s.chests += g.stats.chests;
    s.powers += run.powersUsed;
    s.shields += g.stats.shields;
    s.fields += run.fields;
    s.score += score;
    s.playSeconds += run.t;
    if (run.mode === 'story' && run.won) {
      res.stars = R.starsFor(run, p);
      const rec = P.recordStage(p, run.stage, res.stars, run.t);
      res.newStars = rec.newStars;
      res.gemsWon += rec.gems;
      ++s.stages;
      if (g.stats.flags === 0) ++s.noflagWins;
      if (W.BY_ID[run.stage].kind === 'boss') s.bosses = Math.max(s.bosses, P.bossesBeaten(p));
      P.questProgress(p, 'stage', 1).forEach(q => res.quests.push(q));
    }
    if (run.mode === 'classic' && run.reason !== 'quit') {
      const d = run.diff;
      if (d !== 'custom') {
        ++s.classicPlayed[d];
        if (run.won) {
          ++s.classicWins[d];
          ++s.classicStreak[d];
          s.classicStreakBestBy[d] = Math.max(s.classicStreakBestBy[d], s.classicStreak[d]);
          s.classicStreakBest = Math.max(s.classicStreakBest, s.classicStreak[d]);
          const t = Math.max(1, Math.ceil(g.t));
          res.classicTime = t;
          res.best = !s.bestTimes[d] || t < s.bestTimes[d];
          s.bestTimes[d] = s.bestTimes[d] ? Math.min(s.bestTimes[d], t) : t;
          res.rank = P.addScore(p.scores.classic[d], { time: t, name: 'You', day: G.today }, 'time', true);
        } else s.classicStreak[d] = 0;
      }
      if (run.won) P.questProgress(p, 'classic', 1).forEach(q => res.quests.push(q));
    }
    if (run.mode === 'daily' && run.won) {
      const prev = p.scores.daily[run.day] || 0;
      res.best = score > prev;
      p.scores.daily[run.day] = Math.max(prev, score);
      ++s.dailies;
    }
    if (run.mode === 'zen') { s.zenFields += run.fields; s.zenSeconds += run.t; res.rank = P.addScore(p.scores.zen, { score: score, fields: run.fields, day: G.today }, 'score'); }
    if (run.mode === 'rush') { res.best = run.fields > s.rushBest; s.rushBest = Math.max(s.rushBest, run.fields); res.rank = P.addScore(p.scores.rush, { score: score, fields: run.fields, day: G.today }, 'fields'); }
    if (run.mode === 'gauntlet' && run.won) ++s.gauntletWins;
    if (run.mode === 'versus' && run.won) {
      ++s.vsWins;
      s.vsBest = Math.max(s.vsBest, NS.versus.CPUS.findIndex(c => c.id === run.vs.cpu) + 1);
      P.questProgress(p, 'versus', 1).forEach(q => res.quests.push(q));
    }
    const mutShards = run.mutators.reduce((k, id) => k * NS.seasons.MUT_BY_ID[id].shards, 1);
    const pay = P.payout(p, { mode: run.mode, score: score, opened: res.opened, fields: run.fields, gems: res.gems, won: run.won, stars: res.newStars, mutatorShards: mutShards });
    p.shards += pay.shards;
    res.shards = pay.shards;
    res.xp = pay.xp;
    res.levels = P.addXp(p, pay.xp);
    const qk = [['opened', res.opened], ['fields', run.fields], ['chords', res.chords], ['gems', res.gems], ['flags', run.flagsCorrect], ['powers', run.powersUsed], ['games', 1]];
    for (const [k, v] of qk) if (v) P.questProgress(p, k, v).forEach(q => res.quests.push(q));
    P.questProgress(p, 'big', g.stats.biggest).forEach(q => res.quests.push(q));
    res.tokens = Math.floor(run.tokens + run.fields * 3);
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
      if (run.stage === 'rust-6' && !p.seen.finale) {
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

  Object.assign(NS.play, { start, restart, resume, quit, act, usePower, update, callout, cellXY, present, complete, autosave });
})();
