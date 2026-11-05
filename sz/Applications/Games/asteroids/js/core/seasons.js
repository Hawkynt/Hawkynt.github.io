/* Calendar logic from the local date, all pure: the four seasons and two festivals (Haunted
   Belt around Halloween, Starfall at the turn of the year) with their palette, decor, token
   rock and event-track rewards; the per-season track key; the daily challenge spec and daily
   quests; the weekly featured chapter; the play streak. Owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const { makeRng, hashString, dayKey, dayDiff, weekKey } = NS.rng;

  /* tint: overlay colour on the chapter backdrop; decor: the drifting seasonal particles */
  const SEASONS = {
    winter: { name: 'Deep Winter', token: 'snow', tokenName: 'Snowflakes', tokenCol: '#bfe8ff', decor: 'snow', tint: '#6ab0ff', accent: '#bfe8ff',
      blurb: 'Snowglobe rocks drift through every belt. Crack them for snowflakes.' },
    spring: { name: 'Bloomtide', token: 'bloom', tokenName: 'Blossoms', tokenCol: '#ff9ac8', decor: 'petals', tint: '#ff90c8', accent: '#ffc0e0',
      blurb: 'Bloomstones carry blossoms. The belt is in flower.' },
    summer: { name: 'Solar Maximum', token: 'sun', tokenName: 'Sunstones', tokenCol: '#ffd040', decor: 'flares', tint: '#ffb030', accent: '#fff0a0',
      blurb: 'The sun is loud this season. Sunstones burn bright.' },
    autumn: { name: 'Amberfall', token: 'leaf', tokenName: 'Amber Leaves', tokenCol: '#ff9a40', decor: 'leaves', tint: '#ff8a30', accent: '#ffd090',
      blurb: 'Amberleaf rocks shed glowing leaves across the field.' },
    halloween: { name: 'Haunted Belt', token: 'pumpkin', tokenName: 'Gourds', tokenCol: '#ff8a20', decor: 'wisps', tint: '#80ff60', accent: '#a0ff60', festival: true,
      blurb: 'Something grins from the rocks. Gourdrocks and wandering wisps.' },
    yearend: { name: 'Starfall Festival', token: 'gift', tokenName: 'Gifts', tokenCol: '#ff5a6a', decor: 'fireworks', tint: '#ff5ad0', accent: '#ffd25a', festival: true,
      blurb: 'Haven celebrates the turning year. Giftrocks and fireworks.' },
  };

  /* tokens needed per tier of a season's event track */
  const TRACK = [5, 12, 20, 30, 42, 56, 72, 90];

  function seasonOf(date) {
    const d = date || new Date();
    const m = d.getMonth() + 1, day = d.getDate();
    if ((m === 12 && day >= 20) || (m === 1 && day <= 6)) return 'yearend';
    if ((m === 10 && day >= 20) || (m === 11 && day <= 2)) return 'halloween';
    if (m === 12 || m <= 2) return 'winter';
    if (m <= 5) return 'spring';
    if (m <= 8) return 'summer';
    return 'autumn';
  }

  /* one track per season per year; a winter that starts in December belongs to that year */
  function seasonKey(date) {
    const d = date || new Date();
    const id = seasonOf(d);
    let y = d.getFullYear();
    if ((id === 'winter' || id === 'yearend') && d.getMonth() < 2) --y;
    return id + '-' + y;
  }

  /* the reward for reaching tier t (1-based) of a season's track */
  function trackReward(id, t) {
    const C = NS.cosmetics;
    const kinds = t === 2 ? ['trail'] : t === 4 ? ['skin'] : t === 6 ? ['shot'] : [];
    for (let k = 0; k < kinds.length; ++k) {
      const list = C.KINDS[kinds[k]];
      for (let i = 0; i < list.length; ++i) {
        const u = list[i].unlock;
        if (u.by === 'season' && u.season === id && u.tier === t) return { kind: kinds[k], id: list[i].id, name: list[i].name };
      }
    }
    if (t === TRACK.length) return { kind: 'badge', id: id, name: SEASONS[id].name + ' Champion', dust: 1000 };
    return { kind: 'dust', dust: 100 + t * 60 };
  }

  function tierFor(tokens) {
    let t = 0;
    while (t < TRACK.length && tokens >= TRACK[t]) ++t;
    return t;
  }

  /* the daily challenge: a seed and two distinct modifiers */
  function dailySpec(date) {
    const key = dayKey(date);
    const seed = hashString('daily:' + key);
    const rng = makeRng(seed);
    const all = Object.keys(NS.powerData.MODIFIERS);
    const a = all[Math.floor(rng() * all.length)];
    let b = a;
    while (b === a) b = all[Math.floor(rng() * all.length)];
    return { key: key, seed: seed, mods: [a, b] };
  }

  /* three distinct quests for the day */
  function questsFor(key) {
    const Q = NS.goalData.QUESTS;
    const rng = makeRng(hashString('quests:' + key));
    const ids = [];
    const out = [];
    while (out.length < 3) {
      const q = Q[Math.floor(rng() * Q.length)];
      if (ids.indexOf(q.id) >= 0) continue;
      ids.push(q.id);
      const gi = Math.floor(rng() * q.goals.length);
      out.push({ id: q.id, goal: q.goals[gi], p: 0, done: false, claimed: false, dust: q.dust + gi * 40 });
    }
    return out;
  }

  /* this week's featured chapter, with its double-stardust rock */
  function featured(date) {
    const wk = weekKey(date);
    const h = hashString('week:' + wk);
    const ch = h % 5;
    const types = ['iron', 'crystal', 'explosive', 'ice', 'lava', 'electric', 'gold'];
    return { week: wk, chapter: ch, rock: types[(h >>> 4) % types.length] };
  }

  /* streak bookkeeping for a play today; returns the first-play-of-day bonus (0 when not new) */
  function touchStreak(streak, today) {
    if (streak.last === today) return 0;
    const gap = streak.last ? dayDiff(streak.last, today) : 99;
    streak.count = gap === 1 ? streak.count + 1 : 1;
    streak.last = today;
    if (streak.count > streak.best) streak.best = streak.count;
    return 40 * Math.min(7, streak.count);
  }

  Object.assign(NS.seasons, {
    SEASONS, TRACK, seasonOf, seasonKey, trackReward, tierFor, dailySpec, questsFor, featured, touchStreak
  });
})();
