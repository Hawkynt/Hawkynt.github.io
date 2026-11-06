;(function() {
  'use strict';

  /* Forty Thieves: card move, flip and deal animations and the win celebration. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.fortythieves;
  const S = V.S;
  const { TABLEAU_COUNT, FOUNDATION_COUNT, stockPos, foundationPos, tableauCardPos } = V;

  /* ================================================================
   *  DEAL ANIMATION
   * ================================================================ */

  function startDealAnimation() {
    S.dealAnimCards = [];
    S.dealAnimRunning = true;
    const now = performance.now();
    const sp = stockPos();
    let cardNum = 0;
    for (let row = 0; row < 4; ++row)
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const dest = tableauCardPos(col, row);
        S.dealAnimCards.push({
          card: S.tableau[col][row],
          fromX: sp.x,
          fromY: sp.y,
          toX: dest.x,
          toY: dest.y,
          startTime: now + cardNum * 25,
          duration: 250
        });
        ++cardNum;
      }
  }

  /* ================================================================
   *  CARD MOVE ANIMATION
   * ================================================================ */

  function startCardMoveAnim(card, fromX, fromY, toX, toY, onDone) {
    S.animatingCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now(),
      duration: 250,
      onDone
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
    }, 40);
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
    S.dealAnimCards = [];
    S.dealAnimRunning = false;
  }

  Object.assign(V, { startDealAnimation, startCardMoveAnim, startWinAnimation, stopWinAnimation });

})();
