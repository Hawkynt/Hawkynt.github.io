/* Calendar content from the local date alone: the six festivals (which one runs, its event id,
   token, decor, tint and the five-tier reward track that ends in a paddle and a ball trail),
   the days left, the mutators, the Daily Challenge recipe (seed and two mutators from the day)
   and the Weekly mutator. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const { makeRng, hashString, dayKey, weekKey } = NS.rng;

  const TIERS = [
    { n: 25, kind: 'shards', amount: 250 },
    { n: 60, kind: 'paddle' },
    { n: 110, kind: 'gems', amount: 30 },
    { n: 160, kind: 'trail' },
    { n: 220, kind: 'shards', amount: 1200 },
  ];

  const SEASONS = {
    frost: { id: 'frost', name: 'Frostfall', blurb: 'Snow drifts over every fortress', token: 'snowflakes', color: '#bff4ff', decor: 'snow', tint: 'rgba(170,210,255,0.10)', paddle: 'frost', trail: 'snow' },
    bloom: { id: 'bloom', name: 'Bloom Festival', blurb: 'Petals drift across the field', token: 'blossoms', color: '#ffb0d0', decor: 'petals', tint: 'rgba(255,190,220,0.08)', paddle: 'bloom', trail: 'petals' },
    sunfest: { id: 'sunfest', name: 'Sunfest', blurb: 'Long golden days', token: 'sun drops', color: '#ffe07a', decor: 'motes', tint: 'rgba(255,220,120,0.08)', paddle: 'sun', trail: 'sun' },
    harvest: { id: 'harvest', name: 'Harvest Moon', blurb: 'Amber leaves and a big moon', token: 'acorns', color: '#e0902a', decor: 'leaves', tint: 'rgba(230,140,50,0.09)', paddle: 'harvest', trail: 'leaves' },
    hollow: { id: 'hollow', name: 'Hollow Night', blurb: 'Pumpkins, candy and bats', token: 'candies', color: '#ff8a1a', decor: 'bats', tint: 'rgba(120,40,160,0.14)', paddle: 'hollow', trail: 'bats' },
    starfall: { id: 'starfall', name: 'Starfall Eve', blurb: 'Fireworks see the old year out', token: 'sparklers', color: '#ffd23a', decor: 'confetti', tint: 'rgba(60,40,140,0.12)', paddle: 'starfall', trail: 'confetti' },
  };
  const ORDER = ['frost', 'bloom', 'sunfest', 'harvest', 'hollow', 'starfall'];

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

  function eventId(date) {
    const d = date || new Date();
    const id = seasonIdFor(d);
    const y = d.getFullYear() - ((id === 'starfall' || id === 'frost') && d.getMonth() < 2 ? 1 : 0);
    return id + '-' + y;
  }

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

  /* mutators change a game's options; shards multiplies the shards it pays */
  const MUTATORS = [
    { id: 'fast', name: 'Turbo Ball', desc: 'The ball flies 30% faster - shards x1.4', shards: 1.4, speed: 1.3 },
    { id: 'tiny', name: 'Slim Paddle', desc: 'The paddle is a third shorter - shards x1.5', shards: 1.5, paddle: 0.67 },
    { id: 'nodrops', name: 'Bare Hands', desc: 'No power-ups drop - shards x1.3', shards: 1.3, drops: 0 },
    { id: 'party', name: 'Power Party', desc: 'Power-ups drop twice as often', shards: 1.1, drops: 2 },
    { id: 'dark', name: 'Blackout', desc: 'Bricks only show near the ball - shards x1.6', shards: 1.6, dark: true },
    { id: 'regen', name: 'Regrowth', desc: 'Broken bricks grow back every 20 s - shards x1.4', shards: 1.4, regrow: 20 },
    { id: 'heavy', name: 'Heavy Ball', desc: 'Gravity bends the ball down - shards x1.3', shards: 1.3, gravity: 120 },
    { id: 'multi', name: 'Triple Start', desc: 'Every life starts with three balls', shards: 1, multi: 3 },
  ];
  const MUT_BY_ID = {};
  for (const m of MUTATORS) MUT_BY_ID[m.id] = m;

  function dailyRecipe(date) {
    const key = dayKey(date || new Date());
    const r = makeRng(hashString('daily-' + key));
    const a = r.int(MUTATORS.length);
    let b = r.int(MUTATORS.length - 1);
    if (b >= a) ++b;
    return { key: key, seed: hashString('seed-' + key), mutators: [MUTATORS[a].id, MUTATORS[b].id] };
  }

  function weeklyMutator(date) {
    const r = makeRng(hashString('week-' + weekKey(date || new Date())));
    return MUTATORS[r.int(MUTATORS.length)];
  }

  NS.seasons = Object.assign(NS.seasons || {}, { TIERS, SEASONS, ORDER, seasonIdFor, seasonFor, eventId, daysLeft, MUTATORS, MUT_BY_ID, dailyRecipe, weeklyMutator });
})();
