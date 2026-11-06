/* Calendar content from the local date alone: the six seasonal festivals (which one is running,
   its event id, token, decor, palette tint and reward track), the course mutators, the weekly
   featured Arcade mutator and the Daily Run recipe (world, course seed and two mutators seeded
   by the day). Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const { makeRng, hashString, dayKey, weekKey } = NS.rng;

  /* the reward track every festival shares; index 1 pays the festival trail, 2 its outfit */
  const TIERS = [
    { n: 10, kind: 'coins', amount: 300 },
    { n: 25, kind: 'trail' },
    { n: 45, kind: 'outfit' },
    { n: 70, kind: 'gems', amount: 25 },
    { n: 100, kind: 'coins', amount: 1500 },
  ];

  const SEASONS = {
    frost: { id: 'frost', name: 'Frostfall', blurb: 'Snow drifts over every course.', token: 'snowflake', color: '#bff4ff', accent: '#6fb8ff',
      decor: 'snow', tint: 'rgba(170,210,255,0.10)', world: 2, outfit: 'frostbite', trail: 'snow' },
    bloom: { id: 'bloom', name: 'Bloom Festival', blurb: 'Blossoms open along the track.', token: 'blossom', color: '#ffb0d0', accent: '#7ee07a',
      decor: 'petals', tint: 'rgba(255,190,220,0.08)', world: 0, outfit: 'blossom', trail: 'petals' },
    sunfest: { id: 'sunfest', name: 'Sunfest', blurb: 'Long days, warm sand and sea shells.', token: 'shell', color: '#ffe07a', accent: '#2ad0c0',
      decor: 'motes', tint: 'rgba(255,220,120,0.08)', world: 1, outfit: 'surf', trail: 'shells' },
    harvest: { id: 'harvest', name: 'Harvest Moon', blurb: 'Acorns tumble with the amber leaves.', token: 'acorn', color: '#e0902a', accent: '#a0582a',
      decor: 'leaves', tint: 'rgba(230,140,50,0.09)', world: 0, outfit: 'harvest', trail: 'leaves' },
    hollow: { id: 'hollow', name: 'Hollow Night', blurb: 'Candy, pumpkins and bats after dark.', token: 'candy', color: '#ff8a1a', accent: '#8a4aff',
      decor: 'bats', tint: 'rgba(120,40,160,0.14)', world: 4, outfit: 'pumpkin', trail: 'bats' },
    starfall: { id: 'starfall', name: 'Starfall Eve', blurb: 'Fireworks see the old year out.', token: 'firework', color: '#ffd23a', accent: '#ff5a8a',
      decor: 'confetti', tint: 'rgba(60,40,140,0.12)', world: 3, outfit: 'starfall', trail: 'confetti' },
  };
  const SEASON_ORDER = ['frost', 'bloom', 'sunfest', 'harvest', 'hollow', 'starfall'];

  function seasonIdFor(date) {
    const m = date.getMonth() + 1, d = date.getDate();
    if ((m === 12 && d >= 24) || (m === 1 && d <= 6)) return 'starfall';
    if (m === 12 || m === 1 || m === 2) return 'frost';
    if (m >= 3 && m <= 5) return 'bloom';
    if (m >= 6 && m <= 8) return 'sunfest';
    if ((m === 10 && d >= 20) || (m === 11 && d <= 2)) return 'hollow';
    return 'harvest';
  }

  function seasonFor(date) {
    return SEASONS[seasonIdFor(date || new Date())];
  }

  /* one event per festival per year; winter festivals belong to the year they started in */
  function eventId(date) {
    const d = date || new Date();
    const id = seasonIdFor(d);
    const y = d.getFullYear() - ((id === 'starfall' || id === 'frost') && d.getMonth() < 2 ? 1 : 0);
    return id + '-' + y;
  }

  /* days left in the running festival, today included */
  function daysLeft(date) {
    const d = new Date((date || new Date()).getTime());
    const id = seasonIdFor(d);
    let n = 0;
    while (n < 120 && seasonIdFor(d) === id) {
      d.setDate(d.getDate() + 1);
      ++n;
    }
    return n;
  }

  /* course mutators: score/coin factors and what they change */
  const MUTATORS = [
    { id: 'moon', name: 'Moon Run', desc: 'Low gravity: floaty jumps - coins x1.2', coins: 1.2, grav: 0.72 },
    { id: 'turbo', name: 'Turbo', desc: '20% faster - score x1.5', coins: 1.3, score: 1.5, speed: 1.2 },
    { id: 'frenzy', name: 'Coin Frenzy', desc: 'Every coin counts double', coins: 2 },
    { id: 'party', name: 'Power Party', desc: 'Power-ups twice as often', coins: 1.1, power: 0.5 },
    { id: 'night', name: 'Night Run', desc: 'Darkness - only your glow lights the way - coins x1.5', coins: 1.5, dark: true },
    { id: 'glass', name: 'Glass Runner', desc: 'No shields or revives - score x2', coins: 1.4, score: 2, glass: true },
    { id: 'gems', name: 'Gem Fever', desc: 'One coin in ten is a gem', coins: 1.1, gemRate: 0.1 },
    { id: 'pitfall', name: 'Pitfall', desc: 'Pits everywhere - coins x1.4', coins: 1.4, pits: true },
  ];
  const MUTATOR_BY_ID = {};
  for (let i = 0; i < MUTATORS.length; ++i) MUTATOR_BY_ID[MUTATORS[i].id] = MUTATORS[i];

  function weeklyMutator(date) {
    const h = hashString('runner-week-' + weekKey(date || new Date()));
    return MUTATORS[h % MUTATORS.length];
  }

  /* the Daily Run: world, course seed and two different mutators for the date */
  function dailyRecipe(date) {
    const key = dayKey(date || new Date());
    const r = makeRng(hashString('runner-daily-' + key));
    const a = r.int(0, MUTATORS.length - 1);
    let b = r.int(0, MUTATORS.length - 2);
    if (b >= a) ++b;
    return {
      key: key, seed: hashString('runner-daily-course-' + key), world: r.int(0, 4), lenM: 1500,
      mutators: [MUTATORS[a].id, MUTATORS[b].id],
    };
  }

  Object.assign(NS.seasons, {
    TIERS, SEASONS, SEASON_ORDER, MUTATORS, MUTATOR_BY_ID, seasonIdFor, seasonFor, eventId, daysLeft, weeklyMutator, dailyRecipe
  });
})();
