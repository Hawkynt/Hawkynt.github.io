/* Gin Rummy round flow: dealing, draws, discards, knocking and knock/gin resolution with lay-offs. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ginrummy;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_PLAYER_DRAW, PHASE_PLAYER_DISCARD, PHASE_AI_THINKING,
    PHASE_ROUND_REVEAL, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  /* ══════════════════════════════════════════════════════════════════
     ROUND RESOLUTION
     ══════════════════════════════════════════════════════════════════ */

  function resolveKnock(knockerIdx) {
    S.knocker = knockerIdx;
    const pResult = V.findBestMelds(S.playerHand);
    const aResult = V.findBestMelds(S.aiHand);

    S.playerMelds = pResult.melds;
    S.playerDeadwood = pResult.deadwood;
    S.aiMelds = aResult.melds;
    S.aiDeadwood = aResult.deadwood;
    S.layoffCards = [];

    let knockerDW, defenderDW;
    let knockerMelds;

    if (knockerIdx === 0) {
      knockerDW = pResult.deadwoodValue;
      defenderDW = aResult.deadwoodValue;
      knockerMelds = S.playerMelds;
      S.isGin = knockerDW === 0;

      // AI lays off on player melds (unless gin)
      if (!S.isGin) {
        const remainingDeadwood = [];
        for (const card of S.aiDeadwood) {
          if (V.canLayOff(card, knockerMelds)) {
            S.layoffCards.push(card);
            defenderDW -= RC.cardValue(card);
          } else
            remainingDeadwood.push(card);
        }
        S.aiDeadwood = remainingDeadwood;
      }
    } else {
      knockerDW = aResult.deadwoodValue;
      defenderDW = pResult.deadwoodValue;
      knockerMelds = S.aiMelds;
      S.isGin = knockerDW === 0;

      // Player lays off on AI melds (automatic for simplicity)
      if (!S.isGin) {
        const remainingDeadwood = [];
        for (const card of S.playerDeadwood) {
          if (V.canLayOff(card, knockerMelds)) {
            S.layoffCards.push(card);
            defenderDW -= RC.cardValue(card);
          } else
            remainingDeadwood.push(card);
        }
        S.playerDeadwood = remainingDeadwood;
      }
    }

    // Scoring
    let roundPoints = 0;
    let winnerIdx;

    if (S.isGin) {
      // Gin bonus: 25 + opponent's deadwood
      roundPoints = 25 + defenderDW;
      winnerIdx = knockerIdx;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'GIN!', { color: '#ff0', size: 32 });
    } else if (knockerDW < defenderDW) {
      // Normal knock: difference in deadwood
      roundPoints = defenderDW - knockerDW;
      winnerIdx = knockerIdx;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'Knock!', { color: '#4f4', size: 24 });
    } else {
      // Undercut: defender gets 25 + difference
      roundPoints = 25 + (knockerDW - defenderDW);
      winnerIdx = knockerIdx === 0 ? 1 : 0;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'Undercut!', { color: '#f84', size: 26 });
    }

    if (winnerIdx === 0) {
      S.score += roundPoints;
      S.resultMsg = 'You score ' + roundPoints + ' points!';
      if (S._host) {
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        S._host.particles.confetti(CANVAS_W / 2, 300, 20);
      }
    } else {
      S.aiScore += roundPoints;
      S.resultMsg = 'AI scores ' + roundPoints + ' points.';
      if (S._host) S._host.screenShake.trigger(6, 300);
    }

    if (S._host) S._host.onScoreChanged(S.score);

    // Check game over at 100
    if (S.score >= 100) {
      S.gameOver = true;
      S.resultMsg = 'You win the game! Final: ' + S.score + ' - ' + S.aiScore;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
    } else if (S.aiScore >= 100) {
      S.gameOver = true;
      S.resultMsg = 'AI wins the game! Final: ' + S.aiScore + ' - ' + S.score;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }

    S.roundOver = true;
    S.phase = PHASE_ROUND_REVEAL;
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupGinRummy() {
    const deck = CE.shuffle(CE.createDeck());
    S.playerHand = [];
    S.aiHand = [];
    S.discardPile = [];
    S.stockPile = [];
    S.roundOver = false;
    S.phase = PHASE_PLAYER_DRAW;
    S.selectedCardIndex = -1;
    S.resultMsg = '';
    S.knocker = -1;
    S.isGin = false;
    S.playerMelds = [];
    S.aiMelds = [];
    S.playerDeadwood = [];
    S.aiDeadwood = [];
    S.layoffCards = [];
    S.aiTimer = 0;
    S.aiDrawn = false;

    // Deal 10 cards each
    for (let i = 0; i < 10; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      S.playerHand.push(pc);
      if (S._host) S._host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, 90 + i * 68, 460, i * 0.08);
      const ac = deck.pop();
      S.aiHand.push(ac);
    }

    // Turn one card face-up for discard
    const top = deck.pop();
    top.faceUp = true;
    S.discardPile.push(top);

    // Rest is stock
    S.stockPile = deck;
    RC.sortHand(S.playerHand);
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function playerDrawStock() {
    if (S.stockPile.length === 0) {
      // Reshuffle discard into stock, keep top card
      if (S.discardPile.length <= 1) return;
      const top = S.discardPile.pop();
      S.stockPile = CE.shuffle(S.discardPile);
      S.discardPile = [top];
    }
    const card = S.stockPile.pop();
    card.faceUp = true;
    S.playerHand.push(card);
    if (S._host) S._host.dealCardAnim(card, STOCK_X, STOCK_Y, 90 + (S.playerHand.length - 1) * 68, 460, 0);
    S.phase = PHASE_PLAYER_DISCARD;
    S.selectedCardIndex = -1;
  }

  function playerDrawDiscard() {
    if (S.discardPile.length === 0) return;
    const card = S.discardPile.pop();
    card.faceUp = true;
    S.playerHand.push(card);
    if (S._host) S._host.dealCardAnim(card, DISCARD_X, DISCARD_Y, 90 + (S.playerHand.length - 1) * 68, 460, 0);
    S.phase = PHASE_PLAYER_DISCARD;
    S.selectedCardIndex = -1;
  }

  function playerDiscard(index) {
    if (index < 0 || index >= S.playerHand.length) return;
    const card = S.playerHand.splice(index, 1)[0];
    card.faceUp = true;
    S.discardPile.push(card);
    S.selectedCardIndex = -1;
    RC.sortHand(S.playerHand);
    // Now AI's turn
    S.phase = PHASE_AI_THINKING;
    S.aiTimer = 0;
    S.aiDrawn = false;
  }

  function playerKnock() {
    if (S.playerHand.length !== 11) return;
    // Must discard first, then knock -- but we allow knock during discard phase
    // If hand has 11 cards, we need to discard one first
    // Actually, the knock should happen after the hand is at 10 cards
    // So: select a card to discard, then knock with remaining 10

    // For simplicity: if selectedCardIndex is set, discard that card then knock
    if (S.selectedCardIndex >= 0) {
      const card = S.playerHand.splice(S.selectedCardIndex, 1)[0];
      card.faceUp = true;
      S.discardPile.push(card);
      S.selectedCardIndex = -1;
      RC.sortHand(S.playerHand);
      resolveKnock(0);
    }
  }

  Object.assign(V, { resolveKnock, playerDrawStock, playerDrawDiscard, playerKnock, playerDiscard,
    setupGinRummy });

})();
