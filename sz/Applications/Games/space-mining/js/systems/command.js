/* The command layer: switching between the pilot view and the zoomed-out tactical view,
   pause-and-plan, the free command camera, selection (click, box, double-click for a type,
   control groups 1-9), the formation in use, smart right-click orders (move, attack, escort
   the ship, repair, purge, mine, return, rally points) with queued waypoints, building
   placement, and the order markers. Owns G.cmd. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H } = NS.constants;
  const { BUILDING_BY_ID } = NS.colonyData;
  const O = NS.orders;

  const ZOOMS = [0.22, 0.3, 0.42, 0.56, 0.75, 1];

  function cmd() {
    return G.cmd;
  }

  function reset() {
    const c = G.cmd;
    c.on = false;
    c.plan = false;
    c.sel.length = 0;
    c.selB = null;
    c.place = null;
    c.pending = null;
    c.box = null;
    c.marks.length = 0;
    c.groups = {};
    c.msg = null;
  }

  function available() {
    return !!G.base && !!G.run && !G.cine;
  }

  function toggle(on) {
    const c = G.cmd;
    const want = on === undefined ? !c.on : !!on;
    if (want && !available()) return false;
    c.on = want;
    if (want) {
      const h = NS.base.hub();
      c.x = G.cam.x;
      c.y = G.cam.y;
      if (!h && G.base) { c.x = (c.x + G.base.site.cx) / 2; c.y = (c.y + G.base.site.cy) / 2; }
      c.zoom = 0.42;
      NS.audio.sfx('blip', { volume: 0.5, pitch: 0.8 });
    } else {
      c.plan = false;
      c.place = null;
      c.pending = null;
      c.box = null;
      NS.audio.sfx('blip', { volume: 0.5, pitch: 1.2 });
    }
    return true;
  }

  function plan(on) {
    const c = G.cmd;
    c.plan = on === undefined ? !c.plan : !!on;
    if (c.plan && !c.on) toggle(true);
    NS.audio.sfx('blip', { volume: 0.4, pitch: c.plan ? 0.6 : 1.1 });
  }

  /* the command camera, panned by keys, zoomed by wheel or buttons */
  function update(dt) {
    const c = G.cmd;
    for (let i = c.marks.length - 1; i >= 0; --i) {
      c.marks[i].t += dt;
      if (c.marks[i].t > 0.8) c.marks.splice(i, 1);
    }
    if (c.msg) {
      c.msg.t += dt;
      if (c.msg.t > 2.6) c.msg = null;
    }
    if (!c.on) return;
    const k = G.input.keys;
    const sp = 900 / c.zoom * dt;
    if (k.KeyA || k.ArrowLeft) c.x -= sp;
    if (k.KeyD || k.ArrowRight) c.x += sp;
    if (k.KeyW || k.ArrowUp) c.y -= sp;
    if (k.KeyS || k.ArrowDown) c.y += sp;
    c.x = Math.max(0, Math.min(G.world.w, c.x));
    c.y = Math.max(0, Math.min(G.world.h, c.y));
  }

  function zoomStep(d, ax, ay) {
    const c = G.cmd;
    let i = 0;
    for (let k = 0; k < ZOOMS.length; ++k) if (Math.abs(ZOOMS[k] - c.zoom) < Math.abs(ZOOMS[i] - c.zoom)) i = k;
    const n = Math.max(0, Math.min(ZOOMS.length - 1, i + d));
    if (ax !== undefined) {
      /* keep the point under the cursor in place */
      const w = NS.camera.toWorld(ax, ay, {});
      c.x = w.x - (ax - VIEW_W / 2) / ZOOMS[n];
      c.y = w.y - (ay - VIEW_H / 2) / ZOOMS[n];
    }
    c.zoom = ZOOMS[n];
  }

  function centre(x, y) {
    G.cmd.x = x;
    G.cmd.y = y;
  }

  function say(text, color) {
    G.cmd.msg = { text: text, color: color || '#ffd25a', t: 0 };
  }

  /* ── selection ── */
  function liveSel() {
    const c = G.cmd;
    let j = 0;
    for (let i = 0; i < c.sel.length; ++i) if (c.sel[i].alive && c.sel[i].side === 'player') c.sel[j++] = c.sel[i];
    c.sel.length = j;
    if (c.selB && !c.selB.alive) c.selB = null;
    return c.sel;
  }

  function select(list, add) {
    const c = G.cmd;
    if (!add) c.sel.length = 0;
    c.selB = null;
    for (let i = 0; i < list.length; ++i) if (list[i].side === 'player' && c.sel.indexOf(list[i]) < 0) c.sel.push(list[i]);
    if (list.length) NS.audio.sfx('click', { volume: 0.4, pitch: 1.2 });
  }

  function selectBuilding(b) {
    const c = G.cmd;
    c.sel.length = 0;
    c.selB = b;
    NS.audio.sfx('click', { volume: 0.4 });
  }

  function clearSel() {
    G.cmd.sel.length = 0;
    G.cmd.selB = null;
  }

  function unitAt(x, y, side) {
    let best = null, bd = Infinity;
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (!u.alive || (side && u.side !== side)) continue;
      const d = (u.x - x) * (u.x - x) + (u.y - y) * (u.y - y);
      const r = u.r + 10 / G.cam.zoom;
      if (d < r * r && d < bd) { bd = d; best = u; }
    }
    return best;
  }

  function enemyAt(x, y) {
    let best = null, bd = Infinity;
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive) continue;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      const r = e.r + 10 / G.cam.zoom;
      if (d < r * r && d < bd) { bd = d; best = e; }
    }
    if (best) return best;
    const u = unitAt(x, y, 'rogue');
    if (u) return u;
    const b = NS.base.buildingAt(x, y);
    return b && b.rogue ? b : null;
  }

  function rockAt(x, y) {
    const list = NS.asteroids.queryRocks(x, y, 90, []);
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (o.alive && (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) < o.r * o.r) return o;
    }
    return null;
  }

  /* left click: a unit, a building, or nothing */
  function clickSelect(x, y, add, dbl) {
    const u = unitAt(x, y, 'player');
    if (u) {
      if (dbl) selectType(u.type, true, add);
      else if (add && G.cmd.sel.indexOf(u) >= 0) G.cmd.sel.splice(G.cmd.sel.indexOf(u), 1);
      else select([u], add);
      return true;
    }
    const b = NS.base.buildingAt(x, y);
    if (b) { selectBuilding(b); return true; }
    if (!add) clearSel();
    return false;
  }

  function selectBox(x0, y0, x1, y1, add) {
    const lx = Math.min(x0, x1), hx = Math.max(x0, x1), ly = Math.min(y0, y1), hy = Math.max(y0, y1);
    const list = [];
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (u.alive && u.side === 'player' && u.x >= lx && u.x <= hx && u.y >= ly && u.y <= hy) list.push(u);
    }
    /* prefer combat craft when the box catches both */
    const combat = list.filter(u => u.def.dmg > 0);
    select(combat.length && combat.length < list.length && !add ? combat : list, add);
    return list.length;
  }

  /* every unit of a type (in view only, or everywhere) */
  function selectType(type, inView, add) {
    const r = NS.camera.worldRect({}, 0);
    const list = G.units.filter(u => u.alive && u.side === 'player' && u.type === type && (!inView || (u.x > r.x0 && u.x < r.x1 && u.y > r.y0 && u.y < r.y1)));
    select(list, add);
  }

  function selectAllCombat() {
    select(G.units.filter(u => u.alive && u.side === 'player' && u.def.dmg > 0), false);
  }

  function setGroup(n) {
    G.cmd.groups[n] = liveSel().map(u => u.id);
    say('Group ' + n + ' set - ' + G.cmd.sel.length + ' units');
  }

  /* recall a group; asking twice centres the view on it */
  function recallGroup(n) {
    const ids = G.cmd.groups[n];
    if (!ids || !ids.length) return false;
    const list = G.units.filter(u => u.alive && u.side === 'player' && ids.indexOf(u.id) >= 0);
    const again = G.cmd.sel.length === list.length && list.every(u => G.cmd.sel.indexOf(u) >= 0);
    select(list, false);
    if (again && list.length) {
      const c = NS.formations.centroid(list);
      if (G.cmd.on) centre(c.x, c.y);
    }
    return true;
  }

  /* ── orders ── */
  function mark(x, y, color) {
    G.cmd.marks.push({ x: x, y: y, t: 0, color: color });
  }

  function order(kind, x, y, target, queue, list) {
    const units = list || liveSel();
    if (!units.length) return false;
    const home = NS.base.hub();
    O.issue(units, kind, { x: x, y: y, target: target, queue: queue, formation: G.cmd.form, home: home ? { x: home.x, y: home.y + home.r + 60 } : null });
    mark(target ? target.x : kind === 'return' && home ? home.x : x, target ? target.y : kind === 'return' && home ? home.y : y,
      kind === 'attack' || kind === 'amove' ? '#ff5c6c' : kind === 'patrol' ? '#ffd25a' : kind === 'escort' ? '#4fd8ff' : '#5cff9a');
    NS.audio.sfx('blip', { volume: 0.35, pitch: kind === 'attack' ? 0.7 : 1.3 });
    return true;
  }

  /* right click in the world: what the selection should do there */
  function smartOrder(x, y, queue) {
    const c = G.cmd;
    if (c.place) { c.place = null; return; }
    if (c.selB && BUILDING_BY_ID[c.selB.type].makes) {
      c.selB.rally = { x: x, y: y };
      mark(x, y, '#ffd25a');
      say('Rally point set');
      return;
    }
    const units = liveSel();
    if (!units.length) return;
    const pend = c.pending;
    c.pending = null;
    if (pend === 'patrol') { order('patrol', x, y, null, queue); return; }
    if (pend === 'amove') { order('amove', x, y, null, queue); return; }
    const foe = enemyAt(x, y);
    if (foe) { order('attack', x, y, foe, queue); return; }
    const s = G.ship;
    if (s && s.alive && (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < (s.r + 16 / G.cam.zoom) * (s.r + 16 / G.cam.zoom)) { order('escort', x, y, s, queue); return; }
    const b = NS.base.buildingAt(x, y);
    if (b) {
      const purgers = units.filter(u => u.type === 'purger');
      const menders = units.filter(u => u.type === 'mender');
      if (purgers.length && (b.inf > 0 || b.cor > 0)) { order('purge', x, y, b, queue, purgers); return; }
      if (menders.length && b.hp < b.maxHp) { order('repair', x, y, b, queue, menders); return; }
      if (b.type === 'hub') { order('return', x, y, null, queue); return; }
    }
    const ally = unitAt(x, y, 'player');
    if (ally && units.some(u => u.type === 'mender') && ally.hp < ally.maxHp) { order('repair', x, y, ally, queue, units.filter(u => u.type === 'mender')); return; }
    if (ally && units.some(u => u.type === 'purger') && ally.cor > 0) { order('purge', x, y, ally, queue, units.filter(u => u.type === 'purger')); return; }
    const rock = rockAt(x, y);
    const miners = units.filter(u => u.type === 'miner');
    if (rock && miners.length) {
      order('mine', rock.x, rock.y, null, queue, miners);
      const rest = units.filter(u => u.type !== 'miner');
      if (rest.length) order('move', x, y, null, queue, rest);
      return;
    }
    order('move', x, y, null, queue);
  }

  function setFormation(f) {
    const c = G.cmd;
    c.form = f;
    const units = liveSel();
    say(f.charAt(0).toUpperCase() + f.slice(1) + ' formation');
    if (!units.length) return;
    const o = units[0].orders && units[0].orders[0];
    if (o && (o.kind === 'move' || o.kind === 'amove' || o.kind === 'patrol' || o.kind === 'hold')) order(o.kind, o.kind === 'patrol' ? o.bx : o.x, o.kind === 'patrol' ? o.by : o.y, null, false);
    else if (o && o.kind === 'escort') order('escort', 0, 0, o.target, false);
    else {
      const ce = NS.formations.centroid(units);
      order('move', ce.x, ce.y, null, false);
    }
  }

  function hold() {
    const units = liveSel();
    for (let i = 0; i < units.length; ++i) units[i].orders = [{ kind: 'hold', x: units[i].x, y: units[i].y }];
    say('Holding position');
  }

  /* pilot-view orders: the selection (or every combat craft) */
  function pilotUnits() {
    const sel = liveSel();
    return sel.length ? sel : G.units.filter(u => u.alive && u.side === 'player' && u.def.dmg > 0);
  }

  function escortShip() {
    const list = pilotUnits();
    if (!list.length || !G.ship) return false;
    order('escort', 0, 0, G.ship, false, list);
    NS.fx.text(G.ship.x, G.ship.y - 50, 'FORM UP ON ME', '#4fd8ff', 15, 1.2);
    return true;
  }

  function returnHome() {
    const list = pilotUnits();
    if (!list.length) return false;
    order('return', 0, 0, null, false, list);
    return true;
  }

  function attackAim() {
    const list = pilotUnits();
    if (!list.length) return false;
    order('amove', G.input.aimWX, G.input.aimWY, null, false, list);
    return true;
  }

  /* ── placement ── */
  function startPlace(type) {
    const c = G.cmd;
    c.place = type;
    c.selB = null;
    c.sel.length = 0;
  }

  function tryPlace(x, y, keep) {
    const c = G.cmd;
    const def = BUILDING_BY_ID[c.place];
    const cell = NS.base.cellAt(x, y, def.size);
    const res = NS.base.place(c.place, cell.cx, cell.cy);
    if (!res.ok) {
      say(res.reason, '#ff6a5c');
      NS.audio.sfx('error');
      return false;
    }
    if (!keep || c.place === 'hub') c.place = null;
    if (res.b && !keep) selectBuilding(res.b);
    return true;
  }

  Object.assign(NS.command, {
    ZOOMS, cmd, reset, available, toggle, plan, update, zoomStep, centre, say, liveSel, select, selectBuilding, clearSel, unitAt,
    enemyAt, rockAt, clickSelect, selectBox, selectType, selectAllCombat, setGroup, recallGroup, order, smartOrder, setFormation, hold,
    escortShip, returnHome, attackAim, startPlace, tryPlace
  });
})();
