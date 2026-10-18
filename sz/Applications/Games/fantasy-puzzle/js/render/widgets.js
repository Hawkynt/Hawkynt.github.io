/* Small shared painters: locks, crystals, stars, veils, the shards chip, menu backdrops and light
   shafts. Reads G.time and G.save. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { ctx, ui } = NS.context;
  const { visibleRect } = NS.view;
  const { raySprite } = NS.sprites;

  /* ── realm scenes, one cached instance per realm ── */
  const sceneCache = {};

  function getScene(realm) {
    const key = realm | 0;
    if (!sceneCache[key])
      sceneCache[key] = SZ.PuzzleScene.create(key);
    return sceneCache[key];
  }

  /* the realm scene over the whole visible area plus a soft dark veil */
  function drawMenuBackdrop(realm, veil) {
    const v = visibleRect();
    getScene(realm).draw(ctx, G.time, v);
    ctx.fillStyle = veil || 'rgba(4,6,14,0.55)';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  function drawLock(cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = '#b89858';
    ctx.lineWidth = size * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.12, size * 0.3, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#e0c070';
    ui.roundRectPath(cx - size * 0.4, cy - size * 0.12, size * 0.8, size * 0.6, size * 0.1);
    ctx.fill();
    ctx.restore();
  }

  function starPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; ++i) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      if (i === 0)
        ctx.moveTo(x, y);
      else
        ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function fillVeil(alpha) {
    const v = visibleRect();
    ctx.fillStyle = alpha;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  function easeOutBack(k) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  }

  function drawCrystal(cx, cy, s, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.7, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.7, cy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
  }

  /* the shards counter with its crystal, right-aligned at x */
  function drawShardsChip(x, y) {
    const w = ui.drawChip(G.save.shards + ' shards', x, y, 30, { align: 'right', color: '#8fd0ff', border: 'rgba(90,184,255,0.35)' });
    drawCrystal(x - w - 14, y + 15, 8, '#8fd0ff');
  }

  /* soft light shafts from the top of the screen and a dark vignette */
  function drawMenuLight(color) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 + 0.04 * Math.sin(G.time * 0.7);
    ctx.translate(640, -120);
    ctx.rotate(Math.sin(G.time * 0.15) * 0.12);
    ctx.drawImage(raySprite(), -700, -700, 1400, 1400);
    ctx.restore();
  }

  NS.widgets = { getScene, drawMenuBackdrop, drawLock, starPath, fillVeil, easeOutBack, drawCrystal,
    drawShardsChip, drawMenuLight };
})();
