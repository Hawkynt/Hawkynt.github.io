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

  const RANKS = CE.RANKS; // ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3'];

  /* Phases */
  const PHASE_PLAYER_TURN = 0;
  const PHASE_CHALLENGE_WINDOW = 1;
  const PHASE_AI_TURN = 2;
  const PHASE_RESOLVING = 3;
  const PHASE_GAME_OVER = 4;

  const CHALLENGE_WINDOW_DURATION = 2.5;
  const AI_TURN_DELAY = 1.2;
  const RESOLVE_DELAY = 2.0;

  /* Layout */
  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 28;
  const AI1_HAND_Y = 12;
  const AI2_HAND_X = 12;
  const AI3_HAND_X = CANVAS_W - CE.CARD_W * 0.5 - 12;

  const PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PILE_Y = CANVAS_H / 2 - CE.CARD_H / 2 - 10;

  const PLAY_BTN = { x: CANVAS_W / 2 + 80, y: CANVAS_H - 42, w: 90, h: 32 };
  const CHEAT_BTN = { x: CANVAS_W / 2 - 55, y: CANVAS_H / 2 + 60, w: 110, h: 36 };

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let discardPile = [];
  let currentPlayer = 0;
  let requiredRankIdx = 0;
  let phase = PHASE_PLAYER_TURN;
  let selectedIndices = [];

  let lastPlayInfo = null; // { player, count, claimedRank, actualCards }
  let challengeTimer = 0;
  let aiTurnTimer = 0;
  let resolveTimer = 0;
  let resolveMessage = '';
  let resolveColor = '#fff';

  let score = 0;
  let roundOver = false;
  let gameOver = false;

  let message = '';
  let messageColor = '#fff';
  let messageTimer = 0;
  const MESSAGE_FADE = 3.5;

  let hoverCardIdx = -1;

  let _ctx = null;
  let _host = null;

  /* ================================================================
     HELPERS
     ================================================================ */

  function requiredRank() {
    return RANKS[requiredRankIdx % 13];
  }

  function advanceRank() {
    requiredRankIdx = (requiredRankIdx + 1) % 13;
  }

  function nextPlayer(p) {
    return (p + 1) % NUM_PLAYERS;
  }

  function setMessage(msg, color) {
    message = msg;
    messageColor = color || '#fff';
    messageTimer = MESSAGE_FADE;
  }

  function sortHand(hand) {
    const rankOrder = {};
    for (let i = 0; i < RANKS.length; ++i)
      rankOrder[RANKS[i]] = i;
    const suitOrder = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };
    hand.sort((a, b) => {
      const rd = rankOrder[a.rank] - rankOrder[b.rank];
      if (rd !== 0) return rd;
      return (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
    });
  }

  function countRankInHand(hand, rank) {
    let n = 0;
    for (const c of hand)
      if (c.rank === rank) ++n;
    return n;
  }

  function cardsAllMatch(cards, rank) {
    for (const c of cards)
      if (c.rank !== rank) return false;
    return true;
  }

  /* ================================================================
     DEAL
     ================================================================ */

  function deal() {
    const deck = CE.shuffle(CE.createDeck());
    hands = [[], [], [], []];
    discardPile = [];
    selectedIndices = [];
    currentPlayer = 0;
    requiredRankIdx = 0;
    phase = PHASE_PLAYER_TURN;
    lastPlayInfo = null;
    challengeTimer = 0;
    aiTurnTimer = 0;
    resolveTimer = 0;
    resolveMessage = '';
    resolveColor = '#fff';
    roundOver = false;
    gameOver = false;
    message = '';
    messageTimer = 0;
    hoverCardIdx = -1;

    for (let i = 0; i < deck.length; ++i) {
      deck[i].faceUp = true;
      hands[i % NUM_PLAYERS].push(deck[i]);
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), PLAYER_HAND_Y, i * 0.04);
    }

    setMessage('Your turn! Play cards as ' + requiredRank(), '#8f8');
  }

  /* ================================================================
     PLAY CARDS
     ================================================================ */

  function playCards(playerIdx, cardIndices) {
    const sorted = cardIndices.slice().sort((a, b) => b - a);
    const actualCards = [];
    for (const idx of sorted)
      actualCards.push(hands[playerIdx].splice(idx, 1)[0]);

    const claimedRank = requiredRank();
    for (const c of actualCards)
      discardPile.push(c);

    lastPlayInfo = {
      player: playerIdx,
      count: actualCards.length,
      claimedRank,
      actualCards
    };

    const name = PLAYER_NAMES[playerIdx];
    setMessage(name + ' plays ' + actualCards.length + ' card(s) as ' + claimedRank, '#ff0');

    if (_host)
      _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, name + ': ' + actualCards.length + 'x ' + claimedRank, { color: '#ff0', size: 16 });

    advanceRank();

    // Check if this player won
    if (hands[playerIdx].length === 0) {
      endGame(playerIdx);
      return;
    }

    // Enter challenge window
    phase = PHASE_CHALLENGE_WINDOW;
    challengeTimer = CHALLENGE_WINDOW_DURATION;
  }

  /* ================================================================
     CHALLENGE RESOLUTION
     ================================================================ */

  function resolveChallenge(challengerIdx) {
    if (!lastPlayInfo) return;

    const honest = cardsAllMatch(lastPlayInfo.actualCards, lastPlayInfo.claimedRank);
    const challengerName = PLAYER_NAMES[challengerIdx];
    const playerName = PLAYER_NAMES[lastPlayInfo.player];

    phase = PHASE_RESOLVING;

    if (honest) {
      // Challenger picks up pile -- play was honest
      resolveMessage = challengerName + ' challenged but ' + playerName + ' was honest! ' + challengerName + ' picks up ' + discardPile.length + ' cards!';
      resolveColor = '#f88';
      const pile = discardPile.splice(0, discardPile.length);
      for (const c of pile) {
        c.faceUp = true;
        hands[challengerIdx].push(c);
      }
      sortHand(hands[challengerIdx]);

      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Honest! ' + challengerName + ' takes pile!', { color: '#f88', size: 18 });
        if (challengerIdx === 0)
          _host.screenShake.trigger(6, 300);
      }
    } else {
      // Cheater picks up pile
      const cheaterIdx = lastPlayInfo.player;
      const cheaterName = PLAYER_NAMES[cheaterIdx];
      resolveMessage = challengerName + ' caught ' + cheaterName + ' cheating! ' + cheaterName + ' picks up ' + discardPile.length + ' cards!';
      resolveColor = '#8f8';
      const pile = discardPile.splice(0, discardPile.length);
      for (const c of pile) {
        c.faceUp = true;
        hands[cheaterIdx].push(c);
      }
      sortHand(hands[cheaterIdx]);

      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Caught cheating! ' + cheaterName + ' takes pile!', { color: '#8f8', size: 18 });
        if (cheaterIdx === 0)
          _host.screenShake.trigger(6, 300);
      }
    }

    resolveTimer = RESOLVE_DELAY;
    lastPlayInfo = null;
  }

  function afterResolve() {
    // Check for any empty-hand win
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (hands[p].length === 0) {
        endGame(p);
        return;
      }
    }

    // Next player's turn
    currentPlayer = nextPlayer(currentPlayer);
    startTurn();
  }

  function skipChallenge() {
    if (!lastPlayInfo) return;

    // No challenge -- move to next player
    lastPlayInfo = null;
    currentPlayer = nextPlayer(currentPlayer);
    startTurn();
  }

  /* ================================================================
     TURN MANAGEMENT
     ================================================================ */

  function startTurn() {
    selectedIndices = [];
    hoverCardIdx = -1;

    if (hands[currentPlayer].length === 0) {
      endGame(currentPlayer);
      return;
    }

    if (currentPlayer === 0) {
      phase = PHASE_PLAYER_TURN;
      setMessage('Your turn! Play cards as ' + requiredRank(), '#8f8');
    } else {
      phase = PHASE_AI_TURN;
      aiTurnTimer = AI_TURN_DELAY;
    }
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiPlayTurn(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return;

    const rank = requiredRank();
    const matchingIndices = [];
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].rank === rank) matchingIndices.push(i);

    let chosen;

    if (matchingIndices.length > 0) {
      // Play honestly: all matching cards
      chosen = matchingIndices.slice();
    } else {
      // Must bluff: pick 1-2 random cards
      const bluffCount = Math.min(hand.length, 1 + (Math.random() < 0.3 ? 1 : 0));
      const indices = [];
      for (let i = 0; i < hand.length; ++i) indices.push(i);
      CE.shuffle(indices);
      chosen = indices.slice(0, bluffCount);
    }

    playCards(playerIdx, chosen);
  }

  function aiDecideChallenge(aiIdx) {
    if (!lastPlayInfo) return false;

    const pileSize = discardPile.length;
    const cardsPlayed = lastPlayInfo.count;
    const claimedRank = lastPlayInfo.claimedRank;

    // AI knows its own hand -- count how many of the claimed rank it holds
    const ownCount = countRankInHand(hands[aiIdx], claimedRank);

    // If AI holds all 4, the claim must be a lie
    if (ownCount === 4) return true;

    // If AI holds 3 and player claims 2+, impossible
    if (ownCount >= 3 && cardsPlayed >= 2) return true;

    // Base probability
    let prob = 0.20;
    // More likely with large pile
    if (pileSize > 4)
      prob += 0.05 * (pileSize - 4);
    // More suspicious when claiming 3-4 cards
    if (cardsPlayed >= 3)
      prob += 0.15;
    // Slightly suspicious when claiming many with few cards of that rank possible
    if (ownCount + cardsPlayed > 4)
      return true; // impossible claim

    // Cap probability
    prob = Math.min(prob, 0.80);

    return Math.random() < prob;
  }

  /* ================================================================
     GAME END
     ================================================================ */

  function endGame(winnerIdx) {
    phase = PHASE_GAME_OVER;
    roundOver = true;

    if (winnerIdx === 0) {
      score = 100;
      setMessage('You win! Congratulations!', '#4f4');
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 28 });
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 30);
      }
    } else {
      score = 0;
      setMessage(PLAYER_NAMES[winnerIdx] + ' wins!', '#f88');
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, PLAYER_NAMES[winnerIdx] + ' WINS!', { color: '#f88', size: 28 });
        _host.screenShake.trigger(8, 400);
      }
    }

    if (_host) {
      _host.onScoreChanged(score);
      _host.onRoundOver(true);
    }
  }

  /* ================================================================
     LAYOUT HELPERS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 700;
    const spacing = total > 1 ? Math.min(50, maxWidth / (total - 1)) : 0;
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return startX + idx * spacing;
  }

  // AI 1: top center (face-down, horizontal fan)
  function ai1CardX(idx, total) {
    const maxWidth = 500;
    const sw = CE.CARD_W * 0.5;
    const spacing = total > 1 ? Math.min(25, maxWidth / (total - 1)) : 0;
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - sw / 2;
    return startX + idx * spacing;
  }

  // AI 2: left side (face-down, vertical fan)
  function ai2CardY(idx, total) {
    const maxHeight = 380;
    const sh = CE.CARD_H * 0.5;
    const spacing = total > 1 ? Math.min(22, maxHeight / (total - 1)) : 0;
    const fanHeight = (total - 1) * spacing;
    const startY = (CANVAS_H - fanHeight) / 2 - sh / 2;
    return startY + idx * spacing;
  }

  // AI 3: right side (face-down, vertical fan)
  function ai3CardY(idx, total) {
    return ai2CardY(idx, total);
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
      if (selectedIndices.includes(i)) cy -= 15;

      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawCheat() {
    drawTurnInfo();
    drawAI1Hand();
    drawAI2Hand();
    drawAI3Hand();
    drawDiscardPile();
    drawRequiredRank();
    drawPlayerHand();
    drawButtons();
    drawMessageArea();
    drawResolveOverlay();
    drawScoreArea();

    if (phase === PHASE_GAME_OVER)
      drawGameOverUI();
  }

  function drawTurnInfo() {
    const name = PLAYER_NAMES[currentPlayer];
    const turnColor = currentPlayer === 0 ? '#8f8' : '#fa0';

    _ctx.fillStyle = turnColor;
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';

    let phaseLabel = '';
    if (phase === PHASE_PLAYER_TURN) phaseLabel = 'Your Turn';
    else if (phase === PHASE_AI_TURN) phaseLabel = name + '\'s Turn';
    else if (phase === PHASE_CHALLENGE_WINDOW) phaseLabel = 'Challenge Window';
    else if (phase === PHASE_RESOLVING) phaseLabel = 'Resolving...';
    else if (phase === PHASE_GAME_OVER) phaseLabel = 'Game Over';

    _ctx.fillText(phaseLabel, 10, 10);

    // Card counts
    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#aaa';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const label = PLAYER_NAMES[p] + ': ' + hands[p].length;
      _ctx.fillText(label, 10, 28 + p * 14);
    }
  }

  function drawScoreArea() {
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Pile: ' + discardPile.length, 10, 90);
  }

  function drawAI1Hand() {
    const hand = hands[1];
    const total = hand.length;
    const sw = CE.CARD_W * 0.5;
    const sh = CE.CARD_H * 0.5;

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('AI 1 (' + total + ')', CANVAS_W / 2, AI1_HAND_Y - 1);

    for (let i = 0; i < total; ++i)
      CE.drawCardBack(_ctx, ai1CardX(i, total), AI1_HAND_Y, sw, sh);
  }

  function drawAI2Hand() {
    const hand = hands[2];
    const total = hand.length;
    const sw = CE.CARD_W * 0.5;
    const sh = CE.CARD_H * 0.5;

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('AI 2 (' + total + ')', AI2_HAND_X + sw / 2, ai2CardY(0, total) - 4);

    for (let i = 0; i < total; ++i)
      CE.drawCardBack(_ctx, AI2_HAND_X, ai2CardY(i, total), sw, sh);
  }

  function drawAI3Hand() {
    const hand = hands[3];
    const total = hand.length;
    const sw = CE.CARD_W * 0.5;
    const sh = CE.CARD_H * 0.5;

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('AI 3 (' + total + ')', AI3_HAND_X + sw / 2, ai3CardY(0, total) - 4);

    for (let i = 0; i < total; ++i)
      CE.drawCardBack(_ctx, AI3_HAND_X, ai3CardY(i, total), sw, sh);
  }

  function drawDiscardPile() {
    if (discardPile.length === 0) {
      CE.drawEmptySlot(_ctx, PILE_X, PILE_Y, 'Pile');
      return;
    }

    // Stack effect
    const count = Math.min(discardPile.length, 4);
    for (let i = 0; i < count; ++i) {
      const offset = (count - 1 - i) * 2;
      CE.drawCardBack(_ctx, PILE_X + offset, PILE_Y + offset);
    }

    // Count label
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(discardPile.length + ' card(s)', PILE_X + CE.CARD_W / 2, PILE_Y + CE.CARD_H + 6);
  }

  function drawRequiredRank() {
    const rank = requiredRank();

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(_ctx, CANVAS_W / 2 - 60, PILE_Y - 36, 120, 28, 6);
    _ctx.fill();

    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Rank: ' + rank, CANVAS_W / 2, PILE_Y - 22);
    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;

    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Your Hand (' + total + ')', CANVAS_W / 2, PLAYER_HAND_Y - 4);

    if (total === 0) {
      _ctx.fillStyle = 'rgba(255,255,255,0.3)';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('(empty)', CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H / 2);
      return;
    }

    const rank = requiredRank();

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      const isSelected = selectedIndices.includes(i);
      if (isSelected) y -= 15;
      else if (i === hoverCardIdx && phase === PHASE_PLAYER_TURN) y -= 8;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Selection highlight
      if (isSelected) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 6;
        CE.drawRoundedRect(_ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }

      // Hint glow for matching rank
      if (_host && _host.hintsEnabled && phase === PHASE_PLAYER_TURN && !isSelected && hand[i].rank === rank)
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }
  }

  function drawButtons() {
    // Play button (during player turn, with cards selected)
    if (phase === PHASE_PLAYER_TURN && selectedIndices.length > 0)
      CE.drawButton(_ctx, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h, 'Play (' + selectedIndices.length + ')', { bg: '#2a5a2a', border: '#4f4', fontSize: 13 });

    // Cheat! button (during challenge window after AI play, only for human)
    if (phase === PHASE_CHALLENGE_WINDOW && lastPlayInfo && lastPlayInfo.player !== 0)
      CE.drawButton(_ctx, CHEAT_BTN.x, CHEAT_BTN.y, CHEAT_BTN.w, CHEAT_BTN.h, 'Cheat!', { bg: '#6a1a1a', border: '#f44', fontSize: 16 });
  }

  function drawMessageArea() {
    if (message.length === 0 || messageTimer <= 0) return;

    const alpha = Math.min(1, messageTimer / 0.5);
    _ctx.save();
    _ctx.globalAlpha = alpha;

    const textWidth = _ctx.measureText(message).width || 200;
    const pw = Math.max(textWidth + 40, 240);
    const px = CANVAS_W / 2 - pw / 2;
    const py = CANVAS_H / 2 + 108;

    _ctx.fillStyle = 'rgba(0,0,0,0.55)';
    CE.drawRoundedRect(_ctx, px, py - 14, pw, 28, 8);
    _ctx.fill();

    _ctx.fillStyle = messageColor;
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(message, CANVAS_W / 2, py);
    _ctx.restore();
  }

  function drawResolveOverlay() {
    if (phase !== PHASE_RESOLVING || resolveMessage.length === 0) return;

    _ctx.save();
    const alpha = Math.min(1, resolveTimer / 0.3);
    _ctx.globalAlpha = alpha;

    const pw = 520;
    const ph = 36;
    const px = CANVAS_W / 2 - pw / 2;
    const py = CANVAS_H / 2 + 40;

    _ctx.fillStyle = 'rgba(0,0,0,0.7)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 8);
    _ctx.fill();

    _ctx.fillStyle = resolveColor;
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(resolveMessage, CANVAS_W / 2, py + ph / 2);
    _ctx.restore();
  }

  function drawGameOverUI() {
    const px = CANVAS_W / 2 - 150;
    const py = 200;
    const pw = 300;
    const ph = 140;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Game Over', CANVAS_W / 2, py + 14);

    // Find the winner (player with 0 cards)
    let winnerIdx = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (hands[p].length === 0) { winnerIdx = p; break; }

    if (winnerIdx === 0) {
      _ctx.fillStyle = '#4f4';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.fillText('You win!', CANVAS_W / 2, py + 48);

      _ctx.fillStyle = '#afa';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.fillText('Score: 100', CANVAS_W / 2, py + 76);
    } else {
      _ctx.fillStyle = '#f66';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.fillText(PLAYER_NAMES[winnerIdx >= 0 ? winnerIdx : 1] + ' wins!', CANVAS_W / 2, py + 48);

      _ctx.fillStyle = '#faa';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.fillText('Score: 0', CANVAS_W / 2, py + 76);
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Click to continue', CANVAS_W / 2, py + ph - 22);
    _ctx.restore();
  }

  /* ================================================================
     CLICK HANDLING
     ================================================================ */

  function handlePlayerClick(mx, my) {
    if (phase === PHASE_GAME_OVER) {
      if (_host) _host.onRoundOver(true);
      return;
    }

    // Cheat button
    if (phase === PHASE_CHALLENGE_WINDOW && lastPlayInfo && lastPlayInfo.player !== 0) {
      if (CE.isInRect(mx, my, CHEAT_BTN.x, CHEAT_BTN.y, CHEAT_BTN.w, CHEAT_BTN.h)) {
        resolveChallenge(0);
        return;
      }
    }

    if (phase !== PHASE_PLAYER_TURN) return;

    // Play button
    if (selectedIndices.length > 0 && CE.isInRect(mx, my, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h)) {
      playCards(0, selectedIndices);
      selectedIndices = [];
      return;
    }

    // Card selection
    const idx = hitTestPlayerCard(mx, my);
    if (idx < 0) return;

    const pos = selectedIndices.indexOf(idx);
    if (pos >= 0) {
      selectedIndices.splice(pos, 1);
    } else {
      if (selectedIndices.length >= 4) return;
      selectedIndices.push(idx);
    }
  }

  /* ================================================================
     TICK (AI + timers)
     ================================================================ */

  function tick(dt) {
    if (messageTimer > 0)
      messageTimer -= dt;

    if (roundOver || gameOver) return;

    // Challenge window timer
    if (phase === PHASE_CHALLENGE_WINDOW) {
      challengeTimer -= dt;

      // Each AI decides once at a staggered time within the window
      if (lastPlayInfo) {
        for (let p = 1; p < NUM_PLAYERS; ++p) {
          if (p === lastPlayInfo.player) continue;
          const decideTime = CHALLENGE_WINDOW_DURATION - 0.6 - (p - 1) * 0.4;
          const prevTime = challengeTimer + dt;
          if (prevTime > decideTime && challengeTimer <= decideTime) {
            if (aiDecideChallenge(p)) {
              setMessage(PLAYER_NAMES[p] + ' calls Cheat!', '#f88');
              resolveChallenge(p);
              return;
            }
          }
        }
      }

      if (challengeTimer <= 0)
        skipChallenge();

      return;
    }

    // Resolve timer
    if (phase === PHASE_RESOLVING) {
      resolveTimer -= dt;
      if (resolveTimer <= 0)
        afterResolve();
      return;
    }

    // AI turn
    if (phase === PHASE_AI_TURN) {
      aiTurnTimer -= dt;
      if (aiTurnTimer <= 0) {
        aiTurnTimer = 0;
        aiPlayTurn(currentPlayer);
      }
      return;
    }
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = 0;
      deal();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawCheat();
    },

    handleClick(mx, my) {
      handlePlayerClick(mx, my);
    },

    handlePointerMove(mx, my) {
      if (phase === PHASE_PLAYER_TURN)
        hoverCardIdx = hitTestPlayerCard(mx, my);
      else
        hoverCardIdx = -1;
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (phase === PHASE_GAME_OVER) return;
      // Enter to confirm play
      if (e.key === 'Enter' && phase === PHASE_PLAYER_TURN && selectedIndices.length > 0) {
        e.preventDefault();
        playCards(0, selectedIndices);
        selectedIndices = [];
      }
      // Space to call cheat
      if (e.key === ' ' && phase === PHASE_CHALLENGE_WINDOW && lastPlayInfo && lastPlayInfo.player !== 0) {
        e.preventDefault();
        resolveChallenge(0);
      }
    },

    tick(dt) {
      tick(dt);
    },

    sortPlayerHand() { sortHand(hands[0]); },

    cleanup() {
      hands = [[], [], [], []];
      discardPile = [];
      selectedIndices = [];
      lastPlayInfo = null;
      roundOver = false;
      gameOver = false;
      hoverCardIdx = -1;
      challengeTimer = 0;
      aiTurnTimer = 0;
      resolveTimer = 0;
      message = '';
      messageTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('cheat', module);

})();
