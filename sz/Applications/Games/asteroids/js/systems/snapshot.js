/* Autosave and continue: the whole run - mode, level spec, ship, rocks, raiders, titan, pickups,
   stardust, pods, hazards, score, combo, overdrive and the seeded generator's position - as one
   JSON snapshot written every few seconds, on pause, between levels and when the page hides;
   restoring it puts the player back exactly where they were, paused. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const R = NS.rules;

  const LISTS = ['rocks', 'enemies', 'pickups', 'motes', 'pods', 'zones', 'mines', 'holes', 'strikes', 'eBullets', 'bullets'];

  /* internal scratch fields (underscore) never reach the save */
  function replacer(k, v) {
    return k.charAt(0) === '_' ? undefined : v;
  }

  function take() {
    const snap = {
      v: R.SAVE_VERSION,
      savedAt: Date.now(),
      run: G.run,
      level: G.level,
      ship: G.ship,
      boss: G.boss,
      score: G.score,
      combo: G.combo,
      comboT: G.comboT,
      bestCombo: G.bestCombo,
      overdrive: G.overdrive,
      nextId: G.nextId,
      rng: NS.sim.rngState(),
    };
    for (let i = 0; i < LISTS.length; ++i) snap[LISTS[i]] = G[LISTS[i]];
    return JSON.parse(JSON.stringify(snap, replacer));
  }

  let lastWrite = 0;

  function canSave() {
    return !!(G.run && !G.run.results && G.run.lives > 0 && (G.screen === 'playing' || G.screen === 'paused' || NS.screens.inRun && NS.screens.inRun()));
  }

  /* force: write now; otherwise at most every AUTOSAVE_EVERY seconds of play */
  function autosave(force) {
    if (!canSave()) return false;
    if (!force && G.time - lastWrite < NS.constants.AUTOSAVE_EVERY) return false;
    lastWrite = G.time;
    NS.save.writeSave();
    return NS.save.writeRun(take());
  }

  function has() {
    return !!NS.save.readRun();
  }

  function describe() {
    const s = NS.save.readRun();
    if (!s) return null;
    const run = s.run;
    const modes = NS.campaign.MODES;
    let where = modes[run.mode] ? modes[run.mode].name : run.mode;
    if (run.mode === 'story') where += ' ' + NS.campaign.levelKey(run.chapter, run.level) + ' - ' + (s.level && s.level.name);
    else if (run.mode === 'arcade' || run.mode === 'daily') where += ' - wave ' + run.wave;
    else if (run.mode === 'rush') where += ' - titan ' + (run.rushIdx + 1);
    return { where: where, score: s.score, savedAt: s.savedAt };
  }

  /* restores the saved run into the world; returns whether it worked */
  function restore() {
    const s = NS.save.readRun();
    if (!s) return false;
    try {
      NS.waves.clearWorld();
      G.run = s.run;
      G.level = s.level;
      G.ship = s.ship;
      G.boss = s.boss || null;
      G.score = s.score || 0;
      G.combo = s.combo || 0;
      G.comboT = s.comboT || 0;
      G.bestCombo = s.bestCombo || 0;
      G.overdrive = s.overdrive || 0;
      G.nextId = s.nextId || 1;
      for (let i = 0; i < LISTS.length; ++i) {
        const list = G[LISTS[i]];
        list.length = 0;
        const src = s[LISTS[i]] || [];
        for (let k = 0; k < src.length; ++k) list.push(src[k]);
      }
      NS.sim.setRngState(s.rng);
      G.run.results = null;
      return !!(G.run && G.level && G.ship);
    } catch (_) {
      clear();
      return false;
    }
  }

  function clear() {
    NS.save.clearRun();
  }

  Object.assign(NS.snapshot, {
    take, autosave, has, describe, restore, clear, LISTS
  });
})();
