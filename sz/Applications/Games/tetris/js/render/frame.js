/* One frame: the letterboxed plane with screen shake, the realm backdrop (the run's realm, the
   map's realm or the festival's title world), then the screen - title, modes, map, game (board,
   HUD, juice), paused, results, tree, collection, journal, help - then a cinematic, the toasts,
   a confirmation, the flash and the vignette. Overlays reset the hit areas so only the top layer
   takes clicks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const W = NS.widgets;
  const { ctx } = NS.view;

  const MENUS = {
    title: () => NS.title.draw(), modes: () => NS.title.drawModes(), map: () => NS.map.draw(), tree: () => NS.tree.draw(),
    wardrobe: () => NS.wardrobe.draw(), journal: () => NS.journal.draw(), help: () => NS.help.draw(),
  };

  function world() {
    const s = G.screen;
    if (s === 'map') return G.ui.world;
    if (G.run && (s === 'game' || s === 'paused' || s === 'results')) return G.run.world || 0;
    return { frost: 1, bloom: 0, sunfest: 2, harvest: 3, hollow: 4, starfall: 4 }[G.season ? G.season.id : 'bloom'] || 0;
  }

  function dim(a) {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,16,' + a + ')';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  function drawGame() {
    const run = G.run;
    if (!run) return;
    NS.boardRender.drawBoard(run.game);
    NS.hud.draw();
    NS.fxRender.draw();
  }

  function draw() {
    W.beginFrame();
    NS.view.begin();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    const s = G.screen;
    NS.backdrop.draw(world());
    let danger = 0;
    if (s === 'game' || s === 'paused') {
      drawGame();
      if (G.run && G.run.game) danger = Math.max(0, Math.min(1, (NS.engine.stackHeight(G.run.game) - 13) / 4));
      if (s === 'paused') { W.beginFrame(); NS.pause.draw(); }
    } else if (s === 'results') {
      if (G.run) { NS.boardRender.drawBoard(G.run.game); }
      W.beginFrame();
      NS.results.draw();
      NS.fxRender.draw();
    } else if (MENUS[s]) {
      if (s !== 'title' && s !== 'map') dim(0.55);
      MENUS[s]();
      NS.fxRender.draw();
    }
    if (G.cine) {
      W.beginFrame();
      NS.cineRender.draw();
      NS.fxRender.draw();
    }
    NS.screens.drawToasts();
    if (G.ui.confirm) {
      W.beginFrame();
      NS.screens.drawConfirm();
    }
    NS.fxRender.drawFlash();
    NS.backdrop.drawVignette(danger);
  }

  Object.assign(NS.frame, { MENUS, world, draw });
})();
