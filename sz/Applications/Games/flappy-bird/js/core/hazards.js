;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * The moving biome hazards as pure functions, shared by the game and the node tests
   * (the completability bot flies the very same rules). A hazard is a plain object from
   * SZ.FlappyCourse; step() advances it and returns an event name or '', hits() says
   * whether it touches the bird, gustPush() is the wind force on the bird.
   *
   * w = { dist, t, dt, step, birdX, birdY, birdR, windScale, crowScale }
   *   dist  - course scroll in px, t - course clock in s (stops under Frost Time),
   *   dt/step - frame time in s and in 60-fps frames (0 while frozen).
   */

  const GROUND_Y = 640;
  const GATE_W = 72;

  function circleRect(cx, cy, r, x, y, w, h) {
    const nx = Math.max(x, Math.min(cx, x + w));
    const ny = Math.max(y, Math.min(cy, y + h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function batY(hz, t) {
    return hz.y + hz.amp * Math.sin(Math.PI * 2 * t / hz.period + hz.phase);
  }

  /* the scanner beam's height: it sweeps the gap of its gate, 24 px short of either edge */
  function laserY(hz, t) {
    const y = hz.gapY + (hz.move ? hz.move.amp * Math.sin(Math.PI * 2 * t / hz.move.period + hz.move.phase) : 0);
    const amp = hz.gap / 2 - 24;
    return y + hz.dir * amp * Math.sin(Math.PI * 2 * t / hz.period + hz.phase);
  }

  function fireballY(hz, t) {
    const u = ((t + hz.phase) % hz.period) / hz.period;
    return GROUND_Y + 20 - hz.height * GROUND_Y * Math.sin(Math.PI * u);
  }

  function step(hz, w) {
    const birdWX = w.dist + w.birdX;
    if (hz.type === 'icicle') {
      if (hz.sy === undefined)
        hz.sy = hz.len;
      if (!hz.warnStarted && hz.x - birdWX < 420) {
        hz.warnStarted = true;
        hz.warn = 0.35;
      }
      if (hz.warnStarted && !hz.falling && !hz.smashed) {
        hz.warn -= w.dt;
        if (hz.warn <= 0) {
          hz.falling = true;
          hz.vy = 0;
          return 'drop';
        }
      }
      if (hz.falling && !hz.smashed) {
        hz.vy += 0.55 * w.step;
        hz.sy += hz.vy * w.step;
        if (hz.sy >= GROUND_Y) {
          hz.smashed = true;
          return 'smash';
        }
      }
    } else if (hz.type === 'bat') {
      hz.x -= 1.4 * w.step;
    } else if (hz.type === 'laser') {
      // a short hum whenever the beam turns at the top of its sweep
      const k = Math.floor((w.t / hz.period + hz.phase / (Math.PI * 2)) * 2);
      const ev = hz.half !== undefined && hz.half !== k ? 'laser' : '';
      hz.half = k;
      return ev;
    } else if (hz.type === 'fireball') {
      const cycle = Math.floor((w.t + hz.phase) / hz.period);
      const u = ((w.t + hz.phase) % hz.period) / hz.period;
      if (hz.soundCycle !== cycle && u < 0.5 && fireballY(hz, w.t) < GROUND_Y + 10) {
        hz.soundCycle = cycle;
        return 'launch';
      }
    } else if (hz.type === 'crow') {
      const scale = w.crowScale || 1;
      if (!hz.mode) {
        if (hz.x - birdWX < 560) {
          hz.mode = 'warn';
          hz.timer = 0.55;
          hz.target = Math.max(60, Math.min(GROUND_Y - 40, w.birdY));
          return 'caw';
        }
      } else if (hz.mode === 'warn') {
        hz.timer -= w.dt;
        hz.y += (hz.home + Math.sin(hz.timer * 20) * 3 - hz.y) * Math.min(1, 0.2 * w.step);
        if (hz.timer <= 0)
          hz.mode = 'dive';
      } else if (hz.mode === 'dive') {
        hz.x -= 3.6 * scale * w.step;
        hz.y += (hz.target - hz.y) * Math.min(1, 0.045 * scale * w.step);
      }
    }
    return '';
  }

  function hits(hz, w) {
    const sx = hz.x - w.dist;
    const bx = w.birdX, by = w.birdY, r = w.birdR;
    if (hz.type === 'icicle') {
      if (hz.smashed)
        return false;
      const sy = hz.sy === undefined ? hz.len : hz.sy;
      return circleRect(bx, by, r, sx - 9, sy - hz.len, 18, hz.len);
    }
    if (hz.type === 'bat') {
      const dx = sx - bx, dy = batY(hz, w.t) - by, rr = 15 + r;
      return dx * dx + dy * dy < rr * rr;
    }
    if (hz.type === 'laser')
      return circleRect(bx, by, r, sx - 8, laserY(hz, w.t) - 3, GATE_W + 16, 6);
    if (hz.type === 'fireball') {
      const fy = fireballY(hz, w.t);
      if (fy >= GROUND_Y + 10)
        return false;
      const dx = sx - bx, dy = fy - by, rr = 17 + r;
      return dx * dx + dy * dy < rr * rr;
    }
    if (hz.type === 'crow') {
      if (hz.beaten)
        return false;
      const dx = sx - bx, dy = hz.y - by, rr = 15 + r;
      return dx * dx + dy * dy < rr * rr;
    }
    return false;
  }

  /* vertical push per frame while the bird is inside a gust column */
  function gustPush(hz, w) {
    if (hz.type !== 'gust')
      return 0;
    const bwx = w.dist + w.birdX;
    if (bwx < hz.x || bwx > hz.x + hz.w)
      return 0;
    return hz.dir * hz.strength * (w.windScale === undefined ? 1 : w.windScale);
  }

  SZ.FlappyHazards = Object.freeze({ circleRect, batY, laserY, fireballY, step, hits, gustPush });
})();
