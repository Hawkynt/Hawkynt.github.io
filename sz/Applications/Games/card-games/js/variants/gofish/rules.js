/* Go Fish: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const HANDS = SZ.CardGames.shared.quickHands;
  const V = SZ.CardGames.v.gofish;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, RANK_NAMES, BOOKS_TO_WIN, POINTS_PER_BOOK, MESSAGE_FADE } = V;

  function removeCardsOfRank(hand, rank) {
    const removed = [];
    for (let i = hand.length - 1; i >= 0; --i) {
      if (hand[i].rank === rank) {
        removed.push(hand[i]);
        hand.splice(i, 1);
      }
    }
    return removed;
  }

  function getRanksInHand(hand) {
    const seen = {};
    const ranks = [];
    for (const c of hand) {
      if (!seen[c.rank]) {
        seen[c.rank] = true;
        ranks.push(c.rank);
      }
    }
    return ranks;
  }

  function checkForBooks(hand, books, ownerLabel) {
    const found = [];
    const rankCounts = {};
    for (const c of hand) {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    }
    for (const rank in rankCounts) {
      if (rankCounts[rank] === 4) {
        const bookCards = removeCardsOfRank(hand, rank);
        books.push({ rank, cards: bookCards });
        found.push(rank);
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, ownerLabel + ' books ' + RANK_NAMES[rank] + '!', { color: '#ff0', size: 18 });
      }
    }
    return found;
  }

  function drawFromStock(hand) {
    if (S.stock.length === 0) return null;
    const card = S.stock.pop();
    card.faceUp = true;
    hand.push(card);
    if (S._host) S._host.dealCardAnim(card, CANVAS_W / 2, CANVAS_H / 2 - 40, CANVAS_W / 2, CANVAS_H - CE.CARD_H - 20, 0);
    return card;
  }

  function totalBooks() {
    return S.playerBooks.length + S.aiBooks.length;
  }

  function handsEmpty() {
    return S.playerHand.length === 0 && S.aiHand.length === 0;
  }

  function setMessage(msg, color) {
    S.message = msg;
    S.messageColor = color || '#fff';
    S.messageTimer = MESSAGE_FADE;
  }

  function refillHandIfEmpty(hand) {
    if (hand.length === 0 && S.stock.length > 0) {
      const card = S.stock.pop();
      card.faceUp = true;
      hand.push(card);
    }
  }

  function checkGameEnd() {
    if (totalBooks() >= BOOKS_TO_WIN || (S.stock.length === 0 && handsEmpty())) {
      S.roundOver = true;
      const playerWins = S.playerBooks.length > S.aiBooks.length;
      const tie = S.playerBooks.length === S.aiBooks.length;
      S.score = S.playerBooks.length * POINTS_PER_BOOK;
      if (S._host) S._host.onScoreChanged(S.score);

      if (tie)
        setMessage('It\'s a tie! ' + S.playerBooks.length + '-' + S.aiBooks.length, '#ff0');
      else if (playerWins) {
        setMessage('You win! ' + S.playerBooks.length + '-' + S.aiBooks.length, '#4f4');
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 28 });
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
          S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 30);
        }
      } else {
        setMessage('AI wins! ' + S.aiBooks.length + '-' + S.playerBooks.length, '#f44');
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI WINS', { color: '#f44', size: 28 });
      }

      if (S._host) S._host.onRoundOver(true);
      return true;
    }
    return false;
  }

  /* -- Player asks AI for a rank -- */
  function playerAsksFor(rank) {
    if (!S.isPlayerTurn || S.roundOver || S.gameOver) return;
    if (HANDS.countRank(S.playerHand, rank) === 0) return;

    const aiCount = HANDS.countRank(S.aiHand, rank);
    if (aiCount > 0) {
      const taken = removeCardsOfRank(S.aiHand, rank);
      for (const c of taken) {
        c.faceUp = true;
        S.playerHand.push(c);
      }
      setMessage('AI gives you ' + aiCount + ' ' + RANK_NAMES[rank] + '!', '#8f8');
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, '+' + aiCount + ' ' + RANK_NAMES[rank], { color: '#8f8', size: 18 });

      checkForBooks(S.playerHand, S.playerBooks, 'You');
      refillHandIfEmpty(S.playerHand);
      if (checkGameEnd()) return;

      S.selectedCardIdx = -1;
      // Player's turn continues
    } else {
      setMessage('Go Fish!', '#f88');
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Go Fish!', { color: '#f88', size: 22 });

      const drawn = drawFromStock(S.playerHand);
      if (drawn) {
        checkForBooks(S.playerHand, S.playerBooks, 'You');
        refillHandIfEmpty(S.playerHand);
        if (checkGameEnd()) return;

        if (drawn.rank === rank) {
          setMessage('You drew a ' + rank + '! Your turn continues.', '#8f8');
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 30, 'Lucky draw!', { color: '#ff0', size: 16 });
          S.selectedCardIdx = -1;
          // Player's turn continues
          return;
        }
      }

      // End player turn, start AI turn
      S.selectedCardIdx = -1;
      S.isPlayerTurn = false;
      S.aiTurnTimer = 0;
      S.aiThinking = true;
      S.aiDrawnMatchedAsk = false;
    }
  }

  function sortHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return a.value - b.value;
    });
  }

  Object.assign(V, { removeCardsOfRank, checkForBooks, drawFromStock, setMessage, refillHandIfEmpty,
    checkGameEnd, playerAsksFor, sortHand });

})();
