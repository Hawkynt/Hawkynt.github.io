/* Uno Flip: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['unoflip'];
  const S = V.S;
  const { DARK_COLORS, LIGHT_COLORS } = V;
  const SH = SZ.CardGames.shared.sheddingHand;

  function aiChooseColor() {
    const hand = S.hands[S.currentPlayer];
    const counts = {};
    const palette = S.activeSide === 'light' ? LIGHT_COLORS : DARK_COLORS;
    for (const c of palette) counts[c] = 0;
    for (const card of hand) {
      const col = V.getColor(card);
      if (col !== 'wild' && counts[col] !== undefined) ++counts[col];
    }
    let best = palette[0], bestN = -1;
    for (const c of palette)
      if (counts[c] > bestN) { bestN = counts[c]; best = c; }
    return best;
  }

  function aiTurn() {
    if (S.roundOver || S.gameOver) return;
    const hand = S.hands[S.currentPlayer];

    // If must draw (pending draw, can't stack)
    if (S.drawPending > 0) {
      for (let i = 0; i < hand.length; ++i) {
        const v = V.getValue(hand[i]);
        if (v === 'Draw One' || v === 'Draw Five' || v === 'Wild Draw Two' || v === 'Wild Draw Color') {
          V.playCard(S.currentPlayer, i, aiChooseColor());
          return;
        }
      }
      // Shouldn't reach here due to auto-resolve, but safety
      SH.drawCards(S, S.currentPlayer, S.drawPending);
      S.drawPending = 0;
      V.nextPlayer();
      return;
    }

    // Prefer color/value matches
    for (let i = 0; i < hand.length; ++i) {
      if (V.getType(hand[i]) !== 'wild' && V.canPlay(hand[i])) {
        V.playCard(S.currentPlayer, i);
        return;
      }
    }

    // Play wilds
    for (let i = 0; i < hand.length; ++i) {
      if (V.getType(hand[i]) === 'wild' && V.canPlay(hand[i])) {
        V.playCard(S.currentPlayer, i, aiChooseColor());
        return;
      }
    }

    // Draw
    SH.refillDeck(S);
    if (S.deck.length > 0) {
      const drawn = S.deck.pop();
      hand.push(drawn);
      if (V.canPlay(drawn)) {
        const ci = hand.length - 1;
        if (V.getType(drawn) === 'wild')
          V.playCard(S.currentPlayer, ci, aiChooseColor());
        else
          V.playCard(S.currentPlayer, ci);
      } else
        V.nextPlayer();
    } else
      V.nextPlayer();
  }

  Object.assign(V, { aiTurn });

})();
