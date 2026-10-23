/* Canvas pointer and keyboard input: settings panel intercept, menu hit tests,
   button toggles and forwarding to the active variant module. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const K = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  const G = NS.game;
  const OS = NS.os;
  const I = NS.input = NS.input || {};

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  I.handleCanvasClick = function(mx, my) {
    // Settings panel intercepts all clicks when open
    if (SZ.CardThemes?.settingsPanelOpen) {
      SZ.CardThemes.handleSettingsClick(mx, my);
      return;
    }

    if (S.state === K.STATE_MENU) {
      const btnW = 120;
      const btnH = 26;
      const gapX = 8;
      const gapY = 3;
      const cols = 6;
      const totalW = cols * btnW + (cols - 1) * gapX;
      const marginX = (K.CANVAS_W - totalW) / 2;
      const fieldsetGap = 4;
      const padTop = 10;
      const padBot = 4;

      let curY = 28;

      for (const cat of K.SORTED_CATS) {
        const rows = Math.ceil(cat.games.length / cols);
        const innerH = rows * (btnH + gapY) - gapY;
        const fieldH = padTop + innerH + padBot;

        for (let i = 0; i < cat.games.length; ++i) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const bx = marginX + col * (btnW + gapX);
          const by = curY + padTop + row * (btnH + gapY);
          if (CE.isInRect(mx, my, bx, by, btnW, btnH)) {
            E.sound('select');
            G.selectGame(cat.games[i].variant.id);
            return;
          }
        }

        curY += fieldH + fieldsetGap;
      }

      // Style button
      if (SZ.CardThemes) {
        if (CE.isInRect(mx, my, K.CANVAS_W / 2 - 48, curY, 96, 26)) {
          SZ.CardThemes.settingsPanelOpen = true;
          return;
        }
      }
      return;
    }

    if (S.state === K.STATE_ROUND_OVER || S.state === K.STATE_GAME_OVER) {
      if (S.state === K.STATE_GAME_OVER)
        G.initGame();
      else {
        ++S.roundNumber;
        G.selectGame(S.currentVariant.id);
      }
      return;
    }

    if (S.state !== K.STATE_PLAYING) return;

    // Style button hit test
    if (SZ.CardThemes && CE.isInRect(mx, my, K.STYLE_BTN.x, K.STYLE_BTN.y, K.STYLE_BTN.w, K.STYLE_BTN.h)) {
      SZ.CardThemes.settingsPanelOpen = true;
      return;
    }

    // Sort toggle hit test (only when variant supports it)
    if (S.activeVariantModule?.sortPlayerHand && CE.isInRect(mx, my, K.SORT_BTN.x, K.SORT_BTN.y, K.SORT_BTN.w, K.SORT_BTN.h)) {
      S.autoSortHand = !S.autoSortHand;
      try { localStorage.setItem(K.STORAGE_AUTOSORT, String(S.autoSortHand)); } catch (_) {}
      if (S.autoSortHand) S.activeVariantModule.sortPlayerHand();
      return;
    }

    // Hint toggle hit test
    if (CE.isInRect(mx, my, K.HINT_BTN.x, K.HINT_BTN.y, K.HINT_BTN.w, K.HINT_BTN.h)) {
      S.hintsEnabled = !S.hintsEnabled;
      try { localStorage.setItem(K.STORAGE_HINTS, String(S.hintsEnabled)); } catch (_) {}
      return;
    }

    // Menu button hit test
    if (CE.isInRect(mx, my, K.MENU_BTN.x, K.MENU_BTN.y, K.MENU_BTN.w, K.MENU_BTN.h)) {
      G.initGame();
      return;
    }

    // Forward to active variant module
    if (S.activeVariantModule) {
      E.sound('click', { volume: 0.7 });
      if (S.activeVariantModule.handleClick) S.activeVariantModule.handleClick(mx, my);
    }
  };

  let pointerDownAt = null;

  D.canvas.addEventListener('pointerdown', (e) => {
    const rect = D.canvas.getBoundingClientRect();
    const scaleX = K.CANVAS_W / rect.width;
    const scaleY = K.CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    pointerDownAt = { x: mx, y: my };
    I.handleCanvasClick(mx, my);
  });

  D.canvas.addEventListener('pointermove', (e) => {
    if (!S.activeVariantModule || !S.activeVariantModule.handlePointerMove) return;
    const rect = D.canvas.getBoundingClientRect();
    const scaleX = K.CANVAS_W / rect.width;
    const scaleY = K.CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    S.activeVariantModule.handlePointerMove(mx, my);
  });

  D.canvas.addEventListener('pointerup', (e) => {
    if (!S.activeVariantModule || !S.activeVariantModule.handlePointerUp) return;
    const rect = D.canvas.getBoundingClientRect();
    const scaleX = K.CANVAS_W / rect.width;
    const scaleY = K.CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    if (pointerDownAt && S.state === K.STATE_PLAYING && Math.hypot(mx - pointerDownAt.x, my - pointerDownAt.y) > 12)
      E.sound('drop', { volume: 0.6 });
    pointerDownAt = null;
    S.activeVariantModule.handlePointerUp(mx, my, e);
  });

  /* ══════════════════════════════════════════════════════════════════
     KEYBOARD HANDLING
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      if (S.currentVariant)
        G.selectGame(S.currentVariant.id);
      else
        G.initGame();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (S.state === K.STATE_PLAYING) {
        S.state = K.STATE_PAUSED;
        OS.updateWindowTitle();
      } else if (S.state === K.STATE_PAUSED) {
        S.state = K.STATE_PLAYING;
        OS.updateWindowTitle();
      }
      return;
    }

    if (S.state !== K.STATE_PLAYING) return;

    // Forward to active variant module
    if (S.activeVariantModule) {
      if (S.activeVariantModule.handleKey) S.activeVariantModule.handleKey(e);
    }
  });
})();
