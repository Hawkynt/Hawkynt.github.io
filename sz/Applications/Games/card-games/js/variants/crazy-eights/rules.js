/* Crazy Eights: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['crazy-eights'];
  const S = V.S;
  const { CANVAS_W, SUIT_NAMES, SUIT_SYMBOLS, WIN_SCORE, CANVAS_H, MAX_DRAWS } = V;

  /* ================================================================
     CARD SCORING
     ================================================================ */

  function cardPoints(card) {
    if (card.rank === '8') return 50;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    if (card.rank === 'A') return 1;
    return parseInt(card.rank, 10);
  }

  function handPoints(hand) {
    let total = 0;
    for (const c of hand)
      total += cardPoints(c);
    return total;
  }

  /* ================================================================
     RULES
     ================================================================ */

  function canPlay(card, topCard, requiredSuit) {
    if (card.rank === '8') return true;
    if (card.suit === requiredSuit) return true;
    if (card.rank === topCard.rank) return true;
    return false;
  }

  function hasPlayableCard(hand, topCard, requiredSuit) {
    for (const c of hand)
      if (canPlay(c, topCard, requiredSuit))
        return true;
    return false;
  }

  function recycleDiscard() {
    if (S.discardPile.length <= 1) return;
    const topCard = S.discardPile.pop();
    const recycled = S.discardPile.splice(0, S.discardPile.length);
    CE.shuffle(recycled);
    for (const c of recycled) {
      c.faceUp = false;
      S.stock.push(c);
    }
    S.discardPile.push(topCard);
    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2 - 80, 290, 'Stock refilled', { color: '#8cf', size: 14 });
  }

  function drawFromStock() {
    if (S.stock.length === 0)
      recycleDiscard();
    if (S.stock.length === 0) return null;
    return S.stock.pop();
  }

  /* ================================================================
     GAME ACTIONS
     ================================================================ */

  function playCard(hand, index, isPlayer) {
    const card = hand.splice(index, 1)[0];
    card.faceUp = true;
    S.discardPile.push(card);

    if (S._host)
      S._host.dealCardAnim(card, isPlayer ? V.getPlayerCardX(index) : V.getAiCardX(index),
        isPlayer ? 460 : 20, CANVAS_W / 2 - CE.CARD_W / 2, 240, 0);

    if (card.rank === '8') {
      if (isPlayer) {
        S.waitingForSuitChoice = true;
        S.pendingSuitPlayer = 0;
        return;
      }
      // AI chooses suit
      const chosen = V.aiChooseSuit();
      S.currentSuit = chosen;
      if (S._host) {
        const sym = SUIT_SYMBOLS[chosen] || '';
        const isRed = chosen === 'hearts' || chosen === 'diamonds';
        S._host.floatingText.add(CANVAS_W / 2, 200, 'AI picks ' + SUIT_NAMES[chosen] + ' ' + sym,
          { color: isRed ? '#f88' : '#ccc', size: 16 });
      }
    } else
      S.currentSuit = card.suit;

    finishTurn(isPlayer, hand);
  }

  function finishTurn(isPlayer, hand) {
    S.drawCount = 0;
    if (hand.length === 0) {
      endRound(isPlayer);
      return;
    }
    S.playerTurn = !isPlayer;
    S.aiTurnTimer = 0;
  }

  function endRound(playerWon) {
    S.roundOver = true;
    if (playerWon) {
      const pts = handPoints(S.aiHand);
      S.score += pts;
      S.resultMsg = 'You win the round! +' + pts + ' pts';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN! +' + pts, { color: '#4f4', size: 28 });
        S._host.addGlow(V.getPlayerCardX(0) - 10, 440, Math.max(S.playerHand.length, 1) * 55 + CE.CARD_W, CE.CARD_H, 2);
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
    } else {
      const pts = handPoints(S.playerHand);
      S.score -= Math.floor(pts / 2);
      S.resultMsg = 'AI wins the round! -' + Math.floor(pts / 2) + ' pts';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 300, 'AI WINS', { color: '#f44', size: 28 });
    }
    if (S.score >= WIN_SCORE) {
      S.gameOver = true;
      S.resultMsg = 'YOU WIN THE GAME! Final score: ' + S.score;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 260, 'GAME OVER - YOU WIN!', { color: '#ff0', size: 24 });
    }
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function playerDraw() {
    if (S.drawCount >= MAX_DRAWS) {
      // Pass turn
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 420, 'Pass!', { color: '#fa0', size: 16 });
      S.drawCount = 0;
      S.playerTurn = false;
      S.aiTurnTimer = 0;
      return;
    }
    const card = drawFromStock();
    if (!card) {
      // No cards anywhere, pass
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 420, 'No cards left, pass!', { color: '#fa0', size: 14 });
      S.drawCount = 0;
      S.playerTurn = false;
      S.aiTurnTimer = 0;
      return;
    }
    card.faceUp = true;
    S.playerHand.push(card);
    ++S.drawCount;
    if (S._host)
      S._host.dealCardAnim(card, CANVAS_W / 2 - 80, 240,
        V.getPlayerCardX(S.playerHand.length - 1), 460, 0);
    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, 420, 'Draw (' + S.drawCount + '/' + MAX_DRAWS + ')',
        { color: '#8cf', size: 14 });
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupCrazyEights() {
    S.stock = CE.shuffle(CE.createDeck());
    S.playerHand = [];
    S.aiHand = [];
    S.discardPile = [];
    S.currentSuit = null;
    S.playerTurn = true;
    S.drawCount = 0;
    S.roundOver = false;
    S.resultMsg = '';
    S.waitingForSuitChoice = false;
    S.pendingSuitPlayer = -1;
    S.aiTurnTimer = 0;

    // Deal 7 cards each
    for (let i = 0; i < 7; ++i) {
      const pc = S.stock.pop();
      pc.faceUp = true;
      S.playerHand.push(pc);
      if (S._host)
        S._host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, V.getPlayerCardX(i), 460, i * 0.1);

      const ac = S.stock.pop();
      ac.faceUp = false;
      S.aiHand.push(ac);
    }

    // Flip one card to start discard pile (not an 8)
    let starter = S.stock.pop();
    while (starter.rank === '8') {
      S.stock.unshift(starter);
      starter = S.stock.pop();
    }
    starter.faceUp = true;
    S.discardPile.push(starter);
    S.currentSuit = starter.suit;
  }

  Object.assign(V, { playCard, canPlay, drawFromStock, hasPlayableCard, playerDraw, finishTurn, setupCrazyEights });

})();
