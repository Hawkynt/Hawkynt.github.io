/* Cinematic playback: starts a scripted sequence of comic shots, types out each line, fires
   the shot's effect (flash, shake, booms, sparkles, darkness) when it opens, advances on any
   key, click or tap (first completing the line), skips the rest on Escape or the Skip button,
   then hands control to the follow-up. Owns G.cine. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const G = NS.state;
  const { CINEMATICS } = NS.story;
  const fx = NS.fx;

  const TYPE_RATE = 48;

  function play(id, then) {
    const shots = CINEMATICS[id];
    if (!shots) { if (then) then(); return; }
    G.cine = { id: id, shot: 0, t: 0, chars: 0, then: then || null, fired: false, from: G.screen };
    NS.screens.setScreen('cine');
  }

  function shot() {
    return G.cine ? CINEMATICS[G.cine.id][G.cine.shot] : null;
  }

  function update(dt) {
    const c = G.cine;
    if (!c) return;
    c.t += dt;
    c.chars += dt * TYPE_RATE;
    const s = shot();
    if (!s) return;
    if (!c.fired) {
      c.fired = true;
      NS.backdrop.setScene(s.scene);
      switch (s.fx) {
        case 'flash': fx.flash('#ffffff', 0.7); fx.sfx('zap', { pitch: 0.6 }); break;
        case 'shake': fx.shake(14); fx.sfx('thud', { pitch: 0.6 }); break;
        case 'boom':
          fx.shake(16); fx.flash('#ffe0a0', 0.5); fx.sfx('explode');
          for (let i = 0; i < 4; ++i) fx.burst(300 + i * 230, 360 + (i % 2) * 60, 30, '#ffb030', 420, 0.8, 1, true);
          break;
        case 'sparkle':
          fx.sfx('powerup', { pitch: 1.3, volume: 0.6 });
          for (let i = 0; i < 5; ++i) fx.burst(200 + i * 220, 140 + (i % 2) * 60, 26, ['#ffd84a', '#ff5da0', '#4fd0ff', '#7cf08a', '#c58bff'][i], 300, 1.1, 6, true, 120);
          break;
      }
    }
    if (s.fx === 'sparkle' && Math.random() < dt * 2) {
      const x = 150 + Math.random() * 980, y = 100 + Math.random() * 160;
      fx.burst(x, y, 22, ['#ffd84a', '#ff5da0', '#4fd0ff', '#7cf08a'][(Math.random() * 4) | 0], 260, 1, 6, true, 100);
      fx.sfx('smallExplode', { pitch: 1.6, volume: 0.25 });
    }
    if (Math.random() < dt * 4 && c.chars < s.text.length) fx.sfx('blip', { pitch: 1.6 + Math.random() * 0.4, volume: 0.08 });
  }

  /* Any key, click or tap: finish the line, else go to the next shot */
  function advance() {
    const c = G.cine;
    const s = shot();
    if (!c || !s) return;
    if (c.chars < s.text.length) {
      c.chars = s.text.length;
      return;
    }
    ++c.shot;
    c.t = 0;
    c.chars = 0;
    c.fired = false;
    fx.sfx('click', { volume: 0.4 });
    if (c.shot >= CINEMATICS[c.id].length) finish();
  }

  function skip() {
    if (G.cine) finish();
  }

  function finish() {
    const c = G.cine;
    G.cine = null;
    fx.clear();
    if (c && c.then) c.then();
    else NS.screens.setScreen('title');
  }

  Object.assign(NS.cine, {
    play, shot, update, advance, skip, TYPE_RATE
  });
})();
