/* The songs as SZ.GameMusic song descriptions: a theme per district (house on the Neon Docks,
   synthwave in the Glass Gardens, electro in the Rust Foundry, drum & bass in the Undertow Club,
   trance up the Crown Spire), a boss piece per duel, the shop library in other styles, one song per
   festival, calm Zen songs, the menu theme and the styles the Daily Mix draws from. Story stages play
   variants of their district's theme, so every stage has a song of its own. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  const S = (id, name, style, root, scale, prog, seed, extra) =>
    Object.assign({ id: id, name: name, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});

  const DISTRICT = [
    S('rg-docks', 'Neon Docks', 'house', 57, 'minor', [0, 5, 3, 4], 101, { bpm: 118 }),
    S('rg-gardens', 'Glass Gardens', 'synthwave', 62, 'lydian', [0, 1, 4, 3], 202, { bpm: 106 }),
    S('rg-foundry', 'Rust Foundry', 'electro', 52, 'harmonic', [0, 5, 3, 4], 303, { bpm: 126 }),
    S('rg-club', 'Undertow Club', 'dnb', 55, 'minor', [0, 6, 5, 4], 404, { bpm: 164 }),
    S('rg-spire', 'Crown Spire', 'trance', 60, 'minor', [0, 5, 2, 6], 505, { bpm: 136 }),
  ];

  const BOSS = [
    S('rg-boss-gristle', 'Bass Baron', 'dubstep', 53, 'harmonic', [0, 5, 6, 4], 111, { bpm: 140 }),
    S('rg-boss-vesper', 'Glass Siren', 'synthwave', 58, 'phrygian', [0, 1, 5, 4], 222, { bpm: 112 }),
    S('rg-boss-anvil', 'Hammerfall', 'electro', 50, 'phrygian', [0, 1, 6, 4], 333, { bpm: 132 }),
    S('rg-boss-undertow', 'Riptide', 'dnb', 53, 'harmonic', [0, 5, 3, 4], 444, { bpm: 172 }),
    S('rg-boss-hush', 'The Last Silence', 'fm16war', 57, 'harmonic', [0, 5, 6, 4], 555, { bpm: 144 }),
  ];

  /* the thirty story songs' names, six per district (the sixth is the duel) */
  const STAGE_NAMES = [
    ['Harbour Lights', 'Crane Shuffle', 'Neon Tide', 'Container Groove', 'Last Ferry', 'Bass Baron'],
    ['Glasshouse', 'Prism Bloom', 'Night Orchid', 'Sundial Drive', 'Mirror Lake', 'Glass Siren'],
    ['Rivet Run', 'Spark Assembly', 'Molten Line', 'Gearbox Heart', 'Steam Choir', 'Hammerfall'],
    ['Deep End', 'Velvet Current', 'Pressure Drop', 'Sonar Love', 'Abyss Lights', 'Riptide'],
    ['First Step', 'Cloud Stair', 'Bell Tower', 'Starlit Hall', 'Crown Ascent', 'The Last Silence'],
  ];

  /* bought in the shop for Free Play */
  const SHOP = [
    S('rg-shop-funk', 'Rooftop Funk', 'funk', 55, 'dorian', [0, 3, 1, 4], 611, { price: 600 }),
    S('rg-shop-chip', 'Pixel Arcade', 'chip', 60, 'major', [0, 4, 5, 3], 612, { price: 600 }),
    S('rg-shop-epic', 'Skyline Anthem', 'epic', 53, 'minor', [0, 6, 5, 4], 613, { price: 800 }),
    S('rg-shop-step', 'Concrete Wobble', 'dubstep', 52, 'minor', [0, 5, 6, 4], 614, { price: 900 }),
    S('rg-shop-fm', 'Cartridge Hero', 'fm16', 57, 'dorian', [0, 3, 4, 3], 615, { price: 900 }),
    S('rg-shop-wave', 'Midnight Highway', 'synthwave', 59, 'minor', [0, 5, 3, 4], 616, { price: 700 }),
    S('rg-shop-house', 'Velvet Lounge', 'house', 62, 'dorian', [0, 3, 4, 0], 617, { price: 700 }),
    S('rg-shop-trance', 'Aurora Rush', 'trance', 57, 'lydian', [0, 1, 4, 3], 618, { price: 1000 }),
    S('rg-shop-dnb', 'Neon Velocity', 'dnb', 54, 'dorian', [0, 3, 1, 4], 619, { price: 1200 }),
    S('rg-shop-electro', 'Circuit Breaker', 'electro', 55, 'minor', [0, 6, 5, 4], 620, { price: 1000 }),
    S('rg-shop-war', 'Cartridge War', 'fm16war', 50, 'minor', [0, 5, 3, 4], 621, { price: 1400 }),
    S('rg-shop-funk2', 'Disco Satellite', 'funk', 58, 'mixolydian', [0, 6, 3, 4], 622, { price: 1200 }),
  ];

  const FESTIVAL = {
    frost: S('rg-fest-frost', 'Snowglobe Waltz', 'synthwave', 62, 'major', [0, 4, 5, 3], 701),
    bloom: S('rg-fest-bloom', 'Petal Parade', 'funk', 60, 'major', [0, 3, 4, 0], 702),
    sunfest: S('rg-fest-sun', 'Beach Signal', 'house', 57, 'mixolydian', [0, 6, 3, 4], 703),
    harvest: S('rg-fest-harvest', 'Lantern Reel', 'chip', 55, 'dorian', [0, 3, 1, 4], 704),
    hollow: S('rg-fest-hollow', 'Pumpkin Stomp', 'electro', 52, 'harmonic', [0, 5, 6, 4], 705),
    starfall: S('rg-fest-starfall', 'Countdown', 'trance', 60, 'major', [0, 4, 5, 3], 706),
  };

  const ZEN = [
    S('rg-zen-1', 'Rain on Glass', 'ambient', 57, 'penta', [0, 3, 1, 4], 801, { volume: 0.9 }),
    S('rg-zen-2', 'Lantern Drift', 'fm16calm', 60, 'major', [0, 4, 3, 4], 802, { volume: 0.9 }),
    S('rg-zen-3', 'Slow Harbour', 'ambient', 55, 'minpenta', [0, 3, 4, 0], 803, { volume: 0.9 }),
  ];

  const MENU = S('rg-menu', 'Radio Afterglow', 'synthwave', 57, 'dorian', [0, 3, 4, 3], 900, { bpm: 104 });
  const RESULTS = S('rg-results', 'Afterglow', 'ambient', 57, 'major', [0, 4, 5, 3], 901, { volume: 0.8 });
  const DAILY_STYLES = ['house', 'synthwave', 'electro', 'funk', 'chip', 'trance', 'epic', 'fm16'];

  /* the song of a story stage: a variant of its district's theme (the duel plays the boss piece) */
  function stageSong(world, stage) {
    if (stage === 5) return Object.assign({}, BOSS[world], { name: STAGE_NAMES[world][5] });
    const v = SZ.GameMusic.variant(DISTRICT[world], 's' + stage);
    return Object.assign({}, v, { name: STAGE_NAMES[world][stage] });
  }

  const BY_ID = {};
  for (const s of DISTRICT.concat(BOSS, SHOP, ZEN, [MENU, RESULTS])) BY_ID[s.id] = s;
  for (const k in FESTIVAL) BY_ID[FESTIVAL[k].id] = FESTIVAL[k];

  NS.songData = { DISTRICT, BOSS, STAGE_NAMES, SHOP, FESTIVAL, ZEN, MENU, RESULTS, DAILY_STYLES, BY_ID, stageSong };
})();
