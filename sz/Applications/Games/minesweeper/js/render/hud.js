/* The in-game HUD around the field: Tock's face above the board (the classic restart button: it
   smiles, gasps while a button is held, wears shades after a win and sees stars after a blast); on
   the left the goal with its progress, par and bonus goal (or the timer), the mine counter and the
   clock in red digital digits with their ghost segments, the shields and the power slots; on the
   right score and fields, then the guardian with its field-health and fuse (or the Versus rival's
   field, or the mutators, or the cast), the cast's call-out bubble; a pause button and, on touch
   screens, the flag-mode switch. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const E = NS.engine;
  const { UI, POWER_BY_ID, TAU } = C;
  const { ctx } = NS.view;

  function clock(t) {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  /* three red digital digits with dim 8s behind them, like the classic counters */
  function digits(v, x, y, size) {
    const str = (v < 0 ? '-' : '') + String(Math.min(999, Math.abs(Math.floor(v)))).padStart(v < 0 ? 2 : 3, '0');
    const w = size * 0.62 * 3 + 16;
    ctx.fillStyle = '#100404';
    K.roundRect(ctx, x, y, w, size + 12, 6); ctx.fill();
    kit.text('888', x + 8, y + size / 2 + 7, size, 'rgba(255,40,40,0.13)', { weight: 'bold', font: '"Courier New", monospace' });
    kit.text(str, x + 8, y + size / 2 + 7, size, '#ff2a2a', { weight: 'bold', font: '"Courier New", monospace' });
    return w;
  }

  function faceState(run) {
    const g = run.game;
    if (run.vs && run.vs.stunYou > 0) return 'stun';
    if (g.state === 'won' || run.won) return 'won';
    if (g.state === 'lost' || run.done && !run.won) return 'lost';
    if (G.input.down && G.input.downCell >= 0) return 'press';
    return 'idle';
  }

  function face(state, x, y, r, hot) {
    ctx.save();
    ctx.translate(x, y);
    K.roundRect(ctx, -r - 6, -r - 6, (r + 6) * 2, (r + 6) * 2, 10);
    ctx.fillStyle = hot ? 'rgba(255,230,160,0.95)' : 'rgba(220,220,210,0.95)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
    gr.addColorStop(0, '#f0d0a0'); gr.addColorStop(1, '#b08850');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff9aa0'; ctx.beginPath(); ctx.ellipse(0, r * 0.28, r * 0.22, r * 0.15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1a10'; ctx.fillStyle = '#2a1a10'; ctx.lineWidth = 2.2;
    if (state === 'won') {
      ctx.fillRect(-r * 0.7, -r * 0.35, r * 0.6, r * 0.32); ctx.fillRect(r * 0.1, -r * 0.35, r * 0.6, r * 0.32); ctx.fillRect(-r * 0.1, -r * 0.3, r * 0.2, r * 0.08);
    } else if (state === 'lost' || state === 'stun') {
      for (const ex of [-0.38, 0.38]) { ctx.beginPath(); ctx.moveTo(r * ex - r * 0.14, -r * 0.34); ctx.lineTo(r * ex + r * 0.14, -r * 0.06); ctx.moveTo(r * ex + r * 0.14, -r * 0.34); ctx.lineTo(r * ex - r * 0.14, -r * 0.06); ctx.stroke(); }
      if (state === 'stun') for (let k = 0; k < 3; ++k) K.star(ctx, Math.cos(G.time * 4 + k * 2.1) * r * 0.9, -r * 0.95 + Math.sin(G.time * 4 + k * 2.1) * r * 0.2, r * 0.16, 0.45, 5), ctx.fillStyle = '#ffd25a', ctx.fill();
    } else {
      for (const ex of [-0.38, 0.38]) { ctx.beginPath(); ctx.arc(r * ex, -r * 0.2, r * (state === 'press' ? 0.15 : 0.11), 0, TAU); ctx.fillStyle = '#2a1a10'; ctx.fill(); }
    }
    ctx.strokeStyle = '#2a1a10';
    ctx.beginPath();
    if (state === 'press') ctx.arc(0, r * 0.55, r * 0.12, 0, TAU);
    else if (state === 'lost') ctx.arc(0, r * 0.75, r * 0.28, Math.PI + 0.3, -0.3);
    else ctx.arc(0, r * 0.4, r * 0.3, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    const run = G.run;
    if (!run) return;
    const g = run.game;
    const st = faceState(run);
    const hot = W.area('face', 640 - 30, 6, 60, 60, () => NS.play.restart(), {});
    face(st, 640, 36, 24, hot);
    let y = goal(run, 30, 60);
    y = counters(run, 30, y + 10);
    if (run.slots) powers(run, 30, y + 10);
    stats(run, 1010, 60);
    side(run, 1010, 214);
    calloutBubble();
    W.button('g-pause', 'Pause', 1130, 662, 120, 44, { icon: 'pause', px: 15, action: () => NS.screens.pause() });
    if (G.input.touch) {
      const on = G.input.flagMode;
      W.button('g-flagmode', on ? 'Flag mode' : 'Dig mode', 30, 650, 240, 52, { icon: on ? 'flag' : 'play', selected: on, accent: on ? '#ff6a6a' : UI.good,
        sub: 'tap to switch - long press flags', action: () => { G.input.flagMode = !G.input.flagMode; } });
    }
  }

  function goal(run, x, y) {
    const o = NS.run.objective(run);
    const st = run.stage ? NS.worldData.BY_ID[run.stage] : null;
    const h = st ? 196 : 120;
    kit.panel(x, y, 240, h, { accent: UI.gold });
    kit.text(st ? st.name.toUpperCase() : NS.metaData.MODE_BY_ID[run.mode].name.toUpperCase(), x + 16, y + 20, 14, UI.textDim, { weight: 'bold' });
    kit.wrap(o.text, x + 16, y + 46, 210, 14, '#ffffff', { weight: 'bold' });
    if (o.need) {
      kit.bar(x + 16, y + 84, 208, 10, o.have / o.need, UI.gold);
      const label = run.kind === 'rush' ? clock(o.need - o.have) + ' left' : run.kind === 'gems' ? o.have + ' / ' + o.need + ' gems' : Math.floor(o.have) + ' / ' + o.need;
      kit.text(label, x + 120, y + 106, 12, UI.textDim, { align: 'center' });
    }
    if (st) {
      const par = st.par * (1 + NS.progress.stat(G.profile, 'par'));
      kit.text('PAR ' + clock(par), x + 16, y + 132, 12, run.t <= par ? UI.good : UI.textMute, { weight: 'bold' });
      const met = NS.run.bonusMet(run, st.bonus);
      kit.icon('star', x + 24, y + 158, 16, met ? UI.gold : 'rgba(140,150,140,0.6)');
      kit.fitText(NS.run.bonusText(st.bonus), x + 40, y + 159, 190, 13, { color: met ? UI.gold : UI.textDim });
      if (run.timeLimit) {
        const left = run.timeLimit - run.t;
        kit.text(clock(left) + ' left', x + 120, y + 182, 15, left < 20 ? UI.bad : '#ffffff', { align: 'center', weight: 'bold' });
      }
    } else if (run.timeLimit && run.kind !== 'rush') {
      const left = run.timeLimit - run.t;
      kit.text(clock(left) + ' left', x + 120, y + h - 8, 13, left < 20 ? UI.bad : '#ffffff', { align: 'center', weight: 'bold' });
    }
    return y + h;
  }

  function counters(run, x, y) {
    const g = run.game;
    kit.panel(x, y, 240, 104, { accent: '#ff5a5a' });
    kit.text('MINES', x + 16, y + 18, 11, UI.textDim, { weight: 'bold' });
    kit.text('TIME', x + 130, y + 18, 11, UI.textDim, { weight: 'bold' });
    digits(E.flagsLeft(g), x + 14, y + 30, 30);
    digits(run.mode === 'classic' ? Math.min(999, Math.ceil(g.t)) : Math.min(999, Math.floor(run.t)), x + 128, y + 30, 30);
    const shields = g.lives;
    if (shields || run.revives) {
      kit.icon('shield', x + 24, y + 88, 16, '#c8a0ff');
      kit.fitText((shields ? shields + ' shield' + (shields > 1 ? 's' : '') : '') + (shields && run.revives ? '  -  ' : '') + (run.revives ? 'Second Chance' : ''), x + 40, y + 89, 190, 12, { color: '#e0d0ff', weight: 'bold' });
    } else kit.text(g.noFlags ? 'No Flags today' : g.flagLockT > 0 ? 'Flags frozen ' + g.flagLockT.toFixed(0) + 's' : g.marks ? 'right-click: flag, then ?' : 'right-click: flag', x + 120, y + 89, 11, g.flagLockT > 0 ? '#9ad8ff' : UI.textMute, { align: 'center' });
    return y + 104;
  }

  function powers(run, x, y) {
    const h = 26 + run.slots * 50;
    kit.panel(x, y, 240, h, { accent: '#ff9a3a' });
    kit.text('POWERS', x + 16, y + 16, 12, UI.textDim, { weight: 'bold' });
    kit.text('E / 1-' + run.slots, x + 224, y + 16, 11, UI.textMute, { align: 'right' });
    for (let i = 0; i < run.slots; ++i) {
      const py = y + 26 + i * 50;
      const id = run.powers[i];
      const pw = id ? POWER_BY_ID[id] : null;
      const hot = W.area('pw' + i, x + 8, py, 224, 44, id ? () => NS.play.usePower(i) : null, { disabled: !id, nonav: true });
      K.roundRect(ctx, x + 8, py, 224, 44, 10);
      ctx.fillStyle = pw ? K.rgba(pw.color, hot ? 0.35 : 0.2) : 'rgba(0,0,0,0.3)';
      ctx.fill();
      if (pw) {
        kit.icon(pw.icon, x + 32, py + 22, 24, pw.color);
        kit.fitText(pw.name, x + 54, py + 16, 170, 14, { weight: 'bold', color: '#ffffff' });
        kit.fitText(pw.desc, x + 54, py + 32, 170, 10, { color: UI.textDim });
      } else kit.text('empty - open a chest', x + 120, py + 22, 11, UI.textMute, { align: 'center' });
    }
  }

  function stats(run, x, y) {
    const g = run.game;
    kit.panel(x, y, 240, 144, { accent: UI.accent });
    const best = run.mode === 'classic' && run.diff !== 'custom' ? G.profile.stats.bestTimes[run.diff] : 0;
    const rows = [['SCORE', (run.score + g.score).toLocaleString('en-US')],
      run.mode === 'zen' || run.mode === 'rush' || run.mode === 'gauntlet' ? ['FIELDS', String(run.fields)] : best ? ['BEST TIME', best + ' s'] : ['FIELD', g.w + ' x ' + g.h],
      ['OPENED', g.opened + ' / ' + E.safeCount(g)]];
    for (let i = 0; i < rows.length; ++i) {
      kit.text(rows[i][0], x + 16, y + 20 + i * 42, 11, UI.textDim, { weight: 'bold' });
      kit.fitText(rows[i][1], x + 224, y + 40 + i * 42, 200, 19, { color: '#ffffff', weight: 'bold', align: 'right' });
    }
  }

  /* the rival's field, small, with its name and progress */
  function rival(run, x, y) {
    const vs = run.vs, rg = run.rival;
    const def = NS.versus.CPU_BY_ID[vs.cpu];
    kit.panel(x, y, 240, 330, { accent: def.color, glow: rg.state === 'won' });
    kit.icon('swords', x + 22, y + 22, 18, def.color);
    kit.fitText('CPU  ' + def.name.toUpperCase(), x + 40, y + 22, 190, 16, { weight: 'bold', color: '#ffffff' });
    kit.bar(x + 16, y + 40, 208, 8, rg.opened / E.safeCount(rg), def.color);
    NS.boardRender.draw(rg, { area: { x0: x + 14, y0: y + 62, x1: x + 226, y1: y + 270, max: 13 }, small: true });
    if (vs.stunRival > 0) kit.text('STUNNED ' + vs.stunRival.toFixed(1) + 's', x + 120, y + 300, 13, UI.bad, { align: 'center', weight: 'bold' });
    else kit.text(rg.opened + ' / ' + E.safeCount(rg) + ' cells', x + 120, y + 300, 12, UI.textDim, { align: 'center' });
    if (vs.stunYou > 0) kit.text('YOU ARE STUNNED ' + vs.stunYou.toFixed(1) + 's', 640, 704, 16, UI.bad, { align: 'center', weight: 'bold' });
  }

  function side(run, x, y) {
    const bs = run.bossState;
    if (run.vs) return rival(run, x, y);
    if (bs) {
      const b = NS.worldData.BOSSES[bs.w];
      const h = NS.boss.health(run);
      NS.bossArt.drawBoss(bs.w, x + 120, y + 336, bs, 0.6);
      kit.panel(x, y, 240, 150, { accent: b.color, glow: bs.rage || bs.windup > 0 });
      kit.fitText(b.name, x + 16, y + 22, 210, 16, { weight: 'bold', color: '#ffffff' });
      kit.fitText(b.title + (bs.rage ? '  -  ENRAGED' : ''), x + 16, y + 40, 210, 11, { color: bs.rage ? UI.bad : UI.textDim });
      kit.text('FIELD LEFT', x + 16, y + 60, 10, UI.textDim, { weight: 'bold' });
      kit.bar(x + 16, y + 68, 208, 12, h.left / h.max, bs.rage ? '#ff4a4a' : b.color);
      kit.text('FUSE ' + Math.ceil(bs.fuse) + 's', x + 16, y + 98, 10, bs.fuse < 30 ? UI.bad : UI.textDim, { weight: 'bold' });
      kit.bar(x + 16, y + 106, 208, 10, bs.fuse / bs.fuseMax, bs.fuse < 30 ? '#ff4a4a' : '#ffb04a');
      const label = { bury: 'Reburies cells', frost: 'Freezes flags', smoke: 'Blows smoke', quake: 'Knocks flags loose' }[bs.next];
      kit.text(bs.windup > 0 ? 'WINDING UP: ' + label.toUpperCase() + '!' : 'Next: ' + label.toLowerCase() + ' in ' + Math.max(0, bs.t).toFixed(0) + 's', x + 120, y + 134, 11, bs.windup > 0 ? UI.bad : UI.textDim, { align: 'center', weight: 'bold' });
      if (run.mode === 'gauntlet') kit.text('Guardian ' + (run.gauntletIndex + 1) + ' of 5', x + 120, y + 168, 13, UI.gold, { align: 'center', weight: 'bold' });
      return;
    }
    if (run.mutators.length) {
      kit.panel(x, y, 240, 30 + run.mutators.length * 44, { accent: '#ff7ad8' });
      kit.text('TWISTS', x + 16, y + 16, 12, UI.textDim, { weight: 'bold' });
      run.mutators.forEach((id, i) => {
        const m = NS.seasons.MUT_BY_ID[id];
        kit.fitText(m.name, x + 16, y + 38 + i * 44, 210, 14, { weight: 'bold', color: '#ffffff' });
        kit.fitText(m.desc, x + 16, y + 56 + i * 44, 210, 10, { color: UI.textDim });
      });
      return;
    }
    ctx.globalAlpha = 0.9;
    ctx.drawImage(NS.bossArt.portrait('wren'), x + 10, y + 180, 140, 140);
    ctx.drawImage(NS.bossArt.portrait('tock'), x + 110, y + 230, 110, 110);
    ctx.globalAlpha = 1;
  }

  function calloutBubble() {
    const c = G.ui.callout;
    if (!c) return;
    const run = G.run;
    const a = Math.min(1, c.t * 3);
    ctx.globalAlpha = a;
    const x = 1010, y = run && (run.bossState || run.vs) ? 556 : 420;
    if (c.who === 'boss' && run && run.bossState) {
      const b = NS.worldData.BOSSES[run.bossState.w];
      kit.panel(x, y, 240, 90, { accent: b.color, glow: true });
      kit.fitText(b.name, x + 16, y + 20, 210, 14, { weight: 'bold', color: b.accent });
    } else {
      const who = c.who === 'boss' ? 'tock' : c.who;
      kit.panel(x, y, 240, 90, { accent: NS.storyData.CAST[who].accent, glow: true });
      kit.fitText(NS.storyData.CAST[who].name, x + 16, y + 20, 210, 14, { weight: 'bold', color: NS.storyData.CAST[who].accent });
    }
    kit.wrap(c.text, x + 16, y + 44, 210, 13, '#ffffff');
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.hud, { clock, digits, faceState, face, draw, goal, counters, powers, stats, rival, side, calloutBubble });
})();
