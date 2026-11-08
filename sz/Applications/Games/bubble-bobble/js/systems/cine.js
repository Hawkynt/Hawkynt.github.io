/* The cinematic player: a list of shots (card, talk, boss, victory, credits, count) played one
   after the other with letterbox, typed dialogue and sounds. A click or key completes the typed
   line, then moves to the next shot; Escape skips the rest. The count shot is the 3-2-1 before
   play and cannot be skipped past by accident. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const G = NS.state;
  const { sfx } = NS.audio;

  function play(shots, id, onEnd) {
    if (!shots || !shots.length) {
      if (onEnd) onEnd();
      return;
    }
    G.cine = { id: id || 'cine', shots: shots, i: 0, t: 0, typed: 0, started: false, onEnd: onEnd || null };
  }

  function shot() {
    return G.cine ? G.cine.shots[G.cine.i] : null;
  }

  function startShot(s) {
    if (s.kind === 'card') sfx('whoosh', { volume: 0.5 });
    else if (s.kind === 'boss') { sfx('explode', { pitch: 0.5, volume: 0.6 }); NS.fx.shake(10); }
    else if (s.kind === 'victory') { sfx('win'); NS.fx.flash(0.6, '#ffffff'); }
    else if (s.kind === 'talk') sfx('blip', { pitch: 1.4, volume: 0.3 });
  }

  function update(dt) {
    const c = G.cine;
    if (!c) return;
    const s = c.shots[c.i];
    if (!c.started) {
      c.started = true;
      startShot(s);
    }
    c.t += dt;
    if (s.kind === 'talk') {
      const before = Math.floor(c.typed);
      c.typed = Math.min(s.text.length, c.typed + dt * 45);
      if (Math.floor(c.typed) !== before && Math.floor(c.typed) % 3 === 0) sfx('click', { volume: 0.12, gap: 40 });
    }
    if (s.kind === 'count') {
      const k = Math.floor(c.t / 0.5);
      if (k !== c.lastCount && k < 3) {
        c.lastCount = k;
        sfx('blip', { pitch: 0.8 + k * 0.15 });
      }
    }
    if (c.t >= s.dur + (s.kind === 'talk' ? s.text.length / 45 * 0.5 : 0)) next(true);
  }

  /* a click: finish the typed line first, then the next shot */
  function next(auto) {
    const c = G.cine;
    if (!c) return;
    const s = c.shots[c.i];
    if (!auto && s.kind === 'talk' && c.typed < s.text.length) {
      c.typed = s.text.length;
      return;
    }
    if (!auto && s.kind === 'count') return;
    ++c.i;
    c.t = 0;
    c.typed = 0;
    c.started = false;
    if (c.i >= c.shots.length) end();
  }

  /* Escape: skip to the count (if any) or the end */
  function skip() {
    const c = G.cine;
    if (!c) return;
    const k = c.shots.findIndex((s, i) => i > c.i && s.kind === 'count');
    if (k >= 0 && c.shots[c.i].kind !== 'count') {
      c.i = k;
      c.t = 0;
      c.started = false;
      return;
    }
    if (c.shots[c.i].kind === 'count') return;
    end();
  }

  function end() {
    const c = G.cine;
    G.cine = null;
    if (c && c.onEnd) c.onEnd();
  }

  Object.assign(NS.cine, { play, shot, update, next, skip, end });
})();
