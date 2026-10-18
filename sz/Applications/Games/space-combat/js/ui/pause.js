/* The pause menu over the frozen battle: Resume, Tech Tree (upgrades apply immediately), How to
   Play, Restart and Abandon (asks once more), with the objective, run score and scrap so far. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { MODES } = NS.campaign;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx } = NS.view;

  let confirmT = 0;

  function restart() {
    const run = G.run;
    if (run.mode === 'campaign') NS.missions.startRun('campaign', { sector: run.sector, index: run.index });
    else NS.missions.startRun(run.mode);
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,12,0.62)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const x = 440, y = 120, w = 400, h = 480;
    kit.panel(x, y, w, h, { accent: UI.accent, glow: true });
    kit.text('PAUSED', 640, y + 44, 34, '#ffffff', { align: 'center', weight: 'bold' });
    const st = G.stage;
    kit.text((G.run ? MODES[G.run.mode].name : '') + (st ? '  -  ' + st.name : ''), 640, y + 80, 14, UI.textDim, { align: 'center' });
    kit.text(NS.missions.progressText(), 640, y + 104, 15, UI.gold, { align: 'center', weight: 'bold' });
    if (confirmT > 0) confirmT -= 1 / 60;
    const items = [
      ['Resume', () => scr.resume(), UI.good, 'Esc / P'],
      ['Tech Tree', () => scr.openTree('paused'), UI.accent, 'Upgrades apply at once'],
      ['How to Play', () => scr.openHelp('paused'), UI.accent, ''],
      ['Restart', () => restart(), UI.warn, ''],
      [confirmT > 0 ? 'Really abandon?' : 'Abandon', () => {
        if (confirmT > 0) { confirmT = 0; NS.missions.abandon(); } else confirmT = 3;
      }, UI.bad, 'Keep the scrap you collected'],
    ];
    for (let i = 0; i < items.length; ++i)
      W.button('p' + i, items[i][0], x + 50, y + 132 + i * 62, w - 100, 52, { action: items[i][1], accent: items[i][2], sub: items[i][3] });
    kit.text('Score ' + G.score + '    Scrap ' + G.runScrap, 640, y + h - 26, 14, UI.textDim, { align: 'center' });
  }

  Object.assign(NS.pause, {
    draw
  });
})();
