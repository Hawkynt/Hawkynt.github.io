/* Menu widgets drawn every frame: clickable hit areas with the shared keyboard cursor, buttons,
   locks, stars, ticks and crosses. Owns G.hitAreas and G.menuCursor; reads the mouse in G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { playSfx } = NS.audio;
  const { ctx, ui } = NS.view;

  function drawStarShape(cx, cy, r, earned) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; ++i) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = earned ? ui.UI.gold : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = earned ? ui.UI.goldDeep : ui.UI.textMute;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawTick(x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x - 2, y + 6);
    ctx.lineTo(x + 8, y - 7);
    ctx.stroke();
    ctx.restore();
  }

  function drawCross(x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 6);
    ctx.lineTo(x + 6, y + 6);
    ctx.moveTo(x + 6, y - 6);
    ctx.lineTo(x - 6, y + 6);
    ctx.stroke();
    ctx.restore();
  }

  /* Register one clickable / keyboard-selectable item for this frame */
  function registerHit(id, x, y, w, h, action, disabled) {
    const index = G.hitAreas.length;
    G.hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!disabled });
    return index;
  }

  /* True when the keyboard cursor or the mouse rests on the item; hovering selects it */
  function isHot(index, x, y, w, h) {
    const hovered = G.mouseX >= x && G.mouseX <= x + w && G.mouseY >= y && G.mouseY <= y + h;
    if (hovered)
      G.menuCursor = index;
    return hovered || G.menuCursor === index;
  }

  function drawButton(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = registerHit(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h);
    ctx.save();
    if (opts.disabled)
      ctx.globalAlpha *= 0.55;
    if (hot) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(1.03, 1.03);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    ui.drawPanel(x, y, w, h, {
      radius: 10,
      noStuds: true,
      accent: hot ? ui.UI.gold : (opts.accent || ui.UI.accent),
      glow: hot,
      top: hot ? 'rgba(36,46,76,0.96)' : undefined,
      bottom: hot ? 'rgba(15,19,36,0.96)' : undefined
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, x + w / 2, opts.sub ? y + h / 2 - 8 : y + h / 2 + 1, w - 24, opts.px || 20, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
    if (opts.sub)
      ui.fitText(opts.sub, x + w / 2, y + h - 11, w - 24, 11, { color: ui.UI.textDim });
    ctx.restore();
  }

  function moveMenuCursor(d) {
    const n = G.hitAreas.length;
    if (!n) return;
    G.menuCursor = (G.menuCursor + d + n) % n;
    playSfx('click', { volume: 0.4 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      playSfx('error');
      return;
    }
    playSfx('select');
    item.action();
  }

  function drawLock(cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = size * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.12, size * 0.3, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#c8d0e0';
    ui.roundRectPath(cx - size * 0.4, cy - size * 0.12, size * 0.8, size * 0.6, size * 0.1);
    ctx.fill();
    ctx.restore();
  }

  function romanNumeral(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }

  Object.assign(NS.widgets, {
    drawStarShape, drawTick, drawCross, drawButton, registerHit, isHot, moveMenuCursor, activateMenuItem,
    drawLock, romanNumeral
  });
})();
