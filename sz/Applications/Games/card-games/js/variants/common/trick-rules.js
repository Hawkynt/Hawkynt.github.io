/* Trick-taking family - suit and rank tables plus the follow-suit, valid-play and
   trump-trick helpers shared by Skat, Hearts, Spades, Euchre, Pinochle, Bridge,
   Oh Hell, Whist, Pitch and Sixty-Six. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};

  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };

  /* ace-high rank values 2..14 */
  const RANK_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

  /* ace-high ranks, strength = index */
  const STRENGTH_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

  function getCardsOfSuit(hand, suit) {
    return hand.filter(c => c.suit === suit);
  }

  /* must follow the led suit when holding it, anything goes otherwise */
  function followsSuit(card, hand, trickCards) {
    if (trickCards.length === 0) return true;
    const leadSuit = trickCards[0].suit;
    if (hasSuit(hand, leadSuit))
      return card.suit === leadSuit;
    return true;
  }

  /* indices of the cards isValidPlay accepts; the whole hand when none is */
  function validIndices(hand, isValidPlay) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand))
        valid.push(i);
    if (valid.length === 0)
      for (let i = 0; i < hand.length; ++i) valid.push(i);
    return valid;
  }

  /* highest trump wins, else the highest card of the led suit; returns the player */
  function trumpTrickWinner(trickCards, trickPlayers, cardStrength, isTrump) {
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(trickCards[0]);
    let bestIsTrump = isTrump(trickCards[0]);

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const cTrump = isTrump(c);
      const cStr = cardStrength(c);

      if (bestIsTrump) {
        if (cTrump && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      } else {
        if (cTrump) {
          bestIdx = i;
          bestStr = cStr;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      }
    }
    return trickPlayers[bestIdx];
  }

  SZ.CardGames.shared.trickRules = {
    SUIT_NAMES, SUIT_SYMBOLS, RANK_ORDER, STRENGTH_ORDER,
    hasSuit, getCardsOfSuit, followsSuit, validIndices, trumpTrickWinner
  };

})();
