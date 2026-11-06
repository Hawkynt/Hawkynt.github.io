/* Skat - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.skat;
  const S = V.S;
  const {
    PHASE_BIDDING, PHASE_SKAT_PICK, PHASE_TRUMP_PICK, PHASE_PLAYING,
    BID_BTN, PASS_BTN, SKAT_BTN, trumpBtns
  } = V;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    // Bidding phase
    if (S.phase === PHASE_BIDDING) {
      if (mx >= BID_BTN.x && mx <= BID_BTN.x + BID_BTN.w && my >= BID_BTN.y && my <= BID_BTN.y + BID_BTN.h) {
        S.bidActive[0] = true;
        ++S.bidCurrent;
        S.bidPhaseStep = 2;
        V.runBiddingStep();
        return;
      }
      if (mx >= PASS_BTN.x && mx <= PASS_BTN.x + PASS_BTN.w && my >= PASS_BTN.y && my <= PASS_BTN.y + PASS_BTN.h) {
        S.bidActive[0] = false;
        S.bidPhaseStep = 2;
        V.runBiddingStep();
        return;
      }
      return;
    }

    // Skat pick phase
    if (S.phase === PHASE_SKAT_PICK) {
      if (mx >= SKAT_BTN.x && mx <= SKAT_BTN.x + SKAT_BTN.w && my >= SKAT_BTN.y && my <= SKAT_BTN.y + SKAT_BTN.h) {
        // Pick up skat cards
        for (const c of S.skatPile) { c.faceUp = true; S.skatHands[0].push(c); }
        S.skatPile = [];
        S.phase = PHASE_TRUMP_PICK;
        return;
      }
      return;
    }

    // Trump pick phase
    if (S.phase === PHASE_TRUMP_PICK) {
      for (const btn of trumpBtns) {
        if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
          S.trumpSuit = btn.suit;
          // Discard 2 cards (for simplicity, discard last 2)
          if (S.skatHands[0].length > 10) {
            S.skatPile.push(S.skatHands[0].pop());
            S.skatPile.push(S.skatHands[0].pop());
          }
          S.phase = PHASE_PLAYING;
          S.currentTrickLead = S.declarer;
          S.currentTurn = S.declarer;
          return;
        }
      }
      return;
    }

    // Playing phase - player's turn
    if (S.phase !== PHASE_PLAYING || S.currentTurn !== 0) return;
    const hand = S.skatHands[0];
    for (let i = hand.length - 1; i >= 0; --i) {
      const cx = 60 + i * 60;
      if (mx >= cx && mx <= cx + CE.CARD_W && my >= 440 && my <= 440 + CE.CARD_H) {
        const leadSuit = S.trickCards.length > 0 ? V.effectiveSuit(S.trickCards[0]) : null;
        if (V.skatIsValid(hand[i], leadSuit, hand)) {
          const card = hand.splice(i, 1)[0];
          card.faceUp = true;
          S.trickCards.push(card);
          S.trickPlayers.push(0);
          S.currentTurn = (S.currentTurn + 1) % 3;
          if (S.trickCards.length >= 3) V.resolveTrick();
        } else {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Must follow suit!', { color: '#f88', size: 14 });
        }
        return;
      }
    }
  }

  Object.assign(V, {
    handleClick
  });

})();
