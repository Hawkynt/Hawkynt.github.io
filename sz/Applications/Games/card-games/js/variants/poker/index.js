/* Poker variant: state, rules, flow, drawing and input in one module. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.poker = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const CARD_GAP = 8;

  /* ── Button layout ── */
  const PKR_BTN_W = 80;
  const PKR_BTN_H = 34;
  const PKR_BTN_Y = CANVAS_H - 62;
  const PKR_BTN_GAP = 10;
  const PKR_BTN_START = CANVAS_W / 2 - (4 * PKR_BTN_W + 3 * PKR_BTN_GAP) / 2;

  const S = V.S = {
    /* ── Game state ── */
    playerHand: [],
    aiHands: [[]],
    deck: [],
    pokerBet: 10,
    pokerPot: 0,
    pokerPhase: 'deal',
    pokerChips: 100,
    roundOver: false,
    gameOver: false,
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  function pokerBtnRect(i) {
    return { x: PKR_BTN_START + i * (PKR_BTN_W + PKR_BTN_GAP), y: PKR_BTN_Y, w: PKR_BTN_W, h: PKR_BTN_H };
  }

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

  function setupPoker() {
    S.deck = CE.shuffle(CE.createDeck());
    S.playerHand = [];
    S.aiHands = [[]];
    S.pokerBet = 10;
    S.pokerPot = 0;
    S.pokerPhase = 'deal';
    S.roundOver = false;
    S.gameOver = false;
    if (S.pokerChips <= 0) S.pokerChips = 100;

    for (let i = 0; i < 5; ++i) {
      const pc = S.deck.pop();
      pc.faceUp = true;
      S.playerHand.push(pc);
      if (S._host) S._host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, 150 + i * (CE.CARD_W + CARD_GAP), 420, i * 0.12);
      const ac = S.deck.pop();
      ac.faceUp = false;
      S.aiHands[0].push(ac);
      if (S._host) S._host.dealCardAnim(ac, CANVAS_W / 2, -CE.CARD_H, 150 + i * (CE.CARD_W + CARD_GAP), 80, (i + 5) * 0.12);
    }
    S.pokerPhase = 'bet';
  }

  function pokerBetAction(action) {
    if (S.roundOver || S.gameOver) return;
    if (action === 'fold') {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 300, 'FOLDED', { color: '#f88', size: 20 });
      S.pokerChips -= S.pokerBet;
      endRound(false);
      return;
    }
    if (action === 'bet' || action === 'call') {
      S.pokerPot += S.pokerBet * 2;
      S.pokerChips -= S.pokerBet;
      S.pokerPhase = 'showdown';
      for (const c of S.aiHands[0]) {
        c.faceUp = true;
        if (S._host) S._host.flipCard(c, true);
      }
      const playerEval = evaluatePokerHand(S.playerHand);
      const aiEval = evaluatePokerHand(S.aiHands[0]);
      const playerWins = playerEval.rank > aiEval.rank;
      const tie = playerEval.rank === aiEval.rank;
      if (playerWins) {
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 300, playerEval.name + ' WINS!', { color: '#4f4', size: 24 });
        S.pokerChips += S.pokerPot;
        endRound(true);
      } else if (tie) {
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 300, 'TIE', { color: '#ff8', size: 24 });
        S.pokerChips += S.pokerPot / 2;
        S.roundOver = true;
      } else {
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 300, 'AI: ' + aiEval.name, { color: '#f44', size: 24 });
        endRound(false);
      }
      return;
    }
    if (action === 'raise') {
      S.pokerBet = Math.min(S.pokerBet * 2, S.pokerChips);
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'RAISE to ' + S.pokerBet, { color: '#fa0', size: 18 });
    }
  }

  function endRound(won) {
    S.roundOver = true;
    if (won && S._host) {
      S._host.addGlow(130, 400, 5 * (CE.CARD_W + CARD_GAP), CE.CARD_H, 2.0);
      S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      S._host.particles.confetti(CANVAS_W / 2, 300, 30);
    }
    if (S.pokerChips <= 0) {
      S.gameOver = true;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    if (S._host) S._host.onScoreChanged(S.pokerChips);
  }

  function drawPoker() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI Opponent', 150, 65);
    for (let i = 0; i < S.aiHands[0].length; ++i) {
      if (S.aiHands[0][i]._dealing) continue;
      const x = 150 + i * (CE.CARD_W + CARD_GAP);
      if (S.aiHands[0][i].faceUp)
        CE.drawCardFace(S._ctx, x, 80, S.aiHands[0][i]);
      else
        CE.drawCardBack(S._ctx, x, 80);
    }
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Your Hand', 150, 405);
    for (let i = 0; i < S.playerHand.length; ++i) {
      if (S.playerHand[i]._dealing) continue;
      const x = 150 + i * (CE.CARD_W + CARD_GAP);
      CE.drawCardFace(S._ctx, x, 420, S.playerHand[i]);
    }
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Pot: ' + S.pokerPot + '  Chips: ' + S.pokerChips, CANVAS_W / 2, 280);
    if (!S.roundOver && !S.gameOver && S.pokerPhase === 'bet') {
      const labels = ['Bet (B)', 'Fold (F)', 'Call (C)', 'Raise (R)'];
      const colors = [
        { bg: '#2a5a2a', border: '#6c6' },
        { bg: '#5a2a2a', border: '#c66' },
        { bg: '#2a3a5a', border: '#6ac' },
        { bg: '#5a5a2a', border: '#cc6' }
      ];
      for (let i = 0; i < 4; ++i) {
        const r = pokerBtnRect(i);
        CE.drawButton(S._ctx, r.x, r.y, r.w, r.h, labels[i], { ...colors[i], fontSize: 12 });
      }
    }
    if (S.playerHand.length === 5) {
      const ev = evaluatePokerHand(S.playerHand);
      S._ctx.fillStyle = '#aaf';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(ev.name, 150, 540);
    }
  }

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.pokerChips = (S._host && S._host.getScore) ? S._host.getScore() : 100;
      setupPoker();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      drawPoker();
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        if (S._host) S._host.onRoundOver(S.gameOver);
        return;
      }
      if (S.pokerPhase === 'bet') {
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
      if (S.roundOver || S.gameOver) return;
      if (e.key === 'b' || e.key === 'B') pokerBetAction('bet');
      if (e.key === 'f' || e.key === 'F') pokerBetAction('fold');
      if (e.key === 'c' || e.key === 'C') pokerBetAction('call');
      if (e.key === 'r' || e.key === 'R') pokerBetAction('raise');
    },

    tick(dt) {},
    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      S.playerHand = [];
      S.aiHands = [[]];
      S.deck = [];
      S.roundOver = false;
      S.gameOver = false;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.pokerChips; },
    setScore(s) { S.pokerChips = s; }
  };

  SZ.CardGames.registerVariant('poker', module);

})();
