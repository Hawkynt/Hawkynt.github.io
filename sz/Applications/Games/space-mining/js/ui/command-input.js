/* Command input: in the command view the mouse and keys command instead of flying - clicks on
   the strategy panels, left click and drag to select (double-click for a type), right click for
   smart orders (Shift queues), placement clicks (Shift keeps placing), middle drag and the
   wheel move the view, the minimap; keys for pause-and-plan, formations, orders, groups,
   categories, upgrade and demolish. In the pilot view a few keys command the fleet (escort,
   return, attack where you aim, groups). Called by NS.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const W = NS.widgets;
  const P = NS.command;
  const FORM_KEYS = { KeyZ: 'line', KeyX: 'wedge', KeyC: 'box', KeyV: 'circle' };
  const tmp = { x: 0, y: 0 };

  let drag = null;
  let pan = null;
  let lastClick = { t: -1, x: 0, y: 0 };

  function world(px, py) {
    return NS.camera.toWorld(px, py, { x: 0, y: 0 });
  }

  function down(e, p) {
    const c = G.cmd;
    if (e.button === 1) {
      pan = { x: p.x, y: p.y, cx: c.x, cy: c.y };
      return;
    }
    if (e.button === 2) {
      const m = NS.commandHud.minimapPoint(p.x, p.y);
      if (m) { P.smartOrder(m.x, m.y, e.shiftKey); return; }
      if (W.hitAt(p.x, p.y) >= 0) return;
      const w = world(p.x, p.y);
      P.smartOrder(w.x, w.y, e.shiftKey);
      return;
    }
    const i = W.hitAt(p.x, p.y);
    if (i >= 0) {
      const a = G.hitAreas[i];
      if (a.action && !a.disabled) {
        a.action();
        NS.audio.sfx('select', { volume: 0.5 });
      } else NS.audio.sfx('error');
      return;
    }
    const w = world(p.x, p.y);
    if (c.place) {
      P.tryPlace(w.x, w.y, e.shiftKey);
      return;
    }
    drag = { sx: p.x, sy: p.y, x0: w.x, y0: w.y, add: e.shiftKey };
  }

  function move(p) {
    const c = G.cmd;
    if (pan) {
      c.x = pan.cx - (p.x - pan.x) / G.cam.zoom;
      c.y = pan.cy - (p.y - pan.y) / G.cam.zoom;
      return;
    }
    if (drag && Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 6) {
      const w = world(p.x, p.y);
      c.box = { x0: drag.x0, y0: drag.y0, x1: w.x, y1: w.y };
    }
  }

  function up(e, p) {
    const c = G.cmd;
    if (e.button === 1) { pan = null; return; }
    if (!drag) return;
    const d = drag;
    drag = null;
    if (c.box) {
      P.selectBox(c.box.x0, c.box.y0, c.box.x1, c.box.y1, d.add);
      c.box = null;
      return;
    }
    const w = world(p.x, p.y);
    const dbl = G.time - lastClick.t < 0.35 && Math.abs(p.x - lastClick.x) + Math.abs(p.y - lastClick.y) < 10;
    lastClick = { t: G.time, x: p.x, y: p.y };
    P.clickSelect(w.x, w.y, d.add, dbl);
  }

  function wheel(e, p) {
    P.zoomStep(e.deltaY < 0 ? 1 : -1, p.x, p.y);
  }

  function cancel() {
    drag = null;
    pan = null;
    G.cmd.box = null;
  }

  /* keys in the command view; returns true when used */
  function key(e) {
    const c = G.cmd;
    const code = e.code;
    if (/^Digit[1-9]$/.test(code)) {
      const n = +code.charAt(5);
      if (e.ctrlKey || e.metaKey) P.setGroup(n);
      else P.recallGroup(n);
      return true;
    }
    if (FORM_KEYS[code]) { P.setFormation(FORM_KEYS[code]); return true; }
    switch (code) {
      case 'Tab': P.toggle(false); return true;
      case 'Space': P.plan(); return true;
      case 'Escape':
        if (c.place || c.pending) { c.place = null; c.pending = null; return true; }
        if (c.sel.length || c.selB) { P.clearSel(); return true; }
        return false;
      case 'KeyA':
        if (e.ctrlKey || e.metaKey) { P.selectAllCombat(); return true; }
        return false;
      case 'KeyF': if (c.sel.length) { c.pending = 'amove'; P.say('Right-click where to attack-move'); } return true;
      case 'KeyQ': if (c.sel.length) { c.pending = 'patrol'; P.say('Right-click the far end of the patrol'); } return true;
      case 'KeyE': if (c.sel.length && G.ship) P.order('escort', 0, 0, G.ship, false); return true;
      case 'KeyR': if (c.sel.length) P.order('return', 0, 0, null, false); return true;
      case 'KeyG': if (c.sel.length) P.hold(); return true;
      case 'KeyB': NS.buildMenu.cycle(e.shiftKey ? -1 : 1); return true;
      case 'KeyU': if (c.selB) { const r = NS.base.upgrade(c.selB); if (!r.ok) P.say(r.reason, '#ff6a5c'); } return true;
      case 'Delete': case 'Backspace': if (c.selB && c.selB.type !== 'hub') { NS.base.demolish(c.selB); c.selB = null; } return true;
      case 'Home': case 'KeyM': { const h = NS.base.hub(); if (h) P.centre(h.x, h.y); return true; }
      case 'Equal': case 'NumpadAdd': P.zoomStep(1); return true;
      case 'Minus': case 'NumpadSubtract': P.zoomStep(-1); return true;
    }
    return false;
  }

  /* fleet keys while flying; returns true when used */
  function pilotKey(e) {
    if (!G.base) return false;
    const code = e.code;
    if (code === 'Tab') return P.toggle(true);
    if (/^Digit[1-9]$/.test(code)) {
      const n = +code.charAt(5);
      if (e.ctrlKey || e.metaKey) P.setGroup(n);
      else if (P.recallGroup(n)) P.say('Group ' + n + ' - G escort, R return, E attack where you aim');
      return true;
    }
    if (code === 'KeyG') return P.escortShip();
    if (code === 'KeyR') return P.returnHome();
    if (code === 'KeyE') {
      if (P.attackAim()) NS.fx.ring(G.input.aimWX, G.input.aimWY, 10, 60, 0.5, '#ff5c6c', 3);
      return true;
    }
    return false;
  }

  /* a cursor that tells what a right click would do */
  function cursor() {
    const c = G.cmd;
    if (c.place) return 'copy';
    if (c.pending) return 'crosshair';
    NS.camera.toWorld(G.input.mouseX, G.input.mouseY, tmp);
    if (c.sel.length && P.enemyAt(tmp.x, tmp.y)) return 'crosshair';
    return 'default';
  }

  Object.assign(NS.commandInput, {
    down, move, up, wheel, cancel, key, pilotKey, cursor
  });
})();
