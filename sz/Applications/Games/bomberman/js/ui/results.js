/* The results card after a stage or a run: the headline, stars popping in one by one (Story),
   the score counting up, time and kills, the gem breakdown, seasonal tokens, the high-score
   rank, fresh unlocks, and the way on - next stage or arena, world map, retry, play again,
   tech tree or title. Owns G.ui.results. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI } = C;
  const kit = NS.kit;
  const scr = NS.screens;
  const { ctx } = NS.view;

  function show(res) {
    const run = G.run;
    if (run) { res.world = run.world; res.level = run.levelIndex; res.mods = run.mods; }
    G.ui.results = res;
    res.shownStars = 0;
    scr.setScreen('results');
    if (res.cleared) NS.fx.confetti(640, 180, 70);
  }

  function next() {
    if (G.run && !G.run.over) NS.run.begin();
  }

  function draw() {
    const res = G.ui.results;
    if (!res) return;
    const t = G.screenT;
    kit.dim(0.55);
    const x = 340, y = 70, w = 600, h = 560;
    const k = NS.rng.easeOutBack(Math.min(1, t * 3));
    ctx.save();
    ctx.translate(640, 350);
    ctx.scale(k, k);
    ctx.translate(-640, -350);
    const good = res.cleared;
    kit.panel(x, y, w, h, { accent: good ? UI.good : UI.bad, glow: true, radius: 20 });
    const head = res.won ? (res.mode === 'story' ? 'SPARK CORE RESTORED!' : 'RUN COMPLETE!') : good ? (res.mode === 'zen' ? 'GARDEN CLEAR' : 'STAGE CLEAR!') : 'GAME OVER';
    kit.text(head, 640, y + 46, 38, good ? '#7cf08a' : UI.bad, { align: 'center', weight: 'bold', stroke: 6 });
    kit.fitText(res.title || '', 640, y + 84, w - 60, 17, { align: 'center', color: UI.textDim });
    let yy = y + 130;
    if (res.stars) {
      const shown = Math.min(res.stars, Math.floor(t * 2.5));
      if (shown > res.shownStars) {
        res.shownStars = shown;
        NS.fx.sfx('coin', { pitch: 1 + shown * 0.2 });
        NS.fx.burst(640 + (shown - 2) * 70, yy, 24, '#ffd84a', 260, 0.6, 6, true);
      }
      for (let i = 0; i < 3; ++i) {
        const on = i < res.shownStars;
        const pop = on ? 1 + Math.max(0, 0.4 - (t * 2.5 - i - 1) * 0.6) : 1;
        kit.icon('star', 640 + (i - 1) * 70, yy, 54 * pop, on ? UI.gold : 'rgba(255,255,255,0.15)');
      }
      const tips = [];
      if (res.hurt) tips.push('take no damage');
      if (res.time > res.par) tips.push('clear under ' + res.par + 's');
      kit.text(tips.length ? 'For more stars: ' + tips.join(', ') : 'Perfect!', 640, yy + 42, 13, tips.length ? UI.textDim : UI.gold, { align: 'center' });
      yy += 72;
    }
    const shownScore = Math.floor(Math.min(1, t / 1.2) * res.score);
    kit.text('SCORE', 640, yy, 13, UI.textMute, { align: 'center', weight: 'bold' });
    kit.text(String(shownScore), 640, yy + 32, 40, '#ffffff', { align: 'center', weight: 'bold' });
    yy += 70;
    kit.text('Time ' + NS.hud.fmtTime(res.time || 0) + '    Enemies ' + (res.kills || 0) + (res.rank >= 0 && res.rank !== undefined ? '    Rank #' + (res.rank + 1) : ''), 640, yy, 15, UI.text, { align: 'center' });
    yy += 34;
    for (let i = 0; i < res.lines.length; ++i) {
      kit.text(res.lines[i][0], x + 150, yy, 15, UI.textDim);
      kit.text(String(res.lines[i][1]), x + w - 150, yy, 15, '#bff8ff', { align: 'right', weight: 'bold' });
      yy += 24;
    }
    kit.text('Gems banked', x + 150, yy + 6, 17, '#ffffff', { weight: 'bold' });
    kit.gems(res.gems || 0, x + w - 150, yy + 6, 20, 'right');
    yy += 34;
    if (res.tokens) { kit.text('+' + res.tokens + ' ' + G.season.def.token.toLowerCase() + ' for the event', 640, yy, 14, G.season.def.color, { align: 'center', weight: 'bold' }); yy += 24; }
    if (res.unlocks && res.unlocks.length) kit.text('Unlocked: ' + res.unlocks.map(u => u.item.name).join(', '), 640, yy, 14, UI.good, { align: 'center', weight: 'bold' });
    ctx.restore();
    buttons(res, x, y + h - 74, w);
  }

  function buttons(res, x, y, w) {
    const list = [];
    const live = G.run && !G.run.over;
    if (live && res.cleared) {
      list.push([res.mode === 'story' ? 'Next Stage' : res.mode === 'zen' ? 'Next Garden' : res.mode === 'rush' ? 'Next Boss' : 'Next Arena', 'play', UI.good, next]);
      if (res.mode === 'story') list.push(['World Map', 'map', '#ffb347', () => { NS.run.suspend(); G.ui.mapWorld = G.run.world; G.ui.mapSel = G.run.levelIndex; scr.setScreen('map'); }]);
      list.push(['Tech Tree', 'tree', '#ff8a3c', () => scr.open('tree', 'results')]);
    } else if (res.mode === 'story') {
      if (!res.won) list.push(['Retry', 'play', UI.good, () => NS.run.newRun('story', { world: res.world, level: res.level })]);
      list.push(['World Map', 'map', '#ffb347', () => { G.ui.mapWorld = res.world || 0; scr.setScreen('map'); }]);
      list.push(['Tech Tree', 'tree', '#ff8a3c', () => scr.open('tree', 'results')]);
    } else {
      if (res.mode !== 'daily') list.push(['Play Again', 'play', UI.good, () => NS.run.newRun(res.mode)]);
      list.push(['Tech Tree', 'tree', '#ff8a3c', () => scr.open('tree', 'results')]);
      list.push(['Title', 'back', '#9a8aa0', () => scr.setScreen('title')]);
    }
    const bw = (w - 40 - (list.length - 1) * 12) / list.length;
    for (let i = 0; i < list.length; ++i)
      kit.button('r' + i, list[i][0], x + 20 + i * (bw + 12), y, bw, 52, { icon: list[i][1], accent: list[i][2], action: list[i][3], px: 17 });
  }

  Object.assign(NS.results, {
    show, draw, next
  });
})();
