/* European card games: pure card helpers shared by several variants of the family
   (hand sorting by engine suit order, suit lookup). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};
  const CE = SZ.CardEngine;

  /* Sorts a hand in place: engine suit order first, then card value. */
  function sortBySuit(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return a.value - b.value;
    });
  }

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

  SZ.CardGames.shared.euroCards = { sortBySuit, hasSuit };

})();
