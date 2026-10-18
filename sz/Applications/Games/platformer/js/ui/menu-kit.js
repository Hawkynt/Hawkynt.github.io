/*
 * The menu kit: hit areas, the keyboard cursor, animated buttons, veils, the animated menu backdrop
 * and the currency chips.
 * Owns G.hitAreas, G.menuCursor; reads G.mouseX, G.mouseY, G.pointerMoved.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const Spr = SZ.PlatformerSprites;
  const Scene = SZ.PlatformerScene;
  const Fx = SZ.PlatformerFx;
  const { sfx } = NS.module('sound');
  const { visibleRect } = NS.module('view');
  const { drawSprite, glowSprite, drawIcon } = NS.module('kit');
  const ctx = G.ctx;
  const ui = G.ui;
  const fxMenu = G.fxMenu;
  const hitAreas = G.hitAreas;

  function registerHit(id, x, y, w, h, action, disabled) {
    const index = hitAreas.length;
    hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!disabled });
    return index;
  }

  function isHot(index, x, y, w, h) {
    const hovered = G.mouseX >= x && G.mouseX <= x + w && G.mouseY >= y && G.mouseY <= y + h;
    if (hovered && G.pointerMoved)
      G.menuCursor = index;
    return hovered || G.menuCursor === index;
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
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.4 * hv;
      ctx.drawImage(glowSprite(opts.accent || '#5ab8ff'), x - 30, y - h * 0.6, w + 60, h * 2.2);
      ctx.restore();
    }
    ui.drawButtonFrame(x, y, w, h, hot, opts.accent, G.time);
    let tx = x + w / 2;
    if (opts.icon) {
      drawIcon(opts.icon, opts.iconColor || '#ffd75a', x + 34, y + h / 2, Math.min(34, h - 14));
      tx += 16;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, tx, opts.sub ? y + h / 2 - 9 : y + h / 2 + 1, w - (opts.icon ? 90 : 40), opts.px || 20, { weight: 'bold', color: hot ? '#ffffff' : '#e4ecff', font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.5)' });
    if (opts.sub)
      ui.fitText(opts.sub, tx, y + h - 14, w - (opts.icon ? 90 : 30), 12, { color: hot ? '#cfe4ff' : ui.UI.textDim });
    if (opts.key)
      ui.drawKeycap(opts.key, x + w - 34, y + 7, 10);
    ctx.restore();
  }

  function moveCursor(d) {
    const n = hitAreas.length;
    if (!n)
      return;
    let k = G.menuCursor;
    for (let i = 0; i < n; ++i) {
      k = (k + d + n) % n;
      if (!hitAreas[k].disabled)
        break;
    }
    G.menuCursor = k;
    sfx('click', { volume: 0.4 });
  }

  function activate(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error', { volume: 0.4 });
      return;
    }
    sfx('select');
    item.action();
  }

  function veil(alpha) {
    const v = visibleRect();
    ctx.fillStyle = 'rgba(6,10,24,' + alpha + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  function menuBackdrop(world, alpha) {
    const v = visibleRect();
    Scene.create(world).drawMenu(ctx, v, G.time);
    fxMenu.update(G.frameDt);
    Fx.ambient(fxMenu, world, v, G.frameDt);
    fxMenu.draw(ctx);
    if (alpha)
      veil(alpha);
  }

  function currencyChips(x, y) {
    ctx.font = ui.uiFont(18, 'bold');
    const gemsText = String(G.save.gems), coinText = G.save.coins.toLocaleString();
    const gw = Math.max(70, ctx.measureText(gemsText).width + 56);
    const cw = Math.max(90, ctx.measureText(coinText).width + 56);
    ui.drawPanel(x - gw, y, gw, 40, { radius: 14, noStuds: true });
    drawSprite(Spr.item('gem', Math.floor(G.time * 6) % 6, 1), x - gw + 22, y + 20, false, 0.7, 0.7);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(gemsText, x - gw + 40, y + 21, gw - 48, 18, { weight: 'bold', color: '#bfffd0' });
    ui.drawPanel(x - gw - cw - 10, y, cw, 40, { radius: 14, noStuds: true });
    drawIcon('coin', '#ffd75a', x - gw - cw + 12, y + 20, 24);
    ui.fitText(coinText, x - gw - cw + 30, y + 21, cw - 38, 18, { weight: 'bold', color: '#ffe9a0' });
  }

  Object.assign(NS.module('menu'), {
    registerHit,
    isHot,
    drawButton,
    moveCursor,
    activate,
    veil,
    menuBackdrop,
    currencyChips
  });
})();
