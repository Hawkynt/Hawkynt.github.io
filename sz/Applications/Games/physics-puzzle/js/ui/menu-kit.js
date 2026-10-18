;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Menu helpers shared by the HUD and the menu screens: hit areas
   * registered while drawing (so mouse, touch and keyboard all work), the
   * hover and keyboard cursor, animated buttons, cursor moves, activation
   * and the dimming veil. Owns the hover animation levels; reads and writes
   * G.hitAreas and G.menuCursor, reads the pointer, G.state and G.time.
   */

  const G = NS.G;
  const ctx = G.ctx, ui = G.ui, Art = G.Art;

  function registerHit(id, x, y, w, h, action, disabled) {
    const index = G.hitAreas.length;
    G.hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!disabled });
    return index;
  }

  function isHot(index, x, y, w, h) {
    const hovered = G.mouseX >= x && G.mouseX <= x + w && G.mouseY >= y && G.mouseY <= y + h;
    if (hovered && G.pointerMoved)
      G.menuCursor = index;
    return hovered || (G.menuCursor === index && !G.pointerMoved && G.state !== 'play');
  }

  const hoverAnim = {};
  function hoverLevel(id, hot) {
    const v = hoverAnim[id] || 0;
    const nv = hot ? Math.min(1, v + G.frameDt * 8) : Math.max(0, v - G.frameDt * 5);
    hoverAnim[id] = nv;
    return nv;
  }

  function drawButton(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = registerHit(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h) && !opts.disabled;
    const hv = hoverLevel(id, hot);
    ctx.save();
    if (opts.disabled)
      ctx.globalAlpha *= 0.5;
    if (hv > 0) {
      const sc = 1 + 0.04 * hv;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(sc, sc);
      ctx.translate(-(x + w / 2), -(y + h / 2));
      Art.drawGlow(ctx, x + w / 2, y + h / 2, w * 1.3, opts.accent || '#4ad0e0', 0.35 * hv);
    }
    ui.drawButtonFrame(x, y, w, h, hot, opts.accent, G.time);
    let tx = x + w / 2;
    if (opts.icon) {
      opts.icon(x + 36, y + h / 2, Math.min(34, h - 14));
      tx += 18;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, tx, opts.sub ? y + h / 2 - 9 : y + h / 2 + 1, w - (opts.icon ? 96 : 40), opts.px || 20, { weight: 'bold', color: hot ? '#ffffff' : '#e4f0ff', font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.5)' });
    if (opts.sub)
      ui.fitText(opts.sub, tx, y + h - 14, w - (opts.icon ? 96 : 30), 12, { color: hot ? '#cfeeff' : ui.UI.textDim });
    if (opts.key)
      ui.drawKeycap(opts.key, x + w - 34, y + 7, 10);
    ctx.restore();
  }

  function moveCursor(d) {
    const hitAreas = G.hitAreas;
    const n = hitAreas.length;
    if (!n)
      return;
    let k = G.menuCursor;
    for (let i = 0; i < n; ++i) {
      k = (k + d + n) % n;
      if (!hitAreas[k].disabled && hitAreas[k].action)
        break;
    }
    G.menuCursor = k;
    G.sfx('click', { volume: 0.4 });
  }

  function activate(item) {
    if (!item || item.disabled || !item.action) {
      G.sfx('error', { volume: 0.4 });
      return;
    }
    G.sfx('select');
    item.action();
  }

  /* the topmost hit area under p */
  function hitAt(p) {
    const hitAreas = G.hitAreas;
    for (let i = hitAreas.length - 1; i >= 0; --i) {
      const h = hitAreas[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h)
        return h;
    }
    return null;
  }

  function veil(alpha) {
    const v = G.visibleRect();
    ctx.fillStyle = 'rgba(4,10,18,' + alpha + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  G.registerHit = registerHit;
  G.isHot = isHot;
  G.hoverLevel = hoverLevel;
  G.drawButton = drawButton;
  G.veil = veil;

  NS.menu = { registerHit: registerHit, isHot: isHot, hoverLevel: hoverLevel, drawButton: drawButton, moveCursor: moveCursor, activate: activate, hitAt: hitAt, veil: veil };
})();
