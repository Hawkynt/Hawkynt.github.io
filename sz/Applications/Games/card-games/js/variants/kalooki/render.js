/* Kalooki drawing: table, cards and jokers, melds, the player hand, buttons, prompts and the round-over overlay. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.kalooki;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, INITIAL_MELD_MIN, PENALTY_LIMIT, PLAYER_NAMES,
    PHASE_DRAW, PHASE_MELD, PHASE_ROUND_OVER, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y, MELD_BTN,
    LAYOFF_BTN, DISCARD_BTN } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  const MELD_AREA_X = 280;
  const MELD_AREA_Y = 130;

  function drawCardAuto(cx, x, y, card, w, h) {
    if (!card.faceUp) {
      CE.drawCardBack(cx, x, y, w, h);
      return;
    }
    if (RC.isJoker(card))
      RC.drawJokerFace(cx, x, y, w, h);
    else
      CE.drawCardFace(cx, x, y, card, w, h);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawKalooki() {
    // Scores
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    for (let p = 0; p < NUM_PLAYERS; ++p)
      S._ctx.fillText(PLAYER_NAMES[p] + ': ' + S.cumulScores[p], 20, 18 + p * 18);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('First to ' + PENALTY_LIMIT + ' penalty loses', 20, 18 + NUM_PLAYERS * 18 + 4);

    if (S.phase === PHASE_ROUND_OVER) {
      drawRoundOver();
      return;
    }

    // AI hands (face down) at top
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const yOff = 80 + (p - 1) * 30;
      S._ctx.fillStyle = '#fff';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p] + ' (' + S.hands[p].length + ')', 280, yOff - 5);
      for (let i = 0; i < Math.min(S.hands[p].length, 13); ++i)
        CE.drawCardBack(S._ctx, 280 + i * 20, yOff, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }

    // Stock pile
    if (S.stockPile.length > 0)
      CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H);
    else {
      S._ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
    }
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('' + S.stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 14);
    S._ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 8);

    // Discard pile
    if (S.discardPile.length > 0)
      drawCardAuto(S._ctx, DISCARD_X, DISCARD_Y, S.discardPile[S.discardPile.length - 1], CE.CARD_W, CE.CARD_H);
    else {
      S._ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
    }
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 8);

    // Table melds
    drawTableMelds();

    // Player hand
    drawPlayerHand();

    // Buttons
    drawButtons();

    // Phase prompts
    drawPhasePrompt();
  }

  function drawTableMelds() {
    if (S.tableMelds.length === 0) return;
    S._ctx.fillStyle = '#aaf';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Table Melds:', MELD_AREA_X, MELD_AREA_Y - 8);

    let mx = MELD_AREA_X;
    let my = MELD_AREA_Y;
    for (let m = 0; m < S.tableMelds.length; ++m) {
      const meld = S.tableMelds[m];
      for (let c = 0; c < meld.cards.length; ++c) {
        drawCardAuto(S._ctx, mx, my, meld.cards[c], CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        mx += 32;
      }
      mx += 10;
      if (mx > CANVAS_W - 60) {
        mx = MELD_AREA_X;
        my += CE.CARD_H * 0.55 + 8;
      }
    }
  }

  function drawPlayerHand() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    const penVal = V.handPenalty(S.hands[0]);
    S._ctx.fillText('Your Hand (penalty: ' + penVal + ')', 30, 400);
    if (!S.hasMelded[0]) {
      S._ctx.fillStyle = '#f84';
      S._ctx.font = '11px sans-serif';
      S._ctx.fillText('Need ' + INITIAL_MELD_MIN + '+ to meld first', 250, 400);
    }

    const hand = S.hands[0];
    const spacing = Math.min(65, (CANVAS_W - 80) / Math.max(hand.length, 1));
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i]._dealing) continue;
      const x = 30 + i * spacing;
      const sel = S.selectedIndices.includes(i);
      const y = sel ? 408 : 418;
      drawCardAuto(S._ctx, x, y, hand[i], CE.CARD_W * 0.9, CE.CARD_H * 0.9);
      if (S._host && S._host.hintsEnabled && V.cardHasHint(hand, i))
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W * 0.9, CE.CARD_H * 0.9, S._host.hintTime);
      if (sel) {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 8;
        CE.drawRoundedRect(S._ctx, x - 1, y - 1, CE.CARD_W * 0.9 + 2, CE.CARD_H * 0.9 + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
  }

  function drawButtons() {
    if (S.currentPlayer !== 0) return;

    if (S.phase === PHASE_DRAW) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click Stock or Discard to draw', CANVAS_W / 2, 380);
      return;
    }

    if (S.phase === PHASE_MELD) {
      CE.drawButton(S._ctx, MELD_BTN.x, MELD_BTN.y, MELD_BTN.w, MELD_BTN.h, 'Meld', { bg: '#3a5a0a', border: '#8c8' });
      CE.drawButton(S._ctx, LAYOFF_BTN.x, LAYOFF_BTN.y, LAYOFF_BTN.w, LAYOFF_BTN.h, 'Lay Off', { bg: '#3a3a5a', border: '#88c' });
      CE.drawButton(S._ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#5a3a0a', border: '#cc8' });
    }
  }

  function drawPhasePrompt() {
    if (S.currentPlayer !== 0) {
      S._ctx.fillStyle = '#ff8';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(PLAYER_NAMES[S.currentPlayer] + ' is thinking...', CANVAS_W / 2, 380);
      return;
    }
    if (S.phase === PHASE_MELD) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Select cards to Meld/Lay Off, or pick one to Discard', CANVAS_W / 2, 375);
    }
  }

  function drawRoundOver() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Round Over', CANVAS_W / 2, 100);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const yBase = 140 + p * 110;
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.textAlign = 'left';
      const pen = V.handPenalty(S.hands[p]);
      S._ctx.fillText(PLAYER_NAMES[p] + ' penalty: ' + pen + (S.hands[p].length === 0 ? ' (OUT!)' : ''), 30, yBase);

      let rx = 30;
      for (let i = 0; i < S.hands[p].length; ++i) {
        S.hands[p][i].faceUp = true;
        drawCardAuto(S._ctx, rx, yBase + 10, S.hands[p][i], CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        rx += 34;
        if (rx > CANVAS_W - 60) {
          rx = 30;
          // no overflow expected for 9 cards
        }
      }
    }

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H - 40);

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '13px sans-serif';
    S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 18);
  }

  Object.assign(V, { drawKalooki });

})();
