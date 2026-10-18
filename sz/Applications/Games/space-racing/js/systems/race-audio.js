/*
 * The player's racing noise: engine hum, drift hiss and barrier scrape on their
 * own refresh timers. Reads G.ship, writes only the sound timers in G.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;

  /* The player's own racing noise: an engine hum that follows the speed, a
     drift hiss and a barrier scrape. Each source runs on its own refresh
     timer, never faster than every 0.06 s, and the whole layer is silent
     outside the started race. */
  function updateRaceAudio(dt) {
    if (!G.raceStarted || G.raceFinished) return;

    G.engineTick += dt;
    if (G.engineTick >= 0.09) {
      G.engineTick = 0;
      ++G.engineBeat;
      const freq = 55 + G.ship.speed * 0.22 + (G.boostActive ? 40 : 0);
      const vol = 0.025 + 0.035 * Math.min(1, G.ship.speed / 500);
      SZ.GameAudio.tone(freq, 0.12, 'sawtooth', vol);
      if (G.engineBeat % 2 === 0)
        SZ.GameAudio.tone(freq / 2, 0.12, 'sine', vol * 0.8);
    }

    if (G.drifting) {
      G.driftTick += dt;
      if (G.driftTick >= 0.12) {
        G.driftTick = 0;
        SZ.GameAudio.noise(0.12, 0.03, 'bandpass', 1800, 1200);
      }
    } else
      G.driftTick = 0;

    if (G.ship.ts.off > G.geo.width / 2) {
      G.scrapeTick += dt;
      if (G.scrapeTick >= 0.18) {
        G.scrapeTick = 0;
        SZ.GameAudio.noise(0.1, 0.04, 'lowpass', 700, 300);
      }
    } else
      G.scrapeTick = 0;
  }

  Object.assign(NS.module('raceAudio'), {
    updateRaceAudio
  });
})();
