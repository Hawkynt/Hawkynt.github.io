/* The in-game HUD around the playfield: hold and power slots on the left with the objective and
   its progress (and the third-star bonus), next pieces and score, level, lines and time on the
   right, the guardian with its health bar and incoming warning on the far right (or the cast
   with today's mode info), the cast's call-out bubble, the combo meter, active effects (Slow
   Time, Score Rush, Aegis, Second Chance) and the touch buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const BR = NS.boardRender;
  const { BOARD_X, BOARD_Y, UI } = C;
  const { POWER_BY_ID } = NS.metaData;
  const { ctx } = NS.view;

  function clock(t) {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  function draw() {
    const run = G.run;
    if (!run) return;
    const g = run.game;
    const fog = run.bossState ? run.bossState.fogT : 0;
    let nh;
    if (g.match) {
      chainPanel(g, 300, BOARD_Y);
      objective(run, 300, BOARD_Y + 132);
      nh = NS.matchRender.drawNext(g, 810, BOARD_Y);
    } else {
      BR.drawHold(g, 300, BOARD_Y);
      powers(run, 300, BOARD_Y + 132);
      objective(run, 300, BOARD_Y + 132 + 26 + run.slots * 58 + 10);
      nh = BR.drawNext(g, 810, BOARD_Y, fog);
    }
    stats(run, 810, BOARD_Y + nh + 12);
    side(run);
    combo(g);
    calloutBubble();
    W.button('g-pause', 'Pause', 1140, 660, 110, 44, { icon: 'pause', px: 15, action: () => NS.screens.pause() });
    if (G.input.touch) touchButtons(run);
  }

  /* Pairs and Jewels: the chain in progress and the best one */
  function chainPanel(g, x, y) {
    kit.panel(x, y, 170, 120, { accent: UI.gold, glow: g.chain > 1 && !!g.popping });
    kit.text('CHAIN', x + 14, y + 18, 13, UI.textDim, { weight: 'bold' });
    kit.text(g.popping ? 'x' + g.chain : '-', x + 85, y + 62, g.popping && g.chain > 1 ? 40 : 28, g.chain > 1 ? UI.gold : '#ffffff', { align: 'center', weight: 'bold' });
    kit.text('best x' + g.stats.bestChain, x + 85, y + 102, 12, UI.textDim, { align: 'center' });
  }

  function powers(run, x, y) {
    const h = 26 + run.slots * 58;
    kit.panel(x, y, 170, h, { accent: '#ff9a3a' });
    kit.text('POWERS', x + 14, y + 16, 13, UI.textDim, { weight: 'bold' });
    kit.text('E', x + 156, y + 16, 11, UI.textMute, { align: 'right' });
    for (let i = 0; i < run.slots; ++i) {
      const py = y + 28 + i * 58;
      const id = run.powers[i];
      const pw = id ? POWER_BY_ID[id] : null;
      const hot = W.area('pw' + i, x + 8, py, 154, 50, id ? () => NS.input.usePower(i) : null, { disabled: !id, nonav: true });
      K.roundRect(ctx, x + 8, py, 154, 50, 10);
      ctx.fillStyle = pw ? K.rgba(pw.color, hot ? 0.35 : 0.2) : 'rgba(0,0,0,0.3)';
      ctx.fill();
      if (pw) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(G.time * 4 + i);
        K.blit(ctx, K.glow(pw.color), x + 34, py + 25, 0.5);
        ctx.restore();
        kit.icon(pw.icon, x + 34, py + 25, 26, pw.color);
        kit.fitText(pw.name, x + 56, py + 18, 100, 14, { weight: 'bold', color: '#ffffff' });
        kit.fitText(pw.desc, x + 56, py + 35, 100, 10, { color: UI.textDim });
      } else kit.text('empty - clear an orb', x + 85, py + 25, 11, UI.textMute, { align: 'center' });
    }
  }

  function objective(run, x, y) {
    const o = NS.run.objective(run);
    const st = run.stage ? NS.worldData.BY_ID[run.stage] : null;
    const h = st ? 170 : 110;
    kit.panel(x, y, 170, h, { accent: UI.gold });
    kit.text(st ? 'GOAL' : NS.metaData.MODE_BY_ID[run.mode].name.toUpperCase(), x + 14, y + 16, 13, UI.textDim, { weight: 'bold' });
    kit.wrap(o.text, x + 14, y + 40, 146, 13, '#ffffff', { weight: 'bold' });
    if (o.need) {
      kit.bar(x + 14, y + 74, 142, 10, o.have / o.need, UI.gold);
      const label = run.kind === 'survive' || run.kind === 'ultra' || run.kind === 'daily' ? clock(Math.max(0, o.need - o.have)) + ' left'
        : run.kind === 'boss' || run.kind === 'rush' ? Math.max(0, run.bossState.hp) + ' HP left' : Math.floor(o.have) + ' / ' + o.need;
      kit.text(label, x + 85, y + 96, 12, UI.textDim, { align: 'center' });
    } else kit.text(run.mode === 'zen' ? 'Breathe. Stack. Relax.' : run.vs ? (run.game.match ? 'Bursts and chains send stones' : 'Doubles and up send garbage') : 'Survive as long as you can', x + 85, y + 82, 12, UI.textDim, { align: 'center' });
    if (st) {
      const b = st.bonus;
      const met = NS.run.bonusMet(run, b);
      kit.text('PAR ' + clock(st.par), x + 14, y + 122, 11, run.t <= st.par ? UI.good : UI.textMute, { weight: 'bold' });
      kit.icon('star', x + 20, y + 146, 14, met ? UI.gold : 'rgba(140,150,180,0.6)');
      kit.fitText(NS.run.bonusText(b), x + 32, y + 147, 130, 11, { color: met ? UI.gold : UI.textDim });
    }
    if (run.timeLimit && run.kind !== 'survive' && run.kind !== 'ultra' && run.kind !== 'daily') {
      const left = run.timeLimit - run.t;
      kit.text(clock(left), x + 85, y + h + 22, 22, left < 15 ? UI.bad : '#ffffff', { align: 'center', weight: 'bold' });
    }
  }

  function stats(run, x, y) {
    const g = run.game;
    const h = Math.max(150, BOARD_Y + 600 - y);
    kit.panel(x, y, 170, h, { accent: UI.accent });
    const rows = [['SCORE', g.score.toLocaleString('en-US')], ['LEVEL', String(g.level)], [g.match ? 'CLEARED' : run.rule === 'blast' ? 'BLASTS' : 'LINES',
      String(run.rule === 'blast' ? g.stats.blasts : g.lines)], ['TIME', clock(run.t)]];
    const step = Math.min(56, (h - 16) / rows.length);
    for (let i = 0; i < rows.length; ++i) {
      const ry = y + 18 + i * step;
      kit.text(rows[i][0], x + 14, ry, 11, UI.textDim, { weight: 'bold' });
      kit.fitText(rows[i][1], x + 156, ry + 20, 142, 20, { color: '#ffffff', weight: 'bold', align: 'right' });
    }
  }

  /* the CPU rival: its board at a smaller scale, name, strength and the rows sent both ways */
  const RIVAL_X = 1012, RIVAL_Y = 118, RIVAL_S = 0.62;
  function rival(run) {
    const vs = run.vs;
    const def = NS.versus.CPU_BY_ID[vs.cpu];
    kit.panel(1000, 46, 240, 62, { accent: def.color, glow: run.rival.over });
    kit.icon('swords', 1024, 77, 22, def.color);
    kit.fitText('CPU  ' + def.name.toUpperCase(), 1044, 70, 186, 17, { weight: 'bold', color: '#ffffff' });
    kit.fitText('sent ' + vs.rival.sent + '  -  took ' + vs.rival.received, 1044, 92, 186, 11, { color: UI.textDim });
    ctx.save();
    ctx.translate(RIVAL_X, RIVAL_Y);
    ctx.scale(RIVAL_S, RIVAL_S);
    ctx.translate(-(BOARD_X - 14), -(BOARD_Y - 14));
    BR.drawBoard(run.rival, { rival: true });
    ctx.restore();
    if (run.rival.over) kit.text('K.O.!', RIVAL_X + 102, RIVAL_Y + 200, 44, UI.gold, { align: 'center', weight: 'bold', shadow: true });
    const y = RIVAL_Y + 400;
    kit.panel(1000, y, 240, 84, { accent: UI.accent });
    kit.text('YOU', 1016, y + 18, 12, UI.textDim, { weight: 'bold' });
    kit.fitText('sent ' + vs.you.sent + '  -  cancelled ' + vs.you.cancelled + '  -  took ' + vs.you.received, 1016, y + 40, 210, 12, { color: '#ffffff' });
    const n = NS.versus.pending(run, 'you');
    const unit = run.game.match ? ' STONE' : ' ROW';
    if (n > 0) kit.text('INCOMING ' + n + unit + (n > 1 ? 'S' : ''), 1120, y + 66, 15, UI.bad, { align: 'center', weight: 'bold' });
    else kit.text('speed ' + vs.level + '  -  faster every ' + NS.versus.SPEEDUP + 's', 1120, y + 66, 11, UI.textDim, { align: 'center' });
  }

  function side(run) {
    if (run.vs) return rival(run);
    const bs = run.bossState;
    const g = run.game;
    if (bs) {
      const b = NS.worldData.BOSSES[bs.w];
      NS.bossArt.drawBoss(bs.w, 1110, 560, bs, 0.95);
      kit.panel(1000, 60, 240, 92, { accent: b.color, glow: bs.rage });
      kit.fitText(b.name, 1016, 82, 210, 18, { weight: 'bold', color: '#ffffff' });
      kit.fitText(b.title + (bs.rage ? '  -  ENRAGED' : ''), 1016, 102, 210, 11, { color: bs.rage ? UI.bad : UI.textDim });
      kit.bar(1016, 116, 208, 16, bs.hp / bs.max, bs.rage ? '#ff4a4a' : b.color);
      kit.text(bs.hp + ' / ' + bs.max, 1120, 124, 11, '#ffffff', { align: 'center', weight: 'bold' });
      if (bs.incoming > 0) {
        kit.panel(1000, 162, 240, 40, { accent: UI.bad, glow: true });
        kit.text('INCOMING ' + bs.incoming + ' ROW' + (bs.incoming > 1 ? 'S' : '') + '  ' + bs.landT.toFixed(1) + 's', 1120, 182, 14, UI.bad, { align: 'center', weight: 'bold' });
      } else {
        kit.text('next attack ' + Math.max(0, bs.atkT).toFixed(0) + 's', 1120, 182, 12, UI.textDim, { align: 'center' });
      }
      if (run.mode === 'rush') kit.text('Guardian ' + (run.rushIndex + 1) + ' of 5', 1120, 214, 13, UI.gold, { align: 'center', weight: 'bold' });
    } else {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(NS.bossArt.portrait('kip'), 1040, 470, 150, 150);
      ctx.drawImage(NS.bossArt.portrait('ollo'), 1110, 500, 130, 130);
      ctx.globalAlpha = 1;
      if (run.mutators.length) {
        kit.panel(1000, 60, 240, 30 + run.mutators.length * 40, { accent: '#ff7ad8' });
        kit.text('MUTATORS', 1016, 76, 12, UI.textDim, { weight: 'bold' });
        run.mutators.forEach((id, i) => {
          const m = NS.seasons.MUT_BY_ID[id];
          kit.fitText(m.name, 1016, 98 + i * 40, 210, 14, { weight: 'bold', color: '#ffffff' });
          kit.fitText(m.desc, 1016, 114 + i * 40, 210, 10, { color: UI.textDim });
        });
      }
    }
    let ey = bs ? 236 : 70 + (run.mutators.length ? 40 + run.mutators.length * 40 : 0);
    const effects = [];
    if (g.slowT > 0) effects.push(['clock', 'Slow Time ' + g.slowT.toFixed(0) + 's', '#8fd0ff']);
    if (run.rushT > 0) effects.push(['star', 'Score Rush ' + run.rushT.toFixed(0) + 's', UI.gold]);
    if (run.shield) effects.push(['shield', 'Aegis ready', '#c8a0ff']);
    if (run.revives > 0) effects.push(['sparkle', 'Second Chance', UI.good]);
    if (bs && bs.holdLockT > 0) effects.push(['leaf', 'Hold seized ' + bs.holdLockT.toFixed(0) + 's', '#7be08a']);
    if (bs && bs.heatT > 0) effects.push(['bolt', 'Heat wave ' + bs.heatT.toFixed(0) + 's', '#ff8a3a']);
    for (const e of effects) {
      kit.panel(1000, ey, 240, 34, { radius: 17, accent: e[2] });
      kit.icon(e[0], 1020, ey + 17, 18, e[2]);
      kit.fitText(e[1], 1036, ey + 18, 196, 13, { weight: 'bold', color: '#ffffff' });
      ey += 40;
    }
  }

  function combo(g) {
    if (g.combo < 1 || g.match) return;
    const x = BOARD_X + 150, y = BOARD_Y - 30;
    const k = Math.min(1, g.combo / 10);
    kit.text(g.combo + ' COMBO', x, y, 18 + k * 10, K.mix('#ffd25a', '#ff5a8a', k), { align: 'center', weight: 'bold', shadow: true });
  }

  function calloutBubble() {
    const c = G.ui.callout;
    if (!c) return;
    const run = G.run;
    const a = Math.min(1, c.t * 3);
    ctx.globalAlpha = a;
    const x = 40, y = 470;
    if (c.who === 'boss' && run && run.bossState) {
      kit.panel(x, y, 240, 110, { accent: NS.worldData.BOSSES[run.bossState.w].color, glow: true });
      kit.fitText(NS.worldData.BOSSES[run.bossState.w].name, x + 16, y + 20, 210, 14, { weight: 'bold', color: NS.worldData.BOSSES[run.bossState.w].accent });
    } else {
      const who = c.who === 'boss' ? 'kip' : c.who;
      ctx.drawImage(NS.bossArt.portrait(who), x - 10, y - 110, 120, 120);
      kit.panel(x, y, 240, 110, { accent: NS.storyData.CAST[who].accent, glow: true });
      kit.fitText(NS.storyData.CAST[who].name, x + 16, y + 20, 210, 14, { weight: 'bold', color: NS.storyData.CAST[who].accent });
    }
    kit.wrap(c.text, x + 16, y + 46, 210, 14, '#ffffff');
    ctx.globalAlpha = 1;
  }

  /* big buttons for touch screens, left and right of the well */
  function touchButtons(run) {
    const btn = (id, label, icon, x, y, w, h, fn) => W.button(id, label, x, y, w, h, { icon: icon, px: 13, action: fn });
    btn('t-hold', 'Hold', 'back', 300, 600, 80, 56, () => NS.input.act('hold'));
    btn('t-pow', 'Power', 'bolt', 390, 600, 80, 56, () => NS.input.usePower(0));
    btn('t-ccw', 'Turn L', 'spin', 810, 600, 80, 56, () => NS.input.act('ccw'));
    btn('t-cw', 'Turn R', 'spin', 900, 600, 80, 56, () => NS.input.act('cw'));
  }

  Object.assign(NS.hud, { clock, draw, powers, objective, stats, side, rival, combo, calloutBubble, RIVAL_X, RIVAL_Y, RIVAL_S });
})();
