/* Red Dog: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.reddog;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_BET, PHASE_SHOW_POSTS, PHASE_RESULT, POST_Y, LEFT_POST_X,
    RIGHT_POST_X, MIDDLE_CARD_X, MIDDLE_CARD_Y } = V;

  function rankIndex(card) {
    return card.value;
  }

  // Ensure low <= high; returns [lowCard, highCard]
  function orderPosts(a, b) {
    return rankIndex(a) <= rankIndex(b) ? [a, b] : [b, a];
  }

  function computeSpread(low, high) {
    return rankIndex(high) - rankIndex(low) - 1;
  }

  function payoutForSpread(s) {
    if (s === 1) return 5;
    if (s === 2) return 4;
    if (s === 3) return 2;
    if (s >= 4) return 1;
    return 0;
  }

  // Win probability = spread / remaining-cards-that-could-appear
  // With a single deck of 52 cards, 2 are dealt as posts, 50 remain.
  // Exactly `spread * 4` cards fall strictly between the posts,
  // minus any suits where the boundary ranks are used.
  function computeWinProbability(low, high, deckSize) {
    const s = computeSpread(low, high);
    if (s <= 0) return 0;
    // Number of ranks strictly between low and high
    // Each rank has 4 cards in a fresh deck, but 2 cards are already dealt.
    // Remaining = deckSize (cards left after drawing 2 posts).
    // Winning cards = s * 4 (each in-between rank has 4 suits in the original deck)
    // However both post cards are removed, so we need to check if any winning rank
    // shares a rank with a post card -- they don't, since they are strictly between.
    const winningCards = s * 4;
    return winningCards / deckSize;
  }

  function maxBet() {
    return Math.min(S.score, 100);
  }

  function adjustBet(amount) {
    if (S.phase !== PHASE_BET) return;
    S.betAmount = Math.max(10, Math.min(S.betAmount + amount, maxBet()));
  }

  function clearBet() {
    S.betAmount = 0;
  }

  function playerCall() {
    if (S.phase !== PHASE_SHOW_POSTS) return;
    // Consecutive => auto-resolve as push
    if (S.spread === 0 && rankIndex(S.postCards[0]) !== rankIndex(S.postCards[1])) {
      resolvePush();
      return;
    }
    S.raisedBet = 0;
    V.drawMiddleCard();
  }

  function playerRaise() {
    if (S.phase !== PHASE_SHOW_POSTS) return;
    if (S.spread <= 0 && rankIndex(S.postCards[0]) !== rankIndex(S.postCards[1])) {
      resolvePush();
      return;
    }
    // Raise doubles the bet (up to what the player can afford)
    const raiseMax = Math.min(S.betAmount, S.score - S.betAmount);
    S.raisedBet = Math.max(0, raiseMax);
    V.drawMiddleCard();
  }

  function resolvePush() {
    S.phase = PHASE_RESULT;
    S.roundOver = true;
    S.resultMsg = 'Consecutive - Push! Bet returned.';
    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, 350, 'PUSH', { color: '#ff8', size: 24 });
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function resolveRound() {
    S.phase = PHASE_RESULT;
    S.roundOver = true;
    const totalBet = S.betAmount + S.raisedBet;
    const lowRank = rankIndex(S.postCards[0]);
    const highRank = rankIndex(S.postCards[1]);
    const midRank = rankIndex(S.middleCard);

    if (lowRank === highRank) {
      // Pair case
      if (midRank === lowRank) {
        // Three of a kind: 11:1 payout
        const payout = totalBet * 11;
        S.score += payout;
        S.resultMsg = 'Three of a kind! +' + payout;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 350, 'THREE OF A KIND! +' + payout, { color: '#4f4', size: 28 });
          S._host.addGlow(LEFT_POST_X, POST_Y, RIGHT_POST_X + CE.CARD_W - LEFT_POST_X, CE.CARD_H, 2.0);
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
          S._host.particles.confetti(CANVAS_W / 2, 300, 50);
        }
      } else {
        // Pair but no match: push
        S.resultMsg = 'Pair - Push! Bet returned.';
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 350, 'PUSH', { color: '#ff8', size: 24 });
      }
    } else if (midRank > lowRank && midRank < highRank) {
      // Win: card falls between the posts
      const payout = totalBet * S.payoutMultiplier;
      S.score += payout;
      S.resultMsg = 'Win! Spread ' + S.spread + ' pays ' + S.payoutMultiplier + ':1  +' + payout;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 350, 'WIN! +' + payout, { color: '#4f4', size: 28 });
        S._host.addGlow(MIDDLE_CARD_X, MIDDLE_CARD_Y + CE.CARD_H + 30, CE.CARD_W, CE.CARD_H, 2.0);
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        S._host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else {
      // Lose: card outside the spread
      S.score -= totalBet;
      S.resultMsg = 'Lose! -' + totalBet;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 350, 'LOSE -' + totalBet, { color: '#f44', size: 24 });
        S._host.screenShake.trigger(6, 300);
      }
    }

    if (S.score <= 0) {
      S.score = 0;
      S.gameOver = true;
      S.resultMsg = 'GAME OVER';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    if (S._host) S._host.onScoreChanged(S.score);
  }

  Object.assign(V, { rankIndex, orderPosts, computeSpread, payoutForSpread, computeWinProbability,
    maxBet, adjustBet, clearBet, playerCall, playerRaise, resolveRound });

})();
