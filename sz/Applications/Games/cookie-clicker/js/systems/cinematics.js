/* Cinematics as shot lists: the intro (Grandma Rosa hands over the kitchen), the treat's
   transformation into each new era followed by the cast's lines, ascension into the Sugar
   Sanctum, and the Bake-Off countdown. A click or tap moves to the next shot, any key or
   Escape skips the rest. The bakery keeps baking underneath. Also the short transformation
   burst used when an era is reached again after ascending. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const C = NS.constants;
  const { STAGES } = NS.treatData;
  const { sfx } = NS.audio;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  function lineShots(lines) {
    return lines.map(l => ({ kind: 'talk', who: l[0], text: l[1], dur: 3.6 }));
  }

  function build(id, data) {
    if (id === 'intro')
      return [
        { kind: 'card', title: '»SZ« Bakery', sub: 'A tiny kitchen on a quiet street', dur: 3, sound: 'whoosh' },
        { kind: 'talk', who: 'rosa', text: 'Pip, my hands are tired. From today this little kitchen is yours.', dur: 4 },
        { kind: 'talk', who: 'pip', text: 'Mine? But all I can bake is one plain cookie!', dur: 3.6 },
        { kind: 'talk', who: 'rosa', text: 'Then click it. Again and again. Cookies become cupcakes, cupcakes become cakes...', dur: 4.2 },
        { kind: 'talk', who: 'baron', text: 'Ha! A grandma bakery? My factories will have this street by Friday.', dur: 3.8 },
        { kind: 'card', title: 'Era I', sub: STAGES[0].era, dur: 2.4, sound: 'levelup' },
      ];
    if (id === 'stage')
      return [{ kind: 'transform', from: data.from, to: data.to, dur: 3.4 },
        { kind: 'card', title: 'Era ' + ROMAN[data.to], sub: STAGES[data.to].era, dur: 2.2, sound: 'levelup' }].concat(lineShots(STAGES[data.to].lines));
    if (id === 'ascend')
      return [{ kind: 'ascend', gained: data.gained, dur: 4, sound: 'win' },
        { kind: 'talk', who: 'oracle', text: 'You return as a humble cookie, yet ' + data.gained + ' sugar crystal' + (data.gained > 1 ? 's' : '') + ' glow in your pocket.', dur: 4 },
        { kind: 'talk', who: 'rosa', text: 'Back to one plain cookie? Pfff. You know the way now, Pip.', dur: 3.4 }];
    if (id === 'bakeStart') {
      const shots = [];
      if (!G.profile.stats.bakeoffs)
        shots.push({ kind: 'talk', who: 'baron', text: 'A Bake-Off! Three minutes, empty kitchens. Let us see who is the real baker.', dur: 3.8 });
      shots.push({ kind: 'countdown', title: data.daily ? 'Daily Bake-Off' : 'Bake-Off', sub: data.mods ? data.mods.name + ': ' + data.mods.desc : 'Bake as much as you can in 3 minutes', dur: 3.2 });
      return shots;
    }
    return [];
  }

  function play(id, data, onEnd) {
    const shots = build(id, data || {});
    if (!shots.length) return;
    G.cine = { id: id, data: data || {}, shots: shots, i: 0, t: 0, started: false, onEnd: onEnd || null };
    G.goldens.length = 0;
  }

  function startShot(s) {
    if (s.sound) sfx(s.sound);
    const L = C.LAYOUT;
    if (s.kind === 'talk') sfx('blip', { pitch: 1.4, volume: 0.3 });
    if (s.kind === 'ascend') NS.fx.flash(0.6, '#f0e0ff');
    if (s.kind === 'transform') {
      G.ui.cineFlashDone = false;
      NS.fx.ring(L.treatX, L.treatY, 10, 300, 1.2, '#ffffff', 6);
    }
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
    if (s.kind === 'transform') transformFx(s, c.t);
    if (s.kind === 'countdown') {
      const k = Math.floor(c.t);
      if (k !== c.lastCount && k < 3) {
        c.lastCount = k;
        sfx('blip', { pitch: 0.8 + k * 0.1 });
      }
    }
    if (c.t >= s.dur) next();
  }

  /* the old treat trembles and glows, bursts at 1.5 s, the new one lands */
  function transformFx(s, t) {
    const L = C.LAYOUT;
    if (t < 1.5 && Math.random() < 0.6) {
      const a = Math.random() * C.TAU;
      NS.fx.spawn(L.treatX + Math.cos(a) * 220, L.treatY + Math.sin(a) * 220, -Math.cos(a) * 240, -Math.sin(a) * 240, 0.9, 4, '#fff4c0', 'spark', 0);
      G.shake = Math.max(G.shake, t * 3);
    }
    if (t >= 1.5 && !G.ui.cineFlashDone) {
      G.ui.cineFlashDone = true;
      NS.fx.flash(1, '#ffffff');
      NS.fx.shake(16);
      NS.fx.burst(L.treatX, L.treatY, 90, ['#ffffff', '#ffd25a', '#ff9ac0', '#9affea'], 'stars', 620, 260, 7);
      NS.fx.ring(L.treatX, L.treatY, 40, 420, 1, '#ffd25a', 8);
      sfx('explode', { volume: 0.5, pitch: 1.4 });
      sfx('levelup');
      G.treatSquashV = -20;
    }
  }

  function next() {
    const c = G.cine;
    if (!c) return;
    const s = c.shots[c.i];
    if (s.kind === 'transform' && c.t < 1.5) G.ui.cineFlashDone = false;
    ++c.i;
    c.t = 0;
    c.started = false;
    if (c.i >= c.shots.length) end();
  }

  function skip() {
    const c = G.cine;
    if (!c) return;
    end();
  }

  function end() {
    const c = G.cine;
    G.cine = null;
    if (c.id === 'intro') G.profile.seenIntro = true;
    if (c.onEnd) c.onEnd();
    sfx('whoosh', { volume: 0.4 });
  }

  /* a short burst when an already-seen era comes back after ascending */
  function quickTransform(from, to) {
    const L = C.LAYOUT;
    NS.fx.flash(0.5, '#fff8e0');
    NS.fx.shake(8);
    NS.fx.burst(L.treatX, L.treatY, 50, ['#ffffff', '#ffd25a', '#ff9ac0'], 'stars', 480, 260, 6);
    NS.fx.ring(L.treatX, L.treatY, 30, 300, 0.8, '#ffd25a', 6);
    G.treatSquashV = -16;
    sfx('levelup');
    NS.screens.toast('The treat evolves: ' + STAGES[to].name + '! Era ' + ROMAN[to] + ' - ' + STAGES[to].era, C.UI.gold, 'recipe');
    return from;
  }

  Object.assign(NS.cinematics, { ROMAN, build, play, update, next, skip, quickTransform });
})();
