;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Long-term goals: lifetime stats, the three daily quests and the weekly challenge, the
     day streak, the seasonal token track and the achievements. Every reward is paid at
     once and announced with a toast. Writes G.save (stats, daily, weekly, streak, season,
     achievements, coins, wardrobe) and G.toasts. */

  const { ACHIEVEMENTS, BIRD_DEFS, HATS, TRAILS } = NS.C;
  const { sfx } = NS.services;
  const G = NS.state;
  const Save = NS.save;
  const Prog = NS.progress;
  const S = SZ.FlappySeasons;

  function toast(title, text, color) {
    if (G.toasts.length > 6)
      G.toasts.shift();
    G.toasts.push({ title: title, text: text || '', color: color || '#ffd75a', t: 0 });
  }

  function today() {
    return new Date();
  }

  /* new day, new week, new season: reset what belongs to the old one */
  function rollover() {
    const now = today();
    const key = SZ.FlappyCourse.dateKey(now);
    const s = G.save;
    if (s.daily.date !== key) {
      s.daily = { date: key, progress: {}, claimed: [false, false, false], bonus: false };
    }
    const wk = S.weekKey(now);
    if (s.weekly.week !== wk)
      s.weekly = { week: wk, progress: 0, claimed: false };
    G.season = S.current(now);
    G.twist = S.dailyTwist(now);
    if (s.season.key !== G.season.key)
      s.season = { key: G.season.key, tokens: 0, claimed: 0 };
  }

  /* called when a run starts: the first run of a day extends or restarts the streak */
  function touchStreak() {
    const key = SZ.FlappyCourse.dateKey(today());
    const st = G.save.streak;
    if (st.last === key)
      return 0;
    const diff = st.last ? S.dayDiff(st.last, key) : 99;
    st.count = diff === 1 ? st.count + 1 : 1;
    st.last = key;
    st.best = Math.max(st.best, st.count);
    const reward = Math.round(Math.min(7, st.count) * 40 * (1 + 0.5 * Prog.treeLevel('f_streak')));
    G.save.coins += reward;
    toast(st.count > 1 ? 'Day streak ' + st.count + '!' : 'Welcome back!', '+' + reward + ' coins', '#ff9a3a');
    sfx('levelup', { volume: 0.6 });
    check();
    return reward;
  }

  function questList() {
    return S.dailyQuests(today());
  }

  function questProgress(q) {
    return Math.min(q.need, G.save.daily.progress[q.stat] || 0);
  }

  function weekly() {
    return S.weeklyChallenge(today());
  }

  function claimQuests() {
    const quests = questList();
    const d = G.save.daily;
    let done = 0;
    for (let i = 0; i < quests.length; ++i) {
      const q = quests[i];
      if (!d.claimed[i] && questProgress(q) >= q.need) {
        d.claimed[i] = true;
        const pay = Math.round(q.reward * (1 + 0.25 * Prog.treeLevel('f_quest')));
        G.save.coins += pay;
        toast('Quest complete', q.text + '  +' + pay, '#6fe08a');
        sfx('win', { volume: 0.5 });
      }
      if (d.claimed[i])
        ++done;
    }
    if (done === quests.length && !d.bonus) {
      d.bonus = true;
      G.save.coins += 200;
      toast('All daily quests done!', 'Bonus +200 coins', '#6fe08a');
    }
    const w = weekly();
    if (!G.save.weekly.claimed && G.save.weekly.progress >= w.need) {
      G.save.weekly.claimed = true;
      G.save.coins += w.reward;
      toast('Weekly challenge complete!', w.text + '  +' + w.reward, '#5ab8ff');
      sfx('win', { volume: 0.6 });
    }
  }

  /* add to a lifetime stat and to the quest/week progress that counts it */
  function bump(stat, n) {
    if (!n)
      return;
    G.save.stats[stat] = (G.save.stats[stat] || 0) + n;
    G.save.daily.progress[stat] = (G.save.daily.progress[stat] || 0) + n;
    if (weekly().stat === stat)
      G.save.weekly.progress += n;
    claimQuests();
  }

  /* a best-of stat (combo, arcade score): keeps the maximum */
  function best(stat, v) {
    if (v > (G.save.stats[stat] || 0))
      G.save.stats[stat] = v;
    if (v > (G.save.daily.progress[stat] || 0))
      G.save.daily.progress[stat] = v;
    claimQuests();
  }

  /* ── Seasonal token track ── */

  function addTokens(n) {
    const s = G.save.season;
    s.tokens += n;
    bump('tokens', n);
    const ev = G.season.event;
    const tier = S.trackTier(s.tokens);
    if (tier >= 1 && Prog.grant('themes', ev.id))
      toast('Theme kept: ' + ev.name, 'Wear it all year in the Wardrobe', ev.accent);
    while (s.claimed < tier) {
      const t = S.TRACK[s.claimed];
      ++s.claimed;
      if (t.coins)
        G.save.coins += t.coins;
      if (t.reward) {
        const kind = t.reward === 'bird' ? 'birds' : t.reward === 'hat' ? 'hats' : 'trails';
        const id = ev.rewards[t.reward];
        Prog.grant(kind, id);
        toast(ev.name + ' reward!', 'Unlocked ' + Prog.itemName(kind, id), ev.accent);
      } else {
        toast(ev.name + ' tier ' + s.claimed, '+' + t.coins + ' coins', ev.accent);
      }
      if (t.badge) {
        if (G.save.badges.indexOf(s.key) < 0)
          G.save.badges.push(s.key);
        G.save.stats.seasonMax = 1;
      }
      sfx('levelup', { volume: 0.6 });
    }
    check();
  }

  /* ── Achievements and the unlocks they carry ── */

  function grantUnlocks() {
    let n = 0;
    const lists = [['birds', BIRD_DEFS], ['hats', HATS], ['trails', TRAILS]];
    for (const pair of lists) {
      for (const def of pair[1]) {
        if (!def.unlock || Prog.owns(pair[0], def.id))
          continue;
        const u = def.unlock;
        if ((u.stage && (G.save.stars[u.stage] || 0) >= 1) || (u.ach && G.save.achievements[u.ach])) {
          Prog.grant(pair[0], def.id);
          toast('New in the wardrobe', Prog.itemName(pair[0], def.id), '#c08aff');
          ++n;
        }
      }
    }
    return n;
  }

  function check() {
    let any = false;
    for (const a of ACHIEVEMENTS) {
      if (G.save.achievements[a.id])
        continue;
      if (a.v(G.save) >= a.n) {
        G.save.achievements[a.id] = true;
        G.save.coins += a.coins;
        toast('Achievement: ' + a.name, a.desc + '  +' + a.coins, '#ffd75a');
        sfx('levelup', { volume: 0.5, pitch: 1.2 });
        any = true;
      }
    }
    if (grantUnlocks() > 0)
      any = true;
    if (any) {
      check();
      Save.writeSave();
    }
    return any;
  }

  function achievementCount() {
    let n = 0;
    for (const a of ACHIEVEMENTS)
      if (G.save.achievements[a.id])
        ++n;
    return n;
  }

  function updateToasts(dt) {
    if (G.toasts.length) {
      G.toasts[0].t += dt;
      if (G.toasts[0].t > 2.8)
        G.toasts.shift();
    }
  }

  Object.assign(NS.goals, {
    toast, rollover, touchStreak, questList, questProgress, weekly, claimQuests, bump, best, addTokens, check,
    grantUnlocks, achievementCount, updateToasts
  });
})();
