/* Keyboard, mouse and touch: the run's moves (jump with a release cut, slide with hold,
   dash), the revive choice, pause and the shortcuts; menu navigation and clicks through the hit
   areas (pointer positions mapped into the view plane at any window size); skipping
   cinematics; pausing and autosaving when the tab is hidden or the page is left. Owns the
   input listeners. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { canvas, toPlane } = NS.view;
  const W = NS.widgets;
  const scr = NS.screens;
  const inp = G.input;

  const JUMP = { Space: 1, KeyW: 1, ArrowUp: 1 };
  const SLIDE = { KeyS: 1, ArrowDown: 1 };
  const DASH = { ShiftLeft: 1, ShiftRight: 1, KeyD: 1, ArrowRight: 1, KeyX: 1 };

  if (SZ.GameAutoPause)
    SZ.GameAutoPause.attach({
      isRunning: () => G.screen === 'playing' && G.run && !G.run.demo && !G.run.ended,
      pause: () => scr.pause(),
    });

  /* the page going away: keep the run and the profile */
  function persist() {
    if (G.run && !G.run.demo && scr.inRun()) NS.save.writeRun();
    NS.save.writeSave();
  }
  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

  function playing() {
    return G.screen === 'playing' && G.run && !G.run.demo && !G.run.ended;
  }

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
    if (playing()) {
      onPlayKey(e);
      return;
    }
    onMenuKey(e);
  });

  document.addEventListener('keyup', (e) => {
    inp.keys[e.code] = false;
    if (JUMP[e.code] && playing()) inp.queue.push('cut');
    if (SLIDE[e.code]) inp.downHeld = !!(inp.keys.KeyS || inp.keys.ArrowDown);
  });

  window.addEventListener('blur', () => {
    inp.keys = {};
    inp.downHeld = false;
  });

  function onPlayKey(e) {
    const run = G.run;
    if (run.phase === 'revive') {
      e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape') NS.run.over(run);
      else if (JUMP[e.code] || e.code === 'Enter') NS.player.revive(run);
      return;
    }
    if (JUMP[e.code]) {
      e.preventDefault();
      if (!e.repeat) inp.queue.push('jump');
      return;
    }
    if (SLIDE[e.code]) {
      e.preventDefault();
      inp.downHeld = true;
      if (!e.repeat) inp.queue.push('slide');
      return;
    }
    if (DASH[e.code]) {
      e.preventDefault();
      if (!e.repeat) inp.queue.push('dash');
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      scr.pause();
    } else if (e.code === 'KeyT') {
      scr.pause();
      scr.open('tree', 'paused');
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
      case 'Tab': e.preventDefault(); W.moveCursor(e.shiftKey ? -1 : 1); break;
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
      case 'results': scr.setScreen(G.lastSum && G.lastSum.mode === 'story' ? 'map' : 'title'); break;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (window.focus) window.focus();
    const p = toPlane(e.clientX, e.clientY);
    inp.mouseX = p.x;
    inp.mouseY = p.y;
    if (G.screen === 'cine') { NS.cine.next(); return; }
    if (e.pointerType === 'touch') {
      inp.touch = true;
      if (playing()) {
        e.preventDefault();
        NS.touch.down(e.pointerId, p.x, p.y);
        return;
      }
    } else inp.touch = false;
    if (playing() && G.run.phase !== 'revive') {
      if (e.button === 2) { inp.queue.push('slide'); inp.downHeld = true; }
      else if (e.button === 1) { e.preventDefault(); inp.queue.push('dash'); }
      else inp.queue.push('jump');
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
    if (e.pointerType === 'touch') { NS.touch.up(e.pointerId); return; }
    if (playing()) {
      if (e.button === 2) inp.downHeld = false;
      else if (e.button === 0) inp.queue.push('cut');
    }
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    if (!playing()) return;
    e.preventDefault();
    if (e.deltaY !== 0) inp.queue.push('dash');
  }, { passive: false });

  Object.assign(NS.input, {
    persist, escape
  });
})();
