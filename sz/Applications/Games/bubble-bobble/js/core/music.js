/* The soundtrack through the shared SZ.GameMusic: a bouncy theme per kingdom (a sugary skip in
   the caverns, a music-box march in the tower, a swinging jungle groove, an airy waltz-like
   lilt in the clouds, a tense dusty tune in the castle), a faster guardian theme for each, a
   menu theme, calm Zen and driving Blitz - chiptune, funk, trance and epic songs arranged by the
   shared engine into endless songs with build-ups and drops; every stage plays a song of its
   own made from its kingdom's theme, endless runs a new one every five rooms. The hurry-up, the shade and the last life raise the
   intensity so drums and lead come in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('bb-candy', 'chip', 60, 'major', [0, 6, 3, 4], 13, { bpm: 138 }),
    S('bb-toys', 'chip', 62, 'lydian', [0, 1, 4, 3], 29, { bpm: 124 }),
    S('bb-jungle', 'funk', 52, 'dorian', [0, 3, 4, 3], 41, { bpm: 112 }),
    S('bb-clouds', 'trance', 55, 'lydian', [0, 5, 6, 4], 57, { bpm: 128 }),
    S('bb-castle', 'epic', 53, 'harmonic', [0, 5, 3, 4], 71, { bpm: 120 }),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'electro'));
  const MENU = S('bb-menu', 'chip', 57, 'major', [0, 4, 5, 3], 3, { bpm: 120 });
  const ZEN = S('bb-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 7, { volume: 0.8 });
  const BLITZ = S('bb-blitz', 'house', 57, 'minor', [0, 5, 6, 4], 63, { bpm: 132 });

  function themeFor() {
    const s = G.screen, r = G.run;
    if (G.cine) return r && r.game && r.game.boss ? BOSS[r.world] : r ? WORLD[r.world || 0] : MENU;
    if ((s === 'game' || s === 'paused' || s === 'results') && r) {
      if (r.mode === 'zen') return ZEN;
      if (r.mode === 'blitz' || r.mode === 'daily') return BLITZ;
      if (r.game.boss) return BOSS[r.world || 0];
      const w = WORLD[(r.world || 0) % WORLD.length];
      /* every stage has a song of its own; endless rooms move on every five rooms */
      if (r.stage) return SZ.GameMusic.variant(w, r.stage);
      const tier = Math.floor(((r.room || 1) - 1) / 5);
      return tier ? SZ.GameMusic.variant(w, r.mode + '-' + tier) : w;
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
    if (g.angry || g.bubbles.filter(b => b.trap).length >= 3) k = 0.8;
    if (g.boss || g.shade || (!g.infinite && g.lives === 0)) k = 1;
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
