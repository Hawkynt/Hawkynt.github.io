/* Briscola: drawing of the table, hands, scores and buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardY = SZ.CardGames.shared.euroLayout.duelPlayerCardY;
  const aiCardY = SZ.CardGames.shared.euroLayout.duelAiCardY;
  const trickCardPos = SZ.CardGames.shared.euroLayout.duelTrickCardPos;

  const V = SZ.CardGames.v.briscola;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_PLAY, PHASE_TRICK_DONE, PHASE_ROUND_OVER } = V;

  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

  const TOTAL_POINTS = 120;

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 400;
    const fanWidth = Math.min(maxWidth, total * 80);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function aiCardX(idx, total) {
    const maxWidth = 300;
    const fanWidth = Math.min(maxWidth, total * 45);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  const STOCK_X = 100;
  const STOCK_Y = 240;

  const TRICK_AREA_X = CANVAS_W / 2 - 80;
  const TRICK_AREA_Y = 220;

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawStock() {
    if (S.stock.length > 0) {
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
    } else {
      /* Empty stock */
      S._ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
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
    const px = CANVAS_W - 180;
    const py = 10;
    const pw = 170;
    const ph = 100;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Points', px + 10, py + 8);

    S._ctx.font = '12px sans-serif';
    S._ctx.fillStyle = '#8f8';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('You:', px + 10, py + 30);
    S._ctx.textAlign = 'right';
    S._ctx.fillText(S.playerPoints + ' / ' + TOTAL_POINTS, px + pw - 10, py + 30);

    S._ctx.fillStyle = '#faa';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI:', px + 10, py + 50);
    S._ctx.textAlign = 'right';
    S._ctx.fillText(S.aiPoints + ' / ' + TOTAL_POINTS, px + pw - 10, py + 50);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Tricks: ' + S.trickCount + '/20', px + 10, py + 75);
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Stock: ' + S.stock.length, px + pw - 10, py + 75);

    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.playerHand;
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (S.phase === PHASE_PLAY && i === S.hoverCardIdx && S.currentTurn === 0)
        y -= 12;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAY && S.currentTurn === 0) {
        if (S.trickCards.length === 0 || V.canBeatLead(hand[i]))
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }
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
      const x = aiCardX(i, total);
      const y = aiCardY();
      CE.drawCardBack(S._ctx, x, y, CE.CARD_W * 0.6, CE.CARD_H * 0.6);
    }
  }

  function drawTrickArea() {
    /* Subtle trick area outline */
    S._ctx.save();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    S._ctx.lineWidth = 2;
    CE.drawRoundedRect(S._ctx, TRICK_AREA_X, TRICK_AREA_Y, 160, 180, 10);
    S._ctx.stroke();
    S._ctx.restore();

    for (let i = 0; i < S.trickCards.length; ++i) {
      const pos = trickCardPos(S.trickPlayers[i]);
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
      S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawRoundOverUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 150;
    const py = 160;
    const pw = 300;
    const ph = 180;

    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';

    let title;
    if (S.playerPoints > S.aiPoints)
      title = 'You Win!';
    else if (S.aiPoints > S.playerPoints)
      title = 'AI Wins!';
    else
      title = 'Draw!';

    S._ctx.fillText(title, CANVAS_W / 2, py + 16);

    S._ctx.font = '14px sans-serif';
    S._ctx.fillStyle = '#8f8';
    S._ctx.fillText('You: ' + S.playerPoints + ' points', CANVAS_W / 2, py + 50);
    S._ctx.fillStyle = '#faa';
    S._ctx.fillText('AI: ' + S.aiPoints + ' points', CANVAS_W / 2, py + 74);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Total game score: ' + S.score, CANVAS_W / 2, py + 108);

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Click to play again', CANVAS_W / 2, py + ph - 24);

    S._ctx.restore();
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
    S._ctx.fillText(S.playerCaptured.length + ' cards', pcx + CE.CARD_W * 0.25, pcy + CE.CARD_H * 0.5 + 6);

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
    S._ctx.fillText(S.aiCaptured.length + ' cards', acx + CE.CARD_W * 0.25, acy + CE.CARD_H * 0.5 + 6);
  }

  function drawBriscola() {
    /* Title */
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Briscola', 10, 10);

    drawTrumpIndicator();
    drawStock();
    drawScorePanel();
    drawCapturedPiles();
    drawAIHand();
    drawTrickArea();
    drawPlayerHand();

    if (S.phase === PHASE_PLAY)
      drawPlayingUI();
    else if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  function draw(ctx, W, H) {
    S._ctx = ctx;
    drawBriscola();
  }

  V.playerCardX = playerCardX;
  V.draw = draw;

})();
