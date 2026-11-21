/* The operation of a career trip, launched from the belt map: it keeps the statistics its goals
   watch at the start, lays out the specials it needs, checks the objectives every step, runs
   its clock, sends pirates at the pace of the director (the beat of its timeline and the
   tension from the hull lost and the threats round the ship) and pays its reward the moment it
   is won. A won or failed operation leaves the trip running as free mining; returning home
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

  const WHY = {
    time: 'The clock ran out - the trip goes on',
    lost: 'The ship was lost',
    home: 'You returned home before it was done',
  };

  function def() {
    const o = G.run && G.run.op;
    return o ? OP_BY_ID[o.id] : null;
  }

  function start(id) {
    const op = OP_BY_ID[id];
    const run = G.run;
    if (!op || !run || run.mode !== 'career' || op.zone !== run.zone.id) return null;
    run.op = {
      id: id, t: 0, status: 'active', why: '', first: false, base: O.snapshot(op, G.save.stats),
      waveT: op.threat ? op.threat.first : 0, beat: 'build', pace: PC.create(), hull: G.ship ? G.ship.hull : 0, waves: 0,
    };
    if (op.force) for (const kind in op.force) for (let i = 0; i < op.force[kind]; ++i) NS.trip.addSpecial(kind, R, true);
    return run.op;
  }

  /* what the trip measured so far; `extra` adds the hold settled on the way home */
  function measured(o, extra) {
    const run = G.run;
    const m = { units: run.bankedUnits || 0, banked: Object.assign({}, run.banked), stats: G.save.stats, base: o.base };
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

  function threats() {
    let n = 0;
    for (let i = 0; i < G.pirates.length; ++i) if (G.pirates[i].alive) ++n;
    return n;
  }

  function update(dt) {
    const o = G.run && G.run.op;
    if (!o || o.status !== 'active') return;
    const op = OP_BY_ID[o.id];
    o.t += dt;
    const s = G.ship;
    if (s && s.alive) {
      const lost = Math.max(0, o.hull - s.hull) / Math.max(1, s.maxHull);
      o.hull = s.hull;
      PC.track(o.pace, { hullLost: lost, threats: threats(), cap: op.threat ? op.threat.cap : 8 }, dt);
    }
    if (O.complete(op, measured(o))) return win();
    if (op.time && o.t >= op.time) return fail('time');
    if (op.threat) director(op, o, dt);
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
    o.waveT = nx.wait;
    const n = Math.min(nx.size, op.threat.cap - threats());
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
    const s = G.ship;
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
    const r = O.finish(G.save, op, true, o.t);
    o.first = r.first;
    NS.trip.banner('OPERATION COMPLETE', op.name + (r.first ? ' - reward paid' : ''), MOODS.E.color);
    NS.audio.sfx('levelup', { volume: 0.7 });
    if (SZ.GameMusic && SZ.GameMusic.stinger) SZ.GameMusic.stinger('win');
    NS.save.writeSave();
  }

  function fail(why) {
    const o = G.run.op, op = OP_BY_ID[o.id];
    o.status = 'failed';
    o.why = why;
    O.finish(G.save, op, false, o.t);
    if (why === 'time') NS.trip.banner('OPERATION FAILED', WHY.time, MOODS.W.color);
    NS.save.writeSave();
  }

  /* The trip ends: a running operation is won by the hold settled now, or fails */
  function settle(reason, hold, units) {
    const o = G.run && G.run.op;
    if (!o) return null;
    const op = OP_BY_ID[o.id];
    if (o.status === 'active') {
      if (reason !== 'destroyed' && O.complete(op, measured(o, { hold: hold, units: units }))) win();
      else fail(reason === 'destroyed' ? 'lost' : 'home');
    }
    return { id: o.id, name: op.name, mood: op.mood, status: o.status, why: WHY[o.why] || '', first: o.first, reward: o.first ? op.reward : null };
  }

  Object.assign(NS.operation, {
    WHY, def, start, progress, update, settle
  });
})();
