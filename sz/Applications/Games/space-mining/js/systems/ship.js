/* The mining rig: keyboard and mouse-driven thrust navigation, drag, speed
   limiting, world clamping, thruster particles and the contextual hints. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const SH = NS.ship;

  /* Number of 60 Hz frames covered by dt; snaps refresh jitter so 60 Hz stays one frame */
  SH.frameScale = function frameScale(dt) {
    const frames = dt * 60;
    return Math.abs(frames - 1) < 0.03 ? 1 : frames;
  };

  SH.updateShip = function updateShip(dt) {
    const speedMult = S.activePowerups.speed > 0 ? 1.6 : 1.0;

    /* Keyboard rotation */
    if (S.keys['ArrowLeft'] || S.keys['KeyA'])
      S.ship.angle -= C.ROTATION_SPEED * dt;
    if (S.keys['ArrowRight'] || S.keys['KeyD'])
      S.ship.angle += C.ROTATION_SPEED * dt;

    /* Keyboard thrust */
    let thrusting = false;
    if (S.keys['ArrowUp'] || S.keys['KeyW']) {
      S.ship.vx += Math.cos(S.ship.angle) * S.thrustPower * speedMult * dt;
      S.ship.vy += Math.sin(S.ship.angle) * S.thrustPower * speedMult * dt;
      thrusting = true;
    }
    if (S.keys['ArrowDown'] || S.keys['KeyS']) {
      S.ship.vx -= Math.cos(S.ship.angle) * S.thrustPower * 0.5 * speedMult * dt;
      S.ship.vy -= Math.sin(S.ship.angle) * S.thrustPower * 0.5 * speedMult * dt;
    }

    /* Mouse-driven movement: rotate toward target and thrust when held */
    S.mouseDrilling = false;
    if (S.mouseActive && S.mouseDown) {
      /* Recalculate world position from current camera (camera follows ship) */
      const tw = NS.input.canvasToWorld(S.mouseCanvasX, S.mouseCanvasY);
      S.mouseWorldX = tw.x;
      S.mouseWorldY = tw.y;

      const dx = S.mouseWorldX - S.ship.x;
      const dy = S.mouseWorldY - S.ship.y;
      const distToTarget = Math.hypot(dx, dy);

      /* Check if mouse target is near an asteroid -- prefer drilling over flying */
      let nearAsteroid = null;
      for (const a of S.asteroids) {
        if (a.resources <= 0) continue;
        if (Math.hypot(S.mouseWorldX - a.x, S.mouseWorldY - a.y) < a.radius + 20) {
          nearAsteroid = a;
          break;
        }
      }

      if (nearAsteroid) {
        /* Fly toward the asteroid, then drill once in range */
        const adx = nearAsteroid.x - S.ship.x;
        const ady = nearAsteroid.y - S.ship.y;
        const asteroidDist = Math.hypot(adx, ady);
        const targetAngle = Math.atan2(ady, adx);

        /* Rotate toward asteroid */
        let angleDiff = targetAngle - S.ship.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        S.ship.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), C.ROTATION_SPEED * dt);

        /* Thrust toward asteroid if not yet in drill range */
        if (asteroidDist > C.DRILL_RANGE + nearAsteroid.radius * 0.5) {
          S.ship.vx += Math.cos(S.ship.angle) * S.thrustPower * speedMult * dt;
          S.ship.vy += Math.sin(S.ship.angle) * S.thrustPower * speedMult * dt;
          thrusting = true;
        } else {
          /* In range: signal drilling */
          S.mouseDrilling = true;
        }
      } else if (distToTarget > C.SHIP_SIZE * 2) {
        /* Navigate toward the clicked point */
        const targetAngle = Math.atan2(dy, dx);

        /* Smooth rotation toward target */
        let angleDiff = targetAngle - S.ship.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        S.ship.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), C.ROTATION_SPEED * dt);

        /* Thrust when roughly facing target */
        if (Math.abs(angleDiff) < Math.PI * 0.6) {
          S.ship.vx += Math.cos(S.ship.angle) * S.thrustPower * speedMult * dt;
          S.ship.vy += Math.sin(S.ship.angle) * S.thrustPower * speedMult * dt;
          thrusting = true;
        }
      }
    }

    /* Drag */
    const drag = Math.pow(C.DRAG, SH.frameScale(dt));
    S.ship.vx *= drag;
    S.ship.vy *= drag;

    /* Speed limit */
    const speed = Math.hypot(S.ship.vx, S.ship.vy);
    const maxSpeed = S.thrustPower * 1.5 * speedMult;
    if (speed > maxSpeed) {
      S.ship.vx = (S.ship.vx / speed) * maxSpeed;
      S.ship.vy = (S.ship.vy / speed) * maxSpeed;
    }

    /* Position */
    S.ship.x += S.ship.vx * dt;
    S.ship.y += S.ship.vy * dt;

    /* Clamp to world bounds */
    if (S.ship.x < C.SHIP_SIZE) { S.ship.x = C.SHIP_SIZE; S.ship.vx = 0; }
    if (S.ship.y < C.SHIP_SIZE) { S.ship.y = C.SHIP_SIZE; S.ship.vy = 0; }
    if (S.ship.x > C.WORLD_W - C.SHIP_SIZE) { S.ship.x = C.WORLD_W - C.SHIP_SIZE; S.ship.vx = 0; }
    if (S.ship.y > C.WORLD_H - C.SHIP_SIZE) { S.ship.y = C.WORLD_H - C.SHIP_SIZE; S.ship.vy = 0; }

    /* Thruster particles */
    if (thrusting) {
      S.thrusterTimer += dt;
      if (S.thrusterTimer > 0.03) {
        S.thrusterTimer = 0;
        const bx = S.ship.x - Math.cos(S.ship.angle) * C.SHIP_SIZE;
        const by = S.ship.y - Math.sin(S.ship.angle) * C.SHIP_SIZE;
        const thrustColor = S.activePowerups.speed > 0 ? '#ff4' : '#f80';
        D.particles.trail(bx - S.camera.x, by - S.camera.y, { color: thrustColor, vx: -Math.cos(S.ship.angle) * 2, vy: -Math.sin(S.ship.angle) * 2 });
      }
    }

    /* Contextual hints */
    if (S.gameTime < 30) {
      const distToStation = Math.hypot(S.ship.x - C.STATION_X, S.ship.y - C.STATION_Y);
      if (distToStation < C.STATION_DOCK_RANGE * 1.5 && NS.economy.totalCargo() > 0)
        NS.hints.showHint('sell', 'Press E or click the station to sell ore and buy upgrades');

      let nearAsteroid = false;
      for (const a of S.asteroids) {
        if (a.resources <= 0) continue;
        if (Math.hypot(S.ship.x - a.x, S.ship.y - a.y) < C.DRILL_RANGE + a.radius + 30) {
          nearAsteroid = true;
          break;
        }
      }
      if (nearAsteroid && NS.economy.totalCargo() < S.cargoMax)
        NS.hints.showHint('drill', 'Hold SPACE or click and hold an asteroid to mine ore');

      if (S.gameTime > 3 && !thrusting)
        NS.hints.showHint('move', 'Use WASD/Arrows to fly, or click and hold to fly toward the cursor');
    }
  };
})();
