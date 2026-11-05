/* Pure progression rules: the default save and its migration (keeping the old game's high
   scores and preferences), tech tree levels, costs, states and the stats they add up to, combo
   multipliers and fruit scores, stars and scale rewards, story unlocks, cosmetic unlock checks,
   derived statistics, the daily streak, daily quests and festival tracks. Owns nothing; every
   function takes the save it works on. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const { makeRng, hashString, daysBetween } = NS.rng;
  const { TREE, TREE_BY_ID } = NS.treeData;
  const { WORLDS, LEVELS_PER_WORLD, BOSS_ORDER } = NS.worlds;
  const { QUESTS, STREAK_GIFTS, ACHIEVEMENTS } = NS.goals;
  const { KINDS, find } = NS.cosmetics;
  const { TIERS } = NS.seasons;

  const SAVE_VERSION = 2;

  function defaultSave() {
    return {
      v: SAVE_VERSION,
      scales: 0,
      tree: {},
      story: { levels: {}, freed: [] },
      seen: {},
      owned: { skin: { garden: 1 }, trail: { none: 1 }, hat: { none: 1 }, board: { season: 1, meadow: 1 } },
      equip: { skin: 'garden', trail: 'none', hat: 'none', board: 'season' },
      achievements: {},
      stats: {
        fruit: 0, runs: 0, deaths: 0, playTime: 0, kills: 0, powerups: 0, tokens: 0, eggs: 0, levelsCleared: 0,
        zenTime: 0, dailyDone: 0, venomHits: 0, scalesEarned: 0, rushClears: 0,
        bestLength: 0, bestCombo: 0, arcadeBest: 0, timeBest: 0, bestStreak: 0,
      },
      streak: { last: '', count: 0 },
      quests: { day: '', list: [], bonus: false },
      daily: {},
      events: {},
      highScores: [],
      legacy: false,
      prefs: { touch: 'auto' },
    };
  }

  /* fills gaps in a stored save, or builds a new one carrying the old game's data over */
  function migrateSave(stored, oldScores, oldConfig) {
    const base = defaultSave();
    if (stored && typeof stored === 'object' && stored.v === SAVE_VERSION) {
      for (const k in base) {
        if (stored[k] === undefined) stored[k] = base[k];
        else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]))
          for (const j in base[k]) if (stored[k][j] === undefined) stored[k][j] = base[k][j];
      }
      return stored;
    }
    if (Array.isArray(oldScores)) {
      for (let i = 0; i < oldScores.length; ++i) {
        const e = oldScores[i];
        if (e && typeof e.score === 'number')
          base.highScores.push({ score: e.score, mode: 'Classic', detail: 'length ' + (e.length || 0), date: 0 });
      }
      base.highScores.sort((a, b) => b.score - a.score);
      if (base.highScores.length) base.legacy = true;
    }
    if (oldConfig && typeof oldConfig === 'object') {
      base.legacy = true;
      if (oldConfig.visualTheme === 'tron') { base.owned.skin.tron = 1; base.equip.skin = 'tron'; }
      if (oldConfig.visualTheme === 'maze') { base.owned.skin.ember = 1; base.equip.skin = 'ember'; }
      if (oldConfig.visualTheme === 'zen') { base.owned.trail.leaves = 1; base.equip.trail = 'leaves'; }
    }
    if (base.legacy) base.owned.board.nokia = 1;
    return base;
  }

  /* ── tech tree ── */
  function nodeLevel(save, id) {
    return save.tree[id] | 0;
  }

  function nodeCost(save, id) {
    const n = TREE_BY_ID[id];
    const l = nodeLevel(save, id);
    return l < n.costs.length ? n.costs[l] : 0;
  }

  function reqMet(save, n) {
    for (let k = 0; k < n.req.length; ++k)
      if (nodeLevel(save, n.req[k][0]) < n.req[k][1]) return false;
    return true;
  }

  /* 'maxed', 'locked', 'expensive' or 'available' */
  function nodeState(save, id) {
    const n = TREE_BY_ID[id];
    if (nodeLevel(save, id) >= n.costs.length) return 'maxed';
    if (!reqMet(save, n)) return 'locked';
    if (save.scales < nodeCost(save, id)) return 'expensive';
    return 'available';
  }

  function buyNode(save, id) {
    if (!TREE_BY_ID[id] || nodeState(save, id) !== 'available') return false;
    save.scales -= nodeCost(save, id);
    save.tree[id] = nodeLevel(save, id) + 1;
    return true;
  }

  function nodeText(n, lvl) {
    const v = Math.round(n.per * lvl * 100) / 100;
    return n.text.replace(/\{v\}/g, String(v)).replace(/\{p\}/g, Math.round(n.per * lvl * 100) + '%');
  }

  function computeStats(save) {
    const s = {
      shields: 0, iframes: 0, lives: 0, moltBonus: 0, growScore: 0, extraFood: 0, comboWindow: 0, comboCap: 0, magnet: 0,
      critterScore: 0, duration: 0, dropRate: 0, radiant: 0, starter: 0, twin: 0, venom: 0, venomMax: 0, venomRegen: 0,
      pierce: 0, burst: 0, scaleBonus: 0, gems: 0, goldChance: 0, tokens: 0, streakBonus: 0,
    };
    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      s[n.stat] += n.per * nodeLevel(save, n.id);
    }
    return s;
  }

  function treeLevels(save) {
    let n = 0;
    for (const k in save.tree) n += save.tree[k] | 0;
    return n;
  }

  /* ── scoring ── */
  function comboMultiplier(combo, capBonus) {
    const m = 1 + Math.floor(combo / C.COMBO_PER_STEP) * C.COMBO_STEP_MUL;
    return Math.min(m, C.COMBO_CAP + (capBonus || 0));
  }

  /* value: the fruit's base value; mul: every multiplier already folded together */
  function fruitScore(value, mul, length, growScore) {
    return Math.round(C.FOOD_SCORE * value * mul * (1 + (growScore || 0) * Math.max(0, length - C.START_LEN)));
  }

  /* three stars: cleared, all golden eggs, no crash */
  function levelStars(cleared, eggs, eggTotal, deaths) {
    return [!!cleared, !!cleared && eggs >= eggTotal, !!cleared && deaths === 0];
  }

  function scalesForRun(sum, stats, mulExtra) {
    let s = Math.floor(sum.score / 120) + (sum.gems || 0) + (sum.cleared ? 8 : 0) + (sum.newStars || 0) * 6 + (sum.boss ? 40 : 0);
    if (sum.mode === 'zen') s = Math.floor(sum.score / 160) + (sum.gems || 0);
    s *= (1 + (stats.scaleBonus || 0)) * (mulExtra || 1);
    return Math.max(0, Math.round(s));
  }

  /* ── story ── */
  function levelKey(w, l) {
    return w + '-' + l;
  }

  function levelRecord(save, w, l) {
    return save.story.levels[levelKey(w, l)] || null;
  }

  function levelUnlocked(save, w, l) {
    if (w === 0 && l === 0) return true;
    if (l > 0) return !!levelRecord(save, w, l - 1);
    return !!levelRecord(save, w - 1, LEVELS_PER_WORLD - 1);
  }

  function worldUnlocked(save, w) {
    return levelUnlocked(save, w, 0);
  }

  function totalStars(save) {
    let n = 0;
    for (const k in save.story.levels) {
      const st = save.story.levels[k].stars || [];
      for (let i = 0; i < st.length; ++i) if (st[i]) ++n;
    }
    return n;
  }

  function worldStars(save, w) {
    let n = 0;
    for (let l = 0; l < LEVELS_PER_WORLD; ++l) {
      const r = levelRecord(save, w, l);
      if (r) for (let i = 0; i < 3; ++i) if (r.stars[i]) ++n;
    }
    return n;
  }

  /* merges a finished level into the save; returns the number of new stars */
  function recordLevel(save, w, l, stars, score) {
    const key = levelKey(w, l);
    const rec = save.story.levels[key] || (save.story.levels[key] = { stars: [false, false, false], best: 0 });
    let fresh = 0;
    for (let i = 0; i < 3; ++i) if (stars[i] && !rec.stars[i]) { rec.stars[i] = true; ++fresh; }
    rec.best = Math.max(rec.best, score);
    return fresh;
  }

  function nextStoryLevel(save) {
    for (let w = 0; w < WORLDS.length; ++w)
      for (let l = 0; l < LEVELS_PER_WORLD; ++l)
        if (!levelRecord(save, w, l)) return { w: w, l: l };
    return { w: WORLDS.length - 1, l: LEVELS_PER_WORLD - 1 };
  }

  /* ── derived stats and unlocks ── */
  function statValue(save, key) {
    switch (key) {
      case 'guardians': return save.story.freed.length;
      case 'stars': return totalStars(save);
      case 'skinsOwned': return Object.keys(save.owned.skin).length;
      case 'treeLevels': return treeLevels(save);
      default: return save.stats[key] || 0;
    }
  }

  function eventRecord(save, eventId) {
    return save.events[eventId] || (save.events[eventId] = { tokens: 0, claimed: [] });
  }

  /* why an item is owned or how to get it: { owned, buyable, cost, text } */
  function unlockInfo(save, kind, item) {
    const u = item.unlock || {};
    const owned = !!save.owned[kind][item.id];
    if (owned) return { owned: true, text: 'Owned' };
    if (u.free) return { owned: true, text: 'Owned' };
    if (u.cost) return { owned: false, buyable: true, cost: u.cost, text: u.cost + ' scales' };
    if (u.stars) return { owned: totalStars(save) >= u.stars, text: 'Earn ' + u.stars + ' story stars' };
    if (u.boss) return { owned: save.story.freed.indexOf(u.boss) >= 0, text: 'Free ' + NS.worlds.BOSSES[u.boss].name };
    if (u.world) return { owned: worldUnlocked(save, u.world), text: 'Reach ' + WORLDS[u.world].name };
    if (u.ach) {
      const a = ACHIEVEMENTS.filter(x => x.id === u.ach)[0];
      return { owned: !!save.achievements[u.ach], text: 'Achievement: ' + (a ? a.name : u.ach) };
    }
    if (u.event) return { owned: false, text: NS.seasons.SEASONS[u.event].name + ' festival reward' };
    if (u.legacy) return { owned: save.legacy || !!save.achievements.oldschool, text: 'Old School achievement' };
    return { owned: false, text: '?' };
  }

  /* grants every condition-based unlock that is now met; returns the newly owned items */
  function refreshUnlocks(save) {
    const fresh = [];
    for (const kind in KINDS) {
      const list = KINDS[kind];
      for (let i = 0; i < list.length; ++i) {
        const it = list[i];
        if (save.owned[kind][it.id]) continue;
        const u = it.unlock || {};
        if (u.cost || u.event) continue;
        if (unlockInfo(save, kind, it).owned) {
          save.owned[kind][it.id] = 1;
          fresh.push({ kind: kind, item: it });
        }
      }
    }
    return fresh;
  }

  function buyCosmetic(save, kind, id) {
    const it = find(kind, id);
    const info = unlockInfo(save, kind, it);
    if (info.owned || !info.buyable || save.scales < info.cost) return false;
    save.scales -= info.cost;
    save.owned[kind][id] = 1;
    return true;
  }

  /* ── streak, quests, festival ── */
  /* call once per day the game is played; returns the scale gift (0 if already counted today) */
  function touchStreak(save, today, stats) {
    const st = save.streak;
    if (st.last === today) return 0;
    const gap = daysBetween(st.last, today);
    st.count = gap === 1 ? st.count + 1 : 1;
    st.last = today;
    save.stats.bestStreak = Math.max(save.stats.bestStreak, st.count);
    const base = STREAK_GIFTS[Math.min(STREAK_GIFTS.length - 1, st.count - 1)];
    return Math.round(base * (1 + ((stats && stats.streakBonus) || 0)));
  }

  function ensureQuests(save, today) {
    const q = save.quests;
    if (q.day === today && q.list.length) return q;
    const r = makeRng(hashString('snake-quests-' + today));
    const pool = QUESTS.slice();
    q.day = today;
    q.bonus = false;
    q.list = [];
    for (let k = 0; k < 3; ++k) {
      const def = pool.splice(r.int(0, pool.length - 1), 1)[0];
      const n = r.pick(def.ns);
      q.list.push({ id: def.id, n: n, progress: 0, done: false });
    }
    return q;
  }

  function questDef(id) {
    for (let i = 0; i < QUESTS.length; ++i) if (QUESTS[i].id === id) return QUESTS[i];
    return null;
  }

  function questText(q) {
    const d = questDef(q.id);
    return d ? d.text.replace('{n}', q.n) : q.id;
  }

  /* feeds a statistic into today's quests; returns quests completed by this call */
  function questFeed(save, stat, amount, isMax) {
    const done = [];
    const list = save.quests.list;
    for (let i = 0; i < list.length; ++i) {
      const q = list[i];
      const d = questDef(q.id);
      if (!d || q.done || d.stat !== stat) continue;
      const scale = d.scale || 1;
      if (d.kind === 'max' && isMax) q.progress = Math.max(q.progress, amount);
      else if (d.kind === 'sum' && !isMax) q.progress += amount / scale;
      if (q.progress >= q.n) {
        q.progress = q.n;
        q.done = true;
        done.push({ q: q, reward: d.reward });
      }
    }
    return done;
  }

  /* festival tier rewards reached and not yet claimed */
  function eventTiersDue(save, eventId) {
    const ev = eventRecord(save, eventId);
    const out = [];
    for (let t = 0; t < TIERS.length; ++t)
      if (ev.tokens >= TIERS[t].n && ev.claimed.indexOf(t) < 0) out.push(t);
    return out;
  }

  function eventReward(seasonId, tier) {
    const tr = TIERS[tier];
    if (tr.kind === 'scales') return { kind: 'scales', amount: tr.amount };
    const list = KINDS[tr.kind];
    for (let i = 0; i < list.length; ++i) {
      const u = list[i].unlock || {};
      if (u.event === seasonId && u.tier === tier) return { kind: tr.kind, item: list[i] };
    }
    return { kind: 'scales', amount: 50 };
  }

  function bossFreed(save, boss) {
    return save.story.freed.indexOf(boss) >= 0;
  }

  function freedInOrder(save) {
    return BOSS_ORDER.filter(b => bossFreed(save, b));
  }

  Object.assign(NS.rules, {
    SAVE_VERSION, defaultSave, migrateSave, nodeLevel, nodeCost, nodeState, buyNode, nodeText, computeStats, treeLevels,
    comboMultiplier, fruitScore, levelStars, scalesForRun, levelKey, levelRecord, levelUnlocked, worldUnlocked,
    totalStars, worldStars, recordLevel, nextStoryLevel, statValue, eventRecord, unlockInfo, refreshUnlocks, buyCosmetic,
    touchStreak, ensureQuests, questText, questDef, questFeed, eventTiersDue, eventReward, bossFreed, freedInOrder
  });
})();
