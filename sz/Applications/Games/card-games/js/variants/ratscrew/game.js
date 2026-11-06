/* Rat Screw: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ratscrew;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, HUMAN, PLAYER_POSITIONS, PHASE_IDLE, PHASE_COLLECTING,
    PHASE_PAUSE } = V;

  function nextActivePlayer(from) {
    let p = (from + 1) % NUM_PLAYERS;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (!S.eliminated[p] || S.playerPiles[p].length > 0) return p;
      p = (p + 1) % NUM_PLAYERS;
    }
    return -1;
  }

  function advanceTurnOrEliminate(player) {
    S.eliminated[player] = true;
    if (V.countActivePlayers() <= 1) {
      for (let i = 0; i < NUM_PLAYERS; ++i)
        if (S.playerPiles[i].length > 0) { endRound(i); return; }
      endRound(-1);
      return;
    }
    S.currentTurn = nextActivePlayer(player);
    S.phase = PHASE_IDLE;
    S.phaseTimer = 0;
    S.aiFlipTimer = 0;
  }

  function startCollect(player, reason) {
    S.collectTarget = player;
    S.collectTimer = 0;
    S.phase = PHASE_COLLECTING;
    V.showFeedback((player === HUMAN ? 'You' : PLAYER_POSITIONS[player].name) + ' win the pile! ' + reason);
  }

  function finishCollect() {
    if (S.collectTarget < 0) { S.phase = PHASE_IDLE; return; }

    const cards = CE.shuffle(S.centerPile.splice(0, S.centerPile.length));
    for (const c of cards) {
      c.faceUp = false;
      S.playerPiles[S.collectTarget].push(c);
    }

    // Un-eliminate if they slapped back in
    if (S.eliminated[S.collectTarget] && S.playerPiles[S.collectTarget].length > 0)
      S.eliminated[S.collectTarget] = false;

    S.slapPattern = '';
    S.faceChallenge = false;
    S.currentTurn = S.collectTarget;
    updateScore();

    if (V.checkGameOver()) return;

    S.phase = PHASE_PAUSE;
    S.phaseTimer = 0;
  }

  function updateScore() {
    S.score = S.playerPiles[HUMAN].length;
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function endRound(winner) {
    S.roundOver = true;
    S.gameOver = true;
    if (winner === HUMAN) {
      S.resultMsg = 'YOU WIN! All 52 cards!';
      S.score = S.playerPiles[HUMAN].length + 100;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
        S._host.onScoreChanged(S.score);
        S._host.onRoundOver(true);
      }
    } else if (winner >= 0) {
      S.resultMsg = PLAYER_POSITIONS[winner].name + ' wins the game!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        S._host.onRoundOver(true);
      }
    } else {
      S.resultMsg = 'Draw!';
      if (S._host) S._host.onRoundOver(true);
    }
  }

  function setupGame() {
    const deck = CE.shuffle(CE.createDeck());
    S.playerPiles = [[], [], [], []];
    S.eliminated = [false, false, false, false];
    S.centerPile = [];

    // Deal 13 cards each
    for (let i = 0; i < 52; ++i)
      S.playerPiles[i % NUM_PLAYERS].push(deck[i]);

    S.currentTurn = 0;
    S.faceChallenge = false;
    S.challengeChances = 0;
    S.challengePlayer = -1;
    S.challengeBeneficiary = -1;
    S.phase = PHASE_IDLE;
    S.phaseTimer = 0;
    S.aiFlipTimer = 0;
    S.slapPattern = '';
    S.slapWinner = -1;
    S.aiSlapTimers = [Infinity, Infinity, Infinity, Infinity];
    S.aiSlapTargets = [false, false, false, false];
    S.slapFlashTimer = 0;
    S.slapFlashColor = '';
    S.slapPulsePhase = 0;
    S.collectTarget = -1;
    S.collectTimer = 0;
    S.feedbackText = '';
    S.feedbackTimer = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.score = 13;

    // Deal animation
    if (S._host) {
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        const pos = PLAYER_POSITIONS[p];
        for (let i = 0; i < Math.min(3, S.playerPiles[p].length); ++i)
          S._host.dealCardAnim(S.playerPiles[p][i], CANVAS_W / 2, CANVAS_H / 2, pos.x, pos.y, (p * 3 + i) * 0.06);
      }
    }
  }

  Object.assign(V, { nextActivePlayer, advanceTurnOrEliminate, startCollect, finishCollect,
    updateScore, endRound, setupGame });

})();
