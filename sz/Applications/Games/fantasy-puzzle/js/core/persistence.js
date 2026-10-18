/* localStorage: the v2 save, high scores and the tutorial flag. Owns G.save, G.highScores,
   G.tutorialSeen. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { ROBES } = NS.consts;
  const { highScoresBody } = NS.context;

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-fantasy-puzzle';
  const STORAGE_SAVE = STORAGE_PREFIX + '-v2';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL_SEEN = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 10;

  function defaultSave() {
    return {
      v: 2,
      stars: {},
      shards: 0,
      tree: {},
      robe: 'violet',
      robes: ['violet'],
      daily: { date: '', solved: false, stars: 0 },
      stats: { casts: 0, levels: 0 },
      seenUnlocks: {}
    };
  }

  /* the v2 save is merged over the defaults field by field, so partial or
     older payloads never leave a hole; the legacy 'sz-fantasy-puzzle-progress'
     key belongs to the old level set and is deliberately left untouched */
  function loadSave() {
    G.save = defaultSave();
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.stars && typeof parsed.stars === 'object')
            G.save.stars = parsed.stars;
          G.save.shards = Math.max(0, parsed.shards | 0);
          if (parsed.tree && typeof parsed.tree === 'object')
            G.save.tree = parsed.tree;
          if (typeof parsed.robe === 'string' && ROBES[parsed.robe])
            G.save.robe = parsed.robe;
          if (Array.isArray(parsed.robes))
            G.save.robes = parsed.robes.filter(function(id) { return ROBES[id]; });
          if (G.save.robes.indexOf(G.save.robe) < 0)
            G.save.robes.push(G.save.robe);
          if (parsed.daily && typeof parsed.daily === 'object') {
            G.save.daily.date = typeof parsed.daily.date === 'string' ? parsed.daily.date : '';
            G.save.daily.solved = !!parsed.daily.solved;
            G.save.daily.stars = parsed.daily.stars | 0;
          }
          if (parsed.stats && typeof parsed.stats === 'object') {
            G.save.stats.casts = parsed.stats.casts | 0;
            G.save.stats.levels = parsed.stats.levels | 0;
          }
          if (parsed.seenUnlocks && typeof parsed.seenUnlocks === 'object')
            G.save.seenUnlocks = parsed.seenUnlocks;
        }
      }
    } catch (_) {
      G.save = defaultSave();
    }
  }

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(G.save));
    } catch (_) {}
  }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        G.highScores = JSON.parse(raw);
    } catch (_) {
      G.highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(G.highScores));
    } catch (_) {}
  }

  function addHighScore(levelName, stars) {
    G.highScores.push({ level: levelName, stars });
    G.highScores.sort((a, b) => b.stars - a.stars);
    if (G.highScores.length > MAX_HIGH_SCORES)
      G.highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < G.highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${G.highScores[i].level}</td><td>${'★'.repeat(G.highScores[i].stars)}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!G.highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  function loadTutorialSeen() {
    try {
      G.tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL_SEEN) === '1';
    } catch (_) {
      G.tutorialSeen = false;
    }
  }

  function saveTutorialSeen() {
    try {
      localStorage.setItem(STORAGE_TUTORIAL_SEEN, '1');
    } catch (_) {}
  }

  NS.store = { loadSave, writeSave, loadHighScores, saveHighScores, addHighScore, renderHighScores,
    loadTutorialSeen, saveTutorialSeen };
})();
