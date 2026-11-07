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
  function compose(song, bar, intensity) {
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

  function scheduleBar(ctx, c, at) {
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
    if (wanted && (!current || current.song !== wanted)) {
      if (current) stopCurrent(ctx, 1.2);
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(SZ.GameAudio.bus('music'));
      fade(gain, ctx, 0.55 * (wanted.volume || 1), 1.2);
      current = { song: wanted, gain: gain, bar: 0, nextAt: ctx.currentTime + 0.08 };
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
    const song = (current && current.song) || wanted || { root: 60, scale: 'major', bpm: 120, layers: {} };
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

  SZ.GameMusic = {
    play, setIntensity, stinger, compose, noteOf, chordSteps, SCALES, DRUMS,
    get enabled() { return enabled; },
    set enabled(v) { setEnabled(v); },
    toggle() { setEnabled(!enabled); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get current() { return wanted; },
    get intensity() { return intensity; },
  };
})();
