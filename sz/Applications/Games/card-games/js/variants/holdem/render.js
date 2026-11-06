/* Texas Hold'em: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.holdem;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, SMALL_BLIND, BIG_BLIND, PLAYER_NAMES, PHASE_SHOWDOWN,
    PHASE_ROUND_OVER, PHASE_NAMES, COMMUNITY_Y, COMMUNITY_START_X, CARD_GAP, PLAYER_POSITIONS,
    BTN_W, BTN_H, BTN_Y, BTN_GAP } = V;

  function btnRect(i, count) {
    const totalW = count * BTN_W + (count - 1) * BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    return { x: startX + i * (BTN_W + BTN_GAP), y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  function drawChipBadge(x, y, amount, highlight) {
    S._ctx.save();
    const text = '' + amount;
    S._ctx.font = 'bold 11px sans-serif';
    const tw = S._ctx.measureText(text).width;
    const pw = tw + 14;
    const ph = 18;
    const px = x - pw / 2;
    const py = y - ph / 2;

    S._ctx.fillStyle = highlight ? 'rgba(255,200,0,0.85)' : 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 9);
    S._ctx.fill();

    S._ctx.fillStyle = highlight ? '#000' : '#fc0';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(text, x, y);
    S._ctx.restore();
  }

  function drawDealerButton(x, y) {
    S._ctx.save();
    S._ctx.beginPath();
    S._ctx.arc(x, y, 12, 0, Math.PI * 2);
    S._ctx.fillStyle = '#fff';
    S._ctx.fill();
    S._ctx.strokeStyle = '#333';
    S._ctx.lineWidth = 2;
    S._ctx.stroke();

    S._ctx.fillStyle = '#000';
    S._ctx.font = 'bold 10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('D', x, y);
    S._ctx.restore();
  }

  function drawBlindLabel(x, y, text) {
    S._ctx.save();
    S._ctx.font = 'bold 9px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    const tw = S._ctx.measureText(text).width;
    const pw = tw + 8;
    const ph = 14;

    S._ctx.fillStyle = 'rgba(100,100,255,0.7)';
    CE.drawRoundedRect(S._ctx, x - pw / 2, y - ph / 2, pw, ph, 7);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.fillText(text, x, y);
    S._ctx.restore();
  }

  function drawCommunityCards() {
    for (let i = 0; i < 5; ++i) {
      const cx = COMMUNITY_START_X + i * (CE.CARD_W + CARD_GAP);
      if (i < S.community.length) {
        if (!S.community[i]._dealing)
          CE.drawCardFace(S._ctx, cx, COMMUNITY_Y, S.community[i]);
      } else
        CE.drawEmptySlot(S._ctx, cx, COMMUNITY_Y, '');
    }
  }

  function drawPot() {
    const totalInPlay = S.pot + S.bets.reduce((s, b) => s + b, 0);
    if (totalInPlay <= 0) return;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(S._ctx, CANVAS_W / 2 - 60, COMMUNITY_Y - 35, 120, 26, 8);
    S._ctx.fill();

    S._ctx.fillStyle = '#fc0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Pot: ' + totalInPlay, CANVAS_W / 2, COMMUNITY_Y - 22);
    S._ctx.restore();
  }

  function drawPlayerArea(idx) {
    if (S.eliminated[idx]) return;

    const pos = PLAYER_POSITIONS[idx];
    const isActive = S.currentTurn === idx && S.phase < PHASE_SHOWDOWN && !S.roundOver;
    const isFolded = S.folded[idx];

    let hx, hy;
    if (idx === 0) {
      hx = CANVAS_W / 2 - CE.CARD_W - 4;
      hy = CANVAS_H - 130;
    } else if (idx === 1) {
      hx = 30;
      hy = 280;
    } else if (idx === 2) {
      hx = CANVAS_W / 2 - CE.CARD_W - 4;
      hy = 50;
    } else {
      hx = CANVAS_W - 30 - 2 * CE.CARD_W - CARD_GAP;
      hy = 280;
    }

    if (isActive) {
      S._ctx.save();
      S._ctx.strokeStyle = '#ff0';
      S._ctx.lineWidth = 2;
      S._ctx.shadowColor = '#ff0';
      S._ctx.shadowBlur = 8;
      CE.drawRoundedRect(S._ctx, hx - 6, hy - 6, 2 * CE.CARD_W + CARD_GAP + 12, CE.CARD_H + 12, 8);
      S._ctx.stroke();
      S._ctx.restore();
    }

    for (let i = 0; i < S.holeCards[idx].length; ++i) {
      const cx = hx + i * (CE.CARD_W + CARD_GAP);
      const card = S.holeCards[idx][i];
      if (card._dealing) continue;

      if (isFolded) {
        S._ctx.save();
        S._ctx.globalAlpha = 0.3;
        CE.drawCardBack(S._ctx, cx, hy);
        S._ctx.restore();
      } else if (card.faceUp)
        CE.drawCardFace(S._ctx, cx, hy, card);
      else
        CE.drawCardBack(S._ctx, cx, hy);
    }

    S._ctx.save();
    S._ctx.fillStyle = isActive ? '#ff0' : (isFolded ? '#666' : '#fff');
    S._ctx.font = isActive ? 'bold 12px sans-serif' : '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    const labelX = hx + CE.CARD_W + CARD_GAP / 2;
    const labelY = hy + CE.CARD_H + 4;
    S._ctx.fillText(PLAYER_NAMES[idx], labelX, labelY);
    S._ctx.restore();

    drawChipBadge(labelX, labelY + 20, S.chips[idx], isActive);

    if (S.bets[idx] > 0) {
      const betX = idx === 1 ? hx + 2 * CE.CARD_W + CARD_GAP + 20 :
                   idx === 3 ? hx - 20 :
                   labelX;
      const betY = idx === 0 ? hy - 18 :
                   idx === 2 ? hy + CE.CARD_H + 4 :
                   hy + CE.CARD_H / 2;
      S._ctx.save();
      S._ctx.fillStyle = '#8cf';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('Bet: ' + S.bets[idx], betX, betY);
      S._ctx.restore();
    }

    const sbIdx = V.nextActiveOrAllIn(S.dealerIdx);
    const bbIdx = V.nextActiveOrAllIn(sbIdx);

    const dealerBtnOffset = 28;
    let dbx, dby;
    if (idx === 0) { dbx = hx - 20; dby = hy + CE.CARD_H / 2; }
    else if (idx === 1) { dbx = hx + 2 * CE.CARD_W + CARD_GAP + dealerBtnOffset; dby = hy - 10; }
    else if (idx === 2) { dbx = hx + 2 * CE.CARD_W + CARD_GAP + 20; dby = hy + CE.CARD_H / 2; }
    else { dbx = hx - dealerBtnOffset; dby = hy - 10; }

    if (idx === S.dealerIdx) drawDealerButton(dbx, dby);
    if (idx === sbIdx && !S.eliminated[idx]) drawBlindLabel(dbx, dby + (idx === S.dealerIdx ? 20 : 0), 'SB');
    if (idx === bbIdx && !S.eliminated[idx]) drawBlindLabel(dbx, dby + (idx === S.dealerIdx ? 20 : (idx === sbIdx ? 20 : 0)), 'BB');
  }

  function drawActionButtons() {
    if (S.phase >= PHASE_SHOWDOWN || S.roundOver || S.gameOver) return;
    if (S.currentTurn !== 0) return;

    const toCall = S.currentBet - S.bets[0];
    const myChips = S.chips[0];
    const canCheck = toCall === 0;
    const canRaise = myChips > toCall;

    const buttons = [];
    buttons.push({ label: 'Fold (F)', action: 'fold', bg: '#5a2a2a', border: '#c66' });

    if (canCheck)
      buttons.push({ label: 'Check (C)', action: 'check', bg: '#2a3a5a', border: '#6ac' });
    else
      buttons.push({ label: 'Call ' + Math.min(toCall, myChips) + ' (C)', action: 'call', bg: '#2a3a5a', border: '#6ac' });

    if (canRaise) {
      const rAmt = Math.min(S.currentBet + S.raiseAmount, myChips + S.bets[0]);
      buttons.push({ label: 'Raise (R)', action: 'raise', bg: '#5a5a2a', border: '#cc6' });
    }

    buttons.push({ label: 'All-In (A)', action: 'allin', bg: '#5a2a3a', border: '#c6a' });

    for (let i = 0; i < buttons.length; ++i) {
      const r = btnRect(i, buttons.length);
      const isHover = S.hoverBtn === i;
      CE.drawButton(S._ctx, r.x, r.y, r.w, r.h, buttons[i].label, {
        bg: isHover ? buttons[i].border : buttons[i].bg,
        border: buttons[i].border,
        fontSize: 11
      });
    }

    return buttons;
  }

  function drawPhaseInfo() {
    if (S.phase < PHASE_SHOWDOWN) {
      S._ctx.save();
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(PHASE_NAMES[S.phase], 10, CANVAS_H - 16);
      S._ctx.restore();
    }

    const handText = V.getPlayerHandRank();
    if (handText) {
      S._ctx.save();
      S._ctx.fillStyle = '#aaf';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(handText, CANVAS_W / 2, CANVAS_H - 72);
      S._ctx.restore();
    }
  }

  function drawRoundOverUI() {
    S._ctx.save();
    const pw = 300;
    const ph = 180;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 20;

    S._ctx.fillStyle = 'rgba(0,0,0,0.7)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.gameOver ? 'Game Over' : 'Hand Complete', CANVAS_W / 2, py + 12);

    S._ctx.font = '12px sans-serif';
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const y = py + 42 + i * 22;
      const el = S.eliminated[i];
      S._ctx.fillStyle = el ? '#666' : (i === 0 ? '#8f8' : '#ccc');
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[i] + (el ? ' (out)' : ''), px + 20, y);
      S._ctx.textAlign = 'right';
      S._ctx.fillText(el ? '0' : '' + S.chips[i], px + pw - 20, y);
    }

    if (S.resultMessage) {
      S._ctx.fillStyle = '#fc0';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.resultMessage, CANVAS_W / 2, py + ph - 36);
    }

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 16);
    S._ctx.restore();
  }

  function drawTitle() {
    S._ctx.save();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText("Texas Hold'em", 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Blinds: ' + SMALL_BLIND + '/' + BIG_BLIND, 10, 28);
    S._ctx.restore();
  }

  function drawHoldem() {
    drawTitle();
    drawCommunityCards();
    drawPot();

    for (let i = 0; i < NUM_PLAYERS; ++i)
      drawPlayerArea(i);

    drawPhaseInfo();
    S._cachedButtons = drawActionButtons();

    if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  Object.assign(V, { btnRect, drawHoldem });

})();
