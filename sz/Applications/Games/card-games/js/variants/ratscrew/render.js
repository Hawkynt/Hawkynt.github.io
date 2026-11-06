/* Rat Screw: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ratscrew;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, HUMAN, CENTER_X, CENTER_Y, PLAYER_POSITIONS, SLAP_BTN,
    FLIP_BTN, PHASE_IDLE, PHASE_FACE_CHALLENGE, PHASE_SLAP_WINDOW, PHASE_COLLECTING,
    FEEDBACK_DURATION } = V;

  function drawPileWithCount(x, y, count, label, labelY, active) {
    if (count > 0) {
      const layers = Math.min(count, 3);
      for (let i = 0; i < layers - 1; ++i)
        CE.drawCardBack(S._ctx, x + i * 2, y + i * 2);
      CE.drawCardBack(S._ctx, x + (layers - 1) * 2, y + (layers - 1) * 2);
    } else {
      S._ctx.save();
      S._ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.restore();
    }

    S._ctx.save();
    S._ctx.fillStyle = active ? '#ff0' : '#ccc';
    S._ctx.font = active ? 'bold 13px sans-serif' : '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(label + ' (' + count + ')', x + CE.CARD_W / 2, labelY);
    S._ctx.restore();
  }

  function drawTurnIndicator(playerIndex) {
    if (S.roundOver || S.gameOver) return;
    const pos = PLAYER_POSITIONS[playerIndex];
    const cx = pos.x + CE.CARD_W / 2;
    const cy = pos.y + CE.CARD_H / 2;

    S._ctx.save();
    S._ctx.strokeStyle = '#ff0';
    S._ctx.lineWidth = 3;
    S._ctx.shadowColor = '#ff0';
    S._ctx.shadowBlur = 10;
    CE.drawRoundedRect(S._ctx, pos.x - 4, pos.y - 4, CE.CARD_W + 8, CE.CARD_H + 8, CE.CARD_RADIUS + 2);
    S._ctx.stroke();
    S._ctx.restore();
  }

  function drawCenterPile() {
    if (S.centerPile.length === 0) {
      CE.drawEmptySlot(S._ctx, CENTER_X, CENTER_Y, 'Pile');
      return;
    }

    // Draw up to 3 cards spread slightly
    const showCount = Math.min(S.centerPile.length, 3);
    const startIdx = S.centerPile.length - showCount;
    for (let i = 0; i < showCount; ++i) {
      const card = S.centerPile[startIdx + i];
      const offsetX = (i - 1) * 14;
      const offsetY = (i - 1) * 4;
      CE.drawCardFace(S._ctx, CENTER_X + offsetX, CENTER_Y + offsetY, card);
    }

    // Pile count
    S._ctx.save();
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Pile: ' + S.centerPile.length, CANVAS_W / 2, CENTER_Y - 10);
    S._ctx.restore();
  }

  function drawGame() {
    /* ── Title ── */
    S._ctx.save();
    S._ctx.fillStyle = '#ddd';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('EGYPTIAN RAT SCREW', CANVAS_W / 2, 6);
    S._ctx.restore();

    /* ── Player piles ── */
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const pos = PLAYER_POSITIONS[i];
      const isActive = !S.eliminated[i] || S.playerPiles[i].length > 0;
      const isTurn = V.getCurrentFlipPlayer() === i && !S.roundOver && !S.gameOver;
      drawPileWithCount(pos.x, pos.y, S.playerPiles[i].length, pos.name, pos.labelY, isTurn);

      if (isTurn)
        drawTurnIndicator(i);

      // Eliminated marker
      if (S.eliminated[i] && S.playerPiles[i].length === 0) {
        S._ctx.save();
        S._ctx.fillStyle = 'rgba(255,0,0,0.5)';
        S._ctx.font = 'bold 14px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.fillText('OUT', pos.x + CE.CARD_W / 2, pos.y + CE.CARD_H / 2);
        S._ctx.restore();
      }
    }

    /* ── Center pile ── */
    drawCenterPile();

    /* ── Slap flash overlay ── */
    if (S.slapFlashTimer > 0) {
      const alpha = S.slapFlashTimer * 1.5;
      S._ctx.save();
      S._ctx.fillStyle = S.slapFlashColor;
      S._ctx.globalAlpha = Math.min(alpha, 0.35);
      S._ctx.fillRect(CENTER_X - 20, CENTER_Y - 20, CE.CARD_W + 40, CE.CARD_H + 40);
      S._ctx.restore();
    }

    /* ── Face challenge info ── */
    if (S.faceChallenge && (S.phase === PHASE_FACE_CHALLENGE || S.phase === PHASE_IDLE)) {
      const name = S.challengePlayer === HUMAN ? 'You' : PLAYER_POSITIONS[S.challengePlayer].name;
      S._ctx.save();
      S._ctx.fillStyle = '#fa0';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Challenge: ' + name + ' must play a face card (' + S.challengeChances + ' chance' + (S.challengeChances > 1 ? 's' : '') + ' left)', CANVAS_W / 2, CENTER_Y + CE.CARD_H + 8);
      S._ctx.restore();
    }

    /* ── SLAP button ── */
    if (V.isHumanAlive() && !S.roundOver && !S.gameOver && S.phase !== PHASE_COLLECTING) {
      const pulse = 1 + 0.06 * Math.sin(S.slapPulsePhase * 8);
      const hasPattern = V.detectSlapPattern() !== '';
      const bw = SLAP_BTN.w * (hasPattern ? pulse : 1);
      const bh = SLAP_BTN.h * (hasPattern ? pulse : 1);
      const bx = SLAP_BTN.x + (SLAP_BTN.w - bw) / 2;
      const by = SLAP_BTN.y + (SLAP_BTN.h - bh) / 2;

      S._ctx.save();
      if (hasPattern) {
        S._ctx.shadowColor = '#f00';
        S._ctx.shadowBlur = 14 + 6 * Math.sin(S.slapPulsePhase * 8);
      }
      CE.drawButton(S._ctx, bx, by, bw, bh, 'SLAP! (Space)', {
        bg: hasPattern ? '#c00' : '#600',
        border: hasPattern ? '#f44' : '#844',
        textColor: '#fff',
        fontSize: 18
      });
      S._ctx.restore();
    }

    /* ── FLIP button (human turn) ── */
    if (V.getCurrentFlipPlayer() === HUMAN && !S.roundOver && !S.gameOver && S.phase !== PHASE_COLLECTING && S.phase !== PHASE_SLAP_WINDOW && S.playerPiles[HUMAN].length > 0) {
      CE.drawButton(S._ctx, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h, 'Flip (F)', {
        bg: '#2a5a2a', border: '#6c6', textColor: '#fff', fontSize: 14
      });
    }

    /* ── Feedback text ── */
    if (S.feedbackTimer < FEEDBACK_DURATION && S.feedbackText) {
      const alpha = 1 - S.feedbackTimer / FEEDBACK_DURATION;
      S._ctx.save();
      S._ctx.globalAlpha = alpha;
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.feedbackText, CANVAS_W / 2, FLIP_BTN.y + FLIP_BTN.h + 16);
      S._ctx.restore();
    }

    /* ── Score / card ratio bar ── */
    const barW = 200;
    const barH = 6;
    const barX = CANVAS_W / 2 - barW / 2;
    const barY = CANVAS_H - 6;
    S._ctx.fillStyle = '#222';
    S._ctx.fillRect(barX, barY, barW, barH);
    const colors = ['#4a4', '#48a', '#a84', '#a48'];
    let offset = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const ratio = S.playerPiles[i].length / 52;
      S._ctx.fillStyle = colors[i];
      S._ctx.fillRect(barX + offset, barY, barW * ratio, barH);
      offset += barW * ratio;
    }

    /* ── Score display ── */
    S._ctx.save();
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Cards: ' + S.playerPiles[HUMAN].length, 16, CANVAS_H - 16);
    S._ctx.restore();

    /* ── Instructions ── */
    if (!S.roundOver && !S.gameOver) {
      S._ctx.save();
      S._ctx.fillStyle = '#666';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'right';
      S._ctx.fillText('Slap on: Doubles, Sandwich, Top-Bottom', CANVAS_W - 16, CANVAS_H - 16);
      S._ctx.restore();
    }

    /* ── Game over overlay ── */
    if (S.roundOver || S.gameOver) {
      S._ctx.save();
      S._ctx.fillStyle = 'rgba(0,0,0,0.55)';
      S._ctx.fillRect(0, CANVAS_H / 2 - 44, CANVAS_W, 88);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 24px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 8);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 20);
      S._ctx.restore();
    }
  }

  Object.assign(V, { drawGame });

})();
