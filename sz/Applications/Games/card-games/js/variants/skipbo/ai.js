/* Skip-Bo: opponent decisions and turn pacing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['skipbo'];
  const S = V.S;
  const { CANVAS_W, AI_TURN_DELAY } = V;

  function endSkipBoAiTurn() {
    while (S.aiHands[0].length < 5 && S.deck.length > 0)
      S.aiHands[0].push(S.deck.pop());
    while (S.playerHand.length < 5 && S.deck.length > 0)
      S.playerHand.push(S.deck.pop());
    S.skipBoPlayerTurn = true;
    S.skipBoSelectedCard = -1;
    S.skipBoSelectedSource = null;
  }

  function skipBoAiTurn() {
    if (S.roundOver || S.gameOver || S.skipBoPlayerTurn) return;
    const stock = S.skipBoStockPiles[1];
    if (stock.length > 0) {
      for (let b = 0; b < 4; ++b) {
        if (V.canPlaySkipBo(stock[stock.length - 1], S.skipBoBuildPiles[b])) {
          const card = stock.pop();
          S.skipBoBuildPiles[b].push(card);
          if (S.skipBoBuildPiles[b].length >= 12) S.skipBoBuildPiles[b] = [];
          if (stock.length === 0) {
            if (S._host) S._host.floatingText.add(CANVAS_W / 2, 300, 'AI WINS!', { color: '#f44', size: 28 });
            S.roundOver = true;
          }
          return;
        }
      }
    }
    for (let i = S.aiHands[0].length - 1; i >= 0; --i) {
      for (let b = 0; b < 4; ++b) {
        if (V.canPlaySkipBo(S.aiHands[0][i], S.skipBoBuildPiles[b])) {
          S.skipBoBuildPiles[b].push(S.aiHands[0].splice(i, 1)[0]);
          if (S.skipBoBuildPiles[b].length >= 12) S.skipBoBuildPiles[b] = [];
          if (S.aiHands[0].length === 0)
            while (S.aiHands[0].length < 5 && S.deck.length > 0)
              S.aiHands[0].push(S.deck.pop());
          return;
        }
      }
    }
    if (S.aiHands[0].length > 0) S.aiHands[0].pop();
    endSkipBoAiTurn();
  }

  function tick(dt) {
    if (S.roundOver || S.gameOver) return;
    if (!S.skipBoPlayerTurn) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        skipBoAiTurn();
      }
    }
  }

  Object.assign(V, { tick });

})();
