/* Liar's Uno: module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['liarsuno'];
  const S = V.S;
  const { UNO_COLORS, COLOR_MAP, CANVAS_W, CANVAS_H } = V;
  const SH = SZ.CardGames.shared.sheddingHand;

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
    tick: V.tick,
    sortPlayerHand() { SH.sortColorHand(S.hands[0]); },

    cleanup() {
      S.hands = []; S.deck = []; S.discardPile = [];
      S.roundOver = false; S.gameOver = false; S.aiTurnTimer = 0;
      S.lastPlayInfo = null; S.challengePhase = false; S.challengeResult = null;
      S.bluffMode = false; S.bluffClaimStep = 0; S.bluffCard = null;
      SZ.CardGames.shared.sheddingPlaces.resetPlaces(S);
      S._ctx = null; S._host = null;
    },
    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  const origDraw = module.draw;
  module.draw = function(ctx, W, H) {
    S._ctx = ctx;
    V.drawGame();
    if (S._showColorChoiceForBluff || S._showColorChoiceForHonest) {
      S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
      S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S._showColorChoiceForBluff ? 'Claim a color:' : 'Choose a color:', CANVAS_W / 2, 220);
      for (let i = 0; i < UNO_COLORS.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        CE.drawButton(S._ctx, bx, 245, 65, 36, UNO_COLORS[i].charAt(0).toUpperCase() + UNO_COLORS[i].slice(1), { bg: COLOR_MAP[UNO_COLORS[i]], border: '#fff', fontSize: 12 });
      }
    }
  };

  const origClick = module.handleClick;
  module.handleClick = function(mx, my) {
    if (S._showColorChoiceForBluff) {
      for (let i = 0; i < UNO_COLORS.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        if (CE.isInRect(mx, my, bx, 245, 65, 36)) {
          S._showColorChoiceForBluff = false;
          S.bluffCard._claimedColor = UNO_COLORS[i];
          S.bluffClaimStep = 1; // now pick value
          return;
        }
      }
      return;
    }
    if (S._showColorChoiceForHonest) {
      for (let i = 0; i < UNO_COLORS.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        if (CE.isInRect(mx, my, bx, 245, 65, 36)) {
          S._showColorChoiceForHonest = false;
          V.doPlay(0, S.bluffCardIndex, false, UNO_COLORS[i], S.bluffCard.value);
          S.bluffCard = null;
          S.bluffCardIndex = -1;
          return;
        }
      }
      return;
    }
    origClick.call(this, mx, my);
  };

  SZ.CardGames.registerVariant('liarsuno', module);

})();
