/* Input. Mouse, as in the classic game: the left button presses a cell down and opens it on release
   (releasing on an open number chords it), the right button plants a flag (then a question mark,
   when marks are on) the moment it goes down, both buttons together or the middle button press a
   number's neighbours and chord on release. Touch: a tap opens (or flags in flag mode), a long
   press flags, a tap on an open number chords. Keyboard: arrows or WASD move a cell cursor, Space
   or Enter opens (chords on an open number), F flags, C chords, E or 1-5 use powers, F2 starts a
   new game, Esc or P pauses. In menus the pointer and the arrow keys work the hit areas;
   cinematics advance on click or key and skip on Esc. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;
  const W = NS.widgets;
  const C = NS.constants;
  const B = NS.board;
  const { canvas, toPlane } = NS.view;

  let press = null, buttons = 0, longT = null;

  function playing() {
    return G.run && !G.run.done && G.screen === 'game' && !G.cine;
  }

  function field() {
    return G.run && G.run.game;
  }

  function cellAt(x, y) {
    const g = field();
    return g ? NS.boardRender.cellAt(g, x, y) : -1;
  }

  /* the cells drawn pressed down while a button is held */
  function pressedCells() {
    const inp = G.input;
    const g = field();
    if (!g || !inp.down || inp.downCell < 0) return null;
    const i = inp.hoverCell;
    if (i < 0) return null;
    if (inp.chordPress) return [i].concat(B.neighbours(g.w, g.h)[i]);
    return g.open[i] ? null : [i];
  }

  function moveCursor(dx, dy) {
    const g = field();
    if (!g) return;
    const inp = G.input;
    if (inp.cursor < 0) inp.cursor = Math.floor(g.h / 2) * g.w + Math.floor(g.w / 2);
    else {
      const x = Math.max(0, Math.min(g.w - 1, inp.cursor % g.w + dx)), y = Math.max(0, Math.min(g.h - 1, Math.floor(inp.cursor / g.w) + dy));
      inp.cursor = y * g.w + x;
    }
  }

  /* open, or chord when the cell is an open number */
  function primary(i) {
    const g = field();
    if (!g || i < 0) return;
    if (g.open[i]) NS.play.act('chord', i);
    else NS.play.act('reveal', i);
  }

  function onKey(e) {
    const k = e.key;
    if (k === ' ' || k.indexOf('Arrow') === 0) e.preventDefault();
    if (G.cine) {
      if (!e.repeat) { if (k === 'Escape') NS.cine.skip(); else NS.cine.next(); }
      return;
    }
    if (k === 'F2') {
      e.preventDefault();
      if (G.run && (G.screen === 'game' || G.screen === 'results')) NS.play.restart();
      return;
    }
    if (G.ui.confirm) {
      if (k === 'Escape') G.ui.confirm = null;
      else if (k === 'Enter' || k === ' ') activate();
      else if (k.indexOf('Arrow') === 0) arrows(k);
      return;
    }
    if (playing()) {
      const g = field();
      const inp = G.input;
      switch (k) {
        case 'ArrowLeft': case 'a': case 'A': moveCursor(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D': moveCursor(1, 0); break;
        case 'ArrowUp': case 'w': case 'W': moveCursor(0, -1); break;
        case 'ArrowDown': case 's': case 'S': moveCursor(0, 1); break;
        case ' ': case 'Enter': if (inp.cursor < 0) moveCursor(0, 0); else primary(inp.cursor); break;
        case 'f': case 'F': if (inp.cursor >= 0) NS.play.act('flag', inp.cursor); break;
        case 'c': case 'C': if (inp.cursor >= 0) NS.play.act('chord', inp.cursor); break;
        case 'e': case 'E': NS.play.usePower(0); break;
        case 'Escape': case 'p': case 'P': NS.screens.pause(); break;
        default:
          if (k >= '1' && k <= '5') NS.play.usePower(+k - 1);
      }
      if (g && inp.cursor >= g.w * g.h) inp.cursor = -1;
      return;
    }
    if (k.indexOf('Arrow') === 0) arrows(k);
    else if (k === 'Enter' || k === ' ') activate();
    else if (k === 'Escape') {
      if (G.screen === 'paused') NS.screens.resume();
      else if (G.screen !== 'title' && G.screen !== 'results') NS.screens.back();
    } else if (G.screen === 'paused' && (k === 'p' || k === 'P')) NS.screens.resume();
  }

  function onKeyUp() {}

  function arrows(k) {
    if (k === 'ArrowUp') W.moveCursorDir(0, -1);
    else if (k === 'ArrowDown') W.moveCursorDir(0, 1);
    else if (k === 'ArrowLeft') W.moveCursorDir(-1, 0);
    else W.moveCursorDir(1, 0);
  }

  function activate() {
    const it = G.hitAreas[G.menuCursor];
    if (it) W.activate(it);
  }

  function onDown(e) {
    const p = toPlane(e.clientX, e.clientY);
    const inp = G.input;
    inp.touch = e.pointerType === 'touch';
    inp.mx = p.x;
    inp.my = p.y;
    inp.moved = inp.touch ? 0 : 1;
    if (canvas.focus) canvas.focus();
    press = null;
    if (G.cine) { NS.cine.next(); return; }
    buttons |= 1 << (e.button === 2 ? 2 : e.button === 1 ? 1 : 0);
    const hit = W.hitAt(p.x, p.y);
    const cell = hit < 0 && playing() ? cellAt(p.x, p.y) : -1;
    inp.hoverCell = cell;
    if (cell >= 0) {
      inp.cursor = -1;
      if (inp.touch) {
        press = { x: p.x, y: p.y, cell: cell, touch: true, id: e.pointerId };
        inp.down = true;
        inp.downCell = cell;
        clearTimeout(longT);
        longT = setTimeout(() => {
          if (press && press.id === e.pointerId && press.cell === cell) {
            NS.play.act('flag', cell);
            if (navigator.vibrate) try { navigator.vibrate(30); } catch (_) {}
            press = null;
            inp.down = false;
          }
        }, C.LONG_PRESS * 1000);
        return;
      }
      if (e.button === 2 && !(buttons & 1)) { NS.play.act('flag', cell); return; }
      inp.down = true;
      inp.downCell = cell;
      inp.chordPress = e.button === 1 || (buttons & 5) === 5;
      press = { x: p.x, y: p.y, cell: cell };
      return;
    }
    press = { x: p.x, y: p.y, button: e.button };
  }

  function onMove(e) {
    const p = toPlane(e.clientX, e.clientY);
    const inp = G.input;
    inp.mx = p.x;
    inp.my = p.y;
    if (e.pointerType !== 'touch') { inp.touch = false; inp.moved = 1; }
    inp.hoverCell = playing() && W.hitAt(p.x, p.y) < 0 ? cellAt(p.x, p.y) : -1;
    if (press && press.touch && Math.hypot(p.x - press.x, p.y - press.y) > 14) { press = null; inp.down = false; clearTimeout(longT); }
  }

  function onUp(e) {
    const inp = G.input;
    const bit = 1 << (e.button === 2 ? 2 : e.button === 1 ? 1 : 0);
    const p = toPlane(e.clientX, e.clientY);
    const pr = press;
    const wasChord = inp.chordPress;
    if (!(e.buttons & 5)) { inp.down = false; inp.chordPress = false; }
    buttons &= ~bit;
    if (e.type === 'pointercancel') { buttons = 0; press = null; inp.down = false; clearTimeout(longT); return; }
    clearTimeout(longT);
    if (!pr) return;
    if (pr.cell != null) {
      const cell = playing() ? cellAt(p.x, p.y) : -1;
      press = buttons ? press : null;
      if (cell < 0) return;
      if (pr.touch) {
        const g = field();
        if (g && g.open[cell]) NS.play.act('chord', cell);
        else if (inp.flagMode) NS.play.act('flag', cell);
        else NS.play.act('reveal', cell);
        return;
      }
      if (wasChord) { NS.play.act('chord', cell); return; }
      if (bit === 1) primary(cell);
      return;
    }
    press = null;
    const hit = W.hitAt(p.x, p.y);
    if (hit < 0) return;
    G.menuCursor = hit;
    W.activate(G.hitAreas[hit], pr.button === 2);
  }

  function attach() {
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
  }

  function reset() {
    press = null;
    buttons = 0;
    G.input.down = false;
    G.input.chordPress = false;
  }

  Object.assign(NS.input, { onKey, onKeyUp, onDown, onMove, onUp, attach, reset, pressedCells, moveCursor, primary });
})();
