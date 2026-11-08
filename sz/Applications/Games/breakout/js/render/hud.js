/* The in-game HUD beside the field: on the left the objective with its progress, par and bonus
   goal, the balls in reserve and the running power-ups with their timers; on the right score,
   combo, time and wall, the guardian's health (or the mutators) and the cast's call-out bubble;
   a pause button and, on touch screens, a launch/fire button. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const { UI, POWER_BY_ID } = C;
  const { ctx } = NS.view;

  function clock(t) {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  function draw() {
    const run = G.run;
    if (!run) return;
    const g = run.game;
    objective(run, 30, 60);
    lives(g, 30, 290);
    powers(g, 30, 370);
    stats(run, 1010, 60);
    side(run, 1010, 290);
    calloutBubble();
    W.button('g-pause', 'Pause', 1130, 662, 120, 44, { icon: 'pause', px: 15, action: () => NS.screens.pause() });
    if (G.input.touch && g.balls.some(b => b.stuck || g.paddle.laserT > 0))
      W.button('g-launch', g.paddle.laserT > 0 ? 'Fire' : 'Launch', 30, 640, 240, 60, { icon: 'bolt', accent: UI.gold, action: () => NS.input.tapLaunch() });
  }

  function objective(run, x, y) {
    const o = NS.run.objective(run);
    const st = run.stage ? NS.worldData.BY_ID[run.stage] : null;
    const h = st ? 210 : 130;
    kit.panel(x, y, 240, h, { accent: UI.gold });
    kit.text(st ? st.name.toUpperCase() : NS.metaData.MODE_BY_ID[run.mode].name.toUpperCase(), x + 16, y + 20, 14, UI.textDim, { weight: 'bold' });
    kit.wrap(o.text, x + 16, y + 48, 210, 15, '#ffffff', { weight: 'bold' });
    if (o.need) {
      kit.bar(x + 16, y + 86, 208, 12, o.have / o.need, UI.gold);
      const label = run.kind === 'blitz' || run.kind === 'daily' ? clock(o.need - o.have) + ' left' : Math.floor(o.have) + ' / ' + o.need;
      kit.text(label, x + 120, y + 112, 13, UI.textDim, { align: 'center' });
    }
    if (st) {
      kit.text('PAR ' + clock(st.par), x + 16, y + 140, 12, run.t <= st.par ? UI.good : UI.textMute, { weight: 'bold' });
      const met = NS.run.bonusMet(run, st.bonus);
      kit.icon('star', x + 24, y + 168, 16, met ? UI.gold : 'rgba(140,130,170,0.6)');
      kit.fitText(NS.run.bonusText(st.bonus), x + 40, y + 169, 190, 13, { color: met ? UI.gold : UI.textDim });
      if (run.timeLimit) {
        const left = run.timeLimit - run.t;
        kit.text(clock(left), x + 120, y + 194, 18, left < 15 ? UI.bad : '#ffffff', { align: 'center', weight: 'bold' });
      }
    }
  }

  function lives(g, x, y) {
    kit.panel(x, y, 240, 64, { accent: '#ff5a6a' });
    kit.text('BALLS', x + 16, y + 18, 12, UI.textDim, { weight: 'bold' });
    if (g.infinite) kit.text('unlimited', x + 120, y + 44, 18, '#ffffff', { align: 'center', weight: 'bold' });
    else {
      const img = NS.sprites.ball(NS.fieldRender.ballDef(), 8);
      for (let i = 0; i < Math.min(8, g.lives); ++i) ctx.drawImage(img, x + 14 + i * 26, y + 28);
      if (g.lives > 8) kit.text('+' + (g.lives - 8), x + 226, y + 44, 13, '#ffffff', { align: 'right' });
      if (g.lives === 0) kit.text('last ball!', x + 120, y + 44, 16, UI.bad, { align: 'center', weight: 'bold' });
    }
  }

  function powers(g, x, y) {
    const p = g.paddle;
    const list = [['wide', p.wideT], ['shrink', p.shrinkT], ['laser', p.laserT], ['magnet', p.magnetT], ['slow', g.slowT], ['fast', g.fastT], ['fire', g.fireT], ['mega', g.megaT]].filter(e => e[1] > 0);
    if (g.barrier) list.push(['barrier', 0, g.barrier]);
    for (let i = 0; i < list.length; ++i) {
      const pw = POWER_BY_ID[list[i][0]];
      const yy = y + i * 40;
      kit.panel(x, yy, 240, 34, { radius: 17, accent: pw.color });
      kit.icon(pw.icon, x + 20, yy + 17, 18, pw.color);
      kit.text(pw.name, x + 38, yy + 18, 14, '#ffffff', { weight: 'bold' });
      kit.text(list[i][2] ? 'x' + list[i][2] : list[i][1].toFixed(0) + 's', x + 226, yy + 18, 13, UI.textDim, { align: 'right' });
    }
  }

  function stats(run, x, y) {
    const g = run.game;
    kit.panel(x, y, 240, 210, { accent: UI.accent });
    const rows = [['SCORE', g.score.toLocaleString('en-US')], ['COMBO', g.combo > 1 ? 'x' + g.combo : '-'], ['TIME', clock(run.t)],
      [run.mode === 'story' ? 'BRICKS LEFT' : 'WALL', run.mode === 'story' ? String(NS.engine.remaining(g)) : String(run.wall)]];
    for (let i = 0; i < rows.length; ++i) {
      kit.text(rows[i][0], x + 16, y + 22 + i * 48, 11, UI.textDim, { weight: 'bold' });
      kit.fitText(rows[i][1], x + 224, y + 42 + i * 48, 200, 20, { color: i === 1 && g.combo > 9 ? UI.gold : '#ffffff', weight: 'bold', align: 'right' });
    }
  }

  /* the team of a Duo or Arena run: each partner's portrait, edge and returns */
  function team(run, x, y) {
    const g = run.game;
    const h = 34 + g.mates.length * 62;
    kit.panel(x, y, 240, h, { accent: UI.good });
    kit.text('YOUR TEAM', x + 16, y + 18, 12, UI.textDim, { weight: 'bold' });
    g.mates.forEach((m, i) => {
      const mate = NS.metaData.MATES[m.side];
      const def = NS.metaData.PADDLES.find(p => p.id === mate.paddle) || NS.metaData.PADDLES[0];
      const ry = y + 34 + i * 62;
      ctx.drawImage(NS.bossArt.portrait(mate.who), x + 10, ry, 54, 54);
      kit.fitText(mate.name, x + 72, ry + 18, 156, 15, { weight: 'bold', color: def.accent });
      kit.fitText('guards the ' + m.side + '  -  ' + m.hits + ' saves', x + 72, ry + 38, 156, 11, { color: UI.textDim });
    });
  }

  function side(run, x, y) {
    const g = run.game;
    const bs = g.boss;
    if (g.mates.length) team(run, x, y);
    else if (bs) {
      const b = NS.worldData.BOSSES[bs.w];
      kit.panel(x, y, 240, 100, { accent: b.color, glow: bs.rage });
      kit.fitText(b.name, x + 16, y + 22, 210, 17, { weight: 'bold', color: '#ffffff' });
      kit.fitText(b.title + (bs.rage ? '  -  ENRAGED' : ''), x + 16, y + 42, 210, 11, { color: bs.rage ? UI.bad : UI.textDim });
      kit.bar(x + 16, y + 58, 208, 16, bs.hp / bs.max, bs.rage ? '#ff4a4a' : b.color);
      kit.text(Math.ceil(bs.hp) + ' / ' + bs.max, x + 120, y + 66, 11, '#ffffff', { align: 'center', weight: 'bold' });
      if (run.mode === 'rush') kit.text('Guardian ' + (run.rushIndex + 1) + ' of 5', x + 120, y + 88, 12, UI.gold, { align: 'center', weight: 'bold' });
    } else if (run.mutators.length) {
      kit.panel(x, y, 240, 30 + run.mutators.length * 40, { accent: '#ff7ad8' });
      kit.text('MUTATORS', x + 16, y + 16, 12, UI.textDim, { weight: 'bold' });
      run.mutators.forEach((id, i) => {
        const m = NS.seasons.MUT_BY_ID[id];
        kit.fitText(m.name, x + 16, y + 38 + i * 40, 210, 14, { weight: 'bold', color: '#ffffff' });
        kit.fitText(m.desc, x + 16, y + 54 + i * 40, 210, 10, { color: UI.textDim });
      });
    } else {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(NS.bossArt.portrait('juno'), x + 20, y + 140, 140, 140);
      ctx.drawImage(NS.bossArt.portrait('bolt'), x + 110, y + 190, 110, 110);
      ctx.globalAlpha = 1;
    }
  }

  function calloutBubble() {
    const c = G.ui.callout;
    if (!c) return;
    const run = G.run;
    ctx.globalAlpha = Math.min(1, c.t * 3);
    const x = 1010, y = 450;
    if (c.who === 'boss' && run && run.game.boss) {
      const b = NS.worldData.BOSSES[run.game.boss.w];
      kit.panel(x, y, 240, 100, { accent: b.color, glow: true });
      kit.fitText(b.name, x + 16, y + 20, 210, 14, { weight: 'bold', color: b.accent });
    } else {
      const who = c.who === 'boss' ? 'juno' : c.who;
      kit.panel(x, y, 240, 100, { accent: NS.storyData.CAST[who].accent, glow: true });
      kit.fitText(NS.storyData.CAST[who].name, x + 16, y + 20, 210, 14, { weight: 'bold', color: NS.storyData.CAST[who].accent });
    }
    kit.wrap(c.text, x + 16, y + 46, 210, 14, '#ffffff');
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.hud, { clock, draw, objective, lives, powers, stats, side, calloutBubble });
})();
