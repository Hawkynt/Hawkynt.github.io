;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});
  const A = NS.art || (NS.art = {});

  /*
   * Cached body sprites: fixtures (walls, ramps, pegs, ground, ice), crates,
   * steel, glass, TNT, boulders, springs, bumpers, conveyors and treads,
   * paddles, fans and blades, magnets, planks, blocks and pendulum bobs.
   * Reads the sprite kit and the material fills; owns no state.
   */

  const TWO_PI = A.TWO_PI, rgba = A.rgba, shade = A.shade, mulberry = A.mulberry, roundRect = A.roundRect, sprite = A.sprite, WOOD = A.WOOD,
    METAL = A.METAL, woodFill = A.woodFill, metalFill = A.metalFill, rivets = A.rivets, iceFill = A.iceFill, bevel = A.bevel,
    materialBox = A.materialBox, paintGround = A.paintGround;

  /* ══════════════════════════════════════════════════════════════════
     BODY SPRITES
     ══════════════════════════════════════════════════════════════════ */

  function boxSize(b) {
    const p = b.poly;
    if (!p)
      return [b.r * 2, b.r * 2];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.count; ++i) {
      x0 = Math.min(x0, p.verts[i * 2]); x1 = Math.max(x1, p.verts[i * 2]);
      y0 = Math.min(y0, p.verts[i * 2 + 1]); y1 = Math.max(y1, p.verts[i * 2 + 1]);
    }
    return [x1 - x0, y1 - y0, x0, y0];
  }

  function polyPath(g, b, ox, oy) {
    const v = b.poly.verts;
    g.beginPath();
    g.moveTo(v[0] + ox, v[1] + oy);
    for (let i = 1; i < b.poly.count; ++i)
      g.lineTo(v[i * 2] + ox, v[i * 2 + 1] + oy);
    g.closePath();
  }

  function bodyKey(b, world) {
    const k = b.data && b.data.kind || 'wall';
    const sz = boxSize(b);
    return k + ':' + b.mat + ':' + world + ':' + Math.round(sz[0]) + 'x' + Math.round(sz[1]) + (b.circle ? 'c' : '') + ':' + (b.data && b.data.dir || '') + ':' + b.id % 3;
  }

  function staticSprite(b, world) {
    const kind = b.data && b.data.kind || 'wall';
    const sz = boxSize(b);
    const w = sz[0], h = sz[1];
    const pad = kind === 'ground' ? 14 : 6;
    return sprite(bodyKey(b, world), w, h, pad, (g, W, H, rand) => {
      if (kind === 'ground') {
        paintGround(g, W, H, world, rand);
        return;
      }
      if (kind === 'ramp') {
        g.save();
        polyPath(g, b, -sz[2], -sz[3]);
        g.clip();
        materialBox(g, W, H, b.mat, world, rand);
        g.restore();
        polyPath(g, b, -sz[2], -sz[3]);
        g.lineWidth = 1.6;
        g.strokeStyle = 'rgba(10,6,4,0.9)';
        g.stroke();
        /* a highlight along the slope */
        g.save();
        polyPath(g, b, -sz[2], -sz[3]);
        g.clip();
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 3;
        const dir = b.data.dir;
        g.beginPath();
        if (dir > 0) { g.moveTo(1, H - 1); g.lineTo(W - 1, 1); } else { g.moveTo(1, 1); g.lineTo(W - 1, H - 1); }
        g.stroke();
        g.restore();
        return;
      }
      if (kind === 'peg') {
        const r = W / 2;
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath();
        g.arc(r + 1.5, r + 2, r, 0, TWO_PI);
        g.fill();
        const rg = g.createRadialGradient(r * 0.65, r * 0.6, 0, r, r, r);
        if (world === 1) {
          rg.addColorStop(0, '#e8d8a0');
          rg.addColorStop(0.6, '#a08040');
          rg.addColorStop(1, '#4a3416');
        } else {
          rg.addColorStop(0, '#ffffff');
          rg.addColorStop(0.4, METAL[world].light);
          rg.addColorStop(1, METAL[world].dark);
        }
        g.fillStyle = rg;
        g.beginPath();
        g.arc(r, r, r - 0.5, 0, TWO_PI);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 1.2;
        g.stroke();
        return;
      }
      if (kind === 'ice') {
        iceFill(g, 0, 0, W, H, rand);
        g.lineWidth = 1.2;
        g.strokeStyle = 'rgba(40,90,130,0.9)';
        g.strokeRect(0.6, 0.6, W - 1.2, H - 1.2);
        return;
      }
      materialBox(g, W, H, b.mat, world, rand);
      if (kind === 'wall' && world === 1 && b.mat === 'wood' && W > H && W > 60) {
        /* moss tufts on garden beams */
        for (let x = 4; x < W - 4; x += 7 + rand() * 10) {
          g.fillStyle = rand() < 0.5 ? '#5aa83a' : '#7ac84a';
          g.beginPath();
          g.ellipse(x, 1.5, 3 + rand() * 4, 2 + rand() * 2, 0, 0, TWO_PI);
          g.fill();
        }
      }
      if (kind === 'wall' && world === 2 && W > H) {
        g.fillStyle = 'rgba(245,252,255,0.9)';
        for (let x = 0; x < W; x += 3)
          g.fillRect(x, 0, 3, 1.5 + rand() * 2.5);
      }
    });
  }

  /* ── dynamic and gadget sprites ── */

  function crateSprite(w, h, world) {
    return sprite('crate' + w + 'x' + h + ':' + world, w, h, 4, (g, W, H, rand) => {
      woodFill(g, 0, 0, W, H, world === 3 ? 3 : 0, rand, false);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(5, 5, W - 10, H - 10);
      woodFill(g, 6, 6, W - 12, H - 12, world === 3 ? 3 : 0, rand, true);
      /* frame and cross brace */
      const p = WOOD[world === 3 ? 3 : 0];
      g.strokeStyle = p.dark;
      g.lineWidth = 6;
      g.strokeRect(3, 3, W - 6, H - 6);
      g.strokeStyle = p.light;
      g.lineWidth = 1.2;
      g.strokeRect(1.5, 1.5, W - 3, H - 3);
      g.lineWidth = 6;
      g.strokeStyle = shade(p.base, -0.15);
      g.beginPath();
      g.moveTo(6, 6);
      g.lineTo(W - 6, H - 6);
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = rgba(p.dark, 0.9);
      g.stroke();
      for (const q of [[5, 5], [W - 5, 5], [5, H - 5], [W - 5, H - 5]]) {
        g.fillStyle = '#c8c0b0';
        g.beginPath();
        g.arc(q[0], q[1], 2, 0, TWO_PI);
        g.fill();
      }
      g.lineWidth = 1.4;
      g.strokeStyle = '#140a04';
      g.strokeRect(0.7, 0.7, W - 1.4, H - 1.4);
    });
  }

  function steelSprite(w, h, world) {
    return sprite('steel' + w + 'x' + h + ':' + world, w, h, 4, (g, W, H, rand) => {
      metalFill(g, 0, 0, W, H, world, rand);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 2;
      g.strokeRect(6, 6, W - 12, H - 12);
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 1;
      g.strokeRect(7.5, 7.5, W - 15, H - 15);
      bevel(g, 0, 0, W, H, 1);
      rivets(g, 0, 0, W, H, world);
    });
  }

  function glassSprite(w, h) {
    return sprite('glass' + w + 'x' + h, w, h, 4, (g, W, H) => {
      const lg = g.createLinearGradient(0, 0, W * 0.4, H);
      lg.addColorStop(0, 'rgba(220,250,255,0.55)');
      lg.addColorStop(0.5, 'rgba(150,220,250,0.3)');
      lg.addColorStop(1, 'rgba(110,190,240,0.45)');
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      g.save();
      g.beginPath();
      g.rect(0, 0, W, H);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      const long = Math.max(W, H);
      for (let k = 0; k < Math.max(1, long / 70); ++k) {
        const o = (k + 0.3) * 70;
        g.beginPath();
        if (W >= H) {
          g.moveTo(o, 0); g.lineTo(o + 10, 0); g.lineTo(o + 10 - H, H); g.lineTo(o - H, H);
        } else {
          g.moveTo(0, o); g.lineTo(0, o + 10); g.lineTo(W, o + 10 - W); g.lineTo(W, o - W);
        }
        g.closePath();
        g.fill();
      }
      g.restore();
      g.lineWidth = 1.5;
      g.strokeStyle = 'rgba(230,252,255,0.95)';
      g.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);
      g.lineWidth = 0.8;
      g.strokeStyle = 'rgba(40,110,160,0.8)';
      g.strokeRect(2, 2, W - 4, H - 4);
    });
  }

  function tntSprite() {
    return sprite('tnt', 44, 44, 10, (g, W, H, rand) => {
      /* sticks of dynamite in a red crate */
      g.fillStyle = '#7a1a10';
      roundRect(g, 0, 0, W, H, 4);
      g.fill();
      for (let i = 0; i < 4; ++i) {
        const x = 3 + i * 9.6;
        const lg = g.createLinearGradient(x, 0, x + 9, 0);
        lg.addColorStop(0, '#ff6a4a');
        lg.addColorStop(0.4, '#e82a1a');
        lg.addColorStop(1, '#8a120a');
        g.fillStyle = lg;
        roundRect(g, x, 3, 9, H - 6, 4);
        g.fill();
      }
      g.fillStyle = '#f0e0c0';
      g.fillRect(2, 15, W - 4, 14);
      g.strokeStyle = '#3a1a10';
      g.lineWidth = 1;
      g.strokeRect(2, 15, W - 4, 14);
      g.fillStyle = '#c81a10';
      g.font = 'bold 12px Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('TNT', W / 2, 22.5);
      /* fuse */
      g.strokeStyle = '#4a3a2a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(W / 2, 3);
      g.quadraticCurveTo(W / 2 + 8, -6, W / 2 + 4, -9);
      g.stroke();
      g.lineWidth = 1.4;
      g.strokeStyle = '#1a0806';
      roundRect(g, 0.7, 0.7, W - 1.4, H - 1.4, 4);
      g.stroke();
    });
  }

  function boulderSprite(r) {
    return sprite('boulder' + r, r * 2, r * 2, 3, (g, W, H, rand) => {
      g.beginPath();
      for (let k = 0; k < 14; ++k) {
        const a = k / 14 * TWO_PI, rr = r * (0.92 + rand() * 0.08);
        if (k === 0) g.moveTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr);
        else g.lineTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr);
      }
      g.closePath();
      const rg = g.createRadialGradient(r * 0.6, r * 0.55, 0, r, r, r);
      rg.addColorStop(0, '#b8aca0');
      rg.addColorStop(0.6, '#7a6e64');
      rg.addColorStop(1, '#3a322c');
      g.fillStyle = rg;
      g.fill();
      g.lineWidth = 1.4;
      g.strokeStyle = '#1a1410';
      g.stroke();
      for (let k = 0; k < 8; ++k) {
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath();
        g.arc(r + (rand() - 0.5) * r, r + (rand() - 0.5) * r, 1.5 + rand() * 2.5, 0, TWO_PI);
        g.fill();
      }
    });
  }

  function springSprite(world) {
    return sprite('spring' + world, 68, 20, 18, (g, W, H) => {
      /* base plate */
      metalFill(g, 0, H - 6, W, 6, world, mulberry(3));
      g.strokeStyle = '#140c08';
      g.lineWidth = 1;
      g.strokeRect(0.5, H - 6, W - 1, 5.5);
      /* coil */
      g.strokeStyle = '#d8dce4';
      g.lineWidth = 2.6;
      g.beginPath();
      for (let i = 0; i <= 8; ++i) {
        const x = 8 + i * (W - 16) / 8;
        const y = i % 2 ? 4 : H - 7;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.strokeStyle = 'rgba(60,60,70,0.9)';
      g.lineWidth = 1;
      g.stroke();
      /* rubber top pad */
      const lg = g.createLinearGradient(0, -4, 0, 5);
      lg.addColorStop(0, '#9aff7a');
      lg.addColorStop(0.5, '#3ac83a');
      lg.addColorStop(1, '#1a6a1a');
      g.fillStyle = lg;
      roundRect(g, 0, -4, W, 8, 4);
      g.fill();
      g.strokeStyle = '#0a2a0a';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(6, -3, W - 12, 1.6);
      /* chevrons pointing out of the face */
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 1.6;
      for (let i = -1; i <= 1; ++i) {
        g.beginPath();
        g.moveTo(W / 2 + i * 16 - 4, 2);
        g.lineTo(W / 2 + i * 16, -2);
        g.lineTo(W / 2 + i * 16 + 4, 2);
        g.stroke();
      }
    });
  }

  function bumperSprite(r, lit) {
    return sprite('bumper' + r + (lit ? 'L' : ''), r * 2, r * 2, 6, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.arc(r + 2, r + 3, r, 0, TWO_PI);
      g.fill();
      const rg = g.createRadialGradient(r * 0.7, r * 0.6, 0, r, r, r);
      rg.addColorStop(0, lit ? '#ffffff' : '#ffd0f0');
      rg.addColorStop(0.4, lit ? '#ff9ae0' : '#ff4ab0');
      rg.addColorStop(1, '#6a0a48');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(r, r, r - 0.5, 0, TWO_PI);
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = lit ? '#ffffff' : '#ffe0a0';
      g.beginPath();
      g.arc(r, r, r * 0.62, 0, TWO_PI);
      g.stroke();
      g.lineWidth = 1.4;
      g.strokeStyle = '#2a0418';
      g.beginPath();
      g.arc(r, r, r - 0.5, 0, TWO_PI);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.ellipse(r * 0.7, r * 0.55, r * 0.28, r * 0.16, -0.6, 0, TWO_PI);
      g.fill();
    });
  }

  function conveyorSprite(w, world) {
    return sprite('conv' + w + ':' + world, w, 18, 4, (g, W, H) => {
      g.fillStyle = '#1e2026';
      roundRect(g, 0, 0, W, H, 9);
      g.fill();
      g.strokeStyle = '#060608';
      g.lineWidth = 1.4;
      g.stroke();
      /* rollers at the ends */
      for (const x of [9, W - 9]) {
        const rg = g.createRadialGradient(x - 2, 7, 0, x, 9, 7);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.5, METAL[world].base);
        rg.addColorStop(1, METAL[world].dark);
        g.fillStyle = rg;
        g.beginPath();
        g.arc(x, 9, 6.5, 0, TWO_PI);
        g.fill();
        g.fillStyle = '#222';
        g.beginPath();
        g.arc(x, 9, 1.8, 0, TWO_PI);
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(9, 2, W - 18, 2);
    });
  }

  function treadSprite() {
    /* one chevron of the moving belt */
    return sprite('tread', 14, 10, 0, (g) => {
      g.strokeStyle = '#ffcf3a';
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(3, 1.5);
      g.lineTo(9, 5);
      g.lineTo(3, 8.5);
      g.stroke();
    });
  }

  function paddleSprite(w, world) {
    return sprite('paddle' + w + ':' + world, w, 16, 10, (g, W, H, rand) => {
      metalFill(g, 0, 0, W, H, world, rand);
      bevel(g, 0, 0, W, H, 1);
      rivets(g, 0, 0, W, H, world);
      /* gear hub */
      const cx = W / 2, cy = H / 2;
      g.fillStyle = METAL[world].dark;
      g.beginPath();
      for (let k = 0; k < 16; ++k) {
        const a = k / 16 * TWO_PI, rr = k % 2 ? 12 : 15;
        if (k === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      const rg = g.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, 11);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.5, '#ffcf6a');
      rg.addColorStop(1, '#7a4a10');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(cx, cy, 10, 0, TWO_PI);
      g.fill();
      g.fillStyle = '#2a1a08';
      g.beginPath();
      g.arc(cx, cy, 3, 0, TWO_PI);
      g.fill();
    });
  }

  function fanSprite(world) {
    return sprite('fan' + world, 40, 44, 6, (g, W, H, rand) => {
      metalFill(g, 0, 0, W, H, world, rand);
      bevel(g, 0, 0, W, H, 1);
      g.fillStyle = '#101418';
      roundRect(g, 26, 3, 12, H - 6, 3);
      g.fill();
      rivets(g, 0, 0, 22, H, world);
    });
  }

  function bladeSprite() {
    return sprite('blade', 34, 34, 0, (g) => {
      g.translate(17, 17);
      for (let k = 0; k < 4; ++k) {
        g.rotate(Math.PI / 2);
        g.fillStyle = k % 2 ? '#c8d4e0' : '#9aa8b8';
        g.beginPath();
        g.ellipse(0, -9, 4.5, 9, 0.3, 0, TWO_PI);
        g.fill();
      }
      g.fillStyle = '#ffcf3a';
      g.beginPath();
      g.arc(0, 0, 3.5, 0, TWO_PI);
      g.fill();
    });
  }

  function magnetSprite() {
    return sprite('magnet', 40, 40, 6, (g) => {
      g.translate(20, 20);
      g.lineCap = 'butt';
      g.lineWidth = 11;
      g.strokeStyle = '#d82a2a';
      g.beginPath();
      g.arc(0, -2, 11, Math.PI * 0.05, Math.PI * 0.95, true);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, -2, 14, Math.PI * 1.2, Math.PI * 1.8);
      g.stroke();
      /* steel poles */
      for (const x of [-11, 11]) {
        const lg = g.createLinearGradient(x - 5.5, 0, x + 5.5, 0);
        lg.addColorStop(0, '#ffffff');
        lg.addColorStop(0.5, '#a8b0bc');
        lg.addColorStop(1, '#4a5260');
        g.fillStyle = lg;
        g.fillRect(x - 5.5, 0, 11, 12);
        g.strokeStyle = '#1a1010';
        g.lineWidth = 1;
        g.strokeRect(x - 5.5, 0, 11, 12);
      }
      g.lineWidth = 1.2;
      g.strokeStyle = '#3a0808';
      g.beginPath();
      g.arc(0, -2, 16.5, Math.PI * 0.02, Math.PI * 0.98, true);
      g.stroke();
      g.beginPath();
      g.arc(0, -2, 5.5, Math.PI * 0.02, Math.PI * 0.98, true);
      g.stroke();
    });
  }

  function plankSprite(world) {
    return sprite('plank' + world, 132, 16, 4, (g, W, H, rand) => {
      woodFill(g, 0, 0, W, H, world === 2 || world === 4 ? 0 : world, rand, false);
      bevel(g, 0, 0, W, H, 1);
      for (const x of [8, W - 8]) {
        g.fillStyle = '#d8d0c0';
        g.beginPath();
        g.arc(x, H / 2, 2, 0, TWO_PI);
        g.fill();
      }
    });
  }

  function blockSprite(world) {
    return steelSprite(56, 56, world);
  }

  function bobSprite(r) {
    return sprite('bob' + r, r * 2, r * 2, 4, (g) => {
      const rg = g.createRadialGradient(r * 0.6, r * 0.55, 0, r, r, r);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.3, '#c8a070');
      rg.addColorStop(1, '#3a2410');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(r, r, r - 0.5, 0, TWO_PI);
      g.fill();
      g.strokeStyle = '#1a0e04';
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = '#5a3a1a';
      g.fillRect(r - 4, 0, 8, 6);
    });
  }

  A.boxSize = boxSize; A.polyPath = polyPath; A.bodyKey = bodyKey; A.staticSprite = staticSprite; A.crateSprite = crateSprite;
  A.steelSprite = steelSprite; A.glassSprite = glassSprite; A.tntSprite = tntSprite; A.boulderSprite = boulderSprite; A.springSprite = springSprite;
  A.bumperSprite = bumperSprite; A.conveyorSprite = conveyorSprite; A.treadSprite = treadSprite; A.paddleSprite = paddleSprite;
  A.fanSprite = fanSprite; A.bladeSprite = bladeSprite; A.magnetSprite = magnetSprite; A.plankSprite = plankSprite; A.blockSprite = blockSprite;
  A.bobSprite = bobSprite;
})();
