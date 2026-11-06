/* Memory: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.memory;
  const S = V.S;

  function hitTestGrid(mx, my) {
    for (let i = 0; i < S.cards.length; ++i) {
      const pos = V.cardPos(i);
      if (mx >= pos.x && mx <= pos.x + CE.CARD_W && my >= pos.y && my <= pos.y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  Object.assign(V, { hitTestGrid });

})();
