/* The full-field color flash overlay with its fading animation. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const D = NS.dom;
  const FL = NS.flash;

  /* ---- Flash Overlay ---- */
  FL.screenFlash = function screenFlash(color, duration) {
    if (S.flashAnimId)
      cancelAnimationFrame(S.flashAnimId);
    D.flashOverlay.style.background = color;
    D.flashOverlay.style.opacity = '0.5';
    D.flashOverlay.style.display = 'block';
    let start = null;
    const animate = (ts) => {
      if (!start)
        start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      D.flashOverlay.style.opacity = String(0.5 * (1 - progress));
      if (progress < 1)
        S.flashAnimId = requestAnimationFrame(animate);
      else {
        D.flashOverlay.style.display = 'none';
        S.flashAnimId = null;
      }
    };
    S.flashAnimId = requestAnimationFrame(animate);
  };
})();
