/* Host-side card animation system: deal slides, flip transitions, glow pulses. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const K = NS.constants;
  const S = NS.state;
  const E = NS.effects;
  const D = NS.dom;
  const A = NS.animations = NS.animations || {};

  /* ══════════════════════════════════════════════════════════════════
     CARD ANIMATIONS (shared host-side animation system)
     ══════════════════════════════════════════════════════════════════ */

  A.updateAnimations = function(dt) {
    for (const a of S.dealAnimations) {
      if (a.t < 0 && a.t + dt >= 0)
        E.sound('click', { pitch: 0.7 + Math.random() * 0.2, volume: 0.6 });
      a.t += dt;
      if (a.t >= a.duration && !a.done) {
        a.done = true;
        a.card._dealing = false;
        // Shimmer on face cards dealt face-up
        if (SZ.CardThemes && a.card.faceUp && (a.card.rank === 'J' || a.card.rank === 'Q' || a.card.rank === 'K'))
          SZ.CardThemes.addShimmer(a.toX, a.toY, CE.CARD_W, CE.CARD_H, 'sparkle');
      }
    }
    S.dealAnimations = S.dealAnimations.filter(a => !a.done);

    for (const f of S.flipAnimations) {
      f.t += dt;
      const half = f.duration / 2;
      if (f.t < half)
        f.scaleX = 1 - (f.t / half);
      else {
        f.scaleX = (f.t - half) / half;
        f.cardRef.faceUp = f.faceUp;
      }
    }
    S.flipAnimations = S.flipAnimations.filter(f => f.t < f.duration);

    for (const g of S.glowCards) g.t += dt;
    S.glowCards = S.glowCards.filter(g => g.t < g.duration);

    if (S.chipSparkleTimer > 0) S.chipSparkleTimer -= dt;
  };

  A.drawDealAnimations = function() {
    for (const a of S.dealAnimations) {
      if (a.t < 0) continue;
      const p = Math.min(a.t / a.duration, 1);
      const ease = 1 - (1 - p) * (1 - p);
      const x = a.fromX + (a.toX - a.fromX) * ease;
      const y = a.fromY + (a.toY - a.fromY) * ease;
      CE.drawCardBack(D.ctx, x, y);
    }
  };

  A.drawGlowEffects = function() {
    for (const g of S.glowCards) {
      const alpha = 0.5 * (1 - g.t / g.duration);
      D.ctx.save();
      D.ctx.shadowColor = '#fc0';
      D.ctx.shadowBlur = 20 + 10 * Math.sin(g.t * 6);
      D.ctx.fillStyle = 'rgba(255, 200, 0, ' + alpha + ')';
      CE.drawRoundedRect(D.ctx, g.x - 3, g.y - 3, g.w + 6, g.h + 6, CE.CARD_RADIUS + 2);
      D.ctx.fill();
      D.ctx.restore();
    }
  };
})();
