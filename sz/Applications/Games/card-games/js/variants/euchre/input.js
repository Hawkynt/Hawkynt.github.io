/* Euchre - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.euchre;
  const S = V.S;
  const {
    CANVAS_W, SUIT_NAMES, PHASE_TRUMP_ROUND1, PHASE_TRUMP_ROUND2,
    PHASE_DISCARD, PHASE_PLAYING, PHASE_ROUND_SCORE, PHASE_GAME_OVER,
    PLAYER_HAND_Y
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
      let cy = PLAYER_HAND_Y;
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    // Game over
    if (S.phase === PHASE_GAME_OVER) {
      S.teamScores = [0, 0];
      S.score = 0;
      S.gameOver = false;
      S.dealer = 0;
      if (S._host) S._host.onScoreChanged(S.score);
      V.dealRound();
      return;
    }

    // Round score screen
    if (S.phase === PHASE_ROUND_SCORE) {
      S.dealer = V.leftOf(S.dealer);
      V.dealRound();
      return;
    }

    // Trump round 1 - player's turn
    if (S.phase === PHASE_TRUMP_ROUND1 && S.biddingPlayer === 0) {
      const ob = V.orderUpBtnRect();
      const pb = V.passBtnRect();
      const ab = V.aloneBtnRect();

      if (CE.isInRect(mx, my, ob.x, ob.y, ob.w, ob.h)) {
        V.acceptTrump(0, S.kittyCard.suit, false);
        return;
      }
      if (CE.isInRect(mx, my, ab.x, ab.y, ab.w, ab.h)) {
        V.acceptTrump(0, S.kittyCard.suit, true);
        return;
      }
      if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
        if (S.biddingPlayer === S.dealer) {
          S.biddingPlayer = V.leftOf(S.dealer);
          S.phase = PHASE_TRUMP_ROUND2;
          S.aiTurnTimer = 0;
        } else
          V.advanceBidding();
        return;
      }
      return;
    }

    // Trump round 2 - player's turn
    if (S.phase === PHASE_TRUMP_ROUND2 && S.biddingPlayer === 0) {
      const kittyS = S.kittyCard ? S.kittyCard.suit : null;
      let suitIdx = 0;
      for (const s of CE.SUITS) {
        if (s === kittyS) continue;
        const r = V.suitBtnRect(suitIdx);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          V.acceptTrump(0, s, false);
          return;
        }
        ++suitIdx;
      }
      // Can only pass if not stuck dealer
      if (S.biddingPlayer !== S.dealer) {
        const pb = V.passR2BtnRect();
        if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) {
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
          V.advanceBidding();
          return;
        }
      }
      return;
    }

    // Discard phase
    if (S.phase === PHASE_DISCARD) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;
      S.hands[0].splice(idx, 1);
      V.startPlaying();
      return;
    }

    // Playing phase - player's turn
    if (S.phase === PHASE_PLAYING && S.currentTurn === 0) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const hand = S.hands[0];
      if (V.isValidPlay(hand[idx], hand)) {
        V.playCard(0, idx);
      } else {
        const leadSuit = V.effectiveSuit(S.trickCards[0]);
        let reason = 'Must follow ' + SUIT_NAMES[leadSuit] + '!';
        if (S._host) S._host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
      }
      return;
    }
  }

  function handlePointerMove(mx, my) {
    S.hoveredCard = -1;
    S.hoveredBtn = '';

    if ((S.phase === PHASE_PLAYING && S.currentTurn === 0) || S.phase === PHASE_DISCARD)
      S.hoveredCard = hitTestPlayerCard(mx, my);

    if (S.phase === PHASE_TRUMP_ROUND1 && S.biddingPlayer === 0) {
      const ob = V.orderUpBtnRect();
      const pb = V.passBtnRect();
      const ab = V.aloneBtnRect();
      if (CE.isInRect(mx, my, ob.x, ob.y, ob.w, ob.h)) S.hoveredBtn = 'order';
      else if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) S.hoveredBtn = 'pass';
      else if (CE.isInRect(mx, my, ab.x, ab.y, ab.w, ab.h)) S.hoveredBtn = 'alone';
    }

    if (S.phase === PHASE_TRUMP_ROUND2 && S.biddingPlayer === 0) {
      const kittyS = S.kittyCard ? S.kittyCard.suit : null;
      let suitIdx = 0;
      for (const s of CE.SUITS) {
        if (s === kittyS) continue;
        const r = V.suitBtnRect(suitIdx);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) { S.hoveredBtn = s; break; }
        ++suitIdx;
      }
      if (S.biddingPlayer !== S.dealer) {
        const pb = V.passR2BtnRect();
        if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) S.hoveredBtn = 'pass2';
      }
    }
  }

  Object.assign(V, {
    handleClick, handlePointerMove
  });

})();
