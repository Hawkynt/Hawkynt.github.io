/* Touch play: swiping anywhere turns the snake (one drag can chain several turns), with on-screen
   buttons for venom and pause in the corners, shown once the screen has been touched. Owns the
   swipe anchor. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;

  const SWIPE = 24;
  const swipe = { id: -1, x: 0, y: 0 };

  function buttons() {
    const v = visible();
    return [
      { id: 'venom', x: v.x1 - 70, y: v.y1 - 80, r: 48 },
      { id: 'pause', x: v.x1 - 40, y: v.y0 + 36, r: 26 },
    ];
  }

  function down(id, x, y) {
    const bs = buttons();
    for (let k = 0; k < bs.length; ++k) {
      const b = bs[k];
      if ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) < b.r * b.r * 1.3) {
        if (b.id === 'venom') NS.combat.spit();
        else NS.screens.pause();
        return;
      }
    }
    swipe.id = id;
    swipe.x = x;
    swipe.y = y;
  }

  function move(id, x, y) {
    if (swipe.id !== id) return;
    const dx = x - swipe.x, dy = y - swipe.y;
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
    const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    NS.snake.queueDir(d);
    swipe.x = x;
    swipe.y = y;
  }

  function up(id) {
    if (swipe.id === id) swipe.id = -1;
  }

  function draw() {
    if (!G.input.touch || G.screen !== 'playing' || !G.run) return;
    const bs = buttons();
    for (let k = 0; k < bs.length; ++k) {
      const b = bs[k];
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = b.id === 'venom' ? '#9aff4a' : UI.text;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (b.id === 'venom') {
        kit.icon('drop', b.x, b.y - 6, 30, '#9aff4a');
        kit.text(String(G.run.venom), b.x, b.y + 24, 14, '#ffffff', { align: 'center', weight: 'bold' });
      } else {
        ctx.fillStyle = UI.text;
        ctx.fillRect(b.x - 8, b.y - 10, 6, 20);
        ctx.fillRect(b.x + 2, b.y - 10, 6, 20);
      }
      ctx.globalAlpha = 1;
    }
    if (G.run.time < 6 && G.run.mode !== 'demo') {
      ctx.globalAlpha = Math.max(0, 1 - G.run.time / 6);
      kit.text('Swipe to turn', 640, 690, 16, '#ffffff', { align: 'center', weight: 'bold' });
      ctx.globalAlpha = 1;
    }
  }

  Object.assign(NS.touch, {
    down, move, up, draw, buttons
  });
})();
