/* The soundtrack through the shared SZ.GameMusic: a theme per track look (trance through the
   nebula, a dubstep storm on the Ion Storm Speedway, a pulsing electro drift at the pulsar, drum &
   bass down Asteroid Alley, house around the solar flare, synthwave through the comet canyon,
   trance at the quasar ring, a hard electro run along the Void Serpent), a menu theme and a garage
   theme. Each theme is arranged by the shared engine into an endless song (intro, groove, build-up,
   drop, breakdown, every pass a little different); every track and its reverse play a song of
   their own. The race start, a boost, leading the field and the final lap raise the intensity:
   layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceRacing || (SZ.SpaceRacing = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const THEME = {
    nebula: S('sr-nebula', 'trance', 57, 'minor', [0, 5, 6, 4], 11, { bpm: 136 }),
    storm: S('sr-storm', 'dubstep', 50, 'phrygian', [0, 1, 0, 6], 23),
    pulsar: S('sr-pulsar', 'electro', 53, 'dorian', [0, 3, 6, 4], 37, { bpm: 130 }),
    asteroid: S('sr-asteroid', 'dnb', 52, 'minor', [0, 6, 5, 4], 41),
    solar: S('sr-solar', 'house', 57, 'mixolydian', [0, 6, 3, 4], 47, { bpm: 128 }),
    comet: S('sr-comet', 'synthwave', 55, 'minor', [0, 5, 3, 6], 53, { bpm: 116 }),
    quasar: S('sr-quasar', 'trance', 62, 'lydian', [0, 1, 4, 3], 59, { bpm: 140 }),
    void: S('sr-void', 'electro', 50, 'harmonic', [0, 5, 3, 4], 67, { bpm: 134 }),
  };
  const MENU = S('sr-menu', 'synthwave', 57, 'major', [0, 5, 3, 4], 3, { bpm: 104 });
  const GARAGE = S('sr-garage', 'funk', 55, 'dorian', [0, 3, 4, 3], 5, { bpm: 98 });
  const IN_RACE = { PLAYING: 1, PAUSED: 1, RESULTS: 1 };
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const G = NS.state, t = G.track;
    if (G.state === 'GARAGE' || G.state === 'TREE') return GARAGE;
    if (!t || !IN_RACE[G.state]) return MENU;
    return variant(THEME[t.theme] || THEME.nebula, t.key || t.name || 'track');
  }

  function intensity() {
    const G = NS.state;
    if (G.state === 'RESULTS') return 0.5;
    if (G.state !== 'PLAYING') return 0.3;
    if (!G.raceStarted) return 0.45;
    let k = 0.6;
    if (G.playerPlace === 1) k = 0.75;
    if (G.boostActive) k = 0.9;
    if (G.raceLaps && G.playerLap >= G.raceLaps) k = 1;
    return k;
  }

  let acc = 1;
  function update(dt) {
    const Mu = SZ.GameMusic;
    if (!Mu) return null;
    acc += dt;
    if (acc < 0.4) return null;
    acc = 0;
    const song = themeFor();
    Mu.setIntensity(intensity());
    if (Mu.current !== song) Mu.play(song);
    return song;
  }

  NS.music = { THEME, MENU, GARAGE, themeFor, intensity, update };
})();
