/* Calendar logic on the local date: which season is running (and its key, so an event track
   resets each year), how many days it has left, the daily challenge seed and modifiers, and the
   weekly featured challenge. Pure functions of a Date; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const { SEASONS, QUESTS } = NS.meta;
  const { MODIFIERS } = NS.content;
  const R = NS.rng;

  function byId(id) {
    for (let i = 0; i < SEASONS.length; ++i)
      if (SEASONS[i].id === id) return SEASONS[i];
    return SEASONS[0];
  }

  /* The season id for a date: yearend Dec 20 - Jan 6, else winter Dec-Feb, spring Mar-May,
     summer Jun-Aug, autumn Sep-Nov */
  function seasonId(date) {
    const m = date.getMonth(), d = date.getDate();
    if ((m === 11 && d >= 20) || (m === 0 && d <= 6)) return 'yearend';
    if (m === 11 || m <= 1) return 'winter';
    if (m <= 4) return 'spring';
    if (m <= 7) return 'summer';
    return 'autumn';
  }

  /* The year a running season started in, so January belongs to the winter that began in December */
  function seasonYear(date, id) {
    const y = date.getFullYear();
    if ((id === 'winter' || id === 'yearend') && date.getMonth() <= 1) return y - 1;
    return y;
  }

  function seasonEnd(date, id) {
    const y = date.getFullYear(), m = date.getMonth();
    switch (id) {
      case 'yearend': return m === 11 ? new Date(y + 1, 0, 7) : new Date(y, 0, 7);
      case 'winter': return m === 11 ? new Date(y, 11, 20) : new Date(y, 2, 1);
      case 'spring': return new Date(y, 5, 1);
      case 'summer': return new Date(y, 8, 1);
      default: return new Date(y, 11, 1);
    }
  }

  function current(date) {
    const d = date || new Date();
    const id = seasonId(d);
    const def = byId(id);
    const end = seasonEnd(d, id);
    const left = Math.max(0, Math.ceil((end - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000));
    return {
      id: id, def: def, key: id + '-' + seasonYear(d, id), daysLeft: left,
      spooky: id === 'autumn' && ((d.getMonth() === 9 && d.getDate() >= 20) || (d.getMonth() === 10 && d.getDate() <= 2))
    };
  }

  /* The daily challenge: a seed and three distinct modifiers, the same for everyone on that date */
  function daily(date) {
    const key = R.dayKey(date || new Date());
    const seed = R.hashString('daily:' + key);
    const rng = R.makeRng(seed);
    const pool = MODIFIERS.map(m => m.id);
    rng.shuffle(pool);
    const mods = pool.slice(0, 3);
    /* darkness and ice together are too cruel for a one-life run */
    if (mods.indexOf('dark') >= 0 && mods.indexOf('ice') >= 0) mods[mods.indexOf('ice')] = pool[3];
    return { key: key, seed: seed, mods: mods };
  }

  /* The weekly featured challenge: a bigger quest that stays a full week */
  function weekly(date) {
    const wk = R.weekNumber(date || new Date());
    const rng = R.makeRng(R.hashString('week:' + wk));
    const pool = QUESTS.filter(q => !q.best && q.stat !== 'zenMinutes');
    const q = rng.pick(pool);
    return { week: wk, id: q.id, stat: q.stat, goal: q.n[1] * 5, gems: q.gems * 6, text: q.text.replace('{n}', q.n[1] * 5) };
  }

  Object.assign(NS.season, {
    byId, seasonId, seasonYear, current, daily, weekly
  });
})();
