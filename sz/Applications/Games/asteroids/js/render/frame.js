/* One rendered frame: the backdrop of the current chapter (or the arcade wave's belt), the field
   while a run is open or the attract scene on the title, the HUD while flying, the active
   screen on top, then flash and toasts. Clears the hit areas the screens re-register. Owns the
   draw-time measurement and the cursor style. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { ctx } = NS.view;

  const perf = { draw: 0, avg: 0, frames: 0 };
  let cursor = '';

  function runChapter() {
    const run = G.run;
    if (!run) return -1;
    switch (run.mode) {
      case 'story': return run.chapter;
      case 'rush': return run.rushIdx;
      case 'zen': return -1;
    }
    return Math.floor((Math.max(1, run.wave) - 1) / 4) % 5;
  }

  function setCursor() {
    const want = G.screen === 'playing' && !G.input.touch ? 'crosshair' : 'default';
    if (want !== cursor) {
      cursor = want;
      NS.view.canvas.style.cursor = want;
    }
  }

  function draw() {
    const t0 = performance.now();
    G.hitAreas.length = 0;
    NS.view.begin();
    const scr = NS.screens;
    const inRun = scr.inRun() && G.run;
    if (inRun) {
      NS.backdrop.setChapter(runChapter());
      NS.backdrop.draw(0.1);
      NS.world.draw();
      if (G.screen === 'playing') NS.hud.draw();
    } else if (G.screen === 'title') {
      NS.backdrop.setChapter(-1);
      NS.backdrop.draw(0.1);
      NS.world.draw();
    } else if (G.screen !== 'cine') NS.backdrop.draw(G.screen === 'map' ? 0.15 : 0.4, G.screen === 'map');
    switch (G.screen) {
      case 'title': NS.title.draw(); break;
      case 'map': NS.map.draw(); break;
      case 'story': NS.story.draw(); break;
      case 'cine': NS.cineRender.draw(); break;
      case 'tree': NS.tree.draw(); break;
      case 'wardrobe': overlay(inRun); NS.wardrobe.draw(); break;
      case 'goals': overlay(inRun); NS.goals.draw(); break;
      case 'help': overlay(inRun); NS.help.draw(); break;
      case 'results': NS.results.draw(); break;
      case 'paused': NS.pause.draw(); break;
    }
    NS.hud.drawFlash();
    if (G.fade > 0) {
      const v = NS.view.visible();
      ctx.globalAlpha = Math.min(1, G.fade / 0.22) * 0.85;
      ctx.fillStyle = '#000000';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.globalAlpha = 1;
    }
    NS.hud.drawToasts();
    if (G.menuCursor >= G.hitAreas.length) G.menuCursor = 0;
    ctx.globalAlpha = 1;
    setCursor();
    perf.draw = performance.now() - t0;
    perf.avg = perf.avg * 0.95 + perf.draw * 0.05;
    ++perf.frames;
  }

  function overlay(inRun) {
    const v = NS.view.visible();
    ctx.fillStyle = inRun ? 'rgba(2,4,12,0.82)' : 'rgba(2,4,12,0.45)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  Object.assign(NS.frame, {
    draw, perf, runChapter
  });
})();
