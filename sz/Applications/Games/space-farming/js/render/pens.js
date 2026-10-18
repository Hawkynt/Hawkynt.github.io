/* Space Farming - livestock pens with wandering animals, zapper arcs and the wild mice.
   Reads: G.farmGrid, G.livestockPens, G.currentSeason, G.wildAnimals, G.frameDt, G.animT */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, BASE_TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, LIVESTOCK, ctx, particles, drawSprite,
    uiFont, roundRectPath, zapArcs, lightAt, getFeedInterval } = NS;

  /* ── Livestock pens with wandering animals ── */

  const penAnim = new WeakMap();

  function animalState(pen) {
    let a = penAnim.get(pen);
    if (!a) {
      a = { x: (Math.random() - 0.5) * 0.3, dir: Math.random() < 0.5 ? -1 : 1, mode: 'idle', t: Math.random() * 2, hop: 0 };
      penAnim.set(pen, a);
    }
    return a;
  }

  function updatePenAnimals(dt) {
    for (const pen of G.livestockPens) {
      const a = animalState(pen);
      a.t -= dt;
      if (a.t <= 0) {
        const roll = Math.random();
        a.mode = roll < 0.45 ? 'walk' : (roll < 0.75 ? 'idle' : 'eat');
        a.t = 1 + Math.random() * 2.5;
        if (a.mode === 'walk' && Math.random() < 0.5)
          a.dir = -a.dir;
      }
      if (a.mode === 'walk') {
        a.x += a.dir * dt * 0.12;
        if (a.x > 0.22) { a.x = 0.22; a.dir = -1; }
        if (a.x < -0.22) { a.x = -0.22; a.dir = 1; }
      }
      a.hop = Math.max(0, a.hop - dt * 4);
    }
  }

  function drawPen(pen) {
    const T = BASE_TILE_SIZE;
    const def = LIVESTOCK[pen.typeIndex];
    const x = GRID_OFFSET_X + pen.gridCol * T, y = GRID_OFFSET_Y + pen.gridRow * T;
    const cx = x + T / 2, cy = y + T / 2;
    const winter = G.currentSeason === 3;
    // paddock floor
    ctx.fillStyle = winter ? '#d8e2ee' : '#8aa848';
    ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
    ctx.fillStyle = winter ? '#eef4fc' : '#d8b860';
    ctx.fillRect(x + 6, y + T - 14, 14, 6);
    ctx.fillStyle = winter ? '#c8d4e4' : '#c09a40';
    ctx.fillRect(x + 6, y + T - 10, 14, 2);
    // trough
    ctx.fillStyle = '#5e3820';
    ctx.fillRect(x + T - 20, y + T - 15, 14, 7);
    ctx.fillStyle = winter ? '#bfe0f0' : '#4a8ad8';
    ctx.fillRect(x + T - 18, y + T - 14, 10, 3);
    // posts and rails
    ctx.fillStyle = '#6e4228';
    ctx.fillRect(x + 2, y + 6, T - 4, 2);
    ctx.fillRect(x + 2, y + T - 4, T - 4, 2);
    ctx.fillRect(x + 2, y + 6, 2, T - 10);
    ctx.fillRect(x + T - 4, y + 6, 2, T - 10);
    ctx.fillStyle = '#4a2a16';
    for (const [px, py] of [[x + 1, y + 2], [x + T - 5, y + 2], [x + 1, y + T - 8], [x + T - 5, y + T - 8]])
      ctx.fillRect(px, py, 4, 8);

    const a = animalState(pen);
    const walking = a.mode === 'walk';
    const ax = cx + a.x * T;
    const bob = walking ? Math.abs(Math.sin(G.animT * 9 + pen.gridCol)) * 2.5 : (a.mode === 'idle' ? Math.sin(G.animT * 2) * 0.6 : 0);
    const size = 36;
    const baseY = cy + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ax, baseY, size * 0.3, 3, 0, 0, TWO_PI);
    ctx.fill();
    ctx.save();
    ctx.translate(ax, baseY - bob - a.hop * 6);
    // sprites face left; flip when walking right
    ctx.scale(a.dir > 0 ? -1 : 1, 1);
    if (a.mode === 'eat')
      ctx.rotate(-Math.abs(Math.sin(G.animT * 5)) * 0.12);
    drawSprite(def.sprite, 0, -size / 2, size);
    ctx.restore();
    if (def.sprite === 'bee')
      for (let k = 0; k < 4; ++k) {
        const ang = G.animT * (2 + k * 0.4) + k * 1.7;
        const bx = cx + Math.cos(ang) * (12 + k * 3), by = cy - 6 + Math.sin(ang * 1.3) * (8 + k);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(bx - 1.5, by - 1, 3, 2);
        ctx.fillStyle = 'rgba(220,240,255,0.8)';
        ctx.fillRect(bx - 1, by - 3, 2, 2);
      }

    if (pen.produceReady) {
      const by = y - 2 + Math.sin(G.animT * 4 + pen.gridCol) * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRectPath(cx - 11, by - 11, 22, 20, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 3, by + 9);
      ctx.lineTo(cx + 3, by + 9);
      ctx.lineTo(cx, by + 14);
      ctx.fill();
      drawSprite(def.produceSprite, cx, by - 1, 16);
      ctx.strokeStyle = `rgba(111,224,138,${0.5 + Math.sin(G.animT * 5) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
    } else {
      const prog = 1 - Math.max(0, pen.feedTimer / getFeedInterval(def));
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x + 8, y + T - 6, T - 16, 3);
      ctx.fillStyle = '#9df08a';
      ctx.fillRect(x + 8, y + T - 6, (T - 16) * prog, 3);
    }
    lightAt(x + 4, y + 4, T * 0.5, '#ffc870', 0.45);
  }

  function drawZapArcs() {
    for (let i = zapArcs.length - 1; i >= 0; --i) {
      const z = zapArcs[i];
      z.t += G.frameDt;
      if (z.t > 0.3) {
        zapArcs.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(z.x0, z.y0);
      for (let k = 1; k < 6; ++k)
        ctx.lineTo(z.x0 + (z.x1 - z.x0) * k / 6 + (Math.random() - 0.5) * 14, z.y0 + (z.y1 - z.y0) * k / 6 + (Math.random() - 0.5) * 14);
      ctx.lineTo(z.x1, z.y1);
      // soft halo as a wide faint stroke under the bright core
      ctx.strokeStyle = `rgba(159,240,255,${0.3 * (1 - z.t / 0.3)})`;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = `rgba(190,248,255,${1 - z.t / 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ── Wild space mice ── */

  function drawMice() {
    const T = BASE_TILE_SIZE;
    for (const m of G.wildAnimals) {
      if (m.rx === undefined) {
        m.rx = m.x;
        m.ry = m.y;
        m.face = 1;
      }
      const k = Math.min(1, G.frameDt * 6);
      const dx = m.x - m.rx;
      if (Math.abs(dx) > 0.01) m.face = dx > 0 ? -1 : 1;
      m.rx += (m.x - m.rx) * k;
      m.ry += (m.y - m.ry) * k;
      const moving = Math.hypot(m.x - m.rx, m.y - m.ry) > 0.02;
      const cx = GRID_OFFSET_X + (m.rx + 0.5) * T, cy = GRID_OFFSET_Y + (m.ry + 0.5) * T;
      const hop = moving ? Math.abs(Math.sin(G.animT * 14 + m.x)) * 4 : 0;
      const ar = Math.round(m.y), ac = Math.round(m.x);
      let nearCrop = false;
      for (let dr = -1; dr <= 1 && !nearCrop; ++dr)
        for (let dc = -1; dc <= 1 && !nearCrop; ++dc)
          if (G.farmGrid[ar + dr]?.[ac + dc]) nearCrop = true;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 9, 3, 0, 0, TWO_PI);
      ctx.fill();
      ctx.save();
      ctx.translate(cx, cy + 10 - hop);
      ctx.scale(m.face, 1);
      drawSprite('mouse', 0, -12, 26);
      ctx.restore();
      if (nearCrop) {
        const a = 0.6 + Math.sin(G.animT * 8) * 0.3;
        ctx.fillStyle = `rgba(255,80,80,${a})`;
        ctx.font = uiFont(14, 'bold');
        ctx.textAlign = 'center';
        ctx.fillText('!', cx, cy - 14 - hop);
      }
      if (moving && Math.random() < 0.08)
        particles.burst(cx, cy + 10, 1, { color: G.currentSeason === 3 ? '#ffffff' : '#c8b088', speed: 0.6, life: 0.4, size: 2 });
    }
  }

  Object.assign(NS, { updatePenAnimals, drawPen, drawZapArcs, drawMice });

})();
