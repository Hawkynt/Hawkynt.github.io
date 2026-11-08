/* One frame: the letterboxed plane with screen shake, the land backdrop, then the screen - title,
   modes, map, game (field, HUD, juice), paused, results, tree, collection, journal, help - then a
   cinematic, the toasts, a confirmation, the flash and the vignette (red while a guardian's fuse runs
   low). Overlays reset the hit areas so only the top layer takes clicks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;
  const W = NS.widgets;
  const { ctx } = NS.view;

  const MENUS = {
    title: () => NS.title.draw(), modes: () => NS.title.drawModes(), classic: () => NS.title.drawClassic(), map: () => NS.map.draw(), tree: () => NS.tree.draw(),
    wardrobe: () => NS.wardrobe.draw(), journal: () => NS.journal.draw(), help: () => NS.help.draw(),
  };

  function world() {
    const s = G.screen;
    if (s === 'map') return G.ui.world;
    if (G.run && (s === 'game' || s === 'paused' || s === 'results')) return G.run.world || 0;
    return { frost: 1, bloom: 0, sunfest: 3, harvest: 2, hollow: 4, starfall: 4 }[G.season ? G.season.id : 'bloom'] || 0;
  }

  function dim(a) {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(4,2,12,' + a + ')';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  function draw() {
    W.beginFrame();
    NS.view.begin();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    const s = G.screen;
    NS.backdrop.draw(world());
    let danger = 0;
    if ((s === 'game' || s === 'paused') && G.run) {
      const run = G.run, inp = G.input;
      NS.boardRender.draw(run.game, { hover: inp.touch ? -1 : inp.hoverCell, cursor: inp.cursor, pressed: s === 'game' ? NS.input.pressedCells() : null, dark: run.dark && s === 'game' });
      NS.hud.draw();
      NS.fxRender.draw();
      if (run.bossState && run.bossState.fuse < 30 && run.game.state === 'play') danger = 0.6 - run.bossState.fuse / 60;
      if (s === 'paused') { W.beginFrame(); NS.pause.draw(); }
    } else if (s === 'results') {
      if (G.run) NS.boardRender.draw(G.run.game, {});
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
