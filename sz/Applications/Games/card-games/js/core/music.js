/* The soundtrack through the shared SZ.GameMusic: a theme per family of games (a calm ambient for
   patience games, a smooth house groove at the casino tables, a bouncy chiptune for shedding games,
   a thoughtful synthwave for trick-taking, an easy funk for rummy, a quick electro for snap and speed
   games, an epic dance for the European classics) and a cosy menu theme in the lobby. Each theme is
   arranged by the shared engine into an endless song (intro, groove, build-up, drop, breakdown,
   every pass a little different); every game in a family plays a song of its own made from the
   family's theme. A finished round lifts the music for a moment. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const FAMILY = {
    solitaire: S('ca-solitaire', 'ambient', 57, 'lydian', [0, 4, 1, 4], 11, { bpm: 78 }),
    casino: S('ca-casino', 'house', 53, 'dorian', [0, 3, 6, 4], 23, { bpm: 118 }),
    shedding: S('ca-shedding', 'chip', 60, 'major', [0, 4, 5, 3], 37, { bpm: 132 }),
    trick: S('ca-trick', 'synthwave', 55, 'minor', [0, 5, 3, 6], 41, { bpm: 100 }),
    rummy: S('ca-rummy', 'funk', 57, 'mixolydian', [0, 6, 3, 4], 47, { bpm: 98 }),
    speed: S('ca-speed', 'electro', 52, 'minor', [0, 5, 6, 4], 53, { bpm: 128 }),
    european: S('ca-european', 'epic', 55, 'major', [0, 5, 3, 4], 59, { bpm: 104 }),
  };
  const IDS = {
    solitaire: 'solitaire freecell spider yukon pyramid golf tripeaks fortythieves canfield clock bakersdozen accordion',
    casino: 'poker blackjack baccarat holdem faro reddog threecard',
    shedding: 'uno unoflip unowild liarsuno unoextreme unoparty dos ono99 duo skipbo crazy-eights maumau president',
    trick: 'skat doppelkopf hearts spades euchre pinochle bridge ohhell whist pitch sixtysix',
    rummy: 'canasta ginrummy rummy500 phase10 tonk rummy kalooki yaniv',
    speed: 'war memory gofish oldmaid snap speed cheat ratscrew sevens spitemalice beggar',
    european: 'schwimmen durak briscola scopa cribbage piquet bezique cassino pishti belote',
  };
  const FAMILY_OF = {};
  for (const f in IDS) for (const id of IDS[f].split(' ')) FAMILY_OF[id] = f;
  const MENU = S('ca-menu', 'funk', 60, 'major', [0, 4, 5, 3], 3, { bpm: 92 });
  const IN_GAME = { PLAYING: 1, PAUSED: 1, ROUND_OVER: 1, GAME_OVER: 1 };

  function themeFor() {
    const G = NS.state, v = G.currentVariant;
    if (!v || !IN_GAME[G.state]) return MENU;
    const fam = FAMILY[FAMILY_OF[v.id]] || FAMILY.solitaire;
    return SZ.GameMusic ? SZ.GameMusic.variant(fam, v.id) : fam;
  }

  function intensity() {
    const G = NS.state;
    if (G.state === 'ROUND_OVER' || G.state === 'GAME_OVER') return 0.8;
    return G.state === 'PLAYING' ? 0.45 : 0.3;
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

  NS.music = Object.assign(NS.music || {}, { FAMILY, FAMILY_OF, MENU, themeFor, intensity, update });
})();
