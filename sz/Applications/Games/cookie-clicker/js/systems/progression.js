/* Long-term progression: the achievement snapshot and unlock sweep, the treat's evolution to a
   new era (with its cinematic the first time), era milestones, the daily quests and the
   consecutive-day streak, season tokens with their reward track, and the cosmetics the
   collection unlocks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.economy;
  const { ACHIEVEMENTS } = NS.achievementData;
  const { STAGES, SKINS, PARTICLES, THEMES } = NS.treatData;
  const { TRACK, QUESTS } = NS.eventData;
  const { BY_ID: B_BY_ID } = NS.buildingData;
  const fmt = NS.format;
  const { sfx } = NS.audio;

  function snapshot() {
    const p = G.profile, run = G.run, s = p.stats;
    let total = 0;
    for (const id in run.buildings) total += run.buildings[id];
    let skins = 0;
    for (let i = 0; i < SKINS.length; ++i) if (isUnlocked(SKINS[i])) ++skins;
    let decos = 0;
    for (let m = G.stMain ? G.stMain.decoMask : 0; m; m >>= 1) decos += m & 1;
    return {
      allTime: p.allTime, clicks: s.clicks, cps: G.stMain ? NS.production.cpsOf(run, G.stMain) : 0, buildings: run.buildings,
      totalBuildings: total, totalUpgrades: G.stMain ? G.stMain.agg.count : 0, ascensions: p.ascensions, stageMax: p.stageMax,
      goals: p.goalsDone, golden: s.golden, buffsAtOnce: s.buffsAtOnce, stormBest: s.stormBest, bestCombo: s.bestCombo,
      bakeoffs: s.bakeoffs, bakeBest: s.bakeBest, dailies: s.dailies, zenSeconds: s.zenSeconds, quests: s.quests,
      streak: p.streak.best, offlineReturns: s.offlineReturns, tokens: p.season.tokens, treeLevels: E.treeLevels(p),
      crystals: p.crystals, decos: decos, skins: skins,
    };
  }

  function checkAchievements() {
    const snap = snapshot();
    const p = G.profile;
    let n = 0;
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      if (p.achievements[a.id] || !a.test(snap)) continue;
      p.achievements[a.id] = true;
      ++p.notes;
      ++p.notesEarned;
      if (++n <= 3) NS.screens.toast('Achievement: ' + a.name + ' - ' + a.desc, C.UI.gold, 'trophy');
    }
    if (n) {
      sfx('levelup', { volume: 0.6 });
      NS.production.invalidate();
    }
    return n;
  }

  /* the treat reaches a new era */
  function evolve(run, s) {
    const from = run.stage;
    run.stage = s;
    NS.production.invalidate();
    const p = G.profile;
    const first = run.mode === 'classic' && !p.stagesSeen[s];
    if (run.mode === 'classic') p.stageMax = Math.max(p.stageMax, s);
    if (first) {
      p.stagesSeen[s] = true;
      /* away from the bakery (title, offline catch-up) the cinematic waits for the player */
      if (G.screen === 'game' && !G.ui.offline) NS.cinematics.play('stage', { from: from, to: s });
      else G.pendingCine = { from: G.pendingCine ? G.pendingCine.from : from, to: s };
    } else if (G.screen === 'game') NS.cinematics.quickTransform(from, s);
  }

  /* ---- era milestones ---- */
  function goalProgress(run, g) {
    let have = 0;
    if (g.t === 'clicks') have = run.clicks;
    else if (g.t === 'own') have = run.buildings[g.id] || 0;
    else if (g.t === 'cps') have = G.stMain ? NS.production.cpsOf(run, G.stMain) : 0;
    else if (g.t === 'golden') have = run.golden;
    else if (g.t === 'upgrades') have = G.stMain ? G.stMain.agg.count : 0;
    else if (g.t === 'combo') have = run.bestCombo;
    else if (g.t === 'buildings') for (const id in run.buildings) have += run.buildings[id];
    return { have: have, need: g.n, done: !!run.goals[run.stage + ':' + STAGES[run.stage].goals.indexOf(g)] || have >= g.n };
  }

  function goalText(g) {
    if (g.t === 'clicks') return 'Click the treat ' + g.n + ' times';
    if (g.t === 'own') return 'Own ' + g.n + ' ' + (g.n > 1 ? B_BY_ID[g.id].plural : B_BY_ID[g.id].name);
    if (g.t === 'cps') return 'Bake ' + fmt.short(g.n) + ' per second';
    if (g.t === 'golden') return 'Catch ' + g.n + ' golden treat' + (g.n > 1 ? 's' : '');
    if (g.t === 'upgrades') return 'Own ' + g.n + ' upgrades';
    if (g.t === 'combo') return 'Reach a combo of ' + g.n;
    return 'Own ' + g.n + ' producers';
  }

  function checkGoals() {
    const run = G.run;
    const goals = STAGES[run.stage].goals;
    for (let i = 0; i < goals.length; ++i) {
      const key = run.stage + ':' + i;
      if (run.goals[key]) continue;
      if (goalProgress(run, goals[i]).have >= goals[i].n) {
        run.goals[key] = true;
        ++G.profile.goalsDone;
        G.profile.notes += 2;
        G.profile.notesEarned += 2;
        NS.screens.toast('Era milestone: ' + goalText(goals[i]) + ' (+2 recipe notes)', C.UI.notes, 'scroll');
        sfx('pickup');
      }
    }
  }

  /* ---- daily quests and streak ---- */
  function newDay() {
    const p = G.profile;
    if (NS.calendar.touchStreak(p.streak, G.today) && p.streak.count > 1)
      NS.screens.toast('Day ' + p.streak.count + ' in a row! +' + Math.round(NS.calendar.streakBonus(p.streak.count) * 100) + '% production today', C.UI.good, 'calendar');
    if (!p.daily || p.daily.day !== G.today) {
      const qs = NS.calendar.rollQuests(G.today);
      const cps = G.stMain ? G.stMain.cps : 0;
      for (let i = 0; i < qs.length; ++i)
        qs[i].target = qs[i].id === 'bake' ? Math.max(1000, Math.round(cps * 60 * qs[i].n)) : qs[i].n;
      p.daily = { day: G.today, quests: qs, bonus: false };
    }
    NS.production.invalidate();
  }

  function questText(q) {
    const tpl = QUESTS.find(t => t.id === q.id);
    return tpl.text.replace('{n}', q.id === 'bake' ? q.n : fmt.group(q.n));
  }

  function quest(kind, amount, isMax) {
    const d = G.profile.daily;
    if (!d) return;
    for (let i = 0; i < d.quests.length; ++i) {
      const q = d.quests[i];
      if (q.done || q.id !== kind) continue;
      q.progress = isMax ? Math.max(q.progress, amount) : q.progress + amount;
      if (q.progress >= q.target) {
        q.done = true;
        const gain = Math.round(q.reward * (1 + E.treeStat(G.profile, 'questGain')));
        G.profile.notes += gain;
        G.profile.notesEarned += gain;
        ++G.profile.stats.quests;
        NS.screens.toast('Quest done: ' + questText(q) + ' (+' + gain + ' notes)', C.UI.notes, 'scroll');
        sfx('win', { volume: 0.5 });
      }
    }
    if (!d.bonus && d.quests.every(q => q.done)) {
      d.bonus = true;
      G.profile.notes += 3;
      G.profile.notesEarned += 3;
      NS.screens.toast('All daily quests done! +3 bonus notes', C.UI.gold, 'trophy');
    }
  }

  /* ---- seasons ---- */
  function addToken(n, x, y) {
    const p = G.profile;
    n *= 1 + E.treeStat(p, 'seasonTokens');
    const se = G.season;
    p.season.tokens[se] = (p.season.tokens[se] || 0) + n;
    NS.fx.text(x, y + 30, '+' + n + ' ' + NS.eventData.CARRIERS[se].token, '#ffffff', 18, 1.6);
    const have = p.season.tokens[se];
    let claimed = p.season.claimed[se] || 0;
    while (claimed < TRACK.length && have >= TRACK[claimed].need) {
      const step = TRACK[claimed];
      if (step.notes) {
        p.notes += step.notes;
        p.notesEarned += step.notes;
        NS.screens.toast('Season reward: +' + step.notes + ' recipe notes', C.UI.notes, 'leaf');
      }
      if (step.skin) {
        p.unlocked['season-skin-' + se] = true;
        NS.screens.toast('Season reward: a new treat skin!', C.UI.gold, 'palette');
      }
      if (step.particle) {
        p.unlocked['season-particle-' + se] = true;
        NS.screens.toast('Season reward: a new click style!', C.UI.gold, 'palette');
      }
      ++claimed;
    }
    p.season.claimed[se] = claimed;
  }

  /* ---- cosmetics ---- */
  function isUnlocked(item, kind) {
    const u = item.unlock, p = G.profile;
    if (u.k === 'default') return true;
    if (u.k === 'stage') return p.stageMax >= u.n;
    if (u.k === 'ach') return E.achievementCount(p) >= u.n;
    if (u.k === 'golden') return p.stats.golden >= u.n;
    if (u.k === 'crystal') return p.ascensions >= u.n;
    if (u.k === 'bake') return p.stats.bakeBest >= u.n;
    if (u.k === 'season') return !!p.unlocked['season-' + (kind || 'skin') + '-' + u.id];
    return false;
  }

  function unlockText(item) {
    const u = item.unlock;
    if (u.k === 'stage') return 'Reach the ' + STAGES[u.n].name;
    if (u.k === 'ach') return 'Earn ' + u.n + ' achievements';
    if (u.k === 'golden') return 'Catch ' + u.n + ' golden treats';
    if (u.k === 'crystal') return 'Ascend ' + u.n + ' time' + (u.n > 1 ? 's' : '');
    if (u.k === 'bake') return 'Score ' + fmt.short(u.n) + ' in a Bake-Off';
    if (u.k === 'season') return NS.calendar.SEASON_NAMES[u.id] + ' season reward';
    return '';
  }

  /* toasts cosmetics the first time they become available */
  function checkUnlocks() {
    const p = G.profile;
    const lists = [[SKINS, 'skin', 'treat skin'], [PARTICLES, 'particle', 'click style'], [THEMES, 'theme', 'kitchen theme']];
    for (let l = 0; l < lists.length; ++l)
      for (let i = 0; i < lists[l][0].length; ++i) {
        const it = lists[l][0][i];
        const key = 'seen-' + lists[l][1] + '-' + it.id;
        if (p.unlocked[key] || !isUnlocked(it, lists[l][1])) continue;
        p.unlocked[key] = true;
        if (it.unlock.k !== 'default') NS.screens.toast('New ' + lists[l][2] + ': ' + it.name + ' (see Collection)', '#ff9ac8', 'palette');
      }
  }

  /* once a second */
  function sweep(dt) {
    const run = G.run;
    if (G.profile.daily && G.stMain) quest('bake', NS.production.cpsOf(run, G.stMain) * dt);
    checkGoals();
    checkAchievements();
    checkUnlocks();
  }

  Object.assign(NS.progression, { snapshot, checkAchievements, evolve, goalProgress, goalText, checkGoals, newDay, questText, quest,
    addToken, isUnlocked, unlockText, checkUnlocks, sweep });
})();
