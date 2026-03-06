;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Court card payment counts ── */
  const PENALTY = { 'A': 4, 'K': 3, 'Q': 2, 'J': 1 };

  /* ── Layout positions ── */
  const AI_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const AI_PILE_Y = 40;
  const PLAYER_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PLAYER_PILE_Y = CANVAS_H - 40 - CE.CARD_H;

  const CENTER_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const CENTER_Y = CANVAS_H / 2 - CE.CARD_H / 2;

  const NEXT_BTN = { x: CANVAS_W / 2 - 110, y: CANVAS_H / 2 + CE.CARD_H / 2 + 20, w: 100, h: 36 };
  const AUTO_BTN = { x: CANVAS_W / 2 + 10, y: CANVAS_H / 2 + CE.CARD_H / 2 + 20, w: 100, h: 36 };

  /* ── Game state ── */
  let playerPile = [];
  let aiPile = [];
  let centerPile = [];
  let score = 0;
  let roundOver = false;
  let gameOver = false;

  /* ── Turn state ── */
  let isPlayerTurn = true;       // who plays next card
  let penaltyRemaining = 0;      // cards left to pay
  let penaltyTotal = 0;          // original penalty count
  let penaltyChallenger = '';    // 'player' or 'ai' -- who played the court card

  /* ── Animation phases ── */
  const PHASE_IDLE = 0;
  const PHASE_PLAY = 1;         // card flip animation
  const PHASE_SHOW = 2;         // brief pause to show the card
  const PHASE_COLLECT = 3;      // winner collects pile

  let phase = PHASE_IDLE;
  let phaseTimer = 0;

  /* ── Flip animation ── */
  let flipAnimProgress = 0;
  const FLIP_DURATION = 0.3;
  let currentCard = null;

  /* ── Collect animation ── */
  let collectTarget = '';
  let collectProgress = 0;
  const COLLECT_DURATION = 0.4;

  /* ── Auto play ── */
  let autoPlay = false;
  const AUTO_INTERVAL = 0.6;
  let autoTimer = 0;

  /* ── Result display ── */
  let resultText = '';

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ══════════════════════════════════════════════════════════════════
     PILE DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawPileWithCount(x, y, count, label) {
    if (count > 0) {
      const layers = Math.min(count, 3);
      for (let i = 0; i < layers - 1; ++i)
        CE.drawCardBack(_ctx, x + i * 2, y + i * 2);
      CE.drawCardBack(_ctx, x + (layers - 1) * 2, y + (layers - 1) * 2);
    } else {
      _ctx.save();
      _ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.restore();
    }
    _ctx.save();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(label + ': ' + count, x + CE.CARD_W / 2, y < CANVAS_H / 2 ? y - 14 : y + CE.CARD_H + 18);
    _ctx.restore();
  }

  function drawCenterPile() {
    if (centerPile.length === 0) {
      _ctx.save();
      _ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, CENTER_X, CENTER_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.restore();
      return;
    }

    // Show up to 3 stacked cards + the top face-up card
    const topIdx = centerPile.length - 1;
    const stackStart = Math.max(0, topIdx - 2);

    for (let i = stackStart; i < topIdx; ++i) {
      const off = (i - stackStart) * 2;
      CE.drawCardBack(_ctx, CENTER_X + off, CENTER_Y + off);
    }

    const topCard = centerPile[topIdx];
    const off = Math.min(topIdx - stackStart, 2) * 2;
    if (topCard.faceUp)
      CE.drawCardFace(_ctx, CENTER_X + off, CENTER_Y + off, topCard);
    else
      CE.drawCardBack(_ctx, CENTER_X + off, CENTER_Y + off);

    // Pile count
    _ctx.save();
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Pile: ' + centerPile.length, CENTER_X + CE.CARD_W / 2, CENTER_Y - 14);
    _ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     FLIP ANIMATION
     ══════════════════════════════════════════════════════════════════ */

  function drawFlippingCard(x, y, scaleX, card) {
    _ctx.save();
    _ctx.translate(x + CE.CARD_W / 2, y);
    _ctx.scale(scaleX || 0.01, 1);
    _ctx.translate(-CE.CARD_W / 2, 0);
    if (card)
      CE.drawCardFace(_ctx, 0, 0, card);
    else
      CE.drawCardBack(_ctx, 0, 0);
    _ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function isCourt(card) {
    return PENALTY[card.rank] !== undefined;
  }

  function playOneCard() {
    if (phase !== PHASE_IDLE || roundOver || gameOver) return;

    const source = isPlayerTurn ? playerPile : aiPile;
    if (source.length === 0) {
      finishGame(isPlayerTurn ? 'ai' : 'player');
      return;
    }

    const card = source.shift();
    card.faceUp = true;
    currentCard = card;
    centerPile.push(card);

    // Deal animation
    if (_host) {
      const fromX = isPlayerTurn ? PLAYER_PILE_X : AI_PILE_X;
      const fromY = isPlayerTurn ? PLAYER_PILE_Y : AI_PILE_Y;
      _host.dealCardAnim(card, fromX, fromY, CENTER_X, CENTER_Y, 0);
    }

    flipAnimProgress = 0;
    phase = PHASE_PLAY;
  }

  function resolveCard() {
    const card = currentCard;
    const playedByPlayer = isPlayerTurn;

    if (penaltyRemaining > 0) {
      // We are in a penalty payment phase
      --penaltyRemaining;

      if (isCourt(card)) {
        // Penalty transfers! The new court card sets a new penalty for the other player
        penaltyChallenger = playedByPlayer ? 'player' : 'ai';
        penaltyTotal = PENALTY[card.rank];
        penaltyRemaining = penaltyTotal;
        isPlayerTurn = !isPlayerTurn;
        phase = PHASE_SHOW;
        phaseTimer = 0;
        if (_host)
          _host.floatingText.add(CENTER_X + CE.CARD_W / 2, CENTER_Y - 20,
            card.rank + '! Pay ' + penaltyTotal, { color: '#ff0', size: 18 });
        return;
      }

      if (penaltyRemaining === 0) {
        // Payment complete without a court card -- challenger wins the pile
        collectTarget = penaltyChallenger;
        phase = PHASE_SHOW;
        phaseTimer = 0;
        resultText = (penaltyChallenger === 'player' ? 'You collect' : 'AI collects') + ' the pile!';
        if (_host)
          _host.floatingText.add(CENTER_X + CE.CARD_W / 2, CENTER_Y - 20,
            (penaltyChallenger === 'player' ? 'You' : 'AI') + ' collect!',
            { color: penaltyChallenger === 'player' ? '#4f4' : '#f44', size: 20 });
        return;
      }

      // Still paying -- keep same player's turn
      phase = PHASE_SHOW;
      phaseTimer = 0;
      return;
    }

    // Normal play (no active penalty)
    if (isCourt(card)) {
      // Court card played -- opponent must pay
      penaltyChallenger = playedByPlayer ? 'player' : 'ai';
      penaltyTotal = PENALTY[card.rank];
      penaltyRemaining = penaltyTotal;
      isPlayerTurn = !isPlayerTurn;
      phase = PHASE_SHOW;
      phaseTimer = 0;
      if (_host)
        _host.floatingText.add(CENTER_X + CE.CARD_W / 2, CENTER_Y - 20,
          card.rank + '! Pay ' + penaltyTotal, { color: '#ff0', size: 18 });
      return;
    }

    // Regular card, no penalty -- switch turn
    isPlayerTurn = !isPlayerTurn;
    phase = PHASE_SHOW;
    phaseTimer = 0;
  }

  function collectCards() {
    const winner = collectTarget;
    const allCards = centerPile.splice(0, centerPile.length);
    // Add to bottom of winner's pile
    if (winner === 'player')
      playerPile.push(...allCards);
    else
      aiPile.push(...allCards);

    penaltyRemaining = 0;
    penaltyTotal = 0;
    penaltyChallenger = '';
    collectTarget = '';
    resultText = '';
    currentCard = null;

    // Winner leads next
    isPlayerTurn = winner === 'player';

    // Update score
    score = playerPile.length;
    if (_host) _host.onScoreChanged(score);

    // Check game over
    if (playerPile.length === 0) {
      finishGame('ai');
    } else if (aiPile.length === 0) {
      finishGame('player');
    } else {
      phase = PHASE_IDLE;
    }
  }

  function finishGame(winner) {
    gameOver = true;
    roundOver = true;
    if (winner === 'player') {
      resultText = 'YOU WIN THE GAME!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
        _host.onRoundOver(true);
      }
    } else {
      resultText = 'GAME OVER - AI wins!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        _host.onRoundOver(true);
      }
    }
    autoPlay = false;
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupBeggar() {
    const deck = CE.shuffle(CE.createDeck());
    playerPile = deck.slice(0, 26);
    aiPile = deck.slice(26, 52);
    centerPile = [];
    isPlayerTurn = true;
    penaltyRemaining = 0;
    penaltyTotal = 0;
    penaltyChallenger = '';
    collectTarget = '';
    currentCard = null;
    phase = PHASE_IDLE;
    phaseTimer = 0;
    flipAnimProgress = 0;
    collectProgress = 0;
    resultText = '';
    roundOver = false;
    gameOver = false;
    autoPlay = false;
    autoTimer = 0;
    score = 26;

    // Animate initial deal
    if (_host) {
      for (let i = 0; i < 4; ++i)
        _host.dealCardAnim(playerPile[i], CANVAS_W / 2, -CE.CARD_H, PLAYER_PILE_X, PLAYER_PILE_Y, i * 0.08);
      for (let i = 0; i < 4; ++i)
        _host.dealCardAnim(aiPile[i], CANVAS_W / 2, -CE.CARD_H, AI_PILE_X, AI_PILE_Y, (i + 4) * 0.08);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawBeggar() {
    // Title
    _ctx.save();
    _ctx.fillStyle = '#ddd';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('BEGGAR MY NEIGHBOR', CANVAS_W / 2, 8);
    _ctx.restore();

    // AI pile (top)
    drawPileWithCount(AI_PILE_X, AI_PILE_Y, aiPile.length, 'AI');

    // Player pile (bottom)
    drawPileWithCount(PLAYER_PILE_X, PLAYER_PILE_Y, playerPile.length, 'You');

    // Center pile
    if (phase === PHASE_PLAY) {
      // Draw all but the top card normally, then animate the top card
      if (centerPile.length > 1) {
        const saved = centerPile[centerPile.length - 1];
        centerPile.length -= 1;
        drawCenterPile();
        centerPile.push(saved);
      }
      const progress = Math.min(flipAnimProgress / FLIP_DURATION, 1);
      if (progress < 0.5) {
        const scaleX = 1 - progress * 2;
        drawFlippingCard(CENTER_X, CENTER_Y, scaleX, null);
      } else {
        const scaleX = (progress - 0.5) * 2;
        drawFlippingCard(CENTER_X, CENTER_Y, scaleX, currentCard);
      }
    } else {
      drawCenterPile();
    }

    // Turn indicator
    if (!gameOver && phase === PHASE_IDLE) {
      const turnLabel = isPlayerTurn ? "Your turn" : "AI's turn";
      const arrowY = isPlayerTurn ? PLAYER_PILE_Y - 30 : AI_PILE_Y + CE.CARD_H + 30;
      _ctx.save();
      _ctx.fillStyle = isPlayerTurn ? '#8f8' : '#f88';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(turnLabel, CANVAS_W / 2, arrowY);
      _ctx.restore();
    }

    // Payment counter
    if (penaltyRemaining > 0 && !gameOver) {
      const paid = penaltyTotal - penaltyRemaining;
      const payLabel = 'Payment: ' + paid + ' of ' + penaltyTotal + ' (' + penaltyRemaining + ' remaining)';
      _ctx.save();
      _ctx.fillStyle = '#ffa';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(payLabel, CANVAS_W / 2, CENTER_Y + CE.CARD_H + 8);
      _ctx.restore();
    }

    // Result text
    if (resultText) {
      _ctx.save();
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 20px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      const textY = gameOver ? CANVAS_H / 2 : CENTER_Y + CE.CARD_H + 30;
      _ctx.fillText(resultText, CANVAS_W / 2, textY);
      _ctx.restore();
    }

    // Buttons (Next / Auto) when idle
    if (phase === PHASE_IDLE && !roundOver && !gameOver) {
      CE.drawButton(_ctx, NEXT_BTN.x, NEXT_BTN.y, NEXT_BTN.w, NEXT_BTN.h, 'Next (N)', { bg: '#2a5a2a', border: '#6c6' });
      const autoBg = autoPlay ? '#5a2a2a' : '#2a2a5a';
      const autoBorder = autoPlay ? '#f66' : '#66f';
      const autoLabel = autoPlay ? 'Stop (A)' : 'Auto (A)';
      CE.drawButton(_ctx, AUTO_BTN.x, AUTO_BTN.y, AUTO_BTN.w, AUTO_BTN.h, autoLabel, { bg: autoBg, border: autoBorder });

      if (!autoPlay) {
        _ctx.save();
        _ctx.fillStyle = '#aaa';
        _ctx.font = '12px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.fillText('Press N or click Next to play a card', CANVAS_W / 2, NEXT_BTN.y + NEXT_BTN.h + 14);
        _ctx.restore();
      }
    }

    // Game over prompt
    if (gameOver) {
      _ctx.save();
      _ctx.fillStyle = '#aaa';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 28);
      _ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = 26;
      setupBeggar();
      if (_host) _host.onScoreChanged(score);
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawBeggar();
    },

    handleClick(mx, my) {
      if (gameOver) {
        if (_host) _host.onRoundOver(true);
        return;
      }
      if (phase !== PHASE_IDLE || roundOver) return;

      // Auto button
      if (CE.isInRect(mx, my, AUTO_BTN.x, AUTO_BTN.y, AUTO_BTN.w, AUTO_BTN.h)) {
        autoPlay = !autoPlay;
        autoTimer = 0;
        return;
      }

      // Next button or anywhere else
      playOneCard();
    },

    handleKey(e) {
      if (gameOver) return;
      if (phase !== PHASE_IDLE || roundOver) return;

      if (e.key === 'n' || e.key === 'N' || e.key === ' ')
        playOneCard();
      else if (e.key === 'a' || e.key === 'A') {
        autoPlay = !autoPlay;
        autoTimer = 0;
      }
    },

    tick(dt) {
      if (gameOver) return;

      // Auto play timer
      if (autoPlay && phase === PHASE_IDLE && !roundOver) {
        autoTimer += dt;
        if (autoTimer >= AUTO_INTERVAL) {
          autoTimer = 0;
          playOneCard();
        }
      }

      switch (phase) {
        case PHASE_PLAY:
          flipAnimProgress += dt;
          if (flipAnimProgress >= FLIP_DURATION) {
            flipAnimProgress = FLIP_DURATION;
            resolveCard();
          }
          break;

        case PHASE_SHOW:
          phaseTimer += dt;
          if (collectTarget) {
            // Waiting to collect
            if (phaseTimer >= 0.8) {
              phase = PHASE_COLLECT;
              collectProgress = 0;
            }
          } else {
            // Brief pause then back to idle for next card
            const delay = autoPlay ? 0.15 : 0.4;
            if (phaseTimer >= delay)
              phase = PHASE_IDLE;
          }
          break;

        case PHASE_COLLECT:
          collectProgress += dt;
          if (collectProgress >= COLLECT_DURATION)
            collectCards();
          break;
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      playerPile = [];
      aiPile = [];
      centerPile = [];
      penaltyRemaining = 0;
      penaltyTotal = 0;
      penaltyChallenger = '';
      collectTarget = '';
      currentCard = null;
      phase = PHASE_IDLE;
      phaseTimer = 0;
      flipAnimProgress = 0;
      collectProgress = 0;
      resultText = '';
      roundOver = false;
      gameOver = false;
      autoPlay = false;
      autoTimer = 0;
      score = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('beggar', module);

})();
