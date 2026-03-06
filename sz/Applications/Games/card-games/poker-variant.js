;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const CARD_GAP = 8;

  /* ── Game state ── */
  let playerHand = [];
  let aiHands = [[]];
  let deck = [];
  let pokerBet = 10;
  let pokerPot = 0;
  let pokerPhase = 'deal';
  let pokerChips = 100;
  let roundOver = false;
  let gameOver = false;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── Button layout ── */
  const PKR_BTN_W = 80;
  const PKR_BTN_H = 34;
  const PKR_BTN_Y = CANVAS_H - 62;
  const PKR_BTN_GAP = 10;
  const PKR_BTN_START = CANVAS_W / 2 - (4 * PKR_BTN_W + 3 * PKR_BTN_GAP) / 2;

  function pokerBtnRect(i) {
    return { x: PKR_BTN_START + i * (PKR_BTN_W + PKR_BTN_GAP), y: PKR_BTN_Y, w: PKR_BTN_W, h: PKR_BTN_H };
  }

  /* ══════════════════════════════════════════════════════════════════
     POKER HAND EVALUATION
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
    let isStraight = false;
    const unique = [...new Set(values)];
    if (unique.length >= 5 && unique[0] - unique[4] === 4) isStraight = true;
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

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupPoker() {
    deck = CE.shuffle(CE.createDeck());
    playerHand = [];
    aiHands = [[]];
    pokerBet = 10;
    pokerPot = 0;
    pokerPhase = 'deal';
    roundOver = false;
    gameOver = false;
    if (pokerChips <= 0) pokerChips = 100;

    for (let i = 0; i < 5; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      playerHand.push(pc);
      if (_host) _host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, 150 + i * (CE.CARD_W + CARD_GAP), 420, i * 0.12);
      const ac = deck.pop();
      ac.faceUp = false;
      aiHands[0].push(ac);
      if (_host) _host.dealCardAnim(ac, CANVAS_W / 2, -CE.CARD_H, 150 + i * (CE.CARD_W + CARD_GAP), 80, (i + 5) * 0.12);
    }
    pokerPhase = 'bet';
  }

  function pokerBetAction(action) {
    if (roundOver || gameOver) return;
    if (action === 'fold') {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 300, 'FOLDED', { color: '#f88', size: 20 });
      pokerChips -= pokerBet;
      endRound(false);
      return;
    }
    if (action === 'bet' || action === 'call') {
      pokerPot += pokerBet * 2;
      pokerChips -= pokerBet;
      pokerPhase = 'showdown';
      for (const c of aiHands[0]) {
        c.faceUp = true;
        if (_host) _host.flipCard(c, true);
      }
      const playerEval = evaluatePokerHand(playerHand);
      const aiEval = evaluatePokerHand(aiHands[0]);
      const playerWins = playerEval.rank > aiEval.rank;
      const tie = playerEval.rank === aiEval.rank;
      if (playerWins) {
        if (_host) _host.floatingText.add(CANVAS_W / 2, 300, playerEval.name + ' WINS!', { color: '#4f4', size: 24 });
        pokerChips += pokerPot;
        endRound(true);
      } else if (tie) {
        if (_host) _host.floatingText.add(CANVAS_W / 2, 300, 'TIE', { color: '#ff8', size: 24 });
        pokerChips += pokerPot / 2;
        roundOver = true;
      } else {
        if (_host) _host.floatingText.add(CANVAS_W / 2, 300, 'AI: ' + aiEval.name, { color: '#f44', size: 24 });
        endRound(false);
      }
      return;
    }
    if (action === 'raise') {
      pokerBet = Math.min(pokerBet * 2, pokerChips);
      if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'RAISE to ' + pokerBet, { color: '#fa0', size: 18 });
    }
  }

  function endRound(won) {
    roundOver = true;
    if (won && _host) {
      _host.addGlow(130, 400, 5 * (CE.CARD_W + CARD_GAP), CE.CARD_H, 2.0);
      _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      _host.particles.confetti(CANVAS_W / 2, 300, 30);
    }
    if (pokerChips <= 0) {
      gameOver = true;
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    if (_host) _host.onScoreChanged(pokerChips);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawPoker() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI Opponent', 150, 65);
    for (let i = 0; i < aiHands[0].length; ++i) {
      if (aiHands[0][i]._dealing) continue;
      const x = 150 + i * (CE.CARD_W + CARD_GAP);
      if (aiHands[0][i].faceUp)
        CE.drawCardFace(_ctx, x, 80, aiHands[0][i]);
      else
        CE.drawCardBack(_ctx, x, 80);
    }
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Your Hand', 150, 405);
    for (let i = 0; i < playerHand.length; ++i) {
      if (playerHand[i]._dealing) continue;
      const x = 150 + i * (CE.CARD_W + CARD_GAP);
      CE.drawCardFace(_ctx, x, 420, playerHand[i]);
    }
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Pot: ' + pokerPot + '  Chips: ' + pokerChips, CANVAS_W / 2, 280);
    if (!roundOver && !gameOver && pokerPhase === 'bet') {
      const labels = ['Bet (B)', 'Fold (F)', 'Call (C)', 'Raise (R)'];
      const colors = [
        { bg: '#2a5a2a', border: '#6c6' },
        { bg: '#5a2a2a', border: '#c66' },
        { bg: '#2a3a5a', border: '#6ac' },
        { bg: '#5a5a2a', border: '#cc6' }
      ];
      for (let i = 0; i < 4; ++i) {
        const r = pokerBtnRect(i);
        CE.drawButton(_ctx, r.x, r.y, r.w, r.h, labels[i], { ...colors[i], fontSize: 12 });
      }
    }
    if (playerHand.length === 5) {
      const ev = evaluatePokerHand(playerHand);
      _ctx.fillStyle = '#aaf';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText(ev.name, 150, 540);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      pokerChips = (_host && _host.getScore) ? _host.getScore() : 100;
      setupPoker();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawPoker();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }
      if (pokerPhase === 'bet') {
        const actions = ['bet', 'fold', 'call', 'raise'];
        for (let i = 0; i < 4; ++i) {
          const r = pokerBtnRect(i);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            pokerBetAction(actions[i]);
            return;
          }
        }
      }
    },

    handleKey(e) {
      if (roundOver || gameOver) return;
      if (e.key === 'b' || e.key === 'B') pokerBetAction('bet');
      if (e.key === 'f' || e.key === 'F') pokerBetAction('fold');
      if (e.key === 'c' || e.key === 'C') pokerBetAction('call');
      if (e.key === 'r' || e.key === 'R') pokerBetAction('raise');
    },

    tick(dt) {},
    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      playerHand = [];
      aiHands = [[]];
      deck = [];
      roundOver = false;
      gameOver = false;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return pokerChips; },
    setScore(s) { pokerChips = s; }
  };

  SZ.CardGames.registerVariant('poker', module);

})();
