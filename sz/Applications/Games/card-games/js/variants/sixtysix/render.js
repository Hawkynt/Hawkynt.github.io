/* Sixty-Six - drawing of the table, hands and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.sixtysix;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, TARGET_POINTS, MATCH_TARGET, PHASE_PLAY,
    PHASE_TRICK_DONE, PHASE_ROUND_OVER, CLOSE_BTN, MARRIAGE_BTN
  } = V;

  const SUIT_SYMBOLS = T.SUIT_SYMBOLS;
  const SUIT_NAMES = T.SUIT_NAMES;

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 420;
    const fanWidth = Math.min(maxWidth, total * 80);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 25;
  }

  const STOCK_X = 100;
  const STOCK_Y = 240;

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawStock() {
    if (S.stock.length > 0 && !S.stockClosed) {
      /* Trump card shown sideways beneath the stock pile */
      S._ctx.save();
      S._ctx.translate(STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
      S._ctx.rotate(Math.PI / 2);
      if (S.trumpCard && S.trumpCard.faceUp)
        CE.drawCardFace(S._ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, S.trumpCard, CE.CARD_H, CE.CARD_W);
      else
        CE.drawCardBack(S._ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, CE.CARD_H, CE.CARD_W);
      S._ctx.restore();

      /* Stock pile on top */
      if (S.stock.length > 1)
        CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y);

      /* Card count */
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(S.stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 8);
    } else if (S.stockClosed && S.stock.length > 0) {
      /* Stock is closed -- show face-down pile with "Closed" label */
      CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y);
      S._ctx.fillStyle = '#f88';
      S._ctx.font = 'bold 12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText('Closed', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 8);
    } else {
      /* Empty stock */
      S._ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, 5);
      S._ctx.stroke();
      S._ctx.fillStyle = 'rgba(255,255,255,0.2)';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('Empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }
  }

  function drawTrumpIndicator() {
    const x = 20;
    const y = 190;
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Trump:', x, y);
    const color = CE.resolveSuitColor(S.trumpSuit);
    S._ctx.fillStyle = color;
    S._ctx.font = 'bold 24px serif';
    S._ctx.fillText(SUIT_SYMBOLS[S.trumpSuit] || S.trumpSuit, x + 52, y - 4);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText(SUIT_NAMES[S.trumpSuit] || S.trumpSuit, x + 78, y + 2);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 10;
    const pw = 190;
    const ph = 130;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Sixty-Six', px + 10, py + 8);

    /* Trick points */
    S._ctx.font = '12px sans-serif';
    S._ctx.fillStyle = '#8f8';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('You:', px + 10, py + 30);
    S._ctx.textAlign = 'right';
    S._ctx.fillText(S.playerTrickPoints + ' / ' + TARGET_POINTS, px + pw - 10, py + 30);

    S._ctx.fillStyle = '#faa';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI:', px + 10, py + 50);
    S._ctx.textAlign = 'right';
    S._ctx.fillText(S.aiTrickPoints + ' / ' + TARGET_POINTS, px + pw - 10, py + 50);

    /* Game points (match) */
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Match (' + MATCH_TARGET + ' to win)', px + 10, py + 75);

    S._ctx.font = '11px sans-serif';
    S._ctx.fillStyle = '#8f8';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('You:', px + 10, py + 93);
    S._ctx.textAlign = 'right';
    S._ctx.fillText(S.playerGamePoints + ' GP', px + pw - 10, py + 93);

    S._ctx.fillStyle = '#faa';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI:', px + 10, py + 108);
    S._ctx.textAlign = 'right';
    S._ctx.fillText(S.aiGamePoints + ' GP', px + pw - 10, py + 108);

    S._ctx.restore();
  }

  function drawCloseButton() {
    if (S.stockClosed || S.stock.length === 0 || S.phase !== PHASE_PLAY || S.currentTurn !== 0 || S.roundOver)
      return;
    CE.drawButton(S._ctx, CLOSE_BTN.x, CLOSE_BTN.y, CLOSE_BTN.w, CLOSE_BTN.h, 'Close', {
      bg: '#5a2a2a',
      border: '#c66',
      fontSize: 12
    });
  }

  function drawMarriageButton() {
    if (!S.marriagePending || S.phase !== PHASE_PLAY || S.currentTurn !== 0 || S.trickCards.length > 0 || S.roundOver)
      return;
    const label = 'Marry ' + (SUIT_SYMBOLS[S.marriageSuit] || S.marriageSuit);
    CE.drawButton(S._ctx, MARRIAGE_BTN.x, MARRIAGE_BTN.y, MARRIAGE_BTN.w, MARRIAGE_BTN.h, label, {
      bg: '#3a3a1a',
      border: '#cc4',
      fontSize: 12
    });
  }

  function drawMarriageShow() {
    if (S.marriageShownTimer <= 0) return;
    const alpha = Math.min(1, S.marriageShownTimer);
    const y = S.marriageShownBy === 0 ? 350 : 150;

    S._ctx.save();
    S._ctx.globalAlpha = alpha;
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    const sym = SUIT_SYMBOLS[S.marriageShownSuit] || S.marriageShownSuit;
    S._ctx.fillText('K' + sym + ' + Q' + sym + ' = ' + V.marriageValue(S.marriageShownSuit) + ' pts', CANVAS_W / 2, y);
    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.playerHand;
    const total = hand.length;
    if (total === 0) return;

    const hintSet = new Set();
    if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAY && S.currentTurn === 0 && !S.roundOver) {
      for (const i of V.getHintIndices())
        hintSet.add(i);
    }

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (S.phase === PHASE_PLAY && i === S.hoverCardIdx && S.currentTurn === 0)
        y -= 12;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      if (hintSet.has(i))
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }
  }

  function drawAIHand() {
    const total = S.aiHand.length;
    if (total === 0) return;

    const isTurn = S.currentTurn === 1 && S.phase === PHASE_PLAY;
    S._ctx.fillStyle = isTurn ? '#ff0' : '#aaa';
    S._ctx.font = isTurn ? 'bold 11px sans-serif' : '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('AI (' + total + ')', CANVAS_W / 2, 5);

    for (let i = 0; i < total; ++i) {
      const x = V.aiCardX(i, total);
      const y = V.aiCardY();
      CE.drawCardBack(S._ctx, x, y, CE.CARD_W * 0.6, CE.CARD_H * 0.6);
    }
  }

  function drawTrickArea() {
    S._ctx.save();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    S._ctx.lineWidth = 2;
    CE.drawRoundedRect(S._ctx, CANVAS_W / 2 - 80, 200, 160, 180, 10);
    S._ctx.stroke();
    S._ctx.restore();

    for (let i = 0; i < S.trickCards.length; ++i) {
      const pos = V.trickCardPos(S.trickPlayers[i]);
      CE.drawCardFace(S._ctx, pos.x, pos.y, S.trickCards[i]);
    }

    if (S.phase === PHASE_TRICK_DONE && S.trickWinner >= 0) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      const who = S.trickWinner === 0 ? 'You take' : 'AI takes';
      const pts = V.trickPointValue();
      const label = who + ' (' + pts + ' pts)';
      S._ctx.fillText(label, CANVAS_W / 2, 195);
    }
  }

  function drawPlayingUI() {
    if (S.currentTurn === 0 && S.phase === PHASE_PLAY && !S.roundOver) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      let msg = 'Your turn \u2014 click a card to play';
      if (V.isStrictPlay() && S.trickCards.length > 0)
        msg = 'Your turn \u2014 must follow suit rules';
      S._ctx.fillText(msg, CANVAS_W / 2, CANVAS_H - 8);
    }

    /* Phase indicator */
    S._ctx.fillStyle = V.isStrictPlay() ? '#f88' : '#8f8';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(V.isStrictPlay() ? 'Strict play (must follow suit)' : 'Open play (any card)', 20, 220);
  }

  function drawCapturedPiles() {
    /* Player captured pile */
    const pcx = CANVAS_W - 100;
    const pcy = CANVAS_H - CE.CARD_H - 30;
    if (S.playerCaptured.length > 0) {
      const layers = Math.min(S.playerCaptured.length, 3);
      for (let i = 0; i < layers; ++i)
        CE.drawCardBack(S._ctx, pcx + i * 2, pcy + i * 2, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.playerTricksTaken + ' tricks', pcx + CE.CARD_W * 0.25, pcy + CE.CARD_H * 0.5 + 6);

    /* AI captured pile */
    const acx = CANVAS_W - 100;
    const acy = 20;
    if (S.aiCaptured.length > 0) {
      const layers = Math.min(S.aiCaptured.length, 3);
      for (let i = 0; i < layers; ++i)
        CE.drawCardBack(S._ctx, acx + i * 2, acy + i * 2, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }
    S._ctx.fillStyle = '#faa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.aiTricksTaken + ' tricks', acx + CE.CARD_W * 0.25, acy + CE.CARD_H * 0.5 + 6);
  }

  function drawRoundOverUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 170;
    const py = 140;
    const pw = 340;
    const ph = 220;

    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';

    let title;
    if (S.playerTrickPoints > S.aiTrickPoints)
      title = 'You Win the Deal!';
    else if (S.aiTrickPoints > S.playerTrickPoints)
      title = 'AI Wins the Deal!';
    else
      title = 'Draw!';

    S._ctx.fillText(title, CANVAS_W / 2, py + 16);

    S._ctx.font = '14px sans-serif';
    S._ctx.fillStyle = '#8f8';
    S._ctx.fillText('You: ' + S.playerTrickPoints + ' trick pts', CANVAS_W / 2, py + 50);
    S._ctx.fillStyle = '#faa';
    S._ctx.fillText('AI: ' + S.aiTrickPoints + ' trick pts', CANVAS_W / 2, py + 74);

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.fillText('Game Points \u2014 You: ' + S.playerGamePoints + '  AI: ' + S.aiGamePoints, CANVAS_W / 2, py + 105);

    if (S.matchOver) {
      S._ctx.fillStyle = S.playerGamePoints >= MATCH_TARGET ? '#4f4' : '#f44';
      S._ctx.font = 'bold 16px sans-serif';
      const matchWinner = S.playerGamePoints >= MATCH_TARGET ? 'You win the match!' : 'AI wins the match!';
      S._ctx.fillText(matchWinner, CANVAS_W / 2, py + 135);
    }

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Score: ' + S.score, CANVAS_W / 2, py + 165);

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '12px sans-serif';
    const clickMsg = S.matchOver ? 'Click for new match' : 'Click for next deal';
    S._ctx.fillText(clickMsg, CANVAS_W / 2, py + ph - 24);

    S._ctx.restore();
  }

  function drawSixtySix() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Sixty-Six (Schnapsen)', 10, 10);

    drawTrumpIndicator();
    drawStock();
    drawScorePanel();
    drawCapturedPiles();
    drawAIHand();
    drawTrickArea();
    drawPlayerHand();
    drawMarriageShow();
    drawCloseButton();
    drawMarriageButton();

    if (S.phase === PHASE_PLAY)
      drawPlayingUI();
    else if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  Object.assign(V, {
    playerCardX, playerCardY, drawSixtySix
  });

})();
