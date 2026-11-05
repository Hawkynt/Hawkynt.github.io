/* The game's pure rules: the profile shape and its migration and repair (including the first
   version's high-score list), tech-tree levels, costs and the derived player stats, per-maze
   difficulty, shard payouts, the high-score table, cosmetics ownership, lifetime and daily stat
   counting, daily quests, the play streak and achievements. No DOM, no storage. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const { TREE, TREE_BY_ID } = NS.treeData;
  const { ACHIEVEMENTS, ACH_BY_ID, QUESTS, STATS, STREAK_BASE, STREAK_STEP, STREAK_CAP } = NS.goals;
  const COS = NS.cosmetics;
  const { WORLDS } = NS.worlds;
  const RNG = NS.rng;

  const PROFILE_VERSION = 2;
  const MAX_SCORES = 10;

  function freshProfile() {
    const stats = {};
    for (let i = 0; i < STATS.length; ++i) stats[STATS[i].id] = 0;
    return {
      v: PROFILE_VERSION, shards: 0, tree: {},
      skins: ['classic'], trails: ['none', 'sparkle'], themes: ['auto', 'retro', 'season'],
      skin: 'classic', trail: 'sparkle', mazeTheme: 'season',
      story: { reached: 0, cleared: {}, best: {}, done: false }, seen: {},
      highScores: [], best: { arcade: 0, zen: 0, daily: 0, bossrush: 0 },
      stats: stats, achievements: {}, used: {},
      daily: { key: '', best: 0, runs: 0 },
      quests: { key: '', list: [], counts: {} },
      streak: { last: -1, count: 0 },
      season: { key: '', tokens: 0, claimed: [] },
      seenHelp: false, migrated: false, veteran: 0,
    };
  }

  function num(v, lo, hi, def) {
    const n = typeof v === 'number' && isFinite(v) ? v : def;
    return Math.max(lo, Math.min(hi, n));
  }

  function idList(arr, table, must) {
    const out = must.slice();
    if (Array.isArray(arr))
      for (let i = 0; i < arr.length; ++i)
        if (typeof arr[i] === 'string' && table[arr[i]] && out.indexOf(arr[i]) < 0) out.push(arr[i]);
    return out;
  }

  function cleanScores(list) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (let i = 0; i < list.length; ++i) {
      const e = list[i];
      if (!e || typeof e.score !== 'number' || !isFinite(e.score) || e.score <= 0) continue;
      out.push({ score: Math.floor(e.score), mode: typeof e.mode === 'string' ? e.mode : 'classic', detail: typeof e.detail === 'string' ? e.detail : '', date: typeof e.date === 'string' ? e.date : '' });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, MAX_SCORES);
  }

  /* Repairs any stored value into a valid profile; oldScores is the first version's
     [{ score, level }] list, carried over once as classic entries plus a veteran shard bonus. */
  function migrateProfile(stored, oldScores) {
    const p = freshProfile();
    const s = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : null;
    if (s) {
      p.shards = Math.floor(num(s.shards, 0, 1e9, 0));
      if (s.tree && typeof s.tree === 'object')
        for (const id in s.tree)
          if (TREE_BY_ID[id]) {
            const l = Math.floor(num(s.tree[id], 0, TREE_BY_ID[id].costs.length, 0));
            if (l > 0) p.tree[id] = l;
          }
      p.skins = idList(s.skins, COS.SKIN_BY_ID, ['classic']);
      p.trails = idList(s.trails, COS.TRAIL_BY_ID, ['none', 'sparkle']);
      p.themes = idList(s.themes, COS.THEME_BY_ID, ['auto', 'retro', 'season']);
      p.skin = p.skins.indexOf(s.skin) >= 0 ? s.skin : 'classic';
      p.trail = p.trails.indexOf(s.trail) >= 0 ? s.trail : 'sparkle';
      p.mazeTheme = p.themes.indexOf(s.mazeTheme) >= 0 ? s.mazeTheme : 'season';
      if (s.story && typeof s.story === 'object') {
        p.story.reached = Math.floor(num(s.story.reached, 0, WORLDS.length, 0));
        p.story.done = s.story.done === true;
        for (const k in s.story.cleared || {}) if (/^\d-\d$/.test(k) && s.story.cleared[k]) p.story.cleared[k] = Math.floor(num(s.story.cleared[k], 1, 3, 1));
        for (const k in s.story.best || {}) if (/^\d-\d$/.test(k)) p.story.best[k] = Math.floor(num(s.story.best[k], 0, 1e9, 0));
      }
      if (s.seen && typeof s.seen === 'object') for (const k in s.seen) if (s.seen[k] === true) p.seen[k] = true;
      p.highScores = cleanScores(s.highScores);
      if (s.best && typeof s.best === 'object') for (const k in p.best) p.best[k] = Math.floor(num(s.best[k], 0, 1e10, 0));
      if (s.stats && typeof s.stats === 'object') for (const k in p.stats) p.stats[k] = num(s.stats[k], 0, 1e12, 0);
      if (s.achievements && typeof s.achievements === 'object') for (const k in s.achievements) if (ACH_BY_ID[k] && s.achievements[k]) p.achievements[k] = true;
      if (s.used && typeof s.used === 'object') for (const k in s.used) if (NS.items.POWERUP_BY_ID[k] && s.used[k]) p.used[k] = true;
      if (s.daily && typeof s.daily.key === 'string') p.daily = { key: s.daily.key, best: Math.floor(num(s.daily.best, 0, 1e10, 0)), runs: Math.floor(num(s.daily.runs, 0, 1e6, 0)) };
      if (s.quests && typeof s.quests.key === 'string' && Array.isArray(s.quests.list)) {
        p.quests.key = s.quests.key;
        p.quests.list = s.quests.list.filter(q => q && QUESTS.some(t => t.id === q.id)).map(q => ({ id: q.id, tier: Math.floor(num(q.tier, 0, 2, 0)), done: q.done === true }));
        if (s.quests.counts && typeof s.quests.counts === 'object') for (const k in s.quests.counts) p.quests.counts[k] = num(s.quests.counts[k], 0, 1e12, 0);
      }
      if (s.streak) p.streak = { last: Math.floor(num(s.streak.last, -1, 1e7, -1)), count: Math.floor(num(s.streak.count, 0, 1e5, 0)) };
      if (s.season && typeof s.season.key === 'string')
        p.season = { key: s.season.key, tokens: Math.floor(num(s.season.tokens, 0, 1e6, 0)), claimed: Array.isArray(s.season.claimed) ? s.season.claimed.filter(n => typeof n === 'number' && n >= 0 && n < COS.SEASON_TRACK.length) : [] };
      p.seenHelp = s.seenHelp === true;
      p.migrated = s.migrated === true;
      p.veteran = Math.floor(num(s.veteran, 0, 1e6, 0));
    }
    if (!p.migrated && Array.isArray(oldScores)) {
      const old = [];
      for (let i = 0; i < oldScores.length; ++i) {
        const e = oldScores[i];
        if (e && typeof e.score === 'number' && e.score > 0)
          old.push({ score: Math.floor(e.score), mode: 'classic', detail: 'Level ' + Math.floor(num(e.level, 1, 999, 1)), date: '' });
      }
      p.highScores = cleanScores(p.highScores.concat(old));
      if (old.length) {
        const best = old.reduce((m, e) => Math.max(m, e.score), 0);
        p.veteran = Math.min(300, Math.floor(best / 100));
        p.shards += p.veteran;
        p.stats.bestArcade = Math.max(p.stats.bestArcade, best);
        p.best.arcade = Math.max(p.best.arcade, best);
      }
      p.migrated = true;
    }
    return p;
  }

  /* ── tech tree ── */
  function nodeLevel(p, id) {
    return p.tree[id] || 0;
  }

  function nodeCost(p, id) {
    const n = TREE_BY_ID[id];
    const l = nodeLevel(p, id);
    return l < n.costs.length ? n.costs[l] : 0;
  }

  /* 'maxed' | 'available' | 'expensive' | 'locked' */
  function nodeState(p, id) {
    const n = TREE_BY_ID[id];
    const l = nodeLevel(p, id);
    if (l >= n.costs.length) return 'maxed';
    for (let i = 0; i < n.req.length; ++i)
      if (nodeLevel(p, n.req[i][0]) < n.req[i][1]) return 'locked';
    return p.shards >= n.costs[l] ? 'available' : 'expensive';
  }

  function buyNode(p, id) {
    if (!TREE_BY_ID[id] || nodeState(p, id) !== 'available') return false;
    p.shards -= nodeCost(p, id);
    p.tree[id] = nodeLevel(p, id) + 1;
    return true;
  }

  function treeProgress(p) {
    let have = 0, all = 0;
    for (let i = 0; i < TREE.length; ++i) { have += nodeLevel(p, TREE[i].id); all += TREE[i].costs.length; }
    return { have: have, all: all };
  }

  /* The player's derived numbers from the tree */
  function computeStats(p) {
    const L = id => nodeLevel(p, id);
    return {
      speed: 1 + L('a_speed') * 0.03,
      corner: L('a_corner') > 0,
      tunnelEase: L('a_tunnel') * 0.25,
      grip: L('a_ice') > 0,
      burst: L('a_burst') * 0.12,
      frightBonus: L('p_fright') * 0.75,
      ghostBonus: 1 + L('p_gourmet') * 0.25,
      frightSlow: 1 - L('p_slow') * 0.1,
      echo: L('p_echo') > 0,
      bossCrit: L('p_boss') * 0.33,
      shardBonus: 1 + L('f_shards') * 0.15,
      fruitBonus: 1 + L('f_fruit') * 0.4,
      chainWindow: C.CHAIN_WINDOW + L('f_combo') * 0.12,
      multCap: 5 + L('f_mult'),
      tokenBonus: L('f_token') * 0.4,
      powerDur: 1 + L('l_dur') * 0.15,
      powerRate: 1 - L('l_rate') * 0.12,
      rareBoost: 1 + L('l_rare'),
      headStart: L('l_start') > 0,
      twin: L('l_twin') > 0 ? 0.25 : 0,
      lives: 3 + L('s_life'),
      shieldStart: L('s_shield') > 0,
      revive: L('s_revive') > 0,
      grace: 1.5 + L('s_grace') * 1.5,
      lifeEvery: L('s_bonus') > 0 ? 8000 : C.EXTRA_LIFE_EVERY,
    };
  }

  /* ── difficulty ── */
  /* tier grows with the maze number n (0-based) of a run */
  function levelConfig(mode, n, mods) {
    mods = mods || [];
    const t = Math.min(n, 16);
    const zen = mode === 'zen';
    const turbo = mods.indexOf('turbo') >= 0 ? 1.2 : 1;
    const cfg = {
      pacSpeed: C.PAC_SPEED * (1 + Math.min(t, 6) * 0.015) * turbo,
      ghostSpeed: C.GHOST_SPEED * (zen ? 0.78 : 0.86 + t * 0.018) * turbo,
      frightTime: zen ? 8 : Math.max(2.2, 7 - t * 0.35),
      release: zen ? [0, 4, 9, 14] : [0, Math.max(0.5, 2.5 - t * 0.15), Math.max(2, 6 - t * 0.3), Math.max(3, 9 - t * 0.45)],
      elroy: zen ? 0 : Math.min(40, 14 + t * 2),
      modeTimes: t < 2 ? C.MODE_TIMES : [5, 20, 5, 20, 5, 1033, 1 / 60, Infinity],
      powerEvery: (zen ? 9 : 13) * (mods.indexOf('bounty') >= 0 ? 0.5 : 1),
      fruitDots: mods.indexOf('feast') >= 0 ? [40, 80, 120, 160] : [70, 170],
      extraGhosts: mods.indexOf('swarm') >= 0 ? 2 : 0,
      dark: mods.indexOf('dark') >= 0,
      scoreMul: (mods.indexOf('turbo') >= 0 ? 1.5 : 1) * (mods.indexOf('glass') >= 0 ? 2 : 1),
    };
    return cfg;
  }

  /* shards for a finished or abandoned run */
  function shardsForRun(mode, score, mazes, stats) {
    const base = Math.floor(score / (mode === 'zen' ? 260 : 200)) + mazes * 6;
    return Math.floor(base * (stats ? stats.shardBonus : 1));
  }

  function addHighScore(p, entry) {
    if (!(entry.score > 0)) return -1;
    p.highScores.push({ score: Math.floor(entry.score), mode: entry.mode, detail: entry.detail || '', date: entry.date || '' });
    p.highScores.sort((a, b) => b.score - a.score);
    const rank = p.highScores.findIndex(e => e.score === Math.floor(entry.score) && e.mode === entry.mode);
    if (p.highScores.length > MAX_SCORES) p.highScores.length = MAX_SCORES;
    return rank < MAX_SCORES ? rank : -1;
  }

  /* ── cosmetics ── */
  function listFor(kind) {
    return kind === 'skin' ? COS.SKINS : kind === 'trail' ? COS.TRAILS : COS.MAZE_THEMES;
  }

  function ownedList(p, kind) {
    return kind === 'skin' ? p.skins : kind === 'trail' ? p.trails : p.themes;
  }

  function owns(p, kind, id) {
    return ownedList(p, kind).indexOf(id) >= 0;
  }

  function grant(p, kind, id) {
    const list = ownedList(p, kind);
    if (list.indexOf(id) >= 0) return false;
    list.push(id);
    return true;
  }

  function buyCosmetic(p, kind, id) {
    const item = listFor(kind).find(c => c.id === id);
    if (!item || item.unlock.by !== 'shop' || owns(p, kind, id) || p.shards < item.unlock.cost) return false;
    p.shards -= item.unlock.cost;
    return grant(p, kind, id);
  }

  /* Hands out every cosmetic whose achievement or story condition is now met */
  function syncUnlocks(p) {
    const got = [];
    const kinds = ['skin', 'trail', 'theme'];
    for (let k = 0; k < kinds.length; ++k) {
      const list = listFor(kinds[k]);
      for (let i = 0; i < list.length; ++i) {
        const u = list[i].unlock;
        let ok = false;
        if (u.by === 'ach') ok = !!p.achievements[u.id];
        if (u.by === 'story') ok = p.story.done || p.story.reached >= u.chapter;
        if (ok && grant(p, kinds[k], list[i].id)) got.push({ kind: kinds[k], item: list[i] });
      }
    }
    return got;
  }

  /* ── stats, quests, streak ── */
  function bump(p, stat, n) {
    p.stats[stat] = (p.stats[stat] || 0) + n;
    p.quests.counts[stat] = (p.quests.counts[stat] || 0) + n;
  }

  function bumpMax(p, stat, v) {
    if (v > (p.stats[stat] || 0)) p.stats[stat] = v;
    if (v > (p.quests.counts[stat] || 0)) p.quests.counts[stat] = v;
  }

  /* three distinct quests for a day */
  function dailyQuests(key) {
    const rng = RNG.makeRng(RNG.hashString('quests:' + key));
    const pool = QUESTS.slice();
    const out = [];
    for (let i = 0; i < 3; ++i) {
      const k = Math.floor(rng() * pool.length);
      out.push({ id: pool[k].id, tier: i, done: false });
      pool.splice(k, 1);
    }
    return out;
  }

  function questDef(q) {
    return QUESTS.find(t => t.id === q.id);
  }

  function questTarget(q) {
    const d = questDef(q);
    return d.ns[q.tier] * (d.scale || 1);
  }

  function questText(q) {
    return questDef(q).text.replace('{n}', RNG.clamp(questDef(q).ns[q.tier], 0, 1e9).toLocaleString('en-US'));
  }

  function questReward(q) {
    return questDef(q).reward[q.tier];
  }

  function questProgress(p, q) {
    return Math.min(1, (p.quests.counts[questDef(q).stat] || 0) / questTarget(q));
  }

  /* rolls the quests and counters over to a new day */
  function refreshQuests(p, key) {
    if (p.quests.key === key) return false;
    p.quests = { key: key, list: dailyQuests(key), counts: {} };
    return true;
  }

  /* completes quests whose target is met; returns the newly completed ones (shards granted) */
  function checkQuests(p) {
    const out = [];
    for (let i = 0; i < p.quests.list.length; ++i) {
      const q = p.quests.list[i];
      if (q.done || questProgress(p, q) < 1) continue;
      q.done = true;
      const r = questReward(q);
      p.shards += r;
      bump(p, 'shardsEarned', r);
      out.push({ text: questText(q), reward: r });
    }
    return out;
  }

  /* first play of a local day: extends or resets the streak; returns the bonus shards (0 if already counted) */
  function touchStreak(p, day) {
    if (p.streak.last === day) return 0;
    p.streak.count = p.streak.last === day - 1 ? p.streak.count + 1 : 1;
    p.streak.last = day;
    p.stats.daysPlayed = (p.stats.daysPlayed || 0) + 1;
    bumpMax(p, 'bestStreak', p.streak.count);
    const bonus = STREAK_BASE + STREAK_STEP * (Math.min(p.streak.count, STREAK_CAP) - 1);
    p.shards += bonus;
    bump(p, 'shardsEarned', bonus);
    return bonus;
  }

  /* ── achievements ── */
  function feat(p, id) {
    if (p.achievements[id] || !ACH_BY_ID[id]) return null;
    return unlock(p, ACH_BY_ID[id]);
  }

  function unlock(p, a) {
    p.achievements[a.id] = true;
    p.shards += a.reward;
    p.stats.shardsEarned = (p.stats.shardsEarned || 0) + a.reward;
    return a;
  }

  function checkAchievements(p) {
    const out = [];
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      if (p.achievements[a.id] || !a.stat) continue;
      if ((p.stats[a.stat] || 0) >= a.n) out.push(unlock(p, a));
    }
    if (!p.achievements.allpower && Object.keys(p.used).length >= NS.items.POWERUPS.length) out.push(unlock(p, ACH_BY_ID.allpower));
    return out;
  }

  function addShards(p, n) {
    n = Math.max(0, Math.floor(n));
    p.shards += n;
    bump(p, 'shardsEarned', n);
    return n;
  }

  Object.assign(NS.rules, {
    PROFILE_VERSION, MAX_SCORES, freshProfile, migrateProfile, nodeLevel, nodeCost, nodeState, buyNode, treeProgress,
    computeStats, levelConfig, shardsForRun, addHighScore, owns, grant, buyCosmetic, syncUnlocks, listFor,
    bump, bumpMax, dailyQuests, questText, questReward, questProgress, questTarget, refreshQuests, checkQuests,
    touchStreak, feat, checkAchievements, addShards
  });
})();
