/* Dialogue between chapters as comic panels: painted portraits of the cast (Nova in her helmet,
   KITE's hologram, Commander Varga, the Shardmind's crystal face) on alternating sides, a name
   plate and typewriter text over the chapter backdrop. A click, tap or key finishes the line or
   moves on; Esc skips the scene. Owns G.story. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { UI, TAU, VIEW_W } = NS.constants;
  const { CAST } = NS.campaign;
  const K = NS.artKit;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;
  const { sfx } = NS.audio;

  const CPS = 52;

  function show(lines, onEnd, title) {
    G.story = { lines: lines, i: 0, t: 0, onEnd: onEnd, title: title || '' };
    NS.screens.setScreen('story');
  }

  function update(dt) {
    const s = G.story;
    if (!s) return;
    const before = Math.floor(s.t * CPS);
    s.t += dt;
    const line = s.lines[s.i];
    if (line && Math.floor(s.t * CPS) > before && before < line[1].length && before % 3 === 0)
      sfx('click', { volume: 0.12, pitch: line[0] === 'shard' ? 0.5 : line[0] === 'kite' ? 1.6 : 1.1 });
  }

  function advance() {
    const s = G.story;
    if (!s) return;
    const line = s.lines[s.i];
    if (line && s.t * CPS < line[1].length) {
      s.t = line[1].length / CPS + 0.01;
      return;
    }
    ++s.i;
    s.t = 0;
    if (s.i >= s.lines.length) end();
    else sfx('blip', { volume: 0.3 });
  }

  function end() {
    const s = G.story;
    G.story = null;
    if (s && s.onEnd) s.onEnd();
    else NS.screens.setScreen('title');
  }

  /* ── portraits ── */
  function portrait(id) {
    const c = CAST[id];
    return K.sprite('portrait:' + id, 200, 220, (g, w, h) => {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, K.shade(c.col, -0.55));
      bg.addColorStop(1, '#05070e');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      /* halftone dots for the comic look */
      g.fillStyle = K.rgba(c.col, 0.12);
      for (let y = 6; y < h; y += 9)
        for (let x = (y / 9) % 2 ? 6 : 10; x < w; x += 9) {
          g.beginPath();
          g.arc(x, y, 1.6 * (1 - y / h) + 0.4, 0, TAU);
          g.fill();
        }
      const cx = w / 2, cy = h * 0.52;
      if (id === 'kite') {
        g.strokeStyle = K.rgba(c.col, 0.9);
        g.lineWidth = 3;
        g.beginPath();
        g.arc(cx, cy, 60, 0, TAU);
        g.stroke();
        g.lineWidth = 2;
        g.beginPath();
        for (let x = -50; x <= 50; x += 2) {
          const y = Math.sin(x * 0.18) * 22 * Math.cos(x / 50 * Math.PI / 2);
          if (x === -50) g.moveTo(cx + x, cy + y); else g.lineTo(cx + x, cy + y);
        }
        g.stroke();
        g.fillStyle = K.rgba(c.col, 0.15);
        g.beginPath();
        g.arc(cx, cy, 70, 0, TAU);
        g.fill();
        return;
      }
      if (id === 'shard') {
        g.fillStyle = '#2a0610';
        K.poly(g, [[cx, cy - 90], [cx + 50, cy - 40], [cx + 70, cy + 30], [cx + 20, cy + 95], [cx - 30, cy + 90], [cx - 75, cy + 20], [cx - 45, cy - 50]]);
        g.fill();
        g.strokeStyle = '#ff4a6a';
        g.lineWidth = 2;
        g.stroke();
        g.strokeStyle = 'rgba(255,74,106,0.5)';
        for (let i = 0; i < 7; ++i) {
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(i * 0.9) * 80, cy + Math.sin(i * 0.9) * 90);
          g.stroke();
        }
        NS.enemyArt.eye(g, cx, cy - 10, 26, '#ff4a6a', '#300008');
        return;
      }
      /* a pilot or officer: shoulders, neck, helmet or hair, face, visor */
      g.fillStyle = id === 'varga' ? '#2a3450' : '#3a4a6a';
      g.beginPath();
      g.moveTo(cx - 90, h);
      g.quadraticCurveTo(cx - 80, cy + 50, cx, cy + 46);
      g.quadraticCurveTo(cx + 80, cy + 50, cx + 90, h);
      g.fill();
      g.fillStyle = K.rgba(c.col, 0.8);
      g.fillRect(cx - 70, cy + 70, 30, 6);
      g.fillStyle = '#c89a78';
      g.fillRect(cx - 14, cy + 20, 28, 30);
      if (id === 'nova') {
        const hg = g.createRadialGradient(cx - 20, cy - 40, 5, cx, cy - 10, 70);
        hg.addColorStop(0, '#ffffff');
        hg.addColorStop(0.4, '#c8d8f0');
        hg.addColorStop(1, '#3a4a6a');
        g.fillStyle = hg;
        g.beginPath();
        g.arc(cx, cy - 12, 62, 0, TAU);
        g.fill();
        g.fillStyle = '#d8a888';
        g.beginPath();
        g.ellipse(cx, cy - 6, 34, 40, 0, 0, TAU);
        g.fill();
        g.fillStyle = c.hair;
        g.beginPath();
        g.ellipse(cx - 4, cy - 38, 34, 16, -0.2, 0, TAU);
        g.fill();
        const vg = g.createLinearGradient(cx - 40, cy - 30, cx + 40, cy);
        vg.addColorStop(0, K.rgba(c.visor, 0.25));
        vg.addColorStop(1, K.rgba(c.visor, 0.05));
        g.fillStyle = vg;
        g.beginPath();
        g.ellipse(cx, cy - 10, 48, 50, 0, 0, TAU);
        g.fill();
        g.strokeStyle = c.col;
        g.lineWidth = 3;
        g.stroke();
      } else {
        g.fillStyle = '#d0a080';
        g.beginPath();
        g.ellipse(cx, cy - 10, 36, 44, 0, 0, TAU);
        g.fill();
        g.fillStyle = c.hair;
        g.beginPath();
        g.ellipse(cx, cy - 46, 40, 20, 0, Math.PI, TAU);
        g.fill();
        g.fillRect(cx - 40, cy - 46, 10, 40);
        g.fillRect(cx + 30, cy - 46, 10, 40);
        g.fillStyle = c.col;
        g.beginPath();
        g.arc(cx + 50, cy + 70, 8, 0, TAU);
        g.fill();
      }
      /* eyes and mouth */
      g.fillStyle = '#1a1010';
      g.beginPath();
      g.ellipse(cx - 13, cy - 10, 4, 3, 0, 0, TAU);
      g.ellipse(cx + 13, cy - 10, 4, 3, 0, 0, TAU);
      g.fill();
      g.strokeStyle = '#6a3a30';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - 9, cy + 16);
      g.quadraticCurveTo(cx, cy + 20, cx + 9, cy + 16);
      g.stroke();
    });
  }

  function draw() {
    const s = G.story;
    if (!s) return;
    const v = visible();
    ctx.fillStyle = 'rgba(2,4,12,0.55)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const line = s.lines[Math.min(s.i, s.lines.length - 1)];
    const who = line[0];
    const c = CAST[who];
    const left = who === 'nova' || who === 'kite';
    const px = left ? 120 : VIEW_W - 320;
    const pop = Math.min(1, s.t * 6);
    if (s.title) kit.text(s.title.toUpperCase(), VIEW_W / 2, 60, 16, UI.textDim, { align: 'center', weight: 'bold' });
    /* the comic panel */
    ctx.save();
    ctx.translate(px + 100, 330);
    ctx.rotate(left ? -0.02 : 0.02);
    ctx.scale(0.9 + pop * 0.1, 0.9 + pop * 0.1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-108, -118, 216, 236);
    K.blit(ctx, portrait(who), 0, 0, 1);
    ctx.restore();
    /* the speech box */
    const bx = left ? 360 : 120, bw = 800;
    kit.panel(bx, 250, bw, 170, { accent: c.col, glow: true });
    kit.text(c.name, bx + 24, 278, 20, c.col, { weight: 'bold' });
    kit.text(c.role, bx + 24 + ctx.measureText(c.name).width + 46, 279, 13, UI.textDim);
    const n = Math.min(line[1].length, Math.floor(s.t * CPS));
    kit.wrap(line[1].slice(0, n), bx + 24, 304, bw - 48, 20, 28, '#ffffff');
    const done = n >= line[1].length;
    if (done && Math.sin(G.time * 6) > -0.3) kit.text(s.i < s.lines.length - 1 ? 'Next  >' : 'Continue  >', bx + bw - 24, 400, 13, UI.gold, { align: 'right', weight: 'bold' });
    for (let i = 0; i < s.lines.length; ++i) {
      ctx.fillStyle = i <= s.i ? c.col : 'rgba(255,255,255,0.2)';
      ctx.fillRect(VIEW_W / 2 - s.lines.length * 9 + i * 18, 450, 12, 3);
    }
    ctx.globalAlpha = 0.5;
    kit.text('Click, tap or any key to continue  -  Esc skips', VIEW_W / 2, 690, 12, UI.textDim, { align: 'center' });
    ctx.globalAlpha = 1;
    NS.widgets.area('story', v.x0, v.y0, v.w, v.h, advance);
  }

  Object.assign(NS.story, {
    show, update, advance, end, draw, portrait
  });
})();
