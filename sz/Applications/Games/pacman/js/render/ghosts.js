;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.ghostview.drawGhosts = function drawGhosts() {
    for (const g of S.ghosts)
      NS.ghostview.drawGhost(g);
  }

  NS.ghostview.drawGhost = function drawGhost(ghost) {
    const x = ghost.x;
    const y = ghost.y;
    const r = C.TILE / 2 - 1;

    if (ghost.mode === C.MODE_EATEN) {
      NS.ghostview.drawGhostEyes(x, y, ghost.dir);
      return;
    }

    let bodyColor;
    const isFrightened = ghost.mode === C.MODE_FRIGHTENED;

    if (isFrightened) {
      if (ghost.frightenedFlash) {
        const flash = Math.floor(performance.now() / 150) % 2;
        bodyColor = flash ? '#FFFFFF' : '#2121DE';
      } else {
        bodyColor = '#2121DE';
      }
      /* Frightened glow aura */
      SZ.GameEffects.drawGlow(D.ctx, c => {
        c.fillStyle = bodyColor;
        c.globalAlpha = 0.3;
        c.beginPath();
        c.arc(x, y, r + 3, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
      }, '#4488FF', 6);
    } else {
      bodyColor = C.GHOST_COLORS[ghost.index];
    }

    /* Glow for normal S.ghosts */
    if (!isFrightened) {
      D.ctx.save();
      D.ctx.shadowColor = bodyColor;
      D.ctx.shadowBlur = 6;
    }

    /* Ghost body: rounded top, wavy bottom */
    D.ctx.fillStyle = bodyColor;
    D.ctx.beginPath();
    D.ctx.arc(x, y - 2, r, Math.PI, 0, false);
    D.ctx.lineTo(x + r, y + r);

    const waveTime = performance.now() * 0.008;
    const segments = 3;
    const segW = (r * 2) / segments;
    for (let i = segments - 1; i >= 0; --i) {
      const sx = x + r - i * segW;
      const sy = y + r;
      const cp = Math.sin(waveTime + i * 2) * 2;
      D.ctx.lineTo(sx - segW / 2, sy + cp - 2);
      D.ctx.lineTo(sx - segW, sy);
    }

    D.ctx.closePath();
    D.ctx.fill();

    if (!isFrightened)
      D.ctx.restore();

    /* Eyes */
    if (isFrightened)
      NS.ghostview.drawFrightenedFace(x, y);
    else
      NS.ghostview.drawGhostEyes(x, y, ghost.dir);
  }

  NS.ghostview.drawGhostEyes = function drawGhostEyes(x, y, dir) {
    D.ctx.fillStyle = '#FFFFFF';
    D.ctx.beginPath();
    D.ctx.ellipse(x - 3, y - 3, 3.5, 4.5, 0, 0, Math.PI * 2);
    D.ctx.fill();
    D.ctx.beginPath();
    D.ctx.ellipse(x + 3, y - 3, 3.5, 4.5, 0, 0, Math.PI * 2);
    D.ctx.fill();

    let px = 0, py = 0;
    switch (dir) {
      case C.DIR_LEFT:  px = -1.5; break;
      case C.DIR_RIGHT: px = 1.5;  break;
      case C.DIR_UP:    py = -2;   break;
      case C.DIR_DOWN:  py = 2;    break;
    }

    D.ctx.fillStyle = '#2121DE';
    D.ctx.beginPath();
    D.ctx.arc(x - 3 + px, y - 3 + py, 2, 0, Math.PI * 2);
    D.ctx.fill();
    D.ctx.beginPath();
    D.ctx.arc(x + 3 + px, y - 3 + py, 2, 0, Math.PI * 2);
    D.ctx.fill();
  }

  NS.ghostview.drawFrightenedFace = function drawFrightenedFace(x, y) {
    D.ctx.fillStyle = '#FFFFFF';
    D.ctx.beginPath();
    D.ctx.arc(x - 3, y - 3, 2, 0, Math.PI * 2);
    D.ctx.fill();
    D.ctx.beginPath();
    D.ctx.arc(x + 3, y - 3, 2, 0, Math.PI * 2);
    D.ctx.fill();

    D.ctx.strokeStyle = '#FFFFFF';
    D.ctx.lineWidth = 1;
    D.ctx.beginPath();
    D.ctx.moveTo(x - 5, y + 3);
    for (let i = 0; i < 5; ++i) {
      const sx = x - 5 + i * 2.5;
      const sy = y + 3 + (i % 2 === 0 ? 0 : -2);
      D.ctx.lineTo(sx, sy);
    }
    D.ctx.stroke();
  }

})();
