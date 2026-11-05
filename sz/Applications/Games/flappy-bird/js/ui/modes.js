;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The mode select: six cards (Classic, Arcade, Zen, Time Attack, Daily Challenge, Boss
     Rush) with a little scene each, the rules in one line, the best result and, for
     Arcade, the top of its high-score table. Starts the chosen mode. */

  const { CANVAS_W, MODES, MODE_ORDER } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Menu = NS.menu;
  const Nav = NS.nav;
  const Shapes = NS.shapes;

  const CARD_W = 388, CARD_H = 248;

  function bestLine(mode) {
    if (mode === 'arcade')
      return 'Best ' + G.save.best.arcade.toLocaleString('en-US') + ' pts';
    if (mode === 'zen')
      return 'Longest flight ' + G.save.best.zen + ' pipes';
    if (mode === 'bossrush')
      return G.save.best.bossrush ? 'Best time ' + G.save.best.bossrush.toFixed(1) + ' s' : 'Not cleared yet';
    if (mode === 'daily')
      return 'Today: ' + Prog.modeBest('daily');
    return 'Best ' + Prog.modeBest(mode);
  }

  /* a small animated vignette per mode, drawn into the card's top area */
  function drawVignette(mode, x, y, t) {
    const cx = x + CARD_W / 2, cy = y + 84;
    if (mode === 'classic') {
      ctx.fillStyle = '#5aa832';
      ctx.fillRect(cx + 40, y + 34, 40, 40);
      ctx.fillRect(cx + 40, y + 118, 40, 40);
      ctx.fillStyle = '#9be05a';
      ctx.fillRect(cx + 36, y + 64, 48, 12);
      ctx.fillRect(cx + 36, y + 116, 48, 12);
      SZ.FlappyBirdArt.drawBird(ctx, { x: cx - 30, y: cy + Math.sin(t * 3) * 10, birdId: 'sunny', frame: t * 10, scale: 1.4 });
    } else if (mode === 'arcade') {
      ui.fitText('x8', cx + 70, cy - 20, 80, 34, { weight: 'bold', color: '#ffd84a', outline: 'rgba(0,0,0,0.6)' });
      for (let i = 0; i < 3; ++i) {
        ctx.save();
        ctx.translate(cx - 70 + i * 50, cy + 20 + Math.sin(t * 3 + i) * 6);
        ctx.scale(0.55, 0.55);
        NS.view.sceneFor('meadow').drawBubble(ctx, ['blast', 'rush', 'gold'][i], 0, 0, t);
        ctx.restore();
      }
      SZ.FlappyBirdArt.drawBird(ctx, { x: cx - 10, y: cy - 24, birdId: 'corvus', frame: t * 12, scale: 1, flip: true });
    } else if (mode === 'zen') {
      ctx.strokeStyle = 'rgba(190,240,255,0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; ++i) {
        const r = 20 + ((t * 20 + i * 25) % 75);
        ctx.globalAlpha = 1 - r / 95;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      SZ.FlappyBirdArt.drawBird(ctx, { x: cx, y: cy + Math.sin(t * 1.2) * 6, birdId: 'snowy', frame: t * 4, scale: 1.5 });
    } else if (mode === 'time') {
      ctx.fillStyle = '#f4f8ff';
      ctx.beginPath();
      ctx.arc(cx, cy, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff6a6a';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = '#2a2a3a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(t * 2 - Math.PI / 2) * 30, cy + Math.sin(t * 2 - Math.PI / 2) * 30);
      ctx.stroke();
    } else if (mode === 'daily') {
      ui.roundRectPath(cx - 44, cy - 44, 88, 88, 10);
      ctx.fillStyle = '#f4f8ff';
      ctx.fill();
      ctx.fillStyle = '#ff6a4a';
      ctx.fillRect(cx - 44, cy - 44, 88, 22);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(String(new Date().getDate()), cx, cy + 12, 80, 40, { weight: 'bold', color: '#2a2a3a' });
    } else if (mode === 'bossrush') {
      const kinds = Prog.bossesBeaten();
      const show = kinds.length ? kinds[Math.floor(t / 2) % kinds.length] : 'corvus';
      SZ.FlappyBossArt.drawBoss(ctx, { kind: show, x: cx, y: cy + 4, scale: 0.55, t: t, alpha: kinds.length ? 1 : 0.35 });
    }
  }

  function drawModesScreen() {
    const t = G.globalTime;
    ui.drawHeadline('Choose a Mode', 640, 52, 600, 44, ui.UI.gold);
    Shapes.drawCoinChip(G.save.coins, CANVAS_W - 24, 20);
    for (let i = 0; i < MODE_ORDER.length; ++i) {
      const mode = MODE_ORDER[i];
      const def = MODES[mode];
      const x = 34 + (i % 3) * (CARD_W + 20), y = 96 + Math.floor(i / 3) * (CARD_H + 18);
      const locked = mode === 'bossrush' && Prog.bossesBeaten().length === 0;
      const index = Menu.registerHit('m-' + mode, x, y, CARD_W, CARD_H, () => Nav.startMode(mode), locked);
      const hot = Menu.isHot(index, x, y, CARD_W, CARD_H);
      ctx.save();
      if (hot) {
        ctx.translate(x + CARD_W / 2, y + CARD_H / 2);
        ctx.scale(1.025, 1.025);
        ctx.translate(-(x + CARD_W / 2), -(y + CARD_H / 2));
      }
      ui.drawPanel(x, y, CARD_W, CARD_H, { accent: hot ? ui.UI.gold : ui.UI.accent, glow: hot });
      ctx.save();
      ui.roundRectPath(x + 6, y + 6, CARD_W - 12, 150, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();
      ui.roundRectPath(x + 6, y + 6, CARD_W - 12, 150, 8);
      ctx.clip();
      drawVignette(mode, x, y, t);
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(def.name, x + 18, y + 178, CARD_W - 36, 24, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
      ui.fitText(mode === 'daily' && G.twist ? 'Twist: ' + G.twist.name + ' - ' + G.twist.desc : def.desc, x + 18, y + 206, CARD_W - 36, 14, { color: mode === 'daily' ? '#ff9a3a' : ui.UI.textDim });
      ctx.textAlign = 'right';
      ui.fitText(locked ? 'Beat a story boss to unlock' : bestLine(mode), x + CARD_W - 18, y + 232, CARD_W - 36, 14, { weight: 'bold', color: locked ? ui.UI.warn : ui.UI.gold });
      if (locked)
        Shapes.drawLock(x + CARD_W / 2, y + 84, 54);
      ctx.restore();
    }
    // arcade leaderboard strip
    const top = G.save.arcadeScores.slice(0, 3);
    if (top.length) {
      ctx.textAlign = 'left';
      ui.fitText('Arcade top 3:  ' + top.map((e, i) => (i + 1) + '. ' + e.score.toLocaleString('en-US') + ' (' + Prog.birdName(e.bird) + ')').join('    '), 34, 646, 1000, 15, { color: ui.UI.textDim });
    }
    Menu.drawBackButton();
    ui.drawKeyHints([{ key: '←→', label: 'Mode' }, { key: 'Enter', label: 'Play' }, { key: 'Esc', label: 'Back' }], 640, 690, 600, 1.1);
  }

  Object.assign(NS.modes, { drawModesScreen, bestLine });
})();
