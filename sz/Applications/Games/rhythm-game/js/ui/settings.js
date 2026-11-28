/* Settings: scroll speed, the audio offset by hand, the calibration tap test (a metronome clicks and
   pulses; you tap any lane key along, and the mean distance of your taps from the clicks becomes the
   offset), Relaxed mode (songs cannot fail, no third star), effects detail and the menu music. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const { UI } = C;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const BEAT = 0.6, CLICKS = 16;

  function now() {
    return typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000;
  }

  function stepper(id, label, value, x, y, onChange, fmt) {
    kit.text(label, x, y + 20, 16, '#ffffff', { weight: 'bold' });
    W.button(id + '-', '-', x + 260, y, 50, 40, { px: 20, action: () => onChange(-1) });
    kit.text(fmt ? fmt(value) : String(value), x + 370, y + 21, 20, UI.gold, { align: 'center', weight: 'bold' });
    W.button(id + '+', '+', x + 430, y, 50, 40, { px: 20, action: () => onChange(1) });
  }

  function toggle(id, label, on, x, y, fn, sub) {
    kit.text(label, x, y + 20, 16, '#ffffff', { weight: 'bold' });
    if (sub) kit.text(sub, x, y + 42, 12, UI.textDim);
    W.button(id, on ? 'On' : 'Off', x + 330, y, 150, 40, { selected: on, action: fn });
  }

  function startCalib() {
    G.ui.calib = { t0: now() + 1, taps: [], last: -1 };
    if (SZ.GameMusic) SZ.GameMusic.play(null);
  }

  /* a tap at performance time (seconds) */
  function tap(at) {
    const c = G.ui.calib;
    if (!c || c.done) return;
    const k = Math.round((at - c.t0) / BEAT);
    if (k < 2 || k >= CLICKS) return;
    c.taps.push(at - (c.t0 + k * BEAT));
  }

  function update() {
    const c = G.ui.calib;
    if (!c || c.done) return;
    const k = Math.floor((now() - c.t0) / BEAT);
    if (k >= 0 && k !== c.last && k < CLICKS) { c.last = k; sfx('click', { pitch: k % 4 === 0 ? 1.6 : 1.2, volume: 0.8 }); G.pulse = 1; }
    if (k >= CLICKS + 1) {
      c.done = true;
      if (c.taps.length >= 6) {
        const sorted = c.taps.slice().sort((a, b) => a - b);
        const mid = sorted.slice(Math.floor(sorted.length * 0.2), Math.ceil(sorted.length * 0.8));
        const mean = mid.reduce((a, b) => a + b, 0) / mid.length;
        c.result = Math.round(mean * 1000);
        G.profile.settings.offset = Math.max(-250, Math.min(250, c.result));
        ++G.profile.stats.calibrated;
        NS.save.saveProfile(G.profile);
      } else c.result = null;
    }
  }

  function draw() {
    const p = G.profile, s = p.settings;
    kit.text('SETTINGS', 40, 40, 30, '#ffffff', { weight: 'bold', shadow: true });
    kit.panel(40, 90, 560, 520, { accent: UI.accent });
    stepper('speed', 'Scroll speed', s.speed, 70, 120, d => { s.speed = Math.max(1, Math.min(10, s.speed + d)); });
    stepper('offset', 'Audio offset', s.offset, 70, 190, d => { s.offset = Math.max(-250, Math.min(250, s.offset + d * 5)); }, v => (v > 0 ? '+' : '') + v + ' ms');
    kit.wrap('Positive when you hear the music late (wireless headphones, some speakers).', 70, 250, 500, 12, UI.textDim);
    toggle('relaxed', 'Relaxed mode', !!s.relaxed, 70, 290, () => { s.relaxed = !s.relaxed; }, 'songs cannot fail, no third star');
    toggle('effects', 'Effects detail', s.effects !== 'low', 70, 370, () => { s.effects = s.effects === 'low' ? 'high' : 'low'; }, 'fewer particles on slow machines');
    toggle('music', 'Menu music', !SZ.GameMusic || SZ.GameMusic.enabled, 70, 450, () => { if (SZ.GameMusic) SZ.GameMusic.toggle(); }, 'song audio is part of play');
    /* calibration */
    const c = G.ui.calib;
    kit.panel(640, 90, 600, 520, { accent: UI.gold });
    kit.text('CALIBRATE', 940, 124, 20, UI.gold, { align: 'center', weight: 'bold' });
    kit.wrap('Press Start, then tap any lane key (or the circle) on every click. Sixteen clicks; the first two are for finding the beat.', 670, 156, 540, 13, '#ffffff');
    const pulse = G.pulse || 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 + pulse * 0.6;
    K.blit(ctx, K.glow(UI.gold), 940, 330, 1.5 + pulse * 0.5);
    ctx.restore();
    K.circle(ctx, 940, 330, 60 + pulse * 10, '#1a1030');
    ctx.lineWidth = 4; ctx.strokeStyle = UI.gold; ctx.stroke();
    W.area('calib-tap', 870, 260, 140, 140, () => tap(now()), { nonav: true });
    if (c) {
      kit.text(c.done ? 'Done' : Math.max(0, CLICKS - 1 - c.last) + '', 940, 332, 34, '#ffffff', { align: 'center', weight: 'bold' });
      /* the taps on a timeline: early left, late right */
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(700, 440, 480, 2); ctx.fillRect(939, 428, 2, 26);
      for (const d of c.taps) { K.circle(ctx, 940 + Math.max(-240, Math.min(240, d * 1600)), 441, 5, Math.abs(d) < 0.03 ? UI.good : UI.gold); }
      kit.text('early', 700, 466, 11, UI.textDim); kit.text('late', 1180, 466, 11, UI.textDim, { align: 'right' });
      if (c.done) kit.text(c.result != null ? 'Your offset: ' + (c.result > 0 ? '+' : '') + c.result + ' ms - saved' : 'Too few taps - try again', 940, 500, 16, c.result != null ? UI.good : UI.bad, { align: 'center', weight: 'bold' });
    } else kit.text('?', 940, 332, 40, UI.textDim, { align: 'center', weight: 'bold' });
    W.button('calib-start', c && !c.done ? 'Listening...' : 'Start', 820, 530, 240, 52, { icon: 'play', accent: UI.gold, disabled: !!(c && !c.done), action: startCalib });
    W.button('back', 'Back', 40, 650, 200, 48, { icon: 'back', accent: UI.good, action: () => { G.ui.calib = null; NS.save.saveProfile(p); NS.screens.back(); } });
  }

  Object.assign(NS.settings, { BEAT, CLICKS, startCalib, tap, update, draw });
})();
