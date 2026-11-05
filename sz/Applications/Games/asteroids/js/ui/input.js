/* Keyboard, mouse and touch input: held keys and the pointer (mapped into the view plane at any
   window size) in G.input; flight intents sampled each step (rotate/thrust/brake/fire, or aim at
   the pointer, hyperspace and overdrive as one-shot requests); skipping cinematics and advancing
   dialogue; menu navigation with the shared cursor; per-screen keys; pause when the tab hides
   and autosave when the page goes away. Owns G.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { canvas, toPlane } = NS.view;
  const W = NS.widgets;
  const scr = NS.screens;
  const inp = G.input;
  const intent = { turn: 0, thrust: false, brake: false, fire: false, aimAngle: null, hyperQ: false, overQ: false };

  SZ.GameAutoPause.attach({
    isRunning: () => G.screen === 'playing',
    pause: () => scr.pause(),
  });

  /* the run is written away whenever the page may be leaving */
  function saveNow() {
    NS.snapshot.autosave(true);
    NS.save.writeSave();
  }
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  const BLOCK = { Space: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Tab: 1 };

  document.addEventListener('keydown', (e) => {
    inp.keys[e.code] = true;
    if (e.key === 'F2') {
      e.preventDefault();
      if (scr.inRun()) scr.quitToTitle();
      else scr.setScreen('title');
      return;
    }
    if (G.screen === 'cine') {
      e.preventDefault();
      if (!e.repeat) NS.cinematics.skip();
      return;
    }
    if (G.screen === 'story') {
      e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape') NS.story.end();
      else NS.story.advance();
      return;
    }
    if (G.screen === 'playing') {
      onFlightKey(e);
      return;
    }
    onMenuKey(e);
  });

  document.addEventListener('keyup', (e) => {
    inp.keys[e.code] = false;
  });

  window.addEventListener('blur', () => {
    inp.keys = {};
    inp.mouseDown = false;
    inp.rightDown = false;
  });

  function onFlightKey(e) {
    if (BLOCK[e.code]) e.preventDefault();
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft': case 'ArrowRight': case 'KeyA': case 'KeyD': inp.aimMouse = false; inp.touch = false; break;
      case 'ShiftLeft': case 'ShiftRight': case 'KeyX': inp.hyperQ = true; break;
      case 'KeyE': case 'KeyQ': inp.overQ = true; break;
      case 'Escape': case 'KeyP': scr.pause(); break;
    }
  }

  const TAB_KEYS = {
    wardrobe: () => { const t = NS.wardrobe.TABS; const i = t.findIndex(x => x[0] === G.ui.wardrobeTab); G.ui.wardrobeTab = t[(i + 1) % t.length][0]; },
    goals: () => { const t = NS.goals.TABS; const i = t.findIndex(x => x[0] === G.ui.goalsTab); G.ui.goalsTab = t[(i + 1) % t.length][0]; },
  };

  function onMenuKey(e) {
    if (G.screen === 'tree' && e.code === 'KeyB') { e.preventDefault(); NS.tree.buy(G.ui.treeSel); return; }
    if (G.screen === 'help' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      e.preventDefault();
      NS.help.turn(e.code === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (e.code === 'Tab' && TAB_KEYS[G.screen]) {
      e.preventDefault();
      TAB_KEYS[G.screen]();
      return;
    }
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
        if (G.screen === 'title') scr.open('help', 'title');
        break;
      case 'Escape': case 'KeyP':
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
      case 'goals': scr.back('goals'); break;
      case 'help': scr.back('help'); break;
      case 'map': scr.setScreen('title'); break;
      case 'results': scr.setScreen(G.ui.results && G.ui.results.mode === 'story' ? 'map' : 'title'); break;
    }
  }

  /* ── pointer ── */
  canvas.addEventListener('pointerdown', (e) => {
    if (window.focus) window.focus();
    const p = toPlane(e.clientX, e.clientY);
    inp.mouseX = p.x;
    inp.mouseY = p.y;
    if (G.screen === 'cine') { NS.cinematics.skip(); return; }
    if (e.pointerType === 'touch') {
      inp.touch = true;
      if (G.screen === 'playing') {
        if (e.preventDefault) e.preventDefault();
        NS.touch.down(e.pointerId, p.x, p.y);
        return;
      }
    } else inp.touch = false;
    if (G.screen === 'playing') {
      if (e.button === 2) inp.rightDown = true;
      else inp.mouseDown = true;
      inp.aimMouse = true;
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
    const dx = p.x - inp.mouseX, dy = p.y - inp.mouseY;
    inp.mouseX = p.x;
    inp.mouseY = p.y;
    if (e.pointerType === 'touch') {
      NS.touch.move(e.pointerId, p.x, p.y);
      return;
    }
    ++inp.mouseMoved;
    if (G.screen === 'playing' && Math.abs(dx) + Math.abs(dy) > 4) inp.aimMouse = true;
  });

  function release(e) {
    if (e.pointerType === 'touch') NS.touch.up(e.pointerId);
    if (e.button === 2) inp.rightDown = false;
    else inp.mouseDown = false;
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ── per-step intent ── */
  function k(code) {
    return !!inp.keys[code];
  }

  function sample() {
    intent.turn = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    intent.thrust = k('KeyW') || k('ArrowUp');
    intent.brake = k('KeyS') || k('ArrowDown');
    intent.fire = k('Space') || k('KeyJ') || k('KeyZ');
    intent.aimAngle = null;
    intent.hyperQ = inp.hyperQ;
    intent.overQ = inp.overQ;
    inp.hyperQ = false;
    inp.overQ = false;
    inp.aimAngle = null;
    inp.thrust = false;
    inp.fire = false;
    if (NS.touch.sample(inp)) {
      intent.fire = intent.fire || inp.fire;
      intent.thrust = intent.thrust || inp.thrust;
      if (inp.aimAngle !== null) intent.aimAngle = inp.aimAngle;
      return intent;
    }
    if (inp.aimMouse && !intent.turn && G.ship && !G.ship.dead) {
      const s = G.ship;
      intent.aimAngle = Math.atan2(inp.mouseY - s.y, inp.mouseX - s.x);
      intent.fire = intent.fire || inp.mouseDown;
      intent.thrust = intent.thrust || inp.rightDown;
    }
    return intent;
  }

  Object.assign(NS.input, {
    sample, saveNow
  });
})();
