/* Keyboard, mouse and touch input: steering keys held or remembered for a moment after release
   (longer with Slick Turns), clicking the maze to steer toward the pointer, cinematic skipping,
   menu navigation and clicks through the hit areas, per-screen keys, pausing on a hidden tab
   and saving on page hide. Owns G.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { canvas, toPlane } = NS.view;
  const W = NS.widgets;
  const scr = NS.screens;
  const inp = G.input;

  const DIRS = { ArrowLeft: 0, KeyA: 0, ArrowUp: 1, KeyW: 1, ArrowRight: 2, KeyD: 2, ArrowDown: 3, KeyS: 3 };
  let heldCode = '';

  SZ.GameAutoPause.attach({
    isRunning: () => G.screen === 'playing',
    pause: () => scr.pause(),
  });

  function persist() {
    if (G.run && !G.run.demo) NS.save.saveRun();
    if (G.profile) NS.save.writeProfile();
  }
  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

  function setWant(d, held) {
    inp.want = d;
    inp.wantT = 0;
    inp.held = !!held;
  }

  document.addEventListener('keydown', (e) => {
    inp.keys[e.code] = true;
    if (G.screen === 'cine') {
      if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && !e.repeat) {
        e.preventDefault();
        NS.cinematics.skip();
      }
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      scr.toTitle();
      return;
    }
    if (G.screen === 'playing') {
      onPlayKey(e);
      return;
    }
    onMenuKey(e);
  });

  document.addEventListener('keyup', (e) => {
    inp.keys[e.code] = false;
    if (e.code === heldCode) {
      heldCode = '';
      inp.held = false;
    }
  });

  window.addEventListener('blur', () => {
    inp.keys = {};
    inp.held = false;
    heldCode = '';
  });

  function onPlayKey(e) {
    if (e.code in DIRS) {
      e.preventDefault();
      setWant(DIRS[e.code], true);
      heldCode = e.code;
      return;
    }
    switch (e.code) {
      case 'Escape': case 'KeyP': case 'Space':
        e.preventDefault();
        scr.pause();
        break;
      case 'KeyT':
        scr.pause();
        scr.openTree('pause');
        break;
    }
  }

  function onMenuKey(e) {
    if (G.screen === 'tree' && NS.tree.onKey(e)) { e.preventDefault(); return; }
    if (G.screen === 'help' && NS.help.onKey(e)) { e.preventDefault(); return; }
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': e.preventDefault(); W.moveCursorDir(0, -1); break;
      case 'ArrowDown': case 'KeyS': e.preventDefault(); W.moveCursorDir(0, 1); break;
      case 'ArrowLeft': case 'KeyA': e.preventDefault(); W.moveCursorDir(-1, 0); break;
      case 'ArrowRight': case 'KeyD': e.preventDefault(); W.moveCursorDir(1, 0); break;
      case 'Enter': case 'NumpadEnter': case 'Space':
        e.preventDefault();
        W.activate(G.hitAreas[G.menuCursor]);
        break;
      case 'KeyH':
        if (G.screen === 'title' || G.screen === 'map') scr.openHelp(G.screen);
        break;
      case 'KeyT':
        if (G.screen === 'title' || G.screen === 'map' || G.screen === 'pause') scr.openTree(G.screen);
        break;
      case 'Escape': case 'KeyP': case 'Backspace':
        e.preventDefault();
        escape();
        break;
    }
  }

  function escape() {
    if (G.ui.confirm) { G.ui.confirm = null; return; }
    switch (G.screen) {
      case 'pause': scr.resume(); break;
      case 'tree': scr.back('treeReturn'); break;
      case 'wardrobe': scr.back('wardrobeReturn'); break;
      case 'goals': scr.back('goalsReturn'); break;
      case 'season': scr.back('seasonReturn'); break;
      case 'help': scr.back('helpReturn'); break;
      case 'map': scr.setScreen('title'); break;
      case 'results': NS.results.leave(); break;
    }
  }

  /* ── pointer ── */
  canvas.addEventListener('pointerdown', (e) => {
    window.focus();
    const p = toPlane(e.clientX, e.clientY);
    inp.mouseX = p.x;
    inp.mouseY = p.y;
    inp.touch = e.pointerType === 'touch';
    if (G.screen === 'cine') {
      NS.cinematics.skip();
      return;
    }
    if (G.screen === 'playing') {
      e.preventDefault();
      if (inp.touch) { NS.touch.down(e.pointerId, p.x, p.y); return; }
      steerToward(p.x, p.y);
      inp.mouseSteer = true;
      return;
    }
    const i = W.hitAt(p.x, p.y);
    if (i >= 0) {
      G.menuCursor = i;
      W.activate(G.hitAreas[i]);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toPlane(e.clientX, e.clientY);
    inp.mouseX = p.x;
    inp.mouseY = p.y;
    if (e.pointerType === 'touch') { NS.touch.move(e.pointerId, p.x, p.y); return; }
    ++inp.mouseMoved;
    if (inp.mouseSteer && G.screen === 'playing') steerToward(p.x, p.y);
  });

  function release(e) {
    if (e.pointerType === 'touch') NS.touch.up(e.pointerId);
    inp.mouseSteer = false;
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* mouse steering: the dominant axis from Pac-Man to the pointer */
  function steerToward(x, y) {
    const run = G.run;
    if (!run || !run.lvl) return;
    const pac = run.lvl.pac;
    const dx = x - NS.grid.px(pac.x), dy = y - NS.grid.py(pac.y);
    if (dx * dx + dy * dy < 100) return;
    setWant(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 2) : (dy < 0 ? 1 : 3), false);
  }

  /* per step: hand the wanted direction to Pac-Man; released turns are remembered briefly */
  function sample(lvl) {
    const pac = lvl.pac;
    if (inp.want >= 0 && !inp.held) {
      inp.wantT += C.STEP;
      const memory = G.stats.corner ? 1.2 : 0.7;
      if ((pac.dir === inp.want && inp.wantT > 0.1) || inp.wantT > memory) inp.want = -1;
    }
    pac.want = inp.want;
  }

  Object.assign(NS.input, {
    sample, steerToward, setWant
  });
})();
