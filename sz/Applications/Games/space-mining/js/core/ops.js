/* Pure operation rules: the chain of operations per belt, which ones are open, the capstone that
   gates the next licence, the loops a belt allows, objective progress from what a trip measured,
   recording a result with its first-clear reward, and the mood rule (never two peaks in a row,
   a breather or a surprise after a peak). No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { MOODS, LOOPS, OPS, OP_BY_ID } = NS.opsData;
  const { ZONES, ORE_BY_ID } = NS.ores;

  const LOOP_BY_ID = {};
  for (let i = 0; i < LOOPS.length; ++i) LOOP_BY_ID[LOOPS[i].id] = LOOPS[i];

  function zoneOps(zoneId) {
    return OPS.filter(o => o.zone === zoneId);
  }

  function capstoneOf(zoneId) {
    const list = zoneOps(zoneId);
    for (let i = 0; i < list.length; ++i) if (list[i].capstone) return list[i];
    return null;
  }

  /* ── the loops of the belts ── */
  function allows(zoneIndex, loopId) {
    const l = LOOP_BY_ID[loopId];
    return !!l && zoneIndex >= l.from;
  }

  function loopOf(zoneIndex) {
    for (let i = LOOPS.length - 1; i >= 0; --i) if (zoneIndex >= LOOPS[i].from) return LOOPS[i];
    return LOOPS[0];
  }

  /* ── opening ── */
  function done(save, id) {
    return !!(save.ops[id] && save.ops[id].done);
  }

  /* locked | open | done: the first of a belt opens with its licence, the rest one after another */
  function state(save, id) {
    const o = OP_BY_ID[id];
    if (!o) return 'locked';
    if (done(save, id)) return 'done';
    if (save.licenses.indexOf(o.zone) < 0) return 'locked';
    const list = zoneOps(o.zone);
    const k = list.indexOf(o);
    return k <= 0 || done(save, list[k - 1].id) ? 'open' : 'locked';
  }

  /* The licence of belt `zoneIndex` needs the capstone of the belt before it, once that has one */
  function licenceReady(save, zoneIndex) {
    const prev = ZONES[zoneIndex - 1];
    if (!prev) return true;
    const cap = capstoneOf(prev.id);
    return !cap || done(save, cap.id);
  }

  /* ── progress ──
     m: { units (banked), banked: { ore: units }, stats (career statistics now), base (at the start),
          delivered (freighters docked at their post), waves (repelled this trip), outpost (a
          finished hub in the belt), built (finished buildings by type), clean (an outbreak the
          operation started is over) } */
  function measure(g, m) {
    if (g.type === 'bank') return m.units || 0;
    if (g.type === 'ore') return (m.banked && m.banked[g.ore]) || 0;
    if (g.type === 'value') {
      let v = 0;
      for (const id in m.banked) if (ORE_BY_ID[id]) v += m.banked[id] * ORE_BY_ID[id].value;
      return v;
    }
    if (g.type === 'record') return (m.stats && m.stats[g.stat]) || 0;
    if (g.type === 'deliver') return m.delivered || 0;
    if (g.type === 'waves') return m.waves || 0;
    if (g.type === 'outpost') return m.outpost ? 1 : 0;
    if (g.type === 'clean') return m.clean ? 1 : 0;
    if (g.type === 'build') {
      let n = 0;
      for (const t in m.built || {}) {
        const d = NS.colonyData.BUILDING_BY_ID[t];
        if (d && (g.of ? g.of.indexOf(t) >= 0 : d.cat === g.cat)) n += m.built[t];
      }
      return n;
    }
    let n = 0;
    for (let i = 0; i < g.stats.length; ++i) n += ((m.stats && m.stats[g.stats[i]]) || 0) - ((m.base && m.base[g.stats[i]]) || 0);
    return n;
  }

  function progress(op, m) {
    return op.goals.map(g => {
      const have = Math.max(0, Math.min(g.n, Math.floor(measure(g, m))));
      return { goal: g, have: have, n: g.n, done: have >= g.n };
    });
  }

  function complete(op, m) {
    return progress(op, m).every(p => p.done);
  }

  /* The statistics an operation's goals watch, as they stand now */
  function snapshot(op, stats) {
    const out = {};
    for (let i = 0; i < op.goals.length; ++i) {
      const g = op.goals[i];
      const keys = g.stats || (g.stat ? [g.stat] : []);
      for (let k = 0; k < keys.length; ++k) out[keys[k]] = stats[keys[k]] || 0;
    }
    return out;
  }

  /* ── results ── */
  function finish(save, op, won, secs) {
    const rec = save.ops[op.id] || (save.ops[op.id] = { done: false, tries: 0, best: 0 });
    rec.tries += 1;
    if (!won) return { first: false, reward: null };
    const first = !rec.done;
    rec.done = true;
    const t = Math.max(1, Math.round(secs || 0));
    if (!rec.best || t < rec.best) rec.best = t;
    if (!first) return { first: false, reward: null };
    const rw = op.reward || {};
    save.credits += rw.cr || 0;
    save.stats.earned = (save.stats.earned || 0) + (rw.cr || 0);
    save.rd += rw.rd || 0;
    if (rw.unlock) for (let i = 0; i < rw.unlock.length; ++i) if (save.unlocks.indexOf(rw.unlock[i]) < 0) save.unlocks.push(rw.unlock[i]);
    if (save.weapons && NS.combat.grantUnlocked) NS.combat.grantUnlocked(save);
    return { first: true, reward: rw };
  }

  /* ── the mood rule ── */
  function moodsOk(list) {
    for (let i = 1; i < list.length; ++i) {
      const prev = MOODS[list[i - 1].mood], cur = list[i].mood;
      if (prev && prev.peak && cur !== 'E' && cur !== 'S') return false;
    }
    return true;
  }

  /* A repaired map of operation records from anything stored */
  function repair(src) {
    const out = {};
    if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
    for (const id in src) {
      const r = src[id];
      if (!OP_BY_ID[id] || !r || typeof r !== 'object') continue;
      const n = (v, hi) => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(hi, Math.floor(v))) : 0;
      out[id] = { done: !!r.done, tries: n(r.tries, 1e6), best: n(r.best, 1e7) };
    }
    return out;
  }

  Object.assign(NS.ops, {
    MOODS, LOOPS, zoneOps, capstoneOf, allows, loopOf, done, state, licenceReady, progress, complete, snapshot, finish, moodsOk, repair
  });
})();
