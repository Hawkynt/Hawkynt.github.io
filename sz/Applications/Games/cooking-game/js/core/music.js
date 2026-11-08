/* The soundtrack through the shared SZ.GameMusic: a theme per location (a sunny funk at the food
   truck, a bouncy chiptune in the corner diner, a smooth synthwave in the bistro, a quick house
   groove at the sushi bar, an epic swing in the Grand Hotel), a menu theme and a driving theme for
   Endless and the Daily. Each theme is arranged by the shared engine into an endless song (intro,
   groove, build-up, drop, breakdown, every pass a little different); every career day plays a song
   of its own made from its location's theme. A busy, impatient room and the Rush Hour Bell raise
   the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const LOCATION = {
    truck: S('cg-truck', 'funk', 57, 'mixolydian', [0, 6, 3, 4], 11, { bpm: 104 }),
    diner: S('cg-diner', 'chip', 60, 'major', [0, 4, 5, 3], 23, { bpm: 132 }),
    bistro: S('cg-bistro', 'synthwave', 55, 'dorian', [0, 3, 6, 4], 37, { bpm: 100 }),
    sushi: S('cg-sushi', 'house', 57, 'minor', [0, 5, 6, 4], 41, { bpm: 122 }),
    hotel: S('cg-hotel', 'epic', 53, 'major', [0, 5, 3, 4], 59, { bpm: 108 }),
  };
  const MENU = S('cg-menu', 'funk', 60, 'major', [0, 4, 5, 3], 3, { bpm: 96 });
  const FAST = S('cg-fast', 'electro', 57, 'minor', [0, 5, 6, 4], 61, { bpm: 128 });
  const IN_DAY = { PLAYING: 1, PAUSED: 1, DAY_OVER: 1 };
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const G = NS.state, d = G.dayInfo;
    if (!d || !IN_DAY[G.state]) return MENU;
    if (G.mode !== 'career') return variant(FAST, G.mode + '-' + (d.location || ''));
    return variant(LOCATION[d.location] || LOCATION.truck, d.id || G.dayIndex);
  }

  function intensity() {
    const G = NS.state;
    if (G.state === 'DAY_OVER') return 0.5;
    if (G.state !== 'PLAYING') return 0.3;
    let k = 0.45 + 0.35 * (G.tension || 0) + Math.min(0.15, (G.customers ? G.customers.length : 0) / 30);
    if (G.rushTimer > 0) k = 1;
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

  NS.music = { LOCATION, MENU, FAST, themeFor, intensity, update };
})();
