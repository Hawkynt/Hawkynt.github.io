;(function() {
  'use strict';

  /* Spider: game rules - dealing, legal moves, undo, timer, auto-moves and
     win detection. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spider;
  const S = V.S;
  const { CE, TABLEAU_COUNT, FOUNDATION_TOTAL, tableauCardPos, stockPos, foundationPos } = V;

  /* ================================================================
   *  DECK + SHUFFLE
   * ================================================================ */

  function createSpiderDeck(numSuits) {
    const deck = [];
    const suitsUsed = CE.SUITS.slice(0, numSuits);
    const decksPerSuit = Math.floor(8 / numSuits);
    for (let d = 0; d < decksPerSuit; ++d)
      for (const suit of suitsUsed)
        for (const rank of CE.RANKS)
          deck.push(CE.makeCard(suit, rank));
    return deck;
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      stock: S.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      tableau: S.tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      completedSuits: S.completedSuits,
      moveCount: S.moveCount,
      score: S.score
    };
    S.undoHistory.push(JSON.stringify(state));
  }

  function restoreState(json) {
    const state = JSON.parse(json);
    S.stock = state.stock.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; });
    S.tableau = state.tableau.map(t => t.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    S.completedSuits = state.completedSuits;
    S.moveCount = state.moveCount;
    S.score = state.score;
  }

  function doUndo() {
    if (S.undoHistory.length === 0)
      return;
    restoreState(S.undoHistory.pop());
  }

  /* ================================================================
   *  TIMER
   * ================================================================ */

  function startTimer() {
    if (S.timerInterval)
      return;
    S.gameStarted = true;
    S.timerInterval = setInterval(() => {
      ++S.timerSeconds;
    }, 1000);
  }

  function stopTimer() {
    if (S.timerInterval) {
      clearInterval(S.timerInterval);
      S.timerInterval = null;
    }
  }

  /* ================================================================
   *  GAME RULES
   * ================================================================ */

  function isValidRun(col, startIndex) {
    const pile = S.tableau[col];
    if (startIndex >= pile.length)
      return false;
    if (!pile[startIndex].faceUp)
      return false;
    for (let i = startIndex; i < pile.length - 1; ++i) {
      if (!pile[i + 1].faceUp)
        return false;
      if (pile[i].suit !== pile[i + 1].suit)
        return false;
      if (pile[i].value !== pile[i + 1].value + 1)
        return false;
    }
    return true;
  }

  function findMoveableRunStart(col) {
    const pile = S.tableau[col];
    if (pile.length === 0)
      return -1;
    let start = pile.length - 1;
    while (start > 0 && pile[start - 1].faceUp && pile[start - 1].suit === pile[start].suit && pile[start - 1].value === pile[start].value + 1)
      --start;
    return start;
  }

  function spiderHasValidMove(col) {
    const start = findMoveableRunStart(col);
    if (start < 0)
      return false;
    const card = S.tableau[col][start];
    for (let c = 0; c < TABLEAU_COUNT; ++c) {
      if (c === col)
        continue;
      if (canPlaceOnTableau(card, c))
        return true;
    }
    return false;
  }

  function canPlaceOnTableau(card, col) {
    const pile = S.tableau[col];
    if (pile.length === 0)
      return true;
    const top = pile[pile.length - 1];
    return top.faceUp && card.value === top.value - 1;
  }

  function checkForCompletedSequence(col) {
    const pile = S.tableau[col];
    if (pile.length < 13)
      return false;

    const start = pile.length - 13;
    const topCard = pile[start];
    if (topCard.value !== 12)
      return false;

    for (let i = start; i < pile.length; ++i) {
      if (!pile[i].faceUp)
        return false;
      if (pile[i].suit !== topCard.suit)
        return false;
      if (pile[i].value !== 12 - (i - start))
        return false;
    }

    return true;
  }

  function removeCompletedSequence(col) {
    const pile = S.tableau[col];
    const start = pile.length - 13;

    const positions = [];
    for (let i = start; i < pile.length; ++i) {
      const pos = tableauCardPos(col, i);
      positions.push({ x: pos.x, y: pos.y });
    }

    const removedCards = pile.splice(start, 13);
    ++S.completedSuits;

    if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
      const flippedCard = pile[pile.length - 1];
      flippedCard.faceUp = true;
      const fpos = tableauCardPos(col, pile.length - 1);
      V.startFlipAnim(flippedCard, fpos.x, fpos.y);
    }

    const target = foundationPos(S.completedSuits - 1);
    V.startCompletionAnim(removedCards, positions, target.x, target.y, () => {
      if (S.completedSuits >= FOUNDATION_TOTAL)
        doWin();
    });
  }

  /* ================================================================
   *  STOCK DEALING
   * ================================================================ */

  function dealFromStock() {
    if (S.stock.length === 0)
      return;

    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      if (S.tableau[col].length === 0) {
        S.statusMsg = 'Cannot deal: fill all empty columns first!';
        return;
      }
    }

    if (!S.gameStarted)
      startTimer();

    saveState();

    const count = Math.min(TABLEAU_COUNT, S.stock.length);
    const sp = stockPos();
    for (let i = 0; i < count; ++i) {
      const card = S.stock.pop();
      card.faceUp = true;
      S.tableau[i].push(card);
      const destPos = tableauCardPos(i, S.tableau[i].length - 1);
      V.startDealCardAnim(card, sp.x, sp.y, destPos.x, destPos.y, i * 60);
    }

    ++S.moveCount;
    ++S.score;

    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      if (checkForCompletedSequence(col)) {
        removeCompletedSequence(col);
        break;
      }
    }
  }

  function isDragSource(col) {
    return S.dragging && S.dragging.source === 'tableau' && S.dragging.sourceCol === col;
  }

  /* ================================================================
   *  WIN DETECTION + ANIMATION
   * ================================================================ */

  function doWin() {
    S.gameWon = true;
    stopTimer();
    S.statusMsg = 'You won! Score: ' + S.score + ' in ' + S.moveCount + ' moves!';
    V.startWinAnimation();
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    V.stopWinAnimation();
    stopTimer();
    V.stopCompletionAnim();

    const deck = CE.shuffle(createSpiderDeck(S.suitCount));

    S.stock = [];
    S.tableau = [];
    for (let i = 0; i < TABLEAU_COUNT; ++i)
      S.tableau.push([]);
    S.completedSuits = 0;
    S.moveCount = 0;
    S.score = 500;
    S.timerSeconds = 0;
    S.gameStarted = false;
    S.gameWon = false;
    S.undoHistory = [];
    S.dragging = null;

    let cardIndex = 0;
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const total = col < 4 ? 6 : 5;
      for (let row = 0; row < total; ++row) {
        const card = deck[cardIndex++];
        card.faceUp = (row === total - 1);
        S.tableau[col].push(card);
      }
    }

    for (let i = cardIndex; i < deck.length; ++i) {
      deck[i].faceUp = false;
      S.stock.push(deck[i]);
    }

    S.statusMsg = 'Spider - ' + S.suitCount + ' Suit' + (S.suitCount > 1 ? 's' : '') + " | Press 'd' to change difficulty";
  }

  Object.assign(V, {
    saveState, doUndo, startTimer, stopTimer, isValidRun, findMoveableRunStart,
    spiderHasValidMove, canPlaceOnTableau, checkForCompletedSequence, removeCompletedSequence,
    dealFromStock, isDragSource, newGame
  });

})();
