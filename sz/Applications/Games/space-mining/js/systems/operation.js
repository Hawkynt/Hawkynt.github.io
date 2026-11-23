/* The operation of a career trip, launched from the belt map: it keeps the statistics its goals
   watch at the start, lays out the specials it needs, checks the objectives every step, runs
   its clock, sends pirates at the pace of the director (the beat of its timeline and the
   tension from the hull lost and the threats round the ship; in an escort round a freighter),
   counts the freighters delivered and lost, sets out the Syndicate's bases, forces the storm an
   operation asks for and pays
   its reward the moment it is won. A won or failed operation leaves the trip running as free mining; returning home
   settles one still running. Owns G.run.op. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { OP_BY_ID, MOODS } = NS.opsData;
  const O = NS.ops;
  const PC = NS.pacing;
  const R = NS.rng.fx;

  /* seconds between a decided operation and the next one starting in the same trip */
  const NEXT_IN = 10;

  const WHY = {
    time: 'The clock ran out - the trip goes on',
    lost: 'The ship was lost',
    home: 'You returned home before it was done',
    convoy: 'Too many freighters were lost',
    outpost: 'The outpost fell',
    escaped: 'Too many haulers got away',
    ally: 'The allied station fell',
  };

  /* the running operation flies with this modifier */
  function mod(id) {
    const o = G.run && G.run.op;
    return !!(o && o.status === 'active' && o.mods && o.mods.indexOf(id) >= 0);
  }

  /* the difficulty multipliers of the running operation (level 1 outside one) */
  function dm() {
    const o = G.run && G.run.op;
    return NS.skill.diff(o && o.status === 'active' ? o.diff : 1);
  }

  /* how many of a group the difficulty sends; floor: never fewer than the base (ambushes, raids) */
  function sized(n, floor) {
    const k = dm().size;
    return Math.max(1, Math.round(n * (floor ? Math.max(1, k) : k)));
  }

  /* every change of the flight controls is an action */
  function actions(o) {
    const inp = G.input, s = G.ship, k = inp.keys || {};
    let aim = '';
    if (inp.rightDown && s) aim = Math.round(Math.atan2(inp.aimWY - s.y, inp.aimWX - s.x) / (Math.PI / 4));
    const held = NS.hardpoints.state().held || [];
    const sig = Math.sign(inp.moveX || 0) + ',' + Math.sign(inp.moveY || 0) + ',' + (inp.thrustAxis || 0) + ',' + (inp.turn || 0) + ',' + (inp.boost ? 1 : 0) + ',' +
      (inp.firing || inp.mouseDown ? 1 : 0) + ',' + (inp.rightDown ? 1 : 0) + aim + ',' + (k.Space ? 1 : 0) + ',' + (k.KeyS ? 1 : 0) + ',' + (held[0] ? 1 : 0) + (held[1] ? 1 : 0) + (held[2] ? 1 : 0);
    if (o.sig !== undefined && sig !== o.sig) o.actions += 1;
    o.sig = sig;
  }

  /* what the operation guards, kept: the convoy, the outpost, the allied stations (null: nothing) */
  function kept(op, o) {
    if (op.convoy && G.freighters.length) return convoyHealth() / (2 * G.freighters.length);
    if (op.allies && G.allies.length) return G.allies.reduce((a, x) => a + (x.alive ? x.hp / x.maxHp : 0), 0) / G.allies.length;
    if (op.waves && !op.waves.off && o.keptMax > 0) return outpostHp() / o.keptMax;
    return null;
  }

  /* the mission score; it moves the difficulty level unless this is the weekly run */
  function scoreIt(o, op, won) {
    const s = G.ship;
    const prog = O.progress(op, measured(o));
    const progress = prog.length ? prog.reduce((a, p) => a + Math.min(1, p.have / p.n), 0) / prog.length : 0;
    o.score = Math.round(NS.skill.score({ won: won, hull: s ? Math.max(0, s.hull) / s.maxHull : 0, kept: kept(op, o), progress: progress, aps: o.actions / Math.max(1, o.t) }));
    if (!o.weekly) NS.skill.update(G.save.skill || (G.save.skill = NS.skill.blank()), o.score, op.mood);
    o.level = (G.save.skill || {}).level || 1;
  }

  function def() {
    const o = G.run && G.run.op;
    return o ? OP_BY_ID[o.id] : null;
  }

  /* tier: 'normal' | 'hard' | 'nightmare'; mods: forced modifiers (else the tier's own); weekly:
     the week's Nightmare Op */
  function start(id, tier, mods, weekly) {
    const op = OP_BY_ID[id];
    const run = G.run;
    if (!op || !run || run.mode !== 'career' || op.zone !== run.zone.id) return null;
    run.op = {
      id: id, t: 0, status: 'active', why: '', first: false, base: O.snapshot(op, G.save.stats),
      waveT: op.threat ? op.threat.first : 0, beat: 'build', pace: PC.create(), hull: G.ship ? G.ship.hull : 0, waves: 0,
      delivered: 0, lost: 0, paid: 0, ambushes: 0, hadHub: false, seeded: false, rad: false,
      tier: tier || 'normal', mods: mods ? mods.slice() : NS.tiers.modsFor(op, tier || 'normal'), weekly: !!weekly,
      /* the difficulty level it flies at (the weekly run is the same for everyone) and the actions taken */
      diff: weekly ? 1 : (G.save.skill || NS.skill.blank()).level, actions: 0, sig: undefined, keptMax: 0,
    };
    /* Dry tanks: the tank holds 60% */
    if (mod('dry') && G.ship) { G.ship.maxFuel *= 0.6; G.ship.fuel = Math.min(G.ship.fuel, G.ship.maxFuel); }
    if (mod('storm')) NS.hazards.forceStorm(20);
    if (op.force) for (const kind in op.force) {
      if (kind === 'storm') NS.hazards.forceStorm(op.force.storm);
      else if (kind === 'geode' || kind === 'derelict') for (let i = 0; i < op.force[kind]; ++i) NS.trip.addSpecial(kind, R, true);
    }
    if (op.convoy) NS.freighters.setup(op);
    if (op.syndicate) NS.aiBase.setup(op);
    NS.allies.setup(op);
    /* an outpost already standing takes the operation's wave pace at once */
    if (op.waves && G.base && NS.base.claimed()) NS.waves.arm(true);
    return run.op;
  }

  /* the outpost as the goals see it: a finished hub, finished buildings by type */
  function outpost(m) {
    const h = G.base && NS.base.hub();
    m.outpost = !!(h && h.prog >= 1);
    m.built = {};
    if (G.base) for (const b of G.base.data.buildings) if (b.prog >= 1 && !b.rogue) m.built[b.type] = (m.built[b.type] || 0) + 1;
  }

  function infected() {
    return !!G.base && G.base.data.buildings.some(b => (b.inf || 0) > 0.01);
  }

  /* what the trip measured so far; `extra` adds the hold settled on the way home */
  function measured(o, extra) {
    const run = G.run;
    const m = { units: run.bankedUnits || 0, banked: Object.assign({}, run.banked), stats: G.save.stats, base: o.base, delivered: o.delivered || 0,
      waves: run.waves || 0, clean: o.seeded && !!(G.base && NS.base.hub()) && !infected(),
      razed: run.razed || {}, scouted: NS.aiBase.scouted(), repelled: NS.aiBase.repelled(), t: o.t,
      crown: run.crownBroken || (run.zone.id === 'void' && G.save.crownDone && !G.rocks.some(r => r.kind === 'crown')) };
    outpost(m);
    if (extra) {
      m.units += extra.units;
      for (const id in extra.hold) m.banked[id] = (m.banked[id] || 0) + extra.hold[id];
    }
    return m;
  }

  function progress() {
    const o = G.run && G.run.op;
    return o ? O.progress(OP_BY_ID[o.id], measured(o)) : [];
  }

  /* pirates, and in an outpost operation the invaders closing on the outpost */
  function threats(op) {
    let n = 0;
    for (let i = 0; i < G.pirates.length; ++i) if (G.pirates[i].alive) ++n;
    const h = op && op.waves && G.base ? NS.base.hub() : null;
    if (h) for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (e.alive && !e.dormant && e.type !== 'hive' && Math.hypot(e.x - h.x, e.y - h.y) < 1400) ++n;
    }
    return n;
  }

  /* the outpost's hit points, all buildings summed */
  function outpostHp() {
    let hp = 0;
    if (G.base) for (const b of G.base.data.buildings) hp += Math.max(0, b.hp || 0);
    return hp;
  }

  /* the convoy's health: hull and cargo shares of every freighter summed (a lost one counts 0) */
  function convoyHealth() {
    let h = 0;
    for (let i = 0; i < G.freighters.length; ++i) {
      const f = G.freighters[i];
      if (f.state !== 'lost' && f.state !== 'short') h += f.state === 'done' ? 2 : f.hp / f.maxHp + f.cargo;
    }
    return h;
  }

  /* the belt's next open operation (or a failed one again), for a trip that goes on */
  function upNext() {
    const run = G.run;
    if (!run || run.mode !== 'career') return null;
    const list = O.zoneOps(run.zone.id);
    for (let i = 0; i < list.length; ++i) if (O.state(G.save, list[i].id) === 'open') return list[i];
    return null;
  }

  /* a decided operation hands over to the next one in the same trip after a short breather */
  function chain(o, dt) {
    if (o.why === 'lost' || G.run.ending || o.tier !== 'normal' || o.weekly) return;
    const next = upNext();
    if (!next) return;
    o.nextId = next.id;
    o.nextT = (o.nextT === undefined ? NEXT_IN : o.nextT) - dt;
    if (o.nextT > 0) return;
    start(next.id);
    G.run.op.chained = true;
    NS.trip.banner('NEXT OPERATION', next.name + ' - ' + next.goals[0].text, MOODS[next.mood].color);
  }

  function update(dt) {
    const o = G.run && G.run.op;
    if (o && o.status !== 'active') { chain(o, dt); return; }
    if (!o) return;
    const op = OP_BY_ID[o.id];
    o.t += dt;
    actions(o);
    if (op.waves && !op.waves.off) o.keptMax = Math.max(o.keptMax || 0, outpostHp());
    const s = G.ship;
    if (s && s.alive) {
      let lost = Math.max(0, o.hull - s.hull) / Math.max(1, s.maxHull);
      o.hull = s.hull;
      /* in an escort the convoy's hull and cargo hurt as much as the ship's */
      if (op.convoy) {
        const h = convoyHealth();
        if (o.convoyH !== undefined) lost += Math.max(0, o.convoyH - h) * 0.5;
        o.convoyH = h;
      }
      /* in an outpost operation the buildings' hit points hurt too (a fall in the total, as a
         share of the outpost, counts four times; repairs do not count back) */
      if (op.waves) {
        const hp = outpostHp(), n = G.base ? G.base.data.buildings.length : 0;
        if (o.baseHp !== undefined && n) lost += Math.max(0, o.baseHp - hp) / Math.max(1, hp + 1) * 4;
        o.baseHp = hp;
      }
      PC.track(o.pace, { hullLost: lost, threats: threats(op), cap: op.threat ? op.threat.cap : op.waves ? 24 : 8 }, dt);
    }
    if (op.waves) outbreaks(op, o, dt);
    if (((op.waves && !op.waves.off) || op.keep) && o.hadHub && !NS.base.hub()) return fail('outpost');
    if (op.syndicate && op.syndicate.escape && NS.aiBase.escapedCount() >= op.syndicate.escape) return fail('escaped');
    if (op.allies && op.allies.length && !NS.allies.alive()) return fail('ally');
    if (O.complete(op, measured(o))) return win();
    if (op.convoy && (o.lost || 0) > op.convoy.loss) return fail('convoy');
    if (op.time && o.t >= op.time) return fail('time');
    if (op.threat) director(op, o, dt);
    /* Endless storm: the next front is always on its way */
    if (mod('storm') && (!G.storm || (G.storm.phase === 'calm' && G.storm.t > 25))) NS.hazards.forceStorm(20);
  }

  /* the outpost side of an operation: the hub seen standing, the forced outbreak and the
     radiation season once the outpost is there */
  function outbreaks(op, o, dt) {
    const h = G.base && NS.base.hub();
    if (h && h.prog >= 1) o.hadHub = true;
    if (!o.hadHub) return;
    o.since = (o.since || 0) + dt;
    const f = op.force || {};
    if (f.outbreak && !o.seeded && o.since >= f.outbreak) {
      const crew = G.base.data.buildings.filter(b => b.prog >= 1 && b.type !== 'hub' && NS.colonyData.BUILDING_BY_ID[b.type].crew > 0 && !b.rogue);
      const b = crew.length ? crew[Math.floor(R() * crew.length)] : h;
      NS.outbreak.seedInfection(b, 0.3);
      o.seeded = true;
      NS.trip.banner('OUTBREAK', 'The Bloom has broken out in the ' + NS.colonyData.BUILDING_BY_ID[b.type].name, '#9ae04a');
      NS.audio.sfx('zap', { volume: 0.6, pitch: 0.6 });
    }
    if (f.radiation && !o.rad && o.since >= f.radiation.at) {
      o.rad = true;
      NS.hazards.season(G.base.site, f.radiation.n);
      NS.trip.banner('RADIATION SEASON', 'Clouds drift over the outpost - shield domes keep the buildings under them working', '#7cff4a');
    }
  }

  /* the wave pace of the running operation (null without one); off: no waves at all */
  function waveCfg() {
    const o = G.run && G.run.op;
    const op = o && o.status === 'active' ? OP_BY_ID[o.id] : null;
    return op && op.waves ? op.waves : null;
  }

  /* the pace for the outpost's wave clock: none when the operation sets none or turns them off */
  function wavePace() {
    const c = waveCfg();
    return c && !c.off ? c : null;
  }

  /* the pirates the director sends: each beat sets the pace, a peak or a surprise brings the
     next wave forward, docked pilots get a moment */
  function director(op, o, dt) {
    const beat = PC.beatAt(op.beats, o.t);
    if (beat !== o.beat) {
      o.beat = beat;
      if (beat === 'peak' || beat === 'surprise') o.waveT = Math.min(o.waveT, 2);
    }
    o.waveT -= dt;
    if (o.waveT > 0) return;
    if (G.cine || G.run.docked || !G.ship || !G.ship.alive) { o.waveT = 3; return; }
    const nx = PC.next(op.threat, beat, o.pace.tension);
    o.waveT = nx.wait / dm().pace;
    const n = Math.min(sized(nx.size), Math.round(op.threat.cap * dm().size) - threats(op));
    if (n > 0) send(op.threat.kinds, n, beat);
  }

  function pick(kinds) {
    let tot = 0;
    for (const k in kinds) tot += kinds[k];
    let roll = R() * tot;
    for (const k in kinds) if ((roll -= kinds[k]) < 0) return k;
    return Object.keys(kinds)[0];
  }

  function send(kinds, n, beat) {
    if (mod('swarm')) n = Math.ceil(n * 1.5);
    const s = (G.freighters.length && NS.freighters.anyFlying()) || G.ship;
    const a = R() * TAU;
    for (let i = 0; i < n; ++i) {
      const aa = a + (R() - 0.5) * 0.8;
      const d = 1050 + R() * 250;
      const x = Math.max(80, Math.min(G.world.w - 80, s.x + Math.cos(aa) * d));
      const y = Math.max(80, Math.min(G.world.h - 80, s.y + Math.sin(aa) * d));
      NS.pirates.spawn(pick(kinds), x, y);
    }
    G.run.op.waves += 1;
    if (beat === 'peak' || beat === 'surprise' || G.run.op.waves === 1)
      NS.trip.banner(beat === 'surprise' ? 'AMBUSH' : 'PIRATE SIGNAL', n + ' raiders inbound', '#ff5c6c');
    NS.audio.sfx('zap', { volume: 0.6, pitch: 0.4 });
  }

  function win() {
    const o = G.run.op, op = OP_BY_ID[o.id];
    o.status = 'won';
    const r = o.tier === 'normal' ? O.finish(G.save, op, true, o.t) : NS.tiers.finish(G.save, op, o.tier, true, o.t);
    if (o.weekly) o.wscore = (NS.tiers.finishWeekly(G.save, new Date(Date.now()), true, o.t) || {}).score;
    scoreIt(o, op, true);
    o.first = r.first;
    G.run.cleared = (G.run.cleared || 0) + 1;
    G.run.lastOp = report(o, op);
    NS.trip.banner('OPERATION COMPLETE', op.name + (r.first ? ' - reward paid' : ''), MOODS.E.color);
    NS.audio.sfx('levelup', { volume: 0.7 });
    NS.music.cue('win');
    NS.save.writeSave();
  }

  function fail(why) {
    const o = G.run.op, op = OP_BY_ID[o.id];
    o.status = 'failed';
    o.why = why;
    if (o.tier === 'normal') O.finish(G.save, op, false, o.t);
    else NS.tiers.finish(G.save, op, o.tier, false, o.t);
    scoreIt(o, op, false);
    NS.music.cue('lose');
    if (why === 'time' || why === 'convoy' || why === 'escaped' || why === 'ally') NS.trip.banner('OPERATION FAILED', WHY[why], MOODS.W.color);
    NS.save.writeSave();
  }

  /* The trip ends: a running operation is won by the hold settled now, or fails */
  function settle(reason, hold, units) {
    const o = G.run && G.run.op;
    if (!o) return null;
    const op = OP_BY_ID[o.id];
    if (o.status === 'active') {
      if (reason !== 'destroyed' && O.complete(op, measured(o, { hold: hold, units: units }))) win();
      /* one that started on its own after another was decided is simply left for the next trip */
      else if (o.chained && reason !== 'destroyed' && G.run.lastOp) return Object.assign({ cleared: G.run.cleared || 1 }, G.run.lastOp);
      else fail(reason === 'destroyed' ? 'lost' : 'home');
    }
    return report(o, op);
  }

  function report(o, op) {
    return { id: o.id, name: op.name, mood: op.mood, status: o.status, why: WHY[o.why] || '', first: o.first, reward: o.first ? op.reward : null,
      convoy: op.convoy ? { delivered: o.delivered || 0, lost: o.lost || 0, paid: o.paid || 0 } : null, cleared: G.run.cleared || 0,
      tier: o.tier || 'normal', mods: o.mods || [], weekly: !!o.weekly, wscore: o.wscore || 0, score: o.score || 0, level: o.level || 1, diff: o.diff || 1 };
  }

  Object.assign(NS.operation, {
    WHY, NEXT_IN, def, mod, dm, sized, start, progress, update, settle, waveCfg, wavePace, upNext
  });
})();
