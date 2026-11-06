/* Skat - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.skat;
  const S = V.S;
  const { SKAT_RANKS } = V;

  /* ================================================================
     SKAT RULES
     ================================================================ */

  function isTrump(card) {
    return card.rank === 'J' || card.suit === S.trumpSuit;
  }

  function effectiveSuit(card) {
    return card.rank === 'J' ? 'trump' : (card.suit === S.trumpSuit ? 'trump' : card.suit);
  }

  function skatIsValid(card, leadSuit, hand) {
    if (!leadSuit) return true;
    const efl = leadSuit;
    const hasSuit = hand.some(c => effectiveSuit(c) === efl);
    if (!hasSuit) return true;
    return effectiveSuit(card) === efl;
  }

  function cardStrength(card) {
    if (card.rank === 'J') {
      const jOrder = ['diamonds', 'hearts', 'spades', 'clubs'];
      return 100 + jOrder.indexOf(card.suit);
    }
    if (card.suit === S.trumpSuit)
      return 50 + SKAT_RANKS.indexOf(card.rank);
    return SKAT_RANKS.indexOf(card.rank);
  }

  function trickWinner(cards, players) {
    const leadEff = effectiveSuit(cards[0]);
    let best = 0;
    for (let i = 1; i < cards.length; ++i) {
      const eff = effectiveSuit(cards[i]);
      if (eff === 'trump' && effectiveSuit(cards[best]) !== 'trump')
        best = i;
      else if (eff === effectiveSuit(cards[best]) && cardStrength(cards[i]) > cardStrength(cards[best]))
        best = i;
    }
    return players[best];
  }

  Object.assign(V, {
    effectiveSuit, skatIsValid, cardStrength, trickWinner
  });

})();
