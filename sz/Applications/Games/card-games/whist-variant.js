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

  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const SUIT_COLORS = { spades: '#000', hearts: '#d00', diamonds: '#d00', clubs: '#000' };
  const STRENGTH_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 13;
  const WINNING_SCORE = 5;
  const BOOK_SIZE = 6;

  /* Players: 0=South(human), 1=West(AI), 2=North(AI partner), 3=East(AI) */
  /* Teams: NS = players 0,2   EW = players 1,3 */
  const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];
  const TEAM_NS = 0;
  const TEAM_EW = 1;

  const PHASE_TRUMP_REVEAL = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_OVER = 3;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let tricksWon = [0, 0, 0, 0];
  let teamScores = [0, 0];
  let trickCards = [];
  let trickPlayers = [];
  let currentTurn = 0;
  let currentLead = 0;
  let dealer = 0;
  let trumpSuit = null;
  let trumpCard = null;
  let phase = PHASE_TRUMP_REVEAL;
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let trickCount = 0;
  let trickWinnerDisplay = '';
  let trickDisplayTimer = 0;
  let hoveredCard = -1;
  let statusMessage = '';

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;
  const TRICK_DISPLAY_TIME = 1.2;
  const TRUMP_REVEAL_TIME = 2.0;
  let trumpRevealTimer = 0;

  /* ================================================================
     CARD LOGIC
     ================================================================ */

  function cardStrength(card) {
    return STRENGTH_ORDER.indexOf(card.rank);
  }

  function teamOf(player) {
    return (player === 0 || player === 2) ? TEAM_NS : TEAM_EW;
  }

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

  function sortHand(hand) {
    const suitOrder = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  function isValidPlay(card, hand) {
    if (trickCards.length === 0) return true;
    const leadSuit = trickCards[0].suit;
    if (hasSuit(hand, leadSuit))
      return card.suit === leadSuit;
    return true;
  }

  function getValidIndices(hand) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand))
        valid.push(i);
    if (valid.length === 0)
      for (let i = 0; i < hand.length; ++i)
        valid.push(i);
    return valid;
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function determineTrickWinner() {
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStrength = cardStrength(trickCards[0]);
    let bestIsTrump = trickCards[0].suit === trumpSuit;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const isTrump = c.suit === trumpSuit;
      const str = cardStrength(c);

      if (bestIsTrump) {
        if (isTrump && str > bestStrength) {
          bestIdx = i;
          bestStrength = str;
        }
      } else {
        if (isTrump) {
          bestIdx = i;
          bestStrength = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStrength) {
          bestIdx = i;
          bestStrength = str;
        }
      }
    }
    return trickPlayers[bestIdx];
  }

  function determineTrickWinnerPartial() {
    if (trickCards.length === 0) return -1;
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStrength = cardStrength(trickCards[0]);
    let bestIsTrump = trickCards[0].suit === trumpSuit;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const isTrump = c.suit === trumpSuit;
      const str = cardStrength(c);

      if (bestIsTrump) {
        if (isTrump && str > bestStrength) {
          bestIdx = i;
          bestStrength = str;
        }
      } else {
        if (isTrump) {
          bestIdx = i;
          bestStrength = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStrength) {
          bestIdx = i;
          bestStrength = str;
        }
      }
    }
    return trickPlayers[bestIdx];
  }

  function currentTrickBestStrength() {
    if (trickCards.length === 0) return -1;
    const leadSuit = trickCards[0].suit;
    let best = -1;
    for (const c of trickCards)
      if (c.suit === leadSuit && cardStrength(c) > best)
        best = cardStrength(c);
    return best;
  }

  function trickHasTrump() {
    return trickCards.some(c => c.suit === trumpSuit);
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiPlay(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return;

    const valid = getValidIndices(hand);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      playCard(playerIdx, valid[0]);
      return;
    }

    const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
    const partnerIdx = (playerIdx + 2) % 4;

    let partnerWinning = false;
    if (trickCards.length > 0) {
      const tempWinner = determineTrickWinnerPartial();
      partnerWinning = teamOf(tempWinner) === teamOf(playerIdx);
    }

    // Leading
    if (!leadSuit) {
      // Lead with strongest suit; prefer non-trump aces/kings
      const nonTrumps = valid.filter(i => hand[i].suit !== trumpSuit);
      const pool = nonTrumps.length > 0 ? nonTrumps : valid;
      // Lead highest card to try to win
      pool.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      playCard(playerIdx, pool[0]);
      return;
    }

    // Following suit
    const followSuit = valid.filter(i => hand[i].suit === leadSuit);
    if (followSuit.length > 0) {
      if (partnerWinning) {
        // Partner winning: play lowest of suit
        followSuit.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        playCard(playerIdx, followSuit[0]);
      } else {
        // Third-hand high: try to win with highest card
        followSuit.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        const bestFollow = followSuit[0];
        const currentBest = currentTrickBestStrength();
        if (cardStrength(hand[bestFollow]) > currentBest && !trickHasTrump()) {
          playCard(playerIdx, bestFollow);
        } else {
          // Can't beat it, dump lowest
          followSuit.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
          playCard(playerIdx, followSuit[0]);
        }
      }
      return;
    }

    // Void in led suit
    if (partnerWinning) {
      // Partner winning: dump lowest non-trump
      const nonTrumps = valid.filter(i => hand[i].suit !== trumpSuit);
      const dump = nonTrumps.length > 0 ? nonTrumps : valid;
      dump.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      playCard(playerIdx, dump[0]);
    } else {
      // Trump in with lowest trump that wins, or dump lowest
      const trumps = valid.filter(i => hand[i].suit === trumpSuit);
      if (trumps.length > 0) {
        trumps.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        playCard(playerIdx, trumps[0]);
      } else {
        valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        playCard(playerIdx, valid[0]);
      }
    }
  }

  /* ================================================================
     PLAY CARD
     ================================================================ */

  function playCard(playerIdx, handIndex) {
    const card = hands[playerIdx].splice(handIndex, 1)[0];
    card.faceUp = true;
    trickCards.push(card);
    trickPlayers.push(playerIdx);
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function scoreRound() {
    const nsTricks = tricksWon[0] + tricksWon[2];
    const ewTricks = tricksWon[1] + tricksWon[3];

    // Each trick beyond 6 (the "book") scores 1 point
    if (nsTricks > BOOK_SIZE)
      teamScores[TEAM_NS] += nsTricks - BOOK_SIZE;
    if (ewTricks > BOOK_SIZE)
      teamScores[TEAM_EW] += ewTricks - BOOK_SIZE;

    score = teamScores[TEAM_NS];
    if (_host) _host.onScoreChanged(score);
  }

  function checkGameOver() {
    if (teamScores[TEAM_NS] >= WINNING_SCORE || teamScores[TEAM_EW] >= WINNING_SCORE)
      gameOver = true;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function deal() {
    const d = CE.shuffle(CE.createDeck());

    hands = [[], [], [], []];
    for (let i = 0; i < 52; ++i)
      hands[i % 4].push(d[i]);

    // Last card dealt to dealer determines trump
    const dealerHand = hands[dealer];
    trumpCard = dealerHand[dealerHand.length - 1];
    trumpSuit = trumpCard.suit;

    // Mark player's cards face up
    for (const c of hands[0]) c.faceUp = true;

    for (let p = 0; p < 4; ++p) sortHand(hands[p]);

    trickCards = [];
    trickPlayers = [];
    tricksWon = [0, 0, 0, 0];
    trickCount = 0;
    roundOver = false;
    phase = PHASE_TRUMP_REVEAL;
    trumpRevealTimer = TRUMP_REVEAL_TIME;
    aiTurnTimer = 0;
    trickWinnerDisplay = '';
    trickDisplayTimer = 0;
    hoveredCard = -1;
    statusMessage = '';

    // Player left of dealer leads
    currentLead = (dealer + 1) % 4;
    currentTurn = currentLead;
  }

  function setupGame() {
    teamScores = [0, 0];
    gameOver = false;
    score = 0;
    dealer = 0;
    deal();
  }

  /* ================================================================
     LAYOUT CONSTANTS
     ================================================================ */

  const PLAYER_HAND_Y = 470;

  function playerCardX(idx, total) {
    const maxSpread = CANVAS_W - 200;
    const spacing = Math.min(52, maxSpread / Math.max(total, 1));
    const totalWidth = (total - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + idx * spacing;
  }

  /* Trick card positions: center of canvas, arranged by seat */
  const TRICK_POS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },         // South (player)
    { x: CANVAS_W / 2 - CE.CARD_W - 40, y: 260 },         // West
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 210 },          // North (partner)
    { x: CANVAS_W / 2 + 40, y: 260 }                       // East
  ];

  /* AI hand display positions */
  const AI_POS = [
    null,
    { x: 20, y: 160, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 180, y: 20, dir: 'horizontal', label: 'Partner (N)' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 220;
    const py = 10;
    const pw = 210;
    const ph = 130;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();
    _ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    _ctx.lineWidth = 1;
    _ctx.stroke();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Whist Scoreboard', px + 10, py + 8);

    _ctx.font = '11px sans-serif';
    const lh = 15;
    let y = py + 28;

    // Trump indicator
    if (trumpSuit) {
      const sym = SUIT_SYMBOLS[trumpSuit];
      const col = SUIT_COLORS[trumpSuit] === '#d00' ? '#f66' : '#ccc';
      _ctx.fillStyle = col;
      _ctx.fillText('Trump: ' + sym + ' ' + trumpSuit.charAt(0).toUpperCase() + trumpSuit.slice(1), px + 10, y);
      y += lh + 2;
    }

    // Team headers
    _ctx.fillStyle = '#8cf';
    _ctx.fillText('NS (You + Partner)', px + 10, y);
    _ctx.fillStyle = '#f88';
    _ctx.fillText('EW (W + E)', px + 120, y);
    y += lh + 2;

    // Game points
    _ctx.fillStyle = '#fff';
    _ctx.fillText('Points: ' + teamScores[TEAM_NS], px + 10, y);
    _ctx.fillText('Points: ' + teamScores[TEAM_EW], px + 120, y);
    y += lh;

    // Current round tricks
    const nsTricks = tricksWon[0] + tricksWon[2];
    const ewTricks = tricksWon[1] + tricksWon[3];
    _ctx.fillStyle = '#aaa';
    _ctx.fillText('Tricks: ' + nsTricks + '/13', px + 10, y);
    _ctx.fillText('Tricks: ' + ewTricks + '/13', px + 120, y);
    y += lh;

    // Book progress
    const nsBook = Math.max(0, nsTricks - BOOK_SIZE);
    const ewBook = Math.max(0, ewTricks - BOOK_SIZE);
    _ctx.fillStyle = '#8cf';
    _ctx.fillText('Over book: ' + nsBook, px + 10, y);
    _ctx.fillStyle = '#f88';
    _ctx.fillText('Over book: ' + ewBook, px + 120, y);

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;

    _ctx.fillStyle = '#ccc';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Your Hand', CANVAS_W / 2, PLAYER_HAND_Y - 4);

    for (let i = 0; i < total; ++i) {
      const x = playerCardX(i, total);
      const yOff = (i === hoveredCard && phase === PHASE_PLAYING && currentTurn === 0) ? -10 : 0;

      if (phase === PHASE_PLAYING && currentTurn === 0 && isValidPlay(hand[i], hand)) {
        _ctx.save();
        _ctx.shadowColor = '#4f4';
        _ctx.shadowBlur = 8;
        CE.drawCardFace(_ctx, x, PLAYER_HAND_Y + yOff, hand[i]);
        _ctx.restore();
      } else
        CE.drawCardFace(_ctx, x, PLAYER_HAND_Y + yOff, hand[i]);

      if (_host && _host.hintsEnabled && phase === PHASE_PLAYING && currentTurn === 0 && isValidPlay(hand[i], hand))
        CE.drawHintGlow(_ctx, x, PLAYER_HAND_Y + yOff, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Dim invalid cards
      if (phase === PHASE_PLAYING && currentTurn === 0 && !isValidPlay(hand[i], hand)) {
        _ctx.save();
        _ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(_ctx, x, PLAYER_HAND_Y + yOff, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        _ctx.fill();
        _ctx.restore();
      }
    }
  }

  function drawAIHands() {
    for (let p = 1; p < 4; ++p) {
      const pos = AI_POS[p];
      const count = hands[p].length;

      _ctx.fillStyle = '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';

      if (pos.dir === 'horizontal') {
        _ctx.textAlign = 'center';
        _ctx.fillText(pos.label + ' (' + count + ')', CANVAS_W / 2, pos.y - 2);
        const spacing = Math.min(22, 360 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + CE.CARD_W * 0.5;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(_ctx, startX + i * spacing, pos.y + 10, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
      } else {
        const spacing = Math.min(18, 250 / Math.max(count, 1));
        const startY = pos.y + 20;

        _ctx.save();
        _ctx.translate(pos.x + (p === 1 ? 20 : 0), pos.y);
        _ctx.fillStyle = '#aaa';
        _ctx.font = '11px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'bottom';
        _ctx.fillText(pos.label + ' (' + count + ')', CE.CARD_W * 0.25, -2);
        _ctx.restore();

        for (let i = 0; i < count; ++i) {
          const cx = pos.x + (p === 1 ? 5 : -CE.CARD_W * 0.5 + 5);
          CE.drawCardBack(_ctx, cx, startY + i * spacing, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
        }
      }
    }
  }

  function drawTrickArea() {
    // Subtle center area
    _ctx.save();
    _ctx.fillStyle = 'rgba(255,255,255,0.04)';
    _ctx.beginPath();
    _ctx.arc(CANVAS_W / 2, 280, 90, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.restore();

    // Draw played cards at their seat positions
    for (let i = 0; i < trickCards.length; ++i) {
      const player = trickPlayers[i];
      const pos = TRICK_POS[player];
      CE.drawCardFace(_ctx, pos.x, pos.y, trickCards[i]);

      _ctx.fillStyle = '#ccc';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      const labelY = player === 2 ? pos.y - 12 : pos.y + CE.CARD_H + 3;
      _ctx.fillText(PLAYER_NAMES[player], pos.x + CE.CARD_W / 2, labelY);
    }

    // Trick winner display
    if (trickWinnerDisplay) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(trickWinnerDisplay, CANVAS_W / 2, 195);
    }
  }

  function drawTrumpReveal() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.5)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Trump Suit Revealed', CANVAS_W / 2, 180);

    // Draw the trump card in the center
    if (trumpCard)
      CE.drawCardFace(_ctx, CANVAS_W / 2 - CE.CARD_W / 2, 210, trumpCard);

    const sym = SUIT_SYMBOLS[trumpSuit] || '';
    const col = SUIT_COLORS[trumpSuit] === '#d00' ? '#f66' : '#ccc';
    _ctx.fillStyle = col;
    _ctx.font = 'bold 20px sans-serif';
    _ctx.fillText(sym + ' ' + trumpSuit.charAt(0).toUpperCase() + trumpSuit.slice(1) + ' is trump!', CANVAS_W / 2, 320);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '14px sans-serif';
    _ctx.fillText(PLAYER_NAMES[dealer] + ' dealt \u2014 ' + PLAYER_NAMES[currentLead] + ' leads', CANVAS_W / 2, 350);

    const remaining = Math.ceil(trumpRevealTimer);
    _ctx.fillStyle = '#888';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Starting in ' + remaining + '...', CANVAS_W / 2, 380);

    _ctx.restore();
  }

  function drawRoundOverUI() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.7)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';

    if (gameOver) {
      const nsWin = teamScores[TEAM_NS] >= WINNING_SCORE;
      const won = nsWin;
      _ctx.fillStyle = won ? '#4f4' : '#f44';
      _ctx.fillText(won ? 'You Win the Game!' : 'Game Over \u2014 You Lose!', CANVAS_W / 2, 180);
      _ctx.fillStyle = '#fff';
      _ctx.font = '16px sans-serif';
      _ctx.fillText('NS: ' + teamScores[TEAM_NS] + ' pts  |  EW: ' + teamScores[TEAM_EW] + ' pts', CANVAS_W / 2, 220);
      _ctx.font = '14px sans-serif';
      _ctx.fillStyle = '#aaa';
      _ctx.fillText('Click to start a new game', CANVAS_W / 2, 260);
    } else {
      _ctx.fillText('Round Complete', CANVAS_W / 2, 160);

      _ctx.font = '14px sans-serif';
      let y = 200;

      const nsTricks = tricksWon[0] + tricksWon[2];
      const ewTricks = tricksWon[1] + tricksWon[3];

      const sym = SUIT_SYMBOLS[trumpSuit] || '';
      _ctx.fillStyle = '#ccc';
      _ctx.fillText('Trump was: ' + sym + ' ' + trumpSuit.charAt(0).toUpperCase() + trumpSuit.slice(1), CANVAS_W / 2, y);
      y += 25;

      _ctx.fillStyle = '#8cf';
      _ctx.fillText('NS tricks: ' + nsTricks + '  (over book: ' + Math.max(0, nsTricks - BOOK_SIZE) + ')', CANVAS_W / 2, y);
      y += 20;
      _ctx.fillStyle = '#f88';
      _ctx.fillText('EW tricks: ' + ewTricks + '  (over book: ' + Math.max(0, ewTricks - BOOK_SIZE) + ')', CANVAS_W / 2, y);
      y += 30;

      _ctx.fillStyle = '#8cf';
      _ctx.fillText('NS total: ' + teamScores[TEAM_NS] + ' / ' + WINNING_SCORE + ' pts', CANVAS_W / 2, y);
      y += 20;
      _ctx.fillStyle = '#f88';
      _ctx.fillText('EW total: ' + teamScores[TEAM_EW] + ' / ' + WINNING_SCORE + ' pts', CANVAS_W / 2, y);
      y += 30;

      _ctx.fillStyle = '#aaa';
      _ctx.font = '14px sans-serif';
      _ctx.fillText('Click to deal next round', CANVAS_W / 2, y);
    }
    _ctx.restore();
  }

  function drawStatusBar() {
    if (!statusMessage) return;
    _ctx.fillStyle = '#ff0';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText(statusMessage, CANVAS_W / 2, CANVAS_H - 8);
  }

  function drawTrumpIndicator() {
    if (!trumpSuit) return;
    const sym = SUIT_SYMBOLS[trumpSuit];
    const col = SUIT_COLORS[trumpSuit] === '#d00' ? '#f66' : '#ccc';
    _ctx.fillStyle = col;
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trump: ' + sym + ' ' + trumpSuit.charAt(0).toUpperCase() + trumpSuit.slice(1), 15, CANVAS_H - 20);
  }

  function drawAll() {
    drawScorePanel();
    drawAIHands();
    drawTrickArea();
    drawPlayerHand();
    drawTrumpIndicator();

    if (phase === PHASE_TRUMP_REVEAL)
      drawTrumpReveal();
    else if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
    else {
      if (currentTurn === 0 && trickCards.length < 4 && !roundOver)
        statusMessage = 'Your turn \u2014 click a card to play';
      else if (currentTurn !== 0 && !roundOver)
        statusMessage = PLAYER_NAMES[currentTurn] + ' is thinking...';
      else
        statusMessage = '';
      drawStatusBar();
    }
  }

  /* ================================================================
     TRICK RESOLUTION FLOW
     ================================================================ */

  function resolveTrick() {
    if (trickCards.length < 4) return;

    const winner = determineTrickWinner();
    ++tricksWon[winner];
    ++trickCount;

    trickWinnerDisplay = PLAYER_NAMES[winner] + ' wins the trick!';

    if (_host) {
      const label = (winner === 0 ? 'You win' : PLAYER_NAMES[winner] + ' wins') + ' trick #' + trickCount;
      const color = teamOf(winner) === TEAM_NS ? '#4f4' : '#f88';
      _host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 16 });
    }

    phase = PHASE_TRICK_DONE;
    trickDisplayTimer = TRICK_DISPLAY_TIME;
    currentLead = winner;
    currentTurn = winner;
  }

  function clearTrickAndContinue() {
    trickCards = [];
    trickPlayers = [];
    trickWinnerDisplay = '';

    if (trickCount >= HAND_SIZE) {
      endRound();
      return;
    }

    phase = PHASE_PLAYING;
    aiTurnTimer = 0;
  }

  function endRound() {
    scoreRound();
    checkGameOver();
    roundOver = true;
    phase = PHASE_ROUND_OVER;

    if (_host && gameOver) {
      const won = teamScores[TEAM_NS] >= WINNING_SCORE;
      if (won) _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
    }
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      if (score !== 0) {
        teamScores[TEAM_NS] = score;
        teamScores[TEAM_EW] = 0;
      }
      setupGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAll();
    },

    handleClick(mx, my) {
      // Trump reveal -- click to skip
      if (phase === PHASE_TRUMP_REVEAL) {
        trumpRevealTimer = 0;
        phase = PHASE_PLAYING;
        aiTurnTimer = 0;
        return;
      }

      // Round over / game over -- advance
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          if (_host) _host.onRoundOver(true);
        } else {
          dealer = (dealer + 1) % 4;
          deal();
        }
        return;
      }

      // Playing -- player's turn
      if (phase !== PHASE_PLAYING || currentTurn !== 0) return;
      if (trickCards.length >= 4) return;

      const hand = hands[0];
      for (let i = hand.length - 1; i >= 0; --i) {
        const cx = playerCardX(i, hand.length);
        const rightBound = (i === hand.length - 1) ? cx + CE.CARD_W : playerCardX(i + 1, hand.length);
        if (mx >= cx && mx < rightBound && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H) {
          if (isValidPlay(hand[i], hand)) {
            playCard(0, i);
            if (trickCards.length >= 4)
              resolveTrick();
            else
              currentTurn = (currentTurn + 1) % 4;
            aiTurnTimer = 0;
          } else {
            if (_host) _host.floatingText.add(mx, my - 20, 'Must follow suit!', { color: '#f88', size: 14 });
          }
          return;
        }
      }
    },

    handlePointerMove(mx, my) {
      hoveredCard = -1;

      if (phase === PHASE_PLAYING && currentTurn === 0) {
        const hand = hands[0];
        for (let i = hand.length - 1; i >= 0; --i) {
          const cx = playerCardX(i, hand.length);
          const rightBound = (i === hand.length - 1) ? cx + CE.CARD_W : playerCardX(i + 1, hand.length);
          if (mx >= cx && mx < rightBound && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H) {
            hoveredCard = i;
            break;
          }
        }
      }
    },

    handlePointerUp() {},

    handleKey(e) {},

    tick(dt) {
      if (phase === PHASE_ROUND_OVER) return;

      // Trump reveal timer
      if (phase === PHASE_TRUMP_REVEAL) {
        trumpRevealTimer -= dt;
        if (trumpRevealTimer <= 0) {
          phase = PHASE_PLAYING;
          aiTurnTimer = 0;
        }
        return;
      }

      // Trick display timer
      if (phase === PHASE_TRICK_DONE) {
        trickDisplayTimer -= dt;
        if (trickDisplayTimer <= 0)
          clearTrickAndContinue();
        return;
      }

      // AI playing
      if (phase !== PHASE_PLAYING) return;
      if (currentTurn === 0) return;
      if (trickCards.length >= 4) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        aiPlay(currentTurn);
        if (trickCards.length >= 4)
          resolveTrick();
        else
          currentTurn = (currentTurn + 1) % 4;
      }
    },

    sortPlayerHand() { sortHand(hands[0]); },

    cleanup() {
      hands = [[], [], [], []];
      trickCards = [];
      trickPlayers = [];
      tricksWon = [0, 0, 0, 0];
      teamScores = [0, 0];
      roundOver = false;
      gameOver = false;
      phase = PHASE_TRUMP_REVEAL;
      aiTurnTimer = 0;
      hoveredCard = -1;
      statusMessage = '';
      trickWinnerDisplay = '';
      trumpSuit = null;
      trumpCard = null;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) {
      score = s;
      teamScores[TEAM_NS] = s;
    }
  };

  SZ.CardGames.registerVariant('whist', module);

})();
