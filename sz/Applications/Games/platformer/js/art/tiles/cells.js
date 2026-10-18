;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.tileKit || (NS.tileKit = {});
  const { TS, TWO_PI, SOLID, LIQUID, ICE, FAKE, rgba, mix, cellRand } = Kit;

  /*
   * Terrain: the cell painters used while baking chunks (bake time only): terrain, caps,
   * decorations, ledges, spikes, liquids and occlusion.
   */

  function isTerrain(code) {
    return code === SOLID || code === ICE || code === FAKE;
  }

  function terrainAt(level, c, r) {
    if (c < 0 || c >= level.cols)
      return true;
    if (r < 0)
      return false;
    if (r >= level.rows)
      return true;
    return isTerrain(level.tiles[r * level.cols + c]);
  }

  function codeAt(level, c, r) {
    if (c < 0 || c >= level.cols || r < 0 || r >= level.rows)
      return -1;
    return level.tiles[r * level.cols + c];
  }

  /* a cell outline, rounded where two open sides meet; `grow` pushes closed
     sides outward a pixel so neighbouring fills overlap without seams */
  function cellPath(g, x, y, s, f, rad, grow) {
    const tl = f.u && f.l ? rad : 0, tr = f.u && f.r ? rad : 0, br = f.d && f.r ? rad : 0, bl = f.d && f.l ? rad : 0;
    if (grow) {
      const gl = f.l ? 0 : grow, gr = f.r ? 0 : grow, gu = f.u ? 0 : grow, gd = f.d ? 0 : grow;
      x -= gl;
      y -= gu;
      const w = s + gl + gr, h = s + gu + gd;
      g.beginPath();
      g.moveTo(x + tl, y);
      g.lineTo(x + w - tr, y);
      if (tr) g.arcTo(x + w, y, x + w, y + tr, tr);
      g.lineTo(x + w, y + h - br);
      if (br) g.arcTo(x + w, y + h, x + w - br, y + h, br);
      g.lineTo(x + bl, y + h);
      if (bl) g.arcTo(x, y + h, x, y + h - bl, bl);
      g.lineTo(x, y + tl);
      if (tl) g.arcTo(x, y, x + tl, y, tl);
      g.closePath();
      return;
    }
    g.beginPath();
    g.moveTo(x + tl, y);
    g.lineTo(x + s - tr, y);
    if (tr) g.arcTo(x + s, y, x + s, y + tr, tr);
    g.lineTo(x + s, y + s - br);
    if (br) g.arcTo(x + s, y + s, x + s - br, y + s, br);
    g.lineTo(x + bl, y + s);
    if (bl) g.arcTo(x, y + s, x, y + s - bl, bl);
    g.lineTo(x, y + tl);
    if (tl) g.arcTo(x, y, x + tl, y, tl);
    g.closePath();
  }

  /* the terrain body with rim shading on every exposed side */
  function paintTerrain(g, level, th, c, r, x, y, pattern, ice) {
    const f = {
      u: !terrainAt(level, c, r - 1), d: !terrainAt(level, c, r + 1),
      l: !terrainAt(level, c - 1, r), r: !terrainAt(level, c + 1, r)
    };
    cellPath(g, x, y, TS, f, 12, 1);
    if (ice) {
      const lg = g.createLinearGradient(x, y, x + TS, y + TS);
      lg.addColorStop(0, '#e8fbff');
      lg.addColorStop(0.45, '#9ae0f8');
      lg.addColorStop(1, '#4aa0d8');
      g.fillStyle = lg;
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x + 8, y + TS - 6);
      g.lineTo(x + TS - 10, y + 8);
      g.stroke();
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x + 20, y + TS - 4);
      g.lineTo(x + TS - 4, y + 18);
      g.stroke();
      g.strokeStyle = 'rgba(30,90,150,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 4, y + 20 + cellRand(c, r, 5) * 10);
      g.lineTo(x + 18, y + 26);
      g.lineTo(x + 26, y + 40);
      g.stroke();
      g.restore();
    } else {
      g.fillStyle = pattern;
      g.fill();
    }
    /* depth: cells buried deep get darker so the mass reads as volume */
    let depth = 0;
    for (let k = 1; k <= 5; ++k)
      if (terrainAt(level, c, r - k)) ++depth;
    if (depth >= 2 && !ice && !f.d) {
      g.fillStyle = rgba(th.dark, 0.11 * (depth - 1));
      g.fillRect(x, y, TS, TS);
    }
    if (depth >= 2 && !ice && !f.d && !f.l && !f.r)
      paintBuried(g, th, c, r, x, y, level.world | 0);
    g.save();
    cellPath(g, x, y, TS, f, 12);
    g.clip();
    if (depth >= 2 && !ice && f.d) {
      g.fillStyle = rgba(th.dark, 0.11 * (depth - 1));
      g.fillRect(x, y, TS, TS);
    }
    /* light from above, shade from below and the sides */
    const RIM = 14;
    if (f.l) {
      const lg = g.createLinearGradient(x, 0, x + RIM, 0);
      lg.addColorStop(0, rgba(th.dark, 0.7));
      lg.addColorStop(1, rgba(th.dark, 0));
      g.fillStyle = lg;
      g.fillRect(x, y, RIM, TS);
    }
    if (f.r) {
      const lg = g.createLinearGradient(x + TS, 0, x + TS - RIM, 0);
      lg.addColorStop(0, rgba(th.dark, 0.75));
      lg.addColorStop(1, rgba(th.dark, 0));
      g.fillStyle = lg;
      g.fillRect(x + TS - RIM, y, RIM, TS);
    }
    if (f.d) {
      const lg = g.createLinearGradient(0, y + TS, 0, y + TS - RIM - 4);
      lg.addColorStop(0, rgba(th.dark, 0.85));
      lg.addColorStop(1, rgba(th.dark, 0));
      g.fillStyle = lg;
      g.fillRect(x, y + TS - RIM - 4, TS, RIM + 4);
    }
    g.restore();
    /* outline on the exposed sides */
    g.strokeStyle = th.outline;
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    if (f.l) { g.moveTo(x + 1, y + (f.u ? 12 : 0)); g.lineTo(x + 1, y + TS - (f.d ? 12 : 0)); }
    if (f.r) { g.moveTo(x + TS - 1, y + (f.u ? 12 : 0)); g.lineTo(x + TS - 1, y + TS - (f.d ? 12 : 0)); }
    if (f.d) { g.moveTo(x + (f.l ? 12 : 0), y + TS - 1); g.lineTo(x + TS - (f.r ? 12 : 0), y + TS - 1); }
    g.stroke();
    if (f.d && f.l) { g.beginPath(); g.arc(x + 12, y + TS - 12, 11, Math.PI / 2, Math.PI); g.stroke(); }
    if (f.d && f.r) { g.beginPath(); g.arc(x + TS - 12, y + TS - 12, 11, 0, Math.PI / 2); g.stroke(); }
    return f;
  }

  /* the surface band on top of exposed cells: grass, moss, snow, ash or gilding */
  function paintCap(g, level, th, c, r, x, y, f, world) {
    if (!f.u)
      return;
    const ice = codeAt(level, c, r) === ICE;
    if (ice && world !== 2)
      return;
    const depth = ice ? 7 : th.brick ? 9 : 13;
    const wave = (k) => depth + Math.sin((c * TS + k) * 0.21) * 2.5 + (cellRand(c, r, k) - 0.5) * 3;
    /* the band: hangs slightly over open sides */
    const x0 = x - (f.l ? 3 : 0), x1 = x + TS + (f.r ? 3 : 0);
    g.beginPath();
    g.moveTo(x0, y + (f.l ? 10 : 0));
    if (f.l) g.quadraticCurveTo(x0, y - 3, x0 + 12, y - 3);
    else g.lineTo(x0, y - 3);
    g.lineTo(x1 - (f.r ? 12 : 0), y - 3);
    if (f.r) g.quadraticCurveTo(x1, y - 3, x1, y + 10);
    else g.lineTo(x1, y - 3);
    for (let k = 0; k <= 6; ++k) {
      const px = x1 - (x1 - x0) * k / 6;
      let py = y + wave(k * 8);
      if ((k === 0 && f.r) || (k === 6 && f.l)) py = y + depth + 6;
      g.lineTo(px, py);
    }
    g.closePath();
    const lg = g.createLinearGradient(0, y - 3, 0, y + depth + 4);
    lg.addColorStop(0, th.capLight);
    lg.addColorStop(0.35, th.cap);
    lg.addColorStop(1, th.capDark);
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = rgba(th.outline, 0.85);
    g.lineWidth = 2;
    g.stroke();
    /* a bright lip along the very top */
    g.strokeStyle = rgba(th.capLight, 0.9);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0 + (f.l ? 8 : 0), y - 1.5);
    g.lineTo(x1 - (f.r ? 8 : 0), y - 1.5);
    g.stroke();
    if (world === 0) {
      /* grass blades poking up and over the lip */
      for (let k = 0; k < 9; ++k) {
        const bx = x + 2 + k * 5.2 + cellRand(c, r, 30 + k) * 3;
        const bh = 4 + cellRand(c, r, 40 + k) * 7;
        const lean = (cellRand(c, r, 50 + k) - 0.5) * 6;
        g.fillStyle = k % 3 ? th.capLight : th.cap;
        g.beginPath();
        g.moveTo(bx - 2, y + 1);
        g.quadraticCurveTo(bx + lean * 0.3, y - bh * 0.6, bx + lean, y - bh);
        g.quadraticCurveTo(bx + 1, y - bh * 0.4, bx + 2.2, y + 1);
        g.closePath();
        g.fill();
      }
    } else if (world === 2) {
      /* snow drifts with a cold shadow and sparkles */
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(x + TS * (0.3 + cellRand(c, r, 3) * 0.4), y - 1, 14, 5, 0, Math.PI, TWO_PI);
      g.fill();
      for (let k = 0; k < 3; ++k) {
        g.fillStyle = 'rgba(200,240,255,0.95)';
        g.fillRect(x + cellRand(c, r, 60 + k) * TS, y + 2 + cellRand(c, r, 70 + k) * 6, 1.5, 1.5);
      }
    } else if (world === 3) {
      /* glowing embers in the ash */
      for (let k = 0; k < 3; ++k) {
        if (cellRand(c, r, 80 + k) < 0.5) continue;
        const ex = x + cellRand(c, r, 90 + k) * TS, ey = y + 3 + cellRand(c, r, 100 + k) * 6;
        g.fillStyle = 'rgba(255,140,40,0.35)';
        g.beginPath();
        g.arc(ex, ey, 4, 0, TWO_PI);
        g.fill();
        g.fillStyle = '#ffb04a';
        g.fillRect(ex - 1, ey - 1, 2, 2);
      }
    } else if (world === 4) {
      /* a gilded trim with studs */
      g.fillStyle = th.capDark;
      for (let k = 0; k < 3; ++k) {
        g.beginPath();
        g.arc(x + 8 + k * 16, y + 4, 2, 0, TWO_PI);
        g.fill();
      }
    } else if (world === 1) {
      /* moss tendrils */
      for (let k = 0; k < 4; ++k) {
        const mx = x + 4 + k * 11 + cellRand(c, r, 110 + k) * 5;
        g.strokeStyle = rgba(th.capLight, 0.8);
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(mx, y + depth - 2);
        g.quadraticCurveTo(mx + 2, y + depth + 4, mx - 1, y + depth + 6 + cellRand(c, r, 120 + k) * 6);
        g.stroke();
      }
    }
  }

  /* decorations standing on a surface cell */
  function paintDeco(g, th, c, r, x, y, world) {
    const roll = cellRand(c, r, 7);
    if (roll > 0.42)
      return;
    const k = cellRand(c, r, 8);
    const cx = x + 8 + cellRand(c, r, 9) * (TS - 16);
    if (world === 0) {
      if (k < 0.45) {
        /* a flower */
        const petal = ['#ff7aa8', '#ffe14a', '#ffffff', '#b88aff'][(cellRand(c, r, 10) * 4) | 0];
        g.strokeStyle = '#2e7a24';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(cx, y);
        g.quadraticCurveTo(cx - 2, y - 7, cx, y - 13);
        g.stroke();
        for (let p = 0; p < 5; ++p) {
          const a = p * TWO_PI / 5;
          g.fillStyle = petal;
          g.beginPath();
          g.ellipse(cx + Math.cos(a) * 3.2, y - 14 + Math.sin(a) * 3.2, 2.6, 2.6, 0, 0, TWO_PI);
          g.fill();
        }
        g.fillStyle = '#ffb02a';
        g.beginPath();
        g.arc(cx, y - 14, 1.8, 0, TWO_PI);
        g.fill();
      } else if (k < 0.7) {
        /* a tuft */
        g.fillStyle = th.cap;
        for (let b = 0; b < 5; ++b) {
          g.beginPath();
          g.moveTo(cx - 6 + b * 3, y);
          g.lineTo(cx - 5 + b * 3 + (b - 2) * 1.5, y - 8 - (b % 2) * 4);
          g.lineTo(cx - 3 + b * 3, y);
          g.fill();
        }
      } else if (k < 0.85) {
        /* a mushroom */
        g.fillStyle = '#f4e8d0';
        g.fillRect(cx - 1.5, y - 7, 3, 7);
        g.fillStyle = '#e8402a';
        g.beginPath();
        g.ellipse(cx, y - 7, 6, 4.5, 0, Math.PI, TWO_PI);
        g.fill();
        g.fillStyle = '#ffffff';
        g.fillRect(cx - 3, y - 10, 1.6, 1.6);
        g.fillRect(cx + 1.5, y - 9, 1.4, 1.4);
      } else {
        paintPebble(g, th, cx, y);
      }
    } else if (world === 1) {
      if (k < 0.5) {
        /* glowing crystal cluster */
        const col = k < 0.25 ? '#6ae0ff' : '#c08aff';
        g.fillStyle = rgba(col, 0.18);
        g.beginPath();
        g.arc(cx, y - 8, 14, 0, TWO_PI);
        g.fill();
        for (let p = 0; p < 3; ++p) {
          const h = 10 + p * 4 - (p === 2 ? 6 : 0), w = 4;
          const bx = cx - 5 + p * 5;
          g.fillStyle = mix(col, '#ffffff', 0.25);
          g.beginPath();
          g.moveTo(bx - w / 2, y);
          g.lineTo(bx - w / 2 + (p - 1), y - h);
          g.lineTo(bx + (p - 1) * 1.5, y - h - 4);
          g.lineTo(bx + w / 2, y);
          g.closePath();
          g.fill();
          g.strokeStyle = rgba('#0c0e1a', 0.7);
          g.lineWidth = 1;
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.7)';
          g.fillRect(bx - 1, y - h + 2, 1, h - 4);
        }
      } else if (k < 0.75) {
        /* glow mushrooms */
        g.fillStyle = '#c8f0e0';
        g.fillRect(cx - 1, y - 6, 2, 6);
        g.fillStyle = '#5ae8c8';
        g.beginPath();
        g.ellipse(cx, y - 6, 5, 3.5, 0, Math.PI, TWO_PI);
        g.fill();
        g.fillStyle = 'rgba(90,232,200,0.2)';
        g.beginPath();
        g.arc(cx, y - 6, 10, 0, TWO_PI);
        g.fill();
      } else {
        paintPebble(g, th, cx, y);
      }
    } else if (world === 2) {
      if (k < 0.4) {
        /* a snowy little fir */
        g.fillStyle = '#5a3a2a';
        g.fillRect(cx - 1.5, y - 5, 3, 5);
        for (let p = 0; p < 3; ++p) {
          const w = 10 - p * 3, yy = y - 4 - p * 6;
          g.fillStyle = '#2e5a4a';
          g.beginPath();
          g.moveTo(cx - w, yy);
          g.lineTo(cx, yy - 9);
          g.lineTo(cx + w, yy);
          g.closePath();
          g.fill();
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.moveTo(cx - w * 0.6, yy - 3);
          g.lineTo(cx, yy - 9);
          g.lineTo(cx + w * 0.6, yy - 3);
          g.closePath();
          g.fill();
        }
      } else if (k < 0.7) {
        /* ice shards */
        g.fillStyle = 'rgba(200,240,255,0.9)';
        g.beginPath();
        g.moveTo(cx - 5, y);
        g.lineTo(cx - 2, y - 12);
        g.lineTo(cx + 1, y);
        g.moveTo(cx, y);
        g.lineTo(cx + 4, y - 8);
        g.lineTo(cx + 6, y);
        g.fill();
        g.strokeStyle = 'rgba(40,100,160,0.6)';
        g.lineWidth = 1;
        g.stroke();
      } else {
        paintPebble(g, th, cx, y);
      }
    } else if (world === 3) {
      if (k < 0.4) {
        /* a smouldering vent */
        g.fillStyle = '#1a1012';
        g.beginPath();
        g.ellipse(cx, y - 2, 8, 4, 0, Math.PI, TWO_PI);
        g.fill();
        g.fillStyle = 'rgba(255,120,30,0.35)';
        g.beginPath();
        g.arc(cx, y - 3, 9, 0, TWO_PI);
        g.fill();
        g.fillStyle = '#ffb04a';
        g.fillRect(cx - 3, y - 4, 6, 2);
      } else if (k < 0.7) {
        /* obsidian spires */
        g.fillStyle = '#120a10';
        g.beginPath();
        g.moveTo(cx - 6, y);
        g.lineTo(cx - 3, y - 14);
        g.lineTo(cx, y);
        g.lineTo(cx + 2, y - 9);
        g.lineTo(cx + 5, y);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255,120,60,0.5)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx - 3, y - 13);
        g.lineTo(cx - 1.5, y - 2);
        g.stroke();
      } else {
        paintPebble(g, th, cx, y);
      }
    } else if (world === 4) {
      if (k < 0.35) {
        /* a golden lamp post */
        g.fillStyle = '#a87a2a';
        g.fillRect(cx - 1, y - 16, 2, 16);
        g.fillStyle = 'rgba(255,230,140,0.3)';
        g.beginPath();
        g.arc(cx, y - 18, 8, 0, TWO_PI);
        g.fill();
        g.fillStyle = '#fff0b0';
        g.beginPath();
        g.arc(cx, y - 18, 3, 0, TWO_PI);
        g.fill();
      } else if (k < 0.7) {
        /* a lilac bush */
        for (let p = 0; p < 4; ++p) {
          g.fillStyle = p % 2 ? '#b89aff' : '#d8c8ff';
          g.beginPath();
          g.arc(cx - 5 + p * 3.5, y - 4 - (p % 2) * 3, 4.5, 0, TWO_PI);
          g.fill();
        }
      }
    }
  }

  /* now and then something buried deep in the ground */
  function paintBuried(g, th, c, r, x, y, world) {
    if (cellRand(c, r, 21) > 0.07)
      return;
    const cx = x + 10 + cellRand(c, r, 22) * 28, cy = y + 10 + cellRand(c, r, 23) * 28;
    const kind = Math.floor(cellRand(c, r, 24) * 3);
    g.save();
    g.translate(cx, cy);
    g.rotate(cellRand(c, r, 25) * Math.PI * 2);
    if (world === 1 || world === 4 || kind === 0 && world !== 3) {
      /* a little gem cluster catching light */
      const col = world === 4 ? '#ffe08a' : world === 1 ? '#6ae0ff' : '#c8a0ff';
      g.fillStyle = rgba(col, 0.25);
      g.beginPath();
      g.arc(0, 0, 9, 0, TWO_PI);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, -6); g.lineTo(4, 0); g.lineTo(0, 6); g.lineTo(-4, 0);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(-1, -4, 1.5, 4);
    } else if (world === 3) {
      /* a pocket of glowing slag */
      g.fillStyle = 'rgba(255,110,30,0.35)';
      g.beginPath();
      g.arc(0, 0, 10, 0, TWO_PI);
      g.fill();
      g.fillStyle = '#ffb04a';
      g.beginPath();
      g.ellipse(0, 0, 5, 3, 0, 0, TWO_PI);
      g.fill();
    } else if (kind === 1) {
      /* a fossil shell */
      g.strokeStyle = rgba(th.light, 0.8);
      g.lineWidth = 1.6;
      g.beginPath();
      for (let k = 0; k < 18; ++k) {
        const a = k * 0.55, rr = 1 + k * 0.42;
        if (k === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.stroke();
    } else {
      /* an old bone */
      g.fillStyle = rgba(world === 2 ? '#e8f0ff' : '#e8dcc0', 0.75);
      g.fillRect(-8, -1.5, 16, 3);
      for (const sx of [-8, 8]) {
        g.beginPath();
        g.arc(sx, -2, 2.4, 0, TWO_PI);
        g.arc(sx, 2, 2.4, 0, TWO_PI);
        g.fill();
      }
    }
    g.restore();
  }

  function paintPebble(g, th, cx, y) {
    g.fillStyle = rgba(th.outline, 0.6);
    g.beginPath();
    g.ellipse(cx + 1, y - 2, 6, 3.5, 0, 0, TWO_PI);
    g.fill();
    g.fillStyle = th.stone[2];
    g.beginPath();
    g.ellipse(cx, y - 3, 5.5, 3.5, 0, 0, TWO_PI);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(cx - 2.5, y - 5, 3, 1.4);
  }

  /* hanging growth under a ceiling: roots, stalactites, icicles, drips, cloud puffs */
  function paintHang(g, th, c, r, x, y, kind) {
    const roll = cellRand(c, r, 11);
    if (roll > 0.6)
      return;
    const cx = x + 8 + cellRand(c, r, 12) * (TS - 16);
    const len = 8 + cellRand(c, r, 13) * 16;
    if (kind === 'roots') {
      g.strokeStyle = '#5a3416';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, y);
      g.bezierCurveTo(cx - 4, y + len * 0.4, cx + 4, y + len * 0.7, cx - 1, y + len);
      g.stroke();
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx + 1, y + len * 0.4);
      g.lineTo(cx + 6, y + len * 0.7);
      g.stroke();
    } else if (kind === 'stalactite' || kind === 'icicle' || kind === 'drip') {
      const col = kind === 'icicle' ? '#d8f4ff' : kind === 'drip' ? '#3a2a2c' : th.stone[0];
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx - 5, y);
      g.lineTo(cx + 5, y);
      g.lineTo(cx + 0.5, y + len);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba(th.outline, 0.6);
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = kind === 'icicle' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)';
      g.fillRect(cx - 2, y + 1, 1.2, len * 0.6);
      if (kind === 'drip') {
        g.fillStyle = 'rgba(255,120,40,0.8)';
        g.beginPath();
        g.arc(cx + 0.5, y + len + 2, 1.8, 0, TWO_PI);
        g.fill();
      }
    } else if (kind === 'cloud') {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let p = 0; p < 3; ++p) {
        g.beginPath();
        g.arc(cx - 8 + p * 8, y + 4 + (p % 2) * 3, 6 + (p % 2) * 2, 0, TWO_PI);
        g.fill();
      }
    }
  }

  function paintLedge(g, th, c, r, x, y, left, right) {
    const kind = th.ledge;
    if (kind === 'wood' || kind === 'icewood') {
      const lg = g.createLinearGradient(0, y, 0, y + 14);
      lg.addColorStop(0, kind === 'icewood' ? '#c8a07a' : '#c88a4a');
      lg.addColorStop(1, kind === 'icewood' ? '#6a4a34' : '#6a3a1a');
      g.fillStyle = lg;
      g.fillRect(x, y + 1, TS, 12);
      g.strokeStyle = '#2a1608';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, TS - 2, 12);
      g.strokeStyle = 'rgba(60,30,10,0.5)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 24, y + 2);
      g.lineTo(x + 24, y + 12);
      g.moveTo(x + 4, y + 7);
      g.lineTo(x + 18, y + 7);
      g.stroke();
      g.fillStyle = '#d8d0c0';
      g.fillRect(x + 4, y + 4, 2, 2);
      g.fillRect(x + TS - 6, y + 4, 2, 2);
      g.fillStyle = 'rgba(255,230,180,0.5)';
      g.fillRect(x + 2, y + 2, TS - 4, 2);
      if (kind === 'icewood') {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.ellipse(x + TS / 2, y + 1, TS / 2, 3.5, 0, Math.PI, TWO_PI);
        g.fill();
        g.fillStyle = '#e8f6ff';
        for (let k = 0; k < 3; ++k) {
          g.beginPath();
          g.moveTo(x + 8 + k * 14, y + 13);
          g.lineTo(x + 11 + k * 14, y + 13);
          g.lineTo(x + 9.5 + k * 14, y + 19 + cellRand(c, r, k) * 5);
          g.fill();
        }
      }
      /* rope posts at the ends */
      if (left || right) {
        g.fillStyle = '#5a3416';
        const px = left ? x + 3 : x + TS - 7;
        g.fillRect(px, y + 12, 4, 10);
      }
    } else if (kind === 'slab') {
      const lg = g.createLinearGradient(0, y, 0, y + 16);
      lg.addColorStop(0, '#6a7898');
      lg.addColorStop(1, '#2a3048');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(x + (left ? 4 : 0), y);
      g.lineTo(x + TS - (right ? 4 : 0), y);
      g.lineTo(x + TS - (right ? 8 : 0), y + 15);
      g.lineTo(x + (left ? 8 : 0), y + 15);
      g.closePath();
      g.fill();
      g.strokeStyle = '#0c0e1a';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#3aa88a';
      g.fillRect(x + (left ? 4 : 0), y, TS - (left ? 4 : 0) - (right ? 4 : 0), 3);
      g.fillStyle = 'rgba(106,224,255,0.6)';
      g.fillRect(x + 10 + cellRand(c, r, 1) * 20, y + 7, 6, 1.5);
    } else if (kind === 'girder') {
      g.fillStyle = '#3a3034';
      g.fillRect(x, y, TS, 14);
      g.strokeStyle = '#120a0c';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, TS - 2, 12);
      g.strokeStyle = '#6a5a5a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + 2, y + 12);
      g.lineTo(x + TS / 2, y + 2);
      g.lineTo(x + TS - 2, y + 12);
      g.stroke();
      g.fillStyle = '#ff8a3a';
      g.fillRect(x, y, TS, 2);
      g.fillStyle = '#8a7a7a';
      g.fillRect(x + 4, y + 5, 3, 3);
      g.fillRect(x + TS - 7, y + 5, 3, 3);
    } else {
      /* a cloud ledge */
      g.fillStyle = 'rgba(160,150,210,0.6)';
      g.beginPath();
      g.ellipse(x + TS / 2, y + 12, TS / 2 + 4, 8, 0, 0, TWO_PI);
      g.fill();
      for (let k = 0; k < 3; ++k) {
        const px = x + 8 + k * 16, pr = 9 + cellRand(c, r, k) * 4;
        const rg = g.createRadialGradient(px - 2, y + 2, 1, px, y + 6, pr);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(1, '#d8d0f4');
        g.fillStyle = rg;
        g.beginPath();
        g.arc(px, y + 6, pr, 0, TWO_PI);
        g.fill();
      }
      g.fillStyle = 'rgba(255,224,138,0.8)';
      g.fillRect(x, y - 1, TS, 2);
    }
  }

  function paintSpike(g, th, x, y, dir) {
    g.save();
    g.translate(x + TS / 2, y + TS / 2);
    g.rotate(dir === 'down' ? Math.PI : dir === 'left' ? -Math.PI / 2 : dir === 'right' ? Math.PI / 2 : 0);
    /* a base plate and four teeth, lit from the left */
    g.fillStyle = '#2a2a34';
    g.fillRect(-TS / 2, TS / 2 - 6, TS, 6);
    for (let k = 0; k < 4; ++k) {
      const bx = -TS / 2 + 2 + k * 11;
      g.fillStyle = mix(th.spike, '#000000', 0.45);
      g.beginPath();
      g.moveTo(bx, TS / 2 - 5);
      g.lineTo(bx + 5.5, -TS / 2 + 20);
      g.lineTo(bx + 11, TS / 2 - 5);
      g.closePath();
      g.fill();
      g.fillStyle = th.spike;
      g.beginPath();
      g.moveTo(bx, TS / 2 - 5);
      g.lineTo(bx + 5.5, -TS / 2 + 20);
      g.lineTo(bx + 5.5, TS / 2 - 5);
      g.closePath();
      g.fill();
      g.strokeStyle = '#14141c';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(bx, TS / 2 - 5);
      g.lineTo(bx + 5.5, -TS / 2 + 20);
      g.lineTo(bx + 11, TS / 2 - 5);
      g.stroke();
      g.fillStyle = '#ffffff';
      g.fillRect(bx + 4.6, -TS / 2 + 21, 1.2, 3);
    }
    g.restore();
  }

  function paintLiquidBody(g, th, level, c, r, x, y) {
    const top = codeAt(level, c, r - 1) !== LIQUID;
    const lg = g.createLinearGradient(0, y, 0, y + TS);
    lg.addColorStop(0, top ? th.liquid[0] : th.liquid[1]);
    lg.addColorStop(1, th.liquid[top ? 1 : 2]);
    g.fillStyle = lg;
    g.fillRect(x, y + (top ? 14 : 0), TS, TS - (top ? 14 : 0));
    if (th.hot) {
      g.fillStyle = 'rgba(255,240,160,0.35)';
      for (let k = 0; k < 3; ++k)
        g.fillRect(x + cellRand(c, r, k) * TS, y + 18 + cellRand(c, r, k + 5) * 24, 6, 2);
    } else {
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x + cellRand(c, r, 2) * 30, y + 24, 14, 1.5);
    }
  }

  /* ambient occlusion in open cells under and beside terrain */
  function paintOcclusion(g, level, c, r, x, y) {
    /* only inside pockets: a roof above plus a wall or floor next to the cell */
    const pocket = terrainAt(level, c - 1, r) || terrainAt(level, c + 1, r) || terrainAt(level, c, r + 1);
    if (terrainAt(level, c, r - 1) && pocket && r < level.rows - 1) {
      const lg = g.createLinearGradient(0, y, 0, y + 26);
      lg.addColorStop(0, 'rgba(0,0,0,0.38)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.fillRect(x, y, TS, 26);
    }
    /* walls of an enclosed pocket (a roof above) shade the air beside them */
    if (!terrainAt(level, c, r - 1) || r === 0)
      return;
    if (terrainAt(level, c - 1, r) && c > 0) {
      const lg = g.createLinearGradient(x, 0, x + 16, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0.2)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.fillRect(x, y, 16, TS);
    }
    if (terrainAt(level, c + 1, r) && c < level.cols - 1) {
      const lg = g.createLinearGradient(x + TS, 0, x + TS - 16, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0.2)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.fillRect(x + TS - 16, y, 16, TS);
    }
  }

  Object.assign(Kit, { isTerrain, codeAt, paintTerrain, paintCap, paintDeco, paintHang, paintLedge, paintSpike, paintLiquidBody, paintOcclusion });
})();
