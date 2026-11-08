/* Input: the mouse or a finger steers the paddle directly (its x mapped into the field), a click
   or tap launches a held ball and fires the lasers; the keyboard moves it with Left/Right or A/D,
   Space launches and fires, Esc/P pauses. In menus the pointer and the arrow keys work the hit
   areas; cinematics advance on click or key and skip on Esc. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;
  const C = NS.constants;
  const W = NS.widgets;
  const { canvas, toPlane } = NS.view;

  const keys = { left: false, right: false, fire: false };
  let pointerX = null, firing = false;

  function playing() {
    return G.run && !G.run.done && G.screen === 'game' && !G.cine;
  }

  /* the input for the next engine step */
  function state() {
    const inp = G.input;
    return {
      px: keys.left || keys.right ? null : pointerX,
      left: keys.left, right: keys.right,
      launch: inp.launch, fire: keys.fire || firing,
    };
  }

  function tapLaunch() {
    G.input.launch = true;
    firing = true;
    setTimeout(() => { firing = false; }, 120);
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
    if (playing()) {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = true;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = true;
      else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { G.input.launch = true; keys.fire = true; }
      else if (k === 'Escape' || k === 'p' || k === 'P') NS.screens.pause();
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
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
    else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') keys.fire = false;
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

  let press = null;

  function fieldX(x) {
    return Math.max(0, Math.min(C.FIELD_W, (x - C.FIELD_X) * (G.profile.settings.sensitivity || 1) + (1 - (G.profile.settings.sensitivity || 1)) * C.FIELD_W / 2));
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
    const hit = W.hitAt(p.x, p.y);
    if (playing() && hit < 0 && !G.ui.confirm) {
      pointerX = fieldX(p.x);
      G.input.launch = true;
      firing = true;
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
    if (playing() && (e.pointerType !== 'touch' || e.buttons) && G.profile.settings.mouse !== false) pointerX = fieldX(p.x);
  }

  function onUp(e) {
    firing = false;
    const p = toPlane(e.clientX, e.clientY);
    if (!press) return;
    const pr = press;
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
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
  }

  function reset() {
    pointerX = null;
    keys.left = keys.right = keys.fire = false;
  }

  Object.assign(NS.input, { state, tapLaunch, onKey, onKeyUp, onDown, onMove, onUp, attach, reset, keys });
})();
