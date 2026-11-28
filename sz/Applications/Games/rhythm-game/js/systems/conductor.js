/* The song clock. A song starts a lead-in before its first bar (or before the bar a Continue or a
   resume rejoins it at) on frame time; just before that bar it asks SZ.GameMusic to play the chart's
   song from the same section and bar with a short fade, and from then on follows the audio context
   (the audio time since the song's first bar, less the output latency, so it is the time you hear), slewing gently and jumping only on a large error, so
   the notes stay locked to what you hear. Without audio (muted, tests, no Web Audio) frame time
   runs the song alone. The global audio offset shifts presses, and a key event's own timestamp
   places a press between frames. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  function now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /* opts: bar (rejoin at), lead (seconds before it), silent (no music: the demo) */
  function create(chart, opts) {
    opts = opts || {};
    const bar = opts.bar || 0;
    return { chart: chart, song: chart.song, bar: bar, t: bar * chart.barLen - (opts.lead == null ? 2.2 : opts.lead), started: false, synced: false,
      origin: null, perf: now(), silent: !!opts.silent, paused: false, muteT: 0 };
  }

  function audio() {
    const A = SZ.GameAudio, Mu = SZ.GameMusic;
    if (!A || !A.running || !A.context || !Mu || !Mu.enabled || A.muted) return null;
    return A.context;
  }

  function startMusic(c) {
    c.started = true;
    if (c.silent || !SZ.GameMusic) return;
    SZ.GameMusic.setIntensity(0.5);
    SZ.GameMusic.play(c.song, { from: c.chart.from, bar: c.bar, fade: 0.05 });
  }

  function update(c, dt) {
    c.perf = now();
    if (c.paused) return c.t;
    c.t += dt;
    if (!c.started && c.t >= c.bar * c.chart.barLen - 0.15) startMusic(c);
    const ctx = !c.silent && c.started ? audio() : null;
    const sch = ctx ? SZ.GameMusic.schedule : null;
    /* only the schedule of this song (another may still be playing until ours takes over) */
    if (sch && sch.song === c.song) {
      /* audio time of song time 0 */
      const origin = sch.startedAt - c.bar * c.chart.barLen;
      /* what is heard lags the context clock by the output latency */
      const lag = (ctx.outputLatency || 0) || (ctx.baseLatency || 0);
      const at = ctx.currentTime - lag - origin;
      const err = at - c.t;
      if (!c.synced || Math.abs(err) > 0.12) { c.t = at; c.synced = true; }
      else c.t += err * Math.min(1, dt * 6);
    }
    return c.t;
  }

  /* the song time of a moment given by performance.now() (a key event's timeStamp) */
  function timeAt(c, perf) {
    if (perf == null || !isFinite(perf)) return c.t;
    const d = (perf - c.perf) / 1000;
    return c.t + Math.max(-0.05, Math.min(0.05, d));
  }

  function pause(c) {
    c.paused = true;
    if (!c.silent && SZ.GameMusic && SZ.GameMusic.current === c.song) SZ.GameMusic.play(null, { fade: 0.2 });
  }

  /* rejoin at the bar the song had reached, with a lead-in */
  function resume(c, lead) {
    const bar = Math.max(0, Math.floor((c.t + 0.05) / c.chart.barLen));
    c.bar = bar;
    c.t = bar * c.chart.barLen - (lead == null ? 2 : lead);
    c.started = false;
    c.synced = false;
    c.paused = false;
  }

  function stop(c) {
    if (c && !c.silent && SZ.GameMusic && SZ.GameMusic.current === c.song) SZ.GameMusic.play(null, { fade: 1.2 });
  }

  /* the song's beat phase 0..1 and beat index at song time t */
  function beatOf(c, t) {
    const b = t / c.chart.beat;
    return { i: Math.floor(b), f: b - Math.floor(b) };
  }

  Object.assign(NS.conductor, { create, update, timeAt, pause, resume, stop, beatOf });
})();
