/* The Void Crown's allies and fronts: allied stations an operation puts out at the rim (own hull,
   guns that shoot the nearest hostile in reach, a hull the difficulty level raises as it raises the foes', a failed operation when all of them fall),
   fronts - groups of one faction arriving from the rim on a schedule and going for a station or
   for you - and the feud that sets the factions on each other (the nearest craft of another
   faction becomes a raider's target). Owns G.allies. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const R = NS.rng.fx;

  const ALLY = { r: 64, range: 480, rof: 0.8, dmg: 18 };
  const FRONT_CAP = 40;
  const A = { feud: false, fronts: [] };
  const near = [];

  function clear() {
    G.allies.length = 0;
    A.feud = false;
    A.fronts = [];
  }

  /* a spot out at the rim, clear of the outpost site and of the enemy bases */
  function rimSpot() {
    const site = G.base && G.base.site;
    for (let i = 0; i < 200; ++i) {
      const x = 500 + R() * (G.world.w - 1000), y = 500 + R() * (G.world.h - 1000);
      if (NS.fuel.reach(x, y, G.dock, G.world.w, G.world.h) < 0.6) continue;
      if (site && Math.hypot(x - site.cx, y - site.cy) < 1600) continue;
      if (G.enemies.some(e => e.alive && e.def.structure && Math.hypot(e.x - x, e.y - y) < 1500)) continue;
      if (G.allies.some(a => Math.hypot(a.x - x, a.y - y) < 1500)) continue;
      return { x: x, y: y };
    }
    return { x: G.world.w * 0.85, y: G.world.h * 0.8 };
  }

  function setup(op) {
    clear();
    A.feud = !!op.feud;
    /* a station is fortified as much as the difficulty toughens its foes: a stronger siege, the same time to arrive */
    const k = NS.operation.dm().hp;
    for (const a of op.allies || []) {
      const p = rimSpot(), hp = a.hp * k;
      G.allies.push({ ally: true, alive: true, x: p.x, y: p.y, r: ALLY.r, hp: hp, maxHp: hp, name: a.name || 'Allied Station', fireT: R(), angle: R() * TAU, flash: 0 });
    }
    A.fronts = (op.fronts || []).map((f, i) => ({ i: i, t: f.first }));
  }

  function alive() {
    return G.allies.filter(a => a.alive).length;
  }

  function feud() {
    return A.feud;
  }

  function damage(a, dmg) {
    if (!a.alive) return;
    a.hp -= dmg;
    a.flash = 0.1;
    if (a.hp > 0) return;
    a.alive = false;
    NS.fx.explode(a.x, a.y, 120, NS.fx.FIRE, {});
    NS.fx.shockwave(a.x, a.y, 600, '#ffb070');
    NS.fx.shake(0.6);
    NS.audio.sfxAt('explode', a.x, a.y, { volume: 0.9, pitch: 0.5 });
    NS.trip.banner('STATION LOST', a.name + ' is gone', '#ff5c6c');
  }

  /* the nearest craft of another faction in reach (a feud), structures included */
  function rival(e, r) {
    const list = NS.enemies.queryHostile(e.x, e.y, r);
    let best = null, bd = r * r;
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (!o.alive || o === e || o.dormant || !o.def || o.def.faction === e.def.faction) continue;
      const d = (o.x - e.x) * (o.x - e.x) + (o.y - e.y) * (o.y - e.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /* where a front aims: a station, else the outpost, else the ship */
  function aimOf(f) {
    if (f.at === 'ally') {
      const list = G.allies.filter(a => a.alive);
      if (list.length) return list[Math.floor(R() * list.length)];
    }
    return NS.base.hub() || G.ship;
  }

  function launch(f) {
    if (G.enemies.filter(e => e.alive && e.front).length >= FRONT_CAP) return;
    const aim = aimOf(f);
    if (!aim) return;
    const a = R() * TAU;
    const x = Math.max(80, Math.min(G.world.w - 80, aim.x + Math.cos(a) * 1400)), y = Math.max(80, Math.min(G.world.h - 80, aim.y + Math.sin(a) * 1400));
    const kinds = Object.keys(f.kinds);
    let tot = 0;
    for (const k of kinds) tot += f.kinds[k];
    let n = f.size[0] + Math.floor(R() * (f.size[1] - f.size[0] + 1));
    if (NS.operation.mod('swarm')) n = Math.ceil(n * 1.5);
    n = NS.operation.sized(n);
    for (let i = 0; i < n; ++i) {
      let roll = R() * tot, kind = kinds[0];
      for (const k of kinds) if ((roll -= f.kinds[k]) < 0) { kind = k; break; }
      const e = NS.enemies.spawn(kind, x + (R() - 0.5) * 300, y + (R() - 0.5) * 300, { angle: a + Math.PI });
      e.front = true;
      if (aim.ally) e.allyT = aim;
    }
    const names = { alien: 'The Hive', lattice: 'The Lattice', syndicate: 'The Syndicate' };
    NS.trip.banner('FRONT', (names[f.faction] || 'Raiders') + ' close in' + (aim.ally ? ' on ' + aim.name : ''), '#ff6a5c');
    NS.audio.sfx('zap', { volume: 0.6, pitch: 0.4 });
  }

  function update(dt) {
    for (let i = 0; i < G.allies.length; ++i) {
      const a = G.allies[i];
      if (!a.alive) continue;
      if (a.flash > 0) a.flash -= dt;
      a.angle += dt * 0.15;
      a.fireT -= dt;
      if (a.fireT > 0) continue;
      const list = NS.enemies.queryHostile(a.x, a.y, ALLY.range);
      let t = null, bd = ALLY.range * ALLY.range;
      for (const e of list) {
        if (!e.alive || e.dormant) continue;
        const d = (e.x - a.x) * (e.x - a.x) + (e.y - a.y) * (e.y - a.y);
        if (d < bd) { bd = d; t = e; }
      }
      if (!t) continue;
      a.fireT = ALLY.rof;
      NS.enemies.fire('player', 'bolt', a.x, a.y, t, ALLY.dmg, 900, { from: a });
    }
    const o = G.run && G.run.op;
    const op = o && o.status === 'active' ? NS.operation.def() : null;
    if (!op || !op.fronts) return;
    for (const st of A.fronts) {
      st.t -= dt;
      if (st.t > 0) continue;
      const f = op.fronts[st.i];
      st.t = f.every;
      launch(f);
    }
  }

  function capture() {
    return { allies: G.allies.map(a => Object.assign({}, a)), feud: A.feud, fronts: A.fronts.map(f => ({ i: f.i, t: f.t })) };
  }

  function restore(data) {
    clear();
    if (!data || !Array.isArray(data.allies)) return;
    for (const a of data.allies) if (a && typeof a.x === 'number' && typeof a.hp === 'number') G.allies.push(Object.assign({ ally: true, flash: 0, fireT: 0, angle: 0 }, a));
    A.feud = !!data.feud;
    if (Array.isArray(data.fronts)) A.fronts = data.fronts.filter(f => f && typeof f.t === 'number').map(f => ({ i: f.i | 0, t: f.t }));
  }

  Object.assign(NS.allies, {
    ALLY, clear, setup, alive, feud, damage, rival, update, capture, restore
  });
})();
