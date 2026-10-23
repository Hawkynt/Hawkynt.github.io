;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const BEZIQUE_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_ORDER = { '7': 0, '8': 1, '9': 2, 'J': 3, 'Q': 4, 'K': 5, '10': 6, 'A': 7 };
  const BRISQUE_POINTS = { 'A': 10, '10': 10 };

  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

  const HAND_SIZE = 8;
  const GAME_WIN_SCORE = 1000;

  /* Phases */
  const PHASE_PLAY = 0;
  const PHASE_TRICK_DONE = 1;
  const PHASE_MELD_SELECT = 2;
  const PHASE_ROUND_OVER = 3;

  const TRICK_DONE_DELAY = 1.2;
  const AI_TURN_DELAY = 0.8;
  const MELD_DISPLAY_DELAY = 2.0;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let stock = [];
  let trumpCard = null;
  let trumpSuit = '';

  let trickCards = [];
  let trickPlayers = [];
  let playerCaptured = [];
  let aiCaptured = [];
  let playerMeldScore = 0;
  let aiMeldScore = 0;
  let trickCount = 0;

  let currentTurn = 0;
  let trickLeader = 0;
  let phase = PHASE_PLAY;
  let trickWinner = -1;
  let trickDoneTimer = 0;

  let playerTotalScore = 0;
  let aiTotalScore = 0;
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let dealNumber = 0;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  let hoverCardIdx = -1;

  /* Meld tracking: each card can be used in each meld TYPE once.
     We track by card identity (suit+rank+copy index).
     playerMeldsUsed[cardId] = Set of meld type keys used.
     A card can participate in different meld types but not the same type twice. */
  let playerMeldsUsed = {};  // cardId -> Set<meldType>
  let aiMeldsUsed = {};

  /* Cards on the table for melding (face-up, still in hand) */
  let playerMeldCards = [];  // array of {cards, name, points} declared
  let aiMeldCards = [];

  /* Pending melds after winning a trick */
  let pendingMeldOptions = [];
  let meldDisplayTimer = 0;
  let lastMeldMsg = '';

  /* Trump 7 swap */
  let trumpSwapped = [false, false]; // player, ai

  /* ================================================================
     CARD IDENTITY & MELD TRACKING
     ================================================================ */

  let cardIdCounter = 0;

  function assignCardId(card) {
    if (card._bezId == null)
      card._bezId = ++cardIdCounter;
    return card._bezId;
  }

  function cardId(card) {
    return card._bezId || 0;
  }

  function isCardUsedForMeldType(who, card, meldType) {
    const used = who === 0 ? playerMeldsUsed : aiMeldsUsed;
    const id = cardId(card);
    return used[id] && used[id].has(meldType);
  }

  function markCardUsedForMeldType(who, card, meldType) {
    const used = who === 0 ? playerMeldsUsed : aiMeldsUsed;
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
    return card.suit === trumpSuit;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      if (a.suit === trumpSuit && b.suit !== trumpSuit) return 1;
      if (b.suit === trumpSuit && a.suit !== trumpSuit) return -1;
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

  function countInHand(hand, rank, suit) {
    return hand.filter(c => c.rank === rank && c.suit === suit).length;
  }

  function isStockOpen() {
    return stock.length > 0 || (trumpCard != null && stock.length === 0);
  }

  function isPhase2() {
    return stock.length === 0 && trumpCard == null;
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    if (trickCards.length < 2) return -1;
    const leadCard = trickCards[0];
    const followCard = trickCards[1];
    const leadSuit = leadCard.suit;

    if (isTrump(followCard) && !isTrump(leadCard))
      return trickPlayers[1];
    if (isTrump(leadCard) && !isTrump(followCard))
      return trickPlayers[0];
    if (followCard.suit === leadSuit)
      return cardStrength(followCard) > cardStrength(leadCard) ? trickPlayers[1] : trickPlayers[0];
    if (isTrump(leadCard) && isTrump(followCard))
      return cardStrength(followCard) > cardStrength(leadCard) ? trickPlayers[1] : trickPlayers[0];

    return trickPlayers[0];
  }

  /* ================================================================
     PHASE 2 VALIDITY (must follow suit, must win if possible)
     ================================================================ */

  function getValidIndicesPhase2(hand) {
    if (trickCards.length === 0) {
      const indices = [];
      for (let i = 0; i < hand.length; ++i)
        indices.push(i);
      return indices;
    }

    const leadSuit = trickCards[0].suit;
    const leadStr = cardStrength(trickCards[0]);
    const leadIsTrump = isTrump(trickCards[0]);

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
    const hand = who === 0 ? playerHand : aiHand;
    const melds = [];

    // Marriages: K+Q same suit
    for (const suit of CE.SUITS) {
      const meldType = 'marriage-' + suit;
      const kings = hand.filter(c => c.rank === 'K' && c.suit === suit && !isCardUsedForMeldType(who, c, meldType));
      const queens = hand.filter(c => c.rank === 'Q' && c.suit === suit && !isCardUsedForMeldType(who, c, meldType));
      if (kings.length > 0 && queens.length > 0) {
        const pts = suit === trumpSuit ? 40 : 20;
        const name = suit === trumpSuit ? 'Royal Marriage' : 'Marriage';
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
        const card = hand.find(c => c.rank === rank && c.suit === trumpSuit && !isCardUsedForMeldType(who, c, meldType));
        if (card)
          seqCards.push(card);
        else
          canDeclare = false;
      }
      if (canDeclare) {
        melds.push({
          type: meldType,
          name: 'Trump Sequence (' + SUIT_SYMBOLS[trumpSuit] + ')',
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
    if (!trumpSwapped[who] && trumpCard != null && stock.length > 0) {
      const seven = hand.find(c => c.rank === '7' && c.suit === trumpSuit);
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
      playerMeldScore += meld.points;
      playerMeldCards.push({ name: meld.name, points: meld.points });
    } else {
      aiMeldScore += meld.points;
      aiMeldCards.push({ name: meld.name, points: meld.points });
    }

    // Handle trump 7 swap
    if (meld.type === 'trump7') {
      const hand = who === 0 ? playerHand : aiHand;
      const sevenIdx = hand.findIndex(c => c.rank === '7' && c.suit === trumpSuit);
      if (sevenIdx >= 0 && trumpCard) {
        const seven = hand.splice(sevenIdx, 1)[0];
        const oldTrump = trumpCard;
        oldTrump.faceUp = true;
        assignCardId(oldTrump);
        hand.push(oldTrump);
        trumpCard = seven;
        trumpCard.faceUp = true;
        trumpSwapped[who] = true;
        sortHand(hand);
      }
    }

    if (_host) {
      const label = (who === 0 ? 'You: ' : 'AI: ') + meld.name + ' +' + meld.points;
      const color = who === 0 ? '#4f4' : '#fa0';
      _host.floatingText.add(CANVAS_W / 2, 260, label, { color, size: 16 });
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
    if (phase !== PHASE_PLAY || currentTurn !== 0) return [];
    if (isPhase2())
      return getValidIndicesPhase2(playerHand);
    // Phase 1: any card is playable
    const all = [];
    for (let i = 0; i < playerHand.length; ++i) all.push(i);
    return all;
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChooseCard() {
    const hand = aiHand;
    if (hand.length === 0) return -1;
    if (hand.length === 1) return 0;

    const isLeading = trickCards.length === 0;
    const phase2 = isPhase2();

    if (phase2) {
      const valid = getValidIndicesPhase2(hand);
      if (valid.length === 1) return valid[0];

      if (isLeading) {
        // Lead with highest cards in phase 2 to win tricks
        valid.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        // Prefer leading trump aces/tens
        for (const i of valid)
          if (hand[i].rank === 'A' && isTrump(hand[i])) return i;
        for (const i of valid)
          if (hand[i].rank === '10' && isTrump(hand[i])) return i;
        return valid[0];
      }

      // Following in phase 2: must follow suit/win -- pick cheapest winner
      const leadCard = trickCards[0];
      let cheapestWinner = -1;
      let cheapestCost = 999;
      for (const i of valid) {
        const c = hand[i];
        const wouldWin = canBeatCard(c, leadCard);
        if (wouldWin) {
          const cost = cardStrength(c) + (isTrump(c) ? 50 : 0);
          if (cost < cheapestCost) {
            cheapestCost = cost;
            cheapestWinner = i;
          }
        }
      }
      if (cheapestWinner >= 0) return cheapestWinner;

      // Can't win: play lowest
      valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return valid[0];
    }

    // Phase 1: no obligation to follow suit
    if (isLeading) {
      // Check if we have melds to protect -- keep meld cards
      const melds = getAvailableMelds(1);
      const meldCardIds = new Set();
      for (const m of melds)
        for (const c of m.cards)
          meldCardIds.add(cardId(c));

      // Lead low non-meld, non-trump cards
      let bestIdx = 0;
      let bestScore = 999;
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        let val = cardStrength(c);
        if (isTrump(c)) val += 100;
        if (meldCardIds.has(cardId(c))) val += 200;
        if (BRISQUE_POINTS[c.rank]) val += 50;
        if (val < bestScore) {
          bestScore = val;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    // Following in phase 1: try to win valuable tricks
    const leadCard = trickCards[0];
    const leadPts = BRISQUE_POINTS[leadCard.rank] || 0;

    if (leadPts > 0) {
      // Trick has value: try to win cheaply
      let bestIdx = -1;
      let bestCost = 999;
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        if (!canBeatCard(c, leadCard)) continue;
        const cost = cardStrength(c) + (isTrump(c) ? 50 : 0);
        if (cost < bestCost) {
          bestCost = cost;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) return bestIdx;
    }

    // Dump lowest value card
    const melds = getAvailableMelds(1);
    const meldCardIds = new Set();
    for (const m of melds)
      for (const c of m.cards)
        meldCardIds.add(cardId(c));

    let lowestIdx = 0;
    let lowestVal = 999;
    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      let val = cardStrength(c);
      if (isTrump(c)) val += 100;
      if (meldCardIds.has(cardId(c))) val += 200;
      if (BRISQUE_POINTS[c.rank]) val += 30;
      if (val < lowestVal) {
        lowestVal = val;
        lowestIdx = i;
      }
    }
    return lowestIdx;
  }

  function canBeatCard(card, leadCard) {
    if (isTrump(card) && !isTrump(leadCard)) return true;
    if (card.suit === leadCard.suit && cardStrength(card) > cardStrength(leadCard)) return true;
    if (isTrump(card) && isTrump(leadCard) && cardStrength(card) > cardStrength(leadCard)) return true;
    return false;
  }

  function aiSelectMeld() {
    const melds = getAvailableMelds(1);
    if (melds.length === 0) return null;
    // Pick highest value meld
    melds.sort((a, b) => b.points - a.points);
    return melds[0];
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

  function dealRound() {
    cardIdCounter = 0;
    const d = CE.shuffle(createBeziqueDeck());
    stock = d;
    playerHand = [];
    aiHand = [];
    playerCaptured = [];
    aiCaptured = [];
    playerMeldScore = 0;
    aiMeldScore = 0;
    playerMeldsUsed = {};
    aiMeldsUsed = {};
    playerMeldCards = [];
    aiMeldCards = [];
    trumpSwapped = [false, false];
    trickCards = [];
    trickPlayers = [];
    trickCount = 0;
    trickWinner = -1;
    trickDoneTimer = 0;
    aiTurnTimer = 0;
    hoverCardIdx = -1;
    roundOver = false;
    pendingMeldOptions = [];
    meldDisplayTimer = 0;
    lastMeldMsg = '';
    phase = PHASE_PLAY;

    // Deal 8 cards each
    for (let i = 0; i < HAND_SIZE; ++i) {
      playerHand.push(stock.pop());
      aiHand.push(stock.pop());
    }

    // Flip trump indicator from stock
    trumpCard = stock.shift();
    trumpCard.faceUp = true;
    trumpSuit = trumpCard.suit;

    for (const c of playerHand) c.faceUp = true;
    sortHand(playerHand);
    sortHand(aiHand);

    // Non-dealer leads
    currentTurn = 0;
    trickLeader = 0;
    ++dealNumber;

    if (_host) {
      for (let i = 0; i < playerHand.length; ++i)
        _host.dealCardAnim(playerHand[i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, playerHand.length), playerCardY(), i * 0.08);
    }
  }

  function setupBezique() {
    roundOver = false;
    gameOver = false;
    dealNumber = 0;
    dealRound();
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(who, cardIdx) {
    const hand = who === 0 ? playerHand : aiHand;
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;

    trickCards.push(card);
    trickPlayers.push(who);

    if (trickCards.length >= 2) {
      phase = PHASE_TRICK_DONE;
      trickWinner = resolveTrickWinner();
      trickDoneTimer = 0;
      return;
    }

    currentTurn = 1 - currentTurn;
  }

  function finishTrick() {
    const winner = trickWinner;
    const captured = winner === 0 ? playerCaptured : aiCaptured;
    for (const c of trickCards)
      captured.push(c);

    ++trickCount;
    trickCards = [];
    trickPlayers = [];

    // Winner draws first from stock, then loser
    if (stock.length > 0) {
      const winnerHand = winner === 0 ? playerHand : aiHand;
      const loserHand = winner === 0 ? aiHand : playerHand;

      winnerHand.push(stock.pop());
      assignCardId(winnerHand[winnerHand.length - 1]);
      if (stock.length > 0) {
        loserHand.push(stock.pop());
        assignCardId(loserHand[loserHand.length - 1]);
      } else if (trumpCard) {
        // Last card: take the trump indicator
        loserHand.push(trumpCard);
        trumpCard = null;
      }

      for (const c of playerHand) c.faceUp = true;
      sortHand(playerHand);
      sortHand(aiHand);
    } else if (trumpCard) {
      // Stock just ran out, trump card goes to loser of this trick
      const loserHand = winner === 0 ? aiHand : playerHand;
      loserHand.push(trumpCard);
      if (winner !== 0) trumpCard.faceUp = true;
      trumpCard = null;
      sortHand(playerHand);
      sortHand(aiHand);
    }

    // Check if round is over
    if (playerHand.length === 0 && aiHand.length === 0) {
      endRound();
      return;
    }

    // Winner can declare melds (only in phase 1 with stock)
    if (!isPhase2()) {
      if (winner === 0) {
        const melds = getAvailableMelds(0);
        if (melds.length > 0) {
          pendingMeldOptions = melds;
          phase = PHASE_MELD_SELECT;
          currentTurn = 0;
          trickLeader = 0;
          trickWinner = -1;
          return;
        }
      } else {
        // AI declares meld
        const meld = aiSelectMeld();
        if (meld)
          declareMeld(1, meld);
      }
    }

    // Winner leads next trick
    currentTurn = winner;
    trickLeader = winner;
    trickWinner = -1;
    phase = PHASE_PLAY;
    aiTurnTimer = 0;
  }

  function endRound() {
    // Last trick winner gets 10 bonus points
    const lastWinner = trickWinner >= 0 ? trickWinner : trickLeader;

    // Count brisques (A and 10 in captured piles)
    const playerBrisques = countBrisques(playerCaptured);
    const aiBrisques = countBrisques(aiCaptured);

    // Last trick bonus
    const lastTrickBonus = 10;

    const playerRoundScore = playerMeldScore + playerBrisques + (lastWinner === 0 ? lastTrickBonus : 0);
    const aiRoundScore = aiMeldScore + aiBrisques + (lastWinner === 1 ? lastTrickBonus : 0);

    playerTotalScore += playerRoundScore;
    aiTotalScore += aiRoundScore;
    score = playerTotalScore;

    roundOver = true;
    phase = PHASE_ROUND_OVER;

    if (playerTotalScore >= GAME_WIN_SCORE || aiTotalScore >= GAME_WIN_SCORE) {
      gameOver = true;
      if (_host) {
        _host.onScoreChanged(score);
        if (playerTotalScore >= GAME_WIN_SCORE) {
          _host.floatingText.add(CANVAS_W / 2, 200, 'You win! (' + playerTotalScore + ' pts)', { color: '#4f4', size: 24 });
          _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
        } else {
          _host.floatingText.add(CANVAS_W / 2, 200, 'AI wins! (' + aiTotalScore + ' pts)', { color: '#f44', size: 24 });
        }
      }
    } else if (_host) {
      _host.onScoreChanged(score);
      _host.floatingText.add(CANVAS_W / 2, 200, 'Deal complete! You: +' + playerRoundScore + ' | AI: +' + aiRoundScore, { color: '#ff0', size: 16 });
    }
  }

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 480;
    const fanWidth = Math.min(maxWidth, total * 65);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 25;
  }

  function aiCardX(idx, total) {
    const maxWidth = 300;
    const fanWidth = Math.min(maxWidth, total * 40);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function aiCardY() {
    return 20;
  }

  const STOCK_X = 80;
  const STOCK_Y = 240;

  function trickCardPos(who) {
    if (who === 0)
      return { x: CANVAS_W / 2 - CE.CARD_W / 2 + 20, y: 310 };
    return { x: CANVAS_W / 2 - CE.CARD_W / 2 - 20, y: 210 };
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const total = playerHand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      const cy = playerCardY();
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawStock() {
    if (stock.length > 0 || trumpCard) {
      // Trump card shown sideways beneath the stock pile
      if (trumpCard && trumpCard.faceUp) {
        _ctx.save();
        _ctx.translate(STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
        _ctx.rotate(Math.PI / 2);
        CE.drawCardFace(_ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, trumpCard, CE.CARD_H, CE.CARD_W);
        _ctx.restore();
      }

      // Stock pile on top
      if (stock.length > 0)
        CE.drawCardBack(_ctx, STOCK_X, STOCK_Y);

      // Card count
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText(stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 8);
    } else {
      // Empty stock
      _ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.fillStyle = 'rgba(255,255,255,0.2)';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }
  }

  function drawTrumpIndicator() {
    const x = 20;
    const y = 185;
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trump:', x, y);
    const color = CE.resolveSuitColor(trumpSuit);
    _ctx.fillStyle = color;
    _ctx.font = 'bold 24px serif';
    _ctx.fillText(SUIT_SYMBOLS[trumpSuit] || trumpSuit, x + 52, y - 4);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText(SUIT_NAMES[trumpSuit] || trumpSuit, x + 78, y + 2);

    // Phase indicator
    _ctx.fillStyle = isPhase2() ? '#f88' : '#8f8';
    _ctx.font = 'bold 10px sans-serif';
    _ctx.fillText(isPhase2() ? 'Phase 2 (closed)' : 'Phase 1 (open)', x, y + 20);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 10;
    const pw = 190;
    const ph = 160;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Bezique', px + 10, py + 8);

    _ctx.font = '12px sans-serif';
    let y = py + 28;

    _ctx.fillStyle = '#8f8';
    _ctx.textAlign = 'left';
    _ctx.fillText('You:', px + 10, y);
    _ctx.textAlign = 'right';
    _ctx.fillText(playerTotalScore + ' (melds: ' + playerMeldScore + ')', px + pw - 10, y);
    y += 18;

    _ctx.fillStyle = '#faa';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI:', px + 10, y);
    _ctx.textAlign = 'right';
    _ctx.fillText(aiTotalScore + ' (melds: ' + aiMeldScore + ')', px + pw - 10, y);
    y += 22;

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Deal: ' + dealNumber + '  |  Tricks: ' + trickCount, px + 10, y);
    y += 14;
    _ctx.fillText('Stock: ' + stock.length + (trumpCard ? '+1' : ''), px + 10, y);
    y += 14;
    _ctx.fillText('Goal: ' + GAME_WIN_SCORE + ' pts', px + 10, y);

    // Show recent melds
    y += 16;
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 10px sans-serif';
    _ctx.fillText('Melds declared:', px + 10, y);
    y += 12;
    _ctx.font = '9px sans-serif';
    const allMelds = playerMeldCards.concat(aiMeldCards);
    const recentMelds = allMelds.slice(-4);
    for (const m of recentMelds) {
      _ctx.fillStyle = '#ccc';
      _ctx.fillText(m.name + ': +' + m.points, px + 10, y);
      y += 11;
    }

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) return;

    const hintIndices = (_host && _host.hintsEnabled) ? getHintIndices() : [];

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (phase === PHASE_PLAY && i === hoverCardIdx && currentTurn === 0)
        y -= 12;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      if (hintIndices.includes(i) && phase === PHASE_PLAY && currentTurn === 0)
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Dim invalid cards in phase 2
      if (isPhase2() && phase === PHASE_PLAY && currentTurn === 0 && trickCards.length > 0) {
        if (!isValidPlayPhase2(i, hand)) {
          _ctx.save();
          _ctx.fillStyle = 'rgba(0,0,0,0.35)';
          CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
          _ctx.fill();
          _ctx.restore();
        }
      }
    }
  }

  function drawAIHand() {
    const total = aiHand.length;
    if (total === 0) return;

    const isTurn = currentTurn === 1 && phase === PHASE_PLAY;
    _ctx.fillStyle = isTurn ? '#ff0' : '#aaa';
    _ctx.font = isTurn ? 'bold 11px sans-serif' : '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('AI (' + total + ')', CANVAS_W / 2, 5);

    for (let i = 0; i < total; ++i) {
      const x = aiCardX(i, total);
      const y = aiCardY();
      CE.drawCardBack(_ctx, x, y, CE.CARD_W * 0.6, CE.CARD_H * 0.6);
    }
  }

  function drawTrickArea() {
    // Subtle trick area outline
    _ctx.save();
    _ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    _ctx.lineWidth = 2;
    CE.drawRoundedRect(_ctx, CANVAS_W / 2 - 80, 200, 160, 180, 10);
    _ctx.stroke();
    _ctx.restore();

    for (let i = 0; i < trickCards.length; ++i) {
      const pos = trickCardPos(trickPlayers[i]);
      CE.drawCardFace(_ctx, pos.x, pos.y, trickCards[i]);
    }

    if (phase === PHASE_TRICK_DONE && trickWinner >= 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      const who = trickWinner === 0 ? 'You take' : 'AI takes';
      _ctx.fillText(who + ' the trick', CANVAS_W / 2, 195);
    }
  }

  function drawCapturedPiles() {
    // Player captured pile
    const pcx = CANVAS_W - 90;
    const pcy = CANVAS_H - CE.CARD_H * 0.5 - 40;
    if (playerCaptured.length > 0) {
      const layers = Math.min(playerCaptured.length, 3);
      for (let i = 0; i < layers; ++i)
        CE.drawCardBack(_ctx, pcx + i * 2, pcy + i * 2, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }
    _ctx.fillStyle = '#8f8';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(playerCaptured.length + ' cards', pcx + CE.CARD_W * 0.25, pcy + CE.CARD_H * 0.5 + 6);

    // AI captured pile
    const acx = CANVAS_W - 90;
    const acy = 80;
    if (aiCaptured.length > 0) {
      const layers = Math.min(aiCaptured.length, 3);
      for (let i = 0; i < layers; ++i)
        CE.drawCardBack(_ctx, acx + i * 2, acy + i * 2, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }
    _ctx.fillStyle = '#faa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(aiCaptured.length + ' cards', acx + CE.CARD_W * 0.25, acy + CE.CARD_H * 0.5 + 6);
  }

  function drawPlayingUI() {
    if (currentTurn === 0 && phase === PHASE_PLAY && !roundOver) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(isPhase2() ? 'Your turn \u2014 must follow suit and win if possible' : 'Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawMeldSelectUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 200;
    const py = 160;
    const pw = 400;
    const lineH = 32;
    const ph = 50 + pendingMeldOptions.length * lineH + 40;

    _ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Declare a Meld!', CANVAS_W / 2, py + 12);

    for (let i = 0; i < pendingMeldOptions.length; ++i) {
      const m = pendingMeldOptions[i];
      const bx = px + 20;
      const by = py + 44 + i * lineH;
      const bw = pw - 40;
      const bh = 26;
      const isHover = hoverMeldBtn === i;
      CE.drawButton(_ctx, bx, by, bw, bh, m.name + ' (+' + m.points + ' pts)', {
        bg: isHover ? '#2a6a2a' : '#1a4a1a',
        border: isHover ? '#8f8' : '#4a4',
        textColor: '#fff',
        fontSize: 12
      });
    }

    // Skip button
    const skipY = py + 44 + pendingMeldOptions.length * lineH;
    const skipW = 100;
    const skipX = CANVAS_W / 2 - skipW / 2;
    const isHoverSkip = hoverMeldBtn === pendingMeldOptions.length;
    CE.drawButton(_ctx, skipX, skipY, skipW, 26, 'Skip', {
      bg: isHoverSkip ? '#633' : '#422',
      border: isHoverSkip ? '#a66' : '#644',
      textColor: '#fff',
      fontSize: 12
    });

    _ctx.restore();
  }

  let hoverMeldBtn = -1;

  function drawRoundOverUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 180;
    const py = 140;
    const pw = 360;
    const ph = 260;

    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';

    if (gameOver) {
      const won = playerTotalScore >= GAME_WIN_SCORE;
      _ctx.fillStyle = won ? '#4f4' : '#f44';
      _ctx.fillText(won ? 'You Win the Game!' : 'AI Wins the Game!', CANVAS_W / 2, py + 16);
    } else {
      _ctx.fillText('Deal Complete', CANVAS_W / 2, py + 16);
    }

    let y = py + 48;
    _ctx.font = '13px sans-serif';

    _ctx.fillStyle = '#ff0';
    _ctx.fillText('Deal ' + dealNumber + ' Results', CANVAS_W / 2, y);
    y += 22;

    const playerBrisques = countBrisques(playerCaptured);
    const aiBrisques = countBrisques(aiCaptured);

    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You: Melds ' + playerMeldScore + ' + Brisques ' + playerBrisques, CANVAS_W / 2, y);
    y += 18;

    _ctx.fillStyle = '#faa';
    _ctx.fillText('AI: Melds ' + aiMeldScore + ' + Brisques ' + aiBrisques, CANVAS_W / 2, y);
    y += 24;

    _ctx.fillStyle = '#8f8';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.fillText('You: ' + playerTotalScore + ' / ' + GAME_WIN_SCORE, CANVAS_W / 2, y);
    y += 20;

    _ctx.fillStyle = '#faa';
    _ctx.fillText('AI: ' + aiTotalScore + ' / ' + GAME_WIN_SCORE, CANVAS_W / 2, y);
    y += 30;

    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.fillText(gameOver ? 'Click to start a new game' : 'Click to deal next hand', CANVAS_W / 2, y);

    _ctx.restore();
  }

  function drawBezique() {
    // Title
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Bezique', 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Deal ' + dealNumber + '  \u2014  First to ' + GAME_WIN_SCORE, 10, 28);

    drawTrumpIndicator();
    drawStock();
    drawScorePanel();
    drawCapturedPiles();
    drawAIHand();
    drawTrickArea();
    drawPlayerHand();

    if (phase === PHASE_PLAY)
      drawPlayingUI();
    else if (phase === PHASE_MELD_SELECT)
      drawMeldSelectUI();
    else if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  /* ================================================================
     MELD SELECT HIT TESTING
     ================================================================ */

  function hitTestMeldOption(mx, my) {
    if (phase !== PHASE_MELD_SELECT) return -1;
    const px = CANVAS_W / 2 - 200;
    const py = 160;
    const pw = 400;
    const lineH = 32;

    for (let i = 0; i < pendingMeldOptions.length; ++i) {
      const bx = px + 20;
      const by = py + 44 + i * lineH;
      const bw = pw - 40;
      const bh = 26;
      if (CE.isInRect(mx, my, bx, by, bw, bh))
        return i;
    }

    // Skip button
    const skipY = py + 44 + pendingMeldOptions.length * lineH;
    const skipW = 100;
    const skipX = CANVAS_W / 2 - skipW / 2;
    if (CE.isInRect(mx, my, skipX, skipY, skipW, 26))
      return pendingMeldOptions.length; // skip sentinel

    return -1;
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      playerTotalScore = score;
      aiTotalScore = 0;
      setupBezique();
      if (_host) _host.onScoreChanged(score);
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawBezique();
    },

    handleClick(mx, my) {
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          playerTotalScore = 0;
          aiTotalScore = 0;
          score = 0;
          gameOver = false;
          if (_host) _host.onScoreChanged(score);
        }
        roundOver = false;
        dealRound();
        return;
      }

      // Meld selection
      if (phase === PHASE_MELD_SELECT) {
        const idx = hitTestMeldOption(mx, my);
        if (idx < 0) return;

        if (idx < pendingMeldOptions.length) {
          // Declare the chosen meld
          declareMeld(0, pendingMeldOptions[idx]);
          // After declaring, check for more melds
          const remaining = getAvailableMelds(0);
          if (remaining.length > 0) {
            pendingMeldOptions = remaining;
            return;
          }
        }

        // Done with melds -- proceed to next trick
        pendingMeldOptions = [];
        currentTurn = 0; // trick winner (player) leads
        trickLeader = 0;
        trickWinner = -1;
        phase = PHASE_PLAY;
        aiTurnTimer = 0;
        return;
      }

      if (phase !== PHASE_PLAY || currentTurn !== 0) return;
      if (roundOver || gameOver) return;

      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      // Validate in phase 2
      if (isPhase2() && trickCards.length > 0) {
        if (!isValidPlayPhase2(idx, playerHand)) {
          if (_host)
            _host.floatingText.add(mx, my - 20, 'Must follow suit and win if possible!', { color: '#f88', size: 14 });
          return;
        }
      }

      playCard(0, idx);
    },

    handlePointerMove(mx, my) {
      hoverCardIdx = -1;
      hoverMeldBtn = -1;

      if (phase === PHASE_PLAY && currentTurn === 0)
        hoverCardIdx = hitTestPlayerCard(mx, my);

      if (phase === PHASE_MELD_SELECT)
        hoverMeldBtn = hitTestMeldOption(mx, my);
    },

    handlePointerUp() {},

    handleKey(e) {},

    tick(dt) {
      if (phase === PHASE_ROUND_OVER) return;

      if (phase === PHASE_TRICK_DONE) {
        trickDoneTimer += dt;
        if (trickDoneTimer >= TRICK_DONE_DELAY)
          finishTrick();
        return;
      }

      if (phase === PHASE_MELD_SELECT) return;

      if (phase !== PHASE_PLAY) return;
      if (currentTurn !== 1) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        let idx;
        if (isPhase2()) {
          const valid = getValidIndicesPhase2(aiHand);
          idx = aiChooseCardPhase2(valid);
        } else {
          idx = aiChooseCard();
        }
        if (idx >= 0)
          playCard(1, idx);
      }
    },

    sortPlayerHand() { sortHand(playerHand); },

    cleanup() {
      playerHand = [];
      aiHand = [];
      stock = [];
      playerCaptured = [];
      aiCaptured = [];
      trickCards = [];
      trickPlayers = [];
      playerMeldCards = [];
      aiMeldCards = [];
      playerMeldsUsed = {};
      aiMeldsUsed = {};
      pendingMeldOptions = [];
      trumpCard = null;
      trumpSuit = '';
      playerMeldScore = 0;
      aiMeldScore = 0;
      playerTotalScore = 0;
      aiTotalScore = 0;
      trickCount = 0;
      trickWinner = -1;
      roundOver = false;
      gameOver = false;
      phase = PHASE_PLAY;
      aiTurnTimer = 0;
      hoverCardIdx = -1;
      hoverMeldBtn = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) {
      score = s;
      playerTotalScore = s;
    }
  };

  /* ================================================================
     AI PHASE 2 HELPER
     ================================================================ */

  function aiChooseCardPhase2(validIdxs) {
    const hand = aiHand;
    if (validIdxs.length === 1) return validIdxs[0];

    const isLeading = trickCards.length === 0;
    if (isLeading) {
      // Lead aces and tens to secure brisques
      for (const i of validIdxs)
        if (hand[i].rank === 'A') return i;
      for (const i of validIdxs)
        if (hand[i].rank === '10') return i;
      // Lead highest
      validIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      return validIdxs[0];
    }

    // Following: pick cheapest winner
    const leadCard = trickCards[0];
    let cheapestWinner = -1;
    let cheapestCost = 999;
    for (const i of validIdxs) {
      const c = hand[i];
      if (canBeatCard(c, leadCard)) {
        const cost = cardStrength(c) + (isTrump(c) ? 50 : 0);
        if (cost < cheapestCost) {
          cheapestCost = cost;
          cheapestWinner = i;
        }
      }
    }
    if (cheapestWinner >= 0) return cheapestWinner;

    // Can't win: play lowest
    validIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
    return validIdxs[0];
  }

  SZ.CardGames.registerVariant('bezique', module);

})();
