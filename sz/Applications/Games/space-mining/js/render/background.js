/* The deep background: nebula gradients, three twinkling parallax star layers,
   shooting stars and the decorative far-layer asteroids. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const B = NS.background;

  B.drawNebulae = function drawNebulae() {
    D.ctx.save();
    for (const n of S.nebulae) {
      const sx = n.x - S.camera.x * 0.15;
      const sy = n.y - S.camera.y * 0.15;
      const nebGrad = D.ctx.createRadialGradient(sx, sy, 0, sx, sy, n.radius);
      nebGrad.addColorStop(0, n.color);
      nebGrad.addColorStop(1, 'rgba(0,0,0,0)');
      D.ctx.fillStyle = nebGrad;
      D.ctx.beginPath();
      D.ctx.arc(sx, sy, n.radius, 0, Math.PI * 2);
      D.ctx.fill();
    }
    D.ctx.restore();
  };

  B.drawStars = function drawStars() {
    const now = S.gameTime || Date.now() / 1000;
    const parallaxFactors = [0.1, 0.2, 0.35];

    for (let layer = 0; layer < 3; ++layer) {
      const pf = parallaxFactors[layer];
      for (const s of S.starLayers[layer]) {
        const sx = s.x - S.camera.x * pf;
        const sy = s.y - S.camera.y * pf;
        const wx = ((sx % C.CANVAS_W) + C.CANVAS_W) % C.CANVAS_W;
        const wy = ((sy % C.CANVAS_H) + C.CANVAS_H) % C.CANVAS_H;

        /* Twinkle */
        const twinkle = 0.5 + 0.5 * Math.sin(now * s.twinkleSpeed + s.twinklePhase);
        const alpha = s.alpha * twinkle;

        D.ctx.globalAlpha = alpha;
        D.ctx.fillStyle = s.hue;

        if (s.size > 1.8) {
          /* Large stars get a glow halo */
          D.ctx.save();
          D.ctx.globalAlpha = alpha * 0.2;
          D.ctx.fillStyle = s.hue === '#fff' ? '#aaccff' : s.hue;
          D.ctx.beginPath();
          D.ctx.arc(wx + s.size * 0.5, wy + s.size * 0.5, s.size * 2.5, 0, Math.PI * 2);
          D.ctx.fill();
          D.ctx.restore();
          D.ctx.globalAlpha = alpha;
          D.ctx.fillStyle = s.hue;
        }

        D.ctx.fillRect(wx, wy, s.size, s.size);
      }
    }
    D.ctx.globalAlpha = 1;
  };

  B.drawShootingStars = function drawShootingStars() {
    D.ctx.save();
    for (const ss of S.shootingStars) {
      const sx = ss.x - S.camera.x;
      const sy = ss.y - S.camera.y;
      const lifeRatio = ss.life / ss.maxLife;
      const alpha = lifeRatio < 0.3 ? lifeRatio / 0.3 : 1;
      const speed = Math.hypot(ss.vx, ss.vy);
      const nx = ss.vx / speed;
      const ny = ss.vy / speed;

      D.ctx.globalAlpha = alpha * 0.6;
      D.ctx.strokeStyle = '#cceeff';
      D.ctx.lineWidth = 1.5;
      D.ctx.beginPath();
      D.ctx.moveTo(sx, sy);
      D.ctx.lineTo(sx - nx * ss.length, sy - ny * ss.length);
      D.ctx.stroke();

      /* Bright head */
      D.ctx.globalAlpha = alpha * 0.9;
      D.ctx.fillStyle = '#fff';
      D.ctx.beginPath();
      D.ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      D.ctx.fill();
    }
    D.ctx.globalAlpha = 1;
    D.ctx.restore();
  };

  B.drawBgAsteroids = function drawBgAsteroids() {
    D.ctx.save();
    const pf = 0.25;
    for (const bg of S.bgAsteroids) {
      const sx = bg.x - S.camera.x * pf;
      const sy = bg.y - S.camera.y * pf;
      const wx = ((sx % C.CANVAS_W) + C.CANVAS_W) % C.CANVAS_W;
      const wy = ((sy % C.CANVAS_H) + C.CANVAS_H) % C.CANVAS_H;

      D.ctx.globalAlpha = bg.alpha;
      D.ctx.save();
      D.ctx.translate(wx, wy);
      D.ctx.rotate(bg.angle);
      D.ctx.beginPath();
      for (let j = 0; j < bg.vertices.length; ++j) {
        const v = bg.vertices[j];
        const px = Math.cos(v.a) * v.d;
        const py = Math.sin(v.a) * v.d;
        if (j === 0) D.ctx.moveTo(px, py);
        else D.ctx.lineTo(px, py);
      }
      D.ctx.closePath();
      D.ctx.fillStyle = '#2a2220';
      D.ctx.fill();
      D.ctx.restore();
    }
    D.ctx.globalAlpha = 1;
    D.ctx.restore();
  };
})();
