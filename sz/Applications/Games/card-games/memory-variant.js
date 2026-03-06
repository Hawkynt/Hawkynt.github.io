;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
   *  GRID LAYOUT
   * ================================================================ */

  const COLS = 6;
  const ROWS = 4;
  const TOTAL_PAIRS = (COLS * ROWS) / 2; // 12
  const GAP_X = 12;
  const GAP_Y = 12;
  const GRID_W = COLS * CE.CARD_W + (COLS - 1) * GAP_X;
  const GRID_H = ROWS * CE.CARD_H + (ROWS - 1) * GAP_Y;
  const GRID_X = (CANVAS_W - GRID_W) / 2;
  const GRID_Y = (CANVAS_H - GRID_H) / 2 + 20;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let cards = [];         // flat array of 24 card objects
  let firstPick = -1;     // index of first flipped card (-1 = none)
  let secondPick = -1;    // index of second flipped card (-1 = none)
  let flipLockTimer = 0;  // countdown (ms) before unmatched pair flips back
  let moves = 0;          // total attempts (each pair reveal = 1 move)
  let matchesFound = 0;
  let score = 200;
  let roundOver = false;
  let gameOver = false;
  let dealAnimActive = false;
  let dealAnimCards = [];

  /* ── Flip animation state per card ── */
  // Each card gets: flipProgress (0..1), flipDirection ('up'|'down'|null),
  // flipStart (timestamp)
  const FLIP_DURATION = 250; // ms

  /* ── Fade-out for matched pairs ── */
  const FADE_DURATION = 400; // ms

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── New Game button ── */
  const NEW_GAME_BTN = { x: CANVAS_W / 2 - 60, y: CANVAS_H / 2 + 60, w: 120, h: 40 };

  /* ================================================================
   *  CARD POSITION HELPERS
   * ================================================================ */

  function cardPos(index) {
    const col = index % COLS;
    const row = (index / COLS) | 0;
    return {
      x: GRID_X + col * (CE.CARD_W + GAP_X),
      y: GRID_Y + row * (CE.CARD_H + GAP_Y)
    };
  }

  function hitTestGrid(mx, my) {
    for (let i = 0; i < cards.length; ++i) {
      const pos = cardPos(i);
      if (mx >= pos.x && mx <= pos.x + CE.CARD_W && my >= pos.y && my <= pos.y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
   *  DECK CREATION
   * ================================================================ */

  function createMemoryDeck() {
    const pool = [];
    // Build 12 pairs: use 12 distinct ranks, 2 cards each (one from each of 2 suits)
    for (let r = 0; r < TOTAL_PAIRS; ++r) {
      const rank = CE.RANKS[r];
      const c1 = CE.makeCard('spades', rank);
      c1.matched = false;
      c1.fadeStart = 0;
      c1.flipProgress = 0;
      c1.flipDirection = null;
      c1.flipStart = 0;
      pool.push(c1);
      const c2 = CE.makeCard('hearts', rank);
      c2.matched = false;
      c2.fadeStart = 0;
      c2.flipProgress = 0;
      c2.flipDirection = null;
      c2.flipStart = 0;
      pool.push(c2);
    }
    CE.shuffle(pool);
    return pool;
  }

  /* ================================================================
   *  SETUP / NEW GAME
   * ================================================================ */

  function newGame() {
    cards = createMemoryDeck();
    firstPick = -1;
    secondPick = -1;
    flipLockTimer = 0;
    moves = 0;
    matchesFound = 0;
    score = 200;
    roundOver = false;
    gameOver = false;

    if (_host) {
      _host.onScoreChanged(score);
      startDealAnimation();
    }
  }

  function startDealAnimation() {
    dealAnimActive = true;
    dealAnimCards = [];
    const now = performance.now();
    for (let i = 0; i < cards.length; ++i) {
      const pos = cardPos(i);
      dealAnimCards.push({
        index: i,
        fromX: CANVAS_W / 2 - CE.CARD_W / 2,
        fromY: -CE.CARD_H,
        toX: pos.x,
        toY: pos.y,
        startTime: now + i * 40,
        duration: 300
      });
    }
    if (_host && _host.dealCardAnim) {
      for (let i = 0; i < cards.length; ++i) {
        const pos = cardPos(i);
        _host.dealCardAnim(cards[i], CANVAS_W / 2, -CE.CARD_H, pos.x, pos.y, i * 0.04);
      }
    }
  }

  /* ================================================================
   *  FLIP ANIMATION
   * ================================================================ */

  function startFlip(index, direction) {
    const card = cards[index];
    card.flipDirection = direction;
    card.flipStart = performance.now();
    card.flipProgress = 0;
  }

  function updateFlips(now) {
    for (let i = 0; i < cards.length; ++i) {
      const card = cards[i];
      if (!card.flipDirection)
        continue;
      const elapsed = now - card.flipStart;
      card.flipProgress = Math.min(elapsed / FLIP_DURATION, 1);
      if (card.flipProgress >= 1) {
        card.flipDirection = null;
        card.flipProgress = 0;
      }
    }
  }

  /* ================================================================
   *  MATCH / MISMATCH LOGIC
   * ================================================================ */

  function checkMatch() {
    if (firstPick < 0 || secondPick < 0)
      return;

    const a = cards[firstPick];
    const b = cards[secondPick];
    ++moves;

    if (a.rank === b.rank) {
      // Match found
      a.matched = true;
      b.matched = true;
      a.fadeStart = performance.now();
      b.fadeStart = performance.now();
      ++matchesFound;
      score += 10;

      if (_host) {
        const posA = cardPos(firstPick);
        const posB = cardPos(secondPick);
        _host.floatingText.add(
          (posA.x + posB.x + CE.CARD_W) / 2,
          Math.min(posA.y, posB.y) - 10,
          'Match! +10',
          { color: '#4f4', size: 20 }
        );
        _host.onScoreChanged(score);
      }

      firstPick = -1;
      secondPick = -1;

      // Check if all matched
      if (matchesFound >= TOTAL_PAIRS) {
        // Bonus for fewer moves: ideal = 12 moves, each extra move costs -2
        const extraMoves = Math.max(0, moves - TOTAL_PAIRS);
        const bonus = Math.max(0, 50 - extraMoves * 2);
        score += bonus;
        roundOver = true;
        gameOver = true;

        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'All Pairs Found!', { color: '#ff0', size: 28 });
          if (bonus > 0)
            _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Bonus: +' + bonus, { color: '#4ff', size: 22 });
          _host.onScoreChanged(score);
          _host.onRoundOver(true);
        }
      }
    } else {
      // No match -- penalize
      score = Math.max(0, score - 2);
      if (_host) {
        const posA = cardPos(firstPick);
        const posB = cardPos(secondPick);
        _host.floatingText.add(
          (posA.x + posB.x + CE.CARD_W) / 2,
          Math.min(posA.y, posB.y) - 10,
          'No match',
          { color: '#f88', size: 18 }
        );
        _host.onScoreChanged(score);
      }

      // Start timer to flip both back
      flipLockTimer = 1000;
    }
  }

  function flipBackUnmatched() {
    if (firstPick >= 0 && !cards[firstPick].matched) {
      cards[firstPick].faceUp = false;
      startFlip(firstPick, 'down');
    }
    if (secondPick >= 0 && !cards[secondPick].matched) {
      cards[secondPick].faceUp = false;
      startFlip(secondPick, 'down');
    }
    firstPick = -1;
    secondPick = -1;
  }

  /* ================================================================
   *  EASING
   * ================================================================ */

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /* ================================================================
   *  MAIN DRAW
   * ================================================================ */

  function drawScene(ctx, W, H) {
    _ctx = ctx;

    // Green felt background
    _ctx.fillStyle = '#1a6b2e';
    _ctx.fillRect(0, 0, W, H);
    // Subtle dark edges
    _ctx.fillStyle = '#126622';
    _ctx.fillRect(0, 0, W, 2);
    _ctx.fillRect(0, 0, 2, H);

    const now = performance.now();

    // Deal animation
    if (dealAnimActive && dealAnimCards.length > 0) {
      let allDone = true;
      for (const d of dealAnimCards) {
        if (now < d.startTime) {
          allDone = false;
          continue;
        }
        const elapsed = now - d.startTime;
        const t = Math.min(elapsed / d.duration, 1);
        const e = easeOutCubic(t);
        const x = d.fromX + (d.toX - d.fromX) * e;
        const y = d.fromY + (d.toY - d.fromY) * e;
        CE.drawCardBack(_ctx, x, y);
        if (t < 1)
          allDone = false;
      }
      if (allDone) {
        dealAnimActive = false;
        dealAnimCards = [];
      }
      drawHUD();
      return;
    }

    // Update flip animations
    updateFlips(now);

    // Draw cards
    for (let i = 0; i < cards.length; ++i) {
      const card = cards[i];
      const pos = cardPos(i);

      // Matched + faded out: skip
      if (card.matched && card.fadeStart > 0) {
        const fadeElapsed = now - card.fadeStart;
        const fadeT = Math.min(fadeElapsed / FADE_DURATION, 1);
        if (fadeT >= 1) {
          // Draw empty slot outline
          _ctx.save();
          _ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          _ctx.lineWidth = 1;
          _ctx.setLineDash([4, 4]);
          CE.drawRoundedRect(_ctx, pos.x, pos.y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
          _ctx.stroke();
          _ctx.setLineDash([]);
          _ctx.restore();
          continue;
        }
        // Fading out -- draw with decreasing alpha
        _ctx.save();
        _ctx.globalAlpha = 1 - fadeT;
        CE.drawCardFace(_ctx, pos.x, pos.y, card);
        // Green glow on matched card
        _ctx.strokeStyle = '#4f4';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#4f4';
        _ctx.shadowBlur = 10;
        CE.drawRoundedRect(_ctx, pos.x, pos.y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        _ctx.stroke();
        _ctx.restore();
        continue;
      }

      // Flip animation
      if (card.flipDirection) {
        const t = card.flipProgress;
        let scaleX;
        let showFace;
        if (card.flipDirection === 'up') {
          // Shrink showing back, then expand showing face
          if (t < 0.5) {
            scaleX = 1 - t * 2;
            showFace = false;
          } else {
            scaleX = (t - 0.5) * 2;
            showFace = true;
          }
        } else {
          // Shrink showing face, then expand showing back
          if (t < 0.5) {
            scaleX = 1 - t * 2;
            showFace = true;
          } else {
            scaleX = (t - 0.5) * 2;
            showFace = false;
          }
        }
        scaleX = Math.max(scaleX, 0.02);
        _ctx.save();
        _ctx.translate(pos.x + CE.CARD_W / 2, pos.y);
        _ctx.scale(scaleX, 1);
        if (showFace)
          CE.drawCardFace(_ctx, -CE.CARD_W / 2, 0, card);
        else
          CE.drawCardBack(_ctx, -CE.CARD_W / 2, 0);
        _ctx.restore();
        continue;
      }

      // Static card
      if (card.faceUp)
        CE.drawCardFace(_ctx, pos.x, pos.y, card);
      else
        CE.drawCardBack(_ctx, pos.x, pos.y);

      // Highlight selected first pick
      if (i === firstPick && secondPick < 0) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 2;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 6;
        CE.drawRoundedRect(_ctx, pos.x - 1, pos.y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }

    drawHUD();

    // Game over overlay
    if (roundOver) {
      _ctx.fillStyle = 'rgba(0,0,0,0.4)';
      _ctx.fillRect(0, 0, W, H);

      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 32px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Congratulations!', CANVAS_W / 2, CANVAS_H / 2 - 40);

      _ctx.fillStyle = '#fff';
      _ctx.font = '18px sans-serif';
      _ctx.fillText('Pairs found in ' + moves + ' moves  |  Score: ' + score, CANVAS_W / 2, CANVAS_H / 2 + 10);

      CE.drawButton(_ctx, NEW_GAME_BTN.x, NEW_GAME_BTN.y, NEW_GAME_BTN.w, NEW_GAME_BTN.h, 'New Game', { bg: '#2a5a2a', border: '#6c6', fontSize: 16 });
    }
  }

  /* ================================================================
   *  HUD (heads-up display)
   * ================================================================ */

  function drawHUD() {
    // Top bar
    _ctx.fillStyle = 'rgba(0,0,0,0.3)';
    _ctx.fillRect(0, 0, CANVAS_W, 32);

    _ctx.font = 'bold 14px sans-serif';
    _ctx.textBaseline = 'middle';

    // Moves
    _ctx.fillStyle = '#fff';
    _ctx.textAlign = 'left';
    _ctx.fillText('Moves: ' + moves, 16, 16);

    // Pairs found
    _ctx.textAlign = 'center';
    _ctx.fillText('Pairs: ' + matchesFound + ' / ' + TOTAL_PAIRS, CANVAS_W / 2, 16);

    // Score
    _ctx.fillStyle = '#fa0';
    _ctx.textAlign = 'right';
    _ctx.fillText('Score: ' + score, CANVAS_W - 16, 16);
  }

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 200;
      if (score <= 0)
        score = 200;
      newGame();
    },

    draw(ctx, W, H) {
      drawScene(ctx, W, H);
    },

    handleClick(mx, my) {
      // Game over: new game button
      if (roundOver) {
        if (CE.isInRect(mx, my, NEW_GAME_BTN.x, NEW_GAME_BTN.y, NEW_GAME_BTN.w, NEW_GAME_BTN.h)) {
          if (_host)
            _host.onRoundOver(true);
          else
            newGame();
        }
        return;
      }

      // Ignore clicks during deal animation
      if (dealAnimActive)
        return;

      // Ignore clicks during flip-back delay
      if (flipLockTimer > 0)
        return;

      // Ignore clicks during active flip animation
      for (const card of cards)
        if (card.flipDirection)
          return;

      const index = hitTestGrid(mx, my);
      if (index < 0)
        return;

      const card = cards[index];

      // Ignore matched or already face-up cards
      if (card.matched || card.faceUp)
        return;

      if (firstPick < 0) {
        // First card of the pair
        firstPick = index;
        card.faceUp = true;
        startFlip(index, 'up');
      } else if (secondPick < 0 && index !== firstPick) {
        // Second card of the pair
        secondPick = index;
        card.faceUp = true;
        startFlip(index, 'up');

        // Delay match check until flip animation completes
        setTimeout(() => {
          checkMatch();
        }, FLIP_DURATION + 50);
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        newGame();
      }
    },

    tick(dt) {
      // Handle flip-back timer for unmatched pairs
      if (flipLockTimer > 0) {
        flipLockTimer -= dt;
        if (flipLockTimer <= 0) {
          flipLockTimer = 0;
          flipBackUnmatched();
        }
      }
    },

    cleanup() {
      cards = [];
      firstPick = -1;
      secondPick = -1;
      flipLockTimer = 0;
      moves = 0;
      matchesFound = 0;
      score = 200;
      roundOver = false;
      gameOver = false;
      dealAnimActive = false;
      dealAnimCards = [];
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('memory', module);

})();
