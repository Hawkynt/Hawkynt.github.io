/* President: opponent decisions and turn pacing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['president'];
  const S = V.S;
  const { RANK_STRENGTH, AI_TURN_DELAY, PHASE_PLAYING, TRICK_CLEAR_DELAY, PHASE_TRICK_CLEAR, PHASE_ROUND_OVER } = V;

  function aiDoExchange(playerIdx) {
    const title = S.titles[playerIdx];
    const count = V.getExchangeCount(title);
    if (count === 0) {
      S.exchangeDone[playerIdx] = true;
      return;
    }

    const hand = S.hands[playerIdx].slice();

    if (title >= 2) {
      hand.sort((a, b) => V.cardStrength(b) - V.cardStrength(a));
      S.exchangeCards[playerIdx] = hand.slice(0, count);
    } else {
      hand.sort((a, b) => V.cardStrength(a) - V.cardStrength(b));
      S.exchangeCards[playerIdx] = hand.slice(0, count);
    }
    S.exchangeDone[playerIdx] = true;
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChoosePlay(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return null;

    const playable = V.getPlayableRanks(hand);
    if (playable.length === 0) return null;

    if (S.pile.length === 0) {
      playable.sort((a, b) => RANK_STRENGTH[a.rank] - RANK_STRENGTH[b.rank]);

      for (const p of playable)
        if (p.rank !== '2') return V.getCardsForPlay(hand, p.rank, p.count);
      return V.getCardsForPlay(hand, playable[0].rank, playable[0].count);
    }

    const nonTwos = playable.filter(p => p.rank !== '2');

    if (nonTwos.length > 0) {
      nonTwos.sort((a, b) => RANK_STRENGTH[a.rank] - RANK_STRENGTH[b.rank]);
      return V.getCardsForPlay(hand, nonTwos[0].rank, nonTwos[0].count);
    }

    if (hand.length <= 3)
      return V.getCardsForPlay(hand, playable[0].rank, playable[0].count);

    return null;
  }

  function tick(dt) {
    if (S.roundOver && S.phase !== PHASE_ROUND_OVER) return;
    if (S.gameOver) return;

    if (S.phase === PHASE_TRICK_CLEAR) {
      S.trickClearTimer += dt;
      if (S.trickClearTimer >= TRICK_CLEAR_DELAY)
        V.clearPile();
      return;
    }

    if (S.phase !== PHASE_PLAYING) return;
    if (S.currentTurn === 0) return;

    S.aiTurnTimer += dt;
    if (S.aiTurnTimer >= AI_TURN_DELAY) {
      S.aiTurnTimer = 0;

      if (S.hands[S.currentTurn].length === 0 || S.finishOrder.indexOf(S.currentTurn) >= 0) {
        V.advanceTurn();
        return;
      }

      const play = aiChoosePlay(S.currentTurn);
      if (play)
        V.playCards(S.currentTurn, play);
      else
        V.doPass(S.currentTurn);
    }
  }

  Object.assign(V, { aiDoExchange, tick });

})();
