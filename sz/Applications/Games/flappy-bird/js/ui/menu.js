;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Shared menu machinery: hit areas rebuilt each frame, the keyboard/mouse cursor, buttons
     and the cycling biome backdrop. Owns G.hitAreas, G.menuCursor, G.menuBiomeIndex/At. */

  const { STATE_TITLE, STATE_WORLDS, STATE_NEST, STATE_AVIARY, STATE_HELP, STATE_DEAD, STATE_CLEAR } = NS.C;
  const { ctx, ui, sfx } = NS.services;
  const G = NS.state;
  const View = NS.view;
  const FxDraw = NS.fxDraw;

  function isMenuState(s) {
    return s === STATE_TITLE || s === STATE_WORLDS || s === STATE_NEST ||
      s === STATE_AVIARY || s === STATE_HELP || s === STATE_DEAD || s === STATE_CLEAR;
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
    if (!n)
      return;
    G.menuCursor = (G.menuCursor + d + n) % n;
    sfx('click', { volume: 0.4 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error');
      return;
    }
    sfx('select');
    item.action();
  }

  function drawMenuBackground() {
    if (G.globalTime - G.menuBiomeAt >= 12) {
      G.menuBiomeAt = G.globalTime;
      G.menuBiomeIndex = (G.menuBiomeIndex + 1) % SZ.FlappyCourse.BIOME_ORDER.length;
    }
    const ms = View.sceneFor(SZ.FlappyCourse.BIOME_ORDER[G.menuBiomeIndex]);
    const v = View.visibleRect();
    ms.drawSky(ctx, v);
    ms.drawBackdrop(ctx, G.globalTime * 60, G.globalTime, v);
    FxDraw.drawWeather('back');
    ms.drawGround(ctx, G.globalTime * 60, v);
    FxDraw.drawWeather('front');
    ctx.fillStyle = 'rgba(6, 10, 24, 0.35)';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  Object.assign(NS.menu, {
    isMenuState, registerHit, isHot, drawButton, moveMenuCursor, activateMenuItem, drawMenuBackground
  });
})();
