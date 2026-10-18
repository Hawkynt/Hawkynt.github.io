;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});
  const A = NS.art || (NS.art = {});

  /*
   * Drawing bodies and zones: picks the sprite for every body kind, animates
   * the moving details (fan blades, belt treads, portal swirls, water and
   * lava surfaces, air columns), draws tray icons and part previews, and
   * publishes the art module SZ.PhysicsPuzzleArt.
   *
   *   Art.setScale(2);
   *   Art.drawBody(ctx, body, world, t);
   *   Art.drawZone(ctx, zone, world, t);
   *   Art.drawLauncher(ctx, x, y, angleDeg, power, t);
   */

  const TWO_PI = A.TWO_PI, DEG = A.DEG, rgba = A.rgba, shade = A.shade, sprite = A.sprite, blit = A.blit, glowSprite = A.glowSprite,
    drawGlow = A.drawGlow, setScale = A.setScale, getScale = A.getScale, cacheSize = A.cacheSize, boxSize = A.boxSize, staticSprite = A.staticSprite,
    crateSprite = A.crateSprite, steelSprite = A.steelSprite, glassSprite = A.glassSprite, tntSprite = A.tntSprite, boulderSprite = A.boulderSprite,
    springSprite = A.springSprite, bumperSprite = A.bumperSprite, conveyorSprite = A.conveyorSprite, treadSprite = A.treadSprite,
    paddleSprite = A.paddleSprite, fanSprite = A.fanSprite, bladeSprite = A.bladeSprite, magnetSprite = A.magnetSprite, plankSprite = A.plankSprite,
    blockSprite = A.blockSprite, bobSprite = A.bobSprite, drawBall = A.drawBall, targetSprite = A.targetSprite, drawTarget = A.drawTarget,
    starSprite = A.starSprite, drawStar = A.drawStar, drawLauncher = A.drawLauncher;

  /* ══════════════════════════════════════════════════════════════════
     BODIES AND ZONES
     ══════════════════════════════════════════════════════════════════ */

  /* bodies whose look never changes go into the controller's static layer */
  function isStaticArt(b) {
    const k = b.data && b.data.kind;
    return b.type === 'static' && !b.sensor && (k === 'wall' || k === 'ground' || k === 'ramp' || k === 'peg' || k === 'ice');
  }

  function drawBody(ctx, b, world, t, skin) {
    const k = b.data && b.data.kind || 'wall';
    switch (k) {
      case 'ball':
        drawBall(ctx, b.x, b.y, b.a, skin, b.r, t);
        return;
      case 'crate': case 'part-crate': {
        const sz = boxSize(b);
        blit(ctx, crateSprite(Math.round(sz[0]), Math.round(sz[1]), world), b.x, b.y, b.a);
        return;
      }
      case 'steel':
        blit(ctx, steelSprite(Math.round(boxSize(b)[0]), Math.round(boxSize(b)[1]), world), b.x, b.y, b.a);
        return;
      case 'boulder':
        blit(ctx, boulderSprite(Math.round(b.r)), b.x, b.y, b.a);
        return;
      case 'glass': {
        const sz = boxSize(b);
        blit(ctx, glassSprite(Math.round(sz[0]), Math.round(sz[1])), b.x, b.y, b.a);
        return;
      }
      case 'tnt': {
        const fuse = b.fuse && b.fuse > 0;
        if (fuse)
          drawGlow(ctx, b.x, b.y, 120, '#ff5a2a', 0.8);
        blit(ctx, tntSprite(), b.x, b.y, b.a);
        const sp = Math.sin(t * 30 + b.id) > 0;
        const fx = b.x + Math.cos(b.a) * 4 - Math.sin(b.a) * -31, fy = b.y + Math.sin(b.a) * 4 + Math.cos(b.a) * -31;
        drawGlow(ctx, fx, fy, sp ? 16 : 11, '#ffcf6a', 0.9);
        return;
      }
      case 'spring': {
        const hit = b.data.hitAt !== undefined ? t - b.data.hitAt : 9;
        const squash = hit < 0.25 ? Math.sin(hit / 0.25 * Math.PI) * 0.5 : 0;
        const s = springSprite(world);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.a);
        ctx.translate(0, 10);
        ctx.scale(1, 1 + squash);
        ctx.drawImage(s.c, -s.ax, -s.ay - 10 + 10, s.w, s.h);
        ctx.restore();
        if (hit < 0.3)
          drawGlow(ctx, b.x + Math.sin(b.a) * 6, b.y - Math.cos(b.a) * 6, 90, '#9aff7a', 1 - hit / 0.3);
        return;
      }
      case 'bumper': {
        const hit = b.data.hitAt !== undefined ? t - b.data.hitAt : 9;
        const lit = hit < 0.18;
        if (lit)
          drawGlow(ctx, b.x, b.y, b.r * 5, '#ff6ad0', 1 - hit / 0.18);
        const sc = lit ? 1 + 0.12 * (1 - hit / 0.18) : 1;
        const s = bumperSprite(Math.round(b.r), lit);
        ctx.drawImage(s.c, b.x - s.ax * sc, b.y - s.ay * sc, s.w * sc, s.h * sc);
        return;
      }
      case 'conveyor': {
        const sz = boxSize(b);
        const w = Math.round(sz[0]);
        blit(ctx, conveyorSprite(w, world), b.x, b.y, b.a);
        /* moving treads */
        const tr = treadSprite();
        const dir = b.surface >= 0 ? 1 : -1;
        const step = 18;
        const off = ((t * Math.abs(b.surface) * 0.5) % step) * dir;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.a);
        if (dir < 0)
          ctx.scale(-1, 1);
        ctx.beginPath();
        ctx.rect(-w / 2 + 14, -9, w - 28, 18);
        ctx.clip();
        for (let x = -w / 2 - step + Math.abs(off) * 1; x < w / 2; x += step)
          ctx.drawImage(tr.c, x, -5, tr.w, tr.h);
        ctx.restore();
        return;
      }
      case 'paddle': {
        const sz = boxSize(b);
        blit(ctx, paddleSprite(Math.round(sz[0]), world), b.x, b.y, b.a);
        return;
      }
      case 'fan': {
        blit(ctx, fanSprite(world), b.x, b.y, b.a);
        const bl = bladeSprite();
        const ox = b.x + Math.cos(b.a) * 12, oy = b.y + Math.sin(b.a) * 12;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(b.a);
        ctx.scale(0.35, 1);
        ctx.rotate(t * 30);
        ctx.drawImage(bl.c, -17, -17, 34, 34);
        ctx.restore();
        return;
      }
      case 'magnet': {
        drawGlow(ctx, b.x, b.y, 70 + 8 * Math.sin(t * 6), '#ff6a6a', 0.35);
        blit(ctx, magnetSprite(), b.x, b.y, 0);
        return;
      }
      case 'pendulum': {
        ctx.strokeStyle = '#3a2a1a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.data.ax, b.data.ay);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = '#c8a878';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#5a5e68';
        ctx.beginPath();
        ctx.arc(b.data.ax, b.data.ay, 5, 0, TWO_PI);
        ctx.fill();
        blit(ctx, bobSprite(Math.round(b.r)), b.x, b.y, b.a);
        return;
      }
      case 'plank':
        blit(ctx, plankSprite(world), b.x, b.y, b.a);
        return;
      case 'block':
        blit(ctx, blockSprite(world), b.x, b.y, b.a);
        return;
      case 'lava':
        drawLava(ctx, b, t);
        return;
    }
    if (k === 'crate' || (b.type === 'dynamic' && b.mat === 'wood')) {
      const sz = boxSize(b);
      blit(ctx, crateSprite(Math.round(sz[0]), Math.round(sz[1]), world), b.x, b.y, b.a);
      return;
    }
    blit(ctx, staticSprite(b, world), b.x, b.y, b.a);
  }

  function lavaSurface() {
    return sprite('lavasurf', 128, 24, 0, (g) => {
      g.fillStyle = '#ffcf4a';
      g.beginPath();
      g.moveTo(0, 12);
      for (let x = 0; x <= 128; x += 4)
        g.lineTo(x, 9 + Math.sin(x / 128 * TWO_PI * 2) * 3);
      g.lineTo(128, 24);
      g.lineTo(0, 24);
      g.closePath();
      g.fill();
    });
  }

  function drawLava(ctx, b, t) {
    const sz = boxSize(b);
    const x0 = b.x - sz[0] / 2, y0 = b.y - sz[1] / 2, w = sz[0], h = sz[1];
    const body = sprite('lava' + Math.round(w) + 'x' + Math.round(h), w, h, 0, (g, W, H, rand) => {
      const lg = g.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, '#ffb02a');
      lg.addColorStop(0.3, '#ff5a10');
      lg.addColorStop(1, '#7a1004');
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      for (let k = 0; k < W / 10; ++k) {
        g.fillStyle = rand() < 0.5 ? 'rgba(255,230,120,0.35)' : 'rgba(80,10,0,0.3)';
        g.beginPath();
        g.ellipse(rand() * W, 8 + rand() * (H - 8), 4 + rand() * 10, 2 + rand() * 3, 0, 0, TWO_PI);
        g.fill();
      }
    });
    drawGlow(ctx, b.x, y0, w * 1.1, '#ff6a1a', 0.45 + 0.08 * Math.sin(t * 3));
    ctx.drawImage(body.c, x0, y0, w, h);
    const s = lavaSurface();
    const off = (t * 30) % 128;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0 - 8, w, 20);
    ctx.clip();
    ctx.globalAlpha *= 0.85;
    for (let x = x0 - off; x < x0 + w; x += 128)
      ctx.drawImage(s.c, x, y0 - 10, 128, 24);
    ctx.restore();
  }

  function swirlSprite(color) {
    return sprite('swirl' + color, 64, 64, 0, (g) => {
      g.translate(32, 32);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      rg.addColorStop(0, 'rgba(10,6,20,0.95)');
      rg.addColorStop(0.6, rgba(color, 0.55));
      rg.addColorStop(1, rgba(color, 0));
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, 30, 0, TWO_PI);
      g.fill();
      g.lineCap = 'round';
      for (let k = 0; k < 3; ++k) {
        g.rotate(TWO_PI / 3);
        g.strokeStyle = rgba(color, 0.95);
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(0, 0, 22, 0, 1.6);
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(0, 0, 14, 0.4, 1.8);
        g.stroke();
      }
    });
  }

  function arrowSprite(color) {
    return sprite('arrow' + color, 24, 18, 2, (g) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, 5);
      g.lineTo(13, 5);
      g.lineTo(13, 0);
      g.lineTo(24, 9);
      g.lineTo(13, 18);
      g.lineTo(13, 13);
      g.lineTo(0, 13);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 1;
      g.stroke();
    });
  }

  function drawPortalMouth(ctx, x, y, a, color, t, dir) {
    drawGlow(ctx, x, y, 130, color, 0.55 + 0.1 * Math.sin(t * 5));
    const s = swirlSprite(color);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 3 * dir);
    ctx.drawImage(s.c, -32, -32, 64, 64);
    ctx.rotate(-t * 5 * dir);
    ctx.globalAlpha *= 0.6;
    ctx.drawImage(s.c, -24, -24, 48, 48);
    ctx.restore();
    /* exit arrow */
    const ar = arrowSprite(color);
    const k = (t * 1.5) % 1;
    ctx.save();
    ctx.translate(x + Math.cos(a) * (34 + k * 10), y + Math.sin(a) * (34 + k * 10));
    ctx.rotate(a);
    ctx.globalAlpha *= 1 - k * 0.7;
    ctx.drawImage(ar.c, -ar.ax, -ar.ay, ar.w, ar.h);
    ctx.restore();
  }

  function waterSprite(w, h) {
    return sprite('water' + Math.round(w) + 'x' + Math.round(h), w, h, 0, (g, W, H, rand) => {
      const lg = g.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, 'rgba(90,200,255,0.55)');
      lg.addColorStop(0.4, 'rgba(30,110,200,0.6)');
      lg.addColorStop(1, 'rgba(10,40,100,0.8)');
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      for (let k = 0; k < W / 12; ++k) {
        g.strokeStyle = 'rgba(200,240,255,0.18)';
        g.lineWidth = 1;
        const x = rand() * W, y = 10 + rand() * (H - 10);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 8, y - 3, x + 16, y);
        g.stroke();
      }
    });
  }

  function waveSprite() {
    return sprite('wave', 96, 12, 0, (g) => {
      g.strokeStyle = 'rgba(230,250,255,0.9)';
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= 96; x += 3) {
        const y = 6 + Math.sin(x / 96 * TWO_PI * 2) * 2.5;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    });
  }

  /* the faint column of moving air in front of a fan */
  function airSprite() {
    return sprite('air', 128, 32, 0, (g) => {
      const lg = g.createLinearGradient(0, 0, 128, 0);
      lg.addColorStop(0, 'rgba(150,225,255,0.6)');
      lg.addColorStop(0.6, 'rgba(150,225,255,0.25)');
      lg.addColorStop(1, 'rgba(150,225,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, 128, 32);
      const vg = g.createLinearGradient(0, 0, 0, 32);
      vg.addColorStop(0, 'rgba(0,0,0,1)');
      vg.addColorStop(0.25, 'rgba(0,0,0,0)');
      vg.addColorStop(0.75, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = vg;
      g.fillRect(0, 0, 128, 32);
    });
  }

  function windSprite() {
    return sprite('wind', 40, 6, 0, (g) => {
      const lg = g.createLinearGradient(0, 0, 40, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.7, 'rgba(235,252,255,0.95)');
      lg.addColorStop(1, 'rgba(235,252,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, 1.5, 40, 3);
      g.fillStyle = 'rgba(40,90,120,0.35)';
      g.fillRect(4, 4.5, 34, 1);
    });
  }

  function drawZone(ctx, z, world, t) {
    if (z.kind === 'water') {
      const w = z.x1 - z.x0, h = z.y1 - z.y0;
      ctx.drawImage(waterSprite(w, h).c, z.x0, z.y0, w, h);
      const wv = waveSprite();
      ctx.save();
      ctx.beginPath();
      ctx.rect(z.x0, z.y0 - 8, w, 16);
      ctx.clip();
      for (let row = 0; row < 2; ++row) {
        const off = ((t * (row ? -24 : 34)) % 96 + 96) % 96;
        ctx.globalAlpha = row ? 0.5 : 0.9;
        for (let x = z.x0 - off; x < z.x1; x += 96)
          ctx.drawImage(wv.c, x, z.y0 - 6 + row * 4, 96, 12);
      }
      ctx.restore();
    } else if (z.kind === 'fan') {
      const col = airSprite();
      const ws = windSprite();
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.rotate(z.a);
      ctx.globalAlpha *= 0.75 + 0.1 * Math.sin(t * 7);
      ctx.drawImage(col.c, 0, -z.width / 2, z.len, z.width);
      ctx.globalAlpha = 1;
      for (let k = 0; k < 9; ++k) {
        const p = ((t * 1.4 + k * 0.29) % 1);
        const along = p * z.len, side = ((k * 37) % 9 - 4) / 4 * z.width * 0.38;
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
        ctx.drawImage(ws.c, along - 20, side - 3, 40 + 30 * (1 - p), 6);
      }
      ctx.restore();
    } else if (z.kind === 'magnet') {
      for (let k = 0; k < 3; ++k) {
        const p = ((t * 0.6 + k / 3) % 1);
        ctx.strokeStyle = 'rgba(255,110,110,' + (0.35 * p).toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius * (1 - p) + 22, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else if (z.kind === 'portal') {
      drawPortalMouth(ctx, z.ax, z.ay, z.aa, '#ff9a2a', t, 1);
      drawPortalMouth(ctx, z.bx, z.by, z.ba, '#3ab8ff', t, -1);
    }
  }

  /* ── inventory icons and part previews ── */

  function partIcon(type, world) {
    switch (type) {
      case 'plank': return plankSprite(world);
      case 'block': return blockSprite(world);
      case 'spring': return springSprite(world);
      case 'bumper': return bumperSprite(24, false);
      case 'fan': return fanSprite(world);
      case 'conveyor': return conveyorSprite(180, world);
      case 'magnet': return magnetSprite();
      case 'crate': return crateSprite(48, 48, world);
      case 'glass': return glassSprite(120, 14);
      case 'tnt': return tntSprite();
    }
    return plankSprite(world);
  }

  /* draws a placeable part at a placement { type, x, y, a } */
  function drawPart(ctx, p, world, t) {
    const a = (p.a || 0) * DEG;
    if (p.type === 'fan') {
      const fake = { x: p.x, y: p.y, a: a, data: { kind: 'fan' } };
      drawBody(ctx, fake, world, t);
      drawZone(ctx, { kind: 'fan', x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, a: a, len: 300, width: 70 }, world, t);
      return;
    }
    if (p.type === 'conveyor') {
      drawBody(ctx, { x: p.x, y: p.y, a: a, surface: 300, poly: { count: 4, verts: [-90, -9, 90, -9, 90, 9, -90, 9] }, data: { kind: 'conveyor' } }, world, t);
      return;
    }
    if (p.type === 'spring' || p.type === 'bumper') {
      drawBody(ctx, { x: p.x, y: p.y, a: a, r: 24, data: { kind: p.type } }, world, t);
      return;
    }
    if (p.type === 'magnet') {
      drawBody(ctx, { x: p.x, y: p.y, a: 0, data: { kind: 'magnet' } }, world, t);
      return;
    }
    const s = partIcon(p.type, world);
    blit(ctx, s, p.x, p.y, a);
  }

  SZ.PhysicsPuzzleArt = Object.freeze({
    setScale: setScale, get scale() { return getScale(); }, get cacheSize() { return cacheSize(); },
    drawBody: drawBody, drawZone: drawZone, drawBall: drawBall, drawTarget: drawTarget, drawStar: drawStar,
    drawLauncher: drawLauncher, drawPart: drawPart, partIcon: partIcon, drawGlow: drawGlow, glowSprite: glowSprite,
    isStaticArt: isStaticArt, staticSprite: staticSprite, blit: blit, starSprite: starSprite, targetSprite: targetSprite,
    rgba: rgba, shade: shade
  });
})();
