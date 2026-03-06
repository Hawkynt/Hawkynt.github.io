;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* -- Constants -- */
  const SKAT_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const RANK_VALUES = { '7': 0, '8': 0, '9': 0, '10': 10, 'J': 2, 'Q': 3, 'K': 4, 'A': 11 };
  const BID_VALUES = [18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 46, 48, 50, 54, 59, 60];
  const PHASE_BIDDING = 0;
  const PHASE_SKAT_PICK = 1;
  const PHASE_TRUMP_PICK = 2;
  const PHASE_PLAYING = 3;

  /* -- Game state -- */
  let skatHands = [[], [], []];
  let skatPile = [];
  let trickCards = [];
  let trickPlayers = [];
  let trumpSuit = 'spades';
  let deck = [];
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let declarer = -1;
  let currentTrickLead = 0;
  let currentTurn = 0;
  let tricksWon = [0, 0, 0];
  let cardPoints = [0, 0, 0];
  let trickCount = 0;

  /* -- Bidding state -- */
  let phase = PHASE_BIDDING;
  let bidCurrent = 0;
  let bidActive = [true, true, true];
  let bidWinner = -1;
  let bidAmount = 0;
  let bidPhaseStep = 0;
  let bidMessage = '';

  /* -- Host references -- */
  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.6;

  /* ================================================================
     SKAT RULES
     ================================================================ */

  function isTrump(card) {
    return card.rank === 'J' || card.suit === trumpSuit;
  }

  function effectiveSuit(card) {
    return card.rank === 'J' ? 'trump' : (card.suit === trumpSuit ? 'trump' : card.suit);
  }

  function skatIsValid(card, leadSuit, hand) {
    if (!leadSuit) return true;
    const efl = leadSuit;
    const hasSuit = hand.some(c => effectiveSuit(c) === efl);
    if (!hasSuit) return true;
    return effectiveSuit(card) === efl;
  }

  function cardStrength(card) {
    if (card.rank === 'J') {
      const jOrder = ['diamonds', 'hearts', 'spades', 'clubs'];
      return 100 + jOrder.indexOf(card.suit);
    }
    if (card.suit === trumpSuit)
      return 50 + SKAT_RANKS.indexOf(card.rank);
    return SKAT_RANKS.indexOf(card.rank);
  }

  function trickWinner(cards, players) {
    const leadEff = effectiveSuit(cards[0]);
    let best = 0;
    for (let i = 1; i < cards.length; ++i) {
      const eff = effectiveSuit(cards[i]);
      if (eff === 'trump' && effectiveSuit(cards[best]) !== 'trump')
        best = i;
      else if (eff === effectiveSuit(cards[best]) && cardStrength(cards[i]) > cardStrength(cards[best]))
        best = i;
    }
    return players[best];
  }

  function aiEvalHand(hand) {
    let val = 0;
    for (const c of hand) {
      val += RANK_VALUES[c.rank];
      if (c.rank === 'J') val += 5;
    }
    return val;
  }

  function skatAiPlay(playerIdx) {
    const hand = skatHands[playerIdx];
    if (hand.length === 0) return;
    const leadSuit = trickCards.length > 0 ? effectiveSuit(trickCards[0]) : null;
    const valid = [];
    for (let i = 0; i < hand.length; ++i) {
      if (skatIsValid(hand[i], leadSuit, hand))
        valid.push(i);
    }
    if (valid.length === 0) return;
    // Simple AI: play lowest valid card
    valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
    const idx = valid[0];
    const card = hand.splice(idx, 1)[0];
    card.faceUp = true;
    trickCards.push(card);
    trickPlayers.push(playerIdx);
  }

  /* ================================================================
     BIDDING
     ================================================================ */

  function runBiddingStep() {
    // Simplified: AI bids based on hand strength
    if (bidPhaseStep === 0) {
      bidMessage = 'Bidding...';
      const vals = [aiEvalHand(skatHands[0]), aiEvalHand(skatHands[1]), aiEvalHand(skatHands[2])];
      // AI decides to bid or pass
      const thresholds = [40, 30, 35];
      for (let p = 1; p < 3; ++p) {
        if (vals[p] < thresholds[p])
          bidActive[p] = false;
      }
      bidPhaseStep = 1;
      return;
    }

    if (bidPhaseStep === 1) {
      // Player must decide - show bid buttons
      // Wait for player click
      return;
    }

    if (bidPhaseStep >= 2) {
      // Resolve: highest remaining bidder wins
      const remaining = [];
      for (let p = 0; p < 3; ++p) {
        if (bidActive[p]) remaining.push(p);
      }
      if (remaining.length === 0) {
        // Everyone passed - player 0 forced as declarer at minimum
        declarer = 0;
      } else if (remaining.length === 1)
        declarer = remaining[0];
      else
        declarer = remaining[0]; // Simplified

      bidAmount = BID_VALUES[Math.min(bidCurrent, BID_VALUES.length - 1)];
      bidMessage = (declarer === 0 ? 'You are' : 'AI ' + declarer + ' is') + ' the Declarer!';

      if (declarer === 0) {
        phase = PHASE_SKAT_PICK;
      } else {
        // AI picks trump based on most suits
        const counts = {};
        for (const s of CE.SUITS) counts[s] = 0;
        for (const c of skatHands[declarer])
          if (c.rank !== 'J') ++counts[c.suit];
        let best = CE.SUITS[0];
        for (const s of CE.SUITS)
          if (counts[s] > counts[best]) best = s;
        trumpSuit = best;
        phase = PHASE_PLAYING;
        currentTrickLead = declarer;
        currentTurn = declarer;
      }
    }
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupSkat() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, SKAT_RANKS));
    skatHands = [[], [], []];
    trickCards = [];
    trickPlayers = [];
    skatPile = [];
    trumpSuit = 'spades';
    roundOver = false;
    gameOver = false;
    declarer = -1;
    currentTrickLead = 0;
    currentTurn = 0;
    tricksWon = [0, 0, 0];
    cardPoints = [0, 0, 0];
    trickCount = 0;
    phase = PHASE_BIDDING;
    bidCurrent = 0;
    bidActive = [true, true, true];
    bidWinner = -1;
    bidAmount = 0;
    bidPhaseStep = 0;
    bidMessage = '';
    aiTurnTimer = 0;

    // Deal: 3-skat(2)-4-3 pattern
    for (let p = 0; p < 3; ++p)
      for (let i = 0; i < 3; ++i) skatHands[p].push(d.pop());
    skatPile = [d.pop(), d.pop()];
    for (let p = 0; p < 3; ++p)
      for (let i = 0; i < 4; ++i) skatHands[p].push(d.pop());
    for (let p = 0; p < 3; ++p)
      for (let i = 0; i < 3; ++i) skatHands[p].push(d.pop());

    for (const c of skatHands[0]) c.faceUp = true;
    deck = d;

    if (_host) {
      for (let i = 0; i < skatHands[0].length; ++i)
        _host.dealCardAnim(skatHands[0][i], CANVAS_W / 2, -CE.CARD_H, 60 + i * 60, 440, i * 0.08);
    }
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  const BID_BTN = { x: 350, y: 300, w: 80, h: 32 };
  const PASS_BTN = { x: 450, y: 300, w: 80, h: 32 };
  const SKAT_BTN = { x: 350, y: 360, w: 180, h: 32 };
  const trumpBtns = [];

  function drawSkat() {
    // Header
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';

    if (phase === PHASE_PLAYING || phase === PHASE_SKAT_PICK || phase === PHASE_TRUMP_PICK)
      _ctx.fillText('Skat \u2014 Trump: ' + SUIT_NAMES[trumpSuit], 60, 225);

    // Trick area
    for (let i = 0; i < trickCards.length; ++i) {
      const x = 350 + i * 80;
      CE.drawCardFace(_ctx, x, 240, trickCards[i]);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(trickPlayers[i] === 0 ? 'You' : 'AI ' + trickPlayers[i], x + CE.CARD_W / 2, 240 + CE.CARD_H + 14);
    }

    // Player hand
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    const youRole = declarer === 0 ? ' (Declarer)' : declarer >= 0 ? ' (Defender)' : '';
    _ctx.fillText('Your Hand' + youRole, 60, 425);
    for (let i = 0; i < skatHands[0].length; ++i) {
      if (skatHands[0][i]._dealing) continue;
      const x = 60 + i * 60;
      CE.drawCardFace(_ctx, x, 440, skatHands[0][i]);

      if (_host && _host.hintsEnabled && phase === PHASE_PLAYING && currentTurn === 0 && trickCards.length < 3) {
        const leadSuit = trickCards.length > 0 ? effectiveSuit(trickCards[0]) : null;
        if (skatIsValid(skatHands[0][i], leadSuit, skatHands[0]))
          CE.drawHintGlow(_ctx, x, 440, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }
    }

    // AI hands with role labels
    for (let p = 1; p < 3; ++p) {
      const y = 20 + (p - 1) * 100;
      const isDecl = p === declarer;
      _ctx.fillStyle = isDecl ? '#ff0' : '#aaa';
      _ctx.font = isDecl ? 'bold 12px sans-serif' : '12px sans-serif';
      _ctx.textAlign = 'left';
      const role = declarer < 0 ? '' : isDecl ? ' \u2014 Declarer' : ' \u2014 Defender';
      _ctx.fillText('AI ' + p + role + ' (' + skatHands[p].length + ' cards)', 60, y + 70);
      for (let i = 0; i < Math.min(skatHands[p].length, 10); ++i)
        CE.drawCardBack(_ctx, 60 + i * 25, y, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Tricks won
    if (phase === PHASE_PLAYING) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'right';
      _ctx.fillText('Tricks: ' + tricksWon[0] + ' | Points: ' + cardPoints[0], CANVAS_W - 20, 425);
    }

    // Phase-specific UI
    if (phase === PHASE_BIDDING)
      drawBiddingUI();
    else if (phase === PHASE_SKAT_PICK)
      drawSkatPickUI();
    else if (phase === PHASE_TRUMP_PICK)
      drawTrumpPickUI();
    else if (phase === PHASE_PLAYING && currentTurn === 0 && trickCards.length < 3 && !roundOver) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 15);
    }
  }

  function drawBiddingUI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Bidding Phase', CANVAS_W / 2, 240);

    if (bidMessage) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = '14px sans-serif';
      _ctx.fillText(bidMessage, CANVAS_W / 2, 268);
    }

    const bidVal = BID_VALUES[Math.min(bidCurrent, BID_VALUES.length - 1)];
    _ctx.fillStyle = '#aaa';
    _ctx.font = '13px sans-serif';
    _ctx.fillText('Current bid: ' + bidVal, CANVAS_W / 2, 290);

    // Bid button
    _ctx.fillStyle = '#4a4';
    CE.drawRoundedRect(_ctx, BID_BTN.x, BID_BTN.y, BID_BTN.w, BID_BTN.h, 4);
    _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.fillText('Bid ' + bidVal, BID_BTN.x + BID_BTN.w / 2, BID_BTN.y + BID_BTN.h / 2 + 1);

    // Pass button
    _ctx.fillStyle = '#a44';
    CE.drawRoundedRect(_ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 4);
    _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.fillText('Pass', PASS_BTN.x + PASS_BTN.w / 2, PASS_BTN.y + PASS_BTN.h / 2 + 1);
  }

  function drawSkatPickUI() {
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('You are the Declarer! Pick up the Skat (2 cards) or skip.', CANVAS_W / 2, 240);

    // Show skat cards
    for (let i = 0; i < skatPile.length; ++i) {
      const x = 400 + i * 80;
      skatPile[i].faceUp = true;
      CE.drawCardFace(_ctx, x, 260, skatPile[i]);
    }

    _ctx.fillStyle = '#4a4';
    CE.drawRoundedRect(_ctx, SKAT_BTN.x, SKAT_BTN.y, SKAT_BTN.w, SKAT_BTN.h, 4);
    _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Pick up Skat & Choose Trump', SKAT_BTN.x + SKAT_BTN.w / 2, SKAT_BTN.y + SKAT_BTN.h / 2 + 1);
  }

  function drawTrumpPickUI() {
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Choose Trump Suit:', CANVAS_W / 2, 260);

    trumpBtns.length = 0;
    for (let i = 0; i < CE.SUITS.length; ++i) {
      const x = 310 + i * 80;
      const y = 280;
      const w = 70;
      const h = 36;
      _ctx.fillStyle = CE.SUIT_COLORS[CE.SUITS[i]] === '#d00' ? '#c44' : '#444';
      CE.drawRoundedRect(_ctx, x, y, w, h, 4);
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1;
      _ctx.stroke();
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(SUIT_NAMES[CE.SUITS[i]], x + w / 2, y + h / 2 + 1);
      trumpBtns.push({ x, y, w, h, suit: CE.SUITS[i] });
    }
  }

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function resolveTrick() {
    if (trickCards.length < 3) return;
    const winner = trickWinner(trickCards, trickPlayers);
    let pts = 0;
    for (const c of trickCards) pts += RANK_VALUES[c.rank];
    cardPoints[winner] += pts;
    ++tricksWon[winner];
    ++trickCount;

    if (_host) {
      const label = winner === 0 ? 'You win trick! +' + pts : 'AI ' + winner + ' wins +' + pts;
      _host.floatingText.add(CANVAS_W / 2, 300, label, { color: winner === 0 ? '#4f4' : '#f88', size: 16 });
    }

    trickCards = [];
    trickPlayers = [];
    currentTrickLead = winner;
    currentTurn = winner;

    // Check if round over (all cards played - 10 tricks)
    if (trickCount >= 10 || (skatHands[0].length === 0 && skatHands[1].length === 0 && skatHands[2].length === 0)) {
      endRound();
    }
  }

  function endRound() {
    roundOver = true;
    // Declarer needs > 60 card points to win
    const declPts = cardPoints[declarer];
    const defPts = cardPoints.reduce((s, v) => s + v, 0) - declPts;
    const declWon = declPts > 60;

    if (declarer === 0 && declWon) {
      score += declPts;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 280, 'You won as Declarer! +' + declPts, { color: '#4f4', size: 22 });
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    } else if (declarer === 0 && !declWon) {
      score -= 20;
      if (_host) _host.floatingText.add(CANVAS_W / 2, 280, 'Declarer lost! -20', { color: '#f44', size: 22 });
    } else if (declarer !== 0 && !declWon) {
      score += 30;
      if (_host) _host.floatingText.add(CANVAS_W / 2, 280, 'Defenders win! +30', { color: '#4f4', size: 22 });
    } else {
      score -= 10;
      if (_host) _host.floatingText.add(CANVAS_W / 2, 280, 'Declarer AI ' + declarer + ' won', { color: '#f88', size: 18 });
    }

    if (score <= -50) gameOver = true;
    if (_host) _host.onScoreChanged(score);
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupSkat();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawSkat();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      // Bidding phase
      if (phase === PHASE_BIDDING) {
        if (mx >= BID_BTN.x && mx <= BID_BTN.x + BID_BTN.w && my >= BID_BTN.y && my <= BID_BTN.y + BID_BTN.h) {
          bidActive[0] = true;
          ++bidCurrent;
          bidPhaseStep = 2;
          runBiddingStep();
          return;
        }
        if (mx >= PASS_BTN.x && mx <= PASS_BTN.x + PASS_BTN.w && my >= PASS_BTN.y && my <= PASS_BTN.y + PASS_BTN.h) {
          bidActive[0] = false;
          bidPhaseStep = 2;
          runBiddingStep();
          return;
        }
        return;
      }

      // Skat pick phase
      if (phase === PHASE_SKAT_PICK) {
        if (mx >= SKAT_BTN.x && mx <= SKAT_BTN.x + SKAT_BTN.w && my >= SKAT_BTN.y && my <= SKAT_BTN.y + SKAT_BTN.h) {
          // Pick up skat cards
          for (const c of skatPile) { c.faceUp = true; skatHands[0].push(c); }
          skatPile = [];
          phase = PHASE_TRUMP_PICK;
          return;
        }
        return;
      }

      // Trump pick phase
      if (phase === PHASE_TRUMP_PICK) {
        for (const btn of trumpBtns) {
          if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
            trumpSuit = btn.suit;
            // Discard 2 cards (for simplicity, discard last 2)
            if (skatHands[0].length > 10) {
              skatPile.push(skatHands[0].pop());
              skatPile.push(skatHands[0].pop());
            }
            phase = PHASE_PLAYING;
            currentTrickLead = declarer;
            currentTurn = declarer;
            return;
          }
        }
        return;
      }

      // Playing phase - player's turn
      if (phase !== PHASE_PLAYING || currentTurn !== 0) return;
      const hand = skatHands[0];
      for (let i = hand.length - 1; i >= 0; --i) {
        const cx = 60 + i * 60;
        if (mx >= cx && mx <= cx + CE.CARD_W && my >= 440 && my <= 440 + CE.CARD_H) {
          const leadSuit = trickCards.length > 0 ? effectiveSuit(trickCards[0]) : null;
          if (skatIsValid(hand[i], leadSuit, hand)) {
            const card = hand.splice(i, 1)[0];
            card.faceUp = true;
            trickCards.push(card);
            trickPlayers.push(0);
            currentTurn = (currentTurn + 1) % 3;
            if (trickCards.length >= 3) resolveTrick();
          } else {
            if (_host) _host.floatingText.add(mx, my - 20, 'Must follow suit!', { color: '#f88', size: 14 });
          }
          return;
        }
      }
    },

    handleKey(e) {},

    tick(dt) {
      if (roundOver || gameOver) return;

      if (phase === PHASE_BIDDING) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY && bidPhaseStep === 0) {
          aiTurnTimer = 0;
          runBiddingStep();
        }
        return;
      }

      if (phase !== PHASE_PLAYING) return;
      if (currentTurn === 0) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        skatAiPlay(currentTurn);
        currentTurn = (currentTurn + 1) % 3;
        if (trickCards.length >= 3) resolveTrick();
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      skatHands = [[], [], []];
      trickCards = [];
      trickPlayers = [];
      skatPile = [];
      deck = [];
      roundOver = false;
      gameOver = false;
      declarer = -1;
      phase = PHASE_BIDDING;
      aiTurnTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('skat', module);

})();
