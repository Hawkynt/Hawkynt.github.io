/* Deck and hand management: the preset deck and drawing with its draw
   animation. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;
  const U = NS.util;

  function buildDefaultDeck() {
    const deck = [];
    const picks = T.ALL_CARDS.slice(0, C.DECK_SIZE);
    for (const card of picks)
      deck.push({ ...card });
    return deck;
  }

  function drawFromDeck(deck, hand, discard) {
    if (deck.length === 0 && discard.length > 0) {
      // Reshuffle discard into deck when empty
      while (discard.length > 0)
        deck.push(discard.pop());
      U.shuffle(deck);
    }
    if (deck.length === 0 || hand.length >= C.HAND_LIMIT)
      return null;
    const card = deck.pop();
    hand.push(card);

    // Card draw animation
    const targetX = U.getCardX(hand.length - 1, hand.length);
    const targetY = S.isPlayerTurn ? 420 : -80;
    S.cardAnimations.push({
      card,
      fromX: C.CANVAS_W / 2, fromY: 0,
      toX: targetX, toY: S.isPlayerTurn ? 420 : 100,
      t: 0, duration: 0.4,
      type: 'drawAnim'
    });

    return card;
  }

  Object.assign(NS.deck, { buildDefaultDeck, drawFromDeck });
})();
