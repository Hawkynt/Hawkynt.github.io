/* The soundtrack through the shared SZ.GameMusic: an epic menu theme, a deck-building theme and
   a duel theme per AI difficulty (a stately epic march, a darker electro duel and a dubstep clash
   for the hardest opponent); every duel plays a song of its own made from its theme. Each song is
   arranged by the shared engine into an endless one (intro, groove, build-up, drop, breakdown,
   every pass a little different). Low health on either side raises the intensity and a victory
   pushes the music into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);
  const DUEL = {
    easy: S('fc-easy', 'epic', 55, 'major', [0, 5, 3, 4], 11, { bpm: 100 }),
    normal: S('fc-normal', 'electro', 52, 'harmonic', [0, 5, 3, 4], 23, { bpm: 120 }),
    hard: S('fc-hard', 'dubstep', 50, 'phrygian', [0, 1, 0, 6], 37),
  };
  const MENU = S('fc-menu', 'epic', 57, 'dorian', [0, 3, 6, 4], 3, { bpm: 92 });
  const BUILD = S('fc-build', 'funk', 55, 'dorian', [0, 3, 4, 3], 5, { bpm: 96 });
  let duels = 0, lastTurn = -1;

  function themeFor() {
    const G = NS.state;
    if (G.state === 'DECK_BUILD') return BUILD;
    if (G.state !== 'PLAYING' && G.state !== 'PAUSED' && G.state !== 'GAME_OVER' && G.state !== 'VICTORY') return MENU;
    if (G.turnNumber < lastTurn) ++duels;
    lastTurn = G.turnNumber;
    return variant(DUEL[G.difficulty] || DUEL.normal, 'duel-' + duels);
  }

  function intensity() {
    const G = NS.state;
    if (G.state === 'VICTORY') return 1;
    if (G.state !== 'PLAYING') return 0.3;
    let k = 0.5;
    if (G.playerMaxHP && G.playerHP < G.playerMaxHP * 0.3) k = 0.9;
    if (G.aiMaxHP && G.aiHP < G.aiMaxHP * 0.3) k = Math.max(k, 0.85);
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

  NS.music = Object.assign(NS.music || {}, { DUEL, MENU, BUILD, themeFor, intensity, update });
})();
