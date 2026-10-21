/* The one-second game timer interval behind the LED display. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const LED = NS.led;
  const TI = NS.timer;

  /* ---- Timer ---- */
  TI.startTimer = function startTimer() {
    if (S.timerInterval)
      return;
    S.timerInterval = setInterval(() => {
      if (S.timerValue < 999)
        ++S.timerValue;
      LED.updateTimer();
    }, 1000);
  };

  TI.stopTimer = function stopTimer() {
    if (S.timerInterval) {
      clearInterval(S.timerInterval);
      S.timerInterval = null;
    }
  };
})();
