/* Progress and rewards: score with combo multiplier and Score x2, combo milestones, overdrive
   charge, stardust banking, lifetime statistics and daily quest progress, seasonal tokens and
   event-track tiers, ships lost and game over, titans felled, level and wave completion with
   story stars, high scores, the play streak, achievements and earned cosmetics. Writes G.save
   and the results shown afterwards. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const C = NS.constants;
  const rules = NS.rules;
  const S = NS.seasons;
  const { CHAPTERS, levelKey } = NS.campaign;
  const { BOSSES, BOSS_ORDER } = NS.enemyData;
  const { QUESTS } = NS.goalData;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  function toast(text, color) {
    if (NS.screens.toast) NS.screens.toast(text, color);
  }

  function quest(stat, n, peak) {
    const qs = G.save.daily.quests;
    for (let i = 0; i < qs.length; ++i) {
      const q = qs[i];
      const def = QUESTS.find(d => d.id === q.id);
      if (!def || def.stat !== stat || q.done) continue;
      q.p = peak ? Math.max(q.p, n) : q.p + n;
      if (q.p >= q.goal) {
        q.p = q.goal;
        q.done = true;
        q.claimed = true;
        G.save.dust += q.dust;
        toast('Daily quest done: ' + def.text.replace('{n}', q.goal) + '  +' + q.dust + ' stardust', '#6dff9a');
        sfx('win', { volume: 0.5 });
      }
    }
  }

  function count(stat, n) {
    if (!G.run) return;
    G.save.stats[stat] = (G.save.stats[stat] || 0) + n;
    quest(stat, n, false);
  }

  function peak(stat, v) {
    quest(stat, v, true);
  }

  function dust(v) {
    const run = G.run;
    if (!run) return;
    const amount = v * G.stats.dust * (run.mode === 'zen' ? 0.6 : 1) * (run.mode === 'story' && run.chapter === G.cal.featured.chapter ? 1.5 : 1);
    run.dustFrac = (run.dustFrac || 0) + amount;
    const whole = Math.floor(run.dustFrac);
    if (whole <= 0) return;
    run.dustFrac -= whole;
    G.save.dust += whole;
    run.runDust += whole;
    run.levelDust += whole;
    count('dustEarned', whole);
  }

  function kill(x, y, pts, col) {
    const run = G.run;
    if (!run) return;
    ++run.kills;
    ++G.combo;
    G.comboT = G.stats.combo;
    if (G.combo > G.bestCombo) G.bestCombo = G.combo;
    if (G.combo > G.save.stats.bestCombo) G.save.stats.bestCombo = G.combo;
    peak('comboPeak', G.combo);
    const mult = rules.comboMult(G.combo) * (G.ship && G.ship.power.double ? 2 : 1);
    const gain = Math.round(pts * mult);
    G.score += gain;
    fx.text(x, y - 8, String(gain), mult > 1 ? (mult >= 4 ? '#ff8ad0' : '#ffd25a') : (col || '#ffffff'), gain >= 1000 ? 20 : 14, 0.8);
    G.overdrive = Math.min(1, G.overdrive + C.OVERDRIVE_PER_KILL * G.stats.odRate);
    if (G.combo % 10 === 0) {
      fx.text(G.ship ? G.ship.x : x, (G.ship ? G.ship.y : y) - 46, 'COMBO ' + G.combo + '!', '#ff8ad0', 22 + Math.min(14, G.combo / 5), 1.2);
      sfx('levelup', { pitch: 1 + Math.min(1, G.combo / 100), volume: 0.4 });
    }
    if (run.mode === 'arcade' || run.mode === 'daily') extraLife();
  }

  /* arcade: an extra ship every 10,000 points */
  function extraLife() {
    const run = G.run;
    const next = ((run.lifeAt || 0) + 1) * 10000;
    if (G.score >= next) {
      run.lifeAt = (run.lifeAt || 0) + 1;
      if (run.mode === 'arcade') {
        run.lives = Math.min(9, run.lives + 1);
        if (G.ship) fx.text(G.ship.x, G.ship.y - 50, 'EXTRA SHIP', '#6dff9a', 20, 1.4);
        sfx('levelup');
      }
    }
  }

  function comboTick(dt) {
    if (G.combo > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) G.combo = 0;
    }
  }

  function objective(n) {
    if (G.run) G.run.progress += n;
  }

  function token(n) {
    const e = NS.save.seasonEntry();
    e.tokens += n;
    count('tokens', n);
    const tier = S.tierFor(e.tokens);
    while (e.claimed < tier) {
      ++e.claimed;
      const rw = S.trackReward(G.cal.season, e.claimed);
      grantReward(rw);
      toast(G.cal.seasonDef.name + ' tier ' + e.claimed + ': ' + rewardText(rw), G.cal.seasonDef.accent);
      sfx('win', { volume: 0.6 });
    }
  }

  function grantReward(rw) {
    if (rw.dust) G.save.dust += rw.dust;
    if (rw.kind === 'skin' || rw.kind === 'trail' || rw.kind === 'shot') rules.grant(G.save, rw.kind, rw.id);
    if (rw.kind === 'badge' && G.save.badges.indexOf(G.cal.seasonKey) < 0) G.save.badges.push(G.cal.seasonKey);
  }

  function rewardText(rw) {
    switch (rw.kind) {
      case 'dust': return rw.dust + ' stardust';
      case 'skin': return 'ship skin ' + rw.name;
      case 'trail': return 'trail ' + rw.name;
      case 'shot': return 'shot colour ' + rw.name;
      case 'badge': return rw.name + ' badge, ' + rw.dust + ' stardust';
    }
    return '';
  }

  function zenTick(dt) {
    G.save.stats.zenTime += dt;
    G.run.zenMin = (G.run.zenMin || 0) + dt;
    if (G.run.zenMin >= 60) {
      G.run.zenMin -= 60;
      quest('zenMinutes', 1, false);
    }
  }

  /* a run begins: streak, run count, the daily flag */
  function runStart() {
    const sv = G.save;
    NS.save.refreshCalendar();
    const bonus = S.touchStreak(sv.streak, G.cal.day);
    if (bonus) {
      sv.dust += bonus;
      toast('Day ' + sv.streak.count + ' streak bonus  +' + bonus + ' stardust', '#ffb04a');
    }
    count('runs', 1);
    if (G.run.mode === 'daily') {
      sv.daily.played = true;
      count('dailies', 1);
    }
    G.run.newAch = [];
  }

  function shipLost() {
    const run = G.run;
    if (!run) return;
    count('deaths', 1);
    ++run.lost;
    --run.lives;
    if (run.lives <= 0) {
      run.lives = 0;
      run.overT = 2.2;
    }
  }

  /* the game-over countdown after the last ship */
  function tick(dt) {
    const run = G.run;
    if (!run) return;
    G.save.stats.playTime += dt;
    comboTick(dt);
    if (run.overT > 0) {
      run.overT -= dt;
      if (run.overT <= 0) runOver(false);
    }
    run.goalT = (run.goalT || 0) - dt;
    if (run.goalT <= 0) {
      run.goalT = 1;
      checkGoals();
    }
  }

  function bossDown(b) {
    const D = BOSSES[b.kind];
    G.score += D.score;
    fx.text(b.x, b.y, '+' + D.score, '#ffd25a', 30, 2);
    NS.powerups.motes(b.x, b.y, D.dust, D.pal[3]);
    count('bosses', 1);
    G.save.bossKinds[b.kind] = true;
    const run = G.run;
    if (run.mode === 'story' || run.mode === 'rush') NS.waves.finish();
  }

  /* the current level or wave is complete */
  function levelDone() {
    const run = G.run;
    switch (run.mode) {
      case 'arcade':
      case 'daily':
        if (run.wave > G.save.stats.arcadeWave && run.mode === 'arcade') G.save.stats.arcadeWave = run.wave;
        NS.waves.startLevel(true);
        NS.snapshot.autosave(true);
        return;
      case 'rush':
        if (run.rushIdx < BOSS_ORDER.length - 1) {
          ++run.rushIdx;
          NS.waves.startLevel(true);
          NS.snapshot.autosave(true);
          return;
        }
        runOver(true);
        return;
      case 'story':
        storyDone();
        return;
    }
  }

  function storyDone() {
    const run = G.run, sv = G.save;
    const L = G.level;
    const key = levelKey(run.chapter, run.level);
    const stars = rules.starsFor(L, { lost: run.lost, time: run.time });
    const before = sv.stars[key] || 0;
    const first = !before;
    if (stars > before) sv.stars[key] = stars;
    if (!sv.bestTimes[key] || run.time < sv.bestTimes[key]) sv.bestTimes[key] = Math.round(run.time * 10) / 10;
    const reward = rules.levelDust(run.chapter, stars, first);
    sv.dust += reward;
    count('dustEarned', reward);
    count('levels', 1);
    if (run.lost === 0) count('flawless', 1);
    checkGoals();
    const last = run.level === CHAPTERS[run.chapter].levels.length - 1;
    results({ win: true, stars: stars, before: before, reward: reward, first: first, chapterEnd: last && first });
  }

  function runOver(win) {
    const run = G.run;
    if (!run || run.results) return;
    const sv = G.save;
    let rank = -1, best = 0, newBest = false;
    if (run.mode === 'arcade') {
      rank = rules.addHighScore(sv, { score: G.score, wave: run.wave, mode: 'arcade', date: G.cal.day });
      newBest = G.score > sv.best.arcade;
      sv.best.arcade = Math.max(sv.best.arcade, G.score);
      sv.stats.arcadeBest = Math.max(sv.stats.arcadeBest, G.score);
      peak('arcadePeak', G.score);
      best = sv.best.arcade;
    } else if (run.mode === 'daily') {
      if (sv.best.daily.key !== G.cal.day) sv.best.daily = { key: G.cal.day, score: 0 };
      newBest = G.score > sv.best.daily.score;
      sv.best.daily.score = Math.max(sv.best.daily.score, G.score);
      best = sv.best.daily.score;
      rank = rules.addHighScore(sv, { score: G.score, wave: run.wave, mode: 'daily', date: G.cal.day });
    } else if (run.mode === 'rush') {
      const bonus = win ? 3000 : 0;
      G.score += bonus;
      newBest = G.score > sv.best.rush;
      sv.best.rush = Math.max(sv.best.rush, G.score);
      best = sv.best.rush;
      if (win) { sv.dust += 600; count('dustEarned', 600); }
    } else if (run.mode === 'zen') {
      sv.best.zen = Math.max(sv.best.zen, G.score);
      best = sv.best.zen;
    }
    checkGoals();
    results({ win: !!win, rank: rank, best: best, newBest: newBest, over: true });
  }

  function results(extra) {
    const run = G.run;
    run.results = true;
    G.ui.results = Object.assign({
      mode: run.mode, chapter: run.chapter, level: run.level, wave: run.wave, score: G.score, time: run.time, kills: run.kills,
      bestCombo: G.bestCombo, dust: run.runDust, lost: run.lost, ach: (run.newAch || []).slice(), t: 0,
    }, extra);
    NS.snapshot.clear();
    NS.save.writeSave();
    sfx(extra.win ? 'win' : 'lose', { volume: 0.7 });
    if (NS.screens.setScreen) NS.screens.setScreen('results');
  }

  /* achievements and story/achievement cosmetics; pays their rewards */
  function checkGoals() {
    const sv = G.save;
    const got = rules.newAchievements(sv);
    for (let i = 0; i < got.length; ++i) {
      sv.dust += got[i].dust;
      if (G.run && G.run.newAch) G.run.newAch.push(got[i].id);
      toast('Achievement: ' + got[i].name + '  +' + got[i].dust + ' stardust', '#ffd25a');
      sfx('win', { volume: 0.5, pitch: 1.2 });
    }
    const cos = rules.earnedCosmetics(sv);
    for (let i = 0; i < cos.length; ++i) toast('Unlocked ' + cos[i].kind + ': ' + cos[i].item.name, '#c08aff');
    if (got.length || cos.length) NS.save.writeSave();
  }

  Object.assign(NS.progress, {
    count, peak, dust, kill, comboTick, objective, token, grantReward, rewardText, zenTick, runStart, shipLost, tick,
    bossDown, levelDone, runOver, checkGoals, quest
  });
})();
