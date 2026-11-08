/* Keyboard, mouse and touch input: held keys and the pointer in G.input; flight intents
   sampled each step (W/S thrust along the nose and A/D turn, or thrust toward the cursor on the right button, boost, the
   laser on the left button or Space with keyboard auto-aim, abilities); the command view and
   fleet keys handed to NS.commandInput; cinematic skipping; menu navigation and clicks through
   the hit areas; per-screen keys; pause on a hidden tab. Owns G.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { LASER_RANGE } = NS.constants;
  const { canvas, toPlane } = NS.view;
  const W = NS.widgets;
  const scr = NS.screens;
  const inp = G.input;
  const tmp = { x: 0, y: 0 };
  const near = [];
  let autoTarget = null;

  SZ.GameAutoPause.attach({
    isRunning: () => G.screen === 'playing',
    pause: () => scr.pause(),
  });

  const FLIGHT_KEYS = { Space: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Tab: 1 };

  document.addEventListener('keydown', (e) => {
    inp.keys[e.code] = true;
    if (G.cine && !e.repeat && e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
      if (FLIGHT_KEYS[e.code]) e.preventDefault();
      NS.cinematics.skip();
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      scr.setScreen('title');
      return;
    }
    if (G.screen === 'playing') {
      if (G.cmd.on) {
        if (NS.commandInput.key(e)) { e.preventDefault(); return; }
        if (FLIGHT_KEYS[e.code] || e.code === 'KeyA') e.preventDefault();
        if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) scr.pause();
        return;
      }
      if (!e.repeat && NS.commandInput.pilotKey(e)) { e.preventDefault(); return; }
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
      case 'Space': inp.aimMode = 'keys'; break;
      case 'KeyQ': NS.mining.pulse(); break;
      case 'KeyC': NS.mining.dropCharge(); break;
      case 'KeyF': NS.drones.toggle(); break;
      case 'Enter': case 'NumpadEnter': if (G.run && G.run.docked) NS.trip.returnHome(); break;
      case 'Escape':
      case 'KeyP': scr.pause(); break;
      case 'KeyH': scr.pause(); scr.openHelp('paused'); break;
    }
  }

  function onMenuKey(e) {
    if (G.screen === 'tree' && NS.tree.onKey(e)) { e.preventDefault(); return; }
    if (G.screen === 'station' && NS.station.onKey(e)) { e.preventDefault(); return; }
    if (G.screen === 'help' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      e.preventDefault();
      NS.help.onKey(e);
      return;
    }
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
        if (G.screen === 'title' || G.screen === 'station' || G.screen === 'map') scr.openHelp(G.screen);
        break;
      case 'KeyT':
        if (G.screen === 'title' || G.screen === 'station' || G.screen === 'map') scr.openTree(G.screen);
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
      case 'map': scr.setScreen('station'); break;
      case 'station': scr.setScreen('title'); break;
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
    if (G.cine) {
      NS.cinematics.skip();
      return;
    }
    if (G.screen === 'playing') {
      e.preventDefault();
      if (G.cmd.on) {
        NS.commandInput.down(e, p);
        return;
      }
      /* flight buttons (the dock's Return home) take the press before the sticks and the laser */
      const hb = e.button === 2 ? -1 : W.hitAt(p.x, p.y);
      if (hb >= 0) {
        W.activate(G.hitAreas[hb]);
        return;
      }
      if (inp.touch) {
        NS.touch.down(e.pointerId, p.x, p.y);
        return;
      }
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
    if (G.screen === 'playing' && G.cmd.on) {
      ++inp.mouseMoved;
      NS.commandInput.move(p);
      return;
    }
    if (e.pointerType === 'touch') {
      NS.touch.move(e.pointerId, p.x, p.y);
      return;
    }
    ++inp.mouseMoved;
    if (G.screen === 'playing' && inp.aimMode !== 'mouse' && Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 2) inp.aimMode = 'mouse';
  });

  function release(e) {
    if (G.screen === 'playing' && G.cmd.on) {
      const p = toPlane(e.clientX, e.clientY);
      NS.commandInput.up(e, p);
    }
    if (e.pointerType === 'touch') NS.touch.up(e.pointerId);
    if (e.button === 2) inp.rightDown = false;
    else inp.mouseDown = false;
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    if (G.screen !== 'playing' || !G.cmd.on) return;
    e.preventDefault();
    NS.commandInput.wheel(e, toPlane(e.clientX, e.clientY));
  }, { passive: false });

  /* ── per-step intent ── */
  function k(code) {
    return !!inp.keys[code];
  }

  /* keyboard drilling: keep the current rock, else the nearest ore rock ahead (pirates first) */
  /* keyboard firing locks onto the ore (or pirate) closest to the nose inside the laser's cone
     and keeps the lock while it stays in the cone */
  function autoAim(s) {
    const M = NS.mining;
    if (autoTarget && autoTarget.alive) {
      const dx = autoTarget.x - s.x, dy = autoTarget.y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d - (autoTarget.r || 0) < LASER_RANGE && Math.abs(NS.rng.angleDiff(s.angle, Math.atan2(dy, dx))) < M.AIM_CONE + 0.15) return autoTarget;
    }
    autoTarget = M.coneTarget(s);
    return autoTarget;
  }


  function sample() {
    /* keys fly the ship like a ship: W/S thrust along the nose, A/D turn it */
    inp.moveX = inp.moveY = 0;
    inp.turn = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    inp.thrustAxis = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    inp.boost = k('ShiftLeft') || k('ShiftRight');
    inp.firing = false;
    const s = G.ship;
    if (!s) return;
    if (G.cmd.on) {
      /* the command view steers the fleet, not the ship: it coasts and brakes */
      inp.moveX = inp.moveY = 0;
      inp.turn = inp.thrustAxis = 0;
      inp.boost = false;
      return;
    }
    if (inp.touch) {
      NS.touch.sample(inp);
      return;
    }
    NS.camera.toWorld(inp.mouseX, inp.mouseY, tmp);
    if (inp.rightDown) {
      /* mouse-only flight: thrust toward the cursor, softer near it */
      const dx = tmp.x - s.x, dy = tmp.y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = Math.min(1, d / 160);
      inp.moveX = dx / d * f;
      inp.moveY = dy / d * f;
    }
    if (k('Space')) {
      const t = autoAim(s);
      inp.aimMode = 'keys';
      inp.firing = true;
      if (t) {
        inp.aimWX = t.x;
        inp.aimWY = t.y;
      } else {
        inp.aimWX = s.x + Math.cos(s.angle) * 300;
        inp.aimWY = s.y + Math.sin(s.angle) * 300;
      }
      return;
    }
    inp.aimWX = tmp.x;
    inp.aimWY = tmp.y;
    inp.firing = inp.mouseDown && inp.aimMode === 'mouse';
  }

  Object.assign(NS.input, {
    sample, autoAim
  });
})();
