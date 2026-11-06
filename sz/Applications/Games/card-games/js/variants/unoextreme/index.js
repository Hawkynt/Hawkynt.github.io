/* Uno Extreme: module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['unoextreme'];
  const S = V.S;
  const { AI_TURN_DELAY } = V;
  const SH = SZ.CardGames.shared.sheddingHand;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.setupGame();
    },
    draw(ctx, W, H) { S._ctx = ctx; V.drawGame(); },
    handleClick: V.handleClick,
    handleKey(e) {},
    handlePointerMove() {},
    handlePointerUp() {},
    tick(dt) {
      if (S.launcherAnim > 0) S.launcherAnim -= dt;
      if (S.roundOver || S.gameOver || S.waitingForColorChoice || S.waitingForTargetChoice) return;
      if (S.currentPlayer !== 0) {
        S.aiTurnTimer += dt;
        if (S.aiTurnTimer >= PL.aiDelay(S, AI_TURN_DELAY)) { S.aiTurnTimer = 0; V.aiTurn(); }
      }
    },
    sortPlayerHand() { SH.sortColorHand(S.hands[0]); },

    cleanup() {
      S.hands = []; S.deck = []; S.discard = []; S.topCard = null;
      PL.resetPlaces(S);
      S.roundOver = false; S.gameOver = false;
      S.waitingForColorChoice = false; S.waitingForTargetChoice = false;
      S.pendingWildCard = null; S.pendingWildPlayer = -1;
      S.launcherAnim = 0; S.aiTurnTimer = 0;
      S._ctx = null; S._host = null;
    },
    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('unoextreme', module);

})();
