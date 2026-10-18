/* One rendered frame: the backdrop (following the camera in flight, drifting in menus), the
   battle and HUD while a run is open, the active screen on top, then flash and toasts.
   Clears the hit areas that the screens re-register. Owns the draw-time measurement. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { ctx } = NS.view;

  const perf = { draw: 0, avg: 0, frames: 0 };
  let cursor = '';

  /* the reticle replaces the system cursor while flying with the mouse */
  function setCursor() {
    const want = G.screen === 'playing' && G.input.aimMode === 'mouse' && !G.input.touch ? 'none' : 'default';
    if (want !== cursor) {
      cursor = want;
      NS.view.canvas.style.cursor = want;
    }
  }

  function draw() {
    const t0 = performance.now();
    G.hitAreas.length = 0;
    NS.view.begin();
    const run = NS.screens.inRun() && G.stage;
    if (run) {
      NS.backdrop.draw(G.cam.x + G.cam.ox * 0.3, G.cam.y + G.cam.oy * 0.3, 0.32);
      NS.world.draw();
      if (G.screen === 'playing') NS.hud.draw();
    } else {
      const t = G.time;
      NS.backdrop.draw(G.world.w / 2 + Math.sin(t * 0.05) * 900, G.world.h / 2 + Math.cos(t * 0.037) * 600);
    }
    switch (G.screen) {
      case 'title': NS.title.draw(); break;
      case 'map': NS.map.draw(); break;
      case 'briefing': NS.briefing.draw(); break;
      case 'hangar': NS.hangar.draw(); break;
      case 'tree': NS.tree.draw(); break;
      case 'help': NS.help.draw(); break;
      case 'results': NS.results.draw(); break;
      case 'paused': NS.pause.draw(); break;
    }
    NS.hud.drawFlash();
    NS.hud.drawToast();
    if (G.menuCursor >= G.hitAreas.length) G.menuCursor = 0;
    ctx.globalAlpha = 1;
    setCursor();
    perf.draw = performance.now() - t0;
    perf.avg = perf.avg * 0.95 + perf.draw * 0.05;
    ++perf.frames;
  }

  Object.assign(NS.frame, {
    draw, perf
  });
})();
