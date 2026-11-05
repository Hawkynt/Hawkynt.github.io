/* The pause menu over the frozen cave (resume, restart the cave, tech tree, wardrobe, journal,
   how to play, save and quit) and the results screen: story stars popping in one by one with
   time and gem goals, or the final score with its rank in the endless modes, gold earned and
   newly unlocked achievements, with Next / Retry / Map / Title. Reads G.results. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const ST = NS.story;
  const kit = NS.kit;
  const scr = NS.screens;
  const { ctx, visible } = NS.view;
  const UI = C.UI;

  function restartCave() {
    const run = G.run;
    if (!run) return;
    NS.run.loadCave(run);
    scr.resume();
  }

  function drawPause() {
    const v = visible();
    ctx.fillStyle = 'rgba(6,4,2,0.62)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const run = G.run;
    const w = 440, h = 520, x = 640 - w / 2, y = 360 - h / 2 + 20;
    kit.panel(x, y, w, h, { accent: UI.accent, glow: true });
    kit.text('Paused', 640, y + 44, 36, UI.accent, { align: 'center', weight: 'bold' });
    if (run) kit.fitText(NS.hud.caveTitle(run) + '  -  ' + run.score + ' pts', 640, y + 82, w - 40, 16, { align: 'center', color: UI.dim });
    const items = [
      ['Resume', () => scr.resume(), '#7dff8a'],
      ['Restart cave', restartCave, null, run && (run.mode === 'arcade' || run.mode === 'daily')],
      ['Tech Tree', () => scr.openOverlay('tree'), null],
      ['Wardrobe', () => scr.openOverlay('wardrobe'), null],
      ['Journal', () => scr.openOverlay('journal'), null],
      ['How to Play', () => scr.openOverlay('help'), null],
      ['Save & quit to title', () => scr.quitToTitle(), '#ff9a6a']
    ];
    for (let k = 0; k < items.length; ++k)
      kit.button(items[k][0], x + 50, y + 110 + k * 54, w - 100, 46, items[k][1], { accent: items[k][2] || UI.accent, size: 18, disabled: !!items[k][3] });
    kit.text('Your run is saved automatically - Continue from the title.', 640, y + h - 18, 13, UI.faint, { align: 'center' });
  }

  function drawStoryResults(r, v, t) {
    const chd = ST.CHAPTERS[r.ch];
    const w = 620, h = 470, x = 640 - w / 2, y = 120;
    kit.panel(x, y, w, h, { accent: ST.THEMES[chd.theme].accent, glow: true });
    kit.text(r.chapterDone ? 'Chapter complete!' : 'Cave clear!', 640, y + 46, 36, '#fff3c0', { align: 'center', weight: 'bold' });
    kit.text(chd.levels[r.lv], 640, y + 84, 18, UI.dim, { align: 'center' });
    for (let s = 0; s < 3; ++s) {
      const appear = t - 0.4 - s * 0.35;
      const on = s < r.stars && appear > 0;
      const pop = on ? 1 + Math.max(0, 0.4 - appear) * 2 : 1;
      kit.starIcon(640 + (s - 1) * 90, y + 150, 34 * pop, on);
      if (on && (r.popped | 0) <= s) { r.popped = s + 1; if (SZ.GameAudio) SZ.GameAudio.play('coin', { pitch: 1 + s * 0.25 }); }
    }
    const rows = [
      ['Clear the cave', true],
      ['Within ' + Math.round(r.par) + ' s  (' + Math.round(r.time) + ' s)', r.time <= r.par],
      ['Collect ' + r.goal + ' gems  (' + r.gems + ')', r.gems >= r.goal]
    ];
    for (let k = 0; k < rows.length; ++k) {
      kit.starIcon(x + 70, y + 224 + k * 32, 9, rows[k][1]);
      kit.text(rows[k][0], x + 90, y + 224 + k * 32, 16, rows[k][1] ? UI.text : UI.faint);
    }
    kit.text('Score ' + r.score, x + w - 50, y + 230, 22, UI.gold, { align: 'right', weight: 'bold' });
    kit.goldLabel(x + w - 50, y + 266, '+' + r.gold, 18, 'right');
    if (r.first) kit.text('First clear bonus!', x + w - 50, y + 296, 13, UI.good, { align: 'right' });
    achList(r, x + 40, y + 330, w - 80);
    const last = r.ch === ST.CHAPTERS.length - 1 && r.lv === ST.LEVELS_PER_CHAPTER - 1;
    kit.button(last ? 'Finale' : 'Next cave', x + 40, y + h - 70, 200, 52, () => scr.afterResults('next'), { accent: '#7dff8a', size: 20 });
    kit.button('Retry', x + 250, y + h - 70, 150, 52, () => scr.afterResults('retry'), { size: 18 });
    kit.button('Map', x + 410, y + h - 70, 170, 52, () => scr.afterResults('map'), { size: 18 });
  }

  function achList(r, x, y, w) {
    if (!r.ach || !r.ach.length) return;
    kit.text('Achievements unlocked:', x, y, 15, UI.gold, { weight: 'bold' });
    for (let k = 0; k < Math.min(3, r.ach.length); ++k) {
      kit.starIcon(x + 10, y + 26 + k * 24, 8, true);
      kit.fitText(r.ach[k].name + ' - ' + r.ach[k].desc, x + 26, y + 26 + k * 24, w - 30, 14, { color: UI.text });
    }
  }

  function drawRunResults(r, v, t) {
    const def = NS.meta.MODES[r.mode];
    const w = 620, h = 470, x = 640 - w / 2, y = 120;
    kit.panel(x, y, w, h, { accent: def.color, glow: true });
    const title = r.mode === 'daily' ? (r.cleared ? 'Daily cave cleared!' : 'Daily cave over') : 'Game over';
    kit.text(title, 640, y + 46, 36, '#fff3c0', { align: 'center', weight: 'bold' });
    kit.text(def.name + (r.mod ? ' - ' + r.mod.name : ''), 640, y + 84, 18, def.color, { align: 'center' });
    const shown = Math.min(r.score, Math.floor(r.score * Math.min(1, t / 1.2)));
    kit.text(String(shown), 640, y + 160, 64, UI.gold, { align: 'center', weight: 'bold' });
    if (r.rank === 0 && t > 1.2) {
      const p = 1 + Math.sin(t * 6) * 0.05;
      kit.text('NEW BEST!', 640, y + 214, 26 * p, '#7dff8a', { align: 'center', weight: 'bold' });
    } else if (r.rank > 0) kit.text('Rank #' + (r.rank + 1), 640, y + 214, 20, UI.text, { align: 'center' });
    if (r.mode === 'daily') kit.text('Best today: ' + r.best, 640, y + 244, 16, UI.dim, { align: 'center' });
    else kit.text('Caves cleared: ' + r.caves, 640, y + 244, 16, UI.dim, { align: 'center' });
    kit.goldLabel(640, y + 280, '+' + r.gold, 20, 'center');
    achList(r, x + 40, y + 316, w - 80);
    kit.button('Play again', x + 60, y + h - 70, 240, 52, () => scr.afterResults('retry'), { accent: '#7dff8a', size: 20 });
    kit.button('Title', x + 320, y + h - 70, 240, 52, () => scr.afterResults('title'), { size: 18 });
  }

  let shownAt = 0, lastResults = null;
  function drawResults() {
    const r = G.results;
    if (!r) return;
    if (r !== lastResults) { lastResults = r; shownAt = G.time; }
    const v = visible();
    ctx.fillStyle = 'rgba(6,4,2,0.5)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const t = G.time - shownAt;
    if (r.mode === 'story') drawStoryResults(r, v, t);
    else drawRunResults(r, v, t);
    if (t < 1.5 && Math.random() < 0.25) NS.fx.burst(200 + Math.random() * 880, 100, 16, { color: ['#ffd54a', '#7dff8a', '#5fd6ff', '#ff4fa0'], speed: 140, life: 1.2, size: 3, gravity: 120 });
    NS.fxRender.drawWorld(0, 0);
  }

  Object.assign(NS.overlays, { drawPause, drawResults, restartCave });
})();
