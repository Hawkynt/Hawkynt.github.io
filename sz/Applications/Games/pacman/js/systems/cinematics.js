/* The cinematic sequencer: plays a script of shots (intro, chapter openings, boss entrances,
   relightings, the ending, plus the arcade intermission) on the full-screen 'cine' screen with
   sound cues and typed dialogue, remembers what has been seen, and hands control back.
   Any key, click or tap skips once the first moment has shown. Owns G.cine. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { STORY } = NS.worlds;
  const { sfx } = NS.audio;

  const INTERMISSION = [{ scene: 'chase', d: 5 }];

  function script(kind, data) {
    switch (kind) {
      case 'intro': return STORY.intro;
      case 'chapter': return STORY.chapter[data.world] || STORY.chapter[0];
      case 'boss': return STORY.boss;
      case 'relight': return STORY.relight;
      case 'ending': return STORY.ending;
      default: return INTERMISSION;
    }
  }

  function play(kind, data, onEnd) {
    const shots = script(kind, data || {});
    let total = 0;
    for (let i = 0; i < shots.length; ++i) total += shots[i].d;
    NS.fx.clear();
    G.cine = { kind: kind, shots: shots, i: 0, t: 0, shotT: 0, total: total, data: data || {}, onEnd: onEnd || null, ret: G.screen, typed: 0 };
    NS.screens.setScreen('cine');
    cue(G.cine.shots[0]);
  }

  function cue(shot) {
    if (!shot) return;
    switch (shot.scene) {
      case 'theft': sfx('whoosh', { pitch: 0.5, volume: 0.7 }); sfx('lose', { pitch: 0.8, volume: 0.4 }); break;
      case 'bossrise': sfx('explode', { pitch: 0.5, volume: 0.6 }); break;
      case 'relight': sfx('levelup', { pitch: 0.8 }); break;
      case 'card': sfx('select', { pitch: 0.8 }); break;
      case 'title': sfx('win', { volume: 0.5 }); break;
      case 'credits': sfx('win', { pitch: 0.8, volume: 0.4 }); break;
      case 'chase': sfx('whoosh', { volume: 0.4 }); break;
    }
  }

  function update(dt) {
    const c = G.cine;
    if (!c) return;
    c.t += dt;
    c.shotT += dt;
    const shot = c.shots[c.i];
    if (shot && shot.line) {
      const n = Math.floor(c.shotT * 38);
      if (n > c.typed && n <= shot.line.length && n % 3 === 0) sfx('click', { pitch: shot.who === 'king' ? 0.5 : shot.who === 'pip' ? 1.6 : 1, volume: 0.3 });
      c.typed = n;
    }
    if (shot && c.shotT >= shot.d) {
      ++c.i;
      c.shotT = 0;
      c.typed = 0;
      if (c.i >= c.shots.length) {
        end();
        return;
      }
      cue(c.shots[c.i]);
    }
  }

  /* the current shot (for drawing) */
  function current() {
    const c = G.cine;
    return c ? c.shots[Math.min(c.i, c.shots.length - 1)] : null;
  }

  function end() {
    const c = G.cine;
    if (!c) return;
    G.cine = null;
    if (G.profile) {
      G.profile.seen[c.kind + (c.kind === 'chapter' ? c.data.world : '')] = true;
      NS.save.writeProfile();
    }
    if (c.onEnd) c.onEnd();
    else NS.screens.setScreen(c.ret === 'cine' ? 'title' : c.ret);
  }

  function skip() {
    const c = G.cine;
    if (!c || c.t < 0.3) return;
    sfx('click', { volume: 0.4 });
    end();
  }

  Object.assign(NS.cinematics, {
    play, update, current, end, skip, script
  });
})();
