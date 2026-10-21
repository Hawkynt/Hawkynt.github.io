/* localStorage persistence for best times and per-difficulty statistics. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const C = NS.constants;
  const S = NS.state;
  const ST = NS.store;

  /* ---- localStorage persistence ---- */
  ST.loadBestTimes = function loadBestTimes() {
    try {
      const raw = localStorage.getItem(C.STORAGE_KEY);
      if (!raw)
        return;
      const saved = JSON.parse(raw);
      for (const key of ['beginner', 'intermediate', 'expert'])
        if (saved[key] && typeof saved[key].time === 'number' && typeof saved[key].name === 'string') {
          S.bestTimes[key].time = saved[key].time;
          S.bestTimes[key].name = saved[key].name;
        }
    } catch (_) {
      // ignore corrupt data
    }
  };

  ST.saveBestTimes = function saveBestTimes() {
    try {
      localStorage.setItem(C.STORAGE_KEY, JSON.stringify(S.bestTimes));
    } catch (_) {}
  };

  ST.resetBestTimes = function resetBestTimes() {
    for (const key of ['beginner', 'intermediate', 'expert']) {
      S.bestTimes[key].time = 999;
      S.bestTimes[key].name = 'Anonymous';
    }
    ST.saveBestTimes();
  };

  ST.loadStats = function loadStats() {
    try {
      const raw = localStorage.getItem(C.STATS_KEY);
      if (!raw)
        return;
      const saved = JSON.parse(raw);
      for (const key of ['beginner', 'intermediate', 'expert'])
        if (saved[key]) {
          S.stats[key].played = saved[key].played || 0;
          S.stats[key].won = saved[key].won || 0;
          S.stats[key].streak = saved[key].streak || 0;
          S.stats[key].bestStreak = saved[key].bestStreak || 0;
        }
    } catch (_) {}
  };

  ST.saveStats = function saveStats() {
    try {
      localStorage.setItem(C.STATS_KEY, JSON.stringify(S.stats));
    } catch (_) {}
  };

  ST.resetStats = function resetStats() {
    for (const key of ['beginner', 'intermediate', 'expert']) {
      S.stats[key].played = 0;
      S.stats[key].won = 0;
      S.stats[key].streak = 0;
      S.stats[key].bestStreak = 0;
    }
    ST.saveStats();
  };

  ST.recordGameResult = function recordGameResult(won) {
    if (S.difficulty === 'custom' || !S.stats[S.difficulty])
      return;
    const s = S.stats[S.difficulty];
    ++s.played;
    if (won) {
      ++s.won;
      ++s.streak;
      if (s.streak > s.bestStreak)
        s.bestStreak = s.streak;
    } else {
      s.streak = 0;
    }
    ST.saveStats();
  };
})();
