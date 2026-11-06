/* Bridge - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.bridge;
  const S = V.S;
  const {
    CANVAS_W, SUIT_NAMES, STRAIN_ORDER, SOUTH, WEST, NORTH, PHASE_BIDDING,
    PHASE_PLAYING, PHASE_ROUND_OVER, PHASE_GAME_OVER, PASS_BTN,
    PLAYER_HAND_Y, DUMMY_HAND_Y, AI_HAND_POS
  } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[SOUTH];
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

  function hitTestDummyCard(mx, my) {
    if (!S.dummyRevealed) return -1;
    if (S.dummyPlayer !== NORTH) return hitTestDummySide(mx, my);

    const hand = S.hands[S.dummyPlayer];
    const total = hand.length;
    if (total === 0) return -1;

    const cardW = CE.CARD_W * 0.75;
    const cardH = CE.CARD_H * 0.75;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.dummyCardX(i, total);
      const cy = DUMMY_HAND_Y + 2;
      const rightEdge = i === total - 1 ? cx + cardW : V.dummyCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + cardH)
        return i;
    }
    return -1;
  }

  function hitTestDummySide(mx, my) {
    /* For dummy at West or East */
    const p = S.dummyPlayer;
    const pos = AI_HAND_POS[p];
    if (!pos) return -1;

    const hand = S.hands[p];
    const count = hand.length;
    if (count === 0) return -1;

    const spacing = Math.min(18, 240 / Math.max(count, 1));
    const cardW = CE.CARD_W * 0.5;
    const cardH = CE.CARD_H * 0.45;

    for (let i = count - 1; i >= 0; --i) {
      const cx = pos.x + (p === WEST ? 5 : -CE.CARD_W * 0.5 + 5);
      const cy = pos.y + 14 + i * spacing;
      const bottom = i === count - 1 ? cy + cardH : pos.y + 14 + (i + 1) * spacing;
      const hitH = bottom - cy;
      if (mx >= cx && mx <= cx + cardW && my >= cy && my <= cy + hitH)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    /* Game over */
    if (S.phase === PHASE_GAME_OVER) {
      V.setupGame();
      if (S._host) S._host.onScoreChanged(S.score);
      return;
    }

    /* Round over */
    if (S.phase === PHASE_ROUND_OVER) {
      S.dealer = V.leftOf(S.dealer);
      V.deal();
      return;
    }

    /* Bidding - player's turn */
    if (S.phase === PHASE_BIDDING && S.biddingPlayer === SOUTH) {
      /* Check pass button */
      if (CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
        V.placeBid(SOUTH, 'pass');
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
        return;
      }

      /* Check bid buttons */
      const lastBid = V.getLastNonPassBid();
      for (let lvl = 1; lvl <= 7; ++lvl) {
        for (let si = 0; si < 5; ++si) {
          const r = V.bidBtnRect(lvl, si);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            const candidate = { level: lvl, strain: STRAIN_ORDER[si] };
            if (V.bidIsHigher(candidate, lastBid)) {
              V.placeBid(SOUTH, candidate);
              if (S._host)
                S._host.floatingText.add(CANVAS_W / 2, 300, 'You bid ' + V.bidToString(candidate), { color: '#ff0', size: 14 });
            } else {
              if (S._host)
                S._host.floatingText.add(mx, my - 20, 'Bid must be higher!', { color: '#f88', size: 12 });
            }
            return;
          }
        }
      }
      return;
    }

    /* Playing - check if human controls current turn */
    if (S.phase === PHASE_PLAYING) {
      const ctrl = V.controllerOf(S.currentTurn);
      if (ctrl !== SOUTH) return;

      /* Playing own hand */
      if (S.currentTurn === SOUTH) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        const hand = S.hands[SOUTH];
        if (V.isValidPlay(hand[idx], hand)) {
          V.playCard(SOUTH, idx);
        } else {
          const leadSuit = S.trickCards.length > 0 ? S.trickCards[0].suit : null;
          const reason = leadSuit ? 'Must follow ' + SUIT_NAMES[leadSuit] + '!' : 'Invalid play!';
          if (S._host) S._host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
        }
        return;
      }

      /* Playing dummy's hand */
      if (S.currentTurn === S.dummyPlayer) {
        const idx = hitTestDummyCard(mx, my);
        if (idx < 0) return;

        const hand = S.hands[S.dummyPlayer];
        if (V.isValidPlay(hand[idx], hand)) {
          V.playCard(S.dummyPlayer, idx);
        } else {
          const leadSuit = S.trickCards.length > 0 ? S.trickCards[0].suit : null;
          const reason = leadSuit ? 'Must follow ' + SUIT_NAMES[leadSuit] + '!' : 'Invalid play!';
          if (S._host) S._host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
        }
        return;
      }
    }
  }

  function handlePointerMove(mx, my) {
    S.hoveredCard = -1;
    S.hoveredBidBtn = -1;
    S.hoveredPassBtn = false;

    if (S.phase === PHASE_BIDDING && S.biddingPlayer === SOUTH) {
      /* Bid buttons hover */
      for (let lvl = 1; lvl <= 7; ++lvl) {
        for (let si = 0; si < 5; ++si) {
          const r = V.bidBtnRect(lvl, si);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            S.hoveredBidBtn = V.bidBtnIndex(lvl, si);
            return;
          }
        }
      }
      if (CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h))
        S.hoveredPassBtn = true;
      return;
    }

    if (S.phase === PHASE_PLAYING) {
      const ctrl = V.controllerOf(S.currentTurn);
      if (ctrl !== SOUTH) return;

      if (S.currentTurn === SOUTH)
        S.hoveredCard = hitTestPlayerCard(mx, my);
      else if (S.currentTurn === S.dummyPlayer)
        S.hoveredCard = hitTestDummyCard(mx, my);
    }
  }

  Object.assign(V, {
    handleClick, handlePointerMove
  });

})();
