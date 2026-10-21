/* Keyboard and pointer input: the keydown/keyup handlers, the click-and-hold
   mouse control on the canvas and the canvas-to-world coordinate mapping. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const I = NS.input;

  window.addEventListener('keydown', (e) => {
    S.keys[e.code] = true;

    if (e.key === 'F2') {
      e.preventDefault();
      NS.flow.resetGame();
      return;
    }

    /* Tutorial navigation */
    if (S.showTutorial) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        ++S.tutorialPage;
        if (S.tutorialPage >= T.TUTORIAL_PAGES.length)
          S.showTutorial = false;
        return;
      }
      if (e.code === 'ArrowLeft' && S.tutorialPage > 0) {
        e.preventDefault();
        --S.tutorialPage;
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        S.showTutorial = false;
        return;
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (S.shopOpen) {
        S.shopOpen = false;
        return;
      }
      if (S.state === C.STATE_PLAYING)
        S.state = C.STATE_PAUSED;
      else if (S.state === C.STATE_PAUSED)
        S.state = C.STATE_PLAYING;
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (S.state === C.STATE_PLAYING || S.state === C.STATE_PAUSED) {
        S.showTutorial = !S.showTutorial;
        S.tutorialPage = 0;
        return;
      }
    }

    if (S.state === C.STATE_READY && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      NS.flow.resetGame();
      return;
    }

    if (S.state === C.STATE_PLAYING && e.code === 'KeyE') {
      const dist = Math.hypot(S.ship.x - C.STATION_X, S.ship.y - C.STATION_Y);
      if (dist < C.STATION_DOCK_RANGE) {
        if (!S.shopOpen) {
          NS.economy.sellCargo();
          S.shopOpen = true;
          S.shopSelection = 0;
          SZ.GameAudio.play('select');
        } else {
          S.shopOpen = false;
          SZ.GameAudio.play('click');
        }
      }
      return;
    }

    /* Shop keyboard controls */
    if (S.shopOpen && S.state === C.STATE_PLAYING) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        S.shopSelection = (S.shopSelection - 1 + T.UPGRADE_KEYS.length) % T.UPGRADE_KEYS.length;
        SZ.GameAudio.play('click');
        return;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        S.shopSelection = (S.shopSelection + 1) % T.UPGRADE_KEYS.length;
        SZ.GameAudio.play('click');
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        NS.economy.buyUpgrade(T.UPGRADE_KEYS[S.shopSelection]);
        return;
      }
      /* Quick buy by number key */
      const numKey = parseInt(e.key);
      if (numKey >= 1 && numKey <= T.UPGRADE_KEYS.length) {
        e.preventDefault();
        S.shopSelection = numKey - 1;
        NS.economy.buyUpgrade(T.UPGRADE_KEYS[numKey - 1]);
        return;
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    S.keys[e.code] = false;
  });

  /* ── Click/Tap to start + mouse-driven gameplay ── */
  D.canvas.addEventListener('pointerdown', (e) => {
    I.updateMouseWorld(e);

    if (S.showTutorial) {
      ++S.tutorialPage;
      if (S.tutorialPage >= T.TUTORIAL_PAGES.length)
        S.showTutorial = false;
      return;
    }
    if (S.state === C.STATE_READY || S.state === C.STATE_GAME_OVER) {
      NS.flow.resetGame();
      return;
    }
    /* Shop click handling */
    if (S.shopOpen && S.state === C.STATE_PLAYING) {
      const mx = S.mouseCanvasX;
      const my = S.mouseCanvasY;

      const panelW = 320;
      const panelX = C.CANVAS_W / 2 - panelW / 2;
      const panelY = 60;
      const rowH = 28;
      const startY = panelY + 50;

      /* Close button */
      const closeBtnX = panelX + panelW / 2 - 40;
      const closeBtnY = startY + T.UPGRADE_KEYS.length * rowH + 34;
      if (mx >= closeBtnX && mx <= closeBtnX + 80 && my >= closeBtnY && my <= closeBtnY + 22) {
        S.shopOpen = false;
        return;
      }

      /* Click outside panel to close */
      const panelH = 50 + T.UPGRADE_KEYS.length * rowH + 60;
      if (mx < panelX || mx > panelX + panelW || my < panelY || my > panelY + panelH) {
        S.shopOpen = false;
        return;
      }

      for (let i = 0; i < T.UPGRADE_KEYS.length; ++i) {
        const ry = startY + i * rowH;
        if (mx >= panelX && mx <= panelX + panelW && my >= ry && my <= ry + rowH) {
          S.shopSelection = i;
          NS.economy.buyUpgrade(T.UPGRADE_KEYS[i]);
          break;
        }
      }
      return;
    }

    /* In-game mouse controls */
    if (S.state === C.STATE_PLAYING && !S.shopOpen) {
      S.mouseDown = true;
      S.mouseActive = true;

      /* Click near station to dock/sell */
      const distToStation = Math.hypot(S.mouseWorldX - C.STATION_X, S.mouseWorldY - C.STATION_Y);
      if (distToStation < C.STATION_DOCK_RANGE) {
        const shipDistToStation = Math.hypot(S.ship.x - C.STATION_X, S.ship.y - C.STATION_Y);
        if (shipDistToStation < C.STATION_DOCK_RANGE) {
          NS.economy.sellCargo();
          S.shopOpen = true;
          S.shopSelection = 0;
          SZ.GameAudio.play('select');
          S.mouseDown = false;
          S.mouseActive = false;
          return;
        }
      }
    }
  });

  D.canvas.addEventListener('pointermove', (e) => {
    if (!S.mouseDown) return;
    I.updateMouseWorld(e);
  });

  D.canvas.addEventListener('pointerup', () => {
    S.mouseDown = false;
    S.mouseActive = false;
    S.mouseDrilling = false;
  });

  D.canvas.addEventListener('pointerleave', () => {
    S.mouseDown = false;
    S.mouseActive = false;
    S.mouseDrilling = false;
  });

  /* ── Mouse helpers ── */
  I.canvasToWorld = function canvasToWorld(cx, cy) {
    return { x: cx + S.camera.x, y: cy + S.camera.y };
  };

  I.updateMouseWorld = function updateMouseWorld(e) {
    const rect = D.canvas.getBoundingClientRect();
    const scaleX = C.CANVAS_W / rect.width;
    const scaleY = C.CANVAS_H / rect.height;
    S.mouseCanvasX = (e.clientX - rect.left) * scaleX;
    S.mouseCanvasY = (e.clientY - rect.top) * scaleY;
    const w = I.canvasToWorld(S.mouseCanvasX, S.mouseCanvasY);
    S.mouseWorldX = w.x;
    S.mouseWorldY = w.y;
  };
})();
