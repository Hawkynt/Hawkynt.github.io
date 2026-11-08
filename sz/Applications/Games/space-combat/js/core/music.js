/* The soundtrack through the shared SZ.GameMusic: a theme per sector (a synthwave patrol through Kepler Reach, an electro dogfight in the Crimson Expanse, blazing trance at the Helios Corona, a dubstep grind in the Abyss Rift, an epic siege at the Void Citadel), a heavier theme for every boss, a menu theme and fast themes for Endless, the Daily and Boss Rush.
   Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop,
   breakdown, every pass a little different); every campaign mission plays a song of its own made from its
   world's theme. Bosses, crowded skies and a failing hull raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('sc-kepler', 'synthwave', 50, 'minor', [0, 5, 6, 4], 13, { bpm: 116 }),
    S('sc-crimson', 'electro', 52, 'harmonic', [0, 5, 3, 4], 29, { bpm: 130 }),
    S('sc-helios', 'trance', 57, 'lydian', [0, 1, 4, 3], 37, { bpm: 138 }),
    S('sc-abyss', 'dubstep', 50, 'phrygian', [0, 1, 0, 6], 47),
    S('sc-void', 'epic', 53, 'minor', [0, 6, 5, 4], 59, { bpm: 120 }),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'dnb'));
  const MENU = S('sc-menu', 'synthwave', 57, 'major', [0, 5, 3, 4], 3, { bpm: 100 });
  const FAST = S('sc-fast', 'dnb', 57, 'minor', [0, 5, 6, 4], 61);

  const variant = (song, key) => (SZ.GameMusic && key != null && key !== '' ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const s = G.screen, r = G.run;
    if (r && (s === 'playing' || s === 'paused' || s === 'results')) {
      const wi = Math.max(0, G.sector || 0) % WORLD.length;
      if (G.boss) return BOSS[wi];
      if (r.mode === 'campaign') return variant(WORLD[wi], 's' + r.sector + 'm' + r.index);
      if (r.mode === 'endless') return variant(WORLD[wi], 'endless-' + Math.floor(((r.wave || 1) - 1) / 5));
      return variant(FAST, r.mode + '-' + (r.idx || 0));
    }
    return MENU;
  }

  function intensity() {
    const r = G.run, p = G.player;
    if (!r || G.screen !== 'playing') return 0.3;
    let k = 0.5 + Math.min(0.3, ((G.enemies && G.enemies.length) || 0) / 40);
    if (p && p.maxHull && p.hull < p.maxHull * 0.3) k = Math.max(k, 0.85);
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

  Object.assign(NS.music, { WORLD, BOSS, MENU, FAST, themeFor, intensity, update });
})();
