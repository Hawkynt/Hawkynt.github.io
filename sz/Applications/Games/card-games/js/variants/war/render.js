/* War: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const PILES = SZ.CardGames.shared.quickPiles;
  const V = SZ.CardGames.v.war;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, AI_PILE_X, AI_PILE_Y, PLAYER_PILE_X, PLAYER_PILE_Y, AI_PLAY_X,
    AI_PLAY_Y, PLAYER_PLAY_X, PLAYER_PLAY_Y, FLIP_BTN, PHASE_IDLE, PHASE_FLIP, PHASE_WAR_DEAL,
    PHASE_WAR_SHOW, FLIP_DURATION } = V;

  function drawWar() {
    // Title
    S._ctx.save();
    S._ctx.fillStyle = '#ddd';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('WAR', CANVAS_W / 2, 8);
    S._ctx.restore();

    // AI pile (top center)
    PILES.drawPileWithCount(S._ctx, AI_PILE_X, AI_PILE_Y, S.aiPile.length, 'AI');

    // Player pile (bottom center)
    PILES.drawPileWithCount(S._ctx, PLAYER_PILE_X, PLAYER_PILE_Y, S.playerPile.length, 'You');

    // Draw played cards area
    drawPlayedCards();

    // Draw war face-down cards if in war phase
    if (S.phase >= PHASE_WAR_DEAL && S.warFaceDown && S.warFaceDown.player)
      drawWarCards();

    // Result text
    if (S.resultText) {
      S._ctx.save();
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 20px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.resultText, CANVAS_W / 2, CANVAS_H / 2);
      S._ctx.restore();
    }

    // Flip button / prompt when idle
    if (S.phase === PHASE_IDLE && !S.roundOver && !S.gameOver) {
      CE.drawButton(S._ctx, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h, 'Flip (F)', { bg: '#2a5a2a', border: '#6c6' });
      S._ctx.save();
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click anywhere or press F to flip', CANVAS_W / 2, CANVAS_H / 2 + 36);
      S._ctx.restore();
    }

    // Game over prompt
    if (S.gameOver) {
      S._ctx.save();
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 28);
      S._ctx.restore();
    }
  }

  function drawPlayedCards() {
    // Find the last face-up card in each played pile
    const lastPlayerFaceUp = V.findLastFaceUp(S.playerPlayed);
    const lastAiFaceUp = V.findLastFaceUp(S.aiPlayed);

    // During flip animation, show partial reveal
    if (S.phase === PHASE_FLIP) {
      const progress = Math.min(S.flipAnimProgress / FLIP_DURATION, 1);
      if (progress < 0.5) {
        // First half: shrink card back horizontally
        const scaleX = 1 - progress * 2;
        PILES.drawFlippingCard(S._ctx, PLAYER_PLAY_X, PLAYER_PLAY_Y, scaleX, null);
        PILES.drawFlippingCard(S._ctx, AI_PLAY_X, AI_PLAY_Y, scaleX, null);
      } else {
        // Second half: expand card face
        const scaleX = (progress - 0.5) * 2;
        if (lastPlayerFaceUp)
          PILES.drawFlippingCard(S._ctx, PLAYER_PLAY_X, PLAYER_PLAY_Y, scaleX, lastPlayerFaceUp);
        if (lastAiFaceUp)
          PILES.drawFlippingCard(S._ctx, AI_PLAY_X, AI_PLAY_Y, scaleX, lastAiFaceUp);
      }
      return;
    }

    // Static display of last face-up cards
    if (lastPlayerFaceUp)
      CE.drawCardFace(S._ctx, PLAYER_PLAY_X, PLAYER_PLAY_Y, lastPlayerFaceUp);
    if (lastAiFaceUp)
      CE.drawCardFace(S._ctx, AI_PLAY_X, AI_PLAY_Y, lastAiFaceUp);
  }

  function drawWarCards() {
    // Draw face-down war cards fanned beside the play area
    const pCount = S.warFaceDown.player ? S.warFaceDown.player.length : 0;
    const aCount = S.warFaceDown.ai ? S.warFaceDown.ai.length : 0;

    // Player war cards (spread to left of player play area)
    for (let i = 0; i < pCount; ++i) {
      const x = PLAYER_PLAY_X - (i + 1) * 30 - CE.CARD_W;
      CE.drawCardBack(S._ctx, x, PLAYER_PLAY_Y);
    }

    // AI war cards (spread to left of AI play area)
    for (let i = 0; i < aCount; ++i) {
      const x = AI_PLAY_X - (i + 1) * 30 - CE.CARD_W;
      CE.drawCardBack(S._ctx, x, AI_PLAY_Y);
    }

    // "WAR!" label
    if (S.phase >= PHASE_WAR_DEAL && S.phase <= PHASE_WAR_SHOW) {
      S._ctx.save();
      S._ctx.fillStyle = '#f00';
      S._ctx.font = 'bold 28px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'middle';
      const warLabel = S.warRound > 1 ? 'WAR x' + S.warRound + '!' : 'WAR!';
      S._ctx.fillText(warLabel, CANVAS_W / 2 + CE.CARD_W / 2 + 20, CANVAS_H / 2);
      S._ctx.restore();
    }
  }

  Object.assign(V, { drawWar });

})();
