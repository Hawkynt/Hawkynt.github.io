/* Input: Left/Right or A/D run, Up/W/Z jump (held to bounce on bubbles), Space/X blow bubbles
   (held to keep blowing), Esc/P pause; on touch screens four big buttons - left, right, jump and
   blow - that work while held. In menus the pointer and the arrow keys work the hit areas;
   cinematics advance on click or key and skip on Esc. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const G = NS.state;
  const W = NS.widgets;
  const kit = NS.kit;
  const { UI } = NS.constants;
  const { canvas, toPlane, ctx } = NS.view;

  const keys = { left: false, right: false, jump: false, shoot: false };
  const touch = { left: false, right: false, jump: false, shoot: false };
  const ZONES = { left: [30, 610, 110, 90], right: [150, 610, 110, 90], jump: [1010, 610, 110, 90], shoot: [1130, 610, 110, 90] };
  const pointers = {};

  function playing() {
    return G.run && !G.run.done && G.screen === 'game' && !G.cine;
  }

  function state() {
    return { left: keys.left || touch.left, right: keys.right || touch.right, jump: keys.jump || touch.jump, shoot: keys.shoot || touch.shoot || !!G.profile.settings.autofire };
  }

  function map(k) {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'z' || k === 'Z') return 'jump';
    if (k === ' ' || k === 'x' || k === 'X' || k === 'Control') return 'shoot';
    return null;
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
      const m = map(k);
      if (m) keys[m] = true;
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
    const m = map(e.key);
    if (m) keys[m] = false;
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

  function zoneAt(x, y) {
    for (const z in ZONES) { const r = ZONES[z]; if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return z; }
    return null;
  }

  function refreshTouch() {
    touch.left = touch.right = touch.jump = touch.shoot = false;
    for (const id in pointers) if (pointers[id]) touch[pointers[id]] = true;
  }

  let press = null;

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
    if (playing() && inp.touch) {
      const z = zoneAt(p.x, p.y);
      if (z) { pointers[e.pointerId] = z; refreshTouch(); return; }
    }
    press = { x: p.x, y: p.y, button: e.button };
  }

  function onMove(e) {
    const p = toPlane(e.clientX, e.clientY);
    G.input.mx = p.x;
    G.input.my = p.y;
    if (e.pointerType !== 'touch') { G.input.touch = false; G.input.moved = 1; }
    else if (pointers[e.pointerId]) { pointers[e.pointerId] = zoneAt(p.x, p.y); refreshTouch(); }
  }

  function onUp(e) {
    if (pointers[e.pointerId] !== undefined) { delete pointers[e.pointerId]; refreshTouch(); return; }
    const p = toPlane(e.clientX, e.clientY);
    if (!press) return;
    const pr = press;
    press = null;
    const hit = W.hitAt(p.x, p.y);
    if (hit < 0) return;
    G.menuCursor = hit;
    W.activate(G.hitAreas[hit], pr.button === 2);
  }

  function drawTouch() {
    const labels = { left: 'back', right: 'play', jump: 'wide', shoot: 'mega' };
    for (const z in ZONES) {
      const r = ZONES[z];
      kit.panel(r[0], r[1], r[2], r[3], { radius: 20, accent: UI.accent, glow: touch[z], alpha: 0.7 });
      kit.icon(labels[z], r[0] + r[2] / 2, r[1] + r[3] / 2 - 8, 30, '#ffffff');
      kit.text(z === 'shoot' ? 'blow' : z, r[0] + r[2] / 2, r[1] + r[3] - 16, 12, UI.textDim, { align: 'center' });
    }
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
    keys.left = keys.right = keys.jump = keys.shoot = false;
    for (const id in pointers) delete pointers[id];
    refreshTouch();
  }

  Object.assign(NS.input, { state, onKey, onKeyUp, onDown, onMove, onUp, attach, reset, drawTouch, keys, ZONES });
})();
