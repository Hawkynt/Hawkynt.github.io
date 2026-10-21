/* Procedural spawning: obstacle groups that keep one lane safe, coins, power-ups and
   the high-speed speed-lines. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;

  /* ── Obstacle Spawning ── */
  function spawnObstacle(y) {
    const occupiedLanes = [];
    const count = 1 + (S.currentSpeed > 14 ? 1 : 0);
    for (let i = 0; i < count; ++i) {
      let lane;
      do {
        lane = Math.floor(Math.random() * C.NUM_LANES);
      } while (occupiedLanes.includes(lane));
      occupiedLanes.push(lane);
    }
    // Guarantee at least one safeLane is free
    const safeLane = [];
    for (let i = 0; i < C.NUM_LANES; ++i)
      if (!occupiedLanes.includes(i))
        safeLane.push(i);
    if (safeLane.length === 0)
      occupiedLanes.pop();

    for (const lane of occupiedLanes) {
      const type = C.OBSTACLE_TYPES[Math.floor(Math.random() * C.OBSTACLE_TYPES.length)];
      S.obstacles.push({ lane, y, type });
    }
  }

  function spawnCoin(y) {
    if (Math.random() > C.COIN_SPAWN_CHANCE)
      return;
    const lane = Math.floor(Math.random() * C.NUM_LANES);
    S.coins.push({ lane, y, collected: false });
  }

  function spawnPowerUp(y) {
    if (Math.random() > C.POWERUP_SPAWN_CHANCE)
      return;
    const lane = Math.floor(Math.random() * C.NUM_LANES);
    const type = C.POWERUP_TYPES[Math.floor(Math.random() * C.POWERUP_TYPES.length)];
    S.powerUps.push({ lane, y, type, collected: false });
  }

  /* ── Speed Lines ── */
  function spawnSpeedLine() {
    if (S.currentSpeed < 12)
      return;
    const intensity = Math.min(1, (S.currentSpeed - 12) / 8);
    if (Math.random() > intensity * 0.5)
      return;
    S.speedLines.push({
      x: Math.random() * C.CANVAS_W,
      y: -10,
      length: 20 + Math.random() * 40,
      speed: S.currentSpeed * 8 + Math.random() * 100,
      alpha: 0.3 + Math.random() * 0.4
    });
  }

  NS.spawn.spawnObstacle = spawnObstacle;
  NS.spawn.spawnCoin = spawnCoin;
  NS.spawn.spawnPowerUp = spawnPowerUp;
  NS.spawn.spawnSpeedLine = spawnSpeedLine;
})();
