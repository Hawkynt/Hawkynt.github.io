;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Input: keyboard, mouse and touch mapped onto the game. In a level keys
   * aim, fire, build and toggle upgrades and the pointer aims (slingshot),
   * drags parts and the Sandbox target and holds Bullet Time; on the other
   * screens keys and taps move the menu cursor and activate hit areas.
   * Owns the pointer fields, G.held and G.touchSlow; reads G.state, G.run,
   * G.stats and G.hitAreas.
   */

  const G = NS.G;
  const Parts = G.Parts;
  const canvas = G.canvas;
  const BAR_Y = NS.C.BAR_Y;

  function playKey(e) {
    const run = G.run, stats = G.stats;
    const build = NS.build, aim = NS.aim, shot = NS.shot;
    const code = e.code;
    if (run.phase === 'intro') {
      if (code === 'Enter' || code === 'Space') {
        run.phase = 'aim';
        e.preventDefault();
        return;
      }
    }
    if (run.phase === 'won')
      return;
    const fine = e.shiftKey && stats.steady;
    switch (code) {
      case 'ArrowLeft': case 'KeyA':
        if (run.phase === 'aim') aim.nudgeAim(fine ? 0.1 : 1, 0);
        break;
      case 'ArrowRight': case 'KeyD':
        if (run.phase === 'aim') aim.nudgeAim(fine ? -0.1 : -1, 0);
        break;
      case 'ArrowUp': case 'KeyW':
        if (run.phase === 'aim') aim.nudgeAim(0, fine ? 0.002 : 0.02);
        break;
      case 'ArrowDown':
        if (run.phase === 'aim') aim.nudgeAim(0, fine ? -0.002 : -0.02);
        break;
      case 'Space': case 'Enter':
        if (!e.repeat && run.phase === 'flight' && shot.shotIsDead()) shot.finishShotNow();
        if (!e.repeat && run.phase === 'aim') shot.fire();
        break;
      case 'KeyQ':
        build.rotateSelected(-1);
        break;
      case 'KeyE':
        build.rotateSelected(1);
        break;
      case 'Delete': case 'Backspace':
        build.removePart(run.selected);
        break;
      case 'Tab':
        if (run.placed.length && build.canEdit()) {
          run.selected = (run.selected + 1) % run.placed.length;
          G.sfx('click');
        }
        break;
      case 'KeyR':
        if (!e.repeat) NS.run.restartLevel();
        break;
      case 'KeyB':
        if (stats.blueprint && run.mode !== 'sandbox') {
          run.blueprint = run.blueprint ? 0 : stats.blueprint;
          G.sfx('blip');
        } else if (!stats.blueprint) {
          G.showToast('Buy Blueprint in the Tech Tree (Parts) for hints', '#bfeaff');
        }
        break;
      case 'KeyM':
        if (stats.multiOwned) {
          G.save.multiOn = !G.save.multiOn;
          G.writeSave();
          G.refreshStats();
          G.showToast(G.save.multiOn ? 'Twin Shot on' : 'Twin Shot off', '#ffe9a0');
        }
        break;
      case 'KeyH':
        NS.flow.pauseGame();
        NS.flow.openHelp('pause');
        break;
      case 'KeyT':
        NS.flow.pauseGame();
        NS.flow.openTree('pause');
        break;
      default:
        if (/^Digit[1-9]$/.test(code) && build.canEdit()) {
          const cards = NS.hud.trayCards();
          const c = cards[Number(code.charAt(5)) - 1];
          if (c) {
            build.beginDragNew(c.type, 640, 300);
            if (run.drag) {
              build.updateDrag(640, 300);
              build.endDrag(640, 300);
            }
          }
        }
        return;
    }
    e.preventDefault();
  }

  function onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))
      return;
    if (document.querySelector('.dialog-overlay.visible'))
      return;
    const flow = NS.flow, menu = NS.menu;
    const code = e.code;
    G.held.add(code);
    if (code === 'F2') {
      e.preventDefault();
      G.run = null;
      flow.setScreen('title');
      return;
    }
    if (code === 'Escape' || (code === 'KeyP' && (G.state === 'play' || G.state === 'pause'))) {
      e.preventDefault();
      if (!e.repeat)
        flow.back();
      return;
    }
    if (G.state === 'play' && G.run) {
      playKey(e);
      return;
    }
    if (e.repeat && (code === 'Enter' || code === 'Space'))
      return;
    if (flow.screens.key(e))
      return;
    if (G.state === 'pause') {
      if (code === 'KeyR') { NS.run.restartLevel(); return; }
      if (code === 'KeyT') { flow.openTree('pause'); return; }
      if (code === 'KeyH') { flow.openHelp('pause'); return; }
      if (code === 'KeyQ') { NS.run.quitToMenu(); return; }
    }
    if (G.state === 'results') {
      if (code === 'KeyR') { G.actions.retry(); return; }
      if (code === 'KeyT') { flow.openTree('results'); return; }
      if (code === 'KeyN') { NS.run.nextLevel(); return; }
    }
    if (G.state === 'title' && code === 'KeyH') {
      flow.openHelp('title');
      return;
    }
    if (G.state === 'title' && code === 'KeyT') {
      flow.openTree('title');
      return;
    }
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowLeft' || code === 'KeyA') {
      menu.moveCursor(-1);
      G.pointerMoved = false;
      e.preventDefault();
    } else if (code === 'ArrowDown' || code === 'KeyS' || code === 'ArrowRight' || code === 'KeyD' || code === 'Tab') {
      menu.moveCursor(1);
      G.pointerMoved = false;
      e.preventDefault();
    } else if (code === 'Enter' || code === 'Space') {
      e.preventDefault();
      menu.activate(G.hitAreas[G.menuCursor]);
    }
  }

  function onPointerMove(e) {
    const p = NS.view.pointerToView(e);
    if (Math.abs(p.x - G.mouseX) > 0.5 || Math.abs(p.y - G.mouseY) > 0.5)
      G.pointerMoved = true;
    G.mouseX = p.x;
    G.mouseY = p.y;
    const run = G.run;
    if (G.state !== 'play' || !run)
      return;
    if (run.drag) {
      if (run.drag.target) {
        run.drag.x = Parts.snap(Math.max(40, Math.min(1240, p.x)));
        run.drag.y = Parts.snap(Math.max(40, Math.min(580, p.y)));
      } else {
        NS.build.updateDrag(p.x, p.y);
      }
    } else if (run.aiming) {
      NS.aim.aimFromDrag(run.aiming);
    }
  }

  function onPointerLeave() {
    if (!G.mouseDown) {
      G.mouseX = -1;
      G.mouseY = -1;
    }
  }

  function onPointerDown(e) {
    const p = NS.view.pointerToView(e);
    G.mouseX = p.x;
    G.mouseY = p.y;
    G.mouseDown = true;
    G.pointerMoved = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (G.state !== 'play' || !G.run) {
      const h = NS.menu.hitAt(p);
      const Screens = NS.flow.screens;
      if (h) {
        G.menuCursor = G.hitAreas.indexOf(h);
        if (Screens.pointerDown(h, p))
          return;
        NS.menu.activate(h);
      } else {
        Screens.pointerDown(null, p);
      }
      return;
    }
    playPointerDown(p, e);
  }

  function playPointerDown(p, e) {
    const run = G.run;
    const build = NS.build, hitAt = NS.menu.hitAt;
    /* aiming the next shot skips the roll-out of the last one */
    if (run.phase === 'flight' && NS.shot.shotIsDead() && p.y < BAR_Y && !hitAt(p))
      NS.shot.finishShotNow();
    if (run.phase === 'intro') {
      run.phase = 'aim';
      return;
    }
    if (run.phase === 'won')
      return;
    const h = hitAt(p);
    if (h && h.id.indexOf('card-') === 0) {
      build.beginDragNew(h.id.slice(5), p.x, p.y);
      if (run.drag)
        build.updateDrag(p.x, p.y);
      return;
    }
    if (h && h.action) {
      NS.menu.activate(h);
      return;
    }
    if (p.y >= BAR_Y)
      return;
    if (run.phase === 'flight') {
      /* touch: hold anywhere for bullet time */
      G.touchSlow = e.pointerType === 'touch';
      return;
    }
    if (run.mode === 'sandbox') {
      const t = run.att.targets[0];
      if (t && Math.hypot(p.x - t.x, p.y - t.y) < 34) {
        run.drag = { target: true, x: t.x, y: t.y };
        return;
      }
    }
    const i = build.partAt(p.x, p.y);
    if (i >= 0 && build.canEdit()) {
      build.beginDragExisting(i, p.x, p.y);
      return;
    }
    run.selected = -1;
    run.aiming = { sx: p.x, sy: p.y };
  }

  function onPointerUp(e) {
    G.mouseDown = false;
    G.touchSlow = false;
    const run = G.run;
    if (G.state !== 'play' || !run)
      return;
    const p = NS.view.pointerToView(e);
    if (run.drag) {
      if (run.drag.target) {
        const d = run.drag;
        run.drag = null;
        run.level = Object.assign({}, run.level, { targets: [[d.x, d.y]] });
        NS.run.rebuildAttempt();
        run.phase = 'aim';
        G.sfx('drop');
        return;
      }
      NS.build.endDrag(p.x, p.y);
      return;
    }
    if (run.aiming) {
      const a = run.aiming;
      run.aiming = null;
      if (Math.hypot(p.x - a.sx, p.y - a.sy) > 14 && run.phase === 'aim')
        NS.shot.fire();
    }
  }

  function onPointerCancel() {
    G.mouseDown = false;
    G.touchSlow = false;
    if (G.run) {
      G.run.aiming = null;
      G.run.drag = null;
    }
  }

  /* registered in this order: keys first, then the pointer */
  function attach() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', (e) => {
      G.held.delete(e.code);
    });
    window.addEventListener('blur', () => {
      G.held.clear();
    });
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }

  NS.input = { attach: attach };
})();
