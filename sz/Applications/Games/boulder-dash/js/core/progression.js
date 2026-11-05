/* Progression rules as pure functions over a save object: the default save and the migration of
   older saves and of the first version's high scores, tech tree perks and purchases, unlock
   checks, gold, stats, achievements, daily quests and streaks, seasons and their event track,
   story stars and the daily cave seed. No DOM, no storage. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const R = NS.rng;
  const M = NS.meta;
  const I = NS.items;

  const SAVE_VERSION = 2;
  const STAT_KEYS = ['gems', 'caves', 'crushes', 'butterflies', 'bosses', 'chapters', 'bestCombo', 'bestArcade',
    'dailies', 'zenTime', 'bombs', 'bestChain', 'bestStreak', 'powerups', 'pushes', 'dug', 'tokens', 'perfects',
    'bestTimeGems', 'kills', 'deaths', 'bricks', 'playTime', 'runs', 'bigGems'];

  function defaultSave() {
    const stats = {};
    for (let i = 0; i < STAT_KEYS.length; ++i) stats[STAT_KEYS[i]] = 0;
    return {
      v: SAVE_VERSION,
      gold: 0,
      tree: {},
      skin: 'classic',
      trail: 'dust',
      tileset: 'auto',
      bought: {},                 /* gold-bought cosmetics */
      seasonUnlocks: {},          /* cosmetics won on event tracks */
      story: { stars: {}, best: {}, cine: {} },
      high: { arcade: [], time: [], daily: {} },
      stats,
      ach: {},
      quests: { date: '', list: [] },
      streak: { last: '', count: 0 },
      season: { key: '', tokens: 0, claimed: [] },
      seenHelp: false,
      migrated: true
    };
  }

  /* Fills gaps in a stored save and folds in the first version's top-5 list and tutorial flag */
  function migrateSave(stored, oldScores, oldTutorialSeen) {
    const base = defaultSave();
    const s = stored && typeof stored === 'object' ? stored : {};
    const out = Object.assign(base, s);
    out.stats = Object.assign(defaultSave().stats, s.stats || {});
    out.story = Object.assign({ stars: {}, best: {}, cine: {} }, s.story || {});
    out.high = Object.assign({ arcade: [], time: [], daily: {} }, s.high || {});
    out.quests = Object.assign({ date: '', list: [] }, s.quests || {});
    out.streak = Object.assign({ last: '', count: 0 }, s.streak || {});
    out.season = Object.assign({ key: '', tokens: 0, claimed: [] }, s.season || {});
    out.tree = Object.assign({}, s.tree || {});
    out.ach = Object.assign({}, s.ach || {});
    out.bought = Object.assign({}, s.bought || {});
    out.seasonUnlocks = Object.assign({}, s.seasonUnlocks || {});
    if (Array.isArray(oldScores)) {
      for (let i = 0; i < oldScores.length; ++i) {
        const o = oldScores[i];
        if (o && typeof o.score === 'number')
          addHighScore(out.high.arcade, { score: o.score, level: o.level || 1, date: o.date || 0, legacy: true });
      }
    }
    if (oldTutorialSeen) out.seenHelp = true;
    out.v = SAVE_VERSION;
    out.migrated = true;
    return out;
  }

  function addHighScore(list, entry, max) {
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    if (list.length > (max || C.MAX_HIGH_SCORES)) list.length = max || C.MAX_HIGH_SCORES;
    return list.indexOf(entry);
  }

  /* ── Tech tree ── */
  function node(id) {
    for (let i = 0; i < M.TREE.length; ++i)
      if (M.TREE[i].id === id) return M.TREE[i];
    return null;
  }

  function perks(save) {
    const p = {
      startShield: 0, lives: 0, shieldMax: 1, escape: 0, grit: 0, gemValue: 0, goldGain: 0, comboWindow: 0,
      magnetRadius: 0, extraPowerups: 0, startBombs: 0, fuse: 0, drillDur: 0, blast: 0, chainBonus: 0,
      timeBonus: 0, slowDur: 0, freezeDur: 0, powerDur: 0, bootsDur: 0, light: 0, scout: 0, gemSense: 0,
      tokens: 0, zenGold: 0
    };
    for (let i = 0; i < M.TREE.length; ++i) {
      const n = M.TREE[i];
      const lv = Math.min(n.max, save.tree[n.id] | 0);
      if (lv) p[n.effect] += lv * n.per;
    }
    return p;
  }

  function nodeCost(n, level) {
    return level < n.max ? n.cost[level] : 0;
  }

  /* why a node can not be bought right now ('' when it can) */
  function buyBlocker(save, id) {
    const n = node(id);
    if (!n) return 'unknown';
    const lv = save.tree[id] | 0;
    if (lv >= n.max) return 'maxed';
    const reqs = n.req || [];
    for (let i = 0; i < reqs.length; ++i)
      if (!(save.tree[reqs[i]] | 0)) return 'locked';
    if (save.gold < nodeCost(n, lv)) return 'gold';
    return '';
  }

  function buyNode(save, id) {
    if (buyBlocker(save, id)) return false;
    const n = node(id);
    save.gold -= nodeCost(n, save.tree[id] | 0);
    save.tree[id] = (save.tree[id] | 0) + 1;
    return true;
  }

  /* ── Gold, stats, achievements ── */
  function earnGold(save, p, amount) {
    const g = Math.round(amount * (1 + (p ? p.goldGain : 0)));
    save.gold += g;
    return g;
  }

  function addStat(save, key, n) {
    save.stats[key] = (save.stats[key] || 0) + n;
    const list = save.quests.list;
    for (let i = 0; i < list.length; ++i)
      if (list[i].stat === key && !list[i].done) {
        list[i].progress = Math.min(list[i].target, list[i].progress + n);
        if (list[i].progress >= list[i].target) list[i].done = true;
      }
  }

  function bestStat(save, key, value) {
    if (value > (save.stats[key] || 0)) save.stats[key] = value;
  }

  function starsTotal(save) {
    let n = 0;
    for (const k in save.story.stars) n += save.story.stars[k] | 0;
    return n;
  }

  function statValue(save, key) {
    return key === 'stars' ? starsTotal(save) : (save.stats[key] || 0);
  }

  /* returns the achievements newly earned; grants their gold */
  function checkAchievements(save, p) {
    const out = [];
    for (let i = 0; i < M.ACHIEVEMENTS.length; ++i) {
      const a = M.ACHIEVEMENTS[i];
      if (save.ach[a.id]) continue;
      if (statValue(save, a.stat) >= a.target) {
        save.ach[a.id] = Date.now();
        earnGold(save, p, a.gold);
        out.push(a);
      }
    }
    return out;
  }

  /* ── Unlocks ── */
  function chaptersDone(save) {
    return save.stats.chapters | 0;
  }

  function isUnlocked(save, item) {
    const u = item.unlock;
    switch (u.type) {
      case 'free': return true;
      case 'chapter': return chaptersDone(save) >= u.value;
      case 'ach': return !!save.ach[u.value];
      case 'gold': return !!save.bought[item.id];
      case 'season': return !!save.seasonUnlocks[item.id];
    }
    return false;
  }

  function unlockHint(item) {
    const u = item.unlock;
    switch (u.type) {
      case 'chapter': return 'Finish chapter ' + u.value;
      case 'ach': {
        const a = M.ACHIEVEMENTS.find((x) => x.id === u.value);
        return 'Achievement: ' + (a ? a.name : u.value);
      }
      case 'gold': return u.value + ' gold';
      case 'season': {
        const s = M.SEASONS.find((x) => x.id === u.value);
        return (s ? s.name : u.value) + ' event';
      }
    }
    return '';
  }

  /* ── Calendar: streaks, quests, seasons ── */
  function questsFor(key) {
    const r = R.make(R.hash('quests' + key));
    const pool = R.shuffle(r, M.QUESTS.slice());
    const list = [];
    for (let i = 0; i < 3; ++i) {
      const q = pool[i];
      const tier = i;
      list.push({ id: q.id, stat: q.stat, target: q.targets[tier], gold: q.gold[tier], progress: 0, done: false, claimed: false });
    }
    return list;
  }

  function questText(q) {
    const def = M.QUESTS.find((x) => x.id === q.id);
    const n = def && def.minutes ? Math.round(q.target / 60) : q.target;
    return def ? def.text.replace('{n}', n) : q.id;
  }

  /* Rolls the calendar to the given date: new quests, streak bookkeeping; returns the streak bonus */
  function refreshDay(save, date, p) {
    const key = R.dateKey(date);
    let bonus = 0;
    if (save.quests.date !== key) {
      save.quests.date = key;
      save.quests.list = questsFor(key);
    }
    if (save.streak.last !== key) {
      const gap = save.streak.last ? R.daysBetween(save.streak.last, key) : 99;
      save.streak.count = gap === 1 ? save.streak.count + 1 : 1;
      save.streak.last = key;
      bestStat(save, 'bestStreak', save.streak.count);
      bonus = 20 + 15 * Math.min(save.streak.count, 7);
      earnGold(save, p, bonus);
    }
    return bonus;
  }

  function claimQuest(save, idx, p) {
    const q = save.quests.list[idx];
    if (!q || !q.done || q.claimed) return 0;
    q.claimed = true;
    return earnGold(save, p, q.gold);
  }

  function inRange(m, d, from, to) {
    const v = m * 100 + d, a = from[0] * 100 + from[1], b = to[0] * 100 + to[1];
    return a <= b ? v >= a && v <= b : v >= a || v <= b;
  }

  function seasonFor(date) {
    const m = date.getMonth() + 1, d = date.getDate();
    for (let i = 0; i < M.SEASONS.length; ++i)
      if (inRange(m, d, M.SEASONS[i].from, M.SEASONS[i].to)) return M.SEASONS[i];
    return null;
  }

  /* the season's key names the year it began in, so a winter spanning New Year is one event */
  function seasonKey(season, date) {
    if (!season) return '';
    const m = date.getMonth() + 1;
    const year = date.getFullYear() - (season.from[0] > season.to[0] && m <= season.to[0] ? 1 : 0);
    return season.id + '-' + year;
  }

  function syncSeason(save, season, date) {
    const key = seasonKey(season, date);
    if (save.season.key !== key)
      save.season = { key, tokens: 0, claimed: [] };
  }

  /* claims every reached tier; returns the rewards granted */
  function claimTrack(save, season, p) {
    const out = [];
    if (!season) return out;
    for (let i = 0; i < M.TRACK.length; ++i) {
      const t = M.TRACK[i];
      if (save.season.tokens < t.need || save.season.claimed.indexOf(i) >= 0) continue;
      save.season.claimed.push(i);
      const rw = t.reward;
      if (rw.type === 'gold') out.push({ text: earnGold(save, p, rw.value) + ' gold', tier: i });
      else if (rw.type === 'skin') {
        save.seasonUnlocks[season.skin] = 1;
        const s = M.SKINS.find((x) => x.id === season.skin);
        out.push({ text: 'Skin: ' + (s ? s.name : season.skin), tier: i });
      } else if (rw.type === 'trail') {
        save.seasonUnlocks[season.trail] = 1;
        const tr = M.TRAILS.find((x) => x.id === season.trail);
        out.push({ text: 'Trail: ' + (tr ? tr.name : season.trail), tier: i });
      }
    }
    return out;
  }

  /* ── Story ── */
  function levelKey(ch, lv) {
    return ch + '-' + lv;
  }

  /* a cave is open when it is the first or the one before it has a star */
  function levelOpen(save, ch, lv) {
    if (ch === 0 && lv === 0) return true;
    if (lv === 0) return (save.story.stars[levelKey(ch - 1, 7)] | 0) > 0;
    return (save.story.stars[levelKey(ch, lv - 1)] | 0) > 0;
  }

  /* stars: 1 clear, +1 within par time, +1 all gems or every extra gem target */
  function starsFor(res) {
    let s = 1;
    if (res.timeUsed <= res.par) ++s;
    if (res.gems >= res.gemsGoal) ++s;
    return s;
  }

  function dailySeed(key) {
    return R.hash('daily-cave-' + key);
  }

  function dailyModifier(key) {
    const r = R.make(R.hash('mod-' + key));
    return I.MODIFIERS[R.int(r, I.MODIFIERS.length)];
  }

  Object.assign(NS.progression, {
    SAVE_VERSION, STAT_KEYS, defaultSave, migrateSave, addHighScore, node, perks, nodeCost, buyBlocker, buyNode,
    earnGold, addStat, bestStat, starsTotal, statValue, checkAchievements, isUnlocked, unlockHint, questsFor,
    questText, refreshDay, claimQuest, seasonFor, seasonKey, syncSeason, claimTrack, levelKey, levelOpen, starsFor,
    dailySeed, dailyModifier
  });
})();
