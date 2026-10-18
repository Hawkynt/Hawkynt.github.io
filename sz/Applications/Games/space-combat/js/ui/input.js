/* Keyboard, mouse and touch input: held keys and the pointer in G.input, flight intents sampled
   each step (thrust, boost, mouse aim or the IJKL keyboard turret, fire, secondary, roll,
   special), menu navigation and clicks through the hit areas, per-screen keys, pause on hidden
   tab. Owns G.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { canvas, toPlane } = NS.view;
  const W = NS.widgets;
  const scr = NS.screens;
  const inp = G.input;
  const tmp = { x: 0, y: 0 };

  inp.aimDirX = 0;
  inp.aimDirY = -1;

  SZ.GameAutoPause.attach({
    isRunning: () => G.screen === 'playing',
    pause: () => scr.pause(),
  });

  const FLIGHT_KEYS = { Space: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Tab: 1 };

  document.addEventListener('keydown', (e) => {
    inp.keys[e.code] = true;
    if (e.key === 'F2') {
      e.preventDefault();
      scr.setScreen('title');
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
    if (FLIGHT_KEYS[e.code]) e.preventDefault();
    if (e.repeat) return;
    switch (e.code) {
      case 'Space': inp.rollQ = true; break;
      case 'KeyE':
      case 'KeyQ': inp.abilityQ = true; break;
      case 'Escape':
      case 'KeyP': scr.pause(); break;
      case 'KeyI': case 'KeyJ': case 'KeyK': case 'KeyL': inp.aimMode = 'keys'; break;
    }
  }

  function onMenuKey(e) {
    if (G.screen === 'tree' && NS.tree.onKey(e)) { e.preventDefault(); return; }
    if (G.screen === 'help' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      e.preventDefault();
      NS.help.onKey(e);
      return;
    }
    if (G.screen === 'hangar' && e.code === 'Tab') {
      e.preventDefault();
      G.ui.hangarTab = G.ui.hangarTab === 'ships' ? 'weapons' : 'ships';
      return;
    }
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': e.preventDefault(); W.moveCursorDir(0, -1); break;
      case 'ArrowDown': case 'KeyS': e.preventDefault(); W.moveCursorDir(0, 1); break;
      case 'ArrowLeft': case 'KeyA': e.preventDefault(); W.moveCursorDir(-1, 0); break;
      case 'ArrowRight': case 'KeyD': e.preventDefault(); W.moveCursorDir(1, 0); break;
      case 'Enter': case 'NumpadEnter': case 'Space':
        e.preventDefault();
        if (G.screen === 'briefing' && e.code !== 'Space' && !G.hitAreas[G.menuCursor]) {
          const b = G.ui.briefing;
          NS.missions.startRun('campaign', { sector: b.sector, index: b.index });
        } else
          W.activate(G.hitAreas[G.menuCursor]);
        break;
      case 'KeyH':
        if (G.screen === 'title' || G.screen === 'map') scr.openHelp(G.screen);
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
      case 'tree': scr.setScreen(G.treeReturn); break;
      case 'help': scr.setScreen(G.helpReturn || 'title'); break;
      case 'hangar': scr.setScreen(G.hangarReturn === 'briefing' || G.hangarReturn === 'map' ? G.hangarReturn : 'title'); break;
      case 'briefing': scr.setScreen('map'); break;
      case 'map': scr.setScreen('title'); break;
      case 'results': scr.setScreen(G.ui.results && G.ui.results.mode === 'campaign' ? 'map' : 'title'); break;
    }
  }

  /* ── pointer ── */
  canvas.addEventListener('pointerdown', (e) => {
    window.focus();
    const p = toPlane(e.clientX, e.clientY);
    inp.mouseX = p.x;
    inp.mouseY = p.y;
    if (e.pointerType === 'touch') {
      inp.touch = true;
      if (G.screen === 'playing') {
        e.preventDefault();
        NS.touch.down(e.pointerId, p.x, p.y);
        return;
      }
    } else
      inp.touch = false;
    if (G.screen === 'playing') {
      if (e.button === 2) inp.rightDown = true;
      else inp.mouseDown = true;
      inp.aimMode = 'mouse';
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
    if (G.screen === 'playing' && inp.aimMode !== 'mouse') {
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) + Math.abs(dy) > 2) inp.aimMode = 'mouse';
    }
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
    inp.moveX = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    inp.moveY = (k('KeyS') || k('ArrowDown') ? 1 : 0) - (k('KeyW') || k('ArrowUp') ? 1 : 0);
    inp.boost = k('ShiftLeft') || k('ShiftRight');
    inp.secondary = inp.rightDown || k('KeyX') || k('KeyC');
    inp.firing = false;
    inp.touchAim = false;
    const p = G.player;
    /* keyboard turret */
    const tx = (k('KeyL') ? 1 : 0) - (k('KeyJ') ? 1 : 0), ty = (k('KeyK') ? 1 : 0) - (k('KeyI') ? 1 : 0);
    if (tx || ty) {
      const l = Math.sqrt(tx * tx + ty * ty);
      inp.aimDirX = tx / l;
      inp.aimDirY = ty / l;
      inp.firing = true;
      inp.aimMode = 'keys';
    }
    NS.touch.sample(inp);
    if (inp.aimMode === 'mouse' && !inp.touch) {
      NS.camera.toWorld(inp.mouseX, inp.mouseY, tmp);
      inp.aimWX = tmp.x;
      inp.aimWY = tmp.y;
      inp.firing = inp.firing || inp.mouseDown;
    } else if (p) {
      inp.aimWX = p.x + inp.aimDirX * 320;
      inp.aimWY = p.y + inp.aimDirY * 320;
    }
  }

  Object.assign(NS.input, {
    sample
  });
})();
