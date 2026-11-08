/* The soundtrack through the shared SZ.GameMusic: a theme per realm (a pastoral tune in the
   ruins, glassy arpeggios in the hollows, a slow swell in the temple, a hammering march in the
   forge, a starry anthem at the Spire), a guardian theme per realm, a menu theme, calm Zen,
   driving Sprint and Ultra, and a tense Master theme - chiptune, trance, synthwave, dubstep and
   electro arranged by the shared engine into endless songs with build-ups and drops. Every story
   stage plays a song of its own made from its realm's theme; endless play moves to a new one
   every five levels. The festival colours the menu theme;
   the stack height and danger raise the intensity so drums and lead come in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const REALM = [
    S('tt-verdant', 'chip', 55, 'major', [0, 4, 5, 3], 3, { bpm: 140 }),
    S('tt-crystal', 'trance', 57, 'dorian', [0, 3, 6, 4], 9, { bpm: 132 }),
    S('tt-sunken', 'synthwave', 50, 'minor', [0, 5, 3, 6], 21, { bpm: 104 }),
    S('tt-ember', 'dubstep', 52, 'phrygian', [0, 1, 0, 6], 33),
    S('tt-void', 'electro', 53, 'lydian', [0, 1, 4, 5], 47),
  ];
  const BOSS = REALM.map(s => bossOf(s, 'dnb'));
  const MENU = S('tt-menu', 'synthwave', 57, 'major', [0, 5, 3, 4], 2, { bpm: 100 });
  const ZEN = S('tt-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 5, { volume: 0.8 });
  const SPRINT = S('tt-sprint', 'dnb', 57, 'minor', [0, 5, 6, 4], 61);
  const MASTER = S('tt-master', 'electro', 50, 'harmonic', [0, 5, 3, 4], 77, { bpm: 140 });

  function themeFor() {
    const s = G.screen;
    const r = G.run;
    if (G.cine) return r && r.boss ? BOSS[r.world] : r ? REALM[r.world || 0] : MENU;
    if ((s === 'game' || s === 'paused' || s === 'results') && r) {
      const M = SZ.GameMusic;
      if (r.mode === 'zen') return ZEN;
      if (r.mode === 'sprint' || r.mode === 'ultra' || r.mode === 'daily') return SPRINT;
      if (r.mode === 'master' || r.mode === 'versus') return MASTER;
      if (r.boss) return BOSS[r.world || 0];
      const realm = REALM[(r.world || 0) % REALM.length];
      /* every stage has a song of its own; endless play moves on every five levels */
      if (r.stage) return M.variant(realm, r.stage);
      const lv = r.game && r.game.level ? Math.floor((r.game.level - 1) / 5) : 0;
      return lv ? M.variant(realm, r.mode + '-' + lv) : realm;
    }
    if (s === 'map') return REALM[G.ui.world];
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (G.screen !== 'game' || !r || !r.game) return 0.3;
    if (r.mode === 'zen') return 0.2;
    const h = NS.run.engineOf(r.game).stackHeight(r.game);
    let k = 0.4 + Math.min(0.4, h / 30);
    if (r.boss || r.vs || r.game.combo >= 2 || r.game.popping) k = Math.max(k, 0.8);
    if (h >= 14) k = 1;
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

  Object.assign(NS.music, { REALM, BOSS, MENU, ZEN, SPRINT, MASTER, themeFor, intensity, update });
})();
