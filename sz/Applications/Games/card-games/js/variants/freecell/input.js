;(function() {
  'use strict';

  /* FreeCell: pointer interaction - dropping dragged cards and moving them
     by click. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.freecell;
  const S = V.S;
  const {
    CARD_W, CARD_H, FREECELL_COUNT, FOUNDATION_COUNT, TABLEAU_COUNT, saveState, startTimer,
    freeCellPos, foundationPos, tableauPos, tableauCardPos, maxMoveableCards, hitTest,
    canPlaceOnFoundation, canPlaceOnTableau, checkWin
  } = V;

  /* ================================================================
   *  MOVE LOGIC (click-to-move selection)
   * ================================================================ */

  function moveSelectionTo(hit) {
    if (!S.selection)
      return false;

    const cards = S.selection.cards;
    const card = cards[0];

    if (hit.area === 'foundation' && cards.length === 1) {
      if (canPlaceOnFoundation(card, hit.index)) {
        if (!S.gameStarted)
          startTimer();
        saveState();
        removeSelectionFromSource();
        S.foundations[hit.index].push(card);
        ++S.moveCount;
        S.selection = null;
        checkWin();
        return true;
      }
    }

    if (hit.area === 'freecell-empty' && cards.length === 1) {
      if (!S.gameStarted)
        startTimer();
      saveState();
      removeSelectionFromSource();
      S.freeCells[hit.col] = card;
      ++S.moveCount;
      S.selection = null;
      return true;
    }

    if (hit.area === 'freecell' && cards.length === 1 && S.selection.source === 'freecell') {
      if (!S.gameStarted)
        startTimer();
      saveState();
      const temp = S.freeCells[hit.col];
      S.freeCells[hit.col] = S.freeCells[S.selection.col];
      S.freeCells[S.selection.col] = temp;
      ++S.moveCount;
      S.selection = null;
      return true;
    }

    if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
      const targetCol = hit.col;
      if (canPlaceOnTableau(card, targetCol)) {
        const moveLimit = maxMoveableCards(targetCol);
        if (cards.length > moveLimit)
          return false;
        if (!S.gameStarted)
          startTimer();
        saveState();
        removeSelectionFromSource();
        for (const c of cards)
          S.tableau[targetCol].push(c);
        ++S.moveCount;
        S.selection = null;
        checkWin();
        return true;
      }
    }

    return false;
  }

  function removeSelectionFromSource() {
    if (!S.selection)
      return;
    if (S.selection.source === 'freecell')
      S.freeCells[S.selection.col] = null;
    else if (S.selection.source === 'tableau')
      S.tableau[S.selection.col].splice(S.selection.index);
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
      if (hit.area === 'foundation' && S.dragging.cards.length === 1) {
        if (canPlaceOnFoundation(S.dragging.cards[0], hit.index)) {
          removeFromDragSource();
          S.foundations[hit.index].push(S.dragging.cards[0]);
          ++S.moveCount;
          dropped = true;
        }
      } else if (hit.area === 'freecell-empty' && S.dragging.cards.length === 1) {
        removeFromDragSource();
        S.freeCells[hit.col] = S.dragging.cards[0];
        ++S.moveCount;
        dropped = true;
      } else if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const targetCol = hit.col;
        if (canPlaceOnTableau(S.dragging.cards[0], targetCol)) {
          const moveLimit = maxMoveableCards(targetCol);
          if (S.dragging.cards.length <= moveLimit) {
            removeFromDragSource();
            for (const card of S.dragging.cards)
              S.tableau[targetCol].push(card);
            ++S.moveCount;
            dropped = true;
          }
        }
      }
    }

    if (!dropped) {
      if (S.dragging.cards.length === 1) {
        for (let i = 0; i < FOUNDATION_COUNT; ++i) {
          const fp = foundationPos(i);
          const dx = px - fp.x - CARD_W / 2;
          const dy = py - fp.y - CARD_H / 2;
          if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H && canPlaceOnFoundation(S.dragging.cards[0], i)) {
            removeFromDragSource();
            S.foundations[i].push(S.dragging.cards[0]);
            ++S.moveCount;
            dropped = true;
            break;
          }
        }
      }

      if (!dropped && S.dragging.cards.length === 1) {
        for (let i = 0; i < FREECELL_COUNT; ++i) {
          if (S.freeCells[i])
            continue;
          const pos = freeCellPos(i);
          const dx = px - pos.x - CARD_W / 2;
          const dy = py - pos.y - CARD_H / 2;
          if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H) {
            removeFromDragSource();
            S.freeCells[i] = S.dragging.cards[0];
            ++S.moveCount;
            dropped = true;
            break;
          }
        }
      }

      if (!dropped) {
        for (let col = 0; col < TABLEAU_COUNT; ++col) {
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
            if (S.dragging.source === 'tableau' && S.dragging.sourceCol === col)
              continue;
            const moveLimit = maxMoveableCards(col);
            if (S.dragging.cards.length <= moveLimit) {
              removeFromDragSource();
              for (const card of S.dragging.cards)
                S.tableau[col].push(card);
              ++S.moveCount;
              dropped = true;
              break;
            }
          }
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
    if (S.dragging.source === 'freecell')
      S.freeCells[S.dragging.sourceCol] = null;
    else if (S.dragging.source === 'tableau')
      S.tableau[S.dragging.sourceCol].splice(S.dragging.sourceIndex);
  }

  Object.assign(V, { moveSelectionTo, tryDrop });

})();
