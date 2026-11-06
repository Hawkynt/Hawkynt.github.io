;(function() {
  'use strict';

  /* Baker's Dozen: pointer interaction - dropping dragged cards and moving them
     by click. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.bakersdozen;
  const S = V.S;
  const {
    CARD_W, CARD_H, TABLEAU_COUNT, FOUNDATION_COUNT, foundationPos, tableauPos, tableauCardPos,
    saveState, startTimer, hitTest, canPlaceOnFoundation, canPlaceOnTableau, checkWin
  } = V;

  /* ================================================================
   *  SELECTION-BASED MOVE
   * ================================================================ */

  function moveSelectionTo(hit) {
    if (!S.selection)
      return false;

    const card = S.selection.card;

    if (hit.area === 'foundation') {
      if (canPlaceOnFoundation(card, hit.index)) {
        if (!S.gameStarted)
          startTimer();
        saveState();
        S.tableau[S.selection.col].pop();
        S.foundations[hit.index].push(card);
        ++S.moveCount;
        S.score += 10;
        S.selection = null;
        checkWin();
        return true;
      }
    }

    if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
      const targetCol = hit.col;
      if (canPlaceOnTableau(card, targetCol)) {
        if (!S.gameStarted)
          startTimer();
        saveState();
        S.tableau[S.selection.col].pop();
        S.tableau[targetCol].push(card);
        ++S.moveCount;
        S.selection = null;
        checkWin();
        return true;
      }
    }

    return false;
  }

  /* ================================================================
   *  DROP LOGIC (drag and drop)
   * ================================================================ */

  function tryDrop(px, py) {
    if (!S.dragging)
      return;

    const hit = hitTest(px, py);
    let dropped = false;

    if (hit) {
      if (hit.area === 'foundation') {
        if (canPlaceOnFoundation(S.dragging.card, hit.index)) {
          removeFromDragSource();
          S.foundations[hit.index].push(S.dragging.card);
          ++S.moveCount;
          S.score += 10;
          dropped = true;
        }
      } else if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const targetCol = hit.col;
        if (canPlaceOnTableau(S.dragging.card, targetCol)) {
          removeFromDragSource();
          S.tableau[targetCol].push(S.dragging.card);
          ++S.moveCount;
          dropped = true;
        }
      }
    }

    // Proximity snap to foundations
    if (!dropped) {
      for (let i = 0; i < FOUNDATION_COUNT; ++i) {
        const fp = foundationPos(i);
        const dx = px - fp.x - CARD_W / 2;
        const dy = py - fp.y - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H && canPlaceOnFoundation(S.dragging.card, i)) {
          removeFromDragSource();
          S.foundations[i].push(S.dragging.card);
          ++S.moveCount;
          S.score += 10;
          dropped = true;
          break;
        }
      }
    }

    // Proximity snap to tableau columns
    if (!dropped) {
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const pile = S.tableau[col];
        if (pile.length === 0)
          continue;
        const tp = tableauCardPos(col, pile.length - 1);
        const tx = tableauPos(col).x;
        const dx = px - tx - CARD_W / 2;
        const dy = py - tp.y - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H * 0.8 && canPlaceOnTableau(S.dragging.card, col)) {
          if (S.dragging.source === 'tableau' && S.dragging.sourceCol === col)
            continue;
          removeFromDragSource();
          S.tableau[col].push(S.dragging.card);
          ++S.moveCount;
          dropped = true;
          break;
        }
      }
    }

    if (!dropped) {
      if (S.undoHistory.length > 0)
        S.undoHistory.pop();
    }

    S.dragging = null;

    if (dropped)
      checkWin();
  }

  function removeFromDragSource() {
    if (!S.dragging)
      return;
    if (S.dragging.source === 'tableau')
      S.tableau[S.dragging.sourceCol].pop();
  }

  Object.assign(V, { moveSelectionTo, tryDrop });

})();
