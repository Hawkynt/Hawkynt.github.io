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
  const SAME_COLOR = { spades: 'clubs', clubs: 'spades', hearts: 'diamonds', diamonds: 'hearts' };
  const EUCHRE_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];
  const NON_TRUMP_ORDER = { '9': 0, '10': 1, 'J': 2, 'Q': 3, 'K': 4, 'A': 5 };
  const TRUMP_ORDER = { '9': 0, '10': 1, 'Q': 2, 'K': 3, 'A': 4 }; // J handled separately as bowers

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 5;
  const WIN_SCORE = 10;

  const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];
  const TEAM_A = 0; // players 0, 2
  const TEAM_B = 1; // players 1, 3

  /* ── Phases ── */
  const PHASE_DEALING = 0;
  const PHASE_TRUMP_ROUND1 = 1;
  const PHASE_TRUMP_ROUND2 = 2;
  const PHASE_DISCARD = 3;
  const PHASE_PLAYING = 4;
  const PHASE_TRICK_DONE = 5;
  const PHASE_ROUND_SCORE = 6;
  const PHASE_GAME_OVER = 7;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let kitty = [];
  let kittyCard = null;
  let trumpSuit = null;
  let callingTeam = -1;
  let callingPlayer = -1;
  let goingAlone = false;
  let sittingOutPlayer = -1;
  let dealer = 0;
  let currentTurn = 0;
  let trickLeader = 0;
  let trickCards = [];
  let trickPlayers = [];
  let trickCount = 0;
  let tricksWon = [0, 0]; // per team this round
  let teamScores = [0, 0];
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let phase = PHASE_DEALING;

  let biddingPlayer = 0;
  let trickWinnerIdx = -1;
  let trickDoneTimer = 0;
  const TRICK_DONE_DELAY = 1.2;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  let hoveredCard = -1;
  let hoveredBtn = '';
  let roundMessage = '';

  /* ================================================================
     TEAM / PLAYER UTILITIES
     ================================================================ */

  function teamOf(p) {
    return (p === 0 || p === 2) ? TEAM_A : TEAM_B;
  }

  function partnerOf(p) {
    return (p + 2) % NUM_PLAYERS;
  }

  function leftOf(p) {
    return (p + 1) % NUM_PLAYERS;
  }

  function isSkipped(p) {
    return p === sittingOutPlayer;
  }

  function nextActivePlayer(p) {
    let next = leftOf(p);
    while (isSkipped(next)) next = leftOf(next);
    return next;
  }

  /* ================================================================
     CARD RANKING - EUCHRE SPECIFIC
     ================================================================ */

  function isRightBower(card) {
    return card.rank === 'J' && card.suit === trumpSuit;
  }

  function isLeftBower(card) {
    return card.rank === 'J' && card.suit === SAME_COLOR[trumpSuit];
  }

  function effectiveSuit(card) {
    if (isLeftBower(card)) return trumpSuit;
    return card.suit;
  }

  function isTrump(card) {
    return effectiveSuit(card) === trumpSuit;
  }

  function cardStrength(card) {
    if (isRightBower(card)) return 100;
    if (isLeftBower(card)) return 99;
    if (isTrump(card)) return 10 + (TRUMP_ORDER[card.rank] || 0);
    return NON_TRUMP_ORDER[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      const sa = effectiveSuit(a);
      const sb = effectiveSuit(b);
      if (sa === trumpSuit && sb !== trumpSuit) return 1;
      if (sb === trumpSuit && sa !== trumpSuit) return -1;
      if (sa === trumpSuit && sb === trumpSuit) return cardStrength(a) - cardStrength(b);
      const sd = suitOrder[sa] - suitOrder[sb];
      if (sd !== 0) return sd;
      return (NON_TRUMP_ORDER[a.rank] || 0) - (NON_TRUMP_ORDER[b.rank] || 0);
    });
  }

  /* ================================================================
     VALIDITY
     ================================================================ */

  function hasSuit(hand, suit) {
    return hand.some(c => effectiveSuit(c) === suit);
  }

  function isValidPlay(card, hand) {
    if (trickCards.length === 0) return true;
    const leadSuit = effectiveSuit(trickCards[0]);
    if (hasSuit(hand, leadSuit)) return effectiveSuit(card) === leadSuit;
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
    const leadSuit = effectiveSuit(trickCards[0]);
    let bestIdx = 0;
    let bestStr = cardStrength(trickCards[0]);
    let bestIsTrump = isTrump(trickCards[0]);

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const cTrump = isTrump(c);
      const cStr = cardStrength(c);
      const cFollows = effectiveSuit(c) === leadSuit;

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
        } else if (cFollows && cStr > bestStr) {
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

  function countTrumpInHand(hand, suit) {
    let count = 0;
    for (const c of hand) {
      if (c.suit === suit || (c.rank === 'J' && c.suit === SAME_COLOR[suit]))
        ++count;
    }
    return count;
  }

  function hasFaceInSuit(hand, suit) {
    for (const c of hand) {
      if (c.suit === suit && (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K' || c.rank === 'A'))
        return true;
      if (c.rank === 'J' && c.suit === SAME_COLOR[suit])
        return true;
    }
    return false;
  }

  function aiShouldOrderUp(playerIdx, suit) {
    const hand = hands[playerIdx];
    const count = countTrumpInHand(hand, suit);
    if (count >= 3 && hasFaceInSuit(hand, suit)) return true;
    if (count >= 4) return true;
    return false;
  }

  function aiShouldGoAlone(playerIdx, suit) {
    const hand = hands[playerIdx];
    const count = countTrumpInHand(hand, suit);
    const hasRight = hand.some(c => c.rank === 'J' && c.suit === suit);
    const hasLeft = hand.some(c => c.rank === 'J' && c.suit === SAME_COLOR[suit]);
    return count >= 4 && hasRight && hasLeft;
  }

  function aiPickTrumpRound2(playerIdx) {
    const hand = hands[playerIdx];
    const kittyS = kittyCard ? kittyCard.suit : null;
    let bestSuit = null;
    let bestCount = 0;
    for (const s of CE.SUITS) {
      if (s === kittyS) continue;
      const cnt = countTrumpInHand(hand, s);
      if (cnt > bestCount && hasFaceInSuit(hand, s)) {
        bestCount = cnt;
        bestSuit = s;
      }
    }
    if (bestSuit && bestCount >= 3) return bestSuit;
    // Stuck dealer must pick something
    if (biddingPlayer === dealer) {
      for (const s of CE.SUITS) {
        if (s === kittyS) continue;
        const cnt = countTrumpInHand(hand, s);
        if (cnt > bestCount || !bestSuit) {
          bestCount = cnt;
          bestSuit = s;
        }
      }
      return bestSuit;
    }
    return null;
  }

  function aiDiscardWorst(playerIdx) {
    const hand = hands[playerIdx];
    let worstIdx = 0;
    let worstStr = Infinity;
    for (let i = 0; i < hand.length; ++i) {
      const str = cardStrength(hand[i]);
      if (str < worstStr) {
        worstStr = str;
        worstIdx = i;
      }
    }
    return worstIdx;
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
    const partnerIdx = partnerOf(playerIdx);

    if (isLeading) {
      // Lead with high trump if we have many
      const trumpIdxs = valid.filter(i => isTrump(hand[i]));
      if (trumpIdxs.length >= 3) {
        trumpIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        return trumpIdxs[0];
      }
      // Otherwise lead non-trump ace/king
      const highNonTrump = valid.filter(i => !isTrump(hand[i]) && (hand[i].rank === 'A' || hand[i].rank === 'K'));
      if (highNonTrump.length > 0) {
        highNonTrump.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        return highNonTrump[0];
      }
      // Lead lowest
      valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return valid[0];
    }

    // Check if partner is winning
    let partnerWinning = false;
    if (trickCards.length > 0) {
      const tempWinner = resolveTrickWinnerPartial();
      partnerWinning = teamOf(tempWinner) === teamOf(playerIdx);
    }

    const leadSuit = effectiveSuit(trickCards[0]);
    const followIdxs = valid.filter(i => effectiveSuit(hand[i]) === leadSuit);

    if (followIdxs.length > 0) {
      if (partnerWinning) {
        // Play lowest
        followIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        return followIdxs[0];
      }
      // Try to win
      followIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      return followIdxs[0];
    }

    // Can't follow suit
    if (partnerWinning) {
      // Dump lowest non-trump
      const nonTrump = valid.filter(i => !isTrump(hand[i]));
      const dump = nonTrump.length > 0 ? nonTrump : valid;
      dump.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return dump[0];
    }

    // Trump in with lowest trump
    const trumpIdxs = valid.filter(i => isTrump(hand[i]));
    if (trumpIdxs.length > 0) {
      trumpIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return trumpIdxs[0];
    }

    valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
    return valid[0];
  }

  function resolveTrickWinnerPartial() {
    if (trickCards.length === 0) return -1;
    const leadSuit = effectiveSuit(trickCards[0]);
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
        } else if (effectiveSuit(c) === leadSuit && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      }
    }
    return trickPlayers[bestIdx];
  }

  /* ================================================================
     SETUP / DEALING
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, EUCHRE_RANKS));
    hands = [[], [], [], []];
    trickCards = [];
    trickPlayers = [];
    trickCount = 0;
    tricksWon = [0, 0];
    trumpSuit = null;
    callingTeam = -1;
    callingPlayer = -1;
    goingAlone = false;
    sittingOutPlayer = -1;
    hoveredCard = -1;
    hoveredBtn = '';
    trickWinnerIdx = -1;
    trickDoneTimer = 0;
    aiTurnTimer = 0;
    roundMessage = '';
    roundOver = false;

    // Deal 5 cards each
    for (let i = 0; i < 20; ++i)
      hands[i % NUM_PLAYERS].push(d[i]);

    // Remaining 4 = kitty, top card face up
    kitty = d.slice(20);
    kittyCard = kitty[0];
    kittyCard.faceUp = true;

    for (const c of hands[0])
      c.faceUp = true;

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    biddingPlayer = leftOf(dealer);
    phase = PHASE_TRUMP_ROUND1;

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  /* ================================================================
     TRUMP SELECTION FLOW
     ================================================================ */

  function acceptTrump(playerIdx, suit, alone) {
    trumpSuit = suit;
    callingPlayer = playerIdx;
    callingTeam = teamOf(playerIdx);
    goingAlone = !!alone;
    if (goingAlone)
      sittingOutPlayer = partnerOf(playerIdx);

    if (_host) {
      const who = playerIdx === 0 ? 'You call' : PLAYER_NAMES[playerIdx] + ' calls';
      const msg = who + ' ' + SUIT_SYMBOLS[suit] + ' ' + SUIT_NAMES[suit] + (goingAlone ? ' (alone!)' : '');
      _host.floatingText.add(CANVAS_W / 2, 250, msg, { color: '#ff0', size: 16 });
    }

    // Round 1: dealer picks up kitty card and discards
    if (phase === PHASE_TRUMP_ROUND1) {
      hands[dealer].push(kittyCard);
      kitty.shift();
      if (dealer === 0) {
        // Human must discard
        for (const c of hands[0]) c.faceUp = true;
        sortHand(hands[0]);
        phase = PHASE_DISCARD;
        return;
      }
      // AI dealer discards worst
      const discIdx = aiDiscardWorst(dealer);
      hands[dealer].splice(discIdx, 1);
      sortHand(hands[dealer]);
    }

    startPlaying();
  }

  function advanceBidding() {
    biddingPlayer = leftOf(biddingPlayer);
    aiTurnTimer = 0;
  }

  function startPlaying() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);
    for (const c of hands[0])
      c.faceUp = true;

    phase = PHASE_PLAYING;
    trickLeader = leftOf(dealer);
    while (isSkipped(trickLeader)) trickLeader = leftOf(trickLeader);
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

    const activeCount = goingAlone ? 3 : 4;
    if (trickCards.length >= activeCount) {
      phase = PHASE_TRICK_DONE;
      trickWinnerIdx = resolveTrickWinner();
      trickDoneTimer = 0;
      return;
    }

    currentTurn = nextActivePlayer(currentTurn);
  }

  function finishTrick() {
    const winner = trickWinnerIdx;
    const winTeam = teamOf(winner);
    ++tricksWon[winTeam];
    ++trickCount;

    if (_host) {
      const who = winner === 0 ? 'You' : PLAYER_NAMES[winner];
      const label = who + ' win trick #' + trickCount;
      const color = winTeam === TEAM_A ? '#4f4' : '#f88';
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

  function endRound() {
    // Scoring
    const callerTricks = tricksWon[callingTeam];
    const defenderTricks = tricksWon[1 - callingTeam];
    let pts = 0;
    let msg = '';

    if (callerTricks >= 3) {
      if (callerTricks === 5 && goingAlone) {
        pts = 4;
        msg = 'Alone sweep! +4 pts';
      } else if (callerTricks === 5) {
        pts = 2;
        msg = 'March! +2 pts';
      } else {
        pts = 1;
        msg = 'Made it. +1 pt';
      }
      teamScores[callingTeam] += pts;
    } else {
      pts = 2;
      teamScores[1 - callingTeam] += pts;
      msg = 'Euchred! Opponents +2 pts';
    }

    score = teamScores[TEAM_A];
    if (_host) _host.onScoreChanged(score);

    roundMessage = msg + '\nTeam A: ' + teamScores[TEAM_A] + '  Team B: ' + teamScores[TEAM_B];
    roundOver = true;

    if (teamScores[TEAM_A] >= WIN_SCORE || teamScores[TEAM_B] >= WIN_SCORE) {
      gameOver = true;
      phase = PHASE_GAME_OVER;
      if (_host) {
        const won = teamScores[TEAM_A] >= WIN_SCORE;
        const gmsg = won ? 'You win the game!' : 'Opponents win!';
        _host.floatingText.add(CANVAS_W / 2, 200, gmsg, { color: won ? '#4f4' : '#f88', size: 24 });
        if (won) _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    } else {
      phase = PHASE_ROUND_SCORE;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, msg, { color: '#ff0', size: 18 });
    }
  }

  /* ================================================================
     DRAWING - LAYOUT POSITIONS
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
    { x: CANVAS_W / 2 - 120, y: 10, dir: 'horizontal', label: 'Partner (N)' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* ── Bidding button positions ── */
  const BTN_W = 100;
  const BTN_H = 30;
  const BTN_GAP = 12;
  const BTN_Y = 350;

  function orderUpBtnRect() {
    return { x: CANVAS_W / 2 - BTN_W - BTN_GAP / 2, y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  function passBtnRect() {
    return { x: CANVAS_W / 2 + BTN_GAP / 2, y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  function aloneBtnRect() {
    return { x: CANVAS_W / 2 - BTN_W / 2, y: BTN_Y + BTN_H + 8, w: BTN_W, h: BTN_H };
  }

  /* Suit selection buttons for round 2 (3 buttons, excluding kitty suit) */
  function suitBtnRect(idx) {
    const totalW = 3 * 80 + 2 * 8;
    const startX = (CANVAS_W - totalW) / 2;
    return { x: startX + idx * 88, y: BTN_Y, w: 80, h: BTN_H };
  }

  function passR2BtnRect() {
    return { x: CANVAS_W / 2 - BTN_W / 2, y: BTN_Y + BTN_H + 8, w: BTN_W, h: BTN_H };
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 190;
    const py = 10;
    const pw = 180;
    const ph = 120;

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
    _ctx.fillText('Euchre', px + 10, py + 8);

    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#8cf';
    _ctx.fillText('Team A (You+Partner)', px + 10, py + 28);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + teamScores[TEAM_A], px + pw - 10, py + 28);

    _ctx.textAlign = 'left';
    _ctx.fillStyle = '#f88';
    _ctx.fillText('Team B (West+East)', px + 10, py + 44);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + teamScores[TEAM_B], px + pw - 10, py + 44);

    // Tricks this round
    if (phase >= PHASE_PLAYING && phase <= PHASE_ROUND_SCORE) {
      _ctx.textAlign = 'left';
      _ctx.fillStyle = '#aaa';
      _ctx.font = '10px sans-serif';
      _ctx.fillText('Tricks: A=' + tricksWon[TEAM_A] + '  B=' + tricksWon[TEAM_B], px + 10, py + 64);
    }

    // Trump indicator
    if (trumpSuit) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText('Trump: ' + SUIT_SYMBOLS[trumpSuit] + ' ' + SUIT_NAMES[trumpSuit], px + 10, py + 80);
      if (goingAlone) {
        _ctx.fillStyle = '#f80';
        _ctx.fillText('Going Alone!', px + 10, py + 96);
      }
    }

    // Dealer indicator
    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Dealer: ' + PLAYER_NAMES[dealer], px + 10, py + (trumpSuit ? 108 : 64));

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      const isHover = i === hoveredCard && (phase === PHASE_PLAYING || phase === PHASE_DISCARD) && currentTurn === 0;
      if (isHover) y -= 10;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Hint glow for valid plays
      if (_host && _host.hintsEnabled && phase === PHASE_PLAYING && currentTurn === 0 && isValidPlay(hand[i], hand))
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Hint glow for discard phase
      if (_host && _host.hintsEnabled && phase === PHASE_DISCARD && !isTrump(hand[i]))
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Dim invalid cards during play
      if (phase === PHASE_PLAYING && currentTurn === 0 && !isValidPlay(hand[i], hand)) {
        _ctx.save();
        _ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
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
      const isOut = isSkipped(p);
      const isCurrent = currentTurn === p && phase === PHASE_PLAYING;

      _ctx.fillStyle = isOut ? '#666' : (isCurrent ? '#ff0' : '#aaa');
      _ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';

      const label = pos.label + (isOut ? ' (out)' : ' (' + count + ')');

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

  function drawKittyCard() {
    if (!kittyCard) return;
    const kx = CANVAS_W / 2 - CE.CARD_W / 2;
    const ky = 230;
    CE.drawCardFace(_ctx, kx, ky, kittyCard);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Kitty card', CANVAS_W / 2, ky + CE.CARD_H + 4);
  }

  function drawTrumpRound1UI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Trump Selection \u2014 Round 1', CANVAS_W / 2, 180);

    _ctx.fillStyle = '#ccc';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Kitty shows ' + SUIT_SYMBOLS[kittyCard.suit] + ' ' + kittyCard.rank + ' of ' + SUIT_NAMES[kittyCard.suit], CANVAS_W / 2, 200);

    drawKittyCard();

    if (biddingPlayer === 0) {
      const ob = orderUpBtnRect();
      const pb = passBtnRect();
      const ab = aloneBtnRect();
      CE.drawButton(_ctx, ob.x, ob.y, ob.w, ob.h, 'Order Up', { bg: hoveredBtn === 'order' ? '#3a6a3a' : '#2a5a2a', border: '#6c6', fontSize: 12 });
      CE.drawButton(_ctx, pb.x, pb.y, pb.w, pb.h, 'Pass', { bg: hoveredBtn === 'pass' ? '#6a3a3a' : '#5a2a2a', border: '#c66', fontSize: 12 });
      CE.drawButton(_ctx, ab.x, ab.y, ab.w, ab.h, 'Order Alone', { bg: hoveredBtn === 'alone' ? '#6a6a2a' : '#5a5a1a', border: '#cc6', fontSize: 11 });
    } else {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '13px sans-serif';
      _ctx.fillText(PLAYER_NAMES[biddingPlayer] + ' is deciding...', CANVAS_W / 2, BTN_Y + 15);
    }
  }

  function drawTrumpRound2UI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Trump Selection \u2014 Round 2', CANVAS_W / 2, 200);

    _ctx.fillStyle = '#ccc';
    _ctx.font = '12px sans-serif';
    const kittyS = kittyCard ? kittyCard.suit : null;
    _ctx.fillText('Name any suit except ' + (kittyS ? SUIT_NAMES[kittyS] : '?'), CANVAS_W / 2, 220);

    if (biddingPlayer === dealer) {
      _ctx.fillStyle = '#f80';
      _ctx.font = '11px sans-serif';
      _ctx.fillText('(Stuck dealer \u2014 must pick)', CANVAS_W / 2, 238);
    }

    if (biddingPlayer === 0) {
      let suitIdx = 0;
      for (const s of CE.SUITS) {
        if (s === kittyS) continue;
        const r = suitBtnRect(suitIdx);
        const col = (s === 'hearts' || s === 'diamonds') ? '#8a2a2a' : '#2a2a6a';
        const colHover = (s === 'hearts' || s === 'diamonds') ? '#aa4a4a' : '#4a4a8a';
        CE.drawButton(_ctx, r.x, r.y, r.w, r.h, SUIT_SYMBOLS[s] + ' ' + SUIT_NAMES[s], { bg: hoveredBtn === s ? colHover : col, border: '#aaa', fontSize: 11 });
        ++suitIdx;
      }
      if (biddingPlayer !== dealer) {
        const pb = passR2BtnRect();
        CE.drawButton(_ctx, pb.x, pb.y, pb.w, pb.h, 'Pass', { bg: hoveredBtn === 'pass2' ? '#6a3a3a' : '#5a2a2a', border: '#c66', fontSize: 12 });
      }
    } else {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '13px sans-serif';
      _ctx.fillText(PLAYER_NAMES[biddingPlayer] + ' is deciding...', CANVAS_W / 2, BTN_Y + 15);
    }
  }

  function drawDiscardUI() {
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('You are the dealer \u2014 pick up the kitty card and discard one', CANVAS_W / 2, 260);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Click a card in your hand to discard it', CANVAS_W / 2, 280);
  }

  function drawPlayingUI() {
    if (currentTurn === 0 && trickCards.length < (goingAlone ? 3 : 4) && !roundOver) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trick ' + (trickCount + 1) + '/5', 10, CANVAS_H - 16);
  }

  function drawRoundScoreUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 160;
    const py = 160;
    const pw = 320;
    const ph = 200;

    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Round Complete', CANVAS_W / 2, py + 14);

    _ctx.font = '13px sans-serif';
    const callerName = callingTeam === TEAM_A ? 'Team A' : 'Team B';
    _ctx.fillStyle = '#ccc';
    _ctx.fillText(callerName + ' called trump (' + SUIT_SYMBOLS[trumpSuit] + ')', CANVAS_W / 2, py + 40);

    _ctx.fillStyle = '#8cf';
    _ctx.fillText('Team A tricks: ' + tricksWon[TEAM_A] + '   Score: ' + teamScores[TEAM_A], CANVAS_W / 2, py + 68);
    _ctx.fillStyle = '#f88';
    _ctx.fillText('Team B tricks: ' + tricksWon[TEAM_B] + '   Score: ' + teamScores[TEAM_B], CANVAS_W / 2, py + 88);

    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 14px sans-serif';
    const lines = roundMessage.split('\n');
    for (let i = 0; i < lines.length; ++i)
      _ctx.fillText(lines[i], CANVAS_W / 2, py + 116 + i * 18);

    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Click to continue', CANVAS_W / 2, py + ph - 22);
    _ctx.restore();
  }

  function drawGameOverUI() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.8)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const won = teamScores[TEAM_A] >= WIN_SCORE;
    _ctx.fillStyle = won ? '#4f4' : '#f44';
    _ctx.font = 'bold 24px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(won ? 'You Win!' : 'You Lose!', CANVAS_W / 2, 220);

    _ctx.fillStyle = '#fff';
    _ctx.font = '16px sans-serif';
    _ctx.fillText('Team A: ' + teamScores[TEAM_A] + '  |  Team B: ' + teamScores[TEAM_B], CANVAS_W / 2, 260);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '14px sans-serif';
    _ctx.fillText('Click to start a new game', CANVAS_W / 2, 300);
    _ctx.restore();
  }

  function drawAll() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Euchre', 10, 10);

    drawScorePanel();
    drawAIHands();

    if (phase === PHASE_TRUMP_ROUND1) {
      drawTrumpRound1UI();
      drawPlayerHand();
    } else if (phase === PHASE_TRUMP_ROUND2) {
      drawTrumpRound2UI();
      drawPlayerHand();
    } else if (phase === PHASE_DISCARD) {
      drawDiscardUI();
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
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
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
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      if (score !== 0) teamScores[TEAM_A] = score;
      else teamScores = [0, 0];
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
        teamScores = [0, 0];
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

      // Trump round 1 - player's turn
      if (phase === PHASE_TRUMP_ROUND1 && biddingPlayer === 0) {
        const ob = orderUpBtnRect();
        const pb = passBtnRect();
        const ab = aloneBtnRect();

        if (CE.isInRect(mx, my, ob.x, ob.y, ob.w, ob.h)) {
          acceptTrump(0, kittyCard.suit, false);
          return;
        }
        if (CE.isInRect(mx, my, ab.x, ab.y, ab.w, ab.h)) {
          acceptTrump(0, kittyCard.suit, true);
          return;
        }
        if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) {
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
          if (biddingPlayer === dealer) {
            biddingPlayer = leftOf(dealer);
            phase = PHASE_TRUMP_ROUND2;
            aiTurnTimer = 0;
          } else
            advanceBidding();
          return;
        }
        return;
      }

      // Trump round 2 - player's turn
      if (phase === PHASE_TRUMP_ROUND2 && biddingPlayer === 0) {
        const kittyS = kittyCard ? kittyCard.suit : null;
        let suitIdx = 0;
        for (const s of CE.SUITS) {
          if (s === kittyS) continue;
          const r = suitBtnRect(suitIdx);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            acceptTrump(0, s, false);
            return;
          }
          ++suitIdx;
        }
        // Can only pass if not stuck dealer
        if (biddingPlayer !== dealer) {
          const pb = passR2BtnRect();
          if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) {
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
            advanceBidding();
            return;
          }
        }
        return;
      }

      // Discard phase
      if (phase === PHASE_DISCARD) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;
        hands[0].splice(idx, 1);
        startPlaying();
        return;
      }

      // Playing phase - player's turn
      if (phase === PHASE_PLAYING && currentTurn === 0) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        const hand = hands[0];
        if (isValidPlay(hand[idx], hand)) {
          playCard(0, idx);
        } else {
          const leadSuit = effectiveSuit(trickCards[0]);
          let reason = 'Must follow ' + SUIT_NAMES[leadSuit] + '!';
          if (_host) _host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
        }
        return;
      }
    },

    handlePointerMove(mx, my) {
      hoveredCard = -1;
      hoveredBtn = '';

      if ((phase === PHASE_PLAYING && currentTurn === 0) || phase === PHASE_DISCARD)
        hoveredCard = hitTestPlayerCard(mx, my);

      if (phase === PHASE_TRUMP_ROUND1 && biddingPlayer === 0) {
        const ob = orderUpBtnRect();
        const pb = passBtnRect();
        const ab = aloneBtnRect();
        if (CE.isInRect(mx, my, ob.x, ob.y, ob.w, ob.h)) hoveredBtn = 'order';
        else if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) hoveredBtn = 'pass';
        else if (CE.isInRect(mx, my, ab.x, ab.y, ab.w, ab.h)) hoveredBtn = 'alone';
      }

      if (phase === PHASE_TRUMP_ROUND2 && biddingPlayer === 0) {
        const kittyS = kittyCard ? kittyCard.suit : null;
        let suitIdx = 0;
        for (const s of CE.SUITS) {
          if (s === kittyS) continue;
          const r = suitBtnRect(suitIdx);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) { hoveredBtn = s; break; }
          ++suitIdx;
        }
        if (biddingPlayer !== dealer) {
          const pb = passR2BtnRect();
          if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) hoveredBtn = 'pass2';
        }
      }
    },

    handlePointerUp(mx, my, e) {},

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

      // AI bidding round 1
      if (phase === PHASE_TRUMP_ROUND1 && biddingPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          if (aiShouldOrderUp(biddingPlayer, kittyCard.suit)) {
            const alone = aiShouldGoAlone(biddingPlayer, kittyCard.suit);
            if (_host) {
              const msg = PLAYER_NAMES[biddingPlayer] + ' orders up' + (alone ? ' alone!' : '');
              _host.floatingText.add(CANVAS_W / 2, 300, msg, { color: '#ff0', size: 14 });
            }
            acceptTrump(biddingPlayer, kittyCard.suit, alone);
          } else {
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[biddingPlayer] + ' passes', { color: '#aaa', size: 12 });

            // Check if everyone passed round 1
            if (biddingPlayer === dealer) {
              // All passed round 1, go to round 2
              biddingPlayer = leftOf(dealer);
              phase = PHASE_TRUMP_ROUND2;
              aiTurnTimer = 0;
            } else {
              advanceBidding();
            }
          }
        }
        return;
      }

      // AI bidding round 2
      if (phase === PHASE_TRUMP_ROUND2 && biddingPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          const picked = aiPickTrumpRound2(biddingPlayer);
          if (picked) {
            const alone = aiShouldGoAlone(biddingPlayer, picked);
            if (_host) {
              const msg = PLAYER_NAMES[biddingPlayer] + ' calls ' + SUIT_SYMBOLS[picked] + (alone ? ' alone!' : '');
              _host.floatingText.add(CANVAS_W / 2, 300, msg, { color: '#ff0', size: 14 });
            }
            acceptTrump(biddingPlayer, picked, alone);
          } else {
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[biddingPlayer] + ' passes', { color: '#aaa', size: 12 });

            if (biddingPlayer === dealer) {
              // Stuck dealer - should not reach here because aiPickTrumpRound2 forces a pick
              // Fallback: pick first non-kitty suit
              const kittyS = kittyCard ? kittyCard.suit : null;
              for (const s of CE.SUITS) {
                if (s !== kittyS) {
                  acceptTrump(biddingPlayer, s, false);
                  break;
                }
              }
            } else {
              advanceBidding();
            }
          }
        }
        return;
      }

      // Player bidding round 1 - wait for click
      if (phase === PHASE_TRUMP_ROUND1 && biddingPlayer === 0) return;

      // Player bidding round 2 - wait for click
      if (phase === PHASE_TRUMP_ROUND2 && biddingPlayer === 0) return;

      // Discard - wait for player
      if (phase === PHASE_DISCARD) return;

      // AI playing
      if (phase !== PHASE_PLAYING) return;
      if (currentTurn === 0) return;
      if (isSkipped(currentTurn)) {
        currentTurn = nextActivePlayer(currentTurn);
        return;
      }

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
      kitty = [];
      kittyCard = null;
      trickCards = [];
      trickPlayers = [];
      trumpSuit = null;
      callingTeam = -1;
      callingPlayer = -1;
      goingAlone = false;
      sittingOutPlayer = -1;
      teamScores = [0, 0];
      tricksWon = [0, 0];
      roundOver = false;
      gameOver = false;
      phase = PHASE_DEALING;
      aiTurnTimer = 0;
      hoveredCard = -1;
      hoveredBtn = '';
      roundMessage = '';
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) {
      score = s;
      teamScores[TEAM_A] = s;
    }
  };

  SZ.CardGames.registerVariant('euchre', module);

})();
