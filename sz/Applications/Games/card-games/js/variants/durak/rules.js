/* Durak: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.durak;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, MAX_ATTACK_CARDS } = V;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const DURAK_RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_ORDER = { '6': 0, '7': 1, '8': 2, '9': 3, '10': 4, 'J': 5, 'Q': 6, 'K': 7, 'A': 8 };

  const HAND_LIMIT = 6;

  /* ================================================================
     CARD UTILITIES
     ================================================================ */

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
  }

  function isTrump(card) {
    return card.suit === S.trumpSuit;
  }

  function canBeat(attCard, defCard) {
    if (defCard.suit === attCard.suit)
      return cardStrength(defCard) > cardStrength(attCard);
    if (isTrump(defCard) && !isTrump(attCard))
      return true;
    return false;
  }

  function sortHand(hand) {
    hand.sort((a, b) => {
      const ta = isTrump(a) ? 1 : 0;
      const tb = isTrump(b) ? 1 : 0;
      if (ta !== tb) return ta - tb;
      if (a.suit !== b.suit) return CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      return cardStrength(a) - cardStrength(b);
    });
  }

  function ranksOnTable() {
    const ranks = new Set();
    for (const c of S.attackCards) ranks.add(c.rank);
    for (const c of S.defenseCards)
      if (c) ranks.add(c.rank);
    return ranks;
  }

  function canAddAttackCard(card, defenderHandSize) {
    const totalAttacks = S.attackCards.length;
    if (totalAttacks >= MAX_ATTACK_CARDS) return false;
    if (totalAttacks >= defenderHandSize + countUndefended()) return false;
    if (totalAttacks === 0) return true;
    const ranks = ranksOnTable();
    return ranks.has(card.rank);
  }

  function countUndefended() {
    let count = 0;
    for (let i = 0; i < S.attackCards.length; ++i)
      if (!S.defenseCards[i]) ++count;
    return count;
  }

  function allDefended() {
    if (S.attackCards.length === 0) return false;
    for (let i = 0; i < S.attackCards.length; ++i)
      if (!S.defenseCards[i]) return false;
    return true;
  }

  /* ================================================================
     DRAW FROM STOCK
     ================================================================ */

  function drawFromStock(hand, count) {
    for (let i = 0; i < count && S.stock.length > 0; ++i)
      hand.push(S.stock.pop());
  }

  function refillHands() {
    const attackerHand = S.isPlayerAttacking ? S.playerHand : S.aiHand;
    const defenderHand = S.isPlayerAttacking ? S.aiHand : S.playerHand;

    const attackerNeed = Math.max(0, HAND_LIMIT - attackerHand.length);
    drawFromStock(attackerHand, attackerNeed);

    const defenderNeed = Math.max(0, HAND_LIMIT - defenderHand.length);
    drawFromStock(defenderHand, defenderNeed);

    sortHand(S.playerHand);
    sortHand(S.aiHand);
  }

  /* ================================================================
     BOUT RESOLUTION
     ================================================================ */

  function defenderPicksUp() {
    const defenderHand = S.isPlayerAttacking ? S.aiHand : S.playerHand;
    for (let i = 0; i < S.attackCards.length; ++i) {
      defenderHand.push(S.attackCards[i]);
      if (S.defenseCards[i])
        defenderHand.push(S.defenseCards[i]);
    }
    S.attackCards = [];
    S.defenseCards = [];
    S.boutOver = true;

    if (S._host) {
      const who = S.isPlayerAttacking ? 'AI picks up!' : 'You pick up!';
      S._host.floatingText.add(CANVAS_W / 2, 280, who, { color: '#fa0', size: 20 });
    }

    refillHands();
    sortHand(S.playerHand);
    sortHand(S.aiHand);
    /* Attacker stays the same when defender picks up */
    checkGameEnd();
  }

  function defenderSucceeded() {
    for (let i = 0; i < S.attackCards.length; ++i) {
      S.discard.push(S.attackCards[i]);
      if (S.defenseCards[i])
        S.discard.push(S.defenseCards[i]);
    }
    S.attackCards = [];
    S.defenseCards = [];
    S.boutOver = true;

    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, 280, 'Defended!', { color: '#4f4', size: 20 });

    refillHands();
    sortHand(S.playerHand);
    sortHand(S.aiHand);
    /* Defender becomes attacker */
    S.isPlayerAttacking = !S.isPlayerAttacking;
    checkGameEnd();
  }

  function checkGameEnd() {
    S.boutOver = false;
    S.waitingForDefense = false;
    S.aiActionPending = false;
    S.aiTurnTimer = 0;
    S.selectedCardIdx = -1;

    if (S.stock.length === 0) {
      if (S.playerHand.length === 0 && S.aiHand.length === 0) {
        /* Draw */
        S.roundOver = true;
        S.resultMsg = 'Draw! Both players empty.';
        S.score += 50;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 300, 'Draw!', { color: '#ff0', size: 24 });
          S._host.onScoreChanged(S.score);
        }
        return;
      }
      if (S.playerHand.length === 0) {
        /* Player wins */
        S.roundOver = true;
        const bonus = S.aiHand.length * 5;
        S.score += 100 + bonus;
        S.resultMsg = 'You win! +' + (100 + bonus) + ' - Click to continue';
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 300, 'You win!', { color: '#4f4', size: 28 });
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
          S._host.particles.confetti(CANVAS_W / 2, 300, 30);
          S._host.onScoreChanged(S.score);
        }
        return;
      }
      if (S.aiHand.length === 0) {
        /* AI wins -- player is the Durak */
        S.roundOver = true;
        S.score -= 50;
        S.resultMsg = 'You are the Durak! -50 - Click to continue';
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 300, 'DURAK!', { color: '#f44', size: 28 });
          S._host.screenShake.trigger(8, 400);
          S._host.onScoreChanged(S.score);
        }
        if (S.score <= -100) {
          S.gameOver = true;
          S.resultMsg = 'GAME OVER';
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 340, 'GAME OVER', { color: '#f44', size: 36 });
        }
        return;
      }
    }
  }

  /* ================================================================
     PLAYER ACTIONS
     ================================================================ */

  function playerAttack(cardIdx) {
    if (!S.isPlayerAttacking || S.roundOver || S.gameOver) return;
    if (S.waitingForDefense) return;

    const card = S.playerHand[cardIdx];
    if (!canAddAttackCard(card, S.aiHand.length)) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 400, 'Cannot play this card!', { color: '#f88', size: 14 });
      return;
    }

    S.playerHand.splice(cardIdx, 1);
    card.faceUp = true;
    S.attackCards.push(card);
    S.defenseCards.push(null);
    S.selectedCardIdx = -1;

    if (S._host)
      S._host.dealCardAnim(card, CANVAS_W / 2, CANVAS_H, V.tableAttackX(S.attackCards.length - 1), V.tableAttackY(), 0);

    if (S.attackCards.length === 1 && S._host)
      S._host.floatingText.add(CANVAS_W / 2, 260, 'Attack!', { color: '#fa0', size: 18 });

    S.waitingForDefense = true;
    S.aiActionPending = false;
    S.aiTurnTimer = 0;
  }

  function playerDefend(attackIdx, cardIdx) {
    if (S.isPlayerAttacking || S.roundOver || S.gameOver) return;
    if (S.defenseCards[attackIdx]) return;

    const card = S.playerHand[cardIdx];
    const attCard = S.attackCards[attackIdx];

    if (!canBeat(attCard, card)) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 400, 'Cannot beat with this card!', { color: '#f88', size: 14 });
      return;
    }

    S.playerHand.splice(cardIdx, 1);
    card.faceUp = true;
    S.defenseCards[attackIdx] = card;
    S.selectedCardIdx = -1;

    if (S._host)
      S._host.dealCardAnim(card, CANVAS_W / 2, CANVAS_H, V.tableDefenseX(attackIdx), V.tableDefenseY(), 0);

    if (allDefended()) {
      /* Wait for attacker to add more or press Done */
      S.waitingForDefense = false;
      S.aiActionPending = false;
      S.aiTurnTimer = 0;
    }
  }

  function playerTakesCards() {
    if (S.isPlayerAttacking || S.roundOver || S.gameOver) return;
    defenderPicksUp();
  }

  function playerDoneAttacking() {
    if (!S.isPlayerAttacking || S.roundOver || S.gameOver) return;
    if (S.attackCards.length === 0) return;
    if (!allDefended()) return;
    defenderSucceeded();
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupDurak() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, DURAK_RANKS));

    S.playerHand = [];
    S.aiHand = [];
    S.stock = d;
    S.discard = [];
    S.attackCards = [];
    S.defenseCards = [];
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.isPlayerAttacking = true;
    S.waitingForDefense = false;
    S.boutOver = false;
    S.aiTurnTimer = 0;
    S.aiActionPending = false;
    S.hoverCardIdx = -1;
    S.selectedCardIdx = -1;

    /* Trump card is bottom of stock (shown face-up) */
    S.trumpCard = S.stock[0];
    S.trumpCard.faceUp = true;
    S.trumpSuit = S.trumpCard.suit;

    /* Deal 6 cards each */
    for (let i = 0; i < HAND_LIMIT; ++i) {
      S.playerHand.push(S.stock.pop());
      S.aiHand.push(S.stock.pop());
    }

    for (const c of S.playerHand) c.faceUp = true;
    sortHand(S.playerHand);
    sortHand(S.aiHand);

    /* Determine first attacker: lowest trump card holder */
    let playerLowestTrump = 99;
    let aiLowestTrump = 99;
    for (const c of S.playerHand)
      if (isTrump(c) && cardStrength(c) < playerLowestTrump) playerLowestTrump = cardStrength(c);
    for (const c of S.aiHand)
      if (isTrump(c) && cardStrength(c) < aiLowestTrump) aiLowestTrump = cardStrength(c);

    if (aiLowestTrump < playerLowestTrump)
      S.isPlayerAttacking = false;
    else
      S.isPlayerAttacking = true;

    if (S._host) {
      for (let i = 0; i < S.playerHand.length; ++i)
        S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.playerHand.length), V.playerCardY(), i * 0.08);
    }
  }

  V.cardStrength = cardStrength;
  V.isTrump = isTrump;
  V.canBeat = canBeat;
  V.sortHand = sortHand;
  V.ranksOnTable = ranksOnTable;
  V.canAddAttackCard = canAddAttackCard;
  V.allDefended = allDefended;
  V.defenderPicksUp = defenderPicksUp;
  V.defenderSucceeded = defenderSucceeded;
  V.playerAttack = playerAttack;
  V.playerDefend = playerDefend;
  V.playerTakesCards = playerTakesCards;
  V.playerDoneAttacking = playerDoneAttacking;
  V.setupDurak = setupDurak;

})();
