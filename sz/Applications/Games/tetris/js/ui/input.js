/* Input: the keyboard in play (Left/Right with auto-repeat after DAS at ARR, Down soft drop,
   Space hard drop, Up/X clockwise, Z/Ctrl counter-clockwise, A half turn, C/Shift hold, E power,
   Esc/P pause), touch in play (tap turns, horizontal drags move cell by cell, a downward drag
   soft drops, a quick flick down hard drops, a flick up holds), the mouse and arrow keys in menus
   through the hit areas, and cinematics (click: next, any key or Esc: skip). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.engine;
  const W = NS.widgets;
  const { CELL } = C;
  const { canvas, toPlane } = NS.view;

  const held = { left: false, right: false, down: false };
  let dir = 0, dasT = 0, arrT = 0;
  let touch = null;

  function game() {
    return G.run && !G.run.done && G.screen === 'game' && !G.cine ? G.run.game : null;
  }

  function act(name) {
    const g = game();
    if (!g) return false;
    switch (name) {
      case 'left': return NS.run.engineOf(g).move(g, -1);
      case 'right': return NS.run.engineOf(g).move(g, 1);
      case 'cw': return NS.run.engineOf(g).rotate(g, 1);
      case 'ccw': return NS.run.engineOf(g).rotate(g, -1);
      case '180': return NS.run.engineOf(g).rotate(g, 2);
      case 'hold': return NS.run.engineOf(g).holdPiece(g);
      case 'drop': return NS.run.engineOf(g).hardDrop(g);
    }
    return false;
  }

  function usePower(i) {
    if (!game()) return false;
    return NS.powers.use(G.run, i || 0);
  }

  function softHeld() {
    return held.down || !!(touch && touch.soft);
  }

  /* auto-repeat of the held direction */
  function repeat(dt) {
    if (!dir) return;
    const s = G.profile.settings;
    dasT += dt;
    if (dasT < (s.das || C.DAS)) return;
    arrT += dt;
    const arr = s.arr || C.ARR;
    while (arrT >= arr) {
      arrT -= arr;
      if (!act(dir < 0 ? 'left' : 'right')) break;
    }
  }

  function press(d) {
    dir = d;
    dasT = 0;
    arrT = 0;
    act(d < 0 ? 'left' : 'right');
  }

  function onKey(e) {
    const k = e.key;
    if (k === ' ' || k.indexOf('Arrow') === 0 || k === 'Tab') e.preventDefault();
    if (G.cine) {
      if (!e.repeat) {
        if (k === 'Escape') NS.cine.skip();
        else NS.cine.next();
      }
      return;
    }
    if (k === 'F2') {
      e.preventDefault();
      if (G.run && !G.run.done) NS.save.saveRun(G.run);
      NS.screens.setScreen('title');
      return;
    }
    if (G.ui.confirm) {
      if (k === 'Escape') G.ui.confirm = null;
      else if (k === 'Enter' || k === ' ') activate();
      else if (k.indexOf('Arrow') === 0) arrows(k);
      return;
    }
    if (G.screen === 'game' && G.run && !G.run.done) {
      if (e.repeat && k !== 'ArrowDown') return;
      switch (k) {
        case 'ArrowLeft': held.left = true; press(-1); break;
        case 'ArrowRight': held.right = true; press(1); break;
        case 'ArrowDown': held.down = true; break;
        case ' ': act('drop'); break;
        case 'ArrowUp': case 'x': case 'X': act('cw'); break;
        case 'z': case 'Z': case 'Control': act('ccw'); break;
        case 'a': case 'A': act('180'); break;
        case 'c': case 'C': case 'Shift': act('hold'); break;
        case 'e': case 'E': usePower(0); break;
        case 'Escape': case 'p': case 'P': NS.screens.pause(); break;
      }
      return;
    }
    if (k.indexOf('Arrow') === 0) arrows(k);
    else if (k === 'Enter' || k === ' ') activate();
    else if (k === 'Escape') {
      if (G.screen === 'paused') NS.screens.resume();
      else if (G.screen !== 'title' && G.screen !== 'results') NS.screens.back();
    } else if (G.screen === 'paused' && (k === 'p' || k === 'P')) NS.screens.resume();
  }

  function onKeyUp(e) {
    const k = e.key;
    if (k === 'ArrowLeft') { held.left = false; dir = held.right ? 1 : 0; dasT = arrT = 0; }
    else if (k === 'ArrowRight') { held.right = false; dir = held.left ? -1 : 0; dasT = arrT = 0; }
    else if (k === 'ArrowDown') held.down = false;
  }

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

  let press0 = null;

  function onDown(e) {
    const p = toPlane(e.clientX, e.clientY);
    const inp = G.input;
    inp.touch = e.pointerType === 'touch';
    inp.mx = p.x;
    inp.my = p.y;
    inp.moved = inp.touch ? 0 : 1;
    if (canvas.focus) canvas.focus();
    press0 = null;
    if (G.cine) {
      NS.cine.next();
      return;
    }
    const hit = W.hitAt(p.x, p.y);
    if (game() && hit < 0 && !G.ui.confirm) {
      touch = { x: p.x, y: p.y, x0: p.x, t: performance.now(), moved: false, soft: false };
      return;
    }
    press0 = { x: p.x, y: p.y, button: e.button };
  }

  function onMove(e) {
    const p = toPlane(e.clientX, e.clientY);
    const inp = G.input;
    inp.mx = p.x;
    inp.my = p.y;
    if (e.pointerType !== 'touch') { inp.touch = false; inp.moved = 1; }
    if (touch && game()) {
      const dx = p.x - touch.x;
      while (Math.abs(p.x - touch.x) >= CELL) {
        const d = p.x > touch.x ? 1 : -1;
        act(d > 0 ? 'right' : 'left');
        touch.x += d * CELL;
        touch.moved = true;
      }
      if (p.y - touch.y > CELL * 1.2 && Math.abs(dx) < CELL) { touch.soft = true; touch.moved = true; }
    }
  }

  function onUp(e) {
    const p = toPlane(e.clientX, e.clientY);
    if (touch) {
      const t = touch;
      touch = null;
      if (!game()) return;
      const dt = (performance.now() - t.t) / 1000;
      const dy = p.y - t.y, dx = p.x - t.x0;
      if (dt < 0.3 && dy > 80 && Math.abs(dx) < 60) act('drop');
      else if (dt < 0.3 && dy < -80 && Math.abs(dx) < 60) act('hold');
      else if (!t.moved && Math.abs(dx) < 10 && Math.abs(dy) < 10) act(e.button === 2 ? 'ccw' : 'cw');
      return;
    }
    if (!press0) return;
    const pr = press0;
    press0 = null;
    const hit = W.hitAt(p.x, p.y);
    if (hit < 0) return;
    G.menuCursor = hit;
    W.activate(G.hitAreas[hit], pr.button === 2);
  }

  function attach() {
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
  }

  Object.assign(NS.input, { act, usePower, softHeld, repeat, onKey, onKeyUp, onDown, onMove, onUp, attach, held });
})();
