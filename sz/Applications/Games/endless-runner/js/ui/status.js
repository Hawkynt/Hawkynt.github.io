/* The status bar: distance, coins, speed and state text. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  /* ── Status Bar ── */
  function updateStatus() {
    V.elStatusDistance.textContent = 'Distance: ' + Math.floor(S.distance) + ' m';
    V.elStatusCoins.textContent = 'Coins: ' + S.coinCount;
    V.elStatusSpeed.textContent = 'Speed: ' + S.currentSpeed.toFixed(1) + ' m/s';
    V.elStatusState.textContent = S.state === C.STATE_PAUSED ? 'Paused' :
      S.state === C.STATE_DEAD ? 'Game Over' :
      S.state === C.STATE_RUNNING ? 'Running' : 'Ready';
  }

  NS.status.updateStatus = updateStatus;
})();
