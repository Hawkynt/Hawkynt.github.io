/* Pointer and keyboard routing in board space: cinematics swallow input while
   they run, the style panel and the lobby take their own clicks, the table
   buttons toggle hints/sort, everything else goes to the active variant. */
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

  I.pointer = { x: -1, y: -1, down: false };

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  I.handleCanvasClick = function(mx, my) {
    if (NS.scenes && NS.scenes.blocking()) {
      NS.scenes.skip();
      return;
    }

    // Settings panel intercepts all clicks when open
    if (SZ.CardThemes?.settingsPanelOpen) {
      SZ.CardThemes.handleSettingsClick(mx, my);
      return;
    }

    if (S.state === K.STATE_MENU) {
      const id = NS.lobby.click(mx, my);
      if (id) {
        E.sound('select');
        G.selectGame(id);
      }
      return;
    }

    if (S.state === K.STATE_ROUND_OVER || S.state === K.STATE_GAME_OVER) {
      if (S.state === K.STATE_GAME_OVER)
        G.initGame();
      else {
        ++S.roundNumber;
        G.selectGame(S.currentVariant.id, { nextRound: true });
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
      if (NS.outcomes) NS.outcomes.onPlayerAction();
      E.sound('click', { volume: 0.7 });
      if (S.activeVariantModule.handleClick) S.activeVariantModule.handleClick(mx, my);
    }
  };

  let pointerDownAt = null;

  function track(p) {
    I.pointer.x = p.x;
    I.pointer.y = p.y;
    CE.pointer.x = p.x;
    CE.pointer.y = p.y;
  }

  D.canvas.addEventListener('pointerdown', (e) => {
    const p = D.toBoard(e.clientX, e.clientY);
    track(p);
    I.pointer.down = true;
    CE.motion.pointerDown = true;
    pointerDownAt = { x: p.x, y: p.y };
    I.handleCanvasClick(p.x, p.y);
  });

  D.canvas.addEventListener('pointermove', (e) => {
    const p = D.toBoard(e.clientX, e.clientY);
    track(p);
    if (S.state === K.STATE_MENU) {
      NS.lobby.pointerMove(p.x, p.y);
      return;
    }
    if (NS.scenes && NS.scenes.blocking()) return;
    if (!S.activeVariantModule || !S.activeVariantModule.handlePointerMove) return;
    S.activeVariantModule.handlePointerMove(p.x, p.y);
  });

  function release(e) {
    I.pointer.down = false;
    CE.motion.pointerDown = false;
    if (!S.activeVariantModule || !S.activeVariantModule.handlePointerUp) return;
    if (NS.scenes && NS.scenes.blocking()) return;
    const p = D.toBoard(e.clientX, e.clientY);
    if (pointerDownAt && S.state === K.STATE_PLAYING && Math.hypot(p.x - pointerDownAt.x, p.y - pointerDownAt.y) > 12)
      E.sound('drop', { volume: 0.6 });
    pointerDownAt = null;
    S.activeVariantModule.handlePointerUp(p.x, p.y, e);
  }
  D.canvas.addEventListener('pointerup', release);
  D.canvas.addEventListener('pointercancel', () => { I.pointer.down = false; CE.motion.pointerDown = false; });

  /* ══════════════════════════════════════════════════════════════════
     KEYBOARD HANDLING
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
    if (NS.scenes && NS.scenes.blocking()) {
      e.preventDefault();
      NS.scenes.skip();
      return;
    }
    if (SZ.CardThemes?.settingsPanelOpen && e.key === 'Escape') {
      e.preventDefault();
      SZ.CardThemes.settingsPanelOpen = false;
      return;
    }
    if (S.state === K.STATE_MENU && e.key !== 'F2') {
      NS.lobby.key(e);
      return;
    }
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
      if (NS.outcomes) NS.outcomes.onPlayerAction();
      if (S.activeVariantModule.handleKey) S.activeVariantModule.handleKey(e);
    }
  });
})();
