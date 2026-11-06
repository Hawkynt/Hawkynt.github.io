;(function() {
  'use strict';

  /* Forty Thieves: pointer interaction - dropping dragged cards and moving them
     by click. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.fortythieves;
  const S = V.S;
  const {
    CARD_W, CARD_H, TABLEAU_COUNT, FOUNDATION_COUNT, foundationPos, tableauPos, tableauCardPos,
    canPlaceOnFoundation, canPlaceOnTableau, hitTest, checkWin
  } = V;

  /* ================================================================
   *  DROP LOGIC
   * ================================================================ */

  function tryDrop(px, py) {
    if (!S.dragging)
      return;

    const hit = hitTest(px, py);
    let dropped = false;

    if (hit) {
      // Forty Thieves: single card moves only
      if (hit.area === 'foundation' && S.dragging.cards.length === 1) {
        if (canPlaceOnFoundation(S.dragging.cards[0], hit.index)) {
          removeFromSource();
          S.foundations[hit.index].push(S.dragging.cards[0]);
          ++S.moveCount;
          S.score += 10;
          dropped = true;
        }
      } else if ((hit.area === 'tableau' || hit.area === 'tableau-empty') && S.dragging.cards.length === 1) {
        const col = hit.col;
        if (S.dragging.source !== 'tableau' || S.dragging.sourceCol !== col) {
          if (canPlaceOnTableau(S.dragging.cards[0], col)) {
            removeFromSource();
            S.dragging.cards[0].faceUp = true;
            S.tableau[col].push(S.dragging.cards[0]);
            ++S.moveCount;
            dropped = true;
          }
        }
      }
    }

    // Proximity snap to foundations
    if (!dropped && S.dragging.cards.length === 1) {
      for (let i = 0; i < FOUNDATION_COUNT; ++i) {
        const fp = foundationPos(i);
        const dx = px - fp.x - CARD_W / 2;
        const dy = py - fp.y - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H && canPlaceOnFoundation(S.dragging.cards[0], i)) {
          removeFromSource();
          S.foundations[i].push(S.dragging.cards[0]);
          ++S.moveCount;
          S.score += 10;
          dropped = true;
          break;
        }
      }
    }

    // Proximity snap to tableau
    if (!dropped && S.dragging.cards.length === 1) {
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        if (S.dragging.source === 'tableau' && S.dragging.sourceCol === col)
          continue;
        const pile = S.tableau[col];
        const targetY = pile.length === 0 ? tableauPos(col).y : tableauCardPos(col, pile.length - 1).y;
        const tx = tableauPos(col).x;
        const dx = px - tx - CARD_W / 2;
        const dy = py - targetY - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H * 0.8 && canPlaceOnTableau(S.dragging.cards[0], col)) {
          removeFromSource();
          S.dragging.cards[0].faceUp = true;
          S.tableau[col].push(S.dragging.cards[0]);
          ++S.moveCount;
          dropped = true;
          break;
        }
      }
    }

    if (!dropped) {
      if (S.undoHistory.length > 0)
        S.undoHistory.pop();
    } else {
      S.statusMsg = '';
      if (S._host && S._host.onScoreChanged)
        S._host.onScoreChanged(S.score);
    }

    S.dragging = null;

    if (dropped)
      checkWin();
  }

  function removeFromSource() {
    if (!S.dragging)
      return;
    if (S.dragging.source === 'waste')
      S.waste.splice(S.dragging.sourceIndex, 1);
    else if (S.dragging.source === 'tableau')
      S.tableau[S.dragging.sourceCol].splice(S.dragging.sourceIndex, 1);
  }

  Object.assign(V, { tryDrop });

})();
