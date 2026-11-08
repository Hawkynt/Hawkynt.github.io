/* The soundtrack through the shared SZ.GameMusic: a theme per biome (a dusty funk on the rocky
   badlands, a hot electro drive over the dunes, glassy trance on the frozen shelf, a humid
   synthwave in the alien jungle, a dubstep grind in the ashen caldera, an epic swell over the
   crystal fields) and a menu theme. Each theme is arranged by the shared engine into an endless
   song (intro, groove, build-up, drop, breakdown, every pass a little different); every site
   plays a song of its own made from its biome's theme. Digging by day stays calm, dusk lifts it,
   and a night attack or a cracking dome pushes it into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.DomeKeeper || (SZ.DomeKeeper = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const BIOME = {
    rocky: S('dk-rocky', 'funk', 55, 'dorian', [0, 3, 4, 3], 11, { bpm: 104 }),
    desert: S('dk-desert', 'electro', 52, 'harmonic', [0, 5, 3, 4], 23, { bpm: 124 }),
    ice: S('dk-ice', 'trance', 62, 'lydian', [0, 1, 4, 3], 37, { bpm: 128 }),
    jungle: S('dk-jungle', 'synthwave', 53, 'minor', [0, 5, 6, 4], 41, { bpm: 108 }),
    volcanic: S('dk-volcanic', 'dubstep', 50, 'phrygian', [0, 1, 0, 6], 59),
    crystal: S('dk-crystal', 'epic', 57, 'major', [0, 5, 3, 4], 67, { bpm: 104 }),
  };
  const MENU = S('dk-menu', 'ambient', 53, 'lydian', [0, 4, 1, 4], 3, { bpm: 76 });
  const IN_SITE = { PLAYING: 1, PAUSED: 1, GAME_OVER: 1, UPGRADE_DIALOG: 1, CINEMATIC: 1, CONFIRM: 1, CRAFT: 1, MINIGAME: 1 };

  function themeFor() {
    const G = NS.state;
    if (!IN_SITE[G.state] || !G.site) return MENU;
    const base = BIOME[G.site.biome] || BIOME.rocky;
    return SZ.GameMusic ? SZ.GameMusic.variant(base, 'site-' + G.site.index + '-' + G.site.seed) : base;
  }

  function intensity() {
    const G = NS.state;
    if (G.state !== 'PLAYING') return 0.3;
    let k = 0.4;
    const T = NS.time;
    if (T && T.secondsToNight && T.secondsToNight() < 30) k = 0.65;
    if (G.waveActive || (G.enemies && G.enemies.length)) k = 0.9;
    if (G.maxDomeHP && G.domeHP < G.maxDomeHP * 0.35) k = 1;
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

  NS.music = { BIOME, MENU, themeFor, intensity, update };
})();
