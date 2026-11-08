/* The soundtrack through the shared SZ.GameMusic: a theme per world (a funky stroll through the clover meadow, a dusty house groove in the dunes, glassy trance on the glacier, a dubstep rumble at the volcano, synthwave in the neon city, a pocket chiptune in the classic world and a hard electro grid), a heavier theme for every boss, a menu theme, calm Zen and a fast theme for Rush, Time Attack and the Daily.
   Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop,
   breakdown, every pass a little different); every story stage plays a song of its own made from its
   world's theme. Bosses, combos and a running-out clock raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('sn-meadow', 'funk', 60, 'major', [0, 3, 4, 0], 13, { bpm: 104 }),
    S('sn-desert', 'house', 52, 'harmonic', [0, 5, 3, 4], 29, { bpm: 122 }),
    S('sn-glacier', 'trance', 62, 'lydian', [0, 1, 4, 3], 31, { bpm: 132 }),
    S('sn-volcano', 'dubstep', 50, 'phrygian', [0, 1, 0, 6], 43),
    S('sn-neon', 'synthwave', 53, 'minor', [0, 5, 6, 4], 47, { bpm: 112 }),
    S('sn-nokia', 'chip', 60, 'major', [0, 4, 5, 3], 53, { bpm: 144 }),
    S('sn-tron', 'electro', 50, 'dorian', [0, 3, 6, 4], 67, { bpm: 128 }),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'dnb'));
  const MENU = S('sn-menu', 'chip', 57, 'major', [0, 5, 3, 4], 3, { bpm: 120 });
  const ZEN = S('sn-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 5, { volume: 0.8 });
  const FAST = S('sn-rush', 'dnb', 57, 'minor', [0, 5, 6, 4], 61);

  const variant = (song, key) => (SZ.GameMusic && key != null && key !== '' ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const s = G.screen, r = G.run;
    if (r && r.mode !== 'demo' && (s === 'playing' || s === 'paused' || s === 'cine' || s === 'results')) {
      const wi = Math.max(0, r.w || 0) % WORLD.length;
      if (r.mode === 'zen') return ZEN;
      if (r.boss) return BOSS[wi];
      if (r.mode === 'rush' || r.mode === 'time' || r.mode === 'daily') return variant(FAST, r.mode + '-' + Math.floor((r.stage || 1) / 4));
      if (r.mode === 'story') return variant(WORLD[wi], wi + '-' + (r.l || 0));
      return variant(WORLD[wi], 'arcade-' + Math.floor(((r.stage || 1) - 1) / 3));
    }
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (!r || G.screen !== 'playing' || r.mode === 'demo') return 0.3;
    if (r.mode === 'zen') return 0.25;
    let k = 0.5 + Math.min(0.3, (r.combo || 0) / 10);
    if (r.boss) k = 1;
    if (r.mode === 'time' && r.timeLeft > 0 && r.timeLeft < 15) k = 1;
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
