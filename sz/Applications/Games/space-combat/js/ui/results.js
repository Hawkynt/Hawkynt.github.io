/* The results screen: victory or defeat banner, stars popping in one by one with bursts,
   counting statistics, the scrap payout and new bests, then the next steps (next mission, retry,
   map, hangar, tech tree, title). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { MISSIONS, MODES } = NS.campaign;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const STAR_T = [0.9, 1.35, 1.8];
  let popped = 0;
  let lastRes = null;

  function count(v, t0, dur) {
    const t = G.ui.results.t;
    const k = Math.max(0, Math.min(1, (t - t0) / dur));
    return Math.round(v * (1 - (1 - k) * (1 - k)));
  }

  function draw() {
    const r = G.ui.results;
    if (!r) { scr.setScreen('title'); return; }
    if (r !== lastRes) { lastRes = r; popped = 0; }
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,12,0.6)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const accent = r.won ? UI.good : UI.bad;
    const t = r.t;

    /* banner */
    const k = Math.min(1, t * 2.5);
    ctx.save();
    ctx.translate(640, 110);
    ctx.scale(0.6 + k * 0.4, 0.6 + k * 0.4);
    ctx.globalAlpha = k;
    kit.text(r.title.toUpperCase(), 0, 0, 52, '#ffffff', { align: 'center', weight: 'bold' });
    ctx.restore();
    const sub = r.mode === 'campaign' ? r.stage.name : MODES[r.mode].name;
    kit.text(sub + (r.reason && !r.won ? '  -  ' + r.reason : ''), 640, 160, 18, accent, { align: 'center', weight: 'bold' });

    const x = 330, y = 190, w = 620, h = 400;
    kit.panel(x, y, w, h, { accent: accent, glow: true });

    let yy = y + 40;
    if (r.mode === 'campaign') {
      for (let i = 0; i < 3; ++i) {
        const sx = 640 + (i - 1) * 110, sy = y + 70;
        const earned = i < r.stars;
        const st = STAR_T[i];
        if (earned && t >= st && popped <= i) {
          popped = i + 1;
          NS.fx.sparks(sx, sy, 0, TAU, 26, '#ffd25a', 360, 0.6);
          NS.fx.ring(sx, sy, 20, 90, 0.5, '#ffd25a', 5);
          sfx('coin', { pitch: 1 + i * 0.2 });
        }
        const pk = earned ? Math.max(0, Math.min(1, (t - st) / 0.25)) : 1;
        const bounce = earned && pk < 1 ? 1.6 - pk * 0.6 : 1;
        kit.star(sx, sy, 34 * (earned ? (t >= st ? bounce : 0.001) : 1), false);
        if (earned && t >= st) kit.star(sx, sy, 34 * bounce, true);
      }
      const goals = ['Completed', 'Hull 50%+', 'Par time ' + NS.briefing.mmss(r.stage.par)];
      for (let i = 0; i < 3; ++i)
        kit.text(goals[i], 640 + (i - 1) * 110, y + 124, 12, i < r.stars ? UI.gold : UI.textMute, { align: 'center' });
      yy = y + 160;
    } else {
      kit.text(r.mode === 'endless' ? 'Waves survived: ' + r.waves : 'Stages cleared: ' + r.waves, 640, y + 60, 26, '#ffffff', { align: 'center', weight: 'bold' });
      if (r.newBest && t > 1) {
        const p = 1 + Math.sin(t * 6) * 0.05;
        ctx.save();
        ctx.translate(640, y + 104);
        ctx.scale(p, p);
        kit.text('NEW BEST!', 0, 0, 24, UI.gold, { align: 'center', weight: 'bold' });
        ctx.restore();
      }
      yy = y + 150;
    }

    const rows = [
      ['Score', count(r.score, 0.6, 1.2)],
      ['Enemies destroyed', count(r.kills, 0.7, 1)],
      ['Best combo', count(r.bestCombo, 0.8, 0.8)],
      [r.mode === 'campaign' ? 'Mission time' : 'Run time', NS.briefing.mmss(r.time)],
    ];
    for (let i = 0; i < rows.length; ++i) {
      kit.text(rows[i][0], x + 60, yy + i * 30, 16, UI.textDim);
      kit.text(String(rows[i][1]), x + w - 60, yy + i * 30, 17, '#ffffff', { align: 'right', weight: 'bold' });
    }
    yy += rows.length * 30 + 14;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x + 50, yy - 10, w - 100, 1);
    kit.text('Scrap collected', x + 60, yy + 10, 15, UI.textDim);
    kit.credits(count(r.collected, 1.2, 0.8), x + w - 60, yy + 10, 16, 'right');
    kit.text(r.mode === 'campaign' ? 'Mission reward' : 'Score bonus', x + 60, yy + 38, 15, UI.textDim);
    kit.credits(count(r.reward, 1.5, 0.8), x + w - 60, yy + 38, 16, 'right');
    kit.text('TOTAL', x + 60, yy + 72, 18, UI.gold, { weight: 'bold' });
    kit.credits(count(r.total, 1.8, 1), x + w - 60, yy + 72, 22, 'right');

    NS.fxRender.draw({ x0: -200, y0: -200, x1: 1500, y1: 900 });
    drawButtons(r);
  }

  function retry(r) {
    if (r.mode === 'campaign') NS.missions.startRun('campaign', { sector: r.stage.sector, index: r.stage.index });
    else NS.missions.startRun(r.mode);
  }

  function drawButtons(r) {
    const y = 616, h = 50;
    const btns = [];
    if (r.mode === 'campaign') {
      const s = r.stage.sector, i = r.stage.index;
      let ns = s, ni = i + 1;
      if (ni >= 6) { ns = s + 1; ni = 0; }
      const hasNext = r.won && ns < MISSIONS.length && rules.missionUnlocked(G.save, ns, ni);
      if (hasNext) btns.push(['Next Mission', () => { G.ui.mapSector = ns; NS.map.openBriefing(ns, ni); }, UI.good]);
      btns.push(['Retry', () => retry(r)]);
      btns.push(['Sector Map', () => { G.ui.mapSector = r.won && hasNext ? ns : s; scr.setScreen('map'); }]);
    } else {
      btns.push(['Play Again', () => retry(r), UI.good]);
      btns.push(['Title', () => scr.setScreen('title')]);
    }
    btns.push(['Tech Tree', () => scr.openTree('results')]);
    btns.push(['Hangar', () => scr.openHangar('title')]);
    const bw = 200, gap = 14;
    const total = btns.length * bw + (btns.length - 1) * gap;
    for (let i = 0; i < btns.length; ++i)
      W.button('res' + i, btns[i][0], 640 - total / 2 + i * (bw + gap), y, bw, h, { action: btns[i][1], accent: btns[i][2] });
  }

  Object.assign(NS.results, {
    draw
  });
})();
