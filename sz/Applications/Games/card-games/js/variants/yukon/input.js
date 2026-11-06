;(function() {
  'use strict';

  /* Yukon: pointer interaction - dropping dragged cards and moving them
     by click. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.yukon;
  const S = V.S;
  const {
    CARD_W, CARD_H, FOUNDATION_COUNT, TABLEAU_COUNT, foundationPos, tableauPos, tableauCardPos,
    hitTest, canPlaceOnFoundation, canPlaceOnTableau, flipTopCard, checkWin
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
      // Foundation drop (single card only)
      if (hit.area === 'foundation' && S.dragging.cards.length === 1) {
        if (canPlaceOnFoundation(S.dragging.cards[0], hit.index)) {
          removeFromSource();
          S.dragging.cards[0].faceUp = true;
          S.foundations[hit.index].push(S.dragging.cards[0]);
          ++S.moveCount;
          S.score += 10;
          dropped = true;
        }
      }
      // Tableau drop
      else if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const col = hit.col;
        if (canPlaceOnTableau(S.dragging.cards[0], col)) {
          removeFromSource();
          for (const card of S.dragging.cards) {
            card.faceUp = true;
            S.tableau[col].push(card);
          }
          ++S.moveCount;
          S.score += 5;
          dropped = true;
        }
      }
    }

    // Proximity snapping to foundation
    if (!dropped && S.dragging.cards.length === 1) {
      for (let i = 0; i < FOUNDATION_COUNT; ++i) {
        const fp = foundationPos(i);
        const dx = px - fp.x - CARD_W / 2;
        const dy = py - fp.y - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H && canPlaceOnFoundation(S.dragging.cards[0], i)) {
          removeFromSource();
          S.dragging.cards[0].faceUp = true;
          S.foundations[i].push(S.dragging.cards[0]);
          ++S.moveCount;
          S.score += 10;
          dropped = true;
          break;
        }
      }
    }

    // Proximity snapping to tableau
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
          S.score += 5;
          dropped = true;
          break;
        }
      }
    }

    if (!dropped) {
      if (S.undoHistory.length > 0)
        S.undoHistory.pop();
    } else
      S.statusMsg = '';

    S.dragging = null;

    if (dropped)
      checkWin();
  }

  function removeFromSource() {
    if (!S.dragging)
      return;
    if (S.dragging.source === 'tableau') {
      S.tableau[S.dragging.sourceCol].splice(S.dragging.sourceIndex);
      flipTopCard(S.dragging.sourceCol);
    }
  }

  Object.assign(V, { tryDrop });

})();
