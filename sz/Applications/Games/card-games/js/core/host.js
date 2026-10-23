/* The host object passed to every variant module: shared effects, score and
   round-over callbacks, and the card animation entry points. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const K = NS.constants;
  const S = NS.state;
  const E = NS.effects;
  const ST = NS.status;

  /* ══════════════════════════════════════════════════════════════════
     HOST OBJECT (passed to inline-rendered variants)
     ══════════════════════════════════════════════════════════════════ */

  NS.host = {
    particles: E.particles,
    floatingText: E.floatingText,
    screenShake: E.screenShake,
    get hintsEnabled() { return S.hintsEnabled; },
    get autoSortHand() { return S.autoSortHand; },
    hintTime: 0,
    getScore() { return S.score; },
    onScoreChanged(newScore) {
      if (newScore > S.score && S.state === K.STATE_PLAYING)
        E.sound('pickup', { volume: 0.4 });
      S.score = newScore;
      ST.updateStatus();
      ST.saveHighScores();
    },
    onRoundOver(isGameOver) {
      if (isGameOver || S.score < S.roundStartScore) E.outcomeSound('lose');
      else if (S.score > S.roundStartScore) E.outcomeSound('win');
      else E.outcomeSound('drop');
      if (isGameOver) {
        S.state = K.STATE_GAME_OVER;
        E.floatingText.add(K.CANVAS_W / 2, K.CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
      } else {
        S.state = K.STATE_ROUND_OVER;
      }
      ST.updateStatus();
      ST.saveHighScores();
    },
    dealCardAnim(card, fromX, fromY, toX, toY, delay) {
      card._dealing = true;
      S.dealAnimations.push({
        card, fromX, fromY, toX, toY,
        t: -delay, duration: 0.3, done: false
      });
    },
    flipCard(cardRef, faceUp) {
      E.sound('click', { pitch: 0.8, volume: 0.7 });
      S.flipAnimations.push({
        cardRef, t: 0, duration: 0.25, faceUp, scaleX: 1
      });
    },
    addGlow(x, y, w, h, duration) {
      S.glowCards.push({ x, y, w, h, t: 0, duration: duration || 1.5 });
      E.sound('select', { volume: 0.6 });
      if (SZ.CardThemes) SZ.CardThemes.addShimmer(x, y, w, h, 'pulse');
    },
    triggerChipSparkle(x, y) {
      E.particles.sparkle(x, y, 20, { color: '#fa0', speed: 80, life: 0.8 });
      E.sound('coin');
      S.chipSparkleTimer = 1.0;
    }
  };
})();
