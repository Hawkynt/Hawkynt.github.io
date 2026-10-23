;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Doppelkopf-specific reduced ranks ── */
  const DK_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];

  /* ── Game state ── */
  let skatHandCards = [[], [], [], []];
  let doppelkopfTeams = [0, 0, 0, 0];
  let trickCards = [];
  let deck = [];
  let score = 0;
  let roundOver = false;
  let gameOver = false;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── AI timer ── */
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  /* ══════════════════════════════════════════════════════════════════
     RULES
     ══════════════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupDoppelkopf() {
    const d = CE.shuffle(
      CE.createDeckFromRanks(CE.SUITS, DK_RANKS).concat(
        CE.createDeckFromRanks(CE.SUITS, DK_RANKS)
      )
    );
    skatHandCards = [[], [], [], []];
    doppelkopfTeams = [0, 0, 0, 0];
    trickCards = [];
    roundOver = false;
    gameOver = false;
    aiTurnTimer = 0;
    for (let i = 0; i < 12; ++i)
      for (let p = 0; p < 4; ++p)
        skatHandCards[p].push(d.pop());
    for (const c of skatHandCards[0]) c.faceUp = true;
    deck = d;
    for (let p = 0; p < 4; ++p)
      doppelkopfTeams[p] = skatHandCards[p].some(c => c.rank === 'Q' && c.suit === 'clubs') ? 1 : 0;
    if (_host) {
      for (let i = 0; i < skatHandCards[0].length; ++i)
        _host.dealCardAnim(skatHandCards[0][i], CANVAS_W / 2, -CE.CARD_H, 30 + i * 55, 440, i * 0.06);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawDoppelkopf() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Doppelkopf', 30, 225);
    for (let i = 0; i < trickCards.length; ++i) {
      const x = 320 + i * 60;
      CE.drawCardFace(_ctx, x, 240, trickCards[i]);
    }
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Your Hand', 30, 425);
    for (let i = 0; i < skatHandCards[0].length; ++i) {
      if (skatHandCards[0][i]._dealing) continue;
      const x = 30 + i * 55;
      CE.drawCardFace(_ctx, x, 440, skatHandCards[0][i], CE.CARD_W * 0.9, CE.CARD_H * 0.9);

      if (_host && _host.hintsEnabled && trickCards.length < 4 && trickCards.length % 4 === 0) {
        const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
        if (skatIsValid(skatHandCards[0][i], leadSuit, skatHandCards[0]))
          CE.drawHintGlow(_ctx, x, 440, CE.CARD_W * 0.9, CE.CARD_H * 0.9, _host.hintTime);
      }
    }
    for (let p = 1; p < 4; ++p) {
      const y = 10 + (p - 1) * 70;
      _ctx.fillStyle = '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText('AI ' + p + ' (' + skatHandCards[p].length + ')', 30, y + 55);
      for (let i = 0; i < Math.min(skatHandCards[p].length, 12); ++i)
        CE.drawCardBack(_ctx, 30 + i * 18, y, CE.CARD_W * 0.45, CE.CARD_H * 0.45);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupDoppelkopf();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawDoppelkopf();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }
      const hand = skatHandCards[0];
      for (let i = hand.length - 1; i >= 0; --i) {
        const cx = 30 + i * 55;
        const cw = CE.CARD_W * 0.9;
        if (mx >= cx && mx <= cx + cw && my >= 440 && my <= 440 + CE.CARD_H) {
          const totalPlayers = 4;
          if (trickCards.length % totalPlayers === 0 || trickCards.length < totalPlayers) {
            const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
            if (skatIsValid(hand[i], leadSuit, hand)) {
              const card = hand.splice(i, 1)[0];
              card.faceUp = true;
              trickCards.push(card);
            } else {
              if (_host) _host.floatingText.add(mx, my - 20, 'Invalid!', { color: '#f88', size: 14 });
            }
          }
          return;
        }
      }
    },

    handleKey(e) {},

    tick(dt) {
      if (roundOver || gameOver) return;
      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        const totalPlayers = 4;
        const currentTrickPlayer = trickCards.length % totalPlayers;
        if (currentTrickPlayer !== 0 && trickCards.length < totalPlayers)
          skatAiPlay(currentTrickPlayer);
        else if (trickCards.length >= totalPlayers) {
          score += 10;
          if (_host) {
            _host.floatingText.add(CANVAS_W / 2, 300, '+10', { color: '#4f4', size: 18 });
            _host.onScoreChanged(score);
          }
          trickCards = [];
        }
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      skatHandCards = [[], [], [], []];
      doppelkopfTeams = [0, 0, 0, 0];
      trickCards = [];
      deck = [];
      roundOver = false;
      gameOver = false;
      aiTurnTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('doppelkopf', module);

})();
