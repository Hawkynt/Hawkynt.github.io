/* One rendered frame: a full-screen cinematic, or the trip's world and the flight HUD or the
   command view HUD while a trip is open (also behind the pause menu and screens opened from
   it), or the drifting belt scenery behind menus; then the active screen, flash, toasts and
   pop-ups. Clears the hit areas that the screens re-register. Owns the draw-time measurement
   and the canvas cursor. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { ctx } = NS.view;

  const perf = { draw: 0, avg: 0, frames: 0 };
  let cursor = '';

  function setCursor() {
    const want = G.screen === 'playing' && G.cmd.on && !G.cine ? NS.commandInput.cursor()
      : G.screen === 'playing' && G.input.aimMode === 'mouse' && !G.input.touch ? 'none' : 'default';
    if (want !== cursor) {
      cursor = want;
      NS.view.canvas.style.cursor = want;
    }
  }

  function draw() {
    const t0 = performance.now();
    G.hitAreas.length = 0;
    NS.view.begin();
    if (G.cine && G.cine.full) NS.cineRender.drawFull();
    else if (NS.screens.inRun() && G.run) {
      NS.world.draw();
      if (G.screen === 'playing') {
        if (G.cmd.on && !G.cine) NS.commandHud.draw();
        else NS.hud.draw();
      }
    } else {
      const t = G.time;
      NS.backdrop.draw(G.world.w / 2 + Math.sin(t * 0.04) * 700, G.world.h / 2 + Math.cos(t * 0.031) * 500, 0, false);
    }
    switch (G.screen) {
      case 'title': NS.title.draw(); break;
      case 'station': NS.station.draw(); break;
      case 'map': NS.map.draw(); break;
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
