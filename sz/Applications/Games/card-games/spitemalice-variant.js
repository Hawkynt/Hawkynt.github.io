;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Rank helpers ── */
  const RANK_ORDER = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function rankIndex(card) {
    if (card.isJoker) return -1;
    return RANK_ORDER.indexOf(card.rank);
  }

  function neededRank(pile) {
    if (pile.length === 0) return 0; // need Ace (index 0)
    return pile.length; // pile has N cards, need index N
  }

  function canPlayOn(card, centerPile) {
    const needed = neededRank(centerPile);
    if (needed > 12) return false; // pile is full (shouldn't happen, cleared at 13)
    if (card.isJoker) return true;
    return rankIndex(card) === needed;
  }

  /* ── Deck creation (2 standard decks + 4 jokers = 108) ── */
  function createSpiteDeck() {
    const d = [];
    for (let i = 0; i < 2; ++i)
      for (const suit of CE.SUITS)
        for (const rank of CE.RANKS)
          d.push(CE.makeCard(suit, rank));
    for (let i = 0; i < 4; ++i)
      d.push({ suit: 'joker', rank: 'JOKER', value: -1, faceUp: false, color: 'purple', isJoker: true });
    return d;
  }

  /* ── Game state ── */
  let payoff = [[], []];        // [0]=player, [1]=AI -- goal piles (face-down, top face-up)
  let hands = [[], []];         // 5-card hands
  let centerPiles = [[], [], [], []]; // shared build piles A->K
  let sideStacks = [[[], [], [], []], [[], [], [], []]]; // each player has 4 discard piles
  let stock = [];               // draw pile
  let selectedSource = null;    // { type: 'hand'|'payoff'|'side', index }
  let playerTurn = true;
  let score = 0;
  let roundOver = false;
  let gameOver = false;

  /* ── AI ── */
  let aiTimer = 0;
  const AI_DELAY = 0.7;
  let aiDiscarded = false;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── Layout constants ── */
  const CW = CE.CARD_W;
  const CH = CE.CARD_H;
  const CW_S = Math.round(CW * 0.72); // small card
  const CH_S = Math.round(CH * 0.72);

  // Center piles (middle of canvas)
  const CENTER_Y = 240;
  const CENTER_X0 = 280;
  const CENTER_GAP = 85;

  // Stock pile
  const STOCK_X = 60;
  const STOCK_Y = CENTER_Y;

  // Player area (bottom)
  const P_PAYOFF_X = 60;
  const P_PAYOFF_Y = 420;
  const P_HAND_X = 180;
  const P_HAND_Y = 420;
  const P_SIDE_X = 180;
  const P_SIDE_Y = 510;

  // AI area (top)
  const AI_PAYOFF_X = 60;
  const AI_PAYOFF_Y = 50;
  const AI_HAND_X = 180;
  const AI_HAND_Y = 50;
  const AI_SIDE_X = 180;
  const AI_SIDE_Y = 140;

  /* ══════════════════════════════════════════════════════════════════
     DRAWING HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function drawJokerCard(x, y, w, h) {
    _ctx.save();
    _ctx.fillStyle = '#2a0040';
    _ctx.strokeStyle = '#a060d0';
    _ctx.lineWidth = 1;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.fill();
    _ctx.stroke();
    _ctx.fillStyle = '#c080ff';
    _ctx.font = 'bold ' + Math.round(12 * (w / CW)) + 'px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('JOKER', x + w / 2, y + h / 2);
    _ctx.restore();
  }

  function drawCard(x, y, card, w, h) {
    w = w || CW;
    h = h || CH;
    if (card.isJoker)
      drawJokerCard(x, y, w, h);
    else
      CE.drawCardFace(_ctx, x, y, card, w, h);
  }

  function drawSelection(x, y, w, h) {
    _ctx.save();
    _ctx.strokeStyle = '#ff0';
    _ctx.lineWidth = 3;
    _ctx.shadowColor = '#ff0';
    _ctx.shadowBlur = 8;
    CE.drawRoundedRect(_ctx, x - 2, y - 2, w + 4, h + 4, CE.CARD_RADIUS + 1);
    _ctx.stroke();
    _ctx.restore();
  }

  function topCard(pile) {
    return pile.length > 0 ? pile[pile.length - 1] : null;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function drawHand(playerIdx) {
    while (hands[playerIdx].length < 5 && stock.length > 0)
      hands[playerIdx].push(stock.pop());
  }

  function playToCenter(card, centerIdx) {
    centerPiles[centerIdx].push(card);
    if (centerPiles[centerIdx].length >= 13) {
      // Completed pile -- shuffle back into stock
      const cleared = centerPiles[centerIdx].splice(0);
      stock.push(...CE.shuffle(cleared));
      if (_host) _host.floatingText.add(CENTER_X0 + centerIdx * CENTER_GAP + CW / 2, CENTER_Y + CH / 2, 'Cleared!', { color: '#ff0', size: 14 });
    }
  }

  function checkWin(playerIdx) {
    if (payoff[playerIdx].length === 0) {
      roundOver = true;
      if (playerIdx === 0) {
        score += 100;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 28 });
          _host.onScoreChanged(score);
        }
      } else {
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI WINS!', { color: '#f44', size: 28 });
      }
      return true;
    }
    return false;
  }

  function getSelectedCard() {
    if (!selectedSource) return null;
    if (selectedSource.type === 'hand')
      return hands[0][selectedSource.index] || null;
    if (selectedSource.type === 'payoff')
      return topCard(payoff[0]);
    if (selectedSource.type === 'side')
      return topCard(sideStacks[0][selectedSource.index]);
    return null;
  }

  function removeSelectedCard() {
    if (!selectedSource) return;
    if (selectedSource.type === 'hand')
      hands[0].splice(selectedSource.index, 1);
    else if (selectedSource.type === 'payoff')
      payoff[0].pop();
    else if (selectedSource.type === 'side')
      sideStacks[0][selectedSource.index].pop();
    selectedSource = null;
  }

  /* ══════════════════════════════════════════════════════════════════
     AI LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function aiTurn() {
    if (roundOver || gameOver || playerTurn) return;

    // Priority 1: play from pay-off pile
    const payTop = topCard(payoff[1]);
    if (payTop) {
      for (let c = 0; c < 4; ++c) {
        if (canPlayOn(payTop, centerPiles[c])) {
          payoff[1].pop();
          playToCenter(payTop, c);
          if (checkWin(1)) return;
          aiDiscarded = false;
          return;
        }
      }
    }

    // Priority 2: play from hand
    for (let i = hands[1].length - 1; i >= 0; --i) {
      for (let c = 0; c < 4; ++c) {
        if (canPlayOn(hands[1][i], centerPiles[c])) {
          const card = hands[1].splice(i, 1)[0];
          playToCenter(card, c);
          if (hands[1].length === 0)
            drawHand(1);
          aiDiscarded = false;
          return;
        }
      }
    }

    // Priority 3: play from side stacks
    for (let s = 0; s < 4; ++s) {
      const st = topCard(sideStacks[1][s]);
      if (st) {
        for (let c = 0; c < 4; ++c) {
          if (canPlayOn(st, centerPiles[c])) {
            sideStacks[1][s].pop();
            playToCenter(st, c);
            aiDiscarded = false;
            return;
          }
        }
      }
    }

    // No plays available -- discard to a side stack to end turn
    if (hands[1].length > 0 && !aiDiscarded) {
      // Pick the side stack strategically: prefer empty or matching-value piles
      let bestStack = 0;
      let bestScore = -1;
      const cardToDiscard = hands[1][hands[1].length - 1];
      for (let s = 0; s < 4; ++s) {
        let sc = 0;
        if (sideStacks[1][s].length === 0)
          sc = 5; // prefer empty
        else {
          const st = topCard(sideStacks[1][s]);
          if (!cardToDiscard.isJoker && !st.isJoker && rankIndex(st) === rankIndex(cardToDiscard))
            sc = 3; // same value stacking
        }
        if (sc > bestScore) {
          bestScore = sc;
          bestStack = s;
        }
      }
      sideStacks[1][bestStack].push(hands[1].pop());
      aiDiscarded = true;
      return;
    }

    // End AI turn
    aiDiscarded = false;
    drawHand(1);
    drawHand(0);
    playerTurn = true;
    selectedSource = null;
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupSpiteMalice() {
    const d = CE.shuffle(createSpiteDeck());
    payoff = [[], []];
    hands = [[], []];
    centerPiles = [[], [], [], []];
    sideStacks = [[[], [], [], []], [[], [], [], []]];
    selectedSource = null;
    playerTurn = true;
    roundOver = false;
    gameOver = false;
    aiTimer = 0;
    aiDiscarded = false;

    // Deal 20 cards to each pay-off pile
    for (let i = 0; i < 20; ++i) {
      payoff[0].push(d.pop());
      payoff[1].push(d.pop());
    }
    // Top card of each payoff is face-up
    if (payoff[0].length > 0) topCard(payoff[0]).faceUp = true;
    if (payoff[1].length > 0) topCard(payoff[1]).faceUp = true;

    stock = d;

    // Deal 5-card hands
    drawHand(0);
    drawHand(1);

    // Animate player hand deal
    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CH, P_HAND_X + i * (CW + 6), P_HAND_Y, i * 0.1);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawSpiteMalice() {
    // Turn indicator
    _ctx.fillStyle = playerTurn ? '#8f8' : '#f88';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(playerTurn ? 'Your Turn' : 'AI Playing...', CANVAS_W / 2, 18);

    // ── AI area ──
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI Pay-off: ' + payoff[1].length, AI_PAYOFF_X, AI_PAYOFF_Y - 8);
    if (payoff[1].length > 0) {
      const pt = topCard(payoff[1]);
      if (pt.faceUp)
        drawCard(AI_PAYOFF_X, AI_PAYOFF_Y, pt, CW_S, CH_S);
      else
        CE.drawCardBack(_ctx, AI_PAYOFF_X, AI_PAYOFF_Y, CW_S, CH_S);
    } else
      CE.drawEmptySlot(_ctx, AI_PAYOFF_X, AI_PAYOFF_Y, null, CW_S, CH_S);

    // AI hand (face-down)
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI Hand', AI_HAND_X, AI_HAND_Y - 8);
    for (let i = 0; i < hands[1].length; ++i)
      CE.drawCardBack(_ctx, AI_HAND_X + i * (CW_S + 4), AI_HAND_Y, CW_S, CH_S);

    // AI side stacks
    _ctx.fillStyle = '#fff';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI Discard', AI_SIDE_X, AI_SIDE_Y - 8);
    for (let s = 0; s < 4; ++s) {
      const sx = AI_SIDE_X + s * (CW_S + 10);
      const st = topCard(sideStacks[1][s]);
      if (st)
        drawCard(sx, AI_SIDE_Y, st, CW_S, CH_S);
      else
        CE.drawEmptySlot(_ctx, sx, AI_SIDE_Y, 'D' + (s + 1), CW_S, CH_S);
    }

    // ── Center piles ──
    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Center Piles (A \u2192 K)', CENTER_X0 + CENTER_GAP * 1.5, CENTER_Y - 12);
    for (let c = 0; c < 4; ++c) {
      const cx = CENTER_X0 + c * CENTER_GAP;
      const ct = topCard(centerPiles[c]);
      if (ct)
        drawCard(cx, CENTER_Y, ct);
      else
        CE.drawEmptySlot(_ctx, cx, CENTER_Y, 'A', CW, CH);

      // Hint glow on center piles that can receive selected card
      if (_host && _host.hintsEnabled && playerTurn && !roundOver && !gameOver && selectedSource) {
        const sel = getSelectedCard();
        if (sel && canPlayOn(sel, centerPiles[c]))
          CE.drawHintGlow(_ctx, cx, CENTER_Y, CW, CH, _host.hintTime);
      }
    }

    // ── Stock pile ──
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Stock: ' + stock.length, STOCK_X, STOCK_Y - 8);
    if (stock.length > 0) {
      const layers = Math.min(stock.length, 3);
      for (let i = 0; i < layers - 1; ++i)
        CE.drawCardBack(_ctx, STOCK_X + i * 2, STOCK_Y + i * 2, CW_S, CH_S);
      CE.drawCardBack(_ctx, STOCK_X + (layers - 1) * 2, STOCK_Y + (layers - 1) * 2, CW_S, CH_S);
    } else
      CE.drawEmptySlot(_ctx, STOCK_X, STOCK_Y, null, CW_S, CH_S);

    // ── Player area ──
    // Pay-off pile
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Pay-off: ' + payoff[0].length, P_PAYOFF_X, P_PAYOFF_Y - 8);
    if (payoff[0].length > 0) {
      const pt = topCard(payoff[0]);
      if (pt.faceUp)
        drawCard(P_PAYOFF_X, P_PAYOFF_Y, pt);
      else
        CE.drawCardBack(_ctx, P_PAYOFF_X, P_PAYOFF_Y);
      if (selectedSource && selectedSource.type === 'payoff')
        drawSelection(P_PAYOFF_X, P_PAYOFF_Y, CW, CH);
      // Hint: if payoff top can play on any center
      if (_host && _host.hintsEnabled && playerTurn && !roundOver && !gameOver && !selectedSource && pt.faceUp) {
        for (let c = 0; c < 4; ++c) {
          if (canPlayOn(pt, centerPiles[c])) {
            CE.drawHintGlow(_ctx, P_PAYOFF_X, P_PAYOFF_Y, CW, CH, _host.hintTime);
            break;
          }
        }
      }
    } else
      CE.drawEmptySlot(_ctx, P_PAYOFF_X, P_PAYOFF_Y, null, CW, CH);

    // Player hand
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Your Hand', P_HAND_X, P_HAND_Y - 8);
    for (let i = 0; i < hands[0].length; ++i) {
      const hx = P_HAND_X + i * (CW + 6);
      const card = hands[0][i];
      if (card._dealing) continue;
      drawCard(hx, P_HAND_Y, card);
      if (selectedSource && selectedSource.type === 'hand' && selectedSource.index === i)
        drawSelection(hx, P_HAND_Y, CW, CH);
      // Hint: if this card can play on any center
      if (_host && _host.hintsEnabled && playerTurn && !roundOver && !gameOver && !selectedSource) {
        for (let c = 0; c < 4; ++c) {
          if (canPlayOn(card, centerPiles[c])) {
            CE.drawHintGlow(_ctx, hx, P_HAND_Y, CW, CH, _host.hintTime);
            break;
          }
        }
      }
    }

    // Player side stacks
    _ctx.fillStyle = '#fff';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Your Discard (play here to end turn)', P_SIDE_X, P_SIDE_Y - 8);
    for (let s = 0; s < 4; ++s) {
      const sx = P_SIDE_X + s * (CW + 10);
      const st = topCard(sideStacks[0][s]);
      if (st)
        drawCard(sx, P_SIDE_Y, st);
      else
        CE.drawEmptySlot(_ctx, sx, P_SIDE_Y, 'D' + (s + 1), CW, CH);
      if (selectedSource && selectedSource.type === 'side' && selectedSource.index === s)
        drawSelection(sx, P_SIDE_Y, CW, CH);
      // Hint: if side top can play on any center
      if (_host && _host.hintsEnabled && playerTurn && !roundOver && !gameOver && !selectedSource && st) {
        for (let c = 0; c < 4; ++c) {
          if (canPlayOn(st, centerPiles[c])) {
            CE.drawHintGlow(_ctx, sx, P_SIDE_Y, CW, CH, _host.hintTime);
            break;
          }
        }
      }
    }

    // Instructions
    if (!roundOver && !gameOver && playerTurn) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      if (selectedSource)
        _ctx.fillText('Click a center pile to play, or a discard pile to end turn', CANVAS_W / 2, CANVAS_H - 8);
      else
        _ctx.fillText('Select a card from hand, pay-off, or discard tops, then click destination', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  function handlePlayerClick(mx, my) {
    if (roundOver || gameOver) {
      if (_host) _host.onRoundOver(gameOver);
      return;
    }
    if (!playerTurn) return;

    // If no card selected, try to select one
    if (!selectedSource) {
      // Check hand cards (right to left for overlap)
      for (let i = hands[0].length - 1; i >= 0; --i) {
        const hx = P_HAND_X + i * (CW + 6);
        if (CE.isInRect(mx, my, hx, P_HAND_Y, CW, CH)) {
          selectedSource = { type: 'hand', index: i };
          return;
        }
      }
      // Check pay-off pile
      if (payoff[0].length > 0 && CE.isInRect(mx, my, P_PAYOFF_X, P_PAYOFF_Y, CW, CH)) {
        selectedSource = { type: 'payoff', index: 0 };
        return;
      }
      // Check side stack tops
      for (let s = 0; s < 4; ++s) {
        if (sideStacks[0][s].length > 0) {
          const sx = P_SIDE_X + s * (CW + 10);
          if (CE.isInRect(mx, my, sx, P_SIDE_Y, CW, CH)) {
            selectedSource = { type: 'side', index: s };
            return;
          }
        }
      }
      return;
    }

    // Card is selected -- try to play it
    const card = getSelectedCard();
    if (!card) {
      selectedSource = null;
      return;
    }

    // Try center piles
    for (let c = 0; c < 4; ++c) {
      const cx = CENTER_X0 + c * CENTER_GAP;
      if (CE.isInRect(mx, my, cx, CENTER_Y, CW, CH)) {
        if (canPlayOn(card, centerPiles[c])) {
          const src = selectedSource;
          removeSelectedCard();
          playToCenter(card, c);
          score += 5;
          if (_host) _host.onScoreChanged(score);
          if (src.type === 'payoff') {
            // Reveal next payoff card
            const next = topCard(payoff[0]);
            if (next) next.faceUp = true;
            checkWin(0);
          }
          // If hand empty, draw 5 more
          if (hands[0].length === 0 && !roundOver)
            drawHand(0);
        } else if (_host)
          _host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
        return;
      }
    }

    // Try player discard piles (ends turn) -- only from hand or payoff, not from side to side
    if (selectedSource.type === 'hand') {
      for (let s = 0; s < 4; ++s) {
        const sx = P_SIDE_X + s * (CW + 10);
        if (CE.isInRect(mx, my, sx, P_SIDE_Y, CW, CH)) {
          sideStacks[0][s].push(hands[0].splice(selectedSource.index, 1)[0]);
          selectedSource = null;
          // End player turn
          playerTurn = false;
          aiDiscarded = false;
          aiTimer = 0;
          return;
        }
      }
    }

    // Clicking on the same card deselects
    if (selectedSource.type === 'hand') {
      const hx = P_HAND_X + selectedSource.index * (CW + 6);
      if (CE.isInRect(mx, my, hx, P_HAND_Y, CW, CH)) {
        selectedSource = null;
        return;
      }
    }
    if (selectedSource.type === 'payoff' && CE.isInRect(mx, my, P_PAYOFF_X, P_PAYOFF_Y, CW, CH)) {
      selectedSource = null;
      return;
    }
    if (selectedSource.type === 'side') {
      const sx = P_SIDE_X + selectedSource.index * (CW + 10);
      if (CE.isInRect(mx, my, sx, P_SIDE_Y, CW, CH)) {
        selectedSource = null;
        return;
      }
    }

    // Try to reselect a different card
    for (let i = hands[0].length - 1; i >= 0; --i) {
      const hx = P_HAND_X + i * (CW + 6);
      if (CE.isInRect(mx, my, hx, P_HAND_Y, CW, CH)) {
        selectedSource = { type: 'hand', index: i };
        return;
      }
    }
    if (payoff[0].length > 0 && CE.isInRect(mx, my, P_PAYOFF_X, P_PAYOFF_Y, CW, CH)) {
      selectedSource = { type: 'payoff', index: 0 };
      return;
    }
    for (let s = 0; s < 4; ++s) {
      if (sideStacks[0][s].length > 0) {
        const sx = P_SIDE_X + s * (CW + 10);
        if (CE.isInRect(mx, my, sx, P_SIDE_Y, CW, CH)) {
          selectedSource = { type: 'side', index: s };
          return;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupSpiteMalice();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawSpiteMalice();
    },

    handleClick(mx, my) {
      handlePlayerClick(mx, my);
    },

    handleKey(e) {},

    tick(dt) {
      if (roundOver || gameOver) return;
      if (!playerTurn) {
        aiTimer += dt;
        if (aiTimer >= AI_DELAY) {
          aiTimer = 0;
          aiTurn();
        }
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      payoff = [[], []];
      hands = [[], []];
      centerPiles = [[], [], [], []];
      sideStacks = [[[], [], [], []], [[], [], [], []]];
      stock = [];
      selectedSource = null;
      playerTurn = true;
      roundOver = false;
      gameOver = false;
      aiTimer = 0;
      aiDiscarded = false;
      score = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('spitemalice', module);

})();
