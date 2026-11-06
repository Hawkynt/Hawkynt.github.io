/* Snap: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.snap;
  const S = V.S;

  function updateScore() {
    S.score = S.playerDeck.length;
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function setupSnap() {
    const deck = CE.shuffle(CE.createDeck());
    S.playerDeck = deck.splice(0, 26);
    S.aiDeck = deck.splice(0, 26);
    S.centralPile = [];
    S.isPlayerTurn = true;
    S.flipTimer = 0;
    S.snapWindowOpen = false;
    S.snapWindowTimer = 0;
    S.aiReactionDelay = 0;
    S.aiReactionTimer = 0;
    S.aiWillSnap = false;
    S.isPaused = false;
    S.pauseTimer = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.lastSnapResult = '';
    S.lastSnapResultTimer = 0;
    S.lastReactionTime = 0;
    S.showReactionTime = false;
    S.reactionDisplayTimer = 0;
    S.snapPulsePhase = 0;
    S.score = 26;
    if (S._host) S._host.onScoreChanged(S.score);
  }

  Object.assign(V, { updateScore, setupSnap });

})();
