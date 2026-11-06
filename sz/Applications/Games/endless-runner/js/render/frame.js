/* One rendered frame: the run scene (the open run, or the title's demo runner behind the
   menus) with scenery bleeding into the letterbox, the HUD while a run is open, the active
   screen on top, touch controls, a fade on every screen change, flash and toasts; clears the
   hit areas the screens re-register. Owns the draw-time measurement. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { ctx } = NS.view;

  const SCENE_LESS = { map: 1, cine: 1 };

  function draw() {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    G.hitAreas.length = 0;
    NS.view.begin();
    if (G.screen === 'cine') NS.cineRender.draw();
    else if (!SCENE_LESS[G.screen]) {
      const run = NS.sim.viewRun();
      NS.actors.draw(run);
      if (G.screen === 'playing' || G.screen === 'paused') NS.hud.draw();
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
    if (G.screenT < 0.2 && G.screen !== 'playing') {
      const v = NS.view.visible();
      ctx.globalAlpha = (1 - G.screenT / 0.2) * 0.7;
      ctx.fillStyle = '#05040c';
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
