/* The soundtrack through the shared SZ.GameMusic: three themes take turns every five levels (a
   floating synthwave, an orbiting trance and a slow electro pulse) and every level plays a song of
   its own made from its theme; the ready screen has a calm menu theme. Each song is arranged by the
   shared engine into an endless one (intro, groove, build-up, drop, breakdown, every pass a little
   different). Aiming stays calm, a launched shot lifts the music and a solved level pushes it into
   the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);
  const THEMES = [
    S('sp-drift', 'synthwave', 53, 'dorian', [0, 3, 6, 4], 11, { bpm: 100 }),
    S('sp-orbit', 'trance', 57, 'lydian', [0, 1, 4, 3], 23, { bpm: 124 }),
    S('sp-pulse', 'electro', 50, 'minor', [0, 5, 6, 4], 37, { bpm: 116 }),
  ];
  const MENU = S('sp-menu', 'ambient', 55, 'lydian', [0, 4, 1, 4], 3, { bpm: 76 });
  const IN_LEVEL = { PLAYING: 1, PAUSED: 1, AIMING: 1, LAUNCHED: 1, SOLVED: 1, GAME_OVER: 1 };

  function themeFor() {
    const G = NS.state;
    if (!IN_LEVEL[G.state]) return MENU;
    const lv = G.currentLevel || 0;
    return variant(THEMES[Math.floor(lv / 5) % THEMES.length], 'level-' + lv);
  }

  function intensity() {
    const G = NS.state;
    if (G.state === 'SOLVED') return 1;
    if (G.state === 'LAUNCHED') return 0.7;
    return G.state === 'PAUSED' || G.state === 'READY' ? 0.3 : 0.4;
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

  NS.music = Object.assign(NS.music || {}, { THEMES, MENU, themeFor, intensity, update });
})();
