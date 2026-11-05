/* The trip report: how the trip ended, the hold unloaded line by line with counting values,
   salvage, research, the service bill, the market news and new achievements (career); or the
   score, best and career bonus (Gold Rush, Daily Belt). Continue goes to the station or the
   title, Again relaunches a mode. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { ORES } = NS.ores;
  const { MODES } = NS.goals;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const eco = NS.economy;
  const { ctx } = NS.view;

  const HEAD = {
    dock: ['DOCKED', 'Clean run - the whole hold is in the warehouse', UI.good],
    tow: ['TOWED HOME', 'The tow crew kept their share of the hold', UI.warn],
    destroyed: ['SHIP LOST', 'The salvage crew brought the wreck home - the hold is gone', UI.bad],
    time: ['TIME UP', 'The belt closes', UI.gold],
  };

  function leave() {
    const r = G.ui.results;
    if (r && r.mode === 'career') scr.setScreen('station');
    else scr.setScreen('title');
  }

  function count(v, r, delay) {
    return Math.round(v * Math.min(1, Math.max(0, (r.t - delay) / 0.8)));
  }

  function draw() {
    const r = G.ui.results;
    if (!r) return;
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,12,0.6)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const head = HEAD[r.reason] || HEAD.dock;
    const career = r.mode === 'career';
    const jump = (r.reason === 'tow' || r.reason === 'destroyed') && r.jump;
    const x = 290, y = 70, w = 700, h = 560;
    kit.panel(x, y, w, h, { glow: true, accent: head[2] });
    const pop = Math.min(1, r.t * 3);
    ctx.globalAlpha = pop;
    kit.text(career ? 'TRIP REPORT' : MODES[r.mode].name.toUpperCase(), 640, y + 34, 14, UI.textDim, { align: 'center', weight: 'bold' });
    kit.text(head[0], 640, y + 72 - (1 - pop) * 20, 38, head[2], { align: 'center', weight: 'bold' });
    kit.text(jump ? 'The emergency jump saved most of the hold' : head[1], 640, y + 106, 14, UI.text, { align: 'center' });
    ctx.globalAlpha = 1;
    if (career) careerReport(r, x, y, w);
    else modeReport(r, x, y, w);
    const by = y + h - 66;
    if (career) W.button('cont', 'To the station', 640 - 130, by, 260, 48, { accent: UI.gold, icon: 'station', action: leave });
    else {
      W.button('again', 'Again', 640 - 270, by, 250, 48, { accent: UI.gold, action: () => scr.launch(r.mode, r.zone.index) });
      W.button('cont', 'Title', 640 + 20, by, 250, 48, { action: leave });
    }
  }

  function careerReport(r, x, y, w) {
    const save = G.save, st = G.stats;
    let yy = y + 150;
    kit.text('UNLOADED', x + 40, yy, 12, UI.textMute, { weight: 'bold' });
    kit.text('VALUE TODAY', x + w - 40, yy, 12, UI.textMute, { weight: 'bold', align: 'right' });
    yy += 26;
    let i = 0;
    for (let k = 0; k < ORES.length; ++k) {
      const o = ORES[k];
      const n = r.hold[o.id];
      if (!n) continue;
      const d = 0.3 + i * 0.12;
      if (r.t < d) break;
      K.blitRot(ctx, NS.rockArt.nugget(o.id, i % 3), x + 52, yy, 0, 1.3);
      kit.text(count(n, r, d) + '  ' + o.name, x + 72, yy, 15, o.glow, { weight: 'bold' });
      kit.credits(count(n * eco.price(save, st, o.id), r, d), x + w - 40, yy, 14, 'right');
      yy += 26;
      if (++i >= 7) break;
    }
    if (!i && r.t > 0.3) {
      kit.text('Nothing in the hold', x + 52, yy, 15, UI.textMute);
      yy += 26;
    }
    yy += 8;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 40, yy - 12, w - 80, 1);
    const d2 = 0.5 + i * 0.12;
    const line = (label, val, kind, color) => {
      kit.text(label, x + 40, yy, 14, UI.textDim);
      if (kind === 'rd') kit.amount(count(val, r, d2), x + w - 40, yy, 14, 'right', 'rd');
      else if (kind === 'neg') kit.text('-' + kit.group(count(val, r, d2)), x + w - 40, yy, 14, color, { align: 'right', weight: 'bold' });
      else kit.credits(count(val, r, d2), x + w - 40, yy, 14, 'right');
      yy += 24;
    };
    if (r.salvage) line('Salvage', r.salvage, 'cr');
    if (r.rd) line('Research data', r.rd, 'rd');
    if (r.service) line('Refuel and repairs', r.service, 'neg', UI.bad);
    if (r.lost > 0) {
      kit.text(r.lost + ' units lost', x + 40, yy, 14, UI.bad);
      yy += 24;
    }
    kit.text(r.fractures + ' rocks fractured' + (r.kills ? '  -  ' + r.kills + ' pirates destroyed' : ''), x + 40, yy, 13, UI.textMute);
    yy += 30;
    if (r.news) {
      kit.text('MARKET  ' + r.news, 640, yy, 13, UI.warn, { align: 'center', weight: 'bold' });
      yy += 24;
    }
    for (let k = 0; k < r.achievements.length && k < 2; ++k) {
      kit.icon('trophy', x + 52, yy, 18, UI.gold);
      kit.text(r.achievements[k].name + '  -  ' + r.achievements[k].desc, x + 72, yy, 13, UI.gold, { weight: 'bold' });
      yy += 22;
    }
    nextGoal(save, x, y, w);
  }

  /* the career's next step: the warehouse worth and the next licence */
  function nextGoal(save, x, y, w) {
    const yy = y + 420;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    kit.roundRect(x + 30, yy - 16, w - 60, 62, 8);
    ctx.fill();
    kit.text('Warehouse worth', x + 46, yy, 13, UI.textDim);
    kit.credits(eco.storeValue(save, G.stats), x + 46, yy + 24, 16);
    const zi = save.licenses.length;
    const z = NS.ores.ZONES[zi];
    if (z) {
      kit.text('Next licence: ' + z.name, x + 330, yy, 13, UI.textDim);
      kit.bar(x + 330, yy + 18, w - 400, 8, save.stats.earned / z.unlock.earned, z.theme.accent);
      kit.text(kit.group(Math.min(save.stats.earned, z.unlock.earned)) + ' / ' + kit.group(z.unlock.earned) + ' earned', x + 330, yy + 38, 11, UI.textMute);
    } else kit.text(save.crownDone ? 'Every belt charted - the Crown is yours' : 'Every belt charted - find the Crown Heart', x + 330, yy + 12, 13, UI.data, { weight: 'bold' });
  }

  function modeReport(r, x, y, w) {
    const k = Math.min(1, Math.max(0, (r.t - 0.3) / 1.2));
    kit.text('SCORE', 640, y + 170, 14, UI.textDim, { align: 'center', weight: 'bold' });
    kit.text(kit.group(Math.round(r.score * k)), 640, y + 220, 60, UI.gold, { align: 'center', weight: 'bold' });
    if (r.best && k >= 1) {
      const a = 0.6 + Math.sin(G.time * 6) * 0.4;
      ctx.globalAlpha = a;
      kit.text(r.mode === 'daily' ? 'BEST TODAY' : 'NEW BEST', 640, y + 270, 20, UI.good, { align: 'center', weight: 'bold' });
      ctx.globalAlpha = 1;
    }
    let yy = y + 320;
    const rows = [['Rocks fractured', r.fractures], ['Pirates destroyed', r.kills], ['Units mined', r.units + r.lost]];
    for (let i = 0; i < rows.length; ++i) {
      kit.text(rows[i][0], 600, yy, 15, UI.textDim, { align: 'right' });
      kit.text(String(rows[i][1]), 640, yy, 15, '#ffffff', { weight: 'bold' });
      yy += 26;
    }
    if (r.bonus) {
      kit.text('Career bonus', 600, yy, 15, UI.textDim, { align: 'right' });
      kit.credits(r.bonus, 640, yy, 15);
    }
  }

  Object.assign(NS.results, {
    draw, leave
  });
})();
