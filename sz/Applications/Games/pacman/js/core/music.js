/* The soundtrack through the shared SZ.GameMusic: a theme per world (electro downtown, a sugary chiptune in the gardens, trance across the glacier grid, a dark synthwave in the hollow woods, a dubstep rumble in the ember core), a heavier theme for every boss, a menu theme, calm Zen and a fast theme for Boss Rush and the Daily.
   Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop,
   breakdown, every pass a little different); every story maze plays a song of its own made from its
   world's theme. Bosses, power pellets and the last life raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('pm-neon', 'electro', 57, 'minor', [0, 5, 6, 4], 17, { bpm: 128 }),
    S('pm-candy', 'chip', 60, 'major', [0, 6, 3, 4], 29, { bpm: 140 }),
    S('pm-ice', 'trance', 62, 'lydian', [0, 1, 4, 3], 31, { bpm: 132 }),
    S('pm-haunt', 'synthwave', 50, 'harmonic', [0, 5, 3, 4], 43, { bpm: 108 }),
    S('pm-ember', 'dubstep', 52, 'phrygian', [0, 1, 0, 6], 59),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'dnb'));
  const MENU = S('pm-menu', 'chip', 57, 'major', [0, 4, 5, 3], 3, { bpm: 124 });
  const ZEN = S('pm-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 5, { volume: 0.8 });
  const FAST = S('pm-rush', 'house', 57, 'minor', [0, 5, 6, 4], 61, { bpm: 132 });

  const variant = (song, key) => (SZ.GameMusic && key != null && key !== '' ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const s = G.screen, r = G.run;
    if (r && !r.demo && (s === 'playing' || s === 'pause' || s === 'cine' || s === 'results')) {
      const wi = Math.max(0, (r.lvl && r.lvl.world != null ? r.lvl.world : r.world) || 0) % WORLD.length;
      if (r.mode === 'zen') return ZEN;
      if (r.lvl && r.lvl.bossId) return BOSS[wi];
      if (r.mode === 'bossrush' || r.mode === 'daily') return variant(FAST, r.mode);
      if (r.mode === 'story') return variant(WORLD[wi], wi + '-' + (r.stage || 0));
      return variant(WORLD[wi], 'maze-' + Math.floor((r.n || 0) / 3));
    }
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (!r || G.screen !== 'playing' || r.demo) return 0.3;
    if (r.mode === 'zen') return 0.25;
    let k = 0.5 + Math.min(0.3, (r.chain || 0) / 8);
    if (r.lives <= 1) k = Math.max(k, 0.8);
    if (r.lvl && r.lvl.bossId) k = 1;
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
