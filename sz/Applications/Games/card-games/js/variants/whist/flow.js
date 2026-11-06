/* Whist - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.whist;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, WINNING_SCORE, PLAYER_NAMES, TEAM_NS,
    PHASE_TRUMP_REVEAL, PHASE_PLAYING, PHASE_ROUND_OVER
  } = V;

  const HAND_SIZE = 13;
  const PHASE_TRICK_DONE = 2;
  const AI_TURN_DELAY = 0.8;
  const TRICK_DISPLAY_TIME = 1.2;
  const TRUMP_REVEAL_TIME = 2.0;

  /* ================================================================
     PLAY CARD
     ================================================================ */

  function playCard(playerIdx, handIndex) {
    const card = S.hands[playerIdx].splice(handIndex, 1)[0];
    card.faceUp = true;
    S.trickCards.push(card);
    S.trickPlayers.push(playerIdx);
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function deal() {
    const d = CE.shuffle(CE.createDeck());

    S.hands = [[], [], [], []];
    for (let i = 0; i < 52; ++i)
      S.hands[i % 4].push(d[i]);

    // Last card dealt to dealer determines trump
    const dealerHand = S.hands[S.dealer];
    S.trumpCard = dealerHand[dealerHand.length - 1];
    S.trumpSuit = S.trumpCard.suit;

    // Mark player's cards face up
    for (const c of S.hands[0]) c.faceUp = true;

    for (let p = 0; p < 4; ++p) V.sortHand(S.hands[p]);

    S.trickCards = [];
    S.trickPlayers = [];
    S.tricksWon = [0, 0, 0, 0];
    S.trickCount = 0;
    S.roundOver = false;
    S.phase = PHASE_TRUMP_REVEAL;
    S.trumpRevealTimer = TRUMP_REVEAL_TIME;
    S.aiTurnTimer = 0;
    S.trickWinnerDisplay = '';
    S.trickDisplayTimer = 0;
    S.hoveredCard = -1;
    S.statusMessage = '';

    // Player left of dealer leads
    S.currentLead = (S.dealer + 1) % 4;
    S.currentTurn = S.currentLead;
  }

  function setupGame() {
    S.teamScores = [0, 0];
    S.gameOver = false;
    S.score = 0;
    S.dealer = 0;
    deal();
  }

  /* ================================================================
     TRICK RESOLUTION FLOW
     ================================================================ */

  function resolveTrick() {
    if (S.trickCards.length < 4) return;

    const winner = V.determineTrickWinner();
    ++S.tricksWon[winner];
    ++S.trickCount;

    S.trickWinnerDisplay = PLAYER_NAMES[winner] + ' wins the trick!';

    if (S._host) {
      const label = (winner === 0 ? 'You win' : PLAYER_NAMES[winner] + ' wins') + ' trick #' + S.trickCount;
      const color = V.teamOf(winner) === TEAM_NS ? '#4f4' : '#f88';
      S._host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 16 });
    }

    S.phase = PHASE_TRICK_DONE;
    S.trickDisplayTimer = TRICK_DISPLAY_TIME;
    S.currentLead = winner;
    S.currentTurn = winner;
  }

  function clearTrickAndContinue() {
    S.trickCards = [];
    S.trickPlayers = [];
    S.trickWinnerDisplay = '';

    if (S.trickCount >= HAND_SIZE) {
      endRound();
      return;
    }

    S.phase = PHASE_PLAYING;
    S.aiTurnTimer = 0;
  }

  function endRound() {
    V.scoreRound();
    V.checkGameOver();
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    if (S._host && S.gameOver) {
      const won = S.teamScores[TEAM_NS] >= WINNING_SCORE;
      if (won) S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
    }
  }

  function tick(dt) {
    if (S.phase === PHASE_ROUND_OVER) return;

    // Trump reveal timer
    if (S.phase === PHASE_TRUMP_REVEAL) {
      S.trumpRevealTimer -= dt;
      if (S.trumpRevealTimer <= 0) {
        S.phase = PHASE_PLAYING;
        S.aiTurnTimer = 0;
      }
      return;
    }

    // Trick display timer
    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDisplayTimer -= dt;
      if (S.trickDisplayTimer <= 0)
        clearTrickAndContinue();
      return;
    }

    // AI playing
    if (S.phase !== PHASE_PLAYING) return;
    if (S.currentTurn === 0) return;
    if (S.trickCards.length >= 4) return;

    S.aiTurnTimer += dt;
    if (S.aiTurnTimer >= AI_TURN_DELAY) {
      S.aiTurnTimer = 0;
      V.aiPlay(S.currentTurn);
      if (S.trickCards.length >= 4)
        resolveTrick();
      else
        S.currentTurn = (S.currentTurn + 1) % 4;
    }
  }

  Object.assign(V, {
    playCard, deal, setupGame, resolveTrick, tick
  });

})();
