/* Sevens: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.sevens;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, RANKS, SUIT_SYMBOLS, SUIT_DISPLAY,
    PLAYER_HAND_Y, SMALL_W, SMALL_H, ROW_TOP, ROW_SPACING, CARD_SPACING, PASS_BTN, AI_POS } = V;

  function playerCardX(idx, total) {
    const maxWidth = 660;
    const fanWidth = Math.min(maxWidth, total * 48);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  /* Suit row positions: 4 rows centered on canvas */
  function suitRowY(suitIdx) {
    return ROW_TOP + suitIdx * ROW_SPACING;
  }

  /* X position for a card at a given rank index in a suit row */
  function rowCardX(ri) {
    // 7 (index 6) is the center; left cards go 5,4,3,2,A; right cards go 8,9,10,J,Q,K
    const center = CANVAS_W / 2 - CE.CARD_W / 2;
    return center + (ri - 6) * CARD_SPACING;
  }

  function drawScorePanel() {
    const px = CANVAS_W - 170;
    const py = 55;
    const pw = 160;
    const ph = 108;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Scores', px + 10, py + 8);

    S._ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 28 + p * 18;
      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p] + ' (' + S.hands[p].length + ')', px + 10, y);
      S._ctx.textAlign = 'right';
      S._ctx.fillText('' + S.cumulativeScores[p], px + pw - 10, y);
    }
    S._ctx.restore();
  }

  function drawSuitRows() {
    const miniW = CE.CARD_W * 0.42;
    const miniH = CE.CARD_H * 0.42;
    const miniSpacing = miniW + 2;

    for (let si = 0; si < SUIT_DISPLAY.length; ++si) {
      const suit = SUIT_DISPLAY[si];
      const y = suitRowY(si);
      const row = S.suitRows[suit];

      // Suit label
      S._ctx.fillStyle = (suit === 'hearts' || suit === 'diamonds') ? '#f44' : '#ccc';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'right';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(SUIT_SYMBOLS[suit], CANVAS_W / 2 - 6 * miniSpacing - 10, y + miniH / 2);

      // Draw 13 slots (A through K)
      const rowLeft = CANVAS_W / 2 - 6.5 * miniSpacing;
      for (let ri = 0; ri < 13; ++ri) {
        const x = rowLeft + ri * miniSpacing;

        if (S.placedCards[suit] && S.placedCards[suit].has(ri)) {
          // Draw a placed mini card
          const card = CE.makeCard(suit, RANKS[ri]);
          card.faceUp = true;
          CE.drawCardFace(S._ctx, x, y, card, miniW, miniH);
        } else {
          // Draw empty slot, highlight next playable
          CE.drawEmptySlot(S._ctx, x, y, null, miniW, miniH);

          // Highlight playable positions
          if (row && (ri === row.low - 1 || ri === row.high + 1)) {
            S._ctx.save();
            S._ctx.strokeStyle = 'rgba(100,255,100,0.4)';
            S._ctx.lineWidth = 1.5;
            CE.drawRoundedRect(S._ctx, x - 1, y - 1, miniW + 2, miniH + 2, 3);
            S._ctx.stroke();
            S._ctx.restore();
          } else if (!row && ri === 6) {
            // 7 slot highlighted
            S._ctx.save();
            S._ctx.strokeStyle = 'rgba(255,255,100,0.5)';
            S._ctx.lineWidth = 1.5;
            CE.drawRoundedRect(S._ctx, x - 1, y - 1, miniW + 2, miniH + 2, 3);
            S._ctx.stroke();
            S._ctx.restore();
          }
        }
      }
    }
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return;

    const validIdxs = S.currentTurn === 0 && !S.roundOver ? V.getValidPlays(hand) : [];
    const validSet = new Set(validIdxs);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (S.currentTurn === 0 && i === S.hoverCardIdx && validSet.has(i))
        y -= 10;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      // Hint glow for valid plays
      if (S._host && S._host.hintsEnabled && validSet.has(i))
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Dim invalid cards on player's turn
      if (S.currentTurn === 0 && !S.roundOver && !validSet.has(i)) {
        S._ctx.save();
        S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(S._ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        S._ctx.fill();
        S._ctx.restore();
      }
    }
  }

  function drawAIHands() {
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pos = AI_POS[p];
      const count = S.hands[p].length;
      const isCurrent = S.currentTurn === p && !S.roundOver;

      S._ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
      S._ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';

      if (pos.dir === 'vertical') {
        const labelX = p === 1 ? pos.x : pos.x - 8;
        S._ctx.fillText(pos.label + ' (' + count + ')', labelX, pos.y - 16);
        const spacing = Math.min(16, 260 / Math.max(count, 1));
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(S._ctx, pos.x, pos.y + i * spacing, SMALL_W, SMALL_H);
      } else {
        S._ctx.textAlign = 'center';
        S._ctx.fillText(pos.label + ' (' + count + ')', CANVAS_W / 2, pos.y);
        const spacing = Math.min(20, 320 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + SMALL_W;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(S._ctx, startX + i * spacing, pos.y + 14, SMALL_W, SMALL_H);
      }
    }
  }

  function drawCurrentPlayerIndicator() {
    if (S.roundOver) return;

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';

    if (S.currentTurn === 0) {
      const valid = V.getValidPlays(S.hands[0]);
      if (valid.length > 0)
        S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 6);
      else
        S._ctx.fillText('No valid plays \u2014 you must pass', CANVAS_W / 2, CANVAS_H - 6);
    } else
      S._ctx.fillText(PLAYER_NAMES[S.currentTurn] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 6);
  }

  function drawPassButton() {
    if (S.roundOver || S.currentTurn !== 0) return;
    const valid = V.getValidPlays(S.hands[0]);
    if (valid.length > 0) return;

    const bg = S.hoverPassBtn ? '#5a2a2a' : '#3a1a1a';
    CE.drawButton(S._ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass', { bg, border: '#c66', fontSize: 13 });
  }

  function drawRoundOverUI() {
    S._ctx.save();
    const pw = 300;
    const ph = 220;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 20;

    S._ctx.fillStyle = 'rgba(0,0,0,0.7)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.gameOver ? 'Game Over' : 'Round ' + S.roundNumber + ' Results', CANVAS_W / 2, py + 12);

    S._ctx.font = '12px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 42 + p * 24;
      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p], px + 20, y);
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.roundScores[p] > 0 ? '+' + S.roundScores[p] : '0', px + pw / 2, y);
      S._ctx.textAlign = 'right';
      S._ctx.fillText('Total: ' + S.cumulativeScores[p], px + pw - 20, y);
    }

    if (S.gameOver) {
      let lowest = S.cumulativeScores[0];
      let winner = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (S.cumulativeScores[p] < lowest) {
          lowest = S.cumulativeScores[p];
          winner = p;
        }
      }
      S._ctx.fillStyle = winner === 0 ? '#4f4' : '#f88';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      const winMsg = winner === 0 ? 'You win!' : PLAYER_NAMES[winner] + ' wins!';
      S._ctx.fillText(winMsg + ' (Lowest: ' + lowest + ')', CANVAS_W / 2, py + ph - 46);
    }

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 20);

    S._ctx.restore();
  }

  function drawTitle() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Sevens (Fan Tan)', 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Round ' + (S.roundNumber + 1), 10, 28);
  }

  function drawAll() {
    drawTitle();
    drawScorePanel();
    drawSuitRows();
    drawAIHands();
    drawPlayerHand();
    drawPassButton();
    drawCurrentPlayerIndicator();

    if (S.roundOver)
      drawRoundOverUI();
  }

  Object.assign(V, { playerCardX, drawAll });

})();
