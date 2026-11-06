/* Old Maid: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.oldmaid;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_PLAYER_DRAW, PHASE_DISCARD_ANIM, PHASE_GAME_OVER,
    PAIR_REMOVE_DELAY, DISCARD_ANIM_DELAY } = V;

  function isTheOldMaid(card) {
    return card.rank === 'Q' && card.suit === 'spades';
  }

  function sortHand(hand) {
    const rankOrder = {};
    for (let i = 0; i < CE.RANKS.length; ++i)
      rankOrder[CE.RANKS[i]] = i;
    const suitOrder = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };
    hand.sort((a, b) => {
      const rd = rankOrder[a.rank] - rankOrder[b.rank];
      if (rd !== 0) return rd;
      return suitOrder[a.suit] - suitOrder[b.suit];
    });
  }

  function findPairInHand(hand) {
    for (let i = 0; i < hand.length; ++i)
      for (let j = i + 1; j < hand.length; ++j)
        if (hand[i].rank === hand[j].rank)
          return [i, j];
    return null;
  }

  function removePairFromHand(hand, i, j) {
    const hi = Math.max(i, j);
    const lo = Math.min(i, j);
    const cards = [hand[hi], hand[lo]];
    hand.splice(hi, 1);
    hand.splice(lo, 1);
    return cards;
  }

  function createOldMaidDeck() {
    const deck = [];
    for (const suit of CE.SUITS)
      for (const rank of CE.RANKS)
        deck.push({ suit, rank, faceUp: false });

    // Remove the Queen of Diamonds (leaving Q of Spades as the Old Maid)
    const qIdx = deck.findIndex(c => c.rank === 'Q' && c.suit === 'diamonds');
    if (qIdx >= 0) deck.splice(qIdx, 1);
    return deck;
  }

  function refreshAiDrawableOrder() {
    S.aiDrawableOrder = [];
    for (let i = 0; i < S.aiHand.length; ++i)
      S.aiDrawableOrder.push(i);
    CE.shuffle(S.aiDrawableOrder);
  }

  function buildPairRemoveQueue() {
    S.pairRemoveQueue = [];

    // Find all pairs in player hand
    const playerUsed = new Set();
    for (let i = 0; i < S.playerHand.length; ++i) {
      if (playerUsed.has(i)) continue;
      for (let j = i + 1; j < S.playerHand.length; ++j) {
        if (playerUsed.has(j)) continue;
        if (S.playerHand[i].rank === S.playerHand[j].rank) {
          S.pairRemoveQueue.push({ who: 'player', i, j });
          playerUsed.add(i);
          playerUsed.add(j);
          break;
        }
      }
    }

    // Find all pairs in AI hand
    const aiUsed = new Set();
    for (let i = 0; i < S.aiHand.length; ++i) {
      if (aiUsed.has(i)) continue;
      for (let j = i + 1; j < S.aiHand.length; ++j) {
        if (aiUsed.has(j)) continue;
        if (S.aiHand[i].rank === S.aiHand[j].rank) {
          S.pairRemoveQueue.push({ who: 'ai', i, j });
          aiUsed.add(i);
          aiUsed.add(j);
          break;
        }
      }
    }
  }

  function processNextPairRemoval() {
    if (S.pairRemoveQueue.length === 0) {
      // All initial pairs removed, start drawing phase
      sortHand(S.playerHand);
      sortHand(S.aiHand);
      refreshAiDrawableOrder();
      V.startDrawingPhase();
      return;
    }

    const item = S.pairRemoveQueue.shift();
    let pair;
    if (item.who === 'player') {
      // Re-find a pair in player hand (indices may have shifted)
      const pairIdx = findPairInHand(S.playerHand);
      if (!pairIdx) {
        processNextPairRemoval();
        return;
      }
      pair = removePairFromHand(S.playerHand, pairIdx[0], pairIdx[1]);
      S.playerPairs.push(pair);
      S.lastDiscardedPair = pair;
      S.lastDiscardedBy = 'You';
    } else {
      const pairIdx = findPairInHand(S.aiHand);
      if (!pairIdx) {
        processNextPairRemoval();
        return;
      }
      pair = removePairFromHand(S.aiHand, pairIdx[0], pairIdx[1]);
      S.aiPairs.push(pair);
      S.lastDiscardedPair = pair;
      S.lastDiscardedBy = 'AI';
    }

    if (S._host) {
      const label = S.lastDiscardedBy + ': Pair of ' + pair[0].rank + 's!';
      S._host.floatingText.add(CANVAS_W / 2, 280, label, { color: '#ff0', size: 16 });
    }

    S.pairRemoveTimer = PAIR_REMOVE_DELAY;
  }

  function playerDrawCard(cardIdx) {
    if (S.phase !== PHASE_PLAYER_DRAW) return;
    if (cardIdx < 0 || cardIdx >= S.aiHand.length) return;

    const card = S.aiHand.splice(cardIdx, 1)[0];
    card.faceUp = true;
    S.playerHand.push(card);

    if (S._host) {
      const fromX = V.aiDrawCardX(S.aiDrawableOrder.indexOf(cardIdx), S.aiDrawableOrder.length);
      S._host.dealCardAnim(card, fromX, 80, V.playerCardX(S.playerHand.length - 1, S.playerHand.length), CANVAS_H - CE.CARD_H - 20, 0);
    }

    // Check for new pair
    const newPairIdx = findMatchInHand(S.playerHand, card);
    if (newPairIdx >= 0) {
      const pairCard = S.playerHand.splice(newPairIdx, 1)[0];
      const drawnCard = S.playerHand.splice(S.playerHand.indexOf(card), 1)[0];
      if (drawnCard)
        S.playerPairs.push([pairCard, drawnCard]);
      else
        S.playerPairs.push([pairCard, card]);

      S.lastDiscardedPair = S.playerPairs[S.playerPairs.length - 1];
      S.lastDiscardedBy = 'You';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 380, 'Pair of ' + card.rank + 's!', { color: '#4f4', size: 18 });

      S.phase = PHASE_DISCARD_ANIM;
      S.discardAnimTimer = DISCARD_ANIM_DELAY;
    } else {
      sortHand(S.playerHand);
      V.finishPlayerTurn();
    }
  }

  function findMatchInHand(hand, card) {
    for (let i = 0; i < hand.length; ++i)
      if (hand[i] !== card && hand[i].rank === card.rank)
        return i;
    return -1;
  }

  function checkGameEnd() {
    // Game ends when all pairs are discarded: one player holds the lone Queen
    const totalCards = S.playerHand.length + S.aiHand.length;

    if (totalCards <= 1) {
      S.phase = PHASE_GAME_OVER;
      S.roundOver = true;

      const playerHasOldMaid = S.playerHand.some(c => isTheOldMaid(c));
      const aiHasOldMaid = S.aiHand.some(c => isTheOldMaid(c));

      if (playerHasOldMaid) {
        S.score = 0;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 260, 'You are the Old Maid!', { color: '#f44', size: 28 });
          S._host.screenShake.trigger(10, 500);
        }
        S.gameOver = false;
      } else if (aiHasOldMaid) {
        S.score = 100;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 260, 'AI is the Old Maid! You win!', { color: '#4f4', size: 28 });
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
        S.gameOver = false;
      } else {
        // Edge case: no cards left at all (shouldn't happen but handle gracefully)
        S.score = 50;
        S.gameOver = false;
      }

      if (S._host) S._host.onScoreChanged(S.score);
      return true;
    }

    // Check if one player ran out of cards (skip their turn)
    if (S.playerHand.length === 0 && S.aiHand.length === 1) {
      // AI is stuck with the old maid
      S.phase = PHASE_GAME_OVER;
      S.roundOver = true;
      S.score = 100;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 260, 'AI is the Old Maid! You win!', { color: '#4f4', size: 28 });
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        S._host.onScoreChanged(S.score);
      }
      return true;
    }

    if (S.aiHand.length === 0 && S.playerHand.length === 1) {
      S.phase = PHASE_GAME_OVER;
      S.roundOver = true;
      S.score = 0;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 260, 'You are the Old Maid!', { color: '#f44', size: 28 });
        S._host.screenShake.trigger(10, 500);
        S._host.onScoreChanged(S.score);
      }
      return true;
    }

    return false;
  }

  Object.assign(V, { isTheOldMaid, sortHand, createOldMaidDeck, refreshAiDrawableOrder,
    buildPairRemoveQueue, processNextPairRemoval, playerDrawCard, findMatchInHand, checkGameEnd });

})();
