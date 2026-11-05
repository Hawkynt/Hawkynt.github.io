;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Seasonal events from the local date, the event reward track, the daily twist, the
   * daily quests and the weekly featured challenge. Pure functions of a Date, so they
   * can be tested for any day of the year.
   *
   * Events (month/day ranges, inclusive):
   *   newyear  Dec 27 - Jan 5      Year-End Fireworks
   *   frost    Dec 1 - Feb 28/29   Winter Wonderflap (outside the fireworks days)
   *   bloom    Mar 1 - May 31      Blossom Festival
   *   sun      Jun 1 - Aug 31      Summer Splash
   *   spooky   Oct 15 - Nov 2      Spooky Flight
   *   harvest  Sep 1 - Nov 30      Harvest Moon (outside the spooky days)
   */

  const C = SZ.FlappyCourse;

  const EVENTS = {
    newyear: {
      id: 'newyear', name: 'Year-End Fireworks', token: 'Firework Star', tokenColor: '#ffd84a',
      tint: 'rgba(40,20,90,0.22)', accent: '#ffd84a', weather: 'fireworks',
      blurb: 'Light up the night sky and catch the falling firework stars.',
      rewards: { trail: 'fireworks', hat: 'party', bird: 'nova' }
    },
    frost: {
      id: 'frost', name: 'Winter Wonderflap', token: 'Snowflake', tokenColor: '#bfeaff',
      tint: 'rgba(160,200,255,0.16)', accent: '#bfeaff', weather: 'snow',
      blurb: 'Snow on every pipe. Gather snowflakes for the winter wardrobe.',
      rewards: { trail: 'snow', hat: 'santa', bird: 'frosty' }
    },
    bloom: {
      id: 'bloom', name: 'Blossom Festival', token: 'Painted Egg', tokenColor: '#ff9ad0',
      tint: 'rgba(255,170,220,0.12)', accent: '#ff9ad0', weather: 'petals',
      blurb: 'Petals in the wind and painted eggs hidden between the pipes.',
      rewards: { trail: 'petals', hat: 'bunny', bird: 'blossom' }
    },
    sun: {
      id: 'sun', name: 'Summer Splash', token: 'Seashell', tokenColor: '#ffcf8a',
      tint: 'rgba(255,220,120,0.10)', accent: '#4ad8ff', weather: 'glints',
      blurb: 'Long sunny days. Collect seashells on the summer breeze.',
      rewards: { trail: 'bubbles', hat: 'shades', bird: 'surf' }
    },
    harvest: {
      id: 'harvest', name: 'Harvest Moon', token: 'Golden Acorn', tokenColor: '#e8a03a',
      tint: 'rgba(255,140,40,0.12)', accent: '#ff9a3a', weather: 'autumn',
      blurb: 'Red leaves and a big moon. Pick up golden acorns for the harvest.',
      rewards: { trail: 'leaves', hat: 'beret', bird: 'maple' }
    },
    spooky: {
      id: 'spooky', name: 'Spooky Flight', token: 'Candy Corn', tokenColor: '#ff8a1e',
      tint: 'rgba(80,20,120,0.24)', accent: '#b45aff', weather: 'spooky',
      blurb: 'Pumpkins grin from the hills. Trick or treat between the pipes!',
      rewards: { trail: 'ghosts', hat: 'witch', bird: 'jack' }
    }
  };
  const EVENT_ORDER = ['frost', 'newyear', 'bloom', 'sun', 'harvest', 'spooky'];

  /* the reward track of every event: tokens needed and what each tier pays */
  const TRACK = [
    { need: 10, coins: 150 },
    { need: 30, reward: 'trail' },
    { need: 60, coins: 400 },
    { need: 100, reward: 'hat' },
    { need: 150, coins: 800 },
    { need: 220, reward: 'bird' },
    { need: 300, coins: 1500, badge: true }
  ];

  function md(date) {
    return (date.getMonth() + 1) * 100 + date.getDate();
  }

  function eventIdFor(date) {
    const v = md(date);
    if (v >= 1227 || v <= 105)
      return 'newyear';
    if (v >= 1201 || v <= 229)
      return 'frost';
    if (v >= 301 && v <= 531)
      return 'bloom';
    if (v >= 601 && v <= 831)
      return 'sun';
    if (v >= 1015 && v <= 1102)
      return 'spooky';
    return 'harvest';
  }

  /* the season key keeps one track per event and year; winter belongs to the year it began */
  function seasonKey(date) {
    const id = eventIdFor(date);
    let year = date.getFullYear();
    if ((id === 'frost' || id === 'newyear') && date.getMonth() < 2)
      --year;
    return id + '-' + year;
  }

  /* the last day of the current event, for the "n days left" note */
  function daysLeft(date) {
    const id = eventIdFor(date);
    let n = 0;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    while (n < 120) {
      d.setDate(d.getDate() + 1);
      if (eventIdFor(d) !== id)
        break;
      ++n;
    }
    return n + 1;
  }

  function current(date) {
    const ev = EVENTS[eventIdFor(date)];
    return { event: ev, key: seasonKey(date), daysLeft: daysLeft(date) };
  }

  function trackTier(tokens) {
    let tier = 0;
    while (tier < TRACK.length && tokens >= TRACK[tier].need)
      ++tier;
    return tier;
  }

  /* ── Daily twist: one rule change for the Daily Challenge, seeded by the date ── */
  const TWISTS = [
    { id: 'feather', name: 'Feather Fall', desc: 'Gravity is 15% weaker.', gravity: 0.85 },
    { id: 'gale', name: 'Gale Day', desc: 'Strong gusts blow in every land.', gusts: true },
    { id: 'narrow', name: 'Needle\'s Eye', desc: 'Gaps are 10% tighter, coins pay 50% more.', mods: { gapScale: 0.9 }, coinBonus: 0.5 },
    { id: 'goldfever', name: 'Gold Fever', desc: 'Every coin is worth double.', coinBonus: 1 },
    { id: 'party', name: 'Bubble Party', desc: 'A power-up bubble after every third pipe.', bubbleEvery: 3 },
    { id: 'night', name: 'Night Flight', desc: 'The lights are low - fly by the glow.', night: true },
    { id: 'crows', name: 'Crow Storm', desc: 'Storm crows everywhere.', mods: { crowBoost: 0.35 } },
    { id: 'turbo', name: 'Turbo Tuesday', desc: 'Everything moves 15% faster.', mods: { speedScale: 1.15 } }
  ];

  function dailyTwist(date) {
    const r = C.rng(C.hashSeed('twist-' + C.dateKey(date)));
    return TWISTS[Math.floor(r() * TWISTS.length)];
  }

  /* ── Daily quests: three per day from the pool, never the same kind twice ── */
  const QUESTS = [
    { id: 'gates', text: 'Pass {n} pipes', stat: 'gates', n: [40, 80, 150], reward: [60, 100, 160] },
    { id: 'coins', text: 'Collect {n} coins', stat: 'coins', n: [80, 160, 300], reward: [60, 100, 160] },
    { id: 'perfects', text: 'Fly {n} PERFECT passes', stat: 'perfects', n: [10, 25, 45], reward: [70, 110, 170] },
    { id: 'powers', text: 'Pop {n} power-up bubbles', stat: 'powers', n: [4, 8, 14], reward: [60, 100, 150] },
    { id: 'combo', text: 'Reach a combo of {n}', stat: 'comboMax', n: [5, 10, 15], reward: [70, 120, 180], max: true },
    { id: 'stages', text: 'Clear {n} story stage{s}', stat: 'stages', n: [1, 2, 4], reward: [80, 130, 200] },
    { id: 'zen', text: 'Fly {n} minutes in Zen', stat: 'zenMin', n: [2, 4, 8], reward: [60, 100, 150] },
    { id: 'arcade', text: 'Score {n} points in one Arcade run', stat: 'arcadeBest', n: [3000, 8000, 16000], reward: [70, 120, 190], max: true },
    { id: 'tokens', text: 'Collect {n} seasonal tokens', stat: 'tokens', n: [5, 12, 20], reward: [70, 110, 160] },
    { id: 'close', text: 'Make {n} CLOSE shaves', stat: 'close', n: [3, 6, 10], reward: [70, 110, 170] },
    { id: 'crows', text: 'Dodge {n} storm crows', stat: 'crows', n: [3, 8, 15], reward: [60, 100, 150] },
    { id: 'fever', text: 'Start FEVER {n} time{s}', stat: 'fevers', n: [1, 3, 5], reward: [70, 120, 180] }
  ];

  function dailyQuests(date) {
    const r = C.rng(C.hashSeed('quests-' + C.dateKey(date)));
    const pool = QUESTS.slice();
    const out = [];
    for (let i = 0; i < 3; ++i) {
      const k = Math.floor(r() * pool.length);
      const q = pool.splice(k, 1)[0];
      const tier = i;   // one easy, one medium, one hard
      out.push({ id: q.id, text: q.text.replace('{n}', q.n[tier]).replace('{s}', q.n[tier] === 1 ? '' : 's'), stat: q.stat, need: q.n[tier], reward: q.reward[tier], max: !!q.max });
    }
    return out;
  }

  /* ISO-like week key (Monday based) for the weekly featured challenge */
  function weekKey(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return C.dateKey(d);
  }

  const WEEKLY = [
    { id: 'w-gates', text: 'Pass 600 pipes this week', stat: 'gates', need: 600, reward: 600 },
    { id: 'w-perfect', text: 'Fly 150 PERFECT passes this week', stat: 'perfects', need: 150, reward: 600 },
    { id: 'w-coins', text: 'Collect 1500 coins this week', stat: 'coins', need: 1500, reward: 600 },
    { id: 'w-stages', text: 'Clear 10 story stages this week', stat: 'stages', need: 10, reward: 700 },
    { id: 'w-tokens', text: 'Collect 60 seasonal tokens this week', stat: 'tokens', need: 60, reward: 650 },
    { id: 'w-powers', text: 'Pop 50 power-up bubbles this week', stat: 'powers', need: 50, reward: 600 }
  ];

  function weeklyChallenge(date) {
    const r = C.rng(C.hashSeed('weekly-' + weekKey(date)));
    return WEEKLY[Math.floor(r() * WEEKLY.length)];
  }

  /* difference in whole days between two YYYY-MM-DD keys */
  function dayDiff(a, b) {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]), tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
    return Math.round((tb - ta) / 86400000);
  }

  SZ.FlappySeasons = Object.freeze({
    EVENTS, EVENT_ORDER, TRACK, TWISTS, QUESTS, WEEKLY, eventIdFor, seasonKey, daysLeft, current, trackTier,
    dailyTwist, dailyQuests, weekKey, weeklyChallenge, dayDiff
  });
})();
