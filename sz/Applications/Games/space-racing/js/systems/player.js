/*
 * Player ship: launch and countdown start, steering, drifting and mini-turbos,
 * manual boost, mouse steering, slipstream. Reads G.keys / mouse input, writes G.ship
 * and the boost, drift and launch values in G.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { TWO_PI, STATE_PLAYING, BASE_ACCEL, BASE_BRAKE, SHIP_FRICTION, BASE_TURN_SPEED,
    BASE_MAX_SPEED, BASE_BOOST_MULT, PERFECT_START_WINDOW, EARLY_THROTTLE_WINDOW, STALL_DURATION,
    BOOST_METER_MAX, BOOST_COST, DRIFT_MIN_SPEED, DRIFT_TURN_MULT, DRIFT_TIER1, DRIFT_TIER2,
    DRIFT_ACCEL_MULT, DRIFT_METER_RATE, SLIPSTREAM_CONE, SLIPSTREAM_RANGE, SLIPSTREAM_MIN_SPEED,
    SLIP_METER_RATE, SLIP_SPEED_MULT, SPIN_RATE } = NS.constants;
  const { frameScale, frameRate } = NS.util;
  const { particles, screenShake, floatingText } = NS.runtime;
  const { treeLevel } = NS.progress;
  const { advanceTrackState, applyTrackLimits } = NS.track;
  const View = NS.module('view');

  function updateShip(dt) {
    if (G.state !== STATE_PLAYING) return;

    const stats = G.ship.stats;
    const accel = BASE_ACCEL * stats.accel;
    const brake = BASE_BRAKE * stats.accel;
    const slipMult = G.slipstream > 0.5 ? 1 + SLIP_SPEED_MULT * G.slipstream : 1;
    const maxSpeed = (G.boostActive ? BASE_MAX_SPEED * BASE_BOOST_MULT * stats.boost : BASE_MAX_SPEED) * stats.speed * slipMult;

    // Launch: accelerating right at GO pays off, holding the throttle before it stalls the engine
    if (G.stallTimer > 0)
      G.stallTimer -= dt;
    const throttleHeld = isThrottleHeld();
    if (G.launchWindow > 0) {
      G.launchWindow -= dt;
      if (throttleHeld && G.stallTimer <= 0) {
        G.boostActive = true;
        G.boostTimer = 1.0 + (treeLevel('b_launch') > 0 ? 0.5 : 0);
        G.bonusPerfectStart = true;
        floatingText.add(G.ship.x, G.ship.y - 40, 'PERFECT START!', { color: '#ffd75a', font: 'bold 20px sans-serif' });
        SZ.GameAudio.play('powerup');
        G.launchWindow = 0;
      }
    }

    // Spin-out after a hit: the hull rolls on and ignores the controls
    const spinning = G.ship.spin > 0;
    if (spinning) {
      G.ship.spin -= dt;
      G.ship.angle += SPIN_RATE * dt;
      G.drifting = false;
      G.driftTime = 0;
    }

    // Steering
    const steer = spinning ? 0 : (G.keys['ArrowLeft'] || G.keys['KeyA'] ? -1 : 0) + (G.keys['ArrowRight'] || G.keys['KeyD'] ? 1 : 0);

    // Drifting: hold Space while steering at speed, release for a mini-turbo
    if (G.keys['Space'] && steer !== 0 && G.ship.speed > DRIFT_MIN_SPEED) {
      if (!G.drifting) {
        G.drifting = true;
        G.driftDir = steer;
        G.driftTime = 0;
      }
      G.driftTime += dt * (1 + 0.15 * treeLevel('h_drift'));
      G.boostMeter = Math.min(BOOST_METER_MAX, G.boostMeter + DRIFT_METER_RATE * (1 + 0.15 * treeLevel('b_cap')) * dt);
      if (Math.random() < frameRate(0.6, dt)) {
        const sparkColor = G.driftTime >= DRIFT_TIER2 ? '#ffaa3a' : G.driftTime >= DRIFT_TIER1 ? '#5ab8ff' : '#9ad8ff';
        const perp = G.ship.angle + Math.PI / 2;
        const kickX = Math.cos(perp) * 30 * G.driftDir;
        const kickY = Math.sin(perp) * 30 * G.driftDir;
        for (let side = -1; side <= 1; side += 2) {
          particles.burst(
            G.ship.x - Math.cos(G.ship.angle) * 12 + Math.cos(perp) * 9 * side,
            G.ship.y - Math.sin(G.ship.angle) * 12 + Math.sin(perp) * 9 * side,
            1,
            { color: sparkColor, speed: 2.5, life: 0.3, size: 2, vx: kickX, vy: kickY }
          );
        }
      }
    } else if (G.drifting) {
      if (G.driftTime >= DRIFT_TIER2) {
        G.boostActive = true;
        G.boostTimer = 1.1;
        ++G.bonusMegaTurbos;
        floatingText.add(G.ship.x, G.ship.y - 40, 'MEGA TURBO!', { color: '#ffaa3a', font: 'bold 20px sans-serif' });
        SZ.GameAudio.play('powerup', { pitch: 1.2 });
      } else if (G.driftTime >= DRIFT_TIER1) {
        G.boostActive = true;
        G.boostTimer = 0.6;
        floatingText.add(G.ship.x, G.ship.y - 40, 'TURBO!', { color: '#5ab8ff', font: 'bold 18px sans-serif' });
        SZ.GameAudio.play('whoosh', { pitch: 1.4 });
      }
      G.drifting = false;
      G.driftTime = 0;
    }

    // Manual boost: spend the meter with Shift
    if ((G.keyJustPressed['ShiftLeft'] || G.keyJustPressed['ShiftRight']) && G.raceStarted) {
      const boostCost = BOOST_COST - 5 * treeLevel('b_burn');
      if (!G.boostActive && G.boostMeter >= boostCost) {
        G.boostMeter -= boostCost;
        G.boostActive = true;
        G.boostTimer = 1.0 * stats.boost;
        SZ.GameAudio.play('whoosh', { pitch: 1.6 });
        screenShake.trigger(4, 150);
      } else if (G.boostMeter < boostCost)
        SZ.GameAudio.play('error', { volume: 0.4 });
    }

    const turnSpeed = BASE_TURN_SPEED * stats.handling * (G.drifting ? DRIFT_TURN_MULT : 1);
    if (!spinning && (G.keys['ArrowLeft'] || G.keys['KeyA']))
      G.ship.angle -= turnSpeed * dt;
    if (!spinning && (G.keys['ArrowRight'] || G.keys['KeyD']))
      G.ship.angle += turnSpeed * dt;

    // Mouse steering: ship follows mouse cursor while button pressed
    // Use screen-space coordinates so camera smoothing lag doesn't offset the angle
    if (!spinning && G.mouseControlActive && G.mouseDown && G.mouseX >= 0) {
      const sp = View.worldToScreen(G.ship.x, G.ship.y);
      const shipScreenX = sp.x;
      const shipScreenY = sp.y;
      const mx = G.mouseX - shipScreenX;
      const my = G.mouseY - shipScreenY;
      if (mx * mx + my * my > 25)
        G.ship.angle = Math.atan2(my, mx);
    }

    // Hull bank: ease toward the direction being steered, back to level when not
    G.ship.bank += (steer - G.ship.bank) * frameRate(0.15, dt);

    // Acceleration / braking
    if (throttleHeld && G.stallTimer <= 0 && !spinning) {
      const launchAccel = accel * (G.drifting ? DRIFT_ACCEL_MULT : 1);
      G.ship.vx += Math.cos(G.ship.angle) * launchAccel * dt;
      G.ship.vy += Math.sin(G.ship.angle) * launchAccel * dt;
    }
    if (!spinning && (G.keys['ArrowDown'] || G.keys['KeyS'])) {
      G.ship.vx -= Math.cos(G.ship.angle) * brake * dt;
      G.ship.vy -= Math.sin(G.ship.angle) * brake * dt;
    }

    // Friction
    const friction = Math.pow(SHIP_FRICTION, frameScale(dt));
    G.ship.vx *= friction;
    G.ship.vy *= friction;

    // Clamp speed
    G.ship.speed = Math.sqrt(G.ship.vx * G.ship.vx + G.ship.vy * G.ship.vy);
    if (G.ship.speed > maxSpeed) {
      const ratio = maxSpeed / G.ship.speed;
      G.ship.vx *= ratio;
      G.ship.vy *= ratio;
      G.ship.speed = maxSpeed;
    }

    // Move
    G.ship.x += G.ship.vx * dt;
    G.ship.y += G.ship.vy * dt;
    advanceTrackState(G.ship.ts, G.ship.x, G.ship.y);
    applyTrackLimits(G.ship, dt, true);

    // Boost timer
    if (G.boostActive) {
      G.boostTimer -= dt;
      if (G.boostTimer <= 0) {
        G.boostActive = false;
        G.boostTimer = 0;
      }
      particles.trail(
        G.ship.x - Math.cos(G.ship.angle) * 14,
        G.ship.y - Math.sin(G.ship.angle) * 14,
        { color: G.ship.def.exhaustColor || '#f80', speed: 1.5, life: 0.4, count: 2 }
      );
    }
  }

  /* Slipstream: sit in the tow of an opponent ahead to refill the boost meter */
  function updateSlipstream(dt) {
    if (G.state !== STATE_PLAYING || !G.raceStarted) {
      G.slipstream = 0;
      return;
    }

    let towed = false;
    if (G.ship.speed > SLIPSTREAM_MIN_SPEED) {
      const heading = Math.atan2(G.ship.vy, G.ship.vx);
      let nearest = SLIPSTREAM_RANGE;
      for (let i = 0; i < G.opponents.length; ++i) {
        const ai = G.opponents[i];
        const dx = ai.x - G.ship.x;
        const dy = ai.y - G.ship.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= nearest || d < 1) continue;
        let da = Math.atan2(dy, dx) - heading;
        while (da > Math.PI) da -= TWO_PI;
        while (da < -Math.PI) da += TWO_PI;
        if (Math.abs(da) < SLIPSTREAM_CONE) {
          towed = true;
          nearest = d;
        }
      }
    }

    G.slipstream = towed ? Math.min(1, G.slipstream + dt * 2) : Math.max(0, G.slipstream - dt * 3);

    if (G.slipstream < 0.2)
      G.slipstreamSounded = false;
    if (G.slipstream > 0.5) {
      if (!G.slipstreamSounded) {
        G.slipstreamSounded = true;
        SZ.GameAudio.sweep(400, 900, 0.3, 'sine', 0.05);
      }
      G.boostMeter = Math.min(BOOST_METER_MAX, G.boostMeter + SLIP_METER_RATE * (1 + 0.15 * treeLevel('b_cap')) * dt);
      if (Math.random() < frameRate(0.4, dt)) {
        // thin wind streaks running past the hull
        const side = Math.random() > 0.5 ? 1 : -1;
        const perp = G.ship.angle + Math.PI / 2 * side;
        particles.trail(
          G.ship.x + Math.cos(perp) * 14 - Math.cos(G.ship.angle) * 6,
          G.ship.y + Math.sin(perp) * 14 - Math.sin(G.ship.angle) * 6,
          { vx: -G.ship.vx * 0.02, vy: -G.ship.vy * 0.02, color: 'rgba(255,255,255,0.7)', life: 0.2, size: 1, decay: 0.06, shrink: 0.96 }
        );
      }
    }
  }

  /* Up / W, or the mouse button held in mouse steering mode */
  function isThrottleHeld() {
    return !!(G.keys['ArrowUp'] || G.keys['KeyW'] || (G.mouseControlActive && G.mouseDown));
  }

  /* Countdown to GO: accelerating right at the green light pays off, holding the
     throttle just before it stalls the engine */
  function updateRaceStart(dt) {
    if (G.state !== STATE_PLAYING || G.raceFinished || G.raceStarted) return;

    G.countdown -= dt;
    const throttleHeld = isThrottleHeld();
    if (throttleHeld && G.countdown <= EARLY_THROTTLE_WINDOW)
      G.earlyThrottle = true;
    if (G.countdown > 0) return;

    G.raceStarted = true;
    G.launchWindow = PERFECT_START_WINDOW * (treeLevel('b_launch') > 0 ? 2 : 1);
    if (G.earlyThrottle) {
      G.stallTimer = STALL_DURATION;
      floatingText.add(G.ship.x, G.ship.y - 40, 'JUMP START!', { color: '#ff6a6a', font: 'bold 18px sans-serif' });
      SZ.GameAudio.play('error', { volume: 0.5 });
    } else {
      floatingText.add(G.ship.x, G.ship.y - 40, 'GO!', { color: '#6fe08a', font: 'bold 26px sans-serif' });
      SZ.GameAudio.play('powerup', { pitch: 1.5 });
    }
  }

  Object.assign(NS.module('player'), {
    updateShip, updateSlipstream, updateRaceStart, isThrottleHeld
  });
})();
