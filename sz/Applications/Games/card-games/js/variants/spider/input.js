;(function() {
  'use strict';

  /* Spider: pointer interaction - dropping dragged cards and moving them
     by click. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spider;
  const S = V.S;
  const {
    CARD_W, CARD_H, TABLEAU_COUNT, tableauPos, tableauCardPos, canPlaceOnTableau,
    checkForCompletedSequence, removeCompletedSequence, hitTest, startFlipAnim
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
      if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const col = hit.col;
        if (S.dragging.source === 'tableau' && S.dragging.sourceCol === col) {
          // same column
        } else if (canPlaceOnTableau(S.dragging.cards[0], col)) {
          removeFromSource();
          for (const card of S.dragging.cards) {
            card.faceUp = true;
            S.tableau[col].push(card);
          }
          ++S.moveCount;
          ++S.score;
          dropped = true;
        }
      }
    }

    if (!dropped) {
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        if (S.dragging.source === 'tableau' && S.dragging.sourceCol === col)
          continue;
        const pile = S.tableau[col];
        let targetY;
        if (pile.length === 0) {
          const tp = tableauPos(col);
          targetY = tp.y;
        } else {
          const tp = tableauCardPos(col, pile.length - 1);
          targetY = tp.y;
        }
        const tx = tableauPos(col).x;
        const dx = px - tx - CARD_W / 2;
        const dy = py - targetY - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H * 0.8 && canPlaceOnTableau(S.dragging.cards[0], col)) {
          removeFromSource();
          for (const card of S.dragging.cards) {
            card.faceUp = true;
            S.tableau[col].push(card);
          }
          ++S.moveCount;
          ++S.score;
          dropped = true;
          break;
        }
      }
    }

    let droppedCol = -1;
    if (dropped) {
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const pile = S.tableau[col];
        if (pile.length > 0 && pile[pile.length - 1] === S.dragging.cards[S.dragging.cards.length - 1]) {
          droppedCol = col;
          break;
        }
      }
    }

    if (!dropped) {
      if (S.undoHistory.length > 0)
        S.undoHistory.pop();
    }

    S.dragging = null;

    if (dropped && droppedCol >= 0) {
      if (checkForCompletedSequence(droppedCol))
        removeCompletedSequence(droppedCol);
    }
  }

  function removeFromSource() {
    if (!S.dragging)
      return;
    if (S.dragging.source === 'tableau') {
      S.tableau[S.dragging.sourceCol].splice(S.dragging.sourceIndex);
      const pile = S.tableau[S.dragging.sourceCol];
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        const flippedCard = pile[pile.length - 1];
        flippedCard.faceUp = true;
        const fpos = tableauCardPos(S.dragging.sourceCol, pile.length - 1);
        startFlipAnim(flippedCard, fpos.x, fpos.y);
      }
    }
  }

  Object.assign(V, { tryDrop });

})();
