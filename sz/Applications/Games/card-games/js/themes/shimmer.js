;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;
  const CT = SZ.CardThemes || (SZ.CardThemes = {});

  /* ================================================================
   *  SECTION F: SHIMMER EFFECTS
   * ================================================================ */

  const shimmerCards = [];

  function addShimmer(x, y, w, h, type) {
    shimmerCards.push({
      x, y,
      w: w || CE.CARD_W,
      h: h || CE.CARD_H,
      t: 0,
      duration: type === 'pulse' ? 1.5 : 0.8,
      type: type || 'sparkle'
    });
  }

  function updateShimmers(dt) {
    for (let i = shimmerCards.length - 1; i >= 0; --i) {
      shimmerCards[i].t += dt;
      if (shimmerCards[i].t >= shimmerCards[i].duration)
        shimmerCards.splice(i, 1);
    }
  }

  function drawShimmers(cx) {
    for (const s of shimmerCards) {
      const progress = s.t / s.duration;
      if (progress < 0 || progress > 1) continue;

      cx.save();
      const cr = CE.CARD_RADIUS * Math.min(s.w / CE.CARD_W, s.h / CE.CARD_H);
      cx.beginPath();
      CE.drawRoundedRect(cx, s.x, s.y, s.w, s.h, cr);
      cx.clip();

      if (s.type === 'sparkle') {
        // Diagonal light sweep across card face
        const sweepX = s.x - s.w + progress * (s.w * 3);
        const grad = cx.createLinearGradient(sweepX - 20, s.y, sweepX + 20, s.y + s.h);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.4, 'rgba(255,255,255,' + (0.35 * (1 - progress)) + ')');
        grad.addColorStop(0.5, 'rgba(255,255,255,' + (0.5 * (1 - progress)) + ')');
        grad.addColorStop(0.6, 'rgba(255,255,255,' + (0.35 * (1 - progress)) + ')');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        cx.fillStyle = grad;
        cx.fillRect(s.x, s.y, s.w, s.h);
      } else {
        // Pulse -- expanding gold glow ring
        const alpha = 0.6 * (1 - progress);
        const radius = Math.max(s.w, s.h) * 0.3 * (1 + progress);
        cx.shadowColor = '#fc0';
        cx.shadowBlur = 15 + 10 * Math.sin(progress * Math.PI);
        cx.strokeStyle = 'rgba(255, 200, 0, ' + alpha + ')';
        cx.lineWidth = 3 * (1 - progress);
        cx.beginPath();
        cx.arc(s.x + s.w / 2, s.y + s.h / 2, radius, 0, Math.PI * 2);
        cx.stroke();
      }

      cx.restore();
    }
  }

  CT.addShimmer = addShimmer;
  CT.updateShimmers = updateShimmers;
  CT.drawShimmers = drawShimmers;

})();
