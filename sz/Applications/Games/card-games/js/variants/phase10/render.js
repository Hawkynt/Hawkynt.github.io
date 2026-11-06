/* Phase 10 drawing: Phase 10 cards, phase info, laid groups and the table. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.phase10;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, PHASES, TURN_DRAW, TURN_PLAY, BTN_PHASE,
    BTN_HIT } = V;

  const COLOR_HEX = { red: '#e33', blue: '#38e', green: '#3a3', yellow: '#ec0' };

  /* ================================================================
     CUSTOM CARD DRAWING
     ================================================================ */

  function drawP10Card(x, y, w, h, card) {
    if (card.type === 'wild')
      CE.drawColorCard(S._ctx, x, y, w, h, { color: 'wild', label: 'W', wild: true }, card);
    else if (card.type === 'skip')
      CE.drawColorCard(S._ctx, x, y, w, h, { color: '#1a1a1a', label: '\u2298', sub: 'SKIP', corner: 'S', ink: '#ffffff' }, card);
    else
      CE.drawColorCard(S._ctx, x, y, w, h, { color: COLOR_HEX[card.color] || '#888888', label: String(card.number) }, card);
  }


  /* ================================================================
     DRAWING
     ================================================================ */

  function drawPhaseInfo(x, y, p) {
    const phIdx = S.playerPhases[p];
    const txt = phIdx >= 10 ? 'DONE' : 'Ph ' + (phIdx + 1);
    S._ctx.fillStyle = phIdx >= 10 ? '#4f4' : '#ccc';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(txt, x, y);
  }

  function drawLaidGroups(x, y, p, scale) {
    const groups = S.laidPhases[p];
    if (groups.length === 0) return;
    let ox = x;
    const cw = CE.CARD_W * scale;
    const ch = CE.CARD_H * scale;
    for (const g of groups) {
      for (const c of g) {
        drawP10Card(ox, y, cw, ch, c);
        ox += cw * 0.55;
      }
      ox += 8;
    }
  }

  function drawGame() {
    // Top: AI hands
    const aiY = 10;
    const aiCardW = CE.CARD_W * 0.5;
    const aiCardH = CE.CARD_H * 0.5;
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const baseX = 20 + (p - 1) * 300;
      S._ctx.fillStyle = S.currentPlayer === p ? '#8f8' : '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p] + ' (' + S.hands[p].length + ')', baseX, aiY + 10);
      drawPhaseInfo(baseX + 130, aiY + 10, p);
      // Face-down cards
      const shown = Math.min(S.hands[p].length, 8);
      for (let i = 0; i < shown; ++i)
        CE.drawCardBack(S._ctx, baseX + i * 18, aiY + 18, aiCardW, aiCardH);
      // Laid phase groups
      if (S.laidPhases[p].length > 0)
        drawLaidGroups(baseX, aiY + 18 + aiCardH + 4, p, 0.4);
    }

    // Center: Stock + Discard
    const stockX = CANVAS_W / 2 - CE.CARD_W - 20;
    const stockY = 200;
    const discardX = CANVAS_W / 2 + 20;
    const discardY = 200;

    if (S.deck.length > 0) {
      CE.drawCardBack(S._ctx, stockX, stockY);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.deck.length + '', stockX + CE.CARD_W / 2, stockY + CE.CARD_H + 14);
    } else
      CE.drawEmptySlot(S._ctx, stockX, stockY);

    if (S.discardPile.length > 0)
      drawP10Card(discardX, discardY, CE.CARD_W, CE.CARD_H, S.discardPile[S.discardPile.length - 1]);
    else
      CE.drawEmptySlot(S._ctx, discardX, discardY, 'D');

    S._ctx.fillStyle = '#888';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Stock', stockX + CE.CARD_W / 2, stockY - 6);
    S._ctx.fillText('Discard', discardX + CE.CARD_W / 2, discardY - 6);

    // Player's laid phase
    if (S.laidPhases[0].length > 0) {
      S._ctx.fillStyle = '#ccc';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText('Your laid phase:', 40, 360);
      drawLaidGroups(40, 372, 0, 0.55);
    }

    // Phase requirement
    const phIdx = S.playerPhases[0];
    S._ctx.fillStyle = '#ddd';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    if (phIdx < 10)
      S._ctx.fillText('Phase ' + (phIdx + 1) + ': ' + PHASES[phIdx].desc, CANVAS_W / 2, 170);
    else
      S._ctx.fillText('All phases complete!', CANVAS_W / 2, 170);

    // Buttons
    if (S.currentPlayer === 0 && S.turnPhase === TURN_PLAY && !S.roundOver && !S.gameOver) {
      if (V.playerCanLayPhase())
        CE.drawButton(S._ctx, BTN_PHASE.x, BTN_PHASE.y, BTN_PHASE.w, BTN_PHASE.h, 'Lay Phase');
      if (V.playerCanHitSelected())
        CE.drawButton(S._ctx, BTN_HIT.x, BTN_HIT.y, BTN_HIT.w, BTN_HIT.h, 'Hit');
    }

    // Bottom: Player hand
    const handY = 470;
    const handSpacing = Math.min(55, (CANVAS_W - 80) / Math.max(S.hands[0].length, 1));
    for (let i = 0; i < S.hands[0].length; ++i) {
      if (S.hands[0][i]._dealing) continue;
      const cx = 40 + i * handSpacing;
      const raised = S.selectedCards.includes(i) ? -12 : 0;
      drawP10Card(cx, handY + raised, CE.CARD_W, CE.CARD_H, S.hands[0][i]);
      if (S.selectedCards.includes(i))
        CE.drawSelectionHighlight(S._ctx, cx, handY + raised, CE.CARD_H);
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && S.turnPhase === TURN_PLAY && !S.roundOver && !S.gameOver) {
        if (V.isCardUsefulForCurrentPhase(S.hands[0], i) || (S.laidPhases[0].length > 0 && V.canHitAny(S.hands[0][i])))
          CE.drawHintGlow(S._ctx, cx, handY + raised, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }
    }

    // Turn indicator
    if (!S.roundOver && !S.gameOver) {
      S._ctx.fillStyle = S.currentPlayer === 0 ? '#8f8' : '#f88';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      if (S.currentPlayer === 0) {
        const msg = S.turnPhase === TURN_DRAW
          ? 'Draw from Stock or Discard pile'
          : 'Select cards for phase/hit, then Discard to end turn';
        S._ctx.fillText(msg, CANVAS_W / 2, CANVAS_H - 10);
      } else
        S._ctx.fillText(PLAYER_NAMES[S.currentPlayer] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 10);
    }

    // Scores
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Score: ' + S.score, CANVAS_W - 12, CANVAS_H - 10);

    // Hit target picking overlay
    if (S.hitTarget !== null) {
      S._ctx.save();
      S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
      S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click a laid group to hit on (or click away to cancel)', CANVAS_W / 2, 140);
      // Re-draw all laid groups so they are clickable
      for (let tp = 0; tp < NUM_PLAYERS; ++tp) {
        if (S.laidPhases[tp].length === 0) continue;
        const gy = 160 + tp * 80;
        S._ctx.fillStyle = '#ccc';
        S._ctx.font = '11px sans-serif';
        S._ctx.textAlign = 'left';
        S._ctx.fillText(PLAYER_NAMES[tp] + ':', 40, gy);
        drawLaidGroups(40, gy + 8, tp, 0.6);
      }
      S._ctx.restore();
    }
  }

  Object.assign(V, { drawGame });

})();
