/* The LED-style mine counter and timer displays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const D = NS.dom;
  const LED = NS.led;

  /* ---- LED Display ---- */
  LED.formatLED = function formatLED(value) {
    const clamped = Math.max(-99, Math.min(999, value));
    if (clamped < 0)
      return '-' + String(Math.abs(clamped)).padStart(2, '0');
    return String(clamped).padStart(3, '0');
  };

  LED.updateMineCounter = function updateMineCounter() {
    D.mineCounter.textContent = LED.formatLED(S.mineCount - S.flagCount);
  };

  LED.updateTimer = function updateTimer() {
    D.timerDisplay.textContent = LED.formatLED(S.timerValue);
  };
})();
