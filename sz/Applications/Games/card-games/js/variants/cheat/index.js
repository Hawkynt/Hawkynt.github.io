/* Cheat: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.cheat;
  const S = V.S;
  const { PHASE_PLAYER_TURN, PHASE_CHALLENGE_WINDOW, PHASE_GAME_OVER } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = 0;
      V.deal();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawCheat();
    },

    handleClick(mx, my) {
      V.handlePlayerClick(mx, my);
    },

    handlePointerMove(mx, my) {
      if (S.phase === PHASE_PLAYER_TURN)
        S.hoverCardIdx = V.hitTestPlayerCard(mx, my);
      else
        S.hoverCardIdx = -1;
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (S.phase === PHASE_GAME_OVER) return;
      // Enter to confirm play
      if (e.key === 'Enter' && S.phase === PHASE_PLAYER_TURN && S.selectedIndices.length > 0) {
        e.preventDefault();
        V.playCards(0, S.selectedIndices);
        S.selectedIndices = [];
      }
      // Space to call cheat
      if (e.key === ' ' && S.phase === PHASE_CHALLENGE_WINDOW && S.lastPlayInfo && S.lastPlayInfo.player !== 0) {
        e.preventDefault();
        V.resolveChallenge(0);
      }
    },

    tick(dt) {
      V.tick(dt);
    },

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.discardPile = [];
      S.selectedIndices = [];
      S.lastPlayInfo = null;
      S.roundOver = false;
      S.gameOver = false;
      S.hoverCardIdx = -1;
      S.challengeTimer = 0;
      S.aiTurnTimer = 0;
      S.resolveTimer = 0;
      S.message = '';
      S.messageTimer = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('cheat', module);

})();
