/*
 * Input: auto-pause on hidden tab, keyboard (help overlay, Workshop, menus, race
 * keys) and pointer (menu clicks, tree clicks, mouse steering, right-click item).
 * Writes G.keys, G.keyJustPressed and the mouse fields in G.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { STATE_TREE, STATE_PLAYING, STATE_PAUSED } = NS.constants;
  const { TREE, trackVariant, TUTORIAL_PAGES } = NS.defs;
  const { canvas } = NS.runtime;
  const { treeNodeById, buyNode } = NS.progress;
  const { resetGame } = NS.raceSetup;
  const { usePlayerItem } = NS.items;
  const { enterGarage, pauseRacing, enterTree, leaveTree, isMenuState, menuEscape } = NS.flow;
  const { moveMenuCursor, activateMenuItem } = NS.menuKit;
  const { buildTreeLayout, selectFirstInBranch, moveTreeSelection } = NS.treeScreen;

  /* Registers every input listener; called once by app.js at startup */
  function attach() {
    /* Pause when the window is hidden or loses focus */
    SZ.GameAutoPause.attach({
      isRunning: () => G.state === STATE_PLAYING,
      pause: () => {
        pauseRacing();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (G.keys[e.code]) return; // Ignore key repeat
      G.keys[e.code] = true;
      G.keyJustPressed[e.code] = true;
      G.mouseControlActive = false; // keyboard overrides mouse steering

      /* Tutorial navigation */
      if (G.showTutorial) {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
          e.preventDefault();
          ++G.tutorialPage;
          if (G.tutorialPage >= TUTORIAL_PAGES.length)
            G.showTutorial = false;
          return;
        }
        if (e.code === 'ArrowLeft' && G.tutorialPage > 0) {
          e.preventDefault();
          --G.tutorialPage;
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          G.showTutorial = false;
          return;
        }
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        if (G.state === STATE_PLAYING || G.state === STATE_PAUSED || isMenuState(G.state)) {
          G.showTutorial = !G.showTutorial;
          G.tutorialPage = 0;
          return;
        }
      }

      // ── Workshop tree navigation ──
      if (G.state === STATE_TREE) {
        e.preventDefault();
        if (e.code === 'Escape') {
          leaveTree();
        } else if (e.code === 'Tab') {
          G.treeBranch = (G.treeBranch + 1) % TREE.branches.length;
          if (!G.treeLayout) G.treeLayout = buildTreeLayout();
          selectFirstInBranch();
          SZ.GameAudio.play('click', { volume: 0.5 });
        } else if (e.code >= 'Digit1' && e.code <= 'Digit5') {
          const b = Number(e.code.slice(5)) - 1;
          if (b < TREE.branches.length) {
            G.treeBranch = b;
            if (!G.treeLayout) G.treeLayout = buildTreeLayout();
            selectFirstInBranch();
            SZ.GameAudio.play('click', { volume: 0.5 });
          }
        } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          moveTreeSelection(-1, 0);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          moveTreeSelection(1, 0);
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          moveTreeSelection(0, -1);
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          moveTreeSelection(0, 1);
        } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
          const node = treeNodeById(G.treeSelected);
          if (node && buyNode(node))
            G.treeBuyFlash = { id: node.id, at: G.globalTime };
        }
        return;
      }

      // ── Menu screen navigation (all screens share the hit-area cursor) ──
      if (isMenuState(G.state) || G.state === STATE_PAUSED) {
        e.preventDefault();
        if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA')
          moveMenuCursor(-1);
        else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD')
          moveMenuCursor(1);
        else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')
          activateMenuItem(G.hitAreas[G.menuCursor]);
        else if (e.code === 'Escape')
          menuEscape();
        return;
      }

      // ── Normal game controls ──
      if (e.code === 'F2') {
        e.preventDefault();
        G.raceCup = null;
        G.currentVariant = trackVariant(G.currentTrackIndex, false);
        resetGame();
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        if (isMenuState(G.state))
          enterGarage();
      }

      if (e.code === 'F3') {
        e.preventDefault();
        if (isMenuState(G.state))
          enterTree();
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (G.state === STATE_PLAYING)
          pauseRacing();
      }

      if (e.code === 'KeyE')
        usePlayerItem();
    });

    window.addEventListener('keyup', (e) => {
      G.keys[e.code] = false;
    });

    /* ── Menu clicks + mouse steering ── */
    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      // backing pixels per CSS pixel: lower than devicePixelRatio when the render scale drops
      const dpr = canvas.width / Math.max(1, rect.width);
      G.mouseX = ((e.clientX - rect.left) * dpr - G.viewOffX) / G.viewScale;
      G.mouseY = ((e.clientY - rect.top) * dpr - G.viewOffY) / G.viewScale;

      if (G.showTutorial) {
        ++G.tutorialPage;
        if (G.tutorialPage >= TUTORIAL_PAGES.length)
          G.showTutorial = false;
        return;
      }
      if (G.state === STATE_TREE) {
        if (!G.treeLayout) G.treeLayout = buildTreeLayout();
        for (const tab of G.treeLayout.tabs) {
          if (G.mouseX >= tab.x && G.mouseX <= tab.x + tab.w && G.mouseY >= tab.y && G.mouseY <= tab.y + tab.h) {
            G.treeBranch = tab.index;
            selectFirstInBranch();
            SZ.GameAudio.play('click', { volume: 0.5 });
            return;
          }
        }
        for (const card of G.treeLayout.cards) {
          if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h) {
            G.treeSelected = card.node.id;
            if (buyNode(card.node))
              G.treeBuyFlash = { id: card.node.id, at: G.globalTime };
            return;
          }
        }
        return;
      }
      if (isMenuState(G.state) || G.state === STATE_PAUSED) {
        for (let i = 0; i < G.hitAreas.length; ++i) {
          const a = G.hitAreas[i];
          if (G.mouseX >= a.x && G.mouseX <= a.x + a.w && G.mouseY >= a.y && G.mouseY <= a.y + a.h) {
            G.menuCursor = i;
            activateMenuItem(a);
            return;
          }
        }
        return;
      }
      if (e.button === 2) { // right button uses the held item instead of steering
        usePlayerItem();
        return;
      }
      G.mouseDown = true;
      G.mouseControlActive = true;
    });

    canvas.addEventListener('pointermove', (e) => {
      // keep the logical cursor position for every screen; only racing steers with it
      const rect = canvas.getBoundingClientRect();
      // backing pixels per CSS pixel: lower than devicePixelRatio when the render scale drops
      const dpr = canvas.width / Math.max(1, rect.width);
      G.mouseX = ((e.clientX - rect.left) * dpr - G.viewOffX) / G.viewScale;
      G.mouseY = ((e.clientY - rect.top) * dpr - G.viewOffY) / G.viewScale;
    });

    canvas.addEventListener('pointerup', () => {
      G.mouseDown = false;
      G.mouseControlActive = false;
    });

    canvas.addEventListener('pointercancel', () => {
      G.mouseDown = false;
      G.mouseControlActive = false;
    });

    /* the right mouse button fires the held item, so keep the browser menu away */
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  Object.assign(NS.module('input'), {
    attach
  });
})();
