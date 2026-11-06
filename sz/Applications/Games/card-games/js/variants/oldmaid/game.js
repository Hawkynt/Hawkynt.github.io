/* Old Maid: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.oldmaid;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_REMOVING_PAIRS, PHASE_PLAYER_DRAW, PHASE_AI_DRAW, AI_DRAW_DELAY } = V;

  function deal() {
    const deck = CE.shuffle(V.createOldMaidDeck());
    S.playerHand = [];
    S.aiHand = [];
    S.playerPairs = [];
    S.aiPairs = [];
    S.pairRemoveQueue = [];
    S.lastDiscardedPair = null;
    S.lastDiscardedBy = '';
    S.hoverCardIdx = -1;
    S.aiTimer = 0;
    S.pairRemoveTimer = 0;
    S.discardAnimTimer = 0;
    S.queenGlowTimer = 0;
    S.roundOver = false;
    S.gameOver = false;

    for (let i = 0; i < deck.length; ++i) {
      if (i % 2 === 0)
        S.playerHand.push(deck[i]);
      else
        S.aiHand.push(deck[i]);
    }

    for (const c of S.playerHand) c.faceUp = true;
    V.sortHand(S.playerHand);
    V.sortHand(S.aiHand);

    // Shuffle AI drawable order
    V.refreshAiDrawableOrder();

    // Animate dealing
    if (S._host) {
      for (let i = 0; i < S.playerHand.length; ++i) {
        const x = V.playerCardX(i, S.playerHand.length);
        const y = CANVAS_H - CE.CARD_H - 20;
        S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, -CE.CARD_H, x, y, i * 0.04);
      }
    }

    // Start pair removal phase
    S.phase = PHASE_REMOVING_PAIRS;
    S.pairRemoveTimer = 0.8; // initial delay before starting pair removal
    V.buildPairRemoveQueue();
  }

  function startDrawingPhase() {
    if (V.checkGameEnd()) return;
    // Player draws first
    S.phase = PHASE_PLAYER_DRAW;
    V.refreshAiDrawableOrder();
  }

  function finishPlayerTurn() {
    V.sortHand(S.playerHand);
    V.refreshAiDrawableOrder();
    if (V.checkGameEnd()) return;
    S.phase = PHASE_AI_DRAW;
    S.aiTimer = AI_DRAW_DELAY;
  }

  function finishAiTurn() {
    V.sortHand(S.playerHand);
    V.sortHand(S.aiHand);
    V.refreshAiDrawableOrder();
    if (V.checkGameEnd()) return;

    if (S.aiHand.length === 0) {
      // AI has no cards, check if game is over
      if (V.checkGameEnd()) return;
    }

    S.phase = PHASE_PLAYER_DRAW;
    V.refreshAiDrawableOrder();
  }

  Object.assign(V, { deal, startDrawingPhase, finishPlayerTurn, finishAiTurn });

})();
