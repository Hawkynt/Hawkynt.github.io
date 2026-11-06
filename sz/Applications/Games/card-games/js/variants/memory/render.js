/* Memory: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.memory;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, COLS, TOTAL_PAIRS, GAP_X, GAP_Y, GRID_X, GRID_Y, FADE_DURATION,
    NEW_GAME_BTN } = V;

  /* ================================================================
   *  CARD POSITION HELPERS
   * ================================================================ */

  function cardPos(index) {
    const col = index % COLS;
    const row = (index / COLS) | 0;
    return {
      x: GRID_X + col * (CE.CARD_W + GAP_X),
      y: GRID_Y + row * (CE.CARD_H + GAP_Y)
    };
  }

  /* ================================================================
   *  MAIN DRAW
   * ================================================================ */

  function drawScene(ctx, W, H) {
    S._ctx = ctx;

    // Green felt background
    S._ctx.fillStyle = '#1a6b2e';
    S._ctx.fillRect(0, 0, W, H);
    // Subtle dark edges
    S._ctx.fillStyle = '#126622';
    S._ctx.fillRect(0, 0, W, 2);
    S._ctx.fillRect(0, 0, 2, H);

    const now = performance.now();

    // Deal animation
    if (S.dealAnimActive && S.dealAnimCards.length > 0) {
      let allDone = true;
      for (const d of S.dealAnimCards) {
        if (now < d.startTime) {
          allDone = false;
          continue;
        }
        const elapsed = now - d.startTime;
        const t = Math.min(elapsed / d.duration, 1);
        const e = V.easeOutCubic(t);
        const x = d.fromX + (d.toX - d.fromX) * e;
        const y = d.fromY + (d.toY - d.fromY) * e;
        CE.drawCardBack(S._ctx, x, y);
        if (t < 1)
          allDone = false;
      }
      if (allDone) {
        S.dealAnimActive = false;
        S.dealAnimCards = [];
      }
      drawHUD();
      return;
    }

    // Update flip animations
    V.updateFlips(now);

    // Draw cards
    for (let i = 0; i < S.cards.length; ++i) {
      const card = S.cards[i];
      const pos = cardPos(i);

      // Matched + faded out: skip
      if (card.matched && card.fadeStart > 0) {
        const fadeElapsed = now - card.fadeStart;
        const fadeT = Math.min(fadeElapsed / FADE_DURATION, 1);
        if (fadeT >= 1) {
          // Draw empty slot outline
          S._ctx.save();
          S._ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          S._ctx.lineWidth = 1;
          S._ctx.setLineDash([4, 4]);
          CE.drawRoundedRect(S._ctx, pos.x, pos.y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
          S._ctx.stroke();
          S._ctx.setLineDash([]);
          S._ctx.restore();
          continue;
        }
        // Fading out -- draw with decreasing alpha
        S._ctx.save();
        S._ctx.globalAlpha = 1 - fadeT;
        CE.drawCardFace(S._ctx, pos.x, pos.y, card);
        // Green glow on matched card
        S._ctx.strokeStyle = '#4f4';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#4f4';
        S._ctx.shadowBlur = 10;
        CE.drawRoundedRect(S._ctx, pos.x, pos.y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        S._ctx.stroke();
        S._ctx.restore();
        continue;
      }

      // Flip animation
      if (card.flipDirection) {
        const t = card.flipProgress;
        let scaleX;
        let showFace;
        if (card.flipDirection === 'up') {
          // Shrink showing back, then expand showing face
          if (t < 0.5) {
            scaleX = 1 - t * 2;
            showFace = false;
          } else {
            scaleX = (t - 0.5) * 2;
            showFace = true;
          }
        } else {
          // Shrink showing face, then expand showing back
          if (t < 0.5) {
            scaleX = 1 - t * 2;
            showFace = true;
          } else {
            scaleX = (t - 0.5) * 2;
            showFace = false;
          }
        }
        scaleX = Math.max(scaleX, 0.02);
        S._ctx.save();
        S._ctx.translate(pos.x + CE.CARD_W / 2, pos.y);
        S._ctx.scale(scaleX, 1);
        if (showFace)
          CE.drawCardFace(S._ctx, -CE.CARD_W / 2, 0, card);
        else
          CE.drawCardBack(S._ctx, -CE.CARD_W / 2, 0);
        S._ctx.restore();
        continue;
      }

      // Static card
      if (card.faceUp)
        CE.drawCardFace(S._ctx, pos.x, pos.y, card);
      else
        CE.drawCardBack(S._ctx, pos.x, pos.y);

      // Highlight selected first pick
      if (i === S.firstPick && S.secondPick < 0) {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 2;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 6;
        CE.drawRoundedRect(S._ctx, pos.x - 1, pos.y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }

    drawHUD();

    // Game over overlay
    if (S.roundOver) {
      S._ctx.fillStyle = 'rgba(0,0,0,0.4)';
      S._ctx.fillRect(0, 0, W, H);

      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 32px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('Congratulations!', CANVAS_W / 2, CANVAS_H / 2 - 40);

      S._ctx.fillStyle = '#fff';
      S._ctx.font = '18px sans-serif';
      S._ctx.fillText('Pairs found in ' + S.moves + ' moves  |  Score: ' + S.score, CANVAS_W / 2, CANVAS_H / 2 + 10);

      CE.drawButton(S._ctx, NEW_GAME_BTN.x, NEW_GAME_BTN.y, NEW_GAME_BTN.w, NEW_GAME_BTN.h, 'New Game', { bg: '#2a5a2a', border: '#6c6', fontSize: 16 });
    }
  }

  /* ================================================================
   *  HUD (heads-up display)
   * ================================================================ */

  function drawHUD() {
    // Top bar
    S._ctx.fillStyle = 'rgba(0,0,0,0.3)';
    S._ctx.fillRect(0, 0, CANVAS_W, 32);

    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textBaseline = 'middle';

    // Moves
    S._ctx.fillStyle = '#fff';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Moves: ' + S.moves, 16, 16);

    // Pairs found
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Pairs: ' + S.matchesFound + ' / ' + TOTAL_PAIRS, CANVAS_W / 2, 16);

    // Score
    S._ctx.fillStyle = '#fa0';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Score: ' + S.score, CANVAS_W - 16, 16);
  }

  Object.assign(V, { cardPos, drawScene });

})();
