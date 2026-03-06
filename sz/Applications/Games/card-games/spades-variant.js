;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Suits & Ranks (game-specific ordering) ── */
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const STRENGTH_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const TRUMP_SUIT = 'spades';

  /* ── Players: 0=South(human), 1=West(AI), 2=North(AI partner), 3=East(AI) ── */
  /* Teams: NS = players 0,2   EW = players 1,3 */
  const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];
  const TEAM_NS = 0;
  const TEAM_EW = 1;

  /* ── Phases ── */
  const PHASE_BIDDING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_OVER = 3;

  /* ── Game state ── */
  let hands = [[], [], [], []];
  let bids = [0, 0, 0, 0];
  let bidsDone = [false, false, false, false];
  let tricksWon = [0, 0, 0, 0];
  let teamScores = [0, 0];
  let teamBags = [0, 0];
  let trickCards = [];
  let trickPlayers = [];
  let currentTurn = 0;
  let currentLead = 0;
  let spadesBroken = false;
  let phase = PHASE_BIDDING;
  let biddingPlayer = 0;
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let trickCount = 0;
  let trickWinnerDisplay = '';
  let trickDisplayTimer = 0;
  let selectedCard = -1;
  let hoveredCard = -1;
  let hoveredBid = -1;
  let statusMessage = '';

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;
  const TRICK_DISPLAY_TIME = 1.2;

  /* ================================================================
     DRAWING HELPERS
     ================================================================ */

  function lightenColor(hex, amount) {
    const amt = amount || 40;
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* ================================================================
     CARD LOGIC
     ================================================================ */

  function cardStrength(card) {
    return STRENGTH_ORDER.indexOf(card.rank);
  }

  function teamOf(player) {
    return (player === 0 || player === 2) ? TEAM_NS : TEAM_EW;
  }

  function isValidPlay(card, hand) {
    const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;

    // Leading
    if (!leadSuit) {
      // Spades can't be led until broken (unless hand is all spades)
      if (card.suit === TRUMP_SUIT && !spadesBroken) {
        const hasNonSpade = hand.some(c => c.suit !== TRUMP_SUIT);
        return !hasNonSpade;
      }
      return true;
    }

    // Following
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    if (hasLeadSuit)
      return card.suit === leadSuit;

    // Can't follow suit -- any card is fine (including spades)
    return true;
  }

  function determineTrickWinner() {
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStrength = cardStrength(trickCards[0]);
    let bestIsTrump = trickCards[0].suit === TRUMP_SUIT;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const isTrump = c.suit === TRUMP_SUIT;
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

  function sortHand(hand) {
    const suitOrder = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiBid(playerIdx) {
    const hand = hands[playerIdx];
    let bid = 0;

    for (const c of hand) {
      // Count aces
      if (c.rank === 'A') ++bid;
      // Count kings in suits with 3+ cards
      if (c.rank === 'K') {
        const suitCount = hand.filter(h => h.suit === c.suit).length;
        if (suitCount >= 3) ++bid;
      }
    }

    // Count spade length beyond 3
    const spadeCount = hand.filter(c => c.suit === TRUMP_SUIT).length;
    if (spadeCount >= 4)
      bid += spadeCount - 3;

    // Count high spades specifically
    const hasAceSpades = hand.some(c => c.suit === TRUMP_SUIT && c.rank === 'A');
    const hasKingSpades = hand.some(c => c.suit === TRUMP_SUIT && c.rank === 'K');
    const hasQueenSpades = hand.some(c => c.suit === TRUMP_SUIT && c.rank === 'Q');
    if (hasAceSpades && hasKingSpades && hasQueenSpades && spadeCount >= 5)
      ++bid;

    // Clamp to reasonable range; occasionally bid nil with a weak hand
    if (bid === 0) {
      const highCount = hand.filter(c => cardStrength(c) >= 10).length;
      if (highCount <= 1 && spadeCount <= 2 && Math.random() < 0.15)
        return 0; // nil bid
      bid = 1;
    }

    return Math.min(bid, 7);
  }

  function aiPlay(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return;

    const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
    const valid = [];
    for (let i = 0; i < hand.length; ++i) {
      if (isValidPlay(hand[i], hand))
        valid.push(i);
    }
    if (valid.length === 0) return;

    // Partner of this AI
    const partnerIdx = (playerIdx + 2) % 4;
    const isPartnerLeading = trickPlayers.length > 0 && trickPlayers[0] === partnerIdx;

    // Check if partner is currently winning the trick
    let partnerWinning = false;
    if (trickCards.length > 0) {
      const tempWinner = determineTrickWinnerPartial();
      partnerWinning = teamOf(tempWinner) === teamOf(playerIdx);
    }

    // Nil bidder handling: if this AI bid nil, play lowest valid card
    if (bids[playerIdx] === 0) {
      valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      playCard(playerIdx, valid[0]);
      return;
    }

    if (!leadSuit) {
      // Leading: play highest non-spade winner, or spade if broken/all spades
      const nonSpades = valid.filter(i => hand[i].suit !== TRUMP_SUIT);
      const target = nonSpades.length > 0 ? nonSpades : valid;
      target.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      playCard(playerIdx, target[0]);
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
        // Try to win: play highest of suit
        followSuit.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        // Only play high if it can actually win
        const currentBest = currentTrickBestStrength();
        const bestFollow = followSuit[0];
        if (hand[bestFollow].suit === leadSuit && cardStrength(hand[bestFollow]) > currentBest && !trickHasTrump()) {
          playCard(playerIdx, bestFollow);
        } else {
          // Can't beat it, dump lowest
          followSuit.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
          playCard(playerIdx, followSuit[0]);
        }
      }
      return;
    }

    // Can't follow suit
    if (partnerWinning) {
      // Dump lowest non-trump if possible
      const nonTrumps = valid.filter(i => hand[i].suit !== TRUMP_SUIT);
      const dump = nonTrumps.length > 0 ? nonTrumps : valid;
      dump.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      playCard(playerIdx, dump[0]);
    } else {
      // Trump in with lowest spade, or dump lowest
      const trumps = valid.filter(i => hand[i].suit === TRUMP_SUIT);
      if (trumps.length > 0) {
        // Use lowest trump that wins
        trumps.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        playCard(playerIdx, trumps[0]);
      } else {
        valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        playCard(playerIdx, valid[0]);
      }
    }
  }

  function determineTrickWinnerPartial() {
    if (trickCards.length === 0) return -1;
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStrength = cardStrength(trickCards[0]);
    let bestIsTrump = trickCards[0].suit === TRUMP_SUIT;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const isTrump = c.suit === TRUMP_SUIT;
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
    for (const c of trickCards) {
      if (c.suit === leadSuit && cardStrength(c) > best)
        best = cardStrength(c);
    }
    return best;
  }

  function trickHasTrump() {
    return trickCards.some(c => c.suit === TRUMP_SUIT);
  }

  function playCard(playerIdx, handIndex) {
    const card = hands[playerIdx].splice(handIndex, 1)[0];
    card.faceUp = true;
    trickCards.push(card);
    trickPlayers.push(playerIdx);

    // Check if spades broken
    if (card.suit === TRUMP_SUIT && trickCards.length > 1)
      spadesBroken = true;
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function scoreRound() {
    for (let team = 0; team < 2; ++team) {
      const p1 = team === TEAM_NS ? 0 : 1;
      const p2 = team === TEAM_NS ? 2 : 3;
      const teamBid = bids[p1] + bids[p2];
      const teamTricks = tricksWon[p1] + tricksWon[p2];

      // Handle nil bids individually
      let nilBonus = 0;
      for (const p of [p1, p2]) {
        if (bids[p] === 0) {
          if (tricksWon[p] === 0)
            nilBonus += 100;
          else
            nilBonus -= 100;
        }
      }

      // Non-nil scoring
      const nonNilBid = (bids[p1] === 0 ? 0 : bids[p1]) + (bids[p2] === 0 ? 0 : bids[p2]);
      const nonNilTricks = (bids[p1] === 0 ? 0 : tricksWon[p1]) + (bids[p2] === 0 ? 0 : tricksWon[p2]);

      if (nonNilBid > 0) {
        if (nonNilTricks >= nonNilBid) {
          const over = nonNilTricks - nonNilBid;
          teamScores[team] += nonNilBid * 10 + over;
          teamBags[team] += over;
          // Sandbag penalty
          if (teamBags[team] >= 10) {
            teamScores[team] -= 100;
            teamBags[team] -= 10;
          }
        } else {
          // Failed to make bid
          teamScores[team] -= nonNilBid * 10;
        }
      }

      teamScores[team] += nilBonus;
    }

    score = teamScores[TEAM_NS];
    if (_host) _host.onScoreChanged(score);
  }

  function checkGameOver() {
    if (teamScores[TEAM_NS] >= 500 || teamScores[TEAM_EW] >= 500) {
      gameOver = true;
      return;
    }
    if (teamScores[TEAM_NS] <= -200 || teamScores[TEAM_EW] <= -200) {
      gameOver = true;
      return;
    }
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function deal() {
    const d = CE.shuffle(CE.createDeck());

    hands = [[], [], [], []];
    for (let i = 0; i < 52; ++i)
      hands[i % 4].push(d[i]);

    for (const c of hands[0]) c.faceUp = true;
    sortHand(hands[0]);
    for (let p = 1; p < 4; ++p) sortHand(hands[p]);

    trickCards = [];
    trickPlayers = [];
    bids = [0, 0, 0, 0];
    bidsDone = [false, false, false, false];
    tricksWon = [0, 0, 0, 0];
    spadesBroken = false;
    trickCount = 0;
    roundOver = false;
    phase = PHASE_BIDDING;
    biddingPlayer = 0;
    aiTurnTimer = 0;
    trickWinnerDisplay = '';
    trickDisplayTimer = 0;
    selectedCard = -1;
    hoveredCard = -1;
    hoveredBid = -1;
    statusMessage = 'Your bid?';

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  function setupGame() {
    teamScores = [0, 0];
    teamBags = [0, 0];
    gameOver = false;
    score = 0;
    deal();
  }

  /* ================================================================
     LAYOUT CONSTANTS
     ================================================================ */

  const PLAYER_HAND_Y = 470;
  const PLAYER_HAND_START = 100;

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

  /* Bid button layout */
  const BID_BTN_W = 44;
  const BID_BTN_H = 30;
  const BID_ROWS = [
    { start: 0, end: 7 },
    { start: 7, end: 14 }
  ];
  const BID_AREA_Y = 320;

  function bidBtnRect(bidVal) {
    let row, col;
    if (bidVal <= 6) {
      row = 0;
      col = bidVal;
    } else {
      row = 1;
      col = bidVal - 7;
    }
    const totalCols = 7;
    const totalW = totalCols * BID_BTN_W + (totalCols - 1) * 4;
    const startX = (CANVAS_W - totalW) / 2;
    return {
      x: startX + col * (BID_BTN_W + 4),
      y: BID_AREA_Y + row * (BID_BTN_H + 4),
      w: BID_BTN_W,
      h: BID_BTN_H
    };
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 220;
    const py = 10;
    const pw = 210;
    const ph = 140;

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
    _ctx.fillText('Scoreboard', px + 10, py + 8);

    _ctx.font = '11px sans-serif';
    const lh = 15;
    let y = py + 28;

    // Team headers
    _ctx.fillStyle = '#8cf';
    _ctx.fillText('NS (You + Partner)', px + 10, y);
    _ctx.fillStyle = '#f88';
    _ctx.fillText('EW (West + East)', px + 110, y);
    y += lh + 2;

    // Scores
    _ctx.fillStyle = '#fff';
    _ctx.fillText('Score: ' + teamScores[TEAM_NS], px + 10, y);
    _ctx.fillText('Score: ' + teamScores[TEAM_EW], px + 110, y);
    y += lh;

    _ctx.fillText('Bags: ' + teamBags[TEAM_NS], px + 10, y);
    _ctx.fillText('Bags: ' + teamBags[TEAM_EW], px + 110, y);
    y += lh + 2;

    // Current round bids and tricks
    if (phase !== PHASE_BIDDING || bidsDone.some(b => b)) {
      _ctx.fillStyle = '#aaa';
      _ctx.fillText('Bids:', px + 10, y);
      let bx = px + 50;
      for (let p = 0; p < 4; ++p) {
        const label = PLAYER_NAMES[p][0] + ':' + (bidsDone[p] ? (bids[p] === 0 ? 'Nil' : bids[p]) : '?');
        _ctx.fillStyle = teamOf(p) === TEAM_NS ? '#8cf' : '#f88';
        _ctx.fillText(label, bx, y);
        bx += 40;
      }
      y += lh;

      if (phase !== PHASE_BIDDING) {
        _ctx.fillStyle = '#aaa';
        _ctx.fillText('Won:', px + 10, y);
        bx = px + 50;
        for (let p = 0; p < 4; ++p) {
          _ctx.fillStyle = teamOf(p) === TEAM_NS ? '#8cf' : '#f88';
          _ctx.fillText(PLAYER_NAMES[p][0] + ':' + tricksWon[p], bx, y);
          bx += 40;
        }
      }
    }

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
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const yOff = (i === hoveredCard && phase === PHASE_PLAYING && currentTurn === 0) ? -10 : 0;

      // Highlight valid cards on player's turn
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
        // Vertical layout for West and East
        const spacing = Math.min(18, 250 / Math.max(count, 1));
        const totalH = (count - 1) * spacing + CE.CARD_H * 0.45;
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
    // Draw a subtle center area
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

      // Player label under/over card
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

  function drawBiddingUI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Bidding Phase', CANVAS_W / 2, 220);

    // Show who has bid
    let y = 248;
    _ctx.font = '13px sans-serif';
    for (let p = 0; p < 4; ++p) {
      if (bidsDone[p]) {
        const bidText = bids[p] === 0 ? 'Nil' : '' + bids[p];
        _ctx.fillStyle = teamOf(p) === TEAM_NS ? '#8cf' : '#f88';
        _ctx.fillText(PLAYER_NAMES[p] + ' bids: ' + bidText, CANVAS_W / 2, y);
        y += 18;
      }
    }

    // Waiting for AI or show buttons for player
    if (biddingPlayer === 0 && !bidsDone[0]) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = '14px sans-serif';
      _ctx.fillText('Choose your bid (0 = Nil):', CANVAS_W / 2, BID_AREA_Y - 16);

      for (let b = 0; b <= 13; ++b) {
        const r = bidBtnRect(b);
        const label = b === 0 ? 'Nil' : '' + b;
        const color = b === 0 ? '#a44' : '#4a4';
        const bg = hoveredBid === b ? lightenColor(color) : color;
        CE.drawButton(_ctx, r.x, r.y, r.w, r.h, label, { bg: bg, border: lightenColor(color, 40), textColor: '#fff', fontSize: 12 });
      }
    } else if (!bidsDone[biddingPlayer]) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '13px sans-serif';
      _ctx.fillText(PLAYER_NAMES[biddingPlayer] + ' is thinking...', CANVAS_W / 2, BID_AREA_Y + 10);
    }
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
      const nsWin = teamScores[TEAM_NS] >= 500;
      const ewLose = teamScores[TEAM_EW] <= -200;
      const won = nsWin || ewLose;
      _ctx.fillStyle = won ? '#4f4' : '#f44';
      _ctx.fillText(won ? 'You Win the Game!' : 'Game Over - You Lose!', CANVAS_W / 2, 200);
      _ctx.fillStyle = '#fff';
      _ctx.font = '16px sans-serif';
      _ctx.fillText('NS: ' + teamScores[TEAM_NS] + '  |  EW: ' + teamScores[TEAM_EW], CANVAS_W / 2, 240);
      _ctx.font = '14px sans-serif';
      _ctx.fillStyle = '#aaa';
      _ctx.fillText('Click to start a new game', CANVAS_W / 2, 280);
    } else {
      _ctx.fillText('Round Complete', CANVAS_W / 2, 180);

      _ctx.font = '14px sans-serif';
      let y = 220;

      for (let p = 0; p < 4; ++p) {
        const bidLabel = bids[p] === 0 ? 'Nil' : '' + bids[p];
        _ctx.fillStyle = teamOf(p) === TEAM_NS ? '#8cf' : '#f88';
        _ctx.fillText(PLAYER_NAMES[p] + ': bid ' + bidLabel + ', won ' + tricksWon[p], CANVAS_W / 2, y);
        y += 20;
      }

      y += 10;
      _ctx.fillStyle = '#8cf';
      _ctx.fillText('NS Score: ' + teamScores[TEAM_NS] + ' (Bags: ' + teamBags[TEAM_NS] + ')', CANVAS_W / 2, y);
      y += 20;
      _ctx.fillStyle = '#f88';
      _ctx.fillText('EW Score: ' + teamScores[TEAM_EW] + ' (Bags: ' + teamBags[TEAM_EW] + ')', CANVAS_W / 2, y);
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

  function drawSpadesBrokenIndicator() {
    _ctx.fillStyle = spadesBroken ? '#8f8' : '#888';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('\u2660 ' + (spadesBroken ? 'Broken' : 'Not broken'), 15, CANVAS_H - 20);
  }

  function drawAll() {
    drawScorePanel();
    drawAIHands();
    drawTrickArea();
    drawPlayerHand();
    drawSpadesBrokenIndicator();

    if (phase === PHASE_BIDDING)
      drawBiddingUI();
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
     TRICK RESOLUTION
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

    if (trickCount >= 13) {
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

    if (_host) {
      if (gameOver) {
        const won = teamScores[TEAM_NS] >= 500 || teamScores[TEAM_EW] <= -200;
        if (won) _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    }
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function advanceBidding() {
    // Find next player who hasn't bid
    for (let i = 0; i < 4; ++i) {
      const p = (biddingPlayer + 1 + i) % 4;
      if (!bidsDone[p]) {
        biddingPlayer = p;
        return;
      }
    }
    // All bids done -- start playing
    startPlaying();
  }

  function startPlaying() {
    phase = PHASE_PLAYING;
    // Player to left of dealer leads; simplified: player 0 leads first round
    currentLead = 0;
    currentTurn = 0;
    aiTurnTimer = 0;
    statusMessage = '';
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
      // Round over / game over -- advance
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          if (_host) _host.onRoundOver(true);
        } else {
          deal();
        }
        return;
      }

      // Bidding -- player bid selection
      if (phase === PHASE_BIDDING && biddingPlayer === 0 && !bidsDone[0]) {
        for (let b = 0; b <= 13; ++b) {
          const r = bidBtnRect(b);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            bids[0] = b;
            bidsDone[0] = true;
            advanceBidding();
            return;
          }
        }
        return;
      }

      // Playing -- player's turn
      if (phase !== PHASE_PLAYING || currentTurn !== 0) return;
      if (trickCards.length >= 4) return;

      const hand = hands[0];
      // Click detection: iterate from right to left for overlapping cards
      for (let i = hand.length - 1; i >= 0; --i) {
        const cx = playerCardX(i, hand.length);
        const rightBound = (i === hand.length - 1) ? cx + CE.CARD_W : playerCardX(i + 1, hand.length);
        if (mx >= cx && mx < rightBound && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H) {
          if (isValidPlay(hand[i], hand)) {
            playCard(0, i);
            if (trickCards.length >= 4) {
              resolveTrick();
            } else {
              currentTurn = (currentTurn + 1) % 4;
              aiTurnTimer = 0;
            }
          } else {
            if (_host) _host.floatingText.add(mx, my - 20, 'Invalid play!', { color: '#f88', size: 14 });
          }
          return;
        }
      }
    },

    handlePointerMove(mx, my) {
      hoveredCard = -1;
      hoveredBid = -1;

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

      if (phase === PHASE_BIDDING && biddingPlayer === 0 && !bidsDone[0]) {
        for (let b = 0; b <= 13; ++b) {
          const r = bidBtnRect(b);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            hoveredBid = b;
            break;
          }
        }
      }
    },

    handlePointerUp() {},

    handleKey(e) {},

    tick(dt) {
      if (phase === PHASE_ROUND_OVER) return;

      // Trick display timer
      if (phase === PHASE_TRICK_DONE) {
        trickDisplayTimer -= dt;
        if (trickDisplayTimer <= 0)
          clearTrickAndContinue();
        return;
      }

      // AI bidding
      if (phase === PHASE_BIDDING && biddingPlayer !== 0 && !bidsDone[biddingPlayer]) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          bids[biddingPlayer] = aiBid(biddingPlayer);
          bidsDone[biddingPlayer] = true;
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[biddingPlayer] + ' bids ' + (bids[biddingPlayer] === 0 ? 'Nil' : bids[biddingPlayer]), { color: '#ff0', size: 14 });
          advanceBidding();
        }
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

    cleanup() {
      hands = [[], [], [], []];
      trickCards = [];
      trickPlayers = [];
      bids = [0, 0, 0, 0];
      bidsDone = [false, false, false, false];
      tricksWon = [0, 0, 0, 0];
      teamScores = [0, 0];
      teamBags = [0, 0];
      roundOver = false;
      gameOver = false;
      phase = PHASE_BIDDING;
      aiTurnTimer = 0;
      selectedCard = -1;
      hoveredCard = -1;
      hoveredBid = -1;
      statusMessage = '';
      trickWinnerDisplay = '';
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

  SZ.CardGames.registerVariant('spades', module);

})();
