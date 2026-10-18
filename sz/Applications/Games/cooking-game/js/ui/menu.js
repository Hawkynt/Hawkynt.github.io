;(function() {
  'use strict';

  /* Menu plumbing shared by every screen: switching screens, the per-frame
     hit areas with keyboard cursor and hover, candy buttons, the scene
     backdrops and the coin chip. Owns G.hitAreas and G.menuCursor. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { STATE_TITLE, STATE_UPGRADES, STATE_HELP } = NS.C;
  const { ctx, ui, visibleRect } = NS.view;
  const { fx, sfx } = NS.juice;
  const { isMenuState } = NS.rules;
  const { updateWindowTitle, updateStatus } = NS.status;
  const { cachedSprite } = NS.sprites;

  const menuScenes = {};

  function setScreen(name) {
    G.state = name;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    G.menuFade = 0.5;
    G.fade = 1;
    if (name === STATE_UPGRADES)
      G.treeLayout = NS.treeScreen.buildTreeLayout();
    updateWindowTitle();
    updateStatus();
  }

  function openHelp() {
    G.helpFrom = isMenuState(G.state) ? G.state : STATE_TITLE;
    G.helpPage = 0;
    setScreen(STATE_HELP);
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

  /* A candy button: glossy face over a 3D lip; the hot one grows, bobs and
     glows. opts: color ('orange' | 'green' | 'red' | 'blue' | 'gold' | 'wood'),
     sub, px, disabled, action */
  function drawButton(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = registerHit(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h) && !opts.disabled;
    const pressed = hot && G.mouseDown;
    const s = hot ? 1.05 + Math.sin(G.animT * 6) * 0.012 : 1;
    const bob = opts.bob !== undefined ? Math.sin(G.animT * 2.2 + opts.bob * 0.9) * 1.5 : 0;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2 + bob);
    ctx.scale(s, s);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    if (hot) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ui.drawGlow(x + w / 2, y + h / 2, Math.max(w, h) * 1.25, '#ffc860');
      ctx.restore();
    }
    ui.drawButtonFace(x, y, w, h, label, { color: opts.color || 'orange', hot: hot, pressed: pressed, disabled: opts.disabled, sub: opts.sub, px: opts.px });
    ctx.restore();
  }

  function moveMenuCursor(d) {
    const n = G.hitAreas.length;
    if (!n) return;
    G.menuCursor = (Math.min(G.menuCursor, n - 1) + d + n) % n;
    sfx('click', { volume: 0.4 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error', { volume: 0.5 });
      return;
    }
    sfx('select');
    item.action();
  }

  /* One cached interior per theme, reused by every menu screen. */
  function menuScene(theme) {
    if (!menuScenes[theme])
      menuScenes[theme] = SZ.KitchenScene.create(theme);
    return menuScenes[theme];
  }

  /* Menu background: a location scene over the whole visible area, softened
     by a dark overlay so panels and text stay readable. */
  function drawMenuBackdrop(theme, alpha) {
    const v = visibleRect();
    menuScene(theme).draw(ctx, G.animT, v);
    menuScene(theme).drawFront(ctx);
    ctx.fillStyle = 'rgba(8,6,4,' + alpha + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    /* the kitchen line sinks into shadow so the menu owns the screen */
    const fadeImg = cachedSprite('menufade', 4, 128, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(10,5,2,0)');
      g.addColorStop(0.6, 'rgba(10,5,2,0.75)');
      g.addColorStop(1, 'rgba(10,5,2,0.92)');
      c.fillStyle = g;
      c.fillRect(0, 0, 4, 128);
    });
    ctx.drawImage(fadeImg, v.x0, 520, v.x1 - v.x0, Math.max(200, v.y1 - 520));
  }

  function drawCoinChip(x, y, amount) {
    const w = ui.drawChip('     $' + amount, x, y, 36, { align: 'right', px: 19, color: ui.UI.gold, bg: 'rgba(30,12,2,0.85)', border: '#e0b048' });
    const coin = fx.coinFrame(G.animT % 3 < 0.75 ? Math.floor(G.animT * 8) : 0);
    if (coin) ctx.drawImage(coin, x - w + 4, y + 3, 30, 30);
  }

  NS.menu = { menuScene, setScreen, openHelp, registerHit, isHot, drawButton, moveMenuCursor,
    activateMenuItem, drawMenuBackdrop, drawCoinChip };

})();
