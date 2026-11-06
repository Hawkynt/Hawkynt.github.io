;(function() {
  'use strict';

  /* Solitaire (Klondike): game rules - dealing, legal moves, undo, timer, auto-moves and
     win detection. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.solitaire;
  const S = V.S;
  const {
    CE, FOUNDATION_COUNT, TABLEAU_COUNT, MAX_UNDO, stockPos, foundationPos, tableauCardPos,
    wasteCardPos
  } = V;

  /* ================================================================
   *  isDragSource helper
   * ================================================================ */

  function isDragSource(type, index) {
    if (!S.dragging)
      return false;
    if (type === 'waste' && S.dragging.source === 'waste')
      return index === S.dragging.sourceIndex;
    if (type === 'tableau' && S.dragging.source === 'tableau' && S.dragging.sourceCol === index)
      return true;
    return false;
  }

  /* ================================================================
   *  GAME RULES
   * ================================================================ */

  function canPlaceOnFoundation(card, foundationIndex) {
    const pile = S.foundations[foundationIndex];
    if (pile.length === 0)
      return card.value === 0;
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.value === top.value + 1;
  }

  function canPlaceOnTableau(card, col) {
    const pile = S.tableau[col];
    if (pile.length === 0)
      return card.value === 12;
    const top = pile[pile.length - 1];
    return top.faceUp && card.color !== top.color && card.value === top.value - 1;
  }

  function findFoundationTarget(card) {
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      if (canPlaceOnFoundation(card, i))
        return i;
    return -1;
  }

  function hasAnyValidMove(card, excludeCol) {
    if (findFoundationTarget(card) >= 0)
      return true;
    for (let c = 0; c < TABLEAU_COUNT; ++c) {
      if (c === excludeCol)
        continue;
      if (canPlaceOnTableau(card, c))
        return true;
    }
    return false;
  }

  /* ================================================================
   *  TIMER
   * ================================================================ */

  function startTimer() {
    if (S.timerInterval)
      return;
    S.gameStarted = true;
    S.timerInterval = setInterval(() => { ++S.timerSeconds; }, 1000);
  }

  function stopTimer() {
    if (S.timerInterval) {
      clearInterval(S.timerInterval);
      S.timerInterval = null;
    }
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      stock: S.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      waste: S.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      foundations: S.foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      tableau: S.tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      moveCount: S.moveCount
    };
    S.undoHistory.push(JSON.stringify(state));
    if (S.undoHistory.length > MAX_UNDO)
      S.undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    S.stock = s.stock.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; });
    S.waste = s.waste.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; });
    S.foundations = s.foundations.map(f => f.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    S.tableau = s.tableau.map(t => t.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    S.moveCount = s.moveCount;
  }

  function doUndo() {
    if (S.undoHistory.length === 0)
      return;
    restoreState(S.undoHistory.pop());
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    V.stopWinAnimation();
    stopTimer();

    const deck = CE.shuffle(CE.createDeck());

    S.stock = [];
    S.waste = [];
    S.foundations = [[], [], [], []];
    S.tableau = [[], [], [], [], [], [], []];
    S.moveCount = 0;
    S.timerSeconds = 0;
    S.gameStarted = false;
    S.gameWon = false;
    S.undoHistory = [];
    S.dragging = null;
    S.statusMsg = 'Click stock pile to deal cards';

    for (let col = 0; col < TABLEAU_COUNT; ++col)
      for (let row = col; row < TABLEAU_COUNT; ++row) {
        const card = deck.pop();
        card.faceUp = (row === col);
        S.tableau[row].push(card);
      }

    while (deck.length > 0) {
      const card = deck.pop();
      card.faceUp = false;
      S.stock.push(card);
    }
  }

  /* ================================================================
   *  STOCK DEALING
   * ================================================================ */

  function dealFromStock() {
    if (!S.gameStarted)
      startTimer();

    if (S.stock.length === 0) {
      if (S.waste.length === 0)
        return;
      saveState();
      while (S.waste.length > 0) {
        const card = S.waste.pop();
        card.faceUp = false;
        S.stock.push(card);
      }
      ++S.moveCount;
      return;
    }

    saveState();
    const sp = stockPos();
    const count = Math.min(S.drawMode, S.stock.length);
    for (let i = 0; i < count; ++i) {
      const card = S.stock.pop();
      card.faceUp = true;
      S.waste.push(card);
      const wp = wasteCardPos(S.waste.length - 1);
      V.startDealFromStockAnim(card, sp.x, sp.y, wp.x, wp.y, i * 80);
    }
    ++S.moveCount;
  }

  /* ================================================================
   *  AUTO-MOVE TO FOUNDATION (double-click)
   * ================================================================ */

  function autoMoveToFoundation(card, sourceType, sourceCol, sourceIndex) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    if (!S.gameStarted)
      startTimer();
    saveState();

    let fromX, fromY;
    if (sourceType === 'waste') {
      const wp = wasteCardPos(sourceIndex);
      fromX = wp.x;
      fromY = wp.y;
      S.waste.splice(sourceIndex, 1);
    } else if (sourceType === 'tableau') {
      const tp = tableauCardPos(sourceCol, sourceIndex);
      fromX = tp.x;
      fromY = tp.y;
      S.tableau[sourceCol].splice(sourceIndex, 1);
      const pile = S.tableau[sourceCol];
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        const flippedCard = pile[pile.length - 1];
        flippedCard.faceUp = true;
        const fpos = tableauCardPos(sourceCol, pile.length - 1);
        V.startFlipAnim(flippedCard, fpos.x, fpos.y);
      }
    }

    card.faceUp = true;
    S.foundations[fi].push(card);
    ++S.moveCount;

    const fp = foundationPos(fi);
    V.startCardMoveAnim(card, fromX, fromY, fp.x, fp.y, () => {
      checkWin();
    });
    return true;
  }

  /* ================================================================
   *  WIN DETECTION + AUTO-COMPLETE
   * ================================================================ */

  function checkWin() {
    let total = 0;
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      total += S.foundations[i].length;
    if (total === 52) {
      doWin();
      return;
    }

    if (canAutoComplete()) {
      S.statusMsg = 'Auto-completing...';
      autoComplete();
    }
  }

  function canAutoComplete() {
    if (S.stock.length > 0)
      return false;
    if (S.waste.length > 0)
      return false;
    for (let col = 0; col < TABLEAU_COUNT; ++col)
      for (const card of S.tableau[col])
        if (!card.faceUp)
          return false;
    return true;
  }

  function autoComplete() {
    const step = () => {
      let moved = false;
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const pile = S.tableau[col];
        if (pile.length === 0)
          continue;
        const card = pile[pile.length - 1];
        const fi = findFoundationTarget(card);
        if (fi >= 0) {
          const fromPos = tableauCardPos(col, pile.length - 1);
          pile.pop();
          S.foundations[fi].push(card);
          ++S.moveCount;
          moved = true;

          const toPos = foundationPos(fi);
          V.startCardMoveAnim(card, fromPos.x, fromPos.y, toPos.x, toPos.y, () => {
            let total = 0;
            for (let i = 0; i < FOUNDATION_COUNT; ++i)
              total += S.foundations[i].length;
            if (total === 52)
              doWin();
            else
              setTimeout(step, 30);
          });
          break;
        }
      }
    };
    setTimeout(step, 200);
  }

  function doWin() {
    S.gameWon = true;
    stopTimer();
    S.statusMsg = 'Congratulations! You won in ' + S.moveCount + ' moves!';
    V.startWinAnimation();
  }

  Object.assign(V, {
    isDragSource, canPlaceOnFoundation, canPlaceOnTableau, hasAnyValidMove, startTimer, stopTimer,
    saveState, doUndo, newGame, dealFromStock, autoMoveToFoundation, checkWin
  });

})();
