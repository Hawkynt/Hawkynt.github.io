;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Constants ── */
  const NUM_PLAYERS = 4;
  const HUMAN = 0;
  const FACE_CHANCES = { 'A': 4, 'K': 3, 'Q': 2, 'J': 1 };

  /* ── AI reaction range (seconds) ── */
  const AI_SLAP_MIN = 0.3;
  const AI_SLAP_MAX = 1.5;
  const AI_FLIP_DELAY = 0.6;

  /* ── Layout positions ── */
  const CENTER_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const CENTER_Y = CANVAS_H / 2 - CE.CARD_H / 2 - 30;

  const PLAYER_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: CANVAS_H - CE.CARD_H - 60, labelY: CANVAS_H - 12, labelAlign: 'center', name: 'You' },
    { x: 40, y: CANVAS_H / 2 - CE.CARD_H / 2, labelY: CANVAS_H / 2 + CE.CARD_H / 2 + 16, labelAlign: 'center', name: 'West' },
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 40, labelY: 28, labelAlign: 'center', name: 'North' },
    { x: CANVAS_W - CE.CARD_W - 40, y: CANVAS_H / 2 - CE.CARD_H / 2, labelY: CANVAS_H / 2 + CE.CARD_H / 2 + 16, labelAlign: 'center', name: 'East' }
  ];

  const SLAP_BTN = { x: CANVAS_W / 2 - 70, y: CENTER_Y + CE.CARD_H + 18, w: 140, h: 44 };
  const FLIP_BTN = { x: CANVAS_W / 2 - 50, y: SLAP_BTN.y + SLAP_BTN.h + 10, w: 100, h: 32 };

  /* ── Game state ── */
  let playerPiles = [];
  let centerPile = [];
  let eliminated = [];
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';

  /* ── Turn state ── */
  let currentTurn = 0;
  let faceChallenge = false;
  let challengeChances = 0;
  let challengePlayer = -1;
  let challengeBeneficiary = -1;

  /* ── Phase & timing ── */
  const PHASE_IDLE = 0;
  const PHASE_FLIPPING = 1;
  const PHASE_FACE_CHALLENGE = 2;
  const PHASE_SLAP_WINDOW = 3;
  const PHASE_COLLECTING = 4;
  const PHASE_PAUSE = 5;

  let phase = PHASE_IDLE;
  let phaseTimer = 0;

  /* ── Slap state ── */
  let slapPattern = '';
  let slapWinner = -1;
  let aiSlapTimers = [];
  let aiSlapTargets = [];
  let slapFlashTimer = 0;
  let slapFlashColor = '';
  let slapPulsePhase = 0;

  /* ── AI flip timer ── */
  let aiFlipTimer = 0;

  /* ── Collect animation ── */
  let collectTarget = -1;
  let collectTimer = 0;
  const COLLECT_DURATION = 0.5;

  /* ── Feedback ── */
  let feedbackText = '';
  let feedbackTimer = 0;
  const FEEDBACK_DURATION = 1.5;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ══════════════════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function isFaceCard(card) {
    return FACE_CHANCES[card.rank] !== undefined;
  }

  function nextActivePlayer(from) {
    let p = (from + 1) % NUM_PLAYERS;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (!eliminated[p] || playerPiles[p].length > 0) return p;
      p = (p + 1) % NUM_PLAYERS;
    }
    return -1;
  }

  function countActivePlayers() {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (playerPiles[i].length > 0) ++count;
    return count;
  }

  function isHumanAlive() {
    return playerPiles[HUMAN].length > 0 || !eliminated[HUMAN];
  }

  /* ══════════════════════════════════════════════════════════════════
     SLAP PATTERN DETECTION
     ══════════════════════════════════════════════════════════════════ */

  function detectSlapPattern() {
    if (centerPile.length < 2) return '';

    const top = centerPile[centerPile.length - 1];
    const second = centerPile[centerPile.length - 2];

    // Doubles
    if (top.rank === second.rank) return 'Doubles';

    // Sandwich
    if (centerPile.length >= 3) {
      const third = centerPile[centerPile.length - 3];
      if (top.rank === third.rank) return 'Sandwich';
    }

    // Top-Bottom
    if (centerPile.length >= 3) {
      const bottom = centerPile[0];
      if (top.rank === bottom.rank) return 'Top-Bottom';
    }

    return '';
  }

  /* ══════════════════════════════════════════════════════════════════
     FLIP A CARD
     ══════════════════════════════════════════════════════════════════ */

  function flipCard(player) {
    if (playerPiles[player].length === 0) return null;
    const card = playerPiles[player].shift();
    card.faceUp = true;
    centerPile.push(card);

    const pos = PLAYER_POSITIONS[player];
    if (_host)
      _host.dealCardAnim(card, pos.x, pos.y, CENTER_X, CENTER_Y, 0);

    return card;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME FLOW
     ══════════════════════════════════════════════════════════════════ */

  function doFlip(player) {
    const card = flipCard(player);
    if (!card) {
      advanceTurnOrEliminate(player);
      return;
    }

    // Check for face card challenge
    if (isFaceCard(card)) {
      faceChallenge = true;
      challengeChances = FACE_CHANCES[card.rank];
      challengeBeneficiary = player;
      challengePlayer = nextActivePlayer(player);
      if (challengePlayer < 0) {
        endRound(player);
        return;
      }
      phase = PHASE_FACE_CHALLENGE;
      phaseTimer = 0;
      aiFlipTimer = 0;
      return;
    }

    // If inside a face challenge, decrement chances
    if (faceChallenge) {
      --challengeChances;
      if (challengeChances <= 0) {
        // Challenge failed -- beneficiary wins the pile
        startCollect(challengeBeneficiary, 'Challenge won!');
        faceChallenge = false;
        return;
      }
      // Still in challenge, same player must flip again
      phase = PHASE_FACE_CHALLENGE;
      phaseTimer = 0;
      aiFlipTimer = 0;
      return;
    }

    // Normal flip -- check for slap patterns
    const pattern = detectSlapPattern();
    if (pattern) {
      slapPattern = pattern;
      openSlapWindow();
      return;
    }

    // No pattern, advance turn
    currentTurn = nextActivePlayer(player);
    if (currentTurn < 0) {
      endRound(player);
      return;
    }
    phase = PHASE_IDLE;
    phaseTimer = 0;
    aiFlipTimer = 0;
  }

  function advanceTurnOrEliminate(player) {
    eliminated[player] = true;
    if (countActivePlayers() <= 1) {
      for (let i = 0; i < NUM_PLAYERS; ++i)
        if (playerPiles[i].length > 0) { endRound(i); return; }
      endRound(-1);
      return;
    }
    currentTurn = nextActivePlayer(player);
    phase = PHASE_IDLE;
    phaseTimer = 0;
    aiFlipTimer = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     SLAP WINDOW
     ══════════════════════════════════════════════════════════════════ */

  function openSlapWindow() {
    phase = PHASE_SLAP_WINDOW;
    phaseTimer = 0;
    slapWinner = -1;
    slapPulsePhase = 0;

    // Schedule AI slap attempts
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (i === HUMAN) { aiSlapTimers[i] = Infinity; continue; }
      if (eliminated[i] && playerPiles[i].length === 0) { aiSlapTimers[i] = Infinity; continue; }
      aiSlapTimers[i] = AI_SLAP_MIN + Math.random() * (AI_SLAP_MAX - AI_SLAP_MIN);
      aiSlapTargets[i] = true;
    }
  }

  function executeSlap(player) {
    if (phase !== PHASE_SLAP_WINDOW && phase !== PHASE_FACE_CHALLENGE && phase !== PHASE_IDLE) return;

    const pattern = detectSlapPattern();
    if (pattern) {
      // Valid slap
      slapWinner = player;
      slapFlashColor = '#0f0';
      slapFlashTimer = 0.6;
      faceChallenge = false;

      const name = player === HUMAN ? 'You' : PLAYER_POSITIONS[player].name;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CENTER_Y, name + ' slapped! (' + pattern + ')', { color: '#4f4', size: 22 });
        _host.particles.sparkle(CANVAS_W / 2, CENTER_Y + CE.CARD_H / 2, 15, {});
      }
      startCollect(player, pattern + '!');
    } else {
      // False slap -- penalty
      slapFlashColor = '#f00';
      slapFlashTimer = 0.5;

      if (playerPiles[player].length > 0) {
        const penalty = playerPiles[player].shift();
        penalty.faceUp = false;
        centerPile.unshift(penalty);
      }

      const name = player === HUMAN ? 'You' : PLAYER_POSITIONS[player].name;
      showFeedback(name + ': False slap! -1 card');
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, SLAP_BTN.y + SLAP_BTN.h + 4, 'False slap!', { color: '#f44', size: 18 });

      updateScore();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     COLLECT PILE
     ══════════════════════════════════════════════════════════════════ */

  function startCollect(player, reason) {
    collectTarget = player;
    collectTimer = 0;
    phase = PHASE_COLLECTING;
    showFeedback((player === HUMAN ? 'You' : PLAYER_POSITIONS[player].name) + ' win the pile! ' + reason);
  }

  function finishCollect() {
    if (collectTarget < 0) { phase = PHASE_IDLE; return; }

    const cards = CE.shuffle(centerPile.splice(0, centerPile.length));
    for (const c of cards) {
      c.faceUp = false;
      playerPiles[collectTarget].push(c);
    }

    // Un-eliminate if they slapped back in
    if (eliminated[collectTarget] && playerPiles[collectTarget].length > 0)
      eliminated[collectTarget] = false;

    slapPattern = '';
    faceChallenge = false;
    currentTurn = collectTarget;
    updateScore();

    if (checkGameOver()) return;

    phase = PHASE_PAUSE;
    phaseTimer = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     SCORE & GAME OVER
     ══════════════════════════════════════════════════════════════════ */

  function updateScore() {
    score = playerPiles[HUMAN].length;
    if (_host) _host.onScoreChanged(score);
  }

  function checkGameOver() {
    // Check if one player has all 52 cards
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (playerPiles[i].length === 52) {
        endRound(i);
        return true;
      }
    }

    // Check if only one player remains
    const active = [];
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (playerPiles[i].length > 0) active.push(i);

    if (active.length <= 1 && centerPile.length === 0) {
      endRound(active.length === 1 ? active[0] : -1);
      return true;
    }

    return false;
  }

  function endRound(winner) {
    roundOver = true;
    gameOver = true;
    if (winner === HUMAN) {
      resultMsg = 'YOU WIN! All 52 cards!';
      score = playerPiles[HUMAN].length + 100;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
        _host.onScoreChanged(score);
        _host.onRoundOver(true);
      }
    } else if (winner >= 0) {
      resultMsg = PLAYER_POSITIONS[winner].name + ' wins the game!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        _host.onRoundOver(true);
      }
    } else {
      resultMsg = 'Draw!';
      if (_host) _host.onRoundOver(true);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     FEEDBACK
     ══════════════════════════════════════════════════════════════════ */

  function showFeedback(text) {
    feedbackText = text;
    feedbackTimer = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupGame() {
    const deck = CE.shuffle(CE.createDeck());
    playerPiles = [[], [], [], []];
    eliminated = [false, false, false, false];
    centerPile = [];

    // Deal 13 cards each
    for (let i = 0; i < 52; ++i)
      playerPiles[i % NUM_PLAYERS].push(deck[i]);

    currentTurn = 0;
    faceChallenge = false;
    challengeChances = 0;
    challengePlayer = -1;
    challengeBeneficiary = -1;
    phase = PHASE_IDLE;
    phaseTimer = 0;
    aiFlipTimer = 0;
    slapPattern = '';
    slapWinner = -1;
    aiSlapTimers = [Infinity, Infinity, Infinity, Infinity];
    aiSlapTargets = [false, false, false, false];
    slapFlashTimer = 0;
    slapFlashColor = '';
    slapPulsePhase = 0;
    collectTarget = -1;
    collectTimer = 0;
    feedbackText = '';
    feedbackTimer = 0;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    score = 13;

    // Deal animation
    if (_host) {
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        const pos = PLAYER_POSITIONS[p];
        for (let i = 0; i < Math.min(3, playerPiles[p].length); ++i)
          _host.dealCardAnim(playerPiles[p][i], CANVAS_W / 2, CANVAS_H / 2, pos.x, pos.y, (p * 3 + i) * 0.06);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function drawPileWithCount(x, y, count, label, labelY, active) {
    if (count > 0) {
      const layers = Math.min(count, 3);
      for (let i = 0; i < layers - 1; ++i)
        CE.drawCardBack(_ctx, x + i * 2, y + i * 2);
      CE.drawCardBack(_ctx, x + (layers - 1) * 2, y + (layers - 1) * 2);
    } else {
      _ctx.save();
      _ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.restore();
    }

    _ctx.save();
    _ctx.fillStyle = active ? '#ff0' : '#ccc';
    _ctx.font = active ? 'bold 13px sans-serif' : '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(label + ' (' + count + ')', x + CE.CARD_W / 2, labelY);
    _ctx.restore();
  }

  function drawTurnIndicator(playerIndex) {
    if (roundOver || gameOver) return;
    const pos = PLAYER_POSITIONS[playerIndex];
    const cx = pos.x + CE.CARD_W / 2;
    const cy = pos.y + CE.CARD_H / 2;

    _ctx.save();
    _ctx.strokeStyle = '#ff0';
    _ctx.lineWidth = 3;
    _ctx.shadowColor = '#ff0';
    _ctx.shadowBlur = 10;
    CE.drawRoundedRect(_ctx, pos.x - 4, pos.y - 4, CE.CARD_W + 8, CE.CARD_H + 8, CE.CARD_RADIUS + 2);
    _ctx.stroke();
    _ctx.restore();
  }

  function drawCenterPile() {
    if (centerPile.length === 0) {
      CE.drawEmptySlot(_ctx, CENTER_X, CENTER_Y, 'Pile');
      return;
    }

    // Draw up to 3 cards spread slightly
    const showCount = Math.min(centerPile.length, 3);
    const startIdx = centerPile.length - showCount;
    for (let i = 0; i < showCount; ++i) {
      const card = centerPile[startIdx + i];
      const offsetX = (i - 1) * 14;
      const offsetY = (i - 1) * 4;
      CE.drawCardFace(_ctx, CENTER_X + offsetX, CENTER_Y + offsetY, card);
    }

    // Pile count
    _ctx.save();
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Pile: ' + centerPile.length, CANVAS_W / 2, CENTER_Y - 10);
    _ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     MAIN DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawGame() {
    /* ── Title ── */
    _ctx.save();
    _ctx.fillStyle = '#ddd';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('EGYPTIAN RAT SCREW', CANVAS_W / 2, 6);
    _ctx.restore();

    /* ── Player piles ── */
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const pos = PLAYER_POSITIONS[i];
      const isActive = !eliminated[i] || playerPiles[i].length > 0;
      const isTurn = getCurrentFlipPlayer() === i && !roundOver && !gameOver;
      drawPileWithCount(pos.x, pos.y, playerPiles[i].length, pos.name, pos.labelY, isTurn);

      if (isTurn)
        drawTurnIndicator(i);

      // Eliminated marker
      if (eliminated[i] && playerPiles[i].length === 0) {
        _ctx.save();
        _ctx.fillStyle = 'rgba(255,0,0,0.5)';
        _ctx.font = 'bold 14px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.fillText('OUT', pos.x + CE.CARD_W / 2, pos.y + CE.CARD_H / 2);
        _ctx.restore();
      }
    }

    /* ── Center pile ── */
    drawCenterPile();

    /* ── Slap flash overlay ── */
    if (slapFlashTimer > 0) {
      const alpha = slapFlashTimer * 1.5;
      _ctx.save();
      _ctx.fillStyle = slapFlashColor;
      _ctx.globalAlpha = Math.min(alpha, 0.35);
      _ctx.fillRect(CENTER_X - 20, CENTER_Y - 20, CE.CARD_W + 40, CE.CARD_H + 40);
      _ctx.restore();
    }

    /* ── Face challenge info ── */
    if (faceChallenge && (phase === PHASE_FACE_CHALLENGE || phase === PHASE_IDLE)) {
      const name = challengePlayer === HUMAN ? 'You' : PLAYER_POSITIONS[challengePlayer].name;
      _ctx.save();
      _ctx.fillStyle = '#fa0';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Challenge: ' + name + ' must play a face card (' + challengeChances + ' chance' + (challengeChances > 1 ? 's' : '') + ' left)', CANVAS_W / 2, CENTER_Y + CE.CARD_H + 8);
      _ctx.restore();
    }

    /* ── SLAP button ── */
    if (isHumanAlive() && !roundOver && !gameOver && phase !== PHASE_COLLECTING) {
      const pulse = 1 + 0.06 * Math.sin(slapPulsePhase * 8);
      const hasPattern = detectSlapPattern() !== '';
      const bw = SLAP_BTN.w * (hasPattern ? pulse : 1);
      const bh = SLAP_BTN.h * (hasPattern ? pulse : 1);
      const bx = SLAP_BTN.x + (SLAP_BTN.w - bw) / 2;
      const by = SLAP_BTN.y + (SLAP_BTN.h - bh) / 2;

      _ctx.save();
      if (hasPattern) {
        _ctx.shadowColor = '#f00';
        _ctx.shadowBlur = 14 + 6 * Math.sin(slapPulsePhase * 8);
      }
      CE.drawButton(_ctx, bx, by, bw, bh, 'SLAP! (Space)', {
        bg: hasPattern ? '#c00' : '#600',
        border: hasPattern ? '#f44' : '#844',
        textColor: '#fff',
        fontSize: 18
      });
      _ctx.restore();
    }

    /* ── FLIP button (human turn) ── */
    if (getCurrentFlipPlayer() === HUMAN && !roundOver && !gameOver && phase !== PHASE_COLLECTING && phase !== PHASE_SLAP_WINDOW && playerPiles[HUMAN].length > 0) {
      CE.drawButton(_ctx, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h, 'Flip (F)', {
        bg: '#2a5a2a', border: '#6c6', textColor: '#fff', fontSize: 14
      });
    }

    /* ── Feedback text ── */
    if (feedbackTimer < FEEDBACK_DURATION && feedbackText) {
      const alpha = 1 - feedbackTimer / FEEDBACK_DURATION;
      _ctx.save();
      _ctx.globalAlpha = alpha;
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(feedbackText, CANVAS_W / 2, FLIP_BTN.y + FLIP_BTN.h + 16);
      _ctx.restore();
    }

    /* ── Score / card ratio bar ── */
    const barW = 200;
    const barH = 6;
    const barX = CANVAS_W / 2 - barW / 2;
    const barY = CANVAS_H - 6;
    _ctx.fillStyle = '#222';
    _ctx.fillRect(barX, barY, barW, barH);
    const colors = ['#4a4', '#48a', '#a84', '#a48'];
    let offset = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const ratio = playerPiles[i].length / 52;
      _ctx.fillStyle = colors[i];
      _ctx.fillRect(barX + offset, barY, barW * ratio, barH);
      offset += barW * ratio;
    }

    /* ── Score display ── */
    _ctx.save();
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Cards: ' + playerPiles[HUMAN].length, 16, CANVAS_H - 16);
    _ctx.restore();

    /* ── Instructions ── */
    if (!roundOver && !gameOver) {
      _ctx.save();
      _ctx.fillStyle = '#666';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'right';
      _ctx.fillText('Slap on: Doubles, Sandwich, Top-Bottom', CANVAS_W - 16, CANVAS_H - 16);
      _ctx.restore();
    }

    /* ── Game over overlay ── */
    if (roundOver || gameOver) {
      _ctx.save();
      _ctx.fillStyle = 'rgba(0,0,0,0.55)';
      _ctx.fillRect(0, CANVAS_H / 2 - 44, CANVAS_W, 88);
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
     TURN LOGIC HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function getCurrentFlipPlayer() {
    if (faceChallenge) return challengePlayer;
    return currentTurn;
  }

  /* ══════════════════════════════════════════════════════════════════
     HUMAN ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function humanFlip() {
    if (roundOver || gameOver) return;
    if (phase === PHASE_COLLECTING || phase === PHASE_PAUSE) return;

    const flipPlayer = getCurrentFlipPlayer();
    if (flipPlayer !== HUMAN) return;
    if (playerPiles[HUMAN].length === 0) return;

    phase = PHASE_FLIPPING;
    phaseTimer = 0;
    doFlip(HUMAN);
  }

  function humanSlap() {
    if (roundOver || gameOver) return;
    if (phase === PHASE_COLLECTING) return;
    if (centerPile.length === 0) return;
    if (!isHumanAlive() && playerPiles[HUMAN].length === 0) return;

    executeSlap(HUMAN);
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = 13;
      setupGame();
      if (_host) _host.onScoreChanged(score);
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawGame();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(true);
        return;
      }

      // SLAP button
      if (CE.isInRect(mx, my, SLAP_BTN.x - 10, SLAP_BTN.y - 10, SLAP_BTN.w + 20, SLAP_BTN.h + 20)) {
        humanSlap();
        return;
      }

      // FLIP button
      if (CE.isInRect(mx, my, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h)) {
        humanFlip();
        return;
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey(e) {
      if (roundOver || gameOver) return;

      if (e.key === ' ' || e.key === 'Spacebar') {
        humanSlap();
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        humanFlip();
        return;
      }
    },

    tick(dt) {
      if (roundOver || gameOver) return;

      // Update feedback timer
      if (feedbackTimer < FEEDBACK_DURATION)
        feedbackTimer += dt;

      // Slap flash decay
      if (slapFlashTimer > 0)
        slapFlashTimer -= dt;

      // Slap pulse animation
      slapPulsePhase += dt;

      switch (phase) {
        case PHASE_IDLE: {
          const flipPlayer = getCurrentFlipPlayer();
          if (flipPlayer === HUMAN) break;

          // AI turn to flip
          aiFlipTimer += dt;
          if (aiFlipTimer >= AI_FLIP_DELAY) {
            aiFlipTimer = 0;
            if (playerPiles[flipPlayer].length > 0) {
              phase = PHASE_FLIPPING;
              doFlip(flipPlayer);
            } else
              advanceTurnOrEliminate(flipPlayer);
          }
          break;
        }

        case PHASE_FACE_CHALLENGE: {
          if (challengePlayer === HUMAN) break;

          // AI responds to face challenge
          aiFlipTimer += dt;
          if (aiFlipTimer >= AI_FLIP_DELAY) {
            aiFlipTimer = 0;
            if (playerPiles[challengePlayer].length > 0)
              doFlip(challengePlayer);
            else {
              // Can't respond, beneficiary wins
              startCollect(challengeBeneficiary, 'No cards to answer!');
              faceChallenge = false;
            }
          }
          break;
        }

        case PHASE_SLAP_WINDOW: {
          phaseTimer += dt;

          // Check AI slap attempts
          for (let i = 0; i < NUM_PLAYERS; ++i) {
            if (i === HUMAN) continue;
            if (aiSlapTimers[i] === Infinity) continue;
            if (phaseTimer >= aiSlapTimers[i] && aiSlapTargets[i]) {
              aiSlapTargets[i] = false;
              executeSlap(i);
              if (phase !== PHASE_SLAP_WINDOW) return;
            }
          }

          // Slap window expires after 2 seconds
          if (phaseTimer >= 2.0) {
            // No one slapped, continue play
            slapPattern = '';
            if (faceChallenge) {
              phase = PHASE_FACE_CHALLENGE;
              phaseTimer = 0;
              aiFlipTimer = 0;
            } else {
              currentTurn = nextActivePlayer(currentTurn);
              phase = PHASE_IDLE;
              phaseTimer = 0;
              aiFlipTimer = 0;
            }
          }
          break;
        }

        case PHASE_COLLECTING:
          collectTimer += dt;
          if (collectTimer >= COLLECT_DURATION)
            finishCollect();
          break;

        case PHASE_PAUSE:
          phaseTimer += dt;
          if (phaseTimer >= 0.4) {
            phase = PHASE_IDLE;
            phaseTimer = 0;
            aiFlipTimer = 0;
          }
          break;
      }
    },

    cleanup() {
      playerPiles = [];
      centerPile = [];
      eliminated = [];
      currentTurn = 0;
      faceChallenge = false;
      challengeChances = 0;
      challengePlayer = -1;
      challengeBeneficiary = -1;
      phase = PHASE_IDLE;
      phaseTimer = 0;
      aiFlipTimer = 0;
      slapPattern = '';
      slapWinner = -1;
      aiSlapTimers = [];
      aiSlapTargets = [];
      slapFlashTimer = 0;
      slapFlashColor = '';
      slapPulsePhase = 0;
      collectTarget = -1;
      collectTimer = 0;
      feedbackText = '';
      feedbackTimer = 0;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      score = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('ratscrew', module);

})();
