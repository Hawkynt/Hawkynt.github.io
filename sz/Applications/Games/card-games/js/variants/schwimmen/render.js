/* Schwimmen: drawing of the table, hands, scores and buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.schwimmen;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, BTN_H, BTN_Y, SWAP1_BTN, SWAP_ALL_BTN, KNOCK_BTN } = V;

  /* ================================================================
     CARD POSITIONS
     ================================================================ */

  function playerCardX(i) {
    return CANVAS_W / 2 - 1.5 * CE.CARD_W - 10 + i * (CE.CARD_W + 10);
  }

  function playerCardY() {
    return CANVAS_H - 175;
  }

  function poolCardX(i) {
    return CANVAS_W / 2 - 1.5 * CE.CARD_W - 10 + i * (CE.CARD_W + 10);
  }

  function poolCardY() {
    return CANVAS_H / 2 - CE.CARD_H / 2;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawLives(x, y, count, isSwimming) {
    for (let i = 0; i < 3; ++i) {
      S._ctx.font = '16px sans-serif';
      S._ctx.fillStyle = i < count ? '#f44' : '#444';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('\u2764', x + i * 20, y);
    }
    if (isSwimming) {
      S._ctx.fillStyle = '#fa0';
      S._ctx.font = 'bold 10px sans-serif';
      S._ctx.fillText('SCHWIMMT', x, y + 14);
    }
  }

  function drawPlayerLabel(x, y, playerIdx) {
    const isActive = S.currentTurn === playerIdx && !S.roundOver;
    const elim = S.eliminated[playerIdx];

    if (elim) {
      S._ctx.fillStyle = '#666';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(playerIdx === 0 ? 'You (out)' : 'AI ' + playerIdx + ' (out)', x, y);
      return;
    }

    S._ctx.fillStyle = isActive ? '#ff0' : '#ccc';
    S._ctx.font = isActive ? 'bold 13px sans-serif' : '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    const name = playerIdx === 0 ? 'You' : 'AI ' + playerIdx;
    const knockLabel = S.hasKnocked === playerIdx ? ' [Knocked]' : '';
    S._ctx.fillText(name + knockLabel, x, y);
  }

  function drawSchwimmen() {
    // Title
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Schwimmen / 31', 20, 12);

    // Knock indicator
    if (S.hasKnocked >= 0 && !S.roundOver) {
      S._ctx.fillStyle = '#fa0';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'left';
      const knocker = S.hasKnocked === 0 ? 'You' : 'AI ' + S.hasKnocked;
      S._ctx.fillText(knocker + ' knocked \u2014 final round!', 20, 34);
    }

    const smallW = CE.CARD_W * 0.55;
    const smallH = CE.CARD_H * 0.55;

    // ── AI 2 (top center) ──
    if (!S.eliminated[2]) {
      const ax = CANVAS_W / 2;
      const ay = 20;
      drawPlayerLabel(ax, ay, 2);
      drawLives(ax - 28, ay + 18, S.lives[2], S.lives[2] === 1);
      if (!S.roundOver) {
        for (let i = 0; i < S.hands[2].length; ++i)
          CE.drawCardBack(S._ctx, ax - 1.5 * 40 + i * 40, ay + 36, smallW, smallH);
      } else {
        for (let i = 0; i < S.hands[2].length; ++i)
          CE.drawCardFace(S._ctx, ax - 1.5 * 40 + i * 40, ay + 36, S.hands[2][i], smallW, smallH);
      }
    }

    // ── AI 1 (left) ──
    if (!S.eliminated[1]) {
      const ax = 60;
      const ay = CANVAS_H / 2 - 60;
      drawPlayerLabel(ax + 20, ay - 16, 1);
      drawLives(ax - 8, ay, S.lives[1], S.lives[1] === 1);
      if (!S.roundOver) {
        for (let i = 0; i < S.hands[1].length; ++i)
          CE.drawCardBack(S._ctx, ax - 10, ay + 18 + i * 32, smallW, smallH);
      } else {
        for (let i = 0; i < S.hands[1].length; ++i)
          CE.drawCardFace(S._ctx, ax - 10, ay + 18 + i * 32, S.hands[1][i], smallW, smallH);
      }
    }

    // ── AI 3 (right) ──
    if (!S.eliminated[3]) {
      const ax = CANVAS_W - 100;
      const ay = CANVAS_H / 2 - 60;
      drawPlayerLabel(ax + 20, ay - 16, 3);
      drawLives(ax + 2, ay, S.lives[3], S.lives[3] === 1);
      if (!S.roundOver) {
        for (let i = 0; i < S.hands[3].length; ++i)
          CE.drawCardBack(S._ctx, ax, ay + 18 + i * 32, smallW, smallH);
      } else {
        for (let i = 0; i < S.hands[3].length; ++i)
          CE.drawCardFace(S._ctx, ax, ay + 18 + i * 32, S.hands[3][i], smallW, smallH);
      }
    }

    // ── Center pool ──
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Pool', CANVAS_W / 2, poolCardY() - 6);
    for (let i = 0; i < S.pool.length; ++i) {
      const px = poolCardX(i);
      const py = poolCardY();
      CE.drawCardFace(S._ctx, px, py, S.pool[i]);
      // Highlight selected pool card
      if (S.selectedPoolCard === i && S.swapMode === 'swap1') {
        S._ctx.save();
        S._ctx.strokeStyle = '#0f0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#0f0';
        S._ctx.shadowBlur = 8;
        CE.drawRoundedRect(S._ctx, px - 2, py - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }

    // ── Player hand (bottom center) ──
    if (!S.eliminated[0]) {
      const py = playerCardY();
      drawPlayerLabel(CANVAS_W / 2, py - 22, 0);
      drawLives(CANVAS_W / 2 - 28, py - 8, S.lives[0], S.lives[0] === 1);
      for (let i = 0; i < S.hands[0].length; ++i) {
        if (S.hands[0][i]._dealing) continue;
        const px = playerCardX(i);
        CE.drawCardFace(S._ctx, px, py, S.hands[0][i]);
        // Hint glow: all hand cards are valid plays when it's the player's swap turn
        if (S._host && S._host.hintsEnabled && S.currentTurn === 0 && !S.roundOver && !S.gameOver)
          CE.drawHintGlow(S._ctx, px, py, CE.CARD_W, CE.CARD_H, S._host.hintTime);
        // Highlight selected hand card
        if (S.selectedHandCard === i && S.swapMode === 'swap1') {
          S._ctx.save();
          S._ctx.strokeStyle = '#ff0';
          S._ctx.lineWidth = 3;
          S._ctx.shadowColor = '#ff0';
          S._ctx.shadowBlur = 8;
          CE.drawRoundedRect(S._ctx, px - 2, py - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
          S._ctx.stroke();
          S._ctx.restore();
        }
      }

      // Hand value indicator
      if (!S.eliminated[0]) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.font = '13px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.textBaseline = 'top';
        S._ctx.fillText('Hand: ' + V.handValueLabel(S.hands[0]) + ' (' + V.bestSuitName(S.hands[0]) + ')', CANVAS_W / 2, py + CE.CARD_H + 6);
      }
    }

    // ── Action buttons (only on player's turn) ──
    if (S.currentTurn === 0 && !S.roundOver && !S.gameOver && !S.eliminated[0]) {
      const swap1Active = S.swapMode === 'swap1';
      CE.drawButton(S._ctx, SWAP1_BTN.x, SWAP1_BTN.y, SWAP1_BTN.w, SWAP1_BTN.h, swap1Active ? 'Select...' : 'Swap 1', {
        bg: swap1Active ? '#3a5a1a' : '#2a4a2a',
        border: swap1Active ? '#8c8' : '#4a4'
      });
      CE.drawButton(S._ctx, SWAP_ALL_BTN.x, SWAP_ALL_BTN.y, SWAP_ALL_BTN.w, SWAP_ALL_BTN.h, 'Swap All', {
        bg: '#2a3a5a',
        border: '#48c'
      });

      if (S.hasKnocked < 0)
        CE.drawButton(S._ctx, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h, 'Knock', {
          bg: '#5a3a1a',
          border: '#c84'
        });
      else
        CE.drawButton(S._ctx, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h, 'Pass', {
          bg: '#3a3a3a',
          border: '#888'
        });

      // Instructions
      if (S.swapMode === 'swap1') {
        S._ctx.fillStyle = '#8f8';
        S._ctx.font = '11px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.textBaseline = 'top';
        S._ctx.fillText('Click one of your cards, then a pool card to swap', CANVAS_W / 2, BTN_Y + BTN_H + 4);
      }
    }

    // ── Round over message ──
    if (S.roundOver && S.resultMsg) {
      S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
      S._ctx.fillRect(CANVAS_W / 2 - 250, CANVAS_H / 2 + 50, 500, 50);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H / 2 + 75);
    }
  }

  function draw(ctx, W, H) {
    S._ctx = ctx;
    drawSchwimmen();
  }

  V.playerCardX = playerCardX;
  V.playerCardY = playerCardY;
  V.poolCardX = poolCardX;
  V.poolCardY = poolCardY;
  V.draw = draw;

})();
