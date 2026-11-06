/* Dos: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['dos'];
  const S = V.S;

  function aiCanPlay(playerIndex) {
    const hand = S.hands[playerIndex];
    for (let p = 0; p < 2; ++p) {
      if (!S.centerPiles[p]) continue;
      for (let i = 0; i < hand.length; ++i)
        if (V.canMatchSingle(hand[i], S.centerPiles[p])) return true;
      for (let i = 0; i < hand.length; ++i)
        for (let j = i + 1; j < hand.length; ++j)
          if (V.canMatchDouble(hand[i], hand[j], S.centerPiles[p])) return true;
    }
    return false;
  }

  function aiTurn() {
    if (S.roundOver || S.gameOver) return;
    const hand = S.hands[S.currentPlayer];

    // Try double matches first (shed 2 cards)
    for (let p = 0; p < 2; ++p) {
      if (!S.centerPiles[p]) continue;
      for (let i = 0; i < hand.length; ++i)
        for (let j = i + 1; j < hand.length; ++j)
          if (V.canMatchDouble(hand[i], hand[j], S.centerPiles[p])) {
            V.doPlay(S.currentPlayer, [j, i], p);
            return;
          }
    }

    // Try single matches (prefer color match)
    for (let p = 0; p < 2; ++p) {
      if (!S.centerPiles[p]) continue;
      for (let i = 0; i < hand.length; ++i)
        if (V.canMatchSingle(hand[i], S.centerPiles[p]) && V.isColorMatch(hand[i], S.centerPiles[p])) {
          V.doPlay(S.currentPlayer, [i], p);
          return;
        }
    }
    for (let p = 0; p < 2; ++p) {
      if (!S.centerPiles[p]) continue;
      for (let i = 0; i < hand.length; ++i)
        if (V.canMatchSingle(hand[i], S.centerPiles[p])) {
          V.doPlay(S.currentPlayer, [i], p);
          return;
        }
    }

    // Draw
    V.drawFromDeck(S.currentPlayer);
  }

  Object.assign(V, { aiTurn });

})();
