/* One-shot contextual hints shown during the first half minute of a run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const S = NS.state;
  const H = NS.hints;

  /* ── Show Hint ── */
  H.showHint = function showHint(id, text) {
    if (S.hintsShown[id]) return;
    S.hintsShown[id] = true;
    S.currentHint = text;
    S.hintTimer = 5;
    S.hintAlpha = 1;
    S.lastHintId = id;
  };

  H.updateHints = function updateHints(dt) {
    if (S.hintTimer > 0) {
      S.hintTimer -= dt;
      if (S.hintTimer < 1)
        S.hintAlpha = S.hintTimer;
      else
        S.hintAlpha = Math.min(1, S.hintAlpha + dt * 3);
    }
  };
})();
