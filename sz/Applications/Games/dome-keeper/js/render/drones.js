;(function() {
  'use strict';

  // Drawing drones in the mine and at the dome, and the drone HUD.
  // Owns: NS.droneArt
  // Reads: constants, util, dom, sprites, fxArt, textLayout, panels, hudFading, rules, drones
  // Reads state of: gameState, drones

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TILE_SIZE } = NS.constants;
  const { hexToRgba } = NS.util;
  const { ctx, particles } = NS.dom;
  const { drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { fitText } = NS.textLayout;
  const { UI, roundRectPath, drawPanel, drawMeter, drawChip } = NS.panels;
  const { beginHudPanel, endHudPanel } = NS.hudFading;
  const { DOME_X, DOME_Y } = NS.rules;
  const { MAX_DRONES_PER_KIND, droneCargoCap } = NS.drones;

  // Rotor blur and body of a drone sprite at screen position
  function drawDroneSprite(sprite, x, y, size, face, phase, alpha) {
    ctx.save();
    if (alpha !== undefined)
      ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    if (face < 0)
      ctx.scale(-1, 1);
    drawSprite(sprite, 0, 0, size);
    ctx.strokeStyle = 'rgba(210,235,255,0.6)';
    ctx.lineWidth = 2;
    const blur = size * (0.22 + Math.abs(Math.sin(phase * 4)) * 0.12);
    ctx.beginPath();
    for (const sx of [-0.36, 0.36]) {
      ctx.moveTo(size * sx - blur, -size * 0.47);
      ctx.lineTo(size * sx + blur, -size * 0.47);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawUndergroundDrones() {
    const ox = Math.round(G.cameraX), oy = Math.round(G.cameraY);
    for (const d of G.drones) {
      if (d.state === 'dock') continue;
      const x = d.x - ox, y = d.y - oy + Math.sin(d.phase) * 3;
      if (x < -60 || x > CANVAS_W + 60 || y < -60 || y > CANVAS_H + 60) continue;
      drawGlow('#9ad8ff', x, y, 70, 0.22);
      if (d.state === 'mine') {
        const tx = d.job.col * TILE_SIZE + TILE_SIZE / 2 - ox, ty = d.job.row * TILE_SIZE + TILE_SIZE / 2 - oy;
        const flick = 0.6 + Math.random() * 0.4;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255,90,200,${0.35 * flick})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(x, y + 6);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,220,250,${flick})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        drawGlow('#ff7ad8', tx, ty, 26, 0.7 * flick);
      }
      drawDroneSprite('drone', x, y, 28, d.face || 1, d.phase);
      const cap = droneCargoCap();
      if (d.cargo > 0)
        drawMeter(x - 16, y + 18, 32, 5, d.cargo / cap, '#d8b8ff', { track: 'rgba(0,0,0,0.7)' });
      if (Math.random() < 0.15)
        particles.trail(x - (d.face || 1) * 10, y + 4, { vx: -(d.face || 1) * 0.8, vy: 0.4, color: '#8ad0ff', life: 0.25, size: 1.2 });
    }
  }

  function drawSurfaceDrones() {
    // Couriers resting in the dome hover beside it
    let slot = 0;
    for (const d of G.drones) {
      if (d.state !== 'dock') continue;
      const x = DOME_X - 150 - (slot % 5) * 38, y = DOME_Y - 120 - Math.floor(slot / 5) * 36 + Math.sin(G.animTime * 2 + slot) * 6;
      drawGlow('#9ad8ff', x, y + 12, 18, 0.45);
      drawDroneSprite('drone', x, y, 26, 1, G.animTime * 3 + slot);
      ++slot;
    }
    for (const g of G.gunDrones) {
      if (g.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(120,240,255,${g.flash})`;
        ctx.lineWidth = 2 + g.flash * 2;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y + 4);
        ctx.lineTo(g.tx, g.ty);
        ctx.stroke();
        ctx.restore();
        drawGlow('#7af0ff', g.x, g.y + 4, 16, g.flash);
      }
      drawGlow('#ff8a6a', g.x, g.y + 10, 16, 0.35);
      drawDroneSprite('gundrone', g.x, g.y, 32, g.tx < g.x && g.flash > 0 ? -1 : 1, G.animTime * 3);
    }
    for (const r of G.repairBots) {
      if (r.beam > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const flick = 0.6 + Math.random() * 0.4;
        ctx.strokeStyle = `rgba(120,255,170,${0.8 * r.beam * flick})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + 10);
        ctx.lineTo(r.bx, r.by);
        ctx.stroke();
        ctx.restore();
        drawGlow('#fff6a0', r.bx, r.by, 22 * flick, r.beam);
      }
      drawDroneSprite('medic', r.x, r.y, 30, 1, G.animTime * 3);
    }
  }

  // Courier status text and colour
  function courierStatus(d) {
    if (d.state === 'dock') return ['In dome', UI.textDim];
    if (d.state === 'mine') return ['Lasering ore', '#ff9adf'];
    if (d.job && d.job.kind === 'home') return ['Flying home', '#d8b8ff'];
    if (d.job && d.job.kind === 'keeper') return ['Coming to you', UI.good];
    if (d.job && d.job.kind === 'mine') return ['Flying to ore', '#ff9adf'];
    return ['Collecting', '#ffd070'];
  }

  // The fleet grouped by kind: couriers (with one status cell per drone), gun and repair drones
  function drawDroneHUD(x, y, w) {
    if (!G.drones.length && !G.gunDrones.length && !G.repairBots.length) return y;
    const rowH = 28, cellRowH = 22;
    const h = 12 + (G.drones.length ? rowH + cellRowH : 0) + (G.gunDrones.length ? rowH : 0) + (G.repairBots.length ? rowH : 0);
    beginHudPanel('drones', x, y, w, h);
    drawPanel(x, y, w, h, { accent: '#c890ff', shadow: 10 });
    let ry = y + 6;
    const row = (sprite, label, n, status, color, chipText) => {
      const cy = ry + rowH / 2;
      drawSprite(sprite, x + 22, cy, 20);
      const chip = chipText ? drawChip(chipText, x + w - 10, cy - 11, 22, { align: 'right', px: 12, bg: 'rgba(200,144,255,0.16)', color: '#e8d8ff' }) : 0;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const nameW = fitText(`${label} x${n}`, x + 40, cy + 1, (w - 40 - chip - 18) * 0.62, 16, { weight: 'bold', color: UI.text });
      if (status)
        fitText(status, x + 40 + nameW + 8, cy + 1, w - 40 - chip - 26 - nameW, 14, { weight: 'bold', color });
      ry += rowH;
    };
    if (G.drones.length) {
      const cap = droneCargoCap();
      let load = 0, out = 0;
      for (const d of G.drones) {
        load += d.cargo;
        if (d.state !== 'dock') ++out;
      }
      // a single courier shows its status next to its cell instead
      row('drone', 'Couriers', G.drones.length, G.drones.length < 2 ? '' : (out ? `${out} out` : 'In dome'), out ? '#ffd070' : UI.textDim, `${load}/${cap * G.drones.length}`);
      // One cell per courier: status colour and how full its hold is
      const cw = Math.min(24, (w - 40 - 10) / MAX_DRONES_PER_KIND);
      G.drones.forEach((d, i) => {
        const cx = x + 40 + i * cw, cy = ry + 3;
        const color = courierStatus(d)[1];
        roundRectPath(cx, cy, cw - 4, 14, 4);
        ctx.fillStyle = hexToRgba(color.charAt(0) === '#' ? color : '#c8c8d8', 0.22);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.stroke();
        const k = Math.max(0, Math.min(1, d.cargo / cap));
        if (k > 0) {
          ctx.fillStyle = color;
          ctx.fillRect(cx + 2, cy + 14 - 2 - k * 10, cw - 8, k * 10);
        }
      });
      if (G.drones.length === 1) {
        const st = courierStatus(G.drones[0]);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText(st[0], x + 40 + cw + 6, ry + 10, w - 40 - cw - 16, 14, { weight: 'bold', color: st[1] });
      }
      ry += cellRowH;
    }
    if (G.gunDrones.length) {
      const firing = G.gunDrones.some(g => g.flash > 0);
      row('gundrone', 'Gun', G.gunDrones.length, firing ? 'Firing' : 'Guarding', firing ? '#7af0ff' : UI.textDim, '');
    }
    if (G.repairBots.length) {
      const welding = G.repairBots.some(r => r.beam > 0.5);
      row('medic', 'Repair', G.repairBots.length, welding ? 'Welding' : 'Standby', welding ? '#7affb0' : UI.textDim, `${Math.ceil(G.domeHP)}/${G.maxDomeHP}`);
    }
    endHudPanel();
    return y + h;
  }

  NS.droneArt = { drawUndergroundDrones, drawSurfaceDrones, drawDroneHUD };
})();
