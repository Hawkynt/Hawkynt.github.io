/* Pure game rules: the save shape with repair and migration of the old high-score and field-size
   keys, tech tree levels, costs and states, ship stats from owned levels, cosmetics ownership,
   scoring and combo multipliers, story stars and rewards, arcade wave specs, and achievement
   statistics. No DOM, no globals touched. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const { TREE, TREE_BY_ID } = NS.treeData;
  const { CHAPTERS, levelKey } = NS.campaign;
  const { ROCK_TYPES, ARCADE_TYPES } = NS.rockData;
  const { ENEMIES, BOSS_ORDER } = NS.enemyData;
  const COS = NS.cosmetics;
  const { ACHIEVEMENTS } = NS.goalData;

  const SAVE_VERSION = 1;
  const STAT_KEYS = ['playTime', 'runs', 'rocks', 'raiders', 'bosses', 'shots', 'powerups', 'novas', 'overdrives', 'hypers', 'deaths',
    'pods', 'dustEarned', 'bestCombo', 'arcadeBest', 'arcadeWave', 'zenTime', 'dailies', 'tokens', 'distance', 'levels', 'flawless', 'gold'];

  function defaultSave() {
    const stats = {};
    for (let i = 0; i < STAT_KEYS.length; ++i) stats[STAT_KEYS[i]] = 0;
    return {
      v: SAVE_VERSION,
      migrated: false,
      dust: 0,
      tree: {},
      stars: {},
      bestTimes: {},
      seen: {},
      bossKinds: {},
      owned: ['skin:kestrel', 'skin:vector', 'trail:ion', 'shot:cyan'],
      look: { skin: 'kestrel', trail: 'ion', shot: 'cyan' },
      ach: {},
      stats: stats,
      highScores: [],
      best: { arcade: 0, zen: 0, rush: 0, daily: { key: '', score: 0 } },
      daily: { key: '', quests: [], played: false },
      streak: { last: '', count: 0, best: 0 },
      seasons: {},
      badges: [],
      settings: { shake: 1, aim: 'auto' },
      seenHelp: false,
    };
  }

  function num(v, lo) {
    return typeof v === 'number' && isFinite(v) && v >= (lo || 0) ? v : null;
  }

  function isObj(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  /* Repairs a stored save (anything goes in) and folds in the old high scores once */
  function migrateSave(stored, oldScores) {
    const s = defaultSave();
    const src = isObj(stored) ? stored : {};
    if (num(src.dust) !== null) s.dust = Math.floor(src.dust);
    if (isObj(src.tree))
      for (const k in src.tree) {
        const n = TREE_BY_ID[k];
        const lv = num(src.tree[k]);
        if (n && lv !== null && lv > 0) s.tree[k] = Math.min(n.costs.length, Math.floor(lv));
      }
    if (isObj(src.stars))
      for (const k in src.stars) {
        const v = num(src.stars[k]);
        if (/^\d-\d$/.test(k) && v !== null && v >= 1) s.stars[k] = Math.min(3, Math.floor(v));
      }
    if (isObj(src.bestTimes))
      for (const k in src.bestTimes) if (num(src.bestTimes[k]) !== null) s.bestTimes[k] = src.bestTimes[k];
    if (isObj(src.seen)) for (const k in src.seen) if (src.seen[k] === true) s.seen[k] = true;
    if (isObj(src.bossKinds)) for (const k in src.bossKinds) if (BOSS_ORDER.indexOf(k) >= 0) s.bossKinds[k] = true;
    if (Array.isArray(src.owned))
      for (let i = 0; i < src.owned.length; ++i) {
        const parts = String(src.owned[i]).split(':');
        if (COS.KINDS[parts[0]] && COS.find(parts[0], parts[1]) && s.owned.indexOf(src.owned[i]) < 0) s.owned.push(src.owned[i]);
      }
    if (isObj(src.look))
      for (const kind in s.look) {
        const id = src.look[kind];
        if (typeof id === 'string' && s.owned.indexOf(kind + ':' + id) >= 0) s.look[kind] = id;
      }
    if (isObj(src.ach)) for (const k in src.ach) if (src.ach[k] === true) s.ach[k] = true;
    if (isObj(src.stats))
      for (let i = 0; i < STAT_KEYS.length; ++i) {
        const v = num(src.stats[STAT_KEYS[i]]);
        if (v !== null) s.stats[STAT_KEYS[i]] = v;
      }
    if (Array.isArray(src.highScores))
      s.highScores = src.highScores.filter(e => isObj(e) && num(e.score) !== null).slice(0, 10)
        .map(e => ({ score: Math.floor(e.score), wave: num(e.wave) || 0, mode: typeof e.mode === 'string' ? e.mode : 'arcade', date: typeof e.date === 'string' ? e.date : '' }));
    if (isObj(src.best)) {
      for (const k of ['arcade', 'zen', 'rush']) if (num(src.best[k]) !== null) s.best[k] = src.best[k];
      if (isObj(src.best.daily) && typeof src.best.daily.key === 'string' && num(src.best.daily.score) !== null)
        s.best.daily = { key: src.best.daily.key, score: src.best.daily.score };
    }
    if (isObj(src.daily) && typeof src.daily.key === 'string' && Array.isArray(src.daily.quests)) {
      s.daily.key = src.daily.key;
      s.daily.played = src.daily.played === true;
      s.daily.quests = src.daily.quests.filter(q => isObj(q) && typeof q.id === 'string' && num(q.goal) !== null)
        .map(q => ({ id: q.id, goal: q.goal, p: num(q.p) || 0, done: q.done === true, claimed: q.claimed === true, dust: num(q.dust) || 0 }));
    }
    if (isObj(src.streak) && typeof src.streak.last === 'string')
      s.streak = { last: src.streak.last, count: num(src.streak.count) || 0, best: num(src.streak.best) || 0 };
    if (isObj(src.seasons))
      for (const k in src.seasons) {
        const e = src.seasons[k];
        if (isObj(e) && num(e.tokens) !== null) s.seasons[k] = { tokens: e.tokens, claimed: Math.min(8, num(e.claimed) || 0) };
      }
    if (Array.isArray(src.badges)) s.badges = src.badges.filter(b => typeof b === 'string');
    if (isObj(src.settings)) {
      if (num(src.settings.shake) !== null) s.settings.shake = Math.min(1, src.settings.shake);
      if (src.settings.aim === 'manual' || src.settings.aim === 'auto') s.settings.aim = src.settings.aim;
    }
    s.seenHelp = src.seenHelp === true;
    s.migrated = src.migrated === true;

    /* the first version kept only a high-score list: veterans keep their scores and get a head start */
    if (!s.migrated && Array.isArray(oldScores)) {
      const legacy = { classic: 'Classic', survival: 'Survival', zen: 'Zen', hardcore: 'Hardcore' };
      const old = oldScores.filter(e => isObj(e) && num(e.score) !== null && e.score > 0);
      for (let i = 0; i < old.length; ++i)
        s.highScores.push({ score: Math.floor(old[i].score), wave: num(old[i].level) || 0, mode: 'arcade', date: '', legacy: legacy[old[i].mode] || 'Classic' });
      s.highScores.sort((a, b) => b.score - a.score);
      s.highScores.length = Math.min(10, s.highScores.length);
      if (old.length) {
        const best = s.highScores[0].score;
        s.best.arcade = Math.max(s.best.arcade, best);
        s.stats.arcadeBest = Math.max(s.stats.arcadeBest, best);
        s.dust += Math.min(1500, Math.floor(best / 20));
      }
      s.migrated = true;
    }
    for (let i = 0; i < s.highScores.length; ++i) if (s.highScores[i].legacy === undefined) delete s.highScores[i].legacy;
    return s;
  }

  /* ── tech tree ── */
  function nodeLevel(save, id) {
    return save.tree[id] || 0;
  }

  function nodeCost(save, id) {
    const n = TREE_BY_ID[id];
    const lv = nodeLevel(save, id);
    return lv < n.costs.length ? n.costs[lv] : 0;
  }

  function reqMet(save, n) {
    for (let i = 0; i < n.req.length; ++i)
      if (nodeLevel(save, n.req[i][0]) < n.req[i][1]) return false;
    return true;
  }

  /* maxed, locked, expensive or available */
  function nodeState(save, id) {
    const n = TREE_BY_ID[id];
    if (nodeLevel(save, id) >= n.costs.length) return 'maxed';
    if (!reqMet(save, n)) return 'locked';
    if (save.dust < nodeCost(save, id)) return 'expensive';
    return 'available';
  }

  function buyNode(save, id) {
    if (!TREE_BY_ID[id] || nodeState(save, id) !== 'available') return false;
    save.dust -= nodeCost(save, id);
    save.tree[id] = nodeLevel(save, id) + 1;
    return true;
  }

  function nodeText(n, lv) {
    const v = Math.round(n.per * lv * 100) / 100;
    return n.fmt.replace('{p}', String(Math.round(n.per * lv * 100))).replace('{v}', String(v));
  }

  function treeLevels(save) {
    let t = 0;
    for (const k in save.tree) t += save.tree[k];
    return t;
  }

  function computeStats(save) {
    const st = {
      dmg: 1, rate: 1, bullets: C.BULLETS_MAX, shotSpeed: 1, crit: 0, twin: 0, ricochet: 0,
      lives: 3, invuln: C.INVULN, startShield: 0, hyperCd: C.HYPER_CD, safeHyper: 0, lastStand: 0,
      thrust: 1, turn: 1, speed: 1, brake: 1, ram: 0,
      dust: 1, magnet: 90, luck: 1, puDur: 1, combo: C.COMBO_WINDOW, startPower: 0,
      odRate: 1, odRadius: C.OVERDRIVE_R, odDmg: 3, drones: 0, odSlow: 0,
    };
    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      const lv = nodeLevel(save, n.id);
      if (!lv) continue;
      const add = n.per * lv;
      if (n.stat === 'hyperCd') st.hyperCd *= 1 - add;
      else if (n.stat === 'magnet' || n.stat === 'odRadius') st[n.stat] *= 1 + add;
      else st[n.stat] += add;
    }
    return st;
  }

  /* ── cosmetics ── */
  function owns(save, kind, id) {
    return save.owned.indexOf(kind + ':' + id) >= 0;
  }

  function grant(save, kind, id) {
    if (owns(save, kind, id) || !COS.find(kind, id)) return false;
    save.owned.push(kind + ':' + id);
    return true;
  }

  function buyCosmetic(save, kind, id) {
    const it = COS.find(kind, id);
    if (!it || owns(save, kind, id) || it.unlock.by !== 'dust' || save.dust < it.unlock.cost) return false;
    save.dust -= it.unlock.cost;
    return grant(save, kind, id);
  }

  function equip(save, kind, id) {
    if (!owns(save, kind, id)) return false;
    save.look[kind] = id;
    return true;
  }

  /* how an item is unlocked, in words */
  function unlockText(it) {
    const u = it.unlock;
    switch (u.by) {
      case 'default': return 'Owned';
      case 'dust': return u.cost + ' stardust';
      case 'ach': {
        const a = ACHIEVEMENTS.find(x => x.id === u.id);
        return 'Achievement: ' + (a ? a.name : u.id);
      }
      case 'story': return 'Finish Chapter ' + ['I', 'II', 'III', 'IV', 'V'][u.chapter - 1];
      case 'season': return NS.seasons.SEASONS[u.season].name + ' event, tier ' + u.tier;
    }
    return '';
  }

  /* ── scoring ── */
  function comboMult(combo) {
    return Math.min(8, 1 + Math.floor(combo / 6));
  }

  function rockScore(type, size) {
    return Math.round(C.ROCK_SCORE[size] * (ROCK_TYPES[type] ? ROCK_TYPES[type].score : 1));
  }

  function rockHp(type, size) {
    return Math.max(1, Math.ceil(ROCK_TYPES[type].hp * NS.rockData.SIZE_HP[size]));
  }

  /* ── story progress ── */
  function totalStars(save) {
    let t = 0;
    for (const k in save.stars) t += save.stars[k];
    return t;
  }

  function levelDone(save, c, l) {
    return !!save.stars[levelKey(c, l)];
  }

  /* a level is open once the one before it is done; a chapter once the previous boss fell */
  function levelOpen(save, c, l) {
    if (l > 0) return levelDone(save, c, l - 1);
    if (c > 0) return levelDone(save, c - 1, CHAPTERS[c - 1].levels.length - 1);
    return true;
  }

  function chaptersDone(save) {
    let n = 0;
    for (let c = 0; c < CHAPTERS.length; ++c)
      if (levelDone(save, c, CHAPTERS[c].levels.length - 1)) ++n;
    return n;
  }

  function starsFor(level, result) {
    return 1 + (result.lost === 0 ? 1 : 0) + (result.time <= level.par ? 1 : 0);
  }

  function levelDust(c, stars, first) {
    return Math.round((40 + c * 25 + stars * 15) * (first ? 2 : 1));
  }

  /* ── arcade waves ── */
  function arcadeWave(n, rng, mods) {
    mods = mods || [];
    const types = ARCADE_TYPES.filter(t => ROCK_TYPES[t].from <= n);
    const count = Math.min(11, 3 + Math.floor(n * 0.6));
    const rocks = [];
    for (let i = 0; i < count; ++i) {
      let t = rng() < 0.45 ? 'normal' : types[Math.floor(rng() * types.length)];
      if (mods.indexOf('ironRain') >= 0 && (t === 'normal' || t === 'gold')) t = 'iron';
      if (mods.indexOf('goldRush') >= 0 && rng() < 0.3) t = 'gold';
      if (t === 'gold' && mods.indexOf('goldRush') < 0 && rng() < 0.6) t = 'normal';
      rocks.push([t, 3, 1]);
    }
    if (n % 5 === 0 || mods.indexOf('bigRocks') >= 0) rocks.push([types[Math.floor(rng() * types.length)], 4, 1]);
    const kinds = Object.keys(ENEMIES).filter(k => ENEMIES[k].from <= n + 1);
    const foes = {
      kinds: mods.indexOf('swarm') >= 0 ? kinds.concat(['hunter', 'hunter']) : kinds,
      first: Math.max(4, 14 - n * 0.5), every: Math.max(6, 24 - n), max: Math.min(5, 1 + Math.floor(n / 3)),
    };
    const boss = n % 8 === 0 ? BOSS_ORDER[(n / 8 - 1) % BOSS_ORDER.length] : null;
    return { rocks: boss ? rocks.slice(0, 2) : rocks, foes: foes, boss: boss, speed: 1 + Math.min(0.9, n * 0.035) };
  }

  /* ── achievements ── */
  function statValue(save, key) {
    switch (key) {
      case 'stars': return totalStars(save);
      case 'chapters': return chaptersDone(save);
      case 'treeLevels': return treeLevels(save);
      case 'cosmetics': return save.owned.length;
      case 'bossKinds': return Object.keys(save.bossKinds).length;
      case 'bestStreak': return save.streak.best;
    }
    return save.stats[key] || 0;
  }

  /* marks newly reached achievements and returns them (rewards are paid by the caller) */
  function newAchievements(save) {
    const out = [];
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      if (!save.ach[a.id] && statValue(save, a.stat) >= a.goal) {
        save.ach[a.id] = true;
        out.push(a);
      }
    }
    return out;
  }

  /* cosmetics whose story or achievement condition is now met */
  function earnedCosmetics(save) {
    const out = [];
    const ch = chaptersDone(save);
    for (const kind in COS.KINDS) {
      const list = COS.KINDS[kind];
      for (let i = 0; i < list.length; ++i) {
        const it = list[i], u = it.unlock;
        const ok = (u.by === 'story' && ch >= u.chapter) || (u.by === 'ach' && save.ach[u.id]);
        if (ok && grant(save, kind, it.id)) out.push({ kind: kind, item: it });
      }
    }
    return out;
  }

  /* a score into the top-ten table; returns the rank (0-based) or -1 */
  function addHighScore(save, entry) {
    if (!(entry.score > 0)) return -1;
    save.highScores.push(entry);
    save.highScores.sort((a, b) => b.score - a.score);
    if (save.highScores.length > 10) save.highScores.length = 10;
    return save.highScores.indexOf(entry);
  }

  Object.assign(NS.rules, {
    SAVE_VERSION, STAT_KEYS, defaultSave, migrateSave, nodeLevel, nodeCost, nodeState, buyNode, nodeText, treeLevels, computeStats,
    owns, grant, buyCosmetic, equip, unlockText, comboMult, rockScore, rockHp, totalStars, levelDone, levelOpen, chaptersDone,
    starsFor, levelDust, arcadeWave, statValue, newAchievements, earnedCosmetics, addHighScore
  });
})();
