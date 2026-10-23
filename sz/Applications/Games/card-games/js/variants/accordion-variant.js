;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};

  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const CARD_W = CE ? CE.CARD_W : 71;
  const CARD_H = CE ? CE.CARD_H : 96;
  const CARD_RADIUS = CE ? CE.CARD_RADIUS : 5;

  const RANKS = CE ? CE.RANKS : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = CE ? CE.SUITS : ['spades', 'hearts', 'diamonds', 'clubs'];

  /* ================================================================
   *  LAYOUT — wrapped grid, 13 cards per row
   * ================================================================ */

  const COLS = 13;
  const MAX_ROWS = 5;
  const H_GAP = 2;
  const V_GAP = 6;
  const TOTAL_ROW_W = COLS * CARD_W + (COLS - 1) * H_GAP;
  const GRID_LEFT = (CANVAS_W - TOTAL_ROW_W) / 2;
  const GRID_TOP = 50;

  function slotX(idx) {
    return GRID_LEFT + (idx % COLS) * (CARD_W + H_GAP);
  }

  function slotY(idx) {
    return GRID_TOP + Math.floor(idx / COLS) * (CARD_H + V_GAP);
  }

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let piles = [];       // array of arrays; each sub-array is a pile (top card = last element)
  let selected = -1;    // index into piles[] of the selected pile, or -1
  let score = 0;
  let moveCount = 0;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';
  let undoHistory = [];
  const MAX_UNDO = 200;

  let hoverIdx = -1;

  let animatingCards = [];
  let particles = [];

  let _ctx = null;
  let _host = null;
  let _canvas = null;

  /* ================================================================
   *  DECK + SHUFFLE
   * ================================================================ */

  function createDeck() {
    if (CE && CE.createDeck)
      return CE.createDeck();
    const deck = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        deck.push({ suit, rank, value: RANKS.indexOf(rank), faceUp: false, color: (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black' });
    return deck;
  }

  function shuffle(arr) {
    if (CE && CE.shuffle)
      return CE.shuffle(arr);
    for (let i = arr.length - 1; i > 0; --i) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ================================================================
   *  MATCHING LOGIC
   * ================================================================ */

  function topCard(pileIdx) {
    const p = piles[pileIdx];
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
    for (let i = 0; i < piles.length; ++i)
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
      piles: piles.map(serializePile),
      score,
      moveCount,
      selected
    };
    undoHistory.push(JSON.stringify(state));
    if (undoHistory.length > MAX_UNDO)
      undoHistory.shift();
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
    piles = s.piles.map(pile => pile.map(restoreCard));
    score = s.score;
    moveCount = s.moveCount;
    selected = -1;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
  }

  function doUndo() {
    if (undoHistory.length === 0 || roundOver || gameOver)
      return;
    restoreState(undoHistory.pop());
    if (_host && _host.onScoreChanged)
      _host.onScoreChanged(score);
  }

  /* ================================================================
   *  DRAWING HELPERS (fallback when CE unavailable)
   * ================================================================ */

  function drawRoundedRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.quadraticCurveTo(x + w, y, x + w, y + r);
    cx.lineTo(x + w, y + h - r);
    cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    cx.lineTo(x + r, y + h);
    cx.quadraticCurveTo(x, y + h, x, y + h - r);
    cx.lineTo(x, y + r);
    cx.quadraticCurveTo(x, y, x + r, y);
    cx.closePath();
  }

  function drawCardFace(cx, x, y, card) {
    if (CE && CE.drawCardFace)
      return CE.drawCardFace(cx, x, y, card);
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#aaa';
    cx.lineWidth = 1;
    cx.stroke();
    const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#c00' : '#222';
    cx.fillStyle = color;
    cx.font = 'bold 14px serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText(card.rank, x + 5, y + 4);
  }

  function drawEmptySlot(cx, x, y, label) {
    if (CE && CE.drawEmptySlot)
      return CE.drawEmptySlot(cx, x, y, label);
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();
    if (label) {
      cx.font = '24px serif';
      cx.fillStyle = 'rgba(255,255,255,0.3)';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(label, x + CARD_W / 2, y + CARD_H / 2);
    }
  }

  /* ================================================================
   *  HIGHLIGHTS
   * ================================================================ */

  function drawHighlight(cx, x, y, color, blur) {
    cx.save();
    cx.strokeStyle = color;
    cx.lineWidth = 2.5;
    cx.shadowColor = color;
    cx.shadowBlur = blur;
    if (CE && CE.drawRoundedRect)
      CE.drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    else
      drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    cx.stroke();
    cx.restore();
  }

  function drawSelectedHighlight(cx, x, y) {
    drawHighlight(cx, x, y, '#4cf', 10);
  }

  function drawTargetHighlight(cx, x, y) {
    drawHighlight(cx, x, y, '#4c4', 6);
  }

  function drawHoverHighlight(cx, x, y) {
    drawHighlight(cx, x, y, '#ff4', 8);
  }

  /* ================================================================
   *  PILE COUNT BADGE
   * ================================================================ */

  function drawPileBadge(cx, x, y, count) {
    if (count <= 1)
      return;
    const bx = x + CARD_W - 10;
    const by = y + 2;
    const text = '' + count;
    cx.font = 'bold 11px sans-serif';
    const tw = cx.measureText(text).width;
    const bw = Math.max(tw + 8, 18);
    const bh = 16;

    cx.fillStyle = 'rgba(0,0,0,0.7)';
    cx.beginPath();
    cx.arc(bx - bw / 2 + bw, by + bh / 2, bh / 2, -Math.PI / 2, Math.PI / 2);
    cx.arc(bx - bw / 2 + bh / 2, by + bh / 2, bh / 2, Math.PI / 2, -Math.PI / 2);
    cx.closePath();
    cx.fill();

    cx.fillStyle = '#fff';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(text, bx - bw / 2 + bw / 2 + 4, by + bh / 2);
  }

  /* ================================================================
   *  ANIMATIONS
   * ================================================================ */

  function startCardMoveAnim(card, fromX, fromY, toX, toY, onDone) {
    animatingCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now(),
      duration: 250,
      onDone
    });
  }

  function drawAnimations(cx) {
    const now = performance.now();
    for (let i = animatingCards.length - 1; i >= 0; --i) {
      const a = animatingCards[i];
      const elapsed = now - a.startTime;
      const t = Math.min(elapsed / a.duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const x = a.fromX + (a.toX - a.fromX) * ease;
      const y = a.fromY + (a.toY - a.fromY) * ease;
      drawCardFace(cx, x, y, a.card);
      if (t >= 1) {
        animatingCards.splice(i, 1);
        if (CE && CE.spawnSparkle)
          CE.spawnSparkle(particles, a.toX + CARD_W / 2, a.toY + CARD_H / 2);
        if (a.onDone)
          a.onDone();
      }
    }
  }

  /* ================================================================
   *  GAME LOGIC
   * ================================================================ */

  function updateScore() {
    score = 52 - piles.length;
    if (_host && _host.onScoreChanged)
      _host.onScoreChanged(score);
  }

  function checkGameEnd() {
    if (piles.length === 1) {
      roundOver = true;
      gameOver = false;
      resultMsg = 'You win! All cards compressed into one pile! Score: ' + score;
      if (_host && _host.floatingText)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 3, 'YOU WIN!', { color: '#4f4', size: 28 });
      if (_host && _host.particles)
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 3, 40);
      if (_host && _host.onRoundOver)
        _host.onRoundOver(false);
      return true;
    }

    if (!anyMoveAvailable()) {
      roundOver = true;
      gameOver = true;
      resultMsg = piles.length + ' pile' + (piles.length !== 1 ? 's' : '') + ' remaining. Score: ' + score;
      if (_host && _host.floatingText)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 3, 'No more moves!', { color: '#f88', size: 24 });
      if (_host && _host.onRoundOver)
        _host.onRoundOver(true);
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
    for (const c of piles[srcIdx])
      piles[dstIdx].push(c);
    piles.splice(srcIdx, 1);

    ++moveCount;
    selected = -1;
    updateScore();

    startCardMoveAnim(srcCard, fromX, fromY, toX, toY, () => {
      checkGameEnd();
    });

    if (_host && _host.floatingText) {
      const pts = 52 - piles.length;
      _host.floatingText.add(toX + CARD_W / 2, toY, '+' + (pts - (pts - 1)), { color: '#4f4', size: 18 });
    }

    return true;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    const deck = shuffle(createDeck());

    piles = [];
    for (let i = 0; i < 52; ++i) {
      const card = deck[i];
      card.faceUp = true;
      piles.push([card]);
    }

    selected = -1;
    moveCount = 0;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    undoHistory = [];
    animatingCards = [];
    particles = [];
    hoverIdx = -1;

    updateScore();

    if (_host && _host.dealCardAnim) {
      for (let i = 0; i < piles.length; ++i) {
        const tx = slotX(i);
        const ty = slotY(i);
        _host.dealCardAnim(piles[i][0], CANVAS_W / 2, -CARD_H, tx, ty, i * 0.03);
      }
    }
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(mx, my) {
    // Test in reverse so topmost (visually on top) is hit first
    for (let i = piles.length - 1; i >= 0; --i) {
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
    for (let i = 0; i < piles.length; ++i) {
      const targets = validTargets(i);
      if (targets.length > 0) {
        hints.add(i);
        for (const t of targets)
          hints.add(t);
      }
    }
    return hints;
  }

  /* ================================================================
   *  DRAWING
   * ================================================================ */

  function drawAccordion(cx, W, H) {
    const animSet = new Set();
    for (const a of animatingCards)
      animSet.add(a.card);

    const hintPiles = (_host && _host.hintsEnabled && !roundOver) ? getHintPiles() : new Set();
    const targetSet = new Set();
    if (selected >= 0)
      for (const t of validTargets(selected))
        targetSet.add(t);

    // Title
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText('Accordion Solitaire', 10, 8);

    // Score (top-right)
    cx.fillStyle = '#fff';
    cx.font = 'bold 16px sans-serif';
    cx.textAlign = 'right';
    cx.textBaseline = 'top';
    cx.fillText('Score: ' + score, W - 20, 8);

    // Moves + piles remaining
    cx.font = '12px sans-serif';
    cx.fillStyle = 'rgba(255,255,255,0.7)';
    cx.textAlign = 'right';
    cx.fillText('Moves: ' + moveCount + '  |  Piles: ' + piles.length, W - 20, 28);

    // Draw piles
    for (let i = 0; i < piles.length; ++i) {
      const x = slotX(i);
      const y = slotY(i);
      const card = topCard(i);

      if (animSet.has(card))
        continue;

      drawCardFace(cx, x, y, card);
      drawPileBadge(cx, x, y, piles[i].length);

      // Selected highlight
      if (i === selected)
        drawSelectedHighlight(cx, x, y);
      // Valid target for selected pile
      else if (targetSet.has(i))
        drawTargetHighlight(cx, x, y);
      // Hover
      else if (i === hoverIdx && !roundOver)
        drawHoverHighlight(cx, x, y);

      // Hint glow
      if (hintPiles.has(i) && selected < 0 && CE && CE.drawHintGlow)
        CE.drawHintGlow(cx, x, y, CARD_W, CARD_H, _host.hintTime);
    }

    // Animations
    drawAnimations(cx);

    // Particles
    if (CE && CE.updateAndDrawParticles)
      CE.updateAndDrawParticles(cx, particles);

    // Result message
    if (roundOver && resultMsg) {
      cx.save();

      cx.fillStyle = 'rgba(0,0,0,0.5)';
      const msgW = 460;
      const msgH = 80;
      const msgX = (W - msgW) / 2;
      const msgY = (H - msgH) / 2 + 40;
      drawRoundedRect(cx, msgX, msgY, msgW, msgH, 10);
      cx.fill();

      cx.fillStyle = '#fff';
      cx.font = 'bold 18px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(resultMsg, W / 2, msgY + 30);

      cx.font = '13px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.fillText('Click to continue', W / 2, msgY + 55);

      cx.restore();
    }

    // Instructions at bottom
    if (!roundOver) {
      cx.font = '11px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'right';
      cx.textBaseline = 'bottom';
      cx.fillText('Click to select, click target (1 or 3 left, same suit/rank) to move  |  Ctrl+Z to undo', W - 10, H - 8);
    }
  }

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _canvas = canvas;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      newGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAccordion(ctx, W, H);
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host)
          _host.onRoundOver(gameOver);
        return;
      }

      const hit = hitTest(mx, my);

      // Clicked empty space — deselect
      if (hit < 0) {
        selected = -1;
        return;
      }

      // Nothing selected yet — select this pile
      if (selected < 0) {
        // Only allow selecting piles that have valid moves
        if (validTargets(hit).length > 0)
          selected = hit;
        return;
      }

      // Clicked the already-selected pile — deselect
      if (hit === selected) {
        selected = -1;
        return;
      }

      // Check if clicked pile is a valid target for the selected pile
      const targets = validTargets(selected);
      if (targets.includes(hit)) {
        movePile(selected, hit);
        return;
      }

      // Clicked a different pile — re-select if it has moves, otherwise deselect
      if (validTargets(hit).length > 0)
        selected = hit;
      else
        selected = -1;
    },

    handlePointerMove(mx, my) {
      const hit = hitTest(mx, my);
      hoverIdx = hit;
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (roundOver || gameOver)
        return;
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.key === 'Escape') {
        selected = -1;
        return;
      }
    },

    tick(dt) {
      if (CE && CE.updateParticles)
        CE.updateParticles(particles);
    },

    cleanup() {
      piles = [];
      selected = -1;
      moveCount = 0;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      undoHistory = [];
      animatingCards = [];
      particles = [];
      hoverIdx = -1;
      _ctx = null;
      _canvas = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('accordion', module);

})();
