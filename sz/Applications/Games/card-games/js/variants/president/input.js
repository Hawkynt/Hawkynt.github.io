/* President: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['president'];
  const S = V.S;
  const { PLAY_BTN, PASS_BTN, PHASE_PLAYING, CANVAS_W, PHASE_EXCHANGE, PHASE_ROUND_OVER } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      let cy = V.playerCardY();
      const isSelected = S.selectedCards.indexOf(hand[i]) >= 0;
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
        S.scores = [0, 0, 0, 0];
        S.titles = [-1, -1, -1, -1];
        S.roundNumber = 0;
        S.score = 0;
        S.gameOver = false;
        if (S._host) S._host.onScoreChanged(S.score);
      }
      S.roundOver = false;
      V.dealRound();
      return;
    }

    if (S.phase === PHASE_EXCHANGE) {
      const myTitle = S.titles[0];
      const count = V.getExchangeCount(myTitle);

      if (count > 0 && S.selectedCards.length === count) {
        const btn = { x: CANVAS_W / 2 - 60, y: 290, w: 120, h: 30 };
        if (CE.isInRect(mx, my, btn.x, btn.y, btn.w, btn.h)) {
          S.exchangeCards[0] = S.selectedCards.slice();
          S.exchangeDone[0] = true;
          S.selectedCards = [];

          if (S.exchangeDone.every(d => d))
            V.executeExchange();
          return;
        }
      }

      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const card = S.hands[0][idx];
      const pos = S.selectedCards.indexOf(card);
      if (pos >= 0) {
        S.selectedCards.splice(pos, 1);
      } else if (S.selectedCards.length < count)
        S.selectedCards.push(card);

      return;
    }

    if (S.phase === PHASE_PLAYING && S.currentTurn === 0) {
      if (CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
        if (S.pile.length === 0) {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Must play when leading!', { color: '#f88', size: 14 });
          return;
        }
        S.selectedCards = [];
        V.doPass(0);
        return;
      }

      if (S.selectedCards.length > 0 && CE.isInRect(mx, my, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h)) {
        if (V.isValidPlay(S.selectedCards, S.hands[0])) {
          const cardsToPlay = S.selectedCards.slice();
          S.selectedCards = [];
          V.playCards(0, cardsToPlay);
        } else {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Invalid selection!', { color: '#f88', size: 14 });
        }
        return;
      }

      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const card = S.hands[0][idx];
      const pos = S.selectedCards.indexOf(card);
      if (pos >= 0) {
        S.selectedCards.splice(pos, 1);
      } else {
        if (S.selectedCards.length > 0 && S.selectedCards[0].rank !== card.rank) {
          S.selectedCards = [card];
        } else
          S.selectedCards.push(card);
      }
      return;
    }
  }

  function handlePointerMove(mx, my) {
    if ((S.phase === PHASE_PLAYING || S.phase === PHASE_EXCHANGE) && S.currentTurn === 0)
      S.hoverCardIdx = hitTestPlayerCard(mx, my);
    else
      S.hoverCardIdx = -1;
  }

  function handleKey(e) {
    if (S.phase !== PHASE_PLAYING || S.currentTurn !== 0) return;

    if (e.key === 'Enter' || e.key === ' ') {
      if (S.selectedCards.length > 0 && V.isValidPlay(S.selectedCards, S.hands[0])) {
        const cardsToPlay = S.selectedCards.slice();
        S.selectedCards = [];
        V.playCards(0, cardsToPlay);
      }
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      if (S.pile.length > 0) {
        S.selectedCards = [];
        V.doPass(0);
      }
      return;
    }

    if (e.key === 'Escape') {
      S.selectedCards = [];
      return;
    }
  }

  Object.assign(V, { handleClick, handlePointerMove, handleKey });

})();
