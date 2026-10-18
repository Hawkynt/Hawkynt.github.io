;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Backdrops for the Physics Puzzle's five worlds: a lamp-lit wood-panelled
   * workshop with a window and a pegboard of tools, a sunlit greenhouse with
   * hanging plants, a cryo lab with frosted pipes, monitors and glowing
   * tanks, a volcanic forge with lava falls and chains, and an orbit station
   * looking out on a ringed planet. The static picture is painted once for a
   * visible rect and device scale and cached; per frame only a handful of
   * cached glow sprites animate the lights. No shadow blur, no pixel reads.
   *
   *   const img = Scene.backdrop(world, v, scale);    // { c, x0, y0, w, h }
   *   Scene.drawBackdrop(ctx, world, v, scale);        // blits the cached picture
   *   Scene.drawLights(ctx, world, v, t);              // animated glows on top
   *
   * v = { x0, y0, x1, y1 } is the visible rect in 1280 x 720 view units and
   * may reach past every edge of the view in odd window shapes.
   */

  const VIEW_W = 1280;
  const FLOOR_Y = 600;
  const WORLD_COUNT = 5;
  const TWO_PI = Math.PI * 2;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function mulberry(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function parse(hex) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    const c = parse(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function shade(hex, f) {
    const c = parse(hex);
    const k = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
    return '#' + c.map(v => k(v).toString(16).padStart(2, '0')).join('');
  }

  function roundRect(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
  }

  function softGlow(g, x, y, r, color, a) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, rgba(color, a));
    rg.addColorStop(0.4, rgba(color, a * 0.4));
    rg.addColorStop(1, rgba(color, 0));
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function vignette(g, v, strength) {
    const cx = VIEW_W / 2, cy = 330;
    const r = Math.max(v.x1 - v.x0, v.y1 - v.y0) * 0.75;
    const rg = g.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    g.fillStyle = rg;
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  /* the floor under the field and out into the letterbox, so the ground never ends at an edge */
  function floorBand(g, v, top, colors) {
    const lg = g.createLinearGradient(0, FLOOR_Y, 0, Math.max(FLOOR_Y + 40, v.y1));
    lg.addColorStop(0, top);
    lg.addColorStop(0.15, colors[0]);
    lg.addColorStop(1, colors[1]);
    g.fillStyle = lg;
    g.fillRect(v.x0, FLOOR_Y, v.x1 - v.x0, Math.max(0, v.y1 - FLOOR_Y));
  }

  /* ══════════════════════════════════════════════════════════════════
     WORKSHOP
     ══════════════════════════════════════════════════════════════════ */

  function paintWorkshop(g, v, rand) {
    /* painted plaster above, dark wood wainscot below */
    const lg = g.createLinearGradient(0, v.y0, 0, FLOOR_Y);
    lg.addColorStop(0, '#26323a');
    lg.addColorStop(0.7, '#34424a');
    lg.addColorStop(1, '#2a343a');
    g.fillStyle = lg;
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, FLOOR_Y - v.y0);
    for (let k = 0; k < (v.x1 - v.x0) * 0.4; ++k) {
      g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
      g.fillRect(v.x0 + rand() * (v.x1 - v.x0), v.y0 + rand() * (430 - v.y0), 2 + rand() * 6, 2 + rand() * 4);
    }
    const x0 = Math.floor(v.x0 / 160) * 160;
    for (let x = x0; x < v.x1; x += 160) {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(x, v.y0, 2, 430 - v.y0);
      g.fillStyle = 'rgba(255,255,255,0.03)';
      g.fillRect(x + 2, v.y0, 2, 430 - v.y0);
    }
    /* wainscot boards */
    g.fillStyle = '#2a1a0e';
    g.fillRect(v.x0, 430, v.x1 - v.x0, FLOOR_Y - 430);
    for (let x = Math.floor(v.x0 / 120) * 120; x < v.x1; x += 120) {
      g.fillStyle = 'rgba(' + (70 + rand() * 20 | 0) + ',' + (42 + rand() * 12 | 0) + ',22,0.9)';
      g.fillRect(x + 10, 446, 100, FLOOR_Y - 462);
      g.fillStyle = 'rgba(255,220,170,0.08)';
      g.fillRect(x + 10, 446, 100, 2);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x + 10, FLOOR_Y - 18, 100, 2);
    }
    /* rail */
    g.fillStyle = '#4a2e18';
    g.fillRect(v.x0, 420, v.x1 - v.x0, 12);
    g.fillStyle = 'rgba(255,220,170,0.15)';
    g.fillRect(v.x0, 420, v.x1 - v.x0, 2);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(v.x0, 432, v.x1 - v.x0, 3);
    /* window with an evening sky */
    const wx = 170, wy = 70, ww = 250, wh = 220;
    const sky = g.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#2a3a6a');
    sky.addColorStop(0.55, '#e87a4a');
    sky.addColorStop(1, '#ffd08a');
    g.fillStyle = sky;
    g.fillRect(wx, wy, ww, wh);
    g.fillStyle = '#ffe8b0';
    g.beginPath();
    g.arc(wx + 170, wy + 160, 24, 0, TWO_PI);
    g.fill();
    g.fillStyle = '#3a2a4a';
    g.beginPath();
    g.moveTo(wx, wy + wh);
    for (let x = 0; x <= ww; x += 10)
      g.lineTo(wx + x, wy + wh - 30 - Math.sin(x * 0.04) * 14 - rand() * 6);
    g.lineTo(wx + ww, wy + wh);
    g.closePath();
    g.fill();
    g.fillStyle = '#5a3418';
    g.fillRect(wx - 10, wy - 10, ww + 20, 10);
    g.fillRect(wx - 10, wy + wh, ww + 20, 14);
    g.fillRect(wx - 10, wy, 10, wh);
    g.fillRect(wx + ww, wy, 10, wh);
    g.fillRect(wx + ww / 2 - 4, wy, 8, wh);
    g.fillRect(wx, wy + wh / 2 - 4, ww, 8);
    g.fillStyle = 'rgba(255,240,200,0.3)';
    g.fillRect(wx - 10, wy + wh, ww + 20, 2);
    /* light shaft from the window */
    g.save();
    g.globalCompositeOperation = 'lighter';
    const shaft = g.createLinearGradient(wx, wy, wx + 380, FLOOR_Y);
    shaft.addColorStop(0, 'rgba(255,170,90,0.18)');
    shaft.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = shaft;
    g.beginPath();
    g.moveTo(wx, wy + 10);
    g.lineTo(wx + ww, wy + 10);
    g.lineTo(wx + ww + 420, FLOOR_Y);
    g.lineTo(wx + 260, FLOOR_Y);
    g.closePath();
    g.fill();
    g.restore();
    /* pegboard with tools */
    const px = 640, py = 90, pw = 420, ph = 250;
    g.fillStyle = '#a8784a';
    g.fillRect(px, py, pw, ph);
    g.fillStyle = 'rgba(40,20,8,0.55)';
    for (let y = py + 12; y < py + ph; y += 18)
      for (let x = px + 12; x < px + pw; x += 18) {
        g.beginPath();
        g.arc(x, y, 2, 0, TWO_PI);
        g.fill();
      }
    g.strokeStyle = '#4a2a10';
    g.lineWidth = 4;
    g.strokeRect(px, py, pw, ph);
    const tool = (fn) => { g.save(); g.fillStyle = '#3a3e48'; g.strokeStyle = '#1a1c22'; g.lineWidth = 1.2; fn(); g.restore(); };
    tool(() => {
      /* hammer */
      g.fillStyle = '#8a5a2a';
      g.fillRect(px + 52, py + 40, 10, 120);
      g.fillStyle = '#5a5e68';
      g.fillRect(px + 30, py + 30, 54, 22);
      g.strokeRect(px + 30, py + 30, 54, 22);
    });
    tool(() => {
      /* wrench */
      g.fillStyle = '#9aa2b0';
      g.fillRect(px + 124, py + 50, 12, 140);
      g.beginPath();
      g.arc(px + 130, py + 46, 18, 0, TWO_PI);
      g.fill();
      g.fillStyle = '#a8784a';
      g.fillRect(px + 124, py + 24, 12, 22);
      g.fillStyle = '#9aa2b0';
      g.beginPath();
      g.arc(px + 130, py + 196, 12, 0, TWO_PI);
      g.fill();
    });
    tool(() => {
      /* saw */
      g.fillStyle = '#c8ccd4';
      g.beginPath();
      g.moveTo(px + 190, py + 60);
      g.lineTo(px + 330, py + 60);
      g.lineTo(px + 330, py + 100);
      g.lineTo(px + 190, py + 84);
      g.closePath();
      g.fill();
      g.fillStyle = '#8a3a1a';
      roundRect(g, px + 160, py + 52, 40, 40, 8);
      g.fill();
      g.fillStyle = '#a8784a';
      g.fillRect(px + 170, py + 62, 18, 18);
    });
    tool(() => {
      /* screwdrivers and pliers */
      for (let k = 0; k < 3; ++k) {
        g.fillStyle = ['#d83a2a', '#e8b83a', '#3a8ad8'][k];
        roundRect(g, px + 200 + k * 34, py + 130, 14, 40, 5);
        g.fill();
        g.fillStyle = '#c8ccd4';
        g.fillRect(px + 205 + k * 34, py + 170, 4, 50);
      }
      g.fillStyle = '#5a5e68';
      g.beginPath();
      g.moveTo(px + 340, py + 130);
      g.lineTo(px + 360, py + 230);
      g.lineTo(px + 350, py + 232);
      g.lineTo(px + 334, py + 150);
      g.lineTo(px + 318, py + 232);
      g.lineTo(px + 308, py + 230);
      g.closePath();
      g.fill();
    });
    /* pinned blueprint */
    g.save();
    g.translate(470, 120);
    g.rotate(-0.04);
    g.fillStyle = '#2a5a9a';
    g.fillRect(0, 0, 140, 110);
    g.strokeStyle = 'rgba(220,240,255,0.7)';
    g.lineWidth = 1;
    for (let k = 0; k < 8; ++k) {
      g.beginPath();
      g.moveTo(0, k * 14 + 6);
      g.lineTo(140, k * 14 + 6);
      g.stroke();
    }
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(20, 90);
    g.quadraticCurveTo(70, 10, 120, 60);
    g.stroke();
    g.beginPath();
    g.arc(120, 64, 8, 0, TWO_PI);
    g.stroke();
    g.fillStyle = '#d83a2a';
    g.beginPath();
    g.arc(70, 4, 4, 0, TWO_PI);
    g.fill();
    g.restore();
    /* hanging lamps (their glow animates in drawLights) */
    for (const lx of [560, 1180]) {
      g.strokeStyle = '#1a1008';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(lx, v.y0);
      g.lineTo(lx, 52);
      g.stroke();
      g.fillStyle = '#2a4a3a';
      g.beginPath();
      g.moveTo(lx - 30, 80);
      g.lineTo(lx - 10, 52);
      g.lineTo(lx + 10, 52);
      g.lineTo(lx + 30, 80);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(lx - 9, 54, 4, 22);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const cone = g.createLinearGradient(0, 80, 0, FLOOR_Y);
      cone.addColorStop(0, 'rgba(255,210,140,0.22)');
      cone.addColorStop(1, 'rgba(255,210,140,0)');
      g.fillStyle = cone;
      g.beginPath();
      g.moveTo(lx - 28, 80);
      g.lineTo(lx + 28, 80);
      g.lineTo(lx + 200, FLOOR_Y);
      g.lineTo(lx - 200, FLOOR_Y);
      g.closePath();
      g.fill();
      g.restore();
    }
    /* shelf in the bleed areas so a wide window still shows a workshop */
    for (const sx of [-260, 1360]) {
      g.fillStyle = '#6a4224';
      g.fillRect(sx, 300, 180, 12);
      for (let k = 0; k < 4; ++k) {
        g.fillStyle = ['#c8b080', '#7aa8c8', '#c87a5a', '#a8c87a'][k];
        roundRect(g, sx + 12 + k * 42, 252, 30, 48, 6);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(sx + 16 + k * 42, 258, 5, 36);
      }
    }
    floorBand(g, v, '#7a4a24', ['#4a2c14', '#1e1208']);
    vignette(g, v, 0.55);
  }

  /* ══════════════════════════════════════════════════════════════════
     GREENHOUSE
     ══════════════════════════════════════════════════════════════════ */

  function leafCluster(g, x, y, r, rand, colors) {
    for (let k = 0; k < 9; ++k) {
      const a = rand() * TWO_PI, d = rand() * r;
      g.fillStyle = colors[k % colors.length];
      g.beginPath();
      g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * 0.5, r * 0.25, a, 0, TWO_PI);
      g.fill();
    }
  }

  function paintGarden(g, v, rand) {
    const sky = g.createLinearGradient(0, v.y0, 0, FLOOR_Y);
    sky.addColorStop(0, '#5ab0f0');
    sky.addColorStop(0.7, '#bfe8ff');
    sky.addColorStop(1, '#e8f8e8');
    g.fillStyle = sky;
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, FLOOR_Y - v.y0);
    /* clouds */
    for (let k = 0; k < 7; ++k) {
      const cx = v.x0 + rand() * (v.x1 - v.x0), cy = 40 + rand() * 160;
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 5; ++i) {
        g.beginPath();
        g.ellipse(cx + i * 26 - 50, cy + Math.sin(i) * 6, 34, 18, 0, 0, TWO_PI);
        g.fill();
      }
    }
    /* far hills and trees beyond the glass */
    g.fillStyle = '#9ad08a';
    g.beginPath();
    g.moveTo(v.x0, FLOOR_Y);
    for (let x = v.x0; x <= v.x1; x += 20)
      g.lineTo(x, 430 - Math.sin(x * 0.006) * 50 - Math.sin(x * 0.017) * 18);
    g.lineTo(v.x1, FLOOR_Y);
    g.closePath();
    g.fill();
    for (let x = v.x0; x < v.x1; x += 60 + rand() * 60) {
      const h = 60 + rand() * 70, y = 440 - Math.sin(x * 0.006) * 50;
      g.fillStyle = '#6a9a5a';
      g.fillRect(x - 3, y - h * 0.4, 6, h * 0.4);
      leafCluster(g, x, y - h * 0.6, 34, rand, ['#5a9a4a', '#6aaa5a', '#7aba6a']);
    }
    g.fillStyle = 'rgba(232,248,232,0.35)';
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, FLOOR_Y - v.y0);
    /* glass panes and white frames */
    const fx0 = Math.floor(v.x0 / 160) * 160;
    for (let x = fx0; x <= v.x1; x += 160) {
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath();
      g.moveTo(x + 20, v.y0);
      g.lineTo(x + 60, v.y0);
      g.lineTo(x + 10, FLOOR_Y);
      g.lineTo(x - 30, FLOOR_Y);
      g.closePath();
      g.fill();
      g.fillStyle = '#f4f8f0';
      g.fillRect(x - 5, v.y0, 10, FLOOR_Y - v.y0);
      g.fillStyle = 'rgba(0,40,0,0.18)';
      g.fillRect(x + 3, v.y0, 2, FLOOR_Y - v.y0);
    }
    for (const y of [180, 380]) {
      g.fillStyle = '#f4f8f0';
      g.fillRect(v.x0, y - 4, v.x1 - v.x0, 8);
      g.fillStyle = 'rgba(0,40,0,0.18)';
      g.fillRect(v.x0, y + 2, v.x1 - v.x0, 2);
    }
    /* vines climbing the frames */
    for (let x = fx0; x <= v.x1; x += 640) {
      g.strokeStyle = 'rgba(58,122,42,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, FLOOR_Y);
      for (let y = FLOOR_Y; y > 120; y -= 20)
        g.lineTo(x + Math.sin(y * 0.05) * 10, y);
      g.stroke();
      for (let y = FLOOR_Y - 20; y > 140; y -= 26)
        leafCluster(g, x + Math.sin(y * 0.05) * 10, y, 10, rand, ['#4a9a3a', '#6ac04a']);
    }
    /* hanging baskets */
    for (const bx of [380, 700, 1020, -180, 1460]) {
      g.strokeStyle = 'rgba(60,40,20,0.8)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(bx, v.y0);
      g.lineTo(bx, 70);
      g.moveTo(bx, 70);
      g.lineTo(bx - 20, 96);
      g.moveTo(bx, 70);
      g.lineTo(bx + 20, 96);
      g.stroke();
      g.fillStyle = '#a0603a';
      g.beginPath();
      g.moveTo(bx - 24, 96);
      g.lineTo(bx + 24, 96);
      g.lineTo(bx + 16, 118);
      g.lineTo(bx - 16, 118);
      g.closePath();
      g.fill();
      leafCluster(g, bx, 94, 22, rand, ['#3a8a2a', '#5aaa3a', '#7aca5a']);
      for (let k = 0; k < 5; ++k) {
        g.strokeStyle = '#4a9a3a';
        g.lineWidth = 2;
        g.beginPath();
        const sx = bx - 16 + k * 8;
        g.moveTo(sx, 114);
        g.quadraticCurveTo(sx + 6, 150, sx - 4, 170 + k * 8);
        g.stroke();
      }
      g.fillStyle = ['#ff6a8a', '#ffd84a', '#ffffff'][Math.floor(rand() * 3)];
      for (let k = 0; k < 4; ++k) {
        g.beginPath();
        g.arc(bx - 14 + rand() * 28, 86 + rand() * 12, 3.5, 0, TWO_PI);
        g.fill();
      }
    }
    /* potting bench silhouettes along the back */
    g.fillStyle = 'rgba(70,50,30,0.45)';
    g.fillRect(v.x0, 520, v.x1 - v.x0, 10);
    for (let x = Math.floor(v.x0 / 140) * 140; x < v.x1; x += 140) {
      g.fillStyle = 'rgba(150,80,40,0.35)';
      g.beginPath();
      g.moveTo(x + 40, 520);
      g.lineTo(x + 80, 520);
      g.lineTo(x + 74, 490);
      g.lineTo(x + 46, 490);
      g.closePath();
      g.fill();
      leafCluster(g, x + 60, 478, 20, rand, ['rgba(60,130,50,0.45)', 'rgba(90,160,70,0.45)']);
    }
    /* sunbeams */
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; ++k) {
      const sx = 200 + k * 300;
      const lg = g.createLinearGradient(sx, 0, sx - 200, FLOOR_Y);
      lg.addColorStop(0, 'rgba(255,250,200,0.2)');
      lg.addColorStop(1, 'rgba(255,250,200,0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(sx, v.y0);
      g.lineTo(sx + 70, v.y0);
      g.lineTo(sx - 150, FLOOR_Y);
      g.lineTo(sx - 260, FLOOR_Y);
      g.closePath();
      g.fill();
    }
    g.restore();
    floorBand(g, v, '#5a3a20', ['#3a2414', '#140c06']);
    vignette(g, v, 0.35);
  }

  /* ══════════════════════════════════════════════════════════════════
     CRYO LAB
     ══════════════════════════════════════════════════════════════════ */

  function paintIceLab(g, v, rand) {
    const lg = g.createLinearGradient(0, v.y0, 0, FLOOR_Y);
    lg.addColorStop(0, '#1a2a3e');
    lg.addColorStop(1, '#2e4a62');
    g.fillStyle = lg;
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, FLOOR_Y - v.y0);
    /* wall panels */
    const tx0 = Math.floor(v.x0 / 120) * 120;
    for (let x = tx0; x < v.x1; x += 120) {
      for (let y = Math.floor(v.y0 / 100) * 100; y < FLOOR_Y; y += 100) {
        g.fillStyle = 'rgba(' + (60 + rand() * 20 | 0) + ',' + (90 + rand() * 20 | 0) + ',120,0.25)';
        g.fillRect(x + 3, y + 3, 114, 94);
        g.strokeStyle = 'rgba(160,210,240,0.12)';
        g.lineWidth = 1;
        g.strokeRect(x + 3.5, y + 3.5, 113, 93);
      }
    }
    /* observation window onto a blizzard */
    const wx = 420, wy = 80, ww = 440, wh = 200;
    const out = g.createLinearGradient(0, wy, 0, wy + wh);
    out.addColorStop(0, '#0a1430');
    out.addColorStop(1, '#3a5a8a');
    g.fillStyle = out;
    roundRect(g, wx, wy, ww, wh, 26);
    g.fill();
    g.fillStyle = '#c8e0f0';
    g.beginPath();
    g.moveTo(wx, wy + wh);
    for (let x = 0; x <= ww; x += 14)
      g.lineTo(wx + x, wy + wh - 40 - Math.abs(Math.sin(x * 0.02)) * 50);
    g.lineTo(wx + ww, wy + wh);
    g.closePath();
    g.fill();
    g.save();
    roundRect(g, wx, wy, ww, wh, 26);
    g.clip();
    for (let k = 0; k < 140; ++k) {
      g.fillStyle = 'rgba(255,255,255,' + (0.3 + rand() * 0.6) + ')';
      g.fillRect(wx + rand() * ww, wy + rand() * wh, 1.5 + rand() * 2, 1.5 + rand() * 2);
    }
    g.fillStyle = 'rgba(200,240,255,0.12)';
    g.beginPath();
    g.moveTo(wx + 40, wy);
    g.lineTo(wx + 120, wy);
    g.lineTo(wx + 40, wy + wh);
    g.lineTo(wx - 40, wy + wh);
    g.closePath();
    g.fill();
    g.restore();
    g.lineWidth = 12;
    g.strokeStyle = '#8aa8c0';
    roundRect(g, wx, wy, ww, wh, 26);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = '#e8f6ff';
    roundRect(g, wx - 5, wy - 5, ww + 10, wh + 10, 30);
    g.stroke();
    /* pipes with frost */
    for (const py of [44, 340]) {
      /* the lower pipe runs far back: dim and frost-free so it never reads as a shelf */
      const far = py > 100;
      g.save();
      if (far)
        g.globalAlpha = 0.3;
      const pg = g.createLinearGradient(0, py - 10, 0, py + 10);
      pg.addColorStop(0, '#e8f4ff');
      pg.addColorStop(0.4, '#8aa8c0');
      pg.addColorStop(1, '#2a4258');
      g.fillStyle = pg;
      g.fillRect(v.x0, py - 10, v.x1 - v.x0, 20);
      for (let x = Math.floor(v.x0 / 200) * 200; x < v.x1; x += 200) {
        g.fillStyle = '#5a7a92';
        g.fillRect(x, py - 13, 14, 26);
      }
      if (far) {
        g.restore();
        continue;
      }
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let x = v.x0; x < v.x1; x += 5)
        g.fillRect(x, py - 11, 5, 2 + rand() * 3);
      for (let x = v.x0 + rand() * 60; x < v.x1; x += 30 + rand() * 60) {
        const len = 6 + rand() * 18;
        g.fillStyle = 'rgba(220,245,255,0.8)';
        g.beginPath();
        g.moveTo(x, py + 9);
        g.lineTo(x + 4, py + 9);
        g.lineTo(x + 2, py + 9 + len);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
    /* cryo tanks */
    for (const cx of [140, 1140, -200, 1480]) {
      const tg = g.createLinearGradient(cx - 46, 0, cx + 46, 0);
      tg.addColorStop(0, '#1a3a5a');
      tg.addColorStop(0.3, '#4ad0ff');
      tg.addColorStop(0.5, '#a8f0ff');
      tg.addColorStop(1, '#0a2a48');
      g.fillStyle = tg;
      roundRect(g, cx - 46, 380, 92, 210, 30);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(cx - 30, 396, 8, 180);
      g.fillStyle = '#5a7a92';
      g.fillRect(cx - 52, 372, 104, 18);
      g.fillRect(cx - 52, 580, 104, 20);
      for (let k = 0; k < 10; ++k) {
        g.strokeStyle = 'rgba(255,255,255,0.6)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx - 20 + rand() * 40, 410 + rand() * 160, 2 + rand() * 4, 0, TWO_PI);
        g.stroke();
      }
    }
    /* monitors */
    for (const mx of [950, 290]) {
      g.fillStyle = '#0a1420';
      roundRect(g, mx, 150, 120, 80, 6);
      g.fill();
      g.strokeStyle = '#6a8aa2';
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = '#4ae8ff';
      g.lineWidth = 1.6;
      g.beginPath();
      for (let x = 0; x < 104; x += 4)
        g.lineTo(mx + 8 + x, 200 - Math.abs(Math.sin(x * 0.15)) * 30 - rand() * 6);
      g.stroke();
      g.fillStyle = 'rgba(74,232,255,0.6)';
      g.fillRect(mx + 8, 160, 40, 4);
    }
    /* frost creeping up the wall */
    const fr = g.createLinearGradient(0, FLOOR_Y - 90, 0, FLOOR_Y);
    fr.addColorStop(0, 'rgba(220,245,255,0)');
    fr.addColorStop(1, 'rgba(220,245,255,0.25)');
    g.fillStyle = fr;
    g.fillRect(v.x0, FLOOR_Y - 90, v.x1 - v.x0, 90);
    floorBand(g, v, '#9ab8d0', ['#3a5468', '#0e1a26']);
    vignette(g, v, 0.5);
  }

  /* ══════════════════════════════════════════════════════════════════
     VOLCANO FORGE
     ══════════════════════════════════════════════════════════════════ */

  function paintForge(g, v, rand) {
    const lg = g.createLinearGradient(0, v.y0, 0, FLOOR_Y);
    lg.addColorStop(0, '#0e0808');
    lg.addColorStop(0.7, '#2a1410');
    lg.addColorStop(1, '#4a1c0e');
    g.fillStyle = lg;
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, FLOOR_Y - v.y0);
    /* rock faces */
    for (let k = 0; k < 40; ++k) {
      const x = v.x0 + rand() * (v.x1 - v.x0), y = v.y0 + rand() * (FLOOR_Y - v.y0);
      const r = 30 + rand() * 80;
      g.fillStyle = 'rgba(' + (40 + rand() * 30 | 0) + ',' + (26 + rand() * 14 | 0) + ',' + (22 + rand() * 10 | 0) + ',0.6)';
      g.beginPath();
      for (let i = 0; i < 7; ++i) {
        const a = i / 7 * TWO_PI, rr = r * (0.6 + rand() * 0.4);
        if (i === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6);
        else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(255,120,60,0.08)';
      g.lineWidth = 1;
      g.stroke();
    }
    /* lava falls in the distance */
    for (const fx of [330, 980, -160, 1460]) {
      softGlow(g, fx, 330, 220, '#ff6a1a', 0.35);
      const fg = g.createLinearGradient(fx - 20, 0, fx + 20, 0);
      fg.addColorStop(0, 'rgba(255,90,20,0)');
      fg.addColorStop(0.3, '#ff7a2a');
      fg.addColorStop(0.5, '#ffd06a');
      fg.addColorStop(0.7, '#ff7a2a');
      fg.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = fg;
      g.fillRect(fx - 22, v.y0, 44, FLOOR_Y - v.y0 - 40);
      g.fillStyle = '#ffb04a';
      g.beginPath();
      g.ellipse(fx, FLOOR_Y - 40, 70, 14, 0, 0, TWO_PI);
      g.fill();
    }
    /* iron beams and chains */
    g.fillStyle = '#1a1214';
    g.fillRect(v.x0, 30, v.x1 - v.x0, 22);
    g.fillStyle = 'rgba(255,140,80,0.2)';
    g.fillRect(v.x0, 50, v.x1 - v.x0, 2);
    for (let x = Math.floor(v.x0 / 90) * 90; x < v.x1; x += 90) {
      g.fillStyle = '#3a2a26';
      g.beginPath();
      g.arc(x + 20, 41, 3, 0, TWO_PI);
      g.fill();
    }
    for (const cx of [150, 560, 760, 1130, -60, 1380]) {
      const len = 120 + rand() * 180;
      g.strokeStyle = '#2a2224';
      g.lineWidth = 3;
      for (let y = 52; y < 52 + len; y += 12) {
        g.beginPath();
        g.ellipse(cx, y + 6, 4, 6, 0, 0, TWO_PI);
        g.stroke();
      }
      g.fillStyle = '#3a2e2a';
      g.beginPath();
      g.moveTo(cx - 10, 52 + len);
      g.lineTo(cx + 10, 52 + len);
      g.lineTo(cx, 70 + len);
      g.closePath();
      g.fill();
    }
    /* forge glow pooling in the distance */
    softGlow(g, 860, 520, 160, '#ff8a2a', 0.22);
    /* heat from below */
    const heat = g.createLinearGradient(0, FLOOR_Y - 200, 0, FLOOR_Y);
    heat.addColorStop(0, 'rgba(255,90,20,0)');
    heat.addColorStop(1, 'rgba(255,90,20,0.28)');
    g.fillStyle = heat;
    g.fillRect(v.x0, FLOOR_Y - 200, v.x1 - v.x0, 200);
    floorBand(g, v, '#5a2a18', ['#2a1410', '#0a0404']);
    vignette(g, v, 0.6);
  }

  /* ══════════════════════════════════════════════════════════════════
     ORBIT STATION
     ══════════════════════════════════════════════════════════════════ */

  function paintSpace(g, v, rand) {
    /* space beyond the window */
    g.fillStyle = '#04040e';
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, FLOOR_Y - v.y0);
    const neb = g.createRadialGradient(400, 200, 0, 400, 200, 500);
    neb.addColorStop(0, 'rgba(160,60,200,0.45)');
    neb.addColorStop(0.5, 'rgba(60,40,160,0.25)');
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = neb;
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, FLOOR_Y - v.y0);
    const neb2 = g.createRadialGradient(1100, 120, 0, 1100, 120, 380);
    neb2.addColorStop(0, 'rgba(40,160,220,0.3)');
    neb2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = neb2;
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, FLOOR_Y - v.y0);
    for (let k = 0; k < (v.x1 - v.x0) * (FLOOR_Y - v.y0) / 2600; ++k) {
      const s = rand();
      g.fillStyle = 'rgba(255,255,255,' + (0.3 + s * 0.7) + ')';
      g.fillRect(v.x0 + rand() * (v.x1 - v.x0), v.y0 + rand() * (FLOOR_Y - v.y0), s > 0.95 ? 2.4 : 1.2, s > 0.95 ? 2.4 : 1.2);
    }
    /* a ringed planet: the ring's far half behind it, the near half in front */
    const px = 980, py = 230, pr = 120;
    const ring = (front) => {
      g.save();
      g.translate(px, py);
      g.rotate(-0.25);
      g.scale(1, 0.2);
      for (let k = 0; k < 5; ++k) {
        g.strokeStyle = 'rgba(' + [230, 214, 200, 240, 190][k] + ',' + [210, 190, 170, 220, 160][k] + ',' + [180, 160, 140, 200, 130][k] + ',' + [0.55, 0.35, 0.6, 0.3, 0.45][k] + ')';
        g.lineWidth = [10, 6, 14, 4, 8][k];
        g.beginPath();
        g.arc(0, 0, pr * (1.45 + k * 0.1), front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        g.stroke();
      }
      g.restore();
    };
    softGlow(g, px, py, pr * 1.7, '#6ab8ff', 0.35);
    ring(false);
    const pg = g.createRadialGradient(px - 40, py - 50, 10, px, py, pr);
    pg.addColorStop(0, '#f0d8a8');
    pg.addColorStop(0.5, '#c87a4a');
    pg.addColorStop(1, '#3a1a2a');
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, TWO_PI);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(px, py, pr, 0, TWO_PI);
    g.clip();
    for (let k = 0; k < 7; ++k) {
      g.fillStyle = 'rgba(' + (120 + rand() * 80 | 0) + ',' + (60 + rand() * 40 | 0) + ',40,0.3)';
      g.fillRect(px - pr, py - pr + k * 34 + rand() * 10, pr * 2, 10 + rand() * 12);
    }
    g.fillStyle = 'rgba(0,0,20,0.45)';
    g.beginPath();
    g.arc(px + 50, py + 40, pr, 0, TWO_PI);
    g.fill();
    g.restore();
    ring(true);
    /* a small moon */
    const mg = g.createRadialGradient(300, 140, 2, 310, 150, 34);
    mg.addColorStop(0, '#ffffff');
    mg.addColorStop(1, '#5a6a8a');
    g.fillStyle = mg;
    g.beginPath();
    g.arc(310, 150, 30, 0, TWO_PI);
    g.fill();
    /* station structure: window frame ribs */
    g.save();
    g.globalAlpha = 0.5;
    for (let x = Math.floor(v.x0 / 320) * 320; x <= v.x1; x += 320) {
      const rg = g.createLinearGradient(x - 16, 0, x + 16, 0);
      rg.addColorStop(0, '#2a3040');
      rg.addColorStop(0.4, '#8a94a8');
      rg.addColorStop(1, '#1a1e2a');
      g.fillStyle = rg;
      g.fillRect(x - 16, v.y0, 32, FLOOR_Y - v.y0);
      g.fillStyle = '#ff5a5a';
      g.fillRect(x - 3, 90, 6, 6);
    }
    g.restore();
    g.fillStyle = '#2a3040';
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, Math.max(0, 26 - v.y0));
    /* consoles along the bottom */
    const cg = g.createLinearGradient(0, 470, 0, FLOOR_Y);
    cg.addColorStop(0, '#3a4256');
    cg.addColorStop(1, '#141822');
    g.fillStyle = cg;
    g.beginPath();
    g.moveTo(v.x0, FLOOR_Y);
    g.lineTo(v.x0, 500);
    for (let x = Math.floor(v.x0 / 260) * 260; x < v.x1; x += 260) {
      g.lineTo(x + 20, 500);
      g.lineTo(x + 40, 480);
      g.lineTo(x + 220, 480);
      g.lineTo(x + 240, 500);
    }
    g.lineTo(v.x1, 500);
    g.lineTo(v.x1, FLOOR_Y);
    g.closePath();
    g.fill();
    for (let x = Math.floor(v.x0 / 260) * 260; x < v.x1; x += 260) {
      for (let k = 0; k < 8; ++k) {
        g.fillStyle = ['#4ae8ff', '#6aff8a', '#ffcf3a', '#ff6a6a'][(k + (x / 260 | 0)) % 4];
        g.fillRect(x + 56 + k * 18, 494, 8, 4);
      }
      g.fillStyle = 'rgba(74,232,255,0.25)';
      g.fillRect(x + 56, 506, 140, 30);
    }
    floorBand(g, v, '#8a94a8', ['#2a3040', '#0a0c14']);
    vignette(g, v, 0.45);
  }

  const PAINTERS = [paintWorkshop, paintGarden, paintIceLab, paintForge, paintSpace];

  /* ══════════════════════════════════════════════════════════════════
     CACHE AND DRAW
     ══════════════════════════════════════════════════════════════════ */

  const cache = new Map();

  function keyOf(world, v, s) {
    return world + ':' + Math.round(v.x0) + ':' + Math.round(v.y0) + ':' + Math.round(v.x1) + ':' + Math.round(v.y1) + ':' + s.toFixed(2);
  }

  /* the static picture for world over rect v at s device px per unit */
  function backdrop(world, v, s) {
    world = Math.max(0, Math.min(WORLD_COUNT - 1, world | 0));
    const k = keyOf(world, v, s);
    let img = cache.get(k);
    if (img)
      return img;
    if (cache.size > 6)
      cache.clear();
    const w = v.x1 - v.x0, h = v.y1 - v.y0;
    const c = makeCanvas(w * s, h * s);
    const g = c.getContext('2d');
    g.scale(s, s);
    g.translate(-v.x0, -v.y0);
    PAINTERS[world](g, v, mulberry(0xa11ce + world * 7919));
    img = { c: c, x0: v.x0, y0: v.y0, w: w, h: h };
    cache.set(k, img);
    return img;
  }

  function drawBackdrop(ctx, world, v, s) {
    const img = backdrop(world, v, s);
    ctx.drawImage(img.c, img.x0, img.y0, img.w, img.h);
  }

  const glowCache = {};
  function glow(color) {
    let c = glowCache[color];
    if (!c) {
      c = makeCanvas(128, 128);
      const g = c.getContext('2d');
      const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, rgba(color, 0.8));
      rg.addColorStop(0.35, rgba(color, 0.3));
      rg.addColorStop(1, rgba(color, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, 128, 128);
      glowCache[color] = c;
    }
    return c;
  }

  /* [x, y, size, color, pulse speed, depth] per world */
  const LIGHTS = [
    [[560, 76, 260, '#ffd08a', 2.1, 0.12], [1180, 76, 260, '#ffd08a', 1.7, 0.12], [300, 200, 360, '#ff9a5a', 0.4, 0.08]],
    [[300, 60, 420, '#fff6c0', 0.5, 0.1], [900, 60, 420, '#fff6c0', 0.6, 0.1]],
    [[140, 470, 240, '#4ad0ff', 1.3, 0.2], [1140, 470, 240, '#4ad0ff', 1.1, 0.2], [1010, 190, 160, '#4ae8ff', 6, 0.25], [350, 190, 160, '#4ae8ff', 5, 0.25]],
    [[330, 400, 420, '#ff6a1a', 1.2, 0.2], [980, 400, 420, '#ff6a1a', 0.9, 0.2], [860, 500, 200, '#ffa04a', 2.4, 0.25]],
    [[980, 230, 380, '#6ab8ff', 0.3, 0.08], [400, 200, 320, '#c060ff', 0.5, 0.1]]
  ];

  function drawLights(ctx, world, v, t) {
    const list = LIGHTS[(world | 0) % WORLD_COUNT];
    const prev = ctx.globalCompositeOperation, pa = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    for (const L of list) {
      const a = 0.35 + L[5] * Math.sin(t * L[4] + L[0] * 0.01) + (world === 0 && L[4] > 1 ? 0.05 * Math.sin(t * 23 + L[0]) : 0);
      ctx.globalAlpha = pa * Math.max(0, a);
      ctx.drawImage(glow(L[3]), L[0] - L[2] / 2, L[1] - L[2] / 2, L[2], L[2]);
    }
    if (world === 4) {
      /* twinkling stars */
      for (let k = 0; k < 10; ++k) {
        const x = (k * 397 + 120) % VIEW_W, y = (k * 211 + 60) % 420;
        ctx.globalAlpha = pa * Math.max(0, Math.sin(t * (1.3 + k * 0.17) + k * 2)) * 0.9;
        ctx.drawImage(glow('#ffffff'), x - 7, y - 7, 14, 14);
      }
    }
    ctx.globalAlpha = pa;
    ctx.globalCompositeOperation = prev;
  }

  SZ.PhysicsPuzzleScene = Object.freeze({
    WORLD_COUNT: WORLD_COUNT, FLOOR_Y: FLOOR_Y,
    backdrop: backdrop, drawBackdrop: drawBackdrop, drawLights: drawLights,
    get cacheSize() { return cache.size; }
  });
})();
