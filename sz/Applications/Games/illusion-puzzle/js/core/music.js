/* The soundtrack through the shared SZ.GameMusic: three themes take turns every few levels (a
   weightless ambient, a looping trance and a gentle synthwave) and every level plays a song of its
   own made from its theme; the ready screen has a calm menu theme. Each song is arranged by the
   shared engine into an endless one (intro, groove, build-up, drop, breakdown, every pass a little
   different). Walking the paths stays calm, a turn of perspective lifts it and a finished level
   pushes it into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);
  const THEMES = [
    S('ip-float', 'ambient', 60, 'lydian', [0, 4, 1, 4], 11, { bpm: 80 }),
    S('ip-loop', 'trance', 57, 'dorian', [0, 3, 6, 4], 23, { bpm: 122 }),
    S('ip-steps', 'synthwave', 55, 'major', [0, 4, 5, 3], 37, { bpm: 100 }),
  ];
  const MENU = S('ip-menu', 'ambient', 55, 'penta', [0, 3, 1, 4], 3, { bpm: 72 });
  const IN_LEVEL = { PLAYING: 1, PAUSED: 1, LEVEL_COMPLETE: 1, GAME_OVER: 1 };

  function themeFor() {
    const G = NS.state;
    if (!IN_LEVEL[G.state]) return MENU;
    const lv = G.currentLevel || 0;
    return variant(THEMES[Math.floor(lv / 4) % THEMES.length], 'level-' + lv);
  }

  function intensity() {
    const G = NS.state;
    if (G.state === 'LEVEL_COMPLETE') return 1;
    if (G.state !== 'PLAYING') return 0.3;
    return G.rotationProgress < 1 ? 0.7 : 0.4;
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
