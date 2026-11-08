/* The soundtrack through the shared SZ.GameMusic: a theme per realm (a crackling electro in the
   Ember Grove, flowing trance in the Tide Caverns, an earthy funk on the Stone Peaks, an airy
   synthwave over the Sky Ruins, an epic choir-like swell in the Elemental Sanctum), a menu theme
   and a theme for the bonus trials. Each theme is arranged by the shared engine into an endless
   song (intro, groove, build-up, drop, breakdown, every pass a little different); every level
   plays a song of its own made from its realm's theme. Thinking stays calm, running low on mana
   lifts the music and a solved puzzle pushes it into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const REALM = [
    S('fp-ember', 'electro', 52, 'harmonic', [0, 5, 3, 4], 11, { bpm: 118 }),
    S('fp-tide', 'trance', 57, 'dorian', [0, 3, 6, 4], 23, { bpm: 124 }),
    S('fp-stone', 'funk', 55, 'mixolydian', [0, 6, 3, 4], 37, { bpm: 98 }),
    S('fp-sky', 'synthwave', 62, 'lydian', [0, 1, 4, 3], 41, { bpm: 104 }),
    S('fp-sanctum', 'epic', 50, 'minor', [0, 6, 5, 4], 59, { bpm: 100 }),
  ];
  const MENU = S('fp-menu', 'ambient', 57, 'lydian', [0, 4, 1, 4], 3, { bpm: 76 });
  const TRIAL = S('fp-trial', 'house', 52, 'phrygian', [0, 1, 6, 4], 61, { bpm: 120 });
  const IN_LEVEL = { PLAYING: 1, PAUSED: 1, LEVEL_COMPLETE: 1, OUT_OF_MANA: 1 };
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const G = NS.state, lv = G.level;
    if (!lv || !IN_LEVEL[G.state]) return MENU;
    if (G.levelKind !== 'campaign') return variant(TRIAL, lv.id || G.levelIndex);
    return variant(REALM[Math.max(0, lv.realm || 0) % REALM.length], lv.id || G.levelIndex);
  }

  function intensity() {
    const G = NS.state;
    if (G.state === 'LEVEL_COMPLETE') return 1;
    if (G.state !== 'PLAYING') return 0.3;
    if (G.manaTotal && G.mana < G.manaTotal * 0.25) return 0.7;
    return 0.4;
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

  NS.music = { REALM, MENU, TRIAL, themeFor, intensity, update };
})();
