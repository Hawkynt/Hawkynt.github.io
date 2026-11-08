/* The soundtrack through the shared SZ.GameMusic: a theme per sector (a cold synthwave in lunar orbit, an electro march on the Mars front, a drum & bass scramble through the asteroid belt, a dubstep storm at Jupiter, trance over Saturn's rings, an epic last stand at the Mothership), a heavier theme for every boss, a classic-mode chiptune, a menu theme and fast themes for Survival, Boss Rush and the Daily.
   Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop,
   breakdown, every pass a little different); every campaign stage plays a song of its own made from its
   world's theme. Bosses, a low, fast fleet and the last ship raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const bossOf = (s, style) => S(s.id + '-boss', style, s.root, s.scale === 'lydian' || s.scale === 'major' || s.scale === 'mixolydian' ? 'harmonic' : s.scale, s.prog, s.seed + 1);
  const WORLD = [
    S('si-moon', 'synthwave', 50, 'minor', [0, 5, 6, 4], 13, { bpm: 112 }),
    S('si-mars', 'electro', 52, 'harmonic', [0, 5, 3, 4], 29, { bpm: 128 }),
    S('si-asteroids', 'dnb', 55, 'dorian', [0, 3, 6, 4], 37),
    S('si-jupiter', 'dubstep', 50, 'phrygian', [0, 1, 0, 6], 47),
    S('si-saturn', 'trance', 57, 'lydian', [0, 1, 4, 3], 53, { bpm: 136 }),
    S('si-mothership', 'epic', 53, 'minor', [0, 6, 5, 4], 67, { bpm: 120 }),
  ];
  const BOSS = WORLD.map(s => bossOf(s, 'dnb'));
  const CLASSIC = S('si-classic', 'chip', 57, 'minor', [0, 5, 6, 4], 7, { bpm: 132 });
  const MENU = S('si-menu', 'synthwave', 57, 'major', [0, 5, 3, 4], 3, { bpm: 100 });
  const FAST = S('si-fast', 'house', 57, 'minor', [0, 5, 6, 4], 61, { bpm: 132 });

  const variant = (song, key) => (SZ.GameMusic && key != null && key !== '' ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const s = G.gameState;
    const IN = { playing: 1, paused: 1, dying: 1, levelComplete: 1, stageClear: 1, bossIntro: 1, bossVictory: 1, gameover: 1 };
    if (!IN[s]) return MENU;
    const st = G.stageInfo;
    if (G.gameMode === 'campaign' && st) {
      if (G.bossActive || st.boss) return BOSS[st.sector % BOSS.length];
      return variant(WORLD[st.sector % WORLD.length], st.id);
    }
    if (G.bossActive) return BOSS[(G.level - 1) % BOSS.length];
    if (G.gameMode === 'classic') return variant(CLASSIC, 'level-' + Math.floor((G.level - 1) / 3));
    return variant(FAST, G.gameMode + '-' + Math.floor((G.level - 1) / 3));
  }

  function intensity() {
    if (G.gameState !== 'playing') return 0.3;
    let k = 0.5 + Math.min(0.3, (G.level || 1) / 30);
    if (G.lives <= 1) k = Math.max(k, 0.85);
    if (G.bossActive) k = 1;
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

  Object.assign(NS.music, { WORLD, BOSS, CLASSIC, MENU, FAST, themeFor, intensity, update });
})();
