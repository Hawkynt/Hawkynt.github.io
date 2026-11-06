/* Go Fish: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.gofish;
  const S = V.S;
  const { CANVAS_W, DEAL_COUNT, PLAYER_HAND_Y } = V;

  function setupGoFish() {
    const d = CE.shuffle(CE.createDeck());
    S.playerHand = [];
    S.aiHand = [];
    S.stock = d;
    S.playerBooks = [];
    S.aiBooks = [];
    S.roundOver = false;
    S.gameOver = false;
    S.isPlayerTurn = true;
    S.message = '';
    S.messageTimer = 0;
    S.hoverCardIdx = -1;
    S.selectedCardIdx = -1;
    S.aiTurnTimer = 0;
    S.aiThinking = false;
    S.aiMemory = {};
    S.aiLastAsked = '';
    S.aiDrawnMatchedAsk = false;

    // Deal 7 cards to each player
    for (let i = 0; i < DEAL_COUNT; ++i) {
      const pc = S.stock.pop();
      pc.faceUp = true;
      S.playerHand.push(pc);
      if (S._host) S._host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, DEAL_COUNT), PLAYER_HAND_Y, i * 0.08);

      const ac = S.stock.pop();
      ac.faceUp = false;
      S.aiHand.push(ac);
    }

    // Check for any immediate books after deal
    V.checkForBooks(S.playerHand, S.playerBooks, 'You');
    V.checkForBooks(S.aiHand, S.aiBooks, 'AI');

    V.setMessage('Click a card to ask for its rank!', '#8f8');
  }

  Object.assign(V, { setupGoFish });

})();
