/* The cinematic sequencer and the story flow around levels: full-screen sequences (the opening,
   a chapter arrival through warp, a titan's reveal, the finale, a season's opening) timed on the
   cine screen and skippable by any key, click or tap once the first beat has shown; and the
   chain that leads into a story level (opening, chapter arrival, briefing dialogue, titan reveal)
   and out of a chapter (debriefing, finale). Owns G.cine. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { CHAPTERS, INTRO } = NS.campaign;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  const KINDS = {
    intro: { dur: 15 },
    chapter: { dur: 6.5 },
    boss: { dur: 5 },
    ending: { dur: 20 },
    season: { dur: 6 },
  };

  /* timed sound cues per kind: [time, sound, pitch, volume] */
  const CUES = {
    intro: [[0.2, 'whoosh', 0.5, 0.5], [3.2, 'explode', 0.5, 0.5], [6, 'thud', 0.6, 0.6], [9.5, 'powerup', 0.7, 0.6], [11.5, 'whoosh', 1.2, 0.7]],
    chapter: [[0.1, 'whoosh', 0.6, 0.6], [2.4, 'zap', 0.5, 0.5], [3, 'levelup', 0.7, 0.6]],
    boss: [[0.2, 'hurt', 0.4, 0.6], [1.6, 'explode', 0.4, 0.7], [2.2, 'levelup', 0.5, 0.6]],
    ending: [[0.5, 'explode', 0.4, 0.8], [3, 'explode', 0.5, 0.7], [7, 'whoosh', 0.8, 0.5], [12, 'win', 1, 0.7], [14, 'pickup', 1.3, 0.4], [15, 'pickup', 1.6, 0.4]],
    season: [[0.2, 'powerup', 1.2, 0.5], [1.5, 'win', 1.1, 0.5]],
  };

  let returnTo = 'title';

  function play(kind, data, onEnd) {
    const k = KINDS[kind];
    returnTo = G.screen;
    G.cine = { kind: kind, t: 0, dur: k.dur, data: data || {}, onEnd: onEnd || null, fired: {} };
    NS.screens.setScreen('cine');
  }

  function update(dt) {
    const c = G.cine;
    if (!c) return;
    c.t += dt;
    const cues = CUES[c.kind] || [];
    for (let i = 0; i < cues.length; ++i) {
      const q = cues[i];
      if (c.t >= q[0] && !c.fired[i]) {
        c.fired[i] = true;
        sfx(q[1], { pitch: q[2], volume: q[3] });
      }
    }
    if (c.kind === 'ending' && c.t > 12 && Math.random() < 0.08) sfx('pickup', { pitch: 1 + Math.random(), volume: 0.25 });
    if (c.t >= c.dur) end();
  }

  function skippable() {
    return G.cine && G.cine.t > 0.6;
  }

  function skip() {
    if (skippable()) end();
  }

  function end() {
    const c = G.cine;
    if (!c) return;
    G.cine = null;
    if (c.onEnd) c.onEnd();
    else NS.screens.setScreen(returnTo === 'cine' ? 'title' : returnTo);
  }

  /* ── story flow ── */

  /* everything that plays before a story level, then the level itself */
  function enterLevel(c, l) {
    const sv = G.save;
    const ch = CHAPTERS[c];
    const steps = [];
    if (c === 0 && l === 0 && !sv.seen.intro) {
      steps.push((next) => play('intro', {}, next));
      steps.push((next) => NS.story.show(INTRO, next, 'Prologue'));
      steps.push((next) => { sv.seen.intro = true; next(); });
    }
    if (l === 0 && !sv.seen['ch' + c]) {
      steps.push((next) => play('chapter', { chapter: c }, next));
      steps.push((next) => NS.story.show(ch.intro, next, ch.sub + ' - ' + ch.name));
      steps.push((next) => { sv.seen['ch' + c] = true; NS.save.writeSave(); next(); });
    }
    if (ch.levels[l].boss) steps.push((next) => play('boss', { boss: ch.levels[l].boss, chapter: c }, next));
    steps.push(() => {
      NS.waves.startRun('story', { chapter: c, level: l });
      NS.screens.setScreen('playing');
    });
    chain(steps);
  }

  /* after a chapter's titan falls for the first time: debriefing, then the finale after the last */
  function leaveChapter(c, done) {
    const ch = CHAPTERS[c];
    const steps = [(next) => NS.story.show(ch.outro, next, ch.sub + ' - debriefing')];
    if (c === CHAPTERS.length - 1) steps.push((next) => play('ending', {}, next));
    steps.push(() => done());
    chain(steps);
  }

  function chain(steps) {
    let i = 0;
    const next = () => {
      const f = steps[i++];
      if (f) f(next);
    };
    next();
  }

  /* the season's opening sequence, once per season key */
  function seasonIntro(done) {
    const key = 'season:' + G.cal.seasonKey;
    if (G.save.seen[key]) { done(); return false; }
    G.save.seen[key] = true;
    NS.save.writeSave();
    play('season', { season: G.cal.season }, done);
    fx.flash(G.cal.seasonDef.accent, 0.2);
    return true;
  }

  Object.assign(NS.cinematics, {
    KINDS, play, update, skip, skippable, end, enterLevel, leaveChapter, seasonIntro
  });
})();
