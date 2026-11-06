/* Uno Party: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['unoparty'];
  const S = V.S;
  const { UNO_COLORS } = V;
  const SH = SZ.CardGames.shared.sheddingHand;

  function aiChooseColor() {
    const hand = S.hands[S.currentPlayer];
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
    for (const c of hand)
      if (c.color !== 'wild' && counts[c.color] !== undefined) ++counts[c.color];
    let best = 'red', bestN = -1;
    for (const c of UNO_COLORS)
      if (counts[c] > bestN) { bestN = counts[c]; best = c; }
    return best;
  }

  function aiTurn() {
    if (S.roundOver || S.gameOver) return;
    const hand = S.hands[S.currentPlayer];

    // Prefer non-wild playable
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].type !== 'party' && V.canPlay(hand[i])) {
        V.playCard(S.currentPlayer, i);
        return;
      }
    // Play party wilds
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].type === 'party' && V.canPlay(hand[i])) {
        V.playCard(S.currentPlayer, i, aiChooseColor());
        return;
      }

    // Draw
    SH.refillDeck(S);
    if (S.deck.length > 0) {
      const drawn = S.deck.pop();
      hand.push(drawn);
      if (V.canPlay(drawn)) {
        const ci = hand.length - 1;
        if (drawn.type === 'party')
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
