/* The soundtrack through the shared SZ.GameMusic: a theme per world (a tinkering funk in the
   workshop, a warm synthwave in the greenhouse, crisp trance in the cryo lab, a hot electro beat at
   the volcano forge, a floating ambient drift on the orbit station), a menu theme, a calm sandbox
   theme and a theme for trick shots and the Daily. Each theme is arranged by the shared engine
   into an endless song (intro, groove, build-up, drop, breakdown, every pass a little different);
   every level plays a song of its own made from its world's theme. Aiming stays calm, a shot in
   flight lifts the music and a solved level pushes it into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const WORLD = [
    S('pp-workshop', 'funk', 57, 'dorian', [0, 3, 4, 3], 11, { bpm: 100 }),
    S('pp-garden', 'synthwave', 60, 'major', [0, 4, 5, 3], 23, { bpm: 100 }),
    S('pp-icelab', 'trance', 62, 'lydian', [0, 1, 4, 3], 37, { bpm: 124 }),
    S('pp-forge', 'electro', 52, 'harmonic', [0, 5, 3, 4], 41, { bpm: 122 }),
    S('pp-space', 'ambient', 55, 'lydian', [0, 4, 1, 4], 59, { bpm: 80 }),
  ];
  const MENU = S('pp-menu', 'funk', 60, 'major', [0, 5, 3, 4], 3, { bpm: 96 });
  const SANDBOX = S('pp-sandbox', 'ambient', 57, 'penta', [0, 3, 1, 4], 5, { volume: 0.85 });
  const TRICK = S('pp-trick', 'house', 57, 'minor', [0, 5, 6, 4], 61, { bpm: 124 });
  const IN_RUN = { play: 1, pause: 1, results: 1 };
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const G = NS.G, r = G.run;
    if (!r || !IN_RUN[G.state]) return MENU;
    if (r.mode === 'sandbox') return SANDBOX;
    const wi = Math.max(0, typeof r.world === 'number' ? r.world : 0) % WORLD.length;
    const id = r.level && r.level.id;
    if (r.mode === 'campaign') return variant(WORLD[wi], id || 'w' + wi);
    return variant(TRICK, r.mode + '-' + (id || wi));
  }

  function intensity() {
    const G = NS.G, r = G.run;
    if (!r || G.state !== 'play') return 0.3;
    if (r.phase === 'won') return 1;
    if (r.phase === 'flight' || r.phase === 'fly' || r.phase === 'settle') return 0.75;
    return 0.35;
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

  NS.music = { WORLD, MENU, SANDBOX, TRICK, themeFor, intensity, update };
})();
