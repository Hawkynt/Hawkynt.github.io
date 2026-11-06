/* Local-date logic: day keys, the season of a date (winter, spring, summer, autumn, Halloween
   week, year-end), the consecutive-day streak, the daily quest roll and the Daily Bake-Off
   modifier, all seeded by the local date so every player gets the same day. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const { QUESTS, MODIFIERS } = NS.eventData;

  const SEASON_NAMES = {
    winter: 'Winter Wonderland', spring: 'Spring Blossom', summer: 'Summer Picnic',
    autumn: 'Autumn Harvest', halloween: 'Halloween Night', yearend: 'Year-End Countdown',
  };

  function dayKey(d) {
    const m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /* whole days between two keys (b - a) */
  function dayDiff(a, b) {
    const pa = a.split('-'), pb = b.split('-');
    const ta = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]), tb = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((tb - ta) / 86400000);
  }

  function seasonOf(d) {
    const m = d.getMonth() + 1, day = d.getDate();
    if ((m === 12 && day >= 27) || (m === 1 && day <= 5)) return 'yearend';
    if ((m === 10 && day >= 20) || (m === 11 && day <= 2)) return 'halloween';
    if (m === 12 || m <= 2) return 'winter';
    if (m <= 5) return 'spring';
    if (m <= 8) return 'summer';
    return 'autumn';
  }

  /* updates the streak object for a play on `today`; returns true when the day is new */
  function touchStreak(streak, today) {
    if (streak.last === today) return false;
    const gap = streak.last ? dayDiff(streak.last, today) : 99;
    streak.count = gap === 1 ? streak.count + 1 : 1;
    streak.best = Math.max(streak.best || 0, streak.count);
    streak.last = today;
    return true;
  }

  /* +2% production per streak day, at most +20% */
  function streakBonus(count) {
    return Math.min(0.2, Math.max(0, count - 1) * 0.02);
  }

  /* three different quests for the day */
  function rollQuests(today) {
    const r = NS.rng.create('quests-' + today);
    const pool = QUESTS.slice();
    const out = [];
    while (out.length < 3) {
      const q = pool.splice(Math.floor(r.next() * pool.length), 1)[0];
      let n = r.int(q.min, q.max);
      if (n > 20) n = Math.round(n / 5) * 5;
      out.push({ id: q.id, n: n, progress: 0, done: false, reward: q.reward });
    }
    return out;
  }

  function dailyModifier(today) {
    const r = NS.rng.create('daily-' + today);
    return MODIFIERS[Math.floor(r.next() * MODIFIERS.length)];
  }

  Object.assign(NS.calendar, { SEASON_NAMES, dayKey, dayDiff, seasonOf, touchStreak, streakBonus, rollQuests, dailyModifier });
})();
