/* Bezique: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.bezique;
  const S = V.S;
  const { CANVAS_W, BRISQUE_POINTS, SUIT_SYMBOLS, PHASE_PLAY } = V;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const BEZIQUE_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_ORDER = { '7': 0, '8': 1, '9': 2, 'J': 3, 'Q': 4, 'K': 5, '10': 6, 'A': 7 };

  function assignCardId(card) {
    if (card._bezId == null)
      card._bezId = ++S.cardIdCounter;
    return card._bezId;
  }

  function cardId(card) {
    return card._bezId || 0;
  }

  function isCardUsedForMeldType(who, card, meldType) {
    const used = who === 0 ? S.playerMeldsUsed : S.aiMeldsUsed;
    const id = cardId(card);
    return used[id] && used[id].has(meldType);
  }

  function markCardUsedForMeldType(who, card, meldType) {
    const used = who === 0 ? S.playerMeldsUsed : S.aiMeldsUsed;
    const id = cardId(card);
    if (!used[id]) used[id] = new Set();
    used[id].add(meldType);
  }

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
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

  function countInHand(hand, rank, suit) {
    return hand.filter(c => c.rank === rank && c.suit === suit).length;
  }

  function isStockOpen() {
    return S.stock.length > 0 || (S.trumpCard != null && S.stock.length === 0);
  }

  function isPhase2() {
    return S.stock.length === 0 && S.trumpCard == null;
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

  /* ================================================================
     PHASE 2 VALIDITY (must follow suit, must win if possible)
     ================================================================ */

  function getValidIndicesPhase2(hand) {
    if (S.trickCards.length === 0) {
      const indices = [];
      for (let i = 0; i < hand.length; ++i)
        indices.push(i);
      return indices;
    }

    const leadSuit = S.trickCards[0].suit;
    const leadStr = cardStrength(S.trickCards[0]);
    const leadIsTrump = isTrump(S.trickCards[0]);

    const suitCards = [];
    const higherSuitCards = [];
    const trumpCards = [];
    const higherTrumpCards = [];

    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      if (c.suit === leadSuit) {
        suitCards.push(i);
        if (cardStrength(c) > leadStr) higherSuitCards.push(i);
      } else if (isTrump(c)) {
        trumpCards.push(i);
        if (leadIsTrump && cardStrength(c) > leadStr) higherTrumpCards.push(i);
      }
    }

    // Must follow suit
    if (suitCards.length > 0) {
      // Must win if possible: play higher card of lead suit
      if (higherSuitCards.length > 0) return higherSuitCards;
      return suitCards;
    }

    // Cannot follow suit: must trump
    if (trumpCards.length > 0) {
      // Must overtrump if lead is also trump
      if (leadIsTrump && higherTrumpCards.length > 0) return higherTrumpCards;
      return trumpCards;
    }

    // No suit, no trump: play anything
    const all = [];
    for (let i = 0; i < hand.length; ++i) all.push(i);
    return all;
  }

  function isValidPlayPhase2(cardIdx, hand) {
    const valid = getValidIndicesPhase2(hand);
    return valid.includes(cardIdx);
  }

  /* ================================================================
     MELD SYSTEM
     ================================================================ */

  /* Meld types:
     'marriage-{suit}' : K+Q same suit (20, 40 if trump)
     'bezique'         : Q spades + J diamonds (40, double=500)
     'sequence'        : A-10-K-Q-J of trump (250)
     'four-A'          : 4 Aces (100)
     'four-K'          : 4 Kings (80)
     'four-Q'          : 4 Queens (60)
     'four-J'          : 4 Jacks (40)
     'trump7'          : 7 of trump swap (10)
  */

  function getAvailableMelds(who) {
    const hand = who === 0 ? S.playerHand : S.aiHand;
    const melds = [];

    // Marriages: K+Q same suit
    for (const suit of CE.SUITS) {
      const meldType = 'marriage-' + suit;
      const kings = hand.filter(c => c.rank === 'K' && c.suit === suit && !isCardUsedForMeldType(who, c, meldType));
      const queens = hand.filter(c => c.rank === 'Q' && c.suit === suit && !isCardUsedForMeldType(who, c, meldType));
      if (kings.length > 0 && queens.length > 0) {
        const pts = suit === S.trumpSuit ? 40 : 20;
        const name = suit === S.trumpSuit ? 'Royal Marriage' : 'Marriage';
        melds.push({
          type: meldType,
          name: name + ' (' + SUIT_SYMBOLS[suit] + ')',
          points: pts,
          cards: [kings[0], queens[0]]
        });
      }
    }

    // Bezique: Q spades + J diamonds
    const qSpades = hand.filter(c => c.rank === 'Q' && c.suit === 'spades' && !isCardUsedForMeldType(who, c, 'bezique'));
    const jDiamonds = hand.filter(c => c.rank === 'J' && c.suit === 'diamonds' && !isCardUsedForMeldType(who, c, 'bezique'));
    if (qSpades.length >= 2 && jDiamonds.length >= 2) {
      melds.push({
        type: 'bezique',
        name: 'Double Bezique!',
        points: 500,
        cards: [qSpades[0], qSpades[1], jDiamonds[0], jDiamonds[1]]
      });
    } else if (qSpades.length >= 1 && jDiamonds.length >= 1) {
      melds.push({
        type: 'bezique',
        name: 'Bezique',
        points: 40,
        cards: [qSpades[0], jDiamonds[0]]
      });
    }

    // Sequence in trump: A-10-K-Q-J of trump
    {
      const meldType = 'sequence';
      const needed = ['A', '10', 'K', 'Q', 'J'];
      const seqCards = [];
      let canDeclare = true;
      for (const rank of needed) {
        const card = hand.find(c => c.rank === rank && c.suit === S.trumpSuit && !isCardUsedForMeldType(who, c, meldType));
        if (card)
          seqCards.push(card);
        else
          canDeclare = false;
      }
      if (canDeclare) {
        melds.push({
          type: meldType,
          name: 'Trump Sequence (' + SUIT_SYMBOLS[S.trumpSuit] + ')',
          points: 250,
          cards: seqCards
        });
      }
    }

    // Four of a kind
    const fourKinds = [
      { rank: 'A', name: 'Four Aces', points: 100 },
      { rank: 'K', name: 'Four Kings', points: 80 },
      { rank: 'Q', name: 'Four Queens', points: 60 },
      { rank: 'J', name: 'Four Jacks', points: 40 }
    ];
    for (const { rank, name, points } of fourKinds) {
      const meldType = 'four-' + rank;
      const candidates = hand.filter(c => c.rank === rank && !isCardUsedForMeldType(who, c, meldType));
      const suits = new Set(candidates.map(c => c.suit));
      if (suits.size === 4) {
        const picked = [];
        for (const suit of CE.SUITS) {
          const card = candidates.find(c => c.suit === suit);
          if (card) picked.push(card);
        }
        melds.push({
          type: meldType,
          name,
          points,
          cards: picked
        });
      }
    }

    // 7 of trump swap
    if (!S.trumpSwapped[who] && S.trumpCard != null && S.stock.length > 0) {
      const seven = hand.find(c => c.rank === '7' && c.suit === S.trumpSuit);
      if (seven) {
        melds.push({
          type: 'trump7',
          name: 'Trump Seven Swap',
          points: 10,
          cards: [seven]
        });
      }
    }

    return melds;
  }

  function declareMeld(who, meld) {
    for (const card of meld.cards)
      markCardUsedForMeldType(who, card, meld.type);

    if (who === 0) {
      S.playerMeldScore += meld.points;
      S.playerMeldCards.push({ name: meld.name, points: meld.points });
    } else {
      S.aiMeldScore += meld.points;
      S.aiMeldCards.push({ name: meld.name, points: meld.points });
    }

    // Handle trump 7 swap
    if (meld.type === 'trump7') {
      const hand = who === 0 ? S.playerHand : S.aiHand;
      const sevenIdx = hand.findIndex(c => c.rank === '7' && c.suit === S.trumpSuit);
      if (sevenIdx >= 0 && S.trumpCard) {
        const seven = hand.splice(sevenIdx, 1)[0];
        const oldTrump = S.trumpCard;
        oldTrump.faceUp = true;
        assignCardId(oldTrump);
        hand.push(oldTrump);
        S.trumpCard = seven;
        S.trumpCard.faceUp = true;
        S.trumpSwapped[who] = true;
        sortHand(hand);
      }
    }

    if (S._host) {
      const label = (who === 0 ? 'You: ' : 'AI: ') + meld.name + ' +' + meld.points;
      const color = who === 0 ? '#4f4' : '#fa0';
      S._host.floatingText.add(CANVAS_W / 2, 260, label, { color, size: 16 });
    }
  }

  /* ================================================================
     BRISQUE COUNTING
     ================================================================ */

  function countBrisques(captured) {
    let pts = 0;
    for (const c of captured)
      pts += (BRISQUE_POINTS[c.rank] || 0);
    return pts;
  }

  /* ================================================================
     HINT LOGIC
     ================================================================ */

  function getHintIndices() {
    if (S.phase !== PHASE_PLAY || S.currentTurn !== 0) return [];
    if (isPhase2())
      return getValidIndicesPhase2(S.playerHand);
    // Phase 1: any card is playable
    const all = [];
    for (let i = 0; i < S.playerHand.length; ++i) all.push(i);
    return all;
  }

  function canBeatCard(card, leadCard) {
    if (isTrump(card) && !isTrump(leadCard)) return true;
    if (card.suit === leadCard.suit && cardStrength(card) > cardStrength(leadCard)) return true;
    if (isTrump(card) && isTrump(leadCard) && cardStrength(card) > cardStrength(leadCard)) return true;
    return false;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function createBeziqueDeck() {
    const half1 = CE.createDeckFromRanks(CE.SUITS, BEZIQUE_RANKS);
    const half2 = CE.createDeckFromRanks(CE.SUITS, BEZIQUE_RANKS);
    const deck = half1.concat(half2);
    for (const c of deck)
      assignCardId(c);
    return deck;
  }

  V.assignCardId = assignCardId;
  V.cardId = cardId;
  V.cardStrength = cardStrength;
  V.isTrump = isTrump;
  V.sortHand = sortHand;
  V.isPhase2 = isPhase2;
  V.resolveTrickWinner = resolveTrickWinner;
  V.getValidIndicesPhase2 = getValidIndicesPhase2;
  V.isValidPlayPhase2 = isValidPlayPhase2;
  V.getAvailableMelds = getAvailableMelds;
  V.declareMeld = declareMeld;
  V.countBrisques = countBrisques;
  V.getHintIndices = getHintIndices;
  V.canBeatCard = canBeatCard;
  V.createBeziqueDeck = createBeziqueDeck;

})();
