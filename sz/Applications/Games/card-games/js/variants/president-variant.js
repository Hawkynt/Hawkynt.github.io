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

  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];
  const WIN_SCORE = 15;

  /* President rank order: 3 (lowest) through 2 (highest) */
  const RANK_STRENGTH = {
    '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5,
    '9': 6, '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12
  };

  const TITLE_NAMES = ['President', 'Vice President', 'Vice Scum', 'Scum'];
  const TITLE_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32', '#888'];
  const TITLE_POINTS = [3, 2, 1, 0];

  /* Phases */
  const PHASE_EXCHANGE = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_CLEAR = 2;
  const PHASE_ROUND_OVER = 3;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let pile = [];
  let pileCount = 0;
  let pileRank = '';

  let currentTurn = 0;
  let leadPlayer = 0;
  let passCount = 0;
  let phase = PHASE_PLAYING;

  let selectedCards = [];
  let hoverCardIdx = -1;

  let finishOrder = [];
  let titles = [-1, -1, -1, -1];
  let scores = [0, 0, 0, 0];
  let score = 0;
  let roundNumber = 0;
  let roundOver = false;
  let gameOver = false;

  let exchangeCards = [[], [], [], []];
  let exchangeDone = [false, false, false, false];
  let exchangePhaseActive = false;

  let trickClearTimer = 0;
  const TRICK_CLEAR_DELAY = 1.0;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  /* ================================================================
     CARD UTILITIES
     ================================================================ */

  function cardStrength(card) {
    return RANK_STRENGTH[card.rank];
  }

  function sortHand(hand) {
    hand.sort((a, b) => {
      const sd = cardStrength(a) - cardStrength(b);
      if (sd !== 0) return sd;
      return CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
    });
  }

  function cardsOfRank(hand, rank) {
    return hand.filter(c => c.rank === rank);
  }

  function uniqueRanks(hand) {
    const seen = new Set();
    for (const c of hand) seen.add(c.rank);
    return [...seen];
  }

  function removeCards(hand, cards) {
    for (const c of cards) {
      const idx = hand.indexOf(c);
      if (idx >= 0) hand.splice(idx, 1);
    }
  }

  /* ================================================================
     RULES - VALIDITY
     ================================================================ */

  function isValidPlay(cards, hand) {
    if (cards.length === 0) return false;

    const rank = cards[0].rank;
    if (!cards.every(c => c.rank === rank)) return false;

    if (pile.length === 0)
      return true;

    if (cards.length !== pileCount) return false;
    if (cardStrength(cards[0]) <= RANK_STRENGTH[pileRank]) return false;

    return true;
  }

  function getPlayableRanks(hand) {
    const playable = [];
    if (pile.length === 0) {
      for (const rank of uniqueRanks(hand)) {
        const matching = cardsOfRank(hand, rank);
        for (let count = 1; count <= matching.length; ++count)
          playable.push({ rank, count });
      }
      return playable;
    }

    for (const rank of uniqueRanks(hand)) {
      if (RANK_STRENGTH[rank] <= RANK_STRENGTH[pileRank]) continue;
      const matching = cardsOfRank(hand, rank);
      if (matching.length >= pileCount)
        playable.push({ rank, count: pileCount });
    }
    return playable;
  }

  function canPlay(hand) {
    return getPlayableRanks(hand).length > 0;
  }

  function isClearingPlay(cards) {
    if (cards.length === 4) return true;
    if (cards.length > 0 && cards[0].rank === '2') return true;
    return false;
  }

  /* ================================================================
     DEAL & SETUP
     ================================================================ */

  function dealRound() {
    const deck = CE.shuffle(CE.createDeck());
    hands = [[], [], [], []];
    pile = [];
    pileCount = 0;
    pileRank = '';
    passCount = 0;
    finishOrder = [];
    selectedCards = [];
    hoverCardIdx = -1;
    trickClearTimer = 0;
    aiTurnTimer = 0;
    exchangeCards = [[], [], [], []];
    exchangeDone = [false, false, false, false];
    exchangePhaseActive = false;

    for (let i = 0; i < 52; ++i)
      hands[i % NUM_PLAYERS].push(deck[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    for (const c of hands[0])
      c.faceUp = true;

    if (roundNumber > 0 && titles.some(t => t >= 0))
      startExchange();
    else
      startPlaying();

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), playerCardY(), i * 0.06);
    }
  }

  function startExchange() {
    exchangePhaseActive = true;
    phase = PHASE_EXCHANGE;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (titles[p] < 0) {
        exchangeDone[p] = true;
        continue;
      }
    }

    for (let p = 1; p < NUM_PLAYERS; ++p) {
      if (!exchangeDone[p])
        aiDoExchange(p);
    }
  }

  function getExchangeCount(titleIdx) {
    if (titleIdx === 0) return 2;
    if (titleIdx === 1) return 1;
    if (titleIdx === 2) return 1;
    if (titleIdx === 3) return 2;
    return 0;
  }

  function aiDoExchange(playerIdx) {
    const title = titles[playerIdx];
    const count = getExchangeCount(title);
    if (count === 0) {
      exchangeDone[playerIdx] = true;
      return;
    }

    const hand = hands[playerIdx].slice();

    if (title >= 2) {
      hand.sort((a, b) => cardStrength(b) - cardStrength(a));
      exchangeCards[playerIdx] = hand.slice(0, count);
    } else {
      hand.sort((a, b) => cardStrength(a) - cardStrength(b));
      exchangeCards[playerIdx] = hand.slice(0, count);
    }
    exchangeDone[playerIdx] = true;
  }

  function executeExchange() {
    const presIdx = titles.indexOf(0);
    const vpIdx = titles.indexOf(1);
    const vsIdx = titles.indexOf(2);
    const scumIdx = titles.indexOf(3);

    if (presIdx >= 0 && scumIdx >= 0) {
      const presGive = exchangeCards[presIdx];
      const scumGive = exchangeCards[scumIdx];
      removeCards(hands[presIdx], presGive);
      removeCards(hands[scumIdx], scumGive);
      for (const c of scumGive) hands[presIdx].push(c);
      for (const c of presGive) hands[scumIdx].push(c);
    }

    if (vpIdx >= 0 && vsIdx >= 0) {
      const vpGive = exchangeCards[vpIdx];
      const vsGive = exchangeCards[vsIdx];
      removeCards(hands[vpIdx], vpGive);
      removeCards(hands[vsIdx], vsGive);
      for (const c of vsGive) hands[vpIdx].push(c);
      for (const c of vpGive) hands[vsIdx].push(c);
    }

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      sortHand(hands[p]);
      if (p === 0)
        for (const c of hands[0]) c.faceUp = true;
    }

    exchangePhaseActive = false;
    startPlaying();
  }

  function startPlaying() {
    phase = PHASE_PLAYING;
    pile = [];
    pileCount = 0;
    pileRank = '';
    passCount = 0;

    if (roundNumber === 0) {
      currentTurn = findStartingPlayer();
    } else {
      const scumIdx = titles.indexOf(3);
      currentTurn = scumIdx >= 0 ? scumIdx : 0;
    }
    leadPlayer = currentTurn;
  }

  function findStartingPlayer() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (const c of hands[p])
        if (c.rank === '3' && c.suit === 'clubs') return p;
    return 0;
  }

  /* ================================================================
     PLAY FLOW
     ================================================================ */

  function playCards(playerIdx, cards) {
    removeCards(hands[playerIdx], cards);

    for (const c of cards) {
      c.faceUp = true;
      pile.push(c);
    }

    pileRank = cards[0].rank;
    pileCount = cards.length;
    passCount = 0;
    leadPlayer = playerIdx;

    if (_host) {
      const label = (playerIdx === 0 ? 'You play ' : PLAYER_NAMES[playerIdx] + ' plays ') +
        cards.length + 'x ' + cards[0].rank;
      _host.floatingText.add(CANVAS_W / 2, 270, label, { color: '#ff0', size: 14 });
    }

    if (hands[playerIdx].length === 0 && finishOrder.indexOf(playerIdx) < 0) {
      finishOrder.push(playerIdx);
      if (_host) {
        const pos = finishOrder.length;
        const name = playerIdx === 0 ? 'You' : PLAYER_NAMES[playerIdx];
        _host.floatingText.add(CANVAS_W / 2, 240, name + ' finished #' + pos + '!', {
          color: TITLE_COLORS[pos - 1], size: 18
        });
        if (playerIdx === 0)
          _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
      }
    }

    if (checkRoundEnd()) return;

    if (isClearingPlay(cards)) {
      phase = PHASE_TRICK_CLEAR;
      trickClearTimer = 0;
      return;
    }

    advanceTurn();
  }

  function doPass(playerIdx) {
    ++passCount;

    if (_host && playerIdx !== 0) {
      _host.floatingText.add(CANVAS_W / 2, 290, PLAYER_NAMES[playerIdx] + ' passes', { color: '#aaa', size: 12 });
    }

    const activePlayers = countActivePlayers();

    if (passCount >= activePlayers - 1) {
      phase = PHASE_TRICK_CLEAR;
      trickClearTimer = 0;
      return;
    }

    advanceTurn();
  }

  function clearPile() {
    pile = [];
    pileCount = 0;
    pileRank = '';
    passCount = 0;
    phase = PHASE_PLAYING;

    if (hands[leadPlayer].length > 0) {
      currentTurn = leadPlayer;
    } else {
      currentTurn = nextActivePlayer(leadPlayer);
    }

    if (checkRoundEnd()) return;

    aiTurnTimer = 0;
  }

  function advanceTurn() {
    currentTurn = nextActivePlayer(currentTurn);
    aiTurnTimer = 0;
  }

  function nextActivePlayer(from) {
    for (let i = 1; i <= NUM_PLAYERS; ++i) {
      const p = (from + i) % NUM_PLAYERS;
      if (hands[p].length > 0 && finishOrder.indexOf(p) < 0) return p;
    }
    return from;
  }

  function countActivePlayers() {
    let count = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (hands[p].length > 0 && finishOrder.indexOf(p) < 0) ++count;
    return count;
  }

  function checkRoundEnd() {
    const active = countActivePlayers();
    if (active <= 1) {
      for (let p = 0; p < NUM_PLAYERS; ++p)
        if (finishOrder.indexOf(p) < 0) finishOrder.push(p);
      endRound();
      return true;
    }
    return false;
  }

  function endRound() {
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      titles[finishOrder[i]] = i;
      scores[finishOrder[i]] += TITLE_POINTS[i];
    }

    score = scores[0];
    if (_host) _host.onScoreChanged(score);

    ++roundNumber;
    roundOver = true;

    let anyWin = false;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (scores[p] >= WIN_SCORE) anyWin = true;

    if (anyWin) {
      gameOver = true;
      let winner = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        if (scores[p] > scores[winner]) winner = p;

      if (_host) {
        const msg = winner === 0 ? 'You win the game!' : PLAYER_NAMES[winner] + ' wins the game!';
        const col = winner === 0 ? '#4f4' : '#f88';
        _host.floatingText.add(CANVAS_W / 2, 200, msg, { color: col, size: 24 });
        if (winner === 0) _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
      }
    }

    phase = PHASE_ROUND_OVER;
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChoosePlay(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return null;

    const playable = getPlayableRanks(hand);
    if (playable.length === 0) return null;

    if (pile.length === 0) {
      playable.sort((a, b) => RANK_STRENGTH[a.rank] - RANK_STRENGTH[b.rank]);

      for (const p of playable)
        if (p.rank !== '2') return getCardsForPlay(hand, p.rank, p.count);
      return getCardsForPlay(hand, playable[0].rank, playable[0].count);
    }

    const nonTwos = playable.filter(p => p.rank !== '2');

    if (nonTwos.length > 0) {
      nonTwos.sort((a, b) => RANK_STRENGTH[a.rank] - RANK_STRENGTH[b.rank]);
      return getCardsForPlay(hand, nonTwos[0].rank, nonTwos[0].count);
    }

    if (hand.length <= 3)
      return getCardsForPlay(hand, playable[0].rank, playable[0].count);

    return null;
  }

  function getCardsForPlay(hand, rank, count) {
    const matching = cardsOfRank(hand, rank);
    return matching.slice(0, count);
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

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 20;
  }

  const PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PILE_Y = 220;

  const AI_HAND_POSITIONS = [
    null,
    { x: 10, y: 160, dir: 'vertical' },
    { x: 250, y: 10, dir: 'horizontal' },
    { x: CANVAS_W - 10 - CE.CARD_W * 0.55, y: 160, dir: 'vertical' }
  ];

  const PLAY_BTN = { x: CANVAS_W / 2 - 110, y: CANVAS_H - CE.CARD_H - 60, w: 90, h: 30 };
  const PASS_BTN = { x: CANVAS_W / 2 + 20, y: CANVAS_H - CE.CARD_H - 60, w: 90, h: 30 };

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawTitle() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('President', 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Round ' + (roundNumber + 1) + '  |  First to ' + WIN_SCORE + ' pts', 10, 28);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 180;
    const py = 10;
    const pw = 170;
    const ph = 120;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scores', px + 10, py + 8);

    _ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 28 + p * 20;
      const titleIdx = titles[p];
      const titleStr = titleIdx >= 0 ? ' (' + TITLE_NAMES[titleIdx] + ')' : '';

      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], px + 10, y);
      _ctx.textAlign = 'right';
      _ctx.fillText(scores[p] + ' pts' + titleStr, px + pw - 10, y);
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
      let y = playerCardY();

      const isSelected = selectedCards.indexOf(hand[i]) >= 0;
      if (isSelected) y -= 20;

      if (phase === PHASE_PLAYING && i === hoverCardIdx && currentTurn === 0)
        y -= 10;

      CE.drawCardFace(_ctx, x, y, hand[i]);

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

      if (_host && _host.hintsEnabled && phase === PHASE_PLAYING && currentTurn === 0) {
        const sameRank = cardsOfRank(hand, hand[i].rank);
        let hintable = false;
        if (pile.length === 0)
          hintable = true;
        else if (sameRank.length >= pileCount && cardStrength(hand[i]) > RANK_STRENGTH[pileRank])
          hintable = true;
        if (hintable)
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
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
      const titleIdx = titles[p];

      _ctx.fillStyle = isCurrentTurn ? '#ff0' : '#aaa';
      _ctx.font = isCurrentTurn ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';

      if (pos.dir === 'vertical') {
        const labelX = p === 1 ? pos.x : pos.x - 10;
        let labelText = PLAYER_NAMES[p] + ' (' + count + ')';
        if (titleIdx >= 0) labelText += ' ' + TITLE_NAMES[titleIdx][0];
        _ctx.fillText(labelText, labelX, pos.y - 16);
        for (let i = 0; i < count; ++i) {
          const cy = pos.y + i * 16;
          CE.drawCardBack(_ctx, pos.x, cy, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
      } else {
        let labelText = PLAYER_NAMES[p] + ' (' + count + ')';
        if (titleIdx >= 0) labelText += ' ' + TITLE_NAMES[titleIdx][0];
        _ctx.fillText(labelText, pos.x, pos.y - 2);
        for (let i = 0; i < count; ++i) {
          const cx = pos.x + i * 22;
          CE.drawCardBack(_ctx, cx, pos.y + 14, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
      }

      if (finishOrder.indexOf(p) >= 0 && hands[p].length === 0) {
        const rank = finishOrder.indexOf(p);
        _ctx.fillStyle = TITLE_COLORS[rank];
        _ctx.font = 'bold 11px sans-serif';
        const fx = pos.dir === 'vertical' ? pos.x + 10 : pos.x + 60;
        const fy = pos.dir === 'vertical' ? pos.y + 10 : pos.y + 30;
        _ctx.fillText(TITLE_NAMES[rank], fx, fy);
      }
    }
  }

  function drawPileArea() {
    _ctx.save();
    _ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    _ctx.lineWidth = 2;
    CE.drawRoundedRect(_ctx, PILE_X - 30, PILE_Y - 10, CE.CARD_W + 60, CE.CARD_H + 40, 10);
    _ctx.stroke();
    _ctx.restore();

    if (pile.length === 0) {
      CE.drawEmptySlot(_ctx, PILE_X, PILE_Y, 'Pile');
      return;
    }

    const showCount = Math.min(pile.length, pileCount);
    const startIdx = pile.length - showCount;
    for (let i = 0; i < showCount; ++i) {
      const offset = i * 18;
      CE.drawCardFace(_ctx, PILE_X + offset, PILE_Y, pile[startIdx + i]);
    }

    _ctx.fillStyle = '#ccc';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(pileCount + 'x ' + pileRank + ' (' + pile.length + ' in pile)', CANVAS_W / 2, PILE_Y + CE.CARD_H + 6);
  }

  function drawTurnIndicator() {
    if (phase !== PHASE_PLAYING) return;

    const name = currentTurn === 0 ? 'Your' : PLAYER_NAMES[currentTurn] + "'s";
    _ctx.fillStyle = currentTurn === 0 ? '#8f8' : '#ff0';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(name + ' turn', CANVAS_W / 2, PILE_Y - 24);
  }

  function drawPlayerButtons() {
    if (phase !== PHASE_PLAYING || currentTurn !== 0) return;
    if (roundOver || gameOver) return;

    const hasSelection = selectedCards.length > 0;
    const selectionValid = hasSelection && isValidPlay(selectedCards, hands[0]);

    if (hasSelection) {
      const bg = selectionValid ? '#2a5a2a' : '#5a2a2a';
      const border = selectionValid ? '#6c6' : '#c66';
      CE.drawButton(_ctx, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h, 'Play', { bg, border, fontSize: 13 });
    }

    CE.drawButton(_ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass', { bg: '#3a3a5a', border: '#88c', fontSize: 13 });

    if (currentTurn === 0) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Select cards of the same rank, then Play or Pass', CANVAS_W / 2, CANVAS_H - 6);
    }
  }

  function drawExchangeUI() {
    _ctx.save();
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';

    const myTitle = titles[0];
    if (myTitle < 0) {
      _ctx.fillText('Waiting for card exchange...', CANVAS_W / 2, 260);
      _ctx.restore();
      return;
    }

    const count = getExchangeCount(myTitle);
    if (count === 0) {
      _ctx.fillText('No exchange needed', CANVAS_W / 2, 260);
      _ctx.restore();
      return;
    }

    const giving = myTitle <= 1 ? 'worst' : 'best';
    _ctx.fillText(TITLE_NAMES[myTitle] + ': Select ' + count + ' ' + giving + ' card(s) to give', CANVAS_W / 2, 250);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('(' + selectedCards.length + '/' + count + ' selected)', CANVAS_W / 2, 274);

    if (selectedCards.length === count) {
      const btn = { x: CANVAS_W / 2 - 60, y: 290, w: 120, h: 30 };
      CE.drawButton(_ctx, btn.x, btn.y, btn.w, btn.h, 'Exchange', { bg: '#2a5a2a', border: '#6c6', fontSize: 13 });
    }
    _ctx.restore();
  }

  function drawRoundOverUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 160;
    const py = 130;
    const pw = 320;
    const ph = 280;

    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Round ' + roundNumber + ' Results', CANVAS_W / 2, py + 12);

    _ctx.font = '13px sans-serif';
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const p = finishOrder[i];
      const y = py + 44 + i * 28;

      _ctx.fillStyle = TITLE_COLORS[i];
      _ctx.textAlign = 'left';
      _ctx.fillText(TITLE_NAMES[i], px + 20, y);

      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'center';
      _ctx.fillText(PLAYER_NAMES[p], px + pw / 2, y);

      _ctx.textAlign = 'right';
      _ctx.fillText('+' + TITLE_POINTS[i] + ' (Total: ' + scores[p] + ')', px + pw - 20, y);
    }

    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 24);
    _ctx.restore();
  }

  function drawAll() {
    drawTitle();
    drawScorePanel();
    drawAIHands();
    drawPileArea();
    drawTurnIndicator();
    drawPlayerHand();

    if (phase === PHASE_EXCHANGE)
      drawExchangeUI();
    else if (phase === PHASE_PLAYING)
      drawPlayerButtons();
    else if (phase === PHASE_ROUND_OVER)
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
      let cy = playerCardY();
      const isSelected = selectedCards.indexOf(hand[i]) >= 0;
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
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      scores = [0, 0, 0, 0];
      titles = [-1, -1, -1, -1];
      roundNumber = 0;
      roundOver = false;
      gameOver = false;
      dealRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAll();
    },

    handleClick(mx, my) {
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          scores = [0, 0, 0, 0];
          titles = [-1, -1, -1, -1];
          roundNumber = 0;
          score = 0;
          gameOver = false;
          if (_host) _host.onScoreChanged(score);
        }
        roundOver = false;
        dealRound();
        return;
      }

      if (phase === PHASE_EXCHANGE) {
        const myTitle = titles[0];
        const count = getExchangeCount(myTitle);

        if (count > 0 && selectedCards.length === count) {
          const btn = { x: CANVAS_W / 2 - 60, y: 290, w: 120, h: 30 };
          if (CE.isInRect(mx, my, btn.x, btn.y, btn.w, btn.h)) {
            exchangeCards[0] = selectedCards.slice();
            exchangeDone[0] = true;
            selectedCards = [];

            if (exchangeDone.every(d => d))
              executeExchange();
            return;
          }
        }

        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        const card = hands[0][idx];
        const pos = selectedCards.indexOf(card);
        if (pos >= 0) {
          selectedCards.splice(pos, 1);
        } else if (selectedCards.length < count)
          selectedCards.push(card);

        return;
      }

      if (phase === PHASE_PLAYING && currentTurn === 0) {
        if (CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
          if (pile.length === 0) {
            if (_host) _host.floatingText.add(mx, my - 20, 'Must play when leading!', { color: '#f88', size: 14 });
            return;
          }
          selectedCards = [];
          doPass(0);
          return;
        }

        if (selectedCards.length > 0 && CE.isInRect(mx, my, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h)) {
          if (isValidPlay(selectedCards, hands[0])) {
            const cardsToPlay = selectedCards.slice();
            selectedCards = [];
            playCards(0, cardsToPlay);
          } else {
            if (_host) _host.floatingText.add(mx, my - 20, 'Invalid selection!', { color: '#f88', size: 14 });
          }
          return;
        }

        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        const card = hands[0][idx];
        const pos = selectedCards.indexOf(card);
        if (pos >= 0) {
          selectedCards.splice(pos, 1);
        } else {
          if (selectedCards.length > 0 && selectedCards[0].rank !== card.rank) {
            selectedCards = [card];
          } else
            selectedCards.push(card);
        }
        return;
      }
    },

    handlePointerMove(mx, my) {
      if ((phase === PHASE_PLAYING || phase === PHASE_EXCHANGE) && currentTurn === 0)
        hoverCardIdx = hitTestPlayerCard(mx, my);
      else
        hoverCardIdx = -1;
    },

    handlePointerUp() {},

    handleKey(e) {
      if (phase !== PHASE_PLAYING || currentTurn !== 0) return;

      if (e.key === 'Enter' || e.key === ' ') {
        if (selectedCards.length > 0 && isValidPlay(selectedCards, hands[0])) {
          const cardsToPlay = selectedCards.slice();
          selectedCards = [];
          playCards(0, cardsToPlay);
        }
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        if (pile.length > 0) {
          selectedCards = [];
          doPass(0);
        }
        return;
      }

      if (e.key === 'Escape') {
        selectedCards = [];
        return;
      }
    },

    tick(dt) {
      if (roundOver && phase !== PHASE_ROUND_OVER) return;
      if (gameOver) return;

      if (phase === PHASE_TRICK_CLEAR) {
        trickClearTimer += dt;
        if (trickClearTimer >= TRICK_CLEAR_DELAY)
          clearPile();
        return;
      }

      if (phase !== PHASE_PLAYING) return;
      if (currentTurn === 0) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;

        if (hands[currentTurn].length === 0 || finishOrder.indexOf(currentTurn) >= 0) {
          advanceTurn();
          return;
        }

        const play = aiChoosePlay(currentTurn);
        if (play)
          playCards(currentTurn, play);
        else
          doPass(currentTurn);
      }
    },

    sortPlayerHand() { sortHand(hands[0]); },

    cleanup() {
      hands = [[], [], [], []];
      pile = [];
      selectedCards = [];
      finishOrder = [];
      titles = [-1, -1, -1, -1];
      scores = [0, 0, 0, 0];
      exchangeCards = [[], [], [], []];
      exchangeDone = [false, false, false, false];
      roundOver = false;
      gameOver = false;
      phase = PHASE_PLAYING;
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

  SZ.CardGames.registerVariant('president', module);

})();
