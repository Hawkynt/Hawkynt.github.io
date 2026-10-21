/* The kill combo: consecutive kills within the timeout raise the score
   multiplier and the display pop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;

  function getComboMultiplier() {
    return S.combo.count < 2 ? 1 : Math.min(S.combo.count, 8);
  }

  function addKill() {
    ++S.combo.count;
    S.combo.timer = C.COMBO_TIMEOUT;
    S.combo.displayScale = 1;
    if (S.combo.count > S.stats.maxCombo)
      S.stats.maxCombo = S.combo.count;
  }

  function updateCombo(dt) {
    if (S.combo.count > 0) {
      S.combo.timer -= dt;
      if (S.combo.timer <= 0)
        S.combo.count = 0;
    }
    if (S.combo.displayScale > 0)
      S.combo.displayScale = Math.max(0, S.combo.displayScale - 0.04);
  }

  Object.assign(NS.combo, { getComboMultiplier, addKill, updateCombo });
})();
