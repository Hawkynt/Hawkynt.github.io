/* Belote: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const hasSuit = SZ.CardGames.shared.euroCards.hasSuit;

  const V = SZ.CardGames.v.belote;
  const S = V.S;
  const { CANVAS_W, SUIT_NAMES, PHASE_BID_ROUND1, PHASE_BID_ROUND2, PHASE_PLAYING,
    PHASE_ROUND_OVER, PHASE_GAME_OVER, PLAYER_HAND_Y } = V;

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

    // Round over screen
    if (S.phase === PHASE_ROUND_OVER) {
      S.dealer = V.leftOf(S.dealer);
      V.dealRound();
      return;
    }

    // Bid round 1 - player's turn
    if (S.phase === PHASE_BID_ROUND1 && S.biddingPlayer === 0) {
      const tb = V.takeBtnRect();
      const pb = V.passBtnRect();

      if (CE.isInRect(mx, my, tb.x, tb.y, tb.w, tb.h)) {
        V.acceptTrumpRound1(0);
        return;
      }
      if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
        if (S.biddingPlayer === S.dealer) {
          S.biddingPlayer = V.leftOf(S.dealer);
          S.phase = PHASE_BID_ROUND2;
          S.aiTurnTimer = 0;
        } else
          V.advanceBidding();
        return;
      }
      return;
    }

    // Bid round 2 - player's turn
    if (S.phase === PHASE_BID_ROUND2 && S.biddingPlayer === 0) {
      const excludeSuit = S.proposedCard ? S.proposedCard.suit : null;
      let suitIdx = 0;
      for (const s of CE.SUITS) {
        if (s === excludeSuit) continue;
        const r = V.suitBtnRect(suitIdx);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          V.acceptTrumpRound2(0, s);
          return;
        }
        ++suitIdx;
      }
      const pb = V.passR2BtnRect();
      if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
        if (S.biddingPlayer === S.dealer) {
          // All passed both rounds: redeal
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 260, 'All passed! Redealing...', { color: '#f80', size: 16 });
          S.dealer = V.leftOf(S.dealer);
          V.dealRound();
        } else
          V.advanceBidding();
        return;
      }
      return;
    }

    // Playing phase - player's turn
    if (S.phase === PHASE_PLAYING && S.currentTurn === 0) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const hand = S.hands[0];
      if (V.isValidPlay(hand[idx], hand, 0))
        V.playCard(0, idx);
      else if (S._host) {
        let reason = 'Invalid play!';
        const leadSuit = S.trickCards.length > 0 ? S.trickCards[0].suit : null;
        if (leadSuit && hasSuit(hand, leadSuit))
          reason = 'Must follow ' + SUIT_NAMES[leadSuit] + '!';
        else if (leadSuit && !hasSuit(hand, leadSuit) && hasSuit(hand, S.trumpSuit))
          reason = 'Must trump!';
        S._host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
      }
      return;
    }
  }

  function handlePointerMove(mx, my) {
    S.hoveredCard = -1;
    S.hoveredBtn = '';

    if (S.phase === PHASE_PLAYING && S.currentTurn === 0)
      S.hoveredCard = hitTestPlayerCard(mx, my);

    if (S.phase === PHASE_BID_ROUND1 && S.biddingPlayer === 0) {
      const tb = V.takeBtnRect();
      const pb = V.passBtnRect();
      if (CE.isInRect(mx, my, tb.x, tb.y, tb.w, tb.h)) S.hoveredBtn = 'take';
      else if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) S.hoveredBtn = 'pass';
    }

    if (S.phase === PHASE_BID_ROUND2 && S.biddingPlayer === 0) {
      const excludeSuit = S.proposedCard ? S.proposedCard.suit : null;
      let suitIdx = 0;
      for (const s of CE.SUITS) {
        if (s === excludeSuit) continue;
        const r = V.suitBtnRect(suitIdx);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) { S.hoveredBtn = s; break; }
        ++suitIdx;
      }
      const pb = V.passR2BtnRect();
      if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) S.hoveredBtn = 'pass2';
    }
  }

  V.handleClick = handleClick;
  V.handlePointerMove = handlePointerMove;

})();
