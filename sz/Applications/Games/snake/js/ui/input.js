/* Keyboard and mouse/touch input: the key map with the direction queue, dialog
   closing on Escape and the pointer steering / swipe controls on the canvas. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { isOpposite } = NS.rules;

  /* ---- Keyboard Input ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      SZ.Dialog.close('optionsBackdrop');
      if (S.pausedForDialog) {
        S.gamePaused = false;
        S.pausedForDialog = false;
        S.lastMoveTime = performance.now();
      }
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      NS.options.showOptionsDialog();
      return;
    }

    if (e.key === ' ' && (S.waitingToStart || S.gameOverFlag)) {
      e.preventDefault();
      NS.options.showOptionsDialog();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      NS.game.togglePause();
      return;
    }

    if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.waitingToStart)
      return;

    let qDir = null;
    S.mouseControlActive = false; /* keyboard overrides mouse steering */
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': qDir = C.DIR.UP;    break;
      case 'ArrowDown':  case 's': case 'S': qDir = C.DIR.DOWN;  break;
      case 'ArrowLeft':  case 'a': case 'A': qDir = C.DIR.LEFT;  break;
      case 'ArrowRight': case 'd': case 'D': qDir = C.DIR.RIGHT; break;
    }
    if (qDir) {
      e.preventDefault();
      const ref = S.inputQueue.length > 0 ? S.inputQueue[S.inputQueue.length - 1] : S.direction;
      if (!isOpposite(qDir, ref) && S.inputQueue.length < 3)
        S.inputQueue.push(qDir);
    }
  });

  /* ---- Mouse / Touch controls ---- */
  function canvasMouseCoords(e) {
    const rect = D.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * S.canvasW,
      y: (e.clientY - rect.top) / rect.height * S.canvasH
    };
  }

  function mouseDirectionForSnake() {
    if (!S.mouseControlActive || S.snake.length === 0) return null;
    const head = S.snake[0];
    const hx = head.x * C.CELL + C.CELL / 2;
    const hy = head.y * C.CELL + C.CELL / 2;
    const dx = S.mouseCanvasX - hx;
    const dy = S.mouseCanvasY - hy;

    /* Ignore if cursor is very close to center of head */
    if (Math.abs(dx) < C.CELL * 0.4 && Math.abs(dy) < C.CELL * 0.4) return null;

    /* Pick the perpendicular turn toward the cursor */
    const ref = S.inputQueue.length > 0 ? S.inputQueue[S.inputQueue.length - 1] : S.direction;

    let qDir;
    if (Math.abs(dx) > Math.abs(dy))
      qDir = dx > 0 ? C.DIR.RIGHT : C.DIR.LEFT;
    else
      qDir = dy > 0 ? C.DIR.DOWN : C.DIR.UP;

    /* Don't queue reverse; prefer a perpendicular turn if the natural choice is a 180 */
    if (isOpposite(qDir, ref)) {
      if (Math.abs(dx) > Math.abs(dy))
        qDir = dy >= 0 ? C.DIR.DOWN : C.DIR.UP;
      else
        qDir = dx >= 0 ? C.DIR.RIGHT : C.DIR.LEFT;
    }
    return qDir;
  }

  {
    let touchStartX = 0, touchStartY = 0, touchId = null;
    const SWIPE_THRESHOLD = 20;

    D.canvas.addEventListener('pointerdown', (e) => {
      if (S.waitingToStart || S.gameOverFlag) {
        NS.options.showOptionsDialog();
        return;
      }
      touchStartX = e.clientX;
      touchStartY = e.clientY;
      touchId = e.pointerId;

      /* Activate mouse control on click */
      const pos = canvasMouseCoords(e);
      S.mouseCanvasX = pos.x;
      S.mouseCanvasY = pos.y;
      S.mouseControlActive = true;
    });

    D.canvas.addEventListener('pointermove', (e) => {
      const pos = canvasMouseCoords(e);
      S.mouseCanvasX = pos.x;
      S.mouseCanvasY = pos.y;
    });

    D.canvas.addEventListener('pointerup', (e) => {
      if (e.pointerId !== touchId) return;
      touchId = null;
      S.mouseControlActive = false;
      if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.waitingToStart) return;

      const dx = e.clientX - touchStartX;
      const dy = e.clientY - touchStartY;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

      let qDir;
      if (Math.abs(dx) > Math.abs(dy))
        qDir = dx > 0 ? C.DIR.RIGHT : C.DIR.LEFT;
      else
        qDir = dy > 0 ? C.DIR.DOWN : C.DIR.UP;

      const ref = S.inputQueue.length > 0 ? S.inputQueue[S.inputQueue.length - 1] : S.direction;
      if (!isOpposite(qDir, ref) && S.inputQueue.length < 3)
        S.inputQueue.push(qDir);
    });
  }

  Object.assign(NS.input, { canvasMouseCoords, mouseDirectionForSnake });
})();
