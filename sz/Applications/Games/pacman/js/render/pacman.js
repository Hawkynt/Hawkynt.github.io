;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.pacview.drawPacman = function drawPacman() {
    const angle = S.pacman.mouthAngle * Math.PI / 180;
    let rotation = 0;
    switch (S.pacman.dir) {
      case C.DIR_RIGHT: rotation = 0; break;
      case C.DIR_DOWN:  rotation = Math.PI / 2; break;
      case C.DIR_LEFT:  rotation = Math.PI; break;
      case C.DIR_UP:    rotation = -Math.PI / 2; break;
    }

    if (S.pacmanPhasing) {
      D.ctx.save();
      D.ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.01) * 0.2;
    }

    SZ.GameEffects.drawGlow(D.ctx, c => {
      c.save();
      c.translate(S.pacman.x, S.pacman.y);
      c.rotate(rotation);
      c.fillStyle = '#FFD700';
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, C.TILE / 2 - 1, angle, Math.PI * 2 - angle);
      c.closePath();
      c.fill();
      c.restore();
    }, '#FFD700', 8);

    if (S.pacmanPhasing)
      D.ctx.restore();
  }

})();
