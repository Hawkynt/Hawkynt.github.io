/* Input. Keys: D F J K and the arrows hit the lanes in play (a press is timed from the key event's own
   timestamp; held keys repeat nothing), Space unleashes Surge, Esc/P pause and resume, R retries, F2
   opens the song list; in menus the arrows move the cursor, Enter or Space choose, Esc goes back; any
   key turns a cinematic page (Esc skips). Pointer: in play a press on the highway hits the lane under
   it (every finger its own lane, held for holds), the touch buttons work; in menus a click chooses
   what it was pressed on, the wheel scrolls lists. Every press focuses the canvas, so the keys reach the
   game after any click into its window. The calibration test takes lane keys and taps. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const W = NS.widgets;
  const scr = NS.screens;

  function laneOfKey(k) {
    for (let l = 0; l < 4; ++l) if (C.KEYS[l].indexOf(k) >= 0) return l;
    return -1;
  }

  function stamp(ev) {
    const t = ev && ev.timeStamp;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return typeof t === 'number' && t > 0 && t < 1e11 && Math.abs(t - now) < 2000 ? t : now;
  }

  function menuKey(k) {
    if (k === 'arrowup' || k === 'w') W.moveCursorDir(0, -1);
    else if (k === 'arrowdown' || k === 's') W.moveCursorDir(0, 1);
    else if (k === 'arrowleft' || k === 'a') W.moveCursorDir(-1, 0);
    else if (k === 'arrowright' || k === 'd') W.moveCursorDir(1, 0);
    else if (k === 'enter' || k === ' ') W.activate(G.hitAreas[G.menuCursor]);
    else return false;
    return true;
  }

  function onKeyDown(ev) {
    const k = String(ev.key || '').toLowerCase();
    if (k === 'f2') { ev.preventDefault && ev.preventDefault(); if (G.screen === 'game') scr.pause(); scr.setScreen('library', 'title'); return; }
    if (G.ui.confirm) { if (k === 'escape') G.ui.confirm = null; else menuKey(k); return; }
    if (G.cine) { if (ev.repeat) return; if (k === 'escape') NS.cine.skip(); else NS.cine.next(); return; }
    if (G.ui.crate) { if (k === 'enter' || k === ' ' || k === 'escape') { const c = G.ui.crate; if (c.shown < c.rolls.length) { c.next = 0; c.t += 0.75; } else G.ui.crate = null; } return; }
    const lane = laneOfKey(k);
    if (G.screen === 'game') {
      if (ev.preventDefault && (lane >= 0 || k === ' ')) ev.preventDefault();
      if (ev.repeat) return;
      if (lane >= 0) NS.play.press(lane, stamp(ev));
      else if (k === ' ') NS.play.surge();
      else if (k === 'escape' || k === 'p') scr.pause();
      return;
    }
    if (G.screen === 'settings' && G.ui.calib && !G.ui.calib.done && lane >= 0) { NS.settings.tap(stamp(ev) / 1000); G.input.laneFlash[lane] = 1; return; }
    if (G.screen === 'paused') {
      if (k === 'escape' || k === 'p') { scr.resume(); return; }
      if (k === 'r') { NS.play.restart(); return; }
    }
    if (G.screen === 'results' && k === 'r') { NS.play.restart(); return; }
    if (menuKey(k)) { ev.preventDefault && ev.preventDefault(); return; }
    if (k === 'escape') {
      if (G.screen === 'title') return;
      if (G.screen === 'results') scr.setScreen(G.result && G.result.stage ? 'map' : 'title');
      else scr.back();
    }
  }

  function onKeyUp(ev) {
    const lane = laneOfKey(String(ev.key || '').toLowerCase());
    if (lane >= 0) NS.play.release(lane, stamp(ev));
  }

  const down = {};
  function point(ev) {
    const p = NS.view.toPlane(ev.clientX, ev.clientY);
    G.input.mx = p.x;
    G.input.my = p.y;
    return p;
  }

  /* the canvas takes the keyboard: preventDefault below stops the browser from focusing it */
  function focus() {
    const cv = NS.view.canvas;
    try { if (cv.focus) cv.focus({ preventScroll: true }); } catch (_) {}
  }

  function onDown(ev) {
    G.input.touch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
    const p = point(ev);
    if (ev.preventDefault) ev.preventDefault();
    focus();
    if (G.cine) { NS.cine.next(); return; }
    if (G.screen === 'game' && !G.ui.confirm) {
      const hit = W.hitAt(p.x, p.y);
      if (hit >= 0) { W.activate(G.hitAreas[hit]); return; }
      const lane = NS.highway.laneAt(p.x, p.y);
      if (lane >= 0) { down[ev.pointerId] = { lane: lane }; NS.play.press(lane, stamp(ev)); }
      return;
    }
    down[ev.pointerId] = { area: W.hitAt(p.x, p.y), x: p.x, y: p.y };
  }

  function onMove(ev) {
    point(ev);
    if (ev.pointerType === 'mouse') { G.input.touch = false; G.input.moved = 1; }
  }

  function onUp(ev) {
    const p = point(ev);
    const d = down[ev.pointerId];
    delete down[ev.pointerId];
    if (!d) return;
    if (d.lane != null) { NS.play.release(d.lane, stamp(ev)); return; }
    const a = W.hitAt(p.x, p.y);
    if (a >= 0 && a === d.area) W.activate(G.hitAreas[a]);
  }

  function onWheel(ev) {
    if (ev.preventDefault) ev.preventDefault();
    G.ui.scroll = Math.max(0, (G.ui.scroll || 0) + (ev.deltaY > 0 ? 2 : -2));
  }

  function attach() {
    const cv = NS.view.canvas;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('contextmenu', e => e.preventDefault && e.preventDefault());
    cv.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('focus', focus);
    focus();
  }

  Object.assign(NS.input, { focus, laneOfKey, stamp, menuKey, onKeyDown, onKeyUp, onDown, onMove, onUp, onWheel, attach });
})();
