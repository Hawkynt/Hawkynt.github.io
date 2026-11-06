/* Snap: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.snap;
  const S = V.S;
  const { CANVAS_W, CANVAS_H } = V;

  function aiSnaps() {
    if (S.isPaused || S.roundOver || S.gameOver) return;
    if (!S.snapWindowOpen || !V.hasSnapMatch()) return;

    const pileCards = S.centralPile.splice(0, S.centralPile.length);
    for (const c of pileCards) {
      c.faceUp = false;
      S.aiDeck.unshift(c);
    }
    S.snapWindowOpen = false;
    S.aiWillSnap = false;
    S.lastSnapResult = 'Too Slow!';
    S.lastSnapResultTimer = 0;
    S.showReactionTime = false;
    if (S._host) {
      S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Too Slow! AI snapped!', { color: '#f88', size: 24 });
      S._host.screenShake.trigger(5, 250);
    }
    S.isPaused = true;
    S.pauseTimer = 0;
    V.updateScore();
    V.checkGameOver();
  }

  Object.assign(V, { aiSnaps });

})();
