/* The pause menu over the frozen field: resume, the tech tree, hangar, goals and help (all apply
   at once and come back here), screen-shake strength, restarting a story mission, ending a Zen
   session, saving and quitting to the title (the run waits under Continue) or abandoning it. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { MODES } = NS.campaign;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx, visible } = NS.view;

  const SHAKES = [1, 0.5, 0];

  function draw() {
    const v = visible();
    ctx.fillStyle = 'rgba(2,4,12,0.66)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const run = G.run;
    kit.text('PAUSED', 640, 120, 50, '#ffffff', { align: 'center', weight: 'bold' });
    if (run) {
      const M = MODES[run.mode];
      const where = run.mode === 'story' ? G.level.name : run.mode === 'arcade' || run.mode === 'daily' ? 'Wave ' + run.wave : M.name;
      kit.text(M.name + '  -  ' + where + '  -  ' + NS.hud.fmt(G.score) + ' pts', 640, 162, 16, UI.textDim, { align: 'center' });
      kit.text('Progress is saved automatically - you can close the window and continue later.', 640, 188, 12, UI.textMute, { align: 'center' });
    }
    const x = 640 - 160, w = 320;
    let y = 220;
    const add = (id, label, action, opts) => {
      W.button(id, label, x, y, w, 46, Object.assign({ action: action }, opts || {}));
      y += 54;
    };
    add('resume', 'Resume', () => scr.resume(), { accent: UI.good, icon: 'play' });
    W.button('tree', 'Tech Tree', x, y, 156, 42, { action: () => scr.open('tree', 'paused'), icon: 'gun', px: 15 });
    W.button('hangar', 'Hangar', x + 164, y, 156, 42, { action: () => scr.open('wardrobe', 'paused'), icon: 'skin', px: 15 });
    y += 50;
    W.button('goals', 'Goals', x, y, 156, 42, { action: () => scr.open('goals', 'paused'), icon: 'trophy', px: 15 });
    W.button('help', 'How to Play', x + 164, y, 156, 42, { action: () => scr.open('help', 'paused'), icon: 'book', px: 15 });
    y += 54;
    const sh = G.save.settings.shake;
    add('shake', 'Screen shake: ' + (sh >= 1 ? 'Full' : sh > 0 ? 'Half' : 'Off'), () => {
      const i = SHAKES.indexOf(sh);
      G.save.settings.shake = SHAKES[(i + 1) % SHAKES.length];
      NS.save.writeSave();
    }, { icon: 'gear', px: 16 });
    if (run && run.mode === 'story')
      add('restart', 'Restart mission', () => { NS.snapshot.clear(); NS.cinematics.enterLevel(run.chapter, run.level); }, { icon: 'turn', px: 16 });
    if (run && run.mode === 'zen')
      add('end', 'End session', () => { scr.setScreen('playing'); NS.progress.runOver(true); }, { accent: UI.good, icon: 'lotus', px: 16 });
    else
      add('quit', 'Save and quit to title', () => scr.quitToTitle(), { icon: 'back', px: 16 });
    add('abandon', run && run.mode === 'zen' ? 'Quit to title' : 'Abandon run', () => scr.abandon(), { accent: UI.bad, px: 15 });
  }

  Object.assign(NS.pause, {
    draw
  });
})();
