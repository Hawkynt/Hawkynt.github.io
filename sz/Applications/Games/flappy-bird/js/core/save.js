;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Persistence in localStorage only: the Classic high-score table (the original key), the
     v3 save with migration from the v2 save and the old table, and the snapshot of the run
     in flight (autosave / continue). Owns G.highScores and G.save. Storage failures never
     throw - the game keeps running without them. */

  const { STORAGE_KEY, SAVE_KEY_V2, SAVE_KEY, RUN_KEY, MAX_HIGH_SCORES, MAX_ARCADE_SCORES, TREE, BIRD_DEFS, HATS, TRAILS, THEMES, ACHIEVEMENTS, POWERS } = NS.C;
  const G = NS.state;

  const STAT_KEYS = ['runs', 'gates', 'coins', 'perfects', 'comboMax', 'flaps', 'close', 'powers', 'crows', 'fevers', 'tokens',
    'zenMin', 'seconds', 'stages', 'dailyDays', 'bossNoHit', 'seasonMax', 'bossRush'];
  const BOSSES = SZ.FlappyCourse.BOSS_ORDER;

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) && v >= 0 ? v : d;
  }

  function str(v, d) {
    return typeof v === 'string' ? v : d;
  }

  function obj(v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  }

  function idList(v, valid, base) {
    const out = base.slice();
    if (Array.isArray(v))
      for (const id of v)
        if (typeof id === 'string' && valid.indexOf(id) >= 0 && out.indexOf(id) < 0)
          out.push(id);
    return out;
  }

  function defaultSave() {
    const stats = {};
    for (const k of STAT_KEYS)
      stats[k] = 0;
    const bosses = {};
    for (const k of BOSSES)
      bosses[k] = 0;
    return {
      v: 3,
      coins: 0,
      stars: {},
      best: { classic: 0, time: 0, arcade: 0, zen: 0, bossrush: 0, daily: { date: '', score: 0 } },
      arcadeScores: [],
      stats: stats,
      lastDaily: '',
      bosses: bosses,
      powersSeen: [],
      tree: {},
      birds: ['sunny'], bird: 'sunny',
      hats: ['none'], hat: 'none',
      trails: ['none', 'sparkle'], trail: 'sparkle',
      themes: ['auto'], theme: 'auto',
      achievements: {},
      seenCine: {},
      streak: { last: '', count: 0, best: 0 },
      daily: { date: '', progress: {}, claimed: [false, false, false], bonus: false },
      weekly: { week: '', progress: 0, claimed: false },
      season: { key: '', tokens: 0, claimed: 0 },
      badges: [],
      migratedFrom: 0
    };
  }

  /* Build a valid v3 save from whatever is stored: a v3 save, a v2 save, the old top-5
     table (numbers) - or nothing. Unknown fields are dropped, numbers are clamped. */
  function migrate(raw, rawV2, oldTable) {
    const d = defaultSave();
    let s = obj(raw);
    if (!s || s.v !== 3) {
      s = obj(rawV2);
      if (s)
        d.migratedFrom = 2;
    }
    if (s) {
      d.coins = Math.floor(num(s.coins, 0));
      const stars = obj(s.stars);
      if (stars)
        for (const st of SZ.FlappyCourse.STAGES)
          if (typeof stars[st.id] === 'number')
            d.stars[st.id] = Math.max(0, Math.min(3, Math.floor(stars[st.id])));
      const best = obj(s.best);
      if (best) {
        for (const k of ['classic', 'time', 'arcade', 'zen', 'bossrush'])
          d.best[k] = num(best[k], 0);
        const daily = obj(best.daily);
        if (daily) {
          d.best.daily.date = str(daily.date, '');
          d.best.daily.score = num(daily.score, 0);
        }
      }
      if (Array.isArray(s.arcadeScores))
        d.arcadeScores = s.arcadeScores.filter(e => obj(e) && typeof e.score === 'number' && isFinite(e.score))
          .map(e => ({ score: Math.floor(e.score), date: str(e.date, ''), bird: str(e.bird, 'sunny') }))
          .sort((a, b) => b.score - a.score).slice(0, MAX_ARCADE_SCORES);
      const stats = obj(s.stats);
      if (stats)
        for (const k of STAT_KEYS)
          d.stats[k] = num(stats[k], 0);
      d.lastDaily = str(s.lastDaily, '');
      const bosses = obj(s.bosses);
      if (bosses)
        for (const k of BOSSES)
          d.bosses[k] = Math.floor(num(bosses[k], 0));
      d.powersSeen = idList(s.powersSeen, POWERS.map(p => p.id), []);
      const tree = obj(s.tree);
      if (tree)
        for (const node of TREE)
          if (typeof tree[node.id] === 'number')
            d.tree[node.id] = Math.max(0, Math.min(node.costs.length, Math.floor(tree[node.id])));
      d.birds = idList(s.birds, BIRD_DEFS.map(b => b.id), ['sunny']);
      d.bird = d.birds.indexOf(s.bird) >= 0 ? s.bird : 'sunny';
      d.hats = idList(s.hats, HATS.map(h => h.id), ['none']);
      d.hat = d.hats.indexOf(s.hat) >= 0 ? s.hat : 'none';
      d.trails = idList(s.trails, TRAILS.map(t => t.id), ['none', 'sparkle']);
      d.trail = d.trails.indexOf(s.trail) >= 0 ? s.trail : 'sparkle';
      d.themes = idList(s.themes, THEMES.map(t => t.id), ['auto']);
      d.theme = d.themes.indexOf(s.theme) >= 0 ? s.theme : 'auto';
      const ach = obj(s.achievements);
      if (ach)
        for (const a of ACHIEVEMENTS)
          if (ach[a.id] === true)
            d.achievements[a.id] = true;
      const seen = obj(s.seenCine);
      if (seen)
        for (const k in seen)
          if (seen[k] === true && typeof NS.C.CINE[k] !== 'undefined')
            d.seenCine[k] = true;
      const streak = obj(s.streak);
      if (streak) {
        d.streak.last = str(streak.last, '');
        d.streak.count = Math.floor(num(streak.count, 0));
        d.streak.best = Math.max(d.streak.count, Math.floor(num(streak.best, 0)));
      }
      const daily = obj(s.daily);
      if (daily) {
        d.daily.date = str(daily.date, '');
        const pr = obj(daily.progress);
        if (pr)
          for (const k in pr)
            if (typeof pr[k] === 'number' && isFinite(pr[k]))
              d.daily.progress[k] = pr[k];
        if (Array.isArray(daily.claimed))
          d.daily.claimed = [0, 1, 2].map(i => daily.claimed[i] === true);
        d.daily.bonus = daily.bonus === true;
      }
      const weekly = obj(s.weekly);
      if (weekly) {
        d.weekly.week = str(weekly.week, '');
        d.weekly.progress = num(weekly.progress, 0);
        d.weekly.claimed = weekly.claimed === true;
      }
      const season = obj(s.season);
      if (season) {
        d.season.key = str(season.key, '');
        d.season.tokens = Math.floor(num(season.tokens, 0));
        d.season.claimed = Math.min(SZ.FlappySeasons.TRACK.length, Math.floor(num(season.claimed, 0)));
      }
      if (Array.isArray(s.badges))
        d.badges = s.badges.filter(b => typeof b === 'string').slice(0, 64);
      if (s.v === 3)
        d.migratedFrom = num(s.migratedFrom, 0);
    }
    // The old top-5 table: its best score is the Classic best
    if (Array.isArray(oldTable)) {
      const top = oldTable.filter(v => typeof v === 'number' && isFinite(v)).reduce((a, b) => Math.max(a, b), 0);
      if (top > d.best.classic)
        d.best.classic = top;
    }
    return d;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function loadHighScores() {
    const t = readJson(STORAGE_KEY);
    G.highScores = Array.isArray(t) ? t.filter(v => typeof v === 'number' && isFinite(v)).sort((a, b) => b - a).slice(0, MAX_HIGH_SCORES) : [];
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(G.highScores));
    } catch (_) {}
  }

  function addHighScore(s) {
    G.highScores.push(s);
    G.highScores.sort((a, b) => b - a);
    if (G.highScores.length > MAX_HIGH_SCORES)
      G.highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  /* returns the rank of the new entry, or -1 when it did not make the table */
  function addArcadeScore(score, date, bird) {
    const list = G.save.arcadeScores;
    const entry = { score: score, date: date, bird: bird };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    if (list.length > MAX_ARCADE_SCORES)
      list.length = MAX_ARCADE_SCORES;
    return list.indexOf(entry);
  }

  function getBestScore() {
    return G.highScores.length > 0 ? G.highScores[0] : 0;
  }

  function loadSave() {
    G.save = migrate(readJson(SAVE_KEY), readJson(SAVE_KEY_V2), readJson(STORAGE_KEY));
    return G.save;
  }

  function writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G.save));
    } catch (_) {}
  }

  /* ── The run in flight ── */

  function writeRun(snap) {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(snap));
    } catch (_) {}
  }

  function readRun() {
    const s = readJson(RUN_KEY);
    return s && s.v === 1 && typeof s.mode === 'string' ? s : null;
  }

  function clearRun() {
    try {
      localStorage.removeItem(RUN_KEY);
    } catch (_) {}
  }

  G.save = defaultSave();

  Object.assign(NS.save, {
    STAT_KEYS, defaultSave, migrate, loadHighScores, saveHighScores, addHighScore, addArcadeScore, getBestScore,
    loadSave, writeSave, writeRun, readRun, clearRun
  });
})();
