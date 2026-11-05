/* The home station, painted in parts and assembled per frame: the hub with its lit windows,
   the slowly turning habitat ring, spokes, and one arm per station module whose art grows with
   its level (refinery stacks, drone hangars, scanner dishes, cargo stacks, fuel spheres), plus
   blinking beacons and furnace glow. Drawn on the station screen, title and cinematics. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const K = NS.artKit;
  const TAU = Math.PI * 2;

  /* module arm directions (radians, 0 = right) */
  const SLOTS = { scanner: -Math.PI / 2, tradeHub: -Math.PI * 0.9, refinery: Math.PI * 0.82, depot: Math.PI / 2 + 0.1, droneBay: 0.15 };

  function metal(g, x0, y0, x1, y1, base) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, K.shade(base, 0.45));
    gr.addColorStop(0.5, base);
    gr.addColorStop(1, K.shade(base, -0.6));
    return gr;
  }

  function hub() {
    return K.sprite('st:hub', 180, 180, (g, w) => {
      const c = w / 2;
      g.fillStyle = metal(g, c - 70, c - 70, c + 70, c + 70, '#8a92a0');
      g.beginPath();
      g.arc(c, c, 70, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 2;
      g.stroke();
      for (let k = 0; k < 3; ++k) {
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(c, c, 26 + k * 15, 0, TAU);
        g.stroke();
      }
      for (let i = 0; i < 16; ++i) {
        const a = i * TAU / 16;
        g.save();
        g.translate(c + Math.cos(a) * 56, c + Math.sin(a) * 56);
        g.rotate(a);
        g.fillStyle = i % 3 ? '#ffd890' : '#8ad8ff';
        g.fillRect(-2, -4, 4, 8);
        g.restore();
      }
      const top = g.createRadialGradient(c - 12, c - 14, 2, c, c, 30);
      top.addColorStop(0, '#f0f4ff');
      top.addColorStop(0.5, '#7a8494');
      top.addColorStop(1, '#2a303c');
      g.fillStyle = top;
      g.beginPath();
      g.arc(c, c, 26, 0, TAU);
      g.fill();
      g.fillStyle = '#ffb44a';
      g.beginPath();
      g.arc(c, c, 6, 0, TAU);
      g.fill();
    });
  }

  function ring() {
    return K.sprite('st:ring', 460, 460, (g, w) => {
      const c = w / 2;
      for (let i = 0; i < 4; ++i) {
        const a = i * TAU / 4;
        g.save();
        g.translate(c, c);
        g.rotate(a);
        g.fillStyle = metal(g, 0, -6, 0, 6, '#5a6270');
        g.fillRect(60, -6, 140, 12);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.strokeRect(60, -6, 140, 12);
        g.restore();
      }
      g.lineWidth = 34;
      g.strokeStyle = '#151820';
      g.beginPath();
      g.arc(c, c, 206, 0, TAU);
      g.stroke();
      const rg = g.createLinearGradient(c - 220, c - 220, c + 220, c + 220);
      rg.addColorStop(0, '#d8dce6');
      rg.addColorStop(0.45, '#7a8290');
      rg.addColorStop(1, '#222630');
      g.lineWidth = 28;
      g.strokeStyle = rg;
      g.beginPath();
      g.arc(c, c, 206, 0, TAU);
      g.stroke();
      /* window rows */
      for (let i = 0; i < 96; ++i) {
        const a = i * TAU / 96;
        if (i % 12 === 0) continue;
        g.fillStyle = (i * 7) % 5 === 0 ? 'rgba(140,220,255,0.9)' : 'rgba(255,214,140,0.85)';
        g.save();
        g.translate(c + Math.cos(a) * 206, c + Math.sin(a) * 206);
        g.rotate(a);
        g.fillRect(-2, -5, 3, 3);
        g.fillRect(-2, 2, 3, 3);
        g.restore();
      }
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 12; ++i) {
        const a = i * TAU / 12;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * 192, c + Math.sin(a) * 192);
        g.lineTo(c + Math.cos(a) * 220, c + Math.sin(a) * 220);
        g.stroke();
      }
    });
  }

  /* one module at a level, facing +x, its base at x = 0 */
  function module(id, lvl) {
    return K.sprite('st:mod:' + id + ':' + lvl, 140, 110, (g, w, h) => {
      const cy = h / 2;
      /* the arm */
      g.fillStyle = metal(g, 0, cy - 7, 0, cy + 7, '#5a6270');
      g.fillRect(0, cy - 6, 40, 12);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.strokeRect(0, cy - 6, 40, 12);
      if (lvl <= 0) {
        /* empty scaffold awaiting construction */
        g.strokeStyle = 'rgba(160,170,190,0.55)';
        g.lineWidth = 1.5;
        g.strokeRect(40, cy - 22, 40, 44);
        g.beginPath();
        g.moveTo(40, cy - 22); g.lineTo(80, cy + 22);
        g.moveTo(40, cy + 22); g.lineTo(80, cy - 22);
        g.stroke();
        g.fillStyle = '#ffb44a';
        g.fillRect(78, cy - 24, 4, 4);
        return;
      }
      const box = (x, y, bw, bh, col) => {
        g.fillStyle = metal(g, x, y, x + bw * 0.4, y + bh, col);
        g.fillRect(x, y, bw, bh);
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 1;
        g.strokeRect(x, y, bw, bh);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x + 1, y + 1, bw - 2, 2);
      };
      const sphere = (x, y, r, col) => {
        const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.3, col);
        gr.addColorStop(1, K.shade(col, -0.7));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.stroke();
      };
      if (id === 'refinery') {
        box(38, cy - 26, 46, 52, '#7a6a5a');
        for (let i = 0; i < lvl; ++i) {
          box(86, cy - 30 + i * 22, 24 + i * 4, 16, '#9a8a70');
          g.fillStyle = '#ff7a2a';
          g.fillRect(88, cy - 25 + i * 22, 18 + i * 4, 3);
        }
        g.fillStyle = '#ffb060';
        for (let i = 0; i < 4; ++i) g.fillRect(44 + i * 10, cy + 14, 6, 4);
      } else if (id === 'droneBay') {
        box(38, cy - 30, 58 + lvl * 10, 60, '#5a6a7a');
        for (let i = 0; i < lvl; ++i) {
          g.fillStyle = '#1a2028';
          g.fillRect(46 + i * 22, cy - 22, 16, 44);
          g.fillStyle = '#5cff9a';
          g.fillRect(46 + i * 22, cy - 22, 16, 2);
          g.fillRect(46 + i * 22, cy + 20, 16, 2);
        }
      } else if (id === 'scanner') {
        box(38, cy - 6, 30 + lvl * 8, 12, '#6a7280');
        for (let i = 0; i < lvl; ++i) {
          const x = 70 + i * 22, y = cy + (i % 2 ? 16 : -16);
          g.fillStyle = metal(g, x - 14, y - 14, x + 14, y + 14, '#c8ccd8');
          g.beginPath();
          g.ellipse(x, y, 9, 16, 0, -Math.PI / 2, Math.PI / 2);
          g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.5)';
          g.stroke();
          g.fillStyle = '#4fd8ff';
          g.fillRect(x + 6, y - 1, 6, 2);
        }
      } else if (id === 'tradeHub') {
        const cols = ['#c8302a', '#2a7ac8', '#e8b030', '#3aa860'];
        for (let i = 0; i < 2 + lvl * 2; ++i) box(38 + Math.floor(i / 2) * 22, cy - 22 + (i % 2) * 22, 20, 20, cols[i % 4]);
      } else if (id === 'depot') {
        box(38, cy - 8, 20, 16, '#6a7280');
        for (let i = 0; i < lvl + 1; ++i) sphere(66 + i * 22, cy + (i % 2 ? 12 : -12), 12 + lvl, '#d8a040');
      }
    });
  }

  /* The assembled station at (x, y): about 680 px across at scale 1; modules = save.modules */
  function draw(ctx, x, y, scale, modules, t) {
    const ids = Object.keys(SLOTS);
    for (let i = 0; i < ids.length; ++i) {
      const a = SLOTS[ids[i]];
      const m = module(ids[i], modules ? modules[ids[i]] || 0 : 0);
      const ox = Math.cos(a) * 196 * scale, oy = Math.sin(a) * 196 * scale;
      ctx.translate(x + ox, y + oy);
      ctx.rotate(a);
      ctx.drawImage(m.canvas, 0, -m.h / 2 * scale, m.w * scale, m.h * scale);
      ctx.rotate(-a);
      ctx.translate(-x - ox, -y - oy);
    }
    const rg = ring();
    K.blitRot(ctx, rg, x, y, t * 0.05, scale);
    K.blit(ctx, hub(), x, y, scale);
    /* beacons and furnace glow */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; ++i) {
      const a = t * 0.05 + i * TAU / 4 + TAU / 8;
      const on = Math.sin(t * 3 + i * 1.7) > 0.6;
      if (!on) continue;
      K.blit(ctx, K.glow(i % 2 ? '#ff4a4a' : '#4aff8a'), x + Math.cos(a) * 222 * scale, y + Math.sin(a) * 222 * scale, 0.35 * scale + 0.15);
    }
    if (modules && modules.refinery) {
      const a = SLOTS.refinery;
      ctx.globalAlpha = 0.5 + Math.sin(t * 2.3) * 0.2;
      K.blit(ctx, K.glow('#ff7a2a'), x + Math.cos(a) * 290 * scale, y + Math.sin(a) * 290 * scale, 1.4 * scale);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 0.5 + Math.sin(t * 1.4) * 0.15;
    K.blit(ctx, K.glow('#ffb44a'), x, y, 0.9 * scale);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  Object.assign(NS.stationArt, {
    SLOTS, hub, ring, module, draw
  });
})();
