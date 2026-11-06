;(function() {
  'use strict';

  /* Solitaire (Klondike): pointer interaction - dropping dragged cards and moving them
     by click. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.solitaire;
  const S = V.S;
  const {
    CARD_W, CARD_H, FOUNDATION_COUNT, TABLEAU_COUNT, foundationPos, tableauPos, tableauCardPos,
    hitTest, canPlaceOnFoundation, canPlaceOnTableau, checkWin, startFlipAnim
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
      if (hit.area === 'foundation' && S.dragging.cards.length === 1) {
        if (canPlaceOnFoundation(S.dragging.cards[0], hit.index)) {
          removeFromSource();
          S.dragging.cards[0].faceUp = true;
          S.foundations[hit.index].push(S.dragging.cards[0]);
          ++S.moveCount;
          dropped = true;
        }
      } else if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const col = hit.col;
        if (canPlaceOnTableau(S.dragging.cards[0], col)) {
          removeFromSource();
          for (const card of S.dragging.cards) {
            card.faceUp = true;
            S.tableau[col].push(card);
          }
          ++S.moveCount;
          dropped = true;
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
            removeFromSource();
            S.dragging.cards[0].faceUp = true;
            S.foundations[i].push(S.dragging.cards[0]);
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
            removeFromSource();
            for (const card of S.dragging.cards) {
              card.faceUp = true;
              S.tableau[col].push(card);
            }
            ++S.moveCount;
            dropped = true;
            break;
          }
        }
      }
    }

    if (dropped)
      S.statusMsg = '';

    S.dragging = null;

    if (dropped)
      checkWin();
  }

  function removeFromSource() {
    if (!S.dragging)
      return;
    if (S.dragging.source === 'waste') {
      S.waste.splice(S.dragging.sourceIndex, 1);
    } else if (S.dragging.source === 'tableau') {
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
