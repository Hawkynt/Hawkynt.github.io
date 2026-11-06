/* Long-term progress: lifetime statistics and today's quest counters, toasts, achievements
   (checked twice a second, paying gems and unlocking earned cosmetics), daily quests that pay
   out as they complete, the day's streak gift, festival tokens and the reward track, guardians
   beaten, and settling a finished run - coins, gems, XP and level-ups, stars, story progress,
   bests, ghosts and the high-score table. Owns the toast queue's timing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const rules = NS.rules;
  const { ACHIEVEMENTS, QUEST_BY_ID } = NS.goals;
  const { CHARACTERS, OUTFITS, TRAILS } = NS.cosmetics;
  const { TIERS, SEASONS } = NS.seasons;
  const { sfx } = NS.audio;

  let checkT = 0;

  /* stats key -> today's counter key */
  const DAY = { coins: 'coins', jumps: 'jumps', slides: 'slides', dashes: 'dashes', nears: 'nears', powers: 'powers',
    smashes: 'smashes', gems: 'gems' };

  function toast(text, color, icon) {
    if (G.toasts.length > 5) G.toasts.shift();
    G.toasts.push({ text: text, color: color || '#ffd24a', icon: icon || 'star', t: 0 });
  }

  function count(key, n) {
    const run = G.active || G.run;
    if (!run || run.demo) return;
    const s = G.save.stats;
    s[key] = (s[key] || 0) + n;
    if (key === 'gems') s.gemsRun = (s.gemsRun || 0) + n;
    if (DAY[key]) G.save.day.c[DAY[key]] = (G.save.day.c[DAY[key]] || 0) + n;
  }

  function dayAdd(key, n) {
    G.save.day.c[key] = (G.save.day.c[key] || 0) + n;
  }

  function dayBest(key, v) {
    G.save.day.c[key] = Math.max(G.save.day.c[key] || 0, v);
  }

  function statBest(key, v) {
    G.save.stats[key] = Math.max(G.save.stats[key] || 0, v);
  }

  function grantCosmetics() {
    const save = G.save;
    const fresh = rules.grantEarned(save, 'char', CHARACTERS).concat(rules.grantEarned(save, 'outfit', OUTFITS), rules.grantEarned(save, 'trail', TRAILS));
    for (let i = 0; i < fresh.length; ++i) {
      const parts = fresh[i].split(':');
      const list = parts[0] === 'char' ? CHARACTERS : parts[0] === 'outfit' ? OUTFITS : TRAILS;
      const it = list.find(x => x.id === parts[1]);
      toast('Unlocked ' + (parts[0] === 'char' ? 'runner' : parts[0]) + ': ' + (it ? it.name : parts[1]), '#5ee0ff', 'gift');
    }
  }

  function checkAchievements() {
    const save = G.save;
    let any = false;
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      if (save.ach[a.id] || !a.test(save)) continue;
      save.ach[a.id] = 1;
      save.gems += a.gems;
      toast('Achievement: ' + a.name + '  +' + a.gems + ' gems', '#ffd24a', 'trophy');
      any = true;
    }
    grantCosmetics();
    if (any) sfx('win', { volume: 0.5 });
    return any;
  }

  /* quests pay out as soon as they are done */
  function checkQuests() {
    const save = G.save;
    const qs = save.day.quests || [];
    for (let i = 0; i < qs.length; ++i) {
      const q = qs[i];
      if (q.claimed || rules.questProgress(save, q) < q.n) continue;
      q.done = 1;
      q.claimed = 1;
      const def = QUEST_BY_ID[q.id];
      save.coins += def.reward;
      toast('Quest done: ' + def.text(q.n) + '  +' + def.reward + ' coins', '#7cff9a', 'check');
      sfx('levelup', { volume: 0.5 });
    }
  }

  function tick(dt) {
    checkT -= dt;
    if (checkT <= 0) {
      checkT = 0.5;
      if (G.save) { checkAchievements(); checkQuests(); }
    }
    const q = G.toasts;
    if (q.length) {
      q[0].t += dt;
      if (q[0].t > 3.4) q.shift();
    }
  }

  /* a new local day: streak gift, fresh quests; also the festival bookkeeping */
  function dayStart(date) {
    const save = G.save;
    const d = date || new Date();
    G.season = NS.seasons.seasonFor(d);
    G.eventId = NS.seasons.eventId(d);
    G.weekly = NS.seasons.weeklyMutator(d);
    G.daily = NS.seasons.dailyRecipe(d);
    if (save.season.event !== G.eventId) save.season = { event: G.eventId, tokens: 0, claimed: [] };
    const gift = rules.startDay(save, NS.rng.dayKey(d));
    if (gift) {
      save.coins += gift.bonus;
      toast('Day ' + gift.streak + ' streak: +' + gift.bonus + ' coins', '#ff9ac0', 'heart');
    }
    checkAchievements();
    NS.save.writeSave();
  }

  /* festival tokens from a run; pays the reward tiers newly reached */
  function tokens(n) {
    if (!n || !G.season) return [];
    const save = G.save;
    const reached = rules.addTokens(save, G.eventId, n);
    const sea = G.season;
    for (let i = 0; i < reached.length; ++i) {
      const t = TIERS[reached[i]];
      save.season.claimed.push(reached[i]);
      if (t.kind === 'coins') save.coins += t.amount;
      else if (t.kind === 'gems') save.gems += t.amount;
      else if (t.kind === 'trail') save.owned['trail:' + sea.trail] = 1;
      else if (t.kind === 'outfit') save.owned['outfit:' + sea.outfit] = 1;
      toast(sea.name + ' reward: ' + (t.kind === 'coins' ? t.amount + ' coins' : t.kind === 'gems' ? t.amount + ' gems' :
        t.kind === 'trail' ? 'the ' + sea.trail + ' trail' : 'the ' + sea.outfit + ' outfit'), sea.color, 'gift');
      if (reached[i] === TIERS.length - 1) save.stats.festivals = (save.stats.festivals || 0) + 1;
    }
    return reached;
  }

  function bossBeaten(run, id) {
    if (run.demo) return;
    const first = !G.save.bosses[id];
    G.save.bosses[id] = 1;
    G.save.stats.bosses = (G.save.stats.bosses || 0) + 1;
    if (first) toast('Guardian freed: ' + NS.worlds.BOSS_NAMES[id], '#ffd24a', 'trophy');
  }

  /* the run is over (finished or not): pay out and remember. Returns the summary. */
  function settle(run) {
    const save = G.save;
    const st = G.stats;
    const dist = rules.metres(run.p.x, run.x0);
    const finished = !!run.finished;
    const stage = run.stageId ? NS.worlds.stageById(run.stageId) : null;
    const rw = rules.runRewards({
      mode: run.mode, dist: dist, coins: run.coins, gems: run.gems, score: run.score, finished: finished,
      boss: !!(stage && stage.boss), w: stage ? stage.w : 0, mutCoins: run.mut.coins || 1,
    }, st);
    const sum = { mode: run.mode, dist: dist, score: Math.floor(run.score), coins: rw.coins, bonus: rw.bonus, gems: rw.gems, xp: rw.xp,
      finished: finished, levels: [], stars: 0, prevStars: 0, newBest: false, rank: -1, stageId: run.stageId, why: run.why,
      nears: run.nears, smashes: run.smashes, comboBest: run.comboBest, shards: run.shards, tokens: run.tokens, hits: run.hits };
    save.coins += rw.coins + rw.bonus;
    save.gems += rw.gems;
    const s = save.stats;
    s.runs = (s.runs || 0) + 1;
    s.dist = (s.dist || 0) + dist;
    s.time = (s.time || 0) + run.t;
    statBest('bestRun', dist);
    statBest('comboBest', run.comboBest);
    statBest('scoreBest', Math.floor(run.score));
    dayAdd('dist', dist);
    dayBest('runBest', dist);
    dayBest('combo', run.comboBest);
    if (run.mode === 'zen') s.zenDist = (s.zenDist || 0) + dist;
    if (run.mode === 'arcade' || run.mode === 'weekly') {
      const key = run.mode === 'arcade' ? 'arcadeBest' : 'weeklyBest';
      sum.newBest = dist > (s[key] || 0);
      statBest(key, dist);
      if (run.mode === 'weekly') save.weeklyKey = G.weekly ? G.weekly.id : '';
      sum.rank = rules.addScore(save, { score: Math.floor(run.score), dist: dist, coins: run.coins, mode: run.mode, date: NS.rng.dayKey() });
      save.lastDeathM = dist;
    }
    if (run.mode === 'daily') {
      s.dailyRuns = (s.dailyRuns || 0) + 1;
      dayAdd('daily', 1);
      if (save.daily.key !== G.daily.key) save.daily = { key: G.daily.key, best: 0, plays: 0 };
      ++save.daily.plays;
      sum.newBest = run.score > save.daily.best;
      if (sum.newBest) {
        save.daily.best = Math.floor(run.score);
        if (finished) save.ghosts.daily = { key: G.daily.key, data: run.gRec };
      }
    }
    if (run.mode === 'rush' && finished) s.rushWins = (s.rushWins || 0) + 1;
    if (stage && run.mode === 'story') {
      const stars = rules.starsFor({ finished: finished, boss: !!stage.boss, hits: run.hits, coins: run.coins + run.gems, coinsTotal: run.course.coinsTotal, shards: run.shards });
      sum.prevStars = save.stars[stage.id] || 0;
      sum.stars = stars;
      if (finished) {
        save.cleared[stage.id] = 1;
        dayAdd('stages', 1);
        save.stars[stage.id] = Math.max(sum.prevStars, stars);
        save.shardsGot[stage.id] = (save.shardsGot[stage.id] || 0) | run.shardMask;
        const prev = save.best[stage.id] || 0;
        sum.newBest = run.score > prev;
        if (sum.newBest) {
          save.best[stage.id] = Math.floor(run.score);
          if (!stage.boss) save.ghosts[stage.id] = run.gRec;
        }
      }
    }
    tokens(run.tokens);
    const levels = rules.addXp(save, rw.xp);
    for (let i = 0; i < levels.length; ++i) {
      const lr = rules.levelReward(levels[i]);
      save.coins += lr.coins;
      save.gems += lr.gems;
      sum.levels.push(levels[i]);
      toast('Runner level ' + levels[i] + '!  +' + lr.coins + ' coins' + (lr.gems ? ' +' + lr.gems + ' gems' : ''), '#b48cff', 'up');
    }
    checkAchievements();
    checkQuests();
    NS.save.refreshStats();
    NS.save.writeSave();
    return sum;
  }

  Object.assign(NS.progress, {
    toast, count, dayAdd, dayBest, checkAchievements, checkQuests, tick, dayStart, tokens, bossBeaten, settle, grantCosmetics
  });
})();
