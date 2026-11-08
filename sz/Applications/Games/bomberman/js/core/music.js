/* The soundtrack through the shared SZ.GameMusic: a theme per world (a funky romp through the gardens, glittering trance in the frost caverns, a pounding house groove in the foundry, electro on the neon circuit, an epic march in the Shadow Keep), a heavier theme for every boss, a menu theme, calm Zen and a fast theme for Rush and the Daily.
   Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop,
   breakdown, every pass a little different); every story level plays a song of its own made from its
   world's theme. Bosses, hurry-up time and chain blasts raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('bm-meadow', 'funk', 60, 'major', [0, 4, 5, 3], 13, { bpm: 108 }),
    S('bm-frost', 'trance', 62, 'lydian', [0, 1, 4, 3], 29, { bpm: 132 }),
    S('bm-foundry', 'house', 52, 'dorian', [0, 3, 4, 3], 41, { bpm: 124 }),
    S('bm-neon', 'electro', 53, 'minor', [0, 5, 6, 4], 47, { bpm: 128 }),
    S('bm-keep', 'epic', 50, 'harmonic', [0, 5, 3, 4], 59, { bpm: 112 }),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'dubstep'));
  const MENU = S('bm-menu', 'chip', 57, 'major', [0, 5, 3, 4], 3, { bpm: 128 });
  const ZEN = S('bm-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 5, { volume: 0.8 });
  const FAST = S('bm-rush', 'dnb', 57, 'minor', [0, 5, 6, 4], 61);

  const variant = (song, key) => (SZ.GameMusic && key != null && key !== '' ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const s = G.screen, r = G.run;
    if (r && (s === 'playing' || s === 'paused' || s === 'cine' || s === 'results')) {
      const wi = Math.max(0, r.world || 0) % WORLD.length;
      if (r.mode === 'zen') return ZEN;
      if (r.boss) return BOSS[wi];
      if (r.mode === 'rush' || r.mode === 'daily') return variant(FAST, r.mode + '-' + Math.floor((r.stagesCleared || 0) / 3));
      if (r.mode === 'story') return variant(WORLD[wi], wi + '-' + (r.levelIndex || 0));
      return variant(WORLD[wi], 'arena-' + Math.floor(((r.stage || 1) - 1) / 3));
    }
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (!r || G.screen !== 'playing') return 0.3;
    if (r.mode === 'zen') return 0.25;
    let k = 0.5 + Math.min(0.3, (r.combo || 0) / 6);
    if (r.hurryT > 0) k = 1;
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
