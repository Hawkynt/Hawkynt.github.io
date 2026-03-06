;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Constants ── */
  const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

  /* ── Layout positions ── */
  const AI_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const AI_PILE_Y = 40;
  const PLAYER_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PLAYER_PILE_Y = CANVAS_H - 40 - CE.CARD_H;

  const AI_PLAY_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const AI_PLAY_Y = 190;
  const PLAYER_PLAY_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PLAYER_PLAY_Y = 310;

  const FLIP_BTN = { x: CANVAS_W / 2 - 50, y: CANVAS_H / 2 - 18, w: 100, h: 36 };

  /* ── Game state ── */
  let playerPile = [];
  let aiPile = [];
  let playerPlayed = [];
  let aiPlayed = [];
  let warFaceDown = [];         // { player: [], ai: [] } cards placed face-down during war
  let score = 0;
  let roundOver = false;
  let gameOver = false;

  /* ── Animation state ── */
  const PHASE_IDLE = 0;         // waiting for click
  const PHASE_FLIP = 1;         // flip animation
  const PHASE_SHOW = 2;         // showing result
  const PHASE_COLLECT = 3;      // winner collecting cards
  const PHASE_WAR_DEAL = 4;     // dealing war face-down cards
  const PHASE_WAR_FLIP = 5;     // flipping war face-up cards
  const PHASE_WAR_SHOW = 6;     // showing war result

  let phase = PHASE_IDLE;
  let phaseTimer = 0;

  /* ── Flip animation ── */
  let flipAnimProgress = 0;
  const FLIP_DURATION = 0.35;

  /* ── Collect animation ── */
  let collectTarget = '';        // 'player' or 'ai'
  let collectProgress = 0;
  const COLLECT_DURATION = 0.4;

  /* ── War state ── */
  let warRound = 0;
  let warDealIndex = 0;
  let warDealTimer = 0;
  const WAR_DEAL_INTERVAL = 0.15;

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
      // draw stacked look (up to 3 offset cards)
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
    // card count
    _ctx.save();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(label + ': ' + count, x + CE.CARD_W / 2, y < CANVAS_H / 2 ? y - 14 : y + CE.CARD_H + 18);
    _ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     WAR RULES
     ══════════════════════════════════════════════════════════════════ */

  function rankValue(card) {
    return RANK_VALUES[card.rank] || 0;
  }

  function compareCards(playerCard, aiCard) {
    const pv = rankValue(playerCard);
    const av = rankValue(aiCard);
    if (pv > av) return 1;
    if (pv < av) return -1;
    return 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME FLOW
     ══════════════════════════════════════════════════════════════════ */

  function startFlip() {
    if (phase !== PHASE_IDLE || roundOver || gameOver) return;
    if (playerPile.length === 0 || aiPile.length === 0) return;

    const pc = playerPile.shift();
    pc.faceUp = true;
    playerPlayed.push(pc);

    const ac = aiPile.shift();
    ac.faceUp = true;
    aiPlayed.push(ac);

    if (_host) {
      _host.dealCardAnim(pc, PLAYER_PILE_X, PLAYER_PILE_Y, PLAYER_PLAY_X, PLAYER_PLAY_Y, 0);
      _host.dealCardAnim(ac, AI_PILE_X, AI_PILE_Y, AI_PLAY_X, AI_PLAY_Y, 0.05);
    }

    flipAnimProgress = 0;
    phase = PHASE_FLIP;
  }

  function resolveFlip() {
    const pc = playerPlayed[playerPlayed.length - 1];
    const ac = aiPlayed[aiPlayed.length - 1];
    const cmp = compareCards(pc, ac);

    if (cmp > 0) {
      resultText = 'You win this round!';
      collectTarget = 'player';
      phase = PHASE_SHOW;
      phaseTimer = 0;
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'You Win!', { color: '#4f4', size: 22 });
    } else if (cmp < 0) {
      resultText = 'AI wins this round!';
      collectTarget = 'ai';
      phase = PHASE_SHOW;
      phaseTimer = 0;
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Wins!', { color: '#f44', size: 22 });
    } else {
      // WAR!
      resultText = 'WAR!';
      phase = PHASE_WAR_DEAL;
      phaseTimer = 0;
      warDealIndex = 0;
      warDealTimer = 0;
      warFaceDown = { player: [], ai: [] };
      ++warRound;
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'WAR!', { color: '#ff0', size: 36 });
    }
  }

  function dealWarCards() {
    // Each player places up to 3 face-down cards
    const playerAvail = Math.min(3, playerPile.length);
    const aiAvail = Math.min(3, aiPile.length);
    const count = Math.max(playerAvail, aiAvail);

    if (count === 0) {
      // Cannot wage war -- whoever has the card on the table loses
      if (playerPile.length === 0 && aiPile.length === 0) {
        // true stalemate: split evenly -- give played cards back
        resultText = 'Stalemate!';
        collectTarget = 'player';
        phase = PHASE_SHOW;
        phaseTimer = 0;
        return;
      }
      if (playerPile.length === 0) {
        collectTarget = 'ai';
      } else {
        collectTarget = 'player';
      }
      phase = PHASE_SHOW;
      phaseTimer = 0;
      return;
    }

    for (let i = 0; i < count; ++i) {
      if (playerPile.length > 0) {
        const pc = playerPile.shift();
        pc.faceUp = false;
        warFaceDown.player.push(pc);
        playerPlayed.push(pc);
      }
      if (aiPile.length > 0) {
        const ac = aiPile.shift();
        ac.faceUp = false;
        warFaceDown.ai.push(ac);
        aiPlayed.push(ac);
      }
    }

    phase = PHASE_WAR_FLIP;
    phaseTimer = 0;
  }

  function flipWarCards() {
    // Each player flips one more card face-up
    if (playerPile.length === 0 && aiPile.length === 0) {
      // Neither can flip -- compare last face-down cards flipped up
      if (warFaceDown.player.length > 0) {
        const lp = warFaceDown.player[warFaceDown.player.length - 1];
        lp.faceUp = true;
      }
      if (warFaceDown.ai.length > 0) {
        const la = warFaceDown.ai[warFaceDown.ai.length - 1];
        la.faceUp = true;
      }
      // resolve based on those
      resolveWarResult();
      return;
    }

    let pc = null;
    let ac = null;

    if (playerPile.length > 0) {
      pc = playerPile.shift();
      pc.faceUp = true;
      playerPlayed.push(pc);
      if (_host) _host.dealCardAnim(pc, PLAYER_PILE_X, PLAYER_PILE_Y, PLAYER_PLAY_X, PLAYER_PLAY_Y, 0);
    }
    if (aiPile.length > 0) {
      ac = aiPile.shift();
      ac.faceUp = true;
      aiPlayed.push(ac);
      if (_host) _host.dealCardAnim(ac, AI_PILE_X, AI_PILE_Y, AI_PLAY_X, AI_PLAY_Y, 0.05);
    }

    // If one player ran out, the other wins
    if (!pc && ac) {
      collectTarget = 'ai';
      phase = PHASE_WAR_SHOW;
      phaseTimer = 0;
      resultText = 'AI wins the war!';
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Wins War!', { color: '#f44', size: 24 });
      return;
    }
    if (pc && !ac) {
      collectTarget = 'player';
      phase = PHASE_WAR_SHOW;
      phaseTimer = 0;
      resultText = 'You win the war!';
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'You Win War!', { color: '#4f4', size: 24 });
      return;
    }

    // Both flipped -- compare
    const cmp = compareCards(pc, ac);
    if (cmp > 0) {
      collectTarget = 'player';
      resultText = 'You win the war!';
      phase = PHASE_WAR_SHOW;
      phaseTimer = 0;
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'You Win War!', { color: '#4f4', size: 24 });
    } else if (cmp < 0) {
      collectTarget = 'ai';
      resultText = 'AI wins the war!';
      phase = PHASE_WAR_SHOW;
      phaseTimer = 0;
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Wins War!', { color: '#f44', size: 24 });
    } else {
      // Another tie -- war again!
      resultText = 'DOUBLE WAR!';
      phase = PHASE_WAR_DEAL;
      phaseTimer = 0;
      warDealIndex = 0;
      warDealTimer = 0;
      warFaceDown = { player: [], ai: [] };
      ++warRound;
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'DOUBLE WAR!', { color: '#ff0', size: 36 });
    }
  }

  function resolveWarResult() {
    // Compare last face-up cards from each side among playerPlayed/aiPlayed
    const lastPlayerFaceUp = findLastFaceUp(playerPlayed);
    const lastAiFaceUp = findLastFaceUp(aiPlayed);

    if (!lastPlayerFaceUp && !lastAiFaceUp) {
      collectTarget = 'player'; // arbitrary split
    } else if (!lastPlayerFaceUp) {
      collectTarget = 'ai';
    } else if (!lastAiFaceUp) {
      collectTarget = 'player';
    } else {
      const cmp = compareCards(lastPlayerFaceUp, lastAiFaceUp);
      collectTarget = cmp >= 0 ? 'player' : 'ai';
    }

    phase = PHASE_WAR_SHOW;
    phaseTimer = 0;
    resultText = collectTarget === 'player' ? 'You win the war!' : 'AI wins the war!';
  }

  function findLastFaceUp(pile) {
    for (let i = pile.length - 1; i >= 0; --i)
      if (pile[i].faceUp) return pile[i];
    return null;
  }

  function collectCards() {
    // All played cards go to winner's pile bottom (shuffled to add randomness)
    const allCards = CE.shuffle([...playerPlayed, ...aiPlayed]);
    if (collectTarget === 'player')
      playerPile.push(...allCards);
    else
      aiPile.push(...allCards);

    playerPlayed = [];
    aiPlayed = [];
    warFaceDown = [];
    warRound = 0;

    // Update score
    score = playerPile.length;
    if (_host) _host.onScoreChanged(score);

    // Check game over
    if (playerPile.length === 0) {
      gameOver = true;
      roundOver = true;
      resultText = 'GAME OVER - AI wins!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        _host.onRoundOver(true);
      }
    } else if (aiPile.length === 0) {
      gameOver = true;
      roundOver = true;
      resultText = 'YOU WIN THE GAME!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
        _host.onRoundOver(true);
      }
    } else {
      resultText = '';
      phase = PHASE_IDLE;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupWar() {
    const deck = CE.shuffle(CE.createDeck());
    playerPile = deck.slice(0, 26);
    aiPile = deck.slice(26, 52);
    playerPlayed = [];
    aiPlayed = [];
    warFaceDown = [];
    warRound = 0;
    phase = PHASE_IDLE;
    phaseTimer = 0;
    flipAnimProgress = 0;
    collectProgress = 0;
    collectTarget = '';
    resultText = '';
    roundOver = false;
    gameOver = false;
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

  function drawWar() {
    // Title
    _ctx.save();
    _ctx.fillStyle = '#ddd';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('WAR', CANVAS_W / 2, 8);
    _ctx.restore();

    // AI pile (top center)
    drawPileWithCount(AI_PILE_X, AI_PILE_Y, aiPile.length, 'AI');

    // Player pile (bottom center)
    drawPileWithCount(PLAYER_PILE_X, PLAYER_PILE_Y, playerPile.length, 'You');

    // Draw played cards area
    drawPlayedCards();

    // Draw war face-down cards if in war phase
    if (phase >= PHASE_WAR_DEAL && warFaceDown && warFaceDown.player)
      drawWarCards();

    // Result text
    if (resultText) {
      _ctx.save();
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 20px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(resultText, CANVAS_W / 2, CANVAS_H / 2);
      _ctx.restore();
    }

    // Flip button / prompt when idle
    if (phase === PHASE_IDLE && !roundOver && !gameOver) {
      CE.drawButton(_ctx, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h, 'Flip (F)', { bg: '#2a5a2a', border: '#6c6' });
      _ctx.save();
      _ctx.fillStyle = '#aaa';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Click anywhere or press F to flip', CANVAS_W / 2, CANVAS_H / 2 + 36);
      _ctx.restore();
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

  function drawPlayedCards() {
    // Find the last face-up card in each played pile
    const lastPlayerFaceUp = findLastFaceUp(playerPlayed);
    const lastAiFaceUp = findLastFaceUp(aiPlayed);

    // During flip animation, show partial reveal
    if (phase === PHASE_FLIP) {
      const progress = Math.min(flipAnimProgress / FLIP_DURATION, 1);
      if (progress < 0.5) {
        // First half: shrink card back horizontally
        const scaleX = 1 - progress * 2;
        drawFlippingCard(PLAYER_PLAY_X, PLAYER_PLAY_Y, scaleX, null);
        drawFlippingCard(AI_PLAY_X, AI_PLAY_Y, scaleX, null);
      } else {
        // Second half: expand card face
        const scaleX = (progress - 0.5) * 2;
        if (lastPlayerFaceUp)
          drawFlippingCard(PLAYER_PLAY_X, PLAYER_PLAY_Y, scaleX, lastPlayerFaceUp);
        if (lastAiFaceUp)
          drawFlippingCard(AI_PLAY_X, AI_PLAY_Y, scaleX, lastAiFaceUp);
      }
      return;
    }

    // Static display of last face-up cards
    if (lastPlayerFaceUp)
      CE.drawCardFace(_ctx, PLAYER_PLAY_X, PLAYER_PLAY_Y, lastPlayerFaceUp);
    if (lastAiFaceUp)
      CE.drawCardFace(_ctx, AI_PLAY_X, AI_PLAY_Y, lastAiFaceUp);
  }

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

  function drawWarCards() {
    // Draw face-down war cards fanned beside the play area
    const pCount = warFaceDown.player ? warFaceDown.player.length : 0;
    const aCount = warFaceDown.ai ? warFaceDown.ai.length : 0;

    // Player war cards (spread to left of player play area)
    for (let i = 0; i < pCount; ++i) {
      const x = PLAYER_PLAY_X - (i + 1) * 30 - CE.CARD_W;
      CE.drawCardBack(_ctx, x, PLAYER_PLAY_Y);
    }

    // AI war cards (spread to left of AI play area)
    for (let i = 0; i < aCount; ++i) {
      const x = AI_PLAY_X - (i + 1) * 30 - CE.CARD_W;
      CE.drawCardBack(_ctx, x, AI_PLAY_Y);
    }

    // "WAR!" label
    if (phase >= PHASE_WAR_DEAL && phase <= PHASE_WAR_SHOW) {
      _ctx.save();
      _ctx.fillStyle = '#f00';
      _ctx.font = 'bold 28px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'middle';
      const warLabel = warRound > 1 ? 'WAR x' + warRound + '!' : 'WAR!';
      _ctx.fillText(warLabel, CANVAS_W / 2 + CE.CARD_W / 2 + 20, CANVAS_H / 2);
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
      setupWar();
      if (_host) _host.onScoreChanged(score);
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawWar();
    },

    handleClick(mx, my) {
      if (gameOver) {
        if (_host) _host.onRoundOver(true);
        return;
      }
      if (phase === PHASE_IDLE && !roundOver)
        startFlip();
    },

    handleKey(e) {
      if (gameOver) return;
      if ((e.key === 'f' || e.key === 'F' || e.key === ' ') && phase === PHASE_IDLE && !roundOver)
        startFlip();
    },

    tick(dt) {
      if (gameOver) return;

      switch (phase) {
        case PHASE_FLIP:
          flipAnimProgress += dt;
          if (flipAnimProgress >= FLIP_DURATION) {
            flipAnimProgress = FLIP_DURATION;
            resolveFlip();
          }
          break;

        case PHASE_SHOW:
          phaseTimer += dt;
          if (phaseTimer >= 1.2) {
            phase = PHASE_COLLECT;
            collectProgress = 0;
          }
          break;

        case PHASE_COLLECT:
          collectProgress += dt;
          if (collectProgress >= COLLECT_DURATION)
            collectCards();
          break;

        case PHASE_WAR_DEAL:
          phaseTimer += dt;
          if (phaseTimer >= 0.6)
            dealWarCards();
          break;

        case PHASE_WAR_FLIP:
          phaseTimer += dt;
          if (phaseTimer >= 0.8) {
            flipAnimProgress = 0;
            flipWarCards();
          }
          break;

        case PHASE_WAR_SHOW:
          phaseTimer += dt;
          if (phaseTimer >= 1.5) {
            phase = PHASE_COLLECT;
            collectProgress = 0;
          }
          break;
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      playerPile = [];
      aiPile = [];
      playerPlayed = [];
      aiPlayed = [];
      warFaceDown = [];
      warRound = 0;
      phase = PHASE_IDLE;
      phaseTimer = 0;
      flipAnimProgress = 0;
      collectProgress = 0;
      collectTarget = '';
      resultText = '';
      roundOver = false;
      gameOver = false;
      score = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('war', module);

})();
