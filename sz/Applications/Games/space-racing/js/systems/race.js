/*
 * Race rules: lap counting and splits, live place, wrong-way check and the finish
 * (placement, rewards, cup points, high score). Writes the race fields in G.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { STATE_PLAYING, STATE_RESULTS } = NS.constants;
  const { screenShake, floatingText } = NS.runtime;
  const { writeSave, addHighScore } = NS.save;
  const { getPlayerShipDef } = NS.progress;
  const { finalStandings, awardCupPoints, recordBestLap, awardRaceReward } = NS.career;
  const Effects = NS.module('effects');
  const Flow = NS.module('flow');

  function updateRace(dt) {
    if (G.state !== STATE_PLAYING || G.raceFinished || !G.raceStarted) return;

    G.raceTime += dt;

    const L = G.geo.length;
    const lapsDone = Math.floor(G.ship.ts.dist / L);
    if (lapsDone > G.playerLap && lapsDone >= 1) {
      G.playerLap = Math.min(G.raceLaps, lapsDone);
      const lapTime = G.raceTime - G.lastLapStamp;
      recordBestLap(lapTime);
      G.lapSplitNumber = G.playerLap;
      G.lapSplitTime = lapTime;
      G.lapSplitAt = G.raceTime;
      G.lapSplitBest = !(G.raceBestLap > 0) || lapTime < G.raceBestLap;
      if (!(G.raceBestLap > 0) || lapTime < G.raceBestLap)
        G.raceBestLap = lapTime;
      G.lastLapStamp = G.raceTime;
      G.lapFlash = { alpha: 0.35, color: '#ffffff', rate: 1 };
      if (G.playerLap === G.raceLaps - 1) {
        G.finalFlash = { alpha: 0.3, color: '#ffd75a', rate: 0.3 / 0.35 };
        screenShake.trigger(4, 200);
      }
      if (G.playerLap >= G.raceLaps)
        finishRace();
      else {
        if (G.playerLap === G.raceLaps - 1) {
          SZ.GameAudio.play('levelup', { pitch: 1.2 });
          SZ.GameAudio.tone(1319, 0.05, 'square', 0.07, 0.15);
          SZ.GameAudio.tone(1760, 0.18, 'square', 0.07, 0.20);
        } else
          SZ.GameAudio.play('levelup');
        floatingText.add(G.ship.x, G.ship.y - 60, G.playerLap === G.raceLaps - 1 ? 'FINAL LAP!' : `Lap ${G.playerLap + 1}/${G.raceLaps}`, { color: '#ff0', font: 'bold 22px sans-serif' });
      }
    }

    // place: finished racers first by finish time, then by distance raced
    let place = 1;
    for (let i = 0; i < G.opponents.length; ++i) {
      const ai = G.opponents[i];
      if (ai.finished || ai.ts.dist > G.ship.ts.dist)
        ++place;
    }
    if (place !== G.playerPlace) {
      G.placeDelta = place < G.playerPlace ? 1 : -1;
      G.placeDeltaAt = G.raceTime;
      if (place < G.playerPlace)
        SZ.GameAudio.play('blip', { pitch: 1.4 });
      else
        SZ.GameAudio.play('blip', { pitch: 0.7, volume: 0.6 });
    }
    G.playerPlace = place;
    G.wrongWay = G.ship.speed > 60 && G.geo.progress(G.ship.ts.s, G.geo.locate(G.ship.x + G.ship.vx * 0.2, G.ship.y + G.ship.vy * 0.2, G.ship.ts.hint).s) < -2;
  }

  function finishRace() {
    G.raceFinished = true;
    G.state = STATE_RESULTS;
    G.hitAreas.length = 0;

    // Determine final placement: count AIs that finished before the player,
    // plus AIs that were further along the track when the player crossed the line
    let finalPlace = 1;
    for (let i = 0; i < G.opponents.length; ++i) {
      const ai = G.opponents[i];
      if ((ai.finished && ai.finishTime <= G.raceTime) || ai.ts.dist > G.ship.ts.dist)
        ++finalPlace;
    }

    G.playerPlace = finalPlace;
    SZ.GameAudio.play(finalPlace === 1 ? 'win' : finalPlace <= 3 ? 'levelup' : 'lose');

    // Everything the results screen shows, captured before the cup bookkeeping
    G.resultsWasCup = G.raceCup !== null;
    G.lastStandings = finalStandings();
    G.lastPodium = G.lastStandings.slice(0, 3).map(entry => {
      if (entry.name === 'player') {
        const pd = getPlayerShipDef();
        return { name: 'YOU', color: pd.color, accent: pd.accentColor, exhaust: pd.exhaustColor, shape: pd.shape, player: true };
      }
      const ai = G.opponents.find(a => a.name === entry.name);
      return ai ? { name: ai.name, color: ai.color, accent: ai.accentColor, exhaust: ai.exhaustColor, shape: ai.shape } : null;
    });
    G.resultsTime = 0;
    G.standingsTime = 0;
    G.coinTick = 0;
    G.confetti = [];

    // Award credits: placement plus the bonuses earned during the race
    awardRaceReward(finalPlace);
    if (G.raceCup !== null)
      awardCupPoints(finalPlace);
    writeSave();

    // Confetti for podium finishes (1st, 2nd, 3rd)
    if (finalPlace <= 3)
      Effects.spawnConfetti();

    addHighScore(G.raceTime, G.track.name);
    Flow.updateWindowTitle();
  }

  Object.assign(NS.module('race'), {
    updateRace
  });
})();
