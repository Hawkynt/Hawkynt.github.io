;(function() {
  'use strict';

  // Mouse-path movement underground and the per-frame game update.
  // Owns: NS.update
  // Reads: constants, rules, upgrades, persistence, run, animation, time, weather, waves, weapon, mining,
  //   bombs, cargo, chests, artifacts, gadgets, drones
  // Reads state of: gameState, persistence, relocation, waves, weapon, bombs, artifacts

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, VIEW_UNDERGROUND, STATE_PLAYING, GRID_COLS, GRID_ROWS, TILE_SIZE } = NS.constants;
  const { RESOURCE_TILES } = NS.rules;
  const { getEffectiveLevel } = NS.upgrades;
  const { AUTOSAVE_INTERVAL, saveRun } = NS.persistence;
  const { updateTransition } = NS.run;
  const { updateAnimations, spawnDust } = NS.animation;
  const { updateWorldTime } = NS.time;
  const { updateWeather } = NS.weather;
  const { updateEnemies } = NS.waves;
  const { updateReflected, updateWeapon } = NS.weapon;
  const { cancelMining, tryMine, updateMining, pickUpDroppedResources } = NS.mining;
  const { updateBombs, updateBlastVisuals } = NS.bombs;
  const { agePiles, updateFlyingOre } = NS.cargo;
  const { updateChests } = NS.chests;
  const { updateArtifacts } = NS.artifacts;
  const { updateGadgets } = NS.gadgets;
  const { updateDrones } = NS.drones;

  /* ======================================================================
     MOVEMENT (mouse-based underground navigation)
     ====================================================================== */

  function updateMovement(dt) {
    if (G.currentView !== VIEW_UNDERGROUND) return;
    if (G.keeperStun > 0) return;
    // Block movement while mining
    if (G.miningTarget) {
      G.keeperIdle = 0;
      return;
    }
    // Auto-Mine: an idle keeper digs adjacent ore
    G.keeperIdle += dt;
    if (G.unlockedTools.autoMine && G.keeperIdle >= 2 && (!G.movePath || G.movePathIndex >= G.movePath.length) && G.state === STATE_PLAYING) {
      for (const [ddx, ddy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const rr = G.drillY + ddy, cc = G.drillX + ddx;
        if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) continue;
        if (RESOURCE_TILES.includes(G.undergroundGrid[rr][cc])) {
          tryMine(ddx, ddy);
          break;
        }
      }
      G.keeperIdle = 0;
    }

    if (!G.movePath || G.movePathIndex >= G.movePath.length) {
      // Arrived at destination -- check queued mine action
      if (G.mineTarget && G.movePath) {
        tryMine(G.mineTarget.dx, G.mineTarget.dy);
        G.mineTarget = null;
      }
      G.movePath = null;
      G.moveTarget = null;
      return;
    }

    G.moveStepTimer -= dt;
    G.keeperIdle = 0;
    if (G.moveStepTimer <= 0) {
      const step = G.movePath[G.movePathIndex];
      // Climbing up a tunnel is faster with the jetpack
      const climbing = step.row < G.drillY && G.unlockedTools.jetpack;
      G.moveStepTimer = climbing ? G.moveStepInterval / (2 * (1 + 0.25 * getEffectiveLevel('jetpackFuel'))) : G.moveStepInterval;
      // Spawn dust at old position
      const cx = G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX;
      const cy = G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      spawnDust(cx, cy);
      G.lastMineDir = { dx: Math.sign(step.col - G.drillX), dy: Math.sign(step.row - G.drillY) };
      G.drillX = step.col;
      G.drillY = step.row;
      ++G.movePathIndex;
      // Pick up dropped resources at new position
      pickUpDroppedResources();
    }
  }

  function clearMoveTarget() {
    G.moveTarget = null;
    G.movePath = null;
    G.movePathIndex = 0;
    G.moveStepTimer = 0;
    G.mineTarget = null;
    cancelMining();
  }

  /* ======================================================================
     UPDATE
     ====================================================================== */

  function updateGame(dt) {
    if (G.state !== STATE_PLAYING) return;

    updateTransition(dt);
    updateAnimations(dt);
    updateGadgets(dt);
    updateMining(dt);
    updateBombs(dt);
    updateBlastVisuals(dt);
    updateChests(dt);
    updateMovement(dt);

    // Standing next to the Relocation Core reveals it
    if (!G.relocationCore.revealed && !G.relocationCore.found && Math.abs(G.relocationCore.r - G.drillY) + Math.abs(G.relocationCore.c - G.drillX) <= 1)
      G.relocationCore.revealed = true;

    // Age dropped resources; despawn after 120s
    agePiles(dt);
    updateFlyingOre(dt);

    // Center camera on player underground
    if (G.currentView !== VIEW_SURFACE) {
      const targetCamX = G.drillX * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2;
      const targetCamY = G.drillY * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2;
      const maxCamX = GRID_COLS * TILE_SIZE - CANVAS_W;
      const maxCamY = GRID_ROWS * TILE_SIZE - CANVAS_H;
      G.cameraX += (Math.max(0, Math.min(maxCamX, targetCamX)) - G.cameraX) * 0.15;
      G.cameraY += (Math.max(0, Math.min(maxCamY, targetCamY)) - G.cameraY) * 0.15;
    }

    updateWorldTime(dt);
    updateWeather(dt);

    updateArtifacts(dt);
    // Hitstop: the battle freezes for an instant after a big hit
    const battleDt = G.hitstop > 0 ? dt * 0.1 : dt;
    G.hitstop = Math.max(0, G.hitstop - dt);
    G.parryT = Math.max(0, G.parryT - dt);
    G.parryCd = Math.max(0, G.parryCd - dt);
    updateEnemies(G.artifactState.timeSlow > 0 ? battleDt * 0.35 : battleDt);
    updateReflected(battleDt);
    updateWeapon(dt);
    updateDrones(dt);

    G.autosaveTimer += dt;
    if (G.autosaveTimer >= AUTOSAVE_INTERVAL && G.state === STATE_PLAYING) {
      G.autosaveTimer = 0;
      saveRun();
    }
  }

  NS.update = { clearMoveTarget, updateGame };
})();
