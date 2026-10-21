/* Star layer: twinkling drift normally, radial streaks during the warp. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;
  const ctx = NS.dom.ctx;

  function drawStars() {
    const time = performance.now() / 1000;
    const isWarping = !!S.warpState;
    let warpProgress = 0, warpI = 0;

    if (isWarping) {
      warpProgress = 1 - S.warpState.timer / S.warpState.duration;
      warpI = Math.sin(warpProgress * Math.PI);
    }

    for (const s of S.stars) {
      const twinkle = Math.sin(time * s.twinkleSpeed + s.twinklePhase) * 0.15;
      const brightness = NS.rules.clamp(s.baseBrightness + twinkle, 0.1, 1);

      if (isWarping) {
        const cx = S.W / 2, cy = S.H / 2;
        const dx = s.x - cx, dy = s.y - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len, ny = dy / len;
        const trailLen = warpI * 50 * (s.size + 0.5);

        ctx.save();
        ctx.globalAlpha = brightness * (0.6 + warpI * 0.4);

        const tg = ctx.createLinearGradient(
          s.x - nx * trailLen, s.y - ny * trailLen,
          s.x, s.y
        );
        tg.addColorStop(0, 'rgba(255,255,255,0)');
        tg.addColorStop(1, s.color);
        ctx.strokeStyle = tg;
        ctx.lineWidth = s.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x - nx * trailLen, s.y - ny * trailLen);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.globalAlpha = brightness;
        ctx.fillStyle = s.color;
        if (s.size > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else
          ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.starfield, { drawStars });
})();
