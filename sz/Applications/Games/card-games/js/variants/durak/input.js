/* Durak: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.durak;
  const S = V.S;
  const { TAKE_BTN, DONE_BTN } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const total = S.playerHand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      const cy = V.playerCardY();
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function hitTestAttackCard(mx, my) {
    for (let i = S.attackCards.length - 1; i >= 0; --i) {
      const ax = V.tableAttackX(i);
      const ay = V.tableAttackY();
      if (mx >= ax && mx <= ax + CE.CARD_W && my >= ay && my <= ay + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S.gameOver) {
        if (S._host) S._host.onRoundOver(true);
      } else {
        S.roundOver = false;
        V.setupDurak();
      }
      return;
    }

    /* Button clicks */
    if (!S.isPlayerAttacking && !V.allDefended() && S.attackCards.length > 0) {
      if (CE.isInRect(mx, my, TAKE_BTN.x, TAKE_BTN.y, TAKE_BTN.w, TAKE_BTN.h)) {
        V.playerTakesCards();
        return;
      }
    }

    if (S.isPlayerAttacking && S.attackCards.length > 0 && V.allDefended()) {
      if (CE.isInRect(mx, my, DONE_BTN.x, DONE_BTN.y, DONE_BTN.w, DONE_BTN.h)) {
        V.playerDoneAttacking();
        return;
      }
    }

    /* Player is attacker -- click cards to attack */
    if (S.isPlayerAttacking && !S.waitingForDefense) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx >= 0) {
        V.playerAttack(idx);
        return;
      }
    }

    /* Player is defender */
    if (!S.isPlayerAttacking && S.waitingForDefense) {
      /* If a card is selected, clicking an attack card defends it */
      if (S.selectedCardIdx >= 0) {
        const atkIdx = hitTestAttackCard(mx, my);
        if (atkIdx >= 0 && !S.defenseCards[atkIdx]) {
          V.playerDefend(atkIdx, S.selectedCardIdx);
          return;
        }
      }

      /* Click a hand card to select it */
      const idx = hitTestPlayerCard(mx, my);
      if (idx >= 0) {
        if (S.selectedCardIdx === idx)
          S.selectedCardIdx = -1;
        else
          S.selectedCardIdx = idx;
        return;
      }

      /* Click elsewhere to deselect */
      S.selectedCardIdx = -1;
    }
  }

  function handlePointerMove(mx, my) {
    if (S.roundOver || S.gameOver) {
      S.hoverCardIdx = -1;
      return;
    }
    S.hoverCardIdx = hitTestPlayerCard(mx, my);
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver) return;
    const key = e.key ? e.key.toLowerCase() : '';
    if (key === 't' && !S.isPlayerAttacking && !V.allDefended() && S.attackCards.length > 0)
      V.playerTakesCards();
    else if (key === 'd' && S.isPlayerAttacking && S.attackCards.length > 0 && V.allDefended())
      V.playerDoneAttacking();
  }

  V.handleClick = handleClick;
  V.handlePointerMove = handlePointerMove;
  V.handleKey = handleKey;

})();
