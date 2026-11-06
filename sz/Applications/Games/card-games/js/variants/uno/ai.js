/* Uno: opponent decisions and turn pacing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['uno'];
  const S = V.S;
  const { AI_TURN_DELAY, CANVAS_W, NUM_PLAYERS } = V;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function unoAiTurn() {
    if (S.roundOver || S.gameOver || S.waitingForColorChoice || S.waitingForSwapChoice) return;

    // If AI must draw from stack
    if (S.drawStack > 0) {
      const hand = S.unoHands[S.unoCurrentPlayer];
      let canStack = false;
      for (let i = 0; i < hand.length; ++i) {
        if (V.canPlayUno(hand[i], S.unoTopCard)) {
          canStack = true;
          V.unoPlayCard(S.unoCurrentPlayer, i);
          return;
        }
      }
      // Can't stack: draw
      V.applyDrawStack(S.unoCurrentPlayer);
      S.unoCurrentPlayer = V.nextSeat(S.unoCurrentPlayer);
      return;
    }

    const hand = S.unoHands[S.unoCurrentPlayer];
    for (let i = 0; i < hand.length; ++i) {
      if (V.canPlayUno(hand[i], S.unoTopCard)) {
        V.unoPlayCard(S.unoCurrentPlayer, i);
        return;
      }
    }
    const drawn = V.drawUnoCard();
    if (drawn) hand.push(drawn);
    S.unoCurrentPlayer = V.nextSeat(S.unoCurrentPlayer);
  }

  function tick(dt) {
    if (S.roundOver || S.gameOver || S.waitingForColorChoice || S.waitingForSwapChoice || S.showingSettings) return;

    // Jump-in check for AI players (even when it's not their turn)
    if (S.houseRules.jumpIn && S.unoTopCard && S.unoCurrentPlayer !== 0) {
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (p === S.unoCurrentPlayer || PL.isFinished(S, p)) continue;
        for (let i = 0; i < S.unoHands[p].length; ++i) {
          const c = S.unoHands[p][i];
          if (c.color === S.unoTopCard.color && c.value === S.unoTopCard.value && c.color !== 'wild' && Math.random() < 0.3) {
            const savedPlayer = S.unoCurrentPlayer;
            S.unoCurrentPlayer = p;
            if (V.unoPlayCard(p, i)) {
              if (S._host)
                S._host.floatingText.add(CANVAS_W / 2, 200, 'AI ' + p + ' jumps in!', { color: '#0ff', size: 16 });
              S.aiTurnTimer = 0;
              return;
            }
            S.unoCurrentPlayer = savedPlayer;
          }
        }
      }
    }

    if (S.unoCurrentPlayer !== 0) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= PL.aiDelay(S, AI_TURN_DELAY)) {
        S.aiTurnTimer = 0;
        unoAiTurn();
      }
    }
  }

  Object.assign(V, { tick, aiTurn: unoAiTurn });

})();
