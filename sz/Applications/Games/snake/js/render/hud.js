/* The in-run HUD on the strip above the board: score with the combo meter, the goal (fruit and
   golden eggs, a guardian's health, the arcade stage, a countdown or the zen clock), lives,
   armour, venom and running power-up timers; the stage banner, the 3-2-1 countdown, the clear
   and game-over captions; and on every screen the flash and the toast stack. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { UI, TAU, VIEW_W, BY, FONT } = NS.constants;
  const { POWER_BY_ID, MODES } = NS.items;
  const { BOSSES, WORLDS } = NS.worlds;
  const K = NS.artKit;
  const kit = NS.kit;
  const IA = NS.itemArt;
  const { ctx } = NS.view;

  function fmtTime(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function strip() {
    const h = BY - 14;
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(8,20,12,0.82)');
    gr.addColorStop(1, 'rgba(8,20,12,0.55)');
    ctx.fillStyle = gr;
    kit.roundRect(56, 4, VIEW_W - 112, h - 10, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(126,224,122,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function draw() {
    const run = G.run;
    if (!run || run.mode === 'demo') return;
    strip();
    const y = 24;
    /* score and combo */
    kit.text(String(run.score), 76, y, 26, '#ffffff', { weight: 'bold' });
    ctx.font = kit.font(26, 'bold');
    const sw = ctx.measureText(String(run.score)).width;
    if (run.combo > 1) {
      const mul = NS.rules.comboMultiplier(run.combo, G.stats.comboCap);
      const frac = run.comboT / (NS.constants.COMBO_WINDOW + G.stats.comboWindow);
      kit.text('x' + mul.toFixed(1), 90 + sw, y - 6, 15, UI.gold, { weight: 'bold' });
      kit.text(run.combo + ' combo', 90 + sw, y + 10, 11, UI.textDim);
      kit.bar(90 + sw + 62, y - 3, 70, 7, frac, frac > 0.3 ? UI.gold : UI.bad);
    }
    /* centre: the goal */
    const cx = VIEW_W / 2;
    switch (run.mode) {
      case 'story':
      case 'rush':
        if (run.boss) {
          const b = run.boss;
          kit.text(BOSSES[b.id].name, cx, y - 9, 13, UI.text, { align: 'center', weight: 'bold' });
          kit.bar(cx - 150, y + 3, 300, 11, b.hp / b.max, BOSSES[b.id].accent, { cells: b.max });
        } else {
          K.blit(ctx, IA.fruit('apple'), cx - 110, y, 0.7);
          const done = run.eaten >= run.level.goal;
          kit.text(done ? 'Exit open!' : Math.min(run.eaten, run.level.goal) + ' / ' + run.level.goal, cx - 92, y, 18, done ? UI.gold : UI.text, { weight: 'bold' });
          for (let e = 0; e < run.eggs.length; ++e) {
            ctx.globalAlpha = run.eggs[e] ? 1 : 0.28;
            K.blit(ctx, IA.fruit('egg'), cx + 30 + e * 30, y, 0.62);
          }
          ctx.globalAlpha = 1;
        }
        break;
      case 'arcade':
        kit.text('STAGE ' + run.stage, cx, y - 7, 18, UI.gold, { align: 'center', weight: 'bold' });
        kit.text(G.weekly ? G.weekly.name : '', cx, y + 11, 11, UI.textDim, { align: 'center' });
        break;
      case 'time':
      case 'daily': {
        const low = run.timeLeft < 10;
        kit.text(fmtTime(run.timeLeft), cx, y, 26, low && Math.floor(G.time * 4) % 2 ? UI.bad : '#ffffff', { align: 'center', weight: 'bold' });
        break;
      }
      case 'zen':
        kit.text('ZEN  ' + fmtTime(run.time) + '   length ' + run.snake.body.length, cx, y, 17, '#bff4e0', { align: 'center' });
        break;
    }
    /* right: lives, armour, venom, active power-ups */
    let x = VIEW_W - 80;
    if (run.mode === 'story' || run.mode === 'arcade' || run.mode === 'rush') {
      for (let l = 0; l < Math.min(run.lives, 6); ++l) {
        kit.icon('heart', x, y, 20, '#ff5a7a');
        x -= 24;
      }
      x -= 6;
    }
    for (let s = 0; s < run.shield; ++s) { kit.icon('shield', x, y, 18, '#8ab8ff'); x -= 22; }
    if (run.venom > 0 || G.stats.venom > 0) {
      kit.text(String(run.venom), x, y, 15, '#9aff4a', { align: 'right', weight: 'bold' });
      kit.icon('drop', x - 20, y, 18, '#9aff4a');
      x -= 50;
    }
    for (const id in run.act) {
      const left = run.act[id];
      if (!(left > 0)) continue;
      const def = POWER_BY_ID[id];
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, left / NS.powerups.duration(id))); ctx.stroke();
      kit.icon(def.icon, x, y, 17, left < 1.5 && Math.floor(G.time * 8) % 2 ? '#ffffff' : def.color);
      x -= 38;
    }
    if (G.screen !== 'playing') return;
    banner(run);
    phaseCaption(run);
  }

  function banner(run) {
    const b = run.banner;
    if (!b) return;
    const t = b.t;
    const a = Math.min(1, t * 4, (3.2 - t) * 3);
    if (a <= 0) return;
    const slide = (1 - Math.min(1, t * 4)) * 40;
    ctx.globalAlpha = a;
    const w = 720, h = 76, x = VIEW_W / 2 - w / 2, y = 150 - slide;
    const gr = ctx.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(6,16,10,0)');
    gr.addColorStop(0.15, 'rgba(6,16,10,0.8)');
    gr.addColorStop(0.85, 'rgba(6,16,10,0.8)');
    gr.addColorStop(1, 'rgba(6,16,10,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w, h);
    kit.fitText(b.title, VIEW_W / 2, y + 28, w - 120, 30, { color: '#ffffff', weight: 'bold', align: 'center' });
    kit.fitText(b.sub, VIEW_W / 2, y + 57, w - 120, 15, { color: UI.textDim, align: 'center' });
    ctx.globalAlpha = 1;
  }

  function bigText(str, px, color, scale, y) {
    ctx.save();
    ctx.translate(VIEW_W / 2, y || 380);
    ctx.scale(scale, scale);
    ctx.font = '900 ' + px + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(str, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  function phaseCaption(run) {
    if (run.phase === 'ready') {
      const n = Math.ceil(run.phaseT / 0.6);
      const f = 1 - (run.phaseT % 0.6) / 0.6;
      bigText(n > 0 ? String(n) : 'GO!', 110, '#ffffff', 1.4 - f * 0.4);
    } else if (run.phase === 'won') {
      const t = Math.min(1, (1.8 - run.phaseT) * 3);
      bigText(run.outcome === 'next-boss' ? 'GUARDIAN DOWN!' : run.boss ? 'GUARDIAN FREED!' : 'LEVEL CLEAR!', 72, UI.gold, NS.rng.easeOutBack(t));
    } else if (run.phase === 'over') {
      const t = Math.min(1, (1.4 - run.phaseT) * 3);
      bigText(run.outcome === 'time' ? 'TIME!' : 'GAME OVER', 80, UI.bad, NS.rng.easeOutBack(t));
    }
  }

  function drawFlash() {
    if (G.flash <= 0) return;
    const v = NS.view.visible();
    ctx.globalAlpha = Math.min(0.85, G.flash);
    ctx.fillStyle = G.flashColor;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  function drawToasts() {
    const q = G.ui.toasts;
    if (!q.length) return;
    const t = q[0];
    const v = NS.view.visible();
    const a = Math.min(1, t.t * 5, (3.2 - t.t) * 3);
    const w = Math.min(520, 70 + t.text.length * 8.2), h = 42;
    const x = v.x1 - w - 18 + (1 - Math.min(1, t.t * 5)) * 60, y = v.y1 - h - 18;
    ctx.globalAlpha = Math.max(0, a);
    kit.panel(x, y, w, h, { accent: t.color, glow: true, radius: 10, brackets: false });
    kit.icon(t.icon, x + 24, y + h / 2, 22, t.color);
    kit.fitText(t.text, x + 44, y + h / 2 + 1, w - 56, 15, { color: '#ffffff', weight: 'bold' });
    if (q.length > 1) kit.text('+' + (q.length - 1), x + w - 8, y + 8, 10, UI.textDim, { align: 'right' });
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.hud, {
    draw, drawFlash, drawToasts, fmtTime, bigText, MODES, WORLDS
  });
})();
