/* Autosave and continue: a compact snapshot of a running Career or Siege trip (the trip
   counters, the ship, every rock, cloud, unit, invader and shot-free battle state, the wave
   clock, the distress mission and, in Siege, the outpost itself) written into the save every
   few seconds and when the page hides, and the restore that rebuilds the trip exactly there
   after a reload. Career outposts live in the save already. Reads and writes G.save.resume. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { ORES, ORE_BY_ID } = NS.ores;
  const { UNIT_BY_ID, ENEMY_BY_ID } = NS.fleetData;

  const RUN_KEYS = ['t', 'cargoUsed', 'units', 'rd', 'rdAcc', 'salvage', 'fractures', 'kills', 'damage', 'charges', 'timeLeft', 'contam',
    'survivors', 'waves', 'invaders', 'credits', 'planAt', 'pirateT', 'leftDock', 'bosses', 'crownBroken'];

  const r1 = (v) => Math.round(v * 10) / 10;

  function capture() {
    const run = G.run, s = G.ship;
    if (!run || !s || run.ending || (run.mode !== 'career' && run.mode !== 'siege') || !s.alive) return null;
    const snap = { v: 1, mode: run.mode, zone: run.zoneIndex, seed: run.seed, day: NS.rng.dayKey(), run: {}, ship: null, rocks: [], units: [], enemies: [], clouds: [] };
    for (let i = 0; i < RUN_KEYS.length; ++i) snap.run[RUN_KEYS[i]] = run[RUN_KEYS[i]];
    snap.run.cargo = Object.assign({}, run.cargo);
    snap.run.banked = Object.assign({}, run.banked);
    snap.run.bankedUnits = run.bankedUnits || 0;
    snap.run.service = run.service || 0;
    snap.run.plan = run.plan || [];
    snap.ship = { x: r1(s.x), y: r1(s.y), vx: r1(s.vx), vy: r1(s.vy), angle: r1(s.angle), hull: r1(s.hull), fuel: r1(s.fuel), shield: r1(s.shield) };
    for (let i = 0; i < G.rocks.length; ++i) {
      const o = G.rocks[i];
      if (!o.alive) continue;
      snap.rocks.push([o.kind, r1(o.x), r1(o.y), r1(o.vx), r1(o.vy), o.tier, o.ore ? ORE_BY_ID[o.ore].index : -1, Math.round(o.rich * 100) / 100,
        r1(o.hp), r1(o.maxHp), r1(o.r), r1(o.rot), o.variant, o.volatile ? 1 : 0, o.bio || 0, o.found ? 1 : 0, o.known ? 1 : 0]);
    }
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (u.alive) snap.units.push({ type: u.type, side: u.side, x: r1(u.x), y: r1(u.y), hp: r1(u.hp), kills: u.kills, cor: Math.round(u.cor * 100) / 100 });
    }
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (e.alive) snap.enemies.push({ type: e.type, x: r1(e.x), y: r1(e.y), hp: r1(e.hp), maxHp: r1(e.maxHp), shield: r1(e.shield), dormant: e.dormant ? 1 : 0,
        wave: e.wave, home: e.home, migrate: e.migrate, guard: e.guard });
    }
    for (let i = 0; i < G.clouds.length; ++i) {
      const c = G.clouds[i];
      snap.clouds.push({ x: r1(c.x), y: r1(c.y), r: r1(c.r), r0: c.r0, res: c.res, bio: c.bio, amount: c.amount, max: c.max, vx: c.vx, vy: c.vy, seed: c.seed });
    }
    const b = G.base;
    if (b) {
      NS.base.sync();
      snap.wave = { waveT: r1(b.waveT), active: b.active, waveNo: b.waveNo || 0, empCd: r1(b.empCd) };
      if (b.mode === 'siege') snap.base = JSON.parse(JSON.stringify(b.data, (k, v) => k.charAt(0) === '_' ? undefined : v));
    }
    if (G.distress) {
      const d = G.distress;
      snap.distress = { x: d.x, y: d.y, kind: d.kind, state: d.state, survivors: d.survivors, angle: d.angle };
    }
    return snap;
  }

  function save() {
    if (!G.save) return;
    const snap = capture();
    if (snap) {
      G.save.resume = snap;
      NS.save.writeSave();
    }
  }

  function clear() {
    if (G.save) G.save.resume = null;
  }

  function valid(snap) {
    return snap && snap.v === 1 && (snap.mode === 'career' || snap.mode === 'siege') && NS.ores.ZONES[snap.zone] && snap.ship && Array.isArray(snap.rocks);
  }

  /* After startTrip has built the belt from the same seed: put everything back where it was */
  function restore(snap) {
    const run = G.run;
    for (let i = 0; i < RUN_KEYS.length; ++i) if (snap.run[RUN_KEYS[i]] !== undefined) run[RUN_KEYS[i]] = snap.run[RUN_KEYS[i]];
    run.cargo = {};
    for (const id in snap.run.cargo) if (ORE_BY_ID[id] && snap.run.cargo[id] > 0) run.cargo[id] = snap.run.cargo[id];
    run.plan = Array.isArray(snap.run.plan) ? snap.run.plan : [];
    run.banked = {};
    for (const id in snap.run.banked || {}) if (ORE_BY_ID[id] && snap.run.banked[id] > 0) run.banked[id] = snap.run.banked[id];
    run.bankedUnits = +snap.run.bankedUnits || 0;
    run.service = +snap.run.service || 0;
    const s = G.ship, p = snap.ship;
    s.x = p.x; s.y = p.y; s.vx = p.vx; s.vy = p.vy; s.angle = p.angle;
    s.hull = Math.min(s.maxHull, p.hull);
    s.fuel = Math.min(s.maxFuel, p.fuel);
    s.shield = Math.min(s.maxShield, p.shield);
    G.rocks.length = 0;
    for (let i = 0; i < snap.rocks.length; ++i) {
      const a = snap.rocks[i];
      const o = NS.asteroids.restoreRock(a[0], a[1], a[2], a[5], a[6] >= 0 && ORES[a[6]] ? ORES[a[6]].id : null, a[7]);
      o.vx = a[3]; o.vy = a[4]; o.hp = a[8]; o.maxHp = a[9]; o.r = a[10]; o.rot = a[11]; o.variant = a[12] & 3;
      o.volatile = !!a[13];
      if (a[14]) o.bio = a[14];
      o.found = !!a[15];
      o.known = !!a[16];
      G.rocks.push(o);
    }
    NS.asteroids.rebuildGrid();
    G.clouds.length = 0;
    for (let i = 0; i < snap.clouds.length; ++i) {
      const c = snap.clouds[i];
      if (!ORE_BY_ID[c.res]) continue;
      G.clouds.push({ x: c.x, y: c.y, r: c.r, r0: c.r0, res: c.res, bio: !!c.bio, amount: c.amount, max: c.max, vx: c.vx, vy: c.vy, seed: c.seed, phase: 0, acc: 0, alive: true });
    }
    NS.units.clear();
    for (let i = 0; i < snap.units.length; ++i) {
      const q = snap.units[i];
      if (!UNIT_BY_ID[q.type]) continue;
      const u = NS.units.spawn(q.type, q.x, q.y, q.side === 'rogue' ? 'rogue' : 'player');
      u.kills = q.kills || 0;
      NS.units.rank(u);
      u.hp = Math.min(u.maxHp, q.hp);
      u.cor = q.cor || 0;
      u.orders = [];
    }
    NS.enemies.clear();
    for (let i = 0; i < snap.enemies.length; ++i) {
      const q = snap.enemies[i];
      if (!ENEMY_BY_ID[q.type]) continue;
      const e = NS.enemies.spawn(q.type, q.x, q.y, { dormant: !!q.dormant, wave: q.wave, home: q.home, migrate: q.migrate, guard: q.guard });
      e.maxHp = q.maxHp || e.maxHp;
      e.hp = Math.min(e.maxHp, q.hp);
      e.shield = Math.min(e.maxShield, q.shield || 0);
    }
    const b = G.base;
    if (b && snap.wave) {
      b.waveT = snap.wave.waveT;
      b.empCd = snap.wave.empCd || 0;
      if (snap.wave.active) {
        b.active = true;
        b.activeT = 0;
        b.waveNo = snap.wave.waveNo;
        b.spawnQ = [];
        b.next = null;
      }
    }
    if (snap.distress) {
      const d = snap.distress;
      G.distress = { x: d.x, y: d.y, kind: d.kind, state: d.state, survivors: d.survivors, angle: d.angle, t: 0, alive: true,
        guards: G.enemies.filter(e => e.guard && Math.abs(e.guard.x - d.x) < 1 && Math.abs(e.guard.y - d.y) < 1) };
    }
    NS.camera.snap(s.x, s.y);
  }

  Object.assign(NS.resume, {
    capture, save, clear, valid, restore
  });
})();
