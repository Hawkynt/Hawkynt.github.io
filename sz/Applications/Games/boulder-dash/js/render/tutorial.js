/* The tutorial overlay painted on the canvas: page frame, page counter, title,
   lines and the navigation footer. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  function drawTutorialOverlay() {
    const w = V.canvas.width, h = V.canvas.height;
    V.ctx.fillStyle = 'rgba(0,0,0,0.8)';
    V.ctx.fillRect(0, 0, w, h);
    const page = C.TUTORIAL_PAGES[S.tutorialPage] || C.TUTORIAL_PAGES[0];
    const cx = w / 2, pw = 380, ph = 200, px = cx - pw / 2, py = (h - ph) / 2;
    V.ctx.fillStyle = 'rgba(20,15,10,0.95)';
    V.ctx.fillRect(px, py, pw, ph);
    V.ctx.strokeStyle = '#ffd700';
    V.ctx.lineWidth = 2;
    V.ctx.strokeRect(px, py, pw, ph);
    V.ctx.fillStyle = '#666';
    V.ctx.font = '10px sans-serif';
    V.ctx.textAlign = 'center';
    V.ctx.fillText('Page ' + (S.tutorialPage + 1) + ' / ' + C.TUTORIAL_PAGES.length, cx, py + ph - 12);
    V.ctx.fillStyle = '#ffd700';
    V.ctx.font = 'bold 18px sans-serif';
    V.ctx.fillText(page.title, cx, py + 30);
    V.ctx.fillStyle = '#ccc';
    V.ctx.font = '13px sans-serif';
    for (let i = 0; i < page.lines.length; ++i)
      V.ctx.fillText(page.lines[i], cx, py + 58 + i * 22);
    V.ctx.fillStyle = '#888';
    V.ctx.font = '11px sans-serif';
    if (S.tutorialPage < C.TUTORIAL_PAGES.length - 1)
      V.ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 28);
    else
      V.ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 28);
    V.ctx.textAlign = 'start';
  }

  Object.assign(NS.tutorial, { drawTutorialOverlay });
})();
