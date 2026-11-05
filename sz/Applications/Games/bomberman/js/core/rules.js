/* The pure rules of the long game: the fresh save and its repair/migration (including the first
   version's high-score list and tutorial flag), derived perks from the tech tree, node costs and
   states, story unlocks and stars, gem payouts, ranks, cosmetics ownership, achievements,
   play streaks, daily and weekly quests, the seasonal event track and score tables.
   Every function takes the save it works on; nothing here touches storage or the screen. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const { TREE, TREE_BY_ID, SKINS, BOMB_SKINS, TRAILS, ACHIEVEMENTS, QUESTS, EVENT_TIERS, RANKS } = NS.meta;
  const { WORLDS, LEVELS_PER_WORLD } = NS.story;
  const R = NS.rng;

  const STAT_KEYS = ['kills', 'blocks', 'bombs', 'powerups', 'gems', 'gemsPicked', 'kicks', 'throws', 'moves', 'bosses',
    'levels', 'stars', 'deaths', 'playTime', 'arcadeBest', 'arcadeStage', 'zenBlocks', 'zenMinutes', 'dailyClears',
    'rushClears', 'rushBest', 'bestChain', 'bestChainToday', 'bestCombo', 'worlds', 'streakBest', 'treeLevels', 'tokens',
    'cursePass', 'runs', 'xp'];
  const MODES = ['arcade', 'zen', 'daily', 'rush'];

  function freshSave() {
    const stats = {};
    for (let i = 0; i < STAT_KEYS.length; ++i) stats[STAT_KEYS[i]] = 0;
    return {
      v: 2,
      gems: 0,
      stats: stats,
      tree: {},
      stars: {},
      owned: { skin: ['classic'], bomb: ['classic'], trail: ['none'] },
      equip: { skin: 'classic', bomb: 'classic', trail: 'none' },
      ach: {},
      quests: { day: '', list: [] },
      weekly: { week: -1, base: 0, claimed: false },
      streak: { last: -1, count: 0 },
      event: { key: '', tokens: 0, claimed: [] },
      scores: { arcade: [], zen: [], daily: [], rush: [] },
      daily: { key: '', best: 0, done: false },
      seen: { intro: false, help: false, chapters: {}, bosses: {}, finale: false },
      migrated: false
    };
  }

  function num(v, lo) {
    return typeof v === 'number' && isFinite(v) && v >= (lo || 0) ? v : null;
  }

  function strList(v, valid, base) {
    const out = base.slice();
    if (Array.isArray(v))
      for (let i = 0; i < v.length; ++i)
        if (typeof v[i] === 'string' && valid(v[i]) && out.indexOf(v[i]) < 0) out.push(v[i]);
    return out;
  }

  function scoreList(v) {
    const out = [];
    if (!Array.isArray(v)) return out;
    for (let i = 0; i < v.length && out.length < C.MAX_SCORES; ++i) {
      const e = v[i];
      if (e && num(e.score) !== null)
        out.push({ score: Math.floor(e.score), stage: num(e.stage) || 0, date: typeof e.date === 'string' ? e.date : '' });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /* Repairs any stored value into a valid save; folds in the first version's data once */
  function migrateSave(stored, oldScores, oldTutorialSeen) {
    const s = freshSave();
    const src = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : null;
    if (src) {
      s.gems = Math.floor(num(src.gems) || 0);
      if (src.stats && typeof src.stats === 'object')
        for (let i = 0; i < STAT_KEYS.length; ++i) {
          const v = num(src.stats[STAT_KEYS[i]]);
          if (v !== null) s.stats[STAT_KEYS[i]] = v;
        }
      if (src.tree && typeof src.tree === 'object')
        for (const id in src.tree) {
          const n = TREE_BY_ID[id];
          const v = num(src.tree[id]);
          if (n && v) s.tree[id] = Math.min(Math.floor(v), n.costs.length);
        }
      if (src.stars && typeof src.stars === 'object')
        for (const k in src.stars) {
          const v = num(src.stars[k]);
          if (/^\d+-\d+$/.test(k) && v !== null && v >= 1 && v <= 3) s.stars[k] = Math.floor(v);
        }
      if (src.owned) {
        s.owned.skin = strList(src.owned.skin, id => SKINS.some(x => x.id === id), ['classic']);
        s.owned.bomb = strList(src.owned.bomb, id => BOMB_SKINS.some(x => x.id === id), ['classic']);
        s.owned.trail = strList(src.owned.trail, id => TRAILS.some(x => x.id === id), ['none']);
      }
      if (src.equip) {
        for (const kind of ['skin', 'bomb', 'trail'])
          if (s.owned[kind].indexOf(src.equip[kind]) >= 0) s.equip[kind] = src.equip[kind];
      }
      if (src.ach && typeof src.ach === 'object')
        for (const id in src.ach) if (src.ach[id] && ACHIEVEMENTS.some(a => a.id === id)) s.ach[id] = true;
      if (src.quests && typeof src.quests.day === 'string' && Array.isArray(src.quests.list)) {
        s.quests.day = src.quests.day;
        s.quests.list = src.quests.list.filter(q => q && typeof q.id === 'string' && num(q.goal) !== null && num(q.base) !== null)
          .slice(0, 3).map(q => ({ id: q.id, stat: String(q.stat), base: q.base, goal: q.goal, gems: num(q.gems) || 0, text: String(q.text || ''), claimed: !!q.claimed }));
      }
      if (src.weekly && num(src.weekly.week) !== null)
        s.weekly = { week: src.weekly.week, base: num(src.weekly.base) || 0, claimed: !!src.weekly.claimed };
      if (src.streak && num(src.streak.count) !== null)
        s.streak = { last: typeof src.streak.last === 'number' ? src.streak.last : -1, count: src.streak.count };
      if (src.event && typeof src.event.key === 'string')
        s.event = { key: src.event.key, tokens: num(src.event.tokens) || 0, claimed: Array.isArray(src.event.claimed) ? src.event.claimed.filter(x => typeof x === 'number') : [] };
      if (src.scores)
        for (let i = 0; i < MODES.length; ++i) s.scores[MODES[i]] = scoreList(src.scores[MODES[i]]);
      if (src.daily && typeof src.daily.key === 'string')
        s.daily = { key: src.daily.key, best: num(src.daily.best) || 0, done: !!src.daily.done };
      if (src.seen) {
        s.seen.intro = !!src.seen.intro;
        s.seen.help = !!src.seen.help;
        s.seen.finale = !!src.seen.finale;
        if (src.seen.chapters && typeof src.seen.chapters === 'object') for (const k in src.seen.chapters) s.seen.chapters[k] = !!src.seen.chapters[k];
        if (src.seen.bosses && typeof src.seen.bosses === 'object') for (const k in src.seen.bosses) s.seen.bosses[k] = !!src.seen.bosses[k];
      }
      s.migrated = !!src.migrated;
    }
    /* the first version kept a top-5 list of {score, level} and a tutorial flag */
    if (!s.migrated && Array.isArray(oldScores)) {
      const olds = [];
      for (let i = 0; i < oldScores.length; ++i) {
        const e = oldScores[i];
        if (e && num(e.score) !== null) olds.push({ score: Math.floor(e.score), stage: Math.floor(num(e.level) || 0), date: 'classic' });
      }
      s.scores.arcade = scoreList(s.scores.arcade.concat(olds));
      const best = olds.reduce((m, e) => Math.max(m, e.score), 0);
      if (best > s.stats.arcadeBest) s.stats.arcadeBest = best;
      /* veterans start with a gem bonus worth a few tree nodes */
      s.gems += Math.min(400, Math.floor(best / 50));
      s.migrated = true;
    }
    if (!s.migrated && oldTutorialSeen) s.migrated = true;
    if (oldTutorialSeen) s.seen.help = true;
    s.stats.stars = totalStars(s);
    return s;
  }

  /* ── tech tree ── */
  function nodeLevel(save, id) {
    return save.tree[id] || 0;
  }

  function nodeValue(save, id) {
    const l = nodeLevel(save, id);
    return l ? TREE_BY_ID[id].values[l - 1] : 0;
  }

  function nodeCost(save, id) {
    const n = TREE_BY_ID[id];
    const l = nodeLevel(save, id);
    return l >= n.costs.length ? 0 : n.costs[l];
  }

  function reqMet(save, n) {
    for (let i = 0; i < n.req.length; ++i)
      if (nodeLevel(save, n.req[i][0]) < n.req[i][1]) return false;
    return true;
  }

  /* maxed | available | expensive | locked */
  function nodeState(save, id) {
    const n = TREE_BY_ID[id];
    const l = nodeLevel(save, id);
    if (l >= n.costs.length) return 'maxed';
    if (!reqMet(save, n)) return 'locked';
    return save.gems >= n.costs[l] ? 'available' : 'expensive';
  }

  function buyNode(save, id) {
    if (!TREE_BY_ID[id] || nodeState(save, id) !== 'available') return false;
    save.gems -= nodeCost(save, id);
    save.tree[id] = nodeLevel(save, id) + 1;
    ++save.stats.treeLevels;
    return true;
  }

  function nodeText(n, level) {
    return n.text.replace('{v}', n.values[Math.max(0, level - 1)]);
  }

  /* The perks every run reads, derived from the tree */
  function computePerks(save) {
    const v = id => nodeValue(save, id);
    return {
      bombs: 1 + v('a_bombs'),
      fire: 2 + v('a_fire'),
      fuse: Math.max(C.FUSE_MIN, C.FUSE - v('a_fuse')),
      chain: v('a_chain'),
      mega: v('a_super') > 0,
      megaRate: 1 + v('a_super2') / 100,
      speed: v('m_speed'),
      kick: v('m_kick') > 0,
      dash: v('m_dash') > 0,
      dashCd: C.DASH_COOLDOWN - v('m_dash2'),
      glove: v('m_glove') > 0,
      lives: 3 + v('g_life'),
      inv: C.RESPAWN_INV + v('g_inv'),
      shield: v('g_shield') > 0,
      heartRate: 1 + v('g_heart') / 100,
      phoenix: v('g_phoenix') > 0,
      gemMult: 1 + v('f_gems') / 100,
      magnet: v('f_magnet'),
      combo: C.COMBO_WINDOW + v('f_combo'),
      drop: 1 + v('f_drop') / 100,
      luck: v('f_luck') > 0,
      duration: 1 + v('t_dur') / 100,
      time: v('t_time'),
      radar: v('t_radar') > 0,
      remote: v('t_remote') > 0
    };
  }

  /* ── story ── */
  function levelKey(w, l) {
    return w + '-' + l;
  }

  function totalStars(save) {
    let n = 0;
    for (const k in save.stars) n += save.stars[k];
    return n;
  }

  function levelCleared(save, w, l) {
    return !!save.stars[levelKey(w, l)];
  }

  /* A stage is open when it is the first or its predecessor is cleared */
  function levelUnlocked(save, w, l) {
    if (w === 0 && l === 0) return true;
    if (l > 0) return levelCleared(save, w, l - 1);
    return levelCleared(save, w - 1, LEVELS_PER_WORLD - 1);
  }

  function worldUnlocked(save, w) {
    return levelUnlocked(save, w, 0);
  }

  function worldsCleared(save) {
    let n = 0;
    for (let w = 0; w < WORLDS.length; ++w) if (levelCleared(save, w, LEVELS_PER_WORLD - 1)) ++n;
    return n;
  }

  /* The next stage to play: the first open, uncleared one (or the last stage when all are done) */
  function nextStage(save) {
    for (let w = 0; w < WORLDS.length; ++w)
      for (let l = 0; l < LEVELS_PER_WORLD; ++l)
        if (!levelCleared(save, w, l)) return { world: w, level: l };
    return { world: WORLDS.length - 1, level: LEVELS_PER_WORLD - 1 };
  }

  /* One star for clearing, one for no damage, one for beating par time */
  function starRating(result) {
    let s = 1;
    if (!result.hurt) ++s;
    if (result.time <= result.par) ++s;
    return s;
  }

  /* Records a cleared stage; returns the stars newly gained */
  function recordStars(save, w, l, stars) {
    const k = levelKey(w, l);
    const old = save.stars[k] || 0;
    if (stars > old) save.stars[k] = stars;
    save.stats.stars = totalStars(save);
    save.stats.worlds = worldsCleared(save);
    return Math.max(0, stars - old);
  }

  /* ── economy ── */
  function gemPayout(base, perks, mods) {
    let m = perks ? perks.gemMult : 1;
    if (mods && mods.indexOf('rich') >= 0) m *= 2;
    return Math.max(0, Math.round(base * m));
  }

  function stageReward(mode, world, newStars, firstClear) {
    if (mode === 'story') return 20 + world * 6 + newStars * 10 + (firstClear ? 15 : 0);
    if (mode === 'zen') return 6;
    if (mode === 'rush') return 60;
    return 14 + world * 2;
  }

  function rankOf(xp) {
    let r = 0;
    for (let i = 0; i < RANKS.length; ++i) if (xp >= RANKS[i].xp) r = i;
    const next = RANKS[r + 1];
    return { index: r, name: RANKS[r].name, xp: xp, from: RANKS[r].xp, to: next ? next.xp : RANKS[r].xp, max: !next };
  }

  /* ── cosmetics ── */
  function catalog(kind) {
    return kind === 'skin' ? SKINS : kind === 'bomb' ? BOMB_SKINS : TRAILS;
  }

  function owns(save, kind, id) {
    return save.owned[kind].indexOf(id) >= 0;
  }

  function grant(save, kind, id) {
    if (owns(save, kind, id) || !catalog(kind).some(x => x.id === id)) return false;
    save.owned[kind].push(id);
    return true;
  }

  function buyCosmetic(save, kind, id) {
    const item = catalog(kind).find(x => x.id === id);
    if (!item || owns(save, kind, id) || item.unlock.type !== 'buy' || save.gems < item.unlock.cost) return false;
    save.gems -= item.unlock.cost;
    return grant(save, kind, id);
  }

  function equip(save, kind, id) {
    if (!owns(save, kind, id)) return false;
    save.equip[kind] = id;
    return true;
  }

  /* Grants every cosmetic whose world or achievement condition is now met; returns the new ones */
  function unlockEarned(save) {
    const got = [];
    for (const kind of ['skin', 'bomb', 'trail']) {
      const list = catalog(kind);
      for (let i = 0; i < list.length; ++i) {
        const u = list[i].unlock;
        let ok = false;
        if (u.type === 'world') ok = levelCleared(save, u.world, LEVELS_PER_WORLD - 1);
        else if (u.type === 'ach') ok = !!save.ach[u.ach];
        if (ok && grant(save, kind, list[i].id)) got.push({ kind: kind, item: list[i] });
      }
    }
    return got;
  }

  /* ── achievements ── */
  function checkAchievements(save) {
    const got = [];
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      if (save.ach[a.id]) continue;
      if ((save.stats[a.stat] || 0) >= a.goal) {
        save.ach[a.id] = true;
        save.gems += a.gems;
        got.push(a);
      }
    }
    return got;
  }

  /* ── streak: call once per session day; returns the bonus gems for today (0 if already counted) */
  function touchStreak(save, today) {
    const st = save.streak;
    if (st.last === today) return 0;
    st.count = st.last === today - 1 ? st.count + 1 : 1;
    st.last = today;
    if (st.count > save.stats.streakBest) save.stats.streakBest = st.count;
    return Math.min(100, 10 * st.count);
  }

  /* ── quests ── */
  function rollQuests(save, dayKey) {
    if (save.quests.day === dayKey) return false;
    const rng = R.makeRng(R.hashString('quests:' + dayKey));
    const pool = QUESTS.slice();
    rng.shuffle(pool);
    save.stats.bestChainToday = 0;
    save.quests.day = dayKey;
    save.quests.list = pool.slice(0, 3).map((q, i) => {
      const goal = q.n[i === 2 ? 1 : 0];
      return { id: q.id, stat: q.stat, base: q.best ? 0 : (save.stats[q.stat] || 0), goal: goal, gems: q.gems * (i === 2 ? 2 : 1), text: q.text.replace('{n}', goal), claimed: false };
    });
    return true;
  }

  function questProgress(save, q) {
    return Math.max(0, Math.min(q.goal, (save.stats[q.stat] || 0) - q.base));
  }

  function claimQuest(save, i) {
    const q = save.quests.list[i];
    if (!q || q.claimed || questProgress(save, q) < q.goal) return 0;
    q.claimed = true;
    save.gems += q.gems;
    return q.gems;
  }

  function syncWeekly(save, weekly) {
    if (save.weekly.week !== weekly.week)
      save.weekly = { week: weekly.week, base: save.stats[weekly.stat] || 0, claimed: false };
  }

  function weeklyProgress(save, weekly) {
    return Math.max(0, Math.min(weekly.goal, (save.stats[weekly.stat] || 0) - save.weekly.base));
  }

  function claimWeekly(save, weekly) {
    if (save.weekly.claimed || weeklyProgress(save, weekly) < weekly.goal) return 0;
    save.weekly.claimed = true;
    save.gems += weekly.gems;
    return weekly.gems;
  }

  /* ── seasonal event track ── */
  function syncEvent(save, seasonKey) {
    if (save.event.key !== seasonKey) save.event = { key: seasonKey, tokens: 0, claimed: [] };
  }

  /* The cosmetic a tier hands out in a season */
  function tierPrize(seasonId, tier) {
    const t = EVENT_TIERS[tier];
    if (t.reward === 'gems') return { kind: 'gems', gems: t.gems };
    const list = catalog(t.reward);
    const item = list.find(x => x.unlock.type === 'event' && x.unlock.season === seasonId);
    return item ? { kind: t.reward, item: item } : { kind: 'gems', gems: 100 };
  }

  function claimTier(save, seasonId, tier) {
    const t = EVENT_TIERS[tier];
    if (!t || save.event.tokens < t.need || save.event.claimed.indexOf(tier) >= 0) return null;
    save.event.claimed.push(tier);
    const prize = tierPrize(seasonId, tier);
    if (prize.kind === 'gems') save.gems += prize.gems;
    else if (owns(save, prize.kind, prize.item.id)) save.gems += 80;
    else grant(save, prize.kind, prize.item.id);
    return prize;
  }

  /* ── score tables ── */
  function addScore(save, mode, score, stage, date) {
    const list = save.scores[mode];
    if (!list) return -1;
    list.push({ score: Math.floor(score), stage: stage || 0, date: date || '' });
    list.sort((a, b) => b.score - a.score);
    if (list.length > C.MAX_SCORES) list.length = C.MAX_SCORES;
    for (let i = 0; i < list.length; ++i)
      if (list[i].score === Math.floor(score) && list[i].stage === (stage || 0) && list[i].date === (date || '')) return i;
    return -1;
  }

  /* ── combo ── */
  function comboMultiplier(combo) {
    return Math.min(C.COMBO_MAX, 1 + Math.floor(combo / 2));
  }

  Object.assign(NS.rules, {
    STAT_KEYS, MODES, freshSave, migrateSave, nodeLevel, nodeValue, nodeCost, nodeState, buyNode, nodeText, computePerks,
    levelKey, totalStars, levelCleared, levelUnlocked, worldUnlocked, worldsCleared, nextStage, starRating, recordStars,
    gemPayout, stageReward, rankOf, catalog, owns, grant, buyCosmetic, equip, unlockEarned, checkAchievements, touchStreak,
    rollQuests, questProgress, claimQuest, syncWeekly, weeklyProgress, claimWeekly, syncEvent, tierPrize, claimTier,
    addScore, comboMultiplier, TREE
  });
})();
