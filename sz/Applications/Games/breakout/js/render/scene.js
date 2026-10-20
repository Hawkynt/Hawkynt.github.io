/* The frame: background and starfield, barrier, bricks, lasers, power-ups, paddle,
   balls, effects and the state overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const FX = NS.effects;
  const { drawNormalBrick, drawSteelBrick, drawIndestructibleBrick } = NS.drawBricks;
  const { drawElectricPaddle } = NS.drawPaddle;
  const { drawPowerUpCapsule } = NS.drawPowerUps;

  /* ---- Draw ---- */
  function draw() {
    V.ctx.clearRect(0, 0, S.CANVAS_W, S.CANVAS_H);

    V.ctx.save();
    FX.screenShake.apply(V.ctx);

    /* Background */
    V.ctx.fillStyle = '#0a0a14';
    V.ctx.fillRect(0, 0, S.CANVAS_W, S.CANVAS_H);
    FX.starfield.draw(V.ctx);

    /* Barrier */
    if (S.barrier) {
      if (S.barrier.life > 0) {
        V.ctx.save();
        const barGrad = V.ctx.createLinearGradient(0, S.CANVAS_H - 6, 0, S.CANVAS_H);
        barGrad.addColorStop(0, 'rgba(100,120,255,0.0)');
        barGrad.addColorStop(1, 'rgba(100,120,255,0.4)');
        V.ctx.fillStyle = barGrad;
        V.ctx.fillRect(0, S.CANVAS_H - 6, S.CANVAS_W, 6);
        V.ctx.restore();
      } else if (S.barrier.flashTime > 0) {
        V.ctx.save();
        V.ctx.globalAlpha = S.barrier.flashTime / 15;
        V.ctx.fillStyle = '#88f';
        V.ctx.fillRect(0, S.CANVAS_H - 4, S.CANVAS_W, 4);
        V.ctx.restore();
      }
    }

    /* Bricks */
    for (const brick of S.bricks) {
      if (!brick.alive)
        continue;

      /* Entry animation */
      if (brick.entryProgress < 1) {
        const p = brick.entryProgress;
        if (p <= 0)
          continue;
        V.ctx.save();
        V.ctx.globalAlpha = p;
        V.ctx.translate(0, (1 - p) * -30);
      }

      if (brick.type === 'glass')
        SZ.GameEffects.drawGlassBrick(V.ctx, brick.x, brick.y, brick.width, brick.height, S.gameTime + brick.glareOffset);
      else if (brick.type === 'steel')
        drawSteelBrick(brick);
      else if (brick.type === 'indestructible')
        drawIndestructibleBrick(brick);
      else
        drawNormalBrick(brick);

      if (brick.entryProgress < 1)
        V.ctx.restore();
    }

    /* Lasers */
    for (const laser of S.lasers) {
      V.ctx.save();
      V.ctx.shadowColor = '#f44';
      V.ctx.shadowBlur = 6;
      V.ctx.strokeStyle = '#f66';
      V.ctx.lineWidth = 2;
      V.ctx.beginPath();
      V.ctx.moveTo(laser.x, laser.y);
      V.ctx.lineTo(laser.x, laser.y + 10);
      V.ctx.stroke();
      V.ctx.strokeStyle = '#fcc';
      V.ctx.lineWidth = 1;
      V.ctx.beginPath();
      V.ctx.moveTo(laser.x, laser.y);
      V.ctx.lineTo(laser.x, laser.y + 10);
      V.ctx.stroke();
      V.ctx.restore();
    }

    /* Power-ups */
    for (const pu of S.powerUps)
      drawPowerUpCapsule(pu);

    /* Paddle */
    drawElectricPaddle();

    /* Balls */
    for (const ball of S.balls) {
      V.ctx.save();
      const ballColor = ball.fire ? '#f80' : '#fff';
      const glowCol = ball.fire ? '#f60' : '#8bf';

      /* Charge glow when attached */
      if (ball.attached && ball.chargeTime > 0) {
        const chargeAlpha = Math.min(0.5, ball.chargeTime / 2000);
        V.ctx.save();
        V.ctx.globalAlpha = chargeAlpha;
        V.ctx.fillStyle = glowCol;
        V.ctx.beginPath();
        V.ctx.arc(ball.x, ball.y, ball.radius * 2.5, 0, Math.PI * 2);
        V.ctx.fill();
        V.ctx.restore();
      }

      SZ.GameEffects.drawGlow(V.ctx, function(c) {
        c.fillStyle = ballColor;
        c.beginPath();
        c.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        c.fill();
      }, glowCol, 12);

      /* Ball highlight */
      V.ctx.fillStyle = 'rgba(255,255,255,0.5)';
      V.ctx.beginPath();
      V.ctx.arc(ball.x - 1.5, ball.y - 1.5, ball.radius * 0.4, 0, Math.PI * 2);
      V.ctx.fill();
      V.ctx.restore();
    }

    /* Particles and floating text */
    FX.particles.draw(V.ctx);
    FX.floatingText.draw(V.ctx);

    FX.screenShake.restore(V.ctx);
    V.ctx.restore();

    /* Overlays */
    if (S.state === C.STATE_IDLE)
      drawOverlay('Press SPACE to launch', null);
    else if (S.state === C.STATE_PAUSED)
      drawOverlay('PAUSED', 'Press P to resume');
    else if (S.state === C.STATE_GAME_OVER)
      drawOverlay('GAME OVER', 'Score: ' + S.score + '\nPress Enter to restart');
  }

  function drawOverlay(title, subtitle) {
    V.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    V.ctx.fillRect(0, 0, S.CANVAS_W, S.CANVAS_H);

    V.ctx.fillStyle = '#fff';
    V.ctx.font = 'bold 28px sans-serif';
    V.ctx.textAlign = 'center';
    V.ctx.textBaseline = 'middle';
    V.ctx.fillText(title, S.CANVAS_W / 2, S.CANVAS_H / 2 - 15);

    if (subtitle) {
      V.ctx.font = '14px sans-serif';
      V.ctx.fillStyle = '#ccc';
      const lines = subtitle.split('\n');
      for (let i = 0; i < lines.length; ++i)
        V.ctx.fillText(lines[i], S.CANVAS_W / 2, S.CANVAS_H / 2 + 15 + i * 20);
    }
  }

  Object.assign(NS.scene, { draw, drawOverlay });
})();
