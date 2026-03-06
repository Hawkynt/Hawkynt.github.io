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

  const SUIT_GLYPHS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };

  /* Game phases */
  const PHASE_DEALING = 0;
  const PHASE_REMOVING_PAIRS = 1;
  const PHASE_PLAYER_DRAW = 2;
  const PHASE_AI_DRAW = 3;
  const PHASE_DISCARD_ANIM = 4;
  const PHASE_GAME_OVER = 5;

  const AI_DRAW_DELAY = 1.0;
  const PAIR_REMOVE_DELAY = 0.4;
  const DISCARD_ANIM_DELAY = 0.6;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let playerPairs = [];
  let aiPairs = [];
  let aiDrawableOrder = [];

  let phase = PHASE_DEALING;
  let score = 100;
  let roundOver = false;
  let gameOver = false;

  let aiTimer = 0;
  let pairRemoveTimer = 0;
  let discardAnimTimer = 0;
  let pairRemoveQueue = [];

  let hoverCardIdx = -1;
  let lastDiscardedPair = null;
  let lastDiscardedBy = '';
  let queenGlowTimer = 0;

  let _ctx = null;
  let _host = null;

  /* ================================================================
     CARD UTILITIES
     ================================================================ */

  function cardKey(card) {
    return card.rank + card.suit;
  }

  function isTheOldMaid(card) {
    return card.rank === 'Q' && card.suit === 'spades';
  }

  function sortHand(hand) {
    const rankOrder = {};
    for (let i = 0; i < CE.RANKS.length; ++i)
      rankOrder[CE.RANKS[i]] = i;
    const suitOrder = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };
    hand.sort((a, b) => {
      const rd = rankOrder[a.rank] - rankOrder[b.rank];
      if (rd !== 0) return rd;
      return suitOrder[a.suit] - suitOrder[b.suit];
    });
  }

  function findPairInHand(hand) {
    for (let i = 0; i < hand.length; ++i)
      for (let j = i + 1; j < hand.length; ++j)
        if (hand[i].rank === hand[j].rank)
          return [i, j];
    return null;
  }

  function removePairFromHand(hand, i, j) {
    const hi = Math.max(i, j);
    const lo = Math.min(i, j);
    const cards = [hand[hi], hand[lo]];
    hand.splice(hi, 1);
    hand.splice(lo, 1);
    return cards;
  }

  /* ================================================================
     DECK & DEAL
     ================================================================ */

  function createOldMaidDeck() {
    const deck = [];
    for (const suit of CE.SUITS)
      for (const rank of CE.RANKS)
        deck.push({ suit, rank, faceUp: false });

    // Remove the Queen of Diamonds (leaving Q of Spades as the Old Maid)
    const qIdx = deck.findIndex(c => c.rank === 'Q' && c.suit === 'diamonds');
    if (qIdx >= 0) deck.splice(qIdx, 1);
    return deck;
  }

  function deal() {
    const deck = CE.shuffle(createOldMaidDeck());
    playerHand = [];
    aiHand = [];
    playerPairs = [];
    aiPairs = [];
    pairRemoveQueue = [];
    lastDiscardedPair = null;
    lastDiscardedBy = '';
    hoverCardIdx = -1;
    aiTimer = 0;
    pairRemoveTimer = 0;
    discardAnimTimer = 0;
    queenGlowTimer = 0;
    roundOver = false;
    gameOver = false;

    for (let i = 0; i < deck.length; ++i) {
      if (i % 2 === 0)
        playerHand.push(deck[i]);
      else
        aiHand.push(deck[i]);
    }

    for (const c of playerHand) c.faceUp = true;
    sortHand(playerHand);
    sortHand(aiHand);

    // Shuffle AI drawable order
    refreshAiDrawableOrder();

    // Animate dealing
    if (_host) {
      for (let i = 0; i < playerHand.length; ++i) {
        const x = playerCardX(i, playerHand.length);
        const y = CANVAS_H - CE.CARD_H - 20;
        _host.dealCardAnim(playerHand[i], CANVAS_W / 2, -CE.CARD_H, x, y, i * 0.04);
      }
    }

    // Start pair removal phase
    phase = PHASE_REMOVING_PAIRS;
    pairRemoveTimer = 0.8; // initial delay before starting pair removal
    buildPairRemoveQueue();
  }

  function refreshAiDrawableOrder() {
    aiDrawableOrder = [];
    for (let i = 0; i < aiHand.length; ++i)
      aiDrawableOrder.push(i);
    CE.shuffle(aiDrawableOrder);
  }

  /* ================================================================
     PAIR REMOVAL PHASE
     ================================================================ */

  function buildPairRemoveQueue() {
    pairRemoveQueue = [];

    // Find all pairs in player hand
    const playerUsed = new Set();
    for (let i = 0; i < playerHand.length; ++i) {
      if (playerUsed.has(i)) continue;
      for (let j = i + 1; j < playerHand.length; ++j) {
        if (playerUsed.has(j)) continue;
        if (playerHand[i].rank === playerHand[j].rank) {
          pairRemoveQueue.push({ who: 'player', i, j });
          playerUsed.add(i);
          playerUsed.add(j);
          break;
        }
      }
    }

    // Find all pairs in AI hand
    const aiUsed = new Set();
    for (let i = 0; i < aiHand.length; ++i) {
      if (aiUsed.has(i)) continue;
      for (let j = i + 1; j < aiHand.length; ++j) {
        if (aiUsed.has(j)) continue;
        if (aiHand[i].rank === aiHand[j].rank) {
          pairRemoveQueue.push({ who: 'ai', i, j });
          aiUsed.add(i);
          aiUsed.add(j);
          break;
        }
      }
    }
  }

  function processNextPairRemoval() {
    if (pairRemoveQueue.length === 0) {
      // All initial pairs removed, start drawing phase
      sortHand(playerHand);
      sortHand(aiHand);
      refreshAiDrawableOrder();
      startDrawingPhase();
      return;
    }

    const item = pairRemoveQueue.shift();
    let pair;
    if (item.who === 'player') {
      // Re-find a pair in player hand (indices may have shifted)
      const pairIdx = findPairInHand(playerHand);
      if (!pairIdx) {
        processNextPairRemoval();
        return;
      }
      pair = removePairFromHand(playerHand, pairIdx[0], pairIdx[1]);
      playerPairs.push(pair);
      lastDiscardedPair = pair;
      lastDiscardedBy = 'You';
    } else {
      const pairIdx = findPairInHand(aiHand);
      if (!pairIdx) {
        processNextPairRemoval();
        return;
      }
      pair = removePairFromHand(aiHand, pairIdx[0], pairIdx[1]);
      aiPairs.push(pair);
      lastDiscardedPair = pair;
      lastDiscardedBy = 'AI';
    }

    if (_host) {
      const label = lastDiscardedBy + ': Pair of ' + pair[0].rank + 's!';
      _host.floatingText.add(CANVAS_W / 2, 280, label, { color: '#ff0', size: 16 });
    }

    pairRemoveTimer = PAIR_REMOVE_DELAY;
  }

  function startDrawingPhase() {
    if (checkGameEnd()) return;
    // Player draws first
    phase = PHASE_PLAYER_DRAW;
    refreshAiDrawableOrder();
  }

  /* ================================================================
     DRAWING FROM OPPONENT
     ================================================================ */

  function playerDrawCard(cardIdx) {
    if (phase !== PHASE_PLAYER_DRAW) return;
    if (cardIdx < 0 || cardIdx >= aiHand.length) return;

    const card = aiHand.splice(cardIdx, 1)[0];
    card.faceUp = true;
    playerHand.push(card);

    if (_host) {
      const fromX = aiDrawCardX(aiDrawableOrder.indexOf(cardIdx), aiDrawableOrder.length);
      _host.dealCardAnim(card, fromX, 80, playerCardX(playerHand.length - 1, playerHand.length), CANVAS_H - CE.CARD_H - 20, 0);
    }

    // Check for new pair
    const newPairIdx = findMatchInHand(playerHand, card);
    if (newPairIdx >= 0) {
      const pairCard = playerHand.splice(newPairIdx, 1)[0];
      const drawnCard = playerHand.splice(playerHand.indexOf(card), 1)[0];
      if (drawnCard)
        playerPairs.push([pairCard, drawnCard]);
      else
        playerPairs.push([pairCard, card]);

      lastDiscardedPair = playerPairs[playerPairs.length - 1];
      lastDiscardedBy = 'You';
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 380, 'Pair of ' + card.rank + 's!', { color: '#4f4', size: 18 });

      phase = PHASE_DISCARD_ANIM;
      discardAnimTimer = DISCARD_ANIM_DELAY;
    } else {
      sortHand(playerHand);
      finishPlayerTurn();
    }
  }

  function finishPlayerTurn() {
    sortHand(playerHand);
    refreshAiDrawableOrder();
    if (checkGameEnd()) return;
    phase = PHASE_AI_DRAW;
    aiTimer = AI_DRAW_DELAY;
  }

  function aiDrawCard() {
    if (playerHand.length === 0) {
      if (checkGameEnd()) return;
      // Skip AI turn if player has no cards
      phase = PHASE_PLAYER_DRAW;
      refreshAiDrawableOrder();
      return;
    }

    const idx = (Math.random() * playerHand.length) | 0;
    const card = playerHand.splice(idx, 1)[0];
    aiHand.push(card);

    const drawnRank = card.rank;

    if (_host) {
      const fromX = playerCardX(idx, playerHand.length + 1);
      _host.floatingText.add(CANVAS_W / 2, 200, 'AI draws a card...', { color: '#aaf', size: 14 });
    }

    // Check for new pair
    const newPairIdx = findMatchInHand(aiHand, card);
    if (newPairIdx >= 0) {
      const pairCard = aiHand.splice(newPairIdx, 1)[0];
      const drawnCard = aiHand.splice(aiHand.indexOf(card), 1)[0];
      if (drawnCard)
        aiPairs.push([pairCard, drawnCard]);
      else
        aiPairs.push([pairCard, card]);

      lastDiscardedPair = aiPairs[aiPairs.length - 1];
      lastDiscardedBy = 'AI';
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, 'AI: Pair of ' + drawnRank + 's!', { color: '#fa0', size: 16 });

      phase = PHASE_DISCARD_ANIM;
      discardAnimTimer = DISCARD_ANIM_DELAY;
    } else {
      sortHand(aiHand);
      finishAiTurn();
    }
  }

  function finishAiTurn() {
    sortHand(playerHand);
    sortHand(aiHand);
    refreshAiDrawableOrder();
    if (checkGameEnd()) return;

    if (aiHand.length === 0) {
      // AI has no cards, check if game is over
      if (checkGameEnd()) return;
    }

    phase = PHASE_PLAYER_DRAW;
    refreshAiDrawableOrder();
  }

  function findMatchInHand(hand, card) {
    for (let i = 0; i < hand.length; ++i)
      if (hand[i] !== card && hand[i].rank === card.rank)
        return i;
    return -1;
  }

  /* ================================================================
     GAME END
     ================================================================ */

  function checkGameEnd() {
    // Game ends when all pairs are discarded: one player holds the lone Queen
    const totalCards = playerHand.length + aiHand.length;

    if (totalCards <= 1) {
      phase = PHASE_GAME_OVER;
      roundOver = true;

      const playerHasOldMaid = playerHand.some(c => isTheOldMaid(c));
      const aiHasOldMaid = aiHand.some(c => isTheOldMaid(c));

      if (playerHasOldMaid) {
        score = 0;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 260, 'You are the Old Maid!', { color: '#f44', size: 28 });
          _host.screenShake.trigger(10, 500);
        }
        gameOver = false;
      } else if (aiHasOldMaid) {
        score = 100;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 260, 'AI is the Old Maid! You win!', { color: '#4f4', size: 28 });
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
        gameOver = false;
      } else {
        // Edge case: no cards left at all (shouldn't happen but handle gracefully)
        score = 50;
        gameOver = false;
      }

      if (_host) _host.onScoreChanged(score);
      return true;
    }

    // Check if one player ran out of cards (skip their turn)
    if (playerHand.length === 0 && aiHand.length === 1) {
      // AI is stuck with the old maid
      phase = PHASE_GAME_OVER;
      roundOver = true;
      score = 100;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 260, 'AI is the Old Maid! You win!', { color: '#4f4', size: 28 });
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        _host.onScoreChanged(score);
      }
      return true;
    }

    if (aiHand.length === 0 && playerHand.length === 1) {
      phase = PHASE_GAME_OVER;
      roundOver = true;
      score = 0;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 260, 'You are the Old Maid!', { color: '#f44', size: 28 });
        _host.screenShake.trigger(10, 500);
        _host.onScoreChanged(score);
      }
      return true;
    }

    return false;
  }

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 680;
    const fanWidth = Math.min(maxWidth, total * 50);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function aiDrawCardX(idx, total) {
    const maxWidth = 580;
    const fanWidth = Math.min(maxWidth, total * 45);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestAiCards(mx, my) {
    if (phase !== PHASE_PLAYER_DRAW) return -1;
    const total = aiDrawableOrder.length;
    if (total === 0) return -1;

    const y = 80;
    for (let di = total - 1; di >= 0; --di) {
      const x = aiDrawCardX(di, total);
      const rightEdge = di === total - 1 ? x + CE.CARD_W : aiDrawCardX(di + 1, total);
      const hitW = rightEdge - x;
      if (mx >= x && mx <= x + hitW && my >= y && my <= y + CE.CARD_H)
        return aiDrawableOrder[di];
    }
    return -1;
  }

  function hitTestPlayerCards(mx, my) {
    const total = playerHand.length;
    if (total === 0) return -1;

    const y = CANVAS_H - CE.CARD_H - 20;
    for (let i = total - 1; i >= 0; --i) {
      const x = playerCardX(i, total);
      const rightEdge = i === total - 1 ? x + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - x;
      if (mx >= x && mx <= x + hitW && my >= y && my <= y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawOldMaid() {
    // Title and phase info
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Old Maid', 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    const phaseNames = ['Dealing...', 'Removing initial pairs...', 'Your turn: draw a card', 'AI is thinking...', 'Discarding pair...', 'Game Over'];
    _ctx.fillText(phaseNames[phase] || '', 10, 28);

    drawInfoPanel();
    drawAiDrawableHand();
    drawPlayerHand();
    drawPairStacks();

    if (phase === PHASE_PLAYER_DRAW)
      drawDrawPrompt();

    if (phase === PHASE_GAME_OVER)
      drawGameOverUI();
  }

  function drawInfoPanel() {
    const px = CANVAS_W - 170;
    const py = 10;
    const pw = 160;
    const ph = 90;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Old Maid', px + 10, py + 8);

    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You: ' + playerHand.length + ' cards, ' + playerPairs.length + ' pairs', px + 10, py + 28);
    _ctx.fillStyle = '#faa';
    _ctx.fillText('AI: ' + aiHand.length + ' cards, ' + aiPairs.length + ' pairs', px + 10, py + 46);

    _ctx.fillStyle = '#fa0';
    _ctx.fillText('Score: ' + score, px + 10, py + 66);
    _ctx.restore();
  }

  function drawAiDrawableHand() {
    const total = aiDrawableOrder.length;
    if (total === 0) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText('AI has no cards', CANVAS_W / 2, 110);
      return;
    }

    // Label
    _ctx.fillStyle = phase === PHASE_PLAYER_DRAW ? '#ff0' : '#aaa';
    _ctx.font = (phase === PHASE_PLAYER_DRAW ? 'bold ' : '') + '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('AI\'s Hand (' + aiHand.length + ' cards)', CANVAS_W / 2, 60);

    const y = 80;
    for (let di = 0; di < total; ++di) {
      const x = aiDrawCardX(di, total);
      const isHovered = phase === PHASE_PLAYER_DRAW && hoverCardIdx >= 0 && aiDrawableOrder[di] === hoverCardIdx;

      if (isHovered) {
        _ctx.save();
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 12;
        CE.drawCardBack(_ctx, x, y - 5);
        _ctx.restore();

        // Highlight border
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 2;
        CE.drawRoundedRect(_ctx, x - 1, y - 6, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      } else
        CE.drawCardBack(_ctx, x, y);
    }
  }

  function drawPlayerHand() {
    const total = playerHand.length;
    if (total === 0) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText('Your hand is empty', CANVAS_W / 2, CANVAS_H - 70);
      return;
    }

    // Label
    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Your Hand (' + total + ' cards)', CANVAS_W / 2, CANVAS_H - CE.CARD_H - 40);

    const y = CANVAS_H - CE.CARD_H - 20;

    for (let i = 0; i < total; ++i) {
      if (playerHand[i]._dealing) continue;
      const x = playerCardX(i, total);
      CE.drawCardFace(_ctx, x, y, playerHand[i]);

      // Hint glow: highlight cards that form pairs (matching rank)
      if (_host && _host.hintsEnabled && phase !== PHASE_GAME_OVER) {
        let hasPair = false;
        for (let j = 0; j < total; ++j) {
          if (j !== i && playerHand[j].rank === playerHand[i].rank) {
            hasPair = true;
            break;
          }
        }
        if (hasPair)
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }

      // Glow the Old Maid if game is over
      if (phase === PHASE_GAME_OVER && isTheOldMaid(playerHand[i])) {
        _ctx.save();
        _ctx.strokeStyle = '#f44';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#f44';
        _ctx.shadowBlur = 10 + 6 * Math.sin(queenGlowTimer * 4);
        CE.drawRoundedRect(_ctx, x - 2, y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 2);
        _ctx.stroke();
        _ctx.restore();
      }
    }
  }

  function drawPairStacks() {
    // Player pairs on the left
    const pairStartX = 15;
    const pairStartY = 220;

    _ctx.fillStyle = '#8f8';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Your Pairs (' + playerPairs.length + ')', pairStartX, pairStartY - 14);

    const maxVisible = 8;
    const pairOffset = 20;
    const visiblePairs = playerPairs.slice(-maxVisible);
    for (let i = 0; i < visiblePairs.length; ++i) {
      const y = pairStartY + i * pairOffset;
      _ctx.save();
      _ctx.globalAlpha = 0.7;
      drawMiniPair(pairStartX, y, visiblePairs[i]);
      _ctx.restore();
    }

    // AI pairs on the right
    const aiPairX = CANVAS_W - 110;
    const aiPairY = 220;

    _ctx.fillStyle = '#faa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.textBaseline = 'top';
    _ctx.fillText('AI Pairs (' + aiPairs.length + ')', aiPairX + 90, aiPairY - 14);

    const visibleAiPairs = aiPairs.slice(-maxVisible);
    for (let i = 0; i < visibleAiPairs.length; ++i) {
      const y = aiPairY + i * pairOffset;
      _ctx.save();
      _ctx.globalAlpha = 0.7;
      drawMiniPair(aiPairX, y, visibleAiPairs[i]);
      _ctx.restore();
    }
  }

  function drawMiniPair(x, y, pair) {
    const mw = 40;
    const mh = 18;

    // First card mini
    _ctx.fillStyle = '#fff';
    _ctx.strokeStyle = '#999';
    _ctx.lineWidth = 0.5;
    CE.drawRoundedRect(_ctx, x, y, mw, mh, 2);
    _ctx.fill();
    _ctx.stroke();

    const c1 = pair[0];
    _ctx.fillStyle = CE.resolveSuitColor(c1.suit);
    _ctx.font = 'bold 10px serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(c1.rank + (SUIT_GLYPHS[c1.suit] || c1.suit), x + 3, y + mh / 2);

    // Second card mini (overlapping slightly)
    const x2 = x + mw + 4;
    _ctx.fillStyle = '#fff';
    _ctx.strokeStyle = '#999';
    _ctx.lineWidth = 0.5;
    CE.drawRoundedRect(_ctx, x2, y, mw, mh, 2);
    _ctx.fill();
    _ctx.stroke();

    const c2 = pair[1];
    _ctx.fillStyle = CE.resolveSuitColor(c2.suit);
    _ctx.font = 'bold 10px serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(c2.rank + (SUIT_GLYPHS[c2.suit] || c2.suit), x2 + 3, y + mh / 2);
  }

  function drawDrawPrompt() {
    _ctx.fillStyle = '#ff0';
    _ctx.font = '13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('\u25B6 Click a card from AI\'s hand to draw', CANVAS_W / 2, 190);
  }

  function drawGameOverUI() {
    const px = CANVAS_W / 2 - 160;
    const py = 220;
    const pw = 320;
    const ph = 160;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    const playerIsOldMaid = playerHand.some(c => isTheOldMaid(c));

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Game Over', CANVAS_W / 2, py + 14);

    if (playerIsOldMaid) {
      _ctx.fillStyle = '#f66';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.fillText('You are the Old Maid!', CANVAS_W / 2, py + 50);

      _ctx.font = '13px sans-serif';
      _ctx.fillStyle = '#faa';
      _ctx.fillText('The Q\u2660 was left in your hand.', CANVAS_W / 2, py + 76);

      _ctx.fillStyle = '#f44';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.fillText('Score: 0', CANVAS_W / 2, py + 100);
    } else {
      _ctx.fillStyle = '#4f4';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.fillText('AI is the Old Maid! You win!', CANVAS_W / 2, py + 50);

      _ctx.font = '13px sans-serif';
      _ctx.fillStyle = '#afa';
      _ctx.fillText('The Q\u2660 was left in AI\'s hand.', CANVAS_W / 2, py + 76);

      _ctx.fillStyle = '#4f4';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.fillText('Score: 100', CANVAS_W / 2, py + 100);
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Click to continue', CANVAS_W / 2, py + ph - 22);
    _ctx.restore();

    // Show the remaining card(s) face up
    if (aiHand.length > 0) {
      for (let i = 0; i < aiHand.length; ++i) {
        const x = CANVAS_W / 2 - (aiHand.length * 40) / 2 + i * 40;
        CE.drawCardFace(_ctx, x, py - CE.CARD_H - 10, aiHand[i]);

        if (isTheOldMaid(aiHand[i])) {
          _ctx.save();
          _ctx.strokeStyle = '#f44';
          _ctx.lineWidth = 3;
          _ctx.shadowColor = '#f44';
          _ctx.shadowBlur = 10 + 6 * Math.sin(queenGlowTimer * 4);
          CE.drawRoundedRect(_ctx, x - 2, py - CE.CARD_H - 12, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 2);
          _ctx.stroke();
          _ctx.restore();
        }
      }
    }
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 100;
      deal();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawOldMaid();
    },

    handleClick(mx, my) {
      if (phase === PHASE_GAME_OVER) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      if (phase === PHASE_PLAYER_DRAW) {
        const aiIdx = hitTestAiCards(mx, my);
        if (aiIdx >= 0)
          playerDrawCard(aiIdx);
        return;
      }
    },

    handlePointerMove(mx, my) {
      if (phase === PHASE_PLAYER_DRAW) {
        const aiIdx = hitTestAiCards(mx, my);
        hoverCardIdx = aiIdx;
      } else
        hoverCardIdx = -1;
    },

    handlePointerUp() {},

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        deal();
      }
    },

    tick(dt) {
      queenGlowTimer += dt;

      if (phase === PHASE_REMOVING_PAIRS) {
        pairRemoveTimer -= dt;
        if (pairRemoveTimer <= 0) {
          pairRemoveTimer = PAIR_REMOVE_DELAY;
          processNextPairRemoval();
        }
        return;
      }

      if (phase === PHASE_DISCARD_ANIM) {
        discardAnimTimer -= dt;
        if (discardAnimTimer <= 0) {
          sortHand(playerHand);
          sortHand(aiHand);
          refreshAiDrawableOrder();

          if (checkGameEnd()) return;

          // Determine whose turn it was before the discard
          if (lastDiscardedBy === 'You')
            finishPlayerTurn();
          else
            finishAiTurn();
        }
        return;
      }

      if (phase === PHASE_AI_DRAW) {
        if (aiHand.length === 0) {
          // AI has no cards - game should be over or skip
          if (checkGameEnd()) return;
          phase = PHASE_PLAYER_DRAW;
          refreshAiDrawableOrder();
          return;
        }

        aiTimer -= dt;
        if (aiTimer <= 0) {
          aiTimer = 0;
          aiDrawCard();
        }
        return;
      }

      // If it's player's turn but AI has no cards to draw from
      if (phase === PHASE_PLAYER_DRAW && aiHand.length === 0) {
        if (!checkGameEnd()) {
          // Somehow AI has no cards but game isn't over -- skip to AI turn
          phase = PHASE_AI_DRAW;
          aiTimer = AI_DRAW_DELAY;
        }
      }
    },

    cleanup() {
      playerHand = [];
      aiHand = [];
      playerPairs = [];
      aiPairs = [];
      aiDrawableOrder = [];
      pairRemoveQueue = [];
      lastDiscardedPair = null;
      lastDiscardedBy = '';
      roundOver = false;
      gameOver = false;
      hoverCardIdx = -1;
      aiTimer = 0;
      pairRemoveTimer = 0;
      discardAnimTimer = 0;
      queenGlowTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('oldmaid', module);

})();
