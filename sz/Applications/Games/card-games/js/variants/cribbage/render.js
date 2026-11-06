/* Cribbage: drawing of the table, hands, scores and buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.cribbage;
  const S = V.S;
  const { CANVAS_H, WINNING_SCORE, PEG_MAX, PHASE_DISCARD, PHASE_CUT, PHASE_PEGGING, PHASE_SHOW,
    PHASE_CRIB_SHOW, PHASE_ROUND_OVER, HAND_Y, CENTER_Y, DISCARD_BTN, CONTINUE_BTN } = V;

  const PHASE_NAMES = ['Discard to Crib', 'Cut', 'Pegging', 'Show', 'Crib', 'Round Over'];

  /* ── Layout ── */
  const BOARD_X = 680;
  const BOARD_Y = 30;
  const BOARD_W = 200;
  const BOARD_H = 540;

  const AI_HAND_Y = 30;

  /* ================================================================
   *  DRAWING - PEGGING BOARD
   * ================================================================ */

  function drawBoard(cx) {
    // Board background
    cx.fillStyle = '#5c3a1e';
    CE.drawRoundedRect(cx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, 8);
    cx.fill();
    cx.strokeStyle = '#8b6914';
    cx.lineWidth = 2;
    CE.drawRoundedRect(cx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, 8);
    cx.stroke();

    // Title
    cx.fillStyle = '#ffd700';
    cx.font = 'bold 14px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('Cribbage Board', BOARD_X + BOARD_W / 2, BOARD_Y + 18);

    // Draw two tracks side by side
    const trackW = 70;
    const trackStartX = BOARD_X + 25;
    const trackStartY = BOARD_Y + 35;
    const trackH = BOARD_H - 70;
    const holesPerCol = 30;
    const cols = 4; // 4 columns of 30 = 120 + finish hole
    const holeSpacing = trackH / (holesPerCol + 1);
    const colSpacing = trackW / (cols + 1);

    // Labels
    cx.fillStyle = '#ddd';
    cx.font = '10px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('You', trackStartX + trackW / 2, trackStartY - 2);
    cx.fillText('AI', trackStartX + trackW + 30 + trackW / 2, trackStartY - 2);

    for (let track = 0; track < 2; ++track) {
      const baseX = trackStartX + track * (trackW + 30);
      const score_ = track === 0 ? S.playerScore : S.aiScore;
      const prevScore_ = track === 0 ? S.playerPrevScore : S.aiPrevScore;
      const holeColor = track === 0 ? '#446' : '#644';
      const pegColor = track === 0 ? '#4af' : '#f44';
      const pegPrevColor = track === 0 ? '#28a' : '#a22';

      // Draw holes
      for (let hole = 0; hole <= 120; ++hole) {
        const pos = holePosition(baseX, trackStartY, hole, holesPerCol, holeSpacing, colSpacing);
        cx.beginPath();
        cx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
        cx.fillStyle = holeColor;
        cx.fill();
      }

      // Finish hole
      const finPos = holePosition(baseX, trackStartY, 120, holesPerCol, holeSpacing, colSpacing);
      cx.beginPath();
      cx.arc(finPos.x, finPos.y + holeSpacing, 4, 0, Math.PI * 2);
      cx.fillStyle = '#ffd700';
      cx.fill();
      cx.fillStyle = '#888';
      cx.font = '8px sans-serif';
      cx.textAlign = 'center';
      cx.fillText('121', finPos.x, finPos.y + holeSpacing + 12);

      // Draw back peg (previous score)
      if (prevScore_ > 0 && prevScore_ < WINNING_SCORE) {
        const pp = holePosition(baseX, trackStartY, Math.min(prevScore_ - 1, 119), holesPerCol, holeSpacing, colSpacing);
        cx.beginPath();
        cx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
        cx.fillStyle = pegPrevColor;
        cx.fill();
        cx.strokeStyle = '#fff';
        cx.lineWidth = 1;
        cx.stroke();
      }

      // Draw front peg (current score)
      const clampedScore = Math.min(score_, WINNING_SCORE);
      if (clampedScore > 0) {
        let pegPos;
        if (clampedScore >= WINNING_SCORE) {
          pegPos = { x: finPos.x, y: finPos.y + holeSpacing };
        } else
          pegPos = holePosition(baseX, trackStartY, clampedScore - 1, holesPerCol, holeSpacing, colSpacing);
        cx.beginPath();
        cx.arc(pegPos.x, pegPos.y, 5, 0, Math.PI * 2);
        cx.fillStyle = pegColor;
        cx.fill();
        cx.strokeStyle = '#fff';
        cx.lineWidth = 1.5;
        cx.stroke();
      }

      // Score text
      cx.fillStyle = pegColor;
      cx.font = 'bold 12px sans-serif';
      cx.textAlign = 'center';
      cx.fillText('' + Math.min(score_, WINNING_SCORE), baseX + trackW / 2, BOARD_Y + BOARD_H - 15);
    }
  }

  function holePosition(baseX, baseY, holeIdx, perCol, vSpacing, hSpacing) {
    const col = Math.floor(holeIdx / perCol);
    const row = holeIdx % perCol;
    const goingDown = (col % 2) === 0;
    const x = baseX + (col + 1) * hSpacing;
    const y = goingDown
      ? baseY + (row + 1) * vSpacing
      : baseY + (perCol - row) * vSpacing;
    return { x, y };
  }

  /* ================================================================
   *  DRAWING - MAIN
   * ================================================================ */

  function drawGame(cx) {
    // Phase indicator
    cx.fillStyle = '#ffd700';
    cx.font = 'bold 14px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('Phase: ' + PHASE_NAMES[S.phase], 15, 20);

    // Dealer indicator
    cx.fillStyle = '#aaa';
    cx.font = '12px sans-serif';
    cx.fillText('Dealer: ' + (S.dealerIsPlayer ? 'You' : 'AI'), 15, 38);

    // Scores
    cx.fillStyle = '#4af';
    cx.font = 'bold 13px sans-serif';
    cx.fillText('You: ' + S.playerScore + '/' + WINNING_SCORE, 15, 58);
    cx.fillStyle = '#f66';
    cx.fillText('AI: ' + S.aiScore + '/' + WINNING_SCORE, 15, 76);

    // Board
    drawBoard(cx);

    if (S.phase === PHASE_DISCARD)
      drawDiscardPhase(cx);
    else if (S.phase === PHASE_CUT)
      drawCutPhase(cx);
    else if (S.phase === PHASE_PEGGING)
      drawPeggingPhase(cx);
    else if (S.phase === PHASE_SHOW || S.phase === PHASE_CRIB_SHOW)
      drawShowPhase(cx);
    else if (S.phase === PHASE_ROUND_OVER)
      drawRoundOver(cx);

    // Result message
    if (S.resultMsg) {
      cx.fillStyle = '#ff0';
      cx.font = 'bold 16px sans-serif';
      cx.textAlign = 'center';
      cx.fillText(S.resultMsg, 330, CANVAS_H - 12);
    }
  }

  /* ── Discard phase ── */
  function drawDiscardPhase(cx) {
    // AI hand (face down)
    cx.fillStyle = '#ddd';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('AI (' + S.aiKeep.length + ' kept, ' + S.crib.length + ' in crib)', 90, AI_HAND_Y + 10);
    for (let i = 0; i < S.aiKeep.length; ++i)
      CE.drawCardBack(cx, 90 + i * 35, AI_HAND_Y + 18, CE.CARD_W * 0.65, CE.CARD_H * 0.65);

    // Crib pile
    drawCribPile(cx);

    // Player hand
    cx.fillStyle = '#fff';
    cx.font = '13px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('Select 2 cards for the crib:', 90, HAND_Y - 18);

    const spacing = Math.min(75, (560 - 90) / Math.max(S.playerHand.length, 1));
    for (let i = 0; i < S.playerHand.length; ++i) {
      const sel = S.selectedIndices.includes(i);
      const x = 90 + i * spacing;
      const y = sel ? HAND_Y - 15 : HAND_Y;
      CE.drawCardFace(cx, x, y, S.playerHand[i]);
      if (sel) {
        cx.save();
        cx.strokeStyle = '#ff0';
        cx.lineWidth = 3;
        cx.shadowColor = '#ff0';
        cx.shadowBlur = 8;
        CE.drawRoundedRect(cx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        cx.stroke();
        cx.restore();
      }
      if (i === S.hoverCardIdx && !sel) {
        cx.save();
        cx.strokeStyle = 'rgba(255,255,255,0.5)';
        cx.lineWidth = 2;
        CE.drawRoundedRect(cx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        cx.stroke();
        cx.restore();
      }
    }

    // Discard button
    if (S.selectedIndices.length === 2)
      CE.drawButton(cx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#1a5a1a', border: '#4a4' });

    // Hint: highlight cards that form scoring combos
    if (S._host && S._host.hintsEnabled && S.selectedIndices.length < 2) {
      for (let i = 0; i < S.playerHand.length; ++i) {
        if (S.selectedIndices.includes(i))
          continue;
        const keep = S.playerHand.filter((_, idx) => idx !== i && !S.selectedIndices.includes(idx));
        if (keep.length === 4) {
          const est = V.scoreHand(keep, null, false).total;
          if (est >= 4) {
            const x = 90 + i * spacing;
            const y = HAND_Y;
            CE.drawHintGlow(cx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
          }
        }
      }
    }
  }

  /* ── Cut phase ── */
  function drawCutPhase(cx) {
    drawHandsBrief(cx);
    drawStarterCard(cx);
    cx.fillStyle = '#8f8';
    cx.font = '14px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('Starter card revealed!', 330, CENTER_Y + 70);
    if (S.pegMsg) {
      cx.fillStyle = '#ff0';
      cx.fillText(S.pegMsg, 330, CENTER_Y + 90);
    }
  }

  /* ── Pegging phase ── */
  function drawPeggingPhase(cx) {
    // AI peg hand (face down for remaining)
    cx.fillStyle = '#ddd';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('AI (' + S.aiPegHand.length + ' cards left)', 90, AI_HAND_Y + 10);
    for (let i = 0; i < S.aiPegHand.length; ++i)
      CE.drawCardBack(cx, 90 + i * 35, AI_HAND_Y + 18, CE.CARD_W * 0.65, CE.CARD_H * 0.65);

    // Starter
    drawStarterCard(cx);

    // Crib pile
    drawCribPile(cx);

    // Played peg cards
    cx.fillStyle = '#fff';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('Count: ' + S.pegCount, 90, CENTER_Y - 12);

    for (let i = 0; i < S.pegCards.length; ++i) {
      const x = 90 + i * 40;
      const y = CENTER_Y;
      CE.drawCardFace(cx, x, y, S.pegCards[i], CE.CARD_W * 0.7, CE.CARD_H * 0.7);
    }

    // Running total bar
    const barX = 90;
    const barY = CENTER_Y + CE.CARD_H * 0.7 + 8;
    const barW = 400;
    const barH = 12;
    cx.fillStyle = '#333';
    CE.drawRoundedRect(cx, barX, barY, barW, barH, 4);
    cx.fill();
    const fillW = Math.min(barW, barW * (S.pegCount / PEG_MAX));
    if (fillW > 0) {
      cx.fillStyle = S.pegCount === 15 ? '#ff0' : S.pegCount >= 31 ? '#f44' : '#4a4';
      CE.drawRoundedRect(cx, barX, barY, fillW, barH, 4);
      cx.fill();
    }
    cx.fillStyle = '#fff';
    cx.font = '9px sans-serif';
    cx.textAlign = 'center';
    cx.fillText(S.pegCount + '/' + PEG_MAX, barX + barW / 2, barY + 9);

    // Peg message
    if (S.pegMsg) {
      cx.fillStyle = '#ff0';
      cx.font = '13px sans-serif';
      cx.textAlign = 'center';
      cx.fillText(S.pegMsg, 330, CENTER_Y - 28);
    }

    // Turn indicator
    cx.fillStyle = S.currentPegger === 0 ? '#8f8' : '#ff8';
    cx.font = '13px sans-serif';
    cx.textAlign = 'center';
    const turnText = S.currentPegger === 0 ? 'Your turn — play a card' : 'AI is thinking...';
    cx.fillText(turnText, 330, HAND_Y - 25);

    // Player peg hand
    const spacing = Math.min(75, (560 - 90) / Math.max(S.playerPegHand.length, 1));
    for (let i = 0; i < S.playerPegHand.length; ++i) {
      const x = 90 + i * spacing;
      const playable = S.pegCount + V.cardValue(S.playerPegHand[i]) <= PEG_MAX;
      const y = (i === S.hoverCardIdx && playable) ? HAND_Y - 8 : HAND_Y;
      CE.drawCardFace(cx, x, y, S.playerPegHand[i]);
      if (!playable) {
        cx.fillStyle = 'rgba(0,0,0,0.5)';
        CE.drawRoundedRect(cx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        cx.fill();
      }
      if (S._host && S._host.hintsEnabled && playable && S.currentPegger === 0) {
        const pts = V.scorePegPlay(S.pegCards, S.playerPegHand[i]);
        if (pts > 0)
          CE.drawHintGlow(cx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }
    }

    // If player can't play, show Go message
    if (S.currentPegger === 0 && S.playerPegHand.length > 0 && !V.canPlayPeg(S.playerPegHand)) {
      cx.fillStyle = '#f84';
      cx.font = 'bold 14px sans-serif';
      cx.textAlign = 'center';
      cx.fillText('Cannot play — Go!', 330, HAND_Y - 8);
    }
  }

  /* ── Show phase ── */
  function drawShowPhase(cx) {
    drawStarterCard(cx);

    if (S.showPhaseIdx < S.showBreakdown.length) {
      const entry = S.showBreakdown[S.showPhaseIdx];
      cx.fillStyle = '#ffd700';
      cx.font = 'bold 16px sans-serif';
      cx.textAlign = 'center';
      cx.fillText(entry.label + ' — ' + entry.result.total + ' points', 330, 110);

      // Draw the hand
      const startX = 150;
      for (let i = 0; i < entry.hand.length; ++i) {
        const c = entry.hand[i];
        c.faceUp = true;
        CE.drawCardFace(cx, startX + i * 80, 130, c);
      }

      // Starter next to hand
      if (S.starter) {
        cx.fillStyle = '#aaa';
        cx.font = '10px sans-serif';
        cx.textAlign = 'center';
        cx.fillText('Starter', startX + entry.hand.length * 80 + CE.CARD_W / 2 + 15, 125);
        CE.drawCardFace(cx, startX + entry.hand.length * 80 + 15, 130, S.starter);
      }

      // Breakdown
      let by = 240;
      cx.font = '13px sans-serif';
      cx.textAlign = 'left';
      for (const line of entry.result.breakdown) {
        cx.fillStyle = '#cfc';
        cx.fillText(line, 170, by);
        by += 18;
      }
      if (entry.result.total === 0) {
        cx.fillStyle = '#f88';
        cx.fillText('No points', 170, by);
      }

      // Continue
      CE.drawButton(cx, CONTINUE_BTN.x, CONTINUE_BTN.y, CONTINUE_BTN.w, CONTINUE_BTN.h, 'Continue', { bg: '#1a3a1a', border: '#4a4' });
    }
  }

  /* ── Round over ── */
  function drawRoundOver(cx) {
    cx.fillStyle = '#fff';
    cx.font = 'bold 18px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('Round Complete', 330, 180);

    cx.font = '14px sans-serif';
    cx.fillStyle = '#4af';
    cx.fillText('You: ' + S.playerScore, 330, 210);
    cx.fillStyle = '#f66';
    cx.fillText('AI: ' + S.aiScore, 330, 230);

    if (!S.gameOver)
      CE.drawButton(cx, CONTINUE_BTN.x, 260, CONTINUE_BTN.w, CONTINUE_BTN.h, 'Next Round', { bg: '#1a3a1a', border: '#4a4' });
    else {
      cx.fillStyle = '#ffd700';
      cx.font = 'bold 20px sans-serif';
      cx.fillText(S.resultMsg, 330, 280);
      CE.drawButton(cx, CONTINUE_BTN.x, 310, CONTINUE_BTN.w, CONTINUE_BTN.h, 'New Game', { bg: '#5a1a1a', border: '#a44' });
    }
  }

  /* ── Helpers ── */
  function drawStarterCard(cx) {
    if (!S.starter)
      return;
    const sx = 560;
    const sy = CENTER_Y - 20;
    cx.fillStyle = '#aaa';
    cx.font = '11px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('Starter', sx + CE.CARD_W / 2, sy - 6);
    CE.drawCardFace(cx, sx, sy, S.starter);
  }

  function drawCribPile(cx) {
    const cx_ = 560;
    const cy_ = CENTER_Y + CE.CARD_H + 10;
    cx.fillStyle = '#aaa';
    cx.font = '11px sans-serif';
    cx.textAlign = 'center';
    cx.fillText((S.dealerIsPlayer ? 'Your' : 'AI') + ' Crib', cx_ + CE.CARD_W / 2, cy_ - 6);
    if (S.crib.length > 0) {
      if (S.phase === PHASE_SHOW || S.phase === PHASE_CRIB_SHOW || S.phase === PHASE_ROUND_OVER) {
        for (let i = 0; i < Math.min(S.crib.length, 2); ++i)
          CE.drawCardBack(cx, cx_ + i * 4, cy_ + i * 2);
      } else
        CE.drawCardBack(cx, cx_, cy_);
    } else
      CE.drawEmptySlot(cx, cx_, cy_, 'Crib');
  }

  function drawHandsBrief(cx) {
    // AI hand (backs)
    for (let i = 0; i < S.aiKeep.length; ++i)
      CE.drawCardBack(cx, 90 + i * 35, AI_HAND_Y + 18, CE.CARD_W * 0.65, CE.CARD_H * 0.65);

    // Player hand
    const spacing = Math.min(75, (560 - 90) / Math.max(S.playerKeep.length, 1));
    for (let i = 0; i < S.playerKeep.length; ++i)
      CE.drawCardFace(cx, 90 + i * spacing, HAND_Y, S.playerKeep[i]);
  }

  function draw(ctx, W, H) {
    S._ctx = ctx;
    drawGame(ctx);
  }

  V.draw = draw;

})();
