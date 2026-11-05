/* The pause menu over the frozen board: resume, restart, the tech tree, collection, journal and
   help (all with immediate effect on the run), Save & Quit (the run waits on the title as
   Continue) and End Run behind a confirmation; plus the run's numbers and today's quests. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { WORLDS } = NS.worlds;
  const { MODES } = NS.items;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const scr = NS.screens;
  const { ctx } = NS.view;

  function draw() {
    const run = G.run;
    if (!run) return;
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,8,4,0.66)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    NS.hud.bigText('PAUSED', 60, '#ffffff', 1, 110);
    const where = run.mode === 'story' ? WORLDS[run.w].name + '  ' + (run.w + 1) + '-' + (run.l + 1) : MODES[run.mode].name;
    kit.text(where + '  -  score ' + run.score + '  -  length ' + run.snake.body.length, 640, 160, 16, UI.textDim, { align: 'center' });
    const x = 480, w = 320;
    let y = 196;
    const items = [
      ['resume', 'Resume', () => scr.resume(), UI.good, 'play'],
      ['restart', 'Restart', () => NS.run.restart(), UI.accent, 'clock'],
      ['tree', 'Tech Tree', () => scr.open('tree', 'paused'), UI.gold, 'eye'],
      ['wardrobe', 'Collection', () => scr.open('wardrobe', 'paused'), UI.accent, 'gift'],
      ['journal', 'Journal', () => scr.open('journal', 'paused'), UI.accent, 'book'],
      ['help', 'How to Play', () => scr.open('help', 'paused'), UI.accent, 'star'],
      ['savequit', 'Save & Quit', () => NS.run.saveAndQuit(), UI.sky, 'check'],
    ];
    for (let k = 0; k < items.length; ++k) {
      W.button(items[k][0], items[k][1], x, y, w, 44, { px: 17, accent: items[k][3], icon: items[k][4], action: items[k][2] });
      y += 50;
    }
    if (!G.ui.pauseConfirm) W.button('end', 'End Run', x, y + 6, w, 40, { px: 15, accent: UI.bad, action: () => { G.ui.pauseConfirm = true; } });
    else {
      kit.text('End the run and collect its rewards?', 640, y + 2, 13, UI.bad, { align: 'center' });
      W.button('end-yes', 'Yes, end it', x, y + 14, w / 2 - 5, 38, { px: 14, accent: UI.bad, action: () => NS.run.abandon() });
      W.button('end-no', 'Keep playing', x + w / 2 + 5, y + 14, w / 2 - 5, 38, { px: 14, accent: UI.good, action: () => { G.ui.pauseConfirm = false; } });
    }
    /* quests on the side */
    const q = G.save.quests.list;
    kit.panel(870, 196, 340, 210, { accent: UI.gold });
    kit.text('TODAY\'S QUESTS', 890, 220, 13, UI.gold, { weight: 'bold' });
    for (let k = 0; k < q.length; ++k) {
      const yy = 252 + k * 50;
      kit.fitText(rules.questText(q[k]), 890, yy, 300, 13, { color: q[k].done ? UI.good : UI.text });
      kit.bar(890, yy + 14, 300, 6, q[k].progress / q[k].n, q[k].done ? UI.good : UI.gold);
    }
    kit.panel(70, 196, 340, 210, { accent: UI.accent });
    kit.text('THIS RUN', 90, 220, 13, UI.accent, { weight: 'bold' });
    const rows = [['Fruit', run.eaten], ['Best combo', run.maxCombo], ['Critters', run.kills], ['Tokens', run.tokens], ['Scale gems', run.gems]];
    for (let k = 0; k < rows.length; ++k) {
      kit.text(rows[k][0], 90, 252 + k * 30, 14, UI.textDim);
      kit.text(String(rows[k][1]), 390, 252 + k * 30, 14, '#ffffff', { align: 'right', weight: 'bold' });
    }
    kit.text('Your run is saved - close the window any time and continue later', 640, 690, 12, 'rgba(220,240,220,0.6)', { align: 'center' });
  }

  Object.assign(NS.pause, {
    draw
  });
})();
