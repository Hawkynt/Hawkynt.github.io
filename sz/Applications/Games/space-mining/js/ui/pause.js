/* The pause menu over the frozen trip: resume, returning home to end the trip (career), the
   tech tree and help (both return here), calling a tow home (career) or abandoning the run
   (modes), and quitting to the title, with the trip so far. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx } = NS.view;

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,12,0.62)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const run = G.run;
    const x = 440, y = 150, w = 400;
    const career = run && run.mode === 'career';
    kit.panel(x, y, w, career ? 492 : 430, { glow: true });
    kit.text('PAUSED', 640, y + 40, 30, '#ffffff', { align: 'center', weight: 'bold' });
    if (run) {
      const m = Math.floor(run.t / 60), s = Math.floor(run.t % 60);
      kit.text(run.zone.name + '  -  ' + m + ':' + (s < 10 ? '0' : '') + s + '  -  hold ' + Math.floor(run.cargoUsed) + ' / ' + run.cargoMax, 640, y + 74, 13, UI.textDim, { align: 'center' });
    }
    const items = [
      ['resume', 'Resume', () => scr.resume(), UI.good],
      career ? ['home', 'Return home (end the trip)', () => NS.trip.returnHome(), UI.gold] : null,
      ['tree', 'Tech Tree', () => scr.openTree('paused'), UI.data],
      ['help', 'How to Play', () => scr.openHelp('paused'), UI.accent],
      ['tow', career ? 'Call a tow home (half the hold)' : 'Abandon the run', () => NS.trip.abort(), UI.warn],
      ['title', career ? 'Quit to Title (lose this trip)' : 'Quit to Title', () => scr.setScreen('title'), UI.bad],
    ];
    const list = items.filter(Boolean);
    for (let i = 0; i < list.length; ++i)
      W.button(list[i][0], list[i][1], x + 40, y + 104 + i * 62, w - 80, 50, { action: list[i][2], accent: list[i][3] });
  }

  Object.assign(NS.pause, {
    draw
  });
})();
