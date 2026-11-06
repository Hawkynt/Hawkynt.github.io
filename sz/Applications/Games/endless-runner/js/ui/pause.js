/* The pause menu over the frozen run: resume, the tech tree and collection (changes apply as
   soon as the run resumes), help, and quitting to the title (asked twice; the run stays saved
   for Continue), with the run's numbers and today's quests alongside. Draws and registers hit
   areas; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { QUEST_BY_ID } = NS.goals;
  const { ctx } = NS.view;

  function draw() {
    const v = NS.view.visible();
    const run = G.run;
    ctx.fillStyle = 'rgba(8,6,22,0.6)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.panel(380, 120, 520, 470, { radius: 18, glow: true });
    kit.text('Paused', 640, 164, 40, '#ffffff', { weight: 'bold', align: 'center' });
    if (run) kit.text(NS.hud.MODE_NAMES[run.mode] + ' - ' + rules.metres(run.p.x, run.x0) + ' m - ' + Math.floor(run.score) + ' points', 640, 198, 15, UI.textDim, { align: 'center' });
    const items = [['resume', 'Resume', 'play', () => scr.resume(), UI.good], ['tree', 'Tech Tree', 'bolt', () => scr.open('tree', 'paused'), UI.gold],
      ['wardrobe', 'Collection', 'shirt', () => scr.open('wardrobe', 'paused'), UI.accent], ['help', 'How to Play', 'help', () => scr.open('help', 'paused'), UI.accent]];
    for (let i = 0; i < items.length; ++i)
      W.button(items[i][0], items[i][1], 440, 226 + i * 62, 400, 52, { icon: items[i][2], action: items[i][3], accent: items[i][4] });
    if (!G.ui.pauseConfirm) W.button('quit', 'Quit to title', 440, 226 + 4 * 62, 400, 52, { icon: 'map', action: () => { G.ui.pauseConfirm = true; }, accent: UI.bad });
    else W.button('quit2', 'Sure? The run is saved for Continue', 440, 226 + 4 * 62, 400, 52, { icon: 'check', action: () => scr.toTitle(), accent: UI.bad, px: 15 });
    const qs = G.save.day.quests || [];
    for (let i = 0; i < qs.length; ++i) {
      const q = qs[i], def = QUEST_BY_ID[q.id];
      kit.fitText((q.claimed ? 'Done: ' : '') + def.text(q.n) + '  ' + rules.questProgress(G.save, q) + '/' + q.n, 640, 620 + i * 22, 600, 14,
        { align: 'center', color: q.claimed ? UI.good : UI.textDim });
    }
  }

  Object.assign(NS.pause, {
    draw
  });
})();
