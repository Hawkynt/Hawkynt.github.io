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

  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const RANK_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];

  /* Round sequence: 1,2,3,4,5,6,7,6,5,4,3,2,1 = 13 rounds */
  const MAX_HAND = 7;
  const ROUND_SIZES = [];
  for (let i = 1; i <= MAX_HAND; ++i) ROUND_SIZES.push(i);
  for (let i = MAX_HAND - 1; i >= 1; --i) ROUND_SIZES.push(i);
  const TOTAL_ROUNDS = ROUND_SIZES.length;

  /* Phases */
  const PHASE_BIDDING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_OVER = 3;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let bids = [-1, -1, -1, -1];
  let bidsDone = [false, false, false, false];
  let tricksWon = [0, 0, 0, 0];
  let cumulativeScores = [0, 0, 0, 0];
  let trickCards = [];
  let trickPlayers = [];
  let trumpCard = null;
  let trumpSuit = null;
  let currentTurn = 0;
  let trickLeader = 0;
  let trickCount = 0;
  let handSize = 1;
  let roundIndex = 0;
  let dealer = 0;
  let biddingPlayer = 0;
  let totalBidsSoFar = 0;
  let phase = PHASE_BIDDING;
  let roundOver = false;
  let gameOver = false;
  let score = 0;

  let trickWinnerIdx = -1;
  let trickDoneTimer = 0;
  const TRICK_DONE_DELAY = 1.2;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  let hoveredCard = -1;
  let hoveredBid = -1;

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

  function isTrump(card) {
    return trumpSuit && card.suit === trumpSuit;
  }

  /* ================================================================
     VALIDITY
     ================================================================ */

  function isValidPlay(card, hand) {
    if (trickCards.length === 0) return true;
    const leadSuit = trickCards[0].suit;
    if (hasSuit(hand, leadSuit)) return card.suit === leadSuit;
    return true;
  }

  function getValidIndices(hand) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand))
        valid.push(i);
    if (valid.length === 0)
      for (let i = 0; i < hand.length; ++i) valid.push(i);
    return valid;
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(trickCards[0]);
    let bestIsTrump = isTrump(trickCards[0]);

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const cTrump = isTrump(c);
      const cStr = cardStrength(c);

      if (bestIsTrump) {
        if (cTrump && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      } else {
        if (cTrump) {
          bestIdx = i;
          bestStr = cStr;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      }
    }
    return trickPlayers[bestIdx];
  }

  /* ================================================================
     BIDDING RULES -- "HOOK" CONSTRAINT
     ================================================================ */

  function isLastBidder(playerIdx) {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (bidsDone[i]) ++count;
    return count === NUM_PLAYERS - 1;
  }

  function forbiddenBid() {
    if (!isLastBidder(biddingPlayer)) return -1;
    const gap = handSize - totalBidsSoFar;
    return gap >= 0 ? gap : -1;
  }

  /* ================================================================
     AI LOGIC -- BIDDING
     ================================================================ */

  function aiBid(playerIdx) {
    const hand = hands[playerIdx];
    let bid = 0;

    for (const c of hand) {
      if (c.rank === 'A') ++bid;
      if (c.rank === 'K' && hand.filter(h => h.suit === c.suit).length >= 2) bid += 0.5;
      if (isTrump(c) && cardStrength(c) >= 11) ++bid;
    }

    const trumpCount = trumpSuit ? hand.filter(c => c.suit === trumpSuit).length : 0;
    if (trumpCount >= 3) bid += 0.5;

    bid = Math.round(bid);
    bid = Math.max(0, Math.min(bid, handSize));

    /* Respect hook rule if last bidder */
    const forbidden = forbiddenBid();
    if (forbidden >= 0 && bid === forbidden) {
      if (bid > 0) --bid;
      else ++bid;
      bid = Math.max(0, Math.min(bid, handSize));
    }

    return bid;
  }

  /* ================================================================
     AI LOGIC -- PLAY
     ================================================================ */

  function aiChooseCard(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return -1;

    const valid = getValidIndices(hand);
    if (valid.length === 1) return valid[0];

    const needed = bids[playerIdx] - tricksWon[playerIdx];
    const isLeading = trickCards.length === 0;
    const leadSuit = isLeading ? null : trickCards[0].suit;

    /* If bid already met, dump lowest cards */
    if (needed <= 0) {
      valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      /* Prefer non-trump losers */
      const nonTrump = valid.filter(i => !isTrump(hand[i]));
      return nonTrump.length > 0 ? nonTrump[0] : valid[0];
    }

    /* Need more tricks */
    if (isLeading) {
      /* Lead high non-trump winner, or high trump */
      const nonTrump = valid.filter(i => !isTrump(hand[i]));
      if (nonTrump.length > 0) {
        nonTrump.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        if (hand[nonTrump[0]].rank === 'A' || hand[nonTrump[0]].rank === 'K')
          return nonTrump[0];
      }
      /* Lead trump to pull them out */
      const trumpIdxs = valid.filter(i => isTrump(hand[i]));
      if (trumpIdxs.length > 0) {
        trumpIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        return trumpIdxs[0];
      }
      valid.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      return valid[0];
    }

    /* Following */
    const followIdxs = valid.filter(i => hand[i].suit === leadSuit);
    if (followIdxs.length > 0) {
      /* Try to win with smallest winner */
      const currentBest = currentTrickBest();
      const winners = followIdxs.filter(i => cardStrength(hand[i]) > currentBest && !trickHasTrump());
      if (winners.length > 0) {
        winners.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        return winners[0];
      }
      /* Can't beat, dump lowest */
      followIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return followIdxs[0];
    }

    /* Void in led suit -- trump in if needed */
    const trumpIdxs = valid.filter(i => isTrump(hand[i]));
    if (trumpIdxs.length > 0 && needed > 0) {
      trumpIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return trumpIdxs[0];
    }

    /* Dump lowest */
    valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
    return valid[0];
  }

  function currentTrickBest() {
    if (trickCards.length === 0) return -1;
    const leadSuit = trickCards[0].suit;
    let best = -1;
    for (const c of trickCards)
      if (c.suit === leadSuit && cardStrength(c) > best)
        best = cardStrength(c);
    return best;
  }

  function trickHasTrump() {
    return trumpSuit && trickCards.some(c => c.suit === trumpSuit);
  }

  /* ================================================================
     SETUP / DEALING
     ================================================================ */

  function deal() {
    const d = CE.shuffle(CE.createDeck());
    handSize = ROUND_SIZES[roundIndex];

    hands = [[], [], [], []];
    trickCards = [];
    trickPlayers = [];
    bids = [-1, -1, -1, -1];
    bidsDone = [false, false, false, false];
    tricksWon = [0, 0, 0, 0];
    trickCount = 0;
    totalBidsSoFar = 0;
    trickWinnerIdx = -1;
    trickDoneTimer = 0;
    aiTurnTimer = 0;
    hoveredCard = -1;
    hoveredBid = -1;
    roundOver = false;
    trumpCard = null;
    trumpSuit = null;

    const totalCards = handSize * NUM_PLAYERS;
    for (let i = 0; i < totalCards; ++i)
      hands[i % NUM_PLAYERS].push(d[i]);

    /* Flip trump from remaining deck */
    if (totalCards < 52) {
      trumpCard = d[totalCards];
      trumpCard.faceUp = true;
      trumpSuit = trumpCard.suit;
    }
    /* No trump when no cards remain (handSize=13 would use all 52) */

    for (const c of hands[0]) c.faceUp = true;
    for (let p = 0; p < NUM_PLAYERS; ++p) sortHand(hands[p]);

    /* Bidding starts left of dealer */
    biddingPlayer = (dealer + 1) % NUM_PLAYERS;
    phase = PHASE_BIDDING;

    if (_host)
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), PLAYER_HAND_Y, i * 0.06);
  }

  function setupGame() {
    cumulativeScores = [0, 0, 0, 0];
    roundIndex = 0;
    dealer = 0;
    gameOver = false;
    score = 0;
    deal();
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function placeBid(playerIdx, bid) {
    bids[playerIdx] = bid;
    bidsDone[playerIdx] = true;
    totalBidsSoFar += bid;

    if (_host) {
      const who = playerIdx === 0 ? 'You bid' : PLAYER_NAMES[playerIdx] + ' bids';
      _host.floatingText.add(CANVAS_W / 2, 300, who + ' ' + bid, { color: '#ff0', size: 14 });
    }

    advanceBidding();
  }

  function advanceBidding() {
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const p = (biddingPlayer + 1 + i) % NUM_PLAYERS;
      if (!bidsDone[p]) {
        biddingPlayer = p;
        aiTurnTimer = 0;
        return;
      }
    }
    /* All bids done */
    startPlaying();
  }

  function startPlaying() {
    phase = PHASE_PLAYING;
    trickLeader = (dealer + 1) % NUM_PLAYERS;
    currentTurn = trickLeader;
    trickCards = [];
    trickPlayers = [];
    aiTurnTimer = 0;
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(playerIdx, cardIdx) {
    const card = hands[playerIdx].splice(cardIdx, 1)[0];
    card.faceUp = true;
    trickCards.push(card);
    trickPlayers.push(playerIdx);

    if (trickCards.length >= NUM_PLAYERS) {
      phase = PHASE_TRICK_DONE;
      trickWinnerIdx = resolveTrickWinner();
      trickDoneTimer = 0;
      return;
    }

    currentTurn = (currentTurn + 1) % NUM_PLAYERS;
  }

  function finishTrick() {
    const winner = trickWinnerIdx;
    ++tricksWon[winner];
    ++trickCount;

    if (_host) {
      const who = winner === 0 ? 'You win' : PLAYER_NAMES[winner] + ' wins';
      _host.floatingText.add(CANVAS_W / 2, 280, who + ' trick #' + trickCount, { color: winner === 0 ? '#4f4' : '#fa0', size: 16 });
    }

    trickCards = [];
    trickPlayers = [];
    trickWinnerIdx = -1;

    if (trickCount >= handSize || hands.every(h => h.length === 0)) {
      endRound();
      return;
    }

    trickLeader = winner;
    currentTurn = winner;
    phase = PHASE_PLAYING;
    aiTurnTimer = 0;
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function endRound() {
    const roundScores = [0, 0, 0, 0];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (tricksWon[p] === bids[p])
        roundScores[p] = 10 + bids[p];
      /* else 0 */
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      cumulativeScores[p] += roundScores[p];

    score = cumulativeScores[0];
    if (_host) _host.onScoreChanged(score);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (roundScores[p] > 0 && _host) {
        const label = PLAYER_NAMES[p] + ' +' + roundScores[p];
        const color = p === 0 ? '#4f4' : '#8cf';
        _host.floatingText.add(CANVAS_W / 2, 260 + p * 18, label, { color, size: 14 });
      }
    }

    ++roundIndex;
    roundOver = true;

    if (roundIndex >= TOTAL_ROUNDS) {
      gameOver = true;
      let best = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        if (cumulativeScores[p] > cumulativeScores[best]) best = p;

      if (_host) {
        const msg = best === 0 ? 'You win the game!' : PLAYER_NAMES[best] + ' wins the game!';
        const col = best === 0 ? '#4f4' : '#f88';
        _host.floatingText.add(CANVAS_W / 2, 200, msg, { color: col, size: 24 });
        if (best === 0) _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
      }
    }

    phase = PHASE_ROUND_OVER;
  }

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 20;

  function playerCardX(idx, total) {
    const maxSpread = 680;
    const spacing = Math.min(52, maxSpread / Math.max(total, 1));
    const totalWidth = (total - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + idx * spacing;
  }

  const TRICK_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },
    { x: CANVAS_W / 2 - CE.CARD_W - 50, y: 250 },
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 190 },
    { x: CANVAS_W / 2 + 50, y: 250 }
  ];

  const AI_HAND_POSITIONS = [
    null,
    { x: 20, y: 160, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 180, y: 20, dir: 'horizontal', label: 'North' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* Bid button layout */
  const BID_BTN_W = 44;
  const BID_BTN_H = 30;
  const BID_AREA_Y = 340;

  function bidBtnRect(bidVal) {
    const maxPerRow = 8;
    const row = Math.floor(bidVal / maxPerRow);
    const col = bidVal % maxPerRow;
    const colsInRow = Math.min(maxPerRow, handSize + 1 - row * maxPerRow);
    const totalW = colsInRow * BID_BTN_W + (colsInRow - 1) * 4;
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

  function drawTitle() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Oh Hell', 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Round ' + (roundIndex + 1) + '/' + TOTAL_ROUNDS + ' \u2014 ' + handSize + ' card' + (handSize > 1 ? 's' : ''), 10, 28);

    _ctx.fillText('Dealer: ' + PLAYER_NAMES[dealer], 10, 42);
  }

  function drawTrumpIndicator() {
    const tx = CANVAS_W - 100;
    const ty = 146;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(_ctx, tx - 10, ty - 22, CE.CARD_W + 20, CE.CARD_H + 36, 6);
    _ctx.fill();

    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Trump', tx + CE.CARD_W / 2 - 10, ty - 6);

    if (trumpCard)
      CE.drawCardFace(_ctx, tx - 10, ty, trumpCard);
    else {
      _ctx.fillStyle = '#888';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('None', tx + CE.CARD_W / 2 - 10, ty + CE.CARD_H / 2);
    }
    _ctx.restore();
  }

  function drawScorePanel() {
    const px = CANVAS_W - 220;
    const py = 10;
    const pw = 210;
    const ph = 128;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.55)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();
    _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    _ctx.lineWidth = 1;
    _ctx.stroke();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scoreboard', px + 8, py + 6);

    /* Header row */
    const lh = 16;
    let y = py + 24;
    _ctx.font = '10px sans-serif';
    _ctx.fillStyle = '#888';
    _ctx.fillText('Player', px + 8, y);
    _ctx.textAlign = 'center';
    _ctx.fillText('Bid', px + 120, y);
    _ctx.fillText('Won', px + 152, y);
    _ctx.textAlign = 'right';
    _ctx.fillText('Total', px + pw - 8, y);
    y += lh;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const isCurrent = currentTurn === p && phase === PHASE_PLAYING;
      _ctx.fillStyle = p === 0 ? '#8f8' : (isCurrent ? '#ff0' : '#ccc');
      _ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], px + 8, y);

      _ctx.textAlign = 'center';
      const bidLabel = bidsDone[p] ? '' + bids[p] : '?';
      _ctx.fillText(bidLabel, px + 120, y);

      if (phase !== PHASE_BIDDING)
        _ctx.fillText('' + tricksWon[p], px + 152, y);

      _ctx.textAlign = 'right';
      _ctx.fillText('' + cumulativeScores[p], px + pw - 8, y);

      /* Highlight if bid met */
      if (phase !== PHASE_BIDDING && bidsDone[p] && tricksWon[p] === bids[p]) {
        _ctx.fillStyle = 'rgba(0,255,0,0.15)';
        _ctx.fillRect(px + 2, y - 1, pw - 4, lh);
      }

      y += lh;
    }

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const yOff = (i === hoveredCard && phase === PHASE_PLAYING && currentTurn === 0) ? -10 : 0;

      CE.drawCardFace(_ctx, x, PLAYER_HAND_Y + yOff, hand[i]);

      /* Hint glow */
      if (_host && _host.hintsEnabled && phase === PHASE_PLAYING && currentTurn === 0 && isValidPlay(hand[i], hand))
        CE.drawHintGlow(_ctx, x, PLAYER_HAND_Y + yOff, CE.CARD_W, CE.CARD_H, _host.hintTime);

      /* Dim invalid */
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
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const hand = hands[p];
      const pos = AI_HAND_POSITIONS[p];
      if (!pos) continue;

      const count = hand.length;
      const isCurrent = currentTurn === p && phase === PHASE_PLAYING;

      _ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
      _ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';

      const label = pos.label + ' (' + count + ')';

      if (pos.dir === 'horizontal') {
        _ctx.fillText(label, CANVAS_W / 2, pos.y);
        const spacing = Math.min(22, 360 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + CE.CARD_W * 0.5;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(_ctx, startX + i * spacing, pos.y + 4, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
      } else {
        const lx = p === 1 ? pos.x + 20 : pos.x;
        _ctx.fillText(label, lx + CE.CARD_W * 0.25, pos.y - 2);
        const spacing = Math.min(18, 200 / Math.max(count, 1));
        for (let i = 0; i < count; ++i) {
          const cx = pos.x + (p === 1 ? 5 : -CE.CARD_W * 0.5 + 5);
          CE.drawCardBack(_ctx, cx, pos.y + 14 + i * spacing, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
        }
      }
    }
  }

  function drawTrickArea() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(255,255,255,0.04)';
    _ctx.beginPath();
    _ctx.arc(CANVAS_W / 2, 280, 90, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.restore();

    for (let i = 0; i < trickCards.length; ++i) {
      const playerIdx = trickPlayers[i];
      const pos = TRICK_POSITIONS[playerIdx];
      CE.drawCardFace(_ctx, pos.x, pos.y, trickCards[i]);

      _ctx.fillStyle = '#ccc';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      const labelY = playerIdx === 2 ? pos.y - 12 : pos.y + CE.CARD_H + 3;
      _ctx.fillText(PLAYER_NAMES[playerIdx], pos.x + CE.CARD_W / 2, labelY);
    }

    if (phase === PHASE_TRICK_DONE && trickWinnerIdx >= 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      const who = trickWinnerIdx === 0 ? 'You take' : PLAYER_NAMES[trickWinnerIdx] + ' takes';
      _ctx.fillText(who + ' the trick', CANVAS_W / 2, 170);
    }
  }

  function drawBiddingUI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Bidding Phase', CANVAS_W / 2, 200);

    _ctx.font = '12px sans-serif';
    _ctx.fillStyle = '#aaa';
    const trumpLabel = trumpSuit ? SUIT_SYMBOLS[trumpSuit] + ' ' + SUIT_NAMES[trumpSuit] : 'No Trump';
    _ctx.fillText(handSize + ' card' + (handSize > 1 ? 's' : '') + ' \u2014 Trump: ' + trumpLabel, CANVAS_W / 2, 222);

    /* Show completed bids */
    let y = 246;
    _ctx.font = '13px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (!bidsDone[p]) continue;
      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.fillText(PLAYER_NAMES[p] + ' bids: ' + bids[p], CANVAS_W / 2, y);
      y += 18;
    }

    /* Show total bids so far */
    _ctx.fillStyle = '#888';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Total bids so far: ' + totalBidsSoFar + ' / ' + handSize + ' tricks', CANVAS_W / 2, y + 4);

    /* Player bid buttons or AI thinking */
    if (biddingPlayer === 0 && !bidsDone[0]) {
      const forbidden = forbiddenBid();

      _ctx.fillStyle = '#ff0';
      _ctx.font = '14px sans-serif';
      _ctx.fillText('Choose your bid:', CANVAS_W / 2, BID_AREA_Y - 18);

      if (forbidden >= 0) {
        _ctx.fillStyle = '#f88';
        _ctx.font = '11px sans-serif';
        _ctx.fillText('(Hook rule: cannot bid ' + forbidden + ')', CANVAS_W / 2, BID_AREA_Y - 4);
      }

      for (let b = 0; b <= handSize; ++b) {
        const r = bidBtnRect(b);
        const isForbidden = b === forbidden;
        const bg = isForbidden ? '#444' : (hoveredBid === b ? '#4a7a4a' : '#2a5a2a');
        const border = isForbidden ? '#666' : (hoveredBid === b ? '#8c8' : '#6c6');
        const textColor = isForbidden ? '#888' : '#fff';
        CE.drawButton(_ctx, r.x, r.y, r.w, r.h, '' + b, { bg, border, textColor, fontSize: 13 });
      }
    } else if (!bidsDone[biddingPlayer]) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '13px sans-serif';
      _ctx.fillText(PLAYER_NAMES[biddingPlayer] + ' is thinking...', CANVAS_W / 2, BID_AREA_Y + 10);
    }
  }

  function drawPlayingUI() {
    if (currentTurn === 0 && trickCards.length < NUM_PLAYERS && !roundOver) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trick ' + (trickCount + 1) + '/' + handSize, 10, CANVAS_H - 16);
  }

  function drawRoundOverUI() {
    _ctx.save();
    const pw = 340;
    const lineH = 22;
    const ph = 90 + NUM_PLAYERS * lineH + (gameOver ? 40 : 20);
    const px = CANVAS_W / 2 - pw / 2;
    const py = 140;

    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Round ' + roundIndex + ' Complete', CANVAS_W / 2, py + 12);

    /* Per-player results */
    _ctx.font = '12px sans-serif';
    let y = py + 42;

    /* Header */
    _ctx.fillStyle = '#888';
    _ctx.textAlign = 'left';
    _ctx.fillText('Player', px + 16, y);
    _ctx.textAlign = 'center';
    _ctx.fillText('Bid', px + 160, y);
    _ctx.fillText('Won', px + 210, y);
    _ctx.fillText('Pts', px + 260, y);
    _ctx.textAlign = 'right';
    _ctx.fillText('Total', px + pw - 16, y);
    y += lineH;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const made = tricksWon[p] === bids[p];
      const roundPts = made ? 10 + bids[p] : 0;
      _ctx.fillStyle = made ? '#4f4' : '#f88';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], px + 16, y);
      _ctx.textAlign = 'center';
      _ctx.fillText('' + bids[p], px + 160, y);
      _ctx.fillText('' + tricksWon[p], px + 210, y);
      _ctx.fillText(made ? '+' + roundPts : '0', px + 260, y);
      _ctx.textAlign = 'right';
      _ctx.fillText('' + cumulativeScores[p], px + pw - 16, y);
      y += lineH;
    }

    if (gameOver) {
      let best = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        if (cumulativeScores[p] > cumulativeScores[best]) best = p;
      const won = best === 0;
      _ctx.fillStyle = won ? '#4f4' : '#f88';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(won ? 'You win!' : PLAYER_NAMES[best] + ' wins!', CANVAS_W / 2, y + 4);
      y += 22;
    }

    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(gameOver ? 'Click to start a new game' : 'Click to continue', CANVAS_W / 2, y + 4);

    _ctx.restore();
  }

  function drawAll() {
    drawTitle();
    drawScorePanel();
    drawTrumpIndicator();
    drawAIHands();

    if (phase === PHASE_BIDDING) {
      drawBiddingUI();
      drawPlayerHand();
    } else if (phase >= PHASE_PLAYING && phase <= PHASE_TRICK_DONE) {
      drawTrickArea();
      drawPlayerHand();
      drawPlayingUI();
    } else if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
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
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H)
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
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAll();
    },

    handleClick(mx, my) {
      /* Round over / game over */
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          score = 0;
          gameOver = false;
          cumulativeScores = [0, 0, 0, 0];
          roundIndex = 0;
          dealer = 0;
          if (_host) _host.onScoreChanged(score);
          deal();
        } else {
          dealer = (dealer + 1) % NUM_PLAYERS;
          deal();
        }
        return;
      }

      /* Bidding -- player bid selection */
      if (phase === PHASE_BIDDING && biddingPlayer === 0 && !bidsDone[0]) {
        const forbidden = forbiddenBid();
        for (let b = 0; b <= handSize; ++b) {
          if (b === forbidden) continue;
          const r = bidBtnRect(b);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            placeBid(0, b);
            return;
          }
        }
        return;
      }

      /* Playing -- player's turn */
      if (phase !== PHASE_PLAYING || currentTurn !== 0) return;
      if (trickCards.length >= NUM_PLAYERS) return;

      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const hand = hands[0];
      if (isValidPlay(hand[idx], hand)) {
        playCard(0, idx);
        if (trickCards.length >= NUM_PLAYERS)
          return; /* trick done handled in playCard */
      } else {
        const leadSuit = trickCards[0].suit;
        const reason = 'Must follow ' + SUIT_NAMES[leadSuit] + '!';
        if (_host) _host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
      }
    },

    handlePointerMove(mx, my) {
      hoveredCard = -1;
      hoveredBid = -1;

      if (phase === PHASE_PLAYING && currentTurn === 0)
        hoveredCard = hitTestPlayerCard(mx, my);

      if (phase === PHASE_BIDDING && biddingPlayer === 0 && !bidsDone[0]) {
        const forbidden = forbiddenBid();
        for (let b = 0; b <= handSize; ++b) {
          if (b === forbidden) continue;
          const r = bidBtnRect(b);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            hoveredBid = b;
            break;
          }
        }
      }
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {},

    tick(dt) {
      if (phase === PHASE_ROUND_OVER) return;

      /* Trick done timer */
      if (phase === PHASE_TRICK_DONE) {
        trickDoneTimer += dt;
        if (trickDoneTimer >= TRICK_DONE_DELAY)
          finishTrick();
        return;
      }

      /* AI bidding */
      if (phase === PHASE_BIDDING && biddingPlayer !== 0 && !bidsDone[biddingPlayer]) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          const bid = aiBid(biddingPlayer);
          placeBid(biddingPlayer, bid);
        }
        return;
      }

      /* AI playing */
      if (phase !== PHASE_PLAYING) return;
      if (currentTurn === 0) return;
      if (trickCards.length >= NUM_PLAYERS) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        const idx = aiChooseCard(currentTurn);
        if (idx >= 0)
          playCard(currentTurn, idx);
      }
    },

    cleanup() {
      hands = [[], [], [], []];
      trickCards = [];
      trickPlayers = [];
      bids = [-1, -1, -1, -1];
      bidsDone = [false, false, false, false];
      tricksWon = [0, 0, 0, 0];
      cumulativeScores = [0, 0, 0, 0];
      trumpCard = null;
      trumpSuit = null;
      roundOver = false;
      gameOver = false;
      phase = PHASE_BIDDING;
      aiTurnTimer = 0;
      hoveredCard = -1;
      hoveredBid = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('ohhell', module);

})();
