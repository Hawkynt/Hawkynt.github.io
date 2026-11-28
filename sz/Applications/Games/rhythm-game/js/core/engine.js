/* The pure song engine over a chart: create(chart, opts) makes a plain, saveable state; update(s, t)
   moves the song clock (notes let past become misses, Hush notes let past are dodged, holds that
   reach their tail complete, timers run out, duel attacks telegraph, strike and end); press, release
   and surge are the player's actions at a song time. Judging uses the chart's window scale, the tree's
   and booster's bonuses and the Magnet; the score is value x combo multiplier x Surge x gain; the
   groove fills with hits and drains with misses (empty fails, unless the song cannot fail or Second
   Wind rescues it); shields and the Safety Net keep a combo; star phrases fill Surge; a duel boss
   loses health with every hit and rages below half. Every change leaves an event for sound and
   juice. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;

  const DAMAGE = { perfect: 1, great: 0.85, good: 0.6 };
  const GAIN = { perfect: 0.026, great: 0.018, good: 0.008 };
  const RANKS = ['', 'perfect', 'great', 'good', 'miss'];

  /* opts: noFail, winBonus (scale), focus (s added to Perfect), drain (scale), regen (scale),
     grooveStart, scoreGain, surgeFill, surgeBeats, surgePower, net (misses forgiven), rescue
     (Second Wind), noSurge, shieldStart, surgeStart, magnetLen, warm (wider windows for eight bars),
     calm (beats a duel attack starts later and ends sooner), boss { id, name, hpShare } */
  function create(chart, opts) {
    opts = opts || {};
    const P = chart.params;
    const n = chart.notes.length;
    const s = {
      t: -2, done: false, failed: false, length: chart.length, count: chart.count,
      res: new Array(n).fill(0), hold: new Array(n).fill(0), held: [-1, -1, -1, -1], down: [false, false, false, false],
      next: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, early: 0, late: 0, offSum: 0, offN: 0,
      accSum: 0, accN: 0, groove: opts.grooveStart || 0.5, surge: 0, surgeOn: 0, surgeUses: 0, shield: 0, net: opts.net || 0, rescue: opts.rescue ? 1 : 0,
      magnetT: 0, multT: 0, hushHit: 0, hushDodged: 0, holdsOk: 0, holdsBroken: 0, pickups: 0, phrasesDone: 0, phraseHit: {}, phraseBroken: {},
      win: P.win * (opts.winBonus || 1), focus: opts.focus || 0, drain: P.drain * (opts.drain || 1), regen: opts.regen || 1,
      gain: opts.scoreGain || 1, surgeFill: opts.surgeFill || 1, surgeBeats: opts.surgeBeats || 8, surgePower: opts.surgePower || 2, noSurge: !!opts.noSurge,
      noFail: !!opts.noFail, lowWarned: false, boss: null, attack: null, fired: {}, events: [],
      magnetLen: opts.magnetLen || 8, warmUntil: opts.warm ? 8 * chart.barLen : -9, calm: (opts.calm || 0) * chart.beat,
    };
    s.shield = opts.shieldStart || 0;
    s.surge = Math.min(1, opts.surgeStart || 0);
    if (opts.boss) {
      const hp = Math.max(10, Math.round(chart.count * (opts.boss.hpShare || 0.72)));
      s.boss = { id: opts.boss.id, name: opts.boss.name, hp: hp, max: hp, rage: false, down: false };
      /* Hush notes of attack slots exist only once their slot fires */
      for (let i = 0; i < n; ++i) if (chart.notes[i].attack >= 0) s.res[i] = 5;
    }
    return s;
  }

  function ev(s, type, data) {
    const e = data || {};
    e.type = type;
    e.t = s.t;
    s.events.push(e);
    return e;
  }

  function mult(s) {
    let m = 1;
    for (const k of C.MULT_STEPS) if (s.combo >= k) ++m;
    if (s.multT > 0) ++m;
    return m;
  }

  function windows(s) {
    const k = s.win * (s.magnetT > 0 ? 1.5 : 1) * (s.t < s.warmUntil ? 1.25 : 1);
    return { perfect: C.WINDOWS.perfect * k + s.focus, great: C.WINDOWS.great * k, good: C.WINDOWS.good * k };
  }

  function addGroove(s, d) {
    const before = s.groove;
    s.groove = Math.max(0, Math.min(1, s.groove + d));
    if (s.groove < 0.25 && before >= 0.25) ev(s, 'groove-low');
    if (s.groove <= 0 && !s.failed && !s.done) {
      if (s.noFail || (s.boss && s.boss.down)) s.groove = 0.01;
      else if (s.rescue) { s.rescue = 0; s.groove = 0.5; ev(s, 'rescue'); }
      else { s.failed = true; s.done = true; ev(s, 'fail'); }
    }
  }

  function breakCombo(s, soft) {
    if (s.combo === 0) return false;
    if (s.shield > 0) { --s.shield; ev(s, 'shielded'); return false; }
    if (s.net > 0 && !soft) { --s.net; ev(s, 'net'); return false; }
    if (s.combo >= 20) ev(s, 'combo-break', { combo: s.combo });
    s.combo = 0;
    return true;
  }

  function phraseMiss(s, note) {
    if (note.star && !s.phraseBroken[note.star]) { s.phraseBroken[note.star] = true; ev(s, 'phrase-broken', { id: note.star }); }
  }

  function miss(s, i, chart) {
    const note = chart.notes[i];
    s.res[i] = 4;
    ++s.counts.miss;
    ++s.accN;
    if (note.end) { s.hold[i] = 2; ++s.holdsBroken; ++s.accN; }
    const kept = !breakCombo(s);
    addGroove(s, -s.drain * (kept ? 0.5 : 1));
    phraseMiss(s, note);
    ev(s, 'miss', { lane: note.lane, i: i });
  }

  function credit(s, value, rank) {
    const m = mult(s);
    s.score += Math.round(value * m * (s.surgeOn > s.t ? s.surgePower : 1) * s.gain);
    if (s.boss && !s.boss.down && rank) {
      s.boss.hp -= DAMAGE[rank] || 0.5;
      ev(s, 'boss-hit', { rank: rank });
      if (!s.boss.rage && s.boss.hp < s.boss.max / 2) { s.boss.rage = true; ev(s, 'rage'); }
      if (s.boss.hp <= 0) { s.boss.hp = 0; s.boss.down = true; s.attack = null; ev(s, 'boss-down'); }
    }
  }

  function hit(s, i, chart, dt) {
    const note = chart.notes[i];
    const w = windows(s);
    const a = Math.abs(dt);
    const rank = a <= w.perfect ? 'perfect' : a <= w.great ? 'great' : 'good';
    s.res[i] = RANKS.indexOf(rank);
    ++s.counts[rank];
    s.accSum += C.ACC[rank];
    ++s.accN;
    if (rank !== 'perfect') { if (dt < 0) ++s.early; else ++s.late; }
    s.offSum += dt;
    ++s.offN;
    ++s.combo;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;
    if (s.combo % 50 === 0) ev(s, 'combo', { combo: s.combo });
    if (C.MULT_STEPS.indexOf(s.combo) >= 0) ev(s, 'mult', { mult: mult(s) });
    credit(s, C.VALUES[rank], rank);
    addGroove(s, GAIN[rank] * s.regen);
    ev(s, 'hit', { lane: note.lane, i: i, rank: rank, dt: dt, star: !!note.star, chord: !!note.chord });
    if (note.pickup) pickup(s, note.pickup, note.lane);
    if (note.star) {
      s.phraseHit[note.star] = (s.phraseHit[note.star] || 0) + 1;
      const ph = chart.phrases.find(p => p.id === note.star);
      if (ph && s.phraseHit[note.star] === ph.n && !s.phraseBroken[note.star]) {
        ++s.phrasesDone;
        if (!s.noSurge) {
          const was = s.surge;
          s.surge = Math.min(1, s.surge + 0.25 * s.surgeFill);
          if (was < 0.5 && s.surge >= 0.5) ev(s, 'surge-ready');
        }
        ev(s, 'phrase', { id: note.star });
      }
    }
    if (note.end) {
      s.held[note.lane] = i;
      ev(s, 'hold-start', { lane: note.lane, i: i });
    }
  }

  function pickup(s, kind, lane) {
    ++s.pickups;
    if (kind === 'shield') ++s.shield;
    else if (kind === 'heart') addGroove(s, 0.25);
    else if (kind === 'magnet') s.magnetT = s.magnetLen;
    else if (kind === 'mult') s.multT = 10;
    ev(s, 'pickup', { kind: kind, lane: lane });
  }

  /* the lane a note is hit in (drift notes are hit where they land) */
  function laneOf(note) {
    return note.lane;
  }

  function press(s, chart, lane, t) {
    if (s.done) return null;
    s.down[lane] = true;
    const w = windows(s);
    let best = -1, bestA = Infinity, hush = -1, hushA = Infinity;
    for (let i = s.next; i < chart.notes.length; ++i) {
      const note = chart.notes[i];
      if (note.t - t > w.good) break;
      if (laneOf(note) !== lane || s.res[i]) continue;
      const a = Math.abs(t - note.t);
      if (a > w.good) continue;
      if (note.kind === 'hush') { if (a < hushA && a <= w.great) { hushA = a; hush = i; } }
      else if (a < bestA) { bestA = a; best = i; }
    }
    if (hush >= 0 && hushA < bestA) {
      s.res[hush] = 6;
      ++s.hushHit;
      breakCombo(s, true);
      addGroove(s, -s.drain * 1.3);
      ev(s, 'hush', { lane: lane, i: hush });
      return 'hush';
    }
    if (best < 0) return null;
    hit(s, best, chart, t - chart.notes[best].t);
    return RANKS[s.res[best]];
  }

  function release(s, chart, lane, t) {
    s.down[lane] = false;
    const i = s.held[lane];
    if (i < 0 || s.done) return;
    const note = chart.notes[i];
    s.held[lane] = -1;
    if (t >= note.end - Math.max(0.12, windows(s).good)) return completeHold(s, chart, i);
    s.hold[i] = 2;
    ++s.holdsBroken;
    ++s.accN;
    breakCombo(s, true);
    ev(s, 'hold-break', { lane: lane, i: i });
  }

  function completeHold(s, chart, i) {
    const note = chart.notes[i];
    s.hold[i] = 1;
    ++s.holdsOk;
    s.accSum += 1;
    ++s.accN;
    s.held[note.lane] = -1;
    credit(s, C.VALUES.hold * Math.max(1, Math.round((note.end - note.t) / chart.beat)), 'perfect');
    addGroove(s, 0.02 * s.regen);
    ev(s, 'hold-ok', { lane: note.lane, i: i });
  }

  function surge(s, chart) {
    if (s.done || s.noSurge || s.surge < 0.5 || s.surgeOn > s.t) return false;
    const beats = s.surgeBeats * (s.surge / 0.5);
    s.surgeOn = s.t + beats * chart.beat;
    s.surgeLen = s.surgeOn - s.t;
    s.surge = 0;
    ++s.surgeUses;
    ev(s, 'surge-on');
    return true;
  }

  function update(s, chart, t) {
    if (s.done) return;
    const dt = Math.max(0, t - s.t);
    s.t = t;
    if (s.magnetT > 0) s.magnetT = Math.max(0, s.magnetT - dt);
    if (s.multT > 0) s.multT = Math.max(0, s.multT - dt);
    if (s.surgeOn && s.surgeOn <= t && s.surgeOn > t - dt) ev(s, 'surge-off');
    const w = windows(s);
    const notes = chart.notes;
    while (s.next < notes.length && (s.res[s.next] || notes[s.next].t + w.good < t)) {
      const i = s.next;
      if (!s.res[i]) {
        if (notes[i].kind === 'hush') { s.res[i] = 5; ++s.hushDodged; }
        else miss(s, i, chart);
        if (s.done) return;
      }
      ++s.next;
    }
    for (let l = 0; l < 4; ++l) {
      const i = s.held[l];
      if (i >= 0 && t >= notes[i].end) completeHold(s, chart, i);
    }
    /* duel attacks */
    if (s.boss && !s.boss.down) {
      for (const a of chart.attacks) {
        if (s.fired[a.i] || t < a.t0) continue;
        if (!(a.major || s.boss.rage)) { if (t >= a.t1) s.fired[a.i] = -1; continue; }
        s.fired[a.i] = 1;
        for (let i = 0; i < notes.length; ++i) if (notes[i].attack === a.i && notes[i].t > t + 0.2) s.res[i] = 0;
        ev(s, 'telegraph', { kind: a.kind, slot: a.i, at: a.t1 });
      }
      for (const a of chart.attacks) {
        if (s.fired[a.i] !== 1) continue;
        const t1 = a.t1 + s.calm, t2 = a.t2 - s.calm;
        if (t >= t1 && t < t2 && (!s.attack || s.attack.slot !== a.i)) { s.attack = { kind: a.kind, slot: a.i, t1: t1, t2: t2 }; ev(s, 'attack', { kind: a.kind }); }
        if (s.attack && s.attack.slot === a.i && t >= t2) { s.attack = null; ev(s, 'attack-end', { kind: a.kind }); }
      }
    }
    if (t >= s.length + 0.3) {
      s.done = true;
      if (s.boss && !s.boss.down) s.failed = true;
      ev(s, 'done', { failed: s.failed });
    }
  }

  function accuracy(s) {
    return s.accN ? s.accSum / s.accN : 0;
  }

  function fullCombo(s) {
    return s.counts.miss === 0 && s.holdsBroken === 0 && s.hushHit === 0;
  }

  function grade(s) {
    if (s.failed) return 'F';
    const a = accuracy(s);
    if (a >= 0.98 && fullCombo(s)) return 'S+';
    if (a >= 0.95) return 'S';
    if (a >= 0.9) return 'A';
    if (a >= 0.8) return 'B';
    if (a >= 0.7) return 'C';
    return 'D';
  }

  function take(s) {
    const e = s.events;
    s.events = [];
    return e;
  }

  Object.assign(NS.engine, { DAMAGE, create, press, release, surge, update, mult, windows, accuracy, fullCombo, grade, take });
})();
