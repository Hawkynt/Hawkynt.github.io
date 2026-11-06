;(function() {
  'use strict';

  /* Baker's Dozen: game rules - dealing, legal moves, undo, timer, auto-moves and
     win detection. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.bakersdozen;
  const S = V.S;
  const { CE, TABLEAU_COUNT, FOUNDATION_COUNT, MAX_UNDO, foundationPos, tableauCardPos } = V;

  /* ================================================================
   *  DECK + DEAL
   * ================================================================ */

  function createFaceUpDeck() {
    const deck = CE.shuffle(CE.createDeck());
    for (const c of deck)
      c.faceUp = true;
    return deck;
  }

  function dealGame() {
    const deck = createFaceUpDeck();

    const cols = [];
    for (let c = 0; c < TABLEAU_COUNT; ++c)
      cols.push([]);

    for (let i = 0; i < deck.length; ++i)
      cols[i % TABLEAU_COUNT].push(deck[i]);

    // Baker's Dozen rule: kings go to the bottom of their column, keeping order
    for (let c = 0; c < TABLEAU_COUNT; ++c) {
      const col = cols[c];
      cols[c] = col.filter(card => card.value === 12).concat(col.filter(card => card.value !== 12));
    }

    return cols;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    V.stopWinAnimation();
    stopTimer();
    S.dealAnimCards = [];
    S.dealAnimRunning = false;

    S.foundations = [[], [], [], []];
    S.moveCount = 0;
    S.score = 0;
    S.timerSeconds = 0;
    S.gameStarted = false;
    S.gameWon = false;
    S.undoHistory = [];
    S.dragging = null;
    S.selection = null;
    S.animatingCards = [];
    S.particles = [];

    S.tableau = dealGame();
    V.startDealAnimation();
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      foundations: S.foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank }))),
      tableau: S.tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank }))),
      moveCount: S.moveCount,
      score: S.score
    };
    S.undoHistory.push(JSON.stringify(state));
    if (S.undoHistory.length > MAX_UNDO)
      S.undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    S.foundations = s.foundations.map(f => f.map(c => {
      const card = CE.makeCard(c.suit, c.rank);
      card.faceUp = true;
      return card;
    }));
    S.tableau = s.tableau.map(t => t.map(c => {
      const card = CE.makeCard(c.suit, c.rank);
      card.faceUp = true;
      return card;
    }));
    S.moveCount = s.moveCount;
    S.score = s.score;
  }

  function doUndo() {
    if (S.undoHistory.length === 0)
      return;
    restoreState(S.undoHistory.pop());
    S.selection = null;
    S.dragging = null;
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
   *  GAME RULES
   * ================================================================ */

  function canPlaceOnFoundation(card, foundationIndex) {
    const pile = S.foundations[foundationIndex];
    if (pile.length === 0)
      return card.value === 0; // Ace
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.value === top.value + 1;
  }

  function canPlaceOnTableau(card, col) {
    const pile = S.tableau[col];
    // Empty columns cannot be filled in Baker's Dozen
    if (pile.length === 0)
      return false;
    const top = pile[pile.length - 1];
    // Cannot place on a King
    if (top.value === 12)
      return false;
    // Build down regardless of suit
    return card.value === top.value - 1;
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
   *  isDragSource HELPER
   * ================================================================ */

  function isDragSource(type, col) {
    if (!S.dragging)
      return false;
    if (type === 'tableau' && S.dragging.source === 'tableau' && S.dragging.sourceCol === col)
      return true;
    return false;
  }

  /* ================================================================
   *  AUTO-MOVE TO FOUNDATION (double-click)
   * ================================================================ */

  function autoMoveToFoundation(card, sourceCol) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    if (!S.gameStarted)
      startTimer();
    saveState();

    const pos = tableauCardPos(sourceCol, S.tableau[sourceCol].length - 1);
    S.tableau[sourceCol].pop();
    card.faceUp = true;
    S.foundations[fi].push(card);
    ++S.moveCount;
    S.score += 10;

    const fp = foundationPos(fi);
    V.startCardMoveAnim(card, pos.x, pos.y, fp.x, fp.y, () => {
      checkWin();
    });
    return true;
  }

  /* ================================================================
   *  AUTO-COMPLETE
   * ================================================================ */

  function tryAutoCompleteStep() {
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = S.tableau[col];
      if (pile.length > 0) {
        const card = pile[pile.length - 1];
        if (findFoundationTarget(card) >= 0)
          return true;
      }
    }
    return false;
  }

  function isSafeAutoComplete() {
    // Safe to auto-complete when all remaining cards are in descending order
    // within each column (which they always are in Baker's Dozen since only
    // top cards move) and all foundation minimums are close enough
    const minVals = [];
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      minVals.push(S.foundations[i].length > 0 ? S.foundations[i][S.foundations[i].length - 1].value : -1);
    const minVal = Math.min(...minVals);

    // Only auto-complete if all top cards are within 2 ranks of the min foundation
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = S.tableau[col];
      if (pile.length > 0 && pile[pile.length - 1].value > minVal + 2)
        return false;
    }
    return true;
  }

  function doAutoComplete() {
    const step = () => {
      let moved = false;

      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const pile = S.tableau[col];
        if (pile.length === 0)
          continue;
        const card = pile[pile.length - 1];
        const fi = findFoundationTarget(card);
        if (fi >= 0) {
          saveState();
          const fromPos = tableauCardPos(col, pile.length - 1);
          pile.pop();
          card.faceUp = true;
          S.foundations[fi].push(card);
          ++S.moveCount;
          S.score += 10;
          moved = true;

          const toPos = foundationPos(fi);
          V.startCardMoveAnim(card, fromPos.x, fromPos.y, toPos.x, toPos.y, () => {
            let total = 0;
            for (let j = 0; j < FOUNDATION_COUNT; ++j)
              total += S.foundations[j].length;
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

  /* ================================================================
   *  WIN DETECTION + ANIMATION
   * ================================================================ */

  function checkWin() {
    let total = 0;
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      total += S.foundations[i].length;
    if (total === 52) {
      doWin();
      return;
    }

    if (tryAutoCompleteStep() && isSafeAutoComplete())
      doAutoComplete();
  }

  function doWin() {
    S.gameWon = true;
    stopTimer();
    V.startWinAnimation();
  }

  /* ================================================================
   *  STALEMATE DETECTION
   * ================================================================ */

  function isStalemate() {
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = S.tableau[col];
      if (pile.length === 0)
        continue;
      const card = pile[pile.length - 1];
      if (hasAnyValidMove(card, col))
        return false;
    }
    return true;
  }

  Object.assign(V, {
    newGame, saveState, doUndo, startTimer, stopTimer, canPlaceOnFoundation, canPlaceOnTableau,
    hasAnyValidMove, isDragSource, autoMoveToFoundation, tryAutoCompleteStep, isSafeAutoComplete,
    doAutoComplete, checkWin, isStalemate
  });

})();
