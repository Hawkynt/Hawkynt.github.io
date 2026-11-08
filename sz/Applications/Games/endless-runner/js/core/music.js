/* The soundtrack through the shared SZ.GameMusic: a theme per world (a bright house groove in the meadows, a hard electro drive through the canyon, a soaring trance line over the frost pass, a neon synthwave pulse in the metro, a breakneck drum & bass run through the Rift), a heavier theme for every guardian chase, a menu theme, calm Zen and a fast theme for Rush and the daily and weekly runs.
   Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop,
   breakdown, every pass a little different); every story stage plays a song of its own made from its
   world's theme. Guardians, long combos and the faster stretches raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('er-meadow', 'house', 57, 'major', [0, 4, 5, 3], 11, { bpm: 126 }),
    S('er-canyon', 'electro', 52, 'phrygian', [0, 1, 6, 4], 23, { bpm: 130 }),
    S('er-frost', 'trance', 62, 'lydian', [0, 1, 4, 3], 37, { bpm: 136 }),
    S('er-neon', 'synthwave', 53, 'minor', [0, 5, 6, 4], 41, { bpm: 116 }),
    S('er-rift', 'dnb', 50, 'harmonic', [0, 5, 3, 4], 59),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'dubstep'));
  const MENU = S('er-menu', 'synthwave', 57, 'major', [0, 5, 3, 4], 3, { bpm: 104 });
  const ZEN = S('er-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 5, { volume: 0.8 });
  const FAST = S('er-rush', 'dnb', 57, 'minor', [0, 5, 6, 4], 61);

  const variant = (song, key) => (SZ.GameMusic && key != null && key !== '' ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const s = G.screen, r = G.run;
    if (r && !r.demo && (s === 'playing' || s === 'paused' || s === 'cine' || s === 'results')) {
      const w = WORLD[Math.max(0, r.world || 0) % WORLD.length];
      if (r.mode === 'zen') return ZEN;
      if (r.boss) return BOSS[Math.max(0, r.world || 0) % BOSS.length];
      if (r.mode === 'rush' || r.mode === 'daily' || r.mode === 'weekly') return variant(FAST, r.mode + '-' + (r.world || 0));
      if (r.mode === 'story') return variant(w, r.stageId);
      return w;
    }
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (!r || G.screen !== 'playing' || r.demo) return 0.3;
    if (r.mode === 'zen') return 0.25;
    let k = 0.5 + Math.min(0.3, (r.combo || 0) / 30);
    if (r.boss) k = 1;
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
