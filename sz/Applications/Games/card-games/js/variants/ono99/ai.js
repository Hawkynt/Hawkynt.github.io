/* ONO 99: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['ono99'];
  const S = V.S;

  function aiTurn() {
    if (S.roundOver || S.gameOver || S.eliminated[S.currentPlayer]) return;
    if (!V.canPlayAny(S.currentPlayer)) {
      V.eliminatePlayer(S.currentPlayer);
      if (!V.checkGameEnd())
        S.currentPlayer = V.getNextAlive(S.currentPlayer);
      return;
    }

    const hand = S.hands[S.currentPlayer];
    // Near 99: prefer specials
    if (S.runningTotal >= 85) {
      for (let i = 0; i < hand.length; ++i)
        if (hand[i].value === 'Hold' || hand[i].value === 'Minus 10') { V.playCard(S.currentPlayer, i); return; }
      for (let i = 0; i < hand.length; ++i)
        if (hand[i].value === 'Reverse' || hand[i].value === 'Double Play') { V.playCard(S.currentPlayer, i); return; }
    }
    // Play highest safe number
    let bestIdx = -1, bestVal = -1;
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].type === 'number' && V.canPlay(hand[i]) && hand[i].pointValue > bestVal) {
        bestVal = hand[i].pointValue;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) { V.playCard(S.currentPlayer, bestIdx); return; }
    // Any playable
    for (let i = 0; i < hand.length; ++i)
      if (V.canPlay(hand[i])) { V.playCard(S.currentPlayer, i); return; }
  }

  Object.assign(V, { aiTurn });

})();
