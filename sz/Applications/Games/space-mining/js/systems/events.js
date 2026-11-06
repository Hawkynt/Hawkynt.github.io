/* Belt events in a running trip: the seeded schedule (outbreaks, distress calls, migrating
   broods, nanoprobe incursions) with banners and first-time cinematics; the distress mission
   (a silent station guarded by a hive or Lattice drones - clear it, dock, bring survivors home
   or to your outpost); the abandoned outpost that became a hive; reactions to infection,
   deaths, abandonment, corruption, hijacked buildings and deserters; and the captain's log,
   whose chapters unlock from save counters and play at the station. Owns G.distress. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { EVENTS, CHAPTERS, CHAPTER_BY_ID } = NS.eventData;
  const { BUILDING_BY_ID } = NS.colonyData;
  const rules = NS.rules;
  const R = NS.rng.fx;

  let warnT = 0;

  function career() {
    return G.run && G.run.mode === 'career';
  }

  function setup(zone, seed, mods) {
    G.distress = null;
    const run = G.run;
    run.plan = run.mode === 'career' || run.mode === 'siege'
      ? NS.calendar.planEvents(seed, zone, { hasBase: NS.base.claimed(), career: run.mode === 'career', mods: mods }) : [];
    run.planAt = 0;
    const b = G.base;
    if (b && b.data.abandoned && b.data.hive) {
      const h = NS.base.hub();
      if (h) NS.enemies.spawn('hive', h.x + 40, h.y - 30, { home: 'base', hpMul: 1.4 });
    }
  }

  function update(dt) {
    const run = G.run;
    warnT -= dt;
    while (run.plan && run.planAt < run.plan.length && run.plan[run.planAt].t <= run.t) trigger(run.plan[run.planAt++].kind);
    mission(dt);
    if (career()) {
      run.logT = (run.logT || 0) - dt;
      if (run.logT <= 0) {
        run.logT = 1.5;
        checkChapters();
      }
    }
  }

  function banner(kind) {
    const e = EVENTS[kind];
    NS.trip.banner(e.banner, e.sub, e.color);
    NS.audio.sfx('zap', { volume: 0.6, pitch: 0.45 });
  }

  function edgePoint(a) {
    const cx = G.world.w / 2, cy = G.world.h / 2;
    return { x: Math.max(60, Math.min(G.world.w - 60, cx + Math.cos(a) * G.world.w)), y: Math.max(60, Math.min(G.world.h - 60, cy + Math.sin(a) * G.world.h)) };
  }

  function trigger(kind) {
    const b = G.base;
    if (kind === 'outbreak') {
      if (!b || !NS.base.claimed() || b.data.abandoned) return;
      const list = b.data.buildings.filter(o => o.prog >= 1 && (o._staff || 0) > 0);
      if (!list.length) return;
      const t = list[Math.floor(R() * list.length)];
      NS.outbreak.seedInfection(t, 0.3);
      banner('outbreak');
      infected(t);
    } else if (kind === 'distress') distress();
    else if (kind === 'migration') {
      const a = R() * TAU;
      const p = edgePoint(a), q = edgePoint(a + Math.PI + (R() - 0.5) * 0.8);
      const n = 12 + Math.floor(R() * 10);
      for (let i = 0; i < n; ++i) {
        const e = NS.enemies.spawn('swarmer', p.x + (R() - 0.5) * 300, p.y + (R() - 0.5) * 300, { migrate: { x: q.x + (R() - 0.5) * 300, y: q.y + (R() - 0.5) * 300 } });
        e.angle = a + Math.PI;
      }
      NS.enemies.spawn('carrier', p.x, p.y, { migrate: { x: q.x, y: q.y } });
      banner('migration');
    } else if (kind === 'nanoprobe') {
      if (!b || !NS.base.claimed()) return;
      const h = NS.base.hub();
      const a = R() * TAU;
      const p = { x: Math.max(80, Math.min(G.world.w - 80, h.x + Math.cos(a) * 1300)), y: Math.max(80, Math.min(G.world.h - 80, h.y + Math.sin(a) * 1300)) };
      const n = 3 + Math.floor(R() * 3 * (b.mods ? Math.min(2, b.mods.nano) : 1));
      for (let i = 0; i < n; ++i) NS.enemies.spawn('nanoswarm', p.x + (R() - 0.5) * 200, p.y + (R() - 0.5) * 200, {});
      for (let i = 0; i < 4; ++i) NS.enemies.spawn('nanodrone', p.x + (R() - 0.5) * 200, p.y + (R() - 0.5) * 200, {});
      banner('nanoprobe');
      if (career() && !G.save.cine.lattice) {
        G.save.cine.lattice = true;
        NS.cinematics.play('lattice', { x: p.x, y: p.y });
      }
    }
  }

  /* ── the distress mission ── */
  function distress() {
    const run = G.run;
    let p = null;
    for (let i = 0; i < 60 && !p; ++i) {
      const q = { x: 500 + R() * (G.world.w - 1000), y: 500 + R() * (G.world.h - 1000) };
      const dd = (q.x - G.dock.x) * (q.x - G.dock.x) + (q.y - G.dock.y) * (q.y - G.dock.y);
      if (dd > 1400 * 1400 && !NS.base.blocks(q.x, q.y, 500)) p = q;
    }
    if (!p) return;
    const kind = run.zone.nano > 0.2 && R() < 0.5 ? 'lattice' : 'bloom';
    const d = G.distress = { x: p.x, y: p.y, kind: kind, state: 'guarded', survivors: 3 + Math.floor(R() * 4), guards: [], angle: R() * TAU, t: 0, alive: true };
    if (kind === 'bloom') {
      d.guards.push(NS.enemies.spawn('hive', p.x + 120, p.y - 60, { home: 'distress' }));
      for (let i = 0; i < 5; ++i) d.guards.push(NS.enemies.spawn('swarmer', p.x + (R() - 0.5) * 300, p.y + (R() - 0.5) * 300, { guard: { x: p.x, y: p.y } }));
    } else {
      for (let i = 0; i < 5; ++i) d.guards.push(NS.enemies.spawn('nanodrone', p.x + (R() - 0.5) * 300, p.y + (R() - 0.5) * 300, { guard: { x: p.x, y: p.y } }));
      d.guards.push(NS.enemies.spawn('frigate', p.x - 140, p.y + 80, { guard: { x: p.x, y: p.y } }));
    }
    for (let i = 0; i < d.guards.length; ++i) d.guards[i].guard = { x: p.x, y: p.y };
    banner('distress');
  }

  function mission(dt) {
    const d = G.distress;
    if (!d) return;
    d.t += dt;
    const s = G.ship;
    if (d.state === 'guarded' && d.guards.every(e => !e.alive)) {
      d.state = 'clear';
      NS.trip.banner('STATION CLEAR', 'Dock slowly at the silent station to rescue the survivors', '#ffd25a');
    }
    if (d.state !== 'clear' || !s || !s.alive) return;
    const dd = (s.x - d.x) * (s.x - d.x) + (s.y - d.y) * (s.y - d.y);
    if (dd > 120 * 120 || s.vx * s.vx + s.vy * s.vy > 160 * 160) return;
    d.state = 'rescued';
    G.run.survivors += d.survivors;
    NS.mining.spawnSalvage(d.x, d.y, 400 + G.run.zone.danger * 250, 6);
    for (let i = 0; i < 6; ++i) NS.mining.spawnNugget(d.x, d.y, 'scrap', 1, null, 160);
    NS.fx.ring(d.x, d.y, 20, 220, 0.8, '#ffd25a', 5);
    NS.trip.banner(d.survivors + ' SURVIVORS ABOARD', 'Bring them to your outpost as crew - or home for a bounty', '#ffd25a');
    NS.audio.sfx('win', { volume: 0.6 });
    if (career()) {
      rules.bump(G.save, 'reclaims', 1);
      log('silence');
    }
  }

  /* ── reactions from the outbreak model ── */
  function outbreakEvents(list) {
    for (let i = 0; i < list.length; ++i) {
      const e = list[i];
      const b = e.b;
      switch (e.type) {
        case 'death':
          NS.fx.text(b.x, b.y - 30, 'CREW LOST', '#ff5c6c', 14, 1.4);
          break;
        case 'spread':
          NS.fx.ring(b.x, b.y, 6, b.r * 1.8, 0.6, '#9ae04a', 2);
          break;
        case 'cured':
          if (career()) rules.bump(G.save, 'cured', e.n);
          NS.fx.text(b.x, b.y - 30, 'CURED', '#c8ffd0', 14, 1.2);
          break;
        case 'abandoned':
          NS.trip.banner('OUTPOST ABANDONED', 'The last of the crew is gone - the lights go out', '#ff5c6c');
          NS.audio.sfx('lose', { volume: 0.6 });
          if (career()) rules.bump(G.save, 'abandoned', 1);
          break;
        case 'rogue': rogue(b); break;
        case 'corrupt': corrupted(b); break;
      }
    }
  }

  function infected(b) {
    if (career()) {
      rules.bump(G.save, 'infections', 1);
      if (!G.save.cine.outbreak && b) {
        G.save.cine.outbreak = true;
        NS.cinematics.play('outbreak', { x: b.x, y: b.y });
      }
    }
  }

  function corrupted(b) {
    if (warnT > 0) return;
    warnT = 12;
    NS.trip.banner('NANOPROBE CORRUPTION', BUILDING_BY_ID[b.type].name + ' is being rewritten - purge it', '#3affd0');
  }

  function rogue(b) {
    NS.trip.banner(BUILDING_BY_ID[b.type].name.toUpperCase() + ' HIJACKED', 'The Lattice turned it against you - purge or destroy it', '#3affd0');
    NS.audio.sfx('zap', { volume: 0.8, pitch: 0.3 });
    NS.fx.ring(b.x, b.y, b.r, b.r * 4, 0.8, '#3affd0', 4);
    if (career()) {
      rules.bump(G.save, 'corruptions', 1);
      log('lattice');
    }
  }

  function deserted(u) {
    NS.trip.banner(u.def.name.toUpperCase() + ' DESERTED', 'Nanoprobes took the crew - it fights for the Lattice now', '#3affd0');
    if (career()) rules.bump(G.save, 'corruptions', 1);
  }

  function hiveWakes(e) {
    banner('hive');
    if (career()) rules.bump(G.save, 'hives', 1);
  }

  function hiveDown(e) {
    if (e.home === 'base') NS.trip.banner('THE HIVE IS DEAD', 'Reclaim the outpost from its hub', '#ffd25a');
  }

  /* ── the captain's log ── */
  function log(id) {
    if (!career() && !(G.save && id)) return;
    const save = G.save;
    if (!CHAPTER_BY_ID[id] || save.log.indexOf(id) >= 0) return;
    save.log.push(id);
    NS.screens.toast('Captain\'s log: ' + CHAPTER_BY_ID[id].title, CHAPTER_BY_ID[id].color);
  }

  function checkChapters() {
    const save = G.save;
    for (let i = 0; i < CHAPTERS.length; ++i) {
      const c = CHAPTERS[i];
      if (save.log.indexOf(c.id) < 0 && (save.stats[c.stat] || 0) >= c.need) log(c.id);
    }
  }

  /* the first unlocked chapter not yet shown */
  function pendingLog() {
    const save = G.save;
    for (let i = 0; i < save.log.length; ++i) if (save.logSeen.indexOf(save.log[i]) < 0) return save.log[i];
    return null;
  }

  function playLog(id, then) {
    const save = G.save;
    if (save.logSeen.indexOf(id) < 0) save.logSeen.push(id);
    NS.cinematics.play('log', { chapter: CHAPTER_BY_ID[id] }, then);
  }

  Object.assign(NS.events, {
    setup, update, trigger, distress, outbreakEvents, infected, corrupted, rogue, deserted, hiveWakes, hiveDown, log, checkChapters,
    pendingLog, playLog
  });
})();
