;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The cinematic player: runs one script from NS.C.CINE shot by shot on its own screen,
     types out the speech lines with soft blips, fires each shot's sound cues, and returns
     to the screen it came from (or calls onEnd). Any key, click or tap skips it. Marks a
     script as seen in the save. Owns G.cine. */

  const { CINE, STATE_CINE, STATE_TITLE } = NS.C;
  const { particles, screenShake, sfx } = NS.services;
  const G = NS.state;
  const Save = NS.save;
  const Nav = NS.nav;

  const TYPE_RATE = 42;   // characters per second

  function play(id, onEnd) {
    const shots = CINE[id];
    if (!shots) {
      if (onEnd)
        onEnd();
      return;
    }
    G.cine = { id: id, shots: shots, index: 0, t: 0, total: 0, onEnd: onEnd || null, prev: G.state, typed: 0 };
    G.state = STATE_CINE;
    G.save.seenCine[id] = true;
    Save.writeSave();
    particles.clear();
    G.fade = 1;
    shotStart();
    Nav.updateStatus();
  }

  function shot() {
    return G.cine ? G.cine.shots[G.cine.index] : null;
  }

  function shotStart() {
    const s = shot();
    const fx = s.fx || [];
    if (fx.indexOf('lightning') >= 0) {
      sfx('explode', { volume: 0.5, pitch: 0.5 });
      sfx('zap', { volume: 0.5, pitch: 0.6 });
    }
    if (fx.indexOf('shake') >= 0)
      screenShake.trigger(6, 600);
    if (fx.indexOf('title') >= 0)
      sfx('levelup', { volume: 0.6 });
    if (fx.indexOf('fireworks') >= 0)
      sfx('win', { volume: 0.6 });
    if (fx.indexOf('rays') >= 0)
      sfx('powerup', { volume: 0.5, pitch: 0.8 });
    if (s.actors && s.actors.some(a => a.scatter))
      sfx('whoosh', { volume: 0.7, pitch: 0.6 });
    if (s.actors && s.actors.some(a => a.gather))
      sfx('powerup', { volume: 0.5, pitch: 0.7 });
    G.cine.typed = 0;
  }

  function update(dt) {
    const c = G.cine;
    if (!c)
      return;
    c.t += dt;
    c.total += dt;
    screenShake.update(dt * 1000);
    particles.update(dt);
    const s = shot();
    if (s.say) {
      const n = Math.min(s.say.text.length, Math.floor(Math.max(0, c.t - 0.35) * TYPE_RATE));
      if (n > c.typed) {
        if (Math.floor(n / 3) !== Math.floor(c.typed / 3) && s.say.text[n - 1] !== ' ')
          sfx('blip', { volume: 0.12, pitch: speakerPitch(s.say.who) + Math.random() * 0.1 });
        c.typed = n;
      }
    }
    // lightning flashes during stormy shots
    if (s.fx && s.fx.indexOf('lightning') >= 0 && Math.random() < dt * 0.9) {
      G.flash = 0.6;
      G.flashColor = '#e8e0ff';
      sfx('explode', { volume: 0.25, pitch: 0.4 + Math.random() * 0.3 });
    }
    if (c.t >= s.t) {
      ++c.index;
      c.t = 0;
      if (c.index >= c.shots.length) {
        end();
        return;
      }
      G.fade = 0.6;
      shotStart();
    }
  }

  function speakerPitch(who) {
    return { sunny: 1.3, pip: 1.6, hoot: 0.7, ruby: 1.2, jay: 1.0, corvus: 0.55 }[who] || 1;
  }

  function end() {
    const c = G.cine;
    if (!c)
      return;
    G.cine = null;
    particles.clear();
    G.fade = 1;
    G.state = c.prev === STATE_CINE ? STATE_TITLE : c.prev;
    if (c.onEnd)
      c.onEnd();
    Nav.updateStatus();
    Nav.updateWindowTitle();
  }

  /* any key / click / tap: skip the cinematic once it has been on screen a moment */
  function skip() {
    if (!G.cine || G.cine.total < 0.35)
      return;
    sfx('click', { volume: 0.4 });
    end();
  }

  Object.assign(NS.cine, { play, update, end, skip, shot });
})();
