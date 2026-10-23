;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const RANK_NAMES = {
    'A': 'Aces', '2': '2s', '3': '3s', '4': '4s', '5': '5s', '6': '6s',
    '7': '7s', '8': '8s', '9': '9s', '10': '10s', 'J': 'Jacks', 'Q': 'Queens', 'K': 'Kings'
  };

  const DEAL_COUNT = 7;
  const BOOKS_TO_WIN = 13;
  const POINTS_PER_BOOK = 20;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let stock = [];
  let playerBooks = [];
  let aiBooks = [];
  let score = 0;
  let roundOver = false;
  let gameOver = false;

  let isPlayerTurn = true;
  let message = '';
  let messageColor = '#fff';
  let messageTimer = 0;
  const MESSAGE_FADE = 3.0;

  let hoverCardIdx = -1;
  let selectedCardIdx = -1;

  /* -- AI state -- */
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 1.2;
  let aiThinking = false;
  let aiMemory = {};       // rank -> true; tracks ranks the player has asked for
  let aiLastAsked = '';
  let aiDrawnMatchedAsk = false;

  /* -- Host -- */
  let _ctx = null;
  let _host = null;

  /* ================================================================
     HAND / BOOK HELPERS
     ================================================================ */

  function countRank(hand, rank) {
    let n = 0;
    for (const c of hand)
      if (c.rank === rank) ++n;
    return n;
  }

  function removeCardsOfRank(hand, rank) {
    const removed = [];
    for (let i = hand.length - 1; i >= 0; --i) {
      if (hand[i].rank === rank) {
        removed.push(hand[i]);
        hand.splice(i, 1);
      }
    }
    return removed;
  }

  function getRanksInHand(hand) {
    const seen = {};
    const ranks = [];
    for (const c of hand) {
      if (!seen[c.rank]) {
        seen[c.rank] = true;
        ranks.push(c.rank);
      }
    }
    return ranks;
  }

  function checkForBooks(hand, books, ownerLabel) {
    const found = [];
    const rankCounts = {};
    for (const c of hand) {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    }
    for (const rank in rankCounts) {
      if (rankCounts[rank] === 4) {
        const bookCards = removeCardsOfRank(hand, rank);
        books.push({ rank, cards: bookCards });
        found.push(rank);
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, ownerLabel + ' books ' + RANK_NAMES[rank] + '!', { color: '#ff0', size: 18 });
      }
    }
    return found;
  }

  function drawFromStock(hand) {
    if (stock.length === 0) return null;
    const card = stock.pop();
    card.faceUp = true;
    hand.push(card);
    if (_host) _host.dealCardAnim(card, CANVAS_W / 2, CANVAS_H / 2 - 40, CANVAS_W / 2, CANVAS_H - CE.CARD_H - 20, 0);
    return card;
  }

  function totalBooks() {
    return playerBooks.length + aiBooks.length;
  }

  function handsEmpty() {
    return playerHand.length === 0 && aiHand.length === 0;
  }

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function setMessage(msg, color) {
    message = msg;
    messageColor = color || '#fff';
    messageTimer = MESSAGE_FADE;
  }

  function refillHandIfEmpty(hand) {
    if (hand.length === 0 && stock.length > 0) {
      const card = stock.pop();
      card.faceUp = true;
      hand.push(card);
    }
  }

  function checkGameEnd() {
    if (totalBooks() >= BOOKS_TO_WIN || (stock.length === 0 && handsEmpty())) {
      roundOver = true;
      const playerWins = playerBooks.length > aiBooks.length;
      const tie = playerBooks.length === aiBooks.length;
      score = playerBooks.length * POINTS_PER_BOOK;
      if (_host) _host.onScoreChanged(score);

      if (tie)
        setMessage('It\'s a tie! ' + playerBooks.length + '-' + aiBooks.length, '#ff0');
      else if (playerWins) {
        setMessage('You win! ' + playerBooks.length + '-' + aiBooks.length, '#4f4');
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 28 });
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
          _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 30);
        }
      } else {
        setMessage('AI wins! ' + aiBooks.length + '-' + playerBooks.length, '#f44');
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI WINS', { color: '#f44', size: 28 });
      }

      if (_host) _host.onRoundOver(true);
      return true;
    }
    return false;
  }

  /* -- Player asks AI for a rank -- */
  function playerAsksFor(rank) {
    if (!isPlayerTurn || roundOver || gameOver) return;
    if (countRank(playerHand, rank) === 0) return;

    const aiCount = countRank(aiHand, rank);
    if (aiCount > 0) {
      const taken = removeCardsOfRank(aiHand, rank);
      for (const c of taken) {
        c.faceUp = true;
        playerHand.push(c);
      }
      setMessage('AI gives you ' + aiCount + ' ' + RANK_NAMES[rank] + '!', '#8f8');
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, '+' + aiCount + ' ' + RANK_NAMES[rank], { color: '#8f8', size: 18 });

      checkForBooks(playerHand, playerBooks, 'You');
      refillHandIfEmpty(playerHand);
      if (checkGameEnd()) return;

      selectedCardIdx = -1;
      // Player's turn continues
    } else {
      setMessage('Go Fish!', '#f88');
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Go Fish!', { color: '#f88', size: 22 });

      const drawn = drawFromStock(playerHand);
      if (drawn) {
        checkForBooks(playerHand, playerBooks, 'You');
        refillHandIfEmpty(playerHand);
        if (checkGameEnd()) return;

        if (drawn.rank === rank) {
          setMessage('You drew a ' + rank + '! Your turn continues.', '#8f8');
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 30, 'Lucky draw!', { color: '#ff0', size: 16 });
          selectedCardIdx = -1;
          // Player's turn continues
          return;
        }
      }

      // End player turn, start AI turn
      selectedCardIdx = -1;
      isPlayerTurn = false;
      aiTurnTimer = 0;
      aiThinking = true;
      aiDrawnMatchedAsk = false;
    }
  }

  /* -- AI turn logic -- */
  function aiTakeTurn() {
    if (aiHand.length === 0) {
      refillHandIfEmpty(aiHand);
      if (aiHand.length === 0) {
        isPlayerTurn = true;
        aiThinking = false;
        return;
      }
    }

    // Pick a rank to ask for: prefer ranks with most cards, then ranks remembered from player asks
    const rankCounts = {};
    for (const c of aiHand)
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;

    let bestRank = null;
    let bestScore = -1;

    for (const rank in rankCounts) {
      let s = rankCounts[rank] * 10;
      // Bonus for ranks the player previously asked about (they might still have some)
      if (aiMemory[rank]) s += 5;
      if (s > bestScore) {
        bestScore = s;
        bestRank = rank;
      }
    }

    if (!bestRank) {
      isPlayerTurn = true;
      aiThinking = false;
      return;
    }

    aiLastAsked = bestRank;

    const playerCount = countRank(playerHand, bestRank);
    if (playerCount > 0) {
      const taken = removeCardsOfRank(playerHand, bestRank);
      for (const c of taken)
        aiHand.push(c);

      setMessage('AI asks for ' + RANK_NAMES[bestRank] + ' \u2014 gets ' + playerCount + '!', '#fa0');
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI takes ' + playerCount + ' ' + RANK_NAMES[bestRank], { color: '#fa0', size: 16 });

      checkForBooks(aiHand, aiBooks, 'AI');
      refillHandIfEmpty(aiHand);
      if (checkGameEnd()) return;

      // AI turn continues -- schedule another action
      aiTurnTimer = 0;
      aiThinking = true;
      aiDrawnMatchedAsk = false;
    } else {
      setMessage('AI asks for ' + RANK_NAMES[bestRank] + ' \u2014 Go Fish!', '#8cf');
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Go Fish!', { color: '#8cf', size: 20 });

      const drawn = drawFromStock(aiHand);
      if (drawn) {
        checkForBooks(aiHand, aiBooks, 'AI');
        refillHandIfEmpty(aiHand);
        if (checkGameEnd()) return;

        if (drawn.rank === bestRank) {
          setMessage('AI drew a match! AI\'s turn continues.', '#fa0');
          aiTurnTimer = 0;
          aiThinking = true;
          aiDrawnMatchedAsk = false;
          return;
        }
      }

      // End AI turn
      isPlayerTurn = true;
      aiThinking = false;
      refillHandIfEmpty(playerHand);
      if (checkGameEnd()) return;
    }
  }

  /* ================================================================
     LAYOUT CONSTANTS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 30;
  const AI_HAND_Y = 20;
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const STOCK_Y = CANVAS_H / 2 - CE.CARD_H / 2 - 10;

  const PLAYER_BOOKS_X = 15;
  const PLAYER_BOOKS_Y = 280;
  const AI_BOOKS_X = CANVAS_W - 100;
  const AI_BOOKS_Y = 140;

  const MESSAGE_Y = CANVAS_H / 2 + 65;

  function playerCardX(idx, total) {
    const maxWidth = 700;
    const spacing = total > 1 ? Math.min(55, maxWidth / (total - 1)) : 0;
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return startX + idx * spacing;
  }

  function aiCardX(idx, total) {
    const spacing = Math.min(30, 400 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W * 0.5 / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawBooks(books, startX, startY, label) {
    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText(label + ' (' + books.length + ')', startX, startY - 14);

    for (let i = 0; i < books.length; ++i) {
      const col = i % 3;
      const row = (i / 3) | 0;
      const bx = startX + col * 28;
      const by = startY + row * 22;

      _ctx.save();
      _ctx.fillStyle = 'rgba(0,0,0,0.4)';
      CE.drawRoundedRect(_ctx, bx, by, 24, 18, 3);
      _ctx.fill();
      _ctx.strokeStyle = '#888';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, bx, by, 24, 18, 3);
      _ctx.stroke();
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(books[i].rank, bx + 12, by + 9);
      _ctx.restore();
    }
  }

  function drawStockPile() {
    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Stock (' + stock.length + ')', STOCK_X + CE.CARD_W / 2, STOCK_Y - 4);

    if (stock.length > 0) {
      // Draw a small stack effect
      if (stock.length > 2) CE.drawCardBack(_ctx, STOCK_X + 2, STOCK_Y + 2);
      if (stock.length > 1) CE.drawCardBack(_ctx, STOCK_X + 1, STOCK_Y + 1);
      CE.drawCardBack(_ctx, STOCK_X, STOCK_Y);
    } else {
      _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.fillStyle = 'rgba(255,255,255,0.2)';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }
  }

  function drawPlayerHandArea() {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) {
      _ctx.fillStyle = 'rgba(255,255,255,0.3)';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('(no cards)', CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H / 2);
      return;
    }

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (i === hoverCardIdx && isPlayerTurn && !roundOver)
        y -= 10;
      if (i === selectedCardIdx)
        y -= 16;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Hint glow: highlight cards with 2+ of the same rank
      if (_host && _host.hintsEnabled && isPlayerTurn && !roundOver) {
        if (countRank(hand, hand[i].rank) >= 2)
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }

      if (i === selectedCardIdx) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 6;
        CE.drawRoundedRect(_ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }
  }

  function drawAIHandArea() {
    const total = aiHand.length;
    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('AI (' + total + ' cards)', CANVAS_W / 2, AI_HAND_Y - 2);

    if (total === 0) return;

    const scaleW = CE.CARD_W * 0.5;
    const scaleH = CE.CARD_H * 0.5;
    for (let i = 0; i < total; ++i)
      CE.drawCardBack(_ctx, aiCardX(i, total), AI_HAND_Y, scaleW, scaleH);
  }

  function drawTurnIndicator() {
    const text = isPlayerTurn ? 'Your Turn' : 'AI\'s Turn';
    const color = isPlayerTurn ? '#8f8' : '#fa0';

    _ctx.fillStyle = color;
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText(text, 15, 10);
  }

  function drawMessageArea() {
    if (message.length === 0) return;

    const alpha = Math.min(1, messageTimer / 0.5);
    _ctx.save();
    _ctx.globalAlpha = alpha;

    _ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const textWidth = _ctx.measureText(message).width || 200;
    const pw = Math.max(textWidth + 40, 240);
    const px = CANVAS_W / 2 - pw / 2;
    CE.drawRoundedRect(_ctx, px, MESSAGE_Y - 16, pw, 32, 8);
    _ctx.fill();

    _ctx.fillStyle = messageColor;
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(message, CANVAS_W / 2, MESSAGE_Y);
    _ctx.restore();
  }

  function drawInstructions() {
    if (roundOver || gameOver) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 8);
      return;
    }

    if (!isPlayerTurn) return;

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';

    if (playerHand.length > 0)
      _ctx.fillText('Click a card in your hand to ask AI for that rank', CANVAS_W / 2, CANVAS_H - 8);
  }

  function drawScoreArea() {
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.textBaseline = 'top';
    _ctx.fillText('You: ' + playerBooks.length + '  AI: ' + aiBooks.length, CANVAS_W - 15, 10);
  }

  function drawGoFish() {
    drawTurnIndicator();
    drawScoreArea();
    drawAIHandArea();
    drawStockPile();
    drawBooks(playerBooks, PLAYER_BOOKS_X, PLAYER_BOOKS_Y, 'Your Books');
    drawBooks(aiBooks, AI_BOOKS_X, AI_BOOKS_Y, 'AI Books');
    drawPlayerHandArea();
    drawMessageArea();
    drawInstructions();
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
      if (i === selectedCardIdx) cy -= 16;

      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupGoFish() {
    const d = CE.shuffle(CE.createDeck());
    playerHand = [];
    aiHand = [];
    stock = d;
    playerBooks = [];
    aiBooks = [];
    roundOver = false;
    gameOver = false;
    isPlayerTurn = true;
    message = '';
    messageTimer = 0;
    hoverCardIdx = -1;
    selectedCardIdx = -1;
    aiTurnTimer = 0;
    aiThinking = false;
    aiMemory = {};
    aiLastAsked = '';
    aiDrawnMatchedAsk = false;

    // Deal 7 cards to each player
    for (let i = 0; i < DEAL_COUNT; ++i) {
      const pc = stock.pop();
      pc.faceUp = true;
      playerHand.push(pc);
      if (_host) _host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, playerCardX(i, DEAL_COUNT), PLAYER_HAND_Y, i * 0.08);

      const ac = stock.pop();
      ac.faceUp = false;
      aiHand.push(ac);
    }

    // Check for any immediate books after deal
    checkForBooks(playerHand, playerBooks, 'You');
    checkForBooks(aiHand, aiBooks, 'AI');

    setMessage('Click a card to ask for its rank!', '#8f8');
  }

  /* ================================================================
     HAND SORTING
     ================================================================ */

  function sortHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return a.value - b.value;
    });
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = 0;
      setupGoFish();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawGoFish();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      if (!isPlayerTurn) return;

      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const card = playerHand[idx];

      // If clicking the same card again, confirm the ask
      if (selectedCardIdx === idx) {
        // Record the rank in AI memory (player asked for it)
        aiMemory[card.rank] = true;
        playerAsksFor(card.rank);
        return;
      }

      // First click selects, second confirms
      selectedCardIdx = idx;
      setMessage('Ask for ' + RANK_NAMES[card.rank] + '? Click again to confirm.', '#ff0');
    },

    handlePointerMove(mx, my) {
      if (isPlayerTurn && !roundOver)
        hoverCardIdx = hitTestPlayerCard(mx, my);
      else
        hoverCardIdx = -1;
    },

    handlePointerUp() {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      // No keyboard shortcuts for Go Fish beyond what host provides
    },

    tick(dt) {
      // Fade message timer
      if (messageTimer > 0)
        messageTimer -= dt;

      if (roundOver || gameOver) return;

      // AI turn processing
      if (!isPlayerTurn && aiThinking) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          aiTakeTurn();
        }
      }
    },

    sortPlayerHand() { sortHand(playerHand); },

    cleanup() {
      playerHand = [];
      aiHand = [];
      stock = [];
      playerBooks = [];
      aiBooks = [];
      roundOver = false;
      gameOver = false;
      isPlayerTurn = true;
      message = '';
      messageTimer = 0;
      hoverCardIdx = -1;
      selectedCardIdx = -1;
      aiTurnTimer = 0;
      aiThinking = false;
      aiMemory = {};
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('gofish', module);

})();
