/*
 * World drawing: background, road, track features, item boxes, missiles, mines,
 * shockwaves, ships, trails, skids, ambience, flashes, speed streaks and AI name chips.
 * Reads G only.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { _hexAlpha, CANVAS_W, CANVAS_H, TWO_PI, STATE_PLAYING, GRAVITY_MAX_DIST, WORMHOLE_RADIUS } = NS.constants;
  const { ctx, ui } = NS.runtime;
  const { drawFullBackground, worldToScreen, inView } = NS.view;

  function drawTrail(trail, color, boosting) {
    if (!trail || trail.length < 2) return;
    ctx.strokeStyle = color;
    for (let i = 1; i < trail.length; ++i) {
      const dx = trail[i].x - trail[i - 1].x, dy = trail[i].y - trail[i - 1].y;
      if (dx * dx + dy * dy > 120 * 120) continue;   // wormhole jump -- no chord across the map
      const t = i / trail.length;
      ctx.lineWidth = (2 + 6 * t) * (boosting ? 2 : 1);
      ctx.globalAlpha = 0.5 * t;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawTrails() {
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    drawTrail(G.ship.trail, (G.ship.def && G.ship.def.exhaustColor) || '#f80', G.boostActive);
    for (let i = 0; i < G.opponents.length; ++i) {
      const ai = G.opponents[i];
      drawTrail(ai.trail, ai.exhaustColor, ai.turbo > 0);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawSkids() {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < G.skids.length; ++i) {
      const s = G.skids[i];
      ctx.globalAlpha = Math.min(1, s.life / 2) * 0.5;
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawAmbient() {
    if (!G.track) return;
    const theme = G.track.theme;
    const pz = theme === 'asteroid' ? 0.2 : 0.05;
    for (let i = 0; i < G.ambient.length; ++i) {
      const p = G.ambient[i];
      let x = p.x, y = p.y;
      if (theme === 'void') {
        x = p.ax + Math.cos(p.a) * p.r;
        y = p.ay + Math.sin(p.a) * p.r;
      }
      x = (((x - G.camX * pz) % CANVAS_W) + CANVAS_W) % CANVAS_W;
      y = (((y - G.camY * pz) % CANVAS_H) + CANVAS_H) % CANVAS_H;
      let alpha = 0.4;
      if (theme === 'solar') alpha = 0.35 + 0.3 * Math.sin(G.globalTime * 5 + p.phase);
      else if (theme === 'comet') alpha = 0.35;
      else if (theme === 'nebula' || theme === 'quasar') alpha = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(G.globalTime * 2.5 + p.phase));
      else if (theme === 'asteroid') alpha = 0.7;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (theme === 'storm') {
      if (G.stormFlash > 0) {
        ctx.globalAlpha = G.stormFlash;
        ctx.fillStyle = '#bff6ff';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
      if (G.stormBolt) {
        ctx.globalAlpha = Math.min(1, G.stormBolt.life / 0.1) * 0.8;
        ctx.strokeStyle = '#e8fbff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < G.stormBolt.pts.length; ++k) {
          const pt = G.stormBolt.pts[k];
          if (k === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (theme === 'pulsar') {
      ctx.strokeStyle = '#bfe6ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < G.pulsarRings.length; ++i) {
        const ring = G.pulsarRings[i];
        ctx.globalAlpha = 0.25 * Math.max(0, ring.life);
        ctx.beginPath();
        ctx.arc(CANVAS_W * 0.82, CANVAS_H * 0.3, ring.r, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFlashes() {
    if (G.lapFlash) {
      ctx.globalAlpha = Math.max(0, G.lapFlash.alpha);
      ctx.fillStyle = G.lapFlash.color;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    if (G.finalFlash) {
      ctx.globalAlpha = Math.max(0, G.finalFlash.alpha);
      ctx.fillStyle = G.finalFlash.color;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground() {
    if (G.trackArt)
      drawFullBackground(G.camX, G.camY, G.camZoom);
    else {
      ctx.fillStyle = '#0b0d1c';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  function drawTrack() {
    if (G.trackArt)
      G.trackArt.drawRoad(ctx, G.globalTime);
  }

  function drawBoostPads() {
    for (let i = 0; i < G.raceBoostPads.length; ++i) {
      const pad = G.raceBoostPads[i];
      if (!inView(pad.x, pad.y, 40)) continue;
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.rotate(pad.angle);
      ctx.fillStyle = 'rgba(0,255,255,0.22)';
      ctx.fillRect(-20, -9, 40, 18);
      ctx.fillStyle = '#0ff';
      ctx.fillRect(-15, -5, 30, 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('>>>', 0, 0);
      ctx.restore();
    }
  }

  function drawHazards() {
    for (let i = 0; i < G.raceHazards.length; ++i) {
      const h = G.raceHazards[i];
      if (!inView(h.x, h.y, h.radius + 40)) continue;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, TWO_PI);
      if (h.type === 'barrier') {
        ctx.fillStyle = '#f22';
      } else {
        ctx.fillStyle = '#665';
      }
      ctx.fill();

      if (h.type === 'asteroid') {
        ctx.fillStyle = '#887';
        ctx.beginPath();
        ctx.arc(h.x - 3, h.y - 2, h.radius * 0.3, 0, TWO_PI);
        ctx.fill();
      }
    }
  }

  function drawGravityBodies() {
    const bodies = G.raceGravity;
    if (!bodies || !bodies.length) return;

    for (let b = 0; b < bodies.length; ++b) {
      const body = bodies[b];
      if (!inView(body.x, body.y, (body.radius || 60) * 5)) continue;
      ctx.save();

      if (body.type === 'blackhole') {
        // Black hole: dark center with swirling accretion disc
        const pulse = 1 + 0.1 * Math.sin(G.globalTime * 3);
        // Accretion disc glow
        const grad = ctx.createRadialGradient(body.x, body.y, body.radius * 0.3, body.x, body.y, body.radius * 3 * pulse);
        grad.addColorStop(0, 'rgba(80,0,120,0.5)');
        grad.addColorStop(0.4, 'rgba(120,40,180,0.2)');
        grad.addColorStop(1, 'rgba(60,0,100,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 3 * pulse, 0, TWO_PI);
        ctx.fill();

        // Swirl ring
        ctx.strokeStyle = 'rgba(180,100,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(body.x, body.y, body.radius * 2.2 * pulse, body.radius * 1.2 * pulse, G.globalTime * 0.5, 0, TWO_PI);
        ctx.stroke();

        // Dark center
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius, 0, TWO_PI);
        ctx.fill();
      } else if (body.type === 'star') {
        // Star: bright glowing center with pulsating corona
        const pulse = 1 + 0.15 * Math.sin(G.globalTime * 2.5);
        const grad = ctx.createRadialGradient(body.x, body.y, body.radius * 0.2, body.x, body.y, body.radius * 3 * pulse);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, body.color);
        grad.addColorStop(0.6, body.color.slice(0, 4) + '8');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 3 * pulse, 0, TWO_PI);
        ctx.fill();

        // Bright core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 0.6, 0, TWO_PI);
        ctx.fill();
      } else {
        // Planet: solid with atmosphere glow
        const pulse = 1 + 0.05 * Math.sin(G.globalTime * 1.5);
        // Atmosphere
        const grad = ctx.createRadialGradient(body.x, body.y, body.radius * 0.8, body.x, body.y, body.radius * 2 * pulse);
        grad.addColorStop(0, _hexAlpha(body.color, '60'));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 2 * pulse, 0, TWO_PI);
        ctx.fill();

        // Planet body
        ctx.fillStyle = body.color;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius, 0, TWO_PI);
        ctx.fill();

        // Light highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(body.x - body.radius * 0.3, body.y - body.radius * 0.3, body.radius * 0.4, 0, TWO_PI);
        ctx.fill();
      }

      // Gravity range indicator (subtle dashed circle)
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(body.x, body.y, GRAVITY_MAX_DIST, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  function drawWormholes() {
    const holes = G.raceWormholes;
    if (!holes || !holes.length) return;

    for (let i = 0; i < holes.length; ++i) {
      const wh = holes[i];
      if (!inView(wh.x, wh.y, 140)) continue;
      ctx.save();

      // Swirling outer ring
      const time = G.globalTime * 2;
      for (let ring = 3; ring >= 0; --ring) {
        const r = WORMHOLE_RADIUS + ring * 4;
        const alpha = 0.15 - ring * 0.03;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = wh.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wh.x, wh.y, r, time + ring * 0.5, time + ring * 0.5 + Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Swirling gradient center
      const pulse = 1 + 0.12 * Math.sin(G.globalTime * 3 + i * Math.PI);
      const grad = ctx.createRadialGradient(wh.x, wh.y, 0, wh.x, wh.y, WORMHOLE_RADIUS * pulse);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.2, wh.color);
      grad.addColorStop(0.7, _hexAlpha(wh.color, '40'));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wh.x, wh.y, WORMHOLE_RADIUS * pulse, 0, TWO_PI);
      ctx.fill();

      // Inner swirl lines
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      for (let arm = 0; arm < 3; ++arm) {
        const baseAngle = time + arm * (TWO_PI / 3);
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.05) {
          const spiralR = t * WORMHOLE_RADIUS * 0.8;
          const spiralA = baseAngle + t * 4;
          const sx = wh.x + Math.cos(spiralA) * spiralR;
          const sy = wh.y + Math.sin(spiralA) * spiralR;
          if (t === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Center glow dot
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(wh.x, wh.y, 3, 0, TWO_PI);
      ctx.fill();

      ctx.restore();
    }
  }

  /* Rounded rectangle path, used by the item boxes and the HUD item slot */
  function pathRoundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawItemBoxes() {
    for (let i = 0; i < G.raceItemBoxes.length; ++i) {
      const box = G.raceItemBoxes[i];
      if (!inView(box.x, box.y, 40)) continue;
      if (box.respawn > 0) continue;
      const bob = 3 * Math.sin(G.globalTime * 3 + i);
      ctx.save();
      ctx.translate(box.x, box.y + bob);

      // soft halo
      ctx.fillStyle = 'rgba(255,215,90,0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, TWO_PI);
      ctx.fill();

      // the turning box
      ctx.save();
      ctx.rotate(G.globalTime * 1.5);
      const grad = ctx.createLinearGradient(0, -13, 0, 13);
      grad.addColorStop(0, '#ffd75a');
      grad.addColorStop(1, '#ff8a3a');
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = grad;
      pathRoundRect(-13, -13, 26, 26, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // the question mark stays upright
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }

  function drawMissiles() {
    for (let i = 0; i < G.projectiles.length; ++i) {
      const p = G.projectiles[i];
      ctx.fillStyle = 'rgba(255,138,58,0.5)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, TWO_PI);
      ctx.fill();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#f2f5fa';
      ctx.fillRect(-8, -2.5, 16, 5);
      ctx.fillStyle = '#f44';
      ctx.beginPath();
      ctx.moveTo(8, -2.5);
      ctx.lineTo(13, 0);
      ctx.lineTo(8, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMines() {
    for (let i = 0; i < G.mines.length; ++i) {
      const m = G.mines[i];
      if (!inView(m.x, m.y, 40)) continue;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.strokeStyle = '#7a8296';
      ctx.lineWidth = 2;
      for (let k = 0; k < 4; ++k) {
        const a = k * (Math.PI / 2) + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.stroke();
      }
      ctx.fillStyle = '#232838';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TWO_PI);
      ctx.fill();
      const blink = m.armed > 0 ? 1 : 0.5 + 0.5 * Math.sin(G.globalTime * 10);
      ctx.fillStyle = `rgba(255,70,70,${(0.3 + 0.7 * blink).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawShockwaves() {
    for (let i = 0; i < G.shockwaves.length; ++i) {
      const w = G.shockwaves[i];
      ctx.strokeStyle = `rgba(138,216,255,${(Math.max(0, w.life / 0.5) * 0.8).toFixed(3)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, TWO_PI);
      ctx.stroke();
    }
  }

  function drawShip(x, y, angle, color, accentColor, exhaustColor, shape, isPlayer, isThrusting, bank, shield) {
    SZ.RacingShipArt.drawShip(ctx, {
      x: x,
      y: y,
      angle: angle,
      shape: shape,
      color: color,
      accent: accentColor,
      exhaust: exhaustColor || '#f80',
      bank: bank || 0,
      thrust: isThrusting ? 1 : 0.15,
      boost: isPlayer && G.boostActive,
      scale: 1,
      time: G.globalTime,
      shield: !!shield
    });
  }

  function drawSpeedLines() {
    if (!G.speedLines.length) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = G.boostActive ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)';
    for (let i = 0; i < G.speedLines.length; ++i) {
      const sl = G.speedLines[i];
      ctx.beginPath();
      ctx.moveTo(sl.x, sl.y);
      ctx.lineTo(sl.x - sl.dx * sl.len, sl.y - sl.dy * sl.len);
      ctx.stroke();
    }
  }

  /* Name chips floating above the AI ships, drawn in screen space */
  function drawNameChips() {
    if (G.state !== STATE_PLAYING) return;
    for (let i = 0; i < G.opponents.length; ++i) {
      const ai = G.opponents[i];
      const p = worldToScreen(ai.x, ai.y);
      if (p.x < -60 || p.x > CANVAS_W + 60 || p.y < -40 || p.y > CANVAS_H + 40)
        continue;
      ui.drawChip(ai.name, p.x, p.y - 34 * G.camZoom, 18, {
        align: 'center', px: 11, color: '#ffffff', bg: ui.hexToRgba(ai.color, 0.55), border: ai.color
      });
    }
  }

  Object.assign(NS.module('world'), {
    drawTrails, drawSkids, drawAmbient, drawFlashes, drawBackground, drawTrack, drawBoostPads, drawHazards,
    drawGravityBodies, drawWormholes, drawItemBoxes, drawMissiles, drawMines, drawShockwaves, drawShip,
    drawSpeedLines, drawNameChips
  });
})();
