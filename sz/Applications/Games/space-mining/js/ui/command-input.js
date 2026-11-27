/* Command input: in the command view the mouse and keys command instead of flying - clicks on
   the strategy panels, left click and drag to select (double-click for a type), right click for
   smart orders (Shift queues), placement clicks (Shift keeps placing), middle drag and the
   wheel move the view, the minimap; keys for pause-and-plan, formations, orders, groups,
   categories, upgrade and demolish. On a touch screen: a tap selects or orders, a one-finger drag
   boxes, a long press attack-moves, two fingers pan and pinch, and chips at the left edge recall
   and set groups. In the pilot view a few keys command the fleet (escort,
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
    if (e.pointerType === 'touch') { touchDown(e, p); return; }
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

  function move(p, e) {
    const c = G.cmd;
    if (e && e.pointerType === 'touch') { touchMove(e, p); return; }
    c.kcell = null;
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
    if (e.pointerType === 'touch' && !e.fromTouch) { touchUp(e, p); return; }
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
    for (const k in fingers) delete fingers[k];
    one = two = null;
  }

  /* ── touch ── */
  const LONG = 0.45, SLOP = 14;
  const fingers = {};
  /* one finger: { id, sx, sy, t, chip }; two fingers: { d, mx, my } */
  let one = null, two = null;

  /* the group chips at the left edge: 1-5 and 0 (clear the selection) */
  function chips() {
    const v = NS.view.visible();
    const out = [];
    for (let i = 0; i < 6; ++i) out.push({ n: (i + 1) % 6, x: v.x0 + 36, y: v.y0 + 136 + i * 58, r: 24 });
    return out;
  }

  function chipAt(p) {
    const list = chips();
    for (let i = 0; i < list.length; ++i) {
      const k = list[i];
      if ((p.x - k.x) * (p.x - k.x) + (p.y - k.y) * (p.y - k.y) < k.r * k.r * 1.6) return k;
    }
    return null;
  }

  function span() {
    const f = Object.keys(fingers).map(k => fingers[k]);
    return { d: Math.max(1, Math.hypot(f[0].x - f[1].x, f[0].y - f[1].y)), mx: (f[0].x + f[1].x) / 2, my: (f[0].y + f[1].y) / 2 };
  }

  function touchDown(e, p) {
    fingers[e.pointerId] = { x: p.x, y: p.y };
    const n = Object.keys(fingers).length;
    if (n === 2) {
      /* a second finger turns the gesture into pan and pinch */
      one = null;
      drag = null;
      G.cmd.box = null;
      two = span();
      return;
    }
    if (n > 2) return;
    const k = chipAt(p);
    if (k) { one = { id: e.pointerId, sx: p.x, sy: p.y, t: G.time, chip: k }; return; }
    /* panels, the minimap and placing work as with a mouse */
    if (W.hitAt(p.x, p.y) >= 0 || G.cmd.place) {
      one = null;
      down({ button: 0, shiftKey: false }, p);
      drag = null;
      return;
    }
    one = { id: e.pointerId, sx: p.x, sy: p.y, t: G.time, chip: null };
    const w = world(p.x, p.y);
    drag = { sx: p.x, sy: p.y, x0: w.x, y0: w.y, add: false };
  }

  function touchMove(e, p) {
    const f = fingers[e.pointerId];
    if (!f) return;
    f.x = p.x;
    f.y = p.y;
    if (two) {
      if (Object.keys(fingers).length !== 2) return;
      const c = G.cmd, s = span();
      c.x -= (s.mx - two.mx) / c.zoom;
      c.y -= (s.my - two.my) / c.zoom;
      two.mx = s.mx;
      two.my = s.my;
      if (s.d > two.d * 1.25) { P.zoomStep(1, s.mx, s.my); two.d = s.d; }
      else if (s.d < two.d * 0.8) { P.zoomStep(-1, s.mx, s.my); two.d = s.d; }
      return;
    }
    if (one && one.id === e.pointerId && !one.chip && Math.abs(p.x - one.sx) + Math.abs(p.y - one.sy) > SLOP) move(p);
  }

  function touchUp(e, p) {
    if (!fingers[e.pointerId]) return;
    delete fingers[e.pointerId];
    if (two) {
      if (!Object.keys(fingers).length) two = null;
      return;
    }
    const g = one;
    one = null;
    if (!g || g.id !== e.pointerId) { drag = null; return; }
    const long = G.time - g.t >= LONG;
    const c = G.cmd;
    if (g.chip) {
      const n = g.chip.n;
      if (!n) P.clearSel();
      else if (long) { if (P.liveSel().length) P.setGroup(n); }
      else if (!P.recallGroup(n)) P.say('Group ' + n + ' is empty - hold the chip to set it');
      NS.audio.sfx('select', { volume: 0.5 });
      return;
    }
    /* a drag: the box selects */
    if (c.box) { up({ button: 0, fromTouch: true }, p); return; }
    const w = world(p.x, p.y);
    const own = P.unitAt(w.x, w.y, 'player');
    const units = P.liveSel();
    const b = own ? null : NS.base.buildingAt(w.x, w.y);
    const rally = c.selB && NS.colonyData.BUILDING_BY_ID[c.selB.type].makes;
    /* a building takes an order only when the selection has work there; else it is selected */
    const work = b && units.length && (b.type === 'hub' || (b.hp < b.maxHp && units.some(u => u.type === 'mender')) || ((b.inf > 0 || b.cor > 0) && units.some(u => u.type === 'purger')));
    if (own && !(units.length && !long && units.some(u => u.type === 'mender' || u.type === 'purger') && units.indexOf(own) < 0 && (own.hp < own.maxHp || own.cor > 0))) {
      up({ button: 0, fromTouch: true, shiftKey: false }, p);
      return;
    }
    drag = null;
    if (b && !work) { P.clickSelect(w.x, w.y, false, false); return; }
    if (!units.length && !rally) { if (!c.pending) P.clearSel(); return; }
    if (long && units.length) c.pending = 'amove';
    P.smartOrder(w.x, w.y, false);
  }

  /* the chips, drawn in the command view on a touch screen */
  function drawTouch() {
    if (!G.input.touch || !G.cmd.on) return;
    const ctx = NS.view.ctx, list = chips();
    for (let i = 0; i < list.length; ++i) {
      const k = list[i], ids = k.n ? G.cmd.groups[k.n] : null;
      const live = ids ? G.units.filter(u => u.alive && u.side === 'player' && ids.indexOf(u.id) >= 0).length : 0;
      const pressed = one && one.chip && one.chip.n === k.n;
      ctx.globalAlpha = pressed ? 0.95 : 0.7;
      ctx.fillStyle = pressed ? 'rgba(200,120,40,0.7)' : live ? 'rgba(20,60,90,0.75)' : 'rgba(10,20,40,0.6)';
      ctx.beginPath();
      ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = NS.constants.UI.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      NS.kit.text(k.n ? String(k.n) : 'X', k.x, k.y, 16, '#ffffff', { align: 'center', baseline: 'middle', weight: 'bold' });
      if (live) NS.kit.text(String(live), k.x + k.r - 2, k.y + k.r - 4, 10, NS.constants.UI.textDim, { align: 'center' });
    }
  }

  /* keys in the command view; returns true when used */
  function key(e) {
    const c = G.cmd;
    const code = e.code;
    /* build mode: the digits pick a tile of the open category */
    if (c.buildMode && /^Digit[1-9]$/.test(code) && !e.ctrlKey && !e.metaKey) {
      const def = NS.buildMenu.tiles()[+code.charAt(5) - 1];
      if (def) P.startPlace(def.id, true);
      return true;
    }
    if (c.place) {
      if (code === 'ArrowLeft') return P.nudge(-1, 0);
      if (code === 'ArrowRight') return P.nudge(1, 0);
      if (code === 'ArrowUp') return P.nudge(0, -1);
      if (code === 'ArrowDown') return P.nudge(0, 1);
      if (code === 'Enter' || code === 'NumpadEnter') { P.placeHere(); return true; }
    }
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
        if (c.place || c.pending) { c.place = null; c.pending = null; c.kcell = null; return true; }
        if (c.buildMode) { c.buildMode = false; return true; }
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
      case 'KeyT': castAll(NS.camera.toWorld(G.input.mouseX, G.input.mouseY, {})); return true;
      case 'KeyB':
        /* the first B opens build mode, the next ones step through the categories */
        if (!c.buildMode) { c.buildMode = true; P.say('Build mode: 1-9 picks, B the next category, arrows move, Enter builds, Esc leaves'); }
        else NS.buildMenu.cycle(e.shiftKey ? -1 : 1);
        return true;
      case 'KeyU': {
        const w = NS.camera.toWorld(G.input.mouseX, G.input.mouseY, {});
        P.upgradeKey(c.selB || NS.base.buildingAt(w.x, w.y), e.shiftKey);
        return true;
      }
      case 'Delete': case 'Backspace': if (c.selB && c.selB.type !== 'hub') { NS.base.demolish(c.selB); c.selB = null; } return true;
      case 'Home': case 'KeyM': { const h = NS.base.hub(); if (h) P.centre(h.x, h.y); return true; }
      case 'Equal': case 'NumpadAdd': P.zoomStep(1); return true;
      case 'Minus': case 'NumpadSubtract': P.zoomStep(-1); return true;
    }
    return false;
  }

  /* fleet keys while flying; returns true when used */
  function pilotKey(e) {
    const code = e.code;
    /* 1-3 fire the hardpoints anywhere; Shift recalls a group, Ctrl sets one */
    if (/^Digit[1-9]$/.test(code) && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const n = +code.charAt(5);
      if (n <= 3) NS.hardpoints.trigger(n - 1, true);
      return n <= 3 || !!G.base;
    }
    if (!G.base) return false;
    if (code === 'Tab') {
      if (!P.toggle(true)) return false;
      P.plan(true);
      return true;
    }
    if (/^Digit[1-9]$/.test(code)) {
      const n = +code.charAt(5);
      if (e.ctrlKey || e.metaKey) P.setGroup(n);
      else if (P.recallGroup(n)) P.say('Group ' + n + ' - G escort, R return, E attack where you aim');
      return true;
    }
    if (code === 'KeyT') return castAll({ x: G.input.aimWX, y: G.input.aimWY }) >= 0;
    /* U: the building under the aim (or under the ship) is upgraded */
    if (code === 'KeyU') return P.upgradeKey(NS.base.buildingAt(G.input.aimWX, G.input.aimWY) || NS.base.buildingAt(G.ship.x, G.ship.y), e.shiftKey) || true;
    if (code === 'KeyG') return P.escortShip();
    if (code === 'KeyR') return P.returnHome();
    if (code === 'KeyE') {
      if (P.attackAim()) NS.fx.ring(G.input.aimWX, G.input.aimWY, 10, 60, 0.5, '#ff5c6c', 3);
      return true;
    }
    return false;
  }

  /* T: every selected craft with its ability ready casts it (a herd or barrage at the point) */
  function castAll(p) {
    const sel = P.liveSel();
    if (!sel.length) return -1;
    const n = NS.abilities.castSelected(sel, null, p);
    P.say(n ? n + ' abilities cast' : sel.some(u => u.def.ability) ? 'Abilities still recharging' : 'No abilities in the selection', n ? '#7cf0ff' : '#ff6a5c');
    return n;
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
    down, move, up, wheel, cancel, key, pilotKey, cursor, chips, drawTouch
  });
})();
