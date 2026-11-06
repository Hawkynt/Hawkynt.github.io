/* Go Fish: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.gofish;
  const S = V.S;
  const { RANK_NAMES, AI_TURN_DELAY } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = 0;
      V.setupGoFish();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawGoFish();
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        if (S._host) S._host.onRoundOver(S.gameOver);
        return;
      }

      if (!S.isPlayerTurn) return;

      const idx = V.hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const card = S.playerHand[idx];

      // If clicking the same card again, confirm the ask
      if (S.selectedCardIdx === idx) {
        // Record the rank in AI memory (player asked for it)
        S.aiMemory[card.rank] = true;
        V.playerAsksFor(card.rank);
        return;
      }

      // First click selects, second confirms
      S.selectedCardIdx = idx;
      V.setMessage('Ask for ' + RANK_NAMES[card.rank] + '? Click again to confirm.', '#ff0');
    },

    handlePointerMove(mx, my) {
      if (S.isPlayerTurn && !S.roundOver)
        S.hoverCardIdx = V.hitTestPlayerCard(mx, my);
      else
        S.hoverCardIdx = -1;
    },

    handlePointerUp() {},

    handleKey(e) {
      if (S.roundOver || S.gameOver) return;
      // No keyboard shortcuts for Go Fish beyond what host provides
    },

    tick(dt) {
      // Fade message timer
      if (S.messageTimer > 0)
        S.messageTimer -= dt;

      if (S.roundOver || S.gameOver) return;

      // AI turn processing
      if (!S.isPlayerTurn && S.aiThinking) {
        S.aiTurnTimer += dt;
        if (S.aiTurnTimer >= AI_TURN_DELAY) {
          S.aiTurnTimer = 0;
          V.aiTakeTurn();
        }
      }
    },

    sortPlayerHand() { V.sortHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.stock = [];
      S.playerBooks = [];
      S.aiBooks = [];
      S.roundOver = false;
      S.gameOver = false;
      S.isPlayerTurn = true;
      S.message = '';
      S.messageTimer = 0;
      S.hoverCardIdx = -1;
      S.selectedCardIdx = -1;
      S.aiTurnTimer = 0;
      S.aiThinking = false;
      S.aiMemory = {};
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('gofish', module);

})();
