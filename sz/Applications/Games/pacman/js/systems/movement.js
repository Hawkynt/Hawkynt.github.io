;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.movement.getTile = function getTile(px, py) {
    return {
      x: Math.floor(px / C.TILE),
      y: Math.floor(py / C.TILE)
    };
  }

  NS.movement.isCentered = function isCentered(entity) {
    const cx = entity.tileX * C.TILE + C.TILE / 2;
    const cy = entity.tileY * C.TILE + C.TILE / 2;
    return Math.abs(entity.x - cx) < entity.speed + 0.5 &&
           Math.abs(entity.y - cy) < entity.speed + 0.5;
  }

  NS.movement.snapToCenter = function snapToCenter(entity) {
    entity.x = entity.tileX * C.TILE + C.TILE / 2;
    entity.y = entity.tileY * C.TILE + C.TILE / 2;
  }

  NS.movement.canMove = function canMove(tileX, tileY, dir, allowGate) {
    const nx = tileX + C.DX[dir];
    const ny = tileY + C.DY[dir];
    return NS.maze.isWalkable(nx, ny, allowGate);
  }

  NS.movement.distance = function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  }

  NS.movement.distanceSq = function distanceSq(x1, y1, x2, y2) {
    return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  }

  NS.movement.oppositeDir = function oppositeDir(dir) {
    return (dir + 2) % 4;
  }

  NS.movement.isActivePowerup = function isActivePowerup(id) {
    return S.activePowerups.some(ap => ap.type.id === id);
  }

})();
