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

  const DURAK_RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_ORDER = { '6': 0, '7': 1, '8': 2, '9': 3, '10': 4, 'J': 5, 'Q': 6, 'K': 7, 'A': 8 };

  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const SUIT_DISPLAY_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

  const HAND_LIMIT = 6;
  const MAX_ATTACK_CARDS = 6;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let stock = [];
  let discard = [];
  let trumpCard = null;
  let trumpSuit = '';

  /* Table: pairs of attack/defense cards */
  let attackCards = [];
  let defenseCards = [];

  let isPlayerAttacking = true;
  let waitingForDefense = false;
  let boutOver = false;
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 1.0;
  let aiActionPending = false;

  let hoverCardIdx = -1;
  let selectedCardIdx = -1;

  /* ================================================================
     BUTTON POSITIONS
     ================================================================ */

  const TAKE_BTN = { x: CANVAS_W / 2 + 120, y: 280, w: 90, h: 34 };
  const DONE_BTN = { x: CANVAS_W / 2 + 120, y: 320, w: 90, h: 34 };
  const PASS_BTN = { x: CANVAS_W / 2 + 120, y: 280, w: 90, h: 34 };

  /* ================================================================
     CARD UTILITIES
     ================================================================ */

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
  }

  function isTrump(card) {
    return card.suit === trumpSuit;
  }

  function canBeat(attCard, defCard) {
    if (defCard.suit === attCard.suit)
      return cardStrength(defCard) > cardStrength(attCard);
    if (isTrump(defCard) && !isTrump(attCard))
      return true;
    return false;
  }

  function sortHand(hand) {
    hand.sort((a, b) => {
      const ta = isTrump(a) ? 1 : 0;
      const tb = isTrump(b) ? 1 : 0;
      if (ta !== tb) return ta - tb;
      if (a.suit !== b.suit) return CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      return cardStrength(a) - cardStrength(b);
    });
  }

  function ranksOnTable() {
    const ranks = new Set();
    for (const c of attackCards) ranks.add(c.rank);
    for (const c of defenseCards)
      if (c) ranks.add(c.rank);
    return ranks;
  }

  function canAddAttackCard(card, defenderHandSize) {
    const totalAttacks = attackCards.length;
    if (totalAttacks >= MAX_ATTACK_CARDS) return false;
    if (totalAttacks >= defenderHandSize + countUndefended()) return false;
    if (totalAttacks === 0) return true;
    const ranks = ranksOnTable();
    return ranks.has(card.rank);
  }

  function countUndefended() {
    let count = 0;
    for (let i = 0; i < attackCards.length; ++i)
      if (!defenseCards[i]) ++count;
    return count;
  }

  function allDefended() {
    if (attackCards.length === 0) return false;
    for (let i = 0; i < attackCards.length; ++i)
      if (!defenseCards[i]) return false;
    return true;
  }

  /* ================================================================
     DRAW FROM STOCK
     ================================================================ */

  function drawFromStock(hand, count) {
    for (let i = 0; i < count && stock.length > 0; ++i)
      hand.push(stock.pop());
  }

  function refillHands() {
    const attackerHand = isPlayerAttacking ? playerHand : aiHand;
    const defenderHand = isPlayerAttacking ? aiHand : playerHand;

    const attackerNeed = Math.max(0, HAND_LIMIT - attackerHand.length);
    drawFromStock(attackerHand, attackerNeed);

    const defenderNeed = Math.max(0, HAND_LIMIT - defenderHand.length);
    drawFromStock(defenderHand, defenderNeed);

    sortHand(playerHand);
    sortHand(aiHand);
  }

  /* ================================================================
     BOUT RESOLUTION
     ================================================================ */

  function defenderPicksUp() {
    const defenderHand = isPlayerAttacking ? aiHand : playerHand;
    for (let i = 0; i < attackCards.length; ++i) {
      defenderHand.push(attackCards[i]);
      if (defenseCards[i])
        defenderHand.push(defenseCards[i]);
    }
    attackCards = [];
    defenseCards = [];
    boutOver = true;

    if (_host) {
      const who = isPlayerAttacking ? 'AI picks up!' : 'You pick up!';
      _host.floatingText.add(CANVAS_W / 2, 280, who, { color: '#fa0', size: 20 });
    }

    refillHands();
    sortHand(playerHand);
    sortHand(aiHand);
    /* Attacker stays the same when defender picks up */
    checkGameEnd();
  }

  function defenderSucceeded() {
    for (let i = 0; i < attackCards.length; ++i) {
      discard.push(attackCards[i]);
      if (defenseCards[i])
        discard.push(defenseCards[i]);
    }
    attackCards = [];
    defenseCards = [];
    boutOver = true;

    if (_host)
      _host.floatingText.add(CANVAS_W / 2, 280, 'Defended!', { color: '#4f4', size: 20 });

    refillHands();
    sortHand(playerHand);
    sortHand(aiHand);
    /* Defender becomes attacker */
    isPlayerAttacking = !isPlayerAttacking;
    checkGameEnd();
  }

  function checkGameEnd() {
    boutOver = false;
    waitingForDefense = false;
    aiActionPending = false;
    aiTurnTimer = 0;
    selectedCardIdx = -1;

    if (stock.length === 0) {
      if (playerHand.length === 0 && aiHand.length === 0) {
        /* Draw */
        roundOver = true;
        resultMsg = 'Draw! Both players empty.';
        score += 50;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 300, 'Draw!', { color: '#ff0', size: 24 });
          _host.onScoreChanged(score);
        }
        return;
      }
      if (playerHand.length === 0) {
        /* Player wins */
        roundOver = true;
        const bonus = aiHand.length * 5;
        score += 100 + bonus;
        resultMsg = 'You win! +' + (100 + bonus) + ' - Click to continue';
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 300, 'You win!', { color: '#4f4', size: 28 });
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
          _host.particles.confetti(CANVAS_W / 2, 300, 30);
          _host.onScoreChanged(score);
        }
        return;
      }
      if (aiHand.length === 0) {
        /* AI wins -- player is the Durak */
        roundOver = true;
        score -= 50;
        resultMsg = 'You are the Durak! -50 - Click to continue';
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 300, 'DURAK!', { color: '#f44', size: 28 });
          _host.screenShake.trigger(8, 400);
          _host.onScoreChanged(score);
        }
        if (score <= -100) {
          gameOver = true;
          resultMsg = 'GAME OVER';
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 340, 'GAME OVER', { color: '#f44', size: 36 });
        }
        return;
      }
    }
  }

  /* ================================================================
     PLAYER ACTIONS
     ================================================================ */

  function playerAttack(cardIdx) {
    if (!isPlayerAttacking || roundOver || gameOver) return;
    if (waitingForDefense) return;

    const card = playerHand[cardIdx];
    if (!canAddAttackCard(card, aiHand.length)) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 400, 'Cannot play this card!', { color: '#f88', size: 14 });
      return;
    }

    playerHand.splice(cardIdx, 1);
    card.faceUp = true;
    attackCards.push(card);
    defenseCards.push(null);
    selectedCardIdx = -1;

    if (_host)
      _host.dealCardAnim(card, CANVAS_W / 2, CANVAS_H, tableAttackX(attackCards.length - 1), tableAttackY(), 0);

    if (attackCards.length === 1 && _host)
      _host.floatingText.add(CANVAS_W / 2, 260, 'Attack!', { color: '#fa0', size: 18 });

    waitingForDefense = true;
    aiActionPending = false;
    aiTurnTimer = 0;
  }

  function playerDefend(attackIdx, cardIdx) {
    if (isPlayerAttacking || roundOver || gameOver) return;
    if (defenseCards[attackIdx]) return;

    const card = playerHand[cardIdx];
    const attCard = attackCards[attackIdx];

    if (!canBeat(attCard, card)) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 400, 'Cannot beat with this card!', { color: '#f88', size: 14 });
      return;
    }

    playerHand.splice(cardIdx, 1);
    card.faceUp = true;
    defenseCards[attackIdx] = card;
    selectedCardIdx = -1;

    if (_host)
      _host.dealCardAnim(card, CANVAS_W / 2, CANVAS_H, tableDefenseX(attackIdx), tableDefenseY(), 0);

    if (allDefended()) {
      /* Wait for attacker to add more or press Done */
      waitingForDefense = false;
      aiActionPending = false;
      aiTurnTimer = 0;
    }
  }

  function playerTakesCards() {
    if (isPlayerAttacking || roundOver || gameOver) return;
    defenderPicksUp();
  }

  function playerDoneAttacking() {
    if (!isPlayerAttacking || roundOver || gameOver) return;
    if (attackCards.length === 0) return;
    if (!allDefended()) return;
    defenderSucceeded();
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiAttack() {
    if (playerHand.length === 0 && stock.length === 0) {
      /* Nothing to attack into -- end bout */
      if (attackCards.length > 0 && allDefended())
        defenderSucceeded();
      return;
    }

    if (attackCards.length === 0) {
      /* First attack: play lowest non-trump, or lowest trump if no choice */
      let bestIdx = -1;
      let bestStrength = 999;
      for (let i = 0; i < aiHand.length; ++i) {
        const s = cardStrength(aiHand[i]) + (isTrump(aiHand[i]) ? 100 : 0);
        if (s < bestStrength) {
          bestStrength = s;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const card = aiHand.splice(bestIdx, 1)[0];
        card.faceUp = true;
        attackCards.push(card);
        defenseCards.push(null);

        if (_host) {
          _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, tableAttackX(attackCards.length - 1), tableAttackY(), 0);
          _host.floatingText.add(CANVAS_W / 2, 260, 'AI attacks!', { color: '#fa0', size: 18 });
        }

        waitingForDefense = true;
      }
      return;
    }

    /* Subsequent attacks: add cards matching table ranks */
    if (!allDefended()) return;

    const ranks = ranksOnTable();
    let bestIdx = -1;
    let bestStrength = 999;
    for (let i = 0; i < aiHand.length; ++i) {
      if (!ranks.has(aiHand[i].rank)) continue;
      if (!canAddAttackCard(aiHand[i], playerHand.length)) continue;
      const s = cardStrength(aiHand[i]) + (isTrump(aiHand[i]) ? 100 : 0);
      if (s < bestStrength) {
        bestStrength = s;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && attackCards.length < MAX_ATTACK_CARDS) {
      const card = aiHand.splice(bestIdx, 1)[0];
      card.faceUp = true;
      attackCards.push(card);
      defenseCards.push(null);

      if (_host)
        _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, tableAttackX(attackCards.length - 1), tableAttackY(), 0);

      waitingForDefense = true;
    } else {
      /* AI done attacking */
      defenderSucceeded();
    }
  }

  function aiDefend() {
    /* Find first undefended attack card */
    let targetIdx = -1;
    for (let i = 0; i < attackCards.length; ++i) {
      if (!defenseCards[i]) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx < 0) return;

    const attCard = attackCards[targetIdx];

    /* Find lowest card that can beat it -- prefer non-trump */
    let bestIdx = -1;
    let bestStrength = 999;
    let bestIsTrump = true;
    for (let i = 0; i < aiHand.length; ++i) {
      if (!canBeat(attCard, aiHand[i])) continue;
      const t = isTrump(aiHand[i]);
      const s = cardStrength(aiHand[i]);
      /* Prefer non-trump over trump; within same category, prefer lower */
      if (!t && bestIsTrump) {
        bestIdx = i;
        bestStrength = s;
        bestIsTrump = false;
      } else if (t === bestIsTrump && s < bestStrength) {
        bestIdx = i;
        bestStrength = s;
        bestIsTrump = t;
      }
    }

    /* Economic decision: don't waste high trumps unless necessary */
    if (bestIdx >= 0 && bestIsTrump && !isTrump(attCard)) {
      /* Only use trump if stock is small or hand is big enough */
      const shouldUseTrump = stock.length <= 4 || aiHand.length >= 4;
      if (!shouldUseTrump) {
        /* Pick up instead */
        defenderPicksUp();
        return;
      }
    }

    if (bestIdx >= 0) {
      const card = aiHand.splice(bestIdx, 1)[0];
      card.faceUp = true;
      defenseCards[targetIdx] = card;

      if (_host)
        _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, tableDefenseX(targetIdx), tableDefenseY(), 0);

      /* Check if all defended */
      if (allDefended()) {
        waitingForDefense = false;
        aiActionPending = false;
        aiTurnTimer = 0;
      }
    } else {
      /* Can't defend -- pick up */
      defenderPicksUp();
    }
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupDurak() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, DURAK_RANKS));

    playerHand = [];
    aiHand = [];
    stock = d;
    discard = [];
    attackCards = [];
    defenseCards = [];
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    isPlayerAttacking = true;
    waitingForDefense = false;
    boutOver = false;
    aiTurnTimer = 0;
    aiActionPending = false;
    hoverCardIdx = -1;
    selectedCardIdx = -1;

    /* Trump card is bottom of stock (shown face-up) */
    trumpCard = stock[0];
    trumpCard.faceUp = true;
    trumpSuit = trumpCard.suit;

    /* Deal 6 cards each */
    for (let i = 0; i < HAND_LIMIT; ++i) {
      playerHand.push(stock.pop());
      aiHand.push(stock.pop());
    }

    for (const c of playerHand) c.faceUp = true;
    sortHand(playerHand);
    sortHand(aiHand);

    /* Determine first attacker: lowest trump card holder */
    let playerLowestTrump = 99;
    let aiLowestTrump = 99;
    for (const c of playerHand)
      if (isTrump(c) && cardStrength(c) < playerLowestTrump) playerLowestTrump = cardStrength(c);
    for (const c of aiHand)
      if (isTrump(c) && cardStrength(c) < aiLowestTrump) aiLowestTrump = cardStrength(c);

    if (aiLowestTrump < playerLowestTrump)
      isPlayerAttacking = false;
    else
      isPlayerAttacking = true;

    if (_host) {
      for (let i = 0; i < playerHand.length; ++i)
        _host.dealCardAnim(playerHand[i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, playerHand.length), playerCardY(), i * 0.08);
    }
  }

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 620;
    const fanWidth = Math.min(maxWidth, total * 52);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 20;
  }

  function aiCardX(idx, total) {
    const maxWidth = 500;
    const fanWidth = Math.min(maxWidth, total * 30);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function aiCardY() {
    return 15;
  }

  function tableAttackX(idx) {
    const startX = 200;
    return startX + idx * 95;
  }

  function tableAttackY() {
    return 230;
  }

  function tableDefenseX(idx) {
    return tableAttackX(idx) + 15;
  }

  function tableDefenseY() {
    return 260;
  }

  const STOCK_X = 30;
  const STOCK_Y = 250;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const total = playerHand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      const cy = playerCardY();
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function hitTestAttackCard(mx, my) {
    for (let i = attackCards.length - 1; i >= 0; --i) {
      const ax = tableAttackX(i);
      const ay = tableAttackY();
      if (mx >= ax && mx <= ax + CE.CARD_W && my >= ay && my <= ay + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawStock() {
    if (stock.length > 0) {
      /* Trump card shown sideways under the pile */
      if (stock.length > 1 || trumpCard) {
        _ctx.save();
        _ctx.translate(STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
        _ctx.rotate(Math.PI / 2);
        if (trumpCard && trumpCard.faceUp)
          CE.drawCardFace(_ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, trumpCard, CE.CARD_H, CE.CARD_W);
        else
          CE.drawCardBack(_ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, CE.CARD_H, CE.CARD_W);
        _ctx.restore();
      }

      /* Stock pile on top */
      if (stock.length > 1)
        CE.drawCardBack(_ctx, STOCK_X, STOCK_Y);

      /* Card count */
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText(stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 6);
    } else {
      /* Empty stock */
      _ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.fillStyle = 'rgba(255,255,255,0.2)';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }
  }

  function drawTrumpIndicator() {
    const x = 20;
    const y = 195;
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trump:', x, y);
    const color = CE.resolveSuitColor(trumpSuit);
    _ctx.fillStyle = color;
    _ctx.font = 'bold 24px serif';
    _ctx.fillText(SUIT_SYMBOLS[trumpSuit] || trumpSuit, x + 52, y - 4);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText(SUIT_DISPLAY_NAMES[trumpSuit] || trumpSuit, x + 78, y + 2);
  }

  function drawDiscard() {
    if (discard.length > 0) {
      const dx = CANVAS_W - 100;
      const dy = 250;
      _ctx.save();
      _ctx.globalAlpha = 0.4;
      CE.drawCardBack(_ctx, dx, dy);
      _ctx.restore();
      _ctx.fillStyle = '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText('Discard', dx + CE.CARD_W / 2, dy + CE.CARD_H + 4);
      _ctx.fillText('(' + discard.length + ')', dx + CE.CARD_W / 2, dy + CE.CARD_H + 18);
    }
  }

  function drawTable() {
    for (let i = 0; i < attackCards.length; ++i) {
      const ax = tableAttackX(i);
      const ay = tableAttackY();
      CE.drawCardFace(_ctx, ax, ay, attackCards[i]);

      if (defenseCards[i]) {
        const dx = tableDefenseX(i);
        const dy = tableDefenseY();
        CE.drawCardFace(_ctx, dx, dy, defenseCards[i]);
      }
    }
  }

  function drawPlayerHandCards() {
    const total = playerHand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (playerHand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (i === selectedCardIdx)
        y -= 20;
      else if (i === hoverCardIdx)
        y -= 8;

      CE.drawCardFace(_ctx, x, y, playerHand[i]);

      // Hint glow for valid plays
      if (_host && _host.hintsEnabled && !roundOver && !gameOver) {
        const card = playerHand[i];
        let showHint = false;
        if (isPlayerAttacking && !waitingForDefense) {
          // Attack phase: first attack = any card; subsequent = matching ranks on table
          showHint = canAddAttackCard(card, aiHand.length);
        } else if (!isPlayerAttacking && waitingForDefense && !allDefended()) {
          // Defense phase: highlight cards that can beat any undefended attack card
          for (let a = 0; a < attackCards.length; ++a) {
            if (!defenseCards[a] && canBeat(attackCards[a], card)) {
              showHint = true;
              break;
            }
          }
        }
        if (showHint)
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }

      if (i === selectedCardIdx) {
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

  function drawAIHandCards() {
    const total = aiHand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      const x = aiCardX(i, total);
      const y = aiCardY();
      CE.drawCardBack(_ctx, x, y, CE.CARD_W * 0.7, CE.CARD_H * 0.7);
    }
  }

  function drawRoleLabels() {
    /* Player role */
    _ctx.fillStyle = isPlayerAttacking ? '#fa0' : '#8cf';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(isPlayerAttacking ? 'Attacker' : 'Defender', CANVAS_W / 2, CANVAS_H - CE.CARD_H - 42);

    /* AI role */
    _ctx.fillStyle = isPlayerAttacking ? '#8cf' : '#fa0';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'center';
    const aiCount = aiHand.length;
    _ctx.fillText('AI (' + aiCount + ') ' + (isPlayerAttacking ? '- Defender' : '- Attacker'), CANVAS_W / 2, 88);
  }

  function drawButtons() {
    if (roundOver || gameOver) return;

    if (!isPlayerAttacking && !allDefended() && attackCards.length > 0) {
      /* Defender can take */
      CE.drawButton(_ctx, TAKE_BTN.x, TAKE_BTN.y, TAKE_BTN.w, TAKE_BTN.h, 'Take (T)', { bg: '#5a2a2a', border: '#c66' });
    }

    if (isPlayerAttacking && attackCards.length > 0 && allDefended()) {
      /* Attacker can press Done (or add more) */
      CE.drawButton(_ctx, DONE_BTN.x, DONE_BTN.y, DONE_BTN.w, DONE_BTN.h, 'Done (D)', { bg: '#2a5a2a', border: '#6c6' });
    }
  }

  function drawStatusMessage() {
    if (roundOver || gameOver) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 10);
      if (!gameOver) {
        _ctx.fillStyle = '#aaa';
        _ctx.font = '12px sans-serif';
        _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 15);
      }
      return;
    }

    /* Turn hint */
    let hint = '';
    if (isPlayerAttacking) {
      if (attackCards.length === 0)
        hint = 'Your turn to attack -- click a card';
      else if (waitingForDefense)
        hint = 'Waiting for AI to defend...';
      else if (allDefended())
        hint = 'Add more cards or press Done (D)';
    } else {
      if (waitingForDefense && !allDefended()) {
        if (selectedCardIdx >= 0)
          hint = 'Click an undefended attack card to place defense';
        else
          hint = 'Select a card, then click an attack card to defend -- or Take (T)';
      } else if (allDefended() && attackCards.length > 0)
        hint = 'Waiting for AI to add cards or finish...';
      else if (attackCards.length === 0)
        hint = 'Waiting for AI to attack...';
    }

    if (hint) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(hint, CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawDurak() {
    /* Title */
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Durak', 10, 10);

    /* Score */
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('Score: ' + score, CANVAS_W - 20, 10);

    drawTrumpIndicator();
    drawStock();
    drawDiscard();
    drawTable();
    drawAIHandCards();
    drawPlayerHandCards();
    drawRoleLabels();
    drawButtons();
    drawStatusMessage();
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupDurak();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawDurak();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (gameOver) {
          if (_host) _host.onRoundOver(true);
        } else {
          roundOver = false;
          setupDurak();
        }
        return;
      }

      /* Button clicks */
      if (!isPlayerAttacking && !allDefended() && attackCards.length > 0) {
        if (CE.isInRect(mx, my, TAKE_BTN.x, TAKE_BTN.y, TAKE_BTN.w, TAKE_BTN.h)) {
          playerTakesCards();
          return;
        }
      }

      if (isPlayerAttacking && attackCards.length > 0 && allDefended()) {
        if (CE.isInRect(mx, my, DONE_BTN.x, DONE_BTN.y, DONE_BTN.w, DONE_BTN.h)) {
          playerDoneAttacking();
          return;
        }
      }

      /* Player is attacker -- click cards to attack */
      if (isPlayerAttacking && !waitingForDefense) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx >= 0) {
          playerAttack(idx);
          return;
        }
      }

      /* Player is defender */
      if (!isPlayerAttacking && waitingForDefense) {
        /* If a card is selected, clicking an attack card defends it */
        if (selectedCardIdx >= 0) {
          const atkIdx = hitTestAttackCard(mx, my);
          if (atkIdx >= 0 && !defenseCards[atkIdx]) {
            playerDefend(atkIdx, selectedCardIdx);
            return;
          }
        }

        /* Click a hand card to select it */
        const idx = hitTestPlayerCard(mx, my);
        if (idx >= 0) {
          if (selectedCardIdx === idx)
            selectedCardIdx = -1;
          else
            selectedCardIdx = idx;
          return;
        }

        /* Click elsewhere to deselect */
        selectedCardIdx = -1;
      }
    },

    handlePointerMove(mx, my) {
      if (roundOver || gameOver) {
        hoverCardIdx = -1;
        return;
      }
      hoverCardIdx = hitTestPlayerCard(mx, my);
    },

    handlePointerUp() {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      const key = e.key ? e.key.toLowerCase() : '';
      if (key === 't' && !isPlayerAttacking && !allDefended() && attackCards.length > 0)
        playerTakesCards();
      else if (key === 'd' && isPlayerAttacking && attackCards.length > 0 && allDefended())
        playerDoneAttacking();
    },

    tick(dt) {
      if (roundOver || gameOver) return;

      /* AI actions on a timer */
      const isAiTurn = (isPlayerAttacking && waitingForDefense) ||
                       (!isPlayerAttacking && attackCards.length === 0) ||
                       (!isPlayerAttacking && allDefended() && attackCards.length > 0);

      if (!isAiTurn) return;

      aiTurnTimer += dt;
      if (aiTurnTimer < AI_TURN_DELAY) return;
      aiTurnTimer = 0;

      if (isPlayerAttacking && waitingForDefense) {
        /* AI must defend */
        aiDefend();
      } else if (!isPlayerAttacking && attackCards.length === 0) {
        /* AI must attack */
        aiAttack();
      } else if (!isPlayerAttacking && allDefended() && attackCards.length > 0) {
        /* AI can add more attack cards or finish */
        aiAttack();
      }
    },

    cleanup() {
      playerHand = [];
      aiHand = [];
      stock = [];
      discard = [];
      attackCards = [];
      defenseCards = [];
      trumpCard = null;
      trumpSuit = '';
      roundOver = false;
      gameOver = false;
      isPlayerAttacking = true;
      waitingForDefense = false;
      boutOver = false;
      aiTurnTimer = 0;
      aiActionPending = false;
      hoverCardIdx = -1;
      selectedCardIdx = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('durak', module);

})();
