/* The world entities: ore-flecked asteroids with scanner overlays, floating
   powerups, the station with its dock ring, the ship with powerup effects,
   the drill beam, the scanner pulse and the minimap. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const EN = NS.entities;

  EN.drawAsteroids = function drawAsteroids() {
    for (const a of S.asteroids) {
      if (a.resources <= 0) continue;

      const sx = a.x - S.camera.x;
      const sy = a.y - S.camera.y;
      if (sx < -50 || sx > C.CANVAS_W + 50 || sy < -50 || sy > C.CANVAS_H + 50) continue;

      D.ctx.save();
      D.ctx.translate(sx, sy);
      D.ctx.rotate(a.rotationAngle);

      /* Asteroid body */
      D.ctx.beginPath();
      for (let i = 0; i < a.vertices.length; ++i) {
        const v = a.vertices[i];
        const px = Math.cos(v.angle) * v.dist;
        const py = Math.sin(v.angle) * v.dist;
        if (i === 0) D.ctx.moveTo(px, py);
        else D.ctx.lineTo(px, py);
      }
      D.ctx.closePath();
      D.ctx.fillStyle = '#5a4a3e';
      D.ctx.fill();
      D.ctx.strokeStyle = '#3a2a1e';
      D.ctx.lineWidth = 1.5;
      D.ctx.stroke();

      /* Ore glow spots */
      const ore = T.ORE_TYPES[a.oreType];
      const glowIntensity = a.resources / a.maxResources;
      D.ctx.shadowBlur = 10 * glowIntensity;
      D.ctx.shadowColor = ore.glowColor;
      D.ctx.fillStyle = ore.color;
      const oreSpots = 2 + Math.floor(a.radius / 10);
      for (let j = 0; j < oreSpots; ++j) {
        const oa = (j / oreSpots) * Math.PI * 2 + a.rotationAngle * 0.5;
        const od = a.radius * 0.4;
        D.ctx.beginPath();
        D.ctx.arc(Math.cos(oa) * od, Math.sin(oa) * od, 2 + glowIntensity * 2, 0, Math.PI * 2);
        D.ctx.fill();
      }
      D.ctx.shadowBlur = 0;

      D.ctx.restore();

      /* Scanner overlay: ore label when scanner upgraded */
      if (S.scannerLevel >= 1) {
        const dist = Math.hypot(S.ship.x - a.x, S.ship.y - a.y);
        const scanRange = 150 + S.scannerLevel * 100;
        if (dist < scanRange) {
          D.ctx.save();
          D.ctx.globalAlpha = 0.7;
          D.ctx.fillStyle = ore.color;
          D.ctx.font = '9px sans-serif';
          D.ctx.textAlign = 'center';
          D.ctx.fillText(ore.label, sx, sy - a.radius - 5);
          if (S.scannerLevel >= 2) {
            const pct = Math.round(glowIntensity * 100);
            D.ctx.fillText(pct + '%', sx, sy - a.radius - 15);
          }
          if (S.scannerLevel >= 3) {
            D.ctx.strokeStyle = ore.color;
            D.ctx.globalAlpha = 0.2;
            D.ctx.lineWidth = 1;
            D.ctx.setLineDash([2, 3]);
            D.ctx.beginPath();
            D.ctx.arc(sx, sy, a.radius + 8, 0, Math.PI * 2);
            D.ctx.stroke();
            D.ctx.setLineDash([]);
          }
          D.ctx.restore();
        }
      }
    }
  };

  EN.drawPowerups = function drawPowerups() {
    const now = S.gameTime || 0;
    for (const pu of S.powerups) {
      const sx = pu.x - S.camera.x;
      const sy = pu.y - S.camera.y;
      if (sx < -30 || sx > C.CANVAS_W + 30 || sy < -30 || sy > C.CANVAS_H + 30) continue;

      const def = T.POWERUP_DEFS[pu.type];
      const bob = Math.sin(pu.bobPhase) * 4;
      const pulse = 0.7 + 0.3 * Math.sin(pu.pulsePhase);
      const fadeAlpha = pu.lifetime < 3 ? pu.lifetime / 3 : 1;

      D.ctx.save();
      D.ctx.translate(sx, sy + bob);
      D.ctx.globalAlpha = fadeAlpha;

      /* Glow */
      D.ctx.shadowBlur = 12 * pulse;
      D.ctx.shadowColor = def.glowColor;

      /* Outer ring */
      D.ctx.strokeStyle = def.color;
      D.ctx.lineWidth = 2;
      D.ctx.beginPath();
      D.ctx.arc(0, 0, C.POWERUP_RADIUS * pulse, 0, Math.PI * 2);
      D.ctx.stroke();

      /* Inner fill */
      D.ctx.globalAlpha = fadeAlpha * 0.3;
      D.ctx.fillStyle = def.color;
      D.ctx.beginPath();
      D.ctx.arc(0, 0, C.POWERUP_RADIUS * 0.7 * pulse, 0, Math.PI * 2);
      D.ctx.fill();

      /* Icon letter */
      D.ctx.globalAlpha = fadeAlpha;
      D.ctx.shadowBlur = 0;
      D.ctx.fillStyle = '#fff';
      D.ctx.font = 'bold 12px sans-serif';
      D.ctx.textAlign = 'center';
      D.ctx.textBaseline = 'middle';
      D.ctx.fillText(def.icon, 0, 1);
      D.ctx.textBaseline = 'alphabetic';

      D.ctx.restore();
    }
  };

  EN.drawStation = function drawStation() {
    const sx = C.STATION_X - S.camera.x;
    const sy = C.STATION_Y - S.camera.y;
    if (sx < -100 || sx > C.CANVAS_W + 100 || sy < -100 || sy > C.CANVAS_H + 100) return;

    const now = S.gameTime || 0;

    /* Rotating outer ring */
    D.ctx.save();
    D.ctx.translate(sx, sy);
    D.ctx.rotate(now * 0.2);

    D.ctx.strokeStyle = '#4a9';
    D.ctx.lineWidth = 3;
    D.ctx.shadowBlur = 15;
    D.ctx.shadowColor = '#4a9';
    D.ctx.beginPath();
    D.ctx.arc(0, 0, C.STATION_RADIUS, 0, Math.PI * 2);
    D.ctx.stroke();

    /* Docking arms */
    D.ctx.lineWidth = 2;
    for (let i = 0; i < 4; ++i) {
      const armAngle = (i / 4) * Math.PI * 2;
      D.ctx.beginPath();
      D.ctx.moveTo(Math.cos(armAngle) * C.STATION_RADIUS * 0.6, Math.sin(armAngle) * C.STATION_RADIUS * 0.6);
      D.ctx.lineTo(Math.cos(armAngle) * C.STATION_RADIUS, Math.sin(armAngle) * C.STATION_RADIUS);
      D.ctx.stroke();
    }

    D.ctx.restore();

    /* Inner structure (fixed) */
    D.ctx.save();
    D.ctx.shadowBlur = 10;
    D.ctx.shadowColor = '#4a9';
    D.ctx.fillStyle = '#2a5a4a';
    D.ctx.beginPath();
    D.ctx.arc(sx, sy, C.STATION_RADIUS * 0.6, 0, Math.PI * 2);
    D.ctx.fill();

    /* Center dot with pulse */
    const centerPulse = 0.7 + 0.3 * Math.sin(now * 3);
    D.ctx.fillStyle = '#0f0';
    D.ctx.beginPath();
    D.ctx.arc(sx, sy, 4 * centerPulse, 0, Math.PI * 2);
    D.ctx.fill();

    D.ctx.shadowBlur = 0;
    D.ctx.restore();

    /* Dock range indicator */
    const distToStation = Math.hypot(S.ship.x - C.STATION_X, S.ship.y - C.STATION_Y);
    if (distToStation < C.STATION_DOCK_RANGE * 2) {
      D.ctx.save();
      D.ctx.strokeStyle = distToStation < C.STATION_DOCK_RANGE ? 'rgba(0,255,0,0.3)' : 'rgba(255,255,0,0.15)';
      D.ctx.setLineDash([4, 4]);
      D.ctx.beginPath();
      D.ctx.arc(sx, sy, C.STATION_DOCK_RANGE, 0, Math.PI * 2);
      D.ctx.stroke();
      D.ctx.setLineDash([]);
      D.ctx.restore();

      if (distToStation < C.STATION_DOCK_RANGE) {
        D.ctx.fillStyle = '#0f0';
        D.ctx.font = '11px sans-serif';
        D.ctx.textAlign = 'center';
        D.ctx.fillText(S.shopOpen ? 'Click Close or press E / ESC' : '[E] or Click to Sell & Shop', sx, sy + C.STATION_RADIUS + 20);
      }
    }
  };

  EN.drawShip = function drawShip() {
    const sx = S.ship.x - S.camera.x;
    const sy = S.ship.y - S.camera.y;

    D.ctx.save();
    D.ctx.translate(sx, sy);
    D.ctx.rotate(S.ship.angle);

    /* Shield effect */
    if (S.activePowerups.shield > 0) {
      D.ctx.save();
      const shieldPulse = 0.6 + 0.4 * Math.sin(S.gameTime * 4);
      D.ctx.globalAlpha = shieldPulse * 0.3;
      D.ctx.strokeStyle = '#44aaff';
      D.ctx.lineWidth = 2;
      D.ctx.shadowBlur = 10;
      D.ctx.shadowColor = '#44aaff';
      D.ctx.beginPath();
      D.ctx.arc(0, 0, C.SHIP_SIZE + 6, 0, Math.PI * 2);
      D.ctx.stroke();
      D.ctx.restore();
    }

    /* Speed trail effect */
    if (S.activePowerups.speed > 0) {
      D.ctx.save();
      D.ctx.globalAlpha = 0.3;
      D.ctx.strokeStyle = '#ffaa00';
      D.ctx.lineWidth = 1;
      for (let i = 1; i <= 3; ++i) {
        D.ctx.globalAlpha = 0.15 / i;
        D.ctx.beginPath();
        D.ctx.moveTo(-C.SHIP_SIZE * (0.4 + i * 0.3), -C.SHIP_SIZE * 0.3);
        D.ctx.lineTo(-C.SHIP_SIZE * (0.4 + i * 0.3) - 8 * i, 0);
        D.ctx.lineTo(-C.SHIP_SIZE * (0.4 + i * 0.3), C.SHIP_SIZE * 0.3);
        D.ctx.stroke();
      }
      D.ctx.restore();
    }

    /* Ship body */
    D.ctx.fillStyle = '#aab';
    D.ctx.beginPath();
    D.ctx.moveTo(C.SHIP_SIZE, 0);
    D.ctx.lineTo(-C.SHIP_SIZE * 0.7, -C.SHIP_SIZE * 0.6);
    D.ctx.lineTo(-C.SHIP_SIZE * 0.4, 0);
    D.ctx.lineTo(-C.SHIP_SIZE * 0.7, C.SHIP_SIZE * 0.6);
    D.ctx.closePath();
    D.ctx.fill();
    D.ctx.strokeStyle = '#889';
    D.ctx.lineWidth = 1;
    D.ctx.stroke();

    /* Cockpit */
    D.ctx.fillStyle = '#4af';
    D.ctx.beginPath();
    D.ctx.arc(C.SHIP_SIZE * 0.2, 0, 3, 0, Math.PI * 2);
    D.ctx.fill();

    /* Magnet indicator */
    if (S.activePowerups.magnet > 0) {
      D.ctx.save();
      const magnetPulse = 0.5 + 0.5 * Math.sin(S.gameTime * 6);
      D.ctx.globalAlpha = magnetPulse * 0.15;
      D.ctx.fillStyle = '#ff44ff';
      D.ctx.beginPath();
      D.ctx.arc(0, 0, C.SHIP_SIZE + 15, 0, Math.PI * 2);
      D.ctx.fill();
      D.ctx.restore();
    }

    D.ctx.restore();
  };

  EN.drawDrillBeam = function drawDrillBeam() {
    if (!S.isDrilling || !S.drillTarget) return;

    const sx = S.ship.x - S.camera.x;
    const sy = S.ship.y - S.camera.y;
    const tx = S.drillTarget.x - S.camera.x;
    const ty = S.drillTarget.y - S.camera.y;

    D.ctx.save();
    D.ctx.strokeStyle = T.ORE_TYPES[S.drillTarget.oreType].glowColor;
    D.ctx.lineWidth = 2;
    D.ctx.shadowBlur = 8;
    D.ctx.shadowColor = T.ORE_TYPES[S.drillTarget.oreType].glowColor;
    D.ctx.setLineDash([4, 3]);
    D.ctx.beginPath();
    D.ctx.moveTo(sx, sy);
    D.ctx.lineTo(tx, ty);
    D.ctx.stroke();
    D.ctx.setLineDash([]);
    D.ctx.shadowBlur = 0;
    D.ctx.restore();
  };

  EN.drawScannerOverlay = function drawScannerOverlay() {
    if (S.scannerLevel < 1) return;
    /* Draw scanner pulse ring from ship */
    const sx = S.ship.x - S.camera.x;
    const sy = S.ship.y - S.camera.y;
    const scanRange = 150 + S.scannerLevel * 100;
    const pulse = (S.gameTime * 0.5) % 1;
    D.ctx.save();
    D.ctx.globalAlpha = (1 - pulse) * 0.08;
    D.ctx.strokeStyle = '#4ae';
    D.ctx.lineWidth = 1;
    D.ctx.beginPath();
    D.ctx.arc(sx, sy, scanRange * pulse, 0, Math.PI * 2);
    D.ctx.stroke();
    D.ctx.restore();
  };

  EN.drawMinimap = function drawMinimap() {
    const mw = 100, mh = 100;
    const mx = C.CANVAS_W - mw - 8;
    const my = 8;
    const scaleX = mw / C.WORLD_W;
    const scaleY = mh / C.WORLD_H;

    D.ctx.save();
    D.ctx.globalAlpha = 0.6;
    D.ctx.fillStyle = '#111';
    D.ctx.fillRect(mx, my, mw, mh);
    D.ctx.strokeStyle = '#444';
    D.ctx.lineWidth = 1;
    D.ctx.strokeRect(mx, my, mw, mh);

    /* Asteroids on minimap */
    for (const a of S.asteroids) {
      if (a.resources <= 0) continue;
      D.ctx.fillStyle = T.ORE_TYPES[a.oreType].color;
      D.ctx.fillRect(mx + a.x * scaleX - 1, my + a.y * scaleY - 1, 2, 2);
    }

    /* Powerups on minimap */
    for (const pu of S.powerups) {
      D.ctx.fillStyle = T.POWERUP_DEFS[pu.type].color;
      D.ctx.fillRect(mx + pu.x * scaleX - 1, my + pu.y * scaleY - 1, 2, 2);
    }

    /* Station */
    D.ctx.fillStyle = '#0f0';
    D.ctx.fillRect(mx + C.STATION_X * scaleX - 2, my + C.STATION_Y * scaleY - 2, 4, 4);

    /* Ship */
    D.ctx.fillStyle = '#fff';
    D.ctx.fillRect(mx + S.ship.x * scaleX - 1.5, my + S.ship.y * scaleY - 1.5, 3, 3);

    /* Viewport rectangle */
    D.ctx.strokeStyle = '#fff';
    D.ctx.lineWidth = 0.5;
    D.ctx.strokeRect(mx + S.camera.x * scaleX, my + S.camera.y * scaleY, C.CANVAS_W * scaleX, C.CANVAS_H * scaleY);

    D.ctx.globalAlpha = 1;
    D.ctx.restore();
  };
})();
