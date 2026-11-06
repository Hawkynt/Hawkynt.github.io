/* The player's profile, kept in localStorage only: experience and level, per-game
   statistics, win and day streaks, the daily featured game, seasons and the
   cosmetics they unlock. Nothing here touches the rules of any game. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const P = NS.profile = NS.profile || {};

  const KEY = 'sz-card-games-profile';
  const VERSION = 1;

  function blank() {
    return {
      v: VERSION, xp: 0, level: 1,
      games: {},            /* id -> { played, won, lost, streak, best, last } */
      totalPlayed: 0, totalWon: 0, winStreak: 0, bestWinStreak: 0,
      days: 0, dayStreak: 0, bestDayStreak: 0, lastDay: '',
      featuredDone: '', featuredCount: 0,
      achievements: {},     /* id -> day earned */
      unlocked: {},         /* cosmetic id -> true */
      favorites: {}, recent: [],
      seen: { intro: false }
    };
  }

  let data = blank();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') data = Object.assign(blank(), d);
      }
    } catch (_) {}
    data.v = VERSION;
  }

  let dirty = false;
  function save() {
    dirty = false;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {}
  }
  P.save = save;
  P.markDirty = () => { dirty = true; };
  P.flush = () => { if (dirty) save(); };

  /* ── calendar ── */
  function today(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  P.today = today;

  P.season = function(d) {
    const m = (d || new Date()).getMonth();
    return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
  };

  /* short events inside the seasons */
  P.event = function(d) {
    d = d || new Date();
    const m = d.getMonth() + 1, day = d.getDate();
    if ((m === 12 && day >= 20) || (m === 1 && day <= 6)) return { id: 'yuletide', name: 'Yuletide Festival', back: 'festive' };
    if ((m === 10 && day >= 20) || (m === 11 && day <= 2)) return { id: 'hallows', name: 'All Hallows Night', back: 'pumpkin' };
    if (m === 2 && day >= 7 && day <= 15) return { id: 'sweethearts', name: 'Sweethearts Week', back: 'sweetheart' };
    if (m === 6 && day >= 18 && day <= 26) return { id: 'midsummer', name: 'Midsummer Lights', back: 'sunburst' };
    return null;
  };

  const SEASON_NAMES = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' };
  P.seasonName = (s) => SEASON_NAMES[s || P.season()];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; ++i) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  P.featured = function(d) {
    const list = K.VARIANTS;
    return list[hash('featured|' + today(d)) % list.length];
  };

  /* ── levels ── */
  function needFor(level) { return 120 + (level - 1) * 45; }
  P.needFor = needFor;
  P.levelProgress = function() {
    return { level: data.level, xp: data.xp, need: needFor(data.level) };
  };

  const listeners = [];
  P.on = (fn) => listeners.push(fn);
  function emit(ev) { for (const fn of listeners) fn(ev); }

  function addXp(amount, reason) {
    if (amount <= 0) return;
    data.xp += amount;
    emit({ type: 'xp', amount, reason });
    while (data.xp >= needFor(data.level)) {
      data.xp -= needFor(data.level);
      ++data.level;
      emit({ type: 'level', level: data.level });
      unlockByLevel();
    }
  }
  P.addXp = addXp;

  function unlock(id, kind, name, cause) {
    if (data.unlocked[id]) return;
    data.unlocked[id] = true;
    emit({ type: 'unlock', id, kind, name, cause: cause || '' });
  }

  function unlockByLevel() {
    const CT = SZ.CardThemes;
    if (!CT) return;
    for (const [id, t] of Object.entries(CT.TABLE_THEMES))
      if (t.unlock && t.unlock.level && data.level >= t.unlock.level) unlock('table:' + id, 'Table', t.name, 'level');
    for (const [id, b] of Object.entries(CT.CARD_BACK_DESIGNS))
      if (b.unlock && b.unlock.level && data.level >= b.unlock.level) unlock('back:' + id, 'Card back', b.name, 'level');
  }

  function unlockBySeason() {
    const CT = SZ.CardThemes;
    if (!CT) return;
    const s = P.season();
    const ev = P.event();
    for (const [id, t] of Object.entries(CT.TABLE_THEMES))
      if (t.unlock && t.unlock.season === s) unlock('table:' + id, 'Table', t.name);
    for (const [id, b] of Object.entries(CT.CARD_BACK_DESIGNS))
      if (b.unlock && ((b.unlock.season && b.unlock.season === s) || (ev && b.unlock.event === ev.id)))
        unlock('back:' + id, 'Card back', b.name);
  }

  /* a cosmetic is usable when it needs nothing or has been earned */
  P.isUnlocked = function(kind, id) {
    const CT = SZ.CardThemes;
    const item = kind === 'table' ? CT.TABLE_THEMES[id] : CT.CARD_BACK_DESIGNS[id];
    if (!item || !item.unlock) return true;
    return !!data.unlocked[kind + ':' + id];
  };

  P.unlockHint = function(item) {
    const u = item && item.unlock;
    if (!u) return '';
    if (u.level) return 'Reach level ' + u.level;
    if (u.season) return 'Play in ' + SEASON_NAMES[u.season];
    if (u.event) return 'Play during the event';
    if (u.achievement) return 'Achievement';
    return '';
  };

  /* ── per-game bookkeeping ── */
  function game(id) {
    return data.games[id] || (data.games[id] = { played: 0, won: 0, lost: 0, streak: 0, best: 0, last: '' });
  }
  P.game = (id) => data.games[id] || { played: 0, won: 0, lost: 0, streak: 0, best: 0, last: '' };
  P.data = () => data;

  function touchDay() {
    const t = today();
    if (data.lastDay === t) return false;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    data.dayStreak = data.lastDay === today(y) ? data.dayStreak + 1 : 1;
    data.bestDayStreak = Math.max(data.bestDayStreak, data.dayStreak);
    data.lastDay = t;
    ++data.days;
    return true;
  }

  P.onGameStarted = function(id) {
    const first = touchDay();
    if (first) emit({ type: 'day', streak: data.dayStreak });
    const g = game(id);
    g.last = today();
    data.recent = [id].concat(data.recent.filter(x => x !== id)).slice(0, 6);
    unlockBySeason();
    if (first && data.dayStreak > 1) addXp(10 + 5 * Math.min(data.dayStreak, 10), 'Day streak ' + data.dayStreak);
    save();
  };

  /* outcome: 'win' | 'loss' | 'draw'; returns the reward breakdown */
  P.recordResult = function(id, outcome) {
    const g = game(id);
    const firstPlay = g.played === 0;
    const firstWin = outcome === 'win' && g.won === 0;
    ++g.played;
    ++data.totalPlayed;
    const lines = [];
    let xp = 8;
    lines.push(['Round played', 8]);
    if (firstPlay) { xp += 15; lines.push(['New game tried', 15]); }
    if (outcome === 'win') {
      ++g.won; ++data.totalWon;
      ++g.streak; g.best = Math.max(g.best, g.streak);
      ++data.winStreak; data.bestWinStreak = Math.max(data.bestWinStreak, data.winStreak);
      xp += 25; lines.push(['Victory', 25]);
      if (firstWin) { xp += 40; lines.push(['First win here', 40]); }
      if (data.winStreak > 1) {
        const b = 5 * Math.min(data.winStreak, 10);
        xp += b; lines.push(['Win streak x' + data.winStreak, b]);
      }
    } else if (outcome === 'loss') {
      ++g.lost;
      g.streak = 0;
      data.winStreak = 0;
    }
    const feat = P.featured();
    if (feat && feat.id === id) {
      lines.push(['Featured game bonus', xp]);
      xp *= 2;
      if (data.featuredDone !== today()) { data.featuredDone = today(); ++data.featuredCount; }
    }
    const before = { level: data.level, xp: data.xp, need: needFor(data.level) };
    addXp(xp, outcome);
    if (NS.achievements) NS.achievements.check({ id, outcome });
    save();
    return { xp, lines, before, after: P.levelProgress(), streak: data.winStreak, outcome };
  };

  P.toggleFavorite = function(id) {
    if (data.favorites[id]) delete data.favorites[id];
    else data.favorites[id] = true;
    save();
  };

  P.grantAchievement = function(a) {
    if (data.achievements[a.id]) return false;
    data.achievements[a.id] = today();
    emit({ type: 'achievement', a });
    if (a.xp) addXp(a.xp, a.name);
    if (a.reward) unlock(a.reward.kind + ':' + a.reward.id, a.reward.kind === 'table' ? 'Table' : 'Card back', a.reward.name);
    return true;
  };

  load();
  P.load = load;
  P.reset = function() { data = blank(); save(); };
})();
