/*
 * The soundtrack through the shared SZ.GameMusic: a theme per world (a sunny chiptune skip across
 * the meadows, a sparkling synthwave in the caverns, soaring trance on the frost peaks, a pounding
 * electro forge, an epic climb up the citadel), a heavier theme for every boss, a menu theme and
 * fast themes for Endless, Trials and the Daily. Each theme is arranged by the shared engine into
 * an endless song (intro, groove, build-up, drop, breakdown, every pass a little different); every
 * level plays a song of its own made from its world's theme. Bosses and the last heart raise the
 * intensity: layers come in and the music pushes into the drop.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const WORLD = [
    S('pf-meadow', 'chip', 60, 'major', [0, 4, 5, 3], 11, { bpm: 140 }),
    S('pf-caverns', 'synthwave', 53, 'dorian', [0, 3, 6, 4], 23, { bpm: 110 }),
    S('pf-peaks', 'trance', 62, 'lydian', [0, 1, 4, 3], 37, { bpm: 132 }),
    S('pf-forge', 'electro', 52, 'harmonic', [0, 5, 3, 4], 41, { bpm: 128 }),
    S('pf-citadel', 'epic', 55, 'major', [0, 5, 3, 4], 59, { bpm: 116 }),
  ];
  const BOSS = WORLD.map(s => S(s.id + '-boss', 'dubstep', s.root, s.scale === 'major' || s.scale === 'lydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1));
  const MENU = S('pf-menu', 'chip', 57, 'major', [0, 5, 3, 4], 3, { bpm: 124 });
  const FAST = S('pf-fast', 'dnb', 57, 'minor', [0, 5, 6, 4], 61);
  const IN_RUN = { play: 1, pause: 1, results: 1 };
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);

  function worldOf(r) {
    const w = typeof r.world === 'number' ? r.world : r.spec && typeof r.spec.world === 'number' ? r.spec.world : 0;
    return Math.max(0, w) % WORLD.length;
  }

  function themeFor() {
    const G = NS.state, r = G.run;
    if (!r || !IN_RUN[G.screen]) return MENU;
    const wi = worldOf(r);
    if (r.boss && !r.bossDone) return BOSS[wi];
    const id = r.spec && r.spec.id;
    if (r.mode === 'adventure') return variant(WORLD[wi], id || 'w' + wi);
    if (r.mode === 'endless') return variant(WORLD[wi], 'endless-' + (id || wi));
    return variant(FAST, r.mode + '-' + (id || ''));
  }

  function intensity() {
    const G = NS.state, r = G.run;
    if (!r || G.screen !== 'play') return 0.3;
    let k = 0.55;
    if (r.hearts <= 1 && r.maxHearts > 1) k = 0.85;
    if (r.boss && !r.bossDone) k = 1;
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

  NS.music = { WORLD, BOSS, MENU, FAST, themeFor, intensity, update };
})();
