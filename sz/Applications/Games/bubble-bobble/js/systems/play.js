/* Playing a session on screen: starting a mode or stage (with the kingdom and guardian
   cinematics the first time), Continue from the saved snapshot, the frame update with input,
   turning engine and session events into sound, particles, shakes, floating words and cast
   call-outs, autosave, and finishing - stars, records, high scores, shards, XP, quests,
   festival tokens and achievements - into the results screen. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.engine;
  const P = NS.progress;
  const R = NS.run;
  const W = NS.worldData;
  const ST = NS.storyData;
  const FX = NS.fx;
  const { sfx, forEvent } = NS.audio;
  const { FIELD_X, FIELD_Y, UI, POWER_BY_ID, ENEMIES } = C;

  function start(mode, opts) {
    opts = opts || {};
    const p = G.profile;
    G.run = R.build(mode, { stage: opts.stage, seed: opts.seed, coop: opts.coop != null ? opts.coop : !!p.settings.coop, date: new Date() }, p);
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
    if (G.screen !== 'game' || G.cine) return;
    R.tick(run, dt, NS.input.state(), G.profile);
    const evs = R.takeEvents(run);
    for (let i = 0; i < evs.length; ++i) present(evs[i]);
    if (G.ui.callout && (G.ui.callout.t -= dt) <= 0) G.ui.callout = null;
    if (run.done) complete();
  }

  function callout(who, text) {
    G.ui.callout = { who: who, text: text, t: 2.4 };
  }

  function at(x, y) {
    return { x: FIELD_X + x, y: FIELD_Y + y };
  }

  function trailDef() {
    return NS.metaData.TRAILS.find(x => x.id === G.profile.cosmetics.trail) || NS.metaData.TRAILS[0];
  }

  function present(e) {
    forEvent(e);
    const run = G.run;
    const g = run.game;
    const t = trailDef();
    const kind = t.kind === 'rainbow' ? 'spark' : t.kind;
    switch (e.type) {
      case 'blow': FX.burst(FIELD_X + e.x + (e.who && g.buddy ? g.buddy : g.player).face * 14, FIELD_Y + e.y - 14, 4, ['#ffffff', NS.fieldRender.bubbleDef().color], 'bubble', 80, -40, 3); break;
      case 'trap': FX.ring(at(e.x, e.y).x, at(e.x, e.y).y, 6, 40, 0.4, '#ffffff', 3); break;
      case 'dent': FX.text(at(e.x, e.y).x, at(e.x, e.y).y - 30, 'THUNK', '#ffffff', 14, 0.6); break;
      case 'pop': {
        const c = at(e.x, e.y);
        FX.burst(c.x, c.y, 18, [t.color, '#ffffff', ENEMIES[e.kind].color], kind, 260, 300, 5);
        FX.ring(c.x, c.y, 8, 50, 0.4, '#ffffff', 3);
        FX.text(c.x, c.y - 20, e.points.toLocaleString('en-US'), e.n > 2 ? UI.gold : '#ffffff', 14 + Math.min(12, e.n * 2), 1.2);
        FX.shake(2 + e.n);
        break;
      }
      case 'popempty': FX.burst(at(e.x, e.y).x, at(e.x, e.y).y, 6, ['#ffffff'], 'bubble', 120, 0, 3); break;
      case 'chain':
        FX.text(FIELD_X + C.FIELD_W / 2, FIELD_Y + 200, e.n + ' CHAIN!', UI.gold, 28 + e.n * 3, 1.4);
        FX.flash(0.15 + e.n * 0.04, '#ffffff');
        FX.stop(0.03 * e.n);
        if (e.n >= 3) callout('pop', ST.CALLOUTS.chain[e.n % 3]);
        break;
      case 'fruit': FX.text(at(e.x, e.y).x, at(e.x, e.y).y - 20, '+' + e.value, '#ffe8a0', 14, 0.8); FX.burst(at(e.x, e.y).x, at(e.x, e.y).y, 8, [NS.sprites.FRUITS[e.fruit % 8], '#ffffff'], 'star', 140, 200, 3); break;
      case 'power': {
        const pw = POWER_BY_ID[e.id];
        FX.text(FIELD_X + g.player.x, FIELD_Y + g.player.y - 50, pw.name.toUpperCase() + '!', pw.color, 20, 1.2);
        FX.ring(FIELD_X + g.player.x, FIELD_Y + g.player.y - 16, 10, 80, 0.5, pw.color, 4);
        if (Math.random() < 0.3) callout('pop', ST.CALLOUTS.power[Math.floor(Math.random() * 2)]);
        break;
      }
      case 'escape': FX.text(at(e.x, e.y).x, at(e.x, e.y).y - 20, 'GRRR!', UI.bad, 18, 0.8); break;
      case 'popelem': {
        const c = at(e.x, e.y);
        const col = { water: '#5ad0ff', bolt: '#ffe04a', fire: '#ff7a2a', star: '#ff9ad8' }[e.elem];
        FX.burst(c.x, c.y, 30, [col, '#ffffff'], e.elem === 'star' ? 'star' : e.elem === 'fire' ? 'ember' : e.elem === 'water' ? 'bubble' : 'spark', 300, 200, 5);
        FX.flash(0.25, col);
        if (e.elem === 'star') FX.text(c.x, c.y - 20, 'STAR ' + g.stars + '/' + C.STAR_GOAL, col, 18, 1);
        break;
      }
      case 'zap': FX.burst(at(e.x, e.y).x, at(e.x, e.y).y - 12, 16, ['#ffffff', '#ffe04a'], 'star', 260, 300, 5); FX.text(at(e.x, e.y).x, at(e.x, e.y).y - 30, '+' + e.points, '#ffffff', 16, 0.9); break;
      case 'extralife': FX.text(640, 300, 'EXTRA LIFE!', UI.good, 34, 1.6); FX.flash(0.4, '#ff9ad8'); break;
      case 'hurry': FX.flash(0.3, '#ff3a3a'); callout('pop', ST.CALLOUTS.hurry[0]); break;
      case 'shade': FX.flash(0.4, '#5a1a5a'); callout('fizz', ST.CALLOUTS.shade[0]); break;
      case 'die':
        if (e.who) {
          FX.burst(at(e.x, e.y).x, at(e.x, e.y).y - 12, 18, [NS.metaData.POP_NEWT.color, '#ffffff'], 'star', 240, 300, 4);
          FX.text(at(e.x, e.y).x, at(e.x, e.y).y - 40, 'OOF!', NS.metaData.POP_NEWT.color, 16, 0.9);
          if (Math.random() < 0.5) callout('pop', ST.CALLOUTS.popDown[Math.floor(Math.random() * ST.CALLOUTS.popDown.length)]);
        } else { FX.shake(12); FX.flash(0.4, '#ff3a3a'); FX.burst(at(e.x, e.y).x, at(e.x, e.y).y - 12, 30, [NS.fieldRender.newtDef().color, '#ffffff'], 'star', 300, 300, 5); }
        break;
      case 'shieldpop': FX.ring(at(e.x, e.y).x, at(e.x, e.y).y - 16, 10, 80, 0.5, '#c8a0ff', 5); break;
      case 'respawn':
        if (e.who) FX.ring(FIELD_X + g.buddy.x, FIELD_Y + g.buddy.y - 14, 6, 50, 0.5, NS.metaData.POP_NEWT.accent, 3);
        else if (e.lives === 0) callout('fizz', 'Last life - careful now!');
        break;
      case 'bosshit': {
        const c = at(e.x, e.y);
        FX.text(c.x, c.y - 40, '-' + e.dmg, '#ff6a6a', 24, 0.8);
        FX.burst(c.x, c.y, 16, [NS.worldData.BOSSES[g.boss.w].accent, '#ffffff'], 'star', 260, 200, 5);
        FX.shake(6);
        break;
      }
      case 'rage': FX.flash(0.6, '#ff2a2a'); FX.shake(14); callout('boss', 'NOW YOU\'VE DONE IT!'); break;
      case 'summon': callout('boss', 'Minions, to me!'); break;
      case 'bossdown': {
        const c = at(e.x, e.y);
        for (let k = 0; k < 4; ++k) FX.burst(c.x + (Math.random() - 0.5) * 100, c.y + (Math.random() - 0.5) * 80, 40, ['#ffd25a', '#ffffff', '#ff7ad8', '#7affea'], 'bubble', 520, 100, 7);
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
      case 'room':
        FX.text(640, 330, 'ROOM ' + e.n, UI.gold, 40, 1.6);
        sfx('levelup');
        if (SZ.GameMusic) SZ.GameMusic.stinger('level');
        break;
      case 'cleared':
        for (let i = 0; i < 60; ++i) FX.spawn(FIELD_X + Math.random() * C.FIELD_W, FIELD_Y + C.FIELD_H, (Math.random() - 0.5) * 200, -300 - Math.random() * 400, 1.6, 6, ['#ffd25a', '#ff7ad8', '#7affea', '#ffffff'][i % 4], 'bubble', 300);
        break;
      case 'revive':
        FX.flash(0.8, '#ffffff');
        FX.text(640, 360, 'SECOND CHANCE', UI.good, 32, 2);
        sfx('win', { pitch: 1.2 });
        break;
    }
  }

  function complete() {
    const run = G.run;
    const p = G.profile;
    const g = run.game;
    const s = p.stats;
    const res = { mode: run.mode, stage: run.stage, won: run.won, reason: run.reason, score: g.score, trapped: g.stats.trapped, time: run.t, wall: run.room,
      stats: g.stats, stars: [false, false, false], newStars: 0, gems: 0, rank: -1, best: false, levels: 0, quests: [], festival: [], achievements: [] };
    s.games += 1;
    s.trapped += g.stats.trapped;
    s.bestChain = Math.max(s.bestChain, g.stats.bestChain);
    s.fruit += g.stats.fruit;
    s.powers += g.stats.powers;
    s.elements += g.stats.elements;
    s.bounces += g.stats.bounces;
    s.starLives += run.starLives;
    s.deaths += g.stats.deaths;
    s.calm += run.calm;
    s.score += g.score;
    s.playSeconds += run.t;
    if (run.mode === 'story' && run.won) {
      res.stars = R.starsFor(run);
      const rec = P.recordStage(p, run.stage, res.stars, run.t);
      res.newStars = rec.newStars;
      res.gems += rec.gems;
      ++s.stages;
      if (!g.stats.deaths) ++s.flawless;
      if (W.BY_ID[run.stage].kind === 'boss') s.bosses = Math.max(s.bosses, P.bossesBeaten(p));
      P.questProgress(p, 'stage', 1).forEach(q => res.quests.push(q));
    }
    const entry = { score: g.score, wall: run.room, day: G.today };
    if (run.mode === 'arcade') { res.rank = P.addScore(p.scores.arcade, entry, 'score'); res.best = run.room > s.arcadeBest; s.arcadeBest = Math.max(s.arcadeBest, run.room); }
    if (run.mode === 'blitz') { res.rank = P.addScore(p.scores.blitz, entry, 'score'); res.best = g.score > s.blitzBest; s.blitzBest = Math.max(s.blitzBest, g.score); }
    if (run.mode === 'daily' && run.reason === 'time') {
      const prev = p.scores.daily[run.day] || 0;
      res.best = g.score > prev;
      p.scores.daily[run.day] = Math.max(prev, g.score);
      ++s.dailies;
    }
    if (run.mode === 'zen') { s.zenSeconds += run.t; P.questProgress(p, 'zen', Math.floor(run.t / 60)).forEach(q => res.quests.push(q)); }
    if (run.mode === 'rush' && run.won) ++s.rushWins;
    if (g.buddy) {
      res.popTrapped = g.buddy.trapped;
      s.popTraps += g.buddy.trapped;
      const rooms = run.mode === 'story' ? (run.won ? 1 : 0) : run.room - 1;
      s.coopRooms += rooms;
      if (rooms) P.questProgress(p, 'coop', rooms).forEach(q => res.quests.push(q));
    }
    const mutShards = run.mutators.reduce((k, id) => k * NS.seasons.MUT_BY_ID[id].shards, 1);
    const pay = P.payout(p, { mode: run.mode, score: g.score, trapped: g.stats.trapped, best: g.stats.bestChain, won: run.won, stars: res.newStars, mutatorShards: mutShards });
    p.shards += pay.shards;
    res.shards = pay.shards;
    res.xp = pay.xp;
    res.levels = P.addXp(p, pay.xp);
    const qk = [['trapped', g.stats.trapped], ['fruit', g.stats.fruit], ['elements', g.stats.elements], ['powers', g.stats.powers], ['bounces', g.stats.bounces], ['games', 1]];
    for (const [k, v] of qk) if (v) P.questProgress(p, k, v).forEach(q => res.quests.push(q));
    P.questProgress(p, 'chain', g.stats.bestChain).forEach(q => res.quests.push(q));
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
      if (run.stage === 'castle-6' && !p.seen.finale) {
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
