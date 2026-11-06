/* Spite & Malice: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.spitemalice;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, CW, CH, CW_S, CH_S, CENTER_Y, CENTER_X0, CENTER_GAP, STOCK_X, STOCK_Y,
    P_PAYOFF_X, P_PAYOFF_Y, P_HAND_X, P_HAND_Y, P_SIDE_X, P_SIDE_Y, AI_PAYOFF_X, AI_PAYOFF_Y,
    AI_HAND_X, AI_HAND_Y, AI_SIDE_X, AI_SIDE_Y } = V;

  function drawJokerCard(x, y, w, h) {
    S._ctx.save();
    S._ctx.fillStyle = '#2a0040';
    S._ctx.strokeStyle = '#a060d0';
    S._ctx.lineWidth = 1;
    CE.drawRoundedRect(S._ctx, x, y, w, h, CE.CARD_RADIUS);
    S._ctx.fill();
    S._ctx.stroke();
    S._ctx.fillStyle = '#c080ff';
    S._ctx.font = 'bold ' + Math.round(12 * (w / CW)) + 'px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('JOKER', x + w / 2, y + h / 2);
    S._ctx.restore();
  }

  function drawCard(x, y, card, w, h) {
    w = w || CW;
    h = h || CH;
    if (card.isJoker)
      drawJokerCard(x, y, w, h);
    else
      CE.drawCardFace(S._ctx, x, y, card, w, h);
  }

  function drawSelection(x, y, w, h) {
    S._ctx.save();
    S._ctx.strokeStyle = '#ff0';
    S._ctx.lineWidth = 3;
    S._ctx.shadowColor = '#ff0';
    S._ctx.shadowBlur = 8;
    CE.drawRoundedRect(S._ctx, x - 2, y - 2, w + 4, h + 4, CE.CARD_RADIUS + 1);
    S._ctx.stroke();
    S._ctx.restore();
  }

  function drawHand(playerIdx) {
    while (S.hands[playerIdx].length < 5 && S.stock.length > 0)
      S.hands[playerIdx].push(S.stock.pop());
  }

  function drawSpiteMalice() {
    // Turn indicator
    S._ctx.fillStyle = S.playerTurn ? '#8f8' : '#f88';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.playerTurn ? 'Your Turn' : 'AI Playing...', CANVAS_W / 2, 18);

    // ── AI area ──
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI Pay-off: ' + S.payoff[1].length, AI_PAYOFF_X, AI_PAYOFF_Y - 8);
    if (S.payoff[1].length > 0) {
      const pt = V.topCard(S.payoff[1]);
      if (pt.faceUp)
        drawCard(AI_PAYOFF_X, AI_PAYOFF_Y, pt, CW_S, CH_S);
      else
        CE.drawCardBack(S._ctx, AI_PAYOFF_X, AI_PAYOFF_Y, CW_S, CH_S);
    } else
      CE.drawEmptySlot(S._ctx, AI_PAYOFF_X, AI_PAYOFF_Y, null, CW_S, CH_S);

    // AI hand (face-down)
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI Hand', AI_HAND_X, AI_HAND_Y - 8);
    for (let i = 0; i < S.hands[1].length; ++i)
      CE.drawCardBack(S._ctx, AI_HAND_X + i * (CW_S + 4), AI_HAND_Y, CW_S, CH_S);

    // AI side stacks
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI Discard', AI_SIDE_X, AI_SIDE_Y - 8);
    for (let s = 0; s < 4; ++s) {
      const sx = AI_SIDE_X + s * (CW_S + 10);
      const st = V.topCard(S.sideStacks[1][s]);
      if (st)
        drawCard(sx, AI_SIDE_Y, st, CW_S, CH_S);
      else
        CE.drawEmptySlot(S._ctx, sx, AI_SIDE_Y, 'D' + (s + 1), CW_S, CH_S);
    }

    // ── Center piles ──
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Center Piles (A \u2192 K)', CENTER_X0 + CENTER_GAP * 1.5, CENTER_Y - 12);
    for (let c = 0; c < 4; ++c) {
      const cx = CENTER_X0 + c * CENTER_GAP;
      const ct = V.topCard(S.centerPiles[c]);
      if (ct)
        drawCard(cx, CENTER_Y, ct);
      else
        CE.drawEmptySlot(S._ctx, cx, CENTER_Y, 'A', CW, CH);

      // Hint glow on center piles that can receive selected card
      if (S._host && S._host.hintsEnabled && S.playerTurn && !S.roundOver && !S.gameOver && S.selectedSource) {
        const sel = V.getSelectedCard();
        if (sel && V.canPlayOn(sel, S.centerPiles[c]))
          CE.drawHintGlow(S._ctx, cx, CENTER_Y, CW, CH, S._host.hintTime);
      }
    }

    // ── Stock pile ──
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Stock: ' + S.stock.length, STOCK_X, STOCK_Y - 8);
    if (S.stock.length > 0) {
      const layers = Math.min(S.stock.length, 3);
      for (let i = 0; i < layers - 1; ++i)
        CE.drawCardBack(S._ctx, STOCK_X + i * 2, STOCK_Y + i * 2, CW_S, CH_S);
      CE.drawCardBack(S._ctx, STOCK_X + (layers - 1) * 2, STOCK_Y + (layers - 1) * 2, CW_S, CH_S);
    } else
      CE.drawEmptySlot(S._ctx, STOCK_X, STOCK_Y, null, CW_S, CH_S);

    // ── Player area ──
    // Pay-off pile
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Pay-off: ' + S.payoff[0].length, P_PAYOFF_X, P_PAYOFF_Y - 8);
    if (S.payoff[0].length > 0) {
      const pt = V.topCard(S.payoff[0]);
      if (pt.faceUp)
        drawCard(P_PAYOFF_X, P_PAYOFF_Y, pt);
      else
        CE.drawCardBack(S._ctx, P_PAYOFF_X, P_PAYOFF_Y);
      if (S.selectedSource && S.selectedSource.type === 'payoff')
        drawSelection(P_PAYOFF_X, P_PAYOFF_Y, CW, CH);
      // Hint: if payoff top can play on any center
      if (S._host && S._host.hintsEnabled && S.playerTurn && !S.roundOver && !S.gameOver && !S.selectedSource && pt.faceUp) {
        for (let c = 0; c < 4; ++c) {
          if (V.canPlayOn(pt, S.centerPiles[c])) {
            CE.drawHintGlow(S._ctx, P_PAYOFF_X, P_PAYOFF_Y, CW, CH, S._host.hintTime);
            break;
          }
        }
      }
    } else
      CE.drawEmptySlot(S._ctx, P_PAYOFF_X, P_PAYOFF_Y, null, CW, CH);

    // Player hand
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Your Hand', P_HAND_X, P_HAND_Y - 8);
    for (let i = 0; i < S.hands[0].length; ++i) {
      const hx = P_HAND_X + i * (CW + 6);
      const card = S.hands[0][i];
      if (card._dealing) continue;
      drawCard(hx, P_HAND_Y, card);
      if (S.selectedSource && S.selectedSource.type === 'hand' && S.selectedSource.index === i)
        drawSelection(hx, P_HAND_Y, CW, CH);
      // Hint: if this card can play on any center
      if (S._host && S._host.hintsEnabled && S.playerTurn && !S.roundOver && !S.gameOver && !S.selectedSource) {
        for (let c = 0; c < 4; ++c) {
          if (V.canPlayOn(card, S.centerPiles[c])) {
            CE.drawHintGlow(S._ctx, hx, P_HAND_Y, CW, CH, S._host.hintTime);
            break;
          }
        }
      }
    }

    // Player side stacks
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Your Discard (play here to end turn)', P_SIDE_X, P_SIDE_Y - 8);
    for (let s = 0; s < 4; ++s) {
      const sx = P_SIDE_X + s * (CW + 10);
      const st = V.topCard(S.sideStacks[0][s]);
      if (st)
        drawCard(sx, P_SIDE_Y, st);
      else
        CE.drawEmptySlot(S._ctx, sx, P_SIDE_Y, 'D' + (s + 1), CW, CH);
      if (S.selectedSource && S.selectedSource.type === 'side' && S.selectedSource.index === s)
        drawSelection(sx, P_SIDE_Y, CW, CH);
      // Hint: if side top can play on any center
      if (S._host && S._host.hintsEnabled && S.playerTurn && !S.roundOver && !S.gameOver && !S.selectedSource && st) {
        for (let c = 0; c < 4; ++c) {
          if (V.canPlayOn(st, S.centerPiles[c])) {
            CE.drawHintGlow(S._ctx, sx, P_SIDE_Y, CW, CH, S._host.hintTime);
            break;
          }
        }
      }
    }

    // Instructions
    if (!S.roundOver && !S.gameOver && S.playerTurn) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      if (S.selectedSource)
        S._ctx.fillText('Click a center pile to play, or a discard pile to end turn', CANVAS_W / 2, CANVAS_H - 8);
      else
        S._ctx.fillText('Select a card from hand, pay-off, or discard tops, then click destination', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  Object.assign(V, { drawHand, drawSpiteMalice });

})();
