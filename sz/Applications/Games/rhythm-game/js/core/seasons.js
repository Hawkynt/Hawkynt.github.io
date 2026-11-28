/* Calendar content from the local date alone: the six festivals (which one runs, its event id, token,
   decor, tint, festival song and the six-tier reward track with discs, a note skin, crystals, a hit
   effect, a highway and a Record Crate), the days left, the mutators, the Daily Mix recipe (a song
   composed for the day in one of the Daily styles, two mutators) and the Weekly Remix (a song and a
   mutator per week). Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const { makeRng, hashString, dayKey, weekKey } = NS.rng;

  const TIERS = [
    { n: 25, kind: 'discs', amount: 400 },
    { n: 60, kind: 'note' },
    { n: 110, kind: 'crystals', amount: 40 },
    { n: 160, kind: 'effect' },
    { n: 220, kind: 'highway' },
    { n: 300, kind: 'crate', amount: 1 },
  ];

  const SEASONS = {
    frost: { id: 'frost', name: 'Frostfall', blurb: 'Snow falls on the neon', token: 'snowflakes', color: '#bff4ff', decor: 'snow', tint: 'rgba(170,210,255,0.10)', note: 'snow', effect: 'snow', highway: 'frost' },
    bloom: { id: 'bloom', name: 'Bloom Festival', blurb: 'Petals drift down every street', token: 'blossoms', color: '#ffb0d0', decor: 'petals', tint: 'rgba(255,190,220,0.08)', note: 'petal', effect: 'petals', highway: 'bloom' },
    sunfest: { id: 'sunfest', name: 'Sunfest', blurb: 'Beach parties until sunrise', token: 'sun drops', color: '#ffe07a', decor: 'motes', tint: 'rgba(255,220,120,0.08)', note: 'sun', effect: 'sun', highway: 'beach' },
    harvest: { id: 'harvest', name: 'Harvest Moon', blurb: 'Lanterns and a big amber moon', token: 'acorns', color: '#e0902a', decor: 'leaves', tint: 'rgba(230,140,50,0.09)', note: 'leaf', effect: 'leaves', highway: 'harvest' },
    hollow: { id: 'hollow', name: 'Hollow Night', blurb: 'Pumpkins, candy and bats on the dance floor', token: 'candies', color: '#ff8a1a', decor: 'bats', tint: 'rgba(120,40,160,0.14)', note: 'pumpkin', effect: 'bats', highway: 'hollow' },
    starfall: { id: 'starfall', name: 'Starfall Eve', blurb: 'Fireworks count the old year out', token: 'sparklers', color: '#ffd23a', decor: 'confetti', tint: 'rgba(60,40,140,0.12)', note: 'spark', effect: 'fireworks', highway: 'starfall' },
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
    return id + '-' + (d.getFullYear() - ((id === 'starfall' || id === 'frost') && d.getMonth() < 2 ? 1 : 0));
  }

  function daysLeft(date) {
    const d = new Date((date || new Date()).getTime());
    const id = seasonIdFor(d);
    let n = 0;
    while (n < 120 && seasonIdFor(d) === id) { d.setDate(d.getDate() + 1); ++n; }
    return n;
  }

  /* a mutator changes how a song plays; discs multiplies what it pays */
  const MUTATORS = [
    { id: 'mirror', name: 'Mirror', desc: 'The lanes are flipped', discs: 1.15, icon: 'spin' },
    { id: 'hidden', name: 'Hidden', desc: 'Notes fade out before the line', discs: 1.4, icon: 'eye' },
    { id: 'sudden', name: 'Sudden', desc: 'Notes appear late', discs: 1.35, icon: 'bolt' },
    { id: 'double', name: 'Double Time', desc: 'The song plays 15% faster', discs: 1.4, icon: 'fire' },
    { id: 'storm', name: 'Hush Storm', desc: 'Hush notes everywhere', discs: 1.3, icon: 'bomb' },
    { id: 'fragile', name: 'Fragile', desc: 'Misses drain twice the groove', discs: 1.35, icon: 'heart' },
    { id: 'nosurge', name: 'No Surge', desc: 'Surge is switched off', discs: 1.15, icon: 'shrink' },
    { id: 'sight', name: 'Sight Line', desc: 'Only the lower highway is clear', discs: 1.3, icon: 'wide' },
  ];
  const MUT_BY_ID = {};
  for (const m of MUTATORS) MUT_BY_ID[m.id] = m;

  function pickTwo(r) {
    const a = r.int(MUTATORS.length);
    let b = r.int(MUTATORS.length - 1);
    if (b >= a) ++b;
    return [MUTATORS[a].id, MUTATORS[b].id];
  }

  function dailyRecipe(date) {
    const key = dayKey(date || new Date());
    const r = makeRng(hashString('daily-' + key));
    const SD = NS.songData;
    const style = SD.DAILY_STYLES[r.int(SD.DAILY_STYLES.length)];
    const scales = ['minor', 'dorian', 'major', 'harmonic', 'mixolydian'];
    const song = { id: 'rg-daily-' + key, name: 'Daily Mix ' + key, style: style, root: 52 + r.int(10), scale: scales[r.int(scales.length)], prog: null, seed: hashString('seed-' + key) % 100000 };
    return { key: key, song: song, mutators: pickTwo(r), level: 0.5 + r.next() * 0.2, bars: 40 };
  }

  function weeklyRecipe(date) {
    const key = weekKey(date || new Date());
    const r = makeRng(hashString('week-' + key));
    const SD = NS.songData;
    const pool = SD.DISTRICT.concat(SD.SHOP);
    const base = pool[r.int(pool.length)];
    const song = Object.assign({}, SZ.GameMusic.variant(base, 'weekly-' + key), { name: base.name + ' (Weekly Remix)' });
    return { key: key, song: song, mutator: MUTATORS[r.int(MUTATORS.length)].id, level: 0.65, bars: 44 };
  }

  NS.seasons = Object.assign(NS.seasons || {}, { TIERS, SEASONS, ORDER, seasonIdFor, seasonFor, eventId, daysLeft, MUTATORS, MUT_BY_ID, pickTwo, dailyRecipe, weeklyRecipe });
})();
