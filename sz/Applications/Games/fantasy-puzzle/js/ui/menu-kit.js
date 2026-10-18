/* Menu hit areas, keyboard cursor, hover easing and the shared button. Owns G.hitAreas and
   G.menuCursor. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { sfx, ctx, ui, Fx } = NS.context;

  /* ── shared menu widgets ── */

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

  function moveMenuCursor(d) {
    const n = G.hitAreas.length;
    if (!n)
      return;
    G.menuCursor = (G.menuCursor + d + n) % n;
    sfx('click', { volume: 0.4 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error', { volume: 0.4 });
      return;
    }
    sfx('select');
    item.action();
  }

  /* hover glow per button, eased so buttons light up and fade out smoothly */
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
      ctx.globalAlpha *= 0.55;
    if (hv > 0) {
      const sc = 1 + 0.035 * hv;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(sc, sc);
      ctx.translate(-(x + w / 2), -(y + h / 2));
      /* a warm glow behind the hot button */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.45 * hv;
      ctx.drawImage(Fx.sprite('glow', '#ffb84a'), x - 30, y - h * 0.6, w + 60, h * 2.2);
      ctx.restore();
    }
    ui.drawButtonFrame(x, y, w, h, hot, opts.accent, G.time);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, x + w / 2, opts.sub ? y + h / 2 - 8 : y + h / 2 + 1, w - 48, opts.px || 18, { weight: 'bold', color: hot ? '#fff6dc' : '#e8dcc0', font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.5)' });
    if (opts.sub)
      ui.fitText(opts.sub, x + w / 2, y + h - 12, w - 24, 11, { color: hot ? '#d8c890' : ui.UI.textDim });
    if (opts.key)
      ui.drawKeycap(opts.key, x + w - 44, y + 6, 10);
    ctx.restore();
  }

  NS.menu = { registerHit, isHot, moveMenuCursor, activateMenuItem, hoverLevel, drawButton };
})();
