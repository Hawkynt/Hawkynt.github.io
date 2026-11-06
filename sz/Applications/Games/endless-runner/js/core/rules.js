/* The game's arithmetic, pure and tested: the profile shape and its migration (including the
   old game's high-score list, coin total and tutorial flag), what the tech tree and the chosen
   runner add up to, tree purchases, cosmetic unlock rules, combo tiers, runner levels and XP,
   run rewards and stars, the daily quests for a day, play streaks, festival track progress and
   the high-score table. Owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const { makeRng, hashString, daysBetween, clamp } = NS.rng;
  const { NODES, NODE_BY_ID, cost } = NS.treeData;
  const { QUESTS } = NS.goals;
  const { TIERS } = NS.seasons;

  function newSave() {
    return {
      v: 2, coins: 0, gems: 0, xp: 0, level: 1,
      tree: {}, owned: {}, equip: { char: 'nova', outfit: 'classic', trail: 'dust' },
      stars: {}, best: {}, cleared: {}, shardsGot: {}, bosses: {}, ghosts: {},
      scores: [], daily: { key: '', best: 0, plays: 0 },
      stats: {}, day: { key: '', c: {}, quests: [] }, streak: { last: '', count: 0, best: 0 },
      season: { event: '', tokens: 0, claimed: [] }, ach: {},
      seen: { intro: 0, help: 0, finale: 0, cine: {} }, opts: { shake: 1 },
    };
  }

  /* fill every missing field of a stored profile from a fresh one (one level deep) */
  function fill(target, def) {
    for (const k in def) {
      if (target[k] === undefined || target[k] === null) target[k] = def[k];
      else if (typeof def[k] === 'object' && !Array.isArray(def[k]) && typeof target[k] === 'object')
        for (const q in def[k]) if (target[k][q] === undefined) target[k][q] = def[k][q];
    }
    return target;
  }

  /* stored: the v2 profile or null; oldScores/oldCoins/oldTutorial: the old game's keys */
  function migrateSave(stored, oldScores, oldCoins, oldTutorial) {
    if (stored && stored.v === 2) return fill(stored, newSave());
    const s = newSave();
    if (Array.isArray(oldScores)) {
      let best = 0;
      for (let i = 0; i < oldScores.length; ++i) {
        const e = oldScores[i];
        if (!e || typeof e.distance !== 'number') continue;
        const coins = Math.max(0, e.coins | 0);
        const dist = Math.max(0, Math.floor(e.distance));
        s.scores.push({ score: dist + coins * C.COIN_SCORE, dist: dist, coins: coins, mode: 'classic', date: '' });
        best = Math.max(best, dist);
      }
      s.scores.sort((a, b) => b.score - a.score);
      if (s.scores.length > C.MAX_HIGH_SCORES) s.scores.length = C.MAX_HIGH_SCORES;
      s.stats.bestRun = best;
      s.stats.arcadeBest = best;
    }
    const c = parseInt(oldCoins, 10);
    if (c > 0) { s.coins = c; s.stats.coins = c; }
    if (oldTutorial === '1' || oldTutorial === 1) s.seen.help = 1;
    return s;
  }

  function lvl(save, id) {
    return (save.tree && save.tree[id]) || 0;
  }

  /* everything the tree and the runner change, in one object */
  function computeStats(save) {
    const L = id => lvl(save, id);
    const ch = save.equip ? save.equip.char : 'nova';
    const durBoost = ch === 'echo' ? 1.15 : 1;
    const jet = 1 + 0.18 * L('jetFuel'), titan = 1 + 0.15 * L('titanSerum');
    const dur = {
      magnet: 8 + 1.5 * L('magnetCoil'), shield: 14 + 2 * L('shieldCore'), multi: 10, jetpack: 6 * jet, rocket: 4 * jet,
      giant: 6 * titan, ghost: 6 * titan, slowmo: 6 * titan, rain: 6, spring: 12, lucky: 8,
    };
    for (const k in dur) dur[k] = Math.round(dur[k] * durBoost * 10) / 10;
    return {
      dur: dur,
      magnetRange: 260 * (1 + 0.12 * L('magnetCoil') + (ch === 'kip' ? 0.35 : 0)),
      shieldHits: L('shieldCore') >= 4 ? 2 : 1,
      powerEvery: 3400 * (1 - 0.1 * L('powerSense')),
      dashCd: (1.6 - 0.18 * L('dashJets')) * (ch === 'rook' ? 0.75 : 1),
      dashT: 0.22 + 0.04 * L('longDash'),
      slideT: 0.6 + 0.1 * L('slideMaster'),
      jumpMul: 1 + 0.03 * L('springLegs'),
      maxJumps: 2 + L('tripleJump'),
      revives: L('phoenix'),
      guardian: L('guardian') > 0,
      reviveInv: 2 + 0.6 * L('secondWind'),
      startShield: L('startShield') > 0 || ch === 'blaze',
      zenRate: 0.5 + 0.15 * L('zenGarden'),
      coinMul: 1 + 0.1 * L('coinValue') + (ch === 'mira' ? 0.1 : 0),
      gemRate: 0.04 * L('gemFinder'),
      comboWindow: C.COMBO_WINDOW + 0.3 * L('comboKeep'),
      nearMul: 1 + 0.3 * L('nearMiss'),
      comboCap: L('comboCap') ? 5 : 4,
      headStartM: 150 * L('headStart'),
      scoreMul: 1 + 0.05 * L('scoreBoost'),
      luckyStart: L('luckyStart') > 0,
      xpMul: 1 + 0.15 * L('xpBoost'),
      treasureMul: 1 + 0.25 * L('treasure'),
    };
  }

  /* ── the tech tree ── */
  function nodeOpen(save, node) {
    if (!node.req) return true;
    for (let i = 0; i < node.req.length; ++i) if (!lvl(save, node.req[i])) return false;
    return true;
  }

  function nodeCost(save, id) {
    const node = NODE_BY_ID[id];
    const l = lvl(save, id);
    return l >= node.max ? 0 : cost(node, l);
  }

  /* 'ok' | 'max' | 'locked' | 'coins' */
  function canBuy(save, id) {
    const node = NODE_BY_ID[id];
    if (!node) return 'locked';
    if (lvl(save, id) >= node.max) return 'max';
    if (!nodeOpen(save, node)) return 'locked';
    if (save.coins < nodeCost(save, id)) return 'coins';
    return 'ok';
  }

  function buy(save, id) {
    if (canBuy(save, id) !== 'ok') return false;
    save.coins -= nodeCost(save, id);
    save.tree[id] = lvl(save, id) + 1;
    return true;
  }

  function treeSpent(save) {
    let n = 0;
    for (let i = 0; i < NODES.length; ++i) for (let l = 0; l < lvl(save, NODES[i].id); ++l) n += cost(NODES[i], l);
    return n;
  }

  /* ── cosmetics: kind 'char' | 'outfit' | 'trail' ── */
  function owns(save, kind, item) {
    const u = item.unlock;
    if (u.kind === 'free') return true;
    return !!save.owned[kind + ':' + item.id];
  }

  /* can it be bought right now (coins or gems), and for what */
  function price(item) {
    const u = item.unlock;
    if (u.kind === 'coins') return { coins: u.n };
    if (u.kind === 'gems') return { gems: u.n };
    return null;
  }

  function buyCosmetic(save, kind, item) {
    const p = price(item);
    if (!p || owns(save, kind, item)) return false;
    if (p.coins && save.coins < p.coins) return false;
    if (p.gems && save.gems < p.gems) return false;
    if (p.coins) save.coins -= p.coins;
    if (p.gems) save.gems -= p.gems;
    save.owned[kind + ':' + item.id] = 1;
    return true;
  }

  /* the earned unlocks (level, achievement, boss) a profile qualifies for; returns new keys */
  function grantEarned(save, kind, list) {
    const out = [];
    for (let i = 0; i < list.length; ++i) {
      const it = list[i], u = it.unlock, k = kind + ':' + it.id;
      if (save.owned[k]) continue;
      const ok = (u.kind === 'level' && save.level >= u.n) || (u.kind === 'ach' && save.ach[u.id]) ||
        (u.kind === 'boss' && save.bosses[u.id]);
      if (ok) { save.owned[k] = 1; out.push(k); }
    }
    return out;
  }

  /* ── combo ── */
  function comboTier(combo, cap) {
    const T = C.COMBO_TIERS;
    let t = 0;
    for (let i = 1; i < T.length; ++i) if (combo >= T[i]) t = i;
    return Math.min(t, cap === undefined ? 4 : cap);
  }

  function comboMul(combo, cap) {
    return C.COMBO_MULS[comboTier(combo, cap)];
  }

  /* ── runner level ── */
  function xpNeeded(level) {
    return Math.round(300 * Math.pow(level, 1.4) / 10) * 10;
  }

  /* adds xp, returns the levels gained (rewards are paid by the caller) */
  function addXp(save, xp) {
    save.xp += Math.max(0, Math.round(xp));
    const gained = [];
    while (save.xp >= xpNeeded(save.level) && save.level < 99) {
      save.xp -= xpNeeded(save.level);
      ++save.level;
      gained.push(save.level);
    }
    return gained;
  }

  function levelReward(level) {
    return { coins: 100 + level * 40, gems: level % 5 === 0 ? 20 : 0 };
  }

  /* ── a finished run ── r: { mode, dist, coins, gems, score, finished, boss, w, zenRate, mutCoins, stats } */
  function runRewards(r, st) {
    let coins = r.coins * st.coinMul * (r.mutCoins || 1);
    if (r.mode === 'zen') coins *= st.zenRate;
    let bonus = 0;
    if (r.finished && r.mode === 'story') bonus += Math.round((60 + (r.w || 0) * 30) * (r.boss ? 3 : 1) * st.treasureMul);
    if (r.finished && r.mode === 'daily') bonus += 150;
    if (r.finished && r.mode === 'rush') bonus += Math.round(800 * st.treasureMul);
    const xp = (r.dist + r.score / 80) * st.xpMul * (r.mode === 'zen' ? 0.5 : 1);
    return { coins: Math.round(coins), bonus: bonus, gems: r.gems, xp: Math.round(xp) };
  }

  /* stars for a story stage */
  function starsFor(r) {
    if (!r.finished) return 0;
    let n = 1;
    if (r.boss ? r.hits <= 1 : r.coins >= Math.ceil(r.coinsTotal * 0.6)) ++n;
    if (r.shards >= 3) ++n;
    return n;
  }

  /* ── daily quests, streak, festival ── */
  function questsFor(dayKey) {
    const r = makeRng(hashString('runner-quests-' + dayKey));
    const pool = QUESTS.slice();
    const out = [];
    for (let i = 0; i < 3; ++i) {
      const q = pool.splice(r.int(0, pool.length - 1), 1)[0];
      const steps = Math.floor((q.hi - q.lo) / q.step);
      out.push({ id: q.id, n: q.lo + q.step * r.int(0, steps), done: 0, claimed: 0 });
    }
    return out;
  }

  /* a new local day: reset the counters, roll quests, advance or break the streak */
  function startDay(save, dayKey) {
    if (save.day.key === dayKey) return null;
    save.day = { key: dayKey, c: {}, quests: questsFor(dayKey) };
    const gap = daysBetween(save.streak.last, dayKey);
    save.streak.count = gap === 1 ? save.streak.count + 1 : 1;
    save.streak.last = dayKey;
    save.streak.best = Math.max(save.streak.best, save.streak.count);
    return { streak: save.streak.count, bonus: 40 * Math.min(save.streak.count, 7) };
  }

  function questProgress(save, q) {
    const def = NS.goals.QUEST_BY_ID[q.id];
    return Math.min(q.n, save.day.c[def.key] || 0);
  }

  /* festival tokens: returns the tier indices newly reached */
  function addTokens(save, eventId, n) {
    if (save.season.event !== eventId) save.season = { event: eventId, tokens: 0, claimed: [] };
    const before = save.season.tokens;
    save.season.tokens += n;
    const out = [];
    for (let i = 0; i < TIERS.length; ++i)
      if (before < TIERS[i].n && save.season.tokens >= TIERS[i].n) out.push(i);
    return out;
  }

  /* ── high scores ── */
  function addScore(save, entry) {
    save.scores.push(entry);
    save.scores.sort((a, b) => b.score - a.score);
    if (save.scores.length > C.MAX_HIGH_SCORES) save.scores.length = C.MAX_HIGH_SCORES;
    return save.scores.indexOf(entry);
  }

  /* metres from world x */
  function metres(x, x0) {
    return Math.max(0, Math.floor((x - x0) / C.PX_PER_M));
  }

  Object.assign(NS.rules, {
    newSave, migrateSave, computeStats, nodeOpen, nodeCost, canBuy, buy, treeSpent, owns, price, buyCosmetic, grantEarned,
    comboTier, comboMul, xpNeeded, addXp, levelReward, runRewards, starsFor, questsFor, startDay, questProgress, addTokens,
    addScore, metres, clamp
  });
})();
