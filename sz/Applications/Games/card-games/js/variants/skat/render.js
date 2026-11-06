/* Skat - drawing of the table, hands and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.skat;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, BID_VALUES, PHASE_BIDDING, PHASE_SKAT_PICK,
    PHASE_TRUMP_PICK, PHASE_PLAYING, BID_BTN, PASS_BTN, SKAT_BTN,
    trumpBtns
  } = V;

  const SUIT_NAMES = T.SUIT_NAMES;

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawSkat() {
    // Header
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';

    if (S.phase === PHASE_PLAYING || S.phase === PHASE_SKAT_PICK || S.phase === PHASE_TRUMP_PICK)
      S._ctx.fillText('Skat \u2014 Trump: ' + SUIT_NAMES[S.trumpSuit], 60, 225);

    // Trick area
    for (let i = 0; i < S.trickCards.length; ++i) {
      const x = 350 + i * 80;
      CE.drawCardFace(S._ctx, x, 240, S.trickCards[i]);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.trickPlayers[i] === 0 ? 'You' : 'AI ' + S.trickPlayers[i], x + CE.CARD_W / 2, 240 + CE.CARD_H + 14);
    }

    // Player hand
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    const youRole = S.declarer === 0 ? ' (Declarer)' : S.declarer >= 0 ? ' (Defender)' : '';
    S._ctx.fillText('Your Hand' + youRole, 60, 425);
    for (let i = 0; i < S.skatHands[0].length; ++i) {
      if (S.skatHands[0][i]._dealing) continue;
      const x = 60 + i * 60;
      CE.drawCardFace(S._ctx, x, 440, S.skatHands[0][i]);

      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYING && S.currentTurn === 0 && S.trickCards.length < 3) {
        const leadSuit = S.trickCards.length > 0 ? V.effectiveSuit(S.trickCards[0]) : null;
        if (V.skatIsValid(S.skatHands[0][i], leadSuit, S.skatHands[0]))
          CE.drawHintGlow(S._ctx, x, 440, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }
    }

    // AI hands with role labels
    for (let p = 1; p < 3; ++p) {
      const y = 20 + (p - 1) * 100;
      const isDecl = p === S.declarer;
      S._ctx.fillStyle = isDecl ? '#ff0' : '#aaa';
      S._ctx.font = isDecl ? 'bold 12px sans-serif' : '12px sans-serif';
      S._ctx.textAlign = 'left';
      const role = S.declarer < 0 ? '' : isDecl ? ' \u2014 Declarer' : ' \u2014 Defender';
      S._ctx.fillText('AI ' + p + role + ' (' + S.skatHands[p].length + ' cards)', 60, y + 70);
      for (let i = 0; i < Math.min(S.skatHands[p].length, 10); ++i)
        CE.drawCardBack(S._ctx, 60 + i * 25, y, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Tricks won
    if (S.phase === PHASE_PLAYING) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'right';
      S._ctx.fillText('Tricks: ' + S.tricksWon[0] + ' | Points: ' + S.cardPoints[0], CANVAS_W - 20, 425);
    }

    // Phase-specific UI
    if (S.phase === PHASE_BIDDING)
      drawBiddingUI();
    else if (S.phase === PHASE_SKAT_PICK)
      drawSkatPickUI();
    else if (S.phase === PHASE_TRUMP_PICK)
      drawTrumpPickUI();
    else if (S.phase === PHASE_PLAYING && S.currentTurn === 0 && S.trickCards.length < 3 && !S.roundOver) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 15);
    }
  }

  function drawBiddingUI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Bidding Phase', CANVAS_W / 2, 240);

    if (S.bidMessage) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText(S.bidMessage, CANVAS_W / 2, 268);
    }

    const bidVal = BID_VALUES[Math.min(S.bidCurrent, BID_VALUES.length - 1)];
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '13px sans-serif';
    S._ctx.fillText('Current bid: ' + bidVal, CANVAS_W / 2, 290);

    // Bid button
    S._ctx.fillStyle = '#4a4';
    CE.drawRoundedRect(S._ctx, BID_BTN.x, BID_BTN.y, BID_BTN.w, BID_BTN.h, 4);
    S._ctx.fill();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.fillText('Bid ' + bidVal, BID_BTN.x + BID_BTN.w / 2, BID_BTN.y + BID_BTN.h / 2 + 1);

    // Pass button
    S._ctx.fillStyle = '#a44';
    CE.drawRoundedRect(S._ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 4);
    S._ctx.fill();
    S._ctx.fillStyle = '#fff';
    S._ctx.fillText('Pass', PASS_BTN.x + PASS_BTN.w / 2, PASS_BTN.y + PASS_BTN.h / 2 + 1);
  }

  function drawSkatPickUI() {
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('You are the Declarer! Pick up the Skat (2 cards) or skip.', CANVAS_W / 2, 240);

    // Show skat cards
    for (let i = 0; i < S.skatPile.length; ++i) {
      const x = 400 + i * 80;
      S.skatPile[i].faceUp = true;
      CE.drawCardFace(S._ctx, x, 260, S.skatPile[i]);
    }

    S._ctx.fillStyle = '#4a4';
    CE.drawRoundedRect(S._ctx, SKAT_BTN.x, SKAT_BTN.y, SKAT_BTN.w, SKAT_BTN.h, 4);
    S._ctx.fill();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Pick up Skat & Choose Trump', SKAT_BTN.x + SKAT_BTN.w / 2, SKAT_BTN.y + SKAT_BTN.h / 2 + 1);
  }

  function drawTrumpPickUI() {
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Choose Trump Suit:', CANVAS_W / 2, 260);

    trumpBtns.length = 0;
    for (let i = 0; i < CE.SUITS.length; ++i) {
      const x = 310 + i * 80;
      const y = 280;
      const w = 70;
      const h = 36;
      S._ctx.fillStyle = CE.SUIT_COLORS[CE.SUITS[i]] === '#d00' ? '#c44' : '#444';
      CE.drawRoundedRect(S._ctx, x, y, w, h, 4);
      S._ctx.fill();
      S._ctx.strokeStyle = '#fff';
      S._ctx.lineWidth = 1;
      S._ctx.stroke();
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(SUIT_NAMES[CE.SUITS[i]], x + w / 2, y + h / 2 + 1);
      trumpBtns.push({ x, y, w, h, suit: CE.SUITS[i] });
    }
  }

  Object.assign(V, {
    drawSkat
  });

})();
