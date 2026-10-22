/* The deck builder: opening and closing the builder screen and adding or
   removing cards from the 30-card selection. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;

  function toggleDeckBuilder() {
    SZ.GameAudio.play('click');
    if (S.state === C.STATE_DECK_BUILD) {
      S.state = C.STATE_MENU;
    } else {
      S.state = C.STATE_DECK_BUILD;
      if (S.selectedDeck.length === 0)
        S.selectedDeck = T.ALL_CARDS.slice(0, C.DECK_SIZE).map(c => c.id);
    }
  }

  function addCardToDeck(cardId) {
    if (S.selectedDeck.length >= C.DECK_SIZE) {
      SZ.GameAudio.play('error', { volume: 0.6 });
      return;
    }
    S.selectedDeck.push(cardId);
    SZ.GameAudio.play('drop', { pitch: 1.3, volume: 0.7 });
  }

  function removeCardFromDeck(index) {
    S.selectedDeck.splice(index, 1);
    SZ.GameAudio.play('click', { pitch: 0.8 });
  }

  Object.assign(NS.deckbuilder, { toggleDeckBuilder, addCardToDeck, removeCardFromDeck });
})();
