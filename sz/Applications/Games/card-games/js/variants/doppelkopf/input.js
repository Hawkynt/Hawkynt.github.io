/* Doppelkopf - pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.doppelkopf;
  const S = V.S;
  const { PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_OVER } = V;

  const KEY_SLOTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    for (let i = total - 1; i >= 0; --i) {
      const x = V.playerCardX(i, total);
      let y = V.playerCardY();
      if (i === S.hoverCardIdx)
        y -= 12;
      const right = i === total - 1 ? x + CE.CARD_W : V.playerCardX(i + 1, total);
      if (mx >= x && mx <= right && my >= y && my <= y + CE.CARD_H + 12)
        return i;
    }
    return -1;
  }

  function tryPlay(idx, mx, my) {
    const hand = S.hands[0];
    if (idx < 0 || idx >= hand.length)
      return;
    if (V.isValidPlay(hand[idx], hand, S.trickCards)) {
      V.playCard(0, idx);
      S.hoverCardIdx = -1;
      return;
    }
    const reason = V.effectiveSuit(S.trickCards[0]) === 'trump' ? 'Must follow trump!' : 'Must follow ' + S.trickCards[0].suit + '!';
    if (S._host && S._host.floatingText)
      S._host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
  }

  function handleClick(mx, my) {
    if (S.phase === PHASE_ROUND_OVER) {
      V.acknowledgeRound();
      return;
    }
    if (S.phase === PHASE_TRICK_DONE) {
      V.finishTrick();
      return;
    }
    if (S.phase !== PHASE_PLAYING || S.currentTurn !== 0)
      return;
    const idx = hitTestPlayerCard(mx, my);
    if (idx >= 0)
      tryPlay(idx, mx, my);
  }

  function handleKey(e) {
    const key = e && e.key;
    if (S.phase === PHASE_ROUND_OVER || S.phase === PHASE_TRICK_DONE) {
      if (key === ' ' || key === 'Enter')
        handleClick(-1, -1);
      return;
    }
    if (S.phase !== PHASE_PLAYING || S.currentTurn !== 0)
      return;
    const idx = KEY_SLOTS.indexOf(key);
    if (idx >= 0 && idx < S.hands[0].length)
      tryPlay(idx, V.playerCardX(idx, S.hands[0].length) + CE.CARD_W / 2, V.playerCardY());
  }

  function handlePointerMove(mx, my) {
    S.hoverCardIdx = -1;
    if (S.phase === PHASE_PLAYING && S.currentTurn === 0)
      S.hoverCardIdx = hitTestPlayerCard(mx, my);
  }

  Object.assign(V, { handleClick, handleKey, handlePointerMove });

})();
