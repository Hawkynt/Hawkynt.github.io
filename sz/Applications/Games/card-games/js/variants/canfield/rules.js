;(function() {
  'use strict';

  /* Canfield: game rules - dealing, legal moves, undo, timer, auto-moves and
     win detection. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.canfield;
  const S = V.S;
  const {
    CE, FOUNDATION_COUNT, TABLEAU_COUNT, RESERVE_SIZE, MAX_UNDO, reservePos, foundationPos,
    stockPos, tableauCardPos, wasteCardPos
  } = V;

  /* ================================================================
   *  WRAPPING RANK ARITHMETIC
   * ================================================================ */

  function nextRank(value) {
    return (value + 1) % 13;
  }

  function prevRank(value) {
    return (value + 12) % 13;
  }

  function rankLabel(value) {
    return CE.RANKS[value];
  }

  /* ================================================================
   *  GAME RULES
   * ================================================================ */

  function canPlaceOnFoundation(card, fi) {
    const pile = S.foundations[fi];
    if (pile.length === 0)
      return card.value === S.baseRank;
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.value === nextRank(top.value);
  }

  function canPlaceOnTableau(card, col) {
    const pile = S.tableau[col];
    if (pile.length === 0)
      return true;
    const top = pile[pile.length - 1];
    return top.faceUp && card.color !== top.color && card.value === prevRank(top.value);
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

  function serializeCard(c) {
    return { suit: c.suit, rank: c.rank, faceUp: c.faceUp };
  }

  function deserializeCard(c) {
    const card = CE.makeCard(c.suit, c.rank);
    card.faceUp = c.faceUp;
    return card;
  }

  function saveState() {
    const state = {
      stock: S.stock.map(serializeCard),
      waste: S.waste.map(serializeCard),
      reserve: S.reserve.map(serializeCard),
      foundations: S.foundations.map(f => f.map(serializeCard)),
      tableau: S.tableau.map(t => t.map(serializeCard)),
      baseRank: S.baseRank,
      moveCount: S.moveCount,
      score: S.score
    };
    S.undoHistory.push(JSON.stringify(state));
    if (S.undoHistory.length > MAX_UNDO)
      S.undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    S.stock = s.stock.map(deserializeCard);
    S.waste = s.waste.map(deserializeCard);
    S.reserve = s.reserve.map(deserializeCard);
    S.foundations = s.foundations.map(f => f.map(deserializeCard));
    S.tableau = s.tableau.map(t => t.map(deserializeCard));
    S.baseRank = s.baseRank;
    S.moveCount = s.moveCount;
    S.score = s.score;
  }

  function doUndo() {
    if (S.undoHistory.length === 0)
      return;
    restoreState(S.undoHistory.pop());
  }

  /* ================================================================
   *  RESERVE AUTO-FILL
   * ================================================================ */

  function autoFillFromReserve(col) {
    if (S.tableau[col].length > 0)
      return;
    if (S.reserve.length === 0)
      return;

    const card = S.reserve.pop();
    card.faceUp = true;
    S.tableau[col].push(card);

    if (S.reserve.length > 0 && !S.reserve[S.reserve.length - 1].faceUp)
      S.reserve[S.reserve.length - 1].faceUp = true;

    const rp = reservePos();
    const tp = tableauCardPos(col, 0);
    V.startCardMoveAnim(card, rp.x, rp.y, tp.x, tp.y, null);
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
    S.reserve = [];
    S.foundations = [[], [], [], []];
    S.tableau = [[], [], [], []];
    S.moveCount = 0;
    S.score = 0;
    S.timerSeconds = 0;
    S.gameStarted = false;
    S.gameWon = false;
    S.roundOver = false;
    S.gameOver = false;
    S.undoHistory = [];
    S.dragging = null;
    S.animatingCards = [];
    S.flippingCards = [];
    S.dealAnimCards = [];

    // Deal 13 cards to reserve (face-down, top face-up)
    for (let i = 0; i < RESERVE_SIZE; ++i) {
      const card = deck.pop();
      card.faceUp = (i === RESERVE_SIZE - 1);
      S.reserve.push(card);
    }

    // First card to foundation determines base rank
    const starter = deck.pop();
    starter.faceUp = true;
    S.baseRank = starter.value;
    S.foundations[0].push(starter);

    // Deal 1 face-up card to each tableau column
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const card = deck.pop();
      card.faceUp = true;
      S.tableau[col].push(card);
    }

    // Remaining cards go to stock
    while (deck.length > 0) {
      const card = deck.pop();
      card.faceUp = false;
      S.stock.push(card);
    }

    S.statusMsg = 'Canfield | Base: ' + rankLabel(S.baseRank) + ' | Click stock to deal';
  }

  /* ================================================================
   *  STOCK DEALING (draw 3)
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
    const count = Math.min(3, S.stock.length);
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
   *  isDragSource HELPER
   * ================================================================ */

  function isDragSource(type, index) {
    if (!S.dragging)
      return false;
    if (type === 'waste' && S.dragging.source === 'waste')
      return index === S.dragging.sourceIndex;
    if (type === 'tableau' && S.dragging.source === 'tableau' && S.dragging.sourceCol === index)
      return true;
    if (type === 'reserve' && S.dragging.source === 'reserve')
      return true;
    return false;
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
      autoFillFromReserve(sourceCol);
    } else if (sourceType === 'reserve') {
      const rp = reservePos();
      fromX = rp.x;
      fromY = rp.y;
      S.reserve.pop();
      if (S.reserve.length > 0 && !S.reserve[S.reserve.length - 1].faceUp)
        S.reserve[S.reserve.length - 1].faceUp = true;
    }

    card.faceUp = true;
    S.foundations[fi].push(card);
    ++S.moveCount;
    S.score += 5;

    const fp = foundationPos(fi);
    V.startCardMoveAnim(card, fromX, fromY, fp.x, fp.y, () => {
      checkWin();
    });
    return true;
  }

  /* ================================================================
   *  WIN DETECTION + AUTO-COMPLETE
   * ================================================================ */

  function foundationTotal() {
    let total = 0;
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      total += S.foundations[i].length;
    return total;
  }

  function checkWin() {
    if (foundationTotal() === 52) {
      doWin();
      return;
    }

    if (canAutoComplete())
      autoComplete();
  }

  function canAutoComplete() {
    if (S.stock.length > 0 || S.waste.length > 0 || S.reserve.length > 0)
      return false;
    for (let col = 0; col < TABLEAU_COUNT; ++col)
      for (const card of S.tableau[col])
        if (!card.faceUp)
          return false;
    return true;
  }

  function autoComplete() {
    S.statusMsg = 'Auto-completing...';
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
          S.score += 5;
          moved = true;

          const toPos = foundationPos(fi);
          V.startCardMoveAnim(card, fromPos.x, fromPos.y, toPos.x, toPos.y, () => {
            if (foundationTotal() === 52)
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
    S.roundOver = true;
    stopTimer();
    S.statusMsg = 'You won! Score: ' + S.score + ' in ' + S.moveCount + ' moves!';
    V.startWinAnimation();
  }

  Object.assign(V, {
    rankLabel, canPlaceOnFoundation, canPlaceOnTableau, hasAnyValidMove, startTimer, stopTimer,
    saveState, doUndo, autoFillFromReserve, newGame, dealFromStock, isDragSource,
    autoMoveToFoundation, checkWin
  });

})();
