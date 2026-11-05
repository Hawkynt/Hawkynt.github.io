/* Cinematics: plays a story sequence shot by shot with typewriter dialogue, finishing the line on
   the first key/click/tap and moving on with the next, advancing by itself after a pause, and
   skipping the rest with Escape. Marks the sequence seen and hands control back to whatever
   asked for it. Owns G.cine. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { CINEMATICS } = NS.story;
  const { sfx } = NS.audio;

  const CPS = 46;
  const HOLD = 4.5;

  function play(id, then) {
    const shots = CINEMATICS[id];
    if (!shots) { if (then) then(); return; }
    G.save.seen[id] = true;
    NS.save.writeSave();
    G.cine = { id: id, shots: shots, i: 0, t: 0, typed: 0, then: then || null, fade: 0 };
    NS.screens.setScreen('cine');
    sfx('whoosh', { volume: 0.5 });
  }

  function shot() {
    return G.cine ? G.cine.shots[G.cine.i] : null;
  }

  function update(dt) {
    const c = G.cine;
    if (!c) return;
    c.t += dt;
    const len = shot().text.length;
    const before = Math.floor(c.typed);
    c.typed = Math.min(len, c.typed + dt * CPS);
    if (Math.floor(c.typed) !== before && before % 3 === 0 && c.typed < len) sfx('click', { volume: 0.12, pitch: 1.6 });
    if (c.typed >= len && c.t > len / CPS + HOLD) next();
  }

  function next() {
    const c = G.cine;
    if (!c) return;
    if (c.typed < shot().text.length) {
      c.typed = shot().text.length;
      return;
    }
    if (c.i + 1 < c.shots.length) {
      c.i += 1;
      c.t = 0;
      c.typed = 0;
      sfx('blip', { volume: 0.4, pitch: 0.9 });
      return;
    }
    end();
  }

  function end() {
    const c = G.cine;
    if (!c) return;
    G.cine = null;
    if (c.then) c.then();
    else NS.screens.setScreen('title');
  }

  Object.assign(NS.cine, {
    play, shot, update, next, end
  });
})();
