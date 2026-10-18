;(function() {
  'use strict';

  /* The save game (coins, stars, upgrade tree, bests, stats) and the high
     scores in localStorage, plus the career and upgrade questions asked of
     them. Owns G.save; reads the day result fields of G when a day ends. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { STORAGE_HIGHSCORES, STORAGE_SAVE, MAX_HIGH_SCORES } = NS.C;
  const { TREE, TREE_INDEX } = NS.Tree;
  const { sfx } = NS.juice;

  function defaultSave() {
    return {
      v: 2, coins: 0, stars: {}, tree: {},
      best: { endless: 0, daily: { date: '', earned: 0 } },
      stats: { days: 0, served: 0, perfect: 0 },
      coached: false
    };
  }

  /* Save v2: coins, career stars, the upgrade tree, mode bests and lifetime
     stats — an old v2 blob is merged over the defaults so nothing is lost. */
  function loadSave() {
    const s = defaultSave();
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.v === 2) {
          if (typeof o.coins === 'number') s.coins = o.coins;
          if (o.stars && typeof o.stars === 'object') s.stars = o.stars;
          if (o.tree && typeof o.tree === 'object') s.tree = o.tree;
          if (o.best && typeof o.best === 'object') {
            for (const k in o.best)
              if (k !== 'endless' && k !== 'daily') s.best[k] = o.best[k];
            if (typeof o.best.endless === 'number') s.best.endless = o.best.endless;
            if (o.best.daily && typeof o.best.daily === 'object')
              s.best.daily = { date: o.best.daily.date || '', earned: o.best.daily.earned || 0 };
          }
          if (o.stats && typeof o.stats === 'object') {
            s.stats.days = o.stats.days || 0;
            s.stats.served = o.stats.served || 0;
            s.stats.perfect = o.stats.perfect || 0;
          }
          if (o.coached === true) s.coached = true;
        }
      }
    } catch { /* file:// may block */ }
    return s;
  }

  G.save = loadSave();

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(G.save));
    } catch { /* file:// may block */ }
  }

  /* A day's money is kept even when the day fails; stars only count for the
     career, bests only for the modes, and the lifetime stats always tick. */
  function saveDayResult() {
    G.save.coins += G.earned;
    ++G.save.stats.days;
    G.save.stats.served += G.served;
    G.save.stats.perfect += G.perfectServed;
    if (G.mode === 'career') {
      const id = G.dayInfo.id;
      if (!(id in G.save.stars) || G.dayResult.stars > G.save.stars[id]) G.save.stars[id] = G.dayResult.stars;
      if (!(id in G.save.best) || G.earned > G.save.best[id]) G.save.best[id] = G.earned;
    } else if (G.mode === 'endless') {
      if (G.earned > G.save.best.endless) G.save.best.endless = G.earned;
    } else if (G.mode === 'daily') {
      if (G.save.best.daily.date !== G.dailyDate || G.earned > G.save.best.daily.earned)
        G.save.best.daily = { date: G.dailyDate, earned: G.earned };
    }
    writeSave();
  }

  /* ── career unlocking: a day needs one star on the day before it ── */
  function careerUnlocked(i) {
    if (i <= 0) return true;
    const prev = SZ.KitchenData.CAREER[i - 1];
    return !!prev && (G.save.stars[prev.id] || 0) >= 1;
  }

  /* A location is reached when its first day is playable. */
  function locationReached(locIndex) {
    return careerUnlocked(locIndex * 6);
  }

  /* ── upgrade tree helpers ── */
  function treeLevel(id) { return G.save.tree[id] || 0; }

  function nodeState(node) {
    const level = treeLevel(node.id);
    if (level >= node.costs.length) return 'maxed';
    for (const r of node.req)
      if (treeLevel(r[0]) < r[1]) return 'locked';
    if (G.save.coins < node.costs[level]) return 'expensive';
    return 'available';
  }

  function buyNode(id) {
    const node = TREE_INDEX[id];
    if (!node || nodeState(node) !== 'available') {
      sfx('error', { volume: 0.5 });
      return false;
    }
    G.save.coins -= node.costs[treeLevel(id)];
    ++G.save.tree[id];
    writeSave();
    sfx('powerup');
    sfx('coin', { pitch: 1.2, volume: 0.6 });
    return true;
  }

  function bestForMode() {
    if (G.mode === 'endless') return G.save.best.endless;
    if (G.mode === 'daily') return G.save.best.daily.date === G.dailyDate ? G.save.best.daily.earned : 0;
    return G.save.best[G.dayInfo.id] || 0;
  }

  function countStars() {
    let n = 0;
    for (const id of Object.keys(G.save.stars))
      n += G.save.stars[id] || 0;
    return n;
  }

  function countTreeMaxed() {
    let n = 0;
    for (const node of TREE)
      if (treeLevel(node.id) >= node.costs.length)
        ++n;
    return n;
  }

  /* A recipe shows in the book once one of its venues has been reached. */
  function recipeReached(id) {
    for (let li = 0; li < SZ.KitchenData.LOCATIONS.length; ++li)
      if (SZ.KitchenData.LOCATIONS[li].recipes.indexOf(id) >= 0 && locationReached(li))
        return true;
    return false;
  }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHighScores() {
    try {
      const scores = loadHighScores();
      scores.push({ day: G.dayInfo.id, money: G.earned, served: G.served, date: Date.now() });
      scores.sort((a, b) => b.money - a.money);
      while (scores.length > MAX_HIGH_SCORES) scores.pop();
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(scores));
    } catch { /* file:// may block */ }
  }

  NS.persist = { treeLevel, writeSave, saveDayResult, saveHighScores, loadSave, careerUnlocked,
    locationReached, nodeState, buyNode, bestForMode, countStars, countTreeMaxed,
    recipeReached, loadHighScores };

})();
