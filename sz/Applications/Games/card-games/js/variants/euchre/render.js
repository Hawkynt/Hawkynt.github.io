/* Euchre - drawing of the table, hands and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.euchre;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, NUM_PLAYERS, WIN_SCORE,
    PLAYER_NAMES, TEAM_A, TEAM_B, PHASE_TRUMP_ROUND1, PHASE_TRUMP_ROUND2,
    PHASE_DISCARD, PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_SCORE,
    PHASE_GAME_OVER, PLAYER_HAND_Y
  } = V;

  /* ================================================================
     DRAWING - LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 500;
    const fanWidth = Math.min(maxWidth, total * 60);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  const TRICK_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },
    { x: CANVAS_W / 2 - CE.CARD_W - 50, y: 250 },
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 190 },
    { x: CANVAS_W / 2 + 50, y: 250 }
  ];

  const AI_HAND_POSITIONS = [
    null,
    { x: 20, y: 160, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 120, y: 10, dir: 'horizontal', label: 'Partner (N)' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* ── Bidding button positions ── */
  const BTN_W = 100;
  const BTN_H = 30;
  const BTN_GAP = 12;
  const BTN_Y = 350;

  function orderUpBtnRect() {
    return { x: CANVAS_W / 2 - BTN_W - BTN_GAP / 2, y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  function passBtnRect() {
    return { x: CANVAS_W / 2 + BTN_GAP / 2, y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  function aloneBtnRect() {
    return { x: CANVAS_W / 2 - BTN_W / 2, y: BTN_Y + BTN_H + 8, w: BTN_W, h: BTN_H };
  }

  /* Suit selection buttons for round 2 (3 buttons, excluding kitty suit) */
  function suitBtnRect(idx) {
    const totalW = 3 * 80 + 2 * 8;
    const startX = (CANVAS_W - totalW) / 2;
    return { x: startX + idx * 88, y: BTN_Y, w: 80, h: BTN_H };
  }

  function passR2BtnRect() {
    return { x: CANVAS_W / 2 - BTN_W / 2, y: BTN_Y + BTN_H + 8, w: BTN_W, h: BTN_H };
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 190;
    const py = 10;
    const pw = 180;
    const ph = 120;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.55)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    S._ctx.lineWidth = 1;
    S._ctx.stroke();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Euchre', px + 10, py + 8);

    S._ctx.font = '11px sans-serif';
    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('Team A (You+Partner)', px + 10, py + 28);
    S._ctx.textAlign = 'right';
    S._ctx.fillText('' + S.teamScores[TEAM_A], px + pw - 10, py + 28);

    S._ctx.textAlign = 'left';
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('Team B (West+East)', px + 10, py + 44);
    S._ctx.textAlign = 'right';
    S._ctx.fillText('' + S.teamScores[TEAM_B], px + pw - 10, py + 44);

    // Tricks this round
    if (S.phase >= PHASE_PLAYING && S.phase <= PHASE_ROUND_SCORE) {
      S._ctx.textAlign = 'left';
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '10px sans-serif';
      S._ctx.fillText('Tricks: A=' + S.tricksWon[TEAM_A] + '  B=' + S.tricksWon[TEAM_B], px + 10, py + 64);
    }

    // Trump indicator
    if (S.trumpSuit) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText('Trump: ' + SUIT_SYMBOLS[S.trumpSuit] + ' ' + SUIT_NAMES[S.trumpSuit], px + 10, py + 80);
      if (S.goingAlone) {
        S._ctx.fillStyle = '#f80';
        S._ctx.fillText('Going Alone!', px + 10, py + 96);
      }
    }

    // Dealer indicator
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Dealer: ' + PLAYER_NAMES[S.dealer], px + 10, py + (S.trumpSuit ? 108 : 64));

    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      const isHover = i === S.hoveredCard && (S.phase === PHASE_PLAYING || S.phase === PHASE_DISCARD) && S.currentTurn === 0;
      if (isHover) y -= 10;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      // Hint glow for valid plays
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYING && S.currentTurn === 0 && V.isValidPlay(hand[i], hand))
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Hint glow for discard phase
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_DISCARD && !V.isTrump(hand[i]))
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Dim invalid cards during play
      if (S.phase === PHASE_PLAYING && S.currentTurn === 0 && !V.isValidPlay(hand[i], hand)) {
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
      const hand = S.hands[p];
      const pos = AI_HAND_POSITIONS[p];
      if (!pos) continue;

      const count = hand.length;
      const isOut = V.isSkipped(p);
      const isCurrent = S.currentTurn === p && S.phase === PHASE_PLAYING;

      S._ctx.fillStyle = isOut ? '#666' : (isCurrent ? '#ff0' : '#aaa');
      S._ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';

      const label = pos.label + (isOut ? ' (out)' : ' (' + count + ')');

      if (pos.dir === 'horizontal') {
        S._ctx.fillText(label, CANVAS_W / 2, pos.y);
        const spacing = Math.min(22, 240 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + CE.CARD_W * 0.5;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(S._ctx, startX + i * spacing, pos.y + 4, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
      } else {
        const lx = p === 1 ? pos.x + 20 : pos.x;
        S._ctx.fillText(label, lx + CE.CARD_W * 0.25, pos.y - 2);
        const spacing = Math.min(18, 200 / Math.max(count, 1));
        for (let i = 0; i < count; ++i) {
          const cx = pos.x + (p === 1 ? 5 : -CE.CARD_W * 0.5 + 5);
          CE.drawCardBack(S._ctx, cx, pos.y + 14 + i * spacing, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
        }
      }
    }
  }

  function drawTrickArea() {
    // Subtle center
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(255,255,255,0.04)';
    S._ctx.beginPath();
    S._ctx.arc(CANVAS_W / 2, 280, 90, 0, Math.PI * 2);
    S._ctx.fill();
    S._ctx.restore();

    for (let i = 0; i < S.trickCards.length; ++i) {
      const playerIdx = S.trickPlayers[i];
      const pos = TRICK_POSITIONS[playerIdx];
      CE.drawCardFace(S._ctx, pos.x, pos.y, S.trickCards[i]);
    }

    if (S.phase === PHASE_TRICK_DONE && S.trickWinnerIdx >= 0) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      const who = S.trickWinnerIdx === 0 ? 'You take' : PLAYER_NAMES[S.trickWinnerIdx] + ' takes';
      S._ctx.fillText(who + ' the trick', CANVAS_W / 2, 170);
    }
  }

  function drawKittyCard() {
    if (!S.kittyCard) return;
    const kx = CANVAS_W / 2 - CE.CARD_W / 2;
    const ky = 230;
    CE.drawCardFace(S._ctx, kx, ky, S.kittyCard);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Kitty card', CANVAS_W / 2, ky + CE.CARD_H + 4);
  }

  function drawTrumpRound1UI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Trump Selection \u2014 Round 1', CANVAS_W / 2, 180);

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Kitty shows ' + SUIT_SYMBOLS[S.kittyCard.suit] + ' ' + S.kittyCard.rank + ' of ' + SUIT_NAMES[S.kittyCard.suit], CANVAS_W / 2, 200);

    drawKittyCard();

    if (S.biddingPlayer === 0) {
      const ob = orderUpBtnRect();
      const pb = passBtnRect();
      const ab = aloneBtnRect();
      CE.drawButton(S._ctx, ob.x, ob.y, ob.w, ob.h, 'Order Up', { bg: S.hoveredBtn === 'order' ? '#3a6a3a' : '#2a5a2a', border: '#6c6', fontSize: 12 });
      CE.drawButton(S._ctx, pb.x, pb.y, pb.w, pb.h, 'Pass', { bg: S.hoveredBtn === 'pass' ? '#6a3a3a' : '#5a2a2a', border: '#c66', fontSize: 12 });
      CE.drawButton(S._ctx, ab.x, ab.y, ab.w, ab.h, 'Order Alone', { bg: S.hoveredBtn === 'alone' ? '#6a6a2a' : '#5a5a1a', border: '#cc6', fontSize: 11 });
    } else {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[S.biddingPlayer] + ' is deciding...', CANVAS_W / 2, BTN_Y + 15);
    }
  }

  function drawTrumpRound2UI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Trump Selection \u2014 Round 2', CANVAS_W / 2, 200);

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '12px sans-serif';
    const kittyS = S.kittyCard ? S.kittyCard.suit : null;
    S._ctx.fillText('Name any suit except ' + (kittyS ? SUIT_NAMES[kittyS] : '?'), CANVAS_W / 2, 220);

    if (S.biddingPlayer === S.dealer) {
      S._ctx.fillStyle = '#f80';
      S._ctx.font = '11px sans-serif';
      S._ctx.fillText('(Stuck dealer \u2014 must pick)', CANVAS_W / 2, 238);
    }

    if (S.biddingPlayer === 0) {
      let suitIdx = 0;
      for (const s of CE.SUITS) {
        if (s === kittyS) continue;
        const r = suitBtnRect(suitIdx);
        const col = (s === 'hearts' || s === 'diamonds') ? '#8a2a2a' : '#2a2a6a';
        const colHover = (s === 'hearts' || s === 'diamonds') ? '#aa4a4a' : '#4a4a8a';
        CE.drawButton(S._ctx, r.x, r.y, r.w, r.h, SUIT_SYMBOLS[s] + ' ' + SUIT_NAMES[s], { bg: S.hoveredBtn === s ? colHover : col, border: '#aaa', fontSize: 11 });
        ++suitIdx;
      }
      if (S.biddingPlayer !== S.dealer) {
        const pb = passR2BtnRect();
        CE.drawButton(S._ctx, pb.x, pb.y, pb.w, pb.h, 'Pass', { bg: S.hoveredBtn === 'pass2' ? '#6a3a3a' : '#5a2a2a', border: '#c66', fontSize: 12 });
      }
    } else {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[S.biddingPlayer] + ' is deciding...', CANVAS_W / 2, BTN_Y + 15);
    }
  }

  function drawDiscardUI() {
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('You are the dealer \u2014 pick up the kitty card and discard one', CANVAS_W / 2, 260);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Click a card in your hand to discard it', CANVAS_W / 2, 280);
  }

  function drawPlayingUI() {
    if (S.currentTurn === 0 && S.trickCards.length < (S.goingAlone ? 3 : 4) && !S.roundOver) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Trick ' + (S.trickCount + 1) + '/5', 10, CANVAS_H - 16);
  }

  function drawRoundScoreUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 160;
    const py = 160;
    const pw = 320;
    const ph = 200;

    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Round Complete', CANVAS_W / 2, py + 14);

    S._ctx.font = '13px sans-serif';
    const callerName = S.callingTeam === TEAM_A ? 'Team A' : 'Team B';
    S._ctx.fillStyle = '#ccc';
    S._ctx.fillText(callerName + ' called trump (' + SUIT_SYMBOLS[S.trumpSuit] + ')', CANVAS_W / 2, py + 40);

    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('Team A tricks: ' + S.tricksWon[TEAM_A] + '   Score: ' + S.teamScores[TEAM_A], CANVAS_W / 2, py + 68);
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('Team B tricks: ' + S.tricksWon[TEAM_B] + '   Score: ' + S.teamScores[TEAM_B], CANVAS_W / 2, py + 88);

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 14px sans-serif';
    const lines = S.roundMessage.split('\n');
    for (let i = 0; i < lines.length; ++i)
      S._ctx.fillText(lines[i], CANVAS_W / 2, py + 116 + i * 18);

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Click to continue', CANVAS_W / 2, py + ph - 22);
    S._ctx.restore();
  }

  function drawGameOverUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.8)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const won = S.teamScores[TEAM_A] >= WIN_SCORE;
    S._ctx.fillStyle = won ? '#4f4' : '#f44';
    S._ctx.font = 'bold 24px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(won ? 'You Win!' : 'You Lose!', CANVAS_W / 2, 220);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = '16px sans-serif';
    S._ctx.fillText('Team A: ' + S.teamScores[TEAM_A] + '  |  Team B: ' + S.teamScores[TEAM_B], CANVAS_W / 2, 260);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '14px sans-serif';
    S._ctx.fillText('Click to start a new game', CANVAS_W / 2, 300);
    S._ctx.restore();
  }

  function drawAll() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Euchre', 10, 10);

    drawScorePanel();
    drawAIHands();

    if (S.phase === PHASE_TRUMP_ROUND1) {
      drawTrumpRound1UI();
      drawPlayerHand();
    } else if (S.phase === PHASE_TRUMP_ROUND2) {
      drawTrumpRound2UI();
      drawPlayerHand();
    } else if (S.phase === PHASE_DISCARD) {
      drawDiscardUI();
      drawPlayerHand();
    } else if (S.phase >= PHASE_PLAYING && S.phase <= PHASE_TRICK_DONE) {
      drawTrickArea();
      drawPlayerHand();
      drawPlayingUI();
    } else if (S.phase === PHASE_ROUND_SCORE) {
      drawRoundScoreUI();
    } else if (S.phase === PHASE_GAME_OVER) {
      drawGameOverUI();
    }
  }

  Object.assign(V, {
    playerCardX, orderUpBtnRect, passBtnRect, aloneBtnRect, suitBtnRect,
    passR2BtnRect, drawAll
  });

})();
