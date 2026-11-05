/* The pause menu over the frozen maze: resume, the tech tree, wardrobe, goals and help (all with
   immediate effect), saving and leaving to the title (Continue brings the run back), or ending
   the run for its results. Notes that the run is autosaved. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx } = NS.view;

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,2,14,0.66)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const x = 470, y = 120, w = 340;
    kit.panel(x - 20, y - 20, w + 40, 506, { accent: UI.accent, glow: true });
    kit.text('PAUSED', 640, y + 20, 36, UI.accent, { align: 'center', weight: 'bold' });
    const run = G.run;
    if (run) kit.text('Score ' + kit.group(run.score) + (run.mode !== 'zen' ? '   Lives ' + run.lives : ''), 640, y + 56, 15, UI.textDim, { align: 'center' });
    const items = [
      { id: 'resume', label: 'Resume', icon: 'play', accent: UI.good, act: () => scr.resume() },
      { id: 'tree', label: 'Tech Tree', icon: 'tree', act: () => scr.openTree('pause') },
      { id: 'wardrobe', label: 'Wardrobe', icon: 'shirt', act: () => scr.openWardrobe('pause') },
      { id: 'goals', label: 'Goals', icon: 'trophy', act: () => scr.openGoals('pause') },
      { id: 'help', label: 'How to Play', icon: 'book', act: () => scr.openHelp('pause') },
      { id: 'title', label: 'Save & Title', icon: 'back', act: () => scr.toTitle() },
      { id: 'end', label: 'End Run', icon: 'flag', accent: UI.bad, act: () => scr.abandon() },
    ];
    for (let i = 0; i < items.length; ++i) {
      const it = items[i];
      W.button(it.id, it.label, x, y + 84 + i * 52, w, 44, { icon: it.icon, accent: it.accent, px: 17, action: it.act });
    }
    kit.text('Your run is saved - close the page any time', 640, y + 462, 13, UI.textDim, { align: 'center' });
  }

  Object.assign(NS.pause, {
    draw
  });
})();
