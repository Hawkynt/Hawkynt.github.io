/* One rendered frame: the cave and HUD while a run is open (under the pause menu too), or the
   active menu screen over the themed vista, then touch controls, flash, toast and the screen
   curtain. Clears the hit areas the screens re-register and measures the draw time. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const G = NS.state;
  const { ctx } = NS.view;

  function menuBackdrop(dt) {
    const theme = G.screen === 'map' ? NS.map.theme() : (G.run ? NS.world.themeOf(G.run) : 'amber');
    NS.backdrop.drawVista(theme, Math.sin(G.time * 0.1) * 300, Math.cos(G.time * 0.07) * 120);
    NS.backdrop.drawAmbient(theme, dt, 40);
  }

  function draw(dt) {
    const t0 = performance.now();
    G.hitAreas.length = 0;
    NS.view.begin();
    const inRun = G.run && (G.screen === 'playing' || G.screen === 'paused' || ((G.screen === 'tree' || G.screen === 'help' || G.screen === 'wardrobe' || G.screen === 'journal') && G.returnTo === 'paused'));
    if (G.screen === 'title') NS.title.draw(dt);
    else if (G.screen === 'cinema') NS.cinema.draw(dt);
    else if (inRun) {
      const theme = NS.world.themeOf(G.run);
      NS.world.draw(G.run.cave, theme, G.screen === 'playing' ? dt : 0, true);
      NS.backdrop.drawAmbient(theme, G.screen === 'playing' ? dt : 0, 30);
      if (G.screen === 'playing' || G.screen === 'paused') NS.hud.draw();
      else {
        const v = NS.view.visible();
        ctx.fillStyle = 'rgba(8,5,3,0.55)';
        ctx.fillRect(v.x0, v.y0, v.w, v.h);
      }
    } else menuBackdrop(dt);
    switch (G.screen) {
      case 'map': NS.map.draw(dt); break;
      case 'tree': NS.tree.draw(dt); break;
      case 'wardrobe': NS.wardrobe.draw(dt); break;
      case 'journal': NS.journal.draw(dt); break;
      case 'help': NS.help.draw(dt); break;
      case 'results': NS.overlays.drawResults(dt); break;
      case 'paused': NS.overlays.drawPause(dt); break;
      case 'playing': NS.touch.draw(); break;
    }
    NS.fxRender.drawFlash();
    NS.hud.drawToast();
    NS.hud.drawCurtain();
    if (G.menuCursor >= G.hitAreas.length) G.menuCursor = 0;
    ctx.globalAlpha = 1;
    const ms = performance.now() - t0;
    G.perf.draw = ms;
    G.perf.avgDraw = G.perf.avgDraw * 0.95 + ms * 0.05;
  }

  Object.assign(NS.frame, { draw });
})();
