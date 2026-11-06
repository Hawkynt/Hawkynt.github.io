/* Briscola: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardY = SZ.CardGames.shared.euroLayout.duelPlayerCardY;

  const V = SZ.CardGames.v.briscola;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_PLAY, PHASE_TRICK_DONE, PHASE_ROUND_OVER } = V;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const BRISCOLA_RANKS = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];

  /* Trick-taking strength (high to low): A, 3, K, Q, J, 7, 6, 5, 4, 2 */
  const RANK_STRENGTH = { 'A': 10, '3': 9, 'K': 8, 'Q': 7, 'J': 6, '7': 5, '6': 4, '5': 3, '4': 2, '2': 1 };

  /* Point values */
  const RANK_POINTS = { 'A': 11, '3': 10, 'K': 4, 'Q': 3, 'J': 2, '7': 0, '6': 0, '5': 0, '4': 0, '2': 0 };

  const WIN_THRESHOLD = 61;
  const HAND_LIMIT = 3;

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

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    if (S.trickCards.length < 2) return -1;
    const leadCard = S.trickCards[0];
    const followCard = S.trickCards[1];
    const leadSuit = leadCard.suit;

    /* If follow played trump and lead did not, follow wins */
    if (isTrump(followCard) && !isTrump(leadCard))
      return S.trickPlayers[1];

    /* If lead played trump and follow did not, lead wins */
    if (isTrump(leadCard) && !isTrump(followCard))
      return S.trickPlayers[0];

    /* Both same suit -- compare strength */
    if (followCard.suit === leadSuit)
      return cardStrength(followCard) > cardStrength(leadCard) ? S.trickPlayers[1] : S.trickPlayers[0];

    /* Both trump -- compare strength */
    if (isTrump(leadCard) && isTrump(followCard))
      return cardStrength(followCard) > cardStrength(leadCard) ? S.trickPlayers[1] : S.trickPlayers[0];

    /* Follow played off-suit non-trump -- lead wins */
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

  function canBeatLead(card) {
    if (S.trickCards.length === 0) return false;
    const leadCard = S.trickCards[0];

    if (isTrump(card) && !isTrump(leadCard)) return true;
    if (card.suit === leadCard.suit && cardStrength(card) > cardStrength(leadCard)) return true;
    if (isTrump(card) && isTrump(leadCard) && cardStrength(card) > cardStrength(leadCard)) return true;
    return false;
  }

  function canBeatLeadWith(card, leadCard) {
    if (isTrump(card) && !isTrump(leadCard)) return true;
    if (card.suit === leadCard.suit && cardStrength(card) > cardStrength(leadCard)) return true;
    if (isTrump(card) && isTrump(leadCard) && cardStrength(card) > cardStrength(leadCard)) return true;
    return false;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, BRISCOLA_RANKS));
    S.stock = d;
    S.playerHand = [];
    S.aiHand = [];
    S.playerCaptured = [];
    S.aiCaptured = [];
    S.playerPoints = 0;
    S.aiPoints = 0;
    S.trickCards = [];
    S.trickPlayers = [];
    S.trickCount = 0;
    S.trickWinner = -1;
    S.trickDoneTimer = 0;
    S.aiTurnTimer = 0;
    S.hoverCardIdx = -1;
    S.roundOver = false;
    S.gameOver = false;
    S.phase = PHASE_PLAY;

    /* Trump card is the bottom of the stock, shown face-up */
    S.trumpCard = S.stock[0];
    S.trumpCard.faceUp = true;
    S.trumpSuit = S.trumpCard.suit;

    /* Deal 3 cards each (pop from top) */
    for (let i = 0; i < HAND_LIMIT; ++i) {
      S.playerHand.push(S.stock.pop());
      S.aiHand.push(S.stock.pop());
    }

    for (const c of S.playerHand) c.faceUp = true;
    sortHand(S.playerHand);
    sortHand(S.aiHand);

    /* Non-dealer leads (player leads first round) */
    S.currentTurn = 0;
    S.trickLeader = 0;

    if (S._host) {
      for (let i = 0; i < S.playerHand.length; ++i)
        S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.playerHand.length), playerCardY(), i * 0.08);
    }
  }

  function setupBriscola() {
    S.roundOver = false;
    S.gameOver = false;
    dealRound();
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(who, cardIdx) {
    const hand = who === 0 ? S.playerHand : S.aiHand;
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;

    S.trickCards.push(card);
    S.trickPlayers.push(who);

    if (S.trickCards.length >= 2) {
      S.phase = PHASE_TRICK_DONE;
      S.trickWinner = resolveTrickWinner();
      S.trickDoneTimer = 0;
      return;
    }

    /* Next player's turn */
    S.currentTurn = 1 - S.currentTurn;
  }

  function finishTrick() {
    const pts = trickPointValue();

    if (S.trickWinner === 0) {
      S.playerPoints += pts;
      for (const c of S.trickCards) S.playerCaptured.push(c);
      if (S._host && pts > 0)
        S._host.floatingText.add(CANVAS_W / 2, 280, 'You +' + pts + ' pts', { color: '#4f4', size: 16 });
    } else {
      S.aiPoints += pts;
      for (const c of S.trickCards) S.aiCaptured.push(c);
      if (S._host && pts > 0)
        S._host.floatingText.add(CANVAS_W / 2, 280, 'AI +' + pts + ' pts', { color: '#fa0', size: 16 });
    }

    ++S.trickCount;
    S.trickCards = [];
    S.trickPlayers = [];

    /* Draw from stock: winner draws first, then loser */
    if (S.stock.length > 0) {
      const winnerHand = S.trickWinner === 0 ? S.playerHand : S.aiHand;
      const loserHand = S.trickWinner === 0 ? S.aiHand : S.playerHand;

      winnerHand.push(S.stock.pop());
      if (S.stock.length > 0)
        loserHand.push(S.stock.pop());

      /* The last card drawn from stock is the trump card itself */
      for (const c of S.playerHand) c.faceUp = true;
      sortHand(S.playerHand);
      sortHand(S.aiHand);
    }

    /* Check if round is over */
    if (S.playerHand.length === 0 && S.aiHand.length === 0) {
      endRound();
      return;
    }

    /* Winner leads next trick */
    S.currentTurn = S.trickWinner;
    S.trickLeader = S.trickWinner;
    S.trickWinner = -1;
    S.phase = PHASE_PLAY;
    S.aiTurnTimer = 0;
  }

  function endRound() {
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    if (S.playerPoints >= WIN_THRESHOLD) {
      S.gameOver = true;
      const margin = S.playerPoints - S.aiPoints;
      S.score += margin;
      if (S._host) {
        S._host.onScoreChanged(S.score);
        S._host.floatingText.add(CANVAS_W / 2, 200, 'You win! (' + S.playerPoints + '-' + S.aiPoints + ')', { color: '#4f4', size: 24 });
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
      }
    } else if (S.aiPoints >= WIN_THRESHOLD) {
      S.gameOver = true;
      S.score += S.playerPoints - S.aiPoints;
      if (S.score < 0) S.score = 0;
      if (S._host) {
        S._host.onScoreChanged(S.score);
        S._host.floatingText.add(CANVAS_W / 2, 200, 'AI wins! (' + S.aiPoints + '-' + S.playerPoints + ')', { color: '#f44', size: 24 });
      }
    } else {
      /* 60-60 draw */
      S.gameOver = true;
      if (S._host) {
        S._host.onScoreChanged(S.score);
        S._host.floatingText.add(CANVAS_W / 2, 200, 'Draw! (' + S.playerPoints + '-' + S.aiPoints + ')', { color: '#ff0', size: 24 });
      }
    }
  }

  V.cardStrength = cardStrength;
  V.cardPoints = cardPoints;
  V.isTrump = isTrump;
  V.sortHand = sortHand;
  V.trickPointValue = trickPointValue;
  V.canBeatLead = canBeatLead;
  V.canBeatLeadWith = canBeatLeadWith;
  V.dealRound = dealRound;
  V.setupBriscola = setupBriscola;
  V.playCard = playCard;
  V.finishTrick = finishTrick;

})();
