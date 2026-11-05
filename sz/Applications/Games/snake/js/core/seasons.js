/* Calendar content from the local date alone: the six seasonal festivals (which one is running,
   its event id, token, decor, palette and reward track), the weekly featured Arcade mutator and
   the Daily Garden recipe (theme, layout and two mutators seeded by the day). Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const { makeRng, hashString, dayKey, weekKey } = NS.rng;

  /* the reward track every festival shares; the cosmetics name their festival and tier */
  const TIERS = [
    { n: 10, kind: 'scales', amount: 60 },
    { n: 25, kind: 'trail' },
    { n: 45, kind: 'skin' },
    { n: 70, kind: 'hat' },
    { n: 100, kind: 'scales', amount: 300 },
  ];

  const SEASONS = {
    frost: { id: 'frost', name: 'Frostfall', blurb: 'Snowflakes drift over every board.', token: 'snowflake', color: '#bff4ff', accent: '#6fb8ff',
      decor: 'snow', tint: 'rgba(160,200,255,0.10)', theme: 2 },
    bloom: { id: 'bloom', name: 'Bloom Festival', blurb: 'Blossoms open across the Vale.', token: 'blossom', color: '#ffb0d0', accent: '#7ee07a',
      decor: 'petals', tint: 'rgba(255,190,220,0.08)', theme: 0 },
    sunfest: { id: 'sunfest', name: 'Sunfest', blurb: 'Long days, warm sand, sea shells.', token: 'shell', color: '#ffe07a', accent: '#2ad0c0',
      decor: 'motes', tint: 'rgba(255,220,120,0.08)', theme: 1 },
    harvest: { id: 'harvest', name: 'Harvest Moon', blurb: 'Acorns fall with the amber leaves.', token: 'acorn', color: '#e0902a', accent: '#a0582a',
      decor: 'leaves', tint: 'rgba(230,140,50,0.09)', theme: 0 },
    hollow: { id: 'hollow', name: 'Hollow Night', blurb: 'Candy, pumpkins and bats in the dark.', token: 'candy', color: '#ff8a1a', accent: '#8a4aff',
      decor: 'bats', tint: 'rgba(120,40,160,0.14)', theme: 3 },
    starfall: { id: 'starfall', name: 'Starfall Eve', blurb: 'Fireworks see the old year out.', token: 'firework', color: '#ffd23a', accent: '#ff5a8a',
      decor: 'confetti', tint: 'rgba(60,40,140,0.12)', theme: 4 },
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

  /* days left in the running festival */
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

  const MUTATORS = [
    { id: 'hornets', name: 'Hornet Season', desc: 'Hornets everywhere - scales x1.5', scales: 1.5 },
    { id: 'golden', name: 'Golden Hour', desc: 'Golden apples three times as often', scales: 1.2 },
    { id: 'fast', name: 'Fast Lane', desc: '25% faster - score x1.5', scales: 1.4, score: 1.5 },
    { id: 'portals', name: 'Portal Party', desc: 'Two portal pairs on every board', scales: 1.2 },
    { id: 'feast', name: 'Big Appetite', desc: 'Every fruit grows you twice', scales: 1.3 },
    { id: 'storm', name: 'Fruit Storm', desc: 'Fruit Rain every 20 seconds', scales: 1.2 },
    { id: 'night', name: 'Firefly Night', desc: 'Darkness - only your glow lights the way', scales: 1.6 },
    { id: 'ice', name: 'Ice Age', desc: 'Patches of ice on every board', scales: 1.4 },
  ];
  const MUTATOR_BY_ID = {};
  for (let i = 0; i < MUTATORS.length; ++i) MUTATOR_BY_ID[MUTATORS[i].id] = MUTATORS[i];

  function weeklyMutator(date) {
    const h = hashString('snake-week-' + weekKey(date || new Date()));
    return MUTATORS[h % MUTATORS.length];
  }

  /* The Daily Garden: theme, layout and two different mutators for the date */
  function dailyRecipe(date) {
    const key = dayKey(date || new Date());
    const r = makeRng(hashString('snake-daily-' + key));
    const motifs = ['open', 'pillars', 'rows', 'cross', 'rings', 'zigzag', 'rooms', 'maze'];
    const a = r.int(0, MUTATORS.length - 1);
    let b = r.int(0, MUTATORS.length - 2);
    if (b >= a) ++b;
    return {
      key: key, seed: hashString('snake-daily-board-' + key), theme: r.int(0, 4), motif: r.pick(motifs),
      mutators: [MUTATORS[a].id, MUTATORS[b].id],
    };
  }

  Object.assign(NS.seasons, {
    TIERS, SEASONS, SEASON_ORDER, MUTATORS, MUTATOR_BY_ID, seasonIdFor, seasonFor, eventId, daysLeft, weeklyMutator, dailyRecipe
  });
})();
