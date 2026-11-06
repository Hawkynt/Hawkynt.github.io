/* Bezique: drawing of the table, hands, scores and buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardY = SZ.CardGames.shared.euroLayout.duelPlayerCardY;
  const aiCardY = SZ.CardGames.shared.euroLayout.duelAiCardY;
  const trickCardPos = SZ.CardGames.shared.euroLayout.duelTrickCardPos;

  const V = SZ.CardGames.v.bezique;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, SUIT_SYMBOLS, GAME_WIN_SCORE, PHASE_PLAY, PHASE_TRICK_DONE,
    PHASE_MELD_SELECT, PHASE_ROUND_OVER } = V;

  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 480;
    const fanWidth = Math.min(maxWidth, total * 65);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function aiCardX(idx, total) {
    const maxWidth = 300;
    const fanWidth = Math.min(maxWidth, total * 40);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  const STOCK_X = 80;
  const STOCK_Y = 240;

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawStock() {
    if (S.stock.length > 0 || S.trumpCard) {
      // Trump card shown sideways beneath the stock pile
      if (S.trumpCard && S.trumpCard.faceUp) {
        S._ctx.save();
        S._ctx.translate(STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
        S._ctx.rotate(Math.PI / 2);
        CE.drawCardFace(S._ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, S.trumpCard, CE.CARD_H, CE.CARD_W);
        S._ctx.restore();
      }

      // Stock pile on top
      if (S.stock.length > 0)
        CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y);

      // Card count
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(S.stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 8);
    } else {
      // Empty stock
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
    const y = 185;
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

    // Phase indicator
    S._ctx.fillStyle = V.isPhase2() ? '#f88' : '#8f8';
    S._ctx.font = 'bold 10px sans-serif';
    S._ctx.fillText(V.isPhase2() ? 'Phase 2 (closed)' : 'Phase 1 (open)', x, y + 20);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 10;
    const pw = 190;
    const ph = 160;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Bezique', px + 10, py + 8);

    S._ctx.font = '12px sans-serif';
    let y = py + 28;

    S._ctx.fillStyle = '#8f8';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('You:', px + 10, y);
    S._ctx.textAlign = 'right';
    S._ctx.fillText(S.playerTotalScore + ' (melds: ' + S.playerMeldScore + ')', px + pw - 10, y);
    y += 18;

    S._ctx.fillStyle = '#faa';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI:', px + 10, y);
    S._ctx.textAlign = 'right';
    S._ctx.fillText(S.aiTotalScore + ' (melds: ' + S.aiMeldScore + ')', px + pw - 10, y);
    y += 22;

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Deal: ' + S.dealNumber + '  |  Tricks: ' + S.trickCount, px + 10, y);
    y += 14;
    S._ctx.fillText('Stock: ' + S.stock.length + (S.trumpCard ? '+1' : ''), px + 10, y);
    y += 14;
    S._ctx.fillText('Goal: ' + GAME_WIN_SCORE + ' pts', px + 10, y);

    // Show recent melds
    y += 16;
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 10px sans-serif';
    S._ctx.fillText('Melds declared:', px + 10, y);
    y += 12;
    S._ctx.font = '9px sans-serif';
    const allMelds = S.playerMeldCards.concat(S.aiMeldCards);
    const recentMelds = allMelds.slice(-4);
    for (const m of recentMelds) {
      S._ctx.fillStyle = '#ccc';
      S._ctx.fillText(m.name + ': +' + m.points, px + 10, y);
      y += 11;
    }

    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.playerHand;
    const total = hand.length;
    if (total === 0) return;

    const hintIndices = (S._host && S._host.hintsEnabled) ? V.getHintIndices() : [];

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (S.phase === PHASE_PLAY && i === S.hoverCardIdx && S.currentTurn === 0)
        y -= 12;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      if (hintIndices.includes(i) && S.phase === PHASE_PLAY && S.currentTurn === 0)
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Dim invalid cards in phase 2
      if (V.isPhase2() && S.phase === PHASE_PLAY && S.currentTurn === 0 && S.trickCards.length > 0) {
        if (!V.isValidPlayPhase2(i, hand)) {
          S._ctx.save();
          S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
          CE.drawRoundedRect(S._ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
          S._ctx.fill();
          S._ctx.restore();
        }
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
    // Subtle trick area outline
    S._ctx.save();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    S._ctx.lineWidth = 2;
    CE.drawRoundedRect(S._ctx, CANVAS_W / 2 - 80, 200, 160, 180, 10);
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
      S._ctx.fillText(who + ' the trick', CANVAS_W / 2, 195);
    }
  }

  function drawCapturedPiles() {
    // Player captured pile
    const pcx = CANVAS_W - 90;
    const pcy = CANVAS_H - CE.CARD_H * 0.5 - 40;
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

    // AI captured pile
    const acx = CANVAS_W - 90;
    const acy = 80;
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

  function drawPlayingUI() {
    if (S.currentTurn === 0 && S.phase === PHASE_PLAY && !S.roundOver) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(V.isPhase2() ? 'Your turn \u2014 must follow suit and win if possible' : 'Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawMeldSelectUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 200;
    const py = 160;
    const pw = 400;
    const lineH = 32;
    const ph = 50 + S.pendingMeldOptions.length * lineH + 40;

    S._ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Declare a Meld!', CANVAS_W / 2, py + 12);

    for (let i = 0; i < S.pendingMeldOptions.length; ++i) {
      const m = S.pendingMeldOptions[i];
      const bx = px + 20;
      const by = py + 44 + i * lineH;
      const bw = pw - 40;
      const bh = 26;
      const isHover = S.hoverMeldBtn === i;
      CE.drawButton(S._ctx, bx, by, bw, bh, m.name + ' (+' + m.points + ' pts)', {
        bg: isHover ? '#2a6a2a' : '#1a4a1a',
        border: isHover ? '#8f8' : '#4a4',
        textColor: '#fff',
        fontSize: 12
      });
    }

    // Skip button
    const skipY = py + 44 + S.pendingMeldOptions.length * lineH;
    const skipW = 100;
    const skipX = CANVAS_W / 2 - skipW / 2;
    const isHoverSkip = S.hoverMeldBtn === S.pendingMeldOptions.length;
    CE.drawButton(S._ctx, skipX, skipY, skipW, 26, 'Skip', {
      bg: isHoverSkip ? '#633' : '#422',
      border: isHoverSkip ? '#a66' : '#644',
      textColor: '#fff',
      fontSize: 12
    });

    S._ctx.restore();
  }

  function drawRoundOverUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 180;
    const py = 140;
    const pw = 360;
    const ph = 260;

    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';

    if (S.gameOver) {
      const won = S.playerTotalScore >= GAME_WIN_SCORE;
      S._ctx.fillStyle = won ? '#4f4' : '#f44';
      S._ctx.fillText(won ? 'You Win the Game!' : 'AI Wins the Game!', CANVAS_W / 2, py + 16);
    } else {
      S._ctx.fillText('Deal Complete', CANVAS_W / 2, py + 16);
    }

    let y = py + 48;
    S._ctx.font = '13px sans-serif';

    S._ctx.fillStyle = '#ff0';
    S._ctx.fillText('Deal ' + S.dealNumber + ' Results', CANVAS_W / 2, y);
    y += 22;

    const playerBrisques = V.countBrisques(S.playerCaptured);
    const aiBrisques = V.countBrisques(S.aiCaptured);

    S._ctx.fillStyle = '#8f8';
    S._ctx.fillText('You: Melds ' + S.playerMeldScore + ' + Brisques ' + playerBrisques, CANVAS_W / 2, y);
    y += 18;

    S._ctx.fillStyle = '#faa';
    S._ctx.fillText('AI: Melds ' + S.aiMeldScore + ' + Brisques ' + aiBrisques, CANVAS_W / 2, y);
    y += 24;

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.fillText('You: ' + S.playerTotalScore + ' / ' + GAME_WIN_SCORE, CANVAS_W / 2, y);
    y += 20;

    S._ctx.fillStyle = '#faa';
    S._ctx.fillText('AI: ' + S.aiTotalScore + ' / ' + GAME_WIN_SCORE, CANVAS_W / 2, y);
    y += 30;

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText(S.gameOver ? 'Click to start a new game' : 'Click to deal next hand', CANVAS_W / 2, y);

    S._ctx.restore();
  }

  function drawBezique() {
    // Title
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Bezique', 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Deal ' + S.dealNumber + '  \u2014  First to ' + GAME_WIN_SCORE, 10, 28);

    drawTrumpIndicator();
    drawStock();
    drawScorePanel();
    drawCapturedPiles();
    drawAIHand();
    drawTrickArea();
    drawPlayerHand();

    if (S.phase === PHASE_PLAY)
      drawPlayingUI();
    else if (S.phase === PHASE_MELD_SELECT)
      drawMeldSelectUI();
    else if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  function draw(ctx, W, H) {
    S._ctx = ctx;
    drawBezique();
  }

  V.playerCardX = playerCardX;
  V.draw = draw;

})();
