/* The canvas HUD and overlays: distance, coins, active power-up indicators, the
   ready/paused/game-over overlays and the tutorial page. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const ctx = V.ctx;

  function hud() {
    // HUD — distance
    ctx.save();
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(Math.floor(S.distance) + ' m', C.CANVAS_W / 2, 10);
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.floor(S.distance) + ' m', C.CANVAS_W / 2, 10);
    ctx.restore();

    // HUD — coins
    ctx.save();
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('Coins: ' + S.coinCount, C.CANVAS_W - 10, 20);
    ctx.restore();

    // Active power-up indicators
    const indicators = [];
    if (S.magnetTimer > 0)
      indicators.push({ label: 'MAGNET ' + Math.ceil(S.magnetTimer) + 's', color: '#ff00ff' });
    if (S.shieldTimer > 0)
      indicators.push({ label: 'SHIELD ' + Math.ceil(S.shieldTimer) + 's', color: '#00bfff' });
    if (S.multiplierTimer > 0)
      indicators.push({ label: '2x ' + Math.ceil(S.multiplierTimer) + 's', color: '#ff4500' });

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < indicators.length; ++i) {
      ctx.fillStyle = indicators[i].color;
      ctx.fillText(indicators[i].label, 10, 20 + i * 16);
    }
  }

  function overlays() {
    // Ready overlay
    if (S.state === C.STATE_READY) {
      ctx.save();
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText('Tap or Space to Start', C.CANVAS_W / 2, C.CANVAS_H * 0.35);
      ctx.fillStyle = '#fff';
      ctx.fillText('Tap or Space to Start', C.CANVAS_W / 2, C.CANVAS_H * 0.35);

      ctx.font = '16px sans-serif';
      ctx.strokeText('Arrow Keys to move, Up=Jump, Down=Slide', C.CANVAS_W / 2, C.CANVAS_H * 0.45);
      ctx.fillText('Arrow Keys to move, Up=Jump, Down=Slide', C.CANVAS_W / 2, C.CANVAS_H * 0.45);
      ctx.restore();
    }

    // Paused overlay
    if (S.state === C.STATE_PAUSED) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('PAUSED', C.CANVAS_W / 2, C.CANVAS_H / 2);
      ctx.restore();
    }

    // Dead overlay
    if (S.state === C.STATE_DEAD) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

      const cardW = 220;
      const cardH = 140;
      const cx = (C.CANVAS_W - cardW) / 2;
      const cy = (C.CANVAS_H - cardH) / 2 - 20;
      ctx.fillStyle = '#deb887';
      ctx.fillRect(cx, cy, cardW, cardH);
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cardW, cardH);

      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('Game Over', C.CANVAS_W / 2, cy - 10);
      ctx.fillText('Game Over', C.CANVAS_W / 2, cy - 10);

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#333';
      ctx.fillText('Distance: ' + Math.floor(S.distance) + ' m', C.CANVAS_W / 2, cy + 30);
      ctx.fillText('Score: ' + Math.floor(S.score), C.CANVAS_W / 2, cy + 50);
      ctx.fillText('Coins: ' + S.coinCount, C.CANVAS_W / 2, cy + 70);
      ctx.fillText('Best: ' + Math.floor(NS.highscores.getBestDistance()) + ' m', C.CANVAS_W / 2, cy + 90);

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('Tap or Space to Restart', C.CANVAS_W / 2, cy + cardH + 20);
      ctx.fillText('Tap or Space to Restart', C.CANVAS_W / 2, cy + cardH + 20);
      ctx.restore();
    }
  }

  function tutorial() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    const page = C.TUTORIAL_PAGES[S.tutorialPage] || C.TUTORIAL_PAGES[0];
    const cx = C.CANVAS_W / 2, pw = 360, ph = 210, px = cx - pw / 2, py = (C.CANVAS_H - ph) / 2;
    ctx.fillStyle = 'rgba(20,20,40,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#4ec0ca';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (S.tutorialPage + 1) + ' / ' + C.TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#4ec0ca';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(page.title, cx, py + 30);
    ctx.fillStyle = '#ccc';
    ctx.font = '13px sans-serif';
    for (let i = 0; i < page.lines.length; ++i)
      ctx.fillText(page.lines[i], cx, py + 58 + i * 22);
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    if (S.tutorialPage < C.TUTORIAL_PAGES.length - 1)
      ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 28);
    else
      ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 28);
  }

  NS.hud.hud = hud;
  NS.hud.overlays = overlays;
  NS.hud.tutorial = tutorial;
})();
