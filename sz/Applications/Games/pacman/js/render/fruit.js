;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.fruitview.drawFruit = function drawFruit(timestamp) {
    if (!S.fruitActive)
      return;
    const fruitIndex = Math.min(S.level - 1, T.FRUIT_TABLE.length - 1);
    const fruit = T.FRUIT_TABLE[fruitIndex];
    const fx = T.FRUIT_POS.x * C.TILE + C.TILE / 2;
    const ts = timestamp || performance.now();
    const bob = Math.sin(ts * 0.004) * 2;
    const fy = T.FRUIT_POS.y * C.TILE + C.TILE / 2 + bob;
    const pulse = Math.sin(ts * 0.005) * 0.3 + 0.7;

    SZ.GameEffects.drawGlow(D.ctx, c => {
      c.fillStyle = fruit.color;
      c.beginPath();
      c.arc(fx, fy, 5 * pulse, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = '#00AA00';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(fx, fy - 5 * pulse);
      c.lineTo(fx + 1, fy - 8 * pulse);
      c.stroke();
    }, fruit.color, 6 * pulse);
  }

})();
