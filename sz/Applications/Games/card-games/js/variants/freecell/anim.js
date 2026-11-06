;(function() {
  'use strict';

  /* FreeCell: card move, flip and deal animations and the win celebration. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.freecell;
  const S = V.S;
  const { CE, CARD_W, CARD_H, FOUNDATION_COUNT, TABLEAU_COUNT, foundationPos, tableauCardPos } = V;

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

    CE.launchWinCards(allCards, S.winAnimCards, { get value() { return S.winAnimRunning; } }, 80);
  }

  function stopWinAnimation() {
    S.winAnimRunning = false;
    if (S.winAnimId) {
      cancelAnimationFrame(S.winAnimId);
      S.winAnimId = null;
    }
    S.winAnimCards = [];
    S.particles = [];
    S.animatingCards = [];
    S.dealAnimCards = [];
    S.dealAnimRunning = false;
  }

  /* ================================================================
   *  DEAL ANIMATION
   * ================================================================ */

  function startDealAnimation() {
    S.dealAnimCards = [];
    S.dealAnimRunning = true;
    const now = performance.now();
    const centerX = S.canvasW / 2 - CARD_W / 2;
    const centerY = S.canvasH / 2 - CARD_H / 2;
    let cardNum = 0;
    for (let col = 0; col < TABLEAU_COUNT; ++col)
      for (let row = 0; row < S.tableau[col].length; ++row) {
        const dest = tableauCardPos(col, row);
        S.dealAnimCards.push({
          card: S.tableau[col][row],
          fromX: centerX,
          fromY: centerY,
          toX: dest.x,
          toY: dest.y,
          startTime: now + cardNum * 30,
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

  Object.assign(V, { startWinAnimation, stopWinAnimation, startDealAnimation, startCardMoveAnim });

})();
