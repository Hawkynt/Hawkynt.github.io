;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.modes.updateModeTimer = function updateModeTimer(dt) {
    if (S.currentMode === C.MODE_FRIGHTENED)
      return;

    S.modeTimer -= dt * 1000;
    if (S.modeTimer <= 0) {
      ++S.modeIndex;
      if (S.modeIndex >= C.MODE_TIMINGS.length)
        S.modeIndex = C.MODE_TIMINGS.length - 1;

      S.currentMode = (S.modeIndex % 2 === 0) ? C.MODE_SCATTER : C.MODE_CHASE;
      S.modeTimer = C.MODE_TIMINGS[S.modeIndex] * 1000;

      for (const g of S.ghosts) {
        if (g.mode !== C.MODE_EATEN && g.mode !== C.MODE_FRIGHTENED)
          g.mode = S.currentMode;
      }
      NS.ghosts.reverseGhosts();
    }
  }

  NS.modes.enterFrightenedMode = function enterFrightenedMode() {
    const duration = S.levelConfig.fright;
    if (duration <= 0) {
      NS.ghosts.reverseGhosts();
      return;
    }

    S.frightenedTimer = duration;
    S.ghostsEatenThisRound = 0;

    for (const g of S.ghosts) {
      if (g.mode !== C.MODE_EATEN && !g.inHouse) {
        g.mode = C.MODE_FRIGHTENED;
        g.dir = NS.movement.oppositeDir(g.dir);
        g.frightenedFlash = false;
      }
    }

    /* Boss vulnerability during stun */
    if (S.bossActive && S.boss && S.boss.stunned) {
      S.boss.vulnerable = true;
      S.boss.vulnerableTimer = duration;
    }
  }

  NS.modes.updateFrightenedTimer = function updateFrightenedTimer(dt) {
    if (S.frightenedTimer <= 0)
      return;

    S.frightenedTimer -= dt * 1000;

    const flashing = S.frightenedTimer <= C.FRIGHTENED_FLASH_TIME && S.frightenedTimer > 0;
    for (const g of S.ghosts) {
      if (g.mode === C.MODE_FRIGHTENED)
        g.frightenedFlash = flashing;
    }

    if (S.frightenedTimer <= 0) {
      S.frightenedTimer = 0;
      for (const g of S.ghosts) {
        if (g.mode === C.MODE_FRIGHTENED)
          g.mode = S.currentMode;
      }
    }
  }

})();
