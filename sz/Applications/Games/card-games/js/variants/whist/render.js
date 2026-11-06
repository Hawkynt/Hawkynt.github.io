/* Whist - drawing of the table, hands and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.whist;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, WINNING_SCORE, BOOK_SIZE, PLAYER_NAMES, TEAM_NS,
    TEAM_EW, PHASE_TRUMP_REVEAL, PHASE_PLAYING, PHASE_ROUND_OVER,
    PLAYER_HAND_Y
  } = V;

  const SUIT_SYMBOLS = T.SUIT_SYMBOLS;
  const SUIT_COLORS = { spades: '#000', hearts: '#d00', diamonds: '#d00', clubs: '#000' };

  /* ================================================================
     LAYOUT CONSTANTS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxSpread = CANVAS_W - 200;
    const spacing = Math.min(52, maxSpread / Math.max(total, 1));
    const totalWidth = (total - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + idx * spacing;
  }

  /* Trick card positions: center of canvas, arranged by seat */
  const TRICK_POS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },         // South (player)
    { x: CANVAS_W / 2 - CE.CARD_W - 40, y: 260 },         // West
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 210 },          // North (partner)
    { x: CANVAS_W / 2 + 40, y: 260 }                       // East
  ];

  /* AI hand display positions */
  const AI_POS = [
    null,
    { x: 20, y: 160, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 180, y: 20, dir: 'horizontal', label: 'Partner (N)' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 220;
    const py = 10;
    const pw = 210;
    const ph = 130;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    S._ctx.lineWidth = 1;
    S._ctx.stroke();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Whist Scoreboard', px + 10, py + 8);

    S._ctx.font = '11px sans-serif';
    const lh = 15;
    let y = py + 28;

    // Trump indicator
    if (S.trumpSuit) {
      const sym = SUIT_SYMBOLS[S.trumpSuit];
      const col = SUIT_COLORS[S.trumpSuit] === '#d00' ? '#f66' : '#ccc';
      S._ctx.fillStyle = col;
      S._ctx.fillText('Trump: ' + sym + ' ' + S.trumpSuit.charAt(0).toUpperCase() + S.trumpSuit.slice(1), px + 10, y);
      y += lh + 2;
    }

    // Team headers
    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('NS (You + Partner)', px + 10, y);
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('EW (W + E)', px + 120, y);
    y += lh + 2;

    // Game points
    S._ctx.fillStyle = '#fff';
    S._ctx.fillText('Points: ' + S.teamScores[TEAM_NS], px + 10, y);
    S._ctx.fillText('Points: ' + S.teamScores[TEAM_EW], px + 120, y);
    y += lh;

    // Current round tricks
    const nsTricks = S.tricksWon[0] + S.tricksWon[2];
    const ewTricks = S.tricksWon[1] + S.tricksWon[3];
    S._ctx.fillStyle = '#aaa';
    S._ctx.fillText('Tricks: ' + nsTricks + '/13', px + 10, y);
    S._ctx.fillText('Tricks: ' + ewTricks + '/13', px + 120, y);
    y += lh;

    // Book progress
    const nsBook = Math.max(0, nsTricks - BOOK_SIZE);
    const ewBook = Math.max(0, ewTricks - BOOK_SIZE);
    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('Over book: ' + nsBook, px + 10, y);
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('Over book: ' + ewBook, px + 120, y);

    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Your Hand', CANVAS_W / 2, PLAYER_HAND_Y - 4);

    for (let i = 0; i < total; ++i) {
      const x = playerCardX(i, total);
      const yOff = (i === S.hoveredCard && S.phase === PHASE_PLAYING && S.currentTurn === 0) ? -10 : 0;

      if (S.phase === PHASE_PLAYING && S.currentTurn === 0 && V.isValidPlay(hand[i], hand)) {
        S._ctx.save();
        S._ctx.shadowColor = '#4f4';
        S._ctx.shadowBlur = 8;
        CE.drawCardFace(S._ctx, x, PLAYER_HAND_Y + yOff, hand[i]);
        S._ctx.restore();
      } else
        CE.drawCardFace(S._ctx, x, PLAYER_HAND_Y + yOff, hand[i]);

      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYING && S.currentTurn === 0 && V.isValidPlay(hand[i], hand))
        CE.drawHintGlow(S._ctx, x, PLAYER_HAND_Y + yOff, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Dim invalid cards
      if (S.phase === PHASE_PLAYING && S.currentTurn === 0 && !V.isValidPlay(hand[i], hand)) {
        S._ctx.save();
        S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(S._ctx, x, PLAYER_HAND_Y + yOff, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        S._ctx.fill();
        S._ctx.restore();
      }
    }
  }

  function drawAIHands() {
    for (let p = 1; p < 4; ++p) {
      const pos = AI_POS[p];
      const count = S.hands[p].length;

      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';

      if (pos.dir === 'horizontal') {
        S._ctx.textAlign = 'center';
        S._ctx.fillText(pos.label + ' (' + count + ')', CANVAS_W / 2, pos.y - 2);
        const spacing = Math.min(22, 360 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + CE.CARD_W * 0.5;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(S._ctx, startX + i * spacing, pos.y + 10, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
      } else {
        const spacing = Math.min(18, 250 / Math.max(count, 1));
        const startY = pos.y + 20;

        S._ctx.save();
        S._ctx.translate(pos.x + (p === 1 ? 20 : 0), pos.y);
        S._ctx.fillStyle = '#aaa';
        S._ctx.font = '11px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.textBaseline = 'bottom';
        S._ctx.fillText(pos.label + ' (' + count + ')', CE.CARD_W * 0.25, -2);
        S._ctx.restore();

        for (let i = 0; i < count; ++i) {
          const cx = pos.x + (p === 1 ? 5 : -CE.CARD_W * 0.5 + 5);
          CE.drawCardBack(S._ctx, cx, startY + i * spacing, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
        }
      }
    }
  }

  function drawTrickArea() {
    // Subtle center area
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(255,255,255,0.04)';
    S._ctx.beginPath();
    S._ctx.arc(CANVAS_W / 2, 280, 90, 0, Math.PI * 2);
    S._ctx.fill();
    S._ctx.restore();

    // Draw played cards at their seat positions
    for (let i = 0; i < S.trickCards.length; ++i) {
      const player = S.trickPlayers[i];
      const pos = TRICK_POS[player];
      CE.drawCardFace(S._ctx, pos.x, pos.y, S.trickCards[i]);

      S._ctx.fillStyle = '#ccc';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      const labelY = player === 2 ? pos.y - 12 : pos.y + CE.CARD_H + 3;
      S._ctx.fillText(PLAYER_NAMES[player], pos.x + CE.CARD_W / 2, labelY);
    }

    // Trick winner display
    if (S.trickWinnerDisplay) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.trickWinnerDisplay, CANVAS_W / 2, 195);
    }
  }

  function drawTrumpReveal() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Trump Suit Revealed', CANVAS_W / 2, 180);

    // Draw the trump card in the center
    if (S.trumpCard)
      CE.drawCardFace(S._ctx, CANVAS_W / 2 - CE.CARD_W / 2, 210, S.trumpCard);

    const sym = SUIT_SYMBOLS[S.trumpSuit] || '';
    const col = SUIT_COLORS[S.trumpSuit] === '#d00' ? '#f66' : '#ccc';
    S._ctx.fillStyle = col;
    S._ctx.font = 'bold 20px sans-serif';
    S._ctx.fillText(sym + ' ' + S.trumpSuit.charAt(0).toUpperCase() + S.trumpSuit.slice(1) + ' is trump!', CANVAS_W / 2, 320);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '14px sans-serif';
    S._ctx.fillText(PLAYER_NAMES[S.dealer] + ' dealt \u2014 ' + PLAYER_NAMES[S.currentLead] + ' leads', CANVAS_W / 2, 350);

    const remaining = Math.ceil(S.trumpRevealTimer);
    S._ctx.fillStyle = '#888';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Starting in ' + remaining + '...', CANVAS_W / 2, 380);

    S._ctx.restore();
  }

  function drawRoundOverUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.7)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';

    if (S.gameOver) {
      const nsWin = S.teamScores[TEAM_NS] >= WINNING_SCORE;
      const won = nsWin;
      S._ctx.fillStyle = won ? '#4f4' : '#f44';
      S._ctx.fillText(won ? 'You Win the Game!' : 'Game Over \u2014 You Lose!', CANVAS_W / 2, 180);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = '16px sans-serif';
      S._ctx.fillText('NS: ' + S.teamScores[TEAM_NS] + ' pts  |  EW: ' + S.teamScores[TEAM_EW] + ' pts', CANVAS_W / 2, 220);
      S._ctx.font = '14px sans-serif';
      S._ctx.fillStyle = '#aaa';
      S._ctx.fillText('Click to start a new game', CANVAS_W / 2, 260);
    } else {
      S._ctx.fillText('Round Complete', CANVAS_W / 2, 160);

      S._ctx.font = '14px sans-serif';
      let y = 200;

      const nsTricks = S.tricksWon[0] + S.tricksWon[2];
      const ewTricks = S.tricksWon[1] + S.tricksWon[3];

      const sym = SUIT_SYMBOLS[S.trumpSuit] || '';
      S._ctx.fillStyle = '#ccc';
      S._ctx.fillText('Trump was: ' + sym + ' ' + S.trumpSuit.charAt(0).toUpperCase() + S.trumpSuit.slice(1), CANVAS_W / 2, y);
      y += 25;

      S._ctx.fillStyle = '#8cf';
      S._ctx.fillText('NS tricks: ' + nsTricks + '  (over book: ' + Math.max(0, nsTricks - BOOK_SIZE) + ')', CANVAS_W / 2, y);
      y += 20;
      S._ctx.fillStyle = '#f88';
      S._ctx.fillText('EW tricks: ' + ewTricks + '  (over book: ' + Math.max(0, ewTricks - BOOK_SIZE) + ')', CANVAS_W / 2, y);
      y += 30;

      S._ctx.fillStyle = '#8cf';
      S._ctx.fillText('NS total: ' + S.teamScores[TEAM_NS] + ' / ' + WINNING_SCORE + ' pts', CANVAS_W / 2, y);
      y += 20;
      S._ctx.fillStyle = '#f88';
      S._ctx.fillText('EW total: ' + S.teamScores[TEAM_EW] + ' / ' + WINNING_SCORE + ' pts', CANVAS_W / 2, y);
      y += 30;

      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Click to deal next round', CANVAS_W / 2, y);
    }
    S._ctx.restore();
  }

  function drawStatusBar() {
    if (!S.statusMessage) return;
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText(S.statusMessage, CANVAS_W / 2, CANVAS_H - 8);
  }

  function drawTrumpIndicator() {
    if (!S.trumpSuit) return;
    const sym = SUIT_SYMBOLS[S.trumpSuit];
    const col = SUIT_COLORS[S.trumpSuit] === '#d00' ? '#f66' : '#ccc';
    S._ctx.fillStyle = col;
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Trump: ' + sym + ' ' + S.trumpSuit.charAt(0).toUpperCase() + S.trumpSuit.slice(1), 15, CANVAS_H - 20);
  }

  function drawAll() {
    drawScorePanel();
    drawAIHands();
    drawTrickArea();
    drawPlayerHand();
    drawTrumpIndicator();

    if (S.phase === PHASE_TRUMP_REVEAL)
      drawTrumpReveal();
    else if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
    else {
      if (S.currentTurn === 0 && S.trickCards.length < 4 && !S.roundOver)
        S.statusMessage = 'Your turn \u2014 click a card to play';
      else if (S.currentTurn !== 0 && !S.roundOver)
        S.statusMessage = PLAYER_NAMES[S.currentTurn] + ' is thinking...';
      else
        S.statusMessage = '';
      drawStatusBar();
    }
  }

  Object.assign(V, {
    playerCardX, drawAll
  });

})();
