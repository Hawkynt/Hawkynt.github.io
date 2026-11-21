/* The belt map: Kessler Station and the five belts on a star chart joined by jump lanes, each
   shown by its planet with name, danger and ore; the detail panel with the belt's loop, hazards,
   ore mix and licence progress, or its operations (list with moods and records, the brief,
   goals, limit and reward); launching a free trip or an operation into an open belt and buying
   the next licence (which plays the new-belt cinematic). The backdrop follows the highlighted
   belt. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { ZONES, ORE_BY_ID } = NS.ores;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const O = NS.ops;
  const { MOODS } = NS.opsData;
  const scr = NS.screens;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const POS = [[300, 330], [500, 220], [700, 340], [900, 210], [1090, 320]];
  const HAZ = { volatile: 'Volatile rocks', radiation: 'Radiation fields', storm: 'Solar storms', gravity: 'Gravity wells' };

  function draw() {
    const save = G.save;
    const sel = Math.max(0, Math.min(ZONES.length - 1, G.ui.mapSel));
    if (NS.backdrop.current() !== sel) NS.backdrop.setZone(sel);
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(0,0,10,0.45)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('BELT MAP', 40, 40, 30, '#ffffff', { weight: 'bold' });
    kit.text('Choose a belt and an operation - the capstone of a belt and your earnings open the next licence', 40, 70, 13, UI.textDim);
    kit.credits(save.credits, 1240, 46, 24, 'right');

    /* jump lanes */
    ctx.lineWidth = 2;
    for (let i = 0; i < ZONES.length; ++i) {
      const a = i ? POS[i - 1] : [120, 420], b = POS[i];
      const open = rules.zoneState(save, i) === 'open';
      ctx.strokeStyle = open ? K.rgba(UI.gold, 0.6) : 'rgba(140,150,180,0.25)';
      ctx.setLineDash(open ? [] : [8, 8]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 60, b[0], b[1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    /* the station */
    NS.stationArt.draw(ctx, 120, 420, 0.14, save.modules, G.time);
    kit.text('Kessler Station', 120, 486, 12, UI.textDim, { align: 'center' });

    for (let i = 0; i < ZONES.length; ++i) node(save, i, i === sel);
    detail(save, sel);
    W.button('back', 'Station', 40, 650, 180, 46, { action: () => scr.setScreen('station'), icon: 'back' });
  }

  function node(save, i, isSel) {
    const z = ZONES[i];
    const p = POS[i];
    const state = rules.zoneState(save, i);
    const hot = W.area('zone_' + i, p[0] - 70, p[1] - 70, 140, 150, () => {
      if (G.ui.mapSel === i) act(save, i);
      else G.ui.mapSel = i;
    });
    if (hot) G.ui.mapSel = i;
    const pl = NS.backdropArt.planet(z.id, z.theme.planet);
    ctx.globalAlpha = state === 'locked' ? 0.35 : 1;
    if (isSel) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + Math.sin(G.time * 3) * 0.15;
      K.blit(ctx, K.glow(z.theme.accent), p[0], p[1], 3.4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    const sc = 110 / pl.w * (isSel ? 1.12 : 1);
    K.blit(ctx, pl, p[0], p[1], sc);
    ctx.globalAlpha = 1;
    /* a ring of rubble marks the belt */
    ctx.strokeStyle = K.rgba(z.theme.accent, state === 'locked' ? 0.15 : 0.45);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 5]);
    ctx.lineDashOffset = -G.time * 6;
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], 66, 22, -0.3, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    kit.text(z.name, p[0], p[1] + 62, 15, isSel ? '#ffffff' : UI.text, { align: 'center', weight: 'bold' });
    kit.text('*****'.slice(0, z.danger), p[0], p[1] + 80, 13, state === 'locked' ? UI.textMute : UI.warn, { align: 'center' });
    if (state === 'locked') kit.lock(p[0] + 34, p[1] - 34, 20);
    else if (state === 'buyable') kit.text('LICENCE', p[0], p[1] - 60, 12, UI.gold, { align: 'center', weight: 'bold' });
  }

  function detail(save, i) {
    const z = ZONES[i];
    const state = rules.zoneState(save, i);
    const x = 250, y = 520, w = 990, h = 180;
    kit.panel(x, y, w, h, { accent: z.theme.accent, glow: true });
    kit.text(z.name.toUpperCase(), x + 24, y + 30, 24, '#ffffff', { weight: 'bold' });
    const ops = O.zoneOps(z.id);
    const tab = ops.length && G.ui.mapTab !== 'belt' ? 'ops' : 'belt';
    if (ops.length) {
      W.button('tab_ops', 'Operations', x + w - 250, y + 12, 112, 28, { px: 12, selected: tab === 'ops', action: () => { G.ui.mapTab = 'ops'; } });
      W.button('tab_belt', 'Belt', x + w - 132, y + 12, 112, 28, { px: 12, selected: tab === 'belt', action: () => { G.ui.mapTab = 'belt'; } });
    }
    if (tab === 'ops') opsPanel(save, z, ops, x, y);
    else beltPanel(z, x, y);
    actions(save, i, z, state, tab, x, y, w, h);
  }

  function beltPanel(z, x, y) {
    kit.text(z.sub + '  -  ' + O.loopOf(z.index).name, x + 24, y + 56, 14, z.theme.accent);
    kit.wrap(z.blurb, x + 24, y + 76, 380, 13, 18, UI.textDim);
    /* ore mix */
    kit.text('ORE', x + 440, y + 26, 12, UI.textMute, { weight: 'bold' });
    const ids = Object.keys(z.ores).sort((a, b) => z.ores[b] - z.ores[a]);
    let tot = 0;
    for (let k = 0; k < ids.length; ++k) tot += z.ores[ids[k]];
    for (let k = 0; k < ids.length; ++k) {
      const o = ORE_BY_ID[ids[k]];
      const yy = y + 48 + k * 22;
      K.blit(ctx, NS.rockArt.nugget(o.id, 0), x + 450, yy, 1);
      kit.text(o.name, x + 466, yy, 13, o.glow);
      kit.bar(x + 570, yy - 4, 70, 7, z.ores[ids[k]] / tot * 2, o.color);
    }
    kit.text('HAZARDS', x + 670, y + 26, 12, UI.textMute, { weight: 'bold' });
    let hy = y + 48;
    for (const k in z.hazards) {
      kit.text(HAZ[k], x + 670, hy, 13, UI.text);
      hy += 20;
    }
    if (z.pirates) kit.text('Pirates', x + 670, hy, 13, UI.bad);
  }

  /* the selected operation of the belt (the first still open, else the last) */
  function selectedOp(save, ops) {
    const cur = ops.find(o => o.id === G.ui.opSel);
    if (cur) return cur;
    return ops.find(o => O.state(save, o.id) === 'open') || ops[ops.length - 1];
  }

  function goalLine(op) {
    return op.goals.map(g => g.text + ' ' + kit.group(g.n)).join('  -  ');
  }

  function opsPanel(save, z, ops, x, y) {
    const sel = selectedOp(save, ops);
    const st = O.state(save, sel.id);
    const mood = MOODS[sel.mood];
    kit.text(mood.name.toUpperCase() + (sel.capstone ? '  -  CAPSTONE' : ''), x + 24, y + 56, 13, mood.color, { weight: 'bold' });
    if (st === 'locked') kit.wrap('Opens after the operation before it.', x + 24, y + 76, 380, 13, 18, UI.textMute);
    else kit.wrap(sel.brief, x + 24, y + 76, 380, 12, 16, UI.textDim);
    const rw = sel.reward || {};
    kit.fitText(goalLine(sel) + (sel.time ? '  -  ' + Math.round(sel.time / 60) + ' min' : ''), x + 24, y + 150, 380, 12, { color: UI.text });
    const rec = save.ops[sel.id];
    kit.text(rec && rec.done ? 'Cleared - best ' + rec.best + ' s' : 'Reward ' + kit.group(rw.cr || 0) + ' cr, ' + (rw.rd || 0) + ' research' + (rw.unlock ? ' and an unlock' : ''),
      x + 24, y + 168, 12, rec && rec.done ? UI.good : UI.gold);
    for (let k = 0; k < ops.length; ++k) {
      const o = ops[k], os = O.state(save, o.id), yy = y + 22 + k * 20;
      const hot = W.area('op_' + o.id, x + 430, yy - 9, 300, 19, () => { G.ui.opSel = o.id; });
      if (o === sel || hot) {
        ctx.fillStyle = o === sel ? 'rgba(255,210,90,0.16)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 430, yy - 9, 300, 19);
      }
      ctx.fillStyle = MOODS[o.mood].color;
      ctx.beginPath();
      ctx.arc(x + 442, yy, 4, 0, TAU);
      ctx.fill();
      kit.fitText(o.name, x + 454, yy, 220, 13, { color: os === 'locked' ? UI.textMute : o === sel ? '#ffffff' : UI.text, weight: o.capstone ? 'bold' : undefined });
      if (os === 'done') kit.text('\u2713', x + 718, yy, 13, UI.good, { align: 'right', weight: 'bold' });
      else if (os === 'locked') kit.lock(x + 712, yy, 10);
    }
  }

  function actions(save, i, z, state, tab, x, y, w, h) {
    const bx = x + w - 250, by = y + h - 64;
    if (state === 'open') {
      const ops = O.zoneOps(z.id);
      const sel = tab === 'ops' ? selectedOp(save, ops) : null;
      if (sel && O.state(save, sel.id) !== 'locked') {
        W.button('go_free', 'Free mining', bx, by - 52, 230, 40, { icon: 'launch', action: () => act(save, i), px: 15 });
        W.button('go_op', O.state(save, sel.id) === 'done' ? 'Replay operation' : 'Launch operation', bx, by, 230, 48,
          { accent: UI.gold, icon: 'launch', action: () => scr.launch('career', i, { op: sel.id }), px: 17 });
      } else W.button('go', 'Launch', bx, by, 230, 48, { accent: UI.gold, icon: 'launch', action: () => act(save, i), px: 20 });
    } else if (state === 'buyable') {
      W.button('buy', 'Buy licence  ' + kit.group(z.unlock.fee), bx, by, 230, 48, { accent: UI.gold, disabled: save.credits < z.unlock.fee, action: () => act(save, i) });
    } else {
      const prev = ZONES[i - 1];
      const prevOpen = !prev || save.licenses.indexOf(prev.id) >= 0;
      const cap = prev && O.capstoneOf(prev.id);
      const need = !prevOpen ? 'License ' + prev.name + ' first' : !O.licenceReady(save, i) ? 'Clear ' + cap.name + ' first' :
        'Earn ' + kit.group(z.unlock.earned) + ' credits in total';
      kit.fitText(need, bx + 115, by + 6, 230, 13, { color: UI.bad, align: 'center' });
      if (prevOpen) kit.bar(bx + 10, by + 22, 210, 8, save.stats.earned / z.unlock.earned, UI.gold);
      kit.text(kit.group(save.stats.earned) + ' / ' + kit.group(z.unlock.earned), bx + 115, by + 44, 12, UI.textDim, { align: 'center' });
    }
  }

  function act(save, i) {
    const state = rules.zoneState(save, i);
    if (state === 'open') {
      scr.launch('career', i);
    } else if (state === 'buyable') {
      if (!rules.buyLicense(save, i)) {
        sfx('error');
        return;
      }
      NS.save.writeSave();
      NS.economy.refillContracts(save, G.stats, NS.rng.fx);
      NS.cinematics.play('milestone', { zone: ZONES[i] }, () => scr.setScreen('map'));
    } else sfx('error');
  }

  Object.assign(NS.map, {
    POS, draw, act
  });
})();
