/* Uno Extreme: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['unoextreme'];
  const S = V.S;

  function aiTurn() {
    if (S.roundOver || S.gameOver || S.waitingForColorChoice || S.waitingForTargetChoice) return;
    const hand = S.hands[S.currentPlayer];
    for (let i = 0; i < hand.length; ++i)
      if (V.canPlay(hand[i])) { V.playCard(S.currentPlayer, i); return; }
    // Can't play: hit launcher
    V.launcherDraw(S.currentPlayer);
    S.currentPlayer = V.nextSeat(S.currentPlayer);
  }

  Object.assign(V, { aiTurn });

})();
