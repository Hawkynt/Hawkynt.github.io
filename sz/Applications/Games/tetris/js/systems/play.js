/* Playing a session on screen: starting a mode or stage (with the realm and guardian cinematics
   the first time), Continue from the saved snapshot, the frame update with input, turning engine
   and session events into sound, particles, shakes, floating words and cast call-outs, autosave,
   and finishing - stars, records, high scores, shards, XP, quests, festival tokens and
   achievements - into the results screen. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.engine;
  const P = NS.progress;
  const R = NS.run;
  const W = NS.worldData;
  const ST = NS.storyData;
  const FX = NS.fx;
  const { sfx, forEvent } = NS.audio;
  const { COLS, CELL, BOARD_X, BOARD_Y, HIDDEN, COLORS, TYPES, UI } = C;

  function cellXY(x, y) {
    return { x: BOARD_X + x * CELL + CELL / 2, y: BOARD_Y + (y - HIDDEN) * CELL + CELL / 2 };
  }

  /* start: mode id and options ({ stage }) */
  function start(mode, opts) {
    opts = opts || {};
    const p = G.profile;
    G.run = R.build(mode, { stage: opts.stage, seed: opts.seed, date: new Date() }, p);
    G.run.started = Date.now();
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
      else shots.push({ kind: 'card', title: st.name, sub: R.objective(G.run).text + (st.bonus ? '  -  bonus: ' + R.bonusText(st.bonus) : ''), world: st.world, dur: 2.2 });
    } else if (mode === 'rush') shots.push.apply(shots, ST.bossIntro(0, W.BOSSES[0]));
    else shots.push({ kind: 'card', title: NS.metaData.MODE_BY_ID[mode].name, sub: modeLine(G.run), world: G.run.world, dur: 1.8 });
    shots.push({ kind: 'count', dur: 1.5 });
    NS.cine.play(shots, mode === 'story' ? 'stage' : 'mode');
    NS.save.saveRun(G.run);
    NS.save.saveProfile(p);
  }

  function modeLine(run) {
    const m = NS.metaData.MODE_BY_ID[run.mode];
    let line = m.desc;
    if (run.mutators.length) line += '  -  ' + run.mutators.map(id => NS.seasons.MUT_BY_ID[id].name).join(' + ');
    return line;
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
    if (run.mode === 'zen' || run.mode === 'marathon' || run.mode === 'master') R.finish(run, run.mode !== 'zen' ? false : true, 'quit');
    else R.finish(run, false, 'quit');
    complete();
  }

  /* one frame of play */
  function update(dt) {
    const run = G.run;
    if (!run || run.done) return;
    if (G.screen !== 'game' || G.cine) return;
    NS.input.repeat(dt);
    R.tick(run, dt, { soft: NS.input.softHeld() }, G.profile);
    const evs = R.takeEvents(run);
    for (let i = 0; i < evs.length; ++i) present(evs[i]);
    const h = E.stackHeight(run.game);
    if (h >= 15 && !run.warned) {
      run.warned = true;
      callout('kip', ST.CALLOUTS.danger[0]);
    } else if (h < 10) run.warned = false;
    if (G.ui.callout) {
      G.ui.callout.t -= dt;
      if (G.ui.callout.t <= 0) G.ui.callout = null;
    }
    if (run.done) complete();
  }

  function callout(who, text) {
    G.ui.callout = { who: who, text: text, t: 2.6 };
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /* sound and juice for one event */
  function present(e) {
    forEvent(e);
    const run = G.run;
    const g = run.game;
    const p = G.profile;
    const effect = NS.metaData.EFFECTS.find(x => x.id === p.cosmetics.effect) || NS.metaData.EFFECTS[0];
    switch (e.type) {
      case 'harddrop': {
        const c = cellXY(e.x + 1.5, e.y + 2);
        FX.shake(Math.min(8, 2 + e.rows * 0.35));
        for (let i = 0; i < 10; ++i) FX.spawn(c.x + (Math.random() - 0.5) * 80, c.y + 20, (Math.random() - 0.5) * 160, -60 - Math.random() * 120, 0.5, 4, COLORS[e.t], 'square', 500);
        break;
      }
      case 'lock':
        for (const cc of e.cells) if (cc[1] >= HIDDEN) {
          const c = cellXY(cc[0], cc[1]);
          FX.spawn(c.x, c.y, (Math.random() - 0.5) * 60, -30 - Math.random() * 40, 0.4, 3, '#ffffff', 'spark', 100);
        }
        if (e.tspin) FX.ring(cellXY(e.cells[0][0], e.cells[0][1]).x, cellXY(e.cells[0][0], e.cells[0][1]).y, 6, 80, 0.5, '#d080ff', 4);
        break;
      case 'clear': clearFx(e, effect); break;
      case 'levelup':
        FX.text(BOARD_X + 150, BOARD_Y + 260, 'LEVEL ' + e.level, UI.gold, 34, 1.6);
        FX.flash(0.25, '#ffffff');
        if (SZ.GameMusic) SZ.GameMusic.stinger('level');
        break;
      case 'garbage':
        FX.shake(10);
        FX.flash(0.25, '#ff3a3a');
        break;
      case 'attack':
        if (Math.random() < 0.5) callout('boss', 'Incoming!');
        break;
      case 'special': specialFx(e); break;
      case 'blocked':
        FX.text(BOARD_X + 150, BOARD_Y + 520, 'BLOCKED!', '#c8a0ff', 30, 1.4);
        FX.ring(BOARD_X + 150, BOARD_Y + 560, 10, 220, 0.7, '#c8a0ff', 6);
        sfx('select', { pitch: 1.4 });
        break;
      case 'rage':
        FX.flash(0.6, '#ff2a2a');
        FX.shake(14);
        callout('boss', 'ENOUGH! Now you see my true strength!');
        sfx('explode', { pitch: 0.5 });
        break;
      case 'nextboss': {
        const b = W.BOSSES[e.w];
        FX.text(640, 300, b.name.toUpperCase(), b.accent, 40, 2);
        FX.flash(0.5, b.color);
        sfx('levelup', { pitch: 0.7 });
        break;
      }
      case 'power': {
        const pw = NS.metaData.POWER_BY_ID[e.id];
        FX.text(BOARD_X - 100, BOARD_Y + 280, pw.name + '!', pw.color, 22, 1.4);
        sfx('powerup', { pitch: 1.3, volume: 0.6 });
        break;
      }
      case 'usepower': usePowerFx(e); break;
      case 'revive':
        FX.flash(0.8, '#ffffff');
        FX.text(BOARD_X + 150, BOARD_Y + 300, 'SECOND CHANCE', UI.good, 32, 2);
        sfx('win', { pitch: 1.2 });
        break;
      case 'zen':
        FX.flash(0.3, '#c8f0ff');
        break;
      case 'mirror':
        FX.flash(0.4, '#c08aff');
        break;
      case 'crystals':
        for (const x of e.cols) FX.burst(cellXY(x, HIDDEN + 1).x, BOARD_Y + 20, 8, ['#bfe8ff', '#ffffff'], 'shard', 200, 400, 4);
        break;
      case 'topout':
        FX.shake(16);
        FX.flash(0.6, '#ff2a2a');
        break;
    }
    if (e.type === 'clear' && e.lines && run.bossState && e.hit) {
      FX.text(1100, 250, '-' + e.hit.damage, '#ff6a6a', 30, 1.2);
      if (e.hit.cancelled) FX.text(BOARD_X + 150, BOARD_Y + 560, 'CANCEL ' + e.hit.cancelled, '#9affea', 22, 1.2);
    }
  }

  function clearFx(e, effect) {
    if (!e.lines) {
      if (e.tspin) FX.text(BOARD_X + 150, BOARD_Y + 200, e.tspin === 'mini' ? 'T-SPIN MINI' : 'T-SPIN', '#d080ff', 26, 1.2);
      return;
    }
    const g = G.run.game;
    const big = e.lines === 4 || e.tspin === 'full' || e.perfect;
    for (const y of e.rows) {
      if (y < HIDDEN) continue;
      for (let x = 0; x < COLS; ++x) {
        const c = cellXY(x, y);
        const code = g.board[y * COLS + x];
        const col = code >= 1 && code <= 7 ? COLORS[TYPES[code - 1]] : '#c0c8d8';
        FX.spawn(c.x, c.y, (Math.random() - 0.5) * (big ? 520 : 300), -100 - Math.random() * (big ? 360 : 200), 0.7 + Math.random() * 0.5, 5, col, effect.kind, 700);
        if (Math.random() < 0.35) FX.spawn(c.x, c.y, (Math.random() - 0.5) * 200, -Math.random() * 150, 0.5, 4, '#ffffff', 'spark', 100);
      }
      FX.ring(BOARD_X + 150, cellXY(0, y).y, 20, 220, 0.5, 'rgba(255,255,255,0.8)', 3);
    }
    const midY = cellXY(0, e.rows[Math.floor(e.rows.length / 2)]).y;
    const words = [];
    if (e.tspin === 'full') words.push('T-SPIN ' + ['', 'SINGLE', 'DOUBLE', 'TRIPLE'][e.lines]);
    else if (e.tspin === 'mini') words.push('T-SPIN MINI');
    else if (e.lines === 4) words.push('QUAD!');
    if (e.b2b) words.push('BACK-TO-BACK');
    if (e.combo >= 1) words.push(e.combo + ' COMBO');
    if (e.perfect) words.push('PERFECT CLEAR!');
    for (let i = 0; i < words.length; ++i)
      FX.text(BOARD_X + 150, midY - 30 - i * 30, words[i], e.perfect ? '#ffffff' : e.tspin ? '#d080ff' : e.lines === 4 ? '#3ad8f0' : UI.gold, i ? 20 : 28, 1.3);
    if (e.points) FX.text(BOARD_X + 150, midY + 10, '+' + e.points.toLocaleString('en-US'), '#ffffff', 18, 1);
    if (big) {
      FX.shake(e.perfect ? 18 : 10);
      FX.flash(e.perfect ? 0.8 : 0.35, e.tspin ? '#d080ff' : '#bff4ff');
      FX.stop(e.perfect ? 0.25 : 0.08);
      const list = e.perfect ? ST.CALLOUTS.perfect : e.tspin ? ST.CALLOUTS.tspin : ST.CALLOUTS.quad;
      if (Math.random() < 0.6 || e.perfect) callout(e.tspin ? 'ollo' : 'kip', pick(list));
    } else FX.shake(2 + e.lines);
    if (e.perfect) for (let i = 0; i < 80; ++i) FX.spawn(BOARD_X + Math.random() * 300, BOARD_Y + 600, (Math.random() - 0.5) * 200, -300 - Math.random() * 500, 1.6, 6, ['#ffd25a', '#ff7ad8', '#7affea', '#ffffff'][i % 4], 'confetti', 500);
  }

  function specialFx(e) {
    const lines = { vines: 'Roots seize your hold!', crystals: 'Crystals rain down!', tide: 'The tide clouds your sight!', heat: 'The forge heats up!', mirror: 'The world flips!' };
    callout('boss', lines[e.kind]);
    FX.shake(8);
    if (e.kind === 'heat') FX.flash(0.4, '#ff7a2a');
    else if (e.kind === 'tide') FX.flash(0.3, '#2ab0c0');
    else if (e.kind === 'vines') FX.burst(BOARD_X - 100, BOARD_Y + 70, 20, ['#4a9a3a', '#c8f070'], 'leaf', 200, 200, 6);
  }

  function usePowerFx(e) {
    const pw = NS.metaData.POWER_BY_ID[e.id];
    FX.flash(0.4, pw.color);
    FX.ring(BOARD_X + 150, BOARD_Y + 300, 20, 400, 0.7, pw.color, 8);
    FX.text(BOARD_X + 150, BOARD_Y + 240, pw.name.toUpperCase(), pw.color, 30, 1.4);
    sfx('powerup');
    if (e.id === 'quake') FX.shake(16);
    if (e.id === 'bomb') { FX.shake(14); FX.burst(BOARD_X + 150, BOARD_Y + 200, 60, ['#ff9a3a', '#ffd25a', '#ffffff'], 'ember', 500, 300, 8); }
    if (e.id === 'laser') FX.burst(BOARD_X + 150, BOARD_Y + 300, 40, ['#ff5a7a', '#ffffff'], 'spark', 500, 0, 6);
  }

  /* the session ended: settle everything and open the results */
  function complete() {
    const run = G.run;
    const p = G.profile;
    const g = run.game;
    const res = { mode: run.mode, stage: run.stage, won: run.won, reason: run.reason, score: g.score, lines: g.lines, time: run.t, level: g.level,
      stats: g.stats, stars: [false, false, false], newStars: 0, gems: 0, rank: -1, best: false, levels: 0, quests: [], festival: [], achievements: [], first: false };
    const s = p.stats;
    s.games += 1;
    s.lines += g.lines;
    s.quads += g.stats.quads;
    s.tspins += g.stats.tspins;
    s.perfects += g.stats.perfects;
    s.pieces += g.pieces;
    s.powers += run.powersUsed;
    s.score += g.score;
    s.maxCombo = Math.max(s.maxCombo, g.stats.maxCombo);
    s.bestB2B = Math.max(s.bestB2B, run.bestB2B);
    s.noHoldLines = Math.max(s.noHoldLines, run.noHoldLines);
    if (run.tst) s.tst += run.tst;
    s.playSeconds += run.t;
    const day = G.today;
    if (run.mode === 'story' && run.stage) {
      res.stars = R.starsFor(run);
      if (run.won) {
        const rec = P.recordStage(p, run.stage, res.stars, run.t);
        res.newStars = rec.newStars;
        res.gems += rec.gems;
        res.first = rec.first;
        ++s.stages;
        P.questProgress(p, 'stage', 1).forEach(q => res.quests.push(q));
      }
    }
    const entry = { score: g.score, lines: g.lines, level: g.level, time: Math.round(run.t * 100) / 100, day: day };
    if (run.mode === 'marathon') { res.rank = P.addScore(p.scores.marathon, entry, 'score'); s.marathonLines = Math.max(s.marathonLines, g.lines); }
    if (run.mode === 'sprint' && run.won) {
      res.rank = P.addScore(p.scores.sprint, entry, 'time', true);
      res.best = !s.sprintBest || run.t < s.sprintBest;
      s.sprintBest = s.sprintBest ? Math.min(s.sprintBest, run.t) : run.t;
      P.questProgress(p, 'sprint', 1).forEach(q => res.quests.push(q));
    }
    if (run.mode === 'ultra') { res.rank = P.addScore(p.scores.ultra, entry, 'score'); res.best = g.score > s.ultraBest; s.ultraBest = Math.max(s.ultraBest, g.score); }
    if (run.mode === 'master') { res.rank = P.addScore(p.scores.master, entry, 'level'); res.best = g.level > s.masterBest; s.masterBest = Math.max(s.masterBest, g.level); }
    if (run.mode === 'daily' && run.reason === 'time') {
      const prev = p.scores.daily[run.day] || 0;
      res.best = g.score > prev;
      p.scores.daily[run.day] = Math.max(prev, g.score);
      ++s.dailies;
    }
    if (run.mode === 'zen') {
      s.zenSeconds += run.t;
      P.questProgress(p, 'zen', Math.floor(run.t / 60)).forEach(q => res.quests.push(q));
    }
    if (run.mode === 'rush' && run.won) ++s.rushWins;
    if (run.mode === 'story' && run.stage && run.won && W.BY_ID[run.stage].kind === 'boss') s.bosses = Math.max(s.bosses, P.bossesBeaten(p));
    const mutShards = run.mutators.reduce((k, id) => k * NS.seasons.MUT_BY_ID[id].shards, 1);
    const pay = P.payout(p, { mode: run.mode, score: g.score, lines: g.lines, time: run.t, won: run.won, stars: res.newStars, mutatorShards: mutShards });
    p.shards += pay.shards;
    res.shards = pay.shards;
    res.xp = pay.xp;
    res.levels = P.addXp(p, pay.xp);
    const qk = [['lines', g.lines], ['quads', g.stats.quads], ['tspins', g.stats.tspins], ['powers', run.powersUsed], ['games', 1], ['pieces', g.pieces]];
    for (const [k, v] of qk) if (v) P.questProgress(p, k, v).forEach(q => res.quests.push(q));
    P.questProgress(p, 'combo', g.stats.maxCombo).forEach(q => res.quests.push(q));
    P.questProgress(p, 'score', g.score).forEach(q => res.quests.push(q));
    if (run.tokens) res.festival = P.addTokens(p, run.tokens, new Date());
    res.tokens = run.tokens;
    res.achievements = P.checkAchievements(p);
    G.result = res;
    G.resultT = G.time;
    NS.save.clearRun();
    NS.save.saveProfile(p);
    const finale = run.mode === 'story' && run.won && run.stage === 'void-6' && !p.seen.finale;
    if (run.mode === 'story' && run.won && run.stage && W.BY_ID[run.stage].kind === 'boss') {
      const w = W.BY_ID[run.stage].world;
      const shots = ST.bossWin(w, W.BOSSES[w]);
      if (finale) {
        p.seen.finale = true;
        shots.push.apply(shots, ST.SHOTS.finale);
      }
      NS.screens.setScreen('results');
      NS.cine.play(shots, 'victory');
    } else NS.screens.setScreen('results');
    if (SZ.GameMusic) SZ.GameMusic.stinger(run.won ? 'win' : 'lose');
  }

  function autosave(dt) {
    G.autoSaveT += dt;
    if (G.autoSaveT < C.AUTOSAVE) return;
    G.autoSaveT = 0;
    if (G.run && !G.run.done) NS.save.saveRun(G.run);
    NS.save.saveProfile(G.profile);
  }

  Object.assign(NS.play, { cellXY, start, resume, quit, update, present, callout, complete, autosave });
})();
