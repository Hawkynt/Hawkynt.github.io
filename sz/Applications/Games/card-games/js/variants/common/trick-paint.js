/* Trick-taking family - colour helper shared by the Spades and Bridge bidding panels. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};

  function lightenColor(hex, amount) {
    const amt = amount || 40;
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  SZ.CardGames.shared.trickPaint = { lightenColor };

})();
