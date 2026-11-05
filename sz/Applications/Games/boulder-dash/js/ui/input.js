/* Keyboard, mouse and touch routing: the held-direction stack, grab and dynamite intents
   sampled each step, mouse steering toward the pointer, menu navigation over the hit areas,
   per-screen keys (map, tree, help, cinematics), clicks and taps, and pause when the tab is
   hidden. Touch pointers go to the touch module. Owns G.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const G = NS.state;
  const { canvas, toPlane } = NS.view;
  const scr = NS.screens;
  const inp = G.input;

  const DIR_KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };

  SZ.GameAutoPause.attach({
    isRunning: () => G.screen === 'playing',
    pause: () => scr.pause()
  });

  function activate(i) {
    const h = G.hitAreas[i];
    if (!h || h.disabled || !h.action) return;
    SZ.GameAudio && SZ.GameAudio.play('select', { volume: 0.35 });
    h.action();
  }

  function navMove(d) {
    const n = G.hitAreas.length;
    if (!n) return;
    let i = G.menuCursor;
    for (let k = 0; k < n; ++k) {
      i = (i + d + n) % n;
      if (G.hitAreas[i].nav !== false && !G.hitAreas[i].disabled) break;
    }
    G.menuCursor = i;
    SZ.GameAudio && SZ.GameAudio.play('click', { volume: 0.15 });
  }

  function onBack() {
    switch (G.screen) {
      case 'map': scr.setScreen('title'); break;
      case 'paused': scr.resume(); break;
      case 'results': scr.afterResults(G.results && G.results.mode === 'story' ? 'map' : 'title'); break;
      case 'tree': case 'wardrobe': case 'journal': case 'help': scr.back(); break;
    }
  }

  document.addEventListener('keydown', (e) => {
    inp.keys[e.code] = true;
    inp.lastInput = 1;
    if (e.key === 'F2') {
      e.preventDefault();
      scr.quitToTitle();
      return;
    }
    if (G.screen === 'cinema') {
      e.preventDefault();
      if (!e.repeat) NS.cinema.skip(e.key === 'Escape');
      return;
    }
    if (G.screen === 'playing') {
      const d = DIR_KEYS[e.code];
      if (d !== undefined) {
        e.preventDefault();
        if (inp.held.indexOf(d) < 0) inp.held.push(d);
        return;
      }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) inp.bombQ = true; return; }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { inp.grab = true; return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); scr.pause(); return; }
      if (e.code === 'KeyH') { scr.openOverlay('help'); return; }
      return;
    }
    const d = DIR_KEYS[e.code];
    if (d !== undefined || e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') e.preventDefault();
    if (e.code === 'Escape') { onBack(); return; }
    if (e.code === 'KeyH' && G.screen !== 'help') { scr.openOverlay('help'); return; }
    if (G.screen === 'map') {
      if (d === 0) NS.map.move(0, -1);
      else if (d === 2) NS.map.move(0, 1);
      else if (d === 1) NS.map.move(1, 0);
      else if (d === 3) NS.map.move(-1, 0);
      else if (e.code === 'Enter' || e.code === 'Space') NS.map.playSelected();
      return;
    }
    if (G.screen === 'tree' && d !== undefined) {
      NS.tree.move(d === 1 ? 1 : d === 3 ? -1 : 0, d === 2 ? 1 : d === 0 ? -1 : 0);
      return;
    }
    if (G.screen === 'tree' && (e.code === 'Enter' || e.code === 'Space')) { NS.tree.buy(G.ui.treeSel); return; }
    if (G.screen === 'help' && (d === 1 || d === 3)) { NS.help.turn(d === 1 ? 1 : -1); return; }
    if (d === 0 || d === 3) navMove(-1);
    else if (d === 1 || d === 2) navMove(1);
    else if (e.code === 'Enter' || e.code === 'Space') activate(G.menuCursor);
  });

  document.addEventListener('keyup', (e) => {
    inp.keys[e.code] = false;
    const d = DIR_KEYS[e.code];
    if (d !== undefined) {
      const k = inp.held.indexOf(d);
      if (k >= 0) inp.held.splice(k, 1);
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inp.grab = false;
  });

  window.addEventListener('blur', () => {
    inp.keys = {};
    inp.held.length = 0;
    inp.grab = false;
    inp.pointer.down = false;
  });

  function hitAt(x, y) {
    for (let i = G.hitAreas.length - 1; i >= 0; --i) {
      const h = G.hitAreas[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return i;
    }
    return -1;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = toPlane(e.clientX, e.clientY);
    inp.pointer.x = p.x;
    inp.pointer.y = p.y;
    inp.lastInput = 0;
    if (canvas.focus) canvas.focus();
    if (e.pointerType === 'touch') inp.touch = true;
    else if (e.pointerType === 'mouse') inp.touch = false;
    if (G.screen === 'cinema') { NS.cinema.skip(false); return; }
    if (G.screen === 'playing') {
      if (inp.touch) { NS.touch.down(e.pointerId, p.x, p.y); return; }
      if (e.button === 2) { inp.bombQ = true; return; }
      inp.pointer.down = true;
      inp.pointer.id = e.pointerId;
      return;
    }
    const i = hitAt(p.x, p.y);
    if (i >= 0) { G.menuCursor = i; activate(i); }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toPlane(e.clientX, e.clientY);
    inp.pointer.x = p.x;
    inp.pointer.y = p.y;
    if (e.pointerType === 'mouse') inp.lastInput = 0;
    if (G.screen === 'playing' && inp.touch) NS.touch.move(e.pointerId, p.x, p.y);
  });

  function up(e) {
    if (inp.touch) NS.touch.up(e.pointerId);
    if (e.pointerId === inp.pointer.id || e.pointerType !== 'touch') inp.pointer.down = false;
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* mouse steering: walk toward the pointer along the longer axis */
  function mouseDir() {
    const run = G.run;
    if (!inp.pointer.down || !run) return -1;
    const cv = run.cave;
    const cam = NS.world.camera();
    const f = NS.world.frameRect(true);
    const px = f.x0 - cam.x + cv.player.c * C.TILE + C.TILE / 2, py = f.y0 - cam.y + cv.player.r * C.TILE + C.TILE / 2;
    const dx = inp.pointer.x - px, dy = inp.pointer.y - py;
    if (Math.abs(dx) < C.TILE * 0.55 && Math.abs(dy) < C.TILE * 0.55) return -1;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  }

  const intentObj = { dir: -1, grab: false, bomb: false };
  function intent() {
    let dir = inp.held.length ? inp.held[inp.held.length - 1] : -1;
    if (dir < 0) dir = NS.touch.dir();
    if (dir < 0) dir = mouseDir();
    intentObj.dir = dir;
    intentObj.grab = inp.grab || NS.touch.grab();
    intentObj.bomb = inp.bombQ;
    inp.bombQ = false;
    return intentObj;
  }

  function anyMove() {
    return inp.held.length > 0 || inp.pointer.down || NS.touch.dir() >= 0;
  }

  Object.assign(NS.input, { intent, anyMove, activate, hitAt, navMove });
})();
