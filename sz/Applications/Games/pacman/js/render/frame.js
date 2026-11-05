/* One rendered frame: a full-screen cinematic, or the maze (the run's, or the attract demo
   behind menus) with the HUD in play, then the active screen, the flash and wipe, toasts and
   pop-ups. Clears the hit areas that the screens re-register. Owns the draw-time measurement. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { ctx } = NS.view;

  const perf = { draw: 0, avg: 0, frames: 0, worst: 0 };

  function draw() {
    const t0 = performance.now();
    G.hitAreas.length = 0;
    NS.view.begin();
    if (G.screen === 'cine') NS.cineRender.draw();
    else {
      if (G.screen !== 'map') NS.world.draw();
      if (G.screen === 'playing') NS.hud.draw();
      switch (G.screen) {
        case 'title': NS.title.draw(); break;
        case 'map': NS.map.draw(); break;
        case 'tree': NS.tree.draw(); break;
        case 'wardrobe': NS.wardrobe.draw(); break;
        case 'goals': NS.goalsScreen.draw(); break;
        case 'season': NS.season.draw(); break;
        case 'help': NS.help.draw(); break;
        case 'results': NS.results.draw(); break;
        case 'pause': NS.pause.draw(); break;
      }
    }
    NS.hud.drawFlash();
    NS.hud.drawToast();
    if (G.menuCursor >= G.hitAreas.length) G.menuCursor = 0;
    ctx.globalAlpha = 1;
    perf.draw = performance.now() - t0;
    perf.avg = perf.avg * 0.95 + perf.draw * 0.05;
    if (perf.frames > 60) perf.worst = Math.max(perf.worst, perf.draw);
    ++perf.frames;
  }

  Object.assign(NS.frame, {
    draw, perf
  });
})();
