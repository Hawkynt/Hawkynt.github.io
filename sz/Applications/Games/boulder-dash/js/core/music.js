/* The soundtrack through the shared SZ.GameMusic: a theme per chapter (a funky dig through the amber caves, trance in the frost caves, a deep synthwave in the grotto, a dubstep rumble in the magma caves, electro in the crystal caves), a menu theme, calm Zen and a fast theme for Time Attack and the Daily.
   Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop,
   breakdown, every pass a little different); every story cave plays a song of its own made from its
   world's theme. Gem combos and a running-out clock raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('bd-amber', 'funk', 57, 'dorian', [0, 3, 4, 3], 13, { bpm: 106 }),
    S('bd-frost', 'trance', 62, 'lydian', [0, 1, 4, 3], 29, { bpm: 130 }),
    S('bd-grotto', 'synthwave', 50, 'minor', [0, 5, 3, 6], 41, { bpm: 104 }),
    S('bd-magma', 'dubstep', 52, 'phrygian', [0, 1, 0, 6], 47),
    S('bd-crystal', 'electro', 55, 'lydian', [0, 1, 4, 5], 59, { bpm: 128 }),
  ];
  const MENU = S('bd-menu', 'chip', 57, 'major', [0, 4, 5, 3], 3, { bpm: 124 });
  const ZEN = S('bd-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 5, { volume: 0.8 });
  const FAST = S('bd-time', 'dnb', 57, 'minor', [0, 5, 6, 4], 61);

  const variant = (song, key) => (SZ.GameMusic && key != null && key !== '' ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const s = G.screen, r = G.run;
    if (r && (s === 'playing' || s === 'paused' || s === 'cinema')) {
      const wi = Math.max(0, r.ch || 0) % WORLD.length;
      if (r.mode === 'zen') return ZEN;
      if (r.mode === 'time' || r.mode === 'daily') return variant(FAST, r.mode + '-' + Math.floor(((r.n || 1) - 1) / 3));
      if (r.mode === 'story') return variant(WORLD[wi], wi + '-' + (r.lv || 0));
      return variant(WORLD[((r.n || 1) - 1) % WORLD.length], 'cave-' + (r.n || 1));
    }
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (!r || G.screen !== 'playing') return 0.3;
    if (r.mode === 'zen') return 0.25;
    let k = 0.5 + Math.min(0.3, (r.combo || 0) / 8);
    if (r.timeLeft > 0 && r.timeLeft < 20) k = 1;
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
    Mu.setIntensity(Math.max(0, Math.min(1, intensity())));
    if (Mu.current !== song) Mu.play(song);
    return song;
  }

  Object.assign(NS.music, { WORLD, MENU, ZEN, FAST, themeFor, intensity, update });
})();
