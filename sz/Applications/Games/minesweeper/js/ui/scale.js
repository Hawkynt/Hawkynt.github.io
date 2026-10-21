/* Aspect-ratio scaling of the game frame into its wrapper, watched by a ResizeObserver. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const D = NS.dom;
  const SC = NS.scale;

  /* ---- Display Scaling ---- */
  SC.fitGameToWrapper = function fitGameToWrapper() {
    const wrapW = D.scaleWrapper.clientWidth;
    const wrapH = D.scaleWrapper.clientHeight;
    if (wrapW <= 0 || wrapH <= 0)
      return;

    D.gameFrame.style.transform = '';
    const natW = D.gameFrame.offsetWidth;
    const natH = D.gameFrame.offsetHeight;
    if (natW <= 0 || natH <= 0)
      return;

    const scaleX = wrapW / natW;
    const scaleY = wrapH / natH;
    const scale = Math.min(scaleX, scaleY);
    D.gameFrame.style.transform = scale !== 1 ? 'scale(' + scale + ')' : '';
  };

  const _resizeObserver = new ResizeObserver(() => SC.fitGameToWrapper());
  _resizeObserver.observe(D.scaleWrapper);
})();
