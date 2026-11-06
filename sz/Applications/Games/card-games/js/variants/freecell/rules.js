;(function() {
  'use strict';

  /* FreeCell: game rules - dealing, legal moves, undo, timer, auto-moves and
     win detection. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.freecell;
  const S = V.S;
  const {
    CE, FREECELL_COUNT, FOUNDATION_COUNT, TABLEAU_COUNT, MAX_UNDO, freeCellPos, foundationPos,
    tableauCardPos
  } = V;

  /* ================================================================
   *  DECK + SEEDED RNG (Windows FreeCell style)
   * ================================================================ */

  function createDeck() {
    const deck = [];
    const winSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
    for (const suit of winSuits)
      for (const rank of CE.RANKS)
        deck.push(CE.makeCard(suit, rank));
    // FreeCell cards are always face-up
    for (const c of deck)
      c.faceUp = true;
    return deck;
  }

  function msRng(seed) {
    let state = seed;
    return function() {
      state = (state * 214013 + 2531011) & 0x7FFFFFFF;
      return (state >> 16) & 0x7FFF;
    };
  }

  function dealGame(num) {
    const deck = createDeck();
    const rng = msRng(num);

    for (let i = 51; i > 0; --i) {
      const j = rng() % (i + 1);
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }

    const cols = [[], [], [], [], [], [], [], []];
    for (let i = 0; i < 52; ++i)
      cols[i % 8].push(deck[i]);

    return cols;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame(num) {
    V.stopWinAnimation();
    stopTimer();
    S.dealAnimCards = [];
    S.dealAnimRunning = false;

    if (num === undefined)
      num = Math.floor(Math.random() * 1000000) + 1;

    S.gameNumber = num;

    S.freeCells = [null, null, null, null];
    S.foundations = [[], [], [], []];
    S.moveCount = 0;
    S.timerSeconds = 0;
    S.gameStarted = false;
    S.gameWon = false;
    S.undoHistory = [];
    S.dragging = null;
    S.selection = null;

    S.tableau = dealGame(S.gameNumber);
    V.startDealAnimation();
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      freeCells: S.freeCells.map(c => c ? { suit: c.suit, rank: c.rank } : null),
      foundations: S.foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank }))),
      tableau: S.tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank }))),
      moveCount: S.moveCount
    };
    S.undoHistory.push(JSON.stringify(state));
    if (S.undoHistory.length > MAX_UNDO)
      S.undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    S.freeCells = s.freeCells.map(c => c ? CE.makeCard(c.suit, c.rank) : null);
    // FreeCell cards are always face-up
    for (const c of S.freeCells)
      if (c) c.faceUp = true;
    S.foundations = s.foundations.map(f => f.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = true; return card; }));
    S.tableau = s.tableau.map(t => t.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = true; return card; }));
    S.moveCount = s.moveCount;
  }

  function doUndo() {
    if (S.undoHistory.length === 0)
      return;
    restoreState(S.undoHistory.pop());
    S.selection = null;
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
   *  SUPERMOVE CALCULATION
   * ================================================================ */

  function emptyFreeCellCount() {
    let count = 0;
    for (let i = 0; i < FREECELL_COUNT; ++i)
      if (!S.freeCells[i])
        ++count;
    return count;
  }

  function emptyTableauCount(excludeCol) {
    let count = 0;
    for (let i = 0; i < TABLEAU_COUNT; ++i)
      if (i !== excludeCol && S.tableau[i].length === 0)
        ++count;
    return count;
  }

  function maxMoveableCards(excludeCol) {
    const free = emptyFreeCellCount();
    const empty = emptyTableauCount(excludeCol);
    return (1 + free) * Math.pow(2, empty);
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
      return true;
    const top = pile[pile.length - 1];
    return card.color !== top.color && card.value === top.value - 1;
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
    for (let i = 0; i < FREECELL_COUNT; ++i)
      if (!S.freeCells[i])
        return true;
    return false;
  }

  function isValidRun(col, fromIndex) {
    const pile = S.tableau[col];
    for (let i = fromIndex; i < pile.length - 1; ++i) {
      const curr = pile[i];
      const next = pile[i + 1];
      if (curr.color === next.color || curr.value !== next.value + 1)
        return false;
    }
    return true;
  }

  /* ================================================================
   *  isDragSource helper
   * ================================================================ */

  function isDragSource(type, index) {
    if (!S.dragging)
      return false;
    if (type === 'freecell' && S.dragging.source === 'freecell' && S.dragging.sourceCol === index)
      return true;
    if (type === 'tableau' && S.dragging.source === 'tableau' && S.dragging.sourceCol === index)
      return true;
    return false;
  }

  /* ================================================================
   *  AUTO-MOVE TO FOUNDATION
   * ================================================================ */

  function autoMoveToFoundation(card, sourceType, sourceCol) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    if (!S.gameStarted)
      startTimer();
    saveState();

    let fromX, fromY;
    if (sourceType === 'freecell') {
      const pos = freeCellPos(sourceCol);
      fromX = pos.x;
      fromY = pos.y;
      S.freeCells[sourceCol] = null;
    } else if (sourceType === 'tableau') {
      const pos = tableauCardPos(sourceCol, S.tableau[sourceCol].length - 1);
      fromX = pos.x;
      fromY = pos.y;
      S.tableau[sourceCol].pop();
    }

    S.foundations[fi].push(card);
    ++S.moveCount;

    const fp = foundationPos(fi);
    V.startCardMoveAnim(card, fromX, fromY, fp.x, fp.y, () => {
      checkWin();
    });
    return true;
  }

  /* ================================================================
   *  AUTO-COMPLETE
   * ================================================================ */

  function tryAutoCompleteStep() {
    for (let i = 0; i < FREECELL_COUNT; ++i) {
      const card = S.freeCells[i];
      if (card && findFoundationTarget(card) >= 0)
        return true;
    }
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

  function doAutoComplete() {
    const step = () => {
      let moved = false;

      for (let i = 0; i < FREECELL_COUNT; ++i) {
        const card = S.freeCells[i];
        if (!card)
          continue;
        const fi = findFoundationTarget(card);
        if (fi >= 0) {
          saveState();
          const fromPos = freeCellPos(i);
          S.freeCells[i] = null;
          S.foundations[fi].push(card);
          ++S.moveCount;
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

      if (!moved) {
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
            S.foundations[fi].push(card);
            ++S.moveCount;
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

    if (tryAutoCompleteStep()) {
      if (isSafeAutoComplete())
        doAutoComplete();
    }
  }

  function isSafeAutoComplete() {
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = S.tableau[col];
      for (let i = 0; i < pile.length - 1; ++i) {
        const curr = pile[i];
        const next = pile[i + 1];
        if (curr.color === next.color || curr.value !== next.value + 1)
          return false;
      }
    }

    const minVals = [];
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      minVals.push(S.foundations[i].length > 0 ? S.foundations[i][S.foundations[i].length - 1].value : -1);
    const minVal = Math.min(...minVals);

    for (let i = 0; i < FREECELL_COUNT; ++i) {
      if (S.freeCells[i] && S.freeCells[i].value > minVal + 2)
        return false;
    }
    return true;
  }

  function doWin() {
    S.gameWon = true;
    stopTimer();
    V.startWinAnimation();
  }

  Object.assign(V, {
    newGame, saveState, doUndo, startTimer, stopTimer, maxMoveableCards, canPlaceOnFoundation,
    canPlaceOnTableau, hasAnyValidMove, isValidRun, isDragSource, autoMoveToFoundation,
    tryAutoCompleteStep, doAutoComplete, checkWin
  });

})();
