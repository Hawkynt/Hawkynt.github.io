/* The maze layer, painted once per maze and theme into an offscreen canvas: the floor with its
   faint grid, rounded wall shapes built from the tile grid with a soft glow, a bright rim, a
   gradient fill and the world's texture (circuits, candy stripes, crystal facets, bark, magma,
   blueprint grid), the ghost-house gate and the static tile twists (arrow pads, taffy, ice,
   portal and vent bases). Also the cached dot and power pellet sprites. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const { COLS, ROWS, TILE, MAZE_W, MAZE_H, W_WALL, W_GATE } = C;
  const K = NS.artKit;

  const RES = 2;
  let current = { key: '', canvas: null };

  function invalidate() {
    current.key = '';
  }

  function isWall(m, x, y) {
    if (y < 0 || y >= ROWS) return true;
    if (x < 0 || x >= COLS) return m.tunnels.indexOf(y) < 0;
    return m.walls[y * COLS + x] === W_WALL;
  }

  /* white wall shapes: each wall tile shrinks away from open neighbours, convex corners rounded */
  function paintMask(g, m) {
    const ins = TILE * 0.3, r = TILE * 0.34;
    g.fillStyle = '#ffffff';
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x) {
        if (!isWall(m, x, y)) continue;
        const l = !isWall(m, x - 1, y), rt = !isWall(m, x + 1, y), u = !isWall(m, x, y - 1), d = !isWall(m, x, y + 1);
        const x0 = x * TILE + (l ? ins : 0), x1 = (x + 1) * TILE - (rt ? ins : 0);
        const y0 = y * TILE + (u ? ins : 0), y1 = (y + 1) * TILE - (d ? ins : 0);
        const rtl = l && u ? r : 0, rtr = rt && u ? r : 0, rbr = rt && d ? r : 0, rbl = l && d ? r : 0;
        g.beginPath();
        g.moveTo(x0 + rtl, y0);
        g.lineTo(x1 - rtr, y0);
        if (rtr) g.arcTo(x1, y0, x1, y0 + rtr, rtr); else g.lineTo(x1, y0);
        g.lineTo(x1, y1 - rbr);
        if (rbr) g.arcTo(x1, y1, x1 - rbr, y1, rbr); else g.lineTo(x1, y1);
        g.lineTo(x0 + rbl, y1);
        if (rbl) g.arcTo(x0, y1, x0, y1 - rbl, rbl); else g.lineTo(x0, y1);
        g.lineTo(x0, y0 + rtl);
        if (rtl) g.arcTo(x0, y0, x0 + rtl, y0, rtl); else g.lineTo(x0, y0);
        g.closePath();
        g.fill();
        /* fill concave corners so inner bends read as one solid block */
        if (!l && !u && !isWall(m, x - 1, y - 1)) g.fillRect(x * TILE, y * TILE, ins, ins);
      }
  }

  function layer(w, h) {
    const c = K.makeCanvas(w * RES, h * RES);
    const g = c.getContext('2d');
    g.scale(RES, RES);
    return { c: c, g: g };
  }

  /* a copy of the mask filled with a colour or gradient */
  function tinted(mask, style) {
    const t = layer(MAZE_W, MAZE_H);
    t.g.drawImage(mask, 0, 0, MAZE_W, MAZE_H);
    t.g.globalCompositeOperation = 'source-in';
    t.g.fillStyle = style;
    t.g.fillRect(0, 0, MAZE_W, MAZE_H);
    return t.c;
  }

  function texture(g, kind, th, rng) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    switch (kind) {
      case 'circuit':
        g.strokeStyle = K.rgba(th.rim, 0.35);
        g.lineWidth = 1;
        for (let i = 0; i < 160; ++i) {
          let x = Math.floor(rng() * MAZE_W / 4) * 4, y = Math.floor(rng() * MAZE_H / 4) * 4;
          g.beginPath();
          g.moveTo(x, y);
          for (let k = 0; k < 3; ++k) {
            if (rng() < 0.5) x += (rng() < 0.5 ? -1 : 1) * 12; else y += (rng() < 0.5 ? -1 : 1) * 12;
            g.lineTo(x, y);
          }
          g.stroke();
          g.fillStyle = K.rgba(th.glow, 0.5);
          g.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
        break;
      case 'stripes':
        g.strokeStyle = 'rgba(255,255,255,0.22)';
        g.lineWidth = 5;
        for (let x = -MAZE_H; x < MAZE_W; x += 16) {
          g.beginPath();
          g.moveTo(x, MAZE_H);
          g.lineTo(x + MAZE_H, 0);
          g.stroke();
        }
        break;
      case 'crystal':
        for (let i = 0; i < 220; ++i) {
          const x = rng() * MAZE_W, y = rng() * MAZE_H, s = 4 + rng() * 9;
          g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.16)' : K.rgba(th.rim, 0.18);
          g.beginPath();
          g.moveTo(x, y - s);
          g.lineTo(x + s * 0.6, y);
          g.lineTo(x, y + s);
          g.lineTo(x - s * 0.6, y);
          g.closePath();
          g.fill();
        }
        break;
      case 'bark':
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 1.2;
        for (let i = 0; i < 260; ++i) {
          const x = rng() * MAZE_W, y = rng() * MAZE_H;
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + (rng() - 0.5) * 6, y + 6, x + (rng() - 0.5) * 4, y + 12 + rng() * 8);
          g.stroke();
        }
        g.fillStyle = K.rgba(th.rim, 0.12);
        for (let i = 0; i < 80; ++i) g.fillRect(rng() * MAZE_W, rng() * MAZE_H, 2, 2);
        break;
      case 'magma':
        g.strokeStyle = K.rgba(th.glow, 0.55);
        g.lineWidth = 1.4;
        for (let i = 0; i < 120; ++i) {
          let x = rng() * MAZE_W, y = rng() * MAZE_H;
          g.beginPath();
          g.moveTo(x, y);
          for (let k = 0; k < 4; ++k) {
            x += (rng() - 0.5) * 14;
            y += (rng() - 0.5) * 14;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        break;
      case 'grid':
        g.strokeStyle = K.rgba(th.rim, 0.25);
        g.lineWidth = 0.8;
        for (let x = 0; x < MAZE_W; x += TILE / 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, MAZE_H); g.stroke(); }
        for (let y = 0; y < MAZE_H; y += TILE / 2) { g.beginPath(); g.moveTo(0, y); g.lineTo(MAZE_W, y); g.stroke(); }
        break;
    }
    /* top-lit sheen */
    const sh = g.createLinearGradient(0, 0, 0, MAZE_H);
    sh.addColorStop(0, 'rgba(255,255,255,0.08)');
    sh.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = sh;
    g.fillRect(0, 0, MAZE_W, MAZE_H);
    g.restore();
  }

  function paintFloor(g, m, th) {
    g.fillStyle = th.floor;
    g.fillRect(0, 0, MAZE_W, MAZE_H);
    g.strokeStyle = K.rgba(th.grid, 0.9);
    g.lineWidth = 1;
    for (let x = 0; x <= COLS; ++x) { g.beginPath(); g.moveTo(x * TILE, 0); g.lineTo(x * TILE, MAZE_H); g.stroke(); }
    for (let y = 0; y <= ROWS; ++y) { g.beginPath(); g.moveTo(0, y * TILE); g.lineTo(MAZE_W, y * TILE); g.stroke(); }
    const v = g.createRadialGradient(MAZE_W / 2, MAZE_H / 2, MAZE_H * 0.2, MAZE_W / 2, MAZE_H / 2, MAZE_H * 0.75);
    v.addColorStop(0, K.rgba(th.glow, 0.06));
    v.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = v;
    g.fillRect(0, 0, MAZE_W, MAZE_H);
  }

  function paintFeatures(g, m, th) {
    for (let i = 0; i < m.feat.length; ++i) {
      const f = m.feat[i];
      if (!f) continue;
      const x = (i % COLS) * TILE, y = Math.floor(i / COLS) * TILE;
      const cx = x + TILE / 2, cy = y + TILE / 2;
      if (f >= C.F_PAD_L && f <= C.F_PAD_D) {
        g.save();
        g.translate(cx, cy);
        g.rotate([Math.PI, -Math.PI / 2, 0, Math.PI / 2][f - C.F_PAD_L]);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        K.roundRect(g, -TILE / 2 + 1, -TILE / 2 + 1, TILE - 2, TILE - 2, 4);
        g.fill();
        for (let k = 0; k < 2; ++k) {
          g.strokeStyle = k ? '#ffffff' : th.accent;
          g.lineWidth = k ? 1.5 : 4;
          g.lineJoin = 'round';
          g.beginPath();
          g.moveTo(-6, -6); g.lineTo(0, 0); g.lineTo(-6, 6);
          g.moveTo(1, -6); g.lineTo(7, 0); g.lineTo(1, 6);
          g.stroke();
        }
        g.restore();
      } else if (f === C.F_TAFFY) {
        const gr = g.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, TILE * 0.62);
        gr.addColorStop(0, '#ffd0f0');
        gr.addColorStop(0.5, '#ff7ad0');
        gr.addColorStop(1, 'rgba(160,30,120,0.6)');
        g.fillStyle = gr;
        g.beginPath();
        for (let k = 0; k < 10; ++k) {
          const a = k / 10 * Math.PI * 2, rr = TILE * (0.48 + (k % 2) * 0.1);
          if (k === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath(); g.ellipse(cx - 3, cy - 4, 3, 1.6, -0.5, 0, Math.PI * 2); g.fill();
      } else if (f === C.F_ICE) {
        const gr = g.createLinearGradient(x, y, x + TILE, y + TILE);
        gr.addColorStop(0, 'rgba(200,250,255,0.55)');
        gr.addColorStop(0.5, 'rgba(120,200,255,0.3)');
        gr.addColorStop(1, 'rgba(220,250,255,0.5)');
        g.fillStyle = gr;
        g.fillRect(x, y + 2, TILE, TILE - 4);
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(x + 4, y + TILE - 6); g.lineTo(x + 10, y + 6); g.stroke();
      } else if (f === C.F_PORTAL) {
        g.fillStyle = 'rgba(40,10,80,0.8)';
        g.beginPath(); g.arc(cx, cy, TILE * 0.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#b98cff';
        g.lineWidth = 2;
        g.stroke();
      } else if (f === C.F_VENT) {
        g.fillStyle = '#1a0804';
        K.roundRect(g, x + 2, y + 2, TILE - 4, TILE - 4, 3);
        g.fill();
        g.strokeStyle = '#5a2010';
        g.lineWidth = 1.5;
        g.stroke();
        g.strokeStyle = '#3a1208';
        for (let k = 1; k < 4; ++k) { g.beginPath(); g.moveTo(x + 4, y + k * TILE / 4); g.lineTo(x + TILE - 4, y + k * TILE / 4); g.stroke(); }
      }
    }
  }

  function paintGate(g, m, th) {
    for (let x = 0; x < COLS; ++x)
      for (let y = 0; y < ROWS; ++y) {
        if (m.walls[y * COLS + x] !== W_GATE) continue;
        g.fillStyle = K.rgba('#ffb8ff', 0.25);
        g.fillRect(x * TILE, y * TILE + TILE * 0.3, TILE, TILE * 0.4);
        g.fillStyle = '#ffb8ff';
        g.fillRect(x * TILE, y * TILE + TILE * 0.42, TILE, TILE * 0.16);
      }
  }

  /* the painted maze for this maze and theme (cached until the maze changes) */
  function get(m, th, key) {
    const k = key + '|' + m.seed + '|' + m.feat.join('').length + '|' + th.wall + th.rim;
    if (current.key === k && current.canvas) return current.canvas;
    const out = layer(MAZE_W, MAZE_H);
    const g = out.g;
    paintFloor(g, m, th);
    paintFeatures(g, m, th);
    const mask = layer(MAZE_W, MAZE_H);
    paintMask(mask.g, m);
    /* glow */
    g.save();
    g.shadowColor = th.glow;
    g.shadowBlur = 14;
    g.globalAlpha = 0.85;
    g.drawImage(tinted(mask.c, th.glow), 0, 0, MAZE_W, MAZE_H);
    g.restore();
    /* rim: the mask grown by 2 px */
    const rim = tinted(mask.c, th.rim);
    for (let a = 0; a < 8; ++a) g.drawImage(rim, Math.cos(a * Math.PI / 4) * 2.2, Math.sin(a * Math.PI / 4) * 2.2, MAZE_W, MAZE_H);
    /* body */
    const gr = g.createLinearGradient(0, 0, 0, MAZE_H);
    gr.addColorStop(0, K.shade(th.wall, 0.12));
    gr.addColorStop(1, K.shade(th.wall, -0.25));
    const body = tinted(mask.c, gr);
    const bg = body.getContext('2d');
    bg.setTransform(RES, 0, 0, RES, 0, 0);
    texture(bg, th.tex, th, NS.rng.makeRng(NS.rng.hashString(String(m.seed) + th.tex)));
    g.drawImage(body, 0, 0, MAZE_W, MAZE_H);
    /* inner highlight on the top edges */
    g.save();
    g.globalAlpha = 0.35;
    g.globalCompositeOperation = 'lighter';
    const hl = tinted(mask.c, K.shade(th.rim, 0.3));
    g.drawImage(hl, 0, -1, MAZE_W, MAZE_H);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.drawImage(body, 0, 0.6, MAZE_W, MAZE_H);
    g.restore();
    paintGate(g, m, th);
    current = { key: k, canvas: out.c };
    return out.c;
  }

  function dot(color) {
    return K.sprite('dot:' + color, 12, 12, (g) => {
      const gr = g.createRadialGradient(6, 6, 0, 6, 6, 6);
      gr.addColorStop(0, K.rgba(color, 0.5));
      gr.addColorStop(1, K.rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 12, 12);
      g.fillStyle = color;
      g.beginPath(); g.arc(6, 6, 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(5.4, 5.4, 0.9, 0, Math.PI * 2); g.fill();
    });
  }

  function pellet(color) {
    return K.sprite('pellet:' + color, 24, 24, (g) => {
      const gr = g.createRadialGradient(9, 9, 1, 12, 12, 8);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.45, color);
      gr.addColorStop(1, K.shade(color, -0.4));
      g.fillStyle = gr;
      g.beginPath(); g.arc(12, 12, 7.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath(); g.ellipse(9.5, 9, 2.5, 1.6, -0.6, 0, Math.PI * 2); g.fill();
    });
  }

  Object.assign(NS.mazeArt, {
    get, invalidate, dot, pellet, isWall
  });
})();
