/* Input: keyboard for rotation/fire/hyperspace/pause/mode keys and dialog Escape,
   pointer for aiming, shooting, right-click thrust and mode-card clicks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      return;
    }

    /* Mode selection */
    if (S.modeSelectActive) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        NS.os.cycleFieldSize(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        NS.os.cycleFieldSize(1);
        return;
      }
      const modeKeys = { '1': 'classic', '2': 'survival', '3': 'zen', '4': 'hardcore' };
      if (modeKeys[e.key]) {
        e.preventDefault();
        S.modeSelectActive = false;
        NS.app.newGame(modeKeys[e.key]);
      }
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      NS.app.showModeSelect();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      NS.flow.togglePause();
      return;
    }

    S.keys[e.key] = true;

    if (e.key === ' ') e.preventDefault();

    if (!S.gameActive || S.gamePaused || S.gameOverFlag) return;

    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      NS.shooting.hyperspace();
    }
  });

  document.addEventListener('keyup', e => { S.keys[e.key] = false; });

  /* ── Click/Tap to start + mouse controls ── */
  D.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  D.canvas.addEventListener('pointerdown', (e) => {
    const pos = NS.os.canvasCoords(e);
    S.mouseX = pos.x;
    S.mouseY = pos.y;
    S.mouseActive = true;

    const isRight = e.button === 2;
    if (isRight)
      S.mouseRightDown = true;
    else
      S.mouseDown = true;

    /* Mode select: click a mode card to start (left only) */
    if (!isRight && S.modeSelectActive) {
      const modes = ['classic', 'survival', 'zen', 'hardcore'];
      const cardH = 56 * S.uiS;
      const cardW = 280 * S.uiS;
      const startY = 170 * S.uiS;
      const gap = 12 * S.uiS;
      const cardX = (S.W - cardW) / 2;

      for (let i = 0; i < modes.length; ++i) {
        const y = startY + i * (cardH + gap);
        if (pos.x >= cardX && pos.x <= cardX + cardW && pos.y >= y && pos.y <= y + cardH) {
          S.modeSelectActive = false;
          NS.app.newGame(modes[i]);
          return;
        }
      }

      /* Click field size arrows */
      const fieldY = 125 * S.uiS;
      if (pos.y >= fieldY - 15 * S.uiS && pos.y <= fieldY + 25 * S.uiS) {
        if (pos.x < S.W / 2)
          NS.os.cycleFieldSize(-1);
        else
          NS.os.cycleFieldSize(1);
      }
      return;
    }

    /* Game over / not active: show mode select (left only) */
    if (!isRight && (!S.gameActive || S.gameOverFlag)) {
      NS.app.showModeSelect();
      return;
    }

    /* In-game left click: shoot; right click: small thrust toward mouse */
    if (S.gameActive && !S.gamePaused && !S.gameOverFlag && !S.warpState) {
      if (!isRight)
        NS.shooting.shoot();
      else if (S.ship) {
        /* Single right-click = small thrust impulse toward cursor */
        const thrustAngle = Math.atan2(S.mouseY - S.ship.y, S.mouseX - S.ship.x);
        S.ship.vx += Math.cos(thrustAngle) * C.SHIP_THRUST * 0.5;
        S.ship.vy += Math.sin(thrustAngle) * C.SHIP_THRUST * 0.5;
      }
    }
  });

  D.canvas.addEventListener('pointermove', (e) => {
    const pos = NS.os.canvasCoords(e);
    S.mouseX = pos.x;
    S.mouseY = pos.y;
    S.mouseActive = true;
  });

  D.canvas.addEventListener('pointerup', (e) => {
    if (e.button === 2)
      S.mouseRightDown = false;
    else
      S.mouseDown = false;
  });
})();
