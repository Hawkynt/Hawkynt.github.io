/* Beggar Neighbor: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.beggar;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, AI_PILE_X, AI_PILE_Y, PLAYER_PILE_X, PLAYER_PILE_Y, PHASE_IDLE } = V;

  function finishGame(winner) {
    S.gameOver = true;
    S.roundOver = true;
    if (winner === 'player') {
      S.resultText = 'YOU WIN THE GAME!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
        S._host.onRoundOver(true);
      }
    } else {
      S.resultText = 'GAME OVER - AI wins!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        S._host.onRoundOver(true);
      }
    }
    S.autoPlay = false;
  }

  function setupBeggar() {
    const deck = CE.shuffle(CE.createDeck());
    S.playerPile = deck.slice(0, 26);
    S.aiPile = deck.slice(26, 52);
    S.centerPile = [];
    S.isPlayerTurn = true;
    S.penaltyRemaining = 0;
    S.penaltyTotal = 0;
    S.penaltyChallenger = '';
    S.collectTarget = '';
    S.currentCard = null;
    S.phase = PHASE_IDLE;
    S.phaseTimer = 0;
    S.flipAnimProgress = 0;
    S.collectProgress = 0;
    S.resultText = '';
    S.roundOver = false;
    S.gameOver = false;
    S.autoPlay = false;
    S.autoTimer = 0;
    S.score = 26;

    // Animate initial deal
    if (S._host) {
      for (let i = 0; i < 4; ++i)
        S._host.dealCardAnim(S.playerPile[i], CANVAS_W / 2, -CE.CARD_H, PLAYER_PILE_X, PLAYER_PILE_Y, i * 0.08);
      for (let i = 0; i < 4; ++i)
        S._host.dealCardAnim(S.aiPile[i], CANVAS_W / 2, -CE.CARD_H, AI_PILE_X, AI_PILE_Y, (i + 4) * 0.08);
    }
  }

  Object.assign(V, { finishGame, setupBeggar });

})();
