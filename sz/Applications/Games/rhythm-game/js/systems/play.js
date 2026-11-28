/* Songs on screen for every mode. A run is built from a recipe (mode, stage or song, difficulty,
   speed, mutators, boosters, the Marathon or Boss Rush index): the chart, the engine state with the
   profile's options and the conductor. Each frame the conductor's clock drives the engine, and its
   events become juice (lane flashes, bursts in the equipped hit effect, rings, judgement words,
   Early/Late, combo pops, shakes, flashes, call-outs, duel banners), sound and statistics. Presses
   come from input with their own timestamps and the audio offset. A finished song pays out and is
   recorded (stars, bests, mastery, quests, the weekly challenge, festival tokens, XP and levels),
   plays its story cinematics and opens the results with the near miss and the personal best. The
   song in progress is saved every few seconds, on pause and when the page hides; Continue rebuilds
   it from its recipe and rejoins at the bar it reached. Marathon and Boss Rush carry score, combo
   and groove from song to song. The title demo is a silent run played by the bot. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.engine;
  const P = NS.progress;
  const W = NS.worldData;
  const SD = NS.songData;
  const SE = NS.seasons;
  const M = NS.metaData;
  const CD = NS.conductor;
  const fx = NS.fx;
  const scr = NS.screens;
  const { sfx } = NS.audio;
  const ST = NS.storyData;

  const RANK_COLOR = { perfect: '#ffe85a', great: '#5af0ff', good: '#7bf0a0', miss: '#ff5a7a' };
  const KINDS_BY_DIFF = { easy: {}, normal: { hold: 0.6 }, hard: { hold: 1, chord: 0.6, hush: 0.3 }, expert: { hold: 1, chord: 1, hush: 0.6, drift: 0.6 } };
  const MARATHON = () => SD.DISTRICT.concat(SD.SHOP.slice(0, 6));

  function lucky(recipe) {
    return (recipe.boosters || []).indexOf('lucky') >= 0 || P.stat(G.profile, 'lucky') > 0;
  }

  /* the song and chart of a recipe */
  function chartFor(r) {
    const mut = r.mutators || [];
    const speed = (r.speed || 1) * (mut.indexOf('double') >= 0 ? 1.15 : 1);
    const common = { lucky: lucky(r), mirror: mut.indexOf('mirror') >= 0, hushStorm: mut.indexOf('storm') >= 0, speed: speed };
    const speeded = s => (speed !== 1 ? Object.assign({}, s, { bpm: NS.chart.bpmOf(s) * speed }) : s);
    const kinds = k => { const o = Object.assign({}, k); if (common.hushStorm) o.hush = 1.4; return o; };
    switch (r.mode) {
      case 'story': case 'bossrush': return W.stageChart(W.BY_ID[r.stage], common);
      case 'remix': return W.chartAt(W.BY_ID[r.stage], Math.min(1, W.stageLevel(W.BY_ID[r.stage]) + 0.14), common);
      case 'free': {
        const e = P.library(G.profile, new Date()).find(x => x.id === r.song) || P.library(G.profile, new Date())[0];
        const d = M.DIFF_BY_ID[r.diff] || M.DIFFS[1];
        return NS.chart.build(speeded(e.song), { level: d.level, bars: 40, kinds: kinds(KINDS_BY_DIFF[d.id]), lucky: common.lucky, mirror: common.mirror, seed: 7 });
      }
      case 'daily': case 'weekly': {
        const rec = r.mode === 'daily' ? SE.dailyRecipe(new Date()) : SE.weeklyRecipe(new Date());
        return NS.chart.build(speeded(rec.song), { level: rec.level, bars: rec.bars, kinds: kinds({ hold: 0.8, chord: 0.6, hush: 0.4, drift: 0.3 }), lucky: common.lucky, mirror: common.mirror, seed: 3 });
      }
      case 'zen': return NS.chart.build(SD.ZEN[(r.index || 0) % SD.ZEN.length], { level: 0.22, bars: 40, kinds: { hold: 0.5 }, seed: 1 });
      case 'marathon': {
        const k = r.index || 0, pool = MARATHON();
        const base = SZ.GameMusic.variant(pool[k % pool.length], 'mara' + k);
        const song = Object.assign({}, base, { bpm: NS.chart.bpmOf(base) * (1 + Math.min(0.3, k * 0.03)), name: (pool[k % pool.length].name || 'Song') + ' ' + (k + 1) });
        return NS.chart.build(song, { level: Math.min(1, 0.35 + k * 0.06), bars: 24, kinds: { hold: 0.8, chord: k > 1 ? 0.6 : 0, hush: k > 3 ? 0.4 : 0, drift: k > 5 ? 0.4 : 0 }, seed: k });
      }
      case 'demo': return W.chartAt(W.STAGES[r.index || 0], 0.5, {});
    }
    return W.stageChart(W.STAGES[0]);
  }

  function titleOf(r, chart) {
    if (r.stage) return W.BY_ID[r.stage].name;
    return chart.song.name || 'Song';
  }

  function bestKey(r) {
    if (r.mode === 'story') return 'story:' + r.stage;
    if (r.mode === 'remix') return 'remix:' + r.stage;
    if (r.mode === 'free') return r.song + ':' + r.diff;
    if (r.mode === 'daily') return 'daily:' + SE.dailyRecipe(new Date()).key;
    if (r.mode === 'weekly') return 'weekly:' + SE.weeklyRecipe(new Date()).key;
    return r.mode;
  }

  /* builds a run from a recipe (eng: a saved engine state to continue) */
  function build(recipe, eng, opts) {
    opts = opts || {};
    const chart = chartFor(recipe);
    const p = G.profile;
    const st = recipe.stage ? W.BY_ID[recipe.stage] : null;
    const extra = { calm: P.stat(p, 'calm'), noFail: recipe.mode === 'zen' || !!p.settings.relaxed || recipe.mode === 'demo' };
    if (st && st.boss) extra.boss = st.boss;
    const o = P.engineOpts(p, recipe.boosters, recipe.mutators, extra);
    if (opts.carry) Object.assign(o, { grooveStart: Math.min(1, opts.carry.groove + 0.25 + P.stat(p, 'marathonRefill')) });
    const state = eng || E.create(chart, o);
    if (opts.carry && !eng) for (const k of ['score', 'combo', 'maxCombo', 'surge', 'shield']) state[k] = opts.carry[k];
    const best = p.best[bestKey(recipe)];
    return {
      recipe: recipe, mode: recipe.mode, chart: chart, eng: state, opts: o, title: titleOf(recipe, chart), stage: st,
      world: st ? st.world : recipe.mode === 'demo' ? (recipe.index || 0) % 5 : 0,
      cond: CD.create(chart, { bar: opts.bar || 0, lead: opts.lead, silent: recipe.mode === 'demo' }),
      best: best ? best.score : 0, done: false, callT: 0, plan: null, totals: opts.totals || null,
    };
  }

  /* ---- starting ---- */
  function start(mode, opts) {
    opts = opts || {};
    if (G.run && G.run.cond && mode !== 'demo') CD.stop(G.run.cond);
    const p = G.profile;
    const recipe = { mode: mode, stage: opts.stage || null, song: opts.song || null, diff: opts.diff || p.settings.diff, speed: opts.speed || 1,
      mutators: opts.mutators || [], boosters: [], index: opts.index || 0 };
    if (mode === 'daily') recipe.mutators = SE.dailyRecipe(new Date()).mutators;
    if (mode === 'weekly') recipe.mutators = [SE.weeklyRecipe(new Date()).mutator];
    if (mode === 'remix') recipe.mutators = SE.pickTwo(NS.rng.makeRng(NS.rng.hashString('remix-' + recipe.stage)));
    if (mode !== 'demo' && mode !== 'zen') recipe.boosters = P.useBoosters(p, opts.boosters || G.ui.boosters || []);
    G.run = build(recipe);
    if (mode === 'marathon' || mode === 'bossrush') G.run.totals = { songs: 0, score: 0 };
    G.result = null;
    if (mode === 'demo') return G.run;
    fx.clear();
    scr.setScreen('game');
    NS.save.saveProfile(p);
    /* story cinematics: a district's arrival the first time, a duel's intro */
    const st = G.run.stage;
    if (st && mode === 'story') {
      let shots = [];
      if (!p.seen.worlds[st.world] && st.stage === 0) { shots = shots.concat(ST.worldIntro(st.world, W.WORLDS[st.world])); p.seen.worlds[st.world] = true; }
      if (st.boss && !p.seen.bosses[st.world]) { shots = shots.concat(ST.bossIntro(st.world, st.boss)); p.seen.bosses[st.world] = true; }
      if (shots.length) NS.cine.play(shots, 'stage');
    }
    return G.run;
  }

  function restart() {
    const r = G.run;
    if (!r) return;
    CD.stop(r.cond);
    const rec = r.recipe;
    start(rec.mode === 'marathon' || rec.mode === 'bossrush' ? rec.mode : rec.mode, { stage: rec.mode === 'bossrush' ? W.STAGES[5].id : rec.stage, song: rec.song, diff: rec.diff, speed: rec.speed, index: rec.mode === 'marathon' || rec.mode === 'bossrush' ? 0 : rec.index, mutators: rec.mode === 'free' ? rec.mutators : undefined, boosters: rec.boosters });
  }

  /* Continue: the saved song rebuilt and rejoined at its bar */
  function resumeSaved() {
    const s = NS.save.loadRun();
    if (!s) return false;
    try {
      const run = build(s.recipe, s.eng, { bar: Math.max(0, Math.floor(s.t / 1)), lead: 2 });
      run.cond.bar = Math.max(0, Math.floor((s.t + 0.05) / run.chart.barLen));
      run.cond.t = run.cond.bar * run.chart.barLen - 2.2;
      run.eng.t = Math.min(run.eng.t, run.cond.t);
      G.run = run;
      G.result = null;
      fx.clear();
      scr.setScreen('game');
      return true;
    } catch (e) {
      NS.save.clearRun();
      return false;
    }
  }

  /* ---- input ---- */
  function songTime(perf) {
    const r = G.run;
    return CD.timeAt(r.cond, perf) - (G.profile.settings.offset || 0) / 1000;
  }

  function playing() {
    const r = G.run;
    return r && !r.done && G.screen === 'game' && !G.cine && r.mode !== 'demo';
  }

  function press(lane, perf) {
    G.input.lanes[lane] = true;
    G.input.laneFlash[lane] = 1;
    if (!playing()) return null;
    const r = G.run;
    const res = E.press(r.eng, r.chart, lane, songTime(perf));
    handle(E.take(r.eng));
    return res;
  }

  function release(lane, perf) {
    G.input.lanes[lane] = false;
    if (!playing()) return;
    const r = G.run;
    E.release(r.eng, r.chart, lane, songTime(perf));
    handle(E.take(r.eng));
  }

  function surge() {
    if (!playing()) return false;
    const ok = E.surge(G.run.eng, G.run.chart);
    handle(E.take(G.run.eng));
    return ok;
  }

  /* ---- juice ---- */
  function effectColors(lane) {
    const eff = M.EFFECTS.find(e => e.id === G.profile.equip.effect) || M.EFFECTS[0];
    const c = C.LANE_COLORS[lane];
    return { kind: eff.kind, colors: eff.tint ? [eff.tint, '#ffffff', c] : [c, '#ffffff', NS.artKit.shade(c, 0.4)] };
  }

  function burstAt(lane, rank, big) {
    const x = NS.highway.laneX(lane, C.HIT_Y), y = C.HIT_Y;
    const e = effectColors(lane);
    const n = rank === 'perfect' ? 16 : rank === 'great' ? 11 : 7;
    const kind = e.kind === 'ring' ? 'spark' : e.kind;
    fx.burst(x, y, big ? n * 2 : n, e.colors, kind, rank === 'perfect' ? 320 : 240, 500, kind === 'confetti' ? 6 : 5);
    fx.ring(x, y, 10, rank === 'perfect' ? 70 : 52, 0.35, rank === 'perfect' ? '#ffffff' : C.LANE_COLORS[lane], rank === 'perfect' ? 4 : 3);
    if (e.kind === 'ring') fx.ring(x, y, 20, 110, 0.5, C.LANE_COLORS[lane], 2);
  }

  function callout(list, color) {
    const r = G.run;
    if (!r || G.time - r.callT < 3) return;
    r.callT = G.time;
    G.ui.callout = { text: list[Math.floor(Math.random() * list.length)], color: color || C.UI.gold, t: 0 };
  }

  function handle(events) {
    const r = G.run;
    for (const e of events) {
      if (r.mode !== 'demo') NS.audio.forEvent(e);
      switch (e.type) {
        case 'hit': {
          burstAt(e.lane, e.rank, e.star);
          const x = NS.highway.laneX(e.lane, C.HIT_Y);
          fx.text(x, C.HIT_Y - 50, e.rank.toUpperCase(), RANK_COLOR[e.rank], e.rank === 'perfect' ? 22 : 18, 0.55);
          if (e.rank !== 'perfect') fx.text(x, C.HIT_Y - 28, e.dt < 0 ? 'early' : 'late', e.dt < 0 ? '#8ab4ff' : '#ffb07a', 12, 0.45);
          G.pulse = Math.max(G.pulse, e.rank === 'perfect' ? 0.5 : 0.3);
          break;
        }
        case 'miss': {
          const x = NS.highway.laneX(e.lane, C.HIT_Y);
          fx.text(x, C.HIT_Y - 50, 'MISS', RANK_COLOR.miss, 18, 0.6);
          fx.burst(x, C.HIT_Y, 5, ['#ff5a7a', '#5a2a3a'], 'square', 120, 400, 4);
          fx.shake(3);
          break;
        }
        case 'combo-break': fx.shake(6); G.flash = Math.max(G.flash, 0.15); G.flashColor = '#ff2a4a'; break;
        case 'hold-ok': burstAt(e.lane, 'great', false); break;
        case 'hold-break': fx.text(NS.highway.laneX(e.lane, C.HIT_Y), C.HIT_Y - 50, 'BROKEN', RANK_COLOR.miss, 16, 0.6); break;
        case 'hush': {
          const x = NS.highway.laneX(e.lane, C.HIT_Y);
          fx.burst(x, C.HIT_Y, 18, ['#1a1a2a', '#6a5a8a', '#ffffff'], 'square', 200, 0, 7);
          fx.text(x, C.HIT_Y - 50, 'HUSH!', '#c8b8ff', 20, 0.7);
          fx.shake(8);
          G.flash = Math.max(G.flash, 0.25); G.flashColor = '#2a1a4a';
          break;
        }
        case 'phrase': {
          for (let l = 0; l < 4; ++l) fx.burst(NS.highway.laneX(l, C.HIT_Y), C.HIT_Y, 8, ['#ffd25a', '#ffffff'], 'star', 260, 300, 7);
          fx.text(640, 300, 'STAR PHRASE!', C.UI.gold, 30, 1);
          callout(ST.CALLOUTS.phrase);
          break;
        }
        case 'surge-ready': fx.text(640, 340, 'SURGE READY - SPACE!', '#ff7ad8', 24, 1.3); break;
        case 'surge-on': fx.flash(0.5, '#ff7ad8'); fx.shake(10); callout(ST.CALLOUTS.surge, '#ff7ad8'); for (let l = 0; l < 4; ++l) fx.ring(NS.highway.laneX(l, C.HIT_Y), C.HIT_Y, 10, 160, 0.7, '#ff7ad8', 4); break;
        case 'pickup': fx.text(NS.highway.laneX(e.lane, C.HIT_Y), C.HIT_Y - 80, { shield: 'SHIELD', heart: '+GROOVE', magnet: 'MAGNET', mult: '+1x MULTIPLIER' }[e.kind], '#ffffff', 18, 1); fx.burst(NS.highway.laneX(e.lane, C.HIT_Y), C.HIT_Y, 14, ['#ffffff', '#5af0ff', '#ffd25a'], 'star', 300, 200, 6); break;
        case 'combo': fx.text(640, 250, e.combo + ' COMBO!', '#ffffff', 34, 1.1); fx.ring(640, C.HIT_Y, 30, 420, 0.6, '#ffffff', 3); callout(ST.CALLOUTS.combo); break;
        case 'mult': fx.text(640, 290, 'x' + e.mult, C.UI.gold, 40, 0.9); break;
        case 'groove-low': callout(ST.CALLOUTS.low, '#ff5a7a'); break;
        case 'rescue': fx.flash(0.6, '#7bf0a0'); callout(ST.CALLOUTS.rescue, '#7bf0a0'); break;
        case 'shielded': case 'net': fx.text(640, 360, e.type === 'net' ? 'SAFETY NET' : 'SHIELD SAVED IT', '#7bf0a0', 18, 0.8); break;
        case 'telegraph': G.ui.banner = { kind: e.kind, t: 0, at: e.at }; break;
        case 'attack': fx.shake(12); G.flash = Math.max(G.flash, 0.3); G.flashColor = r.stage && r.stage.boss ? r.stage.boss.color : '#ffffff'; break;
        case 'rage': fx.shake(16); fx.text(1010, 200, 'RAGE!', '#ff5a5a', 32, 1.4); break;
        case 'boss-hit': if (Math.random() < 0.08) callout(ST.CALLOUTS.boss, '#ffffff'); break;
        case 'boss-down': fx.flash(1, '#ffffff'); fx.shake(20); fx.burst(1040, 330, 80, ['#ffffff', '#ffd25a', r.stage.boss.color], 'star', 500, 300, 8); fx.text(640, 260, r.stage.boss.short.toUpperCase() + ' FINDS THE BEAT!', '#ffffff', 30, 2.2); break;
      }
    }
  }

  /* ---- the frame ---- */
  function update(dt) {
    for (let l = 0; l < 4; ++l) G.input.laneFlash[l] = Math.max(0, G.input.laneFlash[l] - dt * 5);
    if (G.ui.callout) { G.ui.callout.t += dt; if (G.ui.callout.t > 2) G.ui.callout = null; }
    if (G.ui.banner) { G.ui.banner.t += dt; if (G.ui.banner.t > 4) G.ui.banner = null; }
    const r = G.run;
    if (!r || r.done) return;
    if (r.mode === 'demo') {
      if (G.screen !== 'title') return;
      const t = CD.update(r.cond, dt);
      if (!r.plan) r.plan = NS.bot.plan(r.chart, 'pro', 5);
      NS.bot.step(r.eng, r.chart, r.plan, t);
      for (const a of r.plan.acts) if (a.t <= t && a.t > t - dt && a.type === 'press') G.input.laneFlash[a.lane] = 1;
      handle(E.take(r.eng));
      if (r.eng.done || t > r.chart.length) NS.demo.next();
      return;
    }
    if (G.screen !== 'game' || G.cine) return;
    const t = CD.update(r.cond, dt);
    E.update(r.eng, r.chart, t);
    handle(E.take(r.eng));
    /* beat pulse and the Silence attack */
    const b = CD.beatOf(r.cond, t);
    if (b.i !== r.lastBeat) { r.lastBeat = b.i; G.pulse = Math.max(G.pulse, b.i % 4 === 0 ? 0.6 : 0.3); }
    silence(r.eng.attack && r.eng.attack.kind === 'silence');
    if (r.eng.done) finishSong();
  }

  let muted = false;
  function silence(on) {
    if (on === muted) return;
    muted = on;
    const A = SZ.GameAudio;
    try {
      const bus = A && A.bus && A.bus('music');
      if (bus && bus.gain && A.context) bus.gain.setTargetAtTime(on ? 0.0001 : 1, A.context.currentTime, on ? 0.08 : 0.2);
    } catch (_) {}
  }

  /* ---- finishing ---- */
  function goalMet(st, s, run) {
    switch (st.goal) {
      case 'fc': return E.fullCombo(s);
      case 'stars': return run.chart.phrases.length > 0 && s.phrasesDone >= run.chart.phrases.length;
      case 'acc95': return E.accuracy(s) >= 0.95;
      case 'acc90': return E.accuracy(s) >= 0.9;
      case 'noboost': return !(run.recipe.boosters || []).length;
      case 'nohush': return s.hushHit === 0;
      case 'holds': return s.holdsBroken === 0;
      case 'combo': return s.maxCombo >= st.goalN;
    }
    return false;
  }

  function finishSong() {
    const r = G.run;
    const s = r.eng;
    silence(false);
    const failed = s.failed;
    /* Marathon and Boss Rush roll on to the next song */
    if (!failed && (r.mode === 'marathon' || (r.mode === 'bossrush' && r.recipe.index < 4))) {
      r.totals.songs += 1;
      const carry = { groove: s.groove, score: s.score, combo: s.combo, maxCombo: s.maxCombo, surge: s.surge, shield: s.shield };
      const rec = Object.assign({}, r.recipe, { index: r.recipe.index + 1 });
      if (r.mode === 'bossrush') rec.stage = W.STAGES[(rec.index) * 6 + 5].id;
      const totals = r.totals;
      const acc = { hits: (r.accHits || 0) + s.counts.perfect + s.counts.great + s.counts.good };
      G.run = build(rec, null, { carry: carry, lead: 3, totals: totals });
      G.run.accHits = acc.hits;
      fx.text(640, 300, r.mode === 'marathon' ? 'NEXT SONG - ' + G.run.title.toUpperCase() : 'NEXT DUEL - ' + G.run.stage.boss.short.toUpperCase(), '#ffffff', 26, 2.5);
      sfx('levelup');
      return;
    }
    r.done = true;
    CD.stop(r.cond);
    NS.save.clearRun();
    record(r);
  }

  function record(r) {
    const p = G.profile, s = r.eng, st = r.stage;
    const hits = s.counts.perfect + s.counts.great + s.counts.good;
    const acc = E.accuracy(s);
    const grade = E.grade(s);
    const fc = E.fullCombo(s) && !s.failed;
    const cleared = !s.failed;
    const res = { mode: r.mode, title: r.title, score: s.score, grade: grade, acc: acc, counts: s.counts, maxCombo: s.maxCombo, fc: fc, cleared: cleared, failed: s.failed,
      hits: hits, early: s.early, late: s.late, offset: s.offN ? s.offSum / s.offN : 0, phrases: s.phrasesDone, phraseN: r.chart.phrases.length, boss: st && st.boss ? st.boss : null,
      stars: null, newStars: 0, crystals: 0, prevBest: r.best, newBest: false, levelUps: [], tiers: [], quests: [], stage: st, recipe: r.recipe, totals: r.totals };
    /* stats */
    const S = p.stats;
    S.hits += hits; S.perfects += s.counts.perfect; S.misses += s.counts.miss; S.bestCombo = Math.max(S.bestCombo, s.maxCombo);
    S.songs += 1; S.surges += s.surgeUses; S.hushDodged += s.hushDodged; S.holds += s.holdsOk; S.pickups += s.pickups; S.phrases += s.phrasesDone; S.score += s.score;
    S.playSeconds += Math.max(0, Math.min(s.t, r.chart.length));
    if (cleared) { S.cleared += 1; if (fc) S.fullCombos += 1; if (grade === 'S' || grade === 'S+') S.sRanks += 1; if (grade === 'S+') S.sPlus += 1; } else S.fails += 1;
    if (cleared && s.rescue === 0 && r.opts.rescue) S.comebacks += 1;
    if (r.mode === 'zen') S.zenSeconds += Math.round(s.t);
    const hour = new Date().getHours();
    if (cleared && hour < 4) S.nightSongs += 1;
    /* records */
    const key = bestKey(r.recipe);
    if (r.mode !== 'marathon' && r.mode !== 'bossrush' && r.mode !== 'zen') res.newBest = P.recordBest(p, key, { score: s.score, grade: grade, acc: acc, fc: fc }).newBest;
    if (r.mode === 'story' || r.mode === 'remix') {
      const got = [cleared, cleared && P.gradeRank(grade) >= P.gradeRank('A'), cleared && !p.settings.relaxed && goalMet(st, s, r)];
      res.stars = got;
      const rs = P.recordStage(p, st.id, got, r.mode === 'remix');
      res.newStars = rs.newStars;
      res.crystals += rs.crystals;
      if (rs.first && r.mode === 'story') { S.stages += 1; if (st.boss) S.bosses = P.bossesBeaten(p); }
    }
    if (r.mode === 'free' && cleared && r.recipe.diff === 'expert') S.expertClears += 1;
    if (r.mode === 'daily' && cleared) { S.dailies += 1; const k = SE.dailyRecipe(new Date()).key; p.scores.daily[k] = Math.max(p.scores.daily[k] || 0, s.score); }
    if (r.mode === 'weekly' && cleared) { const k = SE.weeklyRecipe(new Date()).key; p.scores.weekly[k] = Math.max(p.scores.weekly[k] || 0, s.score); }
    if (r.mode === 'marathon') { const n = r.totals.songs; S.marathonBest = Math.max(S.marathonBest, n); P.addScore(p.scores.marathon, { score: s.score, songs: n, day: G.today }, 'score'); res.totals = { songs: n }; }
    if (r.mode === 'bossrush') { if (cleared) S.rushWins += 1; P.addScore(p.scores.rush, { score: s.score, duels: r.totals.songs + (cleared ? 1 : 0), day: G.today }, 'score'); }
    if (cleared && (grade === 'S' || grade === 'S+') && P.stat(p, 'crystalBonus')) { p.crystals += 1; res.crystals += 1; }
    /* pay */
    const mutDiscs = (r.recipe.mutators || []).reduce((a, id) => a * (SE.MUT_BY_ID[id] ? SE.MUT_BY_ID[id].discs : 1), 1);
    const pay = P.payout(p, { mode: r.mode, score: s.score, acc: acc, hits: hits + (r.accHits || 0), cleared: cleared, stars: res.newStars, mutDiscs: mutDiscs,
      double: (r.recipe.boosters || []).indexOf('double') >= 0, speed: r.recipe.speed });
    p.discs += pay.discs;
    res.discs = pay.discs;
    res.xp = pay.xp;
    res.levelUps = P.addXp(p, pay.xp);
    res.tokens = pay.tokens;
    res.tiers = P.addTokens(p, pay.tokens, new Date());
    /* quests */
    const q = (k, n) => { if (n > 0) res.quests = res.quests.concat(P.questProgress(p, k, n)); };
    q('hits', hits); q('perfects', s.counts.perfect); q('combo', s.maxCombo); q('surge', s.surgeUses); q('holds', s.holdsOk); q('phrases', s.phrasesDone); q('pickups', s.pickups);
    if (cleared) { q('songs', 1); if (P.gradeRank(grade) >= P.gradeRank('A')) q('grade', 1); if (r.mode === 'story') q('stage', 1); if (r.mode === 'free') q('free', 1); }
    res.near = nearMiss(res);
    G.result = res;
    NS.app.sweep();
    NS.save.saveProfile(p);
    /* story cinematics after a duel, then the results */
    const show = () => { scr.setScreen('results'); celebrate(res); };
    if (r.mode === 'story' && st.boss && cleared && res.stars && P.starsOf(p, st.id) && !p.seen['won-' + st.world]) {
      p.seen['won-' + st.world] = true;
      let shots = ST.bossWin(st.world, st.boss);
      if (st.world === 4 && !p.seen.finale) { p.seen.finale = true; shots = shots.concat(ST.SHOTS.finale); }
      NS.cine.play(shots, 'win', show);
    } else show();
  }

  /* the nearest next goal: a grade a few points away, or the personal best */
  function nearMiss(res) {
    if (res.failed) return res.boss ? 'The boss had ' + Math.max(1, Math.round(G.run.eng.boss.hp)) + ' health left' : 'Groove ran dry at ' + Math.round(G.run.eng.t / G.run.chart.length * 100) + '% of the song';
    const steps = [['S+', 0.98], ['S', 0.95], ['A', 0.9], ['B', 0.8], ['C', 0.7]];
    for (let i = steps.length - 1; i >= 0; --i) {
      const [g, need] = steps[i];
      if (res.acc < need) {
        const gap = need - res.acc;
        if (gap < 0.03) return Math.max(1, Math.round(gap * 1000) / 10) + '% accuracy from an ' + g + '!';
        break;
      }
    }
    if (res.prevBest && !res.newBest && res.prevBest - res.score < res.prevBest * 0.08) return (res.prevBest - res.score).toLocaleString('en-US') + ' points short of your best!';
    if (res.newBest) return 'New personal best!';
    return '';
  }

  function celebrate(res) {
    if (res.cleared) {
      fx.burst(640, 200, 60, ['#ffd25a', '#ff7ad8', '#5af0ff', '#ffffff'], 'confetti', 420, 260, 7);
      if (res.newBest) sfx('win', { volume: 0.6 });
      if (SZ.GameMusic) SZ.GameMusic.stinger('win');
    } else if (SZ.GameMusic) SZ.GameMusic.stinger('lose');
    for (const l of res.levelUps) scr.toast('Level ' + l.level + '! +' + l.discs + ' discs' + (l.crate ? ' and a Record Crate' : ''), C.UI.xp, 'xp');
    for (const t of res.tiers) scr.toast(G.season.name + ' reward unlocked!', G.season.color, 'gift');
    for (const q of res.quests) scr.toast(q.weekly ? 'Weekly challenge done! +' + q.weekly.reward.crystals + ' crystals and a crate' : q.bonus ? 'All quests done! +' + q.reward + ' crystals' : 'Quest done: +' + q.reward + ' discs', C.UI.good, 'scroll');
  }

  /* ---- saving ---- */
  function autosave(dt) {
    G.autoSaveT += dt;
    if (G.autoSaveT < C.AUTOSAVE) return;
    G.autoSaveT = 0;
    const r = G.run;
    if (r && !r.done && r.mode !== 'demo' && (G.screen === 'game' || G.screen === 'paused')) NS.save.saveRun(r);
  }

  function pauseSong() {
    const r = G.run;
    if (r && r.cond) { CD.pause(r.cond); silence(false); }
  }

  function resumeSong() {
    const r = G.run;
    if (r && r.cond && r.cond.paused) CD.resume(r.cond, 2);
  }

  function quit() {
    const r = G.run;
    if (r && r.cond) CD.stop(r.cond);
    silence(false);
  }

  Object.assign(NS.play, { KINDS_BY_DIFF, chartFor, bestKey, build, start, restart, resumeSaved, press, release, surge, handle, update, goalMet, finishSong, record, nearMiss, autosave, pauseSong, resumeSong, quit, playing });
})();
