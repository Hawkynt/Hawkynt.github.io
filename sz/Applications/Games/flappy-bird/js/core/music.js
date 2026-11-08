/* The soundtrack through the shared SZ.GameMusic: a theme per biome (a bright house groove over
   the meadow, a dusty electro drive across the desert, glassy trance through the frost, a funky
   bounce in the forest, synthwave over the city, a dubstep rumble at the volcano), a heavier theme
   for every boss, a menu theme, calm Zen and a fast theme for Time Attack, Boss Rush and the Daily.
   Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop,
   breakdown, every pass a little different); every adventure stage plays a song of its own made
   from its biome's theme, and endless flights change song with the biome. Bosses, combos, fever
   and the last heart raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird || (SZ.FlappyBird = {});
  const G = NS.state;
  const C = NS.C;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const BIOME = {
    meadow: S('fb-meadow', 'house', 60, 'major', [0, 4, 5, 3], 11, { bpm: 124 }),
    desert: S('fb-desert', 'electro', 52, 'harmonic', [0, 5, 3, 4], 23, { bpm: 128 }),
    frost: S('fb-frost', 'trance', 62, 'lydian', [0, 1, 4, 3], 37, { bpm: 134 }),
    forest: S('fb-forest', 'funk', 55, 'dorian', [0, 3, 4, 3], 41, { bpm: 108 }),
    city: S('fb-city', 'synthwave', 53, 'minor', [0, 5, 6, 4], 47, { bpm: 112 }),
    volcano: S('fb-volcano', 'dubstep', 50, 'phrygian', [0, 1, 0, 6], 59),
  };
  const BOSS = S('fb-boss', 'dnb', 50, 'harmonic', [0, 5, 3, 4], 71);
  const MENU = S('fb-menu', 'chip', 57, 'major', [0, 5, 3, 4], 3, { bpm: 128 });
  const ZEN = S('fb-zen', 'ambient', 55, 'penta', [0, 3, 1, 4], 5, { volume: 0.8 });
  const FAST = S('fb-fast', 'dnb', 57, 'minor', [0, 5, 6, 4], 61);
  const IN_FLIGHT = { READY: 1, PLAYING: 1, PAUSED: 1, DYING: 1, DEAD: 1, CLEAR: 1, CINE: 1 };
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    if (!IN_FLIGHT[G.state] || !G.mode) return MENU;
    if (G.mode === 'zen') return ZEN;
    if (G.boss) return variant(BOSS, G.boss.kind || 'boss');
    const biome = BIOME[G.sceneBiome] || BIOME.meadow;
    if (G.mode === 'time' || G.mode === 'bossrush' || G.mode === 'daily') return variant(FAST, G.mode);
    if (G.mode === 'adventure') {
      const st = SZ.FlappyCourse && SZ.FlappyCourse.STAGES ? SZ.FlappyCourse.STAGES[G.stageIndex] : null;
      return variant(biome, st ? st.id : 'stage-' + G.stageIndex);
    }
    return biome;
  }

  function intensity() {
    if (G.state !== (C ? C.STATE_PLAYING : 'PLAYING')) return 0.3;
    if (G.mode === 'zen') return 0.25;
    let k = 0.5 + Math.min(0.3, (G.combo || 0) / 20);
    if (G.feverT > 0 || G.hearts <= 1 && G.mode !== 'classic') k = Math.max(k, 0.8);
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

  Object.assign(NS.music, { BIOME, BOSS, MENU, ZEN, FAST, themeFor, intensity, update });
})();
