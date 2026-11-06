/* Hearts - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.hearts;
  const S = V.S;
  const { PHASE_PASSING, PHASE_PLAYING, PHASE_ROUND_OVER, hasSuit, PASS_BTN } = V;

  const SUIT_NAMES = T.SUIT_NAMES;

  /* ================================================================
     HIT TESTING - PLAYER HAND
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      let cy = V.playerCardY(i);
      const isSelected = S.selectedForPass.indexOf(i) >= 0;
      if (isSelected) cy -= 20;

      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.gameOver) {
        S.cumulativeScores = [0, 0, 0, 0];
        S.roundNumber = 0;
        S.score = 100;
        S.gameOver = false;
        if (S._host) S._host.onScoreChanged(S.score);
      }
      S.roundOver = false;
      V.dealRound();
      return;
    }

    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    if (S.phase === PHASE_PASSING) {
      if (S.selectedForPass.length === 3 && CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
        V.executePass();
        return;
      }

      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const pos = S.selectedForPass.indexOf(idx);
      if (pos >= 0) {
        S.selectedForPass.splice(pos, 1);
      } else if (S.selectedForPass.length < 3)
        S.selectedForPass.push(idx);

      return;
    }

    if (S.phase === PHASE_PLAYING && S.currentTurn === 0) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const hand = S.hands[0];
      const isFirstTrick = S.trickCount === 0;
      const isLeading = S.trickCards.length === 0;
      const leadSuit = isLeading ? null : S.trickCards[0].suit;

      if (V.isValidPlay(hand[idx], hand, leadSuit, isFirstTrick, isLeading)) {
        V.playCard(0, idx);
      } else {
        let reason = 'Invalid play!';
        if (isFirstTrick && isLeading && !V.isTwoOfClubs(hand[idx]))
          reason = 'Must lead 2\u2663!';
        else if (leadSuit && hasSuit(hand, leadSuit) && hand[idx].suit !== leadSuit)
          reason = 'Must follow ' + SUIT_NAMES[leadSuit] + '!';
        else if (isLeading && V.isHeart(hand[idx]) && !S.heartsBroken && !V.hasOnlyHearts(hand))
          reason = 'Hearts not broken!';
        else if (isFirstTrick && V.isPenaltyCard(hand[idx]))
          reason = 'No penalty cards on first trick!';

        if (S._host) S._host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
      }
      return;
    }
  }

  function handlePointerMove(mx, my) {
    if (S.phase === PHASE_PLAYING && S.currentTurn === 0)
      S.hoverCardIdx = hitTestPlayerCard(mx, my);
    else
      S.hoverCardIdx = -1;
  }

  Object.assign(V, {
    handleClick, handlePointerMove
  });

})();
