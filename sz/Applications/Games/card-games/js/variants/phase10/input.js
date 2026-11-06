/* Phase 10 input: clicks for drawing and playing (select, lay phase, hit, discard) and keyboard shortcuts. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.phase10;
  const S = V.S;
  const { CANVAS_W, NUM_PLAYERS, PHASES, TURN_DRAW, TURN_PLAY, BTN_PHASE, BTN_HIT } = V;

  /* ================================================================
     CLICK HANDLING
     ================================================================ */

  function handleClickDraw(mx, my) {
    const stockX = CANVAS_W / 2 - CE.CARD_W - 20;
    const stockY = 200;
    const discardX = CANVAS_W / 2 + 20;
    const discardY = 200;

    if (CE.isInRect(mx, my, stockX, stockY, CE.CARD_W, CE.CARD_H)) {
      V.drawFromStock(0);
      return true;
    }
    if (CE.isInRect(mx, my, discardX, discardY, CE.CARD_W, CE.CARD_H)) {
      V.drawFromDiscard(0);
      return true;
    }
    return false;
  }

  function handleClickPlay(mx, my) {
    // Hit target selection overlay
    if (S.hitTarget !== null) {
      const card = S.hands[0][S.hitTarget.handIdx];
      for (let tp = 0; tp < NUM_PLAYERS; ++tp) {
        if (S.laidPhases[tp].length === 0) continue;
        const gy = 160 + tp * 80 + 8;
        let ox = 40;
        const cw = CE.CARD_W * 0.6;
        const ch = CE.CARD_H * 0.6;
        const phIdx = S.playerPhases[tp];
        const ph = PHASES[phIdx];
        for (let gi = 0; gi < S.laidPhases[tp].length; ++gi) {
          const gLen = S.laidPhases[tp][gi].length;
          const gw = gLen * cw * 0.55 + cw * 0.45;
          if (CE.isInRect(mx, my, ox, gy, gw, ch)) {
            const gDef = ph.groups[gi] || ph.groups[0];
            if (V.canHitOnGroup(card, S.laidPhases[tp][gi], gDef)) {
              V.hitOnGroup(0, S.hitTarget.handIdx, tp, gi);
              S.selectedCards = [];
              S.hitTarget = null;
              if (S.hands[0].length === 0) V.endRound(0);
              return true;
            }
            if (S._host) S._host.floatingText.add(mx, my - 20, 'Cannot hit here!', { color: '#f88', size: 14 });
            return true;
          }
          ox += gw + 8;
        }
      }
      S.hitTarget = null;
      return true;
    }

    // Lay Phase button
    if (V.playerCanLayPhase() && CE.isInRect(mx, my, BTN_PHASE.x, BTN_PHASE.y, BTN_PHASE.w, BTN_PHASE.h)) {
      const sel = S.selectedCards.map(i => S.hands[0][i]);
      const phIdx = S.playerPhases[0];
      const result = V.tryMatchPhase(sel, PHASES[phIdx]);
      if (result) {
        V.layPhase(0, result);
        S.selectedCards = [];
        if (S.hands[0].length === 0) V.endRound(0);
        return true;
      }
    }

    // Hit button
    if (V.playerCanHitSelected() && CE.isInRect(mx, my, BTN_HIT.x, BTN_HIT.y, BTN_HIT.w, BTN_HIT.h)) {
      S.hitTarget = { handIdx: S.selectedCards[0] };
      return true;
    }

    // Card selection / discard
    const handY = 470;
    const handSpacing = Math.min(55, (CANVAS_W - 80) / Math.max(S.hands[0].length, 1));
    for (let i = S.hands[0].length - 1; i >= 0; --i) {
      const cx = 40 + i * handSpacing;
      const raised = S.selectedCards.includes(i) ? -12 : 0;
      if (CE.isInRect(mx, my, cx, handY + raised, CE.CARD_W, CE.CARD_H)) {
        const idx = S.selectedCards.indexOf(i);
        if (idx >= 0)
          S.selectedCards.splice(idx, 1);
        else
          S.selectedCards.push(i);
        return true;
      }
    }

    // Click discard pile to discard last selected card
    const discardX = CANVAS_W / 2 + 20;
    const discardY = 200;
    if (CE.isInRect(mx, my, discardX, discardY, CE.CARD_W, CE.CARD_H) && S.selectedCards.length === 1) {
      V.discardCard(0, S.selectedCards[0]);
      return true;
    }

    return false;
  }

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S.roundOver && !S.gameOver) {
        V.setupRound();
        return;
      }
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }
    if (S.currentPlayer !== 0) return;

    if (S.turnPhase === TURN_DRAW)
      handleClickDraw(mx, my);
    else
      handleClickPlay(mx, my);
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver || S.currentPlayer !== 0) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9 && S.turnPhase === TURN_PLAY) {
      const idx = num - 1;
      if (idx < S.hands[0].length) {
        const si = S.selectedCards.indexOf(idx);
        if (si >= 0) S.selectedCards.splice(si, 1);
        else S.selectedCards.push(idx);
      }
    }
    if (e.key === 'd' || e.key === 'D') {
      if (S.turnPhase === TURN_PLAY && S.selectedCards.length === 1)
        V.discardCard(0, S.selectedCards[0]);
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
