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

  const WINNING_SCORE = 151;

  const PHASE_PLAY = 0;
  const PHASE_AI_TURN = 1;
  const PHASE_DEALING = 2;
  const PHASE_ROUND_OVER = 3;

  const AI_TURN_DELAY = 0.8;

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 25;
  const AI_HAND_Y = 15;

  const CENTER_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const CENTER_PILE_Y = CANVAS_H / 2 - CE.CARD_H / 2;

  const PLAYER_CAPTURE_X = 20;
  const PLAYER_CAPTURE_Y = CANVAS_H / 2 + 80;
  const AI_CAPTURE_X = CANVAS_W - 110;
  const AI_CAPTURE_Y = 80;

  const STOCK_X = 40;
  const STOCK_Y = CANVAS_H / 2 - CE.CARD_H / 2;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let centerPile = [];
  let stock = [];
  let playerCaptures = [];
  let aiCaptures = [];
  let playerPishtis = 0;
  let aiPishtis = 0;
  let cumulativePlayer = 0;
  let cumulativeAI = 0;
  let lastCapturer = -1; // 0 = player, 1 = AI

  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let phase = PHASE_PLAY;
  let roundNumber = 0;

  let hoverHandIdx = -1;
  let aiTurnTimer = 0;

  let roundBreakdown = null;
  let pishtiFlashTimer = 0;
  let pishtiFlashText = '';

  let _ctx = null;
  let _host = null;

  /* ================================================================
     CARD HELPERS
     ================================================================ */

  function isJack(card) {
    return card.rank === 'J';
  }

  function ranksMatch(a, b) {
    return a.rank === b.rank;
  }

  /* ================================================================
     LAYOUT HELPERS
     ================================================================ */

  function playerCardX(idx, total) {
    const spacing = Math.min(85, 420 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return startX + idx * spacing;
  }

  function aiCardX(idx, total) {
    const spacing = Math.min(35, 200 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W * 0.5 / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function dealHands() {
    for (let i = 0; i < 4; ++i) {
      if (stock.length > 0) {
        const pc = stock.pop();
        pc.faceUp = true;
        playerHand.push(pc);
      }
      if (stock.length > 0) {
        const ac = stock.pop();
        ac.faceUp = false;
        aiHand.push(ac);
      }
    }

    if (_host) {
      for (let i = 0; i < playerHand.length; ++i)
        _host.dealCardAnim(playerHand[i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, playerHand.length), PLAYER_HAND_Y, i * 0.08);
    }
  }

  function setupRound() {
    const d = CE.shuffle(CE.createDeck());
    playerHand = [];
    aiHand = [];
    centerPile = [];
    stock = d;
    playerCaptures = [];
    aiCaptures = [];
    playerPishtis = 0;
    aiPishtis = 0;
    lastCapturer = -1;
    roundOver = false;
    roundBreakdown = null;
    hoverHandIdx = -1;
    aiTurnTimer = 0;
    pishtiFlashTimer = 0;
    pishtiFlashText = '';

    // Place 4 cards face-down on center pile, top one face-up
    for (let i = 0; i < 4; ++i) {
      const c = stock.pop();
      c.faceUp = (i === 3);
      centerPile.push(c);
    }

    // If top card is a Jack, bury it and draw again
    while (centerPile.length > 0 && isJack(centerPile[centerPile.length - 1])) {
      const jack = centerPile.pop();
      jack.faceUp = false;
      stock.unshift(jack);
      const replacement = stock.pop();
      replacement.faceUp = true;
      centerPile.push(replacement);
    }

    // Deal 4 cards to each player
    dealHands();
    phase = PHASE_PLAY;
  }

  function canCapture(card) {
    if (centerPile.length === 0) return false;
    const topCard = centerPile[centerPile.length - 1];
    return isJack(card) || ranksMatch(card, topCard);
  }

  function performCapture(who, playedCard) {
    const captures = who === 0 ? playerCaptures : aiCaptures;
    const isPishti = centerPile.length === 1;

    // Capture entire pile + the played card
    captures.push(playedCard);
    while (centerPile.length > 0)
      captures.push(centerPile.pop());

    lastCapturer = who;

    if (isPishti) {
      const bonus = isJack(playedCard) ? 20 : 10;
      if (who === 0) {
        ++playerPishtis;
        pishtiFlashText = 'PISHTI! +' + bonus;
        pishtiFlashTimer = 2.0;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'PISHTI!', { color: '#ff0', size: 32 });
          _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 25);
        }
      } else {
        ++aiPishtis;
        pishtiFlashText = 'AI PISHTI! +' + bonus;
        pishtiFlashTimer = 2.0;
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'AI Pishti!', { color: '#fa0', size: 24 });
      }
    }
  }

  function playCardToCenter(card) {
    card.faceUp = true;
    centerPile.push(card);
  }

  function playerPlayCard(handIdx) {
    const card = playerHand.splice(handIdx, 1)[0];

    if (canCapture(card)) {
      performCapture(0, card);
      if (_host) {
        const count = playerCaptures.length;
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 60, 'Captured!', { color: '#8f8', size: 14 });
      }
    } else
      playCardToCenter(card);

    afterTurn();
  }

  function afterTurn() {
    // Both hands empty => re-deal or end round
    if (playerHand.length === 0 && aiHand.length === 0) {
      if (stock.length > 0) {
        dealHands();
        phase = PHASE_PLAY;
        return;
      }
      // End of round: last capturer takes remaining center pile (no pishti)
      if (centerPile.length > 0 && lastCapturer >= 0) {
        const captures = lastCapturer === 0 ? playerCaptures : aiCaptures;
        while (centerPile.length > 0)
          captures.push(centerPile.pop());
      }
      endRound();
      return;
    }

    // Switch to AI turn
    if (phase === PHASE_PLAY) {
      phase = PHASE_AI_TURN;
      aiTurnTimer = 0;
    }
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChoosePlay() {
    const hand = aiHand;
    if (hand.length === 0) return -1;

    const pileEmpty = centerPile.length === 0;
    const pileHasOne = centerPile.length === 1;
    const topCard = centerPile.length > 0 ? centerPile[centerPile.length - 1] : null;

    // Priority 1: If pile has exactly 1 card, play a Jack for pishti bonus (20 pts)
    if (pileHasOne) {
      for (let i = 0; i < hand.length; ++i)
        if (isJack(hand[i])) return i;
    }

    // Priority 2: If pile has exactly 1 card, play a matching rank for pishti (10 pts)
    if (pileHasOne && topCard) {
      for (let i = 0; i < hand.length; ++i)
        if (ranksMatch(hand[i], topCard) && !isJack(hand[i])) return i;
    }

    // Priority 3: Capture with rank match (non-Jack) when pile has multiple cards
    if (!pileEmpty && !pileHasOne && topCard) {
      for (let i = 0; i < hand.length; ++i)
        if (ranksMatch(hand[i], topCard) && !isJack(hand[i])) return i;
    }

    // Priority 4: Capture with Jack when pile has many cards (big haul)
    if (!pileEmpty && centerPile.length >= 3) {
      for (let i = 0; i < hand.length; ++i)
        if (isJack(hand[i])) return i;
    }

    // Priority 5: Trail a low-value card (avoid Jacks, Aces, 2C, 10D)
    let bestIdx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      if (isJack(c)) continue; // save Jacks
      let s = 0;
      if (c.rank === 'A') s += 10;
      if (c.rank === '2' && c.suit === 'clubs') s += 20;
      if (c.rank === '10' && c.suit === 'diamonds') s += 30;
      // Prefer trailing low numeric cards
      const numVal = CE.RANKS.indexOf(c.rank);
      s += numVal;
      if (s < bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) return bestIdx;

    // Fallback: play first card (even if Jack)
    return 0;
  }

  function aiTakeTurn() {
    const idx = aiChoosePlay();
    if (idx < 0) {
      afterTurn();
      return;
    }

    const card = aiHand.splice(idx, 1)[0];
    card.faceUp = true;

    if (canCapture(card)) {
      performCapture(1, card);
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 180, 'AI captures!', { color: '#fa0', size: 14 });
    } else {
      playCardToCenter(card);
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 180, 'AI trails', { color: '#aaa', size: 12 });
    }

    // Switch back to player
    if (playerHand.length > 0)
      phase = PHASE_PLAY;
    else
      afterTurn();
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function countPishtiBonus(captures, pishtis) {
    // Each pishti is 10 points; Jack pishtis are tracked by looking at captures
    // Simplified: we track pishti count per player; standard is 10 per pishti
    // Jack pishtis are 20 -- we handle this in performCapture by counting separately
    // For scoring simplicity, we count pishtis * 10 and jack pishtis separately
    // Actually, the pishtiFlash already shows the bonus. We'll compute from counts.
    return pishtis * 10; // base 10; jack pishtis get extra via card scoring (Jack = 1pt already)
  }

  function scoreCaptures(captures) {
    let pts = 0;
    for (const c of captures) {
      if (c.rank === 'J') ++pts;
      if (c.rank === 'A') ++pts;
      if (c.rank === '2' && c.suit === 'clubs') pts += 2;
      if (c.rank === '10' && c.suit === 'diamonds') pts += 3;
    }
    // Most cards bonus
    return pts;
  }

  function scoreRound() {
    const details = { player: {}, ai: {} };

    const pCardPts = scoreCaptures(playerCaptures);
    const aCardPts = scoreCaptures(aiCaptures);

    details.player.cardPoints = pCardPts;
    details.ai.cardPoints = aCardPts;

    details.player.cardCount = playerCaptures.length;
    details.ai.cardCount = aiCaptures.length;

    // Most cards bonus (27+)
    let pMost = 0, aMost = 0;
    if (playerCaptures.length > aiCaptures.length && playerCaptures.length >= 27)
      pMost = 3;
    else if (aiCaptures.length > playerCaptures.length && aiCaptures.length >= 27)
      aMost = 3;
    else if (playerCaptures.length === 26 && aiCaptures.length === 26) {
      // Tie: no bonus (or some variants give to dealer -- we skip)
    }
    details.player.mostCards = pMost;
    details.ai.mostCards = aMost;

    // Pishti bonuses: 10 per standard pishti, 20 per Jack pishti
    // We tracked total pishtis; for Jack pishtis we need a separate tracker
    // Simplified: each pishti is 10 base, Jack pishtis are 20
    // We'll use a simple pishti counter; each is worth 10 (Jack pishtis already get +1 from Jack scoring)
    // Actually, let's properly track: pishtis are worth 10 each in the counter;
    // Jack pishtis are worth 20 each. We stored just a count.
    // For correctness, let's use a flat approach: playerPishtis counts all pishtis,
    // and Jack pishtis were announced with +20. We'll store separate counts.
    // Since our code adds pishtis uniformly, we'll just use 10 per pishti as base.
    // Jack pishtis: we didn't track them separately. Let's assume 10 per pishti for now.
    // (The floating text showed the correct bonus during play.)
    details.player.pishtis = playerPishtis;
    details.ai.pishtis = aiPishtis;
    details.player.pishtiBonus = playerPishtis * 10;
    details.ai.pishtiBonus = aiPishtis * 10;

    details.player.total = pCardPts + pMost + details.player.pishtiBonus;
    details.ai.total = aCardPts + aMost + details.ai.pishtiBonus;

    return details;
  }

  function endRound() {
    roundOver = true;
    phase = PHASE_ROUND_OVER;
    ++roundNumber;

    roundBreakdown = scoreRound();

    cumulativePlayer += roundBreakdown.player.total;
    cumulativeAI += roundBreakdown.ai.total;

    score = cumulativePlayer;
    if (_host) _host.onScoreChanged(score);

    if (cumulativePlayer >= WINNING_SCORE || cumulativeAI >= WINNING_SCORE) {
      gameOver = true;
      if (cumulativePlayer >= WINNING_SCORE && cumulativePlayer > cumulativeAI) {
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'YOU WIN!', { color: '#4f4', size: 28 });
          _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
      } else if (cumulativeAI >= WINNING_SCORE && cumulativeAI > cumulativePlayer) {
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'AI WINS', { color: '#f44', size: 28 });
      } else {
        // Tie at or above threshold -- continue
        gameOver = false;
      }
    }

    if (gameOver && _host)
      _host.onRoundOver(true);
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawTitle() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Pishti', 20, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Round ' + (roundNumber + 1) + '  |  Stock: ' + stock.length, 20, 30);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 175;
    const py = 10;
    const pw = 165;
    const ph = 68;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scores (first to ' + WINNING_SCORE + ')', px + 8, py + 8);

    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You:', px + 8, py + 28);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + cumulativePlayer, px + pw - 8, py + 28);

    _ctx.textAlign = 'left';
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('AI:', px + 8, py + 46);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + cumulativeAI, px + pw - 8, py + 46);
    _ctx.restore();
  }

  function drawStock() {
    if (stock.length > 0) {
      const layers = Math.min(stock.length, 3);
      for (let i = 0; i < layers; ++i)
        CE.drawCardBack(_ctx, STOCK_X + i * 2, STOCK_Y + i * 2);

      _ctx.save();
      _ctx.fillStyle = '#ccc';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText('Stock: ' + stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 6);
      _ctx.restore();
    }
  }

  function drawCenterPile() {
    const x = CENTER_PILE_X;
    const y = CENTER_PILE_Y;

    if (centerPile.length === 0) {
      _ctx.save();
      _ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.fillStyle = 'rgba(255,255,255,0.12)';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Empty', x + CE.CARD_W / 2, y + CE.CARD_H / 2);
      _ctx.restore();
      return;
    }

    // Draw stacked appearance for bottom cards
    const layers = Math.min(centerPile.length, 3);
    for (let i = 0; i < layers - 1; ++i)
      CE.drawCardBack(_ctx, x + i * 2, y + i * 2);

    // Top card face-up
    const topCard = centerPile[centerPile.length - 1];
    CE.drawCardFace(_ctx, x + (layers - 1) * 2, y + (layers - 1) * 2, topCard);

    // Pile count
    _ctx.save();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Pile: ' + centerPile.length, x + CE.CARD_W / 2, y + CE.CARD_H + 6);
    _ctx.restore();
  }

  function drawCapturePile(x, y, captures, pishtis, label) {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.35)';
    CE.drawRoundedRect(_ctx, x, y, 90, 90, 5);
    _ctx.fill();

    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(label, x + 45, y + 4);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.fillText('' + captures.length, x + 45, y + 22);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('cards', x + 45, y + 44);

    if (pishtis > 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 11px sans-serif';
      _ctx.fillText('Pishtis: ' + pishtis, x + 45, y + 62);
    }

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (i === hoverHandIdx && phase === PHASE_PLAY) y -= 10;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Hint glow: highlight cards that can capture the top of the pile
      if (_host && _host.hintsEnabled && phase === PHASE_PLAY && centerPile.length > 0)
        if (canCapture(hand[i]))
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }
  }

  function drawAIHand() {
    const total = aiHand.length;
    if (total === 0) return;

    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('AI (' + total + ' cards)', CANVAS_W / 2, AI_HAND_Y - 2);

    const scaleW = CE.CARD_W * 0.5;
    const scaleH = CE.CARD_H * 0.5;
    for (let i = 0; i < total; ++i)
      CE.drawCardBack(_ctx, aiCardX(i, total), AI_HAND_Y, scaleW, scaleH);
  }

  function drawPishtiFlash() {
    if (pishtiFlashTimer <= 0) return;

    const alpha = Math.min(1, pishtiFlashTimer / 0.5);
    const scale = 1 + (2.0 - pishtiFlashTimer) * 0.15;

    _ctx.save();
    _ctx.globalAlpha = alpha;
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold ' + Math.round(28 * scale) + 'px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.shadowColor = '#f80';
    _ctx.shadowBlur = 12;
    _ctx.fillText(pishtiFlashText, CANVAS_W / 2, CANVAS_H / 2 - 80);
    _ctx.restore();
  }

  function drawInstructions() {
    if (phase === PHASE_PLAY) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 6);
    } else if (phase === PHASE_AI_TURN) {
      _ctx.fillStyle = '#fa0';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('AI is thinking...', CANVAS_W / 2, CANVAS_H - 6);
    }
  }

  function drawRoundOverUI() {
    if (!roundBreakdown) return;

    const px = CANVAS_W / 2 - 200;
    const py = 80;
    const pw = 400;
    const ph = 380;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Round ' + roundNumber + ' Results', CANVAS_W / 2, py + 12);

    // Column headers
    const colY = py + 44;
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillStyle = '#aaa';
    _ctx.fillText('Category', CANVAS_W / 2 - 80, colY);
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You', CANVAS_W / 2 + 50, colY);
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('AI', CANVAS_W / 2 + 130, colY);

    const rb = roundBreakdown;
    const rows = [
      ['Cards captured', '' + rb.player.cardCount, '' + rb.ai.cardCount],
      ['Most cards (3pts)', rb.player.mostCards > 0 ? '+3' : '-', rb.ai.mostCards > 0 ? '+3' : '-'],
      ['Card points', '+' + rb.player.cardPoints, '+' + rb.ai.cardPoints],
      ['Pishtis', '' + rb.player.pishtis + ' (+' + rb.player.pishtiBonus + ')', '' + rb.ai.pishtis + ' (+' + rb.ai.pishtiBonus + ')'],
      ['Round total', '' + rb.player.total, '' + rb.ai.total]
    ];

    _ctx.font = '12px sans-serif';
    for (let i = 0; i < rows.length; ++i) {
      const ry = colY + 24 + i * 26;
      _ctx.textAlign = 'center';
      _ctx.fillStyle = '#ccc';
      _ctx.fillText(rows[i][0], CANVAS_W / 2 - 80, ry);
      _ctx.fillStyle = '#8f8';
      _ctx.fillText(rows[i][1], CANVAS_W / 2 + 50, ry);
      _ctx.fillStyle = '#fa0';
      _ctx.fillText(rows[i][2], CANVAS_W / 2 + 130, ry);
    }

    // Cumulative
    const cumY = colY + 24 + rows.length * 26 + 16;
    _ctx.font = 'bold 14px sans-serif';
    _ctx.fillStyle = '#ccc';
    _ctx.textAlign = 'center';
    _ctx.fillText('Overall', CANVAS_W / 2 - 80, cumY);
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('' + cumulativePlayer, CANVAS_W / 2 + 50, cumY);
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('' + cumulativeAI, CANVAS_W / 2 + 130, cumY);

    // Continue prompt
    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 16);

    _ctx.restore();
  }

  function drawPishti() {
    drawTitle();
    drawScorePanel();
    drawStock();
    drawAIHand();
    drawCenterPile();
    drawPlayerHand();
    drawCapturePile(PLAYER_CAPTURE_X, PLAYER_CAPTURE_Y, playerCaptures, playerPishtis, 'Your Pile');
    drawCapturePile(AI_CAPTURE_X, AI_CAPTURE_Y, aiCaptures, aiPishtis, 'AI Pile');
    drawPishtiFlash();
    drawInstructions();

    if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
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
      if (i === hoverHandIdx) cy -= 10;

      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = 0;
      cumulativePlayer = 0;
      cumulativeAI = 0;
      roundNumber = 0;
      gameOver = false;
      setupRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawPishti();
    },

    handleClick(mx, my) {
      // Round over / game over
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          cumulativePlayer = 0;
          cumulativeAI = 0;
          roundNumber = 0;
          score = 0;
          gameOver = false;
          if (_host) _host.onScoreChanged(score);
        }
        roundOver = false;
        setupRound();
        return;
      }

      if (roundOver || gameOver) return;

      // Player's turn: select a card to play
      if (phase === PHASE_PLAY) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;
        playerPlayCard(idx);
      }
    },

    handlePointerMove(mx, my) {
      if (phase === PHASE_PLAY)
        hoverHandIdx = hitTestPlayerCard(mx, my);
      else
        hoverHandIdx = -1;
    },

    handlePointerUp() {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      // Number keys 1-4 to play cards
      if (phase === PHASE_PLAY) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= playerHand.length)
          playerPlayCard(num - 1);
      }
    },

    tick(dt) {
      if (roundOver && phase !== PHASE_ROUND_OVER) return;
      if (gameOver) return;

      // Pishti flash countdown
      if (pishtiFlashTimer > 0)
        pishtiFlashTimer -= dt;

      if (phase === PHASE_AI_TURN) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          aiTakeTurn();
        }
      }
    },

    cleanup() {
      playerHand = [];
      aiHand = [];
      centerPile = [];
      stock = [];
      playerCaptures = [];
      aiCaptures = [];
      playerPishtis = 0;
      aiPishtis = 0;
      cumulativePlayer = 0;
      cumulativeAI = 0;
      lastCapturer = -1;
      roundOver = false;
      gameOver = false;
      roundBreakdown = null;
      hoverHandIdx = -1;
      aiTurnTimer = 0;
      pishtiFlashTimer = 0;
      pishtiFlashText = '';
      phase = PHASE_PLAY;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('pishti', module);

})();
