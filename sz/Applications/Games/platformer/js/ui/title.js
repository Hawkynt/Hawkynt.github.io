/*
 * The title screen: a living diorama of a world, the logo and the mode buttons.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, VIEW_W, VIEW_H } = NS.config;
  const Prog = SZ.PlatformerProgress;
  const Spr = SZ.PlatformerSprites;
  const Scene = SZ.PlatformerScene;
  const Tiles = SZ.PlatformerTiles;
  const Fx = SZ.PlatformerFx;
  const Session = NS.module('session');
  const Menu = NS.module('menu');
  const MapScreen = NS.module('map');
  const Tree = NS.module('tree');
  const Wardrobe = NS.module('wardrobe');
  const Help = NS.module('help');
  const { visibleRect, bakeScale } = NS.module('view');
  const { formatTime, localDate } = NS.module('util');
  const { drawSprite, drawGlow } = NS.module('kit');
  const ctx = G.ctx;
  const ui = G.ui;
  const fxMenu = G.fxMenu;

  const dioramas = {};
  function diorama(world) {
    if (dioramas[world])
      return dioramas[world];
    const cols = 44, rows = 18;
    const tiles = new Uint8Array(cols * rows);
    for (let c = 0; c < cols; ++c) {
      const h = c % 22 > 15 && c % 22 < 19 ? 13 : 14;
      for (let r = h; r < rows; ++r)
        tiles[r * cols + c] = 1;
    }
    for (const [c0, r0, n] of [[5, 10, 4], [27, 9, 3], [36, 11, 3]])
      for (let k = 0; k < n; ++k)
        tiles[r0 * cols + c0 + k] = 2;
    const level = { cols: cols, rows: rows, tiles: tiles, world: world };
    dioramas[world] = { level: level, tiles: Tiles.create(level, { scale: bakeScale() }), w: cols * TS };
    return dioramas[world];
  }

  function drawTitle() {
    const world = Math.floor(G.time / 14) % 5;
    const d = diorama(world);
    const v = visibleRect();
    const camX = (G.time * 150) % d.w;
    const camY = 864 - 720;
    const sc = Scene.create(world);
    sc.drawBack(ctx, v, camX, camY, G.time);
    ctx.save();
    ctx.translate(-camX, -camY);
    for (const off of [0, d.w, -d.w]) {
      if (camX + v.x1 < off || camX + v.x0 > off + d.w)
        continue;
      ctx.save();
      ctx.translate(off, 0);
      const rect = { x0: camX + v.x0 - off, y0: camY + v.y0, x1: camX + v.x1 - off, y1: camY + v.y1 };
      d.tiles.draw(ctx, rect);
      ctx.restore();
    }
    /* the hero runs and hops, a foe trundles ahead, coins spin overhead */
    const heroX = camX + 430;
    const hopT = (G.time % 1.6) / 1.6;
    const hop = hopT < 0.45 ? Math.sin(hopT / 0.45 * Math.PI) * 120 : 0;
    const groundY = 14 * TS;
    const pose = hop > 0 ? (hopT < 0.22 ? 'jump' : 'fall') : 'run';
    drawSprite(Spr.hero(Session.currentSkin(), pose, Math.floor(G.time * 14) % (Spr.HERO_FRAMES[pose] || 1)), heroX, groundY - hop);
    if (hop === 0 && Math.random() < 0.3)
      Fx.dust(fxMenu, 430, groundY - camY, '#d8c8a0', 1, 1);
    const foeX = camX + 780 + Math.sin(G.time * 0.7) * 30;
    drawSprite(Spr.enemy(['walker', 'charger', 'hopper', 'spiky', 'walker'][world], world, Math.floor(G.time * 7) % 4, 'normal'), foeX, groundY, true);
    for (let k = 0; k < 5; ++k) {
      const cx = camX + 560 + k * 70 - ((G.time * 150) % 70);
      drawSprite(Spr.item('coin', Math.floor(G.time * 12 + k) % 8), cx, groundY - 170 - Math.sin(k * 0.9) * 20);
    }
    ctx.restore();
    sc.drawFront(ctx, v, camX, camY, G.time);
    fxMenu.update(G.frameDt);
    Fx.ambient(fxMenu, world, v, G.frameDt);
    fxMenu.draw(ctx);

    /* logo */
    const bob = Math.sin(G.time * 1.6) * 6;
    drawGlow(VIEW_W / 2, 120 + bob, 700, '#ffd75a', 0.25);
    ui.drawHeadline('PLATFORMER', VIEW_W / 2, 112 + bob, 900, 96, '#ffe9a0', '#ff8a2a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Five worlds, thirty levels, one brave wanderer', VIEW_W / 2, 182 + bob, 700, 20, { weight: 'bold', color: '#ffffff', outline: 'rgba(10,20,40,0.8)' });
    Menu.currencyChips(Math.min(v.x1, VIEW_W) - 20, Math.max(v.y0, 0) + 16);

    const stars = Prog.totalStars(G.save);
    const bx = VIEW_W / 2 - 300, by = 228;
    Menu.drawButton('adv', 'Adventure', bx, by, 290, 66, { icon: 'map', iconColor: '#7ad04a', sub: stars + ' / 90 stars', action: () => MapScreen.openMap('adventure'), accent: '#7ad04a' });
    Menu.drawButton('trial', 'Time Trial', bx + 310, by, 290, 66, { icon: 'clock', iconColor: '#5ad1ff', sub: 'race your best ghost', action: () => MapScreen.openMap('trial'), accent: '#5ad1ff', disabled: !Object.keys(G.save.levels).length });
    Menu.drawButton('endless', 'Endless', bx, by + 82, 290, 66, { icon: 'bolt', iconColor: '#ff8a3a', sub: G.save.endless.best ? 'best ' + G.save.endless.best.toLocaleString() : 'how far can you go?', action: () => Session.startEndless(null), accent: '#ff8a3a' });
    const daily = G.save.daily.date === localDate() && G.save.daily.bestTime ? 'today ' + formatTime(G.save.daily.bestTime) : 'a new course every day';
    Menu.drawButton('daily', 'Daily Run', bx + 310, by + 82, 290, 66, { icon: 'flag', iconColor: '#ffe08a', sub: daily, action: Session.startDaily, accent: '#ffe08a' });
    const tp = Prog.treeProgress(G.save);
    Menu.drawButton('tree', 'Tech Tree', bx, by + 164, 290, 66, { icon: 'star', iconColor: '#c88aff', sub: tp.have + ' / ' + tp.total + ' upgrades', action: () => Tree.openTree('title'), accent: '#c88aff' });
    Menu.drawButton('wardrobe', 'Wardrobe', bx + 310, by + 164, 290, 66, { icon: 'trophy', iconColor: '#ff6a86', sub: 'skins and trails', action: () => Wardrobe.openWardrobe('title'), accent: '#ff6a86' });
    Menu.drawButton('help', 'How to Play', VIEW_W / 2 - 145, by + 246, 290, 50, { icon: 'bolt', iconColor: '#bfe8ff', action: () => Help.openHelp('title'), key: 'H' });
    ui.drawKeyHints([{ key: 'Arrows', label: 'Choose' }, { key: 'Enter', label: 'Select' }, { key: 'H', label: 'Help' }], VIEW_W / 2, Math.min(v.y1, VIEW_H) - 24, 600, 1);
  }

  Object.assign(NS.module('title'), {
    drawTitle
  });
})();
