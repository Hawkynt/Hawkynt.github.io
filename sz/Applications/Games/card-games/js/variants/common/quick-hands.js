/* Quick & Fun: hand queries shared by Go Fish and Cheat. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};

  function countRank(hand, rank) {
    let n = 0;
    for (const c of hand)
      if (c.rank === rank) ++n;
    return n;
  }

  SZ.CardGames.shared.quickHands = { countRank };

})();
