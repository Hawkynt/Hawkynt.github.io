;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.intermission.drawIntermission = function drawIntermission() {
    D.ctx.fillStyle = S.currentTheme.bg;
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    const progress = 1 - (S.intermissionTimer / C.INTERMISSION_DURATION);
    const cy = C.CANVAS_H / 2;

    /* Ghost running from Pac-Man */
    const ghostX = C.CANVAS_W + 50 - progress * (C.CANVAS_W + 150);
    const pacX = ghostX + 40;

    /* Draw frightened ghost */
    if (ghostX > -20 && ghostX < C.CANVAS_W + 20) {
      const r = C.TILE / 2 - 1;
      D.ctx.fillStyle = '#2121DE';
      D.ctx.beginPath();
      D.ctx.arc(ghostX, cy - 2, r, Math.PI, 0, false);
      D.ctx.lineTo(ghostX + r, cy + r);
      D.ctx.lineTo(ghostX + r / 2, cy + r - 3);
      D.ctx.lineTo(ghostX, cy + r);
      D.ctx.lineTo(ghostX - r / 2, cy + r - 3);
      D.ctx.lineTo(ghostX - r, cy + r);
      D.ctx.closePath();
      D.ctx.fill();

      D.ctx.fillStyle = '#FFFFFF';
      D.ctx.beginPath();
      D.ctx.arc(ghostX - 3, cy - 3, 2, 0, Math.PI * 2);
      D.ctx.fill();
      D.ctx.beginPath();
      D.ctx.arc(ghostX + 3, cy - 3, 2, 0, Math.PI * 2);
      D.ctx.fill();
    }

    /* Draw chasing Pac-Man */
    if (pacX > -20 && pacX < C.CANVAS_W + 20) {
      const mouth = Math.abs(Math.sin(performance.now() * 0.01)) * 45 * Math.PI / 180;
      D.ctx.fillStyle = '#FFD700';
      D.ctx.beginPath();
      D.ctx.moveTo(pacX, cy);
      D.ctx.arc(pacX, cy, C.TILE / 2 - 1, Math.PI + mouth, Math.PI - mouth);
      D.ctx.closePath();
      D.ctx.fill();
    }

    /* World transition text */
    const worldNum = Math.floor((S.level - 1) / C.WORLD_SIZE) + 1;
    D.ctx.font = 'bold 18px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.textBaseline = 'middle';
    D.ctx.fillStyle = '#FFD700';
    D.ctx.strokeStyle = '#000';
    D.ctx.lineWidth = 3;
    D.ctx.strokeText('WORLD ' + worldNum, C.CANVAS_W / 2, C.CANVAS_H / 2 - 60);
    D.ctx.fillText('WORLD ' + worldNum, C.CANVAS_W / 2, C.CANVAS_H / 2 - 60);

    D.ctx.font = '12px sans-serif';
    D.ctx.fillStyle = S.currentTheme.wall;
    D.ctx.fillText(S.currentTheme === C.WORLD_THEMES[0] ? '' : 'New theme!', C.CANVAS_W / 2, C.CANVAS_H / 2 + 60);
  }

})();
