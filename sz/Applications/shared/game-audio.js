;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  // Synthesized sound effects for the games: no sound files, one shared
  // mute switch for every game (remembered in the browser), quiet while the
  // game's page is hidden. The audio context starts on the first key or
  // pointer press, as browsers require.
  //
  //   SZ.GameAudio.play('explode')          a named effect (see EFFECTS)
  //   SZ.GameAudio.play('pickup', { pitch: 1.5, volume: 0.5 })
  //   SZ.GameAudio.tone(440, 0.2, 'square') a plain note
  //   SZ.GameAudio.muted / toggleMute()     the shared switch
  //   SZ.GameAudio.attachMuteButton()       small speaker button in a corner

  const STORAGE_KEY = 'sz-game-audio-muted';
  const MIN_REPEAT_S = 0.03;

  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  const lastPlayed = new Map();
  const listeners = new Set();

  try { muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) {}

  function ensure() {
    if (ctx)
      return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC)
      return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; ++i)
      d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended' && !document.hidden)
      c.resume().catch(() => {});
  }
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  document.addEventListener('visibilitychange', () => {
    if (!ctx)
      return;
    if (document.hidden)
      ctx.suspend().catch(() => {});
    else
      ctx.resume().catch(() => {});
  });

  function ready() {
    return !muted && ctx && ctx.state === 'running';
  }

  // ── building blocks ─────────────────────────────────────────────

  function envelope(gainNode, t, volume, attack, duration) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + duration);
  }

  function sweep(from, to, duration, wave, volume, delay = 0) {
    if (!ready())
      return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave || 'square';
    osc.frequency.setValueAtTime(Math.max(1, from), t);
    if (to !== from)
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
    envelope(gain, t, volume ?? 0.15, 0.005, duration);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function noise(duration, volume, filterType, freqFrom, freqTo, delay = 0) {
    if (!ready())
      return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.setValueAtTime(freqFrom || 2000, t);
    if (freqTo)
      filter.frequency.exponentialRampToValueAtTime(freqTo, t + duration);
    const gain = ctx.createGain();
    envelope(gain, t, volume ?? 0.2, 0.004, duration);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  function tone(freq, duration, wave, volume, delay) {
    sweep(freq, freq, duration, wave || 'sine', volume, delay);
  }

  // ── named effects (p = pitch factor, v = volume factor) ─────────

  const EFFECTS = {
    click:    (p, v) => sweep(1800 * p, 1200 * p, 0.03, 'square', 0.06 * v),
    blip:     (p, v) => sweep(880 * p, 880 * p, 0.06, 'square', 0.08 * v),
    select:   (p, v) => { tone(660 * p, 0.05, 'square', 0.07 * v); tone(990 * p, 0.07, 'square', 0.07 * v, 0.05); },
    jump:     (p, v) => sweep(300 * p, 750 * p, 0.16, 'square', 0.1 * v),
    bounce:   (p, v) => sweep(520 * p, 300 * p, 0.08, 'triangle', 0.14 * v),
    hit:      (p, v) => { sweep(220 * p, 90 * p, 0.1, 'square', 0.12 * v); noise(0.06, 0.12 * v, 'lowpass', 3000); },
    thud:     (p, v) => { sweep(140 * p, 50 * p, 0.14, 'sine', 0.25 * v); noise(0.05, 0.08 * v, 'lowpass', 600); },
    shoot:    (p, v) => sweep(1100 * p, 260 * p, 0.12, 'square', 0.07 * v),
    laser:    (p, v) => sweep(1600 * p, 120 * p, 0.2, 'sawtooth', 0.06 * v),
    explode:  (p, v) => { noise(0.55, 0.3 * v, 'lowpass', 2400 * p, 120); sweep(120 * p, 35 * p, 0.4, 'sine', 0.22 * v); },
    smallExplode: (p, v) => { noise(0.22, 0.18 * v, 'lowpass', 3200 * p, 300); },
    pickup:   (p, v) => { tone(988 * p, 0.06, 'square', 0.08 * v); tone(1319 * p, 0.12, 'square', 0.08 * v, 0.06); },
    coin:     (p, v) => { tone(1319 * p, 0.05, 'square', 0.07 * v); tone(1760 * p, 0.18, 'square', 0.07 * v, 0.05); },
    powerup:  (p, v) => { for (let i = 0; i < 5; ++i) tone(440 * p * Math.pow(1.26, i), 0.07, 'square', 0.07 * v, i * 0.055); },
    levelup:  (p, v) => { [523, 659, 784, 1047].forEach((f, i) => tone(f * p, 0.14, 'triangle', 0.12 * v, i * 0.09)); },
    win:      (p, v) => { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f * p, 0.16, 'triangle', 0.12 * v, i * 0.11)); },
    lose:     (p, v) => { [392, 330, 262, 196].forEach((f, i) => tone(f * p, 0.22, 'triangle', 0.13 * v, i * 0.16)); },
    hurt:     (p, v) => { sweep(400 * p, 150 * p, 0.18, 'sawtooth', 0.1 * v); noise(0.1, 0.08 * v, 'bandpass', 1200); },
    whoosh:   (p, v) => noise(0.25, 0.12 * v, 'bandpass', 400 * p, 2400 * p),
    zap:      (p, v) => { sweep(2400 * p, 600 * p, 0.09, 'sawtooth', 0.06 * v); sweep(1200 * p, 300 * p, 0.09, 'square', 0.05 * v, 0.03); },
    drop:     (p, v) => sweep(600 * p, 200 * p, 0.12, 'triangle', 0.12 * v),
    lineClear:(p, v) => { noise(0.18, 0.1 * v, 'highpass', 2000); [660, 880, 1100].forEach((f, i) => tone(f * p, 0.08, 'square', 0.07 * v, i * 0.05)); },
    error:    (p, v) => { tone(160 * p, 0.12, 'square', 0.08 * v); tone(120 * p, 0.16, 'square', 0.08 * v, 0.12); },
  };

  function play(name, opts) {
    if (!ready())
      return;
    const fx = EFFECTS[name];
    if (!fx)
      return;
    const now = ctx.currentTime;
    if (now - (lastPlayed.get(name) || -1) < MIN_REPEAT_S)
      return;
    lastPlayed.set(name, now);
    const pitch = (opts && opts.pitch) || 1;
    const volume = opts && opts.volume != null ? opts.volume : 1;
    fx(pitch, volume);
  }

  // ── shared mute switch ──────────────────────────────────────────

  function setMuted(value) {
    muted = !!value;
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch (_) {}
    if (master)
      master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
    for (const fn of listeners)
      fn(muted);
  }

  // another game in another window changed the switch
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && (e.newValue === '1') !== muted)
      setMuted(e.newValue === '1');
  });

  function attachMuteButton(parent) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sz-game-mute';
    btn.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:9999;width:28px;height:28px;padding:0;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(0,0,0,.45);color:#fff;font:14px/26px sans-serif;cursor:pointer;opacity:.7';
    const show = () => {
      btn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
      btn.title = muted ? 'Sound off (click to turn on)' : 'Sound on (click to turn off)';
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMuted(!muted);
      btn.blur();
    });
    // the button must not steal the game's keys
    btn.addEventListener('keydown', (e) => e.stopPropagation());
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    listeners.add(show);
    show();
    (parent || document.body).appendChild(btn);
    return btn;
  }

  SZ.GameAudio = {
    play, tone, sweep, noise, attachMuteButton,
    get muted() { return muted; },
    set muted(v) { setMuted(v); },
    toggleMute() { setMuted(!muted); },
    onMuteChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get effects() { return Object.keys(EFFECTS); },
  };
})();
