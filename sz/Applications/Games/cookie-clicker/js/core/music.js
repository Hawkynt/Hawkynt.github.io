/* The soundtrack through the shared SZ.GameMusic: one theme per era that grows from a cosy
   kitchen tune into a cosmic anthem (funk, synthwave, house, epic and trance arranged by the
   shared engine into endless songs with build-ups and drops), every trial a song of its own, a calm Zen Kitchen theme, a driving Bake-Off theme, a
   garden theme and a tense trial theme. The season colours every theme (bells in winter and at
   year end, a spooky scale at Halloween); Frenzies and storms raise the intensity so drums and
   lead come in. The theme follows the screen once every half second. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const ERA = [
    S('cc-era1', 'funk', 53, 'major', [0, 3, 4, 3], 11, { bpm: 92 }),
    S('cc-era2', 'funk', 60, 'mixolydian', [0, 6, 3, 4], 23, { bpm: 100 }),
    S('cc-era3', 'synthwave', 55, 'lydian', [0, 1, 4, 3], 37, { bpm: 108 }),
    S('cc-era4', 'house', 62, 'major', [0, 4, 5, 3], 41, { bpm: 120 }),
    S('cc-era5', 'funk', 58, 'major', [0, 5, 1, 4], 53, { bpm: 104 }),
    S('cc-era6', 'epic', 51, 'major', [0, 3, 5, 4], 67, { bpm: 96 }),
    S('cc-era7', 'synthwave', 57, 'dorian', [0, 3, 6, 4], 79, { bpm: 112 }),
    S('cc-era8', 'trance', 52, 'lydian', [0, 4, 5, 1], 97, { bpm: 132 }),
  ];
  const ZEN = S('cc-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 5, { bpm: 66, volume: 0.8 });
  const BAKE = S('cc-bake', 'electro', 57, 'minor', [0, 5, 6, 4], 131, { bpm: 140 });
  const GARDEN = S('cc-garden', 'funk', 60, 'penta', [0, 2, 3, 1], 17, { bpm: 88 });
  const TRIAL = S('cc-trial', 'epic', 50, 'harmonic', [0, 5, 3, 4], 151, { bpm: 116 });

  const cache = {};
  /* a theme coloured by the season, built once per pair */
  function flavour(song, season) {
    const key = song.id + ':' + season;
    if (cache[key]) return cache[key];
    const s = JSON.parse(JSON.stringify(song));
    s.id = key;
    s.layers = s.layers || {};
    if (season === 'winter' || season === 'yearend') s.layers.bells = { vol: (s.layers.bells ? s.layers.bells.vol : 0.025) * 1.3 };
    if (season === 'halloween' && s.scale !== 'penta') s.scale = s.scale === 'major' || s.scale === 'lydian' || s.scale === 'mixolydian' ? 'harmonic' : 'phrygian';
    if (season === 'summer') s.bpm = Math.round(s.bpm * 1.05);
    if (season === 'spring' && !s.layers.bells) s.layers.bells = { vol: 0.02 };
    return (cache[key] = s);
  }

  function themeFor() {
    const s = G.screen;
    if (s === 'zen') return ZEN;
    if (s === 'garden') return GARDEN;
    if (G.bake && (s === 'game' || s === 'paused')) return BAKE;
    if (G.run && G.run.trial && s !== 'title') return SZ.GameMusic ? SZ.GameMusic.variant(TRIAL, G.run.trial) : TRIAL;
    const run = G.run;
    const stage = s === 'title' ? Math.max(G.profile.stageMax, run ? run.stage : 0) : run ? run.stage : 0;
    return ERA[Math.max(0, Math.min(ERA.length - 1, stage))];
  }

  function intensity() {
    const s = G.screen;
    if (s === 'title' || s === 'zen') return 0.25;
    if (s !== 'game') return 0.3;
    const run = G.active();
    if (!run) return 0.4;
    let k = 0.45;
    if (run.buffs.length) k = 0.8;
    if (G.storm || run.buffs.length >= 2) k = 1;
    if (G.bake) k = Math.max(k, 0.9);
    return k;
  }

  let acc = 1;
  function update(dt) {
    const M = SZ.GameMusic;
    if (!M) return null;
    acc += dt;
    if (acc < 0.5) return null;
    acc = 0;
    const song = flavour(themeFor(), G.season);
    M.setIntensity(intensity());
    if (M.current !== song) M.play(song);
    return song;
  }

  Object.assign(NS.music, { ERA, ZEN, BAKE, GARDEN, TRIAL, flavour, themeFor, intensity, update });
})();
