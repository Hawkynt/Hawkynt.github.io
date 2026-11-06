/* Mau-Mau: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['maumau'];
  const S = V.S;
  const { RANK_POINTS, CANVAS_W, CANVAS_H, SUIT_NAMES } = V;

  /* ================================================================
     CARD RULES
     ================================================================ */

  function topDiscard() {
    return S.discardPile.length > 0 ? S.discardPile[S.discardPile.length - 1] : null;
  }

  function effectiveSuit() {
    if (S.chosenSuit)
      return S.chosenSuit;
    const top = topDiscard();
    return top ? top.suit : null;
  }

  function canPlay(card) {
    const top = topDiscard();
    if (!top) return true;

    // Under draw obligation only 7s can be stacked
    if (S.drawObligation > 0)
      return card.rank === '7';

    // Jack is wild -- can be played on anything (except on obligation)
    if (card.rank === 'J')
      return true;

    // If a Jack was played last, must match chosen suit (or play another Jack)
    if (S.chosenSuit)
      return card.suit === S.chosenSuit;

    // Match suit or rank
    return card.suit === top.suit || card.rank === top.rank;
  }

  function hasPlayableCard(hand) {
    for (const card of hand)
      if (canPlay(card))
        return true;
    return false;
  }

  function handPoints(hand) {
    let pts = 0;
    for (const card of hand)
      pts += (RANK_POINTS[card.rank] || 0);
    return pts;
  }

  /* ================================================================
     STOCK MANAGEMENT
     ================================================================ */

  function recycleDiscard() {
    if (S.discardPile.length <= 1) return;
    const top = S.discardPile.pop();
    S.stock = CE.shuffle(S.discardPile);
    S.discardPile = [top];
  }

  function drawFromStock(count) {
    const drawn = [];
    for (let i = 0; i < count; ++i) {
      if (S.stock.length === 0) recycleDiscard();
      if (S.stock.length === 0) break;
      drawn.push(S.stock.pop());
    }
    return drawn;
  }

  /* ================================================================
     PLAY LOGIC
     ================================================================ */

  function nextPlayer() {
    return S.currentPlayer === 0 ? 1 : 0;
  }

  function announceMau(playerIdx) {
    if (S.hands[playerIdx].length === 1 && !S.mauAnnounced[playerIdx]) {
      S.mauAnnounced[playerIdx] = true;
      if (S._host) {
        const label = playerIdx === 0 ? 'Mau!' : 'AI: Mau!';
        S._host.floatingText.add(CANVAS_W / 2, playerIdx === 0 ? 400 : 160, label, { color: '#ff0', size: 22 });
      }
    }
  }

  function announceMauMau(playerIdx) {
    if (S.hands[playerIdx].length === 0 && !S.mauMauAnnounced[playerIdx]) {
      S.mauMauAnnounced[playerIdx] = true;
      if (S._host) {
        const label = playerIdx === 0 ? 'Mau-Mau!' : 'AI: Mau-Mau!';
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, label, { color: '#4f4', size: 28 });
      }
    }
  }

  function playCard(playerIdx, cardIndex) {
    if (S.waitingForSuitChoice) return false;
    const hand = S.hands[playerIdx];
    if (cardIndex < 0 || cardIndex >= hand.length) return false;
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;

    hand.splice(cardIndex, 1);
    S.discardPile.push(card);
    S.chosenSuit = null;

    // Animate the deal
    if (S._host) {
      const srcX = playerIdx === 0 ? 80 + cardIndex * 55 : 80 + cardIndex * 20;
      const srcY = playerIdx === 0 ? 440 : 20;
      S._host.dealCardAnim(card, srcX, srcY, CANVAS_W / 2 - CE.CARD_W / 2, 240, 0);
    }

    // Special card effects
    if (card.rank === '7') {
      S.drawObligation += 2;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 220, '+' + S.drawObligation + ' Draw!', { color: '#f88', size: 18 });
    } else if (card.rank === '8') {
      S.skipNext = true;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 220, 'Skip!', { color: '#fa0', size: 18 });
    } else if (card.rank === 'J') {
      // Jack is wild -- player picks suit
      if (playerIdx === 0) {
        S.waitingForSuitChoice = true;
        S.pendingJackPlayer = playerIdx;
        announceMau(playerIdx);
        return true;
      }
      // AI picks suit
      S.chosenSuit = V.aiChooseSuit();
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 220, 'Wish: ' + SUIT_NAMES[S.chosenSuit], { color: '#8af', size: 16 });
    } else if (card.rank === 'A') {
      // Ace = reverse = extra turn in 2-player
      S.extraTurn = true;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 220, 'Extra turn!', { color: '#af4', size: 16 });
    }

    // Check for Mau / Mau-Mau
    announceMau(playerIdx);

    if (hand.length === 0)
      return finishRound(playerIdx);

    advanceTurn();
    return true;
  }

  function finishRound(winnerIdx) {
    announceMauMau(winnerIdx);
    const loserIdx = winnerIdx === 0 ? 1 : 0;
    const pts = handPoints(S.hands[loserIdx]);

    if (winnerIdx === 0) {
      S.score += pts;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300,
          'YOU WIN! +' + pts + ' points', { color: '#4f4', size: 24 });
        S._host.addGlow(80, 440, S.hands[0].length * 55 + CE.CARD_W, CE.CARD_H, 2);
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
    } else {
      S.score -= Math.floor(pts / 2);
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 300,
          'AI WINS! -' + Math.floor(pts / 2) + ' points', { color: '#f44', size: 24 });
    }

    S.roundOver = true;
    if (S.score <= -100) S.gameOver = true;
    if (S._host) S._host.onScoreChanged(S.score);
    return true;
  }

  function advanceTurn() {
    if (S.extraTurn) {
      S.extraTurn = false;
      // Same player goes again
      return;
    }

    if (S.skipNext) {
      S.skipNext = false;
      // Skip next player, current player goes again
      return;
    }

    S.currentPlayer = nextPlayer();
  }

  function playerDrawCards() {
    if (S.drawObligation > 0) {
      const drawn = drawFromStock(S.drawObligation);
      for (const c of drawn)
        S.hands[S.currentPlayer].push(c);
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, S.currentPlayer === 0 ? 400 : 160,
          'Draw ' + S.drawObligation + '!', { color: '#f88', size: 18 });
      S.drawObligation = 0;
      S.mauAnnounced[S.currentPlayer] = false;
      S.currentPlayer = nextPlayer();
    } else {
      const drawn = drawFromStock(1);
      for (const c of drawn)
        S.hands[S.currentPlayer].push(c);
      S.mauAnnounced[S.currentPlayer] = false;
      S.currentPlayer = nextPlayer();
    }
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupMauMau() {
    const d = CE.shuffle(CE.createDeck());
    S.hands = [[], []];
    S.discardPile = [];
    S.stock = d;
    S.currentPlayer = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.drawObligation = 0;
    S.skipNext = false;
    S.extraTurn = false;
    S.chosenSuit = null;
    S.waitingForSuitChoice = false;
    S.pendingJackPlayer = -1;
    S.mauAnnounced = [false, false];
    S.mauMauAnnounced = [false, false];
    S.aiTurnTimer = 0;

    // Deal 6 cards each
    for (let i = 0; i < 6; ++i) {
      S.hands[0].push(S.stock.pop());
      S.hands[1].push(S.stock.pop());
    }

    // Flip one card to start discard pile
    let startCard = S.stock.pop();
    // Ensure starting card is not a special card (7, 8, J, A)
    while (startCard.rank === '7' || startCard.rank === '8' || startCard.rank === 'J' || startCard.rank === 'A') {
      S.stock.unshift(startCard);
      CE.shuffle(S.stock);
      startCard = S.stock.pop();
    }
    S.discardPile.push(startCard);

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, 80 + i * 55, 440, i * 0.1);
    }
  }

  Object.assign(V, { playerDrawCards, playCard, canPlay, hasPlayableCard, topDiscard, advanceTurn, finishRound, setupMauMau });

})();
