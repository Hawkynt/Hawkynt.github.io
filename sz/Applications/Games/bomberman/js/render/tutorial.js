/* The tutorial overlay: the dimmed panel, the current page's title and lines
   and the paging hint at the bottom. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const TU = NS.tutorial = NS.tutorial || {};

  TU.drawTutorialOverlay = function drawTutorialOverlay() {
    const w = C.COLS * C.TILE_SIZE;
    const h = C.ROWS * C.TILE_SIZE;
    D.ctx.fillStyle = 'rgba(0,0,0,0.8)';
    D.ctx.fillRect(0, 0, w, h);
    const page = T.TUTORIAL_PAGES[S.tutorialPage] || T.TUTORIAL_PAGES[0];
    const cx = w / 2, pw = 380, ph = 220, px = cx - pw / 2, py = (h - ph) / 2;
    D.ctx.fillStyle = 'rgba(20,20,40,0.95)';
    D.ctx.fillRect(px, py, pw, ph);
    D.ctx.strokeStyle = '#f90';
    D.ctx.lineWidth = 2;
    D.ctx.strokeRect(px, py, pw, ph);
    D.ctx.fillStyle = '#666';
    D.ctx.font = '10px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.fillText('Page ' + (S.tutorialPage + 1) + ' / ' + T.TUTORIAL_PAGES.length, cx, py + ph - 12);
    D.ctx.fillStyle = '#f90';
    D.ctx.font = 'bold 18px sans-serif';
    D.ctx.fillText(page.title, cx, py + 30);
    D.ctx.fillStyle = '#ccc';
    D.ctx.font = '13px sans-serif';
    for (let i = 0; i < page.lines.length; ++i)
      D.ctx.fillText(page.lines[i], cx, py + 58 + i * 22);
    D.ctx.fillStyle = '#888';
    D.ctx.font = '11px sans-serif';
    if (S.tutorialPage < T.TUTORIAL_PAGES.length - 1)
      D.ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 28);
    else
      D.ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 28);
  };
})();
