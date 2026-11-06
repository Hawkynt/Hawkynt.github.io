/* Rat Screw: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ratscrew;
  const S = V.S;
  const { NUM_PLAYERS, HUMAN, AI_FLIP_DELAY, SLAP_BTN, FLIP_BTN, PHASE_IDLE, PHASE_FLIPPING,
    PHASE_FACE_CHALLENGE, PHASE_SLAP_WINDOW, PHASE_COLLECTING, PHASE_PAUSE, COLLECT_DURATION,
    FEEDBACK_DURATION } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = 13;
      V.setupGame();
      if (S._host) S._host.onScoreChanged(S.score);
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawGame();
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        if (S._host) S._host.onRoundOver(true);
        return;
      }

      // SLAP button
      if (CE.isInRect(mx, my, SLAP_BTN.x - 10, SLAP_BTN.y - 10, SLAP_BTN.w + 20, SLAP_BTN.h + 20)) {
        V.humanSlap();
        return;
      }

      // FLIP button
      if (CE.isInRect(mx, my, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h)) {
        V.humanFlip();
        return;
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey(e) {
      if (S.roundOver || S.gameOver) return;

      if (e.key === ' ' || e.key === 'Spacebar') {
        V.humanSlap();
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        V.humanFlip();
        return;
      }
    },

    tick(dt) {
      if (S.roundOver || S.gameOver) return;

      // Update feedback timer
      if (S.feedbackTimer < FEEDBACK_DURATION)
        S.feedbackTimer += dt;

      // Slap flash decay
      if (S.slapFlashTimer > 0)
        S.slapFlashTimer -= dt;

      // Slap pulse animation
      S.slapPulsePhase += dt;

      switch (S.phase) {
        case PHASE_IDLE: {
          const flipPlayer = V.getCurrentFlipPlayer();
          if (flipPlayer === HUMAN) break;

          // AI turn to flip
          S.aiFlipTimer += dt;
          if (S.aiFlipTimer >= AI_FLIP_DELAY) {
            S.aiFlipTimer = 0;
            if (S.playerPiles[flipPlayer].length > 0) {
              S.phase = PHASE_FLIPPING;
              V.doFlip(flipPlayer);
            } else
              V.advanceTurnOrEliminate(flipPlayer);
          }
          break;
        }

        case PHASE_FACE_CHALLENGE: {
          if (S.challengePlayer === HUMAN) break;

          // AI responds to face challenge
          S.aiFlipTimer += dt;
          if (S.aiFlipTimer >= AI_FLIP_DELAY) {
            S.aiFlipTimer = 0;
            if (S.playerPiles[S.challengePlayer].length > 0)
              V.doFlip(S.challengePlayer);
            else {
              // Can't respond, beneficiary wins
              V.startCollect(S.challengeBeneficiary, 'No cards to answer!');
              S.faceChallenge = false;
            }
          }
          break;
        }

        case PHASE_SLAP_WINDOW: {
          S.phaseTimer += dt;

          // Check AI slap attempts
          for (let i = 0; i < NUM_PLAYERS; ++i) {
            if (i === HUMAN) continue;
            if (S.aiSlapTimers[i] === Infinity) continue;
            if (S.phaseTimer >= S.aiSlapTimers[i] && S.aiSlapTargets[i]) {
              S.aiSlapTargets[i] = false;
              V.executeSlap(i);
              if (S.phase !== PHASE_SLAP_WINDOW) return;
            }
          }

          // Slap window expires after 2 seconds
          if (S.phaseTimer >= 2.0) {
            // No one slapped, continue play
            S.slapPattern = '';
            if (S.faceChallenge) {
              S.phase = PHASE_FACE_CHALLENGE;
              S.phaseTimer = 0;
              S.aiFlipTimer = 0;
            } else {
              S.currentTurn = V.nextActivePlayer(S.currentTurn);
              S.phase = PHASE_IDLE;
              S.phaseTimer = 0;
              S.aiFlipTimer = 0;
            }
          }
          break;
        }

        case PHASE_COLLECTING:
          S.collectTimer += dt;
          if (S.collectTimer >= COLLECT_DURATION)
            V.finishCollect();
          break;

        case PHASE_PAUSE:
          S.phaseTimer += dt;
          if (S.phaseTimer >= 0.4) {
            S.phase = PHASE_IDLE;
            S.phaseTimer = 0;
            S.aiFlipTimer = 0;
          }
          break;
      }
    },

    cleanup() {
      S.playerPiles = [];
      S.centerPile = [];
      S.eliminated = [];
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
      S.aiSlapTimers = [];
      S.aiSlapTargets = [];
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
      S.score = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('ratscrew', module);

})();
