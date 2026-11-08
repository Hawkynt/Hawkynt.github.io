/* The soundtrack through the shared SZ.GameMusic: a theme per belt (a steady prospecting groove in
   the Kessler Drift, cold bells in the outer ice belts, a dusty pulse in the amber fields, a tense
   minor drive near the Lattice and a grand, slow theme at the Crown), a station theme for the hub,
   a menu theme, a driving theme for Gold Rush and the Daily Belt and a battle theme for Siege -
   electro, trance, house, drum & bass, epic, funk, ambient and dubstep arranged by the shared
   engine into endless songs with build-ups and drops. Every career trip plays a song of its own
   made from its belt's theme.
   Pirates and invaders on screen raise the intensity so drums and lead come in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const BELT = [
    S('sm-kessler', 'electro', 57, 'dorian', [0, 3, 4, 3], 19, { bpm: 120 }),
    S('sm-ice', 'trance', 62, 'lydian', [0, 1, 4, 3], 37, { bpm: 128 }),
    S('sm-amber', 'house', 52, 'harmonic', [0, 5, 3, 4], 53, { bpm: 122 }),
    S('sm-lattice', 'dnb', 50, 'minor', [0, 6, 5, 4], 67),
    S('sm-crown', 'epic', 55, 'major', [0, 5, 3, 4], 83, { bpm: 92 }),
  ];
  const STATION = S('sm-station', 'funk', 57, 'major', [0, 4, 5, 3], 7, { bpm: 92 });
  const MENU = S('sm-menu', 'ambient', 53, 'lydian', [0, 4, 1, 4], 3, { bpm: 76 });
  const RUSH = S('sm-rush', 'electro', 57, 'minor', [0, 5, 6, 4], 61, { bpm: 138 });
  const SIEGE = S('sm-siege', 'dubstep', 50, 'harmonic', [0, 5, 3, 4], 71);

  function themeFor() {
    const run = G.run;
    if (run && (G.screen === 'playing' || G.screen === 'paused' || G.screen === 'cine')) {
      if (run.mode === 'siege') return SIEGE;
      if (run.mode === 'rush' || run.mode === 'daily') return RUSH;
      const belt = BELT[Math.max(0, Math.min(BELT.length - 1, run.zoneIndex || 0))];
      /* every trip into a belt plays a song of its own made from the belt's theme */
      return run.mode === 'career' && run.seed && SZ.GameMusic ? SZ.GameMusic.variant(belt, 'trip-' + run.seed) : belt;
    }
    if (G.screen === 'station' || G.screen === 'results' || G.screen === 'tree' || G.screen === 'colonies') return STATION;
    return MENU;
  }

  function threats() {
    let n = G.pirates ? G.pirates.length : 0;
    if (G.enemies) n += G.enemies.length;
    return n;
  }

  function intensity() {
    if (!G.run || G.screen !== 'playing') return 0.3;
    const n = threats();
    if (G.run.mode === 'siege') return Math.min(1, 0.6 + n * 0.04);
    return Math.min(1, 0.4 + n * 0.12);
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

  Object.assign(NS.music, { BELT, STATION, MENU, RUSH, SIEGE, themeFor, intensity, update });
})();
