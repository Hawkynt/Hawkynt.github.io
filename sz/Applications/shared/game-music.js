;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  // Procedural background music for the games: no sound files. A song is a
  // small description (tempo, key, scale, chord progression, which layers
  // play and how); compose() turns one bar of it into notes, the same notes
  // for the same song and bar every time, so a song is a recognisable loop
  // with an A A' B A' phrase shape that varies every eight bars. The player
  // schedules a bar ahead on the shared SZ.GameAudio context, crossfades
  // between songs, follows the shared sound switch and has its own music
  // switch (remembered in the browser, shared by every game).
  //
  //   SZ.GameMusic.play(song)          start or crossfade to a song
  //   SZ.GameMusic.play(null)          fade out
  //   SZ.GameMusic.setIntensity(0..1)  layers come in as it rises
  //   SZ.GameMusic.stinger('win')      a short phrase in the current key
  //   SZ.GameMusic.enabled / toggle()  the shared music switch
  //   SZ.GameMusic.compose(song, bar, intensity) the notes of one bar (pure)
  //
  // song = { id, bpm, root (MIDI note of the key), scale, prog (scale degree
  //   per bar), swing, seed, layers: { pad, bass, arp, lead, bells, drums } },
  //   each layer { vol, wave, min (intensity it needs), ... } or absent.

  const STORAGE_KEY = 'sz-game-music-off';
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11], penta: [0, 2, 4, 7, 9], minpenta: [0, 3, 5, 7, 10],
  };
  const DRUMS = {
    four:  { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
    back:  { kick: [0, 7, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    break: { kick: [0, 3, 8, 10], snare: [4, 12, 15], hat: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14] },
    march: { kick: [0, 8], snare: [4, 12, 14], hat: [0, 4, 8, 12] },
    soft:  { kick: [0, 8], snare: [], hat: [4, 12] },
    shuffle: { kick: [0, 10], snare: [4, 12], hat: [0, 3, 4, 7, 8, 11, 12, 15] },
  };

  function rng(seed) {
    let a = seed >>> 0;
    return function() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; ++i)
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  // MIDI note of scale step `step` (0 = root, may be negative or past an octave)
  function noteOf(song, step) {
    const sc = SCALES[song.scale] || SCALES.major;
    const n = sc.length;
    const oct = Math.floor(step / n);
    return song.root + oct * 12 + sc[((step % n) + n) % n];
  }

  // the chord of a bar as scale steps (triad on the progression degree)
  function chordSteps(song, bar) {
    const prog = song.prog && song.prog.length ? song.prog : [0];
    const d = prog[bar % prog.length];
    return [d, d + 2, d + 4];
  }

  // a two-bar motif for phrase slot `which` of the song: rhythm and contour
  function motif(song, which) {
    const r = rng((song.seed != null ? song.seed : hash(song.id || 'song')) * 31 + which * 977);
    const lead = song.layers.lead || {};
    const density = lead.density != null ? lead.density : 0.45;
    const notes = [];
    let step = Math.floor(r() * 3);
    for (let t = 0; t < 32; t += 2) {
      const strong = t % 8 === 0;
      if (r() < (strong ? 0.85 : density)) {
        const jump = r() < 0.7 ? (r() < 0.5 ? -1 : 1) : (r() < 0.5 ? -2 : 2) * (r() < 0.3 ? 2 : 1);
        step = Math.max(-2, Math.min(9, step + jump));
        notes.push({ t: t, step: step, dur: r() < 0.3 ? 4 : 2 });
      }
    }
    return notes;
  }

  // every note of one bar: [{ t (16th, 0-15), dur (16ths), midi, inst, vol }]
  function composePlain(song, bar, intensity) {
    const L = song.layers || {};
    const I = intensity == null ? 1 : intensity;
    const on = layer => layer && (layer.min || 0) <= I + 1e-9;
    const out = [];
    const chord = chordSteps(song, bar);
    const root = chord[0];
    if (on(L.pad))
      for (let i = 0; i < 3; ++i)
        out.push({ t: 0, dur: 16, midi: noteOf(song, chord[i]) + 12 * (L.pad.oct || 0), inst: 'pad', vol: L.pad.vol });
    if (on(L.bass)) {
      const b = L.bass, low = noteOf(song, root) - 12 + 12 * (b.oct || 0);
      const fifth = noteOf(song, root + 4) - 12 + 12 * (b.oct || 0);
      const pat = b.pattern || 'root';
      if (pat === 'root') out.push({ t: 0, dur: 8, midi: low, inst: 'bass', vol: b.vol }, { t: 8, dur: 8, midi: low, inst: 'bass', vol: b.vol });
      else if (pat === 'pulse') for (let t = 0; t < 16; t += 2) out.push({ t: t, dur: 2, midi: low, inst: 'bass', vol: b.vol });
      else if (pat === 'octave') for (let t = 0; t < 16; t += 2) out.push({ t: t, dur: 2, midi: t % 4 ? low + 12 : low, inst: 'bass', vol: b.vol });
      else if (pat === 'walk') for (let k = 0; k < 4; ++k) out.push({ t: k * 4, dur: 4, midi: noteOf(song, root + [0, 2, 4, 5][k]) - 12 + 12 * (b.oct || 0), inst: 'bass', vol: b.vol });
      else if (pat === 'fifths') for (let k = 0; k < 4; ++k) out.push({ t: k * 4, dur: 3, midi: k % 2 ? fifth : low, inst: 'bass', vol: b.vol });
    }
    if (on(L.arp)) {
      const a = L.arp, rate = a.rate || 2, base = 12 * (a.oct != null ? a.oct : 1);
      const seq = a.pattern === 'down' ? [4, 2, 0, 2] : a.pattern === 'updown' ? [0, 2, 4, 7, 4, 2] : a.pattern === 'random' ? null : [0, 2, 4, 7];
      const r = rng(hash(song.id || 'arp') + bar * 13);
      let k = 0;
      for (let t = 0; t < 16; t += rate) {
        const s = seq ? seq[k++ % seq.length] : [0, 2, 4, 7][Math.floor(r() * 4)];
        out.push({ t: t, dur: rate, midi: noteOf(song, root + s) + base, inst: 'arp', vol: a.vol });
      }
    }
    if (on(L.lead)) {
      // A A' B A' over eight bars, motifs of two bars
      const slot = Math.floor((bar % 8) / 2);
      const m = motif(song, slot === 2 ? 1 : 0);
      const half = bar % 2;
      const lift = slot === 1 || slot === 3 ? (Math.floor(bar / 8) % 2 ? 2 : 1) : 0;
      const base = 12 * (L.lead.oct != null ? L.lead.oct : 1);
      for (let i = 0; i < m.length; ++i) {
        const n = m[i];
        if (n.t < half * 16 || n.t >= half * 16 + 16) continue;
        let s = n.step + (slot === 3 && i === m.length - 1 ? 0 : lift * (i % 3 === 2 ? 1 : 0));
        // land phrase ends on a chord tone
        if (i === m.length - 1 && half === 1) s = root + (s > root + 3 ? 4 : 2);
        out.push({ t: n.t - half * 16, dur: n.dur, midi: noteOf(song, s) + base, inst: 'lead', vol: L.lead.vol });
      }
    }
    if (on(L.bells) && bar % 2 === 1) {
      const r = rng(hash(song.id || 'bells') + bar * 7);
      for (let k = 0; k < 3; ++k)
        out.push({ t: 4 + k * 4 + (r() < 0.5 ? 0 : 2), dur: 6, midi: noteOf(song, root + [4, 7, 9][Math.floor(r() * 3)]) + 24, inst: 'bell', vol: L.bells.vol });
    }
    if (on(L.drums)) {
      const d = DRUMS[L.drums.style] || DRUMS.four, v = L.drums.vol;
      for (const t of d.kick) out.push({ t: t, dur: 1, midi: 0, inst: 'kick', vol: v });
      for (const t of d.snare) out.push({ t: t, dur: 1, midi: 0, inst: 'snare', vol: v * 0.8 });
      if (I >= (L.drums.hatMin || 0)) for (const t of d.hat) out.push({ t: t, dur: 1, midi: 0, inst: 'hat', vol: v * 0.5 });
      if (bar % 8 === 7) for (let t = 12; t < 16; ++t) out.push({ t: t, dur: 1, midi: 0, inst: 'snare', vol: v * 0.5 * (0.6 + (t - 12) * 0.15) });
    }
    return out;
  }

  // ── styles and the arranger ─────────────────────────────────────
  //
  // A song with a `style` is arranged: the style brings tempo, sounds, drum
  // kits and a form, the song brings key, scale, progression and seed (and may
  // override any layer). The form runs forever in passes: the first pass opens
  // with an intro, then groove, build-up, drop and breakdown; every pass picks
  // a new verse melody, sometimes new harmony, a longer groove, a second drop
  // melody, a half-time drop or a key change, while the hook stays, so the
  // song is recognisable without looping. Gameplay intensity colours it: calm
  // play thins the layers, at full intensity breakdowns are skipped and a
  // groove jumps into a build-up and on into the drop.

  // drum kits: 16th positions per instrument
  Object.assign(DRUMS, {
    house:  { kick: [0, 4, 8, 12], clap: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], open: [2, 6, 10, 14] },
    electro: { kick: [0, 4, 8, 12], snare: [4, 12], clap: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [6, 14] },
    trance: { kick: [0, 4, 8, 12], clap: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], open: [2, 6, 10, 14] },
    dnb:    { kick: [0, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    dnb2:   { kick: [0, 6, 10], snare: [4, 12, 15], hat: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14], open: [7] },
    half:   { kick: [0, 3, 10], snare: [8], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [14] },
    synth:  { kick: [0, 8, 10], snare: [4, 12], clap: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    chip:   { kick: [0, 6, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    funk:   { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14], open: [14] },
  });

  const L = (o) => o;
  const STYLES = {
    house: { bpm: 124, form: 'edm', duck: 0.5, layers: {
      pad: L({ vol: 0.028, wave: 'sawtooth' }), bass: L({ vol: 0.06, wave: 'sawtooth', pattern: 'offbeat', drop: 'offbeat', e: 0.3 }),
      arp: L({ vol: 0.018, wave: 'pluck', rate: 2, pattern: 'updown', oct: 1, e: 0.45 }), lead: L({ vol: 0.03, wave: 'square', dropWave: 'supersaw', density: 0.6, e: 0.6 }),
      stab: L({ vol: 0.016, pattern: 'off', e: 0.9 }), bells: L({ vol: 0.02 }), drums: L({ vol: 0.06, style: 'four', drop: 'house', e: 0.3 }) } },
    trance: { bpm: 136, form: 'edm', duck: 0.6, layers: {
      pad: L({ vol: 0.03, wave: 'supersaw' }), bass: L({ vol: 0.055, wave: 'sawtooth', pattern: 'rolling', drop: 'rolling', e: 0.3 }),
      arp: L({ vol: 0.017, wave: 'pluck', rate: 1, pattern: 'updown', oct: 1, e: 0.4 }), lead: L({ vol: 0.028, wave: 'pluck', dropWave: 'supersaw', density: 0.55, e: 0.6 }),
      bells: L({ vol: 0.02 }), drums: L({ vol: 0.06, style: 'four', drop: 'trance', e: 0.3 }) } },
    electro: { bpm: 128, form: 'edm', duck: 0.5, layers: {
      pad: L({ vol: 0.026, wave: 'sawtooth' }), bass: L({ vol: 0.06, wave: 'square', pattern: 'sync', drop: 'octave', dropWave: 'sawtooth', e: 0.3 }),
      arp: L({ vol: 0.018, wave: 'square', rate: 2, pattern: 'up', oct: 2, e: 0.45 }), lead: L({ vol: 0.032, wave: 'square', dropWave: 'supersaw', density: 0.65, e: 0.6 }),
      stab: L({ vol: 0.015, pattern: 'sync', e: 0.9 }), bells: L({ vol: 0.02 }), drums: L({ vol: 0.062, style: 'electro', drop: 'electro', e: 0.3 }) } },
    dnb: { bpm: 172, form: 'edm', duck: 0.3, layers: {
      pad: L({ vol: 0.03, wave: 'sawtooth' }), bass: L({ vol: 0.06, wave: 'reese', pattern: 'reese', drop: 'reese', e: 0.3 }),
      arp: L({ vol: 0.016, wave: 'pluck', rate: 2, pattern: 'random', oct: 2, e: 0.45 }), lead: L({ vol: 0.03, wave: 'square', dropWave: 'supersaw', density: 0.5, e: 0.6 }),
      bells: L({ vol: 0.02 }), drums: L({ vol: 0.062, style: 'dnb', drop: 'dnb2', e: 0.3 }) } },
    dubstep: { bpm: 140, form: 'edm', duck: 0.45, half: true, layers: {
      pad: L({ vol: 0.03, wave: 'sawtooth' }), bass: L({ vol: 0.065, wave: 'sub', pattern: 'sub', drop: 'wobble', e: 0.3 }),
      arp: L({ vol: 0.016, wave: 'pluck', rate: 2, pattern: 'down', oct: 2, e: 0.45 }), lead: L({ vol: 0.03, wave: 'square', dropWave: 'supersaw', density: 0.5, e: 0.6 }),
      bells: L({ vol: 0.022 }), drums: L({ vol: 0.065, style: 'back', drop: 'half', e: 0.3 }) } },
    chip: { bpm: 150, form: 'song', duck: 0, layers: {
      pad: L({ vol: 0.018, wave: 'square', oct: 0 }), bass: L({ vol: 0.06, wave: 'triangle', pattern: 'octave', drop: 'gallop', e: 0.2 }),
      arp: L({ vol: 0.018, wave: 'square', rate: 1, pattern: 'up', oct: 2, e: 0.45 }), lead: L({ vol: 0.035, wave: 'square', dropWave: 'square', density: 0.65, e: 0.45 }),
      drums: L({ vol: 0.05, style: 'chip', drop: 'back', e: 0.25 }) } },
    synthwave: { bpm: 108, form: 'song', duck: 0.25, layers: {
      pad: L({ vol: 0.032, wave: 'supersaw' }), bass: L({ vol: 0.058, wave: 'sawtooth', pattern: 'octave', drop: 'octave', e: 0.25 }),
      arp: L({ vol: 0.017, wave: 'sawtooth', rate: 2, pattern: 'updown', oct: 1, e: 0.4 }), lead: L({ vol: 0.03, wave: 'supersaw', dropWave: 'supersaw', density: 0.45, e: 0.5 }),
      bells: L({ vol: 0.018 }), drums: L({ vol: 0.06, style: 'synth', drop: 'synth', e: 0.25 }) } },
    funk: { bpm: 102, form: 'song', duck: 0.15, swing: 0.14, layers: {
      pad: L({ vol: 0.026, wave: 'triangle' }), bass: L({ vol: 0.065, wave: 'sawtooth', pattern: 'walk', drop: 'sync', e: 0.2 }),
      arp: L({ vol: 0.016, wave: 'pluck', rate: 4, pattern: 'up', oct: 1, e: 0.5 }), lead: L({ vol: 0.032, wave: 'triangle', dropWave: 'pluck', density: 0.55, e: 0.45 }),
      bells: L({ vol: 0.022 }), drums: L({ vol: 0.05, style: 'shuffle', drop: 'funk', e: 0.25 }) } },
    epic: { bpm: 96, form: 'song', duck: 0.1, layers: {
      pad: L({ vol: 0.035, wave: 'supersaw' }), bass: L({ vol: 0.06, wave: 'triangle', pattern: 'fifths', drop: 'pulse', e: 0.25 }),
      arp: L({ vol: 0.017, wave: 'triangle', rate: 2, pattern: 'updown', oct: 1, e: 0.4 }), lead: L({ vol: 0.034, wave: 'triangle', dropWave: 'supersaw', density: 0.45, e: 0.45 }),
      bells: L({ vol: 0.025 }), drums: L({ vol: 0.06, style: 'march', drop: 'march', e: 0.3 }) } },
    ambient: { bpm: 74, form: 'calm', duck: 0, layers: {
      pad: L({ vol: 0.028, wave: 'sine' }), bass: L({ vol: 0.036, wave: 'sine', pattern: 'root', e: 0.25 }),
      arp: L({ vol: 0.015, wave: 'sine', rate: 4, pattern: 'random', oct: 2, e: 0.35 }), lead: L({ vol: 0.024, wave: 'sine', density: 0.3, e: 0.4 }),
      bells: L({ vol: 0.025 }), drums: L({ vol: 0.035, style: 'soft', e: 0.45 }) } },
  };

  const PROGS = {
    major: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 4, 3], [0, 5, 1, 4], [3, 4, 2, 5], [0, 2, 3, 4], [0, 4, 3, 4], [3, 0, 4, 5]],
    minor: [[0, 5, 6, 4], [0, 5, 2, 6], [0, 3, 4, 4], [0, 6, 5, 6], [5, 6, 0, 0], [0, 2, 5, 4], [0, 3, 6, 5], [0, 5, 3, 4]],
  };
  const FAMILY = { major: 'major', lydian: 'major', mixolydian: 'major', penta: 'major',
    minor: 'minor', dorian: 'minor', phrygian: 'minor', harmonic: 'minor', minpenta: 'minor' };
  const SIBLINGS = { major: ['major', 'lydian', 'mixolydian'], minor: ['minor', 'dorian', 'harmonic', 'phrygian'] };
  const RHYTHMS = [
    [0, 3, 6, 8, 10, 12, 14, 16, 19, 22, 24, 28],
    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
    [0, 3, 6, 10, 12, 16, 19, 22, 26, 28, 30],
    [0, 4, 6, 8, 12, 16, 20, 22, 24, 28],
    [0, 1, 2, 4, 6, 8, 11, 12, 14, 16, 18, 20, 22, 24, 27, 28],
    [0, 6, 8, 12, 14, 16, 22, 24, 26, 28],
    [0, 2, 3, 6, 8, 10, 11, 14, 16, 18, 19, 22, 24, 28],
  ];

  const resolved = new WeakMap();
  function resolve(song) {
    if (!song || !song.style) return song;
    let r = resolved.get(song);
    if (r) return r;
    const st = STYLES[song.style] || STYLES.electro;
    r = Object.assign({ swing: 0, duck: 0, half: false }, st, song);
    r.layers = {};
    const own = song.layers || {};
    const keys = Object.keys(st.layers).concat(Object.keys(own));
    for (const k of keys) {
      if (own[k] === null) continue;
      r.layers[k] = Object.assign({}, st.layers[k] || {}, own[k] || {});
    }
    if (r.seed == null) r.seed = hash(r.id || 'song') % 100000;
    if (!r.prog || !r.prog.length) r.prog = [0, 4, 5, 3];
    resolved.set(song, r);
    return r;
  }

  function family(scale) {
    return FAMILY[scale] || 'major';
  }

  const plans = new WeakMap();
  // the sections of pass `cycle` of a song (pure, memoised)
  function planCycle(song, cycle) {
    const R = resolve(song);
    let memo = plans.get(R);
    if (!memo) plans.set(R, memo = new Map());
    if (memo.has(cycle)) return memo.get(cycle);
    if (memo.size > 64) memo.clear();
    const r = rng((R.seed * 7919) ^ hash((R.id || '') + ':' + cycle));
    const pool = PROGS[family(R.scale)];
    const pick = (avoid) => { let p = pool[Math.floor(r() * pool.length)]; if (avoid && p.join() === avoid.join()) p = pool[(pool.indexOf(p) + 1) % pool.length]; return p; };
    const progA = cycle % 3 === 2 ? pick(R.prog) : R.prog;
    const progB = pick(progA);
    const transpose = cycle > 0 && cycle % 4 === 3 ? 2 : 0;
    const verse = hash((R.id || '') + ':verse:' + cycle) % 100000;
    const base = { prog: progA, transpose: transpose, verse: verse };
    const S = (name, bars, e0, e1, extra) => Object.assign({ name: name, bars: bars, e0: e0, e1: e1 }, base, extra || {});
    const out = [];
    if (R.form === 'calm') {
      out.push(S('groove', 8, 0.3, 0.35), S('groove', 8, 0.45, 0.5, { prog: progB, verse: verse + 1 }), S('groove', 8, 0.38, 0.42), S('break', 8, 0.2, 0.2, { prog: progB, brk: 'bells' }));
    } else if (R.form === 'song') {
      if (cycle === 0) out.push(S('intro', 4, 0.2, 0.35));
      out.push(S('groove', 8, 0.5, 0.6));
      out.push(S('build', 4, 0.65, 0.8, { lite: true }));
      out.push(S('drop', cycle % 2 ? 16 : 8, 0.95, 1, { dropB: cycle % 2 === 1, lift: cycle % 4 === 2 }));
      if (cycle % 2 === 1) out.push(S('break', 8, 0.3, 0.35, { prog: progB, lite: true, brk: cycle % 4 === 1 ? 'melodic' : 'bells' }));
    } else {
      if (cycle === 0) out.push(S('intro', 8, 0.2, 0.4));
      out.push(S('groove', cycle === 0 || r() < 0.5 ? 8 : 16, 0.5, 0.65));
      out.push(S('build', cycle === 0 || r() < 0.6 ? 8 : 4, 0.6, 0.85));
      out.push(S('drop', 16, 1, 1, { dropB: cycle % 2 === 1, lift: cycle % 4 === 2, half: !!R.half && cycle % 2 === 1 }));
      if (cycle % 5 !== 4) out.push(S('break', 8, 0.25, 0.3, { prog: progB, brk: cycle % 2 ? 'bells' : 'melodic' }));
    }
    memo.set(cycle, out);
    return out;
  }

  function start(song) {
    void resolve(song);
    return { cycle: 0, si: 0, sb: 0, inject: null, bar: 0 };
  }

  function sectionOf(song, pos) {
    return pos.inject || planCycle(song, pos.cycle)[pos.si];
  }

  // the next bar's position; intensity skips breakdowns and forces build-ups
  function advance(song, pos, intensity) {
    const R = resolve(song);
    const I = intensity == null ? 0.5 : intensity;
    const plan = planCycle(R, pos.cycle);
    const sec = pos.inject || plan[pos.si];
    const n = { cycle: pos.cycle, si: pos.si, sb: pos.sb + 1, inject: pos.inject || null, bar: pos.bar + 1 };
    if (n.sb < sec.bars) {
      if (!n.inject && I >= 0.9 && R.form !== 'calm' && (sec.name === 'groove' || sec.name === 'break') && n.sb % 4 === 0) {
        const di = plan.findIndex(s => s.name === 'drop');
        if (di >= 0) {
          n.inject = { name: 'build', bars: 4, e0: 0.7, e1: 0.9, injected: true, prog: sec.prog, transpose: sec.transpose || 0, verse: sec.verse, lite: R.form !== 'edm', next: di };
          n.sb = 0;
        }
      }
      return n;
    }
    n.sb = 0;
    if (n.inject) {
      n.si = n.inject.next;
      n.inject = null;
      return n;
    }
    for (let guard = 0; guard < 8; ++guard) {
      ++n.si;
      if (n.si >= planCycle(R, n.cycle).length) { ++n.cycle; n.si = 0; }
      if (!(I >= 0.85 && planCycle(R, n.cycle)[n.si].name === 'break')) break;
    }
    return n;
  }

  const located = new WeakMap();
  // the position of bar `bar` when played at a steady middle intensity
  function locate(song, bar) {
    const R = resolve(song);
    let list = located.get(R);
    if (!list) located.set(R, list = [start(R)]);
    if (bar > 4096) bar %= 4096;
    while (list.length <= bar) list.push(advance(R, list[list.length - 1], 0.5));
    return list[bar];
  }

  function chordOf(song, pos) {
    const sec = sectionOf(song, pos);
    const prog = sec.prog && sec.prog.length ? sec.prog : [0];
    let d = prog[pos.sb % prog.length];
    if (sec.name === 'build' && !sec.lite && pos.sb === sec.bars - 1) d = 4;
    return [d, d + 2, d + 4];
  }

  // a two-bar melody: a rhythm from the song's set, a contour that mostly steps
  function motif2(seed, density) {
    const r = rng(seed * 31 + 977);
    const rhythm = RHYTHMS[Math.floor(r() * RHYTHMS.length)];
    const notes = [];
    let step = 2 + Math.floor(r() * 3), dir = r() < 0.5 ? -1 : 1;
    for (let i = 0; i < rhythm.length; ++i) {
      const t = rhythm[i];
      if (t % 8 !== 0 && r() > density + 0.2) continue;
      const u = r();
      if (u < 0.18) { /* repeat */ }
      else if (u < 0.75) step += dir;
      else step += dir * 2;
      if (r() < 0.3) dir = -dir;
      if (step > 9) { step = 8; dir = -1; }
      if (step < -1) { step = 0; dir = 1; }
      notes.push({ t: t, step: step, dur: 1 });
    }
    for (let i = 0; i < notes.length; ++i) {
      const next = i + 1 < notes.length ? notes[i + 1].t : 32;
      notes[i].dur = Math.max(1, Math.min(4, next - notes[i].t - (r() < 0.25 ? 1 : 0)));
    }
    return notes;
  }

  // the nearest chord tone to a scale step
  function snap(step, chord, n) {
    let best = step, bd = 99;
    for (const c of chord)
      for (let k = -2; k <= 2; ++k) {
        const s = c + k * n, d = Math.abs(s - step);
        if (d < bd) { bd = d; best = s; }
      }
    return best;
  }

  // the melody of a bar in a phrase of eight: A A' B A'
  function phrase(R, seedA, seedB, barIn, density, chord, landRoot) {
    const slot = Math.floor((barIn % 8) / 2), half = barIn % 2;
    const m = motif2(slot === 2 ? seedB : seedA, density);
    const n = (SCALES[R.scale] || SCALES.major).length;
    const out = [];
    for (let i = 0; i < m.length; ++i) {
      const x = m[i];
      if (x.t < half * 16 || x.t >= half * 16 + 16) continue;
      let s = x.step + (slot === 1 && i === m.length - 1 ? 1 : 0);
      if (x.t % 4 === 0) s = snap(s, chord, n);
      if (half === 1 && i === m.length - 1) s = slot === 3 && landRoot ? snap(chord[0], chord, n) : snap(s, chord, n);
      out.push({ t: x.t - half * 16, dur: x.dur, step: s });
    }
    return out;
  }

  function bassLine(pattern, low, fifth, R, root, oct, rr) {
    const o = [];
    const add = (t, dur, midi) => o.push({ t: t, dur: dur, midi: midi });
    switch (pattern) {
      case 'pulse': for (let t = 0; t < 16; t += 2) add(t, 2, low); break;
      case 'octave': for (let t = 0; t < 16; t += 2) add(t, 2, t % 4 ? low + 12 : low); break;
      case 'walk': for (let k = 0; k < 4; ++k) add(k * 4, 4, noteOf(R, root + [0, 2, 4, 5][k]) - 12 + 12 * oct); break;
      case 'fifths': for (let k = 0; k < 4; ++k) add(k * 4, 3, k % 2 ? fifth : low); break;
      case 'offbeat': for (const t of [2, 6, 10, 14]) add(t, 2, low); break;
      case 'rolling': for (let t = 0; t < 16; ++t) if (t % 4) add(t, 1, low); break;
      case 'sync': for (const t of [0, 3, 6, 8, 11, 14]) add(t, 2, t === 8 ? fifth : low); break;
      case 'gallop': for (const t of [0, 3, 4, 7, 8, 11, 12, 15]) add(t, 1, t % 8 === 7 ? low + 12 : low); break;
      case 'reese': add(0, 8, low); add(8, 8, rr() < 0.5 ? low : fifth); break;
      case 'wobble': for (const [t, d] of [[0, 4], [4, 4], [8, 6], [14, 2]]) o.push({ t: t, dur: d, midi: t === 14 ? low + 12 : low, wob: [1, 2, 3, 4][Math.floor(rr() * 4)] }); break;
      case 'sub': add(0, 16, low); break;
      default: add(0, 8, low); add(8, 8, low);
    }
    return o;
  }

  function composeArranged(song, bar, intensity, pos) {
    const R = resolve(song);
    pos = pos || locate(R, bar);
    const sec = sectionOf(R, pos);
    const Ls = R.layers;
    const I = intensity == null ? 1 : intensity;
    const k = sec.bars > 1 ? pos.sb / (sec.bars - 1) : 1;
    const E = Math.max(0, Math.min(1, sec.e0 + (sec.e1 - sec.e0) * k + (I - 0.5) * 0.3));
    const on = (l) => l && (l.e || 0) <= E + 1e-9;
    const tr = sec.transpose || 0;
    const chord = chordOf(R, pos);
    const root = chord[0];
    const name = sec.name, edm = R.form === 'edm';
    const last = pos.sb === sec.bars - 1;
    const rr = rng((R.seed * 131) ^ hash(name + ':' + pos.cycle + ':' + pos.sb));
    const out = [];
    const N = (t, dur, midi, inst, vol, extra) => out.push(Object.assign({ t: t, dur: dur, midi: midi + (midi ? tr : 0), inst: inst, vol: vol }, extra || {}));
    const holdBreath = name === 'build' && !sec.lite && last;

    // pad
    if (Ls.pad) {
      const p = Ls.pad, v = p.vol * (name === 'drop' ? 0.75 : name === 'break' ? 1.2 : 1);
      for (let i = 0; i < 3; ++i) N(0, holdBreath ? 12 : 16, noteOf(R, chord[i]) + 12 * (p.oct || 0), 'pad', v, { wave: p.wave });
    }
    // bass
    if (Ls.bass && name !== 'intro' && name !== 'break' && on(Ls.bass)) {
      const b = Ls.bass, oct = b.oct || 0;
      const low = noteOf(R, root) - 12 + 12 * oct, fifth = noteOf(R, root + 4) - 12 + 12 * oct;
      const drop = name === 'drop';
      const pat = name === 'build' ? 'pulse' : drop ? (sec.half && b.drop === 'offbeat' ? 'sync' : b.drop || b.pattern) : b.pattern;
      const wave = drop ? (pat === 'wobble' ? 'wobble' : b.dropWave || b.wave) : (b.wave === 'reese' || b.wave === 'sub' ? b.wave : b.wave);
      for (const x of bassLine(pat, low, fifth, R, root, oct, rr)) {
        if (holdBreath && x.t >= 12) continue;
        N(x.t, x.dur, x.midi, 'bass', b.vol, { wave: x.wob ? 'wobble' : wave, wob: x.wob });
      }
    }
    // arpeggio
    if (Ls.arp && (name === 'groove' || name === 'drop' || name === 'build' || (name === 'break' && sec.brk === 'bells')) && on(Ls.arp)) {
      const a = Ls.arp, base = 12 * (a.oct != null ? a.oct : 1);
      const rate = name === 'build' ? (k < 0.5 ? 2 : 1) : name === 'break' ? 4 : a.rate || 2;
      const pats = { up: [0, 2, 4, 7], down: [7, 4, 2, 0], updown: [0, 2, 4, 7, 4, 2] };
      const order = ['up', 'updown', 'down', 'random'];
      const pname = pos.cycle % 2 && name === 'drop' ? order[(order.indexOf(a.pattern || 'up') + 1) % 4] : a.pattern || 'up';
      const seq = pats[pname] || null;
      let i = 0;
      for (let t = 0; t < 16; t += rate) {
        if (holdBreath && t >= 14) break;
        const s = seq ? seq[i++ % seq.length] : [0, 2, 4, 7][Math.floor(rr() * 4)];
        N(t, rate, noteOf(R, root + s) + base, 'arp', a.vol * (name === 'build' ? 0.7 + k * 0.5 : 1), { wave: a.wave });
      }
    }
    // melody
    if (Ls.lead) {
      const ld = Ls.lead, base = 12 * (ld.oct != null ? ld.oct : 1), dens = ld.density != null ? ld.density : 0.5;
      let notes = null, wave = ld.wave, vol = ld.vol;
      if (name === 'drop') {
        const second = pos.sb >= 8;
        const seedA = second && sec.dropB ? R.seed + 7 + pos.cycle : R.seed;
        notes = phrase(R, seedA, R.seed + 3, pos.sb, Math.min(0.9, dens + 0.15), chord, true);
        wave = ld.dropWave || ld.wave;
        if (second && sec.lift) notes.forEach(x => { x.step += (SCALES[R.scale] || SCALES.major).length; });
      } else if (name === 'groove' && on(ld)) {
        notes = phrase(R, sec.verse, sec.verse + 1, pos.sb, dens * 0.7, chord, true);
        vol *= 0.85;
      } else if (name === 'break' && sec.brk === 'melodic') {
        notes = phrase(R, R.seed, R.seed + 3, pos.sb, dens, chord, true).filter(x => x.t % 4 === 0).map(x => ({ t: x.t, dur: 4, step: x.step }));
        wave = ld.wave === 'square' ? 'triangle' : ld.wave;
        vol *= 0.8;
      }
      if (notes) for (const x of notes) N(x.t, x.dur, noteOf(R, x.step) + base, 'lead', vol, { wave: wave });
    }
    // chord stabs in the drop
    if (Ls.stab && name === 'drop' && on(Ls.stab)) {
      const at = Ls.stab.pattern === 'sync' ? [0, 3, 6, 10] : [2, 6, 10, 14];
      for (const t of at) for (let i = 0; i < 3; ++i) N(t, 1, noteOf(R, chord[i]) + 12, 'stab', Ls.stab.vol, { wave: 'supersaw' });
    }
    // bells: intros, breakdowns and calm songs
    if (Ls.bells && (name === 'intro' || name === 'break' || R.form === 'calm') && pos.sb % 2 === 1) {
      for (let i = 0; i < 3; ++i)
        N(4 + i * 4 + (rr() < 0.5 ? 0 : 2), 6, noteOf(R, root + [4, 7, 9][Math.floor(rr() * 3)]) + 24, 'bell', Ls.bells.vol);
    }
    // drums
    const D = Ls.drums;
    if (D) {
      const v = D.vol;
      const kit = (id) => DRUMS[id] || DRUMS.four;
      const hit = (pat, scale) => {
        for (const t of pat.kick || []) N(t, 1, 0, 'kick', v * scale);
        for (const t of pat.snare || []) N(t, 1, 0, 'snare', v * 0.8 * scale);
        for (const t of pat.clap || []) N(t, 1, 0, 'clap', v * 0.7 * scale);
        for (const t of pat.hat || []) N(t, 1, 0, 'hat', v * 0.45 * scale);
        for (const t of pat.open || []) N(t, 2, 0, 'open', v * 0.4 * scale);
      };
      if (name === 'intro') {
        for (const t of kit(D.style).hat || []) N(t, 1, 0, 'hat', v * 0.35);
        if (sec.bars >= 4 && pos.sb >= sec.bars - 2) for (const t of [0, 4, 8, 12]) N(t, 1, 0, 'kick', v * 0.7);
      } else if (name === 'groove') {
        if (on(D)) hit(kit(D.style), 1);
        else for (const t of kit(D.style).hat || []) N(t, 1, 0, 'hat', v * 0.35);
      } else if (name === 'build') {
        if (sec.lite) {
          hit(kit(D.style), 0.9);
          if (last) for (let t = 8; t < 16; ++t) N(t, 1, 0, 'snare', v * (0.4 + (t - 8) * 0.06));
        } else {
          if (k < 0.5) for (const t of [0, 4, 8, 12]) N(t, 1, 0, 'kick', v * 0.85);
          const every = last ? 1 : k < 0.34 ? 4 : k < 0.67 ? 2 : 1;
          for (let t = 0; t < (last ? 14 : 16); t += every) N(t, 1, 0, 'snare', v * (0.3 + 0.55 * k) * (t % 4 ? 0.8 : 1));
        }
        if (pos.sb === 0) N(0, sec.lite ? 16 : sec.bars * 16, 0, 'riser', v * 0.5);
      } else if (name === 'drop') {
        hit(kit(sec.half ? 'half' : D.drop || D.style), 1);
        if (pos.sb % 8 === 0) N(0, 8, 0, 'crash', v * 0.6);
      } else if (name === 'break' && sec.lite && on(D)) {
        for (const t of [4, 12]) N(t, 1, 0, 'hat', v * 0.3);
      }
      // fills: a lick every four bars, toms into the next section
      if ((name === 'groove' || name === 'drop') && (on(D) || name === 'drop')) {
        if (last) for (let t = 12; t < 16; ++t) N(t, 1, 52 - (t - 12) * 3, 'tom', v * 0.8);
        else if (pos.sb % 4 === 3) { N(14, 1, 0, 'snare', v * 0.5); N(15, 1, 0, 'snare', v * 0.6); }
      }
      if (name === 'groove' && pos.sb === 0 && pos.cycle > 0 && edm) N(0, 8, 0, 'crash', v * 0.35);
    }
    if (holdBreath) return out.filter(n => n.t < 14 || n.inst === 'riser');
    return out;
  }

  function compose(song, bar, intensity, pos) {
    return song && song.style ? composeArranged(song, bar, intensity, pos) : composePlain(song, bar, intensity);
  }

  // per bar: the level of the whole band, so the drop hits harder than the groove
  function levelShape(song, pos) {
    const sec = sectionOf(song, pos);
    const k0 = pos.sb / sec.bars, k1 = (pos.sb + 1) / sec.bars;
    const lin = (a, b, k) => a + (b - a) * k;
    if (resolve(song).form === 'calm') return sec.name === 'break' ? [0.8, 0.8] : [0.95, 0.95];
    switch (sec.name) {
      case 'intro': return [lin(0.5, 0.65, k0), lin(0.5, 0.65, k1)];
      case 'groove': return [0.66, 0.66];
      case 'build': return sec.lite ? [lin(0.7, 0.85, k0), lin(0.7, 0.85, k1)] : [lin(0.6, 0.92, k0), lin(0.6, 0.92, k1)];
      case 'break': return [0.5, 0.5];
      default: return [1, 1];
    }
  }

  // per bar: the cutoff of the band's filter (opens over a build-up)
  function filterShape(song, pos) {
    const sec = sectionOf(song, pos);
    const k0 = pos.sb / sec.bars, k1 = (pos.sb + 1) / sec.bars;
    const exp = (a, b, k) => a * Math.pow(b / a, k);
    switch (sec.name) {
      case 'intro': return [exp(700, 2400, k0), exp(700, 2400, k1)];
      case 'build': return sec.lite ? [exp(3000, 14000, k0), exp(3000, 14000, k1)] : [exp(900, 16000, k0), exp(900, 16000, k1)];
      case 'break': return [2000, 2600];
      case 'groove': return resolve(song).form === 'calm' ? [4000, 4000] : [exp(5000, 9000, k0), exp(5000, 9000, k1)];
      default: return [16000, 16000];
    }
  }

  // a song of its own for a level, in the theme's style and close to its key and tempo
  const variants = new Map();
  function variant(base, key) {
    const id = base.id + '~' + key;
    let v = variants.get(id);
    if (v) return v;
    const R = resolve(base);
    const h = hash(id);
    const r = rng(h);
    const fam = family(R.scale);
    const sibs = SIBLINGS[fam];
    const scale = r() < 0.6 ? R.scale : sibs[Math.floor(r() * sibs.length)];
    const shift = [-5, -3, -2, 0, 2, 3, 5, 7][Math.floor(r() * 8)];
    const pool = PROGS[fam];
    const prog = r() < 0.25 ? R.prog : pool[Math.floor(r() * pool.length)];
    const bpm = Math.round((R.bpm || 120) * (0.94 + r() * 0.12));
    v = Object.assign({}, base, { id: id, seed: h % 1000003, root: R.root + shift, scale: scale, prog: prog, bpm: bpm });
    if (base.style && R.layers.arp) {
      const pats = ['up', 'down', 'updown', 'random'];
      v.layers = Object.assign({}, base.layers || {}, { arp: Object.assign({}, (base.layers || {}).arp || {}, { pattern: pats[Math.floor(r() * 4)] }) });
    }
    if (variants.size > 2000) variants.clear();
    variants.set(id, v);
    return v;
  }

  // ── playback ────────────────────────────────────────────────────

  let enabled = true;
  try { enabled = localStorage.getItem(STORAGE_KEY) !== '1'; } catch (_) {}
  const listeners = new Set();
  let current = null;        // { song, gain, bar, nextAt }
  let wanted = null;         // the song asked for (also while the context is not running)
  let intensity = 0.6;
  let timer = null;
  let noise = null;

  function audio() {
    const A = SZ.GameAudio;
    if (!A || !A.bus || !A.running)
      return null;
    return A.context;
  }

  function freq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function noiseBuffer(ctx) {
    if (!noise) {
      const len = Math.floor(ctx.sampleRate * 0.4);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; ++i)
        d[i] = Math.random() * 2 - 1;
    }
    return noise;
  }

  function voice(ctx, out, n, t, dur, layer) {
    const inst = n.inst, vol = (n.vol != null ? n.vol : 0.08);
    const g = ctx.createGain();
    g.connect(out);
    if (inst === 'kick' || inst === 'snare' || inst === 'hat') {
      if (inst === 'kick') {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        g.gain.setValueAtTime(vol * 2.2, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.22);
        return;
      }
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer(ctx);
      const f = ctx.createBiquadFilter();
      f.type = inst === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = inst === 'hat' ? 7000 : 1800;
      const len = inst === 'hat' ? 0.04 : 0.12;
      g.gain.setValueAtTime(vol * (inst === 'hat' ? 0.9 : 1.4), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(f).connect(g);
      s.start(t);
      s.stop(t + len + 0.02);
      return;
    }
    const wave = (layer && layer.wave) || (inst === 'pad' ? 'triangle' : inst === 'bass' ? 'triangle' : inst === 'bell' ? 'sine' : 'square');
    const f0 = freq(n.midi);
    const attack = inst === 'pad' ? Math.min(0.4, dur * 0.3) : inst === 'bell' ? 0.003 : 0.008;
    const release = inst === 'pad' ? Math.min(0.6, dur * 0.4) : inst === 'bell' ? dur * 0.9 : Math.min(0.12, dur * 0.4);
    const sustain = inst === 'bell' ? 0.0001 : vol * (inst === 'lead' ? 0.8 : 0.9);
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    let src = osc;
    if (inst === 'pad' || inst === 'bass') {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = inst === 'pad' ? 1400 : 700;
      osc.connect(f);
      src = f;
    }
    src.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    if (inst === 'bell') g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    else {
      g.gain.setValueAtTime(Math.max(0.0002, sustain), t + Math.max(attack, dur - release));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    }
    osc.start(t);
    osc.stop(t + dur + (inst === 'bell' ? release : 0) + 0.05);
    if (inst === 'pad') {
      // a slightly detuned twin for width
      const o2 = ctx.createOscillator();
      o2.type = wave;
      o2.frequency.setValueAtTime(f0 * 1.006, t);
      o2.connect(src);
      o2.start(t);
      o2.stop(t + dur + 0.05);
    }
  }

  // ── the arranged band: synths, drums, the mix ───────────────────

  function env(g, t, vol, attack, hold, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.setValueAtTime(Math.max(0.0002, vol * 0.85), t + Math.max(attack, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold + release);
  }

  function osc(ctx, type, f, t, end, detune) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.start(t);
    o.stop(end);
    return o;
  }

  function noiseSrc(ctx, t, end) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx);
    s.loop = true;
    s.start(t);
    s.stop(end);
    return s;
  }

  function drum(ctx, c, n, t, beat) {
    const inst = n.inst, vol = n.vol;
    const g = ctx.createGain();
    g.connect(c.drums);
    if (inst === 'kick') {
      const o = osc(ctx, 'sine', 165, t, t + 0.3);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
      g.gain.setValueAtTime(vol * 2.6, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g);
      if (c.song.duck && c.duck) {
        const d = c.duck.gain;
        d.setValueAtTime(Math.max(0.05, 1 - c.song.duck), t);
        d.setTargetAtTime(1, t + 0.02, beat * 0.2);
      }
      return;
    }
    if (inst === 'tom') {
      const f = freq(n.midi || 50);
      const o = osc(ctx, 'sine', f * 1.6, t, t + 0.3);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.16);
      g.gain.setValueAtTime(vol * 1.8, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g);
      return;
    }
    const f = ctx.createBiquadFilter();
    let len = 0.12, peak = vol * 1.4;
    if (inst === 'hat') { f.type = 'highpass'; f.frequency.value = 8000; len = 0.035; peak = vol * 0.9; }
    else if (inst === 'open') { f.type = 'highpass'; f.frequency.value = 6500; len = 0.22; peak = vol * 0.8; }
    else if (inst === 'crash') { f.type = 'highpass'; f.frequency.value = 4500; len = 1.6; peak = vol * 1.1; }
    else if (inst === 'clap') { f.type = 'bandpass'; f.frequency.value = 1150; f.Q.value = 1.2; len = 0.16; peak = vol * 1.8; }
    else if (inst === 'riser') {
      f.type = 'bandpass';
      f.Q.value = 5;
      const dur = n.dur * beat / 4;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(7500, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 1.6), t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
      noiseSrc(ctx, t, t + dur + 0.08).connect(f).connect(g);
      return;
    } else { f.type = 'bandpass'; f.frequency.value = 1800; }
    if (inst === 'clap') {
      g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; ++i) {
        g.gain.setValueAtTime(peak * (1 - i * 0.2), t + i * 0.011);
        g.gain.exponentialRampToValueAtTime(peak * 0.15, t + i * 0.011 + 0.009);
      }
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    } else {
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    }
    noiseSrc(ctx, t, t + len + 0.02).connect(f).connect(g);
    if (inst === 'snare') {
      const body = osc(ctx, 'triangle', 190, t, t + 0.1);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(vol * 1.2, t);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      body.connect(bg).connect(c.drums);
    }
  }

  function synth(ctx, c, n, t, dur, beat) {
    const inst = n.inst, wave = n.wave || 'square', vol = n.vol;
    const f0 = freq(n.midi);
    const g = ctx.createGain();
    let dest = c.mel;
    if ((inst === 'arp' || inst === 'bell') && c.pan) dest = (n.t / 2) % 2 ? c.pan[1] : c.pan[0];
    g.connect(dest);
    const end = t + Math.max(dur, 0.03) + 0.06;
    if (inst === 'bell') {
      const o = osc(ctx, 'sine', f0, t, t + dur + 1);
      const o2 = osc(ctx, 'sine', f0 * 2.01, t, t + dur + 1);
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2).connect(g);
      o.connect(g);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9 + 0.3);
      return;
    }
    const pad = inst === 'pad';
    const attack = pad ? Math.min(0.35, dur * 0.25) : 0.006;
    const release = pad ? Math.min(0.5, dur * 0.4) : Math.min(0.1, dur * 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.connect(g);
    if (wave === 'supersaw') {
      const spread = pad || inst === 'stab' ? [-12, 12] : [-16, 0, 16];
      for (const d of spread) osc(ctx, 'sawtooth', f0, t, end, d).connect(lp);
      lp.frequency.value = pad ? 2600 : 5200;
      env(g, t, vol / (spread.length === 2 ? 1.4 : 1.7), attack, dur - release, release);
    } else if (wave === 'pluck') {
      osc(ctx, 'sawtooth', f0, t, t + dur + 0.3).connect(lp);
      lp.frequency.setValueAtTime(5200, t);
      lp.frequency.exponentialRampToValueAtTime(380, t + Math.min(0.3, dur + 0.05));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 1.2), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.12, dur) + 0.15);
      return;
    } else if (wave === 'wobble') {
      osc(ctx, 'sawtooth', f0, t, end).connect(lp);
      osc(ctx, 'square', f0 / 2, t, end).connect(lp);
      lp.Q.value = 7;
      lp.frequency.value = 420;
      const lfo = osc(ctx, 'sine', (60 / beat / 60) * (n.wob || 2), t, end);
      const depth = ctx.createGain();
      depth.gain.value = 1300;
      lfo.connect(depth).connect(lp.frequency);
      env(g, t, vol, 0.01, dur - 0.03, 0.05);
    } else if (wave === 'reese') {
      osc(ctx, 'sawtooth', f0, t, end, -14).connect(lp);
      osc(ctx, 'sawtooth', f0, t, end, 14).connect(lp);
      osc(ctx, 'sine', f0 / 2, t, end).connect(g);
      lp.frequency.value = 620;
      lp.Q.value = 2;
      env(g, t, vol * 0.8, 0.02, dur - 0.05, 0.08);
    } else if (wave === 'sub') {
      osc(ctx, 'sine', f0, t, end).connect(g);
      env(g, t, vol * 1.2, 0.02, dur - 0.05, 0.08);
    } else {
      osc(ctx, wave, f0, t, end).connect(lp);
      if (pad) osc(ctx, wave, f0 * 1.006, t, end).connect(lp);
      lp.frequency.value = pad ? 1500 : inst === 'bass' ? 900 : 7000;
      env(g, t, vol, attack, dur - release, release);
    }
  }

  // the song's mix: band -> section filter -> sidechain duck -> glue compressor; drums beside it
  function makeChain(ctx, dest, song, volume) {
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(dest);
    const glue = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : ctx.createGain();
    if (glue.threshold) { glue.threshold.value = -9; glue.ratio.value = 3; glue.attack.value = 0.008; glue.release.value = 0.2; }
    glue.connect(out);
    const sec = ctx.createGain();
    sec.connect(glue);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 16000;
    const duck = ctx.createGain();
    lp.connect(duck).connect(sec);
    const drums = ctx.createGain();
    drums.connect(sec);
    let pan = null;
    if (ctx.createStereoPanner) {
      pan = [ctx.createStereoPanner(), ctx.createStereoPanner()];
      pan[0].pan.value = -0.35;
      pan[1].pan.value = 0.35;
      pan[0].connect(lp);
      pan[1].connect(lp);
    }
    return { song: song, gain: out, mel: lp, lp: lp, duck: duck, sec: sec, drums: drums, pan: pan, level: 0.85 * (volume || 1) };
  }

  let position = null;
  function scheduleArranged(ctx, c, at) {
    const R = c.song;
    const beat = 60 / R.bpm;
    const sixteenth = beat / 4;
    const swing = R.swing || 0;
    const pos = c.pos;
    const sec = sectionOf(R, pos);
    const shape = filterShape(R, pos);
    c.lp.frequency.setValueAtTime(shape[0], at);
    c.lp.frequency.exponentialRampToValueAtTime(shape[1], at + 16 * sixteenth);
    const lv = levelShape(R, pos);
    c.sec.gain.setValueAtTime(lv[0], at);
    c.sec.gain.linearRampToValueAtTime(lv[1], at + 16 * sixteenth);
    for (const n of composeArranged(R, c.bar, intensity, pos)) {
      const tt = at + n.t * sixteenth + (n.t % 2 === 1 ? swing * sixteenth : 0);
      if (n.midi === 0 || n.inst === 'tom') drum(ctx, c, n, tt, beat);
      else synth(ctx, c, n, tt, n.dur * sixteenth, beat);
    }
    position = { cycle: pos.cycle, section: sec.name, bar: pos.sb, bars: sec.bars, injected: !!sec.injected };
    c.pos = advance(R, pos, intensity);
    ++c.bar;
    return at + 16 * sixteenth;
  }

  function scheduleBar(ctx, c, at) {
    if (c.pos) return scheduleArranged(ctx, c, at);
    const song = c.song;
    const sixteenth = 60 / song.bpm / 4;
    const swing = song.swing || 0;
    const notes = compose(song, c.bar, intensity);
    const L = song.layers || {};
    for (const n of notes) {
      const off = n.t % 2 === 1 ? swing * sixteenth : 0;
      const layer = L[n.inst === 'bell' ? 'bells' : n.inst === 'kick' || n.inst === 'snare' || n.inst === 'hat' ? 'drums' : n.inst];
      voice(ctx, c.gain, n, at + n.t * sixteenth + off, n.dur * sixteenth, layer);
    }
    ++c.bar;
    return at + 16 * sixteenth;
  }

  function fade(gain, ctx, to, seconds) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), t + seconds);
  }

  function pump() {
    const ctx = audio();
    if (!ctx)
      return;
    if (!enabled || SZ.GameAudio.muted) {
      if (current) stopCurrent(ctx, 0.3);
      return;
    }
    if (wanted && (!current || current.wanted !== wanted)) {
      if (current) stopCurrent(ctx, 1.2);
      if (wanted.style) {
        const R = resolve(wanted);
        current = makeChain(ctx, SZ.GameAudio.bus('music'), R, wanted.volume);
        current.wanted = wanted;
        current.bar = 0;
        current.pos = start(R);
        current.nextAt = ctx.currentTime + 0.08;
        fade(current.gain, ctx, current.level, 1.2);
      } else {
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        gain.connect(SZ.GameAudio.bus('music'));
        fade(gain, ctx, 0.55 * (wanted.volume || 1), 1.2);
        current = { song: wanted, wanted: wanted, gain: gain, bar: 0, nextAt: ctx.currentTime + 0.08 };
      }
    } else if (!wanted && current)
      stopCurrent(ctx, 1.2);
    if (!current)
      return;
    if (current.nextAt < ctx.currentTime)
      current.nextAt = ctx.currentTime + 0.05;
    while (current.nextAt < ctx.currentTime + 0.6)
      current.nextAt = scheduleBar(ctx, current, current.nextAt);
  }

  function stopCurrent(ctx, seconds) {
    const g = current.gain;
    fade(g, ctx, 0.0001, seconds);
    setTimeout(() => { try { g.disconnect(); } catch (_) {} }, seconds * 1000 + 2500);
    current = null;
    position = null;
  }

  function ensureTimer() {
    // no Web Audio (old browsers, tests): nothing to drive
    if (timer || !(window.AudioContext || window.webkitAudioContext))
      return;
    timer = setInterval(pump, 90);
  }

  function play(song) {
    wanted = song || null;
    ensureTimer();
    pump();
  }

  function setIntensity(v) {
    intensity = Math.max(0, Math.min(1, v));
  }

  // short phrases in the current key, played over the music
  const STINGERS = {
    win: [[0, 0], [2, 1], [4, 2], [7, 3], [9, 4.5]],
    unlock: [[4, 0], [7, 1], [11, 2]],
    lose: [[4, 0], [2, 1.5], [0, 3], [-3, 5]],
    level: [[0, 0], [4, 1], [7, 2], [11, 3]],
    rare: [[7, 0], [9, 0.5], [11, 1], [14, 1.5], [16, 2.5]],
  };
  function stinger(name) {
    const ctx = audio();
    const s = STINGERS[name];
    if (!ctx || !s || !enabled || SZ.GameAudio.muted)
      return;
    const song = (current && current.song) || resolve(wanted) || { root: 60, scale: 'major', bpm: 120, layers: {} };
    const step = 60 / (song.bpm || 120) / 4;
    const t0 = ctx.currentTime + 0.02;
    const out = SZ.GameAudio.bus('music');
    for (const [st, at] of s)
      voice(ctx, out, { inst: 'bell', midi: noteOf(song, st) + 24, vol: 0.12 }, t0 + at * step, step * 4, null);
  }

  function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem(STORAGE_KEY, enabled ? '0' : '1'); } catch (_) {}
    for (const fn of listeners)
      fn(enabled);
    pump();
  }

  if (typeof window.addEventListener === 'function')
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && (e.newValue !== '1') !== enabled)
        setEnabled(e.newValue !== '1');
    });

  // renders seconds of a song offline (browsers only) -> Promise { peak, rms, buffer }: loudness checks
  function render(song, seconds, level) {
    const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Off) return Promise.resolve(null);
    const rate = 22050;
    const ctx = new Off(2, Math.ceil(rate * seconds), rate);
    const saved = intensity;
    intensity = level == null ? 0.6 : level;
    let c;
    if (song.style) {
      const R = resolve(song);
      c = makeChain(ctx, ctx.destination, R, song.volume);
      c.gain.gain.value = c.level;
      c.bar = 0;
      c.pos = start(R);
    } else {
      const g = ctx.createGain();
      g.gain.value = 0.55 * (song.volume || 1);
      g.connect(ctx.destination);
      c = { song: song, gain: g, bar: 0 };
    }
    noise = null;
    let at = 0.05;
    while (at < seconds) at = scheduleBar(ctx, c, at);
    intensity = saved;
    return ctx.startRendering().then((buf) => {
      noise = null;
      let peak = 0, sum = 0;
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; ++i) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
      return { peak: peak, rms: Math.sqrt(sum / d.length), buffer: buf };
    });
  }

  SZ.GameMusic = {
    play, setIntensity, stinger, compose, noteOf, chordSteps, SCALES, DRUMS,
    STYLES, resolve, planCycle, start, advance, sectionOf, locate, chordOf, variant, render,
    get position() { return position; },
    get enabled() { return enabled; },
    set enabled(v) { setEnabled(v); },
    toggle() { setEnabled(!enabled); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get current() { return wanted; },
    get intensity() { return intensity; },
  };
})();
