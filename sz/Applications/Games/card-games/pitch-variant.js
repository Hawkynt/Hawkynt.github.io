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
  const STRENGTH_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const GAME_POINT_VALUES = { 'A': 4, 'K': 3, 'Q': 2, 'J': 1, '10': 10 };

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 6;
  const WIN_SCORE = 11;

  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];

  /* -- Phases -- */
  const PHASE_BIDDING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_SCORE = 3;
  const PHASE_GAME_OVER = 4;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let trumpSuit = null;
  let bidder = -1;
  let bidAmount = 0;
  let playerBids = [0, 0, 0, 0];     // 0 = passed
  let playerBidDone = [false, false, false, false];
  let biddingPlayer = 0;
  let dealer = 0;

  let currentTurn = 0;
  let trickLeader = 0;
  let trickCards = [];
  let trickPlayers = [];
  let trickCount = 0;

  let capturedCards = [[], [], [], []]; // cards won by each player
  let playerScores = [0, 0, 0, 0];     // cumulative scores

  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let phase = PHASE_BIDDING;

  let trickWinnerIdx = -1;
  let trickDoneTimer = 0;
  const TRICK_DONE_DELAY = 1.2;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  let hoveredCard = -1;
  let hoveredBtn = '';
  let roundMessages = [];

  /* ================================================================
     UTILITIES
     ================================================================ */

  function leftOf(p) {
    return (p + 1) % NUM_PLAYERS;
  }

  function cardStrength(card) {
    return STRENGTH_ORDER.indexOf(card.rank);
  }

  function isTrump(card) {
    return card.suit === trumpSuit;
  }

  function gamePointValue(card) {
    return GAME_POINT_VALUES[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };
    hand.sort((a, b) => {
      const ta = isTrump(a) ? 1 : 0;
      const tb = isTrump(b) ? 1 : 0;
      if (ta !== tb) return ta - tb;
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  /* ================================================================
     VALIDITY
     ================================================================ */

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

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

  function resolveTrickWinnerPartial() {
    if (trickCards.length === 0) return -1;
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
     AI - BIDDING
     ================================================================ */

  function evaluateSuitForBid(hand, suit) {
    let value = 0;
    let count = 0;
    for (const c of hand) {
      if (c.suit !== suit) continue;
      ++count;
      if (c.rank === 'A') value += 1.5;
      else if (c.rank === 'K') value += 1.0;
      else if (c.rank === 'Q') value += 0.5;
      else if (c.rank === 'J') value += 1.2;
      else if (c.rank === '2') value += 0.8; // guaranteed low point
    }
    // Length bonus
    if (count >= 3) value += (count - 2) * 0.5;
    return value;
  }

  function aiBid(playerIdx) {
    const hand = hands[playerIdx];
    let bestSuit = null;
    let bestVal = 0;

    for (const s of CE.SUITS) {
      const val = evaluateSuitForBid(hand, s);
      if (val > bestVal) {
        bestVal = val;
        bestSuit = s;
      }
    }

    // Convert evaluation to bid
    if (bestVal >= 4.0) return { bid: 4, suit: bestSuit };
    if (bestVal >= 3.0) return { bid: 3, suit: bestSuit };
    if (bestVal >= 2.0) return { bid: 2, suit: bestSuit };

    // If dealer and everyone passed, must bid minimum
    if (playerIdx === dealer && !playerBidDone.slice(0, NUM_PLAYERS).some((d, i) => d && playerBids[i] > 0))
      return { bid: 1, suit: bestSuit || CE.SUITS[0] };

    return { bid: 0, suit: null }; // pass
  }

  /* ================================================================
     AI - PLAY
     ================================================================ */

  function aiChooseCard(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return -1;

    const valid = getValidIndices(hand);
    if (valid.length === 1) return valid[0];

    const isLeading = trickCards.length === 0;

    if (isLeading) {
      // Lead with high trump to draw them out
      const trumpIdxs = valid.filter(i => isTrump(hand[i]));
      if (trumpIdxs.length >= 2) {
        trumpIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        return trumpIdxs[0];
      }
      // Lead non-trump ace/king
      const highNonTrump = valid.filter(i => !isTrump(hand[i]) && (hand[i].rank === 'A' || hand[i].rank === 'K'));
      if (highNonTrump.length > 0) {
        highNonTrump.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        return highNonTrump[0];
      }
      // Lead lowest
      valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return valid[0];
    }

    // Following
    const leadSuit = trickCards[0].suit;
    const followIdxs = valid.filter(i => hand[i].suit === leadSuit);

    // Check if current winner is self (unlikely mid-trick but guard)
    const currentWinner = resolveTrickWinnerPartial();

    // Protect the Jack of trump: don't play it unless we must or can clearly win
    const jackOfTrumpIdx = valid.find(i => hand[i].suit === trumpSuit && hand[i].rank === 'J');

    if (followIdxs.length > 0) {
      // Try to win
      followIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      const bestFollow = followIdxs[0];

      // If we can win, play highest; but avoid Jack of trump if we have alternatives
      if (jackOfTrumpIdx !== undefined && followIdxs.length > 1 && followIdxs[0] === jackOfTrumpIdx) {
        // Play second-best if it can still win
        const secondBest = followIdxs[1];
        const winnerStr = trickCards.reduce((best, c) => {
          if (c.suit === leadSuit || isTrump(c)) return Math.max(best, cardStrength(c));
          return best;
        }, -1);
        if (cardStrength(hand[secondBest]) > winnerStr)
          return secondBest;
      }
      return bestFollow;
    }

    // Can't follow suit -- trump in or dump
    const trumpIdxs = valid.filter(i => isTrump(hand[i]));
    if (trumpIdxs.length > 0) {
      // Trump with lowest trump (save Jack if possible)
      trumpIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      if (trumpIdxs.length > 1 && trumpIdxs[0] === jackOfTrumpIdx)
        return trumpIdxs[1]; // save the Jack, trump with next lowest
      return trumpIdxs[0];
    }

    // Dump lowest
    valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
    return valid[0];
  }

  /* ================================================================
     DEALING
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeck());
    hands = [[], [], [], []];
    capturedCards = [[], [], [], []];
    trickCards = [];
    trickPlayers = [];
    trickCount = 0;
    trumpSuit = null;
    bidder = -1;
    bidAmount = 0;
    playerBids = [0, 0, 0, 0];
    playerBidDone = [false, false, false, false];
    hoveredCard = -1;
    hoveredBtn = '';
    trickWinnerIdx = -1;
    trickDoneTimer = 0;
    aiTurnTimer = 0;
    roundMessages = [];
    roundOver = false;

    // Deal 6 cards each
    for (let i = 0; i < NUM_PLAYERS * HAND_SIZE; ++i)
      hands[i % NUM_PLAYERS].push(d[i]);

    for (const c of hands[0])
      c.faceUp = true;

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    biddingPlayer = leftOf(dealer);
    phase = PHASE_BIDDING;

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function processBid(playerIdx, bid, suit) {
    playerBids[playerIdx] = bid;
    playerBidDone[playerIdx] = true;

    if (bid > 0 && bid > bidAmount) {
      bidder = playerIdx;
      bidAmount = bid;
      if (suit) trumpSuit = suit;
    }
  }

  function advanceBidding() {
    let next = leftOf(biddingPlayer);

    // Check if we've gone around to the dealer
    if (next === leftOf(dealer) && playerBidDone[biddingPlayer]) {
      // All players have had a chance to bid
      finishBidding();
      return;
    }

    // If next player is back to start and all have bid, finish
    let allBid = true;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (!playerBidDone[i]) {
        allBid = false;
        break;
      }
    }
    if (allBid) {
      finishBidding();
      return;
    }

    biddingPlayer = next;
    aiTurnTimer = 0;
  }

  function finishBidding() {
    // If nobody bid, dealer must take it at 1 ("steal the deal")
    if (bidder < 0) {
      bidder = dealer;
      bidAmount = 1;
      // Dealer picks best suit
      const result = aiBid(dealer);
      trumpSuit = result.suit || CE.SUITS[0];
      if (dealer === 0) {
        // Human is dealer and was forced -- we already picked from their best suit eval
        // Let the human's chosen trump stand from player choice if they had one
      }
      playerBids[dealer] = 1;

      if (_host) {
        const who = dealer === 0 ? 'You steal' : PLAYER_NAMES[dealer] + ' steals';
        _host.floatingText.add(CANVAS_W / 2, 250, who + ' the deal at 1', { color: '#ff0', size: 16 });
      }
    }

    // Bidder names trump and leads first trick
    if (_host) {
      const who = bidder === 0 ? 'You bid' : PLAYER_NAMES[bidder] + ' bids';
      _host.floatingText.add(CANVAS_W / 2, 230, who + ' ' + bidAmount + ' \u2014 ' + SUIT_SYMBOLS[trumpSuit] + ' ' + SUIT_NAMES[trumpSuit], { color: '#ff0', size: 16 });
    }

    startPlaying();
  }

  function startPlaying() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);
    for (const c of hands[0])
      c.faceUp = true;

    phase = PHASE_PLAYING;
    trickLeader = bidder;
    currentTurn = bidder;
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

    currentTurn = leftOf(currentTurn);
  }

  function finishTrick() {
    const winner = trickWinnerIdx;
    ++trickCount;

    // Collect cards for winner
    for (const c of trickCards)
      capturedCards[winner].push(c);

    if (_host) {
      const who = winner === 0 ? 'You' : PLAYER_NAMES[winner];
      const label = who + ' win trick #' + trickCount;
      const color = winner === 0 ? '#4f4' : '#f88';
      _host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 16 });
    }

    trickCards = [];
    trickPlayers = [];
    trickWinnerIdx = -1;

    if (trickCount >= HAND_SIZE) {
      endRound();
      return;
    }

    trickLeader = winner;
    currentTurn = winner;
    phase = PHASE_PLAYING;
    aiTurnTimer = 0;
  }

  /* ================================================================
     ROUND SCORING
     ================================================================ */

  function endRound() {
    // Determine the 4 pitch scoring points
    let highPlayer = -1, lowPlayer = -1, jackPlayer = -1, gamePlayer = -1;
    let highRank = -1, lowRank = 14;

    const gamePointTotals = [0, 0, 0, 0];

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      for (const c of capturedCards[p]) {
        gamePointTotals[p] += gamePointValue(c);

        if (c.suit === trumpSuit) {
          const str = cardStrength(c);
          if (str > highRank) {
            highRank = str;
            highPlayer = p;
          }
          if (str < lowRank) {
            lowRank = str;
            lowPlayer = p;
          }
          if (c.rank === 'J')
            jackPlayer = p;
        }
      }
    }

    // Game point: highest total of game-point-valued cards; tie = nobody gets it
    let bestGamePts = -1;
    let gameTied = false;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (gamePointTotals[p] > bestGamePts) {
        bestGamePts = gamePointTotals[p];
        gamePlayer = p;
        gameTied = false;
      } else if (gamePointTotals[p] === bestGamePts)
        gameTied = true;
    }
    if (gameTied) gamePlayer = -1;

    // Award points
    const pointsEarned = [0, 0, 0, 0];
    roundMessages = [];

    if (highPlayer >= 0) {
      ++pointsEarned[highPlayer];
      roundMessages.push('High (' + SUIT_SYMBOLS[trumpSuit] + STRENGTH_ORDER[highRank] + '): ' + PLAYER_NAMES[highPlayer]);
    }
    if (lowPlayer >= 0) {
      ++pointsEarned[lowPlayer];
      roundMessages.push('Low (' + SUIT_SYMBOLS[trumpSuit] + STRENGTH_ORDER[lowRank] + '): ' + PLAYER_NAMES[lowPlayer]);
    }
    if (jackPlayer >= 0) {
      ++pointsEarned[jackPlayer];
      roundMessages.push('Jack (' + SUIT_SYMBOLS[trumpSuit] + 'J): ' + PLAYER_NAMES[jackPlayer]);
    } else
      roundMessages.push('Jack: not played');

    if (gamePlayer >= 0) {
      ++pointsEarned[gamePlayer];
      roundMessages.push('Game (' + bestGamePts + ' pts): ' + PLAYER_NAMES[gamePlayer]);
    } else
      roundMessages.push('Game: tied \u2014 no point');

    // Check bidder -- must make at least their bid or get set
    const bidderPoints = pointsEarned[bidder];
    if (bidderPoints >= bidAmount) {
      playerScores[bidder] += bidderPoints;
      roundMessages.push(PLAYER_NAMES[bidder] + ' makes bid (' + bidAmount + '), earns ' + bidderPoints);
    } else {
      playerScores[bidder] -= bidAmount;
      roundMessages.push(PLAYER_NAMES[bidder] + ' SET! Loses ' + bidAmount + ' points');
    }

    // Other players keep what they earn
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === bidder) continue;
      if (pointsEarned[p] > 0) {
        playerScores[p] += pointsEarned[p];
        roundMessages.push(PLAYER_NAMES[p] + ' earns ' + pointsEarned[p]);
      }
    }

    score = playerScores[0];
    if (_host) _host.onScoreChanged(score);

    roundOver = true;

    // Check for game over
    let anyWinner = false;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (playerScores[p] >= WIN_SCORE) {
        anyWinner = true;
        break;
      }
    }

    if (anyWinner) {
      gameOver = true;
      phase = PHASE_GAME_OVER;
      if (_host) {
        const won = playerScores[0] >= WIN_SCORE;
        const gmsg = won ? 'You win the game!' : 'Game Over!';
        _host.floatingText.add(CANVAS_W / 2, 200, gmsg, { color: won ? '#4f4' : '#f88', size: 24 });
        if (won) _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    } else {
      phase = PHASE_ROUND_SCORE;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, 'Round complete', { color: '#ff0', size: 18 });
    }
  }

  /* ================================================================
     DRAWING - LAYOUT
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 20;

  function playerCardX(idx, total) {
    const maxWidth = 500;
    const fanWidth = Math.min(maxWidth, total * 60);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
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
    { x: CANVAS_W / 2 - 120, y: 10, dir: 'horizontal', label: 'North' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* -- Bidding button positions -- */
  const BID_BTN_W = 60;
  const BID_BTN_H = 32;
  const BID_BTN_GAP = 10;
  const BID_AREA_Y = 340;

  function bidBtnRect(bidVal) {
    // Buttons: 1, 2, 3, 4, Pass (5 total)
    const labels = 5;
    const totalW = labels * BID_BTN_W + (labels - 1) * BID_BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    return {
      x: startX + bidVal * (BID_BTN_W + BID_BTN_GAP),
      y: BID_AREA_Y,
      w: BID_BTN_W,
      h: BID_BTN_H
    };
  }

  /* ================================================================
     DRAWING - HIT TEST
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      if (mx >= cx && mx <= rightEdge && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 10;
    const pw = 190;
    const ph = 130;

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
    _ctx.fillText('Pitch (All Fours)', px + 10, py + 8);
    _ctx.font = '10px sans-serif';
    _ctx.fillStyle = '#aaa';
    _ctx.fillText('First to ' + WIN_SCORE, px + 130, py + 8);

    _ctx.font = '11px sans-serif';
    const lh = 15;
    let y = py + 28;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      _ctx.fillStyle = p === 0 ? '#8cf' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], px + 10, y);
      _ctx.textAlign = 'right';
      _ctx.fillText('' + playerScores[p], px + pw - 10, y);
      y += lh;
    }

    // Trump indicator
    if (trumpSuit) {
      y += 4;
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText('Trump: ' + SUIT_SYMBOLS[trumpSuit] + ' ' + SUIT_NAMES[trumpSuit], px + 10, y);
    }

    // Dealer indicator
    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Dealer: ' + PLAYER_NAMES[dealer], px + 10, py + ph - 14);

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    _ctx.fillStyle = '#ccc';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Your Hand', CANVAS_W / 2, PLAYER_HAND_Y - 4);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const isHover = i === hoveredCard && phase === PHASE_PLAYING && currentTurn === 0;
      const yOff = isHover ? -10 : 0;

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
        const spacing = Math.min(22, 240 / Math.max(count, 1));
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
    // Subtle center
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
    _ctx.fillText('Bidding Phase', CANVAS_W / 2, 220);

    // Show who has bid
    let y = 250;
    _ctx.font = '13px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (!playerBidDone[p]) continue;
      const bidText = playerBids[p] === 0 ? 'Pass' : '' + playerBids[p];
      _ctx.fillStyle = p === 0 ? '#8cf' : '#ccc';
      _ctx.fillText(PLAYER_NAMES[p] + ': ' + bidText, CANVAS_W / 2, y);
      y += 18;
    }

    // Current highest bid
    if (bidAmount > 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = '12px sans-serif';
      _ctx.fillText('Current high: ' + PLAYER_NAMES[bidder] + ' at ' + bidAmount, CANVAS_W / 2, BID_AREA_Y - 30);
    }

    // Buttons for human
    if (biddingPlayer === 0 && !playerBidDone[0]) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = '14px sans-serif';
      _ctx.fillText('Your bid (min ' + (bidAmount + 1) + ', or pass):', CANVAS_W / 2, BID_AREA_Y - 14);

      const bidLabels = ['1', '2', '3', '4', 'Pass'];
      for (let i = 0; i < 5; ++i) {
        const r = bidBtnRect(i);
        const bidVal = i < 4 ? i + 1 : 0;
        const enabled = bidVal === 0 || bidVal > bidAmount || (bidVal >= 1 && bidAmount === 0);
        const isPass = bidVal === 0;

        let bg, border;
        if (!enabled && !isPass) {
          bg = '#333';
          border = '#555';
        } else if (isPass) {
          bg = hoveredBtn === 'pass' ? '#6a3a3a' : '#5a2a2a';
          border = '#c66';
        } else {
          bg = hoveredBtn === ('bid' + bidVal) ? '#3a6a3a' : '#2a5a2a';
          border = '#6c6';
        }

        CE.drawButton(_ctx, r.x, r.y, r.w, r.h, bidLabels[i], { bg, border, textColor: enabled || isPass ? '#fff' : '#666', fontSize: 13 });
      }
    } else if (!playerBidDone[biddingPlayer]) {
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
    _ctx.fillText('Trick ' + (trickCount + 1) + '/' + HAND_SIZE, 10, CANVAS_H - 16);
  }

  function drawRoundScoreUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 180;
    const py = 120;
    const pw = 360;
    const lineCount = roundMessages.length;
    const ph = 160 + lineCount * 16;

    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Round Complete', CANVAS_W / 2, py + 14);

    _ctx.fillStyle = '#ccc';
    _ctx.font = '12px sans-serif';
    _ctx.fillText(PLAYER_NAMES[bidder] + ' bid ' + bidAmount + ' \u2014 Trump: ' + SUIT_SYMBOLS[trumpSuit] + ' ' + SUIT_NAMES[trumpSuit], CANVAS_W / 2, py + 38);

    _ctx.font = '12px sans-serif';
    let y = py + 62;
    for (const msg of roundMessages) {
      _ctx.fillStyle = '#ff0';
      _ctx.fillText(msg, CANVAS_W / 2, y);
      y += 16;
    }

    y += 8;
    _ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      _ctx.fillStyle = p === 0 ? '#8cf' : '#ccc';
      _ctx.fillText(PLAYER_NAMES[p] + ': ' + playerScores[p], CANVAS_W / 2, y);
      y += 14;
    }

    y += 6;
    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Click to continue', CANVAS_W / 2, y);
    _ctx.restore();
  }

  function drawGameOverUI() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.8)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const won = playerScores[0] >= WIN_SCORE;
    let winnerName = 'You';
    if (!won) {
      let best = -Infinity;
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (playerScores[p] > best) {
          best = playerScores[p];
          winnerName = PLAYER_NAMES[p];
        }
      }
    }

    _ctx.fillStyle = won ? '#4f4' : '#f44';
    _ctx.font = 'bold 24px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(won ? 'You Win!' : winnerName + ' Wins!', CANVAS_W / 2, 220);

    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    let y = 260;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      _ctx.fillStyle = p === 0 ? '#8cf' : '#ccc';
      _ctx.fillText(PLAYER_NAMES[p] + ': ' + playerScores[p], CANVAS_W / 2, y);
      y += 20;
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '14px sans-serif';
    _ctx.fillText('Click to start a new game', CANVAS_W / 2, y + 20);
    _ctx.restore();
  }

  function drawAll() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Pitch', 10, 10);

    drawScorePanel();
    drawAIHands();

    if (phase === PHASE_BIDDING) {
      drawBiddingUI();
      drawPlayerHand();
    } else if (phase >= PHASE_PLAYING && phase <= PHASE_TRICK_DONE) {
      drawTrickArea();
      drawPlayerHand();
      drawPlayingUI();
    } else if (phase === PHASE_ROUND_SCORE) {
      drawRoundScoreUI();
    } else if (phase === PHASE_GAME_OVER) {
      drawGameOverUI();
    }
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupGame() {
    playerScores = [0, 0, 0, 0];
    gameOver = false;
    score = 0;
    dealer = 0;
    dealRound();
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      if (score !== 0)
        playerScores[0] = score;
      else
        playerScores = [0, 0, 0, 0];
      gameOver = false;
      dealer = 0;
      dealRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAll();
    },

    handleClick(mx, my) {
      // Game over
      if (phase === PHASE_GAME_OVER) {
        playerScores = [0, 0, 0, 0];
        score = 0;
        gameOver = false;
        dealer = 0;
        if (_host) _host.onScoreChanged(score);
        dealRound();
        return;
      }

      // Round score screen
      if (phase === PHASE_ROUND_SCORE) {
        dealer = leftOf(dealer);
        dealRound();
        return;
      }

      // Bidding -- player's turn
      if (phase === PHASE_BIDDING && biddingPlayer === 0 && !playerBidDone[0]) {
        for (let i = 0; i < 5; ++i) {
          const r = bidBtnRect(i);
          if (!CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) continue;

          const bidVal = i < 4 ? i + 1 : 0;

          // Pass
          if (bidVal === 0) {
            // Dealer can't pass if everyone else passed
            const allOthersPassed = playerBidDone.every((d, p) => p === 0 || !d || playerBids[p] === 0);
            if (biddingPlayer === dealer && allOthersPassed && bidAmount === 0) {
              if (_host) _host.floatingText.add(mx, my - 20, 'Dealer must bid!', { color: '#f88', size: 14 });
              return;
            }
            processBid(0, 0, null);
            if (_host) _host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
            advanceBidding();
            return;
          }

          // Must bid higher than current
          if (bidVal <= bidAmount) {
            if (_host) _host.floatingText.add(mx, my - 20, 'Must bid higher than ' + bidAmount + '!', { color: '#f88', size: 14 });
            return;
          }

          // Human picks bid -- trump is their best suit for that bid
          const result = aiBid(0); // evaluate best suit
          processBid(0, bidVal, result.suit);
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 300, 'You bid ' + bidVal, { color: '#ff0', size: 14 });
          advanceBidding();
          return;
        }
        return;
      }

      // Playing -- player's turn
      if (phase === PHASE_PLAYING && currentTurn === 0) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        const hand = hands[0];
        if (isValidPlay(hand[idx], hand)) {
          playCard(0, idx);
        } else {
          const leadSuit = trickCards[0].suit;
          if (_host) _host.floatingText.add(mx, my - 20, 'Must follow ' + SUIT_NAMES[leadSuit] + '!', { color: '#f88', size: 14 });
        }
        return;
      }
    },

    handlePointerMove(mx, my) {
      hoveredCard = -1;
      hoveredBtn = '';

      if (phase === PHASE_PLAYING && currentTurn === 0)
        hoveredCard = hitTestPlayerCard(mx, my);

      if (phase === PHASE_BIDDING && biddingPlayer === 0 && !playerBidDone[0]) {
        for (let i = 0; i < 5; ++i) {
          const r = bidBtnRect(i);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            hoveredBtn = i < 4 ? 'bid' + (i + 1) : 'pass';
            break;
          }
        }
      }
    },

    handlePointerUp() {},

    handleKey(e) {},

    tick(dt) {
      if (phase === PHASE_ROUND_SCORE || phase === PHASE_GAME_OVER) return;

      // Trick done timer
      if (phase === PHASE_TRICK_DONE) {
        trickDoneTimer += dt;
        if (trickDoneTimer >= TRICK_DONE_DELAY)
          finishTrick();
        return;
      }

      // AI bidding
      if (phase === PHASE_BIDDING && biddingPlayer !== 0 && !playerBidDone[biddingPlayer]) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          const result = aiBid(biddingPlayer);

          if (result.bid > bidAmount) {
            processBid(biddingPlayer, result.bid, result.suit);
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[biddingPlayer] + ' bids ' + result.bid, { color: '#ff0', size: 14 });
          } else {
            // Check if dealer must bid
            const isDealer = biddingPlayer === dealer;
            const allOthersPassed = (() => {
              for (let p = 0; p < NUM_PLAYERS; ++p) {
                if (p === biddingPlayer) continue;
                if (playerBidDone[p] && playerBids[p] > 0) return false;
              }
              return true;
            })();

            if (isDealer && allOthersPassed && bidAmount === 0) {
              // Dealer steals at 1
              processBid(biddingPlayer, 1, result.suit || CE.SUITS[0]);
              if (_host)
                _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[biddingPlayer] + ' steals at 1', { color: '#ff0', size: 14 });
            } else {
              processBid(biddingPlayer, 0, null);
              if (_host)
                _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[biddingPlayer] + ' passes', { color: '#aaa', size: 12 });
            }
          }
          advanceBidding();
        }
        return;
      }

      // Player bidding -- wait for click
      if (phase === PHASE_BIDDING && biddingPlayer === 0) return;

      // AI playing
      if (phase !== PHASE_PLAYING) return;
      if (currentTurn === 0) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        const idx = aiChooseCard(currentTurn);
        if (idx >= 0)
          playCard(currentTurn, idx);
      }
    },

    sortPlayerHand() { sortHand(hands[0]); },

    cleanup() {
      hands = [[], [], [], []];
      capturedCards = [[], [], [], []];
      trickCards = [];
      trickPlayers = [];
      trumpSuit = null;
      bidder = -1;
      bidAmount = 0;
      playerBids = [0, 0, 0, 0];
      playerBidDone = [false, false, false, false];
      playerScores = [0, 0, 0, 0];
      roundOver = false;
      gameOver = false;
      phase = PHASE_BIDDING;
      aiTurnTimer = 0;
      hoveredCard = -1;
      hoveredBtn = '';
      roundMessages = [];
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) {
      score = s;
      playerScores[0] = s;
    }
  };

  SZ.CardGames.registerVariant('pitch', module);

})();
