/* Brick rendering: the normal gradient brick, the steel brick with its crack
   overlay and the pulsing indestructible brick. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const S = NS.state;
  const V = NS.view;
  const { lightenColor, darkenColor } = NS.rules;

  function drawNormalBrick(brick) {
    const { x, y, width: w, height: h, color } = brick;

    V.ctx.save();
    V.ctx.beginPath();
    V.ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    V.ctx.clip();

    const grad = V.ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, lightenColor(color, 30));
    grad.addColorStop(1, darkenColor(color, 30));
    V.ctx.fillStyle = grad;
    V.ctx.fillRect(x, y, w, h);

    V.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    V.ctx.lineWidth = 1;
    V.ctx.beginPath();
    V.ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 1.5);
    V.ctx.stroke();

    V.ctx.restore();
  }

  function drawSteelBrick(brick) {
    const { x, y, width: w, height: h } = brick;

    V.ctx.save();
    const grad = V.ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#bbb');
    grad.addColorStop(0.5, '#888');
    grad.addColorStop(1, '#666');
    V.ctx.fillStyle = grad;
    V.ctx.beginPath();
    V.ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    V.ctx.fill();

    V.ctx.fillStyle = 'rgba(255,255,255,0.15)';
    V.ctx.fillRect(x, y, w, 2);
    V.ctx.fillRect(x, y, 2, h);
    V.ctx.fillStyle = 'rgba(0,0,0,0.2)';
    V.ctx.fillRect(x, y + h - 2, w, 2);
    V.ctx.fillRect(x + w - 2, y, 2, h);

    /* Rivet dots */
    V.ctx.fillStyle = 'rgba(0,0,0,0.3)';
    V.ctx.beginPath();
    V.ctx.arc(x + 5, y + h / 2, 1.5, 0, Math.PI * 2);
    V.ctx.arc(x + w - 5, y + h / 2, 1.5, 0, Math.PI * 2);
    V.ctx.fill();
    V.ctx.fillStyle = 'rgba(255,255,255,0.2)';
    V.ctx.beginPath();
    V.ctx.arc(x + 5, y + h / 2 - 0.5, 0.8, 0, Math.PI * 2);
    V.ctx.arc(x + w - 5, y + h / 2 - 0.5, 0.8, 0, Math.PI * 2);
    V.ctx.fill();

    /* Crack overlay at hp=1 */
    if (brick.hp <= 1) {
      V.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      V.ctx.lineWidth = 1;
      V.ctx.beginPath();
      V.ctx.moveTo(x + w * 0.3, y + 1);
      V.ctx.lineTo(x + w * 0.45, y + h * 0.5);
      V.ctx.lineTo(x + w * 0.55, y + h * 0.3);
      V.ctx.lineTo(x + w * 0.7, y + h - 1);
      V.ctx.stroke();
      V.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      V.ctx.beginPath();
      V.ctx.moveTo(x + w * 0.31, y + 2);
      V.ctx.lineTo(x + w * 0.46, y + h * 0.5 + 1);
      V.ctx.lineTo(x + w * 0.56, y + h * 0.3 + 1);
      V.ctx.lineTo(x + w * 0.71, y + h - 1);
      V.ctx.stroke();
    }
    V.ctx.restore();
  }

  function drawIndestructibleBrick(brick) {
    const { x, y, width: w, height: h } = brick;
    const pulse = 0.5 + 0.3 * Math.sin(S.gameTime * 0.003);

    V.ctx.save();
    V.ctx.fillStyle = '#333';
    V.ctx.beginPath();
    V.ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    V.ctx.fill();

    V.ctx.strokeStyle = 'rgba(200,100,255,' + pulse.toFixed(2) + ')';
    V.ctx.lineWidth = 1.5;
    V.ctx.beginPath();
    V.ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    V.ctx.stroke();

    /* Inner X pattern */
    V.ctx.strokeStyle = 'rgba(200,100,255,0.3)';
    V.ctx.lineWidth = 1;
    V.ctx.beginPath();
    V.ctx.moveTo(x + 4, y + 3);
    V.ctx.lineTo(x + w - 4, y + h - 3);
    V.ctx.moveTo(x + w - 4, y + 3);
    V.ctx.lineTo(x + 4, y + h - 3);
    V.ctx.stroke();
    V.ctx.restore();
  }

  Object.assign(NS.drawBricks, { drawNormalBrick, drawSteelBrick, drawIndestructibleBrick });
})();
