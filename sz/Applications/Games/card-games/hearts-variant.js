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
  const RANK_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

  const HEART = 'hearts';
  const SPADE = 'spades';
  const DIAMOND = 'diamonds';
  const CLUB = 'clubs';

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 13;
  const GAME_OVER_THRESHOLD = 100;

  const PHASE_PASSING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_OVER = 3;

  const PASS_LEFT = 0;
  const PASS_RIGHT = 1;
  const PASS_ACROSS = 2;
  const PASS_NONE = 3;
  const PASS_NAMES = ['Left', 'Right', 'Across', 'None'];

  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let trickCards = [];
  let trickPlayers = [];
  let cumulativeScores = [0, 0, 0, 0];
  let roundScores = [0, 0, 0, 0];
  let score = 100;
  let roundOver = false;
  let gameOver = false;

  let phase = PHASE_PASSING;
  let passDirection = PASS_LEFT;
  let selectedForPass = [];
  let currentTurn = 0;
  let trickLeader = 0;
  let trickCount = 0;
  let heartsBroken = false;
  let roundNumber = 0;

  let trickWinnerIdx = -1;
  let trickDoneTimer = 0;
  const TRICK_DONE_DELAY = 1.2;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  let hoverCardIdx = -1;

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardKey(card) {
    return card.rank + card.suit;
  }

  function isQueenOfSpades(card) {
    return card.rank === 'Q' && card.suit === SPADE;
  }

  function isHeart(card) {
    return card.suit === HEART;
  }

  function isPenaltyCard(card) {
    return isHeart(card) || isQueenOfSpades(card);
  }

  function cardPenalty(card) {
    if (isHeart(card)) return 1;
    if (isQueenOfSpades(card)) return 13;
    return 0;
  }

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { [CLUB]: 0, [DIAMOND]: 1, [SPADE]: 2, [HEART]: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    });
  }

  function isTwoOfClubs(card) {
    return card.rank === '2' && card.suit === CLUB;
  }

  function findTwoOfClubs() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (const c of hands[p])
        if (isTwoOfClubs(c)) return p;
    return 0;
  }

  function hasOnlyHearts(hand) {
    return hand.every(c => c.suit === HEART);
  }

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

  function getCardsOfSuit(hand, suit) {
    return hand.filter(c => c.suit === suit);
  }

  /* ================================================================
     RULES - VALIDITY
     ================================================================ */

  function isValidPlay(card, hand, leadSuit, isFirstTrick, isLeading) {
    if (isLeading) {
      if (isFirstTrick)
        return isTwoOfClubs(card);
      if (card.suit === HEART && !heartsBroken)
        return hasOnlyHearts(hand);
      return true;
    }

    if (leadSuit && hasSuit(hand, leadSuit))
      return card.suit === leadSuit;

    if (isFirstTrick)
      return !isPenaltyCard(card);

    return true;
  }

  function getValidCards(hand, leadSuit, isFirstTrick, isLeading) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand, leadSuit, isFirstTrick, isLeading))
        valid.push(i);

    if (valid.length === 0) {
      for (let i = 0; i < hand.length; ++i)
        valid.push(i);
    }
    return valid;
  }

  /* ================================================================
     RULES - TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStrength = cardStrength(trickCards[0]);
    for (let i = 1; i < trickCards.length; ++i) {
      if (trickCards[i].suit === leadSuit && cardStrength(trickCards[i]) > bestStrength) {
        bestStrength = cardStrength(trickCards[i]);
        bestIdx = i;
      }
    }
    return trickPlayers[bestIdx];
  }

  function computeTrickPenalty() {
    let penalty = 0;
    for (const c of trickCards)
      penalty += cardPenalty(c);
    return penalty;
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiSelectPassCards(playerIdx) {
    const hand = hands[playerIdx].slice();
    hand.sort((a, b) => cardStrength(b) - cardStrength(a));

    const selected = [];

    const qos = hand.find(c => isQueenOfSpades(c));
    if (qos) {
      selected.push(qos);
      hand.splice(hand.indexOf(qos), 1);
    }

    const highSpades = hand.filter(c => c.suit === SPADE && RANK_ORDER[c.rank] >= RANK_ORDER['K']);
    for (const c of highSpades) {
      if (selected.length >= 3) break;
      selected.push(c);
      hand.splice(hand.indexOf(c), 1);
    }

    const highHearts = hand.filter(c => c.suit === HEART).sort((a, b) => cardStrength(b) - cardStrength(a));
    for (const c of highHearts) {
      if (selected.length >= 3) break;
      selected.push(c);
      hand.splice(hand.indexOf(c), 1);
    }

    const remaining = hand.sort((a, b) => cardStrength(b) - cardStrength(a));
    for (const c of remaining) {
      if (selected.length >= 3) break;
      selected.push(c);
    }

    return selected.slice(0, 3);
  }

  function aiChooseCard(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return -1;

    const isFirstTrick = trickCount === 0;
    const isLeading = trickCards.length === 0;
    const leadSuit = isLeading ? null : trickCards[0].suit;
    const validIdxs = getValidCards(hand, leadSuit, isFirstTrick, isLeading);

    if (validIdxs.length === 1) return validIdxs[0];

    if (isLeading) {
      const nonHeartIdxs = validIdxs.filter(i => hand[i].suit !== HEART);
      const pool = nonHeartIdxs.length > 0 ? nonHeartIdxs : validIdxs;
      pool.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return pool[0];
    }

    const followIdxs = validIdxs.filter(i => hand[i].suit === leadSuit);

    if (followIdxs.length > 0) {
      const currentBest = Math.max(...trickCards.filter(c => c.suit === leadSuit).map(c => cardStrength(c)));

      const underIdxs = followIdxs.filter(i => cardStrength(hand[i]) < currentBest);
      if (underIdxs.length > 0) {
        underIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        return underIdxs[0];
      }

      if (trickCards.length === NUM_PLAYERS - 1) {
        const trickPenalty = computeTrickPenalty();
        if (trickPenalty === 0) {
          followIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
          return followIdxs[0];
        }
      }

      followIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return followIdxs[0];
    }

    const qosIdx = validIdxs.find(i => isQueenOfSpades(hand[i]));
    if (qosIdx !== undefined) return qosIdx;

    const heartIdxs = validIdxs.filter(i => isHeart(hand[i]));
    if (heartIdxs.length > 0) {
      heartIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      return heartIdxs[0];
    }

    const highIdxs = validIdxs.slice().sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
    return highIdxs[0];
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeck());
    hands = [[], [], [], []];
    trickCards = [];
    trickPlayers = [];
    roundScores = [0, 0, 0, 0];
    trickCount = 0;
    heartsBroken = false;
    selectedForPass = [];
    hoverCardIdx = -1;
    trickWinnerIdx = -1;
    trickDoneTimer = 0;
    aiTurnTimer = 0;

    for (let i = 0; i < 52; ++i)
      hands[i % NUM_PLAYERS].push(d[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    for (const c of hands[0])
      c.faceUp = true;

    passDirection = roundNumber % 4;

    if (passDirection === PASS_NONE)
      startPlaying();
    else
      phase = PHASE_PASSING;

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), playerCardY(i), i * 0.06);
    }
  }

  function getPassTarget(from) {
    if (passDirection === PASS_LEFT) return (from + 1) % NUM_PLAYERS;
    if (passDirection === PASS_RIGHT) return (from + 3) % NUM_PLAYERS;
    if (passDirection === PASS_ACROSS) return (from + 2) % NUM_PLAYERS;
    return from;
  }

  function executePass() {
    const passCards = [[], [], [], []];

    const playerCards = [];
    for (const idx of selectedForPass)
      playerCards.push(hands[0][idx]);
    passCards[0] = playerCards;

    for (let p = 1; p < NUM_PLAYERS; ++p)
      passCards[p] = aiSelectPassCards(p);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const target = getPassTarget(p);
      for (const c of passCards[p])
        hands[p].splice(hands[p].indexOf(c), 1);
      for (const c of passCards[p])
        hands[target].push(c);
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    for (const c of hands[0])
      c.faceUp = true;

    selectedForPass = [];
    startPlaying();
  }

  function startPlaying() {
    phase = PHASE_PLAYING;
    const starter = findTwoOfClubs();
    currentTurn = starter;
    trickLeader = starter;
    trickCards = [];
    trickPlayers = [];
  }

  function setupHearts() {
    roundOver = false;
    gameOver = false;
    dealRound();
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(playerIdx, cardIdx) {
    const card = hands[playerIdx].splice(cardIdx, 1)[0];
    card.faceUp = true;

    if (isHeart(card) && !heartsBroken)
      heartsBroken = true;

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
    const penalty = computeTrickPenalty();
    roundScores[winner] += penalty;

    if (_host && penalty > 0) {
      const label = (winner === 0 ? 'You' : PLAYER_NAMES[winner]) + ' +' + penalty + ' pts';
      _host.floatingText.add(CANVAS_W / 2, 280, label, { color: winner === 0 ? '#f44' : '#fa0', size: 16 });
    }

    ++trickCount;
    trickCards = [];
    trickPlayers = [];
    trickWinnerIdx = -1;

    if (trickCount >= HAND_SIZE || hands.every(h => h.length === 0)) {
      endRound();
      return;
    }

    currentTurn = winner;
    trickLeader = winner;
    phase = PHASE_PLAYING;
    aiTurnTimer = 0;
  }

  function endRound() {
    let shooterIdx = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (roundScores[p] === 26) {
        shooterIdx = p;
        break;
      }
    }

    if (shooterIdx >= 0) {
      for (let p = 0; p < NUM_PLAYERS; ++p)
        roundScores[p] = p === shooterIdx ? 0 : 26;

      if (_host) {
        const who = shooterIdx === 0 ? 'You shot' : PLAYER_NAMES[shooterIdx] + ' shot';
        _host.floatingText.add(CANVAS_W / 2, 250, who + ' the moon!', { color: '#ff0', size: 22 });
        if (shooterIdx === 0)
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      cumulativeScores[p] += roundScores[p];

    score = 100 - cumulativeScores[0];
    if (_host) _host.onScoreChanged(score);

    let anyOver = false;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (cumulativeScores[p] >= GAME_OVER_THRESHOLD) anyOver = true;

    ++roundNumber;
    roundOver = true;

    if (anyOver) {
      gameOver = true;
      let lowest = cumulativeScores[0];
      let winner = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (cumulativeScores[p] < lowest) {
          lowest = cumulativeScores[p];
          winner = p;
        }
      }
      if (_host) {
        const msg = winner === 0 ? 'You win the game!' : PLAYER_NAMES[winner] + ' wins the game!';
        const col = winner === 0 ? '#4f4' : '#f88';
        _host.floatingText.add(CANVAS_W / 2, 220, msg, { color: col, size: 24 });
        if (winner === 0) _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    } else {
      if (_host) {
        const msg = 'Round ' + roundNumber + ' complete \u2014 click to continue';
        _host.floatingText.add(CANVAS_W / 2, 220, msg, { color: '#8f8', size: 16 });
      }
    }

    phase = PHASE_ROUND_OVER;
  }

  /* ================================================================
     DRAWING - LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 680;
    const fanWidth = Math.min(maxWidth, total * 50);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function playerCardY(idx) {
    return CANVAS_H - CE.CARD_H - 20;
  }

  const TRICK_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },
    { x: CANVAS_W / 2 - CE.CARD_W - 50, y: 250 },
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 190 },
    { x: CANVAS_W / 2 + 50, y: 250 }
  ];

  const AI_HAND_POSITIONS = [
    null,
    { x: 10, y: 160, dir: 'vertical' },
    { x: 250, y: 10, dir: 'horizontal' },
    { x: CANVAS_W - 10 - CE.CARD_W * 0.55, y: 160, dir: 'vertical' }
  ];

  const PASS_BTN = { x: CANVAS_W / 2 - 60, y: CANVAS_H - CE.CARD_H - 55, w: 120, h: 30 };

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 170;
    const py = 10;
    const pw = 160;
    const ph = 110;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scores', px + 10, py + 8);

    _ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 28 + p * 18;
      const name = PLAYER_NAMES[p];
      const cumul = cumulativeScores[p];
      const rd = roundScores[p];
      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(name, px + 10, y);
      _ctx.textAlign = 'right';
      _ctx.fillText(cumul + (phase !== PHASE_PASSING && rd > 0 ? ' (+' + rd + ')' : ''), px + pw - 10, y);
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
      let y = playerCardY(i);

      const isSelected = selectedForPass.indexOf(i) >= 0;
      if (isSelected) y -= 20;

      if (phase === PHASE_PLAYING && i === hoverCardIdx && currentTurn === 0)
        y -= 10;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      if (_host && _host.hintsEnabled && phase === PHASE_PLAYING && currentTurn === 0) {
        const isFirstTrick = trickCount === 0;
        const isLeading = trickCards.length === 0;
        const leadSuit = isLeading ? null : trickCards[0].suit;
        if (isValidPlay(hand[i], hand, leadSuit, isFirstTrick, isLeading))
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }

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
    }
  }

  function drawAIHands() {
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const hand = hands[p];
      const pos = AI_HAND_POSITIONS[p];
      if (!pos) continue;

      const count = hand.length;
      const isCurrentTurn = currentTurn === p && phase === PHASE_PLAYING;

      _ctx.fillStyle = isCurrentTurn ? '#ff0' : '#aaa';
      _ctx.font = isCurrentTurn ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';

      if (pos.dir === 'vertical') {
        const labelX = p === 1 ? pos.x : pos.x - 10;
        _ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', labelX, pos.y - 16);
        for (let i = 0; i < count; ++i) {
          const cy = pos.y + i * 16;
          CE.drawCardBack(_ctx, pos.x, cy, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
      } else {
        _ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', pos.x, pos.y - 2);
        for (let i = 0; i < count; ++i) {
          const cx = pos.x + i * 22;
          CE.drawCardBack(_ctx, cx, pos.y + 14, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
      }
    }
  }

  function drawTrickArea() {
    _ctx.save();
    _ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    _ctx.lineWidth = 2;
    CE.drawRoundedRect(_ctx, CANVAS_W / 2 - 100, 180, 200, 200, 10);
    _ctx.stroke();
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

  function drawPassingUI() {
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Select 3 cards to pass ' + PASS_NAMES[passDirection], CANVAS_W / 2, 260);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('(' + selectedForPass.length + '/3 selected)', CANVAS_W / 2, 282);

    if (selectedForPass.length === 3)
      CE.drawButton(_ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass Cards', { bg: '#2a5a2a', border: '#6c6', fontSize: 13 });
  }

  function drawPlayingUI() {
    if (currentTurn === 0 && trickCards.length < NUM_PLAYERS && !roundOver) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }

    if (heartsBroken) {
      _ctx.fillStyle = '#f66';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';
      _ctx.fillText('\u2665 broken', 10, CANVAS_H - 16);
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trick ' + (trickCount + 1) + '/13', 10, CANVAS_H - 30);
  }

  function drawRoundOverUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 140;
    const py = 140;
    const pw = 280;
    const ph = 200;

    _ctx.fillStyle = 'rgba(0,0,0,0.7)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Round ' + roundNumber + ' Results', CANVAS_W / 2, py + 12);

    _ctx.font = '12px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 42 + p * 24;
      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], px + 20, y);
      _ctx.textAlign = 'center';
      _ctx.fillText('+' + roundScores[p], px + pw / 2, y);
      _ctx.textAlign = 'right';
      _ctx.fillText('Total: ' + cumulativeScores[p], px + pw - 20, y);
    }

    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 20);
    _ctx.restore();
  }

  function drawHearts() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Hearts', 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Round ' + (roundNumber + 1) + ' \u2014 Pass: ' + PASS_NAMES[passDirection], 10, 28);

    drawScorePanel();
    drawAIHands();
    drawTrickArea();
    drawPlayerHand();

    if (phase === PHASE_PASSING)
      drawPassingUI();
    else if (phase === PHASE_PLAYING)
      drawPlayingUI();
    else if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  /* ================================================================
     HIT TESTING - PLAYER HAND
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      let cy = playerCardY(i);
      const isSelected = selectedForPass.indexOf(i) >= 0;
      if (isSelected) cy -= 20;

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
      score = (_host && _host.getScore) ? _host.getScore() : 100;
      cumulativeScores = [0, 0, 0, 0];
      roundNumber = 0;
      setupHearts();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawHearts();
    },

    handleClick(mx, my) {
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          cumulativeScores = [0, 0, 0, 0];
          roundNumber = 0;
          score = 100;
          gameOver = false;
          if (_host) _host.onScoreChanged(score);
        }
        roundOver = false;
        dealRound();
        return;
      }

      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      if (phase === PHASE_PASSING) {
        if (selectedForPass.length === 3 && CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
          executePass();
          return;
        }

        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        const pos = selectedForPass.indexOf(idx);
        if (pos >= 0) {
          selectedForPass.splice(pos, 1);
        } else if (selectedForPass.length < 3)
          selectedForPass.push(idx);

        return;
      }

      if (phase === PHASE_PLAYING && currentTurn === 0) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        const hand = hands[0];
        const isFirstTrick = trickCount === 0;
        const isLeading = trickCards.length === 0;
        const leadSuit = isLeading ? null : trickCards[0].suit;

        if (isValidPlay(hand[idx], hand, leadSuit, isFirstTrick, isLeading)) {
          playCard(0, idx);
        } else {
          let reason = 'Invalid play!';
          if (isFirstTrick && isLeading && !isTwoOfClubs(hand[idx]))
            reason = 'Must lead 2\u2663!';
          else if (leadSuit && hasSuit(hand, leadSuit) && hand[idx].suit !== leadSuit)
            reason = 'Must follow ' + SUIT_NAMES[leadSuit] + '!';
          else if (isLeading && isHeart(hand[idx]) && !heartsBroken && !hasOnlyHearts(hand))
            reason = 'Hearts not broken!';
          else if (isFirstTrick && isPenaltyCard(hand[idx]))
            reason = 'No penalty cards on first trick!';

          if (_host) _host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
        }
        return;
      }
    },

    handlePointerMove(mx, my) {
      if (phase === PHASE_PLAYING && currentTurn === 0)
        hoverCardIdx = hitTestPlayerCard(mx, my);
      else
        hoverCardIdx = -1;
    },

    handlePointerUp() {},

    handleKey(e) {},

    tick(dt) {
      if (roundOver && phase !== PHASE_ROUND_OVER) return;
      if (gameOver) return;

      if (phase === PHASE_TRICK_DONE) {
        trickDoneTimer += dt;
        if (trickDoneTimer >= TRICK_DONE_DELAY)
          finishTrick();
        return;
      }

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
      trickCards = [];
      trickPlayers = [];
      cumulativeScores = [0, 0, 0, 0];
      roundScores = [0, 0, 0, 0];
      selectedForPass = [];
      roundOver = false;
      gameOver = false;
      phase = PHASE_PASSING;
      aiTurnTimer = 0;
      hoverCardIdx = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('hearts', module);

})();
