/* Sevens: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.sevens;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, SUIT_DISPLAY, GAME_OVER_THRESHOLD,
    PLAYER_HAND_Y } = V;

  function initSuitRows() {
    S.suitRows = {};
    S.placedCards = {};
    for (const suit of SUIT_DISPLAY) {
      S.suitRows[suit] = null;        // null = no 7 placed yet
      S.placedCards[suit] = new Set();
    }
  }

  function dealRound() {
    const deck = CE.shuffle(CE.createDeck());
    S.hands = [[], [], [], []];
    for (let i = 0; i < 52; ++i)
      S.hands[i % NUM_PLAYERS].push(deck[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);

    for (const c of S.hands[0])
      c.faceUp = true;

    initSuitRows();
    S.roundScores = [0, 0, 0, 0];
    S.totalPasses = [0, 0, 0, 0];
    S.passCount = 0;
    S.roundOver = false;
    S.hoverCardIdx = -1;
    S.hoverPassBtn = false;
    S.aiTurnTimer = 0;

    // Find who has the 7 of diamonds -- they go first and must play it
    const starter = V.findSevenOfDiamonds();
    S.currentTurn = starter;

    // If an AI starts, auto-play the 7 of diamonds on first tick
    if (starter === 0) {
      // Highlight for human to play
    }

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), PLAYER_HAND_Y, i * 0.05);
    }
  }

  function setupGame() {
    S.cumulativeScores = [0, 0, 0, 0];
    S.roundNumber = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.score = 0;
    dealRound();
  }

  function advanceTurn() {
    S.currentTurn = (S.currentTurn + 1) % NUM_PLAYERS;
    S.aiTurnTimer = 0;
  }

  function endRound(winnerId) {
    S.roundOver = true;
    ++S.roundNumber;

    // Score penalties for remaining cards
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      let penalty = 0;
      for (const c of S.hands[p])
        penalty += V.cardPenalty(c);
      S.roundScores[p] = penalty;
      S.cumulativeScores[p] += penalty;
    }

    // Player score is inverted: lower cumulative = better, so we track as negative penalty
    S.score = -S.cumulativeScores[0];
    if (S._host) S._host.onScoreChanged(S.score);

    if (S._host && S._host.floatingText) {
      const msg = winnerId === 0 ? 'You go out first!' : PLAYER_NAMES[winnerId] + ' goes out first!';
      const col = winnerId === 0 ? '#4f4' : '#fa0';
      S._host.floatingText.add(CANVAS_W / 2, 260, msg, { color: col, size: 20 });
    }
    if (S._host && winnerId === 0 && S._host.particles)
      S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 3, 30);

    // Check game over
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.cumulativeScores[p] >= GAME_OVER_THRESHOLD) {
        S.gameOver = true;
        break;
      }
    }

    if (S.gameOver && S._host) {
      let lowest = S.cumulativeScores[0];
      let winner = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (S.cumulativeScores[p] < lowest) {
          lowest = S.cumulativeScores[p];
          winner = p;
        }
      }
      const gmsg = winner === 0 ? 'You win the game!' : PLAYER_NAMES[winner] + ' wins!';
      const gcol = winner === 0 ? '#4f4' : '#f88';
      S._host.floatingText.add(CANVAS_W / 2, 220, gmsg, { color: gcol, size: 22 });
      if (winner === 0 && S._host.particles)
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
    }
  }

  Object.assign(V, { dealRound, setupGame, advanceTurn, endRound });

})();
