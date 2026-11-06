/* Shedding games: hand sorting and draw-pile helpers shared by the Uno-style
   variants and the suit-based shedding games (Crazy Eights, Mau-Mau). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};
  const CE = SZ.CardEngine;

  /* colour cards: by colour, then number/action/wild, then value */
  function sortColorHand(hand) {
    const co = { red: 0, blue: 1, green: 2, yellow: 3, wild: 4 };
    const to = { number: 0, action: 1, wild: 2 };
    hand.sort((a, b) => {
      const cd = (co[a.color] ?? 4) - (co[b.color] ?? 4);
      if (cd !== 0) return cd;
      const td = (to[a.type] ?? 2) - (to[b.type] ?? 2);
      if (td !== 0) return td;
      const av = parseInt(a.value) || 0, bv = parseInt(b.value) || 0;
      return av - bv || String(a.value).localeCompare(String(b.value));
    });
  }

  /* French cards: by suit, then value */
  function sortSuitHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return a.value - b.value;
    });
  }

  /* S is the variant state holding deck, discardPile and hands */
  function refillDeck(S) {
    if (S.deck.length > 0) return;
    if (S.discardPile.length <= 1) return;
    const top = S.discardPile.pop();
    S.deck = CE.shuffle(S.discardPile);
    S.discardPile = [top];
  }

  function drawCards(S, playerIndex, count) {
    for (let i = 0; i < count; ++i) {
      refillDeck(S);
      if (S.deck.length > 0)
        S.hands[playerIndex].push(S.deck.pop());
    }
  }

  SZ.CardGames.shared.sheddingHand = { sortColorHand, sortSuitHand, refillDeck, drawCards };

})();
