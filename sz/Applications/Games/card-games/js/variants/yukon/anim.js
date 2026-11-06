;(function() {
  'use strict';

  /* Yukon: card move, flip and deal animations and the win celebration. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.yukon;
  const S = V.S;
  const { FOUNDATION_COUNT, foundationPos } = V;

  /* ================================================================
   *  ANIMATIONS
   * ================================================================ */

  function startCardMoveAnim(card, fromX, fromY, toX, toY, onDone) {
    S.animatingCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now(),
      duration: 250,
      onDone
    });
  }

  function startFlipAnim(card, x, y) {
    S.flippingCards.push({
      card, x, y,
      startTime: performance.now(),
      duration: 200
    });
  }

  /* ================================================================
   *  WIN ANIMATION
   * ================================================================ */

  function startWinAnimation() {
    S.winAnimCards = [];
    S.particles = [];
    S.winAnimRunning = true;
    S.lastFireworkTime = 0;

    const allCards = [];
    for (let fi = 0; fi < FOUNDATION_COUNT; ++fi) {
      const fp = foundationPos(fi);
      for (const card of S.foundations[fi])
        allCards.push({ card, startX: fp.x, startY: fp.y });
    }

    let launchIndex = 0;
    S.winLaunchInterval = setInterval(() => {
      if (launchIndex >= allCards.length || !S.winAnimRunning) {
        clearInterval(S.winLaunchInterval);
        S.winLaunchInterval = null;
        return;
      }
      const c = allCards[launchIndex];
      S.winAnimCards.push({
        card: c.card,
        x: c.startX,
        y: c.startY,
        vx: (Math.random() - 0.5) * 8,
        vy: -(Math.random() * 6 + 2),
        gravity: 0.2,
        bounces: 0,
        angle: 0,
        angularVelocity: (Math.random() - 0.5) * 0.08,
        trail: []
      });
      ++launchIndex;
    }, 80);
  }

  function stopWinAnimation() {
    S.winAnimRunning = false;
    if (S.winAnimId) {
      cancelAnimationFrame(S.winAnimId);
      S.winAnimId = null;
    }
    if (S.winLaunchInterval) {
      clearInterval(S.winLaunchInterval);
      S.winLaunchInterval = null;
    }
    S.winAnimCards = [];
    S.particles = [];
    S.animatingCards = [];
    S.flippingCards = [];
  }

  Object.assign(V, { startCardMoveAnim, startFlipAnim, startWinAnimation, stopWinAnimation });

})();
