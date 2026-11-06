/* Yaniv drawing: table, score panel, opponent hands, piles, the player hand, prompts and reveal/round-over overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.yaniv;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, YANIV_THRESHOLD, ELIMINATION_SCORE, PLAYER_NAMES,
    PHASE_DISCARD, PHASE_DRAW, PHASE_AI_THINKING, PHASE_YANIV_REVEAL, PHASE_ROUND_OVER, STOCK_X,
    STOCK_Y, DISCARD_X, DISCARD_Y, PLAYER_HAND_Y, DISCARD_BTN, YANIV_BTN, REVEAL_DELAY } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  /* Positions for AI hands around the table */
  function aiHandPosition(playerIdx) {
    // Player 0 = bottom (human), 1 = left, 2 = top, 3 = right
    switch (playerIdx) {
      case 1: return { x: 20, y: 180, horizontal: false };   // left, vertical fan
      case 2: return { x: 280, y: 12, horizontal: true };    // top, horizontal fan
      case 3: return { x: CANVAS_W - 70, y: 180, horizontal: false }; // right, vertical fan
      default: return { x: 0, y: 0, horizontal: true };
    }
  }

  /* ================================================================
     DRAWING - JOKER CARD
     ================================================================ */

  function drawJokerCard(x, y, card, w, h) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    CE.drawRoundedRect(S._ctx, x, y, cw, ch, cr);
    S._ctx.fillStyle = '#fff';
    S._ctx.fill();
    S._ctx.strokeStyle = '#333';
    S._ctx.lineWidth = 1;
    S._ctx.stroke();

    const ss = Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    S._ctx.fillStyle = '#d00';
    S._ctx.font = 'bold ' + Math.round(11 * ss) + 'px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('\u2605', x + cw / 2, y + ch * 0.3);
    S._ctx.font = 'bold ' + Math.round(14 * ss) + 'px serif';
    S._ctx.fillText('JK', x + cw / 2, y + ch * 0.55);
    S._ctx.font = Math.round(9 * ss) + 'px sans-serif';
    S._ctx.fillText('\u2605', x + cw / 2, y + ch * 0.75);
  }

  function drawAnyCard(x, y, card, w, h) {
    if (card.suit === 'joker')
      drawJokerCard(x, y, card, w, h);
    else
      CE.drawCardFace(S._ctx, x, y, card, w, h);
  }

  /* ================================================================
     DRAWING - MAIN
     ================================================================ */

  function drawYaniv() {
    // Score panel top-right
    drawScorePanel();

    if (S.phase === PHASE_ROUND_OVER) {
      drawRoundOver();
      return;
    }

    if (S.phase === PHASE_YANIV_REVEAL) {
      drawYanivReveal();
      return;
    }

    // AI hands
    for (let p = 1; p < NUM_PLAYERS; ++p)
      drawAIHand(p);

    // Stock pile
    drawStockPile();

    // Discard pile (group)
    drawDiscardGroup();

    // Action buttons
    if (S.currentPlayer === 0 && !S.roundOver && !S.gameOver) {
      if (S.phase === PHASE_DISCARD) {
        if (S.selectedIndices.length > 0) {
          const cards = S.selectedIndices.map(i => S.hands[0][i]);
          if (V.isValidDiscard(cards))
            CE.drawButton(S._ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#3a1a1a', border: '#c44' });
        }
        if (V.handTotal(S.hands[0]) <= YANIV_THRESHOLD)
          CE.drawButton(S._ctx, YANIV_BTN.x, YANIV_BTN.y, YANIV_BTN.w, YANIV_BTN.h, 'Yaniv!', { bg: '#1a4a1a', border: '#4f4' });
      } else if (S.phase === PHASE_DRAW) {
        // Draw prompts are handled by clicking stock/discard
      }
    }

    // Player hand
    drawPlayerHand();

    // Phase prompts
    drawPhasePrompt();
  }

  function drawScorePanel() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(S._ctx, CANVAS_W - 195, 5, 185, 100, 6);
    S._ctx.fill();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Scores (out at ' + ELIMINATION_SCORE + ')', CANVAS_W - 187, 10);
    S._ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = 26 + p * 17;
      if (S.eliminated[p]) {
        S._ctx.fillStyle = '#666';
        S._ctx.textAlign = 'left';
        S._ctx.fillText(PLAYER_NAMES[p] + ' (out)', CANVAS_W - 187, y);
        S._ctx.textAlign = 'right';
        S._ctx.fillText('' + S.cumulativeScores[p], CANVAS_W - 18, y);
      } else {
        S._ctx.fillStyle = p === 0 ? '#8f8' : (p === S.currentPlayer ? '#ff0' : '#ccc');
        S._ctx.textAlign = 'left';
        S._ctx.fillText(PLAYER_NAMES[p], CANVAS_W - 187, y);
        S._ctx.textAlign = 'right';
        S._ctx.fillText('' + S.cumulativeScores[p], CANVAS_W - 18, y);
      }
    }
    S._ctx.restore();
  }

  function drawAIHand(p) {
    if (S.eliminated[p]) {
      const pos = aiHandPosition(p);
      S._ctx.fillStyle = '#666';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(PLAYER_NAMES[p] + ' (out)', pos.x, pos.y - 14);
      return;
    }

    const pos = aiHandPosition(p);
    const count = S.hands[p].length;
    const cardScale = 0.5;
    const cw = CE.CARD_W * cardScale;
    const ch = CE.CARD_H * cardScale;

    S._ctx.fillStyle = S.currentPlayer === p ? '#ff0' : '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';

    if (pos.horizontal) {
      S._ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', pos.x, pos.y - 14);
      for (let i = 0; i < count; ++i)
        CE.drawCardBack(S._ctx, pos.x + i * 24, pos.y, cw, ch);
    } else {
      S._ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', pos.x, pos.y - 14);
      for (let i = 0; i < count; ++i)
        CE.drawCardBack(S._ctx, pos.x, pos.y + i * 18, cw, ch);
    }
  }

  function drawStockPile() {
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 6);
    if (S.stockPile.length > 0) {
      CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText('' + S.stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 4);
    } else {
      CE.drawEmptySlot(S._ctx, STOCK_X, STOCK_Y);
    }

    // Highlight during draw phase
    if (S.phase === PHASE_DRAW && S.currentPlayer === 0 && S.stockPile.length > 0) {
      S._ctx.save();
      S._ctx.strokeStyle = 'rgba(0,255,0,0.4)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, STOCK_X - 2, STOCK_Y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
      S._ctx.stroke();
      S._ctx.restore();
    }
  }

  function drawDiscardGroup() {
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 6);

    if (S.discardGroup.length === 0) {
      CE.drawEmptySlot(S._ctx, DISCARD_X, DISCARD_Y);
      return;
    }

    // Show all cards in the discard group spread out
    const totalWidth = (S.discardGroup.length - 1) * 35 + CE.CARD_W;
    const startX = DISCARD_X + CE.CARD_W / 2 - totalWidth / 2;

    for (let i = 0; i < S.discardGroup.length; ++i) {
      const x = startX + i * 35;
      drawAnyCard(x, DISCARD_Y, S.discardGroup[i]);

      // Highlight drawable cards during draw phase
      if (S.phase === PHASE_DRAW && S.currentPlayer === 0) {
        const drawable = V.getDrawableDiscardCards();
        if (drawable.includes(i)) {
          S._ctx.save();
          S._ctx.strokeStyle = 'rgba(255,255,0,0.5)';
          S._ctx.lineWidth = 2;
          CE.drawRoundedRect(S._ctx, x - 2, DISCARD_Y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
          S._ctx.stroke();
          S._ctx.restore();
        }
      }
    }
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return;

    if (S.eliminated[0]) return;

    const ht = V.handTotal(hand);
    S._ctx.fillStyle = ht <= YANIV_THRESHOLD ? '#4f4' : '#fff';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Your Hand (total: ' + ht + (ht <= YANIV_THRESHOLD ? ' - can call Yaniv!' : '') + ')', 90, PLAYER_HAND_Y - 6);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = RC.playerCardX(i, total);
      const isSelected = S.selectedIndices.includes(i);
      const y = isSelected ? PLAYER_HAND_Y - 15 : PLAYER_HAND_Y;

      drawAnyCard(x, y, hand[i]);

      // Hint glow
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && S.phase === PHASE_DISCARD)
        if (V.cardHasHint(hand, i))
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Selection highlight
      if (isSelected) {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 8;
        CE.drawRoundedRect(S._ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
  }

  function drawPhasePrompt() {
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'alphabetic';
    S._ctx.font = '13px sans-serif';
    if (S.currentPlayer === 0 && !S.eliminated[0]) {
      if (S.phase === PHASE_DISCARD) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.fillText('Select cards to discard (single, set, or run)' + (V.handTotal(S.hands[0]) <= YANIV_THRESHOLD ? ' -- or call Yaniv!' : ''), CANVAS_W / 2, CANVAS_H - 8);
      } else if (S.phase === PHASE_DRAW) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.fillText('Draw from stock or pick from discard group (first/last card)', CANVAS_W / 2, CANVAS_H - 8);
      }
    } else if (S.phase === PHASE_AI_THINKING) {
      S._ctx.fillStyle = '#ff8';
      S._ctx.fillText(PLAYER_NAMES[S.currentPlayer] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawYanivReveal() {
    // Show all hands revealed
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(PLAYER_NAMES[S.yanivCaller] + ' calls YANIV!', CANVAS_W / 2, 15);

    // Reveal each player's hand
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.eliminated[p]) continue;
      const rowY = 55 + p * 120;
      const ht = V.handTotal(S.hands[p]);
      const isYanivCaller = p === S.yanivCaller;

      S._ctx.fillStyle = isYanivCaller ? '#ff0' : (p === 0 ? '#8f8' : '#ccc');
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(PLAYER_NAMES[p] + ': ' + ht + ' pts' + (isYanivCaller ? ' (caller)' : ''), 30, rowY);

      const cardScale = 0.65;
      const cw = CE.CARD_W * cardScale;
      const ch = CE.CARD_H * cardScale;
      for (let c = 0; c < S.hands[p].length; ++c) {
        S.hands[p][c].faceUp = true;
        drawAnyCard(30 + c * (cw + 4), rowY + 18, S.hands[p][c], cw, ch);
      }
    }

    // Progress indicator
    const progress = Math.min(S.revealTimer / REVEAL_DELAY, 1);
    S._ctx.fillStyle = 'rgba(255,255,255,0.3)';
    S._ctx.fillRect(CANVAS_W / 2 - 100, CANVAS_H - 30, 200 * progress, 4);
  }

  function drawRoundOver() {
    S._ctx.save();
    const pw = 440;
    const ph = 340;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 20;

    S._ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.gameOver ? 'Game Over' : 'Round Over', CANVAS_W / 2, py + 14);

    if (S.assafTriggered) {
      S._ctx.fillStyle = '#f44';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.fillText('ASSAF!', CANVAS_W / 2, py + 38);
    }

    // Columns header
    S._ctx.font = '11px sans-serif';
    S._ctx.fillStyle = '#888';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Hand', px + 200, py + 60);
    S._ctx.fillText('Round', px + 280, py + 60);
    S._ctx.fillText('Total', px + 360, py + 60);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const rowY = py + 80 + p * 55;
      const ht = V.handTotal(S.hands[p]);
      const isYanivCaller = p === S.yanivCaller;
      const roundPenalty = isYanivCaller
        ? (S.assafTriggered ? 30 + ht : 0)
        : (S.eliminated[p] ? 0 : ht);

      S._ctx.fillStyle = S.eliminated[p] ? '#666' : (p === 0 ? '#8f8' : '#ccc');
      S._ctx.textAlign = 'left';
      S._ctx.font = '12px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[p] + (isYanivCaller ? ' (caller)' : '') + (S.eliminated[p] ? ' OUT' : ''), px + 16, rowY);

      // Show hand cards small
      const cardScale = 0.38;
      const cw = CE.CARD_W * cardScale;
      const ch = CE.CARD_H * cardScale;
      for (let c = 0; c < S.hands[p].length; ++c) {
        S.hands[p][c].faceUp = true;
        drawAnyCard(px + 16 + c * (cw + 2), rowY + 16, S.hands[p][c], cw, ch);
      }

      // Score columns
      S._ctx.textAlign = 'center';
      S._ctx.fillStyle = ht === 0 ? '#4f4' : '#f88';
      S._ctx.font = '12px sans-serif';
      S._ctx.fillText('' + ht, px + 200, rowY + 4);

      S._ctx.fillStyle = roundPenalty === 0 ? '#4f4' : '#f88';
      S._ctx.fillText(roundPenalty === 0 ? '0' : '+' + roundPenalty, px + 280, rowY + 4);

      S._ctx.fillStyle = S.eliminated[p] ? '#f44' : (p === 0 ? '#8f8' : '#ccc');
      S._ctx.font = 'bold 12px sans-serif';
      S._ctx.fillText('' + S.cumulativeScores[p], px + 360, rowY + 4);
    }

    // Result message
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.resultMsg, CANVAS_W / 2, py + ph - 50);

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText(S.gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 20);
    S._ctx.restore();
  }

  Object.assign(V, { drawYaniv });

})();
