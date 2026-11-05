/* One rendered frame: the board of the run or the title demo (with scenery bleeding into the
   letterbox), the HUD while a run is open, the active screen on top, touch buttons, flash and
   toasts; clears the hit areas the screens re-register. Owns the draw-time measurement. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { ctx } = NS.view;

  const BOARD_SCREENS = { title: 1, playing: 1, paused: 1, results: 1 };

  function draw(dt) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    G.hitAreas.length = 0;
    NS.view.begin();
    const sub = NS.screens.inRun() && !BOARD_SCREENS[G.screen];
    if (G.screen === 'cine') NS.cineRender.draw();
    else if (G.run && (BOARD_SCREENS[G.screen] || sub)) {
      NS.world.draw(dt);
      if (G.screen === 'playing' || G.screen === 'paused') NS.hud.draw();
    } else if (G.screen !== 'map') {
      const th = G.season ? G.season.theme : 0;
      NS.backdrop.draw(th, dt);
    }
    switch (G.screen) {
      case 'title': NS.title.draw(); break;
      case 'map': NS.map.draw(); break;
      case 'tree': NS.tree.draw(); break;
      case 'wardrobe': NS.wardrobe.draw(); break;
      case 'journal': NS.journal.draw(); break;
      case 'help': NS.help.draw(); break;
      case 'results': NS.results.draw(); break;
      case 'paused': NS.pause.draw(); break;
    }
    NS.touch.draw();
    /* a short fade-in on every screen change */
    if (G.screenT < 0.2 && G.screen !== 'playing') {
      const v = NS.view.visible();
      ctx.globalAlpha = (1 - G.screenT / 0.2) * 0.7;
      ctx.fillStyle = '#020804';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.globalAlpha = 1;
    }
    NS.hud.drawFlash();
    NS.hud.drawToasts();
    if (G.menuCursor >= G.hitAreas.length) G.menuCursor = 0;
    ctx.globalAlpha = 1;
    const p = G.perf;
    p.draw = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    p.drawAvg = p.drawAvg * 0.95 + p.draw * 0.05;
    ++p.frames;
  }

  Object.assign(NS.frame, {
    draw
  });
})();
