/* Cinematics: plays a list of shots from the story - each line types itself out, any key,
   click or tap first completes the line and then moves on, Escape skips the rest - and calls
   back when it ends. Remembers which cinematics were seen. Owns G.cine. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { CINEMATICS } = NS.story;
  const { sfx } = NS.audio;

  const TYPE_SPEED = 48;

  function play(id, done) {
    const shots = CINEMATICS[id];
    if (!shots) { if (done) done(); return; }
    G.cine = { id: id, shots: shots, i: 0, t: 0, typed: 0, done: done };
    G.save.seen.cine[id] = 1;
    if (id === 'intro') G.save.seen.intro = 1;
    NS.screens.setScreen('cine');
    sfx('whoosh', { pitch: 0.6, volume: 0.5 });
  }

  function update(dt) {
    const c = G.cine;
    if (!c) return;
    c.t += dt;
    const line = c.shots[c.i].text;
    if (c.typed < line.length) {
      const before = Math.floor(c.typed);
      c.typed = Math.min(line.length, c.typed + dt * TYPE_SPEED);
      if (Math.floor(c.typed) !== before && Math.floor(c.typed) % 3 === 0) sfx('click', { volume: 0.12, pitch: 1.6 });
    }
  }

  function next() {
    const c = G.cine;
    if (!c) return;
    const line = c.shots[c.i].text;
    if (c.typed < line.length) { c.typed = line.length; return; }
    if (c.i < c.shots.length - 1) {
      ++c.i;
      c.t = 0;
      c.typed = 0;
      sfx('blip', { volume: 0.4 });
      return;
    }
    end();
  }

  function end() {
    const c = G.cine;
    if (!c) return;
    G.cine = null;
    NS.save.writeSave();
    if (c.done) c.done(); else NS.screens.setScreen('title');
  }

  Object.assign(NS.cine, {
    play, update, next, end
  });
})();
