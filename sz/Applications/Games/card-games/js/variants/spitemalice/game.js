/* Spite & Malice: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.spitemalice;
  const S = V.S;
  const { CANVAS_W, CW, CH, P_HAND_X, P_HAND_Y } = V;

  function setupSpiteMalice() {
    const d = CE.shuffle(V.createSpiteDeck());
    S.payoff = [[], []];
    S.hands = [[], []];
    S.centerPiles = [[], [], [], []];
    S.sideStacks = [[[], [], [], []], [[], [], [], []]];
    S.selectedSource = null;
    S.playerTurn = true;
    S.roundOver = false;
    S.gameOver = false;
    S.aiTimer = 0;
    S.aiDiscarded = false;

    // Deal 20 cards to each pay-off pile
    for (let i = 0; i < 20; ++i) {
      S.payoff[0].push(d.pop());
      S.payoff[1].push(d.pop());
    }
    // Top card of each payoff is face-up
    if (S.payoff[0].length > 0) V.topCard(S.payoff[0]).faceUp = true;
    if (S.payoff[1].length > 0) V.topCard(S.payoff[1]).faceUp = true;

    S.stock = d;

    // Deal 5-card hands
    V.drawHand(0);
    V.drawHand(1);

    // Animate player hand deal
    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CH, P_HAND_X + i * (CW + 6), P_HAND_Y, i * 0.1);
    }
  }

  Object.assign(V, { setupSpiteMalice });

})();
