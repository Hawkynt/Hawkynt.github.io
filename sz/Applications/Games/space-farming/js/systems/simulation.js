/* Space Farming - the day cycle (seasons, days, dawn and dusk) and the per-frame simulation step
   that runs every system.
   Owns: G.gameTime, G.dayCount, G.currentSeason, G.dayPhase
   Reads: G.state */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { STATE_PLAYING, STATE_PAUSED, SEASONS, SEASON_DURATION, DAY_CYCLE_PERIOD, updateCrops,
    updateLivestock, updateWeather, updatePriceFluctuation, updateAutoCollector, updateShuffleCache,
    updateEnergy, updateAutoPlanter, updateBuildingIncome, updateAnimals, dayChime, updateGoals,
    updateOrders, updateWindowTitle } = NS;

  /* ══════════════════════════════════════════════════════════════════
     DAY CYCLE
     ══════════════════════════════════════════════════════════════════ */

  function updateDayCycle(dt) {
    if (G.state !== STATE_PLAYING) return;
    const prevDay = Math.floor(G.gameTime / DAY_CYCLE_PERIOD);
    G.gameTime += dt;
    const curDay = Math.floor(G.gameTime / DAY_CYCLE_PERIOD);
    if (curDay > prevDay) {
      ++G.dayCount;
      updateWindowTitle();
    }

    // Day/night phase: 0..1 within each game day
    const prevPhase = G.dayPhase;
    G.dayPhase = (G.gameTime % DAY_CYCLE_PERIOD) / DAY_CYCLE_PERIOD;
    if (prevPhase < 0.5 && G.dayPhase >= 0.5)
      dayChime(false);
    else if (prevPhase > 0.9 && G.dayPhase < 0.1)
      dayChime(true);

    // Season: changes every SEASON_DURATION days
    G.currentSeason = Math.floor((G.dayCount - 1) / SEASON_DURATION) % SEASONS.length;
  }

  function updateGame(dt) {
    if (G.state === STATE_PAUSED) return;

    updateDayCycle(dt);
    updateCrops(dt);
    updateLivestock(dt);
    updateWeather(dt);
    updatePriceFluctuation(dt);
    updateBuildingIncome(dt);
    updateAnimals(dt);
    updateEnergy(dt);
    updateAutoPlanter(dt);
    updateAutoCollector(dt);
    updateShuffleCache(dt);
    updateGoals(dt);
    updateOrders(dt);
    NS.checkFarmEnd(dt);
  }

  Object.assign(NS, { updateGame });

})();
