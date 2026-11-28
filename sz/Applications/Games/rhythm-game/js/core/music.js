/* Music outside the songs through the shared SZ.GameMusic: the Radio Afterglow theme on the title and
   in the menus, each district's theme on the map, a calm piece on the results and in the panels
   opened from a result. While a song is in play the conductor owns the music (the chart is that
   song), so this module stays quiet then; the menu music switch is the shared music switch. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const SD = NS.songData;

  function owned() {
    const r = G.run;
    return !!(r && r.mode !== 'demo' && (G.screen === 'game' || G.screen === 'paused') && !r.done);
  }

  function themeFor() {
    if (G.screen === 'results') return SD.RESULTS;
    if (G.screen === 'map') return SZ.GameMusic.variant(SD.DISTRICT[G.ui.world], 'map');
    if (G.screen === 'library' && G.ui.preview) return G.ui.preview;
    return SD.MENU;
  }

  let acc = 1;
  function update(dt) {
    const Mu = SZ.GameMusic;
    if (!Mu || owned()) return null;
    acc += dt;
    if (acc < 0.4) return null;
    acc = 0;
    const song = themeFor();
    Mu.setIntensity(0.45);
    if (Mu.current !== song) Mu.play(song);
    return song;
  }

  Object.assign(NS.music, { owned, themeFor, update });
})();
