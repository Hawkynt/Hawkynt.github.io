/* Keyboard shortcuts and the minefield pointer handling: reveal, flag, chord,
   touch tap and long-press. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const LED = NS.led;
  const SM = NS.smiley;
  const TI = NS.timer;
  const MI = NS.mines;
  const F = NS.field;
  const RV = NS.reveal;
  const GO = NS.gameover;
  const G = NS.game;
  const IN = NS.input;

  /* ---- Keyboard ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'F2') {
      e.preventDefault();
      G.newGame();
    }
    if (e.key === 'Escape') {
      SZ.Dialog.close('bestTimesBackdrop');
      SZ.Dialog.close('customBackdrop');
      SZ.Dialog.close('dlg-about');
      SZ.Dialog.close('statsBackdrop');
    }
  });

  /* ---- Pointer Handling ---- */
  const LONG_PRESS_MS = 450;
  const LONG_PRESS_SLOP = 10;

  IN.toggleMark = function toggleMark(r, c, flagOnly) {
    const data = S.grid[r][c];
    if (data.revealed)
      return;
    const wasFlagged = data.flagged;
    if (!data.flagged && (!data.question || flagOnly)) {
      data.flagged = true;
      data.question = false;
      ++S.flagCount;
    } else if (data.flagged) {
      data.flagged = false;
      --S.flagCount;
      if (S.marksEnabled && !flagOnly)
        data.question = true;
    } else {
      data.question = false;
    }
    F.renderCell(r, c);
    LED.updateMineCounter();
    SZ.GameAudio.play(data.flagged ? 'drop' : 'click', data.flagged ? { pitch: 1.4, volume: 0.6 } : undefined);
    if (data.flagged && !wasFlagged) {
      data.el.classList.add('flag-placed');
      data.el.addEventListener('animationend', function handler() {
        data.el.classList.remove('flag-placed');
        data.el.removeEventListener('animationend', handler);
      });
    }
  };

  IN.revealAt = function revealAt(r, c) {
    const data = S.grid[r][c];
    if (data.flagged || data.question || data.revealed)
      return;
    if (S.firstClick) {
      MI.placeMines(r, c);
      S.firstClick = false;
      S.gameStarted = true;
      TI.startTimer();
    }
    S.revealOriginR = r;
    S.revealOriginC = c;
    const before = S.revealedCount;
    RV.revealCell(r, c);
    if (!S.gameOver)
      SZ.GameAudio.play(S.revealedCount - before > 1 ? 'whoosh' : 'click');
    S.revealOriginR = -1;
    S.revealOriginC = -1;
    if (!S.gameOver)
      GO.checkWin();
  };

  /* Touch: a tap reveals, holding a cell flags or unflags it */
  IN.cancelTouchPress = function cancelTouchPress() {
    if (!S.touchPress)
      return;
    clearTimeout(S.touchPress.timer);
    S.touchPress = null;
    if (!S.gameOver)
      SM.setSmiley(C.FACE_NORMAL);
  };

  function onTouchDown(e, cell) {
    IN.cancelTouchPress();
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;
    const press = { id: e.pointerId, r, c, x: e.clientX, y: e.clientY, held: false, timer: 0 };
    press.timer = setTimeout(() => {
      press.held = true;
      if (S.gameOver)
        return;
      IN.toggleMark(r, c, true);
      SM.setSmiley(C.FACE_NORMAL);
      if (navigator.vibrate)
        try { navigator.vibrate(25); } catch (_) {}
    }, LONG_PRESS_MS);
    S.touchPress = press;
    if (!S.grid[r][c].revealed && !S.grid[r][c].flagged)
      SM.setSmiley(C.FACE_CLICK);
  }

  function onTouchUp(e) {
    const press = S.touchPress;
    if (!press || press.id !== e.pointerId)
      return;
    clearTimeout(press.timer);
    S.touchPress = null;
    if (S.gameOver)
      return;
    if (!press.held)
      IN.revealAt(press.r, press.c);
    if (!S.gameOver)
      SM.setSmiley(C.FACE_NORMAL);
  }

  D.minefield.addEventListener('pointermove', e => {
    if (S.touchPress && S.touchPress.id === e.pointerId && !S.touchPress.held
        && Math.hypot(e.clientX - S.touchPress.x, e.clientY - S.touchPress.y) > LONG_PRESS_SLOP)
      IN.cancelTouchPress();
  });
  D.minefield.addEventListener('pointercancel', e => {
    if (S.touchPress && S.touchPress.id === e.pointerId)
      IN.cancelTouchPress();
  });

  D.minefield.addEventListener('contextmenu', e => e.preventDefault());

  D.minefield.addEventListener('pointerdown', e => {
    if (S.gameOver)
      return;

    const cell = e.target.closest('.cell');
    if (!cell)
      return;

    if (e.pointerType === 'touch') {
      if (e.isPrimary)
        onTouchDown(e, cell);
      return;
    }

    if (e.button === 0) {
      S.leftDown = true;
      if (S.rightDown)
        S.bothDown = true;
    }
    if (e.button === 2) {
      S.rightDown = true;
      if (S.leftDown)
        S.bothDown = true;
    }
    if (e.button === 1)
      S.bothDown = true;

    if ((e.button === 0 && !S.bothDown) || S.bothDown)
      SM.setSmiley(C.FACE_CLICK);

    if (e.button === 2 && !S.leftDown)
      IN.toggleMark(+cell.dataset.r, +cell.dataset.c);
  });

  D.minefield.addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') {
      onTouchUp(e);
      return;
    }

    if (S.gameOver) {
      S.leftDown = false;
      S.rightDown = false;
      S.bothDown = false;
      return;
    }

    const cell = e.target.closest('.cell');
    if (!cell) {
      S.leftDown = false;
      S.rightDown = false;
      S.bothDown = false;
      SM.setSmiley(C.FACE_NORMAL);
      return;
    }

    const r = +cell.dataset.r;
    const c = +cell.dataset.c;

    if (S.bothDown) {
      // Chord action on release of either button
      if (e.button === 0)
        S.leftDown = false;
      if (e.button === 2)
        S.rightDown = false;
      if (e.button === 1 || !S.leftDown || !S.rightDown) {
        S.bothDown = false;
        S.leftDown = false;
        S.rightDown = false;

        if (S.firstClick) {
          MI.placeMines(r, c);
          S.firstClick = false;
          S.gameStarted = true;
          TI.startTimer();
        }

        S.revealOriginR = r;
        S.revealOriginC = c;
        const before = S.revealedCount;
        RV.chordCell(r, c);
        if (!S.gameOver && S.revealedCount > before)
          SZ.GameAudio.play(S.revealedCount - before > 3 ? 'whoosh' : 'click');
        S.revealOriginR = -1;
        S.revealOriginC = -1;
        if (!S.gameOver) {
          GO.checkWin();
          SM.setSmiley(S.gameOver ? (S.gameWon ? C.FACE_WIN : C.FACE_DEAD) : C.FACE_NORMAL);
        }
      }
      return;
    }

    if (e.button === 0) {
      S.leftDown = false;
      IN.revealAt(r, c);
      if (!S.gameOver)
        SM.setSmiley(C.FACE_NORMAL);
    }

    if (e.button === 2)
      S.rightDown = false;

    if (!S.leftDown && !S.rightDown && !S.gameOver)
      SM.setSmiley(C.FACE_NORMAL);
  });

  D.minefield.addEventListener('pointerleave', () => {
    if (!S.gameOver)
      SM.setSmiley(C.FACE_NORMAL);
  });
})();
