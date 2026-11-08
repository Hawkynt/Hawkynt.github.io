/* The soundtrack through the shared SZ.GameMusic: the farm's weeks take turns with four themes (a
   sunny funk, a warm synthwave, an easy house groove and a bright chiptune) and every week of the
   farm plays a song of its own made from its theme; the title has a calm menu theme. Each song is
   arranged by the shared engine into an endless one (intro, groove, build-up, drop, breakdown,
   every pass a little different). Nights quieten it, rain and snow keep it soft, dust storms and
   thunderstorms raise the intensity: layers come in and the music pushes into the drop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const WEEK = [
    S('sf-sunny', 'funk', 60, 'major', [0, 4, 5, 3], 11, { bpm: 100 }),
    S('sf-dusk', 'synthwave', 57, 'dorian', [0, 3, 6, 4], 23, { bpm: 104 }),
    S('sf-harvest', 'house', 55, 'mixolydian', [0, 6, 3, 4], 37, { bpm: 118 }),
    S('sf-sprout', 'chip', 62, 'major', [0, 5, 3, 4], 41, { bpm: 128 }),
  ];
  const MENU = S('sf-menu', 'ambient', 57, 'lydian', [0, 4, 1, 4], 3, { bpm: 76 });
  const IN_FARM = { PLAYING: 1, PAUSED: 1, GAME_OVER: 1 };
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);

  function themeFor() {
    const G = NS.state;
    if (!IN_FARM[G.state]) return MENU;
    const week = Math.floor((G.dayCount || 0) / 7);
    return variant(WEEK[week % WEEK.length], 'week-' + week);
  }

  function intensity() {
    const G = NS.state;
    if (G.state !== 'PLAYING' || G.dialog) return 0.3;
    let k = G.dayPhase >= 0.5 ? 0.3 : 0.5;
    if (G.weatherType === 'rain' || G.weatherType === 'snow') k = Math.min(k, 0.4);
    if (G.weatherType === 'dust' || G.weatherType === 'thunderstorm') k = 0.9;
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

  NS.music = { WEEK, MENU, themeFor, intensity, update };
})();
