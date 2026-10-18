/*
 * Visual effect simulation: thrust and speed particles, speed streaks, exhaust
 * trails, skid marks, themed ambience, lap flashes and results confetti.
 * Owns the effect lists in G; drawing lives in render/ and ui/.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, STATE_PLAYING, BASE_MAX_SPEED, DRIFT_TIER1, DRIFT_TIER2,
    AMBIENCE_MAX } = NS.constants;
  const { frameScale } = NS.util;
  const { particles } = NS.runtime;
  const { getPlayerShipDef } = NS.progress;

  let stormTimer = 0;

  let pulsarTimer = 0;

  function emitThrustParticles() {
    if (G.state !== STATE_PLAYING) return;

    const isThrusting = G.keys['ArrowUp'] || G.keys['KeyW'];
    const pd = getPlayerShipDef();

    // Thrust exhaust particles when accelerating
    if (isThrusting) {
      const ex = G.ship.x - Math.cos(G.ship.angle) * 12;
      const ey = G.ship.y - Math.sin(G.ship.angle) * 12;
      const spread = 0.4;
      const baseAngle = G.ship.angle + Math.PI;
      for (let i = 0; i < 2; ++i) {
        const a = baseAngle + (Math.random() - 0.5) * spread;
        const spd = 1.5 + Math.random() * 2;
        particles.trail(ex + (Math.random() - 0.5) * 4, ey + (Math.random() - 0.5) * 4, {
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          color: pd.exhaustColor || '#f80',
          life: 0.25 + Math.random() * 0.15,
          size: 1.5 + Math.random() * 1.5,
          decay: 0.04,
          shrink: 0.94
        });
      }
    }

    // Speed trail sparkles at high speed
    const speedRatio = G.ship.speed / BASE_MAX_SPEED;
    if (speedRatio > 0.6) {
      const trailRate = (speedRatio - 0.6) * 5;
      if (Math.random() < trailRate * 0.3) {
        const side = (Math.random() > 0.5 ? 1 : -1);
        const perpAngle = G.ship.angle + Math.PI / 2 * side;
        const ox = Math.cos(perpAngle) * (3 + Math.random() * 5);
        const oy = Math.sin(perpAngle) * (3 + Math.random() * 5);
        particles.trail(G.ship.x + ox - Math.cos(G.ship.angle) * 8, G.ship.y + oy - Math.sin(G.ship.angle) * 8, {
          vx: -G.ship.vx * 0.01,
          vy: -G.ship.vy * 0.01,
          color: G.boostActive ? '#0ff' : '#aaf',
          life: 0.15 + Math.random() * 0.1,
          size: 0.8 + Math.random(),
          decay: 0.05,
          shrink: 0.92
        });
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SPEED STREAKS -- screen-space lines spawning near the edges and
     flying away from the view center while the ship is quick
     ══════════════════════════════════════════════════════════════════ */

  function updateSpeedLines(dt) {
    if (G.state === STATE_PLAYING) {
      const maxSpeed = BASE_MAX_SPEED * (G.ship.stats ? G.ship.stats.speed : 1);
      if (G.ship.speed > 0.7 * maxSpeed || G.boostActive) {
        const count = 1 + Math.floor((G.ship.speed / maxSpeed) * 3);
        for (let i = 0; i < count && G.speedLines.length < 60; ++i) {
          const side = Math.floor(Math.random() * 4);
          let x, y;
          if (side === 0) { x = Math.random() * CANVAS_W; y = 6 + Math.random() * 40; }
          else if (side === 1) { x = CANVAS_W - 6 - Math.random() * 40; y = Math.random() * CANVAS_H; }
          else if (side === 2) { x = Math.random() * CANVAS_W; y = CANVAS_H - 6 - Math.random() * 40; }
          else { x = 6 + Math.random() * 40; y = Math.random() * CANVAS_H; }
          let dx = x - CANVAS_W / 2, dy = y - CANVAS_H / 2;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          G.speedLines.push({ x: x, y: y, dx: dx / d, dy: dy / d, len: 40 + Math.random() * 80, life: 0.5 });
        }
      }
    }

    const step = (G.ship.speed / 10) * frameScale(dt);
    for (let i = G.speedLines.length - 1; i >= 0; --i) {
      const sl = G.speedLines[i];
      sl.x += sl.dx * step;
      sl.y += sl.dy * step;
      sl.life -= dt;
      if (sl.life <= 0 || sl.x < -140 || sl.x > CANVAS_W + 140 || sl.y < -140 || sl.y > CANVAS_H + 140)
        G.speedLines.splice(i, 1);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     EXHAUST TRAILS -- the last 18 positions of every racer, drawn as
     a glowing ribbon that thickens toward the ship
     ══════════════════════════════════════════════════════════════════ */

  function updateTrails() {
    if (G.state !== STATE_PLAYING || !G.raceStarted) return;
    for (let i = 0; i < G.opponents.length; ++i) {
      const ai = G.opponents[i];
      ai.trail.push({ x: ai.x, y: ai.y });
      if (ai.trail.length > 18) ai.trail.shift();
    }
    G.ship.trail.push({ x: G.ship.x, y: G.ship.y });
    if (G.ship.trail.length > 18) G.ship.trail.shift();
  }

  function updateSkids(dt) {
    if (G.drifting && G.state === STATE_PLAYING) {
      const fx = Math.cos(G.ship.angle), fy = Math.sin(G.ship.angle);
      const sx = -Math.sin(G.ship.angle), sy = Math.cos(G.ship.angle);
      const color = G.driftTime >= DRIFT_TIER2 ? '#ffaa3a' : G.driftTime >= DRIFT_TIER1 ? '#5ab8ff' : '#9ad8ff';
      const lx = G.ship.x - fx * 14 + sx * 9, ly = G.ship.y - fy * 14 + sy * 9;
      const rx = G.ship.x - fx * 14 - sx * 9, ry = G.ship.y - fy * 14 - sy * 9;
      if (G.skidPrev) {
        const jx = lx - G.skidPrev.lx, jy = ly - G.skidPrev.ly;
        if (jx * jx + jy * jy <= 120 * 120) {   // skip wormhole jumps
          G.skids.push({ x1: G.skidPrev.lx, y1: G.skidPrev.ly, x2: lx, y2: ly, life: 6, color: color });
          G.skids.push({ x1: G.skidPrev.rx, y1: G.skidPrev.ry, x2: rx, y2: ry, life: 6, color: color });
          while (G.skids.length > 600) G.skids.shift();
        }
      }
      G.skidPrev = { lx: lx, ly: ly, rx: rx, ry: ry };
    } else {
      G.skidPrev = null;
    }
    for (let i = G.skids.length - 1; i >= 0; --i) {
      G.skids[i].life -= dt;
      if (G.skids[i].life <= 0)
        G.skids.splice(i, 1);
    }
  }

  function resetAmbience() {
    G.ambient = [];
    stormTimer = 3 + Math.random() * 3;
    G.stormFlash = 0;
    G.stormBolt = null;
    pulsarTimer = 0;
    G.pulsarRings = [];
    const theme = G.track.theme;
    for (let i = 0; i < AMBIENCE_MAX; ++i) {
      if (theme === 'solar') {
        G.ambient.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, vx: (Math.random() - 0.5) * 10, vy: -(12 + Math.random() * 20), size: 2 + Math.random(), phase: Math.random() * TWO_PI, color: '#ff8a3a' });
      } else if (theme === 'comet') {
        G.ambient.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, vx: 26 + Math.random() * 22, vy: 16 + Math.random() * 14, size: 1 + Math.random() * 1.5, phase: Math.random() * TWO_PI, color: '#bfe4ff' });
      } else if (theme === 'void') {
        G.ambient.push({ ax: Math.random() * CANVAS_W, ay: Math.random() * CANVAS_H, r: 10 + Math.random() * 30, a: Math.random() * TWO_PI, w: (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.4), size: 1.5 + Math.random(), phase: Math.random() * TWO_PI, color: '#6affc0' });
      } else if (theme === 'nebula' || theme === 'quasar') {
        const cloud = theme === 'quasar' ? ['#ff4cd8', '#a64cff', '#ff9af0'] : ['#6a3cff', '#c04cff', '#2a5cff'];
        G.ambient.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, size: 1 + Math.random() * 2, phase: Math.random() * TWO_PI, color: cloud[i % cloud.length] });
      } else if (theme === 'asteroid') {
        G.ambient.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 10, size: 3 + Math.random() * 3, phase: Math.random() * TWO_PI, color: '#5a3a22' });
      }
    }
  }

  function updateAmbient(dt) {
    const theme = G.track ? G.track.theme : null;
    if (theme === 'storm') {
      stormTimer -= dt;
      if (stormTimer <= 0) {
        stormTimer = 3 + Math.random() * 3;
        G.stormFlash = 0.12;
        let x = Math.random() * CANVAS_W;
        const pts = [{ x: x, y: 0 }];
        for (let y = 40; y < CANVAS_H * 0.55; y += 40) {
          x += (Math.random() - 0.5) * 70;
          pts.push({ x: x, y: y });
        }
        G.stormBolt = { pts: pts, life: 0.1 };
      }
      if (G.stormFlash > 0)
        G.stormFlash = Math.max(0, G.stormFlash - dt * (0.12 / 0.2));
      if (G.stormBolt) {
        G.stormBolt.life -= dt;
        if (G.stormBolt.life <= 0) G.stormBolt = null;
      }
    } else if (theme === 'pulsar') {
      pulsarTimer -= dt;
      if (pulsarTimer <= 0) {
        pulsarTimer = 1.5;
        G.pulsarRings.push({ r: 6, life: 1 });
        if (G.pulsarRings.length > 4) G.pulsarRings.shift();
      }
      for (let i = G.pulsarRings.length - 1; i >= 0; --i) {
        G.pulsarRings[i].r += 90 * dt;
        G.pulsarRings[i].life -= dt / 1.6;
        if (G.pulsarRings[i].life <= 0) G.pulsarRings.splice(i, 1);
      }
    }
    for (let i = 0; i < G.ambient.length; ++i) {
      const p = G.ambient[i];
      if (theme === 'void') {
        p.a += p.w * dt;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function updateFlashes(dt) {
    if (G.lapFlash) {
      G.lapFlash.alpha -= G.lapFlash.rate * dt;
      if (G.lapFlash.alpha <= 0) G.lapFlash = null;
    }
    if (G.finalFlash) {
      G.finalFlash.alpha -= G.finalFlash.rate * dt;
      if (G.finalFlash.alpha <= 0) G.finalFlash = null;
    }
  }

  /* Screen-space confetti for podium finishes */
  function spawnConfetti() {
    G.confetti = [];
    const cols = ['#f44', '#ffd75a', '#6fe08a', '#5ab8ff', '#f4f', '#0ff'];
    for (let i = 0; i < 140; ++i)
      G.confetti.push({
        x: Math.random() * CANVAS_W,
        y: -Math.random() * CANVAS_H,
        vx: (Math.random() - 0.5) * 70,
        vy: 130 + Math.random() * 170,
        w: 5 + Math.random() * 5,
        h: 8 + Math.random() * 7,
        rot: Math.random() * TWO_PI,
        vr: (Math.random() - 0.5) * 7,
        color: cols[(Math.random() * cols.length) | 0]
      });
  }

  function updateConfetti(dt) {
    for (let i = 0; i < G.confetti.length; ++i) {
      const c = G.confetti[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      if (c.y > CANVAS_H + 20) {
        c.y = -20;
        c.x = Math.random() * CANVAS_W;
      }
    }
  }

  Object.assign(NS.module('effects'), {
    emitThrustParticles, updateSpeedLines, updateTrails, updateSkids, resetAmbience, updateAmbient,
    updateFlashes, spawnConfetti, updateConfetti
  });
})();
