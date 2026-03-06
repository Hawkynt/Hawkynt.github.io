;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Game state ── */
  let playerDeck = [];
  let aiDeck = [];
  let centralPile = [];
  let score = 26;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';

  /* ── Timing state ── */
  let flipTimer = 0;
  const FLIP_INTERVAL = 1.5;
  let isPlayerTurn = true;
  let snapWindowOpen = false;
  let snapWindowTimer = 0;
  const SNAP_WINDOW_DURATION = 1.5;
  let aiReactionDelay = 0;
  let aiReactionTimer = 0;
  let aiWillSnap = false;
  let pauseTimer = 0;
  let isPaused = false;
  const PAUSE_DURATION = 1.2;

  /* ── Feedback state ── */
  let lastSnapResult = '';
  let lastSnapResultTimer = 0;
  const SNAP_RESULT_DURATION = 1.5;
  let lastReactionTime = 0;
  let showReactionTime = false;
  let reactionDisplayTimer = 0;
  let snapPulsePhase = 0;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── Button positions ── */
  const SNAP_BTN = { x: CANVAS_W / 2 - 70, y: CANVAS_H / 2 - 22, w: 140, h: 44 };

  /* ══════════════════════════════════════════════════════════════════
     SNAP DETECTION
     ══════════════════════════════════════════════════════════════════ */

  function hasSnapMatch() {
    if (centralPile.length < 2) return false;
    const top = centralPile[centralPile.length - 1];
    const second = centralPile[centralPile.length - 2];
    return top.rank === second.rank;
  }

  /* ══════════════════════════════════════════════════════════════════
     FLIP A CARD
     ══════════════════════════════════════════════════════════════════ */

  function flipNextCard() {
    const sourceDeck = isPlayerTurn ? playerDeck : aiDeck;
    if (sourceDeck.length === 0) {
      checkGameOver();
      return;
    }
    const card = sourceDeck.pop();
    card.faceUp = true;
    centralPile.push(card);

    if (_host)
      _host.dealCardAnim(card, CANVAS_W / 2, isPlayerTurn ? CANVAS_H : -CE.CARD_H, CANVAS_W / 2 - CE.CARD_W / 2, CANVAS_H / 2 - CE.CARD_H / 2 - 60, 0);

    isPlayerTurn = !isPlayerTurn;

    if (hasSnapMatch()) {
      snapWindowOpen = true;
      snapWindowTimer = 0;
      snapPulsePhase = 0;
      aiReactionDelay = 0.3 + Math.random() * 0.9;
      aiReactionTimer = 0;
      aiWillSnap = true;
    }

    updateScore();
  }

  /* ══════════════════════════════════════════════════════════════════
     SNAP ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function playerSnaps() {
    if (isPaused || roundOver || gameOver) return;

    if (snapWindowOpen && hasSnapMatch()) {
      lastReactionTime = snapWindowTimer;
      showReactionTime = true;
      reactionDisplayTimer = 0;
      const pileCards = centralPile.splice(0, centralPile.length);
      for (const c of pileCards) {
        c.faceUp = false;
        playerDeck.unshift(c);
      }
      snapWindowOpen = false;
      aiWillSnap = false;
      lastSnapResult = 'SNAP!';
      lastSnapResultTimer = 0;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'SNAP!', { color: '#4f4', size: 32 });
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 20);
        _host.screenShake.trigger(4, 200);
      }
      isPaused = true;
      pauseTimer = 0;
      updateScore();
    } else {
      const penalty = Math.min(3, playerDeck.length);
      for (let i = 0; i < penalty; ++i) {
        if (playerDeck.length > 0) {
          const c = playerDeck.pop();
          c.faceUp = false;
          aiDeck.unshift(c);
        }
      }
      lastSnapResult = 'Wrong! -' + penalty;
      lastSnapResultTimer = 0;
      showReactionTime = false;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Wrong! -' + penalty + ' cards', { color: '#f44', size: 24 });
        _host.screenShake.trigger(6, 300);
      }
      isPaused = true;
      pauseTimer = 0;
      snapWindowOpen = false;
      aiWillSnap = false;
      updateScore();
      checkGameOver();
    }
  }

  function aiSnaps() {
    if (isPaused || roundOver || gameOver) return;
    if (!snapWindowOpen || !hasSnapMatch()) return;

    const pileCards = centralPile.splice(0, centralPile.length);
    for (const c of pileCards) {
      c.faceUp = false;
      aiDeck.unshift(c);
    }
    snapWindowOpen = false;
    aiWillSnap = false;
    lastSnapResult = 'Too Slow!';
    lastSnapResultTimer = 0;
    showReactionTime = false;
    if (_host) {
      _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Too Slow! AI snapped!', { color: '#f88', size: 24 });
      _host.screenShake.trigger(5, 250);
    }
    isPaused = true;
    pauseTimer = 0;
    updateScore();
    checkGameOver();
  }

  /* ══════════════════════════════════════════════════════════════════
     SCORE & GAME OVER
     ══════════════════════════════════════════════════════════════════ */

  function updateScore() {
    score = playerDeck.length;
    if (_host) _host.onScoreChanged(score);
  }

  function checkGameOver() {
    if (playerDeck.length === 0 && centralPile.length === 0) {
      gameOver = true;
      roundOver = true;
      resultMsg = 'GAME OVER - AI wins!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        _host.onRoundOver(true);
      }
      return;
    }
    if (aiDeck.length === 0 && centralPile.length === 0) {
      gameOver = true;
      roundOver = true;
      resultMsg = 'YOU WIN! All 52 cards!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        _host.addGlow(CANVAS_W / 2 - 100, CANVAS_H / 2 - 60, 200, 120, 2);
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
        _host.onRoundOver(true);
      }
      return;
    }
    if (playerDeck.length === 52) {
      gameOver = true;
      roundOver = true;
      resultMsg = 'YOU WIN! All 52 cards!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        _host.addGlow(CANVAS_W / 2 - 100, CANVAS_H / 2 - 60, 200, 120, 2);
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
        _host.onRoundOver(true);
      }
      return;
    }
    if (aiDeck.length === 52) {
      gameOver = true;
      roundOver = true;
      resultMsg = 'GAME OVER - AI wins!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        _host.onRoundOver(true);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupSnap() {
    const deck = CE.shuffle(CE.createDeck());
    playerDeck = deck.splice(0, 26);
    aiDeck = deck.splice(0, 26);
    centralPile = [];
    isPlayerTurn = true;
    flipTimer = 0;
    snapWindowOpen = false;
    snapWindowTimer = 0;
    aiReactionDelay = 0;
    aiReactionTimer = 0;
    aiWillSnap = false;
    isPaused = false;
    pauseTimer = 0;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    lastSnapResult = '';
    lastSnapResultTimer = 0;
    lastReactionTime = 0;
    showReactionTime = false;
    reactionDisplayTimer = 0;
    snapPulsePhase = 0;
    score = 26;
    if (_host) _host.onScoreChanged(score);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawSnap() {
    /* ── Title ── */
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('SNAP!', CANVAS_W / 2, 22);

    /* ── AI deck (top) ── */
    const aiDeckX = CANVAS_W / 2 - CE.CARD_W / 2;
    const aiDeckY = 40;
    _ctx.fillStyle = '#aaa';
    _ctx.font = '13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('AI (' + aiDeck.length + ' cards)', CANVAS_W / 2, aiDeckY - 6);
    if (aiDeck.length > 0) {
      if (aiDeck.length > 2)
        CE.drawCardBack(_ctx, aiDeckX + 3, aiDeckY + 3);
      if (aiDeck.length > 1)
        CE.drawCardBack(_ctx, aiDeckX + 1.5, aiDeckY + 1.5);
      CE.drawCardBack(_ctx, aiDeckX, aiDeckY);
    } else {
      _ctx.strokeStyle = '#555';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, aiDeckX, aiDeckY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.fillStyle = '#555';
      _ctx.font = '12px sans-serif';
      _ctx.fillText('Empty', aiDeckX + CE.CARD_W / 2, aiDeckY + CE.CARD_H / 2);
    }

    /* ── Central pile (middle) ── */
    const pileX = CANVAS_W / 2 - CE.CARD_W / 2;
    const pileY = CANVAS_H / 2 - CE.CARD_H / 2 - 10;

    _ctx.fillStyle = '#999';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Pile (' + centralPile.length + ')', CANVAS_W / 2, pileY - 8);

    if (centralPile.length === 0) {
      _ctx.strokeStyle = '#555';
      _ctx.lineWidth = 1;
      _ctx.setLineDash([4, 4]);
      CE.drawRoundedRect(_ctx, pileX, pileY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.setLineDash([]);
    } else {
      if (centralPile.length >= 2) {
        const secondCard = centralPile[centralPile.length - 2];
        CE.drawCardFace(_ctx, pileX - 18, pileY + 4, secondCard);
      }
      const topCard = centralPile[centralPile.length - 1];
      if (topCard._dealing)
        ;
      else
        CE.drawCardFace(_ctx, pileX + 8, pileY - 4, topCard);

      /* ── Match highlight ── */
      if (hasSnapMatch() && !isPaused) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 12;
        CE.drawRoundedRect(_ctx, pileX - 22, pileY - 8, CE.CARD_W + 34, CE.CARD_H + 16, CE.CARD_RADIUS + 2);
        _ctx.stroke();
        _ctx.restore();
      }
    }

    /* ── Player deck (bottom) ── */
    const playerDeckX = CANVAS_W / 2 - CE.CARD_W / 2;
    const playerDeckY = CANVAS_H - CE.CARD_H - 50;
    _ctx.fillStyle = '#8f8';
    _ctx.font = '13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('You (' + playerDeck.length + ' cards)', CANVAS_W / 2, playerDeckY + CE.CARD_H + 18);
    if (playerDeck.length > 0) {
      if (playerDeck.length > 2)
        CE.drawCardBack(_ctx, playerDeckX + 3, playerDeckY + 3);
      if (playerDeck.length > 1)
        CE.drawCardBack(_ctx, playerDeckX + 1.5, playerDeckY + 1.5);
      CE.drawCardBack(_ctx, playerDeckX, playerDeckY);
    } else {
      _ctx.strokeStyle = '#555';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, playerDeckX, playerDeckY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.fillStyle = '#555';
      _ctx.font = '12px sans-serif';
      _ctx.fillText('Empty', playerDeckX + CE.CARD_W / 2, playerDeckY + CE.CARD_H / 2);
    }

    /* ── Whose turn indicator ── */
    if (!roundOver && !gameOver && !snapWindowOpen && !isPaused) {
      const turnLabel = isPlayerTurn ? 'Your card next...' : 'AI flipping...';
      _ctx.fillStyle = isPlayerTurn ? '#8f8' : '#f88';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(turnLabel, CANVAS_W / 2, CANVAS_H / 2 + CE.CARD_H / 2 + 24);

      /* ── Flip timer bar ── */
      const barW = 120;
      const barH = 4;
      const barX = CANVAS_W / 2 - barW / 2;
      const barY = CANVAS_H / 2 + CE.CARD_H / 2 + 30;
      const progress = Math.min(flipTimer / FLIP_INTERVAL, 1);
      _ctx.fillStyle = '#333';
      _ctx.fillRect(barX, barY, barW, barH);
      _ctx.fillStyle = '#6a6';
      _ctx.fillRect(barX, barY, barW * progress, barH);
    }

    /* ── SNAP button (pulsing) ── */
    if (snapWindowOpen && hasSnapMatch() && !isPaused) {
      const pulse = 1 + 0.08 * Math.sin(snapPulsePhase * 8);
      const bw = SNAP_BTN.w * pulse;
      const bh = SNAP_BTN.h * pulse;
      const bx = SNAP_BTN.x + (SNAP_BTN.w - bw) / 2;
      const by = SNAP_BTN.y + (SNAP_BTN.h - bh) / 2;

      _ctx.save();
      _ctx.shadowColor = '#f00';
      _ctx.shadowBlur = 16 + 8 * Math.sin(snapPulsePhase * 8);
      CE.drawButton(_ctx, bx, by, bw, bh, 'SNAP! (Space)', {
        bg: '#c00',
        border: '#f44',
        textColor: '#fff',
        fontSize: 18
      });
      _ctx.restore();

      /* ── Snap window timer bar ── */
      const remaining = 1 - snapWindowTimer / SNAP_WINDOW_DURATION;
      const twBarW = 140;
      const twBarH = 6;
      const twBarX = CANVAS_W / 2 - twBarW / 2;
      const twBarY = SNAP_BTN.y + SNAP_BTN.h + 10;
      _ctx.fillStyle = '#333';
      _ctx.fillRect(twBarX, twBarY, twBarW, twBarH);
      _ctx.fillStyle = remaining > 0.3 ? '#f44' : '#f00';
      _ctx.fillRect(twBarX, twBarY, twBarW * Math.max(remaining, 0), twBarH);
    }

    /* ── Last snap result ── */
    if (lastSnapResultTimer < SNAP_RESULT_DURATION && lastSnapResult) {
      const alpha = 1 - lastSnapResultTimer / SNAP_RESULT_DURATION;
      _ctx.save();
      _ctx.globalAlpha = alpha;
      const isGood = lastSnapResult === 'SNAP!';
      _ctx.fillStyle = isGood ? '#4f4' : '#f44';
      _ctx.font = 'bold 22px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(lastSnapResult, CANVAS_W / 2, CANVAS_H / 2 + CE.CARD_H / 2 + 56);
      _ctx.restore();
    }

    /* ── Reaction time display ── */
    if (showReactionTime && reactionDisplayTimer < 2.0) {
      const alpha = reactionDisplayTimer < 1.5 ? 1 : 1 - (reactionDisplayTimer - 1.5) / 0.5;
      _ctx.save();
      _ctx.globalAlpha = Math.max(alpha, 0);
      _ctx.fillStyle = '#ff0';
      _ctx.font = '14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Reaction: ' + (lastReactionTime * 1000).toFixed(0) + 'ms', CANVAS_W / 2, CANVAS_H / 2 + CE.CARD_H / 2 + 76);
      _ctx.restore();
    }

    /* ── Score display ── */
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Cards: ' + playerDeck.length, 20, 28);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('AI: ' + aiDeck.length, CANVAS_W - 20, 28);

    /* ── Card count bar ── */
    const barTotalW = 200;
    const barTotalH = 8;
    const barTotalX = CANVAS_W / 2 - barTotalW / 2;
    const barTotalY = CANVAS_H - 14;
    const totalCards = playerDeck.length + aiDeck.length + centralPile.length;
    const playerRatio = totalCards > 0 ? playerDeck.length / totalCards : 0.5;
    _ctx.fillStyle = '#333';
    _ctx.fillRect(barTotalX, barTotalY, barTotalW, barTotalH);
    _ctx.fillStyle = '#4a4';
    _ctx.fillRect(barTotalX, barTotalY, barTotalW * playerRatio, barTotalH);
    _ctx.fillStyle = '#a44';
    const aiRatio = totalCards > 0 ? aiDeck.length / totalCards : 0.5;
    _ctx.fillRect(barTotalX + barTotalW * (1 - aiRatio), barTotalY, barTotalW * aiRatio, barTotalH);

    /* ── Instructions ── */
    if (!roundOver && !gameOver) {
      _ctx.fillStyle = '#777';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Cards flip automatically. Press SPACE or click SNAP! when ranks match.', CANVAS_W / 2, CANVAS_H - 26);
    }

    /* ── Game over message ── */
    if (roundOver || gameOver) {
      _ctx.save();
      _ctx.fillStyle = 'rgba(0,0,0,0.5)';
      _ctx.fillRect(0, CANVAS_H / 2 - 40, CANVAS_W, 80);
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 24px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 8);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '14px sans-serif';
      _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 20);
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
      score = (_host && _host.getScore) ? _host.getScore() : 26;
      setupSnap();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawSnap();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      if (snapWindowOpen && hasSnapMatch() && !isPaused) {
        if (CE.isInRect(mx, my, SNAP_BTN.x - 20, SNAP_BTN.y - 20, SNAP_BTN.w + 40, SNAP_BTN.h + 40)) {
          playerSnaps();
          return;
        }
      }

      playerSnaps();
    },

    handleKey(e) {
      if (roundOver || gameOver) return;
      if (e.key === ' ' || e.key === 'Spacebar')
        playerSnaps();
    },

    tick(dt) {
      if (roundOver || gameOver) return;

      /* ── Feedback timers ── */
      if (lastSnapResultTimer < SNAP_RESULT_DURATION)
        lastSnapResultTimer += dt;
      if (showReactionTime)
        reactionDisplayTimer += dt;

      /* ── Post-snap pause ── */
      if (isPaused) {
        pauseTimer += dt;
        if (pauseTimer >= PAUSE_DURATION) {
          isPaused = false;
          pauseTimer = 0;
          flipTimer = 0;
          checkGameOver();
        }
        return;
      }

      /* ── Snap window countdown ── */
      if (snapWindowOpen) {
        snapWindowTimer += dt;
        snapPulsePhase += dt;

        if (aiWillSnap) {
          aiReactionTimer += dt;
          if (aiReactionTimer >= aiReactionDelay) {
            aiSnaps();
            return;
          }
        }

        if (snapWindowTimer >= SNAP_WINDOW_DURATION) {
          snapWindowOpen = false;
          if (aiWillSnap) {
            aiSnaps();
            return;
          }
          flipTimer = 0;
        }
        return;
      }

      /* ── Auto-flip timer ── */
      flipTimer += dt;
      if (flipTimer >= FLIP_INTERVAL) {
        flipTimer = 0;
        const sourceDeck = isPlayerTurn ? playerDeck : aiDeck;
        if (sourceDeck.length > 0)
          flipNextCard();
        else {
          isPlayerTurn = !isPlayerTurn;
          const otherDeck = isPlayerTurn ? playerDeck : aiDeck;
          if (otherDeck.length > 0)
            flipNextCard();
          else
            checkGameOver();
        }
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      playerDeck = [];
      aiDeck = [];
      centralPile = [];
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      flipTimer = 0;
      snapWindowOpen = false;
      snapWindowTimer = 0;
      aiReactionDelay = 0;
      aiReactionTimer = 0;
      aiWillSnap = false;
      isPaused = false;
      pauseTimer = 0;
      lastSnapResult = '';
      lastSnapResultTimer = 0;
      showReactionTime = false;
      reactionDisplayTimer = 0;
      snapPulsePhase = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('snap', module);

})();
