/* The soundtrack through the shared SZ.GameMusic: three themes take turns from room to room (a
   dreamy ambient drift, a warped synthwave and a hypnotic trance) and every room plays a song of
   its own made from its theme; the ready screen has a calm menu theme. Each song is arranged by the
   shared engine into an endless one (intro, groove, build-up, drop, breakdown, every pass a little
   different). Exploring stays calm; a shift of perspective lifts it for a moment. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);
  const THEMES = [
    S('mp-dream', 'ambient', 57, 'lydian', [0, 4, 1, 4], 11, { bpm: 78 }),
    S('mp-warp', 'synthwave', 53, 'dorian', [0, 3, 6, 4], 23, { bpm: 98 }),
    S('mp-trance', 'trance', 55, 'minor', [0, 5, 6, 4], 37, { bpm: 120 }),
  ];
  const MENU = S('mp-menu', 'ambient', 55, 'penta', [0, 3, 1, 4], 3, { bpm: 72 });

  function themeFor() {
    const G = NS.state;
    if (G.state !== 'EXPLORING' && G.state !== 'PAUSED' && G.state !== 'GAME_OVER') return MENU;
    const room = G.currentRoom || 0;
    return variant(THEMES[room % THEMES.length], 'room-' + room);
  }

  function intensity() {
    const G = NS.state;
    if (G.state !== 'EXPLORING') return 0.3;
    return G.transitionProgress < 1 || G.shiftTimer > 0 ? 0.75 : 0.4;
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

  NS.music = Object.assign(NS.music || {}, { THEMES, MENU, themeFor, intensity, update });
})();
