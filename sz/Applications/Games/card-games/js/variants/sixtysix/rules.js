/* Sixty-Six - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.sixtysix;
  const S = V.S;
  const { CANVAS_W, TARGET_POINTS } = V;

  /* Trick-taking strength (high to low): A, 10, K, Q, J, 9 */
  const RANK_STRENGTH = { 'A': 6, '10': 5, 'K': 4, 'Q': 3, 'J': 2, '9': 1 };

  /* Point values */
  const RANK_POINTS = { 'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0 };

  /* Marriage values */
  const MARRIAGE_NORMAL = 20;
  const MARRIAGE_TRUMP = 40;

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardStrength(card) {
    return RANK_STRENGTH[card.rank] || 0;
  }

  function cardPoints(card) {
    return RANK_POINTS[card.rank] || 0;
  }

  function isTrump(card) {
    return card.suit === S.trumpSuit;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      if (a.suit === S.trumpSuit && b.suit !== S.trumpSuit) return 1;
      if (b.suit === S.trumpSuit && a.suit !== S.trumpSuit) return -1;
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  function isStockOpen() {
    return S.stock.length > 0 && !S.stockClosed;
  }

  function isStrictPlay() {
    return !isStockOpen();
  }

  /* ================================================================
     MARRIAGE DETECTION
     ================================================================ */

  function findMarriages(hand) {
    const marriages = [];
    for (const suit of CE.SUITS) {
      const hasK = hand.some(c => c.rank === 'K' && c.suit === suit);
      const hasQ = hand.some(c => c.rank === 'Q' && c.suit === suit);
      if (hasK && hasQ)
        marriages.push(suit);
    }
    return marriages;
  }

  function marriageValue(suit) {
    return suit === S.trumpSuit ? MARRIAGE_TRUMP : MARRIAGE_NORMAL;
  }

  /* ================================================================
     LEGAL MOVES (Phase 2 / closed stock)
     ================================================================ */

  function getLegalCards(hand, leadCard) {
    if (!leadCard) return hand.map((_, i) => i);

    /* Phase 1 (stock open): any card is legal */
    if (isStockOpen())
      return hand.map((_, i) => i);

    /* Phase 2 / closed: must follow suit, must head the trick, must trump if void */
    const leadSuit = leadCard.suit;
    const leadStr = cardStrength(leadCard);

    /* Cards of the led suit */
    const sameSuit = [];
    const sameSuitHigher = [];
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].suit === leadSuit) {
        sameSuit.push(i);
        if (cardStrength(hand[i]) > leadStr)
          sameSuitHigher.push(i);
      }
    }

    /* Must follow suit and play higher if possible */
    if (sameSuitHigher.length > 0) return sameSuitHigher;
    if (sameSuit.length > 0) return sameSuit;

    /* Void in led suit: must trump if possible */
    const trumpCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (isTrump(hand[i]))
        trumpCards.push(i);

    if (trumpCards.length > 0) return trumpCards;

    /* No suit, no trump: any card */
    return hand.map((_, i) => i);
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    if (S.trickCards.length < 2) return -1;
    const leadCard = S.trickCards[0];
    const followCard = S.trickCards[1];
    const leadSuit = leadCard.suit;

    if (isTrump(followCard) && !isTrump(leadCard))
      return S.trickPlayers[1];

    if (isTrump(leadCard) && !isTrump(followCard))
      return S.trickPlayers[0];

    if (followCard.suit === leadSuit)
      return cardStrength(followCard) > cardStrength(leadCard) ? S.trickPlayers[1] : S.trickPlayers[0];

    if (isTrump(leadCard) && isTrump(followCard))
      return cardStrength(followCard) > cardStrength(leadCard) ? S.trickPlayers[1] : S.trickPlayers[0];

    return S.trickPlayers[0];
  }

  function trickPointValue() {
    let pts = 0;
    for (const c of S.trickCards)
      pts += cardPoints(c);
    return pts;
  }

  /* ================================================================
     HINT LOGIC
     ================================================================ */

  function getHintIndices() {
    if (S.trickCards.length === 0) {
      /* Leading: all cards are playable */
      return S.playerHand.map((_, i) => i);
    }
    return getLegalCards(S.playerHand, S.trickCards[0]);
  }

  function canBeatLeadWith(card, leadCard) {
    if (isTrump(card) && !isTrump(leadCard)) return true;
    if (card.suit === leadCard.suit && cardStrength(card) > cardStrength(leadCard)) return true;
    if (isTrump(card) && isTrump(leadCard) && cardStrength(card) > cardStrength(leadCard)) return true;
    return false;
  }

  /* ================================================================
     MARRIAGE MANAGEMENT
     ================================================================ */

  function checkPlayerMarriage() {
    if (S.currentTurn !== 0 || S.trickCards.length > 0) {
      S.marriagePending = false;
      S.marriageSuit = '';
      return;
    }
    const marriages = findMarriages(S.playerHand);
    if (marriages.length > 0) {
      S.marriagePending = true;
      /* Prefer trump marriage */
      S.marriageSuit = marriages.includes(S.trumpSuit) ? S.trumpSuit : marriages[0];
    } else {
      S.marriagePending = false;
      S.marriageSuit = '';
    }
  }

  function declareMarriage(who, suit) {
    const pts = marriageValue(suit);
    if (who === 0) {
      S.playerTrickPoints += pts;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 350, 'Marriage! +' + pts, { color: '#ff0', size: 20 });
    } else {
      S.aiTrickPoints += pts;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, 'AI Marriage! +' + pts, { color: '#fa0', size: 20 });
    }
    S.marriageShownTimer = 2.0;
    S.marriageShownSuit = suit;
    S.marriageShownBy = who;

    /* Check if declaring player reached 66 */
    checkReach66(who);
  }

  function checkReach66(who) {
    const pts = who === 0 ? S.playerTrickPoints : S.aiTrickPoints;
    if (pts >= TARGET_POINTS) {
      /* Immediate win declaration -- end the round */
      V.endRound(who);
    }
  }

  function closeStock(who) {
    if (S.stockClosed || S.stock.length === 0) return;
    S.stockClosed = true;
    S.closedBy = who;
    S.stockClosedPointsAtClose = [S.playerTrickPoints, S.aiTrickPoints];
    if (S.trumpCard) S.trumpCard.faceUp = false;

    if (S._host) {
      const label = who === 0 ? 'You closed' : 'AI closed';
      S._host.floatingText.add(CANVAS_W / 2, 260, label + ' the stock!', { color: '#ff8', size: 18 });
    }
  }

  function trickCardPos(who) {
    if (who === 0)
      return { x: CANVAS_W / 2 - CE.CARD_W / 2 + 20, y: 310 };
    return { x: CANVAS_W / 2 - CE.CARD_W / 2 - 20, y: 210 };
  }

  Object.assign(V, {
    cardStrength, cardPoints, isTrump, sortHand, isStockOpen, isStrictPlay,
    findMarriages, marriageValue, getLegalCards, resolveTrickWinner,
    trickPointValue, getHintIndices, canBeatLeadWith, checkPlayerMarriage,
    declareMarriage, closeStock, trickCardPos
  });

})();
