/* One rendered frame: the cinematic, or the arena with HUD while a run is on screen, or the
   menu backdrop; then the active screen, the confirmation modal, flash and toasts. Clears the
   hit areas the screens re-register, keeps the seasonal ambience going and measures the draw
   time. Owns G.perf.draw. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const { ctx } = NS.view;

  const MENU_SCENE = { title: 'village', tree: 'lab', wardrobe: 'lab', goals: 'village', stats: 'lab', help: 'lab' };

  function draw() {
    const t0 = performance.now();
    G.hitAreas.length = 0;
    NS.view.begin();
    const s = G.screen;
    if (s === 'cine') {
      NS.cineRender.draw();
    } else if (NS.screens.inRun()) {
      NS.backdrop.draw(null, s === 'playing' ? 0 : 0.1);
      NS.world.draw();
      NS.fxRender.draw();
      NS.hud.draw();
      NS.fxRender.drawTexts();
      NS.hud.drawBanner();
      if (s === 'playing') NS.touch.draw();
    } else {
      const scene = s === 'map' ? NS.story.WORLDS[G.ui.mapWorld].id : MENU_SCENE[s] || 'village';
      NS.backdrop.draw(scene, s === 'title' ? 0.05 : 0.35);
      NS.fxRender.draw();
      NS.fxRender.drawTexts();
    }
    switch (s) {
      case 'title': NS.title.draw(); break;
      case 'map': NS.map.draw(); break;
      case 'paused': NS.pause.draw(); break;
      case 'results': NS.results.draw(); break;
      case 'tree': NS.tree.draw(); break;
      case 'wardrobe': NS.wardrobe.draw(); break;
      case 'goals': NS.goals.draw(); break;
      case 'stats': NS.stats.draw(); break;
      case 'help': NS.help.draw(); break;
    }
    if (G.ui.modal) modal();
    NS.hud.drawFlash();
    NS.hud.drawToasts();
    if (G.menuCursor >= G.hitAreas.length) G.menuCursor = 0;
    ctx.globalAlpha = 1;
    G.perf.draw = performance.now() - t0;
    G.perf.drawAvg = G.perf.drawAvg * 0.95 + G.perf.draw * 0.05;
    ++G.perf.frames;
  }

  function modal() {
    const m = G.ui.modal;
    G.hitAreas.length = 0;
    kit.dim(0.6);
    kit.panel(390, 240, 500, 230, { accent: UI.gold, glow: true, radius: 18 });
    kit.text(m.title, 640, 284, 26, UI.gold, { align: 'center', weight: 'bold' });
    kit.wrap(m.text, 430, 316, 420, 16, 22, UI.text, { align: 'left' });
    kit.button('m_no', 'No', 430, 400, 190, 48, { action: () => { G.ui.modal = null; }, accent: '#9a8aa0' });
    kit.button('m_yes', 'Yes', 660, 400, 190, 48, { action: () => { const y = m.yes; G.ui.modal = null; y(); }, accent: UI.good });
  }

  Object.assign(NS.frame, {
    draw
  });
})();
