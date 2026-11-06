/* Baccarat: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.baccarat;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_BETTING, PHASE_DRAWING, PHASE_RESULT, BET_PLAYER, BET_BANKER,
    BET_TIE, HAND_Y, PLAYER_HAND_X, BANKER_HAND_X, CARD_GAP, BET_ZONE_Y } = V;

  function createShoe() {
    const cards = [];
    for (let d = 0; d < 8; ++d) {
      const deck = CE.createDeck();
      for (const c of deck)
        cards.push(c);
    }
    return CE.shuffle(cards);
  }

  function drawFromShoe() {
    if (S.shoe.length < 6)
      S.shoe = createShoe();
    return S.shoe.pop();
  }

  function cardValue(card) {
    if (card.rank === 'A') return 1;
    const n = parseInt(card.rank, 10);
    if (!isNaN(n)) return n <= 9 ? n : 0;
    return 0; // J, Q, K
  }

  function handTotal(hand) {
    let sum = 0;
    for (const c of hand)
      sum += cardValue(c);
    return sum % 10;
  }

  function playerDrawsThird(total) {
    return total <= 5;
  }

  function bankerDrawsThird(bankerTotal, playerThirdValue) {
    if (playerThirdValue === null)
      return bankerTotal <= 5;
    if (bankerTotal <= 2) return true;
    if (bankerTotal === 3) return playerThirdValue !== 8;
    if (bankerTotal === 4) return playerThirdValue >= 2 && playerThirdValue <= 7;
    if (bankerTotal === 5) return playerThirdValue >= 4 && playerThirdValue <= 7;
    if (bankerTotal === 6) return playerThirdValue === 6 || playerThirdValue === 7;
    return false; // 7 stands
  }

  function placeBet(target) {
    if (S.phase !== PHASE_BETTING) return;
    if (S.selectedChip > S.score) return;
    if (S.betTarget && S.betTarget !== target) {
      S.betAmount = 0;
    }
    S.betTarget = target;
    S.betAmount += S.selectedChip;
    if (S.betAmount > S.score)
      S.betAmount = S.score;
  }

  function clearBet() {
    S.betTarget = null;
    S.betAmount = 0;
  }

  function checkNaturalOrDraw() {
    const pTotal = handTotal(S.playerHand);
    const bTotal = handTotal(S.bankerHand);

    // Natural
    if (pTotal >= 8 || bTotal >= 8) {
      resolveRound();
      return;
    }

    S.phase = PHASE_DRAWING;
    S.drawStep = 0;
    S.drawTimer = 0;
  }

  function applyThirdCards() {
    const pTotal = handTotal(S.playerHand);
    const bTotal = handTotal(S.bankerHand);
    let playerThirdVal = null;

    // Player third card
    if (S.drawStep === 0) {
      if (playerDrawsThird(pTotal)) {
        const card = drawFromShoe();
        card.faceUp = true;
        S.playerHand.push(card);
        playerThirdVal = cardValue(card);
        if (S._host)
          S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, PLAYER_HAND_X + 2 * (CE.CARD_W + CARD_GAP), HAND_Y, 0);
        ++S.drawStep;
        return; // wait for next tick for banker
      }
      ++S.drawStep; // skip player draw, go to banker
    }

    // Banker third card
    if (S.drawStep === 1) {
      if (S.playerHand.length === 3)
        playerThirdVal = cardValue(S.playerHand[2]);
      if (bankerDrawsThird(bTotal, playerThirdVal)) {
        const card = drawFromShoe();
        card.faceUp = true;
        S.bankerHand.push(card);
        if (S._host)
          S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, BANKER_HAND_X + 2 * (CE.CARD_W + CARD_GAP), HAND_Y, 0);
      }
      ++S.drawStep;
      return;
    }

    resolveRound();
  }

  function resolveRound() {
    S.phase = PHASE_RESULT;
    const pTotal = handTotal(S.playerHand);
    const bTotal = handTotal(S.bankerHand);

    let winner;
    if (pTotal > bTotal)
      winner = BET_PLAYER;
    else if (bTotal > pTotal)
      winner = BET_BANKER;
    else
      winner = BET_TIE;

    let payout = 0;
    if (winner === S.betTarget) {
      if (S.betTarget === BET_PLAYER)
        payout = S.betAmount;
      else if (S.betTarget === BET_BANKER)
        payout = Math.floor(S.betAmount * 0.95);
      else
        payout = S.betAmount * 8;
      S.score += payout;
      S.resultMsg = winnerLabel(winner) + ' wins! +' + payout;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 170, S.resultMsg, { color: '#4f4', size: 24 });
        S._host.addGlow(
          winner === BET_BANKER ? BANKER_HAND_X : PLAYER_HAND_X,
          HAND_Y,
          (winner === BET_TIE ? 3 : Math.max(S.playerHand.length, S.bankerHand.length)) * (CE.CARD_W + CARD_GAP),
          CE.CARD_H, 2.0
        );
        S._host.triggerChipSparkle(CANVAS_W / 2, BET_ZONE_Y);
        S._host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else {
      S.score -= S.betAmount;
      S.resultMsg = winnerLabel(winner) + ' wins. -' + S.betAmount;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 170, S.resultMsg, { color: '#f44', size: 24 });
        S._host.screenShake.trigger(6, 300);
      }
    }

    S.roundOver = true;
    if (S.score <= 0) {
      S.score = 0;
      S.gameOver = true;
      S.resultMsg = 'GAME OVER';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function winnerLabel(w) {
    if (w === BET_PLAYER) return 'Player';
    if (w === BET_BANKER) return 'Banker';
    return 'Tie';
  }

  Object.assign(V, { createShoe, drawFromShoe, handTotal, placeBet, clearBet, checkNaturalOrDraw,
    applyThirdCards });

})();
