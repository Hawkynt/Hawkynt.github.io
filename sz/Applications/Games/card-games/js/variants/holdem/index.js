/* Texas Hold'em: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.holdem;
  const S = V.S;
  const { STARTING_CHIPS, PHASE_SHOWDOWN, PHASE_ROUND_OVER, AI_TURN_DELAY, SHOWDOWN_DELAY } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : STARTING_CHIPS;
      if (S.score <= 0) S.score = STARTING_CHIPS;
      V.setupGame();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawHoldem();
    },

    handleClick(mx, my) {
      if (S.phase === PHASE_ROUND_OVER) {
        if (S.gameOver) {
          S.score = STARTING_CHIPS;
          if (S._host) S._host.onScoreChanged(S.score);
          V.setupGame();
        } else {
          S.dealerIdx = V.nextActiveOrAllIn(S.dealerIdx);
          V.setupHand();
        }
        return;
      }

      if (S.roundOver || S.gameOver) {
        if (S._host) S._host.onRoundOver(S.gameOver);
        return;
      }

      if (S.currentTurn !== 0 || S.phase >= PHASE_SHOWDOWN) return;

      const actions = V.getButtonActions();
      for (let i = 0; i < actions.length; ++i) {
        const r = V.btnRect(i, actions.length);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          V.executePlayerAction(actions[i]);
          return;
        }
      }
    },

    handlePointerMove(mx, my) {
      S.hoverBtn = -1;
      if (S.currentTurn !== 0 || S.phase >= PHASE_SHOWDOWN || S.roundOver) return;

      const actions = V.getButtonActions();
      for (let i = 0; i < actions.length; ++i) {
        const r = V.btnRect(i, actions.length);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.hoverBtn = i;
          return;
        }
      }
    },

    handlePointerUp() {},

    handleKey(e) {
      if (S.phase >= PHASE_SHOWDOWN || S.roundOver || S.gameOver) return;
      if (S.currentTurn !== 0) return;

      const key = e.key.toLowerCase();
      if (key === 'f') V.executePlayerAction('fold');
      else if (key === 'c') V.executePlayerAction(S.currentBet - S.bets[0] === 0 ? 'check' : 'call');
      else if (key === 'r') V.executePlayerAction('raise');
      else if (key === 'a') V.executePlayerAction('allin');
    },

    tick(dt) {
      if (S.gameOver && S.phase !== PHASE_ROUND_OVER) return;

      if (S.phase === PHASE_SHOWDOWN && !S.roundOver) {
        S.showdownTimer += dt;
        if (S.showdownTimer >= SHOWDOWN_DELAY)
          V.resolveHand();
        return;
      }

      if (S.phase >= PHASE_SHOWDOWN || S.roundOver) return;
      if (S.currentTurn === 0) return;

      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        const decision = V.aiDecide(S.currentTurn);
        V.performAction(S.currentTurn, decision.action, decision.amount);
      }
    },

    cleanup() {
      S.deck = [];
      S.community = [];
      S.holeCards = [[], [], [], []];
      S.chips = [0, 0, 0, 0];
      S.bets = [0, 0, 0, 0];
      S.folded = [false, false, false, false];
      S.allIn = [false, false, false, false];
      S.eliminated = [false, false, false, false];
      S.pot = 0;
      S.roundOver = false;
      S.gameOver = false;
      S._cachedButtons = null;
      S.hoverBtn = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('holdem', module);

})();
