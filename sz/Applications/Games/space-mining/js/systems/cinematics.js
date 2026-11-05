/* The cinematic sequencer: full-screen sequences (the intro launch from the station, the
   per-trip undock, a new belt charted, the career ending) on their own screen, and in-world
   sequences over a running trip (warp arrival, docking with autopilot, discoveries with a
   close-up and slow motion). Any key, click or tap skips once the first moment has shown.
   Owns G.cine. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const R = NS.rng.fx;

  const KINDS = {
    intro: { dur: 14, full: true },
    launch: { dur: 3.4, full: true },
    milestone: { dur: 4.6, full: true },
    ending: { dur: 18, full: true },
    arrival: { dur: 3.2 },
    docking: { dur: 3.4 },
    discovery: { dur: 4.4 },
  };

  let returnScreen = 'title';

  function play(kind, data, onEnd) {
    const k = KINDS[kind];
    G.cine = { kind: kind, t: 0, dur: k.dur, full: !!k.full, data: data || {}, onEnd: onEnd || null, fired: {} };
    if (k.full) {
      returnScreen = G.screen;
      NS.screens.setScreen('cine');
    }
    if (kind === 'arrival') arrivalStart();
    if (kind === 'docking') {
      G.ship.control = false;
      G.cine.data.sx = G.ship.x;
      G.cine.data.sy = G.ship.y;
      G.cine.data.sa = G.ship.angle;
      NS.audio.sfx('whoosh', { volume: 0.4, pitch: 0.7 });
    }
    if (kind === 'discovery') {
      G.ship.control = false;
      G.cam.focus = { x: data.x, y: data.y, zoom: data.kind === 'crown' ? 0.75 : 1.35 };
      NS.fx.slowMo(KINDS.discovery.dur, 0.35);
      NS.audio.sfx('powerup', { volume: 0.7, pitch: 0.6 });
    }
  }

  function arrivalStart() {
    const s = G.ship;
    s.control = false;
    s.hidden = true;
    G.cam.zoom = 0.72;
  }

  /* fires once per cinematic at time t */
  function at(c, t, key) {
    if (c.t >= t && !c.fired[key]) {
      c.fired[key] = true;
      return true;
    }
    return false;
  }

  function update(dt) {
    const c = G.cine;
    if (!c) return;
    c.t += dt;
    const s = G.ship;
    switch (c.kind) {
      case 'arrival':
        if (at(c, 0.75, 'drop')) {
          s.hidden = false;
          s.vy = -340;
          NS.fx.flash('#ffffff', 0.7);
          NS.fx.shockwave(s.x, s.y, 360, G.run.zone.theme.accent);
          NS.fx.sparks(s.x, s.y, Math.PI / 2, 1.2, 30, '#ffffff', 600, 0.5);
          NS.fx.shake(0.4);
          NS.audio.sfx('whoosh', { volume: 0.8 });
          NS.audio.sfx('explode', { volume: 0.3, pitch: 1.6 });
        }
        G.cam.tzoom = 1;
        break;
      case 'docking': {
        const d = c.data, k = Math.min(1, c.t / (c.dur * 0.8));
        const e = k * k * (3 - 2 * k);
        s.x = d.sx + (G.dock.x - d.sx) * e;
        s.y = d.sy + (G.dock.y - d.sy) * e;
        s.vx = s.vy = 0;
        s.angle = d.sa + NS.rng.angleDiff(d.sa, -Math.PI / 2) * e;
        s.thrust = 0.4 * (1 - e);
        G.cam.focus = { x: G.dock.x, y: G.dock.y, zoom: 1 + e * 0.35 };
        if (at(c, c.dur * 0.62, 'clamp')) {
          NS.audio.sfx('thud', { volume: 0.7 });
          NS.fx.ring(G.dock.x, G.dock.y, 30, 140, 0.5, '#ffd25a', 6);
          NS.fx.sparks(G.dock.x, G.dock.y, 0, Math.PI * 2, 16, '#ffd25a', 240, 0.4);
        }
        break;
      }
      case 'discovery':
        if (at(c, 0.6, 'reveal')) {
          NS.fx.ring(c.data.x, c.data.y, 40, 420, 1.2, c.data.kind === 'derelict' ? '#ffd8a0' : '#e8c8ff', 4);
          NS.audio.sfx('win', { volume: 0.5 });
        }
        break;
      case 'launch':
        if (at(c, 0.4, 'go')) NS.audio.sfx('whoosh', { volume: 0.7 });
        break;
      case 'intro':
        if (at(c, 5.4, 'undock')) NS.audio.sfx('whoosh', { volume: 0.6, pitch: 0.8 });
        if (at(c, 8.6, 'burn')) NS.audio.sfx('whoosh', { volume: 0.9, pitch: 0.5 });
        break;
      case 'milestone':
        if (at(c, 1.2, 'light')) NS.audio.sfx('levelup', { volume: 0.7 });
        break;
      case 'ending':
        if (at(c, 0.5, 'boom')) NS.audio.sfx('explode', { volume: 0.8, pitch: 0.5 });
        if (at(c, 6, 'cheer')) NS.audio.sfx('win', { volume: 0.8 });
        if (c.t > 6 && c.t < 12 && R() < dt * 3) NS.audio.sfx('smallExplode', { volume: 0.25, pitch: 1.2 + R() });
        break;
    }
    if (c.t >= c.dur) finish();
  }

  function finish() {
    const c = G.cine;
    if (!c) return;
    G.cine = null;
    const s = G.ship;
    switch (c.kind) {
      case 'arrival':
        s.hidden = false;
        s.control = true;
        G.cam.tzoom = 1;
        if (c.data.zone) NS.trip.banner(c.data.zone.name.toUpperCase(), c.data.zone.sub, c.data.zone.theme.accent);
        break;
      case 'docking':
        s.x = G.dock.x;
        s.y = G.dock.y;
        G.cam.focus = null;
        NS.trip.endTrip('dock');
        return;
      case 'discovery':
        s.control = true;
        G.cam.focus = null;
        G.slowMo = Math.min(G.slowMo, 0.5);
        G.run.rd += 1;
        NS.fx.text(s.x, s.y - 60, '+1 DATA  discovery logged', '#b48aff', 15, 1.6);
        break;
    }
    if (c.full && !c.onEnd) NS.screens.setScreen(returnScreen === 'cine' ? 'title' : returnScreen);
    if (c.onEnd) c.onEnd();
  }

  /* any input: skip after a short grace so the press that started it does not */
  function skip() {
    const c = G.cine;
    if (!c || c.t < 0.35) return false;
    if (c.kind === 'arrival' && !c.fired.drop) update(0.8);
    finish();
    return true;
  }

  function active() {
    return !!G.cine;
  }

  Object.assign(NS.cinematics, {
    KINDS, play, update, finish, skip, active
  });
})();
