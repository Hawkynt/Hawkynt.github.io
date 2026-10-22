/* Input: pointer hover and clicks on the canvas for menu, deck builder and
   battle, and the keyboard shortcuts on the document. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;
  const D = NS.dom;
  const U = NS.util;

  D.canvas.addEventListener('pointermove', (e) => {
    const rect = D.canvas.getBoundingClientRect();
    S.mouseX = (e.clientX - rect.left) * (C.CANVAS_W / rect.width);
    S.mouseY = (e.clientY - rect.top) * (C.CANVAS_H / rect.height);

    if (S.state === C.STATE_PLAYING && S.isPlayerTurn) {
      S.hoveredCard = -1;
      for (let i = 0; i < S.playerHand.length; ++i) {
        const cx = U.getCardX(i, S.playerHand.length);
        if (Math.abs(S.mouseX - cx) < 40 && S.mouseY > 370 && S.mouseY < 475)
          S.hoveredCard = i;
      }
    } else {
      S.hoveredCard = -1;
    }
  });

  D.canvas.addEventListener('pointerdown', (e) => {
    const rect = D.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (C.CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (C.CANVAS_H / rect.height);

    if (S.state === C.STATE_MENU) {
      // Difficulty selection — coordinates must match drawMenuScreen()
      const diffs = [C.DIFF_EASY, C.DIFF_NORMAL, C.DIFF_HARD];
      for (let i = 0; i < 3; ++i) {
        const bx = C.CANVAS_W / 2 - 75;
        const by = 180 + i * 48;
        if (mx >= bx && mx <= bx + 150 && my >= by && my <= by + 38) {
          S.difficulty = diffs[i];
          SZ.GameAudio.play('click');
        }
      }

      // Start Game button — coordinates must match drawMenuScreen()
      // refY=340, elemY=refY+50=390, startBtnY=elemY+30=420
      const startBtnX = C.CANVAS_W / 2 - 75;
      const startBtnY = 420;
      const startBtnW = 150;
      const startBtnH = 38;
      if (mx >= startBtnX && mx <= startBtnX + startBtnW && my >= startBtnY && my <= startBtnY + startBtnH)
        NS.game.startNewGame();
      return;
    }

    if (S.state === C.STATE_DECK_BUILD) {
      // Click card to toggle
      const cols = 8;
      const cardW = 85;
      const cardH = 40;
      for (let i = 0; i < T.ALL_CARDS.length; ++i) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 30 + col * (cardW + 8);
        const y = 50 + row * (cardH + 6);
        if (mx >= x && mx <= x + cardW && my >= y && my <= y + cardH) {
          const card = T.ALL_CARDS[i];
          const idx = S.selectedDeck.indexOf(card.id);
          if (idx >= 0)
            NS.deckbuilder.removeCardFromDeck(idx);
          else
            NS.deckbuilder.addCardToDeck(card.id);
          return;
        }
      }
      return;
    }

    if (S.state !== C.STATE_PLAYING || !S.isPlayerTurn)
      return;

    // End turn button click
    const bx = C.CANVAS_W - 100, by = C.CANVAS_H / 2 - 20, bw = 80, bh = 30;
    if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
      NS.turn.endTurn();
      return;
    }

    // Card click
    if (S.hoveredCard >= 0)
      NS.game.playCard(S.hoveredCard);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      NS.game.startNewGame();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      NS.game.togglePause();
      return;
    }

    if (e.key === 'd' || e.key === 'D') {
      if (S.state === C.STATE_MENU || S.state === C.STATE_DECK_BUILD)
        NS.deckbuilder.toggleDeckBuilder();
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (S.state === C.STATE_MENU)
        NS.menu.handleAction('how-to-play');
      return;
    }

    if (S.state !== C.STATE_PLAYING || !S.isPlayerTurn)
      return;

    if (e.key === 'e' || e.key === 'E') {
      NS.turn.endTurn();
      return;
    }

    // Number keys 1-9 for hand cards
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9 && num <= S.playerHand.length)
      NS.game.playCard(num - 1);
  });
})();
