/* The flight HUD drawn over the field, hugging the edges of the visible plane: score with the
   combo multiplier and its draining bar, the objective panel (shards, pods, clock, wave, titan
   health), ships left, stardust and the overdrive gauge, active power-ups with draining rings,
   the hyperspace gauge, the centre banner, game-over text, screen flash and toasts. Reads G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { TAU, UI } = NS.constants;
  const { POWERUPS } = NS.powerData;
  const { BOSSES } = NS.enemyData;
  const K = NS.artKit;
  const kit = NS.kit;
  const rules = NS.rules;
  const { ctx, visible } = NS.view;

  let shownScore = 0;
  let scorePop = 0;

  function fmt(n) {
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function clock(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function draw() {
    const run = G.run;
    if (!run) return;
    const v = visible();
    const x0 = Math.max(v.x0, -200) + 18, x1 = Math.min(v.x1, 1480) - 18, y0 = Math.max(v.y0, -120) + 14, y1 = Math.min(v.y1, 840) - 14;
    /* score */
    if (shownScore !== G.score) {
      shownScore += Math.max(1, Math.ceil((G.score - shownScore) * 0.2));
      if (shownScore > G.score) shownScore = G.score;
      scorePop = 1;
    }
    scorePop = Math.max(0, scorePop - 0.08);
    if (run.mode !== 'zen' || G.score > 0)
      kit.text(fmt(shownScore), x0, y0 + 18, 30 + scorePop * 4, '#ffffff', { weight: 'bold' });
    const mult = rules.comboMult(G.combo) * (G.ship && G.ship.power.double ? 2 : 1);
    if (G.combo > 1) {
      const col = mult >= 6 ? '#ff6ad0' : mult >= 3 ? '#ffd25a' : '#5ad8ff';
      kit.text('x' + mult, x0, y0 + 50, 22, col, { weight: 'bold' });
      kit.text(G.combo + ' chain', x0 + 44, y0 + 51, 13, UI.textDim);
      kit.bar(x0, y0 + 64, 120, 4, G.comboT / G.stats.combo, col);
    }
    objective(v, y0);
    rightPanel(x1, y0);
    powers(x0, y1);
    hyper(x1, y1);
    if (G.banner) banner();
    if (run.overT > 0) {
      const k = Math.min(1, (2.2 - run.overT) * 2);
      ctx.globalAlpha = k;
      kit.text(run.mode === 'story' ? 'MISSION FAILED' : 'GAME OVER', 640, 330, 64, '#ff5a6a', { align: 'center', weight: 'bold' });
      ctx.globalAlpha = 1;
    } else if (G.ship && G.ship.dead && run.lives > 0) {
      ctx.globalAlpha = 0.8;
      kit.text('Ship lost - ' + run.lives + (run.lives === 1 ? ' ship' : ' ships') + ' left', 640, 520, 20, UI.textDim, { align: 'center' });
      ctx.globalAlpha = 1;
    }
    if (NS.touch.active()) NS.touch.draw();
  }

  function objective(v, y0) {
    const run = G.run, L = G.level;
    if (!L) return;
    let label = '', frac = -1, col = UI.accent;
    switch (L.obj) {
      case 'collect': label = 'Star shards  ' + Math.min(run.progress, run.target) + ' / ' + run.target; frac = run.progress / run.target; col = UI.gold; break;
      case 'rescue': label = 'Pods rescued  ' + Math.min(run.progress, run.target) + ' / ' + run.target; frac = run.progress / run.target; col = UI.good; break;
      case 'survive': label = 'Survive  ' + clock(run.timeLeft); frac = 1 - run.timeLeft / L.time; col = UI.warn; break;
      case 'clear': label = 'Clear the field  -  ' + NS.waves.rockCount() + ' rocks'; break;
      case 'wave': label = (run.mode === 'daily' ? 'Daily  -  ' : '') + 'Wave ' + run.wave; break;
      case 'zen': label = 'Zen  ' + clock(run.zenT); col = UI.good; break;
      case 'boss': label = ''; break;
    }
    const b = G.boss;
    if (b) {
      const D = BOSSES[b.kind];
      kit.text(D.name.toUpperCase(), 640, y0 + 8, 15, D.pal[3], { align: 'center', weight: 'bold' });
      kit.bar(440, y0 + 20, 400, 10, b.hp / b.maxHp, b.kind === 'tempest' && b.shield ? '#8a9ab8' : '#ff4a5a', { cells: 10 });
      if (b.kind === 'tempest' && b.shield) kit.text('Shielded - destroy the pylons', 640, y0 + 44, 12, UI.textDim, { align: 'center' });
      if (b.kind === 'maw' && b.open < 0.6) kit.text('Wait for the mouth to open', 640, y0 + 44, 12, UI.textDim, { align: 'center' });
      if (!label) return;
    }
    if (!label) return;
    const y = b ? y0 + 62 : y0 + 10;
    kit.text(label, 640, y, 16, '#ffffff', { align: 'center', weight: 'bold' });
    if (frac >= 0) kit.bar(540, y + 13, 200, 4, frac, col);
    if (run.mode === 'story' && L.par && !b) {
      const over = run.time > L.par;
      kit.text('Par ' + clock(L.par) + '  -  ' + clock(run.time), 640, y + 28, 11, over ? UI.textMute : UI.textDim, { align: 'center' });
    }
    if (run.mods && run.mods.length) kit.text(run.mods.map(m => NS.powerData.MODIFIERS[m].name).join('  +  '), 640, y + 28, 11, UI.warn, { align: 'center' });
  }

  function rightPanel(x1, y0) {
    const run = G.run;
    if (run.mode !== 'zen') {
      const n = Math.min(run.lives, 9);
      for (let i = 0; i < n; ++i) NS.propArt.icon(ctx, 'life', x1 - 12 - i * 22, y0 + 14, 18, i < run.lives ? '#e8f0ff' : UI.textMute);
    }
    kit.credits(G.save.dust, x1, y0 + 42, 15, 'right');
    /* overdrive */
    const od = G.overdrive;
    const full = od >= 1;
    const cx = x1 - 26, cy = y0 + 86;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = full ? (Math.sin(G.time * 10) > 0 ? '#ffffff' : '#d08aff') : '#8a5ac8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 + TAU * od);
    ctx.stroke();
    if (full) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(G.time * 8);
      K.blit(ctx, K.glow('#d08aff'), cx, cy, 1.4);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    NS.propArt.icon(ctx, 'nova', cx, cy, 20, full ? '#ffffff' : '#8a7aa8');
    kit.text(full ? 'OVERDRIVE  E' : 'Overdrive', cx - 30, cy, 12, full ? '#e8c8ff' : UI.textMute, { align: 'right', weight: full ? 'bold' : 'normal' });
  }

  function powers(x0, y1) {
    const s = G.ship;
    if (!s) return;
    let i = 0;
    for (const k in s.power) {
      const D = POWERUPS[k];
      if (!D) continue;
      const x = x0 + 22 + i * 52, y = y1 - 26;
      const frac = Math.min(1, s.power[k] / (D.dur * G.stats.puDur));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, 21, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = D.col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 21, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
      ctx.stroke();
      const blink = s.power[k] < 2 && Math.sin(G.time * 16) > 0;
      NS.propArt.icon(ctx, D.icon, x, y, 22, blink ? UI.textMute : D.col);
      ++i;
    }
    if (s.shield && !s.power.shield) {
      const x = x0 + 22 + i * 52, y = y1 - 26;
      NS.propArt.icon(ctx, 'shield', x, y, 22, '#4ab8ff');
    }
  }

  function hyper(x1, y1) {
    const s = G.ship;
    if (!s) return;
    const k = 1 - s.hyperCd / G.stats.hyperCd;
    kit.text('Hyperspace', x1 - 104, y1 - 30, 11, k >= 1 ? UI.text : UI.textMute, { align: 'left' });
    kit.bar(x1 - 104, y1 - 20, 104, 5, k, k >= 1 ? '#bff4ff' : '#4a6a8a');
  }

  function banner() {
    const b = G.banner;
    const t = b.t, L = b.life;
    const a = Math.min(1, t * 4, (L - t) * 2.5);
    const slide = t < 0.25 ? (1 - t / 0.25) * 60 : 0;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(0,0,10,0.45)';
    ctx.fillRect(-400, 270, 2080, 100);
    ctx.fillStyle = K.rgba(b.color, 0.8);
    ctx.fillRect(-400, 270, 2080, 2);
    ctx.fillRect(-400, 368, 2080, 2);
    kit.text(b.title, 640 - slide, 312, 44, '#ffffff', { align: 'center', weight: 'bold' });
    if (b.sub) kit.text(b.sub, 640 + slide, 350, 17, b.color, { align: 'center' });
    ctx.globalAlpha = 1;
  }

  function drawFlash() {
    if (G.flash <= 0) return;
    const v = visible();
    ctx.globalAlpha = Math.min(0.85, G.flash);
    ctx.fillStyle = G.flashColor;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  function drawToasts() {
    const ts = G.ui.toasts;
    if (G.screen === 'cine') return;
    const v = visible();
    /* in flight they rise from the bottom centre; over menus they stack in the top-right corner */
    const flying = G.screen === 'playing';
    const px = flying ? 15 : 13;
    for (let i = 0; i < ts.length; ++i) {
      const t = ts[i];
      const a = Math.min(1, t.t * 5, (t.life - t.t) * 2);
      const slide = t.t < 0.2 ? (1 - t.t / 0.2) * 20 : 0;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = kit.font(px, 'bold');
      const w = Math.min(flying ? 900 : 520, ctx.measureText(t.text).width + 40);
      const cx = flying ? 640 : Math.min(v.x1, 1480) - 16 - w / 2;
      const y = flying ? Math.min(v.y1, 840) - 92 - (ts.length - 1 - i) * 40 + slide : Math.max(v.y0, -120) + 26 + (ts.length - 1 - i) * 36 - slide;
      kit.panel(cx - w / 2, y - 15, w, 30, { accent: t.color, radius: 15, brackets: false });
      kit.fitText(t.text, cx, y + 1, w - 26, px, { align: 'center', weight: 'bold', color: '#ffffff' });
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.hud, {
    draw, drawFlash, drawToasts, fmt, clock
  });
})();
