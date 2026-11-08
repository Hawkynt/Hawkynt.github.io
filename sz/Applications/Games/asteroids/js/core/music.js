/* The soundtrack through the shared SZ.GameMusic: a theme per chapter (a cold synthwave drift through the Kuiper belt, a dubstep grind in the Ember Belt, soaring trance in the Crystal Reach), a heavier theme for every boss, a menu theme, calm Zen and a fast theme for Rush and the Daily.
   Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop,
   breakdown, every pass a little different); every story level plays a song of its own made from its
   world's theme. Bosses, combos and the last ship raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('as-kuiper', 'synthwave', 50, 'minor', [0, 5, 6, 4], 13, { bpm: 112 }),
    S('as-ember', 'dubstep', 52, 'phrygian', [0, 1, 0, 6], 29),
    S('as-crystal', 'trance', 57, 'lydian', [0, 1, 4, 5], 37, { bpm: 136 }),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'dnb'));
  const MENU = S('as-menu', 'ambient', 53, 'lydian', [0, 4, 1, 4], 3, { bpm: 80 });
  const ZEN = S('as-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 5, { volume: 0.8 });
  const FAST = S('as-rush', 'electro', 57, 'minor', [0, 5, 6, 4], 61, { bpm: 134 });

  const variant = (song, key) => (SZ.GameMusic && key != null && key !== '' ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const s = G.screen, r = G.run;
    if (r && (s === 'playing' || s === 'paused' || s === 'cine')) {
      const wi = Math.max(0, r.chapter || 0) % WORLD.length;
      if (r.mode === 'zen') return ZEN;
      if (G.boss) return BOSS[wi];
      if (r.mode === 'rush' || r.mode === 'daily') return variant(FAST, r.mode);
      if (r.mode === 'story') return variant(WORLD[wi], wi + '-' + (r.level || 0));
      return variant(WORLD[wi], 'wave-' + Math.floor((r.wave || 0) / 4));
    }
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (!r || G.screen !== 'playing') return 0.3;
    if (r.mode === 'zen') return 0.25;
    let k = 0.5 + Math.min(0.3, (G.combo || 0) / 15);
    if (r.lives <= 1) k = Math.max(k, 0.8);
    if (G.boss) k = 1;
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

  Object.assign(NS.music, { WORLD, BOSS, MENU, ZEN, FAST, themeFor, intensity, update });
})();
