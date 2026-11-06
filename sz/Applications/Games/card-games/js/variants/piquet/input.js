/* Piquet: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const hasSuit = SZ.CardGames.shared.euroCards.hasSuit;

  const V = SZ.CardGames.v.piquet;
  const S = V.S;
  const { ELDER_MAX_EXCHANGE, PHASE_EXCHANGE, PHASE_DECLARE_POINT, PHASE_DECLARE_SEQUENCE,
    PHASE_DECLARE_SET, PHASE_TRICK_PLAY, PHASE_ROUND_OVER, EXCHANGE_BTN, PLAYER_HAND_Y } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const total = S.playerHand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
      if (S.phase === PHASE_EXCHANGE && S.selectedIndices.includes(i))
        cy -= 18;
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    // Round over - advance
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.gameOver)
        V.setupGame();
      else {
        S.roundOver = false;
        V.dealRound();
      }
      return;
    }

    // Exchange phase - toggle card selection or click Exchange button
    if (S.phase === PHASE_EXCHANGE && !S.exchangeDone) {
      // Check Exchange button
      if (CE.isInRect(mx, my, EXCHANGE_BTN.x, EXCHANGE_BTN.y, EXCHANGE_BTN.w, EXCHANGE_BTN.h)) {
        const elderIsPlayer = V.elder() === 0;
        const maxExch = elderIsPlayer
          ? Math.min(ELDER_MAX_EXCHANGE, S.talon.length)
          : S.talon.length;
        if (S.selectedIndices.length >= 1 && S.selectedIndices.length <= maxExch)
          V.doPlayerExchange();
        return;
      }

      // Toggle card selection
      const idx = hitTestPlayerCard(mx, my);
      if (idx >= 0) {
        const pos = S.selectedIndices.indexOf(idx);
        if (pos >= 0)
          S.selectedIndices.splice(pos, 1);
        else {
          const elderIsPlayer = V.elder() === 0;
          const maxExch = elderIsPlayer
            ? Math.min(ELDER_MAX_EXCHANGE, S.talon.length)
            : S.talon.length;
          if (S.selectedIndices.length < maxExch)
            S.selectedIndices.push(idx);
        }
      }
      return;
    }

    // Declaration phases - click to advance
    if (S.phase === PHASE_DECLARE_POINT || S.phase === PHASE_DECLARE_SEQUENCE || S.phase === PHASE_DECLARE_SET) {
      V.advanceDeclarationPhase();
      return;
    }

    // Trick play - player's turn
    if (S.phase === PHASE_TRICK_PLAY && S.currentTurn === 0) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      if (V.isValidPlay(S.playerHand[idx], S.playerHand)) {
        V.playCard(0, idx);
      } else {
        const leadSuit = S.trickCards.length > 0 ? S.trickCards[0].card.suit : null;
        const reason = leadSuit && hasSuit(S.playerHand, leadSuit)
          ? 'Must follow suit!'
          : 'Invalid play!';
        if (S._host) S._host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
      }
      return;
    }
  }

  function handlePointerMove(mx, my) {
    S.hoverCardIdx = -1;

    if (S.phase === PHASE_EXCHANGE || (S.phase === PHASE_TRICK_PLAY && S.currentTurn === 0))
      S.hoverCardIdx = hitTestPlayerCard(mx, my);
  }

  function handleKey(e) {
    if (e.key === 'F2') {
      e.preventDefault();
      S.playerScore = 0;
      S.aiScore = 0;
      S.score = 0;
      S.gameOver = false;
      if (S._host) S._host.onScoreChanged(S.score);
      V.setupGame();
    }
    if (S.phase === PHASE_EXCHANGE && (e.key === 'Enter' || e.key === 'e' || e.key === 'E')) {
      const elderIsPlayer = V.elder() === 0;
      const maxExch = elderIsPlayer
        ? Math.min(ELDER_MAX_EXCHANGE, S.talon.length)
        : S.talon.length;
      if (S.selectedIndices.length >= 1 && S.selectedIndices.length <= maxExch)
        V.doPlayerExchange();
    }
  }

  V.handleClick = handleClick;
  V.handlePointerMove = handlePointerMove;
  V.handleKey = handleKey;

})();
