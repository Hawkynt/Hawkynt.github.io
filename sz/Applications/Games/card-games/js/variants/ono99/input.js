/* ONO 99: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['ono99'];
  const S = V.S;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) { if (S._host) S._host.onRoundOver(S.gameOver); return; }
    if (S.currentPlayer !== 0 || S.eliminated[0]) return;
    for (let i = S.hands[0].length - 1; i >= 0; --i) {
      const cx = 250 + i * 70;
      if (CE.isInRect(mx, my, cx, 460, CE.CARD_W, CE.CARD_H)) {
        if (!V.canPlayAny(0)) {
          V.eliminatePlayer(0);
          if (!V.checkGameEnd()) S.currentPlayer = V.getNextAlive(0);
          return;
        }
        if (!V.canPlay(S.hands[0][i])) {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Would bust!', { color: '#f88', size: 14 });
          return;
        }
        V.playCard(0, i);
        return;
      }
    }
  }

  Object.assign(V, { handleClick });

})();
