;(function() {
  'use strict';

  /* Yukon: game rules - dealing, legal moves, undo, timer, auto-moves and
     win detection. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.yukon;
  const S = V.S;
  const { CE, FOUNDATION_COUNT, TABLEAU_COUNT, MAX_UNDO, foundationPos, tableauCardPos } = V;

  /* ================================================================
   *  isDragSource helper
   * ================================================================ */

  function isDragSource(col) {
    return S.dragging && S.dragging.source === 'tableau' && S.dragging.sourceCol === col;
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
      return card.value === 12; // only Kings on empty columns
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
      foundations: S.foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      tableau: S.tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      moveCount: S.moveCount,
      score: S.score
    };
    S.undoHistory.push(JSON.stringify(state));
    if (S.undoHistory.length > MAX_UNDO)
      S.undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    S.foundations = s.foundations.map(f => f.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    S.tableau = s.tableau.map(t => t.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    S.moveCount = s.moveCount;
    S.score = s.score;
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

    S.foundations = [[], [], [], []];
    S.tableau = [[], [], [], [], [], [], []];
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
    S.particles = [];
    S.statusMsg = 'Yukon Solitaire';

    // Standard Yukon deal:
    // Column 1: 1 card (face-up)
    // Column 2: 2 cards (1 face-down, 1 face-up)
    // ...
    // Column 7: 7 cards (6 face-down, 1 face-up)
    let cardIndex = 0;
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      for (let row = 0; row <= col; ++row) {
        const card = deck[cardIndex++];
        card.faceUp = (row === col);
        S.tableau[col].push(card);
      }
    }

    // Deal 4 extra face-up cards to columns 2-7 (indices 1-6)
    for (let col = 1; col < TABLEAU_COUNT; ++col) {
      for (let i = 0; i < 4; ++i) {
        const card = deck[cardIndex++];
        card.faceUp = true;
        S.tableau[col].push(card);
      }
    }
    // Total: 1 + (2+4) + (3+4) + (4+4) + (5+4) + (6+4) + (7+4)
    //      = 1 + 6 + 7 + 8 + 9 + 10 + 11 = 52
  }

  /* ================================================================
   *  AUTO-MOVE TO FOUNDATION (double-click)
   * ================================================================ */

  function autoMoveToFoundation(card, sourceCol, sourceIndex) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    // Only the top card of a tableau column may go to foundation
    if (sourceIndex !== S.tableau[sourceCol].length - 1)
      return false;

    if (!S.gameStarted)
      startTimer();
    saveState();

    const fromPos = tableauCardPos(sourceCol, sourceIndex);
    S.tableau[sourceCol].splice(sourceIndex, 1);
    flipTopCard(sourceCol);

    card.faceUp = true;
    S.foundations[fi].push(card);
    ++S.moveCount;
    S.score += 10;

    const fp = foundationPos(fi);
    V.startCardMoveAnim(card, fromPos.x, fromPos.y, fp.x, fp.y, () => {
      checkWin();
    });
    return true;
  }

  /* ================================================================
   *  FLIP TOP CARD HELPER
   * ================================================================ */

  function flipTopCard(col) {
    const pile = S.tableau[col];
    if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
      const flippedCard = pile[pile.length - 1];
      flippedCard.faceUp = true;
      S.score += 5;
      const fpos = tableauCardPos(col, pile.length - 1);
      V.startFlipAnim(flippedCard, fpos.x, fpos.y);
    }
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
          S.score += 10;
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
    S.roundOver = true;
    S.gameOver = true;
    stopTimer();
    S.statusMsg = 'Congratulations! You won in ' + S.moveCount + ' moves! Score: ' + S.score;
    V.startWinAnimation();
  }

  Object.assign(V, {
    isDragSource, canPlaceOnFoundation, canPlaceOnTableau, hasAnyValidMove, startTimer, stopTimer,
    saveState, doUndo, newGame, autoMoveToFoundation, flipTopCard, checkWin
  });

})();
