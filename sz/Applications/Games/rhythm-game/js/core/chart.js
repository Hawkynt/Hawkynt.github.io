/* Charts from composed music. build(song, opts) walks the song bar by bar from its first groove, the
   same positions SZ.GameMusic.play advances through at a steady intensity of 0.5, takes every onset
   of SZ.GameMusic.compose (kick, snare, clap, toms, hats, bass, arpeggio, lead, stabs, bells) with the
   song's swing, scores each by how much it drives the music, and keeps the strongest onsets that a
   level allows: a minimum gap in seconds and an importance threshold, both from the level (0 easy
   ... 1 expert). The kept onsets get lanes (melodies climb and fall across the lanes with their pitch,
   kicks sit left, snares right, tom fills run down), an anti-jack rule moves quick repeats to a
   neighbour lane, and the note kinds a district teaches are added: holds on long notes, chords on
   stabs and stacked hits, Hush notes in free lanes between notes, drift notes that slide in from a
   free neighbour lane. Star phrases mark two bars of each drop, pickups ride a note every twelve bars
   and duels get attack slots every four bars (Hammerfall's Hush notes precomputed per slot). Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const { makeRng, hashString } = NS.rng;

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const MELODIC = { lead: 1, stab: 1, bass: 1, arp: 1, bell: 1 };
  const PICKUPS = ['shield', 'heart', 'magnet', 'mult'];

  function importance(n, sec) {
    const on = n.t % 4 === 0;
    let v;
    switch (n.inst) {
      case 'kick': v = on ? 1 : 0.78; break;
      case 'snare': v = sec === 'build' && n.vol < 0.6 * 0.7 ? 0.55 : 0.95; break;
      case 'clap': v = 0.9; break;
      case 'lead': v = on ? 0.95 : 0.88; break;
      case 'stab': v = 0.8; break;
      case 'tom': v = 0.76; break;
      case 'bass': v = on ? 0.68 : 0.58; break;
      case 'bell': v = 0.5; break;
      case 'arp': v = n.t % 2 ? 0.32 : 0.42; break;
      case 'open': v = 0.3; break;
      case 'hat': v = n.t % 2 ? 0.12 : 0.18; break;
      default: return 0;
    }
    const k = sec === 'drop' ? 1 : sec === 'groove' ? 0.97 : sec === 'build' ? 0.93 : sec === 'intro' ? 0.9 : 0.85;
    return v * k;
  }

  /* the tuning of a level: gaps, threshold, timing windows and groove drain */
  function params(level) {
    const L = clamp(level, 0, 1);
    return {
      L: L,
      perBeat: lerp(0.55, 3.3, Math.pow(L, 1.15)),
      thr: lerp(0.93, 0.12, L),
      jack: lerp(0.62, 0.17, L),
      win: lerp(1.35, 1, L),
      drain: lerp(0.075, 0.12, L),
      chordGap: lerp(2.2, 0.45, L),
      look: lerp(1.75, 1.3, L),
    };
  }

  /* the positions of the song's bars from its first groove (as the player advances them) */
  function positions(R, bars, from) {
    const M = SZ.GameMusic;
    const out = [];
    let pos = M.start(R, from);
    for (let b = 0; b < bars; ++b) {
      out.push(pos);
      pos = M.advance(R, pos, 0.5);
    }
    return out;
  }

  function insertSorted(arr, v) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
    arr.splice(lo, 0, v);
    return lo;
  }

  function lowerBound(arr, v) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
    return lo;
  }

  function nearestGap(arr, v) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
    let g = Infinity;
    if (lo < arr.length) g = Math.min(g, Math.abs(arr[lo] - v));
    if (lo > 0) g = Math.min(g, Math.abs(arr[lo - 1] - v));
    return g;
  }

  /* opts: level (0..1), bars, kinds { hold, chord, hush, drift } (true or a rate 0..1), boss (attack
     kind list), lucky, mirror, from ('groove'), seed */
  function build(song, opts) {
    opts = opts || {};
    const M = SZ.GameMusic;
    const R = M.resolve(song);
    const P = params(opts.level == null ? 0.5 : opts.level);
    const bars = opts.bars || 32;
    const from = opts.from || (R.form === 'calm' ? null : 'groove');
    const beat = 60 / R.bpm, six = beat / 4, barLen = beat * 4;
    const swing = R.swing || 0;
    const rng = makeRng(hashString((song.id || 'song') + ':' + (opts.seed || 0) + ':' + Math.round(P.L * 100)));
    const kinds = opts.kinds || {};
    const rate = k => (kinds[k] === true ? 1 : +kinds[k] || 0);
    const pos = positions(R, bars, from);
    const sections = pos.map(p => M.sectionOf(R, p).name);

    /* 1. onsets grouped into slots by bar and step */
    const slots = [];
    for (let b = 0; b < bars; ++b) {
      const by = {};
      for (const n of M.compose(R, b, 0.5, pos[b])) {
        const imp = importance(n, sections[b]);
        if (!imp) continue;
        const step = n.t;
        const s = by[step] || (by[step] = { bar: b, step: step, t: b * barLen + step * six + (step % 2 === 1 ? swing * six : 0), imp: 0, src: [], melodic: null, drum: null, stab: 0 });
        s.src.push(n.inst);
        if (n.inst === 'stab') ++s.stab;
        if (MELODIC[n.inst]) {
          if (!s.melodic || imp > s.melodic.imp || (imp === s.melodic.imp && n.midi > s.melodic.midi)) s.melodic = { imp: imp, midi: n.midi, dur: n.dur, inst: n.inst };
        } else if (!s.drum || imp > s.drum.imp) s.drum = { imp: imp, inst: n.inst, t: n.t };
        s.imp = Math.max(s.imp, imp);
      }
      for (const k in by) slots.push(by[k]);
    }

    /* 2. the strongest slots, at most perBeat notes a beat in any four beats (and a burst cap per beat), never closer than the
       grid the level allows (quarters, eighths, then sixteenths; never under 84 ms) */
    const grid = P.perBeat < 0.8 ? beat * 0.98 : P.perBeat < 1.4 ? beat * 0.49 : Math.max(0.084, six * 0.98);
    const rules = [{ span: beat * 4 - 1e-6, cap: Math.max(1, Math.floor(P.perBeat * 4 + 0.5)) }, { span: beat - 1e-6, cap: Math.max(1, Math.ceil(P.perBeat * 1.6)) }];
    const order = slots.filter(s => s.imp >= P.thr).sort((a, b) => b.imp - a.imp || a.t - b.t);
    const taken = [], keep = [];
    /* every window of a rule's span holding t keeps under its cap */
    const fits = (t) => {
      if (nearestGap(taken, t) < grid - 1e-6) return false;
      for (const r of rules) {
        const lo = lowerBound(taken, t - r.span), hi = lowerBound(taken, t + r.span + 1e-9);
        const pts = taken.slice(lo, hi);
        for (const w0 of pts.concat([t])) {
          if (w0 > t || w0 < t - r.span) continue;
          let n = 1;
          for (const x of pts) if (x >= w0 && x <= w0 + r.span) ++n;
          if (n > r.cap) return false;
        }
      }
      return true;
    };
    for (const s of order) {
      if (!fits(s.t)) continue;
      insertSorted(taken, s.t);
      keep.push(s);
    }
    keep.sort((a, b) => a.t - b.t);

    /* 3. lanes */
    const notes = [];
    let lastLane = 1, lastT = -9, prevPitch = null, kickSide = 0, lastChord = -9, holdUntil = -9, holdLane = -1;
    const holdRate = rate('hold'), chordRate = rate('chord');
    for (const s of keep) {
      if (s.t < holdUntil - 0.02 && P.L < 0.6) continue;
      const useMel = s.melodic && (!s.drum || s.melodic.imp >= s.drum.imp - 0.05);
      let lane;
      if (useMel) {
        const p = s.melodic.midi;
        if (prevPitch == null) lane = clamp(Math.round((p % 12) / 4), 0, 3);
        else {
          const d = p - prevPitch;
          const step = d === 0 ? 0 : (Math.abs(d) >= 5 ? 2 : 1) * Math.sign(d);
          lane = clamp(lastLane + step, 0, 3);
          if (lane === lastLane && d !== 0) lane = lastLane >= 2 ? lastLane - 1 : lastLane + 1;
        }
        prevPitch = p;
      } else {
        const d = s.drum.inst;
        if (d === 'kick') { lane = kickSide; kickSide ^= 1; }
        else if (d === 'snare' || d === 'clap') lane = s.step % 8 === 4 ? 3 : 2;
        else if (d === 'tom') lane = clamp(3 - Math.floor((s.step - 12) * 1), 0, 3);
        else lane = s.step % 4 < 2 ? 1 : 2;
      }
      /* anti-jack: a quick repeat moves to the neighbour lane away from the one before */
      if (lane === lastLane && s.t - lastT < P.jack) lane = lane === 0 ? 1 : lane === 3 ? 2 : (rng.next() < 0.5 ? lane - 1 : lane + 1);
      if (lane === holdLane && s.t < holdUntil + 0.05) lane = (lane + 2) % 4;
      const note = { t: s.t, lane: lane, kind: 'tap', bar: s.bar };
      /* holds on long melodic notes */
      if (holdRate && useMel && s.t >= holdUntil && s.melodic.dur >= 4 && rng.next() < holdRate) {
        const len = Math.min(s.melodic.dur * six * 0.92, barLen);
        if (len >= 0.34) {
          note.kind = 'hold';
          note.end = s.t + len;
          holdUntil = note.end;
          holdLane = lane;
        }
      }
      notes.push(note);
      /* chords on stabs and stacked strong hits */
      if (chordRate && s.t >= holdUntil - 1e-6 + (note.kind === 'hold' ? 99 : 0) && s.t - lastChord >= P.chordGap * barLen / 4
        && (s.stab >= 2 || (s.melodic && s.drum && s.melodic.imp > 0.85 && s.drum.imp > 0.85)) && rng.next() < chordRate) {
        let l2 = lane < 2 ? lane + 2 : lane - 2;
        if (rng.next() < 0.35) l2 = lane === 0 ? 1 : lane === 3 ? 2 : lane + (rng.next() < 0.5 ? -1 : 1);
        if (l2 === holdLane && s.t < holdUntil + 0.1) l2 = [0, 1, 2, 3].find(l => l !== lane && l !== holdLane);
        notes.push({ t: s.t, lane: l2, kind: 'tap', bar: s.bar, chord: true });
        lastChord = s.t;
      }
      lastLane = lane;
      lastT = s.t;
    }

    /* lane occupancy for placing Hush and drift notes */
    const laneTimes = [[], [], [], []];
    for (const n of notes) { laneTimes[n.lane].push(n.t); if (n.end) laneTimes[n.lane].push(n.end, (n.t + n.end) / 2); }
    for (const a of laneTimes) a.sort((x, y) => x - y);
    const free = (lane, t, w) => nearestGap(laneTimes[lane], t) >= w;
    const inHold = (lane, t) => notes.some(n => n.end && n.lane === lane && t > n.t - 0.1 && t < n.end + 0.1);

    /* drift notes slide in from a free neighbour */
    const driftRate = rate('drift');
    if (driftRate) {
      let lastDrift = -9;
      for (const n of notes) {
        if (n.kind !== 'tap' || n.chord || n.t - lastDrift < barLen * 0.75 || rng.next() > driftRate * 0.45) continue;
        const cands = [n.lane - 1, n.lane + 1].filter(l => l >= 0 && l <= 3 && free(l, n.t, 0.45) && !inHold(l, n.t));
        if (!cands.length) continue;
        n.kind = 'drift';
        n.from = cands[rng.int(cands.length)];
        lastDrift = n.t;
      }
    }

    /* Hush notes in lanes free around them */
    const hushRate = rate('hush');
    const hush = [];
    const placeHush = (t, attack) => {
      const lanes = [0, 1, 2, 3].filter(l => free(l, t, 0.24) && !inHold(l, t));
      if (!lanes.length) return false;
      const l = lanes[rng.int(lanes.length)];
      hush.push({ t: t, lane: l, kind: 'hush', bar: Math.floor(t / barLen), attack: attack == null ? -1 : attack });
      laneTimes[l].push(t);
      laneTimes[l].sort((x, y) => x - y);
      return true;
    };
    if (hushRate) {
      for (let b = 2; b < bars - 1; ++b) {
        if (rng.next() > hushRate * 0.7) continue;
        const step = [2, 6, 10, 14][rng.int(4)];
        placeHush(b * barLen + step * six);
      }
    }

    /* duel attack slots every four bars; Hammerfall throws its Hush notes into its slot */
    const attacks = [];
    if (opts.boss && opts.boss.length) {
      let k = 0;
      for (let b = 8; b <= bars - 4; b += 4) {
        const kind = opts.boss[k % opts.boss.length];
        const slot = { i: attacks.length, bar: b, major: b % 8 === 0, kind: kind, t0: (b - 1) * barLen, t1: b * barLen, t2: (b + 3) * barLen };
        attacks.push(slot);
        if (kind === 'hammer') for (let j = 0; j < 6; ++j) placeHush(slot.t1 + (j * 2 + 1) * beat, slot.i);
        if (b % 8 === 0 || opts.boss.length === 1) ++k;
      }
    }

    const all = notes.concat(hush);
    if (opts.mirror) for (const n of all) { n.lane = 3 - n.lane; if (n.from != null) n.from = 3 - n.from; }
    all.sort((a, b) => a.t - b.t || a.lane - b.lane);

    /* star phrases: two bars in every eight of a drop (four with Lucky Stars) */
    const phrases = [];
    for (let b = 0; b < bars - 1; ++b) {
      const sb = pos[b].sb;
      if (sections[b] !== 'drop' || !(sb % 8 === 2 || (opts.lucky && sb % 8 === 6))) continue;
      const id = phrases.length + 1;
      let n = 0;
      for (const x of all) if (x.kind !== 'hush' && (x.bar === b || x.bar === b + 1)) { x.star = id; ++n; }
      if (n) phrases.push({ id: id, n: n, bar: b });
    }
    /* pickups every twelve bars */
    let pk = rng.int(4);
    for (let b = 6; b < bars - 2; b += 12) {
      const x = all.find(n => n.bar >= b && n.kind !== 'hush' && !n.star);
      if (x) x.pickup = PICKUPS[pk++ % 4];
    }
    for (let i = 0; i < all.length; ++i) all[i].id = i;

    let real = 0, holds = 0, peak = 0;
    for (const n of all) if (n.kind !== 'hush') { ++real; if (n.end) ++holds; }
    for (let b = 0; b < bars; ++b) {
      const c = all.filter(n => n.kind !== 'hush' && n.bar === b).length;
      peak = Math.max(peak, c / barLen);
    }
    const length = bars * barLen;
    return {
      song: song, bpm: R.bpm, beat: beat, barLen: barLen, bars: bars, from: from, sections: sections, level: P.L, params: P,
      notes: all, attacks: attacks, phrases: phrases, length: length, count: real, holds: holds,
      nps: real / length, peak: peak,
    };
  }

  function bpmOf(song) {
    return SZ.GameMusic.resolve(song).bpm;
  }

  Object.assign(NS.chart, { params, build, importance, bpmOf, PICKUPS });
})();
