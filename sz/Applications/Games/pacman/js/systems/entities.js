;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.entities.createPacman = function createPacman() {
    return {
      x: C.PACMAN_START.x * C.TILE + C.TILE / 2,
      y: C.PACMAN_START.y * C.TILE + C.TILE / 2,
      tileX: C.PACMAN_START.x,
      tileY: C.PACMAN_START.y,
      dir: C.DIR_LEFT,
      nextDir: C.DIR_LEFT,
      speed: 2,
      mouthAngle: 0,
      mouthOpening: true,
      moving: false
    };
  }

  NS.entities.createGhost = function createGhost(index) {
    const start = C.GHOST_START_POS[index];
    return {
      index,
      x: start.x * C.TILE + C.TILE / 2,
      y: start.y * C.TILE + C.TILE / 2,
      tileX: start.x,
      tileY: start.y,
      dir: index === 0 ? C.DIR_LEFT : C.DIR_UP,
      speed: 1.5,
      mode: C.MODE_SCATTER,
      inHouse: index !== 0,
      releaseTimer: index * 2000,
      targetX: 0,
      targetY: 0,
      frightenedFlash: false,
      _lastDecTileX: -1,
      _lastDecTileY: -1
    };
  }

})();
