/* Red Dog: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const CHIP = SZ.CardGames.shared.casinoChips;
  const V = SZ.CardGames.v.reddog;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_BET, PHASE_SHOW_POSTS, POST_Y, LEFT_POST_X, RIGHT_POST_X,
    MIDDLE_CARD_X, MIDDLE_CARD_Y, CHIP_BTN_Y, DEAL_BTN, RAISE_BTN, CALL_BTN } = V;

  function drawMiddleCard() {
    const card = S.deck.pop();
    card.faceUp = true;
    S.middleCard = card;

    if (S._host)
      S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, MIDDLE_CARD_X, MIDDLE_CARD_Y + CE.CARD_H + 30, 0);

    V.resolveRound();
  }

  function drawRedDog() {
    // Title
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Red Dog (In-Between)', CANVAS_W / 2, 35);

    // Chips & deck count (top right)
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Chips: ' + S.score, CANVAS_W - 40, 60);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Deck: ' + S.deck.length, CANVAS_W - 40, 78);

    // Bet display (top left)
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Bet: ' + S.betAmount + (S.raisedBet > 0 ? ' + ' + S.raisedBet + ' raise' : ''), 40, 60);

    // Post card labels
    S._ctx.fillStyle = '#cdf';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Low Post', LEFT_POST_X + CE.CARD_W / 2, POST_Y - 14);
    S._ctx.fillText('High Post', RIGHT_POST_X + CE.CARD_W / 2, POST_Y - 14);

    // Draw post cards
    if (S.postCards.length === 2) {
      for (let i = 0; i < 2; ++i) {
        if (S.postCards[i]._dealing) continue;
        const x = i === 0 ? LEFT_POST_X : RIGHT_POST_X;
        CE.drawCardFace(S._ctx, x, POST_Y, S.postCards[i]);
      }
    } else {
      CE.drawEmptySlot(S._ctx, LEFT_POST_X, POST_Y);
      CE.drawEmptySlot(S._ctx, RIGHT_POST_X, POST_Y);
    }

    // Middle card area
    S._ctx.fillStyle = '#cdf';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Draw Card', MIDDLE_CARD_X + CE.CARD_W / 2, MIDDLE_CARD_Y + CE.CARD_H + 16);
    if (S.middleCard) {
      if (!S.middleCard._dealing)
        CE.drawCardFace(S._ctx, MIDDLE_CARD_X, MIDDLE_CARD_Y + CE.CARD_H + 30, S.middleCard);
    } else if (S.phase !== PHASE_BET) {
      CE.drawEmptySlot(S._ctx, MIDDLE_CARD_X, MIDDLE_CARD_Y + CE.CARD_H + 30);
    }

    // Spread info
    if (S.phase === PHASE_SHOW_POSTS && S.postCards.length === 2) {
      const isPair = V.rankIndex(S.postCards[0]) === V.rankIndex(S.postCards[1]);
      const isConsecutive = !isPair && S.spread === 0;

      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 20px sans-serif';
      S._ctx.textAlign = 'center';

      if (isPair) {
        S._ctx.fillText('PAIR! Drawing third card...', CANVAS_W / 2, POST_Y + CE.CARD_H + 50);
        S._ctx.fillStyle = '#aaf';
        S._ctx.font = '14px sans-serif';
        S._ctx.fillText('Match = 11:1 payout, No match = Push', CANVAS_W / 2, POST_Y + CE.CARD_H + 72);
      } else if (isConsecutive) {
        S._ctx.fillText('CONSECUTIVE - Push!', CANVAS_W / 2, POST_Y + CE.CARD_H + 50);
      } else {
        S._ctx.fillText('Spread: ' + S.spread + '  |  Payout: ' + S.payoutMultiplier + ':1', CANVAS_W / 2, POST_Y + CE.CARD_H + 50);

        // Win probability
        const prob = V.computeWinProbability(S.postCards[0], S.postCards[1], S.deck.length);
        const pct = (prob * 100).toFixed(1);
        S._ctx.fillStyle = '#aaf';
        S._ctx.font = '14px sans-serif';
        S._ctx.fillText('Win chance: ' + pct + '%', CANVAS_W / 2, POST_Y + CE.CARD_H + 72);
      }

      // Hint display
      if (S._host && S._host.hintsEnabled && !isPair && !isConsecutive) {
        const prob = V.computeWinProbability(S.postCards[0], S.postCards[1], S.deck.length);
        const ev = prob * S.payoutMultiplier - (1 - prob);
        const recommendation = ev > 0 ? 'Raise recommended (EV+)' : 'Call recommended (EV-)';
        S._ctx.fillStyle = '#8f8';
        S._ctx.font = '13px sans-serif';
        S._ctx.textAlign = 'center';
        if (S._host.hintTime)
          CE.drawHintGlow(S._ctx, CANVAS_W / 2 - 120, POST_Y + CE.CARD_H + 78, 240, 20, S._host.hintTime);
        S._ctx.fillText('Hint: EV=' + ev.toFixed(2) + ' | ' + recommendation, CANVAS_W / 2, POST_Y + CE.CARD_H + 92);
      }
    }

    // Result message
    if (S.resultMsg) {
      S._ctx.fillStyle = '#ff8';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H - 30);
      if (S.roundOver && !S.gameOver) {
        S._ctx.fillStyle = '#aaa';
        S._ctx.font = '13px sans-serif';
        S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 10);
      }
    }

    // Action buttons for SHOW_POSTS phase (when there's a real spread to bet on)
    if (S.phase === PHASE_SHOW_POSTS && S.postCards.length === 2) {
      const isPair = V.rankIndex(S.postCards[0]) === V.rankIndex(S.postCards[1]);
      const isConsecutive = !isPair && S.spread === 0;

      if (isPair) {
        // Auto-draw for pair: show a single "Draw" button
        CE.drawButton(S._ctx, CANVAS_W / 2 - 55, 460, 110, 36, 'Draw (D)', { bg: '#2a5a2a', border: '#6c6' });
      } else if (isConsecutive) {
        // Consecutive: just a continue button
        CE.drawButton(S._ctx, CANVAS_W / 2 - 55, 460, 110, 36, 'Continue', { bg: '#555', border: '#888' });
      } else {
        // Normal spread: raise or call
        const canRaise = S.score > S.betAmount;
        CE.drawButton(S._ctx, RAISE_BTN.x, RAISE_BTN.y, RAISE_BTN.w, RAISE_BTN.h, 'Raise (R)', {
          bg: canRaise ? '#2a5a2a' : '#333',
          border: canRaise ? '#6c6' : '#555'
        });
        CE.drawButton(S._ctx, CALL_BTN.x, CALL_BTN.y, CALL_BTN.w, CALL_BTN.h, 'Call (C)', { bg: '#5a5a2a', border: '#cc6' });
      }
    }

    // Betting area
    if (S.phase === PHASE_BET)
      drawBettingArea();
  }

  function drawBettingArea() {
    // Payout table
    S._ctx.fillStyle = '#ccc';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Payout Table', CANVAS_W / 2, 110);

    const payouts = [
      ['Spread 1', '5 : 1'],
      ['Spread 2', '4 : 1'],
      ['Spread 3', '2 : 1'],
      ['Spread 4+', '1 : 1'],
      ['Pair + Match', '11 : 1'],
      ['Consecutive / Pair', 'Push']
    ];

    S._ctx.font = '12px monospace';
    for (let i = 0; i < payouts.length; ++i) {
      const y = 132 + i * 18;
      S._ctx.fillStyle = '#aaa';
      S._ctx.textAlign = 'right';
      S._ctx.fillText(payouts[i][0], CANVAS_W / 2 - 10, y);
      S._ctx.fillStyle = '#fc0';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(payouts[i][1], CANVAS_W / 2 + 10, y);
    }

    // Bet amount display
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Bet: $' + S.betAmount, CANVAS_W / 2, 270);
    S._ctx.fillStyle = '#888';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Min: 10  |  Max: ' + V.maxBet(), CANVAS_W / 2, 290);

    // Chip selector buttons
    CHIP.drawChipButtons(S._ctx, CHIP_BTN_Y, S.selectedChip);

    // + / - bet buttons
    const minusBtnX = CANVAS_W / 2 - 120;
    const plusBtnX = CANVAS_W / 2 + 70;
    CE.drawButton(S._ctx, minusBtnX, 310, 50, 30, '-', { bg: '#5a2a2a', border: '#c66', fontSize: 16 });
    CE.drawButton(S._ctx, plusBtnX, 310, 50, 30, '+', { bg: '#2a5a2a', border: '#6c6', fontSize: 16 });

    // Deal button
    const canDeal = S.betAmount >= 10 && S.betAmount <= S.score;
    CE.drawButton(
      S._ctx, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h,
      'Deal (D)',
      { bg: canDeal ? '#2a5a2a' : '#333', border: canDeal ? '#6c6' : '#555', fontSize: 14 }
    );

    // Clear button
    if (S.betAmount > 0) {
      const clearX = DEAL_BTN.x + DEAL_BTN.w + 15;
      CE.drawButton(S._ctx, clearX, DEAL_BTN.y, 70, DEAL_BTN.h, 'Clear', { bg: '#5a2a2a', border: '#c66', fontSize: 12 });
    }

    // Instructions
    S._ctx.fillStyle = '#888';
    S._ctx.font = '13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Set your bet, then Deal', CANVAS_W / 2, 370);
  }

  Object.assign(V, { drawMiddleCard, drawRedDog });

})();
