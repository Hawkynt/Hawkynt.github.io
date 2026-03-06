;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Game state ── */
  let skipBoStockPiles = [[], []];
  let skipBoBuildPiles = [[], [], [], []];
  let skipBoDiscardPiles = [[], [], [], []];
  let skipBoSelectedCard = -1;
  let skipBoSelectedSource = null;
  let skipBoPlayerTurn = true;
  let playerHand = [];
  let aiHands = [[]];
  let deck = [];
  let score = 0;
  let roundOver = false;
  let gameOver = false;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── AI timer ── */
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  /* ── Layout constants ── */
  const SB_BUILD_Y = 130;
  const SB_BUILD_X = 310;
  const SB_HAND_Y = 340;
  const SB_HAND_X = 200;
  const SB_DISCARD_Y = 460;
  const SB_DISCARD_X = 200;
  const SB_STOCK_X = 60;
  const SB_STOCK_Y = 340;

  /* ══════════════════════════════════════════════════════════════════
     DECK
     ══════════════════════════════════════════════════════════════════ */

  function createSkipBoDeck() {
    const d = [];
    for (let n = 1; n <= 12; ++n)
      for (let i = 0; i < 12; ++i)
        d.push({ value: n, type: 'number' });
    for (let i = 0; i < 18; ++i)
      d.push({ value: 0, type: 'skipbo' });
    return d;
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function drawSkipBoCard(x, y, w, h, card) {
    _ctx.save();
    _ctx.fillStyle = card.type === 'skipbo' ? '#f84' : '#fff';
    _ctx.strokeStyle = '#666';
    _ctx.lineWidth = 1;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.fill();
    _ctx.stroke();
    _ctx.fillStyle = card.type === 'skipbo' ? '#fff' : '#333';
    _ctx.font = 'bold 24px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(card.type === 'skipbo' ? 'SB' : String(card.value), x + w / 2, y + h / 2);
    _ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     SKIPBO RULES
     ══════════════════════════════════════════════════════════════════ */

  function canPlaySkipBo(card, buildPile) {
    const topVal = buildPile.length === 0 ? 0 : buildPile[buildPile.length - 1].value;
    const needed = topVal + 1;
    if (needed > 12) return false;
    return card.type === 'skipbo' || card.value === needed;
  }

  function skipBoPlayToBuild(card, source, sourceIndex, buildIndex) {
    if (!canPlaySkipBo(card, skipBoBuildPiles[buildIndex])) return false;
    if (source === 'hand')
      playerHand.splice(sourceIndex, 1);
    else if (source === 'stock')
      skipBoStockPiles[0].pop();
    else if (source === 'discard')
      skipBoDiscardPiles[sourceIndex].pop();
    skipBoBuildPiles[buildIndex].push(card);
    if (skipBoBuildPiles[buildIndex].length >= 12) {
      if (_host) _host.floatingText.add(310 + buildIndex * 80 + 35, 180, 'Cleared!', { color: '#ff0', size: 14 });
      skipBoBuildPiles[buildIndex] = [];
    }
    if (source === 'stock' && skipBoStockPiles[0].length === 0) {
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
        _host.addGlow(180, 320, 400, CE.CARD_H, 2);
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
      score += 100;
      roundOver = true;
      if (_host) _host.onScoreChanged(score);
    }
    if (playerHand.length === 0 && !roundOver)
      while (playerHand.length < 5 && deck.length > 0)
        playerHand.push(deck.pop());
    skipBoSelectedCard = -1;
    skipBoSelectedSource = null;
    return true;
  }

  function skipBoDiscardTo(card, source, sourceIndex, discardIndex) {
    if (source === 'hand')
      playerHand.splice(sourceIndex, 1);
    else if (source === 'stock')
      skipBoStockPiles[0].pop();
    else
      return false;
    skipBoDiscardPiles[discardIndex].push(card);
    skipBoSelectedCard = -1;
    skipBoSelectedSource = null;
    skipBoPlayerTurn = false;
    return true;
  }

  function endSkipBoAiTurn() {
    while (aiHands[0].length < 5 && deck.length > 0)
      aiHands[0].push(deck.pop());
    while (playerHand.length < 5 && deck.length > 0)
      playerHand.push(deck.pop());
    skipBoPlayerTurn = true;
    skipBoSelectedCard = -1;
    skipBoSelectedSource = null;
  }

  function skipBoAiTurn() {
    if (roundOver || gameOver || skipBoPlayerTurn) return;
    const stock = skipBoStockPiles[1];
    if (stock.length > 0) {
      for (let b = 0; b < 4; ++b) {
        if (canPlaySkipBo(stock[stock.length - 1], skipBoBuildPiles[b])) {
          const card = stock.pop();
          skipBoBuildPiles[b].push(card);
          if (skipBoBuildPiles[b].length >= 12) skipBoBuildPiles[b] = [];
          if (stock.length === 0) {
            if (_host) _host.floatingText.add(CANVAS_W / 2, 300, 'AI WINS!', { color: '#f44', size: 28 });
            roundOver = true;
          }
          return;
        }
      }
    }
    for (let i = aiHands[0].length - 1; i >= 0; --i) {
      for (let b = 0; b < 4; ++b) {
        if (canPlaySkipBo(aiHands[0][i], skipBoBuildPiles[b])) {
          skipBoBuildPiles[b].push(aiHands[0].splice(i, 1)[0]);
          if (skipBoBuildPiles[b].length >= 12) skipBoBuildPiles[b] = [];
          if (aiHands[0].length === 0)
            while (aiHands[0].length < 5 && deck.length > 0)
              aiHands[0].push(deck.pop());
          return;
        }
      }
    }
    if (aiHands[0].length > 0) aiHands[0].pop();
    endSkipBoAiTurn();
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupSkipBo() {
    const d = CE.shuffle(createSkipBoDeck());
    skipBoStockPiles = [[], []];
    skipBoBuildPiles = [[], [], [], []];
    skipBoDiscardPiles = [[], [], [], []];
    skipBoSelectedCard = -1;
    skipBoSelectedSource = null;
    skipBoPlayerTurn = true;
    playerHand = [];
    aiHands = [[]];
    roundOver = false;
    gameOver = false;
    aiTurnTimer = 0;
    for (let i = 0; i < 20; ++i) {
      skipBoStockPiles[0].push(d.pop());
      skipBoStockPiles[1].push(d.pop());
    }
    deck = d;
    for (let i = 0; i < 5 && deck.length > 0; ++i) {
      playerHand.push(deck.pop());
      if (_host) _host.dealCardAnim(playerHand[i], CANVAS_W / 2, -CE.CARD_H, 200 + i * 60, 340, i * 0.1);
    }
    for (let i = 0; i < 5 && deck.length > 0; ++i)
      aiHands[0].push(deck.pop());
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawSkipBo() {
    _ctx.fillStyle = skipBoPlayerTurn ? '#8f8' : '#f88';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(skipBoPlayerTurn ? 'Your Turn' : 'AI Playing...', CANVAS_W / 2, 22);
    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI (Stock: ' + skipBoStockPiles[1].length + ')', 200, 55);
    for (let i = 0; i < Math.min(aiHands[0].length, 5); ++i)
      CE.drawCardBack(_ctx, 200 + i * 40, 68, CE.CARD_W * 0.7, CE.CARD_H * 0.7);
    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Build Piles', CANVAS_W / 2, SB_BUILD_Y - 10);
    for (let b = 0; b < 4; ++b) {
      const x = SB_BUILD_X + b * 80;
      if (skipBoBuildPiles[b].length > 0)
        drawSkipBoCard(x, SB_BUILD_Y, CE.CARD_W, CE.CARD_H, skipBoBuildPiles[b][skipBoBuildPiles[b].length - 1]);
      else {
        _ctx.strokeStyle = '#555';
        _ctx.lineWidth = 1;
        CE.drawRoundedRect(_ctx, x, SB_BUILD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        _ctx.stroke();
        _ctx.fillStyle = '#555';
        _ctx.font = '14px sans-serif';
        _ctx.fillText('1', x + CE.CARD_W / 2, SB_BUILD_Y + CE.CARD_H / 2);
      }
    }
    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Stock: ' + skipBoStockPiles[0].length, SB_STOCK_X, SB_STOCK_Y - 8);
    if (skipBoStockPiles[0].length > 0) {
      const topStock = skipBoStockPiles[0][skipBoStockPiles[0].length - 1];
      drawSkipBoCard(SB_STOCK_X, SB_STOCK_Y, CE.CARD_W, CE.CARD_H, topStock);
      if (skipBoSelectedSource === 'stock') {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 8;
        CE.drawRoundedRect(_ctx, SB_STOCK_X - 2, SB_STOCK_Y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }
    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Your Hand', SB_HAND_X, SB_HAND_Y - 8);
    for (let i = 0; i < playerHand.length; ++i) {
      if (playerHand[i]._dealing) continue;
      const x = SB_HAND_X + i * 60;
      drawSkipBoCard(x, SB_HAND_Y, CE.CARD_W, CE.CARD_H, playerHand[i]);
      if (_host && _host.hintsEnabled && skipBoPlayerTurn && !roundOver && !gameOver && (canPlaySkipBo(playerHand[i], skipBoBuildPiles[0]) || canPlaySkipBo(playerHand[i], skipBoBuildPiles[1]) || canPlaySkipBo(playerHand[i], skipBoBuildPiles[2]) || canPlaySkipBo(playerHand[i], skipBoBuildPiles[3])))
        CE.drawHintGlow(_ctx, x, SB_HAND_Y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      if (skipBoSelectedSource === 'hand' && skipBoSelectedCard === i) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 8;
        CE.drawRoundedRect(_ctx, x - 2, SB_HAND_Y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Discard (click to end turn)', CANVAS_W / 2 + 30, SB_DISCARD_Y - 8);
    for (let d = 0; d < 4; ++d) {
      const x = SB_DISCARD_X + d * 80;
      if (skipBoDiscardPiles[d].length > 0)
        drawSkipBoCard(x, SB_DISCARD_Y, CE.CARD_W, CE.CARD_H, skipBoDiscardPiles[d][skipBoDiscardPiles[d].length - 1]);
      else {
        _ctx.strokeStyle = '#444';
        _ctx.lineWidth = 1;
        CE.drawRoundedRect(_ctx, x, SB_DISCARD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        _ctx.stroke();
        _ctx.fillStyle = '#444';
        _ctx.font = '10px sans-serif';
        _ctx.fillText('D' + (d + 1), x + CE.CARD_W / 2, SB_DISCARD_Y + CE.CARD_H / 2);
      }
    }
    if (!roundOver && !gameOver && skipBoPlayerTurn) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      if (skipBoSelectedSource)
        _ctx.fillText('Click a build pile to play, or a discard pile to end turn', CANVAS_W / 2, CANVAS_H - 12);
      else
        _ctx.fillText('Click a hand card or stock pile to select, then click destination', CANVAS_W / 2, CANVAS_H - 12);
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
      setupSkipBo();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawSkipBo();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }
      if (!skipBoPlayerTurn) return;

      if (!skipBoSelectedSource) {
        for (let i = playerHand.length - 1; i >= 0; --i) {
          const cx = SB_HAND_X + i * 60;
          if (CE.isInRect(mx, my, cx, SB_HAND_Y, CE.CARD_W, CE.CARD_H)) {
            skipBoSelectedCard = i;
            skipBoSelectedSource = 'hand';
            return;
          }
        }
        if (skipBoStockPiles[0].length > 0 &&
            CE.isInRect(mx, my, SB_STOCK_X, SB_STOCK_Y, CE.CARD_W, CE.CARD_H)) {
          skipBoSelectedCard = skipBoStockPiles[0].length - 1;
          skipBoSelectedSource = 'stock';
          return;
        }
        for (let d = 0; d < 4; ++d) {
          if (skipBoDiscardPiles[d].length > 0) {
            const dx = SB_DISCARD_X + d * 80;
            if (CE.isInRect(mx, my, dx, SB_DISCARD_Y, CE.CARD_W, CE.CARD_H)) {
              skipBoSelectedCard = d;
              skipBoSelectedSource = 'discard';
              return;
            }
          }
        }
        return;
      }

      let selectedCard = null;
      if (skipBoSelectedSource === 'hand' && skipBoSelectedCard < playerHand.length)
        selectedCard = playerHand[skipBoSelectedCard];
      else if (skipBoSelectedSource === 'stock' && skipBoStockPiles[0].length > 0)
        selectedCard = skipBoStockPiles[0][skipBoStockPiles[0].length - 1];
      else if (skipBoSelectedSource === 'discard' && skipBoDiscardPiles[skipBoSelectedCard].length > 0)
        selectedCard = skipBoDiscardPiles[skipBoSelectedCard][skipBoDiscardPiles[skipBoSelectedCard].length - 1];

      if (!selectedCard) {
        skipBoSelectedCard = -1;
        skipBoSelectedSource = null;
        return;
      }

      for (let b = 0; b < 4; ++b) {
        const bx = SB_BUILD_X + b * 80;
        if (CE.isInRect(mx, my, bx, SB_BUILD_Y, CE.CARD_W, CE.CARD_H)) {
          if (!skipBoPlayToBuild(selectedCard, skipBoSelectedSource, skipBoSelectedCard, b)) {
            if (_host) _host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
          }
          return;
        }
      }

      if (skipBoSelectedSource !== 'discard') {
        for (let d = 0; d < 4; ++d) {
          const dx = SB_DISCARD_X + d * 80;
          if (CE.isInRect(mx, my, dx, SB_DISCARD_Y, CE.CARD_W, CE.CARD_H)) {
            skipBoDiscardTo(selectedCard, skipBoSelectedSource, skipBoSelectedCard, d);
            return;
          }
        }
      }

      if (skipBoSelectedSource === 'hand') {
        const cx = SB_HAND_X + skipBoSelectedCard * 60;
        if (CE.isInRect(mx, my, cx, SB_HAND_Y, CE.CARD_W, CE.CARD_H)) {
          skipBoSelectedCard = -1;
          skipBoSelectedSource = null;
          return;
        }
      }
      if (skipBoSelectedSource === 'stock' &&
          CE.isInRect(mx, my, SB_STOCK_X, SB_STOCK_Y, CE.CARD_W, CE.CARD_H)) {
        skipBoSelectedCard = -1;
        skipBoSelectedSource = null;
        return;
      }

      for (let i = playerHand.length - 1; i >= 0; --i) {
        const cx = SB_HAND_X + i * 60;
        if (CE.isInRect(mx, my, cx, SB_HAND_Y, CE.CARD_W, CE.CARD_H)) {
          skipBoSelectedCard = i;
          skipBoSelectedSource = 'hand';
          return;
        }
      }
      if (skipBoStockPiles[0].length > 0 &&
          CE.isInRect(mx, my, SB_STOCK_X, SB_STOCK_Y, CE.CARD_W, CE.CARD_H)) {
        skipBoSelectedCard = skipBoStockPiles[0].length - 1;
        skipBoSelectedSource = 'stock';
      }
    },

    handleKey(e) {},

    tick(dt) {
      if (roundOver || gameOver) return;
      if (!skipBoPlayerTurn) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          skipBoAiTurn();
        }
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      skipBoStockPiles = [[], []];
      skipBoBuildPiles = [[], [], [], []];
      skipBoDiscardPiles = [[], [], [], []];
      playerHand = [];
      aiHands = [[]];
      deck = [];
      roundOver = false;
      gameOver = false;
      aiTurnTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('skipbo', module);

})();
