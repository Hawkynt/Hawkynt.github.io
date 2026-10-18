/* core/progress.js -- high scores and campaign progress (meta): stars, best waves, research, relics.
   Owns state: G.meta, G.lastResult
   Reads: constants, enemyTypes, maps, env, research, bossRewards and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STORAGE_HIGHSCORES, STORAGE_META, MAX_HIGH_SCORES, isFiniteNumber, num, clamp } = NS.constants;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { MAPS, CAMPAIGN, MAP_RANK, ORIGINAL_MAPS, nextMapOf, V1_WAVES } = NS.maps;
  const { highScoresBody } = NS.env;
  const { TREE_BY_ID } = NS.research;
  const { RELIC_BY_ID } = NS.bossRewards;

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE -- high scores and the saved game (format 2; format 1
     saves are converted once and then removed)
     ══════════════════════════════════════════════════════════════════ */

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      const list = raw ? JSON.parse(raw) : [];
      G.highScores = Array.isArray(list) ? list.filter(h => h && typeof h.map === 'string' && isFiniteNumber(h.waves)) : [];
    } catch (_) {
      G.highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(G.highScores));
    } catch (_) {}
  }

  function addHighScore(mapName, wavesCompleted) {
    G.highScores.push({ map: mapName, waves: wavesCompleted });
    G.highScores.sort((a, b) => b.waves - a.waves);
    if (G.highScores.length > MAX_HIGH_SCORES)
      G.highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < G.highScores.length; ++i) {
      const tr = document.createElement('tr');
      for (const v of [i + 1, G.highScores[i].map, G.highScores[i].waves]) {
        const td = document.createElement('td');
        td.textContent = String(v);
        tr.appendChild(td);
      }
      highScoresBody.appendChild(tr);
    }
    if (!G.highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  function defaultMeta() {
    return { version: 1, maps: MAPS.map(() => ({ stars: 0, best: 0, wins: 0 })), rp: 0, rpEarned: 0, tree: {}, relics: [], bossKills: {} };
  }

  function loadMeta() {
    let d = null;
    try {
      const raw = localStorage.getItem(STORAGE_META);
      if (raw) d = JSON.parse(raw);
    } catch (_) {
      d = null;
    }
    G.meta = defaultMeta();
    if (d && typeof d === 'object') {
      if (Array.isArray(d.maps))
        d.maps.forEach((m, i) => {
          if (i < MAPS.length && m && typeof m === 'object')
            G.meta.maps[i] = {
              stars: clamp(Math.floor(num(m.stars, 0)), 0, 3),
              // best: furthest wave ever reached on the map
              best: clamp(Math.floor(Math.max(num(m.best, 0), num(m.endless, 0))), 0, 9999),
              wins: Math.max(0, Math.floor(num(m.wins, 0)))
            };
        });
      G.meta.rp = Math.max(0, Math.floor(num(d.rp, 0)));
      G.meta.rpEarned = Math.max(G.meta.rp, Math.floor(num(d.rpEarned, 0)));
      if (d.tree && typeof d.tree === 'object')
        for (const id in d.tree)
          if (TREE_BY_ID[id] && Number.isInteger(d.tree[id]) && d.tree[id] > 0)
            G.meta.tree[id] = Math.min(d.tree[id], TREE_BY_ID[id].max);
      if (Array.isArray(d.relics))
        for (const id of d.relics)
          if (RELIC_BY_ID[id] && G.meta.relics.indexOf(id) < 0) G.meta.relics.push(id);
      if (d.bossKills && typeof d.bossKills === 'object')
        for (const k in d.bossKills)
          if (ENEMY_TYPES[k] && ENEMY_TYPES[k].boss) G.meta.bossKills[k] = Math.max(0, Math.floor(num(d.bossKills[k], 0)));
    } else {
      // First start with campaign progress: honour maps already won before
      for (const h of G.highScores) {
        const i = MAPS.findIndex(m => m.name === h.map);
        if (i >= 0 && h.waves >= V1_WAVES[i])
          G.meta.maps[i].stars = Math.max(G.meta.maps[i].stars, 1);
      }
      saveMeta();
    }
  }

  function saveMeta() {
    try {
      localStorage.setItem(STORAGE_META, JSON.stringify(G.meta));
    } catch (_) {}
  }

  function starsForRun() {
    const ratio = G.lives / G.runStartLives;
    return ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
  }

  function totalStars() {
    return G.meta.maps.reduce((a, m) => a + m.stars, 0);
  }

  function mapUnlocked(i) {
    const r = MAP_RANK[i];
    return r === 0 || G.meta.maps[i].stars > 0 || G.meta.maps[CAMPAIGN[r - 1]].stars > 0
      // The original maps opened one after another by index; those keys stay valid
      || (i > 0 && i < ORIGINAL_MAPS && G.meta.maps[i - 1].stars > 0)
      || (!!G.savedGameInfo && G.savedGameInfo.map === i);
  }

  // clearedNow: the required waves were just held; reached: furthest wave of the run
  function recordResult(clearedNow, reached) {
    const m = G.meta.maps[G.currentMap];
    const prevStars = m.stars;
    const stars = clearedNow ? starsForRun() : 0;
    const prevBest = m.best;
    m.best = Math.max(m.best, reached);
    if (clearedNow) {
      m.stars = Math.max(m.stars, stars);
      ++m.wins;
    }
    G.lastResult = { cleared: clearedNow || G.cleared, stars: clearedNow ? stars : (G.lastResult && G.lastResult.stars) || m.stars, prevStars, newBest: reached > prevBest, prevBest, waves: reached, t: 0,
      unlocked: clearedNow && prevStars === 0 && nextMapOf(G.currentMap) >= 0 };
    saveMeta();
  }

  NS.progress = { loadHighScores, saveHighScores, addHighScore, renderHighScores, loadMeta, saveMeta,
      totalStars, mapUnlocked, recordResult };

})();
