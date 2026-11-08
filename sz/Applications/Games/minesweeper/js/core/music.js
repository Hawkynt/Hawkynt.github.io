/* The soundtrack through the shared SZ.GameMusic: a theme per land (a pastoral lilt in Meadowmere,
   music-box bells over Frostfen, a dry driving tune in the Badlands, a watery swing in the
   Archive, a ticking minor march in the Citadel), a faster, darker theme for each guardian, a
   menu theme, a sparse thinking theme for Classic, calm Zen and a driving theme for Rush and
   Versus - funk, synthwave, house, epic, dubstep and drum & bass arranged by the shared engine
   into endless songs; every stage plays a song of its own made from its land's theme. A guardian's burning fuse and a close race raise the intensity so drums and lead come
   in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('ms-meadow', 'funk', 60, 'major', [0, 3, 4, 0], 17, { bpm: 104 }),
    S('ms-frost', 'synthwave', 62, 'lydian', [0, 1, 4, 3], 31, { bpm: 100 }),
    S('ms-ember', 'house', 52, 'harmonic', [0, 5, 3, 4], 43, { bpm: 122 }),
    S('ms-archive', 'funk', 55, 'dorian', [0, 3, 1, 4], 59, { bpm: 96 }),
    S('ms-rust', 'epic', 53, 'minor', [0, 6, 5, 4], 73, { bpm: 110 }),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'dubstep'));
  const MENU = S('ms-menu', 'synthwave', 57, 'major', [0, 4, 5, 3], 5, { bpm: 100 });
  const CLASSIC = S('ms-classic', 'ambient', 57, 'penta', [0, 4, 3, 4], 11, { bpm: 84, volume: 0.85 });
  const ZEN = S('ms-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 7, { volume: 0.8 });
  const RUSH = S('ms-rush', 'dnb', 57, 'minor', [0, 5, 6, 4], 63);

  function themeFor() {
    const s = G.screen, r = G.run;
    if (G.cine) return r && r.bossState ? BOSS[r.bossState.w] : r ? WORLD[r.world || 0] : MENU;
    if ((s === 'game' || s === 'paused' || s === 'results') && r) {
      if (r.mode === 'zen') return ZEN;
      if (r.mode === 'classic') return CLASSIC;
      if (r.mode === 'rush' || r.mode === 'versus') return RUSH;
      if (r.bossState) return BOSS[r.bossState.w];
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
    if (r.mode === 'zen' || r.mode === 'classic') return 0.3;
    let k = 0.45;
    if (r.bossState) k = r.bossState.fuse < 60 || r.bossState.rage ? 1 : 0.8;
    if (r.vs) k = Math.max(0.7, Math.min(1, 0.6 + r.rival.opened / Math.max(1, NS.engine.safeCount(r.rival))));
    if (r.timeLimit && r.timeLimit - r.t < 30) k = 1;
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

  Object.assign(NS.music, { WORLD, BOSS, MENU, CLASSIC, ZEN, RUSH, themeFor, intensity, update });
})();
