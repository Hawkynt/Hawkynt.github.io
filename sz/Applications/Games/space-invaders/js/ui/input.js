/* Keyboard and pointer input: held keys and mouse in G, playing keys (special, dash, pause),
   menu navigation and clicks; screen-specific keys go to their screens. Auto-pause. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { isMenuState } = NS.data;
  const { treeLevel } = NS.progress;
  const { canvas, canvasToGame } = NS.view;
  const { fireSpecial, tryDash } = NS.special;
  const { moveMenuCursor, activateMenuItem } = NS.widgets;
  const { quitToMenu, setScreen, openHelp } = NS.screens;
  const { onHangarKey } = NS.hangar;
  const { onArmoryKey, onArmoryPointer } = NS.armory;
  const { onHelpKey } = NS.help;

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => G.gameState === 'playing',
    pause: () => {
      G.gameState = 'paused';
      G.menuCursor = 0;
    }
  });

  document.addEventListener('keydown', (e) => {
    G.keys[e.code] = true;
    /* Keyboard input disables mouse movement to avoid conflicts */
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD')
      G.mouseActive = false;

    if (G.gameState === 'playing') {
      if (!e.repeat && (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')) {
        e.preventDefault();
        fireSpecial();
      }
      /* Double-tap left/right dashes, if the Dash Jets upgrade is owned */
      if (!e.repeat && treeLevel('e_dash') > 0) {
        let tapDir = 0;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') tapDir = -1;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') tapDir = 1;
        if (tapDir !== 0) {
          if (tapDir === G.lastTapDir && G.gameTime - G.lastTapTime <= 250)
            tryDash(tapDir);
          G.lastTapDir = tapDir;
          G.lastTapTime = G.gameTime;
        }
      }
    }

    if (e.key === 'F2') {
      e.preventDefault();
      setScreen('title');
      return;
    }

    /* ── Armory tech tree navigation ── */
    if (G.gameState === 'armory') {
      onArmoryKey(e);
      return;
    }

    /* ── Hangar: Left/Right pick the ship, Enter buys or selects it ── */
    if (G.gameState === 'hangar') {
      onHangarKey(e);
      return;
    }

    /* ── Help pages ── */
    if (G.gameState === 'help') {
      onHelpKey(e);
      return;
    }

    /* ── Menu screen navigation (all screens share the hit-area cursor) ── */
    if (isMenuState(G.gameState) || G.gameState === 'paused' || G.gameState === 'gameover' || G.gameState === 'stageClear') {
      onMenuKey(e);
      return;
    }

    if (e.code === 'Escape' && G.gameState === 'playing') {
      e.preventDefault();
      G.gameState = 'paused';
      G.menuCursor = 0;
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (G.gameState === 'playing') {
        G.gameState = 'paused';
        G.menuCursor = 0;
      } else if (G.gameState === 'paused')
        G.gameState = 'playing';
      return;
    }

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')
      e.preventDefault();
  });

  /* Menu screens and panels share the hit-area cursor */
  function onMenuKey(e) {
    e.preventDefault();
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA')
      moveMenuCursor(-1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD')
      moveMenuCursor(1);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')
      activateMenuItem(G.hitAreas[G.menuCursor]);
    else if (e.code === 'KeyH' && isMenuState(G.gameState))
      openHelp();
    else if (e.code === 'KeyP' && G.gameState === 'paused')
      G.gameState = 'playing';
    else if (e.code === 'Escape') {
      if (G.gameState === 'campaignMap')
        setScreen('title');
      else if (G.gameState === 'paused')
        G.gameState = 'playing';
      else if (G.gameState === 'stageClear')
        setScreen('campaignMap');
      else if (G.gameState === 'gameover')
        quitToMenu();
    }
  }

  document.addEventListener('keyup', (e) => {
    G.keys[e.code] = false;
  });

  /* ── Menu clicks + mouse controls ── */
  canvas.addEventListener('pointerdown', (e) => {
    /* the frame must keep keyboard focus after clicks */
    window.focus();

    /* Right mouse button fires the ship's special */
    if (e.button === 2) {
      if (G.gameState === 'playing')
        fireSpecial();
      return;
    }

    const p = canvasToGame(e.clientX, e.clientY);
    G.mouseX = p.x;
    G.mouseY = p.y;

    if (G.gameState === 'armory') {
      onArmoryPointer();
      return;
    }

    if (isMenuState(G.gameState) || G.gameState === 'paused' || G.gameState === 'gameover' || G.gameState === 'stageClear') {
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

    G.mouseGameX = p.x;
    G.mouseDown = true;
    G.mouseActive = true;
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = canvasToGame(e.clientX, e.clientY);
    G.mouseX = p.x;
    G.mouseY = p.y;
    G.mouseGameX = p.x;
    G.mouseActive = true;
  });

  canvas.addEventListener('pointerup', () => {
    G.mouseDown = false;
  });

  canvas.addEventListener('pointercancel', () => {
    G.mouseDown = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
})();
