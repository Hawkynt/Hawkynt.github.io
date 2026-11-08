/* core/music.js -- the soundtrack through the shared SZ.GameMusic: a theme per biome (a marching
   house groove in the meadows, a dusty electro drive in the desert, glassy trance on the tundra,
   a murky dubstep in the swamp, a deep synthwave in the caverns, an epic stand at the volcano),
   a menu theme and a battle theme while a boss walks the path. Each theme is arranged by the
   shared engine into an endless song (intro, groove, build-up, drop, breakdown, every pass a
   little different); every map plays a song of its own made from its biome's theme. Building
   between waves stays calm, a running wave lifts the music and a boss or a thin line of lives
   pushes it into the drop.
   Reads: maps, enemyTypes and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const BIOME = {
    meadow: S('td-meadow', 'house', 57, 'major', [0, 4, 5, 3], 11, { bpm: 120 }),
    desert: S('td-desert', 'electro', 52, 'harmonic', [0, 5, 3, 4], 23, { bpm: 124 }),
    tundra: S('td-tundra', 'trance', 62, 'lydian', [0, 1, 4, 3], 37, { bpm: 130 }),
    swamp: S('td-swamp', 'dubstep', 50, 'dorian', [0, 3, 6, 4], 41),
    cavern: S('td-cavern', 'synthwave', 53, 'minor', [0, 5, 6, 4], 47, { bpm: 106 }),
    volcano: S('td-volcano', 'epic', 50, 'phrygian', [0, 1, 0, 6], 59, { bpm: 116 }),
  };
  const BOSS = S('td-boss', 'dnb', 50, 'harmonic', [0, 5, 3, 4], 71);
  const MENU = S('td-menu', 'epic', 55, 'major', [0, 5, 3, 4], 3, { bpm: 92 });
  const IN_MAP = { READY: 1, PLAYING: 1, PAUSED: 1, BUILD: 1, GAME_OVER: 1 };

  function bossOnPath(G) {
    const T = NS.enemyTypes && NS.enemyTypes.ENEMY_TYPES;
    if (!T) return false;
    for (const e of G.enemies) if (e.hp > 0 && T[e.type] && T[e.type].boss) return true;
    return false;
  }

  function themeFor() {
    const G = NS.state;
    if (!IN_MAP[G.state]) return MENU;
    const map = NS.maps.MAPS[G.currentMap] || NS.maps.MAPS[0];
    if (bossOnPath(G)) return SZ.GameMusic ? SZ.GameMusic.variant(BOSS, map.biome) : BOSS;
    const base = BIOME[map.biome] || BIOME.meadow;
    return SZ.GameMusic ? SZ.GameMusic.variant(base, map.name || String(G.currentMap)) : base;
  }

  function intensity() {
    const G = NS.state;
    if (G.state !== 'PLAYING') return 0.3;
    let k = G.enemies.length ? 0.55 + Math.min(0.25, G.enemies.length / 60) : 0.35;
    if (G.warningActive) k = Math.max(k, 0.65);
    if (G.lives <= 5) k = Math.max(k, 0.9);
    if (bossOnPath(G)) k = 1;
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

  NS.music = { BIOME, BOSS, MENU, themeFor, intensity, update };
})();
