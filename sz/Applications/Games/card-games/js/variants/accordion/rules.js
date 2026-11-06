;(function() {
  'use strict';

  /* Accordion: grid layout, matching rules (1 or 3 left, same suit or rank), undo,
     pile moves, scoring, game end, hints and hit testing. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.accordion;
  const S = V.S;
  const {
    CE, CANVAS_W, CANVAS_H, CARD_W, CARD_H, RANKS, COLS, H_GAP, V_GAP, GRID_LEFT, GRID_TOP,
    MAX_UNDO
  } = V;
  const { createDeck, shuffle } = SZ.CardGames.shared.solitaireFallback;

  function slotX(idx) {
    return GRID_LEFT + (idx % COLS) * (CARD_W + H_GAP);
  }

  function slotY(idx) {
    return GRID_TOP + Math.floor(idx / COLS) * (CARD_H + V_GAP);
  }

  /* ================================================================
   *  MATCHING LOGIC
   * ================================================================ */

  function topCard(pileIdx) {
    const p = S.piles[pileIdx];
    return p[p.length - 1];
  }

  function canMatch(cardA, cardB) {
    return cardA.suit === cardB.suit || cardA.rank === cardB.rank;
  }

  // Returns target pile indices that pile at srcIdx can move onto
  function validTargets(srcIdx) {
    const targets = [];
    const card = topCard(srcIdx);
    // 1-left
    if (srcIdx - 1 >= 0 && canMatch(card, topCard(srcIdx - 1)))
      targets.push(srcIdx - 1);
    // 3-left
    if (srcIdx - 3 >= 0 && canMatch(card, topCard(srcIdx - 3)))
      targets.push(srcIdx - 3);
    return targets;
  }

  function anyMoveAvailable() {
    for (let i = 0; i < S.piles.length; ++i)
      if (validTargets(i).length > 0)
        return true;
    return false;
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function serializePile(pile) {
    return pile.map(c => ({ suit: c.suit, rank: c.rank }));
  }

  function saveState() {
    const state = {
      piles: S.piles.map(serializePile),
      score: S.score,
      moveCount: S.moveCount,
      selected: S.selected
    };
    S.undoHistory.push(JSON.stringify(state));
    if (S.undoHistory.length > MAX_UNDO)
      S.undoHistory.shift();
  }

  function restoreCard(c) {
    if (CE && CE.makeCard) {
      const card = CE.makeCard(c.suit, c.rank);
      card.faceUp = true;
      return card;
    }
    return { suit: c.suit, rank: c.rank, value: RANKS.indexOf(c.rank), faceUp: true, color: (c.suit === 'hearts' || c.suit === 'diamonds') ? 'red' : 'black' };
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    S.piles = s.piles.map(pile => pile.map(restoreCard));
    S.score = s.score;
    S.moveCount = s.moveCount;
    S.selected = -1;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
  }

  function doUndo() {
    if (S.undoHistory.length === 0 || S.roundOver || S.gameOver)
      return;
    restoreState(S.undoHistory.pop());
    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);
  }

  /* ================================================================
   *  ANIMATIONS
   * ================================================================ */

  function startCardMoveAnim(card, fromX, fromY, toX, toY, onDone) {
    S.animatingCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now(),
      duration: 250,
      onDone
    });
  }

  /* ================================================================
   *  GAME LOGIC
   * ================================================================ */

  function updateScore() {
    S.score = 52 - S.piles.length;
    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);
  }

  function checkGameEnd() {
    if (S.piles.length === 1) {
      S.roundOver = true;
      S.gameOver = false;
      S.resultMsg = 'You win! All cards compressed into one pile! Score: ' + S.score;
      if (S._host && S._host.floatingText)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 3, 'YOU WIN!', { color: '#4f4', size: 28 });
      if (S._host && S._host.particles)
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 3, 40);
      if (S._host && S._host.onRoundOver)
        S._host.onRoundOver(false);
      return true;
    }

    if (!anyMoveAvailable()) {
      S.roundOver = true;
      S.gameOver = true;
      S.resultMsg = S.piles.length + ' pile' + (S.piles.length !== 1 ? 's' : '') + ' remaining. Score: ' + S.score;
      if (S._host && S._host.floatingText)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 3, 'No more moves!', { color: '#f88', size: 24 });
      if (S._host && S._host.onRoundOver)
        S._host.onRoundOver(true);
      return true;
    }

    return false;
  }

  function movePile(srcIdx, dstIdx) {
    saveState();

    const srcCard = topCard(srcIdx);
    const fromX = slotX(srcIdx);
    const fromY = slotY(srcIdx);
    const toX = slotX(dstIdx);
    const toY = slotY(dstIdx);

    // Move all cards from src onto dst
    for (const c of S.piles[srcIdx])
      S.piles[dstIdx].push(c);
    S.piles.splice(srcIdx, 1);

    ++S.moveCount;
    S.selected = -1;
    updateScore();

    startCardMoveAnim(srcCard, fromX, fromY, toX, toY, () => {
      checkGameEnd();
    });

    if (S._host && S._host.floatingText) {
      const pts = 52 - S.piles.length;
      S._host.floatingText.add(toX + CARD_W / 2, toY, '+' + (pts - (pts - 1)), { color: '#4f4', size: 18 });
    }

    return true;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    const deck = shuffle(createDeck());

    S.piles = [];
    for (let i = 0; i < 52; ++i) {
      const card = deck[i];
      card.faceUp = true;
      S.piles.push([card]);
    }

    S.selected = -1;
    S.moveCount = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.undoHistory = [];
    S.animatingCards = [];
    S.particles = [];
    S.hoverIdx = -1;

    updateScore();

    if (S._host && S._host.dealCardAnim) {
      for (let i = 0; i < S.piles.length; ++i) {
        const tx = slotX(i);
        const ty = slotY(i);
        S._host.dealCardAnim(S.piles[i][0], CANVAS_W / 2, -CARD_H, tx, ty, i * 0.03);
      }
    }
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(mx, my) {
    // Test in reverse so topmost (visually on top) is hit first
    for (let i = S.piles.length - 1; i >= 0; --i) {
      const x = slotX(i);
      const y = slotY(i);
      if (mx >= x && mx < x + CARD_W && my >= y && my < y + CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
   *  HINTS — find all piles that have valid moves
   * ================================================================ */

  function getHintPiles() {
    const hints = new Set();
    for (let i = 0; i < S.piles.length; ++i) {
      const targets = validTargets(i);
      if (targets.length > 0) {
        hints.add(i);
        for (const t of targets)
          hints.add(t);
      }
    }
    return hints;
  }

  Object.assign(V, {
    slotX, slotY, topCard, validTargets, doUndo, movePile, newGame, hitTest, getHintPiles
  });

})();
