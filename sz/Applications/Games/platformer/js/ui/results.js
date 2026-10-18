/*
 * The results panel after a cleared level, a Daily Run or an Endless run.
 * Reads G.results and advances its animation clock.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { VIEW_W, WORLDS } = NS.config;
  const Levels = SZ.PlatformerLevels;
  const Fx = SZ.PlatformerFx;
  const Session = NS.module('session');
  const World = NS.module('world');
  const Menu = NS.module('menu');
  const Tree = NS.module('tree');
  const Pause = NS.module('pause');
  const { sfx } = NS.module('sound');
  const { visibleRect } = NS.module('view');
  const { formatTime } = NS.module('util');
  const { drawGlow, drawIcon } = NS.module('kit');
  const ctx = G.ctx;
  const ui = G.ui;
  const fxView = G.fxView;

  function drawResults(dt) {
    if (G.run) {
      World.drawWorld(0);
    }
    Menu.veil(0.55);
    const res = G.results;
    res.t += dt;
    const v = visibleRect();
    if (res.mode === 'endless') {
      ui.drawPanel(VIEW_W / 2 - 330, 110, 660, 470, { accent: '#ff8a3a' });
      ui.drawHeadline('Run Over', VIEW_W / 2, 170, 560, 64, '#ffe9a0', '#ff8a3a');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const rows = [['Stages cleared', String(res.stage)], ['Coins', String(Math.floor(Math.min(1, res.t / 1.2) * res.coins))], ['Gems', String(res.gems)], ['Time', formatTime(res.time)]];
      rows.forEach((rw, i) => {
        ctx.textAlign = 'left';
        ui.fitText(rw[0], VIEW_W / 2 - 230, 250 + i * 40, 240, 18, { color: ui.UI.textDim });
        ctx.textAlign = 'right';
        ui.fitText(rw[1], VIEW_W / 2 + 230, 250 + i * 40, 200, 20, { weight: 'bold', color: '#ffffff' });
      });
      ctx.textAlign = 'center';
      ui.drawHeadline(res.score.toLocaleString(), VIEW_W / 2, 430, 400, 46, '#ffd75a', '#ff8a2a');
      if (res.best)
        ui.fitText('New best run!', VIEW_W / 2, 468, 300, 16, { weight: 'bold', color: ui.UI.good });
      Menu.drawButton('again', 'Run Again', VIEW_W / 2 - 300, 500, 190, 54, { action: () => Session.startEndless(null), key: 'Enter' });
      Menu.drawButton('rtree', 'Tech Tree', VIEW_W / 2 - 95, 500, 190, 54, { action: () => Tree.openTree('results') });
      Menu.drawButton('rtitle', 'Title', VIEW_W / 2 + 110, 500, 190, 54, { action: () => { G.run = null; Session.setScreen('title'); } });
      return;
    }
    const W = WORLDS[res.world];
    ui.drawPanel(VIEW_W / 2 - 360, 70, 720, 560, { accent: W.color });
    ui.drawHeadline(res.mode === 'daily' ? 'Daily Run Clear!' : 'Level Clear!', VIEW_W / 2, 128, 640, 58, '#ffe9a0', '#ff9a2a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(res.name, VIEW_W / 2, 172, 600, 18, { weight: 'bold', color: W.color });
    /* stars pop in one by one */
    const stars = res.stars;
    const labels = ['Goal', 'All gems', 'Par ' + res.target + 's'];
    for (let k = 0; k < 3; ++k) {
      const at = 0.4 + k * 0.45;
      const x = VIEW_W / 2 + (k - 1) * 150, y = 250;
      const kk = Math.max(0, Math.min(1, (res.t - at) / 0.35));
      if (stars[k] && kk > 0 && !res['pop' + k]) {
        res['pop' + k] = true;
        Fx.starBurst(fxView, x, y);
        sfx('coin', { pitch: 1 + k * 0.2 });
      }
      drawIcon('star', '#3a4058', x, y, 84);
      if (stars[k] && kk > 0) {
        const s = kk < 0.7 ? 0.4 + kk / 0.7 * 0.8 : 1.2 - (kk - 0.7) / 0.3 * 0.2;
        drawGlow(x, y, 160, '#ffd75a', 0.5 * kk);
        drawIcon('star', '#ffd75a', x, y, 84 * s);
      }
      ui.fitText(labels[k], x, y + 56, 140, 14, { weight: 'bold', color: stars[k] ? '#ffe9a0' : ui.UI.textMute });
    }
    /* tallies */
    const shown = Math.floor(Math.min(1, Math.max(0, res.t - 1.6) / 1.0) * res.coins);
    if (shown !== res.lastShown && shown > 0) {
      res.lastShown = shown;
      if (shown % 3 === 0)
        sfx('coin', { volume: 0.25, pitch: 1.4 });
    }
    const rows = [
      ['coin', '#ffd75a', 'Coins', shown + (res.bonus ? '  + ' + res.bonus + ' bonus' : '')],
      ['clock', '#bfe8ff', 'Time', formatTime(res.time) + (res.newBest && res.prevBest ? '   new best!' : res.prevBest ? '   best ' + formatTime(Math.min(res.prevBest, res.time)) : '')],
      ['gem', '#4aff8a', 'Gems', res.gems.filter(Boolean).length + ' / 3' + (res.newGems ? '   +' + res.newGems + ' to spend' : '')]
    ];
    if (res.mode !== 'daily')
      rows.push(['skull', '#ff8a6a', 'Knock-outs', String(res.deaths)]);
    rows.forEach((rw, i) => {
      const y = 350 + i * 40;
      drawIcon(rw[0], rw[1], VIEW_W / 2 - 250, y, 26);
      ctx.textAlign = 'left';
      ui.fitText(rw[2], VIEW_W / 2 - 226, y + 1, 160, 17, { color: ui.UI.textDim });
      ctx.textAlign = 'right';
      ui.fitText(rw[3], VIEW_W / 2 + 260, y + 1, 360, 18, { weight: 'bold', color: '#ffffff' });
    });
    if (res.unlockedWorld)
      ui.drawChip(WORLDS[res.unlockedWorld].name + ' unlocked!', VIEW_W / 2, 518, 30, { align: 'center', px: 15, color: WORLDS[res.unlockedWorld].color });
    const y = 560;
    const hasNext = res.mode === 'adventure' && !(res.world === 4 && Levels.CAMPAIGN[res.world][5].id === G.run.spec.id);
    const next = () => {
      const idx = G.run.spec.index;
      if (idx < 5) Session.startCampaign(res.world, idx + 1, 'adventure');
      else if (res.world < 4) Session.startCampaign(res.world + 1, 0, 'adventure');
    };
    if (hasNext)
      Menu.drawButton('rnext', 'Next', VIEW_W / 2 - 330, y, 150, 54, { action: next, key: 'Enter', accent: W.color });
    Menu.drawButton('rretry', 'Retry', VIEW_W / 2 - 165, y, 150, 54, { action: Session.restartLevel, key: 'R' });
    Menu.drawButton('rtree', 'Tech Tree', VIEW_W / 2, y, 160, 54, { action: () => Tree.openTree('results'), key: 'T' });
    Menu.drawButton('rmap', res.mode === 'daily' ? 'Title' : 'Map', VIEW_W / 2 + 175, y, 150, 54, { action: Pause.quitToMenu, key: 'Esc' });
  }

  Object.assign(NS.module('results'), {
    drawResults
  });
})();
