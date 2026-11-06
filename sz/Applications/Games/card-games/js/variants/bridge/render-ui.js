/* Bridge - drawing of the score panel, bidding and result overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.bridge;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, SUIT_NAMES, STRAIN_ORDER, STRAIN_SHORT,
    PLAYER_NAMES, PLAYER_SHORT, SOUTH, TEAM_NS, PHASE_PLAYING, BID_AREA_Y,
    PASS_BTN
  } = V;

  const SUIT_SYMBOLS = { clubs: '\u2663', diamonds: '\u2666', hearts: '\u2665', spades: '\u2660' };

  /* ================================================================
     DRAWING - SCORE PANEL
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 8;
    const pw = 192;
    const ph = 158;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    S._ctx.lineWidth = 1;
    S._ctx.stroke();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Contract Bridge', px + 8, py + 6);

    const lh = 14;
    let y = py + 24;

    /* Vulnerability */
    S._ctx.font = '10px sans-serif';
    S._ctx.fillStyle = S.nsVulnerable ? '#f88' : '#8f8';
    S._ctx.fillText('NS: ' + (S.nsVulnerable ? 'Vul' : 'NV'), px + 8, y);
    S._ctx.fillStyle = S.ewVulnerable ? '#f88' : '#8f8';
    S._ctx.fillText('EW: ' + (S.ewVulnerable ? 'Vul' : 'NV'), px + 100, y);
    y += lh + 2;

    /* Games won */
    S._ctx.fillStyle = '#8cf';
    S._ctx.font = '10px sans-serif';
    S._ctx.fillText('Games: NS=' + S.nsGamesWon + '  EW=' + S.ewGamesWon, px + 8, y);
    y += lh + 2;

    /* Below the line */
    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '10px sans-serif';
    S._ctx.fillText('Below:', px + 8, y);
    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('NS ' + S.nsBelow, px + 55, y);
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('EW ' + S.ewBelow, px + 110, y);
    y += lh;

    /* Above the line */
    S._ctx.fillStyle = '#ccc';
    S._ctx.fillText('Above:', px + 8, y);
    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('NS ' + S.nsAboveLine, px + 55, y);
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('EW ' + S.ewAboveLine, px + 110, y);
    y += lh + 4;

    /* Dealer indicator */
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.fillText('Dealer: ' + PLAYER_NAMES[S.dealer], px + 8, y);
    y += lh;

    /* Current contract if in play */
    if (S.contractBid && S.phase >= PHASE_PLAYING) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 11px sans-serif';
      S._ctx.fillText('Contract: ' + S.contractBid.level + STRAIN_SHORT[S.contractBid.strain], px + 8, y);
      y += lh;
      S._ctx.fillStyle = '#ccc';
      S._ctx.font = '10px sans-serif';
      S._ctx.fillText('Declarer: ' + PLAYER_SHORT[S.contractPlayer], px + 8, y);
      S._ctx.fillText('NS:' + S.tricksWonNS + ' EW:' + S.tricksWonEW, px + 100, y);
    }

    S._ctx.restore();
  }

  /* ================================================================
     DRAWING - BIDDING UI
     ================================================================ */

  function drawBiddingUI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Bidding Phase', CANVAS_W / 2, 140);

    S._ctx.font = '11px sans-serif';
    S._ctx.fillStyle = '#aaa';
    S._ctx.fillText('Dealer: ' + PLAYER_NAMES[S.dealer], CANVAS_W / 2, 157);

    /* Draw bid history */
    const histX = 20;
    const histY = 140;
    S._ctx.fillStyle = '#ccc';
    S._ctx.font = 'bold 10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Bid History:', histX, histY);

    S._ctx.font = '10px sans-serif';
    const maxShow = Math.min(S.bidHistory.length, 12);
    const startIdx = Math.max(0, S.bidHistory.length - maxShow);
    for (let i = startIdx; i < S.bidHistory.length; ++i) {
      const h = S.bidHistory[i];
      const row = i - startIdx;
      const y = histY + 14 + row * 13;
      S._ctx.fillStyle = V.teamOf(h.player) === TEAM_NS ? '#8cf' : '#f88';
      const bidStr = h.bid === 'pass' ? 'Pass' : V.bidToString(h.bid);
      S._ctx.fillText(PLAYER_SHORT[h.player] + ': ' + bidStr, histX, y);
    }

    /* If it's the player's turn to bid */
    if (S.biddingPlayer === SOUTH) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your bid:', CANVAS_W / 2 + 40, BID_AREA_Y - 14);

      const lastBid = V.getLastNonPassBid();

      /* Column headers */
      for (let si = 0; si < 5; ++si) {
        const strain = STRAIN_ORDER[si];
        const r = V.bidBtnRect(1, si);
        S._ctx.fillStyle = '#ccc';
        S._ctx.font = 'bold 10px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.textBaseline = 'bottom';
        const sym = STRAIN_SHORT[strain];
        const color = (strain === 'hearts' || strain === 'diamonds') ? '#d66' : '#aaa';
        S._ctx.fillStyle = color;
        S._ctx.fillText(sym, r.x + r.w / 2, r.y - 2);
      }

      /* Draw bid buttons */
      for (let lvl = 1; lvl <= 7; ++lvl) {
        for (let si = 0; si < 5; ++si) {
          const idx = V.bidBtnIndex(lvl, si);
          const r = V.bidBtnRect(lvl, si);
          const candidate = { level: lvl, strain: STRAIN_ORDER[si] };
          const isValid = V.bidIsHigher(candidate, lastBid);

          let bg, border;
          if (!isValid) {
            bg = '#333';
            border = '#555';
          } else if (S.hoveredBidBtn === idx) {
            bg = '#3a6a3a';
            border = '#8c8';
          } else {
            bg = '#1a4a1a';
            border = '#5a5';
          }

          CE.drawButton(S._ctx, r.x, r.y, r.w, r.h, '' + lvl, {
            bg,
            border,
            textColor: isValid ? '#fff' : '#666',
            fontSize: 10
          });
        }
      }

      /* Pass button */
      const pbg = S.hoveredPassBtn ? '#6a3a3a' : '#5a2a2a';
      CE.drawButton(S._ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass', {
        bg: pbg,
        border: '#c66',
        fontSize: 12
      });
    } else {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(PLAYER_NAMES[S.biddingPlayer] + ' is thinking...', CANVAS_W / 2 + 40, BID_AREA_Y + 60);
    }
  }

  /* ================================================================
     DRAWING - CONTRACT DISPLAY
     ================================================================ */

  function drawContractDisplay() {
    if (!S.contractBid) return;

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';

    const strName = S.contractBid.level + STRAIN_SHORT[S.contractBid.strain];
    S._ctx.fillText('Contract: ' + strName + ' by ' + PLAYER_SHORT[S.contractPlayer], 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.fillText('Dummy: ' + PLAYER_SHORT[S.dummyPlayer], 10, 26);

    if (S.trumpSuit) {
      S._ctx.fillStyle = (S.trumpSuit === 'hearts' || S.trumpSuit === 'diamonds') ? '#f88' : '#ccc';
      S._ctx.fillText('Trump: ' + SUIT_SYMBOLS[S.trumpSuit] + ' ' + SUIT_NAMES[S.trumpSuit], 10, 40);
    } else {
      S._ctx.fillStyle = '#8cf';
      S._ctx.fillText('No Trump', 10, 40);
    }
  }

  /* ================================================================
     DRAWING - ROUND OVER UI
     ================================================================ */

  function drawRoundOverUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 180;
    const py = 120;
    const pw = 360;
    const ph = 310;

    S._ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Hand Complete', CANVAS_W / 2, py + 12);

    let y = py + 42;
    S._ctx.font = '13px sans-serif';

    /* Contract info */
    if (S.contractBid) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.fillText('Contract: ' + S.contractBid.level + STRAIN_SHORT[S.contractBid.strain] + ' by ' + PLAYER_NAMES[S.contractPlayer], CANVAS_W / 2, y);
      y += 20;
    }

    /* Tricks */
    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('NS Tricks: ' + S.tricksWonNS, CANVAS_W / 2, y);
    y += 18;
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('EW Tricks: ' + S.tricksWonEW, CANVAS_W / 2, y);
    y += 24;

    /* Result */
    if (S.contractBid) {
      const needed = S.contractBid.level + 6;
      const declTeam = V.teamOf(S.contractPlayer);
      const declTricks = declTeam === TEAM_NS ? S.tricksWonNS : S.tricksWonEW;
      const diff = declTricks - needed;

      if (diff >= 0) {
        S._ctx.fillStyle = '#4f4';
        S._ctx.font = 'bold 14px sans-serif';
        S._ctx.fillText('Made! ' + (diff > 0 ? '+' + diff + ' overtrick' + (diff > 1 ? 's' : '') : 'Exactly'), CANVAS_W / 2, y);
      } else {
        S._ctx.fillStyle = '#f44';
        S._ctx.font = 'bold 14px sans-serif';
        S._ctx.fillText('Down ' + (-diff) + '!', CANVAS_W / 2, y);
      }
      y += 24;
    }

    /* Score summary */
    S._ctx.font = '12px sans-serif';
    S._ctx.fillStyle = '#ccc';
    S._ctx.fillText('Score Summary', CANVAS_W / 2, y);
    y += 18;

    S._ctx.font = '11px sans-serif';
    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('NS \u2014 Below: ' + S.nsBelow + '  Above: ' + S.nsAboveLine + '  Games: ' + S.nsGamesWon, CANVAS_W / 2, y);
    y += 16;
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('EW \u2014 Below: ' + S.ewBelow + '  Above: ' + S.ewAboveLine + '  Games: ' + S.ewGamesWon, CANVAS_W / 2, y);
    y += 16;

    /* Vulnerability */
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.fillText('Vulnerability: NS=' + (S.nsVulnerable ? 'Yes' : 'No') + '  EW=' + (S.ewVulnerable ? 'Yes' : 'No'), CANVAS_W / 2, y);
    y += 24;

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Click to deal next hand', CANVAS_W / 2, y);

    S._ctx.restore();
  }

  /* ================================================================
     DRAWING - GAME OVER UI
     ================================================================ */

  function drawGameOverUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.85)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const nsTot = S.nsAboveLine + S.nsBelow;
    const ewTot = S.ewAboveLine + S.ewBelow;
    const nsWins = nsTot > ewTot;

    S._ctx.fillStyle = nsWins ? '#4f4' : '#f44';
    S._ctx.font = 'bold 26px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(nsWins ? 'Rubber Won!' : 'Rubber Lost!', CANVAS_W / 2, 180);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = '16px sans-serif';
    S._ctx.fillText('NS Total: ' + nsTot + '  |  EW Total: ' + ewTot, CANVAS_W / 2, 220);

    S._ctx.font = '13px sans-serif';
    S._ctx.fillStyle = '#ccc';
    S._ctx.fillText('NS Games: ' + S.nsGamesWon + '  EW Games: ' + S.ewGamesWon, CANVAS_W / 2, 250);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '14px sans-serif';
    S._ctx.fillText('Click to start a new rubber', CANVAS_W / 2, 300);

    S._ctx.restore();
  }

  /* ================================================================
     DRAWING - STATUS BAR
     ================================================================ */

  function drawStatusBar() {
    if (S.phase === PHASE_PLAYING) {
      const ctrl = V.controllerOf(S.currentTurn);
      if (ctrl === SOUTH && S.currentTurn !== SOUTH) {
        S.statusMessage = 'Play a card from dummy\'s hand';
      } else if (ctrl === SOUTH) {
        S.statusMessage = 'Your turn \u2014 click a card to play';
      } else {
        S.statusMessage = PLAYER_NAMES[S.currentTurn] + ' is thinking...';
      }
    }

    if (!S.statusMessage) return;
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText(S.statusMessage, CANVAS_W / 2, CANVAS_H - 4);
  }

  Object.assign(V, {
    drawScorePanel, drawBiddingUI, drawContractDisplay, drawRoundOverUI,
    drawGameOverUI, drawStatusBar
  });

})();
