/* The other ways to play: the three-minute Bake-Off (a fresh bakery at twelve-fold speed,
   scored by what it bakes, with a top-ten table and recipe-note rewards), the Daily Bake-Off
   with the date's modifier and one best score per day, and the Zen Kitchen - no numbers, no
   clock, just the treat of any era, soft chimes and sprinkles. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const E = NS.economy;
  const C = NS.constants;
  const { sfx, chime, setScale } = NS.audio;

  function startBake(daily) {
    const mods = daily ? NS.calendar.dailyModifier(G.today) : null;
    G.bake = E.newRun(daily ? 'daily' : 'bake', null, mods);
    G.bake.day = daily ? G.today : '';
    G.bake.goldenTimer = 12;
    NS.golden.clearAll();
    NS.fx.clear();
    NS.production.invalidate();
    NS.production.refresh(true);
    G.ui.displayCookies = 0;
    G.ui.storeScroll = 0;
    NS.screens.setScreen('game');
    NS.cinematics.play('bakeStart', { daily: daily, mods: mods });
  }

  function rewardFor(score) {
    return Math.max(1, Math.floor(Math.log10(score + 1))) ;
  }

  function finishBake() {
    const b = G.bake;
    if (!b) return;
    const p = G.profile;
    const score = Math.floor(b.baked);
    const daily = b.mode === 'daily';
    const prevBest = p.stats.bakeBest;
    p.bakeScores.push({ score: score, day: G.today, mode: b.mode, mod: b.mods ? b.mods.name : '' });
    p.bakeScores.sort((x, y) => y.score - x.score);
    p.bakeScores.length = Math.min(p.bakeScores.length, 10);
    const rank = p.bakeScores.findIndex(e => e.score === score && e.day === G.today) + 1;
    ++p.stats.bakeoffs;
    if (daily) {
      ++p.stats.dailies;
      p.dailyBest[G.today] = Math.max(p.dailyBest[G.today] || 0, score);
    }
    p.stats.bakeBest = Math.max(prevBest, score);
    let notes = Math.round(rewardFor(score) * (1 + E.treeStat(p, 'questGain')));
    if (score > prevBest) notes += 3;
    p.notes += notes;
    p.notesEarned += notes;
    G.ui.bakeResult = { score: score, rank: rank, best: score > prevBest, notes: notes, daily: daily, mod: b.mods,
      stage: b.stage, golden: b.golden, combo: Math.floor(b.bestCombo), clicks: b.clicks };
    G.bake = null;
    NS.golden.clearAll();
    NS.production.invalidate();
    NS.production.refresh(true);
    G.ui.displayCookies = G.run.cookies;
    NS.progression.quest('bakeoff', 1);
    sfx(rank === 1 ? 'win' : 'levelup');
    NS.screens.setScreen('bakeResult');
    NS.save.write(G);
  }

  function quitBake() {
    G.bake = null;
    NS.golden.clearAll();
    NS.production.invalidate();
    NS.production.refresh(true);
    G.ui.displayCookies = G.run.cookies;
    NS.screens.setScreen('title');
  }

  /* ---- zen kitchen ---- */
  let chimeT = 2, note = 0;

  function enterZen() {
    G.ui.zenStage = G.profile.stageMax;
    G.ui.zenSkin = G.profile.skin;
    G.ui.zenT = 0;
    setScale(0.45);
    NS.fx.clear();
    NS.screens.setScreen('zen');
  }

  function leaveZen() {
    setScale(1);
    NS.screens.setScreen('title');
  }

  function zenTick(dt) {
    G.ui.zenT += dt;
    G.profile.stats.zenSeconds += dt;
    chimeT -= dt;
    if (chimeT <= 0) {
      chimeT = 2.2 + Math.random() * 2.6;
      note = (note + 1 + Math.floor(Math.random() * 3)) % 9;
      chime(note, 0.12);
    }
    if (Math.random() < dt * 5) {
      const x = Math.random() * C.VIEW_W;
      NS.fx.spawn(x, C.VIEW_H + 10, (Math.random() - 0.5) * 20, -40 - Math.random() * 40, 6, 3 + Math.random() * 4,
        Math.random() < 0.5 ? '#ffe8c0' : '#ffc0e0', 'spark', -4);
    }
  }

  function zenClick(x, y) {
    const st = NS.clicking.STYLE_COLORS[G.profile.particle] || NS.clicking.STYLE_COLORS.crumbs;
    NS.fx.burst(x, y, 14, st, G.profile.particle, 200, 120);
    NS.fx.ring(x, y, 6, 90, 0.9, 'rgba(255,240,220,0.8)', 2);
    G.treatSquashV -= 4;
    chime(Math.floor((1 - y / C.VIEW_H) * 6 + x / C.VIEW_W * 3), 0.2);
  }

  Object.assign(NS.modes, { startBake, rewardFor, finishBake, quitBake, enterZen, leaveZen, zenTick, zenClick });
})();
