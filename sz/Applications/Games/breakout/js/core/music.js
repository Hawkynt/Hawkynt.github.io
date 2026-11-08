/* The soundtrack through the shared SZ.GameMusic: a theme per fortress (a bright synth groove
   in the gardens, a glassy waltz-like line in the citadel, a clanking swing in the foundry, a
   slow deep swell in the abyss, a pulsing dark anthem in the engine), a faster guardian theme
   for each, a menu theme, calm Zen and driving Blitz - electro, trance, funk, dubstep and house
   arranged by the shared engine into endless songs with build-ups and drops; every stage plays
   a song of its own made from its fortress's theme. Combos, multiple balls and the last ball
   raise the intensity so drums and lead come in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('bo-neon', 'electro', 57, 'mixolydian', [0, 6, 3, 4], 13, { bpm: 126 }),
    S('bo-glacier', 'trance', 62, 'lydian', [0, 1, 4, 3], 29, { bpm: 134 }),
    S('bo-foundry', 'funk', 52, 'dorian', [0, 3, 4, 3], 41, { bpm: 108 }),
    S('bo-abyss', 'dubstep', 50, 'minor', [0, 5, 6, 4], 57),
    S('bo-gloom', 'house', 53, 'harmonic', [0, 5, 3, 4], 71, { bpm: 126 }),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'dnb'));
  const MENU = S('bo-menu', 'synthwave', 57, 'major', [0, 4, 5, 3], 3, { bpm: 104 });
  const ZEN = S('bo-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 7, { volume: 0.8 });
  const BLITZ = S('bo-blitz', 'dnb', 57, 'minor', [0, 5, 6, 4], 63);

  function themeFor() {
    const s = G.screen, r = G.run;
    if (G.cine) return r && r.game && r.game.boss ? BOSS[r.world] : r ? WORLD[r.world || 0] : MENU;
    if ((s === 'game' || s === 'paused' || s === 'results') && r) {
      if (r.mode === 'zen') return ZEN;
      if (r.mode === 'blitz' || r.mode === 'daily') return BLITZ;
      if (r.game.boss) return BOSS[r.world || 0];
      const w = WORLD[(r.world || 0) % WORLD.length];
      /* every stage has a song of its own */
      return r.stage ? SZ.GameMusic.variant(w, r.stage) : w;
    }
    if (s === 'map') return WORLD[G.ui.world];
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (G.screen !== 'game' || !r || !r.game) return 0.3;
    if (r.mode === 'zen') return 0.2;
    const g = r.game;
    let k = 0.45;
    if (g.combo >= 6 || g.balls.length >= 3) k = 0.8;
    if (g.boss || g.combo >= 15 || (!g.infinite && g.lives === 0)) k = 1;
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

  Object.assign(NS.music, { WORLD, BOSS, MENU, ZEN, BLITZ, themeFor, intensity, update });
})();
