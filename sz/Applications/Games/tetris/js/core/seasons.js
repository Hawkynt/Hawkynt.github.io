/* Calendar content from the local date alone: the six festivals (which one runs, its event id,
   token, decor, tint and the five-tier reward track that ends in a block skin and a lock effect),
   the days left, the mutators, the Daily Challenge recipe (seed and two mutators from the day)
   and the Weekly mutator. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const { makeRng, hashString, dayKey, weekKey } = NS.rng;

  const TIERS = [
    { n: 15, kind: 'shards', amount: 250 },
    { n: 40, kind: 'skin' },
    { n: 70, kind: 'gems', amount: 30 },
    { n: 100, kind: 'effect' },
    { n: 140, kind: 'shards', amount: 1200 },
  ];

  const SEASONS = {
    frost: { id: 'frost', name: 'Frostfall', blurb: 'Snow settles on every stack', token: 'snowflakes', color: '#bff4ff', decor: 'snow', tint: 'rgba(170,210,255,0.10)', skin: 'frost', effect: 'snow' },
    bloom: { id: 'bloom', name: 'Bloom Festival', blurb: 'Petals drift across the board', token: 'blossoms', color: '#ffb0d0', decor: 'petals', tint: 'rgba(255,190,220,0.08)', skin: 'bloom', effect: 'petals' },
    sunfest: { id: 'sunfest', name: 'Sunfest', blurb: 'Long golden days', token: 'sun drops', color: '#ffe07a', decor: 'motes', tint: 'rgba(255,220,120,0.08)', skin: 'sun', effect: 'stars' },
    harvest: { id: 'harvest', name: 'Harvest Moon', blurb: 'Amber leaves and a big moon', token: 'acorns', color: '#e0902a', decor: 'leaves', tint: 'rgba(230,140,50,0.09)', skin: 'harvest', effect: 'embers' },
    hollow: { id: 'hollow', name: 'Hollow Night', blurb: 'Pumpkins, candy and bats', token: 'candies', color: '#ff8a1a', decor: 'bats', tint: 'rgba(120,40,160,0.14)', skin: 'hollow', effect: 'bats' },
    starfall: { id: 'starfall', name: 'Starfall Eve', blurb: 'Fireworks see the old year out', token: 'sparklers', color: '#ffd23a', decor: 'confetti', tint: 'rgba(60,40,140,0.12)', skin: 'starfall', effect: 'confetti' },
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

  /* mutators change a game's options; score multiplies the shards */
  const MUTATORS = [
    { id: 'fast', name: 'Overclock', desc: 'Gravity five levels faster - shards x1.4', shards: 1.4, levelUp: 5 },
    { id: 'rising', name: 'Rising Tide', desc: 'A garbage row every 12 s - shards x1.5', shards: 1.5, rise: 12 },
    { id: 'nohold', name: 'Empty Pockets', desc: 'No hold - shards x1.3', shards: 1.3, noHold: true },
    { id: 'orbs', name: 'Power Party', desc: 'Power orbs on half the pieces', shards: 1.1, orbs: 0.5 },
    { id: 'fog', name: 'Fog', desc: 'Only two pieces of preview - shards x1.2', shards: 1.2, preview: 2 },
    { id: 'gems', name: 'Gem Fever', desc: 'Starts with gem rows - each gem is worth 500', shards: 1.2, gems: 6 },
    { id: 'shaky', name: 'Earthquake', desc: 'The stack mirrors every 30 s - shards x1.5', shards: 1.5, mirror: 30 },
    { id: 'invisible', name: 'Ghost Blocks', desc: 'Locked blocks fade from view - shards x2', shards: 2, invisible: true },
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
