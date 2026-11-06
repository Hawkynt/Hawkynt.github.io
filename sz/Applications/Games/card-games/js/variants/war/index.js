/* War: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.war;
  const S = V.S;
  const { PHASE_IDLE, PHASE_FLIP, PHASE_SHOW, PHASE_COLLECT, PHASE_WAR_DEAL, PHASE_WAR_FLIP,
    PHASE_WAR_SHOW, FLIP_DURATION, COLLECT_DURATION } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = 26;
      V.setupWar();
      if (S._host) S._host.onScoreChanged(S.score);
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawWar();
    },

    handleClick(mx, my) {
      if (S.gameOver) {
        if (S._host) S._host.onRoundOver(true);
        return;
      }
      if (S.phase === PHASE_IDLE && !S.roundOver)
        V.startFlip();
    },

    handleKey(e) {
      if (S.gameOver) return;
      if ((e.key === 'f' || e.key === 'F' || e.key === ' ') && S.phase === PHASE_IDLE && !S.roundOver)
        V.startFlip();
    },

    tick(dt) {
      if (S.gameOver) return;

      switch (S.phase) {
        case PHASE_FLIP:
          S.flipAnimProgress += dt;
          if (S.flipAnimProgress >= FLIP_DURATION) {
            S.flipAnimProgress = FLIP_DURATION;
            V.resolveFlip();
          }
          break;

        case PHASE_SHOW:
          S.phaseTimer += dt;
          if (S.phaseTimer >= 1.2) {
            S.phase = PHASE_COLLECT;
            S.collectProgress = 0;
          }
          break;

        case PHASE_COLLECT:
          S.collectProgress += dt;
          if (S.collectProgress >= COLLECT_DURATION)
            V.collectCards();
          break;

        case PHASE_WAR_DEAL:
          S.phaseTimer += dt;
          if (S.phaseTimer >= 0.6)
            V.dealWarCards();
          break;

        case PHASE_WAR_FLIP:
          S.phaseTimer += dt;
          if (S.phaseTimer >= 0.8) {
            S.flipAnimProgress = 0;
            V.flipWarCards();
          }
          break;

        case PHASE_WAR_SHOW:
          S.phaseTimer += dt;
          if (S.phaseTimer >= 1.5) {
            S.phase = PHASE_COLLECT;
            S.collectProgress = 0;
          }
          break;
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      S.playerPile = [];
      S.aiPile = [];
      S.playerPlayed = [];
      S.aiPlayed = [];
      S.warFaceDown = [];
      S.warRound = 0;
      S.phase = PHASE_IDLE;
      S.phaseTimer = 0;
      S.flipAnimProgress = 0;
      S.collectProgress = 0;
      S.collectTarget = '';
      S.resultText = '';
      S.roundOver = false;
      S.gameOver = false;
      S.score = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('war', module);

})();
