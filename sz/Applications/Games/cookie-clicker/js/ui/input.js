/* Input: pointer events on the canvas mapped into the view plane (mouse, pen and touch) -
   the treat and golden treats react on press for fast clicking, widgets on release, lists
   scroll by drag or wheel, right-click sells; keyboard shortcuts per screen with arrow-key
   menu navigation; cinematics advance on click and skip on any key. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { LAYOUT } = NS.constants;
  const W = NS.widgets;
  const scr = NS.screens;
  const { canvas, toPlane } = NS.view;

  let press = null;

  function inTreat(x, y) {
    const dx = x - LAYOUT.treatX, dy = y - LAYOUT.treatY;
    return dx * dx + dy * dy <= LAYOUT.treatR * LAYOUT.treatR;
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
    if (G.cine) {
      NS.cinematics.next();
      return;
    }
    if (!scr.overlayOpen() && e.button !== 2) {
      if (G.screen === 'game') {
        if (NS.golden.tryClick(p.x, p.y)) return;
        if (inTreat(p.x, p.y)) {
          NS.clicking.click(false, p.x, p.y);
          return;
        }
      } else if (G.screen === 'zen') {
        const hit = W.hitAt(p.x, p.y);
        if (hit < 0) {
          NS.modes.zenClick(p.x, p.y);
          return;
        }
      }
    }
    const hit = W.hitAt(p.x, p.y);
    const area = hit >= 0 ? G.hitAreas[hit] : null;
    let scroll = area && area.scroll ? area.scroll : null;
    if (!scroll)
      for (let i = G.hitAreas.length - 1; i >= 0; --i) {
        const a = G.hitAreas[i];
        if (a.scroll && p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h) { scroll = a.scroll; break; }
      }
    press = { x: p.x, y: p.y, button: e.button, scroll: scroll, last: p.y, dragging: false };
  }

  function onMove(e) {
    const p = toPlane(e.clientX, e.clientY);
    const inp = G.input;
    inp.mx = p.x;
    inp.my = p.y;
    if (e.pointerType !== 'touch') {
      inp.touch = false;
      inp.moved = 1;
    }
    if (press && press.scroll) {
      if (!press.dragging && Math.abs(p.y - press.y) > 8) press.dragging = true;
      if (press.dragging) {
        scrollBy(press.scroll, press.last - p.y);
        press.last = p.y;
      }
    }
  }

  function onUp(e) {
    if (!press) return;
    const p = toPlane(e.clientX, e.clientY);
    const pr = press;
    press = null;
    if (pr.dragging) return;
    const hit = W.hitAt(p.x, p.y);
    if (hit < 0) return;
    G.menuCursor = hit;
    W.activate(G.hitAreas[hit], pr.button === 2);
  }

  function scrollBy(which, dy) {
    if (which === 'store') NS.store.scroll(dy);
    else if (which === 'scene') {
      G.ui.sceneScroll += dy;
      NS.sceneRender.clampScroll();
    }
  }

  function onWheel(e) {
    e.preventDefault();
    if (G.screen !== 'game' || G.cine) return;
    const p = toPlane(e.clientX, e.clientY);
    const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    if (p.x >= LAYOUT.storeX) scrollBy('store', dy * 0.6);
    else if (p.x >= LAYOUT.sceneX - 10) scrollBy('scene', dy * 0.6);
  }

  function activateCursor() {
    const it = G.hitAreas[G.menuCursor];
    if (it) W.activate(it);
  }

  function onKey(e) {
    const k = e.key;
    if (k === 'Tab' || k === ' ' || k.indexOf('Arrow') === 0) e.preventDefault();
    if (G.cine) {
      if (!e.repeat) NS.cinematics.skip();
      return;
    }
    if (k === 'F2') {
      e.preventDefault();
      NS.save.write(G);
      scr.setScreen('title');
      return;
    }
    if (scr.overlayOpen()) {
      if (k === 'Escape') {
        if (G.ui.confirm) G.ui.confirm = null;
        else G.ui.offline = null;
      } else if (k === 'Enter' || k === ' ') {
        if (G.ui.offline) G.ui.offline = null;
        else activateCursor();
      } else if (k.indexOf('Arrow') === 0) arrows(k);
      return;
    }
    const s = G.screen;
    if (s === 'game') {
      if ((k === ' ' || k === 'Enter') && !e.repeat) NS.clicking.click(false);
      else if (k === 'Escape' || k === 'p' || k === 'P') scr.pause();
      else if (k === 't' || k === 'T') scr.openTree('game');
      else if (k === 'c' || k === 'C') scr.openCollection('game');
      else if (k === 'j' || k === 'J') scr.openJournal('game');
      else if (k === 'Tab') NS.store.setTab(G.ui.storeTab === 'buildings' ? 'upgrades' : 'buildings');
      else if (k === 'b' || k === 'B') NS.purchasing.cycleAmount();
      return;
    }
    if (s === 'zen') {
      if (k === 'Escape') NS.modes.leaveZen();
      else if (k === ' ' && !e.repeat) NS.modes.zenClick(640, 380);
      return;
    }
    if (s === 'tree' && NS.tree.key(k)) return;
    if (k.indexOf('Arrow') === 0) arrows(k);
    else if (k === 'Enter' || k === ' ') activateCursor();
    else if (k === 'Escape') {
      if (s === 'paused') scr.resume();
      else if (s === 'bakeResult') scr.setScreen('title');
      else if (s !== 'title') scr.back();
    } else if (s === 'paused' && (k === 'p' || k === 'P')) scr.resume();
    else if (s === 'title' && (k === 't' || k === 'T')) scr.openTree('title');
  }

  function arrows(k) {
    if (k === 'ArrowUp') W.moveCursorDir(0, -1);
    else if (k === 'ArrowDown') W.moveCursorDir(0, 1);
    else if (k === 'ArrowLeft') W.moveCursorDir(-1, 0);
    else W.moveCursorDir(1, 0);
  }

  function attach() {
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', onKey);
  }

  Object.assign(NS.input, { inTreat, onDown, onMove, onUp, onWheel, onKey, attach });
})();
