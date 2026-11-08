/* Calendar content from the local date alone: the six festivals (which one runs, its event id,
   token, decor, tint and the six-tier reward track with a tile set, a clearing effect and a flag),
   the days left, the mutators, the Daily Challenge recipe (seed and two mutators from the day)
   and the Weekly mutator. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const { makeRng, hashString, dayKey, weekKey } = NS.rng;

  const TIERS = [
    { n: 25, kind: 'shards', amount: 250 },
    { n: 60, kind: 'tile' },
    { n: 110, kind: 'gems', amount: 30 },
    { n: 160, kind: 'effect' },
    { n: 200, kind: 'flag' },
    { n: 260, kind: 'shards', amount: 1200 },
  ];

  const SEASONS = {
    frost: { id: 'frost', name: 'Frostfall', blurb: 'Snow drifts over every field', token: 'snowflakes', color: '#bff4ff', decor: 'snow', tint: 'rgba(170,210,255,0.10)', tile: 'frost', flag: 'snow', effect: 'snow' },
    bloom: { id: 'bloom', name: 'Bloom Festival', blurb: 'Petals drift across the fields', token: 'blossoms', color: '#ffb0d0', decor: 'petals', tint: 'rgba(255,190,220,0.08)', tile: 'bloom', flag: 'petal', effect: 'petals' },
    sunfest: { id: 'sunfest', name: 'Sunfest', blurb: 'Long golden days', token: 'sun drops', color: '#ffe07a', decor: 'motes', tint: 'rgba(255,220,120,0.08)', tile: 'sun', flag: 'sunflag', effect: 'sun' },
    harvest: { id: 'harvest', name: 'Harvest Moon', blurb: 'Amber leaves and a big moon', token: 'acorns', color: '#e0902a', decor: 'leaves', tint: 'rgba(230,140,50,0.09)', tile: 'harvest', flag: 'leaf', effect: 'harvest' },
    hollow: { id: 'hollow', name: 'Hollow Night', blurb: 'Pumpkins, candy and bats', token: 'candies', color: '#ff8a1a', decor: 'bats', tint: 'rgba(120,40,160,0.14)', tile: 'hollow', flag: 'pumpkin', effect: 'bats' },
    starfall: { id: 'starfall', name: 'Starfall Eve', blurb: 'Fireworks see the old year out', token: 'sparklers', color: '#ffd23a', decor: 'confetti', tint: 'rgba(60,40,140,0.12)', tile: 'starfall', flag: 'spark', effect: 'fireworks' },
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

  /* mutators change a field's options; shards multiplies the shards it pays */
  const MUTATORS = [
    { id: 'dense', name: 'Thick Sowing', desc: 'A quarter more mines - shards x1.4', shards: 1.4, mines: 1.25 },
    { id: 'smoke', name: 'Smoke', desc: 'Smoke drifts over the field and hides numbers - shards x1.3', shards: 1.3, fog: true },
    { id: 'dark', name: 'Lantern Night', desc: 'Only the light around your cursor shows the numbers - shards x1.5', shards: 1.5, dark: true },
    { id: 'noflags', name: 'No Flags', desc: 'Flags cannot be planted - shards x1.5', shards: 1.5, noFlags: true },
    { id: 'gems', name: 'Gem Rush', desc: 'Six more gems hide in the field', shards: 1.1, gems: 6 },
    { id: 'wide', name: 'Wide Field', desc: 'A field 40% bigger - shards x1.3', shards: 1.3, size: 1.4 },
    { id: 'clock', name: 'Against the Clock', desc: 'A tight time limit - shards x1.4', shards: 1.4, clock: true },
    { id: 'quake', name: 'Tremors', desc: 'Now and then flags shake loose - shards x1.3', shards: 1.3, quake: true },
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
