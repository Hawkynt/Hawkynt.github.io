/* Cheat: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.cheat;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, PHASE_PLAYER_TURN, PHASE_CHALLENGE_WINDOW,
    PHASE_AI_TURN, PHASE_RESOLVING, PHASE_GAME_OVER, CHALLENGE_WINDOW_DURATION, AI_TURN_DELAY,
    PLAYER_HAND_Y } = V;

  function advanceRank() {
    S.requiredRankIdx = (S.requiredRankIdx + 1) % 13;
  }

  function nextPlayer(p) {
    return (p + 1) % NUM_PLAYERS;
  }

  function deal() {
    const deck = CE.shuffle(CE.createDeck());
    S.hands = [[], [], [], []];
    S.discardPile = [];
    S.selectedIndices = [];
    S.currentPlayer = 0;
    S.requiredRankIdx = 0;
    S.phase = PHASE_PLAYER_TURN;
    S.lastPlayInfo = null;
    S.challengeTimer = 0;
    S.aiTurnTimer = 0;
    S.resolveTimer = 0;
    S.resolveMessage = '';
    S.resolveColor = '#fff';
    S.roundOver = false;
    S.gameOver = false;
    S.message = '';
    S.messageTimer = 0;
    S.hoverCardIdx = -1;

    for (let i = 0; i < deck.length; ++i) {
      deck[i].faceUp = true;
      S.hands[i % NUM_PLAYERS].push(deck[i]);
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), PLAYER_HAND_Y, i * 0.04);
    }

    V.setMessage('Your turn! Play cards as ' + V.requiredRank(), '#8f8');
  }

  function startTurn() {
    S.selectedIndices = [];
    S.hoverCardIdx = -1;

    if (S.hands[S.currentPlayer].length === 0) {
      endGame(S.currentPlayer);
      return;
    }

    if (S.currentPlayer === 0) {
      S.phase = PHASE_PLAYER_TURN;
      V.setMessage('Your turn! Play cards as ' + V.requiredRank(), '#8f8');
    } else {
      S.phase = PHASE_AI_TURN;
      S.aiTurnTimer = AI_TURN_DELAY;
    }
  }

  function endGame(winnerIdx) {
    S.phase = PHASE_GAME_OVER;
    S.roundOver = true;

    if (winnerIdx === 0) {
      S.score = 100;
      V.setMessage('You win! Congratulations!', '#4f4');
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 28 });
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 30);
      }
    } else {
      S.score = 0;
      V.setMessage(PLAYER_NAMES[winnerIdx] + ' wins!', '#f88');
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, PLAYER_NAMES[winnerIdx] + ' WINS!', { color: '#f88', size: 28 });
        S._host.screenShake.trigger(8, 400);
      }
    }

    if (S._host) {
      S._host.onScoreChanged(S.score);
      S._host.onRoundOver(true);
    }
  }

  function tick(dt) {
    if (S.messageTimer > 0)
      S.messageTimer -= dt;

    if (S.roundOver || S.gameOver) return;

    // Challenge window timer
    if (S.phase === PHASE_CHALLENGE_WINDOW) {
      S.challengeTimer -= dt;

      // Each AI decides once at a staggered time within the window
      if (S.lastPlayInfo) {
        for (let p = 1; p < NUM_PLAYERS; ++p) {
          if (p === S.lastPlayInfo.player) continue;
          const decideTime = CHALLENGE_WINDOW_DURATION - 0.6 - (p - 1) * 0.4;
          const prevTime = S.challengeTimer + dt;
          if (prevTime > decideTime && S.challengeTimer <= decideTime) {
            if (V.aiDecideChallenge(p)) {
              V.setMessage(PLAYER_NAMES[p] + ' calls Cheat!', '#f88');
              V.resolveChallenge(p);
              return;
            }
          }
        }
      }

      if (S.challengeTimer <= 0)
        V.skipChallenge();

      return;
    }

    // Resolve timer
    if (S.phase === PHASE_RESOLVING) {
      S.resolveTimer -= dt;
      if (S.resolveTimer <= 0)
        V.afterResolve();
      return;
    }

    // AI turn
    if (S.phase === PHASE_AI_TURN) {
      S.aiTurnTimer -= dt;
      if (S.aiTurnTimer <= 0) {
        S.aiTurnTimer = 0;
        V.aiPlayTurn(S.currentPlayer);
      }
      return;
    }
  }

  Object.assign(V, { advanceRank, nextPlayer, deal, startTurn, endGame, tick });

})();
