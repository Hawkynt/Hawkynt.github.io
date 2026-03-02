;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const MAX_DT = 0.05;

  /* ── Card dimensions ── */
  const CARD_W = 70;
  const CARD_H = 100;
  const CARD_GAP = 8;
  const CARD_RADIUS = 6;

  /* ── Game states ── */
  const STATE_MENU = 'MENU';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_ROUND_OVER = 'ROUND_OVER';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-card-games';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 10;

  /* ── Suits & Ranks ── */
  const SUITS = ['♠', '♥', '♦', '♣'];
  const SUIT_COLORS = { '♠': '#222', '♥': '#c00', '♦': '#c00', '♣': '#222' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* ── Variant definitions ── */
  const VARIANTS = [
    { id: 'poker',      name: 'Poker',      desc: 'Five-card draw with betting rounds' },
    { id: 'blackjack',  name: 'Blackjack',  desc: 'Get as close to 21 as you can' },
    { id: 'uno',        name: 'Uno',        desc: 'Match cards by color or number' },
    { id: 'skipbo',     name: 'SkipBo',     desc: 'Build sequential piles 1 to 12' },
    { id: 'skat',       name: 'Skat',       desc: 'German trick-taking card game' },
    { id: 'canasta',    name: 'Canasta',    desc: 'Form melds of seven cards' },
    { id: 'doppelkopf', name: 'Doppelkopf', desc: 'Hidden teams trick-taking game' }
  ];

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════
     VISUAL EFFECTS
     ══════════════════════════════════════════════════════════════════ */

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_MENU;
  let currentVariant = null;
  let score = 0;
  let roundNumber = 0;
  let lastTimestamp = 0;

  /* ── Card animation state ── */
  let dealAnimations = [];   // { card, fromX, fromY, toX, toY, t, duration, done }
  let flipAnimations = [];   // { cardRef, t, duration, faceUp }
  let glowCards = [];         // { x, y, w, h, t, duration }
  let chipSparkleTimer = 0;

  /* ── Shared game data ── */
  let deck = [];
  let playerHand = [];
  let aiHands = [];     // array of hands for AI players
  let discardPile = [];

  /* ── Blackjack state ── */
  let bjPlayerHand = [];
  let bjDealerHand = [];
  let bjDealerRevealed = false;
  let bjPlayerStood = false;
  let bjBet = 10;

  /* ── Poker state ── */
  let pokerBet = 0;
  let pokerPot = 0;
  let pokerPhase = 'deal'; // deal, bet, draw, showdown
  let pokerChips = 100;

  /* ── Uno state ── */
  let unoTopCard = null;
  let unoDirection = 1;
  let unoCurrentPlayer = 0;
  let unoHands = [];
  const unoColors = ['red', 'blue', 'green', 'yellow'];
  let unoDeck = [];

  /* ── SkipBo state ── */
  let skipBoStockPiles = [];
  let skipBoBuildPiles = [];

  /* ── Trick-taking shared (Skat, Doppelkopf) ── */
  let trickCards = [];
  let trumpSuit = '♠';
  let skatHandCards = [];
  let doppelkopfTeams = [];

  /* ── Canasta state ── */
  let canastaMelds = [];

  /* ══════════════════════════════════════════════════════════════════
     DECK CREATION & SHUFFLING
     ══════════════════════════════════════════════════════════════════ */

  function createStandardDeck() {
    const d = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        d.push({ suit, rank, faceUp: false });
    return d;
  }

  function createUnoDeck() {
    const d = [];
    for (const color of unoColors) {
      d.push({ color, value: '0', type: 'number' });
      for (let i = 1; i <= 9; ++i) {
        d.push({ color, value: String(i), type: 'number' });
        d.push({ color, value: String(i), type: 'number' });
      }
      for (const special of ['Skip', 'Reverse', 'Draw Two']) {
        d.push({ color, value: special, type: 'action' });
        d.push({ color, value: special, type: 'action' });
      }
    }
    for (let i = 0; i < 4; ++i) {
      d.push({ color: 'wild', value: 'Wild', type: 'wild' });
      d.push({ color: 'wild', value: 'Wild Draw Four', type: 'wild' });
    }
    return d;
  }

  function createSkipBoDeck() {
    const d = [];
    for (let n = 1; n <= 12; ++n)
      for (let i = 0; i < 12; ++i)
        d.push({ value: n, type: 'number' });
    for (let i = 0; i < 18; ++i)
      d.push({ value: 0, type: 'skipbo' }); // SkipBo wild
    return d;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ══════════════════════════════════════════════════════════════════
     CARD RENDERING
     ══════════════════════════════════════════════════════════════════ */

  function drawCardBack(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#246';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, CARD_RADIUS);
    ctx.fill();
    ctx.stroke();
    // Pattern on back
    ctx.fillStyle = '#135';
    roundRect(x + 4, y + 4, w - 8, h - 8, 3);
    ctx.fill();
    // Diamond pattern
    ctx.strokeStyle = '#369';
    ctx.lineWidth = 0.5;
    for (let dy = 8; dy < h - 8; dy += 8) {
      ctx.beginPath();
      ctx.moveTo(x + 4, y + dy);
      ctx.lineTo(x + w - 4, y + dy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCardFace(x, y, w, h, card) {
    ctx.save();
    // Card body
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, CARD_RADIUS);
    ctx.fill();
    ctx.stroke();
    // Rank + suit
    const color = SUIT_COLORS[card.suit] || '#222';
    ctx.fillStyle = color;
    ctx.font = 'bold 16px serif';
    ctx.textBaseline = 'top';
    ctx.fillText(card.rank, x + 5, y + 4);
    ctx.font = '18px serif';
    ctx.fillText(card.suit, x + 5, y + 20);
    // Center suit
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.suit, x + w / 2, y + h / 2);
    ctx.restore();
  }

  function drawUnoCard(x, y, w, h, card) {
    ctx.save();
    const colorMap = { red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0', wild: '#333' };
    ctx.fillStyle = colorMap[card.color] || '#333';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, CARD_RADIUS);
    ctx.fill();
    ctx.stroke();
    // Center oval
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 3, h / 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.value, x + w / 2, y + h / 2);
    ctx.restore();
  }

  function drawSkipBoCard(x, y, w, h, card) {
    ctx.save();
    ctx.fillStyle = card.type === 'skipbo' ? '#f84' : '#fff';
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, CARD_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = card.type === 'skipbo' ? '#fff' : '#333';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.type === 'skipbo' ? 'SB' : String(card.value), x + w / 2, y + h / 2);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ══════════════════════════════════════════════════════════════════
     CARD ANIMATIONS
     ══════════════════════════════════════════════════════════════════ */

  function dealCardAnim(card, fromX, fromY, toX, toY, delay) {
    dealAnimations.push({
      card, fromX, fromY, toX, toY,
      t: -delay, duration: 0.3, done: false
    });
  }

  function flipCard(cardRef, faceUp) {
    flipAnimations.push({
      cardRef, t: 0, duration: 0.25, faceUp, scaleX: 1
    });
  }

  function addGlow(x, y, w, h, duration) {
    glowCards.push({ x, y, w, h, t: 0, duration: duration || 1.5 });
  }

  function triggerChipSparkle(x, y) {
    particles.sparkle(x, y, 20, { color: '#fa0', speed: 80, life: 0.8 });
    chipSparkleTimer = 1.0;
  }

  function updateAnimations(dt) {
    // Deal animations — lerp from source to target
    for (const a of dealAnimations) {
      a.t += dt;
      if (a.t >= a.duration) a.done = true;
    }
    dealAnimations = dealAnimations.filter(a => !a.done);

    // Flip animations — scaleX shrink/grow
    for (const f of flipAnimations) {
      f.t += dt;
      const half = f.duration / 2;
      if (f.t < half) {
        f.scaleX = 1 - (f.t / half);
      } else {
        f.scaleX = (f.t - half) / half;
        f.cardRef.faceUp = f.faceUp;
      }
    }
    flipAnimations = flipAnimations.filter(f => f.t < f.duration);

    // Glow timers
    for (const g of glowCards) g.t += dt;
    glowCards = glowCards.filter(g => g.t < g.duration);

    // Chip sparkle
    if (chipSparkleTimer > 0) chipSparkleTimer -= dt;
  }

  function drawDealAnimations() {
    for (const a of dealAnimations) {
      if (a.t < 0) continue;
      const p = Math.min(a.t / a.duration, 1);
      const ease = 1 - (1 - p) * (1 - p); // ease-out quad
      const x = a.fromX + (a.toX - a.fromX) * ease;
      const y = a.fromY + (a.toY - a.fromY) * ease;
      drawCardBack(x, y, CARD_W, CARD_H);
    }
  }

  function drawGlowEffects() {
    for (const g of glowCards) {
      const alpha = 0.5 * (1 - g.t / g.duration);
      ctx.save();
      ctx.shadowColor = '#fc0';
      ctx.shadowBlur = 20 + 10 * Math.sin(g.t * 6);
      ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
      roundRect(g.x - 3, g.y - 3, g.w + 6, g.h + 6, CARD_RADIUS + 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     BLACKJACK RULES ENGINE
     ══════════════════════════════════════════════════════════════════ */

  function bjCardValue(card) {
    if (card.rank === 'A') return 11;
    if (['K', 'Q', 'J'].includes(card.rank)) return 10;
    return parseInt(card.rank, 10);
  }

  function bjHandValue(hand) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
      total += bjCardValue(c);
      if (c.rank === 'A') ++aces;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      --aces;
    }
    return total;
  }

  function bjIsBust(hand) {
    return bjHandValue(hand) > 21;
  }

  function bjHit() {
    if (state !== STATE_PLAYING || currentVariant?.id !== 'blackjack' || bjPlayerStood) return;
    const card = deck.pop();
    card.faceUp = true;
    bjPlayerHand.push(card);
    const px = 200 + (bjPlayerHand.length - 1) * 50;
    dealCardAnim(card, CANVAS_W / 2, -CARD_H, px, 400, 0);
    if (bjIsBust(bjPlayerHand)) {
      floatingText.add(CANVAS_W / 2, 350, 'BUST!', { color: '#f44', size: 28 });
      screenShake.trigger(8, 400);
      endBlackjackRound(false);
    }
  }

  function bjStand() {
    if (state !== STATE_PLAYING || currentVariant?.id !== 'blackjack' || bjPlayerStood) return;
    bjPlayerStood = true;
    // Reveal dealer's hidden card
    if (bjDealerHand.length > 0) {
      bjDealerHand[0].faceUp = true;
      flipCard(bjDealerHand[0], true);
    }
    bjDealerRevealed = true;
    // Dealer draws to 17
    bjDealerPlay();
  }

  function bjDealerPlay() {
    while (bjHandValue(bjDealerHand) < 17 && deck.length > 0) {
      const card = deck.pop();
      card.faceUp = true;
      bjDealerHand.push(card);
    }
    const playerVal = bjHandValue(bjPlayerHand);
    const dealerVal = bjHandValue(bjDealerHand);
    const dealerBust = dealerVal > 21;
    const playerWins = dealerBust || playerVal > dealerVal;
    const tie = !dealerBust && playerVal === dealerVal;
    if (playerWins) {
      floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
      endBlackjackRound(true);
    } else if (tie) {
      floatingText.add(CANVAS_W / 2, 300, 'PUSH', { color: '#ff8', size: 24 });
      state = STATE_ROUND_OVER;
    } else {
      floatingText.add(CANVAS_W / 2, 300, 'DEALER WINS', { color: '#f44', size: 24 });
      endBlackjackRound(false);
    }
  }

  function endBlackjackRound(won) {
    state = STATE_ROUND_OVER;
    if (won) {
      score += bjBet * 2;
      addGlow(180, 380, (bjPlayerHand.length * 50) + CARD_W, CARD_H, 2.0);
      triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      particles.confetti(CANVAS_W / 2, 300, 30);
    } else {
      score -= bjBet;
    }
    if (score <= 0) {
      state = STATE_GAME_OVER;
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    updateStatus();
    saveHighScores();
  }

  function setupBlackjack() {
    deck = shuffle(createStandardDeck());
    bjPlayerHand = [];
    bjDealerHand = [];
    bjDealerRevealed = false;
    bjPlayerStood = false;
    bjBet = 10;
    // Deal 2 cards each
    for (let i = 0; i < 2; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      bjPlayerHand.push(pc);
      dealCardAnim(pc, CANVAS_W / 2, -CARD_H, 200 + i * 50, 400, i * 0.15);

      const dc = deck.pop();
      dc.faceUp = i === 1; // first card face down
      bjDealerHand.push(dc);
      dealCardAnim(dc, CANVAS_W / 2, -CARD_H, 200 + i * 50, 100, (i + 2) * 0.15);
    }
  }

  function drawBlackjack() {
    // Dealer area
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Dealer' + (bjDealerRevealed ? ` (${bjHandValue(bjDealerHand)})` : ''), 200, 85);
    for (let i = 0; i < bjDealerHand.length; ++i) {
      const x = 200 + i * 50;
      if (bjDealerHand[i].faceUp)
        drawCardFace(x, 100, CARD_W, CARD_H, bjDealerHand[i]);
      else
        drawCardBack(x, 100, CARD_W, CARD_H);
    }
    // Player area
    ctx.fillText(`You (${bjHandValue(bjPlayerHand)})`, 200, 385);
    for (let i = 0; i < bjPlayerHand.length; ++i) {
      const x = 200 + i * 50;
      drawCardFace(x, 400, CARD_W, CARD_H, bjPlayerHand[i]);
    }
    // Actions hint
    if (state === STATE_PLAYING && !bjPlayerStood) {
      ctx.fillStyle = '#8f8';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[H] Hit   [S] Stand', CANVAS_W / 2, CANVAS_H - 30);
    }
    // Bet display
    ctx.fillStyle = '#fa0';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Bet: ${bjBet}`, CANVAS_W - 40, 120);
  }

  /* ══════════════════════════════════════════════════════════════════
     POKER RULES ENGINE
     ══════════════════════════════════════════════════════════════════ */

  function evaluatePokerHand(hand) {
    if (hand.length < 5) return { rank: 0, name: 'Incomplete' };

    const rankMap = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11 };
    const values = hand.map(c => rankMap[c.rank] || parseInt(c.rank, 10)).sort((a, b) => b - a);
    const suits = hand.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);
    const counts = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;
    const groups = Object.values(counts).sort((a, b) => b - a);

    // Check straight
    let isStraight = false;
    const unique = [...new Set(values)];
    if (unique.length >= 5 && unique[0] - unique[4] === 4) isStraight = true;
    // Ace-low straight
    if (unique.includes(14) && unique.includes(5) && unique.includes(4) && unique.includes(3) && unique.includes(2))
      isStraight = true;

    if (isFlush && isStraight && values[0] === 14)
      return { rank: 9, name: 'Royal Flush' };
    if (isFlush && isStraight)
      return { rank: 8, name: 'Straight Flush' };
    if (groups[0] === 4)
      return { rank: 7, name: 'Four of a Kind' };
    if (groups[0] === 3 && groups[1] === 2)
      return { rank: 6, name: 'Full House' };
    if (isFlush)
      return { rank: 5, name: 'Flush' };
    if (isStraight)
      return { rank: 4, name: 'Straight' };
    if (groups[0] === 3)
      return { rank: 3, name: 'Three of a Kind' };
    if (groups[0] === 2 && groups[1] === 2)
      return { rank: 2, name: 'Two Pair' };
    if (groups[0] === 2)
      return { rank: 1, name: 'Pair' };
    return { rank: 0, name: 'High Card' };
  }

  function setupPoker() {
    deck = shuffle(createStandardDeck());
    playerHand = [];
    aiHands = [[]];
    pokerBet = 10;
    pokerPot = 0;
    pokerPhase = 'deal';
    if (pokerChips <= 0) pokerChips = 100;

    // Deal 5 each
    for (let i = 0; i < 5; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      playerHand.push(pc);
      dealCardAnim(pc, CANVAS_W / 2, -CARD_H, 150 + i * (CARD_W + CARD_GAP), 420, i * 0.12);

      const ac = deck.pop();
      ac.faceUp = false;
      aiHands[0].push(ac);
      dealCardAnim(ac, CANVAS_W / 2, -CARD_H, 150 + i * (CARD_W + CARD_GAP), 80, (i + 5) * 0.12);
    }
    pokerPhase = 'bet';
  }

  function pokerBetAction(action) {
    if (state !== STATE_PLAYING || currentVariant?.id !== 'poker') return;
    if (action === 'fold') {
      floatingText.add(CANVAS_W / 2, 300, 'FOLDED', { color: '#f88', size: 20 });
      pokerChips -= pokerBet;
      endPokerRound(false);
      return;
    }
    if (action === 'bet' || action === 'call') {
      pokerPot += pokerBet * 2;
      pokerChips -= pokerBet;
      pokerPhase = 'showdown';
      // AI reveals
      for (const c of aiHands[0]) {
        c.faceUp = true;
        flipCard(c, true);
      }
      // Evaluate
      const playerEval = evaluatePokerHand(playerHand);
      const aiEval = evaluatePokerHand(aiHands[0]);
      const playerWins = playerEval.rank > aiEval.rank;
      const tie = playerEval.rank === aiEval.rank;
      if (playerWins) {
        floatingText.add(CANVAS_W / 2, 300, `${playerEval.name} WINS!`, { color: '#4f4', size: 24 });
        pokerChips += pokerPot;
        endPokerRound(true);
      } else if (tie) {
        floatingText.add(CANVAS_W / 2, 300, 'TIE', { color: '#ff8', size: 24 });
        pokerChips += pokerPot / 2;
        state = STATE_ROUND_OVER;
      } else {
        floatingText.add(CANVAS_W / 2, 300, `AI: ${aiEval.name}`, { color: '#f44', size: 24 });
        endPokerRound(false);
      }
      return;
    }
    if (action === 'raise') {
      pokerBet = Math.min(pokerBet * 2, pokerChips);
      floatingText.add(CANVAS_W / 2, 350, `RAISE to ${pokerBet}`, { color: '#fa0', size: 18 });
    }
  }

  function endPokerRound(won) {
    state = STATE_ROUND_OVER;
    score = pokerChips;
    if (won) {
      addGlow(130, 400, 5 * (CARD_W + CARD_GAP), CARD_H, 2.0);
      triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      particles.confetti(CANVAS_W / 2, 300, 30);
    }
    if (pokerChips <= 0) {
      state = STATE_GAME_OVER;
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    updateStatus();
    saveHighScores();
  }

  function drawPoker() {
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('AI Opponent', 150, 65);
    for (let i = 0; i < aiHands[0].length; ++i) {
      const x = 150 + i * (CARD_W + CARD_GAP);
      if (aiHands[0][i].faceUp)
        drawCardFace(x, 80, CARD_W, CARD_H, aiHands[0][i]);
      else
        drawCardBack(x, 80, CARD_W, CARD_H);
    }
    ctx.fillText('Your Hand', 150, 405);
    for (let i = 0; i < playerHand.length; ++i) {
      const x = 150 + i * (CARD_W + CARD_GAP);
      drawCardFace(x, 420, CARD_W, CARD_H, playerHand[i]);
    }
    // Pot and chips
    ctx.fillStyle = '#fa0';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Pot: ${pokerPot}  Chips: ${pokerChips}`, CANVAS_W / 2, 280);
    if (state === STATE_PLAYING && pokerPhase === 'bet') {
      ctx.fillStyle = '#8f8';
      ctx.font = '12px sans-serif';
      ctx.fillText('[B] Bet   [F] Fold   [C] Call   [R] Raise', CANVAS_W / 2, CANVAS_H - 30);
    }
    // Hand evaluation
    if (playerHand.length === 5) {
      const ev = evaluatePokerHand(playerHand);
      ctx.fillStyle = '#aaf';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(ev.name, 150, 540);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     UNO RULES ENGINE
     ══════════════════════════════════════════════════════════════════ */

  function canPlayUno(card, topCard) {
    if (card.type === 'wild') return true;
    if (!topCard) return true;
    return card.color === topCard.color || card.value === topCard.value;
  }

  function setupUno() {
    unoDeck = shuffle(createUnoDeck());
    unoHands = [[], [], []]; // player + 2 AI
    unoCurrentPlayer = 0;
    unoDirection = 1;
    // Deal 7 each
    for (let p = 0; p < 3; ++p)
      for (let i = 0; i < 7; ++i)
        unoHands[p].push(unoDeck.pop());
    unoTopCard = unoDeck.pop();
    while (unoTopCard.type === 'wild') {
      unoDeck.unshift(unoTopCard);
      unoTopCard = unoDeck.pop();
    }
    // Animate player cards
    for (let i = 0; i < unoHands[0].length; ++i) {
      dealCardAnim(unoHands[0][i], CANVAS_W / 2, -CARD_H,
        80 + i * 55, 440, i * 0.1);
    }
  }

  function unoPlayCard(playerIndex, cardIndex) {
    const hand = unoHands[playerIndex];
    if (cardIndex < 0 || cardIndex >= hand.length) return false;
    const card = hand[cardIndex];
    if (!canPlayUno(card, unoTopCard)) return false;
    hand.splice(cardIndex, 1);
    unoTopCard = card;
    if (card.type === 'wild') card.color = unoColors[(Math.random() * 4) | 0];
    // Handle action cards
    if (card.value === 'Skip')
      unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
    else if (card.value === 'Reverse')
      unoDirection = -unoDirection;
    else if (card.value === 'Draw Two') {
      const next = (unoCurrentPlayer + unoDirection + 3) % 3;
      for (let i = 0; i < 2 && unoDeck.length > 0; ++i)
        unoHands[next].push(unoDeck.pop());
    } else if (card.value === 'Wild Draw Four') {
      const next = (unoCurrentPlayer + unoDirection + 3) % 3;
      for (let i = 0; i < 4 && unoDeck.length > 0; ++i)
        unoHands[next].push(unoDeck.pop());
    }
    // Check win
    if (hand.length === 0) {
      floatingText.add(CANVAS_W / 2, 300,
        playerIndex === 0 ? 'YOU WIN!' : `AI ${playerIndex} WINS`,
        { color: playerIndex === 0 ? '#4f4' : '#f44', size: 28 });
      if (playerIndex === 0) {
        score += 50;
        addGlow(60, 420, unoHands[0].length * 55 + CARD_W, CARD_H, 2);
        triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
      state = STATE_ROUND_OVER;
      updateStatus();
      saveHighScores();
      return true;
    }
    unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
    return true;
  }

  function unoAiTurn() {
    if (state !== STATE_PLAYING) return;
    const hand = unoHands[unoCurrentPlayer];
    // Find valid card
    for (let i = 0; i < hand.length; ++i) {
      if (canPlayUno(hand[i], unoTopCard)) {
        unoPlayCard(unoCurrentPlayer, i);
        return;
      }
    }
    // Draw card if no valid play
    if (unoDeck.length > 0) {
      hand.push(unoDeck.pop());
      // Reshuffle discard if deck empty
    } else {
      // Pass — reshuffle
      discardPile = [];
    }
    unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
  }

  function drawUno() {
    // Top card (center)
    if (unoTopCard)
      drawUnoCard(CANVAS_W / 2 - CARD_W / 2, 240, CARD_W, CARD_H, unoTopCard);
    // Draw pile
    drawCardBack(CANVAS_W / 2 - CARD_W - 20, 240, CARD_W, CARD_H);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${unoDeck.length}`, CANVAS_W / 2 - CARD_W / 2 - 20, 350);
    // Player hand
    for (let i = 0; i < unoHands[0].length; ++i) {
      const x = 80 + i * 55;
      drawUnoCard(x, 440, CARD_W, CARD_H, unoHands[0][i]);
    }
    // AI hands (backs)
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    for (let p = 1; p < unoHands.length; ++p) {
      const y = 20 + (p - 1) * 120;
      ctx.textAlign = 'left';
      ctx.fillText(`AI ${p} (${unoHands[p].length} cards)`, 60, y + CARD_H + 15);
      for (let i = 0; i < Math.min(unoHands[p].length, 7); ++i)
        drawCardBack(60 + i * 20, y, CARD_W * 0.6, CARD_H * 0.6);
    }
    // Turn indicator
    if (state === STATE_PLAYING && unoCurrentPlayer === 0) {
      ctx.fillStyle = '#8f8';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Your turn — click a card to play, or click deck to draw', CANVAS_W / 2, CANVAS_H - 15);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SKIPBO RULES ENGINE
     ══════════════════════════════════════════════════════════════════ */

  function setupSkipBo() {
    const d = shuffle(createSkipBoDeck());
    skipBoStockPiles = [[], []]; // player + AI
    skipBoBuildPiles = [[], [], [], []];
    skipBoDiscardPiles = [[], [], [], []]; // player's 4 discard
    playerHand = [];
    aiHands = [[]];
    // Deal stock (20 each)
    for (let i = 0; i < 20; ++i) {
      skipBoStockPiles[0].push(d.pop());
      skipBoStockPiles[1].push(d.pop());
    }
    deck = d;
    // Draw 5
    for (let i = 0; i < 5 && deck.length > 0; ++i) {
      playerHand.push(deck.pop());
      dealCardAnim(playerHand[i], CANVAS_W / 2, -CARD_H, 120 + i * 60, 440, i * 0.1);
    }
    for (let i = 0; i < 5 && deck.length > 0; ++i)
      aiHands[0].push(deck.pop());
  }

  function canPlaySkipBo(card, buildPile) {
    const topVal = buildPile.length === 0 ? 0 : buildPile[buildPile.length - 1].value;
    const needed = topVal + 1;
    if (needed > 12) return false;
    return card.type === 'skipbo' || card.value === needed;
  }

  function skipBoAiTurn() {
    if (state !== STATE_PLAYING) return;
    // Simple AI: try to play from stock, then hand
    const stock = skipBoStockPiles[1];
    if (stock.length > 0) {
      for (let b = 0; b < 4; ++b) {
        if (canPlaySkipBo(stock[stock.length - 1], skipBoBuildPiles[b])) {
          skipBoBuildPiles[b].push(stock.pop());
          if (stock.length === 0) {
            floatingText.add(CANVAS_W / 2, 300, 'AI WINS!', { color: '#f44', size: 28 });
            state = STATE_ROUND_OVER;
          }
          return;
        }
      }
    }
    for (let i = aiHands[0].length - 1; i >= 0; --i) {
      for (let b = 0; b < 4; ++b) {
        if (canPlaySkipBo(aiHands[0][i], skipBoBuildPiles[b])) {
          skipBoBuildPiles[b].push(aiHands[0].splice(i, 1)[0]);
          return;
        }
      }
    }
    // Discard last card
    if (aiHands[0].length > 0) aiHands[0].pop();
    // Draw new hand
    while (aiHands[0].length < 5 && deck.length > 0) aiHands[0].push(deck.pop());
  }

  function drawSkipBo() {
    // Build piles (center)
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Build Piles', CANVAS_W / 2, 225);
    for (let b = 0; b < 4; ++b) {
      const x = 250 + b * 80;
      if (skipBoBuildPiles[b].length > 0)
        drawSkipBoCard(x, 240, CARD_W, CARD_H, skipBoBuildPiles[b][skipBoBuildPiles[b].length - 1]);
      else {
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        roundRect(x, 240, CARD_W, CARD_H, CARD_RADIUS);
        ctx.stroke();
        ctx.fillStyle = '#555';
        ctx.fillText(String(skipBoBuildPiles[b].length === 0 ? '1' : ''), x + CARD_W / 2, 290);
      }
    }
    // Player hand
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Your Hand (Stock: ${skipBoStockPiles[0].length})`, 120, 425);
    for (let i = 0; i < playerHand.length; ++i) {
      const x = 120 + i * 60;
      drawSkipBoCard(x, 440, CARD_W, CARD_H, playerHand[i]);
    }
    // AI info
    ctx.fillText(`AI (Stock: ${skipBoStockPiles[1].length})`, 120, 65);
    for (let i = 0; i < Math.min(aiHands[0].length, 5); ++i)
      drawCardBack(120 + i * 40, 80, CARD_W * 0.7, CARD_H * 0.7);
  }

  /* ══════════════════════════════════════════════════════════════════
     SKAT RULES ENGINE (simplified)
     ══════════════════════════════════════════════════════════════════ */

  function setupSkat() {
    // Skat uses 32-card deck (7-A)
    const skatRanks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const d = [];
    for (const suit of SUITS)
      for (const rank of skatRanks)
        d.push({ suit, rank, faceUp: false });
    shuffle(d);
    skatHandCards = [[], [], []]; // player + 2 AI
    trickCards = [];
    trumpSuit = '♠';
    // Deal 10 each, 2 to skat
    for (let i = 0; i < 10; ++i) {
      for (let p = 0; p < 3; ++p)
        skatHandCards[p].push(d.pop());
    }
    for (const c of skatHandCards[0]) c.faceUp = true;
    discardPile = [d.pop(), d.pop()]; // skat
    deck = d;
    // Animate player cards
    for (let i = 0; i < skatHandCards[0].length; ++i)
      dealCardAnim(skatHandCards[0][i], CANVAS_W / 2, -CARD_H, 60 + i * 60, 440, i * 0.08);
  }

  function skatIsValid(card, leadSuit, hand) {
    if (!leadSuit) return true;
    const hasSuit = hand.some(c => c.suit === leadSuit);
    if (!hasSuit) return true;
    return card.suit === leadSuit;
  }

  function skatAiPlay(playerIdx) {
    const hand = skatHandCards[playerIdx];
    if (hand.length === 0) return;
    const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
    for (let i = 0; i < hand.length; ++i) {
      if (skatIsValid(hand[i], leadSuit, hand)) {
        const card = hand.splice(i, 1)[0];
        card.faceUp = true;
        trickCards.push(card);
        return;
      }
    }
  }

  function drawSkat() {
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Skat — Trump: ${trumpSuit}`, 60, 225);
    // Trick area
    for (let i = 0; i < trickCards.length; ++i) {
      const x = 350 + i * 60;
      drawCardFace(x, 240, CARD_W, CARD_H, trickCards[i]);
    }
    // Player hand
    ctx.fillText('Your Hand', 60, 425);
    for (let i = 0; i < skatHandCards[0].length; ++i) {
      const x = 60 + i * 60;
      drawCardFace(x, 440, CARD_W, CARD_H, skatHandCards[0][i]);
    }
    // AI hands
    for (let p = 1; p < 3; ++p) {
      const y = 20 + (p - 1) * 100;
      ctx.fillStyle = '#aaa';
      ctx.font = '12px sans-serif';
      ctx.fillText(`AI ${p} (${skatHandCards[p].length})`, 60, y + 70);
      for (let i = 0; i < Math.min(skatHandCards[p].length, 10); ++i)
        drawCardBack(60 + i * 25, y, CARD_W * 0.55, CARD_H * 0.55);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CANASTA RULES ENGINE (simplified)
     ══════════════════════════════════════════════════════════════════ */

  function setupCanasta() {
    // Double deck
    deck = shuffle([...createStandardDeck(), ...createStandardDeck()]);
    playerHand = [];
    aiHands = [[]];
    canastaMelds = [];
    canastaWilds = 0;
    discardPile = [];
    // Deal 11 each
    for (let i = 0; i < 11; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      playerHand.push(pc);
      dealCardAnim(pc, CANVAS_W / 2, -CARD_H, 40 + i * 55, 440, i * 0.08);
      const ac = deck.pop();
      aiHands[0].push(ac);
    }
    // Start discard
    const top = deck.pop();
    top.faceUp = true;
    discardPile.push(top);
  }

  function canastaCanMeld(hand) {
    const counts = {};
    for (const c of hand) {
      const k = c.rank;
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).some(([, v]) => v >= 3);
  }

  function drawCanasta() {
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Canasta', 40, 225);
    // Discard top
    if (discardPile.length > 0)
      drawCardFace(CANVAS_W / 2 + 40, 240, CARD_W, CARD_H, discardPile[discardPile.length - 1]);
    drawCardBack(CANVAS_W / 2 - CARD_W - 20, 240, CARD_W, CARD_H);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${deck.length}`, CANVAS_W / 2 - CARD_W / 2 - 20, 350);
    // Player hand
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Your Hand', 40, 425);
    for (let i = 0; i < playerHand.length; ++i) {
      const x = 40 + i * 50;
      drawCardFace(x, 440, CARD_W * 0.85, CARD_H * 0.85, playerHand[i]);
    }
    // AI hand
    ctx.fillText(`AI (${aiHands[0].length} cards)`, 40, 65);
    for (let i = 0; i < Math.min(aiHands[0].length, 11); ++i)
      drawCardBack(40 + i * 22, 80, CARD_W * 0.6, CARD_H * 0.6);
    // Melds
    ctx.fillText(`Melds: ${canastaMelds.length}`, CANVAS_W - 150, 440);
  }

  /* ══════════════════════════════════════════════════════════════════
     DOPPELKOPF RULES ENGINE (simplified)
     ══════════════════════════════════════════════════════════════════ */

  function setupDoppelkopf() {
    // Double deck of 24 cards (9-A)
    const dkRanks = ['9', '10', 'J', 'Q', 'K', 'A'];
    const d = [];
    for (let copy = 0; copy < 2; ++copy)
      for (const suit of SUITS)
        for (const rank of dkRanks)
          d.push({ suit, rank, faceUp: false });
    shuffle(d);
    skatHandCards = [[], [], [], []]; // 4 players
    doppelkopfTeams = [0, 0, 0, 0]; // determined by Queens of Clubs
    trickCards = [];
    // Deal 12 each
    for (let i = 0; i < 12; ++i)
      for (let p = 0; p < 4; ++p)
        skatHandCards[p].push(d.pop());
    for (const c of skatHandCards[0]) c.faceUp = true;
    deck = d;
    // Teams based on Queen of Clubs
    for (let p = 0; p < 4; ++p)
      doppelkopfTeams[p] = skatHandCards[p].some(c => c.rank === 'Q' && c.suit === '♣') ? 1 : 0;
    // Animate
    for (let i = 0; i < skatHandCards[0].length; ++i)
      dealCardAnim(skatHandCards[0][i], CANVAS_W / 2, -CARD_H, 30 + i * 55, 440, i * 0.06);
  }

  function drawDoppelkopf() {
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Doppelkopf', 30, 225);
    // Trick
    for (let i = 0; i < trickCards.length; ++i) {
      const x = 320 + i * 60;
      drawCardFace(x, 240, CARD_W, CARD_H, trickCards[i]);
    }
    // Player hand
    ctx.fillText('Your Hand', 30, 425);
    for (let i = 0; i < skatHandCards[0].length; ++i) {
      const x = 30 + i * 55;
      drawCardFace(x, 440, CARD_W * 0.9, CARD_H * 0.9, skatHandCards[0][i]);
    }
    // AI hands
    for (let p = 1; p < 4; ++p) {
      const y = 10 + (p - 1) * 70;
      ctx.fillStyle = '#aaa';
      ctx.font = '11px sans-serif';
      ctx.fillText(`AI ${p} (${skatHandCards[p].length})`, 30, y + 55);
      for (let i = 0; i < Math.min(skatHandCards[p].length, 12); ++i)
        drawCardBack(30 + i * 18, y, CARD_W * 0.45, CARD_H * 0.45);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     VARIANT SELECTION & SETUP
     ══════════════════════════════════════════════════════════════════ */

  function selectGame(variantId) {
    currentVariant = VARIANTS.find(v => v.id === variantId) || VARIANTS[0];
    state = STATE_PLAYING;
    roundNumber = 1;
    dealAnimations = [];
    flipAnimations = [];
    glowCards = [];

    switch (currentVariant.id) {
      case 'blackjack': setupBlackjack(); break;
      case 'poker':     setupPoker();     break;
      case 'uno':       setupUno();       break;
      case 'skipbo':    setupSkipBo();    break;
      case 'skat':      setupSkat();      break;
      case 'canasta':   setupCanasta();   break;
      case 'doppelkopf': setupDoppelkopf(); break;
    }
    updateWindowTitle();
    updateStatus();
  }

  function initGame() {
    score = 100;
    pokerChips = 100;
    state = STATE_MENU;
    currentVariant = null;
    updateWindowTitle();
    updateStatus();
  }

  /* ══════════════════════════════════════════════════════════════════
     AI TICK (for turn-based AI)
     ══════════════════════════════════════════════════════════════════ */

  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  function tickAi(dt) {
    if (state !== STATE_PLAYING) return;

    if (currentVariant?.id === 'uno' && unoCurrentPlayer !== 0) {
      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        unoAiTurn();
      }
    }

    if (currentVariant?.id === 'skipbo') {
      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY * 2) {
        aiTurnTimer = 0;
        skipBoAiTurn();
      }
    }

    if (currentVariant?.id === 'skat' || currentVariant?.id === 'doppelkopf') {
      // Auto-play AI turns in trick-taking games
      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        const totalPlayers = currentVariant.id === 'doppelkopf' ? 4 : 3;
        const currentTrickPlayer = trickCards.length % totalPlayers;
        if (currentTrickPlayer !== 0 && trickCards.length < totalPlayers) {
          skatAiPlay(currentTrickPlayer);
        } else if (trickCards.length >= totalPlayers) {
          // Resolve trick
          score += 10;
          floatingText.add(CANVAS_W / 2, 300, '+10', { color: '#4f4', size: 18 });
          trickCards = [];
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  function handleCanvasClick(mx, my) {
    if (state === STATE_MENU) {
      // Check variant buttons
      for (let i = 0; i < VARIANTS.length; ++i) {
        const bx = CANVAS_W / 2 - 120;
        const by = 120 + i * 58;
        if (mx >= bx && mx <= bx + 240 && my >= by && my <= by + 48) {
          selectGame(VARIANTS[i].id);
          return;
        }
      }
      return;
    }

    if (state === STATE_ROUND_OVER || state === STATE_GAME_OVER) {
      if (state === STATE_GAME_OVER) {
        initGame();
      } else {
        ++roundNumber;
        selectGame(currentVariant.id);
      }
      return;
    }

    if (state !== STATE_PLAYING) return;

    // Variant-specific click
    switch (currentVariant?.id) {
      case 'uno': {
        // Check player hand cards
        for (let i = unoHands[0].length - 1; i >= 0; --i) {
          const cx = 80 + i * 55;
          if (mx >= cx && mx <= cx + CARD_W && my >= 440 && my <= 440 + CARD_H) {
            if (unoCurrentPlayer === 0) {
              if (!unoPlayCard(0, i))
                floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
            }
            return;
          }
        }
        // Draw from deck
        if (mx >= CANVAS_W / 2 - CARD_W - 20 && mx <= CANVAS_W / 2 - 20 &&
            my >= 240 && my <= 240 + CARD_H && unoCurrentPlayer === 0) {
          if (unoDeck.length > 0) {
            unoHands[0].push(unoDeck.pop());
            unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
          }
        }
        break;
      }
      case 'skipbo': {
        // Try playing from hand to build piles
        for (let i = playerHand.length - 1; i >= 0; --i) {
          const cx = 120 + i * 60;
          if (mx >= cx && mx <= cx + CARD_W && my >= 440 && my <= 440 + CARD_H) {
            for (let b = 0; b < 4; ++b) {
              if (canPlaySkipBo(playerHand[i], skipBoBuildPiles[b])) {
                skipBoBuildPiles[b].push(playerHand.splice(i, 1)[0]);
                // Check build pile reset at 12
                if (skipBoBuildPiles[b].length >= 12) skipBoBuildPiles[b] = [];
                break;
              }
            }
            return;
          }
        }
        // Stock pile play
        if (skipBoStockPiles[0].length > 0 &&
            mx >= 30 && mx <= 30 + CARD_W && my >= 440 && my <= 440 + CARD_H) {
          const topStock = skipBoStockPiles[0][skipBoStockPiles[0].length - 1];
          for (let b = 0; b < 4; ++b) {
            if (canPlaySkipBo(topStock, skipBoBuildPiles[b])) {
              skipBoBuildPiles[b].push(skipBoStockPiles[0].pop());
              if (skipBoStockPiles[0].length === 0) {
                floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
                score += 100;
                addGlow(100, 420, 400, CARD_H, 2);
                triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
                state = STATE_ROUND_OVER;
                saveHighScores();
              }
              return;
            }
          }
        }
        break;
      }
      case 'skat':
      case 'doppelkopf': {
        const hand = skatHandCards[0];
        for (let i = hand.length - 1; i >= 0; --i) {
          const cx = (currentVariant.id === 'doppelkopf' ? 30 : 60) + i * (currentVariant.id === 'doppelkopf' ? 55 : 60);
          const cw = currentVariant.id === 'doppelkopf' ? CARD_W * 0.9 : CARD_W;
          if (mx >= cx && mx <= cx + cw && my >= 440 && my <= 440 + CARD_H) {
            const totalPlayers = currentVariant.id === 'doppelkopf' ? 4 : 3;
            if (trickCards.length % totalPlayers === 0 || trickCards.length < totalPlayers) {
              const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
              if (skatIsValid(hand[i], leadSuit, hand)) {
                const card = hand.splice(i, 1)[0];
                card.faceUp = true;
                trickCards.push(card);
              } else {
                floatingText.add(mx, my - 20, 'Invalid!', { color: '#f88', size: 14 });
              }
            }
            return;
          }
        }
        break;
      }
      case 'canasta': {
        // Draw from deck
        if (mx >= CANVAS_W / 2 - CARD_W - 20 && mx <= CANVAS_W / 2 - 20 &&
            my >= 240 && my <= 240 + CARD_H && deck.length > 0) {
          const c = deck.pop();
          c.faceUp = true;
          playerHand.push(c);
          return;
        }
        // Try to meld
        if (canastaCanMeld(playerHand)) {
          // Auto-meld first group of 3+
          const counts = {};
          for (const c of playerHand) {
            const k = c.rank;
            if (!counts[k]) counts[k] = [];
            counts[k].push(c);
          }
          for (const [rank, cards] of Object.entries(counts)) {
            if (cards.length >= 3) {
              canastaMelds.push({ rank, count: cards.length });
              for (const c of cards)
                playerHand.splice(playerHand.indexOf(c), 1);
              score += cards.length * 10;
              floatingText.add(CANVAS_W / 2, 350, `Meld: ${cards.length}×${rank}`, { color: '#4f4', size: 18 });
              if (cards.length >= 7) {
                addGlow(40, 420, playerHand.length * 50 + CARD_W, CARD_H, 2);
                triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
              }
              break;
            }
          }
          if (playerHand.length === 0) {
            floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
            state = STATE_ROUND_OVER;
            saveHighScores();
          }
        }
        break;
      }
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    handleCanvasClick(mx, my);
  });

  /* ══════════════════════════════════════════════════════════════════
     KEYBOARD HANDLING
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      if (currentVariant)
        selectGame(currentVariant.id);
      else
        initGame();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING) {
        state = STATE_PAUSED;
        updateWindowTitle();
      } else if (state === STATE_PAUSED) {
        state = STATE_PLAYING;
        updateWindowTitle();
      }
      return;
    }

    if (state !== STATE_PLAYING) return;

    // Blackjack keys
    if (currentVariant?.id === 'blackjack') {
      if (e.key === 'h' || e.key === 'H') bjHit();
      if (e.key === 's' || e.key === 'S') bjStand();
    }

    // Poker keys
    if (currentVariant?.id === 'poker') {
      if (e.key === 'b' || e.key === 'B') pokerBetAction('bet');
      if (e.key === 'f' || e.key === 'F') pokerBetAction('fold');
      if (e.key === 'c' || e.key === 'C') pokerBetAction('call');
      if (e.key === 'r' || e.key === 'R') pokerBetAction('raise');
    }

    // Number keys 1-7: play card from hand
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 7) {
      const idx = num - 1;
      if (currentVariant?.id === 'uno' && unoCurrentPlayer === 0 && idx < unoHands[0].length)
        unoPlayCard(0, idx);
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawMenu() {
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Card Games Suite', CANVAS_W / 2, 60);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Choose a game to play', CANVAS_W / 2, 90);

    // Variant buttons
    for (let i = 0; i < VARIANTS.length; ++i) {
      const bx = CANVAS_W / 2 - 120;
      const by = 120 + i * 58;
      // Button background
      ctx.fillStyle = '#1a3a1a';
      ctx.strokeStyle = '#4a4';
      ctx.lineWidth = 2;
      roundRect(bx, by, 240, 48, 8);
      ctx.fill();
      ctx.stroke();
      // Button text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(VARIANTS[i].name, CANVAS_W / 2, by + 20);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#8a8';
      ctx.fillText(VARIANTS[i].desc, CANVAS_W / 2, by + 38);
    }
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press Escape to resume', CANVAS_W / 2, CANVAS_H / 2 + 20);
  }

  function drawGameOverOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    const msg = state === STATE_GAME_OVER ? 'GAME OVER' : 'ROUND COMPLETE';
    ctx.fillText(msg, CANVAS_W / 2, CANVAS_H / 2 - 20);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#fa0';
    ctx.fillText(`Score: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 10);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 40);
  }

  function drawTable() {
    // Green felt background
    const grad = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 50, CANVAS_W / 2, CANVAS_H / 2, 500);
    grad.addColorStop(0, '#1a4a1a');
    grad.addColorStop(1, '#0a2a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (state === STATE_MENU) {
      drawTable();
      drawMenu();
    } else {
      screenShake.apply(ctx);
      drawTable();

      switch (currentVariant?.id) {
        case 'blackjack': drawBlackjack(); break;
        case 'poker':     drawPoker();     break;
        case 'uno':       drawUno();       break;
        case 'skipbo':    drawSkipBo();    break;
        case 'skat':      drawSkat();      break;
        case 'canasta':   drawCanasta();   break;
        case 'doppelkopf': drawDoppelkopf(); break;
      }

      drawDealAnimations();
      drawGlowEffects();
      particles.draw(ctx);
      floatingText.draw(ctx);

      if (state === STATE_PAUSED) drawPauseOverlay();
      if (state === STATE_ROUND_OVER || state === STATE_GAME_OVER) drawGameOverOverlay();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    if (state === STATE_PLAYING || state === STATE_ROUND_OVER) {
      updateAnimations(dt);
      tickAi(dt);
    }

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS & PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function updateStatus() {
    const variantEl = document.getElementById('statusVariant');
    const scoreEl = document.getElementById('statusScore');
    const roundEl = document.getElementById('statusRound');
    if (variantEl) variantEl.textContent = `Game: ${currentVariant?.name || '--'}`;
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (roundEl) roundEl.textContent = `Round: ${roundNumber || '--'}`;
  }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHighScores() {
    try {
      const scores = loadHighScores();
      scores.push({
        variant: currentVariant?.name || 'Unknown',
        score,
        date: Date.now()
      });
      scores.sort((a, b) => b.score - a.score);
      while (scores.length > MAX_HIGH_SCORES) scores.pop();
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(scores));
    } catch { /* file:// may block */ }
  }

  function showHighScores() {
    const scores = loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    if (tbody) {
      tbody.innerHTML = scores.map((s, i) =>
        `<tr><td>${i + 1}</td><td>${s.variant}</td><td>${s.score}</td></tr>`
      ).join('');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU BAR ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        if (currentVariant)
          selectGame(currentVariant.id);
        else
          initGame();
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
        updateWindowTitle();
        break;
      case 'high-scores':
        showHighScores();
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const variant = currentVariant?.name || 'Card Games Suite';
    const suffix = state === STATE_PAUSED ? ' — Paused'
      : state === STATE_GAME_OVER ? ' — Game Over'
      : state === STATE_ROUND_OVER ? ' — Round Over'
      : '';
    const title = `${variant}${suffix}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }

  window.addEventListener('resize', handleResize);

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menuBar = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  initGame();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
