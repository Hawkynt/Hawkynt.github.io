/* Shared helpers: hex color alpha expansion, the Fisher-Yates shuffle and the
   hand layout that both rendering and hit-testing depend on. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;

  /* ── Expand 3-digit hex (#rgb) to 6-digit (#rrggbb) before appending alpha hex digits ── */
  const hexAlpha = (hex, alpha) => {
    const h = hex.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/, '#$1$1$2$2$3$3');
    return h + alpha;
  };

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getCardX(index, handSize) {
    const totalWidth = handSize * 90;
    const startX = (C.CANVAS_W - totalWidth) / 2;
    return startX + index * 90 + 45;
  }

  Object.assign(NS.util, { hexAlpha, shuffle, getCardX });
})();
