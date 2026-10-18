/*
 * Menu building blocks: dimmed background, per-frame hit areas, hover/keyboard
 * cursor, buttons, trophies, locks, track previews (geometry cached per variant),
 * stars and confetti drawing. Writes G.hitAreas / G.menuCursor.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H } = NS.constants;
  const { ctx, ui } = NS.runtime;
  const { drawFullBackground } = NS.view;

  const trackGeoCache = {};    // built geometry per track variant key

  function menuBackground() {
    if (G.trackArt)
      drawFullBackground(G.globalTime * 20, G.globalTime * 14, 1);
    else {
      ctx.fillStyle = '#0b0d1c';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    ctx.fillStyle = 'rgba(3,5,12,0.45)';
    ctx.fillRect(-G.viewOffX / G.viewScale, -G.viewOffY / G.viewScale, CANVAS_W + 2 * G.viewOffX / G.viewScale, CANVAS_H + 2 * G.viewOffY / G.viewScale);
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
    SZ.GameAudio.play('click', { volume: 0.5 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      SZ.GameAudio.play('error');
      return;
    }
    SZ.GameAudio.play('select');
    item.action();
  }

  /* Simple cup: trapezoid bowl, handles, stem and base */
  function drawTrophy(cx, cy, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.5, cy - size * 0.55);
    ctx.lineTo(cx + size * 0.5, cy - size * 0.55);
    ctx.lineTo(cx + size * 0.26, cy + size * 0.06);
    ctx.lineTo(cx - size * 0.26, cy + size * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.09;
    ctx.beginPath();
    ctx.arc(cx - size * 0.52, cy - size * 0.3, size * 0.17, Math.PI * 0.4, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + size * 0.52, cy - size * 0.3, size * 0.17, -Math.PI * 0.5, Math.PI * 0.6);
    ctx.stroke();
    ctx.fillRect(cx - size * 0.07, cy + size * 0.06, size * 0.14, size * 0.26);
    ctx.fillRect(cx - size * 0.24, cy + size * 0.32, size * 0.48, size * 0.12);
    ctx.restore();
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

  /* Built geometry per track variant, cached by key */
  function variantGeo(variant) {
    let g = trackGeoCache[variant.key];
    if (!g) {
      g = SZ.RacingTrack.build(variant);
      trackGeoCache[variant.key] = g;
    }
    return g;
  }

  /* Track outline fitted into a box: wide theme stripe, white line, start marker */
  function drawTrackPreview(variant, x, y, w, h, color) {
    const g = variantGeo(variant);
    const b = g.bounds;
    const pad = 140;
    const s = Math.min(w / (b.maxX - b.minX + pad), h / (b.maxY - b.minY + pad));
    const ox = x + (w - (b.maxX - b.minX) * s) / 2 - b.minX * s;
    const oy = y + (h - (b.maxY - b.minY) * s) / 2 - b.minY * s;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < g.points.length; ++i) {
      const px = g.points[i].x * s + ox;
      const py = g.points[i].y * s + oy;
      if (i === 0)
        ctx.moveTo(px, py);
      else
        ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = 10;
    ctx.strokeStyle = ui.hexToRgba(color, 0.3);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    const p0 = g.points[0], p1 = g.points[1];
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const sx = p0.x * s + ox, sy = p0.y * s + oy;
    ctx.strokeStyle = ui.UI.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - Math.sin(ang) * 9, sy + Math.cos(ang) * 9);
    ctx.lineTo(sx + Math.sin(ang) * 9, sy - Math.cos(ang) * 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawStars(cx, cy, count) {
    for (let i = 0; i < 4; ++i) {
      const x = cx + (i - 1.5) * 20;
      ctx.fillStyle = i < count ? ui.UI.gold : 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(x, cy - 7);
      ctx.lineTo(x + 7, cy);
      ctx.lineTo(x, cy + 7);
      ctx.lineTo(x - 7, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawConfetti() {
    for (let i = 0; i < G.confetti.length; ++i) {
      const c = G.confetti[i];
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
  }

  Object.assign(NS.module('menuKit'), {
    menuBackground, registerHit, isHot, drawButton, moveMenuCursor, activateMenuItem, drawTrophy, drawLock,
    variantGeo, drawTrackPreview, drawStars, drawConfetti
  });
})();
