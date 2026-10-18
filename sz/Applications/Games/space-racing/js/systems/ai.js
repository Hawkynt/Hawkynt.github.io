/*
 * AI opponents: reaction delay, mistakes, racing line, braking before bends, rubber
 * band, laps and finish. Writes the racers in G.opponents; reads G.geo and G.ship.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { TWO_PI, STATE_PLAYING, SHIP_FRICTION, BASE_MAX_SPEED, AI_BASE_ACCEL, AI_BASE_TURN_SPEED,
    AI_MISTAKE_CHANCE, AI_MISTAKE_DURATION, AI_BRAKE_ON_TURN_THRESHOLD, AI_BRAKE_FACTOR, SPIN_RATE } = NS.constants;
  const { frameScale, frameRate } = NS.util;
  const { particles } = NS.runtime;
  const { advanceTrackState, applyTrackLimits } = NS.track;

  function updateAI(dt) {
    if (G.state !== STATE_PLAYING) return;

    for (let i = 0; i < G.opponents.length; ++i) {
      const ai = G.opponents[i];
      if (ai.finished) continue;

      const p = ai.personality;

      // Turbo item: extra speed and acceleration while it lasts
      if (ai.turbo > 0)
        ai.turbo -= dt;
      const spinning = ai.spin > 0;

      // Reaction delay: AI doesn't steer onto the racing line instantly
      ai.reactionTimer -= dt;
      if (ai.reactionTimer > 0) {
        // During reaction delay, just coast with friction
        const coastFriction = Math.pow(SHIP_FRICTION, frameScale(dt));
        ai.vx *= coastFriction;
        ai.vy *= coastFriction;
        ai.speed = Math.sqrt(ai.vx * ai.vx + ai.vy * ai.vy);
        ai.x += ai.vx * dt;
        ai.y += ai.vy * dt;
        advanceTrackState(ai.ts, ai.x, ai.y);
        applyTrackLimits(ai, dt, false);
        continue;
      }

      // Mistake system: occasionally steer the wrong way
      if (ai.mistakeTimer > 0) {
        ai.mistakeTimer -= dt;
        if (!spinning)
          ai.angle += ai.mistakeAngle * dt;
      } else if (Math.random() < frameRate(AI_MISTAKE_CHANCE * p.mistakeRate, dt)) {
        ai.mistakeTimer = AI_MISTAKE_DURATION * (0.5 + Math.random());
        ai.mistakeAngle = (Math.random() > 0.5 ? 1 : -1) * (1.0 + Math.random() * 1.5);
      }

      // Spin-out after a hit: the hull rolls on and ignores the racing line
      if (spinning) {
        ai.spin -= dt;
        ai.angle += SPIN_RATE * dt;
      }

      // Steer along a racing line ahead on the track
      const L = G.geo.length;
      const lookAhead = 140 + ai.speed * 0.45;
      const lp = G.geo.sampleAt(ai.ts.s + lookAhead);
      const lane = ai.personality.lane !== undefined ? ai.personality.lane : 0;
      const sway = Math.sin(G.globalTime * 0.7 + i * 1.9) * G.geo.width * 0.08;
      const lat = lane * G.geo.width * 0.22 + sway;
      const tx = lp.x + lp.nx * lat, ty = lp.y + lp.ny * lat;
      const dx = tx - ai.x;
      const dy = ty - ai.y;
      const targetAngle = Math.atan2(dy, dx);

      let angleDiff = targetAngle - ai.angle;
      while (angleDiff > Math.PI) angleDiff -= TWO_PI;
      while (angleDiff < -Math.PI) angleDiff += TWO_PI;

      const turnSpeed = AI_BASE_TURN_SPEED * p.turnBias;
      if (!spinning && ai.mistakeTimer <= 0) {
        if (angleDiff > 0)
          ai.angle += Math.min(turnSpeed * dt, angleDiff);
        else
          ai.angle += Math.max(-turnSpeed * dt, angleDiff);
      }

      // Hull bank: ease toward the side the AI is turning to
      const steer = Math.abs(angleDiff) > 0.05 ? (angleDiff > 0 ? 1 : -1) : 0;
      ai.bank += (steer - ai.bank) * frameRate(0.15, dt);

      // Sparks at the rear while an AI slides through a bend
      if (Math.abs(angleDiff) > 0.6 && ai.speed > 180 && Math.random() < frameRate(0.3, dt))
        particles.burst(
          ai.x - Math.cos(ai.angle) * 12,
          ai.y - Math.sin(ai.angle) * 12,
          1,
          { color: '#9ad8ff', speed: 2, life: 0.25, size: 1.5 }
        );

      // Brake before bends (AI is less efficient at this)
      const absAngleDiff = Math.abs(angleDiff);
      const a1 = G.geo.sampleAt(ai.ts.s + 80).angle;
      const a2 = G.geo.sampleAt(ai.ts.s + 380 + ai.speed * 0.3).angle;
      let bend = Math.abs(a2 - a1);
      if (bend > Math.PI) bend = TWO_PI - bend;
      let throttle = 1.0;
      if (bend > 0.9 || absAngleDiff > AI_BRAKE_ON_TURN_THRESHOLD)
        throttle = AI_BRAKE_FACTOR;
      else if (bend > 0.5)
        throttle = 0.85;

      // Rubber band: keep the race close
      const gap = (ai.ts.dist - G.ship.ts.dist) / L;     // + = AI ahead
      const band = gap > 0.12 ? 0.94 : gap < -0.12 ? 1.07 : 1;

      // Smooth throttle transitions
      ai.throttle += (throttle - ai.throttle) * frameRate(0.1, dt);

      // Accelerate along the racing line
      const accel = (spinning ? 0 : AI_BASE_ACCEL * ai.speedFactor * ai.throttle * band) * (ai.turbo > 0 ? 1.4 : 1);
      ai.vx += Math.cos(ai.angle) * accel * dt;
      ai.vy += Math.sin(ai.angle) * accel * dt;

      // Friction
      const friction = Math.pow(SHIP_FRICTION, frameScale(dt));
      ai.vx *= friction;
      ai.vy *= friction;

      // Clamp speed
      ai.speed = Math.sqrt(ai.vx * ai.vx + ai.vy * ai.vy);
      const aiMax = BASE_MAX_SPEED * ai.speedFactor * 0.93 * (ai.turbo > 0 ? 1.5 : 1);
      if (ai.speed > aiMax) {
        const ratio = aiMax / ai.speed;
        ai.vx *= ratio;
        ai.vy *= ratio;
        ai.speed = aiMax;
      }

      // Move
      ai.x += ai.vx * dt;
      ai.y += ai.vy * dt;
      advanceTrackState(ai.ts, ai.x, ai.y);
      applyTrackLimits(ai, dt, false);

      // Exhaust particles for AI
      if (ai.speed > 80) {
        const exhaustRate = ai.speed > 200 ? 0.3 : 0.1;
        if (Math.random() < exhaustRate)
          particles.trail(
            ai.x - Math.cos(ai.angle) * 12,
            ai.y - Math.sin(ai.angle) * 12,
            { color: ai.exhaustColor, speed: 0.8, life: 0.25, count: 1 }
          );
      }

      // Laps from the distance covered along the track
      const aiLaps = Math.floor(ai.ts.dist / L);
      if (!ai.finished && aiLaps >= G.raceLaps) {
        ai.finished = true;
        ai.finishTime = G.raceTime;
      }
      ai.lap = Math.max(0, Math.min(G.raceLaps, aiLaps));
    }
  }

  Object.assign(NS.module('ai'), {
    updateAI
  });
})();
