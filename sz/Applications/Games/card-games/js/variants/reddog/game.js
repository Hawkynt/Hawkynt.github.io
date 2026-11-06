/* Red Dog: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.reddog;
  const S = V.S;
  const { CANVAS_W, PHASE_BET, PHASE_SHOW_POSTS, POST_Y, LEFT_POST_X, RIGHT_POST_X } = V;

  function startDeal() {
    if (S.phase !== PHASE_BET || S.betAmount < 10) return;
    if (S.betAmount > S.score) S.betAmount = S.score;

    // Reshuffle if low
    if (S.deck.length < 10)
      S.deck = CE.shuffle(CE.createDeck());

    S.postCards = [];
    S.middleCard = null;
    S.raisedBet = 0;
    S.resultMsg = '';
    S.showTimer = 0;

    // Draw two post cards
    const c1 = S.deck.pop();
    c1.faceUp = true;
    const c2 = S.deck.pop();
    c2.faceUp = true;

    const [low, high] = V.orderPosts(c1, c2);
    S.postCards = [low, high];

    if (S._host) {
      S._host.dealCardAnim(low, CANVAS_W / 2, -CE.CARD_H, LEFT_POST_X, POST_Y, 0);
      S._host.dealCardAnim(high, CANVAS_W / 2, -CE.CARD_H, RIGHT_POST_X, POST_Y, 0.15);
    }

    S.spread = V.computeSpread(low, high);
    S.payoutMultiplier = V.payoutForSpread(S.spread);

    // Check for pair or consecutive immediately
    if (V.rankIndex(low) === V.rankIndex(high)) {
      // Pair: auto-draw third card
      S.phase = PHASE_SHOW_POSTS;
      S.showTimer = 0;
    } else if (S.spread === 0) {
      // Consecutive: push
      S.phase = PHASE_SHOW_POSTS;
      S.showTimer = 0;
    } else {
      // Normal spread: player decides to raise or call
      S.phase = PHASE_SHOW_POSTS;
      S.showTimer = 0;
    }
  }

  function setupRedDog() {
    if (S.deck.length < 10)
      S.deck = CE.shuffle(CE.createDeck());
    S.postCards = [];
    S.middleCard = null;
    S.phase = PHASE_BET;
    S.betAmount = 10;
    S.selectedChip = 10;
    S.raisedBet = 0;
    S.spread = 0;
    S.payoutMultiplier = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.showTimer = 0;
  }

  function tick(dt) {
    // Pair/consecutive auto-handling with a short delay for visual feedback
    // (handled by button click instead for better UX)
  }

  Object.assign(V, { startDeal, setupRedDog, tick });

})();
