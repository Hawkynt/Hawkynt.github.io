/* Old Maid: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.oldmaid;
  const S = V.S;
  const { PHASE_REMOVING_PAIRS, PHASE_PLAYER_DRAW, PHASE_AI_DRAW, PHASE_DISCARD_ANIM,
    PHASE_GAME_OVER, AI_DRAW_DELAY, PAIR_REMOVE_DELAY } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 100;
      V.deal();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawOldMaid();
    },

    handleClick(mx, my) {
      if (S.phase === PHASE_GAME_OVER) {
        if (S._host) S._host.onRoundOver(S.gameOver);
        return;
      }

      if (S.phase === PHASE_PLAYER_DRAW) {
        const aiIdx = V.hitTestAiCards(mx, my);
        if (aiIdx >= 0)
          V.playerDrawCard(aiIdx);
        return;
      }
    },

    handlePointerMove(mx, my) {
      if (S.phase === PHASE_PLAYER_DRAW) {
        const aiIdx = V.hitTestAiCards(mx, my);
        S.hoverCardIdx = aiIdx;
      } else
        S.hoverCardIdx = -1;
    },

    handlePointerUp() {},

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        V.deal();
      }
    },

    tick(dt) {
      S.queenGlowTimer += dt;

      if (S.phase === PHASE_REMOVING_PAIRS) {
        S.pairRemoveTimer -= dt;
        if (S.pairRemoveTimer <= 0) {
          S.pairRemoveTimer = PAIR_REMOVE_DELAY;
          V.processNextPairRemoval();
        }
        return;
      }

      if (S.phase === PHASE_DISCARD_ANIM) {
        S.discardAnimTimer -= dt;
        if (S.discardAnimTimer <= 0) {
          V.sortHand(S.playerHand);
          V.sortHand(S.aiHand);
          V.refreshAiDrawableOrder();

          if (V.checkGameEnd()) return;

          // Determine whose turn it was before the discard
          if (S.lastDiscardedBy === 'You')
            V.finishPlayerTurn();
          else
            V.finishAiTurn();
        }
        return;
      }

      if (S.phase === PHASE_AI_DRAW) {
        if (S.aiHand.length === 0) {
          // AI has no cards - game should be over or skip
          if (V.checkGameEnd()) return;
          S.phase = PHASE_PLAYER_DRAW;
          V.refreshAiDrawableOrder();
          return;
        }

        S.aiTimer -= dt;
        if (S.aiTimer <= 0) {
          S.aiTimer = 0;
          V.aiDrawCard();
        }
        return;
      }

      // If it's player's turn but AI has no cards to draw from
      if (S.phase === PHASE_PLAYER_DRAW && S.aiHand.length === 0) {
        if (!V.checkGameEnd()) {
          // Somehow AI has no cards but game isn't over -- skip to AI turn
          S.phase = PHASE_AI_DRAW;
          S.aiTimer = AI_DRAW_DELAY;
        }
      }
    },

    sortPlayerHand() { V.sortHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.playerPairs = [];
      S.aiPairs = [];
      S.aiDrawableOrder = [];
      S.pairRemoveQueue = [];
      S.lastDiscardedPair = null;
      S.lastDiscardedBy = '';
      S.roundOver = false;
      S.gameOver = false;
      S.hoverCardIdx = -1;
      S.aiTimer = 0;
      S.pairRemoveTimer = 0;
      S.discardAnimTimer = 0;
      S.queenGlowTimer = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('oldmaid', module);

})();
