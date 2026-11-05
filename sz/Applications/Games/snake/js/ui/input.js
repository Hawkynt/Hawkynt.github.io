/* Keyboard, mouse and touch: turning the snake (arrows/WASD, a click beside the head, swipes),
   venom, pause and the shortcuts; menu navigation and clicks through the hit areas; skipping
   cinematics; pausing and autosaving when the tab is hidden or the page is left. Owns the input
   listeners. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { canvas, toPlane } = NS.view;
  const W = NS.widgets;
  const scr = NS.screens;
  const inp = G.input;

  const TURN = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };

  if (SZ.GameAutoPause)
    SZ.GameAutoPause.attach({
      isRunning: () => G.screen === 'playing' && G.run && G.run.mode !== 'demo',
      pause: () => scr.pause(),
    });

  /* the page going away: keep the run and the profile */
  function persist() {
    if (G.run && G.run.mode !== 'demo' && scr.inRun()) NS.save.writeRun();
    NS.save.writeSave();
  }
  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

  document.addEventListener('keydown', (e) => {
    inp.keys[e.code] = true;
    if (e.key === 'F2') {
      e.preventDefault();
      scr.toTitle();
      return;
    }
    if (G.screen === 'cine') {
      e.preventDefault();
      if (e.code === 'Escape') NS.cine.end(); else if (!e.repeat) NS.cine.next();
      return;
    }
    if (G.screen === 'playing' && G.run && G.run.mode !== 'demo') {
      onPlayKey(e);
      return;
    }
    onMenuKey(e);
  });

  document.addEventListener('keyup', (e) => {
    inp.keys[e.code] = false;
  });

  window.addEventListener('blur', () => {
    inp.keys = {};
  });

  function onPlayKey(e) {
    if (TURN[e.code] !== undefined) {
      e.preventDefault();
      NS.snake.queueDir(TURN[e.code]);
      return;
    }
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (!e.repeat) NS.combat.spit();
        break;
      case 'Escape':
      case 'KeyP':
        e.preventDefault();
        scr.pause();
        break;
    }
  }

  function onMenuKey(e) {
    if (G.screen === 'tree' && NS.tree.onKey(e)) { e.preventDefault(); return; }
    if (G.screen === 'help' && NS.help.onKey(e)) { e.preventDefault(); return; }
    if (G.screen === 'map' && NS.map.onKey(e)) { e.preventDefault(); return; }
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': e.preventDefault(); W.moveCursorDir(0, -1); break;
      case 'ArrowDown': case 'KeyS': e.preventDefault(); W.moveCursorDir(0, 1); break;
      case 'ArrowLeft': case 'KeyA': e.preventDefault(); W.moveCursorDir(-1, 0); break;
      case 'ArrowRight': case 'KeyD': e.preventDefault(); W.moveCursorDir(1, 0); break;
      case 'Enter': case 'NumpadEnter': case 'Space':
        e.preventDefault();
        if (!e.repeat) W.activate(G.hitAreas[G.menuCursor]);
        break;
      case 'KeyH':
        if (G.screen === 'title' || G.screen === 'map' || G.screen === 'paused') scr.open('help', G.screen);
        break;
      case 'KeyT':
        if (G.screen === 'title' || G.screen === 'map' || G.screen === 'paused' || G.screen === 'results') scr.open('tree', G.screen);
        break;
      case 'Escape':
      case 'KeyP':
        e.preventDefault();
        escape();
        break;
    }
  }

  function escape() {
    switch (G.screen) {
      case 'paused': scr.resume(); break;
      case 'tree': scr.back('tree'); break;
      case 'wardrobe': scr.back('wardrobe'); break;
      case 'journal': scr.back('journal'); break;
      case 'help': scr.back('help'); break;
      case 'map': scr.setScreen('title'); break;
      case 'results': scr.setScreen(G.ui.results && G.ui.results.mode === 'story' ? 'map' : 'title'); break;
    }
  }

  /* a click beside the head turns toward it */
  function steerToward(x, y) {
    const o = NS.world.OUT;
    if (o.headX === undefined) return;
    const dx = x - o.headX, dy = y - o.headY;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    const s = G.run.snake;
    const horizontal = s.dir === 1 || s.dir === 3;
    /* turn across the current heading, so a click is never wasted on a forbidden reversal */
    if (horizontal) NS.snake.queueDir(dy < 0 ? 0 : 2);
    else NS.snake.queueDir(dx < 0 ? 3 : 1);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (window.focus) window.focus();
    const p = toPlane(e.clientX, e.clientY);
    inp.mouseX = p.x;
    inp.mouseY = p.y;
    if (G.screen === 'cine') { NS.cine.next(); return; }
    const playing = G.screen === 'playing' && G.run && G.run.mode !== 'demo';
    if (e.pointerType === 'touch') {
      inp.touch = true;
      if (playing) {
        e.preventDefault();
        NS.touch.down(e.pointerId, p.x, p.y);
        return;
      }
    } else inp.touch = false;
    if (playing) {
      if (e.button === 2) NS.combat.spit();
      else steerToward(p.x, p.y);
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
    if (e.pointerType === 'touch') {
      NS.touch.move(e.pointerId, p.x, p.y);
      return;
    }
    ++inp.mouseMoved;
  });

  function release(e) {
    if (e.pointerType === 'touch') NS.touch.up(e.pointerId);
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  Object.assign(NS.input, {
    persist, steerToward
  });
})();
