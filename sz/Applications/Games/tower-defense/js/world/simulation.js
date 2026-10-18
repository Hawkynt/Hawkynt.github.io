/* world/simulation.js -- game speeds and the fixed-step battle simulation.
   Reads: constants, effects, abilities, waves, combat, towerAttacks, projectiles, enemies, savegame and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_PLAYING, STATE_BUILD, AUTOSAVE_INTERVAL } = NS.constants;
  const { FX_BUDGET } = NS.effects;
  const { updateAbilities } = NS.abilities;
  const { updateSpawner, updateBuildCountdown } = NS.waves;
  const { rebuildEnemyGrid, updateReveal } = NS.combat;
  const { updateTowers } = NS.towerAttacks;
  const { updateProjectiles, updateClouds, updateFloorEffects, updateFx } = NS.projectiles;
  const { updateEnemies, sweepEnemies } = NS.enemies;

  const SIM_STEP = 1 / 60;
  const SIM_BUDGET_MS = 10;
  const GAME_SPEEDS = [1, 2, 3, 5, 10, 20];
  let simAcc = 0;

  function updateGame(dt) {
    G.animTime += dt;
    if (G.state === STATE_PLAYING) {
      let sdt = dt * G.gameSpeed;
      if (G.hitstop > 0) {
        G.hitstop -= dt;
        sdt *= 0.25;
      }
      // Fixed 1/60 s steps keep every speed as accurate as normal speed;
      // a time budget per frame keeps 20x responsive on slow machines
      simAcc += sdt;
      const t0 = performance.now();
      while (simAcc >= SIM_STEP && G.state === STATE_PLAYING) {
        stepBattle(SIM_STEP);
        simAcc -= SIM_STEP;
        if (performance.now() - t0 > SIM_BUDGET_MS) {
          simAcc = Math.min(simAcc, SIM_STEP * 2);
          break;
        }
      }
    } else if (G.state === STATE_BUILD) {
      updateBuildCountdown(dt);
      updateFloorEffects(dt);
      updateFx(dt);
    }
    if (G.state === STATE_PLAYING || G.state === STATE_BUILD) {
      G.autosaveTimer += dt;
      if (G.autosaveTimer >= AUTOSAVE_INTERVAL)
        NS.savegame.saveGame();
    }
  }

  function stepBattle(h) {
    G.fxBudget = FX_BUDGET;
    updateSpawner(h);
    updateAbilities(h);
    updateEnemies(h);
    rebuildEnemyGrid();
    updateReveal(h);
    updateTowers(h);
    updateProjectiles(h);
    updateClouds(h);
    updateFloorEffects(h);
    updateFx(h);
    sweepEnemies();
  }

  NS.simulation = { GAME_SPEEDS, updateGame };

})();
