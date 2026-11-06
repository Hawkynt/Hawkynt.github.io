/* Pinochle - drawing of the table, hands and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.pinochle;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, HAND_SIZE, MIN_BID, BID_STEP,
    GAME_WIN_SCORE, PLAYER_NAMES, TEAM_A, TEAM_B, PHASE_BIDDING,
    PHASE_TRUMP_SELECT, PHASE_MELDING, PHASE_PLAYING, PHASE_TRICK_DONE,
    PHASE_ROUND_SCORE, PLAYER_HAND_Y
  } = V;

  const SUIT_NAMES = { spades: '\u2660 Spades', hearts: '\u2665 Hearts', diamonds: '\u2666 Diamonds', clubs: '\u2663 Clubs' };

  /* ================================================================
     DRAWING - LAYOUT
     ================================================================ */

  function playerCardX(idx, total) {
    const maxSpread = CANVAS_W - 240;
    const spacing = Math.min(48, maxSpread / Math.max(total, 1));
    const totalWidth = (total - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2 - 40;
    return startX + idx * spacing;
  }

  const TRICK_POS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2 - 40, y: 310 },
    { x: CANVAS_W / 2 - CE.CARD_W - 80, y: 260 },
    { x: CANVAS_W / 2 - CE.CARD_W / 2 - 40, y: 200 },
    { x: CANVAS_W / 2 + 10, y: 260 }
  ];

  const AI_POS = [
    null,
    { x: 20, y: 160, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 180, y: 20, dir: 'horizontal', label: 'Partner (N)' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* ================================================================
     DRAWING - SCORE PANEL
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 195;
    const py = 10;
    const pw = 185;
    const ph = 155;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    S._ctx.lineWidth = 1;
    S._ctx.stroke();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Pinochle', px + 10, py + 6);

    S._ctx.font = '11px sans-serif';
    let y = py + 24;

    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('Team A (You+Partner)', px + 10, y);
    y += 14;
    S._ctx.fillStyle = '#fff';
    S._ctx.fillText('Score: ' + S.teamScores[TEAM_A], px + 10, y);
    y += 16;

    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('Team B (West+East)', px + 10, y);
    y += 14;
    S._ctx.fillStyle = '#fff';
    S._ctx.fillText('Score: ' + S.teamScores[TEAM_B], px + 10, y);
    y += 18;

    if (S.trumpSuit) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 11px sans-serif';
      S._ctx.fillText('Trump: ' + SUIT_NAMES[S.trumpSuit], px + 10, y);
      y += 14;
    }
    if (S.highBidder >= 0) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.fillText('Bid: ' + S.highBid + ' (' + PLAYER_NAMES[S.highBidder] + ')', px + 10, y);
      y += 14;
    }
    if (S.phase === PHASE_PLAYING || S.phase === PHASE_TRICK_DONE) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '10px sans-serif';
      S._ctx.fillText('Trick ' + (S.trickCount + 1) + '/' + HAND_SIZE, px + 10, y);
    }

    S._ctx.restore();
  }

  /* ================================================================
     DRAWING - HANDS
     ================================================================ */

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (S.phase === PHASE_PLAYING && i === S.hoverCardIdx && S.currentTurn === 0)
        y -= 10;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYING && S.currentTurn === 0) {
        if (V.isValidPlay(hand[i], hand))
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }

      // Dim invalid cards
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
      const pos = AI_POS[p];
      const count = S.hands[p].length;

      S._ctx.fillStyle = (S.currentTurn === p && S.phase === PHASE_PLAYING) ? '#ff0' : '#aaa';
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
        S._ctx.fillStyle = (S.currentTurn === p && S.phase === PHASE_PLAYING) ? '#ff0' : '#aaa';
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

  /* ================================================================
     DRAWING - TRICK AREA
     ================================================================ */

  function drawTrickArea() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(255,255,255,0.04)';
    S._ctx.beginPath();
    S._ctx.arc(CANVAS_W / 2 - 40, 280, 90, 0, Math.PI * 2);
    S._ctx.fill();
    S._ctx.restore();

    for (let i = 0; i < S.trickCards.length; ++i) {
      const playerIdx = S.trickPlayers[i];
      const pos = TRICK_POS[playerIdx];
      CE.drawCardFace(S._ctx, pos.x, pos.y, S.trickCards[i]);
    }

    if (S.phase === PHASE_TRICK_DONE && S.trickWinnerIdx >= 0) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      const who = S.trickWinnerIdx === 0 ? 'You take' : PLAYER_NAMES[S.trickWinnerIdx] + ' takes';
      S._ctx.fillText(who + ' the trick', CANVAS_W / 2 - 40, 185);
    }
  }

  /* ================================================================
     DRAWING - BIDDING UI
     ================================================================ */

  const BID_BTN_W = 50;
  const BID_BTN_H = 28;

  function getBidButtons() {
    const nextMin = S.highBid > 0 ? S.highBid + BID_STEP : MIN_BID;
    const bids = [];
    for (let b = nextMin; b <= nextMin + BID_STEP * 4 && b <= 100; b += BID_STEP)
      bids.push(b);
    bids.push(0); // pass
    return bids;
  }

  function bidBtnRect(idx, total) {
    const totalW = total * (BID_BTN_W + 4) - 4;
    const startX = (CANVAS_W - totalW) / 2 - 40;
    return { x: startX + idx * (BID_BTN_W + 4), y: 340, w: BID_BTN_W, h: BID_BTN_H };
  }

  function drawBiddingUI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Bidding Phase', CANVAS_W / 2 - 40, 220);

    // Show current bid info
    S._ctx.font = '13px sans-serif';
    S._ctx.fillStyle = '#aaa';
    if (S.highBidder >= 0)
      S._ctx.fillText('High bid: ' + S.highBid + ' by ' + PLAYER_NAMES[S.highBidder], CANVAS_W / 2 - 40, 248);
    else
      S._ctx.fillText('Minimum bid: ' + MIN_BID, CANVAS_W / 2 - 40, 248);

    // Show bid status
    let y = 268;
    S._ctx.font = '12px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.bidPassed[p]) {
        S._ctx.fillStyle = '#888';
        S._ctx.fillText(PLAYER_NAMES[p] + ': Passed', CANVAS_W / 2 - 40, y);
        y += 16;
      }
    }

    if (S.currentBidder === 0 && !S.bidPassed[0]) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '13px sans-serif';
      S._ctx.fillText('Your bid:', CANVAS_W / 2 - 40, 320);

      const btns = getBidButtons();
      for (let i = 0; i < btns.length; ++i) {
        const r = bidBtnRect(i, btns.length);
        const label = btns[i] === 0 ? 'Pass' : '' + btns[i];
        const isHover = S.hoverBidBtn === i;
        const bg = btns[i] === 0 ? (isHover ? '#833' : '#633') : (isHover ? '#2a6a2a' : '#1a4a1a');
        const border = btns[i] === 0 ? '#a66' : '#4a4';
        CE.drawButton(S._ctx, r.x, r.y, r.w, r.h, label, { bg, border, textColor: '#fff', fontSize: 12 });
      }
    } else if (!S.bidPassed[S.currentBidder]) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[S.currentBidder] + ' is thinking...', CANVAS_W / 2 - 40, 320);
    }
  }

  /* ================================================================
     DRAWING - TRUMP SELECTION UI
     ================================================================ */

  function drawTrumpSelectUI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('You won the bid (' + S.highBid + ')!', CANVAS_W / 2 - 40, 220);

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = '14px sans-serif';
    S._ctx.fillText('Select trump suit:', CANVAS_W / 2 - 40, 250);

    const btnW = 90;
    const btnH = 32;
    const gap = 8;
    const totalW = CE.SUITS.length * btnW + (CE.SUITS.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2 - 40;

    for (let i = 0; i < CE.SUITS.length; ++i) {
      const suit = CE.SUITS[i];
      const x = startX + i * (btnW + gap);
      const y = 280;
      const isHover = S.hoveredTrumpSuit === suit;
      const color = (suit === 'hearts' || suit === 'diamonds') ? '#a33' : '#333';
      const bg = isHover ? '#2a5a2a' : '#1a3a1a';
      CE.drawButton(S._ctx, x, y, btnW, btnH, SUIT_NAMES[suit], { bg, border: isHover ? '#8f8' : '#4a4', textColor: '#fff', fontSize: 12 });
    }
  }

  /* ================================================================
     DRAWING - MELDING UI
     ================================================================ */

  function drawMeldingUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const px = CANVAS_W / 2 - 240;
    const py = 150;
    const pw = 400;
    let ph = 40;
    for (const mr of S.meldResults)
      ph += 20 + mr.melds.length * 16;
    ph = Math.max(ph, 100);

    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 8);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Melds (Trump: ' + SUIT_NAMES[S.trumpSuit] + ')', CANVAS_W / 2, py + 10);

    let y = py + 34;
    for (const mr of S.meldResults) {
      const teamColor = V.teamOf(mr.player) === TEAM_A ? '#8cf' : '#f88';
      S._ctx.fillStyle = teamColor;
      S._ctx.font = 'bold 12px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[mr.player] + ' (' + mr.total + ' pts):', px + 16, y);
      y += 16;

      S._ctx.font = '11px sans-serif';
      S._ctx.fillStyle = '#ccc';
      if (mr.melds.length === 0) {
        S._ctx.fillText('  No melds', px + 24, y);
        y += 16;
      } else {
        for (const m of mr.melds) {
          S._ctx.fillText('  ' + m.name + ': ' + m.points, px + 24, y);
          y += 16;
        }
      }
      y += 4;
    }

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    const remaining = Math.max(0, Math.ceil(S.meldDisplayTimer));
    S._ctx.fillText('Starting play in ' + remaining + 's...', CANVAS_W / 2, y + 4);
    S._ctx.restore();
  }

  /* ================================================================
     DRAWING - ROUND SCORE UI
     ================================================================ */

  function drawRoundScoreUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.7)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';

    if (S.gameOver) {
      const won = S.teamScores[TEAM_A] >= GAME_WIN_SCORE;
      S._ctx.fillStyle = won ? '#4f4' : '#f44';
      S._ctx.fillText(won ? 'Your Team Wins!' : 'Opponents Win!', CANVAS_W / 2, 180);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = '16px sans-serif';
      S._ctx.fillText('Team A: ' + S.teamScores[TEAM_A] + '  |  Team B: ' + S.teamScores[TEAM_B], CANVAS_W / 2, 220);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Click to start a new game', CANVAS_W / 2, 260);
    } else {
      S._ctx.fillText('Round ' + S.roundNumber + ' Complete', CANVAS_W / 2, 170);

      let y = 210;
      S._ctx.font = '14px sans-serif';

      const bidTeam = V.teamOf(S.highBidder);
      const bidTeamName = bidTeam === TEAM_A ? 'Team A' : 'Team B';
      const otherName = bidTeam === TEAM_A ? 'Team B' : 'Team A';
      const bidMet = S.trickPointsWon[bidTeam] >= S.highBid;

      S._ctx.fillStyle = '#ff0';
      S._ctx.fillText(PLAYER_NAMES[S.highBidder] + ' bid ' + S.highBid + ' (Trump: ' + SUIT_NAMES[S.trumpSuit] + ')', CANVAS_W / 2, y);
      y += 24;

      S._ctx.fillStyle = bidMet ? '#8cf' : '#f44';
      S._ctx.fillText(bidTeamName + ': ' + S.trickPointsWon[bidTeam] + ' pts ' + (bidMet ? '(made it!)' : '(SET! -' + S.highBid + ')'), CANVAS_W / 2, y);
      y += 22;

      const otherTeam = bidTeam === TEAM_A ? TEAM_B : TEAM_A;
      S._ctx.fillStyle = '#f88';
      S._ctx.fillText(otherName + ': ' + S.trickPointsWon[otherTeam] + ' pts', CANVAS_W / 2, y);
      y += 28;

      S._ctx.fillStyle = '#8cf';
      S._ctx.fillText('Team A Total: ' + S.teamScores[TEAM_A], CANVAS_W / 2, y);
      y += 20;
      S._ctx.fillStyle = '#f88';
      S._ctx.fillText('Team B Total: ' + S.teamScores[TEAM_B], CANVAS_W / 2, y);
      y += 30;

      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Click to deal next round', CANVAS_W / 2, y);
    }
    S._ctx.restore();
  }

  /* ================================================================
     DRAWING - STATUS BAR
     ================================================================ */

  function drawStatusBar() {
    if (S.phase !== PHASE_PLAYING) return;
    if (S.currentTurn === 0 && S.trickCards.length < NUM_PLAYERS && !S.roundOver) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    } else if (S.currentTurn !== 0 && !S.roundOver) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText(PLAYER_NAMES[S.currentTurn] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  /* ================================================================
     DRAWING - MAIN
     ================================================================ */

  function drawAll() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Pinochle', 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Round ' + (S.roundNumber + 1) + ' \u2014 Dealer: ' + PLAYER_NAMES[S.dealer], 10, 28);

    drawScorePanel();
    drawAIHands();

    if (S.phase === PHASE_PLAYING || S.phase === PHASE_TRICK_DONE) {
      drawTrickArea();
      drawStatusBar();
    }

    drawPlayerHand();

    if (S.phase === PHASE_BIDDING)
      drawBiddingUI();
    else if (S.phase === PHASE_TRUMP_SELECT)
      drawTrumpSelectUI();
    else if (S.phase === PHASE_MELDING)
      drawMeldingUI();
    else if (S.phase === PHASE_ROUND_SCORE)
      drawRoundScoreUI();
  }

  Object.assign(V, {
    playerCardX, getBidButtons, bidBtnRect, drawAll
  });

})();
