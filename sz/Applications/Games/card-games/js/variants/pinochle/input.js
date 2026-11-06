/* Pinochle - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.pinochle;
  const S = V.S;
  const {
    CANVAS_W, PHASE_BIDDING, PHASE_TRUMP_SELECT, PHASE_PLAYING,
    PHASE_ROUND_SCORE, hasSuit, PLAYER_HAND_Y
  } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      const cy = PLAYER_HAND_Y;
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    // Round score - advance
    if (S.phase === PHASE_ROUND_SCORE) {
      if (S.gameOver) {
        V.setupGame();
      } else {
        S.roundOver = false;
        V.deal();
      }
      return;
    }

    // Bidding - player bid
    if (S.phase === PHASE_BIDDING && S.currentBidder === 0 && !S.bidPassed[0]) {
      const btns = V.getBidButtons();
      for (let i = 0; i < btns.length; ++i) {
        const r = V.bidBtnRect(i, btns.length);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          V.processBid(0, btns[i]);
          return;
        }
      }
      return;
    }

    // Trump selection
    if (S.phase === PHASE_TRUMP_SELECT) {
      const btnW = 90;
      const btnH = 32;
      const gap = 8;
      const totalW = CE.SUITS.length * btnW + (CE.SUITS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2 - 40;

      for (let i = 0; i < CE.SUITS.length; ++i) {
        const x = startX + i * (btnW + gap);
        if (CE.isInRect(mx, my, x, 280, btnW, btnH)) {
          S.trumpSuit = CE.SUITS[i];
          V.startMelding();
          return;
        }
      }
      return;
    }

    // Playing - player's turn
    if (S.phase === PHASE_PLAYING && S.currentTurn === 0) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const hand = S.hands[0];
      if (V.isValidPlay(hand[idx], hand)) {
        V.playCard(0, idx);
      } else {
        let reason = 'Invalid play!';
        const leadSuit = S.trickCards.length > 0 ? S.trickCards[0].suit : null;
        if (leadSuit && hasSuit(hand, leadSuit) && hand[idx].suit !== leadSuit)
          reason = 'Must follow suit!';
        else if (!hasSuit(hand, leadSuit) && hasSuit(hand, S.trumpSuit) && hand[idx].suit !== S.trumpSuit)
          reason = 'Must play trump!';
        else
          reason = 'Must head the trick!';

        if (S._host) S._host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
      }
      return;
    }
  }

  function handlePointerMove(mx, my) {
    S.hoverCardIdx = -1;
    S.hoverBidBtn = -1;
    S.hoveredTrumpSuit = null;

    if (S.phase === PHASE_PLAYING && S.currentTurn === 0)
      S.hoverCardIdx = hitTestPlayerCard(mx, my);

    if (S.phase === PHASE_BIDDING && S.currentBidder === 0 && !S.bidPassed[0]) {
      const btns = V.getBidButtons();
      for (let i = 0; i < btns.length; ++i) {
        const r = V.bidBtnRect(i, btns.length);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.hoverBidBtn = i;
          break;
        }
      }
    }

    if (S.phase === PHASE_TRUMP_SELECT) {
      const btnW = 90;
      const btnH = 32;
      const gap = 8;
      const totalW = CE.SUITS.length * btnW + (CE.SUITS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2 - 40;
      for (let i = 0; i < CE.SUITS.length; ++i) {
        const x = startX + i * (btnW + gap);
        if (CE.isInRect(mx, my, x, 280, btnW, btnH)) {
          S.hoveredTrumpSuit = CE.SUITS[i];
          break;
        }
      }
    }
  }

  Object.assign(V, {
    handleClick, handlePointerMove
  });

})();
