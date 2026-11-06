/* Snap: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.snap;
  const S = V.S;
  const { FLIP_INTERVAL, SNAP_WINDOW_DURATION, PAUSE_DURATION, SNAP_RESULT_DURATION, SNAP_BTN } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 26;
      V.setupSnap();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawSnap();
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        if (S._host) S._host.onRoundOver(S.gameOver);
        return;
      }

      if (S.snapWindowOpen && V.hasSnapMatch() && !S.isPaused) {
        if (CE.isInRect(mx, my, SNAP_BTN.x - 20, SNAP_BTN.y - 20, SNAP_BTN.w + 40, SNAP_BTN.h + 40)) {
          V.playerSnaps();
          return;
        }
      }

      V.playerSnaps();
    },

    handleKey(e) {
      if (S.roundOver || S.gameOver) return;
      if (e.key === ' ' || e.key === 'Spacebar')
        V.playerSnaps();
    },

    tick(dt) {
      if (S.roundOver || S.gameOver) return;

      /* ── Feedback timers ── */
      if (S.lastSnapResultTimer < SNAP_RESULT_DURATION)
        S.lastSnapResultTimer += dt;
      if (S.showReactionTime)
        S.reactionDisplayTimer += dt;

      /* ── Post-snap pause ── */
      if (S.isPaused) {
        S.pauseTimer += dt;
        if (S.pauseTimer >= PAUSE_DURATION) {
          S.isPaused = false;
          S.pauseTimer = 0;
          S.flipTimer = 0;
          V.checkGameOver();
        }
        return;
      }

      /* ── Snap window countdown ── */
      if (S.snapWindowOpen) {
        S.snapWindowTimer += dt;
        S.snapPulsePhase += dt;

        if (S.aiWillSnap) {
          S.aiReactionTimer += dt;
          if (S.aiReactionTimer >= S.aiReactionDelay) {
            V.aiSnaps();
            return;
          }
        }

        if (S.snapWindowTimer >= SNAP_WINDOW_DURATION) {
          S.snapWindowOpen = false;
          if (S.aiWillSnap) {
            V.aiSnaps();
            return;
          }
          S.flipTimer = 0;
        }
        return;
      }

      /* ── Auto-flip timer ── */
      S.flipTimer += dt;
      if (S.flipTimer >= FLIP_INTERVAL) {
        S.flipTimer = 0;
        const sourceDeck = S.isPlayerTurn ? S.playerDeck : S.aiDeck;
        if (sourceDeck.length > 0)
          V.flipNextCard();
        else {
          S.isPlayerTurn = !S.isPlayerTurn;
          const otherDeck = S.isPlayerTurn ? S.playerDeck : S.aiDeck;
          if (otherDeck.length > 0)
            V.flipNextCard();
          else
            V.checkGameOver();
        }
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      S.playerDeck = [];
      S.aiDeck = [];
      S.centralPile = [];
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S.flipTimer = 0;
      S.snapWindowOpen = false;
      S.snapWindowTimer = 0;
      S.aiReactionDelay = 0;
      S.aiReactionTimer = 0;
      S.aiWillSnap = false;
      S.isPaused = false;
      S.pauseTimer = 0;
      S.lastSnapResult = '';
      S.lastSnapResultTimer = 0;
      S.showReactionTime = false;
      S.reactionDisplayTimer = 0;
      S.snapPulsePhase = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('snap', module);

})();
