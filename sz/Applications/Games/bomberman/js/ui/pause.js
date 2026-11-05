/* The pause menu over the frozen arena: resume, the tech tree, wardrobe and goals (all with
   immediate effect, returning here), how to play, Save & Quit (the run waits for Continue) and
   Abandon Run behind a confirmation. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI } = C;
  const kit = NS.kit;
  const scr = NS.screens;

  function draw() {
    const run = G.run;
    kit.dim(0.55);
    const x = 470, y = 96, w = 340, h = 540;
    kit.panel(x, y, w, h, { accent: UI.gold, glow: true, radius: 20 });
    kit.text('PAUSED', 640, y + 44, 38, UI.gold, { align: 'center', weight: 'bold', stroke: 6 });
    if (run && run.level) kit.fitText(run.level.name, 640, y + 80, w - 40, 15, { align: 'center', color: UI.textDim });
    const items = [
      ['Resume', 'play', UI.good, () => scr.resume()],
      ['Tech Tree', 'tree', '#ff8a3c', () => scr.open('tree', 'paused')],
      ['Wardrobe', 'shirt', '#ff70c0', () => scr.open('wardrobe', 'paused')],
      ['Goals', 'trophy', '#ffd84a', () => scr.open('goals', 'paused')],
      ['How to Play', 'help', '#7cf08a', () => scr.open('help', 'paused')],
      ['Save & Quit', 'exit', '#6fd3ff', () => { NS.run.suspend(); scr.setScreen('title'); NS.screens.toast('Run saved - Continue from the title', '#6fd3ff', 'continue'); }],
      ['Abandon Run', 'skull', UI.bad, () => scr.confirm('Abandon this run?', 'The run ends now. Your score is recorded and the gems you collected are kept.', () => { NS.run.abandon(); scr.setScreen('title'); })]
    ];
    for (let i = 0; i < items.length; ++i)
      kit.button('p' + i, items[i][0], x + 30, y + 110 + i * 58, w - 60, 48, { icon: items[i][1], accent: items[i][2], action: items[i][3], px: 18 });
    kit.text('Progress saves automatically', 640, y + h - 18, 12, UI.textMute, { align: 'center' });
  }

  Object.assign(NS.pause, {
    draw
  });
})();
