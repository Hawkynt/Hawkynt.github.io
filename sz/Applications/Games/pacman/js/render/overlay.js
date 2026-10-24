;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.overlay.drawOverlayText = function drawOverlayText(text, sub) {
    D.ctx.fillStyle = 'rgba(0,0,0,0.4)';
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    D.ctx.font = 'bold 24px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.textBaseline = 'middle';
    D.ctx.fillStyle = '#FFD700';
    D.ctx.strokeStyle = '#000';
    D.ctx.lineWidth = 3;
    D.ctx.strokeText(text, C.CANVAS_W / 2, C.CANVAS_H / 2 - 10);
    D.ctx.fillText(text, C.CANVAS_W / 2, C.CANVAS_H / 2 - 10);

    if (sub) {
      D.ctx.font = '12px sans-serif';
      D.ctx.fillStyle = '#ccc';
      D.ctx.fillText(sub, C.CANVAS_W / 2, C.CANVAS_H / 2 + 15);
    }
  }

  NS.overlay.drawReadyText = function drawReadyText() {
    D.ctx.font = 'bold 18px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.textBaseline = 'middle';
    D.ctx.fillStyle = '#FFD700';
    D.ctx.fillText('READY!', C.CANVAS_W / 2, 17 * C.TILE + C.TILE / 2);
  }

})();
